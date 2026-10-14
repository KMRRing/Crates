// Big Two's course (bigtwo-course.js on course.js and course-cards.js): every exercise worked through the rules, so
// none asks for what the hand can't do. Every card is written with its suit (suits matter here) and real, no card
// twice in a pack, and every step shows something; every play to beat is a play; every exercise's answer is in the
// hand and judged right, every wrong pick it has words for is judged wrong with those words, and of all the picks the
// hand allows, only those the lesson means are right; where a lesson teaches what the computer players do, their
// rules (bigtwo-bot.js, Medium) choose it from the same seat; a hand counted in plays goes in that many and no fewer;
// the judge says why a pick isn't a play or doesn't beat; the course keeps its progress.
import { COURSE, judge } from "../bigtwo-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { cardsOf, pickFrom, keyOf, sameCards, parseCards } from "../course-cards.js";
import { classify, allPlays, DEFAULTS } from "../bigtwo-rules.js";
import { botMove } from "../bigtwo-bot.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const O = DEFAULTS, LESSONS = lessonsOf(COURSE);

check(COURSE.chapters.map(c => c.id).join() === "game,fives,well" && COURSE.chapters.every(c => c.title && c.zh), "three chapters, each with its Chinese name: the game, five-card hands, playing well");
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length, `${LESSONS.length} lessons, each with its own id`);
check(LESSONS.every(x => x.lesson.steps.length && x.lesson.title && x.lesson.zh), "every lesson has steps, a title and a Chinese name");
const last = LESSONS.at(-1).lesson;
check(last.steps.at(-1).play === true && LESSONS.every(x => x.lesson === last || x.lesson.steps.every(s => !s.play)), "the last lesson ends in a game, and only it");

/** A table as the computer players see it: you in your seat with your hand, the others' counts dealt from what's left. */
function state(st, hand, table) {
  const b = st.bot, taken = new Set([...hand, ...table]), rest = [];
  for (let c = 0; c < 52; c++) if (!taken.has(c)) rest.push(c);
  let k = 0;
  const hands = b.counts.map((n, i) => (i === b.me ? hand : rest.slice(k, (k += n))));
  return { seats: b.counts.length, opts: O, hands, played: [...table], trick: { plays: [], last: table.length ? { ...classify(table, O), cards: table } : null, by: table.length ? b.by : null, passes: 0 }, turn: b.me, mustLead: null, scores: b.counts.map(() => 0), deal: 1 };
}
/** The fewest plays a hand goes in (its lowest card always in the next play, so each split comes once). */
function fewest(hand) {
  const memo = new Map();
  const go = cards => {
    if (!cards.length) return 0;
    const key = cards.join(",");
    if (!memo.has(key)) {
      const lo = Math.min(...cards);
      let best = Infinity;
      for (const p of allPlays(cards, O)) if (p.cards.includes(lo)) best = Math.min(best, 1 + go(cards.filter(c => !p.cards.includes(c))));
      memo.set(key, best);
    }
    return memo.get(key);
  };
  return go([...hand].sort((a, b) => a - b));
}
function* subsets(hand) { for (let m = 1; m < 1 << hand.length; m++) yield hand.filter((_, i) => (m >> i) & 1); }
const NUMBER = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const texts = st => [st.table, st.hand, ...(st.rows || []).map(r => r.cards)].filter(t => t != null);

