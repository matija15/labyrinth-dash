import type { LevelRecord, SaveData } from '../types';

export const emptySave = (): SaveData => ({ version: 1, totalDeaths: 0, levels: {} });

export const emptyRecord = (): LevelRecord => ({ bestMs: null, deaths: 0, completed: false, clears: 0 });

/** Pure reducers so the persistence rules are unit-testable. */
export function recordDeaths(save: SaveData, levelId: string, count: number): SaveData {
  const rec = save.levels[levelId] ?? emptyRecord();
  return {
    ...save,
    totalDeaths: save.totalDeaths + count,
    levels: { ...save.levels, [levelId]: { ...rec, deaths: rec.deaths + count } },
  };
}

export function recordClear(save: SaveData, levelId: string, ms: number): { save: SaveData; newBest: boolean } {
  const rec = save.levels[levelId] ?? emptyRecord();
  const newBest = rec.bestMs === null || ms < rec.bestMs;
  return {
    newBest,
    save: {
      ...save,
      levels: {
        ...save.levels,
        [levelId]: { ...rec, completed: true, clears: rec.clears + 1, bestMs: newBest ? ms : rec.bestMs },
      },
    },
  };
}

export const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const r = total % 1000;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
};
