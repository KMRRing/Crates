// Settle: six tanks of a tank farm, four grades settling by density. Drag one of the two parcels offered onto a tank
// (or tap it, then the tank); while it's held over a tank, the farm is shown as the parcel would leave it: where it
// settles, what it lifts, the lines that would ship out ringed, or the spill it would cause. Let go to pump it. The
// rules are settle-engine.js's; this file draws the farm, plays each pump out and keeps the game.
import { TANKS, LEVELS, LIVES, NAMES, DENSITY, newGame, pumped, lines, ship, pump, worth } from "./settle-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "settle:run", BEST = "settle:best", SEEN = "settle:seen";
const TW = 10, GAP = 2, LH = 7.4, BASE = 60;   // a tank's width, the gap between, a level's height, the floor
const LETTER = ["W", "F", "D", "N"];
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");

let S = null;            // the game (settle-engine.js's), as saved
let playing = false;     // a pump being played out
let drag = null;         // a parcel offered, held: { slot, id, x0, y0, moved, t }
let picked = -1;         // a parcel tapped, to pump with a tap on a tank

const valid = g => g && g.v === 1 && Array.isArray(g.tanks) && g.tanks.length === TANKS && Array.isArray(g.hand) && g.hand.length === 2;
function save() { write(RUN, S); }
function newRun() { S = newGame(Math.floor(Math.random() * 2 ** 31)); drag = null; picked = -1; save(); render(); }

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const tx = t => t * (TW + GAP), ly = level => BASE - (level + 1) * LH;
/** A parcel: its grade's colour and letter; placed by an outer group so its own can move. */
function parcelEl(g, t, level, cls = "", key = null) {
  const label = el("text", { class: "st-letter", x: TW / 2, y: LH / 2 + .1 });
  label.textContent = LETTER[g];
  return el("g", { transform: `translate(${tx(t)} ${ly(level).toFixed(2)})`, "data-key": key }, el("g", { class: `st-parcel k${g} ${cls}`.trim() }, el("rect", { x: .8, y: .35, width: TW - 1.6, height: LH - .7, rx: 1.1 }), label));
}
/**
 * The farm: these tanks, with extra: { ring ([t, level] parcels to ring), fresh ([t, level]: the parcel pumped), over
 * (a tank shown overflowing), tag ([text, t]), aim (a tank the parcel is held over) }.
 */
