// Ledger: is it working? How well what you learn stays learned (the pile's items, by how long they were away), how
// well your confidence matches your results (Punt's stakes against how often they won) and how often your markets
// hold the truth (Quote). Read from the record the games keep (ledger-log.js); nothing here changes the games.
import { stats, reset, GAPS, STAKES, GRADES, weekOf } from "./ledger-log.js";
import * as pile from "./pile.js";
import { PILES } from "./pile.js";
import { part, action, line } from "./menu.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.append(e); return e; };
const svgEl = (tag, attrs, parent) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.append(e); return e; };
/** Sums a week-keyed table into one: { key: [a, b, …] } added up across the weeks. */
function total(byWeek) {
  const out = {};
  for (const wk of Object.values(byWeek || {})) for (const [k, v] of Object.entries(wk)) out[k] = (out[k] || v.map(() => 0)).map((x, i) => x + v[i]);
  return out;
}
const weeksOf = table => Object.keys(table || {}).sort();

function draw() {
  const s = stats(), box = $("ledger");
  box.replaceChildren();
  recall(box, s);
  confidence(box, s);
  markets(box, s);
  el("p", "lg-note", box, `Recording since ${new Date(s.since).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. It fills as you play: items that come back, bets in Punt, markets in Quote.`);
}

// ---------- recall: what you learned, still known when it came back ----------
function recall(box, s) {
  const card = el("section", "lg-card", box);
  el("h2", null, card, "Recall");
  const t = total(s.recall), long = ["week", "month", "quarter"].reduce((a, k) => [a[0] + (t[k]?.[0] || 0), a[1] + (t[k]?.[1] || 0)], [0, 0]);
  if (!Object.keys(t).length) el("p", "lg-empty", card, "Nothing yet. Each time an item from the pile comes back, in Deck or in a game, it counts here: right or wrong, and how long it was away.");
  else {
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
  const counts = pile.counts(), row = el("div", "lg-piles", card);
  // the piles by their gaps, short enough for a row of seven: now, 10 min, 12 h, 7 d, 1 mo, 3 mo
  const gapLabel = ms => { const h = ms / 3600000; return !ms ? "now" : h < 1 ? `${Math.round(ms / 60000)} min` : h < 48 ? `${Math.round(h)} h` : h < 24 * 28 ? `${Math.round(h / 24)} d` : `${Math.round(h / 24 / 30.44)} mo`; };
  PILES.forEach((p, i) => { const d = el("div", null, row); el("b", null, d, String(counts.piles[i] || 0)); el("span", null, d, gapLabel(p.gap)).title = `${p.name} pile`; });
  const d = el("div", null, row); el("b", null, d, String(counts.learned || 0)); el("span", null, d, "Learned");
}

// ---------- confidence: what your stakes believed, and how often they won ----------
function confidence(box, s) {
  const card = el("section", "lg-card", box);
  el("h2", null, card, "Confidence");
  const t = total(s.stake), n = Object.values(t).reduce((a, v) => a + v[1], 0);
  if (!n) { el("p", "lg-empty", card, "Nothing yet. Every bet in Punt counts here: the chance your stake implies, and whether it won."); return; }
  const won = Object.values(t).reduce((a, v) => a + v[0], 0), brier = Object.values(t).reduce((a, v) => a + (v[2] ?? NaN), 0) / n;
  const believed = Object.entries(t).reduce((a, [k, v]) => a + (Number(k) + .5) / 10 * v[1], 0) / n;
  const lead = el("p", "lg-lead", card);
  const gap = Math.round(100 * (believed - won / n));
  lead.append(`Your stakes believed `, el("b", null, null, `${Math.round(100 * believed)}%`), ` on average; you won `, el("b", null, null, `${pct(won, n)}%`), ` of ${n}. `,
    Math.abs(gap) <= 5 ? "Well matched." : gap > 0 ? `You stake as if ${gap} points surer than you are.` : `You're ${-gap} points better than your stakes say: stake more when you know.`);
  // the calibration chart: believed (x) against won (y), each tenth a dot sized by its bets, the diagonal ideal
  const W = 300, H = 210, L = 30, B = 24, x = p => L + p * (W - L - 8), y = p => H - B - p * (H - B - 8);
  const svg = svgEl("svg", { class: "lg-chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Believed chance against how often you won" }, card);
  for (const p of [0, .25, .5, .75, 1]) { svgEl("line", { class: "grid", x1: x(0), x2: x(1), y1: y(p), y2: y(p) }, svg); svgEl("text", { class: "tick", x: L - 4, y: y(p) + 3, "text-anchor": "end" }, svg).textContent = `${p * 100}`; svgEl("text", { class: "tick", x: x(p), y: H - B + 13, "text-anchor": "middle" }, svg).textContent = `${p * 100}`; }
  svgEl("path", { class: "axis", d: `M${x(0)} ${y(1)}V${y(0)}H${x(1)}` }, svg);
  svgEl("path", { class: "ideal", d: `M${x(0)} ${y(0)}L${x(1)} ${y(1)}` }, svg);
  const maxN = Math.max(...Object.values(t).map(v => v[1]));
  for (const [k, v] of Object.entries(t)) svgEl("circle", { class: "dot", cx: x((Number(k) + .5) / 10), cy: y(v[0] / v[1]), r: 3 + 6 * Math.sqrt(v[1] / maxN) }, svg);
  svgEl("text", { x: x(.5), y: H - 1, "text-anchor": "middle" }, svg).textContent = "believed, %";
  const two = el("div", "lg-two", card);
  const b1 = el("div", null, two); el("b", null, b1, Number.isFinite(brier) ? brier.toFixed(3) : "–"); b1.append("Brier score: 0 is perfect; always saying 50% scores .250");
  const b2 = el("div", null, two); el("b", null, b2, `${n}`); b2.append("bets counted (passes aren't bets)");
  // won, by the size of the stake: bigger stakes should win more often
  const sizes = total(s.size), bars = el("div", "lg-bars lg-sizes", card);
  for (const k of STAKES) {
    const [w, m] = sizes[k] || [0, 0];
    if (!m) continue;
    el("span", "lab", bars, k === 100 ? "All in" : `Staked ${k}%`);
    el("i", null, el("span", "bar", bars)).style.width = `${pct(w, m)}%`;
    const v = el("span", "val", bars); v.append(el("b", null, null, `${pct(w, m)}%`), ` won of ${m}`);
  }
  if (bars.childElementCount) bars.before(el("p", "lg-note lg-sub", null, "Won, by stake: bigger stakes should win more often."));
  trend(card, weeksOf(s.stake).map(w => { const v = Object.values(s.stake[w]); const nn = v.reduce((a, q) => a + q[1], 0); const b = v.reduce((a, q) => a + (q[2] ?? NaN), 0) / nn; return [w, nn && Number.isFinite(b) ? 1 - b / .5 : null, nn]; }), "skill by week (1 − Brier/.5; 50 = guessing at evens)");
}

// ---------- markets: how often the truth was inside, and the grades ----------
const GRADE_COLOURS = { SS: "var(--lg-good)", S: "color-mix(in srgb, var(--lg-good) 65%, var(--sheet))", A: "var(--lg-in)", B: "color-mix(in srgb, var(--lg-in) 50%, var(--sheet))", C: "var(--lg-bad)" };
function markets(box, s) {
  const card = el("section", "lg-card", box);
  el("h2", null, card, "Markets");
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

// ---------- menu ----------
// the menu: Settings (start the record afresh), About (how each measure is taken)
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "settings").append(action("Start the record afresh", () => {
    if (!confirm("Clear the Ledger's record and start again from today? Your piles stay as they are.")) return;
    reset(); draw(); $("menuDlg").close();
  }, "link"));
  part(body, "about").append(
    line("Recall: every item from the pile that comes back, right or wrong, sorted by how long it was away. Away a week or more is the measure that matters: what lasts."),
    line("Confidence: a stake in Punt read backwards through Kelly's rule. Staking a share f of the pot at odds o, you act as if your chance were (1 + f(o − 1)) / o. Dots on the diagonal mean you know what you know."),
    line("Brier score: the average squared gap between that chance and what happened (1 won, 0 lost)."),
    line("Markets: in Quote, how often the truth lay inside your bid and ask, and the grades."),
    line("Weeks are ISO weeks. The record syncs with your solo code, like everything else."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "ledger");
document.querySelector(".lg-mark").innerHTML = APPS.find(a => a.id === "ledger").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
addEventListener("storage", e => { if (!e.key || e.key.startsWith("ledger:") || e.key.startsWith("pile:")) draw(); });   // another tab, or a synced device
window.__ledger = { draw, weekOf };
draw();
