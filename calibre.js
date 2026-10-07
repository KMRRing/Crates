// Calibre: learn watchmaking by drafting movements on the calibre plan. Each level gives a plate, the parts already
// fixed there and a tray; you place wheels and pinions on layers, the engine runs the train as it would really turn,
// and winding sets it going in time-lapse. Goals are met only when the watch truly keeps time.
import { judge, startDesign, solved, partsUsed, snap, radius, rateText, MODULE, DIAL_LAYERS, regulatorOf } from "./calibre-engine.js";
import { LEVELS, CHAPTERS } from "./calibre-levels.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const PROGRESS = "calibre:progress", AT = "calibre:at", SPEED = "calibre:speed";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.append(e); return e; };
const LAYER_NAMES = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "D1", 7: "D2" };   // D: the dial side
const HANDS = { centre: "minute", hours: "hour", seconds: "seconds" };
const SPEEDS = [[1, "Real time"], [60, "A minute a second"], [720, "Twelve minutes a second"]];

// ---------- state ----------
let level = null, design = null, tray = [], chosen = null, layer = 1, selected = null, view = null, nextId = 1;
let running = false, angles = {}, last = 0, verdict = null;
const progress = () => read(PROGRESS, {});

function load(id) {
  level = LEVELS.find(l => l.id === id) || LEVELS[0];
  write(AT, level.id);
  design = startDesign(level);
  tray = level.tray.map(t => ({ ...t, left: t.n }));
  chosen = null; selected = null; running = false; angles = {}; nextId = 1;
  layer = Math.min(...level.tray.filter(t => t.kind !== "balance").map(() => 1), 1);
  const R = level.plate + 0.8;
  view = { x: -R, y: -R, w: 2 * R, h: 2 * R };
  render();
  if (!progress()[level.id]?.seen) openPrimer();
}

// ---------- drawing ----------
const toothCache = new Map();
/** A wheel's outline: teeth round the pitch circle, an addendum out and a dedendum in, as a cutter would leave them. */
function toothPath(teeth) {
  if (toothCache.has(teeth)) return toothCache.get(teeth);
  const r = radius(teeth), out = r + MODULE, inn = r - MODULE * 1.25, step = (2 * Math.PI) / teeth;
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [da, rr] of [[-0.25, inn], [-0.12, out], [0.12, out], [0.25, inn]]) pts.push([Math.cos(a + da * step) * rr, Math.sin(a + da * step) * rr]);
  }
  const d = `M${pts.map(p => p.map(v => v.toFixed(3)).join(" ")).join("L")}Z`;
  toothCache.set(teeth, d);
  return d;
}

