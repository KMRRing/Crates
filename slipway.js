// Slipway: a block of cubes to be cut into pieces, worked out from numbers on it (a cube's number is how many cubes its piece has) and
// a census of the kinds of piece. The block starts whole; a chisel breaks one joint, a saw a whole plane of them, a bore a rod's
// worth, glue mends one. The pieces are the runs of cubes still joined, each its own colour, drifting apart a little as they come
// free. It is done when every clue holds. The rules are slipway-rules.js's, the drawing slipway-view.js's; this file keeps the run
// and builds the page.
import { LEVELS, KIND_NAMES, KIND_NOTES, judge, pieces, useTool, hint as nextStep, at, xyz } from "./slipway-rules.js";
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

// a colour a piece, by the order of its lowest cube; the wood of the uncut block is the first
const COLOURS = [[214, 176, 118], [201, 84, 66], [104, 160, 88], [66, 140, 178], [146, 98, 168], [226, 164, 48], [206, 120, 150], [92, 170, 160], [160, 126, 86], [150, 150, 150]];
const rgb = c => `rgb(${c.join(",")})`;
const DRIFT = 0.09;                                  // how far a piece moves from the middle of the block when it is cut free (in cubes)

// ---------- the run ----------
// S: { v, level, cuts (the broken joints, "a-b"), ms, done }; bests by level id are { ms }
let S = read(RUN, null);
if (S && (S.v !== 5 || !LEVELS.some(l => l.id === S.level))) S = null;   // (the painting run, and the cut-list game's before it, are left behind)
const save = () => write(RUN, S);
// Older games stored bests in other shapes (a bare number); anything but { id: { ms } } counts as none.
const bests = () => { const b = read(BEST, {}); return b && typeof b === "object" && !Array.isArray(b) ? b : {}; };
let level = null, hint = null;                       // hint: the step a hint pointed at, { cells, text, op }, until the next cut
let tool = "chisel", undo = [], view3d = true, layer = 0;
const N = () => level.n;
const cuts = () => new Set(S.cuts);
const firstUndone = () => (LEVELS.find(l => !bests()[l.id]) || LEVELS[0]).id;

function newRun(id = firstUndone()) {
  S = { v: 5, level: id, cuts: [], ms: 0, done: false };
  save(); begin();
}
function begin() {
  level = LEVELS.find(l => l.id === S.level);
  undo = []; hint = null; layer = 0; view3d = true;
  buildLayers(); buildRules();
  render();
}

// ---------- cutting ----------
function apply(op) {
  const now = cuts();
  for (const k of op.add) now.add(k);
  for (const k of op.remove) now.delete(k);
  undo.push(S.cuts); if (undo.length > 200) undo.shift();
  S.cuts = [...now]; hint = null;
  save(); render();
  if (judge(level, now).done) finish();
}
function use(axis, dir, k) {
  if (!S || S.done) return;
  const op = useTool(N(), tool, axis, dir, k, cuts());
  if (!op) { sound("refuse"); toast(tool === "glue" ? "Nothing cut there to mend" : "Nothing left to cut there"); return; }
  sound(tool === "glue" ? "undo" : "fit");
  apply(op);
}
function undoLast() {
  if (S.done || !undo.length) return;
  S.cuts = undo.pop(); hint = null; sound("undo"); save(); render();
}
/** Points at the next step that can be worked out, and says why. */
function showHint() {
  if (!S || S.done) return;
  const h = nextStep(level, cuts());
  if (!h) return;
  hint = h; sound("tap"); render();
}
function takeHint() {
  if (!hint) return;
  sound("fit"); apply(hint.op);
}

