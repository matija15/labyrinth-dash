import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/engine/game';
import { flat, room, sim } from './helpers';

const set = (rows: string[], x: number, y: number, s: string) => {
  rows[y] = rows[y].slice(0, x) + s + rows[y].slice(x + s.length);
};
const gateColumn = (rows: string[], x: number, ch: string) => {
  for (let y = 1; y < 15; y++) set(rows, x, y, ch);
};

test('a gravity gate drops you onto the ceiling, where jumps go down; death restores gravity', () => {
  const rows = flat();
  gateColumn(rows, 8, 'F');
  const g = new Game(room(rows));
  sim(g, 240, (_f, i) => { i.moveX = g.player.x < 12 * 8 ? 1 : 0; });
  assert.equal(g.gravity, -1);
  assert.ok(g.player.onGround, 'standing on the ceiling');
  assert.equal(g.player.y, 8, 'right under the top wall');
  let maxY = 0;
  sim(g, 40, (f, i) => {
    if (f === 0) i.jumpPresses++;
    i.jumpHeld = f < 20;
    maxY = Math.max(maxY, g.player.y);
  });
  assert.ok(maxY > 8 + 8, 'jumped downward');
  g.die();
  sim(g, 120, () => {});
  assert.equal(g.gravity, 1, 'respawn uses the checkpoint gravity');
});

test('crossing the same gate twice flips back', () => {
  const rows = flat();
  gateColumn(rows, 8, 'F');
  gateColumn(rows, 9, 'F');
  const g = new Game(room(rows));
  sim(g, 240, (_f, i) => { i.moveX = g.player.x < 14 * 8 ? 1 : 0; });
  assert.equal(g.gravity, -1, 'a wide gate still fires once');
  sim(g, 240, (_f, i) => { i.moveX = g.player.x > 4 * 8 ? -1 : 0; });
  assert.equal(g.gravity, 1);
});

test('a reverse gate turns the auto-runner around', () => {
  const rows = flat();
  gateColumn(rows, 12, 'R');
  const g = new Game(room(rows), { autoRun: true });
  g.phase = 'playing';
  g.player.running = true;
  g.player.facing = 1;
  let maxX = 0;
  sim(g, 360, () => { maxX = Math.max(maxX, g.player.x); });
  assert.ok(maxX < 13 * 8, 'never got past the gate');
  assert.equal(g.player.facing, -1);
  assert.ok(g.player.x < 8 * 8, 'running back left');
});
