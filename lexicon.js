// Lexicon: everything the games know, looked up. Search any entity in the knowledge base (a country, a company, a
// painting, a river, a law…) and see what it is (its kinds and the topics its links touch), what's said about it (its
// note, a painting's maker and home, the numbers Quote knows about it) and everything it's linked to, each with the
// reason, one tap from its own entry. #e=<id> opens an entry, so the browser's back button walks back through them.
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { QUOTES } from "./quote-bank.js";
import { withUnit } from "./quote-engine.js";
import { showPicture } from "./pics.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, line } from "./menu.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const ENT = new Map(ENTITIES.map(e => [e.id, e]));
// a thing entered twice is one thing: "same" points a duplicate at the entry that stands, and its links count there
const CANON = id => ENT.get(id)?.same || id;
// a thing's name, with its qualifier where another thing shares the name ("Guernica (Picasso)")
const label = e => (e.qualifier ? `${e.name} (${e.qualifier})` : e.name);
const fold = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const KEYS = ENTITIES.filter(e => !e.same).map(e => ({ e, keys: [e.name, ...(e.aliases || [])].map(fold) }));
const OUT = new Map(), IN = new Map();                       // id → links from it, links to it
for (const l of LINKS) {
  if (!ENT.has(l.from) || !ENT.has(l.to)) continue;
  const c = { ...l, from: CANON(l.from), to: CANON(l.to) };
  (OUT.get(c.from) || OUT.set(c.from, []).get(c.from)).push(c);
  (IN.get(c.to) || IN.set(c.to, []).get(c.to)).push(c);
}
const FACTS = new Map();                                     // id → the numbers Quote knows about it
for (const q of QUOTES) if (q.about) (FACTS.get(q.about) || FACTS.set(q.about, []).get(q.about)).push(q);

// ---------- words for the kinds and the topics ----------
const KIND = { country: "country", city: "city", commodity: "commodity", painting: "painting", museum: "museum", feature: "natural feature",
  "trade-place": "trade hub", "geo-place": "place", "art-place": "art place" };
// the knowledge base's groups: regions for countries, families for commodities (Crates' pools)
const GROUP = { eu: "Europe", asia: "Asia", me: "Middle East", am: "Americas", af: "Africa", soft: "soft commodity", met: "metal",
  nrg: "energy", grain: "grain", bio: "biofuel", chem: "chemical", cred: "credit", circ: "circular" };
const kindsOf = e => (e.sets || []).map(s => s.startsWith("kind:") ? s.slice(5) : s.startsWith("feature:") ? s.slice(8)
  : s.startsWith("group:") ? GROUP[s.slice(6)] || s.slice(6) : KIND[s] || s).filter((k, i, all) => all.indexOf(k) === i);
const TOPIC = { nrg: "Energy", met: "Metals", agr: "Agriculture", mkt: "Markets", mkts: "Markets", trade: "Trade", co: "Companies", firm: "Companies",
  fin: "Finance", geo: "Geography", hist: "History", past: "History", cult: "Culture", ppl: "People", sci: "Science", food: "Food", lang: "Language",
  nat: "Nature", pol: "Politics", screen: "Film & TV", sport: "Sport", style: "Style", spec: "Specifications", life: "Life", uses: "Uses",
  prod: "Production", orig: "Origins", reg: "Regulation", logi: "Logistics" };
function topicsOf(id) {
  const n = {};
  for (const l of [...(OUT.get(id) || []), ...(IN.get(id) || [])]) for (const a of l.aspects || []) if (TOPIC[a]) n[TOPIC[a]] = (n[TOPIC[a]] || 0) + 1;
  return Object.entries(n).sort((p, q) => q[1] - p[1]).map(([t]) => t);
}

