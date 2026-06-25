import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq, sql, or } from "drizzle-orm";
import { db, usersTable, verificationAuditLogTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { signToken, requireAuth } from "../middlewares/auth";
import { OAuth2Client } from "google-auth-library";
import { createNotification, bi } from "../lib/notif";
import {
  generateOTP,
  hashOTP,
  verifyOTP,
  otpExpiryDate,
  sendVerificationCode,
  sendEmailOTP,
} from "../services/verification";
import { checkIpRateLimit, checkLoginRateLimit, checkRegisterRateLimit } from "../lib/rateLimiter";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../services/emailService";
import { verifyTurnstileToken, TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from "../services/turnstileService";

const router: IRouter = Router();

// ─── GET /auth/turnstile-config ───────────────────────────────────────────────
// Exposes the public Turnstile site key + enabled flag to the frontend.
// The secret key never leaves the server.
router.get("/auth/turnstile-config", (_req, res) => {
  res.json({ siteKey: TURNSTILE_SITE_KEY, enabled: TURNSTILE_ENABLED });
});

// JWT secret reused for short-lived password-reset tokens (purpose field distinguishes them)
const RESET_JWT_SECRET: string = (() => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET environment variable is required");
  return s;
})();

function signResetToken(userId: number): string {
  return jwt.sign({ userId, purpose: "password_reset" }, RESET_JWT_SECRET, { expiresIn: "15m" });
}

function verifyResetToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, RESET_JWT_SECRET) as Record<string, unknown>;
    if (payload?.purpose !== "password_reset") return null;
    return typeof payload.userId === "number" ? payload.userId : null;
  } catch {
    return null;
  }
}

// ─── Feature flags ────────────────────────────────────────────────────────────
// Set ENABLE_EMAIL_VERIFICATION=true or ENABLE_PHONE_VERIFICATION=true to re-enable.
// DB schema, OTP routes and all verification logic remain intact.
const VERIFICATION_ENABLED =
  process.env.ENABLE_EMAIL_VERIFICATION === "true" ||
  process.env.ENABLE_PHONE_VERIFICATION === "true";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIp(req: any): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    "unknown"
  );
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    name: u.name,
    role: u.role,
    isVerified: u.isVerified,
    sellerStatus: u.sellerStatus,
    trustLevel: u.trustLevel,
    createdAt: u.createdAt.toISOString(),
    avatarUrl: u.avatarUrl ?? null,
    authProvider: u.authProvider ?? "local",
    googleId: u.googleId ? true : false,
    facebookId: u.facebookId ? true : false,
    deliveryLat: u.deliveryLat ?? null,
    deliveryLng: u.deliveryLng ?? null,
    deliveryZoneId: u.deliveryZoneId ?? null,
  };
}

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

async function auditLog(
  userId: number,
  event: string,
  method: string | null,
  ip: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(verificationAuditLogTable).values({
      userId, event, method, ipAddress: ip, metadata: metadata ?? null,
    });
  } catch {}
}

// Per-user OTP rate limit: 5 sends per rolling hour, tracked in DB
async function checkUserRateLimit(userId: number): Promise<{ allowed: boolean; retryAfter?: number }> {
  const [u] = await db
    .select({ count: usersTable.otpRequestCount, windowStart: usersTable.otpRequestWindowStart })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!u) return { allowed: false };

  const now = new Date();
  const WINDOW = 60 * 60 * 1000;
  const MAX = 5;

  if (!u.windowStart || now.getTime() - u.windowStart.getTime() > WINDOW) {
    await db.update(usersTable)
      .set({ otpRequestCount: 1, otpRequestWindowStart: now })
      .where(eq(usersTable.id, userId));
    return { allowed: true };
  }

  if (u.count >= MAX) {
    const retryAfter = Math.ceil((WINDOW - (now.getTime() - u.windowStart.getTime())) / 1000);
    return { allowed: false, retryAfter };
  }

  await db.update(usersTable)
    .set({ otpRequestCount: sql`${usersTable.otpRequestCount} + 1` })
    .where(eq(usersTable.id, userId));
  return { allowed: true };
}

