import {
  BlendMode, BlurStyle, ClipOp, FilterMode, MipmapMode, PaintStyle, Skia, StrokeCap, TileMode,
  type SkCanvas, type SkFont, type SkImage, type SkPaint, type SkPath, type SkPicture,
} from '@shopify/react-native-skia';
import { PARTICLE_COLORS, type Game } from '../engine/game';
import { DASH_TIME, PLAYER_H, PLAYER_W, TILE } from '../engine/constants';
import { T } from '../engine/world';
import { formatTime } from '../engine/save';
import type { TouchController } from '../engine/input';
import type { Look } from '../engine/skins';
import type { ArtImages } from '../skins/art';
import { SHEETS, type PlayerAnim, type SpriteSheet } from '../skins/sheets';

export const COLORS = {
  bg: '#06070d',
  bg2: '#0c1020',
  solid: '#131a2e',
  solidEdge: '#2f3d6e',
  spike: '#ff3b6b',
  crumble: '#a07a45',
  door: '#ffd23f',
  key: '#ffd23f',
  orb: '#3dff9a',
  pad: '#ff9f1c',
  saw: '#ff6b35',
  goal: '#b388ff',
  player: '#4de8ff',
  playerSpent: '#56608a',
  text: '#e8ecff',
  dim: '#7c86b0',
};
const PORTAL_COLORS = ['#ff4dd2', '#4d9dff', '#ffe14d', '#4dffe1', '#ff8a4d', '#a14dff', '#4dff6a', '#ff4d6a', '#4dd2ff'];

type Paints = ReturnType<typeof makePaints>;
let paints: { key: string; P: Paints } | null = null;

function paint(color: string, opts: { stroke?: number; blur?: number; alpha?: number; blend?: BlendMode } = {}) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (opts.alpha !== undefined) p.setAlphaf(opts.alpha);
  if (opts.stroke) {
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(opts.stroke);
    p.setStrokeCap(StrokeCap.Round);
  }
  if (opts.blur) p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, opts.blur, true));
  if (opts.blend !== undefined) p.setBlendMode(opts.blend);
  return p;
}

