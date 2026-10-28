import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkLevel } from '../src/engine/check';
import { startingAt } from '../src/engine/editor';
import { DEV_LEVELS } from '../src/levels/dev';
import type { LevelDef } from '../src/types';

const box = (rows: string[]): LevelDef => ({ id: 'c', name: 'C', subtitle: '', rooms: [{ id: 'r', x: 0, y: 0, tiles: rows }] });
const W = '##########';
const base = [W, '#........#', '#........#', '#S......G#', W];
const edit = (rows: string[], y: number, x: number, ch: string) =>
  rows.map((r, i) => (i === y ? r.slice(0, x) + ch + r.slice(x + 1) : r));

test('a well-formed room has no issues', () => {
  assert.deepEqual(checkLevel(box(base)), []);
});

test('demo levels have no checker errors', () => {
  for (const l of DEV_LEVELS) assert.deepEqual(checkLevel(l).filter((i) => i.severity === 'error'), [], l.id);
});

test('keys and doors must match', () => {
  const door = checkLevel(box(edit(base, 2, 5, 'D')));
  assert.ok(door.some((i) => /1 door but only 0 keys/.test(i.message) && i.at?.[0] === 5));
  const key = checkLevel(box(edit(base, 2, 5, 'K')));
  assert.ok(key.some((i) => /extra keys/.test(i.message)));
});

test('echo doors need a plate in the same room', () => {
  const issues = checkLevel(box(edit(base, 2, 5, 'E')));
  assert.ok(issues.some((i) => /echo door but no echo plate/.test(i.message)));
});

test('open edges into nothing are flagged', () => {
  const issues = checkLevel(box(edit(base, 2, 9, '.')));
  assert.ok(issues.some((i) => /open edge/.test(i.message) && i.at?.[0] === 9 && i.at?.[1] === 2));
});

test('a walled-off flag is an error and a walled-off page a warning', () => {
  let rows = edit(base, 1, 7, '#');
  rows = edit(rows, 2, 7, '#');
  rows = edit(rows, 3, 7, '#');
  rows = edit(rows, 1, 8, '@');
  const issues = checkLevel(box(rows));
  assert.ok(issues.some((i) => i.severity === 'error' && /Exit flag is walled off/.test(i.message)));
  assert.ok(issues.some((i) => i.severity === 'warn' && /storybook page is walled off/.test(i.message)));
});

test('playtest from a tile moves the spawn there and puts its room first', () => {
  const level: LevelDef = {
    id: 'c', name: 'C', subtitle: '',
    rooms: [{ id: 'a', x: 0, y: 0, tiles: base }, { id: 'b', x: 10, y: 0, tiles: [W, '#........#', '#........#', '#S.......#', W] }],
  };
  const out = startingAt(level, 14, 2)!;
  assert.equal(out.rooms[0].id, 'b');
  assert.equal(out.rooms[0].tiles.join('').split('S').length - 1, 1);
  assert.equal(out.rooms[0].tiles[2][4], 'S');
  assert.equal(level.rooms[1].tiles[2][4], '.', 'original untouched');
  assert.equal(startingAt(level, 10, 0), null, 'wall tile');
  assert.equal(startingAt(level, 40, 40), null, 'outside');
});
