// Flank's course (Learn, in the header): the rules, then what makes a position good, on the course's sheet (course.js)
// with a stage of its own, the board as the game draws it (flank-board-ui.js). Every claim about a position is the
// engine's: a puzzle's best move is the solver's (tests/flank-course.mjs plays each one out to the end), and the
// numbers a lesson shows (discs, replies) are counted as it draws, never written here.
//
// A step is words over a board. The board is `b` (rows of d, l and ".", any spacing) or `moves` from the start; `t` is
// the side to move (dark by default; the reader always plays dark in a puzzle). Then one of:
//   quiz, answer, why     a choice (calc: "moves" | "winner" | "fewer" says what the answer is counted from, for the tests)
//   free                  any marked square will do
//   tap, also, loses,     a square to tap (several: any of them), more that are good enough, and squares that lose;
//   proved, most, mob     proved: the solver finds `tap` the best move; most: the square that turns most discs;
//                         mob: say how many replies the other side has
//   find                  tap every square where the side to move may play (nothing is marked)
//   miss, wrong, why      what a wrong tap is told: miss for any, wrong[square] for one; why after a right one
// and what is shown: mark ("g2:bad h1:pick h8:good"), pair ("h4 a7": the board after each of two moves, with the
// replies marked), reveal (the marked squares once a quiz is answered), pass ("l": that side has no move), over.
import { position, play, movesOf, turnsOf, sqName, sqOf, tally, START } from "./flank-board.js";
import { createBoard } from "./flank-board-ui.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const SIDE = { d: "Dark", l: "Light" };
const names = text => String(text ?? "").split(/\s+/).filter(Boolean);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** A step's position: its board, or the moves from the start, with `t` to move (a side with no move passes on). */
export function positionOf(step) {
  let p = position(step.b ? String(step.b).replace(/\s+/g, "") : START, step.t || "d");
  for (const name of names(step.moves)) {
    const sq = sqOf(name);
    p = play(p, sq);
    if (!p) throw new Error(`${name} is not a move`);
  }
  return p;
}
/** The squares a step names, as numbers. */
export const squaresIn = text => names(text).map(sqOf);
const marksOf = text => Object.fromEntries(names(text).map(x => { const [n, kind] = x.split(":"); return [sqOf(n), kind]; }));
/** The replies the other side has after a move on sq (0 when it must pass, which the position says). */
export function repliesTo(p, sq) {
  const n = play(p, sq);
  return n && !n.over && n.t !== p.t ? movesOf(n).length : 0;
}
const isTask = step => !!(step.tap || step.free || step.find);

/**
 * What a tap on a square means in a step that asks for one: the answer for the course ({ ok, msg | why, done }), with
 * the step's own state (st) updated: the squares found, the move played (after), the square to mark wrong (bad).
 */
export function judge(step, st, sq, p = positionOf(step)) {
  const name = sqName(sq), legal = movesOf(p), other = SIDE[p.t === "d" ? "l" : "d"];
  if (p.b[sq] !== ".") return { ok: false, why: "That square is taken." };
  if (!legal.includes(sq)) {
    st.bad = sq;
    return { ok: false, why: step.find ? "Nothing would turn there: a move has to close a run of the other side's discs." : "Nothing would turn there. Tap a marked square." };
  }
  if (step.find) {
    st.found = st.found || new Set();
    st.found.add(sq);
    st.bad = -1;
    const left = legal.length - st.found.size;
    return left > 0 ? { ok: true, done: false, msg: `${st.found.size} of ${legal.length} found.` } : { ok: true, msg: step.why || `That is all ${legal.length} of them.` };
  }
  const good = squaresIn(step.tap), also = squaresIn(step.also);
  if (step.free || good.includes(sq) || also.includes(sq)) {
    st.after = play(p, sq);
    st.bad = -1;
    const n = st.after.flips.length, bits = [`${plural(n, "disc", "discs")} turned.`];
    if (step.mob) bits.push(`${other} has ${plural(repliesTo(p, sq), "reply", "replies")}.`);
    if (!step.free && !good.includes(sq)) bits.push(`That works, but ${names(step.tap).join(" or ")} is better.`);
    else if (step.why) bits.push(step.why);
    return { ok: true, msg: bits.join(" ") };
  }
  st.bad = sq;
  const bits = [step.wrong?.[name] || step.miss || "Legal, but not the best move."];
  if (step.mob) bits.unshift(`After ${name} ${other.toLowerCase()} has ${plural(repliesTo(p, sq), "reply", "replies")}.`);
  return { ok: false, why: bits.join(" ") };
}

