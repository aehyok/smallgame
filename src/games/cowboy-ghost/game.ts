import { pushSound, type SoundEvent } from "../../audio/events.js";
import { DT, ARENA_H, ARENA_W, FPS } from "../../engine/loop.js";
import { createRng, type Rng } from "../../engine/rng.js";
import { clamp } from "../../engine/vec.js";
import {
  createFighter,
  POWERUP_CONFIG,
  SKILL_CONFIG,
  type Bullet,
  type Commentary,
  type DamageText,
  type DeathParticle,
  type Fighter,
  type FighterKind,
  type FlameTrail,
  type KOEffect,
  type PickupEffect,
  type PowerUp,
  type PowerUpKind,
  type Obstacle,
  type ObstacleShape,
  type Wall,
} from "./entity.js";
import { drawGame } from "./render.js";

export const BOUNDS = {
  left: 48,
  top: 180,
  right: ARENA_W - 48,
  bottom: ARENA_H - 180,
};

export const ROUND_SECONDS = 35;
export const ROUND_TICKS = FPS * ROUND_SECONDS;
const OUTRO_TICKS = FPS * 2;

export const INTRO_TICKS = 90;
const KO_FREEZE_TICKS = 24;
const COMBO_WINDOW = 90;

const POWERUP_KINDS: PowerUpKind[] = ["heal", "rage", "shield", "speed", "big", "tiny", "swap", "drunk"];
const POWERUP_FIRST_SPAWN = INTRO_TICKS + FPS * 3;
const POWERUP_INTERVAL_MIN = FPS * 5;
const POWERUP_INTERVAL_MAX = FPS * 8;
const POWERUP_RADIUS = 22;
const SHIELD_AMOUNT = 500;
const RAGE_DURATION = FPS * 3;
const SPEED_DURATION = FPS * 4;
const HEAL_FRACTION = 0.2;
const BIG_DURATION = FPS * 4;
const TINY_DURATION = FPS * 4;
const DRUNK_DURATION = FPS * 3;
const BIG_SCALE = 2.5;
const TINY_SCALE = 0.5;

const SHRINK_START_SECONDS = 25;
const SHRINK_START_TICK = INTRO_TICKS + FPS * SHRINK_START_SECONDS;
const SHRINK_AMOUNT = 100;

const OBSTACLE_FIRST_SPAWN = INTRO_TICKS + FPS * 5;
const OBSTACLE_INTERVAL_MIN = FPS * 3;
const OBSTACLE_INTERVAL_MAX = FPS * 6;
const OBSTACLE_SHAPES: ObstacleShape[] = ["firewall", "spikeball"];
const OBSTACLE_DAMAGE: Record<ObstacleShape, number> = { firewall: 55, spikeball: 70 };
const OBSTACLE_RADIUS: Record<ObstacleShape, number> = { firewall: 18, spikeball: 26 };
const OBSTACLE_LIFE: Record<ObstacleShape, number> = { firewall: FPS * 10, spikeball: FPS * 10 };
const OBSTACLE_HIT_CD = 30;

export const MIN_TEAM_SIZE = 1;
export const MAX_TEAM_SIZE = 6;

export interface CowboyGhostOptions {
  count?: number;
}

type ShotEvent = {
  attacker: Fighter;
  angle: number;
};

export class CowboyGhostGame {
  readonly seed: number;
  readonly rng: Rng;
  readonly teamSize: number;
  tick = 0;
  outcome: { winner: FighterKind | "draw"; endTick: number } | null = null;
  cowboys: Fighter[];
  ghosts: Fighter[];
  bullets: Bullet[] = [];
  damageTexts: DamageText[] = [];
  deathParticles: DeathParticle[] = [];
  koEffect: KOEffect | null = null;
  koFreezeTicks = 0;
  comboCount = 0;
  lastHitTick = -999;
  screenShake = 0;
  powerups: PowerUp[] = [];
  pickupEffects: PickupEffect[] = [];
  nextPowerupTick: number = POWERUP_FIRST_SPAWN;
  walls: Wall[] = [];
  flames: FlameTrail[] = [];
  obstacles: Obstacle[] = [];
  nextObstacleTick: number = OBSTACLE_FIRST_SPAWN;
  commentaries: Commentary[] = [];
  lastCommentaryTick = -999;
  readonly soundEvents: SoundEvent[] = [];

  constructor(seed: number, options: CowboyGhostOptions = {}) {
    this.seed = seed;
    this.rng = createRng(seed);
    this.teamSize = clamp(
      Math.floor(options.count ?? 1),
      MIN_TEAM_SIZE,
      MAX_TEAM_SIZE,
    );

    this.cowboys = [];
    this.ghosts = [];
    const arenaTop = BOUNDS.top + 160;
    const arenaBottom = BOUNDS.bottom - 160;
    const arenaH = arenaBottom - arenaTop;

    for (let i = 0; i < this.teamSize; i++) {
      const frac = this.teamSize === 1 ? 0.5 : i / (this.teamSize - 1);
      const label = this.teamSize === 1 ? "Trump" : `Trump ${i + 1}`;
      const y = arenaTop + frac * arenaH + this.rng.range(-28, 28);
      this.cowboys.push(
        createFighter(
          "cowboy",
          BOUNDS.left + 160 + this.rng.range(-24, 24),
          y,
          label,
        ),
      );
    }

    for (let i = 0; i < this.teamSize; i++) {
      const frac = this.teamSize === 1 ? 0.5 : i / (this.teamSize - 1);
      const label = this.teamSize === 1 ? "Musk" : `Musk ${i + 1}`;
      const y = arenaTop + frac * arenaH + this.rng.range(-28, 28);
      this.ghosts.push(
        createFighter(
          "ghost",
          BOUNDS.right - 160 + this.rng.range(-24, 24),
          y,
          label,
        ),
      );
    }
  }

