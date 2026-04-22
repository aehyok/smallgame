export type FighterKind = "cowboy" | "ghost";

export interface FighterStats {
  maxHp: number;
  radius: number;
  accel: number;
  maxSpeed: number;
  friction: number;
  bounce: number;
  preferredRange: number;
  attackRange: number;
  attackMin: number;
  attackMax: number;
  cooldownMin: number;
  cooldownMax: number;
  bulletSpeed: number;
  bulletLife: number;
  aimJitter: number;
}

export interface Fighter {
  kind: FighterKind;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  facing: number;
  attackCooldown: number;
  alive: boolean;
  hitFlash: number;
  attackFlash: number;
  steerSign: number;
  steerTimer: number;
  stats: FighterStats;
}

export interface DamageText {
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Bullet {
  owner: FighterKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
}

export const FIGHTER_STATS: Record<FighterKind, FighterStats> = {
  cowboy: {
    maxHp: 2600,
    radius: 28,
    accel: 3600,
    maxSpeed: 300,
    friction: 0.965,
    bounce: 0.88,
    preferredRange: 300,
    attackRange: 430,
    attackMin: 115,
    attackMax: 150,
    cooldownMin: 32,
    cooldownMax: 42,
    bulletSpeed: 980,
    bulletLife: 38,
    aimJitter: 0.045,
  },
  ghost: {
    maxHp: 2600,
    radius: 26,
    accel: 4200,
    maxSpeed: 340,
    friction: 0.972,
    bounce: 0.9,
    preferredRange: 255,
    attackRange: 380,
    attackMin: 78,
    attackMax: 108,
    cooldownMin: 23,
    cooldownMax: 31,
    bulletSpeed: 1040,
    bulletLife: 34,
    aimJitter: 0.035,
  },
};

export function createFighter(
  kind: FighterKind,
  x: number,
  y: number,
): Fighter {
  const stats = FIGHTER_STATS[kind];
  return {
    kind,
    label: kind === "cowboy" ? "Trump" : "Musk",
    x,
    y,
    vx: 0,
    vy: 0,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    radius: stats.radius,
    facing: kind === "cowboy" ? 0 : Math.PI,
    attackCooldown: 0,
    alive: true,
    hitFlash: 0,
    attackFlash: 0,
    steerSign: kind === "cowboy" ? 1 : -1,
    steerTimer: 0,
    stats,
  };
}
