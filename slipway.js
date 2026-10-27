// Slipway: a ship's parts carved by hand, one block of timber at a time. Each part's ghost lies in the block; slide it
// along the block (or turn it end for end) to keep the knots out of it, then work the wood away: the saw cuts straight
// through along the line you draw, the plane shaves where you stroke it, the chisel takes chips, the drill bores
// straight in along your line of sight, the sandpaper smooths. Two fingers (or the Turn tool) turn the block round.
// Finish grades it: how little waste is left, how little of the part you cut into, and whether a knot is in it. The
// cutting and the grade are slipway-carve.js's, the bench slipway-3d.js's; this file takes the strokes and keeps it.
import { PARTS, SLACK, newBlock, place, saw, plane, chisel, drill, sand, hit, grade, pack, unpack, normalAt, steady, exposed, planeCut } from "./slipway-carve.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line, toggle } from "./menu.js";
import { roundOver } from "./random.js";
import { IN_FRAME } from "./suite.js";
import { createFit } from "./slipway-fit.js";
import { starsTotal, ASSEMBLIES } from "./slipway-yard.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const CARVE = "slipway:carve", MADE = "slipway:parts", BEST = "slipway:best", OPTS = "slipway:opts", FITTED = "slipway:fitted";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const pct = x => `${Math.round(x * 100)}%`;
const starsOf = score => (score >= 90 ? 3 : score >= 75 ? 2 : score >= 55 ? 1 : 0);
const starText = n => "★".repeat(n) + "☆".repeat(3 - n);

// Slipway was a merge game until 19 October 2026: its best was a score in the tens of thousands, which isn't a count of
// stars, so it's kept apart where the games screen doesn't read it.
{
  const old = read(BEST, null);
  if (!read(CARVE, null) && typeof old === "number" && old > PARTS.length * 3) { write("slipway:yard-best", old); write(BEST, 0); }
}

let opts = { sound: true, ghost: true, ...read(OPTS, {}) };
const saveOpts = () => write(OPTS, opts);

// ---------- the tools ----------
const ICON = {
  turn: `<path d="M5 12a7 7 0 0 1 12-5l2-2v6h-6l2.2-2.2A4.6 4.6 0 0 0 7.4 12"/><path d="M19 12a7 7 0 0 1-12 5l-2 2v-6h6l-2.2 2.2A4.6 4.6 0 0 0 16.6 12"/>`,
  saw: `<path d="M3 15l12-12 3 3-12 12z"/><path d="M5 17l-1.5 1.5M8 14l-1.5 1.5M11 11l-1.5 1.5M14 8l-1.5 1.5"/><path d="M15 3l6 6-2 2"/>`,
  plane: `<path d="M3 16h18v3H3z"/><path d="M6 16l3-6h7l2 6"/><path d="M12 10V6l3-2"/>`,
  chisel: `<path d="M4 20l5-5"/><path d="M8 13l3 3 9-9-3-3z"/><path d="M17 4l3 3"/>`,
  drill: `<path d="M4 8h9v6H4z"/><path d="M13 10h4l3 1-3 1h-4"/><path d="M6 14v6h4v-6"/>`,
  sand: `<path d="M4 9h16v8H4z"/><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 14.5h.01M12 14.5h.01M16 14.5h.01"/>`,
};
const TOOLS = [["turn", "Turn"], ["saw", "Saw"], ["plane", "Plane"], ["chisel", "Chisel"], ["drill", "Drill"], ["sand", "Sand"]];
const REACH = { plane: 3.4, chisel: 1.25, drill: 1.5, sand: 2.4 };      // the cursor's radius, in cells, as the tool cuts
let tool = "saw";

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
  plane: () => noise(110, { lo: 1800, hi: 9000, gain: 0.16, decay: 1.4 }),
  chisel: () => noise(45, { lo: 600, hi: 3000, gain: 0.3, decay: 3 }),
  drill: () => noise(420, { lo: 300, hi: 1600, gain: 0.22, decay: 0.4, rate: 30 }),
  sand: () => noise(90, { lo: 3000, hi: 11000, gain: 0.1, decay: 1 }),
  gale: () => noise(2400, { lo: 150, hi: 900, gain: 0.3, decay: 0.25, rate: 5 }),
};
let lastSound = 0;
const sound = kind => { const t = performance.now(); if (t - lastSound > (kind === "plane" || kind === "sand" ? 90 : 30)) { lastSound = t; SOUND[kind](); } };

