import { createAgentHqLayout, FURNITURE_META, LOUNGE_TILES } from './agentHqLayout';
import { createCharacter, updateCharacter } from './characters';
import { findPath, getWalkableTiles, isWalkable } from './tileMap';
import {
  CharacterState,
  Direction,
  TILE_SIZE,
} from './types';
import type { Character, FurnitureEntry, OfficeLayout, Seat, TileType } from './types';

// ── Layout helpers ──────────────────────────────────────────

function buildTileMap(layout: OfficeLayout): TileType[][] {
  const map: TileType[][] = [];
  for (let r = 0; r < layout.rows; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < layout.cols; c++) {
      row.push(layout.tiles[r * layout.cols + c]);
    }
    map.push(row);
  }
  return map;
}

function orientationToDir(orientation: string): Direction {
  switch (orientation) {
    case 'front': return Direction.DOWN;
    case 'back':  return Direction.UP;
    case 'left':  return Direction.LEFT;
    case 'side':
    case 'right': return Direction.RIGHT;
    default:      return Direction.DOWN;
  }
}

function buildSeats(furniture: FurnitureEntry[]): Map<string, Seat> {
  const seats = new Map<string, Seat>();
  for (const item of furniture) {
    const meta = FURNITURE_META[item.type];
    if (!meta?.isChair) continue;
    const facingDir = orientationToDir(meta.chairOrientation ?? 'front');
    // Only create seats for the walkable (background) rows of the footprint
    const seatRows = Math.max(1, meta.backgroundTiles);
    let seatCount = 0;
    for (let dr = 0; dr < seatRows; dr++) {
      for (let dc = 0; dc < meta.footprintW; dc++) {
        const seatUid = seatCount === 0 ? item.uid : `${item.uid}:${seatCount}`;
        seats.set(seatUid, {
          uid: seatUid,
          seatCol: item.col + dc,
          seatRow: item.row + dr,
          facingDir,
          assigned: false,
        });
        seatCount++;
      }
    }
  }
  return seats;
}

function buildBlockedTiles(furniture: FurnitureEntry[], excludeSeatTiles?: Set<string>): Set<string> {
  const blocked = new Set<string>();
  for (const item of furniture) {
    const meta = FURNITURE_META[item.type];
    if (!meta) continue;
    const bgRows = meta.backgroundTiles;
    for (let dr = 0; dr < meta.footprintH; dr++) {
      if (dr < bgRows) continue;
      for (let dc = 0; dc < meta.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`;
        if (excludeSeatTiles?.has(key)) continue;
        blocked.add(key);
      }
    }
  }
  return blocked;
}

// ── Rendered furniture instance ──────────────────────────────

export interface FurnitureInstance {
  type: string;
  uid?: string;
  /** Pixel x of top-left */
  x: number;
  /** Pixel y of top-left */
  y: number;
  /** Z-sort value */
  zY: number;
  mirrored: boolean;
}

function buildFurnitureInstances(furniture: FurnitureEntry[]): FurnitureInstance[] {
  // Pre-compute desk zY for surface items
  const deskZByTile = new Map<string, number>();
  for (const item of furniture) {
    const meta = FURNITURE_META[item.type];
    if (!meta?.isDesk) continue;
    const deskZY = item.row * TILE_SIZE + meta.height;
    for (let dr = 0; dr < meta.footprintH; dr++) {
      for (let dc = 0; dc < meta.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`;
        const prev = deskZByTile.get(key);
        if (prev === undefined || deskZY > prev) deskZByTile.set(key, deskZY);
      }
    }
  }

  return furniture.map((item) => {
    const meta = FURNITURE_META[item.type];
    if (!meta) return null;
    const x = item.col * TILE_SIZE;
    const y = item.row * TILE_SIZE;
    let zY = y + meta.height;

    // Chair Z-sort: front chairs cap to first row bottom
    if (meta.isChair) {
      zY = (item.row + 1) * TILE_SIZE;
    }

    // Surface items render in front of their desk
    if (meta.backgroundTiles === meta.footprintH) {
      for (let dr = 0; dr < meta.footprintH; dr++) {
        for (let dc = 0; dc < meta.footprintW; dc++) {
          const deskZ = deskZByTile.get(`${item.col + dc},${item.row + dr}`);
          if (deskZ !== undefined && deskZ + 0.5 > zY) zY = deskZ + 0.5;
        }
      }
    }

    return { type: item.type, uid: item.uid, x, y, zY, mirrored: item.mirrored ?? false };
  }).filter(Boolean) as FurnitureInstance[];
}

