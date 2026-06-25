const TURNSTILE_SECRET  = process.env.TURNSTILE_SECRET_KEY  ?? "";
const TURNSTILE_SITE    = process.env.TURNSTILE_SITE_KEY    ?? "";

export const TURNSTILE_ENABLED =
  process.env.TURNSTILE_ENABLED === "true" &&
  TURNSTILE_SECRET.length > 0 &&
  TURNSTILE_SITE.length > 0;

export const TURNSTILE_SITE_KEY = TURNSTILE_ENABLED ? TURNSTILE_SITE : null;

export async function verifyTurnstileToken(
  token: string | undefined,
  ip: string,
): Promise<{ success: boolean }> {
  if (!TURNSTILE_ENABLED) return { success: true };
  if (!token || token.length === 0) return { success: false };

  try {
    const body = new URLSearchParams({
      secret:   TURNSTILE_SECRET,
      response: token,
      remoteip: ip,
    });
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
    if (!res.ok) return { success: false };
    const data = await res.json() as { success: boolean };
    return { success: data.success };
  } catch {
    return { success: false };
  }
}
