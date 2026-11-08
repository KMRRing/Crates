// Slipway: a timber block to be cut down to a piece you are not shown. The cut list says, in a few rules, what to take away; you work
// out what is left, then cut it out with a chisel (one cube), a saw (a whole layer) or a bore (a whole line). A cut that would take
// part of the finished piece is refused and counts as a slip. The stars go for no hint asked, no slips and cuts near par. The rules
// are slipway-rules.js's, the drawing slipway-view.js's; this file keeps the run and builds the page.
import { LEVEL_IDS, dealCut, starsFor, reach, parOps, at, xyz } from "./slipway-rules.js";
import { drawCubes, faceAt, REST, PITCH } from "./slipway-view.js";
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
setSound(read(SOUND, true));

// ---------- the run ----------
// S: { v, seed, level, daily, day, cur (a string of 0 and 1 over the cells: what is still there), cuts, slips, hints, ms, done, stars }
let S = read(RUN, null);
if (S && S.v !== 3) S = null;                      // (the fitting game's run, and the carving's before it, are left behind)
const save = () => write(RUN, S);
const startLevel = () => ramp("slipway", LEVEL_IDS, { start: "easy" });
let deal = null;                                   // the cut list and the piece of this run: { n, steps, text, notes, target, par, chequer }
let tool = "chisel";
let undo = [];
let hint = null;                                   // the cells a hint pointed at, until the next cut
let slipped = new Set();                           // the cells a refused cut would have taken, shown red for a moment
let view3d = true;                                 // the block, or its layers
let layer = 0;
const N = () => deal.n;
const cur = () => Uint8Array.from(S.cur, c => +c);
const keep = a => { S.cur = Array.from(a).join(""); };

let dealing = false;
async function newRun(daily = false, replay = null) {
  if (dealing) return;
  dealing = true;
  const done = busy("Choosing the timber", { delay: 0 });
  try {
    const level = replay?.level || (daily ? "medium" : startLevel()), seed = replay?.seed ?? (daily ? today() * 7517 + 31 : Math.floor(Math.random() * 2 ** 31));
    await new Promise(r => setTimeout(r, 30));
    let s = seed, got = dealCut(s, level);
    while (!got) got = dealCut(++s, level);        // (a seed that gave nothing: the next)
    S = { v: 3, seed: s, level, daily: !!daily, day: daily ? today() : null, cur: "1".repeat(got.n ** 3), cuts: 0, slips: 0, hints: 0, ms: 0, done: false, stars: 0 };
    save(); begin();
  } finally { done(); dealing = false; }
}
function begin() {
  deal = dealCut(S.seed, S.level);
  undo = []; hint = null; slipped = new Set(); layer = 0; view3d = true;
  buildRules(); buildLayers();
  render();
}
const left = () => { const c = cur(), t = deal.target; let n = 0; for (let k = 0; k < c.length; k++) if (c[k] && !t[k]) n++; return n; };

// ---------- cutting ----------
/** Cuts with a tool at cube k along an axis (the way a bore runs, or the way a saw's layer is stacked). */
function cut(which, axis, k) {
  if (!S || S.done) return;
  const now = cur(), cells = reach(N(), which, axis, k).filter(j => now[j]);
  if (!cells.length) return;
  const spoil = cells.filter(j => deal.target[j]);
  if (spoil.length) {                               // not that: it would cut into the piece
    S.slips++;
    slipped = new Set(spoil);
    sound("refuse"); toast(spoil.length === 1 && cells.length === 1 ? "That cube is part of the piece" : "That cut would take part of the piece");
    save(); render();
    setTimeout(() => { slipped = new Set(); render(); }, 700);
    return;
  }
  undo.push(S.cur); if (undo.length > 80) undo.shift();
  for (const j of cells) now[j] = 0;
  keep(now); S.cuts++; hint = null;
  sound("fit");
  save(); render();
  if (!left()) finish();
}
function undoLast() {
  if (S.done || !undo.length) return;
  S.cur = undo.pop(); S.cuts = Math.max(0, S.cuts - 1); hint = null;
  sound("undo");
  save(); render();
}
/** Points at the next cut of the par way down, from where the timber stands now; it costs a star. */
function showHint() {
  if (S.done) return;
  const ops = parOps(N(), deal.target, cur());
  if (!ops.length) return;
  hint = { cells: new Set(ops[0].cells), tool: ops[0].tool };
  S.hints++;
  sound("tap");
  toast(`Try the ${ops[0].tool} where it shows`);
  save(); render();
}

