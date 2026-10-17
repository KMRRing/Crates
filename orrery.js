// Orrery: four brass rings of twelve places round a sun, planets standing in them, and a comet coming in along one
// spoke. Drag a ring round and the turn is shown before you let go: the conjunctions it would make ringed, a syzygy
// drawn through the sun, the foretold planets where they would land, what the comet would sweep away if it comes this
// turn; let go past a third of a place to turn it one place that way. The rules are orrery-engine.js's; this file
// draws the orrery, plays each turn out and keeps the game.
import { RINGS, PLACES, newGame, upgrade, turn, turned, worth } from "./orrery-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "orrery:run", BEST = "orrery:best", SEEN = "orrery:seen";
const RADII = [17, 29.5, 42, 54.5], SUN = 8, STEP = 360 / PLACES, SNAP = STEP * .4;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const RING_NAMES = ["the inner ring", "the second ring", "the third ring", "the outer ring"];

let S = null;            // the game (orrery-engine.js's), as saved
let playing = false;     // a turn being played out
let grab = null;         // a ring being dragged: { id, ring, a0, deg, by }

const valid = g => g && g.v === 1 && Array.isArray(g.places) && g.places.length === RINGS * PLACES && Array.isArray(g.coming);
const polar = (r, place) => [r * Math.cos(angle(place)), r * Math.sin(angle(place))];
function save() { write(RUN, S); }
function newRun() { S = newGame(Math.floor(Math.random() * 2 ** 31)); grab = null; save(); render(); }

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const ringOf = i => Math.floor(i / PLACES), placeOf = i => i % PLACES;
const angle = place => ((-90 + STEP * place) * Math.PI) / 180;
const pos = i => [RADII[ringOf(i)] * Math.cos(angle(placeOf(i))), RADII[ringOf(i)] * Math.sin(angle(placeOf(i)))];
// as large as the ring's spacing allows (the inner ring's places are closest together)
const size = ring => Math.min(4.6, ((2 * Math.PI * RADII[ring]) / PLACES) * .47);
/** A planet: its disc in its colour and a mark of its own (a ring, bands, a crescent, a cap), so they're told apart
 *  without their colour; placed by an outer group so its own can move. */
