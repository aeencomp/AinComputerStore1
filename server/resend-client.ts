import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        Accept: 'application/json',
        'X-Replit-Token': xReplitToken,
      },
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings?.api_key) {
    throw new Error('Resend not connected');
  }

  return {
    apiKey: connectionSettings.settings.api_key as string,
    fromEmail: (connectionSettings.settings.from_email as string) || 'noreply@alain-computers.com',
  };
}

export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

export async function sendOTPEmail(to: string, otp: string, portalName: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();

  await client.emails.send({
    from: fromEmail,
    to: [to],
    subject: `رمز التحقق - ${portalName}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #f9f9f9;">
        <div style="background: #fff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
          <h2 style="color: #1a1a1a; margin-top: 0;">العين لتجارة الحاسبات</h2>
          <p style="color: #444;">مرحباً، لقد طلبت تسجيل الدخول إلى <strong>${portalName}</strong>.</p>
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
