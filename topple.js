// Topple: a table of sixty-one hexagons, drawn in 3D (topple-3d.js; flat, in topple-flat.js, where there's no WebGL).
// Drag one of three pieces of standing dominoes onto it; while it's held where it fits, the dominoes it would join are
// ringed with what their best push would fell. A tap on a domino chooses it: a brass handle shows out along its axis, a
// drag on the handle or on the domino turns it a thirty degrees at a time, a tap on it turns it a step, and what its
// best push would fell is ringed as it turns. When a hand's last piece is down the knock may be due: press a domino not
// chosen and slide it along its axis, the way it should fall; what would fall is ringed (what would stay standing
// marked) with its points; let go to push, or back where the finger started to think again. A pinch, the wheel or a
// double tap on the bare table brings it closer; closer, a drag on the bare table moves it, and at its whole size tilts
// it a little, as a watch dial does. The rules are topple-engine.js's; this file plays each move out and keeps the game.
// Two modes (the menu's Mode): Classic, the game as it has always been, and Levels (topple-levels.js), twelve tables each
// adding a thing to the last, each beaten at a goal score. Levels press nothing: a level can be left and come back to as
// it was, replayed, or skipped back to, beating one only opens the next, and the only word of it is a line at the first win.
import { SIZE, AXES, WAYS, PIECES, rulesOf, newGame, migrate, cover, lay, knock, turn as turnDomino, group, knockOn, fitsAnywhere, longest, untilKnock, axesOf, pushes, hitBy } from "./topple-engine.js";
import { LEVELS, levelRules } from "./topple-levels.js";
import { mapSvg } from "./topple-map.js";
import { heading, hexAt, SH, ZOOM, bounds, pieceSvg } from "./topple-slab.js";
import { createTable } from "./topple-3d.js";
import { sound } from "./topple-sound.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, choice, onPause } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
// RUN, BEST: Classic's game and best, as they have always been kept. MODE: "classic" or "levels". CAMP: { at (the level
// being played, 0 on), stars (the most stars won in each) }. RUNS: the game of each level begun, by its number (1 on).
const RUN = "topple:run", BEST = "topple:best", SEEN = "topple:seen", SOUND = "topple:sound", SEL = "topple:sel", MODE = "topple:mode", CAMP = "topple:camp", RUNS = "topple:lruns";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

let S = null;            // the game (topple-engine.js's), as saved
let mode = read(MODE, "classic") === "levels" ? "levels" : "classic";
let camp = readCamp();   // Levels: { at, stars }, as kept
let playing = false;     // a move being played out
let drag = null;         // a piece in hand: { slot, piece, colour, id, x0, y0, moved, lift, at (where it would go), float }
let sel = -1;            // the domino chosen, to turn: its hexagon (kept as topple:sel, so a partner watching sees it)
let knob = -1;           // the way the chosen domino's handle points: one of the two ways along its axis
let hand = null;         // one finger on the table: { id, kind ("turn", "press", "table", "spent"), x0, y0, x, y, moved, … }
let pinch = null;        // two: { d (how far apart), mid (the point between) }
const fingers = new Map();   // every pointer down on the table: its id and where it is
let marks = {};          // what's drawn over the table: ring, stay, compass, tag, ghost, handle, ax

sound.on = read(SOUND, true);
const stage = $("stage");
let view;
try { view = createTable(stage); }
catch (err) {
  console.warn("Topple: no WebGL here, so the table is drawn flat.", err);
  view = (await import("./topple-flat.js")).createFlat(stage);
}

const levelOk = g => g.level === undefined || (Number.isInteger(g.level) && g.level >= 0 && g.level < LEVELS.length && Number.isInteger(g.stars) && g.stars >= 0 && g.stars <= 3);
const valid = g => g && g.v === 5 && Array.isArray(g.cells) && g.cells.length === SIZE && Array.isArray(g.ax) && g.ax.length === SIZE && levelOk(g)
  && g.cells.every((c, i) => (c >= 0) === (g.ax[i] >= 0 && g.ax[i] < AXES)) && Array.isArray(g.hand) && g.hand.length === 3 && g.hand.every(h => !h || PIECES[h.piece]);

