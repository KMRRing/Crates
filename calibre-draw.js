// Calibre's drawing: every part as itself on the calibre plan, in the plan's millimetres, so the plan, the 3D view, the
// course's thumbnails and the lessons' pictures draw the same wheel the same way. Drawing knows nothing of the game:
// it is handed the arbors to draw and a context, and a moving part leaves an update (element, update(state)) in the
// context's dyn list, which the caller runs every frame with the movement's state: { angles (turns, by arbor), wound
// (the mainspring, 0 to 1), windAngle (the barrel arbor while winding), balance and fork (degrees) }.
import { radius, MODULE, DIAL_LAYERS, ESCAPE_R, FORK_LENGTH, BALANCE_R } from "./calibre-engine.js";

export const NS = "http://www.w3.org/2000/svg";
export const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.append(e); return e; };
/** The layers by name: 1 to 5 the train's, D the dial side's, A the automatic module's; 9 and 10 (the escapement's and
 *  the balance's) are no layer you choose, as their parts sit only there. */
export const LAYER_NAMES = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "D1", 7: "D2", 8: "D3", 9: "Escapement", 10: "Balance", 11: "A1", 12: "A2" };
/** The hand each arbor carries, by the arbor's id. */
export const HANDS = { centre: "minute", hours: "hour", seconds: "seconds", h24: "gmt", chrono: "chrono", counter: "counter", local: "hour" };

const toothCache = new Map();
const pathOf = pts => `M${pts.map(q => q.map(v => v.toFixed(3)).join(" ")).join("L")}Z`;
/** A gear's outline: teeth round the pitch circle, as a cutter leaves them; pinions have fewer, deeper, rounder leaves. */
export function toothPath(teeth, pinion, m = MODULE) {
  const key = `${teeth}${pinion ? "p" : ""}${m}`;
  if (toothCache.has(key)) return toothCache.get(key);
  const r = radius(teeth, m), out = r + m * (pinion ? 0.9 : 1), inn = r - m * (pinion ? 1.6 : 1.25), step = (2 * Math.PI) / teeth;
  const shape = pinion ? [[-0.3, inn], [-0.18, out], [0.18, out], [0.3, inn]] : [[-0.25, inn], [-0.12, out], [0.12, out], [0.25, inn]];
  const pts = [];
  for (let i = 0; i < teeth; i++) for (const [da, rr] of shape) pts.push([Math.cos((i + da) * step) * rr, Math.sin((i + da) * step) * rr]);
  const d = pathOf(pts);
  toothCache.set(key, d);
  return d;
}
/** A Swiss lever escape wheel: club teeth leaning the way it turns, cut to its own larger module. */
export function escapePath(teeth) {
  const key = `e${teeth}`;
  if (toothCache.has(key)) return toothCache.get(key);
  const R = ESCAPE_R, step = (2 * Math.PI) / teeth, pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [da, rr] of [[0, R * 0.72], [0.18, R * 0.78], [0.62, R], [0.72, R * 0.97], [0.5, R * 0.8], [0.75, R * 0.72]]) pts.push([Math.cos(a + da * step) * rr, Math.sin(a + da * step) * rr]);
  }
  const d = pathOf(pts);
  toothCache.set(key, d);
  return d;
}
/** A flat spiral from radius r0 to r1 over the given turns, its radius running by the shape function f(s) on 0..1. */
export function spiralPath(r0, r1, turns, f = s => s, twist = 0) {
  const n = Math.max(60, Math.round(turns * 48)), pts = [];
  for (let i = 0; i <= n; i++) { const s = i / n, a = s * turns * 2 * Math.PI + twist * (1 - s), r = r0 + (r1 - r0) * f(s); pts.push(`${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`); }
  return `M${pts.join("L")}`;
}
/** The mainspring in its barrel: wound, its coils wrap tight round the arbor; let down, they lie against the drum wall. */
export const springShape = wound => s => wound * Math.pow(s, 3) + (1 - wound) * (1 - Math.pow(1 - s, 3));
export function starPath(teeth, r) {
  const step = (2 * Math.PI) / teeth, pts = [];
  for (let i = 0; i < teeth; i++) { pts.push([Math.cos(i * step) * r, Math.sin(i * step) * r]); pts.push([Math.cos((i + 0.5) * step) * (r - 0.35), Math.sin((i + 0.5) * step) * (r - 0.35)]); }
  return pathOf(pts);
}

