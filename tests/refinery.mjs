// Refinery: the data hangs together, the LP and the engine agree, every level is solvable in spec with par above its
// start, par as written in refinery-par.js is still what the solver finds (node tests/refinery.mjs --write-par writes
// it again after a change to the data or the levels), the chemistry behaves, and every lesson and exam builds.
import fs from "node:fs";
const D = await import("../refinery-data.js");
const E = await import("../refinery-engine.js");
const { simplex } = await import("../refinery-lp.js");
const { LEVELS, CHAPTERS } = await import("../refinery-levels.js");
const WRITE = process.argv.includes("--write-par");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the data ----------
{
  let problems = [];
  for (const [u, def] of Object.entries(D.UNITS)) {
    for (const f of def.feeds) if (!D.STREAMS[f]) problems.push(`${u} feeds unknown ${f}`);
    for (const [f, y] of Object.entries(def.yields || {})) {
      if (!def.feeds.includes(f)) problems.push(`${u} yields for a feed it doesn't take: ${f}`);
      for (const o of Object.keys(y)) if (!D.STREAMS[o]) problems.push(`${u} yields unknown ${o}`);
    }
    if (D.POOLS[u]) problems.push(`unit ${u} shares its name with a pool`);
  }
  for (const [p, def] of Object.entries(D.POOLS)) {
    for (const s of def.accept) if (!D.STREAMS[s]) problems.push(`${p} accepts unknown ${s}`);
    for (const k of Object.keys(def.spec || {})) if (!D.PROPS[k]) problems.push(`${p} has a spec on unknown ${k}`);
    if (def.fallback && !D.POOLS[def.fallback]) problems.push(`${p} falls back to unknown ${def.fallback}`);
  }
  for (const [c, def] of Object.entries(D.CRUDES)) { const sum = Object.values(def.cuts).reduce((a, b) => a + b, 0); if (Math.abs(sum - 1) > 0.001) problems.push(`${c} cuts sum to ${sum}`); }
  // every producer of a stream comes before every unit that takes it, so a unit's feeds are complete when it runs
  for (const u of E.ORDER) for (const f of D.UNITS[u].feeds) for (const m of E.ORDER) if (D.UNITS[m].yields && Object.values(D.UNITS[m].yields).some(y => f in y) && E.ORDER.indexOf(m) >= E.ORDER.indexOf(u)) problems.push(`${m} makes ${f} but runs after ${u}, which takes it`);
  // and so in every level that gives a unit its own feeds or yields (a whole refinery's chapter)
  for (const lv of LEVELS) if (lv.feeds || lv.yields) for (const u of lv.units) for (const o of Object.keys(Object.assign({}, ...Object.values(E.unitYields(lv, u))))) for (const m of lv.units) if (E.feedsOf(lv, m).includes(o) && E.ORDER.indexOf(m) <= E.ORDER.indexOf(u)) problems.push(`${lv.id}: ${u} makes ${o} but runs after ${m}, which takes it`);
  // a stream a pool takes has every property the pool is judged on (or one that's zero when missing)
  for (const [p, def] of Object.entries(D.POOLS)) for (const s of def.accept) for (const k of Object.keys(def.spec || {})) {
    const zero = ["arom", "olef", "benz", "oxy", "etoh", "ether", "fame", "grade", "asph", "bio", "s", "e360"].includes(k);
    if (!zero && D.STREAMS[s].p[k] == null && !(D.STREAMS[s].sr && k === "s")) problems.push(`${p} judges ${k}, which ${s} doesn't have`);
  }
  // the straight-run sulphur adds up to the crude's assay (within a fifth)
  for (const [c, def] of Object.entries(D.CRUDES)) {
    const L = { crude: c, units: ["cdu"] };
    let mass = 0, s = 0;
    for (const [cut, f] of Object.entries(def.cuts)) { const p = E.ownProps(L, cut); if (!p.d) continue; mass += f * p.d; s += f * p.d * (p.s || 0); }
    const pct = s / mass / 10000;
    if (Math.abs(pct / def.sulphur - 1) > 0.2) problems.push(`${c}: its cuts hold ${pct.toFixed(2)}% sulphur against an assay of ${def.sulphur}%`);
  }
  check(!problems.length, `data: units, streams, pools and crudes agree${problems.length ? `\n     ${problems.join("\n     ")}` : ""}`);
}

