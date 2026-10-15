// Contract's card play. Two ways to choose a card:
//  - by the rules of thumb every player learns (playByRules): opening leads (partner's suit, the top of a sequence,
//    fourth best from the longest suit), second hand low, third hand high, win as cheaply as possible, draw trumps,
//    cash winners. Easy plays these, and so does any player whose thinking isn't back in time.
//  - by perfect-information Monte Carlo (chooseCard): deal the two hands the player can't see many times, each deal
//    consistent with what the auction showed (contract-sayc.js's readings: points and suit lengths) and with the play
//    (a seat that showed out of a suit holds none), solve each deal double dummy (contract-dds.js: every card seen,
//    everyone at their best), and play the card that does best across the deals. Declarer weighs the chance of making
//    the contract first and then the tricks; the defenders the chance of beating it, then the tricks. Among cards as
//    good as each other, the one a player would choose by convention: the top of a sequence led, the lowest card
//    otherwise, a high card to encourage partner's lead.
// Pure: the worker (contract-worker.js), the page and the tests share it; the solver is handed in.
import { suitOf, rankOf, NT, legalCards, trickWinner, sideOf, partnerOf, pointsOf, bidOf } from "./contract-core.js";
import { readingsOf } from "./contract-sayc.js";

// ---------- what a seat can see ----------
/** Every card played so far, with who played it: [{ seat, card }], the trick under way last. */
export const playedOf = s => [...s.tricks.flatMap(t => t.cards), ...s.trick];
/** Suits each seat has shown out of (failing to follow): [Set, Set, Set, Set]. */
export function voidsOf(s) {
  const out = [new Set(), new Set(), new Set(), new Set()];
  for (const t of [...s.tricks.map(t => t.cards), s.trick]) {
    if (!t.length) continue;
    const led = suitOf(t[0].card);
    for (const x of t.slice(1)) if (suitOf(x.card) !== led) out[x.seat].add(led);
  }
  return out;
}
/** Who a seat sees: its own hand, and dummy's once the opening lead is down (dummy, declarer's). */
export function seenBy(s, seat) {
  const dummy = partnerOf(s.contract.declarer), out = new Set([seat]);
  if (s.dummyShown) out.add(dummy);
  if (seat === dummy) out.add(s.contract.declarer);                // never asked: dummy doesn't choose
  return out;
}

// ---------- dealing the cards a seat can't see ----------
const choose = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
/**
 * A deal of the unseen cards, consistent with everything the seat knows: the cards each unseen seat still holds by
 * number, the suits it has shown out of, and (strict) what its calls showed: each suit's length and its high-card
 * points, counting the cards it has already played. Returns the four hands as they stand now, or null if no deal was
 * found that way in `tries`.
 */
