import crypto from "crypto";
import bcrypt from "bcryptjs";

// ─── OTP helpers ────────────────────────────────────────────────────────────

export function generateOTP(): string {
  return String(crypto.randomInt(100000, 1000000)).padStart(6, "0");
}

export async function hashOTP(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function verifyOTP(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

export function otpExpiryDate(): Date {
  return new Date(Date.now() + 10 * 60 * 1000);
}

// ─── Dev-mode banner ─────────────────────────────────────────────────────────

function logDevOTP(to: string, code: string, channel: "EMAIL" | "SMS"): void {
  const line = "═".repeat(54);
  console.log(`
╔${line}╗
║       🔑  SYANO VERIFICATION [DEV MODE]            ║
║  Channel : ${channel.padEnd(44)}║
║  To      : ${to.slice(0, 44).padEnd(44)}║
║  Code    : ${code.padEnd(44)}║
║  Expires : 10 minutes                              ║
╚${line}╝`);
}

// ─── Email (Resend) ───────────────────────────────────────────────────────────

async function sendEmailReal(to: string, code: string, locale: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY!;
  const fromEmail = process.env.EMAIL_FROM ?? "noreply@syanomarket.online";
  const isAr = locale === "ar";

  const subject = isAr ? "رمز التحقق الخاص بك - سيانو" : "Your Syano Verification Code";

  const html = isAr
    ? `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <div style="text-align:center;margin-bottom:24px"><h1 style="color:#16a34a;font-size:28px;margin:0">سيانو</h1><p style="color:#6b7280;margin:4px 0 0">السوق الإلكتروني الأول في سوريا</p></div>
        <h2 style="color:#111827;font-size:20px">رمز التحقق الخاص بك</h2>
        <p style="color:#374151">أدخل الرمز أدناه للتحقق من حسابك:</p>
        <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
          <span style="font-size:40px;font-weight:bold;letter-spacing:10px;color:#16a34a">${code}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">• صالح لمدة 10 دقائق فقط<br>• لا تشارك هذا الرمز مع أي شخص<br>• إذا لم تطلب هذا الرمز، تجاهل هذا البريد</p>
      </div>`
    : `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <div style="text-align:center;margin-bottom:24px"><h1 style="color:#16a34a;font-size:28px;margin:0">Syano</h1><p style="color:#6b7280;margin:4px 0 0">Syria's First Online Marketplace</p></div>
        <h2 style="color:#111827;font-size:20px">Your Verification Code</h2>
        <p style="color:#374151">Enter the code below to verify your account:</p>
        <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
          <span style="font-size:40px;font-weight:bold;letter-spacing:10px;color:#16a34a">${code}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">• Valid for 10 minutes only<br>• Never share this code with anyone<br>• If you didn't request this, please ignore this email</p>
      </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error: ${text}`);
  }
  const data = await res.json() as { id?: string };
  console.log(`[OTP] Resend email sent — id: ${data.id ?? "unknown"} → ${to}`);
}

export async function sendEmailOTP(to: string, code: string, locale = "en"): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    await sendEmailReal(to, code, locale);
  } else {
    logDevOTP(to, code, "EMAIL");
  }
}

// ─── SMS (Twilio) ─────────────────────────────────────────────────────────────

async function sendSmsReal(to: string, code: string, locale: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const creds = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const message =
    locale === "ar"
      ? `رمز التحقق من سيانو: ${code}. صالح لمدة 10 دقائق.`
      : `Your Syano verification code: ${code}. Valid for 10 minutes.`;

  if (process.env.TWILIO_VERIFY_SERVICE_SID) {
    // Twilio Verify (preferred — handles its own OTP generation)
    const url = `https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, Channel: "sms" }),
    });
    if (!res.ok) throw new Error(`Twilio Verify error: ${await res.text()}`);
  } else {
    // Twilio Messages API fallback
    const fromPhone = process.env.TWILIO_FROM_PHONE!;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: fromPhone, Body: message }),
    });
    if (!res.ok) throw new Error(`Twilio SMS error: ${await res.text()}`);
  }
}

export async function sendSmsOTP(to: string, code: string, locale = "en"): Promise<void> {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    await sendSmsReal(to, code, locale);
  } else {
    logDevOTP(to, code, "SMS");
  }
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────

export async function sendVerificationCode(
  identifier: string,
  code: string,
  locale = "en"
): Promise<"email" | "phone"> {
  if (identifier.includes("@")) {
    await sendEmailOTP(identifier, code, locale);
    return "email";
  } else {
    await sendSmsOTP(identifier, code, locale);
    return "phone";
  }
}
