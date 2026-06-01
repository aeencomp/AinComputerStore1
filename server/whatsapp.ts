import axios from 'axios';
import { storage } from './storage';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: number | string;
  errorData?: any;
}

function formatPhoneNumber(phone: string): string {
  // Normalize Arabic-Indic digits then keep digits only.
  // This supports inputs like "٠٧٨..." which JS \d does not treat as [0-9].
  const toLatinDigits = (s: string) =>
    (s || '')
      // Arabic-Indic: ٠١٢٣٤٥٦٧٨٩
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      // Eastern Arabic-Indic: ۰۱۲۳۴۵۶۷۸۹
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

  // Keep digits only to support messy user inputs like "+964 (0) 78x-xxx-xxxx"
  let cleaned = toLatinDigits(phone).replace(/\D/g, '');

  // International prefix variants
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);

  // Iraqi local mobile formats:
  // 07XXXXXXXXX  -> 9647XXXXXXXXX
  // 7XXXXXXXXX   -> 9647XXXXXXXXX
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    cleaned = `964${cleaned.substring(1)}`;
  } else if (cleaned.startsWith('7') && cleaned.length === 10) {
    cleaned = `964${cleaned}`;
  }

  // If user entered 9640XXXXXXXXXX, drop the optional trunk "0" after country code
  if (cleaned.startsWith('9640')) {
    cleaned = `964${cleaned.substring(4)}`;
  }

  return cleaned;
}

function sanitizeTemplateParam(value: string, maxLen = 900): string {
  // WhatsApp template params cannot contain newlines/tabs and cannot have >4 consecutive spaces.
  // See error code 132018.
  const v = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {5,}/g, '    ')
    .trim();

  if (!v) return '-';
  if (v.length <= maxLen) return v;
  return `${v.slice(0, Math.max(0, maxLen - 1))}…`;
}

function getTemplateCandidates(
  envKey: string,
  fallback: string,
): string[] {
  const raw = (process.env[envKey] || '').trim();
  const fromEnv = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const all = [...fromEnv, fallback];
  return Array.from(new Set(all));
}

async function getCredentials(): Promise<{ phoneNumberId: string; accessToken: string; wabaId: string }> {
  try {
    const dbSettings = await storage.getStoreSettings();
    const phoneNumberId = (dbSettings?.whatsappPhoneNumberId && dbSettings.whatsappPhoneNumberId.trim())
      ? dbSettings.whatsappPhoneNumberId.trim()
      : (process.env.WHATSAPP_PHONE_NUMBER_ID || '');
    const accessToken = (dbSettings?.whatsappAccessToken && dbSettings.whatsappAccessToken.trim())
      ? dbSettings.whatsappAccessToken.trim()
      : (process.env.WHATSAPP_ACCESS_TOKEN || '');
    const wabaId = (dbSettings?.whatsappWabaId && dbSettings.whatsappWabaId.trim())
      ? dbSettings.whatsappWabaId.trim()
      : (process.env.WHATSAPP_WABA_ID || '');
    return { phoneNumberId, accessToken, wabaId };
  } catch {
    return {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      wabaId: process.env.WHATSAPP_WABA_ID || '',
    };
  }
}

