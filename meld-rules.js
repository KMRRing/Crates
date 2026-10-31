// Meld: gin rummy for two (README, Meld). The rules as a pure module for seats.js, which moves it solo against the
// computer or at a table with a friend; the computer player is meld-bot.js's, the page meld.js.
//
// A hand: ten cards each, the next card turned up as the first discard, the rest the stock. The player who didn't deal
// may take the upcard or pass, then the dealer may; if both pass, the first draws from the stock. After that each turn
// draws (the stock, or the top of the discard pile) and discards one card, or knocks. A card taken from the pile can't be
// thrown back the same turn. Melds are three or four of a rank, or three or more of a suit in a row (ace low, no K-A-2);
// the cards in no meld are deadwood, an ace one point, the face cards ten. Knocking needs ten points of deadwood or
// fewer once the card is discarded; with none it is gin, and all eleven cards melded without a discard is big gin.
// When the stock is down to two cards and the player who drew doesn't knock, the hand is a draw: nobody scores.
//
// Scoring. The knocker scores the difference in deadwood if it's lower than the other's after the other has laid off
// (put cards on the knocker's melds: a card of the same rank on a set of three, the next card up or down on a run). If
// the other's is equal or lower it is an undercut: the other scores the difference and 25 more. Gin scores the other's
// deadwood and 25, with no laying off; big gin 31. A game goes to `to` points (100); the winner then adds 100 for the
// game (200 if the other scored nothing), and each player 25 for every hand won.
//
// The hand's cards are ids 0–51: rank = id % 13 (ace = 0 … king = 12), suit = id / 13 (♦ ♣ ♥ ♠), as cards.js draws them.
import { botMove } from "./meld-bot.js";

export const SHOW_MS = 15000;                        // a hand's cards shown before the next is dealt (a tap skips it)
export const TO = [50, 100, 200];
export const DEFAULTS = { to: 100 };
export const BONUS = { gin: 25, big: 31, undercut: 25, game: 100, box: 25 };

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const WORDS = ["ace", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king"];
const SUITS = ["diamonds", "clubs", "hearts", "spades"], MARKS = ["♦", "♣", "♥", "♠"];
export const rankOf = id => id % 13;
export const suitOf = id => Math.floor(id / 13);
/** What a card counts against you in deadwood. */
export const pts = id => Math.min(rankOf(id) + 1, 10);
/** "7♥", as it is written on screen. */
export const short = id => RANKS[rankOf(id)] + MARKS[suitOf(id)];
/** "seven of hearts", as it is spoken and read out. */
export const cardName = id => `${WORDS[rankOf(id)]} of ${SUITS[suitOf(id)]}`;
const sum = ids => ids.reduce((a, c) => a + pts(c), 0);
const byRank = (a, b) => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b);
const bySuit = (a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b);

// ---------- melds and deadwood ----------
// Over bitmasks of the positions in a hand, so a hand of eleven is a few hundred steps whichever way it is asked.

const POS = new Int8Array(52);                       // where each card is in the hand being looked at (-1: not in it)
/** Every meld a hand holds, as masks over its positions. */
function meldMasks(hand) {
  POS.fill(-1);
  for (let i = 0; i < hand.length; i++) POS[hand[i]] = i;
  const out = [];
  for (let r = 0; r < 13; r++) {
    let all = 0, k = 0;
    for (let s = 0; s < 4; s++) { const i = POS[s * 13 + r]; if (i >= 0) { all |= 1 << i; k++; } }
    if (k < 3) continue;
    out.push(all);
    if (k === 4) for (let s = 0; s < 4; s++) out.push(all & ~(1 << POS[s * 13 + r]));       // the four, and each three out of it
  }
  for (let s = 0; s < 4; s++) {
    for (let from = 0; from < 11; from++) {
      if (POS[s * 13 + from] < 0) continue;
      let m = 0;
      for (let r = from; r < 13 && POS[s * 13 + r] >= 0; r++) {
        m |= 1 << POS[s * 13 + r];
        if (r - from >= 2) out.push(m);
      }
    }
  }
  return out;
}
const lowBit = m => 31 - Math.clz32(m & -m);

function solver(hand) {
  const n = hand.length, full = (1 << n) - 1, by = Array.from({ length: n }, () => []);
  for (const m of meldMasks(hand)) by[lowBit(m)].push(m);                            // keyed by its first card
  const val = hand.map(pts), memo = new Map();
  /** The least deadwood the unused cards come to (used: the cards already placed, as melds or as deadwood). */
  const f = used => {
    if (used === full) return 0;
    let v = memo.get(used);
    if (v !== undefined) return v;
    const i = lowBit(~used & (used + 1));                                            // the first card not yet placed
    v = val[i] + f(used | (1 << i));                                                 // deadwood…
    for (const m of by[i]) if (!(m & used)) v = Math.min(v, f(used | m));            // …or in one of the melds it starts
    memo.set(used, v);
    return v;
  };
  return { n, full, by, val, f };
}

