import axios from 'axios';
import { storage } from './storage';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  /** Meta initial status: usually "accepted" (not yet on the phone). */
  messageStatus?: string;
  waId?: string;
  error?: string;
  errorCode?: number | string;
  errorData?: any;
  /** How the message was sent (for diagnostics). */
  deliveryMethod?: 'daily_template' | 'repair_status_template' | 'template' | 'free_text';
  /** Shown when delivery may fail (e.g. free-text outside 24h window). */
  deliveryWarning?: string;
  formattedTo?: string;
  templateName?: string;
  templateLanguage?: string;
}

export type WhatsAppDeliveryEvent = {
  at: string;
  messageId?: string;
  status: string;
  recipientId?: string;
  errors?: unknown;
};

/** Last delivery receipts from Meta webhook (failed/delivered/read). */
export const whatsappDeliveryEvents: WhatsAppDeliveryEvent[] = [];

export function recordWhatsAppDeliveryEvent(event: Omit<WhatsAppDeliveryEvent, 'at'>) {
  whatsappDeliveryEvents.unshift({ ...event, at: new Date().toISOString() });
  if (whatsappDeliveryEvents.length > 150) {
    whatsappDeliveryEvents.length = 150;
  }
  if (event.status === 'failed') {
    console.error('WhatsApp delivery FAILED:', JSON.stringify(event));
  }
}

function parseMetaSendResponse(data: any): Pick<WhatsAppMessageResult, 'messageId' | 'messageStatus' | 'waId'> {
  const msg = data?.messages?.[0];
  const contact = data?.contacts?.[0];
  return {
    messageId: msg?.id,
    messageStatus: msg?.message_status,
    waId: contact?.wa_id,
  };
}

