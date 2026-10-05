// Writes the banks the games read from kb/, the knowledge base: Crates' bank (answers and their clues, from the
// entities and their clue links), Chart's places and features (from the pins and the entities they're about), Quote's
// numbers (with a painting's year taken from the painting) and Punt's knowledge banks. The games read the same
// files as before; kb/ is where knowledge is written now. Run after editing kb/: `node tools/build-kb.mjs`
// (tests/kb.mjs checks the banks are current).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(new URL("..", import.meta.url).pathname);
export const CHOICE_BANKS = ["art", "cities", "flags", "eco", "phy", "chm", "cs", "phil", "rel", "refining"];
/** What the build writes: the bank each game reads. */
export const OUTPUTS = { crates: "bank.js", chart: "chart-bank.js", geo: "chart-geo.js", quote: "quote-bank.js", index: "kb-index.js",
  ...Object.fromEntries(CHOICE_BANKS.map(b => [b, `${b}-bank.js`])) };

const load = f => import(`${pathToFileURL(path.join(root, "kb", f)).href}?t=${Date.now()}`);
/** An object without its undefined fields. */
const defined = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** The banks as kb/ makes them, in memory: { crates (base64), chart, geo, quote, choice: { bank: { STAGES, MATHS } } }. */
export async function build() {
  const [{ ENTITIES }, { LINKS }, { GEOMETRY }, pins, estimates] = await Promise.all(
    ["entities.js", "links.js", "geometry.js", "items/pins.js", "items/estimates.js"].map(load));
  const E = new Map(ENTITIES.map(e => [e.id, e]));
  const of = id => { const e = E.get(id); if (!e) throw new Error(`no entity ${id}`); return e; };

  // Crates: the answers in board order, each with its clues in list order (both append-only)
  const clues = new Map();
  for (const l of LINKS) if (l.rel === "clue") (clues.get(l.to) || clues.set(l.to, []).get(l.to)).push(l);
  // each answer and each clue carries its entity (e, and a clue's seventh place), so the pile knows what was missed
  const raw = ENTITIES.filter(e => e.crates !== undefined).sort((a, b) => a.crates - b.crates).map(e => ({
    n: e.name, c: e.sets.includes("country") ? "country" : "commodity", g: e.sets.find(s => s.startsWith("group:")).slice(6), a: e.aliases, e: e.id,
    w: (clues.get(e.id) || []).sort((x, y) => x.pos - y.pos).map(l => [l.w ?? of(l.from).name, l.hint, l.aspects, l.d, l.alt.map(id => of(id).crates), l.since ?? 0, l.from]),
  }));
  const crates = Buffer.from(JSON.stringify(raw), "utf8").toString("base64");

  // Chart: each pin shows its entity, with the pin's own overrides
  const PLACES = pins.PINS.map(({ id, cat, about, ...over }) => {
    const { name, lat, lon, note, country, region, pic } = of(about);
    return defined({ id, cat, name, lat, lon, note, country, region, pic, ...over, about });
  });
  const GEO = pins.FEATURES.map(({ id, about, ...over }) => {
    const { name, kind, region, country, note, lat, lon } = of(about);
    return defined({ id, name, kind, region, country, note, lat, lon, ...over, about, ...GEOMETRY[about] });
  });

  // Quote: a number that's an entity's fact comes from the entity
  const QUOTES = estimates.ESTIMATES.map(({ fact, ...q }) => {
    if (!fact) return q;
    const e = of(q.about);
    return defined({ ...q, truth: q.truth ?? e[fact], pic: q.pic ?? (fact === "year" ? e.pic : undefined) });
  });

  // Punt: the questions as written, with what they're about
  const choice = {};
  for (const b of CHOICE_BANKS) {
    const m = await load(`items/choice/${b}.js`);
    choice[b] = { STAGES: m.STAGES, MATHS: m.ITEMS };
  }
  return { crates, chart: { CATS: pins.CATS, PLACES }, geo: { GEO }, quote: { CATS: estimates.CATS, QUOTES }, choice, index: await subjects(ENTITIES, LINKS) };
}

// What each entity is a matter of, for coverage by subject across the games. A thing with a set the knowledge base
// knows (a country, a city, a painting…) is in that set's subject; a clue thing with a kind (a person, a company, a
// festival…, given by tools/kb-kinds.mjs or by hand) in its kind's; any other in the subject of its links' commonest
// aspect, by its label in Crates' topics (History, Food & drink…).
const SET_SUBJECT = [["country", "Countries"], ["commodity", "Commodities"], ["painting", "Paintings"], ["painter", "Painters"],
  ["art-movement", "Art movements"], ["museum", "Museums"], ["city", "Cities"], ["trade-place", "Ports, plants and trade"],
  ["wine-place", "Wine places"], ["people-place", "People's places"], ["feature", "Physical features"], ["geo-place", "Geography"]];
