import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Picture, useFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { TILE, VIEW_TILES_H } from '../engine/constants';
import {
  blankLevel, cloneLevel, editorIssues, levelToCode, levelToJson, parseLevelCode, type EditorTool,
} from '../engine/editor';
import { loadEditorDraft, writeEditorDraft } from '../engine/storage';
import { LEVELS } from '../levels';
import type { LevelDef } from '../types';
import { EditorController, type EditorSnapshot } from './editorController';
import { buildEditorPicture, renderEditorFrame } from './editorRenderer';
import { COLORS } from './renderer';

interface Props {
  /** False while a playtest covers the editor (disables keyboard / wheel shortcuts). */
  active: boolean;
  onPlaytest: (level: LevelDef) => void;
  onExit: () => void;
}

const TOOLS: { tool: EditorTool; label: string; color: string }[] = [
  { tool: '#', label: 'Wall', color: COLORS.solidEdge },
  { tool: '^', label: 'Spikes', color: COLORS.spike },
  { tool: 'saw', label: 'Saw', color: COLORS.saw },
  { tool: 'O', label: 'Dash Orb', color: COLORS.orb },
  { tool: 'K', label: 'Key', color: COLORS.key },
  { tool: 'D', label: 'Door', color: COLORS.door },
  { tool: 'S', label: 'Spawn', color: COLORS.player },
  { tool: 'G', label: 'Exit Flag', color: COLORS.goal },
  { tool: '=', label: 'Crumble', color: COLORS.crumble },
  { tool: 'J', label: 'Jump Pad', color: COLORS.pad },
  { tool: 'erase', label: 'Eraser', color: COLORS.dim },
  { tool: 'room+', label: '+ Room', color: '#3a4a86' },
  { tool: 'room-', label: '− Room', color: '#3a4a86' },
  { tool: 'pan', label: 'Pan', color: COLORS.text },
];

const HINTS: Partial<Record<EditorTool, string>> = {
  '^': 'Spikes point away from the wall they touch',
  saw: 'Drag to set a saw path · tap for an orbiting saw',
  S: 'Every room needs a spawn (checkpoint) · playtest starts at the first room’s',
  G: 'One exit flag per level',
  erase: 'Drag to erase tiles and saws',
  'room+': 'Tap empty space to add a walled 32×16 room',
  'room-': 'Tap a room to delete it',
  pan: 'Drag to scroll',
};

