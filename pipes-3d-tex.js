// Gears' normal maps, made in code (no image files; pure, so Node tests them). Shunt's perlage and circular grain are imported; these are the bridges'
// Cotes de Geneve (parallel half-round stripes, the wave across one stripe is the tile), the case's coin edge (sharp fine ridges) and a snailed disc
// (fine concentric lines, for a barrel's lid or a ring).
import { normalsOf, grainNormals } from "./shunt-3d-tex.js";

export { grainNormals };

/** The plate's satin: a calm tile of fine streaks along x (Shunt dropped its dots, Korbi, 4 November 2026, so the wheels are the stars). */
export function satinNormals(S = 128, amp = 0.5) {
  const h = new Float32Array(S * S), hash = n => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = (hash(y) - 0.5) * amp + 0.18 * Math.sin(x / S * 2 * Math.PI * 3 + hash(y) * 6);
  return { size: S, data: normalsOf(h, S, true) };
}

/** Geneva stripes: a tile S pixels across holding one stripe, a soft round ridge running down the tile (so bridge uv.x counts stripes). */
export function genevaNormals(S = 128, depth = 0.1) {
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S, ridge = Math.sin(u * Math.PI);                // a half-round ridge, the stripe
    h[y * S + x] = (Math.pow(ridge, 0.8) * depth + 0.012 * Math.sin(y * 0.9 + x * 0.05)) * S;
  }
  return { size: S, data: normalsOf(h, S, true) };
}
/** Coin edge: a tile one ridge wide, a sharp V. */
export function fluteNormals(S = 64, depth = 0.12) {
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = (1 - Math.abs((x + 0.5) / S * 2 - 1)) * depth * S;
  return { size: S, data: normalsOf(h, S, true) };
}
/** A snailed (fine concentric lines) disc of S pixels, `lines` rings from the middle to the edge. */
export function snailNormals(S = 256, lines = 26) {
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2);
    h[y * S + x] = r < 1 ? Math.abs(Math.sin(r * lines * Math.PI)) * S * 0.012 : 0;
  }
  return { size: S, data: normalsOf(h, S) };
}
