// Calibre: learn watchmaking by drafting movements on the calibre plan. Each level gives a plate, the parts already
// fixed there and a tray; you place wheels and pinions on layers, the engine runs the train as it would really turn,
// and winding sets it going in time-lapse. Goals are met only when the watch truly keeps time.
import { judge, inState, MONTHS, CENTURIES, amplitudeOf, startDesign, solved, partsUsed, snap, snapEscapement, radius, rateText, workings, MODULE, DIAL_LAYERS, MAINSPRING_TURNS } from "./calibre-engine.js";
import { LEVELS, CHAPTERS, GLOSSARY } from "./calibre-levels.js";
import { LAYER_NAMES, partName, chipName, arborName, drawDesign, reachOf, extentOf } from "./calibre-draw.js";
import { draw3d, CAM } from "./calibre-3d.js";
import { lessonFor, TEACHES } from "./calibre-lessons.js";
import { playScene, drawThumb, workAround } from "./calibre-scenes.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const PROGRESS = "calibre:progress", AT = "calibre:at", SPEED = "calibre:speed", WORK = "calibre:work", VIEW = "calibre:view";
const KEEP_WORK = 12;                   // levels whose design is kept, the most recently changed
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
// parts that can only sit at one height: the barrel at the bottom, the ratchet on top of it, the escapement above the
// train, calendar fingers and discs on the dial side
const FORCED = { barrel: 1, ratchet: 5, escape: 9, fork: 9, balance: 10, finger: 8, star: 8, heart: 6, rotor: 12, reverser: 11, cam: 8, snail: 8, column: 7, cage: 9, trip: 8, lever: 6, fusee: 5, remontoire: 5, mainspring: 5, kidney: 8, century: 8 };
const SPEEDS = [[1, "Real time"], [60, "A minute a second"], [720, "Twelve minutes a second"]];

// ---------- state ----------
let level = null, design = null, tray = [], chosen = null, layer = 1, selected = null, view = null, nextId = 1, history = [], hintAt = 0, showWork = false, scene = 0;
// what the plan isolates, drawing it full and the rest faint: a step of the workings ({ by: "work", at }: its two
// arbors and their mesh lit, or the whole path), or an arbor with what drives it and what it drives ({ by: "arbor", id })
let isolate = null, viewBefore = null;                         // viewBefore: the plan's view before it framed what's isolated
let verdict = null, last = 0, toastTimer = 0;
// the view: the plan, or the stack in 3D (cam: its angles in degrees, zoom and pan; scene3d: the drawing's handle)
let view3d = !!read(VIEW, false), cam = { ...CAM }, scene3d = null, camAnim = 0;
const SELECTABLE = [1, 2, 3, 4, 5, 6, 7, 8, 11, 12];             // the layers you choose (9 and 10 go with their parts)
// The simulation: the angle of every arbor (in turns), how wound the mainspring is (0 to 1), the barrel arbor's turn
// while winding, the balance's swing and the fork's rock (degrees), and what the movement is doing.
const TURNS = MAINSPRING_TURNS;                                   // a fully wound mainspring gives the barrel five turns
let sim = { angles: {}, base: {}, wound: 0, windAngle: 0, balance: 0, fork: 0, state: "stopped", t: 0, hours: 0 };
const running = () => sim.state !== "stopped";
const barrelOf = () => design.arbors.find(a => (a.parts || []).some(p => p.kind === "barrel"));
const progress = () => read(PROGRESS, {});

/** Opens a level: your design on it where you left it (fresh: as the level starts, your design on it forgotten). */
function load(id, fresh = false) {
  level = LEVELS.find(l => l.id === id) || LEVELS[0];
  write(AT, level.id);
  design = startDesign(level);
  tray = level.tray.map(t => ({ ...t, left: t.n }));
  chosen = null; selected = null; nextId = 1; history = []; hintAt = 0; showWork = false; scene = 0; isolate = null; viewBefore = null;
  $("workBtn").textContent = "Workings";
  restoreWork(fresh);
  sim = { angles: {}, base: {}, wound: 0, windAngle: 0, balance: 0, fork: 0, state: "stopped", t: 0, hours: 0 };
  layer = sideOf(level) === "dial" ? 6 : 1;                     // the first layer of the side the level is worked on
  const R = plateReach() + 0.8;
  view = { x: -R, y: -R, w: 2 * R, h: 2 * R };
  cam = { ...cam, zoom: 1, panX: 0, panY: 0 };                   // a new plate: the whole of it in view, at the same angle
  render();
  $("windBtn").textContent = barrelOf() ? "Wind" : "Turn";
  if (!progress()[level.id]?.seen) openLesson();
}

/** The side of the plate a level is worked on, where its solution puts most of its parts (or its fixed ones, for a
 *  level of settings): under the dial, or the train's. The 3D view stands it face up, and building starts on it. */
const sideOf = l => {
  const added = (l.solution?.add || []).map(s => s.part.layer), layers = added.length ? added : (l.fixed || []).flatMap(a => (a.parts || []).map(p => p.layer));
  return layers.filter(x => DIAL_LAYERS.includes(x)).length * 2 > layers.length ? "dial" : "train";
};
/** The design in the state on show (a chronograph started or stopped, the rotor one way or the other), and its run. */
const shown = () => (level.scenarios ? inState(design, level.scenarios[scene]) : design);
const curOut = () => (verdict.runs ? verdict.runs[scene].v.out : verdict.out);
/** How far the plate reaches from the centre: its radius, or a rectangle's half-diagonal. */
const plateReach = () => reachOf(level.plate);

// ---------- your work: the design on each level, kept as it changes ----------
// so it comes back after a reload or a visit to another level, and a partner watching sees the plate as it stands
/** A level's fingerprint: its fixed arbors and its tray. A design saved against another version of a level isn't restored. */
const sigOf = l => { let h = 0x811c9dc5; for (const ch of JSON.stringify([l.fixed, l.tray])) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const workOf = () => JSON.stringify([design.arbors, tray.map(t => t.left), nextId]);
let savedWork = null;                   // the design as last kept: only a change is written
function restoreWork(fresh) {
  const all = read(WORK, {}), w = all[level.id];
  if (fresh && w) { delete all[level.id]; write(WORK, all); }
  else if (w && w.sig === sigOf(level) && Array.isArray(w.arbors) && w.left?.length === tray.length) {
    design.arbors = w.arbors;
    tray.forEach((t, i) => { t.left = w.left[i]; });
    nextId = w.nextId || nextId;
  }
  savedWork = workOf();
}
/** Keeps the design if it changed since it was last kept: every change ends in a redraw, which calls this. */
function keepWork() {
  const now = workOf();
  if (now === savedWork) return;
  savedWork = now;
  const all = read(WORK, {});
  all[level.id] = { sig: sigOf(level), arbors: design.arbors, left: tray.map(t => t.left), nextId, at: Date.now() };
  write(WORK, Object.fromEntries(Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, KEEP_WORK)));
}

// ---------- undo: every change can be taken back ----------
function remember() { history.push({ arbors: JSON.stringify(design.arbors), left: tray.map(t => t.left), nextId }); if (history.length > 80) history.shift(); }
function undo() {
  const h = history.pop();
  if (!h) return toast("Nothing to undo.");
  stop(); design.arbors = JSON.parse(h.arbors); tray.forEach((t, i) => { t.left = h.left[i]; }); nextId = h.nextId; selected = null; render();
}

// ---------- drawing: the plan (each part's artwork is calibre-draw.js's) ----------
const dyn = [];                                                  // what each frame moves: [element, update(state)]
/** Minutes after twelve as a time on the dial. */
const clock = t => `${Math.floor(t / 60) || 12}:${String(t % 60).padStart(2, "0")}`;

