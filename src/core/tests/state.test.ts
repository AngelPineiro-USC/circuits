import { describe, it, expect } from "vitest";
import { encodeState, decodeState, type AppState } from "../share/state";
import { demoCircuit } from "../demo/circuits";

describe("state encode/decode", () => {
  it("roundtrips AppState", () => {
    const { circuit, targets } = demoCircuit();
    const s: AppState = { circuit, targets };
    const enc = encodeState(s);
    const dec = decodeState(enc);
    expect(dec).toEqual(s);
  });
});
