// Craps' rules (craps-engine.js), checked against Macau's Despacho 53/2010: the dice and what each total's ways are, every
// bet the rules list and what each pays, the pass and don't pass lines on the come-out roll and after a point (bar 12),
// the come bets that travel to their number, the additional bets (fair: no house edge), the one-roll bets, the hard ways
// and the Big bets, the house's edge on every bet worked out exactly and again by playing each bet out through the
// rules, stakes that always win whole dollars, and a thousand rolls played at random keeping the table sound.
import { START, UNIT, LIMITS, ODDS, POINTS, WAYS, THROWS, ODDS_PAY, LAY_PAY, BIG_PAY, HARD_PAY, SINGLE_PAY, valid, kindOf, nameOf, paysText, paysShort,
  flatOf, stepOf, minOf, maxOf, whyNot, takeable, settle, betsProblem, newGame, roll, takeDown, expectation, edgeOf, oddsFair, edgeWithOdds, totalOf, callOf, stats } from "../craps-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-12) => Math.abs(a - b) < e;
const pct = x => Math.round(10000 * x) / 100;
const net = (bets, point, dice) => settle(bets, point, dice).net;
const T = (a, b) => [a, b];

// ---------- the dice ----------
{
  check(THROWS.length === 36 && new Set(THROWS.map(String)).size === 36, "two dice fall 36 ways, each once");
  const ways = Array(13).fill(0);
  for (const d of THROWS) ways[totalOf(d)]++;
  check(ways.slice(2).join() === "1,2,3,4,5,6,5,4,3,2,1" && ways.slice(2).join() === Object.values(WAYS).join(), "the totals' ways, 2 to 12: 1 2 3 4 5 6 5 4 3 2 1");
  check(POINTS.join() === "4,5,6,8,9,10", "the points are 4, 5, 6, 8, 9, 10");
}

// ---------- the bets the rules list ----------
{
  const keys = ["pass", "dont", "passo", "donto", "come", "dcome", "field", "big", "small", "seven", "craps", "eleven", "acedeuce", "aces", "boxcars", "horn",
    ...[4, 6, 8, 10].map(n => `hard${n}`), ...POINTS.map(n => `b${n}`), ...POINTS.flatMap(n => [`come${n}`, `come${n}o`, `dcome${n}`, `dcome${n}o`])];
  check(keys.every(valid) && keys.length === 16 + 4 + 6 + 24, `${keys.length} bets, every one the rules' (the lines, the additional bets, come bets on six numbers, the field, the one-roll bets, the hard ways, the Big bets)`);
  check(!valid("come7") && !valid("hard5") && !valid("b7") && !valid("come6oo") && !valid("pass6") && !valid(""), "and no others (a come bet on 7, a hard 5, a Big 7)");
  check(keys.every(k => nameOf(k) && paysText(k) && paysShort(k) && kindOf(k)), "every bet has a name, what it pays and a kind");
  check(flatOf("passo") === "pass" && flatOf("donto") === "dont" && flatOf("come6o") === "come6" && flatOf("dcome8o") === "dcome8" && flatOf("pass") === null && flatOf("come6") === null, "an additional bet sits behind its flat bet");
}