function planetEl(c, i, cls = "", r = size(ringOf(i)), [x, y] = pos(i)) {
  const mark = [
    () => el("ellipse", { class: "or-stroke", rx: r * 1.3, ry: r * .36, transform: "rotate(-18)" }),
    () => el("path", { class: "or-stroke", d: `M${-r * .78} ${-r * .32}H${r * .78}M${-r * .78} ${r * .34}H${r * .78}` }),
    () => el("path", { class: "or-shade", d: `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${r * .5} ${r} 0 0 0 0 ${-r}Z` }),
    () => el("circle", { class: "or-cap", cx: r * .32, cy: -r * .34, r: r * .34 }),
  ][c]();
  return el("g", { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})`, "data-cell": i }, el("g", { class: `or-planet k${c} ${cls}`.trim() }, el("circle", { class: "or-disc", r }), mark));
}
function face() {
  const g = el("g", { class: "or-face" }, el("circle", { class: "or-bezel", r: 60 }));
  for (let p = 0; p < PLACES; p++) {
    const a = angle(p), c = Math.cos(a), s = Math.sin(a);
    g.append(el("line", { class: "or-spoke", x1: (SUN + 2) * c, y1: (SUN + 2) * s, x2: 59 * c, y2: 59 * s }), el("line", { class: "or-tick", x1: 57.5 * c, y1: 57.5 * s, x2: 60 * c, y2: 60 * s }));
  }
  for (const r of RADII) g.append(el("circle", { class: "or-orbit-line", r }));
  g.append(el("circle", { class: "or-sun", r: SUN }), el("circle", { class: "or-sun-core", r: SUN * .55 }));
  return g;
}

/** The comet: out beyond the rim on its spoke, its tail pointing away from the sun as a comet's does, the turns till it
 *  comes beside it, and its way in to the sun dashed. */
function cometEl(c) {
  const [hx, hy] = polar(61.6, c.spoke), [ox, oy] = polar(66.8, c.spoke), [sx, sy] = polar(SUN + 1.5, c.spoke), [ex, ey] = polar(59.5, c.spoke);
  const a = angle(c.spoke), side = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)], label = polar(64.2, c.spoke + .3);
  const tail = `M${(hx + side[0] * 2.2).toFixed(2)} ${(hy + side[1] * 2.2).toFixed(2)}L${ox.toFixed(2)} ${oy.toFixed(2)}L${(hx - side[0] * 2.2).toFixed(2)} ${(hy - side[1] * 2.2).toFixed(2)}Z`;
  const t = el("text", { class: "or-comet-in", x: label[0].toFixed(2), y: label[1].toFixed(2) });
  t.textContent = c.in;
  return el("g", { class: `or-comet${c.in <= 1 ? " due" : ""}` }, el("line", { class: "or-comet-path", x1: sx.toFixed(2), y1: sy.toFixed(2), x2: ex.toFixed(2), y2: ey.toFixed(2) }),
    el("g", { class: "or-comet-body" }, el("path", { class: "or-comet-tail", d: tail }), el("circle", { class: "or-comet-head", cx: hx.toFixed(2), cy: hy.toFixed(2), r: 2.1 })), t);
}
/** A syzygy: the line through the sun from one end of the diameter to the other. */
const syzygyEl = p => { const [x1, y1] = polar(59, p), [x2, y2] = polar(59, p + PLACES / 2); return el("line", { class: "or-syzygy", x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2) }); };

/**
 * The orrery: these places, with extra: { rot ({ ring, deg }: a ring drawn turned), lined (squares to ring),
 * coming ([{ at, colour }]: foretold planets, where they'll land), fresh (planets just landed), comet (or null),
 * doomed (planets the comet would sweep), syzygy (diameters to draw) }.
 */
function drawBoard(places, extra = {}) {
  const svg = $("board");
  const orbits = RADII.map((_, r) => el("g", { "data-ring": r, transform: extra.rot?.ring === r ? `rotate(${extra.rot.deg.toFixed(2)})` : null }));
  places.forEach((c, i) => { if (c >= 0) orbits[ringOf(i)].append(planetEl(c, i, extra.lined?.includes(i) ? "lined" : extra.doomed?.includes(i) ? "doomed" : extra.fresh?.includes(i) ? "fresh" : "")); });
  const fore = el("g", { class: "or-fore" });
  for (const { at, colour } of extra.coming || []) {
    const [x, y] = pos(at), r = size(ringOf(at));
    fore.append(el("circle", { class: `or-foretold k${colour}`, cx: x.toFixed(2), cy: y.toFixed(2), r: r + .2 }));
  }
  const rings = el("g", {});
  for (const i of extra.lined || []) {
    const [x, y] = pos(i), r = size(ringOf(i));
    // a planet on the ring being turned is drawn turned with it
    const turning = extra.rot?.ring === ringOf(i);
    rings.append(el("circle", { class: `or-lined${turning ? " turning" : ""}`, cx: x.toFixed(2), cy: y.toFixed(2), r: r + 1.3, transform: turning ? `rotate(${extra.rot.deg.toFixed(2)})` : null }));
  }
  const comet = extra.comet === undefined ? S.comet : extra.comet;
  svg.replaceChildren(face(), ...(extra.syzygy || []).map(syzygyEl), comet ? cometEl(comet) : "", fore, ...orbits, rings, el("g", { id: "fx" }));
}
const comingAt = s => s.coming.map(c => ({ at: c.ring * PLACES + c.place, colour: c.colour }));
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  $("room").textContent = S.places.filter(c => c < 0).length;
}
function drawSide(text) {
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `No room left in the heavens: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  const first = !read(SEEN, false) && S.turns < 3, c = S.comet;
  $("line").textContent = text ?? (first ? "Drag a ring round a place: three of a colour on one spoke is a conjunction, and they clear"
    : `${S.coming.length === 1 ? "A planet is" : `${S.coming.length} planets are`} foretold, dashed where ${S.coming.length === 1 ? "it lands" : "they land"}; ${c.in <= 1 ? "the comet comes down its spoke this turn" : `the comet comes in ${c.in} turns`}`);
}
function render() { drawBoard(S.places, { coming: comingAt(S) }); drawStrip(); drawSide(); }

