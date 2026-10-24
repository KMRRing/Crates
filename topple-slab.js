// Topple's measures, and a domino drawn flat in SVG as a slab seen from above and in front: the pieces in the tray and in
// your hand, and the whole table where there's no WebGL (topple-flat.js). The 3D table (topple-3d.js) shares the measures.
import { PIECES, DIRS, axesOfCoords, colourAt, gateOf } from "./topple-engine.js";
import { WATER, VOID } from "./topple-levels.js";

export const ROW = Math.sqrt(3) / 2;
/** Where the hexagon (q, r) stands on the table: x across, z towards the player, a hexagon one across. */
export const mid = (q, r) => [q + r / 2, ROW * r];
export const SW = 0.74, SH = 0.92, ST = 0.2;               // a domino: width, height, thickness
export const STH = 0.32;                                    // a heavy domino's thickness
/** How thick a domino with this modifier (topple-engine.js: 0, HEAVY, or a gate) stands. */
export const thickOf = mod => (mod === 1 ? STH : ST);
export const PLANK = 0.05;                                  // the thickness of a bridge's plank, which a domino on water stands on
export const ZOOM = 1.8;                                   // the closest look at the table: a domino's facing plain on a phone, and no more
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
// each colour its own pips, told apart without their colour: how many, and how they stand in a half (x across the width, y up
// the half, in domino units; `ring` is a hollow one). The mixes carry their parents' pips together: orange (yellow's one and
// red's two) three, green (one and three) four, purple (two and three) five, grey (black's four and white's ring) six.
const row = (n, d) => Array.from({ length: n }, (_, k) => ({ x: (k - (n - 1) / 2) * d, y: 0 }));
export const PIPSETS = [
  row(1, 0),                                                                                   // 0 yellow (Classic: the gold)
  row(2, 0.36),                                                                                // 1 red (Classic: the green)
  row(3, 0.25),                                                                                // 2 blue
  row(4, 0.18),                                                                                // 3 black
  [{ x: 0, y: 0, ring: true }],                                                                // 4 white
  [{ x: 0, y: 0.08 }, { x: -0.15, y: -0.07 }, { x: 0.15, y: -0.07 }],                          // 5 orange
  [{ x: 0, y: 0.09 }, { x: 0, y: -0.09 }, { x: -0.19, y: 0 }, { x: 0.19, y: 0 }],              // 6 green
  [{ x: -0.18, y: 0.09 }, { x: 0.18, y: 0.09 }, { x: 0, y: 0 }, { x: -0.18, y: -0.09 }, { x: 0.18, y: -0.09 }],   // 7 purple
  [-0.22, 0, 0.22].flatMap(x => [{ x, y: 0.09 }, { x, y: -0.09 }]),                            // 8 grey
  [{ x: -0.17, y: 0, ring: true }, { x: 0.17, y: 0, ring: true }],                             // 9 the rainbow
];
/** A pip's radius: the rows of two take a smaller one so they fit a half. */
export const pipSize = set => (set.length > 3 && set.some(p => p.y) ? 0.05 : 0.064);

// ---------- what a level's table is made of, for the drawing ----------
/**
 * How high each floor of a table stands (y, floor 0 at the table): the floors above the table a gap apart (`layerGap`),
 * and a floor that opens onto the ground floor's own level, a cave's mouth, below it.
 */
export function floorYs(rules) {
  const layers = rules.layers || 1, ys = [0];
  for (let l = 1; l < layers; l++) {
    let opens = false;
    if (rules.nb) for (let g = 0; g < SIZE0 && !opens; g++) for (let d = 0; d < 6; d++) if (floorOfCell(rules.nb[g * 6 + d]) === l) { opens = true; break; }
    ys.push(opens ? -(rules.layerGap ?? 1.9) : (rules.layerGap ?? 1.9) * l);
  }
  return ys;
}
const SIZE0 = 61;
const floorOfCell = i => (i >= 0 ? Math.floor(i / SIZE0) : -1);
/** What a floor is called on its button: the ground, one above, a cave below. */
export const floorName = (rules, l, ys = floorYs(rules)) => (l === 0 ? "Ground" : ys[l] < 0 ? "Cave" : "Upper");
const CORNER = 1 / Math.sqrt(3);
/** The edge of hexagon i (of its own table) on side d, as two corners [x0, z0, x1, z1] on the table. */
export function edgeOf(i, d) {
  const [cx, cz] = mid(...BASE[i % SIZE0]), a0 = (d * Math.PI) / 3 - Math.PI / 6, a1 = a0 + Math.PI / 3;
  return [cx + CORNER * Math.cos(a0), cz - CORNER * Math.sin(a0), cx + CORNER * Math.cos(a1), cz - CORNER * Math.sin(a1)];
}
const BASE = [];
for (let r = -4; r <= 4; r++) for (let q = Math.max(-4, -4 - r); q <= Math.min(4, 4 - r); q++) BASE.push([q, r]);
/**
 * The pieces of a table the drawing adds to the floor, found from a level's rules: hedges (the edges), springs, marsh, cups,
 * links (portals on one floor, stairs between two) and lips (the edges where a fall leaves a floor for another: a drop,
 * or a cave's mouth), each with the floor it is on. Both renderers draw from this.
 */
