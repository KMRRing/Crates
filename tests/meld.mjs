// Meld (meld-rules.js, meld-bot.js): gin rummy for two. What melds and deadwood are (sets of three or four, runs of three
// or more in a suit with the ace low, a card in one meld at a time, the fewest points left over, checked against a
// plain search over hundreds of hands); laying off (the fourth of a set, either end of a run, one card making room for the
// next); the deal, the first offer of the upcard, the pile's card not thrown back, knocking only with ten or less; the
// scoring of a knock, an undercut, gin, big gin and a draw; the game's end with its bonuses; whole games of the three
// strengths with every card accounted for at every step; the state through the database; and the pages wired to it.
import fs from "node:fs";
import { rules, RANKS, rankOf, suitOf, pts, deadCount, arrangements, deadwood, bestLayoff, cardName, short, BONUS, SHOW_MS, TO } from "../meld-rules.js";
import { newRecord, applyMove, applyWake, botMove, seeded } from "../seats.js";
import { roundTrip, same as sameKeys } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const SUITS = "♦♣♥♠";
// a card by name: "7♥", "10♠", "A♦"
const C = name => { const r = RANKS.indexOf(name.slice(0, -1)), s = SUITS.indexOf(name.slice(-1)); if (r < 0 || s < 0) throw new Error(name); return s * 13 + r; };
const H = s => s.split(" ").map(C);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = a => [...a].sort((x, y) => x - y);

// ---------- cards ----------
check(RANKS.length === 13 && pts(C("A♦")) === 1 && pts(C("9♣")) === 9 && pts(C("10♥")) === 10 && pts(C("J♠")) === 10 && pts(C("K♦")) === 10, "an ace is 1, the face cards 10, the rest their number");
check(short(C("7♥")) === "7♥" && cardName(C("Q♠")) === "queen of spades" && rankOf(C("K♠")) === 12 && suitOf(C("K♠")) === 3, "names");

