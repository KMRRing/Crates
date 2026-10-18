// Texas Hold'em as Macau deals it (Despacho 11/2008, 《德州撲克》法定規章), as a seats.js game: two to six players, each
// with two cards face down and five community cards turned up in three stages (three, one, one), a betting round after
// each stage, the best five of seven winning the pot. The button (指示器) moves one seat clockwise every hand; the
// player to its left posts the small blind (小盲注), the next the big blind (大盲注), and play starts to the left of the
// big blind, which is the last to act before the flop; after it the first player left of the button acts first and the
// button last (Articles 1, 5, 6). A raise is at least as big as the last bet or raise (Article 12); there is no limit on
// a bet but the chips in front of you (全押, all in: Article 11); a player may fold (蓋牌, Article 13). When the betting
// is done every player left shows their cards, the best five cards win, equal hands split the pot evenly and the odd
// chips go to the first of them left of the button (Article 10). The house takes 3 to 5% of each hand's pot as its
// commission (佣金), never more than five big blinds (Article 16).
//
// What the regulation leaves open is chosen here and said on the rules page: the blinds, the stacks, heads-up play (the
// button posts the small blind, acts first before the flop and last after), a bet short of a full raise not letting
// those who've acted raise again (the usual rule), side pots, and a busted player buying in again so the game goes on.
// A game is a number of hands (10, 20 or 40); whoever has won the most in them wins.
//
// A card is a number (holdem-eval.js): rank × 4 + suit. A state, kept as it is by the runner and the database, holds
// everything dealt (the hole cards and all five of the board, `seen` of them turned up): what a seat may see of it is
// the page's to draw, and what a computer player may use is its own cards and the board seen (holdem-bot.js).
import { shuffle } from "./seats.js";
import { score, describe, best5 } from "./holdem-eval.js";
import { botMove } from "./holdem-bot.js";

export const BLINDS = { small: 50, big: 100 };
export const STACK = 10000;                       // a buy-in: a hundred big blinds
export const HANDS = [10, 20, 40];
export const RAKES = [5, 3, 0];                   // the commission as a percentage of the pot: the regulation's most and least, or none
export const RAKE_CAP = 5;                        // big blinds: the most the house takes from one pot (Article 16)
export const DEFAULTS = { hands: 20, rake: 5, seats: 6 };
export const STREETS = ["Before the flop", "The flop", "The turn", "The river"];
export const SHOW_MS = 6500, FOLDED_MS = 2800, STREET_MS = 1500;

const clone = v => JSON.parse(JSON.stringify(v));
const sum = a => a.reduce((t, x) => t + x, 0);
const fmt = n => n.toLocaleString("en-GB");
const money = n => `HK$${fmt(n)}`;

// ---------- a state's reading ----------
export const alive = s => Array.from({ length: s.seats }, (_, i) => i).filter(i => !s.out[i]);
export const potOf = s => sum(s.put);
/** What a seat has won (or lost) in the game so far: its chips (those in the pot still its own until the hand is paid) less its buy-ins. */
export const netOf = (s, i) => s.stacks[i] + (s.step === "bet" || s.step === "runout" ? s.put[i] : 0) - s.buys[i] * STACK;
export const streetOf = s => (s.seen >= 5 ? 3 : s.seen === 4 ? 2 : s.seen === 3 ? 1 : 0);
/** The seat that posts the small blind and the one that posts the big: heads-up the button is the small blind. */
export const blindsOf = s => (s.seats === 2 ? { sb: s.button, bb: (s.button + 1) % 2 } : { sb: (s.button + 1) % s.seats, bb: (s.button + 2) % s.seats });
/** Clockwise from a seat: the seats after it, in order, ending with it. */
const after = (s, i) => Array.from({ length: s.seats }, (_, k) => (i + 1 + k) % s.seats);
/** A seat's place relative to the button: "button", "small blind", "big blind", or how many seats before the button ("cutoff", "hijack"…). */
export function placeOf(s, i) {
  const { sb, bb } = blindsOf(s);
  if (i === s.button && s.seats > 2) return "button";
  if (i === s.button) return "button and small blind";
  if (i === sb) return "small blind";
  if (i === bb) return "big blind";
  const k = (s.button - i + s.seats) % s.seats;             // seats before the button
  return k === 1 ? "cutoff" : k === 2 ? "hijack" : "early position";
}

