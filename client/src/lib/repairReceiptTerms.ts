export const REPAIR_RECEIPT_UNDER_25K_POLICY_AR =
  "أي صيانة ما دون 25000 يتم الصيانة بدون الإتصال على الزبون";

export const REPAIR_RECEIPT_DIAGNOSIS_REFUSAL_POLICY_AR =
  "في حال رفض الزبون الصيانة بعد تشخيص المشكلة يدفع الزبون 10.000 د.ع";

export const REPAIR_RECEIPT_TURNAROUND_POLICY_AR =
  "مدة إنجاز الصيانة من 24 ساعة إلى 48 ساعة";

export function repairReceiptStandardTermsHtml(isRTL: boolean): string {
  return `
    <li>${isRTL ? REPAIR_RECEIPT_UNDER_25K_POLICY_AR : "Repairs under 25,000 IQD will be completed without contacting the customer."}</li>
    <li>${isRTL ? REPAIR_RECEIPT_DIAGNOSIS_REFUSAL_POLICY_AR : "If the customer refuses repair after diagnosis, a 10,000 IQD fee applies."}</li>
    <li>${isRTL ? REPAIR_RECEIPT_TURNAROUND_POLICY_AR : "Repair turnaround time is 24 to 48 hours."}</li>
    <li>${isRTL ? "يرجى الاحتفاظ بهذا الإيصال لاستلام الجهاز" : "Please keep this receipt to collect your device"}</li>
    <li>${isRTL ? "قد تطول المدة عند عدم توفر القطع أو تعقّد العطل" : "Time may extend if parts are unavailable or the issue is complex"}</li>
    <li>${isRTL ? "سيتم التواصل معكم عند الانتهاء" : "We will contact you when ready"}</li>
    <li>${isRTL ? "الأجهزة غير المستلمة خلال 30 يوم لا نتحمل مسؤوليتها" : "We are not responsible for devices not collected within 30 days"}</li>
  `;
}

export function repairReceiptTermsSectionHtml(isRTL: boolean): string {
  return `
    <div class="terms">
      <div class="terms-title">${isRTL ? "سياسة الصيانة والشروط:" : "Repair Policy & Terms:"}</div>
      <ul class="terms-list">
        ${repairReceiptStandardTermsHtml(isRTL)}
      </ul>
    </div>
  `;
}
