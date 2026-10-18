import type { ArtKey } from '../engine/skins';

export type PlayerAnim = 'idle' | 'run' | 'dash' | 'air';

/**
 * An animated player sprite sheet: one row per animation, frames left to right, all cells the same size.
 * The character faces right and stands on the bottom row of its cell, centered horizontally.
 */
export interface SpriteSheet {
  cellW: number;
  cellH: number;
  /** Sheet pixels per world pixel (the hitbox is 6×6 world px, a tile 8). */
  density: number;
  anims: Record<PlayerAnim, { row: number; frames: number; fps: number }>;
}

/** Made by `tools/hood_sprites.py`; keep in sync with its ROWS. */
export const HOOD_SHEET: SpriteSheet = {
  cellW: 40,
  cellH: 36,
  density: 4,
  anims: {
    idle: { row: 0, frames: 6, fps: 10 },
    run: { row: 1, frames: 6, fps: 14 },
    dash: { row: 2, frames: 3, fps: 20 },
    // Frame 0 rising, frame 1 falling.
    air: { row: 3, frames: 2, fps: 0 },
  },
};

export const SHEETS: Partial<Record<ArtKey, SpriteSheet>> = { hood: HOOD_SHEET };
