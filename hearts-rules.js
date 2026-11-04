// Hearts, four players round one table: thirteen cards each, three passed before the play (left, right, across, then
// none, round again), the holder of the 2♣ leading it, and every trick won by the highest card of the suit led. A
// heart is a point and the Q♠ thirteen; the aim is the fewest, the game over when someone reaches the target (100)
// and the lowest score wins. Follow suit when you can; hearts can't be led until one has been played (a hand of nothing
// else may); nothing with points on the first trick unless every card you hold has some. Taking all 26 is shooting
// the moon: you score nothing and the others 26 each (Menu turns that to 26 off your own score).
//
// A card is a number 0–51: rank = id >> 2 (0 the two … 12 the ace), suit = id & 3 (0 ♦, 1 ♣, 2 ♥, 3 ♠), the order
// cards.js draws. The 2♣ is 1, the Q♠ 43.
import { botMove } from "./hearts-bot.js";

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const SUITS = ["♦", "♣", "♥", "♠"];
export const SUIT_NAMES = ["diamonds", "clubs", "hearts", "spades"];
export const rankOf = id => id >> 2;
export const suitOf = id => id & 3;
export const DIAMONDS = 0, CLUBS = 1, HEARTS = 2, SPADES = 3;
export const TWO_CLUBS = 1, QUEEN_SPADES = 10 * 4 + 3;
export const TARGETS = [50, 100, 150];
export const DEFAULTS = { to: 100, moon: "add" };
/** The pass of the nth hand (1-based): to the left (the next seat), the right, across, then none. */
export const DIRS = ["left", "right", "across", "hold"];
export const dirOf = deal => DIRS[(deal - 1) % 4];
export const TRICK_MS = 1500, SHOW_MS = 9000;

export const cardName = id => `${RANKS[rankOf(id)]}${SUITS[suitOf(id)]}`;
/** What a card costs whoever takes it. */
export const pointsOf = id => (suitOf(id) === HEARTS ? 1 : id === QUEEN_SPADES ? 13 : 0);
export const sumPoints = cards => cards.reduce((a, c) => a + pointsOf(c), 0);
/** A hand in the order it's held: spades, hearts, clubs, diamonds (black and red alternating), low to high. */
const SUIT_ORDER = [3, 2, 1, 0];
export const byHand = (a, b) => SUIT_ORDER.indexOf(suitOf(a)) - SUIT_ORDER.indexOf(suitOf(b)) || rankOf(a) - rankOf(b);

const next = seat => (seat + 1) % 4;
const pass3 = seat => ({ left: next(seat), right: (seat + 3) % 4, across: (seat + 2) % 4 });

/** The seat that takes the trick the plays make (the highest of the suit led). */
export function trickWinner(plays) {
  const lead = suitOf(plays[0].card);
  let best = plays[0];
  for (const p of plays) if (suitOf(p.card) === lead && rankOf(p.card) > rankOf(best.card)) best = p;
  return best.seat;
}

/** The cards a seat may play now (a lead, a follow, or a discard), by the rules above. */
export function legalCards(s, seat) {
  const hand = s.hands[seat], first = s.done === 0;
  if (!s.trick.plays.length) {
    if (first) return hand.filter(c => c === TWO_CLUBS);
    if (!s.broken) { const rest = hand.filter(c => suitOf(c) !== HEARTS); if (rest.length) return rest; }
    return hand;
  }
  const lead = suitOf(s.trick.plays[0].card), follow = hand.filter(c => suitOf(c) === lead);
  if (follow.length) return follow;
  if (first) { const clean = hand.filter(c => !pointsOf(c)); return clean.length ? clean : hand; }
  return hand;
}
/** Why a card can't be played now, or "" when it can. */
export function whyNot(s, seat, card) {
  if (!s.hands[seat].includes(card)) return "That isn't your card";
  if (legalCards(s, seat).includes(card)) return "";
  const hand = s.hands[seat];
  if (!s.trick.plays.length) return s.done === 0 ? `Lead the ${cardName(TWO_CLUBS)}` : "Hearts aren't broken: lead another suit";
  const lead = suitOf(s.trick.plays[0].card);
  if (hand.some(c => suitOf(c) === lead)) return `Follow suit: play a ${SUIT_NAMES[lead].slice(0, -1)}`;
  return "No points on the first trick";
}

