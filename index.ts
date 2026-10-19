// Platform-specific startup: Metro picks src/boot.web.ts on web and src/boot.ts on iOS/Android,
// so Skia's web loader (CanvasKit, which imports Node's "fs") never enters the phone bundle.
import { boot } from './src/boot';

boot();
