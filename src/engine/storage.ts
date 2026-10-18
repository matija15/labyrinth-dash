import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LevelDef, SaveData } from '../types';
import type { Clip } from './editor';
import { emptySave } from './save';

const KEY = '@labyrinth-dash/save/v1';

export async function loadSave(): Promise<SaveData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptySave();
    const data = JSON.parse(raw) as Partial<SaveData>;
    return { ...emptySave(), ...data, levels: { ...(data.levels ?? {}) } };
  } catch {
    return emptySave();
  }
}

let pending: Promise<void> = Promise.resolve();

export function writeSave(data: SaveData) {
  const json = JSON.stringify(data);
  pending = pending.then(() => AsyncStorage.setItem(KEY, json)).catch(() => undefined);
  return pending;
}

export async function resetSave() {
  await AsyncStorage.removeItem(KEY);
}


const EDITOR_KEY = '@labyrinth-dash/editor/v1';

export interface EditorDraft {
  level: LevelDef;
  /** Id the level was opened from / saved to in the release pack (null for a new level). */
  sourceId: string | null;
}

export async function loadEditorDraft(): Promise<EditorDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(EDITOR_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.rooms ? { level: data as LevelDef, sourceId: null } : (data as EditorDraft);
  } catch {
    return null;
  }
}

export function writeEditorDraft(draft: EditorDraft) {
  return AsyncStorage.setItem(EDITOR_KEY, JSON.stringify(draft)).catch(() => undefined);
}

const STAMPS_KEY = '@labyrinth-dash/stamps/v1';

/** A saved block the editor can paste again (tiles + saws + platforms). */
export interface Stamp {
  name: string;
  clip: Clip;
}

export async function loadStamps(): Promise<Stamp[]> {
  try {
    const raw = await AsyncStorage.getItem(STAMPS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function writeStamps(stamps: Stamp[]) {
  return AsyncStorage.setItem(STAMPS_KEY, JSON.stringify(stamps)).catch(() => undefined);
}
