import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { THEMES } from '../engine/skins';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Picture, useFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { TILE, VIEW_TILES_H } from '../engine/constants';
import {
  blankLevel, cloneLevel, editorIssues, levelToCode, levelToJson, parseLevelCode, roomIssues, roomOnly, startingFrom,
  TOOL_SHORTCUTS, toolForKey, type EditorTool,
} from '../engine/editor';
import { deletePackLevel, fetchPack, reorderPack, savePackLevel } from '../engine/levelServer';
import { loadEditorDraft, loadStamps, writeEditorDraft, writeStamps, type Stamp } from '../engine/storage';
import { DEV_LEVELS, RELEASE_LEVELS } from '../levels';
import type { LevelDef } from '../types';
import { EditorController, type EditorSnapshot } from './editorController';
import { buildEditorPicture, renderEditorFrame } from './editorRenderer';
import { COLORS, MECH } from './renderer';

interface Props {
  /** False while a playtest covers the editor (disables keyboard / wheel shortcuts). */
  active: boolean;
  onPlaytest: (level: LevelDef) => void;
  onExit: () => void;
  /** Where playtests died (world px), drawn as red ✕ marks. */
  deathMarks?: [number, number][];
  onClearDeathMarks?: () => void;
}

/** Theme choices for a level ('' = default). */
const LEVEL_THEMES = ['', ...THEMES.map((t) => t.id)];

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
  { tool: '-', label: 'One-Way', color: COLORS.solidEdge },
  { tool: 'platform', label: 'Platform', color: '#8fa6ff' },
  { tool: '[', label: 'Switch A', color: MECH.switchA },
  { tool: ']', label: 'Switch B', color: MECH.switchB },
  { tool: '*', label: 'Lantern', color: MECH.crystal },
  { tool: ')', label: 'Wind →', color: MECH.wind },
  { tool: '(', label: 'Wind ←', color: MECH.wind },
  { tool: 'u', label: 'Wind ↑', color: MECH.wind },
  { tool: 'n', label: 'Wind ↓', color: MECH.wind },
  { tool: 'erase', label: 'Eraser', color: COLORS.dim },
  { tool: 'select', label: 'Select', color: COLORS.player },
  { tool: 'paste', label: 'Paste', color: COLORS.goal },
  { tool: 'room+', label: '+ Room', color: '#3a4a86' },
  { tool: 'room-', label: '− Room', color: '#3a4a86' },
  { tool: 'pan', label: 'Pan', color: COLORS.text },
];

const HINTS: Partial<Record<EditorTool, string>> = {
  '^': 'Spikes point away from the wall they touch',
  saw: 'Drag to set a saw path · tap for an orbiting saw',
  platform: 'Drag to set where a 3-wide moving platform goes · tap for one sliding 6 tiles right',
  '-': 'Land on it from above · jump up through it · dash straight down to drop through',
  '[': 'Solid at the start · every dash swaps Switch A and Switch B',
  ']': 'Solid after the first dash · every dash swaps Switch A and Switch B',
  '*': 'Refills two dashes (comes back after 3.5 s)',
  ')': 'Wind pushes the player · press I again to turn it',
  '(': 'Wind pushes the player · press I again to turn it',
  u: 'Up-draft lifts the player · press I again to turn it',
  n: 'Down-draft pushes the player down · press I again to turn it',
  S: 'Every room needs a spawn (checkpoint) · playtest starts at the first room’s',
  G: 'One exit flag per level',
  erase: 'Drag to erase tiles and saws',
  'room+': 'Tap empty space to add a walled 32×16 room',
  'room-': 'Tap a room to delete it',
  pan: 'Drag to scroll',
  select: 'Drag a box · then Copy / Cut / Fill / Clear it',
  paste: 'Tap or drag to place the copied block (top-left corner)',
};

/** Tools that Fill can paint across a selection. */
const FILL_TOOLS = new Set<EditorTool>(['#', '^', 'O', 'K', 'D', 'S', 'G', '=', 'J', '-', '[', ']', '*', ')', '(', 'u', 'n', 'erase']);
/** Pressing the wind hotkey again turns the wind: → ↑ ← ↓. */
const WIND_TOOLS: EditorTool[] = [')', 'u', '(', 'n'];

