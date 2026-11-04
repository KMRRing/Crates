// Shared: the parked 3D map's old-model engine (pipes-puzzle*.js) and the flat Gears (pipes-train*.js, pipes-wheels.js) both use el, T, MID, turnArrow and drawGround.
// How Gears draws its squares, shared by the board (pipes-puzzle-ui.js) and the hand: a square is 60 units in an SVG whose
// viewBox is the board in squares. A gear is a brass wheel whose teeth show only on the sides it meshes with (a clip, so the
// teeth run through the opening as the wheel turns), with a steel hub and a ruby jewel; a fixed gear is darker, with a stud.
// Colours are the page's (--pi-*, --gr-*: pipes.css, and themes.css for the other themes).
import { DIRS, PIECES, back, isReducer } from "./pipes-pieces.js";

export const SVG = "http://www.w3.org/2000/svg";
export const T = 60, MID = 30;
export const el = (tag, attrs = {}, parent = null) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (parent) parent.appendChild(n); return n; };
export const edge = d => [MID + DIRS[d][0] * MID, MID + DIRS[d][1] * MID];

/** A line through a square from side a to side b (a < 0: from the middle), straight or a quarter circle round the corner the
 *  two sides share: the dashed way the power takes. A side up or down (the 3D map) is the middle. */
export function channel(a, b) {
  if (b >= 4) return a < 0 || a >= 4 ? { d: `M${MID} ${MID}L${MID} ${MID}`, len: 0 } : { d: `M${edge(a)[0]} ${edge(a)[1]}L${MID} ${MID}`, len: MID };
  if (a >= 4) return { d: `M${MID} ${MID}L${edge(b)[0]} ${edge(b)[1]}`, len: MID };
  const [bx, by] = edge(b);
  if (a < 0) return { d: `M${MID} ${MID}L${bx} ${by}`, len: MID };
  const [ax, ay] = edge(a);
  if (a === back(b)) return { d: `M${ax} ${ay}L${bx} ${by}`, len: T };
  const cx = MID + (DIRS[a][0] + DIRS[b][0]) * MID, cy = MID + (DIRS[a][1] + DIRS[b][1]) * MID;
  const sweep = (ax - cx) * (by - cy) - (ay - cy) * (bx - cx) > 0 ? 1 : 0;
  return { d: `M${ax} ${ay}A${MID} ${MID} 0 0 ${sweep} ${bx} ${by}`, len: Math.PI * MID / 2 };
}

// ---------- wheels ----------
let uid = 0;
const rad = a => a * Math.PI / 180;
const ANGLE = [-90, 0, 90, 180];                   // the sides N E S W as angles on the screen (clockwise from east)
const pt = (r, a) => `${(r * Math.cos(rad(a))).toFixed(2)} ${(r * Math.sin(rad(a))).toFixed(2)}`;
const toothAt = (root, tip, a, w0, w1) => `M${pt(root, a - w0)}L${pt(tip, a - w1)}L${pt(tip, a + w1)}L${pt(root, a + w0)}Z`;
const wedge = (a, half, R) => `M0 0L${pt(R, a - half)}A${R} ${R} 0 0 1 ${pt(R, a + half)}Z`;

/**
 * A wheel of pitch radius r with n teeth, centred at (cx, cy), its teeth showing only towards `sides` (side numbers 0-3;
 * the teeth are seen through a clip, the wheel turns behind it). `dir`: 0 clockwise, 1 counter-clockwise, null if it is not
 * known (the board animates every `.spin` of a solved level, n teeth a turn). `skin` names the look: "" brass, "steel",
 * "lower", "barrel". `phase` (degrees) turns the teeth, so that two wheels side by side interleave.
 */
