// Guilloché: a rose engine. A target plate is shown faint, and a machine with its knobs bare: the rosette's lobes and
// throw, how many passes to cut and how far to turn the rosette between them, a feed, a second rosette, the straight
// engine's pitch and angle, the rays of a sunburst, how deep the graver goes; and a dial is several cuts, each in its own
// zone. Set the machine up (its path is drawn as a fine line), then Cut, zone by zone, until the plate is the target's:
// what a person learns is how a guilloché is made. The rules are guilloche-engine.js's, the watch is drawn in 3D by guilloche-3d.js (guilloche-flat.js where
// there is no WebGL) to the spec of guilloche-watch.js; this file takes the fingers and keeps the work.
import { LEVELS, KNOBS, STARS, cutNames, CLUE_CAP, stepOf, makeJob, newRun, setKnob, undo, finish, say, closeness, takeClue, lessonJob, lessonRun, lessonStep, stepDone, cutPlate, asCut, cutRight, passes, settingsOf } from "./guilloche-engine.js";
import { createWatch } from "./guilloche-3d.js";
import { createFlat } from "./guilloche-flat.js";
import { watchOf } from "./guilloche-watch.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line, toggle, onPause } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "guilloche:run", MADE = "guilloche:jobs", BEST = "guilloche:best", OPTS = "guilloche:opts", TAUGHT = "guilloche:lessons";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const starText = n => "★".repeat(n) + "☆".repeat(3 - n);

let opts = { sound: true, ghost: true, ...read(OPTS, {}) };
const saveOpts = () => write(OPTS, opts);

// ---------- the sounds, made as they play (no files) ----------
let audio = null;
function noise(ms, { lo = 200, hi = 4000, gain = 0.25, decay = 0.6 } = {}) {
  if (!opts.sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume();
    const n = Math.round(audio.sampleRate * ms / 1000), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decay;
    const src = audio.createBufferSource(), bp = audio.createBiquadFilter(), g = audio.createGain();
    src.buffer = buf;
    bp.type = "bandpass"; bp.frequency.value = Math.sqrt(lo * hi); bp.Q.value = Math.sqrt(lo * hi) / (hi - lo);
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(audio.destination);
    src.start();
  } catch { /* no sound here */ }
}
const SOUND = {
  tick: () => noise(30, { lo: 1200, hi: 4200, gain: 0.12, decay: 3 }),                // a click of the index wheel
  cut: () => noise(2300, { lo: 2500, hi: 7000, gain: 0.05, decay: 0.15 }),            // the cutting point running
  done: () => noise(260, { lo: 600, hi: 3000, gain: 0.18, decay: 2 }),
  set: () => noise(90, { lo: 2000, hi: 6500, gain: 0.14, decay: 2.5 }),          // a hand or a marker set on the dial
  clue: () => noise(140, { lo: 500, hi: 1800, gain: 0.1, decay: 1.5 }),
};

// ---------- the work in hand and its keeping ----------
const made = () => read(MADE, {});
// open once the one before has a star, or once played (the plates were reordered when the straight engine came: a plate with stars stays open)
const unlocked = i => i === 0 || (made()[LEVELS[i].id] ?? 0) > 0 || (made()[LEVELS[i - 1].id] ?? 0) >= STARS[0];
let plate = null, job = null, run = null, engraving = 0, carving = 0, doneTimer = 0;      // engraving: the watch being put together; carving: a cut being cut
let history = [];                                  // the batches of changes a finger made, for Undo (not kept: a reload starts it fresh)
let hint = null;                                   // the clue on show: { cut, name, tier, text }; it stays until its knob is touched
const taught = id => read(TAUGHT, {})[id] || (made()[id] ?? 0) > 0;      // a plate already played needs no lesson

