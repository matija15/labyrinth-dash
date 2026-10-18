import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { GameEvent } from '../types';
import { EVENT_SFX, MUSIC_VOLUME, SFX_NAMES, SFX_VOLUME, type Sfx } from './sounds';

const SOURCES: Record<Sfx, number> = {
  jump: require('../../assets/audio/jump.wav'),
  walljump: require('../../assets/audio/walljump.wav'),
  dash: require('../../assets/audio/dash.wav'),
  death: require('../../assets/audio/death.wav'),
  land: require('../../assets/audio/land.wav'),
  orb: require('../../assets/audio/orb.wav'),
  crystal: require('../../assets/audio/crystal.wav'),
  key: require('../../assets/audio/key.wav'),
  unlock: require('../../assets/audio/unlock.wav'),
  switch: require('../../assets/audio/switch.wav'),
  pad: require('../../assets/audio/pad.wav'),
  portal: require('../../assets/audio/portal.wav'),
  room: require('../../assets/audio/room.wav'),
  goal: require('../../assets/audio/goal.wav'),
};
const MUSIC = require('../../assets/audio/music.wav');

/** Two players per sound so quick repeats (jump, jump) overlap instead of cutting off. */
const POOL = 2;
const pools = new Map<Sfx, { players: AudioPlayer[]; next: number }>();
let music: AudioPlayer | null = null;
let sfxOn = true;
let musicOn = true;
let musicWanted = false;
let modeSet = false;

const ensureMode = () => {
  if (modeSet) return;
  modeSet = true;
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
};

const pool = (name: Sfx) => {
  let p = pools.get(name);
  if (!p) {
    p = { players: Array.from({ length: POOL }, () => createAudioPlayer(SOURCES[name])), next: 0 };
    pools.set(name, p);
  }
  return p;
};

/** Loads every sound up front so the first jump isn't late. */
export function warmUpAudio() {
  try {
    ensureMode();
    for (const n of SFX_NAMES) pool(n);
  } catch {
    // audio unavailable (e.g. web before a user gesture): stay silent
  }
}

export function playSfx(name: Sfx) {
  if (!sfxOn) return;
  try {
    ensureMode();
    const p = pool(name);
    const player = p.players[p.next];
    p.next = (p.next + 1) % p.players.length;
    player.volume = SFX_VOLUME[name] ?? 1;
    void player.seekTo(0);
    player.play();
  } catch {
    // ignore playback failures
  }
}

export const playEventSound = (e: GameEvent) => {
  const s = EVENT_SFX[e.type];
  if (s) playSfx(s);
};

function syncMusic() {
  try {
    if (musicWanted && musicOn) {
      ensureMode();
      if (!music) {
        music = createAudioPlayer(MUSIC);
        music.loop = true;
        music.volume = MUSIC_VOLUME;
      }
      music.play();
    } else music?.pause();
  } catch {
    // ignore playback failures
  }
}

/** Applies the saved sound / music switches (both default to on). */
export function setAudioPrefs(prefs: { sfx?: boolean; music?: boolean } | undefined) {
  sfxOn = prefs?.sfx ?? true;
  musicOn = prefs?.music ?? true;
  syncMusic();
}

/** Music plays while a level is open. */
export function setMusicPlaying(on: boolean) {
  musicWanted = on;
  syncMusic();
}
