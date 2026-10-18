import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { TouchController } from '../engine/input';
import { DASH_CHORD_MS, KeyboardInput } from '../engine/keyboard';

/** Desktop keyboard controls for Expo web (see KeyboardInput for the mapping). */
export function useKeyboardControls(touch: TouchController, togglePause: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const kb = new KeyboardInput(touch, togglePause);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const wasPending = kb.dashPending;
      if (kb.keyDown(e.key, e.repeat)) e.preventDefault();
      if (kb.dashPending && !wasPending) timer = setTimeout(() => kb.flushDash(), DASH_CHORD_MS);
    };
    const up = (e: KeyboardEvent) => kb.keyUp(e.key);
    const blur = () => kb.reset();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [touch, togglePause]);
}
