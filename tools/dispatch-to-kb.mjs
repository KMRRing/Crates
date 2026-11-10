// Writes Dispatch's people, places and meetings (dispatch-bank.js) into kb/entities.js and kb/links.js, so the Almanac and the games that
// read kb/ have them: each person is an entity (an existing one is added to: `nat`, `meetings`), each place one, with an `active-in` link
// from the person and a `from` link to their country. Run it after changing dispatch-bank.js (`node tools/dispatch-to-kb.mjs`), then
// `node tools/audit-marks.mjs` and `node tools/build-kb.mjs`; tests/dispatch.mjs fails while the two disagree. Safe to run again.
import fs from "node:fs";
import { MEETINGS } from "../dispatch-bank.js";
const root = new URL("../kb/", import.meta.url).pathname;
const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const slug = s => fold(s).replace(/ /g, "-");
let ent = fs.readFileSync(root + "entities.js", "utf8").split("\n"), lnk = fs.readFileSync(root + "links.js", "utf8").split("\n");
const parse = l => { try { return JSON.parse(l.replace(/,\s*$/, "")); } catch { return null; } };
const rows = new Map();                       // id -> line index
ent.forEach((l, i) => { const e = l.startsWith("{") ? parse(l) : null; if (e && !rows.has(e.id)) rows.set(e.id, i); });
const get = id => parse(ent[rows.get(id)]);
const SHORT = { "johannes-gutenberg": "gutenberg", "christopher-columbus": "columbus", "ferdinand-magellan": "magellan", "nicolaus-copernicus": "copernicus", "francis-drake": "drake", "jan-pieterszoon-coen": "coen", "antonie-van-leeuwenhoek": "leeuwenhoek", "klaus-stortebeker": "stortebeker" };
const byName = new Map();
for (const l of ent) { const e = l.startsWith("{") ? parse(l) : null; if (!e || e.same) continue; for (const k of [e.name, ...(e.aliases || [])]) if (!byName.has(fold(k))) byName.set(fold(k), e.id); }
const COUNTRY = { Venetian: "italy", Florentine: "italy", Tuscan: "italy", Pisan: "italy", Genoese: "italy", Italian: "italy", German: "germany", Bavarian: "germany", Portuguese: "portugal", Spanish: "spain", Basque: "spain", Navarrese: "spain",
  Dutch: "netherlands", Flemish: "belgium", English: "uk", Scottish: "uk", Danish: "denmark", Swedish: "sweden", French: "france", Chinese: "china", Qing: "china", Japanese: "japan", Mughal: "india", Maratha: "india", Keralan: "india",
  Ottoman: "turkey", Moroccan: "morocco", Malian: "mali", Korean: "south-korea", Persian: "iran", Ethiopian: "ethiopia", Aztec: "mexico", Nahua: "mexico", Filipino: "philippines", Muscovite: "russia", Malay: "malaysia", Khoikhoi: "south-africa", Kongolese: "angola", Mongol: "mongolia", Prussian: "poland", Habsburg: "austria", Timurid: "uzbekistan", Songhai: "mali", Pomeranian: "poland", "Holy Roman": "germany", Ragusan: "croatia" };
const people = [...new Map(MEETINGS.map(x => [x.pid, x])).values()];
const idOfPerson = {};
const made = [], patched = [], newPlaces = [];
const extra = [];     // new entity lines
const linkLines = [];
const existingLinks = new Set(lnk.filter(l => l.startsWith("{")).map(l => { const k = parse(l); return k && `${k.from}|${k.to}|${k.rel}`; }));
const placeId = {};
for (const p of people) {
  const meetings = MEETINGS.filter(x => x.pid === p.pid).sort((a, b) => a.year - b.year).map(x => { const o = { id: x.id, year: x.year, place: x.place, what: x.what }; if (x.alt) o.alt = x.alt; o.why = x.why; if (x.pic) o.pic = x.pic; return o; });
  let id = rows.has(p.pid) ? p.pid : SHORT[p.pid] || (byName.get(fold(p.who)) ?? null);
  if (id && rows.has(id)) {
    const e = get(id);
    e.nat = p.nat; e.meetings = meetings;
    if (!e.note && /person/.test((e.sets || []).join())) e.note = meetings[0].why;     // what the first meeting meant, so the thing says something
    if (SHORT[p.pid] && !(e.aliases || []).includes(fold(p.who))) e.aliases = [...(e.aliases || []), fold(p.who)];
    ent[rows.get(id)] = JSON.stringify(e) + ",";
    patched.push(id);
  } else {
    id = p.pid;
    extra.push(JSON.stringify({ id, name: p.who, sets: ["kind:person"], kindBy: "read", note: meetings[0].why, nat: p.nat, meetings }) + ",");
    rows.set(id, -1); made.push(id);
  }
  idOfPerson[p.pid] = id;
}
for (const x of MEETINGS) {
  const k = fold(x.place);
  let pl = byName.get(k) ?? (rows.has(slug(x.place)) ? slug(x.place) : null);
  if (!pl) { pl = placeId[k] || slug(x.place); if (!placeId[k]) { placeId[k] = pl; extra.push(JSON.stringify({ id: pl, name: x.place, sets: ["kind:place"], kindBy: "read" }) + ","); newPlaces.push(pl); } }
  const l1 = `${idOfPerson[x.pid]}|${pl}|active-in`;
  if (!existingLinks.has(l1)) { existingLinks.add(l1); linkLines.push(JSON.stringify({ from: idOfPerson[x.pid], to: pl, rel: "active-in", hint: x.what, facts: { year: x.year } }) + ","); }
}
const have = new Set(ent.filter(l => l.startsWith("{")).map(l => parse(l)?.id).filter(Boolean));
for (const p of people) {
  const c = COUNTRY[p.nat];
  if (!c || !have.has(c)) continue;
  const key = `${idOfPerson[p.pid]}|${c}|from`;
  if (existingLinks.has(key)) continue;
  existingLinks.add(key);
  linkLines.push(JSON.stringify({ from: idOfPerson[p.pid], to: c, rel: "from", hint: `a ${p.nat} figure` }) + ",");
}
const lastE = ent.lastIndexOf("];"), lastL = lnk.lastIndexOf("];");
for (const [list, at] of [[ent, lastE], [lnk, lastL]]) if (!list[at - 1].endsWith(",")) list[at - 1] += ",";
ent.splice(lastE, 0, ...extra); lnk.splice(lastL, 0, ...linkLines);
fs.writeFileSync(root + "entities.js", ent.join("\n")); fs.writeFileSync(root + "links.js", lnk.join("\n"));
console.log({ made: made.length, patched: patched.length, newPlaces: newPlaces.length, links: linkLines.length });
console.log("patched:", patched.join(" "));
