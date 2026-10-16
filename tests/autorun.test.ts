import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game';
import * as C from '../src/engine/constants';
import { TouchController } from '../src/engine/input';
import { flat, room, sim } from './helpers';

/** Closed box with a narrow vertical shaft (interior `inner` tiles wide) and the spawn at the bottom. */
const shaft = (inner = 4, h = 40) => {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) rows.push('#'.repeat(10) + (y === 0 || y === h - 1 ? '#' : '.').repeat(inner) + '#'.repeat(10));
  rows[1] = '#'.repeat(10) + 'G' + '.'.repeat(inner - 1) + '#'.repeat(10);
  rows[h - 2] = '#'.repeat(10) + 'S' + '.'.repeat(inner - 1) + '#'.repeat(10);
  return room(rows);
};

const tap = (input: { jumpPresses: number }) => input.jumpPresses++;

test('auto-run waits for the first tap, then runs toward the open side', () => {
  const g = new Game(room(flat()), { autoRun: true });
  const x0 = g.player.x;
  sim(g, 30, () => {});
  assert.equal(g.player.x, x0, 'no input → no movement');
  sim(g, 90, (f, i) => {
    if (f === 0) tap(i);
  });
  assert.ok(g.player.x > x0 + 40, `ran right (${g.player.x - x0}px)`);
  assert.equal(g.player.facing, 1);
});

test('auto-cling: touching a wall while airborne slides without holding toward it', () => {
  const g = new Game(room(flat(20, 30, 15)), { autoRun: true });
  g.player.facing = 1;
  // Jump toward the right wall and let auto-run carry the player into it.
  sim(g, 60, (f, i) => {
    if (f === 0) tap(i);
    i.jumpHeld = f < 20;
  });
  const p = g.player;
  assert.equal(p.wallDir, 1, 'touching right wall');
  assert.ok(!p.onGround);
  assert.ok(p.vy > 0 && p.vy <= C.WALL_SLIDE_MAX + 0.01, `slow slide (vy=${p.vy})`);
});

test('wall jump launches away and flips the run direction', () => {
  const g = new Game(room(flat(20, 30, 15)), { autoRun: true });
  g.player.facing = 1;
  const input = sim(g, 60, (f, i) => {
    if (f === 0) tap(i);
    i.jumpHeld = f < 20;
  });
  assert.equal(g.player.wallDir, 1);
  const y0 = g.player.y;
  sim(g, 1, (_, i) => tap(i), input);
  assert.ok(g.player.vx < 0 && g.player.vy < 0, 'diagonal up-and-away');
  assert.equal(g.player.facing, -1);
  sim(g, 15, () => {}, input);
  assert.ok(g.player.y < y0, 'gained height');
  sim(g, 45, () => {}, input);
  assert.ok(g.player.vx < 0, 'keeps running left after the forced push ends');
});

test('single-button shaft climbing: repeated jump presses scale the shaft', () => {
  const g = new Game(shaft(), { autoRun: true });
  const y0 = g.player.y;
  let last = -100;
  sim(g, 1200, (f, i) => {
    const p = g.player;
    if ((p.onGround || p.wallDir !== 0) && f - last > 12) {
      tap(i);
      last = f;
    }
    i.jumpHeld = f - last < 18;
  });
  assert.ok(y0 - g.player.y > 25 * C.TILE, `climbed ${(y0 - g.player.y) / C.TILE} tiles`);
  assert.equal(g.deaths, 0);
});

test('wall drop: swiping down on a wall releases it, falls straight, keeps the dash, turns away on landing', () => {
  const g = new Game(room(flat(20, 30, 15)), { autoRun: true });
  g.player.facing = 1;
  const input = sim(g, 60, (f, i) => {
    if (f === 0) tap(i);
    i.jumpHeld = f < 20;
  });
  const p0 = g.player;
  assert.equal(p0.wallDir, 1);
  const x = p0.x;
  input.dashQueue = { x: 0, y: 1 };
  sim(g, 1, () => {}, input);
  assert.equal(g.player.dashTimer, 0, 'not a dash');
  assert.equal(g.player.dashes, 1, 'dash charge kept');
  sim(g, 4, () => {}, input);
  assert.ok(g.player.vy > C.WALL_SLIDE_MAX, `falls faster than a slide (vy=${g.player.vy})`);
  assert.equal(g.player.x, x, 'straight down');
  sim(g, 200, () => {}, input);
  assert.ok(g.player.onGround);
  assert.equal(g.player.facing, -1, 'turned away from the wall');
  assert.ok(g.player.x < x - 10, 'running away from the wall');
});

