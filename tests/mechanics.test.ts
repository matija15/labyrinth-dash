import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/engine/game';
import { createInput } from '../src/engine/input';
import { flat, room, sim } from './helpers';

const set = (rows: string[], x: number, y: number, s: string) => {
  rows[y] = rows[y].slice(0, x) + s + rows[y].slice(x + s.length);
};
const playing = (g: Game) => {
  g.phase = 'playing';
  return g;
};

test('one-way platforms catch a fall from above and let you jump up through them', () => {
  const rows = flat();
  set(rows, 2, 14, '.');
  set(rows, 2, 4, 'S');
  set(rows, 1, 8, '------');
  const g = playing(new Game(room(rows)));
  sim(g, 120, () => {});
  assert.equal(g.player.y + 6, 64, 'lands on the one-way top');
  assert.ok(g.player.onGround);

  const up = flat();
  set(up, 1, 12, '------');
  const g2 = playing(new Game(room(up)));
  let minY = Infinity;
  sim(g2, 60, (f, i) => {
    if (f === 0) i.jumpPresses++;
    i.jumpHeld = f < 30;
    minY = Math.min(minY, g2.player.y);
  });
  assert.ok(minY + 6 < 96, 'jumped up through the platform');
  assert.equal(g2.player.y + 6, 96, 'then landed on top of it');
});

test('switch blocks swap solidity on every dash', () => {
  const rows = flat();
  set(rows, 10, 10, '[');
  set(rows, 12, 10, ']');
  const g = playing(new Game(room(rows)));
  assert.ok(g.isSolidTile(10, 10));
  assert.ok(!g.isSolidTile(12, 10));
  const input = createInput();
  input.dashQueue = { x: 1, y: 0 };
  sim(g, 30, () => {}, input);
  assert.ok(g.switchFlipped);
  assert.ok(!g.isSolidTile(10, 10));
  assert.ok(g.isSolidTile(12, 10));
});

test('crystals refill two dashes', () => {
  const rows = flat();
  set(rows, 4, 14, '*');
  const g = playing(new Game(room(rows)));
  sim(g, 30, (_, i) => (i.moveX = 1));
  assert.equal(g.player.dashes, 2);
  const input = createInput();
  input.dashQueue = { x: 0, y: -1 };
  sim(g, 30, () => {}, input);
  assert.equal(g.player.dashes, 1, 'one dash left after dashing in the air');
});

test('wind pushes the player sideways and up-drafts lift them', () => {
  const rows = flat();
  set(rows, 3, 14, '))))))))))');
  set(rows, 20, 10, 'uuu');
  set(rows, 20, 11, 'uuu');
  set(rows, 20, 12, 'uuu');
  set(rows, 20, 13, 'uuu');
  set(rows, 20, 14, 'uuu');
  const g = playing(new Game(room(rows)));
  g.player.x = 3 * 8 + 1;
  sim(g, 60, () => {});
  assert.ok(g.player.x > 3 * 8 + 20, `drifted right (${g.player.x})`);

  const g2 = playing(new Game(room(rows)));
  g2.player.x = 21 * 8 + 1;
  const y0 = g2.player.y;
  sim(g2, 30, () => {});
  assert.ok(g2.player.y < y0 - 10, `lifted (${g2.player.y})`);
});

test('moving platforms carry a rider and push the player', () => {
  const rows = flat();
  const lvl = room(rows, { platforms: [{ points: [[4, 13], [12, 13]], w: 3, speed: 2 }] });
  const g = playing(new Game(lvl));
  g.player.x = 4 * 8 + 2;
  g.player.y = 13 * 8 - 6;
  sim(g, 60, () => {});
  assert.ok(Math.abs(g.player.x - (4 * 8 + 2 + 8)) < 0.5, `carried 1 tile (${g.player.x})`);
  assert.equal(g.player.y, 13 * 8 - 6);

  const lift = room(flat(), { platforms: [{ points: [[1, 12], [1, 6]], w: 4, speed: 4 }] });
  const g2 = playing(new Game(lift));
  g2.player.x = 2 * 8;
  g2.player.y = 12 * 8 - 6;
  sim(g2, 60, () => {});
  assert.ok(Math.abs(g2.player.y - (10 * 8 - 6)) < 0.5, `lifted with the platform (${g2.player.y})`);
  assert.equal(g2.phase, 'playing');
});

test('a platform crushing the player into a wall kills', () => {
  const rows = flat();
  const lvl = room(rows, { platforms: [{ points: [[1, 13], [1, 1]], w: 4, speed: 6 }] });
  const g = playing(new Game(lvl));
  g.player.x = 2 * 8;
  g.player.y = 13 * 8 - 6;
  sim(g, 300, () => {});
  assert.ok(g.deaths >= 1);
});
