// Slipway: a block of cubes to be cut into pieces, worked out from numbers on it (a cube's number is how many cubes its piece has) and
// a census of the kinds of piece. You paint pieces, a colour each, with a chisel (one cube), a saw (a whole layer) or a bore (a whole
// line); the block is done when every clue holds. The rules are slipway-rules.js's, the drawing slipway-view.js's; this file keeps the
// run and builds the page.
import { LEVELS, KIND_NAMES, KIND_NOTES, judge, reach, hint as nextStep, at, xyz } from "./slipway-rules.js";
import { drawCubes, faceAt, REST, PITCH } from "./slipway-view.js";
import { setSound, sound } from "./slipway-sound.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, isPaused } from "./menu.js";
import { sure } from "./sure.js";
import { IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
const RUN = "slipway:run", BEST = "slipway:best", SOUND = "slipway:sound";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
setSound(read(SOUND, true));

// one colour a piece; the first is for the first piece painted
const COLOURS = [[201, 84, 66], [226, 164, 48], [104, 160, 88], [66, 140, 178], [146, 98, 168], [206, 120, 150], [92, 170, 160], [160, 126, 86], [150, 150, 150]];
const BARE = [228, 218, 198];
const rgb = c => `rgb(${c.join(",")})`;

// ---------- the run ----------
// S: { v, level, paint (a digit per cube: 0 bare, else the piece's colour), ms, done }; bests by level id are { ms }
let S = read(RUN, null);
if (S && (S.v !== 4 || !LEVELS.some(l => l.id === S.level))) S = null;   // (the cut-list game's run is left behind)
const save = () => write(RUN, S);
let level = null;
let hint = null;                                   // the step a hint pointed at: { cells, text, paint }, until the next paint
let colour = 1, tool = "chisel", undo = [], view3d = true, layer = 0;
const N = () => level.n;
const paint = () => Uint8Array.from(S.paint, c => +c);
const keep = a => { S.paint = Array.from(a).join(""); };
const pieces = () => Object.values(level.census).reduce((a, b) => a + b, 0);

function newRun(id = LEVELS[0].id) {
  const lv = LEVELS.find(l => l.id === id);
  S = { v: 4, level: id, paint: "0".repeat(lv.n ** 3), ms: 0, done: false };
  save(); begin();
}
function begin() {
  level = LEVELS.find(l => l.id === S.level);
  undo = []; hint = null; colour = 1; layer = 0; view3d = true;
  buildPalette(); buildLayers(); buildRules();
  render();
}

// ---------- painting ----------
function put(axis, k) {
  if (!S || S.done) return;
  const now = paint(), cells = reach(N(), tool, axis, k);
  undo.push(S.paint); if (undo.length > 120) undo.shift();
  // painting again over a cut that is already this colour takes it off
  const wipe = cells.every(c => now[c] === colour);
  for (const c of cells) now[c] = wipe ? 0 : colour;
  keep(now); hint = null;
  sound(wipe ? "undo" : "tap");
  save(); render();
  if (judge(level, paint()).done) finish();
}
function undoLast() {
  if (S.done || !undo.length) return;
  S.paint = undo.pop(); hint = null; sound("undo"); save(); render();
}
async function clearAll() {
  if (S.done || !/[1-9]/.test(S.paint)) return;
  if (!(await sure("Wipe all the colours?"))) return;
  undo.push(S.paint); S.paint = "0".repeat(N() ** 3); hint = null; save(); render();
}

/** Points at the next step that can be worked out, and says why. */
function showHint() {
  if (!S || S.done) return;
  const h = nextStep(level, paint());
  if (!h) return;
  hint = h; sound("tap"); render();
}
/** Paints the piece a hint pointed at, in the first colour that is not in use (or the chosen one when none is free). */
function takeHint() {
  if (!hint?.paint) return;
  const now = paint(), used = new Set(now), pen = [...Array(pieces()).keys()].map(i => i + 1).find(c => !used.has(c)) || colour;
  undo.push(S.paint);
  for (const c of hint.paint) now[c] = pen;
  colour = pen; keep(now); hint = null; sound("tap"); save(); render();
  if (judge(level, paint()).done) finish();
}

// ---------- the end ----------
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function finish() {
  S.done = true;
  const best = read(BEST, {}), b = best[level.id];
  if (!b || S.ms < b.ms) { best[level.id] = { ms: S.ms }; write(BEST, best); }
  roundOver("slipway");
  sound("done");
  save(); render();
  setTimeout(showDone, 600);
}
function showDone() {
  if (!S?.done) return;
  const t = read(BEST, {})[level.id];
  $("doneHead").textContent = `${level.name}, cut`;
  $("doneBody").replaceChildren(el("p", "sw-facts", `Cut in ${clock(Math.round(S.ms / 1000))}.`), el("p", "sw-best", `Best: ${t ? clock(Math.round(t.ms / 1000)) : "–"}`),
    action("Again", () => { $("doneDlg").close(); newRun(level.id); }, "primary"));
  if (!$("doneDlg").open) $("doneDlg").showModal();
  requestAnimationFrame(() => drawCubes($("doneView"), cubesOf(false), { ...REST }, { n: N(), frame: false, margin: 8 }));
}

// ---------- the clues ----------
function buildRules() {
  const box = $("rules"), notes = el("div", "sw-notes");
  box.replaceChildren(el("p", "sw-lead", `Cut the block into pieces. A number on a cube says how many cubes its piece has. No piece has more than ${level.maxSize}. Paint a piece one colour; a colour is one piece, so its cubes must touch.`),
    el("ul", "sw-census"), notes);
  for (const k of Object.keys(KIND_NAMES)) if (level.census[k]) notes.append(el("p", "", KIND_NOTES[k]));
  box.scrollTop = 0;
}
function drawCensus(j) {
  const ul = $("rules").querySelector(".sw-census");
  ul.replaceChildren(...Object.keys(KIND_NAMES).filter(k => level.census[k] || j.have[k]).map(k => {
    const need = level.census[k] || 0, have = j.have[k] || 0, li = el("li", have === need ? "ok" : have > need ? "over" : "", `${need} ${KIND_NAMES[k][need === 1 ? 0 : 1]}`);
    li.append(el("small", "", `${have} cut`));
    return li;
  }));
}

// ---------- drawing ----------
const pose = { ...REST };
let hits = [];
function cubesOf(marks = true) {
  const n = N(), now = paint(), out = [], bad = new Set(marks ? judge(level, now).wrong : []);
  for (let k = 0; k < now.length; k++) {
    const [x, y, z] = xyz(n, k), c = { x, y, z, color: now[k] ? COLOURS[now[k] - 1] : BARE };
    if (level.gauge[k] != null) c.label = level.gauge[k];
    if (bad.has(k)) c.edge = "rgba(168,56,43,1)";
    if (marks && hint?.cells.includes(k)) { c.edge = "rgba(31,143,138,1)"; if (!now[k]) c.color = [150, 214, 208]; }
    out.push(c);
  }
  return out;
}
function drawAll() {
  if (!S || !level || !view3d) return;
  hits = drawCubes($("cube"), cubesOf(), pose, { n: N(), frame: true, margin: 10, frameColor: "rgba(140,130,110,.7)" });
}
function buildPalette() {
  const box = $("palette"); box.replaceChildren();
  for (let c = 1; c <= pieces(); c++) {
    const b = el("button", "sw-pen"); b.type = "button"; b.dataset.c = c; b.style.setProperty("--pen", rgb(COLOURS[c - 1]));
    b.setAttribute("aria-label", `Piece ${c}`); b.append(el("span", "", "0"));
    b.addEventListener("click", () => { colour = c; render(); });
    box.append(b);
  }
}
function buildLayers() {
  const n = N(), tabs = $("tabs"), grid = $("grid");
  grid.style.setProperty("--n", n);
  tabs.replaceChildren();
  for (let z = 0; z < n; z++) {
    const b = el("button", "btn sw-tab", String(z + 1)); b.type = "button"; b.setAttribute("role", "tab");
    b.setAttribute("aria-label", `Layer ${z + 1}${z === 0 ? ", the bottom" : z === n - 1 ? ", the top" : ""}`);
    b.addEventListener("click", () => { layer = z; render(); });
    tabs.append(b);
  }
  grid.replaceChildren();
  for (let y = n - 1; y >= 0; y--) for (let x = 0; x < n; x++) {   // the back row on top, the front at the bottom
    const b = el("button", "sw-sq"); b.type = "button"; b.dataset.x = x; b.dataset.y = y;
    b.append(el("span", "", ""));
    b.addEventListener("click", () => put(2, at(n, x, y, layer)));
    grid.append(b);
  }
}
function render() {
  if (!S || !level) return;
  const n = N(), now = paint(), j = judge(level, now);
  $("where").textContent = `${level.name} · ${n}×${n}×${n} · ${now.filter(Boolean).length} of ${n ** 3} cubes painted`;
  drawClock();
  $("cube").hidden = !view3d; $("layerView").hidden = view3d;
  $("viewBtn").textContent = view3d ? "Layers" : "Block";
  for (const b of document.querySelectorAll(".sw-tool")) b.classList.toggle("on", b.dataset.tool === tool);
  for (const b of $("palette").children) {
    const c = +b.dataset.c, size = now.filter(v => v === c).length;
    b.classList.toggle("on", c === colour); b.firstChild.textContent = size || "";
    b.classList.toggle("split", j.split.includes(c) || j.big.includes(c));
  }
  [...$("tabs").children].forEach((b, z) => { b.classList.toggle("on", z === layer); b.setAttribute("aria-selected", z === layer); });
  const bad = new Set(j.wrong);
  for (const b of $("grid").children) {
    const x = +b.dataset.x, y = +b.dataset.y, k = at(n, x, y, layer), v = now[k];
    b.style.background = rgb(v ? COLOURS[v - 1] : BARE);
    b.className = `sw-sq${bad.has(k) ? " slip" : ""}${hint?.cells.includes(k) ? " hint" : ""}`;
    b.firstChild.textContent = level.gauge[k] ?? "";
    b.setAttribute("aria-label", `Layer ${layer + 1}, left ${x + 1}, front ${y + 1}${level.gauge[k] != null ? `, number ${level.gauge[k]}` : ""}${v ? `, piece ${v}` : ", bare"}`);
  }
  drawCensus(j);
  drawHint();
  $("undoBtn").disabled = !undo.length || S.done;
  $("clearBtn").disabled = S.done; $("hintBtn").disabled = S.done;
  requestAnimationFrame(drawAll);
}
function drawHint() {
  let box = $("rules").querySelector(".sw-hint");
  if (!hint) { box?.remove(); return; }
  if (!box) { box = el("div", "sw-hint"); $("rules").prepend(box); }
  box.replaceChildren(el("p", "", hint.text));
  if (hint.paint) { const b = el("button", "btn", "Paint it"); b.type = "button"; b.addEventListener("click", takeHint); box.append(b); }
  $("rules").scrollTop = 0;
}
function drawClock() { $("clock").textContent = clock(Math.round(S.ms / 1000)); }

// ---------- the block by hand: drag to turn, tap a cube to paint, pinch or scroll to zoom (two fingers also slide it) ----------
let drag = null;
const cube = $("cube"), fingers = new Map();
const ZOOM = [0.3, 3];
const zoomBy = f => { pose.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], (pose.zoom || 1) * f)); if (pose.zoom <= 1) { pose.px *= 0.8; pose.py *= 0.8; } drawAll(); };
pose.zoom = 1; pose.px = 0; pose.py = 0;
cube.addEventListener("wheel", e => { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
cube.addEventListener("pointerdown", e => { cube.setPointerCapture(e.pointerId); fingers.set(e.pointerId, [e.clientX, e.clientY]); drag = fingers.size > 1 ? null : { x: e.clientX, y: e.clientY, moved: 0 }; });
cube.addEventListener("pointermove", e => {
  if (fingers.has(e.pointerId) && fingers.size === 2) {
    const [a, b] = [...fingers.values()], before = Math.hypot(a[0] - b[0], a[1] - b[1]), mid0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    fingers.set(e.pointerId, [e.clientX, e.clientY]);
    const [c, d] = [...fingers.values()], after = Math.hypot(c[0] - d[0], c[1] - d[1]);
    pose.px += (c[0] + d[0]) / 2 - mid0[0]; pose.py += (c[1] + d[1]) / 2 - mid0[1];
    if (before > 8) zoomBy(after / before); else drawAll();
    return;
  }
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, [e.clientX, e.clientY]);
  if (!drag) return;
  drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
  pose.yaw += (e.clientX - drag.x) * 0.012;
  pose.pitch = Math.max(-PITCH, Math.min(PITCH, pose.pitch + (e.clientY - drag.y) * 0.012));
  drag.x = e.clientX; drag.y = e.clientY;
  drawAll();
});
cube.addEventListener("pointerup", e => {
  const d = drag; drag = null; fingers.delete(e.pointerId);
  if (!d || d.moved > 6 || !S || S.done) return;
  const r = cube.getBoundingClientRect(), h = faceAt(hits, e.clientX - r.left, e.clientY - r.top);
  if (h) put(h.axis, at(N(), h.cube.x, h.cube.y, h.cube.z));
});
cube.addEventListener("pointercancel", e => { drag = null; fingers.delete(e.pointerId); });

// ---------- time ----------
let last = performance.now(), savedAt = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = now - last; last = now;
  if (!S || S.done || isPaused() || document.visibilityState !== "visible") return;
  S.ms += Math.min(dt, 250);
  const s = Math.round(S.ms / 1000);
  if (s !== savedAt) { savedAt = s; drawClock(); if (s % 5 === 0) save(); }
}

