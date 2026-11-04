// Gin rummy's course (meld-course.js on course.js and course-cards.js): every number it states is the engine's. Each
// deadwood count, each best throw, each knock, undercut, gin and big gin is recomputed with meld-rules.js; every
// exercise's answer is judged right and, of all the picks the hand allows, only what the lesson means is; where the
// lesson teaches what a computer player does, the Hard player's rules choose it too; the course keeps its progress.
import fs from "node:fs";
import { COURSE, judge, toGin, fromGin, ginOf, show, meldKind } from "../meld-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { cardsOf, pickFrom, keyOf, sameCards } from "../course-cards.js";
import { rules, deadCount, arrangements, bestLayoff, pts, short, rankOf, BONUS, TO } from "../meld-rules.js";
import { botMove } from "../meld-bot.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const LESSONS = lessonsOf(COURSE);
const rng = () => 0.3;

check(COURSE.chapters.map(c => c.id).join() === "game,turn,score", "three chapters: the game, a turn, scoring and play");
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length && LESSONS.length === 10, `${LESSONS.length} lessons, each with its own id`);
check(LESSONS.every(x => x.lesson.steps.length && x.lesson.title), "every lesson has steps and a title");
const last = LESSONS.at(-1).lesson;
check(last.steps.at(-1).play === true && LESSONS.every(x => x.lesson === last || x.lesson.steps.every(s => !s.play)), "the last lesson ends in a game, and only it");
check(COURSE.chapters[0].lessons[0].steps.some(s => s.say.includes(String(BONUS.big)) && s.say.includes(String(BONUS.undercut)) && s.say.includes(String(TO[1]))), "lesson one says the variant: the bonuses and the game's length");
check(ginOf("Ad 2c Ks Td").join() === [0, 13 + 1, 39 + 12, 9].join() && [...Array(52).keys()].every(i => toGin(fromGin(i)) === i), "course-cards' cards translate to the rules' (ace low) and back");
check(show("Ts 4h") === "10♠ 4♥", "cards shown as read");

const subsets = ids => { const out = []; for (let m = 1; m < 1 << ids.length; m++) out.push(ids.filter((_, i) => m & (1 << i))); return out; };
const gin = text => ginOf(text);
const sameSet = (a, b) => a.length === b.length && a.every(c => b.includes(c));
const outsOf = hand => { const base = deadCount(hand), o = []; for (let c = 0; c < 52; c++) if (!hand.includes(c) && deadCount([...hand, c]) < base + pts(c)) o.push(c); return o; };
const best11 = hand => Math.min(...hand.map(c => deadCount(hand.filter(x => x !== c))));

/** A hand knocked, played through the rules from a state both hands were set into. */
function play(sc) {
  const s = rules.deal({ options: {}, rng }), kh = gin(sc.k), fh = gin(sc.f);
  s.hands = [kh, fh]; s.turn = 0; s.step = "discard"; delete s.took;
  const used = new Set([...kh, ...fh]), rest = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
  s.discard = [rest.pop()]; s.stock = rest;
  return rules.act(s, 0, { t: "knock", card: sc.card ? gin(sc.card)[0] : null }, { rng, now: 0 });
}