// Core: generate OTP → hash → store → send
async function dispatchOtp(
  user: typeof usersTable.$inferSelect,
  identifier: string,
  ip: string,
  locale: string,
  eventName = "otp_sent"
): Promise<{ method: "email" | "phone"; expiresAt: Date }> {
  const otp = generateOTP();
  const otpHash = await hashOTP(otp);
  const expiresAt = otpExpiryDate();
  const method = await sendVerificationCode(identifier, otp, locale);

  await db.update(usersTable)
    .set({ otpHash, otpExpiresAt: expiresAt, otpAttempts: 0, otpLockedUntil: null, verificationMethod: method })
    .where(eq(usersTable.id, user.id));

  await auditLog(user.id, eventName, method, ip);
  return { method, expiresAt };
}

// ─── POST /auth/register ──────────────────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const ip = getIp(req);

  // IP-level rate limit: 5 registrations per hour prevents automated sign-up abuse
  const regCheck = checkRegisterRateLimit(ip);
  if (!regCheck.allowed) {
    res.status(429).json({ error: "Too many registration attempts. Try again later.", retryAfter: regCheck.retryAfter });
    return;
  }

  // Cloudflare Turnstile bot protection
  const tsResult = await verifyTurnstileToken(req.body.turnstileToken, ip);
  if (!tsResult.success) {
    res.status(400).json({ error: "TURNSTILE_INVALID" });
    return;
  }

  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? parsed.error.message });
    return;
  }
  const { password } = parsed.data;
  const email = parsed.data.email?.toLowerCase().trim();
  const phone = parsed.data.phone?.trim();
  const safeName = parsed.data.name.replace(/<[^>]*>/g, "").trim();

  if (!safeName) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  if (email) {
    const [ex] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (ex) { res.status(400).json({ error: "Email already registered" }); return; }
  }
  if (phone) {
    const [ex] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone));
    if (ex) { res.status(400).json({ error: "Phone number already registered" }); return; }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (!VERIFICATION_ENABLED) {
    // Verification disabled — create account as already verified and return a token immediately.
    const [user] = await db.insert(usersTable)
      .values({ email, phone, passwordHash, name: safeName, role: "customer", isVerified: true,
                otpRequestCount: 0, otpRequestWindowStart: new Date() })
      .returning();
    const token = signToken({ userId: user.id, role: user.role, email: user.email, isVerified: true });

    // Welcome email — fire-and-forget
    if (email) {
      sendWelcomeEmail(email, safeName, "ar").catch(() => {});
    }

    // Notify admins of new registration — fire-and-forget
    db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"))
      .then((admins) =>
        Promise.allSettled(admins.map((admin) =>
          createNotification({
            userId: admin.id,
            type: "new_user",
            title: bi("New User Registered", "مستخدم جديد"),
            body: bi(
              `${safeName} just created an account on the platform.`,
              `قام ${safeName} بإنشاء حساب جديد على المنصة.`
            ),
            priority: "normal",
            link: `/admin/users`,
          })
        ))
      ).catch(() => {});

    res.status(201).json({ user: formatUser(user), token });
    return;
  }

  const [user] = await db.insert(usersTable)
    .values({ email, phone, passwordHash, name: safeName, role: "customer", isVerified: false,
              otpRequestCount: 1, otpRequestWindowStart: new Date() })
    .returning();

  // Welcome email — fire-and-forget
  if (email) {
    sendWelcomeEmail(email, safeName, "ar").catch(() => {});
  }

  // Notify admins of new registration — fire-and-forget
  db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"))
    .then((admins) =>
      Promise.allSettled(admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: "new_user",
          title: bi("New User Registered", "مستخدم جديد"),
          body: bi(
            `${safeName} just created an account on the platform.`,
            `قام ${safeName} بإنشاء حساب جديد على المنصة.`
          ),
          priority: "normal",
          link: `/admin/users`,
        })
      ))
    ).catch(() => {});

  const identifier = email ?? phone!;
  let method: "email" | "phone" = identifier.includes("@") ? "email" : "phone";

  try {
    const result = await dispatchOtp(user, identifier, ip, "en");
    method = result.method;
  } catch (err) {
    console.error("[OTP] Send failed on register:", err);
  }

  res.status(201).json({
    pendingVerification: true,
    identifier,
    method,
    message: "Account created. Please verify your account to continue.",
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res): Promise<void> => {
  const ip = getIp(req);

  // IP-level rate limit: 10 attempts per 15 minutes prevents brute-force attacks
  const loginCheck = checkLoginRateLimit(ip);
  if (!loginCheck.allowed) {
    res.status(429).json({ error: "Too many login attempts. Try again later.", retryAfter: loginCheck.retryAfter });
    return;
  }

  // Cloudflare Turnstile bot protection
  const tsResult = await verifyTurnstileToken(req.body.turnstileToken, ip);
  if (!tsResult.success) {
    res.status(400).json({ error: "TURNSTILE_INVALID" });
    return;
  }

  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? parsed.error.message });
    return;
  }
  const { password } = parsed.data;
  const email = parsed.data.email?.toLowerCase().trim();
  const phone = parsed.data.phone?.trim();

  const [user] = email
    ? await db.select().from(usersTable).where(eq(usersTable.email, email))
    : await db.select().from(usersTable).where(eq(usersTable.phone, phone!));

  if (!user) { res.status(401).json({ error: "USER_NOT_FOUND" }); return; }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "INVALID_PASSWORD" }); return; }

  if (user.accountStatus && user.accountStatus !== "active") {
    res.status(403).json({
      error: "ACCOUNT_SUSPENDED",
      accountStatus: user.accountStatus,
      message: "Your account has been suspended. Please contact support.",
    });
    return;
  }

  if (VERIFICATION_ENABLED && !user.isVerified) {
    const identifier = email ?? phone!;
    const ip = getIp(req);
    const rateCheck = await checkUserRateLimit(user.id);
    if (rateCheck.allowed) {
      try { await dispatchOtp(user, identifier, ip, "en", "otp_sent_on_login"); }
      catch (err) { console.error("[OTP] Auto-send on unverified login failed:", err); }
    }
    res.status(403).json({
      verified: false,
      identifier,
      method: user.verificationMethod ?? (email ? "email" : "phone"),
      message: "Account not verified. Please verify to continue.",
    });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role, email: user.email, isVerified: true });
  res.json({ user: formatUser(user), token });
});

