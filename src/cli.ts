import { createCanvas } from "@napi-rs/canvas";
import { Command } from "commander";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import { ARENA_H, ARENA_W, FPS } from "./engine/loop.js";
import { TankGame } from "./games/tank/game.js";
import { createRecorder } from "./record/ffmpeg.js";

const program = new Command();
program
  .option("-s, --seed <n>", "RNG seed", "1")
  .option("-o, --out <path>", "Output MP4 path")
  .parse();

const opts = program.opts<{ seed: string; out?: string }>();
const seed = Number.parseInt(opts.seed, 10) || 1;
const outPath = opts.out ?? `output/battle-${seed}.mp4`;

await mkdir(dirname(outPath) || ".", { recursive: true });

const canvas = createCanvas(ARENA_W, ARENA_H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const game = new TankGame(seed);
const recorder = createRecorder(outPath, FPS, ARENA_W, ARENA_H);

const t0 = Date.now();
while (!game.isDone()) {
  game.step();
  game.render(ctx);
  recorder.writeFrame(canvas.toBuffer("image/png"));
}
await recorder.finish();

const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
const winner = game.outcome?.winner ?? "unknown";
console.log(
  `seed=${seed} winner=${winner} ticks=${game.tick} elapsed=${elapsed}s → ${outPath}`,
);
