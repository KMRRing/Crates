// Slipway: a puzzle of a ship's parts, each freed from its block with a few tools used from the right side and in the
// right order. A saw cuts the plane through your eye and the line you draw (so look at a face edge-on to cut it), the plane
// takes the top layers of the waste under its sole, the drill goes straight along your line of sight. Every tool has a
// few uses; the stars are for how few you needed. The rules are slipway-puzzle.js's and the levels slipway-levels.js's
// (both tested in Node); the bench is slipway-3d.js's; this file takes the strokes and keeps the game.
import { LEVELS } from "./slipway-levels.js";
import { newBlock, place, hit, pack, unpack, VIEWS } from "./slipway-carve.js";
import { planSaw, doSaw, outline, strokeFacing, doPlane, planDrill, doDrill, status, starsFor, left, newUsed, hint, blockFor } from "./slipway-puzzle.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line, toggle } from "./menu.js";
import { sure } from "./sure.js";
import { roundOver } from "./random.js";
import { IN_FRAME } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const CARVE = "slipway:carve", MADE = "slipway:parts", BEST = "slipway:best", OPTS = "slipway:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const forget = k => { if (!IN_FRAME) try { localStorage.removeItem(k); } catch { /* private mode */ } };
const pct = x => `${Math.round(x * 100)}%`;
const starText = n => "★".repeat(n) + "☆".repeat(3 - n);
const TOOL_NAMES = { saw: "Saw", plane: "Plane", drill: "Drill" };

let opts = { sound: true, ghost: true, ...read(OPTS, {}) };
const saveOpts = () => write(OPTS, opts);

// ---------- what an older Slipway left ----------
// The carving game kept its block in slipway:carve (version 1), each part's score in slipway:parts (a number) and the
// stars in slipway:best; the yard its fittings in slipway:fit and slipway:fitted. The puzzle keeps its own under the same
// names, and reads only what it wrote: a number where it wants a result, or a version-1 block, is ignored and replaced.
forget("slipway:fit");
forget("slipway:fitted");
/** The results kept: { level id: { s: stars, u: tools used } }. */
function results() {
  const all = read(MADE, {}), out = {};
  if (all && typeof all === "object") for (const l of LEVELS) { const r = all[l.id]; if (r && typeof r === "object" && r.s >= 1 && r.s <= 3 && r.u > 0) out[l.id] = { s: r.s | 0, u: r.u | 0 }; }
  return out;
}
const starsOf = id => results()[id]?.s ?? 0;
const totalStars = () => Object.values(results()).reduce((n, r) => n + r.s, 0);
const unlocked = i => i === 0 || starsOf(LEVELS[i - 1].id) > 0 || (i > 1 && starsOf(LEVELS[i - 2].id) > 0);
write(BEST, totalStars());                                            // the games screen shows the puzzle's stars, not the old game's

// ---------- the tools ----------
const ICON = {
  turn: `<path d="M5 12a7 7 0 0 1 12-5l2-2v6h-6l2.2-2.2A4.6 4.6 0 0 0 7.4 12"/><path d="M19 12a7 7 0 0 1-12 5l-2 2v-6h6l-2.2 2.2A4.6 4.6 0 0 0 16.6 12"/>`,
  saw: `<path d="M3 15l12-12 3 3-12 12z"/><path d="M5 17l-1.5 1.5M8 14l-1.5 1.5M11 11l-1.5 1.5M14 8l-1.5 1.5"/><path d="M15 3l6 6-2 2"/>`,
  plane: `<path d="M3 16h18v3H3z"/><path d="M6 16l3-6h7l2 6"/><path d="M12 10V6l3-2"/>`,
  drill: `<path d="M4 8h9v6H4z"/><path d="M13 10h4l3 1-3 1h-4"/><path d="M6 14v6h4v-6"/>`,
};
const REACH = { plane: 3.5, drill: 1.5 };                             // the cursor's radius, in cells, as the tool works
let tool = "turn";

