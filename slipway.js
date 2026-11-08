// Slipway: a timber cube cut into figures of three to five unit cubes, to be fitted back. Pick a figure from the tray, turn it
// (a quarter about x, y or z; never mirrored), tap a square in a layer to see where it would go and tap again (or Place) to fit
// it; tap a figure you fitted to take it out. Some figures are fitted for you, as many as make the rest go back one way; "Show
// one" fits another, and the stars go for fewest shown, then time. The rules are slipway-cut.js's, the drawing slipway-view.js's;
// this file keeps the run and builds the page.
import { LEVEL_IDS, dealCut, trayOf, starsFor, cellsAt, xyz, at, quarter, normal } from "./slipway-cut.js";
import { drawCubes, REST, PITCH, rgb } from "./slipway-view.js";
import { setSound, sound } from "./slipway-sound.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, todayPart, isPaused } from "./menu.js";
import { ramp } from "./ramp.js";
import { sure } from "./sure.js";
import { busy } from "./loading.js";
import { today, arrivedForToday, dailyDue, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
const RUN = "slipway:cut", BEST = "slipway:best", TIMES = "slipway:times", DAILY = "slipway:daily", SOUND = "slipway:sound";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
// the carving game's keys: nothing reads them now (its stars sit under slipway:best no longer, so that holds a plain number)
if (!IN_FRAME) for (const k of ["slipway:carve", "slipway:parts", "slipway:opts", "slipway:mode", "slipway:rand", "slipway:fit", "slipway:fitted"]) { try { localStorage.removeItem(k); } catch { /* none */ } }
setSound(read(SOUND, true));

// ---------- the run ----------
// S: { v, seed, level, daily, day, cut, placed: [{ kind, orient, at, cells, lock: "given" | "shown" | null }], hints, ms, done, stars }
let S = read(RUN, null);
if (S && S.v !== 2) S = null;
const save = () => write(RUN, S);
const startLevel = () => ramp("slipway", LEVEL_IDS, { start: "easy" });
let sel = null;                        // the figure in hand: { kind, orient } (orient: normal cells)
let tap = null;                        // the square last tapped: [x, y, z], where the ghost goes
let undo = [];
let colours = {};                      // kind → [r, g, b]
let order = [];                        // the kinds in tray order

let dealing = false;
async function newRun(daily = false, replay = null) {
  if (dealing) return;
  dealing = true;
  const done = busy("Cutting the timber", { delay: 0 });
  try {
    const level = replay?.level || (daily ? "medium" : startLevel()), seed = replay?.seed ?? (daily ? today() * 7517 + 31 : Math.floor(Math.random() * 2 ** 31));
    await new Promise(r => setTimeout(r, 30));       // let the wait mark show before the search
    let cut = dealCut(seed, level), s = seed;
    while (!cut) cut = dealCut(++s, level);          // (a seed that gave nothing: the next)
    S = { v: 2, seed, level, daily: !!daily, day: daily ? today() : null, cut, placed: [], hints: 0, ms: 0, done: false, stars: 0 };
    for (const id of cut.given) { const p = cut.pieces[id]; S.placed.push(pieceFrom(p, "given")); }
    save(); begin();
  } finally { done(); dealing = false; }
}
/** A solution figure as a figure fitted: its kind, standing, where it is. */
function pieceFrom(p, lock) {
  const cs = p.cells.map(k => xyz(S.cut.n, k)), orient = normal(cs), lo = [0, 1, 2].map(i => Math.min(...cs.map(c => c[i])));
  return { kind: p.kind, orient, at: lo, cells: p.cells.slice(), lock };
}
function begin() {
  const tray = trayOf(S.cut);
  order = tray.map(t => t.kind);
  const hues = ["--c0", "--c1", "--c2", "--c3"].map(v => rgb(getComputedStyle(document.documentElement).getPropertyValue(v) || "#888")), shade = [1, 0.72, 1.28];
  colours = {};
  order.forEach((k, i) => { const h = hues[i % hues.length], f = shade[((i / hues.length) | 0) % shade.length]; colours[k] = h.map(v => Math.round(Math.min(255, f > 1 ? v + (255 - v) * (f - 1) * 1.4 : v * f))); });
  sel = null; tap = null; undo = [];
  const free = left();
  const first = tray.find(t => (free.get(t.kind) || 0) > 0);
  if (first) pick(first.kind);
  buildLayers();
  render();
}
const N = () => S.cut.n;
/** How many of each kind are still to fit: Map kind → count. */
function left() {
  const m = new Map(Object.entries(S.cut.kinds));
  for (const p of S.placed) m.set(p.kind, m.get(p.kind) - 1);
  return m;
}
const taken = () => { const t = new Int16Array(N() ** 3).fill(-1); S.placed.forEach((p, i) => p.cells.forEach(k => { t[k] = i; })); return t; };

// ---------- the figure in hand and where it would go ----------
function pick(kind) {
  const t = trayOf(S.cut).find(x => x.kind === kind);
  if (!t || !(left().get(kind) > 0)) return;
  sel = { kind, orient: t.shape };
  tap = null;
  render();
}
function turnHand(axis) {
  if (!sel) return;
  sel.orient = quarter(sel.orient, axis);
  sound("tap");
  render();
}
/** Where the figure in hand would stand if its first square were put on the tapped one (pushed inside the cube if it hangs out). */
function ghost() {
  if (!sel || !tap) return null;
  const n = N(), o = sel.orient, pos = [0, 1, 2].map(i => tap[i] - o[0][i]);
  for (let i = 0; i < 3; i++) {
    const lo = Math.min(...o.map(c => c[i])), hi = Math.max(...o.map(c => c[i]));
    pos[i] = Math.max(-lo, Math.min(n - 1 - hi, pos[i]));
  }
  const cells = cellsAt(n, o, ...pos);
  if (!cells) return null;
  const t = taken();
  return { cells, at: pos, ok: cells.every(k => t[k] < 0) };
}
function fit() {
  const g = ghost();
  if (!g || !g.ok) { if (g) { sound("refuse"); toast("That doesn't fit there"); } return false; }
  push();
  S.placed.push({ kind: sel.kind, orient: sel.orient, at: g.at, cells: g.cells, lock: null });
  sound("fit");
  tap = null;
  if (!(left().get(sel.kind) > 0)) { const next = trayOf(S.cut).find(t => left().get(t.kind) > 0); sel = null; if (next) pick(next.kind); }
  afterChange();
  return true;
}
function takeOut(i) {
  const p = S.placed[i];
  if (!p || p.lock) { if (p) toast(p.lock === "given" ? "That one was fitted for you" : "That one was shown to you"); return; }
  push();
  S.placed.splice(i, 1);
  sel = { kind: p.kind, orient: p.orient };
  tap = p.at.map((v, j) => v + p.orient[0][j]);
  sound("undo");
  afterChange();
}
const push = () => { undo.push(JSON.stringify(S.placed)); if (undo.length > 60) undo.shift(); };
function undoLast() {
  if (S.done || !undo.length) return;
  S.placed = JSON.parse(undo.pop());
  tap = null;
  if (sel && !(left().get(sel.kind) > 0)) sel = null;
  if (!sel) { const next = trayOf(S.cut).find(t => left().get(t.kind) > 0); if (next) pick(next.kind); }
  sound("undo");
  afterChange(false);
}
function afterChange(check = true) {
  save();
  render();
  if (check && S.placed.reduce((a, p) => a + p.cells.length, 0) === N() ** 3) finish();
}

// ---------- showing one ----------
/** Fits one more of the solution's figures for you (taking out any of yours in its way), and counts it against the stars. */
function showOne() {
  if (S.done) return;
  const have = new Map(S.placed.map((p, i) => [p.cells.join(), i]));
  const cand = S.cut.pieces.filter(p => !have.has(p.cells.join()));
  if (!cand.length) return;
  // the one with most of your fitted figures not in its way first: showing it costs you least
  const mine = S.placed.map(p => new Set(p.cells));
  const cost = p => mine.reduce((a, m, i) => a + (S.placed[i].lock ? 0 : p.cells.some(k => m.has(k)) ? 1 : 0), 0);
  cand.sort((a, b) => cost(a) - cost(b) || b.cells.length - a.cells.length);
  const p = cand[0];
  push();
  const cells = new Set(p.cells);
  S.placed = S.placed.filter(q => q.lock || !q.cells.some(k => cells.has(k)));
  // if every one of its kind is out already, one of yours of that kind (wrongly placed) makes way
  const used = S.placed.filter(q => q.kind === p.kind).length;
  if (used >= S.cut.kinds[p.kind]) { const j = S.placed.findIndex(q => q.kind === p.kind && !q.lock); if (j >= 0) S.placed.splice(j, 1); }
  S.placed.push(pieceFrom(p, "shown"));
  S.hints++;
  sound("done");
  if (sel && !(left().get(sel.kind) > 0)) sel = null;
  if (!sel) { const next = trayOf(S.cut).find(t => left().get(t.kind) > 0); if (next) pick(next.kind); }
  tap = null;
  afterChange();
}

// ---------- the end ----------
function finish() {
  S.done = true;
  const secs = Math.round(S.ms / 1000);
  S.stars = starsFor(S.cut, S.hints, secs);
  const times = read(TIMES, {}), t = times[S.level];
  if (!t || S.stars > t.stars || (S.stars === t.stars && S.ms < t.ms)) { times[S.level] = { stars: S.stars, ms: S.ms }; write(TIMES, times); }
  write(BEST, LEVEL_IDS.reduce((a, l) => a + (times[l]?.stars || 0), 0));
  if (S.daily) { const d = read(DAILY, {}); if (!(d[S.day] >= S.stars)) { d[S.day] = S.stars; write(DAILY, d); } }
  else { startLevel(); if (S.stars === 3) ramp.won(true); else if (S.stars === 2) ramp.won(false); else ramp.lost(); }
  roundOver("slipway");
  sound("done");
  save();
  setTimeout(showDone, 700);
}
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function showDone() {
  if (!S?.done) return;
  const times = read(TIMES, {}), body = $("doneBody");
  $("doneHead").textContent = "★".repeat(S.stars) + "☆".repeat(3 - S.stars);
  const facts = el("p", "sw-facts");
  facts.append(`The cube is back together in ${clock(Math.round(S.ms / 1000))}, ${S.hints ? `with ${S.hints} figure${S.hints > 1 ? "s" : ""} shown` : "with no figure shown"}. `,
    el("small", "", S.stars < 3 ? (S.hints ? "Three stars: none shown, inside " : "Three stars: inside ") + clock(S.cut.par) + "." : "Par is " + clock(S.cut.par) + "."));
  const t = times[S.level];
  body.replaceChildren(facts, el("p", "sw-best", `Best at ${S.level}: ${t ? "★".repeat(t.stars) + " " + clock(Math.round(t.ms / 1000)) : "–"}`),
    action("Another timber", () => { $("doneDlg").close(); newRun(false); }, "primary"),
    action("Again, same timber", () => { $("doneDlg").close(); newRun(S.daily, { seed: S.seed, level: S.level }); }, "link"));
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

// ---------- drawing ----------
const pose = { ...REST };
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function cubesOf(extra) {
  const n = N(), out = [];
  // (figures of one kind keep one hue, a little lighter or darker each, so two side by side can be told apart)
  const seen = new Map();
  for (const p of S.placed) { const i = seen.get(p.kind) || 0; seen.set(p.kind, i + 1); const f = 1 + (i % 3 - 1) * 0.16, col = colours[p.kind].map(v => Math.max(0, Math.min(255, Math.round(v * f)))); for (const k of p.cells) { const [x, y, z] = xyz(n, k); out.push({ x, y, z, color: col, edge: p.lock ? "rgba(255,255,255,.55)" : undefined }); } }
  if (extra) for (const k of extra.cells) { const [x, y, z] = xyz(n, k); out.push({ x, y, z, color: extra.ok ? colours[sel.kind] : [190, 60, 48], alpha: 0.6, edge: "rgba(255,255,255,.9)" }); }
  return out;
}
function drawAll() {
  if (!S) return;
  const g = ghost();
  drawCubes($("cube"), cubesOf(g), pose, { n: N(), frame: true, margin: 10, frameColor: css("--ink-soft") ? "rgba(140,130,110,.7)" : undefined });
  if (sel) drawCubes($("hand"), sel.orient.map(c => ({ x: c[0], y: c[1], z: c[2], color: colours[sel.kind] })), { yaw: -0.62, pitch: 0.5 }, { margin: 4 });
  else $("hand").getContext("2d").clearRect(0, 0, $("hand").width, $("hand").height);
  for (const c of document.querySelectorAll(".sw-chip canvas")) {
    const t = trayOf(S.cut).find(x => x.kind === c.dataset.kind);
    if (t) drawCubes(c, t.shape.map(q => ({ x: q[0], y: q[1], z: q[2], color: colours[t.kind] })), { yaw: -0.62, pitch: 0.5 }, { margin: 3 });
  }
}
function buildLayers() {
  const n = N(), box = $("layers");
  box.style.setProperty("--n", n);
  box.replaceChildren();
  for (let z = 0; z < n; z++) {
    const layer = el("div", "sw-layer");
    layer.setAttribute("aria-label", `Layer ${z + 1}`);
    for (let y = n - 1; y >= 0; y--) for (let x = 0; x < n; x++) {
      const b = el("button", "sw-sq"); b.type = "button"; b.dataset.k = at(n, x, y, z);
      b.setAttribute("aria-label", `Layer ${z + 1}, column ${x + 1}, row ${y + 1}`);
      b.addEventListener("click", () => squareTap(x, y, z));
      layer.append(b);
    }
    box.append(layer);
  }
}
function squareTap(x, y, z) {
  if (!S || S.done) return;
  const t = taken(), k = at(N(), x, y, z);
  if (t[k] >= 0) { takeOut(t[k]); return; }
  if (!sel) return;
  const same = tap && tap[0] === x && tap[1] === y && tap[2] === z;
  tap = [x, y, z];
  if (same) { fit(); return; }
  sound("tap");
  render();
}
function render() {
  if (!S) return;
  const n = N(), g = ghost(), t = taken(), free = left();
  $("where").textContent = `${S.level[0].toUpperCase()}${S.level.slice(1)} · ${n}×${n}×${n}${S.daily ? " · today's" : ""} · ${S.placed.length}/${S.cut.pieces.length} fitted`;
  drawClock();
  const ghostCells = new Set(g?.cells || []);
  for (const b of document.querySelectorAll(".sw-sq")) {
    const k = +b.dataset.k, i = t[k];
    b.style.background = i >= 0 ? `rgb(${colours[S.placed[i].kind].join(",")})` : "";
    b.className = `sw-sq${i >= 0 ? (S.placed[i].lock ? " lock" : " fitted") : ""}${ghostCells.has(k) ? (g.ok ? " ghost" : " nope") : ""}`;
  }
  const tray = $("tray");
  tray.replaceChildren();
  for (const t of trayOf(S.cut)) {
    const c = free.get(t.kind) || 0, b = el("button", `sw-chip${sel?.kind === t.kind ? " on" : ""}`);
    b.type = "button"; b.disabled = c <= 0 || S.done;
    const cv = el("canvas"); cv.dataset.kind = t.kind;
    b.append(cv, el("small", "", `×${c}`));
    b.addEventListener("click", () => pick(t.kind));
    tray.append(b);
  }
  $("placeBtn").disabled = !(g && g.ok) || S.done;
  $("undoBtn").disabled = !undo.length || S.done;
  $("hintBtn").disabled = S.done;
  for (const b of document.querySelectorAll(".sw-turns .btn")) b.disabled = !sel || S.done;
  requestAnimationFrame(drawAll);
}
function drawClock() { $("clock").textContent = `${clock(Math.round(S.ms / 1000))}${S.hints ? ` · ${S.hints} shown` : ""}`; }

// ---------- turning the timber by hand ----------
let drag = null;
const cube = $("cube");
cube.addEventListener("pointerdown", e => { cube.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; });
cube.addEventListener("pointermove", e => {
  if (!drag) return;
  pose.yaw += (e.clientX - drag.x) * 0.012;
  pose.pitch = Math.max(-PITCH, Math.min(PITCH, pose.pitch + (e.clientY - drag.y) * 0.012));
  drag = { x: e.clientX, y: e.clientY };
  drawAll();
});
const letGo = () => { drag = null; };
cube.addEventListener("pointerup", letGo); cube.addEventListener("pointercancel", letGo);
cube.style.touchAction = "none";

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
function toast(text) { const t = $("toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 1800); }

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  startLevel();                                    // the shared level row follows this game's ramp
  body.replaceChildren();
  part(body, "play").append(action("New timber", async () => { $("menuDlg").close(); if (S && !S.done && S.placed.length > S.cut.given.length && !(await sure("Cut a new timber? This one isn't finished."))) return; newRun(false); }, "primary"));
  const got = read(DAILY, {})[today()];
  todayPart(body, {
    app: "slipway", done: got != null, result: got != null ? "★".repeat(got) : "",
    play: () => { $("menuDlg").close(); openToday(); }, playing: !!S?.daily && S.day === today() && !S.done, busy: !!S && !S.done && S.placed.length > S.cut.given.length,
  });
  const set = part(body, "settings");
  set.append(toggle("Sound", read(SOUND, true), v => { write(SOUND, v); setSound(v); }));
  const times = read(TIMES, {});
  part(body, "about").append(line(`Best: ${LEVEL_IDS.map(l => `${l} ${times[l] ? "★".repeat(times[l].stars) + " " + clock(Math.round(times[l].ms / 1000)) : "–"}`).join(" · ")}`),
    line("Cut a cube back into its figures. They turn any way but never flip over; drag the cube to look round it."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".sw-mark").innerHTML = APPS.find(a => a.id === "slipway")?.logo || "";
bindSwitcher($("appsBtn"), "slipway");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
for (const b of document.querySelectorAll(".sw-turns .btn")) b.addEventListener("click", () => turnHand(+b.dataset.axis));
$("placeBtn").addEventListener("click", fit);
$("undoBtn").addEventListener("click", undoLast);
$("hintBtn").addEventListener("click", async () => { if (S && !S.done && await sure("Fit one more figure for you? It costs a star.")) showOne(); });
new ResizeObserver(() => drawAll()).observe($("bench"));
window.addEventListener("resize", () => drawAll());
requestAnimationFrame(tick);
async function openToday() {
  if (S && !S.done && S.placed.length > S.cut.given.length && !(S.daily && S.day === today()) && !(await sure("Start today's timber? This one isn't finished."))) return;
  if (S?.daily && S.day === today() && !S.done) return;
  newRun(true);
}
if (arrivedForToday() && !(S?.daily && S.day === today())) setTimeout(() => newRun(true), 0);
else if (!S) newRun(dailyDue("slipway"));
else if (S.done) { begin(); showDone(); }
else begin();

// for tests and debugging
window.__slipway = { get state() { return S; }, get sel() { return sel; }, pick, turnHand, squareTap, fit, showOne, undoLast, newRun, takeOut, ghost, get tap() { return tap; } };
