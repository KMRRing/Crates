// Writes the knowledge the games hold apart from kb/ into kb/, so the Almanac and the knowledge graph have all of it (Korbi, 9 Nov
// 2026: Dispatch, Census, Spyglass, Crossing): Crossing's land borders (a `borders` link per pair) and its sea (waters, ports and
// inland places become things; `sea-lane`, `port-on` and `inland-of` links). Nothing is tagged: what a game plays is in the links
// (kb/vocabulary.js). Census's sets have been kb/'s own since 10 November 2026 (set things, their members linked `member-of`; the
// build writes census-bank.js), so they are edited there. Spyglass shows kb/'s own paintings, flags and country outlines, so it
// needs nothing here (tests/games-kb.mjs holds that). Dispatch has tools/dispatch-to-kb.mjs. Safe to run again; after it run
// `node tools/audit-marks.mjs` and `node tools/build-kb.mjs`.
import fs from "node:fs";
import { COUNTRIES } from "../chart-countries.js";
import { WATERS, LANES, PORTS, INLAND } from "../crossing-sea-data.js";
const root = new URL("../kb/", import.meta.url).pathname;
const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const slug = s => fold(s).replace(/ /g, "-");
const ent = fs.readFileSync(root + "entities.js", "utf8").split("\n"), lnk = fs.readFileSync(root + "links.js", "utf8").split("\n");
const parse = l => { try { return JSON.parse(l.replace(/,\s*$/, "")); } catch { return null; } };
const rows = new Map(), byName = new Map(), extra = [], linkLines = [];
ent.forEach((l, i) => { const e = l.startsWith("{") ? parse(l) : null; if (!e) return; if (!rows.has(e.id)) rows.set(e.id, i);
  if (!e.same) for (const k of [e.name, ...(e.aliases || [])]) { const f = fold(k); byName.set(f, [...(byName.get(f) || []), e.id]); } });
const live = new Map();                                    // id -> the entity as it now stands (edited ones included)
const get = id => { if (!live.has(id)) live.set(id, rows.get(id) === -1 ? extraOf(id) : parse(ent[rows.get(id)])); return live.get(id); };
const created = new Map();
const extraOf = id => created.get(id);
const has = (e, ...t) => t.some(x => (e.sets || []).includes(x));
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

// ---------- links ----------
const existingLinks = new Set(lnk.filter(l => l.startsWith("{")).map(l => { const k = parse(l); return k && `${k.from}|${k.to}|${k.rel}`; }));
// a link's facts (a distance, how far up the river) go in `facts` (kb/vocabulary.js FACTS), not in its words
const link = (from, to, rel, facts) => { const k = `${from}|${to}|${rel}`; if (!rows.has(from) || !rows.has(to) || existingLinks.has(k)) return; existingLinks.add(k); linkLines.push(JSON.stringify(facts ? { from, to, rel, facts } : { from, to, rel }) + ","); };

// ---------- Crossing: land borders ----------
const idOfCountry = new Map(COUNTRIES.map(c => [c.name, c.about]));
for (const c of COUNTRIES) for (const n of c.neighbours) { const o = idOfCountry.get(n); if (o && c.about && c.about < o) link(c.about, o, "borders"); }

// ---------- Crossing: the sea ----------
const natural = e => !has(e, "country", "kind:person", "city", "kind:company");
const waterId = {};
for (const [k, [name, , , kind]] of Object.entries(WATERS)) {
  const word = kind === "canal" ? "canal" : kind === "strait" ? "strait" : kind === "cape" ? "cape" : "stretch of sea";
  const id = find([name], natural) || make(name, [], [kind === "canal" ? "kind:site" : "kind:natural"], `A ${word} on the sea lanes of Crossing.`, { label: word });
  waterId[k] = id;
}
for (const [a, b] of LANES) link(waterId[a], waterId[b], "sea-lane");
const placeOk = e => has(e, "city", "kind:place", "trade-place", "geo-place") && !/^(us|ch|de|ca|au)-/.test(e.id);          // not a state or canton of the same name
const portId = {}, ctry = n => idOfCountry.get(n);
for (const [name, cn, , , water, nm] of PORTS) {
  const id = find([name], placeOk) || make(name, [], ["kind:place"], "A port on the sea lanes of Crossing.", { label: "port" });
  portId[name] = id;
  link(id, waterId[water], "port-on", nm ? { upriver: nm } : null);
  if (ctry(cn)) link(id, ctry(cn), "in");
}
for (const [name, cn, , , reach] of INLAND) {
  const id = find([name], placeOk) || make(name, [], ["kind:place"], "An inland place that Crossing's cargo reaches by river or road.", { label: "inland" });
  for (const [port, km, how] of reach) link(id, portId[port], "inland-of", { distance: km, by: how });
  if (ctry(cn)) link(id, ctry(cn), "in");
}

// ---------- write ----------
const newLines = extra.map(id => JSON.stringify(get(id)) + ",");
const lastE = ent.lastIndexOf("];"), lastL = lnk.lastIndexOf("];");
for (const [list, at] of [[ent, lastE], [lnk, lastL]]) if (!list[at - 1].endsWith(",")) list[at - 1] += ",";
ent.splice(lastE, 0, ...newLines.filter((_, i) => !ent.some(l => l.startsWith(`{"id":${JSON.stringify(extra[i])},`)))); lnk.splice(lastL, 0, ...linkLines);
fs.writeFileSync(root + "entities.js", ent.join("\n")); fs.writeFileSync(root + "links.js", lnk.join("\n"));
console.log({ made: extra.length, links: linkLines.length });