// ─── POST /auth/send-otp ──────────────────────────────────────────────────────

router.post("/auth/send-otp", async (req, res): Promise<void> => {
  const { identifier, locale } = req.body as { identifier?: string; locale?: string };
  if (!identifier || typeof identifier !== "string") {
    res.status(400).json({ error: "identifier is required" }); return;
  }

  const ip = getIp(req);
  const ipCheck = checkIpRateLimit(ip);
  if (!ipCheck.allowed) {
    res.status(429).json({ error: "Too many requests. Try again later.", retryAfter: ipCheck.retryAfter }); return;
  }

  const isEmail = identifier.includes("@");
  const normalizedIdentifier = isEmail ? identifier.toLowerCase().trim() : identifier.trim();
  const [user] = isEmail
    ? await db.select().from(usersTable).where(eq(usersTable.email, normalizedIdentifier))
    : await db.select().from(usersTable).where(eq(usersTable.phone, normalizedIdentifier));

  // Anti-enumeration: same response whether account exists or not
  if (!user) {
    res.json({ message: "If an account exists, a code was sent.", expiresIn: 600 }); return;
  }

  const userCheck = await checkUserRateLimit(user.id);
  if (!userCheck.allowed) {
    res.status(429).json({ error: "Too many verification requests. Try again later.", retryAfter: userCheck.retryAfter }); return;
  }

  try {
    const { expiresAt } = await dispatchOtp(user, identifier, ip, locale ?? "en");
    res.json({ message: "Verification code sent.", expiresAt: expiresAt.toISOString(), expiresIn: 600 });
  } catch (err) {
    console.error("[OTP] send-otp failed:", err);
    res.status(500).json({ error: "Failed to send code. Please try again." });
  }
});

// ─── POST /auth/resend-otp ────────────────────────────────────────────────────

router.post("/auth/resend-otp", async (req, res): Promise<void> => {
  const { identifier, locale } = req.body as { identifier?: string; locale?: string };
  if (!identifier || typeof identifier !== "string") {
    res.status(400).json({ error: "identifier is required" }); return;
  }

  const ip = getIp(req);
  const ipCheck = checkIpRateLimit(ip);
  if (!ipCheck.allowed) {
    res.status(429).json({ error: "Too many requests. Try again later.", retryAfter: ipCheck.retryAfter }); return;
  }

  const isEmail = identifier.includes("@");
  const normalizedIdentifier = isEmail ? identifier.toLowerCase().trim() : identifier.trim();
  const [user] = isEmail
    ? await db.select().from(usersTable).where(eq(usersTable.email, normalizedIdentifier))
    : await db.select().from(usersTable).where(eq(usersTable.phone, normalizedIdentifier));

  if (!user) {
    res.json({ message: "If an account exists, a code was sent.", expiresIn: 600 }); return;
  }

  const userCheck = await checkUserRateLimit(user.id);
  if (!userCheck.allowed) {
    res.status(429).json({ error: "Too many requests. Try again later.", retryAfter: userCheck.retryAfter }); return;
  }

  try {
    const { expiresAt } = await dispatchOtp(user, identifier, ip, locale ?? "en", "otp_resent");
    res.json({ message: "Verification code resent.", expiresAt: expiresAt.toISOString(), expiresIn: 600 });
  } catch (err) {
    console.error("[OTP] resend-otp failed:", err);
    res.status(500).json({ error: "Failed to resend code. Please try again." });
  }
});

