// Texas Hold'em's hands: which of five to seven cards makes the best five, and what a hand is worth against others.
// Pure functions, no page: the game (holdem-rules.js), the computer players, the course and the odds line all use it.
//
// A card is a number, rank × 4 + suit: rank 0 to 12 for 2 to A, suit 0 to 3 for ♦ ♣ ♥ ♠ (cards.js draws them so). Suits
// never rank, as the regulation says (Despacho 11/2008, Article 14); an ace is high, or low in A-2-3-4-5 (the wheel).
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
export const SUITS = ["d", "c", "h", "s"];
export const rankOf = id => id >> 2;
export const suitOf = id => id & 3;
export const RANK_WORDS = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
export const RANK_PLURAL = ["twos", "threes", "fours", "fives", "sixes", "sevens", "eights", "nines", "tens", "jacks", "queens", "kings", "aces"];
const SUIT_WORDS = ["diamonds", "clubs", "hearts", "spades"];
export const cardName = id => `${RANK_WORDS[rankOf(id)]} of ${SUIT_WORDS[suitOf(id)]}`;
/** A card as text ("Ah", "Td"), and cards written as text ("Ah Kd 7c") as numbers. */
export const tokenOf = id => `${RANKS[rankOf(id)]}${SUITS[suitOf(id)]}`;
export function parseCards(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).map(tok => {
    const m = /^(10|[2-9TJQKA])([dchs])$/.exec(tok);
    if (!m) throw new Error(`no card "${tok}"`);
    return RANKS.indexOf(m[1] === "10" ? "T" : m[1]) * 4 + SUITS.indexOf(m[2]);
  });
}

// The hands, lowest to highest. A royal flush is the top straight flush; the regulation lists it apart (黃袍麒).
export const CATEGORIES = ["High card", "One pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];
export const ZH = ["五張散牌", "一對", "兩對", "三條", "順", "同花", "夫盧", "四條", "同花順"], ROYAL_ZH = "黃袍麒";
export const JYUTPING = ["ng5 zoeng1 saan3 paai2", "jat1 deoi3", "loeng5 deoi3", "saam1 tiu4", "seon6", "tung4 faa1", "fu1 lou4", "sei3 tiu4", "tung4 faa1 seon6"], ROYAL_JP = "wong4 pou4 kei4";

const B5 = 13 ** 5;
/** category and up to five ranks, packed into one number: a higher number beats a lower, equal numbers tie. */
function pack(cat, ks) {
  let v = cat;
  for (let i = 0; i < 5; i++) v = v * 13 + (ks[i] ?? 0);
  return v;
}
/** The top rank of a straight in a mask of ranks, or -1; the ace may be low (the wheel, 5 high: rank 3). */
function straightTop(mask) {
  const m = (mask << 1) | ((mask >> 12) & 1);              // bit 0 is the ace low, bit r + 1 is rank r
  for (let t = 13; t >= 4; t--) if (((m >> (t - 4)) & 31) === 31) return t - 1;
  return -1;
}

/**
 * The worth of the best five of these five to seven cards, as a number: higher beats lower, equal ties. Kickers count
 * as the regulation has it (Article 15): four of a kind takes the best other card, three of a kind two, two pair one,
 * a pair three; a flush, a pair and a high card compare card by card from the top.
 */
export function score(ids) {
  const rc = new Array(13).fill(0), sc = [0, 0, 0, 0], sm = [0, 0, 0, 0];
  let mask = 0;
  for (const id of ids) { const r = id >> 2, s = id & 3; rc[r]++; sc[s]++; sm[s] |= 1 << r; mask |= 1 << r; }
  let fs = -1;
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
  if (fs >= 0) { const t = straightTop(sm[fs]); if (t >= 0) return pack(8, [t]); }
  let quad = -1;
  const trips = [], pairs = [];
  for (let r = 12; r >= 0; r--) { const c = rc[r]; if (c === 4) quad = r; else if (c === 3) trips.push(r); else if (c === 2) pairs.push(r); }
  const others = (...skip) => { const out = []; for (let r = 12; r >= 0; r--) if (rc[r] && !skip.includes(r)) out.push(r); return out; };
  if (quad >= 0) return pack(7, [quad, others(quad)[0]]);
  if (trips.length && (trips.length > 1 || pairs.length)) return pack(6, [trips[0], Math.max(trips[1] ?? -1, pairs[0] ?? -1)]);
  if (fs >= 0) { const ks = []; for (let r = 12; r >= 0 && ks.length < 5; r--) if (sm[fs] >> r & 1) ks.push(r); return pack(5, ks); }
  const t = straightTop(mask);
  if (t >= 0) return pack(4, [t]);
  if (trips.length) return pack(3, [trips[0], ...others(trips[0]).slice(0, 2)]);
  if (pairs.length >= 2) return pack(2, [pairs[0], pairs[1], others(pairs[0], pairs[1])[0]]);
  if (pairs.length === 1) return pack(1, [pairs[0], ...others(pairs[0]).slice(0, 3)]);
  return pack(0, others().slice(0, 5));
}
export const categoryOf = sc => Math.floor(sc / B5);
/** The five ranks a score is made of, highest first (a straight's: its top card). */
const ranksOf = sc => { const ks = []; let v = sc % B5; for (let i = 0; i < 5; i++) { ks.unshift(v % 13); v = Math.floor(v / 13); } return ks; };

/** A score in words: { cat, name, zh, jp, text, royal }. */
export function describe(sc) {
  const cat = categoryOf(sc), k = ranksOf(sc), royal = cat === 8 && k[0] === 12;
  const W = r => RANK_WORDS[r], P = r => RANK_PLURAL[r], cap = s => s[0].toUpperCase() + s.slice(1);
  const text = royal ? "Royal flush"
    : cat === 8 ? `Straight flush, ${W(k[0])} high`
      : cat === 7 ? `Four of a kind, ${P(k[0])}`
        : cat === 6 ? `Full house, ${P(k[0])} full of ${P(k[1])}`
          : cat === 5 ? `Flush, ${W(k[0])} high`
            : cat === 4 ? `Straight, ${W(k[0])} high`
              : cat === 3 ? `Three of a kind, ${P(k[0])}`
                : cat === 2 ? `Two pair, ${P(k[0])} and ${P(k[1])}`
                  : cat === 1 ? `Pair of ${P(k[0])}`
                    : `${cap(W(k[0]))} high`;
  return { cat, name: royal ? "Royal flush" : CATEGORIES[cat], zh: royal ? ROYAL_ZH : ZH[cat], jp: royal ? ROYAL_JP : JYUTPING[cat], text, royal };
}

/** The five cards that make a hand's score (of five to seven cards), for showing which to light. */
export function best5(ids) {
  if (ids.length <= 5) return [...ids];
  const target = score(ids), n = ids.length;
  const pick = [];
  const go = (start, left) => {
    if (!left) return score(pick) === target ? [...pick] : null;
    for (let i = start; i <= n - left; i++) { pick.push(ids[i]); const r = go(i + 1, left - 1); pick.pop(); if (r) return r; }
    return null;
  };
  return go(0, 5);
}

// ---------- chances ----------
const FULL = Array.from({ length: 52 }, (_, i) => i);
const choose = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return Math.round(r); };
/** What's left of the pack once these cards are out. */
export const remaining = known => { const out = new Set(known); return FULL.filter(c => !out.has(c)); };

