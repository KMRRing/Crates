// Refinery: a course in how a refinery works, level by level. Each level opens with its lesson (refinery-lessons.js,
// its pictures refinery-scenes.js), then the plant itself on its flowsheet (refinery-sheet.js), where every stream can
// be sent anywhere that takes it, in shares, and the margin shows against par (the LP's plan, refinery-par.js); then
// an exam (refinery-exam.js). The engine (refinery-engine.js) runs the plant; the data (refinery-data.js) describes it.
// Together, the same level for everyone at the table (duel.js).
import { STREAMS, UNITS, POOLS, CRUDES, PROPS, H2_PRICE, BOUGHT, SULPHUR, REAGENTS } from "./refinery-data.js";
import { FEED, evaluate, runs, destinations, streamsOf, sharesOf, defaultRouting, normalise, poolsOf, specsOf, limitOf, fmtProp, failText, priceOf, refundOf, coLimits, coTotalOf, solve, ownProps, unitYields, columnFeeds, asPlayed, lower, shareTo, roomFor, withShares, edgesOf, culprits, fmtPast } from "./refinery-engine.js";
import { CHAPTERS, LEVELS } from "./refinery-levels.js";
import { differences, nextHint, rowCommonness, mainOf, bucketOf, EPS, AT_PAR } from "./refinery-practice.js";
import { PAR } from "./refinery-par.js";
import { drawSheet, hitTest, GROUP_COLOUR, amount } from "./refinery-sheet.js";
import { lessonFor, TEACHES, GLOSSARY } from "./refinery-lessons.js";
import { playScene } from "./refinery-scenes.js";
import { buildTest, isRight, rightAnswer, passMark, missedTap } from "./refinery-exam.js";
import { noteStars } from "./suite.js";
import { roundOver } from "./random.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, action, mirror, line, toggle, choice } from "./menu.js";
import { createDuel } from "./duel.js";

const $ = id => document.getElementById(id);
const PROGRESS = "refinery:progress", WORK = "refinery:work", AT = "refinery:at", FLOW = "refinery:flow";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
try { localStorage.removeItem("refinery:save"); } catch { /* the old campaign's save, before the course */ }
const money = n => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;
/** A share as a per cent for the words: a small one (a co-processing limit of 2.5%) keeps its decimal. */
const pctWord = x => (x < 0.1 ? +(x * 100).toFixed(1) : Math.round(x * 100));
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
const locks = new Map();   // stream → the destinations whose shares hold while its others move (its sheet's locks), for the level open

const played = asPlayed;
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
  history = []; picked = null; view = null; locks.clear();
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
  routing = withShares(L, routing, s, shares, R);
  if (D) D.routing = routing;
  keep();
  render();
}
/** The destinations of a stream whose shares hold while its others move. */
const heldOf = s => locks.get(s) || new Set();
/** One destination's share set, the stream's others scaled to make up the rest (or the rest to its home), the locked ones held. */
const setShare = (s, d, f) => shareTo(L, s, routing[s], d, f, heldOf(s));
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
/** Stars for a margin: three at par, two near it, one in spec and not far off; a hint caps them at two, par's plan at one. */
function starsFor(m, res, p = progress()[base.id] || {}) {
  if (!runs(res)) return 0;
  const gap = target - m;
  const s = gap <= AT_PAR ? 3 : gap <= 0.5 ? 2 : gap <= 1.5 ? 1 : 0;
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
  const worst = off.length ? culprits(L, R, off[0][0])[0] : null, from = worst?.by.filter(c => c.share >= 0.25).slice(0, 2) || [];
  // short names, as the flowsheet labels them: two lines hold the products, the worst miss and where it comes from (a
  // short name ending in its own full stop, "Isom.", ends the sentence)
  v.textContent = hard ? hard.text : off.length ? `${listOf(off.map(([id]) => POOLS[id].short))} off spec: ${failText(worst)}${from.length ? `, from the ${from.map(c => STREAMS[c.s].short).join(" and the ")}` : ""}.`.replace(/\.\.$/, ".")
    : gap <= AT_PAR ? "At par, every pool in spec." : `${money(gap)}/bbl short of par${base.crudes && L.crude !== bestCrude() ? " (another crude does better)" : ""}.`;
  // stars won are kept; a first finish, or more stars, says so
  if (won > (was.stars || 0) || deckBetter || m > (was.best ?? -Infinity) + 1e-9) {
    p[base.id] = { ...was, stars: Math.max(won, was.stars || 0), best: Math.max(m, was.best ?? -Infinity), ...(decks ? { decks } : {}) };
    write(PROGRESS, p);
    noteStars("refinery", starsAll());
    showStars(p[base.id].stars);
    if (won > (was.stars || 0)) { setTimeout(() => finished(won), 350); roundOver("refinery"); }
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

// ---------- what puts a product off spec ----------
// Off spec, a product says which of the streams in it push it over each limit it fails (culprits in the engine), how
// hard each pushes, and how much of one taken out would bring it back: the flowsheet draws them red, the product's card
// lists them, the margin's line names the worst, and each one's own sheet says what it's doing there.
const PUSH = 0.1;   // a stream with less of a limit's push than this isn't named for it
/** Each off-spec product's culprits, for the plan as it runs: [[pool, [{ k, dir, lim, v, by }]]]. */
const offSpec = () => Object.entries(R.pools).filter(([, p]) => !p.inSpec && p.vol > 1e-4).map(([p]) => [p, culprits(L, R, p)]);
/** The streams the flowsheet draws red: "stream>pool" for each with a real share of a failing limit's push. */
const culpritLinks = () => new Set(offSpec().flatMap(([p, fs]) => fs.flatMap(f => f.by.filter(c => c.share >= PUSH).map(c => `${c.s}>${p}`))));
const pctOf = f => (f < 0.005 ? "under 1%" : `${Math.round(f * 100)}%`);
const listOf = xs => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0] ?? "");
const kbFine = v => `${v < 0.1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v)} kb/d`;
const FIX = 0.25;   // a remedy that takes out more than this share of a product isn't one: its base stock is what misses
/** A culprit's property in words: its value, or for a flag what it lacks. */
const valueWords = (k, v) => (PROPS[k].flag ? (k === "grade" ? "untreated" : "not an asphaltic crude's") : `${lower(PROPS[k].name)} ${fmtProp(k, v)}`);
const pushWord = f => (f.dir === "max" ? "excess" : "shortfall");
/**
 * The least taken out of a product that meets a failed limit, in words ("taking out all 2.4 kb/d of the light gas oil
 * and a trace of the kerosene meets the limit"), or null where it would take out more than a FIX share of the product.
 */
