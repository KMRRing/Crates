// Ledger: how learning is going, across everything the suite keeps. A headline for the last week against the one before;
// the knowledge base's subjects, strongest and weakest, from the pile; the health of the revision; each section of the games
// screen; judgement (Punt's calibration, Quote's markets); and three next steps. Everything is read from what is already
// stored (ledger-review.js derives it; this draws it); nothing here writes another game's keys.
import { stats, reset, GAPS, STAKES, GRADES, weekOf, actualKnowledge } from "./ledger-log.js";
import { review, span, daysAgo } from "./ledger-review.js";
import * as pile from "./pile.js";
import { PILES } from "./pile.js";
import { part, action, line } from "./menu.js";
import { sure } from "./sure.js";
import { bindSwitcher, APPS, SECTIONS } from "./apps.js";
import { MARKS } from "./suite.js";
import { waitMark } from "./loading.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.append(e); return e; };
const svgEl = (tag, attrs, parent) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.append(e); return e; };
const link = (parent, text, href, cls = "lg-link") => { const a = el("a", cls, parent, text); a.href = href; return a; };
/** Sums a week-keyed table into one: { key: [a, b, …] } added up across the weeks. */
function total(byWeek) {
  const out = {};
  for (const wk of Object.values(byWeek || {})) for (const [k, v] of Object.entries(wk)) out[k] = (out[k] || v.map(() => 0)).map((x, i) => x + v[i]);
  return out;
}
const weeksOf = table => Object.keys(table || {}).sort();

// ---------- the page: a headline, then five cards (tabs upright, side by side sideways) ----------
const TABS = [["knowledge", "Topics", "Knowledge by topic"], ["revision", "Revision", "Revision health"], ["games", "Games", "Across the games"], ["judgement", "Judgement", "Judgement"], ["next", "Next", "Next steps"]];
let index = null;            // kb-index.js, fetched after the first draw (118 KB): the base's subjects
let tab = "knowledge";
try { tab = sessionStorage.getItem("ledger:tab") || tab; } catch { /* private mode */ }

/** Every saved key but the two the page reads through their own modules (the pile's items are the biggest). */
function snapshot() {
  const o = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k !== "pile:items" && k !== "ledger:stats") o[k] = localStorage.getItem(k); } } catch { /* private mode */ }
  return o;
}
function draw() {
  const s = stats(), box = $("ledger");
  const r = review({ snap: snapshot(), apps: APPS, sections: SECTIONS, marks: MARKS, items: pile.all(), stats: s, subjectOf: index ? id => index.SUBJECTS[index.SUBJECT[id]]?.label : null, now: Date.now() });
  box.replaceChildren();
  if (r.empty) { empty(box); if (!index) lazyIndex(); return; }
  headline(el("section", "lg-head", box), r.headline);
  const tabs = el("div", "lg-tabs", box); tabs.setAttribute("role", "tablist");
  const cards = {};
  for (const [id, name, title] of TABS) {
    const b = el("button", "lg-tab", tabs, name); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.tab = id;
    b.addEventListener("click", () => { tab = id; try { sessionStorage.setItem("ledger:tab", id); } catch { /* private mode */ } show(); });
    const c = cards[id] = el("section", `lg-card lg-${id}`, box); el("h2", null, c, title);
  }
  const show = () => TABS.forEach(([id], i) => { cards[id].classList.toggle("on", id === tab); tabs.children[i].setAttribute("aria-selected", String(id === tab)); });
  show();
  topicsCard(cards.knowledge, r);
  healthCard(cards.revision, r, s);
  gamesCard(cards.games, r);
  const j = cards.judgement; judgementRead(j, r); confidence(j, s); markets(j, s);
  nextCard(cards.next, r);
  if (!index) lazyIndex();
}
function lazyIndex() { import("./kb-index.js").then(m => { index = m; draw(); }, () => { index = { SUBJECTS: [], SUBJECT: {} }; draw(); }); }

