import { BlurStyle, PaintStyle, Skia, type SkCanvas, type SkFont, type SkPaint, type SkPicture } from '@shopify/react-native-skia';
import { PLAYER_H, PLAYER_W, TILE } from '../engine/constants';
import { PLATFORM_W, levelBounds, roomRect, type TileRect } from '../engine/editor';
import type { LevelDef, SawDef } from '../types';
import { COLORS, MECH } from './renderer';

const PORTAL_COLORS = ['#ff4dd2', '#4d9dff', '#ffe14d', '#4dffe1', '#ff8a4d', '#a14dff', '#4dff6a', '#ff4d6a', '#4dd2ff'];

function mk(color: string, opts: { stroke?: number; blur?: number; alpha?: number } = {}): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (opts.alpha !== undefined) p.setAlphaf(opts.alpha);
  if (opts.stroke) {
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(opts.stroke);
  }
  if (opts.blur) p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, opts.blur, true));
  return p;
}

let cache: ReturnType<typeof makePaints> | null = null;
const makePaints = () => ({
  roomBg: mk(COLORS.bg2),
  roomEdge: mk('#3a4a86', { stroke: 0.6 }),
  solid: mk('#1e2848'),
  edge: mk(COLORS.solidEdge, { stroke: 0.6 }),
  spike: mk(COLORS.spike),
  crumble: mk(COLORS.crumble),
  crumbleLine: mk('#3a2a14', { stroke: 0.5 }),
  door: mk(COLORS.door, { alpha: 0.85 }),
  doorLine: mk('#6b5410', { stroke: 0.6 }),
  key: mk(COLORS.key),
  orb: mk(COLORS.orb),
  orbGlow: mk(COLORS.orb, { blur: 3, alpha: 0.5 }),
  pad: mk(COLORS.pad),
  goal: mk(COLORS.goal),
  oneWay: mk(COLORS.solidEdge),
  switchA: mk(MECH.switchA),
  switchB: mk(MECH.switchB, { stroke: 0.8 }),
  crystal: mk(MECH.crystal),
  wind: mk(MECH.wind, { stroke: 0.7, alpha: 0.8 }),
  plat: mk('#8fa6ff'),
  platGhost: mk('#8fa6ff', { alpha: 0.3 }),
  platPath: mk('#8fa6ff', { stroke: 0.6, alpha: 0.7 }),
  goalGlow: mk(COLORS.goal, { blur: 4, alpha: 0.7 }),
  spawn: mk(COLORS.player),
  spawnRing: mk(COLORS.player, { stroke: 0.6, alpha: 0.6 }),
  portal: mk('#ffffff', { stroke: 1.1 }),
  saw: mk(COLORS.saw),
  sawGhost: mk(COLORS.saw, { alpha: 0.35 }),
  sawCore: mk('#2a0d05'),
  sawPath: mk(COLORS.saw, { stroke: 0.6, alpha: 0.7 }),
  grid: mk('#2a3566', { stroke: 0.3, alpha: 0.55 }),
  cursor: mk('#ffffff', { stroke: 0.7, alpha: 0.8 }),
  selFill: mk(COLORS.player, { alpha: 0.12 }),
  sel: mk(COLORS.player, { stroke: 0.8 }),
  paste: mk(COLORS.goal, { stroke: 0.8 }),
  pasteFill: mk(COLORS.goal, { alpha: 0.12 }),
  text: mk(COLORS.dim),
});
const getPaints = () => (cache ??= makePaints());

function drawSaw(c: SkCanvas, x: number, y: number, r: number, body: SkPaint) {
  const P = getPaints();
  c.drawCircle(x, y, r, body);
  c.drawCircle(x, y, r * 0.35, P.sawCore);
}

