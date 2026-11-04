// Cribbage's course (pegs-course.js on course.js and course-cards.js): every number a lesson states is the engine's own
// (countHand and playScore, the play and the show run through the rules), every exercise's answer is in its hand and
// judged right, wrong picks are judged wrong with the words the lesson has for them, and where a lesson teaches what the
// computer players do (the keep, the crib, which card to play, the lead) their rules choose the same from the same seat.
import { COURSE, judge, toPegs, pegsOf, keepAverage } from "../pegs-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { cardsOf, pickFrom, tokenOf } from "../course-cards.js";
import { rules, countHand, playScore, value, rankOf, playable } from "../pegs-rules.js";
import { botMove } from "../pegs-bot.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const LESSONS = lessonsOf(COURSE), STEPS = LESSONS.flatMap(x => x.lesson.steps.map((s, i) => ({ s, at: `${x.lesson.id} ${i + 1}` })));
const rng0 = () => 0;
let seed = 11;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

check(COURSE.chapters.map(c => c.id).join() === "count,play,well,game" && COURSE.chapters.every(c => c.title), "four chapters: counting, the play, playing well, a game");
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length, `${LESSONS.length} lessons, each with its own id`);
check(LESSONS.every(x => x.lesson.steps.length && x.lesson.title), "every lesson has steps and a title");
const last = LESSONS.at(-1).lesson;
check(last.steps.at(-1).play === true && LESSONS.every(x => x.lesson === last || x.lesson.steps.every(s => !s.play)), "the last lesson ends in a game, and only it");
check([...Array(52).keys()].filter(c => value(c) === 10).length === 16, "sixteen cards in 52 count ten");
check(playScore(pegsOf("4h 4s 4d")).pts === 6, "a third four after a pair pegs 6");

/** A game won in the show with the loser on `loser`: the skunk it ends with. */
function end(to, loser) {
  const g = rules.deal({ options: { to }, rng: rnd });
  g.dealer = 0; g.step = "show"; g.starter = 20; g.keep = [[4, 17, 30, 43], [0, 0, 0, 0]]; g.scores = [to - 1, loser]; g.show = { stage: 0, seat: 1, cards: [], total: 0 };
  return rules.act(rules.act(g, 0, { t: "next" }, { rng: rnd, now: 0 }), 0, { t: "next" }, { rng: rnd, now: 0 }).final.skunk;
}
/** A play as the computer players see it: you (seat 0) with your hand, the other with three cards from what's unseen. */
function playState(mine, seq) {
  const used = new Set([...mine, ...seq]), rest = [...Array(52).keys()].filter(c => !used.has(c));
  return { step: "play", dealer: 1, hands: [mine, rest.slice(0, 3)], played: [[], []], seq: seq.map((card, i) => ({ seat: i % 2, card })), starter: rest[3] };
}

