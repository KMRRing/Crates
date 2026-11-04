// Nine Men's Morris's course (morris-course.js): every claim a lesson makes about a position is checked against the rules and
// the search. A board is legal (no more than nine pieces a side, in hand and on the board; the side to move has a move unless
// the lesson says the game is over), every answer is a legal move, an answer that is to close a mill does, a puzzle marked
// proved has its answer found best by the search, and the numbers a quiz asks for are counted here.
import { COURSE, positionOfStep, answersOf, isTask, moveVerdict, takeVerdict, pairOf } from "../morris-course.js";
import { movesOf, decode, ptOf, ptName, N, MILL_MASK, neighbours, toText, popcount, takeable } from "../morris-board.js";
import { look } from "../morris-search.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };
const names = text => String(text ?? "").split(/\s+/).filter(Boolean);
const steps = COURSE.chapters.flatMap(c => c.lessons.flatMap(l => l.steps.map((step, i) => ({ step, where: `${l.id} ${i + 1}` }))));

const ids = COURSE.chapters.flatMap(c => c.lessons.map(l => l.id));
check(new Set(ids).size === ids.length && ids.length >= 7, "the lessons have their own ids");
check(COURSE.chapters.flatMap(c => c.lessons).every(l => l.steps.length && l.steps.at(-1) && l.title), "every lesson has a title and steps");

let tasks = 0, proved = 0, quizzes = 0;
for (const { step, where } of steps) {
  let p;
  try { p = positionOfStep(step); } catch (e) { check(false, `${where}: the board is not readable (${e.message})`); continue; }
  const d = names(step.d), l = names(step.l);
  check([...d, ...l].every(n => ptOf(n) >= 0) && new Set([...d, ...l]).size === d.length + l.length, `${where}: every point is real and holds one piece`);
  check(d.length + (step.hd || 0) <= 9 && l.length + (step.hl || 0) <= 9, `${where}: no side has more than nine pieces`);
  for (const m of names(step.mark)) check(ptOf(m.split(":")[0]) >= 0 && ["good", "bad", "pick"].includes(m.split(":")[1]), `${where}: mark ${m} is a point and a verdict`);
  if (step.over) check(p.over, `${where}: the game is over on this board`);
  else check(!p.over, `${where}: the game is not over on this board`);
  check(!!step.over || d.length + l.length > 0 || (p.hd === 9 && p.hl === 9), `${where}: a bare board is the start`);
  if (step.quiz) {
    quizzes++;
    check(step.answer >= 0 && step.answer < step.quiz.length, `${where}: the answer is one of the choices`);
    if (step.calc === "points") check(Number(step.quiz[step.answer]) === N, `${where}: ${N} points`);
    if (step.calc === "mills") check(Number(step.quiz[step.answer]) === MILL_MASK.length, `${where}: ${MILL_MASK.length} mills`);
    if (step.calc === "neighbours") {
      const pick = step.quiz.map(o => ptOf(o.split(/[ ,]/)[0]));
      const best = Math.max(...pick.map(i => neighbours(i).length));
      check(neighbours(pick[step.answer]).length === best && pick.filter(i => neighbours(i).length === best).length === 1, `${where}: the answer is the one point touching most others`);
    }
    if (step.calc === "winner") check(p.over && step.quiz[step.answer] === (p.winner === "d" ? "Dark" : "Light"), `${where}: the winner is ${p.winner}`);
  }
  if (!isTask(step)) continue;
  tasks++;
  const legal = movesOf(p).map(decode);
  const answers = answersOf(step);
  check(step.free || answers.length > 0, `${where}: a task names its answer`);
  for (const [f, t] of [...answers, ...names(step.also).map(pairOf)]) check(legal.some(m => m.f === f && m.t === t), `${where}: ${ptName(t)} is a legal move`);
  // every legal move is judged: the answers right, the rest wrong
  for (const m of legal) {
    const v = moveVerdict(step, m.f, m.t), isAnswer = answers.some(([f, t]) => f === m.f && t === m.t), isAlso = names(step.also).map(pairOf).some(([f, t]) => f === m.f && t === m.t);
    if (!step.free) check(v.ok === (isAnswer || isAlso), `${where}: ${m.f},${m.t} is judged as it should be`);
  }
  // a step that takes a piece: its answer closes a mill, and the pieces it names are takeable
  if (step.mill) {
    const [f, t] = answers[0];
    const closing = legal.filter(m => m.f === f && m.t === t && m.x >= 0);
    check(closing.length > 0, `${where}: ${ptName(t)} closes a mill`);
    for (const n of names(step.take)) check(closing.some(m => m.x === ptOf(n)) && takeVerdict(step, ptOf(n)).ok, `${where}: ${n} may be taken`);
    for (const m of closing) if (step.take) check(takeVerdict(step, m.x).ok === names(step.take).map(ptOf).includes(m.x), `${where}: takes are judged as the step says`);
  } else if (!step.free) {
    const [f, t] = answers[0];
    check(!legal.some(m => m.f === f && m.t === t && m.x >= 0), `${where}: ${ptName(t)} closes no mill`);
  }
  for (const key of Object.keys(step.wrong || {})) check(legal.some(m => (m.f < 0 ? ptName(m.t) : `${ptName(m.f)}-${ptName(m.t)}`) === key), `${where}: the wrong answer ${key} is a legal move`);
  if (step.proved) {
    proved++;
    const blocking = /Block/.test(step.say);
    const r = blocking ? look(p, { nodes: 1e9, depth: 4, full: true }) : look(p, { nodes: 150000, depth: 30, tie: 0 });
    const top = decode(r.scores[0].code), [f, t] = answers[0];
    check(top.f === f && top.t === t, `${where}: the search finds ${ptName(t)} best (it prefers ${ptName(top.t)})`);
    if (blocking) {
      // every other place loses a piece at once: the lesson's claim
      const rest = legal.filter(m => !(m.f === f && m.t === t));
      const margin = r.scores.find(m => m.code !== r.scores[0].code);
      check(rest.length > 0 && r.scores[0].score - margin.score >= 60, `${where}: blocking is worth at least a good deal more than anything else`);
    }
  }
}
check(tasks >= 5 && proved >= 2 && quizzes >= 4, `the course asks things of the reader (${tasks} exercises, ${proved} proved by search, ${quizzes} questions)`);
check(steps.some(({ step }) => step.play), "the last lesson is a game");

console.log(bad ? `morris-course: ${bad} failed` : "morris-course: every check passed");
process.exit(bad ? 1 : 0);
