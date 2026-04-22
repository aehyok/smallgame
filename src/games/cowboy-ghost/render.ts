import { ARENA_H, ARENA_W, FPS } from "../../engine/loop.js";
import type { DamageText, Fighter } from "./entity.js";
import type { CowboyGhostGame } from "./game.js";
import { BOUNDS, ROUND_SECONDS } from "./game.js";

const TRUMP = "#ff8a5b";
const TRUMP_DARK = "#c64d2b";
const MUSK = "#69a9ff";
const MUSK_DARK = "#264f91";

export function drawGame(
  ctx: CanvasRenderingContext2D,
  game: CowboyGhostGame,
): void {
  drawBackground(ctx);
  drawArena(ctx);
  drawTrail(ctx, game.ghost, MUSK);
  drawFighterShadow(ctx, game.cowboy);
  drawFighterShadow(ctx, game.ghost);
  drawLittleFighter(ctx, game.ghost);
  drawLittleFighter(ctx, game.cowboy);
  drawDamageTexts(ctx, game.damageTexts);
  drawHud(ctx, game);
  drawResult(ctx, game);
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, ARENA_H);
  gradient.addColorStop(0, "#23140b");
  gradient.addColorStop(0.5, "#4c2b1d");
  gradient.addColorStop(1, "#190d15");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let i = 0; i < 22; i++) {
    const x = ((i * 131) % ARENA_W) + 20;
    const y = ((i * 197) % ARENA_H) + 20;
    ctx.beginPath();
    ctx.arc(x % ARENA_W, y % ARENA_H, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawArena(ctx: CanvasRenderingContext2D): void {
  const width = BOUNDS.right - BOUNDS.left;
  const height = BOUNDS.bottom - BOUNDS.top;

  ctx.fillStyle = "rgba(14,12,10,0.55)";
  ctx.fillRect(BOUNDS.left, BOUNDS.top, width, height);

  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 10;
  ctx.strokeRect(BOUNDS.left, BOUNDS.top, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let x = BOUNDS.left + 64; x < BOUNDS.right; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, BOUNDS.top);
    ctx.lineTo(x, BOUNDS.bottom);
    ctx.stroke();
  }
  for (let y = BOUNDS.top + 64; y < BOUNDS.bottom; y += 64) {
    ctx.beginPath();
    ctx.moveTo(BOUNDS.left, y);
    ctx.lineTo(BOUNDS.right, y);
    ctx.stroke();
  }
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  color: string,
): void {
  if (!fighter.alive) return;
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 5; i++) {
    const scale = 1 - i * 0.13;
    ctx.fillStyle = i % 2 === 0 ? color : "#ffffff";
    ctx.beginPath();
    ctx.arc(
      fighter.x - fighter.vx * 0.02 * i,
      fighter.y - fighter.vy * 0.02 * i,
      fighter.radius * scale,
      Math.PI,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawFighterShadow(ctx: CanvasRenderingContext2D, fighter: Fighter): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(
    fighter.x,
    fighter.y + fighter.radius * 0.9,
    fighter.radius * 0.9,
    fighter.radius * 0.36,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function drawLittleFighter(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
): void {
  const isTrump = fighter.kind === "cowboy";
  const bodyColor = isTrump ? TRUMP : MUSK;
  const accentColor = isTrump ? TRUMP_DARK : MUSK_DARK;
  const skinColor = isTrump ? "#ffd2b5" : "#f0d1bc";
  const hairColor = isTrump ? "#f2c14d" : "#3f4b63";

  ctx.save();
  ctx.translate(fighter.x, fighter.y);

  ctx.save();
  ctx.rotate(fighter.facing);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-8, 8);
  ctx.lineTo(-14, fighter.radius + 10);
  ctx.moveTo(8, 8);
  ctx.lineTo(14, fighter.radius + 10);
  ctx.moveTo(0, -2);
  ctx.lineTo(-fighter.radius - 6, 8);
  ctx.moveTo(0, -2);
  ctx.lineTo(fighter.radius + 8, 2);
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.fillRect(fighter.radius + 1, -3, 10, 6);
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(-16, -2, 32, 34, 12);
  ctx.fillStyle = fighter.alive ? bodyColor : "#5b5b5b";
  ctx.fill();

  ctx.fillStyle = fighter.alive ? accentColor : "#444444";
  ctx.fillRect(-6, 6, 12, 26);

  ctx.beginPath();
  ctx.arc(0, -22, 16, 0, Math.PI * 2);
  ctx.fillStyle = fighter.alive ? skinColor : "#777777";
  ctx.fill();

  ctx.fillStyle = hairColor;
  if (isTrump) {
    ctx.beginPath();
    ctx.moveTo(-15, -28);
    ctx.quadraticCurveTo(-6, -42, 10, -35);
    ctx.quadraticCurveTo(16, -28, 10, -18);
    ctx.lineTo(-8, -18);
    ctx.quadraticCurveTo(-16, -21, -15, -28);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, -30, 14, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-6, -24, 3.4, 0, Math.PI * 2);
  ctx.arc(6, -24, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.arc(-6, -24, 1.5, 0, Math.PI * 2);
  ctx.arc(6, -24, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (isTrump) {
    ctx.moveTo(-6, -13);
    ctx.quadraticCurveTo(0, -9, 6, -13);
  } else {
    ctx.moveTo(-6, -11);
    ctx.lineTo(6, -11);
  }
  ctx.stroke();

  ctx.fillStyle = isTrump ? "#d63d3d" : "#1d2436";
  if (isTrump) {
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(-4, 18);
    ctx.lineTo(4, 18);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-11, -2, 22, 7);
  }

  if (fighter.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${fighter.hitFlash / 14})`;
    ctx.beginPath();
    ctx.arc(0, 0, fighter.radius + 10, 0, Math.PI * 2);
    ctx.fill();
  }

  if (fighter.attackFlash > 0) {
    ctx.save();
    ctx.rotate(fighter.facing);
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.8, fighter.attackFlash / 9)})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(fighter.radius + 8, -10);
    ctx.lineTo(fighter.radius + 28, 0);
    ctx.lineTo(fighter.radius + 8, 10);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  drawHealthBar(ctx, fighter, bodyColor);
}

function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  color: string,
): void {
  const width = 128;
  const height = 16;
  const x = fighter.x - width / 2;
  const y = fighter.y - fighter.radius - 42;
  const ratio = Math.max(0, fighter.hp) / fighter.maxHp;

  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(x - 2, y - 2, width + 4, height + 24);

  ctx.fillStyle = "#221810";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * ratio, height);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${fighter.label} ${Math.ceil(Math.max(0, fighter.hp))}`, fighter.x, y + 27);
}

function drawDamageTexts(
  ctx: CanvasRenderingContext2D,
  damageTexts: readonly DamageText[],
): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 28px sans-serif";
  for (const text of damageTexts) {
    ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
    ctx.fillStyle = text.color;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 5;
    ctx.strokeText(text.text, text.x, text.y);
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawHud(ctx: CanvasRenderingContext2D, game: CowboyGhostGame): void {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, ARENA_W, 86);

  const remaining = Math.max(
    0,
    ROUND_SECONDS - Math.floor(game.tick / FPS),
  );
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TRUMP VS MUSK", ARENA_W / 2, 28);
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(`TIME ${String(remaining).padStart(2, "0")}`, ARENA_W / 2, 62);
}

function drawResult(ctx: CanvasRenderingContext2D, game: CowboyGhostGame): void {
  if (!game.outcome) return;
  let text = "DRAW";
  let color = "#ffffff";
  if (game.outcome.winner === "cowboy") {
    text = `${game.cowboy.label.toUpperCase()} WINS`;
    color = TRUMP;
  } else if (game.outcome.winner === "ghost") {
    text = `${game.ghost.label.toUpperCase()} WINS`;
    color = MUSK;
  }

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(110, ARENA_H / 2 - 64, ARENA_W - 220, 128);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(110, ARENA_H / 2 - 64, ARENA_W - 220, 128);
  ctx.fillStyle = color;
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, ARENA_W / 2, ARENA_H / 2);
}
