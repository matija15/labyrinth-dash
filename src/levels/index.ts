import type { LevelDef } from '../types';
import { DEV_LEVELS } from './dev';
import { RELEASE_LEVELS } from './release';

export { DEV_LEVELS, RELEASE_LEVELS };

/**
 * Editor + demo levels. On in dev builds (Expo Go / `expo start`); off in release builds unless
 * EXPO_PUBLIC_DEV_TOOLS=1 is set at build time.
 */
export const DEV_TOOLS = (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_DEV_TOOLS === '1';

export type LevelPack = 'release' | 'dev';

/** Players only ever get the release pack; the demo pack is reachable in dev builds. */
export const packLevels = (pack: LevelPack): LevelDef[] => (pack === 'dev' && DEV_TOOLS ? DEV_LEVELS : RELEASE_LEVELS);