function makePaints({ theme: T, player: PL }: Look) {
  const COLORS = { ...T, player: PL.color };
  return {
    solid: paint(COLORS.solid),
    edge: paint(COLORS.solidEdge, { stroke: 0.6 }),
    topEdge: paint(COLORS.solidEdge, { stroke: 1.2 }),
    mortar: paint(COLORS.solidEdge, { stroke: 0.4, alpha: 0.55 }),
    grid: paint(COLORS.grid, { stroke: 0.25, alpha: 0.5 }),
    spike: paint(COLORS.spike),
    spikeGlow: paint(COLORS.spike, { blur: 2.5, alpha: 0.55 }),
    crumble: paint(COLORS.crumble),
    crumbleLine: paint('#3a2a14', { stroke: 0.5 }),
    door: paint(COLORS.door, { alpha: 0.85 }),
    doorLine: paint('#6b5410', { stroke: 0.6 }),
    doorGlow: paint(COLORS.door, { blur: 3, alpha: 0.35 }),
    key: paint(COLORS.key),
    keyGlow: paint(COLORS.key, { blur: 4, alpha: 0.6 }),
    orb: paint(COLORS.orb),
    orbGlow: paint(COLORS.orb, { blur: 5, alpha: 0.6 }),
    orbSpent: paint(COLORS.orb, { stroke: 0.6, alpha: 0.35 }),
    crystal: paint(MECH.crystal),
    crystalGlow: paint(MECH.crystal, { blur: 5, alpha: 0.7 }),
    crystalSpent: paint(MECH.crystal, { stroke: 0.6, alpha: 0.35 }),
    switchA: paint(MECH.switchA),
    switchAOff: paint(MECH.switchA, { stroke: 0.6, alpha: 0.45 }),
    switchB: paint(MECH.switchB),
    switchBOff: paint(MECH.switchB, { stroke: 0.6, alpha: 0.45 }),
    switchLine: paint('#000000', { stroke: 0.5, alpha: 0.35 }),
    wind: paint(MECH.wind, { stroke: 0.6, alpha: 0.4 }),
    oneWay: paint(COLORS.solidEdge),
    platform: paint(COLORS.solidEdge),
    platformTop: paint(COLORS.player, { stroke: 0.8, alpha: 0.7 }),
    pad: paint(COLORS.pad),
    padGlow: paint(COLORS.pad, { blur: 3, alpha: 0.5 }),
    saw: paint(COLORS.saw),
    sawCore: paint('#2a0d05'),
    sawGlow: paint(COLORS.saw, { blur: 5, alpha: 0.6 }),
    goal: paint(COLORS.goal),
    goalGlow: paint(COLORS.goal, { blur: 7, alpha: 0.75 }),
    portal: paint('#ffffff', { stroke: 1.1 }),
    portalGlow: paint('#ffffff', { blur: 4, alpha: 0.6 }),
    player: paint(COLORS.player),
    playerGlow: paint(COLORS.player, { blur: 4, alpha: 0.8 }),
    playerStroke: paint(COLORS.player, { stroke: 0.9 }),
    art: paint('#ffffff'),
    artSpent: (() => {
      const p = paint('#ffffff');
      p.setColorFilter(Skia.ColorFilter.MakeMatrix([0.55, 0, 0, 0, 0, 0, 0.55, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 1, 0]));
      return p;
    })(),
    artGhost: paint('#ffffff'),
    ghost: paint(COLORS.player),
    particle: paint('#ffffff'),
    light: paint('#ffffff', { blend: BlendMode.Plus }),
    flash: paint('#ffffff'),
    hudText: paint(UI.text),
    hudDim: paint(UI.dim),
    hudShadow: paint('#000000', { alpha: 0.55 }),
    pad1: paint('#ffffff', { alpha: 0.05 }),
    pad1On: paint(COLORS.player, { alpha: 0.16 }),
    padStroke: paint('#ffffff', { stroke: 1.5, alpha: 0.18 }),
    swipe: paint(COLORS.player, { stroke: 3 }),
    vignette: paint('#000000'),
  };
}

const UI = { text: '#e8ecff', dim: '#7c86b0' };
/** Colours of the newer mechanics (shared by every theme, like hazards they stay readable everywhere). */
export const MECH = { crystal: '#ff7ae0', switchA: '#ff4dd2', switchB: '#4d9dff', wind: '#cfe8ff' };

const getPaints = (look: Look) => {
  const key = `${look.theme.id}/${look.player.id}`;
  if (paints?.key !== key) paints = { key, P: makePaints(look) };
  return paints.P;
};

const SPIKE_SHAPES = { sharp: { n: 2, h: 5 }, chunky: { n: 1, h: 6 }, needle: { n: 3, h: 6 } } as const;
const SPIKE_ANGLE = { [T.SpikeUp]: 0, [T.SpikeRight]: 90, [T.SpikeDown]: 180, [T.SpikeLeft]: 270 } as Record<number, number>;

/** Draws pixel art into a world rect (nearest-neighbour, so 16×16 art stays crisp). */
function drawArt(c: SkCanvas, img: SkImage, x: number, y: number, w: number, h: number, p: SkPaint | null = null) {
  c.drawImageRectOptions(
    img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(x, y, w, h), FilterMode.Nearest, MipmapMode.None, p,
  );
}

const solidish = (t: T) => t === T.Solid || t === T.Void;

