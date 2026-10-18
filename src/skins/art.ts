import { useMemo } from 'react';
import { useImage, type SkImage } from '@shopify/react-native-skia';
import type { ArtKey, ArtSlot, Look } from '../engine/skins';

/**
 * PNG skin art. Each folder in `assets/skins/` is one art set; every slot is optional and falls
 * back to the vector drawing. Draw tiles at 16×16 (the game tile is 8 world px, so 2× density):
 * `spike` points up (it is rotated for the other directions), `player` faces right (it is mirrored).
 */
export const ART: Record<ArtKey, Partial<Record<ArtSlot, number>>> = {
  pixel: {
    player: require('../../assets/skins/pixel/player.png'),
    solid: require('../../assets/skins/pixel/solid.png'),
    spike: require('../../assets/skins/pixel/spike.png'),
    saw: require('../../assets/skins/pixel/saw.png'),
  },
  // Animated: the player slot is a sprite sheet described in SHEETS (src/skins/sheets.ts).
  hood: {
    player: require('../../assets/skins/hood/sheet.png'),
  },
};

export type ArtImages = Partial<Record<ArtSlot, SkImage>>;

const src = (key: ArtKey | undefined, slot: ArtSlot) => (key ? (ART[key][slot] ?? null) : null);

/** Loads the art for a look. A fixed list of hooks (one per slot) keeps hook order stable. */
export function useLookImages(look: Look): ArtImages {
  const t = look.theme.art;
  const player = useImage(src(look.player.art, 'player'));
  const solid = useImage(src(t, 'solid'));
  const spike = useImage(src(t, 'spike'));
  const saw = useImage(src(t, 'saw'));
  const crumble = useImage(src(t, 'crumble'));
  const door = useImage(src(t, 'door'));
  const pad = useImage(src(t, 'pad'));
  const key = useImage(src(t, 'key'));
  const orb = useImage(src(t, 'orb'));
  const goal = useImage(src(t, 'goal'));
  return useMemo(() => {
    const all = { player, solid, spike, saw, crumble, door, pad, key, orb, goal };
    const out: ArtImages = {};
    for (const k of Object.keys(all) as ArtSlot[]) if (all[k] && src(k === 'player' ? look.player.art : t, k)) out[k] = all[k];
    return out;
  }, [player, solid, spike, saw, crumble, door, pad, key, orb, goal, look.player.art, t]);
}

/** True once every art slot the look asks for has loaded (so the static picture isn't built twice). */
export function artReady(look: Look, images: ArtImages) {
  const want = [
    ...(look.player.art ? Object.keys(ART[look.player.art]).filter((s) => s === 'player') : []),
    ...(look.theme.art ? Object.keys(ART[look.theme.art]).filter((s) => s !== 'player') : []),
  ] as ArtSlot[];
  return want.every((s) => images[s]);
}