// ---------- the end ----------
function finish() {
  S.done = true;
  S.stars = starsFor({ hints: S.hints, slips: S.slips, cuts: S.cuts, par: deal.par });
  const times = read(TIMES, {}), t = times[S.level];
  if (!t || S.stars > t.stars || (S.stars === t.stars && S.ms < t.ms)) { times[S.level] = { stars: S.stars, ms: S.ms }; write(TIMES, times); }
  write(BEST, LEVEL_IDS.reduce((a, l) => a + (times[l]?.stars || 0), 0));
  if (S.daily) { const d = read(DAILY, {}); if (!(d[S.day] >= S.stars)) { d[S.day] = S.stars; write(DAILY, d); } }
  else { startLevel(); if (S.stars === 3) ramp.won(true); else if (S.stars === 2) ramp.won(false); else ramp.lost(); }
  roundOver("slipway");
  sound("done");
  save(); render();
  setTimeout(showDone, 700);
}
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function showDone() {
  if (!S?.done) return;
  const times = read(TIMES, {}), body = $("doneBody");
  $("doneHead").textContent = "★".repeat(S.stars) + "☆".repeat(3 - S.stars);
  const facts = el("p", "sw-facts");
  const notes = [S.hints ? `${S.hints} hint${S.hints > 1 ? "s" : ""}` : "no hint", S.slips ? `${S.slips} slip${S.slips > 1 ? "s" : ""}` : "no slips"];
  facts.append(`Cut in ${S.cuts} (par ${deal.par}) and ${clock(Math.round(S.ms / 1000))}, with ${notes.join(" and ")}. `,
    el("small", "", S.stars < 3 ? "Three stars: no hint, no slips and at most one cut over par." : "Three stars."));
  const t = times[S.level];
  body.replaceChildren(facts, el("p", "sw-best", `Best at ${S.level}: ${t ? "★".repeat(t.stars) + " " + clock(Math.round(t.ms / 1000)) : "–"}`),
    action("Another timber", () => { $("doneDlg").close(); newRun(false); }, "primary"),
    action("Again, same timber", () => { $("doneDlg").close(); newRun(S.daily, { seed: S.seed, level: S.level }); }, "link"));
  if (!$("doneDlg").open) $("doneDlg").showModal();
  requestAnimationFrame(() => drawCubes($("doneView"), cubesOf(false), { ...REST }, { n: N(), frame: false, margin: 8 }));
}

// ---------- the cut list ----------
function buildRules() {
  const box = $("rules"), ol = el("ol", "sw-steps"), notes = el("div", "sw-notes");
  for (const t of deal.text) ol.append(el("li", "", t));
  for (const t of deal.notes) notes.append(el("p", "", t));
  box.replaceChildren(ol, notes);
  box.scrollTop = 0;
}

// ---------- drawing ----------
const pose = { ...REST };
let hits = [];
const WOOD = [199, 152, 93];
function cubesOf(marks = true) {
  const n = N(), now = cur(), out = [];
  for (let k = 0; k < now.length; k++) {
    if (!now[k]) continue;
    const [x, y, z] = xyz(n, k), dark = deal.chequer && (x + y + z) % 2 === 0;
    const c = { x, y, z, color: dark ? WOOD.map(v => Math.round(v * 0.8)) : WOOD };
    if (marks && hint?.cells.has(k)) { c.color = [31, 143, 138]; c.edge = "rgba(255,255,255,.9)"; }
    if (marks && slipped.has(k)) { c.color = [190, 60, 48]; c.edge = "rgba(255,255,255,.9)"; }
    out.push(c);
  }
  return out;
}
function drawAll() {
  if (!S || !deal || !view3d) return;
  hits = drawCubes($("cube"), cubesOf(), pose, { n: N(), frame: true, margin: 10, frameColor: "rgba(140,130,110,.7)" });
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
    b.append(el("span", "", `${x + 1}·${y + 1}`));
    b.addEventListener("click", () => cut(tool, 2, at(n, x, y, layer)));
    grid.append(b);
  }
}
function render() {
  if (!S || !deal) return;
  const n = N(), now = cur();
  $("where").textContent = `${S.level[0].toUpperCase()}${S.level.slice(1)} · ${n}×${n}×${n}${S.daily ? " · today's" : ""} · ${S.cuts} ${S.cuts === 1 ? "cut" : "cuts"}`;
  drawClock();
  $("cube").hidden = !view3d; $("layerView").hidden = view3d;
  $("viewBtn").textContent = view3d ? "Layers" : "Block";
  for (const b of document.querySelectorAll(".sw-tool")) b.classList.toggle("on", b.dataset.tool === tool);
  [...$("tabs").children].forEach((b, z) => { b.classList.toggle("on", z === layer); b.setAttribute("aria-selected", z === layer); });
  for (const b of $("grid").children) {
    const x = +b.dataset.x, y = +b.dataset.y, k = at(n, x, y, layer), there = now[k];
    b.className = `sw-sq${there ? "" : " gone"}${there && deal.chequer && (x + y + layer) % 2 === 0 ? " dark" : ""}${hint?.cells.has(k) ? " hint" : ""}${slipped.has(k) ? " slip" : ""}`;
    b.setAttribute("aria-label", `Layer ${layer + 1}, left ${x + 1}, front ${y + 1}${there ? "" : ", cut away"}`);
  }
  $("undoBtn").disabled = !undo.length || S.done;
  $("hintBtn").disabled = S.done;
  requestAnimationFrame(drawAll);
}
function drawClock() { $("clock").textContent = `${clock(Math.round(S.ms / 1000))}${S.slips ? ` · ${S.slips} ${S.slips === 1 ? "slip" : "slips"}` : ""}${S.hints ? ` · ${S.hints} ${S.hints === 1 ? "hint" : "hints"}` : ""}`; }

