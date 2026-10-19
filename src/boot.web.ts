import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

/** Skia on web needs CanvasKit (wasm, served from public/canvaskit.wasm) loaded before any Skia code runs. */
export function boot() {
  LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(() => {
    // App (and everything that uses Skia) must only be evaluated after CanvasKit is ready.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    registerRootComponent(require('../App').default);
  });
}
