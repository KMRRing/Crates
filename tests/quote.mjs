// Quote: the bank is sound, sets are deterministic and spread across categories, and settling a market behaves.
const E = await import("../quote-engine.js");
const { QUOTES, CATS } = await import("../quote-bank.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// the bank
const ids = new Set(QUOTES.map(q => q.id));
const sound = QUOTES.every(q => CATS[q.cat] && q.q && q.unit && Number.isFinite(q.truth) && q.note && q.tol > 0 && (q.scale === "log" ? q.truth > 0 : q.scale > 0) && (q.unit !== "year" || (q.truth >= 1000 && q.truth < 2100 && q.scale !== "log")));
check(ids.size === QUOTES.length && sound, `bank: ${QUOTES.length} questions, unique ids, every truth, scale and range sound`);

// sets
const a = E.pickSet(42, QUOTES), b = E.pickSet(42, QUOTES), c = E.pickSet(43, QUOTES);
const perCat = s => Math.max(...Object.values(s.reduce((m, q) => ({ ...m, [q.cat]: (m[q.cat] || 0) + 1 }), {})));
check(a.length === E.PER_SET && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c) && perCat(a) <= 2 && new Set(a.map(q => q.id)).size === a.length,
  "sets: ten questions, the same for the same seed, different for another, at most two from a category, no repeats");
