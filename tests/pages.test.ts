import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/engine/game';
import { createInput } from '../src/engine/input';
import { emptySave, pageCount, pagesFound, recordClear } from '../src/engine/save';
import { unlockStatus } from '../src/engine/skins';
import { buildWorld } from '../src/engine/world';
import { thornwoodMaze } from '../src/levels/dev/thornwoodMaze';
import type { LevelDef } from '../src/types';
import { flat, room, sim } from './helpers';

const withPage = (): LevelDef => {
  const rows = flat(40);
  rows[14] = rows[14].slice(0, 6) + '@' + rows[14].slice(7);
  return room(rows);
};

const touchPage = (g: Game) => {
  const pg = g.world.pages[0];
  g.phase = 'playing';
  g.player.x = pg.x - 3;
  g.player.y = pg.y - 4;
  sim(g, 2, () => {});
};

test('walking over a page picks it up with a short slow motion', () => {
  const g = new Game(withPage());
  assert.equal(g.world.pages.length, 1);
  touchPage(g);
  assert.deepEqual(g.pagesFound(), [0]);
  assert.ok(g.slowmo > 0);
  assert.ok(g.drainEvents().some((e) => e.type === 'page'));
});

test('a page is dropped when you die before leaving its room, and restart clears it', () => {
  const g = new Game(withPage());
  touchPage(g);
  (g as unknown as { die(): void }).die();
  sim(g, 240, () => {});
  assert.deepEqual(g.pagesFound(), []);
  touchPage(g);
  g.restart();
  assert.deepEqual(g.pagesFound(), []);
});

test('a page is kept once you reach the next room', () => {
  const a = flat(32);
  a[14] = a[14].slice(0, 6) + '@' + a[14].slice(7, 31) + '.';
  a[13] = a[13].slice(0, 31) + '.';
  const b = flat(32);
  b[14] = '.' + b[14].slice(1);
  b[13] = '.' + b[13].slice(1);
  b[1] = '#' + '.'.repeat(30) + '#';
  const level: LevelDef = { id: 't', name: 'T', subtitle: '', rooms: [{ id: 'a', x: 0, y: 0, tiles: a }, { id: 'b', x: 32, y: 0, tiles: b }] };
  const g = new Game(level);
  touchPage(g);
  g.player.x = 33 * 8;
  g.player.y = 14 * 8 - 10;
  sim(g, 120, () => {});
  assert.equal(g.room.id, 'b');
  (g as unknown as { die(): void }).die();
  sim(g, 240, () => {});
  assert.deepEqual(g.pagesFound(), [0]);
});

test('clears add newly found pages to the record and they count for page skins', () => {
  let save = recordClear(emptySave(), 'a', 1000, false, 3, [2, 0]).save;
  save = recordClear(save, 'a', 900, true, 0, [1, 0]).save;
  assert.deepEqual(save.levels.a.pages, [0, 1, 2]);
  assert.equal(pagesFound(save, ['a', 'b']), 3);
  assert.equal(pagesFound(save, ['b']), 0);
  assert.equal(unlockStatus('player', 'storybook', save, ['a']).unlocked, false);
  for (let i = 0; i < 5; i++) save = recordClear(save, `l${i}`, 1000, false, 0, [0, 1, 2]).save;
  assert.equal(unlockStatus('player', 'storybook', save, ['a', 'l0', 'l1', 'l2', 'l3', 'l4']).unlocked, true);
  assert.match(unlockStatus('player', 'storybook', emptySave(), []).label, /Find 15 pages · 0\/15/);
});

test('Thornwood Maze hides three pages', () => {
  assert.equal(pageCount(thornwoodMaze), 3);
  assert.equal(buildWorld(thornwoodMaze).pages.length, 3);
  void createInput;
});
