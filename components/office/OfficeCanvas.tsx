'use client';
import { useEffect, useRef } from 'react';

// ── Warm palette ──────────────────────────────────────────────────
const W = {
  bg:          '#0f0b06',

  // Wood floor
  tileA:       '#5a3820',
  tileB:       '#4a2e18',
  tileEdge:    '#2e1a0c',
  tileTopHi:   '#6a4428',
  tileSideHi:  'rgba(255,200,100,0.06)',

  // Wall
  wall:        '#0c0906',
  wallFace:    '#160e07',
  wallEdge:    '#5a3010',
  wainscot:    '#3a2010',   // lower wall wainscoting

  // Windows
  winSky:      '#05070e',
  winFrame:    '#4a2a0e',
  winFrameHi:  '#6a3c18',
  winGlass:    'rgba(100,130,230,0.07)',

  // Ceiling
  ceilDark:    '#0a0805',
  lightBar:    '#ffe860',
  lightEndcap: '#fff4a0',
  lightGlow0:  'rgba(255,220,80,0.14)',
  lightGlow1:  'rgba(255,200,60,0.04)',
  lightGlow2:  'rgba(255,180,40,0.00)',

  // Corridor
  corridor:    '#3a2210',
  corrEdge:    '#7a4818',

  // Plants
  pot:         '#7a3c22',
  potDark:     '#4d2414',
  potRim:      '#8a4828',
  stem:        '#2a5225',
  leaf:        '#3d7535',
  leafHi:      '#52a048',
  leafDark:    '#255020',

  // Shelf + books
  shelfWood:   '#3a2010',
  shelfDark:   '#251408',
  bookColors:  ['#8b2020','#204898','#207842','#786020','#982870','#287878'],

  // Zone hints
  zoneL:       'rgba(80,42,18,0.12)',
  zoneR:       'rgba(65,32,12,0.14)',
  slotHint:    'rgba(160,90,35,0.05)',
};

const T = 16;   // logical tile px

// ── Seeded pseudo-random (deterministic) ─────────────────────────
function seeded(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ── Plant sprite ─────────────────────────────────────────────────
function drawPlant(
  ctx: CanvasRenderingContext2D,
  cx: number, by: number
) {
  const s = 1; // scale factor

  // Pot body
  ctx.fillStyle = W.potDark;
  ctx.fillRect(cx - 5*s, by - 5*s, 10*s, 5*s);
  ctx.fillStyle = W.pot;
  ctx.fillRect(cx - 6*s, by - 6*s, 12*s, 5*s);
  // Pot rim
  ctx.fillStyle = W.potRim;
  ctx.fillRect(cx - 7*s, by - 7*s, 14*s, 2*s);

  // Stem
  ctx.fillStyle = W.stem;
  ctx.fillRect(cx - 1*s, by - 13*s, 2*s, 7*s);

  // Leaves (layered, slightly randomized per plant)
  ctx.fillStyle = W.leafDark;
  ctx.fillRect(cx - 7*s, by - 15*s, 7*s, 6*s);
  ctx.fillRect(cx,        by - 16*s, 7*s, 6*s);
  ctx.fillRect(cx - 9*s,  by - 11*s, 5*s, 5*s);
  ctx.fillRect(cx + 4*s,  by - 11*s, 5*s, 5*s);

  ctx.fillStyle = W.leaf;
  ctx.fillRect(cx - 6*s, by - 14*s, 6*s, 5*s);
  ctx.fillRect(cx + 1*s,  by - 15*s, 6*s, 5*s);
  ctx.fillRect(cx - 8*s,  by - 10*s, 4*s, 4*s);
  ctx.fillRect(cx + 5*s,  by - 10*s, 4*s, 4*s);

  ctx.fillStyle = W.leafHi;
  ctx.fillRect(cx - 5*s, by - 14*s, 2*s, 2*s);
  ctx.fillRect(cx + 2*s,  by - 15*s, 2*s, 2*s);
}

// ── Small bookshelf segment ───────────────────────────────────────
function drawShelf(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, shelfW: number,
  seed: number
) {
  const bookH = T - 2;

  // Shelf backing
  ctx.fillStyle = W.shelfWood;
  ctx.fillRect(x, y, shelfW, bookH + 3);
  ctx.fillStyle = W.shelfDark;
  ctx.fillRect(x, y + bookH + 2, shelfW, 1);

  // Books packed left-to-right
  const bookW = 6;
  const gap   = 1;
  let bx = x + 2;
  let idx = 0;
  while (bx + bookW + 2 <= x + shelfW) {
    const h = bookH - (seeded(seed + idx * 3) > 0.7 ? 3 : 0);
    ctx.fillStyle = W.bookColors[idx % W.bookColors.length];
    ctx.fillRect(bx, y + bookH - h + 1, bookW, h);
    // Spine shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(bx + bookW - 1, y + bookH - h + 1, 1, h);
    // Top edge
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx, y + bookH - h + 1, bookW - 1, 1);
    bx += bookW + gap;
    idx++;
  }
}