function render() {
  const svg = $("plan");
  svg.replaceChildren();
  dyn.length = 0;
  verdict = judge(level, design);
  const lens = lensOf();
  const o = { plate: level.plate, arbors: shown().arbors, out: curOut(), layer, selected, guides: guides(), labels: true, dyn, focus: lens?.ids || null, lit: lens?.lit || null };
  if (view3d) scene3d = draw3d(svg, { ...o, target: chosenLayer(), cam, up: sideOf(level) });
  else { scene3d = null; svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`); drawDesign(svg, o); }
  frame();
  renderBrief(); renderTray(); renderLayers(); renderInspect(); showPower();
  if (scene3d) {                                                  // in 3D the stack keeps clear of the inspector
    const insp = $("inspect"), cover = insp.hidden ? 0 : Math.min(0.6, (insp.offsetHeight + 8) / Math.max(1, svg.clientHeight));
    if (cover !== scene3d.inset) { scene3d.inset = cover; scene3d.update(cam); }
  }
  keepWork();
}
/** The layer the part in hand goes on: its own (a barrel's, an escape wheel's) or the one chosen. */
const chosenLayer = () => { const t = tray[chosen]; return t ? FORCED[t.kind] || layer : null; };
/** With a gear in hand, faint circles where its arbor would have to stand to mesh with each wheel on its layer. */
function guides() {
  const t = tray[chosen];
  if (!t?.teeth || ["escape", "star", "finger", "balance", "fork"].includes(t.kind)) return [];
  const rr = radius(t.teeth, t.m), lay = FORCED[t.kind] || layer, out = [];
  for (const a of design.arbors) for (const q of a.parts || []) if (q.layer === lay && q.teeth && !["escape", "star"].includes(q.kind) && (q.m || MODULE) === (t.m || MODULE))
    out.push({ x: a.x, y: a.y, r: radius(q.teeth, q.m) + rr });
  return out;
}
/** Moves what moves: wheels, hands, the spring, the fork and the balance, from the simulation's state. */
function frame() { for (const [, update] of dyn) update(sim); }

function renderBrief() {
  const ch = CHAPTERS.find(c => c.id === level.chapter);
  $("where").textContent = `${ch.id}. ${ch.title} · ${level.id} ${level.title}`;
  const p = progress()[level.id];
  $("stars").textContent = p?.stars ? "★".repeat(p.stars) + "☆".repeat(3 - p.stars) : "";
  $("task").textContent = level.task;
  const STATES = { free: "spinning free", locked: "held by the pallet fork", running: "running", none: "no escape wheel" };
  $("goals").replaceChildren(...verdict.goals.map(g => {
    const li = document.createElement("li"), a = design.arbors.find(x => x.id === g.goal.arbor);
    li.className = g.ok ? "ok" : "";
    if (g.goal.in) { const tag = document.createElement("span"); tag.className = "cb-scene-tag"; tag.textContent = level.scenarios.find(x => x.id === g.goal.in).name; li.append(tag, " "); }
    li.append(g.goal.escapement ? `Escape wheel: ${STATES[g.goal.escapement]} · now ${STATES[g.actual]}`
      : g.goal.reserve ? `Power reserve: ${g.goal.reserve}${g.goal.most ? `–${g.goal.most}` : "+"} hours · now ${g.actual ? `${Math.round(g.actual)} hours` : "not running"}`
      : g.goal.sign ? `${a?.label?.replace(/ \(.*\)$/, "") || g.goal.arbor}: turning ${g.goal.sign > 0 ? "clockwise" : "anticlockwise"} · now ${rateText(g.actual)}`
      : g.goal.alternate ? `Column wheel: start and stop alternate, press by press · now ${g.actual}`
      : g.goal.calendar ? `Calendar: right every month${g.goal.except ? " but February" : ""}${g.goal.years > 1 ? `, for ${g.goal.years} years` : ""} · ${g.actual?.length ? `now wrong in ${g.actual.slice(0, 4).map(i => `${MONTHS[i % 12]}${g.goal.years > 1 ? ` (year ${Math.floor(i / 12) + 1})` : ""}`).join(", ")}${g.actual.length > 4 ? ` and ${g.actual.length - 4} more` : ""}` : "now right"}`
      : g.goal.snail ? `${g.goal.snail === "hours" ? "Hour snail: the right hour at every hour" : "Quarter snail: the right quarters"} · ${g.actual?.length ? `now wrong at ${g.actual.map(v => (g.goal.snail === "hours" ? `${v} o'clock` : `${v * 15} past`)).join(", ")}` : "now right"}`
      : g.goal.alarm != null ? `Alarm: at ${clock(g.goal.alarm)}, once in twelve hours · ${!g.actual.length ? "now never" : g.actual.length === 1 ? `now at ${clock(g.actual[0])}` : `now ${g.actual.length} times, ${clock(g.actual[0])} to ${clock(g.actual[g.actual.length - 1])}`}`
      : g.goal.amplitude ? `Balance amplitude: ${g.goal.upTo ? `${g.goal.amplitude}–${g.goal.upTo}°` : `at least ${g.goal.amplitude}°`}${g.goal.whole ? " over the whole run" : ""} · now ${g.actual ? (g.goal.whole ? `${Math.round(g.actual)}° wound, ${Math.round(g.end)}° near the end` : `${Math.round(g.actual)}°`) : "not running"}`
      : g.goal.jumps ? `Minute counter: jumps from minute to minute · now ${g.actual}`
      : g.goal.eot ? `Kidney cam: within a minute of the sun every month · ${g.actual?.length ? `now off in ${g.actual.map(i => MONTHS[i]).join(", ")}` : "now right"}`
      : g.goal.secular ? `Century wheel: the right leap years · ${g.actual?.length ? `now wrong for ${g.actual.join(", ")}` : "now right"}`
      : g.goal.in && level.scenarios.find(x => x.id === g.goal.in)?.drive?.pusher && g.goal.rate ? `${a?.label?.replace(/ \(.*\)$/, "") || g.goal.arbor}: 1/${Math.round(1 / g.goal.rate)} of a turn per press · now ${g.actual ? `1/${Math.round(1 / Math.abs(g.actual))}${g.actual < 0 ? " backwards" : ""}` : "still"}`
      : g.goal.still ? `${a?.label?.replace(/ \(.*\)$/, "") || g.goal.arbor}: standing still · now ${rateText(g.actual)}`
      : g.goal.reset ? `Hearts on ${g.goal.reset.map(id => (design.arbors.find(x => x.id === id)?.label || id).replace(/ \(.*\)$/, "")).join(" and ")}${g.actual.length ? ` · still missing on ${g.actual.length}` : " · fitted"}`
      : g.goal.tol ? `${a?.label?.replace(/ \(.*\)$/, "") || g.goal.arbor}: ${rateText(g.goal.rate)} within ${Math.round(g.goal.tol * 86400)} s a day · now ${g.actual ? `${(g.actual / g.goal.rate - 1) * 86400 >= 0 ? "+" : ""}${((g.actual / g.goal.rate - 1) * 86400).toFixed(1)} s a day` : "still"}`
      : `${a?.label?.replace(/ \(.*\)$/, "") || g.goal.arbor}: ${g.goal.abs ? rateText(Math.abs(g.goal.rate)).replace(/, clockwise$/, ", either way") : rateText(g.goal.rate)} · now ${rateText(g.actual)}`);
    return li;
  }), ...verdict.problems.slice(0, 2).map(t => { const li = document.createElement("li"); li.className = "bad"; li.textContent = t; return li; }));
  // the states a mechanism can be in, to switch between; a chronograph with hearts can be reset
  const scenes = $("scenes");
  scenes.replaceChildren(...(level.scenarios || []).map((sc, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = `cb-scene${i === scene ? " on" : ""}`; b.textContent = sc.name;
    b.addEventListener("click", () => { scene = i; stop(); render(); });
    return b;
  }));
  if (design.arbors.some(a => (a.parts || []).some(p => p.kind === "heart"))) {
    const b = document.createElement("button"); b.type = "button"; b.className = "cb-scene"; b.textContent = "Reset";
    b.addEventListener("click", () => {                             // the hammers fall: every arbor with a heart goes home
      for (const a of design.arbors) if ((a.parts || []).some(p => p.kind === "heart")) { sim.angles[a.id] = 0; sim.base[a.id] = 0; }
      frame(); toast("The hammers fall on the hearts: both hands fly back to zero.");
    });
    scenes.append(b);
  }
  scenes.hidden = !scenes.children.length;
  // a balance with an index: the slider moves it, and the brief shows the rate in seconds a day
  const bal = design.arbors.flatMap(a => a.parts || []).find(p => p.kind === "balance" && p.adjustable);
  $("indexRow").hidden = !bal;
  if (bal) { $("index").value = bal.index || 0; $("indexOut").textContent = `${(bal.index || 0) >= 0 ? "+" : ""}${(bal.index || 0).toFixed(3)}`; }
  renderEditor();
  renderWork();
  $("hintBtn").textContent = level.hints.length ? (hintAt ? `Hint ${Math.min(hintAt + 1, level.hints.length)}/${level.hints.length}` : "Hint") : "";
  $("hintBtn").hidden = !level.hints.length;
}