// ---------- every step ----------
for (const { s, at } of STEPS) {
  let cards;
  try { cards = cardsOf(s); } catch (e) { check(false, `${at}: ${e.message}`); continue; }
  const { hand, table } = cards;
  check(typeof s.say === "string" && s.say.length > 10, `${at}: words`);
  check(new Set([...hand, ...table]).size === hand.length + table.length, `${at}: no card twice among hand and table`);
  if (s.quiz) {
    check(new Set(s.quiz).size === s.quiz.length && Number.isInteger(s.answer) && s.answer >= 0 && s.answer < s.quiz.length, `${at}: quiz options distinct, answer in range`);
    check(typeof s.why === "string" && s.why.length > 8, `${at}: quiz has its why`);
  }
  // a count: the engine's total is the quiz's answer, and the explanation is the engine's
  if (s.count) {
    const c = countHand(pegsOf(s.count.hand), pegsOf(s.count.starter)[0]);
    check(c.total === s.is && s.quiz[s.answer] === String(c.total), `${at}: counts ${c.total}`);
    check(s.why.endsWith(`Total ${c.total}.`), `${at}: explanation ends in the total`);
  }
  if (s.goal) {
    const g = s.goal, want = pickFrom(hand, s.answer);
    check(!!want && want.length > 0, `${at}: the answer is in the hand`);
    check(want && judge(s, want).ok, `${at}: the answer is judged right`);
    for (const [k, why] of Object.entries(s.wrong || {})) {
      const w = pickFrom(hand, k);
      check(w && !judge(s, w).ok && judge(s, w).why === why, `${at}: wrong pick "${k}" judged wrong with its words`);
    }
    if (g.sum) check(want.reduce((a, id) => a + value(toPegs(id)), 0) === g.sum, `${at}: the answer adds to ${g.sum}`);
  }
  // the play: a table is cards played this round, the count in its label is the sum
  if (s.table) {
    const seq = table.map(toPegs), count = seq.reduce((a, c) => a + value(c), 0);
    check(!s.tableLabel || new RegExp(`count ${count}\\b`).test(s.tableLabel), `${at}: the table's label says count ${count}`);
    if (s.pts != null && s.hand && s.quiz) {
      check(playScore([...seq, toPegs(hand[0])]).pts === s.pts && s.quiz[s.answer] === String(s.pts), `${at}: the card pegs ${s.pts}`);
    } else if (s.goal && s.pts != null) {
      const mine = hand.map(toPegs), ok = pickFrom(hand, s.answer).map(toPegs);
      const pts = c => playScore([...seq, c]).pts;
      check(ok.length === 1 && playable(mine, count).includes(ok[0]) && pts(ok[0]) === s.pts, `${at}: the answer is legal and pegs ${s.pts}`);
      check(mine.filter(c => c !== ok[0]).every(c => !playable([c], count).length || pts(c) < s.pts), `${at}: no other card pegs as much`);
      check(new RegExp(`\\b${s.pts}\\b`).test(s.then), `${at}: the words say ${s.pts}`);
      for (const k of Object.keys(s.wrong || {})) check(pickFrom(hand, k).every(c => pts(toPegs(c)) === 0), `${at}: wrong pick "${k}" pegs nothing`);
    }
    if (s.leave) {
      const bar = pickFrom(hand, Object.keys(s.wrong)[0]).map(toPegs)[0];
      check(count + value(bar) === s.leave, `${at}: the card to avoid leaves ${s.leave}`);
      for (const level of ["medium", "hard"]) {
        const m = botMove(playState(hand.map(toPegs), seq), 0, { level, rng: rng0 });
        check(m.card !== bar, `${at}: ${level} doesn't leave ${s.leave}`);
      }
    }
  }
  // the lead: the strongest computer player leads a card of the pair
  if (s.lead) {
    const m = botMove(playState(hand.map(toPegs), []), 0, { level: "hard", rng: rng0 });
    check(rankOf(m.card) === rankOf(pegsOf("4h")[0]), "the lead: Hard leads the four");
  }
  // what to throw: the computer players' crib from the same seat
  if (s.crib) {
    const mine = hand.map(toPegs), ans = pickFrom(hand, s.answer).map(toPegs).sort((a, b) => a - b);
    const dealerSeat = s.crib === "dealer" ? 0 : 1;
    const level = s.crib === "none" ? "medium" : "hard";
    const m = botMove({ step: "discard", dealer: dealerSeat, hands: [mine, []] }, 0, { level, rng: rng0 }).cards.slice().sort((a, b) => a - b);
    check(JSON.stringify(m) === JSON.stringify(ans), `${at}: ${level} throws the same two (${s.crib})`);
    if (s.crib === "none") {
      const best = Math.max(...[...Array(6).keys()].flatMap(i => [...Array(6).keys()].filter(j => j > i).map(j => keepAverage(s.hand, `${tokenOf(hand[i])} ${tokenOf(hand[j])}`))));
      check(Math.abs(keepAverage(s.hand, s.answer) - best) < 1e-9, `${at}: the answer keeps the best average`);
    }
  }
  // the cost of two cards in the other's crib: sampled with the engine (the other two cards and the starter at random)
  if (s.cribPairs) {
    const cost = s.cribPairs.map(t => {
      const two = pegsOf(t); let sum = 0, n = 3000;
      for (let k = 0; k < n; k++) {
        const pool = [...Array(52).keys()].filter(c => !two.includes(c));
        for (let i = 0; i < 3; i++) { const j = i + Math.floor(rnd() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        sum += countHand([...two, pool[0], pool[1]], pool[2], { crib: true }).total;
      }
      return sum / n;
    });
    const low = cost.indexOf(Math.min(...cost));
    check(low === s.answer && cost.filter((c, i) => i !== low).every(c => c - cost[low] > .3), `${at}: the cheapest pair is the answer (${cost.map(c => c.toFixed(1)).join(" ")})`);
  }
  // his heels: the dealer pegs 2 when the starter is a jack
  if (s.heels) {
    const deck = [...Array(52).keys()].filter(c => c !== 10);
    const g = { seats: 2, opts: { to: 121 }, scores: [0, 0], prev: [0, 0], dealer: 1, step: "discard", turn: 0, deal: 1, starter: 10, seq: [], played: [[], []], keep: [[], []],
      hands: [deck.slice(0, 6), deck.slice(6, 12)], crib: deck.slice(12, 14) };
    const r = rules.act(g, 0, { t: "crib", cards: g.hands[0].slice(0, 2) }, { rng: rnd, now: 0 });
    check(typeof r === "object" && r.step === "play" && r.scores[1] === 2 && r.scores[0] === 0, `${at}: his heels pegs 2 for the dealer`);
  }
  // the go: one for the last to play, through the rules
  if (s.go) {
    const seq = pegsOf(s.go.seq), mine = pegsOf(s.go.mine), foe = pegsOf(s.go.foe);
    const g = { seats: 2, opts: { to: 121 }, scores: [0, 0], prev: [0, 0], dealer: 1, step: "play", turn: 0, hands: [mine, foe], keep: [[], []], crib: [], played: [[], []], starter: 51, seq: seq.map((card, i) => ({ seat: i % 2, card })), deal: 1 };
    const count = seq.reduce((a, c) => a + value(c), 0);
    const r = rules.act(g, 0, { t: "play", card: mine[0] }, { rng: rnd, now: 0 });
    check(count === 24 && r.scores[0] === 1 && r.scores[1] === 0, `${at}: at 24 a 5 makes 29, nobody can play, one for go`);
  }
  // the skunk: a game won in the show, then its end
  if (s.skunk) check(end(s.skunk.to, s.skunk.loser) === s.answer, `${at}: ${s.skunk.to} to ${s.skunk.loser} is ${["no skunk", "a skunk", "a double skunk"][s.answer]}`);
}

// ---------- the skunk lines the words give ----------
{
  check(end(121, 90) === 1 && end(121, 91) === 0 && end(121, 61) === 1 && end(121, 60) === 2, "to 121: under 91 a skunk, under 61 a double");
  check(end(61, 30) === 1 && end(61, 31) === 0, "to 61: under 31 a skunk");
}

// ---------- the progress kept ----------
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
let pr = progressOf("pegs", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length && pr.next.lesson.id === "deal", `nothing done yet: ${pr.done} of ${pr.of}, the first lesson next`);
store["pegs:course"] = JSON.stringify({ done: { deal: 1, fifteens: 2 }, at: null });
pr = progressOf("pegs", COURSE);
check(pr.done === 2 && pr.next.lesson.id === "runs", "two lessons done: the third next");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
