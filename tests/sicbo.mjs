// Sic Bo's rules (sicbo-engine.js), checked against Macau's Despacho 57/2004: the 216 ways three dice fall and the totals'
// ways (no total of 3 or 18 but as a triple), every bet the layout carries and the rules' others, what each pays, a
// triple taking Big and Small and nothing else, the house's edge on every bet worked out by hand (each its own, from
// 2.78% to 47.22%), which bets may go down, a round (from its seed, settled, kept) and 21,600 of them landing as three
// fair dice do, and what the screen over the table counts.
import { START, UNIT, LIMITS, OUTCOMES, TOTAL_PAYS, RANGE, LAYOUT, EXTRAS, TOTALS, PAIRS, valid, kindOf, onLayout, multiple, payout, settle, edgeOf, waysOf,
  nameOf, paysText, paysShort, maxOf, betsProblem, newGame, roll, stats, totalOf, isTriple, sizeOf } from "../sicbo-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b) => Math.abs(a - b) < 1e-12;

// ---------- the dice ----------
{
  check(OUTCOMES.length === 216 && new Set(OUTCOMES.map(String)).size === 216 && OUTCOMES.every(d => d.length === 3 && d.every(x => x >= 1 && x <= 6)), "three dice fall 216 ways, each once");
  const ways = Array(19).fill(0);
  for (const d of OUTCOMES) ways[totalOf(d)]++;
  check(ways.slice(3).join() === "1,3,6,10,15,21,25,27,27,25,21,15,10,6,3,1", "the totals' ways, 3 to 18: 1 3 6 10 15 21 25 27 27 25 21 15 10 6 3 1");
  check(OUTCOMES.filter(d => [3, 18].includes(totalOf(d))).every(isTriple) && OUTCOMES.filter(isTriple).length === 6, "the only 3 and 18 are the triples 1-1-1 and 6-6-6, which is why totals run 4 to 17");
  check(OUTCOMES.filter(d => sizeOf(d) === "small").length === 105 && OUTCOMES.filter(d => sizeOf(d) === "big").length === 105 && OUTCOMES.filter(d => sizeOf(d) === "triple").length === 6,
    "105 throws are Small, 105 Big and 6 are triples that are neither");
  check(OUTCOMES.filter(d => totalOf(d) % 2).length === 108, "an odd total is 108 of 216: as written (Article 7 takes only Big and Small on a triple) 單 and 雙 would be a fair bet");
}

// ---------- the bets ----------
{
  check(LAYOUT.length === 50 && new Set(LAYOUT).size === 50 && LAYOUT.every(onLayout), "the layout carries 50 bets, each once");
  const count = kind => LAYOUT.filter(k => kindOf(k) === kind).length;
  check(count("small") === 1 && count("big") === 1 && count("any") === 1 && count("s") === 6 && count("t") === 6 && count("d") === 6 && count("n") === 14 && count("c") === 15,
    "Small, Big, Any triple, six singles, six triples, six doubles, fourteen totals, fifteen pairs");
  check(EXTRAS.length === 65 && EXTRAS.every(k => valid(k) && !onLayout(k)) && EXTRAS.filter(k => kindOf(k) === "ds").length === 30 && EXTRAS.filter(k => kindOf(k) === "h").length === 20 && EXTRAS.filter(k => kindOf(k) === "q").length === 15,
    "the rules' others (a double with a single 30, three numbers 20, four numbers 15) are bets, not on the layout");
  check(!["n3", "n18", "n2", "c11", "c21", "c07", "ds11", "ds17", "t7", "s0", "d7", "h112", "h321", "q1123", "small ", "odd", ""].some(valid), "no total of 3 or 18, no pair of one number or the wrong way round, no seventh face");
  check(nameOf("small") === "Small" && nameOf("any") === "Any triple" && nameOf("n11") === "Total 11" && nameOf("t4") === "Triple 4" && nameOf("d6") === "Double 6" && nameOf("c25") === "2 and 5" && nameOf("s3") === "Single 3",
    "bets named as the table says them");
  check(TOTALS.join() === "n4,n5,n6,n7,n8,n9,n10,n11,n12,n13,n14,n15,n16,n17" && PAIRS.length === 15 && PAIRS[0] === "c12" && PAIRS[14] === "c56", "the totals 4 to 17 and the pairs 12 to 56 in order");
}

