import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Picture, type SkPicture } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showRewardedAd } from '../engine/ads';
import { Game } from '../engine/game';
import { TouchController } from '../engine/input';
import { GameLoop } from '../engine/loop';
import {
  PLAYER_SKINS, selectedLook, selectSkin, THEMES, unlockSkin, unlockStatus, type Look, type SkinKind,
} from '../engine/skins';
import { artReady, useLookImages } from '../skins/art';
import { PREVIEW_LEVEL } from '../skins/preview';
import type { SaveData } from '../types';
import { buildStaticPicture, COLORS, renderFrame } from './renderer';

interface Props {
  save: SaveData;
  /** Levels that count towards "clear N levels" unlocks. */
  releaseIds: string[];
  onSave: (save: SaveData) => void;
  onBack: () => void;
}

export function SkinPicker({ save, releaseIds, onSave, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const equipped = selectedLook(save);
  const [preview, setPreview] = useState({ player: equipped.player.id, theme: equipped.theme.id });
  const [busy, setBusy] = useState(false);
  const player = PLAYER_SKINS.find((s) => s.id === preview.player) ?? equipped.player;
  const theme = THEMES.find((s) => s.id === preview.theme) ?? equipped.theme;
  const look = useMemo(() => ({ player, theme }), [player, theme]);

  const pick = (kind: SkinKind, id: string) => {
    setPreview((p) => ({ ...p, [kind]: id }));
    if (unlockStatus(kind, id, save, releaseIds).unlocked) onSave(selectSkin(save, kind, id));
  };

  const locked = (['player', 'theme'] as SkinKind[])
    .map((kind) => ({ kind, id: preview[kind], status: unlockStatus(kind, preview[kind], save, releaseIds) }))
    .filter((x) => !x.status.unlocked);

  const watchAd = async (kind: SkinKind, id: string) => {
    setBusy(true);
    try {
      if (await showRewardedAd()) onSave(selectSkin(unlockSkin(save, kind, id), kind, id));
    } finally {
      setBusy(false);
    }
  };

  const section = (kind: SkinKind, title: string) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.row}>
        {(kind === 'player' ? PLAYER_SKINS : THEMES).map((s) => {
          const st = unlockStatus(kind, s.id, save, releaseIds);
          const on = equipped[kind].id === s.id;
          const viewing = preview[kind] === s.id;
          const swatch = 'color' in s ? s.color : s.solidEdge;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${kind === 'player' ? 'Player' : 'Theme'} ${s.name}`}
              onPress={() => pick(kind, s.id)}
              style={({ pressed }) => [
                styles.card, viewing && styles.viewing, on && styles.equipped, pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: swatch }]} />
              <Text style={styles.name}>{s.name}</Text>
              <Text style={[styles.status, st.unlocked && { color: COLORS.orb }]}>
                {on ? 'EQUIPPED' : st.unlocked ? 'Tap to equip' : `LOCKED · ${st.label}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.btn}>
          <Text style={styles.btnText}>‹ BACK</Text>
        </Pressable>
        <Text style={styles.title}>SKINS</Text>
      </View>
      <View style={styles.top}>
        <SkinPreview look={look} />
        <View style={styles.side}>
          <Text style={styles.help}>Skins only change how things look. Hitboxes and physics are identical in every skin.</Text>
          {locked.map(({ kind, id, status }) =>
            (kind === 'player' ? PLAYER_SKINS : THEMES).find((s) => s.id === id)?.unlock.type === 'ad' ? (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={`Watch ad to unlock ${id}`}
                disabled={busy}
                onPress={() => watchAd(kind, id)}
                style={({ pressed }) => [styles.btn, styles.adBtn, (pressed || busy) && { opacity: 0.7 }]}
              >
                <Text style={[styles.btnText, { color: COLORS.bg }]}>▶ Watch ad to unlock</Text>
              </Pressable>
            ) : (
              <Text key={kind} style={styles.status}>LOCKED · {status.label}</Text>
            ),
          )}
        </View>
      </View>
      {section('player', 'PLAYER')}
      {section('theme', 'BLOCKS & SPIKES')}
    </ScrollView>
  );
}

const PREVIEW_W = 320;
const PREVIEW_H = 160;

/** Renders the preview room with the real game renderer, so it looks exactly like gameplay. */
function SkinPreview({ look }: { look: Look }) {
  const game = useMemo(() => new Game(PREVIEW_LEVEL), []);
  const touch = useMemo(() => new TouchController(), []);
  const art = useLookImages(look);
  const ready = artReady(look, art);
  const staticPic = useMemo(() => buildStaticPicture(game, look, ready ? art : {}), [game, look, ready, art]);
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const [size, setSize] = useState({ width: PREVIEW_W, height: PREVIEW_H });
  const live = useRef({ look, art, staticPic, size });
  useLayoutEffect(() => {
    live.current = { look, art, staticPic, size };
  });

  useEffect(() => {
    let lastW = 0;
    let scale = 1;
    const loop = new GameLoop(
      (dt) => {
        game.worldTime += dt;
      },
      () => {
        const { look: lk, art: images, staticPic: pic, size: s } = live.current;
        if (s.width !== lastW) {
          scale = game.setViewport(s.width, s.height);
          lastW = s.width;
        }
        setPicture(
          renderFrame({
            game, staticPic: pic, width: s.width, height: s.height, scale, font: null, smallFont: null, touch,
            insets: { left: 0, right: 0, top: 0 }, now: performance.now(), look: lk, art: images,
          }),
        );
      },
    );
    loop.start();
    return () => loop.stop();
  }, [game, touch]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height) setSize({ width, height });
  };

  return (
    <View style={styles.preview} onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>{picture && <Picture picture={picture} />}</Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingVertical: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { color: COLORS.player, fontSize: 26, fontWeight: '900', letterSpacing: 6 },
  top: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' },
  side: { flex: 1, minWidth: 200, gap: 10 },
  preview: {
    width: PREVIEW_W, height: PREVIEW_H, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#24305a',
  },
  section: { gap: 8 },
  sectionTitle: { color: COLORS.goal, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: 150, padding: 10, borderRadius: 12, backgroundColor: '#0d1224', borderWidth: 1, borderColor: '#24305a', gap: 4,
  },
  viewing: { borderColor: COLORS.dim },
  equipped: { borderColor: COLORS.player, borderWidth: 2 },
  swatch: { width: 22, height: 22, borderRadius: 5 },
  name: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  status: { color: '#aab3d8', fontSize: 11, fontWeight: '600' },
  help: { color: COLORS.dim, fontSize: 12, lineHeight: 17 },
  btn: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
    borderColor: '#2f3d6e', backgroundColor: '#0d1224',
  },
  adBtn: { backgroundColor: COLORS.orb, borderColor: COLORS.orb },
  btnText: { color: COLORS.player, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
