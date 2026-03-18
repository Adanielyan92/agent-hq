import type { FurnitureEntry, OfficeLayout } from './types';
import { TileType } from './types';

// Floor color variants (fallback if PNG fails to load)
const WARM_LEFT  = '#c8a87a';
const WARM_RIGHT = '#b89060';
const HALL_COLOR = '#a07850';
const WALL_COLOR = '#3a3028';
const VOID_COLOR = 'transparent';
const LOUNGE_COLOR = '#9a6840';

/**
 * Agent index → role:
 *   0 orchestrator  (left wing, near hallway — walks between teams)
 *   1 implementer   (left wing)
 *   2 reviewer      (left wing, below implementer — visits impl desk)
 *   3 ci_runner     (right wing)
 *   4 board_sync    (right wing)
 *   5 pipeline      (right wing)
 */
export const AGENT_SEAT_INDEX = {
  orchestrator: 0,
  implementer:  1,
  reviewer:     2,
  ci_runner:    3,
  board_sync:   4,
  pipeline:     5,
} as const;

/** Build the agent-hq office layout: 24 cols × 16 rows */
export function createAgentHqLayout(): OfficeLayout {
  const COLS = 24;
  const ROWS = 16;

  const W  = TileType.WALL;
  const F1 = TileType.FLOOR_1; // left wing
  const F2 = TileType.FLOOR_2; // right wing
  const F3 = TileType.FLOOR_3; // hallway
  const F4 = TileType.FLOOR_4; // break room (both sides)
  const V  = TileType.VOID;

  // Break room rows: 10-14
  const BREAK_ROW_START = 10;

  const tiles: TileType[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const isEdge = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1;
      if (isEdge) {
        tiles.push(W);
      } else if (c >= 1 && c <= 10) {
        tiles.push(r >= BREAK_ROW_START ? F4 : F1);
      } else if (c === 11 || c === 12) {
        tiles.push(F3); // hallway
      } else if (c >= 13 && c <= 22) {
        tiles.push(r >= BREAK_ROW_START ? F4 : F2);
      } else {
        tiles.push(W);
      }
    }
  }

  const tileColors: string[] = tiles.map((t) => {
    switch (t) {
      case TileType.WALL:    return WALL_COLOR;
      case TileType.FLOOR_1: return WARM_LEFT;
      case TileType.FLOOR_2: return WARM_RIGHT;
      case TileType.FLOOR_3: return HALL_COLOR;
      case TileType.FLOOR_4: return LOUNGE_COLOR;
      default: return VOID_COLOR;
    }
  });

  // ── Furniture ──────────────────────────────────────────────
  let uid = 1;
  const id = () => `seat-${uid++}`;

  /**
   * Desk setup: characters face UP (WOODEN_CHAIR_BACK) toward their PC.
   * Chair is placed directly in front of (2 rows below) the PC column.
   *
   *  col:   deskCol    deskCol+1  deskCol+2
   *         [empty]   [PC_BACK]   [empty]
   *         [DESK---   DESK----   DESK--]
   *         [empty]   [CHAIR]     [empty]   ← deskRow+2: character sits here
   */
  const desk = (deskCol: number, deskRow: number, agentIdx: number) => [
    { uid: id(), type: 'DESK_FRONT',        col: deskCol,         row: deskRow },
    { uid: `pc-agent-${agentIdx}`, type: 'PC_BACK', col: deskCol + 1, row: deskRow },
    { uid: id(), type: 'WOODEN_CHAIR_BACK', col: deskCol + 1, row: deskRow + 2 },
  ];

  const furniture: FurnitureEntry[] = [
    // ── Left wing desks ────────────────────────────────────
    // Agent 0 – Orchestrator: col 1 (near hallway for easy access)
    ...desk(1, 3, 0),
    // Agent 1 – Implementer
    ...desk(6, 3, 1),
    // Agent 2 – Reviewer (below implementer, walks over to review)
    ...desk(1, 6, 2),

    // ── Right wing desks ───────────────────────────────────
    // Agent 3 – CI Runner
    ...desk(13, 3, 3),
    // Agent 4 – Board Sync
    ...desk(18, 3, 4),
    // Agent 5 – Pipeline
    ...desk(13, 6, 5),

    // ── Orchestrator private retreat (row 6, cols 2-3) ────
    { uid: id(), type: 'CUSHIONED_CHAIR_FRONT', col: 2, row: 5 },
    { uid: id(), type: 'COFFEE',                col: 3, row: 5 },

    // ── Whiteboard (left wing, shared) ───────────────────
    { uid: id(), type: 'WHITEBOARD', col: 7, row: 6 },

    // ── Break room – Left lounge ──────────────────────────
    // Sofa facing camera (SOFA_BACK = back visible, agents face DOWN)
    { uid: id(), type: 'SOFA_BACK',            col: 2,  row: 11 },
    { uid: id(), type: 'COFFEE_TABLE',          col: 2,  row: 13 },
    { uid: id(), type: 'CUSHIONED_CHAIR_SIDE',  col: 1,  row: 13 },
    { uid: id(), type: 'CUSHIONED_CHAIR_SIDE',  col: 5,  row: 13, mirrored: true },

    // ── Break room – Right lounge ─────────────────────────
    { uid: id(), type: 'SOFA_BACK',            col: 15, row: 11 },
    { uid: id(), type: 'COFFEE_TABLE',          col: 15, row: 13 },
    { uid: id(), type: 'CUSHIONED_CHAIR_SIDE',  col: 13, row: 13 },
    { uid: id(), type: 'CUSHIONED_CHAIR_SIDE',  col: 18, row: 13, mirrored: true },

    // ── Decorative ────────────────────────────────────────
    // Plants placed in open corners — away from desks and PC tiles
    { uid: id(), type: 'PLANT',        col: 5,  row: 1  }, // left wing top, between orch+impl desks
    { uid: id(), type: 'PLANT',        col: 9,  row: 1  }, // left wing top right
    { uid: id(), type: 'PLANT',        col: 16, row: 1  }, // right wing top, between CI+boardsync desks
    { uid: id(), type: 'PLANT',        col: 22, row: 1  }, // right wing top corner
    { uid: id(), type: 'LARGE_PLANT',  col: 1,  row: 10 },
    { uid: id(), type: 'LARGE_PLANT',  col: 10, row: 10 },
    { uid: id(), type: 'LARGE_PLANT',  col: 13, row: 10 },
    { uid: id(), type: 'LARGE_PLANT',  col: 22, row: 10 },
    { uid: id(), type: 'DOUBLE_BOOKSHELF', col: 9, row: 5 },
    { uid: id(), type: 'DOUBLE_BOOKSHELF', col: 20, row: 5 },
    { uid: id(), type: 'BIN',          col: 9,  row: 14 },
    { uid: id(), type: 'BIN',          col: 14, row: 14 },
  ];

  return { cols: COLS, rows: ROWS, tiles, tileColors, furniture };
}

