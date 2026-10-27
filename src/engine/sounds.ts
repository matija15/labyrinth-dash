import type { GameEvent } from '../types';

/** Sound effect names; each one is `assets/audio/<name>.wav` (swap the file to change the sound). */
export const SFX_NAMES = [
  'jump', 'walljump', 'dash', 'death', 'land', 'orb', 'crystal', 'key', 'unlock', 'switch', 'pad', 'portal', 'room', 'goal',
] as const;
export type Sfx = (typeof SFX_NAMES)[number];

/** Which sound each game event plays. */
export const EVENT_SFX: Partial<Record<GameEvent['type'], Sfx>> = {
  jump: 'jump', walljump: 'walljump', walldrop: 'land', dash: 'dash', land: 'land', death: 'death', key: 'key',
  unlock: 'unlock', orb: 'orb', crystal: 'crystal', switch: 'switch', pad: 'pad', portal: 'portal', room: 'room', goal: 'goal',
  page: 'key', gravity: 'portal', reverse: 'portal', reveal: 'unlock', plate: 'unlock',
};

export const SFX_VOLUME: Partial<Record<Sfx, number>> = { land: 0.5, room: 0.6, switch: 0.7 };
export const MUSIC_VOLUME = 0.45;
