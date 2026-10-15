import {
  BlendMode, BlurStyle, ClipOp, PaintStyle, Skia, StrokeCap, TileMode,
  type SkCanvas, type SkFont, type SkPaint, type SkPath, type SkPicture,
} from '@shopify/react-native-skia';
import { PARTICLE_COLORS, type Game } from '../engine/game';
import { PLAYER_H, PLAYER_W, TILE } from '../engine/constants';
import { T } from '../engine/world';
import { formatTime } from '../engine/save';
import { MOVE_ZONE, type TouchController } from '../engine/input';

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
let paints: Paints | null = null;

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

function makePaints() {
  return {
    solid: paint(COLORS.solid),
    edge: paint(COLORS.solidEdge, { stroke: 0.6 }),
    grid: paint('#1a2140', { stroke: 0.25, alpha: 0.5 }),
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
    ghost: paint(COLORS.player),
    particle: paint('#ffffff'),
    light: paint('#ffffff', { blend: BlendMode.Plus }),
    flash: paint('#ffffff'),
    hudText: paint(COLORS.text),
    hudDim: paint(COLORS.dim),
    hudShadow: paint('#000000', { alpha: 0.55 }),
    pad1: paint('#ffffff', { alpha: 0.05 }),
    pad1On: paint(COLORS.player, { alpha: 0.16 }),
    padStroke: paint('#ffffff', { stroke: 1.5, alpha: 0.18 }),
    swipe: paint(COLORS.player, { stroke: 3 }),
    vignette: paint('#000000'),
  };
}

const getPaints = () => (paints ??= makePaints());

const solidish = (t: T) => t === T.Solid || t === T.Void;

/** Static geometry (walls, spikes) is recorded once per level into a reusable picture. */
export function buildStaticPicture(game: Game): SkPicture {
  const P = getPaints();
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
        c.drawRect(Skia.XYWHRect(x, y, TILE, TILE), P.solid);
        if (exposedU) c.drawLine(x, y + 0.3, x + TILE, y + 0.3, P.edge);
        if (exposedD) c.drawLine(x, y + TILE - 0.3, x + TILE, y + TILE - 0.3, P.edge);
        if (exposedL) c.drawLine(x + 0.3, y, x + 0.3, y + TILE, P.edge);
        if (exposedR) c.drawLine(x + TILE - 0.3, y, x + TILE - 0.3, y + TILE, P.edge);
      } else if (t >= T.SpikeUp && t <= T.SpikeRight) {
        for (let k = 0; k < 2; k++) {
          const o = k * 4;
          if (t === T.SpikeUp) { spikes.moveTo(x + o, y + 8); spikes.lineTo(x + o + 2, y + 3); spikes.lineTo(x + o + 4, y + 8); }
          if (t === T.SpikeDown) { spikes.moveTo(x + o, y); spikes.lineTo(x + o + 2, y + 5); spikes.lineTo(x + o + 4, y); }
          if (t === T.SpikeLeft) { spikes.moveTo(x + 8, y + o); spikes.lineTo(x + 3, y + o + 2); spikes.lineTo(x + 8, y + o + 4); }
          if (t === T.SpikeRight) { spikes.moveTo(x, y + o); spikes.lineTo(x + 5, y + o + 2); spikes.lineTo(x, y + o + 4); }
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
  const { game } = f;
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
    c.rotate(45 + Math.sin(t * 2) * 10, 0, 0);
    c.drawRect(Skia.XYWHRect(-2.5, -2.5, 5, 5), P.keyGlow);
    c.drawRect(Skia.XYWHRect(-2, -2, 4, 4), P.key);
    c.restore();
  });

  // Orbs
  world.orbs.forEach((o, i) => {
    if (game.orbCooldown[i] > 0) {
      c.drawCircle(o.x, o.y, 2.5, P.orbSpent);
      return;
    }
    const pulse = 2.6 + Math.sin(t * 5 + i) * 0.4;
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
      c.scale(s.r, s.r);
      c.drawPath(sp, P.saw);
      c.drawCircle(0, 0, 0.3, P.sawCore);
      c.restore();
    }
  }
}

