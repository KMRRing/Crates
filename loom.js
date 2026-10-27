// Loom: weaving. A target cloth, and a loom with its threading and lifting plan bare: tap the shaft each warp thread goes
// through, which shafts lift on each pick and which yarn each pick carries, until the cloth you weave is the target's.
// It is a weaver's draft, the way one is written down, so what a person learns is how plain weave, twill, herringbone,
// satin, diamonds and houndstooth are made. The rules and the grade are loom-engine.js's, the sheet is drawn by
// loom-draw.js; this file takes the fingers and keeps the work.
import { JOBS, STARS, makeJob, newRun, setThread, setLift, setWeft, undo, finish, say } from "./loom-engine.js";
import { createLoom } from "./loom-draw.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line, toggle, onPause } from "./menu.js";
import { roundOver } from "./random.js";
import { IN_FRAME } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "loom:run", MADE = "loom:jobs", BEST = "loom:best", OPTS = "loom:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const starText = n => "★".repeat(n) + "☆".repeat(3 - n);

let opts = { sound: true, marks: true, ...read(OPTS, {}) };
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
  tap: () => noise(40, { lo: 500, hi: 2200, gain: 0.2, decay: 3 }),                // a heddle clicking over
  shuttle: () => noise(1500, { lo: 900, hi: 5200, gain: 0.07, decay: 0.2 }),       // the shuttle across the cloth
  done: () => noise(240, { lo: 300, hi: 1800, gain: 0.2, decay: 2 }),
};

// ---------- the work in hand and its keeping ----------
const made = () => read(MADE, {});
const unlocked = i => i === 0 || (made()[JOBS[i - 1].id] ?? 0) >= STARS[0];
let sheet = null, job = null, run = null, weaving = 0, doneTimer = 0;
let history = [];                                  // the batches of changes a finger made, for Undo (not kept: a reload starts it fresh)

const save = () => write(RUN, { v: 1, run });
function begin(i, seed = (Math.random() * 2 ** 31) >>> 0) {
  cancelAnimationFrame(weaving);
  clearTimeout(doneTimer);
  job = makeJob(i, seed);
  run = newRun(job);
  history = [];
  sheet.set(job, run);
  save();
  render();
}
/** A saved run, if it is whole and of a job the engine still makes; else the first job. */
function load() {
  const s = read(RUN, null), r = s?.v === 1 ? s.run : null;
  if (r && JOBS[r.job] && Number.isFinite(r.seed)) {
    const j = makeJob(r.job, r.seed);
    const ok = Array.isArray(r.thread) && r.thread.length === j.W && r.thread.every(x => Number.isInteger(x) && x >= -1 && x < j.S)
      && Array.isArray(r.lift) && r.lift.length === j.P && r.lift.every(row => Array.isArray(row) && row.length === j.S && row.every(x => x === 0 || x === 1))
      && Array.isArray(r.weft) && r.weft.length === j.P && r.weft.every(x => Number.isInteger(x) && x >= 0 && x < j.weftYarns.length) && Number.isFinite(r.taps);
    if (ok) { job = j; run = r; history = []; sheet.set(job, run); render(); return; }
  }
  begin(0);
}

// ---------- drawing the page ----------
function render() {
  const best = made()[job.id] ?? 0;
  $("jobName").textContent = job.name;
  $("jobNo").textContent = `${job.index + 1} of ${JOBS.length} · ${run.taps} tap${run.taps === 1 ? "" : "s"}`;
  $("jobStars").textContent = best ? starText(best) : "";
  $("line").textContent = say(job, run);
  sheet.marks(opts.marks);
  $("acts").innerHTML = run.done
    ? `<button type="button" class="btn lm-act" data-act="again">A fresh one</button><button type="button" class="btn primary lm-act" data-act="next">${job.index === JOBS.length - 1 ? "Back to the first" : "Next cloth"}</button>`
    : `<button type="button" class="btn lm-act" data-act="undo" ${history.length ? "" : "disabled"}>Undo</button><button type="button" class="btn lm-act" data-act="over">Start over</button>`;
}
$("acts").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === "undo") { const last = history.pop(); if (last) { undo(job, run, last); save(); sheet.refresh(); render(); } }
  else if (act === "over") begin(job.index, job.seed);
  else if (act === "again") begin(job.index);
  else if (act === "next") begin(job.index === JOBS.length - 1 ? 0 : job.index + 1);
});