export function sampleDeal(s, seat, rng, { strict = 2, tries = 300, readings = null } = {}) {
  const seen = seenBy(s, seat), hidden = [0, 1, 2, 3].filter(p => !seen.has(p));
  const played = playedOf(s), voids = voidsOf(s);
  const known = new Set([...[...seen].flatMap(p => s.hands[p]), ...played.map(x => x.card)]);
  const pool = Array.from({ length: 52 }, (_, i) => i).filter(c => !known.has(c));
  const need = hidden.map(p => s.hands[p].length);
  const R = readings || readingsOf(s.auction, s.dealer);
  const playedBy = p => played.filter(x => x.seat === p).map(x => x.card);
  // per hidden seat and suit: how many of the pool's cards it may take (a void none; the reading's length, less what's played)
  const bySuit = [0, 1, 2, 3].map(su => pool.filter(c => suitOf(c) === su));
  const bounds = hidden.map(p => [0, 1, 2, 3].map(su => {
    if (voids[p].has(su)) return [0, 0];
    if (strict < 1) return [0, bySuit[su].length];
    const done = playedBy(p).filter(c => suitOf(c) === su).length, [lo, hi] = R[p].len[su];
    return [Math.max(0, lo - done), Math.max(0, Math.min(bySuit[su].length, hi - done))];
  }));
  const points = hidden.map(p => R[p].hcp), donePts = hidden.map(p => playedBy(p).reduce((a, c) => a + pointsOf(c), 0));
  const needs = hidden.map(p => R[p].needs || []);

  if (hidden.length === 0) return s.hands.map(h => [...h]);
  if (hidden.length === 1) {
    const hands = s.hands.map(h => [...h]);
    hands[hidden[0]] = [...pool];
    return hands;
  }
  // two hidden hands (the usual case once dummy is down): how many of each suit the first gets, drawn in proportion to
  // the number of deals each split allows, then which cards; three (the opening lead): one hand at a time
  const order = [...hidden];
  for (let attempt = 0; attempt < tries; attempt++) {
    const hands = s.hands.map((h, p) => (hidden.includes(p) ? [] : [...h]));
    let left = bySuit.map(x => [...x]), ok = true;
    for (let k = 0; k < order.length - 1 && ok; k++) {
      const p = order[k], i = hidden.indexOf(p), rest = order.slice(k + 1);
      const counts = splitCounts(left.map(x => x.length), need[i], bounds[i], rest.map(q => bounds[hidden.indexOf(q)]), rest.map(q => need[hidden.indexOf(q)]), rng);
      if (!counts) { ok = false; break; }
      for (let su = 0; su < 4; su++) {
        const from = left[su];
        for (let n = 0; n < counts[su]; n++) hands[p].push(from.splice(Math.floor(rng() * from.length), 1)[0]);
      }
    }
    if (!ok) return null;
    hands[order.at(-1)] = left.flat();
    if (strict >= 2) {
      const fits = hidden.every((p, i) => {
        const pts = hands[p].reduce((a, c) => a + pointsOf(c), 0) + donePts[i];
        if (pts < points[i][0] || pts > points[i][1]) return false;
        if (!needs[i].length) return true;
        const L = [0, 1, 2, 3].map(su => hands[p].filter(c => suitOf(c) === su).length + playedBy(p).filter(c => suitOf(c) === su).length);
        return needs[i].every(f => f(L, pts));
      });
      if (!fits) continue;
    }
    return hands;
  }
  return null;
}
/**
 * How many of each suit's remaining cards one hand takes (n in all, within its bounds per suit), leaving the others a
 * share they can hold: drawn in proportion to the deals each split allows (a product of binomials), suit by suit, by
 * counting the ways to complete it.
 */
function splitCounts(avail, n, bounds, otherBounds, otherNeed, rng) {
  // the others together must be able to take what's left: within the sum of their bounds per suit
  const restLo = [0, 1, 2, 3].map(su => otherBounds.reduce((a, b) => a + b[su][0], 0));
  const restHi = [0, 1, 2, 3].map(su => otherBounds.reduce((a, b) => a + b[su][1], 0));
  const lo = su => Math.max(bounds[su][0], avail[su] - restHi[su]), hi = su => Math.min(bounds[su][1], avail[su] - restLo[su]);
  // ways[su][k]: deals of suits su..3 giving this hand k cards
  const ways = Array.from({ length: 5 }, () => new Array(n + 1).fill(0));
  ways[4][0] = 1;
  for (let su = 3; su >= 0; su--) for (let k = 0; k <= n; k++) {
    let w = 0;
    for (let a = lo(su); a <= hi(su) && a <= k; a++) w += choose(avail[su], a) * ways[su + 1][k - a];
    ways[su][k] = w;
  }
  if (!ways[0][n]) return null;
  void otherNeed;
  const out = [];
  let k = n;
  for (let su = 0; su < 4; su++) {
    let r = rng() * ways[su][k];
    let pick = lo(su);
    for (let a = lo(su); a <= hi(su) && a <= k; a++) {
      const w = choose(avail[su], a) * ways[su + 1][k - a];
      if (r < w) { pick = a; break; }
      r -= w;
      pick = a;
    }
    out.push(pick);
    k -= pick;
  }
  return out;
}
/** Deals of the unseen cards, as strict as they can be found: what the bidding showed, then only lengths, then only voids. */
export function dealsFor(s, seat, rng, n) {
  const readings = readingsOf(s.auction, s.dealer), out = [];
  for (const strict of [2, 1, 0]) {
    while (out.length < n) {
      const d = sampleDeal(s, seat, rng, { strict, readings, tries: strict === 2 ? 60 : 20 });
      if (!d) break;
      out.push(d);
    }
    if (out.length >= Math.min(n, 4)) break;
  }
  return out;
}

