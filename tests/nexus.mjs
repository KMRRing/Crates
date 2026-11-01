// Nexus: the knowledge base's links make rounds of a nexus and a ring of candidates. A run is five rounds, the same for a
// seed; every candidate marked linked is linked to the nexus in the Almanac and every decoy is not (a clue that only
// loosely fits counts as neither); an Orbit has three to five links among eight to twelve, an Aspect round only those under
// one aspect (with the nexus's other links under other aspects among the decoys), an Intruder four links and one that
// isn't; decoys are mostly of the kind of the links, never hubs; a round is judged by what's found less what's wrongly
// picked; the pile's cards ask the right thing with the right answer; a mix of topics and the pile's wishes are kept.
// Run: node tests/nexus.mjs
import { LINKED, CENTRES, SIZES, PER_RUN, dealRun, judge, cardsFor, settles, reasonOf, askOf, barred, name, kind, ABOUT, TOPIC_LIST, ASPECT } from "../nexus-engine.js";
let bad = 0;
const fail = (...why) => { bad++; if (bad < 40) console.log(...why); };
const t0 = performance.now();

// ---------- the nexuses ----------
if (CENTRES.length < 800) fail("too few nexuses", CENTRES.length);
for (const c of CENTRES.slice(0, 200)) if ([...LINKED.get(c).keys()].length < 3) fail("a nexus of fewer than 3 links", c);

// ---------- a run ----------
const link = (a, b) => LINKED.get(a)?.has(b);
const seeds = n => Array.from({ length: n }, (_, i) => 1000 + i * 7919);
let same = 0, total = 0, strictSame = 0, strictTotal = 0, seenTypes = new Set();
for (const mode of ["mixed", "orbit", "aspect", "intruder"]) for (const size of SIZES) for (const seed of seeds(mode === "mixed" ? 14 : 5)) {
  const run = dealRun(seed, { mode, size });
  if (JSON.stringify(run) !== JSON.stringify(dealRun(seed, { mode, size }))) fail("a seed dealt two ways", mode, size, seed);
  if (run.rounds.length !== PER_RUN) { fail("a run of", run.rounds.length, "rounds", mode, size, seed); continue; }
  if (new Set(run.rounds.map(x => x.centre)).size !== PER_RUN) fail("a nexus twice in a run", mode, size, seed);
  for (const rd of run.rounds) {
    seenTypes.add(rd.type);
    if (mode !== "mixed" && rd.type !== mode) fail("a", rd.type, "round in", mode);
    const c = rd.centre, ids = rd.cands.map(x => x.id), names = rd.cands.map(x => name(x.id)), trues = rd.cands.filter(x => x.linked), odd = rd.cands.filter(x => !x.linked);
    if (new Set(ids).size !== ids.length || new Set(names).size !== names.length) fail("a candidate twice", c, names.join());
    if (ids.includes(c)) fail("the nexus among its candidates", c);
    if (rd.type === "intruder" ? rd.cands.length !== 5 : rd.cands.length !== size) fail("a ring of", rd.cands.length, rd.type, size);
    if (rd.type === "intruder" ? !(trues.length === 4 && odd.length === 1) : !(trues.length >= 3 && trues.length <= 5)) fail("a ring with", trues.length, "links", rd.type, c);
    for (const x of trues) if (!link(c, x.id)) fail("a link that isn't one:", c, x.id);
    const gone = barred(c);
    for (const x of odd) {
      if (x.near) { if (!link(c, x.id)) fail("a 'near' that isn't linked", c, x.id); continue; }
      if (gone.has(x.id)) fail("a decoy that is linked, or fits loosely:", c, x.id);
      if (x.home == null || !link(x.id, x.home)) fail("a decoy with no home", c, x.id, x.home);
      if ([...LINKED.get(x.id).keys()].length > 60) fail("a hub as a decoy", x.id);
      const kinds = new Set(trues.map(t => kind(t.id)));
      (rd.type === "intruder" ? (strictTotal++, kinds.has(kind(x.id)) && strictSame++) : (total++, kinds.has(kind(x.id)) && same++));
    }
    if (rd.type === "aspect") {
      if (!ASPECT.has(rd.aspect)) fail("an aspect with no name", rd.aspect);
      for (const x of trues) if (!(LINKED.get(c).get(x.id).from === x.id && LINKED.get(c).get(x.id).aspects.has(rd.aspect))) fail("an Aspect link not under its aspect", c, x.id);
      if (!odd.some(x => x.near)) fail("an Aspect round with no link under another aspect", c);
      for (const x of odd.filter(y => y.near)) if (LINKED.get(c).get(x.id).aspects.has(rd.aspect)) fail("a 'near' under the aspect", c, x.id);
      for (const x of odd.filter(y => !y.near)) if (!(LINKED.get(x.id).get(x.home).aspects.has(rd.aspect))) fail("an Aspect decoy not under the aspect", c, x.id);
    }
    const why = rd.cands.map(x => reasonOf(rd, x));
    if (why.some(w => !w.because)) fail("a candidate with no reason", c);
    if (!askOf(rd).includes(name(c))) fail("a question that doesn't name the nexus", askOf(rd));
  }
}
for (const t of ["orbit", "aspect", "intruder"]) if (!seenTypes.has(t)) fail("no", t, "round dealt");
if (same / total < 0.9) fail("decoys of the links' kind", (same / total).toFixed(2));
if (strictSame / strictTotal < 0.95) fail("intruders of the links' kind", (strictSame / strictTotal).toFixed(2));

