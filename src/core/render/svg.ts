import type { Circuit, Element, NodeId, Resistor, VSource, ISource } from "../types";

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
    n0: { x: 80, y: 140 },
    n1: { x: 200, y: 60 },
    n2: { x: 320, y: 140 },
    n3: { x: 200, y: 220 },
  };

  const pos: NodePos = {};
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    pos[n] = known[n] ?? { x: 80 + ((i * 120) % w), y: 60 + (Math.floor(i / 4) * 120) % h };
  }
  return pos;
}

function line(p1: Point, p2: Point, stroke = "#1f2937", width = 2): string {
  return `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${stroke}" stroke-width="${width}" />`;
}

function circle(p: Point, r = 6, fill = "#111827"): string {
  return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" />`;
}

function text(p: Point, t: string, dy = -10): string {
  const x = p.x + 8;
  const y = p.y + dy;
  return `<text x="${x}" y="${y}" font-family="ui-sans-serif, system-ui" font-size="12" fill="#111827">${t}</text>`;
}

function mid(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function arrow(p1: Point, p2: Point): string {
  // small arrowhead near p2
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const len = 8;
  const a1 = angle + Math.PI * 0.85;
  const a2 = angle - Math.PI * 0.85;
  const pA = { x: p2.x + len * Math.cos(a1), y: p2.y + len * Math.sin(a1) };
  const pB = { x: p2.x + len * Math.cos(a2), y: p2.y + len * Math.sin(a2) };
  return `<path d="M ${pA.x} ${pA.y} L ${p2.x} ${p2.y} L ${pB.x} ${pB.y}" fill="none" stroke="#111827" stroke-width="2" />`;
}

function elementLabel(p: Point, t: string): string {
  return `<text x="${p.x}" y="${p.y}" font-family="ui-sans-serif, system-ui" font-size="12" fill="#111827" text-anchor="middle">${t}</text>`;
}

export function renderCircuitSvg(circuit: Circuit, opts: RenderOptions = {}): string {
  const width = opts.width ?? 640;
  const height = opts.height ?? 360;
  const pos = defaultLayout(circuit);

  let body = "";

  // Wires/elements
  for (const e of circuit.elements) {
    const p1 = pos[e.a];
    const p2 = pos[e.b];
    const m = mid(p1, p2);

    body += line(p1, p2, "#0f172a", 2);

    if (el(e, "R")) {
      const r = e as Resistor;
      body += elementLabel({ x: m.x, y: m.y - 6 }, `${r.id} ${r.ohms}Ω`);
      body += arrow(p1, m);
    } else if (el(e, "V")) {
      const v = e as VSource;
      body += `<circle cx="${m.x}" cy="${m.y}" r="14" fill="#fff" stroke="#0f172a" stroke-width="2" />`;
      body += elementLabel({ x: m.x, y: m.y + 4 }, `${v.id} ${v.volts}V`);
      // Mark polarity: + near a, - near b
      body += `<text x="${p1.x - 10}" y="${p1.y - 10}" font-size="14" fill="#0f172a">+</text>`;
      body += `<text x="${p2.x - 10}" y="${p2.y - 10}" font-size="14" fill="#0f172a">−</text>`;
    } else if (el(e, "I")) {
      const s = e as ISource;
      body += `<circle cx="${m.x}" cy="${m.y}" r="14" fill="#fff" stroke="#0f172a" stroke-width="2" />`;
      body += elementLabel({ x: m.x, y: m.y + 4 }, `${s.id} ${s.amps}A`);
      body += arrow(p1, p2);
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
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\
  <rect x="0" y="0" width="${width}" height="${height}" fill="#f8fafc" />\
  ${body}\
</svg>`;
}