// ---------- the workings and the lens: how an arbor is driven, a mesh at a time, the parts in question isolated ----------
const bare = id => id.replace(/~$/, "");                         // a reverser's pinion is its arbor's
/** An arbor in a sentence: its name, or for one of yours what it carries ("your 10/75 arbor"). */
const nameOf = id => { const a = shown().arbors.find(x => x.id === bare(id)); return !a ? "it" : a.label ? arborName(a) : `your ${teethOf(a) || "new"} arbor`; };
/** The same, short, for a chip: no bracket, no "wheel". */
const shortOf = id => { const a = shown().arbors.find(x => x.id === bare(id)); return !a ? "?" : a.label ? arborName(a).replace(/(.) wheel$/, "$1") : teethOf(a) || "yours"; };
const teethOf = a => (a.parts || []).filter(p => p.teeth).map(p => p.teeth).join("/");
/** A ratio as it reads: ×8 speeding up, ÷3 slowing down. */
const times = k => { const m = Math.abs(k); return m >= 1 - 1e-9 ? `×${+m.toFixed(3)}` : `÷${+(1 / m).toFixed(3)}`; };
/** A step of the workings in words: what drives what, the arithmetic, and which way round. */
function stepWords(st) {
  if (st.finger) return `A finger on ${nameOf(st.from)} pushes ${nameOf(st.to)} on one tooth of ${st.finger} each turn: ${times(st.k)}, by fits and starts.`;
  if (st.clutch) return `${nameOf(st.from)}'s one-way clutch passes its wheel's turning to its pinion: turned this way round, it drives.`;
  if (st.link) return `${nameOf(st.to)} is held to ${nameOf(st.from)} and turns with it.`;
  const part = (id, teeth) => { const p = (shown().arbors.find(x => x.id === bare(id))?.parts || []).find(q => q.layer === st.layer); return id.endsWith("~") || p?.kind === "pinion" ? `${teeth}-leaf pinion` : p?.kind === "barrel" ? `barrel's ${teeth} teeth` : `${teeth}-tooth wheel`; };
  const from = part(st.from, st.driver), subject = from.startsWith("barrel") ? `The ${from}` : `The ${from} on ${nameOf(st.from)}`;
  const up = Math.abs(st.k) > 1 + 1e-9, down = Math.abs(st.k) < 1 - 1e-9;   // as a watchmaker says it: 80 over 10, 10 into 30
  return `${subject} ${from.startsWith("barrel") ? "drive" : "drives"} the ${part(st.to, st.driven)} on ${nameOf(st.to)}: ${st.driver} ${down ? "into" : "over"} ${st.driven} is ${times(st.k)}, ${up ? "faster" : down ? "slower" : "as fast"}, and the other way round.`;
}
/** The goal the workings explain (the first not yet met in the state on show; all met, the one at the end of the longest
 *  path), and the path that drives its arbor. */
function workPath() {
  const sc = level.scenarios?.[scene]?.id, here = verdict.goals.filter(x => x.goal.arbor && (!x.goal.in || x.goal.in === sc));
  const paths = here.map(g => ({ g, steps: workings(shown(), curOut(), g.goal.arbor) }));
  return paths.find(x => !x.g.ok) || paths.reduce((m, x) => ((x.steps?.length ?? -1) > (m?.steps?.length ?? -1) ? x : m), null) || { g: null, steps: null };
}
/** How an arbor is driven and what it drives, in the state on show; ids: those arbors. */
function relationsOf(id) {
  const d = shown(), out = curOut(), path = workings(d, out, id), from = path?.length ? path[path.length - 1] : null, drives = [];
  for (const body of [id, `${id}~`]) for (const [to] of out.edges.get(body) || []) {
    if (to === from?.from) continue;
    const p = workings(d, out, to), last = p?.[p.length - 1];
    if (last?.from === body) drives.push(last);
  }
  return { from, drives, source: !!path && !path.length, ids: [from?.from, ...drives.map(st => st.to)].filter(Boolean).map(bare) };
}
/** What the plan isolates now, from what was asked for: recomputed every draw, so it follows the design as it changes. */
function lensOf() {
  if (isolate?.by === "work" && showWork) {
    const { steps } = workPath();
    if (!steps?.length || isolate.at > steps.length) return null;
    if (isolate.at === steps.length) return { ids: new Set(steps.flatMap(st => [bare(st.from), bare(st.to)])), lit: null };
    const st = steps[isolate.at], a = bare(st.from), b = bare(st.to);
    return { ids: new Set([a, b]), lit: st.driver ? { a, b } : null };
  }
  if (isolate?.by === "arbor" && design.arbors.some(a => a.id === isolate.id)) return { ids: new Set([isolate.id, ...relationsOf(isolate.id).ids]), lit: null };
  return null;
}
/** The workings: a chip for each step from the power to the goal's arbor and one for the whole, the chosen one in words. */
function renderWork() {
  const box = $("work");
  box.hidden = !showWork;
  if (!showWork) return;
  box.replaceChildren();
  const say = text => { const p = document.createElement("p"); p.className = "cb-work-say"; p.textContent = text; box.append(p); };
  const { g, steps } = workPath();
  if (!g) return say("No train to follow here: the goals say what to watch.");
  if (!steps) return say(`${nameOf(g.goal.arbor)} isn't turned by anything yet${level.scenarios ? " in this state" : ""}.`);
  if (!steps.length) return say(`${nameOf(g.goal.arbor)} is the power: everything else turns from it.`);
  const total = steps.reduce((m, st) => m * st.k, 1), at = isolate?.by === "work" ? isolate.at : null, rate = curOut().rates[g.goal.arbor];
  // the train as a chain: each arbor's name, and between them the step's ratio, a tap to see that mesh alone
  const row = document.createElement("div"); row.className = "cb-work-steps";
  const name = id => { const e = document.createElement("span"); e.className = "cb-work-name"; e.textContent = shortOf(id); row.append(e); };
  const chip = (i, text, title) => {
    const b = document.createElement("button"); b.type = "button"; b.className = `cb-work-step${i === at ? " on" : ""}${i === steps.length ? " all" : ""}`; b.textContent = text; b.title = title;
    b.setAttribute("aria-pressed", String(i === at));
    b.addEventListener("click", () => setIsolate(i === at ? null : { by: "work", at: i }));
    row.append(b);
  };
  name(steps[0].from);
  steps.forEach((st, i) => { chip(i, st.clutch ? "clutch" : st.link ? "held" : times(st.k), `${shortOf(st.from)} to ${shortOf(st.to)}`); name(st.to); });
  chip(steps.length, `= ${times(total)}`, "The whole train");
  box.append(row);
  say(at != null && at < steps.length ? stepWords(steps[at])
    : `${nameOf(steps[0].from)} to ${nameOf(g.goal.arbor)}: ${times(total)} in all, ${total > 0 ? "the same way round" : "the other way round"}${rate ? `: ${rateText(rate)}` : ""}. Tap a ratio to see its mesh alone.`);
}

