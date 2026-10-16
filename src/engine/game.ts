import type { GameEvent, InputState, LevelDef, Rect, SawDef, Vec2 } from '../types';
import * as C from './constants';
import { approach, circleRect, clamp, easeInOut, lerp, makeRng, overlaps } from './math';
import { buildWorld, roomAt, T, tileAt, type Room, type World } from './world';

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: number; gravity: number;
}

export interface Ghost { x: number; y: number; life: number; sx: number; sy: number }

export type Phase = 'ready' | 'playing' | 'dead' | 'respawning' | 'transition' | 'complete';

export interface Player {
  x: number; y: number; vx: number; vy: number;
  facing: number;
  onGround: boolean;
  wallDir: number;
  dashes: number;
  dashTimer: number;
  dashDir: Vec2;
  varJumpTimer: number;
  varJumpSpeed: number;
  coyote: number;
  jumpBuffer: number;
  dashBuffer: number;
  bufferedDash: Vec2 | null;
  forceMoveTimer: number;
  forceMoveDir: number;
  scaleX: number;
  scaleY: number;
  portalLock: number;
  /** Auto-run: stays put after (re)spawning until the first jump/dash input. */
  running: boolean;
  /** Auto-run: released a wall with a down-swipe; no cling or run until landing. */
  wallDrop: boolean;
  wallDropDir: number;
}

export interface GameOptions {
  /** Player runs in the facing direction by itself; walls flip it via wall jumps. */
  autoRun?: boolean;
}

interface Snapshot { heldKeys: number; keysTaken: boolean[]; doorsOpen: boolean[] }

interface Camera { x: number; y: number }

export interface SawState { x: number; y: number; r: number; angle: number }

const PLAYER_COLOR = 0;
const KEY_COLOR = 1;
const ORB_COLOR = 2;
const DUST_COLOR = 3;
const SPIKE_COLOR = 4;
const PAD_COLOR = 5;

export const PARTICLE_COLORS = ['#4de8ff', '#ffd23f', '#3dff9a', '#8b93b8', '#ff3b6b', '#ff9f1c'];

export class Game {
  readonly level: LevelDef;
  readonly autoRun: boolean;
  readonly world: World;
  player: Player;
  phase: Phase = 'ready';
  room: Room;
  camera: Camera = { x: 0, y: 0 };
  view = { w: 32 * C.TILE, h: C.VIEW_TILES_H * C.TILE };

  /** Speedrun timer in seconds (fixed-step accumulated → deterministic ms). */
  time = 0;
  /** Simulation clock used by moving hazards and animations. */
  worldTime = 0;
  deaths = 0;
  heldKeys = 0;
  keysTaken: boolean[];
  doorsOpen: boolean[];
  orbCooldown: number[];
  crumbleTimer: number[];
  crumbleState: Uint8Array; // 0 idle, 1 shaking, 2 gone
  padFlash: number[];

  particles: Particle[] = [];
  ghosts: Ghost[] = [];
  shake = 0;
  flash = 0;
  events: GameEvent[] = [];

  private checkpoint: Vec2;
  private snapshot: Snapshot;
  private phaseTimer = 0;
  private freeze = 0;
  private ghostTimer = 0;
  private lastJumpPresses = 0;
  private transition = { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, t: 0 };
  private rng = makeRng(1337);

  constructor(level: LevelDef, opts: GameOptions = {}) {
    this.level = level;
    this.autoRun = !!opts.autoRun;
    this.world = buildWorld(level);
    this.room = this.world.rooms[0];
    this.checkpoint = { ...this.world.start };
    this.keysTaken = this.world.keys.map(() => false);
    this.doorsOpen = this.world.doors.map(() => false);
    this.orbCooldown = this.world.orbs.map(() => 0);
    this.crumbleTimer = this.world.crumbles.map(() => 0);
    this.crumbleState = new Uint8Array(this.world.crumbles.length);
    this.padFlash = this.world.pads.map(() => 0);
    this.player = this.freshPlayer(this.checkpoint);
    this.snapshot = this.takeSnapshot();
    this.snapCamera();
  }

  setViewport(widthPx: number, heightPx: number) {
    const scale = heightPx / (C.VIEW_TILES_H * C.TILE);
    this.view = { w: widthPx / scale, h: C.VIEW_TILES_H * C.TILE };
    this.snapCamera();
    return scale;
  }

