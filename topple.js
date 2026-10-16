// Topple: a table eight squares by eight. Drag one of three pieces of standing dominoes onto it; while it's held where
// it fits, the chain it would join is ringed. Press a domino and the chain a knock there would fell is ringed, with its
// points; let go on it to knock. The rules are topple-engine.js's; this file draws the table, plays each move out and
// keeps the game.
import { N, PIECES, MAX_KNOCKS, newGame, cover, lay, knock, chain, fitsAnywhere, worth } from "./topple-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "topple:run", BEST = "topple:best", SEEN = "topple:seen";
const CELL = 10;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");

let S = null;            // the game (topple-engine.js's), as saved
let playing = false;     // a move being played out
let drag = null;         // a piece in hand: { slot, piece, colour, id, x0, y0, moved, lift, at (where it would go), float }
let press = null;        // a pointer pressing the table, to knock
let aim = -1;            // the domino a knock would hit, shown

const valid = g => g && g.v === 1 && Array.isArray(g.cells) && g.cells.length === N * N && Array.isArray(g.hand) && g.hand.length === 3;
function save() { write(RUN, S); }
function newRun() {
  drag?.float.remove();
  drag = null;
  aim = -1;
  S = newGame(Math.floor(Math.random() * 2 ** 31));
  save();
  render();
}

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const at = i => [(i % N) * CELL, Math.floor(i / N) * CELL];
// each colour its own pips too (one, two, three a half), so they're told apart without their colour
const PIPS = [[[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]]];
/** A standing domino on its square; placed by an outer group so its own can move (and fall). */
function dominoEl(c, x, y, cls = "", cell = null) {
  const pips = PIPS[c].flatMap(([px, py]) => [el("circle", { cx: 5 + px * 1.25, cy: 2.95 + py * 1.05, r: .62 }), el("circle", { cx: 5 + px * 1.25, cy: 7.05 + py * 1.05, r: .62 })]);
  return el("g", { transform: `translate(${x} ${y})`, "data-cell": cell },
    el("g", { class: `tp-domino k${c} ${cls}`.trim() }, el("rect", { x: 2, y: .7, width: 6, height: 8.6, rx: 1.1 }), el("path", { class: "tp-bar", d: "M2.8 5H7.2" }), ...pips));
}
const ringEl = i => el("rect", { class: "tp-ring", x: at(i)[0] + .9, y: at(i)[1] + .1, width: 8.2, height: 9.8, rx: 1.8 });
function tagEl(text, i) {
  // above its square, kept on the table
  const [x, y] = at(i), t = el("text", { class: "tp-tag", x: Math.min(64, Math.max(16, x + CELL / 2)), y: Math.max(3.2, y - 1.6) });
  t.textContent = text;
  return t;
}

/**
 * The table: as it stands, or with extra: { cells (a table to draw instead), fresh (dominoes just stood up), ghost
 * ({ laid, colour }: a piece held over it), ring (squares to ring), tag ([text, square]) }.
 */