// ─── POST /auth/verify-otp ────────────────────────────────────────────────────

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { identifier, code } = req.body as { identifier?: string; code?: string };
  if (!identifier || !code) {
    res.status(400).json({ error: "identifier and code are required" }); return;
  }
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Code must be 6 digits" }); return;
  }

  const ip = getIp(req);
  const isEmail = identifier.includes("@");
  const normalizedIdentifier = isEmail ? identifier.toLowerCase().trim() : identifier.trim();
  const [user] = isEmail
    ? await db.select().from(usersTable).where(eq(usersTable.email, normalizedIdentifier))
    : await db.select().from(usersTable).where(eq(usersTable.phone, normalizedIdentifier));

  if (!user) { res.status(400).json({ error: "Invalid verification code" }); return; }

  // Lockout check
  if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
    const retryAfter = Math.ceil((user.otpLockedUntil.getTime() - Date.now()) / 1000);
    res.status(429).json({
      error: "Too many failed attempts. Account temporarily locked.",
      retryAfter,
      lockedUntil: user.otpLockedUntil.toISOString(),
    });
    return;
  }

  if (!user.otpHash || !user.otpExpiresAt) {
    res.status(400).json({ error: "No code found. Request a new one." }); return;
  }

  if (user.otpExpiresAt < new Date()) {
    res.status(400).json({ error: "Code has expired. Request a new one." }); return;
  }

  const match = await verifyOTP(code, user.otpHash);

  if (!match) {
    const attempts = user.otpAttempts + 1;
    const MAX = 5;
    if (attempts >= MAX) {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      await db.update(usersTable)
        .set({ otpAttempts: attempts, otpLockedUntil: lockedUntil })
        .where(eq(usersTable.id, user.id));
      await auditLog(user.id, "otp_locked", user.verificationMethod, ip, { attempts });
      res.status(429).json({ error: "Too many failed attempts. Account locked for 30 minutes.", retryAfter: 30 * 60 });
    } else {
      await db.update(usersTable).set({ otpAttempts: attempts }).where(eq(usersTable.id, user.id));
      await auditLog(user.id, "otp_failed", user.verificationMethod, ip, { attempts });
      res.status(400).json({ error: "Invalid verification code", attemptsRemaining: MAX - attempts });
    }
    return;
  }

  // ✅ Correct — verify account, clear OTP fields
  await db.update(usersTable)
    .set({ isVerified: true, verifiedAt: new Date(), otpHash: null, otpExpiresAt: null,
           otpAttempts: 0, otpLockedUntil: null })
    .where(eq(usersTable.id, user.id));

  await auditLog(user.id, "verified", user.verificationMethod, ip);

  const [verified] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const token = signToken({ userId: verified.id, role: verified.role, email: verified.email, isVerified: true });
  res.json({ user: formatUser(verified), token });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/auth/logout", (_req, res): void => {
  res.json({ message: "Logged out successfully" });
});

// ─── PATCH /auth/me ───────────────────────────────────────────────────────────