/** What a seat may do now: { toCall, canCheck, canRaise, minTo, maxTo, pot, odds } (maxTo: all in; minTo: the least raise-to, or maxTo when only all in). */
export function legal(s, seat) {
  const stack = s.stacks[seat], toCall = Math.max(0, s.bet - s.bets[seat]), maxTo = s.bets[seat] + stack;
  const open = !s.closed[seat] && maxTo > s.bet;            // chips to raise with, and the betting not closed to them
  const pot = potOf(s);
  return {
    toCall: Math.min(toCall, stack), canCheck: toCall === 0, canRaise: open, maxTo,
    minTo: Math.min(maxTo, s.bet + s.raise), pot, odds: toCall ? Math.min(toCall, stack) / (pot + Math.min(toCall, stack)) : 0,
  };
}

const roundTo = (n, step) => Math.round(n / step) * step;
/** A raise-to the size of `frac` of the pot after calling, put on the table's steps and kept between the least and the most. */
export function sizeTo(s, seat, me, frac) {
  const to = s.bets[seat] + me.toCall + frac * (me.pot + me.toCall);
  return Math.max(me.minTo, Math.min(me.maxTo, roundTo(to, BLINDS.small)));
}
/** The raises a page offers a seat in one tap: the least, half the pot, three quarters, the pot, all in ([] when it can't raise). */
export function sizes(s, seat) {
  const me = legal(s, seat);
  if (!me.canRaise) return [];
  if (me.minTo >= me.maxTo) return [{ key: "all", label: "All in", to: me.maxTo }];
  return [{ key: "min", label: "Min", to: me.minTo }, { key: "half", label: "½ pot", to: sizeTo(s, seat, me, 0.5) }, { key: "three", label: "¾ pot", to: sizeTo(s, seat, me, 0.75) },
    { key: "pot", label: "Pot", to: sizeTo(s, seat, me, 1) }, { key: "all", label: "All in", to: me.maxTo }];
}

// ---------- a hand ----------
/**
 * A hand begun on this state: busted players buy in again, the button moves, the cards are dealt, the blinds posted.
 * The pack is dealt as the regulation has it: one card at a time round the table from the small blind, a card burned
 * before the flop, the turn and the river.
 */
function startHand(s, rng, now, fixed = null) {
  const n = s.seats;
  s.rebought = [];
  for (let i = 0; i < n; i++) if (s.stacks[i] <= 0) { s.stacks[i] = STACK; s.buys[i]++; s.rebought.push(i); }
  if (s.hand > 0) s.button = (s.button + 1) % n;
  s.hand++;
  const { sb, bb } = blindsOf(s), order = [sb, ...after(s, sb).filter(i => i !== sb)];
  const deck = fixed?.deck ?? shuffle(Array.from({ length: 52 }, (_, i) => i), rng);
  s.hole = Array.from({ length: n }, () => []);
  order.forEach((seat, k) => { s.hole[seat] = [deck[k], deck[n + k]]; });
  const b = 2 * n;
  s.board = [deck[b + 1], deck[b + 2], deck[b + 3], deck[b + 5], deck[b + 7]];
  s.seen = 0;
  s.out = Array(n).fill(false);
  s.bets = Array(n).fill(0);
  s.put = Array(n).fill(0);
  s.acted = Array(n).fill(false);
  s.closed = Array(n).fill(false);
  s.last = Array(n).fill("");
  s.open = false;
  s.raises = 0;                                              // bets and raises so far this round (the blinds aren't): the computer players read it
  s.log = [];                                                // every check, call and raise of the hand, in order: the coach reads what each seat has shown
  s.result = null;
  const post = (seat, amount, label) => {
    const a = Math.min(amount, s.stacks[seat]);
    s.stacks[seat] -= a; s.bets[seat] += a; s.put[seat] += a;
    s.last[seat] = s.stacks[seat] === 0 ? `allin ${s.bets[seat]}` : `${label} ${a}`;
  };
  post(sb, BLINDS.small, "small");
  post(bb, BLINDS.big, "big");
  s.bet = BLINDS.big;
  s.raise = BLINDS.big;
  s.step = "bet";
  s.turn = null;
  s.until = 0;
  s.say = `Hand ${s.hand} of ${s.opts.hands}. ${n === 2 ? "{s" + s.button + "} has the button and the small blind" : "{s" + s.button + "} has the button"}.`;
  advance(s, bb, now);
}