// ---------- the end ----------
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function finish() {
  S.done = true;
  const best = bests(), b = best[level.id];
  if (!b || S.ms < b.ms) { best[level.id] = { ms: S.ms }; write(BEST, best); }
  roundOver("slipway");
  sound("done");
  save(); render();
  setTimeout(showDone, 700);
}
function showDone() {
  if (!S?.done) return;
  const t = bests()[level.id], next = LEVELS[LEVELS.findIndex(l => l.id === level.id) + 1];
  $("doneHead").textContent = `${level.name}, cut`;
  $("doneBody").replaceChildren(el("p", "sw-facts", `Cut in ${clock(Math.round(S.ms / 1000))}.`), el("p", "sw-best", `Best: ${t ? clock(Math.round(t.ms / 1000)) : "–"}`),
    ...(next ? [action(`Next block: ${next.name}`, () => { $("doneDlg").close(); newRun(next.id); }, "primary")] : []),
    action("Again", () => { $("doneDlg").close(); newRun(level.id); }, next ? "link" : "primary"));
  if (!$("doneDlg").open) $("doneDlg").showModal();
  requestAnimationFrame(() => drawCubes($("doneView"), cubesOf(false), { ...REST }, { n: N(), frame: false, margin: 8 }));
}

// ---------- the clues ----------
function buildRules() {
  const box = $("rules"), notes = el("div", "sw-notes");
  box.replaceChildren(el("p", "sw-lead", `Cut the block into pieces. A number on a cube says how many cubes its piece has. No piece has more than ${level.maxSize}. Tap a face: a chisel breaks the first joint going in, a saw the whole plane, a bore the rod through that cube; glue mends a joint. A red outline means that piece is already smaller than its number: glue it back.`),
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
function drawHint() {
  let box = $("rules").querySelector(".sw-hint");
  if (!hint) { box?.remove(); return; }
  if (!box) { box = el("div", "sw-hint"); $("rules").prepend(box); }
  box.replaceChildren(el("p", "", hint.text));
  const b = el("button", "btn", hint.op.remove.length && !hint.op.add.length ? "Glue it" : "Cut it"); b.type = "button"; b.addEventListener("click", takeHint); box.append(b);
  $("rules").scrollTop = 0;
}

// ---------- drawing ----------
const pose = { ...REST, zoom: 1, px: 0, py: 0 };
let hits = [];
/** The cubes as drawn: a colour per piece, the pieces drifted a little apart once there is more than one. */
function cubesOf(marks = true) {
  const n = N(), ps = pieces(n, cuts()), mid = (n - 1) / 2, out = [];
  ps.forEach((p, i) => {
    const xs = p.map(k => xyz(n, k)), cen = [0, 1, 2].map(a => xs.reduce((t, c) => t + c[a], 0) / p.length - mid);
    const drift = ps.length > 1 ? DRIFT : 0;
    for (const k of p) {
      const [x, y, z] = xyz(n, k), c = { x, y, z, ox: cen[0] * drift, oy: cen[1] * drift, oz: cen[2] * drift, color: COLOURS[i % COLOURS.length] };
      if (level.gauge[k] != null) c.label = level.gauge[k];
      // red: cut too far, its piece is already smaller than its number (a piece still too big is just not cut yet, so it is not marked)
      if (marks && level.gauge[k] != null && p.length < level.gauge[k]) c.edge = "rgba(168,56,43,1)";
      if (marks && hint?.cells.includes(k)) c.edge = "rgba(31,143,138,1)";
      out.push(c);
    }
  });
  return out;
}
function drawAll() {
  if (!S || !level || !view3d) return;
  hits = drawCubes($("cube"), cubesOf(), pose, { n: N(), frame: S.cuts.length === 0, margin: 10, frameColor: "rgba(140,130,110,.7)" });
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
    b.addEventListener("click", () => use(2, 1, at(n, x, y, layer)));   // from above, going down
    grid.append(b);
  }
}
function render() {
  if (!S || !level) return;
  const n = N(), now = cuts(), j = judge(level, now);
  $("where").textContent = `${level.name} · ${n}×${n}×${n} · ${j.pieces.length} ${j.pieces.length === 1 ? "piece" : "pieces"}`;
  drawClock();
  $("cube").hidden = !view3d; $("layerView").hidden = view3d;
  $("viewBtn").textContent = view3d ? "Layers" : "Block";
  for (const b of document.querySelectorAll(".sw-tool")) b.classList.toggle("on", b.dataset.tool === tool);
  [...$("tabs").children].forEach((b, z) => { b.classList.toggle("on", z === layer); b.setAttribute("aria-selected", z === layer); });
  const pieceOf = new Map();
  j.pieces.forEach((p, i) => p.forEach(k => pieceOf.set(k, i)));
  for (const b of $("grid").children) {
    const x = +b.dataset.x, y = +b.dataset.y, k = at(n, x, y, layer);
    b.style.background = rgb(COLOURS[pieceOf.get(k) % COLOURS.length]);
    b.className = `sw-sq${level.gauge[k] != null && j.pieces[pieceOf.get(k)].length < level.gauge[k] ? " slip" : ""}${hint?.cells.includes(k) ? " hint" : ""}`;
    b.firstChild.textContent = level.gauge[k] ?? "";
    b.setAttribute("aria-label", `Layer ${layer + 1}, left ${x + 1}, front ${y + 1}${level.gauge[k] != null ? `, number ${level.gauge[k]}` : ""}, piece ${pieceOf.get(k) + 1}`);
  }
  drawCensus(j);
  drawHint();
  $("undoBtn").disabled = !undo.length || S.done;
  $("hintBtn").disabled = S.done;
  requestAnimationFrame(drawAll);
}
function drawClock() { $("clock").textContent = clock(Math.round(S.ms / 1000)); }

// ---------- the block by hand: drag to turn, tap a face to use the tool, pinch or scroll to zoom (two fingers also slide it) ----------
let drag = null;
const cube = $("cube"), fingers = new Map();
const ZOOM = [0.3, 3];
const zoomBy = f => { pose.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], pose.zoom * f)); if (pose.zoom <= 1) { pose.px *= 0.8; pose.py *= 0.8; } drawAll(); };
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
  if (h) use(h.axis, h.dir, at(N(), h.cube.x, h.cube.y, h.cube.z));
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