// ---------- the modes ----------
/** The campaign as kept: the level being played and the stars won in each, mended if it is not what it should be. */
function readCamp() {
  const c = read(CAMP, null), stars = LEVELS.map((_, k) => (Number.isInteger(c?.stars?.[k]) ? Math.max(0, Math.min(3, c.stars[k])) : 0));
  const open = stars.findIndex(s => s < 1);                          // the first level not beaten is the last one open
  return { at: Number.isInteger(c?.at) ? Math.max(0, Math.min(c.at, open < 0 ? LEVELS.length - 1 : open)) : 0, stars };
}
/** Whether level n (0 on) is open: the first, and any whose one before is beaten. */
const isOpen = n => n === 0 || camp.stars[n - 1] >= 1;
const inLevels = () => mode === "levels";
/** The game saved for the mode being played (and its level), or null. */
function savedGame() {
  const g = migrate(inLevels() ? read(RUNS, {})[camp.at + 1] : read(RUN, null));
  return valid(g) && (inLevels() ? g.level === camp.at : g.level === undefined) ? g : null;
}
function save() {
  if (inLevels()) write(RUNS, { ...read(RUNS, {}), [camp.at + 1]: S });
  else write(RUN, S);
}
/** A game begun anew: of the level being played, or Classic's. */
function newRun() {
  drag?.float.remove();
  drag = null;
  setSel(-1);
  S = newGame(Math.floor(Math.random() * 2 ** 31), inLevels() ? camp.at : -1);
  save();
  render();
}
/** The game of the mode and level now chosen, as it was left (else a new one). */
function resume() {
  drag?.float.remove();
  drag = null;
  S = savedGame();
  if (!S) { newRun(); return; }
  const kept = read(SEL, -1);
  sel = Number.isInteger(kept) && S.cells[kept] >= 0 && !S.over ? kept : -1;
  if (sel >= 0) knob = facingYou(sel);
  save();
  render();
}
function setMode(next) {
  if (next === mode) return;
  mode = next;
  write(MODE, mode);
  setSel(-1);
  resume();
}
/** Plays level n (0 on) as it was left, or new if it was not begun. */
function playLevel(n) {
  if (!isOpen(n)) return;
  camp.at = n;
  write(CAMP, camp);
  mode = "levels";
  write(MODE, mode);
  setSel(-1);
  resume();
}

// ---------- over the table: what the drawing says, in the screen's own pixels ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const over = $("over"), marksG = el("g", { class: "tp-marks" }), fxG = el("g", { class: "tp-fx" });
over.append(marksG, fxG);
const pt = p => p.map(v => v.toFixed(1)).join(" ");
const hullD = hull => `M${hull.map(pt).join("L")}Z`;
/** Pixels to a unit of the table, at its middle. */
const unit = () => { const a = view.project(0, 0, 0), b = view.project(1, 0, 0); return Math.hypot(b[0] - a[0], b[1] - a[1]); };
/** A score short enough to sit on a hexagon: 240, 1.4k, 12k. */
const short = n => (n < 1000 ? String(n) : n < 10000 ? `${(n / 1000).toFixed(1).replace(".0", "")}k` : `${Math.round(n / 1000)}k`);
const text = (cls, s, x, y, size) => {
  const t = el("text", { class: cls, x: x.toFixed(1), y: y.toFixed(1), "font-size": (size * scale()).toFixed(1) });
  t.textContent = s;
  return t;
};
/** Where a point of the table is on the page, in the client pixels a pointer event carries (view.project is the canvas's own). */
function onPage(x, y, z) {
  const [px, py] = view.project(x, y, z), r = view.canvas.getBoundingClientRect();
  return [px + r.left, py + r.top];
}
/**
 * The two ways a domino can be pushed, along its axis round it: the one slid to filled; with `gains`, what each would
 * score (none towards the table's edge, where only the domino itself would go). With the points it covers, to keep
 * words clear of.
 */
