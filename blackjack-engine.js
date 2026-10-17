// Blackjack's rules, pure (no page): a Macau table as Sands China's casinos run it, one seat, against the dealer. The
// cards from a continuous shuffler (each round's go back in, so every round is dealt from all six decks) or, for a
// table that has one, a shoe and its cut card; the round as the dealer deals it: a card to you, one face up to the
// dealer, a second to you, and the dealer's second card only after you've played (no hole card, as in Macau). Your
// plays: hit, stand, double, split, surrender, insurance, each where the table's rules allow it; the side bet Over/Under
// 13 on your first two cards; the dealer draws to 17 by the rules; everything settled. What basic strategy says of each
// hand comes from blackjack-strategy.js. The page (blackjack.js) draws it; tests/blackjack.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), rules, shoe (card ids), pos (the next card), cut (where the
// cut card lies), shoeNo, balance, bet (on the circle for the next round), side ({ over, under } beside it), lastBet,
// lastSide, round (the round on the table, or null: { hands: [{ cards, stake, doubled, doubledOn, fromSplit, done,
// surrendered }], active, dealer (cards), first (your first two cards, for Over/Under 13), side ({ over, under }
// staked), insurance (null: not offered or settled; "offered"; or the amount taken), phase ("insurance" | "play" |
// "over"), result }), rounds, peak, toppedUp }.
import { strategy, mayDouble } from "./blackjack-strategy.js";

// the table's rules, as Sands China's Macau tables are reported to deal (README, Blackjack): six decks through a
// continuous shuffler; the dealer stands on soft 17 and takes a second card only after the players; a dealer's
// blackjack takes only your original bet, the doubles and splits coming back (the DICJ's rules), except a double on 11,
// which it takes too (Sands China's own); double any two cards, after a split too; split to four hands, aces once (one
// card each); surrender against a 2 to a 10; blackjack 3 to 2. A shoe instead of the shuffler (continuous: false) puts
// the cut card at `penetration`.
export const RULES = { decks: 6, continuous: true, penetration: 0.75, s17: true, holeCard: false, obo: true, doubleOn11Lost: true, das: true, maxHands: 4, resplitAces: false, hitSplitAces: false, double: "any", surrender: "early-not-ace", bjPays: 1.5 };
export const START = 50000, MIN = 300, MAX = 50000, UNIT = 100;
export const CHIPS = [100, 500, 1000, 5000, 10000];
/** The side bet Over/Under 13: your first two cards, an ace one, over 13 or under it (one or the other: the rules allow
 * one side bet a box), even money; 13 loses either. */
export const SIDE = { min: 100, max: 5000 };
export const sideTotal = cards => cards.slice(0, 2).reduce((a, id) => a + value(id), 0);
export const sideNet = (kind, stake, total) => (!stake ? 0 : (kind === "over" ? total > 13 : total < 13) ? stake : -stake);
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
/** A card: id = rank × 4 + suit (rank 0 the ace … 12 the king; suit ♦ ♣ ♥ ♠ as cards.js draws them). */
export const rankOf = id => id >> 2;
export const suitOf = id => id & 3;
/** What a card counts: an ace 1 (or 11, see handOf), two to nine their pips, a ten or a court card ten. */
export const value = id => Math.min(10, rankOf(id) + 1);
/** A hand: { total, soft (an ace counting 11), bust }. */
export function handOf(cards) {
  const hard = cards.reduce((a, id) => a + value(id), 0), ace = cards.some(id => rankOf(id) === 0), soft = ace && hard + 10 <= 21;
  const total = soft ? hard + 10 : hard;
  return { total, soft, bust: total > 21 };
}
/** A blackjack: an ace and a ten-value card as a hand's first two cards, not after a split. */
export const isBlackjack = (cards, fromSplit = false) => !fromSplit && cards.length === 2 && handOf(cards).total === 21;

// ---------- chance ----------
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);