router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const { name, phone, deliveryLat, deliveryLng, deliveryZoneId } = req.body;
  const patch: Record<string, unknown> = {};
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "Name must be at least 2 characters" });
      return;
    }
    patch.name = name.trim();
  }
  if (phone !== undefined) {
    if (phone !== null && typeof phone !== "string") {
      res.status(400).json({ error: "Phone must be a string or null" });
      return;
    }
    patch.phone = phone ?? null;
  }
  if (deliveryLat !== undefined) {
    if (deliveryLat !== null && typeof deliveryLat !== "number") {
      res.status(400).json({ error: "deliveryLat must be a number or null" });
      return;
    }
    patch.deliveryLat = deliveryLat ?? null;
  }
  if (deliveryLng !== undefined) {
    if (deliveryLng !== null && typeof deliveryLng !== "number") {
      res.status(400).json({ error: "deliveryLng must be a number or null" });
      return;
    }
    patch.deliveryLng = deliveryLng ?? null;
  }
  if (deliveryZoneId !== undefined) {
    if (deliveryZoneId !== null && typeof deliveryZoneId !== "number") {
      res.status(400).json({ error: "deliveryZoneId must be a number or null" });
      return;
    }
    patch.deliveryZoneId = deliveryZoneId ?? null;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set(patch as any)
    .where(eq(usersTable.id, req.user!.userId))
    .returning();
  res.json(formatUser(updated));
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

// ─── POST /auth/reissue ───────────────────────────────────────────────────────

router.post("/auth/reissue", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const token = signToken({ userId: user.id, role: user.role, email: user.email, isVerified: user.isVerified });
  res.json({ user: formatUser(user), token });
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const ip = getIp(req);
  const ipCheck = checkIpRateLimit(ip);
  if (!ipCheck.allowed) {
    res.status(429).json({ error: "Too many requests. Try again later.", retryAfter: ipCheck.retryAfter });
    return;
  }

  // Cloudflare Turnstile bot protection
  const tsResult = await verifyTurnstileToken(req.body.turnstileToken, ip);
  if (!tsResult.success) {
    res.status(400).json({ error: "TURNSTILE_INVALID" });
    return;
  }

  const { email, locale } = req.body as { email?: string; locale?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));

  // Anti-enumeration: identical response whether account exists or not
  const GENERIC = { message: "If an account exists with this email, a reset code was sent.", expiresIn: 600 };

  if (!user) { res.json(GENERIC); return; }

  // Per-user send rate limit (reuses OTP request counter)
  const userCheck = await checkUserRateLimit(user.id);
  if (!userCheck.allowed) {
    res.status(429).json({ error: "Too many requests. Try again later.", retryAfter: userCheck.retryAfter });
    return;
  }

  // Honour existing lockout
  if (user.resetOtpLockedUntil && user.resetOtpLockedUntil > new Date()) {
    const retryAfter = Math.ceil((user.resetOtpLockedUntil.getTime() - Date.now()) / 1000);
    res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter });
    return;
  }

  const otp = generateOTP();
  const otpHash = await hashOTP(otp);
  const expiresAt = otpExpiryDate();

  await db.update(usersTable)
    .set({ resetOtpHash: otpHash, resetOtpExpiresAt: expiresAt, resetOtpAttempts: 0, resetOtpLockedUntil: null })
    .where(eq(usersTable.id, user.id));

  try {
    await sendEmailOTP(normalizedEmail, otp, locale ?? "en");
  } catch (err) {
    console.error("[OTP] forgot-password email failed:", err);
  }

  // Password reset email with link — fire-and-forget
  const resetLink = `${process.env.SITE_URL ?? "https://syanomarket.online"}/reset-password?email=${encodeURIComponent(normalizedEmail)}`;
  sendPasswordResetEmail(normalizedEmail, resetLink, (locale === "ar" || locale === "en") ? locale : "ar").catch(() => {});

  await auditLog(user.id, "reset_otp_sent", "email", ip);
  res.json(GENERIC);
});

// ─── POST /auth/verify-reset-otp ─────────────────────────────────────────────