// topics: a set from a mix of the categories, each out, in or more
{
  const all = E.TOPIC_PRESETS.balanced.topics, count = (s, cat) => s.filter(q => q.cat === cat).length;
  check(E.TOPICS.length === Object.keys(CATS).length && [1, 2, 3].every(seed => JSON.stringify(E.pickMixed(seed, QUOTES, all)) === JSON.stringify(E.pickSet(seed, QUOTES))),
    "topics: the bank's categories; every one in deals the set as it always was");
  const noArt = { ...all, art: 0 }, sets = Array.from({ length: 200 }, (_, seed) => E.pickMixed(seed, QUOTES, noArt));
  check(sets.every(s => s.length === E.PER_SET && !count(s, "art") && perCat(s) <= 2 && new Set(s.map(q => q.id)).size === s.length), "a topic out: none of it, still ten, at most two from a topic in");
  const tradeMore = Array.from({ length: 200 }, (_, seed) => E.pickMixed(seed, QUOTES, { ...noArt, trade: 2 }));
  const n = xs => xs.reduce((a, s) => a + count(s, "trade"), 0), ratio = n(tradeMore) / n(sets);
  check(tradeMore.every(s => count(s, "trade") <= 4) && ratio > 1.4 && ratio < 2.6, `a topic more: up to four, dealt about twice as often as in (${ratio.toFixed(2)} times)`);
  const refining = E.pickMixed(5, QUOTES, Object.fromEntries(E.TOPICS.map(([id]) => [id, id === "refining" ? 1 : 0])));
  check(refining.length === E.PER_SET && refining.every(q => q.cat === "refining"), "one topic in: all ten from it, as a refining set");
  // the page deals from the topics in only (the rest taken out first): a set still of ten, one topic's as it always was
  const only = ids => Object.fromEntries(E.TOPICS.map(([id]) => [id, ids.includes(id) ? 1 : 0])), poolOf = w => QUOTES.filter(q => w[q.cat] > 0);
  const three = only(["trade", "markets", "refining"]), rf = only(["refining"]);
  check(E.pickMixed(5, poolOf(three), three).length === E.PER_SET && JSON.stringify(E.pickMixed(5, poolOf(rf), rf)) === JSON.stringify(E.pickSet(5, poolOf(rf), E.PER_SET, E.PER_SET)),
    "from the topics in alone: three topics fill a set of ten; one topic's set is the refining set it always was");
  check(E.presetOf(all) === "balanced" && E.presetOf(E.TOPIC_PRESETS.culture.topics) === "culture" && E.presetOf(noArt) === "custom" && E.cleanTopics({ trade: 2, art: "x" }).art === 1,
    "a mix is a preset's or your own; a weight it doesn't know is in");
}

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
// a table of two to six (quote-table.js). Ranges: everyone's own market, scored as alone; the reveal once everyone at
// the table has quoted; the reveal's order; who the table waits for; the grace for the slow; Next from everyone; people
// away left out; the standings and the pair's record. Trade, for a pair, on the same table. Every move through the
// database as it gives things back.
{
  const T = await import("../quote-table.js");
  const { roundTrip, same } = await import("./rtdb.js");
  const qs = { "q-city": { ...city, id: "q-city", q: "A city", unit: "million" }, "q-year": { ...year, id: "q-year", q: "A year" } };
  const questionOf = id => qs[id];
  const players = { ua: { name: "Korbi", slot: 0 }, ub: { name: "Sarah", slot: 1 }, uc: { name: "Tom", slot: 2 } };
  let g = T.freshTable(players, { people: T.peopleFor({ people: 3 }), mode: "trade", seed: 3, set: ["q-city", "q-year", "q-city"], now: 1000 });
  const kept = () => { const r = roundTrip(g); const ok = same(r, g); g = r; return ok; };
  check([undefined, { people: 4 }, { people: 12 }].map(T.peopleFor).join() === "2,4,6" && g.mode === "ranges" && g.phase === "quote" && T.isTable(g) && kept(),
    "a table of three plays ranges even when trade is asked for; it keeps as many seats as the party asked for, up to six");
  const all = [0, 1, 2], at = { seed: 3, index: 0 };
  check(T.quoteIn(g, 0, { bid: 35, ask: 40 }, at, all, 2000, questionOf) && !T.quoteIn(g, 0, { bid: 1, ask: 2 }, at, all, 2100, questionOf)
    && !T.quoteIn(g, 1, { bid: 50, ask: 40 }, at, all, 2200, questionOf) && !T.quoteIn(g, 1, { bid: NaN, ask: 40 }, at, all, 2200, questionOf) && kept(),
    "a market goes in once per player, and only a sound one");
  check(T.quoteIn(g, 1, { bid: 20, ask: 60 }, at, all, 3000, questionOf) && g.phase === "quote" && T.waitingFor(g, all).join() === "2" && T.waitingFor(g, [0, 1]).length === 0,
    "two of three quoted: the table waits for the third, unless the third is away");
  check(T.graceAt(g, all) === 33000 && !T.revealNow(g, all, 32999, questionOf) && T.revealNow(g, all, 33000, questionOf) && g.phase === "reveal" && kept(),
    "half a minute after the last market, those in may reveal without the one still to quote");
  const e0 = T.entryAt(g, 0), rows0 = T.placeRows(g, 0);
  check(e0.res.s0.delta === E.settle(city, 35, 40).delta && e0.res.s1.delta === E.settle(city, 20, 60).delta && e0.res.s0.grade === "S" && !e0.res.s2,
    `each market scored exactly as alone (35–40 S ${e0.res.s0.delta}, 20–60 B ${e0.res.s1.delta}); the one left out has none`);
  check(rows0.map(r => `${r.name}${r.none ? "-" : ""}`).join() === "Korbi,Sarah,Tom-" && !T.quoteIn(g, 2, { bid: 1, ask: 2 }, at, all, 33100, questionOf),
    "the reveal's order: the most points first, no market last; no market after the reveal");
  check(T.nextIn(g, 2, at, all, 34000) && T.nextIn(g, 0, at, all, 35000) && T.waitingFor(g, all).join() === "1" && !T.moveOnNow(g, all, 64999) && T.moveOnNow(g, all, 65000)
    && g.index === 1 && g.phase === "quote" && !g.nexts && kept(), "Next from everyone at the table, with the same grace for the last");
  // Sarah's phone sleeps: Korbi and Tom aren't kept waiting; she's back and the table waits for her Next
  const two = [0, 2], at1 = { seed: 3, index: 1 };
  check(T.quoteIn(g, 0, { bid: 1930, ask: 1939 }, at1, two, 40000, questionOf) && T.quoteIn(g, 2, { bid: 1800, ask: 1900 }, at1, two, 41000, questionOf) && g.phase === "reveal" && kept(),
    "someone away doesn't hold up the reveal");
  check(T.nextIn(g, 0, at1, all, 42000) && T.nextIn(g, 2, at1, all, 43000) && g.phase === "reveal" && !T.settleUp(g, all, 43100, questionOf) && T.settleUp(g, two, 43200, questionOf) && g.index === 2 && kept(),
    "back, she's waited for; gone again, the table moves on by itself");
  check(T.quoteIn(g, 1, { bid: 30, ask: 45 }, { seed: 3, index: 2 }, [1], 50000, questionOf) && g.done && T.waitingFor(g, all).length === 0 && kept(), "the last question's reveal ends the set");
  const b = T.books(g), sd = T.standingRows(g, 2);
  check(b.s0 === E.START + E.settle(city, 35, 40).delta + E.settle(year, 1930, 1939).delta && b.s2 === E.START + E.settle(year, 1800, 1900).delta
    && sd.find(r => r.slot === 1).delta === E.settle(city, 30, 45).delta && sd.find(r => r.slot === 0).delta === 0,
    `the standings: each book from the 1,000 everyone starts with (Korbi ${b.s0}, Sarah ${b.s1}, Tom ${b.s2}), and the last question's change`);
  const r0 = T.resultOf(g, 0), r2 = T.resultOf(g, 2), top = Math.max(b.s0, b.s1, b.s2);
  check(r0.score === b.s0 && r0.won === (b.s0 === top) && !r2.won && r0.match === r2.match && T.resultOf({ ...g, done: false }, 0) === null, "the record: the top book wins, once the set is over");
  // a pair trading: the maker alternates, a trade settles between the two, either one's Next moves both on
  let p = T.freshTable({ ua: { name: "Korbi", slot: 0 }, ub: { name: "Sarah", slot: 1 } }, { people: T.peopleFor(null), mode: "trade", seed: 4, set: ["q-city", "q-year"], now: 1 });
  const pk = () => { const r = roundTrip(p); const ok = same(r, p); p = r; return ok; };
  const t0 = { seed: 4, index: 0 };
  check(p.mode === "trade" && p.phase === "make" && T.makerOf(p) === 0 && !T.makeIn(p, 1, { bid: 50, ask: 60 }, t0) && T.makeIn(p, 0, { bid: 50, ask: 60 }, t0) && p.phase === "take" && pk(),
    "a pair can trade: the first question's market is the first seat's to make");
  check(!T.takeIn(p, 0, "hit", qs["q-city"], 2) && T.takeIn(p, 1, "hit", qs["q-city"], 2) && p.phase === "reveal" && pk(), "the other takes it");
  const tr = E.trade(city, 50, 60, "hit"), pb = T.books(p);
  check(pb.s0 === E.START + tr.maker && pb.s1 === E.START + tr.taker && T.placeRows(p, 0).every(r => r.none), `a trade settles between the two (Sarah hit 50 on 37: ${tr.taker}, Korbi ${tr.maker})`);
  check(T.nextTrade(p, t0) && p.index === 1 && p.phase === "make" && T.makerOf(p) === 1 && T.makeIn(p, 1, { bid: 1930, ask: 1940 }, { seed: 4, index: 1 })
    && T.takeIn(p, 0, "pass", qs["q-year"], 3) && p.done && T.books(p).s1 === pb.s1 + E.settle(year, 1930, 1940).delta && pk(),
    "the maker alternates; a pass settles the maker alone; the last trade ends the set");
  check(T.newSet(p, { seed: 5, set: ["q-city"], mode: "ranges" }) && p.mode === "ranges" && p.phase === "quote" && !p.log && !p.market && pk()
    && T.newSet(p, { seed: 6, set: ["q-city"], mode: "trade" }) && p.mode === "trade" && p.phase === "make",
    "a pair can switch between ranges and trade, a fresh set either way");
}

console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
