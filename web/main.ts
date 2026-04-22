import { TankGame } from "../src/games/tank/game.js";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const seedInput = document.getElementById("seed") as HTMLInputElement;
const restartBtn = document.getElementById("restart") as HTMLButtonElement;
const nextBtn = document.getElementById("next") as HTMLButtonElement;
const info = document.getElementById("info") as HTMLSpanElement;

let game = new TankGame(Number.parseInt(seedInput.value, 10) || 1);
let rafId = 0;

function reset(seed: number) {
  cancelAnimationFrame(rafId);
  game = new TankGame(seed);
  loop();
}

function loop() {
  game.step();
  game.render(ctx);
  const redHp = Math.ceil(game.teamHp("red"));
  const blueHp = Math.ceil(game.teamHp("blue"));
  const ra = game.teamAliveCount("red");
  const ba = game.teamAliveCount("blue");
  info.textContent = `tick=${game.tick} R=${redHp}(${ra}) B=${blueHp}(${ba}) ${game.outcome ? `→ ${game.outcome.winner} wins` : ""}`;
  if (!game.isDone()) {
    rafId = requestAnimationFrame(loop);
  }
}

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

loop();
