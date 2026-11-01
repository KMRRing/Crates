// Loom's draft: a target cloth, and a loom with its threading and lifting plan bare: tap the shaft each warp thread goes
// through, which shafts lift on each pick and which yarn each pick carries, until the cloth you weave is the target's.
// It is a weaver's draft, the way one is written down, so what a person learns is how plain weave, twill, herringbone,
// satin, diamonds and houndstooth are made. The rules and the grade are loom-engine.js's, the sheet is drawn by
// loom-draw.js; this file takes the fingers and keeps the work. (The first Loom; the cloths of loom-play.js came after.)
import { JOBS, STARS, makeJob, newRun, setThread, setLift, setWeft, undo, finish, say } from "./loom-engine.js";
import { createLoom } from "./loom-draw.js";
import { part, action, line } from "./menu.js";
import { roundOver } from "./random.js";
import { IN_FRAME } from "./suite.js";
import { $, read, write, starText, opts, SOUND, finished, keepBest } from "./loom-kit.js";

const RUN = "loom:run", MADE = "loom:jobs";
const made = () => read(MADE, {});
const unlocked = i => i === 0 || (made()[JOBS[i - 1].id] ?? 0) >= STARS[0];

export function createDraft(host) {
  const sheet = createLoom(host);
  let job = null, run = null, weaving = 0, doneTimer = 0, stopped = false;
  let history = [];                                  // the batches of changes a finger made, for Undo (not kept: a reload starts it fresh)

  const save = () => write(RUN, { v: 1, run });
  function begin(i, seed = (Math.random() * 2 ** 31) >>> 0) {
    cancelAnimationFrame(weaving);
    clearTimeout(doneTimer);
    weaving = 0;
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
    $("line").classList.remove("bad");
    sheet.marks(opts.marks);
    $("acts").className = "lm-acts";
    $("acts").innerHTML = run.done
      ? `<button type="button" class="btn lm-act" data-act="again">A fresh one</button><button type="button" class="btn primary lm-act" data-act="next">${job.index === JOBS.length - 1 ? "Back to the first" : "Next cloth"}</button>`
      : `<button type="button" class="btn lm-act" data-act="undo" ${history.length ? "" : "disabled"}>Undo</button><button type="button" class="btn lm-act" data-act="over">Start over</button>`;
  }
  function act(a) {
    if (a === "undo") { const last = history.pop(); if (last) { undo(job, run, last); save(); sheet.refresh(); render(); } }
    else if (a === "over") begin(job.index, job.seed);
    else if (a === "again") begin(job.index);
    else if (a === "next") begin(job.index === JOBS.length - 1 ? 0 : job.index + 1);
  }

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
  for (const [type, fn] of [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onUp], ["pointercancel", onUp]]) sheet.canvas.addEventListener(type, fn);
  sheet.canvas.addEventListener("contextmenu", e => e.preventDefault());

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
    if (d.stars > before) { all[job.id] = d.stars; write(MADE, all); keepBest(); }
    const last = job.index === JOBS.length - 1;
    render();
    finished({
      head: `${job.name}: ${["", "woven", "well woven", "woven from the draft"][d.stars]}`,
      stars: d.stars,
      rows: [["Taps", d.taps], ["Par", job.par], ["Shafts used", used], ["Picks to a repeat", job.P]],
      note: `${job.story} ${d.stars === 3 ? "" : `Par is the taps a weaver who knows the draft needs: within ${Math.ceil(job.par * 1.35) + 2} is three stars.`}`.trim(),
      again: ["A fresh one", () => begin(job.index)],
      next: [last ? "Back to the first" : "Next cloth", () => begin(last ? 0 : job.index + 1)],
    });
  }

  return {
    sheet,
    /** The draft takes the page: what was in hand, or the first job. */
    enter() { stopped = false; load(); },
    /** Another game takes the page. */
    leave() { cancelAnimationFrame(weaving); weaving = 0; clearTimeout(doneTimer); drag = null; },
    click(e) { const b = e.target.closest("[data-act]"); if (b && !b.disabled && !IN_FRAME) act(b.dataset.act); },
    /** A part of the menu: the cloths to choose from. */
    menu(body) {
      part(body, "play").append(action("Start this cloth over", () => begin(job.index, job.seed), "primary"), action("A fresh one", () => begin(job.index)));
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
      part(body, "about").append(line(job.story));
    },
    marks: on => sheet.marks(on),
    /** The menu has stood the shuttle still; a cloth being woven when it opens is finished when it closes. */
    pause() { if (weaving) { cancelAnimationFrame(weaving); weaving = 0; stopped = true; } },
    resume() { if (stopped) { stopped = false; woven(); } },
    debug: { get job() { return job; }, get run() { return run; }, begin, showDone, render, weave, setThread, setLift, setWeft, finish, save, changed: () => { sheet.refresh(); render(); } },
  };
}