  get playerRect(): Rect {
    const p = this.player;
    return { x: p.x, y: p.y, w: C.PLAYER_W, h: C.PLAYER_H };
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Advance one fixed simulation step. */
  step(input: InputState, dt = C.FIXED_DT) {
    this.updateEffects(dt);
    if (this.phase === 'complete') return;

    if (this.phase === 'transition') {
      this.transition.t += dt / C.ROOM_TRANSITION_TIME;
      const k = easeInOut(Math.min(1, this.transition.t));
      this.camera.x = lerp(this.transition.from.x, this.transition.to.x, k);
      this.camera.y = lerp(this.transition.from.y, this.transition.to.y, k);
      if (this.transition.t >= 1) this.phase = 'playing';
      this.time += dt;
      this.lastJumpPresses = input.jumpPresses;
      input.faceQueue = 0;
      return;
    }

    if (this.phase === 'ready') {
      const idle = (this.autoRun || input.moveX === 0) && input.jumpPresses === this.lastJumpPresses && !input.dashQueue;
      if (idle && !input.faceQueue) return;
      this.phase = 'playing';
    }

    this.worldTime += dt;
    if (this.phase !== 'playing') {
      this.time += dt;
      this.phaseTimer -= dt;
      this.lastJumpPresses = input.jumpPresses;
      input.dashQueue = null;
      input.faceQueue = 0;
      if (this.phase === 'dead' && this.phaseTimer <= 0) this.respawn();
      else if (this.phase === 'respawning' && this.phaseTimer <= 0) this.phase = 'playing';
      this.updateWorldObjects(dt);
      return;
    }

    this.time += dt;
    if (this.freeze > 0) {
      this.freeze -= dt;
      this.readInput(input);
      return;
    }
    this.readInput(input);
    this.updatePlayer(input, dt);
    this.updateWorldObjects(dt);
    if (this.phase === 'playing') this.interact();
    if (this.phase === 'playing') this.checkRoom();
    if (this.phase === 'playing') this.followCamera(dt);
  }

  // ---------------------------------------------------------------- input

  private readInput(input: InputState) {
    const p = this.player;
    if (input.jumpPresses !== this.lastJumpPresses) {
      this.lastJumpPresses = input.jumpPresses;
      p.jumpBuffer = C.JUMP_BUFFER_TIME;
      p.running = true;
    }
    if (input.faceQueue) {
      if (this.autoRun) this.face(input.faceQueue);
      input.faceQueue = 0;
    }
    if (input.dashQueue) {
      p.running = true;
      p.bufferedDash = input.dashQueue;
      p.dashBuffer = C.DASH_BUFFER_TIME;
      input.dashQueue = null;
    }
  }

  /** Auto-run direction tap: start/keep running that way, never jumps. */
  private face(dir: number) {
    const p = this.player;
    const flip = p.running && p.facing !== dir;
    p.facing = dir;
    p.running = true;
    p.wallDrop = false;
    p.forceMoveTimer = 0;
    if (flip && p.onGround) {
      p.vx = dir * C.RUN_SPEED;
      p.scaleX = 0.8;
      p.scaleY = 1.15;
    }
  }

  // --------------------------------------------------------------- player

  private freshPlayer(pos: Vec2): Player {
    return {
      x: pos.x, y: pos.y, vx: 0, vy: 0, facing: this.autoRun ? this.openSide(pos) : 1, onGround: true, wallDir: 0,
      dashes: 1, dashTimer: 0, dashDir: { x: 1, y: 0 }, varJumpTimer: 0, varJumpSpeed: 0,
      coyote: 0, jumpBuffer: 0, dashBuffer: 0, bufferedDash: null, forceMoveTimer: 0, forceMoveDir: 0,
      scaleX: 1, scaleY: 1, portalLock: -1, running: !this.autoRun, wallDrop: false, wallDropDir: 0,
    };
  }

  /** Direction with more free run-way on the spawn row (auto-run starts that way). */
  private openSide(pos: Vec2): number {
    const tx = Math.floor((pos.x + C.PLAYER_W / 2) / C.TILE);
    const ty = Math.floor((pos.y + C.PLAYER_H / 2) / C.TILE);
    const run = (dir: number) => {
      let n = 0;
      while (n < 64 && !this.isSolidTile(tx + dir * (n + 1), ty)) n++;
      return n;
    };
    return run(-1) > run(1) ? -1 : 1;
  }

  private updatePlayer(input: InputState, dt: number) {
    const p = this.player;
    const wasGround = p.onGround;
    p.onGround = p.vy >= 0 && this.solidRect(p.x, p.y + 1, C.PLAYER_W, C.PLAYER_H);
    p.wallDir = p.onGround ? 0 : this.wallDirAt(1);

    if (p.onGround) {
      p.coyote = C.COYOTE_TIME;
      if (p.dashTimer <= 0) p.dashes = 1;
      if (!wasGround) {
        p.scaleX = 1.35;
        p.scaleY = 0.65;
        this.events.push({ type: 'land' });
        this.burst(p.x + C.PLAYER_W / 2, p.y + C.PLAYER_H, 4, DUST_COLOR, 30, -Math.PI / 2, Math.PI * 0.8);
      }
      this.touchCrumbleBelow();
      if (p.wallDrop) {
        p.wallDrop = false;
        p.facing = -p.wallDropDir;
      }
    } else {
      p.coyote -= dt;
    }
    if (p.wallDir !== 0 && p.dashTimer <= 0) {
      p.dashes = 1;
      this.touchCrumbleSide(p.wallDir);
    }

    p.jumpBuffer -= dt;
    p.dashBuffer -= dt;
    p.forceMoveTimer -= dt;
    if (input.moveX !== 0 && !this.autoRun) p.facing = input.moveX;

    // Dash start (auto-run: a straight down swipe on a wall is a wall drop instead)
    const swipe = p.dashBuffer > 0 ? p.bufferedDash : null;
    if (swipe && this.autoRun && swipe.x === 0 && swipe.y > 0 && p.wallDir !== 0 && p.dashTimer <= 0) {
      this.wallDrop();
      p.bufferedDash = null;
      p.dashBuffer = 0;
    } else if (swipe && p.dashes > 0) {
      this.startDash(swipe);
      p.bufferedDash = null;
      p.dashBuffer = 0;
    }

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      // Grounded dash-jump keeps the dash's horizontal momentum.
      if (p.jumpBuffer > 0 && p.coyote > 0 && p.dashDir.y >= 0) {
        p.dashTimer = 0;
        this.jump();
      } else if (p.dashTimer <= 0) {
        const len = Math.hypot(p.dashDir.x, p.dashDir.y) || 1;
        p.vx = p.vx === 0 ? 0 : (p.dashDir.x / len) * C.DASH_END_SPEED;
        p.vy = p.vy === 0 ? 0 : (p.dashDir.y / len) * C.DASH_END_SPEED;
        if (p.vy < 0) p.vy *= C.DASH_UP_END_MULT;
      } else {
        this.spawnGhost(dt);
      }
    }

    if (p.dashTimer <= 0) {
      const moveX = p.forceMoveTimer > 0 ? p.forceMoveDir : this.autoRun ? (p.running && !p.wallDrop ? p.facing : 0) : input.moveX;
      const target = moveX * C.RUN_SPEED;
      let rate: number;
      if (Math.abs(p.vx) > C.RUN_SPEED && Math.sign(p.vx) === moveX) rate = C.OVERSPEED_DECEL;
      else if (moveX === 0) rate = p.onGround ? C.GROUND_DECEL : C.AIR_DECEL;
      else rate = p.onGround ? C.GROUND_ACCEL : C.AIR_ACCEL;
      p.vx = approach(p.vx, target, rate * dt);

      let maxFall = C.MAX_FALL;
      const clinging = p.wallDir !== 0 && p.vy >= 0 && (this.autoRun ? !p.wallDrop : moveX === p.wallDir);
      if (clinging) maxFall = C.WALL_SLIDE_MAX;
      const g = input.jumpHeld && Math.abs(p.vy) < C.HALF_GRAV_THRESHOLD ? C.GRAVITY * 0.5 : C.GRAVITY;
      p.vy = p.vy > maxFall ? approach(p.vy, maxFall, C.GRAVITY * 2 * dt) : approach(p.vy, maxFall, g * dt);
      if (clinging && this.rng() < 0.25)
        this.burst(p.x + (p.wallDir > 0 ? C.PLAYER_W : 0), p.y + C.PLAYER_H, 1, DUST_COLOR, 12, -Math.PI / 2, 1);

      if (p.varJumpTimer > 0) {
        if (input.jumpHeld) p.vy = Math.min(p.vy, p.varJumpSpeed);
        else p.varJumpTimer = 0;
        p.varJumpTimer -= dt;
      }

      if (p.jumpBuffer > 0) {
        if (p.coyote > 0) this.jump();
        else {
          const wall = this.wallDirAt(C.WALL_JUMP_CHECK);
          if (wall !== 0) this.wallJump(wall);
        }
      }
    }

    p.scaleX = approach(p.scaleX, 1, 4 * dt);
    p.scaleY = approach(p.scaleY, 1, 4 * dt);
    if (Math.abs(p.vx) > C.RUN_SPEED * 1.3 && p.dashTimer <= 0) this.spawnGhost(dt);

    this.moveX(p.vx * dt);
    this.moveY(p.vy * dt);
  }