/** After a move, or at the start: whose turn it is, or the round over (the next cards, the run-out, the showdown). */
function advance(s, from, now) {
  const live = alive(s);
  if (live.length === 1) return uncontested(s, live[0], now);
  const canAct = live.filter(i => s.stacks[i] > 0);
  const top = Math.max(...live.map(i => s.bets[i]));
  const owing = canAct.filter(i => !s.acted[i] || s.bets[i] < s.bet);
  const alone = canAct.length <= 1 && canAct.every(i => s.bets[i] >= top);
  if (!alone && owing.length) {
    s.turn = after(s, from).find(i => owing.includes(i));
    return;
  }
  // the round is over
  s.turn = null;
  if (alone) {
    if (s.seen >= 5) return showdown(s, now);
    s.step = "runout";
    s.open = true;                                           // the hands are turned up while the board is run out
    s.until = now + STREET_MS;
    s.say = "All in: the cards are turned up.";
    return;
  }
  if (s.seen >= 5) return showdown(s, now);
  s.seen = s.seen === 0 ? 3 : s.seen + 1;
  s.bets = Array(s.seats).fill(0);
  s.acted = Array(s.seats).fill(false);
  s.closed = Array(s.seats).fill(false);
  s.bet = 0;
  s.raise = BLINDS.big;
  s.raises = 0;
  s.last = s.last.map((l, i) => (s.out[i] || l.startsWith("allin") ? l : ""));
  s.say = `${["", "The flop", "The turn", "The river"][streetOf(s)]}.`;
  advance(s, s.button, now);
}

/** The commission on a hand: the percentage of what was contested (not the bet nobody called), whole dollars, five big blinds at most. */
export function rakeOf(s) {
  if (!s.opts.rake) return 0;
  const put = [...s.put].sort((a, b) => b - a), contested = sum(put) - Math.max(0, put[0] - put[1]);
  return Math.min(Math.floor((contested * s.opts.rake) / 100), RAKE_CAP * BLINDS.big);
}

/**
 * The pot in its layers, as the all-ins make them: the main pot is what every player left can win, each side pot what
 * the players who put in more can win between them. [{ amount, seats }] (seats: who may win it). The chips of the top
 * contributor that nobody matched are a last layer of their own, `back: true`: they go back to that player, aren't
 * contested and aren't raked.
 */
export function layers(s) {
  const c = [...s.put], out = [], live = alive(s);
  const rank = [...c.keys()].sort((a, b) => c[b] - c[a]), top = rank[0], uncalled = c[top] - c[rank[1]];
  const back = uncalled > 0 && !s.out[top] ? uncalled : 0;
  c[top] -= back;
  for (;;) {
    const in_ = live.filter(i => c[i] > 0);
    if (!in_.length) break;
    const m = Math.min(...in_.map(i => c[i]));
    let amount = 0;
    for (let i = 0; i < s.seats; i++) { const t = Math.min(c[i], m); amount += t; c[i] -= t; }
    out.push({ amount, seats: in_ });
  }
  const dead = sum(c);                                       // chips of players who folded after putting in more than any hand left
  if (dead && out.length) out[out.length - 1].amount += dead;
  if (back) out.push({ amount: back, seats: [top], back: true });
  return out;
}

