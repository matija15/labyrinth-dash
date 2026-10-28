import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORY } from '../story/pages';
import { COLORS } from './renderer';

interface Props {
  /** Storybook pages found in the release pack. */
  found: number;
  onBack: () => void;
}

export function Storybook({ found, onBack }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>STORYBOOK</Text>
          <Text style={styles.tag}>{found} pages found · hidden pages open new passages</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.btn}>
          <Text style={styles.btnText}>BACK</Text>
        </Pressable>
      </View>
      {STORY.map((p) => {
        const open = found >= p.pages;
        return (
          <View key={p.title} accessibilityLabel={`Passage ${p.title}`} style={[styles.card, !open && styles.locked]}>
            <Text style={styles.name}>{open ? p.title : 'LOCKED'}</Text>
            <Text style={open ? styles.text : styles.need}>
              {open ? p.text : `Find ${p.pages} page${p.pages === 1 ? '' : 's'} · ${Math.min(found, p.pages)}/${p.pages}`}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingVertical: 24, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { color: '#f2e2b8', fontSize: 28, fontWeight: '900', letterSpacing: 6 },
  tag: { color: COLORS.dim, fontSize: 13, marginTop: 2 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#24305a', backgroundColor: '#0d1224' },
  btnText: { color: COLORS.player, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  card: { padding: 16, borderRadius: 16, backgroundColor: '#15121c', borderWidth: 1, borderColor: '#4a3f2a', gap: 6 },
  locked: { opacity: 0.45 },
  name: { color: '#f2e2b8', fontSize: 18, fontWeight: '800' },
  text: { color: '#d8cfb8', fontSize: 14, lineHeight: 21 },
  need: { color: COLORS.dim, fontSize: 13 },
});
