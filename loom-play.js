// Loom's cloths: a nonogram of floats (loom-float.js). Each crossing of a warp thread and a pick of weft shows one yarn on the
// face, and a line's clue lists the lengths of its own yarn's floats; paint the crossings until every clue is met. The
// cloths come from the ladder (loom-levels.js), drawn by loom-cloth.js; this file takes the fingers and keeps the work.
//
// Stars are for how clean the cloth was: a crossing set the wrong way is a slip (marked in the cloth if the options say
// so, counted either way) and a hint is a help; none of either is three stars, up to three together two.
import { LEVELS, CHAPTERS, levelOf, chapterOf, makeLevel, starsFor, seedOf, FEW } from "./loom-levels.js";
import { fixed, start, nextStep, propagate, stateOf, met, WARP, WEFT, GOLD } from "./loom-float.js";
import { createCloth, UNSET } from "./loom-cloth.js";
import { part, action, line } from "./menu.js";
import { roundOver } from "./random.js";
import { IN_FRAME } from "./suite.js";
import { $, read, write, starText, opts, SOUND, finished, keepBest, CAMP } from "./loom-kit.js";

const RUN = "loom:run2";
const camp = () => read(CAMP, {});
/** A level is open if it is its chapter's first or the one before it is woven. */
const unlocked = i => LEVELS[i].id.endsWith("-1") || (camp()[LEVELS[i - 1].id] ?? 0) > 0;
const CHAR = "012-";
const SIDE = ["the warp lies over", "the weft lies over", "the gold lies over"];
const HOW = "Paint each crossing with the yarn that shows. A clue lists, in order, how long a yarn shows along its line.";
const BRUSHES = [
  [WARP, "Warp", "a warp thread lies over the pick", '<rect x="1" y="5" width="14" height="6" opacity=".35"/><rect x="5" y="1" width="6" height="14"/>'],
  [WEFT, "Weft", "a pick of weft lies over the thread", '<rect x="5" y="1" width="6" height="14" opacity=".35"/><rect x="1" y="5" width="14" height="6"/>'],
  [GOLD, "Gold", "gold thread lies over both", '<rect x="1" y="5" width="14" height="6" fill="#C9A227" stroke="#7A5C00" stroke-width="1"/>'],
];

