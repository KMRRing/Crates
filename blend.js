// Blend: build an order to spec at the best margin. The engine (blend-engine.js) holds the components, the
// products and their specs, the blending maths and par; this file draws the order, the spec panel and the
// tank farm and keeps your blends. Together, the same order for everyone at the table (duel.js).
import { COMPONENTS, PRODUCTS, PROPS, LEVELS, STEP, blendProps, blendCost, bioShare, margin, judge, solve, hint } from "./blend-engine.js";
import { noteStars } from "./suite.js";
import { roundOver } from "./random.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, action, mirror, choice } from "./menu.js";
import { createDuel } from "./duel.js";
import { createParcels } from "./blend-parcels-ui.js";

const levelDD = dropdown(document.getElementById("level"));   // the header dropdowns in the suite's style (see dropdown.js): the orders', and the parcels' desks
const deskDD = dropdown(document.getElementById("desk"));

const $ = id => document.getElementById(id);
const SAVE = "blend2:save", MODE = "blend2:mode";

let S = read(SAVE, { level: 1, blends: {}, best: {}, done: {} });   // the blend per level (per cent per component), best margins, levels certified
let L = null;      // the level
let par = null;    // { margin, pct, feasible }
let D = null;      // a match's blend (duel.js), kept apart from yours: { level, pct, done, margin }
let mode = "orders";   // what is on show: the orders, or the parcels (blend-parcels-ui.js); a match is always the orders
let chosen = "orders"; // the mode you chose, kept, which a match leaves alone

function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch { /* private mode */ } }
const euro = n => `${n < 0 ? "−" : ""}€${Math.abs(Math.round(n))}`;
const fmt = (p, v) => (v == null ? "–" : PROPS[p].unit === "ppm" && v >= 1000 ? `${(v / 10000).toFixed(2)}%` : Number.isInteger(v) ? String(v) : v.toFixed(p === "visc" || p === "oxy" || p === "benz" ? 2 : 1));
const limitText = (p, lim) => { const u = PROPS[p].unit; const f = v => (u === "ppm" && v >= 1000 ? `${v / 10000}%` : `${v}${u && u !== "ppm" ? ` ${u}` : u === "ppm" ? " ppm" : ""}`); return lim.min != null && lim.max != null ? `${f(lim.min)} – ${f(lim.max)}` : lim.min != null ? `≥ ${f(lim.min)}` : `≤ ${f(lim.max)}`; };