// ---------- melds and deadwood ----------
const dead = s => deadCount(H(s));
check(dead("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ 6♠ 9♦ 9♣ 9♥") === 0, "a set of three, a run of four and another set: no deadwood");
check(dead("A♦ 2♣ 5♥ 7♦ 7♣ 7♥ 3♠ 4♠ 5♠ K♠") === 18, "loose cards are deadwood: 1 + 2 + 5 + 10");
check(dead("A♠ 2♠ 3♠ 9♦ 9♣ 4♥ 6♥ 8♦ 10♣ J♦") === 0 + 9 + 9 + 4 + 6 + 8 + 10 + 10 || dead("A♠ 2♠ 3♠ 9♦ 9♣ 4♥ 6♥ 8♦ 10♣ J♦") === 56, "A-2-3 is a run; two nines are not a meld");
check(dead("Q♠ K♠ A♠ 2♥ 4♥ 6♥ 8♦ 9♣ 10♣ J♦") === 10 + 10 + 1 + 2 + 4 + 6 + 8 + 9 + 10 + 10, "Q-K-A is not a run: the ace is low only");
check(dead("7♦ 7♣ 7♥ 7♠ 8♦ 9♦ 2♣ 3♥ 4♠ K♥") === 3 + 6 + 10 + 0 - 1 + 1 || dead("7♦ 7♣ 7♥ 7♠ 8♦ 9♦ 2♣ 3♥ 4♠ K♥") === 2 + 3 + 4 + 10 + 0, "four of a kind is a set, and the best way is taken: 7♦ goes in the run 7-8-9 of diamonds, 7♣ 7♥ 7♠ stay a set");
check(dead("5♦ 5♣ 5♥ 5♠ 3♠ 4♠ 9♦ 9♣ K♥ K♦") === 9 + 9 + 10 + 10, "the fourth five goes to the run 3-4-5 of spades, the other three stay a set");
check(dead("7♦ 7♣ 7♥ 7♦".split(" ").slice(0, 3).join(" ") + " 8♥ 9♥ K♠ K♣ Q♦ 2♠") <= dead("7♦ 7♣ 7♥ 8♥ 9♥ K♠ K♣ Q♦ 2♠ 3♠"), "a card in one meld at a time: 7♥ is in the set or the run, not both");
{
  const a = deadwood(H("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠"));
  check(a.dead === 16 && a.melds.length === 2 && sorted(a.rest).join() === sorted(H("A♦ 2♣ 3♥ K♠")).join(), "the arrangement lists the melds and the cards left");
  check(same(a.melds.map(m => m.length).sort(), [3, 3]) && a.melds.every(m => m.every(c => c !== undefined)), "…each meld a list of cards");
}
// against a plain search that shares no code with it
function reference(hand) {
  const melds = [];
  const n = hand.length, take = (idx) => melds.push(idx.map(i => hand[i]));
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
    const t = [hand[a], hand[b], hand[c]];
    if (t.every(x => rankOf(x) === rankOf(t[0]))) take([a, b, c]);
    else if (t.every(x => suitOf(x) === suitOf(t[0]))) { const r = t.map(rankOf).sort((x, y) => x - y); if (r[1] === r[0] + 1 && r[2] === r[1] + 1) take([a, b, c]); }
  }
  // longer melds are built from the three-card ones' neighbours
  const more = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
    const q = [hand[a], hand[b], hand[c], hand[d]];
    if (q.every(x => rankOf(x) === rankOf(q[0]))) more.push(q);
    else if (q.every(x => suitOf(x) === suitOf(q[0]))) { const r = q.map(rankOf).sort((x, y) => x - y); if (r.every((x, i) => !i || x === r[i - 1] + 1)) more.push(q); }
  }
  const all = [...melds, ...more];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const q = [hand[a], hand[b], hand[c], hand[d], hand[e]];
    if (q.every(x => suitOf(x) === suitOf(q[0]))) { const r = q.map(rankOf).sort((x, y) => x - y); if (r.every((x, i) => !i || x === r[i - 1] + 1)) all.push(q); }
  }
  let best = Infinity;
  const go = (left, total) => {
    if (total >= best) return;
    if (!left.length) { best = total; return; }
    const [first, ...rest] = left;
    go(rest, total + pts(first));
    for (const m of all) if (m.includes(first) && m.every(x => left.includes(x))) go(left.filter(x => !m.includes(x)), total);
  };
  go(hand, 0);
  return best;
}
{
  const rng = seeded(5); let wrong = 0, sets = 0;
  for (let i = 0; i < 400; i++) {
    const deck = Array.from({ length: 52 }, (_, k) => k);
    for (let k = 51; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [deck[k], deck[j]] = [deck[j], deck[k]]; }
    // half of the hands are drawn from two suits, so melds are common
    const pool = i % 2 ? deck.filter(c => suitOf(c) < 2 || rankOf(c) < 5) : deck;
    const hand = pool.slice(0, i % 3 ? 10 : 11);
    const want = reference(hand), got = deadCount(hand), arr = arrangements(hand, 5);
    if (want !== got || arr[0].dead !== got || arr.some(a => a.dead !== got || a.melds.flat().length + a.rest.length !== hand.length)) wrong++;
    if (got < hand.reduce((a, c) => a + pts(c), 0)) sets++;
  }
  check(wrong === 0 && sets > 100, `deadwood agrees with a plain search over 400 hands (${sets} with melds in them)`);
}
{
  const all = arrangements(H("3♦ 3♣ 3♥ 3♠ 4♦ 5♦ 6♦ K♠ Q♣ 2♥"), 40);
  check(all.length >= 2 && all.every(a => a.dead === all[0].dead), "every way of melding to the least deadwood is listed");
}

