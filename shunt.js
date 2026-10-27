// Shunt: a rail yard of six tracks across and six down. Press an arrow at a track's end and the incoming wagon's shove
// is shown (the train rolling up to its first gap, the wagons that would depart ringed); slide along the arrows to see
// each one, let go on one to shove. Three or more alike in a line depart; a full track shoves its far wagon off the
// rails, a life lost, unless it's a scrap flat (grey, never departing), which goes for nothing. The rules are
// shunt-engine.js's; this file draws the yard, plays each shove out and keeps the game.
import { N, LIVES, SCRAP, newGame, roll, shove, track, worth, dropCount } from "./shunt-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "shunt:run", BEST = "shunt:best", SEEN = "shunt:seen", SCRAPPED = "shunt:scrapped";
const CELL = 10, M = 9, SIZE = N * CELL + 2 * M;        // a square, and the ring of arrows round the yard
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const CARGO = ["A grain", "A timber", "A steel", "An oil"];

let S = null;            // the game (shunt-engine.js's), as saved
let playing = false;     // a shove being played out
let aim = null;          // the shove shown: { side, line }
let pressing = null;     // the pointer holding an arrow down

const valid = g => g && g.v === 1 && Array.isArray(g.cells) && g.cells.length === N * N && Array.isArray(g.next);
function save() { write(RUN, S); }
function newRun() { S = newGame(Math.floor(Math.random() * 2 ** 31)); aim = null; save(); render(); }

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const at = i => [M + (i % N) * CELL + CELL / 2, M + Math.floor(i / N) * CELL + CELL / 2];
// each cargo its own mark too, so they're told apart without their colour: grain's ears, timber's log ends, a steel
// beam, oil's drop; and scrap's twisted ends
const MARKS = [
  () => el("path", { class: "sh-mark-line", d: "M-2 2.6V-1M0 2.6V-2.2M2 2.6V-1M-2-1.6V-2.4M0-2.8V-3.3M2-1.6V-2.4" }),
  () => el("g", { class: "sh-mark-fill" }, el("circle", { cx: -1.6, cy: 1.2, r: 1.35 }), el("circle", { cx: 1.6, cy: 1.2, r: 1.35 }), el("circle", { cx: 0, cy: -1.5, r: 1.35 })),
  () => el("path", { class: "sh-mark-line", d: "M-2.6-2.3H2.6M-2.6 2.3H2.6M0-2.3V2.3" }),
  () => el("path", { class: "sh-mark-fill", d: "M0-3.1C1.7-.8 2.4.4 2.4 1.2A2.4 2.4 0 0 1-2.4 1.2C-2.4.4-1.7-.8 0-3.1Z" }),
  () => el("path", { class: "sh-mark-line", d: "M-2.8 2.2L-.6-.2L.4.8M.2 2.6L2.7.4M-1.9-1.3L.4-2.6L2.2-1.9" }),
];
/** A wagon: its body in its cargo's colour, its mark; placed by an outer group so its own can move. */
function wagonEl(c, x, y, cls = "", cell = null) {
  const inner = el("g", { class: `sh-wagon k${c} ${cls}`.trim() }, el("rect", { x: -4, y: -4, width: 8, height: 8, rx: 1.4 }), MARKS[c]());
  return el("g", { transform: `translate(${x} ${y})`, "data-cell": cell }, inner);
}
/** Where a shove comes in from, and which way it rolls. */
const dirOf = side => ({ left: [1, 0], right: [-1, 0], top: [0, 1], bottom: [0, -1] })[side];
const ARROW = { left: "M-2.2-3L2.6 0L-2.2 3Z", right: "M2.2-3L-2.6 0L2.2 3Z", top: "M-3-2.2L0 2.6L3-2.2Z", bottom: "M-3 2.2L0-2.6L3 2.2Z" };
function arrowAt(side, line) {
  const mid = M + line * CELL + CELL / 2;
  return side === "left" ? [M / 2, mid] : side === "right" ? [SIZE - M / 2, mid] : side === "top" ? [mid, M / 2] : [mid, SIZE - M / 2];
}