// ── Main draw function ────────────────────────────────────────────
function drawOffice(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cols     = Math.ceil(w / T) + 2;
  const rows     = Math.ceil(h / T) + 2;
  const wallRows = 3;
  const wallPx   = wallRows * T;

  // ── 1. Background ───────────────────────────────────────────────
  ctx.fillStyle = W.bg;
  ctx.fillRect(0, 0, w, h);

  // ── 2. Warm wood floor tiles ─────────────────────────────────────
  for (let r = wallRows; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const even = (c + r) % 2 === 0;
      ctx.fillStyle = even ? W.tileA : W.tileB;
      ctx.fillRect(c * T, r * T, T, T);

      // 3D top highlight on lighter tiles
      if (even) {
        ctx.fillStyle = W.tileTopHi;
        ctx.fillRect(c * T, r * T, T, 1);
        ctx.fillStyle = W.tileSideHi;
        ctx.fillRect(c * T, r * T, 1, T);
      }
    }
  }
  // Tile joint grid
  ctx.fillStyle = W.tileEdge;
  for (let r = wallRows; r <= rows; r++) {
    ctx.fillRect(0, r * T, w, 1);
  }
  for (let c = 0; c <= cols; c++) {
    ctx.fillRect(c * T, wallPx, 1, h - wallPx);
  }

  // ── 3. Wall strip ────────────────────────────────────────────────
  for (let r = 0; r < wallRows; r++) {
    ctx.fillStyle = r === 0 ? W.wall : W.wallFace;
    ctx.fillRect(0, r * T, w, T);
  }

  // Wainscot panel at bottom of wall
  ctx.fillStyle = W.wainscot;
  ctx.fillRect(0, wallPx - T * 0.6, w, T * 0.6 + 1);

  // Wall / floor junction warm highlight
  ctx.fillStyle = W.wallEdge;
  ctx.fillRect(0, wallPx - 2, w, 3);
  ctx.fillStyle = W.wall;
  ctx.fillRect(0, wallPx - 2, w, 1);

  // ── 4. Ceiling strip + warm fluorescent lights ───────────────────
  ctx.fillStyle = W.ceilDark;
  ctx.fillRect(0, 0, w, 3);

  const lightCount   = Math.max(2, Math.floor(w / 120));
  const lightSpacing = w / (lightCount + 1);

  for (let i = 1; i <= lightCount; i++) {
    const lx = Math.round(i * lightSpacing - 24);
    const lw = 48;

    // Glow projected down through wall onto floor
    const gradFull = ctx.createLinearGradient(lx + lw / 2, 0, lx + lw / 2, h);
    gradFull.addColorStop(0,   W.lightGlow0);
    gradFull.addColorStop(0.12, W.lightGlow1);
    gradFull.addColorStop(0.4,  W.lightGlow2);
    ctx.fillStyle = gradFull;
    ctx.fillRect(lx - 20, 0, lw + 40, h);

    // Light bar
    ctx.fillStyle = W.lightBar;
    ctx.fillRect(lx, 1, lw, 3);

    // Endcaps (bright)
    ctx.fillStyle = W.lightEndcap;
    ctx.fillRect(lx, 1, 3, 3);
    ctx.fillRect(lx + lw - 3, 1, 3, 3);
  }

  // ── 5. Windows in the wall ───────────────────────────────────────
  const winCount   = Math.max(3, Math.floor(w / 140));
  const winSpacing = w / (winCount + 1);

  for (let i = 1; i <= winCount; i++) {
    const wx = Math.round(i * winSpacing - T);
    const wy = 3;
    const ww = T * 2;
    const wh = wallPx - 7;
    const seed = i * 17;

    // Night sky
    ctx.fillStyle = W.winSky;
    ctx.fillRect(wx, wy, ww, wh);

    // Subtle stars (deterministic)
    for (let s = 0; s < 8; s++) {
      const sx = wx + 1 + Math.floor(seeded(seed + s * 11) * (ww - 2));
      const sy = wy + 1 + Math.floor(seeded(seed + s * 7 + 3) * (wh - 2));
      const brightness = seeded(seed + s * 5) > 0.6 ? 'rgba(220,235,255,0.9)' : 'rgba(180,200,240,0.5)';
      ctx.fillStyle = brightness;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Glass sheen
    ctx.fillStyle = W.winGlass;
    ctx.fillRect(wx, wy, 3, wh);

    // Outer wooden frame
    ctx.fillStyle = W.winFrame;
    ctx.fillRect(wx - 2, wy - 1, ww + 4, 2);
    ctx.fillRect(wx - 2, wy + wh, ww + 4, 2);
    ctx.fillRect(wx - 2, wy - 1, 2, wh + 3);
    ctx.fillRect(wx + ww, wy - 1, 2, wh + 3);

    // Frame highlight edge
    ctx.fillStyle = W.winFrameHi;
    ctx.fillRect(wx - 2, wy - 1, 2, 2);
    ctx.fillRect(wx + ww, wy - 1, 2, 2);

    // Center mullion
    ctx.fillStyle = W.winFrame;
    ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
  }

  // ── 6. Bookshelves along the back wall ───────────────────────────
  const shelfH = T;
  const shelfY = wallPx - shelfH - 2;
  // Left shelf segment
  drawShelf(ctx, T * 2, shelfY, Math.min(carpetXOf(w) - T * 3, T * 8), 1);
  // Right shelf segment
  const rShelfX = carpetXOf(w) + T * 4;
  drawShelf(ctx, rShelfX, shelfY, Math.min(w - rShelfX - T * 2, T * 8), 42);

  // ── 7. Center corridor (slightly darker warm wood) ───────────────
  const carpetX = carpetXOf(w);
  const carpetW = T * 3;

  for (let r = wallRows; r < rows; r++) {
    ctx.fillStyle = W.corridor;
    ctx.fillRect(carpetX, r * T, carpetW, T);
  }

  // Corridor edge warm lines
  ctx.fillStyle = W.corrEdge;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(carpetX,             wallPx, 2, h - wallPx);
  ctx.fillRect(carpetX + carpetW - 2, wallPx, 2, h - wallPx);
  ctx.globalAlpha = 1.0;

  // ── 8. Wing zone tints ────────────────────────────────────────────
  ctx.fillStyle = W.zoneL;
  ctx.fillRect(0, wallPx, carpetX, h - wallPx);
  ctx.fillStyle = W.zoneR;
  ctx.fillRect(carpetX + carpetW, wallPx, w - carpetX - carpetW, h - wallPx);

  // ── 9. Desk slot ghost highlights ────────────────────────────────
  const wingTop = wallPx;
  const wingH   = h - wingTop;
  const slotH   = wingH / 3;

  for (let i = 0; i < 3; i++) {
    const sy = wingTop + i * slotH;
    ctx.fillStyle = W.slotHint;
    ctx.fillRect(T,                       sy + T * 0.5, carpetX - T * 2,             slotH - T);
    ctx.fillRect(carpetX + carpetW + T,   sy + T * 0.5, w - carpetX - carpetW - T * 2, slotH - T);
    if (i > 0) {
      ctx.fillStyle = 'rgba(255,160,60,0.025)';
      ctx.fillRect(0, sy, carpetX, 1);
      ctx.fillRect(carpetX + carpetW, sy, w - carpetX - carpetW, 1);
    }
  }

  // ── 10. Corner plants (positioned in lower wing area) ────────────
  // Place plants at ~75% down the floor area so they're visible in wings
  const plantY = Math.round(wallPx + (h - wallPx) * 0.78);

  // Far left corner
  drawPlant(ctx, T + 8,                       plantY);
  // Far right corner
  drawPlant(ctx, w - T - 8,                   plantY);
  // Flanking the corridor
  if (w > 480) {
    drawPlant(ctx, carpetX - T * 2 - 2,       plantY);
    drawPlant(ctx, carpetX + carpetW + T + 6, plantY);
  }
}

function carpetXOf(w: number): number {
  return Math.round(w / 2 - T * 1.5);
}

// ── Component ─────────────────────────────────────────────────────
export function OfficeCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const render = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = window.devicePixelRatio || 1;
      const cw  = parent.clientWidth;
      const ch  = parent.clientHeight;

      if (
        canvas.width  !== Math.round(cw * dpr) ||
        canvas.height !== Math.round(ch * dpr)
      ) {
        canvas.width        = Math.round(cw * dpr);
        canvas.height       = Math.round(ch * dpr);
        canvas.style.width  = `${cw}px`;
        canvas.style.height = `${ch}px`;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      drawOffice(ctx, cw, ch);
    };

    render();

    const ro = new ResizeObserver(render);
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);

    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position:       'absolute',
        top:            0,
        left:           0,
        imageRendering: 'pixelated',
        pointerEvents:  'none',
        zIndex:         0,
      }}
    />
  );
}