// ---------- search ----------
function search(text) {
  const t = fold(text.trim());
  if (!t) return [];
  const starts = [], words = [], inside = [];
  for (const { e, keys } of KEYS) {
    if (keys.some(k => k.startsWith(t))) starts.push(e);
    else if (keys.some(k => k.split(/[\s\-–(),]+/).some(w => w.startsWith(t)))) words.push(e);
    else if (keys.some(k => k.includes(t))) inside.push(e);
  }
  const byLinks = (p, q) => ((OUT.get(q.id)?.length || 0) + (IN.get(q.id)?.length || 0)) - ((OUT.get(p.id)?.length || 0) + (IN.get(p.id)?.length || 0)) || p.name.localeCompare(q.name);
  return [...starts.sort(byLinks), ...words.sort(byLinks), ...inside.sort(byLinks)].slice(0, 60);
}
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
function entityButton(e, extra) {
  const b = el("button", "lx-hit");
  b.type = "button";
  b.append(el("b", null, label(e)), el("small", null, kindsOf(e).slice(0, 2).join(" · ")));
  if (extra) b.append(el("span", "lx-why", extra));
  b.addEventListener("click", () => open(e.id));
  return b;
}
function showResults() {
  $("entry").hidden = true; $("results").hidden = false;
  listResults();
}
/** What the search finds, in the results box (shown or not: held sideways, the list stays beside an open entry). */
function listResults() {
  const text = $("q").value, box = $("results");
  box.replaceChildren();
  if (!text.trim()) {
    box.append(el("p", "lx-lead", `${ENTITIES.length.toLocaleString("en-GB")} things, ${LINKS.length.toLocaleString("en-GB")} links between them. Try:`));
    const tries = ["Glencore", "Svalbard", "Ophelia", "Copper", "Rotterdam", "Strait of Hormuz", "Cashew", "Hanseatic League"].map(n => KEYS.find(k => k.keys.includes(fold(n)))?.e).filter(Boolean);
    const row = el("div", "lx-tries");
    for (const e of tries) row.append(entityButton(e));
    box.append(row);
    return;
  }
  const hits = search(text);
  if (!hits.length) { box.append(el("p", "lx-lead", "Nothing by that name.")); return; }
  const list = el("div", "lx-list");
  for (const e of hits) list.append(entityButton(e));
  box.append(list);
}

// ---------- an entry ----------
// every kind of link gets a group each way: what it points to, and what points to it. A clue is Crates' pair, a link
// a plain association; the rest are typed relations
const REL = { clue: ["A clue to", "Clues to it"], link: ["Linked to", "Linked from"], in: ["In", "Within it"],
  "painted-by": ["Painted by", "Paintings"], "hangs-in": ["Hangs in", "On its walls"], movement: ["Movement", "Works"],
  "designed-by": ["Designed by", "Designs"], style: ["Style", "In this style"], city: ["Stands in", "Buildings here"],
  from: ["From", "From here"], "led-to": ["Led to", "Grew out of"], "in-work": ["From the work", "Lines"], "written-by": ["Written by", "Works"] };