/** Every way of choosing k of the list, as arrays (the same array reused: copy what you keep). */
function* combos(list, k) {
  const n = list.length, idx = Array.from({ length: k }, (_, i) => i), out = new Array(k);
  if (k > n) return;
  for (;;) {
    for (let i = 0; i < k; i++) out[i] = list[idx[i]];
    yield out;
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

/**
 * The chances of each hand winning, hands being lists of two hole cards, the board the community cards so far. Every
 * way the rest of the board can fall is counted when there are few enough (exact: true) or `samples` of them are
 * drawn from rng. Returns [{ win, tie, share }] per hand (shares of the pot as a fraction: a win counts 1, a tie
 * 1 / the number tied), plus `boards` (how many were counted) and `exact`.
 */
export function equity(hands, board = [], { dead = [], rng = Math.random, samples = 2000, exact = null } = {}) {
  const left = remaining([...hands.flat(), ...board, ...dead]), need = 5 - board.length;
  const all = choose(left.length, need);
  const full = exact ?? all <= 3000;
  const win = hands.map(() => 0), tie = hands.map(() => 0), share = hands.map(() => 0);
  let boards = 0;
  const tally = b => {
    const full5 = board.length ? [...board, ...b] : b;
    let best = -1, who = [];
    for (let h = 0; h < hands.length; h++) {
      const s = score([...hands[h], ...full5]);
      if (s > best) { best = s; who = [h]; } else if (s === best) who.push(h);
    }
    boards++;
    if (who.length === 1) { win[who[0]]++; share[who[0]]++; }
    else for (const h of who) { tie[h]++; share[h] += 1 / who.length; }
  };
  if (full) for (const b of combos(left, need)) tally(b);
  else {
    const pool = [...left], b = new Array(need);
    for (let n = 0; n < samples; n++) {
      for (let i = 0; i < need; i++) { const j = i + Math.floor(rng() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; b[i] = pool[i]; }
      tally(b);
    }
  }
  return Object.assign(hands.map((_, h) => ({ win: win[h] / boards, tie: tie[h] / boards, share: share[h] / boards })), { boards, exact: full });
}

/**
 * One hand's chance against `opponents` hands dealt at random from what's left, by sampling: the share of the pot as a
 * fraction. The computer players' (and the odds line's) measure of how good their cards are.
 */
export function vsRandom(hole, board = [], opponents = 1, { dead = [], rng = Math.random, samples = 400 } = {}) {
  const pool = remaining([...hole, ...board, ...dead]), need = 5 - board.length, draw = need + 2 * opponents;
  let total = 0;
  for (let n = 0; n < samples; n++) {
    for (let i = 0; i < draw; i++) { const j = i + Math.floor(rng() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const runout = board.concat(pool.slice(0, need)), mine = score(hole.concat(runout));
    let beaten = false, same = 0;
    for (let o = 0; o < opponents && !beaten; o++) {
      const theirs = score(runout.concat(pool.slice(need + 2 * o, need + 2 * o + 2)));
      if (theirs > mine) beaten = true; else if (theirs === mine) same++;
    }
    if (!beaten) total += 1 / (1 + same);
  }
  return total / samples;
}
