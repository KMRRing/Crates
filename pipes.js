// Pipes: turn tiles ahead of the flow. The engine (pipes-engine.js) builds levels and moves the flow; this file
// draws the board, takes taps and runs the clock.
import { LIVES, PRODUCTS, COSTS, DIRS, ACTS, ACT_LENGTH, actOf, makeLevel, newRun, turn, advance, score, openings, shapeOf, levelOf, trace, rightTurn } from "./pipes-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, action, line, onPause } from "./menu.js";
import { today, IN_FRAME } from "./suite.js";          // the day, the same for everyone (UTC); a partner watching's frame

const $ = id => document.getElementById(id);
const RUN = "pipes:run", BEST = "pipes:best", DAILY = "pipes:daily";
const SVG = "http://www.w3.org/2000/svg";
const TILE = 60, PIPE = 18;            // drawing units
const BONUS_WINDOW = 90000;             // ms: the time bonus counts down from here once the flow starts
const FILL_SPEED = 80, FILL_STEP = 50;  // Fill it now: flow time runs 80× (a 40 s flow in half a second), in 50 ms steps so
                                       // the products meet crossings in the same order they would at speed 1
const FILL_SCORED = 4;                 // and the time bonus counts that time as if pumped at ×4

let S = null;        // { seed, mode, n, score, lives, attempt, phase: "plan" | "flow" | "done" | "over", after: "next" | "retry" (once done), offers: [{ id, price, uses }], market: { crude, hvo }, tool, live (below) }
let L = null;        // the level
let R = null;        // the run
let clock = { last: 0, brief: 0, planLeft: 0, flowing: 0, filling: false };   // brief: the tools shown before the countdown; flowing: the time the bonus counts
let raf = 0;
const cells = new Map();   // "x,y" -> { g, flows: [] }

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
// tools bought during the match with points: each map offers three, at its own prices, each a few uses only
const TOOLS = {
  clear: { name: "Clear rock", icon: "⛏", price: [80, 160], uses: [1, 2], about: "Tap a rock: it becomes a random pipe." },
  pump: { name: "Add pump", icon: "⛽", price: [120, 220], uses: [1, 2], about: "Tap a straight or a bend: it becomes a pump." },
  bend: { name: "Curve", icon: "↱", price: [60, 120], uses: [1, 3], about: "Tap a straight or a crossing: it becomes a curve." },
  cross: { name: "Crossover", icon: "✚", price: [80, 160], uses: [1, 2], about: "Tap a straight or a curve: it becomes a crossing." },
  pause: { name: "5 s pause", icon: "⏸", price: [100, 200], uses: [1, 2], about: "Everything waits five seconds: the countdown or the flow." },
  turn: { name: "Auto-turn", icon: "🧭", price: [20, 40], uses: [2, 4], about: "Tap a pipe: it turns the way the route runs, or shows ✕ if the route doesn't use it." },
};
const PAUSE_MS = 5000;
// a level opens on its tools, for this long, before its countdown starts: time to take them in that costs none of the
// planning (the board stays covered); a tap starts it sooner, and there's none when none of them is affordable
const BRIEF_MS = 3000;
/** A map's offers: three of the tools at its own prices and uses, the same for everyone on the same board. */
function offersFor(seed) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ids = Object.keys(TOOLS).map(id => [r(), id]).sort((x, y) => x[0] - y[0]).slice(0, 3).map(([, id]) => id);
  return ids.map(id => { const t = TOOLS[id], pick = ([lo, hi], step) => lo + step * Math.floor(r() * ((hi - lo) / step + 1)); return { id, price: pick(t.price, 10), uses: pick(t.uses, 1) }; });
}
/** Prices drift between levels, a few per cent either way, within 70% and 140% of the list price. */
const drift = (m, r) => Math.min(1.4, Math.max(0.7, +(m * (1 + (r - 0.5) * 0.24)).toFixed(3)));
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const save = () => write(RUN, S);
const levelInfo = () => levelOf(S?.n || 1);