/** Static geometry (walls, spikes) is recorded once per level into a reusable picture. */
export function buildStaticPicture(game: Game, look: Look, art: ArtImages = {}): SkPicture {
  const P = getPaints(look);
  const { blocks } = look.theme;
  const spikeShape = SPIKE_SHAPES[look.theme.spikes];
  const { world } = game;
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, world.w * TILE, world.h * TILE));
  // Faint background grid inside rooms
  for (const room of world.rooms) {
    const r = room.rect;
    for (let x = r.x; x <= r.x + r.w; x += TILE * 2) c.drawLine(x, r.y, x, r.y + r.h, P.grid);
    for (let y = r.y; y <= r.y + r.h; y += TILE * 2) c.drawLine(r.x, y, r.x + r.w, y, P.grid);
  }
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= world.w || y >= world.h ? T.Void : (world.grid[y * world.w + x] as T);
  const spikes = Skia.PathBuilder.Make();
  for (let ty = 0; ty < world.h; ty++)
    for (let tx = 0; tx < world.w; tx++) {
      const t = at(tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (solidish(t)) {
        // Only draw tiles adjacent to open space (deep void stays background)
        const exposedU = !solidish(at(tx, ty - 1));
        const exposedD = !solidish(at(tx, ty + 1));
        const exposedL = !solidish(at(tx - 1, ty));
        const exposedR = !solidish(at(tx + 1, ty));
        let near = exposedU || exposedD || exposedL || exposedR;
        if (!near)
          for (let dy = -2; dy <= 2 && !near; dy++)
            for (let dx = -2; dx <= 2 && !near; dx++) if (!solidish(at(tx + dx, ty + dy))) near = true;
        if (!near) continue;
        if (art.solid) {
          drawArt(c, art.solid, x, y, TILE, TILE);
          continue;
        }
        c.drawRect(Skia.XYWHRect(x, y, TILE, TILE), P.solid);
        if (blocks === 'brick') {
          const o = ty % 2 ? 2 : 6;
          c.drawLine(x, y + 4, x + TILE, y + 4, P.mortar);
          c.drawLine(x + o, y, x + o, y + 4, P.mortar);
          c.drawLine(x + ((o + 4) % 8), y + 4, x + ((o + 4) % 8), y + 8, P.mortar);
        }
        if (blocks === 'flat') {
          if (exposedU) c.drawLine(x, y + 0.6, x + TILE, y + 0.6, P.topEdge);
          continue;
        }
        if (exposedU) c.drawLine(x, y + 0.3, x + TILE, y + 0.3, P.edge);
        if (exposedD) c.drawLine(x, y + TILE - 0.3, x + TILE, y + TILE - 0.3, P.edge);
        if (exposedL) c.drawLine(x + 0.3, y, x + 0.3, y + TILE, P.edge);
        if (exposedR) c.drawLine(x + TILE - 0.3, y, x + TILE - 0.3, y + TILE, P.edge);
      } else if (t === T.OneWay) {
        c.drawRect(Skia.XYWHRect(x, y, TILE, 2), P.oneWay);
        c.drawLine(x + 2, y + 2, x + 2, y + 4, P.oneWay);
        c.drawLine(x + 6, y + 2, x + 6, y + 4, P.oneWay);
      } else if (t >= T.SpikeUp && t <= T.SpikeRight) {
        if (art.spike) {
          c.save();
          c.rotate(SPIKE_ANGLE[t], x + TILE / 2, y + TILE / 2);
          drawArt(c, art.spike, x, y, TILE, TILE);
          c.restore();
          continue;
        }
        const { n, h } = spikeShape;
        const bw = TILE / n;
        const tip = 8 - h;
        for (let k = 0; k < n; k++) {
          const o = k * bw;
          const m = o + bw / 2;
          if (t === T.SpikeUp) { spikes.moveTo(x + o, y + 8); spikes.lineTo(x + m, y + tip); spikes.lineTo(x + o + bw, y + 8); }
          if (t === T.SpikeDown) { spikes.moveTo(x + o, y); spikes.lineTo(x + m, y + h); spikes.lineTo(x + o + bw, y); }
          if (t === T.SpikeLeft) { spikes.moveTo(x + 8, y + o); spikes.lineTo(x + tip, y + m); spikes.lineTo(x + 8, y + o + bw); }
          if (t === T.SpikeRight) { spikes.moveTo(x, y + o); spikes.lineTo(x + h, y + m); spikes.lineTo(x, y + o + bw); }
          spikes.close();
        }
      }
    }
  const spikePath = spikes.detach();
  c.drawPath(spikePath, P.spikeGlow);
  c.drawPath(spikePath, P.spike);
  return rec.finishRecordingAsPicture();
}

