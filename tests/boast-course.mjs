// Boast's course (boast-course.js on course.js and course-dice.js): every exercise worked through the rules. Every cup
// and bid written is real and every step shows something; every tap exercise has as many dice to find as its words
// promise; every bid asked for can be made, its answer is judged right, every wrong bid it has words for is judged
// wrong with them, and of every bid that could be made only those the lesson means are right (one, where it asks for
// the fewest dice); every figure a lesson quotes (how many to expect, how likely a bid is) is what the binomial odds
// give from the cup it shows; the judge says why a bid doesn't follow; the course keeps its progress.
import { COURSE, judge } from "../boast-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { parseBid, parseDice, bidText, countingDice } from "../course-dice.js";
import { canFollow, cupCount, plain, most } from "../boast-rules.js";
import { atLeast } from "../boast-bot.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const LESSONS = lessonsOf(COURSE), counts = (hand, bid) => cupCount(hand, bid);

check(COURSE.chapters.map(c => c.id).join() === "game,well" && COURSE.chapters.every(c => c.title && c.zh), "two chapters, each with its Chinese name: the game, playing well");
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length, `${LESSONS.length} lessons, each with its own id`);
check(LESSONS.every(x => x.lesson.steps.length && x.lesson.title && x.lesson.zh), "every lesson has steps, a title and a Chinese name");
const last = LESSONS.at(-1).lesson;
check(last.steps.at(-1).play === true && LESSONS.every(x => x.lesson === last || x.lesson.steps.every(s => !s.play)), "the last lesson ends in a game, and only it");

let taps = 0, goals = 0, quizzes = 0, figures = 0, made = 0;
const problems = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`, seats = st.seats || 4;
  if (!st.say || /undefined/.test(st.say)) problems.push(`${where}: no words`);
  try {
    for (const r of st.rows || []) {
      if (r.dice) { if (parseDice(r.dice).length !== 5) problems.push(`${where}: a cup of ${parseDice(r.dice).length} dice`); }
      else if (r.bid) { const b = parseBid(r.bid); if (b.n > most(seats)) problems.push(`${where}: a bid on more dice than the table has`); }
      else if (!r.cups && !r.text) problems.push(`${where}: a row with nothing in it`);
    }
    for (const t of [st.prev, st.tap, st.goal ? st.answer : null]) if (t) parseBid(t);
  } catch (e) { problems.push(`${where}: ${e.message}`); return; }
  if (!(st.rows || []).length && !st.goal) problems.push(`${where}: nothing on the stage`);
  if (st.tap) {
    taps++;
    const n = countingDice(st, counts).length;
    if (!n) problems.push(`${where}: no die counts`);
    if (n !== st.count) problems.push(`${where}: ${n} dice count, the lesson says ${st.count}`);
    if (!st.then) problems.push(`${where}: no words for the end`);
  }
  if (st.goal) {
    goals++;
    const prev = parseBid(st.prev), ans = parseBid(st.answer);
    if (!judge(st, ans).ok) problems.push(`${where}: the answer ${st.answer} is judged wrong: ${judge(st, ans).why}`);
    if (!st.then) problems.push(`${where}: no words for the right bid`);
    for (const [k, words] of Object.entries(st.wrong || {})) {
      const res = judge(st, parseBid(k));
      if (res.ok || res.why !== words) problems.push(`${where}: the wrong bid ${k} isn't judged so`);
    }
    // every bid that could be made: the right ones follow the last, and are the lesson's
    const right = [];
    for (let n = 1; n <= most(seats); n++) for (let f = 1; f <= 6; f++) for (const z of [false, true]) {
      if (f === 1 && !z) continue;
      made++;
      const b = { n, f, z };
      if (judge(st, b).ok) right.push(b);
    }
    if (!right.length) problems.push(`${where}: no bid is right`);
    if (right.some(b => !canFollow(prev, b, seats))) problems.push(`${where}: a bid that can't follow is judged right`);
    if (st.goal.least && right.length !== 1) problems.push(`${where}: asks for the fewest dice, and ${right.length} bids are right`);
    if (st.goal.face && right.some(b => b.f !== st.goal.face)) problems.push(`${where}: a bid on another face is judged right`);
  }
  if (st.quiz) {
    quizzes++;
    if (!(st.quiz.length >= 2 && st.answer >= 0 && st.answer < st.quiz.length)) problems.push(`${where}: the answer isn't an option`);
    if (!st.why) problems.push(`${where}: no words for the answer`);
  }
  // the figures: from your cup (the step's first) and the dice you can't see
  const cup = (st.rows || []).find(r => r.dice), unseen = 5 * (seats - 1);
  if (st.expect) {
    figures++;
    const b = { n: 1, f: st.expect.face, z: st.expect.plain }, p = plain(b) ? 1 / 6 : 1 / 3;
    const got = counts(parseDice(cup.dice), b) + unseen * p;
    if (Math.abs(got - st.expect.shown) > 1e-9) problems.push(`${where}: expect ${got}, the lesson says ${st.expect.shown}`);
  }
  if (st.odds) {
    figures++;
    const b = st.odds.bid ? parseBid(st.odds.bid) : null, p = b && plain(b) ? 1 / 6 : 1 / 3;
    const k = b ? b.n - counts(parseDice(cup.dice), b) : st.odds.k, got = atLeast(k, unseen, p);
    if (Math.abs(got - st.odds.shown) > 0.006) problems.push(`${where}: the chance is ${got.toFixed(3)}, the lesson says ${st.odds.shown}`);
  }
});
check(!problems.length, `every exercise works: ${taps} cups to count, ${goals} bids to make (${made} bids judged), ${quizzes} questions, ${figures} figures checked against the odds`);
for (const p of problems) console.log(`     ${p}`);

// ---------- the judge's words ----------
const why = (prev, bid, goal = {}) => judge({ prev, goal }, parseBid(bid)).why;
check(why("4 6", "4 3") === "That doesn't beat four sixes: more dice, or as many of a higher face.", "a lower face at the same count");
check(why("5 4 z", "6 4") === "Back to wild ones (飞) after a plain bid takes two dice more: 7 at least.", "flying back with one die more");
check(why(null, "3 5") === "The first bid names at least 4 dice, one for each player.", "an opening under the table's count");
check(why("4 3", "6 5", { face: 5, least: true }) === "That beats it, but fewer dice would too.", "more dice than needed");
check(why("4 3", "5 5 z", { face: 5, plain: false }) === "Leave the ones wild: a plain bid counts only the face itself.", "plain where wild is asked");
check(judge({ prev: "5 6 z", goal: {} }, parseBid("5 1")).ok && bidText(parseBid("5 1")) === "5 1", "five ones follow five sixes, plain: the one above the six");

// ---------- the progress kept ----------
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
let pr = progressOf("boast", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length && pr.next.lesson.id === "cups", `nothing done yet: ${pr.done} of ${pr.of}, the first lesson next`);
store["boast:course"] = JSON.stringify({ done: { cups: 1 }, at: null });
check(progressOf("boast", COURSE).next.lesson.id === "bidding", "one lesson done: the second next");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
