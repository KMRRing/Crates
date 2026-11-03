// How Pipes draws its squares, shared by the board (pipes.js) and the puzzle (pipes-puzzle-ui.js): a square is 60 units in
// an SVG whose viewBox is the board in squares, a pipe is brass with a dark edge and a shine, the oil dark inside it. Colours
// are the page's (--pi-*: pipes.css, and themes.css for the other themes).
import { DIRS, PIECES, back } from "./pipes-pieces.js";

export const SVG = "http://www.w3.org/2000/svg";
export const T = 60, MID = 30;
export const el = (tag, attrs = {}, parent = null) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (parent) parent.appendChild(n); return n; };
export const edge = d => [MID + DIRS[d][0] * MID, MID + DIRS[d][1] * MID];

/** A channel's line through a square, from side a to side b (a < 0: from the middle): straight, or a quarter circle
 *  round the corner the two sides share. Its length too, for the oil running along it. */
export function channel(a, b) {
  // a side up or down (the 3D map) is a riser in the middle of the square: the pipe to it runs from the other side
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
/** A channel's pipe along a line: its dark edge, the brass and a shine; a crossing's upright channel first lays a strip
 *  of ground, so it bridges the other. */
export function pipeAlong(g, d, bridge = false) {
  if (bridge) el("path", { d, class: "pipe-edge", "stroke-width": 26, stroke: "var(--pi-ground)" }, g);
  el("path", { d, class: "pipe-edge", "stroke-width": 22 }, g);
  el("path", { d, class: "pipe", "stroke-width": 16 }, g);
  el("path", { d, class: "pipe-shine", "stroke-width": 4 }, g);
}
/** A piece's pipe in a square (and the queue's tiles), channel by channel; oil(i) draws the oil in channel i straight
 *  after its pipe, so whatever lies over a channel (a crossing's bridge) lies over its oil too. */
export function drawPipe(g, piece, oil = () => {}) {
  const chs = PIECES[piece], order = piece === "x" ? [1, 0] : chs.map((_, i) => i);
  for (const i of order) {
    const [p, q] = chs[i];
    if (p >= 4 && q >= 4) { drawRiser(g, true, true); oil(i); continue; }
    pipeAlong(g, channel(p, q).d, piece === "x" && i === 0);
    if (p >= 4 || q >= 4) drawRiser(g, p === 4 || q === 4, p === 5 || q === 5);
    oil(i);
  }
}
/** A riser in the middle of a square: a ring of pipe with an arrow up and/or down, where the pipe goes on through the layer above or below. */
export function drawRiser(g, up, down) {
  el("circle", { cx: MID, cy: MID, r: 13, fill: "var(--pi-pipe-dark)", stroke: "none" }, g);
  el("circle", { cx: MID, cy: MID, r: 9.5, fill: "var(--pi-pipe)", stroke: "none" }, g);
  const tri = (dy, dir) => el("path", { d: `M${MID - 5} ${MID + dy + dir * 2.5}L${MID} ${MID + dy - dir * 3.5}L${MID + 5} ${MID + dy + dir * 2.5}Z`, fill: "var(--pi-ground)", stroke: "none" }, g);
  if (up && down) { tri(-3.5, 1); tri(4.5, -1); } else if (up) tri(0, 1); else tri(0, -1);
}
/** A square of ground, the rock's dark if it is one. */
export function drawGround(g, rock = false) {
  el("rect", { x: 2, y: 2, width: T - 4, height: T - 4, rx: 8, fill: rock ? "var(--pi-rock)" : "var(--pi-tile)", stroke: "var(--pi-tile-edge)", "stroke-width": 1 }, g);
  if (rock) for (const [cx, cy, r] of [[20, 24, 9], [38, 36, 11], [24, 42, 6]]) el("circle", { cx, cy, r, fill: "var(--pi-tile-edge)" }, g);
}
/** The wellhead: its outlet stub and a derrick over it. The oil in the stub is the caller's, drawn before the derrick. */
export function drawSource(g, d, oil = () => {}) {
  pipeAlong(g, channel(-1, d).d);
  oil();
  el("path", { d: "M18 46 L30 12 L42 46 M22 35 H38 M25 24 H35", fill: "none", stroke: "var(--pi-in)", "stroke-width": 3.5, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
  el("rect", { x: 13, y: 44, width: 34, height: 5, rx: 2, fill: "var(--pi-in)" }, g);
  if (d >= 4) drawRiser(el("g", { transform: "translate(40 40) scale(.7) translate(-30 -30)" }, g), d === 4, d === 5);
}
/** The terminal: its inlet stub (with the oil in it, if the caller draws it), and a tank with its roof, flying a flag. */
export function drawTerminal(g, d, oil = () => {}) {
  pipeAlong(g, channel(-1, d).d);
  oil();
  el("rect", { x: 13, y: 22, width: 34, height: 26, rx: 4, fill: "var(--pi-good)", stroke: "#fff", "stroke-width": 2 }, g);
  el("path", { d: "M13 26 Q30 15 47 26", fill: "var(--pi-good)", stroke: "#fff", "stroke-width": 2 }, g);
  el("path", { d: "M40 18 V6 L50 9 L40 12", fill: "#fff", stroke: "#fff", "stroke-width": 1.5, "stroke-linejoin": "round" }, g);
  if (d >= 4) drawRiser(el("g", { transform: "translate(18 48) scale(.7) translate(-30 -30)" }, g), d === 4, d === 5);
}
export const PIECE_NAMES = { h: "straight across", v: "straight up and down", ne: "bend up and right", nw: "bend up and left", se: "bend down and right", sw: "bend down and left", x: "crossing",
  z: "riser, up and down", nu: "bend from the north side to the layer above", eu: "bend from the east side to the layer above", su: "bend from the south side to the layer above", wu: "bend from the west side to the layer above",
  nd: "bend from the north side to the layer below", ed: "bend from the east side to the layer below", sd: "bend from the south side to the layer below", wd: "bend from the west side to the layer below",
  xn: "crossing of a north-south straight and a riser", xe: "crossing of an east-west straight and a riser" };
/** A board piece as a small tile, for the queue and the puzzle's hand. */
export function pieceTile(piece, first, tag = "span") {
  const box = document.createElement(tag);
  box.className = `pi-q${first ? " first" : ""}`;
  const svg = el("svg", { viewBox: "0 0 60 60", "aria-hidden": "true" });
  drawPipe(svg, piece);
  box.append(svg);
  box.setAttribute("aria-label", PIECE_NAMES[piece]);
  return box;
}