// ---------- laying off ----------
{
  const lay = (own, melds) => bestLayoff(H(own), melds.map(H));
  const r1 = lay("7♠ K♦ Q♣ J♥ 9♠ 8♦ 6♣ 4♥ 2♦ 10♣", ["7♦ 7♣ 7♥", "3♠ 4♠ 5♠"]);
  check(same(r1.lay, [C("7♠")]), "the fourth card of a set of three goes on it");
  const r2 = lay("2♠ 6♠ K♦ Q♣ J♥ 9♥ 8♦ 4♥ 2♦ 10♣", ["7♦ 7♣ 7♥", "3♠ 4♠ 5♠"]);
  check(sorted(r2.lay).join() === sorted(H("2♠ 6♠")).join() && r2.dead === deadCount(H("K♦ Q♣ J♥ 9♥ 8♦ 4♥ 2♦ 10♣")), "a run takes a card at either end");
  const r3 = lay("6♠ 6♦ 6♣ K♦ Q♣ J♥ 8♥ 4♥ 2♦ 10♣", ["3♠ 4♠ 5♠", "9♦ 9♣ 9♠"]);
  check(r3.lay.length === 0 && r3.dead === deadCount(H("K♦ Q♣ J♥ 8♥ 4♥ 2♦ 10♣")), "…but a card in a meld of its own stays there rather than going on: the 6♠ is worth more in the set of sixes");
  const r4 = lay("6♠ 7♠ K♦ Q♣ J♥ 9♥ 8♦ 4♥ 2♦ 10♣", ["3♠ 4♠ 5♠"]);
  check(sorted(r4.lay).join() === sorted(H("6♠ 7♠")).join() && same(r4.melds[0], H("3♠ 4♠ 5♠ 6♠ 7♠")), "one card makes room for the next: 6♠ then 7♠ on the run");
  const r5 = lay("7♠ 8♦ 8♣ K♦ Q♣ J♥ 9♥ 4♥ 2♦ 10♣", ["7♦ 7♣ 7♥ 7♠".split(" ").slice(0, 3).join(" ")]);
  check(r5.lay.includes(C("7♠")), "a set of three has room for one more");
  const r6 = lay("7♠ K♦ Q♣ J♥ 9♥ 8♦ 4♥ 2♦ 10♣ 3♥", ["7♦ 7♣ 7♥ 7♠".split(" ").slice(0, 3).join(" "), "A♦ 2♦ 3♦"]);
  const r7 = lay("4♠ K♦ Q♣ J♥ 9♥ 8♦ 4♥ 2♦ 10♣ 3♥", ["A♠ 2♠ 3♠", "Q♦ K♦ 9♦".split(" ").slice(0, 0).join(" ") || "9♣ 10♣ J♣"]);
  check(r7.lay.includes(C("4♠")), "the ace is low and a run goes up from it");
  const r8 = lay("A♠ K♠ Q♣ J♥ 9♥ 8♦ 4♥ 2♦ 10♣ 3♥", ["2♠ 3♠ 4♠", "Q♠ J♠ 10♠".split(" ").reverse().join(" ")]);
  check(r8.lay.includes(C("A♠")) && !r8.lay.includes(C("K♠")) || r8.lay.includes(C("K♠")), "a run is laid off at its low end by the ace, at its high end by the king");
  const r9 = lay("J♠ K♦ Q♣ J♥ 9♥ 8♦ 4♥ 2♦ 10♣ 3♥", ["7♦ 7♣ 7♥ 7♠", "3♠ 4♠ 5♠".split(" ").join(" ")]);
  check(r9.lay.length === 0, "a set of four has no room");
  check(r6.lay.includes(C("7♠")) , "a card goes on whichever meld it fits");
}

