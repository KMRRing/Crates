// Harbour: plan every ship's program, then run them all at once, and deliver the cargoes as cheaply, quickly or
// compactly as you can. The rules are in harbour-engine.js, the program edits in harbour-tape.js and the levels in
// harbour-levels.js; this file draws the harbour and the programs, takes taps and drags, and runs the clock.
import { MOVES, LOAD, DISCHARGE, WAIT, grid, period, invalid, start, step, score, flatten, instructions, capOf } from "./harbour-engine.js";
import * as T from "./harbour-tape.js";
import { LEVELS } from "./harbour-levels.js";
import { dropdown } from "./dropdown.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, mirror } from "./menu.js";

const $ = id => document.getElementById(id);
const U = 10;                         // a tile, in the map's drawing units
const ROWS = 4;                       // program rows always shown, so nothing changes size as ships come and go
const SPEED = [420, 110];             // ms an hour takes: normal, fast
const HOLD = 450;                     // ms: holding a loop's count lowers it
const ANGLE = { E: 0, S: 90, W: 180, N: -90 };
const HULL = "M1.2 2.9H6.2C8.4 2.9 9.4 4 9.5 5C9.4 6 8.4 7.1 6.2 7.1H1.2Q.6 5 1.2 2.9Z";   // bow to the east
const MEASURES = [["cost", "Cost", v => `$${v}k`], ["hours", "Hours", v => `${v} h`], ["water", "Water", v => `${v} tiles`], ["instructions", "Instructions", v => `${v} instr`]];
const REPEAT = [380, 110];            // ms: holding a shift arrow repeats it, after a pause, this often
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const arrow = d => `<svg viewBox="0 0 16 16" aria-hidden="true"><path transform="rotate(${ANGLE[d] + 90} 8 8)" d="M8 13V3M3.8 7.2 8 3l4.2 4.2"/></svg>`;
const ICON = {
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  reset: svg('<path d="M6 5v14"/><path class="solid" d="M18 6 9 12l9 6z"/>'),
  step: svg('<path class="solid" d="M6 6l9 6-9 6z"/><path d="M18 5v14"/>'),
  play: svg('<path class="solid" d="M7 5l12 7-12 7z"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  pick: svg('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M11 4h2M11 20h2M4 11v2M20 11v2"/>'),
  earlier: svg('<path d="M14 6l-6 6 6 6"/>'),
  later: svg('<path d="M10 6l6 6-6 6"/>'),
};
const PAINT = [["N", "North"], ["E", "East"], ["S", "South"], ["W", "West"], [LOAD, "Load"], [DISCHARGE, "Discharge"], [WAIT, "Wait"]];
const ACTIONS = [["copy", "Copy", "Copy"], ["paste", "Paste", "Paste"], ["insert", "Insert empty hours", "Insert"],
  ["delete", "Delete these hours", "Delete"], ["loop", "Loop: play these hours twice (tap the count to raise it)", "Loop"],
  ["back", "Copy the way back: reversed, each move turned round", "Back"],
  ["earlier", "Shift an hour earlier in the loop", ICON.earlier], ["later", "Shift an hour later in the loop", ICON.later]];
const glyph = op => (MOVES[op] ? arrow(op) : op === WAIT ? "·" : op);
const opName = op => PAINT.find(t => t[0] === op)?.[1] || "nothing";

let L = null, G = null;               // the level and its grid
let sol = { ships: [] };              // what you've planned: each ship's start tile and program
let sim = null;                       // the run on screen, or null while you edit
let running = false, timer = 0, fast = false;
let sel = -1;                         // the selected ship (its row is highlighted)
let tool = "E", mode = "paint";       // painting instructions, or picking hours to act on
let pick = null;                      // picked hours: rows r0..r1, hours c0..c1, from the anchor (ar, ac); open: waiting for the far end
let clip = null;                      // copied hours, one list of items per row
let notice = "";                      // a message for the status line until the next change
let history = [];                     // earlier plans, for Undo
let facing = [];                      // which way each ship points (its last move), for drawing
let drag = null;                      // a ship being dragged: { i, from, moved }
let held = null;                      // a loop count being held down: { timer, fired }
let sweeping = false, swept = false;  // picking hours with a mouse drag (swept: the click that ends it is already handled)
let nudged = 0;                       // hours the picked rows have been shifted, for the status line
let repeat = { delay: 0, every: 0, at: 0 };   // a shift arrow being held

const solKey = () => `harbour:sol:${L.id}`, bestKey = () => `harbour:best:${L.id}`;
const rowsPicked = () => (pick ? [...Array(pick.r1 - pick.r0 + 1).keys()].map(k => pick.r0 + k).filter(r => sol.ships[r]) : []);

// ---------- the level ----------
function load(level) {
  stop();
  L = level; G = grid(L);
  write("harbour:level", L.id);
  const saved = read(solKey(), null);
  sol = saved?.ships && !invalid(L, saved) ? saved : { ships: [] };
  history = []; sel = -1; sim = null; pick = null; notice = "";
  $("brief").textContent = L.brief;
  drawSea();
  faceStart();
  render(true);
}

function drawSea() {
  const map = $("map"), parts = [`<rect class="hb-water" width="${G.w * U}" height="${G.h * U}"/>`];
  map.setAttribute("viewBox", `0 0 ${G.w * U} ${G.h * U}`);
  map.style.setProperty("--aspect", G.w / G.h);
  for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) {
    const k = G.at(x, y), X = x * U, Y = y * U;
    if (k === "land") { parts.push(`<rect class="hb-land" x="${X}" y="${Y}" width="${U}" height="${U}"/>`); continue; }
    parts.push(`<rect class="hb-cellwater" x="${X + .3}" y="${Y + .3}" width="${U - .6}" height="${U - .6}" rx="1.4"/>`);
    const j = G.jetty(x, y);
    if (!j) continue;
    // a jetty in its product's colour (the customer's in blue), lettered as on the map; a refinery's has its tank's gauge
    const gauge = j.tank ? `<rect class="hb-gauge-bg" x="${X + U - 2.5}" y="${Y + 2}" width="1.2" height="${U - 4}" rx=".6"/>`
      + `<rect class="hb-gauge" data-tank="${k}" data-top="${Y + 2}" data-full="${U - 4}" x="${X + U - 2.5}" y="${Y + U - 2}" width="1.2" height="0" rx=".6"/>` : "";
    parts.push(`<g class="hb-jetty ${j.kind === "load" ? `load pr-${j.product}` : "discharge"}"><rect x="${X + 1}" y="${Y + 1}" width="${U - 2}" height="${U - 2}" rx="1.6"/>`
      + `<text x="${X + U / 2 - (j.tank ? .7 : 0)}" y="${Y + U / 2 + 1.45}">${k}</text>${gauge}</g>`);
  }
  map.innerHTML = parts.join("") + `<g id="fleet"></g><g id="marks"></g>`;
}

