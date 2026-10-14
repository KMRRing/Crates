// Big Two (bigtwo-rules.js, bigtwo-bot.js): what a play is and what beats what (singles by rank then suit, pairs by
// rank then their higher suit, triples, the five-card hands by kind and then their own order: straights from 34567 to
// A2345 with no K-A-2 round the corner, flushes by their ranks before their suit), the first lead with the ♦3, a
// trick passed round to its last player, 頂大, the penalties, three players' seventeen cards and the spare, Taiwan's
// suit order, whole games of computer players with every card accounted for, the state through the database, and the
// strengths against each other.
import { rules, classify, beats, allPlays, playsFor, check, penalty, value, lowest, RANKS, SUITS, cardName } from "../bigtwo-rules.js";
import { botMove, plan } from "../bigtwo-bot.js";
import { newRecord, applyMove, applyWake, seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check_ = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
// a card by name: "3♦", "10♠", "A♥", "2♣"
const C = name => { const r = RANKS.indexOf(name.slice(0, -1)), s = SUITS.indexOf(name.slice(-1)); if (r < 0 || s < 0) throw new Error(name); return r * 4 + s; };
const H = s => s.split(" ").map(C);
const K = s => classify(H(s));
const O = { deals: 8, suits: "hk", triples: true, top: true, talk: "en" };

// ---------- what a play is ----------
check_(K("3♦").kind === "single" && K("7♣ 7♠").kind === "pair" && K("9♦ 9♣ 9♥").kind === "triple", "a single, a pair, a triple");
check_(!K("7♣ 8♣") && !K("9♦ 9♣ 9♥ 9♠") && !K("3♦ 4♦ 5♦ 6♦"), "two different cards, four alike and four in a row aren't plays");
check_(K("3♦ 4♣ 5♥ 6♠ 7♦").kind === "straight" && K("3♠ 7♠ 9♠ J♠ K♠").kind === "flush" && K("5♦ 5♣ 5♥ J♠ J♦").kind === "fullhouse", "a straight, a flush, a full house");
check_(K("8♦ 8♣ 8♥ 8♠ 3♦").kind === "four" && K("4♥ 5♥ 6♥ 7♥ 8♥").kind === "straightflush", "four of a kind with one, a straight flush");
check_(K("A♦ 2♣ 3♥ 4♠ 5♦").kind === "straight" && K("2♦ 3♣ 4♥ 5♠ 6♦").kind === "straight" && K("10♦ J♣ Q♥ K♠ A♦").kind === "straight", "A2345, 23456 and 10JQKA are straights");
check_(!K("J♦ Q♣ K♥ A♠ 2♦") && !K("Q♦ K♣ A♥ 2♠ 3♦") && !K("K♦ A♣ 2♥ 3♠ 4♦"), "no straight goes round the corner from K through A to 2");
check_(classify(H("9♦ 9♣ 9♥"), { ...O, triples: false }) === null, "triples can be left out");

// ---------- what beats what ----------
const beat = (a, b) => beats(K(a), K(b));
check_(beat("2♦", "A♠") && beat("3♠", "3♥") && !beat("3♥", "3♠"), "singles: twos high, then the suit (♠ over ♥)");
check_(beat("7♦ 7♠", "7♣ 7♥") && beat("8♦ 8♣", "7♥ 7♠") && !beat("7♣ 7♥", "7♦ 7♠"), "pairs: by rank, then the higher suit in each");
check_(!beat("9♦ 9♣", "8♦ 8♣ 8♥") && !beat("8♦ 8♣ 8♥", "9♦"), "a play only beats one with as many cards");
check_(beat("3♠ 7♠ 9♠ J♠ K♠", "10♦ J♣ Q♥ K♠ A♦") && beat("5♦ 5♣ 5♥ 3♠ 3♦", "2♥ 7♥ 9♥ J♥ K♥") && beat("8♦ 8♣ 8♥ 8♠ 3♦", "A♦ A♣ A♥ K♠ K♦") && beat("3♦ 4♦ 5♦ 6♦ 7♦", "2♦ 2♣ 2♥ 2♠ 3♣"), "five cards: straight < flush < full house < four < straight flush");
check_(beat("A♦ 2♣ 3♥ 4♠ 5♦", "2♦ 3♣ 4♥ 5♠ 6♦") && beat("2♦ 3♣ 4♥ 5♠ 6♦", "10♦ J♣ Q♥ K♠ A♠") && beat("10♦ J♣ Q♥ K♠ A♦", "9♦ 10♣ J♥ Q♠ K♠"), "straights: A2345 over 23456 over 10JQKA over 9 to K");
check_(beat("3♦ 4♣ 5♥ 6♠ 7♠", "3♣ 4♦ 5♥ 6♠ 7♥") && !beat("3♣ 4♦ 5♥ 6♠ 7♥", "3♦ 4♣ 5♥ 6♠ 7♠"), "the same straight: its top card's suit decides");
check_(beat("4♦ 6♦ 8♦ 10♦ K♦", "3♠ 5♠ 7♠ 9♠ Q♠") && beat("4♠ 6♠ 8♠ 10♠ K♠", "4♦ 6♦ 8♦ 10♦ K♦"), "flushes: by their ranks from the top first, the suit only when every rank is equal");
check_(beat("9♦ 9♣ 9♥ 3♠ 3♦", "8♦ 8♣ 8♥ A♠ A♦") && beat("2♦ 2♣ 2♥ 2♠ 3♦", "A♦ A♣ A♥ A♠ K♦"), "full houses by their three, fours by their four");

// ---------- the game ----------
const R = (seed = 1, seats = 4, opts = {}) => newRecord(rules, { seats, options: { ...O, ...opts }, seed, now: 0 });
{
  const G = R(3), s = G.state, holder = s.hands.findIndex(h => h.includes(C("3♦")));
  check_(s.hands.every(h => h.length === 13) && new Set(s.hands.flat()).size === 52, "four hands of thirteen, every card dealt once");
  check_(s.turn === holder && s.mustLead === C("3♦"), "the holder of the ♦3 leads");
  const other = s.hands[holder].find(c => c !== C("3♦"));
  check_(/must include the 3♦/.test(applyMove(rules, G, holder, { t: "play", cards: [other] }).error || ""), "the first play must include the ♦3");
  check_(/lead/.test(applyMove(rules, G, holder, { t: "pass" }).error || ""), "the leader can't pass");
  const G1 = applyMove(rules, G, holder, { t: "play", cards: [C("3♦")] }).G;
  check_(G1.state.trick.last.kind === "single" && G1.state.turn === (holder + 1) % 4, "the ♦3 alone, then the next player");
  let g = G1;
  for (let i = 0; i < 3; i++) g = applyMove(rules, g, g.state.turn, { t: "pass" }).G;
  check_(g.state.turn === holder && !g.state.trick.last && g.state.leader === holder, "three passes: the trick is over and its last player leads anything");
}
{
  // three players: seventeen each, the spare to whoever holds the ♦3
  const G = R(11, 3), s = G.state, holder = s.hands.findIndex(h => h.includes(C("3♦")));
  check_(s.hands.map(h => h.length).sort().join() === "17,17,18" && s.hands[holder].length === 18 && new Set(s.hands.flat()).size === 52, "three players: seventeen each, the spare card to whoever holds the ♦3");
  const T = R(5, 4, { suits: "tw" });
  check_(lowest(T.state.opts) === C("3♣") && T.state.mustLead === C("3♣") && value(C("3♣"), T.state.opts) < value(C("3♦"), T.state.opts), "Taiwan's order: clubs lowest, the ♣3 leads");
}
{
  // 頂大: the next player down to one card, a single must be your highest
  const s = { seats: 4, opts: O, hands: [H("4♦ 9♣ K♥"), H("5♠"), H("6♦ 7♦"), H("8♣ 8♦")], trick: { plays: [], last: null, by: null, passes: 0 }, mustLead: null, turn: 0 };
  const singles = playsFor(s, 0).filter(p => p.n === 1).map(p => cardName(p.cards[0]));
  check_(singles.join() === "K♥", `頂大: leading a single with the next player on one card, only your highest (${singles.join(" ")})`);
  check_(/頂大/.test(check(s, 0, [C("4♦")]).why || ""), "and a lower one is refused, with why");
  s.opts = { ...O, top: false };
  check_(playsFor(s, 0).filter(p => p.n === 1).length === 3, "without the rule, any single");
}
check_([1, 9, 10, 12, 13].map(penalty).join() === "1,9,20,24,39", "penalties: a point a card, two from ten (雙炒), three for all thirteen (三炒)");

// ---------- whole games ----------
{
  const rng = seeded(31);
  let ok = true, deals = 0, moves = 0;
  for (let g = 0; g < 4; g++) {
    const seats = g % 2 ? 3 : 4, lv = ["hard", "medium", "easy"];
    let G = R(100 + g, seats, { deals: 2, triples: g % 2 === 0 }), now = 0;
    for (let i = 0; i < 6000 && !rules.over(G.state); i++) {
      const who = rules.toMove(G.state);
      if (who == null) { now = G.state.until; G = applyWake(rules, G, now); continue; }
      const m = botMove(G.state, who, { level: lv[(who + g) % 3], rng });
      const r = applyMove(rules, G, who, m, now);
      if (r.error) { ok = false; console.log(`  illegal: ${r.error}`, m); break; }
      G = r.G; moves++;
      const s = G.state;
      if (s.step === "play" && s.hands.flat().length + s.played.length !== 52) { ok = false; console.log("  cards lost"); break; }
    }
    if (!rules.over(G.state)) ok = false;
    deals += G.state.log.length;
    const sum = G.state.scores.reduce((a, b) => a + b, 0);
    if (sum !== 0) { ok = false; console.log("  the scores don't balance", G.state.scores); }
  }
  check_(ok, `whole games of computer players at three and four seats: every move legal, every card accounted for, the scores balancing (${deals} deals, ${moves} moves)`);
}
{
  const G = R(7), back = roundTrip(G);
  const who = back.state.turn ?? G.state.turn;
  const r = applyMove(rules, back, G.state.turn, { t: "play", cards: [G.state.mustLead] });
  check_(r.G && r.G.state.trick.plays.length === 1 && r.G.state.played.length === 1, "the game carries on from what the database gives back");
}
{
  // the plan: fewest leads
  const p = plan(H("3♦ 4♣ 5♥ 6♠ 7♦ 9♣ 9♥ K♠ K♦ K♣ 2♠ A♦ A♥"), O);
  check_(p.plays.length === 4 && p.plays.some(x => x.kind === "straight") && p.plays.some(x => x.kind === "fullhouse") && p.plays.some(x => x.kind === "single" && x.cards[0] === C("2♠")), `thirteen cards organised into four plays: a straight, a full house, a pair and the two kept alone (${p.plays.map(x => x.kind).join(", ")})`);
}
{
  const rng = seeded(8), pts = { hard: 0, easy: 0 };
  for (let g = 0; g < 6; g++) {
    const lv = g % 2 ? ["hard", "easy", "hard", "easy"] : ["easy", "hard", "easy", "hard"];
    let G = R(500 + g, 4, { deals: 3 }), now = 0;
    while (!rules.over(G.state)) {
      const who = rules.toMove(G.state);
      if (who == null) { now = G.state.until; G = applyWake(rules, G, now); continue; }
      G = applyMove(rules, G, who, botMove(G.state, who, { level: lv[who], rng }), now).G;
    }
    G.state.scores.forEach((v, i) => { pts[lv[i]] += v; });
  }
  check_(pts.hard > pts.easy, `Hard scores more than Easy over 18 deals (${pts.hard} against ${pts.easy})`);
}

console.log(bad ? `bigtwo: ${bad} failed` : "bigtwo: every check passed");
process.exit(bad ? 1 : 0);
