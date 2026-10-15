// Schafkopf solved exactly, for the course's checks and the puzzle rush's (offline: too slow for a turn at the table,
// where trumps-dd.js's search for points plays instead). A hand's rest played out with every card seen (double dummy),
// the players' side against the others, each doing what's best for their side; and a position weighed as a player sees
// it: the cards they can't see dealt as they could lie (trumps-deals.js: each hand's size, the Farben a player has
// shown out of, what a Sauspiel's caller must hold, every card played so far legal from the hands so dealt), each deal
// solved after each card the player could play, and the cards' worth averaged.
//
// Worth is what a hand pays, in games: a won game +1, Schneider one more, schwarz one more (each worth a tariff), for
// the side that wins it and against the other; and a hair for each card point past 60, so that between plays alike in
// what they pay, more points is better.
import { GAMES } from "./trumps-games.js";
import { sidesOf, dealFor } from "./trumps-deals.js";

export { sidesOf, playedFits, fittingDeal, dealFor } from "./trumps-deals.js";

const S = GAMES.schafkopf;
const HAIR = 0.002;

/** What a finished hand pays the players' side, in games, from its card points and whether each side took a trick. */
export function payOf(p0, took0, took1) {
  const won = p0 >= 61, p1 = 120 - p0;
  const schneider = won ? p1 < 30 : p0 < 31, schwarz = won ? !took1 : !took0;
  return (won ? 1 : -1) * (1 + (schneider ? 1 : 0) + (schwarz ? 1 : 0)) + HAIR * (p0 - 60);
}

/**
 * A position with every hand seen: { contract, hands, trick, turn, side (seat → 0 the players, 1 the others), pts
 * (the points each side has taken), took ([whether each side has a trick]) }. Returns the worth to the players' side
 * of each card the seat to move may play: [{ card, worth }].
 */
export function solveCards(pos) {
  const tt = new Map();
  const base = { ...pos, hands: pos.hands.map(h => h.slice()), trick: pos.trick.slice(), pts: pos.pts.slice(), took: pos.took.slice() };
  return S.legal({ contract: pos.contract, hands: base.hands, trick: base.trick }, pos.turn).map(card => ({ card, worth: after(base, card, -Infinity, Infinity, tt) }));
}

/** The worth of the position after a card is played (the players' side's), searched with alpha-beta. */
function after(g, card, alpha, beta, tt) {
  const seat = g.turn, hands = g.hands.slice();
  hands[seat] = hands[seat].filter(c => c !== card);
  const trick = [...g.trick, { seat, card }];
  if (trick.length < 4) return search({ ...g, hands, trick, turn: (seat + 1) % 4 }, alpha, beta, tt);
  const w = trick[S.winner({ contract: g.contract }, trick)].seat, k = g.side(w);
  const pts = g.pts.slice(), took = g.took.slice();
  pts[k] += trick.reduce((a, t) => a + S.points(null, t.card), 0);
  took[k] = true;
  if (hands.every(h => !h.length)) return payOf(pts[0], took[0], took[1]);
  return search({ ...g, hands, trick: [], turn: w, pts, took }, alpha, beta, tt);
}
/** Alpha-beta over the cards: the players' side maximises, the others minimise; positions at a trick's start kept. */
function search(g, alpha, beta, tt) {
  const key = g.trick.length ? null : `${g.hands.map(h => [...h].sort((a, b) => a - b).join(".")).join("|")}#${g.turn}#${g.pts[0]}#${+g.took[0]}${+g.took[1]}`;
  if (key) {
    const e = tt.get(key);
    if (e) {
      if (e.f === 0) return e.v;
      if (e.f === 1) alpha = Math.max(alpha, e.v); else beta = Math.min(beta, e.v);
      if (alpha >= beta) return e.v;
    }
  }
  const a0 = alpha, b0 = beta, maxing = g.side(g.turn) === 0;
  // the cards that count most first: they tend to decide it
  const cards = S.legal({ contract: g.contract, hands: g.hands, trick: g.trick }, g.turn).sort((a, b) => S.points(null, b) - S.points(null, a));
  let best = maxing ? -Infinity : Infinity;
  for (const card of cards) {
    const v = after(g, card, alpha, beta, tt);
    if (maxing) { if (v > best) best = v; if (best > alpha) alpha = best; }
    else { if (v < best) best = v; if (best < beta) beta = best; }
    if (alpha >= beta) break;
  }
  if (key) tt.set(key, { v: best, f: best <= a0 ? 2 : best >= b0 ? 1 : 0 });
  return best;
}

// ---------- weighing a position as its player sees it ----------
/**
 * A position weighed as a seat sees it (a rules state, the seat to move): in each of `deals` deals of the cards it
 * can't see, every card it may play solved to the end of the hand. Returns the cards, best first: { card, worth (to
 * the seat's side, in games, on average), sd (the spread of the average), vals (each deal's) }.
 */
export function weigh(s, seat, { deals = 100, rng = Math.random } = {}) {
  const vals = new Map();
  for (let i = 0; i < deals; i++) {
    const hands = dealFor(s, seat, rng);
    if (!hands) continue;
    const side = sidesOf(s, hands), pts = [0, 0], took = [false, false];
    for (const t of s.tricks) { pts[side(t.winner)] += t.pts; took[side(t.winner)] = true; }
    const sign = side(seat) === 0 ? 1 : -1;
    for (const { card, worth } of solveCards({ contract: s.contract, hands, trick: s.trick, turn: seat, side, pts, took })) {
      if (!vals.has(card)) vals.set(card, []);
      vals.get(card).push(sign * worth);
    }
  }
  return [...vals].map(([card, v]) => {
    const m = v.reduce((a, b) => a + b, 0) / v.length, varc = v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1);
    return { card, worth: m, sd: Math.sqrt(varc / v.length), vals: v };
  }).sort((a, b) => b.worth - a.worth);
}
