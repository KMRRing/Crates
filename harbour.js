// Harbour: plan every ship's program, then run them all at once, and deliver the cargoes as cheaply, quickly or
// compactly as you can. The rules are in harbour-engine.js, the program edits in harbour-tape.js and the levels in
// harbour-levels.js; this file draws the harbour and the programs, takes taps and drags, and runs the clock.
import { steer, flatten, neighbour, ASTERN, LOAD, DISCHARGE, WAIT, CLASSES, moves, grid, period, invalid, start, step, score, instructions, classOf, typeOf } from "./harbour-engine.js";
import { sound } from "./harbour-sound.js";
import { createFlat, HULL, hullScale } from "./harbour-flat.js";
import * as T from "./harbour-tape.js";
import { LEVELS } from "./harbour-levels.js";
import { dropdown } from "./dropdown.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, mirror, onPause } from "./menu.js";

const $ = id => document.getElementById(id);
const ROWS = 4;                       // program rows always shown, so nothing changes size as ships come and go
const SPEED = [420, 110, 28];         // ms an hour takes: 1×, 4×, 16×
const SPEED_LABELS = ["1×", "4×", "16×"];
const HOLD = 450;                     // ms: holding a loop's count lowers it
const MEASURES = [["cost", "Cost", v => `$${v}k`], ["hours", "Hours", v => `${v} h`], ["water", "Water", v => `${v} tiles`], ["instructions", "Instructions", v => `${v} instr`]];
const REPEAT = [380, 110];            // ms: holding a shift arrow repeats it, after a pause, this often
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
// the steering, drawn as the ship sees it: ahead, a curve to port, a curve to starboard, astern
const STEERING = { A: "M8 13V3M3.8 7.2 8 3l4.2 4.2", P: "M11 13V9a4 4 0 0 0-4-4H4M6.6 2.4 4 5l2.6 2.6", S: "M5 13V9a4 4 0 0 1 4-4h3M9.4 2.4 12 5l-2.6 2.6", B: "M8 3v10M3.8 8.8 8 13l4.2-4.2" };
const arrow = op => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${STEERING[op]}"/></svg>`;
const ICON = {
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  reset: svg('<path d="M6 5v14"/><path class="solid" d="M18 6 9 12l9 6z"/>'),
  step: svg('<path class="solid" d="M6 6l9 6-9 6z"/><path d="M18 5v14"/>'),
  play: svg('<path class="solid" d="M7 5l12 7-12 7z"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  pen: svg('<path d="M4 20l4-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 6.5l3.5 3.5"/>'),
  pick: svg('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M11 4h2M11 20h2M4 11v2M20 11v2"/>'),
  earlier: svg('<path d="M14 6l-6 6 6 6"/>'),
  later: svg('<path d="M10 6l6 6-6 6"/>'),
};
const PAINT = [["A", "Ahead"], ["P", "Port: turn 60° left and on"], ["S", "Starboard: turn 60° right and on"], [ASTERN, "Astern: a hex back"],
  [LOAD, "Load"], [DISCHARGE, "Discharge"], [WAIT, "Wait"]];
const ACTIONS = [["copy", "Copy", "Copy"], ["paste", "Paste", "Paste"], ["insert", "Insert empty hours", "Insert"],
  ["delete", "Delete these hours", "Delete"], ["loop", "Loop: play these hours twice (tap the count to raise it)", "Loop"],
  ["back", "Copy the way back, once turned round: reversed, port and starboard swapped", "Back"],
  ["earlier", "Shift an hour earlier in the loop", ICON.earlier], ["later", "Shift an hour later in the loop", ICON.later]];
const glyph = op => (moves(op) ? arrow(op) : op === WAIT ? "·" : op);
const opName = op => PAINT.find(t => t[0] === op)?.[1] || "nothing";

let L = null, G = null;               // the level and its grid
let sol = { ships: [] };              // what you've planned: each ship's start tile and program
let sim = null;                       // the run on screen, or null while you edit
let running = false, timer = 0, speed = 0;
// The run so far, hour by hour: the engine never changes a state, so every hour played is kept, and the scrubber (or
// B, or tapping a crash) shows any of them again. seen: the latest hour played; the scrubber never goes past it.
let frames = [], seen = 0;
let sel = -1;                         // the selected ship (its row is highlighted)
let tool = "A", mode = "paint";       // painting instructions, or picking hours to act on
let pick = null;                      // picked hours: rows r0..r1, hours c0..c1, from the anchor (ar, ac); open: waiting for the far end
let clip = null;                      // copied hours, one list of items per row
let notice = "";                      // a message for the status line until the next change
let history = [];                     // earlier plans, for Undo
let future = [];                      // plans undone, for Redo
// Drawing a route: the pen in the tools makes a drag on the map draw the picked ship's route on from where its program
// leaves it, an hour a hex (Ahead, Port, Starboard or Astern, whichever reaches it), added to its program on release.
let drawMode = false, drawing = null;   // drawing: { i, ops, path } while a finger draws
sound.on = read("harbour:sound", true);
let drag = null;                      // a ship being dragged: { i, from, moved }
let held = null;                      // a loop count being held down: { timer, fired }
let sweeping = false, swept = false;  // picking hours with a mouse drag (swept: the click that ends it is already handled)
let nudged = 0;                       // hours the picked rows have been shifted, for the status line
let repeat = { delay: 0, every: 0, at: 0 };   // a shift arrow being held
let viewing = null;                   // a par plan on show in place of yours: { k (its measure), mine (your plan), history }
let shipType = null;                  // the class the next ship placed will be

// v2: the harbour went from squares to hexes, and plans and bests from before don't carry over; a level whose rules
// changed since carries a rev, and its plans and bests from before the change are left behind the same way
const levelKey = () => `${L.id}${L.rev ? `@${L.rev}` : ""}`;
const solKey = () => `harbour:v2:sol:${levelKey()}`, bestKey = () => `harbour:v2:best:${levelKey()}`;
const rowsPicked = () => (pick ? [...Array(pick.r1 - pick.r0 + 1).keys()].map(k => pick.r0 + k).filter(r => sol.ships[r]) : []);

// ---------- the level ----------
function load(level) {
  stop();
  L = level; G = grid(L);
  write("harbour:level", L.id);
  const saved = read(solKey(), null);
  sol = saved?.ships && !invalid(L, saved) ? saved : { ships: [] };
  history = []; future = []; sel = -1; sim = null; frames = []; seen = 0; pick = null; notice = ""; viewing = null; shipType = Object.keys(L.fleet)[0];
  $("brief").textContent = L.brief;
  banner();
  mapView.setLevel(L, G);
  render(true);
}

// A par plan, shown in place of yours to watch: run it, step it, pick and copy from it (and paste into yours), but not
// change it, and running it keeps no bests. Your plan waits, as you left it, until Back to your plan.
function view(k) {
  const plan = L.plans?.find(p => p.par.includes(k));
  if (!plan) return;
  stop();
  if (!viewing) viewing = { mine: sol, history };
  viewing.k = k;
  sol = JSON.parse(JSON.stringify({ ships: plan.ships }));
  history = []; sel = -1; pick = null; notice = "";
  banner();
  render(true);
}
function unview() {
  if (!viewing) return;
  stop();
  sol = viewing.mine; history = viewing.history; viewing = null;
  sel = -1; pick = null; notice = "";
  banner();
  render(true);
}
// the brief, or while a par plan is on show, which one it is and the way back
function banner() {
  $("brief").hidden = !!viewing;
  $("viewing").hidden = !viewing;
  if (!viewing) return;
  const [, name, f] = MEASURES.find(([k]) => k === viewing.k);
  $("viewingText").textContent = `The par plan for ${name.toLowerCase()}: ${f(L.par[viewing.k])}.`;
}

// ---------- editing ----------
/** Every change to the plan goes through here: back to the start if a run is on screen, Undo can take it back, and it's saved. */
function edit(change) {
  if (viewing) { notice = "This is the par plan, to watch. Back to your plan to change yours."; render(true); return; }
  if (sim) stop();
  history.push(JSON.stringify(sol));
  if (history.length > 100) history.shift();
  future = [];
  change();
  notice = "";
  write(solKey(), sol);
  render(true);
}
function undo() {
  if (!history.length || viewing) return;
  if (sim) stop();
  future.push(JSON.stringify(sol));
  sol = JSON.parse(history.pop());
  sel = Math.min(sel, sol.ships.length - 1);
  write(solKey(), sol);
  render(true);
}
function redo() {
  if (!future.length || viewing) return;
  if (sim) stop();
  history.push(JSON.stringify(sol));
  sol = JSON.parse(future.pop());
  sel = Math.min(sel, sol.ships.length - 1);
  write(solKey(), sol);
  render(true);
}

function paintCell(row, col) {
  const prog = sol.ships[row].prog, here = T.at(prog, col);
  sel = row;
  edit(() => { sol.ships[row].prog = T.paint(prog, col, here.op === tool ? null : tool); });   // the same instruction again clears it
}
/** Held (or right-clicked with a mouse), an instruction becomes a loop of its own: that hour, played twice. */
function loopHour(row, col) {
  const prog = sol.ships[row]?.prog, a = prog && T.at(prog, col);
  if (!a?.op) return;                                       // an empty hour stays as it is
  if (a.kind !== "op") { notice = "That hour is in a loop already: loops don't nest."; render(true); return; }
  sel = row;
  edit(() => { sol.ships[row].prog = T.loop(prog, col, col); });
}
function count(row, col, by) {
  const a = T.at(sol.ships[row].prog, col);
  if (a.kind !== "ghost") return;
  edit(() => { sol.ships[row].prog = T.setCount(sol.ships[row].prog, a.i, a.n + by); });
}

// picking: the first tap is one end, the next the other (or shift-click, or drag with a mouse); a row's number picks the row
function pickAt(row, col, extend) {
  if (extend && pick) pick = { ...pick, r0: Math.min(pick.ar, row), r1: Math.max(pick.ar, row), c0: Math.min(pick.ac, col), c1: Math.max(pick.ac, col), open: false };
  else pick = { ar: row, ac: col, r0: row, r1: row, c0: col, c1: col, open: true };
  sel = row; notice = ""; nudged = 0;
  markPick(); drawMap(true); status(); toolbar();
}
function pickRow(row) {
  const r0 = pick?.open ? Math.min(pick.ar, row) : row, r1 = pick?.open ? Math.max(pick.ar, row) : row;
  const end = Math.max(1, ...sol.ships.slice(r0, r1 + 1).map(s => T.width(s.prog))) - 1;
  pick = { ar: r0, ac: 0, r0, r1, c0: 0, c1: end, open: false };
  sel = row; notice = ""; nudged = 0;
  markPick(); drawMap(true); status(); toolbar();
}
function setMode(m) {
  mode = m;
  if (m === "pick") { drawMode = false; drawing = null; }
  if (m === "paint") pick = null;
  notice = "";
  render(true);
}

function act(name) {
  if (name === "paste") {
    if (!clip || !pick) return;
    const w = Math.max(...clip.map(T.width)), { r0, c0 } = pick, P = period(sol), r1 = Math.min(sol.ships.length - 1, r0 + clip.length - 1);
    let wrapped = false;
    edit(() => {
      clip.forEach((items, k) => {
        const s = sol.ships[r0 + k];
        if (!s) return;
        // a whole loop pasted into an empty row at hour h is the same loop, h hours later: a second ship on the route
        if (!s.prog.length && c0 > 0 && T.width(items) === P) {
          let p = items;
          for (let i = 0; i < c0 % P; i++) p = T.shift(p, P, true);
          s.prog = p; wrapped = true;
        } else s.prog = T.insert(s.prog, c0, items);
      });
      pick = wrapped ? { ar: r0, ac: 0, r0, r1, c0: 0, c1: P - 1, open: false } : { ar: r0, ac: c0, r0, r1, c0, c1: c0 + w - 1, open: false };
    });
    if (wrapped) { notice = `Pasted as the same loop, ${c0 % P} hour${c0 % P > 1 ? "s" : ""} later.`; status(); }
    return;
  }
  if (!pick) return;
  const rows = rowsPicked(), w = pick.c1 - pick.c0 + 1, { c0, c1 } = pick;
  if (name === "copy" || name === "back") {
    clip = rows.map(r => T.slice(sol.ships[r].prog, c0, c1));
    if (name === "back") clip = clip.map(T.backwards);
    notice = name === "back" ? "Way back copied: pick where it goes, then Paste." : `Copied ${w} hour${w > 1 ? "s" : ""}: pick where it goes, then Paste.`;
    status(); toolbar();
  } else if (name === "insert") {
    edit(() => rows.forEach(r => { sol.ships[r].prog = T.insert(sol.ships[r].prog, c0, Array(w).fill(null)); }));
  } else if (name === "delete") {
    edit(() => { rows.forEach(r => { sol.ships[r].prog = T.remove(sol.ships[r].prog, c0, c1); }); pick = { ...pick, c1: c0, ac: c0, open: false }; });
  } else if (name === "loop") {
    const looped = rows.map(r => T.loop(sol.ships[r].prog, c0, c1));
    if (looped.some(p => !p)) { notice = "A loop can't start or end inside another loop."; status(); return; }
    edit(() => { rows.forEach((r, k) => { sol.ships[r].prog = looped[k]; }); pick = { ...pick, c1: c0 + 2 * w - 1, open: false }; });   // body and its second pass
  } else if (name === "earlier" || name === "later") {
    const P = period(sol);
    edit(() => {
      rows.forEach(r => { sol.ships[r].prog = T.shift(sol.ships[r].prog, P, name === "later"); });
      // shifting can leave the longest row ending in empty hours; an explicit wait keeps the loop the length it was
      if (period(sol) < P) sol.ships[rows[0]].prog = T.paint(sol.ships[rows[0]].prog, P - 1, WAIT);
    });
    nudged += name === "later" ? 1 : -1;
    notice = nudged ? `Shifted ${Math.abs(nudged)} hour${Math.abs(nudged) > 1 ? "s" : ""} ${nudged > 0 ? "later" : "earlier"}.` : "";
    status();
  }
}

// the map: tap water to put a ship there, tap a ship to pick it and again to turn it, drag it to move it, onto land to
// scrap it. Which hex a tap is on is the view's to say (flat or 3D).
const shipOn = (x, y) => sol.ships.findIndex(s => s.x === x && s.y === y);
/** Where a ship's program leaves it: its start, played through every hour written. */
const endPose = s => flatten(s.prog).reduce((p, op) => steer(p, op || WAIT), { x: s.x, y: s.y, h: s.h ?? 0 });
function startDrawing(e) {
  const t = mapView.pick(e);
  if (!t) return;
  const at = shipOn(t.x, t.y), i = at >= 0 ? at : sel;
  if (i < 0) { notice = "Pick a ship first, then draw its route on from the dot at the end of its trail."; render(true); return; }
  sel = i;
  drawing = { i, ops: [], path: [endPose(sol.ships[i])] };
  $("sea").setPointerCapture(e.pointerId);
  render(true);
}
function extendDrawing(e) {
  const t = mapView.pick(e);
  if (!t) return;
  const path = drawing.path, cur = path[path.length - 1], prev = path[path.length - 2];
  if (t.x === cur.x && t.y === cur.y) return;
  if (prev && t.x === prev.x && t.y === prev.y) { path.pop(); drawing.ops.pop(); drawMap(true); status(); return; }   // back over the last hex: that step off
  const d = [0, 1, 2, 3, 4, 5].find(h => { const n = neighbour(cur.x, cur.y, h); return n.x === t.x && n.y === t.y; });
  if (d == null || !G.afloat(t.x, t.y)) return;
  const op = { 0: "A", 1: "P", 5: "S", 3: ASTERN }[(d - cur.h + 6) % 6];
  if (!op) return;                                    // a 120° turn: no single hour does that, so draw a smoother line
  drawing.ops.push(op);
  path.push(steer(cur, op));
  drawMap(true); status();
}
function finishDrawing() {
  const d = drawing;
  drawing = null;
  if (d.ops.length) edit(() => { sol.ships[d.i].prog = [...sol.ships[d.i].prog, ...d.ops]; });   // one edit: Undo takes the route back
  else render(true);
}
function pointerDown(e) {
  if (sim) stop();
  if (drawMode && !viewing) { startDrawing(e); return; }
  const t = mapView.pick(e);
  if (!t) return;
  const i = shipOn(t.x, t.y);
  drag = { i, from: t, moved: false };
  if (i >= 0) $("sea").setPointerCapture(e.pointerId);
}
function pointerMove(e) {
  if (drawing) { extendDrawing(e); return; }
  if (!drag || drag.i < 0 || viewing) return;                 // a par plan's ships stay where they are
  const t = mapView.pick(e);
  if (!t) return;
  if (!drag.moved && (t.x !== drag.from.x || t.y !== drag.from.y)) drag.moved = true;
  if (drag.moved) mapView.drag(drag.i, e, !G.afloat(t.x, t.y));
}
function pointerUp(e) {
  if (drawing) { finishDrawing(); return; }
  if (!drag) return;
  const d = drag, t = mapView.pick(e) || d.from;
  drag = null;
  mapView.release();
  if (d.i >= 0 && d.moved) {
    if (!G.afloat(t.x, t.y)) edit(() => { sol.ships.splice(d.i, 1); sel = -1; pick = null; });
    else if (shipOn(t.x, t.y) < 0) edit(() => { Object.assign(sol.ships[d.i], { x: t.x, y: t.y }); sel = d.i; });
    else render(true);                                 // onto another ship: it goes back where it was
  } else if (d.i >= 0 && sel === d.i) edit(() => { const s = sol.ships[d.i]; s.h = ((s.h ?? 0) + 5) % 6; });   // picked already: turn it to starboard
  else if (d.i >= 0) { sel = d.i; render(true); }
  else if (G.afloat(t.x, t.y)) {
    // a ship of the class picked in the fleet, or of whichever class still has one left
    const type = left(shipType) > 0 ? shipType : Object.keys(L.fleet).find(k => left(k) > 0);
    if (type) edit(() => { sol.ships.push({ x: t.x, y: t.y, h: 0, type, prog: [] }); sel = sol.ships.length - 1; shipType = type; });
    else { notice = "The whole fleet is out. Drag a ship onto land to scrap it."; sel = -1; render(true); }
  } else { sel = -1; render(true); }
}

// ---------- the clock ----------
function stop() { running = false; clearTimeout(timer); sim = null; frames = []; seen = 0; sound.sea(false); }
function begin() {
  if (sim) return true;
  const why = !sol.ships.length ? "Tap the water to put a ship there first." : invalid(L, sol);
  if (why) { notice = why; status(); return false; }
  sim = start(L, sol);
  frames = [sim]; seen = 0;
  notice = "";                                         // a run on screen speaks for itself
  return true;
}
const over = () => sim.done || sim.crash || sim.t >= L.maxCycles;
/** An hour's sounds: loads, deliveries, refusals, a ship leaving a berth, a crash, the plan done. */
function hear(before, after) {
  if (!sound.on) return;
  for (const ev of after.events) { if (ev.kind === "load") sound.pump(); else if (ev.kind === "discharge") sound.chime(); else if (ev.kind === "refused") sound.thud(); }
  if (after.ships.some((s, i) => G.jetty(before.ships[i].x, before.ships[i].y) && (s.x !== before.ships[i].x || s.y !== before.ships[i].y))) sound.horn();
  if (after.crash) sound.thud();
  if (after.done && !before.done) sound.done();
}
function tick() {
  const before = sim;
  sim = frames[sim.t + 1] || step(L, sol, sim);       // an hour already played (scrubbed back to) is the same hour again
  frames[sim.t] = sim;
  seen = Math.max(seen, sim.t);
  hear(before, sim);
  if (over()) { running = false; sound.sea(false); if (sim.done) keepBests(); }
  render();
}
// the menu stops a running harbour; it runs on when the menu closes
let heldRun = false;
onPause(() => { if (running) { running = false; clearTimeout(timer); sound.sea(false); heldRun = true; render(); } }, () => { if (heldRun) { heldRun = false; play(); } });
function play() {
  if (running) { running = false; clearTimeout(timer); sound.sea(false); render(); return; }
  if (!begin() || over()) return;
  running = true;
  sound.sea(true);
  const loop = () => { if (!running) return; tick(); if (running) timer = setTimeout(loop, SPEED[speed]); };
  loop();
}
/** Shows the run at hour h, one already played: back to any hour, forward again as far as you've seen. */
function scrubTo(h) {
  if (!sim) return;
  running = false; clearTimeout(timer);
  sim = frames[Math.max(0, Math.min(seen, h))];
  render();
}
function stepOnce() {
  running = false; clearTimeout(timer);
  if (begin() && !over()) tick();
}
const bests = () => { const b = read(bestKey(), {}); if (b.hire != null && b.cost == null) b.cost = b.hire; return b; };   // level 1's first bests said hire
function keepBests() {
  if (viewing) return;                                        // watching a par plan earns nothing
  const sc = score(L, sol, sim), best = bests();
  for (const [k] of MEASURES) if (best[k] == null || sc[k] < best[k]) best[k] = sc[k];
  write(bestKey(), best);
}

// ---------- drawing ----------
function render(still = false) {
  drawMap(still);
  classes(); tape(); toolbar(); controls(); status();
}
/** Each ship's route over one loop, from its start. A ship's moves are its own program's alone (ships never decide),
 *  so its route doesn't depend on any other ship: drawn while you plan, whether or not ships would meet. */
function trailsOf(plan = sol) {
  const P = period(plan);
  return plan.ships.map(s => {
    const ops = flatten(s.prog);
    let p = { x: s.x, y: s.y, h: s.h ?? 0 };
    const pts = [p];
    for (let t = 0; t < P; t++) { p = steer(p, ops[t] || WAIT); pts.push(p); }
    return pts;
  });
}
/** The map (flat or 3D): the ships as planned or as the run has them, the picked one, a crash, the tanks' levels. */
function drawMap(still) {
  // routes while you plan (a run speaks for itself); while a finger draws, the route so far; in draw mode a dot where
  // the picked ship's program leaves it, where its route goes on from
  const plan = drawing ? { ships: sol.ships.map((s, k) => (k === drawing.i ? { ...s, prog: [...s.prog, ...drawing.ops] } : s)) } : sol;
  mapView.trails(sim ? [] : trailsOf(plan), sel, drawMode && !sim);
  const tanks = {};
  for (const [k, j] of Object.entries(L.jetties)) if (j.tank) tanks[k] = sim ? sim.tanks[k] : j.tank.start || 0;
  mapView.draw({ ships: sim ? sim.ships : sol.ships.map(s => ({ ...s, type: typeOf(L, s) })), sel: sim ? -1 : sel, crash: sim?.crash || null,
    tanks, still, ms: Math.round(SPEED[speed] * .9) });
}

// the fleet: each class the level offers, what it holds and costs, and how many are left. With no ship picked, the class
// the next ship placed will be; with one picked, its class (tap another to swap it, if one's left)
const left = type => (L.fleet[type] || 0) - sol.ships.filter(s => typeOf(L, s) === type).length;
function classes() {
  const picked = sel >= 0 && sol.ships[sel] ? typeOf(L, sol.ships[sel]) : null;
  $("classes").innerHTML = Object.entries(L.fleet).map(([t, n]) => {
    const c = CLASSES[t], on = (picked || shipType) === t, k = left(t);
    return `<button type="button" class="hb-class${on ? " on" : ""}${k <= 0 ? " out" : ""}" data-type="${t}" aria-pressed="${on}"`
      + ` aria-label="${c.name}: holds ${c.cap}, hire $${c.cost}k, ${k} of ${n} left">`
      + `<svg viewBox="0 1.5 10 7" aria-hidden="true"><path class="hb-hull" d="${HULL}" transform="${hullScale(t)}"/></svg>`
      + `<b>${c.name}</b><span>${c.cap} · $${c.cost}k</span><i>×${k}</i></button>`;
  }).join("");
}

/** The programs: a row per ship, a column per hour. A loop's body is boxed, its later passes are faded, and the first of
 * them shows the count (tap: one more pass; hold, or right-click: one fewer). Hours past the loop's end are faded too. */
function tape() {
  const box = $("tape"), P = period(sol), widest = Math.max(0, ...sol.ships.map(s => T.width(s.prog)));
  const cols = Math.min(150, Math.max(16, widest + 6, P + 6));
  const now = sim && sim.t > 0 ? (sim.t - 1) % P : -1;
  const wreck = frames[seen]?.crash, wcol = wreck ? (wreck.t - 1) % P : -1;   // where the run ended in a crash
  const html = [`<div class="hb-grid" style="--cols:${cols}"><span class="hb-corner"></span>`];
  for (let c = 0; c < cols; c++) html.push(`<span class="hb-colno">${c === 0 || (c + 1) % 5 === 0 ? c + 1 : ""}</span>`);
  for (let r = 0; r < ROWS; r++) {
    const ship = sol.ships[r], off = ship ? "" : " disabled";
    html.push(`<button class="hb-lab${r === sel ? " on" : ""}" type="button" data-row="${r}"${off} aria-label="Ship ${r + 1}">${ship ? r + 1 : ""}</button>`);
    for (let c = 0; c < cols; c++) {
      const a = ship ? T.at(ship.prog, c) : { kind: "past", op: null };
      let cls = "hb-cell", body = a.op ? glyph(a.op) : "", label = `Ship ${r + 1}, hour ${c + 1}: ${opName(a.op)}`;
      if (a.badge) { cls += " lp-badge"; body = `×${a.n}`; label = `Ship ${r + 1}: these hours play ${a.n} times`; }
      else if (a.op) cls += ` op-${a.op === WAIT ? "wait" : a.op}`;
      if (a.kind === "body") cls += ` lp-in${a.b === 0 ? " lp-first" : ""}${a.b === a.len - 1 ? " lp-last" : ""}`;
      if (a.kind === "ghost" && !a.badge) cls += " lp-ghost";
      if (c >= P) cls += " out";
      if (c === now && ship) cls += " now";
      if (c === wcol && wreck.ships.includes(r)) cls += " wreck";
      html.push(`<button class="${cls}" type="button" data-row="${r}" data-col="${c}"${off} aria-label="${label}">${body}</button>`);
    }
  }
  const kept = box.scrollLeft;                        // rebuilt on every change: it stays where you'd scrolled it
  box.innerHTML = html.join("") + "</div>";
  box.scrollLeft = kept;
  markPick();
  if (now >= 0) {                                    // keep the hour being run in view
    const cell = box.querySelector(".hb-cell.now");
    const left = cell.offsetLeft - box.querySelector(".hb-lab").offsetWidth - 8, right = cell.offsetLeft + cell.offsetWidth + 8;
    if (left < box.scrollLeft) box.scrollLeft = left;
    else if (right > box.scrollLeft + box.clientWidth) box.scrollLeft = right - box.clientWidth;
  }
}
function markPick() {
  const on = mode === "pick" && pick;
  for (const l of $("tape").querySelectorAll(".hb-lab")) l.classList.toggle("on", +l.dataset.row === sel);
  for (const b of $("tape").querySelectorAll(".hb-cell")) {
    const r = +b.dataset.row, c = +b.dataset.col;
    b.classList.toggle("picked", !!on && r >= pick.r0 && r <= pick.r1 && c >= pick.c0 && c <= pick.c1);
    b.classList.toggle("anchor", !!on && pick.open && r === pick.ar && c === pick.ac);
  }
}

/** The tools: the instructions to paint with, or, while picking, what to do with the picked hours. Same size either way. */
function toolbar() {
  const box = $("tools"), picking = mode === "pick";
  const toggle = `<button class="hb-tool hb-picktool" type="button" data-act="mode" aria-pressed="${picking}" aria-label="Pick hours to copy, paste, loop or shift">${ICON.pick}</button>`;
  const rest = picking
    ? ACTIONS.map(([a, name, label]) => `<button class="hb-tool hb-act" type="button" data-act="${a}" aria-label="${name}"${(a === "paste" ? !clip || !pick : !pick) ? " disabled" : ""}>${label}</button>`)
    : PAINT.map(([op, name]) => `<button class="hb-tool op-${op === WAIT ? "wait" : op}" type="button" data-op="${op}" aria-label="${name}" aria-pressed="${op === tool}">${glyph(op)}</button>`);
  const pen = picking ? "" : `<button class="hb-tool hb-pentool" type="button" data-act="route" aria-pressed="${drawMode}" aria-label="Draw a route on the map">${ICON.pen}</button>`;
  box.style.setProperty("--n", rest.length + (picking ? 1 : 2));
  box.innerHTML = toggle + pen + rest.join("");
}

function controls() {
  $("undoBtn").disabled = !history.length;
  $("runBtn").innerHTML = running ? ICON.pause : ICON.play;
  $("runBtn").setAttribute("aria-label", running ? "Pause" : "Run");
  $("runBtn").disabled = $("stepBtn").disabled = !!sim && over();
  $("speedBtn").textContent = SPEED_LABELS[speed];
  $("redoBtn").disabled = !future.length;
  // the scrubber: the hours played so far, this one marked
  const sc = $("scrub");
  sc.disabled = !sim; sc.max = String(Math.max(1, seen)); sc.value = String(sim ? sim.t : 0);
}

const crashText = c => (c.kind === "aground" ? `Ship ${c.ships[0] + 1} ran aground in hour ${c.t}.` : `Ships ${c.ships[0] + 1} and ${c.ships[1] + 1} collided in hour ${c.t}.`);
function status() {
  const el = $("status"), n = sol.ships.length;
  let text, tone = "";
  if (notice) text = notice;
  else if (!sim && mode === "pick") {
    const w = pick ? pick.c1 - pick.c0 + 1 : 0, rows = rowsPicked().length;
    text = !pick ? "Tap an hour, then another to pick between."
      : pick.open ? "Tap another hour to pick between, or act now."
      : `${w} hour${w > 1 ? "s" : ""}${rows > 1 ? ` × ${rows} ships` : ""} picked`;
  } else if (!sim && drawMode) text = drawing ? `Ship ${drawing.i + 1}: ${drawing.ops.length} hour${drawing.ops.length === 1 ? "" : "s"} drawn`
    : sel >= 0 ? `Draw ship ${sel + 1}'s route on from the dot at the end of its trail.` : "Pick a ship, then draw its route on the map.";
  else if (!sim) text = !n ? "Tap the water to put a ship there."
    : sel >= 0 ? `Ship ${sel + 1}: tap to turn it, drag to move it, onto land to scrap it.`
    : `${n} ship${n > 1 ? "s" : ""} · loop ${period(sol)} h · ${instructions(sol)} instr · hire $${sol.ships.reduce((m, sh) => m + classOf(L, sh).cost, 0)}k`;
  else if (sim.crash) {
    tone = "bad";
    text = `${crashText(sim.crash)} Tap for the hour before.`;
  } else if (sim.done) {
    const sc = score(L, sol, sim), mark = k => (sc[k] <= L.par[k] ? " ★" : "");
    tone = "good";
    text = `Done · ${MEASURES.map(([k, , f]) => f(sc[k]) + mark(k)).join(" · ")}`;
  } else if (sim.t >= L.maxCycles) { tone = "bad"; text = `Not done after ${L.maxCycles} hours.`; }
  else {
    const no = sim.events.find(e => e.kind === "refused"), tank = Object.entries(sim.tanks)[0];
    if (no) { tone = "bad"; text = `Hour ${sim.t}: the jetty refused ship ${no.ship + 1}, ${no.why}.`; }
    else text = `Hour ${sim.t} · ${sim.delivered} of ${L.target} delivered${tank ? ` · tank ${tank[1]}/${L.jetties[tank[0]].tank.cap}` : ""}`;
  }
  const end = frames[seen]?.crash;
  // scrubbed back before a crash: what's coming, and when
  if (end && sim && !sim.crash) text += end.kind === "aground" ? ` · ship ${end.ships[0] + 1} runs aground in hour ${end.t}` : ` · ships ${end.ships[0] + 1} and ${end.ships[1] + 1} collide in hour ${end.t}`;
  el.textContent = text;
  el.className = `hb-status${tone ? ` ${tone}` : ""}${sim?.crash ? " back" : ""}`;
}

function openMenu() {
  const best = bests();
  const rows = MEASURES.map(([k, name, f]) => `<tr><th>${name}</th><td>${best[k] != null ? f(best[k]) : "–"}</td>`
    + `<td><button type="button" class="hb-par" data-k="${k}" aria-label="Watch the par plan for ${name.toLowerCase()}">${f(L.par[k])}</button></td></tr>`).join("");
  // the menu: About (this level's bests against par), Settings (clear its ships)
  const body = $("menuBody");
  body.replaceChildren();
  const table = document.createElement("table");
  table.className = "hb-bests";
  table.innerHTML = `<thead><tr><th>${L.name}</th><th>Your best</th><th>Par</th></tr></thead><tbody>${rows}</tbody>`;
  part(body, "content").append(mirror("Level", $("level")));
  part(body, "settings").append(action("Clear this level's ships", () => edit(() => { sol.ships = []; sel = -1; pick = null; }), "link"),
    action(sound.on ? "Sound off" : "Sound on", () => { sound.on = !sound.on; write("harbour:sound", sound.on); $("menuDlg").close(); }, "link"),
    action(mapView.flat ? "Draw the harbour in 3D" : "Draw the harbour flat", async () => {
      write("harbour:flat", !mapView.flat);
      $("menuDlg").close();
      await makeMap();
      mapView.setLevel(L, G);
      render(true);
    }, "link"));
  table.addEventListener("click", e => { const b = e.target.closest(".hb-par"); if (b) { $("menuDlg").close(); view(b.dataset.k); } });
  const note = document.createElement("p");
  note.className = "hb-note";
  note.textContent = "Tap a par to watch the plan that reaches it.";
  part(body, "about").append(table, note);
  $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "harbour");
document.querySelector(".hb-mark").innerHTML = APPS.find(a => a.id === "harbour").logo;
$("tools").addEventListener("click", e => {
  const b = e.target.closest(".hb-tool");
  if (!b || b.disabled) return;
  if (b.dataset.act === "mode") setMode(mode === "pick" ? "paint" : "pick");
  else if (b.dataset.act === "route") { drawMode = !drawMode; drawing = null; notice = ""; render(true); }
  else if ((b.dataset.act === "earlier" || b.dataset.act === "later") && performance.now() - repeat.at < 800) return;   // the press did it
  else if (b.dataset.act) act(b.dataset.act);
  else { tool = b.dataset.op; toolbar(); }
});
// a shift arrow acts as it's pressed and repeats while held, so shifting a ship many hours is one press
$("tools").addEventListener("pointerdown", e => {
  const b = e.target.closest(".hb-tool"), a = b?.dataset.act;
  if (!b || b.disabled || (a !== "earlier" && a !== "later")) return;
  repeat.at = performance.now();
  act(a);
  clearTimeout(repeat.delay); clearInterval(repeat.every);
  repeat.delay = setTimeout(() => { repeat.every = setInterval(() => { repeat.at = performance.now(); act(a); }, REPEAT[1]); }, REPEAT[0]);
});
const stopRepeat = () => { clearTimeout(repeat.delay); clearInterval(repeat.every); };
addEventListener("pointerup", stopRepeat);
addEventListener("pointercancel", stopRepeat);
const tapeBox = $("tape");
// on a computer, the wheel scrolls the programs sideways, the only way they go
tapeBox.addEventListener("wheel", e => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || tapeBox.scrollWidth <= tapeBox.clientWidth) return;
  tapeBox.scrollLeft += e.deltaY;
  e.preventDefault();
}, { passive: false });
// A hold that fired swallows the click (and an Android right-click) that ends it, for a moment only: the programs are
// redrawn when it fires, so the release can land on a button that's gone and never reach here to clear it.
const justHeld = () => !!held?.fired && performance.now() - held.at < 1000;
const fire = act => { held.fired = true; held.at = performance.now(); act(); };
tapeBox.addEventListener("pointerdown", e => {
  swept = false;
  if (held) { clearTimeout(held.timer); held = null; }     // a new press starts afresh
  const b = e.target.closest(".hb-cell");
  if (!b || b.disabled) return;
  const row = +b.dataset.row, col = +b.dataset.col;
  if (b.classList.contains("lp-badge")) {            // holding a loop's count takes a pass away
    held = { fired: false, x: e.clientX, y: e.clientY, timer: setTimeout(() => fire(() => count(row, col, -1)), HOLD) };
  } else if (e.pointerType !== "mouse" && b.classList.contains("hb-cell") && T.at(sol.ships[row]?.prog || [], col).op) {
    // holding an instruction (a finger; a mouse right-clicks) makes it a loop of its own
    held = { fired: false, x: e.clientX, y: e.clientY, timer: setTimeout(() => fire(() => loopHour(row, col)), HOLD) };
  } else if (mode === "pick" && e.pointerType === "mouse") {
    if (sim) { stop(); render(true); }
    sweeping = swept = true;
    pickAt(+b.dataset.row, +b.dataset.col, e.shiftKey || !!pick?.open);   // like a tap: a second click picks between
    e.preventDefault();
  }
});
tapeBox.addEventListener("pointermove", e => {
  // a finger that moves is scrolling the programs, not holding an hour
  if (held && !held.fired && Math.hypot(e.clientX - held.x, e.clientY - held.y) > 8) { clearTimeout(held.timer); held = null; }
  if (!sweeping) return;
  const b = document.elementFromPoint(e.clientX, e.clientY)?.closest(".hb-cell");
  if (b && !b.disabled) pickAt(+b.dataset.row, +b.dataset.col, true);
});
addEventListener("pointerup", () => { if (held) clearTimeout(held.timer); sweeping = false; });
tapeBox.addEventListener("pointercancel", () => { if (held && !held.fired) { clearTimeout(held.timer); held = null; } });
// a right-click does what holding does: a loop's count takes a pass away, an instruction becomes a loop of its own. A
// phone that sends one at the end of a long press (Android) finds the hold has already done it.
tapeBox.addEventListener("contextmenu", e => {
  const b = e.target.closest(".hb-cell");
  if (!b) return;
  e.preventDefault();
  if (justHeld()) return;
  if (held) clearTimeout(held.timer);
  held = {};
  fire(() => (b.classList.contains("lp-badge") ? count(+b.dataset.row, +b.dataset.col, -1) : loopHour(+b.dataset.row, +b.dataset.col)));
});
tapeBox.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const wasHeld = justHeld();
  held = null;
  if (wasHeld) return;                                // a hold did its work: the click that ends it does nothing more
  const row = +b.dataset.row, col = +b.dataset.col;
  if (b.classList.contains("lp-badge")) { count(row, col, 1); return; }
  if (b.classList.contains("hb-lab")) {
    if (sim) stop();
    if (mode === "pick") pickRow(row); else { sel = sel === row ? -1 : row; render(true); }
    return;
  }
  if (mode === "paint") paintCell(row, col);
  else if (!swept) { if (sim) { stop(); render(true); } pickAt(row, col, pick?.open || e.shiftKey); }
});
const seaBox = $("sea");
seaBox.addEventListener("pointerdown", pointerDown);
seaBox.addEventListener("pointermove", pointerMove);
seaBox.addEventListener("pointerup", pointerUp);
seaBox.addEventListener("pointercancel", () => { drag = null; drawing = null; mapView.release(); render(true); });
$("undoBtn").innerHTML = ICON.undo;
$("resetBtn").innerHTML = ICON.reset;
$("stepBtn").innerHTML = ICON.step;
$("undoBtn").addEventListener("click", undo);
$("resetBtn").addEventListener("click", () => { stop(); render(true); });
$("stepBtn").addEventListener("click", stepOnce);
$("runBtn").addEventListener("click", play);
$("speedBtn").addEventListener("click", () => { speed = (speed + 1) % SPEED.length; render(); });
$("redoBtn").innerHTML = ICON.redo;
$("redoBtn").addEventListener("click", redo);
$("scrub").addEventListener("input", e => scrubTo(+e.target.value));
// a crash on screen: tap the status line for the hour before it
$("status").addEventListener("click", () => { if (sim?.crash) scrubTo(sim.t - 1); });
$("menuBtn").addEventListener("click", openMenu);
$("mineBtn").addEventListener("click", unview);
$("classes").addEventListener("click", e => {
  const b = e.target.closest(".hb-class");
  if (!b) return;
  const t = b.dataset.type, ship = sel >= 0 ? sol.ships[sel] : null;
  if (!ship || typeOf(L, ship) === t) { shipType = t; render(true); return; }
  if (left(t) <= 0) { notice = `No ${CLASSES[t].name} left: the fleet has ${L.fleet[t]}.`; render(true); return; }
  edit(() => { ship.type = t; });
});
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("menuDlg").addEventListener("click", e => { if (e.target === $("menuDlg")) $("menuDlg").close(); });
// keys on a computer: Ctrl/Cmd with C, X, V, A and Z copy, cut, paste, pick everything and undo; Delete deletes the
// picked hours; Escape stops picking; space runs and pauses, S steps, R goes back to the start
addEventListener("keydown", e => {
  if ($("menuDlg").open || e.target.closest?.("input, textarea")) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (mod && k === "z") { e.preventDefault(); undo(); }
  else if (mod && k === "a") {
    e.preventDefault();
    if (!sol.ships.length) return;
    if (mode !== "pick") setMode("pick");
    pick = { ar: 0, ac: 0, r0: 0, r1: sol.ships.length - 1, c0: 0, c1: Math.max(1, ...sol.ships.map(s => T.width(s.prog))) - 1, open: false };
    render(true);
  } else if (mod && (k === "c" || k === "x") && pick) { e.preventDefault(); act("copy"); if (k === "x") act("delete"); }
  else if (mod && k === "v" && clip && pick) { e.preventDefault(); act("paste"); }
  else if ((e.key === "Delete" || e.key === "Backspace") && pick && mode === "pick") { e.preventDefault(); act("delete"); }
  else if (e.key === "Escape" && mode === "pick") setMode("paint");
  else if (document.activeElement !== document.body) return;   // a focused button takes space itself
  else if (e.key === " ") { e.preventDefault(); play(); }
  else if (k === "s" && !mod) stepOnce();
  else if (k === "b" && !mod && sim) scrubTo(sim.t - 1);
  else if (k === "r" && !mod) { stop(); render(true); }
});

const levelSel = $("level");
levelSel.innerHTML = LEVELS.map((l, i) => `<option value="${l.id}">${i + 1} · ${l.name}</option>`).join("");
dropdown(levelSel);
levelSel.addEventListener("change", () => load(LEVELS.find(l => l.id === levelSel.value)));
// the map: in 3D where the device can draw it and the player hasn't asked for it flat, flat otherwise
let mapView = null;
async function makeMap() {
  mapView?.dispose();
  mapView = null;
  if (!read("harbour:flat", false)) {
    try { mapView = (await import("./harbour-3d.js")).create3D($("sea")); }
    catch (err) { console.warn("Harbour: no 3D here, so the harbour is drawn flat.", err); }
  }
  mapView ||= createFlat($("sea"));
  $("sea").view = mapView;                                   // for the tests: where a hex is on screen
}
// the theme (Almanac, Modern, Kontor) and day or night re-skin the 3D harbour as they change
new MutationObserver(() => mapView?.theme()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => mapView?.theme());

const first = LEVELS.find(l => l.id === read("harbour:level", "")) || LEVELS[0];
levelSel.value = first.id;
await makeMap();
load(first);
