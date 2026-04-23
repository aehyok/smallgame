import { ARENA_H, ARENA_W, FPS } from "../../engine/loop.js";
import { POWERUP_CONFIG, type Bullet, type Commentary, type DamageText, type DeathParticle, type Fighter, type FlameTrail, type Obstacle, type PickupEffect, type PowerUp, type Wall } from "./entity.js";
import type { CowboyGhostGame } from "./game.js";
import { getAvatarImage, type DrawableImage } from "./avatar-images.js";
import { BOUNDS, INTRO_TICKS, ROUND_SECONDS } from "./game.js";

const TRUMP = "#ff8a5b";
const TRUMP_DARK = "#c64d2b";
const MUSK = "#69a9ff";
const MUSK_DARK = "#264f91";

export function drawGame(
  ctx: CanvasRenderingContext2D,
  game: CowboyGhostGame,
): void {
  // Screen shake
  let sx = 0;
  let sy = 0;
  if (game.screenShake > 0) {
    sx = Math.sin(game.tick * 13.7) * game.screenShake * 0.7;
    sy = Math.cos(game.tick * 9.3) * game.screenShake * 0.7;
  }

  ctx.save();
  ctx.translate(sx, sy);

  drawBackground(ctx);
  drawArena(ctx);

  // Intro phase: slide fighters in
  if (game.tick < INTRO_TICKS) {
    drawIntroFighters(ctx, game);
    ctx.restore();
    drawHud(ctx, game);
    drawIntroBanner(ctx, game);
    return;
  }

  for (const ghost of game.ghosts) drawTrail(ctx, ghost, MUSK);
  drawFlames(ctx, game.flames);
  drawWalls(ctx, game.walls, game.tick);
  drawPowerups(ctx, game.powerups, game.tick);
  drawBullets(ctx, game.bullets);
  drawObstacles(ctx, game.obstacles, game.tick);
  for (const f of game.allFighters()) drawFighterShadow(ctx, f);
  for (const ghost of game.ghosts) drawLittleFighter(ctx, ghost);
  for (const cowboy of game.cowboys) drawLittleFighter(ctx, cowboy);
  drawBuffIndicators(ctx, game.allFighters());
  drawDeathParticles(ctx, game.deathParticles);
  drawPickupEffects(ctx, game.pickupEffects);
  drawDamageTexts(ctx, game.damageTexts);

  ctx.restore();

  // KO overlay (not affected by screen shake)
  if (game.koEffect) drawKOEffect(ctx, game);

  // Shrink zone overlay
  if (game.shrinkProgress() > 0) drawShrinkZone(ctx, game);

  // Low health vignette
  drawLowHealthVignette(ctx, game);

  drawHud(ctx, game);
  drawCommentaries(ctx, game.commentaries);
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
    const glow = bullet.owner === "cowboy" ? "rgba(255,209,102,0.3)" : "rgba(189,239,255,0.3)";

    // Trail glow
    const tailLen = 0.04;
    const tailX = bullet.x - bullet.vx * tailLen;
    const tailY = bullet.y - bullet.vy * tailLen;
    ctx.save();
    ctx.strokeStyle = glow;
    ctx.lineWidth = bullet.radius * 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.restore();

    // Core trail
    ctx.strokeStyle = color;
    ctx.lineWidth = bullet.radius * 1.3;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    // Bright tip
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
  const s = fighter.scaleMultiplier;
  const isDrunk = fighter.drunkTicks > 0;

  // Apply scale + drunk wobble
  if (s !== 1 || isDrunk) {
    ctx.save();
    ctx.translate(fighter.x, fighter.y);
    if (s !== 1) ctx.scale(s, s);
    if (isDrunk) {
      const wobble = Math.sin(fighter.drunkTicks * 0.4) * 0.2;
      ctx.rotate(wobble);
    }
    ctx.translate(-fighter.x, -fighter.y);
  }

  const avatarImage = getAvatarImage(fighter.kind);
  if (avatarImage) {
    drawAvatarBadgeImage(ctx, fighter, avatarImage, fighter.kind === "cowboy" ? TRUMP : MUSK);
  } else if (fighter.kind === "cowboy") {
    drawTrumpBadge(ctx, fighter);
  } else {
    drawMuskBadge(ctx, fighter);
  }

  if (s !== 1 || isDrunk) {
    ctx.restore();
  }
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

  // Shield overlay
  if (fighter.shieldHp > 0) {
    const shieldRatio = Math.min(1, fighter.shieldHp / 500);
    ctx.fillStyle = "rgba(68,170,255,0.45)";
    ctx.fillRect(x, y, width * shieldRatio, height);
  }

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const shieldText = fighter.shieldHp > 0 ? ` +${Math.ceil(fighter.shieldHp)}` : "";
  ctx.fillText(`${fighter.label} ${Math.ceil(Math.max(0, fighter.hp))}${shieldText}`, fighter.x, y + 27);
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

  // Countdown warning (last 5 seconds)
  if (!game.outcome && remaining <= 5 && remaining > 0) {
    const countPulse = 1 + 0.3 * Math.sin((game.tick % FPS) / FPS * Math.PI * 2);
    ctx.save();
    ctx.translate(ARENA_W / 2, ARENA_H / 2);
    ctx.scale(countPulse, countPulse);
    ctx.globalAlpha = 0.7;
    ctx.font = "bold 120px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 6;
    ctx.strokeText(`${remaining}`, 0, 0);
    ctx.fillStyle = remaining <= 2 ? "#ff4444" : remaining <= 3 ? "#ffaa44" : "#ffffff";
    ctx.fillText(`${remaining}`, 0, 0);
    ctx.restore();
  }

  // Skill CD indicators
  drawSkillCDs(ctx, game);
}

