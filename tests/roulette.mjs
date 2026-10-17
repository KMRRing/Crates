// Roulette's rules (roulette-engine.js): the wheel (every pocket once, the colours as the wheel carries them), every
// bet the layout takes (how many of each kind, each on numbers that sit together, and zero only on its own, as Macau's
// rules have it), what each pays, the house's edge on every bet worked out over every pocket, which bets may go down,
// where each bet's chip sits on the layout and that a tap there places it, a spin (from its seed, settled, kept), and
// what the screen over the table counts.
import { WHEEL, LIMITS, UNIT, START, colourOf, kindOf, numbersOf, nameOf, validBet, payout, settle, edgeOf, betsProblem, newGame, spin, stats, neighbours } from "../roulette-engine.js";
import { layoutFor, betAt, spotOf } from "../roulette-layout.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);

// ---------- the wheel ----------
{
  check(WHEEL.length === 37 && new Set(WHEEL).size === 37 && range(0, 36).every(p => WHEEL.includes(p)), "the wheel: every number 0 to 36 once, 37 pockets");
  const reds = range(1, 36).filter(p => colourOf(p) === "red");
  check(reds.length === 18 && colourOf(0) === "green" && reds.join() === "1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36", "eighteen red, eighteen black, zero green");
  check(WHEEL.slice(1).every((p, i, a) => i === 0 || colourOf(p) !== colourOf(a[i - 1])) && WHEEL[1] === 32 && WHEEL[36] === 26, "round the wheel red and black alternate, 32 to zero's right and 26 to its left");
  check(neighbours(0, 2).join() === "3,26,0,32,15" && neighbours(26, 1).join() === "3,26,0", "neighbours: the pockets either side on the wheel");
}

// ---------- the bets the layout takes ----------
const ALL = [...range(0, 36).map(p => `n${p}`)];
for (let a = 0; a <= 36; a++) for (let b = a + 1; b <= 36; b++) ALL.push(`s${a}-${b}`);
for (const a of range(1, 36)) ALL.push(`t${a}`, `c${a}`, `l${a}`);
ALL.push("d1", "d2", "d3", "k1", "k2", "k3", "red", "black", "odd", "even", "low", "high");
const OK = ALL.filter(k => validBet(k));
{
  const count = kind => OK.filter(k => kindOf(k) === kind).length;
  check(count("n") === 37 && count("s") === 57 && count("t") === 12 && count("c") === 22 && count("l") === 11, "the layout: 37 straights, 57 splits, 12 streets, 22 corners, 11 six lines");
  check(count("d") === 3 && count("k") === 3 && count("even") === 6, "and outside: three dozens, three columns, six even-money bets");
  check(!validBet("s0-1") && !validBet("s0-3") && OK.filter(k => numbersOf(k).includes(0)).join() === "n0", "zero is bet on only by itself: no split, trio or first four with it (the rules' Article 8)");
  const row = x => Math.floor((x - 1) / 3), col = x => (x - 1) % 3;
  check(OK.filter(k => kindOf(k) === "s").every(k => { const [a, b] = numbersOf(k); return (row(a) === row(b) && Math.abs(col(a) - col(b)) === 1) || (col(a) === col(b) && Math.abs(row(a) - row(b)) === 1); }), "every split is two neighbours on the layout");
  check(OK.filter(k => kindOf(k) === "c").every(k => { const n = numbersOf(k); return new Set(n.map(row)).size === 2 && new Set(n.map(col)).size === 2; }), "every corner is a square of four");
  check(!validBet("s3-4") && !validBet("c3") && !validBet("t2") && !validBet("n37"), "no split from 3 to 4 (another row), no corner off the edge, no 37");
  check(numbersOf("k1").join() === range(0, 11).map(i => 3 * i + 1).join() && numbersOf("d2").join() === range(13, 24).join() && numbersOf("l31").join() === "31,32,33,34,35,36" && numbersOf("c32").join() === "32,33,35,36",
    "the first column 1, 4 … 34; the second dozen 13 to 24; the last six line; the last corner");
  check(nameOf("s17-20") === "Split 17–20" && nameOf("d2") === "Second dozen" && nameOf("n0") === "0 straight up" && nameOf("t13") === "Street 13–15" && nameOf("red") === "Red", "bets named as the table says them");
}

