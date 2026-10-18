import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/engine/game';
import { createInput } from '../src/engine/input';
import { emptySave, recordClear } from '../src/engine/save';
import { flat, room, sim } from './helpers';

const spikeRun = () => {
  const rows = flat();
  rows[14] = rows[14].slice(0, 4) + '^'.repeat(8) + rows[14].slice(12);
  return room(rows);
};

test('assist invincibility ignores hazards', () => {
  const normal = new Game(spikeRun());
  normal.phase = 'playing';
  sim(normal, 120, (_, i) => (i.moveX = 1));
  assert.ok(normal.deaths > 0, 'the spikes kill without assist');
  const safe = new Game(spikeRun(), { assist: { speed: 1, infiniteDash: false, invincible: true } });
  safe.phase = 'playing';
  sim(safe, 120, (_, i) => (i.moveX = 1));
  assert.equal(safe.deaths, 0);
  assert.ok(safe.assist);
});

test('assist infinite dash keeps a dash after dashing in the air', () => {
  const g = new Game(room(flat()), { assist: { speed: 1, infiniteDash: true, invincible: false } });
  g.phase = 'playing';
  const input = createInput();
  input.dashQueue = { x: 0, y: -1 };
  sim(g, 3, () => {}, input);
  assert.ok(g.player.dashes >= 1);
});

test('assist off leaves the game unassisted', () => {
  assert.equal(new Game(room(flat()), { assist: { speed: 1, infiniteDash: false, invincible: false } }).assist, null);
});

test('assisted clears unlock but set no best time; a later normal clear does', () => {
  let s = recordClear(emptySave(), 'a', 5000, true).save;
  assert.deepEqual([s.levels.a.completed, s.levels.a.bestMs, s.levels.a.assisted], [true, null, true]);
  s = recordClear(s, 'a', 9000).save;
  assert.deepEqual([s.levels.a.bestMs, s.levels.a.assisted], [9000, false]);
  s = recordClear(s, 'a', 4000, true).save;
  assert.deepEqual([s.levels.a.bestMs, s.levels.a.assisted], [9000, false], 'assisted run never replaces a record');
});
