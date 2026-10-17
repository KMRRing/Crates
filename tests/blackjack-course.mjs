// Blackjack's course (blackjack-course.js) worked through the rules: every lesson's id its own, every choice's answer
// one of its options and why, every hand a lesson shows real cards, every chart one the stage draws, and every claim a
// step makes of the rules (a total, what a round comes to, what the chart plays, whether surrender is open, Over/Under
// 13's total, the house's edge, how often the dealer busts, insurance's chance) what the engine says.
import { COURSE } from "../blackjack-course.js";
import { RULES, handOf, newGame, deal, act, plays, advice, strategyFor, sideTotal } from "../blackjack-engine.js";
import { dealerOutcomes } from "../blackjack-strategy.js";
import { parseCards } from "../blackjack-stage.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };
const table = (shoe, bet = 1000) => { const g = newGame(1, { ...RULES, continuous: false }); g.shoe = parseCards(`${shoe} K K K K K K`); g.pos = 0; g.cut = 9999; g.bet = bet; return g; };
const run = (shoe, moves = []) => { let s = deal(table(shoe)).state; for (const m of moves) s = act(s, m).state; return s; };
const lessons = COURSE.chapters.flatMap(c => c.lessons), ids = lessons.map(l => l.id);
check(new Set(ids).size === ids.length, "every lesson has an id of its own");
let steps = 0, claims = 0;
for (const l of lessons) l.steps.forEach((s, i) => {
  const where = `${l.id} step ${i + 1}`;
  steps++;
  check(typeof s.say === "string" && s.say.length > 0, `${where}: words`);
  if (s.quiz) check(Number.isInteger(s.answer) && s.answer >= 0 && s.answer < s.quiz.length && s.why, `${where}: an answer among the options, and why`);
  if (s.hands) { try { parseCards(s.hands.dealer); [s.hands.you].flat().forEach(t => parseCards(t)); } catch (e) { check(false, `${where}: ${e.message}`); } }
  if (s.chart) { const kind = typeof s.chart === "string" ? s.chart : s.chart.kind; check(["hard", "soft", "pairs"].includes(kind), `${where}: a chart the stage draws`); }
  if (s.terms) check(s.terms.every(t => t.length === 3 && t.every(Boolean)), `${where}: each word its characters, Jyutping and English`);
  const c = s.check;
  if (!c) return;
  claims++;
  if (c.total) check(handOf(parseCards(c.total.cards)).total === c.total.total, `${where}: ${c.total.cards} makes ${c.total.total}`);
  if (c.round) {
    const r = run(c.round.shoe, c.round.moves).round;
    check(r.phase === "over" && r.result.net === c.round.net, `${where}: the round from ${c.round.shoe} comes to ${c.round.net} (it came to ${r.result?.net})`);
    if (c.round.dealer) check(r.dealer.length === c.round.dealer, `${where}: the dealer ends with ${c.round.dealer} cards`);
  }
  if (c.play) {
    const [one, two] = c.play.cards.split(" "), st = run(`${one} ${c.play.up} ${two}`, c.play.moves);
    check(advice(st) === c.play.want, `${where}: ${c.play.cards} against ${c.play.up}: the chart says ${advice(st)}, the lesson ${c.play.want}`);
  }
  if (c.surrender) check(plays(run(c.surrender.shoe, c.surrender.moves)).has("surrender") === c.surrender.open, `${where}: surrender ${c.surrender.open ? "open" : "closed"}`);
  if (c.side) check(sideTotal(parseCards(c.side.cards)) === c.side.total, `${where}: Over/Under 13 counts ${c.side.cards} as ${c.side.total}`);
  if (c.edge) check(Math.abs(strategyFor(RULES).edge - c.edge) < 0.0001, `${where}: the house keeps ${c.edge} playing the chart (${strategyFor(RULES).edge.toFixed(5)})`);
  if (c.bust) check(Math.abs(dealerOutcomes(c.bust.up, RULES).dist[5] - c.bust.p) < 0.01, `${where}: the dealer busts under a ${c.bust.up} about ${c.bust.p} of the time`);
  if (c.insurance) check(Math.abs(96 / 309 - c.insurance) < 0.005, `${where}: a ten under the dealer's ace ${c.insurance} of the time`);
});
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`blackjack course: ${lessons.length} lessons, ${steps} steps; ${claims} claims checked against the engine`);
