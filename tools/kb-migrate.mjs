// The one-off move of the suite's knowledge into kb/, the knowledge base. It reads today's banks and writes:
//   kb/entities.js   every thing the games ask about or use as a clue, with the sets it belongs to and its facts
//   kb/links.js      how things are connected: Crates' clues (the hand-written "because", the aspects, difficulty,
//                    position) and typed links (painted by, hangs in, movement, in a country)
//   kb/geometry.js   the shapes of Chart's physical features
//   kb/items/        the questions, each pointing at the entities it's about: pins (Chart), estimates (Quote),
//                    choices (Punt's knowledge banks)
//   kb/headers.js    the comments that head each generated bank
// tools/build-kb.mjs then writes the banks back from kb/; this script refuses to finish unless what comes back is
// identical to what went in. Merges are by exact name only (articles aside) and every one is listed in
// kb/MIGRATION.md, with anything that needs a person's judgement. Run once; kept as the record of the move.
import fs from "node:fs";
import path from "node:path";
import { build, OUTPUTS } from "./build-kb.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const rel = f => path.join(root, f);
globalThis.window = globalThis;
await import(rel("bank.js"));
const RAW = JSON.parse(Buffer.from(globalThis.CRATES_BANK, "base64").toString("utf8"));
const { PLACES, CATS: CHART_CATS } = await import(rel("chart-bank.js"));
const { GEO } = await import(rel("chart-geo.js"));
const { QUOTES, CATS: QUOTE_CATS } = await import(rel("quote-bank.js"));
const CHOICE_BANKS = ["art", "cities", "flags", "eco", "phy", "chm", "cs", "phil", "rel", "refining"];
const choice = {};
for (const b of CHOICE_BANKS) choice[b] = await import(rel(`${b}-bank.js`));

// ---------- entities ----------
const entities = new Map();                      // id → entity, in the order made
const slug = s => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const norm = s => String(s).trim().toLowerCase().replace(/^the /, "").replace(/\s+/g, " ");
function entity(name, props = {}) {
  const base = slug(name) || "e";
  let id = base, k = 2;
  while (entities.has(id)) id = `${base}-${k++}`;
  const e = { id, name, sets: [], ...props };
  entities.set(id, e);
  return e;
}
const addSet = (e, s) => { if (!e.sets.includes(s)) e.sets.push(s); };
const report = { merged: [], conflicts: [], homonyms: [], created: {} };
const count = k => { report.created[k] = (report.created[k] || 0) + 1; };

// Crates' answers: the country and commodity sets Crates asks by, in their board positions
const answerIds = [];
const answerByName = new Map();                  // a name or an alias of an answer → its id (countries and commodities)
RAW.forEach((a, pos) => {
  const e = entity(a.n, { crates: pos, aliases: a.a });
  addSet(e, a.c);
  addSet(e, `group:${a.g}`);
  answerIds[pos] = e.id;
  answerByName.set(norm(a.n), e.id);
  count(a.c);
});
for (const a of RAW) for (const al of a.a || []) if (!answerByName.has(norm(al))) answerByName.set(norm(al), answerIds[RAW.indexOf(a)]);

// Crates' clues: each clue word is an entity (one per name: a word under several answers is one thing with several
// links); a word that is itself an answer's name links that answer (a country to a commodity, and back)
const byName = new Map();                        // norm(name) → id, for the clue entities and everything after
for (const a of RAW) byName.set(norm(a.n), answerIds[RAW.indexOf(a)]);
const links = [];
RAW.forEach((a, pos) => a.w.forEach((arr, k) => {
  const [w, hint, topics, d, alt, since] = arr;
  let id = byName.get(norm(w));
  if (!id) { id = entity(w).id; byName.set(norm(w), id); count("clue"); }
  const link = { from: id, to: answerIds[pos], rel: "clue", hint, aspects: topics, d, alt: alt.map(i => answerIds[i]), pos: k };
  if (entities.get(id).name !== w) link.w = w;            // shown as written, where it differs from the entity's name
  if (arr.length > 5) link.since = since;
  links.push(link);
}));
// a word whose links to answers of the same kind (country, or commodity: their aspects differ by kind) share no aspect
// may be two different things under one name, like Java the island and Java the language: listed for a person to check
const linksFrom = new Map();
for (const l of links) (linksFrom.get(l.from) || linksFrom.set(l.from, []).get(l.from)).push(l);
const kindOf = id => (entities.get(id).sets.includes("country") ? "country" : "commodity");
for (const [id, ls] of linksFrom) {
  const suspect = ls.some((a, i) => ls.some((b, j) => j > i && kindOf(a.to) === kindOf(b.to) && !a.aspects.some(x => b.aspects.includes(x))));
  if (suspect) report.homonyms.push(`${entities.get(id).name}: ${ls.map(l => `${entities.get(l.to).name} (${l.aspects.join("/")}: ${l.hint})`).join("; ")}`);
}

