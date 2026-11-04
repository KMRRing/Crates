// Nine Men's Morris's course (Learn, in the menu): the rules, then what makes a position good, on the course's sheet
// (course.js) with a stage of its own, the board as the game draws it (morris-draw.js). Every claim about a position is the
// engine's: a puzzle's best move is the search's (tests/morris-course.mjs plays each one out), and the numbers a lesson shows
// are counted as it draws or checked by the test, never trusted.
//
// A step is words over a board. The board is `d` and `l` (lists of points, "a7 d7"), `hd` and `hl` (pieces still in hand,
// none by default) and `t` (the side to move: dark, the reader's side, by default). Then one of:
//   quiz, answer, why      a choice (calc: "points" | "mills" | "neighbours" | "winner" says what the answer is counted from)
//   free                   any legal move will do
//   tap, also              a point to place on (several: any of them), more that are good enough
//   move, also             a piece and where it goes, "g4-g7" (several: any of them)
//   take                   once the move closes a mill, the pieces that are the right ones to take
//   mill                   the answer closes a mill (the test checks it)
//   proved                 the search finds the first of tap or move the best (the test checks it)
//   wrong[move], miss      what a wrong move is told: wrong["d7"] for one, miss for any; why after a right one
// and what is shown: mark ("g4:pick a7:good"), over (the game is over on this board).
import { position, positionOfText, ptOf, ptName, movesOf, play, decode, encode, phaseOf, popcount, takeable, inMills, N, MILL_MASK, DEGREE, toText } from "./morris-board.js";
import { createBoard } from "./morris-draw.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const SIDE = { d: "Dark", l: "Light" };
const names = text => String(text ?? "").split(/\s+/).filter(Boolean);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** A step's position. */
export function positionOfStep(step) {
  const a = Array(N).fill(".");
  for (const n of names(step.d)) a[ptOf(n)] = "d";
  for (const n of names(step.l)) a[ptOf(n)] = "l";
  const bare = !names(step.d).length && !names(step.l).length && step.hd == null && step.hl == null;   // no board drawn: the start
  return positionOfText(a.join(""), step.t || "d", bare ? 9 : step.hd || 0, bare ? 9 : step.hl || 0);
}
/** A move the way a step writes it ("d7-d6", or "d7" for a piece placed) as [from, to]. */
export const pairOf = text => { const [a, b] = String(text).split("-"); return b ? [ptOf(a), ptOf(b)] : [-1, ptOf(a)]; };
const pairs = text => new Set(names(text).map(x => pairOf(x).join(",")));
const label = (f, t) => (f < 0 ? ptName(t) : `${ptName(f)}-${ptName(t)}`);
/** The moves a step asks for, best first, as [from, to]. */
export const answersOf = step => names(step.tap ?? step.move).map(pairOf);
export const isTask = step => !!(step.tap || step.move || step.free);

/** What a move (from, to) is told in a step that asks for one. */
export function moveVerdict(step, f, t) {
  if (step.free) return { ok: true, best: true };
  const key = `${f},${t}`, name = label(f, t);
  if (pairs(step.tap ?? step.move).has(key)) return { ok: true, best: true };
  if (pairs(step.also).has(key)) return { ok: true, best: false, msg: `That works, but ${names(step.tap ?? step.move).join(" or ")} is better.` };
  return { ok: false, why: step.wrong?.[name] || step.miss || "Legal, but not the move this exercise is after." };
}
/** What a take is told, once the move closes a mill: the pieces a step wants taken, if it names any. */
export function takeVerdict(step, x) {
  if (!step.take || names(step.take).map(ptOf).includes(x)) return { ok: true };
  return { ok: false, why: step.takeMiss || "Legal, but another piece is the one to take." };
}

/**
 * The stage for course.js: the board, and under it the pieces of each side. The reader plays as in the game: a point to
 * place on, or a piece and then its point, and the piece to take after a mill; the stage judges and tells the course.
 */
