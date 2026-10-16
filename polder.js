// Polder: a sea eight squares by eight, the coast along its foot, open sea beyond its other sides. Drag one of the
// three dyke pieces onto the water; while it's held where it fits, the water it would cut off from the open sea is
// shown as farmland and the dykes that would go with it are ringed. Let go and it's laid: the polder drains and
// clears. The rules are polder-engine.js's; this file draws the sea, plays each piece out and keeps the game.
import { N, PIECES, DYKE, SILT, newGame, cover, lay, fitsAnywhere, siltEvery } from "./polder-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "polder:run", BEST = "polder:best", SEEN = "polder:seen";
const CELL = 10;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");

let S = null;            // the game (polder-engine.js's), as saved
let playing = false;     // a piece being played out
let drag = null;         // the piece in hand: { slot, id, x0, y0, moved, lift, at (where it would go), float }

const valid = g => g && g.v === 1 && Array.isArray(g.cells) && g.cells.length === N * N && Array.isArray(g.hand) && g.hand.length === 3;
function save() { write(RUN, S); }
function newRun() {
  drag?.float.remove();
  drag = null;
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
/** A square of dyke: an earth bank, grass along its crest; placed by an outer group so its own can move. */
function dykeEl(x, y, cls = "", cell = null) {
  return el("g", { transform: `translate(${x} ${y})`, "data-cell": cell },
    el("g", { class: `pd-dyke ${cls}`.trim() }, el("rect", { x: .4, y: .4, width: 9.2, height: 9.2, rx: 1.3 }), el("path", { class: "pd-tuft", d: "M2.6 6.6l.9-2 .9 2M5.4 4.6l.9-2 .9 2" })));
}
function siltEl(x, y, cell = null) {
  return el("g", { transform: `translate(${x} ${y})`, "data-cell": cell },
    el("g", { class: "pd-silt-sq" }, el("rect", { x: .6, y: .6, width: 8.8, height: 8.8, rx: 2.2 }),
      ...[[3, 3.2], [6.6, 4.4], [4.4, 6.8], [7.2, 7.4]].map(([cx, cy]) => el("circle", { cx, cy, r: .55 }))));
}
function farmEl(x, y) {
  return el("g", { transform: `translate(${x} ${y})` }, el("g", { class: "pd-farm" }, el("rect", { width: 10, height: 10 }), el("path", { d: "M1 2.5H9M1 5H9M1 7.5H9" })));
}
/** Where two dykes touch only at a corner they hold the water back: a knot of earth shows it. */
function seals(cells) {
  const g = el("g", { class: "pd-seals" }), d = (x, y) => cells[y * N + x] === DYKE;
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
    const a = d(x, y), b = d(x + 1, y), c = d(x, y + 1), e = d(x + 1, y + 1);
    if ((a && e && !b && !c) || (b && c && !a && !e)) {
      const cx = (x + 1) * CELL, cy = (y + 1) * CELL;
      g.append(el("path", { d: `M${cx} ${cy - 2}L${cx + 2} ${cy}L${cx} ${cy + 2}L${cx - 2} ${cy}Z` }));
    }
  }
  return g;
}

/**
 * The sea: as it stands, or with extra: { cells (a sea to draw instead), farm (squares drained), fresh (dykes just
 * laid), ghost ({ laid, water, banks }: a piece held over the sea, what it would drain and clear) }.
 */
