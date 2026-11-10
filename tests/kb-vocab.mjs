// kb/'s vocabulary holds (kb/vocabulary.js): every field a thing has, every kind of link, every fact a link carries,
// every aspect and every kind is defined, and every value is of its type: a year a whole number, a period one period()
// reads, a quantity a number, a place on the globe, a ranked link's role one of ROLES, a link's amount with its unit.
// A field that names another thing strictly (a race `at` its resort) names one that exists. kb/graph.js finds a
// painting's place through the museum it hangs in.
import { FIELDS, RECORD, STEP, FACTS, LINK, RELS, ROLES, ASPECTS, KINDS, TYPES, period } from "../kb/vocabulary.js";
import { makeGraph, factWords } from "../kb/graph.js";
import { MEASURES } from "../kb/measures.js";
import { UNITS } from "../kb/units.js";
import { TOPIC_OF } from "../topics.js";
const { ENTITIES } = await import("../kb/entities.js");
const { LINKS } = await import("../kb/links.js");
let bad = 0;
const check = (ok, what, list = []) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : `: ${list.slice(0, 8).join("; ")}`}`); if (!ok) bad++; };

const isYear = v => Number.isInteger(v) && v > -5000 && v < 2100;
const OK = {
  text: v => typeof v === "string" && v.length > 0, texts: v => Array.isArray(v) && v.every(x => typeof x === "string"),
  number: v => Number.isFinite(v), quantity: v => Number.isFinite(v), year: isYear, period: v => period(v) != null,
  lat: v => Number.isFinite(v) && Math.abs(v) <= 90, lon: v => Number.isFinite(v) && Math.abs(v) <= 180, ref: v => typeof v === "string" && v.length > 0,
  refs: v => Array.isArray(v) && v.every(x => typeof x === "string"), flag: v => typeof v === "boolean", record: v => v && typeof v === "object" && !Array.isArray(v),
  acts: v => Array.isArray(v) && v.every(x => x && typeof x === "object"), tags: v => Array.isArray(v) && v.every(x => typeof x === "string"),
  lang: v => /^[a-z]{2,3}(-[A-Za-z0-9]+)?$/.test(v),
};
check(Object.keys(OK).every(t => TYPES.includes(t)) && TYPES.every(t => OK[t]), "every type of value has its check");

// the things
const unknown = new Set(), mistyped = [], strays = new Set();
const typed = (defs, key, v, where) => { const d = defs[key]; if (!d) { unknown.add(`${where}.${key}`); return; } if (!OK[d.type](v)) mistyped.push(`${where}.${key}=${JSON.stringify(v).slice(0, 40)}`); };
for (const e of ENTITIES) {
  for (const [k, v] of Object.entries(e)) typed(FIELDS, k, v, e.id);
  for (const k of ["card", "archCard"]) for (const [x, v] of Object.entries(e[k] || {})) typed(RECORD, x, v, `${e.id}.${k}`);
  for (const k of ["meetings", "steps"]) for (const s of e[k] || []) for (const [x, v] of Object.entries(s)) typed(STEP, x, v, `${e.id}.${k}`);
  for (const s of e.sets) if (!KINDS[s]) strays.add(s);
}
check(!unknown.size, "every field of every thing is in the vocabulary", [...unknown]);
check(!mistyped.length, "every field's value is of its type", mistyped);
check(!strays.size, "every kind a thing has is named", [...strays]);

// the links
const LINK_KEYS = new Set(Object.keys(LINK));
const rels = new Set(), keys = new Set(), aspects = new Set(), facts = [], roles = [];
unknown.clear(); mistyped.length = 0;                      // from here, a link's facts
for (const l of LINKS) {
  if (!RELS[l.rel]) rels.add(l.rel);
  for (const k of Object.keys(l)) if (!LINK_KEYS.has(k)) keys.add(k);
  for (const a of l.aspects || []) if (!ASPECTS[a] || !TOPIC_OF.kb[a]) aspects.add(a);
  if (!l.facts) continue;
  for (const [k, v] of Object.entries(l.facts)) typed(FACTS, k, v, `${l.from}>${l.to}`);
  if (l.facts.amount != null && !UNITS[l.facts.unit] && !l.facts.unit) facts.push(`${l.from}>${l.to} has an amount without a unit`);
  if (l.facts.rank != null && !ROLES[l.facts.role]) roles.push(`${l.from}>${l.to}: ${l.facts.role}`);
}
check(!rels.size, "every kind of link is in the vocabulary", [...rels]);
check(!keys.size, "a link holds only the fields a link has", [...keys]);
check(!aspects.size, "every aspect is named and belongs to a subject", [...aspects]);
check(!unknown.size && !mistyped.length && !facts.length, "every fact a link carries is defined, of its type, an amount with its unit", [...unknown, ...mistyped, ...facts]);
check(!roles.length, "a ranked link says what it ranks as (grower, exporter…)", roles);

// the numbers Quote asks of a thing's fields read in the field's own unit
const units = MEASURES.filter(m => FIELDS[m.key]?.unit !== m.unit).map(m => `${m.key} (${m.set}): ${m.unit} vs ${FIELDS[m.key]?.unit}`);
check(!units.length, "Quote's measures use the unit the vocabulary gives the field", units);

// fields that name a thing strictly name one that exists; loose ones may be words (a country kb/ has no thing for)
const g = makeGraph(ENTITIES, LINKS);
const strict = [];
for (const e of ENTITIES) for (const [k, v] of Object.entries(e)) if (FIELDS[k]?.type === "ref" && FIELDS[k].role === "fact" && !FIELDS[k].loose && !g.refOf(k, v)) strict.push(`${e.id}.${k}=${v}`);
check(!strict.length, "a field that names a thing names one kb/ has", strict);

// the graph
const mona = g.placeOf("mona-lisa");
check(mona && mona.via === "louvre" && Math.abs(mona.lat - 48.86) < 0.1, "a painting is where the museum it hangs in is");
check(g.whenOf(g.byId.get("odyssey"))?.from < 0, "a year before Christ reads as one");
check(period("c. 1250–1669")?.from === 1250 && period("c. 1250–1669").circa && period("from 1832")?.to === undefined && period("500–300 BC")?.from === -500
  && period("c. 100 BC–AD 400")?.from === -100 && period("c. 100 BC–AD 400").to === 400 && period("c. 1848–1860s")?.to === 1860, "periods are read");
check(factWords({ rank: 1, role: "grower", amount: 208, unit: "million tonnes", asOf: 2023 }) === "the biggest grower · 208 million tonnes · as of 2023", "a link's facts read in words");
process.exit(bad ? 1 : 0);
