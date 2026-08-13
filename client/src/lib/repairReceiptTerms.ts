/** Shared policy lines for thermal repair intake receipts. */
export function repairReceiptUnder25kPolicyLine(isRTL: boolean): string {
  return isRTL
    ? "أي صيانة ما دون ال-25000 يتم الصيانة بدون الإتصال على الزبون"
    : "Repairs under 25,000 IQD will be completed without contacting the customer.";
}

export function repairReceiptStandardTermsHtml(isRTL: boolean): string {
  const policy = repairReceiptUnder25kPolicyLine(isRTL);
  return `
    <li>${isRTL ? "يرجى الاحتفاظ بهذا الإيصال لاستلام الجهاز" : "Please keep this receipt to collect your device"}</li>
    <li>${policy}</li>
    <li>${isRTL ? "مدة الصيانة تعتمد على نوع العطل وتوفر القطع" : "Repair time depends on issue type and parts availability"}</li>
    <li>${isRTL ? "سيتم التواصل معكم عند الانتهاء" : "We will contact you when ready"}</li>
    <li>${isRTL ? "الأجهزة غير المستلمة خلال 30 يوم لا نتحمل مسؤوليتها" : "We are not responsible for devices not collected within 30 days"}</li>
  `;
}