// Send a free-form text message (only works within 24h after customer messages first)
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppMessageResult> {
  const { phoneNumberId, accessToken } = await getCredentials();

  if (!phoneNumberId || !accessToken) {
    console.log('WhatsApp credentials not configured, skipping message');
    return { success: false, error: 'WhatsApp not configured' };
  }

  const formattedPhone = formatPhoneNumber(to);

  try {
    const response = await axios({
      method: 'POST',
      url: `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: message }
      }
    });

    console.log('WhatsApp text message sent:', response.data);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error: any) {
    const errData = error.response?.data?.error;
    const errorMessage = errData?.message || error.message;
    console.error('WhatsApp text send error:', JSON.stringify(errData || error.message));
    return { success: false, error: errorMessage, errorCode: errData?.code, errorData: errData };
  }
}

// Send a pre-approved template message (works for any phone number, no 24h restriction)
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  language: string,
  params: string[]
): Promise<WhatsAppMessageResult> {
  const { phoneNumberId, accessToken } = await getCredentials();

  if (!phoneNumberId || !accessToken) {
    console.log('WhatsApp credentials not configured, skipping template');
    return { success: false, error: 'WhatsApp not configured' };
  }

  const formattedPhone = formatPhoneNumber(to);

  const sanitizedParams = params.map((p) => sanitizeTemplateParam(p));

  const buildPayload = (components: any[]) => ({
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      ...(components.length > 0 && { components }),
    },
  });

  const componentVariants: any[][] = [];
  if (sanitizedParams.length > 0) {
    // Variant A: all params in body (existing behavior)
    componentVariants.push([
      {
        type: 'body',
        parameters: sanitizedParams.map((p) => ({ type: 'text', text: p })),
      },
    ]);

    // Variant B: first param in header, rest in body.
    // This matches templates like: Header {{1}} + Body {{2}} {{3}}
    if (sanitizedParams.length >= 2) {
      const bodyRest = sanitizedParams.slice(1);
      componentVariants.push([
        { type: 'header', parameters: [{ type: 'text', text: sanitizedParams[0] }] },
        ...(bodyRest.length > 0
          ? [{ type: 'body', parameters: bodyRest.map((p) => ({ type: 'text', text: p })) }]
          : []),
      ]);
    }
  } else {
    componentVariants.push([]);
  }

  let lastError: WhatsAppMessageResult = { success: false, error: 'Template send failed' };

  for (const components of componentVariants) {
    try {
      const response = await axios({
        method: 'POST',
        url: `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: buildPayload(components),
      });

      console.log(`WhatsApp template "${templateName}" sent to ${formattedPhone}:`, response.data);
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error: any) {
      const errorDetail = error.response?.data?.error;
      const errorMessage = errorDetail?.message || error.message;
      lastError = { success: false, error: errorMessage, errorCode: errorDetail?.code, errorData: errorDetail };

      // Keep trying variants only for parameter-shape problems
      const errText = `${errorMessage || ''}`.toLowerCase();
      const isParamMismatch =
        errorDetail?.code === 132000 ||
        (errText.includes('parameter') && errText.includes('match'));
      if (!isParamMismatch) {
        if (errorDetail?.code === 132001 || errorMessage?.includes('not approved') || errorMessage?.includes('pending')) {
          console.warn(`WhatsApp template "${templateName}" is not yet approved. Message not sent to ${formattedPhone}.`);
        } else {
          console.error(`WhatsApp template "${templateName}" error for ${formattedPhone}:`, JSON.stringify(errorDetail || error.message));
        }
        return lastError;
      }
    }
  }

  console.error(`WhatsApp template "${templateName}" param-shape mismatch for ${formattedPhone}:`, JSON.stringify(lastError.errorData || lastError.error));
  return lastError;
}

async function sendWhatsAppTemplateWithLanguageFallbacks(
  to: string,
  templateName: string,
  preferredLanguage: string,
  params: string[],
): Promise<WhatsAppMessageResult> {
  const tryLanguages = Array.from(
    new Set(
      [preferredLanguage, 'ar', 'ar_IQ', 'en_US']
        .map((v) => (v || '').trim())
        .filter(Boolean),
    ),
  );

  let lastError: WhatsAppMessageResult = { success: false, error: 'Template send failed' };
  for (const lang of tryLanguages) {
    const result = await sendWhatsAppTemplate(to, templateName, lang, params);
    if (result.success) return result;
    lastError = result;
  }

  return lastError;
}

export async function sendTicketCreatedMessage(
  customerPhone: string,
  customerName: string,
  ticketNumber: string,
  deviceType: string,
  deviceBrand: string
): Promise<WhatsAppMessageResult> {
  const templateCandidates = getTemplateCandidates(
    'WHATSAPP_REPAIR_CREATED_TEMPLATES',
    'repair_ticket_created',
  );

  // Try multiple param variants because approved template placeholder count may differ.
  const createdParamVariants: string[][] = [
    [customerName, ticketNumber, `${deviceBrand} - ${deviceType}`],
    [customerName, ticketNumber],
    [ticketNumber, `${deviceBrand} - ${deviceType}`],
    [ticketNumber],
    [],
  ];
  let templateResult: WhatsAppMessageResult = { success: false, error: 'Template send failed' };
  for (const templateName of templateCandidates) {
    for (const params of createdParamVariants) {
      templateResult = await sendWhatsAppTemplateWithLanguageFallbacks(
        customerPhone,
        templateName,
        'ar',
        params
      );
      if (templateResult.success) return templateResult;
      const errText = `${templateResult.error || ''}`.toLowerCase();
      // Keep trying param variants only when error hints parameter mismatch.
      if (!errText.includes('parameter') || !errText.includes('match')) break;
    }
  }

  // Fallback: free-form text (works if customer messaged within last 24h)
  const message =
    `مرحباً ${customerName}!\n\nتم استلام طلب إصلاح جهازك بنجاح.\n\nرقم التذكرة: ${ticketNumber}\nالجهاز: ${deviceBrand} - ${deviceType}\n\nسيتم التواصل معك قريباً.\n\nالعين لتجارة الحاسبات - 07850006977`;

  return sendWhatsAppMessage(customerPhone, message);
}

