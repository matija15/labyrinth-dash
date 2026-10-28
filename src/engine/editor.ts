import type { LevelDef, PlatformDef, RoomDef, SawDef } from '../types';
import { VIEW_TILES_H } from './constants';
import { validateLevel } from './world';

/** Size of a room created by the editor (one screen high, two screens of 16:9 wide). */
export const ROOM_W = 32;
export const ROOM_H = VIEW_TILES_H;

export type EditorTool =
  | '#' | '^' | '=' | 'O' | 'K' | 'D' | 'J' | 'S' | 'G'
  | '-' | '[' | ']' | '*' | '(' | ')' | 'u' | 'n' | '%' | 'P' | 'E' | 'F' | 'R'
  | 'saw' | 'platform' | 'erase' | 'room+' | 'room-' | 'pan' | 'select' | 'paste';

export interface TileRect { x: number; y: number; w: number; h: number }

export const cloneLevel = (level: LevelDef): LevelDef => JSON.parse(JSON.stringify(level));

export const roomRect = (r: RoomDef): TileRect => ({ x: r.x, y: r.y, w: r.tiles[0]?.length ?? 0, h: r.tiles.length });

const overlaps = (a: TileRect, b: TileRect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Bounds of all rooms in world tiles. */
export function levelBounds(level: LevelDef): TileRect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of level.rooms) {
    const b = roomRect(r);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  if (!level.rooms.length) return { x: 0, y: 0, w: ROOM_W, h: ROOM_H };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const borderedRoom = (id: string, x: number, y: number, w = ROOM_W, h = ROOM_H): RoomDef => ({
  id, x, y,
  tiles: Array.from({ length: h }, (_, ty) =>
    ty === 0 || ty === h - 1 ? '#'.repeat(w) : '#' + '.'.repeat(w - 2) + '#'),
});

/** A one-room starter level: walls, floor, spawn on the left, exit flag on the right. */
export function blankLevel(): LevelDef {
  const room = borderedRoom('r1', 0, 0);
  room.tiles[ROOM_H - 2] = '#'.repeat(ROOM_W);
  const level: LevelDef = { id: 'custom-level', name: 'Custom Level', subtitle: 'Made in the editor', rooms: [room] };
  setChar(room, 2, ROOM_H - 3, 'S');
  setChar(room, ROOM_W - 3, ROOM_H - 3, 'G');
  return level;
}

export function roomIndexAt(level: LevelDef, tx: number, ty: number): number {
  return level.rooms.findIndex((r) => {
    const b = roomRect(r);
    return tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h;
  });
}

export function charAt(level: LevelDef, tx: number, ty: number): string | null {
  const i = roomIndexAt(level, tx, ty);
  if (i < 0) return null;
  const r = level.rooms[i];
  return r.tiles[ty - r.y][tx - r.x];
}

function setChar(room: RoomDef, x: number, y: number, ch: string): boolean {
  const row = room.tiles[y];
  if (row[x] === ch) return false;
  room.tiles[y] = row.slice(0, x) + ch + row.slice(x + 1);
  return true;
}

const nextRoomId = (level: LevelDef) => {
  const ids = new Set(level.rooms.map((r) => r.id));
  let n = level.rooms.length + 1;
  while (ids.has(`r${n}`)) n++;
  return `r${n}`;
};

/**
 * Adds a walled ROOM_W x ROOM_H room containing tile (tx, ty). Prefers the screen-aligned grid cell, otherwise the
 * closest free position that touches an existing room. Returns the room index, or -1 if no room fits there.
 */
export function addRoomAt(level: LevelDef, tx: number, ty: number): number {
  if (roomIndexAt(level, tx, ty) >= 0) return -1;
  const rects = level.rooms.map(roomRect);
  const free = (c: TileRect) => !rects.some((r) => overlaps(c, r));
  const ax = Math.floor(tx / ROOM_W) * ROOM_W;
  const ay = Math.floor(ty / ROOM_H) * ROOM_H;
  let best: TileRect | null = free({ x: ax, y: ay, w: ROOM_W, h: ROOM_H }) ? { x: ax, y: ay, w: ROOM_W, h: ROOM_H } : null;
  if (!best) {
    let bestScore = Infinity;
    for (let y = ty - ROOM_H + 1; y <= ty; y++)
      for (let x = tx - ROOM_W + 1; x <= tx; x++) {
        const c = { x, y, w: ROOM_W, h: ROOM_H };
        if (!free(c)) continue;
        const touches = rects.some((r) => overlaps({ x: c.x - 1, y: c.y, w: c.w + 2, h: c.h }, r) || overlaps({ x: c.x, y: c.y - 1, w: c.w, h: c.h + 2 }, r));
        const score = Math.abs(x - ax) + Math.abs(y - ay) + (touches ? 0 : 1000);
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
  }
  if (!best) return -1;
  level.rooms.push(borderedRoom(nextRoomId(level), best.x, best.y));
  return level.rooms.length - 1;
}

export function deleteRoomAt(level: LevelDef, tx: number, ty: number): boolean {
  const i = roomIndexAt(level, tx, ty);
  if (i < 0 || level.rooms.length <= 1) return false;
  level.rooms.splice(i, 1);
  return true;
}

const isSolid = (ch: string | null) => ch === '#';

/** Spikes point away from the wall they are attached to (floor first, then ceiling, then side walls). */
export function spikeFor(level: LevelDef, tx: number, ty: number): string {
  if (isSolid(charAt(level, tx, ty + 1))) return '^';
  if (isSolid(charAt(level, tx, ty - 1))) return 'v';
  if (isSolid(charAt(level, tx + 1, ty))) return '<';
  if (isSolid(charAt(level, tx - 1, ty))) return '>';
  return '^';
}

const sawPoints = (s: SawDef): [number, number][] => (s.kind === 'orbit' ? [s.center] : s.points);

/** Removes saws with a waypoint / orbit center within ~1 tile of tile (tx, ty). */
export function eraseSawsAt(level: LevelDef, tx: number, ty: number): boolean {
  let changed = false;
  for (const r of level.rooms) {
    if (!r.saws?.length) continue;
    const cx = tx - r.x + 0.5;
    const cy = ty - r.y + 0.5;
    const keep = r.saws.filter((s) => !sawPoints(s).some(([x, y]) => Math.hypot(x - cx, y - cy) < 1.2));
    if (keep.length !== r.saws.length) {
      changed = true;
      if (keep.length) r.saws = keep;
      else delete r.saws;
    }
  }
  return changed;
}

/**
 * Applies a paint tool to world tile (tx, ty). Painting outside every room creates a new walled room there.
 * Mutates `level`; returns whether anything changed.
 */
export function paintTile(level: LevelDef, tool: EditorTool, tx: number, ty: number): boolean {
  if (tool === 'pan' || tool === 'saw' || tool === 'platform' || tool === 'room-' || tool === 'select' || tool === 'paste') return false;
  if (tool === 'room+') return addRoomAt(level, tx, ty) >= 0;
  if (tool === 'erase') {
    const sawGone = eraseSawsAt(level, tx, ty) || erasePlatformsAt(level, tx, ty);
    const i = roomIndexAt(level, tx, ty);
    const r = level.rooms[i];
    return (i >= 0 && setChar(r, tx - r.x, ty - r.y, '.')) || sawGone;
  }
  let i = roomIndexAt(level, tx, ty);
  let created = false;
  if (i < 0) {
    i = addRoomAt(level, tx, ty);
    if (i < 0) return false;
    created = true;
  }
  const ch = tool === '^' ? spikeFor(level, tx, ty) : tool;
  if (ch === 'G')
    for (const r of level.rooms) r.tiles = r.tiles.map((row) => row.replace(/G/g, '.'));
  const r = level.rooms[i];
  return setChar(r, tx - r.x, ty - r.y, ch) || created;
}

export const SAW_SPEED = 4;
export const SAW_RADIUS = 0.8;

/**
 * Adds a moving saw. A drag from (ax, ay) to (bx, by) makes a ping-pong path between the two tile centers; a tap
 * (same tile) makes a saw orbiting that tile.
 */
export function addSaw(level: LevelDef, ax: number, ay: number, bx: number, by: number): boolean {
  let i = roomIndexAt(level, ax, ay);
  if (i < 0) i = addRoomAt(level, ax, ay);
  if (i < 0) return false;
  const r = level.rooms[i];
  const p = (x: number, y: number): [number, number] => [x - r.x + 0.5, y - r.y + 0.5];
  const saw: SawDef =
    ax === bx && ay === by
      ? { kind: 'orbit', center: p(ax, ay), orbitRadius: 2, angularSpeed: 2.4, radius: 0.7, phase: 0 }
      : { kind: 'path', points: [p(ax, ay), p(bx, by)], speed: SAW_SPEED, radius: SAW_RADIUS, mode: 'pingpong' };
  r.saws = [...(r.saws ?? []), saw];
  return true;
}

export const PLATFORM_W = 3;
export const PLATFORM_SPEED = 3;

/**
 * Adds a moving platform (PLATFORM_W tiles wide, its left end on the dragged tiles). A drag from (ax, ay) to (bx, by)
 * makes it ping-pong between the two; a tap makes one that slides 6 tiles to the right and back.
 */
export function addPlatform(level: LevelDef, ax: number, ay: number, bx: number, by: number): boolean {
  let i = roomIndexAt(level, ax, ay);
  if (i < 0) i = addRoomAt(level, ax, ay);
  if (i < 0) return false;
  const r = level.rooms[i];
  if (ax === bx && ay === by) bx = ax + 6;
  const plat: PlatformDef = { points: [[ax - r.x, ay - r.y], [bx - r.x, by - r.y]], w: PLATFORM_W, speed: PLATFORM_SPEED };
  r.platforms = [...(r.platforms ?? []), plat];
  return true;
}

/** Removes platforms with a waypoint covering tile (tx, ty). */
export function erasePlatformsAt(level: LevelDef, tx: number, ty: number): boolean {
  let changed = false;
  for (const r of level.rooms) {
    if (!r.platforms?.length) continue;
    const x = tx - r.x;
    const y = ty - r.y;
    const keep = r.platforms.filter((p) => !p.points.some(([px, py]) => y >= py - 0.5 && y < py + 1 && x >= px - 0.5 && x < px + p.w));
    if (keep.length === r.platforms.length) continue;
    changed = true;
    if (keep.length) r.platforms = keep;
    else delete r.platforms;
  }
  return changed;
}

/** Tiles on the line between two tiles (inclusive), for drag painting. */
export function lineTiles(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Problems that stop the level from being played / exported, phrased for the editor UI. */
export function editorIssues(level: LevelDef): string[] {
  const issues: string[] = [];
  const all = level.rooms.flatMap((r) => r.tiles).join('');
  if (!all.includes('G')) issues.push('Place an Exit Flag');
  for (const r of level.rooms)
    if (!r.tiles.some((row) => row.includes('S'))) issues.push(`Room ${r.id} needs a Spawn Point (checkpoint)`);
  for (const e of validateLevel(level)) {
    if (e.includes('no spawn') || e.includes('one goal, found 0')) continue;
    issues.push(e.replace(`${level.id}: `, '').replace(`${level.id}/`, ''));
  }
  return issues;
}

// ------------------------------------------------------------------ selection / clipboard / playtest

/** A copied block of tiles; `' '` marks tiles outside every room. Saw coordinates are relative to the block. */
export interface Clip {
  w: number;
  h: number;
  rows: string[];
  saws: SawDef[];
  platforms?: PlatformDef[];
}

export const normRect = (ax: number, ay: number, bx: number, by: number): TileRect => ({
  x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax) + 1, h: Math.abs(by - ay) + 1,
});

const shiftSaw = (s: SawDef, dx: number, dy: number): SawDef =>
  s.kind === 'orbit'
    ? { ...s, center: [s.center[0] + dx, s.center[1] + dy] }
    : { ...s, points: s.points.map(([x, y]): [number, number] => [x + dx, y + dy]) };

const shiftPlatform = (p: PlatformDef, dx: number, dy: number): PlatformDef =>
  ({ ...p, points: p.points.map(([x, y]): [number, number] => [x + dx, y + dy]) });

const platformInside = (p: PlatformDef, r: RoomDef, rect: TileRect) =>
  p.points.every(([x, y]) => x + r.x >= rect.x && x + r.x < rect.x + rect.w && y + r.y >= rect.y && y + r.y < rect.y + rect.h);

/** Whether every waypoint / orbit center of room `r`'s saw lies inside `rect` (world tiles). */
const sawInside = (s: SawDef, r: RoomDef, rect: TileRect) =>
  sawPoints(s).every(([x, y]) => {
    const wx = x + r.x;
    const wy = y + r.y;
    return wx >= rect.x && wx <= rect.x + rect.w && wy >= rect.y && wy <= rect.y + rect.h;
  });

export function copyRect(level: LevelDef, rect: TileRect): Clip {
  const rows: string[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    let row = '';
    for (let x = rect.x; x < rect.x + rect.w; x++) row += charAt(level, x, y) ?? ' ';
    rows.push(row);
  }
  const saws: SawDef[] = [];
  for (const r of level.rooms)
    for (const s of r.saws ?? []) if (sawInside(s, r, rect)) saws.push(shiftSaw(s, r.x - rect.x, r.y - rect.y));
  const platforms: PlatformDef[] = [];
  for (const r of level.rooms)
    for (const p of r.platforms ?? []) if (platformInside(p, r, rect)) platforms.push(shiftPlatform(p, r.x - rect.x, r.y - rect.y));
  return { w: rect.w, h: rect.h, rows, saws, ...(platforms.length ? { platforms } : {}) };
}

/** Empties every tile and removes every saw inside `rect`. */
export function clearRect(level: LevelDef, rect: TileRect): boolean {
  let changed = false;
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = roomIndexAt(level, x, y);
      if (i >= 0) changed = setChar(level.rooms[i], x - level.rooms[i].x, y - level.rooms[i].y, '.') || changed;
    }
  for (const r of level.rooms) {
    if (!r.saws?.length) continue;
    const keep = r.saws.filter((s) => !sawInside(s, r, rect));
    if (keep.length === r.saws.length) continue;
    changed = true;
    if (keep.length) r.saws = keep;
    else delete r.saws;
  }
  for (const r of level.rooms) {
    if (!r.platforms?.length) continue;
    const keep = r.platforms.filter((p) => !platformInside(p, r, rect));
    if (keep.length === r.platforms.length) continue;
    changed = true;
    if (keep.length) r.platforms = keep;
    else delete r.platforms;
  }
  return changed;
}

/** Paints `tool` on every tile of `rect` (spikes still orient themselves per tile). */
export function fillRect(level: LevelDef, tool: EditorTool, rect: TileRect): boolean {
  let changed = false;
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) changed = paintTile(level, tool, x, y) || changed;
  return changed;
}

