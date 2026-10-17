// Arb: the knowledge base's links make a graph with enough ends (things with a few links), routes three to five hops
// long exist for every seed tried, a hub costs far more to step onto than an obscure thing, and a run deals from your
// mix of topics: every topic in deals as it always did, an end is never only about topics out, a topic more ends
// routes more often, a mix that leaves nothing deals from everything, and a match's link carries its mix whole.
// Run: node tests/arb.mjs
import { NEAR, ENDS, ABOUT, degree, cost, dealRun, drawEnd, endWeight, TOPIC_LIST, TOPIC_PRESETS, PER_RUN } from "../arb-engine.js";
import { mixParam, mixFromParam, presetOf } from "../topics.js";
let bad = 0;
const fail = (...why) => { bad++; console.log(...why); };

// ---------- the graph ----------
function hopsFrom(a) {
  const h = new Map([[a, 0]]), q = [a];
  while (q.length) { const u = q.shift(); for (const v of NEAR.get(u)?.keys() || []) if (!h.has(v)) { h.set(v, h.get(u) + 1); q.push(v); } }
  return h;
}
let made = 0;
for (let i = 0; i < 20; i++) {
  const a = ENDS[(i * 7919) % ENDS.length], h = hopsFrom(a);
  if (ENDS.some(b => b !== a && h.get(b) >= 3 && h.get(b) <= 5)) made++;
}
if (ENDS.length < 300) fail("too few ends", ENDS.length);
if (made < 18) fail("routes found for only", made, "of 20 starts");
const hub = [...NEAR.keys()].sort((p, q) => degree(q) - degree(p))[0];
if (!(cost(hub) > 7 && cost(ENDS[0]) < 6)) fail("costs", cost(hub), cost(ENDS[0]));
const untopical = ENDS.filter(id => !ABOUT.get(id)?.size);
if (untopical.length) fail("ends about no topic, in whatever the mix:", untopical.slice(0, 5).join(" "));

// ---------- a run from a mix ----------
const mixOf = (base, over = {}) => ({ ...Object.fromEntries(TOPIC_LIST.map(([id]) => [id, base])), ...over });
const ends = run => run.routes.flatMap(r => [r.a, r.b]);
const about = (id, topics) => [...ABOUT.get(id)].some(t => topics.includes(t));
const seeds = [11, 23, 37, 41, 53, 67];
const runs = (w, list = seeds) => list.map(s => dealRun(s, false, w));

for (const r of runs(null, seeds.slice(0, 2))) {
  if (r.routes.length !== PER_RUN) fail("a run of", r.routes.length, "routes");
  for (const x of r.routes) if (!(x.parRoute.length - 1 >= 3 && x.parRoute.length - 1 <= 5 && x.parRoute[0] === x.a && x.parRoute.at(-1) === x.b)) fail("a route of", x.parRoute.length - 1, "hops", x.a, x.b);
}
// Balanced is no mix at all: the same routes, seed for seed, as before Arb had topics
if (seeds.slice(0, 2).some(s => JSON.stringify(dealRun(s, false, mixOf(1))) !== JSON.stringify(dealRun(s, false, null)))) fail("Balanced deals other routes than no mix");

// culture out: no end only about the arts
const ART = ["cult", "screen", "style"], noArt = mixOf(1, { cult: 0, screen: 0, style: 0 });
const onlyArt = runs(noArt).flatMap(ends).filter(id => [...ABOUT.get(id)].every(t => ART.includes(t)));
if (onlyArt.length) fail("ends only about topics out:", onlyArt.join(" "));
// one topic in, every other out: every end about it
const energy = mixOf(0, { nrg: 1 }), energyEnds = runs(energy, seeds.slice(0, 3)).flatMap(ends);
const offTopic = energyEnds.filter(id => !about(id, ["nrg"]));
if (offTopic.length) fail("with only Energy in, ends about other things:", offTopic.join(" "));
// a topic more: a thing about it weighs twice what it would in, so ends about it come nearly twice as often (an eighth
// of the things a route can end on are about history at all; run to run there are too few routes to see it)
const rand = (seed => () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296))(9);
const share = (w, n = 3000) => { let k = 0; for (let i = 0; i < n; i++) k += about(drawEnd(rand, ENDS, w), ["hist"]); return k / n; };
const hist = ENDS.filter(id => about(id, ["hist"])), p = hist.length / ENDS.length, histMore = mixOf(1, { hist: 2 });
const evenShare = share(null), moreShare = share(histMore);
if (!hist.every(id => endWeight(histMore, id) === 2)) fail("a thing about history not weighed twice with History more");
if (Math.abs(evenShare - p) > .025 || Math.abs(moreShare - 2 * p / (1 + p)) > .025) fail("History more:", moreShare.toFixed(3), "of ends about it, Balanced", evenShare.toFixed(3), "of", p.toFixed(3));
// a mix of nothing deals from everything rather than nothing
const empty = dealRun(5, false, mixOf(0));
if (empty.routes.length !== PER_RUN) fail("a mix with every topic out dealt", empty.routes.length, "routes");

// ---------- the mix as the menu and a match keep it ----------
for (const [k, preset] of Object.entries(TOPIC_PRESETS)) if (presetOf(TOPIC_LIST, TOPIC_PRESETS, preset.topics) !== k) fail("preset", k, "not known as itself");
const own = mixOf(1, { cult: 0, nrg: 2, mkts: 2, ppl: 0 });
if (presetOf(TOPIC_LIST, TOPIC_PRESETS, own) !== "custom") fail("an own mix taken for a preset");
if (JSON.stringify(mixFromParam(TOPIC_LIST, mixParam(TOPIC_LIST, own))) !== JSON.stringify(own)) fail("a match's mix changed on its way through the link");
if (JSON.stringify(dealRun(77, false, mixFromParam(TOPIC_LIST, mixParam(TOPIC_LIST, own)))) !== JSON.stringify(dealRun(77, false, own))) fail("a match deals other routes on the partner's phone");

console.log(bad ? `arb: ${bad} problems` : `arb: ${NEAR.size} linked things, ${ENDS.length} ends, routes for ${made} of 20 starts; a step onto ${hub} costs ${cost(hub).toFixed(1)}; History more puts it in ${Math.round(moreShare * 100)}% of ends (Balanced ${Math.round(evenShare * 100)}%), only Energy in, every end about energy`);
if (bad) process.exitCode = 1;
