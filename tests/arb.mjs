// Arb: the knowledge base's links make a graph with enough ends (things with a few links), routes three to five hops
// long exist for every seed tried, a hub costs far more to step onto than an obscure thing, and a run deals from a mix
// of topics: every topic in deals as it always did, an end is never only about topics out, a topic weighed twice ends
// routes more often, a mix that leaves nothing deals from everything, a match's link carries its mix whole, and the
// mix is made from the suite's one set of subjects (topicsOf): every subject on is the old Balanced, seed for seed,
// subjects off take their topics out, and nothing on deals every topic.
// Run: node tests/arb.mjs
import { NEAR, ENDS, ABOUT, degree, cost, dealRun, drawEnd, endWeight, bestOn, backOut, TOPIC_LIST, topicsOf, PER_RUN } from "../arb-engine.js";
import { mixParam, mixFromParam, cleanMix, cleanSubjects, subjectsIn, subjectsSay, SUBJECT_PRESETS, TOPIC_OF } from "../topics.js";
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

// ---------- the mix as a match keeps it ----------
// (a link from before topics were on or off may carry a weight of 2: it still deals)
const own = mixOf(1, { cult: 0, nrg: 2, mkts: 2, ppl: 0 });
if (JSON.stringify(mixFromParam(TOPIC_LIST, mixParam(TOPIC_LIST, own))) !== JSON.stringify(own)) fail("a match's mix changed on its way through the link");
if (JSON.stringify(dealRun(77, false, mixFromParam(TOPIC_LIST, mixParam(TOPIC_LIST, own)))) !== JSON.stringify(dealRun(77, false, own))) fail("a match deals other routes on the partner's phone");

// ---------- the suite's one set of subjects (topics.js, topics-on.js; Settings) ----------
{
  const on = cleanSubjects(null), none = cleanSubjects(SUBJECT_PRESETS.none.topics);
  const only = id => cleanSubjects({ ...SUBJECT_PRESETS.none.topics, [id]: 1 });
  const without = (...ids) => cleanSubjects(Object.fromEntries(ids.map(id => [id, 0])));
  if (TOPIC_LIST.some(([id]) => !TOPIC_OF.kb[id])) fail("a topic of Arb's belongs to no subject");
  // all on is the old Balanced: every topic in once, and the same routes, seed for seed (with no mix at all, and with
  // the mix the page used to read when nothing was kept)
  const all = topicsOf(on);
  if (JSON.stringify(all) !== JSON.stringify(cleanMix(TOPIC_LIST, null)) || !TOPIC_LIST.every(([id]) => all[id] === 1)) fail("all subjects on is not every topic in once");
  const base = seeds.slice(0, 2).map(s => JSON.stringify(dealRun(s, false, null)));
  seeds.slice(0, 2).forEach((s, i) => { if (JSON.stringify(dealRun(s, false, all)) !== base[i]) fail("all subjects on deals other routes than Balanced did, seed", s); });
  // a subject off takes its topics out (Literature, music & myth is cult, Film, TV & games screen, Craft & style style),
  // and the run is another one; the subjects Arb has no topic for (maths, cities...) change nothing
  const noArts = topicsOf(without("cult", "screen", "style"));
  if (!(noArts.cult === 0 && noArts.screen === 0 && noArts.style === 0 && noArts.geo === 1 && noArts.nrg === 1)) fail("subjects off did not take their topics out", JSON.stringify(noArts));
  const offRuns = runs(noArts, seeds.slice(0, 2));
  if (offRuns.flatMap(ends).some(id => [...ABOUT.get(id)].every(t => ART.includes(t)))) fail("an end only about subjects off");
  if (offRuns.every((r, i) => JSON.stringify(r) === base[i])) fail("subjects off dealt the same routes as all on");
  if (JSON.stringify(topicsOf(without("math", "cities", "rel", "art"))) !== JSON.stringify(all)) fail("a subject none of Arb's topics belongs to changed its mix");
  // one subject on, the rest off: every end about its topics (Energy is nrg alone)
  const nrgOnly = topicsOf(only("nrg"));
  if (TOPIC_LIST.some(([id]) => (nrgOnly[id] === 1) !== (id === "nrg"))) fail("only Energy on is not the energy topic alone", JSON.stringify(nrgOnly));
  const wrong = runs(nrgOnly, seeds.slice(0, 2)).flatMap(ends).filter(id => !about(id, ["nrg"]));
  if (wrong.length) fail("with only Energy on, ends about other things:", wrong.join(" "));
  // two subjects can share a topic's weight: Trade & shipping carries Production and Trade & logistics as well
  const trade = topicsOf(only("trade"));
  if (!(trade.trade === 1 && trade.prod === 1 && trade.logi === 1 && trade.hist === 0)) fail("Trade & shipping did not bring its commodity topics", JSON.stringify(trade));
  // nothing on: every topic is dealt (a mix of nothing deals from everything), as all on does, and the menu says so
  const nothing = topicsOf(none);
  if (TOPIC_LIST.some(([id]) => nothing[id] !== 0) || subjectsIn(none).length) fail("all subjects off is not nothing in");
  seeds.slice(0, 2).forEach((s, i) => { if (JSON.stringify(dealRun(s, false, nothing)) !== base[i]) fail("nothing on does not deal every topic, seed", s); });
  if (!/every topic/.test(subjectsSay(none))) fail("the topics line does not say nothing on deals every topic");
  // a match carries the dealer's mix whole: a custom set of subjects through the link deals the same on the partner's phone
  const custom = topicsOf(without("hist", "sport", "agr"));
  if (JSON.stringify(mixFromParam(TOPIC_LIST, mixParam(TOPIC_LIST, custom))) !== JSON.stringify(custom)) fail("a mix made from subjects changed on its way through the link");
  // a weight of 2 still draws twice (a saved or linked mix), and an old link of the Trader preset's weights still deals
  if (!hist.every(id => endWeight(mixOf(1, { hist: 2 }), id) === 2)) fail("a weight of 2 no longer weighs twice");
  const trader = mixOf(1, { nrg: 2, met: 2, agr: 2, mkt: 2, fin: 2, trade: 2, co: 2, mkts: 2, logi: 2, reg: 2, firm: 2 });
  if (dealRun(5, false, mixFromParam(TOPIC_LIST, mixParam(TOPIC_LIST, trader))).routes.length !== PER_RUN) fail("a linked mix with weights of 2 no longer deals");
}

