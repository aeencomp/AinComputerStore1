/** A4 sales invoice HTML — styled after store invoice template */

import storeLogoSrc from "@assets/aeen-receipt-logo.png";

export const STORE_WEBSITE = "https://Aeen-Iq.com";
export const STORE_BRAND_RED = "#c83233";

export interface A4InvoiceItem {
  nameAr?: string;
  nameEn?: string;
  name?: string;
  sku?: string;
  price: string | number;
  quantity: number;
  specs?: string[];
  notes?: string;
}

export interface A4InvoiceOrder {
  orderNumber: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items?: A4InvoiceItem[];
  subtotal?: string | number;
  discount?: string | number;
  total?: string | number;
  paymentMethod?: string;
  notes?: string | null;
}

export interface A4InvoiceOptions {
  issuedBy?: string;
  previousBalance?: number;
  amountReceived?: number;
}

const STORE = {
  motto: "وعند العين تتضح الرؤيا",
  nameAr: "العين لتجارة الحاسبات",
  address: "كربلاء - شارع النقيب - ركن شارع النهر",
  salesPhone: "07750006977",
  maintenancePhone: "07850006977",
  assemblyPhone: "07750008466",
  supportPhone: "07850008466",
  website: STORE_WEBSITE,
  brandRed: STORE_BRAND_RED,
};

function getReceiptTerms(): string[] {
  return [
    "ضمان سنة كاملة للأجهزة الجديدة.",
    "الضمان 5 أشهر صيانة، أول أسبوع استبدال فوري في حال وجود خلل مصنعي.",
    "الضمان لا يشمل الاستبدال والاسترجاع والحرق والكسر والكهرباء.",
    "يسقط حق الضمان في حال فتح الجهاز.",
    "يسقط حق الضمان في حال فقدان الوصل.",
    "ضمان البطارية: تشغيل ساعة فما فوق ولمدة أسبوع واحد للبطارية.",
    "الضمان لا يشمل الشاشة وسوء الاستخدام.",
  ];
}

const PAYMENT_AR: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  zaincash: "زين كاش",
  qicard: "كي كارد",
  deferred: "آجل",
  cod: "عند الاستلام",
};

const fmtNum = (v: number) =>
  v.toLocaleString("en-US", { maximumFractionDigits: 0 });

const fmtIqd = (v: number) => `${fmtNum(v)} د.ع`;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Convert IQD amount to Arabic words (common POS amounts). */
export function iqdToArabicWords(amount: number): string {
  const n = Math.abs(Math.round(amount));
  if (n === 0) return "صفر دينار فقط لاغيرها";

  const ones = [
    "",
    "واحد",
    "اثنان",
    "ثلاثة",
    "أربعة",
    "خمسة",
    "ستة",
    "سبعة",
    "ثمانية",
    "تسعة",
  ];
  const tens = [
    "",
    "عشرة",
    "عشرون",
    "ثلاثون",
    "أربعون",
    "خمسون",
    "ستون",
    "سبعون",
    "ثمانون",
    "تسعون",
  ];
  const teens = [
    "عشرة",
    "أحد عشر",
    "اثنا عشر",
    "ثلاثة عشر",
    "أربعة عشر",
    "خمسة عشر",
    "ستة عشر",
    "سبعة عشر",
    "ثمانية عشر",
    "تسعة عشر",
  ];

  const under100 = (x: number): string => {
    if (x < 10) return ones[x];
    if (x < 20) return teens[x - 10];
    const t = Math.floor(x / 10);
    const o = x % 10;
    if (o === 0) return tens[t];
    if (t === 1) return teens[o];
    return `${ones[o]} و${tens[t]}`;
  };

  const under1000 = (x: number): string => {
    if (x < 100) return under100(x);
    const h = Math.floor(x / 100);
    const r = x % 100;
    const hWord =
      h === 1 ? "مائة" : h === 2 ? "مائتان" : `${ones[h]} مائة`;
    if (r === 0) return hWord;
    return `${hWord} و${under100(r)}`;
  };

  const chunk = (x: number, one: string, two: string, plural: string): string => {
    if (x === 0) return "";
    if (x === 1) return one;
    if (x === 2) return two;
    if (x >= 3 && x <= 10) return `${under1000(x)} ${plural}`;
    return `${under1000(x)} ${one}`;
  };

  const parts: string[] = [];
  let rem = n;

  const millions = Math.floor(rem / 1_000_000);
  if (millions > 0) {
    parts.push(chunk(millions, "مليون", "مليونان", "ملايين"));
    rem %= 1_000_000;
  }

  const thousands = Math.floor(rem / 1000);
  if (thousands > 0) {
    parts.push(chunk(thousands, "ألف", "ألفان", "آلاف"));
    rem %= 1000;
  }

  if (rem > 0) parts.push(under1000(rem));

  const text = parts.filter(Boolean).join(" و");
  return `${text} دينار فقط لاغيرها`;
}

