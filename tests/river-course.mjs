// River's course (river-course.js): every exercise played through the move generator, so none asks for what isn't
// there. Every position is legal (the side not to move isn't in check, the generals don't face); every "tap every point"
// has as many points as its words promise; every move asked for can be made, its hint does it, and a mate in one has
// one mating move; every opening line is legal move by move, with a note for each move, and ends where the openings
// table names it; the pinned piece really can't move; a quiz's answer is one of its options; the words read in either
// set of characters; and the course's judge says why a wrong move is wrong.
import { COURSE, LESSONS, fenOf, tapAnswers, judge, lineMoves, inScript, position } from "../river-course.js";
import { parseFen, legalMoves, attacked, pointNamed, movesFrom, parseUci, after, nameOf, keyOf, START } from "../river-rules.js";
import { openingOf } from "../river-openings.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(COURSE.length === 3 && COURSE.map(c => c.id).join() === "rules,ideas,openings", "three chapters: the rules, ideas, openings");
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length, `${LESSONS.length} lessons, each with its own id`);
check(LESSONS.every(x => x.lesson.steps.length && x.lesson.title && x.lesson.zh), "every lesson has steps, a title and a Chinese name");

let positions = 0, taps = 0, goals = 0, mates = 0, lines = 0, quizzes = 0;
const problems = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`;
  if (!st.say) problems.push(`${where}: no words`);
  let fen;
  try { fen = fenOf(st); } catch (e) { problems.push(`${where}: ${e.message}`); return; }
  const pos = parseFen(fen);
  positions++;
  if (attacked(pos.b, !pos.red)) problems.push(`${where}: the side not to move stands in check, or the generals face`);
  if (st.tap) {
    taps++;
    const a = tapAnswers(st);
    if (a.length !== st.expect) problems.push(`${where}: the piece can reach ${a.length} points, the words promise ${st.expect}`);
  }
  if (st.goal) {
    goals++;
    const solutions = legalMoves(pos).map(m => nameOf(m.from) + nameOf(m.to)).filter(u => judge(st, u).ok);
    if (!solutions.length) problems.push(`${where}: no move does what it asks`);
    if (st.hint && !judge(st, st.hint).ok) problems.push(`${where}: its hint ${st.hint} doesn't do it`);
    if (st.goal.mate) { mates++; if (solutions.length !== 1) problems.push(`${where}: ${solutions.length} mates, not one`); }
  }
  if (st.line) {
    lines++;
    let p = pos;
    const seen = [p];
    for (const { uci } of lineMoves(st)) {
      const m = parseUci(uci);
      if (!m || !legalMoves(p).some(x => x.from === m.from && x.to === m.to)) { problems.push(`${where}: ${uci} isn't legal`); break; }
      p = after(p, m.from, m.to);
      seen.push(p);
    }
    if (st.notes.length !== lineMoves(st).length) problems.push(`${where}: ${st.notes.length} notes for ${lineMoves(st).length} moves`);
    if (!["red", "black"].includes(st.you)) problems.push(`${where}: whose moves you make isn't said`);
    if (fen.startsWith(START.split(" ")[0]) && !openingOf(seen)) problems.push(`${where}: the openings table doesn't name the line`);
  }
  if (st.quiz) { quizzes++; if (!(st.answer >= 0 && st.answer < st.quiz.length)) problems.push(`${where}: the answer isn't an option`); }
  if (st.pick && l.id === "pin" && movesFrom(pos, pointNamed(st.pick[0])).length) problems.push(`${where}: the pinned piece can move`);
});
check(!problems.length, `every exercise works on the board: ${positions} positions, ${taps} taps, ${goals} moves to find (${mates} mates in one), ${lines} opening lines, ${quizzes} questions`);
for (const p of problems) console.log(`     ${p}`);

// the words, in either set of characters
check(inScript("{將軍|将军} and {馬|马}", "simplified") === "将军 and 马" && inScript("{將軍|将军}") === "將軍", "words follow the reader's characters");
check(LESSONS.every(x => x.lesson.steps.every(s => !/\{[^}]*$/.test(s.say) && !/[{}]/.test(inScript(s.say, "simplified")))), "no pair of characters left half open");

// the judge
{
  const mate = LESSONS.find(x => x.lesson.id === "facing").lesson.steps[0];
  check(judge(mate, "a2f2").ok && /way out/.test(judge(mate, "a2a10").why) && /isn't even check/.test(judge(mate, "a2b2").why), "a mate is judged, a check that isn't mate says the way out, a quiet move says it isn't check");
  const pin = LESSONS.find(x => x.lesson.id === "pin").lesson.steps[1];
  check(/pin would be gone/.test(judge(pin, "d7e7").why), "a particular wrong move gets its own words");
  check(judge(mate, "a2a3").ok === false && judge(mate, "e1e2").why.length > 0, "a move that doesn't do it is never right");
  check(/isn't legal/.test(judge(mate, "a2b3").why), "an illegal move says so");
}
check(position("K e1, R a1 | k e10, c e8", "b").endsWith(" b - - 0 1") && parseFen(position("K e1 | k d10")).b[pointNamed("d10")] === -1, "positions are written as pieces on points");
check(keyOf(parseFen(fenOf({ from: "start", moves: "h3e3" }))) === keyOf(after(parseFen(START), pointNamed("h3"), pointNamed("e3"))), "a step can start from the opening and moves");

console.log(bad ? `river-course: ${bad} failed` : "river-course: every check passed");
process.exit(bad ? 1 : 0);
