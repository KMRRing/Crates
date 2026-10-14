// Landlord's course (landlord-course.js on course.js and course-cards.js): every exercise worked through the rules, so
// none asks for what the hand can't do. Every step's cards are real (no card twice in a pack) and it shows something;
// every play to beat is a play; every exercise's answer is in the hand and judged right, every wrong pick it has words
// for is judged wrong with those words, and of all the picks the hand allows, only those the lesson means are right;
// where a lesson teaches what the computer players do, their rules (landlord-bot.js) choose it; a bidding question's
// answer is the computer's bid, a hand counted in plays goes in that many and no fewer; the judge says why a pick
// isn't a play or doesn't beat; the course keeps its progress.
import { COURSE, judge } from "../landlord-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { cardsOf, pickFrom, keyOf, sameCards, parseCards } from "../course-cards.js";
import { readings, countsOf } from "../landlord-rules.js";
import { ruled, strength, BID_AT, LEVELS } from "../landlord-bot.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const LESSONS = lessonsOf(COURSE);
const TOK = ["3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A", "2", "SJ", "BJ"];
const textOfRanks = ranks => [...ranks].sort((a, b) => a - b).map(r => TOK[r]).join(" ");

check(COURSE.chapters.map(c => c.id).join() === "game,plays,well" && COURSE.chapters.every(c => c.title && c.zh), "three chapters, each with its Chinese name: the game, the plays, playing well");
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length, `${LESSONS.length} lessons, each with its own id`);
check(LESSONS.every(x => x.lesson.steps.length && x.lesson.title && x.lesson.zh), "every lesson has steps, a title and a Chinese name");
const last = LESSONS.at(-1).lesson;
check(last.steps.at(-1).play === true && LESSONS.every(x => x.lesson === last || x.lesson.steps.every(s => !s.play)), "the last lesson ends in a game, and only it");

// ---------- every step ----------
let goals = 0, quizzes = 0, wrongs = 0, bots = 0, bids = 0, picks = 0;
const problems = [];
/** Every pick a hand allows (as many as 2^n; the hands are small). */
function* subsets(hand) {
  for (let m = 1; m < 1 << hand.length; m++) yield hand.filter((_, i) => (m >> i) & 1);
}
/** The fewest plays a hand goes in: every subset of its counts that is a play, the lowest card always in the next. */
function fewest(c0) {
  const memo = new Map();
  const go = c => {
    if (!c.some(x => x)) return 0;
    const key = c.join(",");
    if (memo.has(key)) return memo.get(key);
    let best = Infinity;
    const lo = c.findIndex(x => x > 0), sub = Array(15).fill(0);
    const rec = r => {
      if (r === 15) { if (sub[lo] && readings(sub).length) best = Math.min(best, 1 + go(c.map((x, i) => x - sub[i]))); return; }
      for (let k = 0; k <= c[r]; k++) { sub[r] = k; rec(r + 1); }
      sub[r] = 0;
    };
    rec(0);
    memo.set(key, best);
    return best;
  };
  return go(c0.slice());
}
const NUMBER = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`;
  if (!st.say || /undefined/.test(st.say)) problems.push(`${where}: no words`);
  let cards;
  try { cards = cardsOf(st); } catch (e) { problems.push(`${where}: ${e.message}`); return; }
  const { table, hand } = cards;
  if (!(st.rows || []).length && !table.length && !hand.length) problems.push(`${where}: nothing on the stage`);
  for (const r of st.rows || []) if (r.cards == null && !r.backs && !r.text) problems.push(`${where}: a row with nothing in it`);
  const T = table.length ? readings(countsOf(table))[0] : null;
  if (table.length && !T) problems.push(`${where}: the play to beat isn't a play`);
  if (st.goal) {
    goals++;
    if (!st.then) problems.push(`${where}: no words for the right play`);
    const ans = pickFrom(hand, st.answer);
    if (!ans) problems.push(`${where}: the answer ${st.answer} isn't in the hand`);
    else if (!judge(st, ans).ok) problems.push(`${where}: the answer ${st.answer} is judged wrong: ${judge(st, ans).why}`);
    if (st.goal.beat && !T) problems.push(`${where}: asks to beat, with nothing to beat`);
    for (const [k, words] of Object.entries(st.wrong || {})) {
      wrongs++;
      const ids = pickFrom(hand, k), res = ids && judge(st, ids);
      if (!ids) problems.push(`${where}: the wrong pick ${k} isn't in the hand`);
      else if (res.ok || res.why !== words) problems.push(`${where}: the wrong pick ${k} isn't judged so`);
    }
    // of every pick the hand allows, the right ones are the lesson's
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
    // the computer players' rules, from the seat the lesson puts you in, choose what it teaches
    bots++;
    const b = st.bot, lastPlay = T || (b.last ? readings(countsOf(parseCards(b.last)))[0] : null);
    const u = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1];
    for (const id of [...hand, ...table, ...(b.last ? parseCards(b.last) : [])]) u[id >= 52 ? id - 39 : id >> 2]--;
    if (b.counts[b.me] !== hand.length) problems.push(`${where}: the seat holds ${b.counts[b.me]} cards, the hand ${hand.length}`);
    const x = { me: b.me, landlord: b.landlord, counts: b.counts, last: lastPlay, by: lastPlay ? b.by : null, cnt: countsOf(hand), u, limits: null };
    const p = ruled(x, LEVELS.medium), want = b.expect ?? st.answer;
    const same = p ? want !== "pass" && sameCards(parseCards(textOfRanks(p.ranks)), want) : want === "pass";
    if (!same) problems.push(`${where}: the computer players would play ${p ? textOfRanks(p.ranks) : "pass"}, the lesson ${want}`);
  }
  if (st.bid != null) {
    bids++;
    const s = strength(countsOf(hand)), bid = s >= BID_AT[2] ? 3 : s >= BID_AT[1] ? 2 : s >= BID_AT[0] ? 1 : 0;
    if (hand.length !== 17) problems.push(`${where}: a bidding hand of ${hand.length}`);
    if (bid !== st.bid) problems.push(`${where}: the computer would bid ${bid} (strength ${s.toFixed(2)}), the lesson ${st.bid}`);
    if (st.quiz[st.answer] !== (st.bid ? `Bid ${st.bid}` : "Pass")) problems.push(`${where}: the answer isn't the bid`);
  }
  if (st.plays != null) {
    const n = fewest(countsOf(hand));
    if (n !== st.plays) problems.push(`${where}: the hand goes in ${n} plays, the lesson says ${st.plays}`);
    if (st.quiz[st.answer] !== NUMBER[st.plays]) problems.push(`${where}: the answer isn't the count`);
  }
});
check(!problems.length, `every exercise works: ${goals} plays to make (${picks} picks judged, ${wrongs} wrong picks with words), ${quizzes} questions, ${bots} as the computer players choose, ${bids} bids`);
for (const p of problems) console.log(`     ${p}`);