const save = () => { if (!job.lesson) write(RUN, { v: 1, run }); };
function stop() {
  cancelAnimationFrame(engraving);
  cancelAnimationFrame(carving);
  engraving = carving = 0;
  afterCarve = null;
  clearTimeout(doneTimer);
  hint = null;
  history = [];
}
/** A plate to cut. A plate not yet met opens with its lesson (`lesson: false` skips that), which ends in this plate. */
function begin(i, seed = (Math.random() * 2 ** 31) >>> 0, lesson = true) {
  stop();
  if (lesson && !taught(LEVELS[i].id)) { teach(i, seed); return; }
  job = makeJob(i, seed);
  run = newRun(job);
  open();
  save();
}
/** The lesson of a plate: the machine with no target, a few things to set, what each showed; then the plate itself. */
function teach(i, seed = (Math.random() * 2 ** 31) >>> 0) {
  stop();
  job = lessonJob(i);
  job.next = seed;
  run = lessonRun(job);
  open();
}
function endLesson() {
  const i = job.index, seed = job.next, all = read(TAUGHT, {});
  all[LEVELS[i].id] = true;
  write(TAUGHT, all);
  begin(i, seed, false);
}
/** A saved run, if it is whole and of a plate the engine still makes; else the first plate. */
function load() {
  const s = read(RUN, null), r = s?.v === 1 ? s.run : null;
  // the plate by its name, not its number: the plates were reordered when the straight engine came (a run kept before then
  // has no name, and is let go) and again when the textures came (27 October 2026)
  const at = r?.id ? LEVELS.findIndex(l => l.id === r.id) : -1;
  if (at >= 0 && Number.isFinite(r.seed)) {
    const j = makeJob(at, r.seed);
    const knobsOk = (v, i) => j.cuts[i].free.every(n => Number.isInteger(v?.[n]) && v[n] >= KNOBS[n].min && v[n] <= KNOBS[n].max && v[n] % stepOf(n) === 0);
    const ok = Array.isArray(r.vals) && r.vals.length === j.cuts.length && r.vals.every(knobsOk)
      && Number.isInteger(r.at) && r.at >= 0 && r.at < j.cuts.length && Number.isFinite(r.taps);
    // what was cut: a run kept before a plate was cut zone by zone has none (one already done was cut as it was set)
    const cut = Array.isArray(r.cut) && r.cut.length === j.cuts.length && r.cut.every((v, i) => v === null || knobsOk(v, i)) ? r.cut : r.vals?.map(v => (r.done ? { ...v } : null));
    if (ok) { job = j; run = { clues: 0, ...r, job: at, cut }; history = []; open(); return; }
    begin(at, r.seed, false);                       // the plate's knobs have changed since: the same plate, set afresh
    return;
  }
  begin(0);
}
/** The job and run in hand put on the page. */
function open() {
  plate.set(job, run);
  plate.ghost(opts.ghost);
  plate.mark(-1);
  buildTabs();
  buildKnobs();
  render();
}