// ---------- what bets pay (Article 6) ----------
{
  const P = (key, d) => multiple(key, d);
  check(P("small", [1, 2, 3]) === 1 && P("big", [6, 5, 4]) === 1 && P("small", [6, 5, 4]) === -1 && P("big", [1, 2, 3]) === -1 && P("small", [3, 3, 4]) === 1 && P("big", [4, 4, 3]) === 1, "Big and Small pay 1 to 1: Small 4–10, Big 11–17");
  check(P("s4", [4, 1, 2]) === 1 && P("s4", [4, 4, 2]) === 2 && P("s4", [4, 4, 4]) === 3 && P("s4", [1, 2, 3]) === -1, "a single number pays 1, 2 or 3 to 1 for one, two or three dice showing it");
  check(P("t4", [4, 4, 4]) === 150 && P("t4", [5, 5, 5]) === -1 && P("t4", [4, 4, 3]) === -1 && P("any", [2, 2, 2]) === 24 && P("any", [2, 2, 3]) === -1, "a named triple pays 150 to 1, any triple 24 to 1");
  check(P("d4", [4, 4, 1]) === 8 && P("d4", [4, 4, 4]) === 8 && P("d4", [4, 1, 2]) === -1 && P("d4", [3, 3, 1]) === -1, "a double pays 8 to 1 (a triple of it too)");
  check(P("c25", [2, 5, 6]) === 5 && P("c25", [2, 2, 5]) === 5 && P("c25", [5, 2, 2]) === 5 && P("c25", [2, 2, 2]) === -1 && P("c25", [5, 3, 3]) === -1, "two numbers pay 5 to 1 when both show among the dice");
  const T = { 4: 50, 5: 18, 6: 14, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 14, 16: 18, 17: 50 };
  check(Object.entries(T).every(([t, p]) => TOTAL_PAYS[t] === p) && Object.keys(TOTAL_PAYS).length === 14, "totals 4 and 17 pay 50, 5 and 16 pay 18, 6 and 15 pay 14, 7 and 14 pay 12, 8 and 13 pay 8, 9 to 12 pay 6");
  check(P("n12", [4, 4, 4]) === 6 && P("n6", [2, 2, 2]) === 14 && P("n12", [3, 4, 5]) === 6 && P("n11", [3, 4, 5]) === -1 && P("n17", [6, 6, 5]) === 50, "a total wins on a triple too: 4-4-4 is a 12");
  check(P("ds42", [4, 4, 2]) === 50 && P("ds42", [2, 4, 4]) === 50 && P("ds42", [4, 4, 4]) === -1 && P("ds42", [4, 2, 2]) === -1, "a double with a single pays 50 to 1");
  check(P("h245", [5, 2, 4]) === 30 && P("h245", [2, 4, 4]) === -1 && P("h245", [2, 4, 6]) === -1, "three numbers pay 30 to 1 when the dice are those three");
  check(P("q2345", [2, 3, 5]) === 7 && P("q2345", [4, 4, 3]) === -1 && P("q2345", [2, 3, 6]) === -1 && P("q2345", [5, 4, 2]) === 7, "four numbers pay 7 to 1 when the dice are three different of them");
  check(paysText("t3") === "150 to 1" && paysText("n5") === "18 to 1" && paysText("s1").startsWith("1 to 1 for one") && paysShort("small") === "1:1" && paysShort("s2") === "1·2·3" && paysShort("n17") === "50" && paysShort("c25") === "5",
    "what each bet pays, in words and short");
  check(payout("t4", 100, [4, 4, 4]) === 15000 && payout("small", 500, [6, 6, 6]) === -500 && payout("s4", 200, [4, 4, 1]) === 400, "a stake wins its multiple, or is lost");
}

