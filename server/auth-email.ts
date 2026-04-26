/** Normalize customer email for storage and lookup (avoids case/whitespace mismatches on login). */
export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase();
}
