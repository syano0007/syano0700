import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM = process.env.EMAIL_FROM ?? "noreply@syanomarket.online";

export async function sendWelcomeEmail(
  to: string,
  name: string,
  locale: "ar" | "en",
): Promise<void> {
  const isAr = locale === "ar";

  const subject = isAr ? "مرحباً بك في سيانو" : "Welcome to SYANO";

  const html = isAr
    ? `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e5e5;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#10b981;font-size:28px;margin:0;">سيانو</h1>
          <p style="color:#6b7280;font-size:13px;margin:4px 0 0;">سوق سوريا الرقمي</p>
        </div>
        <h2 style="color:#f9fafb;font-size:20px;">مرحباً بك يا ${name}! 👋</h2>
        <p style="color:#d1d5db;line-height:1.7;">
          يسعدنا انضمامك إلى <strong style="color:#10b981;">سيانو</strong>، السوق الرقمي الأول في سوريا.
          يمكنك الآن تصفّح آلاف المنتجات من متاجر موثوقة وإتمام مشترياتك بكل سهولة.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${process.env.SITE_URL ?? "https://syanomarket.online"}" style="background:#10b981;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:15px;">
            تسوّق الآن
          </a>
        </div>
        <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:32px;">
          تم إرسال هذه الرسالة إلى ${to} · لا تردّ على هذه الرسالة
        </p>
      </div>
    `
    : `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e5e5;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#10b981;font-size:28px;margin:0;">SYANO</h1>
          <p style="color:#6b7280;font-size:13px;margin:4px 0 0;">Syria's Digital Marketplace</p>
        </div>
        <h2 style="color:#f9fafb;font-size:20px;">Welcome, ${name}! 👋</h2>
        <p style="color:#d1d5db;line-height:1.7;">
          We're thrilled to have you on <strong style="color:#10b981;">SYANO</strong>, Syria's premier digital marketplace.
          Browse thousands of products from trusted stores and shop with ease.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${process.env.SITE_URL ?? "https://syanomarket.online"}" style="background:#10b981;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:15px;">
            Start Shopping
          </a>
        </div>
        <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:32px;">
          This email was sent to ${to} · Please do not reply to this email
        </p>
      </div>
    `;

  const resend = getResend();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping welcome email to ${to}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log(`[email] Welcome email sent to ${to}`);
  } catch (err) {
    console.error(`[email] Failed to send welcome email to ${to}:`, err);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  locale: "ar" | "en",
): Promise<void> {
  const isAr = locale === "ar";

  const subject = isAr ? "إعادة تعيين كلمة المرور" : "Reset your password";

  const html = isAr
    ? `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e5e5;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#10b981;font-size:28px;margin:0;">سيانو</h1>
          <p style="color:#6b7280;font-size:13px;margin:4px 0 0;">سوق سوريا الرقمي</p>
        </div>
        <h2 style="color:#f9fafb;font-size:20px;">إعادة تعيين كلمة المرور</h2>
        <p style="color:#d1d5db;line-height:1.7;">
          تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.
          انقر على الزر أدناه لإعادة تعيينها. الرابط صالح لمدة <strong>15 دقيقة</strong>.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetLink}" style="background:#10b981;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:15px;">
            إعادة تعيين كلمة المرور
          </a>
        </div>
        <p style="color:#9ca3af;font-size:13px;line-height:1.6;">
          إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة — حسابك بأمان تام.
        </p>
        <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:32px;">
          تم إرسال هذه الرسالة إلى ${to} · لا تردّ على هذه الرسالة
        </p>
      </div>
    `
    : `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e5e5;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#10b981;font-size:28px;margin:0;">SYANO</h1>
          <p style="color:#6b7280;font-size:13px;margin:4px 0 0;">Syria's Digital Marketplace</p>
        </div>
        <h2 style="color:#f9fafb;font-size:20px;">Reset Your Password</h2>
        <p style="color:#d1d5db;line-height:1.7;">
          We received a request to reset the password for your account.
          Click the button below to reset it. This link is valid for <strong>15 minutes</strong>.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetLink}" style="background:#10b981;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:15px;">
            Reset Password
          </a>
        </div>
        <p style="color:#9ca3af;font-size:13px;line-height:1.6;">
          If you didn't request a password reset, you can safely ignore this email — your account is secure.
        </p>
        <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:32px;">
          This email was sent to ${to} · Please do not reply to this email
        </p>
      </div>
    `;

  const resend = getResend();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping password reset email to ${to}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log(`[email] Password reset email sent to ${to}`);
  } catch (err) {
    console.error(`[email] Failed to send password reset email to ${to}:`, err);
  }
}