function renderTray() {
  $("tray").replaceChildren(...tray.map((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cb-chip cb-${t.kind}${chosen === i ? " on" : ""}`;
    b.disabled = !t.left;
    b.textContent = `${chipName(t)}${t.n > 1 ? ` ×${t.left}` : ""}`;
    b.setAttribute("aria-pressed", chosen === i);
    b.addEventListener("click", () => {
      chosen = chosen === i ? null : i; selected = null;
      if (chosen != null && FORCED[t.kind]) layer = FORCED[t.kind] <= 8 ? FORCED[t.kind] : layer;   // a part with its own height takes the layer with it
      render();                                                   // the guides show where it would mesh
    });
    return b;
  }));
  if (!tray.length) $("tray").textContent = "Nothing to add: change what's there.";
}

function renderLayers() {
  const used = [1, 2, 3, 4, 5, 6, 7, 8, 11, 12].filter(n => n > 10 ? level.chapter === 10 : n <= 2 || design.arbors.some(a => (a.parts || []).some(p => p.layer >= n - 1 && p.layer <= 10)) || (n <= 7 && DIAL_LAYERS.includes(n) && level.chapter >= 4) || (n === 8 && level.chapter >= 7));
  $("layers").replaceChildren(...used.map(n => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `cb-layer${layer === n ? " on" : ""}${DIAL_LAYERS.includes(n) ? " dial" : ""}`;
    b.textContent = LAYER_NAMES[n]; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", layer === n);
    b.title = DIAL_LAYERS.includes(n) ? `Dial side, layer ${n - 5}: under the dial, for the motion works` : `Layer ${n}, between the plate and the bridges`;
    b.addEventListener("click", () => { layer = n; render(); });
    return b;
  }));
}

/** The arbor selected: its rate, what drives it and what it drives (mesh by mesh), its parts, and its tools. Isolated, it
 *  keeps to its rate and its neighbours, out of the way of the plan. */
function renderInspect() {
  const box = $("inspect"), a = design.arbors.find(x => x.id === selected);
  if (!a) { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren();
  const on = isolate?.by === "arbor" && isolate.id === a.id, rel = relationsOf(a.id);
  const line = (text, cls) => { const p = document.createElement("p"); p.className = cls; p.textContent = text; box.append(p); return p; };
  line(`${a.label || "Arbor"} · ${rateText(curOut().rates[a.id])}`, "cb-in-head");
  // how it works: what turns it and what it turns, each mesh's counts and ratio
  const how = (st, lead, who) => `${lead} ${nameOf(who)}${st.driver ? `: ${st.driver} → ${st.driven}, ${times(st.k)}` : st.finger ? `: a finger, ${times(st.k)}` : ""}`;
  for (const t of [...(rel.from ? [how(rel.from, "Driven by", rel.from.from)] : rel.source ? ["The power: the rest turns from here"] : []), ...rel.drives.map(st => how(st, "Drives", st.to))]) line(t, "cb-in-how");
  if (!on) for (const [i, p] of (a.parts || []).entries()) {
    const row = line(partName(p), "cb-in-row");
    if (!p.fixed) {
      const x = document.createElement("button"); x.type = "button"; x.className = "cb-x"; x.textContent = "Remove";
      x.addEventListener("click", () => removePart(a, i));
      row.append(x);
    }
  }
  const tools = document.createElement("p"); tools.className = "cb-in-tools";
  if (rel.ids.length) {                                           // it and its neighbours alone: the rest drawn faint
    const b = document.createElement("button");
    b.type = "button"; b.className = `cb-x${on ? " on" : ""}`; b.textContent = on ? "Show all" : "Isolate"; b.setAttribute("aria-pressed", String(on));
    b.addEventListener("click", () => setIsolate(on ? null : { by: "arbor", id: a.id }));
    tools.append(b);
  }
  if (a.placed && !on) {
    const x = document.createElement("button"); x.type = "button"; x.className = "cb-x"; x.textContent = "Take out the whole arbor";
    x.addEventListener("click", () => { remember(); design.arbors = design.arbors.filter(y => y !== a); selected = null; setIsolate(null); });
    tools.append(x);
  }
  if (tools.children.length) box.append(tools);
}

// ---------- editors: cutting a cam, numbering a snail; and striking the hours ----------
function renderEditor() {
  const box = $("editor"), cam = design.arbors.flatMap(a => a.parts || []).find(p => p.kind === "cam" && p.editable), sn = design.arbors.flatMap(a => a.parts || []).find(p => p.kind === "snail" && p.editable);
  const snails = Object.fromEntries(design.arbors.map(a => [a.id, (a.parts || []).find(p => p.kind === "snail")]).filter(([, p]) => p));
  box.replaceChildren(); box.hidden = !cam && !sn;   // the kidney and century editors unhide it themselves
  if (cam) {
    const years = cam.notches.length / 12;
    for (let y = 0; y < years; y++) {
      const row = document.createElement("div"); row.className = "cb-camrow";
      if (years > 1) { const l = document.createElement("span"); l.className = "cb-camyear"; l.textContent = y === 0 ? "Leap" : `Year ${y + 1}`; row.append(l); }
      for (let m = 0; m < 12; m++) {
        const i = y * 12 + m, b = document.createElement("button");
        b.type = "button"; b.className = `cb-cam-cell${cam.notches[i] < 31 ? " short" : ""}`; b.innerHTML = `<small>${MONTHS[m]}</small>${cam.notches[i]}`;
        b.title = "Tap to cut the notch deeper: 31, 30, 29, 28 days";
        b.addEventListener("click", () => { remember(); cam.notches[i] = cam.notches[i] === 28 ? 31 : cam.notches[i] - 1; render(); });
        row.append(b);
      }
      box.append(row);
    }
  }
  const kid = design.arbors.flatMap(a => a.parts || []).find(p => p.kind === "kidney" && p.editable);
  if (kid) {
    box.hidden = false;
    const row = document.createElement("div"); row.className = "cb-eotrow";
    for (let m = 0; m < 12; m++) {
      const cell = document.createElement("div"); cell.className = "cb-eot";
      const up = document.createElement("button"), down = document.createElement("button"), v = document.createElement("b");
      up.type = down.type = "button"; up.textContent = "▲"; down.textContent = "▼"; v.textContent = `${kid.values[m] > 0 ? "+" : ""}${kid.values[m]}`;
      up.addEventListener("click", () => { remember(); kid.values[m] = Math.min(16, kid.values[m] + 1); render(); });
      down.addEventListener("click", () => { remember(); kid.values[m] = Math.max(-16, kid.values[m] - 1); render(); });
      const l = document.createElement("small"); l.textContent = MONTHS[m];
      cell.append(l, up, v, down); row.append(cell);
    }
    box.append(row);
  }
  const cen = design.arbors.flatMap(a => a.parts || []).find(p => p.kind === "century" && p.editable);
  if (cen) {
    box.hidden = false;
    const row = document.createElement("div"); row.className = "cb-centuries";
    CENTURIES.forEach((y, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = `cb-century${cen.leaps[i] ? " leap" : ""}`;
      b.innerHTML = `<small>${y}</small>${cen.leaps[i] ? "leap" : "common"}`;
      b.addEventListener("click", () => { remember(); cen.leaps[i] = !cen.leaps[i]; render(); });
      row.append(b);
    });
    box.append(row);
  }
  if (sn) {
    const ring = document.createElement("div"); ring.className = "cb-snailring";
    const n = sn.steps.length;
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button"), ang = (i / n) * 2 * Math.PI;
      b.type = "button"; b.className = "cb-snailstep"; b.textContent = sn.steps[i];
      b.style.left = `${50 + Math.sin(ang) * 40}%`; b.style.top = `${50 - Math.cos(ang) * 40}%`;
      b.title = i === 0 ? "The step under the rack at twelve" : `${i} place${i > 1 ? "s" : ""} clockwise of twelve`;
      b.addEventListener("click", () => { remember(); sn.steps[i] = n === 12 ? (sn.steps[i] % 12) + 1 : (sn.steps[i] + 1) % n; render(); });
      ring.append(b);
    }
    const rack = document.createElement("span"); rack.className = "cb-rackmark"; rack.textContent = "rack ▾"; ring.append(rack);
    const strike = document.createElement("div"); strike.className = "cb-strike";
    if (sn.steps.length === 4) {
      // the whole repeater: hours from the hour snail, quarters from this one, the minutes past the quarter
      for (const t of [167, 285, 467, 650]) {
        const b = document.createElement("button"); b.type = "button"; b.textContent = `Strike ${clock(t)}`;
        b.addEventListener("click", () => {
          const hs = snails.hours, h = Math.floor(t / 60) || 12, q = Math.floor((t % 60) / 15), m = t % 15;
          const hn = hs ? hs.steps[(12 - (h % 12)) % 12] : h, qn = sn.steps[(4 - q) % 4];
          repeat(hn, qn, m);
          toast(`${hn} low, ${qn} double, ${m} high: ${qn === q ? "" : "wrong quarters! "}${hn}:${String(qn * 15 + m).padStart(2, "0")}`);
        });
        strike.append(b);
      }
      box.append(ring, strike);
      return;
    }
    strike.append("Strike at ");
    for (let h = 1; h <= 12; h++) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = h;
      b.addEventListener("click", () => { const n = sn.steps[(12 - (h % 12)) % 12]; chime(n); toast(`At ${h} o'clock the rack falls ${n} teeth: ${n} blow${n > 1 ? "s" : ""}.${n === h ? "" : " Wrong hour!"}`); });
      strike.append(b);
    }
    box.append(ring, strike);
  }
}
let audio = null;
/** A minute repeater: hours on the low gong, quarters as ding-dongs, minutes on the high gong. */
function repeat(h, q, m) {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  let t = audio.currentTime + 0.05;
  const blow = (f, at) => { for (const [k, v] of [[1, 0.35], [2.5, 0.1]]) { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = f * k; g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.0008, at + 1.2); o.connect(g).connect(audio.destination); o.start(at); o.stop(at + 1.3); } };
  for (let i = 0; i < h; i++, t += 0.5) blow(330, t);
  t += 0.5;
  for (let i = 0; i < q; i++, t += 0.6) { blow(660, t); blow(330, t + 0.22); }
  t += 0.5;
  for (let i = 0; i < m; i++, t += 0.35) blow(660, t);
}
/** The hammer on the gong: n low blows, each a bell's partials dying away. */
function chime(n) {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  const t0 = audio.currentTime + 0.05;
  for (let k = 0; k < n; k++) for (const [f, v] of [[440, 0.35], [1102, 0.12], [1760, 0.05]]) {
    const o = audio.createOscillator(), g = audio.createGain(), t = t0 + k * 0.55;
    o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.4);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 1.5);
  }
}

