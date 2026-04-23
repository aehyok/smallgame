import { ARENA_H, ARENA_W, FPS } from "../../engine/loop.js";
import type { Bullet, DamageText, Fighter } from "./entity.js";
import type { CowboyGhostGame } from "./game.js";
import { getAvatarImage, type DrawableImage } from "./avatar-images.js";
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
  for (const ghost of game.ghosts) drawTrail(ctx, ghost, MUSK);
  drawBullets(ctx, game.bullets);
  for (const f of game.allFighters()) drawFighterShadow(ctx, f);
  for (const ghost of game.ghosts) drawLittleFighter(ctx, ghost);
  for (const cowboy of game.cowboys) drawLittleFighter(ctx, cowboy);
  drawDamageTexts(ctx, game.damageTexts);
  drawHud(ctx, game);
  drawResult(ctx, game);
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, ARENA_H);
  gradient.addColorStop(0, "#140d12");
  gradient.addColorStop(0.35, "#241824");
  gradient.addColorStop(1, "#0e0c14");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let i = 0; i < 22; i++) {
    const x = ((i * 131) % ARENA_W) + 20;
    const y = ((i * 197) % ARENA_H) + 20;
    ctx.beginPath();
    ctx.arc(x % ARENA_W, y % ARENA_H, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, ARENA_W, BOUNDS.top);
  ctx.fillRect(0, BOUNDS.bottom, ARENA_W, ARENA_H - BOUNDS.bottom);
}

