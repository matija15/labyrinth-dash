/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game';
import * as C from '../src/engine/constants';
import { flat, room, sim } from './helpers';

const start = (rows = flat()) => {
  const g = new Game(room(rows));
  g.setViewport(800, 400);
  return g;
};

test('reports movement envelope', () => {
  // Max jump height (held)
  let g = start();
  const y0 = g.player.y;
  let minY = y0;
  sim(g, 120, (f, i) => {
    if (f === 0) i.jumpPresses++;
    i.jumpHeld = true;
    minY = Math.min(minY, g.player.y);
  });
  const full = (y0 - minY) / C.TILE;
  // Tap hop
  g = start();
  minY = y0;
  sim(g, 120, (f, i) => {
    if (f === 0) i.jumpPresses++;
    i.jumpHeld = f < 2;
    minY = Math.min(minY, g.player.y);
  });
  const hop = (y0 - minY) / C.TILE;
  // Running jump distance (same height)
  g = start();
  let x0 = 0;
  let landed = -1;
  sim(g, 240, (f, i) => {
    i.moveX = 1;
    if (f === 60) {
      x0 = g.player.x;
      i.jumpPresses++;
    }
    i.jumpHeld = f >= 60;
    if (f > 70 && landed < 0 && g.player.onGround) landed = g.player.x;
  });
  const dist = (landed - x0) / C.TILE;
  // Horizontal dash distance (on ground)
  g = start();
  sim(g, 60, (f, i) => {
    if (f === 1) i.dashQueue = { x: 1, y: 0 };
  });
  const dash = (g.player.x - g.world.start.x) / C.TILE;
  console.log({ fullJumpTiles: full.toFixed(2), hopTiles: hop.toFixed(2), runJumpTiles: dist.toFixed(2), groundDashTiles: dash.toFixed(2) });
  assert.ok(full > 3 && full < 4, `full jump ${full}`);
  assert.ok(hop < 1.5, `hop ${hop}`);
  assert.ok(full > hop * 2);
  assert.ok(dist > 5, `run jump ${dist}`);
});

test('coyote time allows a jump shortly after leaving a ledge, but not later', () => {
  const rows = flat();
  rows[14] = '#' + '.'.repeat(38) + '#';
  rows[9] = '#.S' + '.'.repeat(36) + '#';
  rows[10] = '###########' + '.'.repeat(28) + '#';
  const peakAfterJump = (delayFrames: number) => {
    const g = new Game(room(rows));
    let left = -1;
    let minY = Infinity;
    sim(g, 260, (f, i) => {
      i.moveX = 1;
      if (left < 0 && f > 2 && !g.player.onGround) left = f;
      if (left > 0 && f === left + delayFrames) i.jumpPresses++;
      i.jumpHeld = left > 0 && f >= left + delayFrames;
      if (left > 0 && f > left + delayFrames) minY = Math.min(minY, g.player.y);
    });
    return g.world.start.y - minY;
  };
  assert.ok(peakAfterJump(8) > C.TILE * 2, 'coyote jump (~67ms late) should rise');
  assert.ok(peakAfterJump(20) <= 0, 'jump ~167ms after leaving must not fire');
});

test('jump buffer triggers a jump on landing', () => {
  const g = start();
  sim(g, 30, (f, i) => {
    if (f === 0) i.jumpPresses++;
    i.jumpHeld = f < 30;
  });
  // fall back down; press jump slightly before landing
  let pressed = false;
  let rose = false;
  sim(g, 200, (_f, i) => {
    const p = g.player;
    const floorY = g.world.start.y;
    if (!pressed && p.vy > 0 && floorY - p.y < 4) {
      i.jumpPresses++;
      pressed = true;
    }
    i.jumpHeld = pressed;
    if (pressed && p.vy < 0) rose = true;
  });
  assert.ok(pressed && rose);
});

test('wall slide slows descent and wall jump pushes away', () => {
  const rows = flat();
  for (let y = 2; y < 14; y++) rows[y] = rows[y].slice(0, 8) + '#' + rows[y].slice(9);
  const g = new Game(room(rows));
  // walk into the wall at col 8, jump up it, keep holding right
  let maxVy = 0;
  let wallJumped = false;
  let vxAfter = 0;
  sim(g, 200, (f, i) => {
    if (f === 40) i.jumpPresses++;
    i.jumpHeld = f >= 40 && f < 65;
    i.moveX = 1;
    if (f > 60 && f < 100 && g.player.wallDir === 1) maxVy = Math.max(maxVy, g.player.vy);
    if (f === 100 && g.player.wallDir === 1) {
      i.jumpPresses++;
      wallJumped = true;
    }
    if (f === 104) vxAfter = g.player.vx;
  });
  assert.ok(maxVy <= C.WALL_SLIDE_MAX + 0.01, `slide ${maxVy}`);
  assert.ok(wallJumped);
  assert.ok(vxAfter < 0, 'wall jump pushes away from wall');
});

