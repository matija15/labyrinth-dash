import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { LevelDef } from '../types';

/** Client for scripts/level-server.ts (`npm run levels`), which runs on the same computer as Metro. */
export const LEVEL_SERVER_PORT = 8790;
export const OFFLINE = 'Level server isn’t running. Start it on your computer with: npm run levels';

export function levelServerUrl(): string | null {
  const host =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.hostname
      : Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:${LEVEL_SERVER_PORT}` : null;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = levelServerUrl();
  if (!base) throw new Error(OFFLINE);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 3000);
  let res: Response;
  try {
    res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: abort.signal,
    });
  } catch {
    throw new Error(OFFLINE);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Level server error ${res.status}`);
  return data as T;
}

export const fetchPack = () => call<{ levels: LevelDef[] }>('GET', '/levels').then((d) => d.levels);

export const savePackLevel = (level: LevelDef, previousId: string | null) =>
  call<{ position: number; created: boolean; issues: string[] }>('PUT', `/levels/${encodeURIComponent(level.id)}`, {
    level, previousId,
  });

export const deletePackLevel = (id: string) => call('DELETE', `/levels/${encodeURIComponent(id)}`);

export const reorderPack = (ids: string[]) => call('PUT', '/order', { ids });
