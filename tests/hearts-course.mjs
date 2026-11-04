// Hearts' course (hearts-course.js on course.js and course-cards.js), every example worked through the rules: every card
// written with its suit and real, no card twice on the table and in the hand, every exercise's answer in the hand and
// judged right, every wrong pick it has words for judged wrong with them, and of all the picks the hand allows only
// those the lesson means judged right; the tricks and points the questions ask are worked out by the rules; what the
// lessons say of the pass, hearts, the first trick and the moon is checked on the engine; where a lesson teaches what the
// computer players do (hearts-bot.js, Medium), they choose it from the same seat; the course keeps its progress.
import { COURSE, judge, stateOf, toId } from "../hearts-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { cardsOf, pickFrom, keyOf, sameCards } from "../course-cards.js";
import { rules, legalCards, whyNot, trickWinner, sumPoints, handResult, playCard, dirOf, pointsOf, cardName, QUEEN_SPADES, TWO_CLUBS, HEARTS } from "../hearts-rules.js";
import { chooseCard, passCards } from "../hearts-bot.js";
import { newRecord, applyMove } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const LESSONS = lessonsOf(COURSE);
const ids = text => cardsOf({ hand: text }).hand;                // course ids of a written pack
const hid = text => ids(text).map(toId);

check(COURSE.chapters.map(c => c.id).join() === "game,well", "two chapters: the game, playing well");
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length, `${LESSONS.length} lessons, each with its own id`);
check(LESSONS.every(x => x.lesson.steps.length && x.lesson.title), "every lesson has steps and a title");
const last = LESSONS.at(-1).lesson;
check(last.steps.at(-1).play === true && LESSONS.every(x => x.lesson === last || x.lesson.steps.every(s => !s.play)), "the last lesson ends in a game, and only it");

/** The state Medium sees at a step: your hand, the cards played to the trick and the points taken so far, the rest dealt to the others. */
function botState(st) {
  const { me, s } = stateOf(st), took = [[], [], [], []];
  if (st.moon != null) took[st.moon] = hid(st.rows[0].cards);
  const used = new Set([...s.hands[me], ...s.trick.plays.map(p => p.card), ...took.flat()]);
  const rest = Array.from({ length: 52 }, (_, i) => i).filter(c => !used.has(c));
  let k = 0;
  const hands = s.hands.map((h, i) => (i === me ? h : rest.slice(k, (k += 3))));
  return { me, s: { ...s, hands, played: [...used].filter(c => !s.hands[me].includes(c)), voids: [0, 0, 0, 0], took, won: [0, 0, 0, 0], opts: { moon: "add" } } };
}
function* subsets(hand, n) {
  for (let m = 1; m < 1 << hand.length; m++) { const pick = hand.filter((_, i) => (m >> i) & 1); if (pick.length === n) yield pick; }
}

let goals = 0, quizzes = 0, wrongs = 0, picks = 0, bots = 0, tricks = 0;
const problems = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`;
  if (!st.say || /undefined/.test(st.say)) problems.push(`${where}: no words`);
  for (const t of [st.table, st.hand, ...(st.rows || []).map(r => r.cards)].filter(t => t != null)) {
    for (const tok of String(t).split(/\s+/).filter(Boolean)) if (!/^[2-9TJQKA][dchs]$/.test(tok)) problems.push(`${where}: "${tok}" has no suit`);
  }
  let cards;
  try { cards = cardsOf(st); (st.rows || []).forEach(r => r.cards != null && cardsOf({ hand: r.cards })); } catch (e) { problems.push(`${where}: ${e.message}`); return; }
  const { table, hand } = cards;
  if (!(st.rows || []).length && !table.length && !hand.length && !st.quiz && !st.play) problems.push(`${where}: nothing on the stage`);
  if (st.goal) {
    goals++;
    if (!st.then) problems.push(`${where}: no words for the right pick`);
    const n = st.goal.pass ? 3 : 1;
    if (st.goal.pass ? hand.length < 3 : !hand.length) problems.push(`${where}: no hand to pick from`);
    const ans = pickFrom(hand, st.answer);
    if (!ans) problems.push(`${where}: the answer ${st.answer} isn't in the hand`);
    else if (!judge(st, ans).ok) problems.push(`${where}: the answer ${st.answer} is judged wrong: ${judge(st, ans).why}`);
    for (const [k, words] of Object.entries(st.wrong || {})) {
      wrongs++;
      const pk = pickFrom(hand, k), res = pk && judge(st, pk);
      if (!pk) problems.push(`${where}: the wrong pick ${k} isn't in the hand`);
      else if (res.ok || res.why !== words) problems.push(`${where}: the wrong pick ${k} isn't judged so`);
    }
    // of every pick of the right size: right only if the rules allow it and the lesson lists it
    const { me, s } = stateOf(st);
    for (const pk of subsets(hand, n)) {
      picks++;
      const meant = [].concat(st.goal.cards).some(k => sameCards(pk, k)), res = judge(st, pk);
      if (res.ok !== meant) problems.push(`${where}: ${keyOf(pk)} is judged ${res.ok ? "right" : "wrong"}, the lesson ${meant ? "means it" : "doesn't"}`);
    }
    // the computer players choose what the lesson teaches
    if (!st.goal.pass) {
      bots++;
      const b = botState(st), want = pickFrom(hand, st.answer)?.map(toId);
      const got = chooseCard(b.s, b.me, "medium");
      if (!want || got !== want[0]) problems.push(`${where}: the computer players would play ${cardName(got)}, the lesson ${st.answer}`);
    } else {
      bots++;
      const got = passCards(hand.map(toId), "medium"), want = pickFrom(hand, st.answer).map(toId).sort((a, b) => a - b);
      if ([...got].sort((a, b) => a - b).join() !== want.join()) problems.push(`${where}: the computer players would pass ${got.map(cardName).join(" ")}, the lesson ${st.answer}`);
    }
  }
  if (st.quiz) {
    quizzes++;
    if (!(st.quiz.length >= 2 && st.answer >= 0 && st.answer < st.quiz.length)) problems.push(`${where}: the answer isn't an option`);
    if (!st.why) problems.push(`${where}: no words for the answer`);
    if (new Set(st.quiz).size !== st.quiz.length) problems.push(`${where}: an option twice`);
  }
  if (st.trick) {
    tricks++;
    const plays = hid(st.trick.plays).map((card, seat) => ({ seat, card }));
    const shown = (st.rows || []).map(r => r.cards).join(" ");
    if (shown !== st.trick.plays) problems.push(`${where}: the trick shown isn't the one worked out`);
    const w = trickWinner(plays), pts = sumPoints(plays.map(p => p.card));
    if (st.trick.win != null && (w !== st.trick.win || st.quiz[st.answer] !== cardName(plays[w].card))) problems.push(`${where}: the winner is ${cardName(plays[w].card)} (play ${w}), the lesson ${st.quiz[st.answer]}`);
    if (st.trick.pts != null && (pts !== st.trick.pts || st.quiz[st.answer] !== String(pts) || trickWinner(plays) !== plays.findIndex(p => p.seat === w))) problems.push(`${where}: the trick is worth ${pts}, the lesson ${st.trick.pts} / ${st.quiz[st.answer]}`);
  }
});
check(!problems.length, `every exercise works: ${goals} plays to make (${picks} picks judged, ${wrongs} wrong picks with words, ${bots} as the computer players choose), ${quizzes} questions, ${tricks} tricks worked out`);
for (const p of problems) console.log(`     ${p}`);

