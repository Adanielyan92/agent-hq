// Game engine types — browser port of pixel-agents

export const TILE_SIZE = 16;

export const TileType = {
  WALL: 0,
  FLOOR_1: 1,
  FLOOR_2: 2,
  FLOOR_3: 3,
  FLOOR_4: 4,
  FLOOR_5: 5,
  FLOOR_6: 6,
  FLOOR_7: 7,
  FLOOR_8: 8,
  FLOOR_9: 9,
  VOID: 255,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

export const CharacterState = {
  IDLE: 'idle',
  WALK: 'walk',
  TYPE: 'type',
  LOUNGE: 'lounge', // sitting in break room, waiting for activation
} as const;
export type CharacterState = (typeof CharacterState)[keyof typeof CharacterState];

export const Direction = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

export interface Seat {
  uid: string;
  seatCol: number;
  seatRow: number;
  facingDir: Direction;
  assigned: boolean;
}

export type LoungeMode = 'idle' | 'coffee' | 'sleeping';

export interface Character {
  id: number;
  state: CharacterState;
  dir: Direction;
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;
  path: Array<{ col: number; row: number }>;
  moveProgress: number;
  currentTool: string | null;
  paletteIndex: number; // 0-5 → which char PNG to use
  frame: number;
  frameTimer: number;
  wanderTimer: number;
  wanderCount: number;
  wanderLimit: number;
  isActive: boolean;
  seatId: string | null;
  seatTimer: number;
  /** Role name for the name tag */
  roleName: string;
  /** Visual sub-state when lounging (idle / coffee / sleeping) */
  loungeMode: LoungeMode;
}

export interface FurnitureEntry {
  type: string;
  col: number;
  row: number;
  uid: string;
  /** Flip horizontally (for :left mirror variants) */
  mirrored?: boolean;
}

export interface OfficeLayout {
  cols: number;
  rows: number;
  /** Flat tile array [row * cols + col] */
  tiles: TileType[];
  furniture: FurnitureEntry[];
  /** Per-tile floor colors (for rendering) */
  tileColors: string[];
}

// ── Game constants ──────────────────────────────────────────
export const WALK_SPEED_PX_PER_SEC = 48;
export const WALK_FRAME_DURATION_SEC = 0.15;
export const TYPE_FRAME_DURATION_SEC = 0.3;
export const CHARACTER_SITTING_OFFSET_PX = 6;  // lounge/sofa seats
export const CHARACTER_TYPING_OFFSET_PX = 12;   // desk seats (shifts char into desk front face)
export const CHARACTER_Z_SORT_OFFSET = 0.5;
export const MAX_DELTA_TIME_SEC = 0.1;

export const WANDER_PAUSE_MIN_SEC = 2.0;
export const WANDER_PAUSE_MAX_SEC = 10.0;
export const WANDER_MOVES_BEFORE_REST_MIN = 2;
export const WANDER_MOVES_BEFORE_REST_MAX = 5;
export const SEAT_REST_MIN_SEC = 10.0;
export const SEAT_REST_MAX_SEC = 30.0;

// Sprite sheet layout per char_N.png (112 × 96)
export const CHAR_FRAME_W = 16;
export const CHAR_FRAME_H = 32;
export const CHAR_FRAMES_PER_ROW = 7;
export const CHAR_DIR_ROW: Record<Direction, number> = {
  [Direction.DOWN]: 0,
  [Direction.UP]: 1,
  [Direction.RIGHT]: 2,
  [Direction.LEFT]: 2, // same row, drawn mirrored
};
