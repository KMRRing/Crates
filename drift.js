// Drift: crates on a quay of some shape (a hull, a pier, a basin...) and the weather, queued five turns ahead. Press an
// empty square and the turn is shown before you let go: the crate laid there, the strays, rock and wave that are coming,
// the wind(s) blown, the lines that would ship ringed and what the turn would score; slide to another square to see it,
// let go to lay the crate. Two games share the page: the Voyage (drift-levels.js: sixteen levels of orders, a new event
// to a section) and Open sail (endless, for the score, on a quay you pick). The rules are drift-engine.js's; this file
// draws the quay, plays each turn out and keeps the game.
import { SHAPES, SHAPE_IDS } from "./drift-shapes.js";
import { WATER, EMPTY, MOORED, SEALED, NAMES, WINDS, QUEUE, newGame, upgrade, lay, blow, shove, lineRuns, worth, stars, foggy, room } from "./drift-engine.js";
import { SECTIONS, LEVELS, levelRules, openRules } from "./drift-levels.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, choice } from "./menu.js";
import { sure, notice } from "./sure.js";
import { roundOver } from "./random.js";
import { IN_FRAME } from "./suite.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "drift:run", VOYAGE = "drift:voyage", MODE = "drift:mode", CAMP = "drift:camp", SHAPE = "drift:shape", BEST = "drift:best", SEEN = "drift:seen", HINT = "drift:hint";
const CELL = 10, PAD = 7;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

let mode = read(MODE, null) || (localStorage.getItem(RUN) ? "open" : "voyage");   // a player with an endless game under way keeps to it
let camp = read(CAMP, null) || { at: 0, stars: {} };
let S = null;            // the game (drift-engine.js's), as saved
let R = null;            // the rules it is played by
let playing = false;     // a turn being played out
let press = null;        // a pointer pressing the quay
let aim = -1;            // the square whose turn is shown
let W = 7, H = 7;        // the quay's size

const inVoyage = () => mode === "voyage";
const level = () => LEVELS[Math.min(camp.at, LEVELS.length - 1)];
const bests = () => { const b = read(BEST, {}); return typeof b === "number" ? { quay: b } : b; };

// ---------- the game kept ----------
function rulesNow() { return inVoyage() ? levelRules(level()) : openRules(read(SHAPE, "quay")); }
const sizeOf = g => SHAPES[g.shape];
const valid = g => g && (g.v === 1 ? Array.isArray(g.cells) && g.cells.length === 49 && Array.isArray(g.winds) : g.v === 2 && SHAPES[g.shape] && g.cells?.length === SHAPES[g.shape].w * SHAPES[g.shape].h && g.plan?.length === QUEUE);
function save() { if (inVoyage()) write(VOYAGE, { level: level().id, game: S }); else write(RUN, S); }
/** The game of the mode now chosen, as it was left (else null). */
function savedGame() {
  if (inVoyage()) { const k = read(VOYAGE, null); return k && k.level === level().id && valid(k.game) && k.game.v === 2 ? k.game : null; }
  const g = read(RUN, null);
  return valid(g) ? (g.v === 1 ? upgrade(openRules("quay"), g) : g) : null;
}
function begin(g) {
  S = g;
  R = inVoyage() ? levelRules(level()) : openRules(S.shape);
  ({ w: W, h: H } = sizeOf(S));
  aim = -1;
  save();
  render();
  introduce();
}
function newRun() { begin(newGame(rulesNow(), Math.floor(Math.random() * 2 ** 31))); }
function resume() { const g = savedGame(); if (g) begin(g); else newRun(); }