let goals = 0, quizzes = 0, wrongs = 0, bots = 0, picks = 0;
const problems = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`;
  if (!st.say || /undefined/.test(st.say)) problems.push(`${where}: no words`);
  for (const t of texts(st)) for (const tok of String(t).split(/\s+/).filter(Boolean)) if (!/^[2-9TJQKA][dchs]$/.test(tok)) problems.push(`${where}: "${tok}" has no suit`);
  let cards;
  try { cards = cardsOf(st); } catch (e) { problems.push(`${where}: ${e.message}`); return; }
  const { table, hand } = cards;
  if (!(st.rows || []).length && !table.length && !hand.length) problems.push(`${where}: nothing on the stage`);
  const T = table.length ? classify(table, O) : null;
  if (table.length && !T) problems.push(`${where}: the play to beat isn't a play`);
  if (st.goal) {
    goals++;
    if (!st.then) problems.push(`${where}: no words for the right play`);
    const ans = pickFrom(hand, st.answer);
    if (!ans) problems.push(`${where}: the answer ${st.answer} isn't in the hand`);
    else if (!judge(st, ans).ok) problems.push(`${where}: the answer ${st.answer} is judged wrong: ${judge(st, ans).why}`);
    for (const [k, words] of Object.entries(st.wrong || {})) {
      wrongs++;
      const ids = pickFrom(hand, k), res = ids && judge(st, ids);
      if (!ids) problems.push(`${where}: the wrong pick ${k} isn't in the hand`);
      else if (res.ok || res.why !== words) problems.push(`${where}: the wrong pick ${k} isn't judged so`);
    }
    const right = [];
    for (const ids of subsets(hand)) { picks++; if (judge(st, ids).ok) right.push(ids); }
    if (!right.length) problems.push(`${where}: no pick is right`);
    const unmeant = st.goal.cards ? right.filter(ids => ![].concat(st.goal.cards).some(k => sameCards(ids, k))) : [];
    if (unmeant.length) problems.push(`${where}: a pick it doesn't mean is judged right: ${unmeant.map(keyOf).join(" / ")}`);
  }
  if (st.quiz) {
    quizzes++;
    if (!(st.quiz.length >= 2 && st.answer >= 0 && st.answer < st.quiz.length)) problems.push(`${where}: the answer isn't an option`);
    if (!st.why) problems.push(`${where}: no words for the answer`);
  }
  if (st.bot) {
    bots++;
    if (st.bot.counts[st.bot.me] !== hand.length) problems.push(`${where}: the seat holds ${st.bot.counts[st.bot.me]} cards, the hand ${hand.length}`);
    if (st.next === 1 && st.bot.counts[(st.bot.me + 1) % st.bot.counts.length] !== 1) problems.push(`${where}: 頂大's player after you doesn't hold one card`);
    const m = botMove(state(st, hand, table), st.bot.me, { level: "medium" }), want = st.bot.expect ?? st.answer;
    const same = m.t === "pass" ? want === "pass" : want !== "pass" && sameCards(m.cards, want);
    if (!same) problems.push(`${where}: the computer players would play ${m.t === "pass" ? "pass" : keyOf(m.cards)}, the lesson ${want}`);
  }
  if (st.plays != null) {
    const n = fewest(hand);
    if (n !== st.plays) problems.push(`${where}: the hand goes in ${n} plays, the lesson says ${st.plays}`);
    if (st.quiz[st.answer] !== NUMBER[st.plays]) problems.push(`${where}: the answer isn't the count`);
  }
});
check(!problems.length, `every exercise works: ${goals} plays to make (${picks} picks judged, ${wrongs} wrong picks with words), ${quizzes} questions, ${bots} as the computer players choose`);
for (const p of problems) console.log(`     ${p}`);

// ---------- the judge's words ----------
const step = (table, hand, goal, extra = {}) => ({ table, hand, goal, then: "Right.", ...extra });
const why = (st, text) => judge(st, pickFrom(cardsOf(st).hand, text)).why;
check(why(step("9h", "9d 9s", { beat: true }), "9d") === "One rank: the suit decides, diamonds lowest, then clubs, hearts and spades.", "a lower suit of the same rank");
check(why(step("9d 9h", "9c 5d 5h", { beat: true }), "9c") === "Play a pair: as many cards as the play to beat.", "a single on a pair: as many cards");
check(/full house goes by its three/.test(why(step("6c 6h 6s 3d 3c", "5d 5c 5h Ad As", { beat: true }), "5d 5c 5h Ad As")), "a lower full house with a higher pair: it goes by its three");
check(/A straight doesn't beat a flush/.test(why(step("3h 7h 9h Jh Kh", "Td Jc Qd Kc Ad", { beat: true }), "Td Jc Qd Kc Ad")), "a straight on a flush: the order of the kinds");
check(why(step(null, "Jd Qc Kh As 2d", { any: true }), "Jd Qc Kh As 2d") === "No straight goes round the corner from the king through the ace to the two.", "round the corner");
check(why(step(null, "Qd Qc Qh Qs", { any: true }), "Qd Qc Qh Qs") === "Four cards aren't a play: four of a kind goes with a fifth card.", "four alone");
check(why(step(null, "3d 4c 9s", { must: "3d" }), "9s") === "The first play must have the 3♦ in it.", "the first play without the three of diamonds");
check(why(step("5c", "7d Kh As", { beat: true }, { next: 1 }), "7d") === "頂大: the next player has one card, so a single must be your highest.", "頂大");
check(judge(step("5c", "7d Kh As", { beat: true }, { next: 1 }), parseCards("As")).ok, "頂大: your highest single is right");

// ---------- the progress kept ----------
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
let pr = progressOf("bigtwo", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length && pr.next.lesson.id === "deal", `nothing done yet: ${pr.done} of ${pr.of}, the first lesson next`);
store["bigtwo:course"] = JSON.stringify({ done: { deal: 1, order: 2, basic: 3 }, at: null });
pr = progressOf("bigtwo", COURSE);
check(pr.done === 3 && pr.next.lesson.id === "trick", "three lessons done: the fourth next");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