// ---------- judging ----------
{
  const orbit = dealRun(5, { mode: "orbit", size: 10 }).rounds[0], links = orbit.cands.filter(x => x.linked).map(x => x.id), odd = orbit.cands.filter(x => !x.linked).map(x => x.id);
  const j = (...p) => judge(orbit, p).points;
  if (j(...links) !== 100 || j() !== 0) fail("perfect or nothing", j(...links), j());
  if (j(...links, odd[0]) !== Math.round(100 * (links.length - 1) / links.length)) fail("one wrong", j(...links, odd[0]));
  if (j(odd[0], odd[1]) !== 0) fail("only wrong picks score", j(odd[0], odd[1]));
  if (j(links[0]) !== Math.round(100 / links.length)) fail("one found", j(links[0]));
  const it = dealRun(5, { mode: "intruder" }).rounds[0], the = it.cands.find(x => !x.linked).id, other = it.cands.find(x => x.linked).id;
  if (judge(it, [the]).points !== 100 || judge(it, [other]).points !== 0 || judge(it, [the, other]).points !== 0 || judge(it, []).points !== 0) fail("an Intruder is right or wrong");
}

// ---------- the pile's cards ----------
let cards = 0;
for (const seed of seeds(22)) for (const rd of dealRun(seed, { mode: "mixed" }).rounds) {
  const linkIds = rd.cands.filter(x => x.linked).map(x => x.id), odd = rd.cands.filter(x => !x.linked).map(x => x.id);
  for (const picked of [[], linkIds.slice(1), [...linkIds, odd[0]], odd.slice(0, 1), linkIds]) {
    const made = cardsFor(rd, picked), j = judge(rd, picked);
    if (rd.type === "intruder" ? (made.length !== (j.perfect ? 0 : 1)) : (made.length !== (j.trues - j.hits > 0 ? j.trues - j.hits : (j.wrong ? (rd.type === "aspect" ? 1 : j.wrong) : 0)))) fail("cards for a round:", made.length, rd.type, j);
    for (const { key, why, payload: p } of made) {
      cards++;
      if (!key.startsWith(rd.centre) || !["miss", "wrong"].includes(why)) fail("a card's key or why", key, why);
      if (p.options.length < 4 || new Set(p.options).size !== p.options.length || p.options[p.right[0]] !== p.answer) fail("a card's options", p.options, p.answer);
      if (!p.about.every(id => name(id)) || p.about[0] !== rd.centre) fail("a card's about", p.about);
      const right = p.pick, others = p.options.filter(o => o !== p.answer);
      const idOf = o => rd.cands.find(x => name(x.id) === o)?.id;
      if (p.linked ? !link(rd.centre, right) : link(rd.centre, right) || barred(rd.centre).has(right)) fail("a card's answer", key, p.linked);
      for (const o of others) {
        const id = idOf(o);
        if (id == null) { fail("an option from nowhere", o); continue; }
        // the right answer is the only one that fits: a 'linked' card's others are not linked (under its aspect, for an Aspect round); a 'not linked' card's are all linked
        const fits = rd.type === "aspect" ? link(rd.centre, id) && LINKED.get(rd.centre).get(id).aspects.has(rd.aspect) : link(rd.centre, id);
        if (p.linked ? fits : !link(rd.centre, id)) fail("a card with two answers", key, o);
      }
      const back = settles(rd, picked, [{ key, payload: p }]);
      if (back.length !== 1 || back[0].key !== key || back[0].right !== (p.linked ? picked.includes(p.pick) : !picked.includes(p.pick))) fail("settling a card", key, back);
    }
  }
}
if (cards < 100) fail("too few cards tried", cards);

// ---------- what the pile asks again ----------
{
  const c = CENTRES[40], some = [...LINKED.get(c).keys()].filter(x => name(x).length < 30), want = some[0];
  const run = dealRun(9, { mode: "mixed", forced: [c], must: { [c]: { trues: [want] } } });
  if (run.rounds[0].centre !== c || run.rounds[0].type !== "orbit" || !run.rounds[0].cands.some(x => x.id === want && x.linked)) fail("a wish not dealt", c, want);
  const odd = run.rounds[0].cands.find(x => !x.linked).id;
  const again = dealRun(9, { mode: "orbit", forced: [c], must: { [c]: { falses: [odd] } } });
  if (again.rounds[0].centre !== c) fail("a forced nexus not first");
  const run2 = dealRun(9, { mode: "orbit", avoid: new Set(run.rounds.map(x => x.centre)) });
  if (run2.rounds.some(x => run.rounds.some(y => y.centre === x.centre))) fail("a nexus dealt lately dealt again");
}

// ---------- a mix of topics ----------
{
  const mixOf = (base, over = {}) => ({ ...Object.fromEntries(TOPIC_LIST.map(([id]) => [id, base])), ...over });
  const geo = mixOf(0, { geo: 1, hist: 1 }), onlyGeo = r => [...ABOUT.get(r.centre) || []].some(t => ["geo", "hist"].includes(t));
  let kept = 0, all = 0;
  for (const seed of seeds(10)) for (const rd of dealRun(seed, { mode: "orbit", weights: geo }).rounds) { all++; if (onlyGeo(rd)) kept++; }
  if (kept < all * 0.9) fail("a mix of two topics dealt", kept, "of", all, "from them");
  const nothing = dealRun(3, { mode: "orbit", weights: mixOf(0) });
  if (nothing.rounds.length !== PER_RUN) fail("a mix that leaves nothing deals nothing");
}
if (performance.now() - t0 > 8000) fail("too slow", Math.round(performance.now() - t0), "ms");
console.log(bad ? `${bad} failed` : `Nexus ok (${Math.round(performance.now() - t0)} ms)`);
process.exit(bad ? 1 : 0);
