// Writes the knowledge the games hold apart from kb/ into kb/, so the Almanac and the knowledge graph have all of it (Korbi, 9 Nov
// 2026: Dispatch, Census, Spyglass, Crossing): Census's set members (an existing thing is tagged `census:<set>` in its `sets`; a member
// kb/ lacks becomes a thing of its own), Crossing's land borders (a `borders` link per pair), its sea (waters, ports and inland
// places become things; `sea-lane`, `port-on` and `inland-of` links). Spyglass shows kb/'s own paintings, flags and country outlines, so
// it needs nothing here (tests/games-kb.mjs holds that). Dispatch has tools/dispatch-to-kb.mjs. Safe to run again; after it run
// `node tools/audit-marks.mjs` and `node tools/build-kb.mjs`. The tags are eligibility: they say where a thing is played, not what it is.
import fs from "node:fs";
import { SETS } from "../census-sets.js";
import { COUNTRIES } from "../chart-countries.js";
import { WATERS, LANES, PORTS, INLAND } from "../crossing-sea-data.js";
const root = new URL("../kb/", import.meta.url).pathname;
const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const slug = s => fold(s).replace(/ /g, "-");
const ent = fs.readFileSync(root + "entities.js", "utf8").split("\n"), lnk = fs.readFileSync(root + "links.js", "utf8").split("\n");
const parse = l => { try { return JSON.parse(l.replace(/,\s*$/, "")); } catch { return null; } };
const rows = new Map(), byName = new Map(), extra = [], linkLines = [], patched = new Set();
ent.forEach((l, i) => { const e = l.startsWith("{") ? parse(l) : null; if (!e) return; if (!rows.has(e.id)) rows.set(e.id, i);
  if (!e.same) for (const k of [e.name, ...(e.aliases || [])]) { const f = fold(k); byName.set(f, [...(byName.get(f) || []), e.id]); } });
const live = new Map();                                    // id -> the entity as it now stands (edited ones included)
const get = id => { if (!live.has(id)) live.set(id, rows.get(id) === -1 ? extraOf(id) : parse(ent[rows.get(id)])); return live.get(id); };
const created = new Map();
const extraOf = id => created.get(id);
const has = (e, ...t) => t.some(x => (e.sets || []).includes(x));
const tag = (id, t) => { const e = get(id); if (!(e.sets || []).includes(t)) { e.sets = [...(e.sets || []), t]; patched.add(id); } };
const taken = n => byName.has(fold(n)) || [...created.values()].some(e => fold(e.name) === fold(n));
/** An existing thing that fits (name or alias, and the kind that `ok` allows), else null. */
const find = (names, ok) => { for (const n of names) for (const id of byName.get(fold(n)) || []) if (ok(get(id))) return id; return null; };
/** A new thing: named plainly unless that name is taken (or `always` asks for the label), then "Name (label)". */
function make(name, alts, sets, note, { id, label, always } = {}) {
  const shown = always || (label && taken(name)) ? `${name} (${label})` : name;
  id ||= slug(shown);
  if (rows.has(id) && !created.has(id)) id = `${id}-${slug(label || "x")}`;
  if (created.has(id)) return id;
  const e = { id, name: shown, sets, kindBy: "read" };
  if (note) e.note = note;
  e.aliases = [...new Set([fold(shown), fold(name), ...alts.map(fold)])];
  created.set(id, e); rows.set(id, -1); extra.push(id);
  for (const k of e.aliases) byName.set(k, [...(byName.get(k) || []), id]);
  return id;
}

