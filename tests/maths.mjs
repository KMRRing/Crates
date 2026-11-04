// The Maths course (maths-course.js on course.js): the lessons are well formed, every answer is recomputed here by a route the
// lesson did not use (tests/maths-check.js), the expression language parses and prints what it should, and every bank question
// a practice step names exists. A step with a number in it that has no check fails.
import { COURSE, LEVELS } from "../maths-course.js";
import { lessonsOf } from "../course.js";
import { compile, pretty, valueOf, parse, params } from "../maths-expr.js";
import { verify } from "./maths-check.js";
import * as K from "../maths-math.js";
import { MATHS } from "../maths-bank.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));

// ---------- the expression language ----------
const E = (s, vars = {}) => compile(s)(vars);
check(near(E("2^3^2"), 512) && near(E("-x^2", { x: 3 }), -9) && near(E("sqrt(3)/2"), Math.sqrt(3) / 2) && near(E("e^(-x)", { x: 1 }), Math.exp(-1)), "powers are right-associative, minus binds looser than ^, constants work");
check(near(E("3*x^2*sin(x)", { x: 2 }), 12 * Math.sin(2)) && near(E("ln(x)/x", { x: 2 }), Math.log(2) / 2) && Number.isNaN(E("y+1")), "functions and unknown variables");
check(pretty("3*x^2*sin(x)") === "3x² sin x" && pretty("sqrt(3)/2") === "√3/2" && pretty("(x+1)^2") === "(x + 1)²" && pretty("6*10^9") === "6 × 10⁹" && pretty("-4") === "−4" && pretty("x^(1/2)") === "x^(1/2)", "pretty prints what a reader expects");
check(near(valueOf("3/4"), 0.75) && near(valueOf("−0,5"), -0.5) && near(valueOf("√2"), Math.SQRT2) && near(valueOf("pi/6"), Math.PI / 6) && Number.isNaN(valueOf("abc")) && Number.isNaN(valueOf("")), "typed answers parse");
let threw = 0; for (const s of ["2+", "(1", "sin(", "3 4 +", "x^"]) try { parse(s); } catch { threw++; }
check(threw === 5 && params("a*x^2+b*x+c").join() === "a,b,c", "bad text is refused, free variables are found");

// ---------- the arithmetic library ----------
check(K.gcd(84, 126) === 42 && K.lcm(12, 18) === 36 && K.factorise(84).join(";") === "2,2;3,1;7,1" && K.binom(10, 3) === 120, "gcd, lcm, factorise, binom");
check(near(K.simpson(x => x * x, 0, 3), 9) && near(K.deriv(Math.sin, 0.5), Math.cos(0.5), 1e-8) && near(K.normCdf(1.96), 0.975, 1e-3), "numerical calculus and the normal curve");
check(K.pText([-6, 1, 1]) === "x^2+x-6" && K.pText([1, -3, 2]) === "2*x^2-3*x+1" && K.nm(3.10) === "3.1" && K.nm(-0.001) === "0" && K.nm(10, 0) === "10" && K.nm(0, 0) === "0" && K.nm(2.5, 0) === "3", "polynomial text and number text");

// ---------- shape ----------
const LESSONS = lessonsOf(COURSE);
check(LESSONS.length >= 10, `${LESSONS.length} lessons in ${COURSE.chapters.length} chapters`);
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length && LESSONS.every(x => x.lesson.title && x.lesson.title.length <= 20 && x.lesson.steps.length >= 3), "each lesson has its own id, a short title and at least three steps");
check(COURSE.chapters.every(c => c.title && c.lessons.length && LEVELS[c.id]), "every chapter has a title, lessons and a level");

const bankIds = new Set(MATHS.map(q => q.id)), seen = new Set(), problems = [], steps = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((s, i) => {
  const where = `${l.id} step ${i + 1}`;
  steps.push({ l, s, where });
  if (!s.say || s.say.length < 10) problems.push(`${where}: no words`);
  if (s.id) { if (seen.has(s.id)) problems.push(`${where}: repeated id ${s.id}`); seen.add(s.id); }
  if (s.quiz) {
    const q = s.quiz;
    if (q.length < 3 || q.length > 5) problems.push(`${where}: ${q.length} options`);
    if (new Set(q).size !== q.length) problems.push(`${where}: repeated options`);
    if (!Number.isInteger(s.answer) || s.answer < 0 || s.answer >= q.length) problems.push(`${where}: answer out of range`);
    if (!s.why || s.why.length < 20) problems.push(`${where}: no explanation`);
    if (q.some(o => o.length > 90)) problems.push(`${where}: an option is too long`);
  }
  if (s.num && (!s.why || s.why.length < 20)) problems.push(`${where}: no explanation`);
  if (s.w?.goal && !(s.w.goal.p || s.w.goal.e || s.w.goal.err || s.w.goal.frac)) problems.push(`${where}: a goal with nothing to reach`);
  if (s.w?.kind === "plot" && s.w.goal && !s.w.params) problems.push(`${where}: a goal without sliders`);
  if (s.w?.kind === "plot") for (const cv of s.w.fns || []) try { compile(cv.e); } catch (e) { problems.push(`${where}: ${e.message}`); }
});
check(!problems.length, `every step reads and every question is well formed${problems.length ? ": " + problems.slice(0, 5).join("; ") : ""}`);

const quizzes = steps.filter(x => x.s.quiz), typed = steps.filter(x => x.s.num), goals = steps.filter(x => x.s.w?.goal);
check(quizzes.length >= 15 && new Set(quizzes.map(x => x.s.answer)).size >= 3, `${quizzes.length} choices (right answers in ${new Set(quizzes.map(x => x.s.answer)).size} places), ${typed.length} typed, ${goals.length} to set`);
const longest = quizzes.filter(x => { const len = x.s.quiz.map(o => o.length); return len[x.s.answer] === Math.max(...len) && len.filter(n => n === len[x.s.answer]).length === 1; }).length;
check(longest / quizzes.length < 0.5, `the right option is the longest in ${longest} of ${quizzes.length} questions`);
const words = steps.filter(x => x.s.chk?.t === "words").length;
check(words <= 0.2 * (quizzes.length + typed.length), `${words} questions are about words, the rest are computed`);

// ---------- every answer, recomputed ----------
const wrong = [];
for (const { s } of steps) wrong.push(...verify(s, bankIds));
check(!wrong.length, `every answer survives its check${wrong.length ? ":\n  " + wrong.slice(0, 12).join("\n  ") : ""}`);

process.exit(bad ? 1 : 0);
