import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/engine/game';
import { thornwoodMaze } from '../src/levels/dev/thornwoodMaze';
import { flat, room, sim } from './helpers';

test('fake walls are passable, and found walls stay revealed after a death', () => {
  const rows = flat();
  for (let y = 1; y < 15; y++) rows[y] = rows[y].slice(0, 10) + '%' + rows[y].slice(11);
  const g = new Game(room(rows));
  g.phase = 'playing';
  assert.equal(g.world.fakes.length, 1, 'the column is one group');
  assert.equal(g.isSolidTile(10, 13), false);
  sim(g, 120, (_f, i) => { i.moveX = 1; });
  assert.ok(g.player.x > 11 * 8, 'ran through the fake wall');
  assert.ok(g.fakeRevealed[0]);
  g.die();
  sim(g, 120, () => {});
  assert.ok(g.fakeRevealed[0], 'secrets stay found after respawning');
  g.restart();
  assert.ok(!g.fakeRevealed[0], 'a restart hides them again');
});

test('the demo maze branches: two exits from the first room into the second', () => {
  const [fork, thicket] = thornwoodMaze.rooms;
  const openRight = fork.tiles.filter((r) => r[31] !== '#').length;
  const openLeft = thicket.tiles.filter((r) => r[0] !== '#').length;
  assert.equal(openRight, 6);
  assert.equal(openLeft, 6);
  assert.ok(thicket.tiles.some((r) => r.includes('%')) && thicket.tiles.some((r) => r.includes('K')));
});
