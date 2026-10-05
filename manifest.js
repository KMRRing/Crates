// Manifest: a stack of containers is shown, then it's gone and you're asked about it. The engine
// (manifest-engine.js) makes the rounds; this file shows the views and takes the answers.
import { LIVES, COLOURS, VIEWS, makeRound, points, cubeFaces, drawOrder, isoPoint, visibleSet, BOX } from "./manifest-engine.js";
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
/** The round: the containers drop in by the round's order, the stack holds for the level's time, flies off, and the question comes. */
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
  const { panel, drops } = stage(R.cells, { drop: R.view });
  view.replaceChildren(panel);
  const landed = drops.last + 450;
  const timer = $("timer");
  timer.hidden = true;
  clearTimeout(showTimer);
  showTimer = setTimeout(() => {                    // the last one has landed: the clock runs
    timer.hidden = false;
    timer.style.setProperty("--mf-ms", `${R.level.exposure}ms`);
    timer.classList.remove("run"); void timer.offsetWidth; timer.classList.add("run");
    showTimer = setTimeout(() => {
      if (R.changed) { ask(); return; }               // a change round keeps the stack: one container flips
      panel.classList.add("away");                    // the rest fly off before the question
      showTimer = setTimeout(ask, 380);
    }, R.level.exposure);
  }, landed);
}
/** The question: the stack is gone (or, for a change round, still there with one container changed). */
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
    const { panel } = stage(R.changed, { tap: key => answer(key), flip: q.cell });
    view.replaceChildren(panel);
  } else {
    const { panel } = stage(R.cells, { blank: true, mark: q.cell });
    view.replaceChildren(panel);
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
  // the stack again, with the answer marked and the colour asked about lit
  const { panel } = stage(R.changed || R.cells, { mark: q.cell, highlight: q.colour || null, tier: q.type === "tier" || q.type === "tier2" ? Number(q.text.match(/tier (\d)/)?.[1]) - 1 : null });
  $("view").replaceChildren(panel);
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

// ---------- the stage: one isometric stack ----------
const el = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const colourOf = c => COLOURS[c - 1].hex;
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const ch = sh => Math.round(Math.min(255, Math.max(0, ((n >> sh) & 255) * k))); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };

/** When each container lands, by the round's order: { "x,y,z": ms, last }. */
function dropTimes(cells, order) {
  const X = cells.length, Y = cells[0].length, Z = cells[0][0].length;
  const times = {};
  let k = 0, last = 0;
  const stagger = 45, pause = 1300;
  for (const cube of drawOrder(cells)) {
    const key = `${cube.x},${cube.y},${cube.z}`;
    let at;
    if (order === "layers") at = cube.z * pause + k * stagger;
    else if (order === "slices") at = cube.y * pause + k * stagger;
    else if (order === "pair") at = cube.z < 2 ? cube.z * pause + k * stagger : 2 * pause + 600 + k * 25;
    else at = k * 35;
    times[key] = at;
    last = Math.max(last, at);
    k++;
  }
  return { times, last };
}

/**
 * The stack as one isometric panel: { panel, drops }. opts: drop (an order: the containers fall in), blank (the
 * floor only, for a marked position), mark {x,y,z} (outline a container, or its floor cell with a tier label when
 * it's hidden), highlight (dim every colour but this), tier (dim every tier but this), tap(key), flip {x,y,z} (the
 * container that changed, which flips in).
 */