/** The event a section brings, said once, the first time a level of it opens. */
async function introduce() {
  if (!inVoyage() || IN_FRAME || S.turns > 0 || S.status !== "play") return;
  const sec = SECTIONS.find(s => s.id === level().section), seen = read(SEEN, []);
  if (!sec.event || seen.includes(sec.event)) return;
  write(SEEN, [...seen, sec.event]);
  await notice(`${sec.name}. ${sec.blurb}`);
}

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const at = i => [(i % W) * CELL, Math.floor(i / W) * CELL];
const xy = (x, y) => y * W + x;
const openAt = (cells, x, y) => x >= 0 && y >= 0 && x < W && y < H && cells[xy(x, y)] !== WATER;
// each good a mark of its own (a dot, a ring, a bar, a chevron), so crates are told apart without their colour
const MARKS = [
  () => el("circle", { class: "dr-fill", cx: 5, cy: 5, r: 1.6 }),
  () => el("circle", { class: "dr-stroke", cx: 5, cy: 5, r: 1.9 }),
  () => el("path", { class: "dr-stroke", d: "M3 5H7" }),
  () => el("path", { class: "dr-stroke", d: "M3.2 5.9L5 3.9L6.8 5.9" }),
];
// the glyphs of the weather and the crates that bring it, in a ten by ten box
const GLYPH = {
  squall: "M2.6 5.2C1 5.2 1 3 2.7 3C3 1.4 5.7 1.2 6.3 2.9C8.2 2.7 8.5 5.2 6.9 5.2ZM3.3 6.7L2.7 8.5M5.3 6.7L4.7 8.5M7.3 6.7L6.7 8.5",
  wave: "M1 4.3Q2.5 1.7 4 4.3T7 4.3T9.4 3.5M1 8Q2.5 5.4 4 8T7 8T9.4 7.2",
  gust: "M1.2 3.4H7.4M5.8 1.8L7.6 3.4L5.8 5M2.6 6.8H8.8M7.2 5.2L9 6.8L7.2 8.4",
  fog: "M1.6 2.6H8.4M2.8 4.7H9M1 6.8H7.4M3.2 8.9H8",
  rock: "M1.8 7.8L2.7 4.1L5.2 2L8 3.7L8.6 7.2L5.8 8.6Z M2.7 4.1L5.4 5.5L8 3.7 M5.4 5.5L5.8 8.6",
  moor: "M5 2.4V8.6M3.2 4H6.8M1.9 6.7C2.3 8.2 3.6 8.8 5 8.8S7.7 8.2 8.1 6.7",
  seal: "M5 2.2L5.9 4L7.9 4.2L6.4 5.5L6.9 7.5L5 6.5L3.1 7.5L3.6 5.5L2.1 4.2L4.1 4Z",
};
function glyph(id, cls = "") {
  const g = el("svg", { viewBox: "0 0 10 10", class: `dr-gl g-${id} ${cls}`.trim(), "aria-hidden": "true" }, el("path", { d: GLYPH[id] }));
  if (id === "moor") g.firstChild.after(el("circle", { cx: 5, cy: 2.3, r: .9 }));
  if (id === "seal") g.firstChild.before(el("circle", { class: "back", cx: 5, cy: 5, r: 4 }));
  return g;
}
/** A crate of good c (a moored one with an anchor in its corner, a sealed one with the harbour master's wax): in a ten by ten box, placed by an outer group so its own can move. */
function crateEl(c, cls = "", [x, y] = [0, 0], kind = 0) {
  const body = el("g", { class: `dr-crate k${c}${kind === MOORED ? " moored" : ""}${kind === SEALED ? " sealed" : ""} ${cls}`.trim() },
    el("rect", { class: "box", x: .7, y: .7, width: 8.6, height: 8.6, rx: 1.2 }),
    el("path", { class: "slat", d: "M1.6 2.9H8.4M1.6 7.1H8.4" }),
    el("path", { class: "bracket", d: "M1.2 2.6V1.2H2.6M7.4 1.2H8.8V2.6M8.8 7.4V8.8H7.4M2.6 8.8H1.2V7.4" }), MARKS[c]());
  if (kind === MOORED) body.append(el("circle", { class: "pin", cx: 7.6, cy: 7.6, r: 1.7 }), el("path", { class: "anchor", d: "M7.6 6.5V8.7M6.8 7.1H8.4M6.6 8.1C6.8 8.8 7.2 9 7.6 9S8.4 8.8 8.6 8.1" }));
  if (kind === SEALED) body.append(el("circle", { class: "wax", cx: 7.4, cy: 2.7, r: 2 }), el("path", { class: "waxstar", d: "M7.4 1.5L7.8 2.4L8.7 2.5L8 3.1L8.2 4L7.4 3.5L6.6 4L6.8 3.1L6.1 2.5L7 2.4Z" }));
  return el("g", { transform: `translate(${x} ${y})`, "data-cell": "" }, body);
}
const crateAt = (c, i, cls, kind) => { const n = crateEl(c, cls, at(i), kind); n.setAttribute("data-cell", i); return n; };
const rockEl = (i, cls = "") => { const [x, y] = at(i); return el("g", { class: `dr-rock ${cls}`.trim(), transform: `translate(${x} ${y})`, "data-cell": i }, el("path", { class: "stone", d: "M1.5 7.6L2.4 3.6L5.1 1.6L8 3.3L8.7 7L5.9 8.6Z" }), el("path", { class: "facet", d: "M2.4 3.6L5.4 5.2L8 3.3M5.4 5.2L5.9 8.6" })); };
const ARROW = ["M0 3.2V-3.2M-2.4-.9L0-3.2L2.4-.9", "M-3.2 0H3.2M.9-2.4L3.2 0L.9 2.4", "M0-3.2V3.2M-2.4 .9L0 3.2L2.4 .9", "M3.2 0H-3.2M-.9-2.4L-3.2 0L-.9 2.4"];
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

