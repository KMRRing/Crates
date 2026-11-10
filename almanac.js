// Almanac: everything the games know, as a star chart you fly through. It opens on the sky (almanac-sky.js), every thing in the
// knowledge base a star; tap one for its entry in a popup: what it is (its kinds and the topics its links touch), what's said
// about it (its note, a painting's maker and home, the numbers Quote knows about it) and everything it's linked to, each with
// the reason, one tap from its own entry. The list view (search, results, entries) is still here, from the menu; #e=<id> opens
// an entry (in the sky's popup, or #list&e=<id> in the list), so the browser's back button walks back through them.
// It was Lexicon until 2 November 2026: its id, `lexicon`, stays, so saved state and Random's lists are as they were.
import { QUOTES } from "./quote-bank.js";
import { SETS } from "./census-sets.js";
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { KINDS, ASPECTS, RELS, PLAYED, FIELDS, yearWords } from "./kb/vocabulary.js";
import { makeGraph, factWords } from "./kb/graph.js";
import { withUnit } from "./quote-engine.js";
import { showPicture, pictureName } from "./pics.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, line, action, markButton } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { defaultIs3D } from "./mode3d.js";
import { parseHash, formatHash } from "./almanac-nav.js";
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
for (const q of QUOTES) if (q.about && ENT.has(q.about)) (FACTS.get(q.about) || FACTS.set(q.about, []).get(q.about)).push(q);