function drawPlayer(c: SkCanvas, game: Game, P: Paints) {
  const p = game.player;
  const ready = p.dashes > 0;
  const color = ready ? COLORS.player : COLORS.playerSpent;

  for (const g of game.ghosts) {
    P.ghost.setColor(hexWithAlpha(COLORS.player, Math.max(0, g.life / 0.28) * 0.45));
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
  P.playerGlow.setColor(Skia.Color(color));
  P.player.setColor(Skia.Color(color));
  c.drawRect(rect, P.playerGlow);
  c.drawRRect(Skia.RRectXY(rect, 1, 1), P.player);
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
  const { game, width, height, font, smallFont, touch } = f;
  // Move pads
  const padH = height * MOVE_ZONE;
  const pads = touch.padState();
  const padW = Math.min(width * 0.22, 180);
  const left = Skia.RRectXY(Skia.XYWHRect(f.insets.left + 14, height - padH + 10, padW, padH - 24), 18, 18);
  const right = Skia.RRectXY(Skia.XYWHRect(width - f.insets.right - 14 - padW, height - padH + 10, padW, padH - 24), 18, 18);
  c.drawRRect(left, pads.left ? P.pad1On : P.pad1);
  c.drawRRect(right, pads.right ? P.pad1On : P.pad1);
  c.drawRRect(left, P.padStroke);
  c.drawRRect(right, P.padStroke);
  const chevron = (x: number, y: number, dir: number) => {
    const s = 12;
    c.drawLine(x + dir * s * 0.5, y - s, x - dir * s * 0.5, y, P.padStroke);
    c.drawLine(x - dir * s * 0.5, y, x + dir * s * 0.5, y + s, P.padStroke);
  };
  chevron(left.rect.x + padW / 2, left.rect.y + left.rect.height / 2, 1);
  chevron(right.rect.x + padW / 2, right.rect.y + right.rect.height / 2, -1);

  // Swipe indicator
  const sw = touch.lastSwipe;
  if (sw) {
    const age = (f.now - sw.t) / 260;
    if (age < 1) {
      P.swipe.setColor(hexWithAlpha(COLORS.player, 0.6 * (1 - age)));
      const len = 40 + age * 30;
      const n = Math.hypot(sw.dir.x, sw.dir.y) || 1;
      c.drawLine(sw.x0, sw.y0, sw.x0 + (sw.dir.x / n) * len, sw.y0 + (sw.dir.y / n) * len, P.swipe);
    }
  }

  if (!font || !smallFont) return;
  const x0 = f.insets.left + 16;
  const y0 = f.insets.top + 30;
  text(c, formatTime(game.time * 1000), x0, y0, font, P.hudText, P.hudShadow);
  text(c, `DEATHS ${game.deaths}`, x0, y0 + 20, smallFont, P.hudDim, P.hudShadow);
  if (game.heldKeys > 0) {
    P.key.setColor(Skia.Color(COLORS.key));
    text(c, `KEY x${game.heldKeys}`, x0 + 110, y0 + 20, smallFont, P.key, P.hudShadow);
  }
  const roomLabel = `${game.level.name.toUpperCase()}  ${game.world.rooms.indexOf(game.room) + 1}/${game.world.rooms.length}`;
  const lw = smallFont.measureText(roomLabel).width;
  text(c, roomLabel, width / 2 - lw / 2, f.insets.top + 22, smallFont, P.hudDim, P.hudShadow);

  const hint = game.level.rooms[game.room.index]?.hint;
  if (hint && game.phase !== 'complete') {
    const hw = smallFont.measureText(hint).width;
    text(c, hint, width / 2 - hw / 2, height * 0.3, smallFont, P.hudText, P.hudShadow);
  }
  if (game.phase === 'ready') {
    const msg = 'TOUCH TO START';
    const mw = font.measureText(msg).width;
    text(c, msg, width / 2 - mw / 2, height * 0.42, font, P.hudText, P.hudShadow);
  }
}

/** Draw one full frame (world + effects + HUD) into a picture. */
export function renderFrame(f: FrameContext): SkPicture {
  const P = getPaints();
  const { game, width, height, scale } = f;
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
  c.drawColor(Skia.Color(COLORS.bg));

  c.save();
  const shake = game.shake;
  const sx = shake ? Math.sin(f.now * 0.09) * shake * 0.6 : 0;
  const sy = shake ? Math.cos(f.now * 0.113) * shake * 0.6 : 0;
  c.scale(scale, scale);
  c.translate(-game.camera.x + sx, -game.camera.y + sy);
  c.clipRect(Skia.XYWHRect(game.camera.x - 4, game.camera.y - 4, game.view.w + 8, game.view.h + 8), ClipOp.Intersect, false);
  drawWorld(c, f, P);
  drawPlayer(c, game, P);
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