function drawSawDef(c: SkCanvas, s: SawDef, ox: number, oy: number) {
  const P = getPaints();
  const px = (v: number) => v * TILE;
  if (s.kind === 'orbit') {
    const cx = ox + px(s.center[0]);
    const cy = oy + px(s.center[1]);
    if (s.orbitRadius > 0) c.drawCircle(cx, cy, px(s.orbitRadius), P.sawPath);
    const a = s.phase ?? 0;
    c.drawCircle(cx, cy, 1, P.sawPath);
    drawSaw(c, cx + Math.cos(a) * px(s.orbitRadius), cy + Math.sin(a) * px(s.orbitRadius), px(s.radius), P.saw);
    return;
  }
  const pts = s.points.map(([x, y]) => [ox + px(x), oy + px(y)] as const);
  for (let i = 0; i < pts.length - 1; i++) c.drawLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], P.sawPath);
  if (s.mode === 'loop' && pts.length > 2)
    c.drawLine(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], P.sawPath);
  pts.forEach(([x, y], i) => drawSaw(c, x, y, px(s.radius), i === 0 ? P.saw : P.sawGhost));
}

/** Records every room, tile and saw of the level (world px) into one picture; rebuilt on each edit. */
export function buildEditorPicture(level: LevelDef): SkPicture {
  const P = getPaints();
  const b = levelBounds(level);
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE));
  const solid = new Set<string>();
  for (const r of level.rooms)
    r.tiles.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') solid.add(`${r.x + x},${r.y + y}`);
    });
  const isSolid = (x: number, y: number) => solid.has(`${x},${y}`);
  const spikes = Skia.PathBuilder.Make();
  for (const r of level.rooms) {
    const rr = roomRect(r);
    c.drawRect(Skia.XYWHRect(rr.x * TILE, rr.y * TILE, rr.w * TILE, rr.h * TILE), P.roomBg);
  }
  for (const r of level.rooms) {
    r.tiles.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) {
        const ch = row[tx];
        const wx = r.x + tx;
        const wy = r.y + ty;
        const x = wx * TILE;
        const y = wy * TILE;
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        if (ch === '#') {
          c.drawRect(Skia.XYWHRect(x, y, TILE, TILE), P.solid);
          if (!isSolid(wx, wy - 1)) c.drawLine(x, y + 0.3, x + TILE, y + 0.3, P.edge);
          if (!isSolid(wx, wy + 1)) c.drawLine(x, y + TILE - 0.3, x + TILE, y + TILE - 0.3, P.edge);
          if (!isSolid(wx - 1, wy)) c.drawLine(x + 0.3, y, x + 0.3, y + TILE, P.edge);
          if (!isSolid(wx + 1, wy)) c.drawLine(x + TILE - 0.3, y, x + TILE - 0.3, y + TILE, P.edge);
        } else if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') {
          for (let k = 0; k < 2; k++) {
            const o = k * 4;
            if (ch === '^') { spikes.moveTo(x + o, y + 8); spikes.lineTo(x + o + 2, y + 3); spikes.lineTo(x + o + 4, y + 8); }
            if (ch === 'v') { spikes.moveTo(x + o, y); spikes.lineTo(x + o + 2, y + 5); spikes.lineTo(x + o + 4, y); }
            if (ch === '<') { spikes.moveTo(x + 8, y + o); spikes.lineTo(x + 3, y + o + 2); spikes.lineTo(x + 8, y + o + 4); }
            if (ch === '>') { spikes.moveTo(x, y + o); spikes.lineTo(x + 5, y + o + 2); spikes.lineTo(x, y + o + 4); }
            spikes.close();
          }
        } else if (ch === '=') {
          c.drawRect(Skia.XYWHRect(x + 0.3, y + 0.3, TILE - 0.6, TILE * 0.6), P.crumble);
          c.drawLine(x + 2, y + 0.5, x + 4, y + 4, P.crumbleLine);
          c.drawLine(x + 6, y + 0.5, x + 5, y + 3.5, P.crumbleLine);
        } else if (ch === 'D') {
          c.drawRect(Skia.XYWHRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1), P.door);
          c.drawRect(Skia.XYWHRect(x + 3, y + 2.5, 2, 3), P.doorLine);
        } else if (ch === 'K') {
          c.save();
          c.translate(cx, cy);
          c.rotate(45, 0, 0);
          c.drawRect(Skia.XYWHRect(-2, -2, 4, 4), P.key);
          c.restore();
        } else if (ch === 'O') {
          c.drawCircle(cx, cy, 4, P.orbGlow);
          c.drawCircle(cx, cy, 2.6, P.orb);
        } else if (ch === 'J') {
          c.drawRect(Skia.XYWHRect(x + 0.5, y + 5, TILE - 1, 3), P.pad);
          c.drawRect(Skia.XYWHRect(x + 1.5, y + 3, TILE - 3, 1), P.pad);
        } else if (ch === 'S') {
          const sx = x + (TILE - PLAYER_W) / 2;
          const sy = y + TILE - PLAYER_H;
          c.drawRect(Skia.XYWHRect(sx - 1, sy - 1, PLAYER_W + 2, PLAYER_H + 2), P.spawnRing);
          c.drawRect(Skia.XYWHRect(sx, sy, PLAYER_W, PLAYER_H), P.spawn);
        } else if (ch === 'G') {
          const d = Skia.PathBuilder.Make();
          d.moveTo(cx, cy - 4); d.lineTo(cx + 3, cy); d.lineTo(cx, cy + 4); d.lineTo(cx - 3, cy); d.close();
          const path = d.detach();
          c.drawPath(path, P.goalGlow);
          c.drawPath(path, P.goal);
        } else if (ch === '-') {
          c.drawRect(Skia.XYWHRect(x, y, TILE, 2), P.oneWay);
          c.drawLine(x + 2, y + 2, x + 2, y + 4, P.oneWay);
          c.drawLine(x + 6, y + 2, x + 6, y + 4, P.oneWay);
        } else if (ch === '[') {
          c.drawRect(Skia.XYWHRect(x + 0.3, y + 0.3, TILE - 0.6, TILE - 0.6), P.switchA);
        } else if (ch === ']') {
          c.drawRect(Skia.XYWHRect(x + 0.8, y + 0.8, TILE - 1.6, TILE - 1.6), P.switchB);
        } else if (ch === '*') {
          const d = Skia.PathBuilder.Make();
          d.moveTo(cx, cy - 4); d.lineTo(cx + 3, cy); d.lineTo(cx, cy + 4); d.lineTo(cx - 3, cy); d.close();
          c.drawPath(d.detach(), P.crystal);
        } else if (ch === '(' || ch === ')' || ch === 'u' || ch === 'n') {
          const [dx, dy] = ch === '(' ? [-1, 0] : ch === ')' ? [1, 0] : ch === 'u' ? [0, -1] : [0, 1];
          c.drawLine(cx - dx * 2.5, cy - dy * 2.5, cx + dx * 2.5, cy + dy * 2.5, P.wind);
          c.drawLine(cx + dx * 2.5, cy + dy * 2.5, cx + dx * 0.5 - dy * 1.5, cy + dy * 0.5 + dx * 1.5, P.wind);
          c.drawLine(cx + dx * 2.5, cy + dy * 2.5, cx + dx * 0.5 + dy * 1.5, cy + dy * 0.5 - dx * 1.5, P.wind);
        } else if (ch >= '1' && ch <= '9') {
          P.portal.setColor(Skia.Color(PORTAL_COLORS[(Number(ch) - 1) % PORTAL_COLORS.length]));
          c.drawCircle(cx, cy, 3.4, P.portal);
        }
      }
    });
  }
  c.drawPath(spikes.detach(), P.spike);
  for (const r of level.rooms) for (const s of r.saws ?? []) drawSawDef(c, s, r.x * TILE, r.y * TILE);
  for (const r of level.rooms)
    for (const p of r.platforms ?? []) {
      const pts = p.points.map(([x, y]) => [(r.x + x) * TILE, (r.y + y) * TILE]);
      for (let i = 0; i < pts.length - 1; i++)
        c.drawLine(pts[i][0] + TILE / 2, pts[i][1] + TILE / 2, pts[i + 1][0] + TILE / 2, pts[i + 1][1] + TILE / 2, P.platPath);
      pts.forEach(([x, y], i) => c.drawRect(Skia.XYWHRect(x, y, p.w * TILE, TILE), i === 0 ? P.plat : P.platGhost));
    }
  for (const r of level.rooms) {
    const rr = roomRect(r);
    c.drawRect(Skia.XYWHRect(rr.x * TILE, rr.y * TILE, rr.w * TILE, rr.h * TILE), P.roomEdge);
  }
  return rec.finishRecordingAsPicture();
}