export interface FrameContext {
  game: Game;
  staticPic: SkPicture;
  width: number;
  height: number;
  scale: number;
  font: SkFont | null;
  smallFont: SkFont | null;
  touch: TouchController;
  insets: { left: number; right: number; top: number };
  now: number;
  look: Look;
  art: ArtImages;
}

const hexWithAlpha = (hex: string, a: number) => {
  const c = Skia.Color(hex);
  return Skia.Color(`rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`);
};

let sawPath: SkPath | null = null;
const getSawPath = () => {
  if (sawPath) return sawPath;
  const p = Skia.PathBuilder.Make();
  const teeth = 10;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : 0.78;
    if (i === 0) p.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  p.close();
  sawPath = p.detach();
  return sawPath;
};

function drawWorld(c: SkCanvas, f: FrameContext, P: Paints) {
  const { game, art } = f;
  const { world } = game;
  const t = game.worldTime;
  c.drawPicture(f.staticPic);

  // Crumbles
  world.crumbles.forEach((cr, i) => {
    const s = game.crumbleState[i];
    if (s === 2) return;
    const jx = s === 1 ? Math.sin(t * 80 + i) * 0.6 : 0;
    const x = cr.tx * TILE + jx;
    const y = cr.ty * TILE;
    if (art.crumble) return drawArt(c, art.crumble, x, y, TILE, TILE);
    c.drawRect(Skia.XYWHRect(x + 0.3, y + 0.3, TILE - 0.6, TILE * 0.6), P.crumble);
    c.drawLine(x + 2, y + 0.5, x + 4, y + 4, P.crumbleLine);
    c.drawLine(x + 6, y + 0.5, x + 5, y + 3.5, P.crumbleLine);
  });

  // Doors
  world.doors.forEach((d, gi) => {
    if (game.doorsOpen[gi]) return;
    for (const i of d.tiles) {
      const x = (i % world.w) * TILE;
      const y = Math.floor(i / world.w) * TILE;
      if (art.door) {
        drawArt(c, art.door, x, y, TILE, TILE);
        continue;
      }
      c.drawRect(Skia.XYWHRect(x, y, TILE, TILE), P.doorGlow);
      c.drawRect(Skia.XYWHRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1), P.door);
      c.drawRect(Skia.XYWHRect(x + 3, y + 2.5, 2, 3), P.doorLine);
    }
  });

  // Pads
  world.pads.forEach((pad, i) => {
    const x = pad.tx * TILE;
    const y = pad.ty * TILE;
    const press = game.padFlash[i] > 0 ? 1.5 : 0;
    if (art.pad) return drawArt(c, art.pad, x, y + press * 0.3, TILE, TILE);
    c.drawRect(Skia.XYWHRect(x + 0.5, y + 5 + press * 0.3, TILE - 1, 3 - press * 0.3), P.padGlow);
    c.drawRect(Skia.XYWHRect(x + 0.5, y + 5 + press * 0.3, TILE - 1, 3 - press * 0.3), P.pad);
    c.drawRect(Skia.XYWHRect(x + 1.5, y + 4 - (press ? 0 : 1), TILE - 3, 1), P.pad);
  });

  // Keys
  world.keys.forEach((k, i) => {
    if (game.keysTaken[i]) return;
    const bob = Math.sin(t * 3 + i) * 1.2;
    c.save();
    c.translate(k.x, k.y + bob);
    if (art.key) drawArt(c, art.key, -TILE / 2, -TILE / 2, TILE, TILE);
    else {
      c.rotate(45 + Math.sin(t * 2) * 10, 0, 0);
      c.drawRect(Skia.XYWHRect(-2.5, -2.5, 5, 5), P.keyGlow);
      c.drawRect(Skia.XYWHRect(-2, -2, 4, 4), P.key);
    }
    c.restore();
  });

  // Orbs
  world.orbs.forEach((o, i) => {
    if (game.orbCooldown[i] > 0) {
      c.drawCircle(o.x, o.y, 2.5, P.orbSpent);
      return;
    }
    const pulse = 2.6 + Math.sin(t * 5 + i) * 0.4;
    if (art.orb) return drawArt(c, art.orb, o.x - pulse * 1.5, o.y - pulse * 1.5, pulse * 3, pulse * 3);
    c.drawCircle(o.x, o.y, pulse + 1.5, P.orbGlow);
    c.drawCircle(o.x, o.y, pulse, P.orb);
  });

  // Portals
  world.portals.forEach((p) => {
    const color = PORTAL_COLORS[(Number(p.id) - 1) % PORTAL_COLORS.length];
    P.portal.setColor(Skia.Color(color));
    P.portalGlow.setColor(Skia.Color(color));
    const r = 3.6 + Math.sin(t * 4) * 0.4;
    c.drawCircle(p.x, p.y, r + 1, P.portalGlow);
    c.save();
    c.translate(p.x, p.y);
    c.rotate((t * 220) % 360, 0, 0);
    c.drawArc(Skia.XYWHRect(-r, -r, r * 2, r * 2), 0, 260, false, P.portal);
    c.restore();
  });

  // Goal crystal
  if (world.goal) {
    const g = world.goal;
    const bob = Math.sin(t * 2.5) * 1.5;
    if (art.goal) {
      drawArt(c, art.goal, g.x - 5, g.y - 5 + bob, 10, 10);
      return;
    }
    const b = Skia.PathBuilder.Make();
    b.moveTo(g.x, g.y - 5 + bob);
    b.lineTo(g.x + 3.5, g.y + bob);
    b.lineTo(g.x, g.y + 5 + bob);
    b.lineTo(g.x - 3.5, g.y + bob);
    b.close();
    const path = b.detach();
    c.drawPath(path, P.goalGlow);
    c.drawPath(path, P.goal);
  }

  // Switch blocks
  for (const i of world.switches) {
    const x = (i % world.w) * TILE;
    const y = Math.floor(i / world.w) * TILE;
    const b = world.grid[i] === T.SwitchB;
    if (b === game.switchFlipped) {
      c.drawRect(Skia.XYWHRect(x, y, TILE, TILE), b ? P.switchB : P.switchA);
      c.drawRect(Skia.XYWHRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3), P.switchLine);
    } else c.drawRect(Skia.XYWHRect(x + 0.8, y + 0.8, TILE - 1.6, TILE - 1.6), b ? P.switchBOff : P.switchAOff);
  }

  // Wind streaks drift along the wind
  world.winds.forEach((w, i) => {
    const s = ((t * 24 + i * 3.7) % TILE + TILE) % TILE;
    const x = w.tx * TILE;
    const y = w.ty * TILE;
    const o = (i * 5) % 7 + 0.5;
    if (w.dir.x) {
      const sx = w.dir.x > 0 ? x + s : x + TILE - s;
      c.drawLine(sx, y + o, sx + w.dir.x * 2.5, y + o, P.wind);
    } else {
      const sy = w.dir.y > 0 ? y + s : y + TILE - s;
      c.drawLine(x + o, sy, x + o, sy + w.dir.y * 2.5, P.wind);
    }
  });

  // Crystals
  world.crystals.forEach((o, i) => {
    const r = game.crystalCooldown[i] > 0 ? 2.6 : 3.4 + Math.sin(t * 6 + i) * 0.3;
    const d = Skia.PathBuilder.Make();
    d.moveTo(o.x, o.y - r * 1.3); d.lineTo(o.x + r, o.y); d.lineTo(o.x, o.y + r * 1.3); d.lineTo(o.x - r, o.y); d.close();
    const path = d.detach();
    if (game.crystalCooldown[i] > 0) return c.drawPath(path, P.crystalSpent);
    c.drawPath(path, P.crystalGlow);
    c.drawPath(path, P.crystal);
  });

  // Moving platforms (current room, plus neighbours seen during transitions)
  for (const room of world.rooms) {
    if (!room.platforms.length) continue;
    const r = room.rect;
    if (r.x > game.camera.x + game.view.w || r.x + r.w < game.camera.x || r.y > game.camera.y + game.view.h || r.y + r.h < game.camera.y) continue;
    for (const pr of room === game.room ? game.plats : game.platRects(room)) {
      if (art.solid) for (let k = 0; k < pr.w; k += TILE) drawArt(c, art.solid, pr.x + k, pr.y, TILE, TILE);
      else c.drawRect(Skia.XYWHRect(pr.x, pr.y, pr.w, pr.h), P.platform);
      c.drawLine(pr.x, pr.y + 0.4, pr.x + pr.w, pr.y + 0.4, P.platformTop);
    }
  }

  // Saws (current room + neighbours visible during transitions)
  const sp = getSawPath();
  for (const room of world.rooms) {
    if (!room.saws.length) continue;
    const r = room.rect;
    if (r.x > game.camera.x + game.view.w || r.x + r.w < game.camera.x || r.y > game.camera.y + game.view.h || r.y + r.h < game.camera.y) continue;
    for (const def of room.saws) {
      const s = game.sawState(def, room);
      c.save();
      c.translate(s.x, s.y);
      c.drawCircle(0, 0, s.r * 1.05, P.sawGlow);
      c.rotate((s.angle * 57.3) % 360, 0, 0);
      if (art.saw) {
        drawArt(c, art.saw, -s.r, -s.r, s.r * 2, s.r * 2);
        c.restore();
        continue;
      }
      c.scale(s.r, s.r);
      c.drawPath(sp, P.saw);
      c.drawCircle(0, 0, 0.3, P.sawCore);
      c.restore();
    }
  }
}

