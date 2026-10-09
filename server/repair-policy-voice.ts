import fs from "fs";
import path from "path";

/** Spoken on WhatsApp voice note after repair ticket creation (matches receipt policy). */
export const REPAIR_POLICY_VOICE_SCRIPT_AR =
  "مرحباً من العين لتجارة الحاسبات. سياسة الصيانة: " +
  "أي صيانة ما دون خمسة وعشرين ألف دينار يتم تنفيذها دون الاتصال بكم. " +
  "في حال رفض الصيانة بعد التشخيص، رسوم التشخيص عشرة آلاف دينار. " +
  "مدة إنجاز الصيانة من أربع وعشرين إلى ثمان وأربعين ساعة. " +
  "يرجى الاحتفاظ برقم التذكرة. سيتم التواصل معكم عند الانتهاء. " +
  "الأجهزة غير المستلمة خلال ثلاثين يوماً لا نتحمل مسؤوليتها. " +
  "شكراً لزيارتكم.";

const DEFAULT_REL = path.join("data", "whatsapp", "repair-policy-ar.mp3");

export function resolveRepairPolicyVoiceFilePath(): string | null {
  const fromEnv = process.env.WHATSAPP_REPAIR_POLICY_VOICE_PATH?.trim();
  const candidates = [
    fromEnv,
    path.join(process.cwd(), DEFAULT_REL),
    path.join(process.cwd(), "data", "whatsapp", "repair-policy-ar.ogg"),
    "/home/deploy/AinComputerStore/data/whatsapp/repair-policy-ar.mp3",
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function isRepairPolicyVoiceEnabled(): boolean {
  if (process.env.WHATSAPP_REPAIR_POLICY_VOICE === "0") return false;
  return true;
}
