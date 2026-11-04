// Shunt's board, drawn flat: a walnut frame round a baize plate of nineteen brass-edged recesses, engraved gears with real teeth
// (twelve for pitch A, eighteen for B, twenty-four for C), little steel tabs against the board's outline to shove from, the queue as a row of
// gears on a brass rail and the hold as a small brass cradle. This file is the only place the look lives: the page (shunt.js)
// keeps the game and maps touches to moves, and a three-dimensional workshop (shunt-view-3d.js) can replace this module whole.
//
// The view's interface, which a replacement keeps:
//   createView({ board, tray }) -> view     board and tray are the two <svg> elements it draws in
//   view.draw(model)                        model: { state (the one to show: a preview's after-state while previewing), base (the real
//                                           state, for the queue and the hold), preview ({ e, before, moved, at, swapFirst } or null),
//                                           fx (effect of the preview), pulse ({ e (a lever), hold (the cradle) } or null), done }
//   view.animate(model, move, done)         plays a shove ({ moved, at, e }) that has just been made, then draw()s the model and calls done
//   view.hit(clientX, clientY)              -> { kind: "entry", e, legal } | { kind: "hold" } | { kind: "plate" } | null
//   view.leverAt(e) -> [clientX, clientY]   where a lever is on the page (the tests tap it)
//   view.setMotion(on)                      gears turn (off: reduced motion, or the game paused)
//   view.dispose()                          lets go of the board and the tray (the other view takes them over)
//   view.kind = "2d"
import { CELLS, N, ENTRIES, STUD, judge, track, legal } from "./shunt-engine.js";

export const D = 50;                                            // the distance between the centres of neighbouring cells, in board units
const SQ = 0.8660254;
export const cellXY = i => [SQ * CELLS[i].q * D, (CELLS[i].r + CELLS[i].q / 2) * D];
const dirXY = d => { const x = SQ * d[0], y = d[1] + d[0] / 2, l = Math.hypot(x, y); return [x / l, y / l]; };
export const RO = 26;                                                   // a gear's outer radius
const FRAME = 150, BAIZE = 133;                                  // the walnut frame's and the baize's radius (corner to centre)
const VB = { x: -142, y: -156, w: 284, h: 312 };
const f = v => Math.round(v * 10) / 10;

// ---------- the levers: where each of the thirty is, and how big a touch it takes ----------
/** Where a touch means each point, for points standing round a board's outline: the same order round, an equal angle apart on a circle of radius R (so
 *  the zigzag's crowded pairs, half a cell apart, are not crowded when a finger chooses between them), the whole ring turned to move them least. */
export function spreadAround(pts, R) {
  const ord = pts.map((p, i) => ({ i, a: Math.atan2(p[1], p[0]) })).sort((p, q) => p.a - q.a), step = 2 * Math.PI / pts.length;
  let sx = 0, sy = 0;
  ord.forEach((o, k) => { const d = o.a - k * step; sx += Math.cos(d); sy += Math.sin(d); });
  const phi = Math.atan2(sy, sx), out = [];
  ord.forEach((o, k) => { out[o.i] = [Math.cos(phi + k * step) * R, Math.sin(phi + k * step) * R]; });
  return out;
}
/** How far (x, y) is from a tab's bar: the bar is `len` long and `thick` deep about (cx, cy), its depth along the way (ux, uy) the lever shoves. 0 on it. */
export function offTab(x, y, cx, cy, ux, uy, len, thick) {
  const dx = x - cx, dy = y - cy;
  return Math.hypot(Math.max(Math.abs(dx * ux + dy * uy) - thick / 2, 0), Math.max(Math.abs(-dx * uy + dy * ux) - len / 2, 0));
}
/** The lever a touch at (x, y) means among `levers` (their tab at (tx, ty), their touch point at (hx, hy)): one whose tab it is on or within `pad` of
 *  (the nearest tab), else the nearest touch point within `reach`. `ty`/`hy` name the second coordinate and `uy` the second direction ("y" or "z"). */
