import { Game } from '../src/engine/game';
import { createInput } from '../src/engine/input';
import type { InputState, LevelDef } from '../src/types';

export const room = (rows: string[], extra: Partial<LevelDef['rooms'][number]> = {}): LevelDef => ({
  id: 'test',
  name: 'Test',
  subtitle: '',
  rooms: [{ id: 'r', x: 0, y: 0, tiles: rows, ...extra }],
});

export const flat = (w = 40, h = 16, spawnX = 2) => {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    if (y === 0 || y >= h - 1) rows.push('#'.repeat(w));
    else rows.push('#' + '.'.repeat(w - 2) + '#');
  }
  rows[h - 1] = '#'.repeat(w);
  rows[h - 2] = '#' + '.'.repeat(spawnX - 1) + 'S' + '.'.repeat(w - spawnX - 3) + 'G'.replace('G', '.') + '#';
  // goal far up in the corner so it's never touched
  rows[1] = '#G' + '.'.repeat(w - 3) + '#';
  return rows;
};

export function sim(game: Game, frames: number, drive: (f: number, input: InputState) => void, input = createInput()) {
  for (let f = 0; f < frames; f++) {
    drive(f, input);
    game.step(input);
  }
  return input;
}
