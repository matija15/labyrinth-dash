import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SaveData } from '../types';
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

