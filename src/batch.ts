import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { Command } from "commander";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { ARENA_H, ARENA_W, FPS } from "./engine/loop.js";
import { preloadNodeAvatarImages } from "./games/cowboy-ghost/avatar-images.node.js";

const CJK_FONT_PATHS = [
  "C:\\Windows\\Fonts\\msyh.ttc",
  "C:\\Windows\\Fonts\\simhei.ttf",
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
  "/System/Library/Fonts/PingFang.ttc",
];
for (const fp of CJK_FONT_PATHS) {
  if (existsSync(fp)) {
    GlobalFonts.registerFromPath(fp, "CJK");
    break;
  }
}
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
  .option("-c, --count <n>", "Team size (cowboy-ghost: N vs N)", "1")
  .parse();

const opts = program.opts<{
  game: string;
  from: string;
  to: string;
  dir: string;
  count: string;
}>();
const gameDef = requireGameDefinition(opts.game);
const from = Number.parseInt(opts.from, 10);
const to = Number.parseInt(opts.to, 10);
const dir = opts.dir;
const count = Math.max(1, Number.parseInt(opts.count, 10) || 1);
const gameOptions = { count };
await mkdir(dir, { recursive: true });
await preloadNodeAvatarImages();

const canvas = createCanvas(ARENA_W, ARENA_H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

const overallStart = Date.now();
for (let seed = from; seed <= to; seed++) {
  const outPath = `${dir}/${gameDef.outputFileName(seed, gameOptions)}`;
  const game = gameDef.create(seed, gameOptions);
  const rec = createRecorder(outPath, FPS, ARENA_W, ARENA_H);
  const t0 = Date.now();
  let frameCount = 0;
  while (!game.isDone()) {
    game.step();
    game.render(ctx);
    rec.writeFrame(canvas.toBuffer("image/png"));
    frameCount += 1;
  }
  await rec.finish({ events: game.soundEvents, frameCount, fps: FPS });
  const sec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(
    `[${gameDef.id}:${seed}] ${gameDef.describeResult(game)} time=${sec}s → ${outPath}`,
  );
}
console.log(
  `batch done: game=${gameDef.id} count=${to - from + 1} videos in ${((Date.now() - overallStart) / 1000).toFixed(2)}s`,
);