router.post("/auth/verify-reset-otp", async (req, res): Promise<void> => {
  const { email, code } = req.body as { email?: string; code?: string };
  if (!email || !code) {
    res.status(400).json({ error: "email and code are required" }); return;
  }
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Code must be 6 digits" }); return;
  }

  const ip = getIp(req);
  const normalizedEmail = email.toLowerCase().trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));

  if (!user) { res.status(400).json({ error: "Invalid or expired reset code" }); return; }

  if (user.resetOtpLockedUntil && user.resetOtpLockedUntil > new Date()) {
    const retryAfter = Math.ceil((user.resetOtpLockedUntil.getTime() - Date.now()) / 1000);
    res.status(429).json({ error: "Too many failed attempts. Try again later.", retryAfter, lockedUntil: user.resetOtpLockedUntil.toISOString() });
    return;
  }

  if (!user.resetOtpHash || !user.resetOtpExpiresAt) {
    res.status(400).json({ error: "No reset code found. Request a new one." }); return;
  }

  if (user.resetOtpExpiresAt < new Date()) {
    res.status(400).json({ error: "Reset code has expired. Request a new one." }); return;
  }

  const match = await verifyOTP(code, user.resetOtpHash);

  if (!match) {
    const attempts = user.resetOtpAttempts + 1;
    const MAX = 5;
    if (attempts >= MAX) {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      await db.update(usersTable)
        .set({ resetOtpAttempts: attempts, resetOtpLockedUntil: lockedUntil })
        .where(eq(usersTable.id, user.id));
      await auditLog(user.id, "reset_otp_locked", "email", ip, { attempts });
      res.status(429).json({ error: "Too many failed attempts. Locked for 30 minutes.", retryAfter: 30 * 60 });
    } else {
      await db.update(usersTable).set({ resetOtpAttempts: attempts }).where(eq(usersTable.id, user.id));
      await auditLog(user.id, "reset_otp_failed", "email", ip, { attempts });
      res.status(400).json({ error: "Invalid reset code", attemptsRemaining: MAX - attempts });
    }
    return;
  }

  // ✅ Correct — clear reset OTP and issue a short-lived reset token
  await db.update(usersTable)
    .set({ resetOtpHash: null, resetOtpExpiresAt: null, resetOtpAttempts: 0, resetOtpLockedUntil: null })
    .where(eq(usersTable.id, user.id));

  await auditLog(user.id, "reset_otp_verified", "email", ip);
  res.json({ resetToken: signResetToken(user.id) });
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { resetToken, password } = req.body as { resetToken?: string; password?: string };

  if (!resetToken || !password) {
    res.status(400).json({ error: "resetToken and password are required" }); return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" }); return;
  }

  const userId = verifyResetToken(resetToken);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired reset link. Request a new code." }); return;
  }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));

  await auditLog(userId, "password_reset", "email", getIp(req));
  res.json({ message: "Password reset successfully." });
});

// ─── GET /user/settings ───────────────────────────────────────────────────────

router.get("/user/settings", requireAuth, async (req, res): Promise<void> => {
  const rawResult = await db.execute(sql`
    SELECT preferred_theme, preferred_language, preferred_currency
    FROM users WHERE id = ${req.user!.userId}
  `);
  const row = (rawResult.rows?.[0] ?? (rawResult as any)[0]) as Record<string, unknown> | undefined;
  if (!row) { res.status(401).json({ error: "User not found" }); return; }
  res.json({
    theme:    (row.preferred_theme    as string | null) ?? "dark",
    language: (row.preferred_language as string | null) ?? "ar",
    currency: (row.preferred_currency as string | null) ?? "SYP",
  });
});

// ─── PATCH /user/settings ─────────────────────────────────────────────────────

router.patch("/user/settings", requireAuth, async (req, res): Promise<void> => {
  const { theme, language, currency } = req.body as {
    theme?: unknown; language?: unknown; currency?: unknown;
  };
  let updated = false;
  if (typeof theme === "string" && ["light", "dark", "system"].includes(theme)) {
    await db.execute(sql`UPDATE users SET preferred_theme = ${theme} WHERE id = ${req.user!.userId}`);
    updated = true;
  }
  if (typeof language === "string" && ["ar", "en"].includes(language)) {
    await db.execute(sql`UPDATE users SET preferred_language = ${language} WHERE id = ${req.user!.userId}`);
    updated = true;
  }
  if (typeof currency === "string" && ["SYP", "USD"].includes(currency)) {
    await db.execute(sql`UPDATE users SET preferred_currency = ${currency} WHERE id = ${req.user!.userId}`);
    updated = true;
  }
  if (!updated) { res.status(400).json({ error: "No valid settings provided" }); return; }
  res.json({ ok: true });
});

// ─── GET /auth/google-client-id ───────────────────────────────────────────────
// Returns the Google OAuth client ID for the frontend GIS initializer.
// The client ID is not secret — it is safe to expose publicly.
router.get("/auth/google-client-id", (_req, res): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  if (!clientId) {
    res.status(503).json({ error: "Google Sign-In is not configured" });
    return;
  }
  res.json({ clientId });
});

