// How Gears draws its squares (4 November 2026), for the board and the hand: a square is 60 units in an SVG whose viewBox is the
// board in squares. Every gear is a WHOLE wheel with all its teeth, never clipped: a single fills the square and its teeth reach
// the edges, the gears of a duo or trio sit meshed inside it, and a tooth of one wheel lies in a gap of the next (`phasesOf`
// sets the angle of every wheel from its mesh). Brass wheels with a steel hub and a ruby jewel; the mainspring is a barrel
// with its coil, the load a steel wheel with a watch dial, a fixed gear darker with a copper mark. Colours are the page's
// (--pi-*, --gr-*: pipes.css, themes.css). No SVG filters (Safari blurs them).
import { el, T, MID, turnArrow, drawGround } from "./pipes-draw.js";
import { SHAPES, END, KINDS } from "./pipes-train.js";

export { el, T, MID, turnArrow, drawGround };
const rad = a => a * Math.PI / 180;
const pt = (r, a) => `${(r * Math.cos(rad(a))).toFixed(2)} ${(r * Math.sin(rad(a))).toFixed(2)}`;

/** The outline of a wheel of n teeth with pitch radius 2.5 n: trapezoid teeth, rooted 3.6 inside the pitch circle and tipped 3.2
 *  outside it, so a tooth of one wheel lies in the gap of the next. */
export function outline(n) {
  const r = 2.5 * n, root = r - 3.6, tip = r + 3.2, pitch = 360 / n, w0 = pitch * 0.3, w1 = pitch * 0.15;
  let d = `M${pt(root, -w0)}`;
  for (let k = 0; k < n; k++) {
    const a = k * pitch;
    d += `L${pt(tip, a - w1)}L${pt(tip, a + w1)}L${pt(root, a + w0)}A${root} ${root} 0 0 1 ${pt(root, a + pitch - w0)}`;
  }
  return d + "Z";
}

/**
 * One wheel of n teeth at (x, y). dir: 0 clockwise, 1 counter-clockwise, null when it is not known (then it shows no arrow; the
 * board animates every `.spin` of a solved level, n teeth a turn). phase: degrees, the angle of a tooth. skin: "" brass,
 * "fixed", "barrel" (the mainspring), "steel" (the load). jam: the wheel is in a jam.
 */
