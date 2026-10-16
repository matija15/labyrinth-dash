import { TILE } from '../engine/constants';
import {
  ROOM_H, ROOM_W, addSaw, blankLevel, deleteRoomAt, levelBounds, lineTiles, paintTile, slugify, type EditorTool,
} from '../engine/editor';
import type { LevelDef } from '../types';

export interface EditorSnapshot {
  level: LevelDef;
  /** Bumped on every level edit (drives the content picture + draft saving). */
  version: number;
  camX: number;
  camY: number;
  cursor: [number, number] | null;
  sawDrag: [number, number, number, number] | null;
  undoCount: number;
  message: string | null;
}

type Stroke =
  | { kind: 'paint'; before: string; changed: boolean; last: [number, number] }
  | { kind: 'saw'; before: string; start: [number, number]; end: [number, number] }
  | { kind: 'room'; before: string; start: [number, number] }
  | { kind: 'pan' };

const UNDO_LIMIT = 60;

/** Keeps the camera within a margin around the level; when the view is wider than that margin, the range is centered. */
const clampRange = (v: number, lo: number, hi: number) => (hi < lo ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));

/** Editor state + touch handling outside React, so pointer moves don't depend on render timing. */
export class EditorController {
  level: LevelDef = blankLevel();
  private version = 0;
  private cam = { x: 0, y: 0 };
  private cursor: [number, number] | null = null;
  private sawDrag: [number, number, number, number] | null = null;
  private message: string | null = null;
  private undoStack: string[] = [];
  private pointers = new Map<number, { x: number; y: number }>();
  private stroke: Stroke | null = null;
  private tool: EditorTool = '#';
  private width = 0;
  private height = 0;
  private scale = 1;
  private listener: ((s: EditorSnapshot) => void) | null = null;

  subscribe(fn: (s: EditorSnapshot) => void) {
    this.listener = fn;
    return () => {
      if (this.listener === fn) this.listener = null;
    };
  }

  snapshot(): EditorSnapshot {
    return {
      level: this.level, version: this.version, camX: this.cam.x, camY: this.cam.y, cursor: this.cursor,
      sawDrag: this.sawDrag, undoCount: this.undoStack.length, message: this.message,
    };
  }

  configure(tool: EditorTool, width: number, height: number, scale: number) {
    this.tool = tool;
    this.width = width;
    this.height = height;
    this.scale = scale;
  }

  private emit(edited = false) {
    if (edited) this.version++;
    if (this.width) {
      const b = levelBounds(this.level);
      const vw = this.width / this.scale;
      const vh = this.height / this.scale;
      this.cam.x = clampRange(this.cam.x, (b.x - ROOM_W) * TILE, (b.x + b.w + ROOM_W) * TILE - vw);
      this.cam.y = clampRange(this.cam.y, (b.y - ROOM_H) * TILE, (b.y + b.h + ROOM_H) * TILE - vh);
    }
    this.listener?.(this.snapshot());
  }

  setMessage(message: string | null) {
    this.message = message;
    this.emit();
  }

  private pushUndo(snapshot: string) {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.level = JSON.parse(prev);
    this.emit(true);
  }

  /** Replaces the level (undoable unless restoring a saved draft). */
  load(level: LevelDef, undoable = true) {
    if (undoable) this.pushUndo(JSON.stringify(this.level));
    this.level = level;
    this.message = null;
    this.emit(true);
  }

  rename(name: string) {
    this.level.name = name;
    this.level.id = slugify(name);
    this.emit(true);
  }

  /** Scrolls so the level's top-left corner sits just right of the palette. */
  focus(leftPx: number, topPx: number) {
    const b = levelBounds(this.level);
    this.cam = { x: b.x * TILE - leftPx / this.scale, y: b.y * TILE - topPx / this.scale };
    this.emit();
  }

  /** Pans by world px. */
  panBy(dx: number, dy: number) {
    this.cam.x += dx;
    this.cam.y += dy;
    this.emit();
  }

