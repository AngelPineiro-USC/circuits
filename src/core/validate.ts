import type { Circuit, Solution, ValidationTargets } from "./types";
import { equivalentResistanceAB, voltageDiff } from "./solver/mna";

export type CheckResult = {
  ok: boolean;
  expected: number;
  got: number;
  absErr: number;
  relErr: number;
};

export type ValidationResult = {
  voltages: Record<string, CheckResult>;
  currents: Record<string, CheckResult>;
  req?: CheckResult;
};

export type Tolerances = {
  abs: number; // absolute
  rel: number; // relative (fraction)
};

export const defaultTol: Tolerances = { abs: 1e-2, rel: 1e-2 }; // 1% or 0.01

export function parseNumber(input: string): number | null {
  const s = input.trim().replace(",", ".");
  if (!s) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

function check(expected: number, got: number, tol: Tolerances): CheckResult {
  const absErr = Math.abs(got - expected);
  const denom = Math.max(1e-12, Math.abs(expected));
  const relErr = absErr / denom;
  const ok = absErr <= tol.abs || relErr <= tol.rel;
  return { ok, expected, got, absErr, relErr };
}

export function validateAnswers(
  circuit: Circuit,
  sol: Solution,
  targets: ValidationTargets,
  answers: {
    voltages: Record<string, number>;
    currents: Record<string, number>;
    req?: number;
  },
  tol: Tolerances = defaultTol,
): ValidationResult {
  const vr: ValidationResult = { voltages: {}, currents: {} };

  for (const vq of targets.voltages) {
    const expected = voltageDiff(sol, vq.a, vq.b);
    const got = answers.voltages[vq.id];
    vr.voltages[vq.id] = check(expected, got, tol);
  }

  for (const cq of targets.currents) {
    const expected = sol.I[cq.elementId];
    const got = answers.currents[cq.elementId];
    vr.currents[cq.elementId] = check(expected, got, tol);
  }

  if (targets.req && answers.req !== undefined) {
    const expected = equivalentResistanceAB(circuit, targets.req.A, targets.req.B);
    vr.req = check(expected, answers.req, tol);
  }

  return vr;
}
