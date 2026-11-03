// Tarot (tarot-rules.js, tarot-bot.js, tarot-sim.js): the pack and its points, the deals for three, four and five, the
// bidding, the dog and the discard, the five-player call, what a hand may play (suit, trump, over-trump, the Excuse), who
// wins, the Excuse's exchange and its last-trick rule, the handfuls, the petit au bout, the slam, the score of a deal
// against the worked examples pagat.com and the Fédération Française de Tarot print, whole games of computer players with
// every card accounted for and the scores balancing, the sampling of the cards a seat can't see, and the state through
// the database.
import {
  rules, PTS, EXCUSE, PETIT, GRAND, SIZES, TARGETS, POIGNEE, BIDS, suitCard, suitOf, rankOf, legalCards, winnerOf, contractOf, dealValue,
  payments, checkDiscard, callable, legalFor, checkPoignee, poigneeLevels, settle, sortHand, isBout, isKing,
} from "../tarot-rules.js";
import { botMove as playerMove, strength, chooseDiscard, LEVELS } from "../tarot-bot.js";
import { sample, simOf, scoreMoves } from "../tarot-sim.js";
import { newRecord, applyMove, applyWake, botMove, seeded } from "../seats.js";
import { roundTrip, same } from "./rtdb.js";

let bad = 0;
const ok = (c, what) => { console.log(`${c ? "ok  " : "FAIL"} ${what}`); if (!c) bad++; };
const K = (s, r) => suitCard(s, r), KING = 13, QUEEN = 12, KNIGHT = 11, JACK = 10;

// ---------- the pack ----------
{
  ok(PTS.length === 78 && PTS.reduce((a, b) => a + b, 0) === 182, "seventy-eight cards worth 182 halves, the 91 points of the books");
  const bouts = [...Array(78).keys()].filter(isBout);
  ok(bouts.length === 3 && bouts.includes(PETIT) && bouts.includes(GRAND) && bouts.includes(EXCUSE) && bouts.reduce((t, c) => t + PTS[c], 0) === 27, "three bouts of 4½ points each");
  ok([0, 1, 2, 3].every(s => [...Array(14).keys()].reduce((t, r) => t + PTS[K(s, r)], 0) === 34), "a suit is worth 17 points: king 4½, queen 3½, knight 2½, jack 1½, ten cards ½ each");
  ok(PTS[1] === 1 && PTS[19] === 1 && PTS[K(2, KING)] === 9 && PTS[K(2, QUEEN)] === 7 && PTS[K(2, KNIGHT)] === 5 && PTS[K(2, JACK)] === 3, "a plain trump and the small cards ½, the court 4½ 3½ 2½ 1½");
  ok(TARGETS.join() === "56,51,41,36" && BIDS.map(b => b.mult).join() === "0,1,2,4,6", "contracts 56, 51, 41, 36 by bouts; Petite ×1, Garde ×2, sans ×4, contre ×6");
}

// ---------- the deal ----------
const O = { deals: 3 };
const G0 = (seats, seed = 1, opts = {}) => newRecord(rules, { seats, options: { ...O, petitSec: false, ...opts }, seed, now: 0 });
for (const n of [3, 4, 5]) {
  const s = G0(n, 5).state, { hand, dog } = SIZES[n];
  const all = [...s.hands.flat(), ...s.dog];
  ok(s.hands.length === n && s.hands.every(h => h.length === hand) && s.dog.length === dog && new Set(all).size === 78, `${n} players: ${hand} cards each and ${dog} in the dog, every card dealt once`);
  ok(s.step === "bid" && s.turn === (s.dealer + 1) % n && s.first === s.turn, `${n} players: the player after the dealer bids first`);
}
{
  // a hand with the petit and no other trump voids the deal (FFT, petit sec); the Excuse counts as a trump
  let found = 0, seed = 1;
  for (; seed < 4000 && !found; seed++) {
    const s = G0(4, seed, { petitSec: true }).state;
    if (s.step === "thrown") { found = seed; ok(s.why.sec != null && s.hands[s.why.sec].includes(PETIT) && !s.hands[s.why.sec].some(c => c !== PETIT && c <= EXCUSE), "a petit sec voids the deal and is shown"); }
  }
  ok(found > 0, "petit sec turns up in a few thousand deals");
  const G = G0(4, found, { petitSec: true });
  const w = applyWake(rules, G, G.state.until + 1);
  ok(w && w.state.step !== undefined && w.state.deal === 1 && w.state.dealer === (G.state.dealer + 1) % 4, "it's dealt again by the next dealer, the same deal number");
}

