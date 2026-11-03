// Tarot (le tarot, French tarot) by the rules of the Fédération Française de Tarot (FFT, "Règlement" 2019 with the
// "Donnes libres" rules) as pagat.com's French Tarot page sets the same game down: seventy-eight cards, the twenty-one
// trumps (atouts), the Excuse (l'Excuse) and four suits of fourteen; three, four or five players. Bids, lowest first:
// Petite (also called Prise), Garde, Garde sans le chien, Garde contre le chien. The taker (preneur) turns the dog
// (chien) up and discards (écart) as many cards, or leaves it unseen (sans: its points are the taker's; contre: the
// defence's). Five players: the taker calls a king first and whoever holds it is the secret partner, unless it is the
// taker's own or in the dog. Follow suit; with none, trump, and over-trump if you can. The Excuse is played at any
// time and never wins; it stays with its side for a half-point card. The three bouts (oudlers: the 1 and 21 of trumps and
// the Excuse) set the contract the taker's side must reach of the 91 points: 56, 51, 41 or 36. The score of a deal for the
// taker's side: ((25 + margin + petit au bout) × bid multiplier) + poignée + chelem, from each opponent.
//
// A card is a number: 0–20 the trumps 1–21 (id = trump − 1), 21 the Excuse, 22 + 14 × suit + rank the suit cards (suit
// 0–3 ♠ ♥ ♦ ♣; rank 0–9 the 1 to the 10, 10 the jack (valet), 11 the knight (cavalier), 12 the queen (dame), 13 the
// king (roi)). Points are counted in halves (a king 9, a queen 7, a knight 5, a jack 3, every other card and the
// ordinary trumps 1, the bouts 9): the pack is 182, which is the 91 points the books count in pairs.
import { botMove } from "./tarot-bot.js";

export const EXCUSE = 21, PETIT = 0, GRAND = 20;
export const SUITS = ["♠", "♥", "♦", "♣"];
export const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];
export const RANK_MARKS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "C", "Q", "K"];
export const RANK_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "knight", "queen", "king"];
export const BIDS = [
  { n: 0, name: "Pass", short: "Pass", mult: 0 },
  { n: 1, name: "Petite", short: "Petite", mult: 1 },
  { n: 2, name: "Garde", short: "Garde", mult: 2 },
  { n: 3, name: "Garde sans", short: "Sans", mult: 4, full: "Garde sans le chien" },
  { n: 4, name: "Garde contre", short: "Contre", mult: 6, full: "Garde contre le chien" },
];
export const TARGETS = [56, 51, 41, 36];                                  // by bouts held
export const POIGNEE = { 3: [13, 15, 18], 4: [10, 13, 15], 5: [8, 10, 13] };   // simple, double, triple
export const POIGNEE_BONUS = [20, 30, 40], POIGNEE_NAMES = ["simple", "double", "triple"];
export const SIZES = { 3: { hand: 24, dog: 6 }, 4: { hand: 18, dog: 6 }, 5: { hand: 15, dog: 3 } };
export const SHOW_MS = 30000, THROWN_MS = 4200;
export const DEALS = [4, 8, 12];
export const DEFAULTS = { deals: 8, petitSec: true };

// ---------- the cards ----------
export const isTrump = c => c < 21;
export const isSuit = c => c >= 22;
export const suitOf = c => (c < 22 ? -1 : ((c - 22) / 14) | 0);
export const rankOf = c => (c < 22 ? c : (c - 22) % 14);
export const isBout = c => c === 0 || c === 20 || c === 21;
export const isKing = c => c >= 22 && (c - 22) % 14 === 13;
export const suitCard = (suit, rank) => 22 + 14 * suit + rank;
/** Points in halves. */
export const PTS = Array.from({ length: 78 }, (_, c) => (c === 0 || c === 20 || c === 21 ? 9 : c < 21 ? 1 : [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 5, 7, 9][rankOf(c)]));
/** A card's class: 4 the trumps, else its suit. */
export const classOf = c => (c < 21 ? 4 : suitOf(c));

