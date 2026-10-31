// Pegs: cribbage for two (README, Pegs). The rules as a pure module for seats.js, which moves it solo against the computer
// or at a table with a friend; the computer player is pegs-bot.js's, the page pegs.js.
//
// A deal: six cards each; each puts two in the crib, which is the dealer's; the starter is turned from the pack (a jack,
// his heels, is two for the dealer). The play: the one who didn't deal leads, and each plays a card in turn, the count of
// what has been played this round going up to 31 at most, scoring as it goes: 15 and 31 two each, a pair two, three alike
// six, four alike twelve, a run of three or more as many as its length (the last cards played, in any order). A player who
// can't play without passing 31 says go: here the engine says it for them, and the other goes on playing what they can;
// the last to play scores one for go (two for exactly 31), and the count starts again. The last card played scores one.
// The show: the one who didn't deal counts their four cards and the starter, then the dealer theirs, then the crib (a flush
// in the crib needs all five): fifteens two each, pairs two each, runs, a flush four (five with the starter), the jack of the
// starter's suit one (his nobs). First to 121 wins at once, in the middle of the play or the count; the game can be to 61.
//
// The hand's cards are ids 0–51: rank = id % 13 (ace = 0 … king = 12), suit = id / 13 (♦ ♣ ♥ ♠), as cards.js draws them.
import { botMove } from "./pegs-bot.js";

export const SHOW_MS = 25000;                        // a count shown before the next (a tap skips it)
export const TO = [121, 61];
export const DEFAULTS = { to: 121 };
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const WORDS = ["ace", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king"];
const SUITS = ["diamonds", "clubs", "hearts", "spades"], MARKS = ["♦", "♣", "♥", "♠"];
export const rankOf = id => id % 13;
export const suitOf = id => Math.floor(id / 13);
/** What a card counts in fifteens and in the play: an ace one, the face cards ten. */
export const value = id => Math.min(rankOf(id) + 1, 10);
export const short = id => RANKS[rankOf(id)] + MARKS[suitOf(id)];
export const cardName = id => `${WORDS[rankOf(id)]} of ${SUITS[suitOf(id)]}`;
const byRank = (a, b) => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b);

// ---------- counting a hand ----------
const isRun = ranks => {
  const r = [...ranks].sort((a, b) => a - b);
  return r.every((x, i) => !i || x === r[i - 1] + 1);
};
/**
 * What four cards (or the crib's four) and the starter count: { total, fifteens (how many), pairs (how many), run
 * ({ len, n } or null: n runs of len), flush (0, 4 or 5), nobs (0 or 1) }.
 */
export function countHand(hand, starter, { crib = false } = {}) {
  const all = [...hand, starter], n = all.length;
  let fifteens = 0, pairs = 0;
  for (let m = 1; m < 1 << n; m++) {
    const cards = all.filter((_, i) => m & (1 << i));
    if (cards.reduce((a, c) => a + value(c), 0) === 15) fifteens++;
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rankOf(all[i]) === rankOf(all[j])) pairs++;
  // runs: the longest length that exists, counted as many times as there are ways to make it (a double run counts twice)
  let run = null;
  for (let len = n; len >= 3 && !run; len--) {
    let k = 0;
    for (let m = 1; m < 1 << n; m++) {
      const cards = all.filter((_, i) => m & (1 << i));
      if (cards.length === len && isRun(cards.map(rankOf))) k++;
    }
    if (k) run = { len, n: k };
  }
  let flush = 0;
  if (hand.every(c => suitOf(c) === suitOf(hand[0]))) flush = suitOf(starter) === suitOf(hand[0]) ? 5 : crib ? 0 : 4;
  const nobs = hand.some(c => rankOf(c) === 10 && suitOf(c) === suitOf(starter)) ? 1 : 0;
  const total = fifteens * 2 + pairs * 2 + (run ? run.len * run.n : 0) + flush + nobs;
  return { total, fifteens, pairs, run, flush, nobs };
}

// ---------- the play ----------
/** What playing the card scores in a round whose cards so far are `seq` (cards, the new one last): { pts, why: [words] }. */
export function playScore(seq) {
  const count = seq.reduce((a, c) => a + value(c), 0), why = [];
  let pts = 0;
  if (count === 15) { pts += 2; why.push("fifteen"); }
  if (count === 31) { pts += 2; why.push("thirty-one"); }
  let same = 1;
  for (let i = seq.length - 2; i >= 0 && rankOf(seq[i]) === rankOf(seq[seq.length - 1]); i--) same++;
  if (same >= 2) { const p = [0, 0, 2, 6, 12][same]; pts += p; why.push(["", "", "a pair", "three of a kind", "four of a kind"][same]); }
  for (let k = seq.length; k >= 3; k--) {
    if (isRun(seq.slice(-k).map(rankOf)) && new Set(seq.slice(-k).map(rankOf)).size === k) { pts += k; why.push(`a run of ${k}`); break; }
  }
  return { pts, why, count };
}
const countOf = seq => seq.reduce((a, e) => a + value(e.card), 0);
/** The cards of a hand that can be played at this count. */
export const playable = (hand, count) => hand.filter(c => count + value(c) <= 31);

