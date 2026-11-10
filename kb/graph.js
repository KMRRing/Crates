// kb/ read as statements (kb/vocabulary.js has the model): a thing's facts with their labels and units, the things its
// fields name (a ski race `at` Kitzbühel is a link to Kitzbühel), its dates and its place (its own, or the place of what
// it's in, hangs in, is held at…), its steps, and a link's facts in words. Pure: the Almanac, the build and the tests
// read kb/ the same way. Indexes once; nothing here scans the links in a loop.
//
// Every fact has an id, the same in every game, so what you learn in one is what another asks (Korbi, 10 Nov 2026: "when
// in learn mode, the user should revise the same items regardless of which game they play"):
//   a link        krone>clue>norway, mona-lisa>painted-by>leonardo-da-vinci, earth-planet>member-of>set-planets
//   a field       norway.area, mona-lisa.year, high-renaissance.card.aim (a record's field)
//   a place       louvre.place (where it is: its own coordinates, or those of what it's in)
//   a step        story-voc~3 (a story's third event), magellan~ferdinand-magellan-2 (a Dispatch meeting, by its id)
// A question names the facts it tests (`facts`); testsOf() works them out from what it's about and its right answer.
import { FIELDS, RECORD, FACTS, RELS, labelOf, yearWords, period } from "./vocabulary.js";

const fold = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^the /, "").trim();
const num = n => (Math.abs(n) >= 10000 ? n.toLocaleString("en-GB") : String(n));

/** A quantity in words: 385,207 km², 5.5 million, 12 %. */
export const amountWords = (v, unit) => `${num(v)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;

/** A link's facts in words, in the order a reader wants them: when, rank, how much, how far. "1298", "830 km by barge",
 *  "the biggest grower · 208 million tonnes". `rank: false` leaves the rank out (a clue's own words already say it). */
export function factWords(facts, { rank = true } = {}) {
  if (!facts) return "";
  const x = facts, out = [];
  if (x.pos != null) out.push(`no. ${x.pos}`);                // a member's place in its set's order
  if (x.year != null) out.push(yearWords(x.year, x.circa));
  if (x.from != null) out.push(x.to != null ? `${yearWords(x.from, x.circa)}–${yearWords(x.to)}` : `from ${yearWords(x.from, x.circa)}`);
  else if (x.to != null) out.push(`until ${yearWords(x.to)}`);
  if (rank && x.rank != null && x.role) {
    const nth = ["", "the biggest", "the second-biggest", "the third-biggest", "the fourth-biggest", "the fifth-biggest"][x.rank] || `number ${x.rank} of the`;
    out.push(`${x.once ? "once " : ""}${nth} ${x.role}`);
  }
  if (x.amount != null) out.push(amountWords(x.amount, x.unit));
  if (x.share != null) out.push(`${amountWords(x.share, "%")} of the world's`);
  if (x.distance != null) out.push(`${amountWords(x.distance, FACTS.distance.unit)}${x.by ? ` by ${x.by}` : ""}`);
  if (x.upriver != null) out.push(`${amountWords(x.upriver, FACTS.upriver.unit)} up the river`);
  if (x.asOf != null) out.push(`as of ${x.asOf}`);
  return out.join(" · ");
}

/** A fact's id. */
export const linkFact = (from, rel, to) => `${from}>${rel}>${to}`;
export const fieldFact = (id, key) => `${id}.${key}`;
export const stepFact = (id, step) => `${id}~${step}`;
/** A fact id read back: { kind: "link", from, rel, to } | { kind: "field", id, key } (key may be "card.aim", or "place") | { kind: "step", id, step }. */
export function parseFact(f) {
  let m;
  if ((m = /^([^>~.]+)>([^>]+)>([^>]+)$/.exec(f))) return { kind: "link", from: m[1], rel: m[2], to: m[3] };
  if ((m = /^([^>~.]+)~(.+)$/.exec(f))) return { kind: "step", id: m[1], step: m[2] };
  if ((m = /^([^>~.]+)\.(.+)$/.exec(f))) return { kind: "field", id: m[1], key: m[2] };
  return null;
}

