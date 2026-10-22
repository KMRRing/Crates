// Topple's measures, and a domino drawn flat in SVG as a slab seen from above and in front: the pieces in the tray and in
// your hand, and the whole table where there's no WebGL (topple-flat.js). The 3D table (topple-3d.js) shares the measures.
import { PIECES, axesOfCoords } from "./topple-engine.js";

export const ROW = Math.sqrt(3) / 2;
/** Where the hexagon (q, r) stands on the table: x across, z towards the player, a hexagon one across. */
export const mid = (q, r) => [q + r / 2, ROW * r];
export const SW = 0.74, SH = 0.92, ST = 0.2;               // a domino: width, height, thickness
export const ZOOM = 1.8;                                    // the closest look at the table: a domino's facing plain on a phone, and no more
const DEG = Math.PI / 180;
/** The way w (0–11, thirty degrees a step) points on the table, as (x, z): east is 0, then up the screen (away) and round. A direction d of the six is the way 2d. */
export const heading = w => [Math.cos((-w * Math.PI) / 6), Math.sin((-w * Math.PI) / 6)];
/** The turn about the vertical that points a slab's broad faces the way w runs: an axis a (0–5) is the way a, and a slab knocked along it falls that way or the opposite. */
export const yawOf = w => { const [x, z] = heading(w); return Math.atan2(x, z); };
/** The (q, r) of the hexagon nearest a point of the table (rounded through cube coordinates). */
export function hexAt(x, z) {
  const fr = z / ROW, fq = x - fr / 2;
  let q = Math.round(fq), r = Math.round(fr);
  const s = Math.round(-fq - fr), dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s + fq + fr);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [q, r];
}

// ---------- the flat view: from above and in front, no perspective ----------
export const ELEV = 58 * DEG;
const SIN = Math.sin(ELEV), COS = Math.cos(ELEV);
/** A point of the table (x, y up, z) on the flat view, in table units. */
export const flat = (x, y, z) => [x, z * SIN - y * COS];
const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  return n;
};
const PIPS = [[0], [-0.18, 0.18], [-0.25, 0, 0.25]];
/**
 * A slab of a colour standing with the middle of its foot at table (x, z), turned by yaw, as SVG: its side, its face, its
 * top and its pips, each in a class the page's CSS colours (tp-side, tp-face, tp-top, tp-pip, tp-groove).
 * Returns { g (the element), depth (z, to sort a row of them by) }.
 */
export function slabEl(x0, z0, yaw, kind, cls = "") {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const world = (lx, ly, lz) => [x0 + lx * c + lz * s, ly, z0 - lx * s + lz * c];
  const view = ([x, y, z]) => flat(x, y, z);
  const pts = list => list.map(p => view(p).map(v => v.toFixed(4)).join(",")).join(" ");
  const sg = c >= 0 ? 1 : -1, zf = (sg * ST) / 2, sx = s > 0 ? -1 : 1;
  const g = el("g", { class: `tp-slab k${kind} ${cls}`.trim() });
  if (Math.abs(s) > 0.05) g.append(el("polygon", { class: "tp-side", points: pts([[sx * SW / 2, 0, -ST / 2], [sx * SW / 2, 0, ST / 2], [sx * SW / 2, SH, ST / 2], [sx * SW / 2, SH, -ST / 2]].map(p => world(...p))) }));
  g.append(el("polygon", { class: "tp-face", points: pts([[-SW / 2, 0, zf], [SW / 2, 0, zf], [SW / 2, SH, zf], [-SW / 2, SH, zf]].map(p => world(...p))) }));
  g.append(el("polygon", { class: "tp-top", points: pts([[-SW / 2, SH, -ST / 2], [SW / 2, SH, -ST / 2], [SW / 2, SH, ST / 2], [-SW / 2, SH, ST / 2]].map(p => world(...p))) }));
  const zp = zf + sg * 0.004;
  g.append(el("polyline", { class: "tp-groove", points: pts([[-SW * 0.4, SH / 2, zp], [SW * 0.4, SH / 2, zp]].map(p => world(...p))) }));
  for (const y of [SH * 0.74, SH * 0.26]) for (const px of PIPS[kind]) {
    const ring = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; return world(px + 0.064 * Math.cos(a), y + 0.064 * Math.sin(a), zp); });
    g.append(el("polygon", { class: "tp-pip", points: pts(ring) }));
  }
  return { g, depth: z0 };
}
/** A row of slabs, far ones first: [{ x, z, yaw, kind, cell }] as one group (each marked with its hexagon, where given). */
export function slabsEl(list, cls = "") {
  const g = el("g", { class: "tp-slabs" });
  for (const s of [...list].sort((a, b) => a.z - b.z)) {
    const one = slabEl(s.x, s.z, s.yaw, s.kind, cls).g;
    if (s.cell != null) one.dataset.cell = s.cell;
    g.append(one);
  }
  return g;
}

