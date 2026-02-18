import type { Circuit, ValidationTargets } from "../types";

export type AppState = {
  circuit: Circuit;
  targets: ValidationTargets;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  // Convert bytes to a binary string for btoa.
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Simple base64url JSON encoding. Later we can compress.
export function encodeState(state: AppState): string {
  const json = JSON.stringify(state);
  return base64UrlEncode(enc.encode(json));
}

export function decodeState(s: string): AppState {
  const json = dec.decode(base64UrlDecode(s));
  return JSON.parse(json) as AppState;
}
