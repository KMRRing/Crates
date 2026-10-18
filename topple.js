// Topple: a table of sixty-one hexagons, drawn in 3D (topple-3d.js; flat, in topple-flat.js, where there's no WebGL).
// Drag one of three pieces of standing dominoes onto it; while it's held where it fits, the dominoes it would join are
// ringed with what their best push would fell. When a hand's last piece is down the knock may be due, and the table has
// dealt how hard it is (weak, medium or strong, shown beside the knock a hand ahead): press a domino and slide the way it
// should fall, and what would fall is ringed (what would stay standing marked), with its points; let go to push. A drag
// on the bare table tilts it a little, as Rosette's dial does. The rules are topple-engine.js's; this file plays each
// move out and keeps the game.
import { SIZE, DIRS, DIR_NAMES, PIECES, newGame, cover, lay, knock, group, knockOn, fitsAnywhere, longest, untilKnock, axesOf, forceName, next } from "./topple-engine.js";
import { heading, hexAt, SH, bounds, pieceSvg } from "./topple-slab.js";
import { createTable } from "./topple-3d.js";
import { sound } from "./topple-sound.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, onPause } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "topple:run", BEST = "topple:best", SEEN = "topple:seen", SOUND = "topple:sound";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const cap = s => s[0].toUpperCase() + s.slice(1);

let S = null;            // the game (topple-engine.js's), as saved
let playing = false;     // a move being played out
let drag = null;         // a piece in hand: { slot, piece, colour, id, x0, y0, moved, lift, at (where it would go), float, art }
let press = null;        // a pointer pressing the table, to knock
let turn = null;         // a pointer on the bare table, tilting it
let aim = null;          // the domino a knock would start from, and the way: { at, dir (-1: none chosen yet) }
let marks = {};          // what's drawn over the table: ring, stay, compass, tag, ghost

sound.on = read(SOUND, true);
const stage = $("stage");
let view;
try { view = createTable(stage); }
catch (err) {
  console.warn("Topple: no WebGL here, so the table is drawn flat.", err);
  view = (await import("./topple-flat.js")).createFlat(stage);
}

const valid = g => g && g.v === 4 && Array.isArray(g.cells) && g.cells.length === SIZE && Array.isArray(g.ax) && g.ax.length === SIZE && [1, 2, 3].includes(g.force)
  && Array.isArray(g.hand) && g.hand.length === 3 && g.hand.every(h => !h || PIECES[h.piece]);
