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

export const FIGHTER_STATS: Record<FighterKind, FighterStats> = {
  cowboy: {
    maxHp: 2200,
    radius: 28,
    accel: 3600,
    maxSpeed: 300,
    friction: 0.965,
    bounce: 0.88,
    preferredRange: 170,
    attackRange: 190,
    attackMin: 170,
    attackMax: 220,
    cooldownMin: 60,
    cooldownMax: 78,
  },
  ghost: {
    maxHp: 2200,
    radius: 26,
    accel: 4200,
    maxSpeed: 340,
    friction: 0.972,
    bounce: 0.9,
    preferredRange: 52,
    attackRange: 78,
    attackMin: 6,
    attackMax: 10,
    cooldownMin: 6,
    cooldownMax: 9,
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