export function leverAtPoint(levers, x, y, { reach, pad, len, thick, k = "y" }) {
  let best = null, bd = pad;
  const u2 = l => l["u" + k];
  for (const l of levers) { const d = offTab(x, y, l.x, l[k], l.ux, u2(l), len, thick); if (d < bd) { bd = d; best = l; } }
  if (best) return best;
  bd = reach;
  for (const l of levers) { const d = Math.hypot(l.hx - x, l["h" + k] - y); if (d < bd) { bd = d; best = l; } }
  return best;
}
/** A lever per entry, worked out from the rules: the entry's first cell has no neighbour behind it, so the lever is a tab against that outer face of
 *  the board, a bar parallel to the face, and (ux, uy) the way the gear travels, which is the face's inward normal (no arrow is drawn). (x, y) is the
 *  tab; (hx, hy) is where a touch means it (see spreadAround), never farther than half a tab's spacing from it. */
export const LEVERS = (() => {
  const raw = ENTRIES.map((en, e) => {
    const [px, py] = cellXY(en.line[0]), [ux, uy] = dirXY(en.d), back = D * 0.58;
    return { e, ux, uy, x: px - ux * back, y: py - uy * back };
  });
  const hit = spreadAround(raw.map(l => [l.x, l.y]), D * 2.5);
  return raw.map((l, e) => ({ ...l, hx: hit[e][0], hy: hit[e][1] }));
})();
/** How far from a lever's centre a touch still means it, in board units (the nearest lever takes it): the levers are closer than this, so it is the nearest that decides. */
export const HIT = D * 0.8;
export const TAB_LEN = D * 0.42, TAB_THICK = D * 0.1;

