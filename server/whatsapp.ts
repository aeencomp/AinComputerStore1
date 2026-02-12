import axios from 'axios';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\+]/g, '');
  
  if (cleaned.startsWith('07')) {
    cleaned = '964' + cleaned.substring(1);
  }
  
  return cleaned;
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppMessageResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

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
        text: {
          body: message
        }
      }
    });

    console.log('WhatsApp message sent successfully:', response.data);
    return { 
      success: true, 
      messageId: response.data.messages?.[0]?.id 
    };
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error('Error sending WhatsApp message:', errorMessage);
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

export async function sendTicketCreatedMessage(
  customerPhone: string,
  customerName: string,
  ticketNumber: string,
  deviceType: string,
  deviceBrand: string
): Promise<WhatsAppMessageResult> {
  const message = `مرحباً ${customerName}! 👋

تم استلام طلب إصلاح جهازك بنجاح ✅

📋 رقم التذكرة: ${ticketNumber}
📱 الجهاز: ${deviceBrand} - ${deviceType}

سيتم التواصل معك قريباً لتحديد موعد الاستلام والتكلفة المتوقعة.

شكراً لاختيارك العين لتجارة الحاسبات! 🖥️

---
Hello ${customerName}! 👋

Your repair request has been received successfully ✅

📋 Ticket Number: ${ticketNumber}
📱 Device: ${deviceBrand} - ${deviceType}

We will contact you soon to schedule pickup and provide a cost estimate.

Thank you for choosing Al-Ain Computer Trading! 🖥️`;

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
  const statusMessages: Record<string, { ar: string; en: string }> = {
    'pending': { ar: 'قيد الانتظار', en: 'Pending' },
    'in-progress': { ar: 'جاري العمل عليه', en: 'In Progress' },
    'waiting-parts': { ar: 'بانتظار القطع', en: 'Waiting for Parts' },
    'completed': { ar: 'تم الإصلاح', en: 'Completed' },
    'delivered': { ar: 'تم التسليم', en: 'Delivered' },
    'rejected': { ar: 'تم رفض الصيانة', en: 'Repair Rejected' },
    'unrepairable': { ar: 'لا يصلح', en: 'Unrepairable' }
  };

  const statusText = statusMessages[status] || { ar: status, en: status };

  let message = `مرحباً ${customerName}! 👋

تحديث على طلب الإصلاح الخاص بك:

📋 رقم التذكرة: ${ticketNumber}
📊 الحالة الجديدة: ${statusText.ar}`;

  if (costEstimate) {
    message += `\n💰 التكلفة المقدرة: ${costEstimate} د.ع`;
  }

  if (finalCost) {
    message += `\n💵 التكلفة النهائية: ${finalCost} د.ع`;
  }

  if (technicianNotes) {
    message += `\n📝 ملاحظات الفني: ${technicianNotes}`;
  }

  message += `

---
Hello ${customerName}! 👋

Update on your repair request:

📋 Ticket Number: ${ticketNumber}
📊 New Status: ${statusText.en}`;

  if (costEstimate) {
    message += `\n💰 Estimated Cost: ${costEstimate} IQD`;
  }

  if (finalCost) {
    message += `\n💵 Final Cost: ${finalCost} IQD`;
  }

  if (technicianNotes) {
    message += `\n📝 Technician Notes: ${technicianNotes}`;
  }

  message += `

شكراً لصبركم! 🙏
Thank you for your patience! 🙏`;

  return sendWhatsAppMessage(customerPhone, message);
}