// A clue thing's kind, by the subject it belongs to: the kinds are finer than the subjects, and fold into Crates' topics
const KIND_SUBJECT = { person: "People", company: "Companies & brands", organisation: "Policy & institutions", place: "Geography",
  natural: "Nature", site: "Sites & structures", event: "History", law: "Policy & institutions", market: "Markets",
  film: "Film, TV & games", book: "Culture & arts", music: "Culture & arts", art: "Culture & arts", food: "Food & drink",
  drink: "Food & drink", animal: "Nature", plant: "Agriculture", disease: "Agriculture", currency: "Money & economy",
  vehicle: "Trade & shipping", sport: "Sport", custom: "Culture & arts", word: "Language & names", tech: "Science & tech",
  material: "Specs & science", craft: "Craft & style", number: "History" };
// Crates' country and commodity topics that are one subject seen from the two sides
const SAME_SUBJECT = { Companies: "Companies & brands", Policy: "Policy & institutions", "Trade & logistics": "Trade & shipping", "Culture & language": "Culture & arts" };
async function subjects(ENTITIES, LINKS) {
  globalThis.window ??= globalThis;
  await import(pathToFileURL(path.join(root, "bank.js")).href);
  const { ALL_TOPICS } = await import(pathToFileURL(path.join(root, "core.js")).href);
  const topic = Object.fromEntries(ALL_TOPICS.map(([code, label]) => [code, SAME_SUBJECT[label] || label]));
  const aspects = new Map();
  for (const l of LINKS) if (l.rel === "clue") for (const a of l.aspects) {
    const m = aspects.get(l.from) || aspects.set(l.from, new Map()).get(l.from);
    m.set(topic[a], (m.get(topic[a]) || 0) + 1);
  }
  const labels = [], at = new Map(), of = {};
  const index = label => { if (!at.has(label)) { at.set(label, labels.length); labels.push({ label, total: 0 }); } return at.get(label); };
  for (const [, label] of SET_SUBJECT) index(label);
  for (const e of ENTITIES) {
    const set = SET_SUBJECT.find(([s]) => e.sets.includes(s) || e.sets.some(x => x.startsWith(`${s}:`)));
    const kind = !set && e.sets.find(s => s.startsWith("kind:"))?.slice(5);
    const top = !set && !kind && [...(aspects.get(e.id) || [])].sort((a, b) => b[1] - a[1])[0];
    const label = set ? set[1] : kind ? KIND_SUBJECT[kind] : top ? top[0] : null;
    if (!label) continue;
    of[e.id] = index(label);
    labels[of[e.id]].total++;
  }
  return { SUBJECTS: labels.filter(s => s.total), SUBJECT: Object.fromEntries(Object.entries(of).map(([id, i]) => [id, labels.filter(s => s.total).indexOf(labels[i])])) };
}

/** The files' text, headed by each bank's own comment and a line saying where it comes from. */
export async function render(out) {
  const { HEADERS } = await load("headers.js");
  const lines = xs => `[\n${xs.map(x => JSON.stringify(x)).join(",\n")}\n]`;
  const head = f => `${HEADERS[f]}\n// Written by tools/build-kb.mjs from kb/: edit kb/, not this file.\n`;
  const files = {
    [OUTPUTS.crates]: `${head(OUTPUTS.crates)}window.CRATES_BANK = "${out.crates}";\n`,
    [OUTPUTS.chart]: `${head(OUTPUTS.chart)}export const CATS = ${JSON.stringify(out.chart.CATS)};\nexport const PLACES = ${lines(out.chart.PLACES)};\n`,
    [OUTPUTS.geo]: `${head(OUTPUTS.geo)}export const GEO = ${lines(out.geo.GEO)};\n`,
    [OUTPUTS.quote]: `${head(OUTPUTS.quote)}export const CATS = ${JSON.stringify(out.quote.CATS)};\nexport const QUOTES = ${lines(out.quote.QUOTES)};\n`,
  };
  files[OUTPUTS.index] = `// The knowledge base's subjects, for Deck's coverage by subject: SUBJECTS[i] = { label, total entities }; SUBJECT[entity]
// = i. A thing with a set (country, city, painting…) is in its set's subject; a clue thing in its links' commonest aspect.
// Written by tools/build-kb.mjs from kb/: edit kb/, not this file.
export const SUBJECTS = ${JSON.stringify(out.index.SUBJECTS)};
export const SUBJECT = ${JSON.stringify(out.index.SUBJECT)};\n`;
  for (const b of CHOICE_BANKS) files[OUTPUTS[b]] = `${head(OUTPUTS[b])}export const STAGES = ${JSON.stringify(out.choice[b].STAGES)};\nexport const MATHS = ${lines(out.choice[b].MATHS)};\n`;
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await render(await build());
  let changed = 0;
  for (const [f, text] of Object.entries(files)) {
    const p = path.join(root, f);
    if (fs.existsSync(p) && fs.readFileSync(p, "utf8") === text) continue;
    if (process.argv.includes("--check")) { console.log(`${f} is out of date: run node tools/build-kb.mjs`); changed++; continue; }
    fs.writeFileSync(p, text);
    changed++;
  }
  console.log(process.argv.includes("--check") ? (changed ? `${changed} banks out of date` : "every bank is current") : `${changed} of ${Object.keys(files).length} banks written`);
  if (process.argv.includes("--check") && changed) process.exitCode = 1;
}