function empty(box) {
  const c = el("section", "lg-card lg-empty-card on", box);
  el("h2", null, c, "Nothing to read yet");
  el("p", "lg-lead", c, "Ledger reads what the games already keep, so it fills as you play. There is just nothing to measure yet. Once you have, it will show:");
  const ul = el("ul", "lg-will", c);
  for (const [h, t] of [
    ["Knowledge by topic", "which subjects (Countries, Paintings, Law…) you hold firmly and which keep slipping. A question missed in Punt, Quote or Chart goes to the pile with its subject, so it begins with your first miss."],
    ["Revision health", "what is due, how late, and your streak of days with a review. It begins with your first review in Deck or a game."],
    ["Across the games", "bests, stars, lessons and a row of dots for each daily, as soon as a game has been played."],
    ["Judgement", "how far your commitments in Punt and your markets in Quote match what you know, after a few rounds."]])
    { const li = el("li", null, ul); el("b", null, li, h); li.append(` ${t}`); }
  link(c, "Open Deck", "deck.html", "btn primary lg-go");
}

// ---------- the headline ----------
function headline(box, h) {
  if (h.empty) { el("p", "lg-lead", box, "Last week and the week before are both empty. This line compares them once you have played across a week."); return; }
  box.setAttribute("aria-label", "Last week against the week before");
  const cell = (label, now, was, fmt = v => String(v)) => {
    const d = el("div", "lg-hc", box), up = was == null || now == null ? 0 : Math.sign(now - was);
    el("span", "lab", d, label);
    const v = el("b", null, d, now == null ? "–" : fmt(now));
    el("i", `arr ${up > 0 ? "up" : up < 0 ? "down" : "flat"}`, v, up > 0 ? " ↑" : up < 0 ? " ↓" : " →").setAttribute("aria-label", up > 0 ? "up" : up < 0 ? "down" : "level");
    el("small", null, d, `before: ${was == null ? "–" : fmt(was)}`);
  };
  cell("Learned", h.last.learned, h.prev.learned);
  cell("Recall after a week", h.last.recall, h.prev.recall, v => `${v}%`);
  cell("Games played", h.last.played, h.prev.played);
  cell("Dailies kept", h.last.dailies, h.prev.dailies);
}

// ---------- knowledge by topic ----------
function topicsCard(card, r) {
  const t = r.topics;
  if (!index) { const p = el("p", "lg-empty", card); p.append(waitMark(), " Reading the knowledge base…"); return; }
  if (!t.subjects) { el("p", "lg-empty", card, r.health.held + r.health.learned ? "The pile holds nothing about the knowledge base's subjects yet: its items are words or puzzles." : "Nothing yet. Each question you miss in Punt, Quote or Chart goes to the pile with the subject it is about (Countries, Paintings, Law…), and this card then shows where you are strong and where you are not."); return; }
  if (t.strong.length) { el("h3", "lg-sub-h", card, "Strongest"); for (const s of t.strong) subjectRow(card, s, false); }
  if (t.weak.length) { el("h3", "lg-sub-h", card, "Weakest"); for (const s of t.weak) subjectRow(card, s, true); }
  if (t.rest.length) {
    const d = el("details", "lg-fold", card); el("summary", null, d, `${t.rest.length} more subject${t.rest.length === 1 ? "" : "s"}`);
    for (const s of t.rest) subjectRow(d, s, false);
  }
  el("p", "lg-note", card, "Ranked by recall (items right when they came back, allowing for few tries) and by how many are learned, among subjects with three or more items. Missed counts items whose last answer was a miss in the last 30 days.");
}
function subjectRow(parent, s, weak) {
  const d = el("div", "lg-subj", parent);
  el("b", "name", d, s.label);
  const bar = el("span", "bar", d); el("i", null, bar).style.width = `${s.rate == null ? 0 : Math.round(100 * s.rate)}%`;
  bar.title = s.rate == null ? "Not yet recalled" : `Recalled ${Math.round(100 * s.rate)}% of ${s.tries}`;
  el("span", "val", d, s.rate == null ? "–" : `${Math.round(100 * s.rate)}%`);
  el("small", null, d, `${s.held} held · ${s.learned} learned · ${s.misses30} missed in 30 days`);
  if (weak) link(d, "Review this", `deck.html#topic=${encodeURIComponent(s.label)}`);
}