/** Picks the animation frame for a sprite-sheet player from its movement state. */
function sheetFrame(game: Game, sheet: SpriteSheet) {
  const p = game.player;
  let anim: PlayerAnim = 'idle';
  let frame = 0;
  if (p.dashTimer > 0) {
    anim = 'dash';
    frame = Math.floor((1 - p.dashTimer / DASH_TIME) * sheet.anims.dash.frames);
  } else if (!p.onGround) {
    anim = 'air';
    frame = p.vy < 0 ? 0 : 1;
  } else if (Math.abs(p.vx) > 5) {
    anim = 'run';
  }
  const a = sheet.anims[anim];
  if (anim === 'idle' || anim === 'run') frame = Math.floor(game.worldTime * a.fps);
  frame = anim === 'dash' || anim === 'air' ? Math.min(frame, a.frames - 1) : frame % a.frames;
  return Skia.XYWHRect(frame * sheet.cellW, a.row * sheet.cellH, sheet.cellW, sheet.cellH);
}

/** Draws a sheet cell standing on (cx, footY), mirrored when facing left. */
function drawSprite(
  c: SkCanvas, img: SkImage, src: ReturnType<typeof sheetFrame>, sheet: SpriteSheet,
  cx: number, footY: number, facing: number, sx: number, sy: number, p: SkPaint,
) {
  // Sprites get a softer squash & stretch than the plain block, or detailed art looks smeared.
  const w = (sheet.cellW / sheet.density) * (1 + (sx - 1) * 0.35);
  const h = (sheet.cellH / sheet.density) * (1 + (sy - 1) * 0.35);
  c.save();
  c.translate(cx, footY);
  if (facing < 0) c.scale(-1, 1);
  c.drawImageRectOptions(img, src, Skia.XYWHRect(-w / 2, -h, w, h), FilterMode.Nearest, MipmapMode.None, p);
  c.restore();
}

