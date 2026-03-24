import type { FurnitureEntry, OfficeLayout } from './types';
import { TileType } from './types';

// Floor color variants (same as standard layout)
const WARM_LEFT  = '#c8a87a';
const WARM_RIGHT = '#b89060';
const HALL_COLOR = '#a07850';
const WALL_COLOR = '#3a3028';
const VOID_COLOR = 'transparent';
const LOUNGE_COLOR = '#9a6840';

/** Build the large agent-hq office layout: 30 cols x 18 rows (supports 10 desks) */
export function createAgentHqLayoutLarge(): OfficeLayout {
  const COLS = 30;
  const ROWS = 18;

  const W  = TileType.WALL;
  const F1 = TileType.FLOOR_1; // left wing
  const F2 = TileType.FLOOR_2; // right wing
  const F3 = TileType.FLOOR_3; // hallway
  const F4 = TileType.FLOOR_4; // break room (both sides)
  const V  = TileType.VOID;

  // Break room rows: 12-16
  const BREAK_ROW_START = 12;

  const tiles: TileType[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const isEdge = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1;
      if (isEdge) {
        tiles.push(W);
      } else if (c >= 1 && c <= 13) {
        tiles.push(r >= BREAK_ROW_START ? F4 : F1);
      } else if (c === 14 || c === 15) {
        tiles.push(F3); // hallway
      } else if (c >= 16 && c <= 28) {
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
   *         [empty]   [CHAIR]     [empty]   <- deskRow+2: character sits here
   */
  const desk = (deskCol: number, deskRow: number, agentIdx: number) => [
    { uid: id(), type: 'DESK_FRONT',        col: deskCol,         row: deskRow },
    { uid: `pc-agent-${agentIdx}`, type: 'PC_BACK', col: deskCol + 1, row: deskRow },
    { uid: id(), type: 'WOODEN_CHAIR_BACK', col: deskCol + 1, row: deskRow + 2 },
  ];

  const furniture: FurnitureEntry[] = [
    // ── Left wing desks (5 desks) ─────────────────────────────
    // Row 1: three desks across the top
    // Agent 0 – Orchestrator: near hallway
    ...desk(1, 2, 0),
    // Agent 1 – Implementer
    ...desk(5, 2, 1),
    // Agent 2 – Reviewer
    ...desk(9, 2, 2),

    // Row 2: two desks below
    // Agent 3
    ...desk(1, 6, 3),
    // Agent 4
    ...desk(5, 6, 4),

    // ── Right wing desks (5 desks) ────────────────────────────
    // Row 1: three desks across the top
    // Agent 5
    ...desk(16, 2, 5),
    // Agent 6
    ...desk(20, 2, 6),
    // Agent 7
    ...desk(24, 2, 7),

    // Row 2: two desks below
    // Agent 8
    ...desk(16, 6, 8),
    // Agent 9
    ...desk(20, 6, 9),

    // ── Orchestrator private retreat (row 5, cols 9-10) ─────
    { uid: id(), type: 'CUSHIONED_CHAIR_FRONT', col: 10, row: 5 },
    { uid: id(), type: 'COFFEE',                col: 11, row: 5 },

    // ── Whiteboards ─────────────────────────────────────────
    { uid: id(), type: 'WHITEBOARD', col: 9, row: 6 },
    { uid: id(), type: 'WHITEBOARD', col: 24, row: 6 },

    // ── Break room – Left lounge ────────────────────────────
    // Sofa facing camera (SOFA_BACK = back visible, agents face DOWN)
    { uid: id(), type: 'SOFA_BACK',            col: 2,  row: 13 },
    { uid: id(), type: 'SOFA_BACK',            col: 6,  row: 13 },
    { uid: id(), type: 'COFFEE_TABLE',          col: 3,  row: 15 },
    { uid: id(), type: 'CUSHIONED_CHAIR_SIDE',  col: 1,  row: 15 },
    { uid: id(), type: 'CUSHIONED_CHAIR_SIDE',  col: 6,  row: 15, mirrored: true },
    { uid: id(), type: 'CUSHIONED_CHAIR_SIDE',  col: 9,  row: 15 },

    // ── Break room – Right lounge ───────────────────────────
    { uid: id(), type: 'SOFA_BACK',            col: 18, row: 13 },
    { uid: id(), type: 'SOFA_BACK',            col: 22, row: 13 },
    { uid: id(), type: 'COFFEE_TABLE',          col: 19, row: 15 },
    { uid: id(), type: 'CUSHIONED_CHAIR_SIDE',  col: 17, row: 15 },
    { uid: id(), type: 'CUSHIONED_CHAIR_SIDE',  col: 22, row: 15, mirrored: true },
    { uid: id(), type: 'CUSHIONED_CHAIR_SIDE',  col: 25, row: 15 },

    // ── Decorative ──────────────────────────────────────────
    // Plants in open corners — away from desks and PC tiles
    { uid: id(), type: 'PLANT',        col: 4,  row: 1  },
    { uid: id(), type: 'PLANT',        col: 8,  row: 1  },
    { uid: id(), type: 'PLANT',        col: 12, row: 1  },
    { uid: id(), type: 'PLANT',        col: 19, row: 1  },
    { uid: id(), type: 'PLANT',        col: 23, row: 1  },
    { uid: id(), type: 'PLANT',        col: 27, row: 1  },
    { uid: id(), type: 'LARGE_PLANT',  col: 1,  row: 12 },
    { uid: id(), type: 'LARGE_PLANT',  col: 13, row: 12 },
    { uid: id(), type: 'LARGE_PLANT',  col: 16, row: 12 },
    { uid: id(), type: 'LARGE_PLANT',  col: 28, row: 12 },
    { uid: id(), type: 'DOUBLE_BOOKSHELF', col: 12, row: 6 },
    { uid: id(), type: 'DOUBLE_BOOKSHELF', col: 26, row: 6 },
    { uid: id(), type: 'BIN',          col: 11, row: 16 },
    { uid: id(), type: 'BIN',          col: 17, row: 16 },
  ];

  return { cols: COLS, rows: ROWS, tiles, tileColors, furniture };
}

/**
 * Lounge seating positions for the large layout.
 * These are the actual sofa and cushioned-chair seat tiles.
 */
export const LOUNGE_TILES_LARGE = [
  // Left lounge — sofa seats (face DOWN) + cushioned chairs
  { col: 2,  row: 13 },
  { col: 3,  row: 13 },
  { col: 6,  row: 13 },
  { col: 7,  row: 13 },
  { col: 1,  row: 15 },
  { col: 6,  row: 15 },
  { col: 9,  row: 15 },
  // Right lounge — sofa seats + cushioned chairs
  { col: 18, row: 13 },
  { col: 19, row: 13 },
  { col: 22, row: 13 },
  { col: 23, row: 13 },
  { col: 17, row: 15 },
  { col: 22, row: 15 },
  { col: 25, row: 15 },
];