// ---------- the play (mutating; the rules' own moves and the computer players' play-outs share it) ----------
/** A card played to the trick: out of the hand, onto the table, a suit shown missing, hearts broken. */
export function playCard(s, seat, card) {
  s.hands[seat] = s.hands[seat].filter(c => c !== card);
  if (s.trick.plays.length && suitOf(card) !== suitOf(s.trick.plays[0].card)) s.voids[seat] |= 1 << suitOf(s.trick.plays[0].card);
  s.trick.plays.push({ seat, card });
  s.played.push(card);
  if (suitOf(card) === HEARTS) s.broken = true;
  if (s.trick.plays.length === 4) s.step = "trick"; else s.turn = next(seat);
}
/** The four cards of a trick taken by their winner, who leads next. Returns the winner. */
export function resolveTrick(s) {
  const w = trickWinner(s.trick.plays);
  for (const p of s.trick.plays) if (pointsOf(p.card)) s.took[w].push(p.card);
  s.won[w]++;
  s.done++;
  s.trick = { plays: [], lead: w };
  s.turn = w;
  s.step = "play";
  return w;
}
/** What a hand comes to for each seat: the points taken, who shot the moon (or -1), and what it adds to each score. */
export function handResult(s) {
  const pts = s.took.map(sumPoints), moon = pts.indexOf(26);
  const delta = pts.map((p, i) => (moon < 0 ? p : s.opts.moon === "sub" ? (i === moon ? -26 : 0) : (i === moon ? 0 : 26)));
  return { pts, moon, delta };
}

function deal(s, rng) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  s.hands = Array.from({ length: 4 }, (_, i) => deck.slice(i * 13, i * 13 + 13).sort(byHand));
  s.deal = (s.deal || 0) + 1;
  s.dir = dirOf(s.deal);
  s.give = [[], [], [], []];
  s.recv = [[], [], [], []];
  s.took = [[], [], [], []];
  s.won = [0, 0, 0, 0];
  s.voids = [0, 0, 0, 0];
  s.played = [];
  s.done = 0;
  s.broken = false;
  s.trick = { plays: [], lead: 0 };
  delete s.until;
  delete s.result;
  if (s.dir === "hold") startPlay(s); else s.step = "pass";
}
function startPlay(s) {
  s.step = "play";
  s.turn = s.hands.findIndex(h => h.includes(TWO_CLUBS));
  s.trick = { plays: [], lead: s.turn };
}

function endHand(s, now) {
  const r = handResult(s);
  for (let i = 0; i < 4; i++) s.scores[i] += r.delta[i];
  s.result = { ...r, deal: s.deal };
  s.log.push({ deal: s.deal, pts: r.pts, delta: r.delta, moon: r.moon });
  const top = Math.max(...s.scores);
  if (top >= s.opts.to) {
    const low = Math.min(...s.scores), at = s.scores.map((v, i) => (v === low ? i : -1)).filter(i => i >= 0);
    if (at.length === 1) { s.step = "over"; s.winners = at; delete s.until; return; }   // a tie for the lead plays on
  }
  s.step = "shown";
  s.until = now + SHOW_MS;
}

