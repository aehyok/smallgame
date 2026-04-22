import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import type { SoundKind } from "./events.js";

const FF_PATH = (ffmpegStatic as unknown as string) || "ffmpeg";
const ASSETS_DIR = resolve("assets");

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
      "anoisesrc=color=brown:amplitude=0.8:duration=0.14",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=72:duration=0.14",
      "-filter_complex",
      "[0][1]amix=inputs=2:normalize=0,afade=t=out:st=0.03:d=0.11,volume=1.2",
      "-t",
      "0.14",
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
      "sine=frequency=1400:duration=0.07",
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=white:amplitude=0.4:duration=0.07",
      "-filter_complex",
      "[0][1]amix=inputs=2:normalize=0,afade=t=out:st=0.015:d=0.055,volume=0.9",
      "-t",
      "0.07",
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
      "anoisesrc=color=brown:amplitude=1.0:duration=0.6",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=55:duration=0.6",
      "-filter_complex",
      "[0][1]amix=inputs=2:normalize=0,afade=t=in:st=0:d=0.02,afade=t=out:st=0.15:d=0.45,volume=1.1",
      "-t",
      "0.6",
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
      "sine=frequency=110:duration=60",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=165:duration=60",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=60",
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=pink:amplitude=0.05:duration=60",
      "-filter_complex",
      "[0]volume=0.18,tremolo=f=0.25:d=0.4[a];[1]volume=0.10[b];[2]volume=0.07[c];[3]volume=0.5[d];[a][b][c][d]amix=inputs=4:normalize=0,volume=0.6",
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
