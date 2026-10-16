import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Picture, useFont, type SkPicture } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Game } from '../engine/game';
import { TouchController } from '../engine/input';
import { GameLoop } from '../engine/loop';
import { recordClear, recordDeaths, formatTime } from '../engine/save';
import type { GameEvent, LevelDef, SaveData } from '../types';
import { buildStaticPicture, COLORS, renderFrame } from './renderer';
import { useKeyboardControls } from './useKeyboardControls';

interface Props {
  level: LevelDef;
  save: SaveData;
  hasNext: boolean;
  onSave: (save: SaveData) => void;
  onExit: () => void;
  onNext: () => void;
}

interface Result { ms: number; deaths: number; best: number; newBest: boolean }

const haptic = (e: GameEvent) => {
  if (Platform.OS === 'web') return;
  if (e.type === 'dash') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else if (e.type === 'death') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  else if (e.type === 'goal') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (e.type === 'pad' || e.type === 'unlock') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  else if (e.type === 'key' || e.type === 'orb' || e.type === 'walldrop') Haptics.selectionAsync();
};

export function GameScreen({ level, save, hasNext, onSave, onExit, onNext }: Props) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const font = useFont(require('../../assets/fonts/SpaceMono-Bold.ttf'), 20);
  const smallFont = useFont(require('../../assets/fonts/SpaceMono-Bold.ttf'), 12);
  const autoRun = (save.controls ?? 'auto') === 'auto';
  const game = useMemo(() => new Game(level, { autoRun }), [level, autoRun]);
  const staticPic = useMemo(() => buildStaticPicture(game), [game]);
  const touch = useMemo(() => {
    const t = new TouchController();
    t.autoRun = autoRun;
    return t;
  }, [autoRun]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const saveRef = useRef(save);
  const live = useRef({ size, font, smallFont, insets, onSave });
  const pausedRef = useRef(false);
  useLayoutEffect(() => {
    saveRef.current = save;
    live.current = { size, font, smallFont, insets, onSave };
  });

  const togglePause = useCallback(() => setPaused((p) => !p), []);
  useKeyboardControls(touch, togglePause);

  useEffect(() => {
    let scale = 1;
    let lastW = 0;
    let lastH = 0;
    const loop = new GameLoop(
      () => {
        if (pausedRef.current) return;
        game.step(touch.input);
        for (const e of game.drainEvents()) {
          haptic(e);
          if (e.type === 'death') {
            const next = recordDeaths(saveRef.current, level.id, 1);
            saveRef.current = next;
            live.current.onSave(next);
          } else if (e.type === 'goal') {
            const ms = Math.round(game.time * 1000);
            const { save: next, newBest } = recordClear(saveRef.current, level.id, ms);
            saveRef.current = next;
            live.current.onSave(next);
            pausedRef.current = true;
            setResult({ ms, deaths: game.deaths, best: next.levels[level.id].bestMs ?? ms, newBest });
          }
        }
      },
      () => {
        const { size: s, font: f, smallFont: sf, insets: ins } = live.current;
        if (!s.width) return;
        if (s.width !== lastW || s.height !== lastH) {
          scale = game.setViewport(s.width, s.height);
          touch.resize(s.width, s.height);
          lastW = s.width;
          lastH = s.height;
        }
        setPicture(
          renderFrame({
            game, staticPic, width: s.width, height: s.height, scale, font: f, smallFont: sf, touch,
            insets: { left: ins.left, right: ins.right, top: ins.top }, now: performance.now(),
          }),
        );
      },
    );
    loop.start();
    return () => loop.stop();
  }, [game, level.id, staticPic, touch]);

  useEffect(() => {
    pausedRef.current = paused || result !== null;
    if (paused) touch.clear();
  }, [paused, result, touch]);

  const gesture = useMemo(() => createTouchGesture(touch), [touch]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const restart = () => {
    game.restart();
    touch.clear();
    setResult(null);
    setPaused(false);
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Canvas style={StyleSheet.absoluteFill}>{picture && <Picture picture={picture} />}</Canvas>
        </View>
      </GestureDetector>

      <Pressable
        accessibilityLabel="Pause"
        onPress={() => setPaused(true)}
        style={[styles.pauseBtn, { top: insets.top + 10, right: insets.right + 14 }]}
        hitSlop={10}
      >
        <View style={styles.pauseBar} />
        <View style={styles.pauseBar} />
      </Pressable>

      {paused && !result && (
        <Overlay title="PAUSED">
          <Button label="Resume" onPress={() => setPaused(false)} primary />
          <Button label="Restart level" onPress={restart} />
          <Button label="Level select" onPress={onExit} />
        </Overlay>
      )}

      {result && (
        <Overlay title="CLEAR!">
          <Text style={styles.big}>{formatTime(result.ms)}</Text>
          <Text style={styles.sub}>
            {result.newBest ? 'NEW BEST!' : `Best ${formatTime(result.best)}`} · {result.deaths} deaths
          </Text>
          {hasNext && <Button label="Next level" onPress={onNext} primary />}
          <Button label="Retry" onPress={restart} primary={!hasNext} />
          <Button label="Level select" onPress={onExit} />
        </Overlay>
      )}
    </View>
  );
}

function Overlay({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, primary && styles.btnPrimary, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.btnText, primary && { color: COLORS.bg }]}>{label}</Text>
    </Pressable>
  );
}


function createTouchGesture(touch: TouchController) {
  return Gesture.Manual()
    .runOnJS(true)
    .onTouchesDown((e, manager) => {
      manager.activate();
      const now = performance.now();
      for (const t of e.changedTouches) touch.down(t.id, t.x, t.y, now);
    })
    .onTouchesMove((e) => {
      const now = performance.now();
      for (const t of e.changedTouches) touch.move(t.id, t.x, t.y, now);
    })
    .onTouchesUp((e) => {
      for (const t of e.changedTouches) touch.up(t.id);
    })
    .onTouchesCancelled((e) => {
      for (const t of e.changedTouches) touch.up(t.id);
    });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  pauseBtn: {
    position: 'absolute', width: 40, height: 40, borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.07)',
  },
  pauseBar: { width: 4, height: 15, borderRadius: 2, backgroundColor: COLORS.text },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,4,10,0.72)', alignItems: 'center', justifyContent: 'center' },
  card: {
    minWidth: 280, padding: 22, borderRadius: 18, backgroundColor: '#0e1326', borderWidth: 1,
    borderColor: '#24305a', alignItems: 'stretch', gap: 10,
  },
  title: { color: COLORS.player, fontSize: 26, fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: 4 },
  big: { color: COLORS.text, fontSize: 34, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  sub: { color: COLORS.dim, fontSize: 14, textAlign: 'center', marginBottom: 6 },
  btn: { paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#2f3d6e', alignItems: 'center' },
  btnPrimary: { backgroundColor: COLORS.player, borderColor: COLORS.player },
  btnText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
});
