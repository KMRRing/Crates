// Survey: buy readings on a concession, mark the ore, file a claim. The engine (survey-engine.js) makes the
// concessions and settles readings; this file draws the board and keeps the run.
import { SIZES, TOOLS, WRONG_CLAIM, makeConcession, newRun, probe, claim } from "./survey-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";

dropdown(document.getElementById("size"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
const RUN = "survey:run", BEST = "survey:best", DAILY = "survey:daily";

let S = null;      // { seed, mode, size, run: { credits, readings, ore: [keys], barren: [keys], claims, done }, result }
let C = null;      // the concession
let tool = "mark";

const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const key = (x, y) => `${x},${y}`;

/** The run as the engine wants it (sets) and as it's saved (arrays). */
const live = () => ({ ...S.run, ore: new Set(S.run.ore), barren: new Set(S.run.barren) });
const keep = run => { S.run = { ...run, ore: [...run.ore], barren: [...run.barren] }; write(RUN, S); };

function start(mode, size = $("size").value) {
  const seed = mode === "daily" ? today() : randomSeed();
  C = makeConcession(seed, size);
  S = { seed, mode, size, run: null, result: null };
  keep(newRun(C));
  history.replaceState(null, "", `${mode === "daily" ? `#d=${seed}` : `#s=${seed}`}&z=${size}`);
  render();
}
function load() {
  C = makeConcession(S.seed, S.size);
  $("size").value = S.size;
  render();
}

// ---------- taps ----------
function tapLine(kind, index) {
  if (S.run.done) return;
  const run = live();
  if (run.readings.some(r => r.tool === "line" && r.a === kind && r.b === index)) return;
  if (run.credits < TOOLS.line.cost) { toast("Not enough credits for a seismic line"); return; }
  probe(C, run, "line", kind, index);
  keep(run);
  render();
}
function tapCell(x, y) {
  if (S.run.done) return;
  const run = live(), k = key(x, y);
  const drilled = run.readings.find(r => r.tool === "drill" && r.a === x && r.b === y);
  if (tool === "mark") {
    if (drilled) return;
    if (run.ore.has(k)) { run.ore.delete(k); run.barren.add(k); }
    else if (run.barren.has(k)) run.barren.delete(k);
    else run.ore.add(k);
  } else if (tool === "magnet") {
    if (run.readings.some(r => r.tool === "magnet" && r.a === x && r.b === y)) return;
    if (run.credits < TOOLS.magnet.cost) { toast("Not enough credits for the magnetometer"); return; }
    probe(C, run, "magnet", x, y);
  } else {
    if (drilled) return;
    if (run.credits < TOOLS.drill.cost) { toast("Not enough credits to drill"); return; }
    const v = probe(C, run, "drill", x, y);
    run.ore.delete(k); run.barren.delete(k);
    if (v === 1) run.ore.add(k); else run.barren.add(k);
  }
  keep(run);
  render();
}
function fileClaim() {
  if (S.run.done) return;
  const run = live();
  if (run.ore.size !== C.ore.size) { toast(`Mark exactly ${C.ore.size} cells as ore first`); return; }
  const right = claim(C, run);
  keep(run);
  if (right) {
    S.result = { credits: run.credits, claims: run.claims };
    const best = S.mode === "daily" ? bestDaily(run.credits) : bestEver(run.credits);
    S.result.best = best;
    write(RUN, S);
  } else {
    toast(`Claim refused: −${WRONG_CLAIM} credits`);
    navigator.vibrate?.(70);
  }
  render();
}
function bestEver(credits) { const b = read(BEST, {}); b[S.size] = Math.max(b[S.size] || 0, credits); write(BEST, b); return b[S.size]; }
function bestDaily(credits) { const d = read(DAILY, {}); const k = `${today()}/${S.size}`; d[k] = Math.max(d[k] || 0, credits); write(DAILY, d); return d[k]; }

// ---------- drawing ----------
function render() {
  const run = S.run, n = C.n;
  $("brief").textContent = `${C.ore.size} ore cells in ${C.bodies.length} bodies of 2–3`;
  $("credits").textContent = run.credits;
  const board = $("board");
  board.style.setProperty("--cols", `repeat(${n + 1}, minmax(0, 1fr))`);
  board.replaceChildren();
  const lineReading = (kind, i) => run.readings.find(r => r.tool === "line" && r.a === kind && r.b === i);
  const corner = document.createElement("div"); corner.className = "sv-head sv-corner"; board.appendChild(corner);
  for (let x = 0; x < n; x++) board.appendChild(headButton("col", x, lineReading("col", x)));
  for (let y = 0; y < n; y++) {
    board.appendChild(headButton("row", y, lineReading("row", y)));
    for (let x = 0; x < n; x++) board.appendChild(cellButton(x, y));
  }
  for (const b of $("tools").children) b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
  const marked = run.ore.length;
  $("hint").textContent = run.done ? "" : tool === "mark" ? `Tap a cell to mark it ore, again for barren, again to clear. ${marked} of ${C.ore.size} marked. Tap a row or column header for a seismic line (${TOOLS.line.cost} credits).`
    : tool === "magnet" ? `Tap a cell: how many ore cells in the 3×3 around it (${TOOLS.magnet.cost} credits).` : `Tap a cell to drill it: ore or not, for certain (${TOOLS.drill.cost} credits).`;
  $("claimBtn").hidden = run.done;
  $("claimBtn").disabled = marked !== C.ore.size;
  $("claimBtn").textContent = marked === C.ore.size ? "File the claim" : `File the claim (${marked} of ${C.ore.size} marked)`;
  $("tools").hidden = run.done;
  const result = $("result");
  result.hidden = !run.done;
  if (run.done) {
    const v = $("verdict");
    v.className = "sv-verdict good";
    v.textContent = `Claim accepted with ${run.credits} credits left${run.claims > 1 ? ` after ${run.claims} claims` : ""}. ${S.mode === "daily" ? "Today's" : "Your"} best on ${SIZES[S.size].label.toLowerCase()}: ${S.result?.best ?? run.credits}.`;
  }
}
function headButton(kind, i, reading) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `sv-head${reading ? " read" : ""}`;
  b.setAttribute("aria-label", `${kind === "row" ? "Row" : "Column"} ${i + 1}: seismic line`);
  if (reading) b.textContent = String(reading.value);
  else { const s = document.createElement("small"); s.textContent = kind === "row" ? "→" : "↓"; b.appendChild(s); }
  b.addEventListener("click", () => tapLine(kind, i));
  return b;
}
function cellButton(x, y) {
  const run = S.run, k = key(x, y);
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.cell = k;
  const drilled = run.readings.find(r => r.tool === "drill" && r.a === x && r.b === y);
  const mag = run.readings.find(r => r.tool === "magnet" && r.a === x && r.b === y);
  let cls = "sv-cell";
  if (run.done) {
    if (C.ore.has(k)) cls += " truth-ore";
  } else if (drilled) cls += drilled.value ? " drilled-ore" : " drilled-barren";
  else if (run.ore.includes(k)) cls += " ore-mark";
  else if (run.barren.includes(k)) cls += " barren-mark";
  if (mag) { cls += " magnet"; const m = document.createElement("span"); m.className = "mag"; m.textContent = String(mag.value); b.appendChild(m); }
  b.className = cls;
  b.setAttribute("aria-label", `Cell ${x + 1}, ${y + 1}`);
  b.addEventListener("click", () => tapCell(x, y));
  return b;
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
  add("p", "stats", "Ore lies in a few bodies of 2–3 connected cells that never touch, corners included. Buy readings: a seismic line along a row or column (how many ore cells on it), the magnetometer (how many in the 3×3 around a cell), or a drill (the truth about one cell). Mark the ore and file the claim; what you have left is your score. A wrong claim costs 10.");
  button("A new concession", () => confirmStart("random"));
  button("Today's concession", () => confirmStart("daily"));
  button("Copy a link to this one", copyLink);
  const best = read(BEST, {}), daily = read(DAILY, {})[`${today()}/${S.size}`];
  add("p", "stats", `${SIZES[S.size].label}: ${best[S.size] ? `your best ${best[S.size]} credits left` : "no claim filed yet"}${daily != null ? `; today's best ${daily}` : ""}.`);
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (S && !S.run.done && S.run.readings.length > 0 && !confirm("Start a new concession? This one isn't claimed.")) return;
  start(mode);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "survey");
document.querySelector(".sv-mark").innerHTML = APPS.find(a => a.id === "survey").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("claimBtn").addEventListener("click", fileClaim);
$("nextBtn").addEventListener("click", () => start("random"));
$("size").addEventListener("change", e => confirmStart(S?.mode === "daily" ? "daily" : "random"));
for (const b of $("tools").children) b.addEventListener("click", () => { tool = b.dataset.tool; render(); });
window.addEventListener("hashchange", () => { const h = new URLSearchParams(location.hash.slice(1)); if (h.get("s") || h.get("d")) fromHash(h); });

function fromHash(h) {
  const seed = Number(h.get("d") || h.get("s")), mode = h.get("d") ? "daily" : "random", size = SIZES[h.get("z")] ? h.get("z") : "small";
  if (!seed) return false;
  if (S && S.seed === seed && S.mode === mode && S.size === size) return true;
  C = makeConcession(seed, size);
  S = { seed, mode, size, run: null, result: null };
  keep(newRun(C));
  $("size").value = size;
  render();
  return true;
}

// for tests and debugging
window.__survey = { get state() { return S; }, get concession() { return C; }, tapLine, tapCell, fileClaim, setTool: t => { tool = t; render(); }, start };

S = read(RUN, null);
const hash = new URLSearchParams(location.hash.slice(1));
if (!fromHash(hash)) {
  if (!S || !SIZES[S.size]) start("random", "small");
  else { history.replaceState(null, "", `${S.mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`}&z=${S.size}`); load(); }
}
