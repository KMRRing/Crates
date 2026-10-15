// Delta: join the numbers in pairs with paths whose operations turn one into the other (rules in delta-gen.js).
// Solo boards are saved in this browser; together games live in the room's delta branch (together.js, delta-room.js),
// a pair's or a party's of up to six, and everyone draws on the same board, each in their own colour.
import { today, noteDayTime, arrivedForToday } from "./suite.js";
const DAILY_LEVEL = "medium";      // today's puzzle: a medium board, the same for everyone
import { generate, LEVELS, CLUES, evaluate, isSolved, showOp, showValue, valueAlong, unkey, key, adjacent } from "./delta-gen.js";
import { pathList, withPath, freshTable, presentSlots, drawingsOf, drawnBy } from "./delta-room.js";
import { createTogether, seatsOf } from "./together.js";
import { bindSwitcher, APPS } from "./apps.js";
import { busy, sextant } from "./loading.js";
import "./pwa.js";
import { gameHref, GAMES, branchPath, otherHere, joiningWords } from "./rooms.js";
import { dropdown } from "./dropdown.js";
import { part, action, mirror, isPaused, onPause } from "./menu.js";

dropdown(document.getElementById("level"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
const STORE = "delta:solo", SPARES = "delta:spares";
const APP = 2;                                       // together games: bumped when their shape changes (2: up to six, paths by player)
const COLOURS = 6;                                   // path colours (--d-p0…)
const SQ3 = Math.sqrt(3);
const randomSeed = () => Math.floor(Math.random() * 1e9);

// S: { seed, level, board, paths: { id: { c, k: "q,r;q,r;…", by? } }, clues: [pair index], done, ms, startedAt }
let S = null;
let drawing = null;   // the path under the finger: { id, c, cells }
let clockFrom = null;
let shownDone = null;
let joining = null;   // the rete while you sit down at a table in the address, until its board is drawn

const newId = () => Math.random().toString(36).slice(2, 8);

// ---------- dealing ----------
// Boards are found in a worker so the screen stays responsive (a hard one can take a second or two on a phone). Where
// there's no worker (no module workers, or its script wouldn't load), boards are dealt on the page: a board asked of
// a worker that failed is dealt there too, instead of never coming.
let worker = null, workerless = false, dealt = 0;
const waiting = new Map();            // id -> { resolve, seed, level }
function deal(seed, level) {
  if (workerless) return Promise.resolve(generate(seed, level));
  try {
    worker ||= new Worker(new URL("./delta-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { waiting.get(e.data.id)?.resolve(e.data.board); waiting.delete(e.data.id); };
    worker.onerror = () => {
      workerless = true; worker = null;
      for (const w of waiting.values()) w.resolve(generate(w.seed, w.level));
      waiting.clear();
    };
  } catch { workerless = true; return Promise.resolve(generate(seed, level)); }
  const id = ++dealt;
  return new Promise(resolve => { waiting.set(id, { resolve, seed, level }); worker.postMessage({ id, seed, level }); });
}

// A spare board per level is dealt in the background and kept, so New board is instant even on Hard.
function spares() { try { return JSON.parse(localStorage.getItem(SPARES)) || {}; } catch { return {}; } }
function takeSpare(level) {
  const all = spares(), spare = all[level];
  if (!spare?.board) return null;
  delete all[level];
  try { localStorage.setItem(SPARES, JSON.stringify(all)); } catch { /* private mode */ }
  return spare;
}
const refilling = new Set();
/** Deals a spare for this level if it has none, then for any other level missing one (one at a time). */
function refill(level) {
  if (refilling.size) return;
  const missing = [level, ...Object.keys(LEVELS).filter(l => l !== level)].find(l => !spares()[l]);
  if (!missing) return;
  refilling.add(missing);
  const seed = randomSeed();
  deal(seed, missing).then(board => {
    refilling.delete(missing);
    if (!board) return;
    const all = spares();
    all[missing] = { seed, board };
    try { localStorage.setItem(SPARES, JSON.stringify(all)); } catch { /* private mode */ }
    refill(level);
  });
}
/** A new board for this level: the spare if there is one (instant), else dealt now. */
async function nextBoard(level) {
  const spare = takeSpare(level);
  refill(level);
  if (spare) return spare;
  const seed = randomSeed();
  return { seed, board: await deal(seed, level) };
}

// ---------- solo ----------
function loadSolo() {
  try { const s = JSON.parse(localStorage.getItem(STORE)); return s?.board ? s : null; } catch { return null; }
}
function saveSolo() { if (!together.room) try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* private mode */ } }

/** Starts a solo board: this seed's, or (no seed) the next one for the level. */
async function soloBoard(seed, level) {
  const done = busy("Dealing the board", { delay: 250 });   // a hard board can take a moment
  let board;
  try {
    if (seed) board = await deal(seed, level);
    else ({ seed, board } = await nextBoard(level));
  } finally { done(); }
  if (!board) { toast("Couldn't make a board, try again"); return; }
  refill(level);
  S = { seed, level, board, paths: {}, clues: [], done: null, ms: 0 };
  shownDone = null;
  clockFrom = null;
  clockRun();
  saveSolo();
  history.replaceState(null, "", `#s=${seed}&d=${level}`);
  render();
}

/** Deals a new board (a hard one can take a moment, so the screen says so first). */
function newBoard(level = S.level) {
  if (S && !S.done && pathList(S.paths).length && !confirm("Start a new board? This one isn't finished.")) { render(); return; }
  if (level === "today") {                                     // today's puzzle: solo, timed for the games screen
    if (together.room) { render(); return; }
    soloBoard(today(), DAILY_LEVEL).then(() => { if (S) { S.daily = today(); saveSolo(); render(); } }); return;
  }
  if (!together.room) { soloBoard(null, level); return; }
  const done = busy("Dealing the board", { delay: 250 });
  nextBoard(level).finally(done).then(({ seed, board }) => {
    if (!board) { toast("Couldn't make a board, try again"); return; }
    together.act(g => { Object.assign(g, { level, seed, board, paths: {}, clues: [], done: null, startedAt: Date.now() }); });
  });
}

// ---------- the clock (solo: time on screen; together: dealt to finished) ----------
function clockRun() { if (!together.room && !joining && S && !S.done && clockFrom == null && !document.hidden && !isPaused()) clockFrom = performance.now(); }
onPause(() => clockPause(), () => clockRun());   // the menu stops the clock too
function clockPause() {
  if (clockFrom == null) return;
  S.ms = (S.ms || 0) + performance.now() - clockFrom;
  clockFrom = null;
  saveSolo();
}
function elapsed() {
  if (S.startedAt) return (S.done?.at || Date.now()) - S.startedAt;
  return (S.ms || 0) + (clockFrom != null ? performance.now() - clockFrom : 0);
}
const clockText = ms => {
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, pad = n => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

// ---------- changes ----------
/** Applies a change to the game: the solo save, or the room in one transaction. */
async function change(fn) {
  if (together.room) return together.act(g => { g.paths ||= {}; g.clues = Object.values(g.clues || {}); return fn(g); });
  if (fn(S) === false) return false;
  afterChange();
  return true;
}
function afterChange() {
  if (!S.done && isSolved(S.board, pathList(S.paths).map(p => p.cells))) {
    clockPause();
    if (S.daily && !together.room) noteDayTime("delta", (S.ms || 0) / 1000, S.daily);    // today's puzzle: the first solve's time
    const at = Date.now();
    if (together.room) together.act(g => { if (g.done) return false; g.done = { won: true, at }; });
    else S.done = { won: true, at };
  }
  saveSolo();
  render();
}

function commit(id, colour, cells) {
  const tidy = cells.length >= 2 ? cells : [];
  if (together.room) {
    const by = together.room.uid;
    S.paths = withPath(S.paths, id, colour, tidy, by);   // shown at once; the room's copy follows
    render();
    // the path under your finger stops showing on the others' screens once the drawn one is there
    together.act(g => { if (g.done) return false; g.paths = withPath(g.paths || {}, id, colour, tidy, by); }).finally(() => shareDrawing(true));
    return;
  }
  change(g => { if (g.done) return false; g.paths = withPath(g.paths, id, colour, tidy); });
}

function clue() {
  if (S.done) return;
  const pairs = S.board.sol;
  if (LEVELS[S.level].pairsShown) { toast("On Easy every pair is shown"); return; }
  const left = CLUES - S.clues.length;
  if (left <= 0) { toast("No clues left on this board"); return; }
  const next = pairs.findIndex((_, i) => !S.clues.includes(i));
  if (next < 0) return;
  change(g => { if (g.done || g.clues.length >= CLUES || g.clues.includes(next)) return false; g.clues.push(next); });
}

function clearAll() {
  if (S.done || !pathList(S.paths).length) return;
  // at a table, Clear takes everyone's paths: asked first when some are someone else's
  const me = together.room?.uid;
  if (me && pathList(S.paths).some(p => p.by && p.by !== me) && !confirm("Clear every path on the board, the others' too?")) return;
  change(g => { if (g.done) return false; g.paths = {}; });
}

function giveUp() {
  if (S.done) { showDone(); return; }
  if (!confirm("Show the solution and end this board?")) return;
  clockPause();
  const paths = Object.fromEntries(S.board.sol.map((p, i) => [`s${i}`, { c: i, k: p.cells.join(";") }]));
  change(g => { if (g.done) return false; g.paths = paths; g.done = { won: false, at: Date.now() }; });
}

// ---------- geometry ----------
const centre = k => { const [q, r] = unkey(k); return [SQ3 * (q + r / 2), 1.5 * r]; };
function hexAt(x, y) {
  const qf = (SQ3 / 3) * x - y / 3, rf = (2 / 3) * y, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf), dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return key(q, r);
}
/** The hexes on a straight run from a to b (b included), for a finger that moved several hexes at once. */
function lineBetween(a, b) {
  const [aq, ar] = unkey(a), [bq, br] = unkey(b);
  const n = Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(aq + ar - bq - br));
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = SQ3 * ((aq + (bq - aq) * t) + (ar + (br - ar) * t) / 2), y = 1.5 * (ar + (br - ar) * t);
    const k = hexAt(x + 1e-6, y + 1e-6);
    if (out[out.length - 1] !== k) out.push(k);
  }
  return out;
}
const corners = ([x, y], rad) => Array.from({ length: 6 }, (_, i) => {
  const a = Math.PI / 180 * (60 * i - 30);
  return `${(x + rad * Math.cos(a)).toFixed(3)},${(y + rad * Math.sin(a)).toFixed(3)}`;
}).join(" ");

// ---------- drawing with a finger ----------
let svg = null;
function toBoard(e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  const q = p.matrixTransform(svg.getScreenCTM().inverse());
  return hexAt(q.x, q.y);
}
const onBoard = k => S.board.cells.includes(k);

function startDraw(e) {
  if (S.done) return;
  const k = toBoard(e);
  if (!onBoard(k)) return;
  const paths = pathList(S.paths);
  if (k in S.board.nums) {
    // starting from a number replaces the path it was on
    const old = paths.find(p => p.cells.includes(k));
    drawing = { id: old?.id || newId(), c: old?.c ?? null, cells: [k] };
  } else {
    // grabbing a path somewhere along it carries on from there
    const on = paths.find(p => p.cells.includes(k));
    if (!on) return;
    drawing = { id: on.id, c: on.c, cells: on.cells.slice(0, on.cells.indexOf(k) + 1) };
  }
  svg.setPointerCapture?.(e.pointerId);
  render();
}

function moveDraw(e) {
  if (!drawing) return;
  const k = toBoard(e), head = drawing.cells[drawing.cells.length - 1];
  if (k === head || !onBoard(k)) return;
  for (const step of adjacent(head, k) ? [k] : lineBetween(head, k)) if (!stepTo(step)) break;
  render();
  shareDrawing();
}

/** One hex further (or back): returns false when the path can't go there. */
function stepTo(k) {
  const cells = drawing.cells, head = cells[cells.length - 1];
  const at = cells.indexOf(k);
  if (at >= 0) { cells.length = at + 1; return true; }               // back along the path
  if (!onBoard(k) || !adjacent(head, k)) return false;
  if (cells.length > 1 && head in S.board.nums) return false;         // finished on a number
  cells.push(k);
  return true;
}

function endDraw() {
  if (!drawing) return;
  const { id, c, cells } = drawing;
  drawing = null;
  commit(id, c, cells);
  if (S.done) return;
  const e = cells.length >= 2 ? evaluate(S.board, cells) : null;
  if (e?.done && !e.ok && LEVELS[S.level].verdicts === "now") {
    toast(e.value === null ? "That path runs out of range" : `From ${showValue(S.board.nums[e.from])} this path arrives at ${showValue(e.value)}, not ${showValue(S.board.nums[e.to])}`);
  } else if (allJoined()) {
    const paths = pathList(S.paths);
    const wrong = paths.filter(p => !evaluate(S.board, p.cells).ok).length;
    const used = new Set(paths.flatMap(p => p.cells)), unused = Object.keys(S.board.ops).filter(k => !used.has(k)).length;
    if (wrong) toast(`Every number is joined, but ${wrong === 1 ? "one path doesn't" : `${wrong} paths don't`} add up`);
    else if (unused) toast(`Every pair adds up, but ${unused === 1 ? "one operation is" : `${unused} operations are`} still unused`);
  }
}

/** Every number is on a finished path (rightly or wrongly). */
function allJoined() {
  const ends = new Set(pathList(S.paths).filter(p => evaluate(S.board, p.cells).done).flatMap(p => [p.cells[0], p.cells[p.cells.length - 1]]));
  return Object.keys(S.board.nums).every(k => ends.has(k));
}
/** Whether finished paths are marked right or wrong now: always on Easy and Medium; on Hard once every number is joined. */
const showVerdicts = () => !!S.done || LEVELS[S.level].verdicts === "now" || allJoined();

// ---------- rendering ----------
function render() {
  if (!S) return;
  $("level").value = S.daily ? "today" : S.level;
  drawPartner();
  drawBoard();
  const shown = LEVELS[S.level].pairsShown;
  $("clueBtn").textContent = shown ? "Clue" : `Clue (${Math.max(0, CLUES - S.clues.length)})`;
  $("clueBtn").disabled = !!S.done || shown || S.clues.length >= CLUES;
  $("clearBtn").disabled = !!S.done || !pathList(S.paths).length;
  if (S.done && JSON.stringify(S.done) !== shownDone) { shownDone = JSON.stringify(S.done); showDone(); }
}

/** A player's name with the dot of their colour; dimmed while they're away. */
function seatChip(name, slot, here = true) {
  const b = document.createElement("b");
  b.className = `d-seat${here ? "" : " away"}`;
  b.style.setProperty("--seat", seatColour(slot));
  b.textContent = here ? name : `${name} (away)`;
  return b;
}
/**
 * The line over the board at a table: everyone at it in their colours, so each knows whose paths are whose (you first);
 * away while their phone sleeps or they've left. Your partner in another game of the room: where, and a link.
 */
function drawPartner() {
  const line = $("partner");
  if (!together.room) { line.hidden = true; return; }
  line.hidden = false;
  line.replaceChildren();
  if (!together.online) { line.append(sextant(), "Reconnecting… moves made now may not reach the others."); return; }
  const g = together.room.data, people = g?.people || 2, others = together.others();
  const here = new Set(presentSlots(g, together.room.here, together.room.uid));
  if (people === 2) {
    const there = otherHere(together.room.here, together.room.uid, together.room.pid, "delta");
    if (there && there.game !== "delta" && GAMES[there.game]) {
      // your partner has another game of the room open: say which, and offer to follow
      const go = document.createElement("a");
      go.href = gameHref(there.game);
      go.textContent = "Join them";
      line.append(seatChip(firstName(there.name), others[0]?.slot ?? 1, there.online !== false), ` is in ${GAMES[there.game].name}. `, go);
      return;
    }
  }
  const mine = seatChip("You", together.slot);
  if (!others.length) { line.append(mine, ": waiting for ", people > 2 ? "the others" : "your partner", " to join"); return; }
  const chips = [mine, ...others.map(o => seatChip(firstName(o.name), o.slot, here.has(o.slot)))];
  line.append(...chips.flatMap((n, i) => (i === 0 ? [n] : [i === chips.length - 1 ? " and " : ", ", n])));
}

const NS = "http://www.w3.org/2000/svg";
/**
 * Text on the board. The board's units are hexes, so its text is under a unit tall; Safari lays out text that
 * small badly (it rounds the font's metrics, and the glyphs ride up to the top of their discs). So each label is
 * set at 100 times the size and scaled back down, and centred with an explicit offset instead of
 * dominant-baseline, which Safari handles unevenly.
 */
const TEXT_SCALE = 100;
function label(parent, x, y, text, cls, size) {
  const t = el("text", { x: 0, y: 0, dy: "0.36em", class: cls, "font-size": size * TEXT_SCALE,
    transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${1 / TEXT_SCALE})` }, parent);
  t.textContent = text;
  return t;
}

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v);
  parent?.appendChild(n);
  return n;
}

/** At a table, each seated player's seat, by device id (paths take their drawer's colour). */
const seatsById = () => Object.fromEntries(seatsOf(together.room?.data).map(([id, p]) => [id, p.slot]));
const seatColour = slot => `var(--p${(slot || 0) % 6})`;
/** A path's colour: at a table, its drawer's; solo (or the solution, drawn by nobody), its own. */
const pathColour = (p, seats) => (p.by && seats[p.by] != null ? seatColour(seats[p.by]) : `var(--d-p${(p.c ?? 0) % COLOURS})`);
const firstName = name => String(name || "Player").split(" ")[0];

function drawBoard() {
  const board = S.board, me = together.room?.uid || null, seats = together.room ? seatsById() : {};
  let paths = pathList(S.paths);
  if (drawing) paths = pathList(withPath(S.paths, drawing.id, drawing.c, drawing.cells.length >= 2 ? drawing.cells : [], me))
    .concat(drawing.cells.length === 1 ? [{ id: drawing.id, c: drawing.c ?? 0, by: me, cells: drawing.cells }] : []);
  const pts = board.cells.map(centre), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const pad = 1.05;
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];

  // one lasting <svg> per board: a finger that started on it keeps drawing however often its contents redraw
  const id = `${S.seed}/${S.level}`;
  if (!svg || svg.dataset.board !== id || !svg.isConnected) {
    svg = el("svg", { role: "img" });
    svg.dataset.board = id;
    svg.addEventListener("pointerdown", startDraw);
    svg.addEventListener("pointermove", moveDraw);
    svg.addEventListener("pointerup", endDraw);
    svg.addEventListener("pointercancel", endDraw);
    $("board").replaceChildren(svg);
  }
  const root = svg;
  root.setAttribute("viewBox", box.map(v => v.toFixed(3)).join(" "));
  const tiles = el("g", {}), lines = el("g", {}), live = el("g", {}), marks = el("g", {}), labels = el("g", {});
  root.replaceChildren(tiles, lines, live, marks, labels);
  for (const k of board.cells) el("polygon", { points: corners(centre(k), 0.93), class: `d-tile${k in board.ops ? " op" : ""}` }, tiles);
  const through = cells => cells.map(k => centre(k).map(v => v.toFixed(3)).join(",")).join(" ");

  // paths: a broad current in the path's colour (at a table, its drawer's), with arrows the way it was drawn once it
  // reaches a number; dashed when it's known not to add up
  const verdicts = new Map(), judged = showVerdicts();
  for (const p of paths) {
    if (p.cells.length < 2) continue;
    const e = evaluate(board, p.cells);
    if (judged) verdicts.set(p.id, e);
    el("polyline", { points: through(p.cells), class: `d-path${judged && e.done && !e.ok ? " wrong" : ""}`, stroke: pathColour(p, seats) }, lines);
    if (e.done) for (let i = 0; i + 1 < p.cells.length; i += 2) arrow(centre(p.cells[i]), centre(p.cells[i + 1]), lines);
  }

  // at a table, what the others are drawing now: a thin dashed line in their colour, their initial at its head
  if (together.room && !S.done) {
    for (const d of drawingsOf(together.room.data, together.room.here, me, together.room.pid)) {
      el("polyline", { points: through(d.cells), class: "d-live", stroke: seatColour(d.slot) }, live);
      const [x, y] = centre(d.cells[d.cells.length - 1]);
      el("circle", { cx: x, cy: y, r: 0.3, class: "d-live-head", fill: seatColour(d.slot) }, live);
      label(live, x, y, firstName(d.name).slice(0, 1).toUpperCase(), "d-live-who", 0.34);
    }
  }

  // operations, then numbers on top
  for (const [k, op] of Object.entries(board.ops)) {
    const [x, y] = centre(k);
    label(labels, x, y, showOp(op), "d-op", 0.5);
  }
  const tags = pairTags();
  for (const [k, v] of Object.entries(board.nums)) {
    const [x, y] = centre(k), text = showValue(v), size = [0.72, 0.72, 0.72, 0.58, 0.5, 0.44, 0.38][Math.min(text.length, 6)];
    const owner = paths.find(p => p.cells.includes(k));
    el("circle", { cx: x, cy: y, r: 0.7, class: "d-num-disc" }, labels);
    if (owner && verdicts.get(owner.id)?.ok) el("circle", { cx: x, cy: y, r: 0.7, fill: "none", stroke: pathColour(owner, seats), "stroke-width": 0.14 }, labels);
    label(labels, x, y, text, "d-num", size);
    if (tags[k]) {
      el("circle", { cx: x + 0.56, cy: y - 0.56, r: 0.24, class: "d-tag-disc" }, labels);
      label(labels, x + 0.56, y - 0.56, tags[k], "d-tag", 0.34);
    }
  }

  // ticks and crosses at the far end of finished paths
  for (const p of paths) {
    const e = verdicts.get(p.id);
    if (!e?.done) continue;
    const [x, y] = centre(e.ok ? e.to : p.cells[p.cells.length - 1]);
    el("circle", { cx: x - 0.56, cy: y + 0.56, r: 0.22, class: e.ok ? "d-mark-ok" : "d-mark-no" }, marks);
    label(marks, x - 0.56, y + 0.56, e.ok ? "✓" : "✕", "d-mark-glyph", 0.32);
  }

  // the running value at the finger (not on Hard: there it's yours to work out)
  if (drawing && drawing.cells.length && LEVELS[S.level].liveValue) {
    const cells = drawing.cells, head = cells[cells.length - 1];
    const value = valueAlong(board, cells);
    const [x, y] = centre(head);
    const text = value === null ? "?" : showValue(value);
    const w = 0.36 + 0.27 * text.length;
    const g = el("g", { class: "d-bubble" }, root);
    el("rect", { x: x - w / 2, y: y - 1.55, width: w, height: 0.62, rx: 0.31 }, g);
    label(g, x, y - 1.24, text, "d-bubble-text", 0.46);
  }

}

function arrow([x1, y1], [x2, y2], parent) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, a = Math.atan2(y2 - y1, x2 - x1), s = 0.14;
  const p = (dx, dy) => `${(mx + dx * Math.cos(a) - dy * Math.sin(a)).toFixed(3)},${(my + dx * Math.sin(a) + dy * Math.cos(a)).toFixed(3)}`;
  el("polygon", { points: `${p(s, 0)} ${p(-s, s)} ${p(-s, -s)}`, class: "d-arrow" }, parent);
}

/** Letters on numbers that are known to belong together: every pair on Easy, clued pairs otherwise. */
function pairTags() {
  const out = {}, shown = LEVELS[S.level].pairsShown || S.done;
  S.board.sol.forEach((p, i) => {
    if (!shown && !S.clues.includes(i)) return;
    out[p.from] = out[p.to] = "ABCDEF"[i];
  });
  return out;
}

// ---------- sheets ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

function showDone() {
  $("doneTitle").textContent = S.done.won ? "Solved" : "The solution";
  const stats = [["Time", clockText(elapsed())], ["Clues", LEVELS[S.level].pairsShown ? "–" : S.clues.length], ["Pairs", S.board.sol.length]];
  $("doneStats").replaceChildren(...stats.map(([label, value]) => {
    const box = document.createElement("div"), dd = document.createElement("dd"), dt = document.createElement("dt");
    dd.textContent = value; dt.textContent = label;
    box.append(dd, dt);
    return box;
  }));
  // at a table, who drew the paths on the board, in their colours (the solution, shown, is nobody's)
  const share = $("doneShare"), team = together.room ? seatsOf(together.room.data).sort((a, b) => a[1].slot - b[1].slot) : [];
  const by = drawnBy(S.paths);
  share.hidden = team.length < 2 || !S.done.won;
  share.replaceChildren();
  if (!share.hidden) share.append("Paths drawn: ", ...team.flatMap(([id, p], n) => [n ? " · " : "", seatChip(id === together.room.uid ? "You" : firstName(p.name), p.slot), ` ${by[id] || 0}`]));
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

function openMenu() { drawMenu(); if (!$("menuDlg").open) $("menuDlg").showModal(); }
// the menu: Play (a new board, the solution); in a room, back to solo; else a link to this board
function drawMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("New board", () => newBoard(), "primary"));
  if (!S.done) play.append(action("Show the solution", giveUp));
  if (!together.room) part(body, "content").append(mirror("Difficulty", $("level")));
  if (together.room) part(body, "together").append(action("Back to solo", () => together.leave(), "link"));
  else part(body, "about").append(action("Copy a link to this board", async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch { toast(location.href, 6000); }
  }, "link"));
}

// ---------- together ----------
async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}

/** The rete over the page while a room in the address is joined goes once its board is drawn, or the join fails. */
const joined = () => { joining?.(); joining = null; };
// a board solved together: a team result, the time it took (lower is better); a party's table seats as many as asked
const together = createTogether({
  result: g => (g.done?.won ? { match: `${g.seed}-${g.startedAt || ""}`, score: Math.round(((g.done.at || 0) - (g.startedAt || 0)) / 1000), won: true, coop: true, lower: true } : null),
  game: "delta",
  app: APP,
  toast,
  askName,
  valid: g => !!g?.board,
  slots: g => g?.people || 2,
  fresh: async (players, { ask } = {}) => {
    const level = S?.level || "medium", { seed, board } = await nextBoard(level);
    return freshTable(players, { app: APP, level, seed, board, ask });
  },
  onState: val => {
    joined();
    clockPause();
    const fresh = !S || S.seed !== val.seed;
    S = { seed: val.seed, level: val.level, board: val.board, paths: val.paths || {}, clues: Object.values(val.clues || {}), done: val.done || null, startedAt: val.startedAt || val.created };
    if (fresh) { shownDone = val.done ? JSON.stringify(val.done) : null; drawing = null; }
    // a path of yours left showing from before a reload: gone
    if (!drawing && val.players?.[together.room?.uid]?.draw != null) { sentDraw = undefined; shareDrawing(true); }
    if (!S.done && isSolved(S.board, pathList(S.paths).map(p => p.cells))) afterChange();
    render();
  },
  onPresence: () => render(),
  onLeave: () => {
    joined(); sentDraw = null;
    S = loadSolo(); if (!S) { soloBoard(null, "easy"); return; } shownDone = S.done ? JSON.stringify(S.done) : null; clockRun(); render();
  },
});

// The path under your finger, shared as it's drawn (at most every 90 ms), so the others see it grow in your colour;
// cleared once the drawn path is on the table.
let sentDraw = null, drawTimer = 0;
function shareDrawing(now = false) {
  const room = together.room;
  if (!room) return;
  const cells = drawing && drawing.cells.length >= 2 ? drawing.cells.join(";") : null;
  clearTimeout(drawTimer);
  if (cells === sentDraw) return;
  const send = () => {
    if (!together.room?.data?.players?.[room.uid]) return;      // not seated (any more): a write would leave a stray entry
    sentDraw = cells;
    room.sync.update(`${branchPath(room.code, "delta")}/players/${room.uid}`, { draw: cells })?.catch?.(e => console.error(e));
  };
  if (now) send(); else drawTimer = setTimeout(send, 90);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "delta");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("doneNew").addEventListener("click", () => { $("doneDlg").close(); newBoard(); });
$("clueBtn").addEventListener("click", clue);
$("clearBtn").addEventListener("click", clearAll);
$("level").addEventListener("change", e => newBoard(e.target.value));
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); together.resync(); } });
window.addEventListener("pagehide", clockPause);
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
// a board link opened in a tab that already has Delta open
window.addEventListener("hashchange", () => {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("s")), level = h.get("d");
  if (!together.room && seed && LEVELS[level] && !(S && S.seed === seed && S.level === level)) soloBoard(seed, level);
});
$("app").querySelector(".d-mark").innerHTML = APPS.find(a => a.id === "delta").logo;

// for tests and debugging
window.__delta = { get state() { return S; }, get drawing() { return drawing; }, withPath, evaluate, get together() { return together; }, centre };

// start: a shared board (#s=…&d=…), today's from the games screen's tile (#today) while it's still to play, the saved
// one, or a fresh Easy board for a first visit
const forToday = arrivedForToday();
const hash = new URLSearchParams(location.hash.slice(1));
const params = new URLSearchParams(location.search);
const code = (params.get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
S = loadSolo();                             // a shared board is dealt at your own board's level
/** Your own board: a shared link's, today's from the games screen's tile, the saved one, or a fresh Easy one. */
async function soloStart() {
  const linked = Number(hash.get("s")), linkedLevel = hash.get("d");
  if (linked && LEVELS[linkedLevel] && !(S && S.seed === linked && S.level === linkedLevel)) await soloBoard(linked, linkedLevel);
  else if (!S && forToday && !code) { await soloBoard(today(), DAILY_LEVEL); if (S) { S.daily = today(); saveSolo(); render(); } }
  else if (!S) await soloBoard(null, "easy");
  else {
    shownDone = S.done ? JSON.stringify(S.done) : null; history.replaceState(null, "", `${location.search}#s=${S.seed}&d=${S.level}`); clockRun(); render(); refill(S.level);
    // today's, once the board you left is drawn (it asks before leaving one you've started)
    if (forToday && !code && S.daily !== today()) setTimeout(() => newBoard("today"), 0);
  }
}
// a room in the address: the board you share from the first moment, never your own while the room is joined (the
// others would be on another board until it was), and your own only if the join doesn't come off
if (code.length === 4) {
  joining = busy(joiningWords(), { delay: 0 });
  together.join(code).then(ok => { if (!ok) { joined(); soloStart(); } });
} else await soloStart();

