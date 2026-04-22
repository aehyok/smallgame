import type { Rng } from "../../engine/rng.js";
import { clamp } from "../../engine/vec.js";
import type { Bullet } from "./bullet.js";
import type { Tank } from "./tank.js";

export interface AIIntent {
  bodyAngleTarget: number;
  turretAngleTarget: number;
  throttle: number;
  fire: boolean;
}

export function decide(
  self: Tank,
  enemy: Tank,
  bullets: readonly Bullet[],
  tick: number,
  rng: Rng,
): AIIntent {
  const dx = enemy.x - self.x;
  const dy = enemy.y - self.y;
  const distToEnemy = Math.hypot(dx, dy);
  const toEnemy = Math.atan2(dy, dx);

  if (tick >= self.strafeFlipAt) {
    self.strafeDir = (self.strafeDir === 1 ? -1 : 1) as 1 | -1;
    self.strafeFlipAt = tick + 55 + rng.int(25, 120);
  }

  let threatAngle: number | null = null;
  let threatDist = Infinity;
  for (const b of bullets) {
    if (b.team === self.team) continue;
    const bSpeed = Math.hypot(b.vx, b.vy);
    if (bSpeed === 0) continue;
    const bDirX = b.vx / bSpeed;
    const bDirY = b.vy / bSpeed;
    const relX = self.x - b.x;
    const relY = self.y - b.y;
    const forward = relX * bDirX + relY * bDirY;
    if (forward <= 0 || forward > 420) continue;
    const perp = Math.abs(-bDirY * relX + bDirX * relY);
    if (perp < 50 && forward < threatDist) {
      threatDist = forward;
      threatAngle = Math.atan2(b.vy, b.vx);
    }
  }

  let bodyAngleTarget: number;
  let throttle = 1;
  if (threatAngle !== null) {
    bodyAngleTarget = threatAngle + (Math.PI / 2) * self.strafeDir;
    throttle = 1;
  } else if (distToEnemy > 440) {
    bodyAngleTarget = toEnemy + 0.3 * self.strafeDir;
    throttle = 1;
  } else if (distToEnemy < 210) {
    bodyAngleTarget = toEnemy + Math.PI - 0.35 * self.strafeDir;
    throttle = 0.85;
  } else {
    bodyAngleTarget = toEnemy + (Math.PI / 2 - 0.1) * self.strafeDir;
    throttle = 0.9;
  }

  self.aimNoise = clamp(self.aimNoise + rng.range(-0.04, 0.04), -0.09, 0.09);

  const lead = 0.3;
  const predictedX = enemy.x + enemy.vx * lead;
  const predictedY = enemy.y + enemy.vy * lead;
  const turretAngleTarget =
    Math.atan2(predictedY - self.y, predictedX - self.x) + self.aimNoise;

  const turretDiff = normalizeAngle(turretAngleTarget - self.turretAngle);
  const fire =
    self.fireCooldown <= 0 &&
    Math.abs(turretDiff) < 0.09 &&
    distToEnemy < 780;

  return { bodyAngleTarget, turretAngleTarget, throttle, fire };
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
