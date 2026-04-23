import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import type { SoundKind } from "./events.js";

const FF_PATH = (ffmpegStatic as unknown as string) || "ffmpeg";
const ASSETS_DIR = resolve("public");

export const SFX_PATHS: Record<SoundKind, string> = {
  shot: `${ASSETS_DIR}/sfx/shot.wav`,
  impact: `${ASSETS_DIR}/sfx/impact.wav`,
  boom: `${ASSETS_DIR}/sfx/boom.wav`,
  fanfare: `${ASSETS_DIR}/sfx/fanfare.wav`,
};

export const BGM_PATH = `${ASSETS_DIR}/bgm/bgm.wav`;

interface SynthSpec {
  path: string;
  args: string[];
}

const SPECS: SynthSpec[] = [
  {
    path: SFX_PATHS.shot,
    args: [
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=white:amplitude=1.0:duration=0.25",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=60:duration=0.25",
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=brown:amplitude=0.6:duration=0.25",
      "-filter_complex",
      "[0]afade=t=out:st=0.008:d=0.04,highpass=f=800,volume=1.8[crack];[1]afade=t=out:st=0.01:d=0.12,volume=1.6[thump];[2]afade=t=in:st=0:d=0.005,afade=t=out:st=0.02:d=0.18,lowpass=f=400,volume=0.5[tail];[crack][thump][tail]amix=inputs=3:normalize=0,alimiter=limit=0.95",
      "-t",
      "0.25",
      "-ac",
      "2",
      "-ar",
      "48000",
    ],
  },
  {
    path: SFX_PATHS.impact,
    args: [
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=white:amplitude=0.9:duration=0.15",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=2200:duration=0.15",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=120:duration=0.15",
      "-filter_complex",
      "[0]afade=t=out:st=0.003:d=0.03,bandpass=f=3000:width_type=o:w=2,volume=1.2[zing];[1]afade=t=out:st=0.01:d=0.08,volume=0.4[ring];[2]afade=t=out:st=0.02:d=0.10,volume=0.7[thud];[zing][ring][thud]amix=inputs=3:normalize=0,alimiter=limit=0.95",
      "-t",
      "0.15",
      "-ac",
      "2",
      "-ar",
      "48000",
    ],
  },
  {
    path: SFX_PATHS.boom,
    args: [
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=brown:amplitude=1.0:duration=0.8",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=40:duration=0.8",
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=white:amplitude=0.8:duration=0.8",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=25:duration=0.8",
      "-filter_complex",
      "[0]afade=t=out:st=0.04:d=0.5,lowpass=f=300,volume=1.4[rumble];[1]afade=t=out:st=0.02:d=0.6,volume=1.8[sub];[2]afade=t=out:st=0.002:d=0.05,highpass=f=1000,volume=1.0[crack];[3]afade=t=out:st=0.3:d=0.5,volume=0.6[bass];[rumble][sub][crack][bass]amix=inputs=4:normalize=0,afade=t=out:st=0.3:d=0.5,alimiter=limit=0.95",
      "-t",
      "0.8",
      "-ac",
      "2",
      "-ar",
      "48000",
    ],
  },
  {
    path: SFX_PATHS.fanfare,
    args: [
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=523:duration=0.18",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=659:duration=0.18",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=784:duration=0.36",
      "-filter_complex",
      "[0]adelay=0|0[a];[1]adelay=180|180[b];[2]adelay=360|360[c];[a][b][c]amix=inputs=3:normalize=0,afade=t=out:st=0.6:d=0.12,volume=0.9",
      "-t",
      "0.75",
      "-ac",
      "2",
      "-ar",
      "48000",
    ],
  },
  {
    path: BGM_PATH,
    args: [
      "-f",
      "lavfi",
      "-i",
      // Kick drum pattern: 4 hits per second (240bpm eighth notes)
      "anoisesrc=color=brown:amplitude=1.0:duration=60",
      "-f",
      "lavfi",
      "-i",
      // Sub bass pulse
      "sine=frequency=55:duration=60",
      "-f",
      "lavfi",
      "-i",
      // Hi-hat tick
      "anoisesrc=color=white:amplitude=0.6:duration=60",
      "-f",
      "lavfi",
      "-i",
      // Dark pad A2
      "sine=frequency=110:duration=60",
      "-f",
      "lavfi",
      "-i",
      // Tension fifth E3
      "sine=frequency=165:duration=60",
      "-filter_complex",
      // Kick: short envelope pulsed at ~3.33Hz (200bpm), low-passed
      "[0]lowpass=f=120,volume=0.9,apulsator=mode=sine:hz=3.33:amount=1:offset_l=0:offset_r=0[kick];" +
      // Sub bass: tremolo synced with kick
      "[1]volume=0.5,tremolo=f=3.33:d=0.7[sub];" +
      // Hi-hat: high-passed, fast pulse at 6.66Hz (offbeat)
      "[2]highpass=f=6000,volume=0.15,apulsator=mode=sine:hz=6.66:amount=0.9:offset_l=0.5:offset_r=0.5[hat];" +
      // Pad: slow tremolo for movement
      "[3]volume=0.12,tremolo=f=0.5:d=0.3[pad];" +
      // Tension note
      "[4]volume=0.08,tremolo=f=0.25:d=0.5[ten];" +
      // Mix all
      "[kick][sub][hat][pad][ten]amix=inputs=5:normalize=0,alimiter=limit=0.95,volume=0.7",
      "-t",
      "60",
      "-ac",
      "2",
      "-ar",
      "48000",
    ],
  },
];

async function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(
      FF_PATH,
      ["-y", "-hide_banner", "-loglevel", "error", ...args],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg exit ${code}`));
    });
  });
}

let ensured: Promise<void> | null = null;

export function ensureAudioAssets(): Promise<void> {
  if (ensured) return ensured;
  ensured = (async () => {
    const missing = SPECS.filter((s) => !existsSync(s.path));
    if (missing.length === 0) return;
    console.log(`[audio] generating ${missing.length} placeholder asset(s)...`);
    for (const spec of missing) {
      await mkdir(dirname(spec.path), { recursive: true });
      await runFfmpeg([...spec.args, spec.path]);
    }
  })();
  return ensured;
}