export function wheel(g, { x, y, n, dir = null, phase = 0, skin = "", jam = false }) {
  const r = 2.5 * n, root = r - 3.6;
  const out = el("g", { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})`, class: `gear ${skin}${jam ? " jam" : ""}` }, g);
  const spin = el("g", { class: `spin${dir === null ? "" : dir ? " ccw" : " cw"}`, "data-n": n }, out);
  const body = el("g", { transform: `rotate(${phase.toFixed(2)})` }, spin);
  el("path", { d: outline(n), class: "g-body" }, body);
  if (skin === "barrel") {
    let d = "M0 0";
    for (let t = 0; t <= 5.2 * Math.PI; t += 0.25) d += `L${((root * 0.1 + t * 1.0) * Math.cos(t)).toFixed(2)} ${((root * 0.1 + t * 1.0) * Math.sin(t)).toFixed(2)}`;
    el("path", { d, class: "g-spring" }, body);
  } else {
    if (n >= 6) el("circle", { r: root - 4.2, class: "g-rim" }, body);
    if (n >= 6) {
      const holes = n > 8 ? 5 : 3, hr = n > 8 ? 4.4 : 2.6, at = (root - 4.2) * 0.62;
      for (let k = 0; k < holes; k++) el("circle", { cx: (at * Math.cos(rad(k * 360 / holes - 90))).toFixed(2), cy: (at * Math.sin(rad(k * 360 / holes - 90))).toFixed(2), r: hr, class: "g-hole" }, body);
    }
  }
  const hub = n > 8 ? 6 : n > 5 ? 4 : 3;
  el("circle", { r: hub, class: "g-hub" }, body);
  if (dir === null || skin === "barrel") el("circle", { r: hub * 0.42, class: "g-jewel" }, body);
  if (dir !== null && skin !== "barrel" && skin !== "steel") turnArrow(out, 0, 0, dir, n > 8 ? 10 : n > 5 ? 6.6 : 5, "g-turn on");
  return out;
}

/** One tooth passes a mesh every TOOTH_MS on every wheel, so a wheel of n teeth takes n * TOOTH_MS to turn: meshed wheels stay in step. */
export const TOOTH_MS = 800;
export const spinMs = n => n * TOOTH_MS;
/** The angle (degrees, clockwise positive) a wheel of n teeth has turned t ms after the train started; ccw: 1 counter-clockwise.
 *  All wheels count t from the same start, which is what keeps their teeth in the gaps they were drawn in. */
export const spinAngle = (n, ccw, t) => (ccw ? -1 : 1) * 360 * t / spinMs(n);

/**
 * The angle of every wheel (by node, c * 3 + i), so that where two mesh a tooth lies in a gap: from the mainspring outwards, each
 * wheel from the one it was reached by. A loop that doesn't close exactly leaves a pair a little out; it is only a picture.
 */
export function phasesOf(L, m) {
  const centre = u => { const c = Math.floor(u / 3), g = m.shapes[c].gears[u % 3]; return [(c % L.cols) * T + g.x, Math.floor(c / L.cols) * T + g.y]; };
  const phase = new Float64Array(L.size * 3).fill(NaN);
  const flood = start => {
    phase[start] = 0;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const u = q[h], [ux, uy] = centre(u), nu = m.shapes[Math.floor(u / 3)].gears[u % 3].n;
      for (const v of m.adj[u]) {
        if (!Number.isNaN(phase[v])) continue;
        const [vx, vy] = centre(v), nv = m.shapes[Math.floor(v / 3)].gears[v % 3].n, theta = Math.atan2(vy - uy, vx - ux) * 180 / Math.PI;
        const pu = 360 / nu, pv = 360 / nv, fu = ((((theta - phase[u]) / pu) % 1) + 1) % 1, fv = ((0.5 - fu) % 1 + 1) % 1;
        phase[v] = theta + 180 - pv * fv;
        q.push(v);
      }
    }
  };
  flood(L.source.c * 3);
  for (let u = 0; u < phase.length; u++) if (Number.isNaN(phase[u]) && m.shapes[Math.floor(u / 3)] && u % 3 < m.shapes[Math.floor(u / 3)].gears.length) flood(u);
  return phase;
}

/** A piece laid in a square: its wheels. opts: turns (an array by gear of 0/1, or missing), phases (degrees by gear), skin, jams
 *  (a Set of gear indices in a jam). */
export function drawPiece(g, kind, opts = {}) {
  const sh = SHAPES[kind], turns = opts.turns || [], phases = opts.phases || [];
  sh.gears.forEach((gear, i) => wheel(g, { x: gear.x, y: gear.y, n: gear.n, dir: turns[i] ?? null, phase: phases[i] ?? 0, skin: opts.skin || "", jam: !!opts.jams?.has(i) }));
}
/** The mainspring: a barrel with its coil, its teeth towards side d, turning clockwise. */
export function drawSource(g, d, opts = {}) {
  const gear = END[d].gears[0];
  wheel(g, { x: gear.x, y: gear.y, n: gear.n, dir: 0, phase: opts.phase ?? 0, skin: "barrel", jam: !!opts.jam });
  turnArrow(g, ...badgeAt(d), 0, 5, "g-turn bright");
}
/** Where a badge with a turn arrow sits in the mainspring's or the load's square: the corner its wheel leaves free. */
export const badgeAt = d => (d === 3 ? [51, 9] : d === 0 ? [9, 51] : [9, 9]);
/** The load at the end of the train: a steel wheel with a watch dial, its teeth towards side d. Returns the dial's two hands. */
export function drawLoad(g, d, opts = {}) {
  const gear = END[d].gears[0];
  wheel(g, { x: gear.x, y: gear.y, n: gear.n, dir: opts.dir ?? null, phase: opts.phase ?? 0, skin: "steel", jam: !!opts.jam });
  const dial = el("g", { transform: `translate(${gear.x.toFixed(2)} ${gear.y.toFixed(2)})`, class: "dial" }, g);
  el("circle", { r: 13.5, class: "g-dial" }, dial);
  for (let k = 0; k < 12; k++) el("path", { d: `M${pt(k % 3 ? 10.6 : 9.4, k * 30)}L${pt(12, k * 30)}`, class: "g-tick" }, dial);
  const hour = el("path", { d: "M0 1.5V-6.5", class: "g-hand hour", transform: "rotate(-60)" }, dial);
  const minute = el("path", { d: "M0 2V-9.5", class: "g-hand minute", transform: "rotate(60)" }, dial);
  el("circle", { r: 1.6, class: "g-jewel" }, dial);
  return { hour, minute };
}

const SIDE_WORD = ["north", "east", "south", "west"];
export const PIECE_NAMES = Object.fromEntries(KINDS.map(k => {
  const sh = SHAPES[k], ends = sh.sides.map(s => SIDE_WORD[s]);
  return [k, k === "g" ? "single gear, meshing on any side" : `${sh.cls === 2 ? "duo, two meshed gears" : "trio, three meshed gears"}, ${ends[0]} to ${ends[1]}`];
}));
/** A piece as a small tile, for the hand. */
export function pieceTile(kind, tag = "span") {
  const box = document.createElement(tag);
  box.className = "pi-q";
  const svg = el("svg", { viewBox: "-4 -4 68 68", "aria-hidden": "true" });
  drawPiece(svg, kind, { phases: kind === "g" ? [0] : SHAPES[kind].gears.map((_, i) => (i % 2 ? 360 / SHAPES[kind].gears[i].n / 2 : 0)) });
  box.append(svg);
  box.setAttribute("aria-label", PIECE_NAMES[kind]);
  return box;
}
export { drawGround as ground };