function drawBoard(tanks, extra = {}) {
  const shells = el("g", {});
  for (let t = 0; t < TANKS; t++) {
    const x = tx(t);
    shells.append(el("rect", { class: `st-shell${extra.aim === t ? " aim" : ""}`, x, y: ly(LEVELS - 1) - 1.4, width: TW, height: LEVELS * LH + 1.6, rx: 2.2 }),
      el("path", { class: "st-drop", d: `M${x + TW / 2} -6.5V${ly(LEVELS - 1) - 1.4}` }));
  }
  const parcels = el("g", { id: "parcels" });
  tanks.forEach((tank, t) => tank.forEach((g, level) => {
    const fresh = extra.fresh && extra.fresh[0] === t && extra.fresh[1] === level, spill = level >= LEVELS;
    parcels.append(parcelEl(g, t, level, fresh ? "fresh" : spill ? "spill" : "", `${t}:${level}`));
  }));
  const marks = el("g", {});
  for (const [t, level] of extra.ring || []) marks.append(el("rect", { class: "st-ring", x: tx(t) + .25, y: ly(level) - .15, width: TW - .5, height: LH + .3, rx: 1.5 }));
  if (extra.tag) { const t = el("text", { class: "st-tag", x: Math.min(62, Math.max(8, tx(extra.tag[1]) + TW / 2)), y: -8 }); t.textContent = extra.tag[0]; marks.append(t); }
  $("board").replaceChildren(
    el("rect", { class: "st-ground", x: -2, y: BASE, width: 74, height: 3.5, rx: .8 }),
    el("path", { class: "st-header", d: `M-1 -6.5H71` }), shells, parcels, marks, el("g", { id: "fx" }));
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  const lives = $("lives");
  lives.replaceChildren(...Array.from({ length: LIVES }, (_, k) => { const i = document.createElement("i"); if (k < S.lives) i.className = "on"; return i; }));
  lives.setAttribute("aria-label", `${S.lives} of ${LIVES} lives`);
}
function drawSide(text) {
  $("tray").hidden = S.over;
  $("line").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `A third spill: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  const first = !read(SEEN, false) && S.pumps < 3;
  $("line").textContent = text ?? (first ? "Drag a parcel onto a tank: it settles by density, and three of a grade level across neighbouring tanks ship out"
    : `A delivery comes in ${S.untilDelivery === 1 ? "after this pump" : `${S.untilDelivery} pumps`}`);
  for (const b of document.querySelectorAll(".st-card")) {
    const slot = Number(b.dataset.slot), g = S.hand[slot];
    b.classList.toggle("picked", slot === picked);
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    const sw = el("svg", { viewBox: `0 0 ${TW} ${LH}`, class: "st-swatch", "aria-hidden": "true" }, parcelEl(g, 0, -1).firstChild);
    b.replaceChildren(sw, Object.assign(document.createElement("b"), { textContent: NAMES[g] }), Object.assign(document.createElement("span"), { textContent: `${DENSITY[g]} kg/m³` }));
    b.setAttribute("aria-label", `${NAMES[g]}, ${DENSITY[g]} kg per cubic metre: drag it onto a tank`);
  }
}
function render() { drawBoard(S.tanks); drawStrip(); drawSide(); }
/** What pumping the parcel in a slot into a tank would do, shown. */
function show(slot, t) {
  const g = S.hand[slot], level = S.tanks[t].filter(x => x <= g).length, after = pumped(S.tanks, t, g), r = ship(after);
  const n = r.waves.reduce((a, w) => a + w.length, 0), spills = r.tanks[t].length > LEVELS;
  drawBoard(after, { ring: lines(after), fresh: [t, level], aim: t, tag: n ? [`+${fmt(worth(n))}`, t] : null });
  drawSide(spills ? `Tank ${t + 1} would be over full: its ${NAMES[r.tanks[t].at(-1)].toLowerCase()} spills, a life`
    : n ? `${NAMES[g]} into tank ${t + 1}: ${n} parcels ship out${r.waves.length > 1 ? ` in ${r.waves.length} waves` : ""}, +${fmt(worth(n))}`
      : `${NAMES[g]} into tank ${t + 1}: it settles at level ${level + 1}${after[t].length > level + 1 ? `, lifting ${after[t].length - level - 1} above it` : ""}`);
}

// ---------- a pump ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
const node = (t, level) => $("board").querySelector(`[data-key="${t}:${level}"] > g`);
/** Moves drawn parcels from where they stood: [t, level now, level before] (before LEVELS + 1: in from the pipe). */
function slide(moves, ms = 220) {
  return Promise.all(moves.map(([t, now, was]) => animate(node(t, now), [{ transform: `translateY(${((now - was) * LH).toFixed(2)}px)` }, { transform: "translateY(0)" }], { duration: ms, easing: "ease-out" })));
}
/** A parcel settling into a tank: it comes down the pipe, the lighter ones above it rise a level. */
async function settleIn(tanks, t, g) {
  const level = tanks[t].filter(x => x <= g).length, after = pumped(tanks, t, g);
  drawBoard(after, { fresh: [t, level] });
  const rise = [];
  for (let k = level + 1; k < after[t].length; k++) rise.push([t, k, k - 1]);
  await slide([[t, level, LEVELS + 1], ...rise], 260);
  return after;
}
async function commit(slot, t) {
  if (playing || S.over) return;
  playing = true;
  picked = -1;
  const before = S, r = pump(S, slot, t);
  S = r.state;
  save();
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.pumps >= 3) write(SEEN, true);
  drawSide(" ");
  let tanks = await settleIn(before.tanks, t, r.grade);
  // the lines ship out, wave after wave, what floated above dropping into their places
  for (const wave of r.waves) {
    drawBoard(tanks, { ring: wave.map(([a, b]) => [a, b]) });
    await wait(260);
    const fx = $("board").querySelector("#fx");
    for (const [a, b, g] of wave) { const p = parcelEl(g, a, b); fx.append(p); animate(p.firstChild, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-6px)", opacity: 0 }], { duration: 300, easing: "ease-in" }).then(() => p.remove()); }
    const next = tanks.map(x => x.slice()), drops = [];
    for (const [a, b] of [...wave].sort((p, q) => q[1] - p[1])) next[a].splice(b, 1);
    next.forEach((tank, a) => {
      const gone = wave.filter(w => w[0] === a).map(w => w[1]);
      if (!gone.length) return;
      tanks[a].forEach((_, was) => { if (!gone.includes(was)) { const now = was - gone.filter(x => x < was).length; if (now !== was) drops.push([a, now, was]); } });
    });
    tanks = next;
    drawBoard(tanks);
    await slide(drops);
  }
  if (r.gain) popup(r.waves.flat(), r.gain);
  if (r.spilled >= 0) {
    // the parcel over the top runs off
    tanks[t] = tanks[t].slice(0, LEVELS);
    drawBoard(tanks);
    const p = parcelEl(r.spilled, t, LEVELS, "spill");
    $("board").querySelector("#fx").append(p);
    animate(p.firstChild, [{ transform: "translate(0, 0)", opacity: 1 }, { transform: "translate(6px, 10px) rotate(25deg)", opacity: 0 }], { duration: 500, easing: "ease-in" });
    toast(S.over ? "A third spill" : `Tank ${t + 1} spills its ${NAMES[r.spilled].toLowerCase()}: ${S.lives} ${S.lives === 1 ? "life" : "lives"} left`);
    await wait(450);
  }
  drawStrip();
  for (const d of r.delivered) tanks = await settleIn(tanks, d.t, d.g);
  render();
  playing = false;
}
function popup(cells, gain) {
  const fx = $("board").querySelector("#fx");
  const x = cells.reduce((a, c) => a + tx(c[0]) + TW / 2, 0) / cells.length, y = cells.reduce((a, c) => a + ly(c[1]) + LH / 2, 0) / cells.length;
  const t = el("text", { class: `st-pop${cells.length >= 6 ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = `+${fmt(gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 1000, easing: "ease-out" });
}

// ---------- holding a parcel over the farm ----------
/** The tank under a point on the screen (anywhere over its column), or -1. */
function tankAt(px, py) {
  const m = $("board").getScreenCTM();
  if (!m) return -1;
  const p = new DOMPoint(px, py).matrixTransform(m.inverse()), t = Math.floor((p.x + GAP / 2) / (TW + GAP));
  return t >= 0 && t < TANKS && p.y > -11 && p.y < BASE + 4 ? t : -1;
}
function startDrag(e, slot) {
  if (playing || S.over || e.button > 0) return;
  e.preventDefault();
  drag = { slot, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, t: -1 };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.moved = true; picked = -1; drawSide(); }
  if (!drag.moved) return;
  const t = tankAt(e.clientX, e.clientY);
  if (t === drag.t) return;
  drag.t = t;
  if (t >= 0) show(drag.slot, t);
  else { drawBoard(S.tanks); drawSide(); }
}
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { slot, t, moved } = drag;
  drag = null;
  if (moved && t >= 0) { commit(slot, t); return; }
  if (!moved) picked = picked === slot ? -1 : slot;
  render();
}
function tapBoard(e) {
  if (playing || S.over || drag || picked < 0) return;
  const t = tankAt(e.clientX, e.clientY);
  if (t >= 0) commit(picked, t);
}
function hoverBoard(e) {
  if (e.pointerType !== "mouse" || picked < 0 || drag || playing) return;
  const t = tankAt(e.clientX, e.clientY);
  if (t >= 0) show(picked, t);
  else render();
}

// ---------- messages, the menu ----------
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("New game", newRun, "primary"));
  const best = read(BEST, 0);
  part(body, "about").append(line(`This game: ${fmt(S.score)} in ${S.pumps} pump${S.pumps === 1 ? "" : "s"}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "settle");
document.querySelector(".st-mark").innerHTML = APPS.find(a => a.id === "settle").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".st-card")) b.addEventListener("pointerdown", e => startDrag(e, Number(b.dataset.slot)));
addEventListener("pointermove", moveDrag);
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", e => { if (drag?.id === e.pointerId) { drag = null; render(); } });
$("board").addEventListener("pointerup", tapBoard);
$("board").addEventListener("pointermove", hoverBoard);
$("againBtn").addEventListener("click", newRun);

// for tests and debugging
window.__settle = { get state() { return S; }, commit, tankAt, newRun };

S = read(RUN, null);
if (!valid(S)) newRun();
else render();
