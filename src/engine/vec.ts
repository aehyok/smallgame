export type Vec = { x: number; y: number };

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec): Vec => {
  const L = len(a);
  return L === 0 ? { x: 0, y: 0 } : { x: a.x / L, y: a.y / L };
};
export const fromAngle = (a: number, L = 1): Vec => ({
  x: Math.cos(a) * L,
  y: Math.sin(a) * L,
});
export const angleBetween = (a: Vec, b: Vec): number =>
  Math.atan2(b.y - a.y, b.x - a.x);

export const angleDiff = (a: number, b: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;