// The countries: Crates' 69, and the rest of the world from Punt's flags (every flag's country, by its name there).
// Nothing else makes a country: a place's country string that names none of these gets no link, and is reported.
const countryOf = name => { const id = answerByName.get(norm(name)); return id && entities.get(id).sets.includes("country") ? id : null; };
for (const q of choice.flags.MATHS) {
  const name = q.o[q.a[0]];
  if (countryOf(name)) continue;
  const e = entity(name.replace(/^the /, ""));
  addSet(e, "country");
  answerByName.set(norm(name), e.id);
  count("country (from the flags)");
}
// a place's country string ("France, Switzerland, Italy", "Bosnia and Herzegovina", "Argentina and Chile") as "in" links
const unplaced = new Set();
const inLinks = (id, countries) => {
  if (!countries) return;
  for (const part of String(countries).split(/,\s*/).map(s => s.trim()).filter(Boolean)) {
    const whole = countryOf(part), halves = part.split(/\s+and\s+/).map(countryOf);
    const found = whole ? [whole] : halves.length > 1 && halves.every(Boolean) ? halves : [];
    if (!found.length) unplaced.add(part);
    for (const c of found) links.push({ from: id, to: c, rel: "in" });
  }
};

// facts move onto the entity; a fact that differs from what's already there stays on the item, and is reported
function facts(e, fields, where) {
  const overrides = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (e[k] === undefined) e[k] = v;
    else if (JSON.stringify(e[k]) !== JSON.stringify(v)) { overrides[k] = v; report.conflicts.push(`${where}: ${e.name}.${k} is ${JSON.stringify(e[k])} on the entity, ${JSON.stringify(v)} here (kept here)`); }
  }
  return overrides;
}
// a place or feature: the clue entity of the same name if there is one, else a new entity
function placeEntity(name, set, where) {
  const id = byName.get(norm(name));
  if (id && entities.get(id).crates === undefined && entities.get(id).lat === undefined) {
    report.merged.push(`${where} "${name}" = Crates clue "${entities.get(id).name}"`);
    addSet(entities.get(id), set);
    return entities.get(id);
  }
  const e = entity(name);
  addSet(e, set);
  byName.set(norm(name), e.id);
  count(set);
  return e;
}

// ---------- Chart: places and features ----------
const PLACE_SET = { cities: "city", trade: "trade-place", wine: "wine-place", art: "museum", people: "people-place", geo: "geo-place" };
const pins = [];
for (const p of PLACES) {
  const { id, cat, name, ...rest } = p;
  const e = placeEntity(name, PLACE_SET[cat], `Chart ${id}`);
  const over = facts(e, rest, `Chart ${id}`);
  const pin = { id, cat, about: e.id, ...over };
  if (e.name !== name) pin.name = name;
  pins.push(pin);
  if (!over.country) inLinks(e.id, rest.country);
}
const geometry = {};
const features = [];
for (const g of GEO) {
  const { id, name, rings, lines, ...rest } = g;
  const e = placeEntity(name, `feature:${g.kind}`, `Chart feature ${id}`);
  addSet(e, "feature");
  const over = facts(e, rest, `Chart feature ${id}`);
  geometry[e.id] = rings ? { rings } : { lines };
  const f = { id, about: e.id, ...over };
  if (e.name !== name) f.name = name;
  features.push(f);
  if (!over.country) inLinks(e.id, rest.country);
}

