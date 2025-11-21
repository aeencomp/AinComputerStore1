import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  customerPostalCode: string;
}

function formatIQD(amount: number): string {
  return new Intl.NumberFormat('ar-IQ', {
    style: 'currency',
    currency: 'IQD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function generateOrderConfirmationHTML(data: OrderEmailData): string {
  const itemsHTML = data.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left;">${formatIQD(item.price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left; font-weight: 600;">${formatIQD(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تأكيد الطلب</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #26B2F2 0%, #1a8bc4 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">العين لتجارة الحاسبات</h1>
      <p style="color: rgba(255, 255, 255, 0.95); margin: 10px 0 0 0; font-size: 16px;">شكراً لطلبك!</p>
    </div>

    <!-- Order Confirmation -->
    <div style="padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      <div style="display: inline-block; background-color: #f0fdf4; padding: 16px 24px; border-radius: 8px; margin-bottom: 16px;">
        <p style="margin: 0; color: #16a34a; font-size: 14px; font-weight: 600;">✓ تم تأكيد طلبك بنجاح</p>
      </div>
      <h2 style="color: #26B2F2; margin: 0; font-size: 24px; font-weight: 700;">رقم الطلب: ${data.orderNumber}</h2>
    </div>

    <!-- Customer Details -->
    <div style="padding: 30px 20px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px; font-weight: 600;">معلومات العميل</h3>
      <div style="color: #4b5563; line-height: 1.8;">
        <p style="margin: 8px 0;"><strong>الاسم:</strong> ${data.customerName}</p>
        <p style="margin: 8px 0;"><strong>البريد الإلكتروني:</strong> ${data.customerEmail}</p>
        <p style="margin: 8px 0;"><strong>رقم الهاتف:</strong> ${data.customerPhone}</p>
        <p style="margin: 8px 0;"><strong>العنوان:</strong> ${data.customerAddress}</p>
        <p style="margin: 8px 0;"><strong>المدينة:</strong> ${data.customerCity}</p>
        <p style="margin: 8px 0;"><strong>الرمز البريدي:</strong> ${data.customerPostalCode}</p>
      </div>
    </div>

    <!-- Order Items -->
    <div style="padding: 30px 20px;">
      <h3 style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px; font-weight: 600;">تفاصيل الطلب</h3>
      <table style="width: 100%; border-collapse: collapse; text-align: right;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 12px; text-align: right; color: #6b7280; font-weight: 600; font-size: 14px;">المنتج</th>
            <th style="padding: 12px; text-align: center; color: #6b7280; font-weight: 600; font-size: 14px;">الكمية</th>
            <th style="padding: 12px; text-align: left; color: #6b7280; font-weight: 600; font-size: 14px;">السعر</th>
            <th style="padding: 12px; text-align: left; color: #6b7280; font-weight: 600; font-size: 14px;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding: 16px 12px; text-align: right; font-size: 18px; font-weight: 700; color: #1f2937;">المجموع الكلي:</td>
            <td style="padding: 16px 12px; text-align: left; font-size: 18px; font-weight: 700; color: #26B2F2;">${formatIQD(data.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Payment Info -->
    <div style="padding: 30px 20px; background-color: #fef3c7; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6;">
        <strong>طريقة الدفع:</strong> الدفع عند الاستلام<br>
        سيتم التواصل معك قريباً لتأكيد التوصيل.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 30px 20px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">شكراً لاختيارك العين لتجارة الحاسبات</p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">إذا كان لديك أي استفسار، لا تتردد في التواصل معنا</p>
    </div>
  </div>
</body>
</html>
  `;
}

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<void> {
  const htmlContent = generateOrderConfirmationHTML(data);

  const mailOptions = {
    from: `"العين لتجارة الحاسبات" <${process.env.GMAIL_USER}>`,
    to: data.customerEmail,
    subject: `تأكيد طلبك رقم ${data.orderNumber} - العين لتجارة الحاسبات`,
    html: htmlContent,
  };

  await transporter.sendMail(mailOptions);
  console.log(`✓ Order confirmation email sent to ${data.customerEmail} for order ${data.orderNumber}`);
}
