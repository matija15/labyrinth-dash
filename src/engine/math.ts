import type { Rect, Vec2 } from '../types';

export const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const circleRect = (cx: number, cy: number, r: number, b: Rect) => {
  const nx = clamp(cx, b.x, b.x + b.w);
  const ny = clamp(cy, b.y, b.y + b.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
};

/** Snap an arbitrary swipe vector to one of 8 directions (components in -1/0/1). */
export const quantizeDir8 = (dx: number, dy: number): Vec2 => {
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  const a = octant * (Math.PI / 4);
  return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
};

/** Deterministic PRNG (mulberry32) so visual effects don't depend on Math.random. */
export const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
