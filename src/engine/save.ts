import type { AssistSettings, LevelRecord, SaveData } from '../types';

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

export const ASSIST_OFF: AssistSettings = { speed: 1, infiniteDash: false, invincible: false };
export const ASSIST_SPEEDS = [1, 0.8, 0.6];

export const isAssisted = (a: AssistSettings | null | undefined): a is AssistSettings =>
  !!a && (a.speed < 1 || a.infiniteDash || a.invincible);

/** An assisted clear unlocks the next level but sets no best time and keeps the level marked as assisted. */
export function recordClear(
  save: SaveData, levelId: string, ms: number, assisted = false, deaths?: number, pages: number[] = [],
): { save: SaveData; newBest: boolean } {
  const prev = save.levels[levelId] ?? emptyRecord();
  const found = [...new Set([...(prev.pages ?? []), ...pages])].sort((a, b) => a - b);
  const rec = found.length ? { ...prev, pages: found } : prev;
  if (assisted) {
    const level = { ...rec, completed: true, clears: rec.clears + 1, assisted: rec.completed ? !!rec.assisted : true };
    return { newBest: false, save: { ...save, levels: { ...save.levels, [levelId]: level } } };
  }
  const newBest = rec.bestMs === null || ms < rec.bestMs;
  return {
    newBest,
    save: {
      ...save,
      levels: {
        ...save.levels,
        [levelId]: { ...rec, completed: true, clears: rec.clears + 1, bestMs: newBest ? ms : rec.bestMs, assisted: false,
          ...(deaths !== undefined ? { fewestDeaths: Math.min(deaths, rec.fewestDeaths ?? Infinity) } : {}),
          ...(deaths === 0 || rec.deathless ? { deathless: true } : {}),
        },
      },
    },
  };
}

/** Storybook pages found across `levelIds` (players only count the release pack). */
export const pagesFound = (save: SaveData, levelIds: string[]) =>
  levelIds.reduce((n, id) => n + (save.levels[id]?.pages?.length ?? 0), 0);

/** Pages placed in a level (`@` tiles). */
export const pageCount = (level: { rooms: { tiles: string[] }[] }) =>
  level.rooms.reduce((n, r) => n + r.tiles.reduce((m, row) => m + row.split('@').length - 1, 0), 0);

export const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const r = total % 1000;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
};
