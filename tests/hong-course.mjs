// Mahjong's course (hong-lessons.js on course.js, hong-course.js its stage and judges): every exercise is put to the
// referee (hong-engine.js), so none can disagree with the game. Every table a step describes is a table the game
// could deal (no tile more than four times, thirteen tiles in the hand); every pick, button and discard is judged as
// the engine says, the one answer right and the rest wrong with words; every claim button the lesson means is legal and
// applies; the figures the words quote are the engine's; a question's answer is what the engine gives; the stage takes
// every exercise to its end by taps on a page of plain objects; the course keeps its progress.
import { COURSE } from "../hong-lessons.js";
import * as H from "../hong-course.js";
import * as E from "../hong-engine.js";
import { lessonsOf, progressOf } from "../course.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const LESSONS = lessonsOf(COURSE);

check(COURSE.chapters.map(c => c.id).join() === "game,play,score,well" && COURSE.chapters.every(c => c.title && c.zh), "four chapters, each with its Chinese name: the game, playing a hand, scoring, a little strategy");
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length && LESSONS.length >= 14 && LESSONS.length <= 20, `${LESSONS.length} lessons, each with its own id`);
check(LESSONS.every(x => x.lesson.steps.length && x.lesson.title && x.lesson.zh), "every lesson has steps, a title and a Chinese name");
const last = LESSONS.at(-1).lesson;
check(last.steps.at(-1).play === true && LESSONS.every(x => x.lesson === last || x.lesson.steps.every(s => !s.play)), "the last lesson ends in a game, and only it");
check(LESSONS.every(x => x.lesson.steps.length <= 6), "no lesson runs past six steps");

