import type { InputState, Vec2 } from '../types';
import { quantizeDir8 } from './math';

export const createInput = (): InputState => ({ moveX: 0, jumpHeld: false, jumpPresses: 0, dashQueue: null, faceQueue: 0, tapQueue: 0 });

/** Fraction of the screen height (from the bottom) used by the left/right move pads. */
export const MOVE_ZONE = 0.42;
/** Minimum travel (dp) for a touch to count as a dash swipe. */
export const SWIPE_DISTANCE = 30;
/** A swipe must cover SWIPE_DISTANCE within this time (ms) from touch-down. */
export const SWIPE_WINDOW = 260;

type Pointer =
  | { kind: 'move'; x: number; y: number }
  | { kind: 'action'; sx: number; sy: number; x: number; y: number; t0: number; swiped: boolean };

export interface SwipeMark { x0: number; y0: number; dir: Vec2; t: number }

/**
 * Pure multi-touch classifier.
 * Run pads (`autoRun` false):
 *  - touches starting in the bottom band hold left/right (by screen half; sliding across switches),
 *  - touches elsewhere press jump immediately (held = higher jump).
 * Auto-run (no on-screen controls):
 *  - every touch queues a tap on its screen half (`tapQueue`); the engine turns it into
 *    start / flip / jump / wall-jump from the player's state, and a held finger extends the jump.
 * In both, a fast swipe from any non-pad touch queues an 8-way dash and releases the jump hold.
 */
export class TouchController {
  width = 1;
  height = 1;
  readonly input: InputState;
  readonly pointers = new Map<number, Pointer>();
  lastSwipe: SwipeMark | null = null;
  keyboardX = 0;
  keyboardJump = false;
  /** Auto-run scheme: contextual half-screen taps instead of move pads. */
  autoRun = false;

  constructor(input: InputState = createInput()) {
    this.input = input;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  down(id: number, x: number, y: number, t: number) {
    if (!this.autoRun && y > this.height * (1 - MOVE_ZONE)) {
      this.pointers.set(id, { kind: 'move', x, y });
    } else {
      this.pointers.set(id, { kind: 'action', sx: x, sy: y, x, y, t0: t, swiped: false });
      if (this.autoRun) this.input.tapQueue = x < this.width / 2 ? -1 : 1;
      else this.input.jumpPresses++;
    }
    this.sync();
  }

  move(id: number, x: number, y: number, t: number) {
    const p = this.pointers.get(id);
    if (!p) return;
    p.x = x;
    p.y = y;
    if (p.kind === 'action' && !p.swiped) {
      const dx = x - p.sx;
      const dy = y - p.sy;
      if (Math.hypot(dx, dy) >= SWIPE_DISTANCE && t - p.t0 <= SWIPE_WINDOW) {
        p.swiped = true;
        const dir = quantizeDir8(dx, dy);
        this.input.dashQueue = dir;
        this.lastSwipe = { x0: p.sx, y0: p.sy, dir, t };
      }
    }
    this.sync();
  }

  up(id: number) {
    this.pointers.delete(id);
    this.sync();
  }

  clear() {
    this.pointers.clear();
    this.sync();
  }

  /** Keyboard (web/dev) helpers. */
  keyJumpDown() {
    if (!this.keyboardJump) this.input.jumpPresses++;
    this.keyboardJump = true;
    this.sync();
  }

  keyJumpUp() {
    this.keyboardJump = false;
    this.sync();
  }

  keyDash(dir: Vec2) {
    this.input.dashQueue = dir;
  }

  keyFace(dir: number) {
    this.input.faceQueue = dir;
  }

  sync() {
    let left = false;
    let right = false;
    let jump = this.keyboardJump;
    for (const p of this.pointers.values()) {
      if (p.kind === 'move') {
        if (p.x < this.width / 2) left = true;
        else right = true;
      } else if (!p.swiped) jump = true;
    }
    const touchX = left === right ? 0 : left ? -1 : 1;
    this.input.moveX = touchX !== 0 ? touchX : this.keyboardX;
    this.input.jumpHeld = jump;
  }

  /** Which move pads are currently pressed (for HUD highlighting). */
  padState() {
    let left = false;
    let right = false;
    for (const p of this.pointers.values())
      if (p.kind === 'move') {
        if (p.x < this.width / 2) left = true;
        else right = true;
      }
    return { left, right };
  }
}