// ---------- the LP ----------
{
  const r = simplex(2, [3, 5], [{ a: { 0: 1 }, op: "<=", b: 4 }, { a: { 1: 2 }, op: "<=", b: 12 }, { a: { 0: 3, 1: 2 }, op: "<=", b: 18 }]);
  const r2 = simplex(2, [-2, -3], [{ a: { 0: 1, 1: 1 }, op: ">=", b: 4 }, { a: { 0: 1, 1: 3 }, op: ">=", b: 6 }]);
  const r3 = simplex(1, [1], [{ a: { 0: 1 }, op: "<=", b: 1 }, { a: { 0: 1 }, op: ">=", b: 2 }]);
  check(Math.abs(r.value - 36) < 1e-9 && Math.abs(r.duals[1] - 1.5) < 1e-9 && Math.abs(r.duals[2] - 1) < 1e-9 && Math.abs(r2.value + 9) < 1e-9 && Math.abs(r2.duals[0] + 1.5) < 1e-9 && r3.status === "infeasible",
    "the simplex solves textbook LPs, with their duals, and knows an infeasible one");
}

// ---------- every level: solvable in spec, par above the start, par as written ----------
const PAR_FILE = new URL("../refinery-par.js", import.meta.url);
// the plans kept are read even when writing: each is a start for the solver, so a plan once found is never lost to a
// search that wandered elsewhere (11.5 on Arab Heavy lost a dollar a barrel that way)
const { PAR } = await import("../refinery-par.js");
const fresh = {};
{
  const notes = [], stale = [];
  for (const lv of LEVELS) {
    fresh[lv.id] = {};
    for (const crude of lv.crudes || [lv.crude]) for (const deck of lv.decks || [null]) {
      const key = deck ? `${crude}/${deck.id}` : crude;
      const kept = PAR[lv.id]?.[key], L = E.asPlayed(lv, crude, deck?.id), start = E.evaluate(L, E.defaultRouting(L)), par = E.solve(L, { starts: kept ? [kept.routing] : [] });
      const ok = Object.values(par.result.pools).every(p => p.inSpec || p.vol < 1e-4) && !par.result.issues.some(i => ["sru", "lost", "h2short"].includes(i.kind));
      // the routing kept to six decimals: a share is a slider's step at most
      const routing = Object.fromEntries(Object.entries(par.routing).filter(([s]) => par.result.streams[s]).map(([s, r]) => [s, Object.fromEntries(Object.entries(r).filter(([, f]) => f > 1e-5).map(([d, f]) => [d, +f.toFixed(6)]))]));
      const rerun = E.evaluate(L, routing);
      // the plan's marginal values, for the levels that teach them: a barrel more of each stream, of each unit's capacity
      const values = Object.fromEntries(Object.entries(par.values).filter(([s]) => par.result.streams[s]).map(([s, v]) => [s, +v.toFixed(2)]));
      const capacity = Object.fromEntries(Object.entries(par.capacity).map(([u, v]) => [u, +v.toFixed(2)]));
      fresh[lv.id][key] = { margin: +rerun.margin.toFixed(4), routing, ...(lv.values ? { values, capacity } : {}) };
      notes.push(`${lv.id}${lv.crudes || lv.decks ? `/${key}` : ""}: ${start.margin.toFixed(2)} → ${rerun.margin.toFixed(2)}`);
      if (!ok || !(rerun.margin > start.margin + 0.5 || lv.crudes || lv.decks)) { bad++; console.log(`FAIL level ${lv.id} [${key}]: ${ok ? "par barely beats its start" : "par isn't in spec"} (${start.margin.toFixed(2)} → ${par.margin.toFixed(2)})`, par.result.issues.map(i => i.text)); }
      if (!WRITE && (!kept || Math.abs(E.evaluate(L, kept.routing).margin - kept.margin) > 0.01 || rerun.margin > kept.margin + 0.05)) stale.push(`${lv.id}/${key}`);
    }
  }
  check(true, `levels: start → par in $/bbl (${notes.join(", ")})`);
  if (WRITE) {
    fs.writeFileSync(PAR_FILE, `// Refinery's par for every level and crude: the LP's plan, worked out by tests/refinery.mjs --write-par (rerun it after
// changing the data or a level; the test fails while this is stale). { level: { crude, or crude/market for a level with
// markets: { margin, routing, and for a level that shows them, its marginal values and capacities' shadow prices } } }.
export const PAR = ${JSON.stringify(fresh)};\n`);
    console.log("wrote refinery-par.js");
  } else check(!stale.length, `par as written in refinery-par.js is still the solver's${stale.length ? ` (stale: ${stale.join(", ")}: run node tests/refinery.mjs --write-par)` : ""}`);
}