// ---------- the rules of thumb ----------
const RANK_OF = c => rankOf(c);
const lowest = cards => cards.reduce((a, b) => (RANK_OF(b) < RANK_OF(a) ? b : a));
const highest = cards => cards.reduce((a, b) => (RANK_OF(b) > RANK_OF(a) ? b : a));
/** Whether a card is the highest of its suit still out (no unplayed card of the suit outranks it, but the seat's own). */
function isMaster(card, s, mine) {
  const gone = new Set(playedOf(s).map(x => x.card)), su = suitOf(card);
  for (let r = rankOf(card) + 1; r < 13; r++) { const c = su * 13 + r; if (!gone.has(c) && !mine.includes(c)) return false; }
  return true;
}
/** The card a lead from a suit should be, by convention: the top of a sequence of honours, else the fourth best (or the
 *  lowest of three or fewer, the top of a doubleton, the top of three small). */
export function leadFrom(cards, { nt = false } = {}) {
  const c = [...cards].sort((a, b) => b - a), r = c.map(rankOf);
  if (c.length === 1) return c[0];
  if (c.length === 2) return c[0];
  // a sequence: two touching honours with a third close (KQJ, KQ10, QJ10, QJ9, J109); in a suit contract two will do
  for (let i = 0; i < c.length - 1; i++) {
    if (r[i] < 8) break;
    if (r[i + 1] === r[i] - 1 && (!nt || (r[i + 2] != null && r[i + 2] >= r[i] - 3))) return c[i];
    if (i === 0 && r[0] === 12 && r[1] === 11) return c[0];        // the ace from ace-king
  }
  if (r[0] < 9) return c[0];                                      // top of nothing: no honour
  return c.length >= 4 ? c[3] : c[c.length - 1];                  // fourth best, or low from three to an honour
}
/** The opening lead by the rules: partner's suit; then the suit with the best lead in it, against notrump the longest. */
export function openingLead(s, seat) {
  const hand = s.hands[seat], c = s.contract, nt = c.strain === NT, trump = c.strain;
  const R = readingsOf(s.auction, s.dealer), part = partnerOf(seat);
  const suits = [0, 1, 2, 3].filter(su => hand.some(x => suitOf(x) === su));
  const of = su => hand.filter(x => suitOf(x) === su);
  const theirBid = su => s.auction.some(a => sideOf(a.seat) !== sideOf(seat) && bidOf(a.call)?.strain === su);
  const partnerBid = suits.filter(su => su !== trump && s.auction.some(a => a.seat === part && bidOf(a.call)?.strain === su) && R[part].len[su][0] >= 4);
  if (partnerBid.length) return leadFrom(of(partnerBid.at(-1)), { nt });
  const score = su => {
    const cards = of(su), r = cards.map(rankOf).sort((a, b) => b - a), n = cards.length;
    let v = 0;
    if (theirBid(su)) v -= 6;
    if (!nt && su === trump) v -= 8;
    const seq = r[0] >= 9 && r[1] === r[0] - 1;
    if (nt) { v += n * 2 + (seq ? 3 : 0) + (r[0] >= 10 ? 1 : 0); if (n <= 2) v -= 4; }
    else {
      if (r[0] === 12 && r[1] === 11) v += 7;                     // ace-king
      else if (seq) v += 5;
      if (n === 1 && trump != null) v += 3;                       // a singleton, for a ruff
      if (r[0] === 12 && r[1] !== 11) v -= 4;                     // never away from an ace against a suit
      if (r[0] === 11 && r[1] !== 10 && n <= 3) v -= 2;           // nor from a king, three or fewer
      v += Math.min(n, 4) * 0.5;
    }
    return v;
  };
  const su = suits.sort((a, b) => score(b) - score(a))[0];
  return leadFrom(of(su), { nt });
}
/** A card by the rules of thumb: the opening lead's rules, second hand low, third hand high, the cheapest winner fourth,
 *  draw trumps and cash winners leading. */