export interface EditorFrame {
  level: LevelDef;
  content: SkPicture;
  width: number;
  height: number;
  /** Screen px per world px. */
  scale: number;
  /** Camera top-left in world px. */
  camX: number;
  camY: number;
  grid: boolean;
  font: SkFont | null;
  cursor: [number, number] | null;
  sawDrag: [number, number, number, number] | null;
  platformDrag?: boolean;
  selection?: TileRect | null;
  pastePreview?: TileRect | null;
}

export function renderEditorFrame(f: EditorFrame): SkPicture {
  const P = getPaints();
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, f.width, f.height));
  c.drawColor(Skia.Color(COLORS.bg));
  c.save();
  c.scale(f.scale, f.scale);
  c.translate(-f.camX, -f.camY);
  c.drawPicture(f.content);
  const x0 = Math.floor(f.camX / TILE);
  const y0 = Math.floor(f.camY / TILE);
  const x1 = Math.ceil((f.camX + f.width / f.scale) / TILE);
  const y1 = Math.ceil((f.camY + f.height / f.scale) / TILE);
  if (f.grid) {
    for (let x = x0; x <= x1; x++) c.drawLine(x * TILE, y0 * TILE, x * TILE, y1 * TILE, P.grid);
    for (let y = y0; y <= y1; y++) c.drawLine(x0 * TILE, y * TILE, x1 * TILE, y * TILE, P.grid);
  }
  if (f.sawDrag && f.platformDrag) {
    const [ax, ay, bx0, by0] = f.sawDrag;
    const [bx, by] = ax === bx0 && ay === by0 ? [ax + 6, ay] : [bx0, by0];
    c.drawLine((ax + 0.5) * TILE, (ay + 0.5) * TILE, (bx + 0.5) * TILE, (by + 0.5) * TILE, P.platPath);
    c.drawRect(Skia.XYWHRect(ax * TILE, ay * TILE, PLATFORM_W * TILE, TILE), P.plat);
    c.drawRect(Skia.XYWHRect(bx * TILE, by * TILE, PLATFORM_W * TILE, TILE), P.platGhost);
  } else if (f.sawDrag) {
    const [ax, ay, bx, by] = f.sawDrag;
    const p = (v: number) => (v + 0.5) * TILE;
    if (ax !== bx || ay !== by) c.drawLine(p(ax), p(ay), p(bx), p(by), P.sawPath);
    else c.drawCircle(p(ax), p(ay), 2 * TILE, P.sawPath);
    drawSaw(c, p(ax), p(ay), 0.8 * TILE, P.saw);
    drawSaw(c, p(bx), p(by), 0.8 * TILE, P.sawGhost);
  }
  const rect = (r: TileRect) => Skia.XYWHRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE);
  if (f.selection) {
    c.drawRect(rect(f.selection), P.selFill);
    c.drawRect(rect(f.selection), P.sel);
  }
  if (f.pastePreview) {
    c.drawRect(rect(f.pastePreview), P.pasteFill);
    c.drawRect(rect(f.pastePreview), P.paste);
  }
  if (f.cursor) c.drawRect(Skia.XYWHRect(f.cursor[0] * TILE, f.cursor[1] * TILE, TILE, TILE), P.cursor);
  c.restore();
  if (f.font)
    for (const r of f.level.rooms) {
      const sx = (r.x * TILE - f.camX) * f.scale + 4;
      const sy = (r.y * TILE - f.camY) * f.scale + 14;
      if (sx > -60 && sx < f.width && sy > 0 && sy < f.height) c.drawText(r.id, sx, sy, P.text, f.font);
    }
  return rec.finishRecordingAsPicture();
}
