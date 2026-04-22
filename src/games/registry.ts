import { CowboyGhostGame } from "./cowboy-ghost/game.js";
import { TankGame } from "./tank/game.js";

export interface GameOutcome {
  winner: string;
  endTick: number;
}

export interface GameInstance {
  readonly seed: number;
  tick: number;
  outcome: GameOutcome | null;
  step(): void;
  render(ctx: CanvasRenderingContext2D): void;
  isDone(): boolean;
}

export interface GameDefinition {
  id: string;
  title: string;
  create(seed: number): GameInstance;
  describePreview(game: GameInstance): string;
  describeResult(game: GameInstance): string;
  outputFileName(seed: number): string;
}

function defineGame<TGame extends GameInstance>(definition: {
  id: string;
  title: string;
  create(seed: number): TGame;
  describePreview(game: TGame): string;
  describeResult(game: TGame): string;
  outputFileName(seed: number): string;
}): GameDefinition {
  return definition as GameDefinition;
}

export const GAME_DEFINITIONS: readonly GameDefinition[] = [
  defineGame({
    id: "tank",
    title: "Tank Battle",
    create: (seed: number) => new TankGame(seed),
    describePreview: (game: TankGame) => {
      const redHp = Math.ceil(game.teamHp("red"));
      const blueHp = Math.ceil(game.teamHp("blue"));
      const redAlive = game.teamAliveCount("red");
      const blueAlive = game.teamAliveCount("blue");
      return `tick=${game.tick} R=${redHp}(${redAlive}) B=${blueHp}(${blueAlive}) ${game.outcome ? `→ ${game.outcome.winner} wins` : ""}`;
    },
    describeResult: (game: TankGame) =>
      `winner=${game.outcome?.winner ?? "unknown"} ticks=${game.tick}`,
    outputFileName: (seed: number) => `tank-battle-${seed}.mp4`,
  }),
  defineGame({
    id: "cowboy-ghost",
    title: "Trump vs Musk",
    create: (seed: number) => new CowboyGhostGame(seed),
    describePreview: (game: CowboyGhostGame) =>
      `tick=${game.tick} trump=${Math.ceil(game.fighterHp("cowboy"))} musk=${Math.ceil(game.fighterHp("ghost"))} ${game.outcome ? `→ ${game.winnerLabel()} wins` : ""}`,
    describeResult: (game: CowboyGhostGame) =>
      `winner=${game.winnerLabel()} ticks=${game.tick}`,
    outputFileName: (seed: number) => `cowboy-ghost-${seed}.mp4`,
  }),
];

export const DEFAULT_GAME_ID = GAME_DEFINITIONS[0].id;

export function getGameDefinition(gameId: string): GameDefinition | undefined {
  return GAME_DEFINITIONS.find((game) => game.id === gameId);
}

export function requireGameDefinition(gameId: string): GameDefinition {
  const game = getGameDefinition(gameId);
  if (game) return game;
  const supported = GAME_DEFINITIONS.map((item) => item.id).join(", ");
  throw new Error(`Unsupported game "${gameId}". Supported games: ${supported}`);
}
