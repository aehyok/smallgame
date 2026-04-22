import type { Tank, Team, WeaponKind } from "./tank.js";

export interface Bullet {
  id: number;
  ownerId: number;
  team: Team;
  kind: WeaponKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  damage: number;
  aoeRadius: number;
  pierce: boolean;
}

export const BULLET_RADIUS = 4;

export function spawnBullet(
  id: number,
  owner: Tank,
  x: number,
  y: number,
  angle: number,
): Bullet {
  const s = owner.stats;
  return {
    id,
    ownerId: owner.id,
    team: owner.team,
    kind: s.bulletKind,
    x,
    y,
    vx: Math.cos(angle) * s.bulletSpeed,
    vy: Math.sin(angle) * s.bulletSpeed,
    life: s.bulletLife,
    age: 0,
    damage: s.bulletDamage,
    aoeRadius: s.aoeRadius,
    pierce: false,
  };
}