// ---------- what each bet pays (Article 6) ----------
{
  const pays = (key, dice, stake = 100, point = null, bets = null) => net(bets || { [key]: stake }, point, dice);
  // the one-roll bets
  check(pays("seven", T(3, 4)) === 400 && pays("seven", T(6, 6)) === -100, "Any seven pays 4 to 1");
  check([T(1, 1), T(1, 2), T(6, 6)].every(d => pays("craps", d) === 700) && pays("craps", T(3, 4)) === -100, "Any craps (2, 3, 12) pays 7 to 1");
  check(pays("eleven", T(5, 6)) === 1500 && pays("eleven", T(5, 5)) === -100, "Eleven pays 15 to 1");
  check(pays("acedeuce", T(1, 2)) === 1500 && pays("acedeuce", T(1, 1)) === -100, "Ace-deuce (3) pays 15 to 1");
  check(pays("aces", T(1, 1)) === 3000 && pays("aces", T(1, 2)) === -100, "Aces (2) pays 30 to 1");
  check(pays("boxcars", T(6, 6)) === 3000 && pays("boxcars", T(5, 6)) === -100, "Boxcars (12) pays 30 to 1");
  check(pays("horn", T(1, 1), 100) === 675 && pays("horn", T(6, 6), 100) === 675, "the Horn pays 27 to 4 on a 2 or 12");
  check(pays("horn", T(1, 2), 100) === 300 && pays("horn", T(5, 6), 100) === 300 && pays("horn", T(3, 4), 100) === -100, "the Horn pays 3 to 1 on a 3 or 11, and loses on anything else");
  check([T(1, 2), T(2, 2), T(4, 5), T(5, 5), T(5, 6)].every(d => pays("field", d) === 100), "the field pays 1 to 1 on 3, 4, 9, 10, 11");
  check(pays("field", T(1, 1)) === 200 && pays("field", T(6, 6)) === 200, "the field pays 2 to 1 on a 2 and on a 12 (the rules let a table pay 3 to 1 on the 12)");
  check([T(2, 3), T(3, 3), T(3, 4), T(4, 4)].every(d => pays("field", d) === -100), "the field loses on 5, 6, 7, 8");
  check(pays("big", T(4, 4)) === 100 && pays("big", T(6, 6)) === 100 && pays("big", T(3, 4)) === -100 && pays("big", T(1, 5)) === -100, "Big (8 to 12) pays 1 to 1 and loses on a seven");
  check(pays("small", T(1, 1)) === 100 && pays("small", T(3, 3)) === 100 && pays("small", T(3, 4)) === -100 && pays("small", T(4, 4)) === -100, "Small (2 to 6) pays 1 to 1 and loses on a seven");
  // the lines on the come-out roll
  check([T(3, 4), T(5, 6)].every(d => pays("pass", d) === 100) && [T(1, 1), T(1, 2), T(6, 6)].every(d => pays("pass", d) === -100), "pass wins on 7 or 11 and loses on 2, 3 or 12 (a natural, craps)");
  check([T(1, 1), T(1, 2)].every(d => pays("dont", d) === 100) && [T(3, 4), T(5, 6)].every(d => pays("dont", d) === -100) && pays("dont", T(6, 6)) === 0, "don't pass wins on 2 or 3, loses on 7 or 11 and a 12 is a push (bar)");
  check(POINTS.every(n => settle({ pass: 100 }, null, n === 10 ? T(5, 5) : T(1, n - 1)).point === n), "a point number on the come-out roll makes the point");
  check(settle({ pass: 100 }, null, T(3, 4)).point === null && settle({ pass: 100 }, null, T(6, 6)).point === null, "and any other leaves it to another come-out roll");
  // the lines after a point
  const six = { pass: 100 };
  check(pays("pass", T(3, 3), 100, 6) === 100 && pays("pass", T(3, 4), 100, 6) === -100 && settle(six, 6, T(2, 2)).bets.pass === 100, "after a point pass wins on the point, loses on a seven, and waits on anything else");
  check(pays("dont", T(3, 4), 100, 6) === 100 && pays("dont", T(3, 3), 100, 6) === -100 && settle({ dont: 100 }, 6, T(2, 2)).bets.dont === 100, "don't pass wins on a seven, loses on the point, and waits on anything else");
  check(settle(six, 6, T(3, 3)).point === null && settle(six, 6, T(3, 4)).point === null && settle(six, 6, T(2, 2)).point === 6, "the point stays until it or a seven is thrown");
  // the additional bets: 2 to 1, 3 to 2, 6 to 5; and the lays 1 to 2, 2 to 3, 5 to 6
  check(pays("passo", T(2, 2), 100, 4, { pass: 100, passo: 100 }) === 300 && pays("passo", T(5, 5), 100, 10, { pass: 100, passo: 100 }) === 300, "the additional bet behind pass pays 2 to 1 on 4 and 10 (with the line's 1 to 1)");
  check(net({ passo: 100 }, 5, T(1, 4)) === 150 && net({ passo: 100 }, 9, T(4, 5)) === 150, "3 to 2 on 5 and 9");
  check(net({ passo: 100 }, 6, T(2, 4)) === 120 && net({ passo: 100 }, 8, T(3, 5)) === 120, "6 to 5 on 6 and 8");
  check(net({ passo: 100 }, 6, T(3, 4)) === -100, "and it loses on a seven");
  check(net({ donto: 200 }, 4, T(3, 4)) === 100 && net({ donto: 300 }, 5, T(3, 4)) === 200 && net({ donto: 300 }, 6, T(3, 4)) === 250, "the lay behind don't pass pays 1 to 2 on 4, 2 to 3 on 5 and 5 to 6 on 6 (on a seven)");
  check(net({ donto: 300 }, 6, T(3, 3)) === -300, "and it loses on the point");
  // come and don't come
  check(pays("come", T(3, 4), 100, 6) === 100 && pays("come", T(5, 6), 100, 6) === 100 && pays("come", T(1, 2), 100, 6) === -100 && pays("come", T(6, 6), 100, 6) === -100, "come wins on 7 or 11 and loses on 2, 3, 12");
  check(pays("dcome", T(1, 1), 100, 6) === 100 && pays("dcome", T(3, 4), 100, 6) === -100 && pays("dcome", T(6, 6), 100, 6) === 0, "don't come wins on 2 or 3, loses on 7 or 11, a 12 is a push");
  {
    const r = settle({ come: 100 }, 6, T(2, 2));
    check(r.bets.come4 === 100 && !r.bets.come && r.net === 0 && r.lines[0].how === "moved", "a come bet goes to the number thrown (a 4), and nothing is paid or lost yet");
    const r2 = settle({ dcome: 100 }, 6, T(2, 3));
    check(r2.bets.dcome5 === 100 && !r2.bets.dcome && r2.net === 0, "a don't come bet goes to its number too");
    check(net({ come4: 100 }, 6, T(2, 2)) === 100 && net({ come4: 100 }, 6, T(3, 4)) === -100 && settle({ come4: 100 }, 6, T(3, 3)).bets.come4 === 100, "a come bet on 4 wins when a 4 comes, loses on a seven and waits on anything else");
    check(net({ dcome4: 100 }, 6, T(3, 4)) === 100 && net({ dcome4: 100 }, 6, T(2, 2)) === -100, "a don't come bet on 4 wins on a seven and loses when a 4 comes");
    check(net({ come6o: 100 }, 6, T(3, 3)) === 120 && net({ come6o: 100 }, 6, T(3, 4)) === -100 && net({ dcome6o: 300 }, 6, T(3, 4)) === 250 && net({ dcome6o: 300 }, 6, T(3, 3)) === -300, "behind a come bet the odds pay as behind pass, behind a don't come bet as behind don't pass");
    // a come bet and the old one on the same number
    const both = settle({ come: 100, come4: 200 }, 6, T(2, 2));
    check(both.net === 200 && both.bets.come4 === 100, "a come bet moving to a 4 while an older one wins on the 4: the old is paid, the new one stands on the 4");
    // a seven takes every come bet on a number and pays every don't come
    const seven = settle({ come4: 100, come4o: 100, come9: 100, dcome5: 100, dcome5o: 150, dcome10: 100 }, 6, T(3, 4));
    check(seven.net === -100 - 100 - 100 + 100 + 100 + 100 && Object.keys(seven.bets).length === 0, "a seven takes every come bet and its odds, and pays every don't come bet and its lay");
  }
  // the hard ways and the Big bets
  check(pays("hard6", T(3, 3)) === 900 && pays("hard8", T(4, 4)) === 900 && pays("hard4", T(2, 2)) === 700 && pays("hard10", T(5, 5)) === 700, "the hard ways pay 9 to 1 (3-3, 4-4) and 7 to 1 (2-2, 5-5)");
  check(pays("hard6", T(2, 4)) === -100 && pays("hard6", T(1, 5)) === -100 && pays("hard6", T(3, 4)) === -100, "a hard 6 loses to a 6 made another way and to a seven");
  check(settle({ hard6: 100 }, 6, T(2, 2)).bets.hard6 === 100 && settle({ hard6: 100 }, 6, T(6, 6)).bets.hard6 === 100, "and waits on anything else");
  check(net({ b6: 300 }, 6, T(3, 3)) === 350 && net({ b8: 300 }, 6, T(4, 4)) === 350 && net({ b5: 100 }, 6, T(2, 3)) === 140 && net({ b9: 100 }, 6, T(4, 5)) === 140 && net({ b4: 100 }, 6, T(2, 2)) === 180 && net({ b10: 100 }, 6, T(5, 5)) === 180, "Big 6 or 8 pays 7 to 6, Big 5 or 9 7 to 5, Big 4 or 10 9 to 5");
  check(net({ b6: 300 }, 6, T(3, 4)) === -300 && settle({ b6: 300 }, 6, T(2, 2)).bets.b6 === 300, "a Big bet loses to a seven and any other total is a tie: it waits");
  check(Object.values(HARD_PAY).join() === "7,9,9,7" && BIG_PAY[6].join() === "7,6" && ODDS_PAY[5].join() === "3,2" && LAY_PAY[6].join() === "5,6" && SINGLE_PAY.craps === 7, "the tables are the Article's");
}

