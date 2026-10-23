// Blackjack's rules (blackjack-engine.js, blackjack-strategy.js): what cards count and a hand's total, soft and hard,
// and what's a pair; the dealer's chances from each up card; basic strategy as the engine works it out, held to the
// published chart for a table with a hole card, and to what's published of Macau's tables without one (a dealer's
// blackjack taking everything, or only the original bet, and Sands China's double on 11), with the house's edge for
// each; rounds dealt from shoes set up for each case (blackjacks, insurance, doubles, splits, split aces, surrender, the
// dealer's soft 17, what a dealer's blackjack takes, Over/Under 13); the advice where the chart's play can't be made;
// the shuffler and the shoe; the side bet's and insurance's edges worked out over the cards; and thousands of rounds
// played by the advice, every one settled as it should be.
import { RULES, START, MIN, SIDE, value, handOf, isBlackjack, isPair, newGame, deal, act, plays, advice, betProblem, strategyFor, sideTotal } from "../blackjack-engine.js";
import { dealerOutcomes } from "../blackjack-strategy.js";
import { COACH, isCoach, look, judge, evText, LEVEL } from "../blackjack-coach.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const R = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const c = (name, suit = 3) => R.indexOf(name) * 4 + suit;
const cards = text => text.split(" ").map(t => c(t));
const near = (a, b, d) => Math.abs(a - b) < d;
const pct = x => `${(x * 100).toFixed(3)}%`;

// ---------- cards and hands ----------
{
  check(value(c("A")) === 1 && value(c("9")) === 9 && ["10", "J", "Q", "K"].every(r => value(c(r)) === 10), "an ace 1 (or 11), two to nine their pips, a ten or a court card ten");
  const soft = handOf(cards("A 6")), hard = handOf(cards("A 6 9")), two = handOf(cards("A A"));
  check(soft.total === 17 && soft.soft && hard.total === 16 && !hard.soft && two.total === 12 && two.soft && handOf(cards("K Q 5")).bust, "A 6 is soft 17; with a 9 it's hard 16; two aces soft 12; K Q 5 bust");
  check(isBlackjack(cards("A K")) && !isBlackjack(cards("A K"), true) && !isBlackjack(cards("7 7 7")), "an ace and a ten-value card are a blackjack, but not after a split, and three sevens are just 21");
  check(isPair(cards("K K")) && isPair(cards("8 8")) && !isPair(cards("J Q")) && !isPair(cards("10 K")), "a pair is two cards of one rank: a jack and a queen aren't one");
}

// ---------- the dealer ----------
{
  const rules = { ...RULES };
  const ace = dealerOutcomes(1, rules), ten = dealerOutcomes(10, rules), six = dealerOutcomes(6, rules);
  check(near(ace.bj, 4 / 13, 1e-12) && near(ten.bj, 1 / 13, 1e-12) && six.bj === 0, "a blackjack under an ace four times in thirteen, under a ten once in thirteen");
  check([1, 2, 6, 10].every(u => near(dealerOutcomes(u, rules).dist.reduce((a, p) => a + p, 0), 1, 1e-12)), "each up card's outcomes add up");
  // (a million dealer hands drawn at random gave 42.36% and 43.91%)
  check(near(six.dist[5], 0.4232, 0.0005) && near(dealerOutcomes(6, { ...rules, s17: false }).dist[5], 0.4395, 0.0005), "the dealer busts under a 6 42.3% of the time standing on soft 17, 44.0% hitting it");
}

