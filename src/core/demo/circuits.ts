import type { Circuit, ValidationTargets } from "../types";

export function demoCircuit(): { circuit: Circuit; targets: ValidationTargets } {
  // Demo chosen: includes 2 voltage sources with opposite polarities + a bridge resistor.
  // Nodes: n0, n1, n2, n3. Terminals for Req: A=n1, B=n3.
  const circuit: Circuit = {
    nodes: ["n0", "n1", "n2", "n3"],
    terminals: { A: "n1", B: "n3" },
    elements: [
      // Two voltage sources
      { kind: "V", id: "V1", a: "n1", b: "n0", volts: 12 }, // V(n1)-V(n0)=12
      { kind: "V", id: "V2", a: "n0", b: "n3", volts: 5 },  // V(n0)-V(n3)=5

      // Resistor network
      { kind: "R", id: "R1", a: "n1", b: "n2", ohms: 220 },
      { kind: "R", id: "R2", a: "n2", b: "n0", ohms: 330 },
      { kind: "R", id: "R3", a: "n2", b: "n3", ohms: 470 },
      { kind: "R", id: "R4", a: "n1", b: "n3", ohms: 680 }, // bridge
    ],
  };

  const targets: ValidationTargets = {
    voltages: [
      { id: "V_n1n2", a: "n1", b: "n2", label: "V(n1,n2)" },
      { id: "V_n2n3", a: "n2", b: "n3", label: "V(n2,n3)" },
      { id: "V_n1n3", a: "n1", b: "n3", label: "V(n1,n3)" },
    ],
    currents: [
      { elementId: "R1", label: "I(R1) n1→n2" },
      { elementId: "R2", label: "I(R2) n2→n0" },
      { elementId: "R3", label: "I(R3) n2→n3" },
      { elementId: "R4", label: "I(R4) n1→n3" },
    ],
    req: { A: "n1", B: "n3" },
  };

  return { circuit, targets };
}
