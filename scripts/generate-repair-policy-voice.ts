/**
 * Generates data/whatsapp/repair-policy-ar.mp3 (Arabic TTS).
 * Run: npx tsx scripts/generate-repair-policy-voice.ts
 */
import fs from "fs";
import path from "path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { REPAIR_POLICY_VOICE_SCRIPT_AR } from "../server/repair-policy-voice";

const OUT_DIR = path.join(process.cwd(), "data", "whatsapp");
const OUT_FILE = path.join(OUT_DIR, "repair-policy-ar.mp3");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    "ar-IQ-RanaNeural",
    OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
  );
  const { audioStream } = tts.toStream(REPAIR_POLICY_VOICE_SCRIPT_AR);
  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) {
    chunks.push(Buffer.from(chunk));
  }
  fs.writeFileSync(OUT_FILE, Buffer.concat(chunks));
  console.log(`Wrote ${OUT_FILE} (${fs.statSync(OUT_FILE).size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
