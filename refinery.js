// Refinery: a course in how a refinery works, level by level. Each level opens with its lesson (refinery-lessons.js,
// its pictures refinery-scenes.js), then the plant itself on its flowsheet (refinery-sheet.js), where every stream can
// be sent anywhere that takes it, in shares, and the margin shows against par (the LP's plan, refinery-par.js); then
// an exam (refinery-exam.js). The engine (refinery-engine.js) runs the plant; the data (refinery-data.js) describes it.
// Together, the same level for everyone at the table (duel.js).
import { STREAMS, UNITS, POOLS, CRUDES, PROPS, H2_PRICE, BOUGHT, SULPHUR } from "./refinery-data.js";
import { FEED, evaluate, destinations, streamsOf, defaultRouting, normalise, poolsOf, specsOf, limitOf, fmtProp, failText, priceOf, refundOf, coLimits, homeOf, solve, ownProps } from "./refinery-engine.js";
import { CHAPTERS, LEVELS } from "./refinery-levels.js";
import { PAR } from "./refinery-par.js";
import { drawSheet, hitTest, GROUP_COLOUR } from "./refinery-sheet.js";
import { lessonFor, TEACHES, GLOSSARY } from "./refinery-lessons.js";
import { playScene } from "./refinery-scenes.js";
import { buildTest, isRight, rightAnswer, passMark, missedTap } from "./refinery-exam.js";
import { noteStars } from "./suite.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, action, mirror, line, toggle } from "./menu.js";
import { createDuel } from "./duel.js";

const $ = id => document.getElementById(id);
const PROGRESS = "refinery:progress", WORK = "refinery:work", AT = "refinery:at", FLOW = "refinery:flow";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
try { localStorage.removeItem("refinery:save"); } catch { /* the old campaign's save, before the course */ }
const money = n => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;
const kbd = v => `${v < 10 ? v.toFixed(1) : Math.round(v)} kb/d`;
const progress = () => read(PROGRESS, {});

// ---------- state ----------
let base = null;     // the level as written
let L = null;        // the level as played: with the crude chosen
let routing = null;  // { stream: { destination: share } }
let R = null;        // the latest run
let par = null;      // { margin, routing } for this crude
let target = null;   // par for the best crude (the level's goal)
let history = [], view = null, full = null, picked = null, toastTimer = 0;
let D = null;        // a match's plant (duel.js), kept apart from yours: { level, crude, routing, done, margin }

/** The level as played: its crude, and its market's prices where it has a choice of markets. */
function played(lv, crude, deck) {
  const d = lv.decks?.find(x => x.id === deck) || lv.decks?.[0];
  return { ...lv, crude, ...(d ? { deck: d.id, prices: { ...(lv.prices || {}), ...d.prices } } : {}) };
}
/** Par for a level, crude and market: worked out ahead (refinery-par.js), or here if a level is new since. */
function parOf(lv, crude, deck = null) {
  const d = lv.decks ? (deck || lv.decks[0].id) : null, p = PAR[lv.id]?.[d ? `${crude}/${d}` : crude];
  if (p) return p;
  const s = solve(played(lv, crude, d));
  return { margin: s.margin, routing: s.routing, values: s.values, capacity: s.capacity };
}
/** The level's goal: par for the market chosen, or for the best crude where the crude is the choice. */
const targetOf = (lv, deck) => (lv.decks ? parOf(lv, lv.crude, deck).margin : Math.max(...(lv.crudes || [lv.crude]).map(c => parOf(lv, c).margin)));

// ---------- levels ----------
/** Opens a level: your routing on it where you left it (fresh: as the level starts). */
function load(id, fresh = false) {
  if (duel.on) { if (!duel.newMatch()) $("level").value = base?.id || id; return; }
  base = LEVELS.find(l => l.id === id) || LEVELS[0];
  write(AT, base.id);
  const work = read(WORK, {}), w = fresh ? null : work[base.id];
  if (fresh && work[base.id]) { delete work[base.id]; write(WORK, work); }
  const crude = base.crudes?.includes(w?.crude) ? w.crude : base.crude, deck = base.decks?.some(d => d.id === w?.deck) ? w.deck : base.decks?.[0].id;
  L = played(base, crude, deck);
  routing = normalise(L, w?.routing || defaultRouting(L));
  par = parOf(base, crude, deck); target = targetOf(base, deck);
  history = []; picked = null; view = null;
  $("hint").hidden = true;
  $("level").value = base.id;
  render();
  if (!progress()[base.id]?.seen) openLesson();
}
/** Keeps your routing on this level (a match's goes to the match). */
function keep() {
  if (D) { duel.keep(D); return; }
  const work = read(WORK, {});
  work[base.id] = { routing, crude: L.crude, deck: L.deck, at: Date.now() };
  write(WORK, Object.fromEntries(Object.entries(work).sort((a, b) => b[1].at - a[1].at).slice(0, 60)));
}
function chooseCrude(id) {
  if (D?.done) return;
  L = played(base, id, L.deck);
  routing = normalise(L, routing);
  par = parOf(base, id, L.deck);
  if (D) { D.crude = id; D.routing = routing; }
  keep(); render();
}
/** A level with a choice of markets: the same plant at another price deck, with its own par. */
function chooseDeck(id) {
  if (D?.done) return;
  L = played(base, L.crude, id);
  par = parOf(base, L.crude, id); target = targetOf(base, id);
  if (D) { D.deck = id; }
  keep(); render();
}

// ---------- changing the plan ----------
/** Sets a stream's shares, keeping what was before for undo; streams a unit newly makes go to their best home. */
function setShares(s, shares, { remember = true } = {}) {
  if (D?.done || (duel.on && !D)) return;
  if (remember) { history.push(JSON.stringify(routing)); if (history.length > 80) history.shift(); }
  const before = R;
  routing = { ...routing, [s]: shares };
  // a unit that starts running: its products, made for the first time, go where they earn most
  const made = evaluate(L, routing);
  for (const st of streamsOf(L)) {
    if (st === s || !made.streams[st] || before?.streams[st]) continue;
    let best = null;
    for (const d of destinations(L, st)) {
      const m = evaluate(L, { ...routing, [st]: { [d]: 1 } }).margin;
      if (!best || m > best.m + 1e-9) best = { d, m };
    }
    if (best) routing = { ...routing, [st]: { [best.d]: 1 } };
  }
  if (D) D.routing = routing;
  keep();
  render();
}
/** One destination's share set, the stream's others scaled to make up the rest (or the rest to its home). */
function setShare(s, d, f) {
  const cur = routing[s] || {}, next = {}, others = Object.entries(cur).filter(([x]) => x !== d);
  const rest = 1 - f, sum = others.reduce((a, [, v]) => a + v, 0);
  if (f > 0) next[d] = f;
  if (rest > 1e-6) {
    if (sum > 1e-9) for (const [x, v] of others) next[x] = (v / sum) * rest;
    else { const h = homeOf(L, s) !== d ? homeOf(L, s) : destinations(L, s).find(x => x !== d); if (h) next[h] = rest; }
  }
  return next;
}
function undo() {
  if (!history.length) return;
  routing = JSON.parse(history.pop());
  if (D) D.routing = routing;
  keep(); render();
}

