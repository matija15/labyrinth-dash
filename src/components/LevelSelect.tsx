import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatTime } from '../engine/save';
import type { LevelDef, SaveData } from '../types';
import { COLORS } from './renderer';

interface Props {
  levels: LevelDef[];
  save: SaveData;
  onPlay: (id: string) => void;
  onReset: () => void;
}

export function LevelSelect({ levels, save, onPlay, onReset }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>LABYRINTH DASH</Text>
          <Text style={styles.tag}>precision platformer · {save.totalDeaths} total deaths</Text>
        </View>
        <Pressable onLongPress={onReset} delayLongPress={1200}>
          <Text style={styles.reset}>hold to reset save</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        {levels.map((level, i) => {
          const rec = save.levels[level.id];
          const unlocked = i === 0 || !!save.levels[levels[i - 1].id]?.completed;
          return (
            <Pressable
              key={level.id}
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
                    <Text style={[styles.stat, rec?.completed && { color: COLORS.orb }]}>
                      {rec?.completed ? `CLEARED x${rec.clears}` : `${level.rooms.length} ROOMS`}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.stat}>LOCKED · clear level {i}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.help}>
        Hold bottom-left / bottom-right to run · Tap above to jump (hold = higher) · Swipe to dash in 8 directions ·
        Push into walls to slide, jump off them to wall-jump
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
