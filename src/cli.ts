import { createCanvas } from "@napi-rs/canvas";
import { Command } from "commander";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import { ARENA_H, ARENA_W, FPS } from "./engine/loop.js";
import { preloadNodeAvatarImages } from "./games/cowboy-ghost/avatar-images.node.js";
import {
  DEFAULT_GAME_ID,
  requireGameDefinition,
} from "./games/registry.js";
import { createRecorder } from "./record/ffmpeg.js";

const program = new Command();
program
  .option("-g, --game <id>", "Game id", DEFAULT_GAME_ID)
  .option("-s, --seed <n>", "RNG seed", "1")
  .option("-o, --out <path>", "Output MP4 path")
  .parse();

const opts = program.opts<{ game: string; seed: string; out?: string }>();
const gameDef = requireGameDefinition(opts.game);
const seed = Number.parseInt(opts.seed, 10) || 1;
const outPath = opts.out ?? `output/${gameDef.outputFileName(seed)}`;

await mkdir(dirname(outPath) || ".", { recursive: true });
await preloadNodeAvatarImages();

const canvas = createCanvas(ARENA_W, ARENA_H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const game = gameDef.create(seed);
const recorder = createRecorder(outPath, FPS, ARENA_W, ARENA_H);

const t0 = Date.now();
let frameCount = 0;
while (!game.isDone()) {
  game.step();
  game.render(ctx);
  recorder.writeFrame(canvas.toBuffer("image/png"));
  frameCount += 1;
}
await recorder.finish({ events: game.soundEvents, frameCount, fps: FPS });

const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
console.log(
  `game=${gameDef.id} seed=${seed} ${gameDef.describeResult(game)} elapsed=${elapsed}s → ${outPath}`,
);
