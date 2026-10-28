import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemo, useState } from 'react';
import { chapters } from '../engine/chapters';
import { ASSIST_OFF, ASSIST_SPEEDS, formatTime } from '../engine/save';
import { validateLevel } from '../engine/world';
import type { LevelPack } from '../levels';
import type { AssistSettings, ControlScheme, LevelDef, SaveData } from '../types';
import { COLORS } from './renderer';

interface Props {
  levels: LevelDef[];
  save: SaveData;
  onPlay: (id: string) => void;
  onReset: () => void;
  onControls: (controls: ControlScheme) => void;
  onAudio: (audio: { sfx: boolean; music: boolean }) => void;
  onAssist: (assist: AssistSettings) => void;
  onGhost: (ghost: boolean) => void;
  onEditor: () => void;
  onSkins: () => void;
  /** Dev builds only: editor button, demo-pack toggle, every level unlocked. */
  devTools: boolean;
  pack: LevelPack;
  onPack: (pack: LevelPack) => void;
}

export function LevelSelect({ levels, save, onPlay, onReset, onControls, onAudio, onAssist, onGhost, onEditor, onSkins, devTools, pack, onPack }: Props) {
  const insets = useSafeAreaInsets();
  const controls = save.controls ?? 'auto';
  const sfx = save.audio?.sfx ?? true;
  const music = save.audio?.music ?? true;
  const assist = save.assist ?? ASSIST_OFF;
  const ghostOn = save.ghost ?? true;
  const chs = useMemo(() => chapters(levels), [levels]);
  const [chapterIdx, setChapterIdx] = useState(0);
  const ch = chs[Math.min(chapterIdx, chs.length - 1)];
  const nextSpeed = ASSIST_SPEEDS[(ASSIST_SPEEDS.indexOf(assist.speed) + 1) % ASSIST_SPEEDS.length];
  const problems = useMemo(() => levels.map((l) => validateLevel(l)[0] ?? null), [levels]);
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>LABYRINTH DASH</Text>
          <Text style={styles.tag}>a cursed fairy-tale labyrinth · {save.totalDeaths} total deaths</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skins"
            onPress={onSkins}
            style={({ pressed }) => [styles.controls, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.controlsText}>SKINS</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle control scheme"
            onPress={() => onControls(controls === 'auto' ? 'manual' : 'auto')}
            style={({ pressed }) => [styles.controls, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.controlsText}>CONTROLS · {controls === 'auto' ? 'AUTO-RUN' : 'RUN PADS'}</Text>
          </Pressable>
          <View style={styles.devRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle sound effects"
              onPress={() => onAudio({ sfx: !sfx, music })}
              style={({ pressed }) => [styles.controls, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.controlsText}>SOUND · {sfx ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle music"
              onPress={() => onAudio({ sfx, music: !music })}
              style={({ pressed }) => [styles.controls, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.controlsText}>MUSIC · {music ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle best-run ghost"
              onPress={() => onGhost(!ghostOn)}
              style={({ pressed }) => [styles.controls, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.controlsText}>GHOST · {ghostOn ? 'ON' : 'OFF'}</Text>
            </Pressable>
          </View>
          <View style={styles.devRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wayfinder game speed"
              onPress={() => onAssist({ ...assist, speed: nextSpeed })}
              style={({ pressed }) => [styles.controls, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.controlsText}>WAYFINDER SPEED · {Math.round(assist.speed * 100)}%</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wayfinder infinite dash"
              onPress={() => onAssist({ ...assist, infiniteDash: !assist.infiniteDash })}
              style={({ pressed }) => [styles.controls, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.controlsText}>∞ DASH · {assist.infiniteDash ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wayfinder invincibility"
              onPress={() => onAssist({ ...assist, invincible: !assist.invincible })}
              style={({ pressed }) => [styles.controls, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.controlsText}>INVINCIBLE · {assist.invincible ? 'ON' : 'OFF'}</Text>
            </Pressable>
          </View>
          {devTools && (
            <View style={styles.devRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle level pack"
                onPress={() => onPack(pack === 'release' ? 'dev' : 'release')}
                style={({ pressed }) => [styles.controls, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.controlsText}>PACK · {pack === 'release' ? 'RELEASE' : 'DEMO'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Level editor"
                onPress={onEditor}
                style={({ pressed }) => [styles.controls, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.controlsText}>LEVEL EDITOR</Text>
              </Pressable>
            </View>
          )}
          <Pressable onLongPress={onReset} delayLongPress={1200}>
            <Text style={styles.reset}>hold to reset save</Text>
          </Pressable>
        </View>
      </View>
      {devTools && (
        <Text style={styles.devNote}>
          DEV BUILD · all levels unlocked ·{' '}
          {pack === 'release' ? 'players only ever see this release pack' : 'demo levels are never shipped'}
        </Text>
      )}
      {chs.length > 1 && (
        <View style={styles.row}>
          {chs.map((c, k) => {
            const cleared = levels.slice(c.start, c.end).filter((l) => save.levels[l.id]?.completed).length;
            const open = devTools || c.start === 0 || !!save.levels[levels[c.start - 1].id]?.completed;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`Chapter ${c.name}`}
                disabled={!open}
                onPress={() => setChapterIdx(k)}
                style={({ pressed }) => [
                  styles.controls,
                  c === ch && { borderColor: COLORS.player },
                  !open && { opacity: 0.4 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.controlsText}>
                  {open ? '' : '🔒 '}{c.name.toUpperCase()} · {cleared}/{c.end - c.start}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={styles.row}>
        {levels.length === 0 && (
          <Text style={styles.help}>
            {devTools
              ? 'No release levels yet. Open the LEVEL EDITOR, build one and press Save (with npm run levels running).'
              : 'New levels are coming soon.'}
          </Text>
        )}
        {levels.map((level, i) => {
          if (ch && (i < ch.start || i >= ch.end)) return null;
          const rec = save.levels[level.id];
          const problem = problems[i];
          const unlocked = !problem && (devTools || i === 0 || !!save.levels[levels[i - 1].id]?.completed);
          return (
            <Pressable
              key={level.id}
              accessibilityRole="button"
              accessibilityLabel={`Level ${i + 1} ${level.name}`}
              disabled={!unlocked}
              onPress={() => onPlay(level.id)}
              style={({ pressed }) => [styles.card, !unlocked && styles.locked, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <Text style={styles.num}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={styles.name}>{level.name}</Text>
              <Text style={styles.subtitle}>{level.subtitle}</Text>
              <View style={styles.stats}>
                {unlocked ? (
                  <>
                    <Text style={styles.stat}>BEST {rec?.bestMs != null ? formatTime(rec.bestMs) : '--:--.---'}</Text>
                    <Text style={styles.stat}>DEATHS {rec?.deaths ?? 0}</Text>
                    {level.par !== undefined && (
                      <Text style={[styles.stat, rec?.bestMs != null && rec.bestMs <= level.par * 1000 && { color: COLORS.key }]}>
                        PAR {formatTime(level.par * 1000)}
                      </Text>
                    )}
                    <Text style={[styles.stat, rec?.completed && { color: COLORS.orb }]}>
                      {rec?.completed ? `CLEARED x${rec.clears}${rec.assisted ? ' · WAYFINDER' : ''}${rec.deathless ? ' · CROWN' : ''}${rec.fewestDeaths !== undefined ? ` · BEST ${rec.fewestDeaths}✕` : ''}` : `${level.rooms.length} ROOMS`}
                    </Text>
                  </>
                ) : problem ? (
                  <Text style={[styles.stat, { color: COLORS.spike }]}>NEEDS FIX · {problem}</Text>
                ) : (
                  <Text style={styles.stat}>LOCKED · clear level {i}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.help}>
        {controls === 'auto'
          ? 'Tap the left / right half to start running that way · Then tap the side you run toward to jump ' +
            '(hold = higher), the other side to turn around · On a wall any tap wall-jumps · ' +
            'Swipe to dash in 8 directions · Swipe down on a wall to drop'
          : 'Hold bottom-left / bottom-right to run · Tap above to jump (hold = higher) · Swipe to dash in 8 directions · ' +
            'Push into walls to slide, jump off them to wall-jump'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingVertical: 24, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { color: COLORS.player, fontSize: 30, fontWeight: '900', letterSpacing: 6 },
  tag: { color: COLORS.dim, fontSize: 13, marginTop: 2 },
  reset: { color: '#3a4470', fontSize: 11 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  controls: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#24305a', backgroundColor: '#0d1224' },
  devRow: { flexDirection: 'row', gap: 8 },
  devNote: { color: COLORS.goal, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  controlsText: { color: COLORS.player, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  card: {
    flexGrow: 1, flexBasis: 200, padding: 16, borderRadius: 16, backgroundColor: '#0d1224',
    borderWidth: 1, borderColor: '#24305a', gap: 2,
  },
  locked: { opacity: 0.35 },
  num: { color: COLORS.goal, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  name: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: COLORS.dim, fontSize: 12 },
  stats: { marginTop: 10, gap: 2 },
  stat: { color: '#aab3d8', fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '600' },
  help: { color: COLORS.dim, fontSize: 12, lineHeight: 18 },
});
