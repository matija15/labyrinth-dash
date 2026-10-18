import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chapters, CHAPTER_SIZE } from '../src/engine/chapters';
import { GhostRecorder, ghostAt } from '../src/engine/ghost';
import { emptySave, recordClear } from '../src/engine/save';
import type { LevelDef } from '../src/types';

const lvl = (id: string, chapter?: string): LevelDef => ({ id, name: id, subtitle: '', rooms: [], ...(chapter ? { chapter } : {}) });

test('chapters group named runs and fill unnamed levels in blocks', () => {
  const levels = [lvl('a', 'Caves'), lvl('b', 'Caves'), lvl('c', 'Wind'), ...Array.from({ length: CHAPTER_SIZE + 2 }, (_, i) => lvl(`u${i}`))];
  const chs = chapters(levels);
  assert.deepEqual(chs.map((c) => [c.name, c.start, c.end]), [
    ['Caves', 0, 2], ['Wind', 2, 3], ['Chapter 3', 3, 3 + CHAPTER_SIZE], ['Chapter 4', 3 + CHAPTER_SIZE, levels.length],
  ]);
  assert.deepEqual(chapters([]), []);
});

test('ghost records at 30 Hz, interpolates, ends, and restarts with the run', () => {
  const rec = new GhostRecorder();
  const g = { time: 0, player: { x: 0, y: 5 } };
  for (let f = 0; f <= 120; f++) {
    g.time = f / 120;
    g.player.x = f;
    rec.sample(g as never);
  }
  const ghost = rec.finish(1000);
  assert.equal(ghost.xs.length, 31);
  const mid = ghostAt(ghost, 0.5)!;
  assert.ok(Math.abs(mid.x - 60) < 1e-6);
  assert.equal(mid.y, 5);
  assert.equal(ghostAt(ghost, 2), null);
  g.time = 0;
  rec.sample(g as never);
  assert.equal(rec.finish(0).xs.length, 1, 'a restart starts a new recording');
});

test('clears keep the fewest deaths of unassisted runs', () => {
  let s = recordClear(emptySave(), 'a', 9000, false, 12).save;
  s = recordClear(s, 'a', 9500, false, 4).save;
  s = recordClear(s, 'a', 8000, true, 0).save;
  assert.equal(s.levels.a.fewestDeaths, 4);
});
