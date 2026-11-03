// Tarot's coach: the move Hard finds for a seat and why, in words. A bid is the hand's strength against the bids'
// thresholds; the call, the discard and the slam are the computer players' choices explained; a card is weighed in many
// sampled deals (tarot-sim.js), the best of those named with what it comes to against the next. Pure (no page), so the
// worker, the tests and the page share it.
import {
  EXCUSE, PETIT, GRAND, BIDS, SIZES, PTS, isBout, isKing, suitOf, rankOf, classOf, cardName, short, legalFor, winnerOf, SUIT_NAMES, sideOf,
} from "./tarot-rules.js";
import { strength, BID_AT, botMove, LEVELS, chooseDiscard, poigneeFor } from "./tarot-bot.js";
import { evaluate, scoreMoves, simOf, relOf } from "./tarot-sim.js";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** What the hand holds, in a line. */
export function handLine(hand, n) {
  const tr = hand.filter(c => c < 21).length, bouts = hand.filter(isBout).length, kings = hand.filter(isKing).length;
  const bits = [plural(bouts, "bout"), plural(tr, "trump"), plural(kings, "king")];
  const shorts = [0, 1, 2, 3].filter(su => !hand.some(c => c >= 22 && suitOf(c) === su));
  if (shorts.length) bits.push(`no ${shorts.map(su => SUIT_NAMES[su]).join(" or ")}`);
  return bits.join(", ");
}
function bidWords(s, seat) {
  const st = strength(s.hands[seat], s.n), at = BID_AT[s.n];
  let best = 0;
  for (let b = 1; b <= 4; b++) if (st >= at[b - 1]) best = b;
  const move = best > s.high ? best : 0;
  const need = BIDS[Math.max(1, s.high + 1)]?.name;
  const why = `${handLine(s.hands[seat], s.n)}: strength ${st.toFixed(0)} (Petite from ${at[0]}, Garde ${at[1]}, sans ${at[2]}).`;
  if (move) return { move, words: `${BIDS[move].full || BIDS[move].name}. ${why}` };
  return { move: 0, words: best ? `Pass: ${BIDS[best].name} is no longer enough. ${why}` : `Pass${s.high ? "" : ", or a Petite if you like the dog's odds"}. ${why}` + (s.high ? ` ${need} would need ${at[Math.min(3, s.high)]}.` : "") };
}
function discardWords(s, seat) {
  const hand = s.hands[seat], cards = chooseDiscard(hand, s.dog.length);
  const left = hand.filter(c => !cards.includes(c));
  const voided = [0, 1, 2, 3].filter(su => hand.some(c => c >= 22 && suitOf(c) === su) && !left.some(c => c >= 22 && suitOf(c) === su));
  const pts = cards.reduce((t, c) => t + PTS[c], 0) / 2;
  const why = voided.length ? `Void the ${voided.map(su => SUIT_NAMES[su]).join(" and ")}: your trumps will cut them.` : "The weakest, shortest cards: your kings, bouts and trumps stay.";
  return { cards, words: `Put these away. ${why}${pts ? ` They carry ${pts} point${pts === 1 ? "" : "s"}, yours.` : ""}` };
}
function callWords(s, seat) {
  const m = botMove(s, seat, { level: "hard" });
  return { move: m, words: `Call the ${cardName(m.card)}.${s.hands[seat].includes(m.card) ? " You hold it: you play alone, for twice the pay." : " Its holder is your partner, unknown to the table until it is played."}` };
}