// ---------- the chemistry ----------
{
  const L = { crude: "urals", units: ["cdu", "merox", "kht", "nht", "reformer", "dht", "sru"] };
  const raw = E.evaluate(L, { ...E.defaultRouting(L), lgo: "diesel", kero: "jet", hsr: "gasoline" });
  const treated = E.evaluate(L, { ...E.defaultRouting(L), lgo: "dht", hgo: "dht", kero: "kht", hsr: "nht", hsrT: "reformer" });
  const sweet = E.evaluate(L, { ...E.defaultRouting(L), kero: "merox" });
  check(!raw.pools.diesel.inSpec && !raw.pools.jet.inSpec && !raw.pools.gasoline.inSpec && treated.pools.diesel.props.s <= 10 && treated.pools.jet.inSpec && treated.pools.gasoline.inSpec && treated.h2.made > 0 && treated.sulphur.removed > 20 && !sweet.pools.jet.inSpec,
    `untreated gas oil, kerosene and naphtha are off spec; treated and reformed they're in (diesel ${treated.pools.diesel.props.s.toFixed(0)} ppm, gasoline RON ${treated.pools.gasoline.props.ron.toFixed(1)}); the treaters strip ${treated.sulphur.removed.toFixed(0)} t/d of sulphur; Urals kerosene merely sweetened stays over Jet A-1's 0.3% (${(sweet.pools.jet.props.s / 10000).toFixed(2)}%)`);
  const H = { crude: "arabLight", units: ["cdu", "vdu", "fcc", "hcu", "smr", "dht", "sru"] };
  const fcc = E.evaluate(H, { ...E.defaultRouting(H), atmResid: "vdu", lvgo: "fcc", hvgo: "fcc" }), hcu = E.evaluate(H, { ...E.defaultRouting(H), atmResid: "vdu", lvgo: "hcu", hvgo: "hcu" });
  const out = Object.values(hcu.units.hcu.outputs).reduce((a, b) => a + b, 0) / hcu.units.hcu.feed, fout = Object.values(fcc.units.fcc.outputs).reduce((a, b) => a + b, 0) / fcc.units.fcc.feed;
  check(out > 1.08 && fout > 1 && hcu.h2.used > 40 && fcc.h2.used < 1 && fcc.units.fcc.outputs.catNaphtha > fcc.units.fcc.outputs.lco,
    `the hydrocracker swells its feed by ${((out - 1) * 100).toFixed(0)}% and eats ${hcu.h2.used.toFixed(0)} MMscf/d of hydrogen; the FCC swells it by ${((fout - 1) * 100).toFixed(0)}% with none, making more naphtha than cycle oil`);
  // blending: a mass property blends by mass, vapour pressure by its index, viscosity by Refutas
  const V = { crude: "urals", units: ["cdu", "vdu"], specs: { hsfo: ["s", "visc", "d"] } };
  const vr = E.evaluate(V, { ...E.defaultRouting(V), atmResid: "vdu", vacResid: "hsfo", lvgo: "hsfo", hvgo: "hsfo" });
  const ar = E.evaluate(V, { ...E.defaultRouting(V), atmResid: "hsfo" });
  check(vr.pools.hsfo.props.visc < 3000 && vr.pools.hsfo.props.visc > ar.pools.hsfo.props.visc * 0.5 && Math.abs(D.fromIndex("visc", D.toIndex("visc", 380)) - 380) < 1e-6 && Math.abs(D.fromIndex("rvp", D.toIndex("rvp", 60)) - 60) < 1e-9 && Math.abs(D.fromIndex("flash", D.toIndex("flash", 60)) - 60) < 1e-6,
    `residue and its gas oils blend back to a viscosity near the atmospheric residue's (${Math.round(vr.pools.hsfo.props.visc)} against ${Math.round(ar.pools.hsfo.props.visc)} cSt); the indices invert`);
}