function fixWords(f, vol) {
  const out = f.by.filter(c => c.out > 1e-9);
  if (!out.length || out.reduce((a, c) => a + c.out, 0) > FIX * vol) return null;
  return `taking out ${out.map(c => `${c.out >= c.vol - 1e-6 ? `all ${kbFine(c.vol)} of` : c.out < 0.01 ? "a trace of" : `${kbFine(c.out)} of`} the ${lower(STREAMS[c.s].name)}`).join(" and ")} meets the limit`;
}

const svg = $("sheet"), pointers = new Map();
let gesture = null, lastTap = 0;
function drawPlant() {
  const flow = read(FLOW, true) && !matchMedia("(prefers-reduced-motion: reduce)").matches, fade = fadeOf();
  const lay = drawSheet(svg, L, R, { select: picked, flow, fade, culprits: culpritLinks() });
  $("linesBtn").classList.toggle("on", !!fade);
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

// ---------- which lines the flowsheet shows ----------
// A whole refinery draws a hundred lines, and most of a cracker's products have only one place to go. The lines panel
// lets the rest recede: the streams with no other destination, and the families not chosen. What recedes stays faint,
// so the plant still reads, and can't be tapped, so the lines left are easy to hit.
const LINES = "refinery:lines";
const FAMILIES = [["gas", "Gas & LPG"], ["naphtha", "Naphtha"], ["middle", "Distillates"], ["heavy", "Heavy oils"], ["resid", "Residue"], ["renewable", "Renewables"], ["other", "Other"]];
let lines = { choices: false, family: "all", ...read(LINES, {}) };
/** The families a level's streams come in: a family chosen on another level never leaves this one blank. */
const familiesOf = lv => new Set(streamsOf(lv).map(s => STREAMS[s].group));
/** Whether a stream's lines recede as the panel is set, or null when nothing does. */
function fadeOf() {
  const family = familiesOf(L).has(lines.family) ? lines.family : "all";
  if (!lines.choices && family === "all") return null;
  return s => (lines.choices && destinations(L, s).length < 2) || (family !== "all" && STREAMS[s].group !== family);
}
function setLines(next) { lines = { ...lines, ...next }; write(LINES, lines); drawPlant(); fillLines(); }
function fillLines() {
  const present = familiesOf(L), families = [["all", "All"], ...FAMILIES.filter(([g]) => present.has(g))];
  const fam = choice("Family", families, present.has(lines.family) ? lines.family : "all", v => setLines({ family: v }));
  // each family's button in the colour its lines are drawn in
  fam.querySelectorAll("button").forEach((b, i) => { if (i) { b.classList.add("rf-fam"); b.style.setProperty("--c", GROUP_COLOUR[families[i][0]]); } });
  $("linesPanel").replaceChildren(choice("Streams", [[false, "All"], [true, "With a choice"]], lines.choices, v => setLines({ choices: v })), fam);
}
function showLines(open) {
  $("linesPanel").hidden = !open;
  $("linesBtn").setAttribute("aria-expanded", String(open));
  if (open) fillLines();
}
$("linesBtn").addEventListener("click", () => showLines($("linesPanel").hidden));
// a tap anywhere else, or Escape, puts it away
document.addEventListener("pointerdown", e => { if (!$("linesPanel").hidden && !e.target.closest?.("#linesPanel, #linesBtn")) showLines(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("linesPanel").hidden) showLines(false); });

// ---------- a stream: where it goes, in shares ----------
let splitFor = null, rowsFor = null, drag = null, allCache = null;
const splitRows = new Map();   // destination → its row's parts, while a stream's sheet is open
const pctText = f => `${+(f * 100).toFixed(f * 100 % 1 ? 1 : 0)}`;
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
/** A stream's sheet: its rows built once while it's open and brought up to date after, so a slider being dragged is never replaced under the finger. */
function fillSplit(s) {
  const st = STREAMS[s], run = R.streams[s], props = run?.props || ownProps(L, s);
  $("splitTitle").textContent = st.name;
  const meta = $("splitMeta");
  meta.replaceChildren();
  const what = document.createElement("span");
  what.textContent = `${run ? amount(s, run.vol) : "not made now"}${st.about ? ` · ${st.about}` : ""} · ${keyProps(s, props).map(k => `${lower(PROPS[k].name)} ${fmtProp(k, props[k])}`).join(" · ")}`;
  const note = document.createElement("small"); note.textContent = st.note;
  meta.append(what, note);
  // where it's what puts a product off spec
  for (const [p, fs] of offSpec()) for (const f of fs) {
    const c = f.by.find(x => x.s === s);
    if (!c || c.share < PUSH) continue;
    const w = document.createElement("small"); w.className = "rf-why";
    const fix = fixWords(f, R.pools[p].vol);
    w.textContent = `It puts the ${lower(POOLS[p].name)} off spec (${failText(f)}), ${pctOf(c.share)} of the ${pushWord(f)}${fix ? `: ${fix}` : ""}.`;
    meta.append(w);
  }
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
  if (rowsFor !== `${L.id}:${s}`) {
    rowsFor = `${L.id}:${s}`;
    splitRows.clear(); breaks.clear(); asked = null;
    $("splitRows").replaceChildren(...dests.map(d => splitRow(s, d)));
  }
  const all = allHere(s), held = heldOf(s);
  for (const [d, p] of splitRows) {
    const f = shares[d] || 0, m = f > 0.999 ? now : all[d];
    // a held share doesn't move, nor one nothing else could take up; the others go no further than the held ones leave
    const locked = held.has(d), pinned = !locked && !dests.some(x => x !== d && !held.has(x)), cap = roomFor(shares, d, held);
    p.row.classList.toggle("on", f > 1e-4);
    p.row.classList.toggle("held", locked);
    p.lock.setAttribute("aria-pressed", String(locked));
    p.lock.title = locked ? "Let this share move" : "Hold this share";
    p.range.disabled = p.pct.disabled = p.all.disabled = locked || pinned;
    p.all.textContent = [...held].some(x => x !== d) ? "Rest" : "All";
    p.track.classList.toggle("capped", !locked && !pinned && cap < 1 - 1e-9);
    p.track.style.setProperty("--cap", cap);
    if (locked || pinned) { breaks.delete(d); p.track.style.setProperty("--marks", "none"); }
    p.delta.className = `rf-delta${m - now > 0.005 ? " up" : m - now < -0.005 ? " down" : ""}`;
    p.delta.textContent = f > 0.999 ? "all here" : `all: ${m - now >= 0 ? "+" : "−"}${Math.abs(m - now).toFixed(2)}`;
    p.range.value = String(f * 100);
    p.track.style.setProperty("--at", f);
    if (document.activeElement !== p.pct) p.pct.value = pctText(f);
  }
  $("splitMargin").textContent = `Margin ${money(R.margin)}/bbl · par ${money(target)}`;
  if (!drag) askBreaks(s);
}
/** A padlock, shut and open: the stylesheet shows the one its button's state calls for. */
const PADLOCK = `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path class="shut" d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/><path class="open" d="M10.5 7V4.5a2.5 2.5 0 0 0-5 0v.6"/><rect x="3.5" y="7" width="9" height="6.5" rx="1.3"/></svg>`;
/**
 * A destination's row: its share as a slider (its spec breaks marked on the track) and as a number, All, and a lock
 * (Korbi, October 2026: in a split three ways, one share to hold while another moves): a locked share stays as it is
 * whatever the others do, so the rest is shared among the unlocked, and none of them can pass what it leaves.
 */
function splitRow(s, d) {
  const dest = UNITS[d] || POOLS[d];
  const row = document.createElement("div"); row.className = "rf-split-row";
  const name = document.createElement("div"); name.className = "rf-split-name";
  const b = document.createElement("b"); b.textContent = UNITS[d] ? UNITS[d].name : `${POOLS[d].name} · $${d === "notBought" ? refundOf(L, s) : priceOf(L, d)}`;
  const why = document.createElement("small"); why.textContent = UNITS[d] ? UNITS[d].purpose : POOLS[d].note;
  name.append(b, why);
  const delta = document.createElement("em");
  const ctl = document.createElement("div"); ctl.className = "rf-split-ctl";
  const track = document.createElement("div"); track.className = "rf-track";
  const range = document.createElement("input");
  range.type = "range"; range.min = "0"; range.max = "100"; range.step = "any";
  range.setAttribute("aria-label", `Share to ${dest.name}`);
  const tip = document.createElement("span"); tip.className = "rf-edge-tip"; tip.hidden = true;
  track.append(range, tip);
  const pct = document.createElement("input");
  pct.type = "text"; pct.inputMode = "decimal"; pct.className = "rf-pct";
  pct.setAttribute("aria-label", `Per cent to ${dest.name}`);
  const unit = document.createElement("span"); unit.textContent = "%";
  const allBtn = document.createElement("button"); allBtn.type = "button"; allBtn.className = "rf-all"; allBtn.textContent = "All";
  const lock = document.createElement("button"); lock.type = "button"; lock.className = "rf-lock"; lock.innerHTML = PADLOCK;
  lock.setAttribute("aria-label", `Hold the share to ${dest.name}`); lock.setAttribute("aria-pressed", "false");
  // a finger on the slider holds the stream's other shares as they were, so the drag stays on the one path its
  // breaks were found along (dragged to all and back, the others come back as they were, not to the home)
  range.addEventListener("pointerdown", () => {
    const { rem, run } = trackOf(range);
    drag = { d, from: { ...(routing[s] || {}) }, first: true, reach: run > 0 ? (SNAP * rem) / run : 0 };
  });
  range.addEventListener("input", () => {
    const cap = roomFor(drag?.d === d ? drag.from : routing[s], d, heldOf(s));
    let raw = +range.value / 100;
    if (raw > cap) { raw = cap; range.value = String(cap * 100); }
    if (drag?.d !== d) { setShares(s, setShare(s, d, Math.round(raw * 100) / 100)); return; }   // the keys step whole per cents
    const { x, edge } = settle(s, d, raw);
    if (edge) range.value = String(x * 100);
    tip.hidden = !edge;
    if (edge) tip.textContent = edgeWords(edge);
    setShares(s, shareTo(L, s, drag.from, d, x, heldOf(s)), { remember: drag.first });
    drag.first = false;
  });
  const end = () => { if (drag?.d !== d) return; drag = null; tip.hidden = true; fillSplit(s); };
  range.addEventListener("change", end);
  for (const t of ["pointerup", "pointercancel"]) range.addEventListener(t, () => setTimeout(end));
  pct.addEventListener("change", () => {
    const v = Math.max(0, Math.min(100, parseFloat(pct.value.replace(",", ".")) || 0));
    setShares(s, setShare(s, d, v / 100));
    pct.value = pctText(routing[s]?.[d] || 0);   // as far as the held shares let it go
  });
  // with another share held, All is the rest: everything not held
  allBtn.addEventListener("click", () => setShares(s, shareTo(L, s, routing[s], d, 1, heldOf(s))));
  lock.addEventListener("click", () => {
    const held = new Set(heldOf(s));
    if (!held.delete(d)) held.add(d);
    if (held.size) locks.set(s, held); else locks.delete(s);
    // every slider's path changes with a lock: its breaks are found again
    breaks.clear();
    for (const p of splitRows.values()) p.track.style.setProperty("--marks", "none");
    fillSplit(s);
  });
  ctl.append(track, pct, unit, allBtn, lock);
  row.append(name, delta, ctl);
  splitRows.set(d, { row, track, range, pct, delta, tip, all: allBtn, lock });
  return row;
}
/** What sending all of a stream to each of its destinations would earn, the rest of the plan as it is: its own shares don't come into it, so a drag of them reuses it. */
function allHere(s) {
  const key = JSON.stringify([L.id, L.crude, L.deck, s, { ...routing, [s]: null }]);
  if (allCache?.key !== key) allCache = { key, m: Object.fromEntries(destinations(L, s).map(d => [d, evaluate(L, { ...routing, [s]: { [d]: 1 } }).margin])) };
  return allCache.m;
}

// ---------- where a share crosses a spec ----------
// Along each slider a pool can go on or off spec, and the margin steps there: often by dollars a barrel, as a blend
// that fails sells as the next grade down. The worker finds those breaks (refinery-worker.js); the track shows each in
// green on the side that earns more and red on the side that loses, and a dragged thumb that comes near one stops on
// its edge when that earns more than where the finger is: a plan earns most on the edge of a spec, more often than not.
const SNAP = 0.75, NEAR = 0.25;   // rem: how near an edge pulls the thumb, how near two breaks look one
/** A slider in pixels: the root's rem, and the run of the thumb's centre (the slider's width less the thumb's, refinery.css's --rf-thumb). */
function trackOf(range) {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return { rem, run: range.getBoundingClientRect().width - (parseFloat(getComputedStyle(range).getPropertyValue("--rf-thumb")) || 0) * rem };
}
let scanner = null, scanId = 0, asked = null, sentLevel = null, scanPaths = {};
const breaks = new Map();   // destination → { path, list }, for the stream open
/** What a slider's breaks depend on: the level as played, the rest of the plan, the stream's held shares as they are and its other shares in proportion. */
function pathOf(s, d, shares = routing[s]) {
  const held = [...heldOf(s)].filter(x => x !== d);
  const others = Object.entries(shares || {}).filter(([x, v]) => x !== d && v > 0 && !held.includes(x)), sum = others.reduce((a, [, v]) => a + v, 0);
  return JSON.stringify([L.id, L.crude, L.deck, held.map(x => [x, Math.round((shares?.[x] || 0) * 1e9)]).sort(), others.map(([x, v]) => [x, Math.round((v / sum) * 1e9)]).sort(), { ...routing, [s]: null }]);
}
/** Asks the worker for every slider's breaks as the plan now stands (the sliders in use first, none held or pinned by the locks); each is drawn as it comes. */
function askBreaks(s) {
  const held = heldOf(s), key = JSON.stringify([L.id, L.crude, L.deck, routing, [...held].sort()]), sh = routing[s] || {}, dests = destinations(L, s);
  const rows = dests.filter(d => !held.has(d) && dests.some(x => x !== d && !held.has(x)));
  if (key === asked || rows.length < 2) return;
  asked = key;
  if (scanner === null) scanner = startScanner();
  if (!scanner) return;
  rows.sort((a, b) => (sh[b] > 1e-4) - (sh[a] > 1e-4));
  scanPaths = Object.fromEntries(rows.map(d => [d, pathOf(s, d)]));
  scanner.postMessage({ id: ++scanId, s, routing, rows, locked: [...held], level: sentLevel === L ? null : L });
  sentLevel = L;
}
function startScanner() {
  try {
    const w = new Worker(new URL("./refinery-worker.js", import.meta.url), { type: "module" });
    w.addEventListener("message", ({ data }) => {
      if (data.id !== scanId || !splitRows.has(data.d)) return;
      breaks.set(data.d, { path: scanPaths[data.d], list: data.breaks });
      paintBreaks(data.d);
    });
    w.addEventListener("error", () => { scanner = false; });
    return w;
  } catch { return false; }
}
/** The sheet closed: the worker drops what it was doing. */
function stopBreaks() { if (scanner) scanner.postMessage({ id: ++scanId }); asked = null; }
/** A slider's breaks on its track, those too close to tell apart as one: each fading out from its edge, green on a side that loses nothing against the edge's best point, red on one that does; an edge that loses either way (a narrow spec window) has a green line at its best point, one that loses neither way (a narrow dip) a red one. */
function paintBreaks(d) {
  const p = splitRows.get(d), list = breaks.get(d)?.list || [];
  if (!p) return;
  const { rem, run } = trackOf(p.range), edges = list.length && run > 0 ? edgesOf(list, (NEAR * rem) / run) : [];
  const at = x => `calc(var(--rf-thumb) / 2 + ${+x.toFixed(6)} * (100% - var(--rf-thumb)))`;
  const loses = v => v >= 0.05, colour = v => (loses(v) ? "var(--rf-bad)" : "var(--rf-good)");
  const stops = edges.flatMap((e, i) => {
    const x = at(e.at), from = `calc(${x} - var(--rf-band))`, to = `calc(${x} + var(--rf-band))`;
    // a band reaches halfway to the next edge at most
    const start = i ? `max(${from}, ${at((edges[i - 1].at + e.at) / 2)})` : from, stop = i < edges.length - 1 ? `min(${to}, ${at((e.at + edges[i + 1].at) / 2)})` : to;
    const line = loses(e.left) === loses(e.right) ? (loses(e.left) ? "var(--rf-good)" : "var(--rf-bad)") : null;
    return [`transparent ${start}`, ...(line ? [`${colour(e.left)} calc(${x} - 1.5px)`, `${line} calc(${x} - 1.5px)`, `${line} calc(${x} + 1.5px)`, `${colour(e.right)} calc(${x} + 1.5px)`] : [`${colour(e.left)} ${x}`, `${colour(e.right)} ${x}`]), `transparent ${stop}`];
  });
  p.track.style.setProperty("--marks", stops.length ? `linear-gradient(to right, ${stops.join(", ")})` : "none");
}
/**
 * Where a dragged share settles: on a spec edge within reach of the finger if one earns more than the share under it
 * (the best of them), else on the whole per cent under it. Only breaks found along this drag's own path count.
 */
function settle(s, d, raw) {
  const held = heldOf(s), free = Math.min(Math.round(raw * 100) / 100, roomFor(drag.from, d, held)), k = breaks.get(d);
  const near = k && k.path === pathOf(s, d, drag.from) ? k.list.filter(b => Math.abs(b.at - raw) <= drag.reach) : [];
  if (!near.length) return { x: free };
  const here = evaluate(L, { ...routing, [s]: shareTo(L, s, drag.from, d, free, held) }).margin;
  let edge = null;
  for (const b of near) {
    const m = Math.max(b.below, b.above);
    if (m > here + 1e-6 && (!edge || m > edge.m + 1e-9 || (m > edge.m - 1e-9 && Math.abs(b.at - raw) < Math.abs(edge.b.at - raw)))) edge = { b, m };
  }
  return edge ? { x: edge.b.at, edge: edge.b } : { x: free };
}
/** A spec edge in a few words: the product, the grade it sells as if that's another, and the specs it holds to there ("diesel: CFPP", "gasoil as VLSFO: flash point"). */
const edgeWords = b => b.pools.map(p => {
  const what = `${lower(POOLS[p.pool].short)}${p.was !== p.pool ? ` as ${POOLS[p.was].short}` : ""}`;
  return p.specs.length ? `${what}: ${p.specs.map(k => lower(PROPS[k].name)).join(", ")}` : `${what}, else ${lower(POOLS[p.soldAs].short)}`;
}).join(" · ");

// ---------- cards: a unit, a product, the crude ----------
/** Where a stream goes now, in a few words: "→ NHT 62% · Naphtha 38%", and "nowhere else" when it has one way out. */
function goesTo(s) {
  const to = Object.entries(R.streams[s]?.to || {}).filter(([, v]) => v > 1e-4).sort((a, b) => b[1] - a[1]), all = to.reduce((a, [, v]) => a + v, 0);
  const name = d => (UNITS[d] || POOLS[d]).short;
  return `→ ${to.length === 1 ? name(to[0][0]) : to.map(([d, v]) => `${name(d)} ${Math.round((v / all) * 100)}%`).join(" · ")}${destinations(L, s).length < 2 ? " · nowhere else" : ""}`;
}
/** Where a stream comes from now: the units that make it (the crude unit for a cut), or bought in. */
function comesFrom(s) {
  const from = [...Object.entries(R.units).filter(([, x]) => x.outputs?.[s] > 1e-4).map(([u]) => UNITS[u].short), ...(L.bought?.[s] ? ["bought in"] : [])];
  return from.length ? `from ${from.join(" · ")}` : "";
}
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
  // a stream as a row to tap for its sheet: its colour, name and flow, and where it goes or comes from
  const streamRow = (s, v, where) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "rf-stream";
    b.style.setProperty("--c", GROUP_COLOUR[STREAMS[s].group] || GROUP_COLOUR.other);
    const name = document.createElement("b"); name.textContent = STREAMS[s].name;
    const vol = document.createElement("span"); vol.textContent = amount(s, v);
    const note = document.createElement("small"); note.textContent = where;
    b.append(name, vol, note);
    b.addEventListener("click", () => { $("cardDlg").close(); openSplit(s); });
    return b;
  };
  const reagentRow = (r, v) => { const d = document.createElement("div"); d.className = "rf-stream fixed"; d.innerHTML = "<b></b><span></span><small></small>"; d.children[0].textContent = REAGENTS[r].name; d.children[1].textContent = kbd(v); d.children[2].textContent = "bought in"; return d; };
  const streams = (head, rows) => { if (!rows.length) return; add("h3", null, head); add("div", "rf-streams").append(...rows); };
  if (id === "crude" || id === "cdu" || id === "cdu2") {
    const c = CRUDES[L.crude], cols = columnFeeds(L), F = id === "crude" ? L.feed ?? FEED : cols[id], unit = UNITS[id];
    $("cardTitle").textContent = unit ? `${unit.name} (${unit.short})` : `Crude: ${c.name}`;
    add("p", "rf-purpose", unit ? unit.purpose : c.note);
    add("p", "rf-facts", `${c.name}: API ${c.api}, ${c.sulphur}% sulphur, $${c.price}/bbl delivered, ${F} kb/d${cols.cdu2 ? (unit ? ` of the ${L.feed ?? FEED} its two crude units run` : `: ${cols.cdu} through the crude unit, ${cols.cdu2} through the second`) : ""}.`);
    add("h3", null, "The cuts");
    table(Object.entries(c.cuts).map(([s, f]) => [streamLink(s), STREAMS[s].about || "", `${(f * 100).toFixed(1)}%`, kbd(F * f), R.streams[s]?.props?.s != null ? fmtProp("s", R.streams[s].props.s) : ""]), ["Cut", "Boils", "Yield", "Flow", "Sulphur"]);
    if (unit) { for (const t of unit.card) add("p", null, t); add("h3", null, "Operating"); table(unit.facts); }
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
      const co = coLimits(L, id), all = coTotalOf(L, id), mine = Object.keys(co).filter(f => run.feeds[f]);
      for (const f of mine) add("p", "rf-facts", `Co-processing: ${lower(STREAMS[f].name)} is ${pctWord(run.feeds[f] / run.feed)}% of its feed, of ${pctWord(co[f])}% at most${run.coOver?.[f] >= 0.05 ? `; ${kbd(run.coOver[f])} more went elsewhere` : ""}.`);
      // and together, where it takes more than one
      if (all != null && mine.length > 1) add("p", "rf-facts", `Together they're ${pctWord(mine.reduce((a, f) => a + run.feeds[f], 0) / run.feed)}% of its feed, of ${pctWord(all)}% at most.`);
      shadow();
      streams("In", [...Object.entries(run.feeds).map(([s, v]) => streamRow(s, v, comesFrom(s))), ...Object.entries(run.uses || {}).map(([r, v]) => reagentRow(r, v))]);
      streams("Out", Object.entries(run.outputs).filter(([, v]) => v > 1e-4).map(([s, v]) => streamRow(s, v, goesTo(s))));
    } else add("p", "rf-facts", `Idle: nothing is sent to it.${cap ? ` Capacity ${cap} kb/d.` : ""}`);
    for (const t of u.card) add("p", null, t);
    if (u.facts) { add("h3", null, "Operating"); table(u.facts); }
    // the yields from the feeds this level can give it (a level's own, where a whole refinery's chapter sets them)
    const ys = Object.fromEntries(Object.entries(unitYields(L, id)).filter(([f]) => streamsOf(L).includes(f)));
    if (Object.keys(ys).length && id !== "vdu") {
      add("h3", null, "Yields, by volume of feed");
      const feeds = Object.keys(ys), outs = [...new Set(feeds.flatMap(f => Object.keys(ys[f])))];
      table(outs.map(o => [STREAMS[o].name, ...feeds.map(f => (ys[f][o] != null ? `${Math.round(ys[f][o] * 100)}%` : "–"))]), ["", ...feeds.map(f => STREAMS[f].short)]);
    }
    if (id === "vdu") add("p", "rf-facts", `It lifts ${Math.round(CRUDES[L.crude].vgoShare * 100)}% of ${CRUDES[L.crude].name}'s residue as gas oil, four parts light to six heavy.`);
    const h = Object.entries(u.h2 || {}).filter(([, v]) => v);
    if (h.length) add("p", "rf-facts", `Hydrogen: ${h.map(([f, v]) => `${STREAMS[f].short} ${v > 0 ? "makes" : "uses"} ${Math.abs(v * 1000)} scf/bbl`).join("; ")}. Hydrogen from the plant costs $${H2_PRICE} per thousand scf.`);
    // what it takes besides its feed: a bought reactant, a share of each barrel
    for (const [f, rs] of Object.entries(u.uses || {})) for (const [r, per] of Object.entries(rs)) add("p", "rf-facts", `${REAGENTS[r].name}: ${per} of a barrel with each barrel of ${lower(STREAMS[f].name)}, bought at $${REAGENTS[r].price} a barrel.`);
    if (u.opex) add("p", "rf-facts", `Running cost about $${u.opex}/bbl of feed.`);
  } else if (POOLS[id]) {
    const def = POOLS[id], pool = R.pools[id];
    $("cardTitle").textContent = def.name;
    add("p", "rf-purpose", def.note);
    const per = def.per || "bbl";
    add("p", "rf-facts", pool ? `${amount(id, pool.vol)} at $${+pool.price.toFixed(2)}/${per}${pool.soldAs !== id ? `: off spec, so sold as ${lower(POOLS[pool.soldAs].name)}` : ""}.${pool.over ? ` The market takes ${L.markets[id]} kb/d.` : ""}` : `Nothing goes here now. $${priceOf(L, id)}/${per}.`);
    // its tickets: the renewable part's saving at the quota price, a quarter more for aviation fuel's premium
    if (L.ticket && def.tickets) add("p", "rf-value", pool?.tickets ? `Its renewable part saves ${pool.saved.toFixed(0)} t of CO₂e a day against fossil fuel: tickets worth $${pool.tickets.toFixed(1)} thousand a day at $${L.ticket} a tonne${def.tickets !== 1 ? `, and ${Math.round((def.tickets - 1) * 100)}% more for sustainable aviation fuel's premium` : ""}.` : `Renewable blendstocks here earn a ticket on what they save, at $${L.ticket} a tonne of CO₂e.`);
    // off spec: what puts it there, limit by limit, each stream a tap from its sheet
    const why = pool && !pool.inSpec ? culprits(L, R, id) : [];
    if (why.length) {
      add("h3", null, "What puts it off spec");
      for (const f of why) {
        const what = failText(f), fix = fixWords(f, pool.vol);
        add("p", "rf-why", `${what[0].toUpperCase()}${what.slice(1)}${fix ? `: ${fix}` : ""}.`);
        add("div", "rf-streams").append(...f.by.map(c => streamRow(c.s, c.vol, `${valueWords(f.k, c.v)} · ${pctOf(c.share)} of the ${pushWord(f)}${fix && c.out > 1e-9 ? ` · out: ${c.out >= c.vol - 1e-6 ? "all of it" : c.out < 0.01 ? "a trace" : kbFine(c.out)}` : ""}`)));
      }
    }
    const judged = specsOf(L, id);
    if (def.spec) {
      add("h3", null, "Its specification, as judged here");
      table(Object.entries(def.spec).map(([k, [lo, hi]]) => {
        const on = judged.includes(k), v = pool?.props?.[k], [jlo, jhi] = on ? limitOf(L, id, k) : [lo, hi];
        const ok = pool && on ? !pool.fails.some(f => f.k === k) : null;
        const lim = PROPS[k].flag ? "required" : [jlo != null ? `≥ ${fmtProp(k, jlo)}` : "", jhi != null ? `≤ ${fmtProp(k, jhi)}` : ""].filter(Boolean).join(", ");
        const mark = document.createElement("b"); mark.className = ok == null ? "rf-muted" : ok ? "rf-ok" : "rf-no"; mark.textContent = !on ? "not judged here" : ok == null ? "–" : ok ? "✓" : "✗";
        const miss = ok === false && pool.fails.find(f => f.k === k);
        return [PROPS[k].name, lim, v == null ? "–" : miss ? fmtPast(k, v, miss.lim) : fmtProp(k, v), mark];
      }), ["", "Limit", "Blend", ""]);
    }
    if (pool) {
      streams("What's in it", Object.entries(pool.parts).sort((a, b) => b[1] - a[1]).map(([s, v]) => streamRow(s, v, `${v / pool.vol < 0.005 ? "under 1%" : `${Math.round((v / pool.vol) * 100)}%`} of it · ${comesFrom(s)}`)));
    }
    if (def.sheet?.length) { add("h3", null, "The published specification"); table(def.sheet); }
  }
  if (!$("cardDlg").open) $("cardDlg").showModal();
}

