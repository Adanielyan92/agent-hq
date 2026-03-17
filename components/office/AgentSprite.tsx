import type { AgentState } from '@/lib/types';

interface Props {
  sprite: string;   // 'manager' | 'developer' | 'reviewer' | 'builder' | 'scribe'
  state:  AgentState;
  color:  string;   // role accent color (shirt/body)
}

// ── Personal looks per sprite type ─────────────────────────────────
const LOOK: Record<string, { hair: string; skin: string }> = {
  manager:   { hair: '#2d1200', skin: '#f0c27f' },
  developer: { hair: '#3b1080', skin: '#d4956a' },
  reviewer:  { hair: '#5c2800', skin: '#f5d0a9' },
  builder:   { hair: '#0d2440', skin: '#c68642' },
  scribe:    { hair: '#1a1a2e', skin: '#e8b88a' },
};

type PixelRow = (string | null)[];
type PixelGrid = PixelRow[];

// ── Build pixel grid per-character ─────────────────────────────────
// Grid is 8 cols × 14 rows. Each logical pixel = PX×PX rendered.
function buildGrid(
  spriteType: string,
  H: string,
  S: string,
  B: string,
  state: AgentState
): PixelGrid {
  const _ = null;
  const L = '#1e293b';  // trousers
  const F = '#0f172a';  // shoes
  const W = 'rgba(255,255,255,0.28)'; // collar highlight

  // ── Face rows that vary by state ───────────────────────────────

  const eyeRow: PixelRow =
    state === 'sleeping' ? [_, S, H, S, S, H, S, _]   // closed eyes
    : state === 'failed' ? [_, H, _, S, S, _, H, _]   // X eyes (gap between pupils)
    :                      [_, S, H, S, S, H, S, _];  // normal — pupils = hair color

  const mouthRow: PixelRow =
    state === 'success'  ? [_, S, B, B, B, B, S, _]   // wide smile
    : state === 'failed' ? [_, H, S, S, S, S, H, _]   // frown corners down
    : state === 'working'? [_, S, _, B, B, _, S, _]   // focused/tense
    :                      [_, S, _, S, S, _, S, _];  // neutral

  // Arms row: working = right side arm raised upward
  const arm1: PixelRow =
    state === 'working'  ? [B, B, B, B, B, B, B, B]  // right arm extends
    : state === 'success'? [B, B, B, B, B, B, B, B]  // both arms raised
    :                      [B, B, B, B, B, B, B, _]; // normal

  const arm2: PixelRow =
    state === 'working'  ? [S, B, B, B, B, B, _, S]  // hand near keyboard
    : state === 'success'? [S, B, B, B, B, B, B, S]  // success pose
    :                      [S, B, B, B, B, B, _, S]; // resting

  // Collar style per role
  const collar: PixelRow =
    spriteType === 'developer' ? [_, _, B, B, B, B, _, _]  // hoodie — no collar
    : spriteType === 'manager' ? [_, _, H, B, B, H, _, _]  // dark tie
    :                            [_, W, B, B, B, B, W, _]; // white collar

  return [
    [_, _, H, H, H, H, _, _],  //  0 hair top
    [_, H, H, H, H, H, H, _],  //  1 hair
    [H, H, H, H, H, H, H, _],  //  2 hair wide
    [_, S, S, S, S, S, S, _],  //  3 face top
    eyeRow,                     //  4 eyes
    [_, S, S, S, S, S, S, _],  //  5 face mid
    mouthRow,                   //  6 mouth
    collar,                     //  7 collar
    arm1,                       //  8 body + arms
    arm2,                       //  9 body + arms
    [_, _, B, B, B, B, _, _],  // 10 lower body
    [_, _, L, L, L, L, _, _],  // 11 pants
    [_, _, L, L, L, L, _, _],  // 12 pants
    [_, _, F, F, F, F, _, _],  // 13 shoes
  ];
}

// ── Renderer ───────────────────────────────────────────────────────
const PX    = 4;  // CSS px per logical pixel (32×56px characters)
const COLS  = 8;
const ROWS  = 14;

export function AgentSprite({ sprite, state, color }: Props) {
  const look = LOOK[sprite] ?? LOOK.developer;
  const grid = buildGrid(sprite, look.hair, look.skin, color, state);

  const rects = grid.flatMap((row, r) =>
    row.map((fill, c) =>
      fill != null ? (
        <rect
          key={`${r}-${c}`}
          x={c * PX}
          y={r * PX}
          width={PX}
          height={PX}
          fill={fill}
          shapeRendering="crispEdges"
        />
      ) : null
    )
  ).filter(Boolean);

  return (
    <div
      className={`agent-character agent-${state}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <svg
        width={COLS * PX}
        height={ROWS * PX}
        viewBox={`0 0 ${COLS * PX} ${ROWS * PX}`}
        style={{ imageRendering: 'pixelated', display: 'block' }}
      >
        {rects}
      </svg>
      {state === 'sleeping' && <span className="zzz-bubble">zzz</span>}
    </div>
  );
}
