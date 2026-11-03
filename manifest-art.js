// Manifest's drawing: the League's cargo, the quay it stands on, and the little piece beside an answer. The geometry (where
// a piece is, what hides what) is the engine's (manifest-engine.js); this file only dresses it.
//
// Two drawings of the same pictures. The first is 3D (manifest-pictures.js and manifest-3d.js, three.js): modelled cargo
// lit by a sun with shadows, the packing worked out in the shader, a bounce as it lands. Where WebGL won't start (an old
// phone, a lost context) the second drawing, the flat one below (SVG, no filters), takes over: each type a simpler picture
// of the same shape (manifest-shapes.js has the sizes), drawn on the cell's isometric frame. Outline first, then lightness
// and hue, so no one rests on colour alone. A stack under tarpaulin (the turned question, which must not give the cargo
// away) is ropes on grey, every piece a plain box.
import { WARES, boxFor, isoPoint, cubeFaces, dropTimes, visibleSet } from "./manifest-engine.js";
import { QUAY_DEPTH, frameOf, yawOf, layout, pieceKey, piecesNamed } from "./manifest-model.js";
import { typeOf, isLong } from "./manifest-rules.js";
import { barrelRadius, sackRadius, INGOT_SHRINK, GOLD_MARK, GOLD_BARS, crownOn, BIRCH_LOGS, hull } from "./manifest-shapes.js";
import { ready, is3d, stage3d, icon3d, playOut as playOut3d } from "./manifest-pictures.js";

export { QUAY_DEPTH, ready, is3d };

const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const node = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const ch = sh => Math.round(Math.min(255, Math.max(0, ((n >> sh) & 255) * k))); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
const num = n => n.toFixed(1);
const pts = a => a.map(q => `${num(q[0])},${num(q[1])}`).join(" ");
const dpath = (a, close = false) => `M${a.map(q => `${num(q[0])} ${num(q[1])}`).join("L")}${close ? "Z" : ""}`;
const TAU = Math.PI * 2;

// the tarpaulin over a stack whose cargo is hidden, and the one piece lit under it
const TARP = "#AEA690", LIT = "#FFF8E4";

