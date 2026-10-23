// Guilloché: a rose engine. A target plate is shown engraved, and a machine with its knobs bare: the rosette's lobes and
// throw, how many passes to cut and how far to turn the rosette between them, a feed, a second rosette; and a dial is
// several cuts, each in its own zone. Set them until the plate you cut is the target's, and what a person learns is how a
// guilloché is made. The rules are guilloche-engine.js's, the plate is drawn by guilloche-draw.js; this file takes the
// fingers and keeps the work.
import { LEVELS, KNOBS, STARS, SHAPES, stepOf, makeJob, newRun, setKnob, undo, finish, say, closeness } from "./guilloche-engine.js";
import { createPlate } from "./guilloche-draw.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line, toggle, onPause } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "guilloche:run", MADE = "guilloche:jobs", BEST = "guilloche:best", OPTS = "guilloche:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const starText = n => "★".repeat(n) + "☆".repeat(3 - n);
const TABS = { 2: ["Centre", "Ring"], 3: ["Centre", "Band", "Rim"] };

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
};

// ---------- the work in hand and its keeping ----------
const made = () => read(MADE, {});
const unlocked = i => i === 0 || (made()[LEVELS[i - 1].id] ?? 0) >= STARS[0];
let plate = null, job = null, run = null, engraving = 0, doneTimer = 0;
let history = [];                                  // the batches of changes a finger made, for Undo (not kept: a reload starts it fresh)

const save = () => write(RUN, { v: 1, run });
function begin(i, seed = (Math.random() * 2 ** 31) >>> 0) {
  cancelAnimationFrame(engraving);
  engraving = 0;
  clearTimeout(doneTimer);
  job = makeJob(i, seed);
  run = newRun(job);
  history = [];
  open();
  save();
}
/** A saved run, if it is whole and of a plate the engine still makes; else the first plate. */
function load() {
  const s = read(RUN, null), r = s?.v === 1 ? s.run : null;
  if (r && LEVELS[r.job] && Number.isFinite(r.seed)) {
    const j = makeJob(r.job, r.seed);
    const ok = Array.isArray(r.vals) && r.vals.length === j.cuts.length && r.vals.every((v, i) => j.cuts[i].free.every(n => Number.isInteger(v?.[n]) && v[n] >= KNOBS[n].min && v[n] <= KNOBS[n].max && v[n] % stepOf(n) === 0))
      && Number.isInteger(r.at) && r.at >= 0 && r.at < j.cuts.length && Number.isFinite(r.taps);
    if (ok) { job = j; run = r; history = []; open(); return; }
  }
  begin(0);
}
/** The job and run in hand put on the page. */
function open() {
  plate.set(job, run);
  plate.ghost(opts.ghost);
  buildTabs();
  buildKnobs();
  render();
}

// ---------- drawing the page ----------
function render() {
  const best = made()[job.id] ?? 0;
  $("jobName").textContent = job.name;
  $("jobNo").textContent = `${job.index + 1} of ${LEVELS.length} · ${run.taps} tap${run.taps === 1 ? "" : "s"}`;
  $("jobStars").textContent = job.cuts.length > 1 ? "" : best ? starText(best) : "";
  $("line").textContent = say(job, run);
  $("acts").innerHTML = run.done
    ? `<button type="button" class="btn lg-act" data-act="again">A fresh one</button><button type="button" class="btn primary lg-act" data-act="next">${job.index === LEVELS.length - 1 ? "Back to the first" : "Next plate"}</button>`
    : `<button type="button" class="btn lg-act" data-act="undo" ${history.length ? "" : "disabled"}>Undo</button><button type="button" class="btn lg-act" data-act="over">Start over</button>`;
}
$("acts").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === "undo") { const last = history.pop(); if (last) { undo(job, run, last); save(); changed(); render(); } }
  else if (act === "over") begin(job.index, job.seed);
  else if (act === "again") begin(job.index);
  else if (act === "next") begin(job.index === LEVELS.length - 1 ? 0 : job.index + 1);
});