// ---------- drawing the page ----------
/** What the line under the plate says: a lesson's step, a clue, or how near the plate is. */
function lineText() {
  if (job.lesson) { const st = lessonStep(job, run); return stepDone(job, run) ? st.learn : st.do; }
  if (carving) { const name = job.cuts.length > 1 ? `${cutNames(job.index)[run.at]}: ` : ""; return `${name}the cutter runs it, pass by pass.`; }
  return hint && !run.done ? hint.text : say(job, run);
}
const counts = () => `${job.index + 1} of ${LEVELS.length} · ${run.taps} tap${run.taps === 1 ? "" : "s"}`;
const button = (act, text, cls = "", extra = "") => `<button type="button" class="btn ${cls} lg-act" data-act="${act}" ${extra}>${text}</button>`;
const NEXT_CLUE = ["free", "free", "caps stars at 2", "caps stars at 1"];
function render() {
  const best = made()[job.id] ?? 0, lessonNo = job.lesson ? `Lesson ${run.step + 1}/${job.steps}` : counts();
  $("jobName").textContent = job.name;
  $("jobNo").textContent = job.lesson ? lessonNo : lessonNo;
  $("jobStars").textContent = job.lesson || job.cuts.length > 1 ? "" : best ? starText(best) : "";
  $("line").textContent = lineText();
  if (job.lesson) {
    const last = run.step === job.steps - 1;
    $("acts").innerHTML = button("skip", "Skip the lesson") + button("step", last ? "Cut the plate" : "Next", "primary", stepDone(job, run) && !carving ? "" : "disabled");
  } else if (run.done) {
    $("acts").innerHTML = button("again", "A fresh one") + button("next", job.index === LEVELS.length - 1 ? "Back to the first" : "Next plate", "primary");
  } else {
    const nextTier = Math.min(3, (hint ? hint.tier : 0) + 1);
    $("acts").innerHTML = button("undo", "Undo", "", history.length && !carving ? "" : "disabled") + button("clue", `Clue<small>${NEXT_CLUE[nextTier]}</small>`, "lg-clue", carving ? "disabled" : "")
      + button("cut", "Cut", "primary", asCut(run) || carving ? "disabled" : "");
  }
  $("tabs").querySelectorAll("button").forEach((b, n) => {
    b.classList.toggle("lg-hint", !!hint && hint.cut === n && !run.done);
    b.classList.toggle("lg-cut", !!run.cut?.[n] && !job.lesson);
    b.classList.toggle("lg-true", !job.lesson && cutRight(job, run, n));
  });
  document.querySelectorAll(".lg-knob").forEach(k => k.classList.toggle("lg-hint", !!hint && !run.done && hint.name === k.dataset.knob && hint.cut === run.at));
  document.querySelectorAll(".lg-knob").forEach(k => k.classList.toggle("lg-want", !!job.lesson && !!lessonStep(job, run) && !stepDone(job, run) && k.dataset.knob in lessonStep(job, run).set));
}
$("acts").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === "undo") { const last = history.pop(); if (last) { undo(job, run, last); save(); changed(); render(); } }
  else if (act === "over") begin(job.index, job.seed, false);
  else if (act === "cut") cutNow();
  else if (act === "again") begin(job.index);
  else if (act === "next") begin(job.index === LEVELS.length - 1 ? 0 : job.index + 1);
  else if (act === "clue") giveClue();
  else if (act === "skip") endLesson();
  else if (act === "step") nextStep();
});
/** The next clue: about the knob that matters most, on a tier from the last if it is still that knob; its cut is shown and ringed on the dial. */
function giveClue() {
  if (run.done || engraving || carving) return;
  const c = takeClue(job, run, hint);
  if (!c) return;
  hint = c;
  SOUND.clue();
  if (c.cut !== run.at) { run.at = c.cut; buildTabs(); buildKnobs(); }
  plate.mark(c.cut);
  save();
  plate.refresh();
  render();
}
function nextStep() {
  if (!stepDone(job, run) || carving) return;
  if (run.step === job.steps - 1) { endLesson(); return; }
  run.step++;
  const st = lessonStep(job, run);
  if (st.cut !== run.at) { run.at = st.cut; buildTabs(); buildKnobs(); plate.refresh(); }
  render();
}

function buildTabs() {
  const box = $("tabs"), names = cutNames(job.index);
  box.replaceChildren();
  if (!names) return;
  names.forEach((n, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.role = "tab";
    b.textContent = String(i + 1);
    b.title = n;
    b.setAttribute("aria-label", `Cut ${i + 1}: ${n}`);
    b.setAttribute("aria-selected", String(i === run.at));
    b.addEventListener("click", () => { if (run.done || carving || i === run.at) return; run.at = i; save(); buildTabs(); buildKnobs(); plate.refresh(); render(); });
    box.append(b);
  });
}