export function wheel(g, { cx, cy, r, n, sides, dir = null, phase = 0, skin = "" }) {
  const root = r - 3.6, tip = r + 3.2, pitch = 360 / n, half = n > 8 ? 40 : 44;
  const out = el("g", { transform: `translate(${cx} ${cy})`, class: `gear ${skin}` }, g);
  const spin = parent => el("g", { class: `spin${dir === null ? "" : dir ? " ccw" : " cw"}`, "data-n": n }, parent);
  if (sides.length) {
    const id = `gc${++uid}`, clip = el("clipPath", { id }, out);
    for (const s of sides) el("path", { d: wedge(ANGLE[s], half, r + 12) }, clip);
    const teeth = spin(el("g", { "clip-path": `url(#${id})` }, out));
    let d = "";
    for (let k = 0; k < n; k++) d += toothAt(root - 0.5, tip, k * pitch + phase, pitch * 0.2, pitch * 0.13);
    el("path", { d, class: "g-tooth" }, teeth);
  }
  const body = spin(out);
  el("circle", { r: root, class: "g-body" }, body);
  if (skin === "barrel") {
    // the mainspring's barrel: the coil of the spring
    let d = "M0 0";
    for (let t = 0; t <= 5.2 * Math.PI; t += 0.25) d += `L${((root * 0.12 + t * 1.5) * Math.cos(t)).toFixed(2)} ${((root * 0.12 + t * 1.5) * Math.sin(t)).toFixed(2)}`;
    el("path", { d, class: "g-spring" }, body);
  } else {
    el("circle", { r: root - 5, class: "g-rim" }, body);
    const holes = n > 8 ? 5 : 3, hr = n > 8 ? 4.2 : 2.4, at = (root - 5) * 0.62 + (n > 8 ? 2 : 0);
    for (let k = 0; k < holes; k++) el("circle", { cx: (at * Math.cos(rad(k * 360 / holes - 90))).toFixed(2), cy: (at * Math.sin(rad(k * 360 / holes - 90))).toFixed(2), r: hr, class: "g-hole" }, body);
  }
  el("circle", { r: n > 8 ? 6 : 4, class: "g-hub" }, body);
  el("circle", { r: n > 8 ? 2.4 : 1.7, class: "g-jewel" }, body);
  return out;
}

/** An arbor through a square, up or down (the 3D map): a steel ring with an arrow each way it goes. */
export function drawArbor(g, up, down, at = [MID, MID], s = 1) {
  const a = el("g", { transform: `translate(${at[0]} ${at[1]}) scale(${s})`, class: "arbor" }, g);
  el("circle", { r: 12.5, class: "g-steel-edge" }, a);
  el("circle", { r: 9, class: "g-steel" }, a);
  const tri = (dy, dir) => el("path", { d: `M-5 ${dy + dir * 2.5}L0 ${dy - dir * 3.5}L5 ${dy + dir * 2.5}Z`, class: "g-arrow" }, a);
  if (up && down) { tri(-3.5, 1); tri(4.5, -1); } else if (up) tri(0, 1); else tri(0, -1);
}

/** A small circular arrow, clockwise (dir 0) or counter-clockwise (1), centred at (x, y): which way a gear turns. */
export function turnArrow(g, x, y, dir, r = 5, cls = "g-turn") {
  const a0 = -140, a1 = 110, tang = rad(a1 + 90), hx = r * Math.cos(rad(a1)), hy = r * Math.sin(rad(a1));
  const at = (len, t) => `${(hx + len * Math.cos(t)).toFixed(2)} ${(hy + len * Math.sin(t)).toFixed(2)}`;
  const n = el("g", { transform: `translate(${x} ${y})${dir ? " scale(-1 1)" : ""}`, class: cls }, g);
  el("path", { d: `M${pt(r, a0)}A${r} ${r} 0 1 1 ${pt(r, a1)}`, class: "g-turn-arc" }, n);
  el("path", { d: `M${at(3.8, tang)}L${at(2.8, tang + 2.3)}L${at(2.8, tang - 2.3)}Z`, class: "g-turn-head" }, n);
  return n;
}

/**
 * A piece laid in a square: its wheels, channel by channel. opts: dir (an array by channel of the way each turns, 0 or 1,
 * or missing), red ([first, second]: the two gears of a reduction, first being the west or north one), phase (true: the
 * teeth sit half a tooth along, so they interleave with a neighbour's).
 */
export function drawGear(g, piece, opts = {}) {
  const chs = PIECES[piece], dir = opts.dir || [], phase = opts.phase ? 15 : 0;
  if (isReducer(piece)) {
    // two small gears meshed in one square: the train comes in at one and goes out at the other, turning the other way
    const across = chs[0][0] % 2 === 1, [d1, d2] = opts.red || [null, null];
    const a = across ? [15, 30] : [30, 15], b = across ? [45, 30] : [30, 45];
    const outA = across ? 3 : 0, outB = across ? 1 : 2, toB = across ? 1 : 2, toA = across ? 3 : 0;
    wheel(g, { cx: a[0], cy: a[1], r: 15, n: 6, sides: [outA, toB], dir: d1, phase: opts.phase ? 30 : 0 });
    wheel(g, { cx: b[0], cy: b[1], r: 15, n: 6, sides: [outB, toA], dir: d2, phase: opts.phase ? 0 : 30 });
    return;
  }
  if (piece === "x") {
    // two gears on separate levels: the lower one east-west, the upper one steel, north-south
    wheel(g, { cx: MID, cy: MID, r: 30, n: 12, sides: [1, 3], dir: dir[1] ?? null, phase, skin: "lower" });
    wheel(g, { cx: MID, cy: MID, r: 24, n: 10, sides: [0, 2], dir: dir[0] ?? null, phase: opts.phase ? 18 : 0, skin: "steel" });
    return;
  }
  if (piece === "xn" || piece === "xe") {
    wheel(g, { cx: MID, cy: MID, r: 30, n: 12, sides: piece === "xn" ? [0, 2] : [1, 3], dir: dir[0] ?? null, phase, skin: "lower" });
    drawArbor(g, true, true);
    return;
  }
  const [p, q] = chs[0], sides = [p, q].filter(s => s < 4), v = [p, q].filter(s => s >= 4);
  if (sides.length) wheel(g, { cx: MID, cy: MID, r: 30, n: 12, sides, dir: dir[0] ?? null, phase });
  else el("path", { d: "M30 6V54", class: "g-rod" }, g);
  if (v.length) drawArbor(g, v.includes(4), v.includes(5), sides.length ? [MID + 17, MID + 17] : [MID, MID], sides.length ? 0.7 : 1.15);
}

