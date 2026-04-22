import {
  DEFAULT_GAME_ID,
  GAME_DEFINITIONS,
  getGameDefinition,
  requireGameDefinition,
  type GameDefinition,
  type GameInstance,
} from "../src/games/registry.js";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const gameSelect = document.getElementById("game") as HTMLSelectElement;
const seedInput = document.getElementById("seed") as HTMLInputElement;
const restartBtn = document.getElementById("restart") as HTMLButtonElement;
const nextBtn = document.getElementById("next") as HTMLButtonElement;
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

gameSelect.value = initialGameId;
seedInput.value = String(initialSeed);

let activeGameDef: GameDefinition = requireGameDefinition(initialGameId);
let game: GameInstance = activeGameDef.create(initialSeed);
let rafId = 0;

function reset(seed: number) {
  cancelAnimationFrame(rafId);
  game = activeGameDef.create(seed);
  syncUrl(seed);
  loop();
}

function syncUrl(seed: number) {
  const nextParams = new URLSearchParams(window.location.search);
  nextParams.set("game", activeGameDef.id);
  nextParams.set("seed", String(seed));
  history.replaceState(null, "", `?${nextParams.toString()}`);
}

function loop() {
  game.step();
  game.render(ctx);
  info.textContent = activeGameDef.describePreview(game);
  if (!game.isDone()) {
    rafId = requestAnimationFrame(loop);
  }
}

gameSelect.addEventListener("change", () => {
  activeGameDef = requireGameDefinition(gameSelect.value);
  reset(Number.parseInt(seedInput.value, 10) || 1);
});
restartBtn.addEventListener("click", () => {
  reset(Number.parseInt(seedInput.value, 10) || 1);
});
nextBtn.addEventListener("click", () => {
  const cur = Number.parseInt(seedInput.value, 10) || 1;
  seedInput.value = String(cur + 1);
  reset(cur + 1);
});
seedInput.addEventListener("change", () => {
  reset(Number.parseInt(seedInput.value, 10) || 1);
});

syncUrl(initialSeed);
loop();
