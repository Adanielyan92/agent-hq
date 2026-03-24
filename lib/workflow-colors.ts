const PALETTE = [
  '#a78bfa', '#60a5fa', '#fbbf24', '#34d399',
  '#94a3b8', '#f472b6', '#fb923c', '#22d3ee',
];

export function colorForWorkflow(filename: string): string {
  let hash = 0;
  for (const ch of filename) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