/**
 * The stage for course.js: the board, and under it the discs of each side (or, for a pair, the two boards each with its
 * count of replies). The reader taps squares; the stage judges and tells the course (answer).
 */
export function boardStage() {
  let ctx = null, cur = null, lastStep = null, main = null, dom = null;
  const pairs = [];
  const posCache = new WeakMap();
  const pos = step => { if (!posCache.has(step)) posCache.set(step, positionOf(step)); return posCache.get(step); };

  function countsRow(p, b, turn) {
    const c = tally(b);
    return `<span><i class="fk-swatch d"></i><b>${c.d}</b></span><span><i class="fk-swatch l"></i><b>${c.l}</b></span>${turn ? `<span>${esc(turn)}</span>` : ""}`;
  }

  return {
    mount(box, c) {
      ctx = c;
      box.innerHTML = `<div class="lk"><div class="lk-board" data-one><div class="fk-board"></div></div>
        <div class="lk-pair" hidden>${[0, 1].map(() => `<div><small></small><div class="lk-board"><div class="fk-board"></div></div></div>`).join("")}</div>
        <div class="lk-row"></div></div>`;
      dom = { one: box.querySelector("[data-one]"), pair: box.querySelector(".lk-pair"), row: box.querySelector(".lk-row") };
      main = createBoard(dom.one.querySelector(".fk-board"), { onTap: sq => { if (cur && !cur.st.done && isTask(cur.step)) ctx.answer(judge(cur.step, cur.st, sq, pos(cur.step))); } });
      box.querySelectorAll(".lk-pair > div").forEach(d => pairs.push({ label: d.querySelector("small"), board: createBoard(d.querySelector(".fk-board"), { labels: false }) }));
    },
    task: step => isTask(step),
    hint(step, st) { st.hint = true; },
    draw(step, st) {
      cur = { step, st };
      const p = pos(step), fresh = step !== lastStep;
      lastStep = step;
      const task = isTask(step) && !st.done, pair = names(step.pair);
      dom.one.hidden = pair.length > 0;
      dom.pair.hidden = pair.length === 0;
      if (pair.length) {
        pair.forEach((name, i) => {
          const sq = sqOf(name), n = play(p, sq), k = repliesTo(p, sq);
          pairs[i].label.textContent = `${name} · ${plural(k, "reply", "replies")}`;
          pairs[i].board.draw({ b: n.b, legal: n.t !== p.t && !n.over ? movesOf(n) : [], last: sq, flips: n.flips, still: true, tap: false });
        });
        dom.row.innerHTML = `<span>${esc(SIDE[p.t])} plays one of these</span>`;
        return;
      }
      const shown = st.after || p, marks = { ...marksOf(step.mark) };
      for (const sq of st.found || []) marks[sq] = "good";
      if (st.bad >= 0 && st.bad != null && !st.done) marks[st.bad] = "bad";
      let hint = -1;
      if (st.hint && task) {
        const goal = step.find ? movesOf(p).filter(x => !st.found?.has(x)) : squaresIn(step.tap);
        hint = goal[0] ?? -1;
      }
      const dots = (task && !step.find) || (step.reveal && st.done) ? movesOf(shown) : [];
      main.draw({ b: shown.b, legal: dots, last: st.after ? st.after.sq : -1, flips: st.after?.flips || [], marks, hint, tap: task, still: fresh });
      dom.row.innerHTML = countsRow(p, shown.b, task ? `${SIDE[p.t]} to move` : "");
    },
  };
}

