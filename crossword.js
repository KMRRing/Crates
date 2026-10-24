// Crossword (README, Crossword): a British blocked crossword on the knowledge base, in Learning. A few of its entries
// are the knowledge base's clue links, a country or commodity named from its clue or the clue named from its reason,
// the rest ordinary words with the clue bank's clues (or, in a Lexicon grid, every entry a clue link); the crossings
// settle what a clue alone can't. Random grids by kind, size, level, pool, direction, topics and twist, or today's, the
// same for everyone; a computer rival to race; and at a table, the clues split between the players (one grid, nobody
// can finish alone) or a race on the same grid. The puzzles are crossword-engine.js's (made in crossword-worker.js),
// the solvers crossword-solve.js's, the table crossword-table.js's; this page draws them and takes the typing.
import { LEVELS, LEVEL_IDS, SIZES, SIZE_IDS, KINDS, kindOf, ASKS, MODES, POOLS, themeFits, freshPlay, put, check, reveal, full, solvedBy, lettersIn, entryRight, lessons, charged, clock, dailyOptions, entriesAt, numbers, isBlack, solutionAt, clueLine, REVEAL_COST, CHECK_COST } from "./crossword-engine.js";
import { span, clamp, zoomTo, squareAt, rectOf, show, fingers } from "./crossword-zoom.js";
import { rivalRun, rivalAt, partnerMove, seeded, RIVALS } from "./crossword-solve.js";
import { TABLE_MODES, peopleOf, isTable, freshTable, tidy, newGameAt, readable, holders, lettersOf, writers, writeAt, checkAt, revealAt, runOf, reportAt, runTotal, standings, raceOver, resultOf } from "./crossword-table.js";
import { kbEntry, entriesAbout, reviewCard, BANK } from "./crossword-kb.js";
import { KB_TOPICS, KB_PRESETS, cleanMix, presetOf } from "./topics.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, topicMix, action, line, onPause, isPaused } from "./menu.js";
import { today, arrivedForToday, dailyDue, noteDayTime, soloHref, IN_FRAME } from "./suite.js";
import { createTogether } from "./together.js";
import { getSync } from "./net.js";
import { roomInAddress, joiningWords, branchPath } from "./rooms.js";
import { busy, sextant } from "./loading.js";
import { scale, sideways } from "./wide.js";
import * as pile from "./pile.js";
import * as known from "./known.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const RUN = "crossword:run", SETTINGS = "crossword:settings", TOPICS = "crossword:topics", TIMES = "crossword:times", TABLE_RUN = "crossword:table";
const APP = 1;                 // the table's version

// ---------- settings ----------
// Your own choices for a random grid; today's is the same for everyone whatever they are (dailyOptions)
// size: squares across, or null for the level's own until one is chosen; kind: classic, lexicon or both (KINDS)
// computer: off, a rival racing you, or a partner holding the Down clues of a split grid; pace: how well and how fast it plays
const DEFAULTS = { level: "medium", size: null, kind: "both", pool: "mixed", asks: "both", mode: "classic", computer: "off", pace: "quick", autocheck: false, tableMode: "split" };
const settings = () => { const s = { ...DEFAULTS, ...read(SETTINGS, {}) }; return { ...s, kind: kindOf(s.kind) }; };
/** The squares across a random grid of yours will have: the size you chose, or your level's own. */
const sizeOf = s => (SIZE_IDS.includes(Number(s.size)) ? Number(s.size) : LEVELS[s.level]?.size || 13);
/** The computer player a new grid of yours gets: { kind, level } or null (never on today's, which is the same for everyone). */
const computerFor = daily => (daily || settings().computer === "off" ? null : { kind: settings().computer, level: RIVALS[settings().pace] ? settings().pace : "quick" });
const setSetting = (k, v) => write(SETTINGS, { ...settings(), [k]: v });
// a mix of Crates' topics, both lists in one (a country's and a commodity's), as every knowledge game deals them
const TOPIC_LIST = [...KB_TOPICS.country, ...KB_TOPICS.commodity];
const TOPIC_PRESETS = Object.fromEntries(Object.entries(KB_PRESETS).map(([k, p]) => [k, { label: p.label, topics: Object.fromEntries(TOPIC_LIST.map(([id]) => [id, p.topics[id] ?? 1])) }]));
const mix = () => cleanMix(TOPIC_LIST, read(TOPICS, null));
const presetNow = () => presetOf(TOPIC_LIST, TOPIC_PRESETS, mix());

// ---------- making a puzzle, off the page ----------
let worker = null, asked = 0;
const waiting = new Map();
/** A puzzle for these options (crossword-engine.js's makePuzzle), made in the worker; null if none could be. */
function makePuzzleOff(opts) {
  try {
    worker ||= new Worker("crossword-worker.js", { type: "module" });
    worker.onmessage = e => { const w = waiting.get(e.data.id); waiting.delete(e.data.id); w?.(e.data.puzzle || null); };
    worker.onerror = () => { for (const w of waiting.values()) w(null); waiting.clear(); };
  } catch { return import("./crossword-engine.js").then(m => m.makePuzzle(opts)); }   // no workers here: on the page
  const id = ++asked;
  return new Promise(res => { waiting.set(id, res); worker.postMessage({ id, opts }); });
}
/**
 * The options for a random grid now: your settings and topics, and in learning mode what the review pile has due
 * (dueEntries). A grid of ordinary words alone has no room for any of it.
 */
function randomOptions(seed = Math.floor(Math.random() * 2 ** 31)) {
  const s = settings(), w = mix(), learning = pile.learning() && s.kind !== "classic";
  return { seed, level: s.level, size: sizeOf(s), kind: s.kind, pool: s.pool, asks: s.asks, mode: s.mode, topics: w,
    due: learning ? dueEntries(s, w) : [], weak: learning ? pile.weakElsewhere("crossword") : null,
    // whatever the mode, a random grid keeps off the entries dealt lately (the mode puts what to revise back in)
    avoid: [...pile.recent("crossword")] };
}
// more than any grid takes (the engine takes up to half its knowledge entries: eighteen in a Lexicon 15 by 15)
const DUE_MAX = 30;
/**
 * The learning mode's entries for a random grid (what the mode picks: the longest-term due, the shortest-term pile, or both): Crossword's own cards, then, for each card
 * another game has due in the review pile (Deck's: Crates' clues, Punt's questions, Chart's places, Quote's numbers…),
 * an entry that revises it, if the clue links have one (entriesAbout: its link where it is one, else one naming what
 * it's about, picked at random). Only entries your choices take: one of your topics in (so a grid made with every
 * topic, when your mix is too narrow for one, keeps to it too), the answers and direction asked for, and a length the
 * grid's size takes.
 */
function dueEntries(s, w) {
  const asks = s.kind === "lexicon" && s.asks === "fwd" ? "both" : s.asks, longest = SIZES[sizeOf(s)].longest;
  const takes = e => !!e && e.topics.some(t => (w[t] ?? 1) > 0) && (s.pool === "mixed" || e.cat === s.pool) && (asks === "both" || e.dir === asks) && e.letters.length <= longest;
  const out = pile.picks("crossword").map(it => it.key).filter(k => takes(kbEntry(k))).slice(0, DUE_MAX), taken = new Set(out);
  for (const it of pile.picks()) {
    if (out.length >= DUE_MAX) break;
    if (it.game === "crossword" || !it.about?.length) continue;
    const can = entriesAbout(it.about).filter(e => takes(e) && !taken.has(e.key));
    if (!can.length) continue;
    const e = can[Math.floor(Math.random() * can.length)];
    out.push(e.key);
    taken.add(e.key);
  }
  return out;
}

// ---------- the run: your own grid, or the table's ----------
// S: your own run { v, puzzle, play, daily (its day) or null, ranked, rival ({ level, seed }) or null, opts }
let S = read(RUN, null);
if (S && (S.v !== 1 || !S.puzzle?.rows)) S = null;
let G = null;                  // the table as last seen (null: playing alone)
let R = null;                  // at a race table, your own run { code, created, n, play, begun }
let cur = { k: 0, dir: "across" };
let rivalPlan = null;          // the computer player's solve of the puzzle on screen (crossword-solve.js's rivalRun)
const save = () => { if (!IN_FRAME && S) write(RUN, S); };
let saveTimer = 0;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); };

/** The puzzle on the screen, and the play of it: yours, your race run, or the table's grid. */
const puzzle = () => (G ? G.puzzle : S?.puzzle);
function play() {
  if (G?.mode === "split") return tablePlay();
  if (G?.mode === "race") return R?.play;
  return S?.play;
}
const finished = () => (G?.mode === "split" ? !!G.done : !!play()?.done);

