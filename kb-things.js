// What the knowledge games share about a thing, pure (tests/kb-things.mjs checks it): the thing itself (ENT, its name and
// kind), the topics the suite's subjects (topics-on.js, Settings) make of the knowledge base's, and what each thing is about,
// so a game that deals things by topic (Nexus) weighs one by its likeliest topic, as Crates weighs a word. A thing is about
// the topics of its links (a clue link's aspects; a painting's painter, museum and movement and a book's author, Culture &
// arts; standing in a place, Geography), or, linked by none of those, its kind's (a person, People; a company, Companies).
// Arb (retired, November 2026) dealt its routes the same way, and this is what it left Nexus.
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { KB_TOPICS, KB_PRESETS, TOPIC_OF, mixFromSubjects, drawWeighted, even } from "./topics.js";

export const ENT = new Map(ENTITIES.map(e => [e.id, e]));
const CANON = id => ENT.get(id)?.same || id;   // a duplicate entry stands for the one it duplicates
export const name = id => { const e = ENT.get(id); return e ? (e.qualifier ? `${e.name} (${e.qualifier})` : e.name) : id; };
export const kind = id => (ENT.get(id)?.sets || []).find(s => !s.startsWith("group:")) || "";

// ---------- topics ----------
export const TOPIC_LIST = [...KB_TOPICS.country, ...KB_TOPICS.commodity];
/** The mix the suite's subjects (topics-on.js) make of these topics: each in, at Balanced's weight, when its subject is
 *  on, out when it isn't; every subject on is Balanced. A weight of 2 still draws twice as often (a mix a link or a saved
 *  match carries from before topics were on or off), so the draw below is unchanged. */
export const topicsOf = on => mixFromSubjects(TOPIC_LIST, TOPIC_OF.kb, on, KB_PRESETS.balanced.topics);
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
/** One of these things drawn by a mix; every topic in (or no mix), evenly, as it always was. */
export const drawEnd = (r, among, weights) =>
  even(TOPIC_LIST, weights) ? among[Math.floor(r() * among.length)] : drawWeighted(r, among, id => endWeight(weights, id), 1)[0];