// ---------- basic strategy, worked out ----------
const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];
const row = (chart, kind, n) => UPS.map(u => chart[kind][`${n},${u}`]).join(" ");
// a table with a hole card (the dealer checks for blackjack first), no surrender: the chart printed for 4 to 8 decks
const US = { ...RULES, holeCard: true, obo: false, doubleOn11Lost: false, surrender: "none" };
// Macau's rules as the DICJ writes them and most of the city deals: no hole card, the original bet only, surrender
// against a 2 to a 10
const MACAU = { ...RULES, doubleOn11Lost: false };
{
  const us = strategyFor(US);
  const HARD = { 8: "H H H H H H H H H H", 9: "H D D D D H H H H H", 10: "D D D D D D D D H H", 11: "D D D D D D D D D H", 12: "H H S S S H H H H H", 13: "S S S S S H H H H H", 16: "S S S S S H H H H H", 17: "S S S S S S S S S S" };
  const SOFT = { 13: "H H H D D H H H H H", 15: "H H D D D H H H H H", 17: "H D D D D H H H H H", 18: "S Ds Ds Ds Ds S S H H H", 19: "S S S S S S S S S S" };
  const PAIRS = { 1: "P P P P P P P P P P", 2: "P P P P P P H H H H", 4: "H H H P P H H H H H", 5: "D D D D D D D D H H", 6: "P P P P P H H H H H", 8: "P P P P P P P P P P", 9: "P P P P P S P P S S", 10: "S S S S S S S S S S" };
  const off = [...Object.entries(HARD).filter(([n, r]) => row(us, "hard", n) !== r).map(([n]) => `hard ${n}`), ...Object.entries(SOFT).filter(([n, r]) => row(us, "soft", n) !== r).map(([n]) => `soft ${n}`), ...Object.entries(PAIRS).filter(([n, r]) => row(us, "pairs", n) !== r).map(([n]) => `pair ${n}`)];
  check(!off.length, `with a hole card: the published chart, cell for cell${off.length ? ` (off: ${off.join(", ")})` : ""}`);
  check(near(us.edge, 0.0040, 0.0002) && near(strategyFor({ ...US, decks: 8 }).edge, 0.0043, 0.0002), `the house's edge with a hole card: ${pct(us.edge)} with six decks, 0.43% with eight (as published)`);
  // no hole card, a dealer's blackjack taking everything (Europe's tables): don't put more out against a ten or an ace
  const eu = strategyFor({ ...US, holeCard: false });
  check(row(eu, "hard", 11) === "D D D D D D D D H H" && row(eu, "hard", 10) === "D D D D D D D D H H" && row(eu, "pairs", 8) === "P P P P P P P P H H" && row(eu, "pairs", 1) === "P P P P P P P P P H",
    "without a hole card, a dealer's blackjack taking everything: hit 11 and 10 against a ten or an ace, and 8s; don't split aces against an ace");
  check(near(eu.edge - us.edge, 0.0011, 0.0002), `which costs about a tenth of a per cent (${pct(eu.edge)})`);
  const obo = strategyFor({ ...US, holeCard: false, obo: true });
  check(row(obo, "hard", 11) === "D D D D D D D D D H" && row(obo, "pairs", 8) === "P P P P P P P P P P" && near(obo.edge, us.edge, 0.0001), "where it takes only the original bet, the game plays and pays as a hole-card table does");
  // Macau: the original bet only, and surrender against a 2 to a 10 (the Wizard of Macau and Maven of Macau: 0.16%)
  const mo = strategyFor(MACAU);
  check(near(mo.edge, 0.0016, 0.0001) && row(mo, "hard", 11) === "D D D D D D D D D H", `Macau's rules: ${pct(mo.edge)}, and 11 doubled against a ten`);
  check(row(mo, "hard", 14) === "S S S S S H H H R H" && row(mo, "hard", 15) === "S S S S S H H H R H" && row(mo, "hard", 16) === "S S S S S H H R R H" && row(mo, "hard", 13) === "S S S S S H H H H H"
    && row(mo, "pairs", 7) === "P P P P P P H H R H" && row(mo, "pairs", 8) === "P P P P P P P P Rp P", "surrender 14, 15 and 16 against a ten, 16 against a 9, 7s against a ten, and 8s against a ten (else split)");
  // Sands China: a double on 11 lost whole to a dealer's blackjack (Maven of Macau: 0.24%, 0.08% more)
  const v = strategyFor(RULES);
  check(row(v, "hard", 11) === "D D D D D D D D H H" && row(v, "hard", 10) === "D D D D D D D D H H", "at the Venetian, 11 against a ten is hit: a double there would lose both units to the dealer's blackjack");
  check(near(v.edge, 0.0024, 0.0001) && near(v.edge - mo.edge, 0.0008, 0.0001), `the Venetian's edge ${pct(v.edge)}, ${pct(v.edge - mo.edge)} more for its double on 11`);
  check(near(strategyFor({ ...RULES, decks: 5 }).edge, 0.00226, 0.0001) && near(strategyFor({ ...MACAU, decks: 8 }).edge, 0.00187, 0.0001), "five decks a shade less, eight a shade more");
  const h17 = strategyFor({ ...US, s17: false });
  check(row(h17, "hard", 11) === "D D D D D D D D D D" && row(h17, "soft", 18) === "Ds Ds Ds Ds Ds S S H H H" && near(h17.edge - us.edge, 0.0022, 0.0003), "a dealer hitting soft 17: double 11 against an ace and soft 18 against a 2, and about 0.2% more to the house");
  check(near(strategyFor({ ...MACAU, s17: false }).edge, 0.0038, 0.0001), "Macau's rules with the dealer hitting soft 17, as their text since 2007 has it: 0.38%");
}

