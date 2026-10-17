// Drift: a field of tiles and the wind, forecast three turns ahead. Press an empty square and the turn is shown before
// you let go: the tile laid there, the field after the wind has blown, the lines that would clear ringed and what
// the turn would score. Slide to another square to see it; let go on one to lay the tile. A staked tile wears a pin and
// stays put in the wind. The rules are drift-engine.js's; this file draws the field, plays each turn out and keeps the
// game.
import { N, WINDS, newGame, upgrade, lay, blow, lines, gale, worth, squallCount } from "./drift-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "drift:run", BEST = "drift:best", SEEN = "drift:seen", STAKED = "drift:staked";
const CELL = 10;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");

let S = null;            // the game (drift-engine.js's), as saved
let playing = false;     // a turn being played out
let press = null;        // a pointer pressing the field
let aim = -1;            // the square whose turn is shown

const valid = g => g && g.v === 1 && Array.isArray(g.cells) && g.cells.length === N * N && Array.isArray(g.winds) && g.winds.length === 3;
function save() { write(RUN, S); }
function newRun() { S = newGame(Math.floor(Math.random() * 2 ** 31)); aim = -1; save(); render(); }

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const at = i => [(i % N) * CELL, Math.floor(i / N) * CELL];
// each colour a mark of its own (a dot, a ring, a bar, a chevron), so tiles are told apart without their colour
const MARKS = [
  () => el("circle", { class: "dr-fill", cx: 5, cy: 5, r: 1.7 }),
  () => el("circle", { class: "dr-stroke", cx: 5, cy: 5, r: 2 }),
  () => el("path", { class: "dr-stroke", d: "M2.8 5H7.2" }),
  () => el("path", { class: "dr-stroke", d: "M3 6.2L5 3.8L7 6.2" }),
];
/** A tile (a staked one with a pin in its corner); placed by an outer group so its own can move. */
function tileEl(c, i, cls = "", [x, y] = at(i), staked = false) {
  const body = el("g", { class: `dr-tile k${c}${staked ? " staked" : ""} ${cls}`.trim() }, el("rect", { x: .5, y: .5, width: 9, height: 9, rx: 1.6 }), MARKS[c]());
  if (staked) body.append(el("circle", { class: "dr-pin", cx: 2.5, cy: 2.5, r: 1.15 }));
  return el("g", { transform: `translate(${x} ${y})`, "data-cell": i }, body);
}
/** The stakes standing (S's), with the tile to lay on square i if it comes with one. */
const stakesWith = i => (S.untilStake === 0 && i >= 0 ? [...S.stakes, i] : S.stakes);
const ARROW = ["M0 3.2V-3.2M-2.4-.9L0-3.2L2.4-.9", "M-3.2 0H3.2M.9-2.4L3.2 0L.9 2.4", "M0-3.2V3.2M-2.4 .9L0 3.2L2.4 .9", "M3.2 0H-3.2M-.9-2.4L-3.2 0L-.9 2.4"];
/** The edge the wind piles the tiles against, drawn on the field. */
function lee(wind) {
  const d = ["M0 -1.6H70", "M71.6 0V70", "M0 71.6H70", "M-1.6 0V70"][wind];
  return el("path", { class: "dr-lee", d });
}
/**
 * The field: these tiles, with extra: { ghost (a square the tile is shown on), ring (squares to ring), tag ([text,
 * square]), fresh (squares just filled), wind (the edge to mark), stakes (the staked squares, S's by default) }.
 */