let toastTimer = 0;
function toast(text) { const t = $("toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 1600); }

// ---------- the menu ----------
const started = () => !!S && !S.done && S.cuts.length > 0;
function openMenu() {
  const body = $("menuBody"), best = bests();
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("Start over", async () => { $("menuDlg").close(); if (started() && !(await sure("Start this block again? It isn't finished."))) return; newRun(level.id); }, "primary"));
  for (const l of LEVELS) play.append(action(`${LEVELS.indexOf(l) + 1}. ${l.name}${best[l.id] ? `  ✓ ${clock(Math.round(best[l.id].ms / 1000))}` : ""}`, async () => {
    $("menuDlg").close();
    if (l.id !== level.id && started() && !(await sure("Leave this block? It isn't finished."))) return;
    if (l.id !== level.id || S.done) newRun(l.id);
  }, "link"));
  part(body, "settings").append(toggle("Sound", read(SOUND, true), v => { write(SOUND, v); setSound(v); }));
  part(body, "about").append(line("A chisel breaks the first whole joint going in from the face you tap, a saw the whole plane of joints, a bore the joints round the rod through that cube, glue mends the first broken joint. In Layers, a tap works from above, going down."));
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
$("hintBtn").addEventListener("click", showHint);
new ResizeObserver(() => drawAll()).observe($("bench"));
window.addEventListener("resize", () => drawAll());
requestAnimationFrame(tick);
if (!S) newRun();
else if (S.done) { begin(); showDone(); }
else begin();

// for tests and debugging
window.__slipway = { get state() { return S; }, get level() { return level; }, use, apply, undoLast, newRun, showHint, get hint() { return hint; }, get hits() { return hits; }, setTool: t => { tool = t; render(); }, get view3d() { return view3d; } };
