// The computer player of Meld (meld-rules.js). Three strengths, on the same few ideas that decide gin rummy:
//  - the upcard or the pile's top is worth taking when it cuts the deadwood once the worst card is thrown, or sits in a meld;
//  - throw the card that leaves the least deadwood, and among those the one that leaves the most cards to draw into a meld;
//  - knock early, while the other's deadwood is still likely to be higher, and not into an undercut.
// Easy only looks at melds it has made and throws its highest loose card; Medium weighs what can still complete a meld;
// Hard also keeps track of what the other has picked up from the pile (the melds it's building) and doesn't feed it, and
// reckons the other's deadwood from how long the hand has gone on before it knocks.
import { deadCount, arrangements, pts, rankOf, suitOf } from "./meld-rules.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

// take: the deadwood a card must save to be taken from the pile; outs: how much a card still to be drawn into a meld is
// worth; feed: how much throwing a card the other can use costs; knock: the most deadwood it knocks with
const LEVELS = {
  easy:   { take: 99, outs: 0,   feed: 0,   knock: 5,  loose: true },
  medium: { take: 3,  outs: .15, feed: 0,   knock: 8 },
  hard:   { take: 2,  outs: .55, feed: .8,  knock: 10, smart: true },
};

const without = (hand, c) => hand.filter(x => x !== c);
const top = s => s.discard[s.discard.length - 1];

/** What taking card c does to a hand of ten: the deadwood saved once the best other card is thrown, and whether c is in a meld. */
function takeValue(hand, c) {
  const h = [...hand, c];
  let best = Infinity;
  for (const x of h) if (x !== c) best = Math.min(best, deadCount(without(h, x)));
  return { gain: deadCount(hand) - best, melded: arrangements(h, 1)[0].melds.flat().includes(c) };
}
function wants(hand, c, p) {
  const v = takeValue(hand, c);
  if (p.loose) return v.melded && v.gain >= 1;
  return v.gain >= p.take || (p.smart && v.melded && v.gain >= 1);
}

/** The cards not yet seen by a seat: not in its hand, not in the pile (all of it for a player who remembers it). */
function unseen(s, seat, all) {
  const known = new Set([...s.hands[seat], ...(all ? s.discard : [top(s)])]);
  const out = [];
  for (let c = 0; c < 52; c++) if (!known.has(c)) out.push(c);
  return out;
}
/** How many of the cards unseen would go into a meld with this hand of ten. */
function outsOf(hand, pool) {
  const base = deadCount(hand);
  let n = 0;
  for (const x of pool) if (deadCount([...hand, x]) < base + pts(x)) n++;
  return n;
}
/** What throwing c gives the other: it matches a card they took from the pile (a rank for a set, a neighbour in suit for a run). */
function feeds(c, grabs) {
  let f = 0;
  for (const g of grabs) {
    if (rankOf(g) === rankOf(c)) f += 2;
    else if (suitOf(g) === suitOf(c) && Math.abs(rankOf(g) - rankOf(c)) <= 2) f += 1;
  }
  return Math.min(f, 3);
}

export function botMove(s, seat, { level = "hard", rng = Math.random } = {}) {
  const p = LEVELS[level] || LEVELS.hard, hand = s.hands[seat], foe = 1 - seat;
  if (s.step === "offer") return wants(hand, top(s), p) ? { t: "take" } : { t: "pass" };
  if (s.step === "draw") return !s.mustStock && wants(hand, top(s), p) ? { t: "pile" } : { t: "stock" };

  // the discard: eleven cards in hand
  if (hand.length === 11 && deadCount(hand) === 0) return { t: "knock", card: null };       // big gin
  const cards = hand.filter(c => c !== s.took);
  let throwIt;
  if (p.loose) {
    const loose = arrangements(hand, 1)[0].rest.filter(c => c !== s.took), pool = loose.length ? loose : cards;
    pool.sort((a, b) => pts(b) - pts(a));
    throwIt = rng() < .7 ? pool[0] : pool[Math.floor(rng() * pool.length)];
  } else {
    const pool = unseen(s, seat, p.smart);
    let bestScore = Infinity;
    for (const c of cards) {
      const rest = without(hand, c);
      const score = deadCount(rest) - p.outs * outsOf(rest, pool) + p.feed * feeds(c, s.grabs[foe]) + rng() * .01;
      if (score < bestScore) { bestScore = score; throwIt = c; }
    }
  }
  const dead = deadCount(without(hand, throwIt));
  if (dead === 0) return { t: "knock", card: throwIt };
  if (dead <= p.knock && shouldKnock(s, dead, p)) return { t: "knock", card: throwIt };
  return { t: "discard", card: throwIt };
}

/** Whether to knock with this much deadwood: always when the stock is nearly out (or the hand is a draw), else when the
 *  other is likely to hold more. Hard reckons the other's deadwood from the turns gone and the cards it has picked up. */
function shouldKnock(s, dead, p) {
  if (s.stock.length <= 4) return true;
  if (!p.smart) return true;
  const turns = Math.floor(s.discard.length / 2), foe = 1 - s.turn;
  const guess = Math.max(3, Math.min(14, 14 - 1.3 * turns - 1.5 * s.grabs[foe].length));
  return dead <= 3 || dead + 1.5 <= guess;
}
