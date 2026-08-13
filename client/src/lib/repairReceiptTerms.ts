export const REPAIR_RECEIPT_UNDER_25K_POLICY_AR =
  "أي صيانة ما دون 25000 يتم الصيانة بدون الإتصال على الزبون";

export const REPAIR_RECEIPT_DIAGNOSIS_REFUSAL_POLICY_AR =
  "في حال رفض الزبون الصيانة بعد تشخيص المشكلة يدفع الزبون 10.000 د.ع";

export function repairReceiptStandardTermsHtml(isRTL: boolean): string {
  return `
    <li>${isRTL ? REPAIR_RECEIPT_UNDER_25K_POLICY_AR : "Repairs under 25,000 IQD will be completed without contacting the customer."}</li>
    <li>${isRTL ? REPAIR_RECEIPT_DIAGNOSIS_REFUSAL_POLICY_AR : "If the customer refuses repair after diagnosis, a 10,000 IQD fee applies."}</li>
    <li>${isRTL ? "يرجى الاحتفاظ بهذا الإيصال لاستلام الجهاز" : "Please keep this receipt to collect your device"}</li>
    <li>${isRTL ? "مدة الصيانة تعتمد على نوع العطل وتوفر القطع" : "Repair time depends on issue type and parts availability"}</li>
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
