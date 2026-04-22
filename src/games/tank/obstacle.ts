export interface Obstacle {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
}

export function isDestructible(o: Obstacle): boolean {
  return Number.isFinite(o.maxHp);
}