// ---------- placing ----------
function removePart(a, i) {
  const p = a.parts[i];
  remember();
  const t = tray.find(t => t.kind === p.kind && (t.teeth ?? t.vph ?? t.len ?? null) === (p.teeth ?? p.vph ?? p.len ?? null) && (t.m || 0) === (p.m || 0));
  if (t) t.left++;
  a.parts.splice(i, 1);
  if (!a.fixed && !a.placed && !a.parts.length) { design.arbors = design.arbors.filter(x => x !== a); selected = null; }
  render();
}

function place(x, y) {
  const t = tray[chosen];
  if (!t?.left) return;
  let hit = arborAt(x, y);
  if (hit && tray[chosen]?.kind === "trip") hit = design.arbors.find(a => a.id === (tray[chosen].on === "hour" ? "hours" : "centre")) && Math.hypot(x, y) < 1.2 ? design.arbors.find(a => a.id === (tray[chosen].on === "hour" ? "hours" : "centre")) : hit;
  const special = t.kind === "balance" || t.kind === "fork", partLayer = FORCED[t.kind] || layer;
  const piece = { ...Object.fromEntries(Object.entries(t).filter(([k]) => !["n", "left"].includes(k))), layer: partLayer };
  if (t.kind === "lever" && hit && !hit.positions) return toast("The lever goes on the coupling wheel's arbor.");
  if ((t.kind === "fusee" || t.kind === "mainspring") && hit && hit.power == null) return toast(t.kind === "fusee" ? "The fusée goes with the barrel: tap the barrel." : "A mainspring lives in the barrel: tap the barrel.");
  if (t.kind === "trip" && hit && hit.id !== (t.on === "hour" ? "hours" : "centre")) return toast(t.on === "hour" ? "The hour trip rides on the hour wheel." : "The minute trip rides on the cannon pinion, at the centre.");
  if (!hit && ["finger", "star", "barrel", "escape", "ratchet", "heart", "column", "cage", "trip", "lever", "fusee", "remontoire", "mainspring"].includes(t.kind)) return toast(t.kind === "finger" ? "A finger rides on a wheel: tap the arbor it goes on." : "Tap the arbor it goes on.");
  remember();
  if (hit) {
    if (hit.noParts) return toast("That's a post: nothing goes on it.");
    if (special && (hit.parts || []).length) return toast(t.kind === "fork" ? "The pallet fork has an arbor of its own, beside the escape wheel." : "The balance has a staff of its own, at the end of the fork.");
    if ((hit.parts || []).some(p => p.layer === partLayer)) return toast(`That arbor already has a part on layer ${LAYER_NAMES[partLayer]}.`);
    hit.parts.push(piece);
  } else {
    // a fork sits where its stones reach the escape wheel; a balance in line at the end of the fork
    const s = special ? snapEscapement(design, x, y, t.kind) : snap(design, x, y, t.teeth, partLayer, undefined, t.m);
    if (special && !s) return toast(t.kind === "fork" ? "A pallet fork works on an escape wheel: there isn't one yet." : "A balance needs a pallet fork to swing.");
    design.arbors.push({ id: `a${nextId++}`, x: s ? s.x : x, y: s ? s.y : y, parts: [piece] });
  }
  t.left--;
  if (!t.left) chosen = null;
  render();
}

/** Selects an arbor (or none); an arbor isolated in the inspector hands the isolation on to the one selected (framed once
 *  the caller has drawn the inspector it leaves room for). */
function select(id) {
  selected = id;
  if (isolate?.by === "arbor" && isolate.id !== id) { isolate = id ? { by: "arbor", id } : null; queueMicrotask(() => { frameIsolated(); render(); }); }
}
/** Isolates something (or nothing) and frames the plan on it. */
function setIsolate(next) {
  isolate = next;
  render();                                                       // the inspector first: the frame leaves room for it
  frameIsolated();
  render();
}
/** Frames the plan on what's isolated, in the room above the inspector; with nothing isolated, back to the view before. */
function frameIsolated() {
  if (view3d) return;
  const lens = lensOf();
  if (!lens) { if (viewBefore) { view = viewBefore; viewBefore = null; } return; }
  const b = svg.getBoundingClientRect(), reach = plateReach();
  if (!b.width || !b.height) return;
  viewBefore ??= { ...view };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const a of shown().arbors.filter(x => lens.ids.has(x.id))) {
    const r = Math.max(0.6, ...(a.parts || []).filter(p => p.kind !== "rotor").map(p => extentOf(p, reach)));
    x0 = Math.min(x0, a.x - r); x1 = Math.max(x1, a.x + r); y0 = Math.min(y0, a.y - r); y1 = Math.max(y1, a.y + r);
  }
  const insp = $("inspect"), room = insp.hidden ? b.height : Math.max(b.height * 0.4, Math.min(b.height, insp.getBoundingClientRect().top - b.top - 6));
  const pad = 0.8, k = Math.max((x1 - x0 + 2 * pad) / b.width, (y1 - y0 + 2 * pad) / room, 4 / b.width);   // plan units a pixel
  view = { x: (x0 + x1) / 2 - (b.width / 2) * k, y: (y0 + y1) / 2 - (room / 2) * k, w: b.width * k, h: b.height * k };
}
function arborAt(x, y) {
  let best = null, bd = Infinity;
  for (const a of design.arbors) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } }
  return bd <= Math.max(0.5, view.w / 40) ? best : null;
}

