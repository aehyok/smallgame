import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";

export interface Recorder {
  writeFrame(buf: Buffer): void;
  finish(): Promise<void>;
}

export function createRecorder(
  outPath: string,
  fps: number,
  _width: number,
  _height: number,
): Recorder {
  const ffPath = (ffmpegStatic as unknown as string) || "ffmpeg";

  const args = [
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
    outPath,
  ];

  const proc = spawn(ffPath, args, {
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

  return {
    writeFrame(buf: Buffer) {
      if (stdinClosed) return;
      proc.stdin.write(buf);
    },
    finish() {
      return new Promise<void>((resolve, reject) => {
        proc.on("error", reject);
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}`));
        });
        if (!stdinClosed) proc.stdin.end();
      });
    },
  };
}