const problems = [];
let tables = 0, picks = 0, taps = 0, discards = 0, quizzes = 0, proofs = 0;
const subsets = n => Array.from({ length: 1 << n }, (_, m) => [...Array(n).keys()].filter(i => (m >> i) & 1));
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`, bug = what => problems.push(`${where}: ${what}`);
  if (!st.say || /undefined/.test(st.say)) bug("no words");
  if (st.play) return;
  if (!(st.hand != null || st.rows)) bug("shows nothing");
  for (const r of st.rows || []) { try { if (r.tiles) H.tilesOf(r.tiles); for (const m of r.melds || []) H.meldOf(m); } catch (e) { bug(e.message); } if (!r.tiles && !r.text && !r.melds) bug("an empty row"); }
  if (st.quiz) {
    quizzes++;
    if (!(st.quiz.length >= 2 && st.answer >= 0 && st.answer < st.quiz.length) || !st.why) bug("the answer isn't an option, or has no words");
    if (!st.check) bug("no check by the referee");
    else if (String(st.check()) !== st.quiz[st.answer]) bug(`the referee says ${st.check()}, not ${st.quiz[st.answer]}`);
  }
  if (st.proves) { proofs++; if (!st.proves()) bug("a figure in the words isn't the referee's"); }
  if (st.hand == null) return;
  // the table is one the game could deal
  let s;
  try { s = H.sceneOf(st); } catch (e) { bug(e.message); return; }
  tables++;
  const all = [...H.handShown(st), ...(st.melds || []).flatMap(m => H.meldTiles(H.meldOf(m))), ...Object.values(st.others || {}).flatMap(t => H.tilesOf(t)), ...(st.discard ? H.tilesOf(st.discard) : []), ...(st.rob ? H.tilesOf(st.rob) : []), ...H.tilesOf(st.flowers)];
  if (!st.cands) {
    const c = E.counts(all.filter(k => k < 34));
    if (c.some(n => n > 4)) bug("a tile more than four times");
    if (H.tilesOf(st.flowers).length !== new Set(H.tilesOf(st.flowers)).size) bug("a flower twice");
  }
  const held = H.handShown(st).length + (st.melds || []).length * 3;
  if (st.goal === "pair") { if (held !== 14) bug(`${held} tiles, not 14`); }
  else if (!["tiles", "set"].includes(st.goal) && held !== (st.goal === "waits" || st.discard || st.rob ? 13 : 14)) bug(`${held} tiles in the hand`);
  // each goal
  const hand = H.handShown(st);
  if (st.goal === "pair") {
    picks++;
    const right = H.pairsOf(hand, 0);
    if (right.length !== 1) bug("not exactly one possible pair");
    for (const sel of subsets(hand.length).filter(x => x.length === 2)) if (H.judgePick(st, sel).ok !== (hand[sel[0]] === hand[sel[1]] && right.includes(hand[sel[0]]))) bug("a pair judged wrongly");
    if (!st.then) bug("no words for the right pick");
  } else if (st.goal === "tiles" || st.goal === "waits") {
    picks++;
    const n = st.goal === "waits" ? H.tilesOf(st.cands).length : hand.length, right = H.rightPicks(st);
    if (!right.length) bug("nothing to pick");
    if (st.goal === "waits") {
      const w = new Set(H.waitsOf(hand, (st.melds || []).length));
      const cands = H.tilesOf(st.cands);
      if (!cands.every((k, j) => w.has(k) === right.includes(j))) bug("the waits aren't the referee's");
      if (!cands.some(k => !w.has(k)) || cands.length > 8) bug("the candidates need wrong ones, and no more than eight");
    }
    for (const sel of subsets(n)) if (sel.length && H.judgePick(st, sel).ok !== (sel.length === right.length && sel.every(j => right.includes(j)))) bug("a pick judged wrongly");
    if (!st.then) bug("no words for the right pick");
  } else if (st.goal === "set") {
    picks++;
    const found = H.findSet(st);
    if (!found || !H.judgePick(st, found).ok) bug("no set to pick");
    for (const sel of subsets(hand.length).filter(x => x.length === 3)) { const t = H.setOf(sel.map(j => hand[j])); if (H.judgePick(st, sel).ok !== (t === st.want)) bug("a set judged wrongly"); }
  } else if (st.goal === "discard") {
    discards++;
    const right = H.rightDiscards(st);
    if (!right.length) bug("no right discard");
    if (new Set(hand).size === right.length) bug("every discard is right");
    for (const k of new Set(hand)) { const r = H.judgeDiscard(st, k); if (r.ok !== right.includes(k)) bug(`${E.tileName(k)} is judged ${r.ok ? "right" : "wrong"}`); if (!r.ok && !r.why) bug("no words for a wrong discard"); }
    if (!st.then || !st.why) bug("no words");
    if (st.crit === "waits" && right.length !== 1) bug("the widest wait isn't one tile");
  } else if (["claim", "fan", "pay", "taker"].includes(st.goal)) {
    taps++;
    const opts = H.optionsOf(st), ans = H.answerOf(st);
    if (!opts.includes(ans)) bug(`the answer ${ans} isn't among the buttons`);
    if (opts.length < 2) bug("fewer than two buttons");
    for (const o of opts) {
      const r = H.judgeTap(st, o);
      if (r.ok !== (o === ans)) bug(`${o} is judged ${r.ok ? "right" : "wrong"}`);
      if (!r.ok && !r.why) bug(`no words for ${o}`);
    }
    if (st.goal === "claim") {
      const legal = H.legalNames(s);
      if (!legal.includes(st.answer)) bug(`${st.answer} isn't legal here`);
      // applied through the referee, it goes in
      const t = JSON.parse(JSON.stringify(s)), a = E.legal(t, 0).find(x => H.legalNames(t) && (x.t === st.answer.toLowerCase()));
      try { if (!a) bug("no action to apply"); else E.act(t, 0, a); } catch (e) { bug(`the referee refuses it: ${e.message}`); }
      for (const o of opts) if (o !== st.answer && !legal.includes(o) && !H.whyNot(s, o)) bug(`no reason for ${o}`);
    }
    if (st.goal === "fan" && H.scoreAt(s).fan < 3) bug("a winning hand under three fan");
    if (!st.then) bug("no words for the right answer");
  } else if (st.goal) bug(`a goal the stage doesn't know: ${st.goal}`);
});
check(!problems.length, `every step works: ${tables} tables, ${picks} picks, ${discards} discards, ${taps} buttons, ${quizzes} questions, ${proofs} figures proved`);
for (const p of problems) console.log(`     ${p}`);

