import type { Circuit, Element, NodeId, Resistor, VSource, ISource } from "../types";
import { placeLabels, type Label, type Rect } from "./labelPlacement";

export type Point = { x: number; y: number };
export type NodePos = Record<NodeId, Point>;

export type RenderOptions = {
  width?: number;
  height?: number;
};

function el<T extends Element["kind"]>(e: Element, kind: T): e is Extract<Element, { kind: T }> {
  return e.kind === kind;
}

export function defaultLayout(circuit: Circuit): NodePos {
  // Simple deterministic layout for demo (later: real schematic layout).
  // Place nodes roughly in a rectangle.
  const nodes = circuit.nodes;
  const w = 520;
  const h = 280;

  // For our demo nodes, use a nice fixed placement.
  const known: Partial<NodePos> = {
    n0: { x: 70, y: 170 },
    n1: { x: 240, y: 70 },
    n2: { x: 450, y: 170 },
    n3: { x: 240, y: 300 },
  };

  const pos: NodePos = {};
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    pos[n] = known[n] ?? { x: 80 + ((i * 120) % w), y: 60 + (Math.floor(i / 4) * 120) % h };
  }
  return pos;
}

function polyline(points: Point[], stroke = "#0f172a", width = 2): string {
  const pts = points.map((p) => `${p.x},${p.y}`).join(" ");
  return `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`;
}

function circle(p: Point, r = 6, fill = "#111827"): string {
  return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" />`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(p: Point, t: string, dy = -10): string {
  const x = p.x + 8;
  const y = p.y + dy;
  return `<text x="${x}" y="${y}" font-family="ui-sans-serif, system-ui" font-size="12" fill="#111827">${escapeXml(t)}</text>`;
}

function elementLabel(p: Point, t: string): string {
  return `<text x="${p.x}" y="${p.y}" font-family="ui-sans-serif, system-ui" font-size="12" fill="#111827" text-anchor="middle" dominant-baseline="middle">${escapeXml(t)}</text>`;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function labelCandidates(dir: Point, kind: "R" | "V" | "I"): Array<{ dx: number; dy: number }> {
  const u = normalize(dir);
  const perp = normalize({ x: -u.y, y: u.x });

  // Candidate directions.
  // For resistors, we avoid along-the-element directions because they tend to place text on top of the zig-zag/wire.
  const base: Point[] = [
    perp,
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
    u,
    { x: -u.x, y: -u.y },
    { x: -perp.x, y: -perp.y },
  ].map(normalize);

  const dirs =
    kind === "R" ? base.filter((d) => Math.abs(d.x * u.x + d.y * u.y) < 0.7) : base;

  // Include a wider range so we can "escape" congested centers.
  const mags = kind === "R" ? [36, 46, 58, 72, 88, 104, 124] : [22, 28, 36, 46, 58, 72, 88, 104];

  const out: Array<{ dx: number; dy: number }> = [];
  for (const d of dirs) {
    for (const m of mags) out.push({ dx: d.x * m, dy: d.y * m });
  }

  // Pure axis-aligned offsets at larger radii.
  const axis = [
    { dx: 0, dy: -116 },
    { dx: 0, dy: 116 },
    { dx: -116, dy: 0 },
    { dx: 116, dy: 0 },
  ];
  out.push(...axis);

  return out;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function normalize(v: Point): Point {
  const d = Math.hypot(v.x, v.y);
  if (d < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / d, y: v.y / d };
}

function orthogonalRoute(p1: Point, p2: Point, prefer: "h" | "v" = "h"): Point[] {
  // Prefer orthogonal wiring (L-shape) for readability.
  if (p1.x === p2.x || p1.y === p2.y) return [p1, p2];

  const elbowH = { x: p2.x, y: p1.y }; // horizontal then vertical
  const elbowV = { x: p1.x, y: p2.y }; // vertical then horizontal

  if (prefer === "h") return [p1, elbowH, p2];
  return [p1, elbowV, p2];
}

function routeForElementId(p1: Point, p2: Point, id: string): Point[] {
  // Deterministically choose between the two L-shapes to reduce collisions.
  const h = hashStr(id);
  const prefer: "h" | "v" = h % 2 === 0 ? "h" : "v";
  return orthogonalRoute(p1, p2, prefer);
}

function polyLen(points: Point[]): number {
  let L = 0;
  for (let i = 0; i < points.length - 1; i++) L += dist(points[i], points[i + 1]);
  return L;
}

function pointAt(points: Point[], d: number): { p: Point; dir: Point } {
  // Point + direction along polyline at distance d.
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const seg = dist(a, b);
    if (acc + seg >= d) {
      const t = seg < 1e-9 ? 0 : (d - acc) / seg;
      const p = lerp(a, b, t);
      const dir = normalize({ x: b.x - a.x, y: b.y - a.y });
      return { p, dir };
    }
    acc += seg;
  }
  const a = points[points.length - 2] ?? points[0];
  const b = points[points.length - 1] ?? points[0];
  return { p: b, dir: normalize({ x: b.x - a.x, y: b.y - a.y }) };
}

function prefixTo(points: Point[], d: number): Point[] {
  const out: Point[] = [points[0]];
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const seg = dist(a, b);
    if (acc + seg >= d) {
      const t = seg < 1e-9 ? 0 : (d - acc) / seg;
      out.push(lerp(a, b, t));
      return out;
    }
    out.push(b);
    acc += seg;
  }
  return out;
}

