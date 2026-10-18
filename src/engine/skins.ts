import type { SaveData } from '../types';

/**
 * Cosmetic skins. They only change how things are drawn: hitboxes and physics never depend on them.
 * Player skins recolor / reshape (or replace with art) the avatar; world themes restyle blocks,
 * spikes, saws and pickups. Add one by appending to PLAYER_SKINS / THEMES (ids must stay stable,
 * they are stored in saves).
 */
export type Unlock =
  | { type: 'free' }
  /** Clear this many release levels. */
  | { type: 'clears'; count: number }
  /** Reach this many total deaths. */
  | { type: 'deaths'; count: number }
  /** Watch a rewarded ad (stubbed until ads are added in a dev build). */
  | { type: 'ad' };

/** Folder under `assets/skins/` holding PNG art, registered in `src/skins/art.ts`. */
export type ArtKey = 'pixel' | 'hood';

export type ArtSlot = 'player' | 'solid' | 'spike' | 'saw' | 'crumble' | 'door' | 'pad' | 'key' | 'orb' | 'goal';

export interface PlayerSkin {
  id: string;
  name: string;
  color: string;
  /** Color while the dash is used up. */
  spentColor: string;
  /** Dash trail; defaults to `color`. */
  trail?: string;
  shape: 'block' | 'round' | 'hollow';
  art?: ArtKey;
  unlock: Unlock;
}

export interface WorldTheme {
  id: string;
  name: string;
  bg: string;
  grid: string;
  solid: string;
  solidEdge: string;
  spike: string;
  crumble: string;
  door: string;
  key: string;
  orb: string;
  pad: string;
  saw: string;
  goal: string;
  blocks: 'neon' | 'brick' | 'flat';
  spikes: 'sharp' | 'chunky' | 'needle';
  art?: ArtKey;
  unlock: Unlock;
}

export type SkinKind = 'player' | 'theme';

const SPENT = '#56608a';

export const PLAYER_SKINS: PlayerSkin[] = [
  { id: 'neon', name: 'Neon', color: '#4de8ff', spentColor: SPENT, shape: 'block', unlock: { type: 'free' } },
  { id: 'lime', name: 'Lime', color: '#a6ff4d', spentColor: SPENT, shape: 'round', unlock: { type: 'free' } },
  { id: 'hood', name: 'Red Hood', color: '#e4573f', spentColor: '#8a5a52', trail: '#ff7a5c', shape: 'block', art: 'hood', unlock: { type: 'free' } },
  { id: 'gold', name: 'Gold', color: '#ffd23f', spentColor: '#7a6a3a', trail: '#ffe58a', shape: 'round', unlock: { type: 'clears', count: 5 } },
  { id: 'ghost', name: 'Ghost', color: '#e8ecff', spentColor: SPENT, shape: 'hollow', unlock: { type: 'deaths', count: 250 } },
  { id: 'prism', name: 'Prism', color: '#ff7ad9', spentColor: '#6a4a7a', trail: '#8ab4ff', shape: 'block', unlock: { type: 'ad' } },
  { id: 'knight', name: 'Pixel Knight', color: '#4d9dff', spentColor: SPENT, shape: 'block', art: 'pixel', unlock: { type: 'ad' } },
];

export const THEMES: WorldTheme[] = [
  {
    id: 'neon', name: 'Neon Night', bg: '#06070d', grid: '#1a2140', solid: '#131a2e', solidEdge: '#2f3d6e',
    spike: '#ff3b6b', crumble: '#a07a45', door: '#ffd23f', key: '#ffd23f', orb: '#3dff9a', pad: '#ff9f1c',
    saw: '#ff6b35', goal: '#b388ff', blocks: 'neon', spikes: 'sharp', unlock: { type: 'free' },
  },
  {
    id: 'crypt', name: 'Stone Crypt', bg: '#0b0907', grid: '#2a2219', solid: '#3a3229', solidEdge: '#6b5d4a',
    spike: '#ff4d4d', crumble: '#8a6a3a', door: '#e8c35a', key: '#e8c35a', orb: '#7dffb0', pad: '#ff9f1c',
    saw: '#ff7a2e', goal: '#c9a2ff', blocks: 'brick', spikes: 'chunky', unlock: { type: 'free' },
  },
  {
    id: 'ice', name: 'Ice Cavern', bg: '#050b12', grid: '#16304a', solid: '#1d3b57', solidEdge: '#8fd3ff',
    spike: '#ff3355', crumble: '#9ab8d0', door: '#ffd23f', key: '#ffd23f', orb: '#3dff9a', pad: '#ff9f1c',
    saw: '#ff6b35', goal: '#e0b3ff', blocks: 'flat', spikes: 'needle', unlock: { type: 'clears', count: 10 },
  },
  {
    id: 'toxic', name: 'Toxic', bg: '#060a05', grid: '#1a2e12', solid: '#1a2a12', solidEdge: '#7dff4d',
    spike: '#ff4df0', crumble: '#8a7a3a', door: '#ffd23f', key: '#ffd23f', orb: '#4dd2ff', pad: '#ff9f1c',
    saw: '#ffd23f', goal: '#b388ff', blocks: 'neon', spikes: 'sharp', unlock: { type: 'ad' },
  },
  {
    id: 'pixel', name: 'Pixel Forge', bg: '#0a0608', grid: '#24161a', solid: '#3a2018', solidEdge: '#8c4830',
    spike: '#ff466e', crumble: '#a07a45', door: '#ffd23f', key: '#ffd23f', orb: '#3dff9a', pad: '#ff9f1c',
    saw: '#ff8c28', goal: '#b388ff', blocks: 'flat', spikes: 'chunky', art: 'pixel', unlock: { type: 'ad' },
  },
];