// ---------- the referee's rulings the lessons lean on ----------
const hasStep = (id, f) => LESSONS.find(x => x.lesson.id === id).lesson.steps.find(f);
const base = E.BASE.slice(1, 11).join(" ");
check(hasStep("pay", s => s.rows).rows[1].text === base, `the table of bases in the words is the referee's: ${base}`);
const chow = hasStep("chow", s => s.goal === "claim" && s.from === 2), sc = H.sceneOf(chow);
check(!H.legalNames(sc).includes("Chow") && /after the one who threw/.test(H.whyNot(sc, "Chow")), "a chow from across isn't legal, and the words say whose it is");
const dealer = E.deal({ seed: 11, dealer: 0, round: 0, opts: H.OPTS });
check(dealer.seats[0].hand.length === 14 && dealer.seats[1].hand.length === 13 && E.DEFAULTS.minFan === 3 && E.DEFAULTS.cap === 10 && E.DEFAULTS.flowers === true, "the course teaches the game's defaults: 14 and 13 tiles, three fan, ten the cap, flowers");
const ors = H.sceneOf({ hand: "1m 9m 1p 9p 1s 9s E S W N Rd Gd Wd", draw: "1m" });
check(H.scoreAt(ors).fan === 10 && H.scoreAt(ors).limit, "thirteen orphans pay the cap, as a limit hand");
const own = H.sceneOf({ hand: "F1", dealer: 2 });
check(E.windOf(own, 0) === 2 && H.tilesOf("F3")[0] === 34 + 2 && H.tilesOf("F7")[0] === 38 + 2, "West's own flower is the third, and season the third");

// ---------- the stage, tapped through ----------
// a page of plain objects: the stage draws into a box, reads taps from one handler
function fakeBox() {
  const box = { innerHTML: "", clientWidth: 360, clientHeight: 300, listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, querySelector: () => null };
  return box;
}
const tap = (box, sel, data) => box.listeners.click({ target: { closest: s => (s === sel ? { dataset: data } : null) } });
let driven = 0;
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  if (!st.goal) return;
  const where = `${l.id} step ${i + 1}`, box = fakeBox(), stage = H.tileStage(), got = [];
  stage.mount(box, { changed: () => stage.draw(st, state), answer: r => got.push(r) });
  const state = { done: false, tries: 0, hint: false, msg: "", picked: null };
  stage.draw(st, state);
  if (!stage.task(st)) { bad++; console.log(`FAIL ${where}: not a task`); return; }
  if (!box.innerHTML.includes("hk-t")) { bad++; console.log(`FAIL ${where}: no tiles drawn`); return; }
  const hand = H.handShown(st);
  if (stage.submits(st)) {
    stage.hint(st, state);
    const res = stage.submit(st, state);
    if (!stage.ready(st, state) || !res.ok) { bad++; console.log(`FAIL ${where}: Hint doesn't pick the answer (${res.why || ""})`); return; }
    // tapping a tile picks it and puts it back
    const clickable = box.innerHTML.includes("data-i=");
    state.sel = new Set();
    if (clickable) { tap(box, "[data-i]", { i: "0" }); if (!state.sel.has(0)) { bad++; console.log(`FAIL ${where}: a tap doesn't pick`); return; } tap(box, "[data-i]", { i: "0" }); if (state.sel.has(0)) { bad++; console.log(`FAIL ${where}: a second tap doesn't put it back`); return; } }
  } else if (st.goal === "discard") {
    const k = H.rightDiscards(st)[0];
    tap(box, "[data-i]", { i: String(hand.indexOf(k)), k: String(k) });
    if (!got.at(-1)?.ok) { bad++; console.log(`FAIL ${where}: the right discard isn't taken`); return; }
  } else {
    const ans = H.answerOf(st);
    tap(box, "[data-o]", { o: ans });
    if (!got.at(-1)?.ok) { bad++; console.log(`FAIL ${where}: the right button isn't taken`); return; }
    const wrong = H.optionsOf(st).find(o => o !== ans);
    tap(box, "[data-o]", { o: wrong });
    if (got.at(-1)?.ok) { bad++; console.log(`FAIL ${where}: a wrong button is taken`); return; }
  }
  driven++;
});
check(driven === LESSONS.flatMap(x => x.lesson.steps).filter(s => s.goal).length, `the stage takes all ${driven} exercises to their end by taps`);

// ---------- the progress kept ----------
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
let pr = progressOf("hong", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length && pr.next.lesson.id === "game", `nothing done yet: ${pr.done} of ${pr.of}, the first lesson next`);
store["hong:course"] = JSON.stringify({ done: { game: 1, tiles: 2, deal: 3 }, at: null });
pr = progressOf("hong", COURSE);
check(pr.done === 3 && pr.next.lesson.id === "turn", "three lessons done: the fourth next");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