/**
 * Draws part p of arbor a into parent. ctx: { arbors (those on show: the fork and the balance face their neighbours),
 * layer (the layer in hand: its parts drawn full, the others faint), reach (the plate's reach, for the rotor), clash (the
 * arbor clashes: drawn red), ghost (drawn faint: not the part in focus), dyn }.
 */
export function drawPart(parent, a, p, ctx) {
  const { dyn } = ctx;
  const g = el("g", { class: `cb-part cb-${p.kind}${p.layer === ctx.layer ? " on" : ""}${DIAL_LAYERS.includes(p.layer) ? " dial" : ""}${ctx.clash ? " clash" : ""}${ctx.ghost ? " ghost" : ""}`, "data-arbor": a.id, "data-layer": p.layer }, parent);
  const spin = el("g", {}, g);
  dyn.push([spin, st => spin.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${(st.angles[a.id] || 0) * 360})`)]);
  if (p.kind === "barrel") {
    const r = radius(p.teeth);
    el("path", { d: toothPath(p.teeth), class: "cb-drum" }, spin);
    el("circle", { r: r - MODULE * 2.4, class: "cb-cavity" }, spin);
    const spring = el("path", { class: "cb-mainspring" }, g), ra = 0.62, rw = r - MODULE * 2.6;
    dyn.push([spring, st => { spring.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${(st.angles[a.id] || 0) * 360})`); spring.setAttribute("d", spiralPath(ra, rw, 6 + 6 * st.wound, springShape(st.wound), -st.wound * 9)); }]);
    const arbor = el("g", {}, g);
    el("circle", { r: ra, class: "cb-barrel-arbor" }, arbor); el("rect", { x: -0.24, y: -0.24, width: 0.48, height: 0.48, class: "cb-square" }, arbor);
    dyn.push([arbor, st => arbor.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${st.windAngle * 360})`)]);
  } else if (p.kind === "escape") {
    el("path", { d: escapePath(p.teeth) }, spin);
    for (let k = 0; k < 4; k++) el("line", { x1: 0, y1: 0, x2: Math.cos(k * Math.PI / 2) * ESCAPE_R * 0.7, y2: Math.sin(k * Math.PI / 2) * ESCAPE_R * 0.7, class: "cb-spoke" }, spin);
  } else if (p.kind === "fork") {
    const e = ctx.arbors.find(x => (x.parts || []).some(q => q.kind === "escape"));
    const base = e ? Math.atan2(a.y - e.y, a.x - e.x) * 180 / Math.PI : 0;  // the lever points away from the escape wheel
    const lever = el("g", {}, g);
    // the anchor: two arms reaching back to the escape wheel with their pallet stones, the lever out to the fork's horns
    el("path", { d: `M0 -0.18L${FORK_LENGTH - 0.45} -0.12L${FORK_LENGTH - 0.45} -0.32L${FORK_LENGTH} -0.32L${FORK_LENGTH} -0.1L${FORK_LENGTH - 0.25} -0.1L${FORK_LENGTH - 0.25} 0.1L${FORK_LENGTH} 0.1L${FORK_LENGTH} 0.32L${FORK_LENGTH - 0.45} 0.32L${FORK_LENGTH - 0.45} 0.12L0 0.18Z`, class: "cb-fork" }, lever);
    el("path", { d: "M0 -0.2L-0.9 -1.15L-1.2 -0.95L-0.35 0L-1.2 0.95L-0.9 1.15L0 0.2Z", class: "cb-fork" }, lever);
    el("rect", { x: -1.32, y: -1.2, width: 0.32, height: 0.22, class: "cb-stone", transform: "rotate(-35 -1.16 -1.09)" }, lever);
    el("rect", { x: -1.32, y: 0.98, width: 0.32, height: 0.22, class: "cb-stone", transform: "rotate(35 -1.16 1.09)" }, lever);
    dyn.push([lever, st => lever.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${base + (st.fork || 0)})`)]);
  } else if (p.kind === "balance") {
    const R = BALANCE_R, bal = el("g", {}, g), hair = el("path", { class: "cb-hairspring" }, g);
    el("circle", { r: R - 0.14, class: "cb-rim" }, bal);
    for (let k = 0; k < 3; k++) el("line", { x1: 0, y1: 0, x2: Math.cos(k * 2 * Math.PI / 3) * (R - 0.2), y2: Math.sin(k * 2 * Math.PI / 3) * (R - 0.2), class: "cb-arm" }, bal);
    for (let k = 0; k < 8; k++) el("circle", { cx: Math.cos(k * Math.PI / 4 + 0.39) * (R - 0.14), cy: Math.sin(k * Math.PI / 4 + 0.39) * (R - 0.14), r: 0.13, class: "cb-screw" }, bal);
    el("circle", { r: 0.42, class: "cb-roller" }, bal);
    const f = ctx.arbors.find(x => (x.parts || []).some(q => q.kind === "fork"));
    const toward = f ? Math.atan2(f.y - a.y, f.x - a.x) : 0;    // at rest the impulse pin sits in the fork's horns
    el("circle", { cx: Math.cos(toward) * 0.42, cy: Math.sin(toward) * 0.42, r: 0.11, class: "cb-stone" }, bal);
    dyn.push([bal, st => bal.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${st.balance || 0})`)]);
    dyn.push([hair, st => { hair.setAttribute("transform", `translate(${a.x} ${a.y})`); hair.setAttribute("d", spiralPath(0.3, R * 0.68, 9, s => s, ((st.balance || 0) * Math.PI) / 180)); }]);
  } else if (p.kind === "ratchet") {
    const r = radius(p.teeth), step = (2 * Math.PI) / p.teeth, pts = [];
    for (let i = 0; i < p.teeth; i++) { pts.push([Math.cos(i * step) * (r - 0.18), Math.sin(i * step) * (r - 0.18)]); pts.push([Math.cos((i + 0.85) * step) * (r + 0.1), Math.sin((i + 0.85) * step) * (r + 0.1)]); }
    el("path", { d: pathOf(pts), class: "cb-ratchet" }, spin);
    el("circle", { r: 0.5, class: "cb-hub" }, spin);
    // the click rides on the teeth from outside, on its own little spring
    el("path", { d: `M${(a.x + r + 0.9).toFixed(2)} ${(a.y - 0.6).toFixed(2)}L${(a.x + r - 0.05).toFixed(2)} ${(a.y + 0.05).toFixed(2)}L${(a.x + r + 0.6).toFixed(2)} ${(a.y + 0.2).toFixed(2)}Z`, class: "cb-click" }, g);
  } else if (p.kind === "star" && p.internal) {
    // the date ring: teeth on its inside, the dates printed round it
    const step = (2 * Math.PI) / p.teeth, pts = [];
    for (let i = 0; i < p.teeth; i++) { pts.push([Math.cos(i * step) * (p.r + 0.3), Math.sin(i * step) * (p.r + 0.3)]); pts.push([Math.cos((i + 0.5) * step) * (p.r - 0.15), Math.sin((i + 0.5) * step) * (p.r - 0.15)]); }
    el("path", { d: `${pathOf(pts)}M${p.r + 1.3} 0A${p.r + 1.3} ${p.r + 1.3} 0 1 0 ${-(p.r + 1.3)} 0A${p.r + 1.3} ${p.r + 1.3} 0 1 0 ${p.r + 1.3} 0Z`, class: "cb-ring", "fill-rule": "evenodd" }, spin);
    for (let i = 0; i < p.teeth; i++) { const t = el("text", { x: Math.cos((i + 0.5) * step) * (p.r + 0.85), y: Math.sin((i + 0.5) * step) * (p.r + 0.85), class: "cb-date", transform: `rotate(${(((i + 0.5) * step) * 180) / Math.PI + 90} ${Math.cos((i + 0.5) * step) * (p.r + 0.85)} ${Math.sin((i + 0.5) * step) * (p.r + 0.85)})` }, spin); t.textContent = i + 1; }
  } else if (p.kind === "star" || (p.m && p.teeth >= 100)) {
    // a moon disc (two moons on a night sky), or a star wheel pushed a tooth at a time
    const r = p.kind === "star" ? p.r : radius(p.teeth, p.m), moon = p.teeth === 59 || p.teeth >= 100;
    el("path", { d: p.kind === "star" ? starPath(p.teeth, r) : toothPath(p.teeth, false, p.m), class: moon ? "cb-moondisc" : "cb-star" }, spin);
    if (moon) for (const k of [0, 1]) el("circle", { cx: Math.cos(k * Math.PI) * r * 0.55, cy: Math.sin(k * Math.PI) * r * 0.55, r: r * 0.28, class: "cb-moon" }, spin);
  } else if (p.kind === "rotor") {
    // the rotor: a half-moon weight over the whole movement, seen through
    const rr = ctx.reach * 0.92;
    el("path", { d: `M${-rr} 0A${rr} ${rr} 0 0 1 ${rr} 0L${rr * 0.72} 0A${rr * 0.72} ${rr * 0.72} 0 0 0 ${-rr * 0.72} 0Z`, class: "cb-rotor" }, spin);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -rr * 0.72, class: "cb-rotor-arm" }, spin);
  } else if (p.kind === "reverser") {
    // a reverser: its wheel, and on the same arbor its pinion, joined by a one-way clutch (the small pawls between)
    el("path", { d: toothPath(p.teeth), class: "cb-rev-wheel" }, spin);
    for (let k = 0; k < 3; k++) el("path", { d: `M${(Math.cos(k * 2.094) * 0.55).toFixed(2)} ${(Math.sin(k * 2.094) * 0.55).toFixed(2)}l${(Math.cos(k * 2.094 + 1.2) * 0.4).toFixed(2)} ${(Math.sin(k * 2.094 + 1.2) * 0.4).toFixed(2)}`, class: "cb-pawl" }, spin);
    const pin = el("g", {}, g);
    el("path", { d: toothPath(p.out, true), class: "cb-rev-pinion" }, pin);
    dyn.push([pin, st => pin.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${(st.angles[`${a.id}~`] || 0) * 360})`)]);
  } else if (p.kind === "cam") {
    // the calendar cam: a notch for every short month, deeper the shorter
    const R2 = 2.6, n = p.notches.length, pts = [];
    for (let i = 0; i < n; i++) for (const f of [0.15, 0.5, 0.85]) { const ang = ((i + f) / n) * 2 * Math.PI - Math.PI / 2, dep = f === 0.5 ? (31 - p.notches[i]) * 0.28 : 0; pts.push([Math.cos(ang) * (R2 - dep), Math.sin(ang) * (R2 - dep)]); }
    el("path", { d: pathOf(pts), class: "cb-cam" }, spin);
  } else if (p.kind === "snail") {
    // a snail: a step for each hour (1 to 12) or quarter (0 to 3), the deeper the step the more blows
    const pts = [], n = p.steps.length, lo = n === 12 ? 1 : 0, hi = n === 12 ? 12 : n - 1;
    for (let i = 0; i < n; i++) { const r2 = 0.85 + ((hi - p.steps[i]) / (hi - lo)) * 1.9; for (const f of [0.02, 0.98]) { const ang = ((i + f) / n) * 2 * Math.PI - Math.PI / 2 - Math.PI / n; pts.push([Math.cos(ang) * r2, Math.sin(ang) * r2]); } }
    el("path", { d: pathOf(pts), class: "cb-snail" }, spin);
  } else if (p.kind === "column") {
    // the column wheel: castellations standing round a disc
    el("circle", { r: 1.25, class: "cb-colbase" }, spin);
    for (let i = 0; i < p.columns; i++) { const ang = (i / p.columns) * 2 * Math.PI; el("rect", { x: -0.22, y: -1.25, width: 0.44, height: 0.5, transform: `rotate(${(ang * 180) / Math.PI})`, class: "cb-column" }, spin); }
  } else if (p.kind === "cage") {
    // the tourbillon: the fixed wheel stands still; the cage turns, carrying the escape wheel round it and the balance at its heart
    const rs = radius(p.sun), rp = radius(p.pinion);
    el("path", { d: toothPath(p.sun), class: "cb-sun", transform: `translate(${a.x} ${a.y})` }, g);
    for (let k = 0; k < 3; k++) el("line", { x1: 0, y1: 0, x2: Math.cos(k * 2.094) * (rs + rp + 0.8), y2: Math.sin(k * 2.094) * (rs + rp + 0.8), class: "cb-cagearm" }, spin);
    el("circle", { r: rs + rp + 0.8, class: "cb-cagering" }, spin);
    const ew = el("g", { transform: `translate(${rs + rp} 0)` }, spin);
    el("path", { d: toothPath(p.pinion, true) }, ew); el("path", { d: escapePath(p.escape), class: "cb-escape-in-cage", transform: "scale(0.7)" }, ew);
    const bal = el("g", {}, g);
    el("circle", { r: 1.4, class: "cb-rim" }, bal); el("line", { x1: -1.4, y1: 0, x2: 1.4, y2: 0, class: "cb-arm" }, bal);
    dyn.push([bal, st => bal.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${((st.angles[a.id] || 0) * 360) + (st.balance || 0)})`)]);
  } else if (p.kind === "fusee") {
    // the fusée: a cone seen from above, its chain's groove spiralling in, beside the barrel
    const fx = radius(80) + 1.6, fusee = el("g", { transform: `translate(${a.x + fx} ${a.y})` }, g);
    for (let r2 = 1.5; r2 > 0.3; r2 -= 0.25) el("circle", { r: r2, class: "cb-fusee" }, fusee);
    el("path", { d: spiralPath(0.35, 1.5, 4), class: "cb-chain" }, fusee);
    el("line", { x1: a.x, y1: a.y - radius(80) + 0.3, x2: a.x + fx, y2: a.y - 1.5, class: "cb-chain" }, g);
  } else if (p.kind === "remontoire") {
    el("path", { d: spiralPath(0.2, 1.1, 5), class: "cb-remontoire", transform: `translate(${a.x} ${a.y})` }, g);
  } else if (p.kind === "mainspring") {
    el("circle", { r: radius(80) - 0.5, class: "cb-strongspring", transform: `translate(${a.x} ${a.y})` }, g);
  } else if (p.kind === "lever") {
    el("circle", { r: 0.45, class: p.flyback ? "cb-flyback" : "cb-plainlever", transform: `translate(${a.x} ${a.y})` }, g);
  } else if (p.kind === "kidney") {
    // the kidney cam: its radius each month the equation of time, as you've set it
    const pts = [];
    for (let i = 0; i <= 96; i++) { const t = (i / 96) * 12, m0 = Math.floor(t) % 12, m1 = (m0 + 1) % 12, f = t - Math.floor(t), v = p.values[m0] * (1 - f) + p.values[m1] * f, ang = (t / 12) * 2 * Math.PI - Math.PI / 2, r2 = 2.4 + v * 0.07; pts.push([Math.cos(ang) * r2, Math.sin(ang) * r2]); }
    el("path", { d: pathOf(pts), class: "cb-kidney" }, spin);
  } else if (p.kind === "century") {
    el("circle", { r: 2, class: "cb-cam" }, spin);
    p.leaps.forEach((leap, i) => { if (!leap) el("rect", { x: -0.3, y: -2.05, width: 0.6, height: 0.6, transform: `rotate(${i * 90})`, class: "cb-notch" }, spin); });
  } else if (p.kind === "trip") {
    const r2 = p.on === "hour" ? 1.9 : 1.1;
    el("line", { x1: 0, y1: 0, x2: 0, y2: -r2, class: "cb-trip" }, spin);
    el("circle", { cx: 0, cy: -r2, r: 0.2, class: "cb-trippin" }, spin);
  } else if (p.kind === "heart") {
    el("path", { d: "M0 0.9C-0.9 0.3 -1.15 -0.35 -0.75 -0.75C-0.4 -1.1 0 -0.85 0 -0.55C0 -0.85 0.4 -1.1 0.75 -0.75C1.15 -0.35 0.9 0.3 0 0.9Z", class: "cb-heart" }, spin);
  } else if (p.kind === "finger") {
    el("path", { d: `M0 -0.12L${p.len - 0.2} -0.08L${p.len} 0L${p.len - 0.2} 0.08L0 0.12Z`, class: "cb-finger" }, spin);
  } else {
    el("path", { d: toothPath(p.teeth, p.kind === "pinion", p.m) }, spin);
    const r = radius(p.teeth, p.m);
    if (p.kind === "wheel" && r > 1.2) {                       // a wheel's rim and its five crossings
      el("circle", { r: r - MODULE * 2.2, class: "cb-rimline" }, spin);
      for (let k = 0; k < 5; k++) { const ang = (k * 2 * Math.PI) / 5; el("line", { x1: Math.cos(ang) * 0.4, y1: Math.sin(ang) * 0.4, x2: Math.cos(ang) * (r - MODULE * 2.2), y2: Math.sin(ang) * (r - MODULE * 2.2), class: "cb-crossing" }, spin); }
      el("circle", { r: 0.45, class: "cb-hub" }, spin);
    }
  }
  el("title", {}, g).textContent = partName(p);
  return g;
}

/** How far a part reaches from its arbor as drawn (a lesson's picture is framed on it): reach is the plate's, for the rotor. */
export const extentOf = (p, reach = 13) => ({ fork: FORK_LENGTH + 0.3, finger: p.len, cam: 2.7, snail: 2.8, kidney: 3, century: 2.1, column: 1.3, heart: 1, trip: 2.1, rotor: reach * 0.92,
  cage: p.sun ? radius(p.sun) + radius(p.pinion) + 0.9 : 0, ratchet: p.teeth ? radius(p.teeth) + 1 : 0, star: p.internal ? p.r + 1.3 : p.r, escape: ESCAPE_R, balance: BALANCE_R,
  fusee: radius(80) + 3.2, mainspring: radius(80), remontoire: 1.2, lever: 0.5 }[p.kind] ?? (p.teeth ? radius(p.teeth, p.m) + 0.15 : 0.6));

/** A part in words, as the inspector and the 3D view's labels name it. */
export const partName = p => p.kind === "balance" ? (p.inertia != null ? `Balance, inertia ${p.inertia}${p.adjustable ? ", with an index" : ""}` : `Balance, ${p.vph.toLocaleString("en-GB")} vph`)
  : p.kind === "lever" ? (p.flyback ? "Flyback lever: keeps the coupling in at reset" : "Coupling lever: lifts the coupling at reset") : p.kind === "fusee" ? "Fusée and chain"
  : p.kind === "remontoire" ? "Remontoire" : p.kind === "mainspring" ? `Stronger mainspring ×${p.strength}` : p.kind === "kidney" ? "Equation-of-time kidney cam" : p.kind === "century" ? "Century wheel"
  : p.kind === "trip" ? (p.on === "hour" ? "Alarm trip on the hour wheel" : "Alarm trip on the cannon pinion") : p.kind === "cam" ? `Calendar cam, ${p.notches.length} months` : p.kind === "snail" ? "Hour snail" : p.kind === "column" ? `Column wheel, ${p.columns} columns` : p.kind === "cage" ? `Tourbillon cage: ${p.sun}-tooth fixed wheel, ${p.pinion}-leaf escape pinion` : p.kind === "rotor" ? "Rotor" : p.kind === "reverser" ? `Reverser: ${p.teeth}-tooth wheel, ${p.out}-leaf pinion, one-way` : p.kind === "heart" ? "Heart cam" : p.kind === "fork" ? "Pallet fork" : p.kind === "escape" ? `${p.teeth}-tooth escape wheel`
  : p.kind === "barrel" ? `Barrel with its mainspring, ${p.teeth} teeth` : p.kind === "ratchet" ? `Ratchet wheel, ${p.teeth} teeth, with its click` : p.kind === "finger" ? "Driving finger"
  : p.kind === "star" ? (p.internal ? `Date ring, ${p.teeth} inner teeth` : p.teeth === 59 ? "Moon disc, 59 teeth" : `${p.teeth}-tooth star wheel`)
  : `${p.teeth}-${p.kind === "pinion" ? "leaf pinion" : "tooth wheel"}${p.m ? " (fine)" : ""}, layer ${LAYER_NAMES[p.layer] || p.layer}`;
/** A tray part in a few words, as its chip shows it. */
export const chipName = t => t.kind === "lever" ? (t.flyback ? "Flyback lever" : "Coupling lever") : t.kind === "fusee" ? "Fusée and chain" : t.kind === "remontoire" ? "Remontoire"
  : t.kind === "mainspring" ? `Stronger mainspring ×${t.strength}` : t.kind === "trip" ? (t.on === "hour" ? "Hour trip" : "Minute trip") : t.kind === "column" ? `Column wheel ${t.columns}` : t.kind === "cage" ? `Cage ${t.sun}/${t.pinion}` : t.kind === "balance" ? (t.inertia != null ? `Balance, inertia ${t.inertia}` : `Balance ${t.vph.toLocaleString("en-GB")} vph`) : t.kind === "reverser" ? `Reverser ${t.teeth}/${t.out}` : t.kind === "heart" ? "Heart cam" : t.kind === "fork" ? "Pallet fork" : t.kind === "escape" ? `Escape wheel ${t.teeth}`
  : t.kind === "barrel" ? `Barrel ${t.teeth}` : t.kind === "finger" ? "Finger" : t.kind === "star" ? (t.teeth === 59 ? "Moon disc 59" : `Star ${t.teeth}`)
  : `${t.teeth}${t.m ? " fine" : ""} ${t.kind === "pinion" ? "leaves" : "teeth"}`;
/** An arbor's short name: its label without the bracket, or what it carries. */
export const arborName = a => (a.label ? a.label.replace(/ \(.*\)$/, "") : a.parts?.length ? partName(a.parts[0]).replace(/, layer .*$/, "") : "Arbor");

/** The plate's reach from the centre: its radius, or a rectangle's half-diagonal. */
export const reachOf = plate => (typeof plate === "number" ? plate : Math.max(plate.w, plate.h) / 2);
/** The main plate: round with its circular graining and hour ticks, or the Reverso's rectangle with straight stripes. */
export function drawPlate(parent, plate) {
  if (typeof plate === "number") {
    el("circle", { cx: 0, cy: 0, r: plate, class: "cb-plate" }, parent);
    for (let r = 1.2; r < plate; r += 0.9) el("circle", { cx: 0, cy: 0, r, class: "cb-perlage" }, parent);   // the plate's circular graining
    for (let k = 1; k <= 12; k++) { const a = (k / 12) * 2 * Math.PI; el("line", { x1: Math.sin(a) * (plate - 0.5), y1: -Math.cos(a) * (plate - 0.5), x2: Math.sin(a) * plate, y2: -Math.cos(a) * plate, class: "cb-tick" }, parent); }
  } else {
    const { w, h } = plate;
    el("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: 1.2, class: "cb-plate" }, parent);
    for (let y = -h / 2 + 0.9; y < h / 2; y += 0.9) el("line", { x1: -w / 2 + 0.3, y1: y, x2: w / 2 - 0.3, y2: y, class: "cb-perlage" }, parent);   // Côtes de Genève, straight
  }
}
/** How long an arbor's hand is (0: it carries none), each as long as its job on the plate's dial. */
export function handLength(a, plate) {
  const hand = HANDS[a.id], R = typeof plate === "number" ? plate : Math.min(plate.w, plate.h) / 2;
  if (!hand || !(a.parts || []).length) return 0;
  return { hour: R * 0.42, minute: R * 0.62, gmt: R * 0.22, chrono: R * 0.78, counter: R * 0.14 }[hand] || R * 0.18;
}
/** The hands on the arbors that carry them, turning with their arbors. */
export function drawHands(parent, arbors, plate, o) {
  for (const a of arbors) {
    const hand = HANDS[a.id], len = handLength(a, plate);
    if (!len) continue;
    const g = el("g", { class: `cb-hand cb-${hand}${o.focus && !o.focus.has(a.id) ? " ghost" : ""}` }, parent);
    el("line", { x1: 0, y1: hand === "seconds" ? len * 0.25 : 0, x2: 0, y2: -len }, g);
    o.dyn.push([g, st => g.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${(st.angles[a.id] || 0) * 360})`)]);
  }
}

