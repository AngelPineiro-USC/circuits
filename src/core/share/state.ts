import type { Circuit, ValidationTargets } from "../types";

export type AppState = {
  circuit: Circuit;
  targets: ValidationTargets;
};

// Simple base64url JSON encoding. Later we can compress.
export function encodeState(state: AppState): string {
  const json = JSON.stringify(state);
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeState(s: string): AppState {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json) as AppState;
}