test('down swipe away from walls is still a dash in auto-run', () => {
  const g = new Game(room(flat()), { autoRun: true });
  const input = sim(g, 2, (f, i) => {
    if (f === 0) tap(i);
  });
  sim(g, 30, () => {}, input);
  input.dashQueue = { x: 1, y: 0 };
  sim(g, 8, () => {}, input);
  assert.ok(g.player.dashTimer > 0 || g.player.dashes === 0);
});

test('manual scheme still needs a held direction to cling', () => {
  const g = new Game(room(flat(20, 30, 15)));
  sim(g, 52, (f, i) => {
    if (f === 0) tap(i);
    i.jumpHeld = f < 20;
    i.moveX = f < 40 ? 1 : 0;
  });
  assert.ok(!g.player.onGround);
  assert.ok(g.player.vy > C.WALL_SLIDE_MAX, `free fall once released (vy=${g.player.vy})`);
});

test('auto-run touch layout: bottom-of-screen touches jump instead of steering', () => {
  const t = new TouchController();
  t.autoRun = true;
  t.resize(800, 400);
  t.down(1, 50, 380, 0);
  assert.equal(t.input.moveX, 0);
  assert.equal(t.input.jumpPresses, 1);
  assert.equal(t.input.jumpHeld, true);
});

test('static spawn: auto-run stays idle in the ready phase until a direction tap', () => {
  const g = new Game(room(flat()), { autoRun: true });
  const x0 = g.player.x;
  sim(g, 60, () => {});
  assert.equal(g.phase, 'ready');
  assert.equal(g.player.x, x0);
});

test('direction tap starts running that way without jumping', () => {
  for (const dir of [-1, 1]) {
    const g = new Game(room(flat(40, 16, 20)), { autoRun: true });
    const { x: x0, y: y0 } = g.player;
    sim(g, 60, (f, i) => {
      if (f === 0) i.faceQueue = dir;
    });
    assert.equal(g.phase, 'playing');
    assert.equal(g.player.facing, dir);
    assert.ok(g.player.onGround, 'still grounded');
    assert.equal(g.player.y, y0, 'no jump');
    assert.ok((g.player.x - x0) * dir > 40, `ran ${dir < 0 ? 'left' : 'right'}`);
  }
});

test('opposite-side tap on the ground flips the run instantly, without a jump', () => {
  const g = new Game(room(flat(40, 16, 20)), { autoRun: true });
  const input = sim(g, 40, (f, i) => {
    if (f === 0) i.faceQueue = 1;
  });
  const y0 = g.player.y;
  input.faceQueue = -1;
  sim(g, 1, () => {}, input);
  assert.equal(g.player.facing, -1);
  assert.ok(g.player.vx < 0, 'moving left on the very next step');
  sim(g, 30, () => {}, input);
  assert.ok(g.player.onGround);
  assert.equal(g.player.y, y0);
  assert.equal(g.player.vy, 0);
});

test('touch: half-screen taps set direction, corner buttons and second fingers jump', () => {
  const t = new TouchController();
  t.autoRun = true;
  t.resize(800, 400);
  t.down(1, 200, 150, 0);
  assert.equal(t.input.faceQueue, -1);
  assert.equal(t.input.jumpPresses, 0);
  assert.equal(t.input.jumpHeld, false);
  t.up(1);
  t.input.faceQueue = 0;
  t.down(2, 600, 150, 10);
  assert.equal(t.input.faceQueue, 1);
  assert.equal(t.input.jumpPresses, 0);
  // second finger while the first is still down → jump, direction untouched
  t.input.faceQueue = 0;
  t.down(3, 200, 150, 20);
  assert.equal(t.input.jumpPresses, 1);
  assert.equal(t.input.faceQueue, 0);
  assert.equal(t.input.jumpHeld, true);
  t.clear();
  // right corner jump button
  t.down(4, 740, 340, 30);
  assert.equal(t.input.jumpPresses, 2);
  assert.equal(t.input.faceQueue, 0);
  assert.deepEqual(t.jumpButtonState(), [false, true]);
  t.clear();
  // swiping from a direction tap still dashes
  t.down(5, 300, 150, 40);
  t.move(5, 300, 200, 60);
  assert.deepEqual(t.input.dashQueue, { x: 0, y: 1 });
  assert.equal(t.input.jumpPresses, 2);
});
