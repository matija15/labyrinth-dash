export type Vec2 = { x: number; y: number };

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Tile legend used by the structured 2D tile arrays (one char per tile).
 *  `#` solid        `^ v < >` spikes (point direction)   `=` crumbling platform
 *  `K` key          `D` locked door (connected D tiles open together)
 *  `O` dash orb     `J` jump pad     `1`-`9` portal pair  `S` spawn/checkpoint
 *  `G` goal         `.` or space: empty
 */
export type TileChar =
  | '#'
  | '^'
  | 'v'
  | '<'
  | '>'
  | '='
  | 'K'
  | 'D'
  | 'O'
  | 'J'
  | 'S'
  | 'G'
  | '.'
  | ' '
  | string;

export type SawDef =
  | {
      kind: 'path';
      /** Points in room tile coordinates (tile centers are x + 0.5). */
      points: [number, number][];
      /** Tiles per second. */
      speed: number;
      /** Radius in tiles. */
      radius: number;
      /** `loop` returns from the last point to the first; `pingpong` reverses. */
      mode?: 'loop' | 'pingpong';
    }
  | {
      kind: 'orbit';
      center: [number, number];
      orbitRadius: number;
      /** Radians per second (negative = counter-clockwise). */
      angularSpeed: number;
      radius: number;
      phase?: number;
    };

export interface RoomDef {
  id: string;
  /** Room offset in world tiles. Rooms are stitched into one continuous world grid. */
  x: number;
  y: number;
  tiles: string[];
  saws?: SawDef[];
  /** Optional tutorial text shown when entering the room. */
  hint?: string;
}

export interface LevelDef {
  id: string;
  name: string;
  subtitle: string;
  rooms: RoomDef[];
}

export type Dir8 = Vec2;

export interface InputState {
  /** -1, 0, 1 */
  moveX: number;
  jumpHeld: boolean;
  /** Incremented every time a new jump press begins. */
  jumpPresses: number;
  /** Queued dash direction (unit-ish 8-way vector), consumed by the engine. */
  dashQueue: Dir8 | null;
  /** Auto-run direction tap (-1 / 1, 0 = none), consumed by the engine. */
  faceQueue: number;
}

export type GameEvent =
  | { type: 'jump' }
  | { type: 'walljump' }
  | { type: 'walldrop' }
  | { type: 'dash' }
  | { type: 'land' }
  | { type: 'death' }
  | { type: 'respawn' }
  | { type: 'key' }
  | { type: 'unlock' }
  | { type: 'orb' }
  | { type: 'pad' }
  | { type: 'portal' }
  | { type: 'room' }
  | { type: 'goal' };

export interface LevelRecord {
  bestMs: number | null;
  deaths: number;
  completed: boolean;
  clears: number;
}

export type ControlScheme = 'auto' | 'manual';

export interface SaveData {
  version: 1;
  totalDeaths: number;
  levels: Record<string, LevelRecord>;
  /** Absent in older saves → auto-run. */
  controls?: ControlScheme;
}