  private jump() {
    const p = this.player;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.vy = C.JUMP_SPEED;
    p.varJumpSpeed = p.vy;
    p.varJumpTimer = C.VAR_JUMP_TIME;
    p.scaleX = 0.7;
    p.scaleY = 1.3;
    this.events.push({ type: 'jump' });
    this.burst(p.x + C.PLAYER_W / 2, p.y + C.PLAYER_H, 5, DUST_COLOR, 35, -Math.PI / 2, Math.PI);
  }

  private wallJump(wall: number) {
    const p = this.player;
    p.jumpBuffer = 0;
    p.wallDrop = false;
    p.vx = -wall * C.WALL_JUMP_H;
    p.vy = C.JUMP_SPEED;
    p.varJumpSpeed = p.vy;
    p.varJumpTimer = C.VAR_JUMP_TIME;
    p.forceMoveTimer = C.WALL_JUMP_FORCE_TIME;
    p.forceMoveDir = -wall;
    p.facing = -wall;
    p.scaleX = 0.75;
    p.scaleY = 1.25;
    this.events.push({ type: 'walljump' });
    this.burst(p.x + (wall > 0 ? C.PLAYER_W : 0), p.y + C.PLAYER_H / 2, 5, DUST_COLOR, 40, wall > 0 ? Math.PI : 0, 1.4);
  }