// ---------- the lessons ----------
// The puzzles are positions from real games (tools/flank-puzzles.mjs finds them); the solver proves their answers.
const corner = "..dddd.. ..dddl.d llldlddd lldllldd lddllldd lldlllld llllll.l llllll..";
const afterCorner = "..dddd.. ..dddl.d llldlddd lldllldd lddllldd lldlllld llllll.d llllll.d";
const beside = "dd.llll. ddllll.l dlddllll dldddldl lllddddl dddddddl ...lllll ...l...l";
const fewer = "dddddddd .ddddddd .dddddll d.ddddd. .llldldd .llddddd .llldd.. llllllll";
const mobile = "dddll... dddl.l.l ddldllll .ddldlll ..dddll. lllldld. lllllll. llllll.l";
const regions = "....d..d ..ddddld lddddl.d llddlddd ddllddld ddlldlld ddddld.d ddddddd.";
const finish = "...dllld ..ddlldd llddlldd lllldldd llddlddl lldldldl .llddddl .lll.ldl";
const opening = "........ ...l.d.. ...ld... ..lld... ..lldd.. .lllll.. ..d.d... .ld.....";
const light = "llllll.. llddll.. llllddll lllldddd .llddldd .l.ldldd .lllddld ...lllll";
const over = ".llllll. dllddddd dlllldld dllldldd dlldlddd dldldldd ddllllld ddddddd.";

