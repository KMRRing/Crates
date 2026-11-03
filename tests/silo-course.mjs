// Four in a row's course (silo-course.js): every exercise's answer is proved, not trusted. An answer is the set of columns the
// solver (or plain play) says it is, exactly: a win at once; a win in three plies (a double threat); the one column that
// doesn't lose at once; every column that doesn't; the columns of the best exact score. ("told": the words name the column.) The wrong answers named are
// legal and not answers, the cells a step marks are cells where a disc would make four, and the side to move is the
// one the words say.
import { H, W, replay, drop, legal, outcome, runsThrough } from "../silo-board.js";
import { COURSE, cellOf } from "../silo-course.js";
import { createSolver } from "../silo-solver.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } return ok; };
const S = createSolver({ bits: 20, thinkBits: 14 });
const set = a => [...a].sort((p, q) => p - q).join(",");

/** The mover (1 or 2) wins by playing at once in column c. */
const winsNow = (m, c) => { const n = drop(m, c); return n !== null && outcome(n).over && !outcome(n).draw; };
/** The mover wins within three plies by column c: no win of their own now, none for the other in reply, and a win for
 *  the mover after every reply. */
function winsInThree(m, c) {
  const n = drop(m, c);
  if (n === null || outcome(n).over) return false;
  const replies = legal(n);
  if (replies.some(r => winsNow(n, r))) return false;
  return replies.every(r => { const k = drop(n, r); return !outcome(k).over && legal(k).some(x => winsNow(k, x)); });
}
const loses = (m, c) => { const n = drop(m, c); return n !== null && !outcome(n).over && legal(n).some(r => winsNow(n, r)); };
/** A disc of `who` at (c, r) would make four, with the rest of the position as it is. */
function wouldWin(m, c, r, who) {
  const { grid } = replay(m);
  if (grid[c * H + r]) return false;
  grid[c * H + r] = who;
  return runsThrough(grid, c, r).length >= 4;
}

const ids = new Set();
let steps = 0, proved = 0;
for (const ch of COURSE.chapters) {
  check(!ids.has(ch.id), `chapter id ${ch.id} is unique`);
  ids.add(ch.id);
  for (const L of ch.lessons) {
    check(!ids.has(`${ch.id}/${L.id}`) && L.steps.length > 0, `lesson ${ch.id}/${L.id} is unique and has steps`);
    ids.add(`${ch.id}/${L.id}`);
    L.steps.forEach((st, i) => {
      steps++;
      const where = `${L.id} step ${i + 1}`;
      const m = st.moves ?? "";
      let pos;
      try { pos = replay(m); } catch { check(false, `${where}: the moves replay`); return; }
      check(typeof st.say === "string" && st.say.length > 0, `${where}: it says something`);
      const task = Array.isArray(st.answer);
      if (st.quiz) {
        check(Number.isInteger(st.answer) && st.answer >= 0 && st.answer < st.quiz.length && st.quiz.length >= 2 && st.why, `${where}: a quiz with its answer among its options, and why`);
        return;
      }
      if (!task) {
        check(st.play || !outcome(m).over || outcome(m).line.length >= 4, `${where}: a position shown over is a win, with its four to light`);
        for (const c of st.show || []) { const { c: cc, r } = cellOf(c); check(cc >= 0 && cc < W && r >= 0 && r < H, `${where}: the marked cell ${c} is on the board`); }
        return;
      }
      check(!outcome(m).over, `${where}: an exercise's position is still being played`);
      check(st.answer.length > 0 && st.answer.every(c => Number.isInteger(c) && c >= 1 && c <= W && legal(m).includes(c - 1)), `${where}: its answers are columns with room`);
      // who moves is what the words say
      const mover = pos.n % 2 === 0 ? "ochre" : "blue";
      const said = /\b(ochre|blue)\b[^.]*?\b(to play|again)\b/i.exec(st.say);
      if (said) check(said[1].toLowerCase() === mover, `${where}: the words say ${said[1]} moves, the position has ${mover}`);
      // the answer is proved
      const cols = legal(m).map(c => c + 1);
      const want = (() => {
        switch (st.proof) {
          case "win1": return cols.filter(c => winsNow(m, c - 1));
          case "win3": return cols.filter(c => winsInThree(m, c - 1));
          case "block": return cols.filter(c => !loses(m, c - 1));
          case "safe": return cols.filter(c => !loses(m, c - 1));
          case "best": { const r = S.scores(m); return r.best.map(c => c + 1); }
          case "told": return new RegExp(`column ${st.answer[0]}\\b`).test(st.say) ? st.answer : [];   // "tap column 6": taught, not found
          default: return null;
        }
      })();
      if (!check(want !== null, `${where}: an exercise names its proof (${st.proof})`)) return;
      if (check(set(want) === set(st.answer), `${where}: ${st.proof}: the answer is [${set(st.answer)}] and the proof says [${set(want)}]`)) proved++;
      if (st.proof === "block") check(want.length === 1, `${where}: one cover only`);
      for (const [k, words] of Object.entries(st.wrong || {})) {
        check(legal(m).includes(Number(k) - 1) && !st.answer.includes(Number(k)) && typeof words === "string" && words.length > 0, `${where}: the wrong answer ${k} is a legal column that isn't an answer`);
      }
      // the cells marked are cells where a disc would make four, for one side or the other, once the answer is played
      const after = drop(m, st.answer[0] - 1);
      for (const c of st.show || []) {
        const { c: cc, r } = cellOf(c);
        check(cc >= 0 && cc < W && r >= 0 && r < H && (wouldWin(after, cc, r, 1) || wouldWin(after, cc, r, 2)), `${where}: marked ${c} is a cell that wins for somebody`);
      }
    });
  }
}
check(steps >= 25 && proved >= 10, `the course has its steps (${steps}) and its proved exercises (${proved})`);
console.log(bad ? `silo-course: ${bad} failed` : `silo-course: ${steps} steps, ${proved} exercises proved`);
process.exit(bad ? 1 : 0);
