# Labyrinth Dash

A fast, punishing 2D precision platformer for **Expo Go**. It's rendered entirely with
`@shopify/react-native-skia`, driven by `react-native-gesture-handler`, and runs on a custom
fixed-timestep kinematic physics engine.

- Tight movement with snappy run accel/decel, variable jump height, **100 ms coyote time**, **100 ms jump buffer**, corner correction
- Wall slide (capped fall speed) and wall jump (diagonal push off the wall)
- **8-directional dash** with a short gravity freeze. It recharges when you land, touch a wall, or grab a refill orb
- Juice: dash ghost trail, dynamic player light, glow, squash & stretch, screen shake, death/spike particle bursts, haptics
- Hazards & mechanics: solid walls, directional spikes, moving and orbiting sawblades, crumbling platforms, keys + locked doors, dash orbs, jump pads, portals
- Interconnected multi-room levels. Leaving a room smoothly scrolls the camera to the next section, and each room has its own checkpoint
- HUD drawn with Skia text: millisecond speedrun timer, death counter, keys, room indicator
- Saved locally with AsyncStorage: best clear time, deaths, clears, unlock progress
- Death costs well under a second: an instant checkpoint respawn with nothing to load

## Run it with Expo Go

Requirements: Node 20+ and the **Expo Go** app (SDK 57 — the version currently on the App Store / Play Store) on your phone.

```bash
npm install
npx expo start
```

Scan the QR code. On Android, use the Expo Go app. On iOS, use the Camera app. Your phone and computer must be on
the same network; if they aren't, use `npx expo start --tunnel`. The game runs in landscape.

Every native module it uses (Skia, Gesture Handler, Reanimated/Worklets, AsyncStorage, Haptics,
Keep Awake, Safe Area) ships inside Expo Go, so you don't need a development build.

You can also run it in a browser with `npx expo start --web`. Skia loads CanvasKit from `public/canvaskit.wasm`.

## Controls

There are two control schemes. Toggle them with **CONTROLS** on the level select screen; the choice is saved.

**Auto-run (default)**: the player runs by itself in the direction it faces. There are no on-screen controls: the screen is split invisibly into a left and a right half, and what a tap does depends on what the player is doing. After spawning or respawning it stands still until your first input.

| Situation | Touch | Keyboard (web) |
| --- | --- | --- |
| Standing still | Tap the left / right half: start running that way (never jumps) | ← / → (or A for left) |
| Running on the ground | Tap the half you're running toward: jump (hold for a higher jump) | Space / ↑ / Z |
| Running on the ground | Tap the other half: turn around instantly (never jumps) | ← / → |
| In the air | Tap the half you're moving toward: buffered jump (coyote time / landing); the other half turns you around | Space / ↑ / Z |
| On a wall | Tap anywhere, even the same half again and again: wall-jump up and away, flipping your run direction (shaft climbing) | Space / ↑ / Z |
| Anywhere | Swipe: 8-way dash in the swipe direction | D + arrows (no arrow: facing way); X / Shift too |
| On a wall | Swipe straight down: let go and fall straight down (no dash used); you turn away from the wall on landing | D + ↓ |
| Pause | ❚❚ button | Esc / P |

Touching a wall in the air grabs it automatically (slow slide). Running into a wall on the ground stops you against it: tap the other half to turn around, or jump to grab the wall and wall-jump off it. A hold only extends a tap that became a jump; holding a start / turn-around tap does nothing.

**PC keyboard dash:** hold the arrow(s) and press **D**, or press **D** and then the arrow(s) within 60 ms (so
D, ↑, → still gives an up-right diagonal). While D is down the arrows only aim: ↑ doesn't jump and ←/→ don't turn
you. D with no arrow dashes the way you're facing. D is dash only, so it never runs right.

**Run pads (classic)**

