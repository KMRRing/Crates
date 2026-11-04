// Guandan's course (tribute-lessons.js on course.js, tribute-course.js its stage and judges): every exercise is put to
// the referee (tribute-engine.js), so none can disagree with the game. Every table is one two decks could deal (no card
// written more than twice); every pick is judged as the engine says (all subsets of the hand tried, only the plays
// the lesson means right, the rest wrong with words); a hand a lesson asks to be beaten can be; every question's answer
// is what the engine gives; the stage takes every exercise to its end by taps on a page of plain objects; the course
// keeps its progress.
import { COURSE } from "../tribute-lessons.js";
import * as T from "../tribute-course.js";
import * as E from "../tribute-engine.js";
import { lessonsOf, progressOf } from "../course.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const LESSONS = lessonsOf(COURSE);

check(COURSE.chapters.map(c => c.id).join() === "game,plays,match,well" && COURSE.chapters.every(c => c.title && c.zh), "four chapters, each with its Chinese name: the game, the plays, a hand and a match, a little strategy");
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length && LESSONS.length >= 14 && LESSONS.length <= 20, `${LESSONS.length} lessons, each with its own id`);
check(LESSONS.every(x => x.lesson.steps.length && x.lesson.title && x.lesson.zh && x.lesson.steps.length <= 6), "every lesson has steps (six at most), a title and a Chinese name");
const last = LESSONS.at(-1).lesson;
check(last.steps.at(-1).play === true && LESSONS.every(x => x.lesson === last || x.lesson.steps.every(s => !s.play)), "the last lesson ends in a game, and only it");

const problems = [];
let tables = 0, picks = 0, taps = 0, quizzes = 0, proofs = 0;
const subsets = n => Array.from({ length: (1 << n) - 1 }, (_, m) => [...Array(n).keys()].filter(i => ((m + 1) >> i) & 1));
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`, bug = what => problems.push(`${where}: ${what}`);
  if (!st.say || /undefined/.test(st.say)) bug("no words");
  if (st.play) return;
  if (!(st.hand != null || st.rows)) bug("shows nothing");
  for (const r of st.rows || []) { try { if (r.cards) T.cardsOf(r.cards); } catch (e) { bug(e.message); } if (!r.cards && !r.text) bug("an empty row"); }
  if (st.quiz) {
    quizzes++;
    if (!(st.quiz.length >= 2 && st.answer >= 0 && st.answer < st.quiz.length) || !st.why) bug("the answer isn't an option, or has no words");
    if (!st.check) bug("no check by the referee");
    else if (String(st.check()) !== st.quiz[st.answer]) bug(`the referee says ${st.check()}, not ${st.quiz[st.answer]}`);
  }
  if (st.proves) { proofs++; if (!st.proves()) bug("a figure in the words isn't the referee's"); }
  if (st.hand == null) return;
  let t;
  try { t = T.tableOf(st); } catch (e) { bug(e.message); return; }
  tables++;
  if (t.hand.length > 12 && !st.handLabel) bug("a hand too long to show");
  if (st.top && !t.topReading) bug("the play to beat isn't a play");
  const n = t.hand.length;
  if (st.goal === "tiles" || st.goal === "play") {
    picks++;
    const right = T.answerPick(st);
    if (!right?.length) { bug("nothing to pick"); return; }
    if (n > 12) bug("too many cards to try every pick");
    for (const sel of subsets(n)) {
      const r = T.judgePick(st, sel);
      if (!r.ok && !r.why) bug("no words for a wrong pick");
    }
    if (!T.judgePick(st, right).ok) bug("the pick Hint shows isn't judged right");
    if (st.goal === "play") {
      // only plays of the wanted kind that beat the play to beat are right
      const oks = subsets(n).filter(sel => T.judgePick(st, sel).ok);
      for (const sel of oks) { const r = E.readingFor(sel.map(j => t.hand[j]), t.level, t.topReading); if (!r) bug("a right pick that isn't a play"); }
      if (!st.then) bug("no words for the right pick");
    }
  } else if (["high", "tribute", "return"].includes(st.goal)) {
    taps++;
    const right = T.rightCards(st);
    if (!right.length || right.length === n) bug("no right card, or every card is");
    for (let j = 0; j < n; j++) { const r = T.judgeCard(st, j); if (r.ok !== right.includes(j)) bug(`card ${j} judged ${r.ok ? "right" : "wrong"}`); if (!r.ok && !r.why) bug("no words"); }
    if (st.goal === "tribute" && t.hand.some(c => E.isWild(c, t.level)) === false) bug("a tribute hand without a wild card to avoid");
  } else if (st.goal === "choose") {
    taps++;
    if (!st.options.includes(st.answer) || st.options.length < 2) bug("the answer isn't a button");
    for (const o of st.options) { const r = T.judgeChoice(st, o); if (r.ok !== (o === st.answer)) bug(`${o} judged wrongly`); if (!r.ok && !r.why) bug("no words"); }
    if (!st.proves) bug("a choice that the referee doesn't back");
  } else if (st.goal) bug(`a goal the stage doesn't know: ${st.goal}`);
});
check(!problems.length, `every step works: ${tables} tables, ${picks} picks, ${taps} taps, ${quizzes} questions, ${proofs} figures proved`);
for (const p of problems) console.log(`     ${p}`);

