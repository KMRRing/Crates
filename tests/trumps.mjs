// Trumps (trumps-games.js, trumps-rules.js, trumps-bot.js) on seats.js: Jass's cards (the trump order and worth, the
// 157, Obenabe's and Undenufe's), its play (follow or trump; never under a trump in; the Bauer needn't follow), Weis
// and its comparison, the count's multipliers; Belote's play (trump when you can't follow, unless your partner holds
// it; beat a trump in), its bidding (the turned card taken, the second round, a redeal) and scoring; Schafkopf's trumps, the called ace's duties, the Laufende and the tariff;
// the state through the database; whole games of computer players in each, every card legal.
import { GAMES, weisOf, laufende, jassMult, teamOf, sortHand } from "../trumps-games.js";
import { rules } from "../trumps-rules.js";
import { cid, suitOf, rankOf, deckFrom } from "../trumps-cards.js";
import { botMove as trumpsBot } from "../trumps-bot.js";
import { newRecord, applyMove, applyWake, botMove } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const C = (s, r) => cid(s, r);
const set = a => [...a].sort((x, y) => x - y).join(",");

// ---------- Jass ----------
{
  const J = GAMES.jass, s = { contract: { mode: "trump", suit: 2 }, opts: {} };
  const total = deckFrom("6").reduce((a, c) => a + J.points(s, c), 0) + J.last;
  check(total === 157, `the Jass pack with the last trick: 157 (${total})`);
  check(J.points(s, C(2, "J")) === 20 && J.points(s, C(2, "9")) === 14 && J.points(s, C(1, "J")) === 2, "the Bauer 20, the Nell 14, a plain Under 2");
  const obe = { contract: { mode: "obe" }, opts: {} }, unde = { contract: { mode: "unde" }, opts: {} };
  check(deckFrom("6").reduce((a, c) => a + J.points(obe, c), 0) + 5 === 157 && J.points(obe, C(0, "8")) === 8 && J.points(unde, C(0, "6")) === 11 && J.points(unde, C(0, "A")) === 0, "Obenabe and Undenufe: eights worth 8, Undenufe's six 11 and ace nothing");
  const trick = cards => cards.map((card, seat) => ({ seat, card }));
  check(J.winner(s, trick([C(2, "A"), C(2, "9"), C(2, "J"), C(2, "K")])) === 2 && J.winner(s, trick([C(0, "A"), C(2, "6")])) === 1, "the Bauer over the Nell over the ace; any trump over a plain ace");
  check(J.winner(unde, trick([C(0, "9"), C(0, "6"), C(1, "6")])) === 1, "Undenufe: the six of the suit led wins");
  // the play: follow or trump, no undertrumping
  const play = (hand, cards, c = s.contract) => J.legal({ hands: [hand], trick: trick(cards).map(t => ({ ...t, seat: t.seat + 1 })), contract: c }, 0);
  check(set(play([C(0, "K"), C(2, "7"), C(1, "A")], [C(0, "6")])) === set([C(0, "K"), C(2, "7")]), "following: the suit, or a trump");
  check(set(play([C(0, "K"), C(2, "7"), C(2, "A"), C(2, "J")], [C(0, "6"), C(2, "9")])) === set([C(0, "K"), C(2, "J")]), "never under a trump already in (the 7 and the ace are under the Nell; the Bauer over it)");
  check(set(play([C(2, "7"), C(1, "A")], [C(0, "6"), C(2, "9")])) === set([C(1, "A")]), "out of the suit: anything but an undertrump");
  check(set(play([C(2, "7"), C(2, "8")], [C(0, "6"), C(2, "9")])) === set([C(2, "7"), C(2, "8")]), "nothing but lower trumps: one of them");
  check(set(play([C(2, "J"), C(0, "K"), C(1, "A")], [C(2, "6")])).split(",").length === 3, "trumps led, the Bauer alone: needn't follow");
  check(set(play([C(2, "J"), C(2, "7"), C(1, "A")], [C(2, "6")])) === set([C(2, "J"), C(2, "7")]), "with another trump: follow trumps");
  // Weis
  const w = weisOf([C(1, "6"), C(1, "7"), C(1, "8"), C(1, "9"), C(0, "J"), C(1, "J"), C(2, "J"), C(3, "J"), C(3, "A")]);
  check(w.some(x => x.kind === "run" && x.len === 4 && x.value === 50) && w.some(x => x.kind === "four" && x.rank === "J" && x.value === 200), "Weis: a run of four (50), four Unders (200)");
  check(jassMult({ mode: "obe" }, { count: "swiss" }) === 3 && jassMult({ mode: "unde" }, { count: "swiss" }) === 4 && jassMult({ mode: "trump", suit: 3 }, { count: "swiss" }) === 1 && jassMult({ mode: "trump", suit: 1 }, { count: "swiss" }) === 2 && jassMult({ mode: "unde" }, { count: "simple" }) === 1,
    "the Swiss count: acorns single, shields double, Obenabe ×3, Undenufe ×4; the simple count all single");
}