// ---------- levels ----------
function loadLevel(n) {
  if (duel.on) { if (!duel.newMatch()) $("level").value = String(L.id); return; }   // a new match on that order, for everyone
  L = LEVELS.find(l => l.id === n) || LEVELS[0];
  S.level = L.id;
  par = solve(L);
  if (!S.blends[L.id] || S.blends[L.id].length !== L.components.length) S.blends[L.id] = L.components.map((c, i) => (i === 0 ? 100 : 0));
  save();
  $("level").value = String(L.id);
  render();
}
const pct = () => (D ? D.pct : S.blends[L.id]);
/** A change to the blend in hand: yours into your save, a match's into its own keeping and to the table. */
const keep = () => { if (D) duel.keep(D); else save(); };
function adjust(i, delta) {
  if (D?.done || (duel.on && !D)) return;                  // certified at a match: it stands
  const p = pct(), next = p[i] + delta;
  if (next < 0 || next > 100) return;
  if (delta > 0 && L.max?.[L.components[i]] != null && next > L.max[L.components[i]]) { toast(`${COMPONENTS[L.components[i]].name} is limited to ${L.max[L.components[i]]}% here`); return; }
  p[i] = next;
  keep();
  render();
}
function certify() {
  if (D?.done) return;
  const p = pct(), total = p.reduce((a, b) => a + b, 0);
  if (total !== 100) { toast("The blend has to add up to 100%"); return; }
  const props = blendProps(L.components, p), verdict = judge(L.product, props);
  if (!verdict.every(x => x.ok)) { toast("Something's still off spec"); return; }
  const m = margin(L.product, L.components, p);
  if (D) {                                                  // a match: certifying is your answer, and final
    if (!confirm(`Certify at ${euro(m)}/m³? It's your answer for the match: you can't change it after.`)) return;
    D.done = true; D.margin = m;
    tell(true);
    keep();
    render();
    return;
  }
  S.best[L.id] = Math.max(S.best[L.id] ?? -Infinity, m);
  if (m >= par.margin - 5) S.done[L.id] = true;
  // stars: on spec one, within 5% of par (at least €15/m³) two, at par (certified) three
  const st = m >= par.margin - 5 ? 3 : m >= par.margin - Math.max(15, 0.05 * Math.abs(par.margin)) ? 2 : 1;
  S.stars = { ...(S.stars || {}), [L.id]: Math.max(S.stars?.[L.id] || 0, st) };
  noteStars("blend", starsAll());
  save();
  render();
  toast(m >= par.margin - 5 ? `Certified at ${euro(m)}/m³: par.` : `Certified at ${euro(m)}/m³. Par is ${euro(par.margin)}: there's a cheaper way to pass.`, 4500);
  roundOver("blend");
}
function giveHint() {
  const h = hint(L, pct());
  if (!h) { toast(par ? "You're at the best blend on the grid." : "Nothing to suggest."); return; }
  const props = blendProps(L.components, pct()), failing = judge(L.product, props).filter(x => !x.ok);
  const why = failing.length ? ` to fix ${failing.map(x => PROPS[x.p].name).join(", ")}` : ` for ${euro(h.margin)}/m³`;
  toast(`Move 5% from ${COMPONENTS[h.down].name} to ${COMPONENTS[h.up].name}${why}.`, 5000);
}