function drawPlayer(c: SkCanvas, game: Game, P: Paints, { player: skin }: Look, art: ArtImages) {
  const p = game.player;
  const ready = p.dashes > 0;
  const color = ready ? skin.color : skin.spentColor;
  const sheet = skin.art && art.player ? SHEETS[skin.art] : undefined;

  if (sheet && art.player) {
    const src = Skia.XYWHRect(sheet.anims.dash.frames > 1 ? sheet.cellW : 0, sheet.anims.dash.row * sheet.cellH, sheet.cellW, sheet.cellH);
    for (const g of game.ghosts) {
      const a = Math.max(0, g.life / 0.28) * 0.5;
      P.artGhost.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color(hexWithAlpha(skin.trail ?? skin.color, a)), BlendMode.SrcIn));
      drawSprite(c, art.player, src, sheet, g.x + PLAYER_W / 2, g.y + PLAYER_H, p.facing, g.sx, g.sy, P.artGhost);
    }
  }
  for (const g of sheet ? [] : game.ghosts) {
    P.ghost.setColor(hexWithAlpha(skin.trail ?? skin.color, Math.max(0, g.life / 0.28) * 0.45));
    c.drawRect(Skia.XYWHRect(g.x, g.y, PLAYER_W, PLAYER_H), P.ghost);
  }
  if (game.phase === 'dead') return;

  const cx = p.x + PLAYER_W / 2;
  const cy = p.y + PLAYER_H / 2;
  // Dynamic light around the player (additive radial gradient)
  P.light.setShader(
    Skia.Shader.MakeRadialGradient({ x: cx, y: cy }, 46, [hexWithAlpha(color, 0.16), hexWithAlpha(color, 0)], null, TileMode.Clamp),
  );
  c.drawCircle(cx, cy, 46, P.light);

  const w = PLAYER_W * p.scaleX;
  const h = PLAYER_H * p.scaleY;
  const rect = Skia.XYWHRect(cx - w / 2, p.y + PLAYER_H - h, w, h);
  if (sheet && art.player) {
    drawSprite(c, art.player, sheetFrame(game, sheet), sheet, cx, p.y + PLAYER_H, p.facing, p.scaleX, p.scaleY, ready ? P.art : P.artSpent);
    return;
  }
  if (art.player) {
    // Art is drawn a bit larger than the 6×6 hitbox so 16×16 sprites read well; it faces right.
    const aw = w * (TILE / PLAYER_W);
    const ah = h * (TILE / PLAYER_H);
    P.art.setAlphaf(ready ? 1 : 0.5);
    c.save();
    if (p.facing < 0) c.scale(-1, 1);
    const ax = p.facing < 0 ? -(cx + aw / 2) : cx - aw / 2;
    drawArt(c, art.player, ax, p.y + PLAYER_H - ah, aw, ah, P.art);
    c.restore();
    return;
  }
  P.playerGlow.setColor(Skia.Color(color));
  P.player.setColor(Skia.Color(color));
  P.playerStroke.setColor(Skia.Color(color));
  c.drawRect(rect, P.playerGlow);
  if (skin.shape === 'hollow') {
    P.player.setAlphaf(0.25);
    c.drawRRect(Skia.RRectXY(rect, 1, 1), P.player);
    P.player.setAlphaf(1);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(rect.x + 0.45, rect.y + 0.45, w - 0.9, h - 0.9), 1, 1), P.playerStroke);
  } else {
    const r = skin.shape === 'round' ? Math.min(w, h) * 0.45 : 1;
    c.drawRRect(Skia.RRectXY(rect, r, r), P.player);
  }
  // eye
  P.hudShadow.setAlphaf(0.7);
  c.drawRect(Skia.XYWHRect(cx + p.facing * 1.2 - 0.6, p.y + PLAYER_H - h + h * 0.3, 1.2, 1.6), P.hudShadow);
}

