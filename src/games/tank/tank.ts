export type Team = "red" | "blue";
export type Role = "light" | "medium" | "heavy";
export type WeaponKind = "std" | "rocket";

export interface RoleStats {
  radius: number;
  maxHp: number;
  speed: number;
  bodyRotSpeed: number;
  turretRotSpeed: number;
  fireCooldown: number;
  bulletKind: WeaponKind;
  bulletDamage: number;
  bulletSpeed: number;
  bulletLife: number;
  aoeRadius: number;
}

// Step 1 uses identical medium numbers for all roles so framework changes
// can be validated without behavior drift. Step 3 splits these per design.
const MEDIUM_STATS: RoleStats = {
  radius: 26,
  maxHp: 100,
  speed: 95,
  bodyRotSpeed: 1.9,
  turretRotSpeed: 3.0,
  fireCooldown: 38,
  bulletKind: "std",
  bulletDamage: 22,
  bulletSpeed: 430,
  bulletLife: 150,
  aoeRadius: 0,
};

export const ROLE_STATS: Record<Role, RoleStats> = {
  light: MEDIUM_STATS,
  medium: MEDIUM_STATS,
  heavy: MEDIUM_STATS,
};

export type PlanTag = "push" | "support";

export interface Tank {
  id: number;
  team: Team;
  role: Role;
  name: string;
  stats: RoleStats;

  x: number;
  y: number;
  vx: number;
  vy: number;
  bodyAngle: number;
  turretAngle: number;

  hp: number;
  maxHp: number;
  shieldHp: number;
  speedBoostTicks: number;
  ammoUpgradeShots: number;
  fireCooldown: number;
  hitFlash: number;

  strafeDir: 1 | -1;
  strafeFlipAt: number;
  aimNoise: number;

  path: { cx: number; cy: number }[];
  pathIndex: number;
  pathRebuildAt: number;
  planTag: PlanTag;
}

export function createTank(
  id: number,
  team: Team,
  role: Role,
  name: string,
  x: number,
  y: number,
  bodyAngle: number,
  planTag: PlanTag,
): Tank {
  const stats = ROLE_STATS[role];
  return {
    id,
    team,
    role,
    name,
    stats,
    x,
    y,
    vx: 0,
    vy: 0,
    bodyAngle,
    turretAngle: bodyAngle,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    shieldHp: 0,
    speedBoostTicks: 0,
    ammoUpgradeShots: 0,
    fireCooldown: 0,
    hitFlash: 0,
    strafeDir: 1,
    strafeFlipAt: 0,
    aimNoise: 0,
    path: [],
    pathIndex: 0,
    pathRebuildAt: 0,
    planTag,
  };
}
