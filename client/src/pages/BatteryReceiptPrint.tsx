import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, ArrowRight } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface ReceiptData {
  saleNumber: string;
  saleDate: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{
    brand: string;
    serialNumber: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  discount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  warrantyEndDate: string;
}

export default function BatteryReceiptPrint() {
  const [, setLocation] = useLocation();
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("battery_receipt_print");
    if (stored) {
      try {
        setReceiptData(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse receipt data:", e);
      }
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('ar-IQ') + ' د.ع';
  };

  if (!receiptData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100" dir="rtl">
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">لا توجد بيانات وصل للطباعة</p>
          <Button onClick={() => setLocation("/battery/pos")}>
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة لنقطة البيع
          </Button>
        </div>
      </div>
    );
  }

  const saleDate = new Date(receiptData.saleDate);
  const warrantyEndDate = new Date(receiptData.warrantyEndDate);

  return (
    <div className="min-h-screen bg-gray-100 p-4" dir="rtl">
      <div className="print:hidden max-w-md mx-auto mb-4 flex gap-2">
        <Button onClick={handlePrint} className="flex-1 gap-2" data-testid="button-print-now">
          <Printer className="w-4 h-4" />
          طباعة الوصل
        </Button>
        <Button variant="outline" onClick={() => setLocation("/battery/pos")} data-testid="button-back-pos">
          <ArrowRight className="w-4 h-4 ml-2" />
          رجوع
        </Button>
      </div>

      <div 
        id="printable-receipt" 
        className="max-w-[72mm] mx-auto bg-white shadow-lg print:shadow-none print:max-w-none text-black"
        style={{ fontFamily: "'Inter', 'SF Pro Display', 'Helvetica Neue', system-ui, -apple-system, sans-serif" }}
      >
        {/* Modern Header */}
        <div className="bg-black text-white p-4 text-center">
          <h2 className="font-extrabold text-xl tracking-wide">العين لتجارة الحاسبات</h2>
          <p className="text-sm font-semibold mt-1 opacity-90">Al-Ain Computer Trading</p>
          <p className="text-xs mt-1 opacity-75">كربلاء - العراق</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Receipt Number & QR */}
          <div className="flex justify-between items-center border-b-2 border-black pb-3">
            <div>
              <p className="text-xs font-bold text-black uppercase tracking-wide">رقم الوصل</p>
              <p className="font-mono font-extrabold text-base text-black">{receiptData.saleNumber}</p>
            </div>
            <QRCodeSVG 
              value={`SALE:${receiptData.saleNumber}|TOTAL:${receiptData.total}`}
              size={50}
              level="H"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2 text-sm border-b border-gray-300 pb-3">
            <div>
              <p className="text-xs font-bold text-black">التاريخ</p>
              <p className="font-extrabold text-black">{saleDate.toLocaleDateString('ar-IQ')}</p>
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-black">الوقت</p>
              <p className="font-extrabold text-black">{saleDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* Customer Info */}
          {(receiptData.customerName || receiptData.customerPhone) && (
            <div className="border-b border-gray-300 pb-3 text-sm">
              {receiptData.customerName && (
                <div className="flex justify-between">
                  <span className="font-bold text-black">الزبون:</span>
                  <span className="font-extrabold text-black">{receiptData.customerName}</span>
                </div>
              )}
              {receiptData.customerPhone && (
                <div className="flex justify-between mt-1">
                  <span className="font-bold text-black">الهاتف:</span>
                  <span className="font-extrabold text-black" dir="ltr">{receiptData.customerPhone}</span>
                </div>
              )}
            </div>
          )}

          {/* Items Table */}
          <div className="border-2 border-black rounded-lg overflow-hidden">
            <div className="bg-black text-white px-2 py-1">
              <div className="grid grid-cols-12 text-xs font-bold">
                <div className="col-span-6">المنتج</div>
                <div className="col-span-2 text-center">الكمية</div>
                <div className="col-span-4 text-left">السعر</div>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {receiptData.items.map((item, idx) => (
                <div key={idx} className="px-2 py-2 grid grid-cols-12 text-sm items-center">
                  <div className="col-span-6">
                    <div className="font-extrabold text-black">{item.brand}</div>
                    <div className="text-xs font-bold text-black">{item.serialNumber}</div>
                  </div>
                  <div className="col-span-2 text-center font-extrabold text-black">{item.quantity}</div>
                  <div className="col-span-4 text-left font-extrabold text-black">{formatPrice(item.unitPrice * item.quantity)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between font-bold text-black">
              <span>المجموع:</span>
              <span>{formatPrice(receiptData.subtotal)}</span>
            </div>
            {receiptData.discount > 0 && (
              <div className="flex justify-between font-bold text-black">
                <span>الخصم ({receiptData.discount}%):</span>
                <span>-{formatPrice(receiptData.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-lg bg-black text-white px-3 py-2 rounded-lg -mx-1">
              <span>الإجمالي:</span>
              <span>{formatPrice(receiptData.total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="text-center py-2 border-y border-gray-300">
            <span className="font-bold text-black text-sm">طريقة الدفع: </span>
            <span className="font-extrabold text-black text-sm">
              {receiptData.paymentMethod === 'cash' ? 'نقدي' :
               receiptData.paymentMethod === 'card' ? 'بطاقة' : 'زين كاش'}
            </span>
          </div>

          {/* Warranty Box */}
          <div className="border-2 border-black rounded-lg p-3 text-center">
            <div className="bg-black text-white font-extrabold text-sm py-1 px-3 rounded inline-block mb-2">
              ضمان شهر واحد
            </div>
            <p className="text-xs font-bold text-black mb-2">
              جميع البطاريات تشمل ضمان لمدة شهر واحد من تاريخ الشراء
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs border-t border-black pt-2 mt-2">
              <div>
                <span className="font-bold text-black block">تاريخ الشراء:</span>
                <span className="font-extrabold text-black">{saleDate.toLocaleDateString('ar-IQ')}</span>
              </div>
              <div>
                <span className="font-bold text-black block">انتهاء الضمان:</span>
                <span className="font-extrabold text-black">{warrantyEndDate.toLocaleDateString('ar-IQ')}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-3 border-t-2 border-dashed border-black">
            <p className="font-extrabold text-black text-sm">شكراً لتسوقكم معنا</p>
            <p className="text-xs font-bold text-black mt-1">يرجى الاحتفاظ بالوصل لغرض الضمان</p>
            <p className="font-extrabold text-black text-lg mt-2" dir="ltr">07850006977</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: 72.1mm 210mm;
            margin: 2mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 72.1mm !important;
            font-family: 'Inter', 'SF Pro Display', 'Helvetica Neue', system-ui, -apple-system, sans-serif !important;
          }
          body > * {
            display: none !important;
          }
          body > #root {
            display: block !important;
          }
          #root > * {
            display: none !important;
          }
          #root .min-h-screen {
            display: block !important;
            min-height: auto !important;
            background: white !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          #printable-receipt {
            display: block !important;
            visibility: visible !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: white !important;
            font-family: 'Inter', 'SF Pro Display', 'Helvetica Neue', system-ui, -apple-system, sans-serif !important;
            -webkit-font-smoothing: antialiased !important;
            text-rendering: optimizeLegibility !important;
            letter-spacing: -0.01em !important;
          }
          #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt .bg-black {
            background-color: black !important;
          }
          #printable-receipt .text-white {
            color: white !important;
          }
          #printable-receipt .text-black {
            color: black !important;
          }
          #printable-receipt .font-extrabold {
            font-weight: 800 !important;
          }
          #printable-receipt .font-bold {
            font-weight: 700 !important;
          }
        }
      `}</style>
    </div>
  );
}
