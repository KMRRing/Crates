// Pipes: turn tiles ahead of the flow. The engine (pipes-engine.js) builds levels and moves the flow; this file
// draws the board, takes taps and runs the clock.
import { LIVES, PRODUCTS, COSTS, DIRS, ACTS, ACT_LENGTH, actOf, makeLevel, newRun, turn, advance, score, openings, shapeOf, levelOf, trace } from "./pipes-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, action, line, onPause } from "./menu.js";
import { today } from "./suite.js";          // the day, the same for everyone (UTC)

const $ = id => document.getElementById(id);
const RUN = "pipes:run", BEST = "pipes:best", DAILY = "pipes:daily";
const SVG = "http://www.w3.org/2000/svg";
const TILE = 60, PIPE = 18;            // drawing units
const BONUS_WINDOW = 90000;             // ms: the time bonus counts down from here once the flow starts
const FILL_SPEED = 80, FILL_STEP = 50;  // Fill it now: flow time runs 80× (a 40 s flow in half a second), in 50 ms steps so
                                       // the products meet crossings in the same order they would at speed 1
const FILL_SCORED = 4;                 // and the time bonus counts that time as if pumped at ×4

let S = null;        // { seed, mode, n, score, lives, attempt, phase: "plan" | "flow" | "done" | "over", kit: { plan, clear, pump }, market: { crude, gas }, tool }
let L = null;        // the level
let R = null;        // the run
let clock = { last: 0, planLeft: 0, flowing: 0, filling: false };   // flowing: the time the bonus counts
let raf = 0;
const cells = new Map();   // "x,y" -> { g, flows: [] }

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
// the kit bought between levels with what you've earned: more time to plan, a rock cleared, a pump fitted where you like
const KIT = {
  plan: { name: "+5 s to plan", cost: 150, about: "Five more seconds before the oil comes, on the next level." },
  clear: { name: "Clear a rock", cost: 120, about: "Tap a rock during planning: it becomes a straight." },
  pump: { name: "Fit a pump", cost: 200, about: "Tap a pipe during planning: it becomes a pump of the same shape." },
};
/** Prices drift between levels, a few per cent either way, within 70% and 140% of the list price. */
const drift = (m, r) => Math.min(1.4, Math.max(0.7, +(m * (1 + (r - 0.5) * 0.24)).toFixed(3)));
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const save = () => write(RUN, S);
const levelInfo = () => levelOf(S?.n || 1);