const ZOOMS = [0.5, 0.75, 1, 1.5, 2];
const PALETTE_W = 92;
export function LevelEditor({ active, onPlaytest, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const font = useFont(require('../../assets/fonts/SpaceMono-Bold.ttf'), 11);
  const ctl = useMemo(() => new EditorController(), []);
  const [snap, setSnap] = useState<EditorSnapshot>(() => ctl.snapshot());
  const [tool, setTool] = useState<EditorTool>('#');
  const [zoomIndex, setZoomIndex] = useState(1);
  const [grid, setGrid] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [modal, setModal] = useState<'export' | 'load' | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const scale = (ZOOMS[zoomIndex] * (size.height || 1)) / (VIEW_TILES_H * TILE);
  const focusLeft = PALETTE_W + insets.left + 8;

  useEffect(() => ctl.subscribe(setSnap), [ctl]);
  useEffect(() => {
    ctl.configure(tool, size.width, size.height, scale);
  }, [ctl, tool, size.width, size.height, scale]);

  // Restore / persist the working draft.
  useEffect(() => {
    let cancelled = false;
    loadEditorDraft().then((draft) => {
      if (cancelled) return;
      if (draft) {
        try {
          ctl.load(parseLevelCode(JSON.stringify(draft)), false);
        } catch {
          // Corrupt draft: keep the blank level.
        }
      }
      setDraftLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ctl]);
  useEffect(() => {
    if (draftLoaded) writeEditorDraft(snap.level);
  }, [draftLoaded, snap.level, snap.version]);

  const focused = useRef(false);
  useEffect(() => {
    if (!size.width || !draftLoaded || focused.current) return;
    focused.current = true;
    ctl.configure(tool, size.width, size.height, scale);
    ctl.focus(focusLeft, 44);
  }, [ctl, draftLoaded, focusLeft, scale, size.height, size.width, tool]);

  const content = useMemo(() => {
    void snap.version;
    return buildEditorPicture(snap.level);
  }, [snap.level, snap.version]);

  const picture = useMemo(() => {
    if (!size.width) return null;
    return renderEditorFrame({
      level: snap.level, content, width: size.width, height: size.height, scale,
      camX: snap.camX, camY: snap.camY, grid, font, cursor: snap.cursor, sawDrag: snap.sawDrag,
    });
  }, [content, size, scale, grid, font, snap]);

  const gesture = useMemo(() => createEditorGesture(ctl), [ctl]);

  // Web: arrow keys / wheel scroll, Ctrl+Z undo.
  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      const step = 8 * TILE;
      const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
      if (d) {
        ctl.panBy(d[0], d[1]);
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        ctl.undo();
        e.preventDefault();
      }
    };
    const wheel = (e: WheelEvent) => {
      ctl.panBy((e.shiftKey ? e.deltaY : e.deltaX) / scale, (e.shiftKey ? 0 : e.deltaY) / scale);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('wheel', wheel);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('wheel', wheel);
    };
  }, [active, ctl, scale]);

  const zoom = (dir: number) => {
    const next = Math.min(ZOOMS.length - 1, Math.max(0, zoomIndex + dir));
    if (next === zoomIndex) return;
    ctl.rescale((ZOOMS[next] * size.height) / (VIEW_TILES_H * TILE));
    setZoomIndex(next);
  };

  const playtest = () => {
    const issues = editorIssues(snap.level);
    if (issues.length) {
      ctl.setMessage(`Can’t playtest: ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}`);
      return;
    }
    ctl.setMessage(null);
    onPlaytest(cloneLevel(snap.level));
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const { level, message } = snap;
  const hint = message ?? HINTS[tool] ?? 'Drag to paint · two fingers to scroll';

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Canvas style={StyleSheet.absoluteFill}>{picture && <Picture picture={picture} />}</Canvas>
        </View>
      </GestureDetector>

      <View style={[styles.palette, { top: insets.top + 8, left: insets.left + 8, bottom: 8 }]}>
        <ScrollView contentContainerStyle={{ gap: 4, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          {TOOLS.map((t) => (
            <Pressable
              key={t.tool}
              accessibilityRole="button"
              accessibilityLabel={`Tool ${t.label}`}
              accessibilityState={{ selected: tool === t.tool }}
              onPress={() => setTool(t.tool)}
              style={[styles.tool, tool === t.tool && styles.toolOn]}
            >
              <View style={[styles.swatch, { backgroundColor: t.color }, t.tool === 'erase' && styles.swatchHollow]} />
              <Text style={[styles.toolText, tool === t.tool && { color: COLORS.bg }]} numberOfLines={1}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={[styles.topBar, { top: insets.top + 8, right: insets.right + 8 }]}>
        <BarButton label="Undo" onPress={() => ctl.undo()} disabled={!snap.undoCount} />
        <BarButton label={grid ? 'Grid ✓' : 'Grid'} onPress={() => setGrid((g) => !g)} />
        <BarButton label="−" onPress={() => zoom(-1)} disabled={zoomIndex === 0} />
        <BarButton label="+" onPress={() => zoom(1)} disabled={zoomIndex === ZOOMS.length - 1} />
        <BarButton label="Load" onPress={() => setModal('load')} />
        <BarButton label="Export" onPress={() => setModal('export')} />
        <BarButton label="▶ Playtest" onPress={playtest} primary />
        <BarButton label="Exit" onPress={onExit} />
      </View>

      <View pointerEvents="none" style={[styles.status, { left: insets.left + PALETTE_W + 16, bottom: 10 }]}>
        <Text style={[styles.statusText, message && { color: COLORS.spike }]} numberOfLines={2}>
          {level.name} · {level.rooms.length} room{level.rooms.length === 1 ? '' : 's'} · {hint}
        </Text>
      </View>

      {modal === 'export' && (
        <ExportModal level={level} onRename={(name) => ctl.rename(name)} onClose={() => setModal(null)} />
      )}
      {modal === 'load' && (
        <LoadModal
          onLoad={(next) => {
            ctl.load(next);
            ctl.focus(focusLeft, 44);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </View>
  );
}

function createEditorGesture(ctl: EditorController) {
  return Gesture.Manual()
    .runOnJS(true)
    .onTouchesDown((e, manager) => {
      manager.activate();
      for (const t of e.changedTouches) ctl.down(t.id, t.x, t.y);
    })
    .onTouchesMove((e) => {
      for (const t of e.changedTouches) ctl.move(t.id, t.x, t.y);
    })
    .onTouchesUp((e) => {
      for (const t of e.changedTouches) ctl.up(t.id);
    })
    .onTouchesCancelled((e) => {
      for (const t of e.changedTouches) ctl.up(t.id);
    });
}

function BarButton({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.bar, primary && styles.btnPrimary, (pressed || disabled) && { opacity: disabled ? 0.35 : 0.7 }]}
    >
      <Text style={[styles.barText, primary && { color: COLORS.bg }]}>{label}</Text>
    </Pressable>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: 12 }]}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <BarButton label="Close" onPress={onClose} />
        </View>
        {children}
      </View>
    </View>
  );
}

function ExportModal({ level, onRename, onClose }: { level: LevelDef; onRename: (name: string) => void; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const code = levelToCode(level);
  const issues = editorIssues(level);
  const copy = async (what: 'file' | 'json') => {
    await Clipboard.setStringAsync(what === 'file' ? code : levelToJson(level));
    setCopied(what);
  };
  return (
    <Sheet title="EXPORT LEVEL CODE" onClose={onClose}>
      <View style={styles.row}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={level.name}
          onChangeText={onRename}
          style={[styles.input, { flex: 1 }]}
          placeholder="Level name"
          placeholderTextColor={COLORS.dim}
          autoCorrect={false}
        />
        <Text style={styles.small}>id {level.id}</Text>
      </View>
      {issues.length > 0 && <Text style={styles.error}>Not playable yet: {issues.join(' · ')}</Text>}
      <ScrollView style={styles.codeBox} contentContainerStyle={{ padding: 10 }}>
        <ScrollView horizontal>
          <Text selectable style={styles.code}>{code}</Text>
        </ScrollView>
      </ScrollView>
      <View style={styles.row}>
        <BarButton label={copied === 'file' ? 'Copied ✓' : 'Copy to Clipboard'} onPress={() => copy('file')} primary />
        <BarButton label={copied === 'json' ? 'Copied ✓' : 'Copy as JSON'} onPress={() => copy('json')} />
        <Text style={styles.small}>
          Paste into src/levels/{level.id}.ts, then add it to LEVELS in src/levels/index.ts
        </Text>
      </View>
    </Sheet>
  );
}

function LoadModal({ onLoad, onClose }: { onLoad: (level: LevelDef) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const loadText = () => {
    try {
      onLoad(parseLevelCode(text));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Sheet title="LOAD LEVEL" onClose={onClose}>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <BarButton label="New blank level" onPress={() => onLoad(blankLevel())} primary />
        {LEVELS.map((l) => (
          <BarButton key={l.id} label={l.name} onPress={() => onLoad(cloneLevel(l))} />
        ))}
      </View>
      <Text style={styles.small}>…or paste level code (JSON or a src/levels/*.ts file):</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        multiline
        style={[styles.input, styles.codeBox, styles.code]}
        placeholder="{ id: 'my-level', name: 'My Level', rooms: [ ... ] }"
        placeholderTextColor={COLORS.dim}
        autoCapitalize="none"
        autoCorrect={false}
        textAlignVertical="top"
      />
      <View style={styles.row}>
        <BarButton label="Load pasted code" onPress={loadText} disabled={!text.trim()} />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </Sheet>
  );
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  palette: {
    position: 'absolute', width: PALETTE_W, padding: 4, borderRadius: 12,
    backgroundColor: 'rgba(13,18,36,0.92)', borderWidth: 1, borderColor: '#24305a',
  },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 8 },
  toolOn: { backgroundColor: COLORS.player },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  swatchHollow: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.dim },
  toolText: { color: COLORS.text, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  topBar: { position: 'absolute', flexDirection: 'row', gap: 6 },
  bar: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#2f3d6e',
    backgroundColor: 'rgba(13,18,36,0.92)',
  },
  btnPrimary: { backgroundColor: COLORS.player, borderColor: COLORS.player },
  barText: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  status: { position: 'absolute', right: 16 },
  statusText: { color: COLORS.dim, fontSize: 11, fontWeight: '600' },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,4,10,0.8)',
    alignItems: 'center', paddingHorizontal: 24,
  },
  sheet: {
    flex: 1, width: '100%', maxWidth: 900, padding: 14, borderRadius: 16, backgroundColor: '#0e1326',
    borderWidth: 1, borderColor: '#24305a', gap: 10,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: COLORS.player, fontSize: 18, fontWeight: '900', letterSpacing: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  small: { color: COLORS.dim, fontSize: 11, flexShrink: 1 },
  error: { color: COLORS.spike, fontSize: 12, flexShrink: 1 },
  input: {
    color: COLORS.text, borderWidth: 1, borderColor: '#2f3d6e', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: '#070a16', fontSize: 13,
  },
  codeBox: { flex: 1, borderRadius: 10, backgroundColor: '#070a16', borderWidth: 1, borderColor: '#1c2547' },
  code: { color: '#c8d0f0', fontFamily: mono, fontSize: 11, lineHeight: 15 },
});