// ---------- hints ----------
// A hint goes by how standard a pattern is (refinery-practice.js; Korbi, October 2026: "the player starts with the
// obvious then fine tunes in the end"): the crude where it's the choice (no routing of a worse one reaches the level's
// par), then of the ways your plan differs from par where the bulk of a stream goes before how much, what refineries do
// as standard first and then what most of the course's optimal plans share, each said as refining has it with the
// course's count beside it and what doing it alone comes to here; trims last, and only while the plan is short of par.

/** As many decimals of a percentage as it takes to tell two apart (up to four: a trim can be a thousandth of a point). */
const placesFor = (same, most = 4) => [0, 1, 2, 3].find(dp => !same(dp)) ?? most;
const pcs = (a, b) => { const dp = placesFor(k => (a * 100).toFixed(k) === (b * 100).toFixed(k)); return [a, b].map(f => `${+(f * 100).toFixed(dp)}%`); };
/** A difference from par in words: what par does with the stream, and how standard that is. */
function practiceWords(x) {
  const what = lower(STREAMS[x.s].name), name = d => lower((UNITS[d] || POOLS[d]).name), pc = f => `${Math.round(f * 100)}%`;
  // a purchase not made goes nowhere: it's left unbought
  const left = x.d === "notBought", where = left ? " unbought" : ` to the ${name(x.d)}`;
  const tally = `${x.count} of the ${x.n} optimal plans`, scope = left ? "that could buy it" : "where it can go there";
  if (x.tier) {
    // how much is the plan's own: the course's count, no claim for refining
    const [theirs, mine] = pcs(x.theirs, x.mine), whole = f => (f >= 1 - EPS ? "all" : f <= EPS ? "none" : null);
    const told = `Fine-tuning: par ${left ? "leaves" : "sends"} ${whole(x.theirs) || theirs} of the ${what}${where}, you ${whole(x.mine) ? `${whole(x.mine)} of it` : mine}.`;
    if (x.same) return `${told} Your pattern is par's; the amount is particular to this plan.`;
    const how = { all: "all of it", most: "most of it, not all", part: "part of it", none: "none of it" }[bucketOf(x.theirs)];
    return `${told} In the course, ${tally} ${scope} ${left ? "leave" : "send"} ${how}${left ? " unbought" : ""} (${pc(x.p)}).`;
  }
  const amount = x.theirs >= 0.995 ? `all of the ${what}` : x.theirs >= 0.5 ? `most of the ${what} (${pc(x.theirs)})` : x.theirs > 0.005 ? `some of the ${what} (${pc(x.theirs)})` : `none of the ${what}`;
  // none of it there: say where it does go
  const main = mainOf(par.routing[x.s]), there = main === "notBought" ? "leaving it unbought" : `the ${name(main)}`;
  const instead = x.theirs > 0.005 ? "" : main === "notBought" ? " (par leaves it unbought)" : ` (par sends it to the ${name(main)})`;
  // refining's word on par's pattern (refinery-practice.js, ROLES), the course's count beside it
  const course = `${scope} do the same (${pc(x.p)})`;
  const why = {
    standard: x.p >= 0.5 ? `Standard practice: ${tally} in the course ${course}.` : `Standard practice, though only ${tally} in the course ${course}.`,
    common: `Common practice: ${tally} in the course ${course}.`,
    usual: `Refineries usually send it to the ${name(x.d)}; here ${there} pays more. In the course, ${tally} ${course}.`,
    share: `Refineries usually send only a share there; here more of it pays. In the course, ${tally} ${course}.`,
    rare: `Rarely done in refining; here it pays. In the course, ${tally} ${course}.`,
  }[x.practice.kind] || `In the course, ${tally} ${course}.`;
  return `In this plan the margin is best with ${amount} ${left ? "left unbought" : `going${where}`}${instead}. ${why}`;
}
function hint() {
  const p = progress();
  p[base.id] = { ...(p[base.id] || {}), hinted: true };
  write(PROGRESS, p);
  const box = $("hint");
  box.hidden = false;
  box.replaceChildren();
  const link = (text, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "rf-link"; b.textContent = text; b.addEventListener("click", fn); return b; };
  const step = nextHint(L, routing, R, par, base.crudes ? { crude: bestCrude(), margin: target } : null), x = step.x;
  if (step.crude) box.append(`The crude first: at par, ${CRUDES[step.crude].name} earns ${money(target)}/bbl here and ${CRUDES[L.crude].name} ${money(par.margin)}. `, link("Do it", () => { box.hidden = true; chooseCrude(step.crude); }));
  else if (step.atPar) box.append("You're at par, every pool in spec: nothing left to find. ", link("Par's plan", showPar));
  else if (!x) box.textContent = "You're on par's plan, or as near it as matters.";
  else {
    box.append(`${practiceWords(x)} `);
    // what taking par's whole row for the stream comes to here, the rest of your plan as it is
    const row = par.routing[x.s], after = evaluate(L, { ...routing, [x.s]: row }), gain = after.margin - R.margin;
    const worth = Math.abs(gain) < 0.005 ? "" : gain > 0 ? `earns ${money(gain)}/bbl` : `costs ${money(-gain)}/bbl`;
    if (!runs(R) && runs(after)) box.append(`Alone it gets the plant running in spec${worth ? ` and ${worth}` : ""}. `);
    else if (worth) box.append(gain > 0 ? `Alone it ${worth}. ` : `Alone it ${worth}; with par's other changes it pays. `);
    box.append(link("Do it", () => { box.hidden = true; setShares(x.s, { ...row }); }), " · ", link("Par's plan", showPar));
  }
  renderBrief();
}
/** Par's plan, the rows refining does as standard first (then by the share of the course's optimal plans that route each
 *  stream the same way), where yours differs marked; taking it caps the level at one star. */