function compassEl(at, chosen, gains) {
  const [cx, cz] = view.centre(at), out = [], pts = [];
  for (const w of pushes(S.ax, at)) {
    const [ux, uz] = heading(w), vx = -uz, vz = ux, tip = 0.86, base = 0.5, wing = 0.17;
    const p = (a, b) => view.project(cx + ux * a + vx * b, 0.01, cz + uz * a + vz * b), arrow = [p(tip, 0), p(base, wing), p(base, -wing)];
    out.push(el("path", { class: `tp-arrow${w === chosen ? " on" : ""}`, d: `M${arrow.map(pt).join("L")}Z` }));
    pts.push(...arrow);
    if (gains && hitBy(at, w).some(j => j >= 0)) {
      const [x, y] = view.project(cx + ux * 1.32, 0.01, cz + uz * 1.32);
      out.push(text("tp-gain", short(gains.get(w)), x, y + 4 * scale(), 12.5));
      pts.push([x, y - 9 * scale()], [x, y + 6 * scale()]);
    }
  }
  return { g: el("g", {}, ...out), pts };
}
// The chosen domino's handle: a brass arm out of its face along its axis, to a knob on the table this far out (in
// hexagons): past the domino's own foot, short of the one beside it.
const KNOB = 0.74;
const knobPoint = (at, way) => { const [cx, cz] = view.centre(at), [ux, uz] = heading(way); return [cx + ux * KNOB, 0.02, cz + uz * KNOB]; };
function handleEl(at, way) {
  const [cx, cz] = view.centre(at), [ux, uz] = heading(way), [x0, y0] = view.project(cx + ux * 0.1, view.baseOf(at) + SH * 0.42, cz + uz * 0.1), [x1, y1] = view.project(...knobPoint(at, way)), r = 7 * scale();
  const arm = cls => el("line", { class: cls, x1: x0.toFixed(1), y1: y0.toFixed(1), x2: x1.toFixed(1), y2: y1.toFixed(1) });
  return { g: el("g", { class: "tp-handle" }, arm("under"), arm("arm"), el("circle", { cx: x1.toFixed(1), cy: y1.toFixed(1), r: r.toFixed(1) })), pts: [[x0, y0], [x1, y1 - r], [x1, y1 + r]] };
}
/** A line of words over a hexagon: above everything else drawn (`around`, points on the screen), or below it where there's no room above. */
function tagEl(words, i, around) {
  const s = scale(), [cx, cz] = view.centre(i), [x, top] = view.project(cx, view.topOf(i, kindAt(i)) + 0.15, cz), w = over.clientWidth, h = over.clientHeight || stage.clientHeight;
  const ys = around.map(p => Math.max(0, Math.min(h, p[1]))), half = Math.max(70, words.length * 3.4 * s);       // only what's in view counts
  let y = Math.min(top, ...ys) - 9 * s;
  if (y < 16 * s) y = Math.min(h - 6 * s, Math.max(top, ...ys) + 18 * s);
  return text("tp-tag", words, Math.min(w - half, Math.max(half, x)), y, 13);
}
const HINT = ["Drag a piece onto the table.", "Tap a domino, drag its handle to turn it.", "When a knock is due, press a domino", "and slide it the way it should fall.", "Past the bell, it scores double."];
/** Words broken into lines of at most `width` characters. */
function wrapped(words, width) {
  const out = [];
  for (const word of words.split(" ")) out.push(out.length && out[out.length - 1].length + word.length < width ? `${out.pop()} ${word}` : word);
  return out;
}
/** A plaque in the middle of the table: the lines of words, each as its class says, on a ground of brass-edged sheet. */
function plaqueEl(lines, w, h) {
  const s = scale(), gap = 15 * s, height = lines.length * gap + 22 * s, top = h / 2 - height / 2;
  return [el("rect", { class: "tp-plaque", x: (w / 2 - 128 * s).toFixed(1), y: top.toFixed(1), width: (256 * s).toFixed(1), height: height.toFixed(1), rx: 5 }),
    ...lines.map(([cls, words], k) => text(cls, words, w / 2, top + 20 * s + k * gap, 11))];
}
/** What a new level says on its empty table: its number and name, what it adds, and its goal. Gone when the first piece is down. */
function levelPlaque(w, h) {
  const L = LEVELS[S.level];
  return plaqueEl([["tp-ltitle", `${S.level + 1}  ${L.name}`], ...wrapped(L.about, 36).map(t => ["tp-hint", t]), ["tp-ltitle", `Goal ${fmt(L.goal)}`]], w, h);
}
/** Which colour stands (or is held, over the table) on a hexagon, for how tall it draws. */
const kindAt = i => (marks.ghost?.laid.includes(i) ? marks.ghost.colour : S.cells[i]);
function drawOver() {
  const w = over.clientWidth || stage.clientWidth, h = over.clientHeight || stage.clientHeight;
  over.setAttribute("viewBox", `0 0 ${w} ${h}`);
  if (!S) return;
  const { ring = [], stay = [], compass, tag, ghost, handle, ax = S.ax } = marks, ghostAx = new Map((ghost?.laid || []).map((i, k) => [i, axesOf(ghost.laid)[k]]));
  const axOf = i => ghostAx.get(i) ?? (ax[i] >= 0 ? ax[i] : 0), kids = [], pts = [];
  const add = ({ g, pts: p }) => { kids.push(g); pts.push(...p); };
  for (const [list, cls, grow] of [[stay, "tp-stay", 1.1], [ring, "tp-ring", 1.12]]) for (const i of list) { const hull = view.outlineOf(i, axOf(i), grow, kindAt(i)); add({ g: el("path", { class: cls, d: hullD(hull) }), pts: hull }); }
  if (compass) add(compassEl(...compass));
  if (handle) add(handleEl(...handle));
  if (tag) kids.push(tagEl(...tag, pts));
  const quiet = !ghost && !ring.length && !compass && !handle && !S.over;
  if (quiet && !read(SEEN, false) && S.laid < 3) {
    const lines = HINT.map((t, k) => text("tp-hint", t, w / 2, h / 2 + (k - 2) * 15 * scale() + 4 * scale(), 11));
    kids.push(el("rect", { class: "tp-plaque", x: (w / 2 - 124 * scale()).toFixed(1), y: (h / 2 - 48 * scale()).toFixed(1), width: (248 * scale()).toFixed(1), height: (92 * scale()).toFixed(1), rx: 5 }), ...lines);
  } else if (quiet && S.level >= 0 && S.laid === 0) kids.push(...levelPlaque(w, h));
  marksG.replaceChildren(...kids);
}
let turned = view.spin;
view.onPaint(() => {
  if (!S) return;
  if (view.spin !== turned) { turned = view.spin; drawTray(); }        // the table turned a quarter, as the screen did: so do the pieces under it
  drawOver();                                                            // a tilt, a zoom or a resize moves everything drawn over it
});

/**
 * The table: as it stands, or with extra: { cells, ax (a table to draw instead), bell (where it hangs, if not where it
 * hangs now), fresh (dominoes just stood up), ghost ({ laid, colour }: a piece held over it), ease (a domino turned eases
 * round), ring (hexagons to ring), stay (hexagons that would stay standing), tag ([text, hexagon]), compass ([hexagon,
 * the way slid to, gains]), handle ([hexagon, way]) }.
 */
