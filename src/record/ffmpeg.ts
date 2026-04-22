import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { unlink } from "fs/promises";
import { ensureAudioAssets } from "../audio/assets.js";
import { planAudioMux } from "../audio/compose.js";
import type { SoundEvent } from "../audio/events.js";

export interface RecorderOptions {
  mute?: boolean;
}

export interface RecorderFinishInput {
  events: SoundEvent[];
  frameCount: number;
  fps: number;
}

export interface Recorder {
  writeFrame(buf: Buffer): void;
  finish(input?: RecorderFinishInput): Promise<void>;
}

const FF_PATH = (ffmpegStatic as unknown as string) || "ffmpeg";

export function createRecorder(
  outPath: string,
  fps: number,
  _width: number,
  _height: number,
  options: RecorderOptions = {},
): Recorder {
  const mute = options.mute ?? false;
  const silentPath = mute ? outPath : `${outPath}.video.tmp.mp4`;

  const videoArgs = [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "image2pipe",
    "-framerate",
    String(fps),
    "-i",
    "-",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    silentPath,
  ];

  const proc = spawn(FF_PATH, videoArgs, {
    stdio: ["pipe", "inherit", "inherit"],
  });

  let stdinClosed = false;
  proc.stdin.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") return;
    console.error("ffmpeg stdin error:", err);
  });
  proc.stdin.on("close", () => {
    stdinClosed = true;
  });

  const videoDone = new Promise<void>((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg (video pass) exited with code ${code}`));
    });
  });

  return {
    writeFrame(buf: Buffer) {
      if (stdinClosed) return;
      proc.stdin.write(buf);
    },
    async finish(input?: RecorderFinishInput) {
      if (!stdinClosed) proc.stdin.end();
      await videoDone;

      if (mute) return;
      if (!input) {
        // No audio info provided — leave silent tmp as final output
        await renameFile(silentPath, outPath);
        return;
      }

      await ensureAudioAssets();
      const duration = input.frameCount / input.fps;
      const plan = planAudioMux(input.events, input.fps, duration);
      await runMuxPass(silentPath, outPath, plan, duration);
      await unlink(silentPath).catch(() => {});
    },
  };
}

async function renameFile(from: string, to: string) {
  const { rename } = await import("fs/promises");
  await rename(from, to);
}

async function runMuxPass(
  videoPath: string,
  outPath: string,
  plan: { inputs: string[]; filterComplex: string; audioLabel: string },
  durationSeconds: number,
): Promise<void> {
  const args: string[] = ["-y", "-loglevel", "error", "-i", videoPath];
  for (const inputPath of plan.inputs) {
    args.push("-i", inputPath);
  }
  args.push(
    "-filter_complex",
    plan.filterComplex,
    "-map",
    "0:v",
    "-map",
    plan.audioLabel,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-t",
    durationSeconds.toFixed(3),
    "-movflags",
    "+faststart",
    outPath,
  );

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(FF_PATH, args, {
      stdio: ["ignore", "inherit", "inherit"],
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg (mux pass) exited with code ${code}`));
    });
  });
}