export function playByRules(s, rng = Math.random) {
  const p = s.turn, hand = s.hands[p], legal = legalCards(hand, s.trick), strain = s.contract.strain;
  if (legal.length === 1) return legal[0];
  if (!s.tricks.length && !s.trick.length) return openingLead(s, p);
  const declSide = sideOf(s.contract.declarer), mineSide = sideOf(p);
  if (!s.trick.length) {
    // leading: declarer draws trumps while they have any out and it's ours; anyone cashes a winner; else low from length
    const trumps = strain === NT ? [] : hand.filter(c => suitOf(c) === strain);
    const out = strain === NT ? 0 : 13 - playedOf(s).filter(x => suitOf(x.card) === strain).length - trumps.length - (s.dummyShown ? s.hands[partnerOf(p)].filter(c => suitOf(c) === strain).length : 0);
    if (mineSide === declSide && trumps.length && out > 0) { const top = trumps.filter(c => isMaster(c, s, hand)); return top.length ? highest(top) : lowest(trumps); }
    const masters = legal.filter(c => isMaster(c, s, hand) && (strain === NT || suitOf(c) !== strain || mineSide === declSide));
    if (masters.length) return masters[Math.floor(rng() * masters.length)];
    // a defender returns the suit partner led first
    if (mineSide !== declSide) {
      const pLed = s.tricks.find(t => t.cards[0].seat === partnerOf(p));
      if (pLed) { const back = legal.filter(c => suitOf(c) === suitOf(pLed.cards[0].card)); if (back.length) return back.length >= 3 ? lowest(back) : highest(back); }
    }
    const bySuit = [0, 1, 2, 3].map(su => legal.filter(c => suitOf(c) === su && (strain === NT || su !== strain)));
    const long = bySuit.filter(x => x.length).sort((a, b) => b.length - a.length)[0] || legal;
    return lowest(long);
  }
  const t = s.trick, win = t[trickWinner(t, strain)], partnerWins = sideOf(win.seat) === mineSide;
  const beats = c => trickWinner([...t, { seat: p, card: c }], strain) === t.length;
  const winners = legal.filter(beats);
  const followed = suitOf(legal[0]) === suitOf(t[0].card);
  if (t.length === 1) {
    // second hand low, but cover an honour with an honour
    if (followed && rankOf(t[0].card) >= 9 && winners.length && sideOf(t[0].seat) !== mineSide) return lowest(winners.filter(c => rankOf(c) >= 9).length ? winners.filter(c => rankOf(c) >= 9) : winners);
    return followed ? lowest(legal) : discard(s, legal, hand);
  }
  if (partnerWins && (t.length === 3 || isMaster(win.card, s, hand))) return followed ? lowest(legal) : discard(s, legal, hand);
  if (winners.length) return lowest(winners);                       // third hand high, fourth the cheapest winner
  return followed ? lowest(legal) : discard(s, legal, hand);
}
/** A discard: the lowest card of the longest suit without an honour in it (never a trump). */
function discard(s, legal, hand) {
  const strain = s.contract.strain;
  const pool = legal.filter(c => strain === NT || suitOf(c) !== strain);
  const from = pool.length ? pool : legal;
  const weak = [0, 1, 2, 3].map(su => from.filter(c => suitOf(c) === su)).filter(x => x.length).sort((a, b) => (Math.max(...a.map(rankOf)) >= 9) - (Math.max(...b.map(rankOf)) >= 9) || b.length - a.length)[0];
  return lowest(weak || from);
}