export function boardStage() {
  let ctx = null, cur = null, lastStep = null, main = null, dom = null;
  const posCache = new WeakMap();
  const pos = step => { if (!posCache.has(step)) posCache.set(step, positionOfStep(step)); return posCache.get(step); };

  function tap(pt) {
    if (!cur || cur.st.done || !isTask(cur.step)) return;
    const { step, st } = cur, p = pos(step), list = movesOf(p).map(decode), c = p.t, o = c === "d" ? "l" : "d", b = toText(p);
    st.bad = -1;
    if (st.pend) {
      const hit = st.pend.cands.find(m => m.x === pt);
      if (hit) { finish(step, st, p, hit); return; }
      if (b[pt] === o) {
        const why = takeable(p[o]) & (1 << pt) ? "" : "That piece is in a mill, so it is protected while another piece is outside one.";
        if (why) { ctx.answer({ ok: true, done: false, msg: why }); return; }
      }
      st.pend = null;
      if (b[pt] !== c) { cur.redraw(); return; }
    }
    const placing = phaseOf(p) === "place";
    let cands;
    if (placing) {
      if (b[pt] !== ".") { ctx.answer({ ok: true, done: false, msg: "That point is taken." }); return; }
      cands = list.filter(m => m.t === pt);
    } else if (b[pt] === c) {
      if (st.sel === pt) st.sel = -1; else if (!list.some(m => m.f === pt)) { ctx.answer({ ok: true, done: false, msg: "That piece is blocked." }); return; } else st.sel = pt;
      cur.redraw();
      return;
    } else {
      if (b[pt] === o) { ctx.answer({ ok: true, done: false, msg: "That point is taken." }); return; }
      if (st.sel == null || st.sel < 0) { ctx.answer({ ok: true, done: false, msg: "Tap one of your own pieces first." }); return; }
      cands = list.filter(m => m.f === st.sel && m.t === pt);
      if (!cands.length) { ctx.answer({ ok: true, done: false, msg: phaseOf(p) === "fly" ? "Pick an empty point." : "A piece slides along a line to the next point." }); return; }
    }
    if (!cands.length) { ctx.answer({ ok: true, done: false, msg: "That isn't a move." }); return; }
    const { f, t } = cands[0], v = moveVerdict(step, f, t);
    if (!v.ok) { st.bad = t; st.sel = -1; ctx.answer({ ok: false, why: v.why }); return; }
    st.note = v.msg || "";
    if (cands.length > 1 || cands[0].x >= 0) { st.sel = -1; st.pend = { f, t, cands }; ctx.answer({ ok: true, done: false, msg: `${st.note ? `${st.note} ` : ""}A mill: now tap a ${SIDE[o].toLowerCase()} piece to take.` }); cur.redraw(); return; }
    finish(step, st, p, cands[0]);
  }
  function finish(step, st, p, m) {
    const tv = takeVerdict(step, m.x);
    if (!tv.ok) { ctx.answer({ ok: true, done: false, msg: tv.why }); return; }
    st.after = play(p, encode(m.f, m.t, m.x));
    st.pend = null; st.sel = -1; st.bad = -1; st.move = m;
    ctx.answer({ ok: true, msg: [st.note, step.why].filter(Boolean).join(" ") || "Right." });
  }

  const row = (p, b) => {
    const n = c => [...b].filter(x => x === c).length;
    const cell = c => `<span><i class="mo-swatch ${c}"></i><b>${n(c)}</b>${(c === "d" ? p.hd : p.hl) ? ` +${c === "d" ? p.hd : p.hl}` : ""}</span>`;
    return `${cell("d")}${cell("l")}`;
  };

  return {
    mount(box, c) {
      ctx = c;
      box.innerHTML = `<div class="lm"><div class="lm-board"><div class="mo-board"></div></div><div class="lm-row"></div></div>`;
      dom = { row: box.querySelector(".lm-row") };
      main = createBoard(box.querySelector(".mo-board"), { onTap: pt => tap(pt) });
    },
    task: step => isTask(step),
    hint(step, st) { st.hint = true; },
    draw(step, st) {
      cur = { step, st, redraw: () => this.draw(step, st) };
      const p = pos(step), fresh = step !== lastStep;
      lastStep = step;
      const task = isTask(step) && !st.done, shown = st.after || p, marks = {};
      for (const x of names(step.mark)) { const [n, kind] = x.split(":"); marks[ptOf(n)] = kind; }
      if (st.bad >= 0 && !st.done) marks[st.bad] = "bad";
      let b = toText(shown), legal = [], take = [], sel = -1, hint = null;
      if (task && !st.done) {
        const list = movesOf(p).map(decode);
        if (st.pend) { b = [...b].map((ch, i) => (i === st.pend.f ? "." : i === st.pend.t ? p.t : ch)).join(""); take = st.pend.cands.map(m => m.x); }
        else if (phaseOf(p) === "place") legal = [...new Set(list.map(m => m.t))];
        else if (st.sel >= 0) { sel = st.sel; legal = list.filter(m => m.f === st.sel).map(m => m.t); }
        if (st.hint) {
          const [f, t] = answersOf(step)[0] || [-2, -1];
          hint = { f, t, x: st.pend ? (names(step.take).map(ptOf)[0] ?? take[0] ?? -1) : -1 };
          if (st.pend) hint.t = -1;
        }
      }
      main.draw({ b, legal, sel, take, last: st.move || null, hint, marks, tap: task, still: fresh });
      dom.row.innerHTML = row(shown, b) + (task ? `<span>${esc(SIDE[p.t])} to move</span>` : "");
    },
  };
}

// ---------- the lessons ----------
// Positions are drawn by hand, and the test (tests/morris-course.mjs) checks what each says: that the board is legal, that
// a mill is closed where a lesson says so, that a block is the only block, that a running mill runs.
const block = { d: "a7 g4", l: "a1 g1", hd: 7, hl: 7 };