// ---------- gears ----------
export const PITCH = [{ n: 12, depth: 0.2, fill: "--sh-a", letter: "A" }, { n: 18, depth: 0.15, fill: "--sh-b", letter: "B" }, { n: 24, depth: 0.12, fill: "--sh-c", letter: "C" }];
export const IDLER = { n: 12, depth: 0.18, fill: "--sh-i", letter: "I" };
/** The family of each gear code: plain A, B, C; the idler; the bridges (two pitches). */
export const FAMILY = [[0], [1], [2], [3], [0, 1], [0, 2], [1, 2]];
const spec = k => (k === 3 ? IDLER : PITCH[k]);
export const teethOf = c => (c === 3 ? IDLER.n : FAMILY[c].length === 1 ? PITCH[c].n : Math.round((PITCH[FAMILY[c][0]].n + PITCH[FAMILY[c][1]].n) / 2));
/** The outline of a toothed wheel: trapezoid teeth with a rounded tip and root, the first tooth centred on angle 0 (so every hex direction meets a tooth or a gap). */
function toothPath(n, ro, depth) {
  const step = 2 * Math.PI / n, root = ro * (1 - depth), prof = [[-0.5, root], [-0.3, root], [-0.19, ro * 0.985], [-0.11, ro], [0.11, ro], [0.19, ro * 0.985], [0.3, root]];
  const pts = [];
  for (let k = 0; k < n; k++) for (const [fr, r] of prof) pts.push([Math.cos((k + fr) * step) * r, Math.sin((k + fr) * step) * r]);
  return `M${pts.map(p => `${f(p[0])} ${f(p[1])}`).join("L")}Z`;
}
const sector = (r1, r2, a0, a1) => {
  const p = (r, a) => `${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`;
  return `M${p(r2, a0)}A${r2} ${r2} 0 0 1 ${p(r2, a1)}L${p(r1, a1)}A${r1} ${r1} 0 0 0 ${p(r1, a0)}Z`;
};
/** What is engraved on a gear's face: a groove at the rim, five windows (or six holes in an idler), the hub with its hole. */
function face(root, idler) {
  let s = `<circle r="${f(root * 0.9)}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".8"/><circle r="${f(root * 0.9 + 0.9)}" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width=".6"/>`;
  if (idler) for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; s += `<circle cx="${f(Math.cos(a) * root * 0.58)}" cy="${f(Math.sin(a) * root * 0.58)}" r="${f(root * 0.13)}" style="fill:var(--sh-recess)" stroke="#000" stroke-opacity=".5" stroke-width=".6"/>`; }
  else for (let k = 0; k < 5; k++) { const a0 = k * 2 * Math.PI / 5 + 0.2, a1 = a0 + 2 * Math.PI / 5 - 0.42; s += `<path d="${sector(root * 0.36, root * 0.74, a0, a1)}" style="fill:var(--sh-recess)" stroke="#000" stroke-opacity=".5" stroke-width=".6" stroke-linejoin="round"/>`; }
  s += `<circle r="${f(root * 0.3)}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".7"/><circle r="${f(root * 0.27)}" fill="url(#sh-hub)" stroke="#000" stroke-opacity=".55" stroke-width=".6"/>`;
  return s;
}
/** The definitions every drawing shares: gradients, the seven gear bodies, the jewel, the lever. Put into the page once. */
function defsMarkup() {
  let s = `<defs>
  <radialGradient id="sh-hi" cx=".32" cy=".26" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".55" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="sh-lo" cx=".7" cy=".78" r=".8"><stop offset="0" stop-color="#000" stop-opacity=".36"/><stop offset=".6" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <radialGradient id="sh-hub" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#F6E3A6"/><stop offset=".6" stop-color="#C4963A"/><stop offset="1" stop-color="#7A5A1C"/></radialGradient>
  <linearGradient id="sh-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1D88C"/><stop offset=".5" stop-color="#C4963A"/><stop offset="1" stop-color="#8A6620"/></linearGradient>
  <linearGradient id="sh-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6F9AE0"/><stop offset=".45" stop-color="#2D5AA8"/><stop offset="1" stop-color="#17306A"/></linearGradient>
  <linearGradient id="sh-steel-lit" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F4F7FF"/><stop offset=".5" stop-color="#C3D0E8"/><stop offset="1" stop-color="#8A9DC2"/></linearGradient>
  <linearGradient id="sh-rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1D88C"/><stop offset=".45" stop-color="#C4963A"/><stop offset="1" stop-color="#6E4F18"/></linearGradient>
  <radialGradient id="sh-rivet" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF3C8"/><stop offset=".5" stop-color="#C4963A"/><stop offset="1" stop-color="#5E4314"/></radialGradient>
  <radialGradient id="sh-gem" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#F0606A"/><stop offset=".45" stop-color="#B8142E"/><stop offset="1" stop-color="#58061A"/></radialGradient>
  <clipPath id="sh-frame-clip"><polygon points="${pointyHex(FRAME)}"/></clipPath>
  <clipPath id="sh-left"><rect x="-30" y="-30" width="30" height="60"/></clipPath><clipPath id="sh-right"><rect x="0" y="-30" width="30" height="60"/></clipPath>`;
  for (let c = 0; c < 7; c++) {
    if (c < 4) {
      const sp = spec(c), p = toothPath(sp.n, RO, sp.depth);
      s += `<g id="sh-g${c}"><path d="${p}" transform="translate(.9 1.3)" fill="#000" opacity=".28"/><path d="${p}" style="fill:var(--gf,var(${sp.fill}))" stroke="#2a1d08" stroke-opacity=".75" stroke-width="1" stroke-linejoin="round"/><path d="${p}" fill="url(#sh-hi)"/><path d="${p}" fill="url(#sh-lo)"/>${face(RO * (1 - sp.depth), c === 3)}</g>`;
    } else {
      const [a, b] = FAMILY[c], pa = PITCH[a], pb = PITCH[b], ta = toothPath(pa.n, RO, pa.depth), tb = toothPath(pb.n, RO, pb.depth);
      s += `<g id="sh-g${c}"><path d="${ta}" transform="translate(.9 1.3)" fill="#000" opacity=".28" clip-path="url(#sh-left)"/><path d="${tb}" transform="translate(.9 1.3)" fill="#000" opacity=".28" clip-path="url(#sh-right)"/>
        <path d="${ta}" clip-path="url(#sh-left)" style="fill:var(--gf,var(${pa.fill}))" stroke="#2a1d08" stroke-opacity=".75" stroke-width="1" stroke-linejoin="round"/><path d="${tb}" clip-path="url(#sh-right)" style="fill:var(--gf,var(${pb.fill}))" stroke="#2a1d08" stroke-opacity=".75" stroke-width="1" stroke-linejoin="round"/>
        <path d="${ta}" clip-path="url(#sh-left)" fill="url(#sh-hi)"/><path d="${tb}" clip-path="url(#sh-right)" fill="url(#sh-lo)"/>
        ${face(RO * (1 - Math.max(pa.depth, pb.depth)), false)}<path d="M0 ${-RO}V${RO}" stroke="#2a1d08" stroke-opacity=".7" stroke-width="1.2"/></g>`;
    }
  }
  return `${s}</defs>`;
}
function ensureDefs() {
  if (document.getElementById("sh-defs")) return;
  const host = document.createElement("div");
  host.innerHTML = `<svg id="sh-defs" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true" focusable="false">${defsMarkup()}</svg>`;
  document.body.append(host.firstChild);
}

