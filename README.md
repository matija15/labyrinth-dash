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
| Standing still | Tap the left / right half: start running that way (never jumps) | ← / → |
| Running on the ground | Tap the half you're running toward: jump (hold for a higher jump) | Z / Space / C |
| Running on the ground | Tap the other half: turn around instantly (never jumps) | ← / → |
| In the air | Tap the half you're moving toward: buffered jump (coyote time / landing); the other half turns you around | Z / Space / C |
| On a wall | Tap anywhere, even the same half again and again: wall-jump up and away, flipping your run direction (shaft climbing) | Z / Space / C |
| Anywhere | Swipe: 8-way dash in the swipe direction | X / Shift + arrows |
| On a wall | Swipe straight down: let go and fall straight down (no dash used); you turn away from the wall on landing | X / Shift + ↓ |
| Pause | ❚❚ button | Esc / P |

Touching a wall in the air grabs it automatically (slow slide). Running into a wall on the ground stops you against it: tap the other half to turn around, or jump to grab the wall and wall-jump off it. A hold only extends a tap that became a jump; holding a start / turn-around tap does nothing.

**Run pads (classic)**

| Action | Touch | Keyboard (web) |
| --- | --- | --- |
| Run left / right | Hold the bottom-left / bottom-right of the screen | ← → / A D |
| Jump | Tap anywhere above the run pads (hold for a higher jump) | Z / Space / C |
| Dash (8-way) | Swipe in any direction (with a finger that isn't on a run pad) | X / Shift + arrows |
| Wall slide / wall jump | Push into a wall while airborne, then jump | same |
| Pause | ❚❚ button | Esc / P |

A swipe that starts as a jump tap turns into a dash once it travels about 30 px within 260 ms.

## Levels

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

Each level unlocks after you clear the previous one. Long-press "hold to reset save" on the level select screen to wipe your progress.

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
src/levels/                built-in levels (2D tile-string arrays)
src/types/                 shared types
tests/                     engine tests (node:test)
scripts/solve.ts           brute-force solver that proves each built-in level can be completed
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

Tap **LEVEL EDITOR** on the level select screen.

- **Palette (left):** Wall, Spikes (they point away from the wall they touch), Saw, Dash Orb, Key, Door,
  Spawn, Exit Flag, Crumble, Jump Pad, Eraser, + Room, − Room and Pan. Tap or drag on the grid to paint.
- **Saws:** drag to make a saw that moves back and forth along that line. Tap to make a saw that circles
  the tile. The eraser removes a saw when you erase its start, end or center tile.
- **Rooms:** the grid uses the game's 8 px tiles, and zoom 1× shows 16 tiles of height, the same as in
  the game. Painting outside every room adds a walled 32×16 room there, and you erase wall tiles to connect
  rooms. Every room needs a Spawn (its checkpoint), and the level needs exactly one Exit Flag.
- **Camera:** scroll with two fingers or the Pan tool, and zoom with − / +. On web, the arrow keys and the
  mouse wheel scroll too.
- **Undo:** reverts the last stroke (Ctrl+Z on web). Your work is saved automatically as a draft.
- **▶ Playtest:** plays the level from the first room's spawn. Pause (or Esc) and dying both return you
  to the editor. Playtests don't touch your save data.
- **Export:** shows the level as a complete `src/levels/*.ts` file, in the same format as the built-in levels.
  *Copy to Clipboard* copies the file and *Copy as JSON* copies plain JSON. Save it as a new file in
  `src/levels/` and add it to `LEVELS` in `src/levels/index.ts`.
- **Load:** opens a new blank level or any built-in level, or loads pasted code (the JSON, or a whole
  level `.ts` file).

### Tiled (.tmx)

`parseTmxRoom(xml, { id, x, y })` turns a Tiled map with a CSV-encoded tile layer into a `RoomDef`.
Tile ids map through `DEFAULT_TMX_TILESET`, which you can override. Objects with type/class `saw` become
saws: a polyline object is a path saw, and an `orbit` property makes an orbit saw.

## Checks

```bash
npx tsc --noEmit                 # types
npx expo lint                    # lint
npx tsx --test tests/*.test.ts   # engine tests (jump/coyote/buffer/wall/dash/hazards/rooms/levels/TMX/save/input)
npx tsx scripts/solve.ts         # prove each built-in level can be beaten (auto-run; add --manual for run pads)
```