function save() { write(RUN, S); }
function newRun() {
  drag?.float.remove();
  drag = null;
  aim = null;
  S = newGame(Math.floor(Math.random() * 2 ** 31));
  save();
  render();
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
/** The six ways a domino could be pushed, round it: the chosen one filled; with `gains`, what each would score (but not towards the table's edge). */
function compassEl({ at, dir }, gains) {
  const [cx, cz] = view.centre(at), out = [];
  for (let d = 0; d < 6; d++) {
    const [ux, uz] = heading(d), vx = -uz, vz = ux, tip = 0.86, base = 0.5, wing = 0.17;
    const p = (a, b) => view.project(cx + ux * a + vx * b, 0.01, cz + uz * a + vz * b);
    out.push(el("path", { class: `tp-arrow${d === dir ? " on" : ""}`, d: `M${pt(p(tip, 0))}L${pt(p(base, wing))}L${pt(p(base, -wing))}Z` }));
    if (gains && next(at, d) >= 0) {
      const [x, y] = view.project(cx + ux * 1.32, 0.01, cz + uz * 1.32);
      out.push(text("tp-gain", short(gains[d]), x, y + 4 * scale(), 12.5));
    }
  }
  return el("g", {}, ...out);
}
/** A line of words above a hexagon, kept on the table. */
function tagEl(words, i) {
  const [cx, cz] = view.centre(i), [x, y] = view.project(cx, SH + 0.15, cz), half = Math.max(70, words.length * 3.4 * scale()), w = over.clientWidth;
  return text("tp-tag", words, Math.min(w - half, Math.max(half, x)), Math.max(16 * scale(), y - 8 * scale()), 13);
}
const HINT = ["Drag a piece onto the table.", "After some hands a knock is due:", "press a domino, slide the way it falls.", "Weak takes one ahead, strong three.", "Past the bell, it scores double."];
function drawOver() {
  const w = over.clientWidth || stage.clientWidth, h = over.clientHeight || stage.clientHeight;
  over.setAttribute("viewBox", `0 0 ${w} ${h}`);
  if (!S) return;
  const { ring = [], stay = [], compass, tag, ghost } = marks, ghostAx = new Map((ghost?.laid || []).map((i, k) => [i, axesOf(ghost.laid)[k]]));
  const axOf = i => ghostAx.get(i) ?? S.ax[i] ?? 0;
  const kids = [
    ...stay.map(i => el("path", { class: "tp-stay", d: hullD(view.outlineOf(i, axOf(i), 1.1)) })),
    ...ring.map(i => el("path", { class: "tp-ring", d: hullD(view.outlineOf(i, axOf(i), 1.12)) })),
  ];
  if (compass) kids.push(compassEl(...compass));
  if (tag) kids.push(tagEl(...tag));
  if (!read(SEEN, false) && S.laid < 3 && !ghost && !ring.length && !compass && !S.over) {
    const lines = HINT.map((t, k) => text("tp-hint", t, w / 2, h / 2 + (k - 2) * 15 * scale() + 4 * scale(), 11));
    kids.push(el("rect", { class: "tp-plaque", x: (w / 2 - 112 * scale()).toFixed(1), y: (h / 2 - 48 * scale()).toFixed(1), width: (224 * scale()).toFixed(1), height: (92 * scale()).toFixed(1), rx: 5 }), ...lines);
  }
  marksG.replaceChildren(...kids);
}
let turned = view.spin;
view.onPaint(() => {
  if (S && view.spin !== turned) { turned = view.spin; drawTray(); }        // the table turned a quarter, as the screen did: so do the pieces under it
  if (S && (marks.ring?.length || marks.stay?.length || marks.compass || marks.tag || (!read(SEEN, false) && S.laid < 3))) drawOver();
});

/**
 * The table: as it stands, or with extra: { cells, ax (a table to draw instead), bell (where it hangs, if not where it
 * hangs now), fresh (dominoes just stood up), ghost ({ laid, colour }: a piece held over it), ring (hexagons to ring),
 * stay (hexagons that would stay standing), tag ([text, hexagon]), compass ({ at, dir }, gains) }.
 */
function drawBoard(extra = {}) {
  const ghost = extra.ghost;
  view.set({ cells: extra.cells || S.cells, ax: extra.ax || S.ax, bell: extra.bell ?? S.bell, fresh: extra.fresh || [], ghost: ghost && { laid: ghost.laid, colour: ghost.colour, ax: axesOf(ghost.laid) } });
  setMarks(extra);
}
function setMarks(extra) {
  marks = { ring: extra.ring || [], stay: extra.stay || [], compass: extra.compass || null, tag: extra.tag || null, ghost: extra.ghost || null };
  drawOver();
}

/** When the knock comes: now, after this hand, or in so many; and how hard it is. */
function knockWords() {
  const n = untilKnock(S), f = cap(forceName(S.force));
  return n === 0 ? `${f} push now` : n === 1 ? `${f} push after this hand` : `${f} push in ${n} hands`;
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  const k = $("knock");
  k.className = `tp-knock${S.due && !S.over ? " now" : ""}`;
  k.replaceChildren(...(S.over ? [] : [Object.assign(document.createElement("span"), { className: `tp-bars b${S.force}`, innerHTML: "<i></i><i></i><i></i>" }), document.createTextNode(` ${knockWords()}`)]));
  k.title = S.over ? "" : ["Weak: takes the domino of its colour straight ahead", "Medium: straight ahead if it's the same colour, else the two at 60°", "Strong: takes all three of its colour ahead"][S.force - 1];
}
function drawTray() {
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `No room: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  $("tray").classList.toggle("waiting", S.due);
  for (const b of document.querySelectorAll(".tp-piece")) {
    const slot = Number(b.dataset.slot), h = S.hand[slot];
    b.replaceChildren(...(h ? [pieceSvg(h, false, view.spin).svg] : []));
    b.disabled = !h;
    b.classList.toggle("cant", !!h && !S.due && !fitsAnywhere(S.cells, h.piece));
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    b.setAttribute("aria-label", h ? `A piece of ${PIECES[h.piece].cells.length}${S.due ? ", after the knock" : ": drag it onto the table"}` : "Laid");
  }
}
function render(extra) { drawBoard(extra); drawStrip(); drawTray(); }
/**
 * The table with the domino at i pressed: the six ways it could go round it (with what each scores until one is
 * chosen), and for the chosen way what would fall ringed, what of its colour would stay standing marked, the steps and
 * the points.
 */
function showAim() {
  const { at, dir } = aim, tries = DIRS.map((_, d) => knockOn(S.cells, at, d, S.bell, S.force));
  if (dir < 0) { setMarks({ compass: [aim, tries.map(k => k.gain)], tag: [`${cap(forceName(S.force))} push: slide the way it should fall`, at] }); return; }
  const k = tries[dir], fell = new Set(k.fell.map(f => f[0])), stay = group(S.cells, at).filter(j => !fell.has(j));
  const words = `${k.fell.length} in ${plural(k.steps, "step")}: +${fmt(k.gain)}${k.rings ? ", the bell" : ""}${stay.length ? `; ${stay.length} stand` : ""}`;
  setMarks({ ring: [...fell], stay, compass: [aim], tag: [S.due ? words : `${words} (${knockWords().toLowerCase()})`, at] });
}

// ---------- a piece laid, a knock ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
function settle() {
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.laid >= 3) write(SEEN, true);
  save();
}
async function commitLay(slot, q, r) {
  if (playing || S.over || S.due) return;
  playing = true;
  const done = lay(S, slot, q, r);
  S = done.state;
  settle();
  render({ fresh: done.laid });
  if (done.dealt && !S.over) for (const b of document.querySelectorAll(".tp-piece svg")) animate(b, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 220, easing: "ease-out" });
  if (done.due) {
    animate($("knock"), [{ transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 360, easing: "ease-out" });
    if (S.sets <= 3 || !read(SEEN, false)) toast(`${cap(forceName(S.force))} push: press a domino and slide the way it should fall`);
  }
  await wait(260);
  playing = false;
}
async function commitKnock(i, dir) {
  if (playing || S.over || !S.due) return;
  playing = true;
  aim = null;
  const before = S, done = knock(S, i, dir);
  S = done.state;
  settle();
  // the table as it stood, then the dominoes fall one after another, each the way it was knocked; the bell leaves where it hung
  // when they've passed it
  drawBoard({ cells: before.cells, ax: before.ax, bell: before.bell });
  drawStrip();
  const falling = view.fall({ fell: done.fell, dir, force: before.force, bell: { rang: done.rang, to: done.rang ? S.bell : -1 } });
  setTimeout(() => popup(done.fell.map(f => f[0]), done.gain, done.rang), 100 + done.steps * 90);
  await falling;
  render();
  playing = false;
}
function popup(cells, gain, rang) {
  const mids = cells.map(i => view.centre(i)), x = mids.reduce((a, m) => a + m[0], 0) / cells.length, z = mids.reduce((a, m) => a + m[1], 0) / cells.length;
  const [px, py] = view.project(x, SH, z), t = text(`tp-pop${cells.length >= 10 || rang ? " big" : ""}`, rang ? `+${fmt(gain / 2)} ×2` : `+${fmt(gain)}`, px, py, cells.length >= 10 || rang ? 24 : 19);
  fxG.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-34 * scale()}px)`, opacity: 0 }], { duration: 1200, easing: "ease-out" }).then(() => t.remove());
}