const problems = [];
let goals = 0, picks = 0, wrongs = 0, quizzes = 0, facts = 0, bots = 0, scenes = 0;
LESSONS.forEach(({ lesson }) => lesson.steps.forEach((st, i) => {
  const where = `${lesson.id} ${i + 1}`;
  if (!st.say) problems.push(`${where}: no words`);
  let cards;
  try { cards = cardsOf(st); } catch (e) { problems.push(`${where}: ${e.message}`); return; }
  const hand = cards.hand.map(toGin);
  if (new Set(hand).size !== hand.length) problems.push(`${where}: a card twice`);
  if (!st.play && !st.quiz && !(st.rows || []).length && !hand.length) problems.push(`${where}: nothing on the stage`);
  for (const r of st.rows || []) if (!(r.cards || r.backs || r.text)) problems.push(`${where}: a row with nothing`);

  if (st.goal) {
    goals++;
    const g = Object.keys(st.goal)[0], need = g === "throw" || g === "knock" || g === "gin" ? 11 : g === "cards" && st.goal.cards.length < 4 && hand.length === 11 ? 11 : null;
    if (need && hand.length !== need) problems.push(`${where}: a throw is asked of ${hand.length} cards`);
    const ans = pickFrom(cards.hand, st.answer);
    if (!ans) problems.push(`${where}: the answer ${st.answer} isn't in the hand`);
    else if (!judge(st, ans).ok) problems.push(`${where}: the answer ${st.answer} is judged wrong: ${judge(st, ans).why}`);
    for (const [k, words] of Object.entries(st.wrong || {})) {
      wrongs++;
      const ids = pickFrom(cards.hand, k), res = ids && judge(st, ids);
      if (!ids) problems.push(`${where}: the wrong pick ${k} isn't in the hand`);
      else if (res.ok || res.why !== words) problems.push(`${where}: the wrong pick ${k} isn't judged so`);
    }
    const right = [];
    for (const ids of subsets(cards.hand)) { picks++; if (judge(st, ids).ok) right.push(ids); }
    const key = a => a.map(toGin).sort().join();
    const meant = [];
    if (st.goal.meld) {
      for (const ids of right) {
        const gi = ids.map(toGin), k = meldKind(gi);
        // independently: a meld is cards whose own least deadwood is none
        if (deadCount(gi) !== 0 || gi.length < 3 || (st.goal.meld !== true && k !== st.goal.meld) || (st.goal.n && gi.length !== st.goal.n)) problems.push(`${where}: ${keyOf(ids)} judged a ${st.goal.meld} and isn't`);
      }
      // …and every such meld in the hand is judged right
      for (const ids of subsets(cards.hand)) {
        const gi = ids.map(toGin);
        if (deadCount(gi) === 0 && gi.length >= 3 && meldKind(gi) === (st.goal.meld === true ? meldKind(gi) : st.goal.meld) && (!st.goal.n || gi.length === st.goal.n) && !right.some(r => key(r) === key(ids))) problems.push(`${where}: the meld ${keyOf(ids)} is judged wrong`);
      }
    } else if (st.goal.rest) {
      if (!arrangements(hand, 40).some(a => sameSet(a.rest, ans.map(toGin)))) problems.push(`${where}: the answer isn't the deadwood`);
      if (arrangements(hand, 1)[0].dead !== st.dead) problems.push(`${where}: deadwood ${arrangements(hand, 1)[0].dead}, the lesson ${st.dead}`);
      for (const r of right) if (!arrangements(hand, 40).some(a => sameSet(a.rest, r.map(toGin)))) problems.push(`${where}: a pick that isn't the deadwood is right`);
    } else if (st.goal.throw || st.goal.knock || st.goal.gin) {
      const want = hand.filter(c => deadCount(hand.filter(x => x !== c)) === best11(hand) && (!st.goal.gin || best11(hand) === 0));
      if (st.goal.gin && best11(hand) !== 0) problems.push(`${where}: no throw goes gin`);
      if (st.goal.knock && best11(hand) > 10) problems.push(`${where}: no throw knocks`);
      if (st.goal.knock && hand.filter(c => deadCount(hand.filter(x => x !== c)) <= 10).length < 2) problems.push(`${where}: only one throw knocks, so the best-knock rule isn't exercised`);
      if (right.length !== want.length || !right.every(r => r.length === 1 && want.includes(toGin(r[0])))) problems.push(`${where}: the right throws are ${right.map(keyOf)}, the engine's ${want.map(short)}`);
      if (want.length !== 1) problems.push(`${where}: the best throw isn't one card`);
    } else if (st.goal.lay) {
      const melds = st.rows.filter(r => r.meld).map(r => gin(r.cards)), lay = bestLayoff(hand, melds).lay;
      if (right.length !== 1 || !sameSet(right[0].map(toGin), lay)) problems.push(`${where}: the right layoff isn't the engine's`);
      if (!sameSet(gin(st.scene.lay), lay)) problems.push(`${where}: the scene's layoff isn't the engine's`);
    } else if (st.goal.cards) {
      if (right.length !== 1 || !sameCards(right[0], st.goal.cards)) problems.push(`${where}: the right picks aren't just ${st.goal.cards}`);
    }
    if (!st.then && !st.goal.throw && !st.goal.gin && !st.goal.lay) problems.push(`${where}: no words for the right pick`);
  }

  if (st.quiz) {
    quizzes++;
    if (!(st.quiz.length >= 2 && st.answer >= 0 && st.answer < st.quiz.length)) problems.push(`${where}: the answer isn't an option`);
    if (!st.why) problems.push(`${where}: no words for the answer`);
    if (st.options) {
      st.options.forEach((o, k) => { if ((deadCount(gin(o)) === 0) !== (k === st.answer)) problems.push(`${where}: option ${o} is${k === st.answer ? "n't" : ""} a meld`); });
    }
  }

  // ---- the engine's facts
  if (st.dead != null && !st.goal) {
    facts++;
    if (deadCount(hand) !== st.dead) problems.push(`${where}: deadwood ${deadCount(hand)}, the lesson ${st.dead}`);
    if (st.quiz && st.quiz[st.answer] !== String(st.dead)) problems.push(`${where}: the answer isn't the count`);
  }
  if (st.bigGin && !(hand.length === 11 && deadCount(hand) === 0)) problems.push(`${where}: not a big gin`);
  if (st.gain != null) {
    facts++;
    const pile = gin(st.rows[0].cards)[0], h = [...hand, pile], got = deadCount(hand) - Math.min(...h.filter(c => c !== pile).map(c => deadCount(h.filter(x => x !== c))));
    if (got !== st.gain) problems.push(`${where}: taking saves ${got}, the lesson ${st.gain}`);
    if ((got >= 2) !== (st.answer === 0)) problems.push(`${where}: the answer doesn't follow from the saving (Hard takes at 2)`);
    const s = { step: "draw", hands: [hand, []], discard: [pile], mustStock: false };
    if ((botMove(s, 0, { level: "hard" }).t === "pile") !== (st.answer === 0)) problems.push(`${where}: Hard would ${st.answer === 0 ? "draw" : "take"}`);
  }
  if (st.ways) {
    facts++;
    for (const w of st.ways) {
      const m = gin(w.meld);
      if (!m.every(c => hand.includes(c)) || deadCount(m) !== 0) problems.push(`${where}: ${w.meld} isn't a meld of the hand`);
      else if (deadCount(hand.filter(c => !m.includes(c))) !== w.dead) problems.push(`${where}: ${w.meld} leaves ${deadCount(hand.filter(c => !m.includes(c)))}, the lesson ${w.dead}`);
    }
    if (Math.min(...st.ways.map(w => w.dead)) !== deadCount(hand) || st.ways[st.answer].dead !== deadCount(hand)) problems.push(`${where}: the answer isn't the better meld`);
  }
  if (st.outs) {
    facts++;
    const buried = gin(st.outs.buried), left = outsOf(hand).filter(c => !buried.includes(c));
    if (left.length !== st.outs.count || st.quiz[st.answer] !== String(left.length)) problems.push(`${where}: ${left.length} cards still complete, the lesson ${st.outs.count}`);
    if (!outsOf(hand).includes(buried[0])) problems.push(`${where}: the buried card doesn't complete anything`);
  }
  if (st.bot) {
    bots++;
    const foe = (st.rows || []).find(r => /took from the pile/.test(r.label)), grabs = foe ? gin(foe.cards) : [];
    const used = new Set([...hand, ...grabs]), others = [];
    for (let c = 0; c < 52 && others.length < 10; c++) if (!used.has(c)) others.push(c);
    const s = { step: "discard", turn: 0, hands: [hand, others], grabs: [[], grabs], discard: [51, 50, 49, 48], stock: Array(20).fill(0), took: undefined };
    const m = botMove(s, 0, { level: "hard", rng });
    if (m.t !== "discard" || m.card !== gin(st.bot)[0]) problems.push(`${where}: Hard would throw ${m.card != null ? short(m.card) : m.t}, the lesson ${st.bot}`);
  }
  if (st.scene) {
    scenes++;
    const sc = st.scene, r = play(sc);
    if (typeof r === "string") { problems.push(`${where}: the scene is refused: ${r}`); return; }
    const x = r.result;
    if (x.kind !== sc.kind || x.winner !== sc.winner || x.points !== sc.points || x.dead.join() !== sc.dead.join()) problems.push(`${where}: the rules score ${x.kind} to ${x.winner} for ${x.points} (${x.dead}), the lesson ${sc.kind} ${sc.winner} ${sc.points} (${sc.dead})`);
    if (!sameSet(x.lay, gin(sc.lay || ""))) problems.push(`${where}: the cards laid off aren't the lesson's`);
    const shown = (st.rows || []).filter(r => r.meld).flatMap(r => gin(r.cards));
    if (shown.length) {
      const theirs = x.melds[x.by].flat().filter(c => !x.lay.includes(c));
      if (!sameSet(shown, theirs)) problems.push(`${where}: the melds shown aren't the knocker's`);
    }
    if (st.hand && !sameSet(hand, gin(sc.f))) problems.push(`${where}: the hand shown isn't the other player's`);
    if (st.quiz && st.quiz[st.answer] !== String(sc.points)) problems.push(`${where}: the answer isn't the points scored`);
  }
}));
check(!problems.length, `every exercise works: ${goals} picks to make (${picks} picks judged, ${wrongs} wrong picks with words), ${quizzes} questions, ${facts} counts, ${scenes} hands scored, ${bots} as Hard plays`);
for (const p of problems) console.log(`     ${p}`);