// ---------- the referee's rulings the lessons lean on ----------
check(E.DEFAULTS.tribute === true && E.partnerOf(1) === 3 && E.HEARTS === 1, "the course teaches the game's rules: tribute on, partners opposite, hearts wild");
check(T.finishWith([0, 2]).gain === 3 && T.finishWith([0, 1, 2, 3]).gain === 2 && T.finishWith([0, 1, 3, 2]).gain === 1, "a one-two rises three, first and third two, first and last one");
const ret = T.tableOf({ level: 8, hand: "3s 5h 10d Jc Kd 8c 9s 2h 4d Qh" });
check(E.returnable(ret.hand, 8).every(c => E.rankOf(c) <= 10 && E.rankOf(c) !== 8), "a returned card is a 10 or lower, never a level card");
check(!E.returnable(T.cardsOf("Js Qh BJ"), 8).some(c => E.isJoker(c)) && E.returnable(T.cardsOf("Js Qh BJ"), 8).length > 0, "with nothing low, the lowest goes back");

// ---------- the stage, tapped through ----------
function fakeBox() { return { innerHTML: "", clientWidth: 360, clientHeight: 300, listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, querySelector: () => null }; }
const tap = (box, sel, data) => box.listeners.click({ target: { closest: s => (s === sel ? { dataset: data } : null) } });
let driven = 0;
const wanted = LESSONS.flatMap(x => x.lesson.steps).filter(s => s.goal).length;
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  if (!st.goal) return;
  const where = `${l.id} step ${i + 1}`, box = fakeBox(), stage = T.cardStage(), got = [], state = { done: false, tries: 0, hint: false, msg: "", picked: null };
  stage.mount(box, { changed: () => stage.draw(st, state), answer: r => got.push(r) });
  stage.draw(st, state);
  const fail = what => { bad++; console.log(`FAIL ${where}: ${what}`); };
  if (!stage.task(st)) return fail("not a task");
  if (!box.innerHTML.includes("tb-card") && st.goal !== "choose") return fail("no cards drawn");
  if (stage.submits(st)) {
    stage.hint(st, state);
    if (!stage.ready(st, state) || !stage.submit(st, state).ok) return fail("Hint doesn't pick the answer");
    state.sel = new Set();
    tap(box, "[data-i]", { i: "0" });
    if (!state.sel.has(0)) return fail("a tap doesn't pick");
    tap(box, "[data-i]", { i: "0" });
    if (state.sel.has(0)) return fail("a second tap doesn't put it back");
  } else if (["high", "tribute", "return"].includes(st.goal)) {
    tap(box, "[data-i]", { i: String(T.rightCards(st)[0]) });
    if (!got.at(-1)?.ok) return fail("the right card isn't taken");
  } else {
    tap(box, "[data-o]", { o: st.answer });
    if (!got.at(-1)?.ok) return fail("the right button isn't taken");
    tap(box, "[data-o]", { o: st.options.find(o => o !== st.answer) });
    if (got.at(-1)?.ok) return fail("a wrong button is taken");
  }
  driven++;
});
check(driven === wanted, `the stage takes all ${driven} exercises to their end by taps`);

// ---------- the progress kept ----------
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
let pr = progressOf("tribute", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length && pr.next.lesson.id === "game", `nothing done yet: ${pr.done} of ${pr.of}, the first lesson next`);
store["tribute:course"] = JSON.stringify({ done: { game: 1, cards: 2, wild: 3 }, at: null });
pr = progressOf("tribute", COURSE);
check(pr.done === 3 && pr.next.lesson.id === "deal", "three lessons done: the fourth next");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
