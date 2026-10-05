const R = await import("../refinery-engine.js");
const D = await import("../refinery-data.js");
const { LEVELS } = await import("../refinery-levels.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
// the data is consistent: every yield names a stream, every feed is a stream, every pool accepts streams that exist, crude cuts sum to one
let problems = 0;
for (const [u, def] of Object.entries(D.UNITS)) {
  for (const f of def.feeds) if (!D.STREAMS[f]) { problems++; console.log(u, "feeds unknown", f); }
  for (const [f, y] of Object.entries(def.yields || {})) { if (!def.feeds.includes(f)) { problems++; console.log(u, "yields for a feed it doesn't take", f); } for (const o of Object.keys(y)) if (!D.STREAMS[o]) { problems++; console.log(u, "yields unknown", o); } }
}
for (const [p, def] of Object.entries(D.POOLS)) for (const s of def.accept) if (!D.STREAMS[s]) { problems++; console.log(p, "accepts unknown", s); }
for (const [c, def] of Object.entries(D.CRUDES)) { const sum = Object.values(def.cuts).reduce((a, b) => a + b, 0); if (Math.abs(sum - 1) > 0.001) { problems++; console.log(c, "cuts sum to", sum); } }
check(problems === 0, "data: units, yields, pools and crudes agree");
// every level: the default routing runs, par beats it, par's pools are in spec, and every stream has somewhere to go
const pars = [];
for (const L of LEVELS) {
  const def = R.evaluate(L, R.defaultRouting(L)), par = R.solve(L, 4), best = R.evaluate(L, par.routing);
  const none = R.streamsOf(L).filter(s => !R.destinations(L, s).length);
  pars.push(`${L.id}: ${def.margin.toFixed(1)} → ${par.margin.toFixed(1)}`);
  if (!(par.margin > def.margin + 1) || none.length) { bad++; console.log("level", L.id, "default", def.margin.toFixed(2), "par", par.margin.toFixed(2), "unroutable", none); }
  const offSpec = Object.entries(best.pools).filter(([p, x]) => !x.inSpec && x.vol > 0.5);
  if (offSpec.length) console.log(`  level ${L.id} par leaves off-spec pools:`, offSpec.map(([p, x]) => `${p} (${x.fails.join("; ")}) → ${x.soldAs}`).join(" | "));
}
check(bad === 0, `levels: par beats the default on every level (${pars.join(", ")} $/bbl)`);
// the chemistry: treating puts sulphur in spec, reforming lifts octane and makes hydrogen, the hydrocracker swells
{
  const L = LEVELS[0];
  const naive = R.evaluate(L, { ...R.defaultRouting(L), lgo: "diesel", kero: "jet", hsr: "gasoline" });
  check(!naive.pools.diesel.inSpec && naive.pools.diesel.soldAs !== "diesel" && !naive.pools.gasoline.inSpec && naive.pools.jet === undefined,
    `untreated gas oil sinks the diesel pool (sold as ${naive.pools.diesel.soldAs}), raw naphtha can't make gasoline, raw kerosene isn't jet`);
  const good = R.evaluate(L, { ...R.defaultRouting(L), lgo: "dht", hgo: "dht", kero: "kht", hsr: "nht", hsrT: "reformer", lsr: "naphtha" });
  const withLsr = R.evaluate(L, { ...R.defaultRouting(L), lgo: "dht", hgo: "dht", kero: "kht", hsr: "nht", hsrT: "reformer", lsr: "gasoline" });
  check(good.pools.diesel.inSpec && good.pools.jet.inSpec && good.h2.made > good.h2.used * 0.8 && good.pools.gasoline.inSpec && !withLsr.pools.gasoline.inSpec && good.margin > 0 && good.pools.fuelOil.inSpec,
    `treated and reformed: diesel (cetane ${good.pools.diesel.cet.toFixed(1)}) and jet in spec, reformate alone makes gasoline (RON ${good.pools.gasoline.ron.toFixed(0)}) while light naphtha in the pool sinks it to ${withLsr.pools.gasoline.ron.toFixed(1)}, the reformer's hydrogen covers the treaters (${good.h2.made.toFixed(1)} made, ${good.h2.used.toFixed(1)} used MMscf/d), margin ${good.margin.toFixed(1)} $/bbl; sweet residue makes VLSFO at ${(good.pools.fuelOil.s / 10000).toFixed(2)}% sulphur`);
  const L5 = LEVELS[4];
  const allFcc = R.evaluate(L5, { ...R.solve(L5, 2).routing, lvgo: "fcc", hvgo: "fcc" }), allHcu = R.evaluate(L5, { ...R.solve(L5, 2).routing, lvgo: "hcu", hvgo: "hcu" });
  const hcuOut = Object.values(allHcu.units.hcu.outputs).reduce((a, b) => a + b, 0), hcuIn = allHcu.units.hcu.feed;
  check(hcuOut > hcuIn * 1.05 && allHcu.h2.used > allFcc.h2.used * 2 && (allHcu.pools.diesel?.vol || 0) > (allFcc.pools.diesel?.vol || 0),
    `the hydrocracker swells its feed by ${((hcuOut / hcuIn - 1) * 100).toFixed(0)}%, uses ${allHcu.h2.used.toFixed(0)} MMscf/d of hydrogen against the FCC route's ${allFcc.h2.used.toFixed(0)}, and makes more diesel`);
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