function drawBoard(extra = {}) {
  const ghost = extra.ghost, ax = extra.ax || S.ax;
  view.terrain(rulesOf(S));
  view.set({ cells: extra.cells || S.cells, ax, bell: extra.bell ?? S.bell, fresh: extra.fresh || [], ghost: ghost && { laid: ghost.laid, colour: ghost.colour, ax: axesOf(ghost.laid) }, ease: !!extra.ease });
  setMarks({ ...extra, ax });
}
function setMarks(extra) {
  marks = { ring: extra.ring || [], stay: extra.stay || [], compass: extra.compass || null, tag: extra.tag || null, ghost: extra.ghost || null, handle: extra.handle || null, ax: extra.ax || S.ax };
  drawOver();
}

/** When the knock comes: now, after this hand, or in so many. */
function knockWords() {
  const n = untilKnock(S);
  return n === 0 ? "Knock now" : n === 1 ? "Knock after this hand" : `Knock in ${n} hands`;
}
const STAR = "★", HOLLOW = "☆";
const starsWords = n => STAR.repeat(n) + HOLLOW.repeat(3 - n);
/** How far a score has come on the meter (0 to 1): the three stretches, to the goal and the two stars beyond it, equal. */
function meterAt(stars, score) {
  const cuts = [0, ...stars];
  for (let k = 1; k < cuts.length; k++) if (score < cuts[k]) return (k - 1 + (score - cuts[k - 1]) / (cuts[k] - cuts[k - 1])) / 3;
  return 1;
}
function drawStrip() {
  const levels = inLevels(), L = levels ? levelRules(S.level) : null;
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  $("bestBox").hidden = levels;
  $("goalBox").hidden = !levels;
  $("meter").hidden = !levels;
  if (levels) {
    $("goal").textContent = fmt(L.goal);
    $("goalBox").classList.toggle("met", S.stars >= 1);
    $("lname").textContent = `${S.level + 1}  ${L.name}`;
    $("fill").style.width = `${(meterAt(L.stars, S.score) * 100).toFixed(1)}%`;
    $("lstars").textContent = starsWords(S.stars);
    $("lstars").setAttribute("aria-label", plural(S.stars, "star"));
  }
  const k = $("knock");
  k.className = `tp-knock${S.due && !S.over ? " now" : ""}`;
  k.textContent = S.over ? "" : knockWords();
  k.title = S.over ? "" : "A knock: press a domino and slide it along its axis, the way it should fall";
}
function drawTray() {
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  $("levelsBtn").hidden = !inLevels();
  $("againBtn").textContent = inLevels() ? "Replay" : "New game";
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = inLevels() ? levelVerdict() : `No room: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  $("tray").classList.toggle("waiting", S.due);
  const rules = rulesOf(S);
  for (const b of document.querySelectorAll(".tp-piece")) {
    const slot = Number(b.dataset.slot), h = S.hand[slot];
    b.replaceChildren(...(h ? [pieceSvg(h, false, view.spin, rules.tall).svg] : []));
    b.disabled = !h;
    b.classList.toggle("cant", !!h && !S.due && !fitsAnywhere(S.cells, h.piece, rules));
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    b.setAttribute("aria-label", h ? `A piece of ${PIECES[h.piece].cells.length}${S.due ? ", after the knock" : ": drag it onto the table"}` : "Laid");
  }
}
/** The table as it stands, with the chosen domino shown if there is one. */
function redraw() { if (sel >= 0 && S.cells[sel] >= 0 && !S.over) showChosen(); else drawBoard(); }
function render(extra) { if (extra) drawBoard(extra); else redraw(); drawStrip(); drawTray(); }

/** What the best push on the dominoes joined to one comes to, in words: how many, how many of them fall, the points. */
function bestWords(best) {
  const extras = `${best.rings ? ", the bell" : ""}${best.gilded ? ", gilded" : ""}`;
  if (best.size === 1) return `On its own: +${fmt(best.gain)}${extras}`;
  const how = best.fell === best.size ? `all fall in ${best.steps}` : `${best.fell} fall at most`;
  return `${best.size} together: ${how}, +${fmt(best.gain)}${extras}`;
}
/** How a finished game of a level reads: what it came to, and whether it beat the level. */
function levelVerdict() {
  const L = levelRules(S.level);
  return S.stars >= 1 ? `No room: ${fmt(S.score)}. Beaten, ${starsWords(S.stars)}` : `No room: ${fmt(S.score)}, ${fmt(L.goal - S.score)} short of ${fmt(L.goal)}`;
}

// ---------- choosing a domino, and turning it ----------
function setSel(i) { sel = i; write(SEL, i); }
/** The way along a domino's axis that points down the screen, towards you: where its handle sits, clear of it. */
function facingYou(i) {
  const a = S.ax[i], [cx, cz] = view.centre(i), [, y0] = view.project(cx, 0, cz);
  const down = w => { const [ux, uz] = heading(w), [x, y] = view.project(cx + ux, 0, cz + uz); return y - y0 + x * 1e-4; };
  return down(a) >= down(a + AXES) ? a : a + AXES;
}
/** The chosen domino (turned to `ax` while a finger turns it): its handle, and what the best push on what it's joined to would fell, ringed and written. */
function showChosen(ax = S.ax, ease = false) {
  const rules = rulesOf(S), best = longest(S.cells, ax, sel, S.bell, rules), fell = best.at >= 0 ? knockOn(S.cells, ax, best.at, best.way, S.bell, rules).fell.map(f => f[0]) : [];
  const down = new Set(fell), stay = group(S.cells, sel, rules).filter(j => !down.has(j));
  drawBoard({ ax, ease, handle: [sel, knob], ring: fell, stay, tag: [bestWords(best), sel] });
}
function choose(i) {
  setSel(i);
  knob = facingYou(i);
  showChosen();
}
function letGo() {
  if (sel < 0) return;
  setSel(-1);
  drawBoard();
}
/** A tap on the chosen domino: a step of thirty degrees, clockwise. */
function step() {
  knob = (knob + WAYS - 1) % WAYS;
  S = turnDomino(S, sel, knob % AXES);
  save();
  showChosen(S.ax, true);
}
/** Whether a finger is on the chosen domino's knob. */
function onKnob(e) {
  if (sel < 0) return false;
  const [x, y] = onPage(...knobPoint(sel, knob));
  return Math.hypot(e.clientX - x, e.clientY - y) < 22 * scale();
}
/**
 * A finger turning the chosen domino, to the nearest thirty degrees: by its handle, to point where the finger is; by its
 * body, to face the way the finger is dragged, once it's gone a third of a hexagon (a press high on the slab meets the
 * table behind its foot, so where the finger is says nothing until it moves).
 */
function turnTo(h, e) {
  const p = view.pointAt(e.clientX, e.clientY), [cx, cz] = h.onKnob ? view.centre(sel) : h.p0 || [];
  if (!p || cx == null) return;
  h.far = Math.max(h.far || 0, Math.hypot(p[0] - cx, p[1] - cz));
  if (Math.hypot(p[0] - cx, p[1] - cz) < (h.onKnob ? 0.3 : 0.34)) return;
  const way = ((Math.round(-Math.atan2(p[1] - cz, p[0] - cx) / (Math.PI / 6)) % WAYS) + WAYS) % WAYS;
  if (way === knob) return;
  knob = way;
  h.axis = way % AXES;
  const ax = S.ax.slice();
  ax[sel] = h.axis;
  showChosen(ax, true);
}

// ---------- pushing ----------
// A slide counts once it's gone this far along the axis from where the finger pressed (in hexagons, and no less than a
// fingertip's few pixels), and not if the finger is further than REACH from the domino: let go there and nothing happens.
const DEAD = 0.42, REACH = 2.6, NUDGE = 14;
/** The way along the pressed domino's axis the finger has slid it, or -1. */
function slidWay(h, e) {
  const p = view.pointAt(e.clientX, e.clientY);
  if (!p || !h.p0) return -1;
  const a = S.ax[h.at], [ux, uz] = heading(a), along = (p[0] - h.p0[0]) * ux + (p[1] - h.p0[1]) * uz, [cx, cz] = view.centre(h.at);
  if (Math.abs(along) < Math.max(DEAD, (NUDGE * scale()) / unit()) || Math.hypot(p[0] - cx, p[1] - cz) > REACH) return -1;
  return along > 0 ? a : a + AXES;
}
/**
 * A domino pressed: the two ways it could go, each with what it would score, until it's slid one way; then what a push
 * that way would fell ringed, what of its colour would stay standing marked, the steps and the points.
 */
function showPress(h) {
  const { at, way } = h, rules = rulesOf(S), tries = new Map(pushes(S.ax, at).map(w => [w, knockOn(S.cells, S.ax, at, w, S.bell, rules)]));
  if (way < 0) {
    setMarks({ compass: [at, -1, new Map([...tries].map(([w, k]) => [w, k.gain]))], tag: [S.due ? "Slide it along its axis to push" : `Slide to see a push: ${knockWords().toLowerCase()}`, at] });
    return;
  }
  const k = tries.get(way), fell = new Set(k.fell.map(f => f[0])), stay = group(S.cells, at, rules).filter(j => !fell.has(j));
  const words = `${k.fell.length} in ${plural(k.steps, "step")}: +${fmt(k.gain)}${k.rings ? ", the bell" : ""}${k.gilded ? ", gilded" : ""}${stay.length ? `; ${stay.length} stand` : ""}`;
  setMarks({ ring: [...fell], stay, compass: [at, way], tag: [S.due ? words : `${words} (${knockWords().toLowerCase()})`, at] });
}

// ---------- a piece laid, a knock ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
function settle() {
  if (!inLevels() && S.score > read(BEST, 0)) write(BEST, S.score);          // Classic's best is Classic's: a level's scores are another measure
  if (S.laid >= 3) write(SEEN, true);
  if (inLevels() && S.stars > camp.stars[S.level]) { camp.stars[S.level] = S.stars; write(CAMP, camp); }
  save();
}
/** The one line a level's first win gets: that it is beaten, and what that opened. */
function beatenWords() {
  const next = LEVELS[S.level + 1];
  return `${LEVELS[S.level].name} beaten. ${next ? `${next.name} is open.` : "That is all twelve."}`;
}
async function commitLay(slot, q, r) {
  if (playing || S.over || S.due) return;
  playing = true;
  setSel(-1);
  const done = lay(S, slot, q, r);
  S = done.state;
  settle();
  render({ fresh: done.laid });
  if (done.dealt && !S.over) for (const b of document.querySelectorAll(".tp-piece svg")) animate(b, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 220, easing: "ease-out" });
  if (done.due) {
    animate($("knock"), [{ transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 360, easing: "ease-out" });
    if (S.sets <= 3 || !read(SEEN, false)) toast("Knock: press a domino and slide it along its axis, the way it should fall");
  }
  await wait(260);
  playing = false;
}
async function commitKnock(i, way) {
  if (playing || S.over || !S.due) return;
  playing = true;
  setSel(-1);
  const before = S, first = inLevels() && camp.stars[S.level] < 1, done = knock(S, i, way);
  S = done.state;
  settle();
  // the table as it stood, then the dominoes fall one after another, each along its own axis; the bell leaves where it
  // hung when they've passed it
  drawBoard({ cells: before.cells, ax: before.ax, bell: before.bell });
  drawStrip();
  const falling = view.fall({ fell: done.fell, bell: { rang: done.rang, to: done.rang ? S.bell : -1 } });
  const times = (done.rang ? 2 : 1) * (done.gilded ? 2 : 1), level = S.level;
  setTimeout(() => popup(done.fell.map(f => f[0]), done.gain, times), 100 + done.steps * 90);
  await falling;
  render();
  playing = false;
  if (first && S.stars >= 1 && S.level === level) toast(beatenWords());
}
/** The points of a knock rising from where it fell: with the bell's or the gilding's doubling (`times`), as the points before it and the times. */
function popup(cells, gain, times) {
  const mids = cells.map(i => view.centre(i)), x = mids.reduce((a, m) => a + m[0], 0) / cells.length, z = mids.reduce((a, m) => a + m[1], 0) / cells.length;
  const [px, py] = view.project(x, SH, z), t = text(`tp-pop${cells.length >= 10 || times > 1 ? " big" : ""}`, times > 1 ? `+${fmt(gain / times)} ×${times}` : `+${fmt(gain)}`, px, py, cells.length >= 10 || times > 1 ? 24 : 19);
  fxG.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-34 * scale()}px)`, opacity: 0 }], { duration: 1200, easing: "ease-out" }).then(() => t.remove());
}

