// Slipway: a puzzle of a ship's parts, each freed from its block with a few tools, each used from the right side, in the right
// order and along the right grain. A saw cuts the plane through your eye and the line you draw, so look at a face edge-on to
// cut it; the back saw scores a shoulder for the chisel; the plane, spokeshave and adze are drawn along or across the grain;
// the drill and the gouge go straight along your line of sight. Every tool has a few uses and shows a ghost of what it would
// take before it takes it; the stars are for how few you needed. The rules are slipway-puzzle.js's, the parts
// slipway-levels.js's and the generator's (slipway-gen.js), all tested in Node; the bench is slipway-3d.js's; this file takes
// the strokes and keeps the game: Levels in chapters, Random parts, and a part of the day.
import { LEVELS, CHAPTERS } from "./slipway-levels.js";
import { generate } from "./slipway-gen.js";
import { TOOL, TURN_ICON, WHY, VIEW_WORDS, SPOT } from "./slipway-tools.js";
import { setSound, sound } from "./slipway-sound.js";
import { newBlock, place, hit, pack, unpack, VIEWS } from "./slipway-carve.js";
import { planSaw, planKerf, doKerf, doSaw, outline, strokeFacing, doStroke, planDrill, doDrill, planChisel, doChisel, planGouge, doGouge, status, starsFor, left, newUsed, usesOf, hint, blockFor, trial, search, TOOLS } from "./slipway-puzzle.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line, toggle, choice, todayPart } from "./menu.js";
import { sure } from "./sure.js";
import { roundOver } from "./random.js";
import { IN_FRAME, today, arrivedForToday } from "./suite.js";
import "./pwa.js";
import { createFlatBench } from "./slipway-2d.js";   // the timber drawn on a plain canvas, for 2D mode and where there is no WebGL
import { wants3D, onDefaultChange } from "./mode3d.js";
import { load3d } from "./loading.js";

const $ = id => document.getElementById(id);
const CARVE = "slipway:carve", MADE = "slipway:parts", BEST = "slipway:best", OPTS = "slipway:opts", MODE = "slipway:mode", RAND = "slipway:rand", DAILY = "slipway:daily";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const forget = k => { if (!IN_FRAME) try { localStorage.removeItem(k); } catch { /* private mode */ } };
const pct = x => `${Math.round(x * 100)}%`;
const starText = n => "★".repeat(n) + "☆".repeat(3 - n);

let opts = { sound: true, ...read(OPTS, {}) };   // the ghost and the preview are always on (the menu has no switch for them)
const saveOpts = () => write(OPTS, opts);
setSound(opts.sound);

// ---------- what an older Slipway left ----------
// The carving game kept a score in slipway:parts (a number), its yard slipway:fit and slipway:fitted; the first puzzle kept
// its block in slipway:carve (version 2, by the number of the part among its seven). The stars (slipway:parts, by the
// part's name) are kept as they were; a version-2 block is read as its part, and anything older is dropped.
forget("slipway:fit");
forget("slipway:fitted");
const FIRST_SEVEN = ["wedge", "treenail", "step", "pin", "shell", "knee", "mast"];
/** The results kept: { part id: { s: stars, u: tools used } }. */
function results() {
  const all = read(MADE, {}), out = {};
  if (all && typeof all === "object") for (const l of LEVELS) { const r = all[l.id]; if (r && typeof r === "object" && r.s >= 1 && r.s <= 3 && r.u > 0) out[l.id] = { s: r.s | 0, u: r.u | 0 }; }
  return out;
}
const starsOf = id => results()[id]?.s ?? 0;
const totalStars = () => Object.values(results()).reduce((n, r) => n + r.s, 0);
/** A part is open if the one or two before it were freed, or any after it was (stars from before the chapters came). */
const unlocked = i => i === 0 || starsOf(LEVELS[i - 1].id) > 0 || (i > 1 && starsOf(LEVELS[i - 2].id) > 0) || LEVELS.slice(i).some(l => starsOf(l.id) > 0);
write(BEST, totalStars());                                            // the games screen shows the puzzle's stars
/** The chapters the player has begun (the first part of each freed): what Random may use. */
const reach = () => Math.max(1, CHAPTERS.filter(c => starsOf(c.levels[0]) > 0).length);

// ---------- the sounds and what the tools are called ----------
const toolsOf = lv => TOOLS.filter(t => t in lv.budget);
let tool = "turn";

