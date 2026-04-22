import { pushSound, type SoundEvent } from "../../audio/events.js";
import {
  ARENA_H,
  ARENA_W,
  DT,
  FPS,
  TOTAL_TICKS,
} from "../../engine/loop.js";
import { createRng, type Rng } from "../../engine/rng.js";
import { clamp } from "../../engine/vec.js";
import { decide } from "./ai.js";
import { BULLET_RADIUS, spawnBullet, type Bullet } from "./bullet.js";
import { drawGame } from "./render.js";
import { createTank, type Tank, type Team } from "./tank.js";

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Outcome {
  winner: Team | "draw";
  endTick: number;
}

export const INTRO_TICKS = 48;
export const OUTRO_TICKS = FPS * 2;

export class TankGame {
  readonly seed: number;
  readonly rng: Rng;
  tick = 0;
  tanks: Tank[];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  readonly obstacles: Obstacle[];
  outcome: Outcome | null = null;
  screenShake = 0;
  screenFlash = 0;
  readonly soundEvents: SoundEvent[] = [];
  private nextEntityId = 1;

  constructor(seed: number) {
    this.seed = seed;
    this.rng = createRng(seed);

    const jitter = () => this.rng.range(-24, 24);
    const topY = 210;
    const botY = ARENA_H - 210;
    const leftX = ARENA_W * 0.32;
    const rightX = ARENA_W * 0.68;

    this.tanks = [
      createTank(
        this.mintId(),
        "red",
        "medium",
        "R1",
        leftX + jitter(),
        topY + jitter(),
        Math.PI / 2,
        "push",
      ),
      createTank(
        this.mintId(),
        "red",
        "medium",
        "R2",
        rightX + jitter(),
        topY + jitter(),
        Math.PI / 2,
        "support",
      ),
      createTank(
        this.mintId(),
        "blue",
        "medium",
        "B1",
        leftX + jitter(),
        botY + jitter(),
        -Math.PI / 2,
        "push",
      ),
      createTank(
        this.mintId(),
        "blue",
        "medium",
        "B2",
        rightX + jitter(),
        botY + jitter(),
        -Math.PI / 2,
        "support",
      ),
    ];
    for (const t of this.tanks) {
      t.strafeDir = this.rng.next() > 0.5 ? 1 : -1;
    }

    this.obstacles = [
      { x: 280, y: 600, w: 160, h: 80 },
      { x: 70, y: 420, w: 100, h: 60 },
      { x: 550, y: 800, w: 100, h: 60 },
      { x: 90, y: 860, w: 70, h: 70 },
      { x: 560, y: 380, w: 70, h: 70 },
    ];
  }

  private mintId(): number {
    return this.nextEntityId++;
  }

  step(): void {
    const gameplayActive = this.tick >= INTRO_TICKS && !this.outcome;

    if (gameplayActive) {
      for (const t of this.tanks) this.updateTank(t);
      this.resolveCollisions();
      this.updateBullets();
    } else {
      if (this.outcome && this.tick - this.outcome.endTick < 20) {
        this.updateBullets();
      }
      for (const t of this.tanks) {
        t.vx = 0;
        t.vy = 0;
        t.hitFlash = Math.max(0, t.hitFlash - 1);
      }
    }

    this.updateParticles();
    this.resolveOutcome();

    this.screenShake = Math.max(0, this.screenShake - 1);
    this.screenFlash = Math.max(0, this.screenFlash - 1);
    this.tick += 1;
  }

