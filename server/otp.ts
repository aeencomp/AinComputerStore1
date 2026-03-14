interface OTPEntry {
  otp: string;
  expiresAt: Date;
}

const otpStore = new Map<string, OTPEntry>();

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function storeOTP(key: string, otp: string): void {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  otpStore.set(key, { otp, expiresAt });
}

export function verifyOTP(key: string, otp: string): boolean {
  const entry = otpStore.get(key);
  if (!entry) return false;
  if (new Date() > entry.expiresAt) {
    otpStore.delete(key);
    return false;
  }
  if (entry.otp !== otp) return false;
  otpStore.delete(key);
  return true;
}