/** Stamps a clip with its top-left corner on world tile (tx, ty), adding rooms where it lands outside them. */
export function pasteClip(level: LevelDef, clip: Clip, tx: number, ty: number): boolean {
  let changed = false;
  if (clip.rows.some((row) => row.includes('G')))
    for (const r of level.rooms) r.tiles = r.tiles.map((row) => row.replace(/G/g, '.'));
  for (let y = 0; y < clip.h; y++)
    for (let x = 0; x < clip.w; x++) {
      const ch = clip.rows[y][x];
      if (ch === ' ') continue;
      let i = roomIndexAt(level, tx + x, ty + y);
      if (i < 0 && ch !== '.') i = addRoomAt(level, tx + x, ty + y);
      if (i < 0) continue;
      const r = level.rooms[i];
      changed = setChar(r, tx + x - r.x, ty + y - r.y, ch) || changed;
    }
  for (const s of clip.saws) {
    const [ax, ay] = sawPoints(s)[0];
    const i = roomIndexAt(level, Math.floor(tx + ax), Math.floor(ty + ay));
    if (i < 0) continue;
    const r = level.rooms[i];
    r.saws = [...(r.saws ?? []), shiftSaw(s, tx - r.x, ty - r.y)];
    changed = true;
  }
  for (const p of clip.platforms ?? []) {
    const [ax, ay] = p.points[0];
    const i = roomIndexAt(level, tx + ax, ty + ay);
    if (i < 0) continue;
    const r = level.rooms[i];
    r.platforms = [...(r.platforms ?? []), shiftPlatform(p, tx - r.x, ty - r.y)];
    changed = true;
  }
  return changed;
}