// ---------- revision health ----------
const PILE_SHORT = ["Ultra", "Short", "Medium", "Long", "Longer", "Longest"];
function healthCard(card, r, s) {
  const h = r.health, grid = el("div", "lg-two lg-three", card);
  const tile = (n, what) => { const d = el("div", null, grid); el("b", null, d, n); d.append(what); };
  tile(String(h.due), "due now");
  tile(h.due ? span(h.oldest) : "–", "overdue, oldest");
  tile(String(h.learnedWeek), "learned in 7 days");
  if (h.due) el("p", "lg-note", card, `Overdue: ${h.overdue.hours} by under a day, ${h.overdue.days} by up to a week, ${h.overdue.weeks} by a week or more. Half are more than ${span(h.median)} late.`);
  el("h3", "lg-sub-h", card, "The piles");
  const cells = [...h.piles.map((n, i) => ({ n, name: PILES[i].name, short: PILE_SHORT[i] })), { n: h.learned, name: "Learned", short: "Learned" }], all = cells.reduce((a, c) => a + c.n, 0);
  if (all) {
    const stack = el("div", "lg-stack", card);
    cells.forEach((c, i) => { if (!c.n) return; const x = el("i", null, stack); x.style.width = `${(100 * c.n) / all}%`; x.style.background = `color-mix(in srgb, var(--lg-in) ${22 + i * 13}%, var(--sheet))`; x.title = `${c.name}: ${c.n}`; });
  }
  const row = el("div", "lg-piles", card);
  for (const c of cells) { const d = el("div", null, row); el("b", null, d, String(c.n)); el("span", null, d, c.short).title = c.name; }
  recall(card, s);
  el("h3", "lg-sub-h", card, "Days with a review");
  const lead = el("p", "lg-lead", card);
  lead.append(el("b", null, null, `${h.streak} day${h.streak === 1 ? "" : "s"}`), h.streak ? (h.reviewedToday ? " running, today included." : " running; review today to keep it.") : " running. Review something today to start one.");
  dots(card, h.dots, "Days with a review, last 14, today last");
}
function dots(parent, flags, label) {
  const d = el("span", "lg-dots", parent); d.setAttribute("role", "img"); d.setAttribute("aria-label", `${label}: ${flags.filter(Boolean).length} of ${flags.length}`);
  flags.forEach((on, i) => { el("i", on ? "on" : "", d).title = i === flags.length - 1 ? "today" : `${flags.length - 1 - i} days ago`; });
}

// ---------- recall: what you learned, still known when it came back ----------
function recall(card, s) {
  el("h3", "lg-sub-h", card, "Recall, by how long away");
  const t = total(s.recall), long = ["week", "month", "quarter"].reduce((a, k) => [a[0] + (t[k]?.[0] || 0), a[1] + (t[k]?.[1] || 0)], [0, 0]);
  if (!Object.keys(t).length) { el("p", "lg-empty", card, "Nothing yet. Each time an item from the pile comes back, in Deck or in a game, it counts here: right or wrong, and how long it was away."); return; }
  const lead = el("p", "lg-lead", card);
  if (long[1]) lead.append("Away a week or more and still known: ", el("b", null, null, `${pct(...long)}%`), ` of ${long[1]}.`);
  else lead.textContent = "Nothing has been away a week yet: the long piles start counting when their items come back.";
  const bars = el("div", "lg-bars", card);
  for (const g of GAPS) {
    const [r, n] = t[g.id] || [0, 0];
    el("span", "lab", bars, g.name);
    const bar = el("span", `bar${["week", "month", "quarter"].includes(g.id) ? " key" : ""}`, bars);
    el("i", null, bar).style.width = `${pct(r, n)}%`;
    const v = el("span", "val", bars);
    if (n) v.append(el("b", null, null, `${pct(r, n)}%`), ` of ${n}`); else v.textContent = "–";
  }
  trend(card, weeksOf(s.recall).map(w => { const k = ["week", "month", "quarter"].reduce((a, id) => [a[0] + (s.recall[w][id]?.[0] || 0), a[1] + (s.recall[w][id]?.[1] || 0)], [0, 0]); return [w, k[1] ? k[0] / k[1] : null, k[1]]; }), "a week or more away, by week");
}

