// The Chess course's stage: Gambit's board (chess-board.js, drawn flat) under the lesson's marks. What a step asks and whether an answer is
// right is chess-run.js (no DOM, so the tests drive it); this draws the position, takes a move by hand or a tap on a square, plays the
// computer's replies a beat later, and shows the answer after two misses. The marks are a second SVG over the board in the same 8 by 8 units.
import { mountBoard } from "./chess-board.js";
import { startRun } from "./chess-run.js";
import { EMPTY, checkedKing } from "./chess-lab.js";

const FILES = "abcdefgh";
const FIRST_MS = 700, REPLY_MS = 520, RETURN_MS = 1500;              // before the opponent's first move, between moves, before a looked-at board snaps back

/** Where a square is in the board's 8 by 8 units, for the side at the bottom. */
const xy = (sq, white) => { const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1; return white ? [f, 7 - r] : [7 - f, r]; };
/** The square under a point (0 to 8 across and down), for the side at the bottom. */
const squareAt = (x, y, white) => {
  const col = Math.floor(x), row = Math.floor(y);
  if (col < 0 || row < 0 || col > 7 || row > 7) return null;
  return white ? FILES[col] + (8 - row) : FILES[7 - col] + (row + 1);
};
const arrowPath = (a, white) => {
  const [fx, fy] = xy(a[0], white), [tx, ty] = xy(a[1], white), ax = fx + .5, ay = fy + .5, bx = tx + .5, by = ty + .5;
  const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len, ex = bx - ux * .32, ey = by - uy * .32, w = .24;
  return `M${ax + ux * .2} ${ay + uy * .2}L${ex} ${ey}M${ex - ux * .05 - uy * w} ${ey - uy * .05 + ux * w}L${bx - ux * .08} ${by - uy * .08}L${ex - ux * .05 + uy * w} ${ey - uy * .05 - ux * w}Z`;
};

export function chessStage() {
  let wrap, over, board, cur = null, timers = [], tell = { changed() {}, answer() {} };
  const later = (fn, ms) => { const t = setTimeout(() => { timers = timers.filter(x => x !== t); fn(); }, ms); timers.push(t); return t; };
  const stop = () => { timers.forEach(clearTimeout); timers = []; };

  /** Plays the computer's waiting moves one by one, a beat apart. */
  function pump(st, first = false) {
    if (!st.cc.run.waiting()) return;
    later(() => {
      if (cur !== st) return;
      st.cc.run.auto();
      st.cc.slide = true;
      render();
      pump(st);
    }, first ? FIRST_MS : REPLY_MS);
  }

  function render() {
    const st = cur;
    if (!st) return;
    const { run, step } = st.cc, b = step.board || {};
    const white = b.white ?? (run.side ? run.side === "w" : true);
    st.cc.white = white;
    board.draw({ fen: run.fen, white, moves: run.moves(), last: run.last, check: checkedKing(run.fen), slide: !!st.cc.slide });
    st.cc.slide = false;
    const fresh = run.fen === (b.fen || EMPTY) && !run.last;       // the lesson's own marks belong to the position it drew
    const marks = [], arrows = [], labels = [];
    if (fresh) {
      for (const [sq, k] of Object.entries(b.marks || {})) marks.push([sq, k]);
      for (const a of b.arrows || []) arrows.push(a);
      for (const [sq, text] of Object.entries(b.labels || {})) labels.push([sq, text]);
    }
    for (const sq of run.taps) marks.push([sq, "tap"]);
    if (st.cc.badSq) marks.push([st.cc.badSq, "bad"]);
    if (st.cc.badMove) arrows.push([...st.cc.badMove, "bad"]);
    if (run.done && run.goal?.type === "squares") for (const sq of run.goal.squares) marks.push([sq, "b"]);
    if (st.cc.hint && !run.done) { for (const [sq, k] of Object.entries(st.cc.hint.marks)) marks.push([sq, k]); arrows.push(...st.cc.hint.arrows); }
    over.innerHTML = marks.map(([sq, k]) => { const [x, y] = xy(sq, white); return `<rect class="cc-mark ${k}" x="${x}" y="${y}" width="1" height="1"/>`; }).join("")
      + arrows.map(a => `<path class="cc-arrow ${a[2] || "a"}" d="${arrowPath(a, white)}"/>`).join("")
      + labels.map(([sq, text]) => { const [x, y] = xy(sq, white); return `<text class="cc-label" x="${x + .08}" y="${y + .3}">${text}</text>`; }).join("");
    const tapping = run.goal?.type === "squares" && !run.done;
    over.classList.toggle("tapping", tapping);
    over.setAttribute("aria-label", tapping ? "Tap the squares" : "");
  }

  /** A move made by hand on the board. */
  function onMove(uci) {
    const st = cur;
    if (!st || st.done) return;
    const { run } = st.cc;
    st.cc.badMove = null;
    const res = run.move(uci);
    if (res.free) {                                                // a board to look at: the pieces may be moved about, and go back
      st.cc.slide = false;
      render();
      if (st.cc.back) clearTimeout(st.cc.back);
      st.cc.back = later(() => { if (cur === st) { st.cc.run = startRun(st.cc.step); render(); } }, RETURN_MS);
      return;
    }
    if (!res.ok) { st.cc.badMove = [uci.slice(0, 2), uci.slice(2, 4)]; render(); tell.answer({ ok: false, why: res.why }); return; }
    st.cc.hint = null;
    render();
    tell.answer({ ok: true, msg: res.msg, done: res.done });
    pump(st);
  }

  /** A tap on a square, when the step asks for squares. */
  function onTap(e) {
    const st = cur;
    if (!st || st.done || st.cc.run.goal?.type !== "squares" || st.cc.run.done) return;
    const r = over.getBoundingClientRect(), sq = squareAt((e.clientX - r.left) / r.width * 8, (e.clientY - r.top) / r.height * 8, st.cc.white);
    if (!sq) return;
    st.cc.badSq = null;
    const res = st.cc.run.tap(sq);
    render();
    if (res.pending) { tell.changed(); return; }
    st.cc.badSq = res.ok ? null : res.wrong;
    render();
    tell.answer(res);
  }

  return {
    mount(box, handlers) {
      tell = handlers;
      box.classList.add("cc-stage");
      box.innerHTML = `<div class="cc-wrap"><div class="cc-board"></div><svg class="cc-over" viewBox="0 0 8 8" role="group"></svg></div>`;
      wrap = box.firstElementChild;
      over = wrap.querySelector(".cc-over");
      board = mountBoard(wrap.querySelector(".cc-board"), { onMove, view: "board" });
      over.addEventListener("click", onTap);
    },
    draw(step, st) {
      if (cur !== st) {                                            // a new step: the position starts over
        stop();
        cur = st;
        st.cc = { step, run: startRun(step), slide: false, hint: null, badSq: null, badMove: null, back: null };
        pump(st, true);
      }
      render();
    },
    task: step => !!step.goal,
    submits: step => step.goal?.type === "squares" && step.goal.squares.length > 1,
    ready: (step, st) => !!st.cc && st.cc.run.taps.length > 0,
    label: () => "Check",
    submit(step, st) {
      const res = st.cc.run.judgeTaps();
      st.cc.badSq = res.ok ? null : res.wrong;
      return res;
    },
    hint(step, st) { st.cc.hint = st.cc.run.reveal(); },
    /** The sheet closed: no move of the computer's is left to play. */
    stop() { stop(); cur = null; },
  };
}
