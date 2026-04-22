import { pushSound, type SoundEvent } from "../../audio/events.js";
import { DT, ARENA_H, ARENA_W, FPS } from "../../engine/loop.js";
import { createRng, type Rng } from "../../engine/rng.js";
import { clamp } from "../../engine/vec.js";
import {
  createFighter,
  type Bullet,
  type DamageText,
  type Fighter,
  type FighterKind,
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

type ShotEvent = {
  attacker: Fighter;
  angle: number;
};

export class CowboyGhostGame {
  readonly seed: number;
  readonly rng: Rng;
  tick = 0;
  outcome: { winner: FighterKind | "draw"; endTick: number } | null = null;
  cowboy: Fighter;
  ghost: Fighter;
  bullets: Bullet[] = [];
  damageTexts: DamageText[] = [];
  readonly soundEvents: SoundEvent[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.rng = createRng(seed);
    this.cowboy = createFighter(
      "cowboy",
      BOUNDS.left + 180 + this.rng.range(-20, 20),
      BOUNDS.top + 280 + this.rng.range(-80, 80),
    );
    this.ghost = createFighter(
      "ghost",
      BOUNDS.right - 180 + this.rng.range(-20, 20),
      BOUNDS.bottom - 320 + this.rng.range(-90, 90),
    );
  }

  step(): void {
    const combatActive = !this.outcome;

    if (combatActive) {
      this.updateFighterMovement(this.cowboy, this.ghost);
      this.updateFighterMovement(this.ghost, this.cowboy);
      this.integrateFighter(this.cowboy);
      this.integrateFighter(this.ghost);
      this.resolveFighterCollision(this.cowboy, this.ghost);
      this.resolveShots();
      this.updateBullets();
      this.resolveOutcome();
    } else {
      this.cowboy.vx *= 0.94;
      this.cowboy.vy *= 0.94;
      this.ghost.vx *= 0.94;
      this.ghost.vy *= 0.94;
      this.integrateFighter(this.cowboy);
      this.integrateFighter(this.ghost);
      this.updateBullets();
    }

    this.updateEffects();
    this.tick += 1;
  }

  fighterHp(kind: FighterKind): number {
    return kind === "cowboy" ? this.cowboy.hp : this.ghost.hp;
  }

  fighterLabel(kind: FighterKind): string {
    return kind === "cowboy" ? this.cowboy.label : this.ghost.label;
  }

  winnerLabel(): string {
    if (!this.outcome) return "unknown";
    if (this.outcome.winner === "draw") return "draw";
    return this.fighterLabel(this.outcome.winner);
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

  private updateFighterMovement(self: Fighter, target: Fighter): void {
    self.hitFlash = Math.max(0, self.hitFlash - 1);
    self.attackFlash = Math.max(0, self.attackFlash - 1);

    if (!self.alive) {
      self.vx *= 0.9;
      self.vy *= 0.9;
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

    const wallBiasX =
      self.x < BOUNDS.left + 120
        ? 1
        : self.x > BOUNDS.right - 120
          ? -1
          : 0;
    const wallBiasY =
      self.y < BOUNDS.top + 120
        ? 1
        : self.y > BOUNDS.bottom - 120
          ? -1
          : 0;

    steerX += wallBiasX * self.stats.accel * 0.25;
    steerY += wallBiasY * self.stats.accel * 0.25;

    self.vx += steerX * DT;
    self.vy += steerY * DT;

    const speed = Math.hypot(self.vx, self.vy);
    if (speed > self.stats.maxSpeed) {
      const scale = self.stats.maxSpeed / speed;
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

    const minX = BOUNDS.left + fighter.radius;
    const maxX = BOUNDS.right - fighter.radius;
    const minY = BOUNDS.top + fighter.radius;
    const maxY = BOUNDS.bottom - fighter.radius;

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

  private resolveFighterCollision(a: Fighter, b: Fighter): void {
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
    a.vx -= nx * 18;
    a.vy -= ny * 18;
    b.vx += nx * 18;
    b.vy += ny * 18;
  }

  private resolveShots(): void {
    const shotEvents: ShotEvent[] = [];
    this.collectShot(this.cowboy, this.ghost, shotEvents);
    this.collectShot(this.ghost, this.cowboy, shotEvents);
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

    const baseAngle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    shotEvents.push({
      attacker,
      angle:
        baseAngle +
        this.rng.range(-attacker.stats.aimJitter, attacker.stats.aimJitter),
    });
    attacker.attackCooldown = this.rng.int(
      attacker.stats.cooldownMin,
      attacker.stats.cooldownMax,
    );
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

      const target = bullet.owner === "cowboy" ? this.ghost : this.cowboy;
      if (target.alive && this.bulletHitsFighter(bullet, target)) {
        this.applyBulletDamage(bullet, target);
        continue;
      }
      next.push(bullet);
    }
    this.bullets = next;
  }

  private bulletHitsFighter(bullet: Bullet, target: Fighter): boolean {
    const dx = bullet.x - target.x;
    const dy = bullet.y - target.y;
    const hitRadius = target.radius + bullet.radius;
    return dx * dx + dy * dy <= hitRadius * hitRadius;
  }

  private applyBulletDamage(bullet: Bullet, target: Fighter): void {
    const attackerKind = bullet.owner;
    const damage = bullet.damage;
    const textColor = attackerKind === "cowboy" ? "#ffd166" : "#bdefff";
    const knockback = attackerKind === "cowboy" ? 120 : 90;
    const attacker =
      attackerKind === "cowboy" ? this.cowboy : this.ghost;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    const wasAlive = target.alive;
    target.hp = Math.max(0, target.hp - damage);
    target.alive = target.hp > 0;
    target.hitFlash = 10;
    target.vx += nx * knockback;
    target.vy += ny * knockback;

    if (wasAlive && !target.alive) {
      pushSound(this.soundEvents, this.tick, "boom");
    } else {
      pushSound(this.soundEvents, this.tick, "impact");
    }

    this.damageTexts.push({
      text: `-${damage}`,
      x: target.x + this.rng.range(-18, 18),
      y: target.y - target.radius - 10,
      vx: this.rng.range(-22, 22),
      vy: -this.rng.range(90, 140),
      life: 28,
      maxLife: 28,
      color: textColor,
      size: attackerKind === "cowboy" ? 30 : 24,
    });
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

  private resolveOutcome(): void {
    if (this.outcome) return;
    if (!this.cowboy.alive && !this.ghost.alive) {
      this.outcome = { winner: "draw", endTick: this.tick };
      return;
    }
    if (!this.cowboy.alive) {
      this.outcome = { winner: "ghost", endTick: this.tick };
      pushSound(this.soundEvents, this.tick, "fanfare");
      return;
    }
    if (!this.ghost.alive) {
      this.outcome = { winner: "cowboy", endTick: this.tick };
      pushSound(this.soundEvents, this.tick, "fanfare");
      return;
    }
    if (this.tick >= ROUND_TICKS - 1) {
      if (this.cowboy.hp === this.ghost.hp) {
        this.outcome = { winner: "draw", endTick: this.tick };
      } else {
        this.outcome = {
          winner: this.cowboy.hp > this.ghost.hp ? "cowboy" : "ghost",
          endTick: this.tick,
        };
        pushSound(this.soundEvents, this.tick, "fanfare");
      }
    }
  }
}