const ORDER = ["clue", "link", "painted-by", "hangs-in", "movement", "designed-by", "style", "city", "from", "led-to", "in"];
function groupsOf(id) {
  const rels = new Set([...(OUT.get(id) || []), ...(IN.get(id) || [])].map(l => l.rel));
  const order = [...ORDER.filter(r => rels.has(r)), ...[...rels].filter(r => !ORDER.includes(r))];
  const out = [];
  for (const r of order) {
    const [away, toward] = REL[r] || [r, `${r} (from)`];
    // a clue's hint describes the clue thing (the one it comes from), so it's shown on either side
    out.push([toward, (IN.get(id) || []).filter(l => l.rel === r), l => l.from, l => l.hint || ""]);
    out.push([away, (OUT.get(id) || []).filter(l => l.rel === r), l => l.to, l => l.hint || ""]);
  }
  return out;
}
const SHOWN = 24;
function open(id, push = true) {
  id = CANON(id);
  const e = ENT.get(id);
  if (!e) return;
  if (push && location.hash !== `#e=${id}`) history.pushState(null, "", `#e=${id}`);
  const box = $("entry");
  $("results").hidden = true; box.hidden = false;
  box.replaceChildren();
  const head = el("header", "lx-head");
  head.append(el("h2", null, label(e)));
  const chips = el("div", "lx-chips");
  for (const k of kindsOf(e)) chips.append(el("span", "lx-chip", k));
  head.append(chips);
  box.append(head);
  if (e.pic) { const pic = el("div", "lx-pic"); box.append(pic); showPicture(pic, e.pic, { width: 500, alt: e.name }); }
  // what's said about it
  const said = [];
  if (e.note) said.push(e.note);
  if (e.def) said.push(e.def.replace(/^./, c => c.toUpperCase()) + ".");
  if (e.rendering) said.push(`In English: ${e.rendering}.`);
  if (e.literal) said.push(`Literally: ${e.literal}.`);
  if (e.meaning) said.push(`Means ${e.meaning}.`);
  if (e.who) said.push(e.who.replace(/^./, c => c.toUpperCase()) + ".");
  if (e.region || e.country) said.push([e.country && e.country !== e.name ? e.country : "", e.region].filter(Boolean).join(", "));
  if (e.year) said.push(`${e.circa ? "Around " : ""}${e.year}`);
  for (const s of said) box.append(el("p", "lx-note", s));
  const facts = FACTS.get(id) || [];
  if (facts.length) {
    const sec = el("section", "lx-sec");
    sec.append(el("h3", null, "Numbers"));
    for (const q of facts) { const row = el("p", "lx-fact"); row.append(el("span", null, q.pic ? "Painted" : q.q), el("b", null, withUnit(q.truth, q))); sec.append(row); }
    box.append(sec);
  }
  const topics = topicsOf(id);
  if (topics.length) {
    const sec = el("section", "lx-sec"), row = el("div", "lx-chips");
    sec.append(el("h3", null, "Topics"));
    for (const t of topics.slice(0, 10)) row.append(el("span", "lx-chip quiet", t));
    sec.append(row); box.append(sec);
  }
  for (const [title, links, other, why] of groupsOf(id)) {
    if (!links.length) continue;
    const sec = el("section", "lx-sec"), list = el("div", "lx-list");
    sec.append(el("h3", null, `${title} (${links.length})`));
    const draw = n => list.replaceChildren(...links.slice(0, n).map(l => entityButton(ENT.get(other(l)), why(l))));
    draw(SHOWN);
    sec.append(list);
    if (links.length > SHOWN) {
      const more = el("button", "link lx-more", `Show all ${links.length}`);
      more.type = "button";
      more.addEventListener("click", () => { draw(links.length); more.remove(); });
      sec.append(more);
    }
    box.append(sec);
  }
  box.scrollTop = 0;
}

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const kinds = {};
  for (const e of ENTITIES) for (const k of kindsOf(e).slice(0, 1)) kinds[k] = (kinds[k] || 0) + 1;
  part(body, "about").append(line(`${ENTITIES.length.toLocaleString("en-GB")} things and ${LINKS.length.toLocaleString("en-GB")} links, the knowledge every game draws on`),
    line(Object.entries(kinds).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([k, n]) => `${n} ${k}`).join(", ")));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".lx-mark").innerHTML = APPS.find(a => a.id === "lexicon").logo;
bindSwitcher($("appsBtn"), "lexicon");
$("q").addEventListener("input", () => { if (location.hash) history.pushState(null, "", location.pathname); showResults(); });
$("searchForm").addEventListener("submit", e => { e.preventDefault(); const first = search($("q").value)[0]; if (first) open(first.id); });
addEventListener("popstate", () => { const id = new URLSearchParams(location.hash.slice(1)).get("e"); if (id) open(id, false); else showResults(); });
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
const start = new URLSearchParams(location.hash.slice(1)).get("e");
if (start && ENT.has(start)) { listResults(); open(start, false); } else showResults();