// ---------- a cell as a frame ----------
/** The cell's map from (u along x, v along y, w up), each 0 to 1, to the screen, from its three faces as cubeFaces gives them. */
function cellMap(faces) {
  const t = faces.top, r = faces.right;
  const ex = [t[1][0] - t[0][0], t[1][1] - t[0][1]], ey = [t[3][0] - t[0][0], t[3][1] - t[0][1]], ez = [r[3][0] - r[0][0], r[3][1] - r[0][1]];
  const O = [t[0][0] - ez[0], t[0][1] - ez[1]];
  const A = (u, v, w) => [O[0] + u * ex[0] + v * ey[0] + w * ez[0], O[1] + u * ex[1] + v * ey[1] + w * ez[1]];
  A.unit = Math.hypot(ez[0], ez[1]);                                // a cell's height on the screen
  return A;
}
/** A pen for one piece: fills (the main shapes, outlined by the page's class) and strokes (the packing, left out when `detail` is off). */
function brush(g, detail) {
  const add = (tag, attrs) => g.appendChild(el(tag, attrs));
  return {
    fill: (points, fill, cls = "mf-cell") => add("polygon", { points: pts(points), fill, class: cls }),
    shape: (points, fill) => add("polygon", { points: pts(points), fill, "pointer-events": "none" }),
    line: (points, stroke, width = 1, close = false) => { if (detail) add("path", { d: dpath(points, close), fill: "none", stroke, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round", "pointer-events": "none" }); },
    dot: (c, r, fill) => { if (detail) add("circle", { cx: num(c[0]), cy: num(c[1]), r: num(r), fill, "pointer-events": "none" }); },
    patch: (points, fill) => { if (detail) add("polygon", { points: pts(points), fill, "pointer-events": "none" }); },
  };
}
/** A box in the cell's frame, drawn as its left (+y), right (+x) and top faces. */
function slab(B, A, [u0, u1], [v0, v1], [w0, w1], hex, k = 1) {
  B.fill([A(u0, v1, w0), A(u1, v1, w0), A(u1, v1, w1), A(u0, v1, w1)], shade(hex, 0.72 * k));
  B.fill([A(u1, v0, w0), A(u1, v1, w0), A(u1, v1, w1), A(u1, v0, w1)], shade(hex, 0.86 * k));
  B.fill([A(u0, v0, w1), A(u1, v0, w1), A(u1, v1, w1), A(u0, v1, w1)], shade(hex, 1.05 * k));
}
/** A circle of radius r about the cell's vertical axis at height w. */
const circle = (A, w, r, n = 24) => Array.from({ length: n }, (_, i) => A(0.5 + Math.cos(i / n * TAU) * r, 0.5 + Math.sin(i / n * TAU) * r, w));
/** The front half of that circle (toward the viewer), left to right. */
const front = (A, w, r) => circle(A, w, r).filter(q => q[1] >= A(0.5, 0.5, w)[1]).sort((a, b) => a[0] - b[0]);
/** A circle on the screen, round: centre c, radius in cell heights. */
const disc = (A, c, r, n = 14) => Array.from({ length: n }, (_, i) => [c[0] + Math.cos(i / n * TAU) * A.unit * r, c[1] + Math.sin(i / n * TAU) * A.unit * r]);
/** A body of revolution about the cell's vertical axis, radius rOf(w) from the foot (w = 0) to the top (w = 1): its side, a
 *  shaded left edge, its top. */
function lathe(B, A, rOf, side, top, steps = 10) {
  const left = [], right = [], mid = [];
  for (let k = 0; k <= steps; k++) {
    const w = k / steps, rp = circle(A, w, rOf(w));
    left.push(rp.reduce((a, q) => (q[0] < a[0] ? q : a)));
    right.push(rp.reduce((a, q) => (q[0] > a[0] ? q : a)));
    mid.push(A(0.5, 0.5, w));
  }
  const foot = circle(A, 0, rOf(0)).filter(q => q[1] >= A(0.5, 0.5, 0)[1]).sort((a, b) => b[0] - a[0]);   // the front half of the foot, right to left
  B.fill([...left, ...right.slice().reverse(), ...foot], side);
  B.shape([...left, ...mid.slice().reverse()], "rgba(0,0,0,.14)");
  B.shape([...mid, ...right.slice().reverse()], "rgba(255,255,255,.08)");
  if (top) B.fill(circle(A, 1, rOf(1)), top);
}

/** A pile of ingots (and of gold: `bright` lifts the top layer to polished tops). */
function ingotPile(B, A, hex, bright) {
  for (let k = 0; k < 4; k++) {
    const half = 0.47 * (1 - INGOT_SHRINK * k), w0 = k / 4, w1 = (k + 1) / 4 - 0.006, d = half * 2 / 3;
    slab(B, A, [0.5 - half, 0.5 + half], [0.5 - half, 0.5 + half], [w0, w1], hex, (k % 2 ? 0.94 : 1.04) * (k === 3 ? bright : 1));
    for (const j of [1, 2]) B.line(k % 2 ? [A(0.5 - half + d * j, 0.5 - half, w1), A(0.5 - half + d * j, 0.5 + half, w1)] : [A(0.5 - half, 0.5 - half + d * j, w1), A(0.5 + half, 0.5 - half + d * j, w1)], "rgba(20,26,36,.55)", 1);
    B.line([A(0.5 - half, 0.5 + half, w1), A(0.5 + half, 0.5 + half, w1)], "rgba(255,255,255,.35)", 1);
  }
  if (bright === 1) B.patch([A(0.4, 0.46, 0.99), A(0.6, 0.46, 0.99), A(0.6, 0.54, 0.99), A(0.4, 0.54, 0.99)], "rgba(20,26,36,.5)");
}

// ---------- the cargo, simpler than the models ----------
// Timber along its axis, by half (0 a long log's low half, 1 its high, 2 a short bundle): where the logs run in the cell (a low half runs on
// to the join, a high half from it, a hair over each way) and where the ropes lie (a long log's four are evenly spaced, none on the join).
const ALONG = [[0.03, 1.012], [-0.012, 0.97], [0.03, 0.97]];
const ROPES = [[0.28, 0.76], [0.24, 0.72], [0.22, 0.78]];
// Each takes a brush, the cell's map, the cargo's colour and, for timber, whether it lies along y.
const DRAW = {
  // a crate: pine boards in a frame of battens, a rope handle through a slot on each side, the house mark on the right
  1(B, A, hex) {
    slab(B, A, [0.03, 0.97], [0.03, 0.97], [0, 1], hex);
    const ink = "rgba(40,24,6,.5)", mark = "rgba(20,12,4,.8)";
    for (const w of [0.25, 0.5, 0.75]) { B.line([A(0.03, 0.97, w), A(0.97, 0.97, w)], ink, 0.8); B.line([A(0.97, 0.03, w), A(0.97, 0.97, w)], ink, 0.8); }
    for (const v of [0.28, 0.5, 0.72]) B.line([A(0.03, v, 1), A(0.97, v, 1)], ink, 0.8);
    for (const u of [0.14, 0.86]) { B.line([A(u, 0.97, 0), A(u, 0.97, 1)], ink, 1); B.line([A(0.97, u, 0), A(0.97, u, 1)], ink, 1); }
    B.line([A(0.14, 0.97, 0.03), A(0.86, 0.97, 0.97)], ink, 1.4);
    B.patch([A(0.33, 0.97, 0.74), A(0.67, 0.97, 0.74), A(0.67, 0.97, 0.82), A(0.33, 0.97, 0.82)], "rgba(30,18,6,.8)");
    B.patch([A(0.97, 0.33, 0.74), A(0.97, 0.67, 0.74), A(0.97, 0.67, 0.82), A(0.97, 0.33, 0.82)], "rgba(30,18,6,.8)");
    B.line([A(0.36, 0.97, 0.78), A(0.5, 0.97, 0.72), A(0.64, 0.97, 0.78)], "#E3C58A", 1.6);
    B.line(Array.from({ length: 14 }, (_, i) => A(0.97, 0.5 + Math.cos(i / 14 * TAU) * 0.17, 0.36 + Math.sin(i / 14 * TAU) * 0.17)), mark, 1.2, true);
    B.line([A(0.97, 0.5, 0.22), A(0.97, 0.5, 0.5)], mark, 1.2); B.line([A(0.97, 0.36, 0.36), A(0.97, 0.64, 0.36)], mark, 1.2);
  },
  // a barrel: staves, four iron hoops, a round head with its bung, the house mark chalked on the belly
  2(B, A, hex) {
    lathe(B, A, w => barrelRadius(w - 0.5), shade(hex, 0.9), shade(hex, 1.12));
    for (const w of [0.08, 0.25, 0.75, 0.92]) B.line(front(A, w, barrelRadius(w - 0.5) + 0.004), "#26221F", 2.2);
    B.dot(A(0.62, 0.55, 1), 1.7, "rgba(10,6,2,.85)");
    const c = A(0.83, 0.83, 0.5), chalk = "rgba(255,244,214,.85)";
    B.line(disc(A, c, 0.085), chalk, 1.3, true);
    B.line([[c[0] - A.unit * 0.085, c[1]], [c[0] + A.unit * 0.085, c[1]]], chalk, 1.2); B.line([[c[0], c[1] - A.unit * 0.085], [c[0], c[1] + A.unit * 0.085]], chalk, 1.2);
  },
  // timber: four logs tied with rope, lying along x or along y, the sawn ends showing rings. `half` is set for a long log (Korbi,
  // 3 November 2026: "yea long logs is good"): each of its two cells is drawn as its half of one trunk, the logs running on through the
  // join (a hair over it, so no seam shows), the sawn ends only at the far end, the ropes spaced along the whole
  3(B, A, hex, alongY, half) {
    const wood = "#D6B47A", [s0, s1] = ALONG[half ?? 2], P = (s, t, c) => (alongY ? A(t, s, c) : A(s, t, c));
    const at = (a, c) => P(0.97, a, c);                                                                                 // a point on the end face
    const [longK, endK] = alongY ? [0.86, 0.72] : [0.72, 0.86];
    B.fill([P(s0, 0.97, 0), P(s1, 0.97, 0), P(s1, 0.97, 0.94), P(s0, 0.97, 0.94)], shade(hex, longK));
    if (half !== 0) B.fill([P(0.97, 0.03, 0), P(0.97, 0.97, 0), P(0.97, 0.97, 0.94), P(0.97, 0.03, 0.94)], shade(wood, endK));   // (a low half's is under the high one)
    B.fill([P(s0, 0.03, 0.94), P(s1, 0.03, 0.94), P(s1, 0.97, 0.94), P(s0, 0.97, 0.94)], shade(hex, 1.05));
    const dark = "rgba(30,20,8,.55)", rope = "#C9A66B", bark = "rgba(14,7,1,.5)";
    B.line([P(s0, 0.97, 0.47), P(s1, 0.97, 0.47)], dark, 1);                                                            // the two rows of logs
    B.line([P(s0, 0.5, 0.94), P(s1, 0.5, 0.94)], dark, 1);                                                              // and the two backs on top
    for (const c of [0.13, 0.3, 0.64, 0.82]) B.line([P(s0, 0.97, c), P(s1, 0.97, c)], bark, 0.8);                      // the furrows of the bark, along the logs
    for (const v of [0.14, 0.34, 0.66, 0.86]) B.line([P(s0, v, 0.94), P(s1, v, 0.94)], bark, 0.8);
    for (const p of ROPES[half ?? 2]) {                                                                                 // ropes round the lot
      B.line([P(p, 0.97, 0), P(p, 0.97, 0.94)], rope, 2);
      B.line([P(p, 0.03, 0.94), P(p, 0.97, 0.94)], rope, 2);
    }
    if (half === 0) return;
    for (const [a, c] of [[0.27, 0.235], [0.73, 0.235], [0.27, 0.705], [0.73, 0.705]]) {                               // the four sawn ends
      const ringAt = r => Array.from({ length: 12 }, (_, i) => at(a + Math.cos(i / 12 * TAU) * r, c + Math.sin(i / 12 * TAU) * r));
      B.patch(ringAt(0.225), "#D9B97F"); B.line(ringAt(0.225), "rgba(60,36,10,.6)", 1, true); B.line(ringAt(0.13), "rgba(120,80,30,.55)", 0.8, true); B.line(ringAt(0.05), "rgba(120,80,30,.55)", 0.8, true);
    }
  },
  // a pile of ingots: four layers of bars, each across the one below and a little smaller
  4(B, A, hex) { ingotPile(B, A, hex, 1); },
  // a chest: a plank box with a lid like half a barrel laid down, black iron straps, a brass lock plate and ring
  5(B, A, hex) {
    slab(B, A, [0.03, 0.97], [0.13, 0.87], [0, 0.52], hex);
    const arc = u => Array.from({ length: 17 }, (_, i) => A(u, 0.5 + 0.37 * Math.cos(i / 16 * Math.PI), 0.52 + 0.48 * Math.sin(i / 16 * Math.PI)));
    B.fill(hull([...arc(0.03), ...arc(0.97)]), shade(hex, 1.0));
    B.fill(arc(0.97), shade(hex, 0.8));
    const iron = "#16161A", brass = "#D9AE4C";
    for (const u of [0.2, 0.8]) { B.line(arc(u), iron, 2.6); B.line([A(u, 0.87, 0), A(u, 0.87, 0.52)], iron, 2.6); }
    B.line([A(0.97, 0.5, 0), A(0.97, 0.5, 0.52)], iron, 2.6); B.line(arc(0.97), iron, 1.4);
    B.patch([A(0.44, 0.87, 0.2), A(0.56, 0.87, 0.2), A(0.56, 0.87, 0.4), A(0.44, 0.87, 0.4)], brass);
    B.line([A(0.5, 0.87, 0.4), A(0.5, 0.87, 0.58)], brass, 2);
    for (const u of [0.2, 0.8]) for (const w of [0.1, 0.3]) B.dot(A(u, 0.87, w), 1.4, brass);
    B.line(disc(A, A(0.97, 0.5, 0.26), 0.07, 12), brass, 1.4, true);
  },
  // a sack: slumped burlap drawn in at the neck, tied with a cord, the merchant's mark on the belly
  6(B, A, hex) {
    lathe(B, A, w => sackRadius(w - 0.5), shade(hex, 0.92), shade(hex, 1.0), 12);
    B.line(front(A, 0.95, sackRadius(0.45) + 0.004), "#7B5E34", 2.2);
    B.dot(A(0.5, 0.5, 1), A.unit * 0.05, "#7B5E34");
    const c = A(0.8, 0.8, 0.32), u = A.unit * 0.1;
    B.line([[c[0], c[1] - u], [c[0] + u * 0.86, c[1] + u * 0.5], [c[0] - u * 0.86, c[1] + u * 0.5]], "rgba(80,50,28,.8)", 1.4, true);
  },
  // gold ingots: the ingots' pile in gold with polished tops, and a crown stamped on each top bar (GOLD_MARK, the 3D one's too)
  7(B, A, hex) {
    ingotPile(B, A, hex, 1.14);
    for (const bar of GOLD_BARS) B.shape(GOLD_MARK.map(q => { const [x, z] = crownOn(bar, q); return A(0.5 + x, 0.5 + z, 0.995); }), "rgba(70,30,2,.85)");
  },
  // birch: six slender white logs in a pyramid, black dashes round the bark; seen from its end it is a triangle, not oak's square
  8(B, A, hex, alongY, half) {
    const H = 0.83, ink = "rgba(18,14,10,.8)", [s0, s1] = ALONG[half ?? 2], P = (s, t, c) => (alongY ? A(t, s, c) : A(s, t, c));
    const bottom = [P(s0, 0.97, 0), P(s1, 0.97, 0)], ridge = [P(s0, 0.5, H), P(s1, 0.5, H)];
    // a point on the slope: e along the log (0 to 1), f up the slope (0 the foot, 1 the ridge)
    const slope = (e, f) => [0, 1].map(i => { const lo = bottom[0][i] + e * (bottom[1][i] - bottom[0][i]), hi = ridge[0][i] + e * (ridge[1][i] - ridge[0][i]); return lo + f * (hi - lo); });
    B.fill([bottom[0], bottom[1], ridge[1], ridge[0]], shade(hex, 0.97));
    for (const f of [0.34, 0.67]) B.line([slope(0, f), slope(1, f)], "rgba(70,58,40,.55)", 1);              // the three logs' backs
    const end = (a, c) => P(0.97, a, c);
    if (half !== 0) B.fill([end(0.03, 0), end(0.97, 0), end(0.5, H)], "#3A3226");
    for (const rope of ROPES[half ?? 2]) B.line([slope((rope - s0) / (s1 - s0), 0), slope((rope - s0) / (s1 - s0), 1)], "#B99B64", 2);
    const dashes = [[0.1, 0.08], [0.34, 0.12], [0.56, 0.05], [0.8, 0.1], [0.2, 0.4], [0.46, 0.45], [0.68, 0.38], [0.9, 0.42], [0.12, 0.74], [0.4, 0.78], [0.62, 0.72], [0.86, 0.8]];
    for (const [e, f] of dashes) B.line([slope(e, f), slope(e + 0.01, f + 0.15)], ink, 1.6);
    if (half === 0) return;
    for (const L of BIRCH_LOGS) {
      const a = 0.5 + L.z, c = L.y + 0.5, ring = r => Array.from({ length: 12 }, (_, i) => end(a + Math.cos(i / 12 * TAU) * r, c + Math.sin(i / 12 * TAU) * r));
      B.shape(ring(L.r), shade(hex, 0.72)); B.shape(ring(L.r * 0.78), "#EAD6A6");
      B.line(ring(L.r * 0.4), "rgba(120,80,30,.5)", 0.8, true);
    }
  },
};

/**
 * One piece drawn into `g` from its three faces as screen polygons ({ top, left, right }, each four points as cubeFaces
 * gives them): a cargo's number (1 to 8), or 0 for one under tarpaulin (`lit`: the piece picked out under it). `alongY`: a
 * bundle of timber lies along y. `detail` is the packing, left out where a whole stack is the size of a thumb.
 */
function paintPiece(g, faces, ware, { lit = false, detail = true, alongY = false, half = null, tap = null } = {}) {
  if (tap) g.addEventListener("click", tap);
  const B = brush(g, detail);
  if (!ware) paintTarp(B, faces, lit);
  else DRAW[ware](B, cellMap(faces), WARES[ware - 1].hex, alongY, half);
}
/** A plain box under tarpaulin: grey on its faces, ropes across it. */
function paintTarp(B, faces, lit) {
  const base = lit ? LIT : TARP, rope = "rgba(0,0,0,.36)";
  for (const [name, k] of [["left", 0.72], ["right", 0.86], ["top", 1.05]]) B.fill(faces[name], shade(base, k));
  const at = (poly, u, v) => [poly[0][0] + u * (poly[1][0] - poly[0][0]) + v * (poly[3][0] - poly[0][0]), poly[0][1] + u * (poly[1][1] - poly[0][1]) + v * (poly[3][1] - poly[0][1])];
  for (const name of ["left", "right", "top"]) {
    const f = faces[name];
    B.line([at(f, 0.33, 0), at(f, 0.33, 1)], rope, 1); B.line([at(f, 0.66, 0), at(f, 0.66, 1)], rope, 1); B.line([at(f, 0, 0.5), at(f, 1, 0.5)], rope, 1);
  }
}

// ---------- the quay ----------
/** The planks of one floor tile, laid along x, their joints staggered by where the tile lies. */
function planks(tile, x, y) {
  const at = (u, v) => [tile[0][0] + u * (tile[1][0] - tile[0][0]) + v * (tile[3][0] - tile[0][0]), tile[0][1] + u * (tile[1][1] - tile[0][1]) + v * (tile[3][1] - tile[0][1])];
  const line = (u1, v1, u2, v2) => `M${num(at(u1, v1)[0])} ${num(at(u1, v1)[1])}L${num(at(u2, v2)[0])} ${num(at(u2, v2)[1])}`;
  let d = line(0, 0.25, 1, 0.25) + line(0, 0.5, 1, 0.5) + line(0, 0.75, 1, 0.75);
  for (let j = 0; j < 4; j++) { const u = 0.28 + ((x * 3 + y * 5 + j * 2) % 5) * 0.11; d += line(u, j / 4, u, (j + 1) / 4); }
  return d;
}
/** The quay's body under the floor's two near edges: timber facing, a pile at every cell's edge and a waling across them. */
function quayEdge(svg, X, Y, b, to) {
  const t = QUAY_DEPTH, lerp = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k], xy = q => q.map(n => n.toFixed(1)).join(" ");
  const facing = (x0, y0, x1, y1, side) => {
    const f = [isoPoint(x0, y0, 0, b), isoPoint(x1, y1, 0, b), isoPoint(x1, y1, -t, b), isoPoint(x0, y0, -t, b)].map(p => to([p.sx, p.sy]));
    svg.appendChild(el("polygon", { points: f.map(q => q.map(n => n.toFixed(1)).join(",")).join(" "), class: `mf-quay ${side}` }));
    svg.appendChild(el("path", { d: `M${xy(f[0])}L${xy(f[3])}M${xy(f[1])}L${xy(f[2])}M${xy(lerp(f[0], f[3], 0.5))}L${xy(lerp(f[1], f[2], 0.5))}`, class: "mf-pile" }));
  };
  for (let x = 0; x < X; x++) facing(x, Y, x + 1, Y, "l");
  for (let y = 0; y < Y; y++) facing(X, y, X, y + 1, "r");
}
/** A few strokes of water lapping at the quay's foot. */
function ripples(svg, X, Y, b, to) {
  const wave = (x, y) => { const p = isoPoint(x, y, -QUAY_DEPTH, b), [px, py] = to([p.sx, p.sy]); return `M${(px - 9).toFixed(1)} ${(py + 7).toFixed(1)}q4.5 -3.5 9 0t9 0`; };
  svg.appendChild(el("path", { d: wave(X * 0.3, Y) + wave(X * 0.78, Y) + wave(X, Y * 0.3) + wave(X, Y * 0.78), class: "mf-wave" }));
}

// ---------- the flat drawing: one stack on the quay ----------
/**
 * The stack as one isometric panel on the quay: { panel, drops }. opts: drop (an arrival order: the pieces fall in; at
 * a table, times gives each one's landing on the round's clock and since how far into the drop it is), blank (the quay
 * only, for a marked position), mark {x,y,z} (outline a piece, or its place on the quay with the tier named when it's
 * hidden), marks [keys] (outline these), highlight (dim every cargo but this), tier (dim every tier but this), tap(key),
 * selected [keys], turns (a turned stack: its timber lies the other way), grey (every piece under tarpaulin), ring (a
 * key: that piece uncovered and outlined), small (no room for drops or packing), appear (it comes back on the quay: fades in).
 */
export function stage(cells, opts = {}) {
  return is3d() ? stage3d(cells, opts) : stageFlat(cells, opts);
}
function stageFlat(cells, opts) {
  const panel = node("div", `mf-panel${opts.small ? " small" : ""}`);
  const turns = opts.turns || 0, b = boxFor(turns), X = cells.length, Y = cells[0].length, Z = cells[0][0].length;
  const frame = frameOf(X, Y, Z, b, opts), { W, H, room, to } = frame;
  const svg = el("svg", { viewBox: `0 ${-room} ${W} ${H + room}`, class: opts.tap ? "tap" : "" });
  svg.style.setProperty("--aspect", frame.aspect.toFixed(3));
  const markKey = opts.mark ? `${opts.mark.x},${opts.mark.y},${opts.mark.z}` : null;
  const visible = opts.blank || markKey ? visibleSet(cells, b) : null;
  if (!opts.small) ripples(svg, X, Y, b, to);
  quayEdge(svg, X, Y, b, to);
  for (let x = 0; x < X; x++) for (let y = 0; y < Y; y++) {        // the quay's floor
    const f = cubeFaces(x, y, -1, b).top.map(to);
    const marked = opts.mark && opts.mark.x === x && opts.mark.y === y && (opts.blank || !visible.has(markKey));
    svg.appendChild(el("polygon", { points: f.map(q => q.map(n => n.toFixed(1)).join(",")).join(" "), class: marked ? "mf-floor marked" : "mf-floor" }));
    if (!opts.small && !marked) svg.appendChild(el("path", { d: planks(f, x, y), class: "mf-plank" }));
    if (marked) {
      const c = f.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]);
      const t = el("text", { x: c[0].toFixed(1), y: (c[1] + 6).toFixed(1), "text-anchor": "middle", "font-size": 17, "font-weight": 800, fill: "#fff" });   // read in a question's card too
      t.textContent = `tier ${opts.mark.z + 1}`;
      svg.appendChild(t);
    }
  }
  const cubes = layout(cells, turns, frame);
  const named = piecesNamed(cubes, [...(opts.marks || []), ...(opts.selected || []), ...(markKey ? [markKey] : [])]);
  const ringPiece = opts.ring ? pieceKey(cubes.find(c => c.key === opts.ring) || {}) : null;
  const markHidden = markKey && visible && !visible.has(markKey) ? markKey : null;
  const drops = opts.drop ? (opts.times ? { times: opts.times, last: 0 } : dropTimes(cells, opts.drop)) : { times: {}, last: 0 };
  if (!opts.blank) for (const cube of cubes) {
    const key = cube.key, faces = cube.faces, piece = pieceKey(cube), long = !opts.grey && cube.half != null;
    const dim = (opts.highlight && typeOf(cube.c) !== opts.highlight) || (opts.tier != null && cube.z !== opts.tier);
    const ringed = ringPiece != null && piece === ringPiece;
    const g = el("g", { class: `cube${opts.drop ? " drop" : ""}`, "data-key": key });
    if (dim) g.setAttribute("opacity", 0.25);
    if (opts.drop) g.style.animationDelay = `${drops.times[key] - (opts.since || 0)}ms`;   // landed already, for a phone that comes in late
    paintPiece(g, faces, opts.grey ? 0 : typeOf(cube.c), { lit: ringed && opts.grey, detail: !opts.small, alongY: yawOf(cube, turns, !!opts.grey) !== 0, half: long ? cube.half : null, tap: opts.tap ? () => opts.tap(piece) : null });
    if (!ringed && named.has(piece) && markHidden !== piece && (!long || cube.half === 1)) {          // a long log's outline is drawn once, round both its tops
      const tops = cubes.filter(o => pieceKey(o) === piece).flatMap(o => o.faces.top);
      g.appendChild(el("polygon", { points: pts(long ? hull(tops) : faces.top), fill: "none", stroke: "var(--ink)", "stroke-width": 3.5, "stroke-linejoin": "round", "pointer-events": "none" }));
    } else if (ringed && cube.half == null) {                       // (a long log has the hexagon over the stack, below)
      for (const name of ["left", "right", "top"]) g.appendChild(el("polygon", { points: pts(faces[name]), fill: "none", stroke: "var(--ink)", "stroke-width": 3.5, "stroke-linejoin": "round", "pointer-events": "none" }));
    }
    svg.appendChild(g);
  }
  if (ringPiece != null) {                                          // the marked piece's hexagon over the rest, through whatever stands in front
    const outline = hull(cubes.filter(c => pieceKey(c) === ringPiece).flatMap(c => Object.values(c.faces).flat()));
    for (const [stroke, width] of [["var(--yard)", 7], ["var(--ink)", 3.4]]) svg.appendChild(el("polygon", { points: pts(outline), fill: "none", stroke, "stroke-width": width, "stroke-linejoin": "round", "pointer-events": "none" }));
  }
  panel.appendChild(svg);
  if (opts.appear) panel.classList.add("appear");
  return { panel, drops };
}