export function createPlay(host) {
  const cloth = createCloth(host);
  let lv = null, made = null, p = null, cells = null, members = null, run = null;
  let history = [], drag = null, weaving = 0, doneTimer = 0, stopped = false, note = null, noteTimer = 0, hintTimer = 0;

  // ---------- a cloth in hand ----------
  const save = () => write(RUN, { v: 1, run: { ...run, cells: Array.from(cells, c => CHAR[c === UNSET ? 3 : c]).join("") } });
  /** The level's cloth for its seed, and the crossings every cloth begins with set (the ones with one colour, and the pre-woven). */
  function open(level, seed, saved = null) {
    cancelAnimationFrame(weaving);
    clearTimeout(doneTimer);
    clearTimeout(hintTimer);
    weaving = 0; note = null; history = []; drag = null;
    const m = makeLevel(level, seed);
    if (!m) return false;
    lv = level; made = m; p = m.puzzle;
    members = Array.from({ length: p.classes }, () => []);
    for (let i = 0; i < p.n; i++) members[p.cls[i]].push(i);
    cells = new Uint8Array(p.n);
    // a kept crossing is only as good as the cloth would allow (no gold where there is none)
    const kept = i => (saved && /[01]/.test(saved.cells[i]) || saved?.cells[i] === "2" && p.gold >= 0 ? +saved.cells[i] : UNSET);
    for (let i = 0; i < p.n; i++) cells[i] = fixed(p, i) ? p.sol[i] : kept(i);
    run = { id: level.id, seed, miss: saved?.miss ?? 0, hints: saved?.hints ?? 0, brush: saved?.brush ?? WARP, done: saved?.done ?? null };
    cloth.set(p);
    paintAll();
    save();
    render();
    return true;
  }
  function load() {
    const s = read(RUN, null), r = s?.v === 1 ? s.run : null, level = r && levelOf(r.id);
    const ok = level && Number.isFinite(r.seed) && typeof r.cells === "string" && r.cells.length === level.w * level.h && /^[012-]+$/.test(r.cells)
      && Number.isInteger(r.miss) && Number.isInteger(r.hints) && [WARP, WEFT, GOLD].includes(r.brush);
    if (ok && open(level, r.seed, r)) return;
    open(LEVELS[0], seedOf(LEVELS[0]));
  }
  const begin = (level, seed = seedOf(level)) => open(level, seed);
  const fresh = level => begin(level, (Math.random() * 2 ** 31) >>> 0);
  const total = () => { let n = 0; for (let i = 0; i < p.n; i++) if (cells[i] !== UNSET) n++; return n; };
  const free = () => { let n = 0; for (let i = 0; i < p.n; i++) if (!fixed(p, i)) n++; return n; };

  // ---------- drawing the page ----------
  const clueOf = k => p.clues[k].map(([n, g]) => (g === 2 ? `${n}g` : n)).join(" ") || "0";
  const name = k => (k < p.h ? `Pick ${k + 1}` : `Thread ${k - p.h + 1}`);
  function words() {
    if (note) return note;
    if (run.done) return { text: `${lv.name}: woven. ${run.miss} slip${run.miss === 1 ? "" : "s"}, ${run.hints} hint${run.hints === 1 ? "" : "s"}.` };
    const set = total() - (p.n - free());
    if (!set && !run.miss && !run.hints) return { text: lv.id === "plain-1" ? HOW : chapterOf(lv).blurb };
    const left = free() - set;
    return { text: `${left} crossing${left === 1 ? "" : "s"} to set${run.miss ? ` · ${run.miss} slip${run.miss === 1 ? "" : "s"}` : ""}${run.hints ? ` · ${run.hints} hint${run.hints === 1 ? "" : "s"}` : ""}` };
  }
  function paintAll() {
    cloth.show({ cells, marks: opts.marks && !run.done, press: drag ? drag.at : -1 });
  }
  function render() {
    const i = LEVELS.indexOf(lv), ch = chapterOf(lv), inCh = LEVELS.filter(l => l.chapter === lv.chapter), best = camp()[lv.id] ?? 0;
    $("jobName").textContent = lv.name;
    $("jobNo").textContent = `${ch.name} ${inCh.indexOf(lv) + 1} of ${inCh.length}`;
    $("jobStars").textContent = best ? starText(best) : "";
    const w = words();
    $("line").textContent = w.text;
    $("line").classList.toggle("bad", !!w.bad);
    $("acts").className = "lm-acts lm-acts-play";
    $("acts").innerHTML = run.done
      ? `<button type="button" class="btn lm-act" data-act="again">A fresh one</button><button type="button" class="btn primary lm-act" data-act="next">${i === LEVELS.length - 1 ? "Back to the first" : "Next cloth"}</button>`
      : `<div class="lm-brushes" role="radiogroup" aria-label="What a tap paints">${BRUSHES.filter(([s]) => s !== GOLD || p.gold >= 0).map(([s, label, title, art]) =>
        `<button type="button" class="btn lm-brush" role="radio" aria-checked="${run.brush === s}" data-brush="${s}" title="${title}" aria-label="${label}: ${title}"><svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">${art}</svg><span>${label}</span></button>`).join("")}</div>`
        + `<div class="lm-moves"><button type="button" class="btn lm-act" data-act="undo" ${history.length ? "" : "disabled"}>Undo</button><button type="button" class="btn lm-act" data-act="hint">Hint</button></div>`;
    paintAll();
  }
  function say(text, bad = false, ms = 0) {
    clearTimeout(noteTimer);
    note = { text, bad };
    if (ms) noteTimer = setTimeout(() => { note = null; if (!drag) render(); }, ms);
  }

  // ---------- the buttons ----------
  function click(e) {
    const b = e.target.closest("[data-act],[data-brush]");
    if (!b || b.disabled || IN_FRAME) return;
    if (b.dataset.brush != null) { run.brush = +b.dataset.brush; save(); render(); return; }
    const a = b.dataset.act, i = LEVELS.indexOf(lv);
    if (a === "undo") undo();
    else if (a === "hint") hint();
    else if (a === "again") fresh(lv);
    else if (a === "next") begin(LEVELS[(i + 1) % LEVELS.length]);
  }
  function undo() {
    const last = history.pop();
    if (!last) return;
    for (const { i, was } of last) cells[i] = was;
    note = null;
    save();
    render();
  }

  // ---------- the fingers ----------
  // A press paints what is under it with the brush (or, if that crossing already shows the brush, clears it), and a drag
  // carries on over the crossings it passes. A stroke is one Undo. A crossing in a draft's class moves all its mates.
  function paint(i) {
    if (i < 0 || !drag || fixed(p, i)) return;
    const v = drag.v, c = p.cls[i];
    if (cells[i] === v) return;
    for (const j of members[c]) { if (cells[j] !== v) { drag.batch.push({ i: j, was: cells[j] }); cells[j] = v; } }
    SOUND.tap();
    if (v !== UNSET && v !== p.sol[i]) {
      run.miss++;
      if (opts.marks) say(`Pick ${Math.floor(i / p.w) + 1}, thread ${(i % p.w) + 1} lies the other way.`, true, 2600);
    } else if (note?.bad) { clearTimeout(noteTimer); note = null; }
  }
  function onDown(e) {
    if (drag || IN_FRAME || run.done || weaving || $("doneDlg").open) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const i = cloth.hit(e);
    if (i < 0) return;
    drag = { id: e.pointerId, v: cells[i] === run.brush ? UNSET : run.brush, batch: [], at: i };
    cloth.canvas.setPointerCapture(e.pointerId);
    paint(i);
    changed();
    e.preventDefault();
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const i = cloth.hit(e);
    if (i === drag.at) return;
    drag.at = i;
    paint(i);
    changed();
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.batch.length) history.push(d.batch);
    save();
    render();
    if (e.type !== "pointercancel" && !run.done && met(p, cells)) conclude();
  }
  const changed = () => { paintAll(); $("line").textContent = words().text; $("line").classList.toggle("bad", !!note?.bad); };
  for (const [type, fn] of [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onUp], ["pointercancel", onUp]]) cloth.canvas.addEventListener(type, fn);
  cloth.canvas.addEventListener("contextmenu", e => e.preventDefault());

  // ---------- a hint: the next crossing that one line settles, and why ----------
  /** What a person who has only set right can still work out: the crossings already right are known, line by line. */
  function hint() {
    if (run.done || weaving) return;
    const known = start(p);
    members.forEach((m, c) => { const i = m[0]; if (!fixed(p, i) && cells[i] !== UNSET && cells[i] === p.sol[i]) known[c] = 1 << p.sol[i]; });
    let step = nextStep(p, known);
    if (!step) {                                       // no line settles anything alone: the lines together do, or a guess is wanted
      const st = Uint8Array.from(known), got = propagate(p, st) || [];
      const c = got.length ? got[0] : known.findIndex((m, k) => m & (m - 1) && !fixed(p, members[k][0]));
      if (c < 0) return;
      step = { line: -1, cell: members[c][0], state: got.length ? stateOf(st[c]) : p.sol[members[c][0]] };
    }
    const r = Math.floor(step.cell / p.w), c = step.cell % p.w;
    run.hints++;
    const batch = [];
    for (const j of members[p.cls[step.cell]]) if (cells[j] !== step.state) { batch.push({ i: j, was: cells[j] }); cells[j] = step.state; }
    if (batch.length) history.push(batch);
    const at = step.line < 0 ? `at pick ${r + 1}, thread ${c + 1}` : step.line < p.h ? `at thread ${c + 1}` : `at pick ${r + 1}`;
    say(step.line >= 0
      ? `${name(step.line)} reads ${clueOf(step.line)}, so ${at} ${SIDE[step.state]}.`
      : `The lines together settle it: ${at} ${SIDE[step.state]}.`, false, 5000);
    cloth.show({ hint: { line: step.line, cell: step.cell } });
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => cloth.show({ hint: null }), 3500);
    SOUND.tap();
    save();
    render();
    if (met(p, cells)) conclude();
  }

  // ---------- a cloth finished: it is woven out, row by row ----------
  function conclude() {
    run.done = { stars: starsFor(run.miss, run.hints), miss: run.miss, hints: run.hints };
    note = null;
    save();
    weave();
  }
  function weave() {
    render();
    const t0 = performance.now();
    clearTimeout(doneTimer);
    SOUND.shuttle();
    const step = now => {
      const t = Math.min(1, (now - t0) / 1500);
      cloth.show({ reveal: t, shuttle: t * 3 });
      if (t < 1) weaving = requestAnimationFrame(step); else woven();
    };
    weaving = requestAnimationFrame(step);
  }
  function woven() {
    weaving = 0;
    cloth.show({ reveal: 1 });
    SOUND.done();
    clearTimeout(doneTimer);
    doneTimer = setTimeout(showDone, 350);
    roundOver("loom");
  }
  function showDone() {
    const all = camp(), d = run.done, i = LEVELS.indexOf(lv), last = i === LEVELS.length - 1;
    if (d.stars > (all[lv.id] ?? 0)) { all[lv.id] = d.stars; write(CAMP, all); keepBest(); }
    render();
    finished({
      head: `${lv.name}: ${["", "woven", "well woven", "woven clean"][d.stars]}`,
      stars: d.stars,
      rows: [["Slips", d.miss], ["Hints", d.hints], ["Crossings", free()], ["Pre-woven", made.given]],
      note: `${lv.story} ${d.stars === 3 ? "" : `Three stars is a cloth with no slip and no hint; two allows up to ${FEW} of them together.`}`.trim(),
      again: ["A fresh one", () => fresh(lv)],
      next: [last ? "Back to the first" : "Next cloth", () => begin(LEVELS[last ? 0 : i + 1])],
    });
  }

  return {
    cloth,
    enter: load,
    leave() { cancelAnimationFrame(weaving); weaving = 0; clearTimeout(doneTimer); clearTimeout(hintTimer); drag = null; },
    click,
    marks: () => paintAll(),
    /** The menu's parts for the cloths: start over, and the ladder with its stars. */
    menu(body) {
      part(body, "play").append(action("Start this cloth over", () => begin(lv, run.seed), "primary"), action("A fresh one", () => fresh(lv)));
      const all = camp(), box = part(body, "content");
      for (const ch of CHAPTERS) {
        const inCh = LEVELS.filter(l => l.chapter === ch.id), got = inCh.reduce((n, l) => n + (all[l.id] ?? 0), 0);
        const h = document.createElement("h4");
        h.className = "lm-chapter";
        h.innerHTML = `<span></span><small>${got} of ${inCh.length * 3} ★</small>`;
        h.firstChild.textContent = ch.name;
        const list = document.createElement("ol");
        list.className = "lm-jobs";
        for (const l of inCh) {
          const i = LEVELS.indexOf(l), li = document.createElement("li"), b = document.createElement("button"), ok = unlocked(i), s = all[l.id] ?? 0;
          b.type = "button";
          b.disabled = !ok;
          b.className = l === lv ? "cur" : "";
          b.innerHTML = `<span></span><small>${s ? starText(s) : ok ? (l === lv ? "in hand" : "") : "locked"}</small>`;
          b.firstChild.textContent = `${inCh.indexOf(l) + 1}. ${l.name}`;
          b.title = l.story;
          b.addEventListener("click", () => { $("menuDlg").close(); if (l !== lv) begin(l); });
          li.append(b);
          list.append(li);
        }
        box.append(h, list);
      }
      part(body, "about").append(line(`${lv.story} ${HOW}`));
    },
    pause() { if (weaving) { cancelAnimationFrame(weaving); weaving = 0; stopped = true; } },
    resume() { if (stopped) { stopped = false; woven(); } },
    debug: { get lv() { return lv; }, get p() { return p; }, get cells() { return cells; }, get run() { return run; }, begin, fresh, showDone, render, hint, conclude, click, save, solve() { for (let i = 0; i < p.n; i++) cells[i] = p.sol[i]; paintAll(); } },
  };
}
