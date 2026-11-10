// Moves into kb/ the facts that live only inside a question (Korbi, 10 Nov 2026: every fact a home in the knowledge base, so
// every game and the shared pile can reach it; taken apart into dates, places and people over time). For each of Punt's and
// Quote's questions that names no fact kb/ holds:
//   - "Which country is Schwedt in?" is a place in a country: the place becomes a thing (a city) linked `in` the country;
//   - one of Quote's numbers becomes a figure said about the thing its question names (`said`: ask, value, unit; a year as `year`);
//   - anything else becomes a sentence said about its thing (`said`: ask, answer): the thing the right answer names (the Mona
//     Lisa, for "Which painting was stolen from the Louvre in 1911?"), else the one the question is about, else the one it names.
// The question then names its thing (`about`), so the build finds the fact it tests (kb/graph.js testsOf). A question whose
// thing can't be told is left as it is and listed. Safe to run again: a fact already said is not said twice.
// Run: node tools/kb-said.mjs   then node tools/audit-marks.mjs and node tools/build-kb.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { makeGraph } from "../kb/graph.js";

const root = path.resolve(new URL("..", import.meta.url).pathname), kb = f => path.join(root, "kb", f);
const load = async f => import(`${pathToFileURL(kb(f)).href}?t=${Date.now()}`);
const { ENTITIES } = await load("entities.js"), { LINKS } = await load("links.js");
const g = makeGraph(ENTITIES, LINKS);
const fold = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^the /, "").trim();
const slug = s => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// the files as lines (one record a line), edited in place
const lines = f => fs.readFileSync(kb(f), "utf8").split("\n");
const parse = l => JSON.parse(l.replace(/,\s*$/, ""));
const ent = lines("entities.js"), lnk = lines("links.js"), row = new Map();
ent.forEach((l, i) => { if (l.startsWith("{")) row.set(parse(l).id, i); });
const live = new Map(), touched = new Set(), made = [], newLinks = [];
const get = id => { if (!live.has(id)) live.set(id, parse(ent[row.get(id)])); return live.get(id); };
const linked = new Set(LINKS.map(l => `${l.from}|${l.rel}|${l.to}`));
const link = (from, rel, to) => { const k = `${from}|${rel}|${to}`; if (!linked.has(k)) { linked.add(k); newLinks.push(JSON.stringify({ from, rel, to }) + ","); } };
/** Says a fact about a thing (once): returns its fact id. */
function say(id, fact) {
  const e = get(id), had = (e.said || []).find(s => s.ask === fact.ask);
  if (had) return `${id}~${had.id}`;
  const base = slug(fact.ask).split("-").filter(w => w.length > 2).slice(0, 5).join("-") || "fact";
  let sid = base;
  for (let n = 2; (e.said || []).some(s => s.id === sid); n++) sid = `${base}-${n}`;
  e.said = [...(e.said || []), { id: sid, ...fact }];
  touched.add(id);
  return `${id}~${sid}`;
}
/** The one thing a question's words name, or null if none or several: a name of four letters or more, written with a capital
 *  where it stands (Coal in "the world's coal export port" is a word, not the thing), the longest first so "North Sea" wins over "Sea". */
const NAMES = [...g.byId.values()].filter(e => !e.same && !e.sets.includes("set") && !e.sets.includes("story"))
  .flatMap(e => [e.name, e.short, ...(e.aliases || [])].filter(n => n && n.length >= 4).map(n => [n.replace(/^the /i, ""), e.id]))
  .sort((a, b) => b[0].length - a[0].length);
const plain = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function named(text) {
  const t = ` ${plain(text).replace(/[^A-Za-z0-9]+/g, " ")} `, hits = new Set();
  for (const [n, id] of NAMES) {
    const w = plain(n).replace(/[^A-Za-z0-9]+/g, " ").trim(), at = t.toLowerCase().indexOf(` ${w.toLowerCase()} `);
    if (at < 0 || !/[A-Z0-9]/.test(t[at + 1])) continue;
    if (![...hits].some(h => h === id)) hits.add(id);
    if (hits.size > 1) return null;
  }
  return hits.size === 1 ? [...hits][0] : null;
}
const left = [];