/** The pot paid out: stacks and the result set, the commission taken from the contested pot first (never from chips going back). */
function pay(s, wins, now, ms) {
  const rake = rakeOf(s);
  let owe = rake;
  const pots = layers(s).map(l => ({ ...l }));
  for (const p of pots) {
    if (!owe) break;
    if (p.back) continue;
    const t = Math.min(owe, p.amount);
    p.amount -= t; owe -= t;
  }
  const gain = Array(s.seats).fill(0), won = Array(s.seats).fill(0);
  for (const p of pots) {
    const winners = p.back ? p.seats : wins(p.seats), each = Math.floor(p.amount / winners.length), odd = p.amount - each * winners.length;
    const take = (i, n) => { gain[i] += n; if (!p.back) won[i] += n; };
    for (const w of winners) take(w, each);
    // the chips that won't divide go to the first of them left of the button (Article 10)
    if (odd) take(after(s, s.button).find(i => winners.includes(i)), odd);
    p.winners = winners;
  }
  for (let i = 0; i < s.seats; i++) s.stacks[i] += gain[i];
  const deltas = gain.map((g, i) => g - s.put[i]);
  s.house += rake;
  deltas.forEach((d, i) => { if (d > 0) s.wins[i]++; });
  s.result = { pots, rake, deltas, won };
  s.until = now + ms;
  s.step = "shown";
  s.turn = null;
}

function uncontested(s, winner, now) {
  pay(s, () => [winner], now, FOLDED_MS);
  s.result.uncontested = true;
  s.result.shown = [];
  const back = s.result.pots.filter(p => p.back).reduce((t, p) => t + p.amount, 0);
  s.say = `{s${winner}} wins ${money(s.result.won[winner])}, everyone else folded${back ? `; ${money(back)} comes back` : ""}.`;
}

function showdown(s, now) {
  const live = alive(s), sc = {};
  for (const i of live) sc[i] = score([...s.hole[i], ...s.board]);
  s.seen = 5;
  pay(s, seats => { const best = Math.max(...seats.map(i => sc[i])); return seats.filter(i => sc[i] === best); }, now, SHOW_MS);
  s.open = true;
  s.result.shown = live.map(i => { const d = describe(sc[i]); return { seat: i, text: d.text, zh: d.zh, name: d.name, five: best5([...s.hole[i], ...s.board]) }; });
  const main = s.result.pots[0], w = main.winners, hand = s.result.shown.find(x => x.seat === w[0]);
  s.say = w.length === 1 ? `{s${w[0]}} wins ${money(s.result.won[w[0]])} with ${hand.text.toLowerCase()}.` : `${w.map(i => `{s${i}}`).join(" and ")} split the pot with ${hand.text.toLowerCase()}.`;
}

function finish(s) {
  const nets = Array.from({ length: s.seats }, (_, i) => s.stacks[i] - s.buys[i] * STACK), top = Math.max(...nets);
  s.step = "over";
  s.turn = null;
  s.nets = nets;
  s.winners = nets.map((n, i) => (n === top ? i : -1)).filter(i => i >= 0);
  s.say = s.winners.length === 1 ? `That's the game: {s${s.winners[0]}} is ahead by ${money(top)}.` : `That's the game: a tie at ${money(top)}.`;
}

/** A new game's first hand. `fixed` (for tests): { deck, button, stacks } to deal from. */
export function fresh({ seats, options = {}, rng, now = 0, fixed = null }) {
  const hands = HANDS.includes(options.hands) ? options.hands : DEFAULTS.hands;
  const rake = RAKES.includes(options.rake) ? options.rake : DEFAULTS.rake;
  const s = {
    v: 1, seats, opts: { hands, rake }, hand: 0, button: fixed?.button ?? Math.floor(rng() * seats),
    stacks: fixed?.stacks ? [...fixed.stacks] : Array(seats).fill(STACK), buys: Array(seats).fill(1),
    house: 0, wins: Array(seats).fill(0),                      // the commission taken in all, and the hands each seat has won
  };
  startHand(s, rng, now, fixed);
  return s;
}