// ---------- Punt's art: paintings, painters, museums, movements ----------
const art = choice.art.MATHS;
const paintingByPic = new Map();
const named = (name, set) => {                     // the entity of that name, made if new
  let id = byName.get(norm(name));
  if (!id) { id = entity(name.replace(/^the /, "")).id; byName.set(norm(name), id); count(set); }
  addSet(entities.get(id), set);
  return id;
};
for (const q of art.filter(q => q.lv === "who" && q.pic)) {
  const m = /^(.+?), (.+?), (c\. )?(\d{3,4})/.exec(q.x);
  if (!m) throw new Error(`can't read the painting in ${q.id}`);
  const e = entity(m[1], { year: Number(m[4]), pic: q.pic });
  if (m[3]) e.circa = true;
  addSet(e, "painting");
  count("painting");
  paintingByPic.set(q.pic, e.id);
  links.push({ from: e.id, to: named(q.o[q.a[0]], "painter"), rel: "painted-by" });
}
for (const q of art.filter(q => q.pic && q.lv !== "who")) {
  const p = paintingByPic.get(q.pic);
  if (!p) continue;
  const right = q.o[q.a[0]];
  if (q.lv === "where") links.push({ from: p, to: named(right, "museum"), rel: "hangs-in" });
  if (q.lv === "when") links.push({ from: p, to: named(right, "art-movement"), rel: "movement" });
}
for (const e of entities.values()) if (e.sets.includes("painter")) addSet(e, "person");

// ---------- items ----------
// Quote: a painting's year is the painting's fact; everything else is the item's own
const estimates = QUOTES.map(q => {
  const p = q.pic && q.unit === "year" ? paintingByPic.get(q.pic) : null;
  if (!p) return { ...q };
  const e = entities.get(p), item = { ...q, about: p, fact: "year" };
  if (q.truth === e.year) delete item.truth; else report.conflicts.push(`Quote ${q.id}: ${e.name} year ${e.year} on the entity, ${q.truth} here (kept here)`);
  if (q.pic === e.pic) delete item.pic;
  return item;
});
// Punt's knowledge banks, word for word; what each question is about where that's certain
const aboutOf = (bank, q) => {
  if (bank === "art" && q.pic && paintingByPic.has(q.pic)) return [paintingByPic.get(q.pic)];
  const right = q.o?.[q.a?.[0]];
  if (bank === "flags" && right) return [countryOf(right)].filter(Boolean);
  if (bank === "cities" && right) {
    const ids = [answerByName.get(norm(right)), byName.get(norm(right))].filter(Boolean);
    const cap = /^The capital of (.+)$/.exec(q.q);
    if (cap && countryOf(cap[1])) ids.push(countryOf(cap[1]));
    return [...new Set(ids)];
  }
  return null;
};
const choices = {};
for (const b of CHOICE_BANKS) {
  choices[b] = { STAGES: choice[b].STAGES, ITEMS: choice[b].MATHS.map(q => { const about = aboutOf(b, q); return about?.length ? { ...q, about } : { ...q }; }) };
}

// ---------- the record of where each bank's comment came from ----------
const headers = {};
for (const f of Object.values(OUTPUTS)) headers[f] = fs.readFileSync(rel(f), "utf8").split("\n").filter((l, i, all) => all.slice(0, i + 1).every(x => x.startsWith("//"))).join("\n");

// ---------- write kb/ ----------
const lines = xs => `[\n${xs.map(x => JSON.stringify(x)).join(",\n")}\n]`;
const write = (f, text) => { fs.mkdirSync(path.dirname(rel(f)), { recursive: true }); fs.writeFileSync(rel(f), text); };
const kb = {
  "kb/entities.js": `// Every thing the games ask about or use as a clue. sets: what it is (country, commodity, group:eu, city, painting…);
// crates: its board position when it's one of Crates' answers (append-only); aliases: what's accepted when typed;
// the rest are its facts (lat, lon, note, country, region, year, pic…). Edit here, then rebuild (tools/build-kb.mjs).
export const ENTITIES = ${lines([...entities.values()])};\n`,
  "kb/links.js": `// How things are connected. rel "clue": Crates' clue pairs, from the clue to the answer, with the hand-written hint (the
// "because"), its aspects (the topics you filter by in Crates' settings), difficulty d, the other answers it also fits
// (alt), its position in the answer's list (pos, append-only) and the batch it came in (since); w is the word as shown
// where it differs from the entity's name. Typed links: in (a country), painted-by, hangs-in, movement.
export const LINKS = ${lines(links)};\n`,
  "kb/geometry.js": `// The shapes of Chart's physical features, by entity: rings (ranges, deserts, plateaus, lakes) or lines (rivers),
// [lon, lat] pairs simplified from Natural Earth (public domain).
export const GEOMETRY = ${JSON.stringify(geometry)};\n`,
  "kb/items/pins.js": `// Chart's questions: pin the place. Each is about an entity, whose name, position, note, country, region and picture
// it shows; a field here overrides the entity's. Features are pinned anywhere on their shape (kb/geometry.js).
export const CATS = ${JSON.stringify(CHART_CATS)};
export const PINS = ${lines(pins)};
export const FEATURES = ${lines(features)};\n`,
  "kb/items/estimates.js": `// Quote's questions: a number to make a market on. about + fact take the number from an entity (a painting's year);
// the rest are the item's own: wording, unit, the truth when it isn't an entity's fact, scale, widths, difficulty, note.
export const CATS = ${JSON.stringify(QUOTE_CATS)};
export const ESTIMATES = ${lines(estimates)};\n`,
  "kb/headers.js": `// The comment at the head of each bank the build writes (each describes its bank for whoever opens it).
export const HEADERS = ${JSON.stringify(headers, null, 1)};\n`,
};
for (const b of CHOICE_BANKS) kb[`kb/items/choice/${b}.js`] = `// Punt's ${b} questions (the bank ${b}-bank.js is written from this). about: the entities a question is about, where
// that's certain. o: the options, a: the right ones, s: how many to pick, x: the explanation, lv: the stage, d: 1–10.
export const STAGES = ${JSON.stringify(choice[b].STAGES)};
export const ITEMS = ${lines(choices[b].ITEMS)};\n`;
for (const [f, text] of Object.entries(kb)) write(f, text);

