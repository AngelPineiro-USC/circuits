import type { Circuit, Element, NodeId, Solution, Resistor, VSource, ISource } from "../types";
import { solveLinearSystem } from "./linalg";

// Modified Nodal Analysis (MNA)
// Unknowns: node voltages (excluding reference node) + currents through voltage sources
// Conventions:
// - For VSource: V(a) - V(b) = volts, current variable I flows from a -> b.
// - For ISource: current flows from a -> b; in KCL, inject -amps at a and +amps at b.

export type MnaOptions = {
  refNode?: NodeId;
};

function pickRefNode(nodes: NodeId[]): NodeId {
  // Prefer a node literally called "0" or "gnd" if present.
  const preferred = ["0", "GND", "gnd", "ref", "REF"];
  for (const p of preferred) if (nodes.includes(p)) return p;
  return nodes[0];
}

export function solveCircuitMNA(circuit: Circuit, opts: MnaOptions = {}): Solution {
  const nodes = circuit.nodes;
  if (nodes.length < 2) throw new Error("Circuit must have at least 2 nodes");

  const refNode = opts.refNode ?? pickRefNode(nodes);
  if (!nodes.includes(refNode)) throw new Error(`refNode ${refNode} not in circuit.nodes`);

  const nodeIndex = new Map<NodeId, number>();
  const voltageUnknownNodes = nodes.filter((n) => n !== refNode);
  voltageUnknownNodes.forEach((n, i) => nodeIndex.set(n, i));

  const vSources = circuit.elements.filter((e): e is VSource => e.kind === "V");
  const m = voltageUnknownNodes.length;
  const k = vSources.length;
  const N = m + k;

  // Build A x = z
  const A: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  const z: number[] = new Array(N).fill(0);

  function addToNode(node: NodeId, col: number, value: number) {
    // Adds coefficient to KCL row for node (if not ref)
    const r = nodeIndex.get(node);
    if (r === undefined) return; // reference node has no KCL equation
    A[r][col] += value;
  }

  // Stamp resistors into conductance matrix (KCL rows/cols)
  for (const e of circuit.elements) {
    if (e.kind !== "R") continue;
    const R = (e as Resistor).ohms;
    if (R <= 0) throw new Error(`Resistor ${e.id} has non-positive ohms`);
    const g = 1 / R;
    const a = e.a;
    const b = e.b;

    const ia = nodeIndex.get(a);
    const ib = nodeIndex.get(b);

    if (ia !== undefined) A[ia][ia] += g;
    if (ib !== undefined) A[ib][ib] += g;
    if (ia !== undefined && ib !== undefined) {
      A[ia][ib] -= g;
      A[ib][ia] -= g;
    }
    // If one side is ref, above still works (only diagonal term for non-ref)
  }

  // Stamp current sources into RHS z (KCL)
  for (const e of circuit.elements) {
    if (e.kind !== "I") continue;
    const src = e as ISource;
    // current flows a -> b
    const ia = nodeIndex.get(src.a);
    const ib = nodeIndex.get(src.b);
    if (ia !== undefined) z[ia] += -src.amps;
    if (ib !== undefined) z[ib] += +src.amps;
  }

  // Stamp voltage sources (MNA)
  vSources.forEach((vs, idx) => {
    const col = m + idx; // current unknown index

    // KCL coupling: +I at node a, -I at node b
    addToNode(vs.a, col, +1);
    addToNode(vs.b, col, -1);

    // Voltage constraint row
    const row = m + idx;
    const ia = nodeIndex.get(vs.a);
    const ib = nodeIndex.get(vs.b);
    if (ia !== undefined) A[row][ia] += +1;
    if (ib !== undefined) A[row][ib] += -1;
    // No coefficient for ref node

    z[row] = vs.volts;

    // Also stamp transpose coupling (constraint uses current unknown col)
    // This is already handled above by addToNode (KCL rows) and constraint row (node voltage cols).
  });

  const x = solveLinearSystem(A, z);

  // Build solution
  const V: Record<NodeId, number> = {};
  V[refNode] = 0;
  voltageUnknownNodes.forEach((n, i) => {
    V[n] = x[i];
  });

  const I: Record<string, number> = {};

  // Currents through voltage sources are in x[m + idx]
  vSources.forEach((vs, idx) => {
    I[vs.id] = x[m + idx];
  });

  // Currents through resistors by Ohm's law using convention a->b
  for (const e of circuit.elements) {
    if (e.kind !== "R") continue;
    const r = e as Resistor;
    const Ia = (V[r.a] ?? 0) - (V[r.b] ?? 0);
    I[r.id] = Ia / r.ohms;
  }

  // Current sources: by definition
  for (const e of circuit.elements) {
    if (e.kind !== "I") continue;
    I[e.id] = (e as ISource).amps;
  }

  return { refNode, V, I };
}

export function voltageDiff(sol: Solution, a: NodeId, b: NodeId): number {
  return (sol.V[a] ?? 0) - (sol.V[b] ?? 0);
}

// Compute equivalent resistance between A and B by injecting 1A current source from A -> B
// into a copy of the circuit with all independent sources turned off.
// - Voltage sources -> short (0V)
// - Current sources -> open (0A)
export function equivalentResistanceAB(circuit: Circuit, A: NodeId, B: NodeId): number {
  const elements: Element[] = [];
  for (const e of circuit.elements) {
    if (e.kind === "R") elements.push(e);
    else if (e.kind === "V") {
      const vs = e as VSource;
      elements.push({ ...vs, volts: 0 });
    } else if (e.kind === "I") {
      // open circuit: omit
    }
  }
  // Add test current source 1A from A -> B
  elements.push({ kind: "I", id: "I_test", a: A, b: B, amps: 1 });

  const testCircuit: Circuit = { nodes: circuit.nodes, elements };
  const sol = solveCircuitMNA(testCircuit);
  // Req should be positive magnitude. With current source defined A->B (+1A),
  // Vab could come out negative depending on internal reference choice.
  // Use magnitude for equivalent resistance.
  const vab = voltageDiff(sol, A, B);
  return Math.abs(vab);
}