// ---------- dragging a piece ----------
/** Where a piece held with its footprint's middle at a point on the screen would go, or null if it doesn't fit there. */
function spotAt(piece, px, py) {
  const p = view.pointAt(px, py), b = bounds(piece);
  if (!p) return null;
  const [q, r] = hexAt(p[0] - b.cx, p[1] - b.cz);
  return cover(S.cells, piece, q, r) ? { q, r } : null;
}
function floatEl(h) {
  const d = document.createElement("div"), u = unit(), art = pieceSvg(h, true, view.spin);
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
  if (S.due) { toast("Knock a domino first: press one and slide the way it should fall"); return; }
  if (!fitsAnywhere(S.cells, h.piece)) { toast("That piece fits nowhere now"); return; }
  drag?.float.remove();
  if (aim) { aim = null; drawBoard(); }
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
  // the dominoes it would join, ringed, and what their best push would fell: all of them, or some standing
  const laid = cover(S.cells, drag.piece, spot.q, spot.r), cells = S.cells.slice();
  for (const i of laid) cells[i] = drag.colour;
  const joined = group(cells, laid[0]), grew = joined.length > laid.length, best = grew ? longest(cells, laid[0], S.bell, S.force) : null;
  const words = best && (best.fell === best.size ? `${best.size} together: they all fall in ${best.steps}` : `${best.size} together: ${best.fell} fall at most`) + (best.rings ? ", past the bell" : "");
  drawBoard({ ghost: { laid, colour: drag.colour }, ring: grew ? joined : [], tag: grew ? [words, laid[0]] : null });
}
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { slot, at: spot } = drag;
  drag.float.remove();
  drag = null;
  if (spot) commitLay(slot, spot.q, spot.r);
  else render();
}

