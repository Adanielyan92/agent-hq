import { getCharFrameCol, isReadingTool, sittingOffset } from './characters';
import type { GameAssets } from './assetLoader';
import type { FurnitureInstance } from './officeState';
import {
  CHAR_DIR_ROW,
  CHAR_FRAME_H,
  CHAR_FRAME_W,
  CHARACTER_Z_SORT_OFFSET,
  CharacterState,
  Direction,
  TileType,
  TILE_SIZE,
} from './types';
import type { Character, OfficeLayout } from './types';

// ── Floor tile rendering ──────────────────────────────────────

const FLOOR_TILE_INDEX: Record<number, number> = {
  [TileType.FLOOR_1]: 0,
  [TileType.FLOOR_2]: 1,
  [TileType.FLOOR_3]: 2,
  [TileType.FLOOR_4]: 3,
  [TileType.FLOOR_5]: 4,
  [TileType.FLOOR_6]: 5,
  [TileType.FLOOR_7]: 6,
  [TileType.FLOOR_8]: 7,
  [TileType.FLOOR_9]: 8,
};

export function renderFloor(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  assets: GameAssets,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const s = TILE_SIZE * zoom;
  const tmRows = layout.rows;
  const tmCols = layout.cols;

  for (let r = 0; r < tmRows; r++) {
    for (let c = 0; c < tmCols; c++) {
      const tileIndex = r * tmCols + c;
      const tile = layout.tiles[tileIndex];

      if (tile === TileType.VOID) continue;

      const dx = offsetX + c * s;
      const dy = offsetY + r * s;

      if (tile === TileType.WALL) {
        ctx.fillStyle = layout.tileColors[tileIndex] ?? '#3a3028';
        ctx.fillRect(dx, dy, s, s);
        continue;
      }

      // Floor tile
      const floorIdx = FLOOR_TILE_INDEX[tile];
      const floorImg = floorIdx !== undefined ? assets.floorTiles[floorIdx] : null;

      if (floorImg) {
        ctx.drawImage(floorImg, 0, 0, TILE_SIZE, TILE_SIZE, dx, dy, s, s);
      } else {
        ctx.fillStyle = layout.tileColors[tileIndex] ?? '#808080';
        ctx.fillRect(dx, dy, s, s);
      }
    }
  }
}

// ── Z-drawable interface ──────────────────────────────────────

interface ZDrawable {
  zY: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

// ── Furniture rendering ────────────────────────────────────────

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  inst: FurnitureInstance,
  assets: GameAssets,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const img = assets.furniture.get(inst.type);
  if (!img) return;
  const dx = offsetX + inst.x * zoom;
  const dy = offsetY + inst.y * zoom;
  const dw = img.naturalWidth * zoom;
  const dh = img.naturalHeight * zoom;
  if (inst.mirrored) {
    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(img, dx, dy, dw, dh);
  }
}

// ── Character rendering ────────────────────────────────────────

const ORCH_SCALE = 1.35; // orchestrator renders bigger than others

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  ch: Character,
  assets: GameAssets,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const charImg = assets.characters[ch.paletteIndex % assets.characters.length];
  if (!charImg) return;

  const frameCol = getCharFrameCol(ch);
  const dirRow = CHAR_DIR_ROW[ch.dir];
  const isLeft = ch.dir === Direction.LEFT;

  const sx = frameCol * CHAR_FRAME_W;
  const sy = dirRow * CHAR_FRAME_H;
  const scale = ch.roleName === 'orchestrator' ? ORCH_SCALE : 1.0;
  const dw = CHAR_FRAME_W * zoom * scale;
  const dh = CHAR_FRAME_H * zoom * scale;

  const offsetY_sit = sittingOffset(ch);
  // Anchor at bottom-center
  const drawX = Math.round(offsetX + ch.x * zoom - dw / 2);
  const drawY = Math.round(offsetY + (ch.y + offsetY_sit) * zoom - dh);

  ctx.save();
  if (isLeft) {
    ctx.translate(drawX + dw, drawY);
    ctx.scale(-1, 1);
    ctx.drawImage(charImg, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H, 0, 0, dw, dh);
  } else {
    ctx.drawImage(charImg, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H, drawX, drawY, dw, dh);
  }
  ctx.restore();
}

// ── Name tag above character ────────────────────────────────────