  private updateTank(self: Tank): void {
    if (self.hp <= 0) {
      self.vx = 0;
      self.vy = 0;
      self.hitFlash = Math.max(0, self.hitFlash - 1);
      return;
    }
    const enemy = this.nearestEnemy(self);
    if (!enemy) {
      self.vx = 0;
      self.vy = 0;
      self.fireCooldown = Math.max(0, self.fireCooldown - 1);
      return;
    }
    const intent = decide(self, enemy, this.bullets, this.tick, this.rng);
    const s = self.stats;

    const bodyDiff = normAngle(intent.bodyAngleTarget - self.bodyAngle);
    self.bodyAngle += clamp(
      bodyDiff,
      -s.bodyRotSpeed * DT,
      s.bodyRotSpeed * DT,
    );

    const speed = s.speed * intent.throttle;
    self.vx = Math.cos(self.bodyAngle) * speed;
    self.vy = Math.sin(self.bodyAngle) * speed;
    self.x += self.vx * DT;
    self.y += self.vy * DT;

    const pad = s.radius + 8;
    self.x = clamp(self.x, pad, ARENA_W - pad);
    self.y = clamp(self.y, pad, ARENA_H - pad);

    const turretDiff = normAngle(intent.turretAngleTarget - self.turretAngle);
    self.turretAngle += clamp(
      turretDiff,
      -s.turretRotSpeed * DT,
      s.turretRotSpeed * DT,
    );

    self.fireCooldown = Math.max(0, self.fireCooldown - 1);
    self.hitFlash = Math.max(0, self.hitFlash - 1);

    if (intent.fire) {
      const barrelLen = 34;
      const bx = self.x + Math.cos(self.turretAngle) * barrelLen;
      const by = self.y + Math.sin(self.turretAngle) * barrelLen;
      this.bullets.push(
        spawnBullet(this.mintId(), self, bx, by, self.turretAngle),
      );
      pushSound(this.soundEvents, this.tick, "shot");
      self.fireCooldown = s.fireCooldown;
      for (let i = 0; i < 6; i++) {
        this.particles.push({
          x: bx,
          y: by,
          vx:
            Math.cos(self.turretAngle) * (100 + this.rng.range(0, 120)) +
            this.rng.range(-40, 40),
          vy:
            Math.sin(self.turretAngle) * (100 + this.rng.range(0, 120)) +
            this.rng.range(-40, 40),
          life: 7 + this.rng.int(0, 6),
          maxLife: 14,
          color: "#ffe28a",
          size: 2 + this.rng.range(0, 2),
        });
      }
    }
  }

  private resolveCollisions(): void {
    for (const t of this.tanks) {
      if (t.hp <= 0) continue;
      for (const o of this.obstacles) resolveObstacleCollision(t, o);
    }
    for (let i = 0; i < this.tanks.length; i++) {
      for (let j = i + 1; j < this.tanks.length; j++) {
        const a = this.tanks[i];
        const b = this.tanks[j];
        if (a.hp <= 0 || b.hp <= 0) continue;
        resolveTankTankCollision(a, b);
      }
    }
    for (const t of this.tanks) {
      if (t.hp <= 0) continue;
      const pad = t.stats.radius + 8;
      t.x = clamp(t.x, pad, ARENA_W - pad);
      t.y = clamp(t.y, pad, ARENA_H - pad);
    }
  }

