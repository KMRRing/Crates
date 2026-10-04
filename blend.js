// Blend: find the secret recipe from the lab's higher/lower/same verdicts. The engine (blend-engine.js) makes
// puzzles and compares trials; this file draws the table, the recipe and the history.
import { LEVELS, PROPS, makePuzzle, compare } from "./blend-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "blend:run", BEST = "blend:best", DAILY = "blend:daily";
const SWATCH = ["#D9531E", "#2F6FDE", "#2E9E5B", "#7A4BC9"];

let S = null;     // { seed, mode, level, trials: [{ recipe, feedback }], recipe (the one being built), done }
let P = null;     // the puzzle

const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const save = () => write(RUN, S);

function start(mode, level = $("level").value) {
  const seed = mode === "daily" ? today() : randomSeed();
  P = makePuzzle(seed, level);
  S = { seed, mode, level, trials: [], recipe: evenRecipe(P), done: false };
  save();
  history.replaceState(null, "", `${mode === "daily" ? `#d=${seed}` : `#s=${seed}`}&l=${level}`);
  render();
}
/** A starting recipe near even shares, on the grid. */
function evenRecipe(p) {
  const n = p.comps.length, base = Math.floor(100 / n / p.step) * p.step;
  const rec = Array(n).fill(base);
  rec[n - 1] = 100 - base * (n - 1);
  return rec;
}
function adjust(i, delta) {
  if (S.done) return;
  const rec = [...S.recipe], last = rec.length - 1;
  const next = rec[i] + delta;
  if (next < 0 || next > 100) return;
  const rest = rec[last] - delta;                  // the last component takes up the difference
  if (rest < 0 || rest > 100) return;
  rec[i] = next; rec[last] = rest;
  S.recipe = rec;
  save();
  render();
}
function sendToLab() {
  if (S.done) return;
  if (S.trials.some(t => t.recipe.every((v, i) => v === S.recipe[i]))) { toast("That trial's already been to the lab"); return; }
  const feedback = compare(P, S.recipe);
  S.trials.push({ recipe: [...S.recipe], feedback });
  if (feedback.every(v => v === 0)) {
    S.done = true;
    const n = S.trials.length;
    const best = S.mode === "daily" ? bestDaily(n) : bestEver(n);
    S.best = best;
  }
  save();
  render();
}
function bestEver(n) { const b = read(BEST, {}); b[S.level] = Math.min(b[S.level] || Infinity, n); write(BEST, b); return b[S.level]; }
function bestDaily(n) { const d = read(DAILY, {}); const k = `${today()}/${S.level}`; d[k] = Math.min(d[k] || Infinity, n); write(DAILY, d); return d[k]; }

// ---------- drawing ----------
function render() {
  const L = LEVELS[S.level];
  $("brief").textContent = `${P.comps.length} components, ${P.props.length} properties, steps of ${P.step}%`;
  $("count").textContent = S.done ? `Matched in ${S.trials.length}, par ${P.par}` : `Trial ${S.trials.length + 1} · par ${P.par}`;
  // the table
  const table = $("table");
  table.replaceChildren();
  const head = document.createElement("tr");
  head.innerHTML = `<th>Component</th>${P.props.map(p => `<th>${PROPS[p].name}${PROPS[p].unit ? ` (${PROPS[p].unit})` : ""}</th>`).join("")}`;
  table.appendChild(head);
  P.comps.forEach((c, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><i style="background:${SWATCH[i]}"></i>${c.name}</td>${P.props.map(p => `<td>${c[p]}</td>`).join("")}`;
    table.appendChild(tr);
  });
  // the recipe
  const box = $("recipe");
  box.replaceChildren();
  P.comps.forEach((c, i) => {
    const last = i === P.comps.length - 1;
    const row = document.createElement("div");
    row.className = `bl-row${last ? " rest" : ""}`;
    const name = document.createElement("div");
    name.className = "name";
    name.innerHTML = `<i style="background:${SWATCH[i]}"></i><span>${c.name}</span>`;
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.innerHTML = `<i style="width:${S.recipe[i]}%;background:${SWATCH[i]}"></i>`;
    const left = document.createElement("div");
    left.append(name, bar);
    const step = document.createElement("div");
    step.className = "bl-step";
    if (!last) {
      const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−"; minus.disabled = S.done || S.recipe[i] <= 0; minus.addEventListener("click", () => adjust(i, -P.step));
      const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.disabled = S.done || S.recipe[P.comps.length - 1] <= 0; plus.addEventListener("click", () => adjust(i, P.step));
      const b = document.createElement("b"); b.textContent = `${S.recipe[i]}%`;
      step.append(minus, b, plus);
    } else {
      const b = document.createElement("b"); b.textContent = `${S.recipe[i]}%`;
      step.appendChild(b);
    }
    row.append(left, step);
    box.appendChild(row);
  });
  $("labBtn").hidden = S.done;
  // the history
  const hist = $("history");
  hist.replaceChildren();
  $("historyLabel").hidden = !S.trials.length;
  S.trials.forEach((t, k) => {
    const li = document.createElement("li");
    const n = document.createElement("span"); n.className = "n"; n.textContent = String(k + 1);
    const rec = document.createElement("span"); rec.className = "rec"; rec.textContent = t.recipe.map(v => `${v}`).join(" / ");
    const fb = document.createElement("span"); fb.className = "fb";
    t.feedback.forEach((v, i) => { const s = document.createElement("span"); s.className = v > 0 ? "up" : v < 0 ? "down" : "same"; s.textContent = `${PROPS[P.props[i]].name.slice(0, 3)} ${v > 0 ? "↑" : v < 0 ? "↓" : "="}`; s.title = `${PROPS[P.props[i]].name}: your trial reads ${v > 0 ? "higher than" : v < 0 ? "lower than" : "the same as"} the sample`; fb.appendChild(s); });
    li.append(n, rec, fb);
    hist.appendChild(li);
  });
  const result = $("result");
  result.hidden = !S.done;
  if (S.done) {
    const n = S.trials.length, par = P.par;
    $("verdict").textContent = `Matched in ${n} ${n === 1 ? "trial" : "trials"}: ${n < par ? "under par" : n === par ? "on par" : `${n - par} over par`} (par ${par}). ${S.mode === "daily" ? "Today's" : "Your"} best on ${L.label.toLowerCase()}: ${S.best}.`;
  }
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
  const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  add("p", "stats", "A competitor's sample is a secret blend of the components in the table. Build a trial and send it to the lab: for each property it says only whether your trial reads higher, lower or the same as the sample. Blends mix linearly, so the table is all you need. Match the sample in as few trials as you can; par is a solver's count.");
  button("A new sample", () => confirmStart("random"));
  button("Today's sample", () => confirmStart("daily"));
  button("Copy a link to this one", copyLink);
  const best = read(BEST, {}), daily = read(DAILY, {})[`${today()}/${S.level}`];
  add("p", "stats", `${LEVELS[S.level].label}: ${best[S.level] ? `your best ${best[S.level]} trials` : "no match yet"}${daily != null ? `; today's best ${daily}` : ""}.`);
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (S && !S.done && S.trials.length > 0 && !confirm("Start a new sample? This one isn't matched.")) return;
  start(mode);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "blend");
document.querySelector(".bl-mark").innerHTML = APPS.find(a => a.id === "blend").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("labBtn").addEventListener("click", sendToLab);
$("nextBtn").addEventListener("click", () => start("random"));
$("level").addEventListener("change", () => confirmStart(S?.mode === "daily" ? "daily" : "random"));
window.addEventListener("hashchange", () => { const h = new URLSearchParams(location.hash.slice(1)); if (h.get("s") || h.get("d")) fromHash(h); });

function fromHash(h) {
  const seed = Number(h.get("d") || h.get("s")), mode = h.get("d") ? "daily" : "random", level = LEVELS[h.get("l")] ? h.get("l") : "easy";
  if (!seed) return false;
  if (S && S.seed === seed && S.mode === mode && S.level === level) return true;
  P = makePuzzle(seed, level);
  S = { seed, mode, level, trials: [], recipe: evenRecipe(P), done: false };
  save();
  $("level").value = level;
  render();
  return true;
}

// for tests and debugging
window.__blend = { get state() { return S; }, get puzzle() { return P; }, adjust, sendToLab, setRecipe: r => { S.recipe = r; render(); }, start };

S = read(RUN, null);
const hash = new URLSearchParams(location.hash.slice(1));
if (!fromHash(hash)) {
  if (!S || !LEVELS[S.level]) start("random", "easy");
  else { P = makePuzzle(S.seed, S.level); $("level").value = S.level; history.replaceState(null, "", `${S.mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`}&l=${S.level}`); render(); }
}