// ---------- the block and its keeping ----------
let B = null;              // the block (slipway-carve.js's)
let run = null;            // { part, seed, started }
let undo = [];             // the block's wood before each stroke, the last ten
let bench = null;
let fit = null;            // the yard (slipway-fit.js)
const made = () => read(MADE, {});
const unlocked = i => i === 0 || (made()[PARTS[i - 1].id] ?? 0) >= 55;

let saveTimer = 0;
function save(now = false) {
  clearTimeout(saveTimer);
  const go = () => write(CARVE, { v: 1, part: run.part, seed: run.seed, off: B.off, flip: B.flip, started: run.started, d: pack(B.d) });
  if (now) go(); else saveTimer = setTimeout(go, 350);
}
function start(i, seed = (Math.random() * 2 ** 31) >>> 0) {
  run = { part: i, seed, started: false };
  B = newBlock(i, seed);
  undo = [];
  bench?.setBlock(B);
  save(true);
  render();
}
function load() {
  const s = read(CARVE, null);
  if (!s || s.v !== 1 || !PARTS[s.part]) { start(0); return; }
  run = { part: s.part, seed: s.seed, started: !!s.started };
  B = newBlock(s.part, s.seed);
  place(B, s.off, s.flip);
  if (typeof s.d === "string") B.d = unpack(s.d, B.d.length);
  bench?.setBlock(B);
  render();
}
function snapshot() { undo.push(B.d.slice()); if (undo.length > 10) undo.shift(); }
function touched() {
  if (!run.started) { run.started = true; render(); }
}

// ---------- drawing the page ----------
function render() {
  if (fit?.open) { fit.render(); return; }
  const p = PARTS[run.part], best = made()[p.id];
  $("partName").textContent = p.name;
  $("partNo").textContent = `${run.part + 1} of ${PARTS.length} · the cog`;
  $("partStars").textContent = best != null ? starText(starsOf(best)) : "";
  $("tools").innerHTML = TOOLS.map(([id, name]) => `<button type="button" class="sw-tool${tool === id ? " on" : ""}" data-tool="${id}" aria-pressed="${tool === id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg><span>${name}</span></button>`).join("");
  const nextView = VIEW_NAMES[(viewAt + 1) % VIEW_NAMES.length];
  $("acts").innerHTML = run.started
    ? `<button type="button" class="btn sw-act" data-act="undo" ${undo.length ? "" : "disabled"}>Undo</button><button type="button" class="btn sw-act" data-act="view">${nextView[1]}</button><button type="button" class="btn primary sw-act" data-act="finish">Finish</button>`
    : `<button type="button" class="btn sw-act" data-act="left" aria-label="Slide the part left" ${B.off > 0 ? "" : "disabled"}>◀</button><button type="button" class="btn sw-act" data-act="flip">End for end</button><button type="button" class="btn sw-act" data-act="right" aria-label="Slide the part right" ${B.off < SLACK ? "" : "disabled"}>▶</button><button type="button" class="btn sw-act" data-act="view">${nextView[1]}</button>`;
  sayGrade();
}
function sayGrade() {
  const p = PARTS[run.part];
  if (!run.started) {
    const g = grade(B);
    const tools = p.tools.split(", "), list = tools.length > 1 ? `${tools.slice(0, -1).join(", ")} and ${tools.at(-1)}` : tools[0];
    $("line").innerHTML = `${p.line}${g.knots ? ` <b>A knot is in the outline: slide it clear.</b>` : ` <b>With the ${list}.</b>`}`;
    return;
  }
  const g = grade(B);
  // the waste as a share of the block while there's lots of it, then as a share of the part, which is what's graded
  const waste = g.over < 1 ? `Waste on it <b>${pct(g.over)}</b>` : `Waste left <b>${pct(g.waste)}</b>`;
  $("line").innerHTML = `${waste} · into the part <b class="${g.into > 0.005 ? "bad" : ""}">${pct(g.into)}</b>${g.knots ? ` · <b class="bad">${g.knots === 1 ? "a knot" : `${g.knots} knots`} in it</b>` : ""} · <b>${starText(g.stars)}</b>`;
}