export function featuresOf(rules) {
  const out = { hedges: [], springs: [], marsh: [], cups: [], links: [], lips: [] }, n = rules.n || SIZE0;
  for (let i = 0; i < n; i++) {
    if (rules.terrain[i] === VOID) continue;
    if (rules.spring?.[i]) out.springs.push(i);
    if (rules.marsh?.[i]) out.marsh.push(i);
    if (rules.terrain[i] === 4) out.cups.push(i);
    for (let d = 0; d < 6; d++) {
      const j = rules.nb ? rules.nb[i * 6 + d] : -1;
      if (rules.hedge?.[i * 6 + d] && (j < 0 || i < j)) out.hedges.push({ i, d, edge: edgeOf(i, d) });
      if (j >= 0 && floorOfCell(j) !== floorOfCell(i)) out.lips.push({ i, d, j, edge: edgeOf(i, d), water: rules.terrain[i] === WATER });
    }
  }
  if (rules.links) rules.links.forEach((list, a) => { for (const b of list) if (a < b) out.links.push({ a, b }); });
  return out;
}
export { DIRS };

/**
 * A slab of a colour standing with the middle of its foot at table (x, z), turned by yaw, as SVG: its side, its face, its
 * top and its pips, each in a class the page's CSS colours (tp-side, tp-face, tp-top, tp-pip, tp-groove). `lift` is how far
 * up a terrace (or a floor) it stands. `look` is { lv (a level's palette: the nine colours and the rainbow; else Classic's three),
 * mod (0, a heavy domino: 1, a gate: 10 + 10a + b) }: a heavy one is thicker, with a brass band; a gate is two colours, its
 * upper half the second, with a band between.
 * Returns { g (the element), depth (z, to sort a row of them by) }.
 */
