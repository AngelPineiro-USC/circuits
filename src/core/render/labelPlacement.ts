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
  // soft "near-miss" penalties (encourage breathing room even when not overlapping)
  nearDistPx?: number; // default 10
  nearPenalty?: number; // default 30 per px^2 under nearDist
  // local refinement passes (coordinate-descent style)
  refinePasses?: number; // default 2
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

function rectGap(a: Rect, b: Rect): number {
  // Euclidean distance between two axis-aligned rectangles (0 if overlapping).
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;

  const dx = Math.max(0, b.x - ax2, a.x - bx2);
  const dy = Math.max(0, b.y - ay2, a.y - by2);
  return Math.hypot(dx, dy);
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
  const nearDistPx = opts.nearDistPx ?? 10;
  const nearPenalty = opts.nearPenalty ?? 30;
  const refinePasses = opts.refinePasses ?? 2;

  const vp = opts.viewport;
  const obstacles = opts.obstacles ?? [];

  const metric = { fontSizePx, charWidthPx, paddingPx };

  function scoreRect(rect: Rect, dx: number, dy: number, ignoreIndex: number | null, placed: PlacedLabel[]): number {
    let score = 0;

    // Hard overlaps
    for (let i = 0; i < placed.length; i++) {
      if (ignoreIndex !== null && i === ignoreIndex) continue;
      score += overlapArea(rect, placed[i].rect) * overlapPenalty;
    }
    for (const o of obstacles) score += overlapArea(rect, o) * overlapPenalty;

    // Soft "near-miss" penalties
    if (nearDistPx > 0 && nearPenalty > 0) {
      for (let i = 0; i < placed.length; i++) {
        if (ignoreIndex !== null && i === ignoreIndex) continue;
        const g = rectGap(rect, placed[i].rect);
        if (g < nearDistPx) score += (nearDistPx - g) * (nearDistPx - g) * nearPenalty;
      }
      for (const o of obstacles) {
        const g = rectGap(rect, o);
        if (g < nearDistPx) score += (nearDistPx - g) * (nearDistPx - g) * nearPenalty;
      }
    }

    // Outside viewport
    score += outsideArea(rect, vp) * outsidePenalty;

    // Distance penalty to keep close-ish
    score += (dx * dx + dy * dy) * 0.05;

    return score;
  }

  function bestForLabel(lab: Label, ignoreIndex: number | null, placed: PlacedLabel[]): PlacedLabel {
    let best: PlacedLabel | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const c of lab.candidates) {
      const x = lab.anchor.x + c.dx;
      const y = lab.anchor.y + c.dy;
      const rect = rectForText(x, y, lab.text, metric);
      const score = scoreRect(rect, c.dx, c.dy, ignoreIndex, placed);
      if (score < bestScore) {
        bestScore = score;
        best = { id: lab.id, text: lab.text, x, y, rect };
      }
    }

    if (!best) {
      const rect = rectForText(lab.anchor.x, lab.anchor.y, lab.text, metric);
      best = { id: lab.id, text: lab.text, x: lab.anchor.x, y: lab.anchor.y, rect };
    }

    return best;
  }

  // Initial greedy placement.
  const placed: PlacedLabel[] = [];
  for (const lab of labels) placed.push(bestForLabel(lab, null, placed));

  // Second-pass refinement: iterate a few times and allow labels to move given the others.
  for (let pass = 0; pass < refinePasses; pass++) {
    for (let i = 0; i < labels.length; i++) {
      placed[i] = bestForLabel(labels[i], i, placed);
    }
  }

  return placed;
}