export function cardName(c) {
  if (c === EXCUSE) return "the Excuse";
  if (c < 21) return `${c + 1} of trumps`;
  return `${RANK_NAMES[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`;
}
export function short(c) {
  if (c === EXCUSE) return "Excuse";
  if (c < 21) return `${c + 1}T`;
  return `${RANK_MARKS[rankOf(c)]}${SUITS[suitOf(c)]}`;
}
/** A hand in the order it is held: trumps high to low, the Excuse, then each suit high to low. */
export const sortHand = h => [...h].sort((a, b) => sortKey(a) - sortKey(b));
const sortKey = c => (c < 21 ? -1000 + (20 - c) : c === 21 ? -500 : suitOf(c) * 100 + (13 - rankOf(c)));
export const sum2 = cards => cards.reduce((t, c) => t + PTS[c], 0);
export const boutsOf = cards => cards.reduce((t, c) => t + (isBout(c) ? 1 : 0), 0);

// ---------- play ----------
/** The cards a hand may play on a trick so far (plays: [{ seat, card }]); lead restricts the first lead in five. */
export function legalCards(hand, plays, ban = null) {
  const ex = hand.includes(EXCUSE);
  if (!plays.length) {
    if (!ban) return hand;
    const alt = hand.filter(c => !(c >= 22 && suitOf(c) === ban.suit && c !== ban.card));
    return alt.length ? alt : hand;
  }
  let led = -1, ht = -1;
  for (const p of plays) {
    const c = p.card;
    if (c === EXCUSE) continue;
    if (led < 0) led = classOf(c);
    if (c < 21 && c > ht) ht = c;
  }
  if (led < 0) return hand;                                               // only the Excuse was led: anything goes
  let out;
  if (led === 4) {
    const t = hand.filter(c => c < 21);
    out = t.length ? (ht >= 0 && t.some(c => c > ht) ? t.filter(c => c > ht) : t) : hand;
  } else {
    const f = hand.filter(c => c >= 22 && suitOf(c) === led);
    if (f.length) out = f;
    else {
      const t = hand.filter(c => c < 21);
      out = t.length ? (ht >= 0 && t.some(c => c > ht) ? t.filter(c => c > ht) : t) : hand;
    }
  }
  return ex && !out.includes(EXCUSE) ? [...out, EXCUSE] : out;
}
/** Who wins a trick: index into plays. The Excuse never wins unless nothing else is there. */
export function winnerOf(plays) {
  let led = -1, best = -1, bc = -1;
  for (let i = 0; i < plays.length; i++) {
    const c = plays[i].card;
    if (c === EXCUSE) continue;
    if (led < 0) { led = classOf(c); best = i; bc = c; continue; }
    if (c < 21) { if (bc >= 21 || c > bc) { best = i; bc = c; } }
    else if (bc >= 21 && suitOf(c) === led && c > bc) { best = i; bc = c; }
  }
  return best < 0 ? 0 : best;
}

// ---------- the score of a deal ----------
/**
 * The taker's side's result from its piles: { bouts, ptsH (halves), target, diffH, made, margin }. The half point goes to
 * the side that wins (FFT): 40½ with two bouts is a point short, 41½ a point over.
 */
export function contractOf(attCards, bid = 1) {
  const bouts = boutsOf(attCards), ptsH = sum2(attCards), target = TARGETS[bouts], diffH = ptsH - 2 * target;
  return { bouts, ptsH, target, diffH, made: diffH >= 0, margin: Math.ceil(Math.abs(diffH) / 2) };
}
/**
 * The deal's value X from the taker's side, per opponent: ((25 + margin + petit) × multiplier) + poignée + chelem, signed
 * by whether the contract was made. petit: +10/−10 for the petit au bout the taker's side/the defence won; poignee: the
 * bonuses shown (to the side that wins the deal); chelem: the taker's side's, already signed (+400, +200, −200).
 */
