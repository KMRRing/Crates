// Harbour: plan every ship's program, then run them all at once, and deliver the cargoes as cheaply, quickly or
// compactly as you can. The rules are in harbour-engine.js and the levels in harbour-levels.js; this file draws the
// harbour and the programs, takes taps and drags, and runs the clock.
import { MOVES, LOAD, DISCHARGE, WAIT, grid, period, invalid, start, step, score } from "./harbour-engine.js";
import { LEVELS } from "./harbour-levels.js";
import { dropdown } from "./dropdown.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const U = 10;                         // a tile, in the map's drawing units
const ROWS = 4;                       // program rows always shown, so nothing changes size as ships come and go
const SPEED = [420, 110];             // ms an hour takes: normal, fast
const ANGLE = { E: 0, S: 90, W: 180, N: -90 };
const HULL = "M1.2 2.9H6.2C8.4 2.9 9.4 4 9.5 5C9.4 6 8.4 7.1 6.2 7.1H1.2Q.6 5 1.2 2.9Z";   // bow to the east
const MEASURES = [["hire", "Hire", v => `$${v}k`], ["hours", "Hours", v => `${v} h`], ["water", "Water", v => `${v} tiles`]];
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const svg = (body, cls = "") => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${body}</svg>`;
const arrow = d => `<svg viewBox="0 0 16 16" aria-hidden="true"><path transform="rotate(${ANGLE[d] + 90} 8 8)" d="M8 13V3M3.8 7.2 8 3l4.2 4.2"/></svg>`;
const ICON = {
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  reset: svg('<path d="M6 5v14"/><path class="solid" d="M18 6 9 12l9 6z"/>'),
  step: svg('<path class="solid" d="M6 6l9 6-9 6z"/><path d="M18 5v14"/>'),
  play: svg('<path class="solid" d="M7 5l12 7-12 7z"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
};
const TOOLS = [["N", "North"], ["E", "East"], ["S", "South"], ["W", "West"], [LOAD, "Load"], [DISCHARGE, "Discharge"],
  [WAIT, "Wait"], ["+", "Insert an hour (shifts the rest right)"], ["-", "Remove an hour (shifts the rest left)"]];
const glyph = op => (MOVES[op] ? arrow(op) : op === WAIT ? "·" : op === "-" ? "−" : op);
const opName = op => TOOLS.find(t => t[0] === op)?.[1] || "nothing";

let L = null, G = null;               // the level and its grid
let sol = { ships: [] };              // what you've planned: each ship's start tile and program
let sim = null;                       // the run on screen, or null while you edit
let running = false, timer = 0, fast = false;
let sel = -1, tool = "E";
let history = [];                     // earlier plans, for Undo
let facing = [];                      // which way each ship points (its last move), for drawing
let drag = null;                      // a ship being dragged: { i, from, moved }

const solKey = () => `harbour:sol:${L.id}`, bestKey = () => `harbour:best:${L.id}`;

// ---------- the level ----------
function load(level) {
  stop();
  L = level; G = grid(L);
  write("harbour:level", L.id);
  const saved = read(solKey(), null);
  sol = saved?.ships && !invalid(L, saved) ? saved : { ships: [] };
  history = []; sel = -1; sim = null;
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
    if (k === "load" || k === "discharge") parts.push(`<g class="hb-jetty ${k}"><rect x="${X + 1}" y="${Y + 1}" width="${U - 2}" height="${U - 2}" rx="1.6"/>`
      + `<text x="${X + U / 2}" y="${Y + U / 2 + 1.45}">${k === "load" ? LOAD : DISCHARGE}</text></g>`);
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
  for (const s of sol.ships) while (s.prog.length && !s.prog[s.prog.length - 1]) s.prog.pop();
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
function paint(row, col) {
  sel = row;
  edit(() => {
    const p = sol.ships[row].prog;
    while (p.length < col) p.push(null);
    if (tool === "+") p.splice(col, 0, null);
    else if (tool === "-") p.splice(col, 1);
    else p[col] = p[col] === tool ? null : tool;     // painting the same instruction again clears it
  });
}
const faceStart = () => { facing = sol.ships.map(s => s.prog.find(op => MOVES[op]) || "E"); };

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
    if (!G.afloat(t.x, t.y)) edit(() => { sol.ships.splice(d.i, 1); sel = -1; });
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
  if (why) { $("status").textContent = why; return false; }
  sim = start(L, sol);
  return true;
}
const over = () => sim.done || sim.crash || sim.t >= L.maxCycles;
function tick() {
  const P = period(sol), t = sim.t;
  sim = step(L, sol, sim);
  if (!sim.crash) sol.ships.forEach((s, i) => { if (MOVES[s.prog[t % P]]) facing[i] = s.prog[t % P]; });
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
function keepBests() {
  const sc = score(L, sol, sim), best = read(bestKey(), {});
  for (const [k] of MEASURES) if (best[k] == null || sc[k] < best[k]) best[k] = sc[k];
  write(bestKey(), best);
}

// ---------- drawing ----------
function render(still = false) {
  const map = $("map");
  map.classList.toggle("still", still);
  map.style.setProperty("--hb-hour", `${Math.round(SPEED[fast ? 1 : 0] * .9)}ms`);
  fleet(); marks(); tape(); controls(); status();
}

function fleet() {
  const g = $("fleet"), ships = sim ? sim.ships : sol.ships;
  while (g.children.length > ships.length) g.lastChild.remove();
  while (g.children.length < ships.length) {
    const i = g.children.length, el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.setAttribute("class", "hb-ship");
    el.innerHTML = `<g><path class="hb-hull" d="${HULL}"/><rect class="hb-bridge" x="1.7" y="3.5" width="1.5" height="3" rx=".35"/></g>`
      + `<text class="hb-num" x="5.9" y="6.1">${i + 1}</text>`;
    g.appendChild(el);
  }
  ships.forEach((p, i) => {
    const el = g.children[i];
    el.classList.remove("dragging", "scrap");
    el.style.transform = `translate(${p.x * U}px, ${p.y * U}px)`;
    el.firstChild.setAttribute("transform", `rotate(${ANGLE[facing[i]] ?? 0} 5 5)`);
    el.classList.toggle("laden", !!p.laden);
    el.classList.toggle("sel", i === sel && !sim);
    el.classList.toggle("hit", !!sim?.crash?.ships.includes(i));
  });
}

function marks() {
  const c = sim?.crash;
  $("marks").innerHTML = c ? `<circle class="hb-crash" cx="${c.at[0] * U + U / 2}" cy="${c.at[1] * U + U / 2}" r="4.7"/>` : "";
}

function tape() {
  const box = $("tape"), P = period(sol), cols = Math.min(99, Math.max(16, P + 6));
  const now = sim && sim.t > 0 ? (sim.t - 1) % P : -1;
  const html = [`<div class="hb-grid" style="--cols:${cols}"><span class="hb-corner"></span>`];
  for (let c = 0; c < cols; c++) html.push(`<span class="hb-colno">${c === 0 || (c + 1) % 5 === 0 ? c + 1 : ""}</span>`);
  for (let r = 0; r < ROWS; r++) {
    const ship = sol.ships[r], off = ship ? "" : " disabled";
    html.push(`<button class="hb-lab${r === sel ? " on" : ""}" type="button" data-row="${r}"${off} aria-label="Ship ${r + 1}">${ship ? r + 1 : ""}</button>`);
    for (let c = 0; c < cols; c++) {
      const op = ship?.prog[c] || null, cls = `hb-cell${op ? ` op-${op === WAIT ? "wait" : op}` : ""}${c >= P ? " out" : ""}${c === now && ship ? " now" : ""}`;
      html.push(`<button class="${cls}" type="button" data-row="${r}" data-col="${c}"${off} aria-label="Ship ${r + 1}, hour ${c + 1}: ${opName(op)}">${op ? glyph(op) : ""}</button>`);
    }
  }
  box.innerHTML = html.join("") + "</div>";
  if (now >= 0) {                                    // keep the hour being run in view
    const cell = box.querySelector(".hb-cell.now");
    const left = cell.offsetLeft - box.querySelector(".hb-lab").offsetWidth - 8, right = cell.offsetLeft + cell.offsetWidth + 8;
    if (left < box.scrollLeft) box.scrollLeft = left;
    else if (right > box.scrollLeft + box.clientWidth) box.scrollLeft = right - box.clientWidth;
  }
}

function controls() {
  $("tools").querySelectorAll(".hb-tool").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.op === tool)));
  $("undoBtn").disabled = !history.length;
  $("runBtn").innerHTML = running ? ICON.pause : ICON.play;
  $("runBtn").setAttribute("aria-label", running ? "Pause" : "Run");
  $("runBtn").disabled = $("stepBtn").disabled = !!sim && over();
  $("speedBtn").textContent = fast ? "4×" : "1×";
}

function status() {
  const el = $("status"), n = sol.ships.length;
  let text, tone = "";
  if (!sim) text = !n ? "Tap the water to put a ship there."
    : sel >= 0 ? `Ship ${sel + 1}: drag it to move it, onto land to scrap it.`
    : `${n} ship${n > 1 ? "s" : ""} · loop ${period(sol)} h · hire $${n * L.shipCost}k`;
  else if (sim.crash) {
    const [a, b] = sim.crash.ships; tone = "bad";
    text = sim.crash.kind === "aground" ? `Ship ${a + 1} ran aground in hour ${sim.crash.t}.` : `Ships ${a + 1} and ${b + 1} collided in hour ${sim.crash.t}.`;
  } else if (sim.done) {
    const sc = score(L, sol, sim), mark = k => (sc[k] <= L.par[k] ? " ★" : "");
    tone = "good";
    text = `Done · ${MEASURES.map(([k, , f]) => f(sc[k]) + mark(k)).join(" · ")}`;
  } else if (sim.t >= L.maxCycles) { tone = "bad"; text = `Not done after ${L.maxCycles} hours.`; }
  else text = `Hour ${sim.t} · ${sim.delivered} of ${L.target} delivered`;
  el.textContent = text;
  el.className = `hb-status${tone ? ` ${tone}` : ""}`;
}

function openMenu() {
  const best = read(bestKey(), {});
  const rows = MEASURES.map(([k, name, f]) => `<tr><th>${name}</th><td>${best[k] != null ? f(best[k]) : "–"}</td><td>${f(L.par[k])}</td></tr>`).join("");
  $("menuBody").innerHTML = `<h3>${L.name}</h3><table class="hb-bests"><thead><tr><th></th><th>Your best</th><th>Par</th></tr></thead>`
    + `<tbody>${rows}</tbody></table><button class="btn wide" type="button" id="clearBtn">Clear this level's ships</button>`;
  $("clearBtn").addEventListener("click", () => { edit(() => { sol.ships = []; sel = -1; }); $("menuDlg").close(); });
  $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "harbour");