// ---------- drawing ----------
function render() {
  if (duel.on && !D) { lobby(); return; }
  const p = pct(), total = p.reduce((a, b) => a + b, 0);
  const product = PRODUCTS[L.product];
  $("title").textContent = `${L.id}. ${L.title}`;
  $("product").textContent = `${product.name} · sells at €${product.price}/m³${product.credit ? `, plus €${product.credit} per m³ of renewable content` : ""}`;
  $("intro").textContent = `${L.intro} ${product.note}`;
  const props = blendProps(L.components, p), verdict = judge(L.product, props);
  const passing = total === 100 && verdict.every(x => x.ok);
  const m = margin(L.product, L.components, p);
  // the margin against par
  const mb = $("margin");
  mb.textContent = `${euro(m)}/m³`;
  mb.className = passing ? (m >= 0 ? "good" : "bad") : "";
  $("par").textContent = `par ${euro(par.margin)}`;
  const lo = Math.min(-50, m - 20), hi = Math.max(par.margin + 30, m + 20);
  const at = v => `${Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1)}%`;
  $("marginBar").style.width = at(m);
  $("parTick").style.left = at(par.margin);
  $("costline").textContent = `Components ${euro(blendCost(L.components, p))}/m³ · revenue ${euro(product.price + (product.credit || 0) * bioShare(L.components, p))}/m³${product.credit ? ` (${Math.round(bioShare(L.components, p) * 100)}% renewable)` : ""}`;
  const v = $("verdict");
  const failing = verdict.filter(x => !x.ok);
  if (total !== 100) { v.className = "bl-verdict bad"; v.textContent = `The blend adds up to ${total}%, not 100.`; }
  else if (failing.length) { v.className = "bl-verdict bad"; v.textContent = `Off spec: ${failing.map(x => PROPS[x.p].name).join(", ")}.`; }
  else if (m >= par.margin - 5) { v.className = "bl-verdict good"; v.textContent = `On spec at par.${(D ? D.done : S.done[L.id]) ? " Certified." : ""}`; }
  else { v.className = "bl-verdict"; v.textContent = `On spec. ${euro(par.margin - m)}/m³ short of par: a cheaper blend passes too.`; }
  $("certifyBtn").disabled = !passing || !!D?.done;
  $("certifyBtn").textContent = (D ? D.done : S.done[L.id]) ? "Certified ✓" : "Certify";
  $("hintBtn").hidden = !!D;                                 // no hints at a match
  $("hintBtn").parentElement.classList.toggle("nohint", !!D);
  $("costline").hidden = !!D;                                // the others' margins take its line
  // the specification, a chip a line in the spec's order, so nothing moves while you blend: red is off spec
  const chips = $("spec");
  chips.replaceChildren();
  for (const x of verdict) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `bl-chip ${x.value == null ? "" : x.ok ? "ok" : "no"}`;
    chip.innerHTML = `${PROPS[x.p].name} <b>${valueText(x)}</b>${x.value == null ? "" : x.ok ? " ✓" : " ✗"}`;
    chip.setAttribute("aria-label", `${PROPS[x.p].name}: ${valueText(x)}, limit ${limitText(x.p, { min: x.min, max: x.max })}, ${x.ok ? "on spec" : "off spec"}`);
    chip.addEventListener("click", () => why(x.p, x));
    chips.appendChild(chip);
  }
  // the tank farm
  const box = $("components");
  box.replaceChildren();
  L.components.forEach((id, i) => {
    const c = COMPONENTS[id];
    const row = document.createElement("div");
    row.className = "bl-row";
    const left = document.createElement("div");
    const name = document.createElement("div"); name.className = "name";
    name.textContent = c.name;
    if (c.bio) { const b = document.createElement("span"); b.className = "bio"; b.textContent = c.bio > 1 ? "renewable ×2" : "renewable"; name.appendChild(b); }
    name.addEventListener("click", () => whyComponent(id));
    const meta = document.createElement("div"); meta.className = "meta";
    const keys = product.order.filter(k => c[k] != null).slice(0, 4);
    meta.textContent = `€${c.price}/m³ · ${keys.map(k => `${PROPS[k].name} ${fmt(k, c[k])}`).join(" · ")}${L.max?.[id] != null ? ` · max ${L.max[id]}%` : ""}`;
    const bar = document.createElement("div"); bar.className = "bar"; bar.innerHTML = `<i style="width:${p[i]}%"></i>`;
    left.append(name, meta, bar);
    const step = document.createElement("div"); step.className = "bl-step";
    const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−"; minus.disabled = p[i] <= 0; minus.addEventListener("click", () => adjust(i, -STEP));
    const val = document.createElement("b"); val.textContent = `${p[i]}%`;
    const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.disabled = p[i] >= 100 || total >= 100 && false; plus.addEventListener("click", () => adjust(i, STEP));
    step.append(minus, val, plus);
    row.append(left, step);
    box.appendChild(row);
  });
  const t = $("total");
  t.className = `bl-total${total === 100 ? "" : " no"}`;
  t.textContent = `Total ${total}%${total === 100 ? "" : total > 100 ? ": take some out" : ": fill it up"}`;
}
/** A spec line's value with its unit: "52 kPa", "8 ppm". */
const valueText = x => `${fmt(x.p, x.value)}${x.value != null && PROPS[x.p].unit && PROPS[x.p].unit !== "ppm" ? ` ${PROPS[x.p].unit}` : x.value != null && PROPS[x.p].unit === "ppm" && x.value < 1000 ? " ppm" : ""}`;
function why(p, x = null) {
  $("whyTitle").textContent = PROPS[p].name;
  $("whyBody").textContent = `${x ? `Spec ${limitText(p, { min: x.min, max: x.max })}; this blend ${valueText(x)}${x.value == null ? "" : x.ok ? ", on spec" : ", off spec"}. ` : ""}${PROPS[p].why}`;
  if (!$("whyDlg").open) $("whyDlg").showModal();
}
/** The order's story, behind the About button. */
function about() {
  $("whyTitle").textContent = `${L.id}. ${L.title}`;
  $("whyBody").textContent = $("intro").textContent;
  if (!$("whyDlg").open) $("whyDlg").showModal();
}
function whyComponent(id) {
  const c = COMPONENTS[id];
  $("whyTitle").textContent = c.name;
  const facts = Object.keys(PROPS).filter(k => c[k] != null).map(k => `${PROPS[k].name} ${fmt(k, c[k])}${PROPS[k].unit && PROPS[k].unit !== "ppm" ? ` ${PROPS[k].unit}` : PROPS[k].unit === "ppm" && c[k] < 1000 ? " ppm" : ""}`);
  $("whyBody").textContent = `${c.note} €${c.price}/m³. ${facts.join(" · ")}.`;
  if (!$("whyDlg").open) $("whyDlg").showModal();
}