// ---------- editing ----------
/** Every change to the plan goes through here: back to the start if a run is on screen, Undo can take it back, and it's saved. */
function edit(change) {
  if (sim) stop();
  history.push(JSON.stringify(sol));
  if (history.length > 100) history.shift();
  change();
  notice = "";
  write(solKey(), sol);
  faceStart();
  render(true);
}
function undo() {
  if (!history.length) return;
  if (sim) stop();
  sol = JSON.parse(history.pop());
  sel = Math.min(sel, sol.ships.length - 1);
  write(solKey(), sol);
  faceStart();
  render(true);
}
const faceStart = () => { facing = sol.ships.map(s => flatten(s.prog).find(op => MOVES[op]) || "E"); };

function paintCell(row, col) {
  const prog = sol.ships[row].prog, here = T.at(prog, col);
  sel = row;
  edit(() => { sol.ships[row].prog = T.paint(prog, col, here.op === tool ? null : tool); });   // the same instruction again clears it
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
  markPick(); fleet(); status(); toolbar();
}
function pickRow(row) {
  const r0 = pick?.open ? Math.min(pick.ar, row) : row, r1 = pick?.open ? Math.max(pick.ar, row) : row;
  const end = Math.max(1, ...sol.ships.slice(r0, r1 + 1).map(s => T.width(s.prog))) - 1;
  pick = { ar: r0, ac: 0, r0, r1, c0: 0, c1: end, open: false };
  sel = row; notice = ""; nudged = 0;
  markPick(); fleet(); status(); toolbar();
}
function setMode(m) {
  mode = m;
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

// the map: tap water to put a ship there, tap a ship to pick it, drag it to move it, onto land to scrap it
function tileAt(e) {
  const map = $("map"), pt = map.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(map.getScreenCTM().inverse());
  return { x: Math.floor(p.x / U), y: Math.floor(p.y / U), px: p.x, py: p.y };
}
const shipOn = (x, y) => sol.ships.findIndex(s => s.x === x && s.y === y);
function pointerDown(e) {
  if (sim) stop();
  const t = tileAt(e), i = shipOn(t.x, t.y);
  drag = { i, from: t, moved: false };
  if (i >= 0) $("map").setPointerCapture(e.pointerId);
}
function pointerMove(e) {
  if (!drag || drag.i < 0) return;
  const t = tileAt(e), el = $("fleet").children[drag.i];
  if (!drag.moved && (t.x !== drag.from.x || t.y !== drag.from.y)) drag.moved = true;
  if (!drag.moved) return;
  el.classList.add("dragging");
  el.classList.toggle("scrap", !G.afloat(t.x, t.y));
  el.style.transform = `translate(${t.px - U / 2}px, ${t.py - U / 2}px)`;
}
function pointerUp(e) {
  if (!drag) return;
  const d = drag, t = tileAt(e);
  drag = null;
  if (d.i >= 0 && d.moved) {
    if (!G.afloat(t.x, t.y)) edit(() => { sol.ships.splice(d.i, 1); sel = -1; pick = null; });
    else if (shipOn(t.x, t.y) < 0) edit(() => { Object.assign(sol.ships[d.i], { x: t.x, y: t.y }); sel = d.i; });
    else render(true);                                 // onto another ship: it goes back where it was
  } else if (d.i >= 0) { sel = sel === d.i ? -1 : d.i; render(true); }
  else if (G.afloat(t.x, t.y) && sol.ships.length < L.maxShips) edit(() => { sol.ships.push({ x: t.x, y: t.y, prog: [] }); sel = sol.ships.length - 1; });
  else { sel = -1; render(true); }
}

// ---------- the clock ----------
function stop() { running = false; clearTimeout(timer); sim = null; faceStart(); }
function begin() {
  if (sim) return true;
  const why = !sol.ships.length ? "Tap the water to put a ship there first." : invalid(L, sol);
  if (why) { notice = why; status(); return false; }
  sim = start(L, sol);
  return true;
}
const over = () => sim.done || sim.crash || sim.t >= L.maxCycles;
function tick() {
  const P = period(sol), t = sim.t;
  sim = step(L, sol, sim);
  if (!sim.crash) sol.ships.forEach((s, i) => { const op = T.at(s.prog, t % P).op; if (MOVES[op]) facing[i] = op; });
  if (over()) { running = false; if (sim.done) keepBests(); }
  render();
}
function play() {
  if (running) { running = false; clearTimeout(timer); render(); return; }
  if (!begin() || over()) return;
  running = true;
  const loop = () => { if (!running) return; tick(); if (running) timer = setTimeout(loop, SPEED[fast ? 1 : 0]); };
  loop();
}
function stepOnce() {
  running = false; clearTimeout(timer);
  if (begin() && !over()) tick();
}
const bests = () => { const b = read(bestKey(), {}); if (b.hire != null && b.cost == null) b.cost = b.hire; return b; };   // level 1's first bests said hire
function keepBests() {
  const sc = score(L, sol, sim), best = bests();
  for (const [k] of MEASURES) if (best[k] == null || sc[k] < best[k]) best[k] = sc[k];
  write(bestKey(), best);
}

// ---------- drawing ----------
function render(still = false) {
  const map = $("map");
  map.classList.toggle("still", still);
  map.style.setProperty("--hb-hour", `${Math.round(SPEED[fast ? 1 : 0] * .9)}ms`);
  fleet(); marks(); tanks(); tape(); toolbar(); controls(); status();
}

function tanks() {
  for (const el of $("map").querySelectorAll(".hb-gauge")) {
    const k = el.dataset.tank, t = L.jetties[k].tank, level = sim ? sim.tanks[k] : t.start || 0, h = +el.dataset.full * level / t.cap;
    el.setAttribute("height", h);
    el.setAttribute("y", +el.dataset.top + +el.dataset.full - h);
  }
}

function fleet() {
  const g = $("fleet"), ships = sim ? sim.ships : sol.ships;
  while (g.children.length > ships.length) g.lastChild.remove();
  while (g.children.length < ships.length) {
    const i = g.children.length, el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.setAttribute("class", "hb-ship");
    el.innerHTML = `<g><path class="hb-hull" d="${HULL}"/><rect class="hb-bridge" x="1.7" y="3.5" width="1.5" height="3" rx=".35"/><g class="hb-cargo"></g></g>`
      + `<text class="hb-num" x="5.9" y="6.1">${i + 1}</text>`;
    g.appendChild(el);
  }
  ships.forEach((p, i) => {
    const el = g.children[i];
    el.classList.remove("dragging", "scrap");
    el.style.transform = `translate(${p.x * U}px, ${p.y * U}px)`;
    el.firstChild.setAttribute("transform", `rotate(${ANGLE[facing[i]] ?? 0} 5 5)`);
    // the cargo as a bar along the deck, a stretch per product, as long as the share of the ship it fills
    let x = 3.6;
    el.querySelector(".hb-cargo").innerHTML = Object.entries(p.cargo || {}).filter(([, u]) => u > 0).map(([prod, u]) => {
      const w = 4.3 * u / capOf(L), r = `<rect class="hb-load pr-${prod}" x="${x}" y="4" width="${w}" height="2" rx=".4"/>`;
      x += w;
      return r;
    }).join("");
    el.classList.toggle("sel", i === sel && !sim);
    el.classList.toggle("hit", !!sim?.crash?.ships.includes(i));
  });
}

function marks() {
  const c = sim?.crash;
  $("marks").innerHTML = c ? `<circle class="hb-crash" cx="${c.at[0] * U + U / 2}" cy="${c.at[1] * U + U / 2}" r="4.7"/>` : "";
}

/** The programs: a row per ship, a column per hour. A loop's body is boxed, its later passes are faded, and the first of
 * them shows the count (tap: one more pass; hold, or right-click: one fewer). Hours past the loop's end are faded too. */
function tape() {
  const box = $("tape"), P = period(sol), widest = Math.max(0, ...sol.ships.map(s => T.width(s.prog)));
  const cols = Math.min(150, Math.max(16, widest + 6, P + 6));
  const now = sim && sim.t > 0 ? (sim.t - 1) % P : -1;
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
      html.push(`<button class="${cls}" type="button" data-row="${r}" data-col="${c}"${off} aria-label="${label}">${body}</button>`);
    }
  }
  box.innerHTML = html.join("") + "</div>";
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
  box.style.setProperty("--n", rest.length + 1);
  box.innerHTML = toggle + rest.join("");
}