  step(): void {
    // Intro phase: no combat
    if (this.tick < INTRO_TICKS) {
      this.updateDeathParticles();
      this.tick += 1;
      return;
    }

    // KO freeze: pause combat, keep effects running
    if (this.koFreezeTicks > 0) {
      this.koFreezeTicks -= 1;
      this.updateDeathParticles();
      this.updateEffects();
      if (this.koEffect) this.koEffect.age += 1;
      this.screenShake = Math.max(0, this.screenShake - 0.5);
      this.tick += 1;
      return;
    }

    if (this.koEffect && this.koEffect.age >= this.koEffect.maxAge) {
      this.koEffect = null;
    }

    const combatActive = !this.outcome;

    if (combatActive) {
      for (const self of this.cowboys) {
        const target = this.nearestEnemy(self);
        this.updateFighterMovement(self, target);
      }
      for (const self of this.ghosts) {
        const target = this.nearestEnemy(self);
        this.updateFighterMovement(self, target);
      }
      for (const f of this.cowboys) this.integrateFighter(f);
      for (const f of this.ghosts) this.integrateFighter(f);
      this.resolveFighterCollisions();
      this.updateSkills();
      this.resolveShots();
      this.updateBullets();
      this.updateWalls();
      this.updateFlames();
      this.spawnObstacles();
      this.updateObstacles();
      this.spawnPowerups();
      this.resolvePowerupPickups();
      this.updateBuffs();
      // Shrink zone commentary
      if (this.tick === SHRINK_START_TICK) {
        this.pushCommentary("\u26a0 \u573a\u5730\u7f29\u5c0f\u4e86\uff01\uff01", "#cc44ff", 28);
      }
      this.resolveOutcome();
    } else {
      for (const f of this.allFighters()) {
        f.vx *= 0.94;
        f.vy *= 0.94;
        this.integrateFighter(f);
      }
      this.updateBullets();
    }

    this.screenShake = Math.max(0, this.screenShake - 0.5);
    this.updateDeathParticles();
    this.updatePickupEffects();
    this.updateCommentaries();
    this.updateEffects();
    this.tick += 1;
  }

  teamHp(kind: FighterKind): number {
    const team = kind === "cowboy" ? this.cowboys : this.ghosts;
    let sum = 0;
    for (const f of team) sum += Math.max(0, f.hp);
    return sum;
  }

  teamMaxHp(kind: FighterKind): number {
    const team = kind === "cowboy" ? this.cowboys : this.ghosts;
    let sum = 0;
    for (const f of team) sum += f.maxHp;
    return sum;
  }

  teamAliveCount(kind: FighterKind): number {
    const team = kind === "cowboy" ? this.cowboys : this.ghosts;
    let n = 0;
    for (const f of team) if (f.alive) n++;
    return n;
  }

  fighterHp(kind: FighterKind): number {
    return this.teamHp(kind);
  }

  teamLabel(kind: FighterKind): string {
    return kind === "cowboy" ? "Trump" : "Musk";
  }

  fighterLabel(kind: FighterKind): string {
    return this.teamLabel(kind);
  }

  winnerLabel(): string {
    if (!this.outcome) return "unknown";
    if (this.outcome.winner === "draw") return "draw";
    return this.teamLabel(this.outcome.winner);
  }

  isDone(): boolean {
    if (this.outcome && this.tick - this.outcome.endTick >= OUTRO_TICKS) {
      return true;
    }
    return this.tick >= ROUND_TICKS;
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawGame(ctx, this);
  }

  allFighters(): Fighter[] {
    return [...this.cowboys, ...this.ghosts];
  }

  shrinkProgress(): number {
    if (this.tick < SHRINK_START_TICK) return 0;
    const elapsed = this.tick - SHRINK_START_TICK;
    const remaining = ROUND_TICKS - SHRINK_START_TICK;
    return Math.min(1, elapsed / Math.max(1, remaining));
  }

  activeBounds(): { left: number; top: number; right: number; bottom: number } {
    const s = this.shrinkProgress();
    const shrink = s * SHRINK_AMOUNT;
    return {
      left: BOUNDS.left + shrink,
      top: BOUNDS.top + shrink,
      right: BOUNDS.right - shrink,
      bottom: BOUNDS.bottom - shrink,
    };
  }

  private nearestEnemy(self: Fighter): Fighter | null {
    const enemies = self.kind === "cowboy" ? this.ghosts : this.cowboys;
    let best: Fighter | null = null;
    let bestD2 = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - self.x;
      const dy = e.y - self.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }

  private updateFighterMovement(self: Fighter, target: Fighter | null): void {
    self.hitFlash = Math.max(0, self.hitFlash - 1);
    self.attackFlash = Math.max(0, self.attackFlash - 1);

    if (!self.alive) {
      self.vx *= 0.9;
      self.vy *= 0.9;
      return;
    }

    if (!target) {
      self.vx *= 0.92;
      self.vy *= 0.92;
      return;
    }

    if (self.steerTimer <= 0) {
      self.steerTimer = this.rng.int(18, 46);
      self.steerSign = this.rng.next() > 0.5 ? 1 : -1;
    }
    self.steerTimer -= 1;

    const dx = target.x - self.x;
    const dy = target.y - self.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const tx = -ny;
    const ty = nx;

    let steerX = 0;
    let steerY = 0;
    const prefer = self.stats.preferredRange;

    if (self.kind === "cowboy") {
      const rangeError = clamp((dist - prefer) / 140, -1, 1);
      steerX += nx * self.stats.accel * rangeError;
      steerY += ny * self.stats.accel * rangeError;
      steerX += tx * self.stats.accel * 0.4 * self.steerSign;
      steerY += ty * self.stats.accel * 0.4 * self.steerSign;
      if (dist < 180) {
        steerX -= nx * self.stats.accel * 0.9;
        steerY -= ny * self.stats.accel * 0.9;
      }
    } else {
      const chase = dist > self.stats.attackRange * 0.9 ? 1 : 0.35;
      steerX += nx * self.stats.accel * chase;
      steerY += ny * self.stats.accel * chase;
      steerX += tx * self.stats.accel * 0.28 * self.steerSign;
      steerY += ty * self.stats.accel * 0.28 * self.steerSign;
      if (dist < 170) {
        steerX -= nx * self.stats.accel * 0.55;
        steerY -= ny * self.stats.accel * 0.55;
      }
    }

    const ab = this.activeBounds();
    const wallBiasX =
      self.x < ab.left + 120
        ? 1
        : self.x > ab.right - 120
          ? -1
          : 0;
    const wallBiasY =
      self.y < ab.top + 120
        ? 1
        : self.y > ab.bottom - 120
          ? -1
          : 0;

    steerX += wallBiasX * self.stats.accel * 0.25;
    steerY += wallBiasY * self.stats.accel * 0.25;

    // Powerup attraction: move toward nearby powerup when HP < 70% or powerup is close
    const nearPU = this.nearestPowerup(self);
    if (nearPU) {
      const pdx = nearPU.x - self.x;
      const pdy = nearPU.y - self.y;
      const pDist = Math.hypot(pdx, pdy) || 1;
      const hpRatio = self.hp / self.maxHp;
      const urgency = hpRatio < 0.4 ? 0.7 : hpRatio < 0.7 ? 0.45 : (pDist < 200 ? 0.3 : 0);
      if (urgency > 0) {
        steerX += (pdx / pDist) * self.stats.accel * urgency;
        steerY += (pdy / pDist) * self.stats.accel * urgency;
      }
    }

    // Obstacle avoidance: steer away from nearby obstacles
    for (const ob of this.obstacles) {
      const odx = self.x - ob.x;
      const ody = self.y - ob.y;
      const oDist = Math.hypot(odx, ody) || 1;
      const dangerDist = self.radius + ob.radius + 80;
      if (oDist < dangerDist) {
        const avoid = self.stats.accel * 0.7 * (1 - oDist / dangerDist);
        steerX += (odx / oDist) * avoid;
        steerY += (ody / oDist) * avoid;
      }
    }

    // Drunk effect: random steering deviation
    if (self.drunkTicks > 0) {
      const drunkAngle = this.rng.range(-Math.PI, Math.PI);
      const drunkForce = self.stats.accel * 0.6;
      steerX += Math.cos(drunkAngle) * drunkForce;
      steerY += Math.sin(drunkAngle) * drunkForce;
    }

    self.vx += steerX * DT;
    self.vy += steerY * DT;

    const maxSpeed = self.stats.maxSpeed * (self.speedBoostTicks > 0 ? 1.5 : 1);
    const speed = Math.hypot(self.vx, self.vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      self.vx *= scale;
      self.vy *= scale;
    }

    self.vx *= self.stats.friction;
    self.vy *= self.stats.friction;
    self.facing = Math.atan2(dy, dx);
  }

  private integrateFighter(fighter: Fighter): void {
    fighter.x += fighter.vx * DT;
    fighter.y += fighter.vy * DT;

    const b = this.activeBounds();
    const minX = b.left + fighter.radius;
    const maxX = b.right - fighter.radius;
    const minY = b.top + fighter.radius;
    const maxY = b.bottom - fighter.radius;

    if (fighter.x < minX) {
      fighter.x = minX;
      fighter.vx = Math.abs(fighter.vx) * fighter.stats.bounce;
    } else if (fighter.x > maxX) {
      fighter.x = maxX;
      fighter.vx = -Math.abs(fighter.vx) * fighter.stats.bounce;
    }

    if (fighter.y < minY) {
      fighter.y = minY;
      fighter.vy = Math.abs(fighter.vy) * fighter.stats.bounce;
    } else if (fighter.y > maxY) {
      fighter.y = maxY;
      fighter.vy = -Math.abs(fighter.vy) * fighter.stats.bounce;
    }
  }