/** Zoom is relative to the default view (100% shows 3/4 of a room's height). */
const BASE_ZOOM = 0.75;
const ZOOM_MIN = 0.33;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;
const PALETTE_W = 126;
export function LevelEditor({ active, onPlaytest, onExit, deathMarks, onClearDeathMarks }: Props) {
  const insets = useSafeAreaInsets();
  const font = useFont(require('../../assets/fonts/SpaceMono-Bold.ttf'), 11);
  const ctl = useMemo(() => new EditorController(), []);
  const [snap, setSnap] = useState<EditorSnapshot>(() => ctl.snapshot());
  const [tool, setTool] = useState<EditorTool>('#');
  const [fillTool, setFillTool] = useState<EditorTool>('#');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [modal, setModal] = useState<'export' | 'levels' | 'save' | 'stamps' | null>(null);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  useEffect(() => {
    loadStamps().then(setStamps);
  }, []);
  const updateStamps = (next: Stamp[]) => {
    setStamps(next);
    void writeStamps(next);
  };
  const saveStamp = () => {
    if (!snap.selection) return ctl.setMessage('Select a block first, then press Stamp');
    ctl.selectionOp('copy');
    const clip = ctl.getClip();
    if (!clip) return;
    const name = `Stamp ${stamps.length + 1}`;
    updateStamps([...stamps, { name, clip }]);
    ctl.setMessage(`Saved “${name}” (${clip.w}×${clip.h}) · open Stamps to place it`);
  };
  const [draftLoaded, setDraftLoaded] = useState(false);

  const baseScale = (BASE_ZOOM * (size.height || 1)) / (VIEW_TILES_H * TILE);
  const scale = zoom * baseScale;
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
          ctl.load(parseLevelCode(JSON.stringify(draft.level)), false);
          setSourceId(draft.sourceId);
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
    if (draftLoaded) writeEditorDraft({ level: snap.level, sourceId });
  }, [draftLoaded, snap.level, snap.version, sourceId]);

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
      platformDrag: snap.platformDrag, deathMarks, selection: tool === 'select' ? snap.selection : null, pastePreview: snap.pastePreview,
    });
  }, [content, size, scale, grid, font, snap, tool, deathMarks]);

  const gesture = useMemo(() => createEditorGesture(ctl), [ctl]);

  const pickTool = (t: EditorTool) => {
    setTool(t);
    if (FILL_TOOLS.has(t)) setFillTool(t);
  };

  const zoomTo = (next: number, at?: { x: number; y: number }) => {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    if (Math.abs(z - zoom) < 1e-6) return;
    ctl.rescale(z * baseScale, at);
    setZoom(z);
  };

  /** From the level's first room, or (`here`) from the room in the middle of the screen. */
  const playtest = (here: boolean) => {
    const issues = editorIssues(snap.level);
    if (issues.length) {
      ctl.setMessage(`Can’t playtest: ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}`);
      return;
    }
    ctl.setMessage(null);
    onPlaytest(here ? startingFrom(snap.level, ctl.centerRoomIndex(focusLeft)) : cloneLevel(snap.level));
  };

  /** Only the room in the middle of the screen; a room without a spawn starts on its floor near the center. */
  const playtestRoom = () => {
    if (!snap.level.rooms.length) return;
    const practice = roomOnly(snap.level, ctl.centerRoomIndex(focusLeft));
    const issues = roomIssues(practice);
    if (issues.length) {
      ctl.setMessage(`Can’t playtest this room: ${issues[0]}`);
      return;
    }
    ctl.setMessage(null);
    onPlaytest(practice);
  };

  // Web: tool hotkeys, T room playtest, arrow keys scroll, Ctrl+Z undo, wheel zooms at the cursor.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || modal) return;
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    const step = 8 * TILE;
    const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
    if (d) {
      ctl.panBy(d[0], d[1]);
      e.preventDefault();
    } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
      ctl.redo();
      e.preventDefault();
    } else if (mod && k === 'z') {
      ctl.undo();
      e.preventDefault();
    } else if (mod && (k === 'c' || k === 'x')) {
      ctl.selectionOp(k === 'c' ? 'copy' : 'cut');
    } else if (mod && k === 'v') {
      setTool('paste');
    } else if (mod || e.altKey || e.repeat) {
      return;
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      ctl.selectionOp('clear');
    } else if (e.key === 'Escape') {
      ctl.selectionOp('deselect');
    } else if (k === 't') {
      playtestRoom();
    } else if (k === '+' || k === '=') {
      zoomTo(zoom * ZOOM_STEP);
    } else if (k === '-' || k === '_') {
      zoomTo(zoom / ZOOM_STEP);
    } else {
      const t = toolForKey(e.key);
      const w = WIND_TOOLS.indexOf(tool);
      if (t === ')' && w >= 0) pickTool(WIND_TOOLS[(w + 1) % WIND_TOOLS.length]);
      else if (t) pickTool(t);
    }
  });
  const onWheel = useEffectEvent((e: WheelEvent) => {
    const canvas = (e.target as Element | null)?.closest?.('#editor-canvas');
    if (!canvas || modal) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1);
    const factor = Math.min(ZOOM_STEP, Math.max(1 / ZOOM_STEP, Math.exp(-px * 0.002)));
    zoomTo(zoom * factor, { x: e.clientX - r.left, y: e.clientY - r.top });
  });
  // Middle mouse button (pressed scroll wheel) drags the map, like Blender.
  const onMiddleDown = useEffectEvent((e: PointerEvent) =>
    e.button === 1 && !modal && !!(e.target as Element | null)?.closest?.('#editor-canvas'));
  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof window === 'undefined') return;
    let drag: { id: number; x: number; y: number } | null = null;
    const key = (e: KeyboardEvent) => onKey(e);
    const wheel = (e: WheelEvent) => onWheel(e);
    // Capture phase + stopPropagation keeps the middle-button drag away from the paint gesture.
    const down = (e: PointerEvent) => {
      if (!onMiddleDown(e)) return;
      e.preventDefault();
      e.stopPropagation();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      ctl.middlePan = true;
      document.body.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.stopPropagation();
      ctl.dragBy(e.clientX - drag.x, e.clientY - drag.y);
      drag = { id: drag.id, x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id || e.button !== 1) return;
      e.stopPropagation();
      drag = null;
      setTimeout(() => { ctl.middlePan = false; }, 0);
      document.body.style.cursor = '';
    };
    // Stops Chrome's middle-click autoscroll and Linux middle-click paste on the canvas.
    const noDefault = (e: MouseEvent) => {
      if (e.button === 1 && (e.target as Element | null)?.closest?.('#editor-canvas')) e.preventDefault();
    };
    const opts = { capture: true };
    window.addEventListener('keydown', key);
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('pointerdown', down, opts);
    window.addEventListener('pointermove', move, opts);
    window.addEventListener('pointerup', up, opts);
    window.addEventListener('mousedown', noDefault, opts);
    window.addEventListener('auxclick', noDefault, opts);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('pointerdown', down, opts);
      window.removeEventListener('pointermove', move, opts);
      window.removeEventListener('pointerup', up, opts);
      window.removeEventListener('mousedown', noDefault, opts);
      window.removeEventListener('auxclick', noDefault, opts);
      ctl.middlePan = false;
      document.body.style.cursor = '';
    };
  }, [active, ctl]);

  const open = (next: LevelDef, id: string | null) => {
    ctl.load(next);
    ctl.focus(focusLeft, 44);
    setSourceId(id);
    setModal(null);
  };

  const fillLabel = TOOLS.find((t) => t.tool === fillTool)?.label ?? fillTool;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const { level, message } = snap;
  const hint = message ?? HINTS[tool] ?? (Platform.OS === 'web' ? 'Drag to paint · wheel zooms · hold wheel to move · T tests this room' : 'Drag to paint · two fingers to scroll');

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View nativeID="editor-canvas" style={StyleSheet.absoluteFill} collapsable={false}>
          <Canvas style={StyleSheet.absoluteFill}>{picture && <Picture picture={picture} />}</Canvas>
        </View>
      </GestureDetector>

      <View style={[styles.palette, { top: insets.top + 8, left: insets.left + 8, bottom: 8 }]}>
        <ScrollView contentContainerStyle={{ gap: 4, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          {TOOLS.map((t) => {
            const [key, digit] = TOOL_SHORTCUTS[t.tool] ?? [];
            return (
              <Pressable
                key={t.tool}
                accessibilityRole="button"
                accessibilityLabel={`Tool ${t.label}${key ? ` (${key}${digit ? ` or ${digit}` : ''})` : ''}`}
                accessibilityState={{ selected: tool === t.tool }}
                onPress={() => pickTool(t.tool)}
                style={[styles.tool, tool === t.tool && styles.toolOn]}
              >
                <View style={[styles.swatch, { backgroundColor: t.color }, t.tool === 'erase' && styles.swatchHollow]} />
                <Text style={[styles.toolText, tool === t.tool && { color: COLORS.bg }]} numberOfLines={1}>
                  {t.label}
                  {key && <Text style={[styles.toolKey, tool === t.tool && { color: COLORS.bg }]}> [{key}]</Text>}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.topBar, { top: insets.top + 8, right: insets.right + 8, left: insets.left + PALETTE_W + 16 }]}>
        <BarButton label="Undo" onPress={() => ctl.undo()} disabled={!snap.undoCount} />
        <BarButton label="Redo" onPress={() => ctl.redo()} disabled={!snap.redoCount} />
        <BarButton label={grid ? 'Grid ✓' : 'Grid'} onPress={() => setGrid((g) => !g)} />
        <BarButton label="−" a11y="Zoom out" onPress={() => zoomTo(zoom / ZOOM_STEP)} disabled={zoom <= ZOOM_MIN + 1e-6} />
        <BarButton label={`${Math.round(zoom * 100)}% ⟲`} a11y="Reset zoom" onPress={() => zoomTo(1)} />
        <BarButton label="+" a11y="Zoom in" onPress={() => zoomTo(zoom * ZOOM_STEP)} disabled={zoom >= ZOOM_MAX - 1e-6} />
        <BarButton label="Levels" onPress={() => setModal('levels')} />
        <BarButton label="Stamps" onPress={() => setModal('stamps')} />
        {!!deathMarks?.length && <BarButton label={`✕ ${deathMarks.length} deaths`} onPress={() => onClearDeathMarks?.()} />}
        <BarButton label="Save" onPress={() => setModal('save')} />
        <BarButton label="Export" onPress={() => setModal('export')} />
        <BarButton label="▶ Room [T]" a11y="Playtest current room" onPress={playtestRoom} primary />
        <BarButton label="▶ Here" onPress={() => playtest(true)} primary />
        <BarButton label="▶ Start" onPress={() => playtest(false)} primary />
        <BarButton label="Exit" onPress={onExit} />
      </View>

      {tool === 'select' && snap.selection && (
        <View style={[styles.selBar, { left: insets.left + PALETTE_W + 16, bottom: 40 }]}>
          <Text style={styles.small}>{snap.selection.w}×{snap.selection.h}</Text>
          <BarButton label="Copy" onPress={() => ctl.selectionOp('copy')} />
          <BarButton label="Cut" onPress={() => ctl.selectionOp('cut')} />
          <BarButton label="Stamp" onPress={saveStamp} />
          <BarButton label={`Fill ${fillLabel}`} onPress={() => ctl.selectionOp('fill', fillTool)} />
          <BarButton label="Clear" onPress={() => ctl.selectionOp('clear')} />
          <BarButton label="✕" onPress={() => ctl.selectionOp('deselect')} />
        </View>
      )}

      <View pointerEvents="none" style={[styles.status, { left: insets.left + PALETTE_W + 16, bottom: 10 }]}>
        <Text style={[styles.statusText, message && { color: COLORS.spike }]} numberOfLines={2}>
          {level.name}{sourceId ? '' : ' (unsaved)'} · {level.rooms.length} room{level.rooms.length === 1 ? '' : 's'} · {hint}
        </Text>
      </View>

      {modal === 'export' && (
        <ExportModal level={level} onRename={(name) => ctl.rename(name)} onClose={() => setModal(null)} />
      )}
      {modal === 'save' && (
        <SaveModal
          level={level}
          sourceId={sourceId}
          onRename={(name) => ctl.rename(name)}
          onSubtitle={(sub) => ctl.setSubtitle(sub)}
          onChapter={(ch) => ctl.setChapter(ch)}
          onPar={(t) => ctl.setPar(t)}
          onTheme={(id) => ctl.setTheme(id)}
          onSaved={(id, position) => {
            setSourceId(id);
            ctl.setMessage(`Saved ${id}.json as level ${position}`);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'stamps' && (
        <StampsModal
          stamps={stamps}
          onChange={updateStamps}
          onUse={(s) => {
            ctl.setClip(s.clip);
            pickTool('paste');
            ctl.setMessage(`Placing “${s.name}” · drag to position, release to paste`);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'levels' && (
        <LevelsModal
          currentId={sourceId}
          onOpen={open}
          onDeleted={(id) => id === sourceId && setSourceId(null)}
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

function BarButton({
  label, a11y, onPress, primary, disabled,
}: { label: string; a11y?: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
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

function StampsModal({
  stamps, onChange, onUse, onClose,
}: {
  stamps: Stamp[];
  onChange: (stamps: Stamp[]) => void;
  onUse: (stamp: Stamp) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="STAMPS" onClose={onClose}>
      {stamps.length === 0 && (
        <Text style={styles.small}>No stamps yet. Use Select, drag a box, then press Stamp to save it here.</Text>
      )}
      <ScrollView style={{ maxHeight: 320 }}>
        {stamps.map((s, i) => (
          <View key={i} style={styles.row}>
            <TextInput
              value={s.name}
              onChangeText={(name) => onChange(stamps.map((x, j) => (j === i ? { ...x, name } : x)))}
              style={[styles.input, { flex: 1 }]}
              autoCorrect={false}
            />
            <Text style={styles.small}>{s.clip.w}×{s.clip.h}</Text>
            <BarButton label="Use" onPress={() => onUse(s)} primary />
            <BarButton label="Delete" onPress={() => onChange(stamps.filter((_, j) => j !== i))} />
          </View>
        ))}
      </ScrollView>
    </Sheet>
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
          For your levels use Save instead: it writes src/levels/release/{level.id}.json (needs npm run levels).
        </Text>
      </View>
    </Sheet>
  );
}

function SaveModal({
  level, sourceId, onRename, onSubtitle, onChapter, onPar, onTheme, onSaved, onClose,
}: {
  level: LevelDef;
  sourceId: string | null;
  onRename: (name: string) => void;
  onSubtitle: (subtitle: string) => void;
  onChapter: (chapter: string) => void;
  onPar: (seconds: string) => void;
  onTheme: (id: string) => void;
  onSaved: (id: string, position: number) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issues = editorIssues(level);
  const target =
    sourceId === level.id ? 'overwrites this level' : sourceId ? `renames ${sourceId}` : 'adds it as the last level';
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { position } = await savePackLevel(cloneLevel(level), sourceId);
      onSaved(level.id, position);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="SAVE TO RELEASE PACK" onClose={onClose}>
      <View style={styles.row}>
        <Text style={[styles.label, styles.fieldLabel]}>Name</Text>
        <TextInput
          value={level.name}
          onChangeText={onRename}
          style={[styles.input, { flex: 1 }]}
          placeholder="Level name"
          placeholderTextColor={COLORS.dim}
          autoCorrect={false}
        />
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, styles.fieldLabel]}>Subtitle</Text>
        <TextInput
          value={level.subtitle}
          onChangeText={onSubtitle}
          style={[styles.input, { flex: 1 }]}
          placeholder="Shown under the name on level select"
          placeholderTextColor={COLORS.dim}
          autoCorrect={false}
        />
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, styles.fieldLabel]}>Chapter</Text>
        <TextInput
          value={level.chapter ?? ''}
          onChangeText={onChapter}
          style={[styles.input, { flex: 1 }]}
          placeholder="e.g. Caves · empty = automatic blocks of 15"
          placeholderTextColor={COLORS.dim}
          autoCorrect={false}
        />
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, styles.fieldLabel]}>Par (s)</Text>
        <TextInput
          defaultValue={level.par ? String(level.par) : ''}
          onChangeText={onPar}
          style={[styles.input, { flex: 1 }]}
          placeholder="Target time in seconds · empty = no par"
          placeholderTextColor={COLORS.dim}
          keyboardType="decimal-pad"
          autoCorrect={false}
        />
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, styles.fieldLabel]}>Theme</Text>
        <Pressable
          accessibilityLabel="Level theme"
          onPress={() => onTheme(LEVEL_THEMES[(LEVEL_THEMES.indexOf(level.theme ?? '') + 1) % LEVEL_THEMES.length])}
          style={[styles.input, { flex: 1, justifyContent: 'center' }]}
        >
          <Text style={{ color: COLORS.text }}>{THEMES.find((t) => t.id === level.theme)?.name ?? 'Default (Neon Night)'}</Text>
        </Pressable>
      </View>
      <Text style={styles.small}>
        Writes src/levels/release/{level.id}.json ({target}). Commit the files to ship them.
      </Text>
      {issues.length > 0 && <Text style={styles.error}>Saving anyway, but not playable yet: {issues.join(' · ')}</Text>}
      <View style={styles.row}>
        <BarButton label={busy ? 'Saving…' : 'Save'} onPress={save} primary disabled={busy || !level.id} />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </Sheet>
  );
}

function LevelsModal({
  currentId, onOpen, onDeleted, onClose,
}: {
  currentId: string | null;
  onOpen: (level: LevelDef, sourceId: string | null) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [pack, setPack] = useState<LevelDef[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      fetchPack()
        .then((levels) => {
          setPack(levels);
          setOffline(null);
        })
        .catch((e: Error) => {
          setPack(RELEASE_LEVELS);
          setOffline(e.message);
        }),
    [],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = (p: Promise<unknown>) => {
    setError(null);
    p.then(refresh).catch((e: Error) => setError(e.message));
  };
  const move = (i: number, d: number) => {
    if (!pack || i + d < 0 || i + d >= pack.length) return;
    const ids = pack.map((l) => l.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    act(reorderPack(ids));
  };
  const remove = (id: string) => {
    if (confirm !== id) return setConfirm(id);
    setConfirm(null);
    act(deletePackLevel(id).then(() => onDeleted(id)));
  };
  const loadText = () => {
    try {
      onOpen(parseLevelCode(text), null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Sheet title="LEVELS" onClose={onClose}>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <BarButton label="+ New level" onPress={() => onOpen(blankLevel(), null)} primary />
        <Text style={offline ? styles.error : styles.small}>
          {offline
            ? `${offline} · showing the copy bundled in the app (open only)`
            : `${pack?.length ?? '…'} levels in src/levels/release/ · this order is the unlock order`}
        </Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <ScrollView style={styles.list} contentContainerStyle={{ padding: 6, gap: 4 }}>
        {pack?.length === 0 && <Text style={styles.small}>No levels yet. Build one, then press Save.</Text>}
        {pack?.map((l, i) => (
          <View key={l.id} style={[styles.levelRow, l.id === currentId && styles.levelRowOn]}>
            <Text style={styles.levelNum}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.label} numberOfLines={1}>{l.name}</Text>
              <Text style={styles.small} numberOfLines={1}>{l.id} · {l.rooms.length} rooms</Text>
            </View>
            <BarButton label="Open" onPress={() => onOpen(cloneLevel(l), l.id)} primary />
            <BarButton label="↑" onPress={() => move(i, -1)} disabled={!!offline || i === 0} />
            <BarButton label="↓" onPress={() => move(i, 1)} disabled={!!offline || i === pack.length - 1} />
            <BarButton label={confirm === l.id ? 'Sure?' : 'Delete'} onPress={() => remove(l.id)} disabled={!!offline} />
          </View>
        ))}
      </ScrollView>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Text style={styles.small}>Demo levels (dev only, never shipped):</Text>
        {DEV_LEVELS.map((l) => (
          <BarButton key={l.id} label={l.name} onPress={() => onOpen(cloneLevel(l), null)} />
        ))}
      </View>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(null);
          }}
          multiline
          style={[styles.input, styles.code, { flex: 1, height: 56 }]}
          placeholder="…or paste level code (JSON or a .ts level file)"
          placeholderTextColor={COLORS.dim}
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
        />
        <BarButton label="Load pasted" onPress={loadText} disabled={!text.trim()} />
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
  toolKey: { color: COLORS.dim, fontWeight: '800' },
  topBar: { position: 'absolute', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 },
  bar: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#2f3d6e',
    backgroundColor: 'rgba(13,18,36,0.92)',
  },
  btnPrimary: { backgroundColor: COLORS.player, borderColor: COLORS.player },
  barText: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  status: { position: 'absolute', right: 16 },
  selBar: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: { width: 64 },
  list: { flex: 1, borderRadius: 10, backgroundColor: '#070a16', borderWidth: 1, borderColor: '#1c2547' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, borderRadius: 8 },
  levelRowOn: { backgroundColor: '#18213f' },
  levelNum: { color: COLORS.player, fontSize: 14, fontWeight: '900', width: 34, textAlign: 'right' },
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
