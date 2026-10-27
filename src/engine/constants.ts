/** World units: 1 tile = TILE px. Velocities are px/s, accelerations px/s². */
export const TILE = 8;
export const VIEW_TILES_H = 16;

export const PLAYER_W = 6;
export const PLAYER_H = 6;

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = 0.1;

export const RUN_SPEED = 90;
export const GROUND_ACCEL = 1600;
export const GROUND_DECEL = 2400;
export const AIR_ACCEL = 1100;
export const AIR_DECEL = 900;
export const OVERSPEED_DECEL = 420;

export const GRAVITY = 900;
export const MAX_FALL = 160;
export const HALF_GRAV_THRESHOLD = 40;

export const JUMP_SPEED = -105;
export const VAR_JUMP_TIME = 0.2;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER_TIME = 0.1;

export const WALL_SLIDE_MAX = 36;
export const WALL_JUMP_H = 130;
export const WALL_JUMP_FORCE_TIME = 0.16;
export const WALL_JUMP_CHECK = 2;
/** Auto-run wall drop: initial fall speed after releasing the wall. */
export const WALL_DROP_SPEED = 60;

export const DASH_SPEED = 240;
export const DASH_END_SPEED = 160;
export const DASH_TIME = 0.15;
export const DASH_FREEZE = 0.045;
export const DASH_BUFFER_TIME = 0.1;
export const DASH_UP_END_MULT = 0.75;

export const PAD_SPEED = -270;
export const CORNER_CORRECTION = 3;

export const ORB_RESPAWN = 2.5;
export const CRYSTAL_RESPAWN = 3.5;
/** Echo doors stay open this long (s) after an echo touches a plate. */
export const ECHO_HOLD = 1.5;
/** Longest attempt an echo remembers (fixed steps). */
export const ECHO_MAX_FRAMES = 120 * 60;
/** Horizontal wind: extra drift in px/s on top of the player's own speed. */
export const WIND_PUSH = 55;
/** Up-draft acceleration against gravity, and the fastest it lifts you. */
export const UPDRAFT_ACCEL = 1500;
export const UPDRAFT_MAX = -110;
/** Down-draft: extra downward drift in px/s. */
export const DOWNDRAFT_PUSH = 45;
export const CRUMBLE_SHAKE = 0.45;
export const CRUMBLE_RESPAWN = 2.2;
export const PORTAL_RADIUS = 4;

export const DEATH_TIME = 0.42;
export const RESPAWN_TIME = 0.14;
export const ROOM_TRANSITION_TIME = 0.32;