// ---------- the run ----------
function start(mode) {
  S = { seed: mode === "daily" ? today() : randomSeed(), mode, n: 1, score: 0, lives: LIVES, attempt: 0, phase: "plan", kit: { plan: 0, clear: 0, pump: 0 }, market: { crude: 1, gas: 1 }, tool: null };
  save();
  history.replaceState(null, "", mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`);
  beginLevel();
}
/** A level begins: the board, a planning countdown, then the flow. A retry after a spill gets a fresh board. */
function beginLevel() {
  L = makeLevel(S.seed + 7919 * S.attempt, S.n);
  R = newRun(L);
  S.phase = "plan";
  save();
  S.kit ??= { plan: 0, clear: 0, pump: 0 }; S.market ??= { crude: 1, gas: 1 }; S.tool = null;
  clock = { last: performance.now(), planLeft: L.level.plan + 5000 * S.kit.plan, flowing: 0, filling: false };
  S.kit.plan = 0;                                    // the extra time is spent on this level
  drawHud();
  buildBoard();
  $("goBtn").hidden = true;
  $("fillBtn").hidden = false;                       // there from the first moment: fill as soon as the route is ready
  // the note has three lines: each level's news must fit them
  $("note").textContent = L.n === 1 ? `Tap a tile to turn it, hold to turn it back. The lit line shows where the oil will go and the pressure left: only a pump refills it. Pipe costs ${COSTS.tile} a tile, a pump ${COSTS.pump}.`
    : L.n === 3 ? "Two terminals: the far one pays more but costs more pipe and pumps. Take the one that nets more."
    : L.level.place === 0 && L.level.act > 1 ? `Act ${L.level.act}, ${ACTS[L.level.act - 1].name}. ${ACTS[L.level.act - 1].news}` : "";
  drawKit();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(100, now - clock.last);
  clock.last = now;
  if (S.phase === "plan") {
    clock.planLeft -= dt;
    $("status").textContent = `Oil in ${Math.max(0, Math.ceil(clock.planLeft / 1000))} s · level ${L.n}`;
    if (clock.planLeft <= 0) S.phase = "flow";
    return;
  }
  if (S.phase !== "flow") return;
  if (clock.filling) {
    for (let left = dt * FILL_SPEED; left > 0 && !R.over; left -= FILL_STEP) {
      const step = Math.min(FILL_STEP, left);
      advance(L, R, step);
      clock.flowing += step / FILL_SCORED;
    }
  } else {
    clock.flowing += dt;
    advance(L, R, dt);
  }
  drawFlow();
  drawGauges();
  $("status").textContent = `${clock.filling ? "Filling, time at ×4" : "Flowing"} · level ${L.n}`;
  if (R.over) endLevel();
}
function endLevel() {
  const msLeft = Math.max(0, BONUS_WINDOW - clock.flowing);
  const net = score(L, R, msLeft, S.market), earned = net.total;
  S.score += earned;
  $("fillBtn").hidden = true;
  if (R.over.win) {
    S.phase = "done";
    $("status").textContent = `Delivered: +${earned}`;
    $("note").textContent = `${net.revenue} at the terminal${R.reached.length > 1 ? "s" : ""}, −${net.pipe} for ${R.tilesFilled} tiles of pipe, −${net.pumps} for ${R.pumpsFired} pump${R.pumpsFired === 1 ? "" : "s"}, +${net.time} for time.${pickNote()}`;
    $("goBtn").hidden = false;
    $("goBtn").textContent = `Level ${S.n + 1}`;
    $("goBtn").onclick = () => {
      S.n++; S.attempt = 0;
      // a new act gives a life back; prices drift for the next level
      if (levelOf(S.n).place === 0 && S.lives < LIVES) { S.lives++; toast(`Act ${actOf(S.n)}: a life back`); }
      const r = Math.random, m = S.market;
      S.market = { crude: drift(m.crude, r()), gas: drift(m.gas, r()) };
      save(); beginLevel();
    };
    drawKit(true);
  } else {
    S.lives--;
    const why = { "no opening": "a dead end", "the edge": "the edge of the field", "already full": "a pipe that was already full", "wrong product": "the wrong terminal: contamination", pressure: "no pressure left: it needed a pump" }[R.over.why] || R.over.why;
    $("status").textContent = `Spill: ${why}.`;
    $("note").textContent = "Nothing delivered, nothing paid.";
    navigator.vibrate?.([60, 40, 60]);
    markSpill();
    if (S.lives <= 0) { S.phase = "over"; $("goBtn").hidden = false; $("goBtn").textContent = "See how it went"; $("goBtn").onclick = over; }
    else { S.phase = "done"; $("goBtn").hidden = false; $("goBtn").textContent = `Try level ${S.n} again`; $("goBtn").onclick = () => { S.attempt++; save(); beginLevel(); }; drawKit(true); }
  }
  save();
  drawHud();
}
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
    if (t.kind === "well") {
      g.appendChild(el("path", { d: "M18 46 L30 14 L42 46 Z M22 36 H38", fill: "none", stroke: colour, "stroke-width": 3.5, "stroke-linejoin": "round" }));
      g.appendChild(el("rect", { x: 14, y: 44, width: 32, height: 5, rx: 2, fill: colour }));
    } else {
      // a terminal shows what it pays, so a route can be weighed against what it costs
      g.appendChild(el("rect", { x: 7, y: 17, width: 46, height: 27, rx: 6, fill: colour, stroke: "#fff", "stroke-width": 2, class: "term-face" }));
      const price = el("text", { x: 30, y: 35.5, "text-anchor": "middle", "font-size": 14, "font-weight": 800, fill: "#fff", class: "term-face" });
      price.textContent = String(end?.price ?? "");
      g.appendChild(price);
    }
    return;
  }
  if (t.kind === "separator") {
    for (const d of o) g.appendChild(stub(d));
    // a horizontal vessel: gas above the liquid, crude below; its outlets coloured by what leaves them
    const v = el("g", { transform: `rotate(${t.rot * 90} 30 30)` });
    v.appendChild(el("rect", { x: 9, y: 17, width: 42, height: 26, rx: 13, fill: PRODUCTS.fluid.colour, stroke: "#fff", "stroke-width": 2 }));
    v.appendChild(el("path", { d: "M14 33 h32", stroke: "#fff", "stroke-width": 1.5, "stroke-dasharray": "3 2" }));
    v.appendChild(el("circle", { cx: 9, cy: 30, r: 4, fill: PRODUCTS.crude.colour, stroke: "#fff", "stroke-width": 1.5 }));
    v.appendChild(el("circle", { cx: 51, cy: 30, r: 4, fill: PRODUCTS.gas.colour, stroke: "#fff", "stroke-width": 1.5 }));
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
  if (!t.fixed && !t.locked) g.appendChild(el("circle", { cx: TILE - 9, cy: 9, r: 2.5, fill: "var(--pi-tile-edge)" }));
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
  if (S.phase !== "plan" && S.phase !== "flow") return;
  const t = R.tiles[y][x];
  if (S.tool && S.phase === "plan") {                 // the kit: clear a rock, or fit a pump to a pipe
    if (S.tool === "clear" && t.kind === "rock") { Object.assign(t, { kind: "straight", fixed: false }); S.kit.clear--; }
    else if (S.tool === "pump" && ["straight", "bend"].includes(t.kind) && !t.locked) { Object.assign(t, { kind: "pump", shape: t.kind }); S.kit.pump--; }
    else return toast(S.tool === "clear" ? "Tap a rock to clear it." : "Tap a straight or a bend to make it a pump.");
    S.tool = null; save(); drawTile(x, y); drawTrace(); drawKit();
    return;
  }
  if (turn(R, x, y, by)) { drawTile(x, y); drawTrace(); }
  else if (t.locked) toast("That tile's full");
}

// ---------- the trace: where each product will go as the board stands, and the pressure it'll have ----------
function drawTrace() {
  const layer = $("board").querySelector(".pi-trace");
  if (!layer) return;
  layer.replaceChildren();
  for (const line of trace(L, R.tiles)) {
    const pts = [line.from, ...line.cells.map(c => [c.x, c.y])].map(([x, y]) => `${x * TILE + TILE / 2},${y * TILE + TILE / 2}`);
    if (pts.length > 1) {                           // a pale halo under the product's colour, so even crude shows on the dark field
      layer.appendChild(el("polyline", { points: pts.join(" "), class: `pi-trace-halo ${line.end}` }));
      layer.appendChild(el("polyline", { points: pts.join(" "), class: `pi-trace-line ${line.end}`, stroke: PRODUCTS[line.product].colour }));
    }
    const last = line.cells[line.cells.length - 1] || { x: line.from[0], y: line.from[1], pressure: L.level.pressure };
    if (line.end === "separated") continue;
    // at the end of the line: delivered, or why not, with the pressure left
    const [cx, cy] = [last.x * TILE + TILE / 2, last.y * TILE + TILE / 2];
    const tag = line.end === "delivered" ? "✓" : line.end === "dry" ? "dry" : line.end === "wrong" ? "✗" : String(last.pressure);
    const badge = el("g", { class: `pi-trace-end ${line.end}`, transform: `translate(${cx + 16} ${cy - (line.end === "delivered" ? 24 : 15)})` });   // clear of a terminal's price
    badge.appendChild(el("circle", { r: 11 }));
    const t = el("text", { y: 4, "text-anchor": "middle" }); t.textContent = tag; badge.appendChild(t);
    layer.appendChild(badge);
  }
}

// ---------- the kit: bought between levels, used while planning ----------
function drawKit(shop = false) {
  const box = $("kit");
  box.replaceChildren();
  if (shop) {                                        // between levels: the market and the shop
    const m = S.market, pct = v => `${v >= 1 ? "+" : ""}${Math.round((v - 1) * 100)}%`;
    const mk = document.createElement("p"); mk.className = "pi-market";
    mk.textContent = `Prices now: crude ${pct(m.crude)}, gas ${pct(m.gas)} on list. Spend on kit, or keep it on the board.`;
    box.append(mk);
    for (const [id, k] of Object.entries(KIT)) {
      const b = document.createElement("button"); b.type = "button"; b.className = "pi-kit-buy";
      b.textContent = `${k.name} · ${k.cost}${S.kit[id] ? ` (have ${S.kit[id]})` : ""}`; b.title = k.about;
      b.disabled = S.score < k.cost;
      b.addEventListener("click", () => { if (S.score < k.cost) return; S.score -= k.cost; S.kit[id]++; save(); drawHud(); drawKit(true); toast(`${k.name}: bought`); });
      box.append(b);
    }
    return;
  }
  for (const id of ["clear", "pump"]) if (S.kit[id] > 0 && S.phase === "plan") {    // while planning: the kit in hand
    const b = document.createElement("button"); b.type = "button"; b.className = `pi-kit-use${S.tool === id ? " on" : ""}`;
    b.textContent = `${KIT[id].name} ×${S.kit[id]}`;
    b.addEventListener("click", () => { S.tool = S.tool === id ? null : id; drawKit(); });
    box.append(b);
  }
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
/** Fill it now: the oil goes at once (planning ends there), the whole route fills in a moment, and the time it would
 *  have taken counts as if pumped at ×4. A route that isn't ready spills just the same. */
$("fillBtn").addEventListener("click", () => {
  if (S.phase !== "plan" && S.phase !== "flow") return;
  S.phase = "flow";
  clock.planLeft = 0;
  clock.filling = true;
  $("fillBtn").hidden = true;
});
// the menu holds the oil where it is: no frames while it's open, and no catching up after
let heldFrame = false;
onPause(() => { if (S?.phase === "plan" || S?.phase === "flow") { cancelAnimationFrame(raf); heldFrame = true; } },
  () => { if (!heldFrame) return; heldFrame = false; clock.last = performance.now(); raf = requestAnimationFrame(frame); });
document.addEventListener("visibilitychange", () => { if (document.hidden && (S?.phase === "plan" || S?.phase === "flow")) { S.attempt++; save(); beginLevel(); } });   // a level left mid-flow starts over, fresh

// for tests and debugging
window.__pipes = { get state() { return S; }, get level() { return L; }, get run() { return R; }, tap, start, skipPlanning: () => { clock.planLeft = 0; }, applySolution: () => { R.tiles.forEach((row, y) => row.forEach((t, x) => { if (!t.locked && !t.fixed) t.rot = L.solution[y][x]; drawTile(x, y); })); } };

S = read(RUN, null);
const hash = new URLSearchParams(location.hash.slice(1));
const linked = Number(hash.get("d") || hash.get("s")), mode = hash.get("d") ? "daily" : "random";
if (linked && !(S && S.seed === linked && S.mode === mode)) { S = { seed: linked, mode, n: 1, score: 0, lives: LIVES, attempt: 0, phase: "plan" }; save(); beginLevel(); }
else if (!S || S.phase === "over") start("random");
else beginLevel();