// ---------- across the games ----------
const ago = (t, now) => { const d = daysAgo(t, now); return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 14 ? `${d} days ago` : `${Math.round(d / 7)} weeks ago`; };
const short = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : Number.isInteger(n) ? n.toLocaleString("en-GB") : n.toFixed(2));
function gamesCard(card, r) {
  const now = Date.now(), all = r.games;
  if (!all.some(g => g.started)) { el("p", "lg-empty", card, "No game has been played on this device yet. Bests, stars, lessons and a row of dots for each daily appear here."); return; }
  const stalled = all.filter(g => g.stalled), left = all.filter(g => g.left);
  if (stalled.length || left.length) {
    const hl = el("div", "lg-alert", card);
    const list = (title, gs, extra) => { const p = el("p", null, hl); el("b", null, p, title); gs.forEach((g, i) => { if (i) p.append(", "); link(p, g.name, g.href, "lg-inline"); p.append(` (${extra(g)})`); }); };
    if (stalled.length) list("Started, now stalled: ", stalled, g => ago(g.lastAt, now));
    if (left.length) list("Lessons left: ", left, g => g.left);
  }
  let opened = false;
  for (const sec of r.sections) {
    const d = el("details", "lg-sec", card); if (sec.started && !opened) { d.open = true; opened = true; }
    const sm = el("summary", null, d); el("b", null, sm, sec.title);
    el("span", "sum", sm, sec.started ? `${sec.started} of ${sec.games.length} started · ${sec.recent} lately · ${sec.kept} dailies kept` : `${sec.games.length} games, none started`);
    for (const g of sec.games.filter(g => g.started)) gameRow(d, g, now);
    const un = sec.games.filter(g => !g.started);
    if (un.length && sec.started) el("p", "lg-note", d, `Not started: ${un.map(g => g.name).join(", ")}.`);
  }
}
function gameRow(parent, g, now) {
  const d = el("div", `lg-game${g.stalled ? " stalled" : ""}`, parent), bits = [];
  link(d, g.name, g.href, "name");
  el("small", "last", d, g.lastAt ? `played ${ago(g.lastAt, now)}` : "");
  if (g.best != null) bits.push(`best ${short(g.best)}${g.bestAt ? `, set ${ago(g.bestAt, now)}` : ""}`);
  if (g.stars != null) bits.push(`${g.stars} star${g.stars === 1 ? "" : "s"}`);
  if (g.levels) bits.push(`${g.levels} level${g.levels === 1 ? "" : "s"} reached`);
  if (g.lessons) bits.push(g.lessons.of ? `${g.lessons.done} of ${g.lessons.of} lessons` : `${g.lessons.done} lessons`);
  if (g.streak) bits.push(`best streak ${g.streak}`);
  el("span", "facts", d, bits.join(" · ") || "started");
  if (g.daily) dots(d, g.dots, `${g.name} daily, last 14 days`);
}

// ---------- judgement ----------
function judgementRead(card, r) {
  const j = r.judgement, p = el("div", "lg-read", card);
  if (j.reads.length) for (const x of j.reads) el("p", null, p, x.kind === "over" ? `You commit more than you know on ${x.label}: nearly all your recent Punt items there are answers you committed to and missed.` : `You know more than you commit on ${x.label}: your recent Punt items there are mostly right answers you held back on.`);
  else if (j.commits >= 10 && j.gap != null) el("p", null, p, Math.abs(j.gap) <= .05 ? "Overall you commit about as much as you know." : j.gap > 0 ? "Overall you commit more than you know." : "Overall you know more than you commit.");
  else el("p", null, p, "A plain read of where you commit more than you know, or less, appears after a few rounds of Punt.");
}

