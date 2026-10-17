// Arb's graph and routes, pure (arb.js draws them; tests/arb.mjs checks them): the knowledge base's links as a graph,
// what stepping onto a thing costs (1 + log2 of its links, so the cheap route runs through what you specifically know,
// not through the hubs), the cheapest route (par), and a run's five routes, each between two things of a few links,
// three to five hops apart. A run deals from a mix of the knowledge base's topics, each out, in or more, as Crates
// deals its clues: a thing is about the topics of its links (a clue link's aspects; a painting's painter, museum and
// movement and a book's author, Culture & arts; standing in a place, Geography), or, linked by none of those, its
// kind's (a person, People; a company, Companies). A route's two ends are drawn by the weight of their likeliest topic,
// as Crates weighs a word, so a thing only of topics out never ends one. The route between them runs through whatever
// links there are.
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { KB_TOPICS, KB_PRESETS, drawWeighted, even } from "./topics.js";

export const PER_RUN = 5;
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------- the graph ----------
export const ENT = new Map(ENTITIES.map(e => [e.id, e]));
const CANON = id => ENT.get(id)?.same || id;   // a duplicate entry stands for the one it duplicates
export const NEAR = new Map();                              // id → Map(neighbour → why they're linked)
for (const l of LINKS) {
  if (!ENT.has(l.from) || !ENT.has(l.to) || l.from === l.to) continue;
  const why = l.hint || ({ in: "is in", "painted-by": "painted by", "hangs-in": "hangs in", movement: "belongs to", "designed-by": "designed by", style: "in the style of", city: "stands in" }[l.rel] || "");
  const [f, t] = [CANON(l.from), CANON(l.to)];
  if (f === t) continue;
  for (const [a, b] of [[f, t], [t, f]]) {
    if (!NEAR.has(a)) NEAR.set(a, new Map());
    if (!NEAR.get(a).has(b)) NEAR.get(a).set(b, { why, from: f });
  }
}
export const degree = id => NEAR.get(id)?.size || 0;
/** What stepping onto a thing costs: 1 for an obscure one, more the better-connected it is. */
export const cost = id => 1 + Math.log2(Math.max(1, degree(id)));
export const name = id => { const e = ENT.get(id); return e ? (e.qualifier ? `${e.name} (${e.qualifier})` : e.name) : id; };
export const kind = id => (ENT.get(id)?.sets || []).find(s => !s.startsWith("group:")) || "";
/** The cheapest route from a to everything (Dijkstra, paying for each thing stepped onto). */
function cheapest(a) {
  const dist = new Map([[a, 0]]), prev = new Map(), hops = new Map([[a, 0]]), done = new Set();
  const queue = [[0, a]];
  while (queue.length) {
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i][0] < queue[bi][0]) bi = i;
    const [d, u] = queue.splice(bi, 1)[0];
    if (done.has(u)) continue;
    done.add(u);
    for (const v of NEAR.get(u)?.keys() || []) {
      const nd = d + cost(v);
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); hops.set(v, hops.get(u) + 1); queue.push([nd, v]); }
    }
  }
  return { dist, prev, hops };
}
const routeTo = (prev, a, b) => { const r = [b]; while (r[0] !== a) r.unshift(prev.get(r[0])); return r; };
// the ends of a route: things with a few links (not hubs, not dead ends)
export const ENDS = [...NEAR.keys()].filter(id => degree(id) >= 2 && degree(id) <= 25).sort();
// ---------- topics ----------
export const TOPIC_GROUPS = [["Country topics", KB_TOPICS.country], ["Commodity topics", KB_TOPICS.commodity]];
export const TOPIC_LIST = [...KB_TOPICS.country, ...KB_TOPICS.commodity];
export const TOPIC_PRESETS = { balanced: KB_PRESETS.balanced, trader: KB_PRESETS.trader, culture: KB_PRESETS.culture };
// a typed link's topic: a painting's painter, museum, movement and style, a book's author and lines, a style's
// successor are culture; where a thing stands, geography
const TYPED = { "painted-by": "cult", "hangs-in": "cult", movement: "cult", style: "cult", "designed-by": "cult", "written-by": "cult", "in-work": "cult", "led-to": "cult", in: "geo", city: "geo" };
// a thing no link gives a topic (a myth's gods, a pack's watchmakers and distilleries) is about what it is, its kind
const KIND_TOPIC = { person: "ppl", place: "geo", site: "geo", natural: "nat", animal: "nat", plant: "agr", food: "food", drink: "food",
  company: "co", organisation: "pol", law: "pol", market: "mkt", currency: "mkt", event: "hist", custom: "cult", art: "cult", book: "cult",
  music: "cult", game: "cult", film: "screen", tv: "screen", "video game": "screen", craft: "style", sport: "sport", tech: "sci",
  vehicle: "sci", material: "sci", disease: "sci", number: "sci", word: "lang" };
