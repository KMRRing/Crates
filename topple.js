// Topple: a table eight squares by eight. Drag one of three pieces of standing dominoes onto it; while it's held where
// it fits, the dominoes it would join are ringed with what their best knock would fell. When a hand's last piece is
// down the knock is due: press a domino and what would fall is ringed (what would stay standing marked), with its
// points; let go on it to knock. The rules are topple-engine.js's; this file draws the table, plays each move out and
// keeps the game.
import { N, PIECES, newGame, upgrade, cover, lay, knock, group, knockOn, fitsAnywhere, longest } from "./topple-engine.js";
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
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

let S = null;            // the game (topple-engine.js's), as saved
let playing = false;     // a move being played out
let drag = null;         // a piece in hand: { slot, piece, colour, id, x0, y0, moved, lift, at (where it would go), float }
let press = null;        // a pointer pressing the table, to knock
let aim = -1;            // the domino a knock would hit, shown

const valid = g => g && g.v === 2 && Array.isArray(g.cells) && g.cells.length === N * N && Array.isArray(g.hand) && g.hand.length === 3;
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
const ringEl = (i, cls = "tp-ring") => el("rect", { class: cls, x: at(i)[0] + .9, y: at(i)[1] + .1, width: 8.2, height: 9.8, rx: 1.8 });
// the bell: drawn whole on an empty square; on a domino, small at its corner, the square ringed in brass
const BELL = "M0-2.6C-1.5-2.6-2.2-1.4-2.2 0V1.3L-3 2.2H3L2.2 1.3V0C2.2-1.4 1.5-2.6 0-2.6ZM-.85 2.75A.85.85 0 0 0 .85 2.75Z";
function bellEl(i, covered) {
  const [x, y] = at(i), glyph = covered
    ? el("g", { transform: `translate(${x + 8.6} ${y + 1.6}) scale(.55)` }, el("circle", { r: 3.6 }), el("path", { d: BELL }))
    : el("g", { transform: `translate(${x + 5} ${y + 5}) scale(1.25)` }, el("path", { d: BELL }));
  // the glyph swings (and comes) in a group of its own, so the animation doesn't take its place on the table
  return el("g", { class: `tp-bell${covered ? " on" : ""}` }, ...(covered ? [el("rect", { class: "tp-bell-ring", x: x + .35, y: y + .35, width: 9.3, height: 9.3, rx: 2 })] : []), el("g", { id: "bell", class: "tp-swing" }, glyph));
}
function tagEl(text, i) {
  // above its square, kept on the table: half its width (about 1.25 units a letter) from either edge
  const half = Math.max(16, text.length * 1.25 + 1), [x, y] = at(i), t = el("text", { class: "tp-tag", x: Math.min(80 - half, Math.max(half, x + CELL / 2)), y: Math.max(3.2, y - 1.6) });
  t.textContent = text;
  return t;
}
const HINT = ["Drag a piece onto the table.", "After each hand, knock a domino:", "each falls straight on, turning", "only where its line ends.", "Past the bell, it scores double."];

/**
 * The table: as it stands, or with extra: { cells (a table to draw instead), bell (where it hangs, if not where it
 * hangs now), fresh (dominoes just stood up), ghost ({ laid, colour }: a piece held over it), ring (squares to ring),
 * stay (squares that would stay standing), tag ([text, square]) }.
 */