// ---------- confidence: what your commitments believed, and how often they came off ----------
function confidence(card, s) {
  el("h3", "lg-sub-h", card, "Confidence");
  const t = total(s.stake), n = Object.values(t).reduce((a, v) => a + v[1], 0);
  if (!n) { el("p", "lg-empty", card, "Nothing yet. Every commitment in Punt counts here: the chance your share committed implies, and whether it came off."); return; }
  const won = Object.values(t).reduce((a, v) => a + v[0], 0), brier = Object.values(t).reduce((a, v) => a + (v[2] ?? NaN), 0) / n;
  const believed = Object.entries(t).reduce((a, [k, v]) => a + (Number(k) + .5) / 10 * v[1], 0) / n;
  const lead = el("p", "lg-lead", card);
  const gap = Math.round(100 * (believed - won / n));
  lead.append(`Your commitments acted on `, el("b", null, null, `${Math.round(100 * believed)}%`), ` on average; you were right in `, el("b", null, null, `${pct(won, n)}%`), ` of ${n}. `,
    Math.abs(gap) <= 5 ? "Well matched." : gap > 0 ? `You commit as if ${gap} points surer than you are.` : `You're ${-gap} points better than your commitments say: commit more when you know.`);
  // the calibration chart: believed (x) against won (y), each tenth a dot sized by its commitments, the diagonal ideal
  const W = 300, H = 210, L = 30, B = 24, x = p => L + p * (W - L - 8), y = p => H - B - p * (H - B - 8);
  const svg = svgEl("svg", { class: "lg-chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Believed chance against how often you were right" }, card);
  for (const p of [0, .25, .5, .75, 1]) { svgEl("line", { class: "grid", x1: x(0), x2: x(1), y1: y(p), y2: y(p) }, svg); svgEl("text", { class: "tick", x: L - 4, y: y(p) + 3, "text-anchor": "end" }, svg).textContent = `${p * 100}`; svgEl("text", { class: "tick", x: x(p), y: H - B + 13, "text-anchor": "middle" }, svg).textContent = `${p * 100}`; }
  svgEl("path", { class: "axis", d: `M${x(0)} ${y(1)}V${y(0)}H${x(1)}` }, svg);
  svgEl("path", { class: "ideal", d: `M${x(0)} ${y(0)}L${x(1)} ${y(1)}` }, svg);
  const maxN = Math.max(...Object.values(t).map(v => v[1]));
  for (const [k, v] of Object.entries(t)) svgEl("circle", { class: "dot", cx: x((Number(k) + .5) / 10), cy: y(v[0] / v[1]), r: 3 + 6 * Math.sqrt(v[1] / maxN) }, svg);
  svgEl("text", { x: x(.5), y: H - 1, "text-anchor": "middle" }, svg).textContent = "believed, %";
  const two = el("div", "lg-two", card);
  const b1 = el("div", null, two); el("b", null, b1, Number.isFinite(brier) ? brier.toFixed(3) : "–"); b1.append("Brier score (the average squared gap between the chance you acted on and what happened): 0 is perfect, always saying 50% scores .250");
  const b2 = el("div", null, two); el("b", null, b2, `${n}`); b2.append("ventures counted (a hold is a venture of 0%)");
  // right, by the share committed: bigger shares should be right more often
  const sizes = total(s.size), bars = el("div", "lg-bars lg-sizes", card);
  for (const k of STAKES) {
    const [w, m] = sizes[k] || [0, 0];
    if (!m) continue;
    el("span", "lab", bars, k === 100 ? "Everything" : k === 0 ? "Held (0%)" : `Committed ${k}%`);
    el("i", null, el("span", "bar", bars)).style.width = `${pct(w, m)}%`;
    const v = el("span", "val", bars); v.append(el("b", null, null, `${pct(w, m)}%`), ` right of ${m}`);
  }
  if (bars.childElementCount) bars.before(el("p", "lg-note lg-sub", null, "Right, by share committed: bigger shares should be right more often."));
  knowledge(card, s);
  trend(card, weeksOf(s.stake).map(w => { const v = Object.values(s.stake[w]); const nn = v.reduce((a, q) => a + q[1], 0); const b = v.reduce((a, q) => a + (q[2] ?? NaN), 0) / nn; return [w, nn && Number.isFinite(b) ? 1 - b / .5 : null, nn]; }), "skill by week (1 − Brier/.5; 50 = guessing at evens)");
}