// ---------- a triple takes Big and Small, and nothing else ----------
{
  const triples = OUTCOMES.filter(isTriple);
  check(triples.every(d => multiple("small", d) === -1 && multiple("big", d) === -1), "every triple takes both Big and Small (Article 7)");
  check(triples.every(d => multiple("any", d) === 24 && multiple(`t${d[0]}`, d) === 150 && multiple(`s${d[0]}`, d) === 3 && multiple(`d${d[0]}`, d) === 8), "and pays any triple, its own triple, its single at 3 to 1 and its double");
  const s = settle({ small: 500, any: 100, t2: 100, n6: 100, s2: 100 }, [2, 2, 2]);
  check(s.net === -500 + 2400 + 15000 + 1400 + 300 && s.back === 2500 + 15100 + 1500 + 400, "everything on the layout settled together on 2-2-2");
}

// ---------- what the house keeps: each bet its own ----------
{
  const exp = { small: 6, big: 6, any: 66, 4: 63, 5: 102, 6: 66, 7: 21, 8: 27, 9: 41, 10: 27, 11: 27, 12: 41, 13: 27, 14: 21, 15: 66, 16: 102, 17: 63 };
  check(near(edgeOf("small"), 6 / 216) && near(edgeOf("big"), 6 / 216), "Big and Small keep the house 6 in 216: 2.78%");
  check(LAYOUT.filter(k => kindOf(k) === "s").every(k => near(edgeOf(k), 17 / 216)), "a single number keeps 17 in 216: 7.87%");
  check(LAYOUT.filter(k => kindOf(k) === "t").every(k => near(edgeOf(k), 65 / 216)) && near(edgeOf("any"), exp.any / 216), "a named triple keeps 30.09%, any triple 30.56%");
  check(LAYOUT.filter(k => kindOf(k) === "d").every(k => near(edgeOf(k), 72 / 216)) && PAIRS.every(k => near(edgeOf(k), 36 / 216)), "a double keeps 33.33%, two numbers 16.67%");
  check(TOTALS.every(k => near(edgeOf(k), exp[Number(k.slice(1))] / 216)), "each total its own: 7 and 14 keep 9.72%, 8, 10, 11 and 13 12.50%, 9 and 12 18.98%, 4 and 17 29.17%, 6 and 15 30.56%, 5 and 16 47.22%");
  check(EXTRAS.filter(k => kindOf(k) === "ds").every(k => near(edgeOf(k), 63 / 216)) && EXTRAS.filter(k => kindOf(k) === "h").every(k => near(edgeOf(k), 30 / 216)) && EXTRAS.filter(k => kindOf(k) === "q").every(k => near(edgeOf(k), 24 / 216)),
    "the rules' others: a double with a single 29.17%, three numbers 13.89%, four numbers 11.11%");
  const sorted = [...LAYOUT].sort((a, b) => edgeOf(a) - edgeOf(b));
  check(["small", "big"].includes(sorted[0]) && ["n5", "n16"].includes(sorted.at(-1)) && sorted.every(k => edgeOf(k) > 0), "Big and Small keep least on the layout, 5 and 16 most, and no bet gives the house less than 2.78%");
  // Article 6 gives 5 or 16 anything from 18 to 30 and 6 or 15 from 14 to 18: at the top of those ranges the bets keep far less
  const at = (t, pay) => 1 - waysOf(`n${t}`) * (pay + 1) / 216;
  check(RANGE[5].join() === "18,30" && RANGE[6].join() === "14,18" && near(at(5, 18), edgeOf("n5")) && near(at(6, 14), edgeOf("n6")) && near(at(5, 30), 30 / 216) && near(at(6, 18), 26 / 216),
    "the rules' ranges: 5 or 16 at 30 to 1 would keep 13.89%, 6 or 15 at 18 to 1 12.04%; the table pays the least of each (47.22%, 30.56%)");
  check(waysOf("small") === 105 && waysOf("any") === 6 && waysOf("n10") === 27 && waysOf("c25") === 30 && waysOf("d4") === 16 && waysOf("s4") === 91 && waysOf("q2345") === 24, "ways to win: Small 105, any triple 6, a 10 27, two numbers 30, a double 16, a single 91, four numbers 24");
}