/**
 * Orchestrator retreat tiles – where the orchestrator hangs out when idle.
 * Rows 4-5 of the left wing, below their desk and above the reviewer.
 */
export const ORCHESTRATOR_RETREAT_TILES = [
  { col: 1, row: 4 }, { col: 2, row: 4 }, { col: 3, row: 4 }, { col: 4, row: 4 },
  { col: 1, row: 5 }, { col: 2, row: 5 }, { col: 3, row: 5 }, { col: 4, row: 5 },
];

/**
 * Lounge seating positions – idle agents are teleported here instantly.
 * These are the actual sofa and cushioned-chair seat tiles.
 */
export const LOUNGE_TILES = [
  // Left lounge — sofa seats (face DOWN) + cushioned chairs
  { col: 2,  row: 11 },
  { col: 3,  row: 11 },
  { col: 1,  row: 13 },
  { col: 5,  row: 13 },
  // Right lounge — sofa seats + cushioned chairs
  { col: 15, row: 11 },
  { col: 16, row: 11 },
  { col: 13, row: 13 },
  { col: 18, row: 13 },
];

// ── Furniture metadata ────────────────────────────────────────

export interface FurnitureMeta {
  png: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  /** First N rows of footprint are background (walkable) */
  backgroundTiles: number;
  isChair: boolean;
  chairOrientation?: 'front' | 'back' | 'side';
  isDesk?: boolean;
}

