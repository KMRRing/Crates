// Slipway: a block of cubes to be cut into pieces, worked out from numbers on it (a cube's number is how many cubes its piece has) and
// a census of the kinds of piece. The block starts whole, its cubes glued; a chisel breaks one joint, a saw a whole plane of them, a
// bore a row's worth, glue mends one. A broken joint shows as a slit, the joints a tap would change are outlined while you hover or
// press, and the ones it changed flash; the pieces are the runs of cubes still joined, each its own colour, drifting apart a little
// as they come free. It is done when every clue holds. The rules are slipway-rules.js's, the drawing slipway-view.js's; this file
// keeps the run and builds the page.
import { LEVELS, KIND_NAMES, KIND_NOTES, judge, pieces, useTool, hint as nextStep, at, xyz, toolsOf, newTool, jointCubes, joint, solidOf, extent, cubesOf as cubesOfLevel, chapterOf, chiselAllowance } from "./slipway-rules.js";
import { drawCubes, faceAt, REST, PITCH } from "./slipway-view.js";
import { setSound, sound } from "./slipway-sound.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, isPaused } from "./menu.js";
import { sure } from "./sure.js";
import { IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { levelOn } from "./playlog.js";

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
const KERF = 0.05;                                   // how far each side of a broken joint is pulled back, so it shows as a slit (in cubes)
const FLASH = 900;                                   // how long the joints a tap changed stay lit (ms)
// a cut in steel blue, glue in honey: the fill and outline of the joints a tap changes, lit after it and dashed before it
const INK = { cut: ["rgb(52,124,206)", "rgb(18,58,110)"], glue: ["rgb(236,178,58)", "rgb(128,80,8)"] };

// ---------- the run ----------
// S: { v, level, cuts (the broken joints, "a-b"), chisel (strokes spent), ms, done }; bests by level id are { ms }
let S = read(RUN, null);
if (S && (S.v !== 5 || !LEVELS.some(l => l.id === S.level))) S = null;   // (the painting run, and the cut-list game's before it, are left behind)
const save = () => write(RUN, S);
// Older games stored bests in other shapes (a bare number); anything but { id: { ms } } counts as none.
const bests = () => { const b = read(BEST, {}); return b && typeof b === "object" && !Array.isArray(b) ? b : {}; };
let level = null, hint = null;                       // hint: the step a hint pointed at, { cells, text, op }, until the next cut
let tool = "chisel", undo = [];
let peek = null, flash = null;                       // peek: what a tap on the face under the pointer would do, { face, op }; flash: { op, t0 }
const N = () => level.n;
const whole = () => level.sol.every(v => v >= 0);                   // the old cube, not a shape inside its box
/** The middle of the timber (the pieces drift apart from it). */
const middleOf = () => { const P = cubesOfLevel(level).map(k => xyz(N(), k)); return [0, 1, 2].map(i => (Math.min(...P.map(p => p[i])) + Math.max(...P.map(p => p[i]))) / 2); };
const cuts = () => new Set(S.cuts);
const firstUndone = () => (LEVELS.find(l => !bests()[l.id]) || LEVELS[0]).id;

function newRun(id = firstUndone()) {
  S = { v: 5, level: id, cuts: [], chisel: 0, ms: 0, done: false };
  save(); begin();
}
function begin() {
  level = LEVELS.find(l => l.id === S.level);
  levelOn("slipway", level.id, `${LEVELS.indexOf(level) + 1} · ${level.name}`);     // each block its own line in the play log, to be rated
  undo = []; hint = null; peek = null; flash = null;
  const offered = toolsOf(level);
  tool = newTool(level) ?? (offered.includes(tool) ? tool : offered[0]);
  for (const b of document.querySelectorAll(".sw-tool")) b.hidden = !offered.includes(b.dataset.tool);
  $("tools").style.setProperty("--tools", offered.length);
  buildRules();
  render();
}

// ---------- cutting ----------
function apply(op) {
  const now = cuts();
  for (const k of op.add) now.add(k);
  for (const k of op.remove) now.delete(k);
  undo.push({ cuts: S.cuts, chisel: S.chisel || 0 }); if (undo.length > 200) undo.shift();
  S.cuts = [...now]; hint = null; peek = null;
  flash = { op, t0: performance.now() };
  save(); render();
  if (judge(level, now).done) finish();
}
/** The chisel strokes still to spend on this block (Infinity where only the chisel is offered). */
const chiselLeft = () => chiselAllowance(level) - (S.chisel || 0);
function use(axis, dir, k, side) {
  if (!S || S.done) return;
  if (tool === "chisel" && chiselLeft() <= 0) { sound("refuse"); toast("The chisel is spent: saw, bore, or undo a stroke"); return; }
  const op = useTool(level, tool, axis, dir, k, cuts(), side);
  if (!op) { sound("refuse"); toast(tool === "glue" ? "No cut there to mend" : tool === "chisel" ? "That seam is cut already, or is no joint" : "Nothing left to cut there"); return; }
  sound(tool === "glue" ? "undo" : "fit");
  apply(op);
  if (tool === "chisel") { S.chisel = (S.chisel || 0) + 1; save(); render(); }
}
function undoLast() {
  if (S.done || !undo.length) return;
  const u = undo.pop();
  S.cuts = u.cuts; S.chisel = u.chisel; hint = null; peek = null; flash = null; sound("undo"); save(); render();
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
  requestAnimationFrame(() => drawCubes($("doneView"), cubesOf(false), { ...REST }, { n: whole() ? N() : 0, frame: false, margin: 8 }));
}

// ---------- the clues ----------
function buildRules() {
  const box = $("rules"), notes = el("div", "sw-notes");
  const lead = el("p", "sw-lead");
  if (level.rule) lead.append(el("b", "sw-rule", level.rule), " ");
  lead.append(`A number says how many cubes its piece has; no piece has more than ${level.maxSize}. A red edge marks a piece cut smaller than its number.`);
  box.replaceChildren(lead,
    el("ul", "sw-census"), notes);
  for (const k of Object.keys(KIND_NAMES)) if (level.census[k]) notes.append(el("p", "", KIND_NOTES[k]));
  box.scrollTop = 0;
}
function drawCensus(j) {
  const ul = $("rules").querySelector(".sw-census"), had = S.cuts.length ? j.have : {};   // the whole block is no piece cut yet
  ul.replaceChildren(...Object.keys(KIND_NAMES).filter(k => level.census[k] || had[k]).map(k => {
    const need = level.census[k] || 0, have = had[k] || 0, li = el("li", have === need ? "ok" : have > need ? "over" : "", `${need} ${KIND_NAMES[k][need === 1 ? 0 : 1]}`);
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
// the six faces in the view's order (+x, -x, +y, -y, +z, -z) as steps to the cube beyond
const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** The cubes as drawn: a colour per piece, a slit at every broken joint, the pieces drifted a little apart once there is more than one. */
function cubesOf(marks = true) {
  const n = N(), now = cuts(), ps = pieces(level, now), mid = middleOf(), out = [];
  const inside = p => p.every(v => v >= 0 && v < n);
  ps.forEach((p, i) => {
    const xs = p.map(k => xyz(n, k)), cen = [0, 1, 2].map(a => xs.reduce((t, c) => t + c[a], 0) / p.length - mid[a]);
    const drift = ps.length > 1 ? DRIFT : 0;
    for (const k of p) {
      const [x, y, z] = xyz(n, k), c = { x, y, z, k, ox: cen[0] * drift, oy: cen[1] * drift, oz: cen[2] * drift, color: COLOURS[i % COLOURS.length] };
      c.trim = SIDES.map(d => { const q = [x + d[0], y + d[1], z + d[2]]; return inside(q) && now.has(joint(k, at(n, ...q))) ? KERF : 0; });
      if (level.gauge[k] != null) c.label = level.gauge[k];
      // red: cut too far, its piece is already smaller than its number (a piece still too big is just not cut yet, so it is not marked)
      if (marks && level.gauge[k] != null && p.length < level.gauge[k]) c.edge = "rgba(168,56,43,1)";
      if (marks && hint?.cells.includes(k)) c.edge = "rgba(31,143,138,1)";
      out.push(c);
    }
  });
  return out;
}
/** The square between the two cubes of a joint, as drawn (moved with their pieces, a little smaller than a face). */
function jointQuad(key, byCell) {
  const n = N(), [a, b] = jointCubes(key), A = xyz(n, a), B = xyz(n, b), j = [0, 1, 2].find(i => A[i] !== B[i]), [u, v] = [0, 1, 2].filter(i => i !== j);
  const ca = byCell.get(a), cb = byCell.get(b), off = ["ox", "oy", "oz"].map(o => ((ca?.[o] || 0) + (cb?.[o] || 0)) / 2), e = 0.07;
  const base = A.map((p, i) => p + off[i]); base[j] = Math.max(A[j], B[j]) + off[j];
  return [[e, e], [1 - e, e], [1 - e, 1 - e], [e, 1 - e]].map(([du, dv]) => { const p = base.slice(); p[u] += du; p[v] += dv; return p; });
}
/** The joints a tap changes, lit as it fades (after) or dashed (before), and the face it is aimed at. */
function marksOf(cubes) {
  const byCell = new Map(cubes.map(c => [c.k, c])), out = [], now = performance.now();
  const lit = (op, alpha, dashed) => {
    for (const [keys, [fill, line]] of [[op.add, INK.cut], [op.remove, INK.glue]]) for (const key of keys)
      out.push({ quad: jointQuad(key, byCell), fill, stroke: line, alpha: dashed ? 0.55 * alpha : alpha, width: dashed ? 1.5 : 2, dash: dashed ? [4, 3] : null });
  };
  if (flash) { const t = (now - flash.t0) / FLASH; if (t < 1) lit(flash.op, (1 - t) ** 1.5, false); else flash = null; }
  if (peek) {
    const c = byCell.get(peek.face.k), f = peek.face, q = [c.x + (c.ox || 0), c.y + (c.oy || 0), c.z + (c.oz || 0)];
    if (peek.op) lit(peek.op, 1, true);
    // what is aimed at, on the cube's outer side: for the chisel the seam (the face's edge toward the joint), else the face's square
    const [u, v] = [0, 1, 2].filter(i => i !== f.axis), base = q.slice(); base[f.axis] += f.dir > 0 ? 1 : 0;
    const corner = ([du, dv]) => { const p = base.slice(); p[u] += du; p[v] += dv; return p; };
    if (f.side) {
      const along = f.side[u] ? v : u, at0 = f.side[u] ? [f.side[u] > 0 ? 1 : 0, 0] : [0, f.side[v] > 0 ? 1 : 0];
      const end = at0.slice(); end[along === u ? 0 : 1] = 1;
      out.push({ quad: [corner(at0), corner(end)], stroke: "rgba(255,255,255,.95)", width: 4 });
    } else out.push({ quad: [[0, 0], [1, 0], [1, 1], [0, 1]].map(corner), stroke: "rgba(255,255,255,.95)", width: 2.5 });
  }
  return out;
}
function drawAll() {
  if (!S || !level) return;
  const cubes = cubesOf();
  hits = drawCubes($("cube"), cubes, pose, { n: whole() ? N() : 0, frame: S.cuts.length === 0, margin: 10, frameColor: "rgba(140,130,110,.7)", edgeColor: "rgba(20,26,31,.32)", inner: 0.45, marks: marksOf(cubes) });
}
function render() {
  if (!S || !level) return;
  const n = N(), now = cuts(), j = judge(level, now);
  $("where").textContent = `${level.name} · ${extent(level).join("×")} · ${j.pieces.length} ${j.pieces.length === 1 ? "piece" : "pieces"}`;
  drawClock();
  for (const b of document.querySelectorAll(".sw-tool")) b.classList.toggle("on", b.dataset.tool === tool);
  const left = chiselLeft(), chisel = document.querySelector('.sw-tool[data-tool="chisel"]');
  chisel.lastChild.textContent = left === Infinity ? "one joint" : `${left} ${left === 1 ? "stroke" : "strokes"} left`;
  chisel.classList.toggle("spent", left <= 0);
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
/** What a tap at a pointer would do: the face under it and the tool's change there (op null when it would change nothing). */
function aim(e) {
  if (!S || S.done) return null;
  const r = cube.getBoundingClientRect(), h = faceAt(hits, e.clientX - r.left, e.clientY - r.top);
  if (!h) return null;
  const k = at(N(), h.cube.x, h.cube.y, h.cube.z), side = tool === "chisel" ? seamAt(h, e.clientX - r.left, e.clientY - r.top) : null;
  return { face: { k, axis: h.axis, dir: h.dir, side }, op: tool === "chisel" && chiselLeft() <= 0 ? null : useTool(level, tool, h.axis, h.dir, k, cuts(), side) };
}
/**
 * The seam a chisel tap means: of the tapped face's edges that have a joint under them, the one nearest the point, as the step
 * across it to the next cube (22 Nov 2026, Korbi: the chisel goes on the borders, so it can split the joint between two faces side
 * by side). The block's own outer edges have none, so a tap near one goes to the nearest seam that has.
 */
function seamAt(h, x, y) {
  const n = N(), timber = solidOf(level), c = [h.cube.x, h.cube.y, h.cube.z];
  const sides = [0, 1, 2, 3].map(i => {
    const [ax, ay] = h.poly[i], [bx, by] = h.poly[(i + 1) % 4], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const a = h.corners[i], b = h.corners[(i + 1) % 4], side = a.map((v, j) => (j === h.axis || v !== b[j] ? 0 : v ? 1 : -1));
    const q = c.map((v, j) => v + side[j]);
    return { side, d: Math.hypot(x - ax - t * dx, y - ay - t * dy), joint: q.every(v => v >= 0 && v < n) && timber[at(n, ...q)] };
  }).filter(o => o.joint).sort((p, q) => p.d - q.d);
  return sides[0]?.side ?? null;
}
const sameAim = (a, b) => (!a && !b) || (a && b && a.face.k === b.face.k && a.face.axis === b.face.axis && a.face.dir === b.face.dir && String(a.face.side) === String(b.face.side));
cube.addEventListener("pointerdown", e => {
  cube.setPointerCapture(e.pointerId); fingers.set(e.pointerId, [e.clientX, e.clientY]);
  drag = fingers.size > 1 ? null : { x: e.clientX, y: e.clientY, moved: 0 };
  peek = drag ? aim(e) : null; drawAll();            // pressing shows what letting go will do; dragging away turns the block instead
});
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
  if (!drag) {
    // a mouse or pen hovering shows what a click would do
    if (e.buttons === 0 && e.pointerType !== "touch") { const a = aim(e); if (!sameAim(a, peek)) { peek = a; drawAll(); } }
    return;
  }
  drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
  if (drag.moved > 6) peek = null;
  pose.yaw += (e.clientX - drag.x) * 0.012;
  pose.pitch = Math.max(-PITCH, Math.min(PITCH, pose.pitch + (e.clientY - drag.y) * 0.012));
  drag.x = e.clientX; drag.y = e.clientY;
  drawAll();
});
cube.addEventListener("pointerup", e => {
  const d = drag; drag = null; fingers.delete(e.pointerId); peek = null;
  if (!d || d.moved > 6 || !S || S.done) { drawAll(); return; }
  const a = aim(e);
  if (a) use(a.face.axis, a.face.dir, a.face.k, a.face.side); else drawAll();
});
cube.addEventListener("pointercancel", e => { drag = null; fingers.delete(e.pointerId); peek = null; drawAll(); });
cube.addEventListener("pointerleave", () => { if (!drag && peek) { peek = null; drawAll(); } });

// ---------- time ----------
let last = performance.now(), savedAt = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = now - last; last = now;
  if (flash) drawAll();
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
  for (const l of LEVELS) {
    const ch = chapterOf(l);
    if (ch && ch !== chapterOf(LEVELS[LEVELS.indexOf(l) - 1] || {})) play.append(line(`${ch.name}: ${ch.rule}`));
    play.append(action(`${LEVELS.indexOf(l) + 1}. ${l.name}${best[l.id] ? `  ✓ ${clock(Math.round(best[l.id].ms / 1000))}` : ""}`, async () => {
    $("menuDlg").close();
    if (l.id !== level.id && started() && !(await sure("Leave this block? It isn't finished."))) return;
    if (l.id !== level.id || S.done) newRun(l.id);
  }, "link"));
  }
  part(body, "settings").append(toggle("Sound", read(SOUND, true), v => { write(SOUND, v); setSound(v); }));
  part(body, "about").append(line("The block is cubes glued together. A chisel goes on a seam, the line between two faces, and splits the joint under it; it has only so many strokes where a saw or a bore is to hand. The others work in from the face you tap: a saw the whole plane of joints just behind it, a bore the joints round the row of cubes through it, glue mends the first cut it meets. Press and hold (or hover) to see what a tap will do; a cut shows as a slit. Undo gives a chisel stroke back."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".sw-mark").innerHTML = APPS.find(a => a.id === "slipway")?.logo || "";
bindSwitcher($("appsBtn"), "slipway");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
for (const b of document.querySelectorAll(".sw-tool")) b.addEventListener("click", () => { tool = b.dataset.tool; peek = null; render(); });
$("undoBtn").addEventListener("click", undoLast);
$("hintBtn").addEventListener("click", showHint);
new ResizeObserver(() => drawAll()).observe($("bench"));
window.addEventListener("resize", () => drawAll());
requestAnimationFrame(tick);
if (!S) newRun();
else if (S.done) { begin(); showDone(); }
else begin();

// for tests and debugging
window.__slipway = { get state() { return S; }, get level() { return level; }, use, apply, undoLast, newRun, showHint, get hint() { return hint; }, get hits() { return hits; }, setTool: t => { tool = t; render(); }, get chiselLeft() { return chiselLeft(); } };