// ---------- Census ----------
const country = e => has(e, "country");
const element = e => has(e, "kind:material") || (has(e, "commodity") && (has(e, "group:met") || has(e, "group:chem")));
const CFG = {                // set id -> how its members are found, and made when kb/ lacks them
  africa: { ok: country }, "south-america": { ok: country }, "central-america": { ok: country }, eu: { ok: country }, g20: { ok: country }, g7: { ok: country },
  "germany-borders": { ok: country }, nordic: { ok: country }, alpine: { ok: country }, asean: { ok: country },
  "eu-capitals": { ok: e => has(e, "city", "kind:place"), sets: ["kind:place"], note: "A capital city of the European Union." },
  cantons: { label: "canton", always: true, pre: "ch", sets: ["kind:place"], note: "A canton of Switzerland." },
  laender: { label: "German state", always: true, pre: "de", sets: ["kind:place"], note: "A state (Land) of Germany." },
  "us-states": { label: "US state", always: true, pre: "us", sets: ["kind:place"], note: "A state of the United States." },
  canada: { label: "Canadian province", always: true, pre: "ca", sets: ["kind:place"], note: "A province or territory of Canada." },
  australia: { label: "Australian state", always: true, pre: "au", sets: ["kind:place"], note: "A state or territory of Australia." },
  "great-lakes": { ok: e => has(e, "feature:lake"), sets: ["kind:natural"], note: "One of the Great Lakes." },
  "seven-summits": { ok: e => has(e, "geo-place", "feature"), sets: ["kind:natural"], note: "One of the Seven Summits, the highest mountain of a continent." },
  oceans: { label: "ocean", always: true, sets: ["kind:natural"], note: "One of the world's five oceans." },
  continents: { label: "continent", always: true, sets: ["kind:place"], note: "One of the seven continents." },
  planets: { label: "planet", always: true, sets: ["kind:natural"], note: "A planet of the solar system." },
  "noble-gases": { ok: element, sets: ["kind:material"], note: "A noble gas." }, alkali: { ok: element, sets: ["kind:material"], note: "An alkali metal." },
  halogens: { ok: element, sets: ["kind:material"], note: "A halogen." }, "first-20": { ok: element, sets: ["kind:material"], note: "One of the first twenty elements." },
  pgms: { ok: element, sets: ["kind:material"], note: "A platinum group metal." }, "base-metals": { ok: element, sets: ["kind:material"], note: "A base metal." },
  rainbow: { label: "colour", always: true, sets: ["kind:word"], note: "A colour of the rainbow." },
  "greek-letters": { label: "Greek letter", always: true, sets: ["kind:word"], note: "A letter of the Greek alphabet." },
  nato: { label: "NATO alphabet", always: true, sets: ["kind:word"], note: "A word of the NATO spelling alphabet." },
  wonders: { ok: e => has(e, "kind:site"), sets: ["kind:site"], note: "One of the Seven Wonders of the Ancient World." },
  "henry-wives": { ok: e => has(e, "kind:person"), sets: ["kind:person"], note: "One of the six wives of Henry VIII." },
  tudors: { ok: e => has(e, "kind:person"), sets: ["kind:person"], note: "A Tudor monarch." },
  olympians: { ok: e => has(e, "greek-god"), sets: ["kind:person", "greek-god"], note: "One of the twelve Olympian gods." },
  muses: { ok: e => has(e, "greek-god"), label: "Muse", sets: ["kind:person", "greek-god"], note: "One of the nine Muses." },
  tragedies: { ok: e => has(e, "work"), sets: ["work", "kind:book"], note: "A tragedy by Shakespeare." },
  "first-growths": { ok: e => has(e, "kind:drink", "kind:company"), sets: ["kind:drink"], note: "One of the five first growths of the 1855 Bordeaux classification." },
  "bordeaux-grapes": { ok: e => has(e, "kind:plant", "kind:drink"), sets: ["kind:plant"], note: "One of the five Bordeaux red grapes." },
};
const missing = [];
for (const set of SETS) {
  const c = CFG[set.id];
  if (!c) throw new Error(`no entry for Census set ${set.id}: say how its members are found in tools/games-to-kb.mjs`);
  for (const it of set.items) {
    const names = [it.name, ...it.alt];
    let id = c.pre ? (rows.has(`${c.pre}-${slug(it.name)}`) ? `${c.pre}-${slug(it.name)}` : null) : null;
    if (!id && c.label && c.always) { const again = `${slug(`${it.name} (${c.label})`)}`; if (rows.has(again)) id = again; }
    if (!id) id = names.map(slug).find(i => rows.has(i) && has(get(i), `census:${set.id}`)) || null;      // made by an earlier run
    if (!id && c.ok) id = find(names, c.ok);
    if (!id) {
      if (!c.sets) { missing.push(`${set.id}: ${it.name}`); continue; }
      id = make(it.name, it.alt, [...c.sets], c.note, { id: c.pre ? `${c.pre}-${slug(it.name)}` : undefined, label: c.label, always: c.always });
    }
    tag(id, `census:${set.id}`);
  }
}