function drawBoard(extra = {}) {
  const svg = $("board"), cells = extra.cells || S.cells, ghost = extra.ghost;
  const grid = el("g", { class: "tp-grid" });
  for (let k = 1; k < N; k++) grid.append(el("line", { x1: k * CELL, x2: k * CELL, y1: 0, y2: 80 }), el("line", { y1: k * CELL, y2: k * CELL, x1: 0, x2: 80 }));
  const stand = el("g", { id: "stand" }), shown = cells.slice();
  for (const i of ghost?.laid || []) shown[i] = ghost.colour;
  shown.forEach((c, i) => { if (c >= 0) stand.append(dominoEl(c, ...at(i), ghost?.laid.includes(i) ? "ghost" : extra.fresh?.includes(i) ? "fresh" : "", i)); });
  const marks = el("g", {}, ...(extra.ring || []).map(ringEl));
  if (extra.tag) marks.append(tagEl(...extra.tag));
  const kids = [el("rect", { class: "tp-felt", x: -2, y: -2, width: 84, height: 84, rx: 2 }), grid, stand, marks, el("g", { id: "fx" })];
  if (!read(SEEN, false) && S.laid < 3 && !ghost && !extra.ring && !S.over) {
    kids.push(el("g", { class: "tp-hint" }, ...["Drag a piece onto the table;", "a tap on a domino knocks it,", "and its whole chain falls"].map((t, k) => {
      const n = el("text", { x: 40, y: 35 + k * 6 });
      n.textContent = t;
      return n;
    })));
  }
  svg.replaceChildren(...kids);
}
/** A piece drawn on its own, a square to every ten units, centred in a box five squares wide. */
function pieceSvg({ piece, colour }, box = 5) {
  const p = PIECES[piece], ox = ((box - p.w) * CELL) / 2, oy = ((box - p.h) * CELL) / 2;
  return el("svg", { viewBox: `0 0 ${box * CELL} ${box * CELL}`, "aria-hidden": "true" }, ...p.cells.map(([x, y]) => dominoEl(colour, ox + x * CELL, oy + y * CELL)));
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  const k = $("knocks"), pips = Array.from({ length: MAX_KNOCKS }, (_, j) => { const i = document.createElement("i"); if (j < S.knocks) i.className = "on"; return i; });
  const next = document.createElement("small");
  next.textContent = S.knocks < MAX_KNOCKS ? `next in ${S.untilKnock}` : "";
  k.replaceChildren(...pips, next);
  k.setAttribute("aria-label", `${S.knocks} knock${S.knocks === 1 ? "" : "s"}${S.knocks < MAX_KNOCKS ? `, the next in ${S.untilKnock} hand${S.untilKnock === 1 ? "" : "s"}` : ""}`);
}
function drawTray() {
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `No room and no knock: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  for (const b of document.querySelectorAll(".tp-piece")) {
    const slot = Number(b.dataset.slot), h = S.hand[slot];
    b.replaceChildren(...(h ? [pieceSvg(h)] : []));
    b.disabled = !h;
    b.classList.toggle("cant", !!h && !fitsAnywhere(S.cells, h.piece));
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    b.setAttribute("aria-label", h ? `A piece of ${PIECES[h.piece].cells.length}: drag it onto the table` : "Laid");
  }
}
function render(extra) { drawBoard(extra); drawStrip(); drawTray(); }
/** The table with the chain a knock on square i would fell ringed, and what it would score. */
function showKnock(i) {
  const fell = chain(S.cells, i);
  drawBoard({ ring: fell.map(f => f[0]), tag: [S.knocks > 0 ? `+${fmt(worth(fell.length))}` : "No knock left", i] });
}

// ---------- a piece laid, a knock ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
function settle() {
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.laid >= 3) write(SEEN, true);
  save();
}
async function commitLay(slot, x, y) {
  if (playing || S.over) return;
  playing = true;
  const r = lay(S, slot, x, y);
  S = r.state;
  settle();
  render({ fresh: r.laid });
  const node = i => $("board").querySelector(`#stand [data-cell="${i}"] > g`);
  r.laid.forEach((i, k) => animate(node(i), [{ transform: "scaleY(.2)", opacity: .3 }, { transform: "scaleY(1)", opacity: 1 }], { duration: 170, delay: k * 25, easing: "ease-out" }));
  if (r.dealt && !S.over) for (const b of document.querySelectorAll(".tp-piece svg")) animate(b, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 220, easing: "ease-out" });
  if (r.knocked) animate($("knocks").querySelectorAll("i.on")[S.knocks - 1], [{ transform: "scale(1.8)" }, { transform: "scale(1)" }], { duration: 360, easing: "ease-out" });
  await wait(200);
  playing = false;
}
async function commitKnock(i) {
  if (playing || S.over || S.knocks <= 0) return;
  playing = true;
  aim = -1;
  const before = S, r = knock(S, i);
  S = r.state;
  settle();
  // the chain falls domino by domino, each away from the one that knocked it, then the table is drawn without it
  drawBoard({ cells: before.cells });
  drawStrip();
  const STEP = 70, first = r.fell.find(f => f[2] === i)?.[0];
  for (const [j, step, by] of r.fell) {
    const from = by >= 0 ? by : first ?? j - N, dx = Math.sign((j % N) - (from % N)), dy = Math.sign(Math.floor(j / N) - Math.floor(from / N));
    const node = $("board").querySelector(`#stand [data-cell="${j}"] > g`);
    const frames = dx ? [{ transform: "rotate(0deg)", opacity: 1 }, { transform: `rotate(${dx * 84}deg)`, opacity: .2 }]
      : [{ transform: "translateY(0) scaleY(1)", opacity: 1 }, { transform: `translateY(${dy * 2.5}px) scaleY(.18)`, opacity: .2 }];
    animate(node, frames, { duration: 220, delay: step * STEP, easing: "ease-in" });
  }
  const steps = r.fell.at(-1)[1];
  popup(r.fell.map(f => f[0]), r.gain);
  await wait(steps * STEP + 300);
  render();
  playing = false;
}
function popup(cells, gain) {
  const fx = $("board").querySelector("#fx");
  const x = cells.reduce((a, i) => a + at(i)[0], 0) / cells.length + CELL / 2, y = cells.reduce((a, i) => a + at(i)[1], 0) / cells.length + CELL / 2;
  const t = el("text", { class: `tp-pop${cells.length >= 10 ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = `+${fmt(gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 1100, delay: 120, easing: "ease-out" });
}

// ---------- dragging a piece ----------
const screenCell = () => ($("board").getBoundingClientRect().width / 84) * CELL;
const pointIn = (px, py) => { const m = $("board").getScreenCTM(); return m ? new DOMPoint(px, py).matrixTransform(m.inverse()) : null; };
/** Where a piece held with its middle at a point on the screen would go, or null if it doesn't fit there. */
function spotAt(piece, px, py) {
  const p = pointIn(px, py), { w, h } = PIECES[piece];
  if (!p) return null;
  const x = Math.round(p.x / CELL - w / 2), y = Math.round(p.y / CELL - h / 2);
  return cover(S.cells, piece, x, y) ? { x, y } : null;
}
function floatEl(h) {
  const d = document.createElement("div"), size = screenCell(), { w, h: ht } = PIECES[h.piece];
  d.className = "tp-float";
  d.style.width = `${size * w}px`;
  d.style.height = `${size * ht}px`;
  d.append(el("svg", { viewBox: `0 0 ${w * CELL} ${ht * CELL}`, "aria-hidden": "true" }, ...PIECES[h.piece].cells.map(([x, y]) => dominoEl(h.colour, x * CELL, y * CELL))));
  document.body.append(d);
  return d;
}
function startDrag(e, slot) {
  const h = S.hand[slot];
  if (playing || S.over || !h || e.button > 0) return;
  e.preventDefault();
  if (!fitsAnywhere(S.cells, h.piece)) { toast(S.knocks ? "That piece fits nowhere: knock a chain down" : "That piece fits nowhere now"); return; }
  drag?.float.remove();
  // held above the finger, its foot a square clear of it, so where it's going is in sight (a mouse needs no lift)
  const lift = e.pointerType === "mouse" ? 0 : Math.max(48, screenCell() * (PIECES[h.piece].h / 2 + .9));
  drag = { slot, ...h, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, lift, at: null, float: floatEl(h) };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  moveDrag(e);
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.moved = true; drawTray(); }
  const px = e.clientX, py = e.clientY - (drag.moved ? drag.lift : 0), spot = drag.moved ? spotAt(drag.piece, px, py) : null;
  const f = drag.float, { w, h } = PIECES[drag.piece], size = screenCell();
  f.style.left = `${px - (size * w) / 2}px`;
  f.style.top = `${py - (size * h) / 2}px`;
  f.style.visibility = drag.moved && !spot ? "visible" : "hidden";   // where it fits it's drawn in its place
  if (spot?.x === drag.at?.x && spot?.y === drag.at?.y && drag.drawn) return;
  drag.at = spot;
  drag.drawn = true;
  if (!spot) { drawBoard(); return; }
  // the chain it would join, ringed, and how long that chain would be
  const laid = cover(S.cells, drag.piece, spot.x, spot.y), cells = S.cells.slice();
  for (const i of laid) cells[i] = drag.colour;
  const joined = chain(cells, laid[0]).map(f => f[0]);
  drawBoard({ ghost: { laid, colour: drag.colour }, ring: joined.length > laid.length ? joined : [], tag: joined.length > laid.length ? [`a chain of ${joined.length}`, Math.min(...laid)] : null });
}
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { slot, at: spot } = drag;
  drag.float.remove();
  drag = null;
  if (spot) commitLay(slot, spot.x, spot.y);
  else render();
}