test('dash freezes gravity, uses the charge, and recharges on landing', () => {
  const g = start();
  sim(g, 20, (f, i) => {
    if (f === 0) i.jumpPresses++;
    i.jumpHeld = true;
  });
  sim(g, 1, (_f, i) => (i.dashQueue = { x: 1, y: 0 }));
  assert.equal(g.player.dashes, 0);
  const y = g.player.y;
  sim(g, 10, () => {});
  assert.equal(g.player.y, y, 'horizontal dash keeps altitude');
  assert.ok(g.player.vx > C.RUN_SPEED);
  sim(g, 120, () => {});
  assert.ok(g.player.onGround);
  assert.equal(g.player.dashes, 1);
});

test('spikes kill and respawn quickly at the checkpoint', () => {
  const rows = flat();
  const r = flat();
  r[14] = '#.S...^^^^^' + '.'.repeat(28) + '#';
  const g = new Game(room(r));
  let deadAt = -1;
  sim(g, 200, (f, i) => {
    i.moveX = deadAt < 0 ? 1 : 0;
    if (deadAt < 0 && g.phase === 'dead') deadAt = f;
  });
  assert.ok(deadAt > 0, 'player should die on spikes');
  assert.equal(g.deaths, 1);
  assert.equal(g.phase, 'playing');
  assert.deepEqual({ x: g.player.x, y: g.player.y }, g.world.start);
  assert.ok((C.DEATH_TIME + C.RESPAWN_TIME) < 1, 'sub-second respawn');
});

test('keys open doors and are restored if you die before leaving the room', () => {
  const r = flat();
  r[14] = '#.S..K....D' + '.'.repeat(28) + '#';
  r[13] = r[13].slice(0, 10) + 'D' + r[13].slice(11);
  r[12] = r[12].slice(0, 10) + 'D' + r[12].slice(11);
  const g = new Game(room(r));
  sim(g, 160, (_f, i) => (i.moveX = 1));
  assert.equal(g.doorsOpen[0], true);
  assert.ok(g.player.x > 11 * C.TILE, 'walked through opened door');
  g.die();
  sim(g, 120, () => {});
  assert.equal(g.doorsOpen[0], false);
  assert.equal(g.heldKeys, 0);
  assert.equal(g.keysTaken[0], false);
});

test('saws kill on contact', () => {
  const r = flat();
  const g = new Game(room(r, { saws: [{ kind: 'path', points: [[8, 14.5], [8, 14.5]], speed: 1, radius: 0.8 }] }));
  sim(g, 200, (_f, i) => (i.moveX = 1));
  assert.ok(g.deaths >= 1);
});

test('crumbling platforms fall after being stood on and come back', () => {
  const r = flat();
  r[14] = '#' + '.'.repeat(38) + '#';
  r[15] = '#'.repeat(40);
  r[13] = '#.S' + '.'.repeat(36) + '#';
  r[14] = '##=' + '#'.repeat(36) + '#';
  const g = new Game(room(r));
  // tiny hop starts the run; then stand still on the crumble at col 2
  sim(g, 1, (_f, i) => i.jumpPresses++);
  sim(g, Math.ceil((C.CRUMBLE_SHAKE + 0.6) * 120), (_f, i) => (i.jumpHeld = false));
  assert.equal(g.crumbleState[0], 2);
});

test('room transition moves to the neighbouring room and sets its checkpoint', () => {
  const a = flat(32, 16);
  a[13] = a[13].slice(0, 31) + '.';
  a[14] = a[14].slice(0, 31) + '.';
  a[1] = '#' + '.'.repeat(30) + '#';
  const b = flat(32, 16, 3);
  b[13] = '.' + b[13].slice(1);
  b[14] = '.' + b[14].slice(1);
  const g = new Game({
    id: 't', name: 't', subtitle: '',
    rooms: [
      { id: 'a', x: 0, y: 0, tiles: a },
      { id: 'b', x: 32, y: 0, tiles: b },
    ],
  });
  g.setViewport(800, 400);
  let sawTransition = false;
  sim(g, 600, (_f, i) => {
    i.moveX = 1;
    if (g.phase === 'transition') sawTransition = true;
  });
  assert.ok(sawTransition);
  assert.equal(g.room.id, 'b');
});
