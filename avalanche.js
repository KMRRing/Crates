// Avalanche: a slope of snow above a road. Press a square and the slide the day's charge there would set off is
// shown (every square that would slide ringed, what it would score); let go on it to set it off. Then night falls:
// snow lands at random, and what it sets off runs where it runs; three layers on the road in one night bury it. The
// rules are avalanche-engine.js's; this file draws the slope, plays each day and night out and keeps the game.
import { W, H, CAP, LIVES, BURY, WINDS, newGame, upgrade, charge, settle, snowfall, struck, scored } from "./avalanche-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "avalanche:run", BEST = "avalanche:best", SEEN = "avalanche:seen";
const CELL = 10, ROAD_Y = H * CELL + 1;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");

let S = null;            // the game (avalanche-engine.js's), as saved
let playing = false;     // a day and night being played out
let press = null;        // a pointer pressing the slope
let aim = -1;            // the square whose charge is shown

const valid = g => g && g.v === 1 && Array.isArray(g.cells) && g.cells.length === W * H;
function save() { write(RUN, S); }
function newRun() { S = newGame(Math.floor(Math.random() * 2 ** 31)); aim = -1; save(); render(); }

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const at = i => [(i % W) * CELL, Math.floor(i / W) * CELL];
/** A square of the slope: its snow as deep as it is (and a tick for each layer, so it's read without its shade); a
 *  full one cracked, as it is when the next layer will set it off. */
function squareEl(d, i, cls = "") {
  const [x, y] = at(i), g = el("g", { transform: `translate(${x} ${y})`, "data-cell": i }, el("g", { class: `av-sq d${Math.min(d, CAP - 1)} ${cls}`.trim() },
    el("rect", { x: .35, y: .35, width: 9.3, height: 9.3, rx: 1.4 }),
    ...Array.from({ length: Math.min(d, CAP - 1) }, (_, k) => el("rect", { class: "av-tick", x: 1.6 + k * 2.4, y: 7.6, width: 1.8, height: .9, rx: .3 }))));
  if (d >= CAP - 1) g.firstChild.append(el("path", { class: "av-crack", d: "M2.2 3.4l2 1.4 1.4-1.6 2.2 1.7" }));
  return g;
}
function roadEl(snow) {
  const g = el("g", { class: "av-road" }, el("rect", { class: "av-tarmac", x: -2, y: ROAD_Y, width: 74, height: 6.5, rx: 1 }), el("path", { class: "av-lane", d: `M0 ${ROAD_Y + 3.25}H70` }));
  // the night's snow on it, a drift for each layer, red once there's enough to bury it
  for (let k = 0; k < snow; k++) g.append(el("ellipse", { class: `av-drift${snow >= BURY ? " deep" : ""}`, cx: 8 + ((k * 23) % 56), cy: ROAD_Y + 3.4, rx: 4.6, ry: 2.2 }));
  return g;
}

/** A chalet on its square: a roof and a wall, red-ringed when a slide would carry it away. */
function chaletEl(i, cls = "") {
  const [x, y] = at(i);
  return el("g", { class: `av-chalet ${cls}`.trim(), transform: `translate(${x} ${y})`, "data-chalet": i },
    el("path", { class: "av-wall", d: "M3 5.2H7V8.6H3Z" }), el("path", { class: "av-roof", d: "M1.8 5.6L5 2.4L8.2 5.6Z" }), el("path", { class: "av-door", d: "M4.4 8.6V6.8H5.6V8.6" }));
}
/** The forecast wind over the slope: streaks on the side it blows from (none on a still night). */
function windEl(wind) {
  if (!wind) return "";
  const g = el("g", { class: "av-wind" });
  for (let k = 0; k < 3; k++) {
    const y = 14 + k * 24, d = wind === 1 ? `M-1.2 ${y}q3-1.6 6 0t6 0` : `M71.2 ${y}q-3-1.6-6 0t-6 0`;
    g.append(el("path", { d }));
  }
  return g;
}
/**
 * The slope: these depths, with extra: { ring (squares a charge would set sliding), tag ([text, square]), sliding
 * (squares sliding now), natural (it's the night's), night, road (layers on the road), flake (where snow just fell),
 * chalets (their squares, else the game's), struck (chalets a slide would carry away), wind (else tonight's) }.
 */