// ---------- the house's edge ----------
{
  const edge = key => pct(edgeOf(key));
  check(edge("pass") === 1.41 && near(edgeOf("pass"), 7 / 495), "pass keeps 1.41% (7 in 495, exactly)");
  check(edge("dont") === 1.36 && near(edgeOf("dont"), 3 / 220), "don't pass keeps 1.36% (3 in 220: a 12 is a push)");
  check(edge("come") === 1.41 && edge("dcome") === 1.36 && edge("come6") === 1.41 && edge("dcome8") === 1.36, "come keeps what pass does and don't come what don't pass does (a travelled bet is the same bet)");
  check(["passo", "donto", ...POINTS.flatMap(n => [`come${n}o`, `dcome${n}o`])].every(k => edgeOf(k) === 0 && near(expectation(k), 0, 1e-15)), "every additional bet keeps nothing: its odds are exactly the ways of the number against the seven's six");
  check(POINTS.every(n => oddsFair(n) && oddsFair(n, true)), "(in whole numbers: 3 ways × 2 = 6, 4 × 3÷2 = 6, 5 × 6÷5 = 6; and a lay wins what the seven's 6 ways win over the number's: 1÷2 of 6 = 3 …)");
  check(edge("field") === 5.56 && edge("big") === 16.67 && edge("small") === 16.67, "the field keeps 5.56% and Big or Small 16.67%");
  check(edge("seven") === 16.67 && edge("craps") === 11.11 && edge("eleven") === 11.11 && edge("acedeuce") === 11.11 && edge("aces") === 13.89 && edge("boxcars") === 13.89 && edge("horn") === 12.5, "Any seven keeps 16.67%, Any craps, Eleven and Ace-deuce 11.11%, Aces and Boxcars 13.89%, the Horn 12.5%");
  check(edge("hard6") === 9.09 && edge("hard8") === 9.09 && edge("hard4") === 11.11 && edge("hard10") === 11.11, "a hard 6 or 8 keeps 9.09%, a hard 4 or 10 11.11%");
  check(edge("b6") === 1.52 && edge("b8") === 1.52 && edge("b5") === 4 && edge("b9") === 4 && edge("b4") === 6.67 && edge("b10") === 6.67, "Big 6 or 8 keeps 1.52%, Big 5 or 9 4%, Big 4 or 10 6.67%");
  // the same figures again, by playing every bet out through settle: a bet that waits is played on to its end
  const memo = new Map();
  const value = (bets, point) => {
    const lines = Object.keys(bets).some(k => /^(pass|dont)/.test(k)) ? point : "-";
    const id = `${JSON.stringify(bets)}|${lines}`;
    if (memo.has(id)) return memo.get(id);
    let sum = 0, stay = 0;
    for (const d of THROWS) {
      const r = settle(bets, point, d);
      sum += r.net / 36;
      if (Object.keys(r.bets).length) {
        const same = JSON.stringify(r.bets) === JSON.stringify(bets) && (lines === "-" || r.point === point);
        if (same) stay += 1 / 36; else sum += value(r.bets, r.point) / 36;
      }
    }
    const v = sum / (1 - stay);
    memo.set(id, v);
    return v;
  };
  const cases = [["pass", null], ["dont", null], ["come", 6], ["dcome", 6], ["hard4", 6], ["hard6", 6], ["hard8", 6], ["hard10", 6], ["b4", 6], ["b5", 6], ["b6", 6], ["b8", 6], ["b9", 6], ["b10", 6], ["field", 6], ["horn", 6], ["seven", 6]];
  const agree = cases.every(([k, pt]) => near(value({ [k]: 1 }, pt), expectation(k), 1e-12));
  check(agree, `playing out ${cases.length} bets through the rules gives each the edge worked out above (${cases.filter(([k, pt]) => !near(value({ [k]: 1 }, pt), expectation(k), 1e-12)).map(c => c[0]).join(", ") || "all agree"})`);
  // an additional bet behind a flat one, from the point on, is worth exactly nothing
  check(POINTS.every(n => near(value({ passo: 1 }, n), 0, 1e-15) && near(value({ donto: 1 }, n), 0, 1e-15)), "and an additional bet played out from any point is worth exactly nothing");
  // what the house keeps of the money on the table once the odds go behind the line
  check(pct(edgeWithOdds(0)) === 1.41 && pct(edgeWithOdds(1)) === 0.85 && pct(edgeWithOdds(2)) === 0.61 && pct(edgeWithOdds(3)) === 0.47 && pct(edgeWithOdds(5)) === 0.33 && pct(edgeWithOdds(10)) === 0.18, "pass with the odds behind it: 1.41% with none, 0.85% with 1 times, 0.61% with 2, 0.47% with 3, 0.33% with 5, 0.18% with 10");
  check(pct(edgeWithOdds(5, "dont")) === 0.23 && pct(edgeWithOdds(1, "dont")) === 0.68, "and don't pass with a lay to win as much: 0.68% with 1 times, 0.23% with 5");
  check(ODDS === 5, "this table's additional bets go up to 5 times the flat bet");
}