// ─── POST /auth/google ────────────────────────────────────────────────────────
// Accepts a Google ID token from the frontend (issued by Google Identity Services).
// Verifies it server-side, then creates or links the user, and issues a SYANO JWT.
router.post("/auth/google", async (req, res): Promise<void> => {
  const ip = getIp(req);

  if (!googleClient || !process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: "Google Sign-In is not configured on this server" });
    return;
  }

  const { idToken, rememberMe } = req.body as { idToken?: string; rememberMe?: boolean };
  if (!idToken || typeof idToken !== "string") {
    res.status(400).json({ error: "idToken is required" });
    return;
  }

  // 1. Verify the ID token with Google's servers
  let payload: import("google-auth-library").TokenPayload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p) throw new Error("Empty payload");
    payload = p;
  } catch (err) {
    console.error("[Google Auth] Token verification failed:", err);
    res.status(401).json({ error: "Invalid Google token. Please try again." });
    return;
  }

  const { sub: googleId, email, name, picture } = payload;

  if (!email) {
    res.status(400).json({ error: "Google account must have a verified email address" });
    return;
  }

  const safeEmail = email.toLowerCase().trim();
  const safeName = (name ?? safeEmail.split("@")[0]).replace(/<[^>]*>/g, "").trim();
  const avatarUrl = picture ?? null;

  // 2. Find existing user by googleId OR email (prevents duplicates)
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.googleId, googleId), eq(usersTable.email, safeEmail)))
    .limit(1);

  let user: typeof usersTable.$inferSelect;

  if (existing) {
    // Case B: user exists — link Google account and optionally update avatar
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (!existing.googleId) updates.googleId = googleId;
    if (!existing.avatarUrl && avatarUrl) updates.avatarUrl = avatarUrl;
    if (Object.keys(updates).length > 0) {
      await db.update(usersTable).set(updates).where(eq(usersTable.id, existing.id));
    }
    user = { ...existing, ...updates };

    // Block suspended accounts
    if (user.accountStatus !== "active") {
      res.status(403).json({
        error: "ACCOUNT_SUSPENDED",
        accountStatus: user.accountStatus,
        message: "Your account has been suspended. Please contact support.",
      });
      return;
    }
  } else {
    // Case A: new user — create account automatically (Google-verified, no password needed)
    const [created] = await db
      .insert(usersTable)
      .values({
        email: safeEmail,
        name: safeName,
        passwordHash: "",          // no password for Google-only accounts
        role: "customer",
        isVerified: true,
        googleId,
        authProvider: "google",
        avatarUrl,
        otpRequestCount: 0,
        otpRequestWindowStart: new Date(),
      })
      .returning();
    user = created;

    // Notify admins (fire-and-forget)
    db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"))
      .then((admins) =>
        Promise.allSettled(admins.map((admin) =>
          createNotification({
            userId: admin.id,
            type: "new_user",
            title: bi("New User via Google", "مستخدم جديد عبر Google"),
            body: bi(`${safeName} joined via Google Sign-In.`, `انضم ${safeName} عبر تسجيل الدخول بـ Google.`),
            priority: "normal",
            link: "/admin/users",
          })
        ))
      ).catch(() => {});
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    email: user.email,
    isVerified: true,
  });

  await auditLog(user.id, "google_login", "google", ip, { googleId, isNew: !existing });

  res.json({ user: formatUser(user), token });
});

// ─── GET /auth/facebook-app-id ────────────────────────────────────────────────
// Returns the Facebook App ID for the frontend SDK initializer.
// The App ID is not secret — it is safe to expose publicly.
router.get("/auth/facebook-app-id", (_req, res): void => {
  // Feature flag: FACEBOOK_LOGIN_ENABLED must be explicitly "true" to activate
  if (process.env.FACEBOOK_LOGIN_ENABLED !== "true") {
    res.status(503).json({ error: "Facebook Sign-In is not enabled" });
    return;
  }
  const appId = process.env.FACEBOOK_APP_ID ?? "";
  if (!appId) {
    res.status(503).json({ error: "Facebook Sign-In is not configured" });
    return;
  }
  res.json({ appId });
});