// ---------- the board's drawing ----------
const hexPoly = (cx, cy, R, rot = 0) => Array.from({ length: 6 }, (_, k) => `${f(cx + R * Math.cos(rot + k * Math.PI / 3))},${f(cy + R * Math.sin(rot + k * Math.PI / 3))}`).join(" ");
const pointyHex = R => hexPoly(0, 0, R, -Math.PI / 2);
const NAMED = ["A", "B", "C", "I", "AB", "AC", "BC"];
/** One gear at (x, y): the spin group (data-spin) holds the gear, the label stays upright over its hub. o: sg, mode, ghost, scale, dim. */
function gearMarkup(x, y, c, o = {}) {
  const sgn = o.sg === -1 ? -1 : 1, step = 360 / teethOf(c), base = sgn < 0 ? step / 2 : 0;
  const fam = FAMILY[c], jam = o.mode === "jam";
  const gf = jam ? "--gf:color-mix(in srgb,var(--bad) 72%,#2a1d08)" : "";
  const spin = o.mode === "turn" ? ` data-spin="${base}|${sgn * 1.4 * 360 / teethOf(c)}"` : o.mode === "jam" ? ` data-spin="${base}|0|jam"` : "";
  let s = `<g transform="translate(${f(x)} ${f(y)})${o.scale ? ` scale(${o.scale})` : ""}" opacity="${o.ghost ? 0.7 : 1}">`;
  s += `<g${spin} transform="rotate(${base})"><use href="#sh-g${c}" style="${gf}"/></g>`;
  if (o.ghost) s += `<circle r="${RO + 2.5}" fill="none" stroke="var(--sh-glow)" stroke-width="1.8" stroke-dasharray="4 3"/>`;
  s += `<text class="sh-letter" y=".5" style="font-size:${fam.length > 1 ? 6.6 : 8.4}px">${NAMED[c]}</text>`;
  return `${s}</g>`;
}
function gemMarkup(x, y, size, lit) {
  // a synthetic ruby bearing as a watch has them (Korbi, 4 November 2026: "jewels should be jewel coloured", "like the jewels in a watch"):
  // a round domed stone with a hole for the pivot, set in a gold chaton; dull until its train turns, then it glows and glints
  const s = size;
  return `<g transform="translate(${f(x)} ${f(y)})">${lit ? `<circle r="${f(s * 1.7)}" fill="#FF7A5A" opacity=".32" data-glow="1"/>` : ""}`
    + `<circle r="${f(s * 1.02)}" fill="url(#sh-hub)" stroke="#5E4314" stroke-width=".8"/><circle r="${f(s * 0.8)}" fill="none" stroke="#5E4314" stroke-opacity=".55" stroke-width=".6"/>`
    + `<circle r="${f(s * 0.7)}" fill="url(#sh-gem)" fill-opacity="${lit ? 1 : 0.82}"/>`
    + `<circle r="${f(s * 0.2)}" fill="#1c0406" stroke="#FFD9CC" stroke-opacity="${lit ? 0.55 : 0.3}" stroke-width=".6"/>`
    + `<ellipse cx="${f(-s * 0.28)}" cy="${f(-s * 0.3)}" rx="${f(s * 0.22)}" ry="${f(s * 0.11)}" transform="rotate(-38 ${f(-s * 0.28)} ${f(-s * 0.3)})" fill="#fff" fill-opacity="${lit ? 0.8 : 0.4}"/></g>`;
}
/** A lever at its place: a slot against the board's edge and a flat steel tab in it, a bar parallel to the face it feeds, so the face says the way it
 *  shoves; the chosen one bright and a little sunk with a glint, the coach's pulsing, one whose line is full dull. */