// ---------- the run ----------
function start(mode) {
  S = { seed: mode === "daily" ? today() : randomSeed(), mode, n: 1, score: 0, lives: LIVES, attempt: 0, phase: "plan", market: { crude: 1, hvo: 1 }, tool: null };
  history.replaceState(null, "", mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`);
  beginLevel();
}
/** A level begins: the board, a planning countdown, then the flow. A retry after a spill gets a fresh board. */
function beginLevel() {
  L = makeLevel(S.seed + 7919 * S.attempt, S.n);
  R = newRun(L);
  S.phase = "plan";
  S.after = null;
  S.market = { crude: S.market?.crude ?? 1, hvo: S.market?.hvo ?? 1 }; S.tool = null;
  S.offers = offersFor(S.seed + 7919 * S.attempt + 104729 * S.n);
  const affordable = S.offers.some(o => o.uses && S.score >= o.price);
  clock = { last: performance.now(), brief: affordable ? BRIEF_MS : 0, planLeft: L.level.plan, flowing: 0, filling: false, paused: 0 };
  keepLive();
  drawHud();
  buildBoard();
  $("goBtn").hidden = true;
  $("fillBtn").hidden = clock.brief > 0;             // there from the countdown's first moment: fill as soon as the route is ready
  $("note").textContent = levelNote();
  drawTools();
  drawBrief();
  drawStatus();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}
/** The level's news under the board while it's played. The note has three lines: each level's news must fit them. */
const levelNote = () => (L.n === 1 ? `Tap a tile to turn it, hold to turn it back. Pressure lasts ${L.level.pressure} tiles and only a pump refills it: "dry" marks where a line would run out. Pipe costs ${COSTS.tile} a tile, a pump ${COSTS.pump}.`
  : L.n === 3 ? "Two terminals: the far one pays more but costs more pipe and pumps. Take the one that nets more."
  : L.level.place === 0 && L.level.act > 1 ? `Act ${L.level.act}, ${ACTS[L.level.act - 1].name}. ${ACTS[L.level.act - 1].news}` : "");
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(100, now - clock.last);
  clock.last = now;
  if (S.phase !== "plan" && S.phase !== "flow") return;
  const was = S.phase, filled = R.tilesFilled, briefing = clock.brief > 0;
  step(dt);
  drawStatus();
  if (briefing) { if (clock.brief > 0) drawBrief(); else endBrief(); }
  if (S.phase === "flow" && clock.paused <= 0) { drawFlow(); drawGauges(); }
  // kept as the oil enters each tile (Fill it now enters several a frame: a few times a second is plenty to watch)
  if (S.phase !== was || (R.tilesFilled !== filled && now - keptAt > 250)) keepLive();
  if (R.over) endLevel();
}
/** The level's clock moved on by dt ms: the brief (the tools on show) and a pause hold the countdown and the flow
 *  alike; then the countdown, then the flow (at ×80 while filling, its time counted as if pumped at ×4). */
function step(dt) {
  if (clock.brief > 0) { clock.brief = Math.max(0, clock.brief - dt); return; }
  if (clock.paused > 0) { clock.paused -= dt; return; }
  if (S.phase === "plan") { clock.planLeft -= dt; if (clock.planLeft <= 0) S.phase = "flow"; return; }
  if (S.phase !== "flow") return;
  if (clock.filling) {
    for (let left = dt * FILL_SPEED; left > 0 && !R.over; left -= FILL_STEP) {
      const s = Math.min(FILL_STEP, left);
      advance(L, R, s);
      clock.flowing += s / FILL_SCORED;
    }
  } else {
    clock.flowing += dt;
    advance(L, R, dt);
  }
}
function drawStatus() {
  $("status").textContent = clock.brief > 0 && S.phase === "plan" ? `Clock starts in ${Math.ceil(clock.brief / 1000)} s · level ${L.n}`
    : clock.paused > 0 ? `Paused · ${Math.max(0, Math.ceil(clock.paused / 1000))} s`
    : S.phase === "plan" ? `Oil in ${Math.max(0, Math.ceil(clock.planLeft / 1000))} s · level ${L.n}`
    : `${clock.filling ? "Filling, time at ×4" : "Flowing"} · level ${L.n}`;
}

// ---------- the level as it stands, for a partner watching ----------
// Kept in the run's save at every turn of a tile, every tile the oil enters and the level's end: the board, the flow, the
// clock. A partner's watching frame picks it up and runs on from it. Here a level left mid-way still starts over, fresh
// (so hiding the app can't buy time to plan); a finished level comes back as it ended, its result and its button.
let keptAt = 0;
function keepLive(extra = {}) {
  keptAt = performance.now();
  S.live = { n: S.n, attempt: S.attempt, R, brief: Math.round(clock.brief), planLeft: Math.round(clock.planLeft), flowing: Math.round(clock.flowing), filling: clock.filling,
    paused: Math.max(0, Math.round(clock.paused)), at: Date.now(), ...extra };
  save();
}
/** The level as it was kept: in a watching frame, run on by the second or two since; here, a finished level's end. */
function resumeLive() {
  const v = S.live;
  L = makeLevel(S.seed + 7919 * S.attempt, S.n);
  R = v.R;
  clock = { last: performance.now(), brief: v.brief || 0, planLeft: v.planLeft, flowing: v.flowing, filling: v.filling, paused: v.paused };
  // in a frame, the clock runs on by the time since it was kept (a player thinking over the board saves nothing for a
  // while), but not past half a minute: an older copy is a player who has gone, not one still playing
  if (IN_FRAME && (S.phase === "plan" || S.phase === "flow")) for (let gone = Math.min(30000, Math.max(0, Date.now() - v.at)); gone > 0 && !R.over; gone -= 50) step(Math.min(50, gone));
  drawHud();
  buildBoard();
  drawFlow();
  drawGauges();
  drawTools();
  drawBrief();
  $("fillBtn").hidden = !(S.phase === "plan" || S.phase === "flow") || clock.filling || clock.brief > 0;
  $("goBtn").hidden = true;
  if (S.phase === "plan" || S.phase === "flow") { drawStatus(); $("note").textContent = levelNote(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); return; }
  $("status").textContent = v.status || "";
  $("note").textContent = v.note || "";
  markSpill();
  goButton();
}
function endLevel() {
  const msLeft = Math.max(0, BONUS_WINDOW - clock.flowing);
  const net = score(L, R, msLeft, S.market), earned = net.total;
  S.score += earned;
  $("fillBtn").hidden = true;
  drawBrief();
  if (R.over.win) {
    S.phase = "done";
    $("status").textContent = `Delivered: +${earned}`;
    $("note").textContent = `${net.revenue} at the terminal${R.reached.length > 1 ? "s" : ""}, −${net.pipe} for ${R.tilesFilled} tiles of pipe, −${net.pumps} for ${R.pumpsFired} pump${R.pumpsFired === 1 ? "" : "s"}, +${net.time} for time.${pickNote()}`;
    S.after = "next";
    goButton();
    drawTools();
    const m = S.market, pct = v => `${v >= 1 ? "+" : ""}${Math.round((v - 1) * 100)}%`;
    $("note").textContent += ` Prices now: crude ${pct(m.crude)}, HVO ${pct(m.hvo)} on list.`;
  } else {
    S.lives--;
    const why = { "no opening": "a dead end", "the edge": "the edge of the field", "already full": "a pipe that was already full", "wrong product": "the wrong terminal: contamination", pressure: "no pressure left: it needed a pump" }[R.over.why] || R.over.why;
    $("status").textContent = `Spill: ${why}.`;
    $("note").textContent = "Nothing delivered, nothing paid.";
    navigator.vibrate?.([60, 40, 60]);
    markSpill();
    if (S.lives <= 0) S.phase = "over";
    else { S.phase = "done"; S.after = "retry"; drawTools(); }
    goButton();
  }
  keepLive({ status: $("status").textContent, note: $("note").textContent });
  drawHud();
}
/** The button under a finished level: the next level, the same one again, or how the run went. */
function goButton() {
  const b = $("goBtn");
  b.hidden = false;
  if (S.phase === "over") { b.textContent = "See how it went"; b.onclick = over; return; }
  b.textContent = S.after === "next" ? `Level ${S.n + 1}` : `Try level ${S.n} again`;
  b.onclick = S.after === "next" ? nextLevel : retryLevel;
}
/** On to the next level: a new act gives a life back, and prices drift. */
function nextLevel() {
  S.n++; S.attempt = 0;
  if (levelOf(S.n).place === 0 && S.lives < LIVES) { S.lives++; toast(`Act ${actOf(S.n)}: a life back`); }
  const r = Math.random, m = S.market;
  S.market = { crude: drift(m.crude, r()), hvo: drift(m.hvo, r()) };
  beginLevel();
}
/** The same level again, on a fresh board. */
function retryLevel() { S.attempt++; beginLevel(); }
/** On a two-terminal level, a word on the pick: the board was priced so one nets more. */
function pickNote() {
  if (!L.choice) return "";
  const took = R.reached[0] === 0 ? "far" : "near";
  return took === L.choice.better ? ` The ${took} terminal was the better pick here.` : ` The ${L.choice.better} terminal would have netted about ${L.choice.by} more.`;
}
function over() {
  const best = S.mode === "daily" ? bestDaily() : bestEver();
  const body = $("menuBody");
  body.replaceChildren();
  $("menuDlg").querySelector("h2").textContent = "Out of lives";
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "pi-big", S.score.toLocaleString("en-GB"));
  const stats = add("div", "pi-stats");
  for (const [v, label] of [[S.n, "level reached"], [best.score.toLocaleString("en-GB"), S.mode === "daily" ? "today's best" : "your best"], [best.n, "best level"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  const again = add("button", "btn primary wide", "Again");
  again.type = "button"; again.addEventListener("click", () => { $("menuDlg").close(); start("random"); });
  const daily = add("button", "btn wide", S.mode === "daily" ? "A random run" : "Today's run");
  daily.type = "button"; daily.addEventListener("click", () => { $("menuDlg").close(); start(S.mode === "daily" ? "random" : "daily"); });
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function bestEver() { const b = read(BEST, { score: 0, n: 0 }); const nb = { score: Math.max(b.score, S.score), n: Math.max(b.n, S.n) }; write(BEST, nb); return nb; }
function bestDaily() { const d = read(DAILY, {}); const b = d[today()] || { score: 0, n: 0 }; const nb = { score: Math.max(b.score, S.score), n: Math.max(b.n, S.n) }; d[today()] = nb; write(DAILY, d); return nb; }

// ---------- the board ----------
const el = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
/** The point on a tile's edge for a direction, in tile units. */
const edge = d => [TILE / 2 + DIRS[d][0] * TILE / 2, TILE / 2 + DIRS[d][1] * TILE / 2];
const centre = [TILE / 2, TILE / 2];

function buildBoard() {
  cells.clear();
  const board = $("board");
  board.replaceChildren();
  const svg = el("svg", { viewBox: `0 0 ${L.w * TILE} ${L.h * TILE}` });
  board.style.setProperty("--aspect", String(L.w / L.h));           // the board fits the room left, keeping this shape
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const g = el("g", { transform: `translate(${x * TILE} ${y * TILE})` });
    svg.appendChild(g);
    cells.set(`${x},${y}`, { g });
    drawTile(x, y);
  }
  // taps are taken on the board itself and mapped to a tile by position: phones are unreliable about taps on
  // the SVG groups, and a finger that moved (a scroll) isn't a tap
  // a tap turns a tile clockwise; holding it (or a right-click) turns it back anticlockwise
  let down = null;
  const cellAt = e => { const r = svg.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * L.w), y = Math.floor((e.clientY - r.top) / r.height * L.h); return x >= 0 && y >= 0 && x < L.w && y < L.h ? [x, y] : null; };
  svg.addEventListener("pointerdown", e => {
    if (e.button === 2) return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, held: false };
    const c = cellAt(e), mine = down;
    down.timer = setTimeout(() => { if (down === mine && c) { mine.held = true; tap(...c, -1); navigator.vibrate?.(15); } }, 380);
  });
  svg.addEventListener("pointerup", e => {
    if (!down || e.pointerId !== down.id) return;
    clearTimeout(down.timer);
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), held = down.held;
    down = null;
    if (moved > 12 || held) return;
    const c = cellAt(e);
    if (c) tap(...c);
  });
  svg.addEventListener("pointercancel", () => { if (down) clearTimeout(down.timer); down = null; });
  svg.addEventListener("contextmenu", e => { e.preventDefault(); const c = cellAt(e); if (c) tap(...c, -1); });
  svg.appendChild(el("g", { class: "pi-trace" }));          // the trace lies over the tiles
  board.appendChild(svg);
  drawTrace();
}
/** Draws a tile from scratch: ground, the pipe shape at its rotation, and any flow in it. */
function drawTile(x, y) {
  const t = R.tiles[y][x], c = cells.get(`${x},${y}`), g = c.g;
  g.replaceChildren();
  g.setAttribute("class", `pi-tile${t.fixed ? " fixed" : ""}${t.locked ? " locked" : ""}`);
  g.appendChild(el("rect", { x: 2, y: 2, width: TILE - 4, height: TILE - 4, rx: 8, fill: t.kind === "rock" ? "var(--pi-rock)" : "var(--pi-tile)", stroke: "var(--pi-tile-edge)", "stroke-width": 1 }));
  if (t.kind === "rock") {
    for (const [cx, cy, r] of [[20, 24, 9], [38, 36, 11], [24, 42, 6]]) g.appendChild(el("circle", { cx, cy, r, fill: "var(--pi-tile-edge)" }));
    return;
  }
  const o = openings(t);
  const stub = d => { const [ex, ey] = edge(d); return el("line", { x1: centre[0], y1: centre[1], x2: ex, y2: ey, class: "pipe", "stroke-width": PIPE }); };
  if (t.kind === "well" || t.kind === "term") {
    g.appendChild(stub(o[0]));
    const end = L[t.kind === "well" ? "heads" : "terminals"].find(h => h.at[0] === x && h.at[1] === y);
    const colour = PRODUCTS[end?.product]?.colour || "#888";
    if (t.kind === "well" && end?.product === "crude") {                   // a wellhead's derrick
      g.appendChild(el("path", { d: "M18 46 L30 14 L42 46 Z M22 36 H38", fill: "none", stroke: colour, "stroke-width": 3.5, "stroke-linejoin": "round" }));
      g.appendChild(el("rect", { x: 14, y: 44, width: 32, height: 5, rx: 2, fill: colour }));
    } else if (t.kind === "well" && end?.product === "hvo") {               // the HVO plant: a column and its leaf
      g.appendChild(el("rect", { x: 20, y: 14, width: 14, height: 32, rx: 5, fill: colour, stroke: "#fff", "stroke-width": 2 }));
      g.appendChild(el("path", { d: "M36 30 C36 20 46 16 50 16 C50 24 46 30 36 30 Z", fill: colour, stroke: "#fff", "stroke-width": 1.5 }));
    } else if (t.kind === "well") {                                          // the used-cooking-oil tank
      g.appendChild(el("rect", { x: 15, y: 18, width: 30, height: 28, rx: 4, fill: colour, stroke: "#fff", "stroke-width": 2 }));
      g.appendChild(el("path", { d: "M15 26 H45 M15 38 H45", stroke: "#fff", "stroke-width": 1.5, opacity: 0.7 }));
    } else {
      // a terminal shows what it pays, so a route can be weighed against what it costs
      g.appendChild(el("rect", { x: 7, y: 17, width: 46, height: 27, rx: 6, fill: colour, stroke: "#fff", "stroke-width": 2, class: "term-face" }));
      const price = el("text", { x: 30, y: 35.5, "text-anchor": "middle", "font-size": 14, "font-weight": 800, fill: "#fff", class: "term-face" });
      price.textContent = String(end?.price ?? "");
      g.appendChild(price);
    }
    return;
  }
  if (t.kind === "unit") {
    for (const d of o) g.appendChild(stub(d));
    // the HVO unit: a reactor fed with used cooking oil at the top; HVO leaves one side, bio-naphtha the other
    const v = el("g", { transform: `rotate(${t.rot * 90} 30 30)` });
    v.appendChild(el("rect", { x: 15, y: 11, width: 30, height: 38, rx: 10, fill: PRODUCTS.uco.colour, stroke: "#fff", "stroke-width": 2 }));
    v.appendChild(el("path", { d: "M20 22 h20 M20 30 h20 M20 38 h20", stroke: "#fff", "stroke-width": 1.4, "stroke-dasharray": "2 2" }));
    v.appendChild(el("circle", { cx: 12, cy: 30, r: 4.5, fill: PRODUCTS.hvo.colour, stroke: "#fff", "stroke-width": 1.5 }));
    v.appendChild(el("circle", { cx: 48, cy: 30, r: 4.5, fill: PRODUCTS.naphtha.colour, stroke: "#fff", "stroke-width": 1.5 }));
    g.appendChild(v);
    return;
  }
  if (t.kind === "cross") {
    g.appendChild(el("line", { x1: 0, y1: TILE / 2, x2: TILE, y2: TILE / 2, class: "pipe", "stroke-width": PIPE }));
    g.appendChild(el("line", { x1: TILE / 2, y1: 0, x2: TILE / 2, y2: TILE, class: "pipe-dark", "stroke-width": PIPE + 4 }));
    g.appendChild(el("line", { x1: TILE / 2, y1: 0, x2: TILE / 2, y2: TILE, class: "pipe", "stroke-width": PIPE }));
  } else {
    const [a, b] = o;
    const [ax, ay] = edge(a), [bx, by] = edge(b);
    g.appendChild(el("path", { d: `M${ax} ${ay} L${centre[0]} ${centre[1]} L${bx} ${by}`, class: "pipe", "stroke-width": PIPE, "stroke-linejoin": "round" }));
    if (t.kind === "pump") {
      g.appendChild(el("circle", { cx: centre[0], cy: centre[1], r: 13, fill: "var(--pi-in)", stroke: "#fff", "stroke-width": 2 }));
      g.appendChild(el("path", { d: "M25 30 l10 -6 v12 z", fill: "#fff" }));
    }
  }
  // the corner: a dot for a tile that turns; Auto-turn's mark in its place, ✓ turned the right way (until turned by
  // hand), ✕ a pipe the route doesn't use
  if (!t.fixed && !t.locked) {
    if (t.off) g.appendChild(el("path", { d: "M45 4 l11 11 M56 4 l-11 11", class: "pi-off" }));
    else if (t.set) g.appendChild(el("path", { d: "M44 10 l4.5 4.5 l8.5 -9", class: "pi-set" }));
    else g.appendChild(el("circle", { cx: TILE - 9, cy: 9, r: 2.5, fill: "var(--pi-tile-edge)" }));
  }
  drawFlowIn(x, y);
}
/** The flow in one tile: full for filled tiles, partial for a head's tile, along the pipe it took. */
function drawFlowIn(x, y) {
  const c = cells.get(`${x},${y}`), g = c.g, t = R.tiles[y][x];
  for (const old of g.querySelectorAll(".flow")) old.remove();
  const fills = R.fill[`${x},${y}`] || [];
  const heads = R.heads.filter(h => h.x === x && h.y === y && !h.done);
  const isWell = t.kind === "well";
  const entries = isWell && heads.length ? [{ product: heads[0].product, into: null, out: openings(t)[0] }] : fills;
  for (const f of entries) {
    const head = heads.find(h => h.product === f.product);
    const progress = head ? head.progress : 1;
    const from = f.into == null ? centre : edge(f.into), to = f.out == null ? centre : edge(f.out);
    const d = `M${from[0]} ${from[1]} L${centre[0]} ${centre[1]} L${to[0]} ${to[1]}`;
    const len = (f.into == null ? 0 : TILE / 2) + (f.out == null ? 0 : TILE / 2);
    const path = el("path", { d, class: "flow", stroke: PRODUCTS[f.product].colour, "stroke-width": PIPE - 6, "stroke-dasharray": len, "stroke-dashoffset": len * (1 - progress), "stroke-linejoin": "round" });
    g.appendChild(path);
  }
  for (const face of g.querySelectorAll(".term-face")) g.appendChild(face);   // a terminal's price stays readable over the flow
}
let lastLockedKeys = "";
function drawFlow() {
  // redraw tiles whose lock state changed (they lose their turn dot), then the flow in the touched tiles
  const touched = new Set([...Object.keys(R.fill), ...R.heads.map(h => `${h.x},${h.y}`)]);
  const lockedKeys = [...touched].join("|");
  if (lockedKeys !== lastLockedKeys) { for (const k of touched) { const [x, y] = k.split(",").map(Number); drawTile(x, y); } lastLockedKeys = lockedKeys; }
  for (const k of touched) { const [x, y] = k.split(",").map(Number); drawFlowIn(x, y); }
}
function markSpill() {
  if (!R.spill) return;
  const c = cells.get(`${R.spill.x},${R.spill.y}`);
  c.g.appendChild(el("rect", { x: 3, y: 3, width: TILE - 6, height: TILE - 6, rx: 8, fill: "none", stroke: "var(--pi-bad)", "stroke-width": 4 }));
}
function tap(x, y, by = 1) {
  if ((S.phase !== "plan" && S.phase !== "flow") || clock.brief > 0) return;
  const t = R.tiles[y][x];
  if (S.tool) {                                       // a tool in hand: it works on the tile, if it's the right kind
    const offer = S.offers.find(o => o.id === S.tool);
    if (t.locked) return toast("That tile's full");
    const ok = { clear: t.kind === "rock", pump: ["straight", "bend"].includes(t.kind), bend: ["straight", "cross"].includes(t.kind), cross: ["straight", "bend"].includes(t.kind), turn: !t.fixed }[S.tool];
    if (!ok) return toast(TOOLS[S.tool].about);
    if (S.tool === "turn") {
      // Auto-turn always charges for what it tells: a pipe it can't turn would otherwise show the route for free, tile
      // by tile. A pipe already marked has nothing new to tell, so that tap is free.
      if (t.off || t.set) return toast(t.off ? "The route doesn't use that pipe: it's marked" : "Already turned the right way");
      const right = rightTurn(L, t, x, y);
      if (right.rot != null) { toast(right.rot === t.rot ? "Already the right way" : "Turned the right way"); t.rot = right.rot; t.set = true; }
      else if (right.why === "off") { t.off = true; toast("The route doesn't use this pipe"); }
      else toast("The route runs here, but needs another shape");
    } else {
      if (S.tool === "clear") Object.assign(t, { kind: ["straight", "bend", "bend", "cross"][Math.floor(Math.random() * 4)], rot: Math.floor(Math.random() * 4), fixed: false, shape: undefined });
      else if (S.tool === "pump") Object.assign(t, { kind: "pump", shape: t.kind });
      else Object.assign(t, { kind: S.tool, shape: undefined });
      delete t.set;                                    // a new shape: its right turn may be another
    }
    S.score -= offer.price; offer.uses--; S.tool = null;
    keepLive(); drawHud(); drawTile(x, y); drawTrace(); drawTools();
    return;
  }
  if (turn(R, x, y, by)) { delete t.set; drawTile(x, y); drawTrace(); keepLive(); }   // turned by hand: no longer vouched for
  else if (t.locked) toast("That tile's full");
}

// ---------- the warning: where a line, as the board stands, will run out of pressure ----------
function drawTrace() {
  const layer = $("board").querySelector(".pi-trace");
  if (!layer) return;
  layer.replaceChildren();
  for (const line of trace(L, R.tiles)) {
    if (line.end !== "dry") continue;
    const last = line.cells[line.cells.length - 1] || { x: line.from[0], y: line.from[1] };
    const badge = el("g", { class: "pi-dry", transform: `translate(${last.x * TILE + TILE / 2} ${last.y * TILE + TILE / 2})` });
    badge.appendChild(el("circle", { r: 15 }));
    const t = el("text", { y: 4, "text-anchor": "middle" }); t.textContent = "dry"; badge.appendChild(t);
    layer.appendChild(badge);
  }
}

// ---------- the tools: this map's offers, bought with points as you go ----------
function drawTools() {
  const box = $("kit");
  box.replaceChildren();
  if (S.phase !== "plan" && S.phase !== "flow") return;
  for (const o of S.offers || []) {
    const t = TOOLS[o.id], b = document.createElement("button");
    b.type = "button"; b.className = `pi-tool${S.tool === o.id ? " on" : ""}`;
    b.innerHTML = `<span class="ic"></span><span class="nm"></span><span class="pr"></span>`;
    b.querySelector(".ic").textContent = t.icon; b.querySelector(".nm").textContent = t.name; b.querySelector(".pr").textContent = `${o.price} · ×${o.uses}`;
    b.title = t.about;
    b.disabled = !o.uses || S.score < o.price || clock.brief > 0;    // bought once the clock starts
    b.addEventListener("click", () => {
      if (o.id === "pause") {                          // the pause works at once
        if (!o.uses || S.score < o.price) return;
        S.score -= o.price; o.uses--; clock.paused = PAUSE_MS; keepLive(); drawHud(); drawTools();
        return;
      }
      S.tool = S.tool === o.id ? null : o.id;
      if (S.tool) toast(t.about);
      drawTools();
    });
    box.append(b);
  }
}

// ---------- the brief: the level's tools, over the board before its clock starts ----------
let briefFor = "";
/** The card over the board while the clock waits: each tool on offer with its price, uses and what it does (one
 *  that costs more than the points in hand dimmed), and the seconds left as a bar. */
function drawBrief() {
  const box = $("brief"), on = S.phase === "plan" && clock.brief > 0;
  box.hidden = !on;
  if (!on) return;
  const key = `${S.seed}/${S.n}/${S.attempt}`;
  if (briefFor !== key) {
    briefFor = key;
    const make = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
    const rows = (S.offers || []).map(o => {
      const t = TOOLS[o.id], row = make("div", `pi-brief-row${!o.uses || S.score < o.price ? " dear" : ""}`);
      row.append(make("span", "ic", t.icon), make("b", "nm", t.name), make("span", "pr", `${o.price} · ×${o.uses}`), make("span", "ab", t.about));
      return row;
    });
    const bar = make("span", "pi-brief-bar"), foot = make("div", "pi-brief-foot"), go = make("button", "pi-brief-go", "Tap to start now");
    bar.append(document.createElement("i"));
    go.type = "button";
    foot.append(bar, go);
    box.replaceChildren(make("p", "pi-brief-head", "Tools on offer"), ...rows, foot);
  }
  box.querySelector(".pi-brief-bar i").style.width = `${(100 * clock.brief / BRIEF_MS).toFixed(1)}%`;
}
/** The tools have had their seconds, or a tap cut them short: the board shows, the countdown starts, the kit opens. */
function endBrief() {
  clock.brief = 0;
  drawBrief();
  $("fillBtn").hidden = (S.phase !== "plan" && S.phase !== "flow") || clock.filling;
  drawTools();
  drawStatus();
  keepLive();
}

// ---------- hud ----------
function drawHud() {
  $("level").textContent = `Act ${actOf(S.n)} · level ${S.n}`;
  $("score").textContent = S.score.toLocaleString("en-GB");
  $("lives").replaceChildren(...Array.from({ length: LIVES }, (_, k) => { const i = document.createElement("i"); i.className = `pi-life${k >= S.lives ? " gone" : ""}`; return i; }));
  drawGauges();
}
function drawGauges() {
  const box = $("gauges");
  box.replaceChildren();
  for (const h of R.heads) {
    const g = document.createElement("span");
    g.className = "pi-gauge";
    const dot = document.createElement("i"); dot.style.background = PRODUCTS[h.product].colour;
    const bar = document.createElement("span"); bar.className = "bar";
    const fill = document.createElement("i"); fill.style.background = PRODUCTS[h.product].colour; fill.style.width = `${h.done ? 100 : Math.round(100 * h.pressure / L.level.pressure)}%`;
    bar.appendChild(fill);
    g.append(dot, `${PRODUCTS[h.product].name}${h.done ? " ✓" : ""}`, bar);
    box.appendChild(g);
  }
}

// ---------- menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2000) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
// the menu: Play (start the run you've chosen), Content (random or today's), About (your bests)
let pick = null;                                              // the run the menu will start: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  pick ??= S?.mode === "daily" ? "daily" : "random";
  part(body, "play").append(action("Start a run", () => confirmStart(pick), "primary"));
  part(body, "content").append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; }));
  const best = read(BEST, null), daily = read(DAILY, {})[today()];
  part(body, "about").append(line(`${best ? `Best ${best.score.toLocaleString("en-GB")}, level ${best.n}` : "No finished run yet"}${daily ? `, today ${daily.score.toLocaleString("en-GB")}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (S && S.phase !== "over" && S.n > 1 && !confirm("Start a new run? This one isn't finished.")) return;
  start(mode);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "pipes");
document.querySelector(".pi-mark").innerHTML = APPS.find(a => a.id === "pipes").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
// a tap anywhere on the tools' card starts the clock (its button is the way in from a keyboard); never in a frame
$("brief").addEventListener("click", () => { if (!IN_FRAME && clock.brief > 0) endBrief(); });
/** Fill it now: the oil goes at once (planning ends there), the whole route fills in a moment, and the time it would
 *  have taken counts as if pumped at ×4. A route that isn't ready spills just the same. */
$("fillBtn").addEventListener("click", () => {
  if ((S.phase !== "plan" && S.phase !== "flow") || clock.brief > 0) return;
  S.phase = "flow";
  clock.planLeft = 0;
  clock.filling = true;
  $("fillBtn").hidden = true;
  keepLive();
});
// the menu holds the oil where it is: no frames while it's open, and no catching up after
let heldFrame = false;
onPause(() => { if (S?.phase === "plan" || S?.phase === "flow") { cancelAnimationFrame(raf); heldFrame = true; } },
  () => { if (!heldFrame) return; heldFrame = false; clock.last = performance.now(); raf = requestAnimationFrame(frame); });
document.addEventListener("visibilitychange", () => { if (document.hidden && !IN_FRAME && (S?.phase === "plan" || S?.phase === "flow")) retryLevel(); });   // a level left mid-flow starts over, fresh

// for tests and debugging
window.__pipes = { get state() { return S; }, get level() { return L; }, get run() { return R; }, get clock() { return clock; }, tap, start, skipBrief: () => { if (clock.brief > 0) endBrief(); },
  skipPlanning: () => { if (clock.brief > 0) endBrief(); clock.planLeft = 0; }, applySolution: () => { R.tiles.forEach((row, y) => row.forEach((t, x) => { if (!t.locked && !t.fixed) t.rot = L.solution[y][x]; drawTile(x, y); })); } };

S = read(RUN, null);
const hash = new URLSearchParams(location.hash.slice(1));
const linked = Number(hash.get("d") || hash.get("s")), mode = hash.get("d") ? "daily" : "random";
const kept = S?.live && S.live.n === S.n && S.live.attempt === S.attempt && S.live.R;
if (IN_FRAME && kept) resumeLive();
else if (linked && !(S && S.seed === linked && S.mode === mode)) { S = { seed: linked, mode, n: 1, score: 0, lives: LIVES, attempt: 0, phase: "plan" }; beginLevel(); }
else if (!S || S.phase === "over") start("random");
else if (S.phase === "done" && kept && S.after) resumeLive();
else beginLevel();
