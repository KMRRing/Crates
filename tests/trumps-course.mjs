// Trumps' course (trumps-course.js: Learn Schafkopf, on course.js): every exercise worked through the rules
// (trumps-games.js). Every card written is real and no step shows one twice between the trick and the hand; every tap
// exercise has as many cards to find as its words promise; every card to play is legal and judged right, every wrong
// one it has words for judged wrong with them, and of the cards the hand may play only the meant ones are right; every
// trick a question shows is taken by the card its answer names; the points, the Sau you may call and what a hand pays
// are the rules' own; Playing well's positions could have been played, and each card it asks for is the best when the
// cards you can't see are dealt every way they could lie and played out; the stage takes every exercise to its end by
// taps; the course keeps its progress.
import { COURSE, parseCards, tokenOf, cardWords, tableOf, cardsOf, wantedOf, judge, contractOf, cardStage, playedOf, positionOf } from "../trumps-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { GAMES, laufende, sTrump } from "../trumps-games.js";
import { cid, deckFrom } from "../trumps-cards.js";
import { weigh, fittingDeal } from "../trumps-solve.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const S = GAMES.schafkopf, LESSONS = lessonsOf(COURSE);

check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length && LESSONS.every(x => x.lesson.steps.length && x.lesson.title), `${LESSONS.length} lessons, each with its own id, steps and a title`);
const ends = COURSE.chapters.map(c => c.lessons.at(-1));
check(ends.every(l => l.steps.at(-1).play === true) && LESSONS.every(x => (ends.includes(x.lesson) ? x.lesson.steps.slice(0, -1) : x.lesson.steps).every(s => !s.play)), "each chapter ends in a game, and nothing else does");

let taps = 0, plays = 0, judged = 0, quizzes = 0, tricks = 0;
const problems = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`;
  if (!st.say) problems.push(`${where}: no words`);
  let cards;
  try { cards = cardsOf(st); contractOf(st); } catch (e) { problems.push(`${where}: ${e.message}`); return; }
  if (cards.trick.some(id => cards.hand.includes(id))) problems.push(`${where}: a card both in the trick and in the hand`);
  if (cards.trick.length > 3) problems.push(`${where}: a trick of ${cards.trick.length} with you still to play`);
  if (!(st.rows || []).length && !cards.hand.length && !st.play) problems.push(`${where}: nothing on the stage`);
  for (const r of st.rows || []) if (!r.cards && !r.text) problems.push(`${where}: a row with nothing in it`);
  if (st.tap) {
    taps++;
    const n = wantedOf(st).length;
    if (n !== st.count) problems.push(`${where}: ${n} cards to find, the lesson says ${st.count}`);
    if (!st.then) problems.push(`${where}: no words for the end`);
  }
  if (st.answer != null && !st.quiz) {
    plays++;
    const t = tableOf(st), legal = S.legal(t, 0), right = new Set([st.answer, ...(st.accept || [])]);
    if (!legal.includes(parseCards(st.answer)[0])) problems.push(`${where}: the answer ${st.answer} can't be played`);
    for (const [tok, words] of Object.entries(st.wrong || {})) {
      const res = judge(st, parseCards(tok)[0]);
      if (res.ok || res.why !== words) problems.push(`${where}: the wrong card ${tok} isn't judged so`);
    }
    for (const id of legal) { judged++; if (judge(st, id).ok !== right.has(tokenOf(id))) problems.push(`${where}: ${tokenOf(id)} is judged ${judge(st, id).ok ? "right" : "wrong"}`); }
    if (!st.then) problems.push(`${where}: no words for the right card`);
  }
  if (st.quiz) {
    quizzes++;
    if (!(st.quiz.length >= 2 && st.answer >= 0 && st.answer < st.quiz.length) || !st.why) problems.push(`${where}: the answer isn't an option, or has no words`);
    // a whole trick shown: the card the answer names takes it
    const full = (st.rows || []).map((r, k) => cards.rows[k]).find(r => r && r.length === 4);
    if (full && st.quiz.every(o => /^The /.test(o))) {
      tricks++;
      const c = contractOf(st), win = full[S.winner({ contract: c }, full.map((card, k) => ({ seat: k, card })))];
      if (st.quiz[st.answer] !== `The ${cardWords(win)}`) problems.push(`${where}: the ${cardWords(win)} takes it, the answer says ${st.quiz[st.answer]}`);
    }
  }
});
check(!problems.length, `every step works: ${taps} hands to tap through, ${plays} cards to play (${judged} judged), ${quizzes} questions (${tricks} tricks taken)`);
for (const p of problems) console.log(`     ${p}`);