function drawBoard(extra = {}) {
  const svg = $("board"), cells = extra.cells || S.cells, ghost = extra.ghost, bell = extra.bell ?? S.bell;
  const grid = el("g", { class: "tp-grid" });
  for (let k = 1; k < N; k++) grid.append(el("line", { x1: k * CELL, x2: k * CELL, y1: 0, y2: 80 }), el("line", { y1: k * CELL, y2: k * CELL, x1: 0, x2: 80 }));
  const stand = el("g", { id: "stand" }), shown = cells.slice();
  for (const i of ghost?.laid || []) shown[i] = ghost.colour;
  shown.forEach((c, i) => { if (c >= 0) stand.append(dominoEl(c, ...at(i), ghost?.laid.includes(i) ? "ghost" : extra.fresh?.includes(i) ? "fresh" : "", i)); });
  const under = bell >= 0 && shown[bell] < 0 ? [bellEl(bell, false)] : [], over = bell >= 0 && shown[bell] >= 0 ? [bellEl(bell, true)] : [];
  const marks = el("g", {}, ...(extra.stay || []).map(i => ringEl(i, "tp-stay")), ...(extra.ring || []).map(i => ringEl(i)));
  if (extra.tag) marks.append(tagEl(...extra.tag));
  const kids = [el("rect", { class: "tp-felt", x: -2, y: -2, width: 84, height: 84, rx: 2 }), grid, ...under, stand, ...over, marks, el("g", { id: "fx" })];
  if (!read(SEEN, false) && S.laid < 3 && !ghost && !extra.ring && !S.over) {
    kids.push(el("g", { class: "tp-hint" }, ...HINT.map((t, k) => {
      const n = el("text", { x: 40, y: 30 + k * 6 });
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
/** When the knock comes: now, after this hand, or in so many. */
const knockWords = () => (S.due ? "Knock now" : S.untilKnock === 1 ? "Knock after this hand" : `Knock in ${S.untilKnock} hands`);
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  const k = $("knock");
  k.textContent = S.over ? "" : knockWords();
  k.classList.toggle("now", S.due && !S.over);
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
    b.replaceChildren(...(h ? [pieceSvg(h)] : []));
    b.disabled = !h;
    b.classList.toggle("cant", !!h && !S.due && !fitsAnywhere(S.cells, h.piece));
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    b.setAttribute("aria-label", h ? `A piece of ${PIECES[h.piece].cells.length}${S.due ? ", after the knock" : ": drag it onto the table"}` : "Laid");
  }
}
function render(extra) { drawBoard(extra); drawStrip(); drawTray(); }
/**
 * The table with what a knock on square i would fell ringed, what of its colour would stay standing marked, how many
 * steps it would take and what it would score.
 */
function showKnock(i) {
  const k = knockOn(S.cells, i, S.bell), fell = new Set(k.fell.map(f => f[0])), stay = group(S.cells, i).filter(j => !fell.has(j));
  const words = `${k.fell.length} in ${plural(k.steps, "step")}: +${fmt(k.gain)}${k.rings ? ", the bell" : ""}${stay.length ? `; ${stay.length} stand` : ""}`;
  drawBoard({ ring: [...fell], stay, tag: [S.due ? words : `${words} (${knockWords().toLowerCase()})`, i] });
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
  if (playing || S.over || S.due) return;
  playing = true;
  const r = lay(S, slot, x, y);
  S = r.state;
  settle();
  render({ fresh: r.laid });
  const node = i => $("board").querySelector(`#stand [data-cell="${i}"] > g`);
  r.laid.forEach((i, k) => animate(node(i), [{ transform: "scaleY(.2)", opacity: .3 }, { transform: "scaleY(1)", opacity: 1 }], { duration: 170, delay: k * 25, easing: "ease-out" }));
  if (r.dealt && !S.over) for (const b of document.querySelectorAll(".tp-piece svg")) animate(b, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 220, easing: "ease-out" });
  if (r.due) {
    animate($("knock"), [{ transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 360, easing: "ease-out" });
    if (S.sets <= 3 || !read(SEEN, false)) toast("Knock a domino: press one to see what falls");
  }
  await wait(200);
  playing = false;
}
async function commitKnock(i) {
  if (playing || S.over || !S.due) return;
  playing = true;
  aim = -1;
  const before = S, r = knock(S, i);
  S = r.state;
  settle();
  // the dominoes fall one by one, each away from the one that knocked it (the bell where it hung until they've passed
  // it), then the table is drawn without them
  drawBoard({ cells: before.cells, bell: before.bell });
  drawStrip();
  const STEP = 70, first = r.fell.find(f => f[2] === i)?.[0];
  for (const [j, step, by] of r.fell) {
    const from = by >= 0 ? by : first ?? j - N, dx = Math.sign((j % N) - (from % N)), dy = Math.sign(Math.floor(j / N) - Math.floor(from / N));
    const node = $("board").querySelector(`#stand [data-cell="${j}"] > g`);
    const frames = dx ? [{ transform: "rotate(0deg)", opacity: 1 }, { transform: `rotate(${dx * 84}deg)`, opacity: .2 }]
      : [{ transform: "translateY(0) scaleY(1)", opacity: 1 }, { transform: `translateY(${dy * 2.5}px) scaleY(.18)`, opacity: .2 }];
    animate(node, frames, { duration: 220, delay: step * STEP, easing: "ease-in" });
  }
  if (r.rang) {
    const passed = r.fell.find(f => f[0] === before.bell)?.[1] ?? 0;
    animate($("bell"), [{ transform: "rotate(0deg)" }, { transform: "rotate(-14deg)" }, { transform: "rotate(12deg)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(0deg)" }], { duration: 520, delay: passed * STEP + 120, easing: "ease-in-out" });
  }
  popup(r.fell.map(f => f[0]), r.gain, r.rang);
  await wait(r.steps * STEP + 300 + (r.rang ? 300 : 0));
  render();
  if (r.rang) animate($("bell"), [{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1)" }], { duration: 320, easing: "ease-out" });
  playing = false;
}
function popup(cells, gain, rang) {
  const fx = $("board").querySelector("#fx");
  const x = cells.reduce((a, i) => a + at(i)[0], 0) / cells.length + CELL / 2, y = cells.reduce((a, i) => a + at(i)[1], 0) / cells.length + CELL / 2;
  const t = el("text", { class: `tp-pop${cells.length >= 10 || rang ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = rang ? `+${fmt(gain / 2)} ×2` : `+${fmt(gain)}`;
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
  if (S.due) { toast("Knock a domino first: press one to see what falls"); return; }
  if (!fitsAnywhere(S.cells, h.piece)) { toast("That piece fits nowhere now"); return; }
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
  // the dominoes it would join, ringed, and what their best knock would fell: all of them, or some standing
  const laid = cover(S.cells, drag.piece, spot.x, spot.y), cells = S.cells.slice();
  for (const i of laid) cells[i] = drag.colour;
  const joined = group(cells, laid[0]), grew = joined.length > laid.length, b = grew ? longest(cells, laid[0], S.bell) : null;
  const words = b && (b.fell === b.size ? `${b.size} together: they all fall in ${b.steps}` : `${b.size} together: ${b.fell} fall at most`) + (b.rings ? ", past the bell" : "");
  drawBoard({ ghost: { laid, colour: drag.colour }, ring: grew ? joined : [], tag: grew ? [words, Math.min(...laid)] : null });
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
  if (i >= 0 && i === aim && S.due) commitKnock(i);
  else { aim = -1; drawBoard(); if (i >= 0 && S.cells[i] >= 0 && !S.due) toast(`The knock comes ${S.untilKnock === 1 ? "after this hand" : `in ${S.untilKnock} hands`}`); }
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
  part(body, "about").append(line(`This game: ${fmt(S.score)}, ${plural(S.felled, "domino", "dominoes")} felled, the bell rung ${plural(S.rung, "time")}${best ? `; your best ${fmt(best)}` : ""}`));
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
window.__topple = { get state() { return S; }, set state(s) { S = s; render(); }, commitLay, commitKnock, spotAt, cellAt, newRun };

S = upgrade(read(RUN, null));
if (!valid(S)) newRun();
else { save(); render(); }