/** The graph over kb/'s things and links. */
export function makeGraph(entities, links) {
  const byId = new Map(entities.map(e => [e.id, e]));
  const canon = id => byId.get(id)?.same || id;
  const named = new Map();                                    // a folded name → the ids that go by it
  for (const e of entities) if (!e.same) for (const n of [e.name, e.short, ...(e.aliases || [])].filter(Boolean)) {
    const k = fold(n); named.set(k, [...new Set([...(named.get(k) || []), e.id])]);
  }
  const out = new Map(), inn = new Map();
  for (const l of links) {
    (out.get(l.from) || out.set(l.from, []).get(l.from)).push(l);
    (inn.get(l.to) || inn.set(l.to, []).get(l.to)).push(l);
  }
  /** The thing a value names (an id, or a name only one thing of `kind` goes by), or null. */
  const resolve = (v, kind) => {
    if (typeof v !== "string") return null;
    if (byId.has(v)) return canon(v);
    const ids = (named.get(fold(v)) || []).filter(id => !kind || byId.get(id).sets.includes(kind));
    return ids.length === 1 ? canon(ids[0]) : null;
  };
  const refOf = (key, v) => resolve(v, FIELDS[key]?.kind);

  /** A thing's facts, each { key, label, type, value, words }: what the Almanac lists and a game may ask. Its place
   *  (lat, lon), its kinds and the fields that name another thing are left to placeOf, the kinds and refsOf. */
  function factsOf(e) {
    const rows = [];
    for (const [key, value] of Object.entries(e)) {
      const d = FIELDS[key];
      if (!d || d.role !== "fact" || value == null || ["lat", "lon", "circa", "card", "archCard", "meetings", "steps", "note", "pic"].includes(key)) continue;
      if (d.type === "ref" && refOf(key, value)) continue;
      const words = d.type === "quantity" ? amountWords(value, d.unit)
        : d.type === "year" ? yearWords(value, key === "year" && e.circa)
        : d.type === "flag" ? (value ? "yes" : "no")
        : Array.isArray(value) ? value.join(", ") : String(value);
      rows.push({ key, label: labelOf(key, e), type: d.type, value, unit: d.unit, words });
    }
    for (const key of ["card", "archCard"]) for (const [k, v] of Object.entries(e[key] || {})) {
      const d = RECORD[k];
      if (d) rows.push({ key: `${key}.${k}`, label: d.label, type: d.type, value: v, words: d.type === "year" ? yearWords(v) : String(v) });
    }
    return rows;
  }
  /** The things a thing's fields name: [{ key, label, to }], one per field that resolves (a link in all but storage). */
  function refsOf(e) {
    const rows = [];
    for (const [key, value] of Object.entries(e)) {
      const d = FIELDS[key];
      if (d?.type !== "ref" || d.role !== "fact") continue;
      const to = refOf(key, value);
      if (to && to !== e.id) rows.push({ key, label: d.label, to });
    }
    return rows;
  }
  /** When a thing is: { from, to?, circa?, key } from its year, its founding, a life, a span or a movement's dates. Null if kb/ doesn't say. */
  function whenOf(e) {
    if (e.year != null) return { from: e.year, circa: !!e.circa, key: "year" };
    if (e.founded != null) return { from: e.founded, key: "founded" };
    if (e.born != null) return { from: e.born, to: e.died ?? undefined, key: "born" };
    const p = period(e.span ?? e.card?.span ?? e.archCard?.span ?? "");
    return p ? { ...p, key: "span" } : null;
  }
  /** Where a thing is: { lat, lon, via } — its own place, else the place of what it's in, hangs in, is held at…, or of
   *  the thing a field names (a race `at` its resort), up to three steps away. Null if none. */
  function placeOf(id, seen = new Set()) {
    id = canon(id);
    const e = byId.get(id);
    if (!e || seen.has(id) || seen.size > 3) return null;
    if (e.lat != null && e.lon != null) return { lat: e.lat, lon: e.lon, via: null };
    seen.add(id);
    const next = [...(out.get(id) || []).filter(l => RELS[l.rel]?.locates).map(l => l.to), ...refsOf(e).filter(x => ["at", "town", "capital"].includes(x.key)).map(x => x.to)];
    for (const n of next) { const p = placeOf(n, seen); if (p) return { lat: p.lat, lon: p.lon, via: p.via || n }; }
    return null;
  }
  /** A thing's steps, in order: [{ year?, circa?, place?, text, why?, thing? }] — Dispatch's acts of a person (`meetings`),
   *  a story's events (`steps`). */
  function stepsOf(e) {
    return [...(e.steps || []), ...(e.meetings || [])].map(s => ({ ...s, text: s.text ?? s.what, thing: s.thing ? resolve(s.thing) : null }));
  }
  const linked = new Set(links.map(l => linkFact(l.from, l.rel, l.to)));
  /** The ids of a thing's steps, in order: a Dispatch meeting by its own id, a story's event by its place in the story (1, 2…). */
  const stepIds = e => [...(e.steps || []).map((_, i) => String(i + 1)), ...(e.meetings || []).map(m => m.id)];
  /** Whether kb/ holds the fact an id names. */
  function holds(f) {
    const x = parseFact(f);
    if (!x) return false;
    if (x.kind === "link") return linked.has(f);
    const e = byId.get(x.id);
    if (!e) return false;
    if (x.kind === "step") return stepIds(e).includes(x.step);
    if (x.key === "place") return !!placeOf(x.id);
    const [k, sub] = x.key.split(".");
    return sub ? e[k]?.[sub] != null : e[k] != null && FIELDS[k]?.role === "fact";
  }
  /**
   * The facts a question tests, from the things it's about and its right answers ({ about, q, right }): for each thing,
   * a field whose value is a right answer, or a link to or from the thing a right answer names. A question whose right
   * answer is the thing itself ("Which merchant power traded nutmeg?") tests the field or link its own words quote.
   */
  function testsOf({ about = [], q = "", right = [] }) {
    const out = new Set(), said = fold(q), names = e => [e.name, e.short, e.title, ...(e.aliases || [])].filter(Boolean).map(fold);
    const same = (v, r) => v != null && r != null && fold(v) === fold(r);
    for (const id0 of about) {
      const id = canon(id0), e = byId.get(id);
      if (!e) continue;
      const fields = [...Object.entries(e).filter(([k]) => FIELDS[k]?.role === "fact"),
        ...["card", "archCard"].flatMap(k => Object.entries(e[k] || {}).map(([s, v]) => [`${k}.${s}`, v]))];
      const ends = [...(out_(id)), ...(inn.get(id) || []).map(l => ({ l, other: l.from }))];
      for (const r of right) {
        if (names(e).includes(fold(r))) {                       // the answer is the thing: the question quotes what it's asked by
          for (const [k, v] of fields) if (typeof v === "string" && v.length >= 4 && said.includes(fold(v))) out.add(fieldFact(id, k));
          for (const { l, other } of ends) { const o = byId.get(other); if (o && names(o).some(n => n.length >= 4 && said.includes(n))) out.add(linkFact(l.from, l.rel, l.to)); }
          continue;
        }
        for (const [k, v] of fields) if (same(v, r) || (Array.isArray(v) && v.some(x => same(x, r)))) out.add(fieldFact(id, k));
        for (const { l, other } of ends) { const o = byId.get(other); if (o && names(o).includes(fold(r))) out.add(linkFact(l.from, l.rel, l.to)); }
      }
    }
    return [...out];
  }
  const out_ = id => (out.get(id) || []).map(l => ({ l, other: l.to }));
  return { byId, canon, resolve, refOf, out, inn, factsOf, refsOf, whenOf, placeOf, stepsOf, stepIds, holds, testsOf };
}