function drawSkillCDs(
  ctx: CanvasRenderingContext2D,
  game: CowboyGhostGame,
): void {
  const cowboy = game.cowboys.find(f => f.alive);
  const ghost = game.ghosts.find(f => f.alive);
  if (!cowboy && !ghost) return;

  const y = BOUNDS.bottom + 42;
  const barW = 80;
  const barH = 8;

  if (cowboy) {
    const cd = cowboy.skillCooldown;
    const maxCd = 8 * FPS;
    const ratio = Math.max(0, 1 - cd / maxCd);
    const ready = cd <= 0;

    ctx.fillStyle = ready ? "rgba(255,209,102,0.8)" : "rgba(255,255,255,0.15)";
    ctx.font = ready ? "bold 12px sans-serif" : "12px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(ready ? "WALL ✓" : "WALL", ARENA_W / 2 - 50, y);

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(ARENA_W / 2 - 48 - barW, y - barH / 2, barW, barH);
    ctx.fillStyle = ready ? "#ffd166" : "#665522";
    ctx.fillRect(ARENA_W / 2 - 48 - barW, y - barH / 2, barW * ratio, barH);
  }

  if (ghost) {
    const cd = ghost.skillCooldown;
    const maxCd = 6 * FPS;
    const ratio = Math.max(0, 1 - cd / maxCd);
    const ready = cd <= 0;

    ctx.fillStyle = ready ? "rgba(189,239,255,0.8)" : "rgba(255,255,255,0.15)";
    ctx.font = ready ? "bold 12px sans-serif" : "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(ready ? "DASH ✓" : "DASH", ARENA_W / 2 + 50, y);

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(ARENA_W / 2 + 48, y - barH / 2, barW, barH);
    ctx.fillStyle = ready ? "#bdefff" : "#225566";
    ctx.fillRect(ARENA_W / 2 + 48, y - barH / 2, barW * ratio, barH);
  }
}

