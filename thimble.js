// Thimble: mending. A piece of cloth on the bench with a job to do: sew a button back on, set a belt loop back on its
// band, close a tear, hem a trouser leg, darn a hole. The marks to put the needle through are ringed on the cloth; a
// tap puts it in, and how near the mark it went is the grade. A part is dragged onto its chalk; a darn is pulled thread
// by thread across the hole, lengthwise and then across. The rules and the grade are thimble-engine.js's, the cloth
// is drawn by thimble-draw.js; this file takes the fingers and keeps the work.
import { JOBS, STARS, makeJob, newRun, finished, stepOf, place, stitch, darn, unpick, grade, say, progress, starsOf, WHY } from "./thimble-engine.js";
import { createBench } from "./thimble-draw.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line, toggle, onPause } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "thimble:run", MADE = "thimble:jobs", BEST = "thimble:best", OPTS = "thimble:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const pct = x => `${Math.round(x * 100)}%`;
const starText = n => "★".repeat(n) + "☆".repeat(3 - n);

let opts = { sound: true, ...read(OPTS, {}) };
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
  stitch: () => noise(70, { lo: 2400, hi: 8000, gain: 0.14, decay: 1.2 }),         // thread drawn through cloth
  pull: () => noise(160, { lo: 1800, hi: 7000, gain: 0.12, decay: 0.8 }),
  set: () => noise(45, { lo: 300, hi: 1500, gain: 0.28, decay: 3 }),               // a part set down
  done: () => noise(260, { lo: 1200, hi: 6000, gain: 0.12, decay: 0.5 }),
};

// ---------- the work in hand and its keeping ----------
const made = () => read(MADE, {});
const unlocked = i => i === 0 || (made()[JOBS[i - 1].id] ?? 0) >= STARS[0];
let bench = null, job = null, run = null, doneTimer = 0, pulling = 0;

const save = () => write(RUN, { v: 1, run });
function begin(i, seed = (Math.random() * 2 ** 31) >>> 0) {
  cancelAnimationFrame(pulling);
  clearTimeout(doneTimer);
  job = makeJob(i, seed);
  run = newRun(job);
  bench.set(job, run);
  save();
  render();
}
function load() {
  const s = read(RUN, null), r = s?.v === 1 ? s.run : null;
  if (r && JOBS[r.job] && Number.isFinite(r.seed)) {
    const j = makeJob(r.job, r.seed);
    if (Array.isArray(r.st) && r.st.length === j.steps.length && Number.isInteger(r.step)) {
      job = j; run = r;
      bench.set(job, run);
      if (finished(job, run)) bench.pull(1);
      render();
      return;
    }
  }
  begin(0);
}

// ---------- drawing the page ----------
function render() {
  const best = made()[job.id];
  $("jobName").textContent = job.name;
  const p = progress(job, run);
  $("jobNo").textContent = `${job.index + 1} of ${JOBS.length} · ${p.done} of ${p.all}`;
  $("jobStars").textContent = best != null && starsOf(best) ? starText(starsOf(best)) : "";
  const doneNow = finished(job, run), g = doneNow ? grade(job, run) : null;
  say_(doneNow ? `${g.stars ? ["", "It'll hold", "Neat work", "Invisible mending"][g.stars] : "Frayed"}: ${g.score} of 100.` : say(job, run));
  $("acts").innerHTML = doneNow
    ? `<button type="button" class="btn th-act" data-act="again">A fresh one</button><button type="button" class="btn primary th-act" data-act="next">${job.index === JOBS.length - 1 ? "Back to the first" : "Next job"}</button>`
    : `<button type="button" class="btn th-act" data-act="unpick" ${canUnpick() ? "" : "disabled"}>Unpick</button><button type="button" class="btn th-act" data-act="over">Start over</button>`;
}
const canUnpick = () => {
  const s = stepOf(job, run), st = s && run.st[run.step];
  return !!(s && ((s.type === "stitch" && st.pts.length) || (s.type === "darn" && (st.warp.length || st.weft.length))));
};
let lineTimer = 0;
function say_(text, bad = false) {
  const el = $("line");
  el.textContent = text;
  el.classList.toggle("bad", bad);
}
/** A word about what just went wrong, for a moment; then the line says what to do again. */
function flash(text) {
  if (!text) return;
  say_(text, true);
  clearTimeout(lineTimer);
  lineTimer = setTimeout(() => { if (job && !finished(job, run)) say_(say(job, run)); else render(); }, 1800);
}