// ---------- rounds, from shoes set up ----------
const table = (shoe, rules = RULES, bet = 1000, side) => { const g = newGame(1, { ...rules, continuous: false }); g.shoe = cards(shoe); g.pos = 0; g.cut = 9999; g.bet = bet; if (side) g.side = side; return g; };
const run = (g, ...moves) => { let s = deal(g).state; for (const m of moves) s = act(s, m).state; return s; };
const LOSE_ALL = { ...RULES, obo: false };
{
  // the cards come: you, the dealer's up card, you; then hits, then the dealer's second card and on
  let s = run(table("A 9 K 8"));
  check(s.round.phase === "over" && s.round.result.net === 1500 && s.balance === START + 1500, "a blackjack against a 9: paid 3 to 2 at once");
  s = run(table("A A K K"), "noInsure");
  check(s.round.result.net === 0 && s.round.result.lines[0].why === "push", "a blackjack against an ace that turns into the dealer's blackjack: a push");
  s = run(table("9 A 7 K"), "insure", "stand");
  check(s.round.result.insurance === 1000 && s.round.result.net === 0, "insured against the dealer's ace, and the dealer has it: the insurance pays 2 to 1, the bet is lost, nothing changes hands");
  s = run(table("6 6 5 9 K"), "double");
  check(s.round.hands[0].stake === 2000 && s.round.hands[0].cards.length === 3 && s.round.result.net === 2000 && s.round.dealer.length === 3, "11 against a 6, doubled: one card (a ten), 21; the dealer's 6 9 draws a K and busts: twice the bet won");
  s = run(table("8 7 8 3 10 K 9"), "split", "stand", "stand");
  check(s.round.hands.length === 2 && s.round.hands.every(h => h.cards.length === 2) && s.round.result.lines.map(l => l.why).join() === "lose,win", "8s split against a 7: each hand gets a card (8 3 then 8 10), the dealer 7 K stands on 17: 11 stood on loses, 18 wins");
  s = run(table("A 6 A K 10 K 9"), "split");
  check(s.round.hands.every(h => h.cards.length === 2) && s.round.result.lines[0].net === 1000 && s.round.result.lines[0].why !== "blackjack", "split aces take one card each; an ace and a ten after a split is 21, paid even money, not a blackjack");
  s = run(table("10 A 6 K"), "noInsure", "stand");
  check(s.round.result.lines[0].why === "dealer blackjack" && s.round.result.net === -1000, "no hole card: the dealer's blackjack comes after you've played");
  // what a dealer's blackjack takes
  s = run(table("6 10 4 K A"), "double");
  check(s.round.result.net === -1000 && run(table("6 10 4 K A", LOSE_ALL), "double").round.result.net === -2000, "10 doubled against a ten, and the dealer turns an ace: only the original bet goes (where the table takes everything, both)");
  s = run(table("6 10 5 K A"), "double");
  check(s.round.result.net === -2000 && run(table("6 10 5 K A", MACAU), "double").round.result.net === -1000, "11 doubled against a ten: at the Venetian the dealer's blackjack takes both units (under the DICJ's rule alone, one)");
  s = run(table("8 10 8 3 9 A"), "split", "stand", "stand");
  check(s.round.result.net === -1000 && run(table("8 10 8 3 9 A", LOSE_ALL), "split", "stand", "stand").round.result.net === -2000, "8s split against a ten, and the dealer's blackjack: the split hand comes back, the original bet goes");
  s = run(table("8 10 8 3 K 9 A"), "split", "double", "stand");
  check(s.round.result.net === -2000, "and with the first hand doubled on 11: the original bet and that double go, the second hand comes back");
  s = run(table("10 6 6 A 5 K", { ...RULES, s17: true }), "stand");
  check(s.round.dealer.length === 2 && s.round.result.lines[0].why === "lose", "standing on soft 17: the dealer's 6 A stands, 17 beats your 16");
  s = run(table("10 6 6 A 5 K", { ...RULES, s17: false }), "stand");
  check(s.round.dealer.length === 4 && s.round.result.lines[0].why === "dealer bust", "hitting soft 17: the dealer's 6 A draws a 5 (12) and a K, and busts");
  // surrender, before the dealer's second card: half back, even when it would have made blackjack
  s = run(table("10 9 6 K"), "surrender");
  check(s.round.result.net === -500 && s.round.hands[0].surrendered, "16 surrendered against a 9: half the bet back");
  s = run(table("10 10 6 A"), "surrender");
  check(s.round.result.net === -500 && s.round.result.dealerBJ, "16 surrendered against a ten that turns into blackjack: still only half lost (early surrender, in effect)");
  check(!plays(act(deal(table("10 A 6 K")).state, "noInsure").state).has("surrender"), "no surrender against an ace");
  s = deal(table("10 5 6 K")).state;
  check([...plays(s)].sort().join() === "double,hit,stand,surrender" && advice(s) === "stand", "16 against a 5: hit, stand, double or surrender, and the chart says stand");
  check(!plays(deal(table("J 5 Q 9")).state).has("split") && plays(deal(table("K 5 K 9")).state).has("split"), "a jack and a queen can't be split; two kings can");
  check(betProblem(MIN - 100, START) && betProblem(MIN + 50, START) && betProblem(MIN, MIN - 100) && !betProblem(MIN, START), `bets from HK$${MIN}, in HK$100s, within what you hold`);
  check(betProblem(MIN, START, { over: 50 }) && betProblem(MIN, START, { under: SIDE.max + 100 }) && betProblem(MIN, MIN + 100, { over: 200 }) && betProblem(0, START, { over: SIDE.min }) && betProblem(MIN, START, { over: SIDE.min, under: SIDE.min })
    && !betProblem(MIN, START, { over: SIDE.max }) && !betProblem(MIN, START, { under: SIDE.min }),
    `Over/Under 13 from HK$${SIDE.min} to HK$${SIDE.max.toLocaleString("en-GB")}, in HK$100s, one or the other, only with a bet in the circle, within what you hold`);
}