// ── OfficeState ──────────────────────────────────────────────

const PC_ON_FRAMES = ['PC_FRONT_ON_1', 'PC_FRONT_ON_2', 'PC_FRONT_ON_3'] as const;
const PC_ANIM_INTERVAL = 0.45; // seconds per frame

export class OfficeState {
  layout: OfficeLayout;
  tileMap: TileType[][];
  seats: Map<string, Seat>;
  blockedTiles: Set<string>;
  furnitureInstances: FurnitureInstance[];
  walkableTiles: Array<{ col: number; row: number }>;
  idleWalkableTiles: Array<{ col: number; row: number }>;
  private leftLoungeTiles: Array<{ col: number; row: number }>;
  private rightLoungeTiles: Array<{ col: number; row: number }>;
  characters: Map<number, Character> = new Map();
  /** agentId → FurnitureInstance for their PC */
  private pcByAgent: Map<number, FurnitureInstance> = new Map();
  private pcAnimTimer = 0;
  private pcAnimFrame = 0;


  constructor(layout?: OfficeLayout) {
    this.layout = layout ?? createAgentHqLayout();
    this.tileMap = buildTileMap(this.layout);
    this.seats = buildSeats(this.layout.furniture);
    const seatTiles = new Set([...this.seats.values()].map(s => `${s.seatCol},${s.seatRow}`));
    this.blockedTiles = buildBlockedTiles(this.layout.furniture, seatTiles);
    this.furnitureInstances = buildFurnitureInstances(this.layout.furniture);
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles);
    this.leftLoungeTiles  = LOUNGE_TILES.filter(t => t.col <= 10 && isWalkable(t.col, t.row, this.tileMap, this.blockedTiles));
    this.rightLoungeTiles = LOUNGE_TILES.filter(t => t.col >= 13 && isWalkable(t.col, t.row, this.tileMap, this.blockedTiles));
    this.idleWalkableTiles = [...this.leftLoungeTiles, ...this.rightLoungeTiles];