// ---------- knowledge: what your commitments claimed you knew, against what you knew ----------
// Both corrected for guessing: a commitment's Kelly chance less what a pure guess gets, over what's left, is the share of the
// answer it claimed to know (a hold claims none; at a fair price it's the share itself); the hit rate corrected the
// same way is the share you knew. In a perfect world the two are the same at every share.
const signed = v => `${v < 0 ? "−" : ""}${Math.abs(Math.round(100 * v))}%`;
function knowledge(card, s) {
  const t = total(s.know), counted = Object.values(t).reduce((a, v) => a + v[1], 0);
  if (!counted) { el("p", "lg-note lg-sub", card, "Knowledge, read two ways, starts with your next commitments in Punt: what your shares committed claim you know, against what you do."); return; }
  const sum = i => Object.values(t).reduce((a, v) => a + v[i], 0);
  const claimed = sum(3) / counted, knew = actualKnowledge(sum(0), counted, sum(2)), gap = Math.round(100 * (claimed - (knew ?? 0)));
  el("h3", "lg-sub-h", card, "Knowledge");
  const lead = el("p", "lg-lead", card);
  lead.append("Your commitments claim you know ", el("b", null, null, signed(claimed)), " of the answers; your results say ", el("b", null, null, knew == null ? "–" : signed(knew)), ". ",
    knew == null ? "" : Math.abs(gap) <= 5 ? "Your commitments claim what you know." : gap > 0 ? `You commit as if you know ${gap} points more than you do.` : `You know ${-gap} points more than your commitments claim: commit more when you know.`);
  // by share committed: the claim (outlined) against what you knew (filled)
  const bars = el("div", "lg-bars lg-know", card), rows = [];
  for (const k of STAKES) {
    const [w, n, g, im] = t[k] || [0, 0, 0, 0];
    if (!n) continue;
    const c = im / n, a = actualKnowledge(w, n, g);
    rows.push({ n, c, a });
    el("span", "lab", bars, k === 100 ? "Everything" : k === 0 ? "Held (0%)" : `Committed ${k}%`);
    const bar = el("span", "bar two", bars);
    el("i", "claimed", bar).style.width = `${Math.round(100 * c)}%`;
    el("i", null, bar).style.width = `${Math.round(100 * Math.max(0, a ?? 0))}%`;
    const v = el("span", "val", bars); v.append(`${signed(c)} → `, el("b", null, null, a == null ? "–" : signed(a)), ` of ${n}`);
  }
  bars.before(el("p", "lg-note lg-sub", null, "Knowledge, by share committed: what your commitments claimed (outlined) and what you knew (filled), both corrected for guessing."));
  // do the shares rise with what you knew? the claim and the knowledge across the shares with a few commitments each
  const used = rows.filter(r => r.n >= 3 && r.a != null);
  let note = "";
  if (used.length >= 3) {
    const W = used.reduce((a, r) => a + r.n, 0), mc = used.reduce((a, r) => a + r.n * r.c, 0) / W, ma = used.reduce((a, r) => a + r.n * r.a, 0) / W;
    const cov = used.reduce((a, r) => a + r.n * (r.c - mc) * (r.a - ma), 0), vc = used.reduce((a, r) => a + r.n * (r.c - mc) ** 2, 0), va = used.reduce((a, r) => a + r.n * (r.a - ma) ** 2, 0);
    const r = vc && va ? cov / Math.sqrt(vc * va) : 0;
    note = r >= .8 ? "Your shares committed rise with what you know." : r >= .4 ? "Your shares committed rise only loosely with what you know." : "Your shares committed don't follow what you know.";
  }
  const all = Object.values(total(s.size)).reduce((a, v) => a + v[1], 0);
  el("p", "lg-note", card, [note, all > counted ? `${counted} of ${all} commitments count here: older ones didn't record what a pure guess would get.` : ""].filter(Boolean).join(" "));
}

// ---------- markets: how often the truth was inside, and the grades ----------
const GRADE_COLOURS = { SS: "var(--lg-good)", S: "color-mix(in srgb, var(--lg-good) 65%, var(--sheet))", A: "var(--lg-in)", B: "color-mix(in srgb, var(--lg-in) 50%, var(--sheet))", C: "var(--lg-bad)" };
function markets(card, s) {
  el("h3", "lg-sub-h", card, "Markets");
  const weeks = weeksOf(s.market), all = weeks.reduce((a, w) => { const m = s.market[w]; a.n += m.n; a.inside += m.inside; for (const g of GRADES) a.g[g] = (a.g[g] || 0) + (m.grades[g] || 0); return a; }, { n: 0, inside: 0, g: {} });
  if (!all.n) { el("p", "lg-empty", card, "Nothing yet. Every market in Quote counts here: whether the truth lay inside it, and its grade."); return; }
  const lead = el("p", "lg-lead", card);
  lead.append("The truth inside your market: ", el("b", null, null, `${pct(all.inside, all.n)}%`), ` of ${all.n}. Graded A or better: `, el("b", null, null, `${pct((all.g.SS || 0) + (all.g.S || 0) + (all.g.A || 0), all.n)}%`), ".");
  const stack = el("div", "lg-stack", card);
  for (const g of GRADES) if (all.g[g]) { const i = el("i", null, stack); i.style.width = `${(100 * all.g[g]) / all.n}%`; i.style.background = GRADE_COLOURS[g]; i.title = `${g}: ${all.g[g]}`; }
  const key = el("div", "lg-key", card);
  for (const g of GRADES) { const k = el("span", null, key, `${g} ${all.g[g] || 0}`); k.style.setProperty("--c", GRADE_COLOURS[g]); }
  trend(card, weeks.map(w => [w, s.market[w].n ? s.market[w].inside / s.market[w].n : null, s.market[w].n]), "truth inside, by week");
}