// ---------- dragging a piece ----------
/** Where a piece held with its footprint's middle at a point on the screen would go, or null if it doesn't fit there. */
function spotAt(piece, px, py) {
  const p = view.pointAt(px, py), b = bounds(piece);
  if (!p) return null;
  const [q, r] = hexAt(p[0] - b.cx, p[1] - b.cz);
  return cover(S.cells, piece, q, r, rulesOf(S)) ? { q, r } : null;
}
function floatEl(h) {
  const d = document.createElement("div"), u = unit(), art = pieceSvg(h, true, view.spin, rulesOf(S).tall);
  d.className = "tp-float";
  d.style.width = `${u * art.width}px`;
  d.style.height = `${u * art.height}px`;
  d.append(art.svg);
  document.body.append(d);
  // where the footprint's middle lies in the float, so it's that which sits under the finger
  d.foot = [u * art.foot[0], u * art.foot[1]];
  d.reach = u * art.height;
  return d;
}
function startDrag(e, slot) {
  const h = S.hand[slot];
  if (playing || S.over || !h || e.button > 0) return;
  e.preventDefault();
  sound.unlock();
  if (S.due) { toast("Knock a domino first: press one and slide it along its axis"); return; }
  if (!fitsAnywhere(S.cells, h.piece, rulesOf(S))) { toast("That piece fits nowhere now"); return; }
  drag?.float.remove();
  if (sel >= 0) letGo();
  // held above the finger, its foot a hexagon clear of it, so where it's going is in sight (a mouse needs no lift)
  const float = floatEl(h), lift = e.pointerType === "mouse" ? 0 : Math.max(48, float.reach / 2 + unit() * 1.1);
  drag = { slot, ...h, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, lift, at: null, float };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  moveDrag(e);
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.moved = true; drawTray(); }
  const px = e.clientX, py = e.clientY - (drag.moved ? drag.lift : 0), spot = drag.moved ? spotAt(drag.piece, px, py) : null;
  const f = drag.float;
  f.style.left = `${px - f.foot[0]}px`;
  f.style.top = `${py - f.foot[1]}px`;
  f.style.visibility = drag.moved && !spot ? "visible" : "hidden";   // where it fits it's shown in its place
  if (spot?.q === drag.at?.q && spot?.r === drag.at?.r && drag.drawn) return;
  drag.at = spot;
  drag.drawn = true;
  if (!spot) { drawBoard(); return; }
  // the dominoes it would join, ringed, and what their best push would fell, facing as they stand and as the piece comes
  const rules = rulesOf(S), laid = cover(S.cells, drag.piece, spot.q, spot.r, rules), cells = S.cells.slice(), ax = S.ax.slice(), faces = axesOf(laid);
  laid.forEach((i, k) => { cells[i] = drag.colour; ax[i] = faces[k]; });
  const joined = group(cells, laid[0], rules), grew = joined.length > laid.length;
  drawBoard({ ghost: { laid, colour: drag.colour }, ring: grew ? joined : [], tag: grew ? [bestWords(longest(cells, ax, laid[0], S.bell, rules)), laid[0]] : null });
}
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { slot, at: spot } = drag;
  drag.float.remove();
  drag = null;
  if (spot) commitLay(slot, spot.q, spot.r);
  else render();
}