// ---------- Belote ----------
{
  const B = GAMES.belote, s = { contract: { suit: 1 } };
  check(deckFrom("7").reduce((a, c) => a + B.points(s, c), 0) + B.last === 162, "the Belote pack with dix de der: 162");
  const play = (hand, cards) => B.legal({ hands: [hand], trick: cards.map((card, i) => ({ seat: (i + 1) % 4, card })), contract: s.contract }, 0);
  // seat 0 plays fourth after 1, 2 (partner) and 3
  check(set(play([C(1, "7"), C(2, "A")], [C(0, "K"), C(0, "A"), C(0, "7")])) === set([C(1, "7"), C(2, "A")]), "out of the suit with the partner holding the trick: anything");
  check(set(play([C(1, "7"), C(2, "A")], [C(0, "A"), C(0, "K"), C(0, "7")])) === set([C(1, "7")]), "out of the suit, the trick the opponents': trump");
  check(set(play([C(1, "7"), C(1, "J")], [C(1, "9"), C(0, "K"), C(0, "7")])) === set([C(1, "J")]), "trumps led: beat the best trump in");
  // bidding: the turned card taken
  let G = newRecord(rules, { seats: 4, options: { game: "belote" }, seed: 4, now: 0 });
  const st = G.state, first = st.turn;
  check(st.hands.every(h => h.length === 5) && st.turned != null, "five each and a card turned up");
  G = applyMove(rules, G, first, { t: "take" }, 0).G;
  check(G.state.step === "play" && G.state.hands.every(h => h.length === 8) && G.state.hands[first].includes(st.turned) && G.state.contract.suit === suitOf(st.turned), "taken: the turned card the taker's, eight each, its suit trumps");
  let H = newRecord(rules, { seats: 4, options: { game: "belote" }, seed: 4, now: 0 });
  for (let k = 0; k < 4; k++) H = applyMove(rules, H, H.state.turn, { t: "pass" }, 0).G;
  check(H.state.round === 2 && !GAMES.belote.bids(H.state, H.state.turn).some(b => b.suit === suitOf(H.state.turned)), "all pass: a second round, any other suit");
  for (let k = 0; k < 4; k++) H = applyMove(rules, H, H.state.turn, { t: "pass" }, 0).G;
  check(H.state.round === 1 && H.state.handNo === 1 && /new deal/.test(H.say.text), "all pass again: dealt anew, not counted");
}

// ---------- whole games ----------
const T = 1_000_000;
for (const game of ["jass", "belote", "schafkopf"]) {
  let G = newRecord(rules, { seats: 4, options: { game, target: 501, deals: 2 }, seed: 11, now: T });
  let ok = true, i = 0;
  for (; i < 6000 && G.state.step !== "over"; i++) {
    const at = rules.wakeAt(G.state);
    if (at != null) { G = applyWake(rules, G, at) || G; continue; }
    const seat = rules.toMove(G.state), r = applyMove(rules, G, seat, botMove(rules, G, seat, seat % 2 ? "medium" : "easy"), T + i);
    if (r.error) { ok = false; console.log(game, r.error); break; }
    G = r.G;
    if (i % 37 === 0) { const back = rules.restore(roundTrip(structuredClone(G.state))); if (JSON.stringify(back.hands) !== JSON.stringify(G.state.hands)) ok = false; }
  }
  check(ok && G.state.step === "over" && G.state.winners.length >= 1, `${game}: a whole game of computer players, every move legal, the state whole through the database (${G.state.handNo} hands)`);
}
check(rules.seats.min === 4 && rules.seats.max === 4 && typeof trumpsBot === "function", "four at the table");

console.log(bad ? `trumps: ${bad} failed` : "trumps: every check passed");
process.exit(bad ? 1 : 0);
