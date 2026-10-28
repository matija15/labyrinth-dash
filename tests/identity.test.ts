import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blankLevel, levelToCode, parseLevelCode } from '../src/engine/editor';
import { emptySave, recordClear } from '../src/engine/save';
import { CHAPTER_THEME, DEFAULT_THEME, selectedLook, unlockStatus } from '../src/engine/skins';

test('chapter themes follow the level theme unless the player picked one', () => {
  const save = emptySave();
  assert.equal(selectedLook(save, { theme: 'thornwood' }).theme.id, 'thornwood');
  assert.equal(selectedLook(save, {}).theme.id, DEFAULT_THEME.id);
  assert.equal(selectedLook({ ...save, skins: { theme: 'crypt' } }, { theme: 'thornwood' }).theme.id, 'crypt');
  assert.equal(selectedLook({ ...save, skins: { theme: CHAPTER_THEME } }, { theme: 'wolfden' }).theme.id, 'wolfden');
  assert.ok(unlockStatus('theme', CHAPTER_THEME, save, []).unlocked);
});

test('deathless crown needs a zero-death unassisted clear and is kept afterwards', () => {
  let { save } = recordClear(emptySave(), 'a', 9000, false, 3);
  assert.ok(!save.levels.a.deathless);
  ({ save } = recordClear(save, 'a', 9000, true, 0));
  assert.ok(!save.levels.a.deathless, 'assisted clears earn no crown');
  ({ save } = recordClear(save, 'a', 9000, false, 0));
  assert.ok(save.levels.a.deathless);
  ({ save } = recordClear(save, 'a', 9000, false, 5));
  assert.ok(save.levels.a.deathless);
});

test('par time and theme survive export and import', () => {
  const level = { ...blankLevel(), par: 42.5, theme: 'clockwork' };
  const back = parseLevelCode(levelToCode(level));
  assert.equal(back.par, 42.5);
  assert.equal(back.theme, 'clockwork');
  const json = parseLevelCode(JSON.stringify(level));
  assert.equal(json.par, 42.5);
});
