import { createCanvas } from "@napi-rs/canvas";
import { Command } from "commander";
import { mkdir } from "fs/promises";
import { ARENA_H, ARENA_W, FPS } from "./engine/loop.js";
import {
  DEFAULT_GAME_ID,
  requireGameDefinition,
} from "./games/registry.js";
import { createRecorder } from "./record/ffmpeg.js";

const program = new Command();
program
  .option("-g, --game <id>", "Game id", DEFAULT_GAME_ID)
  .option("--from <n>", "start seed (inclusive)", "1")
  .option("--to <n>", "end seed (inclusive)", "10")
  .option("--dir <path>", "output directory", "output")
  .parse();

const opts = program.opts<{
  game: string;
  from: string;
  to: string;
  dir: string;
}>();
const gameDef = requireGameDefinition(opts.game);
const from = Number.parseInt(opts.from, 10);
const to = Number.parseInt(opts.to, 10);
const dir = opts.dir;
await mkdir(dir, { recursive: true });

const canvas = createCanvas(ARENA_W, ARENA_H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

const overallStart = Date.now();
for (let seed = from; seed <= to; seed++) {
  const outPath = `${dir}/${gameDef.outputFileName(seed)}`;
  const game = gameDef.create(seed);
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
    `[${gameDef.id}:${seed}] ${gameDef.describeResult(game)} time=${sec}s → ${outPath}`,
  );
}
console.log(
  `batch done: game=${gameDef.id} count=${to - from + 1} videos in ${((Date.now() - overallStart) / 1000).toFixed(2)}s`,
);
