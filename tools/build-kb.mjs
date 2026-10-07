// Writes the banks the games read from kb/, the knowledge base: Crates' bank (answers and their clues, from the
// entities and their clue links), Chart's places and features (from the pins and the entities they're about), Quote's
// numbers (with a painting's year taken from the painting) and Punt's knowledge banks. The games read the same
// files as before; kb/ is where knowledge is written now. Run after editing kb/: `node tools/build-kb.mjs`
// (tests/kb.mjs checks the banks are current).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(new URL("..", import.meta.url).pathname);
export const CHOICE_BANKS = ["art", "cities", "flags", "eco", "phy", "chm", "cs", "phil", "rel", "refining", "swiss", "arch", "myth", "merchants", "titles", "artmarket", "bavaria", "britain", "china", "skiing", "watches"];
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
    const { name, lat, lon, note, country, region, pic, state, marks } = of(about);
    return defined({ id, cat, name, lat, lon, note, country, region, state, marks, pic, ...over, about });
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
  // where a painting hangs is asked among art museums only (a science museum is no answer to "where does this hang?")
  const museums = ENTITIES.filter(e => e.sets.includes("museum") && e.short && (e.pinCat ?? "art") === "art");
  const ask = (p, lv, right, pool, q, area, x) => {
    const options = order(p.id + lv, [right, ...pool.slice(0, 3)]);
    return { id: `AR-G-${p.id}-${lv}`, lv, d: 3, area, q, o: options, a: [options.indexOf(right)], s: 1, x, pic: p.pic, about: [p.id] };
  };
  const out = { art: [], arch: [], myth: [], merchants: [], titles: [], artmarket: [], bavaria: [], britain: [], china: [], skiing: [], watches: [], quotes: [], pins: [] };
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
  // every museum with a position gets Chart's pin, whether or not a painting hangs in it: art museums in Art, the rest
  // (history, archaeology, science, natural history, memorials) in Museums, as their pinCat says
  for (const m of ENTITIES) {
    if (!m.sets.includes("museum") || m.lat === undefined || pinned.has(m.id)) continue;
    const cat = m.pinCat || "art";
    out.pins.push({ id: `${cat === "art" ? "ar" : "mu"}-g-${m.id}`, cat, about: m.id }); pinned.add(m.id);
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
  // links indexed once by thing and kind, and each building's style, architects and year, and each architect's mean
  // year, worked out once: the architect sort below calls them for every pair it compares, and scanning all the links
  // each time made this section most of the build's two minutes
  const byFromRel = new Map();
  for (const l of LINKS) { const k = `${l.from}|${l.rel}`; (byFromRel.get(k) || byFromRel.set(k, []).get(k)).push(l); }
  const linked = (from, rel) => (byFromRel.get(`${from}|${rel}`) || []).map(l => E.get(l.to)).filter(Boolean);
  const buildings = ENTITIES.filter(e => e.sets.includes("building") && e.pic);
  const STYLE = new Map(buildings.map(b => [b.id, linked(b.id, "style")[0]])), ARCHS = new Map(buildings.map(b => [b.id, linked(b.id, "designed-by")]));
  const styleOf = b => STYLE.get(b.id), archsOf = b => ARCHS.get(b.id);
  const styleCard = st => st.archCard || st.card, styles = ENTITIES.filter(e => e.sets.includes("architecture-style"));
  const yearOf = b => b.year ?? (styleOf(b) ? styleCard(styleOf(b)).from : 0);
  const architects = [...new Set(buildings.flatMap(archsOf))];
  const ARCH_YEAR = new Map(architects.map(a => [a, mean(buildings.filter(b => archsOf(b).includes(a)).map(yearOf))]));
  const archYear = a => ARCH_YEAR.get(a);
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
        return { id: `MY-G-${g.id}-${kind}`, lv, d: 5, area: { gods: "Gods of Greece and Rome", norse: "The Norse", egypt: "Egypt" }[lv], q, o: options, a: [options.indexOf(right)], s: 1, x, about: [g.id] }; };
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
      return { id: `MC-P-${p.id}-${kind}`, lv: "powers", d: 5, area: "Merchant powers", q, o: options, a: [options.indexOf(right)], s: 1, x, about: [p.id] }; };
    out.merchants.push(mk("traded", `Which merchant power traded ${p.traded}?`, p.title, near.map(o => o.title)));
    out.merchants.push(mk("model", `How did ${low(p.title)} do business?`, p.model, near.map(o => o.model)));
    if (p.dark) out.merchants.push(mk("dark", `Whose darkest chapter was ${p.dark}?`, p.title, near.filter(o => o.dark).map(o => o.title)));
    out.merchants.push(mk("fell", `How did ${low(p.title)} come to an end?`, p.fell, near.map(o => o.fell)));
  }

  // Titles and etiquette, from kb/: the orders by their founders and mottos, the peers' wives, the German ranks and
  // styles in English, and the dress codes both ways. Wrong names are the ones nearest in length (so no option stands out
  // by its length); a founder of two orders, or one whose name echoes the order's (Victoria, Victorian), isn't asked.
  const teQ = (lv, area, id, q, right, pool, x, about) => { const options = order(id, [right, ...pool.filter(o => o !== right).slice(0, 3)]);
    return { id, lv, d: 5, area, q, o: options, a: [options.indexOf(right)], s: 1, x, about }; };
  const teByLength = (t, xs) => [...xs].sort((a, b) => Math.abs(a.length - t.length) - Math.abs(b.length - t.length) || (a < b ? -1 : 1));
  const teOrders = ENTITIES.filter(e => e.sets.includes("chivalric-order"));
  const teFounders = teOrders.reduce((m, o) => m.set(o.founder, (m.get(o.founder) || 0) + 1), new Map());
  const teStem = w => w.toLowerCase().slice(0, 6);
  for (const o of teOrders) {
    const others = teOrders.filter(x => x !== o).map(x => x.name), x = `${o.name}: ${o.country}, founded in ${o.year} by ${o.founder}.${o.motto ? ` Motto: '${o.motto}', ${o.mottoEn}.` : ""}${o.seat ? ` Its chapel or seat: ${o.seat}.` : ""}`;
    const teEchoes = o.founder.split(/[\s,]+/).filter(w => w.length >= 5).some(w => o.name.toLowerCase().includes(teStem(w)));
    if (teFounders.get(o.founder) === 1 && !teEchoes) out.titles.push(teQ("orders", "Orders and honours", `TE-G-${o.id}-founder`, `Which order did ${o.founder} found?`, o.name, teByLength(o.name, others.filter(n => teOrders.find(y => y.name === n).founder !== o.founder)), x, [o.id]));
    if (o.motto) out.titles.push(teQ("orders", "Orders and honours", `TE-G-${o.id}-motto`, `Whose motto is '${o.motto}' (${o.mottoEn})?`, o.name, teByLength(o.name, others), x, [o.id]));
  }
  const teRanks = ENTITIES.filter(e => e.sets.includes("peerage-rank")).sort((a, b) => a.rank - b.rank);
  for (const r of teRanks) out.titles.push(teQ("peerage", "The peerage", `TE-G-${r.id}-wife`, `The wife of a ${r.name.toLowerCase()} is a`, r.wife, teRanks.filter(o => o !== r).map(o => o.wife),
    `A ${r.name.toLowerCase()}'s wife is a ${r.wife}. The ranks, from the top: duke, marquess, earl, viscount, baron.`, [r.id]));
  const teDe = ENTITIES.filter(e => e.sets.includes("german-rank")).sort((a, b) => a.rank - b.rank);
  for (const r of teDe) { const near = [...teDe].filter(o => o !== r).sort((a, b) => Math.abs(a.rank - r.rank) - Math.abs(b.rank - r.rank) || a.rank - b.rank);
    out.titles.push(teQ("abroad", "Nobility abroad", `TE-G-${r.id}`, `A ${r.name} is, in English, a`, r.english, near.map(o => o.english), `${r.name}: ${r.english}. In order, the German ranks run ${teDe.map(o => o.name).join(", ")}.`, [r.id])); }
  const teStyles = ENTITIES.filter(e => e.sets.includes("german-style"));
  for (const t of teStyles) out.titles.push(teQ("abroad", "Nobility abroad", `TE-G-${t.id}`, `'${t.name}' is the German style for`, t.english, teByLength(t.english, teStyles.filter(o => o !== t).map(o => o.english)),
    `${t.name}: ${t.english}. ${teStyles.filter(o => o !== t).map(o => `${o.name}, ${o.english}`).join("; ")}.`, [t.id]));
  const teCodes = ENTITIES.filter(e => e.sets.includes("dress-code"));
  for (const c of teCodes) { const x = `${c.name}: for men, ${c.men}; worn at ${c.when}.`;
    out.titles.push(teQ("dress", "Dress codes", `TE-G-${c.id}-means`, `Which dress code means ${c.men}?`, c.name, teByLength(c.name, teCodes.filter(o => o !== c).map(o => o.name)), x, [c.id]));
    out.titles.push(teQ("dress", "Dress codes", `TE-G-${c.id}-when`, `${c.name} is worn at`, c.when, teByLength(c.when, teCodes.filter(o => o !== c).map(o => o.when)), x, [c.id])); }

  // The art market, from kb/: the auction houses by where and when they began (most are named after their founders, so
  // a founder would give the house away), the dealers by the artists they made, the forgers by whom they faked and how
  // they were caught. The wrong answers are the names or accounts nearest in length.
  const amQ = (lv, area, id, q, right, pool, x, about) => { const options = order(id, [right, ...pool.filter(o => o !== right).slice(0, 3)]);
    return { id, lv, d: 5, area, q, o: options, a: [options.indexOf(right)], s: 1, x, about }; };
  const amNear = (t, xs) => [...xs].sort((a, b) => Math.abs(a.length - t.length) - Math.abs(b.length - t.length) || (a < b ? -1 : 1));
  const amHouses = ENTITIES.filter(e => e.sets.includes("auction-house"));
  for (const h of amHouses) out.artmarket.push(amQ("dealers", "Houses and dealers", `AM-G-${h.id}`, `Which auction house was founded in ${h.city} in ${h.year}?`, h.name,
    amNear(h.name, amHouses.filter(o => o !== h).map(o => o.name)), `${h.name}: founded in ${h.city} in ${h.year} by ${h.founder}.`, [h.id]));
  const amDealers = ENTITIES.filter(e => e.sets.includes("art-dealer"));
  for (const d of amDealers) out.artmarket.push(amQ("dealers", "Houses and dealers", `AM-G-${d.id}`, `Which dealer championed ${d.championed}?`, d.name,
    amNear(d.name, amDealers.filter(o => o !== d).map(o => o.name)), `${d.name} championed ${d.championed}.`, [d.id]));
  const amForgers = ENTITIES.filter(e => e.sets.includes("art-forger"));
  for (const f of amForgers) { const x = `${f.name} forged ${f.faked}; the fakes were exposed by ${f.caught}.`;
    out.artmarket.push(amQ("fakes", "Fakes", `AM-G-${f.id}-faked`, `Who forged ${f.faked}?`, f.name, amNear(f.name, amForgers.filter(o => o !== f).map(o => o.name)), x, [f.id]));
    out.artmarket.push(amQ("fakes", "Fakes", `AM-G-${f.id}-caught`, `What exposed ${f.name}'s fakes?`, f.caught, amNear(f.caught, amForgers.filter(o => o !== f).map(o => o.caught)), x, [f.id])); }

  // Bavaria, from kb/: the seven districts by their capitals, the companies by their home towns, the Bairisch words by
  // what they mean. The wrong answers are the other districts' capitals, the other companies' towns, the other words'
  // meanings, the nearest in length first.
  // difficulty, on Punt's scale of 1 to 10: a district's capital or a company's town is harder than a word (Ansbach,
  // Zirndorf); the house prices by it
  const byQ = (lv, area, id, q, right, pool, x, about, d = lv === "language" ? 2 : 5) => { const options = order(id, [right, ...[...new Set(pool)].filter(o => o !== right).slice(0, 3)]);
    return { id, lv, d, area, q, o: options, a: [options.indexOf(right)], s: 1, x, about }; };
  const byNear = (t, xs) => [...xs].sort((a, b) => Math.abs(a.length - t.length) - Math.abs(b.length - t.length) || (a < b ? -1 : 1));
  const byDistricts = ENTITIES.filter(e => e.sets.includes("bavarian-district"));
  for (const d of byDistricts) out.bavaria.push(byQ("places", "Places", `BY-G-${d.id}`, `Which city is the capital of ${d.name}?`, d.capital,
    byNear(d.capital, byDistricts.filter(o => o !== d).map(o => o.capital)), `The seven districts and their capitals: ${byDistricts.map(o => `${o.name}, ${o.capital}`).join("; ")}.`, [d.id]));
  const byCompanies = ENTITIES.filter(e => e.sets.includes("bavarian-company") && e.town);
  for (const c of byCompanies) out.bavaria.push(byQ("business", "Business", `BY-G-${c.id}`, `Where is ${c.name} (${c.makes}) based?`, c.town,
    byNear(c.town, byCompanies.map(o => o.town)), `${c.name} is based in ${c.town}.`, [c.id]));
  const byWords = ENTITIES.filter(e => e.sets.includes("bavarian-word") && e.meaning);
  for (const w of byWords) out.bavaria.push(byQ("language", "Bairisch", `BY-G-${w.id}`, `What does the Bavarian '${w.name}' mean?`, w.meaning,
    byNear(w.meaning, byWords.filter(o => o !== w).map(o => o.meaning)), `${w.name}: ${w.meaning}.`, [w.id]));

  // Britain and Scotland, from kb/: the Scots words by meaning, the distilleries by whisky region, the inventors by what
  // they gave the world. The wrong answers are the other words' meanings, the other regions, the other inventors.
  // difficulty, on Punt's scale of 1 to 10: a distillery's region is harder than a word or an inventor; the house prices by it
  const gbQ = (lv, area, id, q, right, pool, x, about, d = lv === "whisky" ? 5 : 2) => { const options = order(id, [right, ...[...new Set(pool)].filter(o => o !== right).slice(0, 3)]);
    return { id, lv, d, area, q, o: options, a: [options.indexOf(right)], s: 1, x, about }; };
  const gbNear = (t, xs) => [...xs].sort((a, b) => Math.abs(a.length - t.length) - Math.abs(b.length - t.length) || (a < b ? -1 : 1));
  const gbWords = ENTITIES.filter(e => e.sets.includes("scots-word") && e.meaning);
  for (const w of gbWords) out.britain.push(gbQ("words", "Scots words", `GB-G-${w.id}`, `What does the Scots '${w.name}' mean?`, w.meaning,
    gbNear(w.meaning, gbWords.filter(o => o !== w).map(o => o.meaning)), `${w.name}: ${w.meaning}.`, [w.id]));
  const gbStills = ENTITIES.filter(e => e.sets.includes("distillery") && e.whiskyRegion), gbRegions = [...new Set(gbStills.map(d => d.whiskyRegion))];
  for (const d of gbStills) out.britain.push(gbQ("whisky", "Whisky", `GB-G-${d.id}`, `Which whisky region is ${d.name} distilled in?`, d.whiskyRegion,
    order(d.id + "r", gbRegions), `${d.name} is a ${d.whiskyRegion} malt. The five regions: Speyside, Highland, Lowland, Islay and Campbeltown.`, [d.id]));
  const gbMakers = ENTITIES.filter(e => e.sets.includes("scottish-inventor") && e.gave);
  for (const m of gbMakers) out.britain.push(gbQ("science", "Scottish inventors", `GB-G-${m.id}`, `Which Scot gave the world ${m.gave}?`, m.name,
    gbNear(m.name, gbMakers.filter(o => o !== m).map(o => o.name)), `${m.name}: ${m.gave}.`, [m.id]));

  // China, from kb/: the provinces by capital, the dishes by cuisine, the teas by kind and province, the futures by
  // exchange, the idioms by meaning, the festivals by custom, the thinkers by teaching. Difficulty on Punt's scale of 1 to 10.
  const cnQ = (lv, area, id, q, right, pool, x, about, d) => { const options = order(id, [right, ...[...new Set(pool)].filter(o => o !== right).slice(0, 3)]);
    return { id, lv, d, area, q, o: options, a: [options.indexOf(right)], s: 1, x, about }; };
  const cnNear = (t, xs) => [...xs].sort((a, b) => Math.abs(a.length - t.length) - Math.abs(b.length - t.length) || (a < b ? -1 : 1));
  const cnOf = set => ENTITIES.filter(e => e.sets.includes(set));
  const cnProv = cnOf("chinese-province");
  for (const p of cnProv) out.china.push(cnQ("geography", "Provinces and places", `CN-G-${p.id}`, `What is the capital of ${p.name}?`, p.capital,
    cnNear(p.capital, cnProv.filter(o => o !== p).map(o => o.capital)), `${p.name}'s capital is ${p.capital}.`, [p.id], 4));
  const cnCuisines = ["Sichuan", "Cantonese", "Shandong", "Jiangsu", "Zhejiang", "Fujian", "Hunan", "Anhui"];
  for (const d of cnOf("chinese-dish")) out.china.push(cnQ("food", "Food", `CN-G-${d.id}`, `Which of China's eight great cuisines does ${d.name} come from?`, d.cuisine,
    order(d.id + "c", cnCuisines), `${d.name} is ${d.cuisine === "Cantonese" ? "Cantonese" : `from ${d.cuisine}'s cuisine`}. The eight: ${cnCuisines.join(", ")}.`, [d.id], 5));
  const cnBase = t => t.split(",")[0], cnTypes = ["green", "white", "yellow", "oolong", "black", "dark"], cnTeaProv = [...new Set(cnOf("chinese-tea").map(t => t.province))];
  for (const t of cnOf("chinese-tea")) { const x = `${t.name}: ${t.teaType} tea, from ${t.province}.`;
    out.china.push(cnQ("tea", "Tea", `CN-G-${t.id}-kind`, `What kind of tea is ${t.name}?`, cnBase(t.teaType), order(t.id + "k", cnTypes), x, [t.id], 4));
    out.china.push(cnQ("tea", "Tea", `CN-G-${t.id}-from`, `Which province does ${t.name} come from?`, t.province, order(t.id + "p", cnTeaProv), x, [t.id], 5)); }
  const cnEx = cnOf("futures-exchange");
  for (const e of cnEx) for (const c of e.contracts || []) out.china.push(cnQ("trade", "Trade and markets", `CN-G-${e.id}-${c.replace(/[^a-z]+/gi, "-").toLowerCase()}`,
    `Where do ${c} futures trade?`, e.name, order(e.id + c, cnEx.map(o => o.name)), `${c[0].toUpperCase() + c.slice(1)} futures trade on ${e.name.replace(/^The /, "the ")}.`, [e.id], 6));
  const cnIdioms = cnOf("chengyu");
  for (const i of cnIdioms) out.china.push(cnQ("culture", "Festivals and language", `CN-G-${i.id}`, `The idiom ${i.name}, '${i.literal}', means`, i.meaning,
    cnNear(i.meaning, cnIdioms.filter(o => o !== i).map(o => o.meaning)), `${i.name}: '${i.literal}': ${i.meaning}.`, [i.id], 4));
  const cnFest = cnOf("chinese-festival");
  for (const f of cnFest) out.china.push(cnQ("culture", "Festivals and language", `CN-G-${f.id}`, `Which festival brings ${f.custom}?`, f.called,
    cnNear(f.called, cnFest.filter(o => o !== f).map(o => o.called)), `${f.name}: ${f.custom}.`, [f.id], 3));
  const cnThink = cnOf("chinese-thinker");
  for (const t of cnThink) out.china.push(cnQ("thought", "Thinkers", `CN-G-${t.id}`, `Who taught ${t.taught}?`, t.name,
    cnNear(t.name, cnThink.filter(o => o !== t).map(o => o.name)), `${t.name}: ${t.taught}.`, [t.id], 4));

  // Skiing, from kb/: the resorts by country and by linked ski area, the races and runs by resort, the great skiers by
  // what they did. Difficulty on Punt's scale of 1 to 10.
  const skQ = (lv, area, id, q, right, pool, x, about, d) => { const options = order(id, [right, ...[...new Set(pool)].filter(o => o !== right).slice(0, 3)]);
    return { id, lv, d, area, q, o: options, a: [options.indexOf(right)], s: 1, x, about }; };
  const skNear = (t, xs) => [...xs].sort((a, b) => Math.abs(a.length - t.length) - Math.abs(b.length - t.length) || (a < b ? -1 : 1));
  const skResorts = ENTITIES.filter(e => e.sets.includes("ski-resort")), skCountry = r => r.resortCountry || r.country;
  const skCountries = [...new Set(skResorts.map(skCountry))];
  // an Alpine resort's wrong countries are the other Alpine ones: Cervinia against Switzerland, not against Japan
  const skAlpine = [...new Set(skResorts.filter(r => r.lat).map(skCountry))];
  for (const r of skResorts) out.skiing.push(skQ("resorts", "Resorts", `SK-G-${r.id}-country`, `Which country is ${r.name} in?`, skCountry(r), order(r.id + "c", r.lat ? skAlpine : skCountries),
    `${r.name} is in ${skCountry(r)}.${r.note ? ` ${r.note}` : ""}`, [r.id], 3));
  const skAreas = [...new Set(skResorts.map(r => r.skiArea).filter(Boolean))];
  for (const r of skResorts.filter(r => r.skiArea)) out.skiing.push(skQ("areas", "Ski areas", `SK-G-${r.id}-area`, `Which linked ski area is ${r.name} part of?`, r.skiArea,
    skNear(r.skiArea, skAreas), `${r.name} is part of ${r.skiArea}.`, [r.id], 5));
  const skByID = new Map(skResorts.map(r => [r.id, r]));
  for (const race of ENTITIES.filter(e => e.sets.includes("ski-race") && skByID.has(e.at))) { const at = skByID.get(race.at);
    out.skiing.push(skQ("races", "Races and runs", `SK-G-${race.id}`, `Where would you find ${race.called}?`, at.name,
      skNear(at.name, skResorts.filter(r => r.lat && r !== at).map(r => r.name)), `${race.called[0].toUpperCase() + race.called.slice(1)}: at ${at.name}.`, [race.id, at.id], 5)); }
  const skGreats = ENTITIES.filter(e => e.sets.includes("great-skier") && e.feat);
  for (const s of skGreats) out.skiing.push(skQ("skiers", "Great skiers", `SK-G-${s.id}`, `Who ${s.feat}?`, s.name,
    skNear(s.name, skGreats.filter(o => o !== s).map(o => o.name)), `${s.name} ${s.feat}.`, [s.id], 4));

  // Watches, from kb/: the manufactures by home town (unless the name says it), owner and signature; the complications,
  // movement parts and finishes by what they do, each with its picture where its Wikipedia page shows one.
  const wtQ = (lv, area, id, q, right, pool, x, about, d, pic) => { const options = order(id, [right, ...[...new Set(pool)].filter(o => o !== right).slice(0, 3)]);
    return { id, lv, d, area, q, o: options, a: [options.indexOf(right)], s: 1, x, about, ...(pic ? { pic } : {}) }; };
  const wtNear = (t, xs) => [...xs].sort((a, b) => Math.abs(a.length - t.length) - Math.abs(b.length - t.length) || (a < b ? -1 : 1));
  const wtBrands = ENTITIES.filter(e => e.sets.includes("watch-brand") && e.town);
  const wtOwner = g => ({ independent: "independent owners", Richemont: "the Richemont group", LVMH: "the LVMH group" })[g] || g, wtOwners = ["the Swatch Group", "the Richemont group", "the LVMH group", "independent owners"];
  for (const b of wtBrands) { const x = `${b.name}: founded ${b.founded}, made in ${b.town}, ${b.group === "independent" ? "independent" : `part of ${b.group}`}; known for ${b.signature}.`;
    if (!b.name.toLowerCase().includes(b.town.toLowerCase())) out.watches.push(wtQ("makers", "The manufactures", `WT-G-${b.id}-town`, `Where does ${b.name} make its watches?`, b.town,
      wtNear(b.town, wtBrands.map(o => o.town)), x, [b.id], 4));
    out.watches.push(wtQ("makers", "The manufactures", `WT-G-${b.id}-owner`, `Who owns ${b.name}?`, wtOwner(b.group), order(b.id + "o", wtOwners), x, [b.id], 5));
    out.watches.push(wtQ("makers", "The manufactures", `WT-G-${b.id}-known`, `Which house is known for ${b.signature}?`, b.name, wtNear(b.name, wtBrands.filter(o => o !== b).map(o => o.name)), x, [b.id], 4)); }
  for (const [set, lv, area, ask, d] of [["complication", "complications", "Complications", t => `Which complication shows ${t}?`, 4],
    ["movement-part", "movement", "Inside the movement", t => `Which part ${t}?`, 4], ["watch-finish", "finishes", "Finishes", t => `Which finish is ${t}?`, 5]]) {
    const all = ENTITIES.filter(e => e.sets.includes(set) && (e.does || e.desc));
    for (const e of all) { const what = e.does || e.desc;
      out.watches.push(wtQ(lv, area, `WT-G-${e.id}`, ask(what), e.name, wtNear(e.name, all.filter(o => o !== e).map(o => o.name)), `${e.name}: ${what}.`, [e.id], d, e.pic)); }
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