// ---------- the plate: tap, drag, pinch, wheel ----------
// On the plan a drag pans (or moves an arbor of yours) and a tap places or selects. In 3D a drag turns the view (or
// moves an arbor of yours on its layer's plane), a tap on the rail chooses a layer, a tap on a part selects it and its
// layer, and with a part in hand a tap places it on its layer's plane, where the finger meets it.
const svg = $("plan"), pointers = new Map();
let gesture = null;
const toPlan = (cx, cy) => { const b = svg.getBoundingClientRect(), k = Math.max(view.w / b.width, view.h / b.height); return [view.x + (cx - b.left - (b.width - view.w / k) / 2) * k, view.y + (cy - b.top - (b.height - view.h / k) / 2) * k]; };
/** A point of the page in the 3D view's own units. */
const toView = (cx, cy) => { const q = new DOMPoint(cx, cy).matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };
/** How near a part's centre a tap in 3D must land to pick it: about a finger's width. */
const reach3d = () => { const b = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; return Math.max(0.6, (22 * vb.width) / Math.max(1, b.width)); };
function zoomAt(f, cx, cy) {
  if (view3d) { cam = { ...cam, zoom: Math.min(6, Math.max(0.6, cam.zoom / f)) }; scene3d?.update(cam); return; }
  const [px, py] = cx == null ? [view.x + view.w / 2, view.y + view.h / 2] : toPlan(cx, cy), R = plateReach() + 0.8;
  const w = Math.min(2 * R * 1.5, Math.max(3, view.w * f)), k = w / view.w;
  view = { x: px - (px - view.x) * k, y: py - (py - view.y) * k, w, h: view.h * k };
  render();
}
svg.addEventListener("pointerdown", e => {
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (pts.length > 1) { gesture = { kind: "pinch", d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), w: view.w, zoom: cam.zoom }; return; }
  if (view3d && scene3d) {
    const rail = scene3d.layerAt(e.target), hit = rail ? null : scene3d.arborAt(...toView(e.clientX, e.clientY), reach3d());
    gesture = { kind: rail ? "rail" : hit && !hit.a.fixed && chosen == null ? "move" : "turn", rail, a: hit?.a, layer: hit?.layer, from: pts[0], cam: { ...cam }, moved: false };
    return;
  }
  const [x, y] = toPlan(e.clientX, e.clientY), a = arborAt(x, y);
  gesture = { kind: a && !a.fixed && chosen == null ? "move" : "pan", a, from: pts[0], view: { ...view }, moved: false };
});
svg.addEventListener("pointermove", e => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (gesture.kind === "pinch" && pts.length >= 2) {
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (view3d) { cam = { ...cam, zoom: Math.min(6, Math.max(0.6, gesture.zoom * d / Math.max(1, gesture.d))) }; scene3d?.update(cam); return; }
    zoomAt(gesture.w * gesture.d / Math.max(1, d) / view.w, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
    return;
  }
  if (Math.hypot(pts[0].x - gesture.from.x, pts[0].y - gesture.from.y) > 6) gesture.moved = true;
  if (!gesture.moved) return;
  if (gesture.kind === "move") {
    if (!gesture.saved) { remember(); gesture.saved = true; }
    const first = gesture.a.parts.find(p => p.teeth);
    const [x, y] = view3d ? scene3d.toPlane(first?.layer ?? gesture.layer ?? layer, ...toView(e.clientX, e.clientY)) : toPlan(e.clientX, e.clientY);
    const s = first && snap(design, x, y, first.teeth, first.layer, gesture.a.id, first.m);
    gesture.a.x = s ? s.x : x; gesture.a.y = s ? s.y : y;
    render();
  } else if (gesture.kind === "turn") {
    // across turns it about the stack, down and up tilts it: from the dial side over to the back and round again
    let el = gesture.cam.el - (pts[0].y - gesture.from.y) * 0.35;
    el = Math.max(-85, Math.min(85, el));
    if (Math.abs(el) < 8) el = el < 0 ? -8 : 8;                  // edge on, the layers would collapse into lines
    cam = { ...cam, az: gesture.cam.az + (pts[0].x - gesture.from.x) * 0.45, el };
    scene3d?.update(cam);
  } else if (gesture.kind === "pan") {
    const b = svg.getBoundingClientRect(), k = Math.max(view.w / b.width, view.h / b.height);
    view = { ...gesture.view, x: gesture.view.x - (pts[0].x - gesture.from.x) * k, y: gesture.view.y - (pts[0].y - gesture.from.y) * k };
    render();
  }
});
const lift = e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (gesture && !gesture.moved && gesture.kind !== "pinch" && e.type === "pointerup") {
    if (gesture.kind === "rail") { if (SELECTABLE.includes(gesture.rail)) { layer = gesture.rail; render(); } }
    else if (view3d && scene3d) {
      const target = chosenLayer();
      if (chosen != null) place(...scene3d.toPlane(target, ...toView(e.clientX, e.clientY)));
      else {
        const hit = gesture.a ? { a: gesture.a, layer: gesture.layer } : null;
        select(hit ? hit.a.id : null);
        if (hit && SELECTABLE.includes(hit.layer)) layer = hit.layer;   // a part tapped: its layer is the one in hand
        render();
      }
    } else {
      const [x, y] = toPlan(e.clientX, e.clientY);
      if (chosen != null) place(x, y);
      else { const a = arborAt(x, y); select(a ? a.id : null); render(); }
    }
  }
  if (!pointers.size) gesture = null;
};
svg.addEventListener("pointerup", lift);
svg.addEventListener("pointercancel", lift);
svg.addEventListener("wheel", e => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
$("zoomIn").addEventListener("click", () => zoomAt(1 / 1.5));
$("zoomOut").addEventListener("click", () => zoomAt(1.5));
/** Plan or 3D: the camera swings between straight down (where the 3D view is the plan) and the stack tilted. */
function setView(to3d) {
  cancelAnimationFrame(camAnim);
  write(VIEW, to3d);
  $("view3dBtn").textContent = to3d ? "Plan" : "3D";
  $("view3dBtn").setAttribute("aria-pressed", String(to3d));
  const flat = { az: 0, el: 89.5, zoom: 1, panX: 0, panY: 0 }, from = view3d ? { ...cam } : flat, to = to3d ? { ...CAM } : flat;
  view3d = true; cam = { ...from }; render();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { cam = to; view3d = to3d; render(); return; }
  const t0 = performance.now(), D = 560;
  const step = now => {
    const k = Math.min(1, (now - t0) / D), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    cam = Object.fromEntries(Object.keys(to).map(key => [key, from[key] + (to[key] - from[key]) * e]));
    scene3d?.update(cam);
    if (k < 1) camAnim = requestAnimationFrame(step);
    else if (!to3d) { view3d = false; render(); }
  };
  camAnim = requestAnimationFrame(step);
}
$("view3dBtn").addEventListener("click", () => setView(!view3d));

// ---------- winding and running: the movement as it would really behave ----------
// A barrel-driven movement is wound first: the barrel arbor turns, the mainspring coils tight round it. Then the
// escapement decides: with no pallet fork the spring dumps itself in a second and a half; a fork with no balance
// locks after one tick; fork and balance and it runs, the balance swinging in real time, the escape wheel stepping
// half a tooth a beat (visible at real speed), the spring running down until the watch stops. A crank just turns.
function wind() {
  verdict = judge(level, design);
  sim.base = { ...sim.angles }; sim.t = 0; sim.hours = 0;
  if (barrelOf()) { sim.state = "winding"; sim.w0 = sim.wound; }
  else start();
  last = performance.now();
  requestAnimationFrame(tick);
  render();
}
function start() {
  const out = curOut();
  sim.base = { ...sim.angles }; sim.t = 0; sim.hours = 0;
  if (out.jammed.length) { sim.state = "stopped"; toast("It won't turn: the train is locked."); }
  else if (out.runaway) { sim.state = "runaway"; sim.w0 = sim.wound; }
  else if (out.locked) { sim.state = "locked"; }
  else sim.state = "running";
  if (sim.state === "running" && verdict.ok) setTimeout(() => { if (sim.state === "running") won(); }, 1600);
  if (sim.state === "running" && !verdict.ok) toast(verdict.problems[0] || "It runs, but not at the right rates: the goals show what's turning and what should.");
}
function won() {
  const used = partsUsed(design), hinted = hintAt > 0, stars = Math.min(hinted ? 2 : 3, used <= level.par ? 3 : used <= level.par + 2 ? 2 : 1);
  const all = progress(), before = all[level.id] || {};
  all[level.id] = { ...before, seen: true, stars: Math.max(stars, before.stars || 0), parts: Math.min(used, before.parts ?? Infinity) };
  write(PROGRESS, all);
  const next = LEVELS[LEVELS.indexOf(level) + 1];
  $("doneTitle").textContent = verdict.goals.some(g => g.goal.escapement === "locked") ? "Tick" : "It runs";
  const body = $("doneBody"); body.replaceChildren();
  const p = document.createElement("p"); p.className = "cb-done-stars"; p.textContent = "★".repeat(stars) + "☆".repeat(3 - stars); body.append(p);
  const q = document.createElement("p"); q.textContent = `${used} part${used === 1 ? "" : "s"}, par ${level.par}.${hinted ? " A hint was used: two stars at most." : stars < 3 ? " Fewer parts would earn all three stars." : ""}`; body.append(q);
  if (next) body.append(action(`Next: ${next.id} ${next.title}`, () => { $("doneDlg").close(); load(next.id); }, "primary"));
  else body.append(line("That's the course so far. More chapters are coming."));
  body.append(action("Watch it run", () => $("doneDlg").close()));
  renderBrief();
  $("doneDlg").showModal();
}
function stop(note) { sim.state = "stopped"; sim.balance = 0; sim.fork = 0; $("windBtn").textContent = barrelOf() ? "Wind" : "Turn"; if (note) toast(note); renderBrief(); }

function tick(now) {
  if (!running()) return;
  const dt = Math.min(0.1, (now - last) / 1000), speed = read(SPEED, 60), out = curOut(), rates = out.rates, b = barrelOf();
  last = now; sim.t += dt;
  if (sim.state === "winding") {
    const k = Math.min(1, sim.t / 0.9), e = 1 - (1 - k) * (1 - k);
    sim.wound = sim.w0 + (1 - sim.w0) * e;
    sim.windAngle = -e * (1 - sim.w0) * TURNS * 0.5;
    if (k >= 1) start();
  } else if (sim.state === "runaway") {
    // the spring lets go: the barrel spins out its turns in a second and a half, the train with it at its ratios
    const k = Math.min(1, sim.t / 1.5), released = sim.w0 * TURNS * (1 - (1 - k) * (1 - k)), rel = out.relative || {};
    sim.wound = sim.w0 * (1 - k) * (1 - k);
    for (const [id, r] of Object.entries(rel)) if (b && rel[b.id]) sim.angles[id] = (sim.base[id] || 0) + (released * r) / Math.abs(rel[b.id]);
    if (k >= 1) stop("The spring ran away: with no pallet fork to hold the escape wheel, it unwound in a second.");
  } else if (sim.state === "locked") {
    const esc = out.escapements[0];
    if (esc && sim.t < 0.15) sim.angles[esc.escape] = (sim.base[esc.escape] || 0) + (sim.t / 0.15) * (0.5 / esc.teeth) * 0.3;
    if (sim.t > 0.4) stop(level.goals.some(g => g.escapement === "locked") ? null : "Tick, and nothing more: the pallet fork locks the escape wheel, and there's no balance to swing it.");
    if (sim.t > 0.4 && verdict.ok) won();
  } else {
    const dh = (dt * speed) / 3600, esc = out.escapements.find(x => x.state === "running" && rates[x.escape]);
    sim.hours += dh;
    if (esc && speed === 1) {
      // at real speed the escape wheel steps half a tooth a beat, and every wheel steps with it
      const beats = Math.floor((sim.t * esc.vph) / 3600), escRev = (beats / (2 * esc.teeth)) * Math.sign(rates[esc.escape]);
      for (const [id, r] of Object.entries(rates)) if (r) sim.angles[id] = (sim.base[id] || 0) + (escRev * r) / rates[esc.escape];
    } else for (const [id, r] of Object.entries(rates)) if (r) sim.angles[id] = (sim.base[id] || 0) + r * sim.hours;
    if (esc) {                                                    // the balance swings in real time, whatever the speed
      const amp = level.amplitude ? (amplitudeOf(level, shown(), out, Math.max(0.05, sim.wound)) || 270) : 270 * Math.min(1, 0.45 + sim.wound * 0.7);   // its swing, from the force reaching it at this point of the spring's run
      sim.balance = amp * Math.sin(2 * Math.PI * (esc.vph / 7200) * sim.t);
      sim.fork = 8 * Math.max(-1, Math.min(1, sim.balance / 30));
    }
    if (b && rates[b.id]) {
      sim.wound -= (Math.abs(rates[b.id]) * dh) / TURNS;
      if (sim.wound <= 0) { sim.wound = 0; stop(`The mainspring has run down after ${Math.round(sim.hours)} hours.`); }
    }
  }
  frame();
  showPower();
  if (running()) requestAnimationFrame(tick);
}
/** The power reserve: hours left in the spring at the barrel's present rate. */
function showPower() {
  let el2 = $("power");
  if (!el2) { el2 = document.createElement("span"); el2.id = "power"; el2.className = "cb-power"; $("where").after(el2); }
  const b = barrelOf(), r = b && verdict && curOut().rates[b.id];
  el2.textContent = b ? `${Math.round(sim.wound * 100)}%${r ? ` · ${Math.round((sim.wound * TURNS) / Math.abs(r))} h` : ""}` : "";
  el2.title = "The mainspring: how wound it is, and the hours it has left at this rate";
}
$("windBtn").addEventListener("click", () => {
  if (running()) stop();
  else { wind(); $("windBtn").textContent = "Stop"; }
});

// ---------- the lesson: the level's ideas one at a time, each with the part it's about on its own and running ----------
const HOW = "Choose a part in the tray, then its layer: faint circles show where it would mesh. Tap an arbor to put the part on it, or tap near a wheel to stand a new arbor in mesh with it. Drag your own arbors to move them. Tap an arbor to see what drives it and what it drives; Isolate shows it with just those. 3D pulls the layers apart: drag to turn it, tap a layer's name to build on it, tap a part to pick it and its layer. Wind runs the watch. Workings follows the train mesh by mesh; Hint gives a nudge, and costs a star. Keys: 1–8 layers, W wind, Z undo, H hint, Delete removes, Esc lets go.";
let lesson = null;                       // the lesson open: { steps, at (the step on show), player (its scene, running) }
/** Opens the level's lesson at a step (the first, unless asked), and counts the level as seen. */
function openLesson(at = 0) {
  lesson?.player?.stop();
  const steps = lessonFor(level);
  lesson = { steps, at: Math.max(0, Math.min(at, steps.length - 1)), player: null };
  $("lessonTitle").textContent = `${level.id} ${level.title}`;
  const all = progress(); all[level.id] = { ...(all[level.id] || {}), seen: true }; write(PROGRESS, all);
  if (!$("lessonDlg").open) $("lessonDlg").showModal();          // open first: the picture is framed to the room it has
  showStep();
}
/** Shows the lesson's step: its picture playing, the line under it, its words; the dots and the way on. */
function showStep() {
  const { steps, at } = lesson, st = steps[at], last = steps.length - 1;
  lesson.player?.stop();
  $("lessonDots").replaceChildren(...steps.map((x, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `cb-dot${i === at ? " on" : i < at ? " done" : ""}${x.task ? " task" : ""}`;
    b.setAttribute("aria-label", x.task ? "The task" : `Step ${i + 1}`);
    if (i === at) b.setAttribute("aria-current", "step");
    b.addEventListener("click", () => { lesson.at = i; showStep(); });
    return b;
  }));
  const ch = CHAPTERS.find(c => c.id === level.chapter);
  $("lessonCount").textContent = st.task ? "Your task" : `${ch.title} · ${at + 1} of ${last}`;
  const say = $("lessonSay"), p = (text, cls) => { const e = document.createElement("p"); if (cls) e.className = cls; e.textContent = text; say.append(e); return e; };
  say.replaceChildren();
  // a chapter's first level opens with what the chapter is about
  if (at === 0 && LEVELS.find(l => l.chapter === level.chapter) === level) p(`Chapter ${ch.id}: ${ch.about}`, "cb-ch-intro");
  if (st.task) {
    const t = p("", "cb-task-say"), tag = document.createElement("span");
    tag.className = "cb-tag"; tag.textContent = "Your task"; t.append(tag, " ", st.say);
    if (st.watch.length) {
      p("Watch out for", "cb-watch-head");
      const ul = document.createElement("ul"); ul.className = "cb-watch";
      for (const w of st.watch) { const li = document.createElement("li"); li.textContent = w; ul.append(li); }
      say.append(ul);
    }
    const how = document.createElement("details"), sum = document.createElement("summary");
    how.className = "cb-how"; sum.textContent = "How to build"; how.append(sum); say.append(how);
    const hp = document.createElement("p"); hp.textContent = HOW; how.append(hp);
  } else p(st.say);
  say.scrollTop = 0;
  $("lessonBack").disabled = at === 0;
  $("lessonNext").textContent = st.task ? "Build it" : at === last - 1 ? "The task" : "Next";
  // the words first: the picture is framed to the room they leave it
  $("lessonReadout").textContent = "";
  lesson.player = playScene($("lessonScene"), st.scene, level, t => { $("lessonReadout").textContent = t; });
}
/** A step on or back; on from the task closes the lesson, to build. */
function stepLesson(d) {
  if (!lesson) return;
  const to = lesson.at + d;
  if (to > lesson.steps.length - 1) { $("lessonDlg").close(); return; }
  if (to < 0) return;
  lesson.at = to;
  showStep();
}
function openGlossary() {
  const body = $("glossBody"); body.replaceChildren();
  for (const [term, def] of GLOSSARY) { const p = document.createElement("p"), b = document.createElement("b"); b.textContent = term; p.append(b, " ", def); body.append(p); }
  if (!$("glossDlg").open) $("glossDlg").showModal();
}

// ---------- the course: every chapter and level, each level a picture of its plate and the idea it teaches ----------
/** The design to picture a level by: your own as you left it, else its solution once it runs, else its start. */
function designFor(L, all, work) {
  const w = work[L.id];
  if (w && w.sig === sigOf(L) && Array.isArray(w.arbors)) return { plate: L.plate, arbors: w.arbors };
  return all[L.id]?.stars ? solved(L) : startDesign(L);
}
/** A level's picture for the course: its plate as it stands, framed on where its work happens. */
const thumbOf = (svg, L, all, work) => drawThumb(svg, designFor(L, all, work), workAround(L, !!all[L.id]?.stars));
function openCourse() {
  const body = $("courseBody"), all = progress(), work = read(WORK, {});
  body.replaceChildren();
  const running = LEVELS.filter(L => all[L.id]?.stars).length, stars = LEVELS.reduce((n, L) => n + (all[L.id]?.stars || 0), 0);
  const next = LEVELS.find(L => !all[L.id]?.stars);
  // where you stand: levels running, stars, and the way on
  const head = document.createElement("div"); head.className = "cb-course-head";
  const line1 = document.createElement("p"); line1.className = "cb-course-line";
  line1.textContent = `${running} of ${LEVELS.length} levels running · ${stars} of ${LEVELS.length * 3} stars`;
  const bar = document.createElement("div"), fill = document.createElement("i");
  bar.className = "cb-bar"; fill.style.width = `${(100 * running) / LEVELS.length}%`; bar.append(fill);
  head.append(line1, bar);
  if (next && next !== level) {
    const go = document.createElement("button"); go.type = "button"; go.className = "btn primary cb-continue";
    go.textContent = `Continue: ${next.id} ${next.title}`;
    go.addEventListener("click", () => { $("courseDlg").close(); load(next.id); });
    head.append(go);
  }
  body.append(head);
  for (const ch of CHAPTERS) {
    const levels = LEVELS.filter(l => l.chapter === ch.id), done = levels.filter(L => all[L.id]?.stars).length, got = levels.reduce((n, L) => n + (all[L.id]?.stars || 0), 0);
    const det = document.createElement("details"), sum = document.createElement("summary");
    det.className = `cb-ch${done === levels.length ? " all" : ""}`;
    sum.innerHTML = `<span class="cb-ch-num"></span><span class="cb-ch-title"></span><span class="cb-ch-prog"></span>`;
    sum.children[0].textContent = ch.id; sum.children[1].textContent = ch.title;
    sum.children[2].textContent = `${done}/${levels.length}${got ? ` · ★${got}` : ""}`;
    det.append(sum);
    const about = document.createElement("p"); about.className = "cb-ch-about"; about.textContent = ch.about; det.append(about);
    const thumbs = [];
    for (const L of levels) {
      const p = all[L.id] || {}, b = document.createElement("button");
      b.type = "button"; b.className = `cb-level${L.id === level.id ? " here" : ""}${p.stars ? " done" : ""}`;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "cb-thumb"); svg.setAttribute("aria-hidden", "true");
      const words = document.createElement("span"), title = document.createElement("b"), teach = document.createElement("small"), state = document.createElement("span");
      words.className = "cb-level-words"; title.textContent = `${L.id} ${L.title}`; teach.textContent = TEACHES[L.id] || ""; words.append(title, teach);
      state.className = "cb-level-state";
      state.textContent = p.stars ? "★".repeat(p.stars) + "☆".repeat(3 - p.stars) : L.id === level.id ? "Here" : work[L.id] ? "Started" : p.seen ? "Seen" : "";
      b.append(svg, words, state);
      b.addEventListener("click", () => { $("courseDlg").close(); if (L.id !== level.id) load(L.id); });
      det.append(b);
      thumbs.push([svg, L]);
    }
    // the pictures are drawn the first time their chapter opens
    const draw = () => { for (const [svg, L] of thumbs.splice(0)) thumbOf(svg, L, all, work); };
    det.addEventListener("toggle", () => { if (det.open) draw(); });
    det.open = ch.id === level.chapter;
    body.append(det);
  }
  $("courseDlg").showModal();
  body.querySelector(".cb-level.here")?.scrollIntoView({ block: "center" });
}
function openMenu() {
  const body = $("menuBody"); body.replaceChildren();
  part(body, "play").append(action("Start this level again", () => { $("menuDlg").close(); load(level.id, true); }, "primary"),
    action("Undo", () => { $("menuDlg").close(); undo(); }), action("Lesson", () => { $("menuDlg").close(); openLesson(); }),
    action("Glossary", () => { $("menuDlg").close(); openGlossary(); }));
  part(body, "content").append(choice("Speed", SPEEDS, read(SPEED, 60), v => write(SPEED, v)));
  part(body, "about").append(action("Show a solution", () => {
    $("menuDlg").close();
    stop(); design = solved(level); tray.forEach(t => { t.left = 0; }); chosen = null; render();
    toast("One way to do it. Others work too.");
  }), line(`${Object.values(progress()).filter(p => p.stars).length} of ${LEVELS.length} levels running.`));
  $("menuDlg").showModal();
}
function toast(t) { const e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => e.classList.remove("on"), 3200); }

