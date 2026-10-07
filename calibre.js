// Calibre: learn watchmaking by drafting movements on the calibre plan. Each level gives a plate, the parts already
// fixed there and a tray; you place wheels and pinions on layers, the engine runs the train as it would really turn,
// and winding sets it going in time-lapse. Goals are met only when the watch truly keeps time.
import { judge, startDesign, solved, partsUsed, snap, snapEscapement, radius, rateText, workings, MODULE, DIAL_LAYERS, ESCAPE_R, FORK_LENGTH, BALANCE_R, MAINSPRING_TURNS } from "./calibre-engine.js";
import { LEVELS, CHAPTERS, GLOSSARY } from "./calibre-levels.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const PROGRESS = "calibre:progress", AT = "calibre:at", SPEED = "calibre:speed";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.append(e); return e; };
const LAYER_NAMES = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "D1", 7: "D2", 8: "D3" };   // D: the dial side
// parts that can only sit at one height: the barrel at the bottom, the ratchet on top of it, the escapement above the
// train, calendar fingers and discs on the dial side
const FORCED = { barrel: 1, ratchet: 5, escape: 9, fork: 9, balance: 10, finger: 8, star: 8 };
const HANDS = { centre: "minute", hours: "hour", seconds: "seconds", h24: "gmt" };
const SPEEDS = [[1, "Real time"], [60, "A minute a second"], [720, "Twelve minutes a second"]];

// ---------- state ----------
let level = null, design = null, tray = [], chosen = null, layer = 1, selected = null, view = null, nextId = 1, history = [], hintAt = 0, showWork = false;
let verdict = null, last = 0, toastTimer = 0;
// The simulation: the angle of every arbor (in turns), how wound the mainspring is (0 to 1), the barrel arbor's turn
// while winding, the balance's swing and the fork's rock (degrees), and what the movement is doing.
const TURNS = MAINSPRING_TURNS;                                   // a fully wound mainspring gives the barrel five turns
let sim = { angles: {}, base: {}, wound: 0, windAngle: 0, balance: 0, fork: 0, state: "stopped", t: 0, hours: 0 };
const running = () => sim.state !== "stopped";
const barrelOf = () => design.arbors.find(a => (a.parts || []).some(p => p.kind === "barrel"));
const progress = () => read(PROGRESS, {});

function load(id) {
  level = LEVELS.find(l => l.id === id) || LEVELS[0];
  write(AT, level.id);
  design = startDesign(level);
  tray = level.tray.map(t => ({ ...t, left: t.n }));
  chosen = null; selected = null; nextId = 1; history = []; hintAt = 0; showWork = false;
  sim = { angles: {}, base: {}, wound: 0, windAngle: 0, balance: 0, fork: 0, state: "stopped", t: 0, hours: 0 };
  layer = Math.min(...level.tray.filter(t => t.kind !== "balance").map(() => 1), 1);
  const R = plateReach() + 0.8;
  view = { x: -R, y: -R, w: 2 * R, h: 2 * R };
  render();
  $("windBtn").textContent = barrelOf() ? "Wind" : "Turn";
  if (!progress()[level.id]?.seen) openPrimer();
}

/** How far the plate reaches from the centre: its radius, or a rectangle's half-diagonal. */
const plateReach = () => (typeof level.plate === "number" ? level.plate : Math.max(level.plate.w, level.plate.h) / 2);

// ---------- undo: every change can be taken back ----------
function remember() { history.push({ arbors: JSON.stringify(design.arbors), left: tray.map(t => t.left), nextId }); if (history.length > 80) history.shift(); }
function undo() {
  const h = history.pop();
  if (!h) return toast("Nothing to undo.");
  stop(); design.arbors = JSON.parse(h.arbors); tray.forEach((t, i) => { t.left = h.left[i]; }); nextId = h.nextId; selected = null; render();
}

// ---------- drawing: each part as itself ----------
const toothCache = new Map();
/** A gear's outline: teeth round the pitch circle, as a cutter leaves them; pinions have fewer, deeper, rounder leaves. */
function toothPath(teeth, pinion, m = MODULE) {
  const key = `${teeth}${pinion ? "p" : ""}${m}`;
  if (toothCache.has(key)) return toothCache.get(key);
  const r = radius(teeth, m), out = r + m * (pinion ? 0.9 : 1), inn = r - m * (pinion ? 1.6 : 1.25), step = (2 * Math.PI) / teeth;
  const shape = pinion ? [[-0.3, inn], [-0.18, out], [0.18, out], [0.3, inn]] : [[-0.25, inn], [-0.12, out], [0.12, out], [0.25, inn]];
  const pts = [];
  for (let i = 0; i < teeth; i++) for (const [da, rr] of shape) pts.push([Math.cos((i + da) * step) * rr, Math.sin((i + da) * step) * rr]);
  const d = `M${pts.map(q => q.map(v => v.toFixed(3)).join(" ")).join("L")}Z`;
  toothCache.set(key, d);
  return d;
}
/** A Swiss lever escape wheel: club teeth leaning the way it turns, cut to its own larger module. */
function escapePath(teeth) {
  const key = `e${teeth}`;
  if (toothCache.has(key)) return toothCache.get(key);
  const R = ESCAPE_R, step = (2 * Math.PI) / teeth, pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [da, rr] of [[0, R * 0.72], [0.18, R * 0.78], [0.62, R], [0.72, R * 0.97], [0.5, R * 0.8], [0.75, R * 0.72]]) pts.push([Math.cos(a + da * step) * rr, Math.sin(a + da * step) * rr]);
  }
  const d = `M${pts.map(q => q.map(v => v.toFixed(3)).join(" ")).join("L")}Z`;
  toothCache.set(key, d);
  return d;
}
/** A flat spiral from radius r0 to r1 over the given turns, its radius running by the shape function f(s) on 0..1. */
function spiralPath(r0, r1, turns, f = s => s, twist = 0) {
  const n = Math.max(60, Math.round(turns * 48)), pts = [];
  for (let i = 0; i <= n; i++) { const s = i / n, a = s * turns * 2 * Math.PI + twist * (1 - s), r = r0 + (r1 - r0) * f(s); pts.push(`${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`); }
  return `M${pts.join("L")}`;
}
/** The mainspring in its barrel: wound, its coils wrap tight round the arbor; let down, they lie against the drum wall. */
const springShape = (wound, ra, rw) => s => wound * Math.pow(s, 3) + (1 - wound) * (1 - Math.pow(1 - s, 3));