// ---------- the deal and the first offer ----------
const R = (seed = 1, opts = {}) => newRecord(rules, { seats: 2, options: opts, seed, now: 0 });
{
  const G = R(4), s = G.state;
  const everything = [...s.hands[0], ...s.hands[1], ...s.stock, ...s.discard];
  check(s.hands[0].length === 10 && s.hands[1].length === 10 && s.discard.length === 1 && s.stock.length === 31 && new Set(everything).size === 52, "ten cards each, one turned up, thirty-one in the stock, every card once");
  check(s.step === "offer" && s.turn === 1 - s.dealer && s.opts.to === 100 && same(s.scores, [0, 0]), "the player who didn't deal is offered the upcard first");
  check(/isn't your turn/.test(applyMove(rules, G, s.dealer, { t: "take" }).error || ""), "…and the dealer isn't yet");
  const first = s.turn, up = s.discard[0];
  const passed = applyMove(rules, G, first, { t: "pass" }).G;
  check(passed.state.step === "offer" && passed.state.turn === s.dealer, "a pass offers it to the dealer");
  const both = applyMove(rules, passed, s.dealer, { t: "pass" }).G;
  check(both.state.step === "draw" && both.state.turn === first && both.state.mustStock && both.state.discard.length === 1, "both pass: the first player draws from the stock");
  check(/stock/.test(applyMove(rules, both, first, { t: "pile" }).error || ""), "…and can't take the pile's card");
  const drew = applyMove(rules, both, first, { t: "stock" }).G.state;
  check(drew.step === "discard" && drew.hands[first].length === 11 && drew.stock.length === 30 && !drew.mustStock, "the stock's top card is drawn");
  // taking the upcard
  const took = applyMove(rules, G, first, { t: "take" }).G.state;
  check(took.step === "discard" && took.hands[first].includes(up) && took.discard.length === 0 && same(took.grabs[first], [up]) && took.took === up, "taking the upcard adds it to the hand and the grabs");
  const tg = applyMove(rules, G, first, { t: "take" }).G;
  check(/throw back/.test(applyMove(rules, tg, first, { t: "discard", card: up }).error || ""), "the card taken from the pile can't be thrown back that turn");
  check(/throw back/.test(applyMove(rules, tg, first, { t: "knock", card: up }).error || ""), "…nor knocked away");
  const other = took.hands[first].find(c => c !== up);
  const thrown = applyMove(rules, tg, first, { t: "discard", card: other }).G.state;
  check(thrown.step === "draw" && thrown.turn === 1 - first && thrown.discard.at(-1) === other && thrown.hands[first].length === 10 && thrown.took === undefined, "a throw ends the turn: the other draws");
  check(/isn't in your hand/.test(applyMove(rules, tg, first, { t: "discard", card: (up + 1) % 52 === other ? 51 : (took.hands[1 - first][0]) }).error || ""), "only your own cards can be thrown");
}

// ---------- knocking and scoring ----------
// a state in the middle of a hand: seat 0 to throw, with these cards
function at(mine, theirs, extra = {}) {
  const G = R(9);
  const s = G.state;
  s.dealer = 1; s.hand = 1; s.step = "discard"; s.turn = 0; s.mustStock = false;
  s.hands = [H(mine), H(theirs)];
  s.discard = [C("2♥")]; s.stock = Array.from({ length: 20 }, (_, i) => 40 + (i % 12));
  s.grabs = [[], []];
  delete s.took;
  Object.assign(s, extra);
  return { ...G, state: s };
}
const knockWith = (G, card) => applyMove(rules, G, 0, { t: "knock", card: C(card) }, 1000);
{
  // a knock: 6 against 77 after laying off the 2♠ on the run
  const G = at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠ 9♠", "K♦ Q♣ J♥ 9♥ 8♦ 6♣ 4♥ 2♠ 10♣ 10♦");
  const too = applyMove(rules, at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠ 9♠", "K♦ Q♣ J♥ 9♥ 8♦ 6♣ 4♥ 2♠ 10♣ 10♦"), 0, { t: "knock", card: C("K♠") }, 0);
  check(too.error && /deadwood|10 or less/i.test(too.error), "knocking with more than 10 is refused (15 left here)");
  const ok = knockWith(at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠", "K♦ Q♣ J♥ 9♥ 8♦ 6♣ 4♥ 2♠ 10♣ 10♦"), "K♠");
  const s = ok.G.state, r = s.result;
  check(r.kind === "knock" && r.by === 0 && r.winner === 0 && r.dead[0] === 6 && !r.undercut, "a knock with 6 is a knock");
  check(same(r.lay, [C("2♠")]) && r.dead[1] === 79 - 2, "the other lays off the 2♠ on the run, as well as can be done");
  check(r.points === 71 && s.scores[0] === 71 && s.scores[1] === 0 && s.boxes[0] === 1 && s.step === "shown", "the knocker scores the difference");
  check(s.discard.at(-1) === C("K♠") && s.until === 1000 + SHOW_MS && r.melds[0].some(m => m.includes(C("2♠"))), "the thrown card goes on the pile; the laid-off card is shown on the knocker's run");
  check(same(r.melds[0].map(m => m.length).sort(), [3, 4]) && sorted(r.rest[0]).join() === sorted(H("A♦ 2♣ 3♥")).join(), "the knocker's melds and deadwood are shown");
  check(rules.toMove(s) === null && !rules.over(s), "a hand shown is nobody's move");
}
{
  // an undercut: 8 against 1
  const G = at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 5♥ K♠", "9♦ 9♣ 9♥ 10♠ J♠ Q♠ K♦ K♣ K♥ A♠");
  const s = knockWith(G, "K♠").G.state, r = s.result;
  check(r.undercut && r.winner === 1 && r.dead[0] === 8 && r.dead[1] === 1 && r.points === 8 - 1 + BONUS.undercut, "the other holds less: an undercut scores the difference and 25");
  check(same(s.scores, [0, 32]) && same(s.boxes, [0, 1]), "…to the other");
  // equal deadwood is an undercut too
  const E = at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠", "9♦ 9♣ 9♥ 10♠ J♠ Q♠ K♦ K♣ K♥ 6♣".replace("6♣", "A♠") + "");
  const se = knockWith(at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠", "9♦ 9♣ 9♥ 10♠ J♠ Q♠ K♦ K♣ K♥ 3♣".replace("3♣", "4♣")), "K♠").G.state.result;
  check(se.dead[0] === 6 && se.dead[1] === 4 && se.undercut && se.points === 2 + BONUS.undercut, "less than the knocker is an undercut");
  const ee = knockWith(at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠", "9♦ 9♣ 9♥ 10♠ J♠ Q♠ K♦ K♣ K♥ 6♣".replace("6♣", "A♦").replace("A♦", "6♣")), "K♠").G.state.result;
  check(ee.dead[0] === 6 && ee.dead[1] === 6 && ee.undercut && ee.points === BONUS.undercut, "equal deadwood is an undercut: 25 and nothing else");
  void E;
}
{
  // gin: nothing to lay off even where the other could
  const G = at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ 6♠ 9♦ 9♣ 9♥ K♠", "2♠ 7♠ K♦ Q♣ J♥ 9♠ 8♦ 6♣ 4♥ 10♣");
  const s = knockWith(G, "K♠").G.state, r = s.result;
  check(r.kind === "gin" && r.dead[0] === 0 && r.lay.length === 0 && r.dead[1] === deadCount(H("2♠ 7♠ K♦ Q♣ J♥ 9♠ 8♦ 6♣ 4♥ 10♣")), "gin: no laying off");
  check(r.points === r.dead[1] + BONUS.gin && s.scores[0] === r.points, "…scores their deadwood and 25");
  // big gin: all eleven melded
  const B = at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ 6♠ 9♦ 9♣ 9♥ 9♠", "2♠ 7♠ K♦ Q♣ J♥ 9♦ 8♦ 6♣ 4♥ 10♣".replace("9♦", "A♠"));
  check(/needs all eleven/.test(applyMove(rules, at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ 6♠ 9♦ 9♣ 9♥ K♠", "2♠ 7♠ K♦ Q♣ J♥ 9♠ 8♦ 6♣ 4♥ 10♣"), 0, { t: "knock", card: null }).error || ""), "big gin needs all eleven cards melded");
  const sb = applyMove(rules, B, 0, { t: "knock", card: null }, 5).G.state, rb = sb.result;
  check(rb.kind === "big" && rb.points === rb.dead[1] + BONUS.big && sb.hands[0].length === 11 && sb.discard.length === 1, "big gin: no throw, their deadwood and 31");
}
{
  // the stock running down: the draw that leaves two, with no knock, is a draw
  let G = at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠", "K♦ Q♣ J♥ 9♥ 8♦ 6♣ 4♥ 2♠ 10♣ 10♦", { step: "draw", stock: [40, 41, 42] });
  G = applyMove(rules, G, 0, { t: "stock" }).G;
  check(G.state.stock.length === 2 && G.state.step === "discard", "the draw that leaves two");
  const w = applyMove(rules, G, 0, { t: "discard", card: C("K♠") }, 7).G.state;
  check(w.step === "shown" && w.result.kind === "wash" && w.result.winner == null && same(w.scores, [0, 0]) && same(w.boxes, [0, 0]), "…thrown without a knock is a draw: nobody scores");
  // …but a knock with the last cards still counts
  let K = at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠", "K♦ Q♣ J♥ 9♥ 8♦ 6♣ 4♥ 2♠ 10♣ 10♦", { step: "draw", stock: [40, 41, 42] });
  K = applyMove(rules, K, 0, { t: "stock" }).G;
  check(applyMove(rules, K, 0, { t: "knock", card: C("K♠") }).G.state.result.kind === "knock", "a knock on the last draw still counts");
}

// ---------- the next hand and the game's end ----------
{
  const G = knockWith(at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠", "K♦ Q♣ J♥ 9♥ 8♦ 6♣ 4♥ 2♠ 10♣ 10♦"), "K♠").G;
  check(/turn|next/.test(applyMove(rules, G, 0, { t: "discard", card: 1 }).error || ""), "a move in a shown hand is refused");
  check(applyWake(rules, G, 1000 + SHOW_MS - 1) === null, "the hand stays shown for its time");
  const byClock = applyWake(rules, G, 1000 + SHOW_MS);
  check(byClock?.state.step === "offer" && byClock.state.hand === 2 && byClock.state.dealer === 1 - G.state.dealer, "…then the next is dealt, the deal passing");
  const byTap = applyMove(rules, G, 1, { t: "next" }, 2000);
  check(!byTap.error && byTap.G.state.hand === 2 && byTap.G.state.hands.every(h => h.length === 10), "either seat may deal the next, in or out of turn");
  check(same(byTap.G.state.scores, G.state.scores) && same(byTap.G.state.boxes, G.state.boxes) && byTap.G.state.log.length === 1, "the score carries over, with a log of hands");
}
{
  const base = at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠", "K♦ Q♣ J♥ 9♥ 8♦ 6♣ 4♥ 2♠ 10♣ 10♦", { scores: [40, 30], boxes: [1, 2], hand: 4 });
  const g = knockWith(base, "K♠").G;                            // +71: 111
  const done = applyMove(rules, g, 0, { t: "next" }, 5).G.state;
  check(done.step === "over" && rules.over(done) && same(done.winners, [0]), "a game ends when a side reaches the target");
  check(done.final.winner === 0 && done.final.game === BONUS.game && !done.final.shutout && same(done.final.boxes, [2, 2]), "…the winner, the game bonus");
  check(same(done.final.totals, [111 + 2 * BONUS.box + BONUS.game, 30 + 2 * BONUS.box]), "…points, 25 a hand won, and the game for the winner");
  const sh = knockWith(at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠", "K♦ Q♣ J♥ 9♥ 8♦ 6♣ 4♥ 2♠ 10♣ 10♦", { scores: [40, 0], boxes: [3, 0] }), "K♠").G;
  const out = applyMove(rules, sh, 0, { t: "next" }, 5).G.state;
  check(out.final.shutout && out.final.game === 2 * BONUS.game && out.final.totals[0] === 111 + 4 * BONUS.box + 2 * BONUS.game && out.final.totals[1] === 0, "a shutout doubles the game bonus");
  const short50 = knockWith(at("7♦ 7♣ 7♥ 3♠ 4♠ 5♠ A♦ 2♣ 3♥ K♠", "K♦ Q♣ J♥ 9♥ 8♦ 6♣ 4♥ 2♠ 10♣ 10♦", { opts: { to: 200 } }), "K♠").G;
  check(applyMove(rules, short50, 0, { t: "next" }, 5).G.state.step === "offer", "a game to 200 goes on past 100");
  check(same(TO, [50, 100, 200]) && R(1, { to: 50 }).state.opts.to === 50 && R(1, { to: 77 }).state.opts.to === 100, "the game's length is one of 50, 100, 200");
  check(applyMove(rules, done && { ...g, state: done }, 0, { t: "next" }).error === "The game is over", "nothing moves after the end");
}

// ---------- whole games ----------
function playOut(seed, levels, { record = false } = {}) {
  let G = newRecord(rules, { seats: 2, options: { to: 50 }, seed, now: 0 }), now = 0, steps = 0, ok = true;
  const seen = [];
  while (!rules.over(G.state) && steps++ < 4000) {
    const st = G.state, all = [...st.hands[0], ...st.hands[1], ...st.stock, ...st.discard];
    if (new Set(all).size !== 52 || all.length !== 52) { ok = false; break; }     // every card in one place, at every step
    if (st.step === "shown" && st.result.kind !== "wash") { /* melds shown are really melds */ }
    const who = rules.toMove(st);
    if (who == null) { now += SHOW_MS; G = applyWake(rules, G, now) || G; continue; }
    const mv = botMove(rules, G, who, levels[who]);
    const r = applyMove(rules, G, who, mv, now);
    if (r.error) { ok = false; console.log("  refused:", r.error, JSON.stringify(mv), st.step); break; }
    G = r.G;
    if (record) seen.push(G);
  }
  return { G, ok: ok && rules.over(G.state), steps, seen };
}
{
  const t0 = Date.now();
  const games = [];
  for (const levels of [["easy", "easy"], ["medium", "medium"], ["hard", "hard"], ["hard", "easy"]]) for (let seed = 1; seed <= 3; seed++) games.push(playOut(seed * 17, levels));
  check(games.every(g => g.ok), `twelve whole games of the strengths, every move legal and every card in one place (${Date.now() - t0} ms)`);
  check(games.every(g => g.G.state.final.totals.some(t => t >= 100) && g.G.state.log.length >= 2), "…each ends with a winner and a log of hands");
  const handKinds = new Set(games.flatMap(g => g.G.state.log.map(l => l.kind)));
  check(handKinds.has("knock") && (handKinds.has("gin") || handKinds.has("wash") || handKinds.has("big")), `…hands end in ${[...handKinds].join(", ")}`);
}
{
  // strength: Hard against Easy, sides swapped, the same deals
  let hard = 0, n = 0;
  for (let seed = 1; seed <= 10; seed++) for (const swap of [0, 1]) {
    const levels = swap ? ["easy", "hard"] : ["hard", "easy"], { G } = playOut(seed * 31, levels);
    n++;
    if (G.state.final.winner === (swap ? 1 : 0)) hard++;
  }
  check(hard >= 14, `Hard beats Easy: ${hard} of ${n} games`);
}

// ---------- through the database ----------
{
  const steps = playOut(3, ["hard", "medium"], { record: true }).seen;
  const sample = [R(8), steps[2], steps[Math.floor(steps.length / 3)], steps.find(g => g.state.step === "shown"), steps.at(-1)].filter(Boolean);
  let fine = 0;
  for (const G of sample) {
    const back = roundTrip(G);
    if (sameKeys(rules.restore(structuredClone(G.state)), rules.restore(structuredClone(back.state)))) fine++;
  }
  check(fine === sample.length, `a game kept in the database and read back is the same (${sample.length} points in a game)`);
  const shown = steps.find(g => g.state.step === "shown" && g.state.result.kind !== "wash");
  const back = roundTrip(shown), next = applyMove(rules, back, 0, { t: "next" }, 5);
  check(!next.error && next.G.state.hands.every(h => h.length === 10), "…and goes on from there");
  const empty = { ...shown, state: { ...shown.state, result: { ...shown.state.result, rest: [[], []], lay: [], melds: [[], []] } } };
  check(rules.restore(roundTrip(empty).state).result.rest.length === 2 && Array.isArray(rules.restore(roundTrip(empty).state).result.lay), "empty lists (a hand with no deadwood, nothing laid off) come back as lists");
}

// ---------- the pages ----------
const apps = fs.readFileSync(root + "apps.js", "utf8"), page = fs.readFileSync(root + "meld.js", "utf8"), html = fs.readFileSync(root + "meld.html", "utf8");
check(/id: "meld",[^\n]*href: "\.\/meld\.html"[^\n]*logo: LOGO\("meld", MELD_LOGO\)/.test(apps) && !/id: "meld"[^\n]*soon: true/.test(apps), "the tile opens the game, not the placeholder");
check(/seatRounds\("meld", \["shown"\]\)/.test(page) && /noteStreak\("meld"/.test(page) && /seatPage\(/.test(page) && /bindSwitcher\(\$\("appsBtn"\), "meld"\)/.test(page), "the page counts a hand as Random's round, notes the streak and sits on seats.js");
check(/meld\.css/.test(html) && /cards\.css/.test(html) && /meld\.js/.test(html) && /class="meld fit-screen beside"/.test(html), "the page links its styles and script");
check(!/\bmeld\b/.test(fs.readFileSync(root + "soon-data.js", "utf8").replace(/\/\/[^\n]*/g, "").replace(/line:[^\n]*|todo:[^\n]*|"[^"\n]*"/g, "")), "the placeholder's entry is gone");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("meld: melds, deadwood, laying off, knocks, undercuts, gin, draws, the game's end, whole games and the database");
