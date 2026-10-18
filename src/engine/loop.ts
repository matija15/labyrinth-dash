import { FIXED_DT, MAX_FRAME_DT } from './constants';

/**
 * requestAnimationFrame loop with a fixed-timestep accumulator: physics always advances in
 * FIXED_DT increments (deterministic, frame-rate independent); rendering happens once per frame.
 */
export class GameLoop {
  private raf: number | null = null;
  private last = 0;
  private acc = 0;
  paused = false;
  /** Game speed (assist mode slows it down). */
  speed = 1;

  constructor(
    private readonly step: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start() {
    if (this.raf !== null) return;
    this.last = 0;
    this.acc = 0;
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      if (!this.last) this.last = now;
      const frame = Math.min((now - this.last) / 1000, MAX_FRAME_DT);
      this.last = now;
      if (!this.paused) {
        this.acc += frame * this.speed;
        let steps = 0;
        while (this.acc >= FIXED_DT && steps < 16) {
          this.step(FIXED_DT);
          this.acc -= FIXED_DT;
          steps++;
        }
      }
      this.render(this.acc / FIXED_DT);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }
}