const dyn = [];                                                  // what each frame moves: [element, update(state)]
function drawPart(svg, a, p, clash) {
  const g = el("g", { class: `cb-part cb-${p.kind}${p.layer === layer ? " on" : ""}${DIAL_LAYERS.includes(p.layer) ? " dial" : ""}${clash ? " clash" : ""}` }, svg);
  const spin = el("g", {}, g);
  dyn.push([spin, st => spin.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${(st.angles[a.id] || 0) * 360})`)]);
  if (p.kind === "barrel") {
    const r = radius(p.teeth);
    el("path", { d: toothPath(p.teeth), class: "cb-drum" }, spin);
    el("circle", { r: r - MODULE * 2.4, class: "cb-cavity" }, spin);
    const spring = el("path", { class: "cb-mainspring" }, g), ra = 0.62, rw = r - MODULE * 2.6;
    dyn.push([spring, st => { spring.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${(st.angles[a.id] || 0) * 360})`); spring.setAttribute("d", spiralPath(ra, rw, 6 + 6 * st.wound, springShape(st.wound, ra, rw), -st.wound * 9)); }]);
    const arbor = el("g", {}, g);
    el("circle", { r: ra, class: "cb-barrel-arbor" }, arbor); el("rect", { x: -0.24, y: -0.24, width: 0.48, height: 0.48, class: "cb-square" }, arbor);
    dyn.push([arbor, st => arbor.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${st.windAngle * 360})`)]);
  } else if (p.kind === "escape") {
    el("path", { d: escapePath(p.teeth) }, spin);
    for (let k = 0; k < 4; k++) el("line", { x1: 0, y1: 0, x2: Math.cos(k * Math.PI / 2) * ESCAPE_R * 0.7, y2: Math.sin(k * Math.PI / 2) * ESCAPE_R * 0.7, class: "cb-spoke" }, spin);
  } else if (p.kind === "fork") {
    const e = design.arbors.find(x => (x.parts || []).some(q => q.kind === "escape"));
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
    const f = design.arbors.find(x => (x.parts || []).some(q => q.kind === "fork"));
    const toward = f ? Math.atan2(f.y - a.y, f.x - a.x) : 0;    // at rest the impulse pin sits in the fork's horns
    el("circle", { cx: Math.cos(toward) * 0.42, cy: Math.sin(toward) * 0.42, r: 0.11, class: "cb-stone" }, bal);
    dyn.push([bal, st => bal.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${st.balance || 0})`)]);
    dyn.push([hair, st => { hair.setAttribute("transform", `translate(${a.x} ${a.y})`); hair.setAttribute("d", spiralPath(0.3, R * 0.68, 9, s => s, ((st.balance || 0) * Math.PI) / 180)); }]);
  } else if (p.kind === "ratchet") {
    const r = radius(p.teeth), step = (2 * Math.PI) / p.teeth, pts = [];
    for (let i = 0; i < p.teeth; i++) { pts.push([Math.cos(i * step) * (r - 0.18), Math.sin(i * step) * (r - 0.18)]); pts.push([Math.cos((i + 0.85) * step) * (r + 0.1), Math.sin((i + 0.85) * step) * (r + 0.1)]); }
    el("path", { d: `M${pts.map(q => q.map(v => v.toFixed(3)).join(" ")).join("L")}Z`, class: "cb-ratchet" }, spin);
    el("circle", { r: 0.5, class: "cb-hub" }, spin);
    // the click rides on the teeth from outside, on its own little spring
    el("path", { d: `M${(a.x + r + 0.9).toFixed(2)} ${(a.y - 0.6).toFixed(2)}L${(a.x + r - 0.05).toFixed(2)} ${(a.y + 0.05).toFixed(2)}L${(a.x + r + 0.6).toFixed(2)} ${(a.y + 0.2).toFixed(2)}Z`, class: "cb-click" }, g);
  } else if (p.kind === "star" && p.internal) {
    // the date ring: teeth on its inside, the dates printed round it
    const step = (2 * Math.PI) / p.teeth, pts = [];
    for (let i = 0; i < p.teeth; i++) { pts.push([Math.cos(i * step) * (p.r + 0.3), Math.sin(i * step) * (p.r + 0.3)]); pts.push([Math.cos((i + 0.5) * step) * (p.r - 0.15), Math.sin((i + 0.5) * step) * (p.r - 0.15)]); }
    el("path", { d: `M${pts.map(q => q.map(v => v.toFixed(3)).join(" ")).join("L")}ZM${p.r + 1.3} 0A${p.r + 1.3} ${p.r + 1.3} 0 1 0 ${-(p.r + 1.3)} 0A${p.r + 1.3} ${p.r + 1.3} 0 1 0 ${p.r + 1.3} 0Z`, class: "cb-ring", "fill-rule": "evenodd" }, spin);
    for (let i = 0; i < p.teeth; i++) { const t = el("text", { x: Math.cos((i + 0.5) * step) * (p.r + 0.85), y: Math.sin((i + 0.5) * step) * (p.r + 0.85), class: "cb-date", transform: `rotate(${(((i + 0.5) * step) * 180) / Math.PI + 90} ${Math.cos((i + 0.5) * step) * (p.r + 0.85)} ${Math.sin((i + 0.5) * step) * (p.r + 0.85)})` }, spin); t.textContent = i + 1; }
  } else if (p.kind === "star" || (p.m && p.teeth >= 100)) {
    // a moon disc (two moons on a night sky), or a star wheel pushed a tooth at a time
    const r = p.kind === "star" ? p.r : radius(p.teeth, p.m), moon = p.teeth === 59 || p.teeth >= 100;
    el("path", { d: p.kind === "star" ? starPath(p.teeth, r) : toothPath(p.teeth, false, p.m), class: moon ? "cb-moondisc" : "cb-star" }, spin);
    if (moon) for (const k of [0, 1]) el("circle", { cx: Math.cos(k * Math.PI) * r * 0.55, cy: Math.sin(k * Math.PI) * r * 0.55, r: r * 0.28, class: "cb-moon" }, spin);
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
}
function starPath(teeth, r) {
  const step = (2 * Math.PI) / teeth, pts = [];
  for (let i = 0; i < teeth; i++) { pts.push([Math.cos(i * step) * r, Math.sin(i * step) * r]); pts.push([Math.cos((i + 0.5) * step) * (r - 0.35), Math.sin((i + 0.5) * step) * (r - 0.35)]); }
  return `M${pts.map(q => q.map(v => v.toFixed(3)).join(" ")).join("L")}Z`;
}
const partName = p => p.kind === "balance" ? `Balance, ${p.vph.toLocaleString("en-GB")} vph` : p.kind === "fork" ? "Pallet fork" : p.kind === "escape" ? `${p.teeth}-tooth escape wheel`
  : p.kind === "barrel" ? `Barrel with its mainspring, ${p.teeth} teeth` : p.kind === "ratchet" ? `Ratchet wheel, ${p.teeth} teeth, with its click` : p.kind === "finger" ? "Driving finger"
  : p.kind === "star" ? (p.internal ? `Date ring, ${p.teeth} inner teeth` : p.teeth === 59 ? "Moon disc, 59 teeth" : `${p.teeth}-tooth star wheel`)
  : `${p.teeth}-${p.kind === "pinion" ? "leaf pinion" : "tooth wheel"}${p.m ? " (fine)" : ""}, layer ${LAYER_NAMES[p.layer] || p.layer}`;