// ---------- Crossing: land borders ----------
const idOfCountry = new Map(COUNTRIES.map(c => [c.name, c.about]));
const existingLinks = new Set(lnk.filter(l => l.startsWith("{")).map(l => { const k = parse(l); return k && `${k.from}|${k.to}|${k.rel}`; }));
// a link's facts (a distance, how far up the river) go in `facts` (kb/vocabulary.js FACTS), not in its words
const link = (from, to, rel, facts) => { const k = `${from}|${to}|${rel}`; if (!rows.has(from) || !rows.has(to) || existingLinks.has(k)) return; existingLinks.add(k); linkLines.push(JSON.stringify(facts ? { from, to, rel, facts } : { from, to, rel }) + ","); };
for (const c of COUNTRIES) for (const n of c.neighbours) { const o = idOfCountry.get(n); if (o && c.about && c.about < o) link(c.about, o, "borders"); }
for (const c of COUNTRIES) if (c.about && rows.has(c.about)) tag(c.about, "crossing:land");

// ---------- Crossing: the sea ----------
const natural = e => !has(e, "country", "kind:person", "city", "kind:company");
const waterId = {};
for (const [k, [name, , , kind]] of Object.entries(WATERS)) {
  const word = kind === "canal" ? "canal" : kind === "strait" ? "strait" : kind === "cape" ? "cape" : "stretch of sea";
  const id = find([name], natural) || make(name, [], [kind === "canal" ? "kind:site" : "kind:natural"], `A ${word} on the sea lanes of Crossing.`, { label: word });
  waterId[k] = id; tag(id, "crossing:sea");
}
for (const [a, b] of LANES) link(waterId[a], waterId[b], "sea-lane");
const placeOk = e => has(e, "city", "kind:place", "trade-place", "geo-place") && !/^(us|ch|de|ca|au)-/.test(e.id);          // not a state or canton of the same name
const portId = {}, ctry = n => idOfCountry.get(n);
for (const [name, cn, , , water, nm] of PORTS) {
  const id = find([name], placeOk) || make(name, [], ["kind:place"], "A port on the sea lanes of Crossing.", { label: "port" });
  portId[name] = id; tag(id, "crossing:port");
  link(id, waterId[water], "port-on", nm ? { upriver: nm } : null);
  if (ctry(cn)) link(id, ctry(cn), "in");
}
for (const [name, cn, , , reach] of INLAND) {
  const id = find([name], placeOk) || make(name, [], ["kind:place"], "An inland place that Crossing's cargo reaches by river or road.", { label: "inland" });
  tag(id, "crossing:inland");
  for (const [port, km, how] of reach) link(id, portId[port], "inland-of", { distance: km, by: how });
  if (ctry(cn)) link(id, ctry(cn), "in");
}

// ---------- write ----------
for (const id of patched) if (rows.get(id) >= 0) ent[rows.get(id)] = JSON.stringify(get(id)) + ",";
const newLines = extra.map(id => JSON.stringify(get(id)) + ",");
const lastE = ent.lastIndexOf("];"), lastL = lnk.lastIndexOf("];");
for (const [list, at] of [[ent, lastE], [lnk, lastL]]) if (!list[at - 1].endsWith(",")) list[at - 1] += ",";
ent.splice(lastE, 0, ...newLines.filter((_, i) => !ent.some(l => l.startsWith(`{"id":${JSON.stringify(extra[i])},`)))); lnk.splice(lastL, 0, ...linkLines);
fs.writeFileSync(root + "entities.js", ent.join("\n")); fs.writeFileSync(root + "links.js", lnk.join("\n"));
console.log({ patched: patched.size, made: extra.length, links: linkLines.length, missing });
