// Quote: the bank is sound, sets are deterministic and spread across categories, and settling a market behaves.
const E = await import("../quote-engine.js");
const { QUOTES, CATS } = await import("../quote-bank.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// the bank
const ids = new Set(QUOTES.map(q => q.id));
const sound = QUOTES.every(q => CATS[q.cat] && q.q && q.unit && Number.isFinite(q.truth) && q.note && q.tol > 0 && (q.scale === "log" ? q.truth > 0 : q.scale > 0) && (q.unit !== "year" || (q.truth > 1000 && q.truth < 2100 && q.scale !== "log")));
check(ids.size === QUOTES.length && sound, `bank: ${QUOTES.length} questions, unique ids, every truth, scale and range sound`);

// sets
const a = E.pickSet(42, QUOTES), b = E.pickSet(42, QUOTES), c = E.pickSet(43, QUOTES);
const perCat = s => Math.max(...Object.values(s.reduce((m, q) => ({ ...m, [q.cat]: (m[q.cat] || 0) + 1 }), {})));
check(a.length === E.PER_SET && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c) && perCat(a) <= 2 && new Set(a.map(q => q.id)).size === a.length,
  "sets: ten questions, the same for the same seed, different for another, at most two from a category, no repeats");

// the tiers: every question has SS/S/A/B radii in order, and a difficulty 1–5
check(QUOTES.every(q => q.tiers && q.tiers.S > 0 && q.tiers.A > q.tiers.S && q.tiers.B > q.tiers.A && (q.tiers.SS == null || q.tiers.SS < q.tiers.S) && q.d >= 1 && q.d <= 5), "every question carries tiers in order and a difficulty");
// settling: graded by the tiers, continuous between them, scaled by difficulty
const city = { truth: 37, scale: "log", tol: 0.15, tiers: { SS: 0.03, S: 0.225, A: 0.525, B: 1.05 }, d: 3 }, year = { truth: 1937, scale: 25, tol: 3, unit: "year", tiers: { SS: 0, S: 8, A: 20, B: 35 }, d: 3 };
const point = E.settle(city, 37, 37.0001), tight = E.settle(city, 35, 40), a1 = E.settle(city, 30, 50), wide = E.settle(city, 20, 60), veryWide = E.settle(city, 10, 100);
check(point.grade === "SS" && point.delta === 300 && tight.grade === "S" && a1.grade === "A" && wide.grade === "B" && veryWide.grade === "C" && tight.delta > a1.delta && a1.delta > wide.delta && wide.delta > 0,
  `grades by radius: a point SS 300, 35–40 S ${tight.delta}, 30–50 A ${a1.delta}, 20–60 B ${wide.delta}, 10–100 C ${veryWide.delta}`);
const edgeIn = E.settle(city, 30, 37), edgeOut = E.settle(city, 30, 36.99), near = E.settle(city, 40, 45), far = E.settle(city, 80, 100), veryFar = E.settle(city, 1000, 2000);
// in range pays, out of range never does: a hair outside loses a little (a C), further out loses more
check(edgeIn.delta > 0 && edgeOut.grade === "C" && edgeOut.delta < 0 && edgeOut.delta >= -20 && near.delta < edgeOut.delta && far.delta < near.delta && far.delta < -100 && veryFar.delta <= -295,
  `in range pays, out never does (${edgeIn.delta} just inside, ${edgeOut.delta} just outside); further out loses more (40–45 ${near.delta}, 80–100 ${far.delta}, 1000–2000 ${veryFar.delta})`);
// a range that holds the answer never loses, however wide
const huge = E.settle(city, 0.001, 1e9);
check(huge.inside && huge.delta > 0, `a huge range that holds the answer still earns a little: ${huge.delta}`);
const y0 = E.settle(year, 1937, 1937), yS = E.settle(year, 1930, 1939), yA = E.settle(year, 1920, 1950), yB = E.settle(year, 1920, 1970), yC = E.settle(year, 1800, 1900), yMiss = E.settle(year, 1940, 1942);
check(y0.grade === "SS" && y0.delta === 300 && yS.grade === "S" && yA.grade === "A" && yB.grade === "B" && yC.grade === "C" && yMiss.grade === "C" && yMiss.delta < 0 && yMiss.delta > -30 && yC.delta < 60,
  `years by their tiers: exact SS, 1930s S ${yS.delta}, 1920–1950 A ${yA.delta}, 1920–1970 B ${yB.delta}, 1800–1900 C ${yC.delta}, a near miss 1940–1942 a C that loses a little ${yMiss.delta}`);
const easy = E.settle({ ...year, d: 1 }, 1930, 1939), hard = E.settle({ ...year, d: 5 }, 1930, 1939);
check(easy.delta < yS.delta && hard.delta > yS.delta && E.adequate("A") && !E.adequate("B"), `difficulty scales the payoff (a 1 pays ${easy.delta}, a 3 ${yS.delta}, a 5 ${hard.delta}); A is adequate, B is not`);
check(E.fault(city, 10, 5) && E.fault(city, 0, 5) && E.fault(city, NaN, 5) && !E.fault(city, 1, 5), "faults: ask below bid, a zero bid, a missing number");
{
  // the same number twice: a market on one figure, for when you know it exactly
  const opec = QUOTES.find(q => q.id === "tr-34"), exact = E.settle(opec, 12, 12), near = E.settle(opec, 11.5, 12.5), off = E.settle(opec, 11, 11);
  check(!E.fault(opec, 12, 12) && E.fault(opec, 13, 12), "the same number as bid and ask is a market; an ask below the bid still isn't");
  check(exact.grade === "SS" && exact.inside && exact.delta > near.delta && near.grade !== "SS", `12–12 on OPEC's 12 members is SS, exact, and pays more than 11.5–12.5 (${exact.grade} ${exact.delta}, ${near.grade} ${near.delta})`);
  check(!off.inside && off.grade !== "SS" && off.delta < exact.delta, `11–11 is outside, graded by how far it is (one country out: ${off.grade} ${off.delta}), and pays less than exact`);
  const t = E.trade(opec, 12, 12, "hit");
  check(Number.isFinite(t.maker) && Number.isFinite(t.taker), "a partner can trade against a market on one figure");
}
check(E.withUnit(450.3, { unit: "$ million" }) === "$450.3 million" && E.withUnit(1937, { unit: "year" }) === "1937" && E.withUnit(37, { unit: "million" }) === "37 million" && E.withUnit(11104, { unit: "$ a tonne" }) === "$11,104 a tonne",
  "words: currencies lead, years stand alone, thousands get commas");
check(E.tiersText(year) === "S ±8 years · A ±20 · B ±35" && E.tierText(city, "A") === "±53%", `the tiers read as "${E.tiersText(year)}", an A on a magnitude as ${E.tierText(city, "A")}`);
// two players
const hitHigh = E.trade(city, 50, 60, "hit"), hitLow = E.trade(city, 20, 30, "hit"), lift = E.trade(city, 20, 30, "lift"), pass = E.trade(city, 35, 40, "pass");
check(hitHigh.taker > 0 && hitHigh.maker === -hitHigh.taker && hitLow.taker < 0 && lift.taker > 0 && pass.maker === E.settle(city, 35, 40).delta && pass.taker === 0,
  `two players: hitting a bid of 50 on 37 pays the taker ${hitHigh.taker}, hitting 20 costs them ${-hitLow.taker}, lifting 30 pays them ${lift.taker}, a pass settles the maker alone`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