// ---------- Over/Under 13 ----------
{
  let s = run(table("6 9 7 K", RULES, 1000, { over: 500, under: 0 }), "stand"), t = run(table("6 9 7 K", RULES, 1000, { over: 0, under: 500 }), "stand");
  check(s.round.result.side.total === 13 && s.round.result.side.over === -500 && t.round.result.side.under === -500, "your first two cards make 13: Over loses, and so would Under");
  s = run(table("A 9 K 8", RULES, 1000, { over: 0, under: 500 }));
  check(s.round.result.side.total === 11 && s.round.result.side.under === 500 && s.round.result.net === 2000, "a blackjack makes 11 (the ace one): Under wins even money, and the blackjack is paid 3 to 2");
  s = run(table("9 9 5 K 9", RULES, 1000, { over: 500, under: 0 }), "stand");
  check(s.round.result.side.over === 500 && s.round.result.net === -500 && s.balance === START - 500, "9 and 5 make 14: Over wins even money, whatever the hand does (here 14 loses to the dealer's 19)");
  s = run(table("8 9 8 3 9 K 7", RULES, 1000, { over: 500 }), "split", "stand", "stand");
  check(s.round.result.side.total === 16, "after a split, the side bet still goes by the first two cards dealt");
  // what the house keeps: over every two cards from a full six-deck shoe, an ace one
  const n = [0, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => 24 * (v === 10 ? 4 : 1))], all = 312;
  let over = 0, under = 0;
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) {
    const p = (n[a] / all) * ((n[b] - (a === b ? 1 : 0)) / (all - 1)), t = a + b;
    if (t > 13) over += p; else if (t < 13) under += p;
  }
  check(near(1 - 2 * over, 0.0655, 0.00005) && near(1 - 2 * under, 0.1007, 0.00005) && sideTotal(cards("A K")) === 11, `Over 13 keeps the house ${pct(1 - 2 * over)}, Under 13 ${pct(1 - 2 * under)} (as Maven of Macau publishes, 6.55% and 10.07%)`);
}