function render() {
  const svg = $("plan");
  svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  svg.replaceChildren();
  verdict = judge(level, design);
  const R = level.plate;
  el("circle", { cx: 0, cy: 0, r: R, class: "cb-plate" }, svg);
  for (let k = 1; k <= 12; k++) { const a = (k / 12) * 2 * Math.PI; el("line", { x1: Math.sin(a) * (R - 0.5), y1: -Math.cos(a) * (R - 0.5), x2: Math.sin(a) * R, y2: -Math.cos(a) * R, class: "cb-tick" }, svg); }
  const clashing = new Set(verdict.out.clashes.flatMap(c => c.arbors));
  // parts, lowest layer first, so higher layers lie on top as they would in the movement
  const parts = design.arbors.flatMap(a => (a.parts || []).filter(p => p.teeth).map(p => ({ a, p }))).sort((u, v) => u.p.layer - v.p.layer);
  for (const { a, p } of parts) {
    const g = el("g", { transform: `translate(${a.x} ${a.y}) rotate(${(angles[a.id] || 0) * 360})`, class: `cb-part cb-${p.kind}${p.layer === layer ? " on" : ""}${DIAL_LAYERS.includes(p.layer) ? " dial" : ""}${clashing.has(a.id) ? " clash" : ""}` }, svg);
    el("path", { d: toothPath(p.teeth) }, g);
    if (radius(p.teeth) > 1.2) { el("circle", { r: radius(p.teeth) * 0.62, class: "cb-web" }, g); for (let k = 0; k < 4; k++) el("line", { x1: 0, y1: 0, x2: Math.cos(k * Math.PI / 2) * radius(p.teeth) * 0.62, y2: Math.sin(k * Math.PI / 2) * radius(p.teeth) * 0.62, class: "cb-spoke" }, g); }
    el("title", {}, g).textContent = `${p.kind === "pinion" ? `${p.teeth}-leaf pinion` : `${p.teeth}-tooth ${p.kind}`}, layer ${LAYER_NAMES[p.layer] || p.layer}`;
  }
  for (const m of verdict.out.meshes) {
    const A = design.arbors.find(a => a.id === m.a), B = design.arbors.find(a => a.id === m.b), t = radius(m.ta) / (radius(m.ta) + radius(m.tb));
    el("circle", { cx: A.x + (B.x - A.x) * t, cy: A.y + (B.y - A.y) * t, r: 0.18, class: "cb-mesh" }, svg);
  }
  // hands on the arbors that carry them, and a balance where one is fitted
  for (const a of design.arbors) {
    const hand = HANDS[a.id];
    if (hand && (a.parts || []).length) {
      const len = hand === "hour" ? R * 0.42 : hand === "minute" ? R * 0.62 : R * 0.18;
      const g = el("g", { transform: `translate(${a.x} ${a.y}) rotate(${(angles[a.id] || 0) * 360})`, class: `cb-hand cb-${hand}` }, svg);
      el("line", { x1: 0, y1: 0, x2: 0, y2: -len }, g);
    }
    if (regulatorOf(a)) {
      const swing = running ? Math.sin(performance.now() / 1000 * Math.PI * regulatorOf(a).vph / 3600) * 40 : 0;
      const g = el("g", { transform: `translate(${a.x - 2.2} ${a.y - 1.6}) rotate(${swing})`, class: "cb-balance" }, svg);
      el("circle", { r: 1.3 }, g); el("line", { x1: -1.3, y1: 0, x2: 1.3, y2: 0 }, g);
    }
  }
  for (const a of design.arbors) {
    const pin = el("circle", { cx: a.x, cy: a.y, r: a.noParts ? 0.35 : 0.22, class: `cb-pivot${a.fixed ? " fixed" : ""}${selected === a.id ? " sel" : ""}${a.noParts ? " post" : ""}`, "data-arbor": a.id }, svg);
    el("title", {}, pin).textContent = a.label || "Arbor";
    if (a.label && a.fixed && !a.on) { const t = el("text", { x: a.x, y: a.y + 0.9, class: "cb-label" }, svg); t.textContent = a.label.replace(/ \(.*\)$/, ""); }
  }
  renderBrief(); renderTray(); renderLayers(); renderInspect();
}

function renderBrief() {
  const ch = CHAPTERS.find(c => c.id === level.chapter);
  $("where").textContent = `${ch.id}. ${ch.title} · ${level.id} ${level.title}`;
  const p = progress()[level.id];
  $("stars").textContent = p?.stars ? "★".repeat(p.stars) + "☆".repeat(3 - p.stars) : "";
  $("task").textContent = level.task;
  $("goals").replaceChildren(...verdict.goals.map(g => {
    const li = document.createElement("li"), a = design.arbors.find(x => x.id === g.goal.arbor);
    li.className = g.ok ? "ok" : "";
    li.textContent = `${a?.label?.replace(/ \(.*\)$/, "") || g.goal.arbor}: ${g.goal.abs ? rateText(Math.abs(g.goal.rate)).replace(/, clockwise$/, ", either way") : rateText(g.goal.rate)} · now ${rateText(g.actual)}`;
    return li;
  }), ...verdict.problems.slice(0, 2).map(t => { const li = document.createElement("li"); li.className = "bad"; li.textContent = t; return li; }));
}

