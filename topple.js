// Topple: a table of sixty-one hexagons. Drag one of three pieces of standing dominoes onto it; while it's held where it
// fits, the dominoes it would join are ringed with what their best push would fell. When a hand's last piece is down the
// knock may be due: press a domino and slide the way it should fall, and what would fall is ringed (what would stay
// standing marked), with its points; let go to push. The rules are topple-engine.js's; this file draws the table, plays
// each move out and keeps the game.
import { CELLS, SIZE, DIRS, DIR_NAMES, PIECES, newGame, cover, lay, knock, group, knockOn, fitsAnywhere, longest, untilKnock, at as cellNumber, next } from "./topple-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "topple:run", BEST = "topple:best", SEEN = "topple:seen";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

let S = null;            // the game (topple-engine.js's), as saved
let playing = false;     // a move being played out
let drag = null;         // a piece in hand: { slot, piece, colour, id, x0, y0, moved, lift, at (where it would go), float }
let press = null;        // a pointer pressing the table, to knock
let aim = null;          // the domino a knock would start from, and the way: { at, dir (-1: none chosen yet) }

const valid = g => g && g.v === 3 && Array.isArray(g.cells) && g.cells.length === SIZE && Array.isArray(g.hand) && g.hand.length === 3 && g.hand.every(h => !h || PIECES[h.piece]);
function save() { write(RUN, S); }
function newRun() {
  drag?.float.remove();
  drag = null;
  aim = null;
  S = newGame(Math.floor(Math.random() * 2 ** 31));
  save();
  render();
}