// ---------- bidding ----------
{
  const G = G0(4, 3), s = G.state, a = s.first, b = (a + 1) % 4, c = (a + 2) % 4, d = (a + 3) % 4;
  ok(applyMove(rules, G, b, { t: "bid", n: 1 }).error === "It isn't your turn", "bids go in turn");
  let g = applyMove(rules, G, a, { t: "bid", n: 1 }).G;
  ok(/more than Petite/.test(applyMove(rules, g, b, { t: "bid", n: 1 }).error || ""), "a bid must be higher than the last");
  g = applyMove(rules, g, b, { t: "bid", n: 2 }).G;
  g = applyMove(rules, g, c, { t: "bid", n: 0 }).G;
  g = applyMove(rules, g, d, { t: "bid", n: 0 }).G;
  const t = g.state;
  ok(t.taker === b && t.bid === 2 && t.step === "discard" && t.turn === b && t.hands[b].length === 24 && t.dogSeen, "the highest bid takes the dog (Garde: turned up, six cards added to the hand)");
  let h = G;
  for (const x of [a, b, c, d]) h = applyMove(rules, h, x, { t: "bid", n: 0 }).G;
  ok(h.state.step === "thrown" && h.state.deal === 1, "everyone passing throws the hands in");
  const w = applyWake(rules, h, h.state.until + 1);
  ok(w.state.step === "bid" && w.state.deal === 1 && w.state.dealer === (s.dealer + 1) % 4, "and the next dealer deals again");
  // Garde contre cannot be overbid: it ends the bidding
  let k = applyMove(rules, G, a, { t: "bid", n: 4 }).G;
  ok(k.state.taker === a && k.state.step === "announce" && k.state.piles[1].length === 6 && k.state.hands[a].length === 18, "Garde contre ends the bidding at once; the dog stays face down and goes to the defence");
  k = applyMove(rules, G, a, { t: "bid", n: 3 }).G;
  k = applyMove(rules, k, b, { t: "bid", n: 0 }).G; k = applyMove(rules, k, c, { t: "bid", n: 0 }).G; k = applyMove(rules, k, d, { t: "bid", n: 0 }).G;
  ok(k.state.step === "announce" && k.state.piles[0].length === 6 && !k.state.dogSeen, "Garde sans: the dog goes face down to the taker's side");
}

// ---------- the discard ----------
{
  const hand = sortHand([PETIT, GRAND, EXCUSE, 5, 7, 9, K(0, KING), K(0, 3), K(0, 4), K(1, QUEEN), K(1, 2), K(2, 5), K(3, 6), K(3, KING), K(3, 1)]);
  ok(checkDiscard(hand, [K(0, 3), K(0, 4), K(1, 2)], 3) === "", "plain cards may be discarded");
  ok(checkDiscard(hand, [K(0, KING), K(0, 3), K(0, 4)], 3) !== "", "a king may not");
  ok(checkDiscard(hand, [GRAND, K(0, 3), K(0, 4)], 3) !== "" && checkDiscard(hand, [EXCUSE, K(0, 3), K(0, 4)], 3) !== "" && checkDiscard(hand, [PETIT, K(0, 3), K(0, 4)], 3) !== "", "nor a bout");
  ok(checkDiscard(hand, [5, K(0, 3), K(0, 4)], 3) !== "", "a trump only when there is nothing else");
  const poor = sortHand([PETIT, GRAND, EXCUSE, 5, 7, 9, 11, 12, K(0, KING), K(1, KING), K(2, KING), K(3, KING), K(0, 3), K(1, 2), K(2, 5)]);
  ok(checkDiscard(poor, [K(0, 3), K(1, 2), K(2, 5), 5, 7], 5) === "" && checkDiscard(poor, [K(0, 3), K(1, 2), K(2, 5), 5, 7].slice(0, 4), 5) !== "", "with too few plain cards the lowest... any trumps are discarded, and shown");
  ok(checkDiscard(poor, [K(0, 3), K(1, 2), 5, 7, 9], 5) !== "", "all the plain cards go first");
  let good = true;
  for (let seed = 1; seed < 60; seed++) {
    const s = G0(4, seed).state;
    const h = sortHand([...s.hands[0], ...s.dog]);
    if (checkDiscard(h, chooseDiscard(h, 6), 6) !== "") { good = false; break; }
  }
  ok(good, "the computer's discard is always lawful");
}