// ---------- dragging a ring ----------
function pointIn(px, py) { const m = $("board").getScreenCTM(); return m ? new DOMPoint(px, py).matrixTransform(m.inverse()) : null; }
/** The ring under a point on the screen, or -1. */
function ringAt(px, py) {
  const p = pointIn(px, py);
  if (!p) return -1;
  const d = Math.hypot(p.x, p.y), k = RADII.reduce((b, r, j) => (Math.abs(r - d) < Math.abs(RADII[b] - d) ? j : b), 0);
  return Math.abs(RADII[k] - d) <= 6.5 ? k : -1;
}
const degAt = (px, py) => { const p = pointIn(px, py); return p ? (Math.atan2(p.y, p.x) * 180) / Math.PI : 0; };
/** The turn a drag shows: the ring drawn where the finger has it, what the turn would clear and where the foretold land. */
function showGrab() {
  const { ring, deg, by } = grab;
  if (!by) { drawBoard(S.places, { rot: { ring, deg }, coming: comingAt(S) }); drawSide(); return; }
  const r = turn(S, { ring, by }), back = i => (ringOf(i) === ring ? ring * PLACES + ((placeOf(i) - by + PLACES) % PLACES) : i);
  // the cleared places are counted after the turn; on the turned ring they're drawn before it, turned with the finger
  const lined = [...r.first, ...r.then.filter(i => !r.landed.some(l => l.at === i))].map(back);
  const doomed = r.swept.filter(i => !r.landed.some(l => l.at === i)).map(back);
  drawBoard(S.places, { rot: { ring, deg }, lined, doomed, syzygy: r.syzygy, coming: r.landed.map(l => ({ at: l.at, colour: l.colour })) });
  const n = r.first.length + r.then.length;
  drawSide(`Turning ${RING_NAMES[ring]} ${by > 0 ? "clockwise" : "back"}: ${n ? `${n} planets in conjunction${r.syzygy.length ? ", a syzygy, doubled" : ""}, +${fmt(r.gain)}` : "no conjunction"}${r.swept.length ? `; the comet sweeps ${r.swept.length}` : ""}`);
}
$("board").addEventListener("pointerdown", e => {
  if (playing || S.over || e.button > 0) return;
  const ring = ringAt(e.clientX, e.clientY);
  if (ring < 0) return;
  e.preventDefault();
  grab = { id: e.pointerId, ring, a0: degAt(e.clientX, e.clientY), deg: 0, by: 0 };
  try { $("board").setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
});
addEventListener("pointermove", e => {
  if (!grab || e.pointerId !== grab.id) return;
  const d = ((degAt(e.clientX, e.clientY) - grab.a0 + 540) % 360) - 180, deg = Math.max(-STEP, Math.min(STEP, d));
  const by = Math.abs(deg) >= SNAP ? Math.sign(deg) : 0, changed = by !== grab.by;
  grab.deg = deg;
  grab.by = by;
  if (changed) showGrab();
  else {
    // only the ring moves with the finger; what it would do is redrawn when it would do something else
    for (const g of $("board").querySelectorAll(`[data-ring="${grab.ring}"], .or-lined.turning`)) g.setAttribute("transform", `rotate(${deg.toFixed(2)})`);
  }
});
addEventListener("pointerup", e => {
  if (!grab || e.pointerId !== grab.id) return;
  const { ring, by, deg } = grab;
  grab = null;
  if (by) commit({ ring, by }, deg);
  else render();
});
addEventListener("pointercancel", e => { if (grab?.id === e.pointerId) { grab = null; render(); } });

// ---------- a turn ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
async function commit(move, from = 0) {
  if (playing || S.over) return;
  playing = true;
  const before = S, r = turn(S, move);
  S = r.state;
  save();
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.turns >= 3) write(SEEN, true);
  drawStrip();
  // the ring settles into its new place
  drawBoard(before.places, { rot: { ring: move.ring, deg: from }, coming: comingAt(before), comet: before.comet });
  await animate($("board").querySelector(`[data-ring="${move.ring}"]`), [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${move.by * STEP}deg)` }], { duration: 140, easing: "ease-out" });
  const node = i => $("board").querySelector(`[data-cell="${i}"] > g`), fade = i => animate(node(i), [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.6)", opacity: 0 }], { duration: 320, easing: "ease-in" });
  // the turn's conjunctions go
  let places = turned(before.places, move.ring, move.by);
  if (r.first.length) {
    drawBoard(places, { lined: r.first, coming: comingAt(before), comet: before.comet });
    await Promise.all(r.first.map(fade));
    for (const i of r.first) places[i] = -1;
  }
  // the foretold land (from their foretold place, if they had to move on)
  for (const l of r.landed) places[l.at] = l.colour;
  drawBoard(places, { fresh: r.landed.map(l => l.at), comet: before.comet });
  await Promise.all(r.landed.map(l => {
    const [fx, fy] = pos(l.ring * PLACES + l.place), [tx, ty] = pos(l.at);
    return animate(node(l.at), [{ transform: `translate(${(fx - tx).toFixed(2)}px, ${(fy - ty).toFixed(2)}px) scale(.3)`, opacity: .2 }, { transform: "translate(0, 0) scale(1)", opacity: 1 }], { duration: 300, easing: "ease-out" });
  }));
  // and the conjunctions they make
  if (r.then.length) {
    drawBoard(places, { lined: r.then, comet: before.comet });
    await Promise.all(r.then.map(fade));
    for (const i of r.then) places[i] = -1;
  }
  if (r.syzygy.length) {
    drawBoard(places, { syzygy: r.syzygy, comet: before.comet });
    await wait(520);
  }
  // the comet comes in down its spoke, and what stood on it is gone
  if (r.swept.length || before.comet.in <= 1) {
    drawBoard(places, { doomed: r.swept, comet: before.comet });
    const head = $("board").querySelector(".or-comet-body");
    const [dx, dy] = polar(63.2 - SUN, before.comet.spoke);
    await Promise.all([animate(head, [{ transform: "translate(0, 0)", opacity: 1 }, { transform: `translate(${(-dx).toFixed(2)}px, ${(-dy).toFixed(2)}px)`, opacity: .2 }], { duration: 420, easing: "ease-in" }),
      ...r.swept.map(i => animate(node(i), [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.2)", opacity: 0 }], { duration: 320, delay: 140, easing: "ease-in" }))]);
  }
  render();
  if (r.gain) popup([...r.first, ...r.then], r.gain, r.syzygy.length);
  playing = false;
}
function popup(cells, gain, syzygy) {
  const fx = $("board").querySelector("#fx"), pts = cells.map(pos);
  const t = el("text", { class: `or-pop${cells.length >= 6 || syzygy ? " big" : ""}`, x: (pts.reduce((a, p) => a + p[0], 0) / pts.length).toFixed(1), y: (pts.reduce((a, p) => a + p[1], 0) / pts.length).toFixed(1) });
  t.textContent = `+${fmt(gain)}${syzygy ? " syzygy" : ""}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 1000, easing: "ease-out" });
}

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("New game", newRun, "primary"));
  const best = read(BEST, 0);
  part(body, "about").append(line(`This game: ${fmt(S.score)} in ${S.turns} turn${S.turns === 1 ? "" : "s"}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "orrery");
document.querySelector(".or-mark").innerHTML = APPS.find(a => a.id === "orrery").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", newRun);

// for tests and debugging
window.__orrery = { get state() { return S; }, commit, ringAt, newRun };

S = read(RUN, null);
if (!valid(S)) newRun();
else { S = upgrade(S); render(); }