    // Build agent → PC instance map from uid tags
    for (const inst of this.furnitureInstances) {
      if (inst.uid?.startsWith('pc-agent-')) {
        const agentId = parseInt(inst.uid.slice('pc-agent-'.length), 10);
        if (!isNaN(agentId)) this.pcByAgent.set(agentId, inst);
      }
    }
  }

  /** Lounge tiles on the same side as the agent's assigned seat */
  private loungeForAgent(ch: Character): Array<{ col: number; row: number }> {
    const seat = ch.seatId ? this.seats.get(ch.seatId) : null;
    if (!seat) return this.idleWalkableTiles;
    return seat.seatCol <= 12 ? this.leftLoungeTiles : this.rightLoungeTiles;
  }

  private findFreeSeat(): string | null {
    for (const [uid, seat] of this.seats) {
      if (!seat.assigned) return uid;
    }
    return null;
  }

  private ownSeatKey(ch: Character): string | null {
    if (!ch.seatId) return null;
    const seat = this.seats.get(ch.seatId);
    if (!seat) return null;
    return `${seat.seatCol},${seat.seatRow}`;
  }

  private withOwnSeatUnblocked<T>(ch: Character, fn: () => T): T {
    const key = this.ownSeatKey(ch);
    const wasBlocked = key ? this.blockedTiles.has(key) : false;
    if (key) this.blockedTiles.delete(key);
    const result = fn();
    if (key && wasBlocked) this.blockedTiles.add(key);
    return result;
  }

  addAgent(id: number, paletteIndex: number, roleName: string): void {
    if (this.characters.has(id)) return;
    const seatId = this.findFreeSeat();
    let ch: Character;
    if (seatId) {
      const seat = this.seats.get(seatId)!;
      seat.assigned = true;
      ch = createCharacter(id, paletteIndex, seatId, seat, roleName);
    } else {
      const spawn = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)] ?? { col: 1, row: 1 };
      ch = createCharacter(id, paletteIndex, null, null, roleName);
      ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
      ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
      ch.tileCol = spawn.col;
      ch.tileRow = spawn.row;
    }
    this.characters.set(id, ch);
  }

  setAgentActive(id: number, active: boolean, tool?: string | null): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    const wasActive = ch.isActive;
    ch.isActive = active;
    if (tool !== undefined) ch.currentTool = tool;
    if (active && !wasActive) {
      // Agent just became active — clear any idle wandering
      ch.path = [];
      ch.moveProgress = 0;
    }
    if (!active) {
      ch.seatTimer = -1;
    }
  }

  sendToSeat(id: number): void {
    const ch = this.characters.get(id);
    if (!ch || !ch.seatId) return;
    const seat = this.seats.get(ch.seatId);
    if (!seat) return;
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles)
    );
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
    } else if (ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
      // Already at desk — sit down
      ch.state = CharacterState.TYPE;
      ch.dir = seat.facingDir;
    } else {
      // Path temporarily blocked — set IDLE so the game loop retries every frame
      ch.state = CharacterState.IDLE;
    }
  }

  /** Teleport an idle agent directly onto a lounge seat — no walking. */
  sendToLounge(id: number): void {
    const ch = this.characters.get(id);
    if (!ch || ch.isActive) return;

    const tiles = this.loungeForAgent(ch);
    if (tiles.length === 0) return;

    // Prefer tiles not already occupied by another lounging agent
    const occupied = new Set<string>();
    for (const [otherId, other] of this.characters) {
      if (otherId !== id && other.state === CharacterState.LOUNGE) {
        occupied.add(`${other.tileCol},${other.tileRow}`);
      }
    }
    const available = tiles.filter(t => !occupied.has(`${t.col},${t.row}`));
    const pool = available.length > 0 ? available : tiles;
    const target = pool[Math.floor(Math.random() * pool.length)]!;

    // Find the seat at that tile to get the correct facing direction
    let facingDir: Direction = Direction.DOWN;
    for (const seat of this.seats.values()) {
      if (seat.seatCol === target.col && seat.seatRow === target.row) {
        facingDir = seat.facingDir;
        break;
      }
    }

    ch.path = [];
    ch.moveProgress = 0;
    ch.tileCol = target.col;
    ch.tileRow = target.row;
    ch.x = target.col * TILE_SIZE + TILE_SIZE / 2;
    ch.y = target.row * TILE_SIZE + TILE_SIZE / 2;
    ch.state = CharacterState.LOUNGE;
    ch.dir = facingDir;
    ch.frame = 0;
    ch.frameTimer = 0;
  }

  /** Walk an agent to a target tile (for visiting another agent's desk) */
  walkToTile(id: number, col: number, row: number): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    if (!isWalkable(col, row, this.tileMap, this.blockedTiles)) return;
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, col, row, this.tileMap, this.blockedTiles)
    );
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
    }
  }

  update(dt: number): void {
    for (const ch of this.characters.values()) {
      const wanderTiles = ch.isActive ? this.walkableTiles : this.loungeForAgent(ch);
      this.withOwnSeatUnblocked(ch, () =>
        updateCharacter(ch, dt, wanderTiles, this.seats, this.tileMap, this.blockedTiles)
      );
    }

    // Animate PC monitor glow for active agents
    this.pcAnimTimer += dt;
    if (this.pcAnimTimer >= PC_ANIM_INTERVAL) {
      this.pcAnimTimer -= PC_ANIM_INTERVAL;
      this.pcAnimFrame = (this.pcAnimFrame + 1) % PC_ON_FRAMES.length;
    }
    for (const [agentId, inst] of this.pcByAgent) {
      const ch = this.characters.get(agentId);
      inst.type = ch?.isActive ? PC_ON_FRAMES[this.pcAnimFrame] : 'PC_BACK';
    }

  }

  getCharacters(): Character[] {
    return Array.from(this.characters.values());
  }
}