// ---------- stakes, limits, what may be placed ----------
{
  check(stepOf("pass") === UNIT && stepOf("horn") === 100 && stepOf("b6") === 300 && stepOf("b8") === 300 && stepOf("b5") === UNIT && stepOf("b4") === UNIT, "bets go in HK$50s; the Horn in 100s, Big 6 and 8 in 300s");
  check(stepOf("donto", 4) === 100 && stepOf("donto", 5) === 150 && stepOf("donto", 6) === 300 && stepOf("dcome9o") === 150 && stepOf("dcome6o") === 300 && stepOf("dcome10o") === 100 && stepOf("passo", 6) === UNIT, "a lay goes in 100s on 4 and 10, 150s on 5 and 9, 300s on 6 and 8");
  check(minOf("pass") === 100 && minOf("b6") === 300 && minOf("passo", 6) === UNIT && minOf("donto", 6) === 300, "at least HK$100 on a bet, a step on an additional one");
  // every stake the table allows wins whole dollars, on every throw in every state
  let whole = true, tried = 0;
  const contexts = [null, ...POINTS];
  const all = ["pass", "dont", "passo", "donto", "come", "dcome", "field", "big", "small", "seven", "craps", "eleven", "acedeuce", "aces", "boxcars", "horn",
    ...[4, 6, 8, 10].map(n => `hard${n}`), ...POINTS.flatMap(n => [`b${n}`, `come${n}`, `come${n}o`, `dcome${n}`, `dcome${n}o`])];
  for (const key of all) for (const point of contexts) {
    if (point == null && (key === "passo" || key === "donto")) continue;
    const step = stepOf(key, point);
    for (let k = 1; k <= 8; k++) for (const d of THROWS) {
      const r = settle({ [key]: k * step }, point, d);
      tried++;
      if (!Number.isInteger(r.net) || r.lines.some(l => !Number.isInteger(l.net))) whole = false;
    }
  }
  check(whole, `every stake in its step wins whole dollars on every throw in every state (${tried.toLocaleString("en-GB")} checked)`);
  // the lay: what it wins is what a stake of its step wins to the dollar
  check(net({ donto: 150 }, 5, T(3, 4)) === 100 && net({ dcome9o: 150 }, 9, T(3, 4)) === 100 && net({ dcome4o: 100 }, 4, T(3, 4)) === 50, "(a lay of 150 on 5 or 9 wins exactly 100; of 100 on 4 or 10 exactly 50)");
  // the most an additional bet takes
  const bets = { pass: 100, dont: 100, come6: 200, dcome5: 150 };
  check(maxOf("passo", bets, 6) === 500 && maxOf("come6o", bets, 6) === 1000 && maxOf("donto", bets, 6) === 600 && maxOf("donto", bets, 4) === 1000 && maxOf("donto", bets, 5) === 750 && maxOf("dcome5o", bets, 6) === 1050, "the odds behind a bet go up to 5 times it; a lay up to what wins 5 times it (600 on 6, 1,000 on 4, 750 on 5)");
  check(maxOf("pass") === LIMITS.line && maxOf("horn") === LIMITS.horn && maxOf("hard6") === LIMITS.hard && maxOf("b6") === LIMITS.bigN && maxOf("boxcars") === LIMITS.boxcars, "the limits on the other bets");
  // what may be placed when
  check(whyNot("pass", {}, null) === null && whyNot("pass", {}, 6) && whyNot("dont", {}, 6), "pass and don't pass go down before the come-out roll");
  check(whyNot("come", {}, 6) === null && whyNot("come", {}, null) && whyNot("dcome", {}, null) && whyNot("dcome", {}, 6) === null, "come and don't come once there is a point");
  check(whyNot("passo", { pass: 100 }, 6) === null && whyNot("passo", {}, 6) && whyNot("passo", { pass: 100 }, null) && whyNot("donto", { dont: 100 }, 5) === null && whyNot("donto", {}, 5), "the odds behind a bet once there is a point and the flat bet is down");
  check(whyNot("come6o", { come6: 100 }, 8) === null && whyNot("come6o", {}, 8) && whyNot("dcome6o", { dcome6: 100 }, 8) === null && whyNot("come6", {}, 8), "odds behind a come bet that has travelled; a come bet can't be placed on a number (it travels)");
  check(["field", "horn", "hard6", "b6", "seven"].every(k => whyNot(k, {}, null) === null && whyNot(k, {}, 6) === null), "the field, the Horn, the hard ways, the Big bets and the one-roll bets at any time");
  // every bet the layout puts a chip on has a finite limit between its least and its most (Small once had none, and a chip on it became NaN)
  const keys = ["pass", "dont", "come", "dcome", "field", "big", "small", "seven", "craps", "eleven", "acedeuce", "aces", "boxcars", "horn", ...POINTS.flatMap(n => [`hard${n}`, `b${n}`]).filter(valid)];
  check(keys.every(k => Number.isFinite(maxOf(k, {}, 6)) && maxOf(k, {}, 6) >= minOf(k, 6) && minOf(k, 6) >= LIMITS.min), "every bet has a finite limit above its minimum");
  check(keys.every(k => { const st = stepOf(k, 6); return maxOf(k, {}, 6) % st === 0 && minOf(k, 6) % st === 0; }), "every limit and minimum is a whole number of the bet's steps");
  check(takeable("passo") && takeable("come6o") && takeable("hard6") && takeable("b9") && !takeable("pass") && !takeable("come6") && !takeable("dcome6") && !takeable("dont") && !takeable("field"), "the additional bets, the hard ways and the Big bets may come down; the flat bets may not");
  const tab = { pass: 100, passo: 200, come6: 100, come6o: 100, hard8: 100, b5: 100 };
  check(JSON.stringify(takeDown(tab)) === JSON.stringify({ pass: 100, come6: 100 }), "taking down takes those off and leaves the flat bets");
  // betsProblem
  check(betsProblem({}, 1000, null) === "No bets on the layout", "no bets, no roll");
  check(betsProblem({ pass: 100 }, 50, null) === "That's more than you hold", "more than you hold");
  check(betsProblem({ pass: 100 }, 1000, null) === null && betsProblem({ pass: 100, field: 100, hard6: 100 }, 1000, null) === null, "a line bet and others go down");
  check(betsProblem({ pass: 100, horn: 150 }, 1000, null)?.includes("Horn") && betsProblem({ b6: 100 }, 1000, 6)?.includes("300") && betsProblem({ pass: 75 }, 1000, null)?.includes("50"), "stakes off their step are refused, saying the step");
  check(betsProblem({ pass: 50 }, 1000, null)?.includes("At least") && betsProblem({ pass: 200000 }, 300000, null)?.includes("up to"), "and under the least or over the most");
  check(betsProblem({ passo: 100 }, 1000, 6) && betsProblem({ pass: 100, passo: 100 }, 1000, null) && betsProblem({ pass: 100, passo: 600 }, 1000, 6) && betsProblem({ pass: 100, passo: 500 }, 1000, 6) === null, "odds without a flat bet, odds with no point, odds over 5 times: all refused; 5 times goes");
  check(betsProblem({ pass: 100 }, 1000, 6) === null && betsProblem({ come: 100 }, 1000, null) && betsProblem({ come: 100 }, 1000, 6) === null, "a pass bet stands through the point; a come bet with no point is refused");
  check(betsProblem({ come6: 100 }, 1000, 6) === null && betsProblem({ come6: 100, come6o: 500 }, 1000, 6) === null, "a come bet that has travelled stands on the table as it is");
}