  private startDash(dir: Vec2) {
    const p = this.player;
    let dx = dir.x;
    const dy = dir.y;
    if (dx === 0 && dy === 0) dx = p.facing;
    const len = Math.hypot(dx, dy);
    p.dashes -= 1;
    p.dashTimer = C.DASH_TIME;
    p.dashDir = { x: dx, y: dy };
    p.vx = (dx / len) * C.DASH_SPEED;
    p.vy = (dy / len) * C.DASH_SPEED;
    p.varJumpTimer = 0;
    p.forceMoveTimer = 0;
    p.wallDrop = false;
    if (dx !== 0) p.facing = Math.sign(dx);
    p.scaleX = dx !== 0 && dy === 0 ? 1.4 : dy !== 0 && dx === 0 ? 0.7 : 1.1;
    p.scaleY = dx !== 0 && dy === 0 ? 0.7 : dy !== 0 && dx === 0 ? 1.4 : 1.1;
    this.freeze = C.DASH_FREEZE;
    this.shake = Math.max(this.shake, 2.2);
    this.events.push({ type: 'dash' });
    this.burst(p.x + C.PLAYER_W / 2, p.y + C.PLAYER_H / 2, 8, PLAYER_COLOR, 60, Math.atan2(-dy, -dx), 1.6);
  }

  private wallDrop() {
    const p = this.player;
    p.wallDrop = true;
    p.wallDropDir = p.wallDir;
    p.vx = 0;
    p.vy = Math.max(p.vy, C.WALL_DROP_SPEED);
    p.varJumpTimer = 0;
    p.forceMoveTimer = 0;
    p.scaleX = 0.8;
    p.scaleY = 1.2;
    this.events.push({ type: 'walldrop' });
    this.burst(p.x + (p.wallDir > 0 ? C.PLAYER_W : 0), p.y, 4, DUST_COLOR, 25, Math.PI / 2, 1);
  }

  private spawnGhost(dt: number) {
    this.ghostTimer -= dt;
    if (this.ghostTimer > 0) return;
    this.ghostTimer = 0.018;
    const p = this.player;
    this.ghosts.push({ x: p.x, y: p.y, life: 0.28, sx: p.scaleX, sy: p.scaleY });
    if (this.ghosts.length > 40) this.ghosts.shift();
  }

  // ------------------------------------------------------------ collision

  isSolidTile(tx: number, ty: number): boolean {
    const t = tileAt(this.world, tx, ty);
    if (t === T.Solid || t === T.Void) return true;
    const i = ty * this.world.w + tx;
    if (t === T.Crumble) return this.crumbleState[this.world.crumbleOf[i]] !== 2;
    if (t === T.Door) return !this.doorsOpen[this.world.doorOf[i]];
    return false;
  }

  solidRect(x: number, y: number, w: number, h: number): boolean {
    const x0 = Math.floor(x / C.TILE);
    const x1 = Math.floor((x + w - 0.001) / C.TILE);
    const y0 = Math.floor(y / C.TILE);
    const y1 = Math.floor((y + h - 0.001) / C.TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.isSolidTile(tx, ty)) return true;
    return false;
  }