/** Index of the room containing tile (tx, ty), or else the room whose center is closest. */
export function nearestRoom(level: LevelDef, tx: number, ty: number): number {
  const i = roomIndexAt(level, tx, ty);
  if (i >= 0) return i;
  let best = 0;
  let bestD = Infinity;
  level.rooms.forEach((r, j) => {
    const b = roomRect(r);
    const d = Math.hypot(b.x + b.w / 2 - tx, b.y + b.h / 2 - ty);
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  });
  return best;
}

/** A copy of the level that starts at room `roomIndex`'s first spawn (the engine starts in the first room). */
export function startingFrom(level: LevelDef, roomIndex: number): LevelDef {
  const copy = cloneLevel(level);
  const [room] = copy.rooms.splice(roomIndex, 1);
  copy.rooms.unshift(room);
  return copy;
}

const FLOOR = new Set(['#', '=', 'D']);
const isEmpty = (ch: string | undefined) => ch === '.' || ch === ' ';

/**
 * Where a temporary spawn goes in a room without one: an empty tile standing on a floor, as close as possible to the
 * room's bottom center (columns nearest the middle first, then the lowest floor in that column).
 */
export function practiceSpawn(room: RoomDef): [number, number] {
  const h = room.tiles.length;
  const w = room.tiles[0]?.length ?? 0;
  const mid = Math.floor(w / 2);
  for (let d = 0; d < w; d++)
    for (const x of d === 0 ? [mid] : [mid - d, mid + d]) {
      if (x < 0 || x >= w) continue;
      for (let y = h - 2; y >= 0; y--)
        if (isEmpty(room.tiles[y][x]) && FLOOR.has(room.tiles[y + 1][x])) return [x, y];
    }
  return [mid, Math.max(0, h - 2)];
}

