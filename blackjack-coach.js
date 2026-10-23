// Blackjack's coach (no page: the tests run it in Node): what the chart says about the decision in front of you, every
// play open to you with what it is worth on average and a note on why, a sentence on why the chart's play is the one, and
// a verdict on a play of yours. The chart is blackjack-engine.js's (advice), and what each play is worth the strategy's
// own working (strategy().ev: a total's cell as the hands making it average, a pair's exactly), so the coach can't say
// one thing and the chart another. The page (blackjack.js) sets how much it says (COACH, the same four ways as Gambit's):
// off; hints, when asked; check, a word after each play of yours; always, the chart's play and why before you make it.
import { value, handOf, isPair, isBlackjack, plays, advice, strategyFor } from "./blackjack-engine.js";
import { dealerOutcomes } from "./blackjack-strategy.js";

export const COACH = [["off", "Off"], ["hints", "Hints"], ["check", "Check"], ["on", "Always"]];
export const isCoach = v => COACH.some(([k]) => k === v);
/** Two plays within this of each other (a hundredth of a bet) are level: neither is a mistake. */
export const LEVEL = 0.01;

const NAME = { stand: "Stand", hit: "Hit", double: "Double", split: "Split", surrender: "Surrender", insure: "Insure", noInsure: "No insurance" };
const KEY = { stand: "S", hit: "H", double: "D", split: "P", surrender: "R" };
const ORDER = ["stand", "hit", "double", "split", "surrender"];
const pct = x => `${Math.round(x * 100)}%`;
/** An average result in bets, signed: "+0.12", "−0.54". */
export const evText = x => (Math.abs(x) < .005 ? "0.00" : `${x < 0 ? "−" : "+"}${Math.abs(x).toFixed(2)}`);
const upWords = up => (up === 1 ? "an ace" : up === 8 ? "an 8" : `a ${up}`);
const upCard = up => (up === 1 ? "ace" : `${up}`);   // "the dealer's ace"
const pairWords = v => (v === 1 ? "aces" : v === 10 ? "tens" : `${v}s`);

/** The chance the next card busts a hard total (a soft one can't: its ace drops to 1). */
const bustOnHit = t => { let x = 0; for (let v = 1; v <= 10; v++) if (t + v > 21) x += v === 10 ? 4 / 13 : 1 / 13; return x; };
/** Standing on t against a dealer who ends as `dist` says (17 to 21, then bust): the chances of winning, pushing, losing. */
function standOutcome(dist, t) {
  const win = dist[5] + dist.slice(0, 5).reduce((a, x, i) => a + (17 + i < t ? x : 0), 0), push = t >= 17 && t <= 21 ? dist[t - 17] : 0;
  return { win, push, lose: 1 - win - push };
}

/**
 * The decision in front of you now, or null when there isn't one:
 * { tip (the chart's play, as advice() says), hand ("16 against a 5"), short ("Stand: 16 against a 5"), why (a
 * sentence or two), rows: [{ play, name, ev (an average result in bets, or null where none is worked out), note,
 * best }] for the plays open, best average first }.
 */
export function look(game) {
  const tip = advice(game);
  if (!tip) return null;
  const r = game.round, up = value(r.dealer[0]);
  if (r.phase === "insurance") return insuranceLook(game, tip);
  const h = r.hands[r.active], { total: t, soft } = handOf(h.cards), open = plays(game), chart = strategyFor(game.rules);
  const pair = isPair(h.cards) && open.has("split"), pv = value(h.cards[0]);
  const cell = pair ? chart.ev.pairs[`${pv},${up}`] : soft ? chart.ev.soft[`${Math.max(t, 13)},${up}`] : chart.ev.hard[`${Math.max(t, 5)},${up}`];
  const evs = cell || {};
  const { dist } = dealerOutcomes(up, game.rules), dealerBust = dist[5], bust = soft ? 0 : bustOnHit(t), out = standOutcome(dist, t);
  const hand = `${pair ? `a pair of ${pairWords(pv)}` : soft && t < 21 ? `soft ${t}` : `${t}`} against ${upWords(up)}`;
  const notes = {
    stand: `wins ${pct(out.win)}${out.push >= .01 ? `, pushes ${pct(out.push)}` : ""}, loses ${pct(out.lose)}`,
    hit: soft ? "can't bust: the ace drops to 1" : bust < .005 ? "can't bust" : `busts ${pct(bust)} at once`,
    double: "one card only, for twice the bet",
    split: "two hands, a bet on each",
    surrender: "half the bet back, the rest gone",
  };
  const rows = ORDER.filter(p => open.has(p)).map(play => ({ play, name: NAME[play], ev: typeof evs[KEY[play]] === "number" ? evs[KEY[play]] : null, note: notes[play], best: play === tip }));
  rows.sort((a, b) => (b.ev ?? -9) - (a.ev ?? -9));
  const next = rows.find(x => x.play !== tip && x.ev != null);
  const weak = up >= 2 && up <= 6;
  let why;
  if (tip === "stand") {
    why = t === 21 ? "21 can't be beaten, only tied."
      : !soft && t >= 17 ? `Stand on ${t}: it wins ${pct(out.win)} of the time against the dealer's ${upCard(up)} as it is, and a hit would bust ${pct(bust)}.${pair ? ` Splitting would break up a ${t}.` : ""}`
      : !soft && weak ? `The dealer's ${upCard(up)} is a weak card: it busts ${pct(dealerBust)} of the time. A hit on your ${t} would bust ${pct(bust)}, so let the dealer take the risk.`
      : `Soft ${t} is good enough: it wins ${pct(out.win)} against the dealer's ${upCard(up)}, and a hit would risk a worse hand for little.`;
  } else if (tip === "hit") {
    why = !soft && t <= 11 ? `No single card can bust ${t}, and ${t} is too low to stand on.`
      : soft ? `A hit can't bust a soft ${t} (the ace can drop to 1), and standing on it wins only ${pct(out.win)} against the dealer's ${upCard(up)}: take a card.`
      : `The dealer's ${upCard(up)} busts only ${pct(dealerBust)} of the time, so standing on ${t} wins just ${pct(out.win)}. A hit risks a bust (${pct(bust)}) but is still the better bet.`;
  } else if (tip === "double") {
    why = !soft && t >= 9 && t <= 11 ? `A ten (4 cards in 13) turns ${t} into ${t + 10}, and the dealer's ${upCard(up)} busts ${pct(dealerBust)}: the second bet goes where you are ahead.`
      : soft ? `A soft ${t} can't bust on one card, and the dealer's ${upCard(up)} busts ${pct(dealerBust)}: one card for a second bet is worth it.`
      : `Against the dealer's ${upCard(up)} (it busts ${pct(dealerBust)}), one more card with a second bet beats just hitting.`;
  } else if (tip === "split") {
    why = pv === 1 ? "Two aces make a poor 12; apart they each start on 11, and a ten (4 cards in 13) makes 21."
      : pv === 8 ? "Two 8s make 16, the worst total there is; apart, each 8 can still become 18 or better."
      : `Against the dealer's ${upCard(up)}, two hands starting on ${pv} are worth more than one on ${pv * 2}.`;
  } else if (tip === "surrender") {
    why = `${hand[0].toUpperCase()}${hand.slice(1)}: every other play loses more than the half a bet you give up${next?.ev != null ? `: ${next.name.toLowerCase()} averages ${evText(next.ev)}` : ""}.`;
  } else why = "";
  return { tip, hand, short: `${NAME[tip]}: ${hand}`, why, rows };
}