function leverMarkup(l, mode) {
  const ang = Math.atan2(l.uy, l.ux) * 180 / Math.PI, sel = mode === "sel", off = mode === "off", pulse = mode === "pulse";
  const k = sel ? 1.12 : pulse ? 1.08 : 1, L = TAB_LEN * k, T = TAB_THICK * k, sink = sel ? 0.03 * D : 0;
  const slot = `<rect x="${f(-0.09 * D)}" y="${f(-0.25 * D)}" width="${f(0.2 * D)}" height="${f(0.5 * D)}" rx="2" fill="#000" opacity="${off ? 0.14 : 0.3}"/>`;
  let s = `<g transform="translate(${f(l.x)} ${f(l.y)}) rotate(${f(ang)})"${pulse ? ' data-pulse="1"' : ""}>${slot}`;
  if (pulse) s += `<circle r="${f(0.34 * D)}" fill="var(--sh-glow)" fill-opacity=".28" stroke="var(--sh-glow)" stroke-width="2" data-ring="1"/>`;
  const bar = `x="${f(-T / 2 + sink)}" y="${f(-L / 2)}" width="${f(T)}" height="${f(L)}" rx="1.6"`;
  s += off ? `<rect ${bar} style="fill:var(--sh-iron)" stroke="#000" stroke-opacity=".4" stroke-width=".8"/>`
    : sel ? `<rect ${bar} fill="url(#sh-steel-lit)" stroke="#16203a" stroke-width="1.2"/><path d="M${f(sink - T * 0.1)} ${f(-L * 0.36)}V${f(-L * 0.06)}" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="${f(sink)}" cy="${f(-L * 0.2)}" r="${f(0.12 * D)}" fill="var(--sh-glow)" opacity=".5"/>`
      : `<rect ${bar} fill="url(#sh-steel)" stroke="#16203a" stroke-width="1"/><path d="M${f(-T * 0.18)} ${f(-L * 0.4)}V${f(L * 0.4)}" stroke="#fff" stroke-opacity=".5" stroke-width=".8" stroke-linecap="round"/>`;
  return `${s}</g>`;
}
/** The plate: frame, baize, recesses; drawn once per size (it never changes except for its studs, which belong to the state). */
function plateMarkup(st) {
  let s = `<polygon points="${pointyHex(FRAME)}" style="fill:var(--sh-wood)" stroke="#000" stroke-opacity=".5" stroke-width="1.4" stroke-linejoin="round"/>`;
  // the walnut's grain: a few long faint curves
  s += '<g clip-path="url(#sh-frame-clip)">';
  for (let k = -5; k <= 5; k++) s += `<path d="M${k * 24 - 18} -150C${k * 24 + 14} -60 ${k * 24 - 20} 60 ${k * 24 + 12} 150" fill="none" stroke="#000" stroke-opacity="${0.05 + (k % 3 === 0 ? 0.03 : 0)}" stroke-width="${1.2 + (k & 1)}"/>`;
  s += "</g>";
  s += `<polygon points="${pointyHex(FRAME - 2.5)}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.2" stroke-linejoin="round"/>`;
  s += `<polygon points="${pointyHex(BAIZE + 4)}" style="fill:var(--sh-brass)" stroke="#000" stroke-opacity=".5" stroke-width=".8" stroke-linejoin="round"/><polygon points="${pointyHex(BAIZE)}" style="fill:var(--sh-baize)" stroke="#000" stroke-opacity=".55" stroke-width="1" stroke-linejoin="round"/>`;
  for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * Math.PI / 3, x = Math.cos(a) * (FRAME - 9), y = Math.sin(a) * (FRAME - 9); s += `<circle cx="${f(x)}" cy="${f(y)}" r="3.2" fill="url(#sh-rivet)" stroke="#000" stroke-opacity=".5" stroke-width=".6"/><path d="M${f(x - 2)} ${f(y + 0.4)}L${f(x + 2)} ${f(y - 0.4)}" stroke="#000" stroke-opacity=".5" stroke-width=".7"/>`; }
  const R = D * 0.577;
  for (let i = 0; i < N; i++) {
    const [x, y] = cellXY(i);
    if (st.cells[i] === STUD) {
      s += `<polygon points="${hexPoly(x, y, R)}" style="fill:var(--sh-iron)" stroke="#000" stroke-opacity=".6" stroke-width="1.1" stroke-linejoin="round"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(D * 0.22)}" fill="url(#sh-rivet)" stroke="#2a1d08" stroke-width="1.1"/><path d="M${f(x - 7)} ${f(y + 2)}L${f(x + 7)} ${f(y - 2)}" stroke="#000" stroke-opacity=".55" stroke-width="1.4"/>`;
      continue;
    }
    const pts = hexPoly(x, y, R);
    s += `<polygon points="${pts}" style="fill:var(--sh-recess)" stroke="var(--sh-brass)" stroke-opacity=".75" stroke-width="1.2" stroke-linejoin="round"/>`;
    // a bevel: the recess is darker along its upper edges and catches light along the lower ones
    const ring = Array.from({ length: 7 }, (_, k) => [x + R * 0.94 * Math.cos(k * Math.PI / 3), y + R * 0.94 * Math.sin(k * Math.PI / 3)]).map(p => `${f(p[0])},${f(p[1])}`);
    s += `<polyline points="${ring.slice(3, 6).concat(ring[0]).join(" ")}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${ring.slice(0, 4).join(" ")}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return s;
}

const NS = "http://www.w3.org/2000/svg";
const ease = k => 1 - Math.pow(1 - k, 3);
const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

export function createView({ board, tray }) {
  ensureDefs();
  board.setAttribute("viewBox", `${VB.x} ${VB.y} ${VB.w} ${VB.h}`);
  board.setAttribute("preserveAspectRatio", "xMidYMid meet");
  tray.setAttribute("viewBox", "0 0 340 82");
  tray.setAttribute("preserveAspectRatio", "xMidYMid meet");
  let model = null, motion = !reduced(), raf = 0, spinners = [], pulses = [], glows = [];
  const t0 = performance.now();
  let legalNow = new Set();

  function collect() {
    spinners = [...board.querySelectorAll("[data-spin]")].map(el => { const [b, r, j] = el.dataset.spin.split("|"); return { el, base: +b, rate: +r, jam: j === "jam" }; });
    pulses = [...board.querySelectorAll("[data-pulse] [data-ring], [data-flash]")];
    glows = [...board.querySelectorAll("[data-glow]")];
    wake();
  }
  function wake() {
    if (raf || !motion || document.hidden) return;
    if (!spinners.length && !pulses.length && !glows.length) return;
    raf = requestAnimationFrame(tick);
  }
  let last = 0;
  function tick(ts) {
    raf = 0;
    if (!motion || document.hidden) return;
    if (ts - last >= 30) {                              // thirty frames a second is plenty for a turning gear
      last = ts;
      const t = (ts - t0) / 1000;
      for (const sp of spinners) sp.el.setAttribute("transform", `rotate(${f(sp.jam ? sp.base + Math.sin(t * 52) * 2.4 : sp.base + sp.rate * t)})`);
      const wave = 0.5 + 0.5 * Math.sin(t * 6);
      for (const p of pulses) p.setAttribute("opacity", f(0.25 + 0.75 * wave));
      for (const g of glows) g.setAttribute("opacity", f(0.25 + 0.25 * wave));
    }
    wake();
  }

  /** The board's markup for a state. `off`: { cell: [dx, dy] } offsets for a shove under way; `m`: the model (preview, pulse, fx). */
  function boardMarkup(m, off) {
    const st = m.state, J = judge(st), pv = m.preview, base = pv ? pv.before : st;
    const movedTo = pv ? new Map(pv.moved.map(x => [x[1], x[0]])) : new Map();
    let s = plateMarkup(st);
    if (pv) track(base, pv.e).forEach(c => { const [x, y] = cellXY(c); s += `<polygon points="${hexPoly(x, y, D * 0.577)}" fill="var(--sh-glow)" fill-opacity=".16" stroke="none"/>`; });
    st.jewels.forEach(j => { if (st.cells[j] < 0) { const [x, y] = cellXY(j); s += gemMarkup(x, y, D * 0.19, false); } });
    for (let i = 0; i < N; i++) {
      const c = st.cells[i];
      if (c < 0) continue;
      let [x, y] = cellXY(i);
      if (off && off[i]) { x += off[i][0]; y += off[i][1]; }
      const t = J.comps[J.comp[i]], ghost = pv && (i === pv.at || movedTo.has(i));
      s += gearMarkup(x, y, c, { sg: J.sg[i], mode: ghost ? "still" : t.n > 1 ? (t.jam ? "jam" : "turn") : "still", ghost });
    }
    st.jewels.forEach(j => {
      if (st.cells[j] < 0) return;
      const [x, y] = cellXY(j), t = J.comps[J.comp[j]], lit = t && !t.jam && t.n >= 3;
      s += gemMarkup(x, y - D * 0.31, D * 0.15, lit);
    });
    if (pv) {
      for (const [from, to] of pv.moved) {
        const [fx, fy] = cellXY(from), [tx, ty] = cellXY(to), dx = tx - fx, dy = ty - fy, l = Math.hypot(dx, dy) || 1;
        s += `<g transform="translate(${f(tx - dx / l * D * 0.5)} ${f(ty - dy / l * D * 0.5)}) rotate(${f(Math.atan2(dy, dx) * 180 / Math.PI)})"><path d="M${-D * 0.1} ${-D * 0.1}L${D * 0.04} 0L${-D * 0.1} ${D * 0.1}" fill="none" stroke="var(--sh-glow)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
      }
      // a train the shove would break flashes red, where its gears will stand
      const where = new Map(pv.moved.map(x => [x[0], x[1]]));
      for (const t of m.fx?.broken || []) for (const cell of t.cells) { const [x, y] = cellXY(where.has(cell) ? where.get(cell) : cell); s += `<circle data-flash="1" cx="${f(x)}" cy="${f(y)}" r="${RO + 3}" fill="none" stroke="var(--bad)" stroke-width="3"/>`; }
    }
    // tags: a train's worth on its most central gear, JAM on a jammed one
    for (const t of J.comps) {
      if (t.n < 3) continue;
      let mx = 0, my = 0;
      t.cells.forEach(c => { const [x, y] = cellXY(c); mx += x; my += y; });
      mx /= t.n; my /= t.n;
      let bi = t.cells[0], bd = 1e9;
      t.cells.forEach(c => { const [x, y] = cellXY(c), d = Math.hypot(x - mx, y - my); if (d < bd) { bd = d; bi = c; } });
      const [x, y] = cellXY(bi), word = t.jam ? "JAM" : `+${Math.round(t.value * 10) / 10}`, w = word.length * 5.4 + 7;
      s += `<g transform="translate(${f(x)} ${f(y + D * 0.34)})"><rect x="${f(-w / 2)}" y="-7" width="${f(w)}" height="14" rx="3" style="fill:var(--sheet)" stroke="${t.jam ? "var(--bad)" : "var(--sh-brass)"}" stroke-width="1.2"/><text class="sh-tag" y=".5" style="fill:${t.jam ? "var(--bad)" : "var(--ink)"}">${word}</text></g>`;
    }
    // levers, over the frame: the chosen one big, the coach's pulsing, a full line dimmed
    legalNow = new Set();
    for (const l of LEVERS) {
      const ok = legal(m.base, l.e);
      if (ok) legalNow.add(l.e);
      s += leverMarkup(l, pv && pv.e === l.e ? "sel" : !ok ? "off" : m.pulse?.e === l.e && !pv ? "pulse" : "ok");
    }
    return s;
  }
  function drawBoard(m, off) {
    board.innerHTML = boardMarkup(m, off);
    collect();
  }

  // ---------- the queue and the hold ----------
  function drawTray(m) {
    const st = m.base;
    let s = "";
    // the hold: a brass cradle
    const hc = [40, 40];
    s += `<g transform="translate(0 6)"><g data-hold="1"><path d="M15 31V52Q15 63 26 63H54Q65 63 65 52V31" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="7" stroke-linecap="round" transform="translate(.8 1.4)"/><path d="M15 31V52Q15 63 26 63H54Q65 63 65 52V31" fill="none" stroke="url(#sh-rail)" stroke-width="5.5" stroke-linecap="round"/>`;
    if (st.hold >= 0) s += gearMarkup(hc[0], hc[1] + 2, st.hold, { scale: 0.72, mode: "still" });
    else s += `<circle cx="${hc[0]}" cy="${hc[1] + 2}" r="17" fill="none" stroke="var(--sh-brass)" stroke-width="1.4" stroke-dasharray="4 3" opacity=".8"/>`;
    if (m.pulse?.hold) s += `<rect x="9" y="6" width="62" height="64" rx="8" fill="none" stroke="var(--plate)" stroke-width="2.4" data-flash="1"/>`;
    s += `<rect x="6" y="4" width="68" height="70" fill="transparent"/></g>`;
    s += `<text class="sh-cap" x="${hc[0]}" y="3">${m.preview?.swapFirst ? "SWAP FIRST" : "HOLD"}</text>`;
    // the rail and the five coming
    s += `<rect x="86" y="58.5" width="248" height="8" rx="3" fill="#000" opacity=".3" transform="translate(.6 1.6)"/><rect x="86" y="58.5" width="248" height="8" rx="3" fill="url(#sh-rail)" stroke="#3d2b0c" stroke-width=".9"/>`;
    for (const x of [92, 328]) s += `<circle cx="${x}" cy="62.5" r="2.2" fill="url(#sh-rivet)"/>`;
    const q = st.q.slice(0, 5), now = q.length ? q[0] : -1;
    s += `<text class="sh-cap" x="112" y="3">${q.length ? "NEXT" : st.hold >= 0 ? "LAST: THE HELD GEAR" : ""}</text>`;
    q.forEach((c, i) => {
      const sc = i === 0 ? 0.86 : 0.64, r = RO * sc;
      s += gearMarkup([112, 160, 204, 248, 292][i], 58.5 - r, c, { scale: sc, mode: "still" });
    });
    if (now >= 0) s += `<circle cx="112" cy="${f(58.5 - RO * 0.86)}" r="${f(RO * 0.86 + 4)}" fill="none" stroke="var(--plate)" stroke-width="1.6" stroke-dasharray="3 3" opacity=".9"/>`;
    if (!q.length && st.hold >= 0) s += `<rect x="9" y="6" width="62" height="64" rx="8" fill="none" stroke="var(--plate)" stroke-width="2" data-flash="1"/>`;
    tray.innerHTML = s + "</g>";
  }

  const view = {
    kind: "2d",
    draw(m) { model = m; drawBoard(m, null); drawTray(m); collect(); },
    animate(m, move, done) {
      model = m;
      const ent = ENTRIES[move.e], [ux, uy] = dirXY(ent.d), off = {};
      for (const [a, b] of move.moved) { const [fx, fy] = cellXY(a), [tx, ty] = cellXY(b); off[b] = [fx - tx, fy - ty]; }
      off[move.at] = [-ux * D * 1.25, -uy * D * 1.25];
      if (!motion || reduced()) { view.draw(m); done(); return; }
      const start = performance.now(), dur = 230;
      drawTray(m);
      const step = ts => {
        const k = Math.min(1, ((ts ?? performance.now()) - start) / dur), e = ease(k), cur = {};
        for (const c in off) cur[c] = [off[c][0] * (1 - e), off[c][1] * (1 - e)];
        drawBoard(m, k < 1 ? cur : null);
        if (k < 1) requestAnimationFrame(step); else { view.draw(m); done(); }
      };
      requestAnimationFrame(step);
    },
    hit(cx, cy) {
      const hr = tray.getBoundingClientRect();
      if (cx >= hr.left && cx <= hr.right && cy >= hr.top && cy <= hr.bottom) {
        const m = tray.getScreenCTM();
        if (m) { const p = new DOMPoint(cx, cy).matrixTransform(m.inverse()); if (p.x < 78) return { kind: "hold" }; }
        return null;
      }
      const m = board.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
      const best = leverAtPoint(LEVERS, p.x, p.y, { reach: HIT, pad: D * 0.08, len: TAB_LEN, thick: TAB_THICK });
      if (best) return { kind: "entry", e: best.e, legal: legalNow.has(best.e) };
      return Math.hypot(p.x, p.y) < FRAME ? { kind: "plate" } : null;
    },
    leverAt(e) {
      const l = LEVERS[e], m = board.getScreenCTM(), p = new DOMPoint(l.x, l.y).matrixTransform(m);
      return [p.x, p.y];
    },
    setMotion(on) { motion = !!on && !reduced(); if (motion) wake(); else { if (raf) cancelAnimationFrame(raf); raf = 0; if (model) view.draw(model); } },
  };
  const onVis = () => wake();
  document.addEventListener("visibilitychange", onVis);
  view.dispose = () => { motion = false; if (raf) cancelAnimationFrame(raf); raf = 0; document.removeEventListener("visibilitychange", onVis); board.replaceChildren(); tray.replaceChildren(); };
  return view;
}