/** The yard as it stands, or as the shove being shown would leave it before anything departs. */
function drawBoard() {
  const svg = $("board"), r = aim && !S.over ? roll(S, aim) : null, cells = r ? r.cells : S.cells;
  // each track a pair of rails, crossing the others' on the empty squares
  const rails = el("g", { class: "sh-rails" });
  for (let k = 0; k < N; k++) for (const c of [M + k * CELL + CELL / 2 - 1.5, M + k * CELL + CELL / 2 + 1.5]) {
    rails.append(el("line", { x1: M, x2: M + N * CELL, y1: c, y2: c }), el("line", { y1: M, y2: M + N * CELL, x1: c, x2: c }));
  }
  const wagons = el("g", { id: "wagons" });
  cells.forEach((c, i) => { if (c >= 0) wagons.append(wagonEl(c, ...at(i), r && r.departed.includes(i) ? "leaving" : "", i)); });
  const marks = el("g", { class: "sh-marks" });
  if (r) {
    for (const i of r.departed) marks.append(el("rect", { class: "sh-ring", x: at(i)[0] - 4.9, y: at(i)[1] - 4.9, width: 9.8, height: 9.8, rx: 2 }));
    if (r.derailed >= 0) {
      // the wagon that would go off the end, shown beyond it, crossed (a scrap flat isn't: it goes for nothing)
      const [dx, dy] = dirOf(aim.side), [x, y] = at(r.derailed), c = S.cells[r.derailed];
      marks.append(wagonEl(c, x + dx * (CELL - 1), y + dy * (CELL - 1), "off"));
      if (!r.scrapped) marks.append(el("path", { class: "sh-cross", d: `M${x + dx * 9 - 3} ${y + dy * 9 - 3}l6 6m0-6l-6 6` }));
    }
  }
  const arrows = el("g", { class: "sh-arrows" });
  for (const side of ["left", "right", "top", "bottom"]) for (let line = 0; line < N; line++) {
    // red where the track is full, unless what it would send off the far end is scrap
    const [x, y] = arrowAt(side, line), on = aim && aim.side === side && aim.line === line, t = track(side, line);
    const full = t.every(i => S.cells[i] >= 0), scrap = full && S.cells[t[N - 1]] === SCRAP;
    arrows.append(el("path", { class: `sh-arrow${on ? ` on k${S.next[0]}` : ""}${scrap ? " scrap" : full ? " full" : ""}`, d: ARROW[side], transform: `translate(${x} ${y})` }));
  }
  svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
  svg.replaceChildren(el("rect", { class: "sh-bed", x: M, y: M, width: N * CELL, height: N * CELL, rx: 1.5 }), rails, wagons, marks, arrows, el("g", { id: "fx" }));
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  const lives = $("lives");
  lives.replaceChildren(...Array.from({ length: LIVES }, (_, k) => { const p = document.createElement("i"); if (k < S.lives) p.className = "on"; return p; }));
  lives.setAttribute("aria-label", `${S.lives} of ${LIVES} lives`);
}
const smallWagon = (c, cls) => el("svg", { viewBox: "-5 -5 10 10", class: cls, "aria-hidden": "true" }, wagonEl(c, 0, 0));
function drawTray() {
  $("coming").replaceChildren(smallWagon(S.next[0], "now"), smallWagon(S.next[1], "next"));
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `Derailed three times: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  const first = !read(SEEN, false) && S.shoves < 3, r = aim ? roll(S, aim) : null;
  // until a scrap flat has been shoved off, what one is for, while one stands in the yard
  const scrapHint = !read(SCRAPPED, false) && S.cells.includes(SCRAP);
  $("line").textContent = r ? (r.scrapped ? `The scrap flat goes off the end: no life lost${r.departed.length ? `, and ${r.departed.length} wagons depart: +${fmt(worth(r.departed.length))}` : ""}`
    : r.derailed >= 0 ? "That track is full: the far wagon goes off the rails" : r.departed.length ? `${r.departed.length} wagons depart: +${fmt(worth(r.departed.length))}` : `${CARGO[S.next[0]]} wagon onto that track`)
    : first ? "Press an arrow at a track's end and slide along: each shove shows before you let go"
      : scrapHint ? "A scrap flat never departs, but shoved off the end of a full track it costs no life"
        : `The goods train leaves ${dropCount(S.shoves) === 1 ? "a wagon" : `${dropCount(S.shoves)} wagons`} in ${S.untilDrop} shove${S.untilDrop === 1 ? "" : "s"}`;
}
function render() { drawBoard(); drawStrip(); drawTray(); }

// ---------- a shove ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
async function commit(move) {
  if (playing || S.over) return;
  playing = true;
  aim = null;
  const before = S, r = shove(S, move), [dx, dy] = dirOf(move.side);
  S = r.state;
  save();
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.shoves >= 3) write(SEEN, true);
  if (r.scrapped) write(SCRAPPED, true);
  render();
  const fx = $("board").querySelector("#fx"), node = i => $("board").querySelector(`#wagons [data-cell="${i}"] .sh-wagon`);
  const from = f => (f < 0 ? (([x, y]) => [x - dx * CELL, y - dy * CELL])(at(track(move.side, move.line)[0])) : at(f));
  // the train rolls: each wagon from where it stood (the new one from beyond the track's end)
  const ROLL = 190;
  for (const [f, t] of r.moved) {
    const [fx0, fy0] = from(f), [tx, ty] = at(t), dxy = `translate(${fx0 - tx}px, ${fy0 - ty}px)`;
    if (r.departed.includes(t)) {
      // gone from the yard as drawn now: shown rolling in, then leaving
      const g = wagonEl(r.cells[t], tx, ty);
      fx.append(g);
      animate(g.firstChild, [{ transform: dxy }, { transform: "translate(0, 0)" }], { duration: ROLL, easing: "ease-out" })
        .then(() => animate(g.firstChild, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.3)" }], { duration: 260, delay: 60 })).then(() => g.remove());
    } else animate(node(t), [{ transform: dxy }, { transform: "translate(0, 0)" }], { duration: ROLL, easing: "ease-out" });
  }
  // runs that were already standing (a wagon that didn't move but departs)
  for (const i of r.departed) if (!r.moved.some(([, t]) => t === i)) {
    const g = wagonEl(r.cells[i], ...at(i));
    fx.append(g);
    animate(g.firstChild, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.3)" }], { duration: 260, delay: ROLL + 60 }).then(() => g.remove());
  }
  if (r.derailed >= 0) {
    const [x, y] = at(r.derailed), g = wagonEl(before.cells[r.derailed], x, y, "off");
    fx.append(g);
    animate(g.firstChild, [{ transform: "translate(0, 0) rotate(0deg)", opacity: 1 }, { transform: `translate(${dx * 14}px, ${dy * 14 + 6}px) rotate(${dx || dy ? 40 : 0}deg)`, opacity: 0 }], { duration: 420, easing: "ease-in" }).then(() => g.remove());
    if (r.scrapped) toast("Scrap shoved off the end: no life lost");
    else if (!S.over) toast(`Off the rails: ${S.lives} ${S.lives === 1 ? "life" : "lives"} left`);   // at the end the verdict says it
  }
  if (r.gain) popup(fx, r.departed, r.gain);
  // the goods train's wagons set down
  for (const i of r.dropped) animate(node(i), [{ transform: "translateY(-8px) scale(.6)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }], { duration: 240, delay: ROLL + 200, easing: "ease-out" });
  await wait(ROLL + (r.dropped.length ? 460 : 300));
  playing = false;
  if (S.over) roundOver("shunt");
}
function popup(fx, cells, gain) {
  const x = cells.reduce((a, i) => a + at(i)[0], 0) / cells.length, y = cells.reduce((a, i) => a + at(i)[1], 0) / cells.length;
  const t = el("text", { class: `sh-pop${cells.length >= 5 ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = `+${fmt(gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-10px)", opacity: 0 }], { duration: 900, delay: 150, easing: "ease-out" });
}

// ---------- pressing an arrow ----------
/** The shove an arrow under a point on the screen stands for, or null: the ring round the yard, a track's end. */
function moveAt(px, py) {
  const svg = $("board"), m = svg.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(px, py).matrixTransform(m.inverse()), inX = p.x > M && p.x < M + N * CELL, inY = p.y > M && p.y < M + N * CELL;
  const lineX = Math.floor((p.x - M) / CELL), lineY = Math.floor((p.y - M) / CELL);
  if (inY && p.x <= M && p.x > -M) return { side: "left", line: lineY };
  if (inY && p.x >= M + N * CELL && p.x < SIZE + M) return { side: "right", line: lineY };
  if (inX && p.y <= M && p.y > -M) return { side: "top", line: lineX };
  if (inX && p.y >= M + N * CELL && p.y < SIZE + M) return { side: "bottom", line: lineX };
  return null;
}
const same = (a, b) => (a && b ? a.side === b.side && a.line === b.line : a === b);
function point(e) {
  if (playing || S.over) return;
  const m = moveAt(e.clientX, e.clientY);
  if (same(m, aim)) return;
  aim = m;
  drawBoard();
  drawTray();
}
$("board").addEventListener("pointerdown", e => {
  if (playing || S.over || e.button > 0) return;
  const m = moveAt(e.clientX, e.clientY);
  if (!m) return;
  e.preventDefault();
  pressing = e.pointerId;
  point(e);
});
addEventListener("pointermove", e => {
  if (pressing === e.pointerId) point(e);
  else if (pressing == null && e.pointerType === "mouse" && e.target.closest?.("#board")) point(e);   // a mouse shows a shove as it passes
});
addEventListener("pointerup", e => {
  if (pressing !== e.pointerId) return;
  pressing = null;
  const m = moveAt(e.clientX, e.clientY);
  if (m) commit(m);
  else { aim = null; render(); }
});
addEventListener("pointercancel", e => { if (pressing === e.pointerId) { pressing = null; aim = null; render(); } });
$("board").addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && pressing == null && aim) { aim = null; render(); } });

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
  part(body, "about").append(line(`This game: ${fmt(S.score)} in ${S.shoves} shove${S.shoves === 1 ? "" : "s"}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "shunt");
document.querySelector(".sh-mark").innerHTML = APPS.find(a => a.id === "shunt").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", newRun);

// for tests and debugging
window.__shunt = { get state() { return S; }, commit, newRun, moveAt };

S = read(RUN, null);
if (!valid(S)) newRun();
else render();