// ---------- the fingers ----------
// A press sets (or clears) what is under it, and a drag carries on over the cells it passes, so a row of the same shaft or
// a column of lifts goes in with one stroke. Every cell that changes is a tap; a stroke is one Undo.
let drag = null;
function apply(h) {
  if (!h || !drag || h.kind !== drag.kind) return;
  let ch = null;
  if (h.kind === "thread") {
    if (drag.v >= 0) ch = setThread(job, run, h.c, drag.s);
    else if (run.thread[h.c] === drag.s) ch = setThread(job, run, h.c, -1);
  } else if (h.kind === "lift") ch = setLift(job, run, h.p, h.s, drag.v);
  else ch = setWeft(job, run, h.p, drag.v);
  if (ch) { drag.batch.push(ch); SOUND.tap(); }
}
function onDown(e) {
  if (drag || IN_FRAME || !job || run.done || $("doneDlg").open || weaving) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const h = sheet.hit(e);
  if (!h) return;
  drag = { id: e.pointerId, kind: h.kind, batch: [] };
  if (h.kind === "thread") { drag.s = h.s; drag.v = run.thread[h.c] === h.s ? -1 : h.s; }
  else if (h.kind === "lift") drag.v = !run.lift[h.p][h.s];
  else drag.v = (run.weft[h.p] + 1) % job.weftYarns.length;
  sheet.canvas.setPointerCapture(e.pointerId);
  apply(h);
  changed();
  e.preventDefault();
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const before = drag.batch.length;
  apply(sheet.hit(e));
  if (drag.batch.length !== before) changed();
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (d.batch.length) history.push(d.batch);
  save();
  render();
  if (e.type !== "pointercancel" && finish(job, run)) { save(); weave(); }
}
const changed = () => { sheet.refresh(); $("line").textContent = say(job, run); };

// ---------- a cloth finished: it is woven out, row by row ----------
function weave() {
  render();
  const t0 = performance.now();
  clearTimeout(doneTimer);
  SOUND.shuttle();
  const step = now => {
    const t = Math.min(1, (now - t0) / 1500);
    sheet.reveal(t);
    if (t < 1) weaving = requestAnimationFrame(step); else woven();
  };
  weaving = requestAnimationFrame(step);
}
/** The last row is in: the cloth whole, a sound, and the result a moment on. */
function woven() {
  weaving = 0;
  sheet.reveal(1);
  SOUND.done();
  clearTimeout(doneTimer);
  doneTimer = setTimeout(showDone, 350);
  roundOver("loom");
}
function showDone() {
  const all = made(), before = all[job.id] ?? 0, d = run.done;
  const used = new Set(run.thread.filter(s => s >= 0)).size;
  $("doneHead").textContent = `${job.name}: ${["", "woven", "well woven", "woven from the draft"][d.stars]}`;
  $("doneStars").textContent = starText(d.stars);
  $("doneBody").innerHTML = [["Taps", d.taps], ["Par", job.par], ["Shafts used", used], ["Picks to a repeat", job.P]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  $("doneNote").textContent = `${job.story} ${d.stars === 3 ? "" : `Par is the taps a weaver who knows the draft needs: within ${Math.ceil(job.par * 1.35) + 2} is three stars.`}`.trim();
  if (d.stars > before) {
    all[job.id] = d.stars;
    write(MADE, all);
    write(BEST, JOBS.reduce((n, j) => n + (all[j.id] ?? 0), 0));
  }
  const last = job.index === JOBS.length - 1;
  $("nextBtn").textContent = last ? "Back to the first" : "Next cloth";
  $("nextBtn").dataset.next = last ? "0" : String(job.index + 1);
  $("againBtn").textContent = "A fresh one";
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
  play.append(action("Start this cloth over", () => begin(job.index, job.seed), "primary"), action("A fresh one", () => begin(job.index)));
  const list = document.createElement("ol"), all = made();
  list.className = "lm-jobs";
  JOBS.forEach((j, i) => {
    const li = document.createElement("li"), b = document.createElement("button"), open = unlocked(i), got = all[j.id] ?? 0;
    b.type = "button";
    b.disabled = !open;
    b.className = i === job.index ? "cur" : "";
    b.innerHTML = `<span>${i + 1}. ${j.name}</span><small>${got ? starText(got) : open ? (i === job.index ? "in hand" : "") : "locked"}</small>`;
    b.title = j.story;
    b.addEventListener("click", () => { $("menuDlg").close(); if (i !== job.index) begin(i); });
    li.append(b);
    list.append(li);
  });
  part(body, "content").append(list);
  const st = part(body, "settings");
  st.append(toggle("Show what's wrong in the cloth", opts.marks, on => { opts.marks = on; saveOpts(); sheet.marks(on); }));
  st.append(toggle("Sound", opts.sound, on => { opts.sound = on; saveOpts(); }));
  const stars = read(BEST, 0);
  part(body, "about").append(line(`${job.story} ${stars ? `${stars} of ${JOBS.length * 3} stars so far.` : ""}`.trim()));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "loom");
document.querySelector(".lm-mark").innerHTML = APPS.find(a => a.id === "loom")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
sheet = createLoom($("bench"));
{
  const c = sheet.canvas;
  c.addEventListener("pointerdown", onDown);
  c.addEventListener("pointermove", onMove);
  c.addEventListener("pointerup", onUp);
  c.addEventListener("pointercancel", onUp);
  c.addEventListener("contextmenu", e => e.preventDefault());
}
// the menu stands the shuttle still; a cloth being woven when it opens is finished when it closes
let stopped = false;
onPause(() => { if (weaving) { cancelAnimationFrame(weaving); weaving = 0; stopped = true; } }, () => { if (stopped) { stopped = false; woven(); } });
load();
window.__loom = { get job() { return job; }, get run() { return run; }, sheet, begin, showDone, render, weave, setThread, setLift, setWeft, finish, save, changed: () => { sheet.refresh(); render(); } };
