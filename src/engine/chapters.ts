import type { LevelDef } from '../types';

/** Levels without a `chapter` name are grouped in blocks of this many. */
export const CHAPTER_SIZE = 15;

export interface Chapter {
  name: string;
  /** Index range [start, end) into the level list. */
  start: number;
  end: number;
  named: boolean;
}

/** Consecutive levels with the same `chapter` form one chapter; unnamed levels fill "Chapter N" blocks. */
export function chapters(levels: LevelDef[]): Chapter[] {
  const out: Chapter[] = [];
  levels.forEach((l, i) => {
    const name = l.chapter?.trim() || null;
    const last = out[out.length - 1];
    if (last && (name ? last.named && last.name === name : !last.named && i - last.start < CHAPTER_SIZE)) {
      last.end = i + 1;
      return;
    }
    out.push({ name: name ?? `Chapter ${out.length + 1}`, named: !!name, start: i, end: i + 1 });
  });
  return out;
}