  private wallDirAt(dist: number): number {
    const p = this.player;
    if (this.solidRect(p.x + dist, p.y, C.PLAYER_W, C.PLAYER_H)) return 1;
    if (this.solidRect(p.x - dist, p.y, C.PLAYER_W, C.PLAYER_H)) return -1;
    return 0;
  }

  private moveX(amount: number) {
    const p = this.player;
    if (amount === 0) return;
    const nx = p.x + amount;
    if (!this.solidRect(nx, p.y, C.PLAYER_W, C.PLAYER_H)) {
      p.x = nx;
      return;
    }
    // Ledge correction: slip up and over small lips while dashing/moving upward.
    if (p.vy <= 0 && (p.dashTimer > 0 || p.vy < 0)) {
      for (let d = 1; d <= C.CORNER_CORRECTION; d++) {
        if (!this.solidRect(nx, p.y - d, C.PLAYER_W, C.PLAYER_H)) {
          p.x = nx;
          p.y -= d;
          return;
        }
      }
    }
    p.x = amount > 0
      ? Math.floor((nx + C.PLAYER_W) / C.TILE) * C.TILE - C.PLAYER_W
      : (Math.floor(nx / C.TILE) + 1) * C.TILE;
    if (this.solidRect(p.x, p.y, C.PLAYER_W, C.PLAYER_H)) p.x = nx - amount; // safety
    p.vx = 0;
    if (p.dashTimer > 0 && p.dashDir.y === 0) p.dashTimer = Math.min(p.dashTimer, 0.02);
  }

  private moveY(amount: number) {
    const p = this.player;
    if (amount === 0) return;
    const ny = p.y + amount;
    if (!this.solidRect(p.x, ny, C.PLAYER_W, C.PLAYER_H)) {
      p.y = ny;
      return;
    }
    // Corner correction: nudge around ceiling corners when jumping.
    if (amount < 0) {
      for (let d = 1; d <= C.CORNER_CORRECTION; d++) {
        for (const s of [-1, 1]) {
          if (!this.solidRect(p.x + d * s, ny, C.PLAYER_W, C.PLAYER_H)) {
            p.x += d * s;
            p.y = ny;
            return;
          }
        }
      }
    }
    p.y = amount > 0
      ? Math.floor((ny + C.PLAYER_H) / C.TILE) * C.TILE - C.PLAYER_H
      : (Math.floor(ny / C.TILE) + 1) * C.TILE;
    if (this.solidRect(p.x, p.y, C.PLAYER_W, C.PLAYER_H)) p.y = ny - amount;
    if (amount < 0) p.varJumpTimer = 0;
    p.vy = 0;
  }

  // -------------------------------------------------------- world objects

  sawState(def: SawDef, room: Room): SawState {
    const ox = room.tx * C.TILE;
    const oy = room.ty * C.TILE;
    const t = this.worldTime;
    if (def.kind === 'orbit') {
      const a = (def.phase ?? 0) + t * def.angularSpeed;
      return {
        x: ox + (def.center[0] + Math.cos(a) * def.orbitRadius) * C.TILE,
        y: oy + (def.center[1] + Math.sin(a) * def.orbitRadius) * C.TILE,
        r: def.radius * C.TILE,
        angle: t * 9,
      };
    }
    const pts = def.points;
    const segs: number[] = [];
    let total = 0;
    const count = def.mode === 'loop' ? pts.length : pts.length - 1;
    for (let i = 0; i < count; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push(len);
      total += len;
    }
    let d = (t * def.speed) % (def.mode === 'loop' ? total : total * 2);
    if (def.mode !== 'loop' && d > total) d = total * 2 - d;
    let i = 0;
    while (i < segs.length - 1 && d > segs[i]) d -= segs[i++];
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const k = segs[i] ? Math.min(1, d / segs[i]) : 0;
    return {
      x: ox + lerp(a[0], b[0], k) * C.TILE,
      y: oy + lerp(a[1], b[1], k) * C.TILE,
      r: def.radius * C.TILE,
      angle: t * 9,
    };
  }