function drawResult(ctx: CanvasRenderingContext2D, game: CowboyGhostGame): void {
  if (!game.outcome) return;
  const since = game.tick - game.outcome.endTick;
  const popIn = Math.min(1, since / 12);
  if (since < 4) return;

  let text = "DRAW";
  let color = "#ffffff";
  let winnerKind: "cowboy" | "ghost" | null = null;
  if (game.outcome.winner === "cowboy") {
    text = `${game.teamLabel("cowboy").toUpperCase()} WINS`;
    color = TRUMP;
    winnerKind = "cowboy";
  } else if (game.outcome.winner === "ghost") {
    text = `${game.teamLabel("ghost").toUpperCase()} WINS`;
    color = MUSK;
    winnerKind = "ghost";
  }

  ctx.save();
  // Dark overlay
  ctx.fillStyle = `rgba(0,0,0,${0.3 + popIn * 0.3})`;
  ctx.fillRect(0, ARENA_H / 2 - 160, ARENA_W, 320);

  // Pop-in scale
  const scale = 0.6 + popIn * 0.4;
  ctx.translate(ARENA_W / 2, ARENA_H / 2 - 40);
  ctx.scale(scale, scale);

  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 30 * popIn;

  ctx.fillStyle = color;
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, -30);

  ctx.shadowBlur = 0;

  // Stats
  if (since > 16) {
    const statsAlpha = Math.min(1, (since - 16) / 12);
    ctx.globalAlpha = statsAlpha;
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "#cccccc";

    const cowboyHp = game.teamHp("cowboy");
    const ghostHp = game.teamHp("ghost");
    const cowboyMaxHp = game.teamMaxHp("cowboy");
    const ghostMaxHp = game.teamMaxHp("ghost");
    const duration = ((game.outcome.endTick - 90) / FPS).toFixed(1);

    ctx.fillText(`Battle Duration: ${duration}s`, 0, 20);

    // Team stats
    const y1 = 55;
    ctx.fillStyle = TRUMP;
    ctx.textAlign = "right";
    ctx.fillText(`${game.teamLabel("cowboy")}`, -20, y1);
    ctx.fillStyle = "#aaaaaa";
    ctx.textAlign = "center";
    ctx.fillText("VS", 0, y1);
    ctx.fillStyle = MUSK;
    ctx.textAlign = "left";
    ctx.fillText(`${game.teamLabel("ghost")}`, 20, y1);

    const y2 = 80;
    ctx.font = "16px sans-serif";
    ctx.fillStyle = TRUMP;
    ctx.textAlign = "right";
    ctx.fillText(`HP: ${cowboyHp}/${cowboyMaxHp}`, -20, y2);
    ctx.fillStyle = MUSK;
    ctx.textAlign = "left";
    ctx.fillText(`HP: ${ghostHp}/${ghostMaxHp}`, 20, y2);

    ctx.globalAlpha = 1;
  }

  // Seed
  ctx.fillStyle = "#888888";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`SEED ${game.seed}`, 0, 110);

  ctx.restore();

  // Winner spotlight
  if (winnerKind && since > 8) {
    const winners = winnerKind === "cowboy" ? game.cowboys : game.ghosts;
    const alive = winners.filter(f => f.alive);
    if (alive.length > 0) {
      ctx.save();
      const spotAlpha = Math.min(0.35, (since - 8) / 30);
      for (const f of alive) {
        const spotGrad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius + 60);
        spotGrad.addColorStop(0, `rgba(255,255,200,${spotAlpha})`);
        spotGrad.addColorStop(1, "rgba(255,255,200,0)");
        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius + 60, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ==================== NEW EFFECTS ====================

function drawDeathParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly DeathParticle[],
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

function drawKOEffect(
  ctx: CanvasRenderingContext2D,
  game: CowboyGhostGame,
): void {
  const ko = game.koEffect;
  if (!ko) return;

  const t = ko.age / ko.maxAge;
  if (t > 1) return;

  // Screen flash on first few frames
  if (ko.age < 6) {
    const flashAlpha = (1 - ko.age / 6) * 0.45;
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }

  // K.O. text
  const textAge = ko.age;
  const textAlpha = textAge < 4 ? textAge / 4 : textAge > ko.maxAge - 10 ? Math.max(0, (ko.maxAge - textAge) / 10) : 1;
  const popScale = textAge < 8 ? 0.5 + (textAge / 8) * 0.7 : 1.2 - Math.min(0.2, (textAge - 8) / 30);

  ctx.save();
  ctx.globalAlpha = textAlpha;
  ctx.translate(ko.x, ko.y - 20);
  ctx.scale(popScale, popScale);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.font = "bold 80px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ko.label, 3, 3);

  // Main text with glow
  ctx.shadowColor = ko.color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = ko.color;
  ctx.fillText(ko.label, 0, 0);

  // White outline
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.strokeText(ko.label, 0, 0);

  ctx.restore();
}

function drawIntroFighters(
  ctx: CanvasRenderingContext2D,
  game: CowboyGhostGame,
): void {
  const t = game.tick / INTRO_TICKS;
  // Ease-out: fighters slide from off-screen to their positions
  const slide = t < 0.6 ? easeOutCubic(t / 0.6) : 1;

  for (const cowboy of game.cowboys) {
    const ox = -(1 - slide) * 400;
    ctx.save();
    ctx.translate(ox, 0);
    drawFighterShadow(ctx, cowboy);
    drawLittleFighter(ctx, cowboy);
    ctx.restore();
  }

  for (const ghost of game.ghosts) {
    const ox = (1 - slide) * 400;
    ctx.save();
    ctx.translate(ox, 0);
    drawFighterShadow(ctx, ghost);
    drawLittleFighter(ctx, ghost);
    ctx.restore();
  }
}

function drawIntroBanner(
  ctx: CanvasRenderingContext2D,
  game: CowboyGhostGame,
): void {
  const t = game.tick / INTRO_TICKS;

  // VS banner (first half)
  if (t < 0.55) {
    const bannerAlpha = t < 0.1 ? t / 0.1 : 1;
    ctx.save();
    ctx.globalAlpha = bannerAlpha;

    // Dark stripe
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, ARENA_H / 2 - 80, ARENA_W, 160);

    // Names
    ctx.textBaseline = "middle";
    const nameSlide = easeOutCubic(Math.min(1, t / 0.35));

    ctx.fillStyle = TRUMP;
    ctx.font = "bold 52px sans-serif";
    ctx.textAlign = "right";
    const trumpX = ARENA_W / 2 - 40 + (1 - nameSlide) * -200;
    ctx.fillText("TRUMP", trumpX, ARENA_H / 2 - 10);

    ctx.fillStyle = MUSK;
    ctx.textAlign = "left";
    const muskX = ARENA_W / 2 + 40 + (1 - nameSlide) * 200;
    ctx.fillText("MUSK", muskX, ARENA_H / 2 - 10);

    // VS
    const vsScale = 0.5 + nameSlide * 0.5;
    ctx.save();
    ctx.translate(ARENA_W / 2, ARENA_H / 2 - 10);
    ctx.scale(vsScale, vsScale);
    ctx.fillStyle = "#ffcc44";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VS", 0, 0);
    ctx.restore();

    // Seed label
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`SEED #${game.seed}`, ARENA_W / 2, ARENA_H / 2 + 40);

    ctx.restore();
  }

  // FIGHT! text (last phase)
  if (t > 0.6) {
    const fightT = (t - 0.6) / 0.4;
    const fightAlpha = fightT < 0.2 ? fightT / 0.2 : fightT > 0.7 ? Math.max(0, (1 - fightT) / 0.3) : 1;
    const fightScale = fightT < 0.15 ? 1.8 - fightT / 0.15 * 0.8 : 1.0;

    ctx.save();
    ctx.globalAlpha = fightAlpha;
    ctx.translate(ARENA_W / 2, ARENA_H / 2);
    ctx.scale(fightScale, fightScale);

    // Glow
    ctx.shadowColor = "#ff4444";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FIGHT!", 0, 0);

    // White stroke
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.strokeText("FIGHT!", 0, 0);

    ctx.restore();
  }
}

