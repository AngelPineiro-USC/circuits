import { describe, it, expect } from "vitest";
import type { Circuit } from "../types";
import { solveCircuitMNA, voltageDiff, equivalentResistanceAB } from "../solver/mna";

// Basic regression tests to ensure MNA behaves.

describe("solveCircuitMNA", () => {
  it("solves a simple divider with one voltage source", () => {
    // 10V source between n1(+) and 0(-)
    // R1 between n1 and n2, R2 between n2 and 0
    const c: Circuit = {
      nodes: ["0", "n1", "n2"],
      elements: [
        { kind: "V", id: "V1", a: "n1", b: "0", volts: 10 },
        { kind: "R", id: "R1", a: "n1", b: "n2", ohms: 1000 },
        { kind: "R", id: "R2", a: "n2", b: "0", ohms: 1000 },
      ],
    };
    const sol = solveCircuitMNA(c);
    expect(sol.V["n2"]).toBeCloseTo(5, 6);
    expect(voltageDiff(sol, "n1", "0")).toBeCloseTo(10, 6);
    // current through R2 is 5V/1k = 5mA, direction n2->0 (a->b)
    expect(sol.I["R2"]).toBeCloseTo(0.005, 6);
  });

  it("handles two voltage sources with opposing directions", () => {
    // Loop with two sources and two resistors.
    // Nodes: 0, a, b
    // V1: + at a, - at 0 = 5V
    // V2: + at 0, - at b = 2V  (so V(0)-V(b)=2 => V(b)=-2V)
    // R between a-b and b-0
    const c: Circuit = {
      nodes: ["0", "a", "b"],
      elements: [
        { kind: "V", id: "V1", a: "a", b: "0", volts: 5 },
        { kind: "V", id: "V2", a: "0", b: "b", volts: 2 },
        { kind: "R", id: "R1", a: "a", b: "b", ohms: 1000 },
        { kind: "R", id: "R2", a: "b", b: "0", ohms: 1000 },
      ],
    };
    const sol = solveCircuitMNA(c);
    expect(sol.V["a"]).toBeCloseTo(5, 6);
    expect(sol.V["b"]).toBeCloseTo(-2, 6);
    // Current R1 from a->b: (5 - (-2))/1k = 7mA
    expect(sol.I["R1"]).toBeCloseTo(0.007, 6);
  });

  it("computes equivalent resistance between two terminals", () => {
    // Two resistors in parallel between A and B
    const c: Circuit = {
      nodes: ["A", "B"],
      elements: [
        { kind: "R", id: "R1", a: "A", b: "B", ohms: 100 },
        { kind: "R", id: "R2", a: "A", b: "B", ohms: 300 },
      ],
    };
    const req = equivalentResistanceAB(c, "A", "B");
    // 1/Req=1/100+1/300 => Req=75
    expect(req).toBeCloseTo(75, 6);
  });
});