// ---------- the brief, the margin and the plant ----------
function render() {
  R = evaluate(L, routing);
  renderBrief();
  renderMargin();
  drawPlant();
  if ($("splitDlg").open && splitFor) fillSplit(splitFor);
}
const showStars = n => { $("stars").textContent = n ? "★".repeat(n) + "☆".repeat(3 - n) : ""; };
function renderBrief() {
  const ch = CHAPTERS.find(c => c.id === base.chapter), p = progress()[base.id] || {};
  $("where").textContent = `${ch.id}. ${ch.title} · ${base.id} ${base.title}`;
  showStars(p.stars);
  $("task").textContent = base.task;
  // a choice of crudes (each with its price and sulphur) or of markets (each a price deck)
  const pick = $("crudePick");
  pick.hidden = !base.crudes && !base.decks;
  if ((base.crudes || base.decks) && pick.dataset.level !== base.id + (D ? ":duel" : "")) {
    pick.dataset.level = base.id + (D ? ":duel" : "");
    pick.replaceChildren();
    const row = (name, id, options, on) => {
      const label = document.createElement("span"); label.textContent = name;
      const sel = document.createElement("select"); sel.className = "pool"; sel.dataset.accent = "rf"; sel.id = id;
      for (const [v, t] of options) { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.append(o); }
      sel.addEventListener("change", e => on(e.target.value));
      pick.append(label, sel);
      dropdown(sel);
    };
    if (base.crudes) row("Crude", "crudeSel", base.crudes.map(c => [c, `${CRUDES[c].name} · $${CRUDES[c].price} · ${CRUDES[c].sulphur}% S`]), chooseCrude);
    if (base.decks) row("Market", "deckSel", base.decks.map(d => [d.id, d.name]), chooseDeck);
  }
  if (base.crudes) $("crudeSel").value = L.crude;
  if (base.decks) $("deckSel").value = L.deck;
  $("undoBtn").disabled = !history.length || !!D?.done;
  const done = p.stars > 0;
  $("testBtn").hidden = !done || !!D;
  $("testBtn").textContent = p.test ? `Exam ${p.test.passed ? "✓" : `${p.test.right}/${p.test.of}`}` : "Exam";
  $("hintBtn").hidden = !!D;
  $("lessonBtn").hidden = false;
}
/** Whether the plan runs: every pool in spec, the sulphur plant and hydrogen within their limits, nothing lost. */
const runs = res => Object.values(res.pools).every(p => p.inSpec || p.vol <= 1e-4) && !res.issues.some(i => ["sru", "lost", "h2short"].includes(i.kind));
/** Stars for a margin: three at par, two near it, one in spec and not far off; a hint caps them at two, par's plan at one. */
function starsFor(m, res, p = progress()[base.id] || {}) {
  if (!runs(res)) return 0;
  const gap = target - m;
  const s = gap <= 0.1 ? 3 : gap <= 0.5 ? 2 : gap <= 1.5 ? 1 : 0;
  return Math.min(s, p.shown ? 1 : p.hinted ? 2 : 3);
}
function renderMargin() {
  const m = R.margin, el = $("margin");
  el.textContent = `${money(m)}/bbl`;
  el.className = m >= 0 ? "good" : "bad";
  $("par").textContent = `${base.crudes ? `par ${money(par.margin)} · best crude ${money(target)}` : `par ${money(par.margin)}`}${L.ticket ? ` · tickets ${money(R.tickets / (L.feed ?? FEED))}` : ""}`;
  const lo = Math.min(-5, m - 1, target - 6), hi = Math.max(target + 1.5, m + 1);
  const pct = v => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)).toFixed(1)}%`;
  $("marginBar").style.width = pct(m);
  $("parTick").style.left = pct(target);
  const off = Object.entries(R.pools).filter(([, p]) => !p.inSpec && p.vol > 1e-4), hard = R.issues.find(i => ["sru", "lost", "h2short"].includes(i.kind));
  const gap = target - m, v = $("verdict");
  if (D) { duelVerdict(off, gap); return; }
  const stars = starsFor(m, R), p = progress(), was = p[base.id] || {};
  // a level of several markets is done in each of them: it holds the fewest stars any market has
  const decks = base.decks ? { ...(was.decks || {}), [L.deck]: Math.max(was.decks?.[L.deck] || 0, stars) } : null;
  const won = decks ? Math.min(...base.decks.map(d => decks[d.id] || 0)) : stars, deckBetter = decks && decks[L.deck] > (was.decks?.[L.deck] || 0);
  v.className = `rf-verdict${stars === 3 ? " good" : ""}`;
  v.textContent = hard ? hard.text : off.length ? `${off.map(([id]) => POOLS[id].name).join(" and ")} off spec: ${failText(off[0][1].fails[0])}.`
    : gap <= 0.1 ? "At par, every pool in spec." : `${money(gap)}/bbl short of par${base.crudes && L.crude !== bestCrude() ? " (another crude does better)" : ""}.`;
  // stars won are kept; a first finish, or more stars, says so
  if (won > (was.stars || 0) || deckBetter || m > (was.best ?? -Infinity) + 1e-9) {
    p[base.id] = { ...was, stars: Math.max(won, was.stars || 0), best: Math.max(m, was.best ?? -Infinity), ...(decks ? { decks } : {}) };
    write(PROGRESS, p);
    noteStars("refinery", starsAll());
    showStars(p[base.id].stars);
    if (won > (was.stars || 0)) setTimeout(() => finished(won), 350);
    else if (deckBetter) toast(`${base.decks.find(d => d.id === L.deck).name}: ${"★".repeat(stars)}${"☆".repeat(3 - stars)}. The level counts once every market runs.`);
  }
  const next = LEVELS[LEVELS.indexOf(base) + 1];
  $("nextBtn").hidden = !(progress()[base.id]?.stars && next);
  $("nextBtn").textContent = "Next";
  $("nextBtn").onclick = () => next && load(next.id);
  // the plant's one standing problem, under the flowsheet
  const issue = $("issue"), first = hard || R.issues.find(i => i.kind === "cap" || i.kind === "market" || i.kind === "h2");
  issue.hidden = !first;
  if (first) issue.textContent = first.text;
}
const bestCrude = () => (base.crudes || [base.crude]).reduce((a, c) => (parOf(base, c, L.deck).margin > parOf(base, a, L.deck).margin ? c : a));
function starsAll() { return LEVELS.reduce((n, l) => n + (progress()[l.id]?.stars || 0), 0); }
/** The level done, or done better: its stars, and the way on (the exam first). */
function finished(stars) {
  if ($("doneDlg").open || document.querySelector("dialog[open]:not(#doneDlg)")) return;
  const next = LEVELS[LEVELS.indexOf(base) + 1], body = $("doneBody");
  $("doneTitle").textContent = stars === 3 ? "At par" : "It runs";
  body.replaceChildren();
  const p = document.createElement("p"); p.className = "rf-done-stars"; p.textContent = "★".repeat(stars) + "☆".repeat(3 - stars); body.append(p);
  const q = document.createElement("p");
  q.textContent = `${money(R.margin)}/bbl against par ${money(target)}.${progress()[base.id]?.hinted && stars === 2 ? " A hint was used: two stars at most." : stars < 3 ? " Closer to par earns more stars." : ""}`;
  body.append(q);
  body.append(action("Take the exam", () => { $("doneDlg").close(); openTest(); }, "primary"));
  if (next) body.append(action(`Next: ${next.id} ${next.title}`, () => { $("doneDlg").close(); load(next.id); }));
  body.append(action("Keep working", () => $("doneDlg").close(), "link"));
  $("doneDlg").showModal();
}

// ---------- the flowsheet: pan, pinch, tap ----------
const svg = $("sheet"), pointers = new Map();
let gesture = null, lastTap = 0;
function drawPlant() {
  const flow = read(FLOW, true) && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lay = drawSheet(svg, L, R, { select: picked, flow });
  // room on the right for the zoom buttons, so they never sit on a product
  full = { x: -4, y: -4, w: lay.width + 8 + 40, h: lay.height + 8 };
  if (!view) view = { ...full };
  applyView();
}
function applyView() { svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`); }
const toSheet = (cx, cy) => { const b = svg.getBoundingClientRect(), k = Math.max(view.w / b.width, view.h / b.height); return [view.x + (cx - b.left - (b.width - view.w / k) / 2) * k, view.y + (cy - b.top - (b.height - view.h / k) / 2) * k]; };
function zoomAt(f, cx, cy) {
  const [px, py] = cx == null ? [view.x + view.w / 2, view.y + view.h / 2] : toSheet(cx, cy);
  const w = Math.min(full.w * 1.4, Math.max(full.w / 8, view.w * f)), k = w / view.w;
  view = { x: px - (px - view.x) * k, y: py - (py - view.y) * k, w, h: view.h * k };
  applyView();
}
svg.addEventListener("pointerdown", e => {
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  gesture = pts.length > 1 ? { kind: "pinch", d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), w: view.w } : { kind: "pan", from: pts[0], view: { ...view }, moved: false, target: e.target };
});
svg.addEventListener("pointermove", e => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (gesture.kind === "pinch" && pts.length >= 2) {
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    zoomAt((gesture.w * gesture.d) / Math.max(1, d) / view.w, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
    return;
  }
  if (Math.hypot(pts[0].x - gesture.from.x, pts[0].y - gesture.from.y) > 6) gesture.moved = true;
  if (!gesture.moved) return;
  const b = svg.getBoundingClientRect(), k = Math.max(view.w / b.width, view.h / b.height);
  view = { ...gesture.view, x: gesture.view.x - (pts[0].x - gesture.from.x) * k, y: gesture.view.y - (pts[0].y - gesture.from.y) * k };
  applyView();
});
const lift = e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (gesture && gesture.kind === "pan" && !gesture.moved && e.type === "pointerup") {
    const hit = hitTest(document.elementFromPoint(e.clientX, e.clientY) || gesture.target);
    if (hit?.stream) openSplit(hit.stream);
    else if (hit?.node) openCard(hit.node);
    else {
      // a double tap on the empty sheet zooms in there, twice as close
      const now = Date.now();
      if (now - lastTap < 350) { zoomAt(0.5, e.clientX, e.clientY); lastTap = 0; } else lastTap = now;
    }
  }
  if (!pointers.size) gesture = null;
};
svg.addEventListener("pointerup", lift);
svg.addEventListener("pointercancel", lift);
svg.addEventListener("wheel", e => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
$("zoomIn").addEventListener("click", () => zoomAt(1 / 1.5));
$("zoomOut").addEventListener("click", () => zoomAt(1.5));
$("zoomFit").addEventListener("click", () => { view = { ...full }; applyView(); });

// ---------- a stream: where it goes, in shares ----------
let splitFor = null;
/** The properties worth showing for a stream: those the pools it can reach are judged on, then its sulphur. */
function keyProps(s, props) {
  const ks = new Set();
  for (const d of destinations(L, s)) if (POOLS[d]) for (const k of specsOf(L, d)) if (!PROPS[k].flag) ks.add(k);
  if (props.s != null) ks.add("s");
  // where tickets are priced, what a barrel of it saves
  if (L.ticket && props.ghg > 0) ks.add("ghg");
  return [...ks].filter(k => props[k] != null);
}
function openSplit(s) {
  splitFor = s;
  picked = { stream: s };
  drawPlant();
  fillSplit(s);
  if (!$("splitDlg").open) $("splitDlg").showModal();
}
function fillSplit(s) {
  const st = STREAMS[s], run = R.streams[s], props = run?.props || ownProps(L, s);
  $("splitTitle").textContent = st.name;
  const meta = $("splitMeta");
  meta.replaceChildren();
  const what = document.createElement("span");
  what.textContent = `${run ? kbd(run.vol) : "not made now"}${st.about ? ` · ${st.about}` : ""} · ${keyProps(s, props).map(k => `${PROPS[k].name === "RON" || PROPS[k].name === "MON" ? PROPS[k].name : PROPS[k].name.toLowerCase()} ${fmtProp(k, props[k])}`).join(" · ")}`;
  const note = document.createElement("small"); note.textContent = st.note;
  meta.append(what, note);
  if (base.values && par.values?.[s] != null) { const v = document.createElement("small"); v.className = "rf-value"; v.textContent = `At par, one more barrel of it is worth $${par.values[s].toFixed(2)} to this plant: its marginal value.`; meta.append(v); }
  // the split as a bar, then a row a destination
  const shares = routing[s] || {}, dests = destinations(L, s), now = R.margin;
  $("splitBar").replaceChildren(...dests.filter(d => shares[d] > 1e-4).map(d => {
    const i = document.createElement("i"); i.style.flex = String(shares[d]);
    i.style.background = UNITS[d] ? "var(--rf-in)" : GROUP_COLOUR[POOLS[d].group] || "var(--rf-gas)";
    i.title = `${(UNITS[d] || POOLS[d]).short} ${Math.round(shares[d] * 100)}%`;
    i.textContent = shares[d] > 0.12 ? (UNITS[d] || POOLS[d]).short : "";
    return i;
  }));
  const rows = $("splitRows");
  rows.replaceChildren(...dests.map(d => {
    const row = document.createElement("div"), f = shares[d] || 0;
    row.className = `rf-split-row${f > 1e-4 ? " on" : ""}`;
    const name = document.createElement("div"); name.className = "rf-split-name";
    const b = document.createElement("b"); b.textContent = UNITS[d] ? UNITS[d].name : `${POOLS[d].name} · $${d === "notBought" ? refundOf(L, s) : priceOf(L, d)}`;
    const why = document.createElement("small");
    why.textContent = UNITS[d] ? UNITS[d].purpose : POOLS[d].note;
    name.append(b, why);
    // what sending it all here would do, with everything else as it is
    const all = { ...routing, [s]: { [d]: 1 } }, m = f > 0.999 ? now : evaluate(L, all).margin;
    const delta = document.createElement("em");
    delta.className = `rf-delta${m - now > 0.005 ? " up" : m - now < -0.005 ? " down" : ""}`;
    delta.textContent = f > 0.999 ? "all here" : `all: ${m - now >= 0 ? "+" : "−"}${Math.abs(m - now).toFixed(2)}`;
    const ctl = document.createElement("div"); ctl.className = "rf-split-ctl";
    const range = document.createElement("input");
    range.type = "range"; range.min = "0"; range.max = "100"; range.step = "1"; range.value = String(Math.round(f * 100));
    range.setAttribute("aria-label", `Share to ${(UNITS[d] || POOLS[d]).name}`);
    const pctBox = document.createElement("input");
    pctBox.type = "text"; pctBox.inputMode = "decimal"; pctBox.className = "rf-pct"; pctBox.value = `${+(f * 100).toFixed(f * 100 % 1 ? 1 : 0)}`;
    pctBox.setAttribute("aria-label", `Per cent to ${(UNITS[d] || POOLS[d]).name}`);
    const unit = document.createElement("span"); unit.textContent = "%";
    let first = true;
    range.addEventListener("input", () => { setShares(s, setShare(s, d, +range.value / 100), { remember: first }); first = false; });
    range.addEventListener("change", () => { first = true; });
    pctBox.addEventListener("change", () => { const v = Math.max(0, Math.min(100, parseFloat(pctBox.value.replace(",", ".")) || 0)); setShares(s, setShare(s, d, v / 100)); });
    const allBtn = document.createElement("button"); allBtn.type = "button"; allBtn.className = "rf-all"; allBtn.textContent = "All";
    allBtn.addEventListener("click", () => setShares(s, { [d]: 1 }));
    ctl.append(range, pctBox, unit, allBtn);
    row.append(name, delta, ctl);
    return row;
  }));
  const m = $("splitMargin");
  m.textContent = `Margin ${money(R.margin)}/bbl · par ${money(target)}`;
}

// ---------- cards: a unit, a product, the crude ----------
function openCard(id) {
  picked = { node: id };
  drawPlant();
  const body = $("cardBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.append(n); return n; };
  const table = (rows, head) => {
    const t = add("table", "rf-table");
    if (head) { const tr = document.createElement("tr"); tr.innerHTML = head.map(h => `<th>${h}</th>`).join(""); t.append(tr); }
    for (const r of rows) { const tr = document.createElement("tr"); for (const c of r) { const td = document.createElement("td"); if (c instanceof Node) td.append(c); else td.textContent = c; tr.append(td); } t.append(tr); }
    return t;
  };
  const streamLink = (s, text) => { const b = document.createElement("button"); b.type = "button"; b.className = "rf-inline"; b.textContent = text || STREAMS[s].name; b.addEventListener("click", () => { $("cardDlg").close(); openSplit(s); }); return b; };
  if (id === "crude" || id === "cdu") {
    const c = CRUDES[L.crude];
    $("cardTitle").textContent = id === "cdu" ? `${UNITS.cdu.name} (CDU)` : `Crude: ${c.name}`;
    add("p", "rf-purpose", id === "cdu" ? UNITS.cdu.purpose : c.note);
    add("p", "rf-facts", `${c.name}: API ${c.api}, ${c.sulphur}% sulphur, $${c.price}/bbl delivered, ${L.feed ?? FEED} kb/d.`);
    add("h3", null, "The cuts");
    table(Object.entries(c.cuts).map(([s, f]) => [streamLink(s), STREAMS[s].about || "", `${(f * 100).toFixed(1)}%`, kbd((L.feed ?? FEED) * f), R.streams[s]?.props?.s != null ? fmtProp("s", R.streams[s].props.s) : ""]), ["Cut", "Boils", "Yield", "Flow", "Sulphur"]);
    if (id === "cdu") { for (const t of UNITS.cdu.card) add("p", null, t); add("h3", null, "Operating"); table(UNITS.cdu.facts); }
  } else if (id === "bought") {
    $("cardTitle").textContent = "Bought in";
    table(Object.entries(L.bought || {}).map(([s, v]) => [streamLink(s), kbd(v), `$${L.prices?.[s] ?? BOUGHT[s] ?? 0}/bbl`]), ["Stream", "Volume", "Price"]);
  } else if (UNITS[id]) {
    const u = UNITS[id], run = R.units[id], cap = L.caps?.[id];
    $("cardTitle").textContent = `${u.name} (${u.short})`;
    add("p", "rf-purpose", u.purpose);
    // where a level teaches them, what more of its capacity would earn at par, in the capacity's own unit (the
    // plan's duals are thousand dollars a day per kb/d, MMscf/d or t/d)
    const v = base.values ? par.capacity?.[id] : null;
    const shadow = () => v != null && add("p", "rf-value", `At par, ${id === "smr" ? "a million scf a day" : id === "sru" ? "a tonne a day" : "a thousand barrels a day"} more of its capacity would earn ${id === "sru" ? `$${Math.round(Math.max(0, v) * 1000)} a tonne` : `$${Math.max(0, v).toFixed(2)} ${id === "smr" ? "per thousand scf" : "a barrel"}`}: its shadow price${v < 0.005 ? ", nothing, as the plan doesn't fill it" : ""}.`);
    if (id === "smr") { add("p", "rf-facts", `Making ${R.h2.plant.toFixed(1)} of the ${R.h2.used.toFixed(1)} MMscf/d of hydrogen used; the reformer makes ${R.h2.made.toFixed(1)}.${cap != null ? ` Capacity ${cap} MMscf/d.` : ""}`); shadow(); }
    else if (id === "sru") { add("p", "rf-facts", `Recovering ${R.sulphur.removed.toFixed(1)} t/d of sulphur${cap != null ? ` of a capacity of ${cap}` : ""}, sold at $${SULPHUR.price}/t.`); shadow(); }
    else if (run) {
      add("p", "rf-facts", `Running at ${kbd(run.feed)}${cap ? ` of ${cap} (${Math.round((run.feed / cap) * 100)}%)` : ""}.${run.h2 ? ` Hydrogen: ${run.h2 > 0 ? "makes" : "uses"} ${Math.abs(run.h2).toFixed(1)} MMscf/d.` : ""}${run.sRemoved > 0.05 ? ` Strips ${run.sRemoved.toFixed(1)} t/d of sulphur.` : ""}`);
      // a co-processed renewable feed against its limit
      for (const [f, lim] of Object.entries(coLimits(L, id))) if (run.feeds[f]) add("p", "rf-facts", `Co-processing: ${STREAMS[f].name.toLowerCase()} is ${Math.round((run.feeds[f] / run.feed) * 100)}% of its feed, of ${Math.round(lim * 100)}% at most${run.coOver?.[f] ? `; ${kbd(run.coOver[f])} more went elsewhere` : ""}.`);
      shadow();
      add("h3", null, "Now");
      table([...Object.entries(run.feeds).map(([s, v]) => ["in", streamLink(s), kbd(v)]), ...Object.entries(run.outputs).map(([s, v]) => ["out", streamLink(s), kbd(v)])]);
    } else add("p", "rf-facts", `Idle: nothing is sent to it.${cap ? ` Capacity ${cap} kb/d.` : ""}`);
    for (const t of u.card) add("p", null, t);
    if (u.facts) { add("h3", null, "Operating"); table(u.facts); }
    if (u.yields && id !== "vdu") {
      add("h3", null, "Yields, by volume of feed");
      const feeds = Object.keys(u.yields), outs = [...new Set(feeds.flatMap(f => Object.keys(u.yields[f])))];
      table(outs.map(o => [STREAMS[o].name, ...feeds.map(f => (u.yields[f][o] != null ? `${Math.round(u.yields[f][o] * 100)}%` : "–"))]), ["", ...feeds.map(f => STREAMS[f].short)]);
    }
    if (id === "vdu") add("p", "rf-facts", `It lifts ${Math.round(CRUDES[L.crude].vgoShare * 100)}% of ${CRUDES[L.crude].name}'s residue as gas oil, four parts light to six heavy.`);
    const h = Object.entries(u.h2 || {}).filter(([, v]) => v);
    if (h.length) add("p", "rf-facts", `Hydrogen: ${h.map(([f, v]) => `${STREAMS[f].short} ${v > 0 ? "makes" : "uses"} ${Math.abs(v * 1000)} scf/bbl`).join("; ")}. Hydrogen from the plant costs $${H2_PRICE} per thousand scf.`);
    if (u.opex) add("p", "rf-facts", `Running cost about $${u.opex}/bbl of feed.`);
  } else if (POOLS[id]) {
    const def = POOLS[id], pool = R.pools[id];
    $("cardTitle").textContent = def.name;
    add("p", "rf-purpose", def.note);
    add("p", "rf-facts", pool ? `${kbd(pool.vol)} at $${+pool.price.toFixed(2)}/bbl${pool.soldAs !== id ? `: off spec, so sold as ${POOLS[pool.soldAs].name.toLowerCase()}` : ""}.${pool.over ? ` The market takes ${L.markets[id]} kb/d.` : ""}` : `Nothing goes here now. $${priceOf(L, id)}/bbl.`);
    // its tickets: the renewable part's saving at the quota price, a quarter more for aviation fuel's premium
    if (L.ticket && def.tickets) add("p", "rf-value", pool?.tickets ? `Its renewable part saves ${pool.saved.toFixed(0)} t of CO₂e a day against fossil fuel: tickets worth $${pool.tickets.toFixed(1)} thousand a day at $${L.ticket} a tonne${def.tickets !== 1 ? `, and ${Math.round((def.tickets - 1) * 100)}% more for sustainable aviation fuel's premium` : ""}.` : `Renewable blendstocks here earn a ticket on what they save, at $${L.ticket} a tonne of CO₂e.`);
    const judged = specsOf(L, id);
    if (def.spec) {
      add("h3", null, "Its specification, as judged here");
      table(Object.entries(def.spec).map(([k, [lo, hi]]) => {
        const on = judged.includes(k), v = pool?.props?.[k], [jlo, jhi] = on ? limitOf(L, id, k) : [lo, hi];
        const ok = pool && on ? !pool.fails.some(f => f.k === k) : null;
        const lim = PROPS[k].flag ? "required" : [jlo != null ? `≥ ${fmtProp(k, jlo)}` : "", jhi != null ? `≤ ${fmtProp(k, jhi)}` : ""].filter(Boolean).join(", ");
        const mark = document.createElement("b"); mark.className = ok == null ? "rf-muted" : ok ? "rf-ok" : "rf-no"; mark.textContent = !on ? "not judged here" : ok == null ? "–" : ok ? "✓" : "✗";
        return [PROPS[k].name, lim, v == null ? "–" : fmtProp(k, v), mark];
      }), ["", "Limit", "Blend", ""]);
    }
    if (pool) {
      add("h3", null, "What's in it");
      table(Object.entries(pool.parts).sort((a, b) => b[1] - a[1]).map(([s, v]) => [streamLink(s), kbd(v), `${Math.round((v / pool.vol) * 100)}%`]));
    }
    if (def.sheet?.length) { add("h3", null, "The published specification"); table(def.sheet); }
  }
  if (!$("cardDlg").open) $("cardDlg").showModal();
}

// ---------- hints ----------
/** The single change worth most from here: a share of one stream moved, judged by running the plant. */
function bestMove() {
  const now = R.margin, ok = runs(R);
  let best = null;
  for (const s of streamsOf(L)) {
    if (!R.streams[s]) continue;
    for (const d of destinations(L, s)) for (const f of [1, 0.5, 0.25, 0.1, 0.05]) {
      const cur = routing[s]?.[d] || 0;
      if (cur >= 1 - 1e-9) break;
      const next = setShare(s, d, Math.min(1, cur + f)), r = evaluate(L, { ...routing, [s]: next });
      const good = runs(r) || !ok;
      if (good && r.margin > now + 0.02 && (!best || r.margin > best.m)) best = { s, d, f: Math.min(1, cur + f), next, m: r.margin };
    }
  }
  return best;
}
function hint() {
  const p = progress(), was = p[base.id] || {};
  p[base.id] = { ...was, hinted: true, hints: (was.hints || 0) + 1 };
  write(PROGRESS, p);
  const box = $("hint");
  box.hidden = false;
  box.replaceChildren();
  if ((was.hints || 0) >= 3) { showPar(); return; }
  const mv = bestMove();
  if (!mv) {
    const diff = streamsOf(L).find(s => R.streams[s] && Object.keys(par.routing[s] || {}).some(d => Math.abs((par.routing[s][d] || 0) - (routing[s]?.[d] || 0)) > 0.05));
    box.textContent = diff ? `No single change helps from here: several streams have to move together. Start with ${STREAMS[diff].name.toLowerCase()}: par sends ${Object.entries(par.routing[diff]).map(([d, f]) => `${Math.round(f * 100)}% to ${(UNITS[d] || POOLS[d]).name.toLowerCase()}`).join(", ")}.`
      : "You're on par's plan, or as near it as matters.";
    return;
  }
  const name = d => (UNITS[d] || POOLS[d]).name.toLowerCase();
  box.append(`${mv.f >= 0.999 ? `All the ${STREAMS[mv.s].name.toLowerCase()}` : `${Math.round(mv.f * 100)}% of the ${STREAMS[mv.s].name.toLowerCase()}`} to the ${name(mv.d)}: ${money(mv.m - R.margin)}/bbl better. `);
  const go = document.createElement("button"); go.type = "button"; go.className = "rf-link"; go.textContent = "Do it";
  go.addEventListener("click", () => { box.hidden = true; setShares(mv.s, mv.next); });
  box.append(go);
  renderBrief();
}
/** Par's plan, stream by stream, where yours differs; taking it caps the level at one star. */
function showPar() {
  const body = $("cardBody");
  body.replaceChildren();
  $("cardTitle").textContent = "Par's plan";
  const p = document.createElement("p"); p.className = "rf-facts";
  p.textContent = `What the LP does with ${CRUDES[L.crude].name}, for ${money(par.margin)}/bbl. Where yours differs, it's marked.`;
  body.append(p);
  const t = document.createElement("table"); t.className = "rf-table";
  const fmt = r => Object.entries(r || {}).filter(([, f]) => f > 0.0005).map(([d, f]) => `${(UNITS[d] || POOLS[d]).short} ${Math.round(f * 100)}%`).join(", ");
  for (const s of streamsOf(L)) {
    if (!par.routing[s] || !(R.streams[s] || parRun().streams[s])) continue;
    const mine = fmt(routing[s]), theirs = fmt(par.routing[s]), tr = document.createElement("tr");
    tr.className = mine !== theirs ? "rf-differs" : "";
    tr.innerHTML = "<td></td><td></td><td></td>";
    tr.children[0].textContent = STREAMS[s].name; tr.children[1].textContent = theirs; tr.children[2].textContent = mine !== theirs ? `you: ${mine}` : "";
    t.append(tr);
  }
  body.append(t);
  body.append(action("Take par's plan", () => {
    const all = progress(); all[base.id] = { ...(all[base.id] || {}), shown: true }; write(PROGRESS, all);
    history.push(JSON.stringify(routing));
    routing = normalise(L, par.routing); keep(); $("cardDlg").close(); render();
  }, "primary"));
  if (!$("cardDlg").open) $("cardDlg").showModal();
}
let parRunCache = null;
function parRun() { if (parRunCache?.k !== base.id + L.crude) parRunCache = { k: base.id + L.crude, r: evaluate(L, par.routing) }; return parRunCache.r; }

// ---------- the lesson ----------
let lesson = null;
function openLesson(at = 0) {
  lesson?.player?.stop();
  const steps = lessonFor(base);
  lesson = { steps, at: Math.max(0, Math.min(at, steps.length - 1)), player: null };
  $("lessonTitle").textContent = `${base.id} ${base.title}`;
  const all = progress(); all[base.id] = { ...(all[base.id] || {}), seen: true }; write(PROGRESS, all);
  if (!$("lessonDlg").open) $("lessonDlg").showModal();
  showStep();
}
function showStep() {
  const { steps, at } = lesson, st = steps[at], last = steps.length - 1;
  lesson.player?.stop();
  $("lessonDots").replaceChildren(...steps.map((x, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `rf-dot${i === at ? " on" : i < at ? " done" : ""}${x.task ? " task" : ""}`;
    b.setAttribute("aria-label", x.task ? "The task" : `Step ${i + 1}`);
    b.addEventListener("click", () => { lesson.at = i; showStep(); });
    return b;
  }));
  const ch = CHAPTERS.find(c => c.id === base.chapter);
  $("lessonCount").textContent = st.task ? "Your task" : `${ch.title} · ${at + 1} of ${last}`;
  const say = $("lessonSay"), p = (text, cls) => { const e = document.createElement("p"); if (cls) e.className = cls; e.textContent = text; say.append(e); return e; };
  say.replaceChildren();
  if (at === 0 && LEVELS.find(l => l.chapter === base.chapter) === base) p(`Chapter ${ch.id}: ${ch.about}`, "rf-ch-intro");
  if (st.task) {
    const t = p("", "rf-task-say"), tag = document.createElement("span");
    tag.className = "rf-tag"; tag.textContent = "Your task"; t.append(tag, " ", st.say);
    if (st.watch?.length) {
      p("Watch out for", "rf-watch-head");
      const ul = document.createElement("ul"); ul.className = "rf-watch";
      for (const w of st.watch) { const li = document.createElement("li"); li.textContent = w; ul.append(li); }
      say.append(ul);
    }
    const how = document.createElement("details"), sum = document.createElement("summary");
    how.className = "rf-how"; sum.textContent = "How to play"; how.append(sum);
    const hp = document.createElement("p");
    hp.textContent = "Tap an arrow on the flowsheet to choose where that stream goes: each destination takes a share, set with its slider or typed, and All sends the whole stream there. Each row says what sending all of it there would do to the margin. Tap a unit for its card and what it's running, a product for its specification, the crude for its assay. Drag to move the flowsheet, pinch or + and − to zoom. Hint finds the change worth most; it caps the stars at two.";
    how.append(hp); say.append(how);
    p(progress()[base.id]?.stars ? "Done already: the exam is in the brief." : "Once the plant runs with every product in spec, the exam asks about what you made and what this lesson taught.", "rf-after");
  } else p(st.say);
  say.scrollTop = 0;
  $("lessonBack").disabled = at === 0;
  $("lessonNext").textContent = st.task ? "Start" : at === last - 1 ? "The task" : "Next";
  lesson.player = playScene($("lessonScene"), st.scene, L);
}
function stepLesson(d) {
  if (!lesson) return;
  const to = lesson.at + d;
  if (to > lesson.steps.length - 1) { $("lessonDlg").close(); return; }
  if (to < 0) return;
  lesson.at = to;
  showStep();
}
function openGlossary() {
  const body = $("glossBody"); body.replaceChildren();
  for (const [term, def] of [...GLOSSARY].sort((a, b) => a[0].localeCompare(b[0]))) { const p = document.createElement("p"), b = document.createElement("b"); b.textContent = term; p.append(b, " ", def); body.append(p); }
  $("glossDlg").showModal();
}

// ---------- the exam ----------
let test = null;
function openTest() {
  // on your plant if it runs, else on par's
  const res = runs(R) ? R : evaluate(L, par.routing);
  test = { qs: buildTest(L, res, { seed: Date.now() >>> 0 }), at: 0, given: [], right: [], player: null, built: [] };
  $("testTitle").textContent = `${base.id} ${base.title}`;
  if (!$("testDlg").open) $("testDlg").showModal();
  showQuestion();
}
function testDots() {
  $("testDots").replaceChildren(...test.qs.map((q, i) => { const d = document.createElement("span"); d.className = `rf-dot${i === test.at ? " on" : ""}${test.right[i] === true ? " ok" : test.right[i] === false ? " bad" : ""}`; return d; }));
}
function showQuestion() {
  const q = test.qs[test.at], box = $("testAnswer");
  testDots();
  $("testCount").textContent = `Exam · ${test.at + 1} of ${test.qs.length}`;
  $("testAsk").textContent = q.ask;
  $("testSays").replaceChildren();
  box.replaceChildren();
  test.built = [];
  if (q.kind === "choice") q.options.forEach((o, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "rf-option"; b.textContent = o; b.addEventListener("click", () => answerWith(i)); box.append(b); });
  else if (q.kind === "number" || q.kind === "word") {
    const row = document.createElement("label"), input = document.createElement("input");
    row.className = "rf-entry"; input.id = "testInput"; input.autocomplete = "off"; input.spellcheck = false; input.setAttribute("enterkeyhint", "done"); input.setAttribute("autocapitalize", "none");
    if (q.kind === "number") { input.inputMode = "decimal"; input.placeholder = "0"; } else input.placeholder = "a word";
    input.addEventListener("input", () => { $("testNext").disabled = !input.value.trim(); });
    row.append(input);
    if (q.unit) { const u = document.createElement("span"); u.textContent = q.unit; row.append(u); }
    box.append(row);
  } else if (q.kind === "tap") { const p = document.createElement("p"); p.className = "rf-tap-hint"; p.textContent = "Tap it on the flowsheet."; box.append(p); }
  else if (q.kind === "order") { const built = document.createElement("div"), pool = document.createElement("div"); built.className = "rf-order rf-order-built"; pool.className = "rf-order rf-order-pool"; built.id = "testBuilt"; pool.id = "testPool"; box.append(built, pool); drawOrder(); }
  const next = $("testNext");
  next.textContent = q.kind === "choice" || q.kind === "tap" ? "Next" : "Check";
  next.disabled = true;
  $("testAlt").hidden = true;
  test.player?.stop();
  $("testScene").toggleAttribute("hidden", !q.scene);
  if (q.scene) test.player = playScene($("testScene"), q.scene, L);
  $("testBody").scrollTop = 0;
  if (q.kind === "number" || q.kind === "word") $("testInput").focus({ preventScroll: true });
}
function drawOrder() {
  const q = test.qs[test.at], done = test.at < test.right.length;
  const chip = (name, onTap) => { const b = document.createElement("button"); b.type = "button"; b.className = "rf-order-chip"; b.textContent = name; b.disabled = done; b.addEventListener("click", onTap); return b; };
  $("testBuilt").replaceChildren(...test.built.map((name, i) => chip(`${i + 1}. ${name}`, () => { test.built.splice(i, 1); drawOrder(); })));
  $("testPool").replaceChildren(...q.options.filter(n => !test.built.includes(n)).map(n => chip(n, () => { test.built.push(n); drawOrder(); })));
  if (!done) $("testNext").disabled = test.built.length !== q.items.length;
}
function answerWith(given) {
  const q = test.qs[test.at];
  if (test.at < test.right.length) return;
  const right = isRight(q, given);
  test.given.push(given); test.right.push(right);
  if (q.kind === "choice") [...$("testAnswer").children].forEach((b, i) => { b.disabled = true; b.classList.toggle("ok", i === q.answer); b.classList.toggle("bad", i === given && !right); });
  if (q.kind === "tap") test.player?.mark?.(q.answer[0], given, right);
  if (q.kind === "number" || q.kind === "word") { const input = $("testInput"); input.disabled = true; input.classList.add(right ? "ok" : "bad"); }
  if (q.kind === "order") drawOrder();
  const says = $("testSays"), verdict = document.createElement("b");
  verdict.className = right ? "ok" : "bad";
  verdict.textContent = right ? "Right." : q.kind === "tap" ? missedTap(q, given) : `Not quite: ${rightAnswer(q)}.`;
  says.replaceChildren(verdict, ...(q.explain ? [" ", q.explain] : []));
  testDots();
  const next = $("testNext");
  next.textContent = test.at === test.qs.length - 1 ? "See how you did" : "Next";
  next.disabled = false;
  says.scrollIntoView({ block: "nearest" });
}
function testOn() {
  const q = test.qs[test.at];
  if (test.at >= test.qs.length) return testAfter();
  if (test.at === test.right.length) {
    if (q.kind === "number" || q.kind === "word") { const v = $("testInput").value; if (v.trim()) answerWith(v); }
    else if (q.kind === "order" && test.built.length === q.items.length) answerWith([...test.built]);
    return;
  }
  test.at++;
  if (test.at < test.qs.length) showQuestion(); else showScore();
}
function showScore() {
  test.player?.stop();
  const n = test.qs.length, right = test.right.filter(Boolean).length, passed = right >= passMark(n);
  const all = progress(), was = all[base.id]?.test;
  all[base.id] = { ...(all[base.id] || {}), test: { right: Math.max(right, was?.right || 0), of: n, passed: passed || !!was?.passed } };
  write(PROGRESS, all);
  testDots();
  $("testCount").textContent = "How you did";
  $("testScene").toggleAttribute("hidden", true);
  $("testAsk").textContent = `${right} of ${n} right`;
  const box = $("testAnswer"); box.replaceChildren();
  const verdict = document.createElement("p"); verdict.className = `rf-score ${passed ? "ok" : "bad"}`;
  verdict.textContent = passed ? (right === n ? "Every one: passed." : "Passed.") : `Not yet: ${passMark(n)} of ${n} pass. The questions change each time.`;
  box.append(verdict);
  const missed = test.qs.filter((q, i) => !test.right[i]);
  if (missed.length) {
    const h = document.createElement("p"); h.className = "rf-watch-head"; h.textContent = "To look at again"; box.append(h);
    const ul = document.createElement("ul"); ul.className = "rf-missed";
    for (const q of missed) { const li = document.createElement("li"), b = document.createElement("b"), ans = rightAnswer(q); b.textContent = ans; li.append(q.ask); if (!q.ask.toLowerCase().includes(ans.toLowerCase())) li.append(" ", b); ul.append(li); }
    box.append(ul);
  }
  $("testSays").replaceChildren();
  const next = LEVELS[LEVELS.indexOf(base) + 1];
  $("testNext").textContent = next ? `Next: ${next.id} ${next.title}` : "Close";
  $("testNext").disabled = false;
  $("testAlt").hidden = false;
  test.at = n;
  renderBrief();
}
function testAfter() { const next = LEVELS[LEVELS.indexOf(base) + 1]; $("testDlg").close(); if (next) load(next.id); }

// ---------- the course ----------
function openCourse() {
  const body = $("courseBody"), all = progress();
  body.replaceChildren();
  const done = LEVELS.filter(l => all[l.id]?.stars).length, stars = starsAll(), passed = LEVELS.filter(l => all[l.id]?.test?.passed).length;
  const head = document.createElement("div"); head.className = "rf-course-head";
  const l1 = document.createElement("p"); l1.className = "rf-course-line";
  l1.textContent = `${done} of ${LEVELS.length} levels done · ${stars} of ${LEVELS.length * 3} stars${passed ? ` · ${passed} exam${passed === 1 ? "" : "s"} passed` : ""}`;
  const bar = document.createElement("div"), fill = document.createElement("i"); bar.className = "rf-course-bar"; fill.style.width = `${(100 * done) / LEVELS.length}%`; bar.append(fill);
  head.append(l1, bar);
  const next = LEVELS.find(l => !all[l.id]?.stars);
  if (next && next !== base) { const go = document.createElement("button"); go.type = "button"; go.className = "btn primary rf-continue"; go.textContent = `Continue: ${next.id} ${next.title}`; go.addEventListener("click", () => { $("courseDlg").close(); load(next.id); }); head.append(go); }
  body.append(head);
  for (const ch of CHAPTERS) {
    const levels = LEVELS.filter(l => l.chapter === ch.id);
    if (!levels.length) continue;
    const got = levels.filter(l => all[l.id]?.stars).length, st = levels.reduce((n, l) => n + (all[l.id]?.stars || 0), 0);
    const det = document.createElement("details"), sum = document.createElement("summary");
    det.className = `rf-ch${got === levels.length ? " all" : ""}`;
    sum.innerHTML = `<span class="rf-ch-num"></span><span class="rf-ch-title"></span><span class="rf-ch-prog"></span>`;
    sum.children[0].textContent = ch.id; sum.children[1].textContent = ch.title; sum.children[2].textContent = `${got}/${levels.length}${st ? ` · ★${st}` : ""}`;
    det.append(sum);
    const about = document.createElement("p"); about.className = "rf-ch-about"; about.textContent = ch.about; det.append(about);
    for (const lv of levels) {
      const p = all[lv.id] || {}, b = document.createElement("button");
      b.type = "button"; b.className = `rf-level${lv.id === base.id ? " here" : ""}${p.stars ? " done" : ""}`;
      const words = document.createElement("span"), t = document.createElement("b"), teach = document.createElement("small"), state = document.createElement("span");
      words.className = "rf-level-words"; t.textContent = `${lv.id} ${lv.title}`; teach.textContent = TEACHES[lv.id] || ""; words.append(t, teach);
      state.className = "rf-level-state";
      state.textContent = p.stars ? "★".repeat(p.stars) + "☆".repeat(3 - p.stars) : lv.id === base.id ? "Here" : p.seen ? "Seen" : "";
      if (p.test) { const e = document.createElement("small"); e.className = `rf-level-test${p.test.passed ? " ok" : ""}`; e.textContent = p.test.passed ? "Exam ✓" : `Exam ${p.test.right}/${p.test.of}`; state.append(e); }
      b.append(words, state);
      b.addEventListener("click", () => { $("courseDlg").close(); if (lv.id !== base.id) load(lv.id); });
      det.append(b);
    }
    det.open = ch.id === base.chapter;
    body.append(det);
  }
  $("courseDlg").showModal();
  body.querySelector(".rf-level.here")?.scrollIntoView({ block: "center" });
}

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {
    duel.menu(part(body, "together"));
    part(body, "content").append(mirror("Level", $("level")));
    $("menuDlg").showModal();
    return;
  }
  part(body, "play").append(action("Start this level again", () => { $("menuDlg").close(); load(base.id, true); }, "primary"),
    action("Lesson", () => { $("menuDlg").close(); openLesson(); }), action("Glossary", () => { $("menuDlg").close(); openGlossary(); }));
  if (progress()[base.id]?.stars) part(body, "play").append(action("Exam", () => { $("menuDlg").close(); openTest(); }));
  part(body, "settings").append(toggle("Flowing arrows", read(FLOW, true), on => { write(FLOW, on); drawPlant(); }));
  part(body, "about").append(action("Show par's plan", () => { $("menuDlg").close(); showPar(); }, "link"),
    line(`${LEVELS.filter(l => progress()[l.id]?.stars).length} of ${LEVELS.length} levels done. Yields, properties and prices are textbook-typical, at a North-West Europe deck with Brent at $75.`));
  $("menuDlg").showModal();
}
function toast(t, ms = 3200) { const e = $("toast"); e.textContent = t; e.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => e.classList.remove("show"), ms); }

// ---------- together: the same level for everyone at the table (duel.js) ----------
// Everyone gets the match's level, the same crude (or choice of crudes), units and prices, from the same starting
// routing; par shows as ever, hints don't. Submit is your answer, once: the highest margin wins, then the quicker. Your
// own routings, stars and exams stay as they were.
const duel = createDuel({
  game: "refinery", name: "Refinery", accent: "--rf-in", line: $("rival"), toast,
  deal: () => ({ seed: Math.floor(Math.random() * 2 ** 31), level: $("level").value || base?.id || LEVELS[0].id }),
  describe: m => { const lv = LEVELS.find(l => l.id === String(m.level)) || LEVELS[0]; return `Level ${lv.id}, ${lv.title}: the same plant for everyone, submitted once`; },
  play: (match, { kept }) => {
    const lv = LEVELS.find(l => l.id === String(match.level)) || LEVELS[0];
    base = lv;
    D = kept?.level === lv.id && kept.routing ? kept : { level: lv.id, crude: lv.crude, routing: null, done: false, margin: null };
    L = played(lv, lv.crudes?.includes(D.crude) ? D.crude : lv.crude, D.deck);
    routing = D.routing = normalise(L, D.routing || defaultRouting(L));
    par = parOf(lv, L.crude, L.deck); target = targetOf(lv, L.deck); history = []; view = null; picked = null;
    $("level").value = lv.id;
    keep(); render(); tell();
  },
  onLobby: match => { D = null; const lv = LEVELS.find(l => l.id === String(match.level)) || LEVELS[0]; base = lv; L = played(lv, lv.crude); routing = normalise(L, defaultRouting(L)); par = parOf(lv, lv.crude, L.deck); target = targetOf(lv, L.deck); render(); $("verdict").textContent = "The same plant for everyone."; },
  onLeave: () => { D = null; load(read(AT, LEVELS[0].id)); },
});
function duelVerdict(off, gap) {
  const v = $("verdict");
  v.className = "rf-verdict";
  v.textContent = D.done ? `Submitted at ${money(D.margin)}/bbl.` : off.length ? `${off.map(([id]) => POOLS[id].name).join(" and ")} off spec.` : gap <= 0.1 ? "At par." : `${money(gap)}/bbl short of par.`;
  $("nextBtn").hidden = false;
  $("nextBtn").textContent = D.done ? "Submitted ✓" : "Submit";
  $("nextBtn").disabled = !!D.done;
  $("nextBtn").onclick = submit;
  $("issue").hidden = true;
}
function submit() {
  if (!D || D.done) return;
  if (!confirm(`Submit at ${money(R.margin)}/bbl? It's your answer for the match: you can't change it after.`)) return;
  D.done = true; D.margin = R.margin;
  keep(); tell(); render();
}
function tell() { if (D) duel.report(D.done ? { score: Math.round(D.margin * 100) / 100, text: `${money(D.margin)}/bbl`, done: true } : { score: -1e6, text: "planning" }); }

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "refinery");
document.querySelector(".rf-mark").innerHTML = APPS.find(a => a.id === "refinery").logo;
for (const lv of LEVELS) { const o = document.createElement("option"); o.value = lv.id; o.textContent = `${lv.id} ${lv.title}`; $("level").append(o); }
$("level").addEventListener("change", e => load(e.target.value));
$("task").addEventListener("click", () => $("task").classList.toggle("open"));
$("lessonBtn").addEventListener("click", () => openLesson());
$("hintBtn").addEventListener("click", hint);
$("testBtn").addEventListener("click", openTest);
$("undoBtn").addEventListener("click", undo);
$("courseBtn").addEventListener("click", openCourse);
$("menuBtn").addEventListener("click", openMenu);
for (const [btn, dlg] of [["splitClose", "splitDlg"], ["cardClose", "cardDlg"], ["lessonClose", "lessonDlg"], ["testClose", "testDlg"], ["courseClose", "courseDlg"], ["glossClose", "glossDlg"], ["doneClose", "doneDlg"], ["menuClose", "menuDlg"]]) $(btn).addEventListener("click", () => $(dlg).close());
for (const id of ["splitDlg", "cardDlg"]) $(id).addEventListener("close", () => { splitFor = null; picked = null; drawPlant(); });
$("lessonNext").addEventListener("click", () => stepLesson(1));
$("lessonBack").addEventListener("click", () => stepLesson(-1));
$("lessonDlg").addEventListener("close", () => { lesson?.player?.stop(); lesson = null; });
$("lessonDlg").addEventListener("keydown", e => { if (e.key === "ArrowRight") { e.preventDefault(); stepLesson(1); } else if (e.key === "ArrowLeft") { e.preventDefault(); stepLesson(-1); } });
{ // a swipe across the lesson's picture steps on or back
  let from = null;
  $("lessonScene").addEventListener("pointerdown", e => { from = { x: e.clientX, y: e.clientY }; });
  $("lessonScene").addEventListener("pointerup", e => { if (!from) return; const dx = e.clientX - from.x, dy = e.clientY - from.y; from = null; if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) stepLesson(dx < 0 ? 1 : -1); });
}
$("testNext").addEventListener("click", testOn);
$("testAlt").addEventListener("click", openTest);
$("testDlg").addEventListener("close", () => { test?.player?.stop(); test = null; });
$("testDlg").addEventListener("keydown", e => {
  if (!test) return;
  const q = test.qs[test.at];
  if (e.key === "Enter" && !$("testNext").disabled) { e.preventDefault(); testOn(); }
  else if (q?.kind === "choice" && /^[1-9]$/.test(e.key) && e.target.tagName !== "INPUT") { const i = +e.key - 1; if (i < q.options.length) answerWith(i); }
});
// a tap on the exam's flowsheet answers a tap question: the unit or stream under the finger
$("testScene").addEventListener("pointerup", e => {
  const q = test?.qs[test.at];
  if (q?.kind !== "tap" || test.at < test.right.length) return;
  const hit = hitTest(document.elementFromPoint(e.clientX, e.clientY));
  const id = hit?.node || (hit?.stream && `stream:${hit.stream}`);
  if (id) answerWith(id);
});
document.addEventListener("keydown", e => {
  if (e.target.closest?.("input, textarea") || document.querySelector("dialog[open]")) return;
  if ((e.key === "z" || e.key === "Z") && !e.altKey) { e.preventDefault(); undo(); }
  else if (e.key === "h" || e.key === "H") hint();
});
window.addEventListener("resize", () => { if (L) { view = null; drawPlant(); } });

// for tests and debugging
window.__refinery = { get level() { return L; }, get routing() { return routing; }, get result() { return R; }, get par() { return par; }, get target() { return target; },
  load, setShares, chooseCrude, openSplit, openCard, openLesson, openTest, openCourse, duel, submit, get test() { return test; }, get lesson() { return lesson; } };

if (duel.inAddress) duel.join().then(ok => { if (!ok) load(read(AT, null) || (LEVELS.find(l => !progress()[l.id]?.stars) || LEVELS[0]).id); });
else load(read(AT, null) || (LEVELS.find(l => !progress()[l.id]?.stars) || LEVELS[0]).id);
document.addEventListener("visibilitychange", () => { if (!document.hidden) duel.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
noteStars("refinery", starsAll());