  private resolveFighterCollisions(): void {
    const all = this.allFighters();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        this.resolveFighterCollision(all[i], all[j]);
      }
    }
  }

  private resolveFighterCollision(a: Fighter, b: Fighter): void {
    if (!a.alive || !b.alive) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const minDist = a.radius + b.radius;
    if (dist >= minDist) return;

    const overlap = minDist - dist;
    const nx = dx / dist;
    const ny = dy / dist;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;
    const pushMag = a.kind !== b.kind ? 18 : 10;
    a.vx -= nx * pushMag;
    a.vy -= ny * pushMag;
    b.vx += nx * pushMag;
    b.vy += ny * pushMag;
  }

  private resolveShots(): void {
    const shotEvents: ShotEvent[] = [];
    for (const attacker of this.cowboys) {
      const target = this.nearestEnemy(attacker);
      if (target) this.collectShot(attacker, target, shotEvents);
    }
    for (const attacker of this.ghosts) {
      const target = this.nearestEnemy(attacker);
      if (target) this.collectShot(attacker, target, shotEvents);
    }
    for (const event of shotEvents) {
      this.spawnBullet(event);
    }
  }

  private collectShot(
    attacker: Fighter,
    target: Fighter,
    shotEvents: ShotEvent[],
  ): void {
    if (!attacker.alive || !target.alive) return;
    attacker.attackCooldown = Math.max(0, attacker.attackCooldown - 1);
    const dist = Math.hypot(target.x - attacker.x, target.y - attacker.y);
    if (attacker.attackCooldown > 0 || dist > attacker.stats.attackRange) return;

    // Desperation passive: < 30% HP → halved cooldown + halved jitter
    const hpRatio = attacker.hp / attacker.maxHp;
    const desperate = hpRatio > 0 && hpRatio < 0.3;
    if (desperate && attacker.attackCooldown === 0) {
      const berserkComments = ["\u72c2\u66b4\u4e86\uff01", "\u8981\u7ffb\u76d8\uff01\uff1f", "\u7edd\u5730\u53cd\u51fb\uff01\uff01", "LOW HP!!"];
      if (this.rng.next() < 0.06) this.pushCommentary(this.rng.pick(berserkComments), "#ff6600", 22);
    }
    const jitter = attacker.stats.aimJitter * (desperate ? 0.5 : 1);

    const baseAngle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    shotEvents.push({
      attacker,
      angle: baseAngle + this.rng.range(-jitter, jitter),
    });
    const cdMin = desperate ? Math.floor(attacker.stats.cooldownMin * 0.5) : attacker.stats.cooldownMin;
    const cdMax = desperate ? Math.floor(attacker.stats.cooldownMax * 0.5) : attacker.stats.cooldownMax;
    attacker.attackCooldown = this.rng.int(cdMin, cdMax);
    attacker.attackFlash = 8;
  }

  private spawnBullet(event: ShotEvent): void {
    const { attacker, angle } = event;
    const muzzle = attacker.radius + 16;
    this.bullets.push({
      owner: attacker.kind,
      x: attacker.x + Math.cos(angle) * muzzle,
      y: attacker.y + Math.sin(angle) * muzzle,
      vx: Math.cos(angle) * attacker.stats.bulletSpeed,
      vy: Math.sin(angle) * attacker.stats.bulletSpeed,
      life: attacker.stats.bulletLife,
      damage: this.rng.int(attacker.stats.attackMin, attacker.stats.attackMax),
      radius: attacker.kind === "cowboy" ? 5 : 4,
    });
    pushSound(this.soundEvents, this.tick, "shot");
  }

  private updateBullets(): void {
    const next: Bullet[] = [];
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * DT;
      bullet.y += bullet.vy * DT;
      bullet.life -= 1;
      if (bullet.life <= 0) continue;
      if (
        bullet.x < BOUNDS.left ||
        bullet.x > BOUNDS.right ||
        bullet.y < BOUNDS.top ||
        bullet.y > BOUNDS.bottom
      ) {
        continue;
      }

      const targets =
        bullet.owner === "cowboy" ? this.ghosts : this.cowboys;
      let consumed = false;
      for (const target of targets) {
        if (!target.alive) continue;
        if (this.bulletHitsFighter(bullet, target)) {
          this.applyBulletDamage(bullet, target);
          consumed = true;
          break;
        }
      }
      if (consumed) continue;

      // Wall collision: bullets blocked by enemy walls
      let blocked = false;
      for (const wall of this.walls) {
        if (wall.owner === bullet.owner) continue;
        if (this.bulletHitsWall(bullet, wall)) {
          wall.hp -= bullet.damage;
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      next.push(bullet);
    }
    this.bullets = next;
  }

  private bulletHitsWall(bullet: Bullet, wall: Wall): boolean {
    const cos = Math.cos(-wall.angle);
    const sin = Math.sin(-wall.angle);
    const dx = bullet.x - wall.x;
    const dy = bullet.y - wall.y;
    const lx = Math.abs(cos * dx - sin * dy);
    const ly = Math.abs(sin * dx + cos * dy);
    return lx <= wall.width / 2 + bullet.radius && ly <= wall.height / 2 + bullet.radius;
  }

  private bulletHitsFighter(bullet: Bullet, target: Fighter): boolean {
    const dx = bullet.x - target.x;
    const dy = bullet.y - target.y;
    const hitRadius = target.radius + bullet.radius;
    return dx * dx + dy * dy <= hitRadius * hitRadius;
  }

  private applyBulletDamage(bullet: Bullet, target: Fighter): void {
    const attackerKind = bullet.owner;
    const attackers = attackerKind === "cowboy" ? this.cowboys : this.ghosts;
    const attacker = attackers.find(f => f.alive);
    const rageActive = attacker ? attacker.rageTicks > 0 : false;
    let damageMult = rageActive ? 2 : 1;
    if (attacker && attacker.bigTicks > 0) damageMult *= 1.5;
    if (attacker && attacker.tinyTicks > 0) damageMult *= 0.5;
    const damage = Math.round(bullet.damage * damageMult);
    const textColor = rageActive ? "#ff6666" : (attackerKind === "cowboy" ? "#ffd166" : "#bdefff");
    const knockback = attackerKind === "cowboy" ? 120 : 90;

    const bulletSpeed = Math.hypot(bullet.vx, bullet.vy) || 1;
    const nx = bullet.vx / bulletSpeed;
    const ny = bullet.vy / bulletSpeed;

    // Shield absorption
    let remaining = damage;
    if (target.shieldHp > 0) {
      const absorbed = Math.min(target.shieldHp, remaining);
      target.shieldHp -= absorbed;
      remaining -= absorbed;
    }

    const wasAlive = target.alive;
    target.hp = Math.max(0, target.hp - remaining);
    target.alive = target.hp > 0;
    target.hitFlash = 10;
    target.vx += nx * knockback;
    target.vy += ny * knockback;

    // Combo tracking
    if (this.tick - this.lastHitTick < COMBO_WINDOW) {
      this.comboCount += 1;
    } else {
      this.comboCount = 1;
    }
    this.lastHitTick = this.tick;

    const isCombo = this.comboCount >= 3;
    const comboText = isCombo ? ` x${this.comboCount}` : "";

    if (wasAlive && !target.alive) {
      pushSound(this.soundEvents, this.tick, "boom");
      // Commentary on kill
      const killComments = ["K.O.!!!", "GG!", "\u79d2\u4e86\uff01", "\u592a\u5f3a\u4e86\uff01", "PERFECT KILL!", "\u65e0\u60c5\uff01"];
      this.pushCommentary(this.rng.pick(killComments), attackerKind === "cowboy" ? "#ffd166" : "#bdefff", 28);
      // KO freeze + effect
      this.koFreezeTicks = KO_FREEZE_TICKS;
      this.screenShake = 14;
      const killerLabel = attackerKind === "cowboy" ? "Trump" : "Musk";
      this.koEffect = {
        x: target.x,
        y: target.y,
        label: "K.O.!",
        color: attackerKind === "cowboy" ? "#ffd166" : "#bdefff",
        age: 0,
        maxAge: KO_FREEZE_TICKS + 40,
      };
      // Death particles
      const pColor = attackerKind === "cowboy" ? "#ff8a5b" : "#69a9ff";
      for (let i = 0; i < 28; i++) {
        const a = this.rng.range(0, Math.PI * 2);
        const s = this.rng.range(80, 320);
        this.deathParticles.push({
          x: target.x,
          y: target.y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 20 + this.rng.int(0, 16),
          maxLife: 36,
          color: i % 3 === 0 ? "#ffffff" : pColor,
          size: 2 + this.rng.range(0, 4),
        });
      }
    } else {
      pushSound(this.soundEvents, this.tick, "impact");
      // Commentary on combo
      if (this.comboCount === 3) this.pushCommentary("Combo!", "#ff4444", 24);
      else if (this.comboCount === 5) this.pushCommentary("\u8fde\u51fb\u592a\u731b\u4e86\uff01\uff01", "#ff2222", 26);
      else if (this.comboCount >= 7) this.pushCommentary("\u65e0\u9650\u8fde\uff01\uff01\uff01", "#ff0000", 30);
      // Commentary on close call
      if (target.alive && target.hp > 0 && target.hp / target.maxHp < 0.1) {
        const closeComments = ["\u5dee\u4e00\u70b9\uff01", "\u597d\u9669\uff01\uff01", "CLUTCH!", "\u5947\u8ff9\uff01"];
        this.pushCommentary(this.rng.pick(closeComments), "#ffaa00", 24);
      }
    }

    this.damageTexts.push({
      text: `-${damage}${comboText}`,
      x: target.x + this.rng.range(-18, 18),
      y: target.y - target.radius - 10,
      vx: this.rng.range(-22, 22),
      vy: -this.rng.range(90, 140),
      life: 28,
      maxLife: 28,
      color: isCombo ? "#ff4444" : textColor,
      size: isCombo ? 36 : (attackerKind === "cowboy" ? 30 : 24),
    });
  }

  private updateDeathParticles(): void {
    const next: DeathParticle[] = [];
    for (const p of this.deathParticles) {
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= 1;
      if (p.life > 0) next.push(p);
    }
    this.deathParticles = next;
  }

  private updateEffects(): void {
    const nextTexts: DamageText[] = [];
    for (const text of this.damageTexts) {
      text.x += text.vx * DT;
      text.y += text.vy * DT;
      text.vy -= 10 * DT;
      text.life -= 1;
      if (text.life > 0) nextTexts.push(text);
    }
    this.damageTexts = nextTexts;
  }

  private nearestPowerup(self: Fighter): PowerUp | null {
    let best: PowerUp | null = null;
    let bestD2 = Infinity;
    for (const pu of this.powerups) {
      const dx = pu.x - self.x;
      const dy = pu.y - self.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = pu;
      }
    }
    return best;
  }

  private spawnPowerups(): void {
    if (this.tick < this.nextPowerupTick) return;
    if (this.powerups.length >= 1) return;

    const kind = this.rng.pick(POWERUP_KINDS);
    const padX = 100;
    const padY = 100;
    const x = this.rng.range(BOUNDS.left + padX, BOUNDS.right - padX);
    const y = this.rng.range(BOUNDS.top + padY, BOUNDS.bottom - padY);
    this.powerups.push({ kind, x, y, radius: POWERUP_RADIUS, age: 0 });

    this.nextPowerupTick = this.tick + this.rng.int(POWERUP_INTERVAL_MIN, POWERUP_INTERVAL_MAX);
  }

  private resolvePowerupPickups(): void {
    const fighters = this.allFighters().filter(f => f.alive);
    const remaining: PowerUp[] = [];
    for (const pu of this.powerups) {
      pu.age += 1;
      let picked = false;
      for (const f of fighters) {
        const dx = f.x - pu.x;
        const dy = f.y - pu.y;
        if (dx * dx + dy * dy <= (f.radius + pu.radius) * (f.radius + pu.radius)) {
          this.applyPowerup(f, pu.kind);
          picked = true;
          break;
        }
      }
      if (!picked) remaining.push(pu);
    }
    this.powerups = remaining;
  }

  private applyPowerup(fighter: Fighter, kind: PowerUpKind): void {
    const config = POWERUP_CONFIG[kind];
    pushSound(this.soundEvents, this.tick, "fanfare", 0.5);

    switch (kind) {
      case "heal": {
        const heal = Math.floor(fighter.maxHp * HEAL_FRACTION);
        fighter.hp = Math.min(fighter.maxHp, fighter.hp + heal);
        break;
      }
      case "rage":
        fighter.rageTicks = RAGE_DURATION;
        break;
      case "shield":
        fighter.shieldHp = Math.min(fighter.shieldHp + SHIELD_AMOUNT, SHIELD_AMOUNT);
        break;
      case "speed":
        fighter.speedBoostTicks = SPEED_DURATION;
        break;
      case "big":
        fighter.bigTicks = BIG_DURATION;
        fighter.tinyTicks = 0;
        break;
      case "tiny":
        fighter.tinyTicks = TINY_DURATION;
        fighter.bigTicks = 0;
        break;
      case "swap": {
        const enemy = this.nearestEnemy(fighter);
        if (enemy && enemy.alive) {
          const tmpX = fighter.x;
          const tmpY = fighter.y;
          fighter.x = enemy.x;
          fighter.y = enemy.y;
          enemy.x = tmpX;
          enemy.y = tmpY;
          // Flash both
          fighter.hitFlash = 8;
          enemy.hitFlash = 8;
          this.screenShake = 8;
          // Pickup effect on enemy too
          this.pickupEffects.push({
            x: enemy.x,
            y: enemy.y - enemy.radius - 30,
            label: "SWAP!",
            color: config.color,
            age: 0,
            maxAge: 40,
          });
        }
        break;
      }
      case "drunk": {
        // Apply drunk to the opponent, not the picker
        const enemies = fighter.kind === "cowboy" ? this.ghosts : this.cowboys;
        for (const e of enemies) {
          if (e.alive) e.drunkTicks = DRUNK_DURATION;
        }
        break;
      }
    }

    this.pickupEffects.push({
      x: fighter.x,
      y: fighter.y - fighter.radius - 30,
      label: config.label,
      color: config.color,
      age: 0,
      maxAge: 40,
    });
  }

  private updateBuffs(): void {
    for (const f of this.allFighters()) {
      if (f.rageTicks > 0) f.rageTicks -= 1;
      if (f.speedBoostTicks > 0) f.speedBoostTicks -= 1;
      if (f.bigTicks > 0) f.bigTicks -= 1;
      if (f.tinyTicks > 0) f.tinyTicks -= 1;
      if (f.drunkTicks > 0) f.drunkTicks -= 1;

      // Smooth scale transition
      const targetScale = f.bigTicks > 0 ? BIG_SCALE : f.tinyTicks > 0 ? TINY_SCALE : 1;
      f.scaleMultiplier += (targetScale - f.scaleMultiplier) * 0.15;
      f.radius = f.stats.radius * f.scaleMultiplier;
    }
  }

  private updatePickupEffects(): void {
    const next: PickupEffect[] = [];
    for (const e of this.pickupEffects) {
      e.age += 1;
      e.y -= 1.5;
      if (e.age < e.maxAge) next.push(e);
    }
    this.pickupEffects = next;
  }

  private updateCommentaries(): void {
    const next: Commentary[] = [];
    for (const c of this.commentaries) {
      c.age += 1;
      c.x += c.vx * DT;
      if (c.age < c.maxAge) next.push(c);
    }
    this.commentaries = next;
  }

  pushCommentary(text: string, color = "#ffffff", size = 22): void {
    if (this.tick - this.lastCommentaryTick < 18) return;
    this.lastCommentaryTick = this.tick;
    const side = this.rng.next() > 0.5 ? 1 : -1;
    this.commentaries.push({
      text,
      x: side > 0 ? -60 : ARENA_W + 60,
      y: 280 + this.rng.range(0, 350),
      vx: side > 0 ? this.rng.range(500, 700) : -this.rng.range(500, 700),
      color,
      age: 0,
      maxAge: 90,
      size,
    });
  }

  private updateSkills(): void {
    for (const f of this.allFighters()) {
      if (!f.alive) continue;
      if (f.skillCooldown > 0) f.skillCooldown -= 1;

      // Active dash movement (Musk)
      if (f.skillActive > 0) {
        f.skillActive -= 1;
        if (f.kind === "ghost") {
          f.vx = f.dashVx;
          f.vy = f.dashVy;
          // Spawn flame trail
          const cfg = SKILL_CONFIG.ghost;
          this.flames.push({
            x: f.x,
            y: f.y,
            life: cfg.flameLife,
            maxLife: cfg.flameLife,
            radius: cfg.flameRadius,
            damage: cfg.flameDamage,
            owner: "ghost",
            hasDamaged: new Set(),
          });
        }
        continue;
      }

      // AI decision to use skill
      if (f.skillCooldown > 0) continue;
      const enemy = this.nearestEnemy(f);
      if (!enemy) continue;
      const dist = Math.hypot(enemy.x - f.x, enemy.y - f.y);

      if (f.kind === "cowboy") {
        // Build wall when enemy is approaching and within range
        if (dist < 300 && dist > 100) {
          this.activateCowboySkill(f, enemy);
        }
      } else {
        // Rocket dash when enemy is at medium range or HP is low
        if ((dist > 200 && dist < 450) || f.hp / f.maxHp < 0.35) {
          this.activateGhostSkill(f, enemy);
        }
      }
    }
  }

  private activateCowboySkill(f: Fighter, enemy: Fighter): void {
    const cfg = SKILL_CONFIG.cowboy;
    f.skillCooldown = cfg.cooldown;
    f.attackFlash = 12;
    this.screenShake = 6;
    pushSound(this.soundEvents, this.tick, "boom", 0.4);

    // Place wall between self and enemy
    const mx = (f.x + enemy.x) / 2;
    const my = (f.y + enemy.y) / 2;
    const angle = Math.atan2(enemy.y - f.y, enemy.x - f.x) + Math.PI / 2;

    this.walls.push({
      owner: "cowboy",
      x: mx,
      y: my,
      angle,
      width: cfg.wallWidth,
      height: cfg.wallHeight,
      hp: cfg.wallHp,
      maxHp: cfg.wallHp,
      life: cfg.wallDuration,
    });

    this.pickupEffects.push({
      x: f.x,
      y: f.y - f.radius - 40,
      label: cfg.name,
      color: "#ffd166",
      age: 0,
      maxAge: 36,
    });
    const wallComments = ["BUILD THE WALL!", "\u5899\uff01\uff01\uff01", "\u6321\u4f4f\u4e86\uff01", "\u9632\u5fa1\uff01"];
    this.pushCommentary(this.rng.pick(wallComments), "#ffd166", 26);
  }

  private activateGhostSkill(f: Fighter, enemy: Fighter): void {
    const cfg = SKILL_CONFIG.ghost;
    f.skillCooldown = cfg.cooldown;
    f.skillActive = cfg.dashDuration;
    pushSound(this.soundEvents, this.tick, "boom", 0.4);
    this.screenShake = 5;

    // Dash toward enemy
    const dx = enemy.x - f.x;
    const dy = enemy.y - f.y;
    const dist = Math.hypot(dx, dy) || 1;
    f.dashVx = (dx / dist) * cfg.dashSpeed;
    f.dashVy = (dy / dist) * cfg.dashSpeed;

    this.pickupEffects.push({
      x: f.x,
      y: f.y - f.radius - 40,
      label: cfg.name,
      color: "#bdefff",
      age: 0,
      maxAge: 36,
    });
    const dashComments = ["ROCKET DASH!", "\u51b2\uff01\uff01\uff01", "\u706b\u7bad\u7a81\u8fdb\uff01", "To the Moon!"];
    this.pushCommentary(this.rng.pick(dashComments), "#bdefff", 26);
  }

  private updateWalls(): void {
    const next: Wall[] = [];
    for (const wall of this.walls) {
      wall.life -= 1;
      if (wall.life > 0 && wall.hp > 0) next.push(wall);
    }
    this.walls = next;
  }

  private updateFlames(): void {
    const next: FlameTrail[] = [];
    for (const flame of this.flames) {
      flame.life -= 1;
      // Damage enemies touching flame
      const enemies = flame.owner === "cowboy" ? this.ghosts : this.cowboys;
      for (const e of enemies) {
        if (!e.alive || flame.hasDamaged.has(e)) continue;
        const dx = e.x - flame.x;
        const dy = e.y - flame.y;
        if (dx * dx + dy * dy <= (e.radius + flame.radius) * (e.radius + flame.radius)) {
          flame.hasDamaged.add(e);
          e.hp = Math.max(0, e.hp - flame.damage);
          e.alive = e.hp > 0;
          e.hitFlash = 8;
          pushSound(this.soundEvents, this.tick, "impact");
          this.damageTexts.push({
            text: `-${flame.damage}`,
            x: e.x + this.rng.range(-12, 12),
            y: e.y - e.radius - 10,
            vx: this.rng.range(-30, 30),
            vy: -this.rng.range(80, 120),
            life: 24,
            maxLife: 24,
            color: "#ff8844",
            size: 28,
          });
        }
      }
      if (flame.life > 0) next.push(flame);
    }
    this.flames = next;
  }

  private spawnObstacles(): void {
    if (this.tick < this.nextObstacleTick) return;
    this.nextObstacleTick = this.tick + this.rng.int(OBSTACLE_INTERVAL_MIN, OBSTACLE_INTERVAL_MAX);
    const ab = this.activeBounds();
    const shape = this.rng.pick(OBSTACLE_SHAPES);
    const radius = OBSTACLE_RADIUS[shape];
    if (shape === "spikeball") {
      // Spawn from a random edge, then bounce around
      const edge = this.rng.int(0, 3);
      let x: number, y: number, vx: number, vy: number;
      const spd = this.rng.range(90, 170);
      switch (edge) {
        case 0: // top
          x = this.rng.range(ab.left + radius, ab.right - radius);
          y = ab.top - radius;
          vx = this.rng.range(-60, 60);
          vy = spd;
          break;
        case 1: // bottom
          x = this.rng.range(ab.left + radius, ab.right - radius);
          y = ab.bottom + radius;
          vx = this.rng.range(-60, 60);
          vy = -spd;
          break;
        case 2: // left
          x = ab.left - radius;
          y = this.rng.range(ab.top + radius, ab.bottom - radius);
          vx = spd;
          vy = this.rng.range(-60, 60);
          break;
        default: // right
          x = ab.right + radius;
          y = this.rng.range(ab.top + radius, ab.bottom - radius);
          vx = -spd;
          vy = this.rng.range(-60, 60);
          break;
      }
      this.obstacles.push({
        x,
        y,
        vx,
        vy,
        radius,
        shape,
        damage: OBSTACLE_DAMAGE[shape],
        life: OBSTACLE_LIFE[shape],
        maxLife: OBSTACLE_LIFE[shape],
        hitCooldowns: new Map(),
      });
      return;
    }

    // Firewall: horizontal moving hazard with vertical floating
    const length = this.rng.range(200, 320);
    const y = this.rng.range(ab.top + 120, ab.bottom - 120);
    const x = this.rng.range(ab.left + length / 2 + 20, ab.right - length / 2 - 20);
    const vx = (this.rng.next() > 0.5 ? 1 : -1) * this.rng.range(80, 140);
    this.obstacles.push({
      x,
      y,
      vx,
      vy: 0,
      radius,
      shape,
      length,
      baseY: y,
      phase: this.rng.range(0, Math.PI * 2),
      damage: OBSTACLE_DAMAGE[shape],
      life: OBSTACLE_LIFE[shape],
      maxLife: OBSTACLE_LIFE[shape],
      hitCooldowns: new Map(),
    });
  }

  private updateObstacles(): void {
    const ab = this.activeBounds();
    const next: Obstacle[] = [];
    for (const ob of this.obstacles) {
      ob.life -= 1;
      ob.x += ob.vx * DT;
      ob.y += ob.vy * DT;

      if (ob.shape === "spikeball") {
        // Bounce off arena bounds
        if (ob.x - ob.radius < ab.left) { ob.x = ab.left + ob.radius; ob.vx = Math.abs(ob.vx); }
        if (ob.x + ob.radius > ab.right) { ob.x = ab.right - ob.radius; ob.vx = -Math.abs(ob.vx); }
        if (ob.y - ob.radius < ab.top) { ob.y = ab.top + ob.radius; ob.vy = Math.abs(ob.vy); }
        if (ob.y + ob.radius > ab.bottom) { ob.y = ab.bottom - ob.radius; ob.vy = -Math.abs(ob.vy); }
      } else {
        const len = ob.length ?? 240;
        const half = len / 2;
        // Horizontal bounce for a segment
        if (ob.x - half < ab.left + 12) { ob.x = ab.left + 12 + half; ob.vx = Math.abs(ob.vx); }
        if (ob.x + half > ab.right - 12) { ob.x = ab.right - 12 - half; ob.vx = -Math.abs(ob.vx); }
        // Vertical floating
        const baseY = ob.baseY ?? ob.y;
        const phase = ob.phase ?? 0;
        ob.y = baseY + 22 * Math.sin(phase + this.tick * 0.05);
      }

      // Collision with all fighters
      for (const f of this.allFighters()) {
        if (!f.alive) continue;
        let hit = false;
        let nx = 0;
        let ny = 0;
        if (ob.shape === "spikeball") {
          const dx = f.x - ob.x;
          const dy = f.y - ob.y;
          const dist = Math.hypot(dx, dy);
          const minDist = f.radius + ob.radius;
          if (dist < minDist) {
            hit = true;
            if (dist > 0.1) {
              nx = dx / dist;
              ny = dy / dist;
            }
          }
        } else {
          // Firewall segment collision: circle vs capsule-ish segment (approx using AABB + corner circles)
          const len = ob.length ?? 240;
          const half = len / 2;
          const hh = ob.radius;
          const left = ob.x - half;
          const right = ob.x + half;
          const top = ob.y - hh;
          const bottom = ob.y + hh;
          const cx = clamp(f.x, left, right);
          const cy = clamp(f.y, top, bottom);
          const dx = f.x - cx;
          const dy = f.y - cy;
          const dist2 = dx * dx + dy * dy;
          const minDist = f.radius + ob.radius * 0.7;
          if (dist2 < minDist * minDist) {
            hit = true;
            const dist = Math.sqrt(dist2) || 1;
            nx = dx / dist;
            ny = dy / dist;
          }
        }

        if (hit) {
          const cd = ob.hitCooldowns.get(f) ?? 0;
          if (cd <= 0) {
            ob.hitCooldowns.set(f, OBSTACLE_HIT_CD);
            let dmg = ob.damage;
            if (f.shieldHp > 0) {
              const absorbed = Math.min(f.shieldHp, dmg);
              f.shieldHp -= absorbed;
              dmg -= absorbed;
            }
            f.hp = Math.max(0, f.hp - dmg);
            f.alive = f.hp > 0;
            f.hitFlash = 8;
            this.screenShake = Math.max(this.screenShake, 4);
            pushSound(this.soundEvents, this.tick, "impact", 0.5);
            this.damageTexts.push({
              text: `-${ob.damage}`,
              x: f.x + this.rng.range(-12, 12),
              y: f.y - f.radius - 10,
              vx: this.rng.range(-20, 20),
              vy: -this.rng.range(70, 110),
              life: 22,
              maxLife: 22,
              color: ob.shape === "firewall" ? "#ff6600" : "#ff3333",
              size: 24,
            });
          }
          // Push fighter away
          const pushStr = ob.shape === "firewall" ? 260 : 220;
          f.vx += nx * pushStr * DT;
          f.vy += ny * pushStr * DT;
        }
      }
      // Tick cooldowns
      for (const [fighter, cd] of ob.hitCooldowns) {
        if (cd > 0) ob.hitCooldowns.set(fighter, cd - 1);
      }
      if (ob.life > 0) next.push(ob);
    }
    this.obstacles = next;
  }

  private resolveOutcome(): void {
    if (this.outcome) return;
    const cowboyAlive = this.teamAliveCount("cowboy");
    const ghostAlive = this.teamAliveCount("ghost");
    if (cowboyAlive === 0 && ghostAlive === 0) {
      this.outcome = { winner: "draw", endTick: this.tick };
      return;
    }
    if (cowboyAlive === 0) {
      this.outcome = { winner: "ghost", endTick: this.tick };
      pushSound(this.soundEvents, this.tick, "fanfare");
      return;
    }
    if (ghostAlive === 0) {
      this.outcome = { winner: "cowboy", endTick: this.tick };
      pushSound(this.soundEvents, this.tick, "fanfare");
      return;
    }
    if (this.tick >= ROUND_TICKS - 1) {
      const cowboyHp = this.teamHp("cowboy");
      const ghostHp = this.teamHp("ghost");
      if (cowboyHp === ghostHp) {
        this.outcome = { winner: "draw", endTick: this.tick };
      } else {
        this.outcome = {
          winner: cowboyHp > ghostHp ? "cowboy" : "ghost",
          endTick: this.tick,
        };
        pushSound(this.soundEvents, this.tick, "fanfare");
      }
    }
  }
}