// ---------- the clock ----------
// Solo, the clock runs while the grid is on screen and not standing still for the menu; at a table it's the table's,
// the database's time since the game began, and doesn't stop (a duo clock never does).
let ticking = 0, lastTick = 0, serverOffset = 0;
const serverNow = () => Date.now() + serverOffset;
function tick() {
  const now = performance.now(), p = S?.play;
  if (!G && p && !p.done && !document.hidden && !isPaused() && !IN_FRAME) {
    p.ms += Math.min(5000, now - lastTick);
    if (Math.floor(p.ms / 5000) !== Math.floor((p.ms - (now - lastTick)) / 5000)) saveSoon();
  }
  lastTick = now;
  drawClock();
  partnerTick();
  if ((rivalPlan || partner) && !G) drawStrip();
}
function startClock() { lastTick = performance.now(); clearInterval(ticking); ticking = setInterval(tick, 500); }
/** The seconds on the clock now (before any penalty). */
function secsNow() {
  if (G?.mode === "split") return G.done ? G.done.secs : Math.max(0, Math.round((serverNow() - G.begun) / 1000));
  if (G?.mode === "race") return R?.play ? Math.round(R.play.ms / 1000) : 0;
  return Math.round((S?.play?.ms || 0) / 1000);
}
function drawClock() {
  const c = $("clock");
  c.textContent = puzzle() ? clock(secsNow()) : "";
  c.classList.toggle("paused", !G && isPaused());
}
onPause(() => drawClock(), () => { lastTick = performance.now(); drawClock(); });
document.addEventListener("visibilitychange", () => { lastTick = performance.now(); if (document.hidden) save(); });

// ---------- layout ----------
// The grid is as large as the room leaves, its squares whole pixels, and keeps that size for the whole game; the keys
// keep a thumb's height. A tall phone has room for the clue list between the bar and the keys; a short one doesn't, and
// its Clues key opens the list instead. Held sideways the grid has the left column's height, the rest beside it.
const MIN_KEY = 38, MAX_KEY = 50;              // px on a phone
function fitLayout() {
  const p = puzzle();
  if (!p) return;
  const k = scale(), side = sideways(), app = $("app"), css = getComputedStyle(app);
  const C = p.rows[0].length, R0 = p.rows.length;
  const vh = window.visualViewport?.height || window.innerHeight;
  const width = app.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
  document.documentElement.style.setProperty("--key", `${Math.round(Math.max(MIN_KEY, Math.min(MAX_KEY, vh / 17.5)) * k)}px`);
  // a short phone's strip is the grid's room: it shows only with something live in it (a table, a rival, a partner)
  $("strip").hidden = !side && vh / k < 700 && !G && !rivalPlan && !S?.partner;
  // a grid of C squares is C squares and C + 1 hairlines across (its ruled ground shows through a pixel round each)
  const fits = (w, h) => Math.floor(Math.min((w - (C + 1)) / C, (h - (R0 + 1)) / R0));
  let cell;
  if (side) {
    const box = $("boardBox").getBoundingClientRect(), colW = parseFloat(css.gridTemplateColumns) || width / 2;
    cell = Math.min(fits(colW - 10 * k, vh - box.top - parseFloat(css.paddingBottom) - 10 * k), Math.round(64 * k));
    $("list").hidden = false;
    $("boardBox").classList.remove("grows");
  } else {
    // what the column holds besides the grid: the header and strip above it (where it starts), the bar and the keys
    // under it (measured), the gaps
    const top = $("boardBox").getBoundingClientRect().top;
    const below = $("clueBar").offsetHeight + $("kbd").offsetHeight + 24 * k;
    const room = vh - top - below - parseFloat(css.paddingBottom);
    cell = Math.min(fits(width, room - 8 * k), Math.round(46 * k));
    // a list of four lines or more gets the rest; less isn't worth having, and the grid stands in the middle instead.
    // A tall screen (an upright tablet) gives up a little of its grid for six lines of clues
    const LIST = 92 * k, TALL = 140 * k;
    if (vh / k >= 760 && room - (cell + 1) * R0 - 16 * k < TALL) {
      const smaller = fits(width, room - 16 * k - TALL);
      if (smaller >= cell * 0.85) cell = smaller;
    }
    const left = room - (cell + 1) * R0 - 16 * k;
    const shown = left >= LIST;
    $("list").hidden = !shown;
    $("boardBox").classList.toggle("grows", !shown);
  }
  fit = Math.max(14, cell);
  document.documentElement.style.setProperty("--cell", `${fit}px`);
  fitClue();
  fitView();
}
addEventListener("resize", () => { fitLayout(); scrollList(); });
window.visualViewport?.addEventListener("resize", () => fitLayout());

// ---------- zoom ----------
// A 13 by 13 grid's squares are 22 to 26 px on a phone, so the grid zooms: a pinch, the strip's magnifier, the menu,
// + and − on a keyboard, Ctrl and the wheel on a computer. It zooms inside its own window, the size it is whole, so
// nothing else on the screen changes size; a finger drags it about, and it moves along to keep the square being typed
// in in sight (crossword-zoom.js does the arithmetic). How close you like it is kept on this device only, where suite:
// keys stay: a phone's close-up isn't a tablet's.
const ZOOM = "suite:crossword-zoom";
// px a square: under ZOOM_FROM the grid offers to zoom (a thumb's square, as Mines finds); CLOSE, a close-up until you
// pinch one of your own; CLOSEST, the most it zooms. Plain px, not grown with a tablet's layout (wide.js): a pixel is
// about the same size under a finger on either, and an upright iPad's 48 px squares need no zooming
const ZOOM_FROM = 34, CLOSE = 40, CLOSEST = 60;
let fit = 0;                   // px a square, the grid whole (fitLayout)
let view = null;               // zoomed in: { cell, x, y } (crossword-zoom.js); the whole grid: null
let followed = null;           // the square and direction the view last moved along with
const zoomPref = () => ({ on: false, cell: CLOSE, ...read(ZOOM, {}) });
const keepZoom = () => { if (!IN_FRAME) write(ZOOM, { on: !!view, cell: view ? view.cell : zoomPref().cell }); };
const sizeNow = () => { const p = puzzle(); return { C: p.rows[0].length, R: p.rows.length }; };
const windowNow = () => { const { C, R } = sizeNow(); return { w: span(C, fit), h: span(R, fit) }; };
/** Whether the grid's squares are small enough to be worth zooming (the magnifier and the menu offer it then). */
const zoomable = () => !!puzzle() && fit > 0 && fit < ZOOM_FROM;
const closest = () => Math.max(fit, CLOSEST);
/** A close-up's squares: the size you last zoomed to, at least a quarter larger than whole. */
const closeUp = () => Math.min(closest(), Math.max(Math.round(zoomPref().cell), Math.round(fit * 1.25)));
/** The view as it is, or the whole grid as one (for a pinch or a step that starts from it). */
const viewNow = () => view || { cell: fit, x: 0, y: 0 };
/** Zoomed to `v` (no larger than whole: the whole grid), drawn at once or gliding there. */
function setView(v, glide = false) {
  view = v && v.cell > fit ? v : null;
  drawView(glide);
}
function drawView(glide = false) {
  const p = puzzle(), win = $("boardWin"), board = $("board"), on = !!(view && p);
  win.classList.toggle("zoomed", on);
  board.classList.toggle("glide", on && glide);
  if (on) {
    const { w, h } = windowNow();
    win.style.width = `${w}px`;
    win.style.height = `${h}px`;
    board.style.setProperty("--cell", `${view.cell}px`);
    board.style.transform = `translate(${Math.round(view.x)}px, ${Math.round(view.y)}px)`;
  } else {
    win.style.width = win.style.height = "";
    board.style.removeProperty("--cell");
    board.style.transform = "";
  }
  drawZoomButton();
}
/** After the layout changes (a new grid, the screen turned): the view held to the new window, or a new grid opened
 *  close up if that's how you left it. */
function fitView() {
  if (!puzzle()) return;
  const { C, R } = sizeNow();
  if (zoomFor !== drawnFor) {                 // a new grid: its cursor is placed after this, and the view snaps to it
    zoomFor = drawnFor;
    view = zoomPref().on && !IN_FRAME && zoomable() ? { cell: closeUp(), x: 0, y: 0 } : null;
    followed = null;
    snap = true;
  }
  if (view) view = clamp({ ...view, cell: Math.min(view.cell, closest()) }, windowNow(), C, R);
  setView(view);
}
let zoomFor = null;            // the grid the view was set up for
let snap = false;              // the next follow jumps rather than glides (a new grid)
/** Close up or whole, as the magnifier and the menu switch it; remembered for the next grid. */
function setZoom(on) {
  if (!puzzle() || on === !!view) return;
  followed = null;
  setView(on ? { cell: closeUp(), x: 0, y: 0 } : null);
  follow({ glide: false });
  keepZoom();
}
/** A step closer or further (+ and − on a keyboard), the square being typed in kept in sight. */
function zoomStep(by) {
  if (!puzzle()) return;
  if (!view && by > 0) { setZoom(true); return; }
  if (!view) return;
  const { C, R } = sizeNow(), cell = Math.min(closest(), Math.round(view.cell * (by > 0 ? 1.25 : 0.8)));
  followed = null;
  setView(clamp({ ...view, cell }, windowNow(), C, R));
  follow({ glide: false });
  keepZoom();
}
/**
 * Keeps the square being typed in in sight as the cursor moves: its whole word where the window has room for it,
 * else the square and the next along. A tapped square is in sight already, and the grid moving under the finger
 * would send a second tap astray, so a tap only brings in a square the window's edge cut; a view you've dragged
 * stays put until the cursor moves.
 */
