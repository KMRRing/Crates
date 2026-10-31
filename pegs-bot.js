// The computer player of Pegs (pegs-rules.js). Two decisions:
//  - which two cards to put in the crib: the four kept are worth what they average over every starter that could turn up;
//    Hard also reckons what the two sent are worth to the crib, which is its own if it deals and the other's if not;
//  - which card to play: what it scores now, less what it gives the other to score (a count of 5 or 21 lets a ten make
//    15 or 31, a card of a rank the other may hold lets them pair it).
// Easy keeps a good-looking four from a handful of starters and plays any card that scores, else any card; Medium weighs
// every starter and steers clear of the counts that hand over points; Hard also counts the cards still unseen.
import { countHand, playScore, playable, value, rankOf, suitOf } from "./pegs-rules.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

/** Roughly what two cards are worth in the crib they go to: pairs, fifteens, fives, neighbours, suit. */
function cribGuess(a, b) {
  const ra = rankOf(a), rb = rankOf(b), va = value(a), vb = value(b);
  let v = .3;
  if (ra === rb) v += 2;
  if (va + vb === 15) v += 2;
  if (va === 5 || vb === 5) v += 1.2;
  const gap = Math.abs(ra - rb);
  if (gap === 1) v += .9; else if (gap === 2) v += .5;
  if (suitOf(a) === suitOf(b)) v += .25;
  if (ra === 10 || rb === 10) v += .15;
  return v;
}

function chooseCrib(s, seat, level, rng) {
  const hand = s.hands[seat], mine = s.dealer === seat, held = new Set(hand);
  let pool = [];
  for (let c = 0; c < 52; c++) if (!held.has(c)) pool.push(c);
  if (level === "easy") pool = pool.filter(() => rng() < .15);                       // a handful of starters
  let best = null, bestV = -Infinity;
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const keep = hand.filter((_, k) => k !== i && k !== j);
    let v = 0;
    for (const st of pool) v += countHand(keep, st).total;
    v /= Math.max(1, pool.length);
    if (level === "hard") v += (mine ? 1 : -.8) * cribGuess(hand[i], hand[j]);
    v += rng() * (level === "easy" ? 1.5 : .01);
    if (v > bestV) { bestV = v; best = [hand[i], hand[j]]; }
  }
  return { t: "crib", cards: best };
}

/** What a count gives away: the card a hand would need to make 15 or 31 from it, weighted by how many of them are about. */
function danger(count, freq) {
  let d = 0;
  for (const target of [15, 31]) { const need = target - count; if (need >= 1 && need <= 10) d += freq[need] * 2; }
  return d;
}

function choosePlay(s, seat, level, rng) {
  const hand = s.hands[seat], seq = s.seq.map(e => e.card), count = seq.reduce((a, c) => a + value(c), 0);
  const legal = playable(hand, count);
  if (level === "easy") {
    const scoring = legal.filter(c => playScore([...seq, c]).pts > 0);
    const from = scoring.length ? scoring : legal;
    return { t: "play", card: from[Math.floor(rng() * from.length)] };
  }
  // the cards not yet seen (the other's hand, the crib, the pack), by how likely each value is to be in the other's hand
  const seen = new Set([...hand, ...s.played[0], ...s.played[1], s.starter]);
  const unseen = [];
  for (let c = 0; c < 52; c++) if (!seen.has(c)) unseen.push(c);
  const freq = new Array(11).fill(0), rankN = new Array(13).fill(0);
  for (const c of unseen) { freq[value(c)]++; rankN[rankOf(c)]++; }
  const foeCards = s.hands[1 - seat].length, N = Math.max(1, unseen.length);
  for (let v = 1; v <= 10; v++) freq[v] = Math.min(1, (freq[v] * foeCards) / N);     // chance the other holds one
  let best = legal[0], bestV = -Infinity;
  for (const c of legal) {
    const sc = playScore([...seq, c]);
    let v = sc.pts - danger(sc.count, freq) * (level === "hard" ? 1 : .8);
    if (level === "hard") {
      v -= 2 * Math.min(1, (rankN[rankOf(c)] * foeCards) / N) * (sc.pts ? .5 : 1);   // a pair for the other
      if (!seq.length) v += value(c) <= 4 ? .4 : value(c) === 5 ? -.6 : 0;           // lead low, never a five
      v += value(c) * .02;                                                         // spend the high cards while they're safe
    }
    v += rng() * .01;
    if (v > bestV) { bestV = v; best = c; }
  }
  return { t: "play", card: best };
}

export function botMove(s, seat, { level = "hard", rng = Math.random } = {}) {
  if (!["easy", "medium", "hard"].includes(level)) level = "hard";
  return s.step === "discard" ? chooseCrib(s, seat, level, rng) : choosePlay(s, seat, level, rng);
}