/** A tray part in a few words, as its chip shows it. */
const chipName = t => t.kind === "balance" ? `Balance ${t.vph.toLocaleString("en-GB")} vph` : t.kind === "fork" ? "Pallet fork" : t.kind === "escape" ? `Escape wheel ${t.teeth}`
  : t.kind === "barrel" ? `Barrel ${t.teeth}` : t.kind === "finger" ? "Finger" : t.kind === "star" ? (t.teeth === 59 ? "Moon disc 59" : `Star ${t.teeth}`)
  : `${t.teeth}${t.m ? " fine" : ""} ${t.kind === "pinion" ? "leaves" : "teeth"}`;

function render() {
  const svg = $("plan");
  svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  svg.replaceChildren();
  dyn.length = 0;
  verdict = judge(level, design);
  const R = typeof level.plate === "number" ? level.plate : Math.min(level.plate.w, level.plate.h) / 2;
  if (typeof level.plate === "number") {
    el("circle", { cx: 0, cy: 0, r: R, class: "cb-plate" }, svg);
    for (let r = 1.2; r < R; r += 0.9) el("circle", { cx: 0, cy: 0, r, class: "cb-perlage" }, svg);   // the plate's circular graining
    for (let k = 1; k <= 12; k++) { const a = (k / 12) * 2 * Math.PI; el("line", { x1: Math.sin(a) * (R - 0.5), y1: -Math.cos(a) * (R - 0.5), x2: Math.sin(a) * R, y2: -Math.cos(a) * R, class: "cb-tick" }, svg); }
  } else {
    const { w, h } = level.plate;
    el("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: 1.2, class: "cb-plate" }, svg);
    for (let y = -h / 2 + 0.9; y < h / 2; y += 0.9) el("line", { x1: -w / 2 + 0.3, y1: y, x2: w / 2 - 0.3, y2: y, class: "cb-perlage" }, svg);   // Côtes de Genève, straight
  }
  // with a gear in hand, faint circles show where its arbor would have to stand to mesh with each wheel on this layer
  const t = tray[chosen];
  if (t && t.teeth && !["escape", "star", "finger", "balance", "fork"].includes(t.kind)) {
    const rr = radius(t.teeth, t.m), lay = FORCED[t.kind] || layer;
    for (const a of design.arbors) for (const q of a.parts || []) if (q.layer === lay && q.teeth && !["escape", "star"].includes(q.kind) && (q.m || MODULE) === (t.m || MODULE))
      el("circle", { cx: a.x, cy: a.y, r: radius(q.teeth, q.m) + rr, class: "cb-guide" }, svg);
  }
  const clashing = new Set(verdict.out.clashes.flatMap(c => c.arbors));
  // parts from the lowest layer up, so higher ones lie on top as they do in the movement
  const parts = design.arbors.flatMap(a => (a.parts || []).map(p => ({ a, p }))).sort((u, v) => u.p.layer - v.p.layer);
  for (const { a, p } of parts) drawPart(svg, a, p, clashing.has(a.id));
  for (const m of verdict.out.meshes) {
    const A = design.arbors.find(a => a.id === m.a), B = design.arbors.find(a => a.id === m.b), k = m.ra / (m.ra + m.rb);
    el("circle", { cx: A.x + (B.x - A.x) * k, cy: A.y + (B.y - A.y) * k, r: 0.16, class: "cb-mesh" }, svg);
  }
  for (const a of design.arbors) {                                // hands on the arbors that carry them
    const hand = HANDS[a.id];
    if (!hand || !(a.parts || []).length) continue;
    const len = hand === "hour" ? R * 0.42 : hand === "minute" ? R * 0.62 : hand === "gmt" ? R * 0.22 : R * 0.18, g = el("g", { class: `cb-hand cb-${hand}` }, svg);
    el("line", { x1: 0, y1: hand === "seconds" ? len * 0.25 : 0, x2: 0, y2: -len }, g);
    dyn.push([g, st => g.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${(st.angles[a.id] || 0) * 360})`)]);
  }
  for (const a of design.arbors) {                                // pivots: jewels in their chatons; posts plain
    const train = (a.parts || []).some(p => !DIAL_LAYERS.includes(p.layer));
    const pin = el("g", { "data-arbor": a.id, class: `cb-pivot${a.fixed ? " fixed" : ""}${selected === a.id ? " sel" : ""}${a.noParts ? " post" : ""}` }, svg);
    if (a.noParts) el("circle", { cx: a.x, cy: a.y, r: 0.4, class: "cb-post" }, pin);
    else { el("circle", { cx: a.x, cy: a.y, r: 0.3, class: "cb-chaton" }, pin); el("circle", { cx: a.x, cy: a.y, r: 0.17, class: train ? "cb-jewel" : "cb-stud" }, pin); }
    el("title", {}, pin).textContent = a.label || "Arbor";
    if (a.label && a.fixed && !a.on) { const t = el("text", { x: a.x, y: a.y + 0.95, class: "cb-label" }, svg); t.textContent = a.label.replace(/ \(.*\)$/, ""); }
  }
  frame();
  renderBrief(); renderTray(); renderLayers(); renderInspect(); showPower();
}
/** Moves what moves: wheels, hands, the spring, the fork and the balance, from the simulation's state. */
function frame() { for (const [, update] of dyn) update(sim); }

function renderBrief() {
  const ch = CHAPTERS.find(c => c.id === level.chapter);
  $("where").textContent = `${ch.id}. ${ch.title} · ${level.id} ${level.title}`;
  const p = progress()[level.id];
  $("stars").textContent = p?.stars ? "★".repeat(p.stars) + "☆".repeat(3 - p.stars) : "";
  $("task").textContent = level.task;
  const STATES = { free: "spinning free", locked: "held by the pallet fork", running: "running", none: "no escape wheel" };
  $("goals").replaceChildren(...verdict.goals.map(g => {
    const li = document.createElement("li"), a = design.arbors.find(x => x.id === g.goal.arbor);
    li.className = g.ok ? "ok" : "";
    li.textContent = g.goal.escapement ? `Escape wheel: ${STATES[g.goal.escapement]} · now ${STATES[g.actual]}`
      : g.goal.reserve ? `Power reserve: ${g.goal.reserve}${g.goal.most ? `–${g.goal.most}` : "+"} hours · now ${g.actual ? `${Math.round(g.actual)} hours` : "not running"}`
      : g.goal.sign ? `${a?.label?.replace(/ \(.*\)$/, "") || g.goal.arbor}: turning ${g.goal.sign > 0 ? "clockwise" : "anticlockwise"} · now ${rateText(g.actual)}`
      : `${a?.label?.replace(/ \(.*\)$/, "") || g.goal.arbor}: ${g.goal.abs ? rateText(Math.abs(g.goal.rate)).replace(/, clockwise$/, ", either way") : rateText(g.goal.rate)} · now ${rateText(g.actual)}`;
    return li;
  }), ...verdict.problems.slice(0, 2).map(t => { const li = document.createElement("li"); li.className = "bad"; li.textContent = t; return li; }));
  // the workings: how the first goal that isn't met is driven, step by step, ratio by ratio
  const work = $("work");
  work.hidden = !showWork;
  if (showWork) {
    const g = verdict.goals.find(x => !x.ok && x.goal.arbor) || verdict.goals.find(x => x.goal.arbor);
    const steps = g && workings(design, verdict.out, g.goal.arbor), name = id => (design.arbors.find(a => a.id === id)?.label || "your arbor").replace(/ \(.*\)$/, "");
    if (!g) work.textContent = "";
    else if (!steps) work.textContent = `${name(g.goal.arbor)} isn't connected to anything that turns yet.`;
    else {
      let total = 1;
      const parts = steps.map(st => { const k = st.finger ? 1 / st.finger : st.driver / st.driven; total *= st.finger ? k : -k;
        return st.finger ? `${name(st.from)} → ${name(st.to)}: a finger, a tooth a turn of ${st.finger}` : `${name(st.from)} ${st.driver} → ${st.driven} ${name(st.to)}: ×${+(st.driver / st.driven).toFixed(4)}, reversed`; });
      work.textContent = `${parts.join(" · ")}. In all ×${+Math.abs(total).toFixed(5)}, ${total > 0 ? "same way as the source" : "the other way"}.`;
    }
  }
  $("hintBtn").textContent = level.hints.length ? (hintAt ? `Hint ${Math.min(hintAt + 1, level.hints.length)}/${level.hints.length}` : "Hint") : "";
  $("hintBtn").hidden = !level.hints.length;
}

function renderTray() {
  $("tray").replaceChildren(...tray.map((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cb-chip cb-${t.kind}${chosen === i ? " on" : ""}`;
    b.disabled = !t.left;
    b.textContent = `${chipName(t)}${t.n > 1 ? ` ×${t.left}` : ""}`;
    b.setAttribute("aria-pressed", chosen === i);
    b.addEventListener("click", () => {
      chosen = chosen === i ? null : i; selected = null;
      if (chosen != null && FORCED[t.kind]) layer = FORCED[t.kind] <= 8 ? FORCED[t.kind] : layer;   // a part with its own height takes the layer with it
      render();                                                   // the guides show where it would mesh
    });
    return b;
  }));
  if (!tray.length) $("tray").textContent = "Nothing to add: change what's there.";
}

function renderLayers() {
  const used = [1, 2, 3, 4, 5, 6, 7, 8].filter(n => n <= 2 || design.arbors.some(a => (a.parts || []).some(p => p.layer >= n - 1)) || (n <= 7 && DIAL_LAYERS.includes(n) && level.chapter >= 4) || (n === 8 && level.chapter >= 7));
  $("layers").replaceChildren(...used.map(n => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `cb-layer${layer === n ? " on" : ""}${DIAL_LAYERS.includes(n) ? " dial" : ""}`;
    b.textContent = LAYER_NAMES[n]; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", layer === n);
    b.title = DIAL_LAYERS.includes(n) ? `Dial side, layer ${n - 5}: under the dial, for the motion works` : `Layer ${n}, between the plate and the bridges`;
    b.addEventListener("click", () => { layer = n; render(); });
    return b;
  }));
}

function renderInspect() {
  const box = $("inspect"), a = design.arbors.find(x => x.id === selected);
  if (!a) { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren();
  const h = document.createElement("p"); h.className = "cb-in-head"; h.textContent = `${a.label || "Arbor"} · ${rateText(verdict.out.rates[a.id])}`;
  box.append(h);
  for (const [i, p] of (a.parts || []).entries()) {
    const row = document.createElement("p"); row.className = "cb-in-row";
    row.textContent = partName(p);
    if (!p.fixed) {
      const x = document.createElement("button"); x.type = "button"; x.className = "cb-x"; x.textContent = "Remove";
      x.addEventListener("click", () => removePart(a, i));
      row.append(x);
    }
    box.append(row);
  }
  if (a.placed) {
    const x = document.createElement("button"); x.type = "button"; x.className = "cb-x"; x.textContent = "Take out the whole arbor";
    x.addEventListener("click", () => { remember(); design.arbors = design.arbors.filter(y => y !== a); selected = null; render(); });
    box.append(x);
  }
}

// ---------- placing ----------
function removePart(a, i) {
  const p = a.parts[i];
  remember();
  const t = tray.find(t => t.kind === p.kind && (t.teeth ?? t.vph ?? t.len ?? null) === (p.teeth ?? p.vph ?? p.len ?? null) && (t.m || 0) === (p.m || 0));
  if (t) t.left++;
  a.parts.splice(i, 1);
  if (!a.fixed && !a.placed && !a.parts.length) { design.arbors = design.arbors.filter(x => x !== a); selected = null; }
  render();
}

function place(x, y) {
  const t = tray[chosen];
  if (!t?.left) return;
  const hit = arborAt(x, y);
  const special = t.kind === "balance" || t.kind === "fork", partLayer = FORCED[t.kind] || layer;
  const piece = { ...Object.fromEntries(Object.entries(t).filter(([k]) => !["n", "left"].includes(k))), layer: partLayer };
  if (!hit && ["finger", "star", "barrel", "escape", "ratchet"].includes(t.kind)) return toast(t.kind === "finger" ? "A finger rides on a wheel: tap the arbor it goes on." : "Tap the arbor it goes on.");
  remember();
  if (hit) {
    if (hit.noParts) return toast("That's a post: nothing goes on it.");
    if (special && (hit.parts || []).length) return toast(t.kind === "fork" ? "The pallet fork has an arbor of its own, beside the escape wheel." : "The balance has a staff of its own, at the end of the fork.");
    if ((hit.parts || []).some(p => p.layer === partLayer)) return toast(`That arbor already has a part on layer ${LAYER_NAMES[partLayer]}.`);
    hit.parts.push(piece);
  } else {
    // a fork sits where its stones reach the escape wheel; a balance in line at the end of the fork
    const s = special ? snapEscapement(design, x, y, t.kind) : snap(design, x, y, t.teeth, partLayer, undefined, t.m);
    if (special && !s) return toast(t.kind === "fork" ? "A pallet fork works on an escape wheel: there isn't one yet." : "A balance needs a pallet fork to swing.");
    design.arbors.push({ id: `a${nextId++}`, x: s ? s.x : x, y: s ? s.y : y, parts: [piece] });
  }
  t.left--;
  if (!t.left) chosen = null;
  render();
}

function arborAt(x, y) {
  let best = null, bd = Infinity;
  for (const a of design.arbors) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } }
  return bd <= Math.max(0.5, view.w / 40) ? best : null;
}

// ---------- the plate: tap, drag, pinch, wheel ----------
const svg = $("plan"), pointers = new Map();
let gesture = null;
const toPlan = (cx, cy) => { const b = svg.getBoundingClientRect(), k = Math.max(view.w / b.width, view.h / b.height); return [view.x + (cx - b.left - (b.width - view.w / k) / 2) * k, view.y + (cy - b.top - (b.height - view.h / k) / 2) * k]; };
function zoomAt(f, cx, cy) {
  const [px, py] = cx == null ? [view.x + view.w / 2, view.y + view.h / 2] : toPlan(cx, cy), R = plateReach() + 0.8;
  const w = Math.min(2 * R * 1.5, Math.max(3, view.w * f)), k = w / view.w;
  view = { x: px - (px - view.x) * k, y: py - (py - view.y) * k, w, h: view.h * k };
  render();
}
svg.addEventListener("pointerdown", e => {
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (pts.length === 1) {
    const [x, y] = toPlan(e.clientX, e.clientY), a = arborAt(x, y);
    gesture = { kind: a && !a.fixed && chosen == null ? "move" : "pan", a, from: pts[0], view: { ...view }, moved: false };
  } else gesture = { kind: "pinch", d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), w: view.w };
});
svg.addEventListener("pointermove", e => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (gesture.kind === "pinch" && pts.length >= 2) {
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    zoomAt(gesture.w * gesture.d / Math.max(1, d) / view.w, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
    return;
  }
  if (Math.hypot(pts[0].x - gesture.from.x, pts[0].y - gesture.from.y) > 6) gesture.moved = true;
  if (!gesture.moved) return;
  if (gesture.kind === "move") {
    if (!gesture.saved) { remember(); gesture.saved = true; }
    const [x, y] = toPlan(e.clientX, e.clientY), first = gesture.a.parts.find(p => p.teeth);
    const s = first && snap(design, x, y, first.teeth, first.layer, gesture.a.id, first.m);
    gesture.a.x = s ? s.x : x; gesture.a.y = s ? s.y : y;
    render();
  } else {
    const b = svg.getBoundingClientRect(), k = Math.max(view.w / b.width, view.h / b.height);
    view = { ...gesture.view, x: gesture.view.x - (pts[0].x - gesture.from.x) * k, y: gesture.view.y - (pts[0].y - gesture.from.y) * k };
    render();
  }
});
const lift = e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (gesture && !gesture.moved && gesture.kind !== "pinch" && e.type === "pointerup") {
    const [x, y] = toPlan(e.clientX, e.clientY);
    if (chosen != null) place(x, y);
    else { const a = arborAt(x, y); selected = a ? a.id : null; render(); }
  }
  if (!pointers.size) gesture = null;
};
svg.addEventListener("pointerup", lift);
svg.addEventListener("pointercancel", lift);
svg.addEventListener("wheel", e => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
$("zoomIn").addEventListener("click", () => zoomAt(1 / 1.5));
$("zoomOut").addEventListener("click", () => zoomAt(1.5));

// ---------- winding and running: the movement as it would really behave ----------
// A barrel-driven movement is wound first: the barrel arbor turns, the mainspring coils tight round it. Then the
// escapement decides: with no pallet fork the spring dumps itself in a second and a half; a fork with no balance
// locks after one tick; fork and balance and it runs, the balance swinging in real time, the escape wheel stepping
// half a tooth a beat (visible at real speed), the spring running down until the watch stops. A crank just turns.
function wind() {
  verdict = judge(level, design);
  sim.base = { ...sim.angles }; sim.t = 0; sim.hours = 0;
  if (barrelOf()) { sim.state = "winding"; sim.w0 = sim.wound; }
  else start();
  last = performance.now();
  requestAnimationFrame(tick);
  render();
}
function start() {
  const out = verdict.out;
  sim.base = { ...sim.angles }; sim.t = 0; sim.hours = 0;
  if (out.jammed.length) { sim.state = "stopped"; toast("It won't turn: the train is locked."); }
  else if (out.runaway) { sim.state = "runaway"; sim.w0 = sim.wound; }
  else if (out.locked) { sim.state = "locked"; }
  else sim.state = "running";
  if (sim.state === "running" && verdict.ok) setTimeout(() => { if (sim.state === "running") won(); }, 1600);
  if (sim.state === "running" && !verdict.ok) toast(verdict.problems[0] || "It runs, but not at the right rates: the goals show what's turning and what should.");
}
function won() {
  const used = partsUsed(design), hinted = hintAt > 0, stars = Math.min(hinted ? 2 : 3, used <= level.par ? 3 : used <= level.par + 2 ? 2 : 1);
  const all = progress(), before = all[level.id] || {};
  all[level.id] = { ...before, seen: true, stars: Math.max(stars, before.stars || 0), parts: Math.min(used, before.parts ?? Infinity) };
  write(PROGRESS, all);
  const next = LEVELS[LEVELS.indexOf(level) + 1];
  $("doneTitle").textContent = verdict.goals.some(g => g.goal.escapement === "locked") ? "Tick" : "It runs";
  const body = $("doneBody"); body.replaceChildren();
  const p = document.createElement("p"); p.className = "cb-done-stars"; p.textContent = "★".repeat(stars) + "☆".repeat(3 - stars); body.append(p);
  const q = document.createElement("p"); q.textContent = `${used} part${used === 1 ? "" : "s"}, par ${level.par}.${hinted ? " A hint was used: two stars at most." : stars < 3 ? " Fewer parts would earn all three stars." : ""}`; body.append(q);
  if (next) body.append(action(`Next: ${next.id} ${next.title}`, () => { $("doneDlg").close(); load(next.id); }, "primary"));
  else body.append(line("That's the course so far. More chapters are coming."));
  body.append(action("Watch it run", () => $("doneDlg").close()));
  renderBrief();
  $("doneDlg").showModal();
}
function stop(note) { sim.state = "stopped"; sim.balance = 0; sim.fork = 0; $("windBtn").textContent = barrelOf() ? "Wind" : "Turn"; if (note) toast(note); renderBrief(); }

function tick(now) {
  if (!running()) return;
  const dt = Math.min(0.1, (now - last) / 1000), speed = read(SPEED, 60), out = verdict.out, rates = out.rates, b = barrelOf();
  last = now; sim.t += dt;
  if (sim.state === "winding") {
    const k = Math.min(1, sim.t / 0.9), e = 1 - (1 - k) * (1 - k);
    sim.wound = sim.w0 + (1 - sim.w0) * e;
    sim.windAngle = -e * (1 - sim.w0) * TURNS * 0.5;
    if (k >= 1) start();
  } else if (sim.state === "runaway") {
    // the spring lets go: the barrel spins out its turns in a second and a half, the train with it at its ratios
    const k = Math.min(1, sim.t / 1.5), released = sim.w0 * TURNS * (1 - (1 - k) * (1 - k)), rel = out.relative || {};
    sim.wound = sim.w0 * (1 - k) * (1 - k);
    for (const [id, r] of Object.entries(rel)) if (b && rel[b.id]) sim.angles[id] = (sim.base[id] || 0) + (released * r) / Math.abs(rel[b.id]);
    if (k >= 1) stop("The spring ran away: with no pallet fork to hold the escape wheel, it unwound in a second.");
  } else if (sim.state === "locked") {
    const esc = out.escapements[0];
    if (esc && sim.t < 0.15) sim.angles[esc.escape] = (sim.base[esc.escape] || 0) + (sim.t / 0.15) * (0.5 / esc.teeth) * 0.3;
    if (sim.t > 0.4) stop(level.goals.some(g => g.escapement === "locked") ? null : "Tick, and nothing more: the pallet fork locks the escape wheel, and there's no balance to swing it.");
    if (sim.t > 0.4 && verdict.ok) won();
  } else {
    const dh = (dt * speed) / 3600, esc = out.escapements.find(x => x.state === "running" && rates[x.escape]);
    sim.hours += dh;
    if (esc && speed === 1) {
      // at real speed the escape wheel steps half a tooth a beat, and every wheel steps with it
      const beats = Math.floor((sim.t * esc.vph) / 3600), escRev = (beats / (2 * esc.teeth)) * Math.sign(rates[esc.escape]);
      for (const [id, r] of Object.entries(rates)) if (r) sim.angles[id] = (sim.base[id] || 0) + (escRev * r) / rates[esc.escape];
    } else for (const [id, r] of Object.entries(rates)) if (r) sim.angles[id] = (sim.base[id] || 0) + r * sim.hours;
    if (esc) {                                                    // the balance swings in real time, whatever the speed
      const amp = 270 * Math.min(1, 0.45 + sim.wound * 0.7);      // its swing falls off as the spring runs down
      sim.balance = amp * Math.sin(2 * Math.PI * (esc.vph / 7200) * sim.t);
      sim.fork = 8 * Math.max(-1, Math.min(1, sim.balance / 30));
    }
    if (b && rates[b.id]) {
      sim.wound -= (Math.abs(rates[b.id]) * dh) / TURNS;
      if (sim.wound <= 0) { sim.wound = 0; stop(`The mainspring has run down after ${Math.round(sim.hours)} hours.`); }
    }
  }
  frame();
  showPower();
  if (running()) requestAnimationFrame(tick);
}
/** The power reserve: hours left in the spring at the barrel's present rate. */
function showPower() {
  let el2 = $("power");
  if (!el2) { el2 = document.createElement("span"); el2.id = "power"; el2.className = "cb-power"; $("where").after(el2); }
  const b = barrelOf(), r = b && verdict?.out.rates[b.id];
  el2.textContent = b ? `${Math.round(sim.wound * 100)}%${r ? ` · ${Math.round((sim.wound * TURNS) / Math.abs(r))} h` : ""}` : "";
  el2.title = "The mainspring: how wound it is, and the hours it has left at this rate";
}
$("windBtn").addEventListener("click", () => {
  if (running()) stop();
  else { wind(); $("windBtn").textContent = "Stop"; }
});

// ---------- sheets ----------
function openPrimer() {
  $("primerTitle").textContent = `${level.id} ${level.title}`;
  const body = $("primerBody"); body.replaceChildren();
  const ch = CHAPTERS.find(c => c.id === level.chapter);
  if (LEVELS.find(l => l.chapter === level.chapter) === level) { const c = document.createElement("p"); c.className = "cb-chapter"; c.textContent = `Chapter ${ch.id}, ${ch.title}: ${ch.about}`; body.append(c); }
  for (const t of level.primer) { const p = document.createElement("p"); p.textContent = t; body.append(p); }
  if (level.watch?.length) {
    const h = document.createElement("p"); h.className = "cb-watch-head"; h.textContent = "Watch out for"; body.append(h);
    const ul = document.createElement("ul"); ul.className = "cb-watch";
    for (const w of level.watch) { const li = document.createElement("li"); li.textContent = w; ul.append(li); }
    body.append(ul);
  }
  const how = document.createElement("p"); how.className = "cb-how";
  how.textContent = "Choose a part below and pick its layer: faint circles show where it would mesh. Tap an arbor to add it there, or tap near a wheel to set a new arbor in mesh. Drag your own arbors to move them; tap one to see how it turns or take a part off. Wind runs it. Workings shows the ratios step by step; Hint gives a nudge (and costs a star). Keys: 1–8 layers, W wind, Z undo, H hint, Delete removes, Esc lets go.";
  body.append(how);
  const all = progress(); all[level.id] = { ...(all[level.id] || {}), seen: true }; write(PROGRESS, all);
  if (!$("primerDlg").open) $("primerDlg").showModal();
}
function openGlossary() {
  $("primerTitle").textContent = "Glossary";
  const body = $("primerBody"); body.replaceChildren();
  for (const [term, def] of GLOSSARY) { const p = document.createElement("p"); p.innerHTML = `<b></b> `; p.querySelector("b").textContent = term; p.append(def); body.append(p); }
  if (!$("primerDlg").open) $("primerDlg").showModal();
}
function openCourse() {
  const body = $("courseBody"), all = progress(); body.replaceChildren();
  for (const ch of CHAPTERS) {
    const h = document.createElement("h3"); h.textContent = `${ch.id}. ${ch.title}`; body.append(h);
    const about = document.createElement("p"); about.className = "cb-ch-about"; about.textContent = ch.about; body.append(about);
    for (const L of LEVELS.filter(l => l.chapter === ch.id)) {
      const b = document.createElement("button"); b.type = "button"; b.className = `cb-level${L.id === level.id ? " here" : ""}`;
      const st = all[L.id]?.stars;
      b.innerHTML = `<span>${L.id} ${L.title}</span><span class="cb-stars">${st ? "★".repeat(st) + "☆".repeat(3 - st) : ""}</span>`;
      b.addEventListener("click", () => { $("courseDlg").close(); load(L.id); });
      body.append(b);
    }
  }
  $("courseDlg").showModal();
}
function openMenu() {
  const body = $("menuBody"); body.replaceChildren();
  part(body, "play").append(action("Start this level again", () => { $("menuDlg").close(); load(level.id); }, "primary"),
    action("Undo", () => { $("menuDlg").close(); undo(); }), action("How it works", () => { $("menuDlg").close(); openPrimer(); }),
    action("Glossary", () => { $("menuDlg").close(); openGlossary(); }));
  part(body, "content").append(choice("Speed", SPEEDS, read(SPEED, 60), v => write(SPEED, v)));
  part(body, "about").append(action("Show a solution", () => {
    $("menuDlg").close();
    stop(); design = solved(level); tray.forEach(t => { t.left = 0; }); chosen = null; render();
    toast("One way to do it. Others work too.");
  }), line(`${Object.values(progress()).filter(p => p.stars).length} of ${LEVELS.length} levels running.`));
  $("menuDlg").showModal();
}
function toast(t) { const e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => e.classList.remove("on"), 3200); }

// ---------- wiring ----------
document.querySelector(".cb-mark").innerHTML = APPS.find(a => a.id === "calibre")?.logo || "";
bindSwitcher($("appsBtn"), "calibre");
$("primerBtn").addEventListener("click", openPrimer);
$("hintBtn").addEventListener("click", () => {
  if (!level.hints.length) return;
  const t = level.hints[Math.min(hintAt, level.hints.length - 1)];
  hintAt = Math.min(hintAt + 1, level.hints.length);
  $("hint").hidden = false; $("hint").textContent = t; renderBrief();
});
$("workBtn").addEventListener("click", () => { showWork = !showWork; $("workBtn").textContent = showWork ? "Hide workings" : "Workings"; renderBrief(); });
$("undoBtn").addEventListener("click", undo);
document.addEventListener("keydown", e => {
  if (e.target.closest?.("input, textarea") || document.querySelector("dialog[open]")) return;
  if ((e.key === "z" || e.key === "Z") && !e.altKey) { e.preventDefault(); undo(); }
  else if (e.key >= "1" && e.key <= "8") { layer = +e.key; render(); }
  else if (e.key === "w" || e.key === "W" || e.key === " ") { e.preventDefault(); $("windBtn").click(); }
  else if (e.key === "h" || e.key === "H") $("hintBtn").click();
  else if (e.key === "Escape") { chosen = null; selected = null; render(); }
  else if (e.key === "Delete" || e.key === "Backspace") {
    const a = design.arbors.find(x => x.id === selected), i = a ? a.parts.map(p => !p.fixed).lastIndexOf(true) : -1;
    if (a && i >= 0) removePart(a, i);
  }
});
$("primerClose").addEventListener("click", () => $("primerDlg").close());
$("courseBtn").addEventListener("click", openCourse);
$("courseClose").addEventListener("click", () => $("courseDlg").close());
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
load(read(AT, null) || (LEVELS.find(l => !progress()[l.id]?.stars) || LEVELS[0]).id);
