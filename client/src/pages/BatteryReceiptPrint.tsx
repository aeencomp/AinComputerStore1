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
      >
        <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-3">
          <h2 className="font-bold text-lg">العين لتجارة الحاسبات</h2>
          <p className="text-xs text-gray-600">Al-Ain Computer Trading</p>
          <p className="text-xs text-gray-500 mt-1">كربلاء - العراق</p>
        </div>

        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="font-semibold text-sm">رقم الوصل:</p>
            <p className="font-mono text-xs">{receiptData.saleNumber}</p>
          </div>
          <QRCodeSVG 
            value={`SALE:${receiptData.saleNumber}|TOTAL:${receiptData.total}`}
            size={55}
            level="M"
          />
        </div>

        <div className="bg-gray-100 rounded p-2 mb-3 text-xs">
          <div className="flex justify-between">
            <span>تاريخ البيع:</span>
            <span className="font-semibold">
              {saleDate.toLocaleDateString('ar-IQ')}
            </span>
          </div>
          <div className="flex justify-between">
            <span>الوقت:</span>
            <span>{saleDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {(receiptData.customerName || receiptData.customerPhone) && (
          <div className="border-t border-gray-200 pt-2 mb-3 text-xs">
            {receiptData.customerName && (
              <div className="flex justify-between">
                <span>الزبون:</span>
                <span>{receiptData.customerName}</span>
              </div>
            )}
            {receiptData.customerPhone && (
              <div className="flex justify-between">
                <span>الهاتف:</span>
                <span dir="ltr">{receiptData.customerPhone}</span>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-b border-gray-400 py-2 mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-start pb-1">المنتج</th>
                <th className="text-center pb-1">الكمية</th>
                <th className="text-end pb-1">السعر</th>
              </tr>
            </thead>
            <tbody>
              {receiptData.items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1">
                    <div className="font-medium">{item.brand}</div>
                    <div className="text-gray-500 text-[10px]">{item.serialNumber}</div>
                  </td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-end">{formatPrice(item.unitPrice * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 text-sm mb-3">
          <div className="flex justify-between">
            <span>المجموع:</span>
            <span>{formatPrice(receiptData.subtotal)}</span>
          </div>
          {receiptData.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>الخصم ({receiptData.discount}%):</span>
              <span>-{formatPrice(receiptData.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
            <span>الإجمالي:</span>
            <span>{formatPrice(receiptData.total)}</span>
          </div>
        </div>

        <div className="bg-gray-100 rounded p-2 mb-3 text-xs text-center">
          <span className="text-gray-600">طريقة الدفع: </span>
          <span className="font-semibold">
            {receiptData.paymentMethod === 'cash' ? 'نقدي' :
             receiptData.paymentMethod === 'card' ? 'بطاقة' : 'زين كاش'}
          </span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center mb-3">
          <div className="font-bold text-amber-800 text-sm mb-1">
            ضمان شهر واحد
          </div>
          <p className="text-xs text-amber-700 mb-2">
            جميع البطاريات تشمل ضمان لمدة شهر واحد من تاريخ الشراء
          </p>
          <div className="border-t border-amber-200 pt-2 text-xs">
            <div className="flex justify-between text-amber-800">
              <span>تاريخ الشراء:</span>
              <span className="font-semibold">{saleDate.toLocaleDateString('ar-IQ')}</span>
            </div>
            <div className="flex justify-between text-amber-800">
              <span>انتهاء الضمان:</span>
              <span className="font-semibold">{warrantyEndDate.toLocaleDateString('ar-IQ')}</span>
            </div>
          </div>
        </div>

        <div className="text-center border-t-2 border-dashed border-gray-400 pt-3">
          <p className="text-xs text-gray-500">شكراً لتسوقكم معنا</p>
          <p className="text-[10px] text-gray-400 mt-1">يرجى الاحتفاظ بالوصل لغرض الضمان</p>
          <p className="text-xs text-gray-600 mt-2 font-semibold" dir="ltr">07850006977</p>
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
          }
          #printable-receipt * {
            visibility: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