function drawBoard(cells, extra = {}) {
  const sq = el("g", {});
  cells.forEach((d, i) => sq.append(squareEl(d, i, extra.sliding?.includes(i) ? (extra.natural ? "sliding natural" : "sliding") : "")));
  const chalets = el("g", {}, ...(extra.chalets || S.chalets).map(c => chaletEl(c, extra.struck?.includes(c) ? "struck" : "")));
  const marks = el("g", {});
  for (const i of extra.ring || []) { const [x, y] = at(i); marks.append(el("rect", { class: "av-ring", x: x + .2, y: y + .2, width: 9.6, height: 9.6, rx: 1.6 })); }
  if (extra.tag) {
    const [x, y] = at(extra.tag[1]), t = el("text", { class: "av-tag", x: Math.min(58, Math.max(12, x + CELL / 2)), y: Math.max(3.4, y - 1.4) });
    t.textContent = extra.tag[0];
    marks.append(t);
  }
  if (extra.flake >= 0) { const [x, y] = at(extra.flake); marks.append(el("circle", { class: "av-flake", cx: x + CELL / 2, cy: y + CELL / 2, r: 1.6 })); }
  const kids = [el("rect", { class: "av-bed", x: -2, y: -2, width: 74, height: H * CELL + 3, rx: 2 }), sq, chalets, windEl(extra.wind ?? S.wind), roadEl(extra.road || 0), marks];
  if (extra.night) kids.push(el("rect", { class: "av-night", x: -2, y: -2, width: 74, height: 91, rx: 2 }));
  kids.push(el("g", { id: "fx" }));
  $("board").replaceChildren(...kids);
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  const lives = $("lives");
  lives.replaceChildren(...Array.from({ length: LIVES }, (_, k) => { const p = document.createElement("i"); if (k < S.lives) p.className = "on"; return p; }));
  lives.setAttribute("aria-label", `${S.lives} of ${LIVES} lives`);
}
function drawSide(text) {
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `The road buried a third time: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  const first = !read(SEEN, false) && S.days < 3, loaded = S.cells.slice(W * (H - 1)).filter(d => d >= CAP - 1).length;
  const wind = S.wind ? `, the wind ${WINDS[S.wind]} loading the ${S.wind === 1 ? "east" : "west"} side` : ", the night still";
  $("line").textContent = text ?? (first ? "Tap a square for the day's charge: a fourth layer sets it sliding, and slides you set off score"
    : `Tonight ${snowfall(S.days)} layers of snow${wind}${loaded ? `; ${loaded} square${loaded === 1 ? "" : "s"} above the road full` : ""}`);
}
function render() { drawBoard(S.cells); drawStrip(); drawSide(); }
/** What the day's charge on a square would set off, shown. */
function show(i) {
  const c = S.cells.slice();
  c[i]++;
  const r = settle(c, i), ring = [...new Set(r.waves.flat())], hit = struck(S.chalets, r), gain = scored(r.size, hit.length);
  drawBoard(S.cells, { ring, struck: hit, tag: r.size ? [`+${fmt(gain)}`, i] : null });
  drawSide(r.size ? `${r.size} slide${r.size === 1 ? "" : "s"}${r.foot ? `, ${r.foot} layer${r.foot === 1 ? "" : "s"} onto the closed road` : ""}${hit.length ? `, ${hit.length === 1 ? "a chalet" : "both chalets"} carried away, ${hit.length === 1 ? "halved" : "quartered"}` : ""}: +${fmt(gain)}` : "No slide: the charge only adds a layer here");
}

// ---------- a day and a night ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
/** One wave of an avalanche: the depths after it, and how many layers it sent onto the road. */
function step(cells, wave) {
  const c = cells.slice();
  let foot = 0;
  for (const i of wave) {
    c[i] -= CAP;
    const x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
      if (ny >= H) foot++;
      else if (nx >= 0 && ny >= 0 && nx < W) c[ny * W + nx]++;
    }
  }
  return { cells: c, foot };
}
async function commit(i) {
  if (playing || S.over) return;
  playing = true;
  aim = -1;
  const before = S, r = charge(S, i);
  S = r.state;
  save();
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.days >= 3) write(SEEN, true);
  // the day: the charge, and the slide it sets off wave by wave
  let cells = before.cells.slice(), chalets = before.chalets.slice();
  cells[i]++;
  drawBoard(cells, { chalets });
  drawSide(" ");
  for (const wave of r.slide.waves) {
    cells = step(cells, wave).cells;
    drawBoard(cells, { sliding: wave, chalets });
    await wait(110);
  }
  if (r.carried.length) { await carry(r.carried); chalets = chalets.filter(c => !r.carried.includes(c)); }
  drawStrip();
  if (r.gain) { popup(r.slide.waves.flat(), r.gain); await wait(500); }
  // the night: the snow, layer by layer on the wind, and whatever it sets off
  let road = 0;
  const night = { night: true, wind: r.wind };
  drawBoard(cells, { ...night, chalets });
  drawSide(`Night: ${r.night.length} layers of snow${r.wind ? `, the wind ${WINDS[r.wind]}` : ""}`);
  await wait(260);
  for (const { at: j, slide, carried } of r.night) {
    cells[j]++;
    drawBoard(cells, { ...night, chalets, flake: j, road });
    const drift = r.wind === 1 ? -14 : r.wind === 2 ? 14 : 0;
    await animate($("board").querySelector(".av-flake"), [{ transform: `translate(${drift}px, -14px)`, opacity: 0 }, { transform: "translate(0, 0)", opacity: 1 }], { duration: 240, easing: "ease-in" });
    for (const wave of slide?.waves || []) {
      const s = step(cells, wave);
      cells = s.cells;
      road += s.foot;
      drawBoard(cells, { ...night, chalets, sliding: wave, natural: true, road });
      await wait(110);
    }
    const gone = carried.filter(c => chalets.includes(c));
    if (gone.length) { await carry(gone); chalets = chalets.filter(c => !gone.includes(c)); }
  }
  if (r.buried) toast(S.over ? "The road buried a third time" : `The road is buried: ${S.lives} ${S.lives === 1 ? "life" : "lives"} left`);
  await wait(r.buried ? 700 : 300);
  render();
  playing = false;
}
/** Chalets a slide carries away: down the slope and gone (they're built again elsewhere). */
function carry(gone) {
  return Promise.all(gone.map(c => animate($("board").querySelector(`[data-chalet="${c}"]`), [{ transform: `translate(${at(c)[0]}px, ${at(c)[1]}px)`, opacity: 1 }, { transform: `translate(${at(c)[0]}px, ${at(c)[1] + 12}px) rotate(25deg)`, opacity: 0 }], { duration: 480, easing: "ease-in" })));
}
function popup(cells, gain) {
  const fx = $("board").querySelector("#fx"), u = [...new Set(cells)];
  const x = u.reduce((a, i) => a + at(i)[0], 0) / u.length + CELL / 2, y = u.reduce((a, i) => a + at(i)[1], 0) / u.length + CELL / 2;
  const t = el("text", { class: `av-pop${u.length >= 8 ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = `+${fmt(gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 1000, easing: "ease-out" });
}

// ---------- pressing the slope ----------
function cellAt(px, py) {
  const m = $("board").getScreenCTM();
  if (!m) return -1;
  const p = new DOMPoint(px, py).matrixTransform(m.inverse()), x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
  return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1;
}
function aimAt(e) {
  const i = cellAt(e.clientX, e.clientY);
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
  else if (press == null && !playing && !S.over && e.pointerType === "mouse" && e.target.closest?.("#board")) aimAt(e);   // a mouse shows a charge as it passes
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
  part(body, "about").append(line(`This game: ${fmt(S.score)} in ${S.days} day${S.days === 1 ? "" : "s"}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "avalanche");
document.querySelector(".av-mark").innerHTML = APPS.find(a => a.id === "avalanche").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", newRun);

// for tests and debugging
window.__avalanche = { get state() { return S; }, commit, cellAt, newRun };

S = read(RUN, null);
if (!valid(S)) newRun();
else { S = upgrade(S); render(); }