// ---------- a piece, for the tray and the hand ----------
/** The shape of a piece in table units: the room it takes, from its first domino's hexagon. */
export function bounds(piece) {
  const at = PIECES[piece].cells.map(([q, r]) => mid(q, r)), x0 = Math.min(...at.map(a => a[0])) - 0.5, z0 = Math.min(...at.map(a => a[1])) - 0.58;
  const w = Math.max(...at.map(a => a[0])) + 0.5 - x0, h = Math.max(...at.map(a => a[1])) + 0.58 - z0;
  return { x0, z0, w, h, cx: x0 + w / 2, cz: z0 + h / 2 };
}
/**
 * The slabs of a piece standing (as laid): [{ x, z, yaw, kind }] in table units from its first domino's hexagon, the
 * table turned by `spin` about the vertical (a piece is drawn in the tray as it will look on the table).
 */
export function pieceSlabs(piece, colour, spin = 0) {
  const cells = PIECES[piece].cells, faces = axesOfCoords(cells), c = Math.cos(spin), n = Math.sin(spin);
  return cells.map(([q, r], k) => {
    const [x, z] = mid(q, r);
    return { x: x * c + z * n, z: -x * n + z * c, yaw: yawOf(faces[k]) + spin, kind: colour };
  });
}
/**
 * A piece drawn on its own as an SVG that fits whatever box it's given, in a view a line of five fits, so the pieces
 * are drawn at near one scale (but for the smallest, drawn a little larger, to be seen). With `exact`, the view is just
 * the piece (for a hand's float), and `foot` says where the middle of its footprint lies in it.
 */
export function pieceSvg({ piece, colour }, exact = false, spin = 0) {
  const slabs = pieceSlabs(piece, colour, spin), g = slabsEl(slabs);
  const all = slabs.flatMap(s => [[s.x - 0.6, s.z - 0.6, 0], [s.x + 0.6, s.z + 0.6, 0], [s.x, s.z, SH]]).map(([x, z, y]) => flat(x, y, z));
  const x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0])), y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]));
  const box = Math.max(3.2, Math.min(5.6, Math.max(x1 - x0, y1 - y0) * 1.1)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const svg = el("svg", { viewBox: exact ? `${x0.toFixed(3)} ${y0.toFixed(3)} ${(x1 - x0).toFixed(3)} ${(y1 - y0).toFixed(3)}` : `${(cx - box / 2).toFixed(3)} ${(cy - box / 2).toFixed(3)} ${box} ${box}`, "aria-hidden": "true" });
  svg.append(g);
  const b = bounds(piece), c = Math.cos(spin), n = Math.sin(spin), foot = flat(b.cx * c + b.cz * n, 0, -b.cx * n + b.cz * c);
  return { svg, width: x1 - x0, height: y1 - y0, foot: [foot[0] - x0, foot[1] - y0] };
}

/** The convex hull of some points on the screen, grown about their middle by `grow` (Andrew's monotone chain). */
export function hull(points, grow = 1) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = list => { const h = []; for (const q of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  const out = [...build(p), ...build([...p].reverse())];
  const cx = out.reduce((a, q) => a + q[0], 0) / out.length, cy = out.reduce((a, q) => a + q[1], 0) / out.length;
  return out.map(([x, y]) => [cx + (x - cx) * grow, cy + (y - cy) * grow]);
}
