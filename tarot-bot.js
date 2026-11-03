// The computer players of Tarot. A hand is weighed for the bid (strength: bouts, the high trumps, how many trumps, the
// kings and queens, the short suits that can be cut) against thresholds that tools/tarot-bench.mjs fitted by playing
// out thousands of deals; the taker's discard voids its shortest suits and keeps kings, bouts and trumps; the king
// is called from the longest suit; and cards are played by tarot-sim.js's rule-of-thumb player, at Medium and Hard
// checked against sampled deals: each candidate is played out to the end in deals of the cards the seat can't see
// (dealt within the voids shown), and the best average wins. Easy has no samples and slips more often.
import {
  PTS, EXCUSE, PETIT, GRAND, isBout, isKing, suitOf, rankOf, SIZES, legalFor, callable, discardTiers, checkDiscard,
  poigneeLevels, POIGNEE, BIDS, sortHand,
} from "./tarot-rules.js";
import { scoreMoves, evaluate, simOf } from "./tarot-sim.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
/** samples: sampled deals per decision; top: candidates weighed; slip: how often a card is played carelessly; bid: noise on the hand's strength. */
export const LEVELS = {
  random: { samples: 0, top: 1, slip: 1, bid: 3.5, ms: 0 },          // the bench's baseline: any card the rules allow
  plain: { samples: 0, top: 1, slip: 0, bid: 0, ms: 0 },             // the rule-of-thumb player alone
  easy: { samples: 0, top: 1, slip: 0.2, bid: 3.5, ms: 0 },
  medium: { samples: 8, top: 4, slip: 0.04, bid: 1.2, ms: 120 },
  hard: { samples: 48, top: 6, slip: 0, bid: 0, ms: 1500 },
};
const lvlOf = level => LEVELS[level] || LEVELS.hard;

// ---------- the hand ----------
/** The hand's strength in points: what it should be worth to a taker, for the bid. */
export function strength(hand, n) {
  const size = SIZES[n].hand;
  let tr = 0, hiT = 0, v = 0;
  const suits = [[], [], [], []];
  for (const c of hand) {
    if (c < 21) { tr++; if (c >= 14) hiT++; if (c >= 17) hiT++; } else if (c > 21) suits[suitOf(c)].push(rankOf(c));
  }
  const ex = hand.includes(EXCUSE), g = hand.includes(GRAND), p = hand.includes(PETIT);
  const avgT = (21 * size) / 78;
  if (g) v += 5;
  if (ex) v += 4.5;
  if (p) v += tr >= avgT + 1.5 ? 2.5 : 0.5;
  v += (tr - avgT) * 1.4 + hiT * 0.9;
  for (const s of suits) {
    const len = s.length;
    const king = s.includes(13), queen = s.includes(12);
    if (king) v += 4 + (len >= 3 ? 0.8 : 0);
    if (queen) v += king ? 2.2 : (len >= 4 ? 1.8 : 0.9);
    if (s.includes(11)) v += king || queen ? 1.2 : 0.4;
    if (len === 0) v += tr >= avgT ? 2.8 : 1;
    else if (len === 1 && !king) v += tr >= avgT ? 1.6 : 0.5;
    else if (len === 2 && !king && tr >= avgT + 1) v += 0.6;
    if (len >= 5) v += (len - 4) * 0.8;
  }
  return v;
}
/** Strength needed for each bid [Petite, Garde, Sans, Contre] by the number of players (fitted by the bench). */
export const BID_AT = {
  3: [18, 22, 28.5, 37],
  4: [18, 22, 28.5, 37],
  5: [11, 14.5, 24, 33],
};

// ---------- the bid ----------
function bidFor(s, seat, L, rng) {
  const st = strength(s.hands[seat], s.n) + (L.bid ? (rng() - 0.5) * 2 * L.bid : 0);
  const at = BID_AT[s.n];
  let best = 0;
  for (let b = 1; b <= 4; b++) if (st >= at[b - 1]) best = b;
  return { t: "bid", n: best > s.high ? best : 0 };
}