/** The move for a seat when it's the table's turn, checked as the regulation has it: { t: "fold" | "check" | "call" | "raise", to }. */
function act(s, seat, m, { now }) {
  if (s.step !== "bet" || s.turn !== seat) return "It isn't your turn";
  const stack = s.stacks[seat], toCall = Math.max(0, s.bet - s.bets[seat]), me = `{s${seat}}`;
  const before = { pot: potOf(s), was: s.bet, seen: s.seen };
  // what a seat did, for the record: its bet this round after it, what it faced, and the pot and the bet it met
  const note = t => s.log.push({ i: seat, t, to: s.bets[seat], faced: toCall, ...before, ...(s.stacks[seat] === 0 ? { all: 1 } : {}) });
  const put = (amount, label) => {
    s.stacks[seat] -= amount; s.bets[seat] += amount; s.put[seat] += amount;
    s.last[seat] = s.stacks[seat] === 0 ? `allin ${s.bets[seat]}` : `${label} ${s.bets[seat]}`;
  };
  switch (m?.t) {
    case "fold":
      s.out[seat] = true;
      s.last[seat] = "fold";
      s.say = `${me} folds.`;
      break;
    case "check":
      if (toCall) return `There's ${money(toCall)} to call: call, raise or fold`;
      s.acted[seat] = true;
      s.last[seat] = "check";
      note("check");
      s.say = `${me} checks.`;
      break;
    case "call": {
      if (!toCall) return "There's nothing to call: check, or bet";
      const a = Math.min(toCall, stack);
      put(a, "call");
      s.acted[seat] = true;
      note("call");
      s.say = s.stacks[seat] === 0 ? `${me} calls and is all in.` : `${me} calls ${money(a)}.`;
      break;
    }
    case "raise": {
      const to = Number(m.to), maxTo = s.bets[seat] + stack;
      if (!Number.isInteger(to)) return "Say what to raise to";
      if (to > maxTo) return `You have ${money(stack)} behind: ${money(maxTo)} is the most`;
      if (s.closed[seat]) return "The last all-in was short of a full raise: you can call or fold";
      if (to <= s.bet) return toCall ? `That's no raise: call ${money(toCall)}, or raise to ${money(Math.min(maxTo, s.bet + s.raise))} or more` : `Bet at least ${money(Math.min(maxTo, s.raise))}`;
      const allIn = to === maxTo, full = to - s.bet >= s.raise;
      if (!full && !allIn) return `The least you can raise to is ${money(s.bet + s.raise)}`;
      const was = s.bet, verb = was === 0 ? "bets" : "raises to";
      put(to - s.bets[seat], was === 0 ? "bet" : "raise");
      if (full) {
        s.raise = to - was;
        for (let i = 0; i < s.seats; i++) if (i !== seat) { s.acted[i] = false; s.closed[i] = false; }
      } else {
        // a short all-in: those who had acted may call it but not raise again
        for (let i = 0; i < s.seats; i++) if (i !== seat) { s.closed[i] = s.closed[i] || s.acted[i]; s.acted[i] = false; }
      }
      s.bet = to;
      s.raises++;
      s.acted[seat] = true;
      s.closed[seat] = false;
      note("raise");
      s.say = allIn ? `${me} is all in for ${money(to)}.` : `${me} ${verb} ${money(to)}.`;
      break;
    }
    default: return "Fold, check, call or raise";
  }
  advance(s, seat, now);
  return s;
}

export const rules = {
  id: "holdem",
  seats: { min: 2, max: 6 },
  deal: ({ seats, options, rng, now }) => fresh({ seats, options, rng, now }),
  toMove: s => (s.step === "bet" ? s.turn : null),
  act,
  bot: (s, seat, ctx) => botMove(s, seat, ctx),
  over: s => s.step === "over",
  wakeAt: s => (s.step === "runout" || s.step === "shown" ? s.until : null),
  wake(s, { rng, now }) {
    if (s.step === "runout") {
      // the river gets its moment before the result: turned up, a beat, then the showdown
      if (s.seen >= 5) showdown(s, now);
      else { s.seen = s.seen < 3 ? 3 : s.seen + 1; s.until = now + STREET_MS; s.say = `${["", "", "", "The flop", "The turn", "The river"][s.seen]}.`; }
      return s;
    }
    if (s.step === "shown") {
      if (s.hand >= s.opts.hands) finish(s); else startHand(s, rng, now);
      return s;
    }
    return null;
  },
  /** What the database gave back: empty lists and objects and nulls are gone. */
  restore(s) {
    s.rebought ||= [];
    s.raises ??= 0;
    s.log ||= [];
    s.house ??= 0;
    s.wins ||= Array(s.seats).fill(0);
    s.turn ??= null;
    s.until ??= 0;
    if (s.result) { s.result.pots ||= []; s.result.shown ||= []; s.result.won ||= Array(s.seats).fill(0); for (const p of s.result.pots) p.winners ||= []; }
    return s;
  },
};
export const copy = clone;