/** A small weekly line (from two weeks with data): the share each week, the axis 0–100. */
function trend(card, points, label) {
  const pts = points.filter(p => p[1] != null);
  if (pts.length < 2) return;
  const W = 300, H = 74, L = 30, x = i => L + (i * (W - L - 8)) / (pts.length - 1), y = v => H - 16 - Math.max(0, Math.min(1, v)) * (H - 26);
  const svg = svgEl("svg", { class: "lg-chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label }, card);
  for (const p of [0, .5, 1]) { svgEl("line", { class: "grid", x1: L, x2: W - 8, y1: y(p), y2: y(p) }, svg); svgEl("text", { class: "tick", x: L - 4, y: y(p) + 3, "text-anchor": "end" }, svg).textContent = `${p * 100}`; }
  svgEl("path", { class: "line", d: "M" + pts.map((p, i) => `${x(i)} ${y(p[1])}`).join("L") }, svg);
  pts.forEach((p, i) => svgEl("circle", { class: "dot", cx: x(i), cy: y(p[1]), r: 3 }, svg));
  svgEl("text", { x: L, y: H - 2 }, svg).textContent = `${label}: ${pts[0][0].slice(5)} to ${pts[pts.length - 1][0].slice(5)}`;
}

// ---------- next steps ----------
const TAG = { review: "Revise", course: "Learn", daily: "Daily" };
function nextCard(card, r) {
  if (!r.next.length) { el("p", "lg-empty", card, "Nothing to suggest yet. Once something is due, a course is part-way or a daily is waiting, it appears here."); return; }
  const ol = el("ol", "lg-steps", card);
  for (const n of r.next) { const li = el("li", null, ol); el("span", "tag", li, TAG[n.kind]); link(li, n.text, n.href, "go"); el("small", null, li, n.why); }
  if (r.next.length < 3) el("p", "lg-note", card, "Fewer than three: the others need more to go on.");
}

// ---------- menu ----------
// the menu: Settings (start the record afresh), About (how each measure is taken)
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "settings").append(action("Start the record afresh", async () => {
    if (!(await sure("Clear the Ledger's record and start again from today? Your piles stay as they are.", { yes: "Clear record" }))) return;
    reset(); draw(); $("menuDlg").close();
  }, "link"));
  part(body, "about").append(
    line("Recall: every item from the pile that comes back, right or wrong, sorted by how long it was away. Away a week or more is the measure that matters: what lasts."),
    line("Confidence: a commitment in Punt read backwards through Kelly's rule (the share of your purse that a sound strategy commits at a given chance). Committing a share f of the purse at a return of o times the share (2 for Punt's doubling), you act as if your chance were (1 + f(o − 1)) / o. Dots on the diagonal mean you know what you know."),
    line("Brier score: the average squared gap between that chance and what happened (1 right, 0 wrong)."),
    line("Knowledge: that chance, less what a pure guess would get (one in the number of options; for several right ones, one in the ways to pick them; nothing, typed), over what's left: the share of the answer your commitment claimed to know (a hold claims none; at a fair price it's the share itself). Your hit rate corrected the same way is what you knew: right half the time on four options is knowing a third."),
    line("Markets: in Quote, how often the truth lay inside your bid and ask, and the grades."),
    line("The headline compares the last whole ISO week with the one before. Subjects, days and streaks come from the pile and the saved keys of each game; where a game keeps no date, none is shown. Weeks are ISO weeks. The record syncs with your solo code, like everything else."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "ledger");
document.querySelector(".lg-mark").innerHTML = APPS.find(a => a.id === "ledger").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
addEventListener("storage", () => draw());   // another tab, or a synced device
window.__ledger = { draw, weekOf };
draw();