// ---------- the state ----------
//   deal (number), dealer, scores [2] and prev [2] (the front and back pegs), opts { to }
//   hands [2] (what's in hand), keep [2] (the four kept, for the show), crib [4], starter
//   step: "discard" | "play" | "show" | "over";  turn
//   seq [{ seat, card }]: this round's cards, and the count;  played [2]: each side's cards played this deal, in order
//   show { stage: 0 (the one who didn't deal) | 1 (the dealer) | 2 (the crib), seat, cards, ...the count }
//   last { seat, did: "play" | "go" | "last" | "heels" | "show", card?, pts, why }, won, final { winner, loser, skunk }
function newDeal(s, rng, first) {
  const deck = [];
  for (let i = 0; i < 52; i++) deck.push(i);
  for (let i = 51; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  s.dealer = first ? (rng() < .5 ? 0 : 1) : 1 - s.dealer;
  const non = 1 - s.dealer;
  s.hands = [[], []];
  for (let i = 0; i < 12; i++) s.hands[i % 2 ? s.dealer : non].push(deck[i]);
  s.hands.forEach(h => h.sort(byRank));
  s.starter = deck[12];
  s.keep = [[], []];
  s.crib = [];
  s.seq = [];
  s.played = [[], []];
  s.deal = (s.deal || 0) + 1;
  s.step = "discard";
  s.turn = non;
  delete s.show;
  delete s.until;
  s.last = { seat: s.dealer, did: "deal", pts: 0 };
}

const list = v => (v ? Object.values(v) : []);
/** The state made whole after the database (it keeps no empty lists, and may give a list back with holes). */
export function restore(s) {
  if (!s) return s;
  for (const k of ["hands", "keep", "played"]) s[k] = [0, 1].map(i => list(s[k]?.[i]));
  s.crib = list(s.crib);
  s.seq = list(s.seq);
  s.scores = [0, 1].map(i => s.scores?.[i] || 0);
  s.prev = [0, 1].map(i => s.prev?.[i] || 0);
  if (s.show) s.show.cards = list(s.show.cards);
  return s;
}

const other = seat => 1 - seat;
const without = (hand, c) => hand.filter(x => x !== c);

function peg(s, seat, n) {
  if (!n || s.won != null) return;
  s.prev[seat] = s.scores[seat];
  s.scores[seat] = Math.min(s.opts.to, s.scores[seat] + n);
  if (s.scores[seat] >= s.opts.to) s.won = seat;
}
function finish(s) {
  const loser = other(s.won), pts = s.scores[loser], skunk = s.opts.to === 121 ? (pts < 61 ? 2 : pts < 91 ? 1 : 0) : (pts < 31 ? 1 : 0);
  s.final = { winner: s.won, loser, skunk, scores: [...s.scores] };
  s.winners = [s.won];
  s.step = "over";
  delete s.until;
  s.say = `Game to {s${s.won}}, ${s.scores[s.won]} to ${pts}${skunk ? (skunk > 1 ? ", a double skunk" : ", a skunk") : ""}.`;
}

/** The show's next count: the stage's cards counted and pegged. */
function showStage(s, stage, now) {
  const seat = stage === 2 ? s.dealer : stage === 0 ? other(s.dealer) : s.dealer;
  const cards = stage === 2 ? [...s.crib].sort(byRank) : [...s.keep[seat]].sort(byRank);
  const c = countHand(cards, s.starter, { crib: stage === 2 });
  s.show = { stage, seat, cards, ...c };
  if (!s.show.run) delete s.show.run;                                              // the database keeps no nulls
  s.step = "show";
  s.until = now + SHOW_MS;
  peg(s, seat, c.total);
  s.last = { seat, did: "show", pts: c.total };
  s.say = `${stage === 2 ? "The crib" : "{s" + seat + "}'s hand"}: ${c.total}.`;
}

function endPlay(s, now) {
  s.seq = [];
  showStage(s, 0, now);
}

/** After a card is played (or a round ends): whose turn is next, the go, the last card. */
function afterPlay(s, seat, now) {
  const foe = other(seat), count = countOf(s.seq);
  if (s.won != null) { finish(s); return s; }
  if (count === 31) { s.seq = []; return lead(s, foe, now); }
  if (playable(s.hands[foe], count).length) { s.turn = foe; return s; }
  if (playable(s.hands[seat], count).length) {
    s.turn = seat;                                                                 // the other says go; this one plays on
    s.last = { ...s.last, go: foe };
    return s;
  }
  // neither can play: one for the last card played (the go)
  const none = !s.hands[0].length && !s.hands[1].length;
  peg(s, seat, 1);
  s.last = { seat, did: none ? "last" : "go", pts: 1 };
  s.say = none ? "One for last." : "One for go.";
  s.seq = [];
  if (s.won != null) { finish(s); return s; }
  if (none) { endPlay(s, now); return s; }
  return lead(s, foe, now);
}
/** A new round: `who` leads, or the other if they've no cards left. */
function lead(s, who, now) {
  if (!s.hands[0].length && !s.hands[1].length) { endPlay(s, now); return s; }
  s.turn = s.hands[who].length ? who : other(who);
  return s;
}

function startPlay(s) {
  s.step = "play";
  s.turn = other(s.dealer);
  s.seq = [];
  if (rankOf(s.starter) === 10) {                                                  // his heels
    peg(s, s.dealer, 2);
    s.last = { seat: s.dealer, did: "heels", pts: 2 };
    s.say = "His heels: two for the dealer.";
    if (s.won != null) finish(s);
  }
}

function pick(o) {
  const out = {};
  if (TO.includes(Number(o.to))) out.to = Number(o.to);
  return out;
}

export const rules = {
  id: "pegs",
  seats: { min: 2, max: 2 },

  deal({ options = {}, rng }) {
    const s = { seats: 2, opts: { ...DEFAULTS, ...pick(options) }, scores: [0, 0], prev: [0, 0], deal: 0 };
    newDeal(s, rng, true);
    s.say = `Deal 1. {s${s.dealer}} deals.`;
    return s;
  },

  toMove(s) {
    if (s.step === "play") return s.turn;
    if (s.step !== "discard") return null;
    const non = other(s.dealer);
    return s.hands[non].length === 6 ? non : s.hands[s.dealer].length === 6 ? s.dealer : null;
  },

  /** Either seat may move the count on. */
  anytime: m => m?.t === "next",

  act(s, seat, m, { rng, now }) {
    if (s.step === "show") {
      if (m?.t !== "next") return "Tap for the next count";
      if (s.won != null) { finish(s); return s; }
      if (s.show.stage < 2) { showStage(s, s.show.stage + 1, now); return s; }
      newDeal(s, rng, false);
      s.say = `Deal ${s.deal}.`;
      return s;
    }
    if (s.step === "discard") {
      if (m?.t !== "crib" || !Array.isArray(m.cards) || m.cards.length !== 2 || m.cards[0] === m.cards[1]) return "Pick two cards for the crib";
      if (s.hands[seat].length !== 6) return "You've sent yours";
      if (!m.cards.every(c => s.hands[seat].includes(c))) return "Those cards aren't in your hand";
      s.hands[seat] = s.hands[seat].filter(c => !m.cards.includes(c));
      s.keep[seat] = [...s.hands[seat]];
      s.crib.push(...m.cards);
      if (s.crib.length === 4) startPlay(s);
      return s;
    }
    if (s.step === "play") {
      if (seat !== s.turn) return "It isn't your turn";
      if (m?.t !== "play") return "Play a card";
      const c = m.card;
      if (!s.hands[seat].includes(c)) return "That card isn't in your hand";
      const count = countOf(s.seq);
      if (count + value(c) > 31) return "That would go over 31";
      s.hands[seat] = without(s.hands[seat], c);
      s.played[seat].push(c);
      s.seq.push({ seat, card: c });
      const sc = playScore(s.seq.map(e => e.card));
      peg(s, seat, sc.pts);
      s.last = { seat, did: "play", card: c, pts: sc.pts, why: sc.why.join(" and "), count: sc.count };
      s.say = `${sc.count}${sc.pts ? `: ${sc.why.join(" and ")} for ${sc.pts}` : ""}.`;
      return afterPlay(s, seat, now);
    }
    return "Not now";
  },

  bot: (s, seat, ctx) => botMove(s, seat, ctx),

  wakeAt: s => (s.step === "show" ? s.until : null),
  wake(s, { rng, now }) { return s.step === "show" ? rules.act(s, 0, { t: "next" }, { rng, now }) : null; },

  over: s => s.step === "over",
  restore,
};