// ---------- pointing at the bench ----------
const pointers = new Map();
let mode = null, last = null, sawFrom = null, pinch = 0, moved = 0, refreshQueued = false;
function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => { refreshQueued = false; bench.refresh(); sayGrade(); save(); });
}
/**
 * The tool at a point of the screen: true if it took wood. A stroke takes only what was open to the air when it began
 * (the block's mask, slipway-carve.js's exposed), so it can't run away into the wood; the plane's sole keeps the facing
 * it had where the stroke began.
 */
let ref = null;                                                          // the plane's facing and height for this stroke
function cutAt(x, y) {
  const r = bench.ray(x, y), h = hit(B, r.o, r.d);
  if (!h) return false;
  const p = h.p;
  let n = h.n;
  // the sole rests on the highest wood it has passed over this stroke, so it never sinks into a hollow and digs
  if (tool === "plane") { if (!ref) { const f = steady(normalAt(B, ...p, 1.8)); ref = { n: f, cut: -Infinity }; } n = ref.n; ref.cut = Math.max(ref.cut, planeCut(p, n)); }
  const took = tool === "plane" ? plane(B, p, n, ref.cut) : tool === "chisel" ? chisel(B, p, n) : sand(B, p);
  if (took > 0.02) { touched(); sound(tool); return true; }
  return false;
}
function showCursor(x, y) {
  if (!REACH[tool]) { bench.cursor(null); return; }
  const r = bench.ray(x, y), h = hit(B, r.o, r.d);
  bench.cursor(h ? h.p : null, h ? h.n : null, REACH[tool]);
}
function sawLine(a, b) {
  $("over").innerHTML = a ? `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="sw-cut"/><circle cx="${a[0]}" cy="${a[1]}" r="4" class="sw-cut-end"/><circle cx="${b[0]}" cy="${b[1]}" r="4" class="sw-cut-end"/>` : "";
}
const local = e => { const r = bench.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
function onDown(e) {
  if (IN_FRAME || !bench) return;
  e.preventDefault();
  bench.canvas.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2) {
    if (mode === "saw") sawLine(null);
    mode = "orbit2";
    const [a, b] = [...pointers.values()];
    pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
    last = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return;
  }
  if (pointers.size > 2) return;
  last = [e.clientX, e.clientY];
  moved = 0;
  if (tool === "turn" || e.button === 2 || e.button === 1) mode = "orbit1";      // a mouse turns the block with its right or middle button
  else if (tool === "saw") { mode = "saw"; sawFrom = local(e); sawLine(sawFrom, sawFrom); }
  else if (tool === "drill") mode = "drill";
  else { mode = "stroke"; ref = null; snapshot(); B.mask = tool === "chisel" ? exposed(B) : null; if (cutAt(e.clientX, e.clientY)) queueRefresh(); }
}
function onMove(e) {
  if (!bench) return;
  if (!pointers.has(e.pointerId)) { if (e.pointerType === "mouse" && !IN_FRAME) showCursor(e.clientX, e.clientY); return; }
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
  } else if (mode === "saw") sawLine(sawFrom, local(e));
  else if (mode === "stroke") {
    // the stroke laid down every few pixels, so a quick swipe cuts as evenly as a slow one
    const dist = Math.hypot(e.clientX - last[0], e.clientY - last[1]), step = tool === "chisel" ? 3 : 4;
    let any = false;
    for (let s = step; s <= dist; s += step) any = cutAt(last[0] + (e.clientX - last[0]) * s / dist, last[1] + (e.clientY - last[1]) * s / dist) || any;
    if (dist >= step) last = [e.clientX, e.clientY];
    if (any) queueRefresh();
    showCursor(e.clientX, e.clientY);
  } else if (mode === "drill") showCursor(e.clientX, e.clientY);
}
function onUp(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (mode === "orbit2") { if (!pointers.size) mode = null; else { mode = "done"; } return; }
  if (pointers.size) return;
  if (mode === "saw") {
    const end = local(e);
    sawLine(null);
    if (Math.hypot(end[0] - sawFrom[0], end[1] - sawFrom[1]) >= 24) cutSaw(sawFrom, end);
  } else if (mode === "drill" && moved < 10) bore(e.clientX, e.clientY);
  else if (mode === "stroke" && undo.length && undo[undo.length - 1].every((v, i) => v === B.d[i])) undo.pop();   // a stroke that took nothing isn't one to undo
  mode = null;
  B.mask = null;
  if (e.pointerType !== "mouse") bench.cursor(null);
  render();
}
/** The saw along a line drawn on the screen: the cut is the plane through your eye and that line. */
function cutSaw(a, b) {
  const r = bench.canvas.getBoundingClientRect(), ra = bench.ray(a[0] + r.left, a[1] + r.top), rb = bench.ray(b[0] + r.left, b[1] + r.top);
  const n = [ra.d[1] * rb.d[2] - ra.d[2] * rb.d[1], ra.d[2] * rb.d[0] - ra.d[0] * rb.d[2], ra.d[0] * rb.d[1] - ra.d[1] * rb.d[0]];
  const len = Math.hypot(...n);
  if (len < 1e-6) return;
  const u = n.map(v => v / len), o = bench.eye(), c = -(u[0] * o[0] + u[1] * o[1] + u[2] * o[2]);
  snapshot();
  const before = B.d.slice(), res = saw(B, u, c);
  if (res.took < 0.5) { undo.pop(); toast("The cut missed the wood"); return; }
  const gone = new Uint8Array(before.length);
  for (let i = 0; i < gone.length; i++) gone[i] = before[i] - B.d[i];
  bench.offcut(gone, u.map(v => v * res.side));
  touched();
  sound("saw");
  if (res.into) toast("That cut went into the part");
  queueRefresh();
  setTimeout(() => bench.reframe(), 380);                                   // once the offcut is away, close in on what's left
}
/** The drill, straight in along the line of sight from where you tap. */
function bore(x, y) {
  const r = bench.ray(x, y), h = hit(B, r.o, r.d);
  if (!h) return;
  snapshot();
  if (drill(B, h.p, r.d) < 0.3) { undo.pop(); return; }
  touched();
  sound("drill");
  queueRefresh();
}

