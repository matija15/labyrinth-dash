/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_LEVELS as LEVELS } from '../src/levels/dev';
import { buildWorld, validateLevel } from '../src/engine/world';
import { Game } from '../src/engine/game';
import { createInput } from '../src/engine/input';
import {
  ROOM_H, ROOM_W, addRoomAt, addSaw, blankLevel, charAt, cloneLevel, deleteRoomAt, editorIssues, lineTiles,
  levelToCode, levelToJson, paintTile, parseLevelCode, roomRect,
} from '../src/engine/editor';

test('blank editor level is valid and playable to the exit flag', () => {
  const level = blankLevel();
  assert.deepEqual(validateLevel(level), []);
  assert.deepEqual(editorIssues(level), []);
  const g = new Game(level, { autoRun: true });
  const input = createInput();
  input.tapQueue = 1;
  let won = false;
  for (let f = 0; f < 120 * 6 && !won; f++) {
    g.step(input);
    input.tapQueue = 0;
    won = g.drainEvents().some((e) => e.type === 'goal');
  }
  assert.ok(won, 'auto-run reaches the exit flag');
});

test('painting tiles, single exit flag, spike orientation', () => {
  const level = blankLevel();
  assert.ok(paintTile(level, '#', 10, 10));
  assert.equal(charAt(level, 10, 10), '#');
  assert.ok(!paintTile(level, '#', 10, 10), 'repainting the same tile is a no-op');
  paintTile(level, 'G', 12, 13);
  const goals = level.rooms.flatMap((r) => r.tiles).join('').split('G').length - 1;
  assert.equal(goals, 1);
  assert.equal(charAt(level, 12, 13), 'G');
  paintTile(level, '^', 5, 13);
  assert.equal(charAt(level, 5, 13), '^', 'spike on floor points up');
  paintTile(level, '^', 5, 1);
  assert.equal(charAt(level, 5, 1), 'v', 'spike under ceiling points down');
  paintTile(level, '^', 1, 6);
  assert.equal(charAt(level, 1, 6), '>', 'spike on left wall points right');
  paintTile(level, 'erase', 10, 10);
  assert.equal(charAt(level, 10, 10), '.');
});

test('painting outside rooms adds a walled room that needs a spawn', () => {
  const level = blankLevel();
  assert.ok(paintTile(level, 'O', ROOM_W + 5, 4));
  assert.equal(level.rooms.length, 2);
  const r = level.rooms[1];
  assert.deepEqual(roomRect(r), { x: ROOM_W, y: 0, w: ROOM_W, h: ROOM_H });
  assert.equal(charAt(level, ROOM_W + 5, 4), 'O');
  assert.equal(charAt(level, ROOM_W, 4), '#', 'new rooms are walled');
  assert.deepEqual(editorIssues(level), [`Room ${r.id} needs a Spawn Point (checkpoint)`]);
  paintTile(level, 'S', ROOM_W + 3, 13);
  assert.deepEqual(editorIssues(level), []);
  assert.ok(deleteRoomAt(level, ROOM_W + 1, 1));
  assert.equal(level.rooms.length, 1);
  assert.ok(!deleteRoomAt(level, 1, 1), 'last room cannot be deleted');
});

test('new rooms never overlap irregular existing rooms', () => {
  const level = cloneLevel(LEVELS.find((l) => l.id === 'saw-mill')!);
  for (const [x, y] of [[-3, 2], [20, -5], [75, 20], [41, 17]]) addRoomAt(level, x, y);
  assert.ok(level.rooms.length > 3);
  assert.deepEqual(validateLevel(level).filter((e) => e.includes('overlap')), []);
});

test('saws: drag makes a ping-pong path, tap makes an orbit, eraser removes them', () => {
  const level = blankLevel();
  assert.ok(addSaw(level, 8, 10, 14, 10));
  assert.ok(addSaw(level, 20, 8, 20, 8));
  const saws = level.rooms[0].saws!;
  assert.deepEqual(saws[0], { kind: 'path', points: [[8.5, 10.5], [14.5, 10.5]], speed: 4, radius: 0.8, mode: 'pingpong' });
  assert.equal(saws[1].kind, 'orbit');
  buildWorld(level);
  new Game(level).step(createInput());
  paintTile(level, 'erase', 14, 10);
  assert.equal(level.rooms[0].saws!.length, 1);
  paintTile(level, 'erase', 20, 8);
  assert.equal(level.rooms[0].saws, undefined);
});

test('lineTiles fills drag gaps', () => {
  assert.deepEqual(lineTiles(0, 0, 3, 1), [[0, 0], [1, 0], [2, 1], [3, 1]]);
  assert.deepEqual(lineTiles(2, 2, 2, 2), [[2, 2]]);
});

for (const level of LEVELS) {
  test(`level ${level.id} round-trips through export code, JSON and its source file`, () => {
    assert.deepEqual(parseLevelCode(levelToCode(level)), level);
    assert.deepEqual(parseLevelCode(levelToJson(level)), level);
    const file = readdirLevelFile(level.id);
    assert.deepEqual(parseLevelCode(file), level);
  });
}

function readdirLevelFile(id: string) {
  const names: Record<string, string> = {
    'first-light': 'firstLight', 'dash-lab': 'dashLab', labyrinth: 'labyrinth',
    switchback: 'switchback', 'saw-mill': 'sawMill', undercroft: 'undercroft', contraptions: 'contraptions', 'thornwood-maze': 'thornwoodMaze',
  };
  return readFileSync(join(__dirname, '..', 'src', 'levels', 'dev', `${names[id]}.ts`), 'utf8');
}

test('parseLevelCode reports bad input', () => {
  assert.throws(() => parseLevelCode('hello'), /No level object/);
  assert.throws(() => parseLevelCode('{ "rooms": [] }'), /rooms/);
  assert.throws(() => parseLevelCode('{ rooms: [{ tiles: 5 }] }'), /tiles/);
});

test('editor controller: drag paints a line, second finger pans and cancels, undo restores', async () => {
  const { EditorController } = await import('../src/components/editorController');
  const ctl = new EditorController();
  const px = 8; // scale 1 → one tile = 8 screen px
  ctl.configure('#', 400, 128, 1);
  ctl.down(1, 4 * px + 1, 5 * px + 1);
  ctl.move(1, 9 * px + 1, 5 * px + 1);
  ctl.up(1);
  for (let x = 4; x <= 9; x++) assert.equal(charAt(ctl.level, x, 5), '#');
  assert.equal(ctl.snapshot().undoCount, 1);

  ctl.down(1, 12 * px + 1, 8 * px + 1);
  assert.equal(charAt(ctl.level, 12, 8), '#');
  ctl.down(2, 20 * px, 8 * px);
  assert.equal(charAt(ctl.level, 12, 8), '.', 'second finger cancels the stroke');
  const cam = ctl.snapshot().camX;
  ctl.move(1, 12 * px + 1 - 16, 8 * px + 1);
  ctl.move(2, 20 * px - 16, 8 * px);
  assert.equal(ctl.snapshot().camX, cam + 16);
  ctl.up(1);
  ctl.up(2);
  assert.equal(ctl.snapshot().undoCount, 1);

  ctl.undo();
  assert.equal(charAt(ctl.level, 4, 5), '.');
  assert.equal(ctl.snapshot().undoCount, 0);

  ctl.configure('saw', 400, 128, 1);
  ctl.down(1, 6 * px, 9 * px);
  ctl.move(1, 12 * px, 9 * px);
  ctl.up(1);
  assert.equal(ctl.level.rooms[0].saws?.[0].kind, 'path');
});
