import { ARENA_H, ARENA_W } from "../../engine/loop.js";
import type { Rng } from "../../engine/rng.js";
import type { Obstacle } from "./obstacle.js";

const DESTRUCTIBLE_HP = 50;
const INDESTRUCTIBLE_PROB = 0.3;
const UPPER_Y_MIN = 320;
const UPPER_Y_MAX = 620;
const SPAWN_MARGIN = 40; // keep obstacles away from spawn zones
const MIN_GAP = 26;      // min spacing between obstacles

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsOverlap(a: Rect, b: Rect, gap: number): boolean {
  return !(
    a.x + a.w + gap < b.x ||
    b.x + b.w + gap < a.x ||
    a.y + a.h + gap < b.y ||
    b.y + b.h + gap < a.y
  );
}

function mirror(r: Rect): Rect {
  return {
    x: ARENA_W - r.x - r.w,
    y: ARENA_H - r.y - r.h,
    w: r.w,
    h: r.h,
  };
}

export function generateMap(rng: Rng, mintId: () => number): Obstacle[] {
  const count = 4 + rng.int(0, 2); // 4..6
  const placed: Rect[] = [];
  const flags: boolean[] = []; // destructible flags per placed upper-half rect

  for (let i = 0; i < count; i++) {
    let success = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      const w = Math.round(rng.range(60, 120));
      const h = Math.round(rng.range(50, 100));
      const x = Math.round(
        rng.range(SPAWN_MARGIN, ARENA_W - SPAWN_MARGIN - w),
      );
      const y = Math.round(rng.range(UPPER_Y_MIN, UPPER_Y_MAX - h));
      const candidate: Rect = { x, y, w, h };

      // must not overlap any already-placed upper rect OR its mirror
      let clash = false;
      for (let k = 0; k < placed.length; k++) {
        const p = placed[k];
        if (rectsOverlap(candidate, p, MIN_GAP) ||
            rectsOverlap(candidate, mirror(p), MIN_GAP)) {
          clash = true;
          break;
        }
      }
      // must not clash with its own mirror (keep a corridor through center)
      if (!clash && rectsOverlap(candidate, mirror(candidate), MIN_GAP)) {
        clash = true;
      }
      if (clash) continue;

      placed.push(candidate);
      flags.push(rng.next() >= INDESTRUCTIBLE_PROB);
      success = true;
      break;
    }
    if (!success) break;
  }

  const obstacles: Obstacle[] = [];
  for (let i = 0; i < placed.length; i++) {
    const r = placed[i];
    const destructible = flags[i];
    const hp = destructible ? DESTRUCTIBLE_HP : Number.POSITIVE_INFINITY;
    obstacles.push({
      id: mintId(),
      x: r.x, y: r.y, w: r.w, h: r.h,
      hp, maxHp: hp,
    });
    const m = mirror(r);
    obstacles.push({
      id: mintId(),
      x: m.x, y: m.y, w: m.w, h: m.h,
      hp, maxHp: hp,
    });
  }

  return obstacles;
}