// ---------- the sounds, made as they play (no files) ----------
let audio = null;
function noise(ms, { lo = 200, hi = 4000, gain = 0.25, decay = 0.6, rate = 0 } = {}) {
  if (!opts.sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume();
    const n = Math.round(audio.sampleRate * ms / 1000), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / n, saw = rate ? 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * t * rate)) : 1;
      d[i] = (Math.random() * 2 - 1) * saw * (1 - t) ** decay;
    }
    const src = audio.createBufferSource(), bp = audio.createBiquadFilter(), g = audio.createGain();
    src.buffer = buf;
    bp.type = "bandpass"; bp.frequency.value = Math.sqrt(lo * hi); bp.Q.value = Math.sqrt(lo * hi) / (hi - lo);
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(audio.destination);
    src.start();
  } catch { /* no sound here */ }
}
const SOUND = {
  saw: () => noise(520, { lo: 900, hi: 5200, gain: 0.32, decay: 0.3, rate: 7 }),
  plane: () => noise(220, { lo: 1800, hi: 9000, gain: 0.18, decay: 1.2 }),
  drill: () => noise(420, { lo: 300, hi: 1600, gain: 0.22, decay: 0.4, rate: 30 }),
  done: () => noise(380, { lo: 500, hi: 2400, gain: 0.2, decay: 0.8, rate: 3 }),
};
const sound = kind => SOUND[kind]?.();

// ---------- the block and its keeping ----------
let at = 0;                // the level in hand
let B = null;              // its block (slipway-carve.js's)
let used = newUsed();      // tool uses so far
let done = false;          // solved (and the result kept)
let undo = [];             // the block and the uses before each tool use
let bench = null;
let hintText = "", hintStep = 0;
const L = () => LEVELS[at];
const uses = () => used.saw + used.plane + used.drill;

function save() {
  write(CARVE, { v: 2, level: at, off: B.off, flip: B.flip, used, done, d: pack(B.d) });
}
function start(i) {
  at = i;
  B = blockFor(LEVELS[i]);
  used = newUsed();
  undo = [];
  done = false;
  hintText = ""; hintStep = 0;
  tool = "turn";
  bench?.setBlock(B);
  markViews(0);
  save();
  render();
}
function load() {
  const s = read(CARVE, null);
  const level = s?.v === 2 ? LEVELS[s.level] : null;
  if (!level) { start(Math.max(0, LEVELS.findIndex((l, i) => unlocked(i) && !starsOf(l.id)))); return; }
  at = s.level;
  B = newBlock(level, { off: +s.off || 0, flip: !!s.flip });
  if (typeof s.d === "string") B.d = unpack(s.d, B.d.length);
  used = newUsed();
  for (const t of Object.keys(used)) used[t] = Math.max(0, Math.min(level.budget[t] || 0, s.used?.[t] | 0));
  done = !!s.done && status(B).solved;
  undo = [];
  bench?.setBlock(B);
  render();
}
/** Remembers the block as it was (`d`, the wood before the use) and the uses so far, for Undo. */
function snapshot(d = B.d.slice()) { undo.push({ d, used: { ...used }, done }); if (undo.length > 40) undo.shift(); }