// ---------- the knobs ----------
let gesture = null;                                // { batch, fresh } while a finger is on a knob
const inputs = new Map();                          // knob name -> { range, out }
function buildKnobs() {
  const box = $("knobs"), c = job.cuts[run.at], most = Math.max(...job.cuts.map(x => x.free.length));
  box.replaceChildren();
  inputs.clear();
  box.style.setProperty("--rows", String(Math.ceil(most / 2)));
  for (const name of c.free) {
    const K = KNOBS[name], el = document.createElement("div");
    el.className = "lg-knob";
    el.dataset.knob = name;
    el.innerHTML = `<label for="k-${name}"><span>${K.name}</span><output></output></label><div class="lg-row"><button type="button" class="btn lg-step" data-d="-1" aria-label="${K.name} down">−</button><input id="k-${name}" type="range" min="${K.min}" max="${K.max}" step="${stepOf(name)}"><button type="button" class="btn lg-step" data-d="1" aria-label="${K.name} up">+</button></div>`;
    box.append(el);
    inputs.set(name, { range: el.querySelector("input"), out: el.querySelector("output") });
  }
  syncKnobs();
}
function syncKnobs() {
  const vals = run.vals[run.at];
  for (const [name, { range, out }] of inputs) {
    const v = vals[name], K = KNOBS[name];
    if (Number(range.value) !== v) range.value = String(v);
    out.textContent = K.say(v);
    range.setAttribute("aria-valuetext", K.say(v));
  }
}
/** A change to a knob of the cut in hand: by the rules, drawn, and kept in the finger's batch (a new tap only the first in a gesture). */
function turn(name, v) {
  const g = gesture ?? { batch: [], fresh: true, loose: true };
  const ch = setKnob(job, run, run.at, name, v, g.fresh);
  if (ch) { g.batch.push(ch); g.fresh = false; lastTouched = { cut: ch.cut, name }; SOUND.tick(); changed(); }
  else syncKnobs();
  if (g.loose && g.batch.length) { history.push(g.batch); end(); }
}
const changed = () => {
  if (hint && !run.done && hint.name === lastTouched?.name && hint.cut === lastTouched?.cut) { hint = null; plate.mark(-1); }     // touching the knob a clue was about puts the clue away
  syncKnobs(); plate.refresh(); $("line").textContent = lineText();
  if (!job.lesson) $("jobNo").textContent = counts();
};
let lastTouched = null;
/** A finger has let go: its changes are one Undo, the run is kept, and a plate that matches is engraved. */
function release() {
  if (!gesture) return;
  const g = gesture;
  gesture = null;
  if (g.batch.length) history.push(g.batch);
  end();
}
function end() {
  save();
  render();
  // a lesson's step, once set, is cut for you, so what it did is seen engraved
  if (job.lesson && stepDone(job, run)) { SOUND.set(); cutNow(); }
}
$("knobs").addEventListener("pointerdown", e => {
  if (IN_FRAME || run.done || engraving || carving) return;
  const range = e.target.closest('input[type="range"]'), step = e.target.closest(".lg-step");
  const name = e.target.closest("[data-knob]")?.dataset.knob;
  if (!name) return;
  if (range) { gesture = { batch: [], fresh: true }; return; }
  if (!step) return;
  gesture = { batch: [], fresh: true };
  const d = Number(step.dataset.d) * stepOf(name), go = () => turn(name, run.vals[run.at][name] + d);
  go();
  step.setPointerCapture(e.pointerId);
  let hold = setTimeout(() => { hold = setInterval(go, 85); }, 420);
  const stop = () => { clearTimeout(hold); clearInterval(hold); step.removeEventListener("pointerup", stop); step.removeEventListener("pointercancel", stop); release(); };
  step.addEventListener("pointerup", stop);
  step.addEventListener("pointercancel", stop);
  e.preventDefault();
});
$("knobs").addEventListener("input", e => {
  const range = e.target.closest('input[type="range"]'), name = e.target.closest("[data-knob]")?.dataset.knob;
  if (!range || !name || IN_FRAME || run.done || engraving || carving) return;
  turn(name, Number(range.value));
});
// the end of a drag on a slider (the pointer is up wherever it is: the slider keeps it)
addEventListener("pointerup", () => release());
addEventListener("pointercancel", () => release());
$("knobs").addEventListener("click", e => {
  // a step button from the keyboard (a press has no pointer, so detail is 0)
  const step = e.target.closest(".lg-step");
  if (!step || e.detail !== 0 || run.done || engraving || carving) return;
  const name = step.closest("[data-knob]").dataset.knob;
  turn(name, run.vals[run.at][name] + Number(step.dataset.d) * stepOf(name));
});

// ---------- a cut: the zone in hand engraved pass by pass under the cutter; the plate true, the watch put together ----------
const SET_MS = 2000, REST_MS = 600, clamp01 = x => Math.max(0, Math.min(1, x));
/** How long a cut takes to cut: longer for more passes, never so long it drags. */
const carveMs = n => Math.max(900, Math.min(2600, 500 + n * 45));
let afterCarve = null;
/**
 * Cut the zone in hand as the machine is set (Korbi, 27 October 2026: "user should make the lines first, then cut"):
 * what was cut there before is faced off, the cutter runs the new cut pass by pass, and then the line says what it
 * came to. When every zone is cut true, the watch is put together. In a lesson it is the step's own cut, free.
 */
