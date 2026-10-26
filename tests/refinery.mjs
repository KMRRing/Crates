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
    const zero = ["arom", "olef", "benz", "oxy", "etoh", "ether", "fame", "grade", "asph", "bio", "s"].includes(k);
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
const { PAR } = WRITE ? { PAR: {} } : await import("../refinery-par.js");
const fresh = {};
{
  const notes = [], stale = [];
  for (const lv of LEVELS) {
    fresh[lv.id] = {};
    for (const crude of lv.crudes || [lv.crude]) for (const deck of lv.decks || [null]) {
      const key = deck ? `${crude}/${deck.id}` : crude;
      const L = { ...lv, crude, ...(deck ? { deck: deck.id, prices: { ...(lv.prices || {}), ...deck.prices } } : {}) }, start = E.evaluate(L, E.defaultRouting(L)), par = E.solve(L);
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
      const kept = PAR[lv.id]?.[key];
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
  check(vr.pools.hsfo.props.visc < 3000 && vr.pools.hsfo.props.visc > ar.pools.hsfo.props.visc * 0.5 && Math.abs(D.fromIndex("visc", D.toIndex("visc", 380)) - 380) < 1e-6 && Math.abs(D.fromIndex("rvp", D.toIndex("rvp", 60)) - 60) < 1e-9,
    `residue and its gas oils blend back to a viscosity near the atmospheric residue's (${Math.round(vr.pools.hsfo.props.visc)} against ${Math.round(ar.pools.hsfo.props.visc)} cSt); the indices invert`);
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
      const key = lv.decks ? `${lv.crude}/${lv.decks[0].id}` : lv.crude, L = { ...lv, crude: lv.crude, ...(lv.decks ? { deck: lv.decks[0].id, prices: { ...(lv.prices || {}), ...lv.decks[0].prices } } : {}) };
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
    check(!problems.length, `lessons and exams: every level's lesson ends in its task, every exam (dealt three times) holds 6–12 questions whose right answers are right and wrong ones wrong, none giving itself away${problems.length ? `\n     ${problems.slice(0, 30).join("\n     ")}` : ""}`);
    check(CHAPTERS.every(c => LEVELS.some(l => l.chapter === c.id)), "every chapter has levels");
  }
}

console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