/** The sea behind the quay, with the light of a harbour at dusk on it, ticks of swell, and the frame of a chart. */
function seaLayer() {
  const g = el("g", { class: "dr-sea-layer" });
  const w = W * CELL, h = H * CELL;
  g.append(el("defs", {}, el("linearGradient", { id: "drDusk", x1: 0, y1: 0, x2: 0, y2: 1 }, el("stop", { offset: 0, class: "d0" }), el("stop", { offset: 1, class: "d1" }))),
    el("rect", { class: "dr-sea", x: -PAD, y: -PAD, width: w + 2 * PAD, height: h + 2 * PAD }), el("rect", { class: "dr-dusk", x: -PAD, y: -PAD, width: w + 2 * PAD, height: h + 2 * PAD }));
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
    if ((x + y * 2 + 8) % 3 !== 0 || (x >= 0 && y >= 0 && x < W && y < H && S.cells[xy(x, y)] !== WATER)) continue;
    const cx = x * CELL + 1.5, cy = y * CELL + 5.5;
    if (cx < -PAD + 1 || cx > w + PAD - 4 || cy < -PAD + 1 || cy > h + PAD - 1) continue;
    g.append(el("path", { class: "dr-swell", d: `M${cx} ${cy}q1.7-1.9 3.4 0t3.4 0` }));
  }
  return g;
}
/** The chart's frame: a double rule round the sea, ticks on it, and a compass rose in a corner of water whose needle is the wind. */
function frameLayer(wind) {
  const g = el("g", { class: "dr-frame" }), w = W * CELL, h = H * CELL;
  g.append(el("rect", { class: "outer", x: -PAD + .6, y: -PAD + .6, width: w + 2 * PAD - 1.2, height: h + 2 * PAD - 1.2, rx: 1 }));
  for (let k = 1; k < W; k++) g.append(el("path", { class: "tick", d: `M${k * CELL} ${-PAD + .6}v1.1M${k * CELL} ${h + PAD - .6}v-1.1` }));
  for (let k = 1; k < H; k++) g.append(el("path", { class: "tick", d: `M${-PAD + .6} ${k * CELL}h1.1M${w + PAD - .6} ${k * CELL}h-1.1` }));
  // the rose sits in the first corner of the grid that is water, else in the margin
  const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]], free = corners.find(([x, y]) => S.cells[xy(x, y)] === WATER);
  const [cx, cy, r] = free ? [free[0] * CELL + 5, free[1] * CELL + 5, 3.6] : [w + PAD / 2 - .3, -PAD / 2 + .3, 2.6];
  const rose = el("g", { class: "dr-rose", transform: `translate(${cx} ${cy})` });
  rose.append(el("circle", { r, class: "ring" }), el("path", { class: "star", d: `M0 ${-r}L${r * .22} ${-r * .22}L${r} 0L${r * .22} ${r * .22}L0 ${r}L${-r * .22} ${r * .22}L${-r} 0L${-r * .22} ${-r * .22}Z` }),
    el("path", { class: "needle", d: ARROW[wind], transform: `scale(${r / 4.1})` }));
  g.append(rose);
  return g;
}
/** The quay: planked deck, its coast in brass, and on the coast the wind blows to a heavier line where crates will pile. */
function deckLayer(cells, wind) {
  const g = el("g", { class: "dr-deck" });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!openAt(cells, x, y)) continue;
    g.append(el("rect", { class: "plank", x: x * CELL, y: y * CELL, width: CELL, height: CELL }), el("path", { class: "seam", d: `M${x * CELL} ${y * CELL + 3.4}h${CELL}M${x * CELL} ${y * CELL + 6.7}h${CELL}` }));
  }
  const coast = el("g", { class: "coast" }), lee = el("g", { class: "lee" });
  const side = (x, y, d) => { // the edge of cell (x, y) towards d: 0 north, 1 east, 2 south, 3 west
    const x0 = x * CELL, y0 = y * CELL, x1 = x0 + CELL, y1 = y0 + CELL;
    return [`M${x0} ${y0}H${x1}`, `M${x1} ${y0}V${y1}`, `M${x0} ${y1}H${x1}`, `M${x0} ${y0}V${y1}`][d];
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!openAt(cells, x, y)) continue;
    for (let d = 0; d < 4; d++) {
      if (openAt(cells, x + DX[d], y + DY[d])) continue;
      coast.append(el("path", { d: side(x, y, d) }));
      if (d === wind) lee.append(el("path", { d: side(x, y, d) }));
    }
  }
  g.append(el("g", { class: "gridl" }, ...grid(cells)), coast, lee);
  return g;
}
function grid(cells) {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!openAt(cells, x, y)) continue;
    if (openAt(cells, x + 1, y)) out.push(el("path", { d: `M${(x + 1) * CELL} ${y * CELL}v${CELL}` }));
    if (openAt(cells, x, y + 1)) out.push(el("path", { d: `M${x * CELL} ${(y + 1) * CELL}h${CELL}` }));
  }
  return out;
}
/** The band a rogue wave will push along: over the quay in its row or column, with its arrows. */
function waveLayer(wave) {
  const g = el("g", { class: "dr-waveband" });
  for (let k = 0; k < (wave.axis === 0 ? W : H); k++) {
    const x = wave.axis === 0 ? k : wave.at, y = wave.axis === 0 ? wave.at : k;
    if (!openAt(S.cells, x, y)) continue;
    const a = wave.axis === 0 ? (wave.dir > 0 ? 1 : 3) : (wave.dir > 0 ? 2 : 0), [px, py] = [x * CELL, y * CELL];
    g.append(el("rect", { x: px, y: py, width: CELL, height: CELL }), el("path", { class: "chev", d: ARROW[a], transform: `translate(${px + 5} ${py + 5}) scale(.8)` }));
  }
  return g;
}
/**
 * The quay: these cells, with extra: { ring (squares to ring), tag ([text,
 * square]), fresh (squares just filled), wind (the edge to mark), stakes (the moored squares, S's by default), strays
 * (the squall's coming, drawn faint, S's by default), reef (the rock's square), wave (a wave's band), rocks, sealAt (the square of a sealed crate) }.
 */
