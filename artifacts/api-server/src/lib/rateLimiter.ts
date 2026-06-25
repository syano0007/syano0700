// In-memory per-IP rate limiter for auth endpoints.
// Per-user OTP rate limiting is handled in the DB (otpRequestCount + otpRequestWindowStart).

interface Entry {
  count: number;
  windowStart: number;
}

// ── Generic sliding-window checker ────────────────────────────────────────────

function checkLimit(
  store: Map<string, Entry>,
  key: string,
  windowMs: number,
  max: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

// ── OTP / send-code: 5 per hour per IP ────────────────────────────────────────
const otpStore = new Map<string, Entry>();
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX = 5;

export function checkIpRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  return checkLimit(otpStore, ip, OTP_WINDOW_MS, OTP_MAX);
}

// ── Login: 10 attempts per 15 minutes per IP (50 in dev for automated testing) ─
const loginStore = new Map<string, Entry>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = process.env.NODE_ENV === "production" ? 10 : 50;

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  return checkLimit(loginStore, ip, LOGIN_WINDOW_MS, LOGIN_MAX);
}

// ── Register: 5 registrations per hour per IP ─────────────────────────────────
const registerStore = new Map<string, Entry>();
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX = 5;

export function checkRegisterRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  return checkLimit(registerStore, ip, REGISTER_WINDOW_MS, REGISTER_MAX);
}

// ── Prune stale entries every 30 minutes to prevent unbounded Map growth ───────
setInterval(() => {
  const now = Date.now();
  for (const [store, windowMs] of [
    [otpStore, OTP_WINDOW_MS],
    [loginStore, LOGIN_WINDOW_MS],
    [registerStore, REGISTER_WINDOW_MS],
  ] as [Map<string, Entry>, number][]) {
    for (const [key, entry] of store) {
      if (now - entry.windowStart > windowMs) store.delete(key);
    }
  }
}, 30 * 60 * 1000).unref();