// ---------- insurance and even money, over the cards left ----------
{
  // six decks less your two cards and the dealer's up card: the chance the dealer's next card makes blackjack
  const left = 309, tens = held => 96 - held, aces = held => 24 - held;
  const insure = held => (2 * tens(held) - (left - tens(held))) / left;
  check(near(insure(0), -0.068, 0.0005) && near(insure(2), -0.0874, 0.0005), `insurance loses ${(-insure(0) * 100).toFixed(1)}% holding no ten, ${(-insure(2) * 100).toFixed(1)}% holding two`);
  const waitAce = 1.5 * (1 - tens(1) / left), waitTen = 1.5 * (1 - aces(1) / left);
  check(near(waitAce, 1.039, 0.001) && near(waitTen, 1.388, 0.001), `with a blackjack, waiting is worth ${waitAce.toFixed(2)} against an ace and ${waitTen.toFixed(2)} against a ten, to even money's 1`);
}

// ---------- the advice where the chart's play can't be made ----------
{
  let s = run(table("8 6 8 8 8 8 K K K K K K K"), "split", "split", "split");
  check(s.round.hands.length === 4 && isPair(s.round.hands[0].cards) && !plays(s).has("split") && advice(s) === "stand", "8s again with four hands out: no more splitting, and 16 against a 6 stands");
  s = run(table("8 10 8 8 K K K K"), "split");
  check(advice(s) === "split", "8s again against a ten after a split: surrender's gone, so split (the chart's Rp)");
  s = run(table("A 3 7 2"), "hit");
  check(advice(s) === "stand", "soft 18 in three cards against a 3: double, else stand (Ds)");
}