function drawBoard(cells, extra = {}) {
  const wind = extra.wind ?? S.plan[0].w, stakes = new Set(extra.stakes || S.stakes), rocks = extra.rocks || S.rocks;
  $("board").setAttribute("viewBox", `${-PAD} ${-PAD} ${W * CELL + 2 * PAD} ${H * CELL + 2 * PAD}`);
  $("board").style.setProperty("--ar", (W * CELL + 2 * PAD) / (H * CELL + 2 * PAD));
  const crates = el("g", { id: "tiles" });
  for (const i of rocks) crates.append(rockEl(i, extra.fresh?.includes(i) ? "fresh" : ""));
  const ahead = extra.omens !== false;
  if (ahead) {
    const reef = extra.reef ?? S.reef;
    if (reef >= 0 && cells[reef] === EMPTY) crates.append(rockEl(reef, "omen"));
    for (const q of extra.strays ?? S.strays) if (cells[q.at] === EMPTY) crates.append(crateAt(q.colour, q.at, "stray"));
  }
  cells.forEach((c, i) => { if (c >= 0) crates.append(crateAt(c, i, extra.fresh?.includes(i) ? "fresh" : "", stakes.has(i) ? MOORED : extra.sealAt === i ? SEALED : 0)); });
  const marks = el("g", {});
  for (const i of extra.ring || []) { const [x, y] = at(i); marks.append(el("rect", { class: "dr-ring", x: x + .2, y: y + .2, width: 9.6, height: 9.6, rx: 1.4 })); }
  if (extra.tag) {
    const [x, y] = at(extra.tag[1]), t = el("text", { class: "dr-tag", x: Math.min(W * CELL - 8, Math.max(8, x + CELL / 2)), y: Math.max(3.4, y - 1.4) });
    t.textContent = extra.tag[0];
    marks.append(t);
  }
  const wave = extra.wave === undefined ? S.plan[0].wave : extra.wave;
  const kids = [seaLayer(), deckLayer(cells, wind), ...(wave && ahead ? [waveLayer(wave)] : []), crates, marks, frameLayer(wind)];
  if (!read(HINT, false) && S.turns < 3 && S.status === "play" && !extra.fresh) {
    kids.push(el("g", { class: "dr-hint" }, ...["Press a square to see the turn:", "the crate, then the wind", "blows everything one way"].map((t, k) => {
      const n = el("text", { x: W * CELL / 2, y: H * CELL / 2 - 4 + k * 5.4 });
      n.textContent = t;
      return n;
    })));
  }
  kids.push(el("g", { id: "fx" }));
  $("board").replaceChildren(...kids);
}