// ---------- together: the same order for everyone at the table (duel.js) ----------
// Everyone at the table gets the match's order, the same product, spec and tank farm, starting from the same blend,
// and blends on their own phone; par shows as ever, the hint doesn't. Certify is your answer, once: the highest margin
// wins, then the quicker. The others show where the cost line was: blending, or certified at their margin. Your own
// blends, bests and stars stay as they were.
const duel = createDuel({
  game: "blend", name: "Blend", accent: "--bl-in", line: $("rival"), toast,
  deal: () => ({ seed: Math.floor(Math.random() * 2 ** 31), level: Number($("level").value) || L?.id || 1 }),   // the header's order
  describe: m => { const lv = LEVELS.find(l => l.id === m.level) || LEVELS[0]; return `Order ${lv.id}, ${lv.title}: the same order for everyone, certified once`; },
  play: (match, { kept }) => {
    L = LEVELS.find(l => l.id === match.level) || LEVELS[0];
    par = solve(L);
    $("level").value = String(L.id);
    D = kept?.level === L.id && kept.pct?.length === L.components.length ? kept : { level: L.id, pct: L.components.map((c, i) => (i === 0 ? 100 : 0)), done: false, margin: null };
    keep(); render(); tell(D.done);
  },
  onLobby: match => { D = null; L = LEVELS.find(l => l.id === match.level) || LEVELS[0]; par = solve(L); $("level").value = String(L.id); render(); },
  onLeave: () => { D = null; showMode(chosen); if (chosen === "parcels") parcels.enter(); else loadLevel(S.level || 1); },
});
/** What the table sees of this blend: blending, or certified at a margin. */
function tell(done = false) {
  if (!D) return;
  duel.report(done ? { score: Math.round(D.margin), text: `${euro(D.margin)}/m³`, done: true } : { score: -1e6, text: "blending" });
}
/** The order before a match: its brief, nothing to blend yet. */
function lobby() {
  const product = PRODUCTS[L.product];
  $("title").textContent = `${L.id}. ${L.title}`;
  $("product").textContent = `${product.name} · sells at €${product.price}/m³`;
  $("margin").textContent = "–"; $("margin").className = "";
  $("par").textContent = `par ${euro(par.margin)}`;
  $("verdict").className = "bl-verdict"; $("verdict").textContent = "The same order for everyone.";
  $("certifyBtn").disabled = true; $("hintBtn").hidden = true; $("hintBtn").parentElement.classList.add("nohint"); $("costline").hidden = true;
  $("spec").replaceChildren(); $("components").replaceChildren(); $("total").textContent = "";
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
// the menu: Content (the orders in order, each with its best and a tick once done: a progression), Settings
// (reset this order's blend)
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {                                              // a match: the table's own, and the order the next one deals
    duel.menu(part(body, "together"));
    part(body, "content").append(mirror("Order", $("level")));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  const content = part(body, "content");
  content.append(choice("Mode", [["orders", "Orders"], ["parcels", "Parcels"]], mode, m => { $("menuDlg").close(); chooseMode(m); }));
  if (mode === "parcels") {
    parcels.menu(part(body, "play"), content, () => $("menuDlg").close());
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  const list = document.createElement("div");
  list.className = "bl-levels";
  for (const lv of LEVELS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = S.done[lv.id] ? "done" : "";
    if (lv.id === L.id) b.setAttribute("aria-current", "true");
    const t = document.createElement("b"); t.textContent = `${lv.id}. ${lv.title}`;
    const r = document.createElement("span"); r.textContent = S.best[lv.id] != null ? `best ${euro(S.best[lv.id])}/m³ ${"★".repeat(starsOf(lv.id))}${"☆".repeat(3 - starsOf(lv.id))}` : "";
    b.append(t, r);
    b.addEventListener("click", () => { $("menuDlg").close(); loadLevel(lv.id); });
    list.appendChild(b);
  }
  content.append(list);
  part(body, "settings").append(action("Reset this order's blend", () => { S.blends[L.id] = L.components.map((c, i) => (i === 0 ? 100 : 0)); save(); render(); }, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the second mode: parcels (blend-parcels-ui.js) ----------
const parcels = createParcels({
  explain: (title, body) => { $("whyTitle").textContent = title; $("whyBody").textContent = body; if (!$("whyDlg").open) $("whyDlg").showModal(); },
  synced: () => deskDD.sync(),
  starred: () => { noteStars("blend", starsAll()); roundOver("blend"); },   // a desk's tanks closed: its day is final
});
/** Puts one mode's parts on the page and the other's away, and the header's order or desk with them. */
function showMode(m) {
  mode = m;
  const on = m === "parcels";
  for (const el of document.querySelectorAll(".bl-order, .bl-margin, .bl-spec-box, .bl-farm")) el.hidden = on;
  for (const el of document.querySelectorAll(".bp")) el.hidden = !on;
  $("level").hidden = on;
  $("desk").hidden = !on;
  levelDD.sync();
  deskDD.sync();
}
/** Switches mode from the menu, and keeps the choice. */
function chooseMode(m) {
  if (m === mode) return;
  chosen = m;
  try { localStorage.setItem(MODE, JSON.stringify(m)); } catch { /* private mode */ }
  showMode(m);
  if (m === "parcels") parcels.enter(); else loadLevel(S.level || 1);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "blend");
document.querySelector(".bl-mark").innerHTML = APPS.find(a => a.id === "blend").logo;
for (const lv of LEVELS) { const o = document.createElement("option"); o.value = String(lv.id); o.textContent = `Order ${lv.id}`; $("level").appendChild(o); }
$("level").addEventListener("change", e => loadLevel(Number(e.target.value)));
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("whyClose").addEventListener("click", () => $("whyDlg").close());
$("aboutBtn").addEventListener("click", about);
$("certifyBtn").addEventListener("click", certify);
$("hintBtn").addEventListener("click", giveHint);

// for tests and debugging
window.__blend = { get level() { return L; }, get par() { return par; }, get pct() { return pct(); }, adjust, certify, loadLevel, setBlend: arr => { if (D) D.pct = [...arr]; else S.blends[L.id] = [...arr]; keep(); render(); }, duel, parcels };

// a match in the address: its order, with your own blend left where it was
chosen = read(MODE, "orders") === "parcels" ? "parcels" : "orders";
if (duel.inAddress) { L = LEVELS.find(l => l.id === (S.level || 1)) || LEVELS[0]; par = solve(L); duel.join().then(ok => { if (!ok) loadLevel(S.level || 1); }); }
else if (chosen === "parcels") { showMode("parcels"); parcels.enter(); }
else loadLevel(S.level || 1);
document.addEventListener("visibilitychange", () => { if (!document.hidden) duel.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
// stars collected: an order's stars, or for one certified before there were stars three, and one for any on-spec best
function starsOf(id) { return S.stars?.[id] || (S.done[id] ? 3 : S.best[id] != null ? 1 : 0); }
function starsAll() { return LEVELS.reduce((n, l) => n + starsOf(l.id), 0) + parcels.stars; }
noteStars("blend", starsAll());
