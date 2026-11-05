// The Odds course, the last part of Maths (odds-course.js, on course.js): the lessons are well formed, every figure a step rests on (`value`) is
// recomputed here by a count, a search or a plain sum rather than the code the lesson uses, the record of answers keeps
// and survives a bad store, and the course names no casino game (it has to stay in a build that leaves the Casino out).
import { readFileSync, readdirSync } from "node:fs";
import { COURSE } from "../odds-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { COURSE as MATHS, PARTS, progressAll } from "../maths-course.js";
import { readCalib, noteAnswer, readRanges, noteRange } from "../odds-store.js";
import { STATEMENTS } from "../odds-data.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// ---------- shape ----------
const LESSONS = lessonsOf(COURSE);
check(LESSONS.length >= 16 && LESSONS.length <= 20, `${LESSONS.length} lessons`);
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length && LESSONS.every(x => x.lesson.title && x.lesson.title.length <= 18 && x.lesson.steps.length >= 3), "each lesson has its own id, a short title and steps");
check(COURSE.chapters.every(c => c.title && c.lessons.length), "every chapter has a title and lessons");
check(LESSONS.at(-1).lesson.id === "lab", "the last lesson is the lab");

const problems = [], steps = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((s, i) => {
  const where = `${l.id} step ${i + 1}`;
  steps.push({ l, s, where });
  if (!s.say || s.say.length < 10) problems.push(`${where}: no words`);
  if (s.quiz) {
    const q = s.quiz;
    if (!Array.isArray(q) || q.length < 3 || q.length > 5) problems.push(`${where}: ${q?.length} options`);
    else {
      if (new Set(q).size !== q.length) problems.push(`${where}: repeated options`);
      if (!Number.isInteger(s.answer) || s.answer < 0 || s.answer >= q.length) problems.push(`${where}: answer out of range`);
      if (!s.why || s.why.length < 20) problems.push(`${where}: no explanation`);
      if (q.some(o => String(o).length > 90)) problems.push(`${where}: an option is too long`);
    }
  }
});
check(!problems.length, `every step reads and every quiz is well formed${problems.length ? ": " + problems.slice(0, 4).join("; ") : ""}`);

const quizzes = steps.filter(x => x.s.quiz);
const positions = new Set(quizzes.map(x => x.s.answer));
check(quizzes.length >= 30 && positions.size >= 3, `${quizzes.length} quiz questions, right answers in ${positions.size} positions`);
const longest = quizzes.filter(x => { const len = x.s.quiz.map(o => String(o).length); return len[x.s.answer] === Math.max(...len) && len.filter(n => n === len[x.s.answer]).length === 1; }).length;
check(longest / quizzes.length < 0.5, `the right option is the longest in ${longest} of ${quizzes.length} questions`);

// ---------- figures, recomputed ----------
const pairs = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) pairs.push([a, b]);
const n = (f, set = pairs) => set.filter(([a, b]) => f(a, b)).length;
const face = [1, 2, 3, 4, 5, 6];
const dieMean = face.reduce((s, x) => s + x, 0) / 6, dieSd = Math.sqrt(face.reduce((s, x) => s + (x - dieMean) ** 2, 0) / 6);
const growth = (f, p, b = 1) => p * Math.log(1 + b * f) + (1 - p) * Math.log(1 - f);
const bestStake = (p, b) => { let best = 0, at = 0; for (let f = 0; f < 0.999; f += 0.0005) { const g = growth(f, p, b); if (g > best) { best = g; at = f; } } return at; };
// two cards from 47 with nine hearts, counted over every pair
const deck = Array.from({ length: 47 }, (_, i) => i < 9);
let anyHeart = 0, total = 0; for (let i = 0; i < 47; i++) for (let j = i + 1; j < 47; j++) { total++; if (deck[i] || deck[j]) anyHeart++; }
const bayes = (prior, hit, miss) => prior * hit / (prior * hit + (1 - prior) * miss);
const jobs = [14, 9, 21, 12, 30, 11, 16, 25, 13, 18].sort((a, b) => a - b);
const EXPECT = {
  ways4: n((a, b) => a + b === 4),
  "four-first": n((a, b) => a + b === 4) / (n((a, b) => a + b === 4) + n((a, b) => a + b === 7)),
  neither6: n((a, b) => a !== 6 && b !== 6) / 36,
  outs: anyHeart / total,
  "both6-given-any6": n((a, b) => a === 6 && b === 6, pairs.filter(([a, b]) => a === 6 || b === 6)) / pairs.filter(([a, b]) => a === 6 || b === 6).length,
  "both6-given-first6": n((a, b) => b === 6, pairs.filter(([a]) => a === 6)) / 6,
  "ev-face": face.reduce((s, x) => s + (x === 6 ? 6 : -1), 0) / 6,
  se100: dieSd / 10,
  "cargo-gut": bayes(0.01, 0.9, 0.09),
  mispriced: bayes(0.02, 0.95, 0.05),
  late: bayes(0.05, 0.8, 0.1),
  "late-twice": bayes(0.05, 0.64, 0.01),
  "three-to-one": 0.25,
  "fair-four": 1 / 3,
  "price-odds": 500 / 1500,
  buy16: 100 * (5 / 36 - 0.16),
  "edge-face": 1 - (1 / 6) * 5,
  "edge-compare": 1 - (1 / 6) * 5,
  "pool-break": 2 / 9,
  kelly55: bestStake(0.55, 1),
  "kelly-2to1": bestStake(0.4, 2),
  kelly45: 0,
  "half-kelly": growth(0.1, 0.6) / growth(0.2, 0.6),
  "double-kelly": growth(0.4, 0.6),
  "wrong-p": growth(0.2, 0.55),
  brier90: (0.9 - 0) ** 2,
  "median-job": (jobs[4] + jobs[5]) / 2,
  "p80-job": jobs[7] + 0.2 * (jobs[8] - jobs[7]),
  crowd: Math.abs([70, 150, 90, 120, 60].reduce((s, x) => s + x, 0) / 5 - 100),
  "punt-kelly": bestStake(0.75, 1),
};
const seen = new Set();
for (const { s, where } of steps) {
  if (s.id == null || s.value == null) continue;
  seen.add(s.id);
  const want = EXPECT[s.id];
  if (want === undefined) { check(false, `${where}: ${s.id} has no recomputation`); continue; }
  // the Kelly stakes are searched on a 0.0005 grid, the rest are exact
  check(near(s.value, want, /kelly|punt/.test(s.id) ? 6e-4 : 1e-9), `${s.id}: ${s.value.toFixed(4)} recomputes to ${want.toFixed(4)}`);
}
check(Object.keys(EXPECT).every(k => seen.has(k)), "every recomputation belongs to a step, and every step with a figure has one");