function follow({ tap = false, glide = true } = {}) {
  const p = puzzle();
  if (!view || !p) return;
  const key = `${cur.k}:${cur.dir}`;
  if (key === followed) return;
  followed = key;
  if (snap) { snap = false; glide = false; }
  const { C, R } = sizeNow(), win = windowNow(), e = current(), margin = tap ? 0 : Math.round(4 * scale());
  const at = e ? e.cells.indexOf(cur.k) : -1, near = tap || at < 0 ? [cur.k] : e.cells.slice(at, at + 2);
  const word = e && !tap ? rectOf(e.cells, C, view.cell) : null;
  const room = word && word.x1 - word.x0 + 2 * margin <= win.w && word.y1 - word.y0 + 2 * margin <= win.h;
  const next = show(view, room ? word : rectOf(near, C, view.cell), win, C, R, margin);
  if (Math.round(next.x) !== Math.round(view.x) || Math.round(next.y) !== Math.round(view.y)) setView(next, glide);
}
const MAGNIFIER = sign => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M7.5 10.5h6${sign === "+" ? "M10.5 7.5v6" : ""}"/></svg>`;
let zoomDrawn = "";
function drawZoomButton() {
  const b = $("zoomBtn"), want = zoomable() || view ? (view ? "-" : "+") : "";
  if (want === zoomDrawn) return;
  zoomDrawn = want;
  b.hidden = !want;
  b.innerHTML = want ? MAGNIFIER(want) : "";
  b.setAttribute("aria-label", want === "-" ? "See the whole grid" : "Zoom in");
}

// The grid's fingers: a tap writes in a square (read from where it lands, so a finger between two squares still picks
// one, and acted on as it lifts, since a finger that moves is dragging and a second one makes a pinch); one finger
// drags a zoomed grid, two pinch it about their middle. Pointer events alone, as Chart's map: touch-action: none keeps
// the browser's own pinch off the grid, and Safari's gesture events are refused, so a pinch here never zooms the page.
const touch = fingers(8);
let pinch = null;              // { from (the view as it began), d (the fingers' spread), mid (their middle) }
let tapAt = null;              // the square a finger landed on, if it's still a tap
let wheelCell = null;          // the wheel's zoom, unrounded, so small steps add up
const inWindow = e => { const r = $("boardWin").getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom }; };
/** A glide to the cursor still under way stops where it is, so a finger acts on the grid as it's seen. */
function settle() {
  if (!view || !$("board").classList.contains("glide")) return;
  const b = $("board").getBoundingClientRect(), w = $("boardWin").getBoundingClientRect();
  setView({ ...view, x: b.left - w.left, y: b.top - w.top });
}
/** The square under a finger, whatever the zoom; null off the grid's window (a zoomed grid runs on, unseen, past it). */
function squareUnder(e) {
  const at = inWindow(e);
  if (!puzzle() || !at.inside) return null;
  const { C, R } = sizeNow(), k = squareAt(viewNow(), at.x, at.y, C, R);
  return k < 0 ? null : k;
}
const boardBox = $("boardBox");
boardBox.addEventListener("pointerdown", e => {
  if (!puzzle()) return;
  e.preventDefault();
  try { boardBox.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
  settle();
  const at = inWindow(e), g = touch.down(e.pointerId, at.x, at.y, e.isPrimary);
  tapAt = touch.count === 1 ? squareUnder(e) : null;
  if (g?.pinch) { pinch = { from: viewNow(), ...g.pinch }; wheelCell = null; }
});
boardBox.addEventListener("pointermove", e => {
  if (!puzzle()) return;
  const at = inWindow(e), g = touch.move(e.pointerId, at.x, at.y), { C, R } = sizeNow();
  if (g?.pinch && pinch) {
    const cell = Math.max(fit, Math.min(closest(), Math.round(pinch.from.cell * g.pinch.d / Math.max(1, pinch.d))));
    setView(zoomTo(pinch.from, cell, pinch.mid, g.pinch.mid, windowNow(), C, R));
  } else if (g?.drag && view) setView(clamp({ ...view, x: view.x + g.drag[0], y: view.y + g.drag[1] }, windowNow(), C, R));
});
function lift(e) {
  const t = touch.up(e.pointerId, e.type !== "pointerup");
  if (pinch && touch.count < 2) { pinch = null; keepZoom(); }
  if (t?.tap && tapAt != null) { tapCell(tapAt, { tap: true }); tapAt = null; }
}
boardBox.addEventListener("pointerup", lift);
boardBox.addEventListener("pointercancel", lift);
boardBox.addEventListener("lostpointercapture", lift);      // after a pointerup, nothing; a finger the browser lost, gone
for (const type of ["gesturestart", "gesturechange", "gestureend"]) boardBox.addEventListener(type, e => e.preventDefault(), { passive: false });
// a computer: Ctrl (or a trackpad's pinch, which arrives as one) and the wheel zoom about the pointer; the wheel alone
// moves a zoomed grid
boardBox.addEventListener("wheel", e => {
  if (!puzzle()) return;
  settle();
  const { C, R } = sizeNow(), at = inWindow(e);
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const from = viewNow();
    wheelCell = Math.max(fit, Math.min(closest(), (wheelCell ?? from.cell) * Math.exp(-e.deltaY * 0.01)));
    setView(zoomTo(from, Math.round(wheelCell), at, at, windowNow(), C, R));
    keepZoom();
  } else if (view) {
    e.preventDefault();
    setView(clamp({ ...view, x: view.x - e.deltaX, y: view.y - e.deltaY }, windowNow(), C, R));
  }
}, { passive: false });

