/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TouchController } from '../src/engine/input';
import { KeyboardInput } from '../src/engine/keyboard';
import { TOOL_SHORTCUTS, practiceSpawn, roomIssues, roomOnly, toolForKey } from '../src/engine/editor';
import { Game } from '../src/engine/game';
import { buildWorld, validateLevel } from '../src/engine/world';
import type { LevelDef, RoomDef } from '../src/types';
import { sim } from './helpers';

const kb = () => {
  const touch = new TouchController();
  touch.autoRun = true;
  let paused = 0;
  const k = new KeyboardInput(touch, () => paused++);
  return { touch, input: touch.input, k, paused: () => paused };
};

test('D + held arrows dashes in that 8-way vector', () => {
  const cases: [string[], { x: number; y: number }][] = [
    [['ArrowUp'], { x: 0, y: -1 }],
    [['ArrowLeft'], { x: -1, y: 0 }],
    [['ArrowRight'], { x: 1, y: 0 }],
    [['ArrowDown'], { x: 0, y: 1 }],
    [['ArrowUp', 'ArrowRight'], { x: 1, y: -1 }],
    [['ArrowUp', 'ArrowLeft'], { x: -1, y: -1 }],
    [['ArrowDown', 'ArrowRight'], { x: 1, y: 1 }],
    [['ArrowDown', 'ArrowLeft'], { x: -1, y: 1 }],
  ];
  for (const [arrows, dir] of cases) {
    const { k, input } = kb();
    for (const a of arrows) k.keyDown(a);
    assert.equal(k.keyDown('d'), true);
    assert.deepEqual(input.dashQueue, dir, arrows.join('+'));
    assert.equal(k.dashPending, false);
  }
});

test('D first, then arrows: arrows only aim (no jump / turn) and the chord fires on flush', () => {
  const { k, input } = kb();
  k.keyDown('d');
  assert.equal(k.dashPending, true);
  assert.equal(input.dashQueue, null);
  k.keyDown('ArrowUp');
  k.keyDown('ArrowLeft');
  assert.equal(input.jumpPresses, 0, '↑ while aiming is not a jump');
  assert.equal(input.faceQueue, 0, '← while aiming does not turn');
  k.flushDash();
  assert.deepEqual(input.dashQueue, { x: -1, y: -1 });
  assert.equal(k.dashPending, false);
});

test('D with no arrows dashes the facing way (zero vector → engine uses facing)', () => {
  const { k, input } = kb();
  k.keyDown('d');
  k.keyUp('d');
  k.flushDash();
  assert.deepEqual(input.dashQueue, { x: 0, y: 0 });
  const g = new Game(roomOnly(practiceLevel(), 0), { autoRun: true });
  g.setViewport(800, 400);
  sim(g, 10, () => {});
  const facing = g.player.facing;
  sim(g, 2, (f, i) => {
    if (f === 0) i.dashQueue = { x: 0, y: 0 };
  });
  assert.equal(Math.sign(g.player.vx), facing);
});

test('D is dash only: it never runs right; A runs left, arrows set direction', () => {
  const { k, input, touch } = kb();
  k.keyDown('d');
  assert.equal(touch.keyboardX, 0);
  assert.equal(input.faceQueue, 0);
  k.keyUp('d');
  k.flushDash();
  input.dashQueue = null;
  k.keyDown('a');
  assert.equal(input.faceQueue, -1);
  k.keyUp('a');
  k.keyDown('ArrowRight');
  assert.equal(input.faceQueue, 1);
  assert.equal(touch.keyboardX, 1);
});

test('Space / ↑ / Z jump; the hold lasts until every jump key is up', () => {
  const { k, input } = kb();
  k.keyDown(' ');
  k.keyDown('ArrowUp');
  assert.equal(input.jumpPresses, 1, 'second jump key while one is held is not a new press');
  assert.equal(input.jumpHeld, true);
  k.keyUp(' ');
  assert.equal(input.jumpHeld, true);
  k.keyUp('ArrowUp');
  assert.equal(input.jumpHeld, false);
  k.keyDown('z');
  assert.equal(input.jumpPresses, 2);
  k.keyDown('Escape');
  k.keyDown('x');
  assert.ok(input.dashQueue, 'X still dashes immediately');
  k.reset();
  assert.equal(input.jumpHeld, false);
});