/** Insurance and even money: no chart cell, just the arithmetic of a ten under the ace (from the shoe as it stands). */
function insuranceLook(game, tip) {
  const r = game.round, mine = r.hands[0].cards, bj = isBlackjack(mine), decks = game.rules.decks || 6;
  const seen = [...mine, r.dealer[0]], tens = decks * 16 - seen.filter(id => value(id) === 10).length, p = tens / (decks * 52 - seen.length);
  const open = plays(game), hand = bj ? "a blackjack against an ace" : `${handOf(mine).soft ? "soft " : ""}${handOf(mine).total} against an ace`;
  const rows = (bj
    ? [{ play: "noInsure", name: "Play it on", ev: 1.5 * (1 - p), note: `pays 3 to 2, but a push if the dealer has a ten (${pct(p)})` }, { play: "insure", name: "Even money", ev: 1, note: "1 to 1 now, for sure" }]
    : [{ play: "noInsure", name: "No insurance", ev: 0, note: "nothing more at stake" }, { play: "insure", name: "Insure", ev: (3 * p - 1) / 2, note: `wins ${pct(p)} of the time, and needs 33%` }]
  ).filter(x => open.has(x.play)).map(x => ({ ...x, best: x.play === tip }));
  rows.sort((a, b) => b.ev - a.ev);
  const why = bj ? `Even money is a sure 1 on your bet. Playing on pays 1½ times it unless the dealer's other card is a ten (${pct(p)}, and then it is a push): ${(1.5 * (1 - p)).toFixed(2)} on average, a little more than the sure 1.`
    : `Insurance wins when the dealer's other card is a ten: ${pct(p)} of the time. It pays 2 to 1, so it needs a third; on average it loses ${pct(Math.max(0, 1 - 3 * p))} of what you put on it, whatever your hand.`;
  return { tip, hand, short: `${rows.find(x => x.play === tip)?.name || NAME[tip]}: ${hand}`, why, rows };
}

/**
 * Your play judged against the decision as `look` saw it before you made it: { ok, level (not the chart's, but as good
 * to a hundredth of a bet), cost (what it gives away on average, in bets, or null), say (a line for the panel), line (the
 * chart's play, for a toast) }.
 */
export function judge(lk, play) {
  const name = p => lk.rows.find(x => x.play === p)?.name || NAME[p], mine = lk.rows.find(x => x.play === play), best = lk.rows.find(x => x.play === lk.tip);
  const cost = mine?.ev != null && best?.ev != null ? Math.max(0, best.ev - mine.ev) : null;
  const level = play !== lk.tip && cost != null && cost < LEVEL, ok = play === lk.tip || level;
  const say = play === lk.tip ? `✓ ${name(play)}: the chart's play (${lk.hand})`
    : level ? `✓ ${name(play)}: level with the chart's ${name(lk.tip).toLowerCase()} (${lk.hand})`
    : `✗ ${name(play)}: the chart says ${name(lk.tip).toLowerCase()} (${lk.hand})${cost != null ? `, worth ${cost.toFixed(2)} of a bet more` : ""}`;
  return { ok, level, cost, play, tip: lk.tip, say, line: `The chart says ${name(lk.tip).toLowerCase()}: ${lk.hand}` };
}