function showPar() {
  const body = $("cardBody");
  body.replaceChildren();
  $("cardTitle").textContent = "Par's plan";
  const p = document.createElement("p"); p.className = "rf-facts";
  p.textContent = `What the LP does with ${CRUDES[L.crude].name}, for ${money(par.margin)}/bbl: the rows refining does as standard first, each with the share of the course's optimal plans that send the bulk of the stream the same way. Where yours differs, it's marked.`;
  body.append(p);
  const t = document.createElement("table"); t.className = "rf-table";
  // a row differs as the hint has it, and shows as many decimals as it takes to see how
  const differs = new Set(differences(L, routing, par.routing).map(x => x.s));
  const fmt = (s, r, dp) => sharesOf(L, r, s).filter(([, f]) => +(f * 100).toFixed(dp) > 0).map(([d, f]) => `${(UNITS[d] || POOLS[d]).short} ${+(f * 100).toFixed(dp)}%`).join(", ");
  const rows = streamsOf(L).filter(s => par.routing[s] && (R.streams[s] || parRun().streams[s])).map(s => ({ s, c: rowCommonness(s, par.routing[s], destinations(L, s)) })).sort((a, b) => a.c.tier - b.c.tier || b.c.p - a.c.p);
  for (const { s, c } of rows) {
    const off = differs.has(s), dp = off ? placesFor(k => fmt(s, routing, k) === fmt(s, par.routing, k)) : 0;
    const mine = fmt(s, routing, dp), theirs = fmt(s, par.routing, dp), tr = document.createElement("tr");
    tr.className = off ? "rf-differs" : "";
    tr.innerHTML = "<td></td><td></td><td></td><td class=\"rf-common\"></td>";
    tr.children[0].textContent = STREAMS[s].name; tr.children[1].textContent = theirs; tr.children[2].textContent = off ? `you: ${mine}` : "";
    tr.children[3].textContent = `${Math.round(c.p * 100)}%`; tr.children[3].title = `${c.count} of ${c.n} optimal plans`;
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
function parRun() {
  const k = `${base.id}|${L.crude}|${L.deck}`;
  if (parRunCache?.k !== k) parRunCache = { k, r: evaluate(L, par.routing) };
  return parRunCache.r;
}

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
    hp.textContent = "Tap an arrow on the flowsheet to choose where that stream goes: each destination takes a share, set with its slider or typed, and All sends the whole stream there. Each row says what sending all of it there would do to the margin. Tap a unit for its card and what it's running, a product for its specification, the crude for its assay. Drag to move the flowsheet, pinch or + and − to zoom. Hint points out where your plan differs from par: what refineries do as standard first (with how many of the course's optimal plans do the same), then the fine-tuning; it caps the stars at two.";
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
    par = parOf(lv, L.crude, L.deck); target = targetOf(lv, L.deck); history = []; view = null; picked = null; locks.clear();
    $("level").value = lv.id;
    keep(); render(); tell();
  },
  onLobby: match => { D = null; const lv = LEVELS.find(l => l.id === String(match.level)) || LEVELS[0]; base = lv; L = played(lv, lv.crude); routing = normalise(L, defaultRouting(L)); par = parOf(lv, lv.crude, L.deck); target = targetOf(lv, L.deck); locks.clear(); render(); $("verdict").textContent = "The same plant for everyone."; },
  onLeave: () => { D = null; load(read(AT, LEVELS[0].id)); },
});
function duelVerdict(off, gap) {
  const v = $("verdict");
  v.className = "rf-verdict";
  v.textContent = D.done ? `Submitted at ${money(D.margin)}/bbl.` : off.length ? `${off.map(([id]) => POOLS[id].name).join(" and ")} off spec.` : gap <= AT_PAR ? "At par." : `${money(gap)}/bbl short of par.`;
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
$("splitDlg").addEventListener("close", () => { rowsFor = null; drag = null; splitRows.clear(); breaks.clear(); stopBreaks(); });
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
window.addEventListener("resize", () => { if (L) { view = null; drawPlant(); } for (const d of splitRows.keys()) paintBreaks(d); });

// for tests and debugging
window.__refinery = { get level() { return L; }, get routing() { return routing; }, get result() { return R; }, get par() { return par; }, get target() { return target; },
  load, setShares, chooseCrude, openSplit, openCard, openLesson, openTest, openCourse, duel, submit, get test() { return test; }, get lesson() { return lesson; }, get sliders() { return [...splitRows.keys()]; }, get breaks() { return breaks; } };

if (duel.inAddress) duel.join().then(ok => { if (!ok) load(read(AT, null) || (LEVELS.find(l => !progress()[l.id]?.stars) || LEVELS[0]).id); });
else load(read(AT, null) || (LEVELS.find(l => !progress()[l.id]?.stars) || LEVELS[0]).id);
document.addEventListener("visibilitychange", () => { if (!document.hidden) duel.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
noteStars("refinery", starsAll());
