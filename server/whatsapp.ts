import axios from 'axios';
import { storage } from './storage';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function formatPhoneNumber(phone: string): string {
  // Keep digits only to support messy user inputs like "+964 (0) 78x-xxx-xxxx"
  let cleaned = (phone || '').replace(/\D/g, '');

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
    return { success: false, error: errorMessage };
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

  const components: any[] = [];
  if (params.length > 0) {
    components.push({
      type: 'body',
      parameters: params.map(p => ({ type: 'text', text: p }))
    });
  }

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
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
          ...(components.length > 0 && { components })
        }
      }
    });

    console.log(`WhatsApp template "${templateName}" sent to ${formattedPhone}:`, response.data);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error: any) {
    const errorDetail = error.response?.data?.error;
    const errorMessage = errorDetail?.message || error.message;
    // Template not yet approved is a known transient state — log clearly
    if (errorDetail?.code === 132001 || errorMessage?.includes('not approved') || errorMessage?.includes('pending')) {
      console.warn(`WhatsApp template "${templateName}" is not yet approved. Message not sent to ${formattedPhone}.`);
    } else {
      console.error(`WhatsApp template "${templateName}" error for ${formattedPhone}:`, JSON.stringify(errorDetail || error.message));
    }
    return { success: false, error: errorMessage };
  }
}

export async function sendTicketCreatedMessage(
  customerPhone: string,
  customerName: string,
  ticketNumber: string,
  deviceType: string,
  deviceBrand: string
): Promise<WhatsAppMessageResult> {
  // Try the repair_ticket_created template first; fall back to free-form text
  const templateResult = await sendWhatsAppTemplate(
    customerPhone,
    'repair_ticket_created',
    'ar',
    [customerName, ticketNumber, `${deviceBrand} - ${deviceType}`]
  );

  if (templateResult.success) return templateResult;

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
  const extraText = extras.length > 0 ? extras.join('\n') : '-';

  // Use the repair_status_update template (approved template — works for any number)
  const templateResult = await sendWhatsAppTemplate(
    customerPhone,
    'repair_status_update',
    'ar',
    [customerName, ticketNumber, statusAr, extraText]
  );

  if (templateResult.success) return templateResult;

  // Fallback: free-form text (only works within 24h window)
  console.warn(`Template send failed for ticket ${ticketNumber}, falling back to free-form text. Reason: ${templateResult.error}`);
  const message =
    `مرحباً ${customerName}!\n\nتحديث على طلب الإصلاح:\n\nرقم التذكرة: ${ticketNumber}\nالحالة: ${statusAr}` +
    (extras.length ? '\n' + extras.join('\n') : '') +
    `\n\nالعين لتجارة الحاسبات - 07850006977`;

  return sendWhatsAppMessage(customerPhone, message);
}