// ---------- the buttons ----------
const VIEW_NAMES = [["start", "Corner"], ["side", "Side"], ["top", "Top"], ["end", "End"]];
let viewAt = 0;
$("tools").addEventListener("click", e => {
  const b = e.target.closest("[data-tool]");
  if (!b) return;
  tool = b.dataset.tool;
  bench?.cursor(null);
  render();
});
$("acts").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === "view") { viewAt = (viewAt + 1) % VIEW_NAMES.length; bench?.view(VIEW_NAMES[viewAt][0]); render(); return; }
  if (act === "left" || act === "right" || act === "flip") {
    place(B, B.off + (act === "left" ? -2 : act === "right" ? 2 : 0), act === "flip" ? !B.flip : B.flip);
    bench?.replaced();
    save();
    render();
    return;
  }
  if (act === "undo" && undo.length) {
    B.d = undo.pop();
    run.started = B.d.some(v => v < 255);
    bench.refresh();
    bench.reframe();
    save();
    render();
    return;
  }
  if (act === "finish") finish();
});

// ---------- a part finished ----------
function finish() {
  const p = PARTS[run.part], g = grade(B), all = made(), before = all[p.id];
  $("doneHead").textContent = g.stars ? `${p.name}: ${["", "it'll serve", "well made", "a shipwright's work"][g.stars]}` : `${p.name}: not good enough yet`;
  $("doneStars").textContent = starText(g.stars);
  $("doneBody").innerHTML = `<div><dt>Waste on it</dt><dd>${pct(Math.min(9.99, g.over))}</dd></div><div><dt>Cut into the part</dt><dd>${pct(g.into)}</dd></div><div><dt>Knots in it</dt><dd>${g.knots}</dd></div><div><dt>Score</dt><dd>${g.score}</dd></div>`;
  $("doneNote").textContent = g.stars
    ? (before != null && before >= g.score ? `Your best for it is ${before}.` : before != null ? `Better than your ${before} before.` : "")
    : "A star needs 55: take off more of the waste, and keep the tools out of the part.";
  if (g.stars && (before == null || g.score > before)) {
    all[p.id] = g.score;
    write(MADE, all);
    write(BEST, starsTotal(all, read(FITTED, {})));
    fit?.parts();
  }
  const last = run.part === PARTS.length - 1;
  $("nextBtn").textContent = !g.stars ? "Keep carving" : last ? "Back to the first" : "Next part";
  $("nextBtn").dataset.next = !g.stars ? "stay" : last ? "0" : String(run.part + 1);
  $("againBtn").textContent = g.stars ? "Carve it again" : "A fresh block";
  if (!$("doneDlg").open) $("doneDlg").showModal();
  if (g.stars) roundOver("slipway");                       // a part made (not yet good enough, it's carved on)
}
$("nextBtn").addEventListener("click", () => {
  $("doneDlg").close();
  const n = $("nextBtn").dataset.next;
  if (n !== "stay") start(Number(n));
});
$("againBtn").addEventListener("click", () => { $("doneDlg").close(); start(run.part); });