function drawArena(ctx: CanvasRenderingContext2D): void {
  const width = BOUNDS.right - BOUNDS.left;
  const height = BOUNDS.bottom - BOUNDS.top;

  const arenaGrad = ctx.createLinearGradient(BOUNDS.left, BOUNDS.top, BOUNDS.right, BOUNDS.bottom);
  arenaGrad.addColorStop(0, "rgba(44,22,22,0.92)");
  arenaGrad.addColorStop(0.5, "rgba(35,24,40,0.94)");
  arenaGrad.addColorStop(1, "rgba(18,26,52,0.92)");
  ctx.fillStyle = arenaGrad;
  ctx.fillRect(BOUNDS.left, BOUNDS.top, width, height);

  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 10;
  ctx.strokeRect(BOUNDS.left, BOUNDS.top, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(BOUNDS.left + 12, BOUNDS.top + 12, width - 24, height - 24);

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

function drawBullets(
  ctx: CanvasRenderingContext2D,
  bullets: readonly Bullet[],
): void {
  for (const bullet of bullets) {
    const color = bullet.owner === "cowboy" ? "#ffd166" : "#bdefff";
    const tailX = bullet.x - bullet.vx * 0.02;
    const tailY = bullet.y - bullet.vy * 0.02;
    ctx.strokeStyle = color;
    ctx.lineWidth = bullet.radius * 1.3;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
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
  const avatarImage = getAvatarImage(fighter.kind);
  if (avatarImage) {
    drawAvatarBadgeImage(ctx, fighter, avatarImage, fighter.kind === "cowboy" ? TRUMP : MUSK);
    return;
  }
  if (fighter.kind === "cowboy") {
    drawTrumpBadge(ctx, fighter);
    return;
  }
  drawMuskBadge(ctx, fighter);
}

function drawAvatarBadgeImage(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  image: DrawableImage,
  accentColor: string,
): void {
  const r = 42;
  const imageWidth = (image as { width?: number }).width ?? 1;
  const imageHeight = (image as { height?: number }).height ?? 1;
  const scale = Math.min((r * 2 - 8) / imageWidth, (r * 2 - 8) / imageHeight);
  const drawW = imageWidth * scale;
  const drawH = imageHeight * scale;
  const drawX = -drawW / 2;
  const drawY = -drawH / 2;

  ctx.save();
  ctx.translate(fighter.x, fighter.y - 2);

  ctx.beginPath();
  ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = "#3a86d9";
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#dce7f5";
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.drawImage(image, drawX, drawY, drawW, drawH);

  if (fighter.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${fighter.hitFlash / 14})`;
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (fighter.attackFlash > 0) {
    ctx.save();
    ctx.rotate(fighter.facing);
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.85, fighter.attackFlash / 9)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(r - 4, -8);
    ctx.lineTo(r + 18, 0);
    ctx.lineTo(r - 4, 8);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
  drawHealthBar(ctx, fighter, accentColor);
}

function drawTrumpBadge(ctx: CanvasRenderingContext2D, fighter: Fighter): void {
  const r = 42;
  ctx.save();
  ctx.translate(fighter.x, fighter.y - 2);

  ctx.beginPath();
  ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = "#3a86d9";
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  const bg = ctx.createLinearGradient(0, -r, 0, r);
  bg.addColorStop(0, "#d8ecff");
  bg.addColorStop(1, "#a5c6e8");
  ctx.fillStyle = bg;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  ctx.fillStyle = "#244f8f";
  ctx.fillRect(-r, -r, r * 0.95, r * 0.78);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  for (let i = 0; i < 10; i++) {
    const sx = -r + 10 + (i % 3) * 12 + (Math.floor(i / 3) % 2) * 4;
    const sy = -r + 10 + Math.floor(i / 3) * 12;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#9f466c";
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(-r, -8 + i * 18, r * 2, 8);
  }

  ctx.beginPath();
  ctx.arc(2, 7, 22, 0, Math.PI * 2);
  ctx.fillStyle = fighter.alive ? "#ff9445" : "#8d7b72";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-20, -6);
  ctx.quadraticCurveTo(-12, -27, 8, -23);
  ctx.quadraticCurveTo(24, -18, 18, -2);
  ctx.quadraticCurveTo(2, -6, -10, -5);
  ctx.quadraticCurveTo(-18, -4, -20, -6);
  ctx.fillStyle = "#f6d06b";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-7, 5, 3.4, 2.4, 0, 0, Math.PI * 2);
  ctx.ellipse(9, 4, 3.4, 2.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-7, 5, 1.4, 0, Math.PI * 2);
  ctx.arc(9, 4, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = "#2d180d";
  ctx.fill();

  ctx.strokeStyle = "#8a3c1b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-13, -3);
  ctx.quadraticCurveTo(-6, -7, 0, -4);
  ctx.moveTo(3, -4);
  ctx.quadraticCurveTo(10, -8, 16, -4);
  ctx.stroke();

  ctx.strokeStyle = "#8a3c1b";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-1, 11);
  ctx.quadraticCurveTo(6, 16, 13, 11);
  ctx.stroke();

  ctx.fillStyle = "#1e335f";
  ctx.beginPath();
  ctx.moveTo(-20, 40);
  ctx.lineTo(-7, 16);
  ctx.lineTo(10, 16);
  ctx.lineTo(26, 40);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(-7, 16);
  ctx.lineTo(0, 28);
  ctx.lineTo(8, 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ff3f3f";
  ctx.beginPath();
  ctx.moveTo(0, 25);
  ctx.lineTo(-4, 39);
  ctx.lineTo(4, 39);
  ctx.closePath();
  ctx.fill();

  if (fighter.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${fighter.hitFlash / 14})`;
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (fighter.attackFlash > 0) {
    ctx.save();
    ctx.rotate(fighter.facing);
    ctx.strokeStyle = `rgba(255,240,210,${Math.min(0.85, fighter.attackFlash / 9)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(r - 4, -8);
    ctx.lineTo(r + 18, 0);
    ctx.lineTo(r - 4, 8);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
  drawHealthBar(ctx, fighter, TRUMP);
}

function drawMuskBadge(ctx: CanvasRenderingContext2D, fighter: Fighter): void {
  const r = 42;
  ctx.save();
  ctx.translate(fighter.x, fighter.y - 2);

  ctx.beginPath();
  ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = "#3a86d9";
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  const bg = ctx.createLinearGradient(0, -r, 0, r);
  bg.addColorStop(0, "#16253f");
  bg.addColorStop(0.65, "#536b9e");
  bg.addColorStop(1, "#f2b08f");
  ctx.fillStyle = bg;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  ctx.fillStyle = "#cc6647";
  ctx.beginPath();
  ctx.arc(-22, -10, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(245,219,193,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-22, -10, 21, 9, 0.35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(182,224,255,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-8, 0, 28, 0.5, Math.PI * 1.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(15, 2, 22, 2.7, Math.PI * 1.85);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const sx = -r + 8 + (i * 13) % 84;
    const sy = -r + 8 + ((i * 17) % 70);
    ctx.moveTo(sx + 1.5, sy);
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.save();
  ctx.translate(26, -6);
  ctx.rotate(-0.6);
  ctx.fillStyle = "#ecf6ff";
  ctx.fillRect(-2, -7, 4, 14);
  ctx.beginPath();
  ctx.moveTo(2, -4);
  ctx.lineTo(10, 0);
  ctx.lineTo(2, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9fbfe3";
  ctx.fillRect(-5, -2, 3, 4);
  ctx.fillRect(-1, -8, 2, 3);
  ctx.fillStyle = "#ffb347";
  ctx.beginPath();
  ctx.moveTo(-5, -2);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-5, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 4, 21, 0, Math.PI * 2);
  ctx.fillStyle = fighter.alive ? "#efb48f" : "#8d7b72";
  ctx.fill();

  ctx.fillStyle = "#2f2438";
  ctx.beginPath();
  ctx.moveTo(-17, -2);
  ctx.quadraticCurveTo(-9, -22, 12, -18);
  ctx.quadraticCurveTo(22, -14, 18, 0);
  ctx.quadraticCurveTo(4, -4, -8, -3);
  ctx.quadraticCurveTo(-14, -3, -17, -2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-7, 3, 3.4, 2.4, 0, 0, Math.PI * 2);
  ctx.ellipse(8, 3, 3.4, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d1621";
  ctx.beginPath();
  ctx.arc(-7, 3, 1.4, 0, Math.PI * 2);
  ctx.arc(8, 3, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3a2d37";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-12, -3);
  ctx.lineTo(-2, -4);
  ctx.moveTo(3, -4);
  ctx.lineTo(13, -3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-2, 12);
  ctx.quadraticCurveTo(5, 16, 12, 10);
  ctx.stroke();

  ctx.fillStyle = "#1d1f2b";
  ctx.beginPath();
  ctx.moveTo(-21, 40);
  ctx.lineTo(-8, 15);
  ctx.lineTo(10, 15);
  ctx.lineTo(24, 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#4a5064";
  ctx.fillRect(-10, 14, 20, 17);
  ctx.strokeStyle = "#d6ddeb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, 22);
  ctx.lineTo(12, 28);
  ctx.moveTo(12, 22);
  ctx.lineTo(6, 28);
  ctx.stroke();

  if (fighter.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${fighter.hitFlash / 14})`;
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (fighter.attackFlash > 0) {
    ctx.save();
    ctx.rotate(fighter.facing);
    ctx.strokeStyle = `rgba(220,244,255,${Math.min(0.85, fighter.attackFlash / 9)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(r - 4, -8);
    ctx.lineTo(r + 18, 0);
    ctx.lineTo(r - 4, 8);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
  drawHealthBar(ctx, fighter, MUSK);
}

function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  color: string,
): void {
  const width = 128;
  const height = 16;
  const x = fighter.x - width / 2;
  const y = fighter.y - fighter.radius - 36;
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
  for (const text of damageTexts) {
    ctx.font = `bold ${Math.round(text.size)}px sans-serif`;
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
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(0, 0, ARENA_W, BOUNDS.top - 24);

  const remaining = Math.max(
    0,
    ROUND_SECONDS - Math.floor(game.tick / FPS),
  );

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(40, 34, ARENA_W - 80, 108);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 34, ARENA_W - 80, 108);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TRUMP VS MUSK", ARENA_W / 2, 68);

  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`TIME ${String(remaining).padStart(2, "0")}`, ARENA_W / 2, 112);

  const cowboyHp = Math.ceil(game.teamHp("cowboy"));
  const ghostHp = Math.ceil(game.teamHp("ghost"));
  const cowboyAlive = game.teamAliveCount("cowboy");
  const ghostAlive = game.teamAliveCount("ghost");
  const sizeTag = game.teamSize > 1 ? ` x${game.teamSize}` : "";

  ctx.textAlign = "left";
  ctx.fillStyle = TRUMP;
  ctx.fillText(
    `${game.teamLabel("cowboy")}${sizeTag} ${cowboyHp} (${cowboyAlive})`,
    58,
    112,
  );

  ctx.textAlign = "right";
  ctx.fillStyle = MUSK;
  ctx.fillText(
    `${game.teamLabel("ghost")}${sizeTag} ${ghostHp} (${ghostAlive})`,
    ARENA_W - 58,
    112,
  );

  ctx.fillStyle = "rgba(0,0,0,0.36)";
  ctx.fillRect(0, BOUNDS.bottom + 18, ARENA_W, ARENA_H - (BOUNDS.bottom + 18));
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CENTER ARENA", ARENA_W / 2, BOUNDS.bottom + 62);
  ctx.font = "14px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillText("This game by AI Spark。", ARENA_W / 2, BOUNDS.bottom + 90);
}

function drawResult(ctx: CanvasRenderingContext2D, game: CowboyGhostGame): void {
  if (!game.outcome) return;
  let text = "DRAW";
  let color = "#ffffff";
  if (game.outcome.winner === "cowboy") {
    text = `${game.teamLabel("cowboy").toUpperCase()} WINS`;
    color = TRUMP;
  } else if (game.outcome.winner === "ghost") {
    text = `${game.teamLabel("ghost").toUpperCase()} WINS`;
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
