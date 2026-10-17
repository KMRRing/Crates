// Big Two (bigtwo-rules.js, bigtwo-bot.js): what a play is and what beats what (singles by rank then suit, pairs by
// rank then their higher suit, triples, the five-card hands by kind and then their own order: straights from 34567 to
// A2345 with no K-A-2 round the corner, flushes by their ranks before their suit), the first lead with the ♦3, a
// trick passed round to its last player, 頂大, the penalties, three players' seventeen cards and the spare, Taiwan's
// suit order, whole games of computer players with every card accounted for, the state through the database, and the
// strengths against each other.
import { rules, classify, beats, allPlays, playsFor, check, penalty, value, lowest, RANKS, SUITS, cardName } from "../bigtwo-rules.js";
import { botMove, plan } from "../bigtwo-bot.js";
import { think, choices, quickPlays, quickPlan, sameMove } from "../bigtwo-think.js";
import { verdict, moveName, adviceLine, MARGIN } from "../bigtwo-coach.js";
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
// ---------- the coach ----------
{
  // the fast plays the coach plays out with: real plays, every one the rules allow but for a five-card hand's
  // spare cards (each straight by its top card, each full house's three, each four, every flush of a suit's lowest
  // eight), so following, the play-outs miss no strength of play
  let real = true, covered = true, hands = 0;
  for (let g = 0; g < 120; g++) {
    const hand = R(2000 + g, 3 + (g % 2)).state.hands[0];
    const quick = quickPlays(hand, O), all = allPlays(hand, O), key = p => `${p.n}:${p.kind}:${p.key.join(",")}`;
    if (!quick.every(p => classify(p.cards, O) && all.some(q => q.cards.length === p.cards.length && q.cards.every(c => p.cards.includes(c))))) real = false;
    if ([0, 1, 2, 3].some(st => hand.filter(c => (c & 3) === st).length > 8)) continue;
    const have = new Set(quick.map(key));
    if (!all.every(p => have.has(key(p)))) covered = false;
    hands++;
  }
  check_(real && covered, `the coach's fast plays: every one a real play, and every kind and strength of play the rules allow found (${hands} hands)`);
  let whole = 0;
  for (let g = 0; g < 60; g++) {
    const hand = R(3000 + g, 3 + (g % 2)).state.hands[1], p = quickPlan(hand, O), sort = xs => [...xs].sort((a, b) => a - b).join();
    if (sort(p.plays.flatMap(x => x.cards)) === sort(hand) && p.plays.every(x => classify(x.cards, O))) whole++;
  }
  check_(whole === 60, `its plan of a hand holds every card once, each a play (${whole} of 60 hands)`);
}
{
  // the hint (bigtwo.js): the coach's play picked, the rest of the hand split into the plays it counts on after it, as
  // the page sets them out: every card in exactly one, each a play by the rules; and the coach's play a legal one, the
  // same each time it's asked
  let fine = 0, legal = 0, same = 0, tried = 0;
  for (let g = 0; g < 16; g++) {
    let G = R(900 + g, 3 + (g % 2));
    for (let k = 0; k < (g * 3) % 17; k++) { const who = rules.toMove(G.state); G = applyMove(rules, G, who, botMove(G.state, who, { level: "medium" }), 0).G; }
    const s = G.state, seat = s.turn, hand = s.hands[seat];
    if (s.step !== "play") continue;
    const r = think(s, seat, { ms: 40, maxDeals: 24 }), again = think(s, seat, { ms: 40, maxDeals: 24 }), m = r.best, cards = m.t === "play" ? m.cards : [];
    const groups = quickPlan(hand.filter(c => !cards.includes(c)), s.opts).plays, sort = xs => [...xs].sort((a, b) => a - b).join();
    tried++;
    if (sort([...cards, ...groups.flatMap(p => p.cards)]) === sort(hand) && groups.every(p => classify(p.cards, s.opts))) fine++;
    if (m.t === "pass" ? !!s.trick.last : playsFor(s, seat).some(p => sort(p.cards) === sort(cards))) legal++;
    if (sameMove(r.best, again.best)) same++;
  }
  check_(fine === tried && legal === tried && same === tried, `the coach's play: legal (${legal} of ${tried}), the same each time it's asked (${same}), and with the plays the rest of the hand makes after it holding every card once (${fine})`);
}
{
  // the end of a deal, worked out exactly: Kit, next, on his last card, has led... no: Ming led the 4♦; you hold the 5♦
  // and the 2♠. The 5 lets Kit out with anything over it; the 2 takes the trick, and the 5 goes out after it
  const st = { seats: 4, opts: { ...O, top: false }, hands: [H("5♦ 2♠"), H("6♣"), H("7♣ 8♣ 9♣ 10♣ J♣ Q♣ K♣"), H("3♣ 3♥ 9♦ 10♦")], played: [], trick: { plays: [], last: { ...classify(H("4♦"), O), cards: H("4♦") }, by: 3, passes: 0 }, mustLead: null, turn: 0, step: "play", deal: 1 };
  st.played = Array.from({ length: 52 }, (_, i) => i).filter(c => !st.hands.flat().includes(c));
  const r = think(st, 0, { ms: 200 });
  check_(r.best.t === "play" && cardName(r.best.cards[0]) === "2♠" && r.list[0].mean > 0, `next to a player on his last card, the coach takes the trick with the 2♠ and goes out on the 5♦ (+${r.list[0].mean.toFixed(1)} a deal)`);
  const five = verdict(r, { t: "play", cards: H("5♦") }, st, 0), pass = verdict(r, { t: "pass" }, st, 0);
  check_(five && five.gap > MARGIN && /Your 5♦: about [\d.]+ points a deal worse than playing the 2♠/.test(five.words) && pass && /Seat 2 has one card left/.test(pass.words) && verdict(r, r.best, st, 0) === null,
    `the check: the 5♦ (${five?.words}) and a pass (${pass?.words}) set against it; its own move no word`);
  check_(moveName({ t: "play", cards: H("9♦ 9♣ 9♥ 3♠ 3♦") }, O) === "a full house, 9s" && moveName({ t: "play", cards: H("3♦ 4♣ 5♥ 6♠ 7♦") }, O) === "a straight to the 7♦" && moveName({ t: "pass" }, O) === "pass" && /^Play the 2♠, and you're out|^Play the 2♠ · then a single/.test(adviceLine(r, st, 0)),
    `moves in words: a full house, 9s; a straight to the 7♦; and the advice (${adviceLine(r, st, 0)})`);
  check_(choices(st, 0).length === 3, "its choices there: the 5♦, the 2♠ and passing");
  // later still, the five cards you can't see can lie only thirty ways (one, two and two): the coach tries each once
  // and solves every one, so its answer is exact, not a sample: the 2♠ then the 5♦ goes out every time, for the 1 + 2 + 2
  // cards the others hold
  const late = { ...st, hands: [H("5♦ 2♠"), H("6♣"), H("7♣ 8♣"), H("3♣ 3♥")] };
  late.played = Array.from({ length: 52 }, (_, i) => i).filter(c => !late.hands.flat().includes(c));
  const ex = think(late, 0, { ms: 5000, maxDeals: 480, must: { t: "pass" } });
  check_(ex.exact && ex.solved && ex.deals === 30 && cardName(ex.best.cards?.[0] ?? -1) === "2♠" && ex.list[0].mean === 5 && ex.list.find(c => c.move.t === "pass")?.n === 30,
    `with five cards unseen, one with one player and two with each of the others, the coach tries all ${ex.deals} ways they can lie (exact: ${ex.exact}) and solves each (${ex.solved}): the 2♠, worth exactly ${ex.list[0].mean} a deal`);
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
