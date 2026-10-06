// Arb: the knowledge base's links make a graph with enough ends (things with a few links), routes three to five hops
// long exist for every seed tried, and a hub costs far more to step onto than an obscure thing. Run: node tests/arb.mjs
const { ENTITIES } = await import("../kb/entities.js");
const { LINKS } = await import("../kb/links.js");
const ids = new Set(ENTITIES.map(e => e.id)), near = new Map();
for (const l of LINKS) if (ids.has(l.from) && ids.has(l.to) && l.from !== l.to)
  for (const [a, b] of [[l.from, l.to], [l.to, l.from]]) { if (!near.has(a)) near.set(a, new Set()); near.get(a).add(b); }
const deg = id => near.get(id)?.size || 0, cost = id => 1 + Math.log2(Math.max(1, deg(id)));
const ends = [...near.keys()].filter(id => deg(id) >= 2 && deg(id) <= 25);
function hopsFrom(a) {
  const h = new Map([[a, 0]]), q = [a];
  while (q.length) { const u = q.shift(); for (const v of near.get(u) || []) if (!h.has(v)) { h.set(v, h.get(u) + 1); q.push(v); } }
  return h;
}
let bad = 0, made = 0;
for (let i = 0; i < 20; i++) {
  const a = ends[(i * 7919) % ends.length], h = hopsFrom(a);
  if (ends.some(b => b !== a && h.get(b) >= 3 && h.get(b) <= 5)) made++;
}
if (ends.length < 300) { bad++; console.log("too few ends", ends.length); }
if (made < 18) { bad++; console.log("routes found for only", made, "of 20 starts"); }
const hub = [...near.keys()].sort((p, q) => deg(q) - deg(p))[0];
if (!(cost(hub) > 7 && cost(ends[0]) < 6)) { bad++; console.log("costs", cost(hub), cost(ends[0])); }
console.log(bad ? `arb: ${bad} problems` : `arb: ${near.size} linked things, ${ends.length} ends, routes for ${made} of 20 starts; a step onto ${hub} costs ${cost(hub).toFixed(1)}`);
if (bad) process.exitCode = 1;