// ---------- the shoe ----------
/** A fresh shoe: the decks shuffled, the cut card where the rules' penetration puts it. */
function newShoe(s) {
  const shoe = [];
  for (let d = 0; d < s.rules.decks; d++) for (let id = 0; id < 52; id++) shoe.push(id);
  for (let i = shoe.length - 1; i > 0; i--) { const j = pick(s, i + 1); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
  s.shoe = shoe;
  s.pos = 0;
  s.cut = Math.round(shoe.length * s.rules.penetration);
}
const next = s => s.shoe[s.pos++];

/** A new game from a seed: the cards shuffled, your bankroll, nothing on the circle. */
export function newGame(seed, rules = RULES) {
  const s = { v: 1, seed: seed >>> 0, n: 0, rules: { ...rules }, shoe: [], pos: 0, cut: 0, shoeNo: 1, balance: START, bet: 0, side: { over: 0, under: 0 }, lastBet: 0, lastSide: { over: 0, under: 0 },
    round: null, rounds: 0, peak: START, toppedUp: 0 };
  newShoe(s);
  return s;
}

// ---------- what may be done ----------
const money = n => `HK$${n.toLocaleString("en-GB")}`;
/** Whether the bets may go down (the circle's, and Over/Under 13 beside it): the reason when not, or null. */
export function betProblem(bet, balance, side = {}) {
  if (!bet) return "No bet in the circle";
  if (bet % UNIT) return `Bets go in HK$${UNIT}s`;
  if (bet < MIN || bet > MAX) return `The table takes ${money(MIN)} to ${money(MAX)}`;
  if (side.over && side.under) return "Over or Under 13, not both";
  for (const k of ["over", "under"]) {
    const v = side[k] || 0;
    if (v && (v % UNIT || v < SIDE.min || v > SIDE.max)) return `Over/Under 13 takes ${money(SIDE.min)} to ${money(SIDE.max)}`;
  }
  if (bet + (side.over || 0) + (side.under || 0) > balance) return "That's more than you hold";
  return null;
}
/** What's at stake on the table this round: every hand's stake, the side bets and the insurance. */
export const staked = round => round.hands.reduce((a, h) => a + h.stake, 0) + (round.side?.over || 0) + (round.side?.under || 0) + (typeof round.insurance === "number" ? round.insurance : 0);
/**
 * The plays open to you now, as a set: "insure" and "noInsure" while insurance is offered; otherwise on the hand in play
 * "hit", "stand", "double" (two cards, the rules' totals, after a split only if they allow it, and the money to match),
 * "split" (a pair, hands to spare, the money), "surrender" (your first two cards, before anything else, where the rules
 * allow it against this up card).
 */
export function plays(game) {
  const r = game.round, out = new Set();
  if (!r || r.phase === "over") return out;
  if (r.phase === "insurance") return new Set(game.balance - staked(r) >= r.hands[0].stake / 2 ? ["insure", "noInsure"] : ["noInsure"]);
  const h = r.hands[r.active], { total, soft } = handOf(h.cards), spare = game.balance - staked(r);
  if (h.done) return out;
  out.add("hit").add("stand");
  if (h.cards.length === 2 && spare >= h.stake && mayDouble(total, soft, game.rules, h.fromSplit)) out.add("double");
  if (h.cards.length === 2 && isPair(h.cards) && r.hands.length < game.rules.maxHands && spare >= h.stake) out.add("split");
  const up = value(r.dealer[0]);
  if (r.hands.length === 1 && h.cards.length === 2 && (game.rules.surrender === "early" || game.rules.surrender === "late" || (game.rules.surrender === "early-not-ace" && up !== 1))) out.add("surrender");
  return out;
}

// ---------- a round ----------
/** A pair to split: two cards of one rank, as the rules define a pair (a jack and a queen aren't one). */
export const isPair = cards => cards.length === 2 && rankOf(cards[0]) === rankOf(cards[1]);
/**
 * Deals a round on the bets in the circle and beside it: { state, events } with events the cards as they come ({ to:
 * "you" | "dealer", hand, card }). Throws when the bets can't go down. A blackjack against a dealer showing 2–9 is paid
 * at once.
 */
export function deal(game) {
  const s = structuredClone(game), side = { over: s.side?.over || 0, under: s.side?.under || 0 }, problem = betProblem(s.bet, s.balance, side);
  if (problem) throw new Error(problem);
  // the shuffler takes every round's cards back; a shoe is changed once the cut card has come out
  if (s.rules.continuous) newShoe(s);
  else if (s.pos >= s.cut) { newShoe(s); s.shoeNo++; }
  const events = [], you = next(s), up = next(s), two = next(s);
  s.round = { hands: [{ cards: [you, two], stake: s.bet, doubled: false, doubledOn: 0, fromSplit: false, done: false, surrendered: false }], active: 0, dealer: [up], first: [you, two], side, insurance: null, phase: "play", result: null };
  events.push({ to: "you", hand: 0, card: you }, { to: "dealer", card: up }, { to: "you", hand: 0, card: two });
  if (s.rules.holeCard) { s.round.dealer.push(next(s)); events.push({ to: "dealer", card: s.round.dealer[1], hole: true }); }
  s.lastBet = s.bet;
  s.lastSide = side;
  if (value(up) === 1) {
    s.round.insurance = "offered";
    s.round.phase = "insurance";
  } else afterInsurance(s, events);
  return { state: s, events };
}
/** Once insurance is settled: the dealer's check for blackjack (with a hole card), your blackjack paid where it can be. */
function afterInsurance(s, events) {
  const r = s.round, up = value(r.dealer[0]), h = r.hands[0];
  r.phase = "play";
  if (s.rules.holeCard && (up === 1 || up === 10) && isBlackjack(r.dealer)) { h.done = true; finish(s, events); return; }
  // your blackjack ends your play: the dealer's second card says whether it's paid (against a 2–9 it always is) or pushed
  if (isBlackjack(h.cards)) { h.done = true; finish(s, events); }
}
/**
 * One play on the round: { state, events }. Throws if it isn't open (plays()). When the last hand is done, the dealer
 * plays and the round is settled (state.round.result: { lines: [{ hand, stake, net, why }], insurance, net }).
 */
export function act(game, play) {
  if (!plays(game).has(play)) throw new Error(`can't ${play} now`);
  const s = structuredClone(game), r = s.round, events = [];
  if (play === "insure" || play === "noInsure") {
    r.insurance = play === "insure" ? r.hands[0].stake / 2 : null;
    afterInsurance(s, events);
    return { state: s, events };
  }
  const h = r.hands[r.active];
  if (play === "hit") {
    h.cards.push(next(s));
    events.push({ to: "you", hand: r.active, card: h.cards.at(-1) });
    const { total, bust } = handOf(h.cards);
    if (bust || total === 21) h.done = true;
  } else if (play === "stand") h.done = true;
  else if (play === "double") {
    h.doubledOn = handOf(h.cards).total;
    h.stake *= 2;
    h.doubled = true;
    h.cards.push(next(s));
    events.push({ to: "you", hand: r.active, card: h.cards.at(-1), doubled: true });
    h.done = true;
  } else if (play === "split") {
    const second = { cards: [h.cards.pop()], stake: h.stake, doubled: false, doubledOn: 0, fromSplit: true, done: false, surrendered: false };
    h.fromSplit = true;
    r.hands.splice(r.active + 1, 0, second);
    deal2(s, r.active, events);
  } else if (play === "surrender") {
    h.surrendered = true;
    h.done = true;
  }
  advance(s, events);
  return { state: s, events };
}
/** A split hand's second card; split aces take just that one, and a 21 needs nothing more. */
function deal2(s, i, events) {
  const h = s.round.hands[i];
  h.cards.push(next(s));
  events.push({ to: "you", hand: i, card: h.cards.at(-1) });
  if ((rankOf(h.cards[0]) === 0 && !s.rules.hitSplitAces) || handOf(h.cards).total === 21) h.done = true;
}
/** On to the next hand not yet done (a split hand gets its second card as it comes up), or the dealer once all are. */
function advance(s, events) {
  const r = s.round;
  while (r.active < r.hands.length && r.hands[r.active].done) {
    r.active++;
    if (r.active < r.hands.length && r.hands[r.active].cards.length === 1) deal2(s, r.active, events);
  }
  if (r.active >= r.hands.length) { r.active = r.hands.length - 1; finish(s, events); }
}
/** The dealer's turn: the second card (without a hole card, dealt now), then to 17 if any hand is still in it; settled. */
function finish(s, events) {
  const r = s.round;
  if (r.dealer.length < 2) { r.dealer.push(next(s)); events.push({ to: "dealer", card: r.dealer[1] }); }
  else events.push({ to: "dealer", card: r.dealer[1], turned: true });
  const dealerBJ = isBlackjack(r.dealer);
  const live = r.hands.some(h => !h.surrendered && !handOf(h.cards).bust && !(isBlackjack(h.cards, h.fromSplit) && !dealerBJ));
  if (live && !dealerBJ) {
    for (;;) {
      const { total, soft } = handOf(r.dealer);
      if (total > 17 || (total === 17 && (!soft || s.rules.s17))) break;
      r.dealer.push(next(s));
      events.push({ to: "dealer", card: r.dealer.at(-1) });
    }
  }
  r.result = settle(r, s.rules);
  s.balance += r.result.net;
  s.peak = Math.max(s.peak, s.balance);
  s.rounds++;
  r.phase = "over";
  r.insurance = typeof r.insurance === "number" ? r.insurance : null;
  s.bet = s.lastBet <= s.balance ? s.lastBet : 0;
  s.side = s.lastBet + s.lastSide.over + s.lastSide.under <= s.balance ? { ...s.lastSide } : { over: 0, under: 0 };
}
/**
 * The round settled against the dealer's hand: each of yours (a blackjack 3 to 2, pushed by the dealer's; surrender half
 * lost; a bust lost; otherwise the nearer 21 winning even money), the dealer's blackjack taking every stake (or, where
 * the rules return all but the original bet, the original bet only, and a double on 11 with it where the table keeps
 * that), the insurance at 2 to 1, and Over/Under 13 on your first two cards.
 */
export function settle(round, rules) {
  const d = handOf(round.dealer), dealerBJ = isBlackjack(round.dealer), lines = [];
  const original = round.hands.length ? round.hands[0].stake / (round.hands[0].doubled ? 2 : 1) : 0;
  round.hands.forEach((h, i) => {
    const me = handOf(h.cards), bj = isBlackjack(h.cards, h.fromSplit);
    let net, why;
    // surrender gives up half; a late surrender without a hole card is lost whole to a dealer's blackjack
    if (h.surrendered) { net = dealerBJ && rules.surrender === "late" && !rules.holeCard ? -h.stake : -h.stake / 2; why = "surrendered"; }
    else if (bj) { net = dealerBJ ? 0 : h.stake * rules.bjPays; why = dealerBJ ? "push" : "blackjack"; }
    else if (dealerBJ) { net = -h.stake; why = "dealer blackjack"; }
    else if (me.bust) { net = -h.stake; why = "bust"; }
    else if (d.bust || me.total > d.total) { net = h.stake; why = d.bust ? "dealer bust" : "win"; }
    else if (me.total < d.total) { net = -h.stake; why = "lose"; }
    else { net = 0; why = "push"; }
    lines.push({ hand: i, stake: h.stake, net, why });
  });
  // a table returning all but the original bet to a dealer's blackjack: the doubles and split hands come back (but for
  // the second unit of a double on 11, at a table that keeps it)
  if (dealerBJ && rules.obo && !rules.holeCard) {
    const lost = lines.filter(l => l.why === "dealer blackjack").reduce((a, l) => a - l.net, 0);
    const kept = rules.doubleOn11Lost ? round.hands.filter(h => h.doubled && h.doubledOn === 11).reduce((a, h) => a + h.stake / 2, 0) : 0;
    const back = Math.max(0, lost - original - kept);
    let left = back;
    for (const l of [...lines].reverse()) { if (l.why !== "dealer blackjack" || !left) continue; const r = Math.min(left, -l.net); l.net += r; left -= r; }
  }
  const insurance = typeof round.insurance === "number" ? (dealerBJ ? round.insurance * 2 : -round.insurance) : 0;
  const total = sideTotal(round.first), side = { total, over: sideNet("over", round.side?.over, total), under: sideNet("under", round.side?.under, total) };
  return { lines, insurance, side, net: lines.reduce((a, l) => a + l.net, 0) + insurance + side.over + side.under, dealer: d.total, dealerBJ };
}

// ---------- advice ----------
const PLAY_OF = { H: "hit", S: "stand", D: "double", P: "split", R: "surrender", h: "hit", s: "stand", p: "split" };
/**
 * What basic strategy plays on the hand in play, among the plays open: "hit", "stand", "double", "split" or
 * "surrender", or "noInsure" while insurance is offered (it never pays on average). A double or a surrender that isn't
 * open falls back to what the chart says instead (D, R: hit; Ds, Rs: stand; Rp: split), and a split that isn't (four
 * hands out) to the chart for the total.
 */
export function advice(game) {
  const r = game.round, open = plays(game);
  if (!open.size) return null;
  if (r.phase === "insurance") return "noInsure";
  const chart = strategyFor(game.rules), h = r.hands[r.active], up = value(r.dealer[0]), { total, soft } = handOf(h.cards);
  const byTotal = () => (soft ? chart.soft[`${Math.max(total, 13)},${up}`] || "S" : total >= 17 ? "S" : chart.hard[`${Math.max(total, 5)},${up}`]);
  // the pair's cell first, then the total's; a double or a surrender with what the cell says instead
  const cells = [isPair(h.cards) ? chart.pairs[`${value(h.cards[0])},${up}`] : null, byTotal()].filter(Boolean);
  for (const cell of cells) for (const c of "DR".includes(cell[0]) ? [cell[0], cell[1] || "h"] : [cell[0]]) if (open.has(PLAY_OF[c])) return PLAY_OF[c];
  return open.has("hit") ? "hit" : "stand";
}
const charts = new Map();
/** Basic strategy for these rules, worked out once. */
export function strategyFor(rules) {
  const key = JSON.stringify(rules);
  if (!charts.has(key)) charts.set(key, strategy(rules));
  return charts.get(key);
}