// ---------- the game in hand ----------
let mode = read(MODE, "levels") === "random" ? "random" : "levels";
let run = null;            // { kind: "level" | "random" | "daily", at (level index) | seed, reach }
let cur = null;            // the part being cut (slipway-levels.js's shape)
let B = null;              // its block (slipway-carve.js's)
let used = newUsed();      // tool uses so far
let done = false;          // freed (and the result kept)
let undo = [];             // the block and the uses before each tool use
let bench = null;
let hintText = "", hintStep = 0, hintOp = null, deadText = "";
const uses = () => usesOf(used);

const partFor = r => (r.kind === "level" ? LEVELS[r.at] : generate(r.seed, CHAPTERS, r.reach));
function save() {
  if (!run || !B) return;
  write(CARVE, { v: 3, run, off: B.off, flip: B.flip, used, done, kerfs: B.kerfs.map(k => k.w), d: pack(B.d) });
}
/** A new part to work: `r` is { kind, at | seed, reach }. */
function begin(r) {
  run = r;
  cur = partFor(r);
  B = blockFor(cur);
  used = newUsed();
  undo = [];
  done = false;
  hintText = ""; hintStep = 0; hintOp = null; deadText = "";
  tool = "turn";
  $("doneDlg").open && $("doneDlg").close();
  bench?.reveal(false);
  bench?.setBlock(B);
  markViews(0);
  save();
  render();
}
const startLevel = i => { mode = "levels"; write(MODE, mode); begin({ kind: "level", at: i }); };
const randomSeed = () => 1 + Math.floor(Math.random() * 900000);
const startRandom = () => { mode = "random"; write(MODE, mode); begin({ kind: "random", seed: randomSeed(), reach: reach() }); };
const startDaily = () => begin({ kind: "daily", seed: today(), reach: 6 });
function firstOpen() { return Math.max(0, LEVELS.findIndex((l, i) => unlocked(i) && !starsOf(l.id))); }
function load() {
  let s = read(CARVE, null);
  if (s?.v === 2 && FIRST_SEVEN[s.level]) s = { v: 3, run: { kind: "level", at: LEVELS.findIndex(l => l.id === FIRST_SEVEN[s.level]) }, off: s.off, flip: s.flip, used: s.used, done: s.done, d: s.d, kerfs: [] };
  const r = s?.v === 3 ? s.run : null;
  let lv = null;
  try { lv = r && (r.kind === "level" ? (r.at >= 0 && LEVELS[r.at] ? LEVELS[r.at] : null) : partFor(r)); } catch { lv = null; }
  if (!lv) { startLevel(firstOpen()); return; }
  run = r; cur = lv;
  B = newBlock(lv, { off: +s.off || 0, flip: !!s.flip });
  if (typeof s.d === "string") B.d = unpack(s.d, B.d.length);
  B.kerfs = (s.kerfs || []).filter(w => B.walls[w]).map(w => ({ u: B.walls[w].u, s: B.walls[w].s, w }));
  used = newUsed();
  for (const t of TOOLS) used[t] = Math.max(0, Math.min(lv.budget[t] || 0, s.used?.[t] | 0));
  done = !!s.done && status(B).solved;
  undo = [];
  bench?.setBlock(B);
  render();
  checkDead();
}
/** Remembers the block as it was (`d`, the wood before the use) and the uses so far, for Undo. */
function snapshot(d = B.d.slice()) { undo.push({ d, used: { ...used }, done, kerfs: B.kerfs.slice() }); if (undo.length > 40) undo.shift(); }

