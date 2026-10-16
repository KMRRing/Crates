// Netting: six trading houses round a table, arrows for what each owes another. Drag one of the three new obligations
// from its debtor onto the house it's to be owed to; while it's held over a house, the loops it would net are lit and
// what they'd score is shown, or the default it would cause. Let go on a house to book it (or tap the obligation, then
// the house). The rules are netting-engine.js's; this file draws the table, plays each booking out and keeps the game.
import { HOUSES, N, LIMIT, LIVES, newGame, book, net, owed, worth, largest } from "./netting-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "netting:run", BEST = "netting:best", SEEN = "netting:seen";
const R = 36, DISC = 8.5;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");

let S = null;            // the game (netting-engine.js's), as saved
let playing = false;     // a booking being played out
let drag = null;         // an obligation in hand: { slot, from, amount, id, x0, y0, moved, to, at ([x, y] on the table) }
let picked = -1;         // an obligation tapped, to book with a tap on a house

const valid = g => g && g.v === 1 && Array.isArray(g.owes) && g.owes.length === N * N && Array.isArray(g.hand) && g.hand.length === 3;
function save() { write(RUN, S); }
function newRun() { S = newGame(Math.floor(Math.random() * 2 ** 31)); drag = null; picked = -1; save(); render(); }

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const pos = k => { const a = ((-90 + 60 * k) * Math.PI) / 180; return [R * Math.cos(a), R * Math.sin(a)]; };
const text = (cls, x, y, t) => { const n = el("text", { class: cls, x: x.toFixed(2), y: y.toFixed(2) }); n.textContent = t; return n; };
/** An arrow from house i to a point, or to house j: its line, its head, and the amount on it, nearer the debtor. */
function arrowEl(i, [tx, ty], amount, cls = "", toHouse = true) {
  const [fx, fy] = pos(i), dx = tx - fx, dy = ty - fy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const sx = fx + ux * (DISC + 1), sy = fy + uy * (DISC + 1), ex = tx - ux * (toHouse ? DISC + 2.6 : 0), ey = ty - uy * (toHouse ? DISC + 2.6 : 0);
  const head = `M${(ex + ux * 2.6).toFixed(2)} ${(ey + uy * 2.6).toFixed(2)}L${(ex - uy * 1.6).toFixed(2)} ${(ey + ux * 1.6).toFixed(2)}L${(ex + uy * 1.6).toFixed(2)} ${(ey - ux * 1.6).toFixed(2)}Z`;
  const lx = sx + (ex - sx) * .42, ly = sy + (ey - sy) * .42;
  return el("g", { class: `nt-arrow ${cls}`.trim() },
    el("line", { x1: sx.toFixed(2), y1: sy.toFixed(2), x2: ex.toFixed(2), y2: ey.toFixed(2), "stroke-width": (.5 + .3 * amount).toFixed(2) }), el("path", { d: head }),
    el("circle", { class: "nt-chip", cx: lx.toFixed(2), cy: ly.toFixed(2), r: 2.9 }), text("nt-amount", lx, ly, amount));
}
/** A house: its disc, its name, what it owes of its limit, and a gauge round it that reddens near the limit. */
function houseEl(k, owes, cls = "") {
  const [x, y] = pos(k), o = owed(owes, k), share = Math.min(1, o / LIMIT), g = el("g", { class: `nt-house ${cls}`.trim(), "data-house": k, transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` });
  g.append(el("circle", { class: "nt-disc", r: DISC }));
  if (share > 0) {
    const a = 2 * Math.PI * share - 1e-4, r = DISC + 1.2, ex = r * Math.sin(a), ey = -r * Math.cos(a);
    g.append(el("path", { class: `nt-gauge${o >= LIMIT - 2 ? " near" : ""}`, d: `M0 ${-r}A${r} ${r} 0 ${share > .5 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}` }));
  }
  g.append(text("nt-name", 0, -.6, HOUSES[k]), text("nt-owed", 0, 4.2, `${o}/${LIMIT}`));
  return g;
}
/**
 * The table: what's owed (or extra.owes), with extra: { lit (loops to light: [[houses round]]), pending ({ from, to,
 * at, amount }: an obligation held over the table), tag ([text, house]), from (the debtor in hand), flash (a house
 * defaulting) }.
 */
function drawBoard(extra = {}) {
  const owes = extra.owes || S.owes, lit = new Set();
  for (const loop of extra.lit || []) for (let k = 0; k + 1 < loop.length; k++) lit.add(loop[k] * N + loop[k + 1]);
  const arrows = el("g", {});
  owes.forEach((a, e) => { if (a > 0) arrows.append(arrowEl(Math.floor(e / N), pos(e % N), a, lit.has(e) ? "lit" : "")); });
  const p = extra.pending;
  if (p) arrows.append(arrowEl(p.from, p.to >= 0 ? pos(p.to) : p.at, p.amount, `pending${lit.has(p.from * N + p.to) ? " lit" : ""}`, p.to >= 0));
  const houses = el("g", {});
  for (let k = 0; k < N; k++) houses.append(houseEl(k, owes, k === extra.flash ? "flash" : k === extra.from ? "debtor" : k === p?.to ? "creditor" : ""));
  const marks = el("g", {});
  if (extra.tag) { const [x, y] = pos(extra.tag[1]); marks.append(text("nt-tag", x, y < 0 ? y + DISC + 6.5 : y - DISC - 3.5, extra.tag[0])); }
  $("board").replaceChildren(el("circle", { class: "nt-table", r: 49 }), arrows, houses, marks, el("g", { id: "fx" }));
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  const lives = $("lives");
  lives.replaceChildren(...Array.from({ length: LIVES }, (_, k) => { const i = document.createElement("i"); if (k < S.lives) i.className = "on"; return i; }));
  lives.setAttribute("aria-label", `${S.lives} of ${LIVES} lives`);
}
function drawSide(textLine) {
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  $("line").hidden = S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `A third default: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  const first = !read(SEEN, false) && S.booked < 3, most = [...Array(N).keys()].sort((a, b) => owed(S.owes, b) - owed(S.owes, a))[0];
  $("line").textContent = textLine ?? (first ? "Drag an obligation onto the house it's owed to: a loop back round to its debtor nets out, and scores"
    : `Obligations of 1 to ${largest(S.hands - 1)} now; ${owed(S.owes, most) ? `${HOUSES[most]} owes most, ${owed(S.owes, most)} of ${LIMIT}` : "nobody owes anything"}`);
  for (const b of document.querySelectorAll(".nt-card")) {
    const slot = Number(b.dataset.slot), h = S.hand[slot];
    b.disabled = !h;
    b.classList.toggle("picked", slot === picked);
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    b.replaceChildren(...(h ? [Object.assign(document.createElement("b"), { textContent: h.amount }), Object.assign(document.createElement("span"), { textContent: `owed by ${HOUSES[h.from]}` })] : []));
    b.setAttribute("aria-label", h ? `${HOUSES[h.from]} owes ${h.amount}: drag it onto the house it's owed to` : "Booked");
  }
}
function render() { drawBoard({ from: picked >= 0 ? S.hand[picked]?.from : undefined }); drawStrip(); drawSide(); }

/** What booking an obligation to a house would do, shown on the table and in the line. */
function show(slot, to, at) {
  const h = S.hand[slot];
  if (to < 0) { drawBoard({ pending: { from: h.from, to: -1, at, amount: h.amount }, from: h.from }); drawSide(`${HOUSES[h.from]} owes ${h.amount}: to whom?`); return; }
  const r = book(S, slot, to), after = owed(net(Object.assign(S.owes.slice(), { [h.from * N + to]: S.owes[h.from * N + to] + h.amount }), h.from, to).owes, h.from);
  drawBoard({ pending: { from: h.from, to, amount: h.amount }, lit: r.loops.map(l => l.houses), tag: r.gain ? [`+${fmt(r.gain)}`, to] : null, from: h.from });
  drawSide(r.defaulted >= 0 ? `${HOUSES[h.from]} would owe ${after} of ${LIMIT}, and default`
    : r.gross ? `${r.loops.length === 1 ? `A loop of ${r.loops[0].houses.length - 1}` : `${r.loops.length} loops`} nets out ${r.gross}: +${fmt(r.gain)}`
      : `No loop: ${HOUSES[h.from]} would owe ${after} of ${LIMIT}`);
}

// ---------- booking ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
async function commit(slot, to) {
  if (playing || S.over) return;
  playing = true;
  picked = -1;
  const before = S, r = book(S, slot, to);
  S = r.state;
  save();
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.booked >= 3) write(SEEN, true);
  // booked, then each loop lit and netted, then a default written off
  const booked = before.owes.slice();
  booked[r.from * N + to] += r.amount;
  drawBoard({ owes: booked });
  drawStrip();
  drawSide(" ");
  if (r.loops.length) {
    drawBoard({ owes: booked, lit: r.loops.map(l => l.houses) });
    await wait(420);
    drawBoard({ owes: net(booked, r.from, to).owes });
    popup(r.loops.flatMap(l => l.houses), r.gain);
    await wait(380);
  }
  if (r.defaulted >= 0) {
    drawBoard({ owes: net(booked, r.from, to).owes, flash: r.defaulted });
    toast(S.over ? `${HOUSES[r.defaulted]} defaults: a third default` : `${HOUSES[r.defaulted]} defaults: its debts written off, ${S.lives} ${S.lives === 1 ? "life" : "lives"} left`);
    await wait(650);
  }
  render();
  if (r.dealt && !S.over) for (const b of document.querySelectorAll(".nt-card")) animate(b, [{ transform: "scale(.85)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 220, easing: "ease-out" });
  playing = false;
}
function popup(houses, gain) {
  const fx = $("board").querySelector("#fx"), u = [...new Set(houses)].map(pos);
  const t = text(`nt-pop${gain >= 1000 ? " big" : ""}`, u.reduce((a, p) => a + p[0], 0) / u.length, u.reduce((a, p) => a + p[1], 0) / u.length, `+${fmt(gain)}`);
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-10px)", opacity: 0 }], { duration: 1100, easing: "ease-out" });
}

// ---------- dragging an obligation ----------
const pointIn = (px, py) => { const m = $("board").getScreenCTM(); return m ? new DOMPoint(px, py).matrixTransform(m.inverse()) : null; };
/** The house under a point on the screen, or -1. */
function houseAt(px, py) {
  const p = pointIn(px, py);
  if (!p) return -1;
  for (let k = 0; k < N; k++) { const [x, y] = pos(k); if (Math.hypot(p.x - x, p.y - y) <= DISC + 3.5) return k; }
  return -1;
}
function startDrag(e, slot) {
  const h = S.hand[slot];
  if (playing || S.over || !h || e.button > 0) return;
  e.preventDefault();
  drag = { slot, from: h.from, amount: h.amount, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, to: -1 };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.moved = true; picked = -1; drawSide(); }
  if (!drag.moved) return;
  const k = houseAt(e.clientX, e.clientY), to = k === drag.from ? -1 : k, p = pointIn(e.clientX, e.clientY);
  if (to === drag.to && to >= 0) return;
  drag.to = to;
  show(drag.slot, to, p ? [p.x, p.y] : pos(drag.from));
}
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { slot, to, moved } = drag;
  drag = null;
  if (moved && to >= 0) { commit(slot, to); return; }
  // a tap: the obligation picked up (or put down), to book with a tap on a house
  if (!moved) picked = picked === slot ? -1 : slot;
  render();
}
/** A tap on a house with an obligation picked up books it there; a mouse over a house shows it first. */
function tapBoard(e) {
  if (playing || S.over || drag || picked < 0) return;
  const k = houseAt(e.clientX, e.clientY), h = S.hand[picked];
  if (k < 0 || !h) return;
  if (k === h.from) { toast("An obligation is owed to another house"); return; }
  commit(picked, k);
}
function hoverBoard(e) {
  if (e.pointerType !== "mouse" || picked < 0 || drag || playing || !S.hand[picked]) return;
  const k = houseAt(e.clientX, e.clientY), to = k === S.hand[picked].from ? -1 : k;
  if (to >= 0) show(picked, to);
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
  part(body, "about").append(line(`This game: ${fmt(S.score)}, ${S.netted} netted in ${S.booked} booking${S.booked === 1 ? "" : "s"}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "netting");
document.querySelector(".nt-mark").innerHTML = APPS.find(a => a.id === "netting").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".nt-card")) b.addEventListener("pointerdown", e => startDrag(e, Number(b.dataset.slot)));
addEventListener("pointermove", moveDrag);
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", e => { if (drag?.id === e.pointerId) { drag = null; render(); } });
$("board").addEventListener("pointerup", tapBoard);
$("board").addEventListener("pointermove", hoverBoard);
$("againBtn").addEventListener("click", newRun);

// for tests and debugging
window.__netting = { get state() { return S; }, commit, houseAt, newRun };

S = read(RUN, null);
if (!valid(S)) newRun();
else render();