document.querySelector(".hb-mark").innerHTML = APPS.find(a => a.id === "harbour").logo;
$("tools").innerHTML = TOOLS.map(([op, name]) =>
  `<button class="hb-tool op-${op === WAIT ? "wait" : op === "+" ? "ins" : op === "-" ? "del" : op}" type="button" data-op="${op}" aria-label="${name}">${glyph(op)}</button>`).join("");
$("tools").addEventListener("click", e => { const b = e.target.closest(".hb-tool"); if (b) { tool = b.dataset.op; controls(); } });
$("tape").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.classList.contains("hb-lab")) { if (sim) stop(); sel = sel === +b.dataset.row ? -1 : +b.dataset.row; render(true); }
  else paint(+b.dataset.row, +b.dataset.col);
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
// keys on a computer: space runs and pauses, S steps, R goes back to the start, Ctrl/Cmd+Z undoes
addEventListener("keydown", e => {
  if (document.activeElement !== document.body || $("menuDlg").open) return;
  if (e.key === " ") { e.preventDefault(); play(); }
  else if (e.key === "s") stepOnce();
  else if (e.key === "r") { stop(); render(true); }
  else if (e.key === "z" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
});

const levelSel = $("level");
levelSel.innerHTML = LEVELS.map((l, i) => `<option value="${l.id}">${i + 1} · ${l.name}</option>`).join("");
dropdown(levelSel);
levelSel.addEventListener("change", () => load(LEVELS.find(l => l.id === levelSel.value)));
const first = LEVELS.find(l => l.id === read("harbour:level", "")) || LEVELS[0];
levelSel.value = first.id;
load(first);
