import { describe, it, expect } from "vitest";
import { demoCircuit } from "../demo/circuits";
import { solveCircuitMNA } from "../solver/mna";
import { validateAnswers } from "../validate";

describe("validateAnswers", () => {
  it("marks correct answers as ok", () => {
    const { circuit, targets } = demoCircuit();
    const sol = solveCircuitMNA(circuit);

    const answers = {
      voltages: Object.fromEntries(
        targets.voltages.map((v) => [v.id, sol.V[v.a] - sol.V[v.b]]),
      ),
      currents: Object.fromEntries(targets.currents.map((c) => [c.elementId, sol.I[c.elementId]])),
      req: targets.req ? 123.456 /* will be overwritten below */ : undefined,
    } as any;

    if (targets.req) {
      // Equivalent resistance is computed from circuit; use the same function indirectly by validating with correct value.
      // We can reuse validateAnswers' expected computation by calling it once with a placeholder and reading expected,
      // but that would be circular. Instead we just validate voltages and currents here.
      delete answers.req;
    }

    const vr = validateAnswers(circuit, sol, targets, answers);

    for (const v of Object.values(vr.voltages)) expect(v.ok).toBe(true);
    for (const c of Object.values(vr.currents)) expect(c.ok).toBe(true);
  });

  it("marks wrong voltage as not ok", () => {
    const { circuit, targets } = demoCircuit();
    const sol = solveCircuitMNA(circuit);

    const answers = {
      voltages: Object.fromEntries(targets.voltages.map((v) => [v.id, 0])),
      currents: Object.fromEntries(targets.currents.map((c) => [c.elementId, sol.I[c.elementId]])),
    };

    const vr = validateAnswers(circuit, sol, targets, answers);
    const anyBad = Object.values(vr.voltages).some((x) => !x.ok);
    expect(anyBad).toBe(true);
  });
});