function controls() {
  $("undoBtn").disabled = !history.length;
  $("runBtn").innerHTML = running ? ICON.pause : ICON.play;
  $("runBtn").setAttribute("aria-label", running ? "Pause" : "Run");
  $("runBtn").disabled = $("stepBtn").disabled = !!sim && over();
  $("speedBtn").textContent = fast ? "4×" : "1×";
}

function status() {
  const el = $("status"), n = sol.ships.length;
  let text, tone = "";
  if (notice) text = notice;
  else if (!sim && mode === "pick") {
    const w = pick ? pick.c1 - pick.c0 + 1 : 0, rows = rowsPicked().length;
    text = !pick ? "Tap an hour, then another to pick between."
      : pick.open ? "Tap another hour to pick between, or act now."
      : `${w} hour${w > 1 ? "s" : ""}${rows > 1 ? ` × ${rows} ships` : ""} picked`;
  } else if (!sim) text = !n ? "Tap the water to put a ship there."
    : sel >= 0 ? `Ship ${sel + 1}: drag it to move it, onto land to scrap it.`
    : `${n} ship${n > 1 ? "s" : ""} · loop ${period(sol)} h · ${instructions(sol)} instr · hire $${n * L.shipCost}k`;
  else if (sim.crash) {
    const [a, b] = sim.crash.ships; tone = "bad";
    text = sim.crash.kind === "aground" ? `Ship ${a + 1} ran aground in hour ${sim.crash.t}.` : `Ships ${a + 1} and ${b + 1} collided in hour ${sim.crash.t}.`;
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
  el.textContent = text;
  el.className = `hb-status${tone ? ` ${tone}` : ""}`;
}

function openMenu() {
  const best = bests();
  const rows = MEASURES.map(([k, name, f]) => `<tr><th>${name}</th><td>${best[k] != null ? f(best[k]) : "–"}</td><td>${f(L.par[k])}</td></tr>`).join("");
  // the menu: About (this level's bests against par), Settings (clear its ships)
  const body = $("menuBody");
  body.replaceChildren();
  const table = document.createElement("table");
  table.className = "hb-bests";
  table.innerHTML = `<thead><tr><th>${L.name}</th><th>Your best</th><th>Par</th></tr></thead><tbody>${rows}</tbody>`;
  part(body, "content").append(mirror("Level", $("level")));
  part(body, "settings").append(action("Clear this level's ships", () => edit(() => { sol.ships = []; sel = -1; pick = null; }), "link"));
  part(body, "about").append(table);
  $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "harbour");
document.querySelector(".hb-mark").innerHTML = APPS.find(a => a.id === "harbour").logo;
$("tools").addEventListener("click", e => {
  const b = e.target.closest(".hb-tool");
  if (!b || b.disabled) return;
  if (b.dataset.act === "mode") setMode(mode === "pick" ? "paint" : "pick");
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
tapeBox.addEventListener("pointerdown", e => {
  swept = false;
  const b = e.target.closest(".hb-cell");
  if (!b || b.disabled) return;
  if (b.classList.contains("lp-badge")) {            // holding a loop's count takes a pass away
    held = { fired: false, timer: setTimeout(() => { held.fired = true; count(+b.dataset.row, +b.dataset.col, -1); }, HOLD) };
  } else if (mode === "pick" && e.pointerType === "mouse") {
    if (sim) { stop(); render(true); }
    sweeping = swept = true;
    pickAt(+b.dataset.row, +b.dataset.col, e.shiftKey || !!pick?.open);   // like a tap: a second click picks between
    e.preventDefault();
  }
});
tapeBox.addEventListener("pointermove", e => {
  if (!sweeping) return;
  const b = document.elementFromPoint(e.clientX, e.clientY)?.closest(".hb-cell");
  if (b && !b.disabled) pickAt(+b.dataset.row, +b.dataset.col, true);
});
addEventListener("pointerup", () => { if (held) clearTimeout(held.timer); sweeping = false; });
tapeBox.addEventListener("contextmenu", e => {
  const b = e.target.closest(".lp-badge");
  if (b) { e.preventDefault(); if (held) { clearTimeout(held.timer); held.fired = true; } count(+b.dataset.row, +b.dataset.col, -1); }
});
tapeBox.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const row = +b.dataset.row, col = +b.dataset.col;
  if (b.classList.contains("lp-badge")) { if (!held?.fired) count(row, col, 1); held = null; return; }
  if (b.classList.contains("hb-lab")) {
    if (sim) stop();
    if (mode === "pick") pickRow(row); else { sel = sel === row ? -1 : row; render(true); }
    return;
  }
  if (mode === "paint") paintCell(row, col);
  else if (!swept) { if (sim) { stop(); render(true); } pickAt(row, col, pick?.open || e.shiftKey); }
});
const map = $("map");
map.addEventListener("pointerdown", pointerDown);
map.addEventListener("pointermove", pointerMove);
map.addEventListener("pointerup", pointerUp);
map.addEventListener("pointercancel", () => { drag = null; render(true); });
$("undoBtn").innerHTML = ICON.undo;
$("resetBtn").innerHTML = ICON.reset;
$("stepBtn").innerHTML = ICON.step;
$("undoBtn").addEventListener("click", undo);
$("resetBtn").addEventListener("click", () => { stop(); render(true); });
$("stepBtn").addEventListener("click", stepOnce);
$("runBtn").addEventListener("click", play);
$("speedBtn").addEventListener("click", () => { fast = !fast; render(); });
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("menuDlg").addEventListener("click", e => { if (e.target === $("menuDlg")) $("menuDlg").close(); });
// keys on a computer: Ctrl/Cmd with C, X, V, A and Z copy, cut, paste, pick everything and undo; Delete deletes the
// picked hours; Escape stops picking; space runs and pauses, S steps, R goes back to the start
addEventListener("keydown", e => {
  if ($("menuDlg").open || e.target.closest?.("input, textarea")) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === "z") { e.preventDefault(); undo(); }
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
  else if (k === "r" && !mod) { stop(); render(true); }
});

const levelSel = $("level");
levelSel.innerHTML = LEVELS.map((l, i) => `<option value="${l.id}">${i + 1} · ${l.name}</option>`).join("");
dropdown(levelSel);
levelSel.addEventListener("change", () => load(LEVELS.find(l => l.id === levelSel.value)));
const first = LEVELS.find(l => l.id === read("harbour:level", "")) || LEVELS[0];
levelSel.value = first.id;
load(first);