/**
 * Room practice: a copy of the level containing only room `roomIndex`. Unpaired portals are removed, and a room
 * without a spawn gets a temporary one on its floor (bottom center). The exit flag is optional (see `allowNoGoal`).
 */
export function roomOnly(level: LevelDef, roomIndex: number): LevelDef {
  const copy = cloneLevel(level);
  const room = copy.rooms[roomIndex];
  copy.rooms = [room];
  const counts = new Map<string, number>();
  for (const row of room.tiles) for (const ch of row) if (ch >= '1' && ch <= '9') counts.set(ch, (counts.get(ch) ?? 0) + 1);
  room.tiles = room.tiles.map((row) => row.replace(/[1-9]/g, (ch) => (counts.get(ch) === 2 ? ch : '.')));
  if (!room.tiles.some((row) => row.includes('S'))) {
    const [x, y] = practiceSpawn(room);
    setChar(room, x, y, 'S');
  }
  return copy;
}

/** Problems that stop a room practice playtest (none for any well-formed room). */
export const roomIssues = (practice: LevelDef): string[] =>
  validateLevel(practice, { allowNoGoal: true }).map((e) => e.replace(`${practice.id}: `, '').replace(`${practice.id}/`, ''));

/** Editor hotkeys: tool → [letter, number-row digit]. */
export const TOOL_SHORTCUTS: Partial<Record<EditorTool, [string, string?]>> = {
  '#': ['W', '1'], '^': ['X', '2'], saw: ['A', '3'], O: ['O', '4'], K: ['K', '5'], D: ['D', '6'], S: ['S', '7'],
  G: ['F', '8'], '=': ['C', '9'], J: ['J', '0'], erase: ['E'], select: ['V'], paste: ['P'], 'room+': ['R'],
  '-': ['L'], '[': ['B'], ']': ['N'], '*': ['Y'], platform: ['M'], ')': ['I'], '%': ['H'], P: ['U'], E: ['G'], F: ['Z'], R: ['Q'],
};

