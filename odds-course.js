// The Odds course, the last part of Maths (maths.html): probability, expected value, base rates, Bayes, prices, Kelly sizing, calibration and
// judgement, taught on dice, coins, cards, urns, markets and estimates. It runs on the shared course sheet (course.js)
// with the stage in odds-stage.js. Every number a lesson states is worked out here from odds-math.js, never typed, and
// tests/odds.mjs recomputes each step that carries a `value` by another route (a count, a search, a simulation).
//
// A step, over the stage:
//   { say }                                       words, and Next
//   { say, w }                                    words over a figure or something to play with (w: a widget, below)
//   { say, quiz: [options], answer, why, w? }     choose
//   { say, w: { task… } }                         an exercise the stage judges (a grid to tap, a tree to fill, a dial to set,
//                                                 a round of statements or ranges), with `why` as the explanation on success
// Widgets (w.kind): formula (lines), rows ([label, text] pairs), grid (two dice: mark | given | tap), sim (totals, mean,
// streak, aces, outs, paths), tree (a natural-frequency tree to fill), dial (a slider with a curve: kelly, price, score,
// prior), chain (evidence tapped in, the odds updated), calib, range, rel (a reliability plot), pool, lab.
import * as M from "./odds-math.js";
import { PAST_JOBS, GUESSES } from "./odds-data.js";

const F = M.frac, T = M.fracText, N = M.num;
/** A number as a percentage, "34.97%". */
const pc = (x, d = 1) => `${(100 * x).toFixed(d)}%`;
const pf = (f, d = 1) => pc(N(f), d);
const money = (x, d = 2) => `${x < 0 ? "−" : ""}${Math.abs(x).toFixed(d)}`;

// A quiz step: the right option goes in a place that moves from step to step (so the answer is never "the first one"), the
// wrong ones in the order given. `value` is the figure the answer rests on, for the tests to recompute.
let turn = 0;
function quiz(say, right, wrong, why, extra = {}) {
  const at = turn++ % (wrong.length + 1), quizOpts = [...wrong];
  quizOpts.splice(at, 0, right);
  return { say, quiz: quizOpts, answer: at, why, ...extra };
}

// ---------- the figures the lessons use ----------
const SEVEN = M.probOf("sum7"), FOUR_FIRST = M.beforeSeven(4);
const TWO_ACES = { back: M.allGood(52, 4, 2, true), without: M.allGood(52, 4, 2, false) };
const OUTS = M.atLeastOne(47, 9, 2);
const CARGO = M.frequencies(10000, F(1, 100), F(9, 10), F(9, 100));
const LATE = { prior: F(1, 20), sens: F(4, 5), fpr: F(1, 10) };
const lateOdds = M.fromOdds(M.mul(M.toOdds(LATE.prior), M.likelihoodRatio(LATE.sens, LATE.fpr)));
const LATE_TWICE = M.update(M.update(LATE.prior, true, LATE.sens, LATE.fpr), true, LATE.sens, LATE.fpr);
const EIGHT = M.probOf("sum8");
const POOL = { stakes: [500, 300, 200], take: F(1, 10) };
const poolPays = M.poolPays(POOL.stakes, POOL.take);
const KELLY = { p: 0.6, b: 1 };
const FK = M.kelly(KELLY.p, KELLY.b), G1 = M.growth(FK, KELLY.p, KELLY.b), GH = M.growth(FK / 2, KELLY.p, KELLY.b);
const ZERO = M.ruinPoint(KELLY.p, KELLY.b);
const NOISY = M.growth(0.2, 0.55, 1);
const MEDIAN_JOB = M.quantile(PAST_JOBS, 0.5), P80_JOB = M.quantile(PAST_JOBS, 0.8);

/** The tree of lesson 6: each blank, in order, with the right figure and the plausible wrong ones. */
function cargoBlanks() {
  const c = CARGO, n = x => Number(M.num(x)).toLocaleString("en-GB", { maximumFractionDigits: 0 });
  const blank = (id, label, right, wrong) => ({ id, label, options: [right, ...wrong], answer: 0 });
  return [
    blank("have", "Off-spec cargoes of 10,000", n(c.have), ["10", "1,000", "9,900"]),
    blank("haveFlag", "Of those, flagged", n(c.haveFlag), ["9", "99", "900"]),
    blank("clearFlag", "Of the 9,900 good ones, flagged (a false alarm 9% of the time)", n(c.clearFlag), ["99", "891,000", "8,910"]),
    blank("share", "Of all flagged cargoes, the share off-spec", pf(c.posterior), ["90%", "50%", "10%"]),
  ];
}

