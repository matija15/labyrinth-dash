import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorController } from '../src/components/editorController';

test('editor redo replays undone edits and a new edit clears it', () => {
  const ctl = new EditorController();
  ctl.configure('#', 800, 400, 1);
  const before = JSON.stringify(ctl.level);
  ctl.down(1, 8 * 5 + 1, 8 * 5 + 1);
  ctl.up(1);
  const after = JSON.stringify(ctl.level);
  assert.notEqual(after, before);
  ctl.undo();
  assert.equal(JSON.stringify(ctl.level), before);
  assert.equal(ctl.snapshot().redoCount, 1);
  ctl.redo();
  assert.equal(JSON.stringify(ctl.level), after);
  assert.equal(ctl.snapshot().redoCount, 0);
  ctl.undo();
  ctl.down(1, 8 * 7 + 1, 8 * 5 + 1);
  ctl.up(1);
  assert.equal(ctl.snapshot().redoCount, 0, 'a new edit drops the redo history');
});

test('a stamp clip loaded into the controller is what Paste places', () => {
  const ctl = new EditorController();
  const clip = { w: 2, h: 1, rows: ['##'], saws: [] };
  ctl.setClip(clip);
  assert.equal(ctl.getClip(), clip);
  assert.ok(ctl.snapshot().hasClip);
});
