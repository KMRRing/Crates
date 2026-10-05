// Refinery: route every stream and watch the margin. The engine (refinery-engine.js) runs the plant; the data
// (refinery-data.js) describes it; the campaign (refinery-levels.js) sets each level's crude and units.
import { STREAMS, UNITS, POOLS, CRUDES } from "./refinery-data.js";
import { FEED, evaluate, destinations, streamsOf, defaultRouting, solve } from "./refinery-engine.js";
import { LEVELS } from "./refinery-levels.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";

dropdown(document.getElementById("level"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
const SAVE = "refinery:save";
const GROUP_COLOUR = { gas: "var(--rf-gas)", naphtha: "var(--rf-naphtha)", middle: "var(--rf-middle)", heavy: "var(--rf-heavy)", resid: "var(--rf-resid)", renewable: "var(--rf-renew)", other: "var(--rf-gas)" };

let S = read(SAVE, { level: 1, routing: {}, crude: {}, best: {}, done: {} });   // routing and crude per level, best margins, levels completed
let L = null;      // the level as played: the campaign entry plus the chosen crude
let par = null;    // { margin, routing }
let R = null;      // the latest evaluation

function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch { /* private mode */ } }
const money = n => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(1)}`;
const kbd = v => `${v.toFixed(1)} kb/d`;
const fmtS = ppm => (ppm >= 10000 ? `${(ppm / 10000).toFixed(1)}%` : `${Math.round(ppm)} ppm`);

// ---------- levels ----------
function loadLevel(n) {
  const base = LEVELS.find(l => l.id === n) || LEVELS[0];
  S.level = base.id;
  L = { ...base, crude: base.chooseCrude ? (S.crude[base.id] || base.crude) : base.crude };
  par = solve(L, base.chooseCrude ? 3 : 5, base.id);
  if (!S.routing[L.id]) S.routing[L.id] = defaultRouting(L);
  // streams the saved routing doesn't know (after a data change) get a home
  for (const s of streamsOf(L)) if (!S.routing[L.id][s]) S.routing[L.id][s] = defaultRouting(L)[s];
  save();
  $("level").value = String(L.id);
  render();
}
function routing() { return S.routing[L.id]; }
/**
 * The routing with one stream sent somewhere else, and any streams that choice newly creates sent to their own
 * best destination (one level deep): so "heavy naphtha to the hydrotreater" is judged with the treated naphtha
 * going on to the reformer, not sitting in the naphtha pool.
 */
function whatIf(stream, dest) {
  const outputsOf = res => new Set(Object.entries(res.units).filter(([u]) => u !== "cdu").flatMap(([, u]) => Object.keys(u.outputs)));
  const madeBefore = outputsOf(evaluate(L, routing()));
  let r = { ...routing(), [stream]: dest };
  const madeAfter = outputsOf(evaluate(L, r));
  for (const st of streamsOf(L)) {
    if (st === stream || !madeAfter.has(st) || madeBefore.has(st)) continue;
    let best = null;
    for (const d of destinations(L, st)) { const m = evaluate(L, { ...r, [st]: d }).margin; if (!best || m > best.m) best = { d, m }; }
    if (best) r = { ...r, [st]: best.d };
  }
  return r;
}
/** Sends a stream somewhere; streams the choice newly creates go to their best places (what the picker's delta assumed). */
function setDestination(stream, dest) {
  S.routing[L.id] = whatIf(stream, dest);
  save();
  render();
}
/**
 * A hint: the one change of destination, from where things are, that gains the most; or, when no single change
 * helps (pools have cliffs), the stream where the player's routing differs from par's. After three hints on a level,
 * par's routing is shown in full.
 */
function hint() {
  S.hints = S.hints || {};
  S.hints[L.id] = (S.hints[L.id] || 0) + 1;
  save();
  if (S.hints[L.id] >= 5) { showPar(); return; }
  const now = R.margin;
  let best = null;
  for (const st of streamsOf(L)) for (const d of destinations(L, st)) {
    if (d === routing()[st]) continue;
    const m = evaluate(L, whatIf(st, d)).margin;
    if (!best || m > best.m) best = { st, d, m };
  }
  if (best && best.m > now + 0.05) {
    const name = d => UNITS[d]?.name || POOLS[d].name;
    const extra = Object.entries(whatIf(best.st, best.d)).filter(([st, d]) => st !== best.st && routing()[st] !== d).map(([st, d]) => `${STREAMS[st].name.toLowerCase()} → ${name(d)}`);
    toast(`${STREAMS[best.st].name} → ${name(best.d)}${extra.length ? `, with ${extra.join(" and ")}` : ""}: ${money(best.m - now)}/bbl better.`, 6500);
    return;
  }
  const diff = streamsOf(L).find(st => par.routing[st] && par.routing[st] !== routing()[st]);
  if (diff) toast(`No single change helps from here: two streams have to move together. Start with ${STREAMS[diff].name.toLowerCase()}: par sends it to ${UNITS[par.routing[diff]]?.name.toLowerCase() || POOLS[par.routing[diff]].name.toLowerCase()}.`, 7000);
  else toast("You're already on par's routing.", 3000);
}
function showPar() {
  const body = $("menuBody");
  body.replaceChildren();
  $("menuDlg").querySelector("h2").textContent = "Par's routing";
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "stats", `What the solver does on this level, for ${money(par.margin)}/bbl. Streams where you differ are marked.`);
  const list = add("ul", "rf-parlist");
  for (const st of streamsOf(L)) {
    const d = par.routing[st];
    if (!d) continue;
    const li = document.createElement("li");
    const differs = routing()[st] !== d;
    li.className = differs ? "differs" : "";
    li.textContent = `${STREAMS[st].name} → ${UNITS[d]?.name || POOLS[d]?.name}${differs ? ` (you: ${UNITS[routing()[st]]?.name || POOLS[routing()[st]]?.name})` : ""}`;
    list.appendChild(li);
  }
  const apply = add("button", "btn primary wide", "Route it like par");
  apply.type = "button";
  apply.addEventListener("click", () => { S.routing[L.id] = { ...par.routing }; save(); $("menuDlg").close(); render(); });
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function chooseCrude(id) {
  S.crude[L.id] = id;
  save();
  loadLevel(L.id);
}

// ---------- drawing ----------
function render() {
  R = evaluate(L, routing());
  const crude = CRUDES[L.crude];
  $("title").textContent = `Level ${L.id} · ${L.title}`;
  $("lesson").textContent = L.lesson;
  $("intro").textContent = `${L.intro} ${crude.name}: API ${crude.api}, ${crude.sulphur}% sulphur, $${crude.price}/bbl, ${FEED} kb/d.`;
  // the margin against par
  const m = $("margin");
  m.textContent = `${money(R.margin)}/bbl`;
  m.className = R.margin >= 0 ? "good" : "bad";
  $("par").textContent = `par ${money(par.margin)}`;
  const lo = Math.min(-15, R.margin - 2), hi = Math.max(par.margin + 3, R.margin + 2);
  const pct = v => `${Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1)}%`;
  $("marginBar").style.width = pct(R.margin);
  $("parTick").style.left = pct(par.margin);
  const pools = Object.entries(R.pools).filter(([, p]) => p.vol > 0.05);
  const offSpec = pools.filter(([id, p]) => !p.inSpec && ["gasoline", "diesel", "jet"].includes(id));
  const reached = R.margin >= par.margin - 0.6 && !offSpec.length;
  if (!S.best[L.id] || R.margin > S.best[L.id]) { S.best[L.id] = R.margin; save(); }
  if (reached && !S.done[L.id]) { S.done[L.id] = true; save(); }
  const v = $("verdict");
  v.className = `rf-verdict${reached ? " good" : ""}`;
  v.textContent = reached ? `Par reached with every pool in spec. Your best here: ${money(S.best[L.id])}/bbl.`
    : offSpec.length ? `${offSpec.map(([id]) => POOLS[id].name).join(" and ")} off spec. ${money(par.margin - R.margin)}/bbl short of par.` : `${money(par.margin - R.margin)}/bbl short of par.`;
  $("nextBtn").hidden = !(reached && L.id < LEVELS.length);
  $("nextBtn").onclick = () => loadLevel(L.id + 1);
  $("hintBtn").hidden = reached;
  $("hintBtn").textContent = (S.hints?.[L.id] || 0) >= 4 ? "Show par's routing" : `Hint${S.hints?.[L.id] ? ` (${S.hints[L.id]} used)` : ""}`;
  drawUnits();
  drawStreams();
  drawPools();
  // the pools tab says how the pools stand, so the routing tab shows it too
  const pt = $("tabPools");
  pt.textContent = offSpec.length ? `Pools · ${offSpec.length} off spec` : "Pools · in spec";
  pt.classList.toggle("off", offSpec.length > 0);
}
/** Streams or pools: one list at a time takes the room under the margin, scrolling inside itself. */
let tab = "streams";
function showTab(t) {
  tab = t;
  $("tabStreams").setAttribute("aria-selected", String(t === "streams"));
  $("tabPools").setAttribute("aria-selected", String(t === "pools"));
  $("paneStreams").hidden = t !== "streams";
  $("panePools").hidden = t !== "pools";
}
/** The level's story, behind the About button. */
function about() {
  $("cardTitle").textContent = $("title").textContent;
  const body = $("cardBody");
  body.replaceChildren();
  for (const id of ["lesson", "intro"]) { const p = document.createElement("p"); p.textContent = $(id).textContent; body.appendChild(p); }
  if (!$("cardDlg").open) $("cardDlg").showModal();
}
function drawUnits() {
  const box = $("units");
  box.replaceChildren();
  for (const u of L.units) {
    const b = document.createElement("button");
    b.type = "button";
    const running = u === "cdu" || R.units[u] || u === "smr" && R.h2.used > R.h2.made || u === "sru" && R.h2.used > 0;
    b.className = `rf-chip${running ? " on" : " idle"}`;
    b.textContent = UNITS[u].short;
    b.title = UNITS[u].name;
    b.addEventListener("click", () => unitCard(u));
    box.appendChild(b);
  }
  const h = R.h2;
  const short = Math.max(0, h.used - h.made);
  $("h2").textContent = `Hydrogen: ${h.made.toFixed(1)} MMscf/d from the reformer, ${h.used.toFixed(1)} used${short > 0.05 ? `, ${short.toFixed(1)} ${L.units.includes("smr") ? "from the hydrogen plant" : "bought in at three times the price"}` : ""}.`;
}
function drawStreams() {
  const box = $("streams");
  box.replaceChildren();
  const pick = $("crudePick");
  pick.hidden = !L.chooseCrude;
  if (L.chooseCrude) {
    pick.replaceChildren();
    const label = document.createElement("span"); label.textContent = "Crude:";
    const sel = document.createElement("select"); sel.className = "pool";
    for (const [id, c] of Object.entries(CRUDES)) { const o = document.createElement("option"); o.value = id; o.textContent = `${c.name} ($${c.price}, ${c.sulphur}% S)`; if (id === L.crude) o.selected = true; sel.appendChild(o); }
    sel.addEventListener("change", e => chooseCrude(e.target.value));
    pick.append(label, sel);
    dropdown(sel);                                                 // in the suite's style, like the header's
  }
  // where each stream comes from, for grouping: the crude unit, then each unit's outputs, then bought-in feeds
  const from = {};
  for (const s of Object.keys(CRUDES[L.crude].cuts)) from[s] = "cdu";
  for (const [u, unit] of Object.entries(R.units)) for (const o of Object.keys(unit.outputs)) if (!from[o]) from[o] = u;
  for (const s of Object.keys(L.renewables || {})) from[s] = "bought";
  const groups = [["cdu", "From the crude unit"], ...L.units.filter(u => u !== "cdu").map(u => [u, `From the ${UNITS[u].name.toLowerCase()}`]), ["bought", "Bought in"]];
  for (const [g, label] of groups) {
    const streams = streamsOf(L).filter(s => from[s] === g && producedVolume(s) > 0.05);
    if (!streams.length) continue;
    const head = document.createElement("div"); head.className = "rf-group"; head.textContent = label; box.appendChild(head);
    for (const s of streams) box.appendChild(streamRow(s));
  }
}
function streamRow(s) {
  const st = STREAMS[s], row = document.createElement("div");
  row.className = "rf-stream";
  const bar = document.createElement("i"); bar.style.background = GROUP_COLOUR[st.group] || GROUP_COLOUR.other;
  const text = document.createElement("div");
  const name = document.createElement("div"); name.className = "name"; name.textContent = st.name;
  const meta = document.createElement("div"); meta.className = "meta";
  const v = producedVolume(s);
  const bits = [kbd(v)];
  const p = propsShown(s);
  if (p.ron != null) bits.push(`RON ${p.ron.toFixed(0)}`);
  if (p.cet != null) bits.push(`cetane ${p.cet.toFixed(0)}`);
  if (p.s != null) bits.push(`S ${fmtS(p.s)}`);
  meta.textContent = bits.join(" · ");
  text.append(name, meta);
  text.addEventListener("click", () => toast(st.note, 4500));
  const dest = routing()[s] || defaultRouting(L)[s];
  const b = document.createElement("button");
  b.type = "button";
  b.className = `rf-dest${UNITS[dest] ? " unit" : ""}`;
  b.textContent = UNITS[dest] ? UNITS[dest].short : POOLS[dest]?.name || dest;
  b.addEventListener("click", () => pickDestination(s));
  row.append(bar, text, b);
  return row;
}
/** The volume of a stream as produced, whether or not a unit then ate it. */
function producedVolume(s) {
  let v = (L.renewables || {})[s] || 0;
  if (CRUDES[L.crude].cuts[s]) v += FEED * CRUDES[L.crude].cuts[s];
  for (const unit of Object.values(R.units)) v += unit.outputs[s] || 0;
  return v;
}
/** The properties shown for a stream: the stream's own, with the crude's sulphur for straight-run cuts. */
function propsShown(s) {
  const st = STREAMS[s];
  const scale = CRUDES[L.crude].sulphur / 1.6;
  const straightRun = !!CRUDES[L.crude].cuts[s];
  return { ron: st.ron, cet: st.cet, s: st.s != null ? (straightRun ? st.s * scale : st.s) : null };
}
function pickDestination(s) {
  const st = STREAMS[s];
  $("pickTitle").textContent = st.name;
  $("pickNote").textContent = st.note;
  const body = $("pickBody");
  body.replaceChildren();
  const current = routing()[s];
  const units = destinations(L, s).filter(d => UNITS[d]), pools = destinations(L, s).filter(d => POOLS[d]);
  const head = t => { const h = document.createElement("div"); h.className = "head"; h.textContent = t; body.appendChild(h); };
  const now = R.margin;
  const option = (d, title, text) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = d === current ? "on" : "";
    const bb = document.createElement("b"); bb.textContent = title;
    // what this choice would do to the margin, with everything else as it is
    const delta = d === current ? null : evaluate(L, whatIf(s, d)).margin - now;
    if (delta != null) { const tag = document.createElement("em"); tag.className = `delta ${delta > 0.05 ? "up" : delta < -0.05 ? "down" : ""}`; tag.textContent = `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}`; bb.appendChild(tag); }
    const sp = document.createElement("span"); sp.textContent = text;
    b.append(bb, sp);
    b.addEventListener("click", () => { $("pickDlg").close(); setDestination(s, d); });
    body.appendChild(b);
  };
  if (units.length) { head("Units"); for (const u of units) option(u, UNITS[u].name, UNITS[u].purpose); }
  head("Pools");
  for (const p of pools) { const def = POOLS[p]; const spec = def.spec ? ` Spec: ${[def.spec.ronMin && `RON ≥ ${def.spec.ronMin}`, def.spec.cetMin && `cetane ≥ ${def.spec.cetMin}`, def.spec.sMax && `S ≤ ${fmtS(def.spec.sMax)}`, def.spec.jetOnly && "jet grade only"].filter(Boolean).join(", ")}.` : ""; option(p, `${def.name} · $${def.price}`, `${def.note}${spec}`); }
  if (!$("pickDlg").open) $("pickDlg").showModal();
}
function drawPools() {
  const box = $("pools");
  box.replaceChildren();
  const entries = Object.entries(R.pools).filter(([, p]) => p.vol > 0.05).sort((a, b) => b[1].vol * b[1].price - a[1].vol * a[1].price);
  for (const [id, p] of entries) {
    const def = POOLS[id], card = document.createElement("div");
    card.className = `rf-pool${p.inSpec ? "" : " off"}`;
    const name = document.createElement("div"); name.className = "name"; name.textContent = def.name + (p.soldAs !== id ? ` → sold as ${POOLS[p.soldAs].name.toLowerCase()}` : "");
    const vol = document.createElement("div"); vol.className = "vol"; vol.textContent = `${kbd(p.vol)} · $${p.price}`;
    const spec = document.createElement("div"); spec.className = "spec";
    const item = (label, ok) => { const b = document.createElement("b"); b.className = ok ? "ok" : "no"; b.textContent = `${ok ? "✓" : "✗"} ${label}`; spec.appendChild(b); };
    if (def.spec?.ronMin != null) item(`RON ${p.ron.toFixed(1)} (≥ ${def.spec.ronMin})`, p.ron >= def.spec.ronMin);
    if (def.spec?.cetMin != null) item(`cetane ${p.cet.toFixed(1)} (≥ ${def.spec.cetMin})`, p.cet >= def.spec.cetMin);
    if (def.spec?.sMax != null) item(`S ${fmtS(p.s)} (≤ ${fmtS(def.spec.sMax)})`, p.s <= def.spec.sMax);
    if (def.spec?.jetOnly) item("jet grade", true);
    if (!def.spec) { const sp = document.createElement("span"); sp.textContent = def.note; spec.appendChild(sp); }
    const parts = document.createElement("div"); parts.className = "parts";
    parts.textContent = Object.entries(p.parts).sort((a, b) => b[1] - a[1]).map(([s, v]) => `${STREAMS[s].short} ${v.toFixed(1)}`).join(" · ");
    card.append(name, vol, spec, parts);
    box.appendChild(card);
  }
  const issues = $("issues");
  issues.replaceChildren(...R.issues.map(t => { const li = document.createElement("li"); li.textContent = t; return li; }));
}
function unitCard(u) {
  const def = UNITS[u];
  $("cardTitle").textContent = `${def.name} (${def.short})`;
  const body = $("cardBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "purpose", def.purpose);
  for (const line of def.card) add("p", null, line);
  if (def.feeds.length) add("p", "facts", `Feeds: ${def.feeds.map(f => STREAMS[f].name.toLowerCase()).join(", ")}.`);
  if (def.yields) {
    const table = add("table");
    const feedsShown = Object.keys(def.yields);
    const tr = document.createElement("tr"); tr.innerHTML = `<th>Product</th>${feedsShown.map(f => `<th>from ${STREAMS[f].short}</th>`).join("")}`; table.appendChild(tr);
    const outs = [...new Set(feedsShown.flatMap(f => Object.keys(def.yields[f])))];
    for (const o of outs) { const r = document.createElement("tr"); r.innerHTML = `<td>${STREAMS[o].name}</td>${feedsShown.map(f => `<td>${def.yields[f][o] != null ? `${Math.round(def.yields[f][o] * 100)}%` : "–"}</td>`).join("")}`; table.appendChild(r); }
    if (u === "vdu") add("p", "facts", "Yields depend on the crude: this one lifts " + Math.round(CRUDES[L.crude].vgoShare * 100) + "% of its residue as vacuum gas oil.");
  }
  if (def.h2 && Object.keys(def.h2).length) {
    const h = Object.entries(def.h2).filter(([, v]) => v).map(([f, v]) => `${STREAMS[f].short} ${v > 0 ? "makes" : "uses"} ${Math.abs(v * 1000).toFixed(0)} scf/bbl`);
    if (h.length) add("p", "facts", `Hydrogen: ${h.join("; ")}.`);
  }
  add("p", "facts", `Operating cost about $${def.opex}/bbl of feed.`);
  const unit = R.units[u];
  if (unit) add("p", "facts", `Running at ${kbd(unit.feed)}: ${Object.entries(unit.outputs).map(([o, v]) => `${STREAMS[o].short} ${v.toFixed(1)}`).join(", ")}.`);
  if (!$("cardDlg").open) $("cardDlg").showModal();
}

// ---------- menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "stats", "Route every stream to a unit or a pool. Pools blend what they're given and must meet their spec, or they sell as something cheaper. Reach par with every pool in spec to finish a level. Tap any unit for its card.");
  const list = add("div", "rf-levels");
  for (const lv of LEVELS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = S.done[lv.id] ? "done" : "";
    const t = document.createElement("b"); t.textContent = `${lv.id}. ${lv.title}`;
    const r = document.createElement("span"); r.textContent = S.best[lv.id] != null ? `best ${money(S.best[lv.id])}/bbl${S.done[lv.id] ? " ✓" : ""}` : "";
    b.append(t, r);
    b.addEventListener("click", () => { $("menuDlg").close(); loadLevel(lv.id); });
    list.appendChild(b);
  }
  $("menuDlg").querySelector("h2").textContent = "Menu";
  const reset = add("button", "btn wide", "Reset this level's routing");
  reset.type = "button";
  reset.addEventListener("click", () => { $("menuDlg").close(); S.routing[L.id] = defaultRouting(L); save(); render(); });
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "refinery");
document.querySelector(".rf-mark").innerHTML = APPS.find(a => a.id === "refinery").logo;
for (const lv of LEVELS) { const o = document.createElement("option"); o.value = String(lv.id); o.textContent = `Level ${lv.id}`; $("level").appendChild(o); }
$("level").addEventListener("change", e => loadLevel(Number(e.target.value)));
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("pickClose").addEventListener("click", () => $("pickDlg").close());
$("cardClose").addEventListener("click", () => $("cardDlg").close());
$("tabStreams").addEventListener("click", () => showTab("streams"));
$("tabPools").addEventListener("click", () => showTab("pools"));
$("aboutBtn").addEventListener("click", about);
$("hintBtn").addEventListener("click", hint);

// for tests and debugging
window.__refinery = { get level() { return L; }, get par() { return par; }, get result() { return R; }, get routing() { return routing(); }, setDestination, loadLevel, chooseCrude };

loadLevel(S.level || 1);