export const COURSE = {
  title: "Odds and judgement",
  zh: "",
  chapters: [
    {
      id: "count", title: "Counting", lessons: [
        { id: "outcomes", title: "Outcomes", steps: [
          { say: "A probability is a share: of all the equally likely outcomes, the fraction that are the ones you want. Two dice make 36 equally likely pairs (6 × 6), one per cell here, the first die down the side and the second across the top.", w: { kind: "grid" } },
          { say: "Tap every pair that adds up to 7.", w: { kind: "grid", tap: "sum7" }, why: `${M.throwSet("sum7").length} of 36 pairs: 1+6, 2+5, 3+4 and their reverses. ${T(SEVEN)}.` },
          quiz("How many of the 36 pairs add up to 4?", String(M.waysTo(4)), ["2", "4", "6"], `${M.waysTo(4)}: 1+3, 2+2 and 3+1. A 4 comes up ${T(M.probOf("sum4"))} of the time, a 7 ${T(SEVEN)}: the 7 is twice as likely.`, { id: "ways4", value: M.waysTo(4), w: { kind: "grid", mark: "sum4" } }),
          { say: "Throw a pair 36,000 times. Each total should come up in proportion to its ways: the 7 about 6,000 times, the 2 and the 12 about 1,000. Run it and see how close the counts sit to the exact ones (the outlined bars).", w: { kind: "sim", sim: "totals" } },
          quiz("Throw until a 4 or a 7 shows; every other total is ignored. How often does the 4 come first?", T(FOUR_FIRST), ["1/2", "1/4", "3/36"], `Only 4s and 7s count: ${M.waysTo(4)} ways to the 4 against ${M.waysTo(7)} to the 7, so ${M.waysTo(4)} of every ${M.waysTo(4) + M.waysTo(7)} decisive throws. A fair price for the 4 is 2 to 1 against.`, { id: "four-first", value: N(FOUR_FIRST), w: { kind: "grid", mark: "sum4" } }),
        ] },
        { id: "independent", title: "Independence", steps: [
          { say: "Two events are independent when one happening does not change the chance of the other. Then the chance of both is the product: a 6 on each die is 1/6 × 1/6 = 1/36, one cell of the 36.", w: { kind: "grid", mark: "both6" } },
          quiz("What is the chance that neither die shows a 6?", T(M.mul(F(5, 6), F(5, 6))), ["10/36", "11/36", "5/6"], `Each die misses the 6 with chance 5/6, and the dice do not affect each other: 5/6 × 5/6 = ${T(M.mul(F(5, 6), F(5, 6)))}. The other 11 pairs have at least one 6, as the grid shows.`, { id: "neither6", value: N(M.mul(F(5, 6), F(5, 6))), w: { kind: "grid", mark: "any6" } }),
          { say: `Cards are not independent. Draw two from a pack of 52 and ask for two aces. If the first goes back, each draw is 4/52 and both come to 1/169. If it stays out, the second is 3/51: ${T(TWO_ACES.without)}. Deal both ways 200,000 times.`, w: { kind: "sim", sim: "aces" } },
          quiz("Why is two aces rarer when the first card is not put back?", "The first ace takes one ace out of the pack", ["The pack has fewer cards to choose from", "Aces are never drawn twice in a row", "The second draw is made less random"], "After one ace is out, 3 aces remain among 51 cards: 3/51 is less than 4/52. Drawing without putting back makes the draws dependent, and the chance of the second depends on the first.", {}),
          quiz("You hold two hearts and are dealt two more cards from the 47 unseen, of which 9 are hearts and you need one. What is the chance at least one is a heart?", pf(OUTS), ["19.1%", "18.0%", "45.0%"], `Count the pairs with no heart and subtract: 1 − C(38,2)/C(47,2) = 1 − 703/1,081 = ${T(OUTS)} = ${pf(OUTS, 2)}. The shortcut "9 outs × 4" says 36%: close enough for a quick check. One card alone is 9/47 = ${pf(F(9, 47))}.`, { id: "outs", value: N(OUTS), w: { kind: "sim", sim: "outs" } }),
        ] },
        { id: "conditional", title: "Conditional", steps: [
          { say: "P(A | B), read the probability of A given B, restricts the world to where B holds and asks how much of it is also A. Divide: P(A and B) ÷ P(B). Someone throws two dice and says only 'at least one is a 6'.", w: { kind: "formula", lines: ["P(A | B) =", { num: "P(A and B)", den: "P(B)" }, "= (1/36) ÷ (11/36) = 1/11"], note: "A: both are sixes. B: at least one is." } },
          { say: "Tap every pair that fits 'at least one is a 6'.", w: { kind: "grid", tap: "any6" }, why: "11 pairs: the six in the first position, the six in the second, and 6-6 counted once. Everything else is ruled out." },
          quiz("Given at least one 6, what is the chance both are sixes?", T(M.probOf("both6", "any6")), ["1/6", "1/36", "1/2"], "Of the 11 pairs that fit, only 6-6 has two sixes: 1/11. Not 1/6: the information 'one of them is a six' does not say which die.", { id: "both6-given-any6", value: N(M.probOf("both6", "any6")), w: { kind: "grid", given: "any6", mark: "both6" } }),
          quiz("Now you are told the first die is a 6. What is the chance both are?", T(M.probOf("both6", "first6")), ["1/11", "1/36", "1/2"], "The first die being a 6 leaves 6 pairs, and one is 6-6: 1/6. Saying which die is a different piece of information from saying only that one is, and it changes the answer.", { id: "both6-given-first6", value: N(M.probOf("both6", "first6")), w: { kind: "grid", given: "first6", mark: "both6" } }),
        ] },
      ],
    },
    {
      id: "value", title: "Expected value", lessons: [
        { id: "ev", title: "Expected value", steps: [
          { say: "The expected value (EV) of a play is its average result: each outcome's payoff times its probability, added up. A fair die pays 1 to 6; its EV is (1 + 2 + 3 + 4 + 5 + 6) ÷ 6 = 3.5, a value no single throw can show.", w: { kind: "rows", rows: M.DIE.map(([p, x]) => [`Face ${x}`, `${T(p)} × ${x} = ${T(M.mul(p, F(x)))}`]).concat([["EV", `${T(M.expected(M.DIE))} = ${N(M.expected(M.DIE))}`]]) } },
          { say: "A play pays the number the die shows, in pounds. The most you can pay and not lose on average is the EV. Set the price.", w: { kind: "dial", plot: "price", fair: 3.5, min: 0, max: 7, step: 0.05, start: 1, fmt: "pound", target: 3.5, tol: 0.1 }, why: "£3.50: above it you lose on average, below it you win. At exactly the EV the play is fair." },
          quiz("A play pays 6 if a die shows a six and costs 1 otherwise. Its EV per play?", `+${money(N(M.expected(M.oneFace(6, 1))))}`, ["0.00", "−0.17", "+1.00"], `(1/6 × 6) + (5/6 × −1) = 1 − 5/6 = ${T(M.expected(M.oneFace(6, 1)))}. Positive, but small beside what it moves around: one throw in six wins 6.`, { id: "ev-face", value: N(M.expected(M.oneFace(6, 1))) }),
          quiz("Bet A: win 1 or lose 1 on a coin. Bet B: win 99 with chance 1%, lose 1 otherwise. Both have EV 0. Which is riskier?", "B: the same average, a far wider spread", ["A: it loses half the time", "Neither: equal EV means equal risk", "A: B almost never loses"], "B loses 99 times in 100 and makes it up in one great win. EV says where the average sits; it says nothing of how far a single play can land from it. That is the variance.", {}),
        ] },
        { id: "spread", title: "Variance", steps: [
          { say: `Variance is the average squared distance from the EV; its square root is the standard deviation (SD), the typical size of a surprise. A die: variance ${T(M.variance(M.DIE))}, SD ${M.sd(M.DIE).toFixed(2)}. The coin bet has SD 1; the 1%-to-win-99 bet has SD ${M.sd([[F(1, 100), 99], [F(99, 100), -1]]).toFixed(2)}.`, w: { kind: "rows", rows: [["Coin, ±1", `SD ${M.sd([[F(1, 2), 1], [F(1, 2), -1]]).toFixed(2)}`], ["Die, 1 to 6", `SD ${M.sd(M.DIE).toFixed(2)}`], ["1% to win 99, else −1", `SD ${M.sd([[F(1, 100), 99], [F(99, 100), -1]]).toFixed(2)}`]] } },
          { say: "The law of large numbers: the average of many independent plays settles on the EV. Throw a die and watch the running average. The shaded cone is two standard errors, 2 × SD ÷ √n; the average stays inside it about 95 times in 100.", w: { kind: "sim", sim: "mean", bet: "die" } },
          quiz("After 100 throws of a die, how far is the average typically from 3.5? (One standard error: SD ÷ √n.)", `About ${M.standardError(M.sd(M.DIE), 100).toFixed(2)}`, ["About 0.017", "About 1.7", "About 0.5"], `${M.sd(M.DIE).toFixed(3)} ÷ √100 = ${M.standardError(M.sd(M.DIE), 100).toFixed(3)}. Ten times the throws only narrows it √10 = 3.16 times: certainty is expensive.`, { id: "se100", value: M.standardError(M.sd(M.DIE), 100) }),
          { say: "A coin has come up heads five times running. Is tails 'due'? Flip 400,000 coins, find every run of five heads, and count what came next.", w: { kind: "sim", sim: "streak" } },
          quiz("After five heads in a row, what is the chance the next flip is heads?", "1/2", ["Less than 1/2: tails is due", "More than 1/2: the coin is running hot", "It depends on how long the coin has been flipped"], "Exactly 1/2. The coin has no memory. The law of large numbers does not pay debts back; it dilutes them: the five heads are swamped by the flips to come, not cancelled by them.", {}),
        ] },
      ],
    },
    {
      id: "evidence", title: "Evidence", lessons: [
        { id: "baserate", title: "Base rates", steps: [
          { say: "A base rate is how common something is before any evidence. Evidence moves you from it; it does not replace it. Cargoes: 1 in 100 is off-spec. An inspection flags 90% of off-spec cargoes (its sensitivity) and also 9% of good ones (its false-alarm rate). One cargo is flagged.", w: { kind: "rows", rows: [["Off-spec", "1 in 100"], ["Flags an off-spec cargo", "90%"], ["Flags a good cargo", "9%"]] } },
          quiz("A cargo is flagged. What is the chance it is off-spec? Go with your gut.", "About 9%", ["About 90%", "About 50%", "About 1%"], `${pf(CARGO.posterior)}: the next step builds it. Most people say 90%, the test's sensitivity; the base rate drags it far lower.`, { id: "cargo-gut", value: N(CARGO.posterior), w: { kind: "rows", rows: [["Off-spec", "1 in 100"], ["Flags an off-spec cargo", "90%"], ["Flags a good cargo", "9%"]] } }),
          { say: "Count it instead. Take 10,000 cargoes and work down the tree, filling each gap.", w: { kind: "tree", pop: 10000, labels: ["Off-spec", "Good"], blanks: cargoBlanks(), have: N(CARGO.have), clear: N(CARGO.clear), haveFlag: N(CARGO.haveFlag), clearFlag: N(CARGO.clearFlag), haveOk: N(M.sub(CARGO.have, CARGO.haveFlag)), clearOk: N(M.sub(CARGO.clear, CARGO.clearFlag)) }, why: `${N(CARGO.haveFlag)} real flags among ${N(CARGO.flagged)}: ${pf(CARGO.posterior)}. The 9,900 good cargoes throw up ${N(CARGO.clearFlag)} false alarms, ten times the real ones.` },
          { say: "Natural frequencies, counts out of a round population, make Bayes' theorem a matter of counting. Most flags are false alarms because there are so many more good cargoes to raise them.", w: { kind: "formula", lines: ["Flagged and off-spec:  90", "Flagged and good:  891", "90 ÷ (90 + 891)  =  9.2%"] } },
        ] },
        { id: "fallacy", title: "Base-rate fallacy", steps: [
          { say: "Ignoring the base rate, reading 'the test is right 90% of the time' as 'a flag means 90% off-spec', is the base-rate fallacy. In court it is the prosecutor's fallacy: the chance of the evidence if innocent is not the chance of innocence given the evidence.", w: { kind: "formula", lines: ["P(flag | off-spec)  ≠  P(off-spec | flag)", "90%  vs  9.2%"] } },
          { say: "The same test, but the base rate changes. Slide it until a flag means a 50/50 chance of off-spec.", w: { kind: "dial", plot: "prior", sens: 0.9, fpr: 0.09, min: 0.001, max: 0.3, step: 0.001, start: 0.01, fmt: "pct", target: N(F(1, 11)), tol: 0.006 }, why: `At 1 in 11 (9.1%): prior odds 1:10 times the test's likelihood ratio of 10 make 1:1. Below that base rate a flag is more likely false than true; above, more likely true.` },
          quiz("A signal fires 95% of the time when an asset is mispriced and 5% of the time when it is not. Mispricing is rare: 2% of the time. The signal fires. How likely is the mispricing?", pf(M.posterior(F(1, 50), F(19, 20), F(1, 20)), 0), ["95%", "50%", "5%"], `0.95 × 0.02 = 0.019 true signals; 0.05 × 0.98 = 0.049 false ones. 0.019 ÷ 0.068 = ${pf(M.posterior(F(1, 50), F(19, 20), F(1, 20)))}. A 95% signal on a rare event is mostly noise.`, { id: "mispriced", value: N(M.posterior(F(1, 50), F(19, 20), F(1, 20))), w: { kind: "rows", rows: [["Mispriced", "2% of the time"], ["Signal if mispriced", "95%"], ["Signal if not", "5%"]] } }),
          quiz("Someone quotes a test's accuracy. Which number do you need before you can say what a positive result means?", "How common the thing is before the test", ["How many people were tested", "How old the test is", "Nothing: accuracy is enough"], "The base rate. A rare event with a good test still gives mostly false alarms; a common one with the same test gives mostly real ones. Always ask: out of how many, and how common to begin with?", {}),
        ] },
        { id: "bayes", title: "Bayes' theorem", steps: [
          { say: "Bayes' theorem is the tree in one line: the branch you are on, over all the branches that lead to the evidence. H is the hypothesis, E the evidence.", w: { kind: "formula", lines: ["P(H | E) =", { num: "P(E | H) P(H)", den: "P(E | H) P(H) + P(E | not H) P(not H)" }], note: "P(H) is the prior (the base rate); P(H | E) the posterior." } },
          quiz("One shipment in 20 runs late. A tracker alerts on 80% of late shipments and on 10% of the rest. It alerts. How likely is the shipment late?", pf(lateOdds, 0), ["80%", "50%", "10%"], `0.8 × 0.05 = 0.04; 0.1 × 0.95 = 0.095; 0.04 ÷ 0.135 = ${T(lateOdds)} = ${pf(lateOdds)}. The base rate of 5% holds it down.`, { id: "late", value: N(lateOdds), w: { kind: "rows", rows: [["Late", "1 shipment in 20"], ["Alert if late", "80%"], ["Alert if on time", "10%"]] } }),
          { say: "Odds make updating mechanical. The prior odds (late : not late) are 1 : 19. The alert's likelihood ratio is 0.8 ÷ 0.1 = 8: it is 8 times as likely on a late shipment. Posterior odds = prior odds × likelihood ratio = 8 : 19. Tap alerts and clears in any order and watch the odds.", w: { kind: "chain", prior: N(LATE.prior), sens: N(LATE.sens), fpr: N(LATE.fpr) } },
          quiz("Two independent alerts arrive in a row. How likely is the shipment late?", pf(LATE_TWICE, 0), ["59%", "94%", "16%"], `Odds 1:19 × 8 × 8 = 64:19, which is ${T(LATE_TWICE)} = ${pf(LATE_TWICE)}. Each independent piece of evidence multiplies the odds by its own ratio. Doubling the first answer (2 × ${pf(lateOdds, 0)}) is the common mistake.`, { id: "late-twice", value: N(LATE_TWICE), w: { kind: "rows", rows: [["Late", "1 shipment in 20"], ["Alert if late", "80%"], ["Alert if on time", "10%"], ["Alerts so far", "two, independent"]] } }),
        ] },
      ],
    },
    {
      id: "prices", title: "Odds and prices", lessons: [
        { id: "odds", title: "Odds and chances", steps: [
          { say: "The same belief, three ways. Probability p is a share. Odds against are (1 − p) : p, often written 'a to 1 against'. Decimal odds, 1 ÷ p, are the total returned per 1 staked at a fair price.", w: { kind: "rows", rows: [F(1, 2), F(1, 4), F(1, 6), F(1, 36)].map(p => [`p = ${T(p)}`, `${M.oddsAgainst(p)} to 1 against · decimal ${M.decimalOdds(p)}`]) } },
          quiz("A price of 3 to 1 against implies a probability of…", pf(M.impliedBy(3, 1), 0), ["33%", "75%", "3%"], "3 to 1 against means 3 losing outcomes for every winning one: 1 of 4 is a winner, 25%. In general a to b against is b ÷ (a + b).", { id: "three-to-one", value: 0.25, w: { kind: "rows", rows: [["Price", "3 to 1 against"]] } }),
          quiz("Throw two dice until a 4 or a 7 shows. The 4 comes first one time in three. What payout is fair on a bet that it does?", "2 to 1", ["3 to 1", "1 to 1", "1 to 2"], `One time in three wins and two lose: 2 to 1 against (decimal 3.0). A payout of exactly this is what 'paying true odds' means: it leaves the bettor with no expected gain or loss.`, { id: "fair-four", value: N(FOUR_FIRST), w: { kind: "grid", mark: "sum4" } }),
          { say: `A book quotes three outcomes at 45%, 35% and 25%. They sum to 105%: the extra 5% is the overround, the margin built into the prices. Scale each by 1 ÷ 1.05 to get the fair chances: ${M.overround([F(45, 100), F(35, 100), F(25, 100)]).fair.map(f => pf(f)).join(", ")}.`, w: { kind: "rows", rows: [["Quoted", "45%  35%  25%"], ["Sum (overround)", "105%"], ["Fair", M.overround([F(45, 100), F(35, 100), F(25, 100)]).fair.map(f => pf(f)).join("  ")]] } },
          quiz("You pay 500 for the chance to win a prize of 1,000 on top of your payment back. What chance of winning makes that break-even?", pf(F(500, 1500), 0), ["50%", "25%", "67%"], "A price C for a prize P breaks even at C ÷ (P + C) = 500 ÷ 1,500 = 33%. It is the price of the bet written as a probability: you need to be right more often than that. A 35% draw, like the nine hearts earlier, clears a 33% price; it would not clear 50%.", { id: "price-odds", value: 1 / 3, w: { kind: "rows", rows: [["You pay", "500"], ["Prize if right", "1,000, plus your 500 back"]] } }),
        ] },
        { id: "fair", title: "Fair prices", steps: [
          { say: "A fair price leaves both sides with zero expected profit. A contract that pays 1 if an event happens is worth exactly its probability p. A market maker quotes two prices: a bid, where they buy, and an ask, where they sell. The gap is the spread, the price of being able to trade at once.", w: { kind: "formula", lines: ["Fair value of a contract paying 1  =  p", "Buyer's EV  =  p − price", "Seller's EV  =  price − p"] } },
          { say: `A contract pays £1 if two dice total 8: ${T(EIGHT)} of the time. Slide the price (in pence) to where neither side has an edge.`, w: { kind: "dial", plot: "price", fair: N(EIGHT), min: 0, max: 0.5, step: 0.001, start: 0.3, fmt: "pence", target: N(EIGHT), tol: 0.006 }, why: `${(100 * N(EIGHT)).toFixed(1)}p: 5 of 36 pairs total 8. Higher and the buyer loses on average, lower and the seller does.` },
          quiz("The market on that contract is 12p bid, 16p ask. What is the EV of buying at 16p?", `${money(100 * N(M.buyerEV(EIGHT, F(16, 100))), 1)}p`, ["+2.1p", "0.0p", "−16.0p"], `${(100 * N(EIGHT)).toFixed(1)}p fair − 16p paid = ${money(100 * N(M.buyerEV(EIGHT, F(16, 100))), 1)}p. Selling to the market maker at the 12p bid would cost you ${money(100 * N(M.sub(F(12, 100), EIGHT)), 1)}p. The market maker earns the spread because they sit either side of the fair value.`, { id: "buy16", value: 100 * N(M.buyerEV(EIGHT, F(16, 100))), w: { kind: "rows", rows: [["Pays £1 if two dice total", "8 (5 pairs of 36)"], ["Market", "12p bid · 16p ask"]] } }),
          { say: "Estimating a number works the same way. A tight bid and ask around your estimate pay well if the truth lands inside, and cost you when it does not; a wide pair is safe and earns little. Choosing the width is choosing a probability, which is what the calibration lessons train.", w: { kind: "formula", lines: ["Bid: where the maker buys from you", "Ask: where the maker sells to you", "The width you quote is your confidence"] } },
        ] },
        { id: "edge", title: "House edge, pools", steps: [
          { say: "A bet's edge is its EV per unit staked. A bet paying a to 1 on an event of probability p has edge p(a + 1) − 1 to the bettor. For fair pay a = (1 − p) ÷ p. Pay less and the bettor carries a negative edge: the house edge.", w: { kind: "formula", lines: ["edge  =  p (a + 1) − 1", `die face, paid 5 to 1:  ${T(M.edgeOf(F(1, 6), 5))}`, `die face, paid 4 to 1:  ${T(M.edgeOf(F(1, 6), 4)).replace("-", "−")}`] } },
          quiz("A bet on one face of a die pays 4 to 1. What is the house edge, as a share of the stake?", pf(F(1, 6)), ["4.2%", "20.0%", "0.0%"], `Fair is 5 to 1. Paying 4: (1/6) × 5 − 1 = −1/6, so the bettor gives up ${pf(F(1, 6))} of each stake on average.`, { id: "edge-face", value: N(F(1, 6)) }),
          quiz("Which bet keeps most for the house? A: a die face at 4 to 1. B: a double 6 (probability 1/36) at 30 to 1. C: any double (probability 1/6) at 5 to 1.", `A: ${pf(F(1, 6))}`, [`B: ${pf(M.mul(F(-1), M.edgeOf(F(1, 36), 30)))}`, "C: 0.0%"].concat([]), `A: ${pf(F(1, 6))}. B: 31/36 − 1 = −5/36, ${pf(F(5, 36))}. C: 6/6 − 1 = 0, a fair bet. A long shot is not automatically a worse bet; the price against the true chance is what counts.`, { id: "edge-compare", value: N(F(1, 6)), w: { kind: "rows", rows: [["A: a die face", "chance 1/6 · pays 4 to 1"], ["B: a double 6", "chance 1/36 · pays 30 to 1"], ["C: any double", "chance 1/6 · pays 5 to 1"]] } }),
          { say: "Play the 4-to-1 bet again and again. The average result does not hover at zero; it settles on −0.167, minus one sixth of a unit per play. But the first hundred plays can still land above zero: the edge is small beside the spread.", w: { kind: "sim", sim: "mean", bet: "face" } },
          { say: `A pool shares what is staked: the operator keeps a take (here 10%) and the rest goes to those who backed the winner. Pools of 500, 300 and 200 hold 1,000; 900 is shared. Payout per 1 staked if a runner wins: ${poolPays.map(T).join(", ")}.`, w: { kind: "pool", stakes: POOL.stakes, take: N(POOL.take), pays: poolPays.map(N) } },
          quiz("In that pool, runner 3 holds 20% of the money. Backing it pays off in expectation only if you think it wins more often than…", pf(M.div(F(20, 100), M.sub(F(1), POOL.take))), ["20.0%", "10.0%", "30.0%"], `Its payout is 900 ÷ 200 = 4.5, so you need p × 4.5 > 1: p > 2/9 = ${pf(F(2, 9))}. The crowd's 20% share has to be marked up by the take, 20% ÷ 0.9. With p = 30% your edge would be ${T(M.poolEV(F(3, 10), poolPays[2]))} per unit.`, { id: "pool-break", value: 2 / 9 }),
        ] },
      ],
    },
    {
      id: "sizing", title: "How much to bet", lessons: [
        { id: "kelly", title: "Kelly sizing", steps: [
          { say: "Edge says whether to bet; sizing says how much. Bet a fixed fraction f of your bankroll each time. Too little wastes the edge; too much lets the swings eat you. The fraction that grows the bankroll fastest in the long run is Kelly's: for a bet paying b to 1 with win probability p, q = 1 − p.", w: { kind: "formula", lines: ["f* = (b p − q) ÷ b", "growth per bet = p ln(1 + b f) + q ln(1 − f)"], note: "ln is the natural log: growth in the log of wealth is growth in its compounding rate." } },
          { say: `Even money (b = 1), 60% to win. Slide your stake until the growth per bet is as high as it will go.`, w: { kind: "dial", plot: "kelly", p: KELLY.p, b: KELLY.b, min: 0, max: 1, step: 0.01, start: 0.05, fmt: "pct", target: FK, tol: 0.02 }, why: `${pc(FK, 0)}: (1 × 0.6 − 0.4) ÷ 1 = 0.2. The curve peaks there at ${pc(G1, 2)} a bet, doubling the bankroll in about ${Math.round(Math.LN2 / G1)} bets.` },
          quiz("Even money, 55% to win. What is Kelly's stake?", pc(M.kelly(0.55, 1), 0), ["5%", "15%", "55%"], "With b = 1, f* = p − q = 2p − 1 = 10%. A thin edge means a small stake, however sure you feel.", { id: "kelly55", value: M.kelly(0.55, 1), w: { kind: "rows", rows: [["Chance of winning", "55%"], ["Pays", "even money (1 to 1)"]] } }),
          quiz("A bet pays 2 to 1 and wins 40% of the time. What is Kelly's stake?", pc(M.kelly(0.4, 2), 0), ["0%", "20%", "40%"], `(2 × 0.4 − 0.6) ÷ 2 = 0.2 ÷ 2 = 10%. The EV is positive (0.4 × 2 − 0.6 = +0.2), and a longer price means a smaller stake for the same edge.`, { id: "kelly-2to1", value: M.kelly(0.4, 2), w: { kind: "rows", rows: [["Chance of winning", "40%"], ["Pays", "2 to 1"], ["EV per unit staked", "+0.20"]] } }),
          quiz("Even money, 45% to win. What does Kelly say?", "Bet nothing", ["Bet 5%", "Bet the other side's 10%", "Bet 45%"], "(0.45 − 0.55) is negative: no stake grows the bankroll. Kelly never stakes on a negative edge; it is silent until the edge is yours.", { id: "kelly45", value: M.kelly(0.45, 1), w: { kind: "rows", rows: [["Chance of winning", "45%"], ["Pays", "even money (1 to 1)"]] } }),
        ] },
        { id: "half", title: "Half Kelly", steps: [
          { say: "Kelly's growth is the best on average, but not the smoothest ride. Here are 25 of 400 possible 100-bet runs at 60% even money, on a log scale. Choose a stake and run again: watch how far the runs spread and how often they fall to half.", w: { kind: "sim", sim: "paths", p: KELLY.p, b: KELLY.b, bets: 100 } },
          quiz("At half of Kelly's stake, what share of Kelly's long-run growth rate do you keep?", pc(GH / G1, 0), ["50%", "90%", "25%"], `${pc(GH, 2)} against ${pc(G1, 2)} a bet: ${pc(GH / G1, 1)}. Near the top the curve is flat: giving up half the stake costs a quarter of the growth and takes out far more of the risk.`, { id: "half-kelly", value: GH / G1 }),
          quiz("And at twice Kelly's stake (40%)?", "About zero or below: all the risk, none of the growth", ["Twice Kelly's growth", "Three quarters of it", "The same as Kelly's"], `Growth at 40% is ${pc(M.growth(0.4, 0.6, 1), 2)} a bet. The curve is a hill: every stake on its far side has a twin on the near side with the same growth and far less risk. Past the zero (at ${pc(ZERO, 0)} here) wealth shrinks even though every bet is favourable.`, { id: "double-kelly", value: M.growth(0.4, 0.6, 1) }),
          { say: "So practitioners bet a fraction of Kelly, half or less. Kelly is the ceiling when you know the odds exactly. You never do.", w: { kind: "formula", lines: [`Growth at f*/2 = ${pc(GH / G1, 0)} of the best`, `Growth is zero at about 2 f* (${pc(ZERO, 0)} here)`, "A fraction of Kelly is the working rule"] } },
        ] },
        { id: "ruin", title: "Overbetting", steps: [
          { say: "Find the edge of the ruin zone: slide the stake to where growth drops to zero and then below. Past it, a bet with a real edge still shrinks the bankroll, by compounding: a 50% loss needs a 100% gain to repair.", w: { kind: "dial", plot: "kelly", p: KELLY.p, b: KELLY.b, min: 0, max: 1, step: 0.01, start: 0.2, fmt: "pct", target: ZERO, tol: 0.03, ruin: true }, why: `${pc(ZERO, 1)}. About twice Kelly's: when the edge is small the zero point sits at 2 f*. Beyond it you are paying for variance and getting nothing back.` },
          { say: "The danger is that you never know p exactly. Suppose you think the chance is 60% and stake Kelly's 20%. The truth is 55%. Drag to see growth at a 20% stake as the real chance moves.", w: { kind: "dial", plot: "wrongp", b: 1, f: 0.2, min: 0.4, max: 0.7, step: 0.005, start: 0.6, fmt: "pct" } },
          quiz("You stake 20% at even money believing 60%; the truth is 55%. Long-run growth per bet is…", pc(NOISY, 2).replace("-", "−"), ["+2.0%", "+1.0%", "−5.0%"], `About zero: full Kelly on an estimate 5 points too high is exactly twice true Kelly (10%), the zero of the curve. The estimate's error cost you the entire edge. This is why you bet a fraction of Kelly: it protects against p being lower than you think.`, { id: "wrong-p", value: NOISY, w: { kind: "dial", plot: "wrongp", b: 1, f: 0.2, min: 0.4, max: 0.7, step: 0.005, start: 0.55, fmt: "pct" } }),
          quiz("Which habit survives mistakes in your own probabilities best?", "Stake half of Kelly or less", ["Stake full Kelly on your best estimate", "Stake the biggest you can afford", "Raise the stake after a loss"], "A fraction of Kelly stays on the profitable side of the hill even when p is overrated, and gives up only a quarter of the growth if p was right. Raising the stake after a loss does the opposite of the maths.", {}),
        ] },
      ],
    },
    {
      id: "calibration", title: "Calibration", lessons: [
        { id: "calib", title: "Calibration", steps: [
          { say: "You are calibrated when what you call 70% happens about 70% of the time. Of all the statements you rate 90% sure, nine in ten should be true. Rate ten statements: choose true or false, then how sure you are, from 50% (a coin flip) to 99% (almost certain). Your answers are kept and add to your record.", w: { kind: "formula", lines: ["50%  a guess", "70%  probably", "90%  confident", "99%  I'd be shocked"], note: "Be honest, not clever: the record is for you." } },
          { say: "Ten statements.", w: { kind: "calib", n: 10 }, why: "Your record is drawn: each dot is a confidence level, how often you were right at it. On the diagonal is calibrated; below it, overconfident." },
          { say: "A typical first plot: this forecaster's 60s come true 55% of the time, their 90s only 70%.", w: { kind: "rel", points: [{ c: 60, rate: 0.55, n: 40 }, { c: 70, rate: 0.6, n: 38 }, { c: 80, rate: 0.66, n: 35 }, { c: 90, rate: 0.7, n: 30 }, { c: 99, rate: 0.86, n: 22 }] } },
          quiz("Points below the diagonal mean…", "You were right less often than you claimed: overconfident", ["You were right more often than you claimed: underconfident", "You are unlucky", "You rated everything 50%"], "Stated confidence is across, how often you were right is up: below the line means you claimed more than you delivered. Overconfidence is the usual finding, mostly at the high end. Underconfidence, above the line, is rarer and cheaper.", {}),
        ] },
        { id: "scoring", title: "Scoring honesty", steps: [
          { say: "Score a forecast so that honesty pays. The Brier score of a probability q for an event is (q − outcome)², outcome 1 if it happened, 0 if not. Lower is better. Saying 50% to everything scores 0.25; a confident miss scores near 1.", w: { kind: "formula", lines: ["Brier = (q − outcome)²", `80%, it happened:  ${M.brierOne(0.8, true).toFixed(2)}`, `90%, it did not:  ${M.brierOne(0.9, false).toFixed(2)}`, `50%, either way:  ${M.brierOne(0.5, true).toFixed(2)}`] } },
          quiz("You said 90%, and the event did not happen. What is that forecast's Brier score?", M.brierOne(0.9, false).toFixed(2), ["0.01", "0.10", "0.90"], "(0.9 − 0)² = 0.81. Squaring makes confident misses expensive: saying 99% and being wrong costs 0.98.", { id: "brier90", value: M.brierOne(0.9, false) }),
          { say: "A scoring rule is proper when your best expected score comes from reporting your true belief. Brier is proper. The true chance of rain is 70%; slide the probability you report and watch your expected score. Find the lowest point.", w: { kind: "dial", plot: "score", p: 0.7, min: 0, max: 1, step: 0.01, start: 0.4, fmt: "pct", target: 0.7, tol: 0.02 }, why: `At q = 0.70 the expected Brier is ${M.expectedBrier(0.7, 0.7).toFixed(2)}, the lowest on the curve. Shade up or down and the expected score only gets worse, so there's nothing to gain by lying, exaggerating or hedging.` },
          quiz("Why does a proper scoring rule matter?", "Reporting anything but your real belief makes your expected score worse", ["It rewards boldness", "It lets you hedge safely", "It makes the score easier to read"], "Without it, a forecaster could game the score by saying more extreme or more modest things than they believe. With it, the score and the truth point the same way.", {}),
        ] },
      ],
    },
    {
      id: "judgement", title: "Judgement", lessons: [
        { id: "ranges", title: "Ranges", steps: [
          { say: "A 90% range is a pair of numbers you expect to hold the truth nine times in ten. People set them far too narrow, and catch the truth about half the time. Bracket six quantities. Slide each end; then lock it in.", w: { kind: "formula", lines: ["A 90% range holds the truth", "9 times in 10", "→ if you hit 6 of 6 you may be too wide", "→ if you hit 3 of 6, too narrow"], note: "Your hits are kept." } },
          { say: "Six ranges.", w: { kind: "range", n: 6 }, why: "Your hit rate is shown against the 90% you aimed for." },
          quiz("You hit 3 of your 6 ranges. What do you do next time?", "Widen them: they were too narrow", ["Narrow them: you're too cautious", "Keep them: three is fine", "Stop using ranges"], "You aimed at 90% and got 50%. The truth is further out than you think. A useful trick: start from a very wide range and shrink each end until you'd be surprised to see the truth beyond it, rather than building outwards from your best guess.", {}),
        ] },
        { id: "plans", title: "Plans, anchors", steps: [
          { say: `The planning fallacy: estimating a job from its details alone, and finishing late. The cure is a reference class, how long similar jobs actually took. Your plan says 10 days. Ten similar jobs took (days): ${PAST_JOBS.join(", ")}.`, w: { kind: "rows", rows: [["Your plan", "10 days"], ["Ten similar jobs", PAST_JOBS.join(" ")], ["Done in 10 days or less", `${PAST_JOBS.filter(d => d <= 10).length} of 10`]] } },
          quiz("What is the median of the ten past jobs?", `${MEDIAN_JOB} days`, ["10 days", "18 days", "21 days"], `Sort them: ${[...PAST_JOBS].sort((a, b) => a - b).join(", ")}. The middle two are 14 and 16: ${MEDIAN_JOB}. Only one job in ten took your planned 10 days or less.`, { id: "median-job", value: MEDIAN_JOB, w: { kind: "rows", rows: [["Ten similar jobs (days)", PAST_JOBS.join(" ")]] } }),
          quiz("A deadline you would meet 8 times in 10 is the 80th percentile of the class. Roughly?", `${Math.round(P80_JOB)} days`, ["15 days", "18 days", "30 days"], `Eight tenths of the way up the sorted list falls between the 8th (21) and 9th (25): ${P80_JOB.toFixed(1)}. Promise that, plan on the median, and expect to be late about half the time at the median.`, { id: "p80-job", value: P80_JOB, w: { kind: "rows", rows: [["Ten similar jobs (days)", PAST_JOBS.join(" ")]] } }),
          quiz(`Five people independently guess a weight whose truth is ${GUESSES.truth} kg: ${GUESSES.guesses.join(", ")}. How far off is their average?`, `${Math.abs(M.mean(GUESSES.guesses) - GUESSES.truth)} kg`, ["30 kg", "10 kg", "0 kg"], `The average is ${M.mean(GUESSES.guesses)}, 2 kg off, while the typical single guess is out by ${M.mean(GUESSES.guesses.map(g => Math.abs(g - GUESSES.truth)))} kg: the errors on both sides cancel. It works only if the guesses are independent.`, { id: "crowd", value: Math.abs(M.mean(GUESSES.guesses) - GUESSES.truth), w: { kind: "rows", rows: [["The truth", `${GUESSES.truth} kg`], ["Five guesses", GUESSES.guesses.join(", ")]] } }),
          quiz("Anchoring is the pull of a number you have just seen (a price tag, last year's figure) on an estimate. What helps most?", "Make your own estimate before you see the number", ["Look at the number longer", "Average your guess with it", "Ignore it by trying harder"], "Trying harder to ignore it does not work: it still pulls. Decide first, then compare. Several independent estimates, made before they are shared, protect a group the same way.", {}),
        ] },
        { id: "lab", title: "Lab: Quote, Punt", steps: [
          { say: "Two games in this app are this course in play. Quote asks you to make a market on a number you don't know: a bid and an ask. Its width is your confidence, and whether the truth fell inside is your calibration. Punt makes you stake a share of a pot on an answer; every bet pays 2×, even money.", w: { kind: "rows", rows: [["Quote", "a bid and ask: a range you stand behind"], ["Punt", "a stake on an answer, even money"], ["The Ledger", "your record of both"]] } },
          { say: "What your own play shows so far: the share of your Quote markets that held the truth, and in Punt how the chance your stakes implied compares with how often you won.", w: { kind: "lab" } },
          quiz("Punt pays 2× on every bet: even money. You are 75% sure of an answer. What stake does Kelly suggest?", pc(M.kelly(0.75, 1), 0), ["25%", "75%", "100%"], "f* = 2p − 1 = 50% of the pot. Half of that, 25%, is the safer habit, and it is also what keeps a run alive past the first question you were sure of and wrong.", { id: "punt-kelly", value: M.kelly(0.75, 1), w: { kind: "rows", rows: [["Chance you are right", "75%"], ["Pays", "2× the stake (even money)"]] } }),
          { say: "Go and practise. In Quote, set the width so you'd expect to be inside nine times in ten, then compare. In Punt, size your stake by how sure you are, not how much you want it, and watch the reliability plot grow in the Ledger.", w: { kind: "lab", links: true } },
        ] },
      ],
    },
  ],
};