// ---------- fingers on the table ----------
// One finger: on the chosen domino or its knob it turns it; on another domino a tap chooses it and a slide along its axis
// pushes it (when the knock is due; else it only shows what the push would do); on the bare table a tap lets the chosen
// one go, a double tap zooms in there (or back out), and a drag moves the table when it's zoomed, else tilts it. A second
// finger makes it a pinch, and whatever the first was doing comes to nothing: a pinch never pushes or turns.
const SLOP = 10, HOLD = 220;                      // a tap may wander this many pixels
let lastTap = null;
stage.addEventListener("pointerdown", e => {
  sound.unlock();
  if (drag || e.button > 0) return;
  e.preventDefault();
  fingers.set(e.pointerId, [e.clientX, e.clientY]);
  try { stage.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  if (fingers.size === 2) { startPinch(); return; }
  if (fingers.size > 2 || pinch) return;
  const live = !playing && !S.over, i = live ? view.cellAt(e.clientX, e.clientY) : -1, base = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false };
  if (live && sel >= 0 && (onKnob(e) || i === sel)) hand = { ...base, kind: "turn", onKnob: onKnob(e), axis: S.ax[sel], knob0: knob, p0: view.pointAt(e.clientX, e.clientY) };
  else if (i >= 0 && S.cells[i] >= 0) {
    const h = hand = { ...base, kind: "press", at: i, way: -1, p0: view.pointAt(e.clientX, e.clientY) };
    // held without sliding, the two ways it could go come up, to read their scores
    h.hold = setTimeout(() => { if (hand === h && !h.moved) { h.shown = true; showPress(h); } }, HOLD);
  } else hand = { ...base, kind: "table" };
});
stage.addEventListener("wheel", e => {
  e.preventDefault();
  view.level();
  view.zoomAt(view.zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), e.clientX, e.clientY);
}, { passive: false });
stage.addEventListener("gesturestart", e => e.preventDefault());       // Safari's own pinch, which would zoom the page
function moveFinger(e) {
  if (!fingers.has(e.pointerId)) return;
  fingers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch) { movePinch(); return; }
  const h = hand;
  if (!h || h.id !== e.pointerId || h.kind === "spent") return;
  let dx = e.clientX - h.x, dy = e.clientY - h.y;
  h.x = e.clientX; h.y = e.clientY;
  if (!h.moved) {
    if (Math.hypot(e.clientX - h.x0, e.clientY - h.y0) < SLOP * scale()) return;
    h.moved = true;
    dx = e.clientX - h.x0; dy = e.clientY - h.y0;
    clearTimeout(h.hold);
  }
  if (h.kind === "turn") turnTo(h, e);
  else if (h.kind === "press") {
    const way = slidWay(h, e);
    if (way !== h.way || !h.shown) { h.way = way; h.shown = true; showPress(h); }
  } else if (h.kind === "table") {
    if (view.zoom > 1.001) view.panBy(dx, dy);
    else view.tilt((h.y - h.y0) * 0.0016, -(h.x - h.x0) * 0.0016);
  }
}
function lift(e, cancelled = false) {
  if (!fingers.delete(e.pointerId)) return;
  if (pinch) { if (fingers.size < 2) endPinch(); return; }
  const h = hand;
  if (!h || h.id !== e.pointerId) return;
  hand = null;
  clearTimeout(h.hold);
  if (h.kind === "table") { if (h.moved || cancelled) view.level(); else tapTable(e); return; }
  if (h.kind === "spent" || cancelled || playing || S.over) { if (h.kind === "turn") knob = h.knob0; redraw(); return; }
  if (h.kind === "turn") {
    // slid along its own axis with the knock due, it was most likely meant as a push: say how
    const meant = h.moved && !h.onKnob && h.far >= DEAD && h.axis === S.ax[sel] && S.due;
    if (h.moved && h.axis !== S.ax[sel]) { S = turnDomino(S, sel, h.axis); save(); }
    if (!h.moved && !h.onKnob) step();
    else showChosen();
    if (meant) toast("A chosen domino turns: tap the table to let it go, then push it");
  } else if (h.kind === "press") {
    if (!h.moved) choose(h.at);
    else if (h.way >= 0 && S.due) commitKnock(h.at, h.way);
    else {
      redraw();
      if (h.way >= 0) toast(`The knock comes ${untilKnock(S) === 1 ? "after this hand" : `in ${untilKnock(S)} hands`}`);
    }
  }
}
function tapTable(e) {
  // timed by when the touches happened, not when they're handled, which a busy frame can put off
  const now = e.timeStamp, twice = lastTap && now - lastTap.t < 330 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30 * scale();
  lastTap = twice ? null : { t: now, x: e.clientX, y: e.clientY };
  letGo();
  view.level();
  if (twice) view.zoomTo(view.zoom > 1.001 ? 1 : ZOOM, e.clientX, e.clientY);
}
function startPinch() {
  const h = hand;
  hand = null;
  if (h) { clearTimeout(h.hold); if (h.kind === "turn") knob = h.knob0; if (h.kind !== "table") redraw(); }
  view.level();
  const [a, b] = [...fingers.values()];
  pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
}
function movePinch() {
  const [a, b] = [...fingers.values()];
  if (!a || !b) return;
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  view.zoomAt(view.zoom * (d / pinch.d), pinch.mid[0], pinch.mid[1]);
  view.panBy(mid[0] - pinch.mid[0], mid[1] - pinch.mid[1]);
  pinch.d = d;
  pinch.mid = mid;
}
function endPinch() {
  pinch = null;
  // the finger still down does nothing more until it lifts
  const [id] = fingers.keys();
  if (id != null) hand = { id, kind: "spent" };
}