// ---------- drawing the page ----------
function render() {
  const lv = L(), best = results()[lv.id];
  $("partName").textContent = lv.name;
  $("partNo").textContent = `${at + 1} of ${LEVELS.length} · par ${lv.par} · used ${uses()}`;
  $("partStars").textContent = best ? starText(best.s) : "";
  const tools = ["turn", ...Object.keys(lv.budget)];
  $("tools").style.setProperty("--n", String(tools.length));
  $("tools").innerHTML = tools.map(id => {
    const n = id === "turn" ? "" : left(lv, used, id), off = id !== "turn" && (n <= 0 || done);
    return `<button type="button" class="sw-tool${tool === id ? " on" : ""}" data-tool="${id}" aria-pressed="${tool === id}" ${off ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg><span>${id === "turn" ? "Turn" : TOOL_NAMES[id]}</span>${id === "turn" ? "" : `<i class="sw-n" aria-label="${n} left">${n}</i>`}</button>`;
  }).join("");
  const started = uses() > 0;
  $("setup").hidden = !lv.slack;
  $("setup").innerHTML = lv.slack ? `<button type="button" class="btn sw-act" data-act="left" aria-label="Slide the part left" ${started || B.off <= 0 ? "disabled" : ""}>◀</button><button type="button" class="btn sw-act" data-act="flip" ${started ? "disabled" : ""}>Turn end for end</button><button type="button" class="btn sw-act" data-act="right" aria-label="Slide the part right" ${started || B.off >= B.nx - B.px ? "disabled" : ""}>▶</button>` : "";
  $("acts").innerHTML = `<button type="button" class="btn sw-act" data-act="undo" ${undo.length ? "" : "disabled"}>Undo</button><button type="button" class="btn sw-act" data-act="hint" ${done ? "disabled" : ""}>Hint</button><button type="button" class="btn sw-act" data-act="again" ${started ? "" : "disabled"}>Start over</button>`;
  $("views").innerHTML = Object.keys(VIEWS).map(v => `<button type="button" data-view="${v}" aria-pressed="${viewNow === v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("");
  sayState();
}
function sayState() {
  const lv = L();
  $("line").innerHTML = hintText ? `<b>Hint:</b> ${hintText}` : lv.line;
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

// ---------- pointing at the bench ----------
const pointers = new Map();
let mode = null, last = null, sawFrom = null, pinch = 0, moved = 0, stroke = null;
const local = e => { const r = bench.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The saw along a line drawn on the screen (canvas pixels): the plane through the eye and that line, laid by the rules. */
function sawPlanFor(a, b) {
  const r = bench.canvas.getBoundingClientRect(), ra = bench.ray(a[0] + r.left, a[1] + r.top), rb = bench.ray(b[0] + r.left, b[1] + r.top);
  const n = [ra.d[1] * rb.d[2] - ra.d[2] * rb.d[1], ra.d[2] * rb.d[0] - ra.d[0] * rb.d[2], ra.d[0] * rb.d[1] - ra.d[1] * rb.d[0]], len = Math.hypot(...n);
  if (len < 1e-6) return null;
  const u = n.map(v => v / len);
  return planSaw(B, u, dot(u, bench.eye()));
}
function sawLine(a, b) {
  $("over").innerHTML = a ? `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="sw-cut"/><circle cx="${a[0]}" cy="${a[1]}" r="4" class="sw-cut-end"/><circle cx="${b[0]}" cy="${b[1]}" r="4" class="sw-cut-end"/>` : "";
}
function showGuide(a, b) {
  const plan = Math.hypot(b[0] - a[0], b[1] - a[1]) >= 12 ? sawPlanFor(a, b) : null;
  if (!plan) { bench.guide(null); return; }
  bench.guide(outline(B, plan.u, plan.s), plan.ok ? "ok" : plan.reason === "into" ? "into" : "nothing");
}
function showCursor(x, y) {
  if (!REACH[tool]) { bench.cursor(null); return; }
  const r = bench.ray(x, y), h = hit(B, r.o, r.d);
  bench.cursor(h ? h.p : null, h ? h.n : null, REACH[tool]);
}
function onDown(e) {
  if (IN_FRAME || !bench) return;
  e.preventDefault();
  bench.canvas.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2) {
    if (mode === "saw") { sawLine(null); bench.guide(null); }
    mode = "orbit2";
    const [a, b] = [...pointers.values()];
    pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
    last = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return;
  }
  if (pointers.size > 2) return;
  last = [e.clientX, e.clientY];
  moved = 0;
  if (tool === "turn" || e.button === 2 || e.button === 1 || done) mode = "orbit1";      // a mouse turns the block with its right or middle button
  else if (tool === "saw") { mode = "saw"; sawFrom = local(e); sawLine(sawFrom, sawFrom); }
  else if (tool === "drill") mode = "drill";
  else {
    mode = "stroke";
    const r = bench.ray(e.clientX, e.clientY), h = hit(B, r.o, r.d);
    stroke = h ? { ns: [h.n], pts: [h.p] } : null;
    showCursor(e.clientX, e.clientY);
  }
}
function onMove(e) {
  if (!bench) return;
  if (!pointers.has(e.pointerId)) { if (e.pointerType === "mouse" && !IN_FRAME && !done) showCursor(e.clientX, e.clientY); return; }
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  moved += Math.hypot(e.clientX - prev[0], e.clientY - prev[1]);
  if (mode === "orbit2" && pointers.size === 2) {
    const [a, b] = [...pointers.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], gap = Math.hypot(a[0] - b[0], a[1] - b[1]);
    bench.orbit(mid[0] - last[0], mid[1] - last[1], pinch ? gap / pinch : 1);
    last = mid; pinch = gap;
  } else if (mode === "orbit1") {
    bench.orbit(e.clientX - last[0], e.clientY - last[1]);
    last = [e.clientX, e.clientY];
  } else if (mode === "saw") { const to = local(e); sawLine(sawFrom, to); showGuide(sawFrom, to); }
  else if (mode === "stroke") {
    // the stroke follows the surface under the finger: a point every couple of cells along it
    if (stroke) {
      const r = bench.ray(e.clientX, e.clientY), h = hit(B, r.o, r.d);
      if (h) {
        const q = stroke.pts[stroke.pts.length - 1];
        if (Math.hypot(h.p[0] - q[0], h.p[1] - q[1], h.p[2] - q[2]) > 1.2) { stroke.pts.push(h.p); stroke.ns.push(h.n); }
      }
    }
    showCursor(e.clientX, e.clientY);
  } else if (mode === "drill") showCursor(e.clientX, e.clientY);
}
function onUp(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (mode === "orbit2") { if (!pointers.size) mode = null; else mode = "done"; markViews(450); return; }
  if (pointers.size) return;
  if (mode === "saw") {
    const end = local(e);
    sawLine(null);
    bench.guide(null);
    if (Math.hypot(end[0] - sawFrom[0], end[1] - sawFrom[1]) >= 24) cutSaw(sawFrom, end);
  } else if (mode === "drill" && moved < 10) bore(e.clientX, e.clientY);
  else if (mode === "stroke" && stroke) { planeStroke({ n: strokeFacing(B, stroke.ns), pts: stroke.pts }); stroke = null; }
  else if (mode === "orbit1") markViews(450);
  mode = null;
  if (e.pointerType !== "mouse") bench.cursor(null);
}

// ---------- a tool used ----------
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2600);
}
const WHY = {
  into: "That cut would go into the part.",
  nothing: "That takes nothing.",
  knot: "The iron skips on the knot: saw that corner, or saw it away first.",
  skates: "The bit skates off a slope. Look square at a flat face to bore.",
};
/** After a tool is used: draw it, keep it, and see whether the part is free. */
function afterUse(tool) {
  hintText = ""; hintStep = 0;
  sound(tool);
  bench.refresh();
  save();
  const st = status(B);
  if (st.solved) { finish(); return; }
  render();
  const lv = L();
  if (Object.keys(lv.budget).every(t => left(lv, used, t) <= 0)) toast("Out of tools. Undo a use, or start over.");
}
function cutSaw(a, b) {
  if (left(L(), used, "saw") <= 0) { toast("No saws left."); return; }
  const plan = sawPlanFor(a, b);
  if (!plan) return;
  if (!plan.ok) { toast(WHY[plan.reason] || "That cut doesn't work."); return; }
  const before = B.d.slice();
  snapshot(before);
  doSaw(B, plan);
  const gone = new Uint8Array(before.length);
  for (let i = 0; i < gone.length; i++) gone[i] = before[i] - B.d[i];
  bench.offcut(gone, plan.u);
  used.saw++;
  afterUse("saw");
  setTimeout(() => bench.reframe(), 380);                                   // once the offcut is away, close in on what's left
}
function planeStroke(s) {
  if (left(L(), used, "plane") <= 0) { toast("No planes left."); return; }
  const keep = B.d.slice(), r = doPlane(B, s.n, s.pts);
  if (!r.ok) { B.d = keep; toast(WHY[r.reason] || "Nothing to plane there."); return; }
  snapshot(keep);
  used.plane++;
  afterUse("plane");
}
/** The drill, straight in along the line of sight from where you tap. */
function bore(x, y) {
  if (left(L(), used, "drill") <= 0) { toast("No drills left."); return; }
  const r = bench.ray(x, y), h = hit(B, r.o, r.d);
  if (!h) return;
  const plan = planDrill(B, h.p, h.n, bench.forward());
  if (!plan.ok) { toast(WHY[plan.reason]); return; }
  const keep = B.d.slice(), res = doDrill(B, plan);
  if (!res.ok) { B.d = keep; toast("The bit finds nothing to bore."); return; }
  snapshot(keep);
  used.drill++;
  afterUse("drill");
}

// ---------- the buttons ----------
$("tools").addEventListener("click", e => {
  const b = e.target.closest("[data-tool]");
  if (!b || b.disabled) return;
  tool = b.dataset.tool;
  bench?.cursor(null);
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
    hintText = "";
    save();
    render();
  } else if (name === "undo" && undo.length) {
    const u = undo.pop();
    B.d = u.d; used = u.used; done = false;
    hintText = ""; hintStep = 0;
    bench.refresh();
    bench.reframe();
    save();
    render();
  } else if (name === "hint") giveHint();
  else if (name === "again") restart();
}
$("acts").addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b && !b.disabled) act(b.dataset.act); });
$("setup").addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b && !b.disabled) act(b.dataset.act); });
async function restart() {
  if (uses() && !done && !(await sure("Start this part again? Your uses so far are lost."))) return;
  start(at);
}
const VIEW_WORDS = { side: "from the Side view", top: "from the Top view", end: "from the End view", corner: "from the Corner view", diag: "from level with the block, turned 45°, looking along a diagonal" };
/** The first time names the tool, the second where to look from. */
function giveHint() {
  const h = hint(L(), B);
  if (!h) { hintText = "Nothing more is needed here."; sayState(); return; }
  hintStep++;
  if (h.place) hintText = "First slide the part, or turn it end for end, so the knot ends up outside it.";
  else {
    const name = TOOL_NAMES[h.op.tool].toLowerCase();
    hintText = hintStep === 1 ? `Use the ${name} next.` : `Use the ${name} next, ${VIEW_WORDS[h.op.view]}.`;
  }
  sayState();
}

// ---------- a part freed ----------
function finish() {
  const lv = L(), n = uses(), stars = starsFor(lv, n), all = results();
  done = true;
  const old = all[lv.id];
  if (!old || stars > old.s || (stars === old.s && n < old.u)) {
    all[lv.id] = { s: stars, u: n };
    write(MADE, all);
    write(BEST, totalStars());
  }
  save();
  render();
  $("doneHead").textContent = `${lv.name}: ${["", "freed", "well done", "at par or better"][stars]}`;
  $("doneStars").textContent = starText(stars);
  const st = status(B);
  $("doneBody").innerHTML = `<div><dt>Tools used</dt><dd>${n}</dd></div><div><dt>Par</dt><dd>${lv.par}</dd></div><div><dt>Saws</dt><dd>${used.saw}</dd></div><div><dt>Planes</dt><dd>${used.plane}</dd></div><div><dt>Drills</dt><dd>${used.drill}</dd></div><div><dt>Waste left</dt><dd>${pct(Math.min(1, st.waste))}</dd></div>`;
  $("doneNote").textContent = stars === 3 ? (n < lv.par ? "Under par." : "") : `Par is ${lv.par}: ${lv.par === 1 ? "one use" : `${lv.par} uses`} will do it.`;
  const last = at === LEVELS.length - 1;
  $("nextBtn").textContent = last ? "Back to the first" : "Next part";
  $("nextBtn").dataset.next = String(last ? 0 : at + 1);
  if (!$("doneDlg").open) $("doneDlg").showModal();
  sound("done");
  roundOver("slipway");
}
$("nextBtn").addEventListener("click", () => { $("doneDlg").close(); start(Number($("nextBtn").dataset.next)); });
$("againBtn").addEventListener("click", () => { $("doneDlg").close(); start(at); });

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("Start this part again", () => restart(), "primary"));
  // the cog's parts in order: done with their stars, the one you're on, and those still locked
  const list = document.createElement("ol");
  list.className = "sw-parts";
  LEVELS.forEach((lv, i) => {
    const li = document.createElement("li"), b = document.createElement("button"), open = unlocked(i), stars = starsOf(lv.id);
    b.type = "button";
    b.disabled = !open;
    b.className = i === at ? "cur" : "";
    b.innerHTML = `<span>${i + 1}. ${lv.name}</span><small>${stars ? starText(stars) : open ? (i === at ? "in hand" : "") : "locked"}</small>`;
    b.addEventListener("click", () => { $("menuDlg").close(); if (i !== at) start(i); });
    li.append(b);
    list.append(li);
  });
  part(body, "content").append(list);
  part(body, "settings").append(
    toggle("The part's ghost", opts.ghost, on => { opts.ghost = on; saveOpts(); if (bench) bench.ghost = on; }),
    toggle("Sound", opts.sound, on => { opts.sound = on; saveOpts(); }));
  part(body, "about").append(line(`${totalStars()} of ${LEVELS.length * 3} stars. Three for the par, two for one tool over, one for freeing it at all.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "slipway");
document.querySelector(".sw-mark").innerHTML = APPS.find(a => a.id === "slipway")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
try {
  bench = (await import("./slipway-3d.js")).createBench($("bench"));
  bench.ghost = opts.ghost;
  const c = bench.canvas;
  c.addEventListener("pointerdown", onDown);
  c.addEventListener("pointermove", onMove);
  c.addEventListener("pointerup", onUp);
  c.addEventListener("pointercancel", onUp);
  c.addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && !pointers.size) bench.cursor(null); });
  c.addEventListener("contextmenu", e => e.preventDefault());
  c.addEventListener("wheel", e => { e.preventDefault(); bench.orbit(0, 0, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
} catch (err) {
  console.warn("Slipway: no WebGL here.", err);
  $("nogl").hidden = false;
}
load();
window.__slipway = { get block() { return B; }, get used() { return used; }, get done() { return done; }, get level() { return L(); }, bench: () => bench, start, finish, cutSaw, bore, planeStroke, giveHint, status: () => status(B), setTool: t => { tool = t; render(); } };