// ---------- the coach ----------
{
  check(COACH.map(([k]) => k).join() === "off,hints,check,on" && isCoach("on") && isCoach("off") && !isCoach(true) && !isCoach("always"), "the coach's four ways, off to always");
  check(evText(0.123) === "+0.12" && evText(-0.5) === "−0.50" && evText(-0.001) === "0.00", "an average result is written signed, in bets, and a hair either side of nothing is nothing");
  // 16 against a 5: the chart stands; each play open is there with an average, standing's the best, and the reasons are in numbers
  let s = deal(table("10 5 6 K")).state, lk = look(s);
  check(lk.tip === "stand" && lk.hand === "16 against a 5" && lk.short === "Stand: 16 against a 5" && lk.rows.map(x => x.play).join() === "stand,hit,surrender,double" && lk.rows[0].best && lk.rows.filter(x => x.best).length === 1,
    `16 against a 5: stand, the plays open ranked by what they average (${lk.rows.map(x => `${x.play} ${evText(x.ev)}`).join(", ")})`);
  check(/busts 62% at once/.test(lk.rows.find(x => x.play === "hit").note) && /^wins 4[23]%, loses 5[78]%$/.test(lk.rows[0].note) && /dealer's 5 is a weak card: it busts 4[23]%.*would bust 62%/.test(lk.why),
    `the notes and the reason are the numbers: a hit busts 62%, the dealer's 5 busts 43% (“${lk.why}”)`);
  let v = judge(lk, "stand");
  check(v.ok && !v.level && v.cost === 0 && /^✓ Stand: the chart's play/.test(v.say), "standing is the chart's play");
  v = judge(lk, "hit");
  check(!v.ok && v.cost > 0.1 && /^✗ Hit: the chart says stand \(16 against a 5\), worth 0\.\d\d of a bet more/.test(v.say) && v.line === "The chart says stand: 16 against a 5", `hitting it isn't, and costs ${v.cost.toFixed(2)} of a bet: “${v.say}”`);
  check(!judge(lk, "double").ok && judge(lk, "double").cost > judge(lk, "hit").cost, "doubling it costs more than hitting it");
  // a hand where two plays are level isn't faulted: judge treats a hundredth of a bet as a tie
  const level = { tip: "hit", hand: "x", rows: [{ play: "hit", name: "Hit", ev: 0.1, best: true }, { play: "stand", name: "Stand", ev: 0.1 - LEVEL / 2 }] };
  v = judge(level, "stand");
  check(v.ok && v.level && /level with the chart's hit/.test(v.say), "within a hundredth of a bet, a play is level with the chart's, not a mistake");
  // a double the table won't allow isn't offered: three cards, no double; the rows are only plays open
  s = run(table("5 6 4 K 3 9"), "hit");
  lk = look(s);
  check(!lk.rows.some(x => x.play === "double" || x.play === "surrender" || x.play === "split") && lk.rows.every(x => plays(s).has(x.play)), "after a hit there's no double, split or surrender in the coach's list: only the plays open");
  // pairs: eights are split, said so; tens are stood on, and the split is there for comparison
  lk = look(deal(table("8 6 8 K")).state);
  check(lk.tip === "split" && lk.hand === "a pair of 8s against a 6" && /16, the worst total/.test(lk.why) && lk.rows[0].play === "split", `8s: split (“${lk.why}”)`);
  lk = look(deal(table("K 6 K 9")).state);
  check(lk.tip === "stand" && lk.hand === "a pair of tens against a 6" && /Splitting would break up a 20/.test(lk.why) && lk.rows.find(x => x.play === "split").ev < lk.rows[0].ev, "tens: stand, and the split's worth is shown to be less");
  lk = look(deal(table("A 6 A K")).state);
  check(lk.tip === "split" && /Two aces make a poor 12/.test(lk.why), "aces: split");
  // doubling 11, a soft total, hitting low totals, surrender
  lk = look(deal(table("5 4 6 K")).state);
  check(lk.tip === "double" && /turns 11 into 21.*busts 39%/.test(lk.why), `11 against a 4: double (“${lk.why}”)`);
  lk = look(deal(table("A 3 5 K")).state);
  check(lk.tip === "hit" && /can't bust a soft 16/.test(lk.why) && look(deal(table("A 9 5 K")).state).tip === "hit", `soft 16 against a 3: hit (“${lk.why}”)`);
  lk = look(deal(table("5 10 3 K")).state);
  check(lk.tip === "hit" && /No single card can bust 8/.test(lk.why), "8 against a ten: no single card can bust it");
  lk = look(deal(table("10 10 5 K")).state);
  check(lk.tip === "surrender" && /every other play loses more than the half a bet you give up: (hit|stand) averages −0\.5\d/.test(lk.why) && lk.rows[0].ev === -0.5, `15 against a ten: surrender (“${lk.why}”)`);
  // insurance: the arithmetic of a ten under the ace, from the shoe as it stands (two tens out of the shoe here)
  s = deal(table("10 A 6 K")).state; lk = look(s);
  check(s.round.phase === "insurance" && lk.tip === "noInsure" && lk.rows.map(x => x.play).join() === "noInsure,insure" && near(lk.rows[1].ev, -0.039, 0.001) && /needs a third/.test(lk.why) && /31%/.test(lk.rows[1].note),
    `insurance on 16: no (${evText(lk.rows[1].ev)} a bet for insuring; “${lk.why}”)`);
  s = deal(table("A A K 6")).state; lk = look(s);
  check(s.round.phase === "insurance" && lk.hand === "a blackjack against an ace" && lk.rows.map(x => x.play).join() === "noInsure,insure" && near(lk.rows[0].ev, 1.04, 0.01) && lk.rows[1].ev === 1 && /sure 1/.test(lk.why),
    `a blackjack against an ace: play it on (${lk.rows[0].ev.toFixed(2)} against the sure 1)`);
  v = judge(lk, "insure");
  check(!v.ok && /^✗ Even money: the chart says play it on/.test(v.say) && v.cost > 0.03, `and even money costs ${v.cost.toFixed(2)} of a bet: “${v.say}”`);
  check(look(run(table("10 5 6 K"), "stand")) === null, "a finished round has no decision to coach");
  // across thousands of hands: every decision gets rows that are the plays open, led by the chart's play, with words that say something
  let g = newGame(77), decisions = 0, led = 0, openOnly = 0, worded = 0, order = 0;
  for (let n = 0; n < 1500; n++) {
    g = { ...g, bet: 1000, side: { over: 0, under: 0 } };
    g = deal(g).state;
    while (g.round.phase !== "over") {
      const d = look(g), open = plays(g);
      decisions++;
      if (d.rows[0].play === d.tip && d.rows.filter(x => x.best).length === 1 && d.rows[0].best) led++;
      if (d.rows.length === open.size && d.rows.every(x => open.has(x.play))) openOnly++;
      if (d.why.length > 20 && !/NaN|undefined|null/.test(d.why + d.short + d.rows.map(x => x.note).join())) worded++;
      if (d.rows.every((x, i) => i === 0 || x.ev == null || d.rows[i - 1].ev == null || d.rows[i - 1].ev >= x.ev)) order++;
      g = act(g, advice(g)).state;
    }
  }
  check(decisions > 1500 && led === decisions && openOnly === decisions && worded === decisions && order === decisions, `${decisions} decisions over 1,500 rounds: the chart's play always first of the plays open and the only one marked, every list ranked, every reason said in numbers (${led}, ${openOnly}, ${worded}, ${order})`);
}

// ---------- the shuffler and the shoe ----------
{
  const g = newGame(5), each = new Map();
  for (const id of g.shoe) each.set(id, (each.get(id) || 0) + 1);
  check(g.shoe.length === 52 * RULES.decks && [...each.values()].every(n => n === RULES.decks), `${RULES.decks} decks, every card ${RULES.decks} times`);
  let s = { ...g, bet: MIN }, fresh = true, differ = 0, last = null;
  for (let k = 0; k < 50; k++) {
    let st = deal(s).state;
    // a round's first cards come off the top of all six decks: three, and the dealer's second when your blackjack ends it
    if (st.pos > 4 || st.shoe.length !== 52 * RULES.decks) fresh = false;
    while (st.round.phase !== "over") st = act(st, advice(st)).state;
    if (last && st.shoe.slice(0, 20).join() !== last) differ++;
    last = st.shoe.slice(0, 20).join();
    s = { ...st, bet: MIN, balance: START };
  }
  check(fresh && differ === 49, "with the shuffler, every round is dealt from all six decks, shuffled anew");
  const shoeRules = { ...RULES, continuous: false };
  const h = newGame(5, shoeRules);
  check(h.cut === Math.round(h.shoe.length * shoeRules.penetration), `a shoe's cut card ${Math.round(shoeRules.penetration * 100)}% of the way in`);
  let t = { ...h, bet: MIN }, shoes = 1, once = true;
  for (let k = 0; k < 200; k++) {
    const passed = t.pos >= t.cut;
    let st = deal(t).state;
    while (st.round.phase !== "over") st = act(st, advice(st)).state;
    if (st.shoeNo > shoes) { shoes = st.shoeNo; if (!passed || st.pos > 20) once = false; }
    t = { ...st, bet: MIN, balance: START };
  }
  check(shoes > 1 && once, `two hundred rounds from a shoe go through ${shoes} shoes, each new one only once a round has passed the cut card`);
}

// ---------- many rounds by the chart ----------
{
  let s = { ...newGame(9), bet: 1000 }, staked = 0, net = 0, ok = true, splits = 0, doubles = 0, bjs = 0, surrenders = 0;
  for (let k = 0; k < 20000; k++) {
    s.balance = START * 10;
    let st = deal(s).state;
    while (st.round.phase !== "over") { const a = advice(st); if (!plays(st).has(a)) { ok = false; break; } st = act(st, a).state; }
    const r = st.round;
    if (r.result.net !== st.balance - START * 10) ok = false;
    staked += 1000;
    net += r.result.net;
    splits += r.hands.length > 1;
    doubles += r.hands.some(h => h.doubled);
    surrenders += r.hands.some(h => h.surrendered);
    bjs += r.result.lines.some(l => l.why === "blackjack");
    s = { ...st, bet: 1000 };
  }
  const edge = strategyFor(RULES).edge;
  check(ok && splits > 200 && doubles > 1500 && bjs > 800 && surrenders > 300, `twenty thousand rounds by the chart: every play the chart picks is open, every round settled into the bankroll (${splits} split, ${doubles} doubled, ${surrenders} surrendered, ${bjs} blackjacks)`);
  check(Math.abs(-net / staked - edge) < 0.02, `and they lose ${(-net / staked * 100).toFixed(2)}% of the original bets (the edge is ${pct(edge)}; twenty thousand rounds swing a point or so)`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("blackjack: cards and hands, the dealer, basic strategy and the edge, rounds, Over/Under 13, insurance, the advice, the coach, the shuffler and the shoe, many rounds by the chart");