test('editor tool hotkeys', () => {
  const expect: Record<string, string> = {
    w: '#', '1': '#', x: '^', '2': '^', a: 'saw', '3': 'saw', o: 'O', '4': 'O', k: 'K', '5': 'K', d: 'D', '6': 'D',
    s: 'S', '7': 'S', f: 'G', '8': 'G', c: '=', '9': '=', j: 'J', '0': 'J', e: 'erase', v: 'select', p: 'paste', r: 'room+',
    l: '-', b: '[', n: ']', y: '*', m: 'platform', i: ')', h: '%', u: 'P', g: 'E', z: 'F', q: 'R',
  };
  for (const [key, tool] of Object.entries(expect)) {
    assert.equal(toolForKey(key), tool, key);
    assert.equal(toolForKey(key.toUpperCase()), tool, key.toUpperCase());
  }
  assert.equal(toolForKey('t'), null, 'T is room playtest');
  assert.equal(toolForKey('/'), null);
  const keys = Object.values(TOOL_SHORTCUTS).flatMap((v) => v!.filter(Boolean));
  assert.equal(new Set(keys).size, keys.length, 'shortcuts are unique');
});

// ------------------------------------------------------------------ room practice

const W = 32;
const H = 16;
function walled(id: string, x: number, extra: (rows: string[][]) => void): RoomDef {
  const rows = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, cx) => (y === 0 || y === H - 1 || cx === 0 || cx === W - 1 ? '#' : '.')),
  );
  extra(rows);
  return { id, x, y: 0, tiles: rows.map((r) => r.join('')) };
}

function practiceLevel(): LevelDef {
  return {
    id: 'practice',
    name: 'Practice',
    subtitle: '',
    rooms: [
      walled('a', 0, (r) => {
        r[14][3] = 'S';
        r[14][6] = '1';
        r[14][28] = 'G';
        r[5][W - 1] = '.';
      }),
      walled('b', W, (r) => {
        r[5][0] = '.';
        r[14][20] = '1';
        r[14][24] = '2';
      }),
    ],
  };
}

test('room playtest: only that room, unpaired portals removed, temporary spawn on the bottom-center floor', () => {
  const level = practiceLevel();
  const before = JSON.stringify(level);
  const p = roomOnly(level, 1);
  assert.equal(JSON.stringify(level), before, 'source level untouched');
  assert.deepEqual(p.rooms.map((r) => r.id), ['b']);
  assert.ok(!p.rooms[0].tiles.join('').match(/[1-9]/), 'portals without a partner in this room are removed');
  assert.equal(p.rooms[0].tiles[14][16], 'S');
  assert.throws(() => buildWorld(p), /one goal/, 'a normal build still needs an exit');
  assert.deepEqual(roomIssues(p), []);
  const g = new Game(p, { autoRun: true, allowNoGoal: true });
  g.setViewport(800, 400);
  sim(g, 30, () => {});
  assert.equal(g.player.onGround, true);
  assert.equal(g.deaths, 0);
});

test('room playtest keeps an existing spawn and paired portals', () => {
  const level = practiceLevel();
  level.rooms[0].tiles[14] = level.rooms[0].tiles[14].slice(0, 10) + '1' + level.rooms[0].tiles[14].slice(11);
  const p = roomOnly(level, 0);
  assert.equal(p.rooms[0].tiles.join('').split('S').length - 1, 1);
  assert.equal(p.rooms[0].tiles[14][3], 'S');
  assert.equal(p.rooms[0].tiles.join('').split('1').length - 1, 2);
  assert.deepEqual(roomIssues(p), []);
});

test('temporary spawn avoids a pit under the room center', () => {
  const room = walled('pit', 0, (r) => {
    for (let x = 14; x <= 18; x++) r[H - 1][x] = '.';
  });
  assert.deepEqual(practiceSpawn(room), [13, 14]);
  const ledge = walled('ledge', 0, (r) => {
    for (let x = 1; x < W - 1; x++) r[H - 1][x] = '.';
    r[8][16] = '#';
  });
  assert.deepEqual(practiceSpawn(ledge), [16, 7]);
});

test('allowNoGoal still rejects more than one exit', () => {
  const level = practiceLevel();
  level.rooms[1].tiles[14] = level.rooms[1].tiles[14].slice(0, 5) + 'G' + level.rooms[1].tiles[14].slice(6);
  assert.ok(validateLevel(level, { allowNoGoal: true }).some((e) => e.includes('one goal')));
});

test('editor zoom keeps the world point under the cursor fixed', async () => {
  const { EditorController } = await import('../src/components/editorController');
  const ctl = new EditorController();
  ctl.configure('#', 400, 200, 1);
  ctl.focus(0, 0);
  const a = ctl.snapshot();
  const at = { x: 120, y: 70 };
  const wx = a.camX + at.x / 1;
  const wy = a.camY + at.y / 1;
  ctl.rescale(2, at);
  const b = ctl.snapshot();
  assert.ok(Math.abs(b.camX + at.x / 2 - wx) < 1e-6);
  assert.ok(Math.abs(b.camY + at.y / 2 - wy) < 1e-6);
});
