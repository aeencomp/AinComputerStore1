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
        className="max-w-[80mm] mx-auto bg-white p-4 shadow-lg print:shadow-none print:max-w-none print:p-2"
        style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}
      >
        <div className="text-center border-b-2 border-dashed border-black pb-3 mb-3">
          <h2 className="font-extrabold text-xl tracking-tight">العين لتجارة الحاسبات</h2>
          <p className="text-sm font-bold text-gray-700">Al-Ain Computer Trading</p>
          <p className="text-sm font-semibold text-gray-600 mt-1">كربلاء - العراق</p>
        </div>

        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="font-bold text-base">رقم الوصل:</p>
            <p className="font-mono font-bold text-sm">{receiptData.saleNumber}</p>
          </div>
          <QRCodeSVG 
            value={`SALE:${receiptData.saleNumber}|TOTAL:${receiptData.total}`}
            size={60}
            level="H"
          />
        </div>

        <div className="bg-gray-100 rounded p-2 mb-3 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold">تاريخ البيع:</span>
            <span className="font-bold">
              {saleDate.toLocaleDateString('ar-IQ')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">الوقت:</span>
            <span className="font-bold">{saleDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {(receiptData.customerName || receiptData.customerPhone) && (
          <div className="border-t-2 border-gray-300 pt-2 mb-3 text-sm">
            {receiptData.customerName && (
              <div className="flex justify-between">
                <span className="font-semibold">الزبون:</span>
                <span className="font-bold">{receiptData.customerName}</span>
              </div>
            )}
            {receiptData.customerPhone && (
              <div className="flex justify-between">
                <span className="font-semibold">الهاتف:</span>
                <span className="font-bold" dir="ltr">{receiptData.customerPhone}</span>
              </div>
            )}
          </div>
        )}

        <div className="border-t-2 border-b-2 border-black py-2 mb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-400">
                <th className="text-start pb-1 font-extrabold">المنتج</th>
                <th className="text-center pb-1 font-extrabold">الكمية</th>
                <th className="text-end pb-1 font-extrabold">السعر</th>
              </tr>
            </thead>
            <tbody>
              {receiptData.items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-1">
                    <div className="font-bold">{item.brand}</div>
                    <div className="text-gray-600 text-xs font-semibold">{item.serialNumber}</div>
                  </td>
                  <td className="text-center font-bold">{item.quantity}</td>
                  <td className="text-end font-bold">{formatPrice(item.unitPrice * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 text-base mb-3">
          <div className="flex justify-between">
            <span className="font-semibold">المجموع:</span>
            <span className="font-bold">{formatPrice(receiptData.subtotal)}</span>
          </div>
          {receiptData.discount > 0 && (
            <div className="flex justify-between text-green-700">
              <span className="font-semibold">الخصم ({receiptData.discount}%):</span>
              <span className="font-bold">-{formatPrice(receiptData.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-extrabold text-lg border-t-2 border-black pt-2">
            <span>الإجمالي:</span>
            <span>{formatPrice(receiptData.total)}</span>
          </div>
        </div>

        <div className="bg-gray-100 rounded p-2 mb-3 text-sm text-center">
          <span className="font-semibold">طريقة الدفع: </span>
          <span className="font-extrabold">
            {receiptData.paymentMethod === 'cash' ? 'نقدي' :
             receiptData.paymentMethod === 'card' ? 'بطاقة' : 'زين كاش'}
          </span>
        </div>

        <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 text-center mb-3">
          <div className="font-extrabold text-amber-900 text-base mb-1">
            ضمان شهر واحد
          </div>
          <p className="text-sm font-semibold text-amber-800 mb-2">
            جميع البطاريات تشمل ضمان لمدة شهر واحد من تاريخ الشراء
          </p>
          <div className="border-t-2 border-amber-300 pt-2 text-sm">
            <div className="flex justify-between text-amber-900">
              <span className="font-semibold">تاريخ الشراء:</span>
              <span className="font-extrabold">{saleDate.toLocaleDateString('ar-IQ')}</span>
            </div>
            <div className="flex justify-between text-amber-900">
              <span className="font-semibold">انتهاء الضمان:</span>
              <span className="font-extrabold">{warrantyEndDate.toLocaleDateString('ar-IQ')}</span>
            </div>
          </div>
        </div>

        <div className="text-center border-t-2 border-dashed border-black pt-3">
          <p className="text-sm font-bold text-gray-700">شكراً لتسوقكم معنا</p>
          <p className="text-xs font-semibold text-gray-600 mt-1">يرجى الاحتفاظ بالوصل لغرض الضمان</p>
          <p className="text-base font-extrabold text-gray-900 mt-2" dir="ltr">07850006977</p>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: 80mm auto;
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
            width: 80mm !important;
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif !important;
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
            padding: 2mm !important;
            box-shadow: none !important;
            background: white !important;
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif !important;
            font-weight: 600 !important;
            -webkit-font-smoothing: antialiased !important;
            text-rendering: optimizeLegibility !important;
          }
          #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt .font-extrabold {
            font-weight: 800 !important;
          }
          #printable-receipt .font-bold {
            font-weight: 700 !important;
          }
          #printable-receipt .font-semibold {
            font-weight: 600 !important;
          }
        }
      `}</style>
    </div>
  );
}
