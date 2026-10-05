// Blend: build an order to spec at the best margin. The engine (blend-engine.js) holds the components, the
// products and their specs, the blending maths and par; this file draws the order, the spec panel and the
// tank farm and keeps your blends.
import { COMPONENTS, PRODUCTS, PROPS, LEVELS, STEP, blendProps, blendCost, bioShare, margin, judge, solve, hint } from "./blend-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";

dropdown(document.getElementById("level"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
const SAVE = "blend2:save";

let S = read(SAVE, { level: 1, blends: {}, best: {}, done: {} });   // the blend per level (per cent per component), best margins, levels certified
let L = null;      // the level
let par = null;    // { margin, pct, feasible }

function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch { /* private mode */ } }
const euro = n => `${n < 0 ? "−" : ""}€${Math.abs(Math.round(n))}`;
const fmt = (p, v) => (v == null ? "–" : PROPS[p].unit === "ppm" && v >= 1000 ? `${(v / 10000).toFixed(2)}%` : Number.isInteger(v) ? String(v) : v.toFixed(p === "visc" || p === "oxy" || p === "benz" ? 2 : 1));
const limitText = (p, lim) => { const u = PROPS[p].unit; const f = v => (u === "ppm" && v >= 1000 ? `${v / 10000}%` : `${v}${u && u !== "ppm" ? ` ${u}` : u === "ppm" ? " ppm" : ""}`); return lim.min != null && lim.max != null ? `${f(lim.min)} – ${f(lim.max)}` : lim.min != null ? `≥ ${f(lim.min)}` : `≤ ${f(lim.max)}`; };

// ---------- levels ----------
function loadLevel(n) {
  L = LEVELS.find(l => l.id === n) || LEVELS[0];
  S.level = L.id;
  par = solve(L);
  if (!S.blends[L.id] || S.blends[L.id].length !== L.components.length) S.blends[L.id] = L.components.map((c, i) => (i === 0 ? 100 : 0));
  save();
  $("level").value = String(L.id);
  render();
}
const pct = () => S.blends[L.id];
function adjust(i, delta) {
  const p = pct(), next = p[i] + delta;
  if (next < 0 || next > 100) return;
  if (delta > 0 && L.max?.[L.components[i]] != null && next > L.max[L.components[i]]) { toast(`${COMPONENTS[L.components[i]].name} is limited to ${L.max[L.components[i]]}% here`); return; }
  p[i] = next;
  save();
  render();
}
function certify() {
  const p = pct(), total = p.reduce((a, b) => a + b, 0);
  if (total !== 100) { toast("The blend has to add up to 100%"); return; }
  const props = blendProps(L.components, p), verdict = judge(L.product, props);
  if (!verdict.every(x => x.ok)) { toast("Something's still off spec"); return; }
  const m = margin(L.product, L.components, p);
  S.best[L.id] = Math.max(S.best[L.id] ?? -Infinity, m);
  if (m >= par.margin - 5) S.done[L.id] = true;
  save();
  render();
  toast(m >= par.margin - 5 ? `Certified at ${euro(m)}/m³: par.` : `Certified at ${euro(m)}/m³. Par is ${euro(par.margin)}: there's a cheaper way to pass.`, 4500);
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
  else if (m >= par.margin - 5) { v.className = "bl-verdict good"; v.textContent = `On spec at par.${S.done[L.id] ? " Certified." : ""}`; }
  else { v.className = "bl-verdict"; v.textContent = `On spec. ${euro(par.margin - m)}/m³ short of par: a cheaper blend passes too.`; }
  $("certifyBtn").disabled = !passing;
  $("certifyBtn").textContent = S.done[L.id] ? "Certified ✓" : "Certify";
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
  add("p", "stats", "An order comes in: a product with its specification, and a tank farm of components with their properties and prices. Set each component in steps of 5% until the blend adds up to 100 and every line of the spec passes, at the best margin you can; par is the best blend there is. Properties blend the way they do in practice: flash point, cold flow and viscosity by index, so a little of the wrong component moves them a long way. Tap any spec line for what it is and which components move it.");
  const list = add("div", "bl-levels");
  for (const lv of LEVELS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = S.done[lv.id] ? "done" : "";
    const t = document.createElement("b"); t.textContent = `${lv.id}. ${lv.title}`;
    const r = document.createElement("span"); r.textContent = S.best[lv.id] != null ? `best ${euro(S.best[lv.id])}/m³${S.done[lv.id] ? " ✓" : ""}` : "";
    b.append(t, r);
    b.addEventListener("click", () => { $("menuDlg").close(); loadLevel(lv.id); });
    list.appendChild(b);
  }
  const reset = add("button", "btn wide", "Reset this order's blend");
  reset.type = "button";
  reset.addEventListener("click", () => { $("menuDlg").close(); S.blends[L.id] = L.components.map((c, i) => (i === 0 ? 100 : 0)); save(); render(); });
  if (!$("menuDlg").open) $("menuDlg").showModal();
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
window.__blend = { get level() { return L; }, get par() { return par; }, get pct() { return pct(); }, adjust, certify, loadLevel, setBlend: arr => { S.blends[L.id] = [...arr]; save(); render(); } };

loadLevel(S.level || 1);
