// Gammon's course (gammon-course.js: Learn Gammon, on course.js): every exercise worked through the board's rules
// (gammon-board.js). Every position written has fifteen checkers a side and no point held by both; every play asked
// for can be made with its roll and is judged right, every play it accepts too, every wrong play it has words for is
// judged wrong with them, and of every play the roll allows only the meant ones are right; the figures the lessons
// quote (pips, a gammon) are the board's; the stage takes every play to its end by taps; the course keeps its progress.
import { COURSE, boardOf, boardProblems, diceOf, parsePlay, playText, playOf, judge, boardStage } from "../gammon-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { plays, pips, kindOf } from "../gammon-board.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const LESSONS = lessonsOf(COURSE);
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length && LESSONS.every(x => x.lesson.steps.length && x.lesson.title), `${LESSONS.length} lessons, each with its own id, steps and a title`);
const ends = COURSE.chapters.map(c => c.lessons.at(-1));
check(ends.every(l => l.steps.at(-1).play === true) && LESSONS.every(x => (ends.includes(x.lesson) ? x.lesson.steps.slice(0, -1) : x.lesson.steps).every(s => !s.play)), "each chapter ends in a game, and nothing else does");

let boards = 0, playsAsked = 0, judged = 0, quizzes = 0;
const problems = [];
const key = p => `${p.me.join()}|${p.op.join()}`;
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`;
  if (!st.say) problems.push(`${where}: no words`);
  try { boardOf(st); } catch (e) { problems.push(`${where}: ${e.message}`); return; }
  boards++;
  for (const p of boardProblems(st)) problems.push(`${where}: ${p}`);
  if (st.answer != null && !st.quiz) {
    playsAsked++;
    const { me, op } = boardOf(st), legal = plays(me, op, diceOf(st));
    if (diceOf(st).length !== 2) problems.push(`${where}: no roll`);
    const right = new Set();
    for (const text of [st.answer, ...(st.accept || [])]) {
      const p = playOf(st, text);
      if (!p) { problems.push(`${where}: ${text} can't be played`); continue; }
      right.add(key(p));
      if (!judge(st, p.moves).ok) problems.push(`${where}: ${text} is judged wrong`);
    }
    for (const [text, words] of Object.entries(st.wrong || {})) {
      const p = playOf(st, text);
      if (!p) { problems.push(`${where}: the wrong play ${text} can't be played`); continue; }
      const res = judge(st, p.moves);
      if (res.ok || res.why !== words) problems.push(`${where}: the wrong play ${text} isn't judged so`);
    }
    for (const p of legal.filter(x => x.unique)) { judged++; if (judge(st, p.moves).ok !== right.has(key(p))) problems.push(`${where}: ${playText(p.moves, op)} is judged ${judge(st, p.moves).ok ? "right" : "wrong"}`); }
    if (!st.then) problems.push(`${where}: no words for the right play`);
  }
  if (st.quiz) {
    quizzes++;
    if (!(st.quiz.length >= 2 && st.answer >= 0 && st.answer < st.quiz.length) || !st.why) problems.push(`${where}: the answer isn't an option, or has no words`);
  }
});
check(!problems.length, `every step works: ${boards} boards, ${playsAsked} plays to make (${judged} plays judged), ${quizzes} questions`);
for (const p of problems) console.log(`     ${p}`);

// ---------- the figures ----------
const step = (id, f) => LESSONS.find(x => x.lesson.id === id).lesson.steps.find(f);
const pip = step("board", s => s.pips), pb = boardOf(pip);
check(`${pips(pb.me)} pips` === pip.quiz[pip.answer] && pips(boardOf({}).me) === 167, `pips: ${pips(pb.me)} here, 167 at the start`);
const gam = step("win", s => s.quiz), gb = boardOf(gam);
check(kindOf(gb.me, gb.op) === 2 && gam.quiz[gam.answer] === "2 points", "a gammon: none of theirs off, none on the bar or in your home");
const closed = step("bar", s => s.quiz), cb = boardOf(closed);
check(!plays(cb.me, cb.op, diceOf(closed))[0].moves.length && /^No/.test(closed.quiz[closed.answer]), "closed out: no move at all");
const runOn = Array(26).fill(0);
runOn[16] = 1;                                                // a blot of theirs on your 9 point
check(playText(parsePlay("24/18(2) 13/7(2)")) === "24/18(2) 13/7(2)" && playText(parsePlay("bar/22 6/off")) === "bar/22 6/off" && playText([[24, 18], [18, 13]]) === "24/13"
  && playText([[13, 9], [13, 9], [9, 5], [9, 5]]) === "13/5(2)" && playText([[13, 9], [9, 5]], runOn) === "13/9*/5" && parsePlay("13/9*/5").join(" ") === "13,9 9,5", "plays written and read back, a checker moved on as one path (a hit on the way starred)");