// ---------- the call (five players) ----------
{
  const h = sortHand([K(0, KING), K(1, KING), K(2, KING), K(3, KING), PETIT, 3, 4, 5, 6, 7, 8, K(0, 3), K(1, 3), K(2, 3), K(3, 3)]);
  ok(callable(h).slice(0, 4).every(c => rankOf(c) === KING) && callable(h).length === 8 && callable(h).slice(4).every(c => rankOf(c) === QUEEN), "all four kings held: the queens may be called as well");
  ok(callable(sortHand([K(0, KING), 3, 4])).length === 4, "otherwise only the kings");
  // a game: the taker calls, the king's holder is the partner once it is played, the dog holding it makes the taker alone
  let g = G0(5, 8), s = g.state;
  const first = s.first;
  for (let i = 0; i < 5; i++) { const seat = (first + i) % 5; g = applyMove(rules, g, seat, { t: "bid", n: seat === first ? 2 : 0 }).G; }
  s = g.state;
  ok(s.step === "call" && s.turn === first, "five players: the taker calls first, before the dog is turned");
  ok(/king/.test(applyMove(rules, g, first, { t: "call", card: K(0, 3) }).error || ""), "only a king may be called");
  const mine = s.hands[first];
  const target = callable(mine).find(c => !mine.includes(c) && s.hands.some((h, i) => i !== first && h.includes(c)));
  const holder = s.hands.findIndex(h => h.includes(target));
  let g2 = applyMove(rules, g, first, { t: "call", card: target }).G;
  ok(g2.state.partner === holder && !g2.state.alone && !g2.state.revealed && g2.state.step === "discard" && g2.state.hands[first].length === 18, "the partner is whoever holds it, and nobody knows");
  const own = mine.find(isKing);
  if (own != null) { const g3 = applyMove(rules, g, first, { t: "call", card: own }).G; ok(g3.state.alone && g3.state.partner === null, "calling a king of your own hand plays alone"); }
  const inDog = s.dog.find(c => callable(mine).includes(c));
  if (inDog != null) { const g4 = applyMove(rules, g, first, { t: "call", card: inDog }).G; ok(g4.state.alone && g4.state.revealed, "a called king in the dog: the taker plays alone, and it's seen"); }
}
{
  // the first lead may not be the called king's suit (FFT), unless it is the king itself
  const s = G0(5, 2).state;
  s.step = "play"; s.taker = 0; s.call = K(1, KING); s.turn = 3; s.first = 3;
  s.hands[3] = sortHand([K(1, KING), K(1, 4), K(2, 7), 6, EXCUSE]);
  const l = legalFor(s, 3);
  ok(l.includes(K(1, KING)) && !l.includes(K(1, 4)) && l.includes(K(2, 7)) && l.includes(6), "the opening lead can't be the called suit, but the called king itself may be led");
  s.hands[3] = sortHand([K(1, 4), K(1, 5)]);
  ok(legalFor(s, 3).length === 2, "...unless there is no other card");
}

// ---------- what may be played, and who wins ----------
{
  const P = (...cs) => cs.map((card, i) => ({ seat: i, card }));
  const h = sortHand([K(0, 3), K(0, 9), K(1, KING), 4, 10, 15, EXCUSE]);
  ok(legalCards(h, P(K(0, 5))).sort().join() === [K(0, 3), K(0, 9), EXCUSE].sort().join(), "follow suit (the Excuse is always allowed)");
  ok(legalCards(h, P(K(2, 5))).sort((a, b) => a - b).join() === [4, 10, 15, EXCUSE].join(), "no card of the suit: you must trump");
  ok(legalCards(h, P(K(2, 5), 12)).sort((a, b) => a - b).join() === [15, EXCUSE].join(), "and over-trump a trump already played if you can");
  ok(legalCards(h, P(K(2, 5), 17)).sort((a, b) => a - b).join() === [4, 10, 15, EXCUSE].join(), "if you can't over-trump you still must trump");
  ok(legalCards(h, P(8)).sort((a, b) => a - b).join() === [10, 15, EXCUSE].join(), "a trump led: a higher trump");
  ok(legalCards(h, P(18)).sort((a, b) => a - b).join() === [4, 10, 15, EXCUSE].join(), "...or any trump if none is higher");
  const nt = sortHand([K(0, 3), K(1, 2), K(1, 9)]);
  ok(legalCards(nt, P(K(2, 5))).length === 3 && legalCards(nt, P(5)).length === 3, "no trump and no card of the suit: anything");
  ok(legalCards(h, P(EXCUSE)).length === h.length, "after a led Excuse, a free card");
  ok(legalCards(h, P(EXCUSE, K(0, 5))).sort().join() === [K(0, 3), K(0, 9), EXCUSE].sort().join(), "...and the suit is the next card's");
  ok(winnerOf(P(K(0, 5), K(0, 9), 3, K(0, KING))) === 2, "the highest trump wins");
  ok(winnerOf(P(K(0, 5), K(0, 9), K(1, KING), K(0, KING))) === 3, "else the highest card of the suit led");
  ok(winnerOf(P(EXCUSE, K(1, 3), K(2, KING))) === 1, "the Excuse never wins; the next card sets the suit");
  ok(winnerOf(P(K(0, 5), 20, EXCUSE, 19)) === 1, "the 21 beats every trump");
}

