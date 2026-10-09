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

/** For approved WhatsApp templates (param 4 / notes — no newlines). */
export const REPAIR_POLICY_WHATSAPP_TEXT =
  "سياسة الصيانة: أقل من 25000 د.ع بدون اتصال. رفض بعد التشخيص 10000 د.ع. المدة 24-48 ساعة. احتفظ بالإيصال. غير المستلم خلال 30 يوماً على مسؤوليتكم. شكراً لزيارتكم.";

const VOICE_OGG_REL = path.join("data", "whatsapp", "repair-policy-ar.ogg");
const VOICE_MP3_REL = path.join("data", "whatsapp", "repair-policy-ar.mp3");

function voiceFileCandidates(relative: string): string[] {
  return [
    path.join(process.cwd(), relative),
    path.join("/home/deploy/AinComputerStore", relative),
  ];
}

export function resolveRepairPolicyVoiceOggPath(): string | null {
  for (const p of voiceFileCandidates(VOICE_OGG_REL)) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function resolveRepairPolicyVoiceMp3Path(): string | null {
  const fromEnv = process.env.WHATSAPP_REPAIR_POLICY_VOICE_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  for (const p of voiceFileCandidates(VOICE_MP3_REL)) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Prefer OGG/Opus (required for native voice notes); MP3 is fallback audio. */
export function resolveRepairPolicyVoiceFilePath(): string | null {
  return resolveRepairPolicyVoiceOggPath() ?? resolveRepairPolicyVoiceMp3Path();
}

export function isRepairPolicyVoiceEnabled(): boolean {
  if (process.env.WHATSAPP_REPAIR_POLICY_VOICE === "0") return false;
  return true;
}