const SET_TOPIC = { country: "geo", "geo-place": "geo", building: "cult", painter: "cult", "art-record": "cult" };   // things of no kind
const kindTopic = id => {
  const sets = ENT.get(id)?.sets || [], k = sets.find(s => s.startsWith("kind:"));
  if (sets.some(s => /-god$|^myth-/.test(s))) return "cult";           // a god is a person by kind, but a myth's
  return k ? KIND_TOPIC[k.slice(5)] : sets.map(s => SET_TOPIC[s]).find(Boolean);
};
/** What each thing is about: the topics of its links, either way, or else of its kind. */
export const ABOUT = new Map();
for (const l of LINKS) {
  const topics = l.aspects?.length ? l.aspects : TYPED[l.rel] ? [TYPED[l.rel]] : [];
  for (const id of [CANON(l.from), CANON(l.to)]) { if (!ABOUT.has(id)) ABOUT.set(id, new Set()); for (const t of topics) ABOUT.get(id).add(t); }
}
for (const [id, topics] of ABOUT) if (!topics.size && kindTopic(id)) topics.add(kindTopic(id));
/** A thing's weight in a mix: its likeliest topic's (a thing about no topic, in). */
export const endWeight = (weights, id) => { const t = ABOUT.get(id); return t?.size ? Math.max(...[...t].map(x => weights[x] ?? 1)) : 1; };
/** One of these things drawn by a mix, to end a route; every topic in (or no mix), evenly, as it always was. */
export const drawEnd = (r, among, weights) =>
  even(TOPIC_LIST, weights) ? among[Math.floor(r() * among.length)] : drawWeighted(r, among, id => endWeight(weights, id), 1)[0];

// ---------- a run ----------
/**
 * A route for this seed: a start, and an end three to five hops away by the cheapest route, of another kind and not
 * linked to it directly. With a mix, each end is drawn by its weight; every topic in draws them as it always did.
 */
export function makeRoute(r, weights = null) {
  for (let tries = 0; tries < 60; tries++) {
    const a = drawEnd(r, ENDS, weights);
    if (a == null) return null;                   // nothing in the mix to start from
    const { dist, prev, hops } = cheapest(a);
    const far = ENDS.filter(b => b !== a && hops.get(b) >= 3 && hops.get(b) <= 5 && kind(b) !== kind(a) && !NEAR.get(a).has(b));
    if (!far.length) continue;                    // before drawing, as it always was: a seed deals what it dealt
    const b = drawEnd(r, far, weights);
    if (b == null) continue;
    return { a, b, par: dist.get(b), parRoute: routeTo(prev, a, b) };
  }
  return null;
}

/** The five routes of a seed, from a mix of topics (none: every topic in). A mix that leaves no route deals from them all. */
export function dealRun(seed, daily, weights = null) {
  const r = rng(seed), routes = [];
  for (let misses = 0; routes.length < PER_RUN;) {
    const x = makeRoute(r, misses < 20 ? weights : null);
    if (x) routes.push({ ...x, path: [x.a], done: null, points: 0 }); else misses++;
  }
  return { seed, daily, index: 0, total: 0, routes };
}