// ---------- the worked examples ----------
{
  const val = (made, diff, bid, extra = {}) => dealValue({ made, margin: Math.abs(diff), bid, ...extra });
  // pagat.com
  ok(val(true, 15, 2) === 80, "pagat: Garde, 56 points with two bouts: (25 + 15) × 2 = 80");
  ok(val(true, 13, 2, { petit: 10 }) === 96, "pagat: 49 points with three bouts and the petit au bout: (25 + 13 + 10) × 2 = 96");
  ok(val(true, 0, 2, { petit: -10 }) === 30, "pagat: 41 with two bouts, the defence takes the petit au bout: (25 + 0 − 10) × 2 = 30");
  ok(val(true, 4, 2, { poignee: 20 }) === 78, "pagat: (25 + 4) × 2 + 20 for a poignée = 78");
  // the FFT
  ok(val(true, 8, 2, { petit: 10, poignee: 20 }) === 106, "FFT A: Garde, 49 with two bouts, poignée and petit au bout: 66 + 20 + 20 = 106");
  ok(val(true, 4, 3, { petit: -10 }) === 76, "FFT B: sans, +4, the defence has the petit au bout: 116 − 40 = 76");
  ok(val(false, 7, 1, { petit: 10, poignee: 20 }) === -42, "FFT C: Petite, −7, poignée for the defence, the petit au bout for the taker: −32 + 10 − 20 → 42 to each defender");
  ok(val(true, 11, 2, { poignee: 20 }) === 92, "FFT D: Garde, +11, a poignée: 72 + 20 = 92");
  ok(val(true, 46, 2, { petit: 10, poignee: 20, chelem: 400 }) === 582, "FFT E: Garde, announced slam made, poignée, petit au bout, 87 points: 142 + 20 + 20 + 400 = 582");
  ok(payments(4, 1, null, 106).join() === "-106,318,-106,-106" && payments(4, 1, null, 76)[1] === 228, "four players: the taker marks three times each defender's (+318, +228)");
  ok(payments(3, 0, null, 50).join() === "100,-50,-50", "three players: the taker doubles");
  ok(payments(5, 2, 4, 50).join() === "-50,-50,100,-50,50" && payments(5, 2, null, 50).join() === "-50,-50,200,-50,-50", "five players: taker two, partner one; alone, four");
  // half points go to the winner (the books count them in pairs; a side that is half a point short is a point short)
  const base = [PETIT, GRAND, K(0, KING), K(1, KING), K(2, KING), K(3, KING), K(0, QUEEN), K(1, QUEEN), K(2, QUEEN), K(1, KNIGHT)];   // 18 + 36 + 21 + 5 = 80
  let r = contractOf([...base, K(0, 1), K(0, 2)]);
  ok(r.bouts === 2 && r.ptsH === 82 && r.made && r.margin === 0, "41 points with two bouts makes the contract by none");
  r = contractOf([...base, K(0, 1)]);
  ok(r.ptsH === 81 && !r.made && r.margin === 1, "FFT: 40½ with two bouts: a point short");
  r = contractOf([...base, K(0, 1), K(0, 2), K(0, 3)]);
  ok(r.ptsH === 83 && r.made && r.margin === 1, "FFT: 41½ makes it by one");
}

