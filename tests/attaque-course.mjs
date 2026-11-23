// L'Attaque's course (attaque-course.js): every board a lesson draws is one the game allows (no two pieces on a square, none
// in a lake, no army over its numbers, a Flag for each side that has pieces), every move a lesson asks for or warns against is
// legal, and what a lesson says a move does (it wins, it loses, both fall, it takes the Flag) is what the engine does with it.
import { ARMY, COUNT, LAKE, FLAG, movesOf, play } from "../attaque-board.js";
import { COURSE, positionOfStep, answersOf, codeOf, isTask, moveVerdict, sq, token } from "../attaque-course.js";
import { lessonsOf } from "../course.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const words = t => String(t ?? "").split(/\s+/).filter(Boolean);
const all = lessonsOf(COURSE), steps = all.flatMap(({ lesson }) => lesson.steps.map((step, i) => ({ step, where: `${lesson.id} ${i + 1}` })));

let boards = 0, wrong = [];
for (const { step, where } of steps) {
  const toks = [...words(step.r), ...words(step.b)];
  if (toks.some(w => !token(w))) { wrong.push(`${where}: a piece that isn't one`); continue; }
  const { p } = positionOfStep(step), on = new Set(), counts = [Array(12).fill(0), Array(12).fill(0)];
  for (let id = 0; id < 2 * ARMY; id++) {
    if (p.pos[id] < 0) continue;
    if (on.has(p.pos[id]) || LAKE[p.pos[id]]) wrong.push(`${where}: two pieces on a square, or one in a lake`);
    on.add(p.pos[id]);
    counts[id < ARMY ? 0 : 1][p.kind[id]]++;
  }
  for (const side of [0, 1]) {
    if (counts[side].some((n, k) => n > COUNT[k])) wrong.push(`${where}: more of a rank than an army has`);
    if (counts[side].some(Boolean) && counts[side][FLAG] !== 1 && !step.setup) wrong.push(`${where}: a side without its Flag`);
  }
  boards++;
}
check(!wrong.length, `every one of ${boards} boards is one the game allows${wrong.length ? ` (${wrong.join("; ")})` : ""}`);

{
  const out = [];
  let tasks = 0;
  for (const { step, where } of steps) {
    if (!isTask(step)) continue;
    tasks++;
    const { p } = positionOfStep(step), legal = movesOf(p, 0);
    if (step.free && !legal.length) out.push(`${where}: no move to make`);
    if (step.move) {
      const [best] = answersOf(step);
      for (const m of [...answersOf(step), ...words(step.also).map(codeOf), ...Object.keys(step.wrong || {}).map(codeOf)]) if (!legal.includes(m)) out.push(`${where}: ${m} isn't legal`);
      if (!moveVerdict(step, best).ok) out.push(`${where}: its own answer is refused`);
      const { fx } = play(p, best);
      if (step.wins && !(fx && fx.r > 0)) out.push(`${where}: said to win`);
      if (step.loses && !(fx && fx.r < 0)) out.push(`${where}: said to lose`);
      if (step.ties && !(fx && fx.r === 0)) out.push(`${where}: said to take both`);
      if (step.flag && !(fx && fx.flag)) out.push(`${where}: said to take the Flag`);
      for (const k of Object.keys(step.wrong || {})) if (moveVerdict(step, codeOf(k)).ok) out.push(`${where}: a wrong move is let through`);
    }
    if (step.tap) {
      for (const n of words(step.tap)) {
        const id = p.board[sq(n)];
        if (step.moved && !(id >= ARMY && p.moved[id])) out.push(`${where}: ${n} isn't a piece of theirs that moved`);
      }
    }
  }
  check(!out.length && tasks >= 12, `every one of ${tasks} exercises asks for a legal move and says truly what it does${out.length ? ` (${out.join("; ")})` : ""}`);
}
{
  const quizzes = steps.filter(({ step }) => step.quiz);
  check(quizzes.every(({ step }) => Number.isInteger(step.answer) && step.answer >= 0 && step.answer < step.quiz.length && step.why), `every one of ${quizzes.length} questions has its answer among its options, and says why`);
  const ids = all.map(x => x.lesson.id);
  check(new Set(ids).size === ids.length && COURSE.chapters.length >= 3 && all.length >= 15, `${all.length} lessons in ${COURSE.chapters.length} chapters, each with its own id`);
  const last = all[all.length - 1].lesson.steps.at(-1);
  check(!!last.play && last.level === "easy", "the course ends in a game against the computer on Easy");
  const js = (await import("node:fs")).readFileSync(new URL("../attaque.js", import.meta.url), "utf8");
  check(/createCourse\(\{[^}]*id: "attaque"/.test(js) && /Learn L'Attaque, from the rules/.test(js) && /lesson \|\| rampNow\(\)/.test(js), "the menu opens the course, and a lesson's game plays the level it names");
}

console.log(bad ? `attaque course: ${bad} failed` : "attaque course: every check passed");
process.exit(bad ? 1 : 0);
