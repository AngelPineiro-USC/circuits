import type { Point } from "./svg";

export type Rect = { x: number; y: number; w: number; h: number };

export type Label = {
  id: string;
  text: string;
  anchor: Point; // where label is conceptually attached (element center)
  // candidates are offsets from anchor
  candidates: Array<{ dx: number; dy: number }>;
};

export type PlacedLabel = {
  id: string;
  text: string;
  x: number;
  y: number;
  rect: Rect;
};

export type PlacementOpts = {
  // approximate font metrics
  fontSizePx?: number; // default 12
  charWidthPx?: number; // default 7
  paddingPx?: number; // default 3
  // penalties
  overlapPenalty?: number; // default 1000 per px^2 overlap
  outsidePenalty?: number; // default 500 per px outside
  // viewport constraints
  viewport: Rect;
  // obstacles (nodes, symbols)
  obstacles?: Rect[];
};

function rectForText(x: number, y: number, text: string, opts: Required<Pick<PlacementOpts, "fontSizePx" | "charWidthPx" | "paddingPx">>): Rect {
  // We render text centered at (x,y).
  const w = text.length * opts.charWidthPx + 2 * opts.paddingPx;
  const h = opts.fontSizePx + 2 * opts.paddingPx;
  return { x: x - w / 2, y: y - h / 2, w, h };
}

function overlapArea(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const w = x2 - x1;
  const h = y2 - y1;
  return w > 0 && h > 0 ? w * h : 0;
}

function outsideArea(r: Rect, vp: Rect): number {
  // area outside viewport
  let area = 0;
  const left = Math.max(0, vp.x - r.x);
  const top = Math.max(0, vp.y - r.y);
  const right = Math.max(0, (r.x + r.w) - (vp.x + vp.w));
  const bottom = Math.max(0, (r.y + r.h) - (vp.y + vp.h));
  // approximate: outside strip areas
  area += left * r.h;
  area += right * r.h;
  area += top * r.w;
  area += bottom * r.w;
  return area;
}

export function placeLabels(labels: Label[], opts: PlacementOpts): PlacedLabel[] {
  const fontSizePx = opts.fontSizePx ?? 12;
  const charWidthPx = opts.charWidthPx ?? 7;
  const paddingPx = opts.paddingPx ?? 3;
  const overlapPenalty = opts.overlapPenalty ?? 1000;
  const outsidePenalty = opts.outsidePenalty ?? 500;
  const vp = opts.viewport;
  const obstacles = opts.obstacles ?? [];

  const metric = { fontSizePx, charWidthPx, paddingPx };

  const placed: PlacedLabel[] = [];

  // Greedy placement: choose best candidate given already placed labels.
  for (const lab of labels) {
    let best: PlacedLabel | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const c of lab.candidates) {
      const x = lab.anchor.x + c.dx;
      const y = lab.anchor.y + c.dy;
      const rect = rectForText(x, y, lab.text, metric);

      let score = 0;
      // penalize overlap with already placed
      for (const p of placed) score += overlapArea(rect, p.rect) * overlapPenalty;
      // penalize overlap with obstacles
      for (const o of obstacles) score += overlapArea(rect, o) * overlapPenalty;
      // penalize outside
      score += outsideArea(rect, vp) * outsidePenalty;
      // small distance penalty to keep close-ish
      score += (c.dx * c.dx + c.dy * c.dy) * 0.05;

      if (score < bestScore) {
        bestScore = score;
        best = { id: lab.id, text: lab.text, x, y, rect };
      }
    }

    // fallback: anchor itself
    if (!best) {
      const rect = rectForText(lab.anchor.x, lab.anchor.y, lab.text, metric);
      best = { id: lab.id, text: lab.text, x: lab.anchor.x, y: lab.anchor.y, rect };
    }

    placed.push(best);
  }

  return placed;
}
