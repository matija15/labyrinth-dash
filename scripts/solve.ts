/**
 * Brute-force solvability check for built-in levels: breadth-first search over short
 * input macros using the real deterministic engine. Plays the default auto-run scheme; pass
 * --manual for the run-pad scheme. Usage: npx tsx scripts/solve.ts [levelId] [--manual]
 */
import { Game } from '../src/engine/game';
import { DEV_LEVELS } from '../src/levels/dev';
import { RELEASE_LEVELS } from '../src/levels/release';
import type { InputState, Vec2 } from '../src/types';

const LEVELS = [...DEV_LEVELS, ...RELEASE_LEVELS];
const FRAMES = 6;
const MANUAL = process.argv.includes('--manual');
/** Auto-run ignores the movement axis, so there is nothing to branch on. */
const MOVES = MANUAL ? [-1, 0, 1] : [0];
const BEAM = 2500;

/** Keep a spatially diverse subset: round-robin over coarse cells so no region floods the beam. */
function diverse(nodes: Node[], limit: number): Node[] {
  const cells = new Map<string, Node[]>();
  for (const n of nodes) {
    const p = n.g.player;
    const k = `${n.g.room.index},${Math.floor(p.x / 8)},${Math.floor(p.y / 8)},${p.dashes},${p.onGround}`;
    let list = cells.get(k);
    if (!list) cells.set(k, (list = []));
    list.push(n);
  }
  const lists = [...cells.values()];
  const out: Node[] = [];
  for (let i = 0; out.length < limit; i++) {
    let any = false;
    for (const l of lists) {
      if (i < l.length) {
        out.push(l[i]);
        any = true;
        if (out.length >= limit) break;
      }
    }
    if (!any) break;
  }
  return out;
}
const SHARED = new Set(['level', 'world', 'room']);

function clone(g: Game): Game {
  const c = Object.create(Object.getPrototypeOf(g)) as Game;
  for (const k of Object.keys(g)) {
    const v = (g as unknown as Record<string, unknown>)[k];
    (c as unknown as Record<string, unknown>)[k] =
      SHARED.has(k) || typeof v === 'function' ? v : k === 'particles' || k === 'ghosts' || k === 'events' ? [] : structuredClone(v);
  }
  return c;
}

interface Node { g: Game; presses: number; held: boolean; visited: number; path: string[] }

const count = (a: ArrayLike<number | boolean>, v: number | boolean = true) => {
  let c = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === v) c++;
  return c;
};
const bits = (m: number) => m.toString(2).split('1').length - 1;
/** Progress score: rooms visited, keys collected, doors opened. The search is greedy on it. */
const milestone = (n: Node) => bits(n.visited) * 10 + count(n.g.keysTaken) + count(n.g.doorsOpen);
const DIRS: Vec2[] = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 }, { x: -1, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
];

function key(n: Node) {
  const g = n.g;
  const p = g.player;
  const sum = (a: ArrayLike<number | boolean>) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] ? 1 << (i % 30) : 0; return s; };
  return [
    g.room.index, Math.round(p.x / 4), Math.round(p.y / 4), Math.round(p.vx / 45), Math.round(p.vy / 60), p.dashes,
    g.phase, Math.round((g as unknown as { transition: { t: number } }).transition.t * 40),
    p.onGround ? 1 : 0, p.wallDir, p.facing, p.running ? 1 : 0, p.wallDrop ? 1 : 0, n.held ? 1 : 0, g.heldKeys, sum(g.keysTaken), sum(g.doorsOpen), sum(g.crumbleState), g.switchFlipped ? 1 : 0, sum(g.crystalCooldown.map((c) => c > 0)),
  ].join(',');
}

