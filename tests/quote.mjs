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

// settling: continuous, on each question's own range
const city = { truth: 37, scale: "log", tol: 0.15 }, year = { truth: 1937, scale: 25, tol: 3, unit: "year" };
const point = E.settle(city, 37, 37.0001), tight = E.settle(city, 35, 40), range = E.settle(city, 37 / 1.075, 37 * 1.075), wide = E.settle(city, 20, 60);
check(point.delta === 300 && tight.delta > wide.delta && wide.delta > 0 && range.delta > 150 && range.delta < 200,
  `inside pays more the tighter the market (a point 300, 35–40 earns ${tight.delta}, a market one range wide ${range.delta}, 20–60 earns ${wide.delta}), and never loses`);
const edgeIn = E.settle(city, 30, 37), edgeOut = E.settle(city, 30, 36.99), near = E.settle(city, 40, 45), far = E.settle(city, 80, 100), veryFar = E.settle(city, 1000, 2000);
check(Math.abs(edgeIn.delta - edgeOut.delta) <= 2 && near.delta > 0 && near.delta < edgeOut.delta && far.delta < near.delta && far.delta < -200 && veryFar.delta <= -295,
  `continuous across the edge (${edgeIn.delta} just inside, ${edgeOut.delta} just outside); further out loses more (40–45 ${near.delta}, 80–100 ${far.delta}, 1000–2000 ${veryFar.delta})`);
const y0 = E.settle(year, 1937, 1937), y1 = E.settle(year, 1935, 1940), y2 = E.settle(year, 1930, 1945), y3 = E.settle(year, 1938, 1938), y4 = E.settle(year, 1940, 1940), y5 = E.settle(year, 1960, 1970);
check(y0.delta === 300 && y1.delta > y2.delta && y2.delta > 0 && y3.delta > 150 && y4.delta > -40 && y4.delta < 60 && y5.delta < -200,
  `years use their own range (3): exact 300, 1935–1940 earns ${y1.delta}, 1930–1945 ${y2.delta}, a point a year off ${y3.delta}, three years off ${y4.delta}, 1960–1970 loses ${-y5.delta}`);
check(E.fault(city, 10, 5) && E.fault(city, 0, 5) && E.fault(city, NaN, 5) && !E.fault(city, 1, 5), "faults: ask below bid, a zero bid, a missing number");
check(E.withUnit(450.3, { unit: "$ million" }) === "$450.3 million" && E.withUnit(1937, { unit: "year" }) === "1937" && E.withUnit(37, { unit: "million" }) === "37 million" && E.withUnit(11104, { unit: "$ a tonne" }) === "$11,104 a tonne",
  "words: currencies lead, years stand alone, thousands get commas");
check(E.rangeText(city) === "±15%" && E.rangeText(year) === "±3 years" && E.rangeText({ scale: 1, tol: 1, unit: "countries" }) === "±1 countries", "the range reads as ±15%, ±3 years");
// two players
const hitHigh = E.trade(city, 50, 60, "hit"), hitLow = E.trade(city, 20, 30, "hit"), lift = E.trade(city, 20, 30, "lift"), pass = E.trade(city, 35, 40, "pass");
check(hitHigh.taker > 0 && hitHigh.maker === -hitHigh.taker && hitLow.taker < 0 && lift.taker > 0 && pass.maker === E.settle(city, 35, 40).delta && pass.taker === 0,
  `two players: hitting a bid of 50 on 37 pays the taker ${hitHigh.taker}, hitting 20 costs them ${-hitLow.taker}, lifting 30 pays them ${lift.taker}, a pass settles the maker alone`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