/** The tool a bare key press selects (case-insensitive), if any. */
export function toolForKey(key: string): EditorTool | null {
  const k = key.toUpperCase();
  for (const [tool, [letter, digit]] of Object.entries(TOOL_SHORTCUTS) as [EditorTool, [string, string?]][])
    if (k === letter || k === digit) return tool;
  return null;
}

// ------------------------------------------------------------------ export / import

export const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom-level';

export const varNameFor = (id: string) => {
  const v = id.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''));
  return /^[a-zA-Z_]/.test(v) ? v : `level${v}`;
};

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const num = (n: number) => String(Math.round(n * 1000) / 1000);
const pt = ([x, y]: [number, number]) => `[${num(x)}, ${num(y)}]`;

function sawCode(s: SawDef): string {
  if (s.kind === 'orbit')
    return `{kind: 'orbit', center: ${pt(s.center)}, orbitRadius: ${num(s.orbitRadius)}, angularSpeed: ${num(s.angularSpeed)}, radius: ${num(s.radius)}${s.phase !== undefined ? `, phase: ${num(s.phase)}` : ''}}`;
  return `{kind: 'path', points: [${s.points.map(pt).join(', ')}], speed: ${num(s.speed)}, radius: ${num(s.radius)}${s.mode ? `, mode: ${q(s.mode)}` : ''}}`;
}