// ---------- a roll ----------
{
  const g = newGame(7), g2 = newGame(7);
  check(g.balance === START && g.point === null && !g.rolls && !g.history.length && Object.keys(g.bets).length === 0, "a new game: your bankroll, no point, nothing on the table");
  g.bets = { pass: 100, field: 100 }; g2.bets = { pass: 100, field: 100 };
  const r = roll(g), r2 = roll(g2);
  check(JSON.stringify(r.dice) === JSON.stringify(r2.dice) && r.dice.length === 2 && r.dice.every(x => x >= 1 && x <= 6), "a roll from a seed is the same every time, two dice");
  check(r.state.balance === START + r.settled.net && r.state.rolls === 1 && r.state.history.length === 1 && g.rolls === 0 && g.balance === START, "the bankroll takes the roll's net, and the game before is left as it was");
  check(r.state.call && typeof r.state.call.words === "string" && JSON.stringify(r.state.call) === JSON.stringify(callOf(r.dice, null, r.state.point)), "and the stickman's call on it");
  check(JSON.stringify(r.state.lastBets) === JSON.stringify({ pass: 100, field: 100 }), "the table before the roll is kept for Rebet");
  let threw = false;
  try { const h = newGame(1); h.bets = { pass: 100 }; h.balance = 50; roll(h); } catch (e) { threw = /hold/.test(e.message); }
  check(threw, "a roll that can't go down throws, saying why");
  // 12,000 throws land as two fair dice do
  const s = newGame(2026), counts = Array(13).fill(0);
  for (let i = 0; i < 12000; i++) { s.bets = { field: 100 }; s.balance = START; const x = roll(s); Object.assign(s, x.state); counts[totalOf(x.dice)]++; }
  const chi = Object.entries(WAYS).reduce((a, [t, w]) => a + (counts[t] - (12000 * w) / 36) ** 2 / ((12000 * w) / 36), 0);
  check(chi < 29.6, `12,000 rolls: the totals as two fair dice make them (chi-square ${chi.toFixed(1)} on 10 degrees of freedom)`);
}

