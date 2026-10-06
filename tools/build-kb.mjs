// Writes the banks the games read from kb/, the knowledge base: Crates' bank (answers and their clues, from the
// entities and their clue links), Chart's places and features (from the pins and the entities they're about), Quote's
// numbers (with a painting's year taken from the painting) and Punt's knowledge banks. The games read the same
// files as before; kb/ is where knowledge is written now. Run after editing kb/: `node tools/build-kb.mjs`
// (tests/kb.mjs checks the banks are current).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(new URL("..", import.meta.url).pathname);
export const CHOICE_BANKS = ["art", "cities", "flags", "eco", "phy", "chm", "cs", "phil", "rel", "refining", "swiss", "arch", "myth", "merchants"];
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

  const gen = written(ENTITIES, LINKS, E, await load("items/choice/art.js").then(m => m.ITEMS), estimates.ESTIMATES, pins.PINS);
  // Chart: each pin shows its entity, with the pin's own overrides
  const PLACES = [...pins.PINS, ...gen.pins].map(({ id, cat, about, ...over }) => {
    const { name, lat, lon, note, country, region, pic } = of(about);
    return defined({ id, cat, name, lat, lon, note, country, region, pic, ...over, about });
  });
  const GEO = pins.FEATURES.map(({ id, about, ...over }) => {
    const { name, kind, region, country, note, lat, lon } = of(about);
    return defined({ id, name, kind, region, country, note, lat, lon, ...over, about, ...GEOMETRY[about] });
  });

  // Quote: a number that's an entity's fact comes from the entity
  const QUOTES = [...estimates.ESTIMATES, ...gen.quotes].map(({ fact, ...q }) => {
    if (!fact) return q;
    const e = of(q.about);
    return defined({ ...q, truth: q.truth ?? e[fact], pic: q.pic ?? (fact === "year" ? e.pic : undefined) });
  });

  // Punt: the questions as written, with what they're about
  const choice = {};
  for (const b of CHOICE_BANKS) {
    const m = await load(`items/choice/${b}.js`);
    choice[b] = { STAGES: m.STAGES, MATHS: [...m.ITEMS, ...(gen[b] || [])] };
  }
  return { crates, chart: { CATS: pins.CATS, PLACES }, geo: { GEO }, quote: { CATS: estimates.CATS, QUOTES }, choice, index: await subjects(ENTITIES, LINKS) };
}