function suffixFrom(points: Point[], d: number): Point[] {
  const total = polyLen(points);
  const start = Math.max(0, Math.min(total, d));

  // Build by walking forward and collecting from the start point.
  const out: Point[] = [];
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const seg = dist(a, b);
    if (acc + seg < start) {
      acc += seg;
      continue;
    }

    if (out.length === 0) {
      const t = seg < 1e-9 ? 0 : (start - acc) / seg;
      out.push(lerp(a, b, t));
    }

    out.push(b);
    acc += seg;
  }

  if (out.length === 0) out.push(points[points.length - 1]);
  return out;
}

function resistorZigZag(center: Point, dir: Point, length = 44, amp = 6, zigs = 6): string {
  const u = normalize(dir);
  const n = { x: -u.y, y: u.x };

  const pts: Point[] = [];
  const steps = zigs * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const along = (t - 0.5) * length;
    const side = i === 0 || i === steps ? 0 : (i % 2 === 0 ? -amp : amp);
    pts.push({ x: center.x + along * u.x + side * n.x, y: center.y + along * u.y + side * n.y });
  }
  return polyline(pts, "#0f172a", 2);
}

function arrow(center: Point, dir: Point, size = 9): string {
  const u = normalize(dir);
  const p2 = { x: center.x + u.x * 12, y: center.y + u.y * 12 };
  const angle = Math.atan2(u.y, u.x);
  const a1 = angle + Math.PI * 0.85;
  const a2 = angle - Math.PI * 0.85;
  const pA = { x: p2.x + size * Math.cos(a1), y: p2.y + size * Math.sin(a1) };
  const pB = { x: p2.x + size * Math.cos(a2), y: p2.y + size * Math.sin(a2) };
  return `<path d="M ${pA.x} ${pA.y} L ${p2.x} ${p2.y} L ${pB.x} ${pB.y}" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
}

export function renderCircuitSvg(circuit: Circuit, opts: RenderOptions = {}): string {
  const width = opts.width ?? 640;
  const height = opts.height ?? 360;
  const pos = defaultLayout(circuit);

  let body = "";

  // Obstacles: node markers + element symbols in the middle of element routes.
  // Make higher-degree (busier) nodes a bit "fatter" so labels are discouraged from crowding them.
  const degree = new Map<NodeId, number>();
  for (const n of circuit.nodes) degree.set(n, 0);
  for (const e of circuit.elements) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }

  const obstacles: Rect[] = [];
  for (const n of circuit.nodes) {
    const p = pos[n];
    const d = degree.get(n) ?? 0;
    const r = d >= 3 ? 18 : 14; // bigger around central junctions
    obstacles.push({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r });
  }

  // First pass: compute anchors/dirs for element labels.
  const labels: Label[] = [];

  // Wires/elements
  for (const e of circuit.elements) {
    const p1 = pos[e.a];
    const p2 = pos[e.b];
    const route = routeForElementId(p1, p2, e.id);
    const total = polyLen(route);
    const midD = total / 2;
    const c = pointAt(route, midD);

    if (el(e, "R")) {
      const r = e as Resistor;

      // Reserve space around the resistor zig-zag symbol so labels don't sit on top of it.
      // Approximate a bounding box that covers the symbol plus a bit of padding.
      const symLen = 46;
      const amp = 6;
      const u = normalize(c.dir);
      const n = normalize({ x: -u.y, y: u.x });
      const padU = symLen / 2 + 14;
      const padN = amp + 16;
      const dx = Math.abs(u.x) * padU + Math.abs(n.x) * padN;
      const dy = Math.abs(u.y) * padU + Math.abs(n.y) * padN;
      obstacles.push({ x: c.p.x - dx, y: c.p.y - dy, w: 2 * dx, h: 2 * dy });

      labels.push({
        id: r.id,
        text: `${r.id}  ${r.ohms} Ω`,
        anchor: c.p,
        candidates: labelCandidates(c.dir, "R"),
      });
    } else if (el(e, "V")) {
      const v = e as VSource;
      obstacles.push({ x: c.p.x - 16, y: c.p.y - 16, w: 32, h: 32 });
      labels.push({
        id: v.id,
        text: `${v.id}  ${v.volts} V`,
        anchor: c.p,
        candidates: labelCandidates(c.dir, "V"),
      });
    } else if (el(e, "I")) {
      const s = e as ISource;
      obstacles.push({ x: c.p.x - 16, y: c.p.y - 16, w: 32, h: 32 });
      labels.push({
        id: s.id,
        text: `${s.id}  ${s.amps} A`,
        anchor: c.p,
        candidates: labelCandidates(c.dir, "I"),
      });
    }
  }

  const placed = placeLabels(labels, {
    viewport: { x: 0, y: 0, w: width, h: height },
    obstacles,
    refinePasses: 3,
    nearDistPx: 12,
    nearPenalty: 35,
  });
  const placedById = new Map(placed.map((p) => [p.id, p]));

  // Second pass: render
  for (const e of circuit.elements) {
    const p1 = pos[e.a];
    const p2 = pos[e.b];
    const route = routeForElementId(p1, p2, e.id);
    const total = polyLen(route);
    const midD = total / 2;

    // Default: just draw the routed wire.
    const stroke = "#0f172a";

    if (el(e, "R")) {
      const r = e as Resistor;
      const symLen = 46;
      const d1 = Math.max(0, midD - symLen / 2);
      const d2 = Math.min(total, midD + symLen / 2);

      const c = pointAt(route, midD);
      const s1 = pointAt(route, d1);
      const s2 = pointAt(route, d2);

      body += polyline(prefixTo(route, d1), stroke, 2);
      body += polyline(suffixFrom(route, d2), stroke, 2);

      body += resistorZigZag(c.p, c.dir, symLen, 6, 6);

      // Current direction arrow (convention: a → b) near the symbol.
      body += arrow(c.p, c.dir);

      // Label offset (deterministic) to reduce collisions when multiple elements meet near a node.
      const pl = placedById.get(r.id);
      if (pl) body += elementLabel({ x: pl.x, y: pl.y }, pl.text);

      // Small junction markers at symbol endpoints to make the break clear.
      body += circle(s1.p, 2.2, "#0f172a");
      body += circle(s2.p, 2.2, "#0f172a");
    } else if (el(e, "V")) {
      const v = e as VSource;
      const gap = 32;
      const d1 = Math.max(0, midD - gap / 2);
      const d2 = Math.min(total, midD + gap / 2);
      const c = pointAt(route, midD);
      const s1 = pointAt(route, d1);
      const s2 = pointAt(route, d2);

      body += polyline(prefixTo(route, d1), stroke, 2);
      body += polyline(suffixFrom(route, d2), stroke, 2);

      body += `<circle cx="${c.p.x}" cy="${c.p.y}" r="14" fill="#fff" stroke="#0f172a" stroke-width="2" />`;

      // Polarity inside the symbol (a is +, b is -).
      const n = normalize({ x: -c.dir.y, y: c.dir.x });
      body += `<text x="${c.p.x - n.x * 6}" y="${c.p.y - n.y * 6}" font-size="14" fill="#0f172a" text-anchor="middle" dominant-baseline="middle">+</text>`;
      body += `<text x="${c.p.x + n.x * 6}" y="${c.p.y + n.y * 6}" font-size="14" fill="#0f172a" text-anchor="middle" dominant-baseline="middle">−</text>`;

      const pl = placedById.get(v.id);
      if (pl) body += elementLabel({ x: pl.x, y: pl.y }, pl.text);

      body += circle(s1.p, 2.2, "#0f172a");
      body += circle(s2.p, 2.2, "#0f172a");
    } else if (el(e, "I")) {
      const s = e as ISource;
      const gap = 32;
      const d1 = Math.max(0, midD - gap / 2);
      const d2 = Math.min(total, midD + gap / 2);
      const c = pointAt(route, midD);
      const s1 = pointAt(route, d1);
      const s2 = pointAt(route, d2);

      body += polyline(prefixTo(route, d1), stroke, 2);
      body += polyline(suffixFrom(route, d2), stroke, 2);

      body += `<circle cx="${c.p.x}" cy="${c.p.y}" r="14" fill="#fff" stroke="#0f172a" stroke-width="2" />`;
      body += arrow({ x: c.p.x - c.dir.x * 6, y: c.p.y - c.dir.y * 6 }, c.dir, 8);
      const pl = placedById.get(s.id);
      if (pl) body += elementLabel({ x: pl.x, y: pl.y }, pl.text);

      body += circle(s1.p, 2.2, "#0f172a");
      body += circle(s2.p, 2.2, "#0f172a");
    } else {
      body += polyline(route, stroke, 2);
    }
  }

  // Nodes
  for (const n of circuit.nodes) {
    const p = pos[n];
    body += circle(p, 5);
    body += text(p, n, -12);
  }

  // Terminals A/B if present
  if (circuit.terminals) {
    const pA = pos[circuit.terminals.A];
    const pB = pos[circuit.terminals.B];
    body += `<rect x="${pA.x - 16}" y="${pA.y - 22}" width="20" height="16" fill="#fff" stroke="#2563eb" stroke-width="2" rx="3" />`;
    body += `<text x="${pA.x - 6}" y="${pA.y - 10}" font-size="12" fill="#2563eb">A</text>`;
    body += `<rect x="${pB.x - 16}" y="${pB.y - 22}" width="20" height="16" fill="#fff" stroke="#2563eb" stroke-width="2" rx="3" />`;
    body += `<text x="${pB.x - 6}" y="${pB.y - 10}" font-size="12" fill="#2563eb">B</text>`;
  }

  return `\
<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet">\
  <rect x="0" y="0" width="${width}" height="${height}" fill="#f8fafc" />\
  ${body}\
</svg>`;
}