function drawNameTag(
  ctx: CanvasRenderingContext2D,
  ch: Character,
  offsetX: number,
  offsetY: number,
  zoom: number,
  isActive: boolean,
): void {
  if (!ch.roleName) return;
  const scale = ch.roleName === 'orchestrator' ? ORCH_SCALE : 1.0;
  const dw = CHAR_FRAME_W * zoom * scale;
  const dh = CHAR_FRAME_H * zoom * scale;
  const offsetY_sit = sittingOffset(ch);
  const drawX = Math.round(offsetX + ch.x * zoom - dw / 2);
  const drawY = Math.round(offsetY + (ch.y + offsetY_sit) * zoom - dh);

  const label = ch.roleName.replace('_', ' ');
  const fontSize = Math.max(7, 6 * zoom);
  ctx.font = `${Math.round(fontSize)}px monospace`;
  ctx.textBaseline = 'bottom';

  const textW = ctx.measureText(label).width;
  const padX = 3 * (zoom / 2);
  const padY = 2 * (zoom / 2);
  const tagW = textW + padX * 2;
  const tagH = fontSize + padY * 2;
  const tagX = drawX + dw / 2 - tagW / 2;
  const tagY = drawY - tagH - 2 * zoom;

  // Background pill
  ctx.fillStyle = isActive ? 'rgba(0, 210, 180, 0.85)' : 'rgba(80, 80, 100, 0.75)';
  ctx.beginPath();
  const r = tagH / 2;
  ctx.roundRect(tagX, tagY, tagW, tagH, r);
  ctx.fill();

  // Text
  ctx.fillStyle = isActive ? '#001a15' : '#ccc';
  ctx.fillText(label, tagX + padX, tagY + tagH - padY);

  // Tool bubble — shown when actively working with a named tool
  if (isActive && ch.state === CharacterState.TYPE && ch.currentTool) {
    const toolLabel = ch.currentTool.length > 12 ? ch.currentTool.slice(0, 11) + '…' : ch.currentTool;
    const toolFontSize = Math.max(6, 5 * zoom);
    ctx.font = `${Math.round(toolFontSize)}px monospace`;
    const toolW = ctx.measureText(toolLabel).width;
    const tPadX = 2.5 * (zoom / 2);
    const tPadY = 1.5 * (zoom / 2);
    const bubbleW = toolW + tPadX * 2;
    const bubbleH = toolFontSize + tPadY * 2;
    const bubbleX = drawX + dw / 2 - bubbleW / 2;
    const bubbleY = tagY - bubbleH - 1 * zoom;

    ctx.fillStyle = 'rgba(40, 40, 60, 0.88)';
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, bubbleH / 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(120, 200, 255, 0.9)';
    ctx.fillText(toolLabel, bubbleX + tPadX, bubbleY + bubbleH - tPadY);
  }
}

// ── Scene render (furniture + characters, Z-sorted) ────────────

export function renderScene(
  ctx: CanvasRenderingContext2D,
  furniture: FurnitureInstance[],
  characters: Character[],
  assets: GameAssets,
  offsetX: number,
  offsetY: number,
  zoom: number,
  showNameTags: boolean,
): void {
  const drawables: ZDrawable[] = [];

  // Add furniture
  for (const f of furniture) {
    const fCopy = f;
    drawables.push({
      zY: f.zY,
      draw: (c) => drawFurniture(c, fCopy, assets, offsetX, offsetY, zoom),
    });
  }

  // Add characters
  for (const ch of characters) {
    const chCopy = ch;
    const charZY = ch.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET;
    drawables.push({
      zY: charZY,
      draw: (c) => drawCharacter(c, chCopy, assets, offsetX, offsetY, zoom),
    });
    if (showNameTags) {
      drawables.push({
        zY: charZY + 0.001,
        draw: (c) => drawNameTag(c, chCopy, offsetX, offsetY, zoom, ch.isActive),
      });
    }
  }

  // Sort ascending by zY (lower = drawn first = behind)
  drawables.sort((a, b) => a.zY - b.zY);
  for (const d of drawables) d.draw(ctx);
}

// ── Main frame renderer ────────────────────────────────────────

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  layout: OfficeLayout,
  furniture: FurnitureInstance[],
  characters: Character[],
  assets: GameAssets,
  zoom: number,
): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const mapW = layout.cols * TILE_SIZE * zoom;
  const mapH = layout.rows * TILE_SIZE * zoom;
  const offsetX = Math.floor((canvasWidth - mapW) / 2);
  // Shift map down by 1 tile so characters at top desks have headroom above them.
  // The top wall row slides off-canvas; the canvas clip keeps everything clean.
  const offsetY = Math.floor((canvasHeight - mapH) / 2) + Math.round(TILE_SIZE * zoom);

  // Clip to canvas bounds so name tags / tool bubbles never bleed outside
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  ctx.clip();

  renderFloor(ctx, layout, assets, offsetX, offsetY, zoom);
  renderScene(ctx, furniture, characters, assets, offsetX, offsetY, zoom, true);

  ctx.restore();
}