// ---------- the rules the lessons state ----------
{
  const s = rules.deal({ options: {}, rng }), non = 1 - s.dealer;
  rules.act(s, non, { t: "pass" }, { rng, now: 0 });
  rules.act(s, s.dealer, { t: "pass" }, { rng, now: 0 });
  check(s.step === "draw" && s.mustStock && s.turn === non && typeof rules.act(s, non, { t: "pile" }, { rng, now: 0 }) === "string", "both pass: the first player draws from the stock");
  const t = rules.deal({ options: {}, rng });
  rules.act(t, 1 - t.dealer, { t: "take" }, { rng, now: 0 });
  check(typeof rules.act(t, t.turn, { t: "discard", card: t.took }, { rng, now: 0 }) === "string", "the card taken from the pile can't be thrown back");
  const w = rules.deal({ options: {}, rng });
  w.step = "discard"; w.turn = 0; w.stock = w.stock.slice(0, 2); w.took = undefined;
  const r = rules.act(w, 0, { t: "discard", card: w.hands[0][0] }, { rng, now: 0 });
  check(r.result?.kind === "wash" && r.result.points === 0, "the stock down to two cards: a draw, nobody scores");
  check(typeof play({ k: "8d 8c 8h 4s 5s 6s 7s Kc Kd Qs Jd", f: "8s 3s 9h 9c 9d 4h 5h 6h Kh 2d", card: "Jd" }) === "string", "knocking with more than 10 left over is refused");
  check(deadCount(gin("Qs Ks As")) === 21 && deadCount(gin("Ad 2d 3d")) === 0, "Q-K-A isn't a run, A-2-3 is");
}

// ---------- the progress kept ----------
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
let pr = progressOf("meld", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length && pr.next.lesson.id === "aim", `nothing done yet: ${pr.done} of ${pr.of}, the first lesson next`);
store["meld:course"] = JSON.stringify({ done: { aim: 1, melds: 2 }, at: null });
pr = progressOf("meld", COURSE);
check(pr.done === 2 && pr.next.lesson.id === "deadwood", "two lessons done: the third next");

// ---------- the page ----------
const js = fs.readFileSync(new URL("../meld.js", import.meta.url), "utf8"), html = fs.readFileSync(new URL("../meld.html", import.meta.url), "utf8");
check(/createCourse\(\{\s*id: "meld"/.test(js) && /progressOf\("meld"/.test(js) && html.includes("course.css"), "the page opens the course from the Menu under the meld: prefix");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