const platformCode = (p: PlatformDef) =>
  `{points: [${p.points.map(pt).join(', ')}], w: ${num(p.w)}, speed: ${num(p.speed)}${p.mode ? `, mode: ${q(p.mode)}` : ''}}`;

/** Serializes a level as a complete `src/levels/<name>.ts` file in the same style as the built-in levels. */
export function levelToCode(level: LevelDef): string {
  const L: string[] = [
    "import type { LevelDef } from '../types';",
    '',
    '// Legend: # solid  ^v<> spikes  = crumble  K key  D door  O dash orb  J jump pad',
    '//         1-9 portal pair  S spawn/checkpoint  G goal  . empty  - one-way  [ ] switch blocks',
    '//         * lantern (2 dashes)  ( ) u n wind left / right / up / down  % fake wall  P echo plate  E echo door  F gravity gate  R reverse gate',
    `export const ${varNameFor(level.id)}: LevelDef = {`,
    `  id: ${JSON.stringify(level.id)},`,
    `  name: ${JSON.stringify(level.name)},`,
    `  subtitle: ${JSON.stringify(level.subtitle)},`,
    ...(level.chapter ? [`  chapter: ${JSON.stringify(level.chapter)},`] : []),
    ...(level.par ? [`  par: ${level.par},`] : []),
    ...(level.theme ? [`  theme: ${JSON.stringify(level.theme)},`] : []),
    '  rooms: [',
  ];
  for (const r of level.rooms) {
    L.push('    {', `      id: ${JSON.stringify(r.id)},`, `      x: ${r.x},`, `      y: ${r.y},`);
    if (r.hint) L.push(`      hint: ${JSON.stringify(r.hint)},`);
    L.push('      tiles: [', ...r.tiles.map((row) => `        ${q(row)},`), '      ],');
    if (r.saws?.length) L.push('      saws: [', ...r.saws.map((s) => `        ${sawCode(s)},`), '      ],');
    if (r.platforms?.length) L.push('      platforms: [', ...r.platforms.map((p) => `        ${platformCode(p)},`), '      ],');
    L.push('    },');
  }
  L.push('  ],', '};', '');
  return L.join('\n');
}