// ---------- the play by sampling ----------
/** The side to move's goal: declarer's side the contract's tricks, the defenders one more than declarer can spare. */
export function goalOf(s, seat) {
  const need = 6 + s.contract.level, decl = sideOf(seat) === sideOf(s.contract.declarer);
  return { need: decl ? need : 14 - need, won: s.won[sideOf(seat)], decl };
}
/**
 * Every legal card weighed over deals of the unseen hands: [{ card, n (deals), make (share of deals where the side's
 * goal is reached), tricks (average tricks the side ends with), value }], best first. solver: contract-dds.js's.
 * deals: how many at most; ms: a time limit (at least four deals are weighed whatever the time); rng the deals' chance.
 */
export function weighCards(s, seat, solver, { deals = 24, ms = 900, rng = Math.random, min = 4 } = {}) {
  const p = s.turn, legal = legalCards(s.hands[p], s.trick), g = goalOf(s, p);
  const stats = new Map(legal.map(c => [c, { card: c, n: 0, make: 0, tricks: 0 }]));
  const t0 = Date.now();
  const hands = dealsFor(s, seat, rng, deals);
  let done = 0;
  for (const h of hands) {
    if (done >= min && Date.now() - t0 > ms) break;
    const res = solver.solve(h, s.trick, s.contract.strain, s.turn);
    done++;
    for (const c of legal) {
      const got = res.get(c);
      if (got == null) continue;
      const total = g.won + got, x = stats.get(c);
      x.n++;
      x.tricks += total;
      if (total >= g.need) x.make++;
    }
  }
  const list = [...stats.values()].filter(x => x.n).map(x => ({ ...x, make: x.make / x.n, tricks: x.tricks / x.n }));
  for (const x of list) x.value = x.make * 100 + x.tricks;   // the goal first, then the tricks
  return list.sort((a, b) => b.value - a.value);
}
/**
 * Of cards as good as each other (within `eps` of the best), the one convention plays: leading, the top of a sequence;
 * following partner's lead without winning, a high spot card when holding an honour there (encouraging), else the
 * lowest; otherwise the lowest that does the job.
 */
export function conventional(s, list, eps = 0.01) {
  const best = list[0].value, near = list.filter(x => best - x.value <= eps).map(x => x.card);
  if (near.length === 1) return near[0];
  const p = s.turn, hand = s.hands[p];
  if (!s.trick.length) {
    // the suit the best of them is in, led as convention leads it when that card is among the best
    const su = suitOf(list[0].card), same = near.filter(c => suitOf(c) === su), usual = leadFrom(hand.filter(c => suitOf(c) === su));
    return same.includes(usual) ? usual : highest(same);
  }
  const t = s.trick, strain = s.contract.strain, led = suitOf(t[0].card);
  const beats = c => trickWinner([...t, { seat: p, card: c }], strain) === t.length;
  const winning = near.filter(beats);
  if (winning.length) return lowest(winning);
  const follow = near.filter(c => suitOf(c) === led);
  if (follow.length) {
    const partnerLed = t[0].seat === partnerOf(p) && sideOf(p) !== sideOf(s.contract.declarer);
    const honour = hand.some(c => suitOf(c) === led && rankOf(c) >= 10);
    return partnerLed && honour ? highest(follow.filter(c => rankOf(c) < 9).length ? follow.filter(c => rankOf(c) < 9) : follow) : lowest(follow);
  }
  return lowest(near);
}
/** The card sampling chooses, and what it weighed: { card, list }. */
export function chooseCard(s, seat, solver, opts = {}) {
  const p = s.turn, legal = legalCards(s.hands[p], s.trick);
  if (legal.length === 1) return { card: legal[0], list: [] };
  if (!s.tricks.length && !s.trick.length && !opts.leadBySampling) return { card: openingLead(s, p), list: [] };
  const list = weighCards(s, seat, solver, opts);
  if (!list.length) return { card: playByRules(s, opts.rng), list: [] };
  return { card: conventional(s, list), list };
}