// ---------- the call, the dog and the slam ----------
function callFor(s, seat) {
  const hand = s.hands[seat], cands = callable(hand);
  let best = null, bs = -1e9;
  for (const c of cands) {
    if (hand.includes(c)) continue;
    const su = suitOf(c);
    const mine = hand.filter(x => x >= 22 && suitOf(x) === su);
    const sc = mine.length * 2 + mine.filter(x => rankOf(x) >= 11).length * 1.2 + (rankOf(c) === 13 ? 2 : 0);
    if (sc > bs) { bs = sc; best = c; }
  }
  if (best == null) best = cands.find(c => hand.includes(c)) ?? cands[0];
  return { t: "call", card: best };
}
/** The cards to discard from the hand with the dog in it. */
export function chooseDiscard(hand, k) {
  const { plain, trumps, kings } = discardTiers(hand);
  const tr = hand.filter(c => c < 21).length;
  const bySuit = [[], [], [], []];
  for (const c of hand) if (c >= 22) bySuit[suitOf(c)].push(c);
  const chosen = [];
  // void the shortest suits that have no king, if the trumps will cut
  const order = [0, 1, 2, 3].filter(s => bySuit[s].length && !bySuit[s].some(isKing)).sort((a, b) => bySuit[a].length - bySuit[b].length);
  if (tr >= 4) for (const s of order) if (bySuit[s].length <= k - chosen.length && bySuit[s].length <= 4) chosen.push(...bySuit[s]);
  const rest = plain.filter(c => !chosen.includes(c)).sort((a, b) => {
    const ka = bySuit[suitOf(a)].length * 2 + rankOf(a) * 0.35 - PTS[a] * 0.1, kb = bySuit[suitOf(b)].length * 2 + rankOf(b) * 0.35 - PTS[b] * 0.1;
    return ka - kb;
  });
  for (const c of rest) if (chosen.length < k) chosen.push(c);
  for (const c of [...trumps].sort((a, b) => a - b)) if (chosen.length < k) chosen.push(c);
  for (const c of kings) if (chosen.length < k) chosen.push(c);
  const out = chosen.slice(0, k);
  return checkDiscard(hand, out, k) ? fallbackDiscard(hand, k) : out;
}
function fallbackDiscard(hand, k) {
  const { plain, trumps, kings } = discardTiers(hand);
  return [...plain.sort((a, b) => PTS[a] - PTS[b] || rankOf(a) - rankOf(b)), ...trumps.sort((a, b) => a - b), ...kings].slice(0, k);
}
function announceFor(s, seat) {
  const hand = s.hands[seat], size = SIZES[s.n].hand;
  const tr = hand.filter(c => c < 21).length, kings = hand.filter(isKing).length;
  const sure = hand.includes(GRAND) && hand.includes(EXCUSE) && hand.includes(19) && tr >= Math.ceil(size * 0.55) && kings >= 3;
  return { t: "announce", yes: sure };
}

// ---------- the poignée ----------
/** The trumps to show for the best handful the hand allows: the lowest, keeping the high ones hidden. */
export function poigneeFor(s, seat) {
  const lv = poigneeLevels(s, seat);
  if (!lv.length) return null;
  const { size } = lv[lv.length - 1];
  const hand = s.hands[seat], t = hand.filter(c => c < 21).sort((a, b) => a - b);
  if (t.length >= size) return t.slice(0, size);
  return hand.includes(EXCUSE) ? [...t, EXCUSE] : null;
}

// ---------- the card ----------
export function playFor(s, seat, L, rng) {
  const legal = legalFor(s, seat);
  let card;
  if (legal.length === 1) card = legal[0];
  else if (L.slip && rng() < L.slip) {
    const pool = L.slip >= 1 ? legal : legal.filter(c => !isBout(c));
    const from = pool.length ? pool : legal;
    card = from[Math.floor(rng() * from.length)];
  } else card = pickCard(s, seat, L, rng);
  const move = { t: "play", card };
  if (s.hands[seat].length === SIZES[s.n].hand) { const show = poigneeFor(s, seat); if (show) move.show = show; }
  return move;
}
/** The best card by the player's scores, checked in sampled deals when the level has samples. */
export function pickCard(s, seat, L, rng) {
  const sm = playSim(s, seat);
  const scored = sm.scoreMoves;
  if (!L.samples || scored.length < 2) return scored[0][0];
  const cands = scored.slice(0, L.top).map(x => x[0]);
  const deadline = L.ms ? Date.now() + L.ms : Infinity;
  const r = evaluate(s, seat, cands, rng, L.samples, { deadline });
  let bi = 0;
  for (let i = 1; i < cands.length; i++) if (r.means[i] > r.means[bi]) bi = i;
  // the player's own choice stands unless a sampled one is clearly better
  return r.means[bi] - r.means[0] > MARGIN ? cands[bi] : cands[0];
}
export const MARGIN = 2;
/** The player's ranked cards from what seat sees in the deal (the other hands left empty: it reads none of them). */
export function playSim(s, seat) {
  const hands = s.hands.map((h, i) => (i === seat ? h : []));
  const m = simOf(s, hands);
  m.turn = seat;
  return { sim: m, scoreMoves: scoreMoves(m, seat) };
}

/** A computer player's move for a seat, from what that seat may know. */
export function botMove(s, seat, { level = "hard", rng = Math.random } = {}) {
  const L = lvlOf(level);
  switch (s.step) {
    case "bid": return bidFor(s, seat, L, rng);
    case "call": return callFor(s, seat);
    case "discard": return { t: "discard", cards: chooseDiscard(s.hands[seat], s.dog.length) };
    case "announce": return announceFor(s, seat);
    case "play": return playFor(s, seat, L, rng);
    default: return null;
  }
}