/** One piece of a cargo type, small: beside an answer, so the answer names the cargo and shows its shape. */
export function wareIcon(ware) {
  return is3d() ? icon3d(ware) : wareIconFlat(ware);
}
function wareIconFlat(ware) {
  const b = boxFor(0), long = isLong(ware), parts = long ? [0, 1] : [null], at = x => cubeFaces(x, 0, 0, b);       // a long log: two cells along x
  const all = parts.flatMap((_, x) => Object.values(at(x)).flat());
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]), minX = Math.min(...xs), minY = Math.min(...ys), w = Math.max(...xs) - minX, h = Math.max(...ys) - minY, size = Math.max(w, h), k = 40 / size;
  const to = p => [(p[0] - minX + (size - w) / 2) * k + 2, (p[1] - minY + (size - h) / 2) * k + 2];
  const svg = el("svg", { viewBox: "0 0 44 44", class: "mf-icon", "aria-hidden": "true" });
  const g = el("g");
  parts.forEach((half, x) => paintPiece(g, Object.fromEntries(Object.entries(at(x)).map(([n, poly]) => [n, poly.map(to)])), typeOf(ware), { detail: true, half }));
  svg.appendChild(g);
  return svg;
}

/** What happens to a stack leaving the quay or coming back: "away" (shipped), "fade" (a change round: the stack goes and
 *  the empty quay stays), "appear". A flat panel does it with its classes (manifest.css), a 3D one in its own canvas. */
export function playOut(panel, kind) {
  if (panel._pic) playOut3d(panel, kind);
  else panel.classList.add(kind);
}