// ---------- which bets may go down ----------
{
  check(betsProblem({}, START) && betsProblem({ small: 50 }, START) && betsProblem({ small: 120 }, START) && betsProblem({ t3: LIMITS.triple + UNIT }, START * 10) && betsProblem({ small: LIMITS.even + UNIT }, START * 10)
    && betsProblem({ "n3": 100 }, START) && betsProblem({ small: 15000, big: 10000 }, 20000), `at least HK$${LIMITS.min} a bet, in HK$${UNIT}s, up to each kind's most, on bets that exist, within what you hold`);
  check(!betsProblem({ small: 100 }, START) && !betsProblem({ t3: LIMITS.triple, any: LIMITS.any, s1: 500, n11: 5000, c25: 100, d4: 100 }, START * 10) && !betsProblem({ ds42: 100, h245: 100, q2345: 100 }, START), "good bets go down, the rules' others included");
  check(maxOf("small") === 100000 && maxOf("t3") === 2000 && maxOf("any") === 5000 && maxOf("s1") === 50000 && maxOf("c25") === 20000 && maxOf("d2") === 10000 && maxOf("n9") === 10000, "each kind's limit");
}

// ---------- a round ----------
{
  const g = { ...newGame(7), bets: { small: 500, t3: 100 } }, r = roll(g), again = roll(g);
  check(JSON.stringify(r.dice) === JSON.stringify(again.dice) && JSON.stringify(r.state) === JSON.stringify(again.state), "the same game throws the same dice");
  check(r.state.balance === g.balance + r.settled.net && JSON.stringify(r.state.history.at(-1)) === JSON.stringify(r.dice) && JSON.stringify(r.state.lastBets) === JSON.stringify(g.bets) && !Object.keys(r.state.bets).length && r.state.rounds === 1,
    "a round settles the bets into the bankroll, adds its dice, and clears the layout for Rebet");
  let threw = "";
  try { roll(newGame(1)); } catch (e) { threw = e.message; }
  check(threw === "No bets on the layout", "no bets, no round");
  let s = newGame(11);
  const faces = Array(7).fill(0), totals = Array(19).fill(0), N = 21600;
  for (let k = 0; k < N; k++) {
    const res = roll({ ...s, bets: { small: 100 } });
    res.dice.forEach(x => faces[x]++);
    totals[totalOf(res.dice)]++;
    s = { ...res.state, balance: START };
  }
  const chiF = faces.slice(1).reduce((a, n) => a + (n - N / 2) ** 2 / (N / 2), 0);
  const ways = [0, 0, 0, 1, 3, 6, 10, 15, 21, 25, 27, 27, 25, 21, 15, 10, 6, 3, 1];
  const chiT = totals.slice(3).reduce((a, n, i) => a + (n - N * ways[i + 3] / 216) ** 2 / (N * ways[i + 3] / 216), 0);
  check(chiF < 20.5 && chiT < 37.7, `${N} rounds: every face as likely (chi-square ${chiF.toFixed(1)} on 5 degrees of freedom) and the totals as the dice make them (${chiT.toFixed(1)} on 15)`);
}

// ---------- the screen ----------
{
  const h = [[1, 1, 1], [6, 5, 4], [2, 3, 1], [6, 6, 6], [4, 4, 5], [3, 2, 2], [6, 5, 5]];
  const st = stats(h, 100);
  check(st.rounds === 7 && st.big === 3 && st.small === 2 && st.triple === 2 && st.big + st.small + st.triple === 7, "the counts: Big, Small and triples (a triple in neither of the others)");
  check(st.counts[3] === 1 && st.counts[15] === 1 && st.counts[16] === 1 && st.counts[18] === 1 && st.counts[13] === 1 && st.counts[7] === 1 && st.counts[6] === 1, "how often each total came");
  check(JSON.stringify(st.last[0]) === JSON.stringify([6, 5, 5]) && st.last.length === 7 && st.hot.every(t => st.counts[t] > 0) && st.cold.every(t => st.counts[t] === 0), "the last rounds newest first, the hottest totals seen, the coldest never");
  const w = stats(h, 3);
  check(w.rounds === 3 && w.last.length === 3, "a window of the last few");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("sicbo: the dice, the bets and what they pay, triples, every bet's edge, limits, rounds, the screen");
