import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { emptySave, recordClear, recordDeaths } from '../src/engine/save';
import {
  contrast, DEFAULT_PLAYER, DEFAULT_THEME, PLAYER_SKINS, readabilityIssues, selectedLook, selectSkin, THEMES,
  unlockSkin, unlockStatus,
} from '../src/engine/skins';

test('skin ids are unique and the defaults are free', () => {
  for (const list of [PLAYER_SKINS, THEMES]) {
    assert.equal(new Set(list.map((s) => s.id)).size, list.length);
    assert.equal(list[0].unlock.type, 'free');
  }
});

test('every theme keeps hazards and every player skin readable', () => {
  assert.deepEqual(THEMES.flatMap((t) => readabilityIssues(t)), []);
  assert.ok(contrast('#ffffff', '#000000') > 20);
  assert.ok(readabilityIssues({ ...DEFAULT_THEME, spike: '#0a0b10' }).length > 0);
});

test('art folders exist for every skin that uses art', () => {
  for (const s of [...PLAYER_SKINS, ...THEMES]) if (s.art) assert.ok(existsSync(`assets/skins/${s.art}`), s.id);
});

test('unlock rules: free, clears (release levels only), deaths, ad', () => {
  let save = emptySave();
  const ids = ['a', 'b', 'c', 'd', 'e'];
  assert.equal(unlockStatus('player', 'lime', save, ids).unlocked, true);
  assert.deepEqual(unlockStatus('player', 'gold', save, ids), { unlocked: false, label: 'Clear 5 levels · 0/5' });
  save = recordClear(save, 'demo', 1000).save;
  for (const id of ids.slice(0, 4)) save = recordClear(save, id, 1000).save;
  assert.equal(unlockStatus('player', 'gold', save, ids).label, 'Clear 5 levels · 4/5');
  save = recordClear(save, 'e', 1000).save;
  assert.equal(unlockStatus('player', 'gold', save, ids).unlocked, true);

  assert.equal(unlockStatus('player', 'ghost', save, ids).unlocked, false);
  save = recordDeaths(save, 'a', 250);
  assert.equal(unlockStatus('player', 'ghost', save, ids).unlocked, true);

  assert.equal(unlockStatus('theme', 'toxic', save, ids).unlocked, false);
  save = unlockSkin(save, 'theme', 'toxic');
  assert.equal(unlockStatus('theme', 'toxic', save, ids).unlocked, true);
  assert.equal(unlockStatus('player', 'toxic', save, ids).unlocked, false, 'ad unlocks are per kind');
  assert.equal(unlockSkin(save, 'theme', 'toxic'), save, 'unlocking twice is a no-op');
});

test('selection is stored per kind and falls back to the defaults', () => {
  assert.deepEqual(selectedLook(emptySave()), { player: DEFAULT_PLAYER, theme: DEFAULT_THEME });
  let save = selectSkin(emptySave(), 'player', 'prism');
  save = selectSkin(save, 'theme', 'crypt');
  const look = selectedLook(save);
  assert.equal(look.player.id, 'prism');
  assert.equal(look.theme.id, 'crypt');
  assert.equal(selectedLook(selectSkin(save, 'theme', 'removed-theme')).theme, DEFAULT_THEME);
});

test('the skin preview room is a valid level', async () => {
  const { validateLevel } = await import('../src/engine/world');
  const { PREVIEW_LEVEL } = await import('../src/skins/preview');
  assert.deepEqual(validateLevel(PREVIEW_LEVEL), []);
});
