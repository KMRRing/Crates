// Cabal's computer player (README, Cabal), for playing alone: given the table and a seat, what that seat would send for the
// step in play, in the shapes the game reads (party-coup.js: { do, target }, { c }, { b }, { lose }, { keep }). It reads only
// what that player may know: its own cards, the coins, who has which cards face up, and what has been claimed; never
// another player's hidden hand (tests/party-coup-bot.mjs plays it against tables whose hidden cards are swapped for others
// and wants the same answer).
//
// It reckons as a careful player does. A claim is a bluff with some chance, more the fewer copies of that character
// are left unseen (three in the deck, less those face up and those in its own hand: with none left, a claim is a lie
// for certain). It takes the action that's worth most: its own characters at no risk, a bluff when the chance of being
// challenged is low or the prize large, an Oust at seven coins, and always at ten. It challenges when a claim is likely
// enough a bluff for the card it risks, blocks with what it holds and bluffs a block when the alternative is to lose an
// influence. Each computer player has its own temper (how readily it bluffs and how readily it believes a claim), by its seat.
import { CARDS, COPIES, ACTIONS, MUST_COUP, alive, blockers, challengers } from "./party-coup.js";

const hand = (s, u) => s.hand?.[u] || [];
const faceUp = (s, u) => s.dead?.[u] || [];
const deadOf = (s, c) => s.seats.reduce((n, u) => n + faceUp(s, u).filter(x => x === c).length, 0);
const deadAll = s => s.seats.reduce((n, u) => n + faceUp(s, u).length, 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** Who the step in play is waiting for. */
export function waiting(s) {
  switch (s.phase) {
    case "turn": return [s.turn];
    case "challenge": return challengers(s);
    case "block": return blockers(s);
    case "lose": return [s.loser];
    case "exchange": return [s.act.by];
    default: return [];
  }
}

/** The temper of the computer player in seat `i`: [how readily it bluffs, how readily it believes a claim]. */
export const TEMPER = [[1, 1], [1.15, .95], [.7, 1.1], [1, .9], [1.3, 1.1], [.85, 1]];
const temper = (s, uid) => TEMPER[Math.max(0, s.seats.indexOf(uid)) % TEMPER.length];

/**
 * The chance that `who` holds at least one copy of `card`, as seen by `uid`: of the copies not face up and not in
 * uid's own hand, how likely any is among the `who`'s hidden cards (a draw without replacement from every card uid
 * can't see).
 */
export function holds(s, uid, card, who) {
  const copies = COPIES - deadOf(s, card) - hand(s, uid).filter(c => c === card).length;
  const n = hand(s, who).length;
  if (copies <= 0 || n === 0) return 0;
  const unseen = CARDS.length * COPIES - deadAll(s) - hand(s, uid).length;
  let none = 1;
  for (let i = 0; i < n; i++) none *= Math.max(0, unseen - copies - i) / (unseen - i);
  return 1 - none;
}
/** The chance that at least one of `list` holds `card`. */
const anyHolds = (s, uid, card, list) => 1 - list.reduce((p, w) => p * (1 - holds(s, uid, card, w)), 1);

/** What an influence card is worth keeping. */
const KEEP = { duke: 5, assassin: 4.4, captain: 4.2, contessa: 3.2, ambassador: 2.6 };

/** The player most worth attacking: the richest with the most cards, a little at random. */
function target(s, uid, rng) {
  const foes = alive(s).filter(u => u !== uid);
  const score = u => (s.coins[u] || 0) * .7 + hand(s, u).length * 3 + rng() * 1.6;
  return foes.reduce((best, u) => (score(u) > score(best) ? u : best), foes[0]);
}

function chooseAction(s, uid, rng) {
  const coins = s.coins[uid], mine = hand(s, uid), foes = alive(s).filter(u => u !== uid), [bold] = temper(s, uid);
  const aim = target(s, uid, rng);                                         // who an Oust or a sabotage goes at
  if (coins >= MUST_COUP) return { do: "coup", target: aim };
  const has = c => mine.includes(c);
  // how likely a claim of this character is to be challenged: if none can exist, certainly; the rest by how scarce they are
  const chal = c => (COPIES - deadOf(s, c) <= 0 ? .97 : clamp(.22 + (COPIES - deadOf(s, c) < 2 ? .18 : 0) + (foes.length === 1 ? .1 : 0), 0, .9));
  const LOSS = 4.6;                                                        // what an influence is worth, in coins
  const CAUTION = .55;                                                     // measured: at a temper of 1 these players bluff about as much as pays
  const claim = (c, prize) => (has(c) ? prize : prize - chal(c) * LOSS / (bold * CAUTION) - .35);
  const options = [["income", 1.15]];
  options.push(["aid", 2 * (1 - .75 * anyHolds(s, uid, "duke", foes))]);
  options.push(["tax", claim("duke", 3.1)]);
  if (coins >= 7) options.push(["coup", 6.3]);
  const rich = foes.filter(u => s.coins[u] > 0).sort((a, b) => s.coins[b] - s.coins[a]);
  if (rich.length) {
    const t = rich[0], block = 1 - (1 - holds(s, uid, "captain", t)) * (1 - holds(s, uid, "ambassador", t));
    options.push(["steal", claim("captain", Math.min(2, s.coins[t]) * (1 - .7 * block) + .4)]);
  }
  if (coins >= 3) options.push(["assassinate", claim("assassin", 4.9 * (1 - .8 * holds(s, uid, "contessa", aim)) - 2.2)]);
  options.push(["exchange", claim("ambassador", has("ambassador") ? 1.4 : .9)]);
  let best = null, bestV = -Infinity;
  for (const [kind, v] of options) {
    const w = v + rng() * 1.1;
    if (w > bestV) { best = kind; bestV = w; }
  }
  if (!ACTIONS[best].target) return { do: best };
  return { do: best, target: best === "steal" ? rich[0] : aim };
}

/**
 * Whether to challenge the claim in play. The claimant holds the character with the chance `holds` gives; a claim is
 * made by a holder always and by a bluffer at the rate `RATE` (measured over thousands of games between these players), so what a claim
 * shows is the chance it is a bluff by Bayes, which is weighed against what a lost challenge costs.
 */
const RATE = { act: .37, block: .21 };
const DOUBT = 1.2;                                                         // and a temper of 1 here challenges about as often as pays
function challengeVote(s, uid, rng) {
  const { by, card, on } = s.claim, mine = hand(s, uid), k = mine.length, [, trust] = temper(s, uid), act = s.act;
  const pHas = holds(s, uid, card, by);
  if (pHas === 0) return { c: "challenge" };                              // every copy is in sight: a lie
  const liar = (1 - pHas) * RATE[on];
  // a won challenge costs a rival an influence, which helps every other player too; a lost one costs only the challenger
  let bluff = liar / (liar + pHas), need = [.5, .58, .64, .68, .7][Math.min(4, alive(s).length - 2)];
  if (on === "act" && act.target === uid) {
    if (act.kind === "assassinate") {                                    // it takes my card whether or not I'm right, unless I'm
      need = k === 1 ? 0 : mine.includes("contessa") ? .75 : .38;       // left with a card to lose twice over; a Kontor blocks it
    } else if (act.kind === "steal" && (mine.includes("captain") || mine.includes("ambassador"))) need = .75;
  } else if (on === "block" && act.by === uid) need = .42;               // the block is all that stops my own action
  else if (k === 1) need += .06;
  return { c: bluff + (rng() - .5) * .12 > need * trust * DOUBT ? "challenge" : "allow" };
}

function blockVote(s, uid, rng) {
  const kind = s.act.kind, mine = hand(s, uid), [bold] = temper(s, uid);
  const can = ACTIONS[kind].blockedBy.filter(c => mine.includes(c));
  if (can.length) return { b: can[Math.floor(rng() * can.length)] };
  const cards = ACTIONS[kind].blockedBy;
  let p = 0;
  if (kind === "aid") p = .06;
  else if (kind === "assassinate") p = mine.length === 1 ? .85 : .38;
  else if (kind === "steal") p = (s.coins[uid] || 0) >= 2 ? .2 : .06;
  return { b: rng() < p * bold ? cards[Math.floor(rng() * cards.length)] : "allow" };
}

function loseVote(s, uid, rng) {
  const cards = hand(s, uid);
  let worst = 0, low = Infinity;
  cards.forEach((c, i) => { const v = KEEP[c] + rng() * .6; if (v < low) { low = v; worst = i; } });
  return { lose: worst };
}

function exchangeVote(s, uid, rng) {
  const pool = [...hand(s, uid), ...s.exch.drawn], k = hand(s, uid).length, keep = [];
  for (let n = 0; n < k; n++) {
    let best = -1, bestV = -Infinity;
    pool.forEach((c, i) => {
      if (keep.includes(i)) return;
      const twice = keep.some(j => pool[j] === c);
      const v = KEEP[c] * (twice ? .45 : 1) + rng() * .5;
      if (v > bestV) { bestV = v; best = i; }
    });
    keep.push(best);
  }
  return { keep: keep.sort((a, b) => a - b) };
}

/** What seat `uid` sends for the step in play (only to be asked when it is one of `waiting(s)`). */
export function coupBot(s, uid, rng) {
  switch (s.phase) {
    case "turn": return chooseAction(s, uid, rng);
    case "challenge": return challengeVote(s, uid, rng);
    case "block": return blockVote(s, uid, rng);
    case "lose": return loseVote(s, uid, rng);
    case "exchange": return exchangeVote(s, uid, rng);
    default: return null;
  }
}