// ---------- words for the kinds and the topics (kb/vocabulary.js) ----------
const G = makeGraph(ENTITIES, LINKS);
// `census:<set>` and `crossing:<part>` in a thing's sets say which games ask for it; they are not what it is (tools/games-to-kb.mjs)
const CENSUS = new Map(SETS.map(s => [s.id, s.title]));
const CROSSING = { land: "Crossing, by land", sea: "Crossing, by sea", port: "Crossing, by sea (a port)", inland: "Crossing, by sea (an inland place)" };
const REFS_IN = new Map();                                   // id → the things whose fields name it ([{ from, key }])
for (const e of ENTITIES) for (const x of G.refsOf(e)) (REFS_IN.get(x.to) || REFS_IN.set(x.to, []).get(x.to)).push({ from: e.id, key: x.key });
const kindsOf = e => [...new Set((e.sets || []).filter(s => !PLAYED[s.split(":")[0]]).map(s => KINDS[s] || s))];
function topicsOf(id) {
  const n = {};
  for (const l of [...(OUT.get(id) || []), ...(IN.get(id) || [])]) for (const a of l.aspects || []) if (ASPECTS[a]) n[ASPECTS[a]] = (n[ASPECTS[a]] || 0) + 1;
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
const TARGET = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/></svg>';
/**
 * A thing as a button that goes to its entry: `go(id)` (the list's own entry, or the popup's next one). With `locate`, a
 * second button beside it shows the thing in the sky.
 */
function entityButton(e, extra, { go = id => open(id), locate = null } = {}) {
  const b = el("button", "lx-hit");
  b.type = "button";
  b.append(el("b", null, label(e)), el("small", null, kindsOf(e).slice(0, 2).join(" · ")));
  if (extra) b.append(el("span", "lx-why", extra));
  b.addEventListener("click", () => go(e.id));
  if (!locate) return b;
  const row = el("div", "lx-row"), at = el("button", "lx-locate");
  at.type = "button"; at.title = "Show in the sky"; at.setAttribute("aria-label", `Show ${e.name} in the sky`);
  at.innerHTML = TARGET;
  at.addEventListener("click", () => locate(e.id));
  row.append(b, at);
  return row;
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
const ORDER = ["clue", "link", "painted-by", "hangs-in", "movement", "designed-by", "style", "city", "from", "led-to", "in"];
function groupsOf(id) {
  const rels = new Set([...(OUT.get(id) || []), ...(IN.get(id) || [])].map(l => l.rel));
  const order = [...ORDER.filter(r => rels.has(r)), ...[...rels].filter(r => !ORDER.includes(r))];
  const out = [];
  for (const r of order) {
    const { away, toward } = RELS[r] || { away: r, toward: `${r} (from)` };
    // a clue's hint describes the clue thing (the one it comes from), so it's shown on either side; the link's own facts
    // (a year, a distance, a rank) come first
    const why = l => [factWords(l.facts, { rank: l.rel !== "clue" }), l.hint].filter(Boolean).join(" · ");
    out.push([toward, (IN.get(id) || []).filter(l => l.rel === r), l => l.from, why]);
    out.push([away, (OUT.get(id) || []).filter(l => l.rel === r), l => l.to, why]);
  }
  // the things its fields name (a race held at its resort), unless a link says so already, and the things whose fields name it
  const linked = new Set([...(OUT.get(id) || [])].map(l => l.to));
  for (const x of G.refsOf(ENT.get(id))) if (!linked.has(x.to)) out.push([x.label, [x], y => y.to, () => ""]);
  const back = new Map();
  for (const x of REFS_IN.get(id) || []) if (FIELDS[x.key].back) (back.get(x.key) || back.set(x.key, []).get(x.key)).push(x);
  for (const [key, xs] of back) out.push([FIELDS[key].back, xs, y => y.from, () => ""]);
  return out;
}
/**
 * What joins two things, in words, for the line the sky draws between them as the camera goes from one to the other: the topic
 * the link belongs to (or, if it has none, how the first reads the relation) and the reason, if one is written. Null if
 * they are not linked.
 */
function linkWords(a, b) {
  const joins = [...(OUT.get(a) || []).filter(l => l.to === b), ...(IN.get(a) || []).filter(l => l.from === b)];
  const l = joins.find(x => (x.aspects || []).some(t => ASPECTS[t])) || joins[0];
  if (!l) return null;
  const topics = [...new Set((l.aspects || []).map(t => ASPECTS[t]).filter(Boolean))].slice(0, 2), rel = RELS[l.rel];
  return { name: topics.length ? topics.join(" · ") : rel ? (l.from === a ? rel.away : rel.toward) : l.rel.replace(/-/g, " ").replace(/^./, c => c.toUpperCase()),
    because: [factWords(l.facts, { rank: l.rel !== "clue" }), l.hint].filter(Boolean).join(" · ") };
}
const SHOWN = 24;
/**
 * An entry written into `box`: used by the list view and by the sky's popup. `nav.go(id)` is where a link leads (the list's
 * entry, or the popup's next one), `nav.locate(id)` adds a button to each link that shows it in the sky, and `nav.head: false`
 * leaves the name and kinds out (the popup carries them in its own head). Returns the head, if it wrote one.
 */
function fillEntry(box, id, nav = {}) {
  const e = ENT.get(id);
  box.replaceChildren();
  let head = null;
  if (nav.head !== false) {
    head = el("header", "lx-head");
    head.append(el("h2", null, label(e)));
    const chips = el("div", "lx-chips");
    for (const k of kindsOf(e)) chips.append(el("span", "lx-chip", k));
    head.append(chips);
    box.append(head);
  }
  if (e.pic) { const pic = el("div", "lx-pic"); box.append(pic); showPicture(pic, e.pic, { width: 500, alt: e.name }); }
  // what's said about it: its note, then its facts (kb/vocabulary.js labels and units them), where it is, and the numbers Quote asks of it
  if (e.note) box.append(el("p", "lx-note", e.note));
  const played = [...(e.sets || []).filter(s => s.startsWith("census:")).map(s => CENSUS.get(s.slice(7))).filter(Boolean).map(t => `In Census: ${t}`),
    ...(e.sets || []).filter(s => s.startsWith("crossing:")).map(s => CROSSING[s.slice(9)]).filter(Boolean).map(t => `On the map of ${t}`)];
  for (const t of played) box.append(el("p", "lx-note", `${t}.`));
  const rows = G.factsOf(e).map(f => [f.label, f.words, f.type !== "quantity" && f.type !== "year" && f.type !== "number"]);
  const where = G.placeOf(id);
  if (where) rows.push(["Where", `${Math.abs(where.lat).toFixed(2)}° ${where.lat < 0 ? "S" : "N"}, ${Math.abs(where.lon).toFixed(2)}° ${where.lon < 0 ? "W" : "E"}${where.via ? ` (${label(ENT.get(where.via))})` : ""}`, false]);
  const shown = new Set(Object.values(e).filter(v => typeof v === "number"));
  for (const q of FACTS.get(id) || []) if (!shown.has(q.truth)) rows.push([q.pic ? "Painted" : q.q, withUnit(q.truth, q), false]);
  if (rows.length) {
    const sec = el("section", "lx-sec");
    sec.append(el("h3", null, "Facts"));
    for (const [name, value, long] of rows) { const row = el("p", long ? "lx-fact long" : "lx-fact"); row.append(el("span", null, name), el("b", null, value)); sec.append(row); }
    box.append(sec);
  }
  // its steps: Dispatch's acts of a person (`meetings`), a story's events (`steps`); a fact worded two ways is one step, both wordings in it
  for (const x of G.stepsOf(e)) {
    const sec = el("section", "lx-sec");
    const when = [x.year != null ? yearWords(x.year, x.circa) : "", x.place || ""].filter(Boolean).join(" · ");
    if (when) sec.append(el("h3", null, when));
    if (x.pic) { const pic = el("div", "lx-pic"); sec.append(pic); showPicture(pic, x.pic, { width: 500, caption: pictureName(x.pic), alt: x.pic }); }
    sec.append(el("p", "lx-note", `${x.text[0].toUpperCase()}${x.text.slice(1)}${/[.!?]$/.test(x.text) ? "" : "."}`));
    if (x.alt) sec.append(el("p", "lx-note", `Also put: ${x.alt}.`));
    if (x.why) sec.append(el("p", "lx-note", x.why));
    if (x.thing) sec.append(entityButton(ENT.get(x.thing), "", nav));
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
    const draw = n => list.replaceChildren(...links.slice(0, n).map(l => entityButton(ENT.get(other(l)), why(l), nav)));
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
  return head;
}

// ---------- the list view ----------
// An entry in the list view: its own page, the entry beside the list held sideways. Reached from the menu, from a popup's
// "Open in the list", or by #list.
function open(id, push = true) {
  id = CANON(id);
  if (!ENT.has(id)) return;
  showList(false);
  if (push && location.hash !== formatHash({ list: true, e: id })) history.pushState(null, "", formatHash({ list: true, e: id }));
  const box = $("entry");
  $("results").hidden = true; box.hidden = false;
  const head = fillEntry(box, id, { go: next => open(next) });
  const there = el("button", "btn lx-sky-btn", "Show in the star chart");
  there.type = "button";
  there.addEventListener("click", () => goSky(id));
  head.append(there);
  box.scrollTop = 0;
}
/** The list view on screen (the star chart off it); `push` adds a step to the browser's history. */
function showList(push = true) {
  if (document.body.classList.contains("on-sky")) {
    document.body.classList.remove("on-sky");
    sky?.hide();
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) if (m.dataset.was) m.content = m.dataset.was;
  }
  setModes(false);
  if (push && location.hash !== formatHash({ list: true })) history.pushState(null, "", formatHash({ list: true }));
}
const setModes = chart => { $("modeList").setAttribute("aria-pressed", String(!chart)); $("modeSky").setAttribute("aria-pressed", String(chart)); };
function goList(e = null, push = true) {
  e = e && ENT.has(CANON(e)) ? CANON(e) : null;
  if (e) { listResults(); open(e, push); return; }
  showList(push);
  $("entry").hidden = true; $("results").hidden = false;
  listResults();
}

// ---------- the star chart ----------
// What Almanac opens on. almanac-sky.js is the page's side of it (and almanac-sky-*.js what it draws with): loaded as the page
// starts, so the list view carries none of it until it is asked for. A device without WebGL says why the chart is not there and
// offers the list.
let sky = null, skyLoading = null;
const shortName = e => (e.name.length > 26 ? `${e.name.slice(0, 25)}…` : e.name);
/** The address follows the entry the sky's popup shows: one step in the history for opening it, none for the next entries it shows. */
let popPushed = false;
function popupUrl(id) {
  if (IN_FRAME) return;
  const open = !!parseHash(location.hash).e && !parseHash(location.hash).list;
  if (id) {
    if (open) history.replaceState(null, "", formatHash({ e: id }));
    else { history.pushState(null, "", formatHash({ e: id })); popPushed = true; }
  } else if (open) {
    if (popPushed) { popPushed = false; history.back(); }
    else history.replaceState(null, "", location.pathname + location.search);
  }
}
async function loadSky() {
  if (sky) return sky;
  const back = el("button", "btn", "Show the list");
  back.type = "button";
  back.addEventListener("click", () => goList());
  skyLoading ||= import("./almanac-sky.js").then(m => m.createSky({
    section: $("sky"), gl: $("skyGL"), ink: $("skyInk"), hint: $("skyHint"), foot: $("skyFoot"), msg: $("skyMsg"), listBtn: back,
    form: $("skySearch"), query: $("skyQ"), menuBtn: $("skyMenu"), subjectsBtn: $("skySubjects"), homeBtn: $("skyHome"),
    hits: $("skyHits"), legend: $("skyLegend"), card: $("skyCard"), tag: $("skyTag"),
  }, { search, label, kindsOf, shortName, linkWords, fill: fillEntry, toList: id => goList(id), entryShown: popupUrl }));
  sky = await skyLoading;
  return sky;
}
/** The star chart on screen, with `e`'s popup open if one is asked for (an address, a link in the list), nothing chosen if not. */
async function goSky(e = null, push = true) {
  e = e && ENT.has(CANON(e)) ? CANON(e) : null;
  document.body.classList.add("on-sky");
  setModes(true);
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) { if (!m.dataset.was) m.dataset.was = m.content; m.content = "#060b12"; }
  if (push) { const to = formatHash({ e }); if (location.hash !== to) history.pushState(null, "", to || location.pathname + location.search); popPushed = false; }
  const s = await loadSky();
  if (!document.body.classList.contains("on-sky")) return;                  // the list was asked for while it loaded
  if (!(await s.show({ entry: e })) && e) goList(e, false);               // no sky to put an entry in: it is read in the list
}

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const onSky = document.body.classList.contains("on-sky");
  // the way out comes first: the games screen (its Settings, the update, the partner's code are on it)
  const play = part(body, "play");
  play.append(action("Back to menu", () => $("appsBtn").click()));
  play.append(onSky ? action("Browse as a list", () => goList()) : action("Star chart", () => goSky()));
  if (onSky && sky) {
    const content = part(body, "content");
    content.append(action("Constellations", () => sky.openSubjects()), action("Reset view", () => sky.home()));
  }
  const kinds = {};
  for (const e of ENTITIES) for (const k of kindsOf(e).slice(0, 1)) kinds[k] = (kinds[k] || 0) + 1;
  part(body, "about").append(line(`${ENTITIES.length.toLocaleString("en-GB")} things and ${LINKS.length.toLocaleString("en-GB")} links, the knowledge every game draws on`),
    line(Object.entries(kinds).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([k, n]) => `${n} ${k}`).join(", ")));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".lx-mark").innerHTML = APPS.find(a => a.id === "lexicon").logo;