// ---------- the card ----------
/** Why a card: the pattern it plays (a few words). */
export function whyCard(s, seat, card) {
  const m = simOf(s, s.hands.map((h, i) => (i === seat ? h : [])));
  m.turn = seat;
  const plays = s.trick.plays, att = seat === s.taker || seat === s.partner;
  if (card === EXCUSE) return plays.length ? "The Excuse takes no trick and loses nothing: this trick is not worth a card." : "Lead the Excuse: it saves a card, and keeps it out of the last trick, where it would change sides.";
  if (!plays.length) {
    if (card < 21) {
      if (card === PETIT) return "The last trick: the 1 of trumps scores the petit au bout if it wins.";
      return att ? "Lead a trump to draw the defence's trumps while you hold control." : "Lead a trump you can win with: it takes the lead from the taker.";
    }
    const su = suitOf(card), above = [...Array(14).keys()].filter(r => r > rankOf(card)).filter(r => { const id = 22 + 14 * su + r; return !m.played[id] && !s.hands[seat].includes(id); });
    if (!above.length) return `The ${cardName(card)} is the highest left in the suit: it takes the trick and its points.`;
    const len = s.hands[seat].filter(c => c >= 22 && suitOf(c) === su).length;
    return len <= 2 ? `Open the short ${SUIT_NAMES[su]}: a void to cut with later.` : `A low ${SUIT_NAMES[su]} costs the least; the high ones are still to come.`;
  }
  const trial = [...plays, { seat, card }], wins = winnerOf(trial) === trial.length - 1;
  const cur = plays[winnerOf(plays)], rel = cur.card === EXCUSE ? -1 : relOf(m, seat, cur.seat);
  const inTrick = plays.reduce((t, p) => t + PTS[p.card], 0) / 2;
  if (wins) {
    if (card < 21 && classOf(plays.find(p => p.card !== EXCUSE)?.card ?? 0) !== 4) return `Cut with the ${card + 1} of trumps, the cheapest that wins${inTrick ? `: ${inTrick} point${inTrick === 1 ? "" : "s"} in the trick` : ""}.`;
    return `The cheapest card that wins the trick${inTrick ? ` and its ${inTrick} point${inTrick === 1 ? "" : "s"}` : ""}.`;
  }
  if (rel > 0) return PTS[card] > 1 && !isBout(card) ? `Your side is winning: give it points (the ${cardName(card)}), where they are safe.` : "Your side is winning: no need to spend a winner.";
  if (card === PETIT) return "Forced: the 1 of trumps is the lowest trump.";
  if (card < 21) return "The trick is lost: the lowest trump allowed.";
  return PTS[card] <= 1 ? "The trick is lost: throw the card that is worth least." : "The trick is lost, and this is the least you can lose.";
}

/** The coach's reading of a decision: { kind, words, move | cards, options } (options: cards with their average score). */
export function advise(s, seat, { rng = Math.random, samples = 36 } = {}) {
  switch (s.step) {
    case "bid": { const r = bidWords(s, seat); return { kind: "bid", move: { t: "bid", n: r.move }, words: r.words }; }
    case "call": { const r = callWords(s, seat); return { kind: "call", move: r.move, words: r.words }; }
    case "discard": { const r = discardWords(s, seat); return { kind: "discard", move: { t: "discard", cards: r.cards }, cards: r.cards, words: r.words }; }
    case "announce": { const m = botMove(s, seat, { level: "hard" }); return { kind: "announce", move: m, words: m.yes ? "You hold the bouts and the trumps for a slam: announce it." : "No slam: play." }; }
    case "play": {
      const legal = legalFor(s, seat);
      if (legal.length === 1) return { kind: "play", move: { t: "play", card: legal[0] }, words: "Your only lawful card.", options: [{ card: legal[0], mean: 0 }] };
      const m = simOf(s, s.hands.map((h, i) => (i === seat ? h : []))); m.turn = seat;
      const ranked = scoreMoves(m, seat).map(x => x[0]);
      const cands = ranked.slice(0, 6);
      const r = evaluate(s, seat, cands, rng, samples);
      const order = cands.map((c, i) => ({ card: c, mean: r.means[i] })).sort((a, b) => b.mean - a.mean);
      const best = order[0].mean - order[1]?.mean > 2 || order[0].card === cands[0] ? order[0] : { card: cands[0], mean: r.means[0] };
      const move = { t: "play", card: best.card };
      const show = poigneeFor(s, seat);
      if (show && s.hands[seat].length === SIZES[s.n].hand) move.show = show;
      const gap = order.length > 1 ? best.mean - order.find(o => o.card !== best.card).mean : 0;
      let words = whyCard(s, seat, best.card);
      if (gap > 4) words += ` About ${Math.round(gap)} points a deal better than the next best.`;
      return { kind: "play", move, words, options: order };
    }
    default: return null;
  }
}
void sideOf; void short; void LEVELS; void PETIT; void GRAND;