// ---------- Punt ----------
const BANKS = ["art", "cities", "refining", "swiss", "myth", "merchants", "titles", "bavaria", "britain", "china", "skiing", "law"];
const edited = {};
for (const b of BANKS) {
  const file = `items/choice/${b}.js`, L = lines(file);
  L.forEach((l, i) => {
    if (!l.startsWith("{")) return;
    const q = parse(l), right = q.a.map(k => q.o[k]);
    if (q.facts || g.testsOf({ about: q.about, q: q.q, right }).length) return;
    let m;
    if ((m = /^Which country is (.+) in\?$/.exec(q.q)) && q.about?.length === 1 && g.byId.get(q.about[0])?.sets.includes("country")) {
      let place = g.resolve(m[1]);
      if (!place) {
        place = slug(m[1]);
        if (!row.has(place) && !made.some(e => e.id === place)) made.push({ id: place, name: m[1], sets: ["city"], note: (q.x || "").replace(/^[^:]*: /, "") });
      }
      link(place, "in", q.about[0]);
      return;
    }
    // the fact sits on what the question is about, pointing at the thing its answer names (Audi's headquarters, at Ingolstadt);
    // with no such subject, on the thing the answer names (the Mona Lisa, stolen in 1911)
    const ans = right.length === 1 ? g.resolve(right[0]) : null, subject = q.about?.length ? g.canon(q.about[0]) : named(q.q);
    const home = subject && subject !== ans ? subject : ans;
    if (!home || !row.has(home)) { left.push(`${b} ${q.id}: ${q.q}`); return; }
    // kb/ may hold it already, once the question says what it's about (Audi based in Ingolstadt is a link): then only that
    if (!g.testsOf({ about: [home], q: q.q, right }).length) say(home, { ask: q.q, answer: right.join("; "), ...(ans && ans !== home ? { thing: ans } : {}) });
    if (!q.about?.includes(home)) { q.about = [...(q.about || []), home]; L[i] = JSON.stringify(q) + (l.trimEnd().endsWith(",") ? "," : ""); edited[file] = L; }
  });
}

// ---------- Quote ----------
{
  const file = "items/estimates.js", L = lines(file);
  L.forEach((l, i) => {
    if (!l.startsWith("{")) return;
    const q = parse(l);
    if (q.fact || q.truth == null) return;
    const home = q.about ? g.canon(q.about) : named(q.q);
    if (!home || !row.has(home)) { left.push(`quote ${q.id}: ${q.q}`); return; }
    if (!g.testsOf({ about: [home], q: q.q, right: [q.truth] }).length) say(home, q.unit === "year" ? { ask: q.q, year: q.truth } : { ask: q.q, value: q.truth, unit: q.unit });
    if (q.about !== home) { q.about = home; L[i] = JSON.stringify(q) + (l.trimEnd().endsWith(",") ? "," : ""); edited[file] = L; }
  });
}

// ---------- write ----------
for (const id of touched) ent[row.get(id)] = JSON.stringify(get(id)) + ",";
const add = (L, rows) => { const at = L.lastIndexOf("];"); if (!L[at - 1].endsWith(",")) L[at - 1] += ","; L.splice(at, 0, ...rows); };
add(ent, made.map(e => JSON.stringify(e) + ",")); add(lnk, newLinks);
fs.writeFileSync(kb("entities.js"), ent.join("\n")); fs.writeFileSync(kb("links.js"), lnk.join("\n"));
for (const [f, L] of Object.entries(edited)) fs.writeFileSync(kb(f), L.join("\n"));
console.log({ said: [...touched].reduce((n, id) => n + get(id).said.length, 0), on: touched.size, places: made.length, links: newLinks.length, left: left.length });
if (left.length) console.log(`no thing to say these of:\n  ${left.slice(0, 40).join("\n  ")}${left.length > 40 ? `\n  …and ${left.length - 40} more` : ""}`);