// ---------- what bets pay, and what the house keeps ----------
{
  check(payout("n17", 100, 17) === 3500 && payout("s17-20", 100, 20) === 1700 && payout("t13", 100, 14) === 1100 && payout("c13", 100, 17) === 800 && payout("l13", 100, 18) === 500 && payout("d2", 100, 24) === 200 && payout("k3", 100, 36) === 200 && payout("red", 100, 32) === 100,
    "straight 35 to 1, split 17, street 11, corner 8, six line 5, a dozen or column 2, red even money");
  check(payout("red", 100, 0) === -100 && payout("d1", 100, 0) === -100 && payout("n0", 100, 0) === 3500, "zero takes every bet but a straight one on itself: no half back on the even-money bets");
  const off = OK.filter(k => Math.abs(edgeOf(k) - 1 / 37) > 1e-12);
  check(!off.length, `every one of the ${OK.length} bets keeps the house ${(100 / 37).toFixed(2)}%${off.length ? ` (off: ${off.join(", ")})` : ""}`);
  const s = settle({ n17: 100, red: 200, "s16-17": 50 }, 17);
  check(s.net === 3500 - 200 + 850 && s.back === 3600 + 900, "everything on the layout settled together: 17 wins its straight and its split, black 17 loses red");
}

// ---------- which bets may go down ----------
{
  check(betsProblem({}, START) && betsProblem({ n17: 50 }, START) && betsProblem({ red: 100 }, START) && betsProblem({ n17: LIMITS.number + UNIT }, START * 10) && betsProblem({ n17: 120 }, START) && betsProblem({ "s3-4": 100 }, START) && betsProblem({ red: 30000 }, 20000),
    `at least HK$${LIMITS.inside} on the numbers and HK$${LIMITS.outside} on an outside bet, up to HK$${LIMITS.number.toLocaleString("en-GB")} a number, in HK$${UNIT}s, on bets the layout has, within what you hold`);
  check(!betsProblem({ n17: 100 }, START) && !betsProblem({ red: LIMITS.outside }, START) && !betsProblem({ "s17-20": 2 * LIMITS.number, red: 500 }, START * 10) && !betsProblem({ c13: 4 * LIMITS.number }, START * 10), "a split takes twice a number's maximum, a corner four times");
}

// ---------- the layout: what a tap bets, where its chip sits ----------
{
  for (const sideways of [false, true]) {
    const p = layoutFor(sideways ? 760 : 358, sideways ? 330 : 380, sideways);
    // every bet's chip, tapped a little in from where it sits (towards its first number), in its kind's mode, places it
    const MODE = { n: "number", s: "split", t: "street", c: "corner", l: "line", d: "number", k: "number", even: "number" };
    const tapAt = key => {
      const [x, y] = p.to(...spotOf(p, key));
      if (!["s", "c", "l", "t"].includes(kindOf(key))) return [x, y];
      const [cx, cy] = p.to(...spotOf(p, `n${numbersOf(key)[0]}`));
      return [x + (cx - x) * 0.08, y + (cy - y) * 0.08];
    };
    const off = OK.filter(key => betAt(p, ...tapAt(key), MODE[kindOf(key)]) !== key);
    check(!off.length, `${sideways ? "sideways" : "upright"}: a tap where each of the ${OK.length} bets' chips sits, in its mode, places that bet${off.length ? ` (off: ${off.slice(0, 8).join(", ")})` : ""}`);
    check(betAt(p, ...p.to(p.e + p.d + p.c * 1.5, p.z / 2), "corner") === "n0" && betAt(p, -5, -5, "number") === null, "zero answers every mode with a straight bet; a tap off the layout bets nothing");
  }
}

// ---------- a spin ----------
{
  const g = { ...newGame(7), bets: { n17: 100, red: 500 } }, r = spin(g), again = spin(g);
  check(r.pocket === again.pocket && JSON.stringify(r.state) === JSON.stringify(again.state), "the same game spins the same number");
  check(r.state.balance === g.balance + r.settled.net && r.state.history.at(-1) === r.pocket && JSON.stringify(r.state.lastBets) === JSON.stringify(g.bets) && !Object.keys(r.state.bets).length, "a spin settles the bets into the bankroll, adds its number, and clears the layout for Rebet");
  let s = newGame(11);
  const seen = new Map();
  for (let k = 0; k < 37000; k++) {
    const res = spin({ ...s, bets: { red: 500 } });
    seen.set(res.pocket, (seen.get(res.pocket) || 0) + 1);
    s = { ...res.state, balance: START };
  }
  const chi = [...seen.values()].reduce((a, n) => a + (n - 1000) ** 2 / 1000, 0);
  check(seen.size === 37 && chi < 80, `37,000 spins land on every pocket about equally (chi-square ${chi.toFixed(1)} on 36 degrees of freedom)`);
}

// ---------- the screen ----------
{
  const st = stats([0, 32, 32, 15, 19, 4, 32, 26, 1], 100);
  check(st.spins === 9 && st.red === 5 && st.black === 3 && st.green === 1 && st.dozens.join() === "2,2,4" && st.odd + st.even === 8, "the counts: colours, odd and even, the dozens (a zero in none)");
  check(st.hot[0] === 32 && st.last.join() === "1,26,32,4,19,15,32,32,0" && !st.hot.includes(2) && st.cold.every(p => st.counts[p] === 0), "the hottest number, the last ones newest first, the coldest never seen");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("roulette: the wheel, the layout's bets, payouts and edges, limits, taps on the layout, spins, the screen");