// ---------- drawing the page ----------
const where = () => (run.kind === "level" ? `${run.at + 1} of ${LEVELS.length}` : run.kind === "daily" ? "today's" : "random");
function render() {
  const lv = cur, best = run.kind === "level" ? results()[lv.id] : null;
  $("partName").textContent = lv.name;
  $("partNo").textContent = `${where()} · par ${lv.par} · used ${uses()}`;
  $("partStars").textContent = best ? starText(best.s) : "";
  const tools = ["turn", ...toolsOf(lv)];
  $("tools").style.setProperty("--n", String(tools.length));
  $("tools").innerHTML = tools.map(id => {
    const n = id === "turn" ? "" : left(lv, used, id), off = id !== "turn" && (n <= 0 || done);
    return `<button type="button" class="sw-tool${tool === id ? " on" : ""}${hintOp?.tool === id ? " hint" : ""}" data-tool="${id}" aria-pressed="${tool === id}" ${off ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${id === "turn" ? TURN_ICON : TOOL[id].icon}</svg><span>${id === "turn" ? "Turn" : TOOL[id].name}</span>${id === "turn" ? "" : `<i class="sw-n" aria-label="${n} left">${n}</i>`}</button>`;
  }).join("");
  const started = uses() > 0;
  const slide = lv.slack ? `<button type="button" class="btn sw-act" data-act="left" aria-label="Slide the part left" ${started || B.off <= 0 ? "disabled" : ""}>◀</button><button type="button" class="btn sw-act" data-act="flip" aria-label="Turn the part end for end" ${started ? "disabled" : ""}>Reverse</button><button type="button" class="btn sw-act" data-act="right" aria-label="Slide the part right" ${started || B.off >= B.nx - B.px ? "disabled" : ""}>▶</button>` : "";
  const confirm = aimed ? `<button type="button" class="btn sw-act primary" data-act="use">${aimed.verb}</button><button type="button" class="btn sw-act" data-act="cancel">Cancel</button>` : "";
  $("setup").hidden = !(slide || confirm);
  $("setup").innerHTML = confirm || slide;
  $("acts").innerHTML = `<button type="button" class="btn sw-act" data-act="undo" ${undo.length ? "" : "disabled"}>Undo</button><button type="button" class="btn sw-act" data-act="hint" ${done ? "disabled" : ""}>Hint</button><button type="button" class="btn sw-act" data-act="again" ${started ? "" : "disabled"}>Start over</button>`;
  $("views").innerHTML = Object.keys(VIEWS).map(v => `<button type="button" data-view="${v}" aria-pressed="${viewNow === v}" class="${hintOp && hintOp.view === v ? "hint" : ""}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("");
  sayState();
}
function sayState() {
  const lv = cur;
  const text = deadText ? `<b class="bad">Dead end.</b> ${deadText}` : hintText ? `<b>Hint:</b> ${hintText}` : tool !== "turn" && TOOL[tool] ? `<b>${TOOL[tool].name}.</b> ${TOOL[tool].brief}` : lv.line;
  $("line").innerHTML = text;
  const st = status(B);
  const chip = $("waste");
  chip.textContent = done ? "Done" : `${pct(Math.min(1, st.waste))} waste`;
  chip.classList.toggle("ok", done);
  chip.classList.toggle("bad", !done && (st.into > 0.004 || st.knots > 0));
}
let viewNow = "corner";
/** Which named view the camera is in, if any (marked on the buttons). */
function markViews(delay = 0, tries = 15) {
  setTimeout(() => {
    if (!bench) return;
    if (bench.busy && tries) { markViews(120, tries - 1); return; }                // still turning to the view
    const [az, el] = bench.angles();
    const was = viewNow;
    viewNow = Object.entries(VIEWS).find(([, [a, e]]) => Math.abs(az - a) < 1.5 && Math.abs(el - e) < 1.5)?.[0] ?? "";
    if (viewNow !== was) document.querySelectorAll("#views button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === viewNow)));
  }, delay);
}

// ---------- aiming: what a tool would do, shown before it does it ----------
let aimed = null;          // a tap tool's aim waiting to be used: { verb, run }
const say = (text, bad) => { const a = $("aim"); a.textContent = text || ""; a.hidden = !text; a.classList.toggle("bad", !!bad); };
const gone = g => g.reduce((n, v) => n + v, 0) / 255;
/** Shows the ghost of a use (a function on a copy of the block) and what it comes to; returns the trial. */
function ghost(fn, verb) {
  const t = trial(B, fn), ok = t.r.ok, n = gone(t.gone);
  bench.cutGhost(ok || n > 0.5 ? t.gone : null, ok ? "ok" : "bad");
  say(ok ? `${verb}: takes ${n < 1 ? "a little" : `${Math.round(n)} cells`}` : (WHY[t.r.reason] || "Not there.").split(". ")[0], !ok);
  return t;
}
function noGhost() { bench?.cutGhost(null); say(""); }

// ---------- pointing at the bench ----------
const pointers = new Map();
let mode1 = null, last = null, sawFrom = null, pinch = 0, moved = 0, stroke = null, tapAt = null;
const local = e => { const r = bench.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The saw's plane along a line drawn on the screen (canvas pixels): the plane through the eye and that line. */
function planeFor(a, b) {
  const r = bench.canvas.getBoundingClientRect(), ra = bench.ray(a[0] + r.left, a[1] + r.top), rb = bench.ray(b[0] + r.left, b[1] + r.top);
  const n = [ra.d[1] * rb.d[2] - ra.d[2] * rb.d[1], ra.d[2] * rb.d[0] - ra.d[0] * rb.d[2], ra.d[0] * rb.d[1] - ra.d[1] * rb.d[0]], len = Math.hypot(...n);
  if (len < 1e-6) return null;
  const u = n.map(v => v / len);
  return { n: u, d0: dot(u, bench.eye()) };
}
const sawPlan = (a, b) => { const p = planeFor(a, b); return p && (tool === "kerf" ? planKerf(B, p.n, p.d0) : planSaw(B, p.n, p.d0)); };
function sawLine(a, b) {
  $("over").innerHTML = a ? `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="sw-cut"/><circle cx="${a[0]}" cy="${a[1]}" r="4" class="sw-cut-end"/><circle cx="${b[0]}" cy="${b[1]}" r="4" class="sw-cut-end"/>` : "";
}
function showGuide(a, b) {
  const plan = Math.hypot(b[0] - a[0], b[1] - a[1]) >= 12 ? sawPlan(a, b) : null;
  if (!plan) { bench.guide(null); noGhost(); return; }
  if (tool === "kerf") {
    bench.guide(plan.ok || plan.reason === "scored" ? outline(B, plan.u, plan.s) : [], plan.ok ? "ok" : "into");
    say(plan.ok ? "Kerf: scores this shoulder" : (WHY[plan.reason] || "").split(". ")[0], !plan.ok);
    return;
  }
  bench.guide(outline(B, plan.u, plan.s), plan.ok ? "ok" : plan.reason === "into" ? "into" : "nothing");
  if (plan.ok) { const t = trial(B, c => doSaw(c, plan)); bench.cutGhost(t.gone, "ok"); say(`Saw: takes ${Math.round(gone(t.gone))} cells`); }
  else { noGhost(); say(WHY[plan.reason] ? WHY[plan.reason].split(". ")[0] : "", true); }
}
const REACH = { plane: 3.5, shave: 3.5, adze: 4.5, drill: 1.5, chisel: 3.6, gouge: 2 };   // the cursor's radius, in cells, as the tool works
function showCursor(x, y) {
  if (!REACH[tool]) { bench.cursor(null); return; }
  const r = bench.ray(x, y), h = hit(B, r.o, r.d);
  bench.cursor(h ? h.p : null, h ? h.n : null, REACH[tool]);
}
const STROKE_TOOLS = new Set(["plane", "shave", "adze"]), TAP_TOOLS = new Set(["drill", "chisel", "gouge"]);
/** The plan for a tap tool at the screen point (x, y): the same planning the page commits with. */
function tapPlan(x, y) {
  const r = bench.ray(x, y), h = hit(B, r.o, r.d);
  if (!h) return null;
  const sight = bench.forward();
  const plan = tool === "drill" ? planDrill(B, h.p, h.n, sight) : tool === "chisel" ? planChisel(B, h.p, h.n, sight) : planGouge(B, h.p, h.n, sight);
  return { plan, h };
}
const DO_TAP = { drill: doDrill, chisel: doChisel, gouge: doGouge };
function aimTap(x, y) {
  showCursor(x, y);
  const t = tapPlan(x, y);
  tapAt = t;
  if (!t) { noGhost(); return; }
  if (!t.plan.ok) { bench.cutGhost(null); say((WHY[t.plan.reason] || "").split(". ")[0], true); return; }
  ghost(c => DO_TAP[tool](c, t.plan), TOOL[tool].name);
}
function onDown(e) {
  if (IN_FRAME || !bench) return;
  e.preventDefault();
  bench.canvas.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2) {
    if (mode1 === "saw") { sawLine(null); bench.guide(null); noGhost(); }
    mode1 = "orbit2";
    const [a, b] = [...pointers.values()];
    pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
    last = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return;
  }
  if (pointers.size > 2) return;
  last = [e.clientX, e.clientY];
  moved = 0;
  if (tool === "turn" || e.button === 2 || e.button === 1 || done) mode1 = "orbit1";      // a mouse turns the block with its right or middle button
  else if (tool === "saw" || tool === "kerf") { mode1 = "saw"; sawFrom = local(e); sawLine(sawFrom, sawFrom); }
  else if (TAP_TOOLS.has(tool)) { mode1 = "tap"; aimed = null; aimTap(e.clientX, e.clientY); }
  else {
    mode1 = "stroke";
    const r = bench.ray(e.clientX, e.clientY), h = hit(B, r.o, r.d);
    stroke = h ? { ns: [h.n], pts: [h.p] } : null;
    showCursor(e.clientX, e.clientY);
  }
}
function strokeNow() {
  const n = strokeFacing(B, stroke.ns);
  return { n, pts: stroke.pts };
}
let ghostTimer = 0;
function onMove(e) {
  if (!bench) return;
  if (!pointers.has(e.pointerId)) {
    if (e.pointerType === "mouse" && !IN_FRAME && !done) { showCursor(e.clientX, e.clientY); if (TAP_TOOLS.has(tool) && !aimed) aimTap(e.clientX, e.clientY); }
    return;
  }
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  moved += Math.hypot(e.clientX - prev[0], e.clientY - prev[1]);
  if (mode1 === "orbit2" && pointers.size === 2) {
    const [a, b] = [...pointers.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], gap = Math.hypot(a[0] - b[0], a[1] - b[1]);
    bench.orbit(mid[0] - last[0], mid[1] - last[1], pinch ? gap / pinch : 1);
    last = mid; pinch = gap;
  } else if (mode1 === "orbit1") {
    bench.orbit(e.clientX - last[0], e.clientY - last[1]);
    last = [e.clientX, e.clientY];
  } else if (mode1 === "saw") { const to = local(e); sawLine(sawFrom, to); showGuide(sawFrom, to); }
  else if (mode1 === "stroke") {
    // the stroke follows the surface under the finger: a point every couple of cells along it
    if (stroke) {
      const r = bench.ray(e.clientX, e.clientY), h = hit(B, r.o, r.d);
      if (h) {
        const q = stroke.pts[stroke.pts.length - 1];
        if (Math.hypot(h.p[0] - q[0], h.p[1] - q[1], h.p[2] - q[2]) > 1.2) { stroke.pts.push(h.p); stroke.ns.push(h.n); }
      }
      if (stroke.pts.length > 1 && !ghostTimer) ghostTimer = setTimeout(() => { ghostTimer = 0; if (stroke) { const s = strokeNow(); ghost(c => doStroke(c, tool, s.n, s.pts), TOOL[tool].name); } }, 60);
    }
    showCursor(e.clientX, e.clientY);
  } else if (mode1 === "tap") aimTap(e.clientX, e.clientY);
}
function onUp(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (mode1 === "orbit2") { if (!pointers.size) mode1 = null; else mode1 = "done"; markViews(450); return; }
  if (pointers.size) return;
  if (mode1 === "saw") {
    const end = local(e);
    sawLine(null);
    bench.guide(null);
    noGhost();
    if (Math.hypot(end[0] - sawFrom[0], end[1] - sawFrom[1]) >= 24) cutSaw(sawFrom, end);
  } else if (mode1 === "tap") {
    // a mouse uses the tool where it clicks; a finger aims, and the button below uses it once the ghost has been seen
    if (e.pointerType === "mouse") { noGhost(); useTap(); }
    else if (tapAt?.plan.ok) { aimed = { verb: `${tool === "drill" ? "Bore" : tool === "chisel" ? "Chop" : "Scoop"} here` }; render(); }
    else if (tapAt) { toast(WHY[tapAt.plan.reason] || "Not there."); sound("refuse"); noGhost(); bench.cursor(null); }
  } else if (mode1 === "stroke" && stroke) {
    noGhost();
    if (stroke.pts.length > 1) planeStroke(strokeNow());
    stroke = null;
  } else if (mode1 === "orbit1") markViews(450);
  mode1 = null;
  if (e.pointerType !== "mouse" && !aimed) bench.cursor(null);
}

// ---------- a tool used ----------
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3200);
}
const refuse = reason => { toast(WHY[reason] || "That doesn't work."); sound("refuse"); };
/** Chips and dust from the cells a use took (the grid of what went), thrown up from where the wood was. */
function chips(goneGrid, kind) {
  if (!bench) return;
  const pts = [];
  for (let m = 0, step = Math.max(1, Math.floor(goneGrid.length / 4000)); m < goneGrid.length; m += step) {
    if (goneGrid[m] > 100 && pts.length < 60) pts.push([m % B.nx + 0.5, Math.floor(m / B.nx) % B.ny + 0.5, Math.floor(m / (B.nx * B.ny)) + 0.5]);
  }
  bench.throwChips(pts, kind);
}
/** After a tool is used: draw it, keep it, and see whether the part is free. */
function afterUse(which, goneGrid) {
  hintText = ""; hintStep = 0; hintOp = null; deadText = "";
  aimed = null;
  sound(which);
  bench.refresh();
  if (goneGrid) chips(goneGrid, STROKE_TOOLS.has(which) ? "shave" : "dust");
  save();
  const st = status(B);
  if (st.solved) { finish(); return; }
  render();
  checkDead();
}
function cutSaw(a, b) {
  const which = tool;
  if (left(cur, used, which) <= 0) { toast(`No ${TOOL[which].name.toLowerCase()} uses left.`); return; }
  const plan = sawPlan(a, b);
  if (!plan) return;
  if (!plan.ok) { refuse(plan.reason); return; }
  const before = B.d.slice();
  snapshot(before);
  used[which]++;
  if (which === "kerf") { doKerf(B, plan); bench.refresh(); afterUse("kerf"); return; }
  doSaw(B, plan);
  const taken = new Uint8Array(before.length);
  for (let i = 0; i < taken.length; i++) taken[i] = before[i] - B.d[i];
  bench.offcut(taken, plan.u);
  afterUse("saw", taken);
  setTimeout(() => bench.reframe(), 380);                                   // once the offcut is away, close in on what's left
}
function planeStroke(s) {
  const which = tool;
  if (left(cur, used, which) <= 0) { toast(`No ${TOOL[which].name.toLowerCase()} uses left.`); return; }
  const keep = B.d.slice(), r = doStroke(B, which, s.n, s.pts);
  if (!r.ok) { B.d = keep; refuse(r.reason); return; }
  const taken = new Uint8Array(keep.length);
  for (let i = 0; i < taken.length; i++) taken[i] = keep[i] - B.d[i];
  snapshot(keep);
  used[which]++;
  afterUse(which, taken);
}
/** The drill, the chisel or the gouge at the aim last made. */
function useTap() {
  const which = tool, t = tapAt;
  aimed = null;
  if (!t) return;
  if (left(cur, used, which) <= 0) { toast(`No ${TOOL[which].name.toLowerCase()} uses left.`); return; }
  if (!t.plan.ok) { refuse(t.plan.reason); render(); return; }
  const keep = B.d.slice(), kerfs = B.kerfs.slice(), res = DO_TAP[which](B, t.plan);
  if (!res.ok) { B.d = keep; refuse(res.reason); render(); return; }
  const taken = new Uint8Array(keep.length);
  for (let i = 0; i < taken.length; i++) taken[i] = keep[i] - B.d[i];
  snapshot(keep);
  used[which]++;
  bench.cursor(null);
  afterUse(which, taken);
}

// ---------- a dead end, when it can be proved ----------
let deadTimer = 0;
/** After a use: if the tools that are left cannot finish the part, say so (a search of what is left, if it is a small one). */
function checkDead() {
  clearTimeout(deadTimer);
  if (done) return;
  const room = TOOLS.reduce((n, t) => n + Math.max(0, left(cur, used, t)), 0);
  if (!room) { deadText = "No tool is left. Undo a use, or start over."; sayState(); return; }
  const at = used;
  deadTimer = setTimeout(() => {
    if (at !== used || done) return;
    const r = search(cur, undefined, room, { b: { ...B, d: B.d.slice(), kerfs: B.kerfs.slice() }, used: { ...used } }, 500);
    if (r === null && at === used) { deadText = "Nothing left can finish this part. Undo to the use that spoilt it."; sayState(); sound("refuse"); }
  }, 250);
}

// ---------- the buttons ----------
$("tools").addEventListener("click", e => {
  const b = e.target.closest("[data-tool]");
  if (!b || b.disabled) return;
  tool = b.dataset.tool;
  aimed = null; noGhost();
  bench?.cursor(null);
  sound("tap");
  render();
});
$("views").addEventListener("click", e => {
  const b = e.target.closest("[data-view]");
  if (!b || !bench) return;
  bench.view(b.dataset.view);
  viewNow = b.dataset.view;
  document.querySelectorAll("#views button").forEach(c => c.setAttribute("aria-pressed", String(c === b)));
  markViews(60);                                                                     // and again once it has turned: it may be a view the camera clamps
});
function act(name) {
  if (name === "left" || name === "right" || name === "flip") {
    if (uses()) return;
    place(B, B.off + (name === "left" ? -2 : name === "right" ? 2 : 0), name === "flip" ? !B.flip : B.flip);
    bench?.replaced();
    hintText = ""; hintOp = null;
    save();
    render();
  } else if (name === "undo" && undo.length) {
    const u = undo.pop();
    B.d = u.d; used = u.used; done = false; B.kerfs = u.kerfs;
    hintText = ""; hintStep = 0; hintOp = null; deadText = "";
    bench.reveal(false);
    bench.refresh();
    bench.reframe();
    sound("undo");
    save();
    render();
    checkDead();
  } else if (name === "hint") giveHint();
  else if (name === "again") restart();
  else if (name === "use") { noGhost(); useTap(); }
  else if (name === "cancel") { aimed = null; noGhost(); bench.cursor(null); render(); }
}
$("acts").addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b && !b.disabled) act(b.dataset.act); });
$("setup").addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b && !b.disabled) act(b.dataset.act); });
async function restart() {
  if (uses() && !done && !(await sure("Start this part again? Your uses so far are lost."))) return;
  begin(run);
}
/** The first time names the tool, the second where to look from; both light up on the palette. */
function giveHint() {
  const h = hint(cur, B);
  if (!h) { hintText = "Nothing more is needed here."; hintOp = null; sayState(); return; }
  hintStep++;
  if (h.place) { hintText = "First slide the part, or reverse it end for end, so the knot ends up outside it."; hintOp = null; }
  else {
    const name = TOOL[h.op.tool].name.toLowerCase();
    hintOp = h.op;
    hintText = hintStep === 1 ? `Use the ${name} next.` : `Use the ${name} next, from ${VIEW_WORDS[h.op.view] || "the Corner view"}.`;
  }
  render();
}

// ---------- a part freed: fitted to the ship ----------
const COG = `<svg class="sw-cog" viewBox="0 0 100 62" aria-hidden="true">
  <path class="w" d="M0 55q6-3 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t8 0"/>
  <path class="hull" d="M10 40h82l-3 10q-4 6-12 6H26q-9 0-13-7z"/><path class="deck" d="M10 40h82"/>
  <path class="mast" d="M50 40V6"/><path class="sail" d="M33 8h34q-2 11 0 22H33q2-11 0-22z"/>
  <path class="rudder" d="M92 40l5 12-4 2z"/><path class="bow" d="M10 40l-6-9 4 0 5 7z"/><path class="rig" d="M50 6l32 34M50 6L15 40"/>
  <circle class="spot" r="5"/></svg>`;
function finish() {
  const lv = cur, n = uses(), stars = starsFor(lv, n);
  done = true;
  if (run.kind === "level") {
    const all = results(), old = all[lv.id];
    if (!old || stars > old.s || (stars === old.s && n < old.u)) {
      all[lv.id] = { s: stars, u: n };
      write(MADE, all);
      write(BEST, totalStars());
    }
  } else if (run.kind === "daily") {
    const d = read(DAILY, {});
    if (!(d[run.seed] >= stars)) { d[run.seed] = stars; write(DAILY, d); }
  } else {
    const r = read(RAND, { n: 0, stars: 0 });
    write(RAND, { n: (r.n | 0) + 1, stars: (r.stars | 0) + stars });
  }
  save();
  render();
  bench.reveal(true);
  sound("done");
  const st = status(B), spot = SPOT[lv.spot] || SPOT.hull;
  $("doneHead").textContent = `${lv.name}: ${["", "freed", "well done", "at par or better"][stars]}`;
  $("doneStars").textContent = starText(stars);
  $("doneFit").innerHTML = `${COG}<p>Fitted to the ship: the ${lv.name.toLowerCase()} goes in the ${({ mast: "mast", hull: "hull", rig: "rigging", rudder: "rudder", bow: "bow", deck: "deck", keel: "keel" })[lv.spot] || "hull"}.</p>`;
  const c = $("doneFit").querySelector(".spot");
  c.setAttribute("cx", spot[0]); c.setAttribute("cy", spot[1]);
  const usedBy = TOOLS.filter(t => used[t]).map(t => `<div><dt>${TOOL[t].name}</dt><dd>${used[t]}</dd></div>`).join("");
  $("doneBody").innerHTML = `<div><dt>Tools used</dt><dd>${n}</dd></div><div><dt>Par</dt><dd>${lv.par}</dd></div>${usedBy}<div><dt>Waste left</dt><dd>${pct(Math.min(1, st.waste))}</dd></div>`;
  $("doneNote").textContent = stars === 3 ? (n < lv.par ? "Under par." : "") : `Par is ${lv.par}: ${lv.par === 1 ? "one use" : `${lv.par} uses`} will do it.`;
  const next = $("nextBtn");
  if (run.kind === "level") {
    const last = run.at === LEVELS.length - 1;
    next.textContent = last ? "Back to the first" : "Next part";
    next.dataset.next = String(last ? 0 : run.at + 1);
  } else { next.textContent = run.kind === "daily" ? "Another, at random" : "Another part"; next.dataset.next = "random"; }
  setTimeout(() => { if (done && !$("doneDlg").open) $("doneDlg").showModal(); }, 2600);
  roundOver("slipway");
}
$("nextBtn").addEventListener("click", () => { $("doneDlg").close(); const t = $("nextBtn").dataset.next; if (t === "random") startRandom(); else startLevel(Number(t)); });
$("againBtn").addEventListener("click", () => { $("doneDlg").close(); begin(run); });
$("lookBtn").addEventListener("click", () => $("doneDlg").close());

// ---------- the menu ----------
const dailyStars = () => read(DAILY, {})[today()];
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const ds = dailyStars();
  todayPart(body, { done: ds != null, result: ds != null ? starText(ds) : "", play: startDaily, playing: run.kind === "daily", busy: uses() > 0 && !done && run.kind !== "daily" });
  part(body, "play").append(action("Start this part again", () => restart(), "primary"));
  part(body, "content").append(choice("Mode", [["levels", "Levels"], ["random", "Random"]], mode, v => {
    $("menuDlg").close();
    if (v === mode) return;
    if (v === "random") startRandom(); else startLevel(run.kind === "level" ? run.at : firstOpen());
  }));
  if (mode === "random") {
    const r = read(RAND, { n: 0, stars: 0 });
    part(body, "content").append(line(`${r.n} random parts freed, ${r.stars} stars. Each is new, and uses only the tools you have met.`), action("Another part", () => startRandom()));
  } else {
    // the cog's parts by chapter: done with their stars, the one you're on, and those still locked
    const wrap = document.createElement("div");
    wrap.className = "sw-chapters";
    CHAPTERS.forEach((c, ci) => {
      const h = document.createElement("h3");
      h.textContent = `${ci + 1}. ${c.name}`;
      const list = document.createElement("ol");
      list.className = "sw-parts";
      c.levels.forEach(id => {
        const i = LEVELS.findIndex(l => l.id === id), lv = LEVELS[i], li = document.createElement("li"), b = document.createElement("button"), open = unlocked(i), stars = starsOf(id);
        b.type = "button";
        b.disabled = !open;
        const here = run.kind === "level" && i === run.at;
        b.className = here ? "cur" : "";
        b.innerHTML = `<span>${lv.name}</span><small>${stars ? starText(stars) : open ? (here ? "in hand" : "") : "locked"}</small>`;
        b.addEventListener("click", () => { $("menuDlg").close(); if (!here) startLevel(i); });
        li.append(b);
        list.append(li);
      });
      wrap.append(h, list);
    });
    part(body, "content").append(wrap);
  }
  part(body, "settings").append(
    choice("View", [["3d", "3D"], ["flat", "Flat"]], benchIs3D ? "3d" : "flat", v => { setLook(v); }),
    toggle("Sound", opts.sound, on => { opts.sound = on; setSound(on); saveOpts(); }));
  part(body, "about").append(line(`${totalStars()} of ${LEVELS.length * 3} stars. Three for the par, two for one tool over, one for freeing it at all.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "slipway");
document.querySelector(".sw-mark").innerHTML = APPS.find(a => a.id === "slipway")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
/** The 3D bench (three.js is fetched only now) or the flat one (slipway-2d.js): the player's own choice if kept (`opts.look`, "3d" or "flat", written only when picked), else Settings' 2D mode; where there is no WebGL, flat. */
async function makeBench(three) {
  try {
    if (!three) throw new Error("the flat bench");
    bench = (await load3d(import("./slipway-3d.js"))).createBench($("bench"));
    benchIs3D = true;
  } catch {
    try { bench = createFlatBench($("bench")); benchIs3D = false; }
    catch (err) { console.warn("Slipway: no canvas here.", err); $("nogl").hidden = false; return; }
  }
  bench.ghost = true;
  const c = bench.canvas;
  c.addEventListener("pointerdown", onDown);
  c.addEventListener("pointermove", onMove);
  c.addEventListener("pointerup", onUp);
  c.addEventListener("pointercancel", onUp);
  c.addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && !pointers.size) { bench.cursor(null); if (!aimed) noGhost(); } });
  c.addEventListener("contextmenu", e => e.preventDefault());
  c.addEventListener("wheel", e => { e.preventDefault(); bench.orbit(0, 0, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
}
let benchIs3D = false;
const keptLook = () => (opts.look === "3d" || opts.look === "flat" ? opts.look : null);
await makeBench(wants3D(keptLook(), "3d"));
/** Menu, View: the 3D bench or the flat one, the block in hand carried across; `remember` writes the choice (the suite's default is never written). */
async function setLook(l, remember = true) {
  if (remember) { opts.look = l; if (!IN_FRAME) saveOpts(); }
  if (!bench || (l === "3d") === benchIs3D) return;
  pointers.clear();
  bench.dispose?.();
  await makeBench(l === "3d");
  if (bench && B) { bench.setBlock(B); markViews(); }
}
onDefaultChange(is3D => { if (!keptLook()) setLook(is3D ? "3d" : "flat", false); });   // Settings' 2D mode, live
{
  // the games screen's tile opens today's while it is still to play
  const wantsDaily = arrivedForToday() && !IN_FRAME && dailyStars() == null;
  load();
  if (wantsDaily && !(uses() > 0 && !done)) startDaily();
}
window.__slipway = { get block() { return B; }, get used() { return used; }, get done() { return done; }, get level() { return cur; }, get run() { return run; }, bench: () => bench, startLevel, startRandom, startDaily, finish, cutSaw, useTap, planeStroke, giveHint, status: () => status(B), setTool: t => { tool = t; render(); } };