/**
 * A design as the plan shows it, into parent: the plate, the guides, the levers' arms, the parts from the lowest layer
 * up (higher ones lie on top, as in the movement), the meshes, the hands and the pivots. o: { plate, arbors (in the state
 * on show), out (the engine's run, for meshes and clashes), layer, selected (an arbor id), guides ([{ x, y, r }]), focus
 * (a Set of arbor ids: the rest drawn faint), labels (the fixed arbors' names), dyn }.
 */
export function drawDesign(parent, o) {
  const { arbors, out } = o, clashing = new Set((out?.clashes || []).flatMap(c => c.arbors)), reach = reachOf(o.plate);
  const faint = id => !!o.focus && !o.focus.has(id) && !o.focus.has(id.replace(/~$/, ""));
  drawPlate(parent, o.plate);
  for (const c of o.guides || []) el("circle", { cx: c.x, cy: c.y, r: c.r, class: "cb-guide" }, parent);
  for (const a of arbors) if (a.lever) el("line", { x1: a.lever.x, y1: a.lever.y, x2: a.x, y2: a.y, class: `cb-lever${faint(a.id) ? " ghost" : ""}` }, parent);
  const parts = arbors.flatMap(a => (a.parts || []).map(p => ({ a, p }))).sort((u, v) => u.p.layer - v.p.layer);
  for (const { a, p } of parts) drawPart(parent, a, p, { arbors, layer: o.layer, reach, clash: clashing.has(a.id), ghost: faint(a.id), dyn: o.dyn });
  for (const m of out?.meshes || []) {
    const A = arbors.find(a => a.id === m.a) || arbors.find(a => `${a.id}~` === m.a), B = arbors.find(a => a.id === m.b) || arbors.find(a => `${a.id}~` === m.b), k = m.ra / (m.ra + m.rb);
    if (!A || !B) continue;
    const lit = o.lit && ((o.lit.a === A.id && o.lit.b === B.id) || (o.lit.a === B.id && o.lit.b === A.id));
    el("circle", { cx: A.x + (B.x - A.x) * k, cy: A.y + (B.y - A.y) * k, r: lit ? 0.42 : 0.16, class: `cb-mesh${lit ? " lit" : ""}${faint(A.id) || faint(B.id) ? " ghost" : ""}` }, parent);
  }
  drawHands(parent, arbors, o.plate, o);
  for (const a of arbors) {                                       // pivots: jewels in their chatons; posts plain
    const train = (a.parts || []).some(p => !DIAL_LAYERS.includes(p.layer));
    const pin = el("g", { "data-arbor": a.id, class: `cb-pivot${a.fixed ? " fixed" : ""}${o.selected === a.id ? " sel" : ""}${a.noParts ? " post" : ""}${faint(a.id) ? " ghost" : ""}` }, parent);
    if (a.noParts) el("circle", { cx: a.x, cy: a.y, r: 0.4, class: "cb-post" }, pin);
    else { el("circle", { cx: a.x, cy: a.y, r: 0.3, class: "cb-chaton" }, pin); el("circle", { cx: a.x, cy: a.y, r: 0.17, class: train ? "cb-jewel" : "cb-stud" }, pin); }
    el("title", {}, pin).textContent = a.label || "Arbor";
    if (o.labels && a.label && a.fixed && !a.on && !faint(a.id)) { const t = el("text", { x: a.x, y: a.y + 0.95, class: "cb-label" }, parent); t.textContent = arborName(a); }
  }
}