// ---------- messages, the menu ----------
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
/** The twelve levels, three to a row: each its table in miniature, its number and name, and the stars won. Those not yet open are dimmed; any open one can be played at any time, as it was left. */
function levelList() {
  const list = document.createElement("div");
  list.className = "tp-levels";
  LEVELS.forEach((L, n) => {
    const b = document.createElement("button"), won = camp.stars[n], map = document.createElement("div"), row = document.createElement("div"), num = document.createElement("b"), stars = document.createElement("span"), name = document.createElement("div");
    b.type = "button";
    b.disabled = !isOpen(n);
    b.className = won ? "done" : "";
    if (n === camp.at && inLevels()) b.setAttribute("aria-current", "true");
    b.setAttribute("aria-label", `Level ${n + 1}, ${L.name}${won ? `, ${plural(won, "star")}` : ""}${b.disabled ? ", not open yet" : ""}`);
    map.className = "tp-lmap";
    map.append(mapSvg(levelRules(n)));
    row.className = "tp-lrow";
    num.textContent = n + 1;
    stars.textContent = isOpen(n) ? starsWords(won) : "";
    row.append(num, stars);
    name.className = "tp-lnamed";
    name.textContent = L.name;
    b.append(map, row, name);
    b.addEventListener("click", () => { $("menuDlg").close(); playLevel(n); });
    list.append(b);
  });
  return list;
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(inLevels() ? action(`Replay ${LEVELS[camp.at].name}`, newRun, "primary") : action("New game", newRun, "primary"));
  const content = part(body, "content");
  content.append(choice("Mode", [["classic", "Classic"], ["levels", "Levels"]], mode, m => { setMode(m); openMenu(); }));
  if (inLevels()) content.append(levelList());
  part(body, "settings").append(toggle("Sound", sound.on, on => { sound.on = on; write(SOUND, on); if (on) sound.play("clack"); }));
  const best = read(BEST, 0), beaten = camp.stars.filter(Boolean).length;
  part(body, "about").append(line(inLevels()
    ? `This game: ${fmt(S.score)}, ${plural(S.felled, "domino", "dominoes")} felled; ${beaten} of ${LEVELS.length} levels beaten, ${plural(camp.stars.reduce((a, b) => a + b, 0), "star")}`
    : `This game: ${fmt(S.score)}, ${plural(S.felled, "domino", "dominoes")} felled, the bell rung ${plural(S.rung, "time")}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "topple");
document.querySelector(".tp-mark").innerHTML = APPS.find(a => a.id === "topple").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".tp-piece")) b.addEventListener("pointerdown", e => startDrag(e, Number(b.dataset.slot)));
addEventListener("pointermove", e => { moveDrag(e); moveFinger(e); });
addEventListener("pointerup", e => { endDrag(e); lift(e); });
addEventListener("pointercancel", e => {
  if (drag?.id === e.pointerId) { drag.float.remove(); drag = null; render(); }
  lift(e, true);
});
$("againBtn").addEventListener("click", newRun);
$("levelsBtn").addEventListener("click", openMenu);
onPause(() => view.hold(), () => view.release());

// for tests and debugging
window.__topple = {
  get state() { return S; }, set state(s) { S = s; setSel(-1); render(); }, get sel() { return sel; }, get knob() { return knob; },
  commitLay, commitKnock, spotAt, newRun, choose, view, playLevel, setMode, get mode() { return mode; }, get camp() { return camp; },
  cellAt: (px, py) => view.cellAt(px, py),
  screenOf: i => { const [x, z] = view.centre(i); return onPage(x, view.baseOf(i) + SH * 0.45, z); },
  groundOf: i => { const [x, z] = view.centre(i); return onPage(x, view.baseOf(i), z); },
  /** Where a point of the table lies from hexagon i's middle, `along` hexagons the way w, on the page. */
  toward: (i, w, along) => { const [x, z] = view.centre(i), [ux, uz] = heading(w); return onPage(x + ux * along, 0, z + uz * along); },
  knobAt: () => (sel >= 0 ? onPage(...knobPoint(sel, knob)) : null),
};

resume();