bindSwitcher($("appsBtn"), "lexicon");
markButton($("skyMenu"), $("menuDlg"));                      // the menu's button on the sky is the games' menu button: the Codex mark
$("q").addEventListener("input", () => {
  if (location.hash !== formatHash({ list: true })) history.pushState(null, "", formatHash({ list: true }));
  $("entry").hidden = true; $("results").hidden = false;
  listResults();
});
$("searchForm").addEventListener("submit", e => {
  e.preventDefault();
  const first = search($("q").value)[0];
  if (first) open(first.id);
});
$("modeList").addEventListener("click", () => { if (document.body.classList.contains("on-sky")) goList(); });
$("modeSky").addEventListener("click", () => { if (!document.body.classList.contains("on-sky")) goSky(); });
addEventListener("popstate", () => {
  const v = parseHash(location.hash);
  if (v.list) goList(v.e, false); else goSky(v.e, false);
});
$("menuBtn").addEventListener("click", openMenu);
$("skyMenu").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
// it opens on the star chart, every time (nothing about the last way you looked is kept); an address can ask for the list,
// and Settings' 2D mode (battery saver) opens on the list: the chart is a WebGL scene that turns and redraws
{
  const v = parseHash(location.hash);
  if (v.list || !defaultIs3D()) goList(v.e, false); else goSky(v.e, false);
}
