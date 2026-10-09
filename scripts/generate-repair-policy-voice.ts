/**
 * Generates data/whatsapp/repair-policy-ar.mp3 + repair-policy-ar.ogg (Opus voice note).
 * Run: npm run generate:repair-policy-voice
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { REPAIR_POLICY_VOICE_SCRIPT_AR } from "../server/repair-policy-voice";

const OUT_DIR = path.join(process.cwd(), "data", "whatsapp");
const MP3_FILE = path.join(OUT_DIR, "repair-policy-ar.mp3");
const OGG_FILE = path.join(OUT_DIR, "repair-policy-ar.ogg");

async function synthesizeMp3() {
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
  fs.writeFileSync(MP3_FILE, Buffer.concat(chunks));
  console.log(`Wrote ${MP3_FILE} (${fs.statSync(MP3_FILE).size} bytes)`);
}

function mp3ToOggOpus() {
  const ffmpeg = ffmpegStatic;
  if (!ffmpeg) {
    throw new Error("ffmpeg-static binary missing");
  }
  execFileSync(
    ffmpeg,
    [
      "-y",
      "-i",
      MP3_FILE,
      "-c:a",
      "libopus",
      "-b:a",
      "32k",
      "-ac",
      "1",
      "-application",
      "voip",
      OGG_FILE,
    ],
    { stdio: "inherit" },
  );
  console.log(`Wrote ${OGG_FILE} (${fs.statSync(OGG_FILE).size} bytes)`);
}

async function main() {
  await synthesizeMp3();
  mp3ToOggOpus();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
