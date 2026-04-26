import { Resend } from 'resend';

export async function getUncachableResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Resend credentials not configured. Set RESEND_API_KEY (and optionally RESEND_FROM_EMAIL).');
  }
  return {
    client: new Resend(apiKey),
    fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@alain-computers.com',
  };
}

export type OtpEmailKind = "login" | "reset";

export async function sendOTPEmail(
  to: string,
  otp: string,
  portalName: string,
  kind: OtpEmailKind = "login",
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();

  const intro =
    kind === "reset"
      ? `مرحباً، لقد طلبت <strong>إعادة تعيين كلمة المرور</strong> لحسابك في <strong>${portalName}</strong>.`
      : `مرحباً، لقد طلبت تسجيل الدخول إلى <strong>${portalName}</strong>.`;

  await client.emails.send({
    from: fromEmail,
    to: [to],
    subject: kind === "reset" ? `رمز إعادة تعيين كلمة المرور - ${portalName}` : `رمز التحقق - ${portalName}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #f9f9f9;">
        <div style="background: #fff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
          <h2 style="color: #1a1a1a; margin-top: 0;">العين لتجارة الحاسبات</h2>
          <p style="color: #444;">${intro}</p>
          <p style="color: #444;">رمز التحقق الخاص بك:</p>
          <div style="background: #f0f4ff; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 42px; font-weight: bold; letter-spacing: 10px; color: #2563eb;">${otp}</span>
          </div>
          <p style="color: #888; font-size: 13px;">هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط.</p>
          <p style="color: #888; font-size: 13px;">إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.</p>
        </div>
      </div>
    `,
  });
}