export const DEFAULT_PLAYER = PLAYER_SKINS[0];
export const DEFAULT_THEME = THEMES[0];

export interface Look {
  player: PlayerSkin;
  theme: WorldTheme;
}

const list = (kind: SkinKind): (PlayerSkin | WorldTheme)[] => (kind === 'player' ? PLAYER_SKINS : THEMES);
export const skinKey = (kind: SkinKind, id: string) => `${kind}:${id}`;

/** The equipped look. Selection only ever stores unlocked skins, so no unlock check is needed here. */
export function selectedLook(save: SaveData): Look {
  return {
    player: PLAYER_SKINS.find((s) => s.id === save.skins?.player) ?? DEFAULT_PLAYER,
    theme: THEMES.find((s) => s.id === save.skins?.theme) ?? DEFAULT_THEME,
  };
}

export interface UnlockStatus {
  unlocked: boolean;
  /** Short requirement / progress text for locked skins, e.g. "Clear 5 levels · 2/5". */
  label: string;
}

/** `releaseIds`: the levels that count towards "clears" (players only ever have the release pack). */
export function unlockStatus(kind: SkinKind, id: string, save: SaveData, releaseIds: string[]): UnlockStatus {
  const skin = list(kind).find((s) => s.id === id);
  if (!skin) return { unlocked: false, label: 'Unknown' };
  const u = skin.unlock;
  switch (u.type) {
    case 'free':
      return { unlocked: true, label: 'Free' };
    case 'clears': {
      const n = releaseIds.filter((l) => save.levels[l]?.completed).length;
      return { unlocked: n >= u.count, label: `Clear ${u.count} levels · ${Math.min(n, u.count)}/${u.count}` };
    }
    case 'deaths':
      return {
        unlocked: save.totalDeaths >= u.count,
        label: `Die ${u.count} times · ${Math.min(save.totalDeaths, u.count)}/${u.count}`,
      };
    case 'ad':
      return { unlocked: !!save.skins?.unlocked?.includes(skinKey(kind, id)), label: 'Watch an ad' };
  }
}

export function unlockSkin(save: SaveData, kind: SkinKind, id: string): SaveData {
  const key = skinKey(kind, id);
  const unlocked = save.skins?.unlocked ?? [];
  if (unlocked.includes(key)) return save;
  return { ...save, skins: { ...save.skins, unlocked: [...unlocked, key] } };
}

export function selectSkin(save: SaveData, kind: SkinKind, id: string): SaveData {
  return { ...save, skins: { ...save.skins, [kind]: id } };
}

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

/** WCAG contrast ratio (1–21). */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Hazards must stay readable in every theme: a skin may never make a level harder to read. */
export const MIN_HAZARD_CONTRAST = 3;
export const MIN_PLAYER_CONTRAST = 3;

export function readabilityIssues(theme: WorldTheme, players: PlayerSkin[] = PLAYER_SKINS): string[] {
  const issues: string[] = [];
  const need = (what: string, a: string, b: string, min: number) => {
    const r = contrast(a, b);
    if (r < min) issues.push(`${theme.id}: ${what} contrast ${r.toFixed(2)} < ${min}`);
  };
  need('spike/bg', theme.spike, theme.bg, MIN_HAZARD_CONTRAST);
  need('spike/block', theme.spike, theme.solid, MIN_HAZARD_CONTRAST - 0.5);
  need('saw/bg', theme.saw, theme.bg, MIN_HAZARD_CONTRAST);
  for (const p of players) need(`player ${p.id}/bg`, p.color, theme.bg, MIN_PLAYER_CONTRAST);
  return issues;
}