function drawBoard(extra = {}) {
  const svg = $("board"), cells = extra.cells || S.cells, ghost = extra.ghost;
  const back = el("g", {},
    el("rect", { class: "pd-deep", x: -3, y: -3, width: 86, height: 86 }),
    el("path", { class: "pd-wave", d: Array.from({ length: 8 }, (_, k) => `M${k * 10 + 2.2} -1.1q1.4-1.1 2.8 0t2.8 0`).join("") }),
    el("rect", { class: "pd-water", x: 0, y: 0, width: 80, height: 80 }),
    el("rect", { class: "pd-land", x: -3, y: 80, width: 86, height: 8 }),
    el("rect", { class: "pd-sand", x: -3, y: 80, width: 86, height: 1.8 }));
  const grid = el("g", { class: "pd-grid" });
  for (let k = 1; k < N; k++) grid.append(el("line", { x1: k * CELL, x2: k * CELL, y1: 0, y2: 80 }), el("line", { y1: k * CELL, y2: k * CELL, x1: 0, x2: 80 }));
  const land = el("g", { id: "land" });
  const farm = new Set([...(extra.farm || []), ...(ghost?.water || [])]);
  for (const i of farm) land.append(farmEl(...at(i)));
  const shown = cells.slice();
  for (const i of ghost?.laid || []) shown[i] = DYKE;
  shown.forEach((c, i) => {
    if (c === SILT && !farm.has(i)) land.append(siltEl(...at(i), i));
    if (c === DYKE) land.append(dykeEl(...at(i), ghost?.laid.includes(i) ? "ghost" : extra.fresh?.includes(i) ? "fresh" : "", i));
  });
  const marks = el("g", {});
  for (const i of ghost?.banks || []) marks.append(el("rect", { class: "pd-ring", x: at(i)[0] + .2, y: at(i)[1] + .2, width: 9.6, height: 9.6, rx: 1.6 }));
  const kids = [back, grid, land, seals(shown), marks, el("g", { id: "fx" })];
  if (!read(SEEN, false) && S.laid < 3 && !ghost && !S.over) {
    kids.push(el("g", { class: "pd-hint" }, ...["Drag a dyke onto the water:", "water cut off from the open", "sea drains, its dykes with it"].map((t, k) => {
      const n = el("text", { x: 40, y: 34 + k * 6 });
      n.textContent = t;
      return n;
    })));
  }
  svg.replaceChildren(...kids);
}
/** A piece drawn on its own, a square to every ten units, centred in a box five squares wide. */
function pieceSvg(name, box = 5) {
  const p = PIECES[name], ox = ((box - p.w) * CELL) / 2, oy = ((box - p.h) * CELL) / 2;
  return el("svg", { viewBox: `0 0 ${box * CELL} ${box * CELL}`, "aria-hidden": "true" }, ...p.cells.map(([x, y]) => dykeEl(ox + x * CELL, oy + y * CELL)));
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  const pips = $("silt"), of = Math.max(S.untilSilt, siltEvery(S.laid));
  pips.replaceChildren(...Array.from({ length: of }, (_, k) => { const i = document.createElement("i"); if (k < S.untilSilt) i.className = "on"; return i; }));
  pips.setAttribute("aria-label", `Silt in ${S.untilSilt} piece${S.untilSilt === 1 ? "" : "s"}`);
}
function drawTray() {
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `No room for a dyke: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  for (const b of document.querySelectorAll(".pd-piece")) {
    const slot = Number(b.dataset.slot), name = S.hand[slot];
    b.replaceChildren(...(name ? [pieceSvg(name)] : []));
    b.disabled = !name;
    b.classList.toggle("cant", !!name && !fitsAnywhere(S.cells, name));
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    b.setAttribute("aria-label", name ? `A dyke of ${PIECES[name].cells.length}: drag it onto the water` : "Laid");
  }
}
function render(extra) { drawBoard(extra); drawStrip(); drawTray(); }

// ---------- laying a piece ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
async function commit(slot, x, y) {
  if (playing || S.over) return;
  playing = true;
  const before = S, r = lay(S, slot, x, y);
  S = r.state;
  save();
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.laid >= 3) write(SEEN, true);
  // first the piece laid and the polder it closes drained into farmland; then the farmland and its dykes go
  const mid = before.cells.slice();
  for (const i of r.laid) mid[i] = DYKE;
  render({ cells: mid, farm: r.water, fresh: r.laid });
  const node = i => $("board").querySelector(`#land [data-cell="${i}"] > g`);
  for (const i of r.laid) animate(node(i), [{ transform: "scale(1.25)", opacity: .4 }, { transform: "scale(1)", opacity: 1 }], { duration: 160, easing: "ease-out" });
  for (const n of $("board").querySelectorAll(".pd-farm")) animate(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 120 });
  await wait(r.water.length ? 480 : 170);
  render();
  const fx = $("board").querySelector("#fx");
  if (r.water.length) {
    for (const i of r.water) { const f = farmEl(...at(i)); fx.append(f); animate(f.firstChild, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 }).then(() => f.remove()); }
    for (const i of r.banks) { const d = dykeEl(...at(i)); fx.append(d); animate(d.firstChild, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.6)" }], { duration: 360, easing: "ease-in" }).then(() => d.remove()); }
    popup(fx, r.water, r.gain);
  }
  for (const i of r.silted) animate(node(i), [{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1)" }], { duration: 320, delay: r.water.length ? 260 : 0, easing: "ease-out" });
  if (r.dealt && !S.over) for (const b of document.querySelectorAll(".pd-piece svg")) animate(b, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 220, easing: "ease-out" });
  await wait(r.water.length || r.silted.length ? 320 : 120);
  playing = false;
}
function popup(fx, cells, gain) {
  const x = cells.reduce((a, i) => a + at(i)[0], 0) / cells.length + CELL / 2, y = cells.reduce((a, i) => a + at(i)[1], 0) / cells.length + CELL / 2;
  const t = el("text", { class: `pd-pop${cells.length >= 6 ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = `+${fmt(gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 1000, delay: 100, easing: "ease-out" });
}

// ---------- dragging ----------
const screenCell = () => ($("board").getBoundingClientRect().width / 86) * CELL;
/** Where a piece held with its middle at a point on the screen would go, or null if it doesn't fit there. */
function spotAt(name, px, py) {
  const m = $("board").getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(px, py).matrixTransform(m.inverse()), { w, h } = PIECES[name];
  const x = Math.round(p.x / CELL - w / 2), y = Math.round(p.y / CELL - h / 2);
  return cover(S.cells, name, x, y) ? { x, y } : null;
}
function floatEl(name) {
  const d = document.createElement("div"), size = screenCell(), { w, h } = PIECES[name];
  d.className = "pd-float";
  d.style.width = `${size * w}px`;
  d.style.height = `${size * h}px`;
  const svg = el("svg", { viewBox: `0 0 ${w * CELL} ${h * CELL}`, "aria-hidden": "true" }, ...PIECES[name].cells.map(([x, y]) => dykeEl(x * CELL, y * CELL)));
  d.append(svg);
  document.body.append(d);
  return d;
}
function startDrag(e, slot) {
  const name = S.hand[slot];
  if (playing || S.over || !name || e.button > 0) return;
  e.preventDefault();
  if (!fitsAnywhere(S.cells, name)) { toast("That piece fits nowhere now"); return; }
  drag?.float.remove();
  // held above the finger, its foot a square clear of it, so where it's going is in sight (a mouse needs no lift)
  const lift = e.pointerType === "mouse" ? 0 : Math.max(48, screenCell() * (PIECES[name].h / 2 + .9));
  drag = { slot, name, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, lift, at: null, float: floatEl(name) };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  moveDrag(e);
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.moved = true; drawTray(); }
  const px = e.clientX, py = e.clientY - (drag.moved ? drag.lift : 0), spot = drag.moved ? spotAt(drag.name, px, py) : null;
  const f = drag.float, { w, h } = PIECES[drag.name], size = screenCell();
  f.style.left = `${px - (size * w) / 2}px`;
  f.style.top = `${py - (size * h) / 2}px`;
  f.style.visibility = drag.moved && !spot ? "visible" : "hidden";   // where it fits it's drawn in its place
  if (spot?.x === drag.at?.x && spot?.y === drag.at?.y && drag.drawn) return;
  drag.at = spot;
  drag.drawn = true;
  if (!spot) { drawBoard(); return; }
  const r = lay(S, drag.slot, spot.x, spot.y);
  drawBoard({ ghost: { laid: r.laid, water: r.water, banks: r.banks } });
}
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { slot, at: spot } = drag;
  drag.float.remove();
  drag = null;
  if (spot) commit(slot, spot.x, spot.y);
  else render();
}
function cancelDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  drag.float.remove();
  drag = null;
  render();
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
  part(body, "about").append(line(`This game: ${fmt(S.score)} with ${S.laid} dyke${S.laid === 1 ? "" : "s"} laid${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "polder");
document.querySelector(".pd-mark").innerHTML = APPS.find(a => a.id === "polder").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".pd-piece")) b.addEventListener("pointerdown", e => startDrag(e, Number(b.dataset.slot)));
addEventListener("pointermove", moveDrag);
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", cancelDrag);
$("againBtn").addEventListener("click", newRun);
addEventListener("resize", () => { if (!playing && !drag) render(); });      // the screen turned

// for tests and debugging
window.__polder = { get state() { return S; }, commit, newRun, spotAt };

S = read(RUN, null);
if (!valid(S)) newRun();
else render();
