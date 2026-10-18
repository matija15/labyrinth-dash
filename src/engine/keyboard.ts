import type { Vec2 } from '../types';
import type { TouchController } from './input';

/** After `D` is pressed with no arrow held, wait this long for arrows so D-then-↑→ still gives a diagonal. */
export const DASH_CHORD_MS = 60;

type Dir = 'left' | 'right' | 'up' | 'down';

const DIRS: Record<string, Dir> = { arrowleft: 'left', a: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down' };
const JUMP_KEYS = new Set([' ', 'z', 'c', 'arrowup']);
const DASH_NOW_KEYS = new Set(['x', 'shift']);

/**
 * Desktop keyboard mapping (pure; the web hook feeds it DOM key events):
 *  - ←/→ (or A for left) run / set the run direction,
 *  - Space, ↑, Z or C jump (hold for height),
 *  - D dashes toward the held arrows (8-way). No arrow held → waits DASH_CHORD_MS for one, then dashes the facing way.
 *    While D is down, arrows only aim: they don't jump or turn. X / Shift dash immediately.
 *  - Esc / P pause.
 */
export class KeyboardInput {
  private readonly held = new Set<Dir>();
  private readonly jumpKeys = new Set<string>();
  private dashHeld = false;
  /** A D press is waiting for arrows (`flushDash` fires it). */
  dashPending = false;

  constructor(private readonly touch: TouchController, private readonly onPause: () => void) {}

  axis(): Vec2 {
    const x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    const y = (this.held.has('down') ? 1 : 0) - (this.held.has('up') ? 1 : 0);
    return { x, y };
  }

  /** Returns true if the key was used (the caller should preventDefault). `true` from a D press with no arrows held
   * also means: call `flushDash` after DASH_CHORD_MS. */
  keyDown(key: string, repeat = false): boolean {
    const k = key.toLowerCase();
    const dir = DIRS[k];
    let used = false;
    if (dir) {
      this.held.add(dir);
      if (!repeat && !this.aiming && (dir === 'left' || dir === 'right')) this.touch.keyFace(dir === 'left' ? -1 : 1);
      used = true;
    }
    if (JUMP_KEYS.has(k) && !(k === 'arrowup' && this.aiming)) {
      if (this.jumpKeys.size === 0) this.touch.keyJumpDown();
      this.jumpKeys.add(k);
      used = true;
    }
    if (k === 'd' && !repeat) {
      this.dashHeld = true;
      const a = this.axis();
      if (a.x || a.y) this.touch.keyDash(a);
      else this.dashPending = true;
      used = true;
    }
    if (DASH_NOW_KEYS.has(k) && !repeat) {
      this.touch.keyDash(this.axis());
      used = true;
    }
    if (k === 'escape' || k === 'p') {
      this.onPause();
      used = true;
    }
    this.sync();
    return used;
  }

  keyUp(key: string) {
    const k = key.toLowerCase();
    const dir = DIRS[k];
    if (dir) this.held.delete(dir);
    if (this.jumpKeys.delete(k) && this.jumpKeys.size === 0) this.touch.keyJumpUp();
    if (k === 'd') this.dashHeld = false;
    this.sync();
  }

  /** Fires a pending D dash toward whatever arrows are held now (none → facing direction). */
  flushDash() {
    if (!this.dashPending) return;
    this.dashPending = false;
    this.touch.keyDash(this.axis());
    this.sync();
  }

  /** Window lost focus: drop every held key so nothing sticks. */
  reset() {
    this.held.clear();
    if (this.jumpKeys.size) this.touch.keyJumpUp();
    this.jumpKeys.clear();
    this.dashHeld = false;
    this.dashPending = false;
    this.sync();
  }

  private get aiming() {
    return this.dashHeld || this.dashPending;
  }

  private sync() {
    this.touch.keyboardX = this.axis().x;
    this.touch.sync();
  }
}