$("acts").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === "unpick") { if (unpick(job, run)) { save(); bench.refresh(); render(); } }
  else if (act === "over") begin(job.index, job.seed);
  else if (act === "again") begin(job.index);
  else if (act === "next") begin(job.index === JOBS.length - 1 ? 0 : job.index + 1);
});

// ---------- the fingers ----------
let drag = null;
function onDown(e) {
  if (drag || IN_FRAME || !job || finished(job, run) || $("doneDlg").open) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const p = bench.toWorld(e), s = stepOf(job, run);
  if (s.type === "place") {
    const g = bench.grab(p.x, p.y);
    if (!g) { flash("Take hold of the part, and drag it onto its mark."); return; }
    drag = { id: e.pointerId, kind: "part", off: g };
    bench.part({ x: p.x + g.dx, y: p.y + g.dy });
  } else if (s.type === "stitch") {
    drag = { id: e.pointerId, kind: "aim" };
    bench.aim(p);
  } else {
    drag = { id: e.pointerId, kind: "path", path: [[p.x, p.y]] };
    bench.path(drag.path);
  }
  bench.canvas.setPointerCapture(e.pointerId);
  e.preventDefault();
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const p = bench.toWorld(e);
  if (drag.kind === "part") bench.part({ x: p.x + drag.off.dx, y: p.y + drag.off.dy });
  else if (drag.kind === "aim") bench.aim(p);
  else {
    const last = drag.path[drag.path.length - 1];
    if (Math.hypot(p.x - last[0], p.y - last[1]) > 0.4) { drag.path.push([p.x, p.y]); bench.path(drag.path); }
  }
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag, p = bench.toWorld(e);
  drag = null;
  bench.part(null); bench.aim(null); bench.path(null);
  if (e.type === "pointercancel") return;
  let r;
  if (d.kind === "part") {
    const at = { x: p.x + d.off.dx, y: p.y + d.off.dy };
    r = place(job, run, at.x, at.y);
    if (r.ok) { bench.fx("snap", stepOfDone().to.x, stepOfDone().to.y, 520); SOUND.set(); }
    else { bench.fx("miss", at.x, at.y); flash(WHY[r.why]); }
  } else if (d.kind === "aim") {
    r = stitch(job, run, p.x, p.y);
    if (r.ok) { bench.fx("ok", p.x, p.y); SOUND.stitch(); }
    else { bench.fx("miss", p.x, p.y); flash(WHY[r.why]); }
  } else {
    r = darn(job, run, d.path);
    if (r.ok) { const end = d.path[d.path.length - 1]; bench.fx("ok", end[0], end[1]); SOUND.pull(); }
    else if (r.why !== "tap") { const end = d.path[d.path.length - 1]; bench.fx("miss", end[0], end[1]); flash(WHY[r.why]); }
  }
  save();
  bench.refresh();
  if (r.ok) render();
  if (r.ok && finished(job, run)) finish();
}
/** The place step that was just done (the run has moved on to the next). */
const stepOfDone = () => job.steps.slice(0, run.step).reverse().find(s => s.type === "place");