function drawBoard(cells, extra = {}) {
  const grid = el("g", { class: "dr-grid" }), stakes = new Set(extra.stakes || S.stakes);
  for (let k = 1; k < N; k++) grid.append(el("line", { x1: k * CELL, x2: k * CELL, y1: 0, y2: 70 }), el("line", { y1: k * CELL, y2: k * CELL, x1: 0, x2: 70 }));
  const tiles = el("g", { id: "tiles" });
  cells.forEach((c, i) => { if (c >= 0) tiles.append(tileEl(c, i, extra.fresh?.includes(i) ? "fresh" : i === extra.ghost ? "ghost" : "", at(i), stakes.has(i))); });
  const marks = el("g", {});
  for (const i of extra.ring || []) { const [x, y] = at(i); marks.append(el("rect", { class: "dr-ring", x: x + .15, y: y + .15, width: 9.7, height: 9.7, rx: 1.9 })); }
  if (extra.tag) {
    const [x, y] = at(extra.tag[1]), t = el("text", { class: "dr-tag", x: Math.min(60, Math.max(10, x + CELL / 2)), y: Math.max(3.4, y - 1.4) });
    t.textContent = extra.tag[0];
    marks.append(t);
  }
  const kids = [el("rect", { class: "dr-bed", x: 0, y: 0, width: 70, height: 70, rx: 1.5 }), grid, lee(extra.wind ?? S.winds[0]), tiles, marks];
  if (!read(SEEN, false) && S.turns < 3 && extra.ghost == null && !S.over && !extra.fresh) {
    kids.push(el("g", { class: "dr-hint" }, ...["Press a square to see the turn:", "the tile, then the wind", "blows everything one way"].map((t, k) => {
      const n = el("text", { x: 35, y: 30 + k * 6 });
      n.textContent = t;
      return n;
    })));
  }
  kids.push(el("g", { id: "fx" }));
  $("board").replaceChildren(...kids);
}
const small = (c, cls, staked) => el("svg", { viewBox: "0 0 10 10", class: cls, "aria-hidden": "true" }, tileEl(c, 0, "", [0, 0], staked));
const arrow = (w, cls) => el("svg", { viewBox: "-5 -5 10 10", class: cls, "aria-hidden": "true" }, el("path", { class: "dr-arrow", d: ARROW[w] }));
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  $("room").textContent = S.cells.filter(c => c < 0).length;
}
function drawSide(text) {
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `No room left on the field: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  const forecast = document.createElement("div");
  forecast.className = "dr-forecast";
  forecast.append(arrow(S.winds[0], "now"), arrow(S.winds[1], "then"), arrow(S.winds[2], "then"));
  const staking = S.untilStake === 0;
  $("coming").replaceChildren(small(S.next[0], "now", staking), small(S.next[1], "next", S.untilStake === 1), forecast);
  $("coming").setAttribute("aria-label", `The tile to lay${staking ? ", with a stake," : ""} and the next; the wind blows ${WINDS[S.winds[0]]}, then ${WINDS[S.winds[1]]}, then ${WINDS[S.winds[2]]}`);
  const squall = S.untilSquall === 1;
  // a stake explained the first times one comes, then just said
  $("line").textContent = text ?? (staking && !read(STAKED, false) ? "This tile is staked: it stays put, and tiles pile against it"
    : (squall ? `The wind blows ${WINDS[S.winds[0]]}, and a squall brings ${squallCount(S.turns) === 1 ? "a stray tile" : `${squallCount(S.turns)} stray tiles`} with it`
      : `The wind blows ${WINDS[S.winds[0]]}; a squall in ${S.untilSquall} turns`) + (staking ? "; this tile is staked" : ""));
}
function render() { drawBoard(S.cells); drawStrip(); drawSide(); }
/** The turn a square would make (the squall aside: where it blows its tiles is anyone's guess), shown. */
function show(i) {
  const c = S.cells.slice(), stakes = stakesWith(i);
  c[i] = S.next[0];
  const first = blow(c, S.winds[0], stakes).cells, g = gale(c, S.winds[0], stakes);
  drawBoard(first, { ring: lines(first), tag: g.cleared ? [`+${fmt(worth(g.cleared))}`, i] : null, stakes });
  drawSide(g.cleared ? `${g.cleared} tiles clear${g.gusts.length > 2 ? ` in ${g.gusts.length - 1} gusts` : ""}: +${fmt(worth(g.cleared))}` : `Blown ${WINDS[S.winds[0]]}: nothing lines up`);
}

// ---------- a turn ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
const node = i => $("board").querySelector(`#tiles [data-cell="${i}"] > g`);
async function commit(i) {
  if (playing || S.over) return;
  playing = true;
  aim = -1;
  const before = S, r = lay(S, i);
  S = r.state;
  save();
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.turns >= 3) write(SEEN, true);
  if (r.staked) write(STAKED, true);
  drawSide(" ");
  // the tile laid, the squall's strays, then the wind gust by gust, the stakes going with their tiles as they clear
  let cells = before.cells.slice(), stakes = r.staked ? [...before.stakes, i] : before.stakes.slice();
  cells[i] = before.next[0];
  const wind = before.winds[0];
  drawBoard(cells, { fresh: [i], wind, stakes });
  await animate(node(i), [{ transform: "scale(.4)", opacity: .3 }, { transform: "scale(1)", opacity: 1 }], { duration: 160, easing: "ease-out" });
  if (r.squall.length) {
    for (const { at: j, colour } of r.squall) cells[j] = colour;
    drawBoard(cells, { fresh: r.squall.map(q => q.at), wind, stakes });
    await Promise.all(r.squall.map(q => animate(node(q.at), [{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 220, easing: "ease-out" })));
  }
  for (const gust of r.gusts) {
    const b = blow(cells, wind, stakes);
    cells = b.cells;
    drawBoard(cells, { wind, stakes });
    await Promise.all(b.moved.map(([f, t]) => { const [fx, fy] = at(f), [tx, ty] = at(t); return animate(node(t), [{ transform: `translate(${fx - tx}px, ${fy - ty}px)` }, { transform: "translate(0, 0)" }], { duration: 200, easing: "ease-in" }); }));
    if (!gust.cleared.length) break;
    drawBoard(cells, { ring: gust.cleared, wind, stakes });
    await Promise.all(gust.cleared.map(j => animate(node(j), [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.4)", opacity: 0 }], { duration: 260, easing: "ease-in" })));
    for (const j of gust.cleared) cells[j] = -1;
    stakes = stakes.filter(j => cells[j] >= 0);
  }
  render();
  if (r.gain) popup(r.gusts.flatMap(g => g.cleared), r.gain);
  playing = false;
}
function popup(cells, gain) {
  const fx = $("board").querySelector("#fx"), u = [...new Set(cells)];
  const x = u.reduce((a, k) => a + at(k)[0], 0) / u.length + CELL / 2, y = u.reduce((a, k) => a + at(k)[1], 0) / u.length + CELL / 2;
  const t = el("text", { class: `dr-pop${u.length >= 6 ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = `+${fmt(gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 1000, easing: "ease-out" });
}

// ---------- pressing the field ----------
function cellAt(px, py) {
  const m = $("board").getScreenCTM();
  if (!m) return -1;
  const p = new DOMPoint(px, py).matrixTransform(m.inverse()), x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
  return x >= 0 && y >= 0 && x < N && y < N ? y * N + x : -1;
}
function aimAt(e) {
  const k = cellAt(e.clientX, e.clientY), i = k >= 0 && S.cells[k] < 0 ? k : -1;
  if (i === aim) return;
  aim = i;
  if (i >= 0) show(i);
  else { drawBoard(S.cells); drawSide(); }
}
$("board").addEventListener("pointerdown", e => {
  if (playing || S.over || e.button > 0 || cellAt(e.clientX, e.clientY) < 0) return;
  e.preventDefault();
  press = e.pointerId;
  aim = -2;
  aimAt(e);
});
addEventListener("pointermove", e => {
  if (press === e.pointerId) aimAt(e);
  else if (press == null && !playing && !S.over && e.pointerType === "mouse" && e.target.closest?.("#board")) aimAt(e);   // a mouse shows a turn as it passes
});
addEventListener("pointerup", e => {
  if (press !== e.pointerId) return;
  press = null;
  const i = cellAt(e.clientX, e.clientY);
  if (i >= 0 && i === aim) commit(i);
  else { aim = -1; render(); }
});
addEventListener("pointercancel", e => { if (press === e.pointerId) { press = null; aim = -1; render(); } });
$("board").addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && press == null && aim >= 0 && !playing) { aim = -1; render(); } });

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
bindSwitcher($("appsBtn"), "drift");
document.querySelector(".dr-mark").innerHTML = APPS.find(a => a.id === "drift").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", newRun);

// for tests and debugging
window.__drift = { get state() { return S; }, commit, cellAt, newRun };

S = read(RUN, null);
if (!valid(S)) newRun();
else { S = upgrade(S); render(); }