// ---------- the figures ----------
const step = (id, f) => LESSONS.find(x => x.lesson.id === id).lesson.steps.find(f);
const pts = ids => ids.reduce((a, id) => a + S.points({}, id), 0);
const counted = step("cards", s => s.quiz);
check(String(pts(cardsOf(counted).rows[0])) === counted.quiz[counted.answer] && pts(deckFrom("7")) === 120, `points: the trick counts ${pts(cardsOf(counted).rows[0])}, the pack 120`);
const call = step("sauspiel", s => s.callable);
check(S.callable(parseCards(call.hand)).sort().join() === [...call.callable].sort().join(), "the Sau the hand may call: the rules' callable");
const pay = step("count", s => s.outcome), o = pay.outcome, held = parseCards(o.held);
const dealt = [held, [], [cid(0, "Q")], []], c = { type: o.type, declarer: 0, partner: 1, trump: 1, ace: 2 };
const r = S.scoreHand({ contract: c, dealt, tricks: [{ winner: 0, pts: o.pts[0] }, { winner: 2, pts: o.pts[1] }], scores: [0, 0, 0, 0], opts: { tariff: 10, solo: 50 } });
check(String(r.amount) === pay.quiz[pay.answer] && r.schneider && laufende(c, dealt, [0, 1]) === 3, `a Sauspiel won ${o.pts.join(" to ")} with three Laufende: each loser pays ${r.amount}`);
check(parseCards("EO GA H10 S7").map(tokenOf).join(" ") === "EO GA H10 S7" && cardWords(cid(3, "Q")) === "Eichel-Ober" && cardWords(cid(0, "7")) === "Schellen-Siebener", "cards as Bavarians write and say them");
let threw = false;
try { parseCards("EO EO"); } catch { threw = true; }
check(threw, "a card written twice is refused");