// ---------- a slider's spec edges ----------
{
  const problems = [], atPar = id => { const lv = LEVELS.find(l => l.id === id), L = E.asPlayed(lv, lv.crude); return { L, routing: E.normalise(L, PAR[id][lv.crude].routing), par: PAR[id][lv.crude].margin }; };
  // a share set, the others keep their proportions; with none, the rest goes to the stream's home
  const L1 = LEVELS.find(l => l.id === "11.3"), sh = E.shareTo(L1, "lgo", { dht: 0.6, dht2: 0.3, diesel: 0.1 }, "dht", 0.2), alone = E.shareTo(L1, "lgo", { dht: 1 }, "dht", 0.25);
  if (Math.abs(sh.dht2 / sh.diesel - 3) > 1e-9 || Math.abs(sh.dht2 + sh.diesel - 0.8) > 1e-9 || alone[E.homeOf(L1, "lgo")] !== 0.75) problems.push(`shareTo: ${JSON.stringify(sh)}, ${JSON.stringify(alone)}`);
  // every edge stops on its better side, earning what that side does
  const along = (id, s, d, options) => {
    const { L, routing, par } = atPar(id), list = E.breaksOf(L, routing, s, d, options);
    for (const b of list) {
      const r = E.evaluate(L, { ...routing, [s]: E.shareTo(L, s, routing[s], d, b.at) });
      if (Math.abs(r.margin - Math.max(b.below, b.above)) > 1e-3 || (b.better < 0 ? b.at > b.lo + 1e-9 : b.at < b.hi - 1e-9)) problems.push(`${id} ${s}>${d}: the edge at ${(b.at * 100).toFixed(3)}% earns ${r.margin.toFixed(3)}, its better side ${Math.max(b.below, b.above).toFixed(3)}`);
    }
    return { list, share: routing[s][d], par };
  };
  // 11.3's two diesel hydrotreaters are each full on either side of par: a spec window a few thousandths of a per cent
  // wide that no sample lands in (par's share is 62.5%, so not a 32nd: 31 samples), found by the treaters' limits that
  // bound it, and par sits in it
  const lgo = along("11.3", "lgo", "dht", { samples: 31 }), inWindow = lgo.list.find(b => Math.abs(b.at - lgo.share) < 1e-4);
  if (!inWindow || Math.abs(Math.max(inWindow.below, inWindow.above) - lgo.par) > 1e-3) problems.push(`11.3: no edge at par's ${(lgo.share * 100).toFixed(2)}% of light gas oil to the DHT (${lgo.list.map(b => (b.at * 100).toFixed(3)).join(", ")})`);
  const wide = E.edgesOf(lgo.list, 0.002).find(e => Math.abs(e.at - lgo.share) < 1e-3);
  if (!wide || !(wide.left >= 0.05 && wide.right >= 0.05)) problems.push(`11.3: par's window, seen from afar, should be one edge that loses either way (${JSON.stringify(wide)})`);
  // 12.2's tallow in the diesel hydrotreater: too little and the diesel's FAME is over 7%, too much and its CFPP over −10 °C
  const tallow = along("12.2", "tallow", "dht"), named = tallow.list.map(b => b.pools.map(p => `${p.was}:${p.specs.join("+")}`).join()).join(" ");
  if (tallow.list.length !== 2 || tallow.list[0].better !== 1 || tallow.list[1].better !== -1 || named !== "diesel:fame diesel:cfpp" || !(tallow.list[0].at < tallow.share && tallow.share < tallow.list[1].at)) problems.push(`12.2: tallow to the DHT should break on the diesel's FAME below par and its CFPP above (${named}; ${tallow.list.map(b => (b.at * 100).toFixed(2)).join(", ")} around par's ${(tallow.share * 100).toFixed(2)})`);
  check(!problems.length, `a slider's spec edges: found to a millionth, each stopping on its better side, named by the grade and spec that break${problems.length ? `\n     ${problems.join("\n     ")}` : ""}`);
}

