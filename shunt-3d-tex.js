// The engraving of Shunt's watch, as normal maps made in code (no image files; pure, so Node tests them). The plate is quiet so the gears and jewels
// are the focus (Korbi, 4 November 2026): its field is brushed, a fine sunburst of radial lines at low contrast, which a tilt sweeps a soft sheen
// along; the ring outside the board is cut with Guilloché's own machine (guilloche-engine.js: `passes` gives each cut's lines, `grooveWidth` the V of
// the graver) as a coarser sunburst between two fine rings, and a narrow turned band (fine concentric lines) at its inner edge steps it off the
// field. Every groove is a V in section, so a pixel of the plate leans one way or the other, and the lean is what the shader's studio reflects.
// A circular grain brushes a gear's face (a circle looks the same when the gear turns). A seat's floor has no texture: no dots (Korbi, 4 November 2026).
import { passes, grooveWidth } from "./guilloche-engine.js";

/** The plate's cuts, on a plate of radius 1 (shunt-3d-model.js PLATE_R). The ring is what lies outside TRACK_R / PLATE_R. */
const ring = (R, depth) => ({ kind: "ring", R, k: 2, a: 0, shape: 0, n: 1, index: 0, feed: 0, k2: 1, a2: 0, depth });
export const DIAL = [
  ring(0.826, 2), ring(0.995, 2),
  { kind: "rays", R: 0.985, hub: 0.836, rays: 120, a: 0, k: 2, shape: 0, index: 0, sweep: 0, depth: 4 },
];
/** The brushed field's edge, and the turned band that steps the ring off it (plate radii). */
export const FIELD = 0.826, TURNED = [0.828, 0.858];

/** Encode a height field (h[y * S + x], in pixels) as a tangent-space normal map: RGBA bytes, the slope read with a central difference.
 *  `wrap` repeats the edges (a tile). The green is the slope down the image (v up the texture, as three.js has it). */
export function normalsOf(h, S, wrap = false) {
  const out = new Uint8Array(S * S * 4), at = (x, y) => {
    if (wrap) { x = (x + S) % S; y = (y + S) % S; } else { x = x < 0 ? 0 : x >= S ? S - 1 : x; y = y < 0 ? 0 : y >= S ? S - 1 : y; }
    return h[y * S + x];
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = -(at(x + 1, y) - at(x - 1, y)) / 2, ny = -(at(x, y + 1) - at(x, y - 1)) / 2, l = Math.hypot(nx, ny, 1), o = (y * S + x) * 4;
    out[o] = Math.round((nx / l * 0.5 + 0.5) * 255); out[o + 1] = Math.round((ny / l * 0.5 + 0.5) * 255); out[o + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); out[o + 3] = 255;
  }
  return out;
}

/** Cut a groove along (x0, y0)-(x1, y1) into h (S wide), a V of half-width w pixels and the walls' slope `slope` (pixels of depth a pixel).
 *  Row by row (or column by column for a flat line) only the pixels near the line are visited, so a long diagonal costs its length, not its box. */
function groove(h, S, x0, y0, x1, y1, w, slope) {
  const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1, steep = Math.abs(dy) >= Math.abs(dx);
  const cut = (px, py) => {
    const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2)), d = Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
    if (d < w) { const v = -(1 - d / w) * w * slope, i = py * S + px; if (v < h[i]) h[i] = v; }
  };
  if (steep) {
    const a = Math.max(0, Math.floor(Math.min(y0, y1) - w)), b = Math.min(S - 1, Math.ceil(Math.max(y0, y1) + w)), k = dy ? dx / dy : 0, reach = Math.ceil(w * Math.hypot(1, k)) + 1;
    for (let py = a; py <= b; py++) { const xc = Math.round(x0 + (py - y0) * k); for (let px = Math.max(0, xc - reach); px <= Math.min(S - 1, xc + reach); px++) cut(px, py); }
  } else {
    const a = Math.max(0, Math.floor(Math.min(x0, x1) - w)), b = Math.min(S - 1, Math.ceil(Math.max(x0, x1) + w)), k = dx ? dy / dx : 0, reach = Math.ceil(w * Math.hypot(1, k)) + 1;
    for (let px = a; px <= b; px++) { const yc = Math.round(y0 + (px - x0) * k); for (let py = Math.max(0, yc - reach); py <= Math.min(S - 1, yc + reach); py++) cut(px, py); }
  }
}

/** A cheap hash of two integers to 0..1. */
const hash2 = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

/** The brushed sunburst into h (S pixels across the plate): lines from the middle, finer where the circle is longer (96, 192, then 384 of them),
 *  each a soft ridge of its own height, a little streaked along its length. `amp` is the ridge height as a share of its width in pixels. */
export function brush(h, S, amp = 0.12) {
  const half = S / 2, bands = [[0.2, 96], [0.42, 192], [FIELD, 384]];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - half, dy = y + 0.5 - half, r = Math.hypot(dx, dy) / half;
    if (r >= FIELD) continue;
    const k = bands.findIndex(b => r < b[0]), B = bands[k][1], t = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) * B, bin = Math.floor(t), fr = t - bin;
    const px = 2 * Math.PI * Math.max(r, 0.05) * half / B;                    // a line's width in pixels here
    const v = 0.35 + 0.65 * hash2(bin, k) * (0.75 + 0.25 * hash2(bin, Math.floor(r * half / 14) + 7 * k));
    h[y * S + x] = Math.sin(Math.PI * fr) * v * amp * px;
  }
}
/** The turned band: fine concentric lines between plate radii r0 and r1, `pitch` pixels apart. */
export function turn(h, S, r0, r1, pitch = 3.2, amp = 0.5) {
  const half = S / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
    if (r >= r0 && r < r1) h[y * S + x] = Math.sin(r * half / pitch * 2 * Math.PI) * amp;
  }
}

/** The plate's engraving as a normal map, S pixels across the plate's diameter. Returns { size, data } (RGBA bytes). */
export function dialNormals(S = 1024, cuts = DIAL, slope = 0.62) {
  const h = new Float32Array(S * S), half = S / 2;
  brush(h, S); turn(h, S, TURNED[0], TURNED[1]);
  for (const cut of cuts) {
    const w = Math.max(1.2, grooveWidth(cut.depth) * half);
    for (const p of passes(cut)) for (let i = 0; i + 3 < p.length; i += 2) groove(h, S, (p[i] + 1) * half, (p[i + 1] + 1) * half, (p[i + 2] + 1) * half, (p[i + 3] + 1) * half, w, slope);
  }
  return { size: S, data: normalsOf(h, S) };
}

/** A circular grain: fine concentric ridges about the middle of a square of side `span` (world units), S pixels across. */
export function grainNormals(S = 256, span = 1.1, pitch = 0.05) {
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = Math.sin(Math.hypot(x - S / 2, y - S / 2) / S * span / pitch * Math.PI * 2) * 0.9;
  return { size: S, data: normalsOf(h, S) };
}