/** A square of ground; a pillar (the rock) is a block bolted through the plate. */
export function drawGround(g, rock = false) {
  el("rect", { x: 2, y: 2, width: T - 4, height: T - 4, rx: 8, fill: rock ? "var(--pi-rock)" : "var(--pi-tile)", stroke: "var(--pi-tile-edge)", "stroke-width": 1 }, g);
  if (!rock) return;
  el("rect", { x: 10, y: 10, width: 40, height: 40, rx: 5, class: "g-pillar" }, g);
  el("circle", { cx: MID, cy: MID, r: 11, class: "g-screw" }, g);
  el("path", { d: "M23 37L37 23", class: "g-slot" }, g);
}
/** The mainspring: a barrel with its coil, its teeth towards side d, turning clockwise. */
export function drawSource(g, d, opts = {}) {
  wheel(g, { cx: MID, cy: MID, r: 27, n: 12, sides: d < 4 ? [d] : [], dir: opts.dir ?? null, skin: "barrel" });
  if (d >= 4) drawArbor(g, d === 4, d === 5, [MID + 17, MID + 17], 0.7);
  turnArrow(g, 47, 47, 0, 5, "g-turn bright");
}
/** The load at the end of the train: a small watch dial on a wheel with teeth towards side d. Returns its two hands, which
 *  the board advances when the train runs. */
export function drawTerminal(g, d, opts = {}) {
  if (d < 4) wheel(g, { cx: MID, cy: MID, r: 27, n: 12, sides: [d], dir: opts.dir ?? null, skin: "steel" });
  else drawArbor(g, d === 4, d === 5, [MID + 17, MID + 17], 0.7);
  const dial = el("g", { transform: `translate(${MID} ${MID})`, class: "dial" }, g);
  el("circle", { r: 17, class: "g-dial" }, dial);
  for (let k = 0; k < 12; k++) el("path", { d: `M${pt(k % 3 ? 14.2 : 12.6, k * 30)}L${pt(15.8, k * 30)}`, class: "g-tick" }, dial);
  const hour = el("path", { d: "M0 1.5V-8.5", class: "g-hand hour", transform: "rotate(-60)" }, dial);
  const minute = el("path", { d: "M0 2V-12.5", class: "g-hand minute", transform: "rotate(60)" }, dial);
  el("circle", { r: 1.8, class: "g-jewel" }, dial);
  return { hour, minute };
}

export const PIECE_NAMES = { h: "gear, meshing east and west", v: "gear, meshing north and south", ne: "gear, meshing north and east", nw: "gear, meshing north and west", se: "gear, meshing south and east", sw: "gear, meshing south and west", x: "crossover, two gears on separate levels",
  rh: "reduction, two meshed gears, east and west", rv: "reduction, two meshed gears, north and south",
  z: "arbor, up and down", nu: "gear meshing north, on an arbor going up", eu: "gear meshing east, on an arbor going up", su: "gear meshing south, on an arbor going up", wu: "gear meshing west, on an arbor going up",
  nd: "gear meshing north, on an arbor going down", ed: "gear meshing east, on an arbor going down", sd: "gear meshing south, on an arbor going down", wd: "gear meshing west, on an arbor going down",
  xn: "crossover of a north-south gear and an arbor", xe: "crossover of an east-west gear and an arbor" };
/** A piece as a small tile, for the hand. */
export function pieceTile(piece, first, tag = "span") {
  const box = document.createElement(tag);
  box.className = `pi-q${first ? " first" : ""}`;
  const svg = el("svg", { viewBox: "-4 -4 68 68", "aria-hidden": "true" });
  drawGear(svg, piece, {});
  box.append(svg);
  box.setAttribute("aria-label", PIECE_NAMES[piece]);
  return box;
}