// ---------- pressing the table, to knock ----------
/** The square under a point on the screen, or -1 off the table. */
function cellAt(px, py) {
  const p = pointIn(px, py);
  if (!p) return -1;
  const x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
  return x >= 0 && y >= 0 && x < N && y < N ? y * N + x : -1;
}
function aimAt(e) {
  const i = cellAt(e.clientX, e.clientY), on = i >= 0 && S.cells[i] >= 0 ? i : -1;
  if (on === aim) return;
  aim = on;
  if (on >= 0) showKnock(on);
  else drawBoard();
}
$("board").addEventListener("pointerdown", e => {
  if (playing || S.over || drag || e.button > 0) return;
  const i = cellAt(e.clientX, e.clientY);
  if (i < 0 || S.cells[i] < 0) return;
  e.preventDefault();
  press = e.pointerId;
  aim = -2;
  aimAt(e);
});
function movePress(e) {
  if (press === e.pointerId) aimAt(e);
  else if (press == null && !drag && !playing && !S.over && e.pointerType === "mouse" && e.target.closest?.("#board")) aimAt(e);   // a mouse shows a knock as it passes
}
function endPress(e) {
  if (press !== e.pointerId) return;
  press = null;
  const i = cellAt(e.clientX, e.clientY);
  if (i >= 0 && i === aim && S.knocks > 0) commitKnock(i);
  else { aim = -1; drawBoard(); if (i >= 0 && S.cells[i] >= 0 && !S.knocks) toast(`No knock left: the next comes in ${S.untilKnock} hand${S.untilKnock === 1 ? "" : "s"}`); }
}
$("board").addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && press == null && aim >= 0 && !playing) { aim = -1; drawBoard(); } });

// ---------- messages, the menu ----------
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("New game", newRun, "primary"));
  const best = read(BEST, 0);
  part(body, "about").append(line(`This game: ${fmt(S.score)}, ${S.felled} domino${S.felled === 1 ? "" : "es"} felled${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "topple");
document.querySelector(".tp-mark").innerHTML = APPS.find(a => a.id === "topple").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".tp-piece")) b.addEventListener("pointerdown", e => startDrag(e, Number(b.dataset.slot)));
addEventListener("pointermove", e => { moveDrag(e); movePress(e); });
addEventListener("pointerup", e => { endDrag(e); endPress(e); });
addEventListener("pointercancel", e => {
  if (drag?.id === e.pointerId) { drag.float.remove(); drag = null; render(); }
  if (press === e.pointerId) { press = null; aim = -1; drawBoard(); }
});
$("againBtn").addEventListener("click", newRun);
addEventListener("resize", () => { if (!playing && !drag) render(); });      // the screen turned

// for tests and debugging
window.__topple = { get state() { return S; }, commitLay, commitKnock, spotAt, cellAt, newRun };

S = read(RUN, null);
if (!valid(S)) newRun();
else render();