// ---------- pressing the table, to knock; or dragging it, to tilt it ----------
// a press nearer than this to the domino has chosen no way yet; farther than REACH, none either
const DEAD = 0.42, REACH = 2.6;
/** The way a point of the table lies from the middle of hexagon i: 0–5, or -1 within the dead zone or out of reach. */
function wayFrom(i, p) {
  if (!p) return -1;
  const [x, z] = view.centre(i), dx = p[0] - x, dz = p[1] - z, far = Math.hypot(dx, dz);
  if (far < DEAD || far > REACH) return -1;
  return (((Math.round(-Math.atan2(dz, dx) / (Math.PI / 3)) % 6) + 6) % 6);
}
function aimAt(e) {
  const dir = wayFrom(aim.at, view.pointAt(e.clientX, e.clientY));
  if (dir === aim.dir) return;
  aim.dir = dir;
  showAim();
}
stage.addEventListener("pointerdown", e => {
  sound.unlock();
  if (drag || e.button > 0) return;
  const i = !playing && !S.over ? view.cellAt(e.clientX, e.clientY) : -1;
  if (i >= 0 && S.cells[i] >= 0) {
    e.preventDefault();
    press = e.pointerId;
    aim = { at: i, dir: -1 };
    showAim();
    return;
  }
  // elsewhere on the table a drag tilts it (a tap leaves any compass)
  turn = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  try { stage.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
});
function moveTurn(e) {
  if (!turn || e.pointerId !== turn.id) return;
  const dx = e.clientX - turn.x, dy = e.clientY - turn.y;
  if (!turn.moved && Math.hypot(dx, dy) < 6) return;
  turn.moved = true;
  view.tilt(dy * 0.0016, -dx * 0.0016);
}
function endTurn(e) {
  if (!turn || e.pointerId !== turn.id) return;
  const tap = !turn.moved;
  turn = null;
  view.level();
  if (tap && aim && !playing) { aim = null; drawBoard(); }
}
function endPress(e) {
  if (press !== e.pointerId) return;
  press = null;
  if (aim.dir < 0) { showAim(); return; }          // let go on the domino: its compass stays, to read the scores from
  const { at, dir } = aim;
  if (S.due) commitKnock(at, dir);
  else {
    aim = null;
    drawBoard();
    toast(`The knock comes ${untilKnock(S) === 1 ? "after this hand" : `in ${untilKnock(S)} hands`}`);
  }
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
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("New game", newRun, "primary"));
  part(body, "settings").append(toggle("Sound", sound.on, on => { sound.on = on; write(SOUND, on); if (on) sound.play("clack"); }));
  const best = read(BEST, 0);
  part(body, "about").append(line(`This game: ${fmt(S.score)}, ${plural(S.felled, "domino", "dominoes")} felled, the bell rung ${plural(S.rung, "time")}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "topple");
document.querySelector(".tp-mark").innerHTML = APPS.find(a => a.id === "topple").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".tp-piece")) b.addEventListener("pointerdown", e => startDrag(e, Number(b.dataset.slot)));
addEventListener("pointermove", e => { moveDrag(e); moveTurn(e); if (press === e.pointerId) aimAt(e); });
addEventListener("pointerup", e => { endDrag(e); endPress(e); endTurn(e); });
addEventListener("pointercancel", e => {
  if (drag?.id === e.pointerId) { drag.float.remove(); drag = null; render(); }
  if (press === e.pointerId) { press = null; aim = null; drawBoard(); }
  if (turn?.id === e.pointerId) { turn = null; view.level(); }
});
$("againBtn").addEventListener("click", newRun);
onPause(() => view.hold(), () => view.release());

// for tests and debugging
window.__topple = {
  get state() { return S; }, set state(s) { S = s; aim = null; render(); }, commitLay, commitKnock, spotAt, newRun, DIR_NAMES, view,
  cellAt: (px, py) => view.cellAt(px, py),
  screenOf: i => onPage(i, SH * 0.45),
  groundOf: i => onPage(i, 0),
};
/** Where hexagon i is at a height on the page, in the client coordinates a pointer event carries (view.project is the canvas's own). */
function onPage(i, y) {
  const [x, z] = view.centre(i), [px, py] = view.project(x, y, z), r = view.canvas.getBoundingClientRect();
  return [px + r.left, py + r.top];
}

S = read(RUN, null);
if (!valid(S)) newRun();
else { save(); render(); }