// ---------- a thousand rolls played at random: the table stays sound ----------
{
  let g = newGame(99), ok = true, why = "", seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const pool = ["pass", "dont", "come", "dcome", "passo", "donto", "field", "big", "small", "seven", "craps", "eleven", "acedeuce", "aces", "boxcars", "horn", "hard4", "hard6", "hard8", "hard10", "b4", "b5", "b6", "b8", "b9", "b10"];
  for (let i = 0; i < 1000 && ok; i++) {
    for (let k = 0; k < 4; k++) {
      const key = pick(pool);
      if (whyNot(key, g.bets, g.point)) continue;
      const add = Math.max(stepOf(key, g.point), pick([100, 300, 500]));
      const next = { ...g.bets, [key]: (g.bets[key] || 0) + add - ((g.bets[key] || 0) + add) % stepOf(key, g.point) };
      if (!betsProblem(next, g.balance, g.point)) g.bets = next;
    }
    if (betsProblem(g.bets, g.balance, g.point)) { if (!Object.keys(g.bets).length || g.balance < 100) { g = { ...g, balance: START, bets: {} }; } continue; }
    try { g = roll(g).state; } catch (e) { ok = false; why = `roll threw: ${e.message}`; break; }
    const total = Object.values(g.bets).reduce((a, v) => a + v, 0);
    if (total > g.balance) { ok = false; why = `table ${total} over balance ${g.balance} at roll ${i}`; }
    if (!Object.keys(g.bets).every(valid)) { ok = false; why = "an invalid key on the table"; }
    if (!Number.isInteger(g.balance) || Number.isNaN(g.balance)) { ok = false; why = `balance ${g.balance}`; }
    if (g.point !== null && !POINTS.includes(g.point)) { ok = false; why = `point ${g.point}`; }
    if (Object.keys(g.bets).some(k => /^(pass|dont)$/.test(k)) && g.point == null) { ok = false; why = "a line bet standing with no point"; }
    if (Object.keys(g.bets).some(k => /^(come|dcome)$/.test(k) || /^(passo|donto)$/.test(k) && g.point == null)) { ok = false; why = "a waiting bet left on the table"; }
    if (g.balance < 100) g = { ...g, balance: START };
  }
  check(ok, `1,000 rolls at random: the table never holds more than you do, whole dollars, no stray bets${why ? ` (${why})` : ""}`);
}