function cutNow() {
  if (IN_FRAME || run.done || engraving || carving) return;
  const i = run.at, r = cutPlate(job, run, i);
  if (!r) return;
  save();
  const n = passes(settingsOf(job.cuts[i], run.cut[i])).length, ms = carveMs(n), t0 = performance.now();
  plate.carve(i, 0);
  SOUND.cut();
  afterCarve = () => {
    afterCarve = null;
    plate.carve(i, 1);
    if (!job.lesson && finish(job, run)) { save(); assemble(); return; }
    if (!job.lesson) SOUND.done();
    render();
  };
  const step = now => {
    const x = clamp01((now - t0) / ms);            // (a frame's time can be a moment before the cut was asked for)
    plate.carve(i, x);
    if (x < 1) carving = requestAnimationFrame(step); else { carving = 0; afterCarve?.(); }
  };
  carving = requestAnimationFrame(step);
  render();
}
/** Every zone cut true: the markers and hands are set, the glass goes on, and the watch is drawn back to be seen whole. */
function assemble() {
  hint = null;
  plate.mark(-1);
  render();
  plate.peek(false);
  plate.refresh();                                  // the target's ghost and the machine's path go: the plate is done
  const t0 = performance.now();
  clearTimeout(doneTimer);
  plate.assemble(0);
  let set = false;
  const step = now => {
    const t = now - t0;
    plate.assemble(Math.max(0, Math.min(1, t / SET_MS)));
    if (!set && t > 300) { set = true; SOUND.set(); }
    if (t < SET_MS + REST_MS) engraving = requestAnimationFrame(step); else engraved();
  };
  engraving = requestAnimationFrame(step);
}
/** The watch is made: the plate whole, the hands set, a sound, and the result a moment on. */
function engraved() {
  engraving = 0;
  plate.assemble(1);
  SOUND.done();
  clearTimeout(doneTimer);
  doneTimer = setTimeout(showDone, 500);
}
function showDone() {
  const all = made(), before = all[job.id] ?? 0, d = run.done;
  const cutPasses = job.cuts.reduce((n, c, i) => n + passes(settingsOf(c, job.answer[i])).length, 0), watch = watchOf(job.id);
  $("doneHead").textContent = `${job.name}: ${["", "engraved", "well engraved", "engraved by the book"][d.stars]}`;
  $("doneStars").textContent = starText(d.stars);
  $("doneBody").innerHTML = [["Taps", d.taps], ["Par", job.par], ["Passes cut", cutPasses], ["Clues", d.clues]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  const why = d.clues && CLUE_CAP[d.clues] < 3 ? `Clues cap the stars at ${CLUE_CAP[d.clues]}. ` : d.stars === 3 ? "" : `Par is the knobs to set and a cut for each zone, a tap each: within ${Math.ceil(job.par * 1.5) + 2} taps is three stars. `;
  $("doneNote").textContent = `Set in a ${watch.name.toLowerCase()} watch. ${job.story} ${why}`.trim();
  if (d.stars > before) {
    all[job.id] = d.stars;
    write(MADE, all);
    write(BEST, LEVELS.reduce((n, l) => n + (all[l.id] ?? 0), 0));
  }
  const last = job.index === LEVELS.length - 1;
  $("nextBtn").textContent = last ? "Back to the first" : "Next plate";
  $("nextBtn").dataset.next = last ? "0" : String(job.index + 1);
  render();
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
$("nextBtn").addEventListener("click", () => { $("doneDlg").close(); begin(Number($("nextBtn").dataset.next)); });
$("againBtn").addEventListener("click", () => { $("doneDlg").close(); begin(job.index); });
$("lookBtn").addEventListener("click", () => $("doneDlg").close());

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action(job.lesson ? "Leave the lesson" : "Start this plate over", () => (job.lesson ? endLesson() : begin(job.index, job.seed, false)), "primary"), action("A fresh one", () => begin(job.index, undefined, false)), action("Lesson for this plate", () => teach(job.index, job.lesson ? job.next : job.seed), "link"));
  const list = document.createElement("ol"), all = made();
  list.className = "lg-jobs";
  LEVELS.forEach((l, i) => {
    const li = document.createElement("li"), b = document.createElement("button"), open_ = unlocked(i), got = all[l.id] ?? 0;
    b.type = "button";
    b.disabled = !open_;
    b.className = i === job.index ? "cur" : "";
    b.innerHTML = `<span>${i + 1}. ${l.name}<em>${watchOf(l.id).name}</em></span><small>${got ? starText(got) : open_ ? (i === job.index ? "in hand" : "") : "locked"}</small>`;
    b.title = l.story;
    b.addEventListener("click", () => { $("menuDlg").close(); if (i !== job.index || job.lesson) begin(i); });
    li.append(b);
    list.append(li);
  });
  part(body, "content").append(list);
  const st = part(body, "settings");
  st.append(toggle("Show the target faint on the plate", opts.ghost, on => { opts.ghost = on; saveOpts(); plate.ghost(on); }));
  st.append(toggle("Sound", opts.sound, on => { opts.sound = on; saveOpts(); }));
  const stars = read(BEST, 0);
  part(body, "about").append(line(`${job.story} ${stars ? `${stars} of ${LEVELS.length * 3} stars so far.` : ""}`.trim()));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "guilloche");