// ---------- the timber by hand: drag to turn, tap a face to cut ----------
let drag = null;
const cube = $("cube");
cube.addEventListener("pointerdown", e => { cube.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: 0 }; });
cube.addEventListener("pointermove", e => {
  if (!drag) return;
  drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
  pose.yaw += (e.clientX - drag.x) * 0.012;
  pose.pitch = Math.max(-PITCH, Math.min(PITCH, pose.pitch + (e.clientY - drag.y) * 0.012));
  drag.x = e.clientX; drag.y = e.clientY;
  drawAll();
});
cube.addEventListener("pointerup", e => {
  const d = drag; drag = null;
  if (!d || d.moved > 6 || !S || S.done) return;
  const r = cube.getBoundingClientRect(), h = faceAt(hits, e.clientX - r.left, e.clientY - r.top);
  if (h) cut(tool, h.axis, at(N(), h.cube.x, h.cube.y, h.cube.z));
});
cube.addEventListener("pointercancel", () => { drag = null; });

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
const started = () => !!S && !S.done && S.cuts > 0;
function openMenu() {
  const body = $("menuBody");
  startLevel();                                    // the shared level row follows this game's ramp
  body.replaceChildren();
  part(body, "play").append(action("New timber", async () => { $("menuDlg").close(); if (started() && !(await sure("Choose a new timber? This one isn't finished."))) return; newRun(false); }, "primary"));
  const got = read(DAILY, {})[today()];
  todayPart(body, {
    app: "slipway", done: got != null, result: got != null ? "★".repeat(got) : "",
    play: () => { $("menuDlg").close(); openToday(); }, playing: !!S?.daily && S.day === today() && !S.done, busy: started(),
  });
  const set = part(body, "settings");
  set.append(toggle("Sound", read(SOUND, true), v => { write(SOUND, v); setSound(v); }));
  const times = read(TIMES, {});
  part(body, "about").append(line(`Best: ${LEVEL_IDS.map(l => `${l} ${times[l] ? "★".repeat(times[l].stars) + " " + clock(Math.round(times[l].ms / 1000)) : "–"}`).join(" · ")}`),
    line("Work out from the cut list what is left, then cut it out. A chisel takes one cube, a saw a whole layer, a bore a whole line; a cut into the piece is refused."));
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
$("hintBtn").addEventListener("click", async () => { if (S && !S.done && await sure("Point at the next cut? It costs a star.")) showHint(); });
new ResizeObserver(() => drawAll()).observe($("bench"));
window.addEventListener("resize", () => drawAll());
requestAnimationFrame(tick);
async function openToday() {
  if (started() && !(S.daily && S.day === today()) && !(await sure("Start today's timber? This one isn't finished."))) return;
  if (S?.daily && S.day === today() && !S.done) return;
  newRun(true);
}
if (arrivedForToday() && !(S?.daily && S.day === today())) setTimeout(() => newRun(true), 0);
else if (!S) newRun(dailyDue("slipway"));
else if (S.done) { begin(); showDone(); }
else begin();

// for tests and debugging
window.__slipway = { get state() { return S; }, get deal() { return deal; }, cut, undoLast, showHint, newRun, get hits() { return hits; }, setTool: t => { tool = t; render(); }, get view3d() { return view3d; } };