// ---------- playing well ----------
// A position from play shows one pack (every card once among the tricks, the trick and the hand, eight less the tricks
// in the hand), each trick led by whoever took the last, and a deal of the cards you can't see under which every card
// played was legal (trumps-solve.js: the voids shown, the call, the called Sau's rules). Its card to play is the best
// when those cards are dealt out 300 ways and each deal played to the end: an eighth of a game and three standard
// errors of the difference clear of every card not accepted, and every card accepted within that eighth. A question
// counting the trumps out has the position's own count.
const MARGIN = 0.125, WORDS = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
let seed = 20261015;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const deep = [], weak = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  if (st.played == null) return;
  const where = `${l.id} step ${i + 1}`, tricksPlayed = playedOf(st), trick = parseCards(st.trick), hand = parseCards(st.hand);
  const seen = [...tricksPlayed.flatMap(t => t.cards.map(x => x.card)), ...trick, ...hand];
  if (new Set(seen).size !== seen.length || hand.length !== 8 - tricksPlayed.length) { weak.push(`${where}: not one pack, or the hand the wrong size`); return; }
  const leads = [...tricksPlayed.map(t => t.cards[0].seat), (4 - trick.length) % 4];
  if (leads.some((seat, k) => k && seat !== tricksPlayed[k - 1].winner)) weak.push(`${where}: a trick not led by whoever took the last`);
  const s = positionOf(st);
  if (!fittingDeal(s, 0, rng, 400)) weak.push(`${where}: no deal of the cards you can't see fits the play so far`);
  if (st.count === "trumps") {
    const out = deckFrom("7").filter(id => sTrump(s.contract, id) && !seen.includes(id)).length;
    if (st.quiz[st.answer] !== WORDS[out]) weak.push(`${where}: ${out} trumps out, the answer says ${st.quiz[st.answer]}`);
  }
  if (st.answer == null || st.quiz) return;
  deep.push(where);
  const list = weigh(s, 0, { deals: 300, rng }), right = new Set([st.answer, ...(st.accept || [])]), best = list[0];
  if (!right.has(tokenOf(best.card))) { weak.push(`${where}: ${tokenOf(best.card)} does best (${best.worth.toFixed(2)}), not ${st.answer}`); return; }
  for (const x of list.slice(1)) {
    const d = best.vals.map((v, j) => v - x.vals[j]), m = d.reduce((a, b) => a + b, 0) / d.length;
    const se = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / (d.length - 1) / d.length);
    if (right.has(tokenOf(x.card))) { if (m >= MARGIN) weak.push(`${where}: ${tokenOf(x.card)} is accepted, ${m.toFixed(2)} below the best`); }
    else if (m < MARGIN || m - 3 * se < 0) weak.push(`${where}: ${st.answer} beats ${tokenOf(x.card)} by only ${m.toFixed(2)} (±${se.toFixed(2)})`);
  }
});
check(!weak.length && deep.length >= 8, `Playing well: ${deep.length} cards to play, each the best of the hand when the cards you can't see are dealt out 300 ways and played to the end`);
for (const p of weak) console.log(`     ${p}`);

// ---------- the stage, tapped through ----------
function fakeBox() { const on = {}; return { innerHTML: "", addEventListener: (k, f) => { on[k] = f; }, on }; }
const tapOn = id => ({ target: { closest: sel => (sel.includes(".lc-hand") ? { dataset: { id: String(id) } } : null) } });
let walked = 0;
const stuck = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((s, i) => {
  if (!(s.tap || (s.answer != null && !s.quiz))) return;
  const where = `${l.id} step ${i + 1}`, stage = cardStage(), box = fakeBox(), t = { done: false };
  let res = null;
  stage.mount(box, { changed: () => stage.draw(s, t), answer: x => { res = x; if (x.ok) t.done = true; stage.draw(s, t); } });
  stage.draw(s, t);
  if (!/lc-hand/.test(box.innerHTML)) stuck.push(`${where}: no hand drawn`);
  if (s.tap) {
    const want = wantedOf(s), miss = tableOf(s).hands[0].find(id => !want.includes(id));
    if (miss != null) { box.on.click(tapOn(miss)); if (res?.ok !== false) stuck.push(`${where}: a wrong card isn't a miss`); }
    for (const id of want) box.on.click(tapOn(id));
    if (!res?.ok || !t.done) stuck.push(`${where}: finding every card doesn't end it`);
  } else {
    const want = {};
    stage.hint(s, want);
    box.on.click(tapOn(want.sel));
    if (t.sel !== want.sel || !stage.ready(s, t) || !/^Play the /.test(stage.label(s, t))) stuck.push(`${where}: a tap doesn't pick the card`);
    if (!stage.submit(s, t).ok) stuck.push(`${where}: the hint's card is judged wrong`);
    t.done = true;
    stage.draw(s, t);
  }
  walked++;
});
check(!stuck.length && walked === taps + plays, `the stage takes all ${walked} exercises to their end by taps`);
for (const p of stuck) console.log(`     ${p}`);

// ---------- the progress kept ----------
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const pr = progressOf("trumps", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length && pr.next.lesson.id === LESSONS[0].lesson.id, `nothing done yet: ${pr.done} of ${pr.of}`);

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