export const FURNITURE_META: Record<string, FurnitureMeta> = {
  DESK_FRONT: {
    png: '/assets/furniture/DESK/DESK_FRONT.png',
    width: 48, height: 32,
    footprintW: 3, footprintH: 2,
    backgroundTiles: 1,
    isChair: false, isDesk: true,
  },
  DESK_SIDE: {
    png: '/assets/furniture/DESK/DESK_SIDE.png',
    width: 16, height: 64,
    footprintW: 1, footprintH: 4,
    backgroundTiles: 1,
    isChair: false, isDesk: true,
  },
  WOODEN_CHAIR_FRONT: {
    png: '/assets/furniture/WOODEN_CHAIR/WOODEN_CHAIR_FRONT.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 1,
    isChair: true, chairOrientation: 'front',
  },
  WOODEN_CHAIR_BACK: {
    png: '/assets/furniture/WOODEN_CHAIR/WOODEN_CHAIR_BACK.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 1,
    isChair: true, chairOrientation: 'back',
  },
  WOODEN_CHAIR_SIDE: {
    png: '/assets/furniture/WOODEN_CHAIR/WOODEN_CHAIR_SIDE.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 1,
    isChair: true, chairOrientation: 'side',
  },
  PC_FRONT_OFF: {
    png: '/assets/furniture/PC/PC_FRONT_OFF.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 2,
    isChair: false,
  },
  PC_FRONT_ON_1: {
    png: '/assets/furniture/PC/PC_FRONT_ON_1.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 2,
    isChair: false,
  },
  PC_FRONT_ON_2: {
    png: '/assets/furniture/PC/PC_FRONT_ON_2.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 2,
    isChair: false,
  },
  PC_FRONT_ON_3: {
    png: '/assets/furniture/PC/PC_FRONT_ON_3.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 2,
    isChair: false,
  },
  // PC_BACK: monitor back visible — character faces the screen (character faces UP toward it)
  PC_BACK: {
    png: '/assets/furniture/PC/PC_BACK.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 2,
    isChair: false,
  },
  PLANT: {
    png: '/assets/furniture/PLANT/PLANT.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 2,
    isChair: false,
  },
  PLANT_2: {
    png: '/assets/furniture/PLANT_2/PLANT_2.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 0,
    isChair: false,
  },
  LARGE_PLANT: {
    png: '/assets/furniture/LARGE_PLANT/LARGE_PLANT.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 0,
    isChair: false,
  },
  DOUBLE_BOOKSHELF: {
    png: '/assets/furniture/DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png',
    width: 32, height: 32,
    footprintW: 2, footprintH: 2,
    backgroundTiles: 0,
    isChair: false,
  },
  HANGING_PLANT: {
    png: '/assets/furniture/HANGING_PLANT/HANGING_PLANT.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 1,
    backgroundTiles: 1,
    isChair: false,
  },
  BIN: {
    png: '/assets/furniture/BIN/BIN.png',
    width: 16, height: 16,
    footprintW: 1, footprintH: 1,
    backgroundTiles: 0,
    isChair: false,
  },
  COFFEE: {
    png: '/assets/furniture/COFFEE/COFFEE.png',
    width: 16, height: 16,
    footprintW: 1, footprintH: 1,
    backgroundTiles: 1,
    isChair: false,
  },
  // Break room furniture
  SOFA_BACK: {
    // Back of sofa visible; agents sit on it facing DOWN (toward camera)
    png: '/assets/furniture/SOFA/SOFA_BACK.png',
    width: 32, height: 16,
    footprintW: 2, footprintH: 1,
    backgroundTiles: 1, // agents can sit here
    isChair: true, chairOrientation: 'front',
  },
  SOFA_FRONT: {
    png: '/assets/furniture/SOFA/SOFA_FRONT.png',
    width: 32, height: 16,
    footprintW: 2, footprintH: 1,
    backgroundTiles: 0,
    isChair: false,
  },
  SOFA_SIDE: {
    png: '/assets/furniture/SOFA/SOFA_SIDE.png',
    width: 16, height: 32,
    footprintW: 1, footprintH: 2,
    backgroundTiles: 1,
    isChair: true, chairOrientation: 'side',
  },
  COFFEE_TABLE: {
    png: '/assets/furniture/COFFEE_TABLE/COFFEE_TABLE.png',
    width: 32, height: 32,
    footprintW: 2, footprintH: 2,
    backgroundTiles: 0,
    isChair: false,
  },
  CUSHIONED_CHAIR_FRONT: {
    png: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png',
    width: 16, height: 16,
    footprintW: 1, footprintH: 1,
    backgroundTiles: 1,
    isChair: true, chairOrientation: 'front',
  },
  CUSHIONED_CHAIR_BACK: {
    png: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_BACK.png',
    width: 16, height: 16,
    footprintW: 1, footprintH: 1,
    backgroundTiles: 1,
    isChair: true, chairOrientation: 'back',
  },
  CUSHIONED_CHAIR_SIDE: {
    // Right-facing; mirrored=true gives left-facing
    png: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_SIDE.png',
    width: 16, height: 16,
    footprintW: 1, footprintH: 1,
    backgroundTiles: 1,
    isChair: true, chairOrientation: 'side',
  },
  WHITEBOARD: {
    png: '/assets/furniture/WHITEBOARD/WHITEBOARD.png',
    width: 32, height: 32,
    footprintW: 2, footprintH: 2,
    backgroundTiles: 0,
    isChair: false,
  },
  SMALL_TABLE_FRONT: {
    png: '/assets/furniture/SMALL_TABLE/SMALL_TABLE_FRONT.png',
    width: 32, height: 32,
    footprintW: 2, footprintH: 2,
    backgroundTiles: 1,
    isChair: false,
  },
};
