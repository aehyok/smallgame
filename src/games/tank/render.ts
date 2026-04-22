import { ARENA_H, ARENA_W, FPS, TOTAL_TICKS } from "../../engine/loop.js";
import { BULLET_RADIUS } from "./bullet.js";
import type { Obstacle, Particle, TankGame } from "./game.js";
import { INTRO_TICKS, OUTRO_TICKS } from "./game.js";
import type { Tank, Team } from "./tank.js";

const RED = "#ff3b6b";
const RED_DARK = "#b61c43";
const BLUE = "#3ba8ff";
const BLUE_DARK = "#1664c4";

function teamColor(team: Team): string {
  return team === "red" ? RED : BLUE;
}
function teamDark(team: Team): string {
  return team === "red" ? RED_DARK : BLUE_DARK;
}

export function drawGame(ctx: CanvasRenderingContext2D, game: TankGame): void {
  let sx = 0;
  let sy = 0;
  if (game.screenShake > 0) {
    const s = game.screenShake;
    sx = Math.sin(game.tick * 13.1) * s * 0.6;
    sy = Math.cos(game.tick * 7.3) * s * 0.6;
  }

  ctx.save();
  ctx.translate(sx, sy);

  drawBackground(ctx);
  drawObstacles(ctx, game.obstacles);
  drawBullets(ctx, game);
  for (const t of game.tanks) drawTank(ctx, t);
  drawParticles(ctx, game.particles);

  ctx.restore();

  drawHUD(ctx, game);

  if (game.screenFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.4, game.screenFlash / 20)})`;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }

  drawBanners(ctx, game);
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, ARENA_H);
  g.addColorStop(0, "#0b1020");
  g.addColorStop(0.5, "#0f1830");
  g.addColorStop(1, "#090c1a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  ctx.strokeStyle = "rgba(90,120,180,0.10)";
  ctx.lineWidth = 1;
  const grid = 60;
  ctx.beginPath();
  for (let x = 0; x <= ARENA_W; x += grid) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_H);
  }
  for (let y = 0; y <= ARENA_H; y += grid) {
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_W, y);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(120,160,220,0.4)";
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, ARENA_W - 12, ARENA_H - 12);

  const vg = ctx.createRadialGradient(
    ARENA_W / 2,
    ARENA_H / 2,
    ARENA_W * 0.35,
    ARENA_W / 2,
    ARENA_H / 2,
    ARENA_W * 0.8,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: readonly Obstacle[],
): void {
  for (const o of obstacles) {
    ctx.save();
    ctx.fillStyle = "#2a3350";
    ctx.strokeStyle = "#4a5580";
    ctx.lineWidth = 2;
    roundRect(ctx, o.x, o.y, o.w, o.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 4);
    ctx.restore();
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, game: TankGame): void {
  for (const b of game.bullets) {
    const color = teamColor(b.team);
    const trailLen = Math.min(b.age, 6);
    const speed = Math.hypot(b.vx, b.vy);
    const tx = b.x - (b.vx / speed) * trailLen * 4;
    const ty = b.y - (b.vy / speed) * trailLen * 4;
    const grad = ctx.createLinearGradient(tx, ty, b.x, b.y);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, color);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawTank(ctx: CanvasRenderingContext2D, tank: Tank): void {
  const bodyColor = teamColor(tank.team);
  const darkColor = teamDark(tank.team);
  const dead = tank.hp <= 0;
  const flashAmt = tank.hitFlash / 10;
  const radius = tank.stats.radius;

  ctx.save();
  ctx.translate(tank.x, tank.y);

  ctx.save();
  ctx.rotate(tank.bodyAngle);
  const bodyW = 52;
  const bodyH = 46;
  ctx.fillStyle = "#1a1f2e";
  ctx.fillRect(-bodyW / 2 - 4, -bodyH / 2 - 8, bodyW + 8, 8);
  ctx.fillRect(-bodyW / 2 - 4, bodyH / 2, bodyW + 8, 8);
  ctx.fillStyle = "#0c0f18";
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(-bodyW / 2 - 4 + (i + 2) * 12, -bodyH / 2 - 8, 2, 8);
    ctx.fillRect(-bodyW / 2 - 4 + (i + 2) * 12, bodyH / 2, 2, 8);
  }
  const hullGrad = ctx.createLinearGradient(
    -bodyW / 2,
    -bodyH / 2,
    bodyW / 2,
    bodyH / 2,
  );
  hullGrad.addColorStop(0, bodyColor);
  hullGrad.addColorStop(1, darkColor);
  ctx.fillStyle = dead ? "#3a3a3a" : hullGrad;
  roundRect(ctx, -bodyW / 2, -bodyH / 2, bodyW, bodyH, 6);
  ctx.fill();
  ctx.strokeStyle = dead ? "#555" : darkColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (!dead) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(-bodyW / 2 + 4, -4, bodyW - 8, 4);
  }
  ctx.restore();

  ctx.save();
  ctx.rotate(tank.turretAngle);
  ctx.fillStyle = dead ? "#2e2e2e" : darkColor;
  ctx.strokeStyle = dead ? "#111" : "#000";
  ctx.lineWidth = 2;
  ctx.fillRect(0, -4, 34, 8);
  ctx.strokeRect(0, -4, 34, 8);
  ctx.fillStyle = "#111";
  ctx.fillRect(30, -6, 6, 12);
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fillStyle = dead ? "#3a3a3a" : bodyColor;
  ctx.fill();
  ctx.strokeStyle = dead ? "#111" : darkColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-4, 0, 5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fill();
  ctx.restore();

  if (flashAmt > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAmt * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  if (!dead) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const label = tank.name;
    ctx.font = "bold 13px sans-serif";
    const tw = ctx.measureText(label).width + 10;
    ctx.fillRect(tank.x - tw / 2, tank.y - radius - 22, tw, 16);
    ctx.fillStyle = bodyColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, tank.x, tank.y - radius - 14);
    ctx.restore();
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly Particle[],
): void {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHUD(ctx: CanvasRenderingContext2D, game: TankGame): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, ARENA_W, 72);

  drawTeamBar(ctx, game, "red", 18, 18, 300, false);
  drawTeamBar(ctx, game, "blue", ARENA_W - 18 - 300, 18, 300, true);

  const elapsed = Math.floor(game.tick / FPS);
  const remaining = Math.max(0, Math.floor(TOTAL_TICKS / FPS) - elapsed);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(remaining).padStart(2, "0"), ARENA_W / 2, 36);

  ctx.fillStyle = "#ffcc44";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("VS", ARENA_W / 2, 58);

  ctx.restore();
}

function drawTeamBar(
  ctx: CanvasRenderingContext2D,
  game: TankGame,
  team: Team,
  x: number,
  y: number,
  w: number,
  rightAlign: boolean,
): void {
  const h = 24;
  const color = teamColor(team);
  const alive = game.teamAliveCount(team);
  const size = game.teamSize(team);
  const hp = game.teamHp(team);
  const maxHp = game.teamMaxHp(team);
  const label = team === "red" ? "RED" : "BLUE";

  ctx.fillStyle = color;
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = rightAlign ? "right" : "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${label}  ${alive}/${size}`, rightAlign ? x + w : x, y - 4);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRect(ctx, x, y + 6, w, h, 6);
  ctx.fill();

  const pct = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
  const fw = w * pct;
  if (fw > 2) {
    ctx.fillStyle = color;
    if (rightAlign) {
      roundRect(ctx, x + w - fw, y + 6, fw, h, 6);
    } else {
      roundRect(ctx, x, y + 6, fw, h, 6);
    }
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y + 6, w, h, 6);
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.ceil(hp)}/${maxHp}`, x + w / 2, y + 6 + h / 2);
}

function drawBanners(ctx: CanvasRenderingContext2D, game: TankGame): void {
  if (game.tick < INTRO_TICKS + 12) {
    const t = game.tick / (INTRO_TICKS + 12);
    const alpha =
      t < 0.15 ? t / 0.15 : t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, ARENA_H / 2 - 90, ARENA_W, 180);
    ctx.fillStyle = RED;
    ctx.font = "bold 80px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("RED", ARENA_W / 2 - 30, ARENA_H / 2);
    ctx.fillStyle = "#ffcc44";
    ctx.font = "bold 64px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VS", ARENA_W / 2, ARENA_H / 2);
    ctx.fillStyle = BLUE;
    ctx.font = "bold 80px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("BLUE", ARENA_W / 2 + 30, ARENA_H / 2);
    ctx.restore();
  }

  if (game.outcome) {
    const since = game.tick - game.outcome.endTick;
    const total = OUTRO_TICKS;
    const t = Math.min(1, since / total);
    const popIn = Math.min(1, since / 10);
    const alpha = since < 4 ? 0 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, ARENA_H / 2 - 130, ARENA_W, 260);

    const winner = game.outcome.winner;
    const label =
      winner === "draw" ? "DRAW" : winner === "red" ? "RED WINS" : "BLUE WINS";
    const labelColor =
      winner === "draw" ? "#ffcc44" : winner === "red" ? RED : BLUE;

    const scale = 0.7 + popIn * 0.4;
    ctx.translate(ARENA_W / 2, ARENA_H / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = labelColor;
    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, -12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(`SEED ${game.seed}`, 0, 60);
    ctx.restore();

    const sweep = t * ARENA_H;
    const sg = ctx.createLinearGradient(0, sweep - 40, 0, sweep + 40);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, "rgba(255,255,255,0.08)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