// ---------- drawing ----------
let cells = [];                // the squares' elements, by cell
let drawnFor = null;           // the puzzle the grid was built for
function buildBoard() {
  const p = puzzle(), board = $("board");
  if (!p) { board.replaceChildren(); cells = []; drawnFor = null; return; }
  if (drawnFor === p) return;
  drawnFor = p;
  const C = p.rows[0].length, nums = numbers(p), kbStart = new Set(p.entries.filter(e => e.kind !== "word").map(e => e.cells[0]));
  board.style.gridTemplateColumns = `repeat(${C}, var(--cell))`;
  cells = p.rows.join("").split("").map((ch, k) => {
    const c = el("div", `cw-cell${ch === "#" ? " black" : ""}`);
    c.dataset.k = k;
    if (ch !== "#") {
      c.setAttribute("role", "gridcell");
      if (nums[k]) c.append(el("span", `cw-num${kbStart.has(k) ? " kb" : ""}`, String(nums[k])));
      c.append(el("span", "cw-ch"));
    }
    return c;
  });
  board.replaceChildren(...cells);
  buildList();
  fitLayout();
}
/** The entry the cursor is in (its direction, or the other when the cell has none that way). */
function current() {
  const p = puzzle();
  if (!p) return null;
  const at = entriesAt(p, cur.k);
  return at[cur.dir] || at[cur.dir === "across" ? "down" : "across"];
}
function crossing() {
  const p = puzzle(), e = current();
  if (!p || !e) return null;
  return entriesAt(p, cur.k)[e.dir === "across" ? "down" : "across"];
}
/** Paints every square: letters, the cursor and its word, checks, reveals, and at a table who wrote what and where the others are. */
function paint() {
  const p = puzzle(), pl = play();
  if (!p || !pl) return;
  const e = current(), word = new Set(e ? e.cells : []), wrong = new Set(pl.wrong), shown = new Set(pl.revealed);
  // who wrote each letter: at a split table everyone's colour; alone with a partner, the computer's letters in its own
  const by = G?.mode === "split" ? writers(G) : !G && S?.partner ? pl.by || {} : null;
  const peers = G?.mode === "split" ? peerCells() : new Map();
  const solved = finished() && solvedBy(pl, p);
  cells.forEach((c, k) => {
    if (isBlack(p, k)) return;
    const ch = pl.letters[k], span = c.lastChild;
    span.textContent = ch === "." ? "" : ch;
    c.classList.toggle("cur", k === cur.k && !solved);
    c.classList.toggle("word", word.has(k) && k !== cur.k && !solved);
    c.classList.toggle("wrong", wrong.has(k));
    c.classList.toggle("shown", shown.has(k));
    c.classList.toggle("right", solved);
    const who = by?.[k];
    span.classList.toggle("by", who != null && !pending[k]);
    if (who != null) span.style.setProperty("--by", `var(--p${who % 6})`); else span.style.removeProperty("--by");
    const peer = peers.get(k);
    c.classList.toggle("peer", !!peer);
    if (peer) c.style.setProperty("--peer", `var(--p${peer.slot % 6})`); else c.style.removeProperty("--peer");
    c.querySelector(".cw-peer")?.remove();
    if (peer?.here) { const i = el("i", "cw-peer", peer.initial); c.append(i); }
  });
  drawClue();
  markList();
  follow({ tap: tapped });
  // where you are is part of the run: a reload, your other device or a partner watching shows the same square
  if (!G && S && (S.at?.k !== cur.k || S.at?.dir !== cur.dir)) { S.at = { ...cur }; saveSoon(); }
}
/** The clue as the bar and the list show it: its number and direction, its tag, its bold part, its text and length. */
function clueParts(e, mine = true) {
  const frag = document.createDocumentFragment();
  if (!mine) { frag.append(el("span", "cw-hidden", `${holderName(e)}'s clue`), " ", el("span", "cw-enum", `(${e.enumer})`)); return frag; }
  if (e.lead) frag.append(el("b", "cw-lead", e.lead), " ");
  frag.append(e.text, " ", el("span", "cw-enum", `(${e.enumer})`));
  return frag;
}
const tagOf = e => {
  if (!e.tag) return null;
  const t = el("span", `cw-tag${e.kind === "star" || e.kind === "key" ? " star" : e.kind === "rev" ? " name" : ""}`, e.tag);
  return t;
};
function drawClue() {
  const e = current(), box = $("clueText");
  box.replaceChildren();
  if (!e) return;
  const label = el("span", "cw-label", `${e.num} ${e.dir === "across" ? "Across" : "Down"}`), mine = canRead(e);
  const tag = mine ? tagOf(e) : null;
  if (tag) label.append(tag);
  const say = el("span", "cw-say");
  say.append(clueParts(e, mine));
  box.append(label, say);
  box.setAttribute("aria-label", `${e.num} ${e.dir}: ${mine ? clueLine(e) : `${holderName(e)}'s clue (${e.enumer})`}`);
  fitClue();
}
/** A long clue takes smaller type, so the bar never changes size. */
function fitClue() {
  const box = $("clueText"), say = box.querySelector(".cw-say");
  if (!say) return;
  for (const size of [0.95, 0.88, 0.81, 0.75]) {
    box.style.setProperty("--clue-size", `${size}rem`);
    if (say.scrollHeight <= say.clientHeight + 1) break;
  }
}
let listItems = new Map();     // entry → its row in the list
function buildList() {
  const p = puzzle();
  listItems = new Map();
  const make = target => {
    target.replaceChildren();
    for (const dir of ["across", "down"]) {
      target.append(el("h3", "", dir === "across" ? "Across" : "Down"));
      for (const e of p.entries.filter(x => x.dir === dir)) {
        const b = el("button", "cw-item");
        b.type = "button";
        b.dataset.n = e.n;
        target.append(b);
        if (target === $("list")) listItems.set(e, b);
        b.addEventListener("click", () => { goTo(e); if ($("cluesDlg").open) $("cluesDlg").close(); });
      }
    }
  };
  make($("list"));
  fillList($("list"));
}
/** Writes each clue into a list's rows (yours in full, a partner's as theirs, at a table). */
function fillList(target) {
  const p = puzzle();
  for (const b of target.querySelectorAll(".cw-item")) {
    const e = p.entries[Number(b.dataset.n)], mine = canRead(e), body = el("span", "t");
    const tag = mine ? tagOf(e) : null;
    if (tag) body.append(tag);
    body.append(clueParts(e, mine));
    b.replaceChildren(el("span", "n", String(e.num)), body);
  }
}
function markList() {
  const p = puzzle(), pl = play(), e = current(), x = crossing();
  if (!p || !pl) return;
  for (const [entry, b] of listItems) {
    b.classList.toggle("on", entry === e);
    b.classList.toggle("cross", entry === x);
    b.classList.toggle("filled", !lettersIn(pl, entry).includes("."));
  }
  scrollList();
}
function scrollList() {
  const b = listItems.get(current());
  if (b && !$("list").hidden) b.scrollIntoView({ block: "nearest" });
}
function openClues() {
  const body = $("cluesBody");
  body.replaceChildren();
  const p = puzzle();
  for (const dir of ["across", "down"]) {
    body.append(el("h3", "", dir === "across" ? "Across" : "Down"));
    for (const e of p.entries.filter(x => x.dir === dir)) {
      const b = el("button", `cw-item${e === current() ? " on" : ""}`);
      b.type = "button"; b.dataset.n = e.n;
      b.addEventListener("click", () => { goTo(e); $("cluesDlg").close(); });
      body.append(b);
    }
  }
  fillList(body);
  $("cluesDlg").showModal();
  body.querySelector(".cw-item.on")?.scrollIntoView({ block: "center" });
}
function drawStrip() {
  const p = puzzle(), where = $("where"), who = $("who");
  if (!p) { where.textContent = ""; who.replaceChildren(); return; }
  const L = LEVELS[p.level], n = p.rows.length;
  const bits = [G ? (G.mode === "split" ? "Clues split" : "Race") : S?.daily ? "Today's" : null, L?.name, n !== L?.size ? `${n}×${n}` : null,
    p.kind && p.kind !== "both" ? KINDS[p.kind] : null, p.mode === "theme" ? "Theme" : null, p.pool !== "mixed" && p.kind !== "classic" ? POOLS[p.pool] : null].filter(Boolean);
  where.textContent = bits.join(" · ");
  who.replaceChildren();
  if (G) drawTable(who);
  else if (rivalPlan && S?.rival) {
    const at = rivalAt(rivalPlan, S.play.ms / 1000), span = el("span", "cw-race");
    span.append(el("b", "", RIVALS[S.rival.level]?.name || "Rival"), ` ${at.done ? `✓ ${clock(rivalPlan.done + rivalPlan.penalty)}` : `${at.solved}/${p.entries.length}`}`);
    who.append(span);
  } else if (S?.partner) {
    // the partner's badge in its colour, and how many of its Down clues it has right
    const { right, of } = partnerScore(), span = el("span", "cw-race"), b = el("i", "cw-by", (RIVALS[S.partner.level]?.name || "P")[0]);
    b.style.setProperty("--who", "var(--p1)");
    span.append(b, ` ${right}/${of} down`);
    who.append(span);
  }
}

// ---------- moving about ----------
function goTo(e, k = null) {
  const pl = play();
  cur = { dir: e.dir, k: k ?? e.cells.find(c => pl?.letters[c] === ".") ?? e.cells[0] };
  paint(); sayWhere();
}
function tapCell(k, { tap = false } = {}) {
  const p = puzzle();
  if (!p || isBlack(p, k)) return;
  const at = entriesAt(p, k);
  if (k === cur.k) { const other = cur.dir === "across" ? "down" : "across"; if (at[other]) cur.dir = other; }
  else { cur.k = k; if (!at[cur.dir]) cur.dir = at.across ? "across" : "down"; }
  tapped = tap;
  paint(); sayWhere();
  tapped = false;
}
let tapped = false;            // the cursor moved to where a finger landed (the zoom keeps only the next square in sight)
function toggleDir() {
  const at = entriesAt(puzzle(), cur.k), other = cur.dir === "across" ? "down" : "across";
  if (at[other]) { cur.dir = other; paint(); sayWhere(); }
}
/** The entries in clue order (across, then down), for stepping and for the next one to fill. */
const order = () => puzzle().entries;
function step(by) {
  const list = order(), e = current(), i = list.indexOf(e);
  goTo(list[(i + by + list.length) % list.length]);
}
/** After a word is filled: the next entry with a square still empty, in clue order, one whose clue you can read
 *  first (at a split table, your own); none: stay. */
function nextOpen(from) {
  const list = order(), pl = play(), i = list.indexOf(from);
  const open = list.map((_, j) => list[(i + 1 + j) % list.length]).filter(e => e !== from && lettersIn(pl, e).includes("."));
  return open.find(canRead) || open[0] || null;
}
function arrow(dr, dc) {
  const p = puzzle(), axis = dr ? "down" : "across";
  if (cur.dir !== axis && entriesAt(p, cur.k)[axis]) { cur.dir = axis; paint(); return; }   // the first press turns
  const C = p.rows[0].length, R0 = p.rows.length;
  let r = Math.floor(cur.k / C), c = cur.k % C;
  for (;;) {
    r += dr; c += dc;
    if (r < 0 || c < 0 || r >= R0 || c >= C) return;
    const k = r * C + c;
    if (!isBlack(p, k)) { cur.k = k; if (!entriesAt(p, k)[cur.dir]) cur.dir = axis; paint(); sayWhere(); return; }
  }
}

// ---------- typing ----------
function typeLetter(ch) {
  const p = puzzle(), pl = play(), e = current();
  if (!p || !pl || !e || finished() || IN_FRAME) return;
  const k = cur.k;
  if (!pl.revealed.includes(k)) {
    setLetter(k, ch);
    if (settings().autocheck && !G && ch !== solutionAt(p, k)) check(pl, p, [k]);
  }
  // on along the word; from its last square, to the next entry still open
  const i = e.cells.indexOf(k);
  if (i < e.cells.length - 1) cur.k = e.cells[i + 1];
  else { const next = nextOpen(e); if (next) { cur = { dir: next.dir, k: next.cells.find(c => play().letters[c] === ".") ?? next.cells[0] }; } }
  changed();
}
function backspace() {
  const pl = play(), e = current();
  if (!pl || !e || finished() || IN_FRAME) return;
  if (pl.letters[cur.k] !== "." && !pl.revealed.includes(cur.k)) { setLetter(cur.k, "."); changed(); return; }
  const i = e.cells.indexOf(cur.k);
  if (i > 0) { cur.k = e.cells[i - 1]; if (!pl.revealed.includes(cur.k)) setLetter(cur.k, "."); }
  changed();
}
/** A letter into a square: your play's, or the table's (sent a moment later, shown at once). */
function setLetter(k, ch) {
  if (G?.mode === "split") { pending[k] = ch; flushSoon(); return; }
  const pl = play();
  if (put(pl, puzzle(), k, ch) && pl.by) delete pl.by[k];       // over a partner's letter: yours now
}
/** After every change: draw, keep, and see whether the grid is done. */
function changed() {
  paint(); sayWhere();
  if (G?.mode === "race") { keepRace(); reportRace(); }
  else if (!G) saveSoon();
  const pl = play(), p = puzzle();
  if (!G && full(pl) && !pl.done) {
    if (solvedBy(pl, p)) solvedSolo();
    else toast("Not quite: a letter or two is wrong");
  }
  if (G?.mode === "race" && full(pl) && !pl.done) {
    if (solvedBy(pl, p)) solvedRace();
    else toast("Not quite: a letter or two is wrong");
  }
}

// ---------- help ----------
/** The squares of a check or reveal: the cursor's, its word's, or the grid's. */
function scopeCells(scope) {
  const p = puzzle(), e = current();
  if (scope === "letter") return [cur.k];
  if (scope === "word") return e ? e.cells : [];
  return p.rows.join("").split("").map((ch, k) => (ch === "#" ? -1 : k)).filter(k => k >= 0);
}
async function helpCheck(scope) {
  const p = puzzle(), cellsTo = scopeCells(scope);
  if (G?.mode === "split") {
    await flush();
    let n = 0;
    await together.act(g => { n = checkAt(tidy(g), { n: G.n, cells: cellsTo }); return n > 0; });
    toast(n > 0 ? `${n} wrong: +${clock(n * CHECK_COST)} for the team` : "All right so far");
    return;
  }
  const n = check(play(), p, cellsTo);
  toast(n ? `${n} wrong: +${clock(n * CHECK_COST)}` : scope === "letter" ? "That one's right (or empty)" : "All right so far");
  changed();
}
async function helpReveal(scope) {
  const p = puzzle(), cellsTo = scopeCells(scope);
  if (scope === "grid" && !confirm("Reveal the whole grid? It counts as given up.")) return;
  if (G?.mode === "split") {
    await flush();
    let n = 0;
    await together.act(g => { n = revealAt(tidy(g), { n: G.n, slot: together.slot, cells: cellsTo, now: serverNow() }); return n > 0; });
    if (n) toast(`${n} letter${n === 1 ? "" : "s"} revealed: +${clock(n * REVEAL_COST)} for the team`);
    return;
  }
  const pl = play(), n = reveal(pl, p, cellsTo);
  if (scope === "grid") { pl.gaveUp = true; }
  if (n) toast(`${n} letter${n === 1 ? "" : "s"} revealed: +${clock(n * REVEAL_COST)}`);
  changed();
}

// ---------- solved ----------
/** Your own grid solved: the time counts at once (today's for the games screen, your best), the knowledge entries go
 *  to the review pile or up it, and how it went is shown. */
function solvedSolo() {
  const pl = S.play, p = S.puzzle;
  pl.done = { at: Date.now(), secs: Math.round(pl.ms / 1000), total: charged(pl), gaveUp: !!pl.gaveUp };
  if (S.daily && !pl.gaveUp) noteDayTime("crossword", pl.done.total, S.daily);
  if (S.ranked && !pl.gaveUp) {
    const t = read(TIMES, {}), lv = t[p.level] || { best: null, solved: 0, clean: 0 };
    lv.solved++;
    if (!pl.reveals && !pl.checks) lv.clean++;
    if (lv.best == null || pl.done.total < lv.best) lv.best = pl.done.total;
    t[p.level] = lv;
    write(TIMES, t);
  }
  learnFrom(p, pl, ownClue);
  save();
  paint(); drawClock();
  setTimeout(() => showDone(), 500);
}
/**
 * What the grid teaches, for the knowledge entries you could read: one you got without a revealed letter moves up
 * the review pile (and, the clue matched to its answer, is known one way round: known.js); one with a letter revealed
 * goes into it as a name-it card, for Deck and the other games' learning modes.
 */
function learnFrom(p, pl, mine) {
  for (const { e, helped } of lessons(p, pl, mine)) {
    const k = kbEntry(e.key);
    if (!k) continue;
    if (e.kind === "fwd") { if (!helped) known.recognised([e.pair]); }
    else known.named(e.pair, !helped);
    if (helped) pile.record("crossword", e.key, reviewCard(k), "clue");
    else if (pile.has("crossword", e.key)) pile.answer("crossword", e.key, true);
  }
}
function showDone() {
  const p = puzzle(), pl = play(), body = $("doneBody");
  if (!p || !pl) return;
  const team = G?.mode === "split", race = G?.mode === "race";
  const secs = team ? G.done?.secs ?? secsNow() : race ? Math.round(pl.ms / 1000) : pl.done?.secs ?? secsNow();
  const total = team ? G.done?.total ?? secs : race ? secs + pl.reveals * REVEAL_COST + pl.checks * CHECK_COST : pl.done?.total ?? charged(pl);
  const reveals = team ? G.reveals : pl.reveals, checks = team ? G.checks : pl.checks, gaveUp = !team && pl.gaveUp;
  $("doneTitle").textContent = gaveUp ? "Revealed" : team ? "Solved together" : race ? (raceOver(G, present()) ? raceVerdict() : "You've finished")
    : S?.partner ? `Solved with ${RIVALS[S.partner.level]?.name || "your partner"}` : "Solved";
  body.replaceChildren();
  const sum = el("p", "cw-sum");
  sum.append(gaveUp ? "Given up after " : "", el("b", "", clock(gaveUp ? secs : total)));
  if (!gaveUp && (reveals || checks)) sum.append(` (${clock(secs)} on the clock${reveals ? `, ${reveals} letter${reveals === 1 ? "" : "s"} revealed` : ""}${checks ? `, ${checks} wrong found` : ""})`);
  else if (!gaveUp) sum.append(" with no help");
  body.append(sum);
  if (!G && rivalPlan && S.rival && !gaveUp) {
    const theirs = rivalPlan.done + rivalPlan.penalty, name = RIVALS[S.rival.level]?.name || "The rival";
    body.append(el("p", "cw-why", theirs > total ? `You beat ${name} (${clock(theirs)}) by ${clock(theirs - total)}.` : theirs < total ? `${name} won, in ${clock(theirs)}.` : `A dead heat with ${name}.`));
  }
  if (race) body.append(raceRows());
  // what it was about: every knowledge entry with its link (a partner's too, now it can be read), those of yours
  // that go to the review pile marked
  const kb = lessons(p, pl), theme = p.entries.find(e => e.kind === "key");
  if (kb.length) {
    body.append(el("h4", "menu-h", "What it was about"));
    const ul = el("ul", "cw-learnt");
    if (theme) { const li = el("li"); li.append(el("b", "", `★ ${theme.answer}`), el("small", "", `The ${theme.cat} behind every starred clue`)); ul.append(li); }
    for (const { e, helped } of kb) {
      const k = kbEntry(e.key), again = helped && ownClue(e), a = k ? BANK[k.a].name : "";
      const li = el("li", again ? "again" : "");
      li.append(el("b", "", k?.dir === "fwd" ? `${k.lead} → ${a}` : `${a} → ${e.answer}`), el("small", "", `${k?.hint || e.text}${again ? " · back for review" : ""}`));
      ul.append(li);
    }
    body.append(ul);
  }
  if (G) {
    body.append(action("Another grid", () => { $("doneDlg").close(); dealAgain(); }, "primary"), action("Back to solo", () => { $("doneDlg").close(); backToSolo(); }, "link"));
  } else {
    if (dailyDue("crossword") && !S.daily) body.append(action("Today's grid", () => { $("doneDlg").close(); newGrid(true); }, "primary"));
    body.append(action("New grid", () => { $("doneDlg").close(); newGrid(false); }, dailyDue("crossword") && !S.daily ? "" : "primary"));
  }
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

// ---------- your own grid ----------
let dealing = false;
/** A new grid of your own: today's, or a random one from your settings. Asks first while one is under way. */
async function newGrid(daily, { ask = true } = {}) {
  if (dealing) return;
  const pl = S?.play;
  if (ask && pl && !pl.done && pl.letters.replace(/[#.]/g, "").length > 0 && !confirm(daily ? "Start today's grid? This one isn't finished." : "Start a new grid? This one isn't finished.")) return;
  dealing = true;
  const done = busy(daily ? "Setting today's grid" : "Setting a grid", { delay: 0 });
  try {
    const day = today();
    let opts = daily ? dailyOptions(day) : randomOptions(), narrow = false;
    let p = await makePuzzleOff(opts);
    if (!p && !daily && opts.kind !== "classic") { narrow = true; p = await makePuzzleOff({ ...opts, topics: null, pool: "mixed", asks: "both" }); }   // too narrow a choice: every topic
    if (!p) { toast("Couldn't set a grid: try again"); return; }
    if (!daily) pile.dealt("crossword", p.entries.map(e => e.key).filter(Boolean));
    const comp = computerFor(daily);
    S = { v: 1, puzzle: p, play: freshPlay(p), daily: daily ? day : null, opts: daily ? null : { level: opts.level, size: opts.size, kind: opts.kind, pool: opts.pool, asks: opts.asks, mode: opts.mode },
      // a best is a grid you played alone, today's or one like it: the level's own size, both kinds of entry, on a
      // preset, both ways, mixed answers, no twist
      ranked: comp?.kind !== "partner" && (daily || (!narrow && presetNow() !== "custom" && opts.size === LEVELS[opts.level]?.size && opts.kind === "both"
        && opts.mode === "classic" && opts.asks === "both" && opts.pool === "mixed")),
      rival: comp?.kind === "rival" ? { level: comp.level, seed: p.seed } : null,
      partner: comp?.kind === "partner" ? { level: comp.level, seed: p.seed } : null };
    if (narrow) setTimeout(() => toast("Your choices were too narrow for a grid: this one has every topic"), 300);
    afterNewRun();
    save();
  } finally { done(); dealing = false; }
}
function afterNewRun() {
  rivalPlan = S?.rival ? rivalRun(S.puzzle, S.rival.level, S.rival.seed) : null;
  rivalSaid = false;
  partner = S?.partner && !S.play.done ? { rnd: seeded(S.partner.seed ^ Math.floor(S.play.ms)), tried: new Map(), plan: null, idle: 0 } : null;
  drawnFor = null;
  buildBoard();
  const p = puzzle(), first = p?.entries[0], at = S?.at;
  if (at && p && !isBlack(p, at.k) && entriesAt(p, at.k)[at.dir]) cur = { ...at };
  else if (first) cur = { k: first.cells[0], dir: first.dir };
  paint(); drawStrip(); drawClock();
}
let rivalSaid = false;

// ---------- the computer as your partner ----------
// A split grid played alone: you hold the Across clues, the computer the Down ones, which you see as its, and it
// writes its answers in its colour at a person's pace: the grading solver at its level, reading a clue, getting it
// from the clue or the letters in, and when it can't get any, waiting for your crossings (crossword-solve.js).
let partner = null;            // { rnd, tried, plan: { n, at } (an answer it's writing, done at `at` ms on the clock), idle }
const partnerHolds = () => puzzle().entries.map(e => e.dir === "down");
function partnerTick() {
  if (!partner || G || !S?.partner || S.play.done || IN_FRAME) return;
  const pl = S.play, p = S.puzzle;
  if (partner.plan) {
    if (pl.ms < partner.plan.at) return;
    const e = p.entries[partner.plan.n];
    partner.plan = null;
    pl.by ||= {};
    e.cells.forEach((k, i) => { if (!pl.revealed.includes(k) && pl.letters[k] !== e.letters[i]) { put(pl, p, k, e.letters[i]); pl.by[k] = 1; } });
    changed();
    return;
  }
  if (pl.ms < partner.idle) return;
  const move = partnerMove(p, pl.letters, partnerHolds(), S.partner.level, partner.rnd, partner.tried);
  if (move) partner.plan = { n: move.n, at: pl.ms + move.at * 1000 };
  else partner.idle = pl.ms + 3000;           // nothing it can get: it looks again in a moment, and as your letters come
}
/** How many of its clues the partner has right: { right, of }. */
function partnerScore() {
  const pl = S.play, hold = partnerHolds();
  const its = S.puzzle.entries.filter((_, n) => hold[n]);
  return { right: its.filter(e => entryRight(pl, e)).length, of: its.length };
}
/** Today's grid, still to play: asks before leaving one you've started. */
function openToday() {
  if (S?.daily === today()) { afterNewRun(); return; }
  newGrid(true);
}
/** Today's grid from the start again: the same grid, every square empty; the first solve is the one that counted. */
function restartToday() {
  if (S?.play && !S.play.done && S.play.letters.replace(/[#.]/g, "").length && !confirm("Empty today's grid and start it again?")) return;
  S.play = freshPlay(S.puzzle);
  save();
  afterNewRun();
}

// ---------- together: the table (together.js) ----------
// The pair's duo match, or a party's table of up to six. Split: one grid, the clues dealt round the table (README),
// every letter sent to the table a moment after it's typed and shown at once; race: the same grid for everyone, each
// their own, the others' progress in the strip.
let joining = null;
const seated = () => { joining?.(); joining = null; };
const first = name => String(name || "Player").trim().split(/\s+/)[0];
const initial = name => (Array.from(first(name))[0] || "?").toUpperCase();
/** Everyone seated, by seat: [{ slot, name, me, here, at }]. */
function people() {
  if (!together.room || together.slot == null || !G) return [];
  const mine = { slot: together.slot, name: together.room.name, me: true, here: true };
  return [mine, ...together.others().map(o => ({ ...o, at: G.players?.[o.id]?.at }))].sort((a, b) => a.slot - b.slot);
}
const present = () => people().filter(p => p.here).map(p => p.slot);
const nameOfSlot = slot => { const p = people().find(x => x.slot === slot); return p?.me ? "You" : first(p?.name || `Seat ${slot + 1}`); };
function holderName(e) {
  if (!G) return RIVALS[S?.partner?.level]?.name || "Your partner";
  const s = holders(G.puzzle, G.people || 2)[e.n];
  return nameOfSlot(s);
}
/** Whether this phone can read an entry's clue: alone, all but a computer partner's; racing, all; split, its own and
 *  those of seats nobody's in. */
function canRead(e) {
  if (!G) return !S?.partner || e.dir === "across";
  if (G.mode !== "split") return true;
  return readable(G, together.slot, present())[e.n];
}
/** Whether an entry's clue is this player's own: alone, all but a computer partner's; racing, all; split, the ones
 *  dealt to their seat. */
const ownClue = e => (!G ? !S?.partner || e.dir === "across" : G.mode !== "split" || holders(G.puzzle, G.people || 2)[e.n] === together.slot);
function badge(slot) {
  const p = people().find(x => x.slot === slot), b = el("i", "cw-by", initial(p?.name));
  b.style.setProperty("--who", `var(--p${slot % 6})`);
  return b;
}
function drawTable(box) {
  const all = people();
  if (G.mode === "split") {
    for (const p of all) { const b = badge(p.slot); b.classList.toggle("me", !!p.me); b.classList.toggle("away", !p.here); b.title = `${p.me ? "You" : p.name}${p.here ? "" : " (away)"}`; box.append(b); }
    return;
  }
  for (const p of all.filter(x => !x.me)) {
    const r = runOf(G, p.slot), span = el("span", "cw-race");
    span.append(badge(p.slot), ` ${r?.done ? `✓ ${clock(runTotal(r))}` : r?.begun ? `${r.solved || 0}/${G.puzzle.entries.length}` : p.here ? "…" : "away"}`);
    box.append(span);
  }
  const rival = tableRivalNow();
  if (rival) {
    const span = el("span", "cw-race");
    span.append(el("b", "", rival.name), ` ${rival.done ? `✓ ${clock(rival.total)}` : `${rival.solved}/${G.puzzle.entries.length}`}`);
    box.append(span);
  }
}
let tableRivalFor = null, tableRivalPlan = null;
function tableRival() {
  const key = `${G.created}-${G.n}`;
  if (tableRivalFor !== key) { tableRivalFor = key; tableRivalPlan = G.rival ? rivalRun(G.puzzle, G.rival.level, G.rival.seed) : null; }
  return tableRivalPlan;
}
/** The computer player's race so far, as the standings take it, or null when none races. */
function tableRivalNow() {
  const plan = G.rival ? tableRival() : null;
  if (!plan) return null;
  const at = rivalAt(plan, (serverNow() - G.begun) / 1000);
  return { name: RIVALS[G.rival.level]?.name || "Rival", solved: at.solved, done: at.done, total: plan.done + plan.penalty };
}
/** The race's standings as rows: rank, who, and a time or how far they've got. */
function raceRows() {
  const ol = el("ol", "cw-rows");
  for (const x of standings(G, tableRivalNow())) {
    const li = el("li", x.slot === together.slot ? "me" : "");
    const how = x.total != null ? clock(x.total) : x.run?.begun || x.rival ? `${x.run?.solved || 0}/${G.puzzle.entries.length}` : "—";
    li.append(el("span", "pos", x.rank ? String(x.rank) : "·"), el("span", "", x.rival ? x.name : x.slot === together.slot ? "You" : first(x.name)), el("span", "t", how));
    ol.append(li);
  }
  return ol;
}
/** The split table's grid as a play: its letters with yours not yet sent laid over them. */
let pending = {};
function tablePlay() {
  const base = lettersOf(G);
  const letters = Object.keys(pending).length ? [...base].map((ch, k) => (pending[k] != null ? pending[k] : ch)).join("") : base;
  const keys = x => Object.keys(x || {}).map(k => Number(k.slice(1)));
  return { letters, revealed: keys(G.revealed), wrong: keys(G.wrong), checks: G.checks, reveals: G.reveals, ms: secsNow() * 1000, done: G.done };
}
let flushing = null, flushTimer = 0;
function flushSoon() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 180); }
/** Sends the letters typed since the last send, in one transaction; a send waits for the one before it. */
async function flush() {
  clearTimeout(flushTimer);
  if (flushing) { await flushing; if (Object.keys(pending).length) return flush(); return; }
  if (!G || !Object.keys(pending).length) return;
  const sent = { ...pending }, n = G.n, slot = together.slot;
  flushing = together.act(g => writeAt(tidy(g), { n, slot, letters: sent, now: serverNow() }));
  await flushing;
  flushing = null;
  for (const [k, ch] of Object.entries(sent)) if (pending[k] === ch) delete pending[k];
  if (G) paint();
  if (Object.keys(pending).length) flushSoon();
}
// where each player is, for the others: their entry, written to their own seat at most every 300 ms
let whereTimer = 0, whereSent = null;
function sayWhere() {
  if (!G || !together.room || G.mode !== "split") return;
  clearTimeout(whereTimer);
  whereTimer = setTimeout(() => {
    const e = current(), at = e ? { n: e.n, k: cur.k } : null, key = JSON.stringify(at);
    if (key === whereSent) return;
    whereSent = key;
    together.room.sync.update(`${branchPath(together.room.code, "crossword")}/players/${together.room.uid}`, { at })?.catch?.(err => console.error(err));
  }, 300);
}
/** The others' entries on the grid: cell → { slot, initial, here } (their cursor's square carries their initial). */
function peerCells() {
  const out = new Map();
  for (const p of people()) {
    if (p.me || !p.at || !p.here) continue;
    const e = G.puzzle.entries[p.at.n];
    if (!e) continue;
    for (const k of e.cells) if (!out.has(k)) out.set(k, { slot: p.slot, here: k === p.at.k, initial: initial(p.name) });
  }
  return out;
}
function onState(val) {
  seated();
  const was = G;
  G = tidy(structuredClone(val));
  if (!serverOffsetStop) serverOffsetStop = together.room?.sync.serverOffset?.(ms => { serverOffset = ms || 0; }) || (() => {});
  if (was?.n !== G.n || was?.created !== G.created) {
    pending = {}; shownDone = null;
    if ($("doneDlg").open) $("doneDlg").close();
    if (G.mode === "race") startRace();
    drawnFor = null;
    buildBoard();
    const e = G.puzzle.entries.find(x => canRead(x)) || G.puzzle.entries[0];
    cur = { k: e.cells[0], dir: e.dir };
    if (was) toast(G.mode === "race" ? "A new race" : "A new grid");
  } else if (G.mode === "split") fillList($("list"));                   // who's here may have changed whose clues show
  paint(); drawStrip(); drawClock();
  // the end, on every phone: split, once the grid is done; a race, once your own run is (and again as the others finish)
  const key = `${G.created}-${G.n}`, mine = G.mode === "split" ? !!G.done : !!runOf(G, together.slot)?.done;
  if (mine && shownDone !== key) {
    shownDone = key;
    if (G.mode === "split") learnFrom(G.puzzle, tablePlay(), ownClue);
    setTimeout(showDone, 400);
  } else if (G.mode === "race" && $("doneDlg").open) showDone();
}
/** Who won a race that's over: "You win", "A dead heat", or the winner's name. */
function raceVerdict() {
  const tops = standings(G, tableRivalNow()).filter(x => x.rank === 1);
  if (tops.some(x => x.slot === together.slot)) return tops.length > 1 ? "A dead heat" : "You win";
  return `${tops[0]?.rival ? tops[0].name : first(tops[0]?.name)} wins`;
}
let shownDone = null, serverOffsetStop = null;
/** Your run of a race: kept on this phone (a reload picks it up), the table told how far you've got. */
function startRace() {
  const kept = read(TABLE_RUN, null), code = together.room?.code;
  if (kept && kept.code === code && kept.created === G.created && kept.n === G.n && kept.play) R = kept;
  else R = { code, created: G.created, n: G.n, play: freshPlay(G.puzzle), begun: serverNow() };
  keepRace();
  reportRace(true);
}
function keepRace() { if (R) write(TABLE_RUN, R); }
let reportTimer = 0;
function reportRace(now = false) {
  if (!R || !G || G.mode !== "race") return;
  clearTimeout(reportTimer);
  const go = () => {
    const pl = R.play, p = G.puzzle, solved = p.entries.filter(e => entryRight(pl, e)).length;
    const run = { begun: R.begun, solved, filled: pl.letters.replace(/[#.]/g, "").length, checks: pl.checks, reveals: pl.reveals, secs: Math.round(pl.ms / 1000), ...(pl.done ? { done: true } : {}) };
    together.act(g => reportAt(tidy(g), { n: R.n, slot: together.slot, run }));
  };
  if (now) go(); else reportTimer = setTimeout(go, 1500);
}
function solvedRace() {
  const pl = R.play;
  pl.done = { at: serverNow(), secs: Math.round(pl.ms / 1000) };
  learnFrom(G.puzzle, pl, () => true);
  keepRace();
  reportRace(true);
  paint();
  shownDone = `${G.created}-${G.n}`;            // your result at once; the standings fill in as the table hears
  setTimeout(showDone, 400);
}
// the race clock: your own run's, from when you began, standing still once you're done
setInterval(() => {
  if (G?.mode === "race" && R?.play && !R.play.done) { R.play.ms = Math.max(0, serverNow() - R.begun); drawClock(); }
  if (G) drawStrip();
}, 1000);
/**
 * The database's time, for a table's start: every phone's clock is counted from it, so the dealing phone's own clock
 * being out would put everyone's out. Its offset is asked once (a second at most); the phone's own time if it can't be.
 */
async function databaseNow() {
  try {
    const sync = await getSync();
    const off = await new Promise(res => {
      let stop = null;
      const t = setTimeout(() => res(0), 1000);
      stop = sync.serverOffset?.(ms => { clearTimeout(t); res(ms || 0); setTimeout(() => stop?.(), 0); });
      if (!stop) { clearTimeout(t); res(0); }
    });
    return Date.now() + off;
  } catch { return Date.now(); }
}
/** A race's computer player, from the dealer's settings: a rival set to race races at the table too. */
const raceRival = (mode, p) => (mode === "race" && settings().computer === "rival" ? { level: RIVALS[settings().pace] ? settings().pace : "quick", seed: p.seed } : null);
/** A new game for the table, in the mode the menu chose: asks first while this one is under way. */
async function dealAgain(mode = settings().tableMode) {
  if (!G) return;
  const going = G.mode === "split" ? !G.done && Object.keys(G.cells).length > 0 : R?.play && !R.play.done && R.play.letters.replace(/[#.]/g, "").length > 0;
  if (going && !confirm("Deal a new grid for the table? This one isn't finished.")) return;
  const n = G.n, done = busy("Setting a grid", { delay: 0 });
  try {
    const p = await makePuzzleOff(randomOptions());
    if (!p) { toast("Couldn't set a grid: try again"); return; }
    const rival = raceRival(mode, p);
    await together.act(g => newGameAt(tidy(g), { n, puzzle: p, mode, now: serverNow(), rival }));
  } finally { done(); }
}
async function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return saved; } catch { /* private mode */ }
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
const together = createTogether({
  game: "crossword",
  app: APP,
  toast,
  askName,
  valid: isTable,
  slots: g => g?.people || 2,
  fresh: async (players, { ask } = {}) => {
    const p = await makePuzzleOff(randomOptions()), mode = settings().tableMode === "race" ? "race" : "split";
    return freshTable(players, { app: APP, puzzle: p, mode, people: peopleOf(ask), now: await databaseNow(), rival: raceRival(mode, p) });
  },
  onState,
  onPresence: () => { if (G) { fillList($("list")); paint(); drawStrip(); } },
  onLeave: () => {
    seated();
    G = null; R = null; pending = {}; shownDone = null;
    serverOffsetStop?.(); serverOffsetStop = null;
    if ($("doneDlg").open) $("doneDlg").close();
    S = read(RUN, null);
    drawnFor = null;
    solo();
  },
  result: g => resultOf(tidy(structuredClone(g)), together.slot, present()),
});
const backToSolo = () => { if (together.room) together.leave(); else location.replace(soloHref()); };

// ---------- the menu ----------
let pick = null;
function openMenu() {
  const body = $("menuBody"), dlg = $("menuDlg"), top = dlg.open ? dlg.scrollTop : 0;
  body.replaceChildren();
  const s = settings();
  const play_ = part(body, "play");
  if (puzzle() && !finished()) {
    const help = (label, fn) => choice(label, [["letter", "Letter"], ["word", "Word"], ["grid", "Grid"]], null, v => { dlg.close(); fn(v); });
    play_.append(help("Check", helpCheck), help("Reveal", helpReveal));
  }
  if (zoomable() || view) play_.append(choice("Zoom", [["whole", "Whole grid"], ["close", "Close up"]], view ? "close" : "whole", v => { dlg.close(); setZoom(v === "close"); }));
  if (together.room || joining) {
    const table = part(body, "together");
    if (G) {
      table.append(action("New grid", () => dealAgain(), "primary"),
        choice("Play", Object.entries(TABLE_MODES), s.tableMode, v => { setSetting("tableMode", v); openMenu(); }),
        line(`The next grid: ${s.tableMode === "race" ? "a race, each on their own grid" : "one grid, its clues split between you"}.`));
      const all = people().map(p => `${p.me ? "you" : p.name}${p.here ? "" : " (away)"}`);
      table.append(line(`At the table: ${all.length > 1 ? `${all.slice(0, -1).join(", ")} and ${all.at(-1)}` : all.join("")}`));
    } else { const wait = line(joiningWords()); wait.prepend(sextant()); table.append(wait); }
    table.append(action("Back to solo", backToSolo, "link"));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= (S?.daily && !S.play?.done) || dailyDue("crossword") ? "daily" : "random";
  const onToday = S?.daily === today();
  play_.prepend(action(pick === "random" ? "New grid" : onToday ? "Start today's again" : "Today's grid", () => (pick === "random" ? newGrid(false) : onToday ? restartToday() : openToday()), "primary"));
  const content = part(body, "content");
  // what today's is, whichever is picked: a line that came and went would move every choice under it
  content.append(choice("Grid", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }),
    line("Today's is Medium, 13×13, every topic: the same for everyone."));
  // the rest is your random grid's, shown with today's picked too: changing any of it picks Random for the next grid
  // (today's stays as it is), and a change that shows or hides another choice draws the menu again
  const set = (key, again = false) => v => { setSetting(key, v); if (again || pick !== "random") { pick = "random"; redrawMenu(key); } };
  const knowledge = s.kind !== "classic";
  content.append(
    keyed("kind", choice("Clues", Object.entries(KINDS), s.kind, set("kind", true))),
    keyed("size", choice("Size", SIZE_IDS.map(n => [n, `${n}×${n}`]), sizeOf(s), set("size", true))),
    keyed("level", choice("Level", LEVEL_IDS.map(id => [id, LEVELS[id].name]), s.level, set("level", true))),
    ...(knowledge ? [
      keyed("pool", choice("Answers", Object.entries(POOLS), s.pool, set("pool"))),
      // a Lexicon grid of country and commodity names alone can't be filled: there are too few of them
      keyed("asks", choice("Knowledge", Object.entries(ASKS).filter(([k]) => s.kind !== "lexicon" || k !== "fwd"), s.kind === "lexicon" && s.asks === "fwd" ? "both" : s.asks, set("asks"))),
      ...(themeFits({ level: s.level, size: sizeOf(s), kind: s.kind }) ? [keyed("mode", choice("Twist", Object.entries(MODES), s.mode, set("mode")))] : []),
      keyed("topics", topicMix(TOPIC_LIST, TOPIC_PRESETS, mix(), w => { write(TOPICS, w); if (pick !== "random") { pick = "random"; redrawMenu("topics"); } },
        { groups: [["Country topics", KB_TOPICS.country], ["Commodity topics", KB_TOPICS.commodity]],
          note: w => (presetOf(TOPIC_LIST, TOPIC_PRESETS, w) === "custom" ? "Your own mix doesn't count for your best; today's grid and the presets do." : null) })),
    ] : []),
  );
  const settingsPart = part(body, "settings");
  // the computer: a rival racing your grid, or a partner holding its Down clues; from the next grid
  settingsPart.append(choice("Computer", [["off", "Off"], ["rival", "Rival"], ["partner", "Partner"]], s.computer, v => { setSetting("computer", v); openMenu(); }));
  if (s.computer !== "off") settingsPart.append(choice("Its pace", Object.entries(RIVALS).map(([k, r]) => [k, r.name]), s.pace, v => setSetting("pace", v)));
  settingsPart.append(toggle("Check as you go", s.autocheck, on => setSetting("autocheck", on)),
    choice("Learning mode", pile.MODES, pile.mode(), pile.setMode));
  const t = read(TIMES, {}), bests = LEVEL_IDS.filter(id => t[id]?.best != null).map(id => `${LEVELS[id].name} ${clock(t[id].best)}`);
  const solvedN = LEVEL_IDS.reduce((n, id) => n + (t[id]?.solved || 0), 0);
  part(body, "about").append(line(bests.length ? `Best: ${bests.join(" · ")} · ${solvedN} solved` : "No grid solved yet"),
    line(`A revealed letter adds ${REVEAL_COST} s, a wrong letter a check finds ${CHECK_COST} s.`));
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = top;
}
/** A menu control marked with what it sets, so the menu drawn again can be scrolled to keep it where it was. */
const keyed = (key, node) => { node.dataset.key = key; return node; };
/** The menu drawn again with the control just changed (`key`) under the finger where it was. */
function redrawMenu(key) {
  const dlg = $("menuDlg"), at = () => dlg.querySelector(`[data-key="${key}"]`)?.getBoundingClientRect().top;
  const was = at();
  openMenu();
  const now = at();
  if (was != null && now != null) dlg.scrollTop += now - was;
}

// ---------- the keyboard ----------
let keyDown = 0;               // when a finger last landed on a key
function buildKeyboard() {
  const rows = [[..."QWERTYUIOP"], ["", ..."ASDFGHJKL", ""], ["CLUES", ..."ZXCVBNM", "BACK"]];
  $("kbd").replaceChildren(...rows.map(keys => {
    const r = el("div", "cw-krow");
    for (const k of keys) {
      if (!k) { r.append(el("span", "half")); continue; }
      const b = el("button", k.length > 1 ? `wide${k === "BACK" ? " del" : ""}` : "", k === "BACK" ? "⌫" : k === "CLUES" ? "Clues" : k);
      b.type = "button";
      if (k === "BACK") b.setAttribute("aria-label", "Delete");
      // a letter acts as the finger lands, as a phone's own keyboard does, and never takes the focus; the click that
      // follows is let through only when no finger came first (Enter or Space on a focused key). Clues opens its sheet
      // on the click: opened as the finger landed, the click that follows would land on the sheet's backdrop and shut it
      if (k !== "CLUES") b.addEventListener("pointerdown", e => { e.preventDefault(); keyDown = performance.now(); press(k); });
      b.addEventListener("click", () => { if (k === "CLUES" || performance.now() - keyDown > 700) press(k); });
      r.append(b);
    }
    return r;
  }));
}
function press(k) {
  if (k === "BACK") backspace();
  else if (k === "CLUES") openClues();
  else typeLetter(k);
}
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (!puzzle() || joining) return;
  const k = e.key;
  if (/^[a-z]$/i.test(k)) typeLetter(k.toUpperCase());
  else if (k === "Backspace" || k === "Delete") backspace();
  else if (k === "ArrowLeft") arrow(0, -1);
  else if (k === "ArrowRight") arrow(0, 1);
  else if (k === "ArrowUp") arrow(-1, 0);
  else if (k === "ArrowDown") arrow(1, 0);
  else if (k === "Tab" || k === "Enter") step(e.shiftKey ? -1 : 1);
  else if (k === " ") toggleDir();
  else if (k === "+" || k === "=") zoomStep(1);
  else if (k === "-") zoomStep(-1);
  else return;
  e.preventDefault();
});

let toastTimer = 0;
/** A word for a moment, over the clue bar: never over the grid, where it would hide the squares it's about. */
function toast(text) {
  const t = $("toast"), bar = $("clueBar").getBoundingClientRect();
  t.textContent = text;
  t.style.setProperty("--toast-at", `${Math.max(8, bar.top + bar.height / 2 - t.offsetHeight / 2)}px`);
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 2200);
}

// ---------- wiring ----------
document.querySelector(".cw-mark").innerHTML = APPS.find(a => a.id === "crossword")?.logo || "";
bindSwitcher($("appsBtn"), "crossword");
buildKeyboard();
$("prevClue").addEventListener("click", () => step(-1));
$("nextClue").addEventListener("click", () => step(1));
$("clueText").addEventListener("click", toggleDir);
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("cluesClose").addEventListener("click", () => $("cluesDlg").close());
$("cluesDlg").addEventListener("click", e => { if (e.target === $("cluesDlg")) $("cluesDlg").close(); });
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("zoomBtn").addEventListener("click", () => setZoom(!view));
startClock();
// the rival finishing while you're still at it is news
setInterval(() => {
  if (G || !rivalPlan || !S?.rival || S.play.done || rivalSaid) return;
  if (rivalAt(rivalPlan, S.play.ms / 1000).done) { rivalSaid = true; toast(`${RIVALS[S.rival.level]?.name || "The rival"} has finished: ${clock(rivalPlan.done + rivalPlan.penalty)}`); }
}, 1000);
function solo() {
  if (arrivedForToday() && !(S?.daily === today())) { if (S) afterNewRun(); setTimeout(() => newGrid(true), 0); return; }
  if (!S) { newGrid(dailyDue("crossword"), { ask: false }); return; }
  afterNewRun();
  if (S.play.done) setTimeout(showDone, 300);
}
// a table in the address (a duo match, a party's game): the rete until it's drawn, and no solo grid under it
const code = roomInAddress();
if (code && !IN_FRAME) { joining = busy(joiningWords(), { delay: 0 }); together.join(code).then(ok => { if (!ok) { seated(); solo(); } }); }
else solo();
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });

// for tests and debugging
window.__crossword = { get state() { return S; }, get table() { return G; }, get cursor() { return cur; }, get view() { return view; }, get fit() { return fit; },
  typeLetter, backspace, tapCell, step, helpCheck, helpReveal, newGrid, setZoom, zoomStep, together };
