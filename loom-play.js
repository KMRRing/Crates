// Loom's cloths: a nonogram of floats (loom-float.js). Each crossing of a warp thread and a pick of weft shows one yarn on the
// face, and a line's clue lists the lengths of its own yarn's floats; set the crossings until every clue is met. The
// cloths come from the ladder (loom-levels.js), drawn by loom-cloth.js; this file takes the fingers and keeps the work.
//
// Two ways to set a crossing. The plain cloths (loom-thread.js) begin woven in weft and a float is laid like a thread: tap
// where the warp comes up and where it goes back under (or drag down the column), tap a float to pull it out, drag along
// one to cut it. The weaves, the colour cloths and the gold cloths are painted with a brush, since a shaft ties crossings
// together and gold hides both yarns, so a single float can't be laid there.
//
// A plain cloth also has three modes, picked in a small control over the cloth: lay (what is above), and two that pencil
// notes instead, a warp where a thread is thought to come up and the weft where it is known to stay. A note is only the
// player's: no float, no clue, no slip, no star reads it (loom-thread.js, "notes").
//
// Stars are for how clean the cloth was: a crossing set the wrong way is a slip (marked in the cloth if the options say
// so, counted either way) and a hint is a help; none of either is three stars, up to three together two.
import { LEVELS, CHAPTERS, levelOf, chapterOf, makeLevel, starsFor, seedOf, FEW } from "./loom-levels.js";
import { fixed, start, nextStep, propagate, stateOf, met, WARP, WEFT, GOLD } from "./loom-float.js";
import { threaded, ground, createHand, apply, slipsIn, wanted, laidCount, hintFor, hintWords, clueString, lineName, NOTE_WARP, NOTE_WEFT, markable, paintNote, notesString, notesFrom } from "./loom-thread.js";
import { createCloth, UNSET } from "./loom-cloth.js";
import { part, action, line, isPaused } from "./menu.js";
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
const HOW_THREADS = "The weft is laid. Tap where a thread comes up, then where it goes back under. Or drag.";
const HOW_THREADS_LONG = "The weft is laid across the whole cloth. Lay a warp float like a thread: tap the crossing where it comes up, then the one in the same column where it goes back under, or drag down the column. Tap a float to pull it out, or drag along it to cut it shorter. Pencil a warp or the weft you know in the Mark modes: notes are yours alone and are never graded. A clue lists, in order, how long a yarn shows along its line.";
const MODES = ["lay", "warp", "weft"];
const MARK_WORDS = { warp: "Pencil warp: touch or drag over crossings you think are warp; touch a mark to clear it. Never graded.", weft: "Pencil weft: touch or drag over crossings you know are weft; touch a mark to clear it. Never graded." };
const BRUSHES = [
  [WARP, "Warp", "a warp thread lies over the pick", '<rect x="1" y="5" width="14" height="6" opacity=".35"/><rect x="5" y="1" width="6" height="14"/>'],
  [WEFT, "Weft", "a pick of weft lies over the thread", '<rect x="5" y="1" width="6" height="14" opacity=".35"/><rect x="1" y="5" width="14" height="6"/>'],
  [GOLD, "Gold", "gold thread lies over both", '<rect x="1" y="5" width="14" height="6" fill="#C9A227" stroke="#7A5C00" stroke-width="1"/>'],
];