  private updateWorldObjects(dt: number) {
    for (let i = 0; i < this.orbCooldown.length; i++) if (this.orbCooldown[i] > 0) this.orbCooldown[i] -= dt;
    for (let i = 0; i < this.padFlash.length; i++) if (this.padFlash[i] > 0) this.padFlash[i] -= dt;
    const pr = this.playerRect;
    for (let i = 0; i < this.crumbleState.length; i++) {
      const s = this.crumbleState[i];
      if (s === 0) continue;
      this.crumbleTimer[i] -= dt;
      if (this.crumbleTimer[i] > 0) continue;
      if (s === 1) {
        this.crumbleState[i] = 2;
        this.crumbleTimer[i] = C.CRUMBLE_RESPAWN;
        const c = this.world.crumbles[i];
        this.burst(c.tx * C.TILE + 4, c.ty * C.TILE + 4, 3, DUST_COLOR, 25, Math.PI / 2, 2);
      } else {
        const c = this.world.crumbles[i];
        const tr = { x: c.tx * C.TILE, y: c.ty * C.TILE, w: C.TILE, h: C.TILE };
        if (!overlaps(tr, pr)) this.crumbleState[i] = 0;
        else this.crumbleTimer[i] = 0.1;
      }
    }
  }

  private triggerCrumbleAt(tx: number, ty: number) {
    if (tileAt(this.world, tx, ty) !== T.Crumble) return;
    const idx = this.world.crumbleOf[ty * this.world.w + tx];
    if (this.crumbleState[idx] === 0) {
      this.crumbleState[idx] = 1;
      this.crumbleTimer[idx] = C.CRUMBLE_SHAKE;
    }
  }

  private touchCrumbleBelow() {
    const p = this.player;
    const ty = Math.floor((p.y + C.PLAYER_H + 1) / C.TILE);
    this.triggerCrumbleAt(Math.floor(p.x / C.TILE), ty);
    this.triggerCrumbleAt(Math.floor((p.x + C.PLAYER_W - 0.001) / C.TILE), ty);
  }

  private touchCrumbleSide(dir: number) {
    const p = this.player;
    const tx = Math.floor((dir > 0 ? p.x + C.PLAYER_W + 1 : p.x - 1) / C.TILE);
    this.triggerCrumbleAt(tx, Math.floor(p.y / C.TILE));
    this.triggerCrumbleAt(tx, Math.floor((p.y + C.PLAYER_H - 0.001) / C.TILE));
  }

  private interact() {
    const p = this.player;
    const pr = this.playerRect;
    const cx = p.x + C.PLAYER_W / 2;
    const cy = p.y + C.PLAYER_H / 2;

    // Tile hazards & door unlocks (scan tiles overlapping a 1px-expanded box).
    const x0 = Math.floor((p.x - 1) / C.TILE);
    const x1 = Math.floor((p.x + C.PLAYER_W) / C.TILE);
    const y0 = Math.floor((p.y - 1) / C.TILE);
    const y1 = Math.floor((p.y + C.PLAYER_H) / C.TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const t = tileAt(this.world, tx, ty);
        if (t === T.Door) {
          const g = this.world.doorOf[ty * this.world.w + tx];
          if (!this.doorsOpen[g] && this.heldKeys > 0) this.unlock(g);
          continue;
        }
        const hb = spikeBox(t, tx, ty);
        if (hb && overlaps(hb, pr) && spikeLethal(t, p.vx, p.vy)) return this.die();
        if (t === T.Pit && overlaps({ x: tx * C.TILE, y: ty * C.TILE + 2, w: C.TILE, h: C.TILE }, pr)) return this.die();
      }

    for (const def of this.room.saws) {
      const s = this.sawState(def, this.room);
      if (circleRect(s.x, s.y, s.r * 0.82, pr)) return this.die();
    }

    this.world.keys.forEach((k, i) => {
      if (!this.keysTaken[i] && Math.abs(k.x - cx) < 6 && Math.abs(k.y - cy) < 6) {
        this.keysTaken[i] = true;
        this.heldKeys++;
        this.events.push({ type: 'key' });
        this.burst(k.x, k.y, 14, KEY_COLOR, 60, 0, Math.PI * 2);
      }
    });

    this.world.orbs.forEach((o, i) => {
      if (this.orbCooldown[i] <= 0 && p.dashes < 1 && Math.hypot(o.x - cx, o.y - cy) < 7) {
        this.orbCooldown[i] = C.ORB_RESPAWN;
        p.dashes = 1;
        this.freeze = 0.03;
        this.events.push({ type: 'orb' });
        this.burst(o.x, o.y, 12, ORB_COLOR, 55, 0, Math.PI * 2);
      }
    });

    this.world.pads.forEach((pad, i) => {
      const box = { x: pad.tx * C.TILE, y: pad.ty * C.TILE + 4, w: C.TILE, h: 4 };
      if (p.vy >= 0 && overlaps(box, pr)) {
        p.vy = C.PAD_SPEED;
        p.varJumpTimer = 0;
        p.dashTimer = 0;
        p.dashes = 1;
        p.y = Math.min(p.y, box.y - C.PLAYER_H);
        p.scaleX = 0.6;
        p.scaleY = 1.45;
        this.padFlash[i] = 0.25;
        this.shake = Math.max(this.shake, 1.5);
        this.events.push({ type: 'pad' });
        this.burst(box.x + 4, box.y, 8, PAD_COLOR, 50, -Math.PI / 2, 1.2);
      }
    });

    if (p.portalLock >= 0) {
      const lock = this.world.portals[p.portalLock];
      if (Math.hypot(lock.x - cx, lock.y - cy) > C.PORTAL_RADIUS + 6) p.portalLock = -1;
    } else {
      for (const portal of this.world.portals) {
        if (Math.hypot(portal.x - cx, portal.y - cy) < C.PORTAL_RADIUS + 1) {
          const dest = this.world.portals[portal.pair];
          p.x = dest.x - C.PLAYER_W / 2;
          p.y = dest.y - C.PLAYER_H / 2;
          p.portalLock = portal.pair;
          this.flash = 0.2;
          this.events.push({ type: 'portal' });
          this.burst(dest.x, dest.y, 12, PLAYER_COLOR, 50, 0, Math.PI * 2);
          break;
        }
      }
    }

    const goal = this.world.goal;
    if (goal && Math.abs(goal.x - cx) < 7 && Math.abs(goal.y - cy) < 8) {
      this.phase = 'complete';
      this.flash = 0.6;
      this.shake = 3;
      this.events.push({ type: 'goal' });
      this.burst(goal.x, goal.y, 40, ORB_COLOR, 90, 0, Math.PI * 2);
    }
  }

