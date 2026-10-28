import type { LevelDef } from '../types';
import { editorIssues, roomRect } from './editor';

/** One problem the editor's level checker found; `at` is a world tile to jump to. */
export interface LevelIssue {
  severity: 'error' | 'warn';
  message: string;
  at?: [number, number];
}

const BLOCKING = new Set(['#']);

/**
 * Editor level checker. Errors stop a playtest; warnings point at things that are usually mistakes:
 * keys without doors, echo doors without plates, open edges into nothing, pickups or the flag walled off.
 */
export function checkLevel(level: LevelDef): LevelIssue[] {
  const issues: LevelIssue[] = editorIssues(level).map((message) => ({ severity: 'error', message }));
  const tiles = new Map<string, string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const where: Record<string, [number, number][]> = {};
  for (const r of level.rooms)
    r.tiles.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        tiles.set(key(r.x + x, r.y + y), ch);
        (where[ch] ??= []).push([r.x + x, r.y + y]);
      }
    });
  const at = (ch: string) => where[ch] ?? [];

  // Doors: connected D tiles open together, one key each.
  const seen = new Set<string>();
  let doorGroups = 0;
  for (const [x, y] of at('D')) {
    if (seen.has(key(x, y))) continue;
    doorGroups++;
    const stack: [number, number][] = [[x, y]];
    seen.add(key(x, y));
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as [number, number][])
        if (tiles.get(key(nx, ny)) === 'D' && !seen.has(key(nx, ny))) {
          seen.add(key(nx, ny));
          stack.push([nx, ny]);
        }
    }
  }
  const keys = at('K').length;
  if (doorGroups > keys)
    issues.push({ severity: 'warn', message: `${doorGroups} door${doorGroups > 1 ? 's' : ''} but only ${keys} key${keys === 1 ? '' : 's'}`, at: at('D')[0] });
  else if (keys > doorGroups)
    issues.push({ severity: 'warn', message: `${keys} keys but only ${doorGroups} door${doorGroups === 1 ? '' : 's'}: extra keys open nothing`, at: at('K')[0] });

  // Echo plates and doors work per room.
  for (const r of level.rooms) {
    const all = r.tiles.join('');
    const plate = all.includes('P');
    const door = all.includes('E');
    const first = (ch: string): [number, number] | undefined => {
      for (let y = 0; y < r.tiles.length; y++) {
        const x = r.tiles[y].indexOf(ch);
        if (x >= 0) return [r.x + x, r.y + y];
      }
    };
    if (door && !plate) issues.push({ severity: 'warn', message: `Room ${r.id}: echo door but no echo plate in the same room (it never opens)`, at: first('E') });
    if (plate && !door) issues.push({ severity: 'warn', message: `Room ${r.id}: echo plate but no echo door in the same room`, at: first('P') });
  }

  // Open side / top edges with no room behind them lead into nothing.
  const inRoom = (x: number, y: number) => tiles.has(key(x, y));
  for (const r of level.rooms) {
    const rr = roomRect(r);
    const open: [number, number][] = [];
    for (let y = 0; y < rr.h; y++)
      for (const x of [0, rr.w - 1]) {
        const ox = x === 0 ? rr.x - 1 : rr.x + rr.w;
        if (r.tiles[y][x] !== '#' && !inRoom(ox, rr.y + y)) open.push([rr.x + x, rr.y + y]);
      }
    for (let x = 0; x < rr.w; x++) if (r.tiles[0][x] !== '#' && !inRoom(rr.x + x, rr.y - 1)) open.push([rr.x + x, rr.y]);
    if (open.length)
      issues.push({ severity: 'warn', message: `Room ${r.id}: ${open.length} open edge tile${open.length > 1 ? 's' : ''} lead${open.length > 1 ? '' : 's'} out of the level`, at: open[0] });
  }

  // Flood fill everything that isn't a wall from the first spawn: the flag and pickups must be inside it.
  const start = level.rooms[0] && level.rooms[0].tiles.findIndex((row) => row.includes('S'));
  if (start !== undefined && start >= 0) {
    const r0 = level.rooms[0];
    const s: [number, number] = [r0.x + r0.tiles[start].indexOf('S'), r0.y + start];
    const reach = new Set([key(...s)]);
    const stack = [s];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      const here = tiles.get(key(cx, cy)) ?? '';
      // Portals link their pair.
      const next = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as [number, number][];
      if (here >= '1' && here <= '9') next.push(...at(here));
      for (const [nx, ny] of next) {
        const ch = tiles.get(key(nx, ny));
        if (ch === undefined || BLOCKING.has(ch) || reach.has(key(nx, ny))) continue;
        reach.add(key(nx, ny));
        stack.push([nx, ny]);
      }
    }
    const sealed = (ch: string, what: string) => {
      const lost = at(ch).filter(([x, y]) => !reach.has(key(x, y)));
      if (lost.length) issues.push({ severity: ch === 'G' ? 'error' : 'warn', message: `${what} walled off from the start`, at: lost[0] });
    };
    sealed('G', 'Exit flag is');
    sealed('K', `${at('K').length > 1 ? 'A key is' : 'The key is'}`);
    sealed('@', 'A storybook page is');
  }
  return issues;
}