| Action | Touch | Keyboard (web) |
| --- | --- | --- |
| Run left / right | Hold the bottom-left / bottom-right of the screen | ← → (or A for left) |
| Jump | Tap anywhere above the run pads (hold for a higher jump) | Space / ↑ / Z |
| Dash (8-way) | Swipe in any direction (with a finger that isn't on a run pad) | D + arrows; X / Shift too |
| Wall slide / wall jump | Push into a wall while airborne, then jump | same |
| Pause | ❚❚ button | Esc / P |

A swipe that starts as a jump tap turns into a dash once it travels about 30 px within 260 ms.

## Levels

Levels come in two packs:

- **Release pack** (`src/levels/release/`): the only levels players ever see. One `<id>.json` per level, and
  `order.json` lists them in play/unlock order. You write these with the editor's **Save** (see below).
- **Demo pack** (`src/levels/dev/`): the six levels below. The tests and the solver use them, and dev builds can
  switch to them with **PACK · DEMO** on the level select screen. They're never shown in a release build.

**Dev builds vs release builds.** In Expo Go / `npx expo start` (`__DEV__`), the level select screen shows the
**LEVEL EDITOR** and **PACK** buttons, and every level is unlocked. A release build (EAS / `expo export`) shows
only the release pack with normal unlocking and no editor. To get the dev tools in a release-mode build (for
example a TestFlight build for your own testing), build it with `EXPO_PUBLIC_DEV_TOOLS=1`.

Demo levels:

1. **First Light**: running, variable jumps, spikes, a crumbling bridge, a wall-jump shaft.
2. **Dash Lab**: dashing gaps, refill-orb chains, a jump pad, key → door, portals.
3. **The Labyrinth**: six interconnected rooms with a sawblade gauntlet (moving and orbiting saws), a key room,
   a locked vault, a collapsing floor, and a portal loop back to the hub.
4. **Switchback**: stacked switchback ledges (turn around at each wall), a tall wall-jump chimney with a crumbling
   section, and a spike gap you clear with a jump + dash.
5. **Saw Mill**: a floor of rising and falling saws to time, an orb chain over a long spike pit, and a spring jump
   past an orbiting saw.
6. **Undercroft**: a locked gate with the key in the cellar below, a crumbling bridge, a shaft climb to a portal
   back up to the gate, then crumbling pillars under a sweeping saw.

In a release build each level unlocks after you clear the previous one. Long-press "hold to reset save" on the level select screen to wipe your progress.

## Skins

**SKINS** on the level select screen opens the skin picker. It has two sections, **PLAYER** and
**BLOCKS & SPIKES** (world themes), and a live preview drawn with the real game renderer. Tapping
an unlocked skin equips it, and tapping a locked one previews it. Skins are purely visual:
hitboxes and physics are identical in every skin.

- **Adding a skin:** append to `PLAYER_SKINS` or `THEMES` in `src/engine/skins.ts`. Ids are stored
  in saves, so keep them stable.
  - Player skins set a color, a dash-spent color, a trail color, and a `shape` of `block`,
    `round` or `hollow`.
  - Themes set colors plus `blocks` (`neon` / `brick` / `flat`) and `spikes` (`sharp` / `chunky` / `needle`).
- **Your own art:** put 16×16 PNGs in `assets/skins/<set>/` and register them in `ART` in
  `src/skins/art.ts`. Then set `art: '<set>'` on the skin and add the key to `ArtKey`.
  - The slots are `player`, `solid`, `spike`, `saw`, `crumble`, `door`, `pad`, `key`, `orb` and `goal`.
  - Every slot is optional and falls back to the vector drawing.
  - Draw `spike` pointing up (it's rotated for walls and ceilings) and `player` facing right (it's mirrored).
  - `assets/skins/pixel/` is a working example.
- **Animated player:** an `art` set can make the player slot a sprite sheet (see `SHEETS` in
  `src/skins/sheets.ts`). It has one row per animation (`idle`, `run`, `dash`, `air` = rising/falling
  frames). The character faces right and stands on the bottom of each cell. `density` is sheet
  pixels per world pixel (the hitbox is 6×6 world px). Red Hood (`assets/skins/hood/`) is built
  from the idle GIF by `python3 tools/hood_sprites.py`; to use hand-drawn frames, replace `sheet.png`
  and update `HOOD_SHEET`.
- **Unlocks:** `{ type: 'free' }`, `{ type: 'clears', count }` (release levels cleared),
  `{ type: 'deaths', count }` (total deaths) or `{ type: 'ad' }`.
- **Ads:** `showRewardedAd()` in `src/engine/ads.ts` is a stub that grants the unlock immediately.
  Real rewarded ads (AdMob) and purchases need native modules that Expo Go doesn't include, so they
  come with an EAS development build.
- **Readability:** `tests/skins.test.ts` fails if a theme's spikes or saws, or any player skin,
  fall below a contrast ratio of 3 against the background. Spikes also need a contrast of at
  least 2.5 against blocks.

## Project structure

```
App.tsx                    root: gesture root, safe area, level select ↔ game
index.ts                   entry (loads CanvasKit first on web)
src/components/
  GameScreen.tsx           Skia <Canvas>, gesture overlay, RAF loop wiring, pause/clear overlays
  renderer.ts              imperative Skia drawing (cached static level picture + per-frame picture)
  LevelSelect.tsx          level cards with best times / deaths / lock state
  LevelEditor.tsx          in-game level editor UI (palette, toolbar, export / load sheets)
  editorController.ts      editor touch handling, camera, undo
  editorRenderer.ts        Skia drawing of the editor grid
  useKeyboardControls.ts   web keyboard fallback
src/engine/
  constants.ts             every physics/feel tuning value in one place
  game.ts                  simulation: player physics, collisions, hazards, rooms, checkpoints, FX
  world.ts                 level → tile grid, entities, room layout, validation
  input.ts                 touch zones / tap / swipe → InputState
  loop.ts                  requestAnimationFrame fixed-timestep (120 Hz) loop
  editor.ts                pure editor ops: paint, rooms, saws, level code export / import
  tmx.ts                   Tiled .tmx (CSV layer + saw objects) → RoomDef
  save.ts / storage.ts     pure save reducers + AsyncStorage I/O
src/levels/release/        release pack: <id>.json per level + order.json (+ generated index.ts)
src/levels/dev/            demo / test levels (2D tile-string arrays), dev builds only
src/types/                 shared types
tests/                     engine tests (node:test)
scripts/solve.ts           brute-force solver that proves each built-in level can be completed
scripts/level-server.ts    dev-only server behind the editor's Save / Levels (npm run levels)
```

### Physics model

The simulation steps at a fixed **120 Hz** (`FIXED_DT`) inside a `requestAnimationFrame` accumulator, so the
physics behave the same at any frame rate. Units are world pixels with 8 px tiles. The camera scales the
view so that 16 tiles fill the screen height. Collisions are axis-separated AABB against the tile grid with
sub-pixel positions, plus a few pixels of corner correction so you don't clip ceiling corners on jumps
and dashes. You tune the game's feel in `src/engine/constants.ts`.

## Making levels

Each room is an array of equal-width strings, one character per 8 px tile:

| Char | Meaning | Char | Meaning |
| --- | --- | --- | --- |
| `#` | solid | `=` | crumbling platform |
| `^ v < >` | spikes (pointing up/down/left/right) | `K` / `D` | key / locked door (contiguous `D`s open together) |
| `O` | dash-refill orb | `J` | jump pad |
| `1`–`9` | portal pair (exactly two of each digit) | `S` | spawn / checkpoint |
| `G` | level goal (one per level) | `.` | empty |

Rooms carry a tile offset (`x`, `y`) within the level, so neighbouring rooms line up and you walk straight
from one to the next. Saws are defined per room:

```ts
saws: [
  { kind: 'path', points: [[4, 6], [20, 6]], speed: 6, radius: 0.8, mode: 'pingpong' },
  { kind: 'orbit', center: [16, 8], radius: 0.7, orbitRadius: 3, speed: 1.6, phase: 0 },
]
```

### In-game level editor

Tap **LEVEL EDITOR** on the level select screen (dev builds only).

**Workflow for release levels:**

1. In one terminal run `npm run levels`. This is a small local server on port 8790 that writes level files into
   `src/levels/release/`. In another terminal run `npx expo start` (press `w` for the browser editor, or scan the
   QR code with Expo Go; the phone has to be on the same Wi-Fi).
2. Build the level, then press **Save**. Set the name and subtitle there. The file name comes from the name.
   A new level is added as the last level. Saving a level you opened from **Levels** overwrites it, and if
   you renamed it, it renames the file and keeps its place in the order.
3. **Levels** lists the release pack in order. You can open, move ↑ / ↓ (that changes the unlock order) or delete
   levels, start a new level, open a demo level, or paste level code.
4. Commit `src/levels/release/` to ship the levels. Don't edit `index.ts` there, because it's generated.

- **Palette (left):** Wall, Spikes (they point away from the wall they touch), Saw, Dash Orb, Key, Door,
  Spawn, Exit Flag, Crumble, Jump Pad, Eraser, Select, Paste, + Room, − Room and Pan. Tap or drag on the grid
  to paint.
- **Tool hotkeys (web):** shown in the palette as `[W]` etc. 1/W Wall, 2/X Spikes, 3/A Saw, 4/O Dash Orb,
  5/K Key, 6/D Door, 7/S Spawn, 8/F Exit Flag, 9/C Crumble, 0/J Jump Pad, E Eraser, V Select, P Paste,
  R + Room, T playtest this room, + / − zoom. They only fire without Ctrl/Cmd, so Ctrl+C / X / V still copy,
  cut and paste.
- **Select / copy / paste:** with **Select**, drag a box, then **Copy**, **Cut**, **Fill** (paints the last
  tile tool you picked over the whole box), **Clear** or **✕**. Then pick **Paste** and tap or drag to place
  the block by its top-left corner. Saws inside the box are copied too, and pasting outside every room adds rooms.
  On web you can also use Ctrl+C / Ctrl+X / Ctrl+V, Delete and Esc.
- **Saws:** drag to make a saw that moves back and forth along that line. Tap to make a saw that circles
  the tile. The eraser removes a saw when you erase its start, end or center tile.
- **Rooms:** the grid uses the game's 8 px tiles, and zoom 1× shows 16 tiles of height, the same as in
  the game. Painting outside every room adds a walled 32×16 room there, and you erase wall tiles to connect
  rooms. Every room needs a Spawn (its checkpoint), and the level needs exactly one Exit Flag.
- **Camera:** scroll with two fingers or the Pan tool (arrow keys on web). Zoom with the − / + buttons; the
  middle button shows the zoom and resets it to 100% (3/4 of a room's height). On web the mouse wheel zooms in
  and out around the cursor.
- **Undo:** reverts the last stroke (Ctrl+Z on web). Your work is saved automatically as a draft.
- **▶ Start / ▶ Here / ▶ Room:** ▶ Start plays the level from the first room's spawn. ▶ Here starts in the room
  in the middle of the screen and carries on through the rest of the level. ▶ Room (or **T**) plays only the
  room in the middle of the screen: other rooms are left out, so you can't leave it, and portals whose partner is
  in another room are removed. If that room has no Spawn you start on its floor near the bottom center, and it
  doesn't need an Exit Flag.
  Pause (or Esc) and dying both return you to the editor. Playtests don't touch your save data.
- **Export:** shows the level as a complete `.ts` level file (the demo-level format). *Copy as JSON* copies
  plain JSON, the same format as the release `.json` files. Use this to move a level by hand when the level
  server isn't running.

### Tiled (.tmx)

`parseTmxRoom(xml, { id, x, y })` turns a Tiled map with a CSV-encoded tile layer into a `RoomDef`.
Tile ids map through `DEFAULT_TMX_TILESET`, which you can override. Objects with type/class `saw` become
saws: a polyline object is a path saw, and an `orbit` property makes an orbit saw.

## Checks

```bash
npx tsc --noEmit                 # types
npx expo lint                    # lint
npx tsx --test tests/*.test.ts   # engine tests (jump/coyote/buffer/wall/dash/hazards/rooms/levels/TMX/save/input)
npx tsx scripts/solve.ts         # try to beat every demo + release level (auto-run; add --manual for run pads)
```