// ---------- plays: crafted positions ----------
/** A four-player deal in play with the given hands, the taker 0 (partner none). */
function crafted(hands, { n = 4, taker = 0, partner = null, turn = 0, tricks = [], won = [0, 0], piles = [[], []], bid = 2, chelem = false } = {}) {
  const s = G0(n, 1).state;
  s.step = "play"; s.taker = taker; s.partner = partner; s.bid = bid; s.turn = turn; s.chelem = chelem;
  s.hands = hands.map(h => sortHand(h)); s.tricks = tricks; s.won = won; s.piles = piles; s.base = [0, 0]; s.dog = []; s.trick = { plays: [] };
  s.scores = Array(n).fill(0);
  return s;
}
const act = (s, seat, move) => { const r = rules.act(JSON.parse(JSON.stringify(s)), seat, move, { rng: () => 0.5, now: 0 }); return r; };
{
  // the Excuse: a trick won by the other side, the Excuse's side keeps it and owes a half-point card
  let s = crafted([[EXCUSE, K(0, 2), K(0, 3)], [K(0, KING), K(0, 4)], [K(0, 5), K(0, 6)], [K(0, 7), K(0, 8)]], { piles: [[K(1, 2)], []] });
  s = act(s, 0, { t: "play", card: EXCUSE }); s = act(s, 1, { t: "play", card: K(0, KING) }); s = act(s, 2, { t: "play", card: K(0, 5) }); s = act(s, 3, { t: "play", card: K(0, 7) });
  ok(s.tricks.length === 1 && s.tricks[0].win === 1 && s.piles[0].includes(EXCUSE) && s.piles[1].includes(K(0, KING)) && !s.piles[1].includes(EXCUSE), "the Excuse played into the defence's trick stays with the taker's side");
  ok(s.piles[1].includes(K(1, 2)) && !s.piles[0].includes(K(1, 2)) && s.debt[0] === 0, "...which pays the defence a half-point card from the tricks it holds (here the one it had)");
  // a side with no card to give owes it until it wins a trick
  let t = crafted([[EXCUSE, K(0, 2), K(0, 3)], [K(0, KING), K(0, 4)], [K(0, 5), K(0, 6)], [K(0, 7), K(0, 8)]]);
  t = act(t, 0, { t: "play", card: EXCUSE }); t = act(t, 1, { t: "play", card: K(0, KING) }); t = act(t, 2, { t: "play", card: K(0, 5) }); t = act(t, 3, { t: "play", card: K(0, 7) });
  ok(t.debt[0] === 1 && t.turn === 1, "with no half-point card yet, the debt waits");
  t = act(t, 1, { t: "play", card: K(0, 4) }); t = act(t, 2, { t: "play", card: K(0, 6) }); t = act(t, 3, { t: "play", card: K(0, 8) });
  ok(t.turn === 1 && t.debt[0] === 0 || t.debt[0] === 1, "(a debt is paid from the first trick that side wins with a half-point card)");
  // the defence plays the Excuse into the taker's trick: it keeps it and owes the taker's side a card
  let u = crafted([[K(0, KING), K(0, 2)], [EXCUSE, K(0, 4)], [K(0, 5), K(0, 6)], [K(0, 7), K(0, 8)]]);
  for (const [seat, card] of [[0, K(0, KING)], [1, EXCUSE], [2, K(0, 5)], [3, K(0, 7)]]) u = act(u, seat, { t: "play", card });
  ok(u.tricks[0].win === 0 && u.piles[1].includes(EXCUSE) && u.piles[0].includes(K(0, KING)) && u.debt[1] === 1, "the defence's Excuse in the taker's trick stays with the defence, which owes a card");
}
{
  // the last trick: the Excuse changes sides, unless its side has won every trick before
  const mk = (won, plays) => {
    const total = SIZES[4].hand, tr = Array.from({ length: total - 1 }, (_, i) => ({ plays: [{ seat: 0, card: 0 }], win: 0 }));
    return crafted(plays.map(c => [c]), { turn: 0, tricks: tr, won });
  };
  let s = mk([8, 9], [EXCUSE, K(0, 4), K(0, 5), K(0, 6)]);
  for (const [seat, card] of [[0, EXCUSE], [1, K(0, 4)], [2, K(0, 5)], [3, K(0, 6)]]) s = act(s, seat, { t: "play", card });
  ok(s.step === "shown" && s.piles[1].includes(EXCUSE) && s.piles[0].every(c => c !== EXCUSE), "the Excuse in the last trick goes to the other side");
  let t = mk([17, 0], [EXCUSE, K(0, 4), K(0, 5), K(0, 6)]);
  for (const [seat, card] of [[0, EXCUSE], [1, K(0, 4)], [2, K(0, 5)], [3, K(0, 6)]]) t = act(t, seat, { t: "play", card });
  ok(t.step === "shown" && t.piles[0].includes(EXCUSE) && t.won[0] === 18 && t.result.chelem === 200, "...but a side that has won all the other tricks keeps it and the slam (+200 unannounced)");
  let u = mk([17, 0], [EXCUSE, K(0, 4), K(0, 5), K(0, 6)]);
  u.chelem = true;
  for (const [seat, card] of [[0, EXCUSE], [1, K(0, 4)], [2, K(0, 5)], [3, K(0, 6)]]) u = act(u, seat, { t: "play", card });
  ok(u.result.chelem === 400, "an announced slam made scores 400");
  let v = mk([17, 0], [K(0, 9), K(0, 4), K(0, 5), K(0, 6)]);
  v.chelem = true;
  for (const [seat, card] of [[0, K(0, 9)], [1, K(0, 4)], [2, K(0, 5)], [3, K(0, 6)]]) v = act(v, seat, { t: "play", card });
  ok(v.result.chelem === 400, "(the same for a plain last trick)");
  let w = mk([16, 1], [K(0, 9), K(0, 4), K(0, 5), K(0, 6)]);
  w.chelem = true;
  for (const [seat, card] of [[0, K(0, 9)], [1, K(0, 4)], [2, K(0, 5)], [3, K(0, 6)]]) w = act(w, seat, { t: "play", card });
  ok(w.result.chelem === -200, "an announced slam that fails costs 200");
  let x = mk([0, 17], [K(0, 3), K(0, KING), K(0, 5), K(0, 6)]);
  for (const [seat, card] of [[0, K(0, 3)], [1, K(0, KING)], [2, K(0, 5)], [3, K(0, 6)]]) x = act(x, seat, { t: "play", card });
  ok(x.result.chelem === -200, "the defence taking every trick scores 200 to each defender");
}
{
  // the petit au bout: the 1 of trumps in the last trick, to the side that takes it
  const mk = hands => crafted(hands, { turn: 0, tricks: Array.from({ length: 17 }, () => ({ plays: [{ seat: 0, card: K(0, 1) }], win: 0 })), won: [8, 9] });
  let s = mk([[PETIT], [K(0, 5)], [K(0, 6)], [K(0, 7)]]);
  for (const [seat, card] of [[0, PETIT], [1, K(0, 5)], [2, K(0, 6)], [3, K(0, 7)]]) s = act(s, seat, { t: "play", card });
  ok(s.result.petit === 10, "the petit led by the taker in the last trick wins it (the only trump): the taker's side scores it");
  let t = mk([[K(0, 5)], [PETIT], [K(0, 6)], [K(0, 7)]]);
  for (const [seat, card] of [[0, K(0, 5)], [1, PETIT], [2, K(0, 6)], [3, K(0, 7)]]) t = act(t, seat, { t: "play", card });
  ok(t.tricks[17].win === 1 && t.result.petit === -10, "the petit cut in on a suit lead wins the last trick for the defence, who score the petit au bout");
  let u = mk([[K(0, 5)], [K(0, 9)], [PETIT], [K(0, 7)]]);
  for (const [seat, card] of [[0, K(0, 5)], [1, K(0, 9)], [2, PETIT], [3, K(0, 7)]]) u = act(u, seat, { t: "play", card });
  ok(u.result.petit === -10, "the same from a later seat");
  let w = mk([[GRAND], [PETIT], [K(0, 6)], [K(0, 7)]]);
  for (const [seat, card] of [[0, GRAND], [1, PETIT], [2, K(0, 6)], [3, K(0, 7)]]) w = act(w, seat, { t: "play", card });
  ok(w.result.petit === 10, "the petit lost to the 21 in the last trick is the taker's side's to score: the trick is theirs");
}