export async function loadStoreLogoDataUrl(): Promise<string> {
  const response = await fetch(storeLogoSrc);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to load store logo"));
    reader.readAsDataURL(blob);
  });
}

export function buildA4InvoiceHtml(
  order: A4InvoiceOrder,
  options: A4InvoiceOptions = {},
  barcodeSvg = "",
  qrDataUrl = "",
  logoDataUrl = "",
): string {
  const subtotalNum = parseFloat(String(order.subtotal ?? order.total ?? 0)) || 0;
  const discountNum = parseFloat(String(order.discount ?? 0)) || 0;
  const totalNum = parseFloat(String(order.total ?? 0)) || 0;
  const saleDate = new Date(order.createdAt);
  const dateStr = saleDate.toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" }).replace(/-/g, "/");
  const timeStr = saleDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Baghdad",
  });
  const footerDate = saleDate.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Baghdad",
  });
  const footerShort = `${dateStr} ${saleDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Baghdad",
  })}`;

  const received =
    options.amountReceived ?? (order.paymentMethod === "deferred" ? 0 : totalNum);
  const prevBalance = options.previousBalance ?? 0;
  const currentBalance = prevBalance + totalNum - received;

  const payType =
    PAYMENT_AR[order.paymentMethod || "cash"] || PAYMENT_AR.cash;

  const items = order.items || [];
  const productCount = items.reduce(
    (sum, i) => sum + (parseInt(String(i.quantity), 10) || 1),
    0,
  );

  const itemRows = items
    .map((item, idx) => {
      const unitPrice = parseFloat(String(item.price)) || 0;
      const qty = parseInt(String(item.quantity), 10) || 1;
      const lineTotal = unitPrice * qty;
      const name = escapeHtml(item.nameAr || item.nameEn || item.name || "-");
      const sku = escapeHtml(item.sku || "-");
      const noteText =
        item.notes ||
        (Array.isArray(item.specs) && item.specs.length > 0
          ? item.specs.join(" • ")
          : idx === 0 && order.notes
            ? order.notes
            : "");
      const notes = escapeHtml(noteText);
      return `<tr>
        <td>${idx + 1}</td>
        <td class="sku">${sku}</td>
        <td class="name">${name}</td>
        <td>${qty}</td>
        <td>قطعة</td>
        <td>${fmtIqd(unitPrice)}</td>
        <td>${fmtIqd(lineTotal)}</td>
        <td class="notes">${notes}</td>
      </tr>`;
    })
    .join("");

  const customerName = escapeHtml(order.customerName || "");
  const customerAddress = escapeHtml(
    order.customerAddress || order.customerPhone || "",
  );
  const invoiceNo = escapeHtml(order.orderNumber);
  const amountWords = escapeHtml(iqdToArabicWords(totalNum));

  const organizer = escapeHtml((options.issuedBy || "").trim() || "—");
  const termsHtml = getReceiptTerms().map(
    (t, i) => `<li><span class="term-num">${i + 1}.</span> ${escapeHtml(t)}</li>`,
  ).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>فاتورة ${invoiceNo}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 10mm 12mm 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body {
    font-family: 'Cairo', 'Noto Naskh Arabic', Arial, sans-serif;
    margin: 0; padding: 0; color: #1a1a1a; direction: rtl;
    background: #fff;
  }
  .page { position: relative; min-height: 277mm; padding: 4mm 2mm 14mm; }
  .watermark {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 120px; font-weight: 900; color: rgba(200, 50, 51, 0.05);
    pointer-events: none; user-select: none; letter-spacing: 8px;
  }
  .top-accent {
    height: 4px; border-radius: 2px;
    background: linear-gradient(90deg, ${STORE.brandRed} 0%, #ef5350 55%, #b71c1c 100%);
    margin-bottom: 0;
  }
  .banner-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    column-gap: 10px;
    padding: 12px 8px 10px;
    border-bottom: 2px solid #1a1a1a;
    background: linear-gradient(180deg, #fafbfd 0%, #fff 100%);
  }
  .banner-store { justify-self: start; text-align: start; min-width: 0; max-width: 100%; }
  .banner-store .store-name {
    margin: 0; font-size: 17px; font-weight: 800; color: #111; line-height: 1.3;
  }
  .banner-store .store-address {
    margin: 4px 0 0; font-size: 11px; font-weight: 700; color: #444; line-height: 1.45;
  }
  .banner-store .store-website {
    margin: 4px 0 0; font-size: 11px; font-weight: 800; color: ${STORE.brandRed};
    direction: ltr; unicode-bidi: embed; letter-spacing: 0.2px;
  }
  .banner-center {
    justify-self: center;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .store-logo-img {
    width: 160px; height: auto; max-height: 96px;
    display: block; margin: 0 auto 4px;
    object-fit: contain;
  }
  .banner-motto {
    margin: 0; font-size: 15px; font-weight: 900; color: #111; white-space: nowrap;
  }
  .banner-qr { justify-self: end; text-align: center; direction: ltr; }
  .banner-qr img {
    width: 92px; height: 92px; display: block; margin: 0 auto;
    border: 2px solid ${STORE.brandRed}; border-radius: 6px; padding: 4px; background: #fff;
    box-shadow: 0 2px 8px rgba(200, 50, 51, 0.18);
  }
  .banner-invoice-no {
    margin-top: 6px; font-size: 14px; font-weight: 800; color: ${STORE.brandRed};
    font-family: 'Cairo', Arial, sans-serif; letter-spacing: 0.3px;
  }
  .banner-invoice-no span { color: #444; font-weight: 700; }
  .contacts-strip {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 10px;
    padding: 8px 10px; font-size: 10.5px; font-weight: 700;
    background: #f4f6f9; border-bottom: 1px solid #dde3ea;
  }
  .contacts-strip .dept { color: #555; font-weight: 600; display: block; }
  .contacts-strip .phone { direction: ltr; color: #111; font-weight: 800; }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    padding: 12px 4px;
    font-size: 13px;
    font-weight: 700;
  }
  .meta-row .field { margin-bottom: 6px; }
  .meta-row .label { color: #333; }
  .meta-row .value { border-bottom: 1px dotted #999; min-height: 18px; padding: 0 4px; }
  .meta-customer { flex: 1; min-width: 0; text-align: start; }
  .meta-invoice-info {
    flex-shrink: 0;
    text-align: left;
    align-self: flex-start;
    line-height: 1.65;
    padding-left: 2px;
  }
  .meta-invoice-info > div { white-space: nowrap; }
  table.items {
    width: 100%; border-collapse: collapse; margin: 8px 0 14px;
    font-size: 12px;
  }
  table.items thead th {
    background: linear-gradient(180deg, ${STORE.brandRed} 0%, #9b1c1c 100%);
    color: #fff; font-weight: 800; padding: 8px 6px;
    border: 1px solid #8f1528; text-align: center;
  }
  table.items tbody td {
    border: 1px solid #ccc; padding: 7px 6px; text-align: center; vertical-align: middle;
  }
  table.items tbody tr:nth-child(even) { background: #fafafa; }
  table.items td.name { text-align: right; font-weight: 700; min-width: 140px; }
  table.items td.sku { font-family: monospace; font-weight: 700; direction: ltr; }
  table.items td.notes { font-size: 10px; color: #444; text-align: right; max-width: 100px; }
  .summary {
    display: grid; grid-template-columns: 1.1fr 0.9fr 1fr; gap: 12px;
    align-items: start; margin-bottom: 16px;
  }
  .balance-box { font-size: 12px; font-weight: 700; line-height: 1.9; }
  .balance-box .row { display: flex; justify-content: space-between; gap: 8px; }
  .balance-box .received { margin: 6px 0; padding: 6px 0; border-top: 1px dashed #bbb; border-bottom: 1px dashed #bbb; }
  .amount-words {
    font-size: 13px; font-weight: 800; text-align: center; padding: 16px 8px;
    border-top: 2px solid #222; margin-top: 8px; color: #111; line-height: 1.6;
  }
  .totals-stack { display: flex; flex-direction: column; gap: 6px; }
  .total-row {
    display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 800;
  }
  .total-row .val {
    min-width: 72px; text-align: center; padding: 6px 10px;
    border-radius: 4px; border: 1px solid #ddd;
    background: linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%);
    font-size: 14px;
  }
  .total-row.net .val { color: ${STORE.brandRed}; background: #fff; border-color: ${STORE.brandRed}; font-size: 16px; }
  .footer {
    border-top: 2px solid #222; padding-top: 12px;
    display: grid; grid-template-columns: 1fr auto 140px; gap: 16px; align-items: start;
  }
  .terms { font-size: 9.5px; line-height: 1.55; color: #222; list-style: none; padding: 0; margin: 0; }
  .terms li { margin-bottom: 3px; }
  .terms .term-num { color: ${STORE.brandRed}; font-weight: 800; margin-left: 4px; }
  .footer-mid { min-height: 0; }
  .barcode-wrap { text-align: center; }
  .barcode-wrap svg { max-width: 120px; height: auto; transform: rotate(90deg); margin: 8px auto; display: block; }
  .barcode-id { font-family: monospace; font-weight: 900; font-size: 13px; direction: ltr; color: ${STORE.brandRed}; }
  .disclaimer { font-size: 10px; color: #555; margin-top: 8px; font-weight: 600; }
  .footer-website {
    font-size: 11px; font-weight: 800; color: ${STORE.brandRed};
    margin-top: 6px; direction: ltr; unicode-bidi: embed;
  }
  .footer-sign-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
    padding: 8px 6px 6px;
    border-top: 1px dashed #bbb;
    font-size: 12px;
    font-weight: 800;
    color: #111;
  }
  .footer-sign-row .product-count { direction: rtl; }
  .footer-sign-row .receipt-organizer {
    direction: rtl;
    text-align: end;
    white-space: nowrap;
  }
  .page-meta {
    position: fixed; bottom: 0; left: 0; right: 0;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; color: #666; padding: 4px 12mm; border-top: 1px solid #eee;
    background: #fff;
  }
  @media print {
    .page { min-height: auto; }
    .page-meta { position: fixed; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="watermark">العين</div>
  <div class="top-accent"></div>
  <header class="banner-header" dir="rtl">
    <div class="banner-store">
      <h1 class="store-name">${STORE.nameAr}</h1>
      <p class="store-address">${STORE.address}</p>
      <p class="store-website">${STORE.website}</p>
    </div>
    <div class="banner-center">
      ${logoDataUrl ? `<img src="${logoDataUrl}" alt="العين لتجارة الحاسبات" class="store-logo-img"/>` : ""}
      <p class="banner-motto">${STORE.motto}</p>
    </div>
    <div class="banner-qr">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" width="92" height="92"/>` : ""}
      <div class="banner-invoice-no"><span>Invoice :</span> #${invoiceNo}</div>
    </div>
  </header>
  <div class="contacts-strip" dir="rtl">
    <div><span class="dept">قسم المبيعات</span><span class="phone">${STORE.salesPhone}</span></div>
    <div><span class="dept">قسم الصيانة</span><span class="phone">${STORE.maintenancePhone}</span></div>
    <div><span class="dept">قسم التجميعات</span><span class="phone">${STORE.assemblyPhone}</span></div>
    <div><span class="dept">الدعم الفني</span><span class="phone">${STORE.supportPhone}</span></div>
  </div>

  <section class="meta-row">
    <div class="meta-customer">
      <div class="field"><span class="label">اسم العميل :</span> <span class="value">${customerName}</span></div>
      <div class="field"><span class="label">العنوان :</span> <span class="value">${customerAddress}</span></div>
    </div>
    <div class="meta-invoice-info">
      <div><span class="label">نوع الفاتورة :</span> ${payType}</div>
      <div><span class="label">التاريخ :</span> ${dateStr}</div>
    </div>
  </section>

  <table class="items">
    <thead>
      <tr>
        <th>ت</th>
        <th>رمز المنتج</th>
        <th>اسم المنتج</th>
        <th>العدد</th>
        <th>الوحدة</th>
        <th>السعر</th>
        <th>الاجمالي</th>
        <th>الملاحظات</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="8" style="padding:16px;color:#888;">لا توجد منتجات</td></tr>'}
    </tbody>
  </table>

  <section class="summary">
    <div class="balance-box">
      <div class="row"><span>رصيد العميل السابق :</span><span>${fmtIqd(prevBalance)}</span></div>
      <div class="received">
        <div class="row"><span>المبلغ الواصل :</span><span>${fmtIqd(received)}</span></div>
      </div>
      <div class="row"><span>رصيد العميل الحالي :</span><span>${fmtIqd(currentBalance)}</span></div>
    </div>
    <div class="amount-words">${amountWords}</div>
    <div class="totals-stack">
      <div class="total-row">
        <span>المبلغ الاجمالي :</span>
        <span class="val">${fmtIqd(subtotalNum)}</span>
      </div>
      <div class="total-row">
        <span>اجمالي الخصم :</span>
        <span class="val">${fmtIqd(discountNum)}</span>
      </div>
      <div class="total-row net">
        <span>المبلغ الصافي :</span>
        <span class="val">${fmtIqd(totalNum)}</span>
      </div>
    </div>
  </section>

  <footer class="footer">
    <ol class="terms">${termsHtml}</ol>
    <div class="footer-mid"></div>
    <div class="barcode-wrap">
      ${barcodeSvg}
      <div class="barcode-id">${invoiceNo}</div>
      <p class="disclaimer">الخطأ والسهو مرجوع للطرفين</p>
      <p class="footer-website">${STORE.website}</p>
    </div>
  </footer>
  <div class="footer-sign-row" dir="ltr">
    <span class="product-count" dir="rtl">عدد المنتجات : ${productCount}</span>
    <span class="receipt-organizer" dir="rtl">منظم الوصل : ${organizer}</span>
  </div>
</div>
<div class="page-meta">
  <span>صفحة 1 من 1</span>
  <span dir="ltr">${STORE.website}</span>
  <span>${footerDate}</span>
  <span dir="ltr">${footerShort}</span>
</div>
<script>
  window.onload = function() {
    setTimeout(function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    }, 400);
  };
</script>
</body>
</html>`;
}

export async function renderInvoiceBarcodeSvg(value: string): Promise<string> {
  const JsBarcode = (await import("jsbarcode")).default;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, {
    format: "CODE128",
    width: 1.4,
    height: 48,
    displayValue: false,
    margin: 2,
  });
  return new XMLSerializer().serializeToString(svg);
}

export async function renderInvoiceQrDataUrl(
  order: A4InvoiceOrder,
): Promise<string> {
  const { toDataURL } = await import("qrcode");
  return toDataURL(
    `ORDER:${order.orderNumber}|TOTAL:${order.total ?? ""}`,
    {
      width: 200,
      margin: 1,
      color: { dark: STORE.brandRed, light: "#ffffff" },
    },
  );
}

export async function openA4InvoicePrint(
  order: A4InvoiceOrder,
  options: A4InvoiceOptions = {},
): Promise<void> {
  const [barcodeSvg, qrDataUrl, logoDataUrl] = await Promise.all([
    renderInvoiceBarcodeSvg(order.orderNumber),
    renderInvoiceQrDataUrl(order),
    loadStoreLogoDataUrl(),
  ]);
  const html = buildA4InvoiceHtml(order, options, barcodeSvg, qrDataUrl, logoDataUrl);
  const popup = window.open("", "_blank", "width=1000,height=900");
  if (popup) {
    popup.document.write(html);
    popup.document.close();
  }
}