export const COURSE = {
  title: "Learn Flank", zh: "",
  chapters: [
    { id: "rules", title: "The rules", zh: "", lessons: [
      { id: "start", title: "The first move", zh: "", steps: [
        { say: "Flank is played on eight by eight squares, with discs that have a dark side and a light side. Each side starts with two discs in the middle, and dark moves first." },
        { say: "A dark disc carries a gilt dot and a light disc a ring, so the two are never told apart by colour alone." },
        { say: "On its move a side places one disc where it turns something over. How many squares can dark choose from on the first move?", quiz: ["2", "3", "4", "5"], answer: 2, calc: "moves", reveal: true, why: "Four: they are marked now." },
        { say: "Tap one of the marked squares to make the first move.", free: true, why: "Your disc closed a run of the other side's discs, and the run turned over to your colour." },
      ] },
      { id: "turn", title: "Turning discs", zh: "", steps: [
        { say: "A move closes a straight run of the other side's discs between the new disc and one of yours. The run turns. Dark has two moves here: tap the one that turns more discs.",
          b: "........ ........ ..dl.... ........ ..dll... ........ ........ ........", tap: "f5", most: "f5",
          wrong: { e3: "That turns one disc. The other square turns two." }, why: "The run d5, e5 ends in dark's c5." },
        { say: "One disc turns every run it closes, in all directions at once: along the row, down the column, across the diagonals. Tap the marked square.",
          b: "........ ........ ........ ....ld.. ...ll... ...d.d.. ........ ........", tap: "d4", why: "One disc, three runs." },
        { say: "A square where nothing would turn is not a move. This time nothing is marked: tap every square where dark may play.", moves: "d3 c3", find: true },
      ] },
      { id: "pass", title: "Passing, ending", zh: "", steps: [
        { say: "Light has no square where a disc would turn. What happens?", b: light, t: "l", pass: "l",
          quiz: ["Light passes and dark moves again", "The game ends at once", "Light may play anywhere"], answer: 0, why: "A side with no move passes. The game goes on while either side can move." },
        { say: "Now neither side can move, so the game is over. The side with more discs wins, and empty squares count for no one. Who wins?", b: over, over: true, calc: "winner",
          quiz: ["Dark", "Light", "A draw"], answer: 0, why: "Dark has more discs." },
      ] },
    ] },
    { id: "strategy", title: "Strategy", zh: "", lessons: [
      { id: "corners", title: "Corners", zh: "", steps: [
        { say: "A disc in a corner can never be turned: a run needs a square beyond it, and a corner has none. The four corners are the strongest squares on the board.", b: corner, mark: "a1:pick h1:pick a8:pick h8:pick" },
        { say: "Dark to move. One of the marked squares is a corner. Take it.", b: corner, tap: "h8", proved: true, miss: "Legal, but a corner is on offer. Take it.", why: "Corners are worth taking almost at any price." },
        { say: "A corner also guards the edge beside it. The marked dark discs run unbroken from the corner, so no run can ever close over them: they stay dark to the end.", b: afterCorner, t: "l", stable: true,
          mark: "h2:good h3:good h4:good h5:good h6:good h7:good h8:good" },
      ] },
      { id: "beside", title: "Beside corners", zh: "", steps: [
        { say: "The squares touching an empty corner are risky. The diagonal one, g2 here, is the worst: it so often lets the other side take the corner.", b: beside, mark: "h1:pick g2:bad" },
        { say: "Dark to move. Playing g2 would turn the most discs. Find a move that keeps away from the empty corner.", b: beside, tap: "c1", also: "c8 f8 e8 g8", loses: "g2", most: "g2", proved: true,
          wrong: { g2: "g2 turns the most, and the solver shows it loses this game. A disc beside an empty corner is a gift." }, miss: "Legal, but not what the solver would play.", why: "Quiet moves keep the corner out of the other side's reach." },
      ] },
      { id: "mobility", title: "Moves, not discs", zh: "", steps: [
        { say: "A move you can make is a choice. The side with more choices can wait, and the other side runs out of safe squares first. So count the other side's replies, not the discs.", b: fewer },
        { say: "Dark has two candidate moves. The boards show the position after each, with light's replies marked. Which move leaves light fewer replies?", b: fewer, pair: "h4 a7", most: "a7", calc: "fewer",
          quiz: ["h4", "a7"], answer: 0, why: "a7 turns more discs but leaves light more moves." },
        { say: "Dark to move. Choose the move that leaves light the fewest replies.", b: mobile, tap: "h5", mob: true, proved: true, loses: "g2", miss: "Look for the move after which light has the fewest replies.", why: "Fewest replies, and the solver agrees it is best." },
      ] },
      { id: "quiet", title: "Quiet moves", zh: "", steps: [
        { say: "In the opening, turning the most discs usually helps the other side. Compare c3, which turns the most, with d7, which turns one. Which leaves light fewer replies?", b: opening, pair: "c3 d7", most: "c3", calc: "fewer",
          quiz: ["c3", "d7"], answer: 1, why: "Every disc you turn is another the other side can bracket against." },
        { say: "So early on, prefer quiet moves that turn few discs and stay inside the crowd. Discs are counted only at the very end.", b: opening },
      ] },
      { id: "parity", title: "The last regions", zh: "", steps: [
        { say: "Near the end the empty squares fall into separate regions. When the two sides alternate, whoever plays first in a region with an odd number of squares also plays last there. So begin in the odd regions.", b: regions },
        { say: "Dark to move. The empty squares form regions of six, two, one and two squares. Play in the odd one.", sizes: "6 2 1 2", b: regions, tap: "g3", proved: true,
          miss: "That wins too, but by less. Look for the region with an odd number of squares.", why: "Only even regions are left: whenever light plays in one, dark can answer there and play last." },
      ] },
      { id: "count", title: "Counting the end", zh: "", steps: [
        { say: "With few squares left the rules of thumb give way to counting: every line can be played to the end, and the solver does. Dark to move, with only a few squares left. The corner a8 is on offer.", b: finish, tap: "e8", loses: "a8 a7 a2", proved: true,
          wrong: { a8: "The corner loses here: the solver plays it out and finds the count against you." }, miss: "That loses once played out. Count the discs at the end.", why: "Only e8 wins. Near the end, count." },
      ] },
      { id: "game", title: "A game", zh: "", steps: [
        { say: "That is the whole of it: corners, quiet moves, the other side's replies, and the count at the end. Play a game against the computer on Easy.", play: true, level: "easy" },
      ] },
    ] },
  ],
};