  private unlock(group: number) {
    this.heldKeys--;
    this.doorsOpen[group] = true;
    this.shake = Math.max(this.shake, 2);
    this.events.push({ type: 'unlock' });
    for (const i of this.world.doors[group].tiles) {
      const tx = i % this.world.w;
      const ty = Math.floor(i / this.world.w);
      this.burst(tx * C.TILE + 4, ty * C.TILE + 4, 3, KEY_COLOR, 40, 0, Math.PI * 2);
    }
  }

  // -------------------------------------------------------- death & rooms

  die() {
    if (this.phase !== 'playing') return;
    const p = this.player;
    this.phase = 'dead';
    this.phaseTimer = C.DEATH_TIME;
    this.deaths++;
    this.shake = 4.5;
    this.events.push({ type: 'death' });
    const cx = p.x + C.PLAYER_W / 2;
    const cy = p.y + C.PLAYER_H / 2;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + this.rng() * 0.3;
      const s = 50 + this.rng() * 110;
      this.particles.push({
        x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + this.rng() * 0.35, maxLife: 0.85, size: 1.2 + this.rng() * 1.8,
        color: i % 3 === 0 ? SPIKE_COLOR : PLAYER_COLOR, gravity: 120,
      });
    }
    this.ghosts = [];
  }

  private respawn() {
    this.restoreSnapshot();
    this.player = this.freshPlayer(this.checkpoint);
    this.phase = 'respawning';
    this.phaseTimer = C.RESPAWN_TIME;
    this.player.scaleX = 0.2;
    this.player.scaleY = 2;
    this.crumbleState.fill(0);
    this.orbCooldown.fill(0);
    this.snapCamera();
    this.events.push({ type: 'respawn' });
    this.burst(this.checkpoint.x + 3, this.checkpoint.y + 3, 10, PLAYER_COLOR, 40, 0, Math.PI * 2, -1);
  }

  /** Restart the whole level from scratch (timer, deaths, items). */
  restart() {
    this.room = this.world.rooms[0];
    this.checkpoint = { ...this.world.start };
    this.heldKeys = 0;
    this.keysTaken.fill(false);
    this.doorsOpen.fill(false);
    this.snapshot = this.takeSnapshot();
    this.crumbleState.fill(0);
    this.orbCooldown.fill(0);
    this.player = this.freshPlayer(this.checkpoint);
    this.time = 0;
    this.worldTime = 0;
    this.deaths = 0;
    this.phase = 'ready';
    this.particles = [];
    this.ghosts = [];
    this.snapCamera();
  }

  private takeSnapshot(): Snapshot {
    return { heldKeys: this.heldKeys, keysTaken: [...this.keysTaken], doorsOpen: [...this.doorsOpen] };
  }

  private restoreSnapshot() {
    this.heldKeys = this.snapshot.heldKeys;
    this.keysTaken = [...this.snapshot.keysTaken];
    this.doorsOpen = [...this.snapshot.doorsOpen];
  }

  private checkRoom() {
    const p = this.player;
    const cx = p.x + C.PLAYER_W / 2;
    const cy = p.y + C.PLAYER_H / 2;
    const r = this.room.rect;
    if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) return;
    const next = roomAt(this.world, cx, cy);
    if (!next) {
      if (cy >= r.y + r.h) this.die();
      return;
    }
    const nr = next.rect;
    // Push the player fully inside the new room and give upward exits a boost.
    if (cx >= r.x + r.w) p.x = Math.max(p.x, nr.x + 1);
    else if (cx < r.x) p.x = Math.min(p.x, nr.x + nr.w - C.PLAYER_W - 1);
    if (cy < r.y) {
      p.y = Math.min(p.y, nr.y + nr.h - C.PLAYER_H - 2);
      p.vy = Math.min(p.vy, C.JUMP_SPEED * 1.15);
      p.dashTimer = 0;
    } else if (cy >= r.y + r.h) p.y = Math.max(p.y, nr.y + 1);

    this.room = next;
    let best = next.spawns[0];
    let bestD = Infinity;
    for (const s of next.spawns) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    this.checkpoint = { ...best };
    this.snapshot = this.takeSnapshot();
    p.dashes = 1;
    this.transition = { from: { ...this.camera }, to: this.cameraTarget(), t: 0 };
    this.phase = 'transition';
    this.ghosts = [];
    this.events.push({ type: 'room' });
  }

  // --------------------------------------------------------------- camera

  private cameraTarget() {
    const p = this.player;
    const r = this.room.rect;
    const tx = p.x + C.PLAYER_W / 2 - this.view.w / 2;
    const ty = p.y + C.PLAYER_H / 2 - this.view.h / 2;
    return {
      x: r.w <= this.view.w ? r.x + (r.w - this.view.w) / 2 : clamp(tx, r.x, r.x + r.w - this.view.w),
      y: r.h <= this.view.h ? r.y + (r.h - this.view.h) / 2 : clamp(ty, r.y, r.y + r.h - this.view.h),
    };
  }

  private snapCamera() {
    const t = this.cameraTarget();
    this.camera.x = t.x;
    this.camera.y = t.y;
  }

  private followCamera(dt: number) {
    const t = this.cameraTarget();
    const k = 1 - Math.exp(-12 * dt);
    this.camera.x = lerp(this.camera.x, t.x, k);
    this.camera.y = lerp(this.camera.y, t.y, k);
  }

  // -------------------------------------------------------------- effects

  private burst(x: number, y: number, n: number, color: number, speed: number, dir: number, spread: number, gravity = 160) {
    for (let i = 0; i < n; i++) {
      const a = dir + (this.rng() - 0.5) * spread;
      const s = speed * (0.4 + this.rng() * 0.8);
      const life = 0.25 + this.rng() * 0.3;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, maxLife: life, size: 0.8 + this.rng() * 1.2, color, gravity });
    }
    if (this.particles.length > 260) this.particles.splice(0, this.particles.length - 260);
  }

  private updateEffects(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 18);
    this.flash = Math.max(0, this.flash - dt);
    for (const g of this.ghosts) g.life -= dt;
    while (this.ghosts.length && this.ghosts[0].life <= 0) this.ghosts.shift();
    let n = 0;
    for (const pt of this.particles) {
      pt.life -= dt;
      if (pt.life <= 0) continue;
      pt.vy += pt.gravity * dt;
      pt.vx *= 1 - 2 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      this.particles[n++] = pt;
    }
    this.particles.length = n;
  }
}

/** Spike hitboxes are inset so grazing the base never kills. */
export function spikeBox(t: T, tx: number, ty: number): Rect | null {
  const x = tx * C.TILE;
  const y = ty * C.TILE;
  switch (t) {
    case T.SpikeUp: return { x: x + 1, y: y + 4, w: 6, h: 4 };
    case T.SpikeDown: return { x: x + 1, y, w: 6, h: 4 };
    case T.SpikeLeft: return { x, y: y + 1, w: 4, h: 6 };
    case T.SpikeRight: return { x: x + 4, y: y + 1, w: 4, h: 6 };
    default: return null;
  }
}

/** Celeste-style: spikes only kill when you move into (or rest against) their points. */
function spikeLethal(t: T, vx: number, vy: number) {
  switch (t) {
    case T.SpikeUp: return vy >= 0;
    case T.SpikeDown: return vy <= 0;
    case T.SpikeLeft: return vx >= 0;
    case T.SpikeRight: return vx <= 0;
    default: return false;
  }
}