/** The least deadwood a hand can be melded down to. */
export function deadCount(hand) {
  return hand.length ? solver(hand).f(0) : 0;
}

/**
 * Every way of melding a hand down to its least deadwood (up to `cap`): [{ dead, melds: [[ids]], rest: [ids] }], melds
 * and rest each in rank order.
 */
export function arrangements(hand, cap = 40) {
  const sorted = [...hand].sort((a, b) => a - b), S = solver(sorted), out = [];
  const go = (used, picked) => {
    if (out.length >= cap) return;
    if (used === S.full) { out.push(picked); return; }
    const want = S.f(used), i = lowBit(~used & (used + 1));
    if (S.val[i] + S.f(used | (1 << i)) === want) go(used | (1 << i), picked);
    for (const m of S.by[i]) if (!(m & used) && S.f(used | m) === want) go(used | m, [...picked, m]);
  };
  go(0, []);
  return out.map(masks => {
    const melds = masks.map(m => sorted.filter((_, i) => m & (1 << i)).sort(byRank));
    const inMeld = new Set(melds.flat()), rest = sorted.filter(c => !inMeld.has(c)).sort(byRank);
    return { dead: sum(rest), melds, rest };
  });
}
/** A hand melded down (one way). */
export const deadwood = hand => arrangements(hand, 1)[0] || { dead: 0, melds: [], rest: [] };

// ---------- laying off ----------
const isSet = m => m.every(c => rankOf(c) === rankOf(m[0]));
/** Whether card c goes on meld m: the fourth of a set of three, or the card above or below a run. */
function fits(c, m) {
  if (isSet(m)) return m.length === 3 && rankOf(c) === rankOf(m[0]);
  if (suitOf(c) !== suitOf(m[0])) return false;
  const lo = rankOf(m[0]), hi = rankOf(m[m.length - 1]);
  return rankOf(c) === lo - 1 || rankOf(c) === hi + 1;
}
/** The cards put on the melds in turn (one can make room for the next), and the melds after them. */
function placeOn(cards, melds) {
  const ms = melds.map(m => [...m]), placed = [];
  let left = [...cards], moved = true;
  while (left.length && moved) {
    moved = false;
    for (const c of [...left]) {
      const m = ms.find(x => fits(c, x));
      if (!m) continue;
      m.push(c);
      m.sort(byRank);
      left = left.filter(x => x !== c);
      placed.push(c);
      moved = true;
    }
  }
  return { ms, placed, left };
}
/**
 * The best the defender can do against a knocker's melds: the cards laid off and the hand left melded down, whichever
 * leaves the least deadwood (more cards laid off if equal). { lay, melds (the knocker's, with them), mine (the defender's
 * own melds), rest, dead }.
 */
export function bestLayoff(hand, melds) {
  const can = placeOn(hand, melds).placed.slice(0, 10);
  let best = null;
  for (let mask = 0; mask < 1 << can.length; mask++) {
    const lay = can.filter((_, i) => mask & (1 << i));
    const put = placeOn(lay, melds);
    if (put.left.length) continue;
    const rest = hand.filter(c => !lay.includes(c)), dead = deadCount(rest);
    if (!best || dead < best.dead || (dead === best.dead && lay.length > best.lay.length)) best = { lay, ms: put.ms, rest, dead };
  }
  const own = deadwood(best.rest);
  return { lay: best.lay, melds: best.ms, mine: own.melds, rest: own.rest, dead: own.dead };
}