// ---------- the record kept ----------
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m }; };
const st = mem();
check(readCalib(st).n === 0 && readRanges(st)[1] === 0, "nothing kept reads as an empty record");
const ids = STATEMENTS.slice(0, 4).map(x => x.id);
noteAnswer(ids[0], 90, true, st); noteAnswer(ids[1], 90, false, st); noteAnswer(ids[2], 60, true, st);
const rec = readCalib(st);
check(rec.n === 3 && rec.bins[90][0] === 1 && rec.bins[90][1] === 2 && rec.bins[60][1] === 1, "answers land in their confidence bins");
check(near(rec.brier, 0.01 + 0.81 + 0.16), "the Brier total is the sum of the squared misses");
check(rec.seen.length === 3 && rec.seen.at(-1) === ids[2], "the statements seen are remembered, latest last");
noteRange(true, st); noteRange(false, st); noteRange(true, st);
check(JSON.stringify(readRanges(st)) === "[2,3]", "ranges keep hits and tries");
st.setItem("odds:calib", "{broken"); st.setItem("odds:ranges", '"x"');
check(readCalib(st).n === 0 && readRanges(st).length === 2 && readRanges(st)[1] === 0, "a damaged record reads as empty");

// ---------- progress ----------
globalThis.localStorage = mem();
check(progressOf("odds", COURSE).done === 0 && progressOf("odds", COURSE).next.lesson.id === LESSONS[0].lesson.id, "a new learner starts at the first lesson");
localStorage.setItem("odds:course", JSON.stringify({ done: { outcomes: 1, independent: 2 }, at: 3 }));
const pr = progressOf("odds", COURSE);
check(pr.done === 2 && pr.next.lesson.id === "conditional", "progress is read from odds:course");

// ---------- folded into Maths ----------
// Odds is the last part of the Maths course and keeps what the Odds tile always kept (odds:course, odds:calib, odds:ranges),
// so a device that had progress there loses none, and the Maths tile counts the lessons of both parts once each.
check(PARTS.length === 2 && PARTS[0].course === MATHS && PARTS[1].course === COURSE && COURSE.title === "Odds and judgement", "Maths ends with the Odds part");
const MATHS_LESSONS = lessonsOf(MATHS);
check(MATHS_LESSONS.every(x => !LESSONS.some(y => y.lesson.id === x.lesson.id)), "no lesson id is in both parts");
globalThis.localStorage = mem();
localStorage.setItem("odds:course", JSON.stringify({ done: { outcomes: 1, independent: 2 }, at: { id: "conditional", step: 1 } }));
localStorage.setItem("odds:calib", JSON.stringify(rec));
localStorage.setItem("odds:ranges", "[2,3]");
const first = MATHS_LESSONS[0].lesson.id;
localStorage.setItem("maths:course", JSON.stringify({ done: { [first]: 5 }, at: null }));
let all = progressAll();
check(all.done === 3 && all.of === MATHS_LESSONS.length + LESSONS.length && all.next.part === "maths" && all.next.lesson.id === MATHS_LESSONS[1].lesson.id, "an old Odds record and a Maths one count together, once each, and Maths comes first");
check(readCalib(localStorage).n === 3 && JSON.stringify(readRanges(localStorage)) === "[2,3]" && progressOf("odds", COURSE).done === 2, "the old Odds record reads as it was");
localStorage.setItem("maths:course", JSON.stringify({ done: Object.fromEntries(MATHS_LESSONS.map(x => [x.lesson.id, 1])), at: null }));
all = progressAll();
check(all.done === MATHS_LESSONS.length + 2 && all.next.part === "odds" && all.next.lesson.id === "conditional", "with Maths done the next lesson is in the Odds part, after the two done");
localStorage.setItem("odds:course", JSON.stringify({ done: Object.fromEntries(LESSONS.map(x => [x.lesson.id, 1])), at: null }));
all = progressAll();
check(all.done === all.of && all.next === null, "every lesson of both parts done");
globalThis.localStorage = mem();
check(progressAll().done === 0 && progressAll().next.part === "maths", "a new learner starts in Maths");

// ---------- no casino ----------
const WORDS = /black\s?jack|hold.?em|craps|roulette|baccarat|casino|poker|dealer|slot machine|bookmaker|gambl/i;
const files = readdirSync(new URL("..", import.meta.url)).filter(f => /^odds.*\.(js|css|html)$/.test(f)).concat([]);
const hits = [];
for (const f of files) readFileSync(new URL(`../${f}`, import.meta.url), "utf8").split("\n").forEach((line, i) => { if (WORDS.test(line)) hits.push(`${f}:${i + 1}`); });
check(!hits.length, `no casino games named in the course${hits.length ? ": " + hits.join(" ") : ""}`);

if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("the Odds course holds");