// ---------- the next best word, and backing out of a dead end ----------
{
  const spend = ids => ids.reduce((t, id) => t + cost(id), 0), routes = [11, 23, 37].flatMap(seed => dealRun(seed, false, null).routes);
  for (const x of routes) {
    const way = bestOn([x.a], x.b);
    if (!way || Math.abs(spend(way) - x.par) > 1e-9 || way.join() !== x.parRoute.slice(1).join()) fail("from the start the way on is not the par route", x.a, x.b);
    // taking the next best word every time arrives at par; and a wrong first step still has a way on, never through the route
    let path = [x.a];
    while (path.at(-1) !== x.b && path.length < 12) path.push(bestOn(path, x.b)[0]);
    if (path.at(-1) !== x.b || Math.abs(spend(path.slice(1)) - x.par) > 1e-9) fail("following the next best word every time does not make par", x.a, x.b);
    const wrong = [...NEAR.get(x.a).keys()].find(id => id !== x.parRoute[1] && id !== x.b && bestOn([x.a, id], x.b));
    if (!wrong) continue;                                          // a start with no other step to take
    const on = bestOn([x.a, wrong], x.b);
    if (!on || on.includes(x.a) || spend(on) + cost(wrong) < x.par - 1e-9) fail("a way on from a wrong first step crosses the route or beats par", x.a, wrong);
  }
  // a true dead end: every neighbour of the goal is already on the route (but not where you stand), so nothing reaches it
  const x = routes[0], around = [...NEAR.get(x.b).keys()].filter(id => id !== x.a);
  const here = [...NEAR.keys()].find(id => id !== x.b && id !== x.a && !around.includes(id) && !NEAR.get(x.b).has(id));
  const stuck = [x.a, ...around, here];
  if (bestOn(stuck, x.b) !== null) fail("a dead end has a way on");
  const out = backOut(stuck, x.b);
  if (!out || out.keep !== around.length + 1 || out.way.length !== 1 || out.way[0] !== x.b) fail("backing out does not go back to the last thing that touches the goal", out?.keep, around.length + 1);
  if (backOut([x.a], x.b) !== null || backOut(x.parRoute.slice(0, 3), x.b) !== null) fail("a route that can go on is told to back out");
}

console.log(bad ? `arb: ${bad} problems` : `arb: ${NEAR.size} linked things, ${ENDS.length} ends, routes for ${made} of 20 starts; a step onto ${hub} costs ${cost(hub).toFixed(1)}; History more puts it in ${Math.round(moreShare * 100)}% of ends (Balanced ${Math.round(evenShare * 100)}%), only Energy in, every end about energy`);
if (bad) process.exitCode = 1;
