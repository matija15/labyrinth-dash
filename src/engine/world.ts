import type { LevelDef, Rect, SawDef, Vec2 } from '../types';
import { PLAYER_H, PLAYER_W, TILE } from './constants';

export enum T {
  Empty = 0,
  Solid = 1,
  SpikeUp = 2,
  SpikeDown = 3,
  SpikeLeft = 4,
  SpikeRight = 5,
  Crumble = 6,
  Door = 7,
  /** Area outside every room: behaves like a wall. */
  Void = 8,
  /** Void directly below an open room floor: falling in kills. */
  Pit = 9,
}

export interface Room {
  index: number;
  id: string;
  /** Bounds in world px. */
  rect: Rect;
  spawns: Vec2[];
  saws: SawDef[];
  /** Room origin in world tiles (saw coordinates are room-relative). */
  tx: number;
  ty: number;
}

export interface KeyItem { x: number; y: number; room: number }
export interface Orb { x: number; y: number }
export interface Pad { tx: number; ty: number }
export interface Portal { x: number; y: number; pair: number; id: string }
export interface Crumble { tx: number; ty: number }
export interface DoorGroup { tiles: number[] }

export interface World {
  /** Size in tiles. */
  w: number;
  h: number;
  originTx: number;
  originTy: number;
  grid: Uint8Array;
  /** Door group index per tile (-1 = none). */
  doorOf: Int16Array;
  /** Crumble index per tile (-1 = none). */
  crumbleOf: Int16Array;
  rooms: Room[];
  keys: KeyItem[];
  doors: DoorGroup[];
  orbs: Orb[];
  pads: Pad[];
  portals: Portal[];
  crumbles: Crumble[];
  goal: Vec2 | null;
  start: Vec2;
}

const SPIKES: Record<string, T> = { '^': T.SpikeUp, v: T.SpikeDown, '<': T.SpikeLeft, '>': T.SpikeRight };

/** Player top-left position when standing on the bottom of tile (tx, ty). */
export const spawnPos = (tx: number, ty: number): Vec2 => ({
  x: tx * TILE + (TILE - PLAYER_W) / 2,
  y: (ty + 1) * TILE - PLAYER_H,
});

export function validateLevel(level: LevelDef): string[] {
  const errors: string[] = [];
  const portalCounts = new Map<string, number>();
  let goals = 0;
  for (const room of level.rooms) {
    const width = room.tiles[0]?.length ?? 0;
    room.tiles.forEach((row, i) => {
      if (row.length !== width) errors.push(`${level.id}/${room.id}: row ${i} has ${row.length} chars, expected ${width}`);
      for (const ch of row) {
        if (ch >= '1' && ch <= '9') portalCounts.set(ch, (portalCounts.get(ch) ?? 0) + 1);
        if (ch === 'G') goals++;
      }
    });
    if (!room.tiles.some((r) => r.includes('S'))) errors.push(`${level.id}/${room.id}: no spawn (S)`);
  }
  portalCounts.forEach((n, ch) => {
    if (n !== 2) errors.push(`${level.id}: portal ${ch} appears ${n} times (needs exactly 2)`);
  });
  if (goals !== 1) errors.push(`${level.id}: expected exactly one goal, found ${goals}`);
  const rects = level.rooms.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.tiles[0]?.length ?? 0, h: r.tiles.length }));
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y)
        errors.push(`${level.id}: rooms ${a.id} and ${b.id} overlap`);
    }
  return errors;
}

export function buildWorld(level: LevelDef): World {
  const errors = validateLevel(level);
  if (errors.length) throw new Error(`Invalid level:\n${errors.join('\n')}`);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of level.rooms) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.tiles[0].length);
    maxY = Math.max(maxY, r.y + r.tiles.length);
  }
  // One extra row below everything so open floors always have a pit under them.
  const w = maxX - minX;
  const h = maxY - minY + 1;
  const grid = new Uint8Array(w * h).fill(T.Void);
  const doorOf = new Int16Array(w * h).fill(-1);
  const crumbleOf = new Int16Array(w * h).fill(-1);
  const world: World = {
    w, h, originTx: minX, originTy: minY, grid, doorOf, crumbleOf,
    rooms: [], keys: [], doors: [], orbs: [], pads: [], portals: [], crumbles: [],
    goal: null, start: { x: 0, y: 0 },
  };
  const portalFirst = new Map<string, number>();
  const doorTiles: number[] = [];

  level.rooms.forEach((def, index) => {
    const rx = def.x - minX;
    const ry = def.y - minY;
    const room: Room = {
      index, id: def.id,
      rect: { x: rx * TILE, y: ry * TILE, w: def.tiles[0].length * TILE, h: def.tiles.length * TILE },
      spawns: [], saws: def.saws ?? [], tx: rx, ty: ry,
    };
    def.tiles.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const tx = rx + x;
        const ty = ry + y;
        const i = ty * w + tx;
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        let tile = T.Empty;
        if (ch === '#') tile = T.Solid;
        else if (SPIKES[ch] !== undefined) tile = SPIKES[ch];
        else if (ch === '=') {
          tile = T.Crumble;
          crumbleOf[i] = world.crumbles.length;
          world.crumbles.push({ tx, ty });
        } else if (ch === 'D') {
          tile = T.Door;
          doorTiles.push(i);
        } else if (ch === 'K') world.keys.push({ x: cx, y: cy, room: index });
        else if (ch === 'O') world.orbs.push({ x: cx, y: cy });
        else if (ch === 'J') world.pads.push({ tx, ty });
        else if (ch === 'S') room.spawns.push(spawnPos(tx, ty));
        else if (ch === 'G') world.goal = { x: cx, y: cy };
        else if (ch >= '1' && ch <= '9') {
          const id = world.portals.length;
          const first = portalFirst.get(ch);
          world.portals.push({ x: cx, y: cy, pair: first ?? -1, id: ch });
          if (first === undefined) portalFirst.set(ch, id);
          else world.portals[first].pair = id;
        }
        grid[i] = tile;
      }
    });
    world.rooms.push(room);
  });

  // Flood-fill connected door tiles into groups that unlock together.
  const doorSet = new Set(doorTiles);
  for (const start of doorTiles) {
    if (doorOf[start] !== -1) continue;
    const group = world.doors.length;
    const tiles: number[] = [];
    const stack = [start];
    doorOf[start] = group;
    while (stack.length) {
      const i = stack.pop()!;
      tiles.push(i);
      const x = i % w;
      for (const n of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) {
        if (n >= 0 && doorSet.has(n) && doorOf[n] === -1) {
          doorOf[n] = group;
          stack.push(n);
        }
      }
    }
    world.doors.push({ tiles });
  }

  // Void cells under a non-solid room tile become deadly pits (cascade downward).
  for (let y = 1; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const above = grid[i - w];
      if (grid[i] === T.Void && above !== T.Solid && above !== T.Void && above !== T.Door && above !== T.Crumble)
        grid[i] = T.Pit;
    }

  world.start = world.rooms[0].spawns[0];
  return world;
}

export const roomAt = (world: World, px: number, py: number): Room | null => {
  for (const room of world.rooms) {
    const r = room.rect;
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return room;
  }
  return null;
};

export const tileAt = (world: World, tx: number, ty: number): T => {
  if (tx < 0 || tx >= world.w || ty < 0) return T.Void;
  if (ty >= world.h) return T.Pit;
  return world.grid[ty * world.w + tx] as T;
};
