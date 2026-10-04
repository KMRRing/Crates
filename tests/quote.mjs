// Quote: the bank is sound, sets are deterministic and spread across categories, and settling a market behaves.
const E = await import("../quote-engine.js");
const { QUOTES, CATS } = await import("../quote-bank.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// the bank
const ids = new Set(QUOTES.map(q => q.id));
const sound = QUOTES.every(q => CATS[q.cat] && q.q && q.unit && Number.isFinite(q.truth) && q.note && (q.scale === "log" ? q.truth > 0 : q.scale > 0) && (q.unit !== "year" || (q.truth > 1000 && q.truth < 2100 && q.scale !== "log")));
check(ids.size === QUOTES.length && sound, `bank: ${QUOTES.length} questions, unique ids, every truth and scale sound`);

// sets
const a = E.pickSet(42, QUOTES), b = E.pickSet(42, QUOTES), c = E.pickSet(43, QUOTES);
const perCat = s => Math.max(...Object.values(s.reduce((m, q) => ({ ...m, [q.cat]: (m[q.cat] || 0) + 1 }), {})));
check(a.length === E.PER_SET && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c) && perCat(a) <= 2 && new Set(a.map(q => q.id)).size === a.length,
  "sets: ten questions, the same for the same seed, different for another, at most two from a category, no repeats");

// settling
const city = { truth: 37, scale: "log" }, year = { truth: 1937, scale: 25 };
const tight = E.settle(city, 35, 40), wide = E.settle(city, 20, 60), point = E.settle(city, 37, 37.001), fourfold = E.settle(city, 20, 80.5);
check(tight.inside && wide.inside && tight.delta > wide.delta && wide.delta > 0 && point.delta === 200 && fourfold.delta === 0,
  `inside pays more the tighter the market (35–40 earns ${tight.delta}, 20–60 earns ${wide.delta}, a point 200, 4× wide 0)`);
const near = E.settle(city, 40, 50), far = E.settle(city, 80, 100), veryFar = E.settle(city, 1000, 2000);
check(!near.inside && near.delta < 0 && far.delta < near.delta && veryFar.delta === -600,
  `outside loses more the further out (40–50 loses ${-near.delta}, 80–100 loses ${-far.delta}, 1000–2000 the cap of 600)`);
const y1 = E.settle(year, 1930, 1940), y2 = E.settle(year, 1900, 1975), y3 = E.settle(year, 1950, 1960);
check(y1.inside && y2.inside && y1.delta > y2.delta && y2.delta === 0 && !y3.inside && y3.delta === -Math.round(150 * 13 / 25),
  `years use the step: 1930–1940 earns ${y1.delta}, 1900–1975 earns ${y2.delta}, 1950–1960 loses ${-y3.delta} (13 years short at 25 a doubling)`);
check(E.fault(city, 10, 5) && E.fault(city, 0, 5) && E.fault(city, NaN, 5) && !E.fault(city, 1, 5), "faults: ask below bid, a zero bid, a missing number");
check(E.withUnit(450.3, { unit: "$ million" }) === "$450.3 million" && E.withUnit(1937, { unit: "year" }) === "1937" && E.withUnit(37, { unit: "million" }) === "37 million" && E.withUnit(11104, { unit: "$ a tonne" }) === "$11,104 a tonne",
  "words: currencies lead, years stand alone, thousands get commas");
// two players
const hitHigh = E.trade(city, 50, 60, "hit"), hitLow = E.trade(city, 20, 30, "hit"), lift = E.trade(city, 20, 30, "lift"), pass = E.trade(city, 35, 40, "pass");
check(hitHigh.taker > 0 && hitHigh.maker === -hitHigh.taker && hitLow.taker < 0 && lift.taker > 0 && pass.maker === E.settle(city, 35, 40).delta && pass.taker === 0,
  `two players: hitting a bid of 50 on 37 pays the taker ${hitHigh.taker}, hitting 20 costs them ${-hitLow.taker}, lifting 30 pays them ${lift.taker}, a pass settles the maker alone`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