// ---------- the strip, the orders, the queue ----------
const stat = (label, value) => { const s = document.createElement("span"), b = document.createElement("b"); b.textContent = value; s.append(`${label} `, b); return s; };
function drawStrip() {
  const best = bests()[S.shape] || 0;
  $("strip").replaceChildren(...(inVoyage()
    ? [stat("Turn", `${Math.min(S.turns + (S.status === "play" ? 1 : 0), R.turns)}/${R.turns}`), stat("Score", fmt(S.score)), stat("Room", room(S))]
    : [stat("Score", fmt(S.score)), stat("Room", room(S)), stat("Best", fmt(Math.max(best, S.score)))]));
}
function drawOrders() {
  const box = $("orders");
  box.hidden = !inVoyage();
  if (!inVoyage()) return;
  box.replaceChildren(...R.orders.flatMap((n, c) => {
    if (!n) return [];
    const have = Math.min(S.shipped[c], n), d = document.createElement("div");
    d.className = "dr-order" + (have >= n ? " full" : "");
    const svg = el("svg", { viewBox: "0 0 10 10", "aria-hidden": "true" }, crateEl(c));
    const t = document.createElement("div"), b = document.createElement("b"), bar = document.createElement("i");
    b.textContent = `${have}/${n}`;
    t.className = "txt";
    t.append(b, R.runs[c] ? ` lines of ${R.runs[c]}+` : ` ${NAMES[c]}`);
    bar.style.setProperty("--p", `${Math.round(100 * have / n)}%`);
    d.append(svg, t, bar);
    d.setAttribute("aria-label", `${NAMES[c]}: ${have} of ${n} shipped${R.runs[c] ? `, in lines of ${R.runs[c]} or more` : ""}`);
    return [d];
  }));
}
const arrowSvg = (w, cls) => el("svg", { viewBox: "-5 -5 10 10", class: cls, "aria-hidden": "true" }, el("path", { class: "dr-arrow", d: ARROW[w] }));
/** Each queued turn in a column: its crate, its wind (and a second gust's), and the weather it brings. */
function queueCol(k) {
  const col = document.createElement("div"), item = S.next[k], p = S.plan[k], hidden = k > 0 && foggy(S);
  col.className = `dr-q${k === 0 ? " now" : ""}${hidden ? " fog" : ""}`;
  if (hidden) {
    col.append(glyph("fog", "veil"));
    return col;
  }
  col.append(el("svg", { viewBox: "0 0 10 10", class: "dr-cr", "aria-hidden": "true" }, crateEl(item.c, "", [0, 0], item.k)));
  const winds = document.createElement("div");
  winds.className = "winds";
  winds.append(arrowSvg(p.w, "w1"), ...(p.w2 != null ? [arrowSvg(p.w2, "w2")] : []));
  col.append(winds);
  const ev = document.createElement("div");
  ev.className = "ev";
  if (p.squall) ev.append(glyph("squall"));
  if (p.wave) ev.append(glyph("wave"));
  if (p.rock) ev.append(glyph("rock"));
  if (p.fog) ev.append(glyph("fog"));
  if (p.w2 != null) ev.append(glyph("gust"));
  if (item.k === MOORED) ev.append(glyph("moor"));
  if (item.k === SEALED) ev.append(glyph("seal"));
  col.append(ev);
  return col;
}
const describeTurn = k => {
  const item = S.next[k], p = S.plan[k], out = [`${NAMES[item.c]} crate${item.k === MOORED ? ", moored" : item.k === SEALED ? ", sealed" : ""}`, `wind ${WINDS[p.w]}`];
  if (p.w2 != null) out.push(`then ${WINDS[p.w2]}`);
  if (p.squall) out.push("squall");
  if (p.wave) out.push("rogue wave");
  if (p.rock) out.push("rock");
  if (p.fog) out.push("fog");
  return out.join(", ");
};
function weatherWords() {
  const p = S.plan[0], item = S.next[0], bits = [];
  if (S.strays.length) bits.push(`a squall drops ${S.strays.length === 1 ? "a stray crate" : `${S.strays.length} stray crates`} where shown`);
  if (S.reef >= 0) bits.push("a rock rises where shown");
  if (p.wave) bits.push(`a wave shoves the marked ${p.wave.axis === 0 ? "row" : "column"} ${WINDS[p.wave.axis === 0 ? (p.wave.dir > 0 ? 1 : 3) : (p.wave.dir > 0 ? 2 : 0)]}`);
  if (p.fog) bits.push("fog hides what follows");
  if (item.k === MOORED) bits.push("this crate is moored: it stays put");
  if (item.k === SEALED) bits.push(`this seal ships every ${NAMES[item.c]}`);
  const wind = `the wind blows ${WINDS[p.w]}${p.w2 != null ? `, then ${WINDS[p.w2]}` : ""}`;
  const s = (bits.length ? bits.join("; ") + ", " : "") + wind;
  return s[0].toUpperCase() + s.slice(1);
}
function drawSide(text) {
  const over = S.status !== "play";
  $("tray").hidden = over;
  $("result").hidden = !over;
  if (over) {
    const next = $("nextBtn");
    next.hidden = true;
    if (inVoyage()) {
      const n = stars(R, S);
      $("verdict").textContent = S.status === "won" ? `Orders filled${"★".repeat(n) ? ": " + "★".repeat(n) + "☆".repeat(3 - n) : ""}, ${plural(R.turns - S.turns, "turn")} to spare` : S.why;
      $("againBtn").textContent = S.status === "won" ? "Replay" : "Try again";
      next.hidden = !(S.status === "won" && camp.at < LEVELS.length - 1);
    } else {
      const best = bests()[S.shape] || 0;
      $("verdict").textContent = `No room left on the quay: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
      $("againBtn").textContent = "New game";
    }
    return;
  }
  $("coming").replaceChildren(...Array.from({ length: QUEUE }, (_, k) => queueCol(k)));
  $("coming").setAttribute("aria-label", `Coming: ${Array.from({ length: QUEUE }, (_, k) => (k > 0 && foggy(S) ? "hidden by fog" : describeTurn(k))).join("; then ")}`);
  $("line").textContent = text ?? (inVoyage() && S.turns === 0 && !read(HINT, false) ? level().note : weatherWords());
}
function render() { drawBoard(S.cells); drawStrip(); drawOrders(); drawSide(); }

const shipWords = by => by.map((n, c) => (n ? `${n} ${NAMES[c]}` : "")).filter(Boolean).join(", ");
/** The turn a square would make, shown: the quay after the first wind, the lines that would ship ringed, what it would do. */
function show(i) {
  const r = lay(R, S, i), first = blow(S.shape, r.start, r.winds[0], r.stakes0).cells;
  const ring = lineRuns(S.shape, first).size ? [...lineRuns(S.shape, first).keys()] : [];
  if (r.sealed >= 0) first.forEach((c, j) => { if (c === r.sealed && !ring.includes(j)) ring.push(j); });
  const rocks = r.reef >= 0 ? [...S.rocks, r.reef] : S.rocks;
  drawBoard(first, { ring, tag: r.gain ? [`+${fmt(r.gain)}`, i] : null, stakes: r.laid.k === MOORED ? [...r.stakes0] : r.stakes0, strays: [], reef: -1, wave: null, rocks, wind: r.winds[0], omens: false });
  const t = r.state;
  let words = r.cleared ? `Ships ${r.cleared}: ${shipWords(r.by)}${r.gain ? ` (+${fmt(r.gain)})` : ""}` : `Blown ${WINDS[r.winds[0]]}: nothing ships`;
  if (inVoyage()) {
    const spent = r.by.reduce((a, n, c) => a + (R.orders[c] && S.shipped[c] < R.orders[c] ? n - r.ok[c] : 0), 0);
    if (spent) words += `; ${plural(spent, "crate")} in a line too short for the order: wasted`;
    if (t.status === "won") words += "; fills the last order";
    else if (t.status === "lost") words += `; ${t.why.toLowerCase().replace(/\.$/, "")}`;
  } else if (t.status === "lost") words += "; and the quay is full";
  if (r.winds.length > 1) words += `; then ${WINDS[r.winds[1]]}`;
  drawSide(words);
}

// ---------- a turn ----------
const wait = ms => new Promise(r => setTimeout(r, document.hidden ? 0 : ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
const node = i => $("board").querySelector(`#tiles [data-cell="${i}"] > g`);
async function commit(i) {
  if (playing || S.status !== "play") return;
  playing = true;
  aim = -1;
  const before = S, r = lay(R, S, i);
  S = r.state;
  save();
  write(HINT, true);
  noteBest();
  drawSide(" ");
  // the crate laid, the squall's strays and the rock, the wave, then the wind gust by gust, a sealed crate's shipment among them
  let cells = before.cells.slice(), stakes = r.laid.k === MOORED ? [...before.stakes, i] : before.stakes.slice(), rocks = before.rocks.slice();
  cells[i] = r.laid.c;
  const wind = before.plan[0].w;
  const show_ = extra => drawBoard(cells, { wind, stakes, strays: [], reef: -1, wave: null, rocks, ...extra });
  show_({ fresh: [i], strays: before.strays, reef: before.reef, wave: before.plan[0].wave, sealAt: r.laid.k === SEALED ? i : -1 });
  await animate(node(i), [{ transform: "scale(.4)", opacity: .3 }, { transform: "scale(1)", opacity: 1 }], { duration: 160, easing: "ease-out" });
  if (r.squall.length || r.reef >= 0) {
    for (const { at: j, colour } of r.squall) cells[j] = colour;
    if (r.reef >= 0) { cells[r.reef] = WATER; rocks = [...rocks, r.reef]; }
    show_({ fresh: [...r.squall.map(q => q.at), ...(r.reef >= 0 ? [r.reef] : [])], wave: before.plan[0].wave });
    await Promise.all([...r.squall.map(q => animate(node(q.at), [{ transform: "scale(.7)", opacity: .4 }, { transform: "scale(1)", opacity: 1 }], { duration: 220, easing: "ease-out" })), ...(r.reef >= 0 ? [animate(node(r.reef), [{ transform: "scale(.3)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 300, easing: "ease-out" })] : [])]);
  }
  if (r.wave) {
    const w = shove(S.shape, cells, r.wave, stakes);
    cells = w.cells;
    show_({});
    await Promise.all(w.moved.map(([f, t]) => { const [fx, fy] = at(f), [tx, ty] = at(t); return animate(node(t), [{ transform: `translate(${fx - tx}px, ${fy - ty}px)` }, { transform: "translate(0, 0)" }], { duration: 260, easing: "ease-in-out" }); }));
  }
  for (const gust of r.gusts) {
    if (!gust.sealed) {
      const b = blow(S.shape, cells, gust.wind, stakes);
      cells = b.cells;
      drawBoard(cells, { wind: gust.wind, stakes, strays: [], reef: -1, wave: null, rocks });
      await Promise.all(b.moved.map(([f, t]) => { const [fx, fy] = at(f), [tx, ty] = at(t); return animate(node(t), [{ transform: `translate(${fx - tx}px, ${fy - ty}px)` }, { transform: "translate(0, 0)" }], { duration: 200, easing: "ease-in" }); }));
    }
    if (!gust.cleared.length) continue;
    drawBoard(cells, { ring: gust.cleared, wind: gust.wind, stakes, strays: [], reef: -1, wave: null, rocks });
    await Promise.all(gust.cleared.map(j => animate(node(j), [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.4)", opacity: 0 }], { duration: 260, easing: "ease-in" })));
    for (const j of gust.cleared) cells[j] = EMPTY;
    stakes = stakes.filter(j => cells[j] >= 0);
  }
  render();
  if (r.gain) popup(r.gusts.flatMap(g => g.cleared), r.gain);
  playing = false;
  if (S.status === "won" && inVoyage()) wonLevel();
  if (S.status !== "play") roundOver("drift");
}
function noteBest() {
  if (inVoyage()) return;
  const b = bests();
  if (S.score > (b[S.shape] || 0)) write(BEST, { ...b, [S.shape]: S.score });
}
function wonLevel() {
  const n = stars(R, S), id = level().id;
  if (n > (camp.stars[id] || 0)) { camp.stars[id] = n; write(CAMP, camp); }
}
function popup(cells, gain) {
  const fx = $("board").querySelector("#fx"), u = [...new Set(cells)];
  if (!fx || !u.length) return;
  const x = u.reduce((a, k) => a + at(k)[0], 0) / u.length + CELL / 2, y = u.reduce((a, k) => a + at(k)[1], 0) / u.length + CELL / 2;
  const t = el("text", { class: `dr-pop${u.length >= 6 ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = `+${fmt(gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 1000, easing: "ease-out" });
}

// ---------- pressing the quay ----------
function cellAt(px, py) {
  const m = $("board").getScreenCTM();
  if (!m) return -1;
  const p = new DOMPoint(px, py).matrixTransform(m.inverse()), x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
  return openAt(S.cells, x, y) ? xy(x, y) : -1;
}
function aimAt(e) {
  const k = cellAt(e.clientX, e.clientY), omen = S.strays.some(q => q.at === k) || S.reef === k, i = k >= 0 && S.cells[k] === EMPTY && !omen ? k : -1;
  if (i === aim && !omen) return;
  aim = i;
  if (i >= 0) show(i);
  else { drawBoard(S.cells); drawSide(omen ? "Something lands there with the weather: lay the crate elsewhere" : undefined); }
}
$("board").addEventListener("pointerdown", e => {
  if (playing || S.status !== "play" || e.button > 0 || cellAt(e.clientX, e.clientY) < 0) return;
  e.preventDefault();
  press = e.pointerId;
  aim = -2;
  aimAt(e);
});
addEventListener("pointermove", e => {
  if (press === e.pointerId) aimAt(e);
  else if (press == null && !playing && S.status === "play" && e.pointerType === "mouse" && e.target.closest?.("#board")) aimAt(e);   // a mouse shows a turn as it passes
});
addEventListener("pointerup", e => {
  if (press !== e.pointerId) return;
  press = null;
  const i = cellAt(e.clientX, e.clientY);
  if (i >= 0 && i === aim) commit(i);
  else { aim = -1; render(); }
});
addEventListener("pointercancel", e => { if (press === e.pointerId) { press = null; aim = -1; render(); } });
$("board").addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && press == null && aim >= 0 && !playing) { aim = -1; render(); } });

// ---------- the menu ----------
/** The menu's big button: a game that has scored is asked about before it is thrown away. */
async function restart() {
  if (S.status === "play" && S.turns > 0 && !(await sure(inVoyage() ? `Replay ${level().name}? The game in it is lost; your stars stay.` : `Start a new game? This one is at ${fmt(S.score)}.`, { yes: inVoyage() ? "Replay" : "New game" }))) return;
  newRun();
}
function setMode(next) {
  if (next === mode) return;
  mode = next;
  write(MODE, mode);
  resume();
}
function playLevel(n) {
  camp.at = n;
  write(CAMP, camp);
  mode = "voyage";
  write(MODE, mode);
  resume();
}
/** The levels by section: each section's event in its glyph, each level its quay, its name and its stars. */
function levelList() {
  const wrap = document.createElement("div");
  wrap.className = "dr-levels";
  for (const sec of SECTIONS) {
    const head = document.createElement("div");
    head.className = "dr-sec";
    head.append(...(sec.event ? [glyph(sec.event)] : []), `${sec.id}. ${sec.name}`);
    const row = document.createElement("div");
    row.className = "dr-lrow";
    for (const l of sec.levels) {
      const n = LEVELS.findIndex(x => x.id === l.id), won = camp.stars[l.id] || 0, b = document.createElement("button");
      b.type = "button";
      b.className = (won ? "done " : "") + (inVoyage() && n === camp.at ? "cur" : "");
      b.setAttribute("aria-label", `Level ${l.id}, ${l.name}, ${SHAPES[l.shape].name}${won ? `, ${plural(won, "star")}` : ""}`);
      const num = document.createElement("b"), name = document.createElement("span"), st = document.createElement("span");
      num.textContent = l.id;
      name.textContent = l.name;
      st.className = "st";
      st.textContent = won ? "★".repeat(won) + "☆".repeat(3 - won) : "☆☆☆";
      b.append(miniShape(l.shape), num, name, st);
      b.addEventListener("click", () => { $("menuDlg").close(); playLevel(n); });
      row.append(b);
    }
    wrap.append(head, row);
  }
  return wrap;
}
/** A quay in miniature. */
function miniShape(id) {
  const sh = SHAPES[id], svg = el("svg", { viewBox: `-1 -1 ${sh.w + 2} ${sh.h + 2}`, class: "dr-mini", "aria-hidden": "true" });
  sh.open.forEach((o, i) => { if (o) svg.append(el("rect", { x: i % sh.w, y: Math.floor(i / sh.w), width: 1, height: 1 })); });
  return svg;
}
async function pickShape(id) {
  if (id === S.shape && !inVoyage()) return;
  if (!inVoyage() && S.turns > 0 && S.status === "play" && !(await sure(`Start a new game on the ${SHAPES[id].name.toLowerCase()}? This one is at ${fmt(S.score)}.`, { yes: "New game" }))) { openMenu(); return; }
  write(SHAPE, id);
  write(RUN, null);
  mode = "open";
  write(MODE, mode);
  resume();
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action(inVoyage() ? `Replay ${level().name}` : "New game", restart, "primary"));
  const content = part(body, "content");
  content.append(choice("Game", [["voyage", "Voyage"], ["open", "Open sail"]], mode, m => { setMode(m); openMenu(); }));
  if (inVoyage()) content.append(levelList());
  else content.append(choice("Quay", SHAPE_IDS.map(id => [id, SHAPES[id].name]), S.shape, pickShape));
  const best = bests()[S.shape] || 0, beaten = Object.keys(camp.stars).length, total = Object.values(camp.stars).reduce((a, b) => a + b, 0), about = part(body, "about");
  about.append(line(inVoyage()
    ? `This game: ${fmt(S.score)} in ${plural(S.turns, "turn")}; ${beaten} of ${LEVELS.length} levels filled, ${plural(total, "star")}`
    : `This game: ${fmt(S.score)} in ${plural(S.turns, "turn")}${best ? `; your best on the ${SHAPES[S.shape].name.toLowerCase()} ${fmt(best)}` : ""}`));
  about.append(line("The weather: a squall blows stray crates on to the quay; a rogue wave shoves a row or column one square; a second gust follows the wind; fog hides the queue; a rock rises from the water; a moored crate stays put; a sealed crate ships every crate of its good. Each is forecast in the queue under the field, and drawn on the quay a turn ahead."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "drift");
document.querySelector(".dr-mark").innerHTML = APPS.find(a => a.id === "drift").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", () => newRun());
$("nextBtn").addEventListener("click", () => playLevel(Math.min(camp.at + 1, LEVELS.length - 1)));

// for tests and debugging
window.__drift = { get state() { return S; }, get rules() { return R; }, commit, cellAt, newRun, playLevel, setMode, show };

resume();