export const levelToJson = (level: LevelDef) => JSON.stringify(level, null, 2);

/** Converts a TS object literal (single quotes, bare keys, trailing commas, comments) into JSON text. */
function literalToJson(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let s = '';
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\' && i + 1 < n) {
          const e = src[i + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
          i += 2;
        } else s += src[i++];
      }
      i++;
      out += JSON.stringify(s);
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
    } else if (/[A-Za-z_$]/.test(c)) {
      let id = '';
      while (i < n && /[\w$]/.test(src[i])) id += src[i++];
      let j = i;
      while (j < n && /\s/.test(src[j])) j++;
      out += src[j] === ':' ? JSON.stringify(id) : id;
    } else if (c === ',') {
      let j = i + 1;
      while (j < n && /\s/.test(src[j])) j++;
      if (src[j] !== '}' && src[j] !== ']') out += c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * Parses level code pasted into the editor: the JSON export, or a whole `src/levels/*.ts` file / object literal.
 * Throws an Error with a readable message when the text isn't a level.
 */
export function parseLevelCode(text: string): LevelDef {
  const assign = /=\s*\{/.exec(text);
  const start = assign ? assign.index + assign[0].length - 1 : text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No level object found ({ ... }).');
  const body = text.slice(start, end + 1);
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    try {
      data = JSON.parse(literalToJson(body));
    } catch (e) {
      throw new Error(`Could not parse level code: ${(e as Error).message}`);
    }
  }
  const d = data as Partial<LevelDef>;
  if (!d || !Array.isArray(d.rooms) || !d.rooms.length) throw new Error('Level needs a non-empty "rooms" array.');
  const rooms: RoomDef[] = d.rooms.map((r, i) => {
    if (!r || !Array.isArray(r.tiles) || !r.tiles.length || r.tiles.some((t) => typeof t !== 'string'))
      throw new Error(`Room ${i + 1} needs a "tiles" array of strings.`);
    const room: RoomDef = {
      id: typeof r.id === 'string' ? r.id : `r${i + 1}`,
      x: Number(r.x) || 0,
      y: Number(r.y) || 0,
      tiles: r.tiles.map((t) => t.replace(/ /g, '.')),
    };
    if (typeof r.hint === 'string') room.hint = r.hint;
    if (Array.isArray(r.saws) && r.saws.length) room.saws = r.saws;
    if (Array.isArray(r.platforms) && r.platforms.length) room.platforms = r.platforms;
    return room;
  });
  const name = typeof d.name === 'string' ? d.name : 'Custom Level';
  return {
    id: typeof d.id === 'string' ? d.id : slugify(name),
    name,
    subtitle: typeof d.subtitle === 'string' ? d.subtitle : 'Made in the editor',
    ...(typeof d.chapter === 'string' && d.chapter ? { chapter: d.chapter } : {}),
    ...(typeof d.par === 'number' && d.par > 0 ? { par: d.par } : {}),
    ...(typeof d.theme === 'string' && d.theme ? { theme: d.theme } : {}),
    rooms,
  };
}
