/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addSaw, blankLevel, charAt, clearRect, cloneLevel, copyRect, fillRect, paintTile, pasteClip, startingFrom,
} from '../src/engine/editor';
import { buildWorld } from '../src/engine/world';
import { DEV_LEVELS, DEV_TOOLS, RELEASE_LEVELS, packLevels } from '../src/levels';
import { RELEASE_DIR, StoreError, deleteLevel, indexSource, listLevels, readOrder, reorder, saveLevel } from '../scripts/level-store';

const named = (id: string) => ({ ...blankLevel(), id, name: id });

test('release builds only expose the release pack', () => {
  assert.equal(DEV_TOOLS, false, 'no __DEV__ / EXPO_PUBLIC_DEV_TOOLS outside Metro dev');
  assert.equal(packLevels('release'), RELEASE_LEVELS);
  assert.equal(packLevels('dev'), RELEASE_LEVELS, 'demo pack is unreachable without dev tools');
  const devIds = new Set(DEV_LEVELS.map((l) => l.id));
  for (const l of RELEASE_LEVELS) assert.ok(!devIds.has(l.id), `${l.id} is a demo level`);
});

test('committed release pack matches order.json and its generated index', () => {
  const order = readOrder(RELEASE_DIR);
  assert.deepEqual(RELEASE_LEVELS.map((l) => l.id), order);
  for (const id of order) assert.ok(existsSync(join(RELEASE_DIR, `${id}.json`)));
  assert.equal(readFileSync(join(RELEASE_DIR, 'index.ts'), 'utf8'), indexSource(order));
});

test('level store: save appends, renames in place, rejects clashes, reorders and deletes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pack-'));
  assert.equal(saveLevel(dir, named('one')).position, 1);
  assert.equal(saveLevel(dir, named('two')).position, 2);
  assert.equal(saveLevel(dir, named('three')).position, 3);
  assert.deepEqual(readOrder(dir), ['one', 'two', 'three']);

  const res = saveLevel(dir, named('second'), 'two');
  assert.deepEqual([res.position, res.created], [2, false]);
  assert.deepEqual(readOrder(dir), ['one', 'second', 'three']);
  assert.ok(!existsSync(join(dir, 'two.json')));
  assert.equal(saveLevel(dir, named('one'), 'one').position, 1, 'overwrite');

  assert.throws(() => saveLevel(dir, named('one')), (e: unknown) => e instanceof StoreError && e.status === 409);
  assert.throws(() => saveLevel(dir, named('Bad Id')), StoreError);
  assert.throws(() => reorder(dir, ['one', 'three']), StoreError);

  reorder(dir, ['three', 'one', 'second']);
  deleteLevel(dir, 'one');
  assert.deepEqual(listLevels(dir).map((l) => l.id), ['three', 'second']);
  assert.deepEqual(listLevels(dir)[0], named('three'));
  const index = readFileSync(join(dir, 'index.ts'), 'utf8');
  assert.match(index, /import level1 from '\.\/three\.json';\nimport level2 from '\.\/second\.json';/);
});

test('copy / paste moves tiles and saws, adding rooms where the paste lands outside', () => {
  const level = blankLevel();
  for (let x = 3; x <= 6; x++) paintTile(level, '#', x, 6);
  paintTile(level, 'O', 4, 4);
  addSaw(level, 4, 5, 6, 5);
  const clip = copyRect(level, { x: 3, y: 3, w: 5, h: 4 });
  assert.equal(clip.saws.length, 1);

  const rooms = level.rooms.length;
  assert.ok(pasteClip(level, clip, 40, 3));
  assert.equal(level.rooms.length, rooms + 1);
  for (let y = 0; y < clip.h; y++)
    for (let x = 0; x < clip.w; x++) assert.equal(charAt(level, 40 + x, 3 + y), clip.rows[y][x]);
  const room = level.rooms[level.rooms.length - 1];
  const saw = room.saws?.[0];
  assert.ok(saw && saw.kind === 'path');
  assert.deepEqual(saw.points[0], [41.5 - room.x, 5.5 - room.y], 'saw keeps its offset inside the block');

  assert.ok(clearRect(level, { x: 3, y: 3, w: 5, h: 4 }));
  assert.equal(charAt(level, 4, 4), '.');
  assert.equal(level.rooms[0].saws, undefined);
  assert.ok(fillRect(level, '#', { x: 2, y: 2, w: 3, h: 2 }));
  assert.equal(charAt(level, 4, 3), '#');
});

test('pasting a block with an exit flag keeps a single flag', () => {
  const level = blankLevel();
  const g = level.rooms[0].tiles.findIndex((r) => r.includes('G'));
  const gx = level.rooms[0].tiles[g].indexOf('G');
  const clip = copyRect(level, { x: gx, y: g, w: 1, h: 1 });
  pasteClip(level, clip, 5, 5);
  const flags = level.rooms.flatMap((r) => r.tiles).join('').split('G').length - 1;
  assert.equal(flags, 1);
  assert.equal(charAt(level, 5, 5), 'G');
});

test('pasting empty tiles past the map edge doesn’t add rooms', () => {
  const level = blankLevel();
  const clip = copyRect(level, { x: 10, y: 4, w: 6, h: 4 });
  assert.ok(clip.rows.every((r) => /^\.+$/.test(r)));
  pasteClip(level, clip, 29, 4);
  assert.equal(level.rooms.length, 1);
});

test('playtest from a room starts at that room’s spawn', () => {
  const level = DEV_LEVELS.find((l) => l.rooms.length >= 3)!;
  const full = buildWorld(level);
  const from = buildWorld(startingFrom(level, 2));
  assert.deepEqual(from.start, full.rooms[2].spawns[0]);
  assert.deepEqual(startingFrom(level, 0), cloneLevel(level));
  assert.equal(level.rooms.length, startingFrom(level, 2).rooms.length);
});

test('editor controller: select, copy, then paste tool stamps the block', async () => {
  const { EditorController } = await import('../src/components/editorController');
  const ctl = new EditorController();
  const px = 8;
  ctl.configure('#', 400, 128, 1);
  ctl.down(1, 4 * px + 1, 5 * px + 1);
  ctl.move(1, 6 * px + 1, 5 * px + 1);
  ctl.up(1);
  ctl.configure('select', 400, 128, 1);
  ctl.down(1, 4 * px + 1, 5 * px + 1);
  ctl.move(1, 6 * px + 1, 5 * px + 1);
  ctl.up(1);
  assert.deepEqual(ctl.snapshot().selection, { x: 4, y: 5, w: 3, h: 1 });
  ctl.selectionOp('copy');
  assert.ok(ctl.snapshot().hasClip);
  ctl.configure('paste', 400, 128, 1);
  ctl.down(1, 10 * px + 1, 8 * px + 1);
  assert.deepEqual(ctl.snapshot().pastePreview, { x: 10, y: 8, w: 3, h: 1 });
  ctl.up(1);
  for (let x = 10; x <= 12; x++) assert.equal(charAt(ctl.level, x, 8), '#');
  const undo = ctl.snapshot().undoCount;
  ctl.undo();
  assert.equal(charAt(ctl.level, 10, 8), '.');
  assert.equal(ctl.snapshot().undoCount, undo - 1);
});