function drawParticles(c: SkCanvas, game: Game, P: Paints) {
  for (const pt of game.particles) {
    P.particle.setColor(hexWithAlpha(PARTICLE_COLORS[pt.color] ?? '#ffffff', Math.min(1, pt.life / pt.maxLife + 0.15)));
    c.drawRect(Skia.XYWHRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size), P.particle);
  }
}

function text(c: SkCanvas, s: string, x: number, y: number, font: SkFont, P: SkPaint, shadow: SkPaint) {
  c.drawText(s, x + 1.5, y + 1.5, shadow, font);
  c.drawText(s, x, y, P, font);
}

function drawHud(c: SkCanvas, f: FrameContext, P: Paints) {
  const { game, width, height, font, smallFont } = f;
  if (!font || !smallFont) return;
  const x0 = f.insets.left + 16;
  const y0 = f.insets.top + 30;
  text(c, formatTime(game.time * 1000), x0, y0, font, P.hudText, P.hudShadow);
  text(c, `DEATHS ${game.deaths}`, x0, y0 + 20, smallFont, P.hudDim, P.hudShadow);
  if (game.heldKeys > 0) {
    P.key.setColor(Skia.Color(f.look.theme.key));
    text(c, `KEY x${game.heldKeys}`, x0 + 110, y0 + 20, smallFont, P.key, P.hudShadow);
  }
  const roomLabel = `${game.level.name.toUpperCase()}  ${game.world.rooms.indexOf(game.room) + 1}/${game.world.rooms.length}`;
  const lw = textWidth(smallFont, roomLabel);
  text(c, roomLabel, width / 2 - lw / 2, f.insets.top + 22, smallFont, P.hudDim, P.hudShadow);

  const hint = game.level.rooms[game.room.index]?.hint;
  if (hint && game.phase !== 'complete') {
    const hw = textWidth(smallFont, hint);
    text(c, hint, width / 2 - hw / 2, height * 0.3, smallFont, P.hudText, P.hudShadow);
  }
  if (game.phase === 'ready') {
    const msg = f.touch.autoRun ? 'TAP LEFT OR RIGHT TO START' : 'TOUCH TO START';
    const mw = textWidth(font, msg);
    text(c, msg, width / 2 - mw / 2, height * 0.42, font, P.hudText, P.hudShadow);
  }
}