// Questions the knowledge base writes itself. A painting with its painter, museum, movement, year and picture gets Punt's
// who, where and movement questions and Quote's year, unless it already has hand-written ones; a museum with a position
// gets Chart's pin unless it has one. So a painting added to kb/ (an entity and three links) reaches all three games at
// once. Wrong options are things of the same kind, nearest first: painters of the same movement, then of the nearest
// years; movements of the nearest years; museums Chart can pin, then the rest. The options' order and the ids come from
// the entity, so the same build always writes the same questions, and the pile keeps track of them.
function written(ENTITIES, LINKS, E, art, estimates, pins) {
  const one = (from, rel) => E.get(LINKS.find(l => l.from === from && l.rel === rel)?.to);
  const has = new Set(art.flatMap(q => (q.about || []).map(id => `${id}:${q.lv}`)));
  const quoted = new Set(estimates.filter(q => q.fact === "year").map(q => q.about));
  const pinned = new Set(pins.map(p => p.about));
  const paintings = ENTITIES.filter(e => e.sets.includes("painting") && Number.isFinite(e.year) && e.pic);
  const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const order = (key, xs) => xs.map(x => [hash(`${key}/${x}`), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  const mean = xs => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const yearsBy = rel => { const m = new Map(); for (const p of paintings) { const t = one(p.id, rel); if (t) (m.get(t.id) || m.set(t.id, []).get(t.id)).push(p); } return m; };
  const byPainter = yearsBy("painted-by"), byMovement = yearsBy("movement");
  const museums = ENTITIES.filter(e => e.sets.includes("museum") && e.short);
  const ask = (p, lv, right, pool, q, area, x) => {
    const options = order(p.id + lv, [right, ...pool.slice(0, 3)]);
    return { id: `AR-G-${p.id}-${lv}`, lv, d: 3, area, q, o: options, a: [options.indexOf(right)], s: 1, x, pic: p.pic, about: [p.id] };
  };
  const out = { art: [], arch: [], myth: [], merchants: [], quotes: [], pins: [] };
  for (const p of paintings) {
    const painter = one(p.id, "painted-by"), museum = one(p.id, "hangs-in"), movement = one(p.id, "movement");
    if (!painter || !museum || !movement) continue;
    const dated = `${p.name}, ${painter.name}, ${p.circa ? "c. " : ""}${p.year}`;
    if (!has.has(`${p.id}:who`)) {
      const pool = [...byPainter.keys()].filter(id => id !== painter.id).map(id => E.get(id))
        .sort((a, b) => (byPainter.get(a.id).some(x => one(x.id, "movement") === movement) ? 0 : 1e4) + Math.abs(mean(byPainter.get(a.id).map(x => x.year)) - p.year)
          - ((byPainter.get(b.id).some(x => one(x.id, "movement") === movement) ? 0 : 1e4) + Math.abs(mean(byPainter.get(b.id).map(x => x.year)) - p.year)));
      out.art.push(ask(p, "who", painter.name, pool.map(e => e.name), "Who painted this?", "Who painted it", `${dated}.`));
    }
    if (!has.has(`${p.id}:where`)) {
      const pool = order(p.id, museums.filter(m => m !== museum)).sort((a, b) => (a.lat === undefined) - (b.lat === undefined));
      out.art.push(ask(p, "where", museum.short, pool.map(m => m.short), "Where does this hang?", "Where it hangs", `${p.name} (${painter.name}) hangs in ${museum.short}.`));
    }
    if (!has.has(`${p.id}:when`)) {
      const pool = [...byMovement.keys()].filter(id => id !== movement.id).map(id => E.get(id))
        .sort((a, b) => Math.abs(mean(byMovement.get(a.id).map(x => x.year)) - p.year) - Math.abs(mean(byMovement.get(b.id).map(x => x.year)) - p.year));
      out.art.push(ask(p, "when", movement.name, pool.map(e => e.name), "Which movement or period does this belong to?", "Movement & period", `${dated}: ${movement.name}.`));
    }
    if (!quoted.has(p.id)) out.quotes.push({ id: `ar-g-${p.id}`, cat: "art", q: "The year this was painted", unit: "year", scale: 25, tol: 5, note: `${dated}.`,
      tiers: { SS: 0, S: 5, A: 15, B: 30 }, d: 4, about: p.id, fact: "year" });
    if (museum.lat !== undefined && !pinned.has(museum.id)) { out.pins.push({ id: `ar-g-${museum.id}`, cat: "art", about: museum.id }); pinned.add(museum.id); }
  }
  // Ideas, so knowing a movement or a style means more than sorting its pictures: each with a card (when and where;
  // what it rejected; what it sought; how to spot it; what lay behind it; what came next) gets up to four questions.
  // Which one rejected this, and which sought that, offer names; how to spot it and what lay behind it offer the
  // others' own lines, so every wrong answer is true of something. Nearest in time first; on "against", never one of
  // the same family (the Renaissances, the abstractions…), whose reasons overlap; never one the question names, even
  // by a stem ("…against Neoclassical reason"). The card is the explanation. Art movements use their card; a style of
  // building its archCard where it's also a movement (the Baroque, the Rococo…), so each bank asks about its own art.
  const cardQuestions = (set, cardOf, prefix, lv, area, kind) => {
    const carded = ENTITIES.filter(e => e.sets.includes(set) && cardOf(e)).sort((a, b) => cardOf(a).from - cardOf(b).from);
    const near = (m, keep) => carded.filter(o => o !== m && keep(o))
      .sort((a, b) => Math.abs(cardOf(a).from - cardOf(m).from) - Math.abs(cardOf(b).from - cardOf(m).from) || (a.id < b.id ? -1 : 1));
    const text = m => { const c = cardOf(m); return `${m.name} (${c.where}, ${c.span}).${c.against ? ` Against ${c.against}.` : ""} Seeking ${c.aim}. Spot it by ${c.tells}. Behind it: ${c.context}. Next: ${c.then}.`; };
    const ask = (m, facet, q, right, pool) => {
      const options = order(m.id + facet, [right, ...pool.slice(0, 3)]);
      return { id: `${prefix}-${m.id}-${facet}`, lv, d: 5, area, q, o: options, a: [options.indexOf(right)], s: 1, x: text(m), about: [m.id] };
    };
    const qs = [];
    for (const m of carded) {
      const c = cardOf(m), any = () => true, unnamed = t => o => !t.toLowerCase().includes(o.name.toLowerCase().slice(0, 8));
      if (c.against) qs.push(ask(m, "against", `Which ${kind} was reacting against ${c.against}?`, m.name, near(m, o => cardOf(o).family !== c.family && unnamed(c.against)(o)).map(o => o.name)));
      qs.push(ask(m, "aim", `Which ${kind} was seeking ${c.aim}?`, m.name, near(m, unnamed(c.aim)).map(o => o.name)));
      qs.push(ask(m, "tells", `How do you spot ${m.name}?`, c.tells, near(m, any).map(o => cardOf(o).tells)));
      qs.push(ask(m, "context", `What lay behind ${m.name}?`, c.context, near(m, any).map(o => cardOf(o).context)));
    }
    return qs;
  };
  out.art.push(...cardQuestions("art-movement", e => e.card, "AR-I", "ideas", "Movements as ideas", "movement"));
  out.arch.push(...cardQuestions("architecture-style", e => e.archCard || e.card, "AH-S", "styles", "Styles as ideas", "style"));

  // Buildings, by sight: which style is this, who designed it (with its picture); the year it was completed and its
  // height for Quote and Order; and a pin for Chart. Styles nearest the building's date, never one of its own family
  // (a Gothic Revival hall isn't asked against the Gothic); architects nearest in their buildings' years.
  const linked = (from, rel) => LINKS.filter(l => l.from === from && l.rel === rel).map(l => E.get(l.to)).filter(Boolean);
  const buildings = ENTITIES.filter(e => e.sets.includes("building") && e.pic);
  const styleOf = b => linked(b.id, "style")[0], archsOf = b => linked(b.id, "designed-by");
  const styleCard = st => st.archCard || st.card, styles = ENTITIES.filter(e => e.sets.includes("architecture-style"));
  const yearOf = b => b.year ?? (styleOf(b) ? styleCard(styleOf(b)).from : 0);
  const architects = [...new Set(buildings.flatMap(archsOf))], archYear = a => mean(buildings.filter(b => archsOf(b).includes(a)).map(yearOf));
  for (const b of buildings) {
    const st = styleOf(b), as = archsOf(b), who = as.map(a => a.name).join(" and ");
    const x = `${b.name}${who ? `, by ${who}` : ""}${b.year ? `, ${b.circa ? "c. " : ""}${b.year}` : ""}${st ? `: ${st.name}` : ""}.${b.note ? ` ${b.note}` : ""}`;
    const ask = (kind, q, right, pool) => {
      const options = order(b.id + kind, [right, ...pool.slice(0, 3)]);
      return { id: `AH-B-${b.id}-${kind}`, lv: "buildings", d: 4, area: "Buildings", q, o: options, a: [options.indexOf(right)], s: 1, x, pic: b.pic, about: [b.id] };
    };
    if (st) out.arch.push(ask("style", "Which style is this?", st.name, styles.filter(o => o !== st && styleCard(o).family !== styleCard(st).family)
      .sort((p, q) => Math.abs(styleCard(p).from - yearOf(b)) - Math.abs(styleCard(q).from - yearOf(b)) || (p.id < q.id ? -1 : 1)).map(o => o.name)));
    if (as.length) out.arch.push(ask("who", "Who designed this?", as[0].name, architects.filter(a => !as.includes(a))
      .sort((p, q) => Math.abs(archYear(p) - yearOf(b)) - Math.abs(archYear(q) - yearOf(b)) || (p.id < q.id ? -1 : 1)).map(a => a.name)));
    if (b.year > 1000 && !quoted.has(b.id)) out.quotes.push({ id: `ah-y-${b.id}`, cat: "art", q: "The year this was completed", unit: "year", scale: 25, tol: 5,
      note: `${b.name}${who ? `, by ${who}` : ""}, ${b.circa ? "about " : ""}${b.year}.`, tiers: { SS: 0, S: 5, A: 15, B: 30 }, d: 4, about: b.id, fact: "year" });
    if (Number.isFinite(b.height)) out.quotes.push({ id: `ah-h-${b.id}`, cat: "art", q: "This building's height, to its tip", unit: "metres", scale: "log", tol: 0.03,
      tiers: { SS: 0.006, S: 0.045, A: 0.105, B: 0.21 }, d: 4, about: b.id, fact: "height", pic: b.pic, note: `${b.name}: ${b.height} metres.` });
  }
  for (const b of ENTITIES.filter(e => e.sets.includes("building") && e.lat !== undefined)) if (!pinned.has(b.id)) { out.pins.push({ id: `ah-p-${b.id}`, cat: "architecture", about: b.id }); pinned.add(b.id); }

  // The gods, asked by what they ruled and by their signs, and the Greeks by their Roman names: the wrong answers are
  // the other gods of the same pantheon, in an order fixed by the god. A domain or a sign never names its own god.
  const cap = t => t[0].toUpperCase() + t.slice(1);
  for (const [set, lv, who, signOf, signQ] of [["greek-god", "gods", "Greek", "symbol", t => `${cap(t)}: which god's sign?`],
    ["norse-god", "norse", "Norse", "symbol", t => `${cap(t)}: which god's?`], ["egyptian-god", "egypt", "Egyptian", "form", t => `Shown as ${t}: which god?`]]) {
    const gods = ENTITIES.filter(e => e.sets.includes(set) && e.domain);
    for (const g of gods) {
      const rest = order(g.id, gods.filter(o => o !== g)), x = `${g.name}${g.roman ? ` (to the Romans, ${g.roman})` : ""}: ${g.domain}; ${g[signOf]}.`;
      const mk = (kind, q, right, pool) => { const options = order(g.id + kind, [right, ...pool.slice(0, 3)]);
        return { id: `MY-G-${g.id}-${kind}`, lv, d: 3, area: { gods: "Gods of Greece and Rome", norse: "The Norse", egypt: "Egypt" }[lv], q, o: options, a: [options.indexOf(right)], s: 1, x, about: [g.id] }; };
      out.myth.push(mk("domain", `${cap(g.domain)}: which ${who} god?`, g.name, rest.map(o => o.name)));
      out.myth.push(mk("sign", signQ(g[signOf]), g.name, rest.map(o => o.name)));
      if (g.roman) out.myth.push(mk("roman", `What did the Romans call ${g.name}?`, g.roman, rest.filter(o => o.roman).map(o => o.roman)));
    }
  }

  // The merchant powers, each asked from its card: what it traded and its darkest chapter (name the power), how it did
  // business and how it ended (pick its account). The wrong answers are the other powers', the nearest in time first, so
  // the VOC is weighed against the East India Company and the Hanse against Venice; a power with no fair darkest
  // chapter on its card isn't asked one.
  const powers = ENTITIES.filter(e => e.sets.includes("merchant-power") && e.traded);
  const startOf = p => +(p.span.match(/\d{3,4}/) || [0])[0], low = t => t.replace(/^The /, "the ");
  for (const p of powers) {
    const near = powers.filter(o => o !== p).sort((a, b) => Math.abs(startOf(a) - startOf(p)) - Math.abs(startOf(b) - startOf(p)) || (a.id < b.id ? -1 : 1));
    const x = `${p.title} (${p.span}; ${p.where}). Traded ${p.traded}. Did business through ${p.model}. Run as ${p.ruled}.${p.dark ? ` Darkest chapter: ${p.dark}.` : ""} The end: ${p.fell}. It left ${p.then}.`;
    const mk = (kind, q, right, pool) => { const options = order(p.id + kind, [right, ...pool.slice(0, 3)]);
      return { id: `MC-P-${p.id}-${kind}`, lv: "powers", d: 3, area: "Merchant powers", q, o: options, a: [options.indexOf(right)], s: 1, x, about: [p.id] }; };
    out.merchants.push(mk("traded", `Which merchant power traded ${p.traded}?`, p.title, near.map(o => o.title)));
    out.merchants.push(mk("model", `How did ${low(p.title)} do business?`, p.model, near.map(o => o.model)));
    if (p.dark) out.merchants.push(mk("dark", `Whose darkest chapter was ${p.dark}?`, p.title, near.filter(o => o.dark).map(o => o.title)));
    out.merchants.push(mk("fell", `How did ${low(p.title)} come to an end?`, p.fell, near.map(o => o.fell)));
  }

  // Reading a building: each part both ways, what it is (other parts' definitions as the wrong answers, its own kind first)
  // and what it's called. A definition never echoes the name it defines.
  const terms = ENTITIES.filter(e => e.sets.includes("architecture-term") && e.def);
  const others = t => { const o = order(t.id, terms.filter(u => u !== t)); return [...o.filter(u => u.family === t.family), ...o.filter(u => u.family !== t.family)]; };
  for (const t of terms) {
    const x = `${t.name}: ${t.def}.`, mk = (kind, q, right, pool) => { const options = order(t.id + kind, [right, ...pool.slice(0, 3)]);
      return { id: `AH-T-${t.id}-${kind}`, lv: "parts", d: 3, area: "Reading a building", q, o: options, a: [options.indexOf(right)], s: 1, x, about: [t.id] }; };
    out.arch.push(mk("what", `${t.name}: what is it?`, t.def, others(t).map(u => u.def)));
    out.arch.push(mk("name", `What do you call ${t.def}?`, t.name, others(t).map(u => u.name)));
  }
  return out;
}

// What each entity is a matter of, for coverage by subject across the games. A thing with a set the knowledge base
// knows (a country, a city, a painting…) is in that set's subject; a clue thing with a kind (a person, a company, a
// festival…, given by tools/kb-kinds.mjs or by hand) in its kind's; any other in the subject of its links' commonest
// aspect, by its label in Crates' topics (History, Food & drink…).
const SET_SUBJECT = [["country", "Countries"], ["commodity", "Commodities"], ["painting", "Paintings"], ["painter", "Painters"],
  ["art-movement", "Art movements"], ["museum", "Museums"], ["art-place", "Sites & structures"], ["city", "Cities"], ["trade-place", "Ports, plants and trade"],
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
