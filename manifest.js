// Manifest: a stack of containers is shown, then it's gone and you're asked about it. The engine
// (manifest-engine.js) makes the rounds; this file shows the views and takes the answers.
import { LIVES, COLOURS, VIEWS, makeRound, points, cubeFaces, drawOrder, isoPoint } from "./manifest-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "manifest:run", BEST = "manifest:best", DAILY = "manifest:daily";
const SVG = "http://www.w3.org/2000/svg";

let S = null;          // { seed, mode, round, score, lives, right, phase: "show" | "ask" | "result" | "over", q (question index) }
let R = null;          // the current round from the engine
let showTimer = null;

const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const save = () => write(RUN, S);

// ---------- the run ----------
function start(mode) {
  S = { seed: mode === "daily" ? today() : randomSeed(), mode, round: 1, score: 0, lives: LIVES, right: 0, phase: "show", q: 0 };
  save();
  history.replaceState(null, "", mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`);
  showRound();
}
/** Shows the round's stack for the level's time, then asks. */
function showRound() {
  R = makeRound(S.seed, S.round);
  S.phase = "show";
  S.q = 0;
  save();
  drawHud();
  $("title").textContent = `Round ${S.round} · ${VIEWS[R.view]}${R.changed ? " · spot the change" : ""}`;
  $("question").hidden = true;
  $("answers").replaceChildren();
  $("verdict").hidden = true;
  $("goBtn").hidden = true;
  const view = $("view");
  view.replaceChildren(...panelsFor(R.view, R.cells, {}));
  const timer = $("timer");
  timer.hidden = false;
  timer.style.setProperty("--mf-ms", `${R.level.exposure}ms`);
  timer.classList.remove("run"); void timer.offsetWidth; timer.classList.add("run");
  clearTimeout(showTimer);
  showTimer = setTimeout(ask, R.level.exposure);
}
/** The question: the stack is gone (or, for a change round, back with one container changed). */
function ask() {
  S.phase = "ask";
  save();
  $("timer").hidden = true;
  const q = R.questions[S.q];
  $("question").hidden = false;
  $("question").textContent = q.text;
  $("verdict").hidden = true;
  $("goBtn").hidden = true;
  const view = $("view"), answers = $("answers");
  answers.replaceChildren();
  answers.className = `mf-answers${q.kind === "colour" ? " colours" : ""}`;
  if (q.kind === "cell") {
    view.replaceChildren(...panelsFor(R.view, R.changed, { tap: key => answer(key) }));
  } else {
    view.replaceChildren(...panelsFor(R.view, R.cells, { blank: true, mark: q.cell }));
    for (const opt of q.options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mf-chip${q.kind === "colour" ? " colour" : ""}`;
      if (q.kind === "colour") { const i = document.createElement("i"); i.style.background = COLOURS[opt - 1].hex; b.append(i, COLOURS[opt - 1].name); }
      else b.textContent = String(opt);
      b.dataset.value = String(opt);
      b.addEventListener("click", () => answer(opt));
      answers.appendChild(b);
    }
  }
}
function answer(given) {
  if (S.phase !== "ask") return;
  const q = R.questions[S.q], right = String(given) === String(q.answer);
  S.phase = "result";
  if (right) { S.score += points(S.round); S.right++; } else S.lives--;
  save();
  drawHud();
  for (const b of $("answers").children) {
    b.disabled = true;
    if (b.dataset.value === String(q.answer)) b.classList.add("good");
    else if (b.dataset.value === String(given) && !right) b.classList.add("bad");
  }
  // show the stack again with the answer marked
  const mark = q.kind === "cell" ? q.cell : q.cell || null;
  $("view").replaceChildren(...panelsFor(R.view, R.changed || R.cells, { mark, highlight: q.colour || null }));
  const v = $("verdict");
  v.hidden = false;
  v.className = `mf-verdict ${right ? "good" : "bad"}`;
  v.textContent = right ? `Right, +${points(S.round)}` : q.kind === "number" ? `It was ${q.answer}` : q.kind === "colour" ? `It was ${COLOURS[q.answer - 1].name.toLowerCase()}` : "That one's marked";
  if (!right) navigator.vibrate?.(70);
  const go = $("goBtn");
  go.hidden = false;
  if (S.lives <= 0) { go.textContent = "See how it went"; go.onclick = over; }
  else if (S.q + 1 < R.questions.length) { go.textContent = "Next question"; go.onclick = () => { S.q++; ask(); }; }
  else { go.textContent = `Round ${S.round + 1}`; go.onclick = () => { S.round++; showRound(); }; }
}
function over() {
  S.phase = "over";
  save();
  const best = S.mode === "daily" ? bestDaily(S.score) : bestEver(S.score);
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "mf-big", S.score.toLocaleString("en-GB"));
  const stats = add("div", "mf-stats");
  for (const [v, label] of [[S.round, "rounds"], [S.right, "right"], [best.toLocaleString("en-GB"), S.mode === "daily" ? "today's best" : "your best"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  const again = add("button", "btn primary wide", "Again");
  again.type = "button"; again.addEventListener("click", () => { $("menuDlg").close(); start("random"); });
  const daily = add("button", "btn wide", S.mode === "daily" ? "A random run" : "Today's run");
  daily.type = "button"; daily.addEventListener("click", () => { $("menuDlg").close(); start(S.mode === "daily" ? "random" : "daily"); });
  $("menuDlg").querySelector("h2").textContent = "Out of lives";
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function bestEver(score) { const b = Math.max(read(BEST, 0), score); write(BEST, b); return b; }
function bestDaily(score) { const d = read(DAILY, {}); d[today()] = Math.max(d[today()] || 0, score); write(DAILY, d); return d[today()]; }

function drawHud() {
  $("round").textContent = `Round ${S.round}`;
  $("score").textContent = S.score.toLocaleString("en-GB");
  const lives = $("lives");
  lives.replaceChildren(...Array.from({ length: LIVES }, (_, k) => { const i = document.createElement("i"); i.className = `mf-life${k >= S.lives ? " gone" : ""}`; return i; }));
}

// ---------- drawing the views ----------
const el = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const colourOf = c => COLOURS[c - 1].hex;

/** A container drawn as a rounded box with ribs; blank ones are outlines. */
function box(g, x, y, s, c, opts) {
  const r = el("rect", { x, y, width: s, height: s, rx: s * 0.14, class: "cell" });
  if (opts.blank || !c) { r.setAttribute("fill", c ? "var(--mf-floor)" : "none"); r.setAttribute("stroke", "var(--mf-edge)"); r.setAttribute("stroke-width", 1.5); }
  else { r.setAttribute("fill", colourOf(c)); r.setAttribute("stroke", "rgba(0,0,0,.25)"); r.setAttribute("stroke-width", 1.5); }
  if (opts.dim) r.setAttribute("opacity", 0.25);
  g.appendChild(r);
  if (c && !opts.blank) for (const f of [0.35, 0.65]) g.appendChild(el("line", { x1: x + s * 0.18, x2: x + s * 0.82, y1: y + s * f, y2: y + s * f, stroke: "rgba(0,0,0,.22)", "stroke-width": 1.2 }));
  return r;
}
function markRing(g, x, y, s) {
  g.appendChild(el("rect", { x: x - 3, y: y - 3, width: s + 6, height: s + 6, rx: s * 0.2, fill: "none", stroke: "var(--ink)", "stroke-width": 3 }));
}
/** A flat grid panel (X across, rows), with cell (col, row) → colour via at(col, row) and key(col, row). */
function gridPanel(label, cols, rows, at, key, opts) {
  const wrap = document.createElement("div");
  wrap.className = "mf-panel";
  const small = document.createElement("small");
  small.textContent = label;
  wrap.appendChild(small);
  const s = 40, gap = 4, W = cols * (s + gap) + 6, H = rows * (s + gap) + 6;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: opts.tap ? "tap" : "" });
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const c = at(col, row), x = 3 + col * (s + gap), y = 3 + row * (s + gap);
    const k = key(col, row);
    const marked = opts.mark && opts.markKey === k;
    const r = box(svg, x, y, s, c, { blank: opts.blank, dim: opts.highlight && c && c !== opts.highlight });
    if (marked) markRing(svg, x, y, s);
    if (opts.tap && c) r.addEventListener("click", () => opts.tap(k));
  }
  wrap.appendChild(svg);
  return wrap;
}
/** The panels for a view of a stack: opts { blank, mark: {x,y,z}, highlight: colour, tap(key) }. */
function panelsFor(view, cells, opts) {
  const X = cells.length, Y = cells[0].length, Z = cells[0][0].length;
  const markKey = opts.mark ? `${opts.mark.x},${opts.mark.y},${opts.mark.z}` : null;
  const o = { ...opts, markKey };
  const panels = [];
  if (view === "slices") {
    for (let y = Y - 1; y >= 0; y--) panels.push(gridPanel(y === Y - 1 ? "Front slice" : y === 0 ? "Back slice" : `Slice ${Y - y} from the front`, X, Z,
      (col, row) => cells[col][y][Z - 1 - row], (col, row) => `${col},${y},${Z - 1 - row}`, o));
  } else if (view === "layers" || view === "pair") {
    const tiers = view === "pair" ? Math.min(2, Z) : Z;
    for (let z = 0; z < tiers; z++) panels.push(gridPanel(`Tier ${z + 1}${z === 0 ? " (bottom)" : ""}`, X, Y,
      (col, row) => cells[col][Y - 1 - row][z], (col, row) => `${col},${Y - 1 - row},${z}`, o));
  } else {
    panels.push(isoPanel(cells, o));
  }
  $("view").style.setProperty("--panels", panels.length >= 3 ? 2 : panels.length === 2 && X <= 3 ? 2 : 1);
  if (view === "iso") $("view").style.setProperty("--panels", 1);
  return panels;
}
/** The isometric view: cubes back to front; blank shows the floor with the marked column raised. */
function isoPanel(cells, opts) {
  const wrap = document.createElement("div");
  wrap.className = "mf-panel";
  const small = document.createElement("small");
  small.textContent = "The whole stack, from the front-right";
  wrap.appendChild(small);
  const X = cells.length, Y = cells[0].length, Z = cells[0][0].length, s = 46;
  const pts = [];
  for (let x = 0; x <= X; x++) for (let y = 0; y <= Y; y++) for (let z = 0; z <= Z; z++) pts.push(isoPoint(x, y, z));
  const minX = Math.min(...pts.map(p => p.sx)), maxX = Math.max(...pts.map(p => p.sx)), minY = Math.min(...pts.map(p => p.sy)), maxY = Math.max(...pts.map(p => p.sy));
  const W = (maxX - minX) * s + 20, H = (maxY - minY) * s + 20;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: opts.tap ? "tap" : "" });
  const P = ([sx, sy]) => `${((sx - minX) * s + 10).toFixed(1)},${((sy - minY) * s + 10).toFixed(1)}`;
  // the floor
  for (let x = 0; x < X; x++) for (let y = 0; y < Y; y++) {
    const f = cubeFaces(x, y, -1).top;
    svg.appendChild(el("polygon", { points: f.map(P).join(" "), fill: "var(--mf-floor)", stroke: "var(--sheet)", "stroke-width": 1, opacity: 0.6 }));
  }
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const ch = sh => Math.round(Math.min(255, Math.max(0, ((n >> sh) & 255) * k))); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
  for (const cube of drawOrder(cells)) {
    const faces = cubeFaces(cube.x, cube.y, cube.z);
    const key = `${cube.x},${cube.y},${cube.z}`;
    const dim = opts.highlight && cube.c !== opts.highlight;
    const hex = opts.blank ? null : colourOf(cube.c);
    const g = el("g", dim ? { opacity: 0.3 } : {});
    for (const [name, k] of [["left", 0.72], ["right", 0.86], ["top", 1.05]]) {
      const poly = el("polygon", { points: faces[name].map(P).join(" "), fill: hex ? shade(hex, k) : "var(--mf-floor)", stroke: "rgba(0,0,0,.3)", "stroke-width": 1, class: "cell" });
      if (opts.tap) poly.addEventListener("click", () => opts.tap(key));
      g.appendChild(poly);
    }
    if (opts.markKey === key) {
      const top = faces.top.map(P).join(" ");
      g.appendChild(el("polygon", { points: top, fill: "none", stroke: "var(--ink)", "stroke-width": 3.5 }));
    }
    svg.appendChild(g);
  }
  wrap.appendChild(svg);
  return wrap;
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
  $("menuDlg").querySelector("h2").textContent = "Menu";
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  add("p", "stats", "A stack of containers shows for a few seconds, in a different view each round, then it's gone and you're asked about it. Rounds grow; three lives.");
  button("A new run", () => confirmStart("random"));
  button("Today's run", () => confirmStart("daily"));
  const best = read(BEST, 0), daily = read(DAILY, {})[today()];
  add("p", "stats", `${best ? `Your best: ${best.toLocaleString("en-GB")}.` : "No finished run yet."}${daily != null ? ` Today's best: ${daily.toLocaleString("en-GB")}.` : ""}`);
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (S && S.phase !== "over" && S.round > 1 && !confirm("Start a new run? This one isn't finished.")) return;
  start(mode);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "manifest");
document.querySelector(".mf-mark").innerHTML = APPS.find(a => a.id === "manifest").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
document.addEventListener("visibilitychange", () => { if (document.hidden && S?.phase === "show") { clearTimeout(showTimer); showRound(); } });  // a hidden stack restarts its showing

// for tests and debugging
window.__manifest = { get state() { return S; }, get round() { return R; }, answer, start };

S = read(RUN, null);
const hash = new URLSearchParams(location.hash.slice(1));
const linked = Number(hash.get("d") || hash.get("s")), mode = hash.get("d") ? "daily" : "random";
if (linked && !(S && S.seed === linked && S.mode === mode)) { S = { seed: linked, mode, round: 1, score: 0, lives: LIVES, right: 0, phase: "show", q: 0 }; save(); showRound(); }
else if (!S || S.phase === "over") start("random");
else showRound();                                  // a saved run picks up at the start of its round