// ---------- GNU Backgammon's verdicts, as kept ----------
// Playing well's answers are gnubg's (asked offline: tools/gammon-check.mjs asks again). Kept with each step, best
// first: every play it lists can be made with the roll, each to its own position; the first is the answer (or one
// accepted), every play accepted is within 0.02 of it, and the best of the rest at least 0.03 below. A cube question's
// answer is gnubg's verdict, and the verdict follows from its equities: double when taken it's worth more than playing
// on (a drop worth 1), take when taken it's worth less than 1 to the doubler.
const kept = [];
let verdicts = 0;
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  if (!st.gnubg) return;
  const where = `${l.id} step ${i + 1}`;
  verdicts++;
  if (st.quiz) {
    const g = st.gnubg, double = Math.min(g.dt, 1) > g.nd, act = !double ? "no-double" : g.dt < 1 ? "double/take" : "double/pass";
    if (st.acts?.[st.answer] !== g.act || g.act !== act) kept.push(`${where}: the answer ${st.acts?.[st.answer]}, gnubg's ${g.act}, its equities say ${act}`);
    return;
  }
  const at = st.gnubg.map(([text]) => playOf(st, text)), right = new Set([st.answer, ...(st.accept || [])].map(t => key(playOf(st, t))));
  if (at.some(p => !p) || new Set(at.map(key)).size !== at.length) { kept.push(`${where}: a play gnubg lists can't be made, or two make one`); return; }
  const eq = st.gnubg.map(x => x[1]);
  if (eq.some((e, k) => k && e > eq[k - 1])) kept.push(`${where}: gnubg's plays aren't best first`);
  if (!right.has(key(at[0]))) kept.push(`${where}: gnubg's first, ${st.gnubg[0][0]}, isn't the answer`);
  const rest = eq.filter((_, k) => !right.has(key(at[k])));
  if (eq.some((e, k) => right.has(key(at[k])) && eq[0] - e > 0.02) || (rest.length && eq[0] - rest[0] < 0.03)) kept.push(`${where}: the answer isn't clear of the rest by gnubg's equities`);
});
check(!kept.length && verdicts >= 10, `GNU Backgammon's verdicts: ${verdicts} kept, each answer its first choice by a clear margin or its cube verdict`);
for (const p of kept) console.log(`     ${p}`);
{
  // the race's figures: the leads the cube questions name, as pips and as a share of yours
  const race = LESSONS.find(x => x.lesson.id === "race").lesson.steps.filter(s => s.acts), lead = s => { const b = boardOf(s); return [pips(b.op) - pips(b.me), (100 * (pips(b.op) - pips(b.me))) / pips(b.me)]; };
  const [a, b, c] = race.map(lead);
  check(a[0] === 4 && a[1] < 5 && /4 ahead is under 5%/.test(race[0].why) && b[0] === 8 && Math.round(b[1]) === 9 && /8 ahead is 9%/.test(race[1].why) && c[0] === 19 && Math.round(c[1]) === 22 && /19 ahead is 22%/.test(race[2].why) && race.every(s => s.pips), `the race's leads: ${[a, b, c].map(x => `${x[0]} (${x[1].toFixed(1)}%)`).join(", ")}, the pips shown`);
}

// ---------- the stage, tapped through ----------
function fakeBox() { const on = {}; return { innerHTML: "", addEventListener: (k, f) => { on[k] = f; }, on }; }
const tapOn = pt => ({ target: { closest: sel => (sel === "[data-pt]" ? { dataset: { pt: String(pt) } } : null) } });
let walked = 0;
const stuck = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((s, i) => {
  if (s.answer == null || s.quiz) return;
  const where = `${l.id} step ${i + 1}`, stage = boardStage(), box = fakeBox(), t = { done: false };
  stage.mount(box, { changed: () => stage.draw(s, t), answer: () => {} });
  stage.draw(s, t);
  // the answer's moves tapped: each checker, then its point when it may go more than one way
  for (const [from, to] of playOf(s, s.answer).moves) {
    box.on.click(tapOn(from));
    if (t.sel != null) box.on.click(tapOn(to));
  }
  if (!stage.ready(s, t)) stuck.push(`${where}: the play tapped isn't whole (${JSON.stringify(t.made)})`);
  else if (!stage.submit(s, t).ok) stuck.push(`${where}: the play tapped (${playText(t.made)}) is judged wrong`);
  walked++;
});
check(!stuck.length && walked === playsAsked, `the stage takes all ${walked} plays to their end by taps`);
for (const p of stuck) console.log(`     ${p}`);

const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const pr = progressOf("gammon", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length, `nothing done yet: ${pr.done} of ${pr.of}`);

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