// ---------- a job finished ----------
function finish() {
  const hasTear = job.scene.some(e => e.t === "tear");
  clearTimeout(doneTimer);
  const show = () => { SOUND.done(); doneTimer = setTimeout(showDone, 450); };
  if (!hasTear) { show(); return; }
  const t0 = performance.now();                                              // the tear is drawn shut
  const step = now => {
    const t = Math.min(1, (now - t0) / 900);
    bench.pull(1 - (1 - t) ** 3);
    if (t < 1) pulling = requestAnimationFrame(step); else show();
  };
  pulling = requestAnimationFrame(step);
}
function showDone() {
  const g = grade(job, run), all = made(), before = all[job.id];
  $("doneHead").textContent = `${job.name}: ${["frayed", "it'll hold", "neat work", "invisible mending"][g.stars]}`;
  $("doneStars").textContent = starText(g.stars);
  const rows = [];
  if (g.place != null) rows.push(["Setting the part", pct(g.place)]);
  if (g.stitch != null) rows.push(["Stitches", pct(g.stitch)]);
  if (g.darn != null) rows.push(["Darning", pct(g.darn)]);
  rows.push(["Tidiness", g.tidy ? `−${g.tidy}` : "clean"], ["Score", String(g.score)]);
  $("doneBody").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  $("doneNote").textContent = g.stars
    ? (before != null && before >= g.score ? `Your best for it is ${before}.` : before != null ? `Better than your ${before} before.` : "")
    : `A star needs ${STARS[0]}: put the needle nearer the ringed marks, and keep the misses down.`;
  if (before == null || g.score > before) {
    all[job.id] = g.score;
    write(MADE, all);
    write(BEST, JOBS.reduce((n, j) => n + starsOf(all[j.id] ?? 0), 0));
  }
  const last = job.index === JOBS.length - 1;
  $("nextBtn").textContent = !g.stars ? "Look at it" : last ? "Back to the first" : "Next job";
  $("nextBtn").dataset.next = !g.stars ? "stay" : last ? "0" : String(job.index + 1);
  $("againBtn").textContent = g.stars ? "A fresh one" : "Try another";
  render();
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
$("nextBtn").addEventListener("click", () => {
  $("doneDlg").close();
  const n = $("nextBtn").dataset.next;
  if (n !== "stay") begin(Number(n));
});
$("againBtn").addEventListener("click", () => { $("doneDlg").close(); begin(job.index); });

// ---------- messages, the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("Start this job over", () => begin(job.index, job.seed), "primary"), action("A fresh one", () => begin(job.index)));
  const list = document.createElement("ol"), all = made();
  list.className = "th-jobs";
  JOBS.forEach((j, i) => {
    const li = document.createElement("li"), b = document.createElement("button"), open = unlocked(i), score = all[j.id];
    b.type = "button";
    b.disabled = !open;
    b.className = i === job.index ? "cur" : "";
    b.innerHTML = `<span>${i + 1}. ${j.name}</span><small>${score != null ? starText(starsOf(score)) : open ? (i === job.index ? "in hand" : "") : "locked"}</small>`;
    b.title = j.story;
    b.addEventListener("click", () => { $("menuDlg").close(); if (i !== job.index) begin(i); });
    li.append(b);
    list.append(li);
  });
  part(body, "content").append(list);
  part(body, "settings").append(toggle("Sound", opts.sound, on => { opts.sound = on; saveOpts(); }));
  const stars = read(BEST, 0);
  part(body, "about").append(line(stars ? `${stars} of ${JOBS.length * 3} stars for the mending.` : "Nothing mended yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "thimble");
document.querySelector(".th-mark").innerHTML = APPS.find(a => a.id === "thimble")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
bench = createBench($("bench"));
{
  const c = bench.canvas;
  c.addEventListener("pointerdown", onDown);
  c.addEventListener("pointermove", onMove);
  c.addEventListener("pointerup", onUp);
  c.addEventListener("pointercancel", onUp);
  c.addEventListener("contextmenu", e => e.preventDefault());
}
onPause(() => bench.run(false), () => bench.run(true));
load();
window.__thimble = { get job() { return job; }, get run() { return run; }, bench, begin, finish, showDone, render, place, stitch, darn };