// ---------- the handfuls ----------
{
  for (const n of [3, 4, 5]) ok(POIGNEE[n].length === 3, `${n} players: ${POIGNEE[n].join(", ")} trumps for a simple, double and triple handful`);
  const s = crafted([[], [], [], []]);
  const trumps = [...Array(18).keys()].filter(c => c !== 0 || true);
  s.hands[1] = sortHand([...Array(10).keys()].map(i => i + 5).concat([K(0, 3), K(0, 4), K(1, 4), K(2, 3), K(3, 1), K(3, 2), K(3, 3), K(1, 3)]));
  ok(s.hands[1].length === 18, "(18 cards)");
  const show10 = s.hands[1].filter(c => c < 21);
  ok(poigneeLevels(s, 1).map(l => l.size).join() === "10" && checkPoignee(s, 1, show10).level === 0, "ten trumps show a simple handful, 20 points");
  ok(checkPoignee(s, 1, show10.slice(1)).why, "nine do not");
  s.hands[1] = sortHand([...Array(11).keys()].map(i => i + 5).concat([EXCUSE, K(0, 3), K(0, 4), K(1, 4), K(2, 3), K(3, 1), K(3, 2)]));
  ok(checkPoignee(s, 1, s.hands[1].filter(c => c < 21).slice(0, 10)).level === 0, "with eleven, one is held back");
  ok(poigneeLevels(s, 1).map(l => l.size).join() === "10", "(the Excuse counted: twelve make ten, not thirteen)");
  s.hands[1] = sortHand([...Array(9).keys()].map(i => i + 5).concat([EXCUSE, K(0, 3), K(0, 4), K(1, 4), K(2, 3), K(3, 1), K(3, 2), K(3, 3), K(1, 3)]));
  ok(checkPoignee(s, 1, [...Array(9).keys()].map(i => i + 5).concat([EXCUSE])).level === 0, "the Excuse stands in for a trump when it is the holder's last");
  s.hands[1] = sortHand([...Array(11).keys()].map(i => i + 5).concat([EXCUSE, K(0, 3), K(0, 4), K(1, 4), K(2, 3), K(3, 1), K(3, 2)]));
  ok(checkPoignee(s, 1, [...Array(9).keys()].map(i => i + 5).concat([EXCUSE])).why, "...but not while another trump is held back");
  // shown with the first card, once
  s.hands[1] = sortHand([...Array(10).keys()].map(i => i + 5).concat([K(0, 3), K(0, 4), K(1, 4), K(2, 3), K(3, 1), K(3, 2), K(3, 3), K(1, 3)]));
  s.turn = 1;
  const r = act(s, 1, { t: "play", card: K(0, 3), show: s.hands[1].filter(c => c < 21) });
  ok(typeof r !== "string" && r.poignees.length === 1 && r.poignees[0].level === 0, "a handful is shown with the first card");
  const r2 = act({ ...r, turn: 1, trick: { plays: [] } }, 1, { t: "play", card: K(0, 4), show: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  ok(typeof r2 === "string", "...and not later");
}

// ---------- the score of a deal ----------
{
  const pile = (n, pad = 1) => { const out = []; const pool = [...Array(78).keys()].filter(x => !isBout(x) && PTS[x] === 1); for (const x of pool) { if (out.length >= n) break; out.push(x); } return out; };
  void pile;
  const s = G0(4, 1).state;
  s.bid = 2; s.taker = 1; s.partner = null; s.alone = false; s.tricks = []; s.won = [9, 9];
  const all = [...Array(78).keys()], att = [GRAND, EXCUSE, K(0, KING), K(1, KING), K(2, KING), K(3, KING), K(0, QUEEN), K(1, QUEEN), K(2, QUEEN), K(3, QUEEN), K(0, KNIGHT), K(1, KNIGHT), K(2, KNIGHT)];
  s.piles = [att, all.filter(c => !att.includes(c))];
  const r = settle(s);
  ok(r.bouts === 2 && r.ptsH === 2 * 4.5 * 2 + 2 * 4.5 * 4 + 2 * 3.5 * 4 + 2 * 2.5 * 3 && r.made, "the taker's side's points and bouts are counted from its piles");
  ok(r.deltas.reduce((a, b) => a + b, 0) === 0 && r.deltas[1] === 3 * r.X && r.deltas[0] === -r.X, "four players: the taker three, each defender one, the sum nil");
}

// ---------- whole games ----------
const total = c => c.reduce((t, x) => t + PTS[x], 0);
function playGame(n, seed, level, hook) {
  let G = newRecord(rules, { seats: n, options: { deals: 3 }, seed, now: 0 }), steps = 0, deals = 0;
  const bidsSeen = new Set();
  while (!rules.over(G.state) && steps++ < 4000) {
    const s = G.state;
    if (s.step === "shown" || s.step === "thrown") {
      if (s.step === "shown") {
        const r = s.result, all = [...r.att, ...r.def];
        if (new Set(all).size !== 78 || total(all) !== 182) return `deal ${s.deal}: the piles hold ${new Set(all).size} cards, ${total(all)} halves`;
        if (r.deltas.reduce((a, b) => a + b, 0) !== 0) return "the scores don't balance";
        if (s.hands.some(h => h.length)) return "cards left in hand";
        deals++;
        bidsSeen.add(s.bid);
      }
      G = applyWake(rules, G, s.until + 1); if (!G) return "no wake";
      continue;
    }
    const seat = rules.toMove(s);
    if (seat == null) return `nobody to move at ${s.step}`;
    const mv = botMove(rules, G, seat, level);
    const r = applyMove(rules, G, seat, mv);
    if (r.error) return `${r.error} ${JSON.stringify(mv)} at ${s.step}`;
    G = r.G;
    hook?.(G);
  }
  return rules.over(G.state) && G.state.scores.reduce((a, b) => a + b, 0) === 0 ? "" : "didn't end, or the totals don't balance";
}
for (const n of [3, 4, 5]) {
  const problems = [];
  for (let seed = 1; seed <= 6; seed++) { const p = playGame(n, seed * 7 + n, seed % 2 ? "plain" : "easy"); if (p) problems.push(`${seed}: ${p}`); }
  ok(!problems.length, `${n} players: whole games of computer players, every card accounted for and the scores balancing` + (problems.length ? ` (${problems[0]})` : ""));
}
{
  // random legal play from every position (and from every step)
  let problems = 0;
  for (const n of [3, 4, 5]) for (let seed = 1; seed <= 4; seed++) {
    const rng = seeded(seed * 31 + n);
    let G = newRecord(rules, { seats: n, options: { deals: 3 }, seed: seed * 13 + n, now: 0 }), guard = 0;
    while (!rules.over(G.state) && guard++ < 4000) {
      const s = G.state;
      if (s.step === "shown" || s.step === "thrown") { G = applyWake(rules, G, s.until + 1); continue; }
      const seat = rules.toMove(s);
      let mv;
      if (s.step === "play") { const l = legalFor(s, seat); mv = { t: "play", card: l[Math.floor(rng() * l.length)] }; }
      else if (s.step === "bid") mv = { t: "bid", n: rng() < 0.5 ? 0 : s.high + 1 <= 4 ? s.high + 1 : 0 };
      else mv = botMove(rules, G, seat, "plain");
      const r = applyMove(rules, G, seat, mv);
      if (r.error) { problems++; console.log("random play refused:", r.error, JSON.stringify(mv), s.step); break; }
      G = r.G;
    }
  }
  ok(!problems, "random lawful play from every position never reaches an illegal state");
}

// ---------- the sampling of what a seat can't see ----------
{
  let fine = true, why = "";
  for (const n of [3, 4, 5]) for (let seed = 1; seed <= 3 && fine; seed++) {
    let G = newRecord(rules, { seats: n, options: { deals: 3 }, seed: seed * 17 + n, now: 0 }), moves = 0;
    while (G.state.step !== "shown" && G.state.step !== "thrown" && moves++ < 400 && fine) {
      const s = G.state, seat = rules.toMove(s);
      if (s.step === "play" && moves % 3 === 0) {
        for (const q of [seat, (seat + 1) % n]) {
          const rng = seeded(moves * 7 + q);
          const smp = sample(s, q, rng);
          const sizes = smp.hands.map(h => h.length).join(), want = s.hands.map(h => h.length).join();
          const flat = smp.hands.flat(), hid = smp.hidden?.cards || [];
          const seenAll = new Set([...flat, ...hid, ...s.tricks.flatMap(t => t.plays.map(p => p.card)), ...s.trick.plays.map(p => p.card), ...(q === s.taker && s.bid <= 2 ? s.ecart : [])]);
          const m = simOf(s, smp.hands);
          let voided = true;
          for (let o = 0; o < n; o++) if (o !== q) for (const c of smp.hands[o]) { const cls = c === EXCUSE ? -1 : c < 21 ? 4 : suitOf(c); if (cls >= 0 && m.voids[o * 5 + cls]) voided = false; }
          if (sizes !== want || new Set(flat).size !== flat.length || !voided || seenAll.size !== 78 || smp.hands[q].join() !== s.hands[q].join()) { fine = false; why = `${n}p seed ${seed} move ${moves} seat ${q}: sizes ${sizes} vs ${want}, voids ${voided}, cards ${seenAll.size}`; }
        }
      }
      const mv = botMove(rules, G, seat, "plain");
      G = applyMove(rules, G, seat, mv).G;
    }
  }
  ok(fine, "sampled hands have the sizes of the real ones, no card twice, every card somewhere, no suit a player has shown it lacks" + (why ? ` (${why})` : ""));
}

// ---------- the computer players ----------
{
  const s = G0(4, 9).state;
  ok(strength(s.hands[0], 4) > -10, "a hand has a strength");
  const rich = sortHand([PETIT, GRAND, EXCUSE, 20 - 2, 17, 16, 15, 14, 10, 9, K(0, KING), K(1, KING), K(2, KING), K(3, KING), K(0, QUEEN), K(1, QUEEN), K(0, 3), K(1, 3)]);
  const poor = sortHand([3, 4, 6, 7, K(0, 1), K(0, 2), K(0, 3), K(1, 1), K(1, 2), K(1, 3), K(2, 1), K(2, 2), K(2, 3), K(3, 1), K(3, 2), K(3, 3), K(3, 4), K(3, 5)]);
  ok(strength(rich, 4) > strength(poor, 4) + 25, "bouts, kings and long trumps are strong; a hand of low cards is not");
  const lv = Object.keys(LEVELS);
  ok(["random", "plain", "easy", "medium", "hard"].every(k => lv.includes(k)) && LEVELS.hard.samples > LEVELS.medium.samples && LEVELS.medium.samples > LEVELS.easy.samples && LEVELS.easy.slip > LEVELS.medium.slip, "Easy has no samples and slips most; Hard samples most and never slips");
  // the move comes from what the seat sees: the same for any hidden hands
  let g = G0(4, 12);
  while (g.state.step === "bid") g = applyMove(rules, g, g.state.turn, { t: "bid", n: g.state.turn === g.state.first ? 2 : 0 }).G;
  while (g.state.step !== "play") g = applyMove(rules, g, g.state.turn, playerMove(g.state, g.state.turn, { level: "plain", rng: seeded(1) })).G;
  LEVELS.medium.ms = 0;                                    // no clock: the samples are the same on any machine
  const seat = g.state.turn, a = playerMove(g.state, seat, { level: "medium", rng: seeded(5) });
  const other = JSON.parse(JSON.stringify(g.state));
  const o2 = (seat + 1) % 4, o3 = (seat + 2) % 4;
  [other.hands[o2], other.hands[o3]] = [other.hands[o3], other.hands[o2]];
  const b = playerMove(other, seat, { level: "medium", rng: seeded(5) });
  ok(JSON.stringify(a) === JSON.stringify(b), "a computer player's card does not depend on the cards it can't see");
}

// ---------- the state through the database ----------
{
  let g = G0(5, 21), steps = 0, fine = true, why = "";
  while (!rules.over(g.state) && steps++ < 200) {
    const s = g.state;
    const back = roundTrip(g);
    if (!same(rules.restore(JSON.parse(JSON.stringify(back.state))), rules.restore(JSON.parse(JSON.stringify(s))))) { fine = false; why = `step ${steps} (${s.step})`; break; }
    if (s.step === "shown" || s.step === "thrown") { g = applyWake(rules, g, s.until + 1); continue; }
    const seat = rules.toMove(s);
    g = applyMove(rules, back, seat, botMove(rules, back, seat, "plain")).G;
  }
  ok(fine, "the state survives the database at every step, played on from the copy that came back" + (why ? ` (${why})` : ""));
}

console.log(bad ? `${bad} FAILED` : "all passed");
process.exit(bad ? 1 : 0);