// ---------- prove the round trip before anything is replaced ----------
const out = await build();                       // the banks as kb/ would write them, in memory
const differ = [];
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
function canon(x) { if (Array.isArray(x)) return x.map(canon); if (x && typeof x === "object") return Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])])); return x; }
if (out.crates !== globalThis.CRATES_BANK) differ.push("bank.js");
if (!same(out.chart.PLACES, PLACES) || !same(out.chart.CATS, CHART_CATS)) differ.push("chart-bank.js");
if (!same(out.geo.GEO, GEO)) differ.push("chart-geo.js");
if (!same(out.quote.QUOTES, QUOTES) || !same(out.quote.CATS, QUOTE_CATS)) differ.push("quote-bank.js");
for (const b of CHOICE_BANKS) if (!same(out.choice[b].MATHS, choice[b].MATHS) || !same(out.choice[b].STAGES, choice[b].STAGES)) differ.push(`${b}-bank.js`);
if (differ.length) { console.error("Round trip failed for:", differ.join(", ")); process.exit(1); }

const ents = [...entities.values()];
const md = `# The move into kb/ (${new Date().toISOString().slice(0, 10)})

Read from the banks: ${RAW.length} Crates answers with ${links.filter(l => l.rel === "clue").length} clue pairs, ${PLACES.length} Chart places,
${GEO.length} features, ${QUOTES.length} Quote numbers, ${CHOICE_BANKS.map(b => `${choice[b].MATHS.length} ${b}`).join(", ")} Punt questions.
Written back by tools/build-kb.mjs: identical, every bank (checked before the banks were replaced).

Entities: ${ents.length}. Made: ${Object.entries(report.created).map(([k, v]) => `${v} ${k}`).join(", ")}.
Links: ${links.length} (${["clue", "in", "painted-by", "hangs-in", "movement"].map(r => `${links.filter(l => l.rel === r).length} ${r}`).join(", ")}).
Clue words under more than one answer, now one entity each: ${[...linksFrom.values()].filter(ls => ls.length > 1).length}.
Clue words that are themselves answers (country ↔ commodity links): ${links.filter(l => l.rel === "clue" && entities.get(l.from).crates !== undefined).length}.

## Merged by name (${report.merged.length}): a place and a Crates clue of the same name are one entity
${report.merged.map(s => `- ${s}`).join("\n")}

## Facts that disagreed (${report.conflicts.length}): the item keeps its own value, nothing changed in the games
${report.conflicts.map(s => `- ${s}`).join("\n") || "None."}

## Possibly two things under one name (${report.homonyms.length}): links to two countries (or two commodities) with no aspect in common; check, and split if so
${report.homonyms.map(s => `- ${s}`).join("\n")}

## Country strings that name no country (${unplaced.size}): the place keeps the string, without an "in" link
${[...unplaced].map(s => `- ${s}`).join("\n")}
`;
write("kb/MIGRATION.md", md);
console.log(md.split("\n").slice(0, 12).join("\n"));