// ---------- the table's geometry ----------
// Pointy-topped hexagons, RAD from the middle to a corner, WID from side to side; a hexagon (q, r) of the engine sits
// at WID (q + r / 2) across and 1.5 RAD r down from the table's middle, which is the drawing's origin.
const RAD = 5.8, WID = Math.sqrt(3) * RAD;
const mid = (q, r) => [WID * (q + r / 2), 1.5 * RAD * r];
const MID = CELLS.map(([q, r]) => mid(q, r));
const MARGIN = 2.4, VB = { x: -(4.5 * WID + MARGIN), y: -(7 * RAD + MARGIN), w: 9 * WID + 2 * MARGIN, h: 14 * RAD + 2 * MARGIN };
// the corners of a unit hexagon, and the way each of the six directions points on the screen (east, then up and round)
const CORNER = [30, 90, 150, 210, 270, 330].map(a => [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)]);
const heading = d => [Math.cos((-d * Math.PI) / 3), Math.sin((-d * Math.PI) / 3)];
const hexD = (x, y, rad) => `M${CORNER.map(([cx, cy]) => `${(x + cx * rad).toFixed(2)} ${(y + cy * rad).toFixed(2)}`).join("L")}Z`;
/** The (q, r) of the hexagon whose middle is nearest a point of the drawing (rounded through cube coordinates). */
function hexAt(x, y) {
  const fq = ((Math.sqrt(3) / 3) * x - y / 3) / RAD, fr = ((2 / 3) * y) / RAD;
  let q = Math.round(fq), r = Math.round(fr);
  const s = Math.round(-fq - fr), dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s + fq + fr);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [q, r];
}
/** A piece's room, from the middle of its first domino: { x0, y0, w, h, cx, cy (its middle) }. */
function bounds(piece) {
  const at = PIECES[piece].cells.map(([q, r]) => mid(q, r)), x0 = Math.min(...at.map(a => a[0])) - WID / 2, y0 = Math.min(...at.map(a => a[1])) - RAD;
  const w = Math.max(...at.map(a => a[0])) + WID / 2 - x0, h = Math.max(...at.map(a => a[1])) + RAD - y0;
  return { x0, y0, w, h, cx: x0 + w / 2, cy: y0 + h / 2 };
}
// the table's edge: the sides of its hexagons that have none beside them
const RIM = CELLS.flatMap((_, i) => DIRS.flatMap((_, d) => {
  if (next(i, d) >= 0) return [];
  const [x, y] = MID[i], a = -d * 60;
  const p = k => `${(x + RAD * Math.cos(((a + k) * Math.PI) / 180)).toFixed(2)} ${(y + RAD * Math.sin(((a + k) * Math.PI) / 180)).toFixed(2)}`;
  return [`M${p(-30)}L${p(30)}`];
})).join("");

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
// each colour its own pips too (one, two, three a half), so they're told apart without their colour
const PIPS = [[0], [-.28, .28], [-.46, 0, .46]];
/** A standing domino on its hexagon, placed by an outer group so its own can move (and fall). */
function dominoEl(c, x, y, cls = "", cell = null) {
  const pips = PIPS[c].flatMap(px => [-1, 1].map(h => el("circle", { cx: (px * RAD).toFixed(2), cy: (h * .46 * RAD).toFixed(2), r: (.17 * RAD).toFixed(2) })));
  return el("g", { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})`, "data-cell": cell },
    el("g", { class: `tp-domino k${c} ${cls}`.trim() }, el("path", { class: "tp-body", d: hexD(0, 0, .86 * RAD) }), el("path", { class: "tp-bar", d: `M${-.6 * RAD} 0H${.6 * RAD}` }), ...pips));
}
const ringEl = (i, cls = "tp-ring") => el("path", { class: cls, d: hexD(...MID[i], .93 * RAD) });
// the bell: drawn whole on an empty hexagon; on a domino, small at its corner, the hexagon ringed in brass
const BELL = "M0-2.6C-1.5-2.6-2.2-1.4-2.2 0V1.3L-3 2.2H3L2.2 1.3V0C2.2-1.4 1.5-2.6 0-2.6ZM-.85 2.75A.85.85 0 0 0 .85 2.75Z";
function bellEl(i, covered) {
  const [x, y] = MID[i], glyph = covered
    ? el("g", { transform: `translate(${(x + .5 * RAD).toFixed(2)} ${(y - .6 * RAD).toFixed(2)}) scale(.55)` }, el("circle", { r: 3.6 }), el("path", { d: BELL }))
    : el("g", { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(1.25)` }, el("path", { d: BELL }));
  // the glyph swings (and comes) in a group of its own, so the animation doesn't take its place on the table
  return el("g", { class: `tp-bell${covered ? " on" : ""}` }, ...(covered ? [el("path", { class: "tp-bell-ring", d: hexD(x, y, .97 * RAD) })] : []), el("g", { id: "bell", class: "tp-swing" }, glyph));
}
function tagEl(text, i) {
  // above its hexagon, kept on the table: half its width (about 1.25 units a letter) from either edge
  const half = Math.max(16, text.length * 1.25 + 1), [x, y] = MID[i], t = el("text", { class: "tp-tag", x: Math.min(VB.x + VB.w - half, Math.max(VB.x + half, x)).toFixed(1), y: Math.max(VB.y + 3.4, y - 1.15 * RAD).toFixed(1) });
  t.textContent = text;
  return t;
}
/** A score short enough to sit on a hexagon: 240, 1.4k, 12k. */
const short = n => (n < 1000 ? String(n) : n < 10000 ? `${(n / 1000).toFixed(1).replace(".0", "")}k` : `${Math.round(n / 1000)}k`);
/**
 * The six ways a domino could be pushed, round it: the chosen one filled; with `gains`, what each would score (but not
 * towards the table's edge, where only the domino itself would go).
 */
function compassEl({ at, dir }, gains) {
  const [x, y] = MID[at], out = [];
  for (let d = 0; d < 6; d++) {
    const [ux, uy] = heading(d), vx = -uy, vy = ux, tip = .86 * WID, base = .5 * WID, wing = .17 * WID;
    const p = (a, b) => `${(x + ux * a + vx * b).toFixed(2)} ${(y + uy * a + vy * b).toFixed(2)}`;
    out.push(el("path", { class: `tp-arrow${d === dir ? " on" : ""}`, d: `M${p(tip, 0)}L${p(base, wing)}L${p(base, -wing)}Z`, "data-dir": d }));
    if (gains && next(at, d) >= 0) {
      const t = el("text", { class: "tp-gain", x: (x + ux * 1.28 * WID).toFixed(1), y: (y + uy * 1.28 * WID).toFixed(1) });
      t.textContent = short(gains[d]);
      out.push(t);
    }
  }
  return el("g", { class: "tp-compass" }, ...out);
}
const HINT = ["Drag a piece onto the table.", "After each hand, slide a domino", "the way it should fall: it takes", "the one ahead, or two at 60°.", "Past the bell, it scores double."];