  private nearestEnemy(self: Tank): Tank | null {
    let best: Tank | null = null;
    let bestD2 = Infinity;
    for (const o of this.tanks) {
      if (o.team === self.team || o.hp <= 0) continue;
      const d2 = (o.x - self.x) ** 2 + (o.y - self.y) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = o;
      }
    }
    return best;
  }

  private updateBullets(): void {
    const next: Bullet[] = [];
    for (const b of this.bullets) {
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      b.life -= 1;
      b.age += 1;
      if (b.life <= 0) continue;
      if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) {
        this.spawnImpactParticles(
          b.x,
          b.y,
          b.team === "red" ? "#ff8a8a" : "#8ab8ff",
        );
        continue;
      }
      let hitObstacle = false;
      for (const o of this.obstacles) {
        if (
          b.x > o.x - BULLET_RADIUS &&
          b.x < o.x + o.w + BULLET_RADIUS &&
          b.y > o.y - BULLET_RADIUS &&
          b.y < o.y + o.h + BULLET_RADIUS
        ) {
          hitObstacle = true;
          break;
        }
      }
      if (hitObstacle) {
        this.spawnImpactParticles(b.x, b.y, "#c0c0c0");
        continue;
      }
      let hit = false;
      for (const t of this.tanks) {
        if (t.hp <= 0 || t.team === b.team) continue;
        const dx = b.x - t.x;
        const dy = b.y - t.y;
        const r = t.stats.radius + BULLET_RADIUS;
        if (dx * dx + dy * dy < r * r) {
          this.damageTank(t, b.damage);
          this.spawnImpactParticles(
            b.x,
            b.y,
            t.team === "red" ? "#ff9090" : "#90c4ff",
          );
          hit = true;
          break;
        }
      }
      if (hit) continue;
      next.push(b);
    }
    this.bullets = next;
  }

  private damageTank(t: Tank, dmg: number): void {
    let remaining = dmg;
    if (t.shieldHp > 0) {
      const absorbed = Math.min(t.shieldHp, remaining);
      t.shieldHp -= absorbed;
      remaining -= absorbed;
    }
    const wasAlive = t.hp > 0;
    t.hp = Math.max(0, t.hp - remaining);
    t.hitFlash = 10;
    this.screenShake = Math.max(this.screenShake, 6);
    this.screenFlash = Math.max(this.screenFlash, 4);
    if (wasAlive && t.hp <= 0) {
      pushSound(this.soundEvents, this.tick, "boom");
    } else {
      pushSound(this.soundEvents, this.tick, "impact");
    }
  }

  private spawnImpactParticles(x: number, y: number, color: string): void {
    for (let i = 0; i < 14; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(60, 230);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 14 + this.rng.int(0, 10),
        maxLife: 24,
        color,
        size: 1.5 + this.rng.range(0, 2.5),
      });
    }
  }

  private updateParticles(): void {
    const next: Particle[] = [];
    for (const p of this.particles) {
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= 1;
      if (p.life > 0) next.push(p);
    }
    this.particles = next;
  }

  private resolveOutcome(): void {
    if (this.outcome) return;
    const redAlive = this.teamAliveCount("red");
    const blueAlive = this.teamAliveCount("blue");
    if (redAlive === 0 && blueAlive === 0) {
      this.outcome = { winner: "draw", endTick: this.tick };
    } else if (redAlive === 0) {
      this.outcome = { winner: "blue", endTick: this.tick };
      this.screenFlash = 10;
      this.screenShake = 14;
      pushSound(this.soundEvents, this.tick, "fanfare");
    } else if (blueAlive === 0) {
      this.outcome = { winner: "red", endTick: this.tick };
      this.screenFlash = 10;
      this.screenShake = 14;
      pushSound(this.soundEvents, this.tick, "fanfare");
    } else if (this.tick >= TOTAL_TICKS - OUTRO_TICKS - 1) {
      const redHp = this.teamHp("red");
      const blueHp = this.teamHp("blue");
      const winner: Team | "draw" =
        redHp > blueHp ? "red" : redHp < blueHp ? "blue" : "draw";
      this.outcome = { winner, endTick: this.tick };
      if (winner !== "draw") {
        pushSound(this.soundEvents, this.tick, "fanfare");
      }
    }
  }

  teamAliveCount(team: Team): number {
    let n = 0;
    for (const t of this.tanks) if (t.team === team && t.hp > 0) n++;
    return n;
  }

  teamHp(team: Team): number {
    let h = 0;
    for (const t of this.tanks) if (t.team === team) h += Math.max(0, t.hp);
    return h;
  }

  teamMaxHp(team: Team): number {
    let h = 0;
    for (const t of this.tanks) if (t.team === team) h += t.maxHp;
    return h;
  }

  teamSize(team: Team): number {
    let n = 0;
    for (const t of this.tanks) if (t.team === team) n++;
    return n;
  }

  isDone(): boolean {
    if (this.outcome && this.tick - this.outcome.endTick >= OUTRO_TICKS) {
      return true;
    }
    return this.tick >= TOTAL_TICKS;
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawGame(ctx, this);
  }
}

function normAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function resolveObstacleCollision(tank: Tank, o: Obstacle): void {
  const nearestX = clamp(tank.x, o.x, o.x + o.w);
  const nearestY = clamp(tank.y, o.y, o.y + o.h);
  const dx = tank.x - nearestX;
  const dy = tank.y - nearestY;
  const d2 = dx * dx + dy * dy;
  const r = tank.stats.radius;
  if (d2 < r * r && d2 > 0.0001) {
    const d = Math.sqrt(d2);
    const push = r - d;
    tank.x += (dx / d) * push;
    tank.y += (dy / d) * push;
  } else if (d2 <= 0.0001) {
    const distLeft = tank.x - o.x;
    const distRight = o.x + o.w - tank.x;
    const distTop = tank.y - o.y;
    const distBot = o.y + o.h - tank.y;
    const m = Math.min(distLeft, distRight, distTop, distBot);
    if (m === distLeft) tank.x = o.x - r;
    else if (m === distRight) tank.x = o.x + o.w + r;
    else if (m === distTop) tank.y = o.y - r;
    else tank.y = o.y + o.h + r;
  }
}

function resolveTankTankCollision(a: Tank, b: Tank): void {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d2 = dx * dx + dy * dy;
  const min = a.stats.radius + b.stats.radius;
  if (d2 < min * min && d2 > 0.0001) {
    const d = Math.sqrt(d2);
    const push = (min - d) * 0.5;
    a.x += (dx / d) * push;
    a.y += (dy / d) * push;
    b.x -= (dx / d) * push;
    b.y -= (dy / d) * push;
  }
}