// ---------- the menu ----------
const started = () => !!S && !S.done && /[1-9]/.test(S.paint);
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("Start over", async () => { $("menuDlg").close(); if (started() && !(await sure("Start this block again? It isn't finished."))) return; newRun(level.id); }, "primary"));
  part(body, "settings").append(toggle("Sound", read(SOUND, true), v => { write(SOUND, v); setSound(v); }));
  const best = read(BEST, {});
  part(body, "about").append(line(`Best: ${LEVELS.map(l => `${l.name} ${best[l.id] ? clock(Math.round(best[l.id].ms / 1000)) : "–"}`).join(" · ")}`),
    line("A chisel paints one cube, a saw a whole layer, a bore a whole line. Tap a painted cut again to take the colour off."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".sw-mark").innerHTML = APPS.find(a => a.id === "slipway")?.logo || "";
bindSwitcher($("appsBtn"), "slipway");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
for (const b of document.querySelectorAll(".sw-tool")) b.addEventListener("click", () => { tool = b.dataset.tool; render(); });
$("viewBtn").addEventListener("click", () => { view3d = !view3d; render(); });
$("undoBtn").addEventListener("click", undoLast);
$("clearBtn").addEventListener("click", clearAll);
$("hintBtn").addEventListener("click", showHint);
new ResizeObserver(() => drawAll()).observe($("bench"));
window.addEventListener("resize", () => drawAll());
requestAnimationFrame(tick);
if (!S) newRun();
else if (S.done) { begin(); showDone(); }
else begin();

// for tests and debugging
window.__slipway = { get state() { return S; }, showHint, get hint() { return hint; }, get level() { return level; }, put, undoLast, newRun, get hits() { return hits; }, setTool: t => { tool = t; render(); }, setColour: c => { colour = c; render(); }, get view3d() { return view3d; } };