// ---------- wiring ----------
document.querySelector(".cb-mark").innerHTML = APPS.find(a => a.id === "calibre")?.logo || "";
bindSwitcher($("appsBtn"), "calibre");
$("lessonBtn").addEventListener("click", () => openLesson());
$("hintBtn").addEventListener("click", () => {
  if (!level.hints.length) return;
  const t = level.hints[Math.min(hintAt, level.hints.length - 1)];
  hintAt = Math.min(hintAt + 1, level.hints.length);
  $("hint").hidden = false; $("hint").textContent = t; renderBrief();
});
$("workBtn").addEventListener("click", () => {
  showWork = !showWork; $("workBtn").textContent = showWork ? "Hide workings" : "Workings";
  if (!showWork && isolate?.by === "work") setIsolate(null); else render();
});
$("undoBtn").addEventListener("click", undo);
$("index").addEventListener("input", e => {
  const bal = design.arbors.flatMap(a => a.parts || []).find(p => p.kind === "balance" && p.adjustable);
  if (bal) { bal.index = +e.target.value; verdict = judge(level, design); renderBrief(); keepWork(); }
});
document.addEventListener("keydown", e => {
  if (e.target.closest?.("input, textarea") || document.querySelector("dialog[open]")) return;
  if ((e.key === "z" || e.key === "Z") && !e.altKey) { e.preventDefault(); undo(); }
  else if (e.key >= "1" && e.key <= "8") { layer = +e.key; render(); }
  else if (e.key === "w" || e.key === "W" || e.key === " ") { e.preventDefault(); $("windBtn").click(); }
  else if (e.key === "h" || e.key === "H") $("hintBtn").click();
  else if (e.key === "Escape") { chosen = null; selected = null; setIsolate(null); }
  else if (e.key === "Delete" || e.key === "Backspace") {
    const a = design.arbors.find(x => x.id === selected), i = a ? a.parts.map(p => !p.fixed).lastIndexOf(true) : -1;
    if (a && i >= 0) removePart(a, i);
  }
});
$("lessonClose").addEventListener("click", () => $("lessonDlg").close());
$("lessonNext").addEventListener("click", () => stepLesson(1));
$("lessonBack").addEventListener("click", () => stepLesson(-1));
$("lessonDlg").addEventListener("close", () => { lesson?.player?.stop(); lesson = null; });
$("lessonDlg").addEventListener("keydown", e => {
  if (e.key === "ArrowRight") { e.preventDefault(); stepLesson(1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); stepLesson(-1); }
});
{ // a swipe across the picture steps on or back
  let from = null;
  $("lessonScene").addEventListener("pointerdown", e => { from = { x: e.clientX, y: e.clientY }; });
  $("lessonScene").addEventListener("pointerup", e => {
    if (!from) return;
    const dx = e.clientX - from.x, dy = e.clientY - from.y;
    from = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) stepLesson(dx < 0 ? 1 : -1);
  });
}
$("glossClose").addEventListener("click", () => $("glossDlg").close());
$("courseBtn").addEventListener("click", openCourse);
$("courseClose").addEventListener("click", () => $("courseDlg").close());
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("view3dBtn").textContent = view3d ? "Plan" : "3D";
$("view3dBtn").setAttribute("aria-pressed", String(view3d));
load(read(AT, null) || (LEVELS.find(l => !progress()[l.id]?.stars) || LEVELS[0]).id);
// for tests and debugging: the state, and where a point of the plan (of a layer's plane, in 3D) is on the page
window.__calibre = { get state() { return { level: level.id, layer, selected, chosen, view3d, cam, ok: verdict?.ok, arbors: design.arbors, isolate, lesson: lesson && { at: lesson.at, of: lesson.steps.length } }; },
  screenOf(lay, x, y) { const [u, v] = scene3d ? scene3d.toView(lay, x, y) : [x, y], q = new DOMPoint(u, v).matrixTransform(svg.getScreenCTM()); return [q.x, q.y]; } };