function buildTabs() {
  const box = $("tabs"), names = TABS[job.cuts.length];
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
    b.addEventListener("click", () => { if (run.done || i === run.at) return; run.at = i; save(); buildTabs(); buildKnobs(); plate.refresh(); });
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
  if (ch) { g.batch.push(ch); g.fresh = false; SOUND.tick(); changed(); }
  else syncKnobs();
  if (g.loose && g.batch.length) { history.push(g.batch); end(); }
}
const changed = () => { syncKnobs(); plate.refresh(); $("line").textContent = say(job, run); $("jobNo").textContent = `${job.index + 1} of ${LEVELS.length} · ${run.taps} tap${run.taps === 1 ? "" : "s"}`; };
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
  if (finish(job, run)) { save(); engrave(); }
}
$("knobs").addEventListener("pointerdown", e => {
  if (IN_FRAME || run.done || engraving) return;
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
  if (!range || !name || IN_FRAME || run.done || engraving) return;
  turn(name, Number(range.value));
});
// the end of a drag on a slider (the pointer is up wherever it is: the slider keeps it)
addEventListener("pointerup", () => release());
addEventListener("pointercancel", () => release());
$("knobs").addEventListener("click", e => {
  // a step button from the keyboard (a press has no pointer, so detail is 0)
  const step = e.target.closest(".lg-step");
  if (!step || e.detail !== 0 || run.done || engraving) return;
  const name = step.closest("[data-knob]").dataset.knob;
  turn(name, run.vals[run.at][name] + Number(step.dataset.d) * stepOf(name));
});

// ---------- a plate matched: it is engraved, pass by pass ----------
function engrave() {
  render();
  plate.peek(false);
  const t0 = performance.now(), span = 2400;
  clearTimeout(doneTimer);
  plate.reveal(0);
  SOUND.cut();
  const step = now => {
    const t = Math.min(1, (now - t0) / span);
    plate.reveal(t);
    if (t < 1) engraving = requestAnimationFrame(step); else engraved();
  };
  engraving = requestAnimationFrame(step);
}
/** The last pass is cut: the plate whole, a sound, and the result a moment on. */
function engraved() {
  engraving = 0;
  plate.reveal(1);
  SOUND.done();
  clearTimeout(doneTimer);
  doneTimer = setTimeout(showDone, 400);
}
function showDone() {
  const all = made(), before = all[job.id] ?? 0, d = run.done;
  const cutPasses = job.cuts.reduce((n, c, i) => n + (job.answer[i].n ?? c.fixed.n), 0);
  $("doneHead").textContent = `${job.name}: ${["", "engraved", "well engraved", "engraved by the book"][d.stars]}`;
  $("doneStars").textContent = starText(d.stars);
  $("doneBody").innerHTML = [["Taps", d.taps], ["Par", job.par], ["Passes cut", cutPasses], ["Cuts", job.cuts.length]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  $("doneNote").textContent = `${job.story} ${d.stars === 3 ? "" : `Par is the knobs to set, a tap each: within ${Math.ceil(job.par * 1.5) + 2} taps is three stars.`}`.trim();
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

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("Start this plate over", () => begin(job.index, job.seed), "primary"), action("A fresh one", () => begin(job.index)));
  const list = document.createElement("ol"), all = made();
  list.className = "lg-jobs";
  LEVELS.forEach((l, i) => {
    const li = document.createElement("li"), b = document.createElement("button"), open_ = unlocked(i), got = all[l.id] ?? 0;
    b.type = "button";
    b.disabled = !open_;
    b.className = i === job.index ? "cur" : "";
    b.innerHTML = `<span>${i + 1}. ${l.name}</span><small>${got ? starText(got) : open_ ? (i === job.index ? "in hand" : "") : "locked"}</small>`;
    b.title = l.story;
    b.addEventListener("click", () => { $("menuDlg").close(); if (i !== job.index) begin(i); });
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
plate = createPlate($("bench"));
{
  // holding the plate shows the target alone; letting go puts the engraving back
  const c = plate.canvas;
  const down = e => { if (!job || run.done || engraving || $("doneDlg").open) return; if (e.pointerType === "mouse" && e.button !== 0) return; c.setPointerCapture(e.pointerId); plate.peek(true); e.preventDefault(); };
  const up = () => plate.peek(false);
  c.addEventListener("pointerdown", down);
  c.addEventListener("pointerup", up);
  c.addEventListener("pointercancel", up);
  c.addEventListener("contextmenu", e => e.preventDefault());
}
// the menu stands the cutting point still; a plate being engraved when it opens is finished when it closes
let stopped = false;
onPause(() => { if (engraving) { cancelAnimationFrame(engraving); engraving = 0; stopped = true; } }, () => { if (stopped) { stopped = false; engraved(); } });
load();
window.__guilloche = { get job() { return job; }, get run() { return run; }, plate, begin, showDone, render, engrave, setKnob, finish, save, closeness, changed: () => { changed(); render(); } };