// ---------- the judge's words ----------
const step = (table, hand, goal) => ({ table, hand, goal, then: "Right." });
const why = (st, text) => judge(st, pickFrom(cardsOf(st).hand, text)).why;
check(why(step("9 9", "4 4 J J 2", { beat: true }), "2") === "That's a single. To beat a pair, play a higher pair.", "a single on a pair: that's a single, play a higher pair");
check(why(step("9 9", "4 4 J J 2", { beat: true }), "4 4") === "That doesn't beat it: it has to be higher.", "a lower pair: it has to be higher");
check(why(step("4 5 6 7 8", "6 7 8 9 T J", { beat: true }), "6 7 8 9 T J") === "It has to be as long: five cards.", "a longer straight: it has to be as long");
check(/goes by its own rank/.test(why(step("8 8 8 A", "7 7 7 K 2", { beat: true }), "7 7 7 K")), "a lower three with a higher kicker: a three goes by its own rank");
check(/four with two, not a bomb/.test(why(step("2 2", "5 6 6 6 6 9", { beat: true }), "5 6 6 6 6 9")), "four with two on a pair: that isn't a bomb");
check(why(step("2 2 2 2", "3 3 3 3 A", { beat: true }), "3 3 3 3") === "A bomb beats a bomb only if it's higher.", "a lower bomb on a bomb");
check(why(step(null, "J Q K A 2", { any: true }), "J Q K A 2") === "Twos and jokers can't be in a straight.", "a two in a straight");
check(why(step(null, "2 SJ", { any: true }), "2 SJ") === "A joker pairs only with the other joker, as the rocket.", "a joker with a two");
check(why(step(null, "3 4 5 6 8", { any: true }), "3 4 5 6 8") === "A straight's cards run in a row, with no gaps.", "a straight with a gap");
check(why(step(null, "7 7 7 3 9", { any: true }), "7 7 7 3 9") === "Three alike take one card along, or one pair.", "three with two singles");
check(why(step(null, "5 5", { type: "straight" }), "5 5") === "That's a pair: play a straight.", "a pair where a straight is asked for");

// ---------- the progress kept ----------
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
let pr = progressOf("landlord", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length && pr.next.lesson.id === "sides", `nothing done yet: ${pr.done} of ${pr.of}, the first lesson next`);
store["landlord:course"] = JSON.stringify({ done: { sides: 1, order: 2 }, at: null });
pr = progressOf("landlord", COURSE);
check(pr.done === 2 && pr.next.lesson.id === "basic", "two lessons done: the third next");
store["landlord:course"] = "{not json";
check(progressOf("landlord", COURSE).done === 0, "a spoilt record reads as nothing done");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