// ---------- what puts a product off spec ----------
{
  // a tenth of the light gas oil sent to diesel untreated: its sulphur is the miss, the worst first, and taking out what
  // the culprits say brings the diesel to its limit exactly
  const L = { crude: "urals", units: ["cdu", "merox", "kht", "nht", "reformer", "dht", "sru"] };
  const r = { ...E.defaultRouting(L), lgo: { dht: 0.9, diesel: 0.1 }, hgo: "dht", kero: "kht", hsr: "nht", hsrT: "reformer" };
  const R = E.evaluate(L, r), why = E.culprits(L, R, "diesel"), s = why[0], lgo = s?.by.find(c => c.s === "lgo"), vol = R.streams.lgo.vol;
  const fixed = lgo && E.evaluate(L, { ...r, lgo: { dht: 0.9, diesel: 0.1 - lgo.out / vol, gasoil: lgo.out / vol } });
  check(s?.k === "s" && lgo?.share > 0.99 && s.by.every(c => c.v > 10) && Math.abs(fixed?.pools.diesel.props.s - 10) < 1e-6 && E.failText({ k: "cet", v: 50.97, lim: 51, dir: "min" }) === "cetane 50.97 under 51.0",
    `what puts a product off spec: diesel with untreated gas oil misses on sulphur first (${s && E.failText(s)}), the gas oil all of it, and taking out ${lgo?.out.toFixed(2)} kb/d of it meets 10 ppm (${fixed?.pools.diesel.props.s.toFixed(4)}); a miss finer than its figures is told to more places`);
}