  /** Changes zoom keeping the screen center fixed. */
  rescale(nextScale: number) {
    const cx = this.cam.x + this.width / 2 / this.scale;
    const cy = this.cam.y + this.height / 2 / this.scale;
    this.scale = nextScale;
    this.cam = { x: cx - this.width / 2 / nextScale, y: cy - this.height / 2 / nextScale };
    this.emit();
  }

  private tileAt(sx: number, sy: number): [number, number] {
    return [Math.floor((sx / this.scale + this.cam.x) / TILE), Math.floor((sy / this.scale + this.cam.y) / TILE)];
  }

  down(id: number, x: number, y: number) {
    this.pointers.set(id, { x, y });
    if (this.pointers.size >= 2) {
      // A second finger turns any stroke into a two-finger pan and cancels its edits.
      const s = this.stroke;
      const revert = s && s.kind !== 'pan' ? s.before : null;
      if (revert) this.level = JSON.parse(revert);
      this.stroke = { kind: 'pan' };
      this.cursor = null;
      this.sawDrag = null;
      this.emit(!!revert);
      return;
    }
    this.message = null;
    const t = this.tileAt(x, y);
    const before = JSON.stringify(this.level);
    const tool = this.tool;
    let edited = false;
    if (tool === 'pan') this.stroke = { kind: 'pan' };
    else if (tool === 'saw') {
      this.stroke = { kind: 'saw', before, start: t, end: t };
      this.sawDrag = [t[0], t[1], t[0], t[1]];
    } else if (tool === 'room-' || tool === 'room+') {
      this.stroke = { kind: 'room', before, start: t };
      this.cursor = t;
    } else {
      edited = paintTile(this.level, tool, t[0], t[1]);
      this.stroke = { kind: 'paint', before, changed: edited, last: t };
      this.cursor = t;
    }
    this.emit(edited);
  }

  move(id: number, x: number, y: number) {
    const prev = this.pointers.get(id);
    if (!prev) return;
    this.pointers.set(id, { x, y });
    const s = this.stroke;
    if (!s) return;
    if (s.kind === 'pan') {
      const n = this.pointers.size;
      this.panBy(-(x - prev.x) / n / this.scale, -(y - prev.y) / n / this.scale);
      return;
    }
    const t = this.tileAt(x, y);
    let edited = false;
    if (s.kind === 'paint') {
      if (t[0] === s.last[0] && t[1] === s.last[1]) return;
      for (const [tx, ty] of lineTiles(s.last[0], s.last[1], t[0], t[1]).slice(1))
        edited = paintTile(this.level, this.tool, tx, ty) || edited;
      s.last = t;
      s.changed ||= edited;
      this.cursor = t;
    } else if (s.kind === 'saw') {
      s.end = t;
      this.sawDrag = [s.start[0], s.start[1], t[0], t[1]];
    } else {
      s.start = t;
      this.cursor = t;
    }
    this.emit(edited);
  }

  up(id: number) {
    this.pointers.delete(id);
    const s = this.stroke;
    if (this.pointers.size > 0 || !s) return;
    this.stroke = null;
    this.cursor = null;
    this.sawDrag = null;
    let edited = false;
    if (s.kind === 'paint' && s.changed) this.pushUndo(s.before);
    else if (s.kind === 'saw') {
      edited = addSaw(this.level, s.start[0], s.start[1], s.end[0], s.end[1]);
      if (!edited) this.message = 'No room fits there for a saw';
    } else if (s.kind === 'room') {
      const del = this.tool === 'room-';
      edited = del
        ? deleteRoomAt(this.level, s.start[0], s.start[1])
        : paintTile(this.level, 'room+', s.start[0], s.start[1]);
      if (!edited)
        this.message = del
          ? this.level.rooms.length <= 1 ? 'Can’t delete the last room' : 'Tap inside a room to delete it'
          : 'No free 32×16 space there (tap outside the existing rooms)';
    }
    if (edited && s.kind !== 'pan') this.pushUndo(s.before);
    this.emit(edited);
  }
}