function drawLowHealthVignette(
  ctx: CanvasRenderingContext2D,
  game: CowboyGhostGame,
): void {
  const cowboyRatio = game.teamHp("cowboy") / game.teamMaxHp("cowboy");
  const ghostRatio = game.teamHp("ghost") / game.teamMaxHp("ghost");
  const minRatio = Math.min(cowboyRatio, ghostRatio);

  if (minRatio > 0.25 || minRatio <= 0) return;

  const intensity = (0.25 - minRatio) / 0.25;
  const pulse = 0.5 + 0.5 * Math.sin(game.tick * 0.12);
  const alpha = intensity * 0.25 * (0.6 + pulse * 0.4);

  const vg = ctx.createRadialGradient(
    ARENA_W / 2, ARENA_H / 2, ARENA_W * 0.3,
    ARENA_W / 2, ARENA_H / 2, ARENA_W * 0.85,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(200,30,30,${alpha})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
}

function drawPowerups(
  ctx: CanvasRenderingContext2D,
  powerups: readonly PowerUp[],
  tick: number,
): void {
  for (const pu of powerups) {
    const config = POWERUP_CONFIG[pu.kind];
    const bob = Math.sin(tick * 0.08) * 4;
    const pulse = 0.85 + 0.15 * Math.sin(tick * 0.12);
    const spawnScale = Math.min(1, pu.age / 12);
    const r = pu.radius * pulse * spawnScale;

    ctx.save();
    ctx.translate(pu.x, pu.y + bob);

    // Outer glow
    ctx.shadowColor = config.glow;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = `${config.glow}44`;
    ctx.fill();

    // Inner circle
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(0, -r * 0.3, 0, 0, 0, r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.4, config.color);
    grad.addColorStop(1, config.glow);
    ctx.fillStyle = grad;
    ctx.fill();

    // Border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff88";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Icon text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const icons: Record<string, string> = { heal: "+", rage: "!", shield: "S", speed: "»", big: "B", tiny: "t", swap: "↔", drunk: "~" };
    const icon = icons[pu.kind] ?? "?";
    ctx.fillText(icon, 0, 1);

    ctx.restore();
  }
}

function drawBuffIndicators(
  ctx: CanvasRenderingContext2D,
  fighters: readonly Fighter[],
): void {
  for (const f of fighters) {
    if (!f.alive) continue;

    // Shield ring
    if (f.shieldHp > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(68,170,255,0.6)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Rage aura
    if (f.rageTicks > 0) {
      ctx.save();
      const alpha = 0.15 + 0.1 * Math.sin(f.rageTicks * 0.3);
      ctx.fillStyle = `rgba(255,50,50,${alpha})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius + 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Speed trail
    if (f.speedBoostTicks > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#ffdd44";
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(
          f.x - f.vx * 0.015 * i,
          f.y - f.vy * 0.015 * i,
          f.radius * (1 - i * 0.2),
          0, Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Drunk swirl
    if (f.drunkTicks > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#cc88ff";
      ctx.lineWidth = 2;
      const swirlR = f.radius + 20;
      const swirlOffset = f.drunkTicks * 0.15;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 1.5; a += 0.1) {
        const sr = swirlR * (0.4 + a / (Math.PI * 2));
        const sx = f.x + Math.cos(a + swirlOffset) * sr;
        const sy = f.y + Math.sin(a + swirlOffset) * sr;
        if (a === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Desperation aura (< 30% HP)
    if (f.alive && f.hp > 0 && f.hp / f.maxHp < 0.3) {
      ctx.save();
      const pulse = 0.4 + 0.3 * Math.sin(Date.now() * 0.008);
      const desColor = f.kind === "cowboy" ? `rgba(255,180,80,${pulse})` : `rgba(100,200,255,${pulse})`;
      ctx.strokeStyle = desColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius + 22, 0, Math.PI * 2);
      ctx.stroke();
      // "DESPERATE" label
      ctx.fillStyle = desColor;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("BERSERK", f.x, f.y - f.radius - 24);
      ctx.restore();
    }

    // Big/Tiny label
    if (f.bigTicks > 0 || f.tinyTicks > 0) {
      ctx.save();
      const label = f.bigTicks > 0 ? "BIG!" : "TINY!";
      const col = f.bigTicks > 0 ? "#ff88ff" : "#88ffcc";
      ctx.fillStyle = col;
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, f.x, f.y - f.radius - 8);
      ctx.restore();
    }
  }
}

function drawPickupEffects(
  ctx: CanvasRenderingContext2D,
  effects: readonly PickupEffect[],
): void {
  for (const e of effects) {
    const alpha = Math.max(0, 1 - e.age / e.maxAge);
    const scale = 0.8 + (e.age / e.maxAge) * 0.4;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(e.x, e.y);
    ctx.scale(scale, scale);

    ctx.shadowColor = e.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = e.color;
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.label, 0, 0);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeText(e.label, 0, 0);

    ctx.restore();
  }
}

function drawWalls(
  ctx: CanvasRenderingContext2D,
  walls: readonly Wall[],
  tick: number,
): void {
  for (const wall of walls) {
    const hpRatio = wall.hp / wall.maxHp;
    ctx.save();
    ctx.translate(wall.x, wall.y);
    ctx.rotate(wall.angle);

    // Wall body
    const grad = ctx.createLinearGradient(0, -wall.height / 2, 0, wall.height / 2);
    grad.addColorStop(0, "#ffd166");
    grad.addColorStop(1, "#cc8833");
    ctx.fillStyle = grad;
    ctx.fillRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);

    // Brick pattern
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    const brickW = 20;
    const brickH = wall.height / 2;
    for (let row = 0; row < 2; row++) {
      const y = -wall.height / 2 + row * brickH;
      const offset = row % 2 === 0 ? 0 : brickW / 2;
      for (let bx = -wall.width / 2 + offset; bx < wall.width / 2; bx += brickW) {
        ctx.strokeRect(bx, y, brickW, brickH);
      }
    }

    // Border
    ctx.strokeStyle = "#ffeeaa";
    ctx.lineWidth = 2;
    ctx.strokeRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);

    // Damage cracks
    if (hpRatio < 0.6) {
      ctx.strokeStyle = `rgba(80,30,0,${0.6 - hpRatio})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-wall.width * 0.2, -wall.height * 0.4);
      ctx.lineTo(wall.width * 0.1, wall.height * 0.3);
      ctx.moveTo(wall.width * 0.15, -wall.height * 0.3);
      ctx.lineTo(-wall.width * 0.1, wall.height * 0.4);
      ctx.stroke();
    }

    // "BUILD WALL" label
    ctx.rotate(-wall.angle);
    ctx.fillStyle = "rgba(255,209,102,0.7)";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("WALL", 0, -wall.height / 2 - 4);

    ctx.restore();
  }
}

function drawFlames(
  ctx: CanvasRenderingContext2D,
  flames: readonly FlameTrail[],
): void {
  for (const flame of flames) {
    const t = flame.life / flame.maxLife;
    const r = flame.radius * (0.6 + t * 0.4);
    ctx.save();

    // Outer glow
    const glow = ctx.createRadialGradient(flame.x, flame.y, 0, flame.x, flame.y, r * 1.5);
    glow.addColorStop(0, `rgba(255,136,68,${t * 0.6})`);
    glow.addColorStop(0.5, `rgba(255,68,0,${t * 0.3})`);
    glow.addColorStop(1, "rgba(255,68,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(flame.x, flame.y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.globalAlpha = t;
    ctx.fillStyle = "#ffcc44";
    ctx.beginPath();
    ctx.arc(flame.x, flame.y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawShrinkZone(
  ctx: CanvasRenderingContext2D,
  game: CowboyGhostGame,
): void {
  const s = game.shrinkProgress();
  if (s <= 0) return;

  const ab = game.activeBounds();
  const pulse = 0.5 + 0.3 * Math.sin(game.tick * 0.06);
  const alpha = Math.min(0.5, s * 0.6) * pulse;

  ctx.save();

  // Poison fog: draw 4 rectangles around the safe zone
  ctx.fillStyle = `rgba(120,30,180,${alpha})`;
  // Top strip
  ctx.fillRect(0, 0, ARENA_W, ab.top);
  // Bottom strip
  ctx.fillRect(0, ab.bottom, ARENA_W, ARENA_H - ab.bottom);
  // Left strip
  ctx.fillRect(0, ab.top, ab.left, ab.bottom - ab.top);
  // Right strip
  ctx.fillRect(ab.right, ab.top, ARENA_W - ab.right, ab.bottom - ab.top);

  ctx.restore();

  ctx.save();
  // Glowing border on the safe zone edge
  ctx.strokeStyle = `rgba(180,60,255,${0.4 + pulse * 0.4})`;
  ctx.lineWidth = 3;
  ctx.shadowColor = "#aa44ff";
  ctx.shadowBlur = 16 * s;
  ctx.strokeRect(ab.left, ab.top, ab.right - ab.left, ab.bottom - ab.top);
  ctx.shadowBlur = 0;

  // "DANGER ZONE" warning text
  if (s > 0.1) {
    const warnAlpha = Math.min(1, s * 2) * pulse;
    ctx.fillStyle = `rgba(255,80,200,${warnAlpha})`;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("⚠ DANGER ZONE ⚠", ARENA_W / 2, ab.top - 28);
  }

  ctx.restore();
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: readonly Obstacle[],
  tick: number,
): void {
  for (const ob of obstacles) {
    ctx.save();
    const fadeIn = Math.min(1, (ob.maxLife - ob.life) / 12);
    const fadeOut = Math.min(1, ob.life / 18);
    ctx.globalAlpha = Math.min(fadeIn, fadeOut) * 0.9;

    const pulse = 1 + 0.06 * Math.sin(tick * 0.15);
    const r = ob.radius * pulse;

    if (ob.shape === "spikeball") {
      // Spiked iron ball
      ctx.translate(ob.x, ob.y);
      ctx.rotate(tick * 0.06);

      // Metal body
      const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 2, 0, 0, r * 1.2);
      grad.addColorStop(0, "#dddddd");
      grad.addColorStop(0.35, "#888888");
      grad.addColorStop(1, "#2a2a2a");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Spikes
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 3;
      const spikes = 10;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r * 0.9), Math.sin(a) * (r * 0.9));
        ctx.lineTo(Math.cos(a) * (r * 1.45), Math.sin(a) * (r * 1.45));
        ctx.stroke();
      }

      // Highlight
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, -2.2, -0.6);
      ctx.stroke();
    } else {
      // Firewall: a horizontal flame wall
      const len = ob.length ?? 240;
      const half = len / 2;
      const h = ob.radius * 2.2;

      // Base glow
      const glow = ctx.createLinearGradient(ob.x - half, ob.y, ob.x + half, ob.y);
      glow.addColorStop(0, "rgba(255,80,20,0.0)");
      glow.addColorStop(0.2, "rgba(255,120,40,0.35)");
      glow.addColorStop(0.5, "rgba(255,220,90,0.45)");
      glow.addColorStop(0.8, "rgba(255,120,40,0.35)");
      glow.addColorStop(1, "rgba(255,80,20,0.0)");
      ctx.fillStyle = glow;
      ctx.fillRect(ob.x - half - 20, ob.y - h * 0.8, len + 40, h * 1.6);

      // Flames
      ctx.fillStyle = "rgba(255,140,40,0.85)";
      ctx.beginPath();
      const teeth = 14;
      for (let i = 0; i <= teeth; i++) {
        const t = i / teeth;
        const x = (ob.x - half) + t * len;
        const flicker = 0.7 + 0.3 * Math.sin(tick * 0.25 + t * 10);
        const y = ob.y - (h * (0.55 + 0.45 * flicker));
        if (i === 0) ctx.moveTo(x, ob.y + h * 0.35);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(ob.x + half, ob.y + h * 0.35);
      ctx.closePath();
      ctx.fill();

      // Hot core line
      ctx.strokeStyle = "rgba(255,255,180,0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ob.x - half, ob.y);
      ctx.lineTo(ob.x + half, ob.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawCommentaries(
  ctx: CanvasRenderingContext2D,
  commentaries: readonly Commentary[],
): void {
  for (const c of commentaries) {
    const t = c.age / c.maxAge;
    const fadeIn = Math.min(1, c.age / 6);
    const fadeOut = Math.max(0, 1 - (t - 0.7) / 0.3);
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.font = `bold ${c.size}px CJK, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Shadow/outline for readability
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText(c.text, c.x, c.y);

    ctx.fillStyle = c.color;
    ctx.fillText(c.text, c.x, c.y);

    ctx.restore();
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