// ---------- what the lessons say, on the engine ----------
{
  const all = Array.from({ length: 52 }, (_, i) => i);
  check(sumPoints(all) === 26 && all.filter(c => pointsOf(c)).length === 14 && pointsOf(QUEEN_SPADES) === 13, "26 points in a hand: thirteen hearts and the Q♠ for thirteen");
  check([1, 2, 3, 4, 5, 6, 7, 8].map(dirOf).join() === "left,right,across,hold,left,right,across,hold", "the pass runs left, right, across, none");
  for (const { lesson: l } of LESSONS) for (const st of l.steps) if (st.deal) check(dirOf(st.deal) === st.dir && st.quiz[st.answer] === { left: "Left", right: "Right", across: "Across", hold: "Nobody" }[st.dir], `hand ${st.deal} passes ${st.dir}`);
  // a pass goes to the neighbour the lesson names
  const G = newRecord(rules, { seats: 4, options: {}, seed: 7, now: 0 });
  let R = G;
  const gives = G.state.hands.map(h => h.slice(0, 3));
  for (let i = 0; i < 4; i++) { R = applyMove(rules, R, i, { t: "give", cards: gives[i] }, 0).G ?? R; }
  check(R.state.step === "play" && gives[0].every(c => R.state.hands[1].includes(c)), "the first hand's pass goes to the left (the next seat)");
  // the lead, the first trick and hearts
  const st = { hands: [[TWO_CLUBS, 9, 30]], done: 0, broken: false, trick: { plays: [] } };
  check(legalCards(st, 0).join() === String(TWO_CLUBS), "the 2♣ alone leads the first trick");
  const onlyHearts = { hands: [[2 * 4 + 2, 5 * 4 + 2]], done: 3, broken: false, trick: { plays: [] } };
  check(legalCards(onlyHearts, 0).length === 2, "a hand of hearts only may lead one though they aren't broken");
  const allPoints = { hands: [[QUEEN_SPADES, 3 * 4 + 2]], done: 0, broken: true, trick: { plays: [{ seat: 3, card: TWO_CLUBS }] } };
  check(legalCards(allPoints, 0).length === 2, "on the first trick, a hand of nothing but points may play any");
  const qs = { hands: [[], [], [QUEEN_SPADES], []], voids: [0, 0, 0, 0], played: [], broken: false, trick: { plays: [{ seat: 1, card: 4 * 4 + 1 }] }, turn: 2 };
  playCard(qs, 2, QUEEN_SPADES);
  check(qs.broken === false, "the Q♠ on a club trick doesn't break hearts");
  // the moon, both ways
  const shot = o => handResult({ took: [[...Array.from({ length: 13 }, (_, i) => i * 4 + HEARTS), QUEEN_SPADES], [], [], []], opts: { moon: o } });
  check(shot("add").delta.join() === "0,26,26,26" && shot("sub").delta.join() === "-26,0,0,0", "a moon: the shooter 0 and the others +26, or the shooter −26");
  check(LESSONS.some(x => x.lesson.steps.some(s => s.quiz?.[s.answer] === "26" && /moon|every heart/.test(s.say))), "the moon question's answer is 26");
}

// ---------- the progress kept ----------
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
let pr = progressOf("hearts", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length && pr.next.lesson.id === "deal", `nothing done yet: ${pr.done} of ${pr.of}, the first lesson next`);
store["hearts:course"] = JSON.stringify({ done: { deal: 1, pass: 2 }, at: null });
pr = progressOf("hearts", COURSE);
check(pr.done === 2 && pr.next.lesson.id === "tricks", "two lessons done: the third next");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