// ---------- messages, the menu ----------
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const set = (...rows) => part(body, "settings").append(...rows);
  if (fit.open) fit.menu(body);
  else {
    part(body, "play").append(action("A fresh block for this part", () => start(run.part), "primary"), action("To the yard: fit the parts together", () => setMode("yard")));
    // the cog's parts in order: done with their stars, the one you're on, and those still locked
    const list = document.createElement("ol"), all = made();
    list.className = "sw-parts";
    PARTS.forEach((p, i) => {
      const li = document.createElement("li"), b = document.createElement("button"), open = unlocked(i), score = all[p.id];
      b.type = "button";
      b.disabled = !open;
      b.className = i === run.part ? "cur" : "";
      b.innerHTML = `<span>${i + 1}. ${p.name}</span><small>${score != null ? starText(starsOf(score)) : open ? (i === run.part ? "carving" : "") : "locked"}</small>`;
      b.addEventListener("click", () => { $("menuDlg").close(); if (i !== run.part) start(i); });
      li.append(b);
      list.append(li);
    });
    part(body, "content").append(list);
    set(toggle("The part's ghost", opts.ghost, on => { opts.ghost = on; saveOpts(); if (bench) bench.ghost = on; }));
  }
  set(toggle("Sound", opts.sound, on => { opts.sound = on; saveOpts(); }));
  const stars = read(BEST, 0);
  part(body, "about").append(line(stars ? `${stars} of ${PARTS.length * 3 + ASSEMBLIES.length * 3} stars: the cog's parts carved and the assemblies fitted.` : "Nothing finished yet."));
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
/** The bench or the yard on the screen. */
function setMode(m) {
  document.querySelectorAll(".sw-modes button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.mode === m)));
  if (m === "yard") fit.show(); else { fit.hide(); render(); }
}
document.querySelector(".sw-modes").addEventListener("click", e => {
  const b = e.target.closest("[data-mode]");
  if (b && !IN_FRAME && (b.dataset.mode === "yard") !== fit.open) setMode(b.dataset.mode);
});
fit = createFit({ $, read, write, scores: made, toast, sound, setMode, sayBest: n => { write(BEST, n); roundOver("slipway"); }, IN_FRAME });   // told once an assembly holds
load();
document.querySelectorAll(".sw-modes button").forEach(b => b.setAttribute("aria-selected", String((b.dataset.mode === "yard") === fit.open)));
window.__slipway = { fit, get block() { return B; }, get run() { return run; }, bench: () => bench, start, finish, cutSaw, bore, cutAt, setTool: t => { tool = t; render(); } };