export function createPlay(host) {
  const cloth = createCloth(host);
  let lv = null, made = null, p = null, cells = null, notes = null, members = null, run = null, thr = false, hand = null;
  let drag = null, press = null, weaving = 0, doneTimer = 0, weaveTimer = 0, stopped = false, note = null, noteTimer = 0, hintTimer = 0;

  // ---------- a cloth in hand ----------
  const save = () => write(RUN, { v: 1, run: { ...run, cells: Array.from(cells, c => CHAR[c === UNSET ? 3 : c]).join(""), ...(notes && { notes: notesString(notes) }) } });
  /** The level's cloth for its seed, and the crossings every cloth begins with set (the ones with one colour, and the pre-woven). */
  function open(level, seed, saved = null) {
    cancelAnimationFrame(weaving);
    clearTimeout(doneTimer);
    clearTimeout(weaveTimer);
    clearTimeout(hintTimer);
    weaving = 0; note = null; drag = null; press = null;
    const m = makeLevel(level, seed);
    if (!m) return false;
    lv = level; made = m; p = m.puzzle; thr = threaded(p);
    members = Array.from({ length: p.classes }, () => []);
    for (let i = 0; i < p.n; i++) members[p.cls[i]].push(i);
    if (thr) cells = ground(p, saved?.cells);                    // a run kept from the brush days opens as floats: warp painted is a float, the rest weft
    else {
      cells = new Uint8Array(p.n);
      // a kept crossing is only as good as the cloth would allow (no gold where there is none)
      const kept = i => (saved && /[01]/.test(saved.cells[i]) || saved?.cells[i] === "2" && p.gold >= 0 ? +saved.cells[i] : UNSET);
      for (let i = 0; i < p.n; i++) cells[i] = fixed(p, i) ? p.sol[i] : kept(i);
    }
    notes = thr ? notesFrom(p, saved?.notes) : null;
    hand = createHand(p, cells, notes);
    run = { id: level.id, seed, miss: saved?.miss ?? 0, hints: saved?.hints ?? 0, brush: saved?.brush ?? WARP, mode: thr && MODES.includes(saved?.mode) ? saved.mode : "lay", done: saved?.done ?? null };
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
  /** Floats the player has laid (warp over, not counting the pre-woven). */
  const laidByHand = () => { let n = 0; for (let i = 0; i < p.n; i++) if (cells[i] === WARP && !fixed(p, i)) n++; return n; };

  const aimNow = () => (!thr || run.done || run.mode !== "lay" ? null : hand.aim());

  // ---------- drawing the page ----------
  const clueOf = k => clueString(p, k);
  const name = k => lineName(p, k);
  function aimWords(a) {
    const t = `Thread ${a.c + 1}`, rows = a.lo === a.hi ? `pick ${a.lo + 1}` : `picks ${a.lo + 1} to ${a.hi + 1}`;
    if (a.kind === "peg") return `${t} comes up at pick ${a.anchor + 1}: drag to lay the float, or lift and tap its end.`;
    if (a.kind === "cut") return a.changes.length ? `${t}: pull out ${rows}.` : `${t}: ${rows} is pre-woven and stays.`;
    return `${t}: ${rows}, a float of ${a.hi - a.lo + 1}${a.stopped ? ", stopped by a pre-woven pick" : ""}.`;
  }
  function threadWords() {
    const wait = hand.pending;
    if (wait) return { text: `Thread ${wait.c + 1} comes up at pick ${wait.r + 1}: tap where it goes back under.` };
    if (!laidByHand() && !run.miss && !run.hints) return { text: lv.id === "plain-1" ? HOW_THREADS : chapterOf(lv).blurb };
    const want = wanted(p).crossings;
    return { text: `${laidCount(p, cells)} of ${want} warp crossings laid${run.miss ? ` · ${run.miss} slip${run.miss === 1 ? "" : "s"}` : ""}${run.hints ? ` · ${run.hints} hint${run.hints === 1 ? "" : "s"}` : ""}` };
  }
  function words() {
    if (thr && hand.gest) { const a = hand.aim(); if (a) return { text: aimWords(a) }; }
    if (note) return note;
    if (run.done) return { text: `${lv.name}: woven. ${run.miss} slip${run.miss === 1 ? "" : "s"}, ${run.hints} hint${run.hints === 1 ? "" : "s"}.` };
    if (thr && run.mode !== "lay") return { text: MARK_WORDS[run.mode] };
    if (thr) return threadWords();
    const set = total() - (p.n - free());
    if (!set && !run.miss && !run.hints) return { text: lv.id === "plain-1" ? HOW : chapterOf(lv).blurb };
    const left = free() - set;
    return { text: `${left} crossing${left === 1 ? "" : "s"} to set${run.miss ? ` · ${run.miss} slip${run.miss === 1 ? "" : "s"}` : ""}${run.hints ? ` · ${run.hints} hint${run.hints === 1 ? "" : "s"}` : ""}` };
  }
  function paintAll() {
    const a = aimNow();
    let look = null;
    if (a) { look = Uint8Array.from(cells); apply(look, a.changes); }
    cloth.show({
      cells, look, notes: run.done ? null : notes, marks: opts.marks && !run.done, press: press ? press.at : drag ? drag.at : -1,
      thread: a && { c: a.c, lo: a.lo, hi: a.hi, kind: a.kind, anchor: a.anchor },
    });
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
    const moves = `<button type="button" class="btn lm-act" data-act="undo" ${hand.history.length || hand.pending ? "" : "disabled"}>Undo</button><button type="button" class="btn lm-act" data-act="redo" ${hand.future.length ? "" : "disabled"}>Redo</button><button type="button" class="btn lm-act" data-act="hint">Hint</button>`;
    $("acts").innerHTML = run.done
      ? `<button type="button" class="btn lm-act" data-act="again">A fresh one</button><button type="button" class="btn primary lm-act" data-act="next">${i === LEVELS.length - 1 ? "Back to the first" : "Next cloth"}</button>`
      : thr ? `<div class="lm-moves">${moves}</div>`
      : `<div class="lm-brushes" role="radiogroup" aria-label="What a tap paints">${BRUSHES.filter(([s]) => s !== GOLD || p.gold >= 0).map(([s, label, title, art]) =>
        `<button type="button" class="btn lm-brush" role="radio" aria-checked="${run.brush === s}" data-brush="${s}" title="${title}" aria-label="${label}: ${title}"><svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">${art}</svg><span>${label}</span></button>`).join("")}</div>`
        + `<div class="lm-moves">${moves}</div>`;
    renderMarker();
    paintAll();
  }
  /** The control over the cloth that says what a touch does: lay, pencil warp or pencil weft. Its room is kept when the cloth is woven, so the cloth doesn't grow. */
  function renderMarker() {
    const m = $("marker");
    m.hidden = !thr;
    m.classList.toggle("off", !!run.done);
    for (const b of m.querySelectorAll("[data-mode]")) b.setAttribute("aria-checked", String(b.dataset.mode === run.mode));
    cloth.room(thr ? m.offsetHeight + .8 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) : 0);
  }
  function setMode(m) {
    if (!thr || run.done || run.mode === m) return;
    hand.release();                                                 // a thread waiting is let go
    clearTimeout(noteTimer);
    note = null;
    run.mode = m;
    save();
    render();
  }
  function say(text, bad = false, ms = 0) {
    clearTimeout(noteTimer);
    note = { text, bad };
    if (ms) noteTimer = setTimeout(() => { note = null; if (!drag && !press) render(); }, ms);
  }

  // ---------- the buttons ----------
  function click(e) {
    const b = e.target.closest("[data-act],[data-brush]");
    if (!b || b.disabled || IN_FRAME) return;
    if (b.dataset.brush != null) { run.brush = +b.dataset.brush; save(); render(); return; }
    const a = b.dataset.act, i = LEVELS.indexOf(lv);
    if (a === "undo") undo();
    else if (a === "redo") redo();
    else if (a === "hint") hint();
    else if (a === "again") fresh(lv);
    else if (a === "next") begin(LEVELS[(i + 1) % LEVELS.length]);
  }
  /** Undo lets go of a thread that is waiting for its end first; then it takes back a stroke, a float or a hint, last first. */
  function undo() {
    const took = hand.undo();
    if (!took) return;
    if (took !== "wait") { note = null; save(); }
    render();
  }
  function redo() {
    if (!hand.redo()) return;
    note = null;
    save();
    render();
    if (!run.done && met(p, cells)) conclude();
  }

  // ---------- the fingers: a brush ----------
  // A press paints what is under it with the brush (or, if that crossing already shows the brush, clears it), and a drag
  // carries on over the crossings it passes. A stroke is one Undo. A crossing in a draft's class moves all its mates.
  function paint(i) {
    if (i < 0 || !drag || fixed(p, i)) return;
    const v = drag.v, c = p.cls[i];
    if (cells[i] === v) return;
    for (const j of members[c]) { if (cells[j] !== v) { drag.batch.push({ i: j, was: cells[j], now: v }); cells[j] = v; } }
    SOUND.tap();
    if (v !== UNSET && v !== p.sol[i]) {
      run.miss++;
      if (opts.marks) say(`Pick ${Math.floor(i / p.w) + 1}, thread ${(i % p.w) + 1} lies the other way.`, true, 2600);
    } else if (note?.bad) { clearTimeout(noteTimer); note = null; }
  }

  // ---------- the fingers: a thread ----------
  // What a press, a drag and a lift do is loom-thread.js's `hand` (tested there); this is the page's side of it: the words,
  // the slips, the yarn pulled through and the saving. A tap beside the cloth lets a waiting thread go.
  /** Begins a gesture on crossing i; false where nothing can be done there (a pre-woven crossing can't be changed). */
  function pressThread(e, i) {
    const c = i % p.w, r = Math.floor(i / p.w);
    clearTimeout(noteTimer);                                     // a new touch dismisses the last remark, or it would sit over the waiting thread's prompt
    note = null;
    if (!hand.press(c, r)) {
      say(`Pick ${r + 1}, thread ${c + 1} is pre-woven: it stays as it is.`, false, 2200);
      changed();
      return false;
    }
    press = { id: e.pointerId, y: e.clientY, at: i };
    return true;
  }
  function moveThread(e) {
    if (!hand.gest.moved && Math.abs(e.clientY - press.y) < Math.max(5, cloth.size() * .45)) return;   // a tap with a shaking finger is still a tap
    const r = cloth.rowAt(e);
    hand.drag(r);
    if (r * p.w + hand.gest.c === press.at) return;
    press.at = r * p.w + hand.gest.c;
    changed();
  }
  /** The finger lifts: a tap leaves a thread waiting or ends one, a drag lays or cuts a float, as one step to Undo. */
  function liftThread(cancelled) {
    press = null;
    const a = hand.lift(cancelled);
    if (a && a.kind !== "peg") laid(a);
    render();
    if (a && !run.done && met(p, cells)) conclude();
  }
  /** A float laid or taken out: counts the slips (a warp over where the cloth has the weft), says so, pulls the yarn through. */
  function laid(a) {
    if (!a.changes.length) return;
    const rows = a.changes.map(({ i }) => Math.floor(i / p.w));
    SOUND.tap();
    const wrong = a.kind === "lay" ? slipsIn(p, a.changes) : [];
    run.miss += wrong.length;
    if (wrong.length) {
      if (opts.marks) say(wrong.length === 1 ? `Pick ${Math.floor(wrong[0] / p.w) + 1}, thread ${(wrong[0] % p.w) + 1}: the weft lies over there, not the warp.` : `${wrong.length} crossings of that float lie the other way: the weft is over them.`, true, 2600);
    } else if (a.stopped) say("The float stops there: the next crossing is pre-woven weft.", false, 2600);
    else if (note?.bad) { clearTimeout(noteTimer); note = null; }
    cloth.pull({ c: a.c, lo: Math.min(...rows), hi: Math.max(...rows), from: a.kind === "lay" && a.anchor !== a.lo ? "bottom" : "top", was: a.was });
    save();
  }

  // ---------- the fingers: a note ----------
  // The same press-and-drag as a brush: a press pencils the crossing with the mode's mark (or, if it already has that mark,
  // takes it away), and the stroke carries on over the crossings it passes, in a straight line from one touch event to the
  // next so a quick finger leaves no gap. A float laid, or a pre-woven crossing, takes no note. A stroke is one Undo.
  function noteDown(e, i) {
    hand.release();
    clearTimeout(noteTimer);
    note = null;
    if (!markable(p, cells, i)) {
      const r = Math.floor(i / p.w) + 1, c = (i % p.w) + 1;
      say(cells[i] === WARP && !fixed(p, i) ? `Pick ${r}, thread ${c} is a laid float: pull it out to pencil a note there.` : `Pick ${r}, thread ${c} is pre-woven: it is known already.`, false, 2400);
      changed();
      return false;
    }
    const kind = run.mode === "warp" ? NOTE_WARP : NOTE_WEFT;
    drag = { id: e.pointerId, note: true, kind, erase: notes[i] === kind, batch: [], at: i, last: i };
    noteTo(i);
    SOUND.tap();
    return true;
  }
  function noteTo(i) {
    const ch = paintNote(p, cells, notes, i, drag.kind, drag.erase);
    if (!ch) return;
    notes[i] = ch.now;
    drag.batch.push(ch);
  }
  function noteThrough(i) {
    const a = drag.last, ar = Math.floor(a / p.w), ac = a % p.w, br = Math.floor(i / p.w), bc = i % p.w, n = Math.max(Math.abs(br - ar), Math.abs(bc - ac));
    for (let k = 1; k <= n; k++) noteTo(Math.round(ar + (br - ar) * k / n) * p.w + Math.round(ac + (bc - ac) * k / n));
    drag.last = i;
  }

  // ---------- the fingers ----------
  function onDown(e) {
    if (drag || press || IN_FRAME || run.done || weaving || $("doneDlg").open) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const i = cloth.hit(e);
    if (thr) {
      if (i < 0) { if (hand.release()) render(); return; }                       // a tap beside the cloth lets a waiting thread go
      e.preventDefault();
      if (run.mode !== "lay" ? !noteDown(e, i) : !pressThread(e, i)) return;
    } else {
      if (i < 0) return;
      drag = { id: e.pointerId, v: cells[i] === run.brush ? UNSET : run.brush, batch: [], at: i };
      paint(i);
      e.preventDefault();
    }
    cloth.canvas.setPointerCapture(e.pointerId);
    changed();
  }
  function onMove(e) {
    if (press && e.pointerId === press.id) return moveThread(e);
    if (!drag || e.pointerId !== drag.id) return;
    const i = cloth.hit(e);
    if (i === drag.at) return;
    drag.at = i;
    if (!drag.note) paint(i);
    else if (i >= 0) noteThrough(i);
    changed();
  }
  function onUp(e) {
    if (press && e.pointerId === press.id) return liftThread(e.type === "pointercancel");
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    hand.record(d.batch);
    save();
    render();
    if (!d.note && e.type !== "pointercancel" && !run.done && met(p, cells)) conclude();
  }
  const changed = () => { paintAll(); $("line").textContent = words().text; $("line").classList.toggle("bad", !!note?.bad && !press); };
  for (const [type, fn] of [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onUp], ["pointercancel", onUp]]) cloth.canvas.addEventListener(type, fn);
  cloth.canvas.addEventListener("contextmenu", e => e.preventDefault());
  $("marker").addEventListener("click", e => {
    const b = e.target.closest("[data-mode]");
    if (b && !IN_FRAME && !weaving && !$("doneDlg").open) setMode(b.dataset.mode);
  });
  addEventListener("keydown", e => {                                           // Escape lets a waiting thread go
    if (e.key === "Escape" && !press && !document.querySelector("dialog[open]") && hand?.release()) render();
  });

  // ---------- a hint: the next crossing that one line settles, and why ----------
  /** What a person who has only set right can still work out: the crossings already right are known, line by line. */
  function hint() {
    if (run.done || weaving) return;
    if (thr) return hintThread();
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
    for (const j of members[p.cls[step.cell]]) if (cells[j] !== step.state) { batch.push({ i: j, was: cells[j], now: step.state }); cells[j] = step.state; }
    hand.record(batch);
    const at = step.line < 0 ? `at pick ${r + 1}, thread ${c + 1}` : step.line < p.h ? `at thread ${c + 1}` : `at pick ${r + 1}`;
    say(step.line >= 0
      ? `${name(step.line)} reads ${clueOf(step.line)}, so ${at} ${SIDE[step.state]}.`
      : `The lines together settle it: ${at} ${SIDE[step.state]}.`, false, 5000);
    shown(step);
    SOUND.tap();
    save();
    render();
    if (met(p, cells)) conclude();
  }
  /** A plain cloth's hint lays, extends or shortens one float by a crossing, or pulls a wrong one out, and says so in a thread's words. */
  function hintThread() {
    const step = hintFor(p, cells);
    if (!step) return;
    run.hints++;
    const was = Uint8Array.from(cells), change = [{ i: step.cell, was: cells[step.cell], now: step.state }];
    say(hintWords(p, cells, step), false, 5000);
    hand.step(change);
    const r = Math.floor(step.cell / p.w);
    cloth.pull({ c: step.cell % p.w, lo: r, hi: r, was });
    shown(step);
    SOUND.tap();
    save();
    render();
    if (met(p, cells)) conclude();
  }
  /** Brackets the line a hint speaks of and the crossing it settles, for a few seconds. */
  function shown(step) {
    cloth.show({ hint: { line: step.line, cell: step.cell } });
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => cloth.show({ hint: null }), 3500);
  }

  // ---------- a cloth finished: it is woven out, row by row ----------
  function conclude() {
    run.done = { stars: starsFor(run.miss, run.hints), miss: run.miss, hints: run.hints };
    note = null;
    save();
    render();
    clearTimeout(weaveTimer);
    // a float still being pulled through finishes before the cloth is woven out
    if (cloth.busy()) weaveTimer = setTimeout(() => { weaveTimer = 0; if (isPaused()) stopped = true; else weave(); }, 380);
    else weave();
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
      rows: [["Slips", d.miss], ["Hints", d.hints], thr ? ["Floats", wanted(p).floats] : ["Crossings", free()], ["Pre-woven", made.given]],
      note: `${lv.story} ${d.stars === 3 ? "" : `Three stars is a cloth with no slip and no hint; two allows up to ${FEW} of them together.`}`.trim(),
      again: ["A fresh one", () => fresh(lv)],
      next: [last ? "Back to the first" : "Next cloth", () => begin(LEVELS[last ? 0 : i + 1])],
    });
  }

  return {
    cloth,
    enter: load,
    leave() { cancelAnimationFrame(weaving); weaving = 0; clearTimeout(doneTimer); clearTimeout(weaveTimer); clearTimeout(hintTimer); drag = null; press = null; hand?.release(); },
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
      part(body, "about").append(line(`${lv.story} ${thr ? HOW_THREADS_LONG : HOW}`));
    },
    pause() { if (weaving) { cancelAnimationFrame(weaving); weaving = 0; stopped = true; } },
    resume() { if (stopped) { stopped = false; woven(); } },
    debug: { cloth, get lv() { return lv; }, get p() { return p; }, get cells() { return cells; }, get notes() { return notes; }, setMode, get run() { return run; }, get pending() { return hand.pending; }, get thr() { return thr; }, begin, fresh, showDone, render, hint, conclude, click, save, undo, redo, solve() { for (let i = 0; i < p.n; i++) cells[i] = p.sol[i]; paintAll(); } },
  };
}