export const COURSE = {
  title: "Learn Nine Men's Morris", zh: "",
  chapters: [
    { id: "rules", title: "The rules", zh: "", lessons: [
      { id: "board", title: "The board", zh: "", steps: [
        { say: "Nine Men's Morris is played on a board of three squares, one inside the next, joined by four lines through the middle of their sides. The pieces go on the points where lines meet or end." },
        { say: "How many points does the board have?", quiz: ["16", "20", "24", "28"], answer: 2, calc: "points", why: "Eight on each of the three squares." },
        { say: "Three pieces of one side in a line make a mill. This dark mill runs along the top of the outer square; a mill is drawn in gold.", d: "a7 d7 g7" },
        { say: "Lines of three are along the sides of each square, and along the four lines between the squares. How many mills can there be?", quiz: ["12", "16", "20", "24"], answer: 1, calc: "mills", why: "Four sides on each of three squares, and four lines through them." },
      ] },
      { id: "placing", title: "Placing", zh: "", steps: [
        { say: "Each side has nine pieces. The game starts with the board empty, and the sides take turns placing one piece on any empty point, dark first. A dark piece carries a gilt dot, a light piece a ring.", hd: 9, hl: 9 },
        { say: "Tap any point to place your first piece.", hd: 9, hl: 9, free: true, why: "Eighteen pieces go down before anything moves." },
        { say: "Dark has two pieces on the top of the outer square. A third between them would close a mill. Close it, then take one of light's pieces.", d: "a7 g7 b6 f2", l: "a1 d2 g4 c5", hd: 5, hl: 5, mill: true, tap: "d7", miss: "That is a legal place, but the mill is the move.", why: "A mill takes a piece off the board." },
        { say: "Closing a mill lets you take one of the other side's pieces. A piece in a mill is protected while any piece outside a mill is left. Light has a mill along the bottom. Close dark's mill, then take a piece that is not in light's mill.", d: "a7 g7 b6 f2", l: "a1 d1 g1 b4", hd: 5, hl: 5, mill: true, tap: "d7", take: "b4", takeMiss: "That one is in a mill, so it cannot be taken while another piece is outside one.", why: "If every piece were in a mill, any of them could be taken." },
      ] },
      { id: "moving", title: "Moving", zh: "", steps: [
        { say: "When all eighteen pieces are down, each turn you slide one piece along a line to the next point, if it is empty. Dark can close the top mill. Slide the piece on g4 up to g7.", d: "a7 d7 g4 c3", l: "b6 f6 d2 a1", mill: true, move: "g4-g7", why: "The slide closed a mill, as placing does." },
        { say: "A piece can be blocked when every point beside it is taken. Light to move here has four pieces and no move at all, so it has lost. Who wins?", d: "g7 d6 a1 b4", l: "a7 d7 a4 b6", t: "l", over: true, calc: "winner", quiz: ["Dark", "Light", "A draw"], answer: 0, why: "A side with no move on its turn loses." },
        { say: "A side reduced to three pieces may fly: move any piece to any empty point. Dark has three pieces left, two on the top. Fly the third to close the mill.", d: "a7 g7 d1", l: "b6 f6 d2 a1", mill: true, move: "d1-d7", why: "Flying makes a small side dangerous." },
        { say: "A side with two pieces left, counting any it has not yet placed, has lost. Three-fold repetition (the same position a third time with the same side to move) is a draw.", d: "a7 g7 d1", l: "b6 f6 d2 a1" },
      ] },
    ] },
    { id: "strategy", title: "Strategy", zh: "", lessons: [
      { id: "block", title: "Blocking", zh: "", steps: [
        { say: "Two of the other side's pieces in a line with the third point empty are a threat: next turn that point is a mill. Light has two on the bottom. Block the point between them.", ...block, tap: "d1", proved: true, miss: "Light closes the mill next turn there and takes a piece. Block d1.", why: "Any other place lets light close the mill." },
      ] },
      { id: "junctions", title: "Points and freedom", zh: "", steps: [
        { say: "A piece on a corner touches two points; on the middle of an outer or inner side, three; on the middle of the middle square's side, four. Pieces on busy points can move and make more mills.", mark: "d6:pick b4:pick f4:pick d2:pick" },
        { say: "Which of these points touches the most others?", quiz: ["a7, a corner", "d7, the outer square's side", "d6, the middle square's side"], answer: 2, calc: "neighbours", why: "d6 touches b6, f6, d7 and d5." },
      ] },
      { id: "running", title: "The running mill", zh: "", steps: [
        { say: "The strongest shape is a running mill (German: Zwickmühle). Dark's top line is a mill, and the middle square's top side holds two dark pieces with the point between them empty. The piece on d7 can step down to d6, opening one mill and closing the other.", d: "a7 d7 g7 b6 f6", l: "a1 g1 b4 f4 d2", mark: "d6:pick" },
        { say: "Slide d7 down to d6.", d: "a7 d7 g7 b6 f6", l: "a1 g1 b4 f4 d2", mill: true, move: "d7-d6", proved: true, why: "Next turn d6 goes back up to d7 and closes the top mill again. Every move takes a piece unless the other side can occupy the gap." },
      ] },
      { id: "game", title: "A game", zh: "", steps: [
        { say: "That is the whole of it: fill the strong points, block threats, keep your pieces free and build a running mill. Play a game against the computer on Easy.", play: true, level: "easy" },
      ] },
    ] },
  ],
};
