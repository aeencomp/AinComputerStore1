export const REPAIR_RECEIPT_UNDER_25K_POLICY_AR =
  "أي صيانة ما دون 25000 يتم الصيانة بدون الإتصال على الزبون";

/** Shared policy lines for thermal repair intake receipts. */
export function repairReceiptUnder25kPolicyLine(isRTL: boolean): string {
  return isRTL
    ? REPAIR_RECEIPT_UNDER_25K_POLICY_AR
    : "Repairs under 25,000 IQD will be completed without contacting the customer.";
}

export function repairReceiptPolicyBoxCss(): string {
  return `
    .policy-box {
      margin: 10px 0;
      padding: 8px;
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 900;
      line-height: 1.5;
      text-align: center;
      color: #000;
    }
    .policy-title {
      font-size: 12px;
      font-weight: 900;
      margin-bottom: 4px;
      text-decoration: underline;
    }
  `;
}

export function repairReceiptPolicyBoxHtml(isRTL: boolean): string {
  return `
    <div class="policy-box">
      <div class="policy-title">${isRTL ? "سياسة الصيانة:" : "Repair Policy:"}</div>
      ${repairReceiptUnder25kPolicyLine(isRTL)}
    </div>
  `;
}

export function repairReceiptStandardTermsHtml(isRTL: boolean): string {
  const policy = repairReceiptUnder25kPolicyLine(isRTL);
  return `
    <li>${policy}</li>
    <li>${isRTL ? "يرجى الاحتفاظ بهذا الإيصال لاستلام الجهاز" : "Please keep this receipt to collect your device"}</li>
    <li>${isRTL ? "مدة الصيانة تعتمد على نوع العطل وتوفر القطع" : "Repair time depends on issue type and parts availability"}</li>
    <li>${isRTL ? "سيتم التواصل معكم عند الانتهاء" : "We will contact you when ready"}</li>
    <li>${isRTL ? "الأجهزة غير المستلمة خلال 30 يوم لا نتحمل مسؤوليتها" : "We are not responsible for devices not collected within 30 days"}</li>
  `;
}

export function repairReceiptTermsSectionHtml(isRTL: boolean): string {
  return `
    ${repairReceiptPolicyBoxHtml(isRTL)}
    <div class="terms">
      <div class="terms-title">${isRTL ? "الشروط والأحكام:" : "Terms & Conditions:"}</div>
      <ul class="terms-list">
        ${repairReceiptStandardTermsHtml(isRTL)}
      </ul>
    </div>
  `;
}
