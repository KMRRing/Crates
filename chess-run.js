// One step of the Chess course while it is being played (chess-stage.js draws it, tests/chess-course.mjs drives it the way a finger does):
// the position, the moves the opponent plays by itself, a move judged against the step's goal, a square tapped. No DOM and no clocks: the
// stage puts the delays between the moves it is told to play.
import { EMPTY, after, load, turnOf, freeMoves, freeMove } from "./chess-lab.js";
import { judgeMove, answersOf } from "./chess-judge.js";

const fileRank = sq => `file ${sq[0]}, rank ${sq[1]}`;
const mark = a => ({ from: a.move.from, to: a.move.to });

/** The step's run: { fen, last, done, taps, waiting(), auto(), moves(), move(uci), tap(sq), judgeTaps(), reveal() }. */
export function startRun(step) {
  const b = step.board || {}, goal = step.goal || null, squares = goal?.type === "squares", mover = !!goal && !squares;
  const run = { step, goal, fen: b.fen || EMPTY, last: null, i: 0, k: 0, done: false, taps: [], autos: [] };
  const turn = turnOf(run.fen);
  run.side = mover ? goal.side || (b.intro ? (turn === "w" ? "b" : "w") : turn) : null;   // the colour the learner moves (after the opponent's first move, if there is one)
  if (b.intro) run.autos.push(b.intro);
  if (mover && goal.type === "line" && turnOf(run.fen) !== run.side) run.autos.push(goal.moves[run.i++]);

  /** Whether a move of the opponent's is still to be played (the learner may not touch a piece until it has been). */
  run.waiting = () => run.autos.length > 0;
  /** Plays the opponent's next move; its engine words, or null when there is none. */
  run.auto = () => {
    const uci = run.autos.shift(), a = uci && after(run.fen, uci);
    if (!a) return null;
    run.fen = a.fen;
    run.last = mark(a);
    return uci;
  };
  /** The moves the learner may make now, as the board takes them (chess.js's verbose moves). */
  run.moves = () => {
    if (run.waiting() || b.still || squares) return [];
    if (b.explore) return freeMoves(run.fen);
    return mover && !run.done ? load(run.fen).moves({ verbose: true }).filter(m => m.color === run.side) : [];
  };
  /** A move made by hand: { ok, msg | why, done, wrong (the move that missed) }. A hit moves the position on; the opponent's answer is in autos. */
  run.move = uci => {
    if (b.explore && !goal) {
      const a = freeMove(run.fen, uci);
      if (a) { run.fen = a.fen; run.last = mark(a); }
      return { ok: !!a, free: true, why: "" };
    }
    if (!mover || run.done) return { ok: false, why: "" };
    const res = judgeMove(run.goal, run.fen, uci, run.i);
    if (!res.ok) return { ok: false, why: res.why, wrong: uci };
    const a = after(run.fen, uci);
    run.fen = a.fen;
    run.last = mark(a);
    let reply = null;
    if (run.goal.type === "line") {
      const note = step.notes?.[run.k++];
      run.i++;
      if (run.goal.moves[run.i]) { run.autos.push(run.goal.moves[run.i]); reply = after(run.fen, run.goal.moves[run.i]); run.i++; }
      run.done = run.i >= run.goal.moves.length;
      const text = `${a.san}${reply ? `, answered by ${reply.san}` : ""}.${note ? ` ${note}` : ""}`;
      return { ok: true, done: run.done, msg: run.done ? `${text} ${step.then || ""}`.trim() : text };
    }
    if (res.more) {                                                   // a mate in several: the defender answers, and the next move is asked for
      run.autos.push(res.reply);
      reply = after(run.fen, res.reply);
      run.goal = res.more;
      return { ok: true, done: false, msg: `${a.san}, answered by ${reply.san}. One more move.` };
    }
    run.done = true;
    return { ok: true, done: true, msg: `${a.san}. ${step.then || ""}`.trim() };
  };
  /** A square tapped for a squares goal: a single-square goal is judged at once, a many-square one on Check. */
  run.tap = sq => {
    if (!squares || run.done) return { ok: false, why: "" };
    if (goal.squares.length === 1) return run.judgeTaps([sq]);
    const at = run.taps.indexOf(sq);
    if (at >= 0) run.taps.splice(at, 1); else run.taps.push(sq);
    return { ok: false, why: "", pending: true };
  };
  /** The squares answer judged: ok when the squares tapped are exactly the right ones. */
  run.judgeTaps = (taps = run.taps) => {
    const want = new Set(goal.squares), got = new Set(taps);
    const extra = [...got].filter(s => !want.has(s)), missed = [...want].filter(s => !got.has(s));
    if (!extra.length && !missed.length) { run.done = true; run.taps = [...want]; return { ok: true, done: true, msg: `Right. ${step.then || ""}`.trim() }; }
    if (want.size === 1) return { ok: false, why: step.no || (run.step.board.fen === EMPTY ? `That is ${extra[0]}: ${fileRank(extra[0])}.` : `${extra[0]} is not the one.`), wrong: extra[0] };
    const parts = [];
    if (extra.length) parts.push(`${extra.join(", ")} ${extra.length === 1 ? "is" : "are"} not right`);
    if (missed.length) parts.push(`${missed.length} ${missed.length === 1 ? "is" : "are"} missing`);
    return { ok: false, why: `${parts.join(" and ")}. Try again.`, wrong: extra[0] || null };
  };
  /** The marks and arrows that show the answer (the hint, after two misses). */
  run.reveal = () => {
    if (squares) return { marks: Object.fromEntries(goal.squares.map(s => [s, "b"])), arrows: [] };
    const ms = answersOf(run.goal, run.fen, run.i);
    return { marks: {}, arrows: ms[0] ? [[ms[0].slice(0, 2), ms[0].slice(2, 4), "b"]] : [] };
  };
  return run;
}