function stage(cells, opts) {
  const panel = document.createElement("div");
  panel.className = "mf-panel";
  const X = cells.length, Y = cells[0].length, Z = cells[0][0].length, s = 46;
  const pts = [];
  for (let x = 0; x <= X; x++) for (let y = 0; y <= Y; y++) for (let z = 0; z <= Z; z++) pts.push(isoPoint(x, y, z));
  const minX = Math.min(...pts.map(p => p.sx)), maxX = Math.max(...pts.map(p => p.sx)), minY = Math.min(...pts.map(p => p.sy)), maxY = Math.max(...pts.map(p => p.sy));
  const W = (maxX - minX) * s + 20, H = (maxY - minY) * s + 20;
  const svg = el("svg", { viewBox: `0 ${-s * 1.6} ${W} ${H + s * 1.6}`, class: opts.tap ? "tap" : "" });   // room above for the drops
  const P = ([sx, sy]) => `${((sx - minX) * s + 10).toFixed(1)},${((sy - minY) * s + 10).toFixed(1)}`;
  const markKey = opts.mark ? `${opts.mark.x},${opts.mark.y},${opts.mark.z}` : null;
  const visible = opts.blank || markKey ? visibleSet(cells) : null;
  // the floor
  for (let x = 0; x < X; x++) for (let y = 0; y < Y; y++) {
    const f = cubeFaces(x, y, -1).top;
    const marked = opts.mark && opts.mark.x === x && opts.mark.y === y && (opts.blank || !visible.has(markKey));
    svg.appendChild(el("polygon", { points: f.map(P).join(" "), fill: marked ? "var(--mf-in)" : "var(--mf-floor)", stroke: "var(--sheet)", "stroke-width": 1, opacity: marked ? 0.9 : 0.6 }));
    if (marked) {
      const c = cubeFaces(x, y, -1).top.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]);
      const t = el("text", { x: ((c[0] - minX) * s + 10).toFixed(1), y: ((c[1] - minY) * s + 14).toFixed(1), "text-anchor": "middle", "font-size": 12, "font-weight": 800, fill: "#fff" });
      t.textContent = `tier ${opts.mark.z + 1}`;
      svg.appendChild(t);
    }
  }
  const drops = opts.drop ? dropTimes(cells, opts.drop) : { times: {}, last: 0 };
  if (!opts.blank) for (const cube of drawOrder(cells)) {
    const faces = cubeFaces(cube.x, cube.y, cube.z), key = `${cube.x},${cube.y},${cube.z}`;
    const dim = (opts.highlight && cube.c !== opts.highlight) || (opts.tier != null && cube.z !== opts.tier);
    const hex = colourOf(cube.c);
    const g = el("g", { class: `cube${opts.drop ? " drop" : ""}${opts.flip && opts.flip.x === cube.x && opts.flip.y === cube.y && opts.flip.z === cube.z ? " flip" : ""}` });
    if (dim) g.setAttribute("opacity", 0.25);
    if (opts.drop) g.style.animationDelay = `${drops.times[key]}ms`;
    for (const [name, k] of [["left", 0.72], ["right", 0.86], ["top", 1.05]]) {
      const poly = el("polygon", { points: faces[name].map(P).join(" "), fill: shade(hex, k), stroke: "rgba(0,0,0,.3)", "stroke-width": 1, class: "mf-cell" });
      if (opts.tap) poly.addEventListener("click", () => opts.tap(key));
      g.appendChild(poly);
    }
    // the details that make a box a container: corrugations along the long side, doors on the end, roof ridges
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const lineOn = (face, t0, t1, from, to, attrs) => {   // a line across a face between two edges, at fractions along them
      const a = lerp(face[from[0]], face[from[1]], t0), b = lerp(face[to[0]], face[to[1]], t1);
      g.appendChild(el("line", { x1: P(a).split(",")[0], y1: P(a).split(",")[1], x2: P(b).split(",")[0], y2: P(b).split(",")[1], ...attrs }));
    };
    const ink = { stroke: "rgba(0,0,0,.28)", "stroke-width": 0.9 };
    const L = faces.left;                                   // corners: bottom-near, bottom-far, top-far, top-near along x
    for (let i = 1; i < 8; i++) lineOn(L, i / 8, i / 8, [0, 1], [3, 2], ink);
    const R = faces.right;                                   // the end: two doors with a centre split and handles
    lineOn(R, 0.5, 0.5, [0, 1], [3, 2], { stroke: "rgba(0,0,0,.45)", "stroke-width": 1.2 });
    lineOn(R, 0.4, 0.4, [0, 1], [3, 2], ink); lineOn(R, 0.6, 0.6, [0, 1], [3, 2], ink);
    const T = faces.top;
    for (const t of [0.33, 0.66]) lineOn(T, t, t, [0, 3], [1, 2], { stroke: "rgba(0,0,0,.14)", "stroke-width": 0.9 });
    if (markKey === key && (!visible || visible.has(key))) g.appendChild(el("polygon", { points: faces.top.map(P).join(" "), fill: "none", stroke: "var(--ink)", "stroke-width": 3.5 }));
    svg.appendChild(g);
  }
  panel.appendChild(svg);
  return { panel, drops };
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
