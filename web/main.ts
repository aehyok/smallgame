import {
  DEFAULT_GAME_ID,
  GAME_DEFINITIONS,
  getGameDefinition,
  requireGameDefinition,
  type GameDefinition,
  type GameInstance,
} from "../src/games/registry.js";
import { preloadBrowserAvatarImages } from "../src/games/cowboy-ghost/avatar-images.js";
import { createAudioPlayer } from "./audio.js";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const gameSelect = document.getElementById("game") as HTMLSelectElement;
const seedInput = document.getElementById("seed") as HTMLInputElement;
const countInput = document.getElementById("count") as HTMLInputElement;
const restartBtn = document.getElementById("restart") as HTMLButtonElement;
const nextBtn = document.getElementById("next") as HTMLButtonElement;
const muteBtn = document.getElementById("mute") as HTMLButtonElement;
const info = document.getElementById("info") as HTMLSpanElement;

const params = new URLSearchParams(window.location.search);

for (const definition of GAME_DEFINITIONS) {
  const option = document.createElement("option");
  option.value = definition.id;
  option.textContent = definition.title;
  gameSelect.append(option);
}

const initialGameId = getGameDefinition(params.get("game") ?? "")
  ? (params.get("game") as string)
  : DEFAULT_GAME_ID;
const initialSeed = Number.parseInt(params.get("seed") ?? seedInput.value, 10) || 1;
const initialCount = clampCount(
  Number.parseInt(params.get("count") ?? countInput.value, 10) || 1,
);

gameSelect.value = initialGameId;
seedInput.value = String(initialSeed);
countInput.value = String(initialCount);

let activeGameDef: GameDefinition = requireGameDefinition(initialGameId);
let activeCount = initialCount;
let game: GameInstance = activeGameDef.create(initialSeed, { count: activeCount });
let rafId = 0;
let playedSoundCount = 0;

function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(6, Math.max(1, Math.floor(n)));
}

function currentCount(): number {
  return clampCount(Number.parseInt(countInput.value, 10) || 1);
}

function currentSeed(): number {
  return Number.parseInt(seedInput.value, 10) || 1;
}

const audio = createAudioPlayer();
let audioUnlocked = false;
let muted = false;

async function unlockAudio() {
  await audio.resume();
  await audio.loaded;
  if (!audioUnlocked) {
    audioUnlocked = true;
    audio.startBgm();
  }
}

function reset(seed: number) {
  cancelAnimationFrame(rafId);
  playedSoundCount = 0;
  activeCount = currentCount();
  game = activeGameDef.create(seed, { count: activeCount });
  syncUrl(seed);
  if (audioUnlocked) audio.startBgm();
  loop();
}

function syncUrl(seed: number) {
  const nextParams = new URLSearchParams(window.location.search);
  nextParams.set("game", activeGameDef.id);
  nextParams.set("seed", String(seed));
  nextParams.set("count", String(activeCount));
  history.replaceState(null, "", `?${nextParams.toString()}`);
}

function drainSoundEvents() {
  if (!audioUnlocked || muted) {
    playedSoundCount = game.soundEvents.length;
    return;
  }
  while (playedSoundCount < game.soundEvents.length) {
    audio.play(game.soundEvents[playedSoundCount++]);
  }
}

function loop() {
  game.step();
  game.render(ctx);
  drainSoundEvents();
  info.textContent = activeGameDef.describePreview(game);
  if (!game.isDone()) {
    rafId = requestAnimationFrame(loop);
  } else if (audioUnlocked) {
    audio.stopBgm();
  }
}

gameSelect.addEventListener("change", async () => {
  activeGameDef = requireGameDefinition(gameSelect.value);
  await unlockAudio();
  reset(currentSeed());
});
restartBtn.addEventListener("click", async () => {
  await unlockAudio();
  reset(currentSeed());
});
nextBtn.addEventListener("click", async () => {
  await unlockAudio();
  const cur = currentSeed();
  seedInput.value = String(cur + 1);
  reset(cur + 1);
});
seedInput.addEventListener("change", async () => {
  await unlockAudio();
  reset(currentSeed());
});
countInput.addEventListener("change", async () => {
  countInput.value = String(currentCount());
  await unlockAudio();
  reset(currentSeed());
});
muteBtn.addEventListener("click", async () => {
  muted = !muted;
  muteBtn.textContent = muted ? "🔇 muted" : "🔊 sound";
  muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  audio.setMuted(muted);
  if (!muted) await unlockAudio();
});

syncUrl(initialSeed);
await preloadBrowserAvatarImages();
loop();
