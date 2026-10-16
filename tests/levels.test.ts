/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEV_LEVELS as LEVELS } from '../src/levels/dev';
import { RELEASE_LEVELS } from '../src/levels/release';
import { buildWorld, roomAt, validateLevel } from '../src/engine/world';
import { Game } from '../src/engine/game';
import { parseTmxRoom } from '../src/engine/tmx';
import { emptySave, recordClear, recordDeaths, formatTime } from '../src/engine/save';
import { quantizeDir8 } from '../src/engine/math';
import { TouchController } from '../src/engine/input';

for (const level of [...LEVELS, ...RELEASE_LEVELS]) {
  test(`level ${level.id} is valid and builds`, () => {
    assert.deepEqual(validateLevel(level), []);
    const world = buildWorld(level);
    assert.ok(world.goal);
    for (const room of world.rooms) {
      for (const s of room.spawns) {
        const g = new Game(level);
        assert.ok(!g.solidRect(s.x, s.y, 6, 6), `${room.id}: spawn inside a wall`);
        assert.ok(g.solidRect(s.x, s.y + 1, 6, 6), `${room.id}: spawn must stand on ground`);
        assert.equal(roomAt(world, s.x + 3, s.y + 3), room);
      }
    }
  });
}

test('built-in levels demonstrate every mechanic', () => {
  const all = LEVELS.flatMap((l) => l.rooms.flatMap((r) => r.tiles)).join('');
  for (const ch of ['^', 'v', '=', 'K', 'D', 'O', 'J', '1', 'G']) assert.ok(all.includes(ch), `missing ${ch}`);
  assert.ok(LEVELS.some((l) => l.rooms.some((r) => r.saws?.some((s) => s.kind === 'path'))));
  assert.ok(LEVELS.some((l) => l.rooms.some((r) => r.saws?.some((s) => s.kind === 'orbit'))));
});

test('parses a CSV Tiled .tmx room with saw objects', () => {
  const xml = `<?xml version="1.0"?>
<map version="1.10" orientation="orthogonal" width="4" height="3" tilewidth="8" tileheight="8">
 <tileset firstgid="1" source="labyrinth.tsx"/>
 <layer id="1" name="tiles" width="4" height="3">
  <data encoding="csv">
1,1,1,1,
1,11,0,12,
1,2,2,1
</data>
 </layer>
 <objectgroup id="2" name="hazards">
  <object id="3" type="saw" x="8" y="8"><properties><property name="speed" value="5"/></properties><polyline points="0,0 16,0"/></object>
  <object id="4" class="saw" x="16" y="8"><properties><property name="orbit" value="1.5"/></properties></object>
 </objectgroup>
</map>`;
  const room = parseTmxRoom(xml, { id: 'tmx', x: 0, y: 0 });
  assert.deepEqual(room.tiles, ['####', '#S.G', '#^^#']);
  assert.equal(room.saws?.length, 2);
  assert.deepEqual(room.saws?.[0], { kind: 'path', points: [[1, 1], [3, 1]], speed: 5, radius: 0.8, mode: 'pingpong' });
  assert.equal(room.saws?.[1].kind, 'orbit');
});

test('save reducers keep best time and accumulate deaths', () => {
  let s = recordDeaths(emptySave(), 'a', 3);
  s = recordClear(s, 'a', 5000).save;
  const r = recordClear(s, 'a', 6000);
  assert.equal(r.newBest, false);
  assert.equal(r.save.levels.a.bestMs, 5000);
  assert.equal(r.save.levels.a.clears, 2);
  assert.equal(r.save.totalDeaths, 3);
  assert.equal(formatTime(65432), '01:05.432');
});

test('swipes quantize to 8 directions', () => {
  assert.deepEqual(quantizeDir8(10, 0), { x: 1, y: 0 });
  assert.deepEqual(quantizeDir8(10, -9), { x: 1, y: -1 });
  assert.deepEqual(quantizeDir8(-1, -10), { x: 0, y: -1 });
  assert.deepEqual(quantizeDir8(-10, 8), { x: -1, y: 1 });
});

test('touch controller: move pads, tap jump, swipe dash', () => {
  const tc = new TouchController();
  tc.resize(800, 400);
  tc.down(1, 100, 380, 0);
  assert.equal(tc.input.moveX, -1);
  tc.move(1, 600, 380, 50);
  assert.equal(tc.input.moveX, 1);
  tc.down(2, 400, 100, 100);
  assert.equal(tc.input.jumpPresses, 1);
  assert.equal(tc.input.jumpHeld, true);
  tc.move(2, 440, 60, 150);
  assert.deepEqual(tc.input.dashQueue, { x: 1, y: -1 });
  assert.equal(tc.input.jumpHeld, false, 'swipe releases the jump hold');
  tc.up(2);
  tc.up(1);
  assert.equal(tc.input.moveX, 0);
});