function renderTray() {
  $("tray").replaceChildren(...tray.map((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cb-chip cb-${t.kind}${chosen === i ? " on" : ""}`;
    b.disabled = !t.left;
    b.textContent = t.kind === "balance" ? `Balance ${t.vph.toLocaleString("en-GB")} vph` : `${t.teeth} ${t.kind === "pinion" ? "leaves" : "teeth"}${t.n > 1 ? ` ×${t.left}` : ""}`;
    b.setAttribute("aria-pressed", chosen === i);
    b.addEventListener("click", () => { chosen = chosen === i ? null : i; selected = null; renderTray(); renderInspect(); });
    return b;
  }));
  if (!tray.length) $("tray").textContent = "Nothing to add: change what's there.";
}

function renderLayers() {
  const used = [1, 2, 3, 4, 5, 6, 7].filter(n => n <= 2 || design.arbors.some(a => (a.parts || []).some(p => p.layer >= n - 1)) || DIAL_LAYERS.includes(n) && level.chapter >= 4);
  $("layers").replaceChildren(...used.map(n => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `cb-layer${layer === n ? " on" : ""}${DIAL_LAYERS.includes(n) ? " dial" : ""}`;
    b.textContent = LAYER_NAMES[n]; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", layer === n);
    b.title = DIAL_LAYERS.includes(n) ? `Dial side, layer ${n - 5}: under the dial, for the motion works` : `Layer ${n}, between the plate and the bridges`;
    b.addEventListener("click", () => { layer = n; render(); });
    return b;
  }));
}

function renderInspect() {
  const box = $("inspect"), a = design.arbors.find(x => x.id === selected);
  if (!a) { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren();
  const h = document.createElement("p"); h.className = "cb-in-head"; h.textContent = `${a.label || "Arbor"} · ${rateText(verdict.out.rates[a.id])}`;
  box.append(h);
  for (const [i, p] of (a.parts || []).entries()) {
    const row = document.createElement("p"); row.className = "cb-in-row";
    row.textContent = p.kind === "balance" ? `Balance, ${p.vph.toLocaleString("en-GB")} vph` : `${p.teeth}-${p.kind === "pinion" ? "leaf pinion" : `tooth ${p.kind}`}, layer ${LAYER_NAMES[p.layer] || p.layer}`;
    if (!p.fixed) {
      const x = document.createElement("button"); x.type = "button"; x.className = "cb-x"; x.textContent = "Remove";
      x.addEventListener("click", () => removePart(a, i));
      row.append(x);
    }
    box.append(row);
  }
  if (a.placed) {
    const x = document.createElement("button"); x.type = "button"; x.className = "cb-x"; x.textContent = "Take out the whole arbor";
    x.addEventListener("click", () => { design.arbors = design.arbors.filter(y => y !== a); selected = null; render(); });
    box.append(x);
  }
}

// ---------- placing ----------
function removePart(a, i) {
  const p = a.parts[i];
  const t = tray.find(t => t.kind === p.kind && (t.teeth ?? t.vph) === (p.teeth ?? p.vph));
  if (t) t.left++;
  a.parts.splice(i, 1);
  if (!a.fixed && !a.placed && !a.parts.length) { design.arbors = design.arbors.filter(x => x !== a); selected = null; }
  render();
}

function place(x, y) {
  const t = tray[chosen];
  if (!t?.left) return;
  const hit = arborAt(x, y);
  const partLayer = t.kind === "balance" ? 10 : layer;
  const piece = t.kind === "balance" ? { kind: "balance", vph: t.vph, layer: 10 } : { kind: t.kind, teeth: t.teeth, layer: partLayer };
  if (hit) {
    if (hit.noParts) return toast("That's a post: nothing goes on it.");
    if (piece.kind === "balance" && !(hit.parts || []).some(p => p.kind === "escape")) return toast("A balance goes beside the escape wheel.");
    if ((hit.parts || []).some(p => p.layer === partLayer)) return toast(`That arbor already has a part on layer ${LAYER_NAMES[partLayer]}.`);
    hit.parts.push(piece);
  } else {
    if (piece.kind === "balance") return toast("A balance goes beside the escape wheel: tap the escape wheel.");
    const s = snap(design, x, y, t.teeth, partLayer);
    design.arbors.push({ id: `a${nextId++}`, x: s ? s.x : x, y: s ? s.y : y, parts: [piece] });
  }
  t.left--;
  if (!t.left) chosen = null;
  render();
}

function arborAt(x, y) {
  let best = null, bd = Infinity;
  for (const a of design.arbors) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } }
  return bd <= Math.max(0.5, view.w / 40) ? best : null;
}

// ---------- the plate: tap, drag, pinch, wheel ----------
const svg = $("plan"), pointers = new Map();
let gesture = null;
const toPlan = (cx, cy) => { const b = svg.getBoundingClientRect(), k = Math.max(view.w / b.width, view.h / b.height); return [view.x + (cx - b.left - (b.width - view.w / k) / 2) * k, view.y + (cy - b.top - (b.height - view.h / k) / 2) * k]; };
function zoomAt(f, cx, cy) {
  const [px, py] = cx == null ? [view.x + view.w / 2, view.y + view.h / 2] : toPlan(cx, cy), R = level.plate + 0.8;
  const w = Math.min(2 * R * 1.5, Math.max(3, view.w * f)), k = w / view.w;
  view = { x: px - (px - view.x) * k, y: py - (py - view.y) * k, w, h: view.h * k };
  render();
}
svg.addEventListener("pointerdown", e => {
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (pts.length === 1) {
    const [x, y] = toPlan(e.clientX, e.clientY), a = arborAt(x, y);
    gesture = { kind: a && !a.fixed && chosen == null ? "move" : "pan", a, from: pts[0], view: { ...view }, moved: false };
  } else gesture = { kind: "pinch", d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), w: view.w };
});
svg.addEventListener("pointermove", e => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (gesture.kind === "pinch" && pts.length >= 2) {
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    zoomAt(gesture.w * gesture.d / Math.max(1, d) / view.w, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
    return;
  }
  if (Math.hypot(pts[0].x - gesture.from.x, pts[0].y - gesture.from.y) > 6) gesture.moved = true;
  if (!gesture.moved) return;
  if (gesture.kind === "move") {
    const [x, y] = toPlan(e.clientX, e.clientY), first = gesture.a.parts.find(p => p.teeth);
    const s = first && snap(design, x, y, first.teeth, first.layer, gesture.a.id);
    gesture.a.x = s ? s.x : x; gesture.a.y = s ? s.y : y;
    render();
  } else {
    const b = svg.getBoundingClientRect(), k = Math.max(view.w / b.width, view.h / b.height);
    view = { ...gesture.view, x: gesture.view.x - (pts[0].x - gesture.from.x) * k, y: gesture.view.y - (pts[0].y - gesture.from.y) * k };
    render();
  }
});
const lift = e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (gesture && !gesture.moved && gesture.kind !== "pinch" && e.type === "pointerup") {
    const [x, y] = toPlan(e.clientX, e.clientY);
    if (chosen != null) place(x, y);
    else { const a = arborAt(x, y); selected = a ? a.id : null; render(); }
  }
  if (!pointers.size) gesture = null;
};
svg.addEventListener("pointerup", lift);
svg.addEventListener("pointercancel", lift);
svg.addEventListener("wheel", e => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
$("zoomIn").addEventListener("click", () => zoomAt(1 / 1.5));
$("zoomOut").addEventListener("click", () => zoomAt(1.5));

// ---------- winding: run it ----------
function wind() {
  verdict = judge(level, design);
  running = true; last = performance.now();
  requestAnimationFrame(tick);
  if (verdict.ok) {
    const used = partsUsed(design), stars = used <= level.par ? 3 : used <= level.par + 2 ? 2 : 1;
    const all = progress(), before = all[level.id] || {};
    all[level.id] = { ...before, seen: true, stars: Math.max(stars, before.stars || 0), parts: Math.min(used, before.parts ?? Infinity) };
    write(PROGRESS, all);
    const next = LEVELS[LEVELS.indexOf(level) + 1];
    $("doneTitle").textContent = "It runs";
    const body = $("doneBody"); body.replaceChildren();
    const p = document.createElement("p"); p.className = "cb-done-stars"; p.textContent = "★".repeat(stars) + "☆".repeat(3 - stars); body.append(p);
    const q = document.createElement("p"); q.textContent = `${used} part${used === 1 ? "" : "s"}, par ${level.par}.${stars < 3 ? " Fewer parts would earn all three stars." : ""}`; body.append(q);
    if (next) body.append(action(`Next: ${next.id} ${next.title}`, () => { $("doneDlg").close(); load(next.id); }, "primary"));
    else body.append(line("That's the course so far. More chapters are coming."));
    body.append(action("Watch it run", () => $("doneDlg").close()));
    setTimeout(() => $("doneDlg").showModal(), 900);
  } else toast(verdict.problems[0] || "Not yet: the goals show what's turning and what should.");
  render();
}
function tick(now) {
  if (!running) return;
  const dt = Math.min(0.1, (now - last) / 1000), speed = read(SPEED, 60);
  last = now;
  for (const [id, r] of Object.entries(verdict.out.rates)) if (r) angles[id] = ((angles[id] || 0) + (r * speed * dt) / 3600) % 1;
  render();
  requestAnimationFrame(tick);
}
$("windBtn").addEventListener("click", () => { if (running) { running = false; render(); } else wind(); $("windBtn").textContent = running ? "Stop" : "Wind"; });

// ---------- sheets ----------
function openPrimer() {
  $("primerTitle").textContent = `${level.id} ${level.title}`;
  const body = $("primerBody"); body.replaceChildren();
  for (const t of level.primer) { const p = document.createElement("p"); p.textContent = t; body.append(p); }
  const how = document.createElement("p"); how.className = "cb-how";
  how.textContent = "Choose a part below, pick its layer, then tap the plate: on an arbor to add it there, or near a wheel to set a new arbor that meshes with it. Drag your own arbors to move them; tap one to see how it turns or take a part off. Wind to run it.";
  body.append(how);
  const all = progress(); all[level.id] = { ...(all[level.id] || {}), seen: true }; write(PROGRESS, all);
  if (!$("primerDlg").open) $("primerDlg").showModal();
}
function openCourse() {
  const body = $("courseBody"), all = progress(); body.replaceChildren();
  for (const ch of CHAPTERS) {
    const h = document.createElement("h3"); h.textContent = `${ch.id}. ${ch.title}`; body.append(h);
    const about = document.createElement("p"); about.className = "cb-ch-about"; about.textContent = ch.about; body.append(about);
    for (const L of LEVELS.filter(l => l.chapter === ch.id)) {
      const b = document.createElement("button"); b.type = "button"; b.className = `cb-level${L.id === level.id ? " here" : ""}`;
      const st = all[L.id]?.stars;
      b.innerHTML = `<span>${L.id} ${L.title}</span><span class="cb-stars">${st ? "★".repeat(st) + "☆".repeat(3 - st) : ""}</span>`;
      b.addEventListener("click", () => { $("courseDlg").close(); load(L.id); });
      body.append(b);
    }
  }
  $("courseDlg").showModal();
}
function openMenu() {
  const body = $("menuBody"); body.replaceChildren();
  part(body, "play").append(action("Start this level again", () => { $("menuDlg").close(); load(level.id); }, "primary"),
    action("How it works", () => { $("menuDlg").close(); openPrimer(); }));
  part(body, "content").append(choice("Speed", SPEEDS, read(SPEED, 60), v => write(SPEED, v)));
  part(body, "about").append(action("Show a solution", () => {
    $("menuDlg").close();
    design = solved(level); tray.forEach(t => { t.left = 0; }); chosen = null; render();
    toast("One way to do it. Others work too.");
  }), line(`${Object.values(progress()).filter(p => p.stars).length} of ${LEVELS.length} levels running.`));
  $("menuDlg").showModal();
}
let toastTimer = 0;
function toast(t) { const e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => e.classList.remove("on"), 3200); }

// ---------- wiring ----------
document.querySelector(".cb-mark").innerHTML = APPS.find(a => a.id === "calibre")?.logo || "";
bindSwitcher($("appsBtn"), "calibre");
$("primerBtn").addEventListener("click", openPrimer);
$("primerClose").addEventListener("click", () => $("primerDlg").close());
$("courseBtn").addEventListener("click", openCourse);
$("courseClose").addEventListener("click", () => $("courseDlg").close());
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
load(read(AT, null) || (LEVELS.find(l => !progress()[l.id]?.stars) || LEVELS[0]).id);
