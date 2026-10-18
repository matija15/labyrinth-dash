import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EVENT_SFX, SFX_NAMES } from '../src/engine/sounds';

test('every sound effect and the music loop has a file and is loaded by the audio module', () => {
  const src = readFileSync('src/engine/audio.ts', 'utf8');
  for (const n of [...SFX_NAMES, 'music']) {
    assert.ok(existsSync(`assets/audio/${n}.wav`), `${n}.wav exists`);
    assert.ok(src.includes(`assets/audio/${n}.wav`), `${n}.wav is required`);
  }
  for (const s of Object.values(EVENT_SFX)) assert.ok(SFX_NAMES.includes(s!));
  for (const e of ['jump', 'dash', 'death', 'goal', 'room'] as const) assert.ok(EVENT_SFX[e], e);
});
