import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { TouchController } from '../engine/input';

/**
 * Keyboard controls for Expo web / emulators with a hardware keyboard:
 * ←/→ or A/D move (run-pad scheme only), Z/Space/C jump (hold for height), X/Shift dash toward held
 * arrows (8-way; X + ↓ on a wall is a wall drop in auto-run), Esc/P pause.
 */
export function useKeyboardControls(touch: TouchController, togglePause: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const held = new Set<string>();
    const axis = () => {
      const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      const y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
      return { x, y };
    };
    const dirOf = (k: string) =>
      ({ arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' })[k];
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const dir = dirOf(k);
      if (dir) held.add(dir);
      if (k === 'z' || k === ' ' || k === 'c') touch.keyJumpDown();
      if ((k === 'x' || k === 'shift') && !e.repeat) touch.keyDash(axis());
      if (k === 'escape' || k === 'p') togglePause();
      touch.keyboardX = axis().x;
      touch.sync();
      if (dir || k === ' ') e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const dir = dirOf(k);
      if (dir) held.delete(dir);
      if (k === 'z' || k === ' ' || k === 'c') touch.keyJumpUp();
      touch.keyboardX = axis().x;
      touch.sync();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [touch, togglePause]);
}