/**
 * The table: as it stands, or with extra: { cells (a table to draw instead), bell (where it hangs, if not where it
 * hangs now), fresh (dominoes just stood up), ghost ({ laid, colour }: a piece held over it), ring (hexagons to ring),
 * stay (hexagons that would stay standing), tag ([text, hexagon]), compass ({ at, dir }, gains) }.
 */
function drawBoard(extra = {}) {
  const svg = $("board"), cells = extra.cells || S.cells, ghost = extra.ghost, bell = extra.bell ?? S.bell;
  const felt = el("g", { class: "tp-felt" }, el("path", { d: CELLS.map((_, i) => hexD(...MID[i], RAD)).join("") }), el("path", { class: "tp-rim", d: RIM }));
  const stand = el("g", { id: "stand" }), shown = cells.slice();
  for (const i of ghost?.laid || []) shown[i] = ghost.colour;
  shown.forEach((c, i) => { if (c >= 0) stand.append(dominoEl(c, ...MID[i], ghost?.laid.includes(i) ? "ghost" : extra.fresh?.includes(i) ? "fresh" : "", i)); });
  const under = bell >= 0 && shown[bell] < 0 ? [bellEl(bell, false)] : [], over = bell >= 0 && shown[bell] >= 0 ? [bellEl(bell, true)] : [];
  const marks = el("g", {}, ...(extra.stay || []).map(i => ringEl(i, "tp-stay")), ...(extra.ring || []).map(i => ringEl(i)));
  if (extra.compass) marks.append(compassEl(...extra.compass));
  if (extra.tag) marks.append(tagEl(...extra.tag));
  const kids = [felt, ...under, stand, ...over, marks, el("g", { id: "fx" })];
  if (!read(SEEN, false) && S.laid < 3 && !ghost && !extra.ring && !S.over) {
    kids.push(el("g", { class: "tp-hint" }, ...HINT.map((t, k) => {
      const n = el("text", { x: 0, y: -10 + k * 6 });
      n.textContent = t;
      return n;
    })));
  }
  svg.replaceChildren(...kids);
}
/** A piece drawn on its own, centred in a box a line of five fits. */
function pieceSvg({ piece, colour }) {
  const b = bounds(piece), box = 5.4 * WID;
  return el("svg", { viewBox: `${(b.cx - box / 2).toFixed(2)} ${(b.cy - box / 2).toFixed(2)} ${box.toFixed(2)} ${box.toFixed(2)}`, "aria-hidden": "true" }, ...PIECES[piece].cells.map(([q, r]) => dominoEl(colour, ...mid(q, r))));
}
/** When the knock comes: now, after this hand, or in so many. */
function knockWords() {
  const n = untilKnock(S);
  return n === 0 ? "Knock now" : n === 1 ? "Knock after this hand" : `Knock in ${n} hands`;
}
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
 * The table with the domino at i pressed: the six ways it could go round it (with what each scores until one is
 * chosen), and for the chosen way what would fall ringed, what of its colour would stay standing marked, the steps and
 * the points.
 */