document.querySelector(".lg-mark").innerHTML = APPS.find(a => a.id === "guilloche")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
try { plate = createWatch($("bench")); }
catch (err) {
  console.warn("Guilloché: no WebGL here, so the watch is drawn flat.", err);
  plate = createFlat($("bench"));
}
{
  // a finger on the watch: held still it shows the target alone; dragged it tips the watch (the light plays on the grooves);
  // two fingers (pinch to zoom, both together to slide), the wheel (zoom), a mouse's right button or shift (slide) or a double tap (back) look closer
  const c = plate.canvas, fingers = new Map();
  let hold = 0, peeking = false, tipped = false, pinch = 0, mid = null;
  const idle = () => !job || engraving || carving || $("doneDlg").open;
  const gap = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const centre = () => { const [a, b] = [...fingers.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  c.addEventListener("pointerdown", e => {
    c.setPointerCapture(e.pointerId);
    // a mouse's right button or shift slides the picture; a finger tips it
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, slide: e.pointerType === "mouse" && (e.button !== 0 || e.shiftKey) });
    if (fingers.size === 2) { clearTimeout(hold); pinch = gap(); mid = centre(); if (peeking) { peeking = false; plate.peek(false); } return; }
    tipped = false;
    clearTimeout(hold);
    if (!fingers.get(e.pointerId).slide) hold = setTimeout(() => { if (!tipped && !idle() && !run.done && !job.lesson) { peeking = true; plate.peek(true); } }, 260);
    e.preventDefault();
  });
  c.addEventListener("pointermove", e => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    const dx = e.clientX - f.x, dy = e.clientY - f.y;
    f.x = e.clientX; f.y = e.clientY;
    if (fingers.size === 2) {
      const g = gap(), m = centre();
      if (pinch) plate.zoom(g / pinch);
      if (mid) plate.pan(m.x - mid.x, m.y - mid.y);
      pinch = g; mid = m;
      return;
    }
    if (f.slide) { plate.pan(dx, dy); return; }
    if (!tipped && Math.hypot(f.x - f.x0, f.y - f.y0) > 6) { tipped = true; clearTimeout(hold); if (peeking) { peeking = false; plate.peek(false); } }
    if (tipped) plate.orbit(dx * 0.006, dy * 0.006);
  });
  const up = e => { fingers.delete(e.pointerId); clearTimeout(hold); pinch = 0; mid = null; if (peeking && !fingers.size) { peeking = false; plate.peek(false); } };
  c.addEventListener("pointerup", up);
  c.addEventListener("pointercancel", up);
  c.addEventListener("wheel", e => { e.preventDefault(); plate.zoom(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  c.addEventListener("dblclick", () => plate.resetView());
  c.addEventListener("contextmenu", e => e.preventDefault());
}
// the menu stands the cutting point still; a cut, or the watch being put together, when it opens is finished when it closes
let stopped = false;
onPause(() => {
  plate.pause(true);
  if (carving) { cancelAnimationFrame(carving); carving = 0; stopped = true; }
  if (engraving) { cancelAnimationFrame(engraving); engraving = 0; stopped = true; }
}, () => {
  plate.pause(false);
  if (!stopped) return;
  stopped = false;
  if (afterCarve) afterCarve(); else if (run.done) engraved();
});
load();
window.__guilloche = { get job() { return job; }, get run() { return run; }, get busy() { return !!(carving || engraving); }, plate, begin, teach, endLesson, nextStep, giveClue, showDone, render, cutNow, assemble, setKnob, finish, save, closeness, changed: () => { changed(); render(); } };