function solve(levelId: string, maxNodes = 8_000_000) {
  const level = LEVELS.find((l) => l.id === levelId)!;
  const root = new Game(level, { autoRun: !MANUAL });
  root.step({ moveX: 0, jumpHeld: false, jumpPresses: 0, dashQueue: null, faceQueue: 0, tapQueue: 0 });
  let frontier: Node[] = [{ g: root, presses: 0, held: false, visited: 1, path: [] }];
  let best = 0;
  const seen = new Set<string>([key(frontier[0])]);
  const roomsSeen = new Set<number>([root.room.index]);
  let expanded = 0;
  /** Pre-milestone frontiers, resumed if every node past a milestone dies (greedy dead end). */
  const fallback: Node[][] = [];
  for (let depth = 0; frontier.length && expanded < maxNodes; depth++) {
    const next: Node[] = [];
    for (const n of frontier) {
      const actions: { m: number; jump: 'none' | 'press' | 'hold' | 'tap'; dash: Vec2 | null; tap?: number; label: string }[] = [];
      const busy = n.g.phase === 'transition';
      if (busy) actions.push({ m: 0, jump: n.held ? 'hold' : 'none', dash: null, label: 'wait' });
      else for (const m of MOVES) {
        actions.push({ m, jump: 'none', dash: null, label: `m${m}` });
        if (MANUAL) actions.push({ m, jump: 'press', dash: null, label: `m${m}J` });
        if (n.held && n.g.player.vy < 0) actions.push({ m, jump: 'hold', dash: null, label: `m${m}H` });
      }
      if (!busy && n.g.player.dashes > 0) for (const d of DIRS) actions.push({ m: MANUAL ? d.x : 0, jump: 'none', dash: d, label: `D${d.x},${d.y}` });
      if (!MANUAL && !busy)
        for (const tap of [-1, 1]) actions.push({ m: 0, jump: 'tap', dash: null, tap, label: `T${tap}` });
      if (!MANUAL && !busy && n.g.player.wallDir !== 0 && n.g.player.dashes === 0)
        actions.push({ m: 0, jump: 'none', dash: { x: 0, y: 1 }, label: 'drop' });
      for (const a of actions) {
        expanded++;
        const g = clone(n.g);
        let presses = n.presses;
        if (a.jump === 'press') presses++;
        const held = a.jump !== 'none';
        let dead = false;
        let won = false;
        for (let f = 0; f < FRAMES && !dead && !won; f++) {
          const input: InputState = { moveX: a.m, jumpHeld: held, jumpPresses: presses, dashQueue: f === 0 ? a.dash : null, faceQueue: 0, tapQueue: f === 0 ? a.tap ?? 0 : 0 };
          g.step(input);
          for (const e of g.events) {
            if (e.type === 'death') dead = true;
            if (e.type === 'goal') won = true;
          }
          g.events.length = 0;
        }
        if (dead) continue;
        const node: Node = { g, presses, held, visited: n.visited | (1 << g.room.index), path: [...n.path, a.label] };
        if (won) return { ok: true, depth, expanded, time: g.time, rooms: roomsSeen.size, path: node.path };
        const k = key(node);
        if (seen.has(k)) continue;
        seen.add(k);
        if (!roomsSeen.has(g.room.index)) {
          roomsSeen.add(g.room.index);
          console.log(`  reached room ${g.room.id} at depth ${depth} (t=${g.time.toFixed(2)}s)`);
        }
        next.push(node);
      }
    }
    const top = next.reduce((m, x) => Math.max(m, milestone(x)), 0);
    if (top > best) {
      best = top;
      frontier = next.filter((x) => milestone(x) === top);
      fallback.push(diverse(next.filter((x) => milestone(x) < top), BEAM));
      console.log(`  milestone ${top} at depth ${depth}: keeping ${frontier.length}/${next.length}`);
    } else frontier = next;
    while (!frontier.length && fallback.length) {
      frontier = fallback.pop()!;
      best = frontier.reduce((m, x) => Math.max(m, milestone(x)), 0);
      console.log(`  dead end at depth ${depth}: resuming ${frontier.length} nodes at milestone ${best}`);
    }
    if (frontier.length > BEAM) frontier = diverse(frontier, BEAM);
    if (depth % 10 === 0) {
      const best = frontier.reduce((m, n) => Math.max(m, n.g.player.x), -1e9);
      console.log(`  depth ${depth} frontier ${frontier.length} seen ${seen.size} max x ${best.toFixed(0)}`);
    }
  }
  return { ok: false, expanded, rooms: roomsSeen.size, frontier: frontier.length };
}

const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
/** Echo puzzles need a deliberate death, which this search never plans; tests/echo.test.ts plays them instead. */
const needsEcho = (l: (typeof LEVELS)[number]) => l.rooms.some((r) => r.tiles.some((row) => row.includes('P')));
for (const l of arg ? [] : LEVELS.filter(needsEcho)) console.log(`skipping ${l.id}: echo puzzle (scripted in tests/echo.test.ts)`);
const ids = arg ? [arg] : LEVELS.filter((l) => !needsEcho(l)).map((l) => l.id);
console.log(`scheme: ${MANUAL ? 'manual run pads' : 'auto-run'}`);
let failed = false;
for (const id of ids) {
  console.log(`solving ${id}…`);
  const t0 = Date.now();
  const r = solve(id);
  console.log(id, r.ok ? `SOLVED in ${(r as { time: number }).time.toFixed(2)}s game time` : 'UNSOLVED', JSON.stringify({ ...r, path: undefined }), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (!r.ok) failed = true;
}
process.exit(failed ? 1 : 0);