function showAim() {
  const { at, dir } = aim, tries = DIRS.map((_, d) => knockOn(S.cells, at, d, S.bell));
  if (dir < 0) { drawBoard({ compass: [aim, tries.map(k => k.gain)], tag: ["Slide the way it should fall", at] }); return; }
  const k = tries[dir], fell = new Set(k.fell.map(f => f[0])), stay = group(S.cells, at).filter(j => !fell.has(j));
  const words = `${k.fell.length} in ${plural(k.steps, "step")}: +${fmt(k.gain)}${k.rings ? ", the bell" : ""}${stay.length ? `; ${stay.length} stand` : ""}`;
  drawBoard({ ring: [...fell], stay, compass: [aim], tag: [S.due ? words : `${words} (${knockWords().toLowerCase()})`, at] });
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
  const node = i => $("board").querySelector(`#stand [data-cell="${i}"] > g`);
  done.laid.forEach((i, k) => animate(node(i), [{ transform: "scale(.2)", opacity: .3 }, { transform: "scale(1)", opacity: 1 }], { duration: 170, delay: k * 25, easing: "ease-out" }));
  if (done.dealt && !S.over) for (const b of document.querySelectorAll(".tp-piece svg")) animate(b, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 220, easing: "ease-out" });
  if (done.due) {
    animate($("knock"), [{ transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 360, easing: "ease-out" });
    if (S.sets <= 3 || !read(SEEN, false)) toast("Knock a domino: press one and slide the way it should fall");
  }
  await wait(200);
  playing = false;
}
async function commitKnock(i, dir) {
  if (playing || S.over || !S.due) return;
  playing = true;
  aim = null;
  const before = S, done = knock(S, i, dir);
  S = done.state;
  settle();
  // the dominoes fall one by one, each the way it was knocked (the bell where it hung until they've passed it), then
  // the table is drawn without them
  drawBoard({ cells: before.cells, bell: before.bell });
  drawStrip();
  const STEP = 70;
  for (const [j, step, by] of done.fell) {
    const d = by < 0 ? dir : DIRS.findIndex((_, e) => next(by, e) === j), [ux, uy] = heading(d);
    const frames = [{ transform: "translate(0px, 0px) rotate(0deg) scale(1)", opacity: 1 }, { transform: `translate(${(ux * 3.4).toFixed(2)}px, ${(uy * 3.4).toFixed(2)}px) rotate(${Math.round(ux * 70)}deg) scale(.55)`, opacity: .15 }];
    animate($("board").querySelector(`#stand [data-cell="${j}"] > g`), frames, { duration: 240, delay: step * STEP, easing: "ease-in" });
  }
  if (done.rang) {
    const passed = done.fell.find(f => f[0] === before.bell)?.[1] ?? 0;
    animate($("bell"), [{ transform: "rotate(0deg)" }, { transform: "rotate(-14deg)" }, { transform: "rotate(12deg)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(0deg)" }], { duration: 520, delay: passed * STEP + 120, easing: "ease-in-out" });
  }
  popup(done.fell.map(f => f[0]), done.gain, done.rang);
  await wait(done.steps * STEP + 300 + (done.rang ? 300 : 0));
  render();
  if (done.rang) animate($("bell"), [{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1)" }], { duration: 320, easing: "ease-out" });
  playing = false;
}
function popup(cells, gain, rang) {
  const fx = $("board").querySelector("#fx");
  const x = cells.reduce((a, i) => a + MID[i][0], 0) / cells.length, y = cells.reduce((a, i) => a + MID[i][1], 0) / cells.length;
  const t = el("text", { class: `tp-pop${cells.length >= 10 || rang ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = rang ? `+${fmt(gain / 2)} ×2` : `+${fmt(gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 1100, delay: 120, easing: "ease-out" });
}

// ---------- dragging a piece ----------
const unit = () => $("board").getBoundingClientRect().width / VB.w;       // screen pixels to a unit of the drawing
const pointIn = (px, py) => { const m = $("board").getScreenCTM(); return m ? new DOMPoint(px, py).matrixTransform(m.inverse()) : null; };
/** Where a piece held with its middle at a point on the screen would go, or null if it doesn't fit there. */
function spotAt(piece, px, py) {
  const p = pointIn(px, py), b = bounds(piece);
  if (!p) return null;
  const [q, r] = hexAt(p.x - b.cx, p.y - b.cy);
  return cover(S.cells, piece, q, r) ? { q, r } : null;
}
function floatEl(h) {
  const d = document.createElement("div"), size = unit(), b = bounds(h.piece);
  d.className = "tp-float";
  d.style.width = `${size * b.w}px`;
  d.style.height = `${size * b.h}px`;
  d.append(el("svg", { viewBox: `${b.x0.toFixed(2)} ${b.y0.toFixed(2)} ${b.w.toFixed(2)} ${b.h.toFixed(2)}`, "aria-hidden": "true" }, ...PIECES[h.piece].cells.map(([q, r]) => dominoEl(h.colour, ...mid(q, r)))));
  document.body.append(d);
  return d;
}
function startDrag(e, slot) {
  const h = S.hand[slot];
  if (playing || S.over || !h || e.button > 0) return;
  e.preventDefault();
  if (S.due) { toast("Knock a domino first: press one and slide the way it should fall"); return; }
  if (!fitsAnywhere(S.cells, h.piece)) { toast("That piece fits nowhere now"); return; }
  drag?.float.remove();
  if (aim) { aim = null; drawBoard(); }
  // held above the finger, its foot a hexagon clear of it, so where it's going is in sight (a mouse needs no lift)
  const lift = e.pointerType === "mouse" ? 0 : Math.max(48, unit() * (bounds(h.piece).h / 2 + RAD * 1.6));
  drag = { slot, ...h, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, lift, at: null, float: floatEl(h) };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  moveDrag(e);
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.moved = true; drawTray(); }
  const px = e.clientX, py = e.clientY - (drag.moved ? drag.lift : 0), spot = drag.moved ? spotAt(drag.piece, px, py) : null;
  const f = drag.float, b = bounds(drag.piece), size = unit();
  f.style.left = `${px - (size * b.w) / 2}px`;
  f.style.top = `${py - (size * b.h) / 2}px`;
  f.style.visibility = drag.moved && !spot ? "visible" : "hidden";   // where it fits it's drawn in its place
  if (spot?.q === drag.at?.q && spot?.r === drag.at?.r && drag.drawn) return;
  drag.at = spot;
  drag.drawn = true;
  if (!spot) { drawBoard(); return; }
  // the dominoes it would join, ringed, and what their best push would fell: all of them, or some standing
  const laid = cover(S.cells, drag.piece, spot.q, spot.r), cells = S.cells.slice();
  for (const i of laid) cells[i] = drag.colour;
  const joined = group(cells, laid[0]), grew = joined.length > laid.length, best = grew ? longest(cells, laid[0], S.bell) : null;
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

// ---------- pressing the table, to knock ----------
/** The hexagon under a point on the screen, or -1 off the table. */
function cellAt(px, py) {
  const p = pointIn(px, py);
  return p ? cellNumber(...hexAt(p.x, p.y)) : -1;
}
// a press nearer than this to the domino has chosen no way yet; farther than REACH, none either
const DEAD = .42 * WID, REACH = 2.6 * WID;
/** The way a point lies from the middle of hexagon i: 0–5, or -1 within the dead zone or out of reach. */
function wayFrom(i, p) {
  if (!p) return -1;
  const [x, y] = MID[i], dx = p.x - x, dy = p.y - y, far = Math.hypot(dx, dy);
  if (far < DEAD || far > REACH) return -1;
  return (((Math.round(-Math.atan2(dy, dx) / (Math.PI / 3)) % 6) + 6) % 6);
}
function aimAt(e) {
  const dir = wayFrom(aim.at, pointIn(e.clientX, e.clientY));
  if (dir === aim.dir) return;
  aim.dir = dir;
  showAim();
}
$("board").addEventListener("pointerdown", e => {
  if (playing || S.over || drag || e.button > 0) return;
  const i = cellAt(e.clientX, e.clientY);
  if (i < 0 || S.cells[i] < 0) { if (aim) { aim = null; drawBoard(); } return; }
  e.preventDefault();
  press = e.pointerId;
  aim = { at: i, dir: -1 };
  showAim();
});
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
$("board").setAttribute("viewBox", `${VB.x.toFixed(2)} ${VB.y.toFixed(2)} ${VB.w.toFixed(2)} ${VB.h.toFixed(2)}`);
$("board").style.setProperty("--ratio", (VB.w / VB.h).toFixed(4));
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".tp-piece")) b.addEventListener("pointerdown", e => startDrag(e, Number(b.dataset.slot)));
addEventListener("pointermove", e => { moveDrag(e); if (press === e.pointerId) aimAt(e); });
addEventListener("pointerup", e => { endDrag(e); endPress(e); });
addEventListener("pointercancel", e => {
  if (drag?.id === e.pointerId) { drag.float.remove(); drag = null; render(); }
  if (press === e.pointerId) { press = null; aim = null; drawBoard(); }
});
$("againBtn").addEventListener("click", newRun);
addEventListener("resize", () => { if (!playing && !drag) { aim = null; render(); } });      // the screen turned

// for tests and debugging
window.__topple = {
  get state() { return S; }, set state(s) { S = s; aim = null; render(); }, commitLay, commitKnock, spotAt, cellAt, newRun, DIR_NAMES,
  screenOf: i => { const m = $("board").getScreenCTM(), p = new DOMPoint(...MID[i]).matrixTransform(m); return [p.x, p.y]; },
};

S = read(RUN, null);
if (!valid(S)) newRun();
else { save(); render(); }