// ---------- the state ----------
//   hand (number), dealer, scores [2] (points toward the game), boxes [2] (hands won), log [{ hand, winner, points, kind }]
//   hands [2][ids], stock [ids] (the top is the end), discard [ids] (the top is the end), grabs [2][ids] (taken from the pile)
//   turn, step: "offer" (the upcard, to each in turn) | "draw" | "discard" | "shown" | "over"
//   took (the card taken from the pile this turn: not to be thrown back), mustStock (the first draw after two passes)
//   last { seat, did, card? }: the latest thing done, for the table to say
//   result: a hand's end { hand, kind: "knock" | "gin" | "big" | "wash", by, winner, points, bonus, undercut, dead [2],
//     melds [2][[ids]], rest [2][ids], lay [ids] }, shown until `until`
//   final: the game's end { winner, game, boxes [2], totals [2] }
function newHand(s, rng, first) {
  const deck = [];
  for (let i = 0; i < 52; i++) deck.push(i);
  for (let i = 51; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  s.dealer = first ? (rng() < .5 ? 0 : 1) : 1 - s.dealer;
  const non = 1 - s.dealer;
  s.hands = [[], []];
  for (let i = 0; i < 20; i++) s.hands[i % 2 ? s.dealer : non].push(deck[i]);
  s.hands.forEach(h => h.sort(byRank));
  s.discard = [deck[20]];
  s.stock = deck.slice(21);
  s.grabs = [[], []];
  s.hand = (s.hand || 0) + 1;
  s.turn = non;
  s.step = "offer";
  s.mustStock = false;
  delete s.took;
  delete s.result;
  delete s.until;
  s.last = { seat: s.dealer, did: "deal", card: deck[20] };
}

/** The state made whole after the database (it keeps no empty lists, and may give a list back with holes). */
const list = v => (v ? Object.values(v) : []);
export function restore(s) {
  if (!s) return s;
  s.hands = [0, 1].map(i => list(s.hands?.[i]));
  s.grabs = [0, 1].map(i => list(s.grabs?.[i]));
  s.stock = list(s.stock);
  s.discard = list(s.discard);
  s.scores = [0, 1].map(i => s.scores?.[i] || 0);
  s.boxes = [0, 1].map(i => s.boxes?.[i] || 0);
  s.log = list(s.log);
  const r = s.result;
  if (r) {
    r.dead = [0, 1].map(i => r.dead?.[i] || 0);
    r.melds = [0, 1].map(i => list(r.melds?.[i]).map(list));
    r.rest = [0, 1].map(i => list(r.rest?.[i]));
    r.lay = list(r.lay);
  }
  if (s.final) {
    s.final.boxes = [0, 1].map(i => s.final.boxes?.[i] || 0);
    s.final.totals = [0, 1].map(i => s.final.totals?.[i] || 0);
  }
  return s;
}

const other = seat => 1 - seat;
const withoutCard = (hand, c) => hand.filter(x => x !== c);

/** A hand ended in a draw, or by a knock. */
function endHand(s, result, now) {
  s.result = { hand: s.hand, ...result };
  if (result.winner != null) { s.scores[result.winner] += result.points; s.boxes[result.winner]++; }
  s.log.push({ hand: s.hand, winner: result.winner ?? -1, points: result.points || 0, kind: result.kind });
  s.step = "shown";
  s.until = now + SHOW_MS;
}

function knock(s, seat, card, now) {
  const big = card == null, foe = other(seat);
  const hand = big ? [...s.hands[seat]] : withoutCard(s.hands[seat], card);
  const mine = arrangements(hand, 40), kd = mine[0].dead;
  if (big && (hand.length !== 11 || kd !== 0)) return "Big gin needs all eleven cards in melds";
  if (!big && kd > 10) return `Knocking needs 10 or less in deadwood: that leaves ${kd}`;
  const kind = big ? "big" : kd === 0 ? "gin" : "knock";
  let shown = mine[0], def;
  if (kind === "knock") {
    // the knocker lays his melds so as to leave the other the least to lay off
    def = null;
    for (const a of mine) {
      const d = bestLayoff(s.hands[foe], a.melds);
      if (!def || d.dead > def.dead) { def = d; shown = a; }
    }
  } else {
    const d = deadwood(s.hands[foe]);
    def = { lay: [], melds: shown.melds, mine: d.melds, rest: d.rest, dead: d.dead };
  }
  if (!big) s.discard.push(card);
  s.hands[seat] = hand;
  let winner = seat, points, bonus = 0, undercut = false;
  if (kind === "gin") { bonus = BONUS.gin; points = def.dead + bonus; }
  else if (kind === "big") { bonus = BONUS.big; points = def.dead + bonus; }
  else if (def.dead > kd) points = def.dead - kd;
  else { winner = foe; undercut = true; bonus = BONUS.undercut; points = kd - def.dead + bonus; }
  const dead = [0, 0], melds = [[], []], rest = [[], []];
  dead[seat] = kd; dead[foe] = def.dead;
  melds[seat] = def.melds; melds[foe] = def.mine;
  rest[seat] = shown.rest; rest[foe] = def.rest;
  endHand(s, { kind, by: seat, winner, points, bonus, undercut, dead, melds, rest, lay: def.lay }, now);
  const w = `{s${winner}}`;
  s.say = kind === "big" ? `Big gin! ${w} scores ${points}.`
    : kind === "gin" ? `Gin! ${w} scores ${points}.`
    : undercut ? `{s${seat}} knocks with ${kd}, and {s${foe}} undercuts with ${def.dead}: ${points} to {s${foe}}.`
    : `{s${seat}} knocks with ${kd}. ${w} scores ${points}.`;
  return s;
}

/** The hand's cards shown are over: the next hand, or the game's end. */
function afterShown(s, rng, now) {
  const win = s.scores.findIndex(v => v >= s.opts.to);
  if (win < 0) {
    newHand(s, rng, false);
    s.say = `Hand ${s.hand}.`;
    return s;
  }
  const shutout = s.scores[other(win)] === 0, game = shutout ? BONUS.game * 2 : BONUS.game;
  const totals = [0, 1].map(i => s.scores[i] + s.boxes[i] * BONUS.box + (i === win ? game : 0));
  s.final = { winner: win, game, shutout, boxes: [...s.boxes], totals };
  s.step = "over";
  s.winners = [win];
  delete s.until;
  s.say = `Game to {s${win}}${shutout ? ", a shutout" : ""}: ${totals[win]} to ${totals[other(win)]}.`;
  return s;
}

function pick(o) {
  const out = {};
  if (TO.includes(Number(o.to))) out.to = Number(o.to);
  return out;
}

export const rules = {
  id: "meld",
  seats: { min: 2, max: 2 },

  deal({ options = {}, rng }) {
    const s = { seats: 2, opts: { ...DEFAULTS, ...pick(options) }, scores: [0, 0], boxes: [0, 0], log: [], hand: 0 };
    newHand(s, rng, true);
    s.say = `Hand 1. {s${s.dealer}} deals.`;
    return s;
  },

  toMove: s => (s.step === "offer" || s.step === "draw" || s.step === "discard" ? s.turn : null),

  /** Either seat may move the next hand on (the hand's cards are shown till then). */
  anytime: m => m?.t === "next",

  act(s, seat, m, { rng, now }) {
    if (s.step === "shown") return m?.t === "next" ? afterShown(s, rng, now) : "The hand is over: tap for the next";
    if (seat !== s.turn) return "It isn't your turn";
    const foe = other(seat);
    if (s.step === "offer") {
      if (m?.t === "take") {
        const c = s.discard.pop();
        s.hands[seat].push(c);
        s.grabs[seat].push(c);
        s.took = c;
        s.step = "discard";
        s.last = { seat, did: "take", card: c };
        return s;
      }
      if (m?.t !== "pass") return "Take the upcard, or pass";
      s.last = { seat, did: "pass" };
      if (seat === 1 - s.dealer) { s.turn = s.dealer; return s; }                    // the dealer is asked next
      s.turn = foe;                                                                  // both passed: the first draws from the stock
      s.step = "draw";
      s.mustStock = true;
      return s;
    }
    if (s.step === "draw") {
      if (m?.t === "stock") {
        const c = s.stock.pop();
        s.hands[seat].push(c);
        s.mustStock = false;
        s.step = "discard";
        s.last = { seat, did: "stock" };
        return s;
      }
      if (m?.t === "pile") {
        if (s.mustStock) return "Both passed the upcard: draw from the stock";
        const c = s.discard.pop();
        s.hands[seat].push(c);
        s.grabs[seat].push(c);
        s.took = c;
        s.step = "discard";
        s.last = { seat, did: "pile", card: c };
        return s;
      }
      return "Draw from the stock or the pile";
    }
    if (s.step === "discard") {
      if (m?.t === "knock" && m.card == null) return knock(s, seat, null, now);
      if (m?.t !== "discard" && m?.t !== "knock") return "Throw a card, or knock";
      const c = m.card;
      if (!s.hands[seat].includes(c)) return "That card isn't in your hand";
      if (c === s.took) return "You can't throw back the card you took";
      if (m.t === "knock") return knock(s, seat, c, now);
      s.hands[seat] = withoutCard(s.hands[seat], c);
      s.discard.push(c);
      delete s.took;
      s.last = { seat, did: "discard", card: c };
      if (s.stock.length <= 2) {
        endHand(s, { kind: "wash", by: -1, winner: null, points: 0, bonus: 0, undercut: false, dead: [0, 0], melds: [[], []], rest: [[], []], lay: [] }, now);
        s.say = "Only two cards left in the stock: the hand is a draw.";
        return s;
      }
      s.turn = foe;
      s.step = "draw";
      return s;
    }
    return "Not now";
  },

  bot: (s, seat, ctx) => botMove(s, seat, ctx),

  wakeAt: s => (s.step === "shown" ? s.until : null),
  wake(s, { rng, now }) { return s.step === "shown" ? afterShown(s, rng, now) : null; },

  over: s => s.step === "over",
  restore,
};
