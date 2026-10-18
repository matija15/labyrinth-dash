import { PLAYER_H, PLAYER_W } from './constants';
import type { Game } from './game';

/** Samples per second of game time. */
export const GHOST_HZ = 30;

/** Best-run replay: player top-left position sampled at GHOST_HZ. */
export interface Ghost {
  ms: number;
  xs: number[];
  ys: number[];
}

export class GhostRecorder {
  private xs: number[] = [];
  private ys: number[] = [];

  /** Call after every step; a restarted run (time going back) starts a fresh recording. */
  sample(game: Pick<Game, 'time' | 'player'>) {
    const k = Math.floor(game.time * GHOST_HZ);
    if (k < this.xs.length - 1) {
      this.xs = [];
      this.ys = [];
    }
    while (this.xs.length <= k) {
      this.xs.push(Math.round(game.player.x * 10) / 10);
      this.ys.push(Math.round(game.player.y * 10) / 10);
    }
  }

  finish(ms: number): Ghost {
    return { ms, xs: [...this.xs], ys: [...this.ys] };
  }
}

/** Ghost position at game time `t` (interpolated), or null once its run is over. */
export function ghostAt(g: Ghost, t: number): { x: number; y: number } | null {
  const k = t * GHOST_HZ;
  const i = Math.floor(k);
  if (i < 0 || i >= g.xs.length - 1) return null;
  const a = k - i;
  return { x: g.xs[i] + (g.xs[i + 1] - g.xs[i]) * a, y: g.ys[i] + (g.ys[i + 1] - g.ys[i]) * a };
}

export const GHOST_SIZE = { w: PLAYER_W, h: PLAYER_H };