export async function sendTicketUpdatedMessage(
  customerPhone: string,
  customerName: string,
  ticketNumber: string,
  status: string,
  technicianNotes?: string | null,
  costEstimate?: string | null,
  finalCost?: string | null
): Promise<WhatsAppMessageResult> {
  const templateCandidates = getTemplateCandidates(
    'WHATSAPP_REPAIR_STATUS_TEMPLATES',
    'repair_status_update',
  );
  const statusLabels: Record<string, string> = {
    'pending':         'قيد الانتظار',
    'in-progress':     'جاري العمل عليه',
    'waiting-parts':   'بانتظار قطع الغيار',
    'completed':       'تم الإصلاح - جاهز للاستلام',
    'delivered':       'تم التسليم',
    'rejected':        'تم رفض الصيانة',
    'unrepairable':    'الجهاز لا يصلح للإصلاح',
  };

  const statusAr = statusLabels[status] || status;

  // Build the 4th parameter: extra details line
  const extras: string[] = [];
  if (costEstimate)   extras.push(`التكلفة المقدرة: ${costEstimate} د.ع`);
  if (finalCost)      extras.push(`التكلفة النهائية: ${finalCost} د.ع`);
  if (technicianNotes) extras.push(`ملاحظات: ${technicianNotes}`);
  const extraText = sanitizeTemplateParam(extras.length > 0 ? extras.join(' | ') : '-');

  // Use the repair_status_update template (approved template — works for any number)
  const primaryParams = [
    sanitizeTemplateParam(customerName, 80),
    sanitizeTemplateParam(ticketNumber, 40),
    sanitizeTemplateParam(statusAr, 60),
    extraText,
  ];

  const statusParamVariants: string[][] = [
    primaryParams, // 4 params
    [primaryParams[0], primaryParams[1], primaryParams[2]], // 3 params
    [primaryParams[1], primaryParams[2]], // 2 params
    [primaryParams[1]], // 1 param (ticket only)
    [], // 0 params (for templates with static body)
  ];

  let templateResult: WhatsAppMessageResult = { success: false, error: 'Template send failed' };
  for (const templateName of templateCandidates) {
    for (const params of statusParamVariants) {
      templateResult = await sendWhatsAppTemplateWithLanguageFallbacks(
        customerPhone,
        templateName,
        'ar',
        params
      );
      if (templateResult.success) return templateResult;
      const errText = `${templateResult.error || ''}`.toLowerCase();
      if (!errText.includes('parameter') || !errText.includes('match')) break;
    }
  }

  // Retry with minimal "extra" parameter. Some payloads fail due to overly long notes, newlines, etc.
  console.warn(
    `WhatsApp template send failed for ticket ${ticketNumber} (code=${templateResult.errorCode ?? 'n/a'}). Retrying with minimal params.`
  );
  let retryResult: WhatsAppMessageResult = { success: false, error: 'Template retry failed' };
  for (const templateName of templateCandidates) {
    retryResult = await sendWhatsAppTemplateWithLanguageFallbacks(
      customerPhone,
      templateName,
      'ar',
      [primaryParams[0], primaryParams[1], primaryParams[2], '-']
    );
    if (retryResult.success) return retryResult;
  }

  // Last resort fallback (may fail outside 24h window). Keep it, but make the failure visible via logs/result.
  console.warn(
    `WhatsApp template retry failed for ticket ${ticketNumber} (code=${retryResult.errorCode ?? 'n/a'}). Falling back to free-form text.`
  );
  const message =
    `مرحباً ${sanitizeTemplateParam(customerName, 80)}!\n\nتحديث على طلب الإصلاح:\n\nرقم التذكرة: ${sanitizeTemplateParam(ticketNumber, 40)}\nالحالة: ${sanitizeTemplateParam(statusAr, 60)}` +
    (extras.length ? '\n' + sanitizeTemplateParam(extras.join('\n'), 700) : '') +
    `\n\nالعين لتجارة الحاسبات - 07850006977`;

  return sendWhatsAppMessage(customerPhone, message);
}

/** Daily revenue summary to owner/manager (Location 1, 2, repair). */
export async function sendDailyRevenueWhatsApp(
  to: string,
  messageBody: string,
  templateParams?: { date: string; loc1: string; loc2: string; repair: string; total: string },
): Promise<WhatsAppMessageResult> {
  const templateName = (process.env.WHATSAPP_DAILY_REVENUE_TEMPLATE || "").trim();

  if (templateName && templateParams) {
    const templateResult = await sendWhatsAppTemplateWithLanguageFallbacks(
      to,
      templateName,
      "ar",
      [
        templateParams.date,
        templateParams.loc1,
        templateParams.loc2,
        templateParams.repair,
        templateParams.total,
      ],
    );
    if (templateResult.success) return templateResult;
    console.warn(
      `Daily revenue WhatsApp template failed (code=${templateResult.errorCode ?? "n/a"}): ${templateResult.error}. Trying text message.`,
    );
  }

  return sendWhatsAppMessage(to, messageBody);
}
