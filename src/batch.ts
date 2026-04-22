import { createCanvas } from "@napi-rs/canvas";
import { Command } from "commander";
import { mkdir } from "fs/promises";
import { ARENA_H, ARENA_W, FPS } from "./engine/loop.js";
import { TankGame } from "./games/tank/game.js";
import { createRecorder } from "./record/ffmpeg.js";

const program = new Command();
program
  .option("--from <n>", "start seed (inclusive)", "1")
  .option("--to <n>", "end seed (inclusive)", "10")
  .option("--dir <path>", "output directory", "output")
  .parse();

const opts = program.opts<{ from: string; to: string; dir: string }>();
const from = Number.parseInt(opts.from, 10);
const to = Number.parseInt(opts.to, 10);
const dir = opts.dir;
await mkdir(dir, { recursive: true });

const canvas = createCanvas(ARENA_W, ARENA_H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

const overallStart = Date.now();
for (let seed = from; seed <= to; seed++) {
  const outPath = `${dir}/battle-${seed}.mp4`;
  const game = new TankGame(seed);
  const rec = createRecorder(outPath, FPS, ARENA_W, ARENA_H);
  const t0 = Date.now();
  while (!game.isDone()) {
    game.step();
    game.render(ctx);
    rec.writeFrame(canvas.toBuffer("image/png"));
  }
  await rec.finish();
  const sec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(
    `[${seed}] winner=${game.outcome?.winner ?? "?"} time=${sec}s → ${outPath}`,
  );
}
console.log(
  `batch done: ${to - from + 1} videos in ${((Date.now() - overallStart) / 1000).toFixed(2)}s`,
);