function textWidth(font: SkFont, s: string) {
  let w = 0;
  for (const g of font.getGlyphWidths(font.getGlyphIDs(s))) w += g;
  return w;
}

/** Draw one full frame (world + effects + HUD) into a picture. */
export function renderFrame(f: FrameContext): SkPicture {
  const P = getPaints(f.look);
  const { game, width, height, scale } = f;
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
  c.drawColor(Skia.Color(f.look.theme.bg));

  c.save();
  const shake = game.shake;
  const sx = shake ? Math.sin(f.now * 0.09) * shake * 0.6 : 0;
  const sy = shake ? Math.cos(f.now * 0.113) * shake * 0.6 : 0;
  c.scale(scale, scale);
  c.translate(-game.camera.x + sx, -game.camera.y + sy);
  c.clipRect(Skia.XYWHRect(game.camera.x - 4, game.camera.y - 4, game.view.w + 8, game.view.h + 8), ClipOp.Intersect, false);
  drawWorld(c, f, P);
  drawPlayer(c, game, P, f.look, f.art);
  drawParticles(c, game, P);
  c.restore();

  if (game.flash > 0) {
    P.flash.setAlphaf(Math.min(0.5, game.flash));
    c.drawRect(Skia.XYWHRect(0, 0, width, height), P.flash);
  }
  // Vignette
  P.vignette.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: width / 2, y: height / 2 }, Math.max(width, height) * 0.75,
      [Skia.Color('rgba(0,0,0,0)'), Skia.Color('rgba(0,0,0,0.55)')], [0.55, 1], TileMode.Clamp,
    ),
  );
  c.drawRect(Skia.XYWHRect(0, 0, width, height), P.vignette);
  drawHud(c, f, P);
  return rec.finishRecordingAsPicture();
}