export function slabEl(x0, z0, yaw, kind, cls = "", lift = 0, look = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw), H = SH, T = thickOf(look.mod || 0), gate = look.mod >= 10 ? gateOf(look.mod) : null;
  const world = (lx, ly, lz) => [x0 + lx * c + lz * s, ly + lift, z0 - lx * s + lz * c];
  const view = ([x, y, z]) => flat(x, y, z);
  const pts = list => list.map(p => view(p).map(v => v.toFixed(4)).join(",")).join(" ");
  const sg = c >= 0 ? 1 : -1, zf = (sg * T) / 2, sx = s > 0 ? -1 : 1;
  const g = el("g", { class: `tp-slab k${kind}${look.lv ? " lv" : ""}${look.mod === 1 ? " heavy" : gate ? " gate" : ""} ${cls}`.trim() });
  /** A strip of a face, between two heights: the lower half (the slab's own colour), the upper (a gate's second), the band. */
  const part = (y0, y1, extra = "") => {
    if (Math.abs(s) > 0.05) g.append(el("polygon", { class: `tp-side${extra}`, points: pts([[sx * SW / 2, y0, -T / 2], [sx * SW / 2, y0, T / 2], [sx * SW / 2, y1, T / 2], [sx * SW / 2, y1, -T / 2]].map(p => world(...p))) }));
    g.append(el("polygon", { class: `tp-face${extra}`, points: pts([[-SW / 2, y0, zf], [SW / 2, y0, zf], [SW / 2, y1, zf], [-SW / 2, y1, zf]].map(p => world(...p))) }));
  };
  const up = gate ? ` tp-up kb${gate[1]}` : "";
  if (gate) { part(0, H / 2); part(H / 2, H, up); } else part(0, H);
  g.append(el("polygon", { class: `tp-top${up}`, points: pts([[-SW * 0.5, H, -T / 2], [SW * 0.5, H, -T / 2], [SW * 0.5, H, T / 2], [-SW * 0.5, H, T / 2]].map(p => world(...p))) }));
  const zp = zf + sg * 0.004;
  if (look.mod === 1 || gate) {
    // the band: a heavy domino's across its middle (and a plain strip across its top), a gate's between its halves
    const y0 = gate ? H / 2 - 0.035 : H * 0.44, y1 = gate ? H / 2 + 0.035 : H * 0.56;
    if (Math.abs(s) > 0.05) g.append(el("polygon", { class: "tp-band", points: pts([[sx * SW / 2, y0, -T / 2], [sx * SW / 2, y0, T / 2], [sx * SW / 2, y1, T / 2], [sx * SW / 2, y1, -T / 2]].map(p => world(...p))) }));
    g.append(el("polygon", { class: "tp-band", points: pts([[-SW / 2, y0, zf], [SW / 2, y0, zf], [SW / 2, y1, zf], [-SW / 2, y1, zf]].map(p => world(...p))) }));
  } else g.append(el("polyline", { class: "tp-groove", points: pts([[-SW * 0.4, H / 2, zp], [SW * 0.4, H / 2, zp]].map(p => world(...p))) }));
  const set = PIPSETS[kind], set2 = PIPSETS[gate ? gate[1] : kind];
  for (const [y, pips, cl] of [[H * 0.74, set2, up], [H * 0.26, set, ""]]) for (const p of pips) {
    const pr = pipSize(pips), ring = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; return world(p.x + pr * Math.cos(a), y + p.y + pr * Math.sin(a), zp); });
    g.append(el("polygon", { class: `tp-pip${p.ring ? " hollow" : ""}${cl}`, points: pts(ring) }));
  }
  return { g, depth: z0 };
}
/** A bridge's plank: the hexagon's floor, a hair short of its edges, with its boards. */
export function plankEl(x0, z0, cls = "") {
  const corner = 0.93 / Math.sqrt(3), at = (k, y = 0) => { const a = Math.PI / 6 + (k * Math.PI) / 3; return flat(x0 + corner * Math.cos(a), y, z0 + corner * Math.sin(a)); };
  const g = el("g", { class: `tp-plank ${cls}`.trim() }), top = [0, 1, 2, 3, 4, 5].map(k => at(k, PLANK));
  g.append(el("polygon", { class: "tp-plank-edge", points: [0, 1, 2].map(k => at(k)).concat([2, 1, 0].map(k => at(k, PLANK))).map(p => p.map(v => v.toFixed(4)).join(",")).join(" ") }));
  g.append(el("polygon", { class: "tp-plank-top", points: top.map(p => p.map(v => v.toFixed(4)).join(",")).join(" ") }));
  for (const f of [-0.17, 0.17]) g.append(el("polyline", { class: "tp-plank-board", points: [flat(x0 - 0.46, PLANK, z0 + f), flat(x0 + 0.46, PLANK, z0 + f)].map(p => p.map(v => v.toFixed(4)).join(",")).join(" ") }));
  return g;
}
/**
 * A row of slabs, far ones first: [{ x, z, yaw, kind, cell, lift, plank, lv, mod }] as one group (each marked with its hexagon,
 * where given). A slab with `plank` stands on a bridge's plank, drawn under all of them.
 */
export function slabsEl(list, cls = "") {
  const g = el("g", { class: "tp-slabs" });
  for (const s of [...list].sort((a, b) => a.z - b.z)) if (s.plank) g.append(plankEl(s.x, s.z, cls));
  for (const s of [...list].sort((a, b) => a.z - b.z)) {
    const one = slabEl(s.x, s.z, s.yaw, s.kind, cls, s.lift, { lv: s.lv, mod: s.mod }).g;
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
 * The slabs of a piece in hand standing (as laid): [{ x, z, yaw, kind, h, plank }] in table units from its first
 * domino's hexagon, the table turned by `spin` about the vertical (a piece is drawn in the tray as it will look on the
 * table; `lv` says the level palette). A twin has a colour to each domino, a bridge a plank under each.
 */
export function pieceSlabs(hand, spin = 0, lv = false) {
  const cells = PIECES[hand.piece].cells, faces = axesOfCoords(cells), c = Math.cos(spin), n = Math.sin(spin);
  return cells.map(([q, r], k) => {
    const [x, z] = mid(q, r), kind = colourAt(hand, k);
    return { x: x * c + z * n, z: -x * n + z * c, yaw: yawOf(faces[k]) + spin, kind, plank: !!hand.bridge, lv, mod: hand.mod || 0 };
  });
}
/**
 * A piece drawn on its own as an SVG that fits whatever box it's given, in a view a line of five fits, so the pieces
 * are drawn at near one scale (but for the smallest, drawn a little larger, to be seen). With `exact`, the view is just
 * the piece (for a hand's float), and `foot` says where the middle of its footprint lies in it.
 */
export function pieceSvg(hand, exact = false, spin = 0, lv = false) {
  const { piece } = hand, slabs = pieceSlabs(hand, spin, lv), g = slabsEl(slabs);
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