// ─── POST /auth/facebook ──────────────────────────────────────────────────────
// Accepts a Facebook access token from the frontend (issued by the FB JS SDK).
// Verifies it server-side via the Graph API debug_token endpoint (requires app secret),
// fetches the user profile, then creates or links the user and issues a SYANO JWT.
router.post("/auth/facebook", async (req, res): Promise<void> => {
  const ip = getIp(req);

  const fbAppId = process.env.FACEBOOK_APP_ID ?? "";
  const fbAppSecret = process.env.FACEBOOK_APP_SECRET ?? "";
  if (!fbAppId || !fbAppSecret) {
    res.status(503).json({ error: "Facebook Sign-In is not configured on this server" });
    return;
  }

  const { accessToken, rememberMe } = req.body as { accessToken?: string; rememberMe?: boolean };
  if (!accessToken || typeof accessToken !== "string") {
    res.status(400).json({ error: "accessToken is required" });
    return;
  }

  // 1. Verify the access token with Facebook — ensures it belongs to our app and is valid
  let facebookId: string;
  try {
    const appToken = `${fbAppId}|${fbAppSecret}`;
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`
    );
    const debugData = await debugRes.json() as {
      data?: { is_valid?: boolean; app_id?: string; user_id?: string };
      error?: unknown;
    };
    if (!debugData.data?.is_valid || debugData.data?.app_id !== fbAppId) {
      console.error("[Facebook Auth] Token debug failed:", JSON.stringify(debugData));
      res.status(401).json({ error: "Invalid Facebook token. Please try again." });
      return;
    }
    facebookId = debugData.data.user_id ?? "";
    if (!facebookId) {
      res.status(401).json({ error: "Could not retrieve Facebook user ID." });
      return;
    }
  } catch (err) {
    console.error("[Facebook Auth] Token verification failed:", err);
    res.status(401).json({ error: "Facebook token verification failed. Please try again." });
    return;
  }

  // 2. Fetch user profile from Graph API
  let fbEmail: string | null = null;
  let fbName: string | null = null;
  let fbPicture: string | null = null;
  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/me?access_token=${encodeURIComponent(accessToken)}&fields=id,name,email,picture.type(large)`
    );
    const profile = await profileRes.json() as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
      error?: unknown;
    };
    if (profile.error) throw new Error(JSON.stringify(profile.error));
    fbEmail = profile.email ?? null;
    fbName = profile.name ?? null;
    fbPicture = profile.picture?.data?.url ?? null;
  } catch (err) {
    console.error("[Facebook Auth] Profile fetch failed:", err);
    res.status(502).json({ error: "Could not fetch Facebook profile. Please try again." });
    return;
  }

  const safeEmail = fbEmail ? fbEmail.toLowerCase().trim() : null;
  const safeName = (fbName ?? `fb_${facebookId}`).replace(/<[^>]*>/g, "").trim();

  // 3. Find existing user by facebookId OR email (prevents duplicates)
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(
      safeEmail
        ? or(eq(usersTable.facebookId, facebookId), eq(usersTable.email, safeEmail))
        : eq(usersTable.facebookId, facebookId)
    )
    .limit(1);

  let user: typeof usersTable.$inferSelect;

  if (existing) {
    // User exists — link Facebook and optionally backfill avatar
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (!existing.facebookId) updates.facebookId = facebookId;
    if (!existing.avatarUrl && fbPicture) updates.avatarUrl = fbPicture;
    if (Object.keys(updates).length > 0) {
      await db.update(usersTable).set(updates).where(eq(usersTable.id, existing.id));
    }
    user = { ...existing, ...updates };

    if (user.accountStatus !== "active") {
      res.status(403).json({
        error: "ACCOUNT_SUSPENDED",
        accountStatus: user.accountStatus,
        message: "Your account has been suspended. Please contact support.",
      });
      return;
    }
  } else {
    // New user — create account (Facebook-verified, no password needed)
    const [created] = await db
      .insert(usersTable)
      .values({
        email: safeEmail,
        name: safeName,
        passwordHash: "",
        role: "customer",
        isVerified: true,
        facebookId,
        authProvider: "facebook",
        avatarUrl: fbPicture,
        otpRequestCount: 0,
        otpRequestWindowStart: new Date(),
      })
      .returning();
    user = created;

    // Notify admins (fire-and-forget)
    db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"))
      .then((admins) =>
        Promise.allSettled(admins.map((admin) =>
          createNotification({
            userId: admin.id,
            type: "new_user",
            title: bi("New User via Facebook", "مستخدم جديد عبر Facebook"),
            body: bi(`${safeName} joined via Facebook Login.`, `انضم ${safeName} عبر تسجيل الدخول بـ Facebook.`),
            priority: "normal",
            link: "/admin/users",
          })
        ))
      ).catch(() => {});
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    email: user.email ?? "",
    isVerified: true,
  });

  await auditLog(user.id, "facebook_login", "facebook", ip, { facebookId, isNew: !existing });

  res.json({ user: formatUser(user), token });
});

export default router;