// ---------- the call and the screen ----------
{
  check(callOf(T(3, 4), null, null).words === "Natural" && callOf(T(5, 6), null, null).side === "pass" && callOf(T(1, 2), null, null).words === "Craps" && callOf(T(6, 6), null, null).side === "dont", "the call on a come-out roll: a natural, craps");
  check(callOf(T(3, 5), null, 8).words === "Point 8" && callOf(T(4, 4), null, 8).words === "Point 8", "or the point (the point after the throw)");
  check(callOf(T(3, 3), 6, null).words === "Point made" && callOf(T(3, 4), 6, null).words === "Seven out" && callOf(T(4, 4), 6, 6).words === "Hard way" && callOf(T(4, 5), 6, 6).words === "", "after a point: the point made, seven out, a hard way, or nothing");
  const h = [T(3, 4), T(1, 1), T(3, 4), T(6, 6), T(2, 5), T(3, 4)], st = stats(h, 100);
  check(st.rolls === 6 && st.counts[7] === 4 && st.counts[2] === 1 && st.counts[12] === 1 && st.sevens === 4 && st.hot[0] === 7 && st.last[0].join() === "3,4" && st.last.length === 6, "the screen's counts: sevens, how often each total came, the last rolls newest first");
  check(st.cold[0] === 3 && st.cold.slice(0, 3).every(t => st.counts[t] === 0), "and the coldest are those never thrown (3, 4, 5…)");
  check(stats(h, 2).rolls === 2 && stats([], 100).rolls === 0 && stats([], 100).hot.length === 0, "a window of the last few; none before the first roll");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("craps: the dice, every bet and what it pays, the lines and the point, come bets, the additional bets, every bet's edge twice over, stakes, limits, rolls");
