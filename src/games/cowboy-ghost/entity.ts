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
  // Buffs
  shieldHp: number;
  rageTicks: number;
  speedBoostTicks: number;
  bigTicks: number;
  tinyTicks: number;
  drunkTicks: number;
  scaleMultiplier: number;
  // Skill
  skillCooldown: number;
  skillActive: number;
  dashVx: number;
  dashVy: number;
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

export interface DeathParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type PowerUpKind = "heal" | "rage" | "shield" | "speed" | "big" | "tiny" | "swap" | "drunk";

export interface PowerUp {
  kind: PowerUpKind;
  x: number;
  y: number;
  radius: number;
  age: number;
}

export interface PickupEffect {
  x: number;
  y: number;
  label: string;
  color: string;
  age: number;
  maxAge: number;
}

export const POWERUP_CONFIG: Record<PowerUpKind, { label: string; color: string; glow: string }> = {
  heal:   { label: "+HP",    color: "#44ff88", glow: "#22cc66" },
  rage:   { label: "RAGE!",  color: "#ff4444", glow: "#cc2222" },
  shield: { label: "SHIELD", color: "#44aaff", glow: "#2266cc" },
  speed:  { label: "SPEED!", color: "#ffdd44", glow: "#ccaa22" },
  big:    { label: "BIG!",   color: "#ff88ff", glow: "#cc44cc" },
  tiny:   { label: "TINY!",  color: "#88ffcc", glow: "#44cc88" },
  swap:   { label: "SWAP!",  color: "#ffaa44", glow: "#cc7722" },
  drunk:  { label: "DRUNK!", color: "#cc88ff", glow: "#8844cc" },
};

export interface Wall {
  owner: FighterKind;
  x: number;
  y: number;
  angle: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  life: number;
}

export interface FlameTrail {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
  damage: number;
  owner: FighterKind;
  hasDamaged: Set<Fighter>;
}

export const SKILL_CONFIG = {
  cowboy: {
    name: "BUILD WALL",
    cooldown: 8 * 60,
    wallWidth: 120,
    wallHeight: 20,
    wallHp: 800,
    wallDuration: 3 * 60,
  },
  ghost: {
    name: "ROCKET DASH",
    cooldown: 6 * 60,
    dashSpeed: 900,
    dashDuration: 12,
    flameDamage: 120,
    flameRadius: 30,
    flameLife: 20,
  },
} as const;

export interface Commentary {
  text: string;
  x: number;
  y: number;
  vx: number;
  color: string;
  age: number;
  maxAge: number;
  size: number;
}

export type ObstacleShape = "firewall" | "spikeball";

export interface Obstacle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  shape: ObstacleShape;
  damage: number;
  life: number;
  maxLife: number;
  // Optional params for specific obstacle types
  length?: number;
  baseY?: number;
  phase?: number;
  hitCooldowns: Map<Fighter, number>;
}

export interface KOEffect {
  x: number;
  y: number;
  label: string;
  color: string;
  age: number;
  maxAge: number;
}

export function createFighter(
  kind: FighterKind,
  x: number,
  y: number,
  label?: string,
): Fighter {
  const stats = FIGHTER_STATS[kind];
  return {
    kind,
    label: label ?? (kind === "cowboy" ? "Trump" : "Musk"),
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
    shieldHp: 0,
    rageTicks: 0,
    speedBoostTicks: 0,
    bigTicks: 0,
    tinyTicks: 0,
    drunkTicks: 0,
    scaleMultiplier: 1,
    skillCooldown: 60 * 3,
    skillActive: 0,
    dashVx: 0,
    dashVy: 0,
  };
}