// ---------- the lessons, the scenes and the exams ----------
{
  const lessons = await import("../refinery-lessons.js").catch(() => null), exam = await import("../refinery-exam.js").catch(() => null);
  if (!lessons || !exam) check(false, "lessons and exams load");
  else {
    const problems = [];
    for (const lv of LEVELS) {
      const steps = lessons.lessonFor(lv);
      if (steps.length < 2 || !steps[steps.length - 1].task) problems.push(`${lv.id}: a lesson needs steps and its task last`);
      if (!lessons.TEACHES[lv.id]) problems.push(`${lv.id}: no line for the course map`);
      for (const st of steps) if (!st.say || !st.scene) problems.push(`${lv.id}: a step without words or a picture`);
      const key = lv.decks ? `${lv.crude}/${lv.decks[0].id}` : lv.crude, L = E.asPlayed(lv);
      const res = E.evaluate(L, fresh[lv.id]?.[key]?.routing || PAR[lv.id]?.[key]?.routing || E.defaultRouting(L));
      for (const seed of [1, 2, 3]) {
        const qs = exam.buildTest(L, res, { seed });
        if (qs.length < 6 || qs.length > 12) problems.push(`${lv.id}: ${qs.length} questions`);
        for (const q of qs) {
          const right = q.kind === "choice" ? q.answer : q.kind === "number" ? String(q.answer) : q.kind === "word" ? q.answer : q.kind === "tap" ? q.answer[0] : q.items;
          if (!exam.isRight(q, right)) problems.push(`${lv.id}: right answer judged wrong: ${q.ask}`);
          if (q.kind === "choice") {
            if (new Set(q.options).size !== q.options.length) problems.push(`${lv.id}: repeated options: ${q.ask}`);
            for (let i = 0; i < q.options.length; i++) if (i !== q.answer && exam.isRight(q, i)) problems.push(`${lv.id}: a wrong option judged right: ${q.ask}`);
            // the right option mustn't stand out as the longest by far, or the only one with a figure
            const lens = q.options.map(o => o.length), rightLen = lens[q.answer], others = lens.filter((_, i) => i !== q.answer);
            if (q.options.length > 2 && rightLen > Math.max(...others) * 1.6 && rightLen > 30) problems.push(`${lv.id}: the right option is the longest by far: ${q.ask}`);
            const digit = o => /\d/.test(o);
            if (q.options.length > 2 && digit(q.options[q.answer]) && q.options.filter(digit).length === 1) problems.push(`${lv.id}: only the right option has a figure: ${q.ask}`);
          }
          if (q.kind === "number" && exam.isRight(q, String(q.answer * 1.5 + 7))) problems.push(`${lv.id}: a wrong number judged right: ${q.ask}`);
        }
      }
    }
    // a lesson's figure that par decides: a barrel of VGO in 8.3's hydrocracker is worth its price and the unit's shadow price
    const p83 = fresh["8.3"]?.[LEVELS.find(l => l.id === "8.3").crude];
    if (p83 && Math.abs(p83.capacity.hcu + LEVELS.find(l => l.id === "8.3").prices.importVgo - lessons.VGO_IN_HCU) > 1.5) problems.push(`8.3: the lesson says VGO earns $${lessons.VGO_IN_HCU} in the hydrocracker; par says $${(p83.capacity.hcu + LEVELS.find(l => l.id === "8.3").prices.importVgo).toFixed(2)}`);
    for (const [term, def] of lessons.GLOSSARY) if (def.toLowerCase().includes(term.toLowerCase().replace(/s$/, ""))) problems.push(`glossary: ${term}'s definition says its own word`);
    // the bank, every question of it and not only those dealt: tags that name what exists, and options that don't give
    // the answer away
    const { FACTS } = await import("../refinery-facts.js"), ids = new Set();
    for (const f of FACTS) {
      if (ids.has(f.id)) problems.push(`bank: ${f.id} twice`);
      ids.add(f.id);
      for (const t of [...f.on, ...(f.any || [])]) {
        const [kind, name] = t.split(":");
        const known = t === "*" || (kind === "u" && D.UNITS[name]) || (kind === "p" && D.POOLS[name]) || (kind === "b" && D.STREAMS[name]) || (kind === "c" && CHAPTERS.some(c => String(c.id) === name)) || (kind === "k" && D.POOLS[name.split(".")[0]]?.spec?.[name.split(".")[1]]);
        if (!known) problems.push(`bank: ${f.id} is tagged ${t}, which names nothing`);
      }
      if (!LEVELS.some(lv => exam.dealtFrom(lv, f.id))) problems.push(`bank: ${f.id} fits no level`);
      if (f.kind === "number") continue;
      const options = [f.right, ...f.wrongs], lens = options.map(o => o.length), digit = o => /\d/.test(o);
      if (new Set(options).size !== options.length) problems.push(`bank: ${f.id} repeats an option`);
      if (f.right.length > Math.max(...lens.slice(1)) * 1.6 && f.right.length > 30) problems.push(`bank: ${f.id}'s right option is the longest by far`);
      if (digit(f.right) && options.filter(digit).length === 1) problems.push(`bank: only ${f.id}'s right option has a figure`);
    }
    check(!problems.length, `lessons and exams: every level's lesson ends in its task, every exam (dealt three times) holds 6–12 questions whose right answers are right and wrong ones wrong, none giving itself away${problems.length ? `\n     ${problems.slice(0, 30).join("\n     ")}` : ""}`);
    check(CHAPTERS.every(c => LEVELS.some(l => l.chapter === c.id)), "every chapter has levels");
  }
}

console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