/** Exported for API diagnostics (E.164 without +). */
export function formatPhoneNumber(phone: string): string {
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

export async function getCredentials(): Promise<{
  phoneNumberId: string;
  accessToken: string;
  wabaId: string;
  source: 'database' | 'environment' | 'mixed' | 'none';
}> {
  try {
    const dbSettings = await storage.getStoreSettings();
    const dbPhone = dbSettings?.whatsappPhoneNumberId?.trim() || '';
    const dbToken = dbSettings?.whatsappAccessToken?.trim() || '';
    const dbWaba = dbSettings?.whatsappWabaId?.trim() || '';
    const envPhone = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
    const envToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
    const envWaba = (process.env.WHATSAPP_WABA_ID || '').trim();

    const phoneNumberId = dbPhone || envPhone;
    const accessToken = dbToken || envToken;
    const wabaId = dbWaba || envWaba;

    const usesDb = !!(dbPhone || dbToken || dbWaba);
    const usesEnv = !!(envPhone || envToken || envWaba);
    let source: 'database' | 'environment' | 'mixed' | 'none' = 'none';
    if (usesDb && usesEnv) source = 'mixed';
    else if (usesDb) source = 'database';
    else if (usesEnv) source = 'environment';

    return { phoneNumberId, accessToken, wabaId, source };
  } catch {
    const envPhone = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
    const envToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
    const envWaba = (process.env.WHATSAPP_WABA_ID || '').trim();
    return {
      phoneNumberId: envPhone,
      accessToken: envToken,
      wabaId: envWaba,
      source: envPhone || envToken || envWaba ? 'environment' : 'none',
    };
  }
}

let wabaTemplatesCache: { at: number; items: Array<{ name: string; status: string; language: string; components?: any[] }> } | null = null;

async function fetchWabaMessageTemplates() {
  const now = Date.now();
  if (wabaTemplatesCache && now - wabaTemplatesCache.at < 5 * 60 * 1000) {
    return wabaTemplatesCache.items;
  }
  const { wabaId, accessToken } = await getCredentials();
  if (!wabaId || !accessToken) return [];
  try {
    const response = await axios.get(`${WHATSAPP_API_URL}/${wabaId}/message_templates`, {
      params: {
        fields: 'name,status,language,components',
        limit: 250,
        access_token: accessToken,
      },
    });
    const items = (response.data?.data || []) as Array<{ name: string; status: string; language: string; components?: any[] }>;
    wabaTemplatesCache = { at: now, items };
    return items;
  } catch (error: any) {
    const err = error.response?.data?.error;
    console.error('Failed to fetch WABA templates:', JSON.stringify(err || error.message));
    return [];
  }
}

async function approvedLanguagesForTemplate(templateName: string): Promise<string[]> {
  const items = await fetchWabaMessageTemplates();
  return items
    .filter((t) => t.name === templateName && String(t.status).toUpperCase() === 'APPROVED')
    .map((t) => t.language)
    .filter(Boolean);
}

function countBodyPlaceholders(components?: any[]): number {
  const body = components?.find((c) => String(c.type).toUpperCase() === 'BODY');
  const text = String(body?.text || '');
  const matches = text.match(/\{\{\d+\}\}/g);
  return matches?.length ?? 0;
}

export function isValidIraqWhatsAppE164(formatted: string): boolean {
  return /^9647\d{9}$/.test(formatted);
}

export function validateWhatsAppPhone(phone: string): { ok: boolean; formatted: string; error?: string } {
  const formatted = formatPhoneNumber(phone);
  if (!formatted) {
    return { ok: false, formatted: '', error: 'رقم الهاتف فارغ' };
  }
  if (!isValidIraqWhatsAppE164(formatted)) {
    return {
      ok: false,
      formatted,
      error: `رقم غير صالح للواتساب العراقي (${formatted}). استخدم 07XXXXXXXXX.`,
    };
  }
  return { ok: true, formatted };
}

export async function getWhatsAppDiagnostics() {
  const creds = await getCredentials();
  const configured = !!(creds.phoneNumberId && creds.accessToken);

  const result: Record<string, unknown> = {
    configured,
    credentialSource: creds.source,
    phoneNumberId: creds.phoneNumberId ? `…${creds.phoneNumberId.slice(-6)}` : null,
    wabaId: creds.wabaId ? `…${creds.wabaId.slice(-6)}` : null,
    hasAccessToken: !!creds.accessToken,
    apiVersion: WHATSAPP_API_URL.replace('https://graph.facebook.com/', ''),
    webhookHint:
      'In Meta Developer → WhatsApp → Configuration, subscribe webhook to messages field and set callback URL to https://YOUR_DOMAIN/api/whatsapp/webhook',
    recentDeliveryEvents: whatsappDeliveryEvents.slice(0, 25),
  };

  if (!configured) {
    result.error = 'WhatsApp credentials missing. Set Phone Number ID + Access Token in Admin Settings or .env on VPS.';
    return result;
  }

  try {
    const me = await axios.get(`${WHATSAPP_API_URL}/me`, {
      params: { access_token: creds.accessToken },
    });
    result.tokenValid = true;
    result.metaApp = me.data;
  } catch (error: any) {
    result.tokenValid = false;
    result.tokenError = error.response?.data?.error || error.message;
  }

  try {
    const phone = await axios.get(`${WHATSAPP_API_URL}/${creds.phoneNumberId}`, {
      params: {
        fields: 'display_phone_number,verified_name,quality_rating,account_mode',
        access_token: creds.accessToken,
      },
    });
    result.phoneNumber = phone.data;
  } catch (error: any) {
    result.phoneNumberError = error.response?.data?.error || error.message;
  }

  const templates = await fetchWabaMessageTemplates();
  const repairNames = getTemplateCandidates('WHATSAPP_REPAIR_STATUS_TEMPLATES', 'repair_status_update');
  const createdNames = getTemplateCandidates('WHATSAPP_REPAIR_CREATED_TEMPLATES', 'repair_ticket_created');

  result.approvedTemplateCount = templates.filter((t) => String(t.status).toUpperCase() === 'APPROVED').length;
  result.repairStatusTemplates = repairNames.map((name) => ({
    name,
    approved: templates.filter((t) => t.name === name && String(t.status).toUpperCase() === 'APPROVED'),
  }));
  result.repairCreatedTemplates = createdNames.map((name) => ({
    name,
    approved: templates.filter((t) => t.name === name && String(t.status).toUpperCase() === 'APPROVED'),
  }));

  const hasApprovedStatus = (result.repairStatusTemplates as any[]).some((t) => t.approved?.length > 0);
  if (!hasApprovedStatus) {
    result.critical =
      'No APPROVED repair_status_update template found on this WABA. Repair WhatsApp cannot deliver until Meta approves the template.';
  }

  return result;
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
    return { success: true, ...parseMetaSendResponse(response.data), deliveryMethod: 'free_text' };
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
      return {
        success: true,
        ...parseMetaSendResponse(response.data),
        deliveryMethod: 'template',
        templateName,
        formattedTo: formattedPhone,
      };
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
  const approvedLangs = await approvedLanguagesForTemplate(templateName);
  const tryLanguages = Array.from(
    new Set(
      [preferredLanguage, ...approvedLangs, 'ar', 'ar_IQ', 'en', 'en_US']
        .map((v) => (v || '').trim())
        .filter(Boolean),
    ),
  );

  const templates = await fetchWabaMessageTemplates();
  const templateDefs = templates.filter((t) => t.name === templateName);
  const paramVariants: string[][] = [params];
  if (templateDefs.length > 0) {
    const counts = new Set(templateDefs.map((t) => countBodyPlaceholders(t.components)));
    for (const count of counts) {
      if (count < params.length) paramVariants.push(params.slice(0, count));
      if (count === 0) paramVariants.push([]);
    }
  }

  let lastError: WhatsAppMessageResult = { success: false, error: 'Template send failed' };
  for (const lang of tryLanguages) {
    for (const variant of paramVariants) {
      const result = await sendWhatsAppTemplate(to, templateName, lang, variant);
      if (result.success) {
        return { ...result, templateLanguage: lang };
      }
      lastError = result;
      const errText = `${result.error || ''}`.toLowerCase();
      const isParamMismatch =
        result.errorCode === 132000 ||
        (errText.includes('parameter') && errText.includes('match'));
      if (!isParamMismatch) break;
    }
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
  const phoneCheck = validateWhatsAppPhone(customerPhone);
  if (!phoneCheck.ok) {
    return { success: false, error: phoneCheck.error, formattedTo: phoneCheck.formatted };
  }

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

export type TicketUpdatedMessageOptions = {
  /** When true, do not fall back to free-text (won't deliver outside 24h window). */
  skipFreeTextFallback?: boolean;
};

export async function sendTicketUpdatedMessage(
  customerPhone: string,
  customerName: string,
  ticketNumber: string,
  status: string,
  technicianNotes?: string | null,
  costEstimate?: string | null,
  finalCost?: string | null,
  options?: TicketUpdatedMessageOptions,
): Promise<WhatsAppMessageResult> {
  const phoneCheck = validateWhatsAppPhone(customerPhone);
  if (!phoneCheck.ok) {
    return { success: false, error: phoneCheck.error, formattedTo: phoneCheck.formatted };
  }

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
      if (templateResult.success) {
        return { ...templateResult, deliveryMethod: 'template' };
      }
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
    if (retryResult.success) {
      return { ...retryResult, deliveryMethod: 'template' };
    }
  }

  if (options?.skipFreeTextFallback) {
    return {
      ...retryResult,
      success: false,
      error:
        retryResult.error ||
        'فشل إرسال قالب واتساب. جرّب «اختبار واتساب» لنفس الرقم في الإعدادات (إشعار الصيانة).',
      deliveryMethod: undefined,
    };
  }

  // Last resort fallback (may fail outside 24h window). Keep it, but make the failure visible via logs/result.
  console.warn(
    `WhatsApp template retry failed for ticket ${ticketNumber} (code=${retryResult.errorCode ?? 'n/a'}). Falling back to free-form text.`
  );
  const message =
    `مرحباً ${sanitizeTemplateParam(customerName, 80)}!\n\nتحديث على طلب الإصلاح:\n\nرقم التذكرة: ${sanitizeTemplateParam(ticketNumber, 40)}\nالحالة: ${sanitizeTemplateParam(statusAr, 60)}` +
    (extras.length ? '\n' + sanitizeTemplateParam(extras.join('\n'), 700) : '') +
    `\n\nالعين لتجارة الحاسبات - 07850006977`;

  const textResult = await sendWhatsAppMessage(customerPhone, message);
  return { ...textResult, deliveryMethod: 'free_text' };
}

/**
 * Daily revenue summary — uses the same repair_status_update pipeline as customer repair alerts.
 */
export async function sendDailyRevenueWhatsApp(
  to: string,
  messageBody: string,
  templateParams?: { date: string; loc1: string; loc2: string; repair: string; total: string },
): Promise<WhatsAppMessageResult> {
  const formattedTo = formatPhoneNumber(to);

  if (!isValidIraqWhatsAppE164(formattedTo)) {
    return {
      success: false,
      formattedTo,
      error: `رقم واتساب غير صالح (${formattedTo}). استخدم صيغة عراقية مثل 07801234567.`,
    };
  }

  if (!templateParams) {
    return { success: false, formattedTo, error: 'بيانات التقرير ناقصة' };
  }

  const dedicatedTemplate = (process.env.WHATSAPP_DAILY_REVENUE_TEMPLATE || '').trim();

  if (dedicatedTemplate) {
    const templateResult = await sendWhatsAppTemplateWithLanguageFallbacks(
      to,
      dedicatedTemplate,
      'ar',
      [
        templateParams.date,
        templateParams.loc1,
        templateParams.loc2,
        templateParams.repair,
        templateParams.total,
      ],
    );
    if (templateResult.success) {
      return {
        ...templateResult,
        deliveryMethod: 'daily_template',
        formattedTo,
      };
    }
    console.warn(
      `Daily revenue template "${dedicatedTemplate}" failed (code=${templateResult.errorCode ?? 'n/a'}): ${templateResult.error}. Using repair_status_update.`,
    );
  }

  const revenueNotes = sanitizeTemplateParam(
    `م1: ${templateParams.loc1} | م2: ${templateParams.loc2} | صيانة: ${templateParams.repair} | مجموع: ${templateParams.total}`,
    900,
  );

  const repairPipeline = await sendTicketUpdatedMessage(
    to,
    'تقرير إيرادات',
    templateParams.date,
    'إيرادات اليوم',
    revenueNotes,
    null,
    null,
    { skipFreeTextFallback: true },
  );

  if (repairPipeline.success) {
    return {
      ...repairPipeline,
      deliveryMethod: 'repair_status_template',
      formattedTo,
    };
  }

  console.error(
    `Daily revenue WhatsApp failed for ${formattedTo} (code=${repairPipeline.errorCode ?? 'n/a'}): ${repairPipeline.error}`,
  );

  return {
    ...repairPipeline,
    success: false,
    formattedTo,
    error:
      repairPipeline.error ||
      'فشل إرسال واتساب. من الإعدادات جرّب «اختبار واتساب» لنفس الرقم — إن نجح الاختبار ولم يصل التقرير، راجع سجلات pm2.',
    messagePreview: messageBody,
  };
}