/** The state made whole after the database (it keeps no empty lists or objects, nor a null). */
export function restore(s) {
  if (!s) return s;
  const four = f => Array.from({ length: 4 }, (_, i) => f(i));
  const list = v => (v ? Object.values(v) : []);
  s.hands = four(i => list(s.hands?.[i]));
  s.give = four(i => list(s.give?.[i]));
  s.recv = four(i => list(s.recv?.[i]));
  s.took = four(i => list(s.took?.[i]));
  s.won = four(i => s.won?.[i] || 0);
  s.voids = four(i => s.voids?.[i] || 0);
  s.scores = four(i => s.scores?.[i] || 0);
  s.played = list(s.played);
  s.trick ||= { plays: [], lead: 0 };
  s.trick.plays = list(s.trick.plays).map(p => ({ ...p }));
  s.log = list(s.log).map(e => ({ ...e, pts: four(i => e.pts?.[i] || 0), delta: four(i => e.delta?.[i] || 0) }));
  if (s.result) { s.result.pts = four(i => s.result.pts?.[i] || 0); s.result.delta = four(i => s.result.delta?.[i] || 0); }
  if (s.winners) s.winners = list(s.winners);
  s.broken = !!s.broken;
  s.done ||= 0;
  return s;
}

function pick(o) {
  const out = {};
  if (TARGETS.includes(Number(o.to))) out.to = Number(o.to);
  if (["add", "sub"].includes(o.moon)) out.moon = o.moon;
  return out;
}

export const rules = {
  id: "hearts",
  seats: { min: 4, max: 4 },

  deal({ options = {}, rng }) {
    const s = { seats: 4, opts: { ...DEFAULTS, ...pick(options) }, scores: [0, 0, 0, 0], log: [], deal: 0 };
    deal(s, rng);
    return s;
  },

  /** Whose decision it is: in the pass, the first seat yet to choose (the rest may choose too, `anytime`). */
  toMove(s) {
    if (s.step === "pass") { const i = s.give.findIndex(g => g.length < 3); return i < 0 ? null : i; }
    return s.step === "play" ? s.turn : null;
  },
  anytime: m => m?.t === "give" || m?.t === "next",

  act(s, seat, m, { rng, now }) {
    if (m?.t === "next") {
      // on to the next hand, without waiting out the clock
      if (s.step === "shown") deal(s, rng);
      return s;
    }
    if (m?.t === "give") {
      if (s.step !== "pass") return "Not now";
      if (s.give[seat].length >= 3) return "You've passed already";
      const cards = Array.isArray(m.cards) ? [...new Set(m.cards)] : [];
      if (cards.length !== 3) return "Pass three cards";
      if (!cards.every(c => s.hands[seat].includes(c))) return "Those aren't your cards";
      s.give[seat] = cards.sort(byHand);
      if (s.give.every(g => g.length === 3)) {
        const to = i => pass3(i)[s.dir], hands = s.hands.map(h => [...h]);
        for (let i = 0; i < 4; i++) {
          hands[i] = hands[i].filter(c => !s.give[i].includes(c));
          s.recv[to(i)] = [...s.give[i]];
        }
        for (let i = 0; i < 4; i++) hands[i] = [...hands[i], ...s.recv[i]].sort(byHand);
        s.hands = hands;
        startPlay(s);
      }
      return s;
    }
    if (m?.t !== "play") return "Play a card";
    if (s.step !== "play") return "Not now";
    if (s.turn !== seat) return "It isn't your turn";
    const why = whyNot(s, seat, m.card);
    if (why) return why;
    playCard(s, seat, m.card);
    if (s.step === "trick") s.until = now + TRICK_MS;
    return s;
  },

  bot: (s, seat, ctx) => botMove(s, seat, ctx),

  wakeAt: s => (s.step === "trick" || s.step === "shown" ? s.until : null),
  wake(s, { rng, now }) {
    if (s.step === "trick") {
      resolveTrick(s);
      delete s.until;
      if (s.done === 13) endHand(s, now);
      return s;
    }
    if (s.step === "shown") { deal(s, rng); return s; }
    return null;
  },

  over: s => s.step === "over",
  restore,
};