export function dealValue({ made, margin, bid, petit = 0, poignee = 0, chelem = 0 }) {
  const mult = BIDS[bid].mult, sign = made ? 1 : -1;
  return (sign * (25 + margin) + petit) * mult + sign * poignee + chelem;
}
/** What each seat scores from X: three players taker ×2; four ×3; five taker ×2 and partner ×1, or alone ×4. */
export function payments(n, taker, partner, X) {
  const d = Array(n).fill(-X);
  if (n === 3) d[taker] = 2 * X;
  else if (n === 4) d[taker] = 3 * X;
  else if (partner == null || partner === taker) d[taker] = 4 * X;
  else { d[taker] = 2 * X; d[partner] = X; }
  return d;
}

// ---------- the deal ----------
const shuffleDeck = rng => {
  const d = Array.from({ length: 78 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
};
/** A hand with the petit and no other trump (the Excuse counts as a trump): the deal is void if the option is on. */
const petitSec = h => h.includes(PETIT) && !h.some(c => c !== PETIT && c <= EXCUSE);

function newDeal(s, rng, { again = false } = {}) {
  const { hand, dog } = SIZES[s.n];
  const deck = shuffleDeck(rng);
  s.hands = Array.from({ length: s.n }, (_, i) => sortHand(deck.slice(i * hand, (i + 1) * hand)));
  s.dog = deck.slice(s.n * hand, s.n * hand + dog).sort((a, b) => a - b);
  s.dealer = s.dealer == null ? Math.floor(rng() * s.n) : (s.dealer + 1) % s.n;
  if (!again) s.deal = (s.deal || 0) + 1;
  s.first = (s.dealer + 1) % s.n;
  s.step = "bid";
  s.turn = s.first;
  s.bids = [];
  s.high = 0;
  s.taker = null; s.bid = 0; s.call = null; s.partner = null; s.alone = false; s.revealed = false;
  s.dogSeen = false; s.ecart = []; s.ecartShown = [];
  s.chelem = false;
  s.poignees = [];
  s.trick = { plays: [] };
  s.tricks = [];
  s.piles = [[], []]; s.base = [0, 0]; s.debt = [0, 0]; s.won = [0, 0];
  s.ply = (s.ply || 0) + 1;
  delete s.until; delete s.result; delete s.why;
  const sec = s.opts.petitSec ? s.hands.findIndex(petitSec) : -1;
  if (sec >= 0) { s.step = "thrown"; s.why = { sec }; }                   // the caller sets when it ends
}

/** The state made whole after the database (it keeps no empty lists and drops what's null). */
export function restore(s) {
  if (!s) return s;
  const list = v => (v ? Object.values(v) : []);
  s.hands = Array.from({ length: s.n }, (_, i) => list(s.hands?.[i]));
  for (const k of ["dog", "ecart", "ecartShown", "bids", "tricks", "poignees"]) s[k] = list(s[k]);
  s.piles = [list(s.piles?.[0]), list(s.piles?.[1])];
  s.base = [s.base?.[0] || 0, s.base?.[1] || 0];
  s.debt = [s.debt?.[0] || 0, s.debt?.[1] || 0];
  s.won = [s.won?.[0] || 0, s.won?.[1] || 0];
  s.scores = Array.from({ length: s.n }, (_, i) => s.scores?.[i] || 0);
  s.trick ||= { plays: [] };
  s.trick.plays = list(s.trick.plays);
  s.tricks.forEach(t => { t.plays = list(t.plays); });
  s.poignees.forEach(p => { p.cards = list(p.cards); });
  s.log = list(s.log);
  s.log.forEach(e => { e.deltas = Array.from({ length: s.n }, (_, i) => e.deltas?.[i] || 0); });
  for (const k of ["taker", "call", "partner", "dealer"]) s[k] ??= null;
  if (s.result) {
    s.result.deltas = Array.from({ length: s.n }, (_, i) => s.result.deltas?.[i] || 0);
    for (const k of ["att", "def"]) s.result[k] = list(s.result[k]);
    s.result.hands = Array.from({ length: s.n }, (_, i) => list(s.result.hands?.[i]));
    s.result.dog = list(s.result.dog);
  }
  if (s.winners) s.winners = list(s.winners);
  return s;
}

// ---------- who is on whose side ----------
/** 0 the taker's side, 1 the defence; the engine knows the partner even when the table doesn't. */
export const sideOf = (s, seat) => (seat === s.taker || seat === s.partner ? 0 : 1);
/** The seats a seat knows to be on the taker's side: everyone's view of the taker, the partner once the king is played. */
export function knownAtt(s, seat) {
  const a = [s.taker];
  if (s.partner != null && (s.revealed || seat === s.partner)) a.push(s.partner);
  return a;
}
export const initialHand = s => SIZES[s.n].hand;
/** The cards a call may name for this hand: any king, and the next rank down once all four of a rank are held. */
export function callable(hand) {
  const out = [];
  for (let r = 13; r >= 10; r--) {
    const all = [0, 1, 2, 3].map(su => suitCard(su, r));
    for (const c of all) out.push(c);
    if (!all.every(c => hand.includes(c))) break;
  }
  return out;
}
/** Cards a discard may take, in tiers: plain cards, then trumps (shown), then kings (never in practice). */
export function discardTiers(hand) {
  const plain = hand.filter(c => c >= 22 && !isKing(c));
  const trumps = hand.filter(c => c < 21 && !isBout(c));
  const kings = hand.filter(isKing);
  return { plain, trumps, kings };
}
/** Why a discard of these cards isn't allowed, or "". Plain cards first; trumps (shown to the defence) only when they run out. */
export function checkDiscard(hand, cards, k) {
  if (!Array.isArray(cards) || cards.length !== k) return `Discard exactly ${k} card${k > 1 ? "s" : ""}`;
  if (new Set(cards).size !== k || cards.some(c => !hand.includes(c))) return "Those aren't all in your hand";
  if (cards.some(isBout)) return "A bout (the Excuse, the 1 and the 21) can't be discarded";
  const t = discardTiers(hand);
  const wantT = Math.min(Math.max(0, k - t.plain.length), t.trumps.length), wantK = Math.max(0, k - t.plain.length - t.trumps.length);
  const gotT = cards.filter(c => c < 21).length, gotK = cards.filter(isKing).length;
  if (gotK !== wantK) return "Kings can't be discarded";
  if (gotT !== wantT) return "Trumps only when there is no other card to discard";
  return "";
}

// ---------- the rules, as a seats.js game ----------
export const rules = {
  id: "tarot",
  seats: { min: 3, max: 5 },

  deal({ seats, options = {}, rng, now = 0 }) {
    const opts = { ...DEFAULTS };
    if (DEALS.includes(options.deals)) opts.deals = options.deals;
    if (options.petitSec === false) opts.petitSec = false;
    const s = { n: Math.max(3, Math.min(5, seats)), opts, scores: [], log: [], deal: 0, dealer: null, ply: 0 };
    s.scores = Array(s.n).fill(0);
    newDeal(s, rng);
    if (s.step === "thrown") s.until = now + THROWN_MS;
    return s;
  },

  toMove: s => (["bid", "call", "discard", "announce", "play"].includes(s.step) ? s.turn : null),

  anytime: m => m?.t === "next",

  act(s, seat, m, { now }) {
    s.ply++;
    if (m?.t === "next") return skip(s, seat, now);
    switch (s.step) {
      case "bid": return bid(s, seat, m, now);
      case "call": return call(s, seat, m);
      case "discard": return discard(s, seat, m);
      case "announce": return announce(s, seat, m);
      case "play": return play(s, seat, m, now);
      default: return "Not now";
    }
  },

  bot: (s, seat, ctx) => botMove(s, seat, ctx),

  wakeAt: s => (s.step === "shown" || s.step === "thrown" ? s.until : null),

  wake(s, { rng, now }) {
    if (s.step === "thrown") {
      newDeal(s, rng, { again: true });
      if (s.step === "thrown") s.until = now + THROWN_MS;
      return s;
    }
    if (s.step !== "shown") return null;
    if (s.deal >= s.opts.deals) {
      const top = Math.max(...s.scores);
      s.step = "over";
      s.winners = s.scores.map((v, i) => (v === top ? i : -1)).filter(i => i >= 0);
      delete s.until;
      return s;
    }
    newDeal(s, rng);
    if (s.step === "thrown") s.until = now + THROWN_MS;
    return s;
  },

  over: s => s.step === "over",
  restore,
};

/** "Next" skips the wait after a deal or a throw-in; any seat may ask. */
function skip(s, seat, now) {
  if (s.step !== "shown" && s.step !== "thrown") return "Not now";
  s.until = now - 1;
  return s;
}

function bid(s, seat, m, now) {
  if (m?.t !== "bid") return "Bid, or pass";
  const n = Number(m.n);
  if (![0, 1, 2, 3, 4].includes(n)) return "Not a bid";
  if (n && n <= s.high) return `Bid more than ${BIDS[s.high].name}, or pass`;
  s.bids.push({ seat, n });
  if (n) { s.high = n; s.taker = seat; }
  if (n === 4 || s.bids.length === s.n) return s.taker == null ? throwIn(s, now) : won(s);
  s.turn = (seat + 1) % s.n;
  return s;
}
function throwIn(s, now) {
  s.step = "thrown";
  s.why = { pass: true };
  s.until = now + THROWN_MS;
  return s;
}
/** The bidding is over: five players call a king first, the others go straight to the dog. */
function won(s) {
  s.bid = s.high;
  s.turn = s.taker;
  if (s.n === 5) { s.step = "call"; return s; }
  return toDog(s);
}
function call(s, seat, m) {
  if (m?.t !== "call") return "Call a king";
  if (!callable(s.hands[s.taker]).includes(m.card)) return "Call a king (a queen, if you hold all four kings)";
  s.call = m.card;
  const holder = s.hands.findIndex((h, i) => i !== s.taker && h.includes(m.card));
  s.partner = holder >= 0 ? holder : null;
  s.alone = holder < 0;
  return toDog(s);
}
/** The dog: turned up and taken (Petite, Garde), or left face down for the taker's side (sans) or the defence (contre). */
function toDog(s) {
  const t = s.taker;
  if (s.bid <= 2) {
    s.dogSeen = true;
    s.hands[t] = sortHand([...s.hands[t], ...s.dog]);
    if (s.call != null && s.dog.includes(s.call)) { s.alone = true; s.partner = null; s.revealed = true; }
    s.step = "discard";
    s.turn = t;
    return s;
  }
  const side = s.bid === 3 ? 0 : 1;
  s.piles[side].push(...s.dog);
  s.base[side] = s.piles[side].length;
  if (s.call != null && s.dog.includes(s.call)) { s.alone = true; s.partner = null; }
  s.step = "announce";
  s.turn = t;
  return s;
}
function discard(s, seat, m) {
  if (m?.t !== "discard") return "Discard first";
  const k = s.dog.length, why = checkDiscard(s.hands[seat], m.cards, k);
  if (why) return why;
  s.hands[seat] = s.hands[seat].filter(c => !m.cards.includes(c));
  s.ecart = [...m.cards].sort((a, b) => a - b);
  s.ecartShown = s.ecart.filter(c => c < 21);
  s.piles[0].push(...s.ecart);
  s.base[0] = s.piles[0].length;
  s.step = "announce";
  s.turn = seat;
  return s;
}
function announce(s, seat, m) {
  if (m?.t !== "announce") return "Say if you announce a chelem";
  s.chelem = !!m.yes;
  s.step = "play";
  s.turn = s.chelem ? s.taker : s.first;
  return s;
}

/** The ban on the first lead in five players: not the called card's suit, unless the lead is the card itself. */
export function leadBan(s) {
  if (s.n !== 5 || s.call == null || s.tricks.length || s.trick.plays.length || s.call < 22) return null;
  return { suit: suitOf(s.call), card: s.call };
}
export const legalFor = (s, seat = s.turn) => legalCards(s.hands[seat], s.trick.plays, leadBan(s));

/** What a poignée of these cards would be, or why not: { level } | { why }. */
export function checkPoignee(s, seat, show) {
  const hand = s.hands[seat], th = POIGNEE[s.n];
  if (s.poignees.some(p => p.seat === seat)) return { why: "You have already shown a handful" };
  if (hand.length !== SIZES[s.n].hand) return { why: "Show a handful before your first card" };
  if (!Array.isArray(show) || new Set(show).size !== show.length || show.some(c => !hand.includes(c) || c > EXCUSE)) return { why: "Show trumps from your hand" };
  const level = th.indexOf(show.length);
  if (level < 0) return { why: `A handful is ${th.join(", ")} trumps` };
  if (show.includes(EXCUSE) && hand.some(c => c < 21 && !show.includes(c))) return { why: "The Excuse stands in for a trump only when you have no other" };
  return { level };
}
/** The handfuls a hand may show, as { level, size, max }: how many trumps (the Excuse counted) it holds. */
export function poigneeLevels(s, seat) {
  const hand = s.hands[seat];
  if (hand.length !== SIZES[s.n].hand || s.poignees.some(p => p.seat === seat)) return [];
  const have = hand.filter(c => c <= EXCUSE).length;
  return POIGNEE[s.n].map((size, level) => ({ level, size })).filter(x => x.size <= have);
}

function play(s, seat, m, now) {
  if (m?.t !== "play") return "Play a card";
  const hand = s.hands[seat], c = m.card;
  if (!hand.includes(c)) return "That card isn't in your hand";
  if (!legalFor(s, seat).includes(c)) return whyNot(s, seat, c);
  if (m.show?.length) {
    const r = checkPoignee(s, seat, m.show);
    if (r.why) return r.why;
    s.poignees.push({ seat, level: r.level, cards: [...m.show].sort((a, b) => a - b) });
  }
  s.hands[seat] = hand.filter(x => x !== c);
  s.trick.plays.push({ seat, card: c });
  if (s.call != null && c === s.call) s.revealed = true;
  if (s.trick.plays.length < s.n) { s.turn = (seat + 1) % s.n; return s; }
  return endTrick(s, now);
}
function whyNot(s, seat, c) {
  const plays = s.trick.plays;
  if (!plays.length) return "You may not lead the called king's suit on the first trick";
  const led = (() => { for (const p of plays) if (p.card !== EXCUSE) return classOf(p.card); return -1; })();
  if (led === 4) return "You must play a higher trump if you can, else a trump";
  const has = s.hands[seat].some(x => x >= 22 && suitOf(x) === led);
  if (has) return `Follow suit: ${SUIT_NAMES[led]}`;
  return "You must trump, and over-trump if you can";
}

function endTrick(s, now) {
  const plays = s.trick.plays, total = SIZES[s.n].hand, no = s.tricks.length + 1, last = no === total;
  const wi = winnerOf(plays);
  let winner = plays[wi].seat;
  const ex = plays.find(p => p.card === EXCUSE);
  let wside = sideOf(s, winner);
  let moved = false;
  if (ex) {
    const sp = sideOf(s, ex.seat);
    if (last) {
      // the Excuse in the last trick changes sides, unless its side has taken every other trick (a chelem), when it stays
      // with them and, led, wins the trick
      const sweep = s.won[sp] === total - 1;
      if (sweep && (plays[0].card === EXCUSE || wside === sp)) {
        winner = plays[0].card === EXCUSE ? ex.seat : winner;
        wside = sp;
        s.piles[sp].push(...plays.map(p => p.card));
        moved = true;
      } else {
        s.piles[wside].push(...plays.map(p => p.card).filter(c => c !== EXCUSE));
        s.piles[1 - sp].push(EXCUSE);
        moved = true;
      }
    } else if (wside !== sp) {
      // the Excuse stays with its side, which owes the winners a half-point card
      s.piles[sp].push(EXCUSE);
      s.piles[wside].push(...plays.map(p => p.card).filter(c => c !== EXCUSE));
      s.debt[sp]++;
      moved = true;
      payDebt(s, sp);
    }
  }
  if (!moved) s.piles[wside].push(...plays.map(p => p.card));
  s.won[wside]++;
  payDebt(s, wside);
  s.tricks.push({ plays: plays.map(p => ({ seat: p.seat, card: p.card })), win: winner });
  s.trick = { plays: [] };
  if (last) return endDeal(s, now);
  s.turn = winner;
  return s;
}
/** A side owing a half-point card gives one from the tricks it has won, as soon as it has one. */
function payDebt(s, side) {
  while (s.debt[side] > 0) {
    const pile = s.piles[side];
    let i = -1;
    for (let k = pile.length - 1; k >= s.base[side]; k--) if (PTS[pile[k]] === 1 && pile[k] !== EXCUSE) { i = k; break; }
    if (i < 0) return;
    s.piles[1 - side].push(pile.splice(i, 1)[0]);
    s.debt[side]--;
  }
}

/** The deal's end: the Excuse nobody could pay for goes to the other side, then the count, the bonuses and the scores. */
export function endDeal(s, now = 0) {
  for (const side of [0, 1]) {
    if (s.debt[side] > 0) {
      const i = s.piles[side].indexOf(EXCUSE);
      if (i >= 0) { s.piles[side].splice(i, 1); s.piles[1 - side].push(EXCUSE); }
      s.debt[side] = 0;
    }
  }
  const r = settle(s);
  s.result = r;
  s.scores = s.scores.map((v, i) => v + r.deltas[i]);
  s.log.push({ deal: s.deal, taker: s.taker, bid: s.bid, made: r.made, deltas: r.deltas });
  s.step = "shown";
  s.until = now + SHOW_MS;
  return s;
}
/** The count of a finished deal (from s.piles, s.tricks, s.poignees, s.chelem). */
export function settle(s) {
  const att = s.piles[0], def = s.piles[1];
  const c = contractOf(att, s.bid), total = SIZES[s.n].hand;
  // the petit au bout: the 1 in the last trick, to the side that took that trick (FFT: also the second-last when a
  // sweep ends on the Excuse)
  let petit = 0;
  const lastT = s.tricks[s.tricks.length - 1], prevT = s.tricks[s.tricks.length - 2];
  const inTrick = (t, card) => !!t && t.plays.some(p => p.card === card);
  if (inTrick(lastT, PETIT)) petit = s.piles[0].includes(PETIT) ? 10 : -10;
  else if (inTrick(lastT, EXCUSE) && inTrick(prevT, PETIT) && (s.won[0] === total || s.won[1] === total)) petit = s.won[0] === total ? 10 : -10;
  // the handfuls shown go to the side that wins the deal
  let poignee = 0;
  for (const p of s.poignees) poignee += POIGNEE_BONUS[p.level];
  // the chelem: every trick to one side
  let chelem = 0;
  if (s.won[0] === total) chelem = s.chelem ? 400 : 200;
  else if (s.chelem) chelem = -200;
  else if (s.won[1] === total) chelem = -200;
  const X = dealValue({ made: c.made, margin: c.margin, bid: s.bid, petit, poignee, chelem });
  const partner = s.alone ? null : s.partner;
  return {
    ...c, petit, poignee, chelem, X, mult: BIDS[s.bid].mult, taker: s.taker, partner, alone: !!s.alone, bid: s.bid, announced: !!s.chelem,
    deltas: payments(s.n, s.taker, partner, X), att: [...att], def: [...def], dog: [...s.dog], ecart: [...s.ecart], hands: s.hands.map(h => [...h]),
  };
}

/** A game's text: who a seat is in the deal ("taker", "partner", "defence"), as far as the table may know. */
export function roleOf(s, seat, viewer = null) {
  if (s.taker == null) return "";
  if (seat === s.taker) return "taker";
  if (s.n === 5) {
    if (seat === s.partner && (s.revealed || viewer === seat || s.step === "shown" || s.step === "over")) return "partner";
    if (s.step === "shown" || s.step === "over") return "defence";
    return viewer === s.taker || !s.revealed ? "" : "defence";
  }
  return "defence";
}
