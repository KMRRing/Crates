// Settle: the Row (six tanks of a tank farm) or the Farm (nine, in a 3x3), four grades settling by density. Drag one of the two parcels offered onto a tank
// (or tap it, then the tank); while it's held over a tank, the farm is shown as the parcel would leave it: where it
// settles, what it lifts, the lines that would ship out ringed, or the spill it would cause. Let go to pump it. The
// draw-off beside them, once ready, is dragged onto a tank the same way, to drain the water and slops from its foot;
// FAME standing on water shows how many pumps it has before it sours. Over the header pipe the tanker at the jetty
// shows the grade it takes by threes (any other by fours), and the next one's grade and when it comes; lines of three
// standing ready for their grade's tanker are dotted. The rules are settle-engine.js's; this file draws the farm, plays
// each move out and keeps the game. The Farm is the same page on settle-farm-engine.js (the engine in use is `useEngine`'s):
// no levels, its own runs and best, tanks numbered 1 to 9 from the back left, and a rectangle for a line.
import * as ROW from "./settle-engine.js";
import * as FARM from "./settle-farm-engine.js";
import { LEVELS, LIVES, NAMES, DENSITY, WATER, FAME, SLOP, SOUR, newLevel, rule, settles, pumped, foot, worth } from "./settle-engine.js";
import { LEVELS as COURSE, levelOf, starsFor, isOpen } from "./settle-levels.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, choice, onPause } from "./menu.js";
import { roundOver } from "./random.js";
import { noteStars, IN_FRAME } from "./suite.js";
import { wants3D, onDefaultChange } from "./mode3d.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
// the engine in use: the row's or the farm's (same names, same shapes)
let TANKS, newGame, upgrade, lines, ship, pump, drawOff, draws;
let KIND = "row";
const isFarm = () => KIND === "farm";
function useEngine(kind) {
  KIND = kind;
  ({ TANKS, newGame, upgrade, lines, ship, pump, drawOff, draws } = kind === "farm" ? FARM : ROW);
  Object.assign(LAY, kind === "farm" ? FLAT.farm : FLAT.row);
}
const SVG = "http://www.w3.org/2000/svg";
const VIEW = "suite:settle-view";   // flat or 3D: this device's own, so it stays out of what syncs (and a watching frame never writes it)
const RUN = "settle:run", LRUN = "settle:lrun", DONE = "settle:levels", MODE = "settle:mode", BEST = "settle:best", SEEN = "settle:seen", DREW = "settle:drew", JETTY = "settle:jetty", KINDK = "settle:kind", FRUN = "settle:frun", FBEST = "settle:fbest";   // pumps made with the tanker explained
// the flat picture: a tank's width, the gap between, a level's height, a row of tanks' height and gap, the columns, the floor, the box
const FLAT = {
  row: { TW: 10, GAP: 2, LH: 7.4, COLS: 6, ROWH: 59, ROWGAP: 0, BASE: 60, box: "-2 -14 74 87", w: 71 },
  farm: { TW: 24, GAP: 3, LH: 2.9, COLS: 3, ROWH: 24.4, ROWGAP: 3.2, BASE: 0, box: "-2 -14 80 96", w: 78 },
};
const LAY = { ...FLAT.row };
// the 3x3 reads as the plane of a level, so the foot of a tank is the bottom of its cell
const LETTER = ["W", "F", "D", "N", "S"];
const DRAWN = "draw";   // the draw-off card's slot, held as a parcel's is
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const upper = s => s[0].toUpperCase() + s.slice(1);

let S = null;            // the game (settle-engine.js's), as saved
let playing = false;     // a pump being played out
let drag = null;         // a parcel offered (or the draw-off), held: { slot, id, x0, y0, moved, t }
let picked = -1;         // a parcel (or the draw-off) tapped, to use with a tap on a tank
let V3 = null;            // the 3D farm (settle-3d.js), when it is the one shown; else the flat farm in the page
let berth = null;        // the tanker drawn while a pump plays out ({ want, next, untilTanker }), else the game's

const valid = g => g && g.v === 1 && Array.isArray(g.tanks) && g.tanks.length === TANKS && Array.isArray(g.hand) && g.hand.length === 2;
// the game in play is a level's (S.goal) or the endless one; each keeps its own run, and the mode says which opens
const isLevel = () => S.goal != null;
let done = read(DONE, {});   // { level number: { stars, pumps } }
const starsAll = () => Object.values(done).reduce((n, d) => n + (d?.stars || 0), 0);
const runKey = () => (isFarm() ? FRUN : isLevel() ? LRUN : RUN), bestKey = () => (isFarm() ? FBEST : BEST);
const bestNow = () => read(bestKey(), 0);
function save() { write(runKey(), S); }
function newRun() { S = newGame(Math.floor(Math.random() * 2 ** 31)); if (!isFarm()) write(MODE, "endless"); drag = null; picked = -1; save(); render(); }
function openLevel(L) { S = newLevel(L); write(MODE, "levels"); drag = null; picked = -1; save(); render(); }
/** The level to carry on with: the first without a star. */
const nextUp = () => COURSE.find(L => !done[L.id]?.stars) ?? COURSE.at(-1);
function keepStars() {
  const L = levelOf(S.lv), stars = starsFor(L, S.pumps), was = done[L.id];
  done = { ...done, [L.id]: { stars: Math.max(was?.stars || 0, stars), pumps: Math.min(was?.pumps ?? Infinity, S.pumps) } };
  write(DONE, done);
  noteStars("settle", starsAll());
}

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const tx = t => (t % LAY.COLS) * (LAY.TW + LAY.GAP), cellY = t => Math.floor(t / LAY.COLS) * (LAY.ROWH + LAY.ROWGAP);
/** The y of the top of a parcel at a level in tank t (a row of tanks stands on BASE or, in the farm, at the foot of its cell). */
const ly = (level, t = 0) => (isFarm() ? cellY(t) + LAY.ROWH - .6 : LAY.BASE) - (level + 1) * LAY.LH;
/** A parcel: its grade's colour and letter (slops speckled, an emulsion); placed by an outer group so its own can move. */
function parcelEl(g, t, level, cls = "", key = null, d = LAY) {
  const { TW, LH } = d, label = el("text", { class: "st-letter", x: TW / 2, y: LH / 2 + .1 });
  label.textContent = LETTER[g];
  const body = el("g", { class: `st-parcel k${g} ${cls}`.trim() }, el("rect", { x: .8, y: LH > 4 ? .35 : .2, width: TW - 1.6, height: LH > 4 ? LH - .7 : LH - .4, rx: LH > 4 ? 1.1 : .6 }));
  if (g === SLOP) for (const [x, y, r] of [[2.3, 1.7, .45], [7.6, 2.2, .35], [2.9, 5.6, .35], [7.2, 5.4, .5]]) body.append(el("circle", { class: "st-bead", cx: x * TW / 10, cy: y * LH / 7.4, r: r * LH / 7.4 }));
  body.append(label);
  return el("g", { transform: `translate(${tx(t)} ${ly(level, t).toFixed(2)})`, "data-key": key }, body);
}
/** A grade's name as a sentence has it. */
const named = g => (g === FAME ? "FAME" : NAMES[g].toLowerCase());
/** The ship that comes for a grade, as a sentence names it: a barge takes the water away, a tanker the rest. */
const vessel = g => (g === WATER ? "the water barge" : `${named(g)}'s tanker`);
/** The lines of three standing ready for their grade's tanker in these tanks: those of three that don't ship now. */
const waiting = (tanks, want) => { const go = new Set(lines(tanks, want).map(p => p.join())); return lines(tanks).filter(p => !go.has(p.join())); };
/** A cargo on deck, or a swatch of the next one: a grade's enamel and letter, small. */
function cargoEl(g, x, y, w, h) {
  const label = el("text", { class: "st-letter", x: x + w / 2, y: y + h / 2 + .05 });
  label.textContent = LETTER[g];
  return el("g", { class: `st-parcel st-cargo k${g}` }, el("rect", { x, y, width: w, height: h, rx: .6 }), label);
}
/** Over the header pipe: the tanker at the jetty, its grade's cargo on deck, by threes; the next one's grade, and when. */
function jettyEl({ want, next, untilTanker }, dim) {
  const dx = LAY.w - 71, by = el("text", { class: "st-jetty-t", x: 18.6, y: -10.4 }), when = el("text", { class: "st-jetty-t", x: 60.4 + dx, y: -10.4 }), then = el("text", { class: "st-jetty-t end", x: 52.2 + dx, y: -10.4 });
  by.textContent = isFarm() ? "as 2 by 2" : "by threes";
  then.textContent = "next";
  when.textContent = `in ${untilTanker}`;
  const ship = el("g", { class: "st-ship" }, el("path", { class: "st-hull", d: "M.3 -10.2H17.2L15.6 -7.8H1.3Z" }), el("rect", { class: "st-hull", x: 1, y: -13.3, width: 3.4, height: 3.1, rx: .4 }), cargoEl(want, 5.4, -13, 10.8, 2.8));
  return el("g", { class: `st-jetty${dim ? " dim" : ""}` }, ship, by, then, cargoEl(next, 53.2 + dx, -11.8, 6.2, 2.8), when);
}
/** Where FAME stands on water in a tank, the level of the water under it, or -1. */
const contact = tank => { const w = tank.lastIndexOf(WATER); return w >= 0 && tank[w + 1] === FAME ? w : -1; };
/**
 * The farm: these tanks, with extra: { ring ([t, level] parcels to ring: the lines shipping), wait (lines of three to
 * dot, standing ready for their tanker), fresh ([t, level]: the parcel pumped), over (a tank shown overflowing), tag
 * ([text, t]), aim (a tank the parcel is held over), sour (each tank's pumps of FAME on water, to mark how long it has
 * left) }; the tanker over it is the one in play.
 */
function drawBoard(tanks, extra = {}) {
  if (V3) { V3.draw(tanks, extra, rule(S, "tanker") ? { want: (berth ?? S).want, next: (berth ?? S).next, untilTanker: (berth ?? S).untilTanker } : null); return; }
  const { TW, LH, ROWH } = LAY, farm = isFarm(), board = $("board");
  board.setAttribute("viewBox", LAY.box);
  board.classList.toggle("farm", farm);
  const shells = el("g", {});
  for (let t = 0; t < TANKS; t++) {
    const x = tx(t), y = farm ? cellY(t) : ly(LEVELS - 1) - 1.4, h = farm ? ROWH : LEVELS * LH + 1.6;
    shells.append(el("rect", { class: `st-shell${extra.aim === t ? " aim" : ""}`, x, y, width: TW, height: h, rx: farm ? 1.4 : 2.2 }));
    if (!farm) shells.append(el("path", { class: "st-drop", d: `M${x + TW / 2} -6.5V${y}` }));
    else {
      // the tank's number, where the text names it ("tank 5"), faint in the corner of its cell
      const n = el("text", { class: "st-num", x: x + 1.2, y: y + 3 });
      n.textContent = t + 1;
      shells.append(n);
    }
  }
  const parcels = el("g", { id: "parcels" });
  tanks.forEach((tank, t) => tank.forEach((g, level) => {
    const fresh = extra.fresh && extra.fresh[0] === t && extra.fresh[1] === level, spill = level >= LEVELS;
    parcels.append(parcelEl(g, t, level, fresh ? "fresh" : spill ? "spill" : "", `${t}:${level}`));
  }));
  const marks = el("g", {});
  for (const [t, level] of extra.wait || []) marks.append(el("rect", { class: "st-ring wait", x: tx(t) + .35, y: ly(level, t) - .05, width: TW - .7, height: LH + .1, rx: 1.4 }));
  for (const [t, level] of extra.ring || []) marks.append(el("rect", { class: "st-ring", x: tx(t) + .25, y: ly(level, t) - .15, width: TW - .5, height: LH + .3, rx: 1.5 }));
  // FAME on water: a mark where they meet, with the pumps left before it sours
  if (extra.sour) tanks.forEach((tank, t) => {
    const w = contact(tank), left = SOUR - extra.sour[t];
    if (w < 0 || !extra.sour[t]) return;
    const x = tx(t) + TW - (farm ? 1.8 : .3), y = ly(w, t), n = el("text", { class: "st-sour-n", x, y: y + .1 });
    n.textContent = left;
    marks.append(el("g", { class: `st-sour${left <= 1 ? " due" : ""}` }, el("circle", { cx: x, cy: y, r: farm ? 1.5 : 2 }), n));
  });
  if (extra.tag) { const t = el("text", { class: "st-tag", x: Math.min(LAY.w - 9, Math.max(8, tx(extra.tag[1]) + TW / 2)), y: farm ? cellY(extra.tag[1]) + 4 : -8 }); t.textContent = extra.tag[0]; marks.append(t); }
  board.replaceChildren(
    farm ? el("g", {}) : el("rect", { class: "st-ground", x: -2, y: LAY.BASE, width: 74, height: 3.5, rx: .8 }),
    rule(S, "tanker") ? jettyEl(berth ?? S, !!extra.tag) : el("g", {}), el("path", { class: "st-header", d: farm ? `M-1 -6.5H${LAY.w + 1}` : "M-1 -6.5H71" }), shells, parcels, marks, el("g", { id: "fx" }));
}
function drawStrip() {
  if (isLevel()) {
    $("stripA").innerHTML = `Level <b>${S.lv}</b> · shipped <b>${Math.min(S.shipped, S.goal)}</b>/<b>${S.goal}</b>`;
    $("stripB").innerHTML = `Pump <b>${S.over ? S.pumps : S.pumps + 1}</b>/<b>${S.limit}</b>`;
  } else {
    $("stripA").innerHTML = `Score <b>${fmt(S.score)}</b>`;
    $("stripB").innerHTML = `Best <b>${fmt(Math.max(bestNow(), S.score))}</b>`;
  }
  const lives = $("lives");
  lives.replaceChildren(...Array.from({ length: LIVES }, (_, k) => { const i = document.createElement("i"); if (k < S.lives) i.className = "on"; return i; }));
  lives.setAttribute("aria-label", `${S.lives} of ${LIVES} lives`);
}
/**
 * The line under the farm when no parcel is held: a level's brief before its first pump, then what's coming. An endless
 * game's first pump, then the tanker for three pumps (once, for everyone); else the next delivery and the FAME nearest
 * souring.
 */
function sideLine() {
  const when = n => (n === 1 ? "after this pump" : `in ${n} pumps`);
  const souring = rule(S, "sour") ? [...Array(TANKS).keys()].filter(t => S.sour[t] && contact(S.tanks[t]) >= 0).sort((a, b) => S.sour[b] - S.sour[a])[0] : null;
  const tell = [rule(S, "deliver") ? `a delivery comes ${when(S.untilDelivery)}` : "", souring != null ? `tank ${souring + 1}'s FAME on water sours ${when(SOUR - S.sour[souring])}` : ""].filter(Boolean).join("; ");
  const tanker = () => `The ${S.want === WATER ? "barge" : "tanker"} in takes ${named(S.want)} ${isFarm() ? "as a 2 by 2, other grades as 3 by 2 or 3 by 3" : "by threes, other grades by fours"}; ${S.next === WATER ? "the water barge" : `${named(S.next)}'s`} is next`;
  const firstDraw = !read(DREW, false) && draws(S).length > 0, drawn = "A draw-off is ready: drag it onto a tank to drain the water and slops from its foot";
  if (isLevel()) {
    const L = levelOf(S.lv), left = S.goal - S.shipped;
    return S.pumps === 0 ? L.note : rule(S, "tanker") && S.pumps < 3 ? tanker() : draws(S).length && S.pumps < 5 && L.drawn ? drawn
      : `Ship ${left} more in ${S.limit - S.pumps} pump${S.limit - S.pumps === 1 ? "" : "s"}${tell ? `; ${tell}` : ""}`;
  }
  const first = !read(SEEN, false) && S.pumps < 1;
  return first ? (isFarm() ? "Drag a parcel onto one of the nine tanks: it settles by density; fill a square or rectangle of one grade at a level" : "Drag a parcel onto a tank: it settles by density, the heaviest at the foot")
    : read(JETTY, 0) < 3 ? tanker() : firstDraw ? drawn : upper(tell);
}
function drawSide(text) {
  $("tray").hidden = S.over;
  $("line").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = bestNow(), L = isLevel() ? levelOf(S.lv) : null, more = L && COURSE.some(x => x.id === L.id + 1);
    $("verdict").textContent = L ? (S.won ? `Level ${L.id} done in ${S.pumps} pump${S.pumps === 1 ? "" : "s"}: ${"★".repeat(starsFor(L, S.pumps))}${"☆".repeat(3 - starsFor(L, S.pumps))} (par ${L.par})`
        : `${S.lives <= 0 ? "A third spill" : "Out of pumps"}: ${S.shipped} of ${S.goal} shipped`)
      : `A third spill: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    $("againBtn").textContent = L ? (S.won ? "Replay" : "Try again") : "New game";
    $("nextBtn").hidden = !(L && S.won && more);
    $("result").classList.toggle("two", !!L);
    return;
  }
  $("drawBtn").hidden = !rule(S, "draw");
  $("tray").classList.toggle("nodraw", !rule(S, "draw"));
  $("line").textContent = text ?? sideLine();
  for (const b of document.querySelectorAll(".st-card:not(.st-draw)")) {
    const slot = Number(b.dataset.slot), g = S.hand[slot];
    b.classList.toggle("picked", slot === picked);
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    const sw = el("svg", { viewBox: "0 0 10 7.4", class: "st-swatch", "aria-hidden": "true" }, parcelEl(g, 0, -1, "", null, FLAT.row).firstChild);
    b.replaceChildren(sw, Object.assign(document.createElement("b"), { textContent: NAMES[g] }), Object.assign(document.createElement("span"), { textContent: `${DENSITY[g]} kg/m³` }));
    b.setAttribute("aria-label", `${NAMES[g]}, ${DENSITY[g]} kg per cubic metre: drag it onto a tank`);
  }
  // the draw-off: ready, or how many pumps until it is
  const d = $("drawBtn"), ready = S.untilDraw === 0, can = draws(S).length > 0;
  d.disabled = !ready || !can;
  d.classList.toggle("ready", ready && can);
  d.classList.toggle("picked", picked === DRAWN);
  d.classList.toggle("lifted", drag?.slot === DRAWN && drag.moved);
  // a hyphen that never breaks: the card is narrow
  d.replaceChildren(valveEl(), Object.assign(document.createElement("b"), { textContent: "Draw\u2011off" }),
    Object.assign(document.createElement("span"), { textContent: !ready ? `in ${S.untilDraw}` : can ? "ready" : "nothing to drain" }));
  d.setAttribute("aria-label", ready ? "Draw-off ready: drag it onto a tank to drain the water and slops from its foot" : `Draw-off ready in ${S.untilDraw} pumps`);
}
/** A valve's handwheel, for the draw-off. */
function valveEl() {
  const spokes = [0, 60, 120].map(a => { const r = (a * Math.PI) / 180; return el("path", { d: `M${(5 - 2.6 * Math.cos(r)).toFixed(2)} ${(3.7 - 2.6 * Math.sin(r)).toFixed(2)}L${(5 + 2.6 * Math.cos(r)).toFixed(2)} ${(3.7 + 2.6 * Math.sin(r)).toFixed(2)}` }); });
  return el("svg", { viewBox: "0 0 10 7.4", class: "st-swatch st-valve", "aria-hidden": "true" }, el("circle", { cx: 5, cy: 3.7, r: 2.9 }), ...spokes, el("circle", { class: "st-hub", cx: 5, cy: 3.7, r: .8 }));
}
function render() { drawBoard(S.tanks, { sour: S.sour, wait: waiting(S.tanks, S.want) }); drawStrip(); drawSide(); }
/** What a draw-off on a tank would do, shown: the farm with its foot drained, what would ship ringed. */
function showDraw(t) {
  const k = foot(S.tanks[t]);
  if (!k) { drawBoard(S.tanks, { aim: t }); drawSide(`Tank ${t + 1} has no water or slops at its foot`); return; }
  const out = S.tanks[t].slice(0, k), after = S.tanks.map((x, i) => (i === t ? x.slice(k) : x.slice())), r = ship(after, S.want), n = r.waves.reduce((a, w) => a + w.length, 0);
  const water = out.filter(g => g === WATER).length, slops = k - water;
  drawBoard(after, { ring: lines(after, S.want), wait: waiting(after, S.want), aim: t, tag: n ? [`+${fmt(worth(n))}`, t] : null });
  drawSide(`Draw off tank ${t + 1}: ${[water ? `${water} water` : "", slops ? `${slops} slops` : ""].filter(Boolean).join(" and ")} drained${n ? `, ${n} parcels ship, +${fmt(worth(n))}` : ", nothing lines up"}`);
}
/** What pumping the parcel in a slot into a tank would do, shown. */
function show(slot, t) {
  if (slot === DRAWN) { showDraw(t); return; }
  const g = S.hand[slot], level = settles(S.tanks[t], g), after = pumped(S.tanks, t, g), r = ship(after, S.want);
  const n = r.waves.reduce((a, w) => a + w.length, 0), spills = r.tanks[t].length > LEVELS, wait = waiting(after, S.want);
  drawBoard(after, { ring: lines(after, S.want), wait, fresh: [t, level], aim: t, tag: n ? [`+${fmt(worth(n))}`, t] : null });
  // a line of three of another grade made (four would ship): it stands ready for its grade's tanker
  drawSide(spills ? `Tank ${t + 1} would be over full: its ${named(r.tanks[t].at(-1))} spills, a life`
    : n ? `${NAMES[g]} into tank ${t + 1}: ${n} parcels ship out${r.waves.length > 1 ? ` in ${r.waves.length} waves` : ""}, +${fmt(worth(n))}`
      : wait.some(([a, b]) => a === t && b === level) ? `${NAMES[g]} into tank ${t + 1}: ${isFarm() ? `a 2 by 2 of ${named(g)}` : `three ${named(g)} in a line`}, ready for ${vessel(g)} or ${isFarm() ? "a 3 by 2" : "a fourth"}`
        : `${NAMES[g]} into tank ${t + 1}: it settles at level ${level + 1}${after[t].length > level + 1 ? `, lifting ${after[t].length - level - 1} above it` : ""}`);
}

// ---------- a pump ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
const node = (t, level) => $("board").querySelector(`[data-key="${t}:${level}"] > g`);
/** Moves drawn parcels from where they stood: [t, level now, level before] (before LEVELS + 1: in from the pipe). */
function slide(moves, ms = 220) {
  if (V3) return V3.slide(moves, ms);
  return Promise.all(moves.map(([t, now, was]) => animate(node(t, now), [{ transform: `translateY(${((now - was) * LAY.LH).toFixed(2)}px)` }, { transform: "translateY(0)" }], { duration: ms, easing: "ease-out" })));
}
/** A parcel settling into a tank: it comes down the pipe, the lighter ones above it rise a level. */
async function settleIn(tanks, t, g) {
  const level = settles(tanks[t], g), after = pumped(tanks, t, g);
  drawBoard(after, { fresh: [t, level] });
  const rise = [];
  for (let k = level + 1; k < after[t].length; k++) rise.push([t, k, k - 1]);
  await slide([[t, level, LEVELS + 1], ...rise], 260);
  return after;
}
/** A draw-off: the foot of tank t (k parcels) drains away through the floor, and what stood on it drops. */
async function drain(tanks, t, k) {
  drawBoard(tanks, { aim: t });
  const out = [];
  if (V3) out.push(V3.drain(t, k));
  else for (let level = 0; level < k; level++) out.push(animate(node(t, level), [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${(LAY.LH * 1.2).toFixed(2)}px)`, opacity: 0 }], { duration: 320, easing: "ease-in" }));
  await Promise.all(out);
  const after = tanks.map((x, i) => (i === t ? x.slice(k) : x.slice()));
  drawBoard(after);
  await slide(after[t].map((_, level) => [t, level, level + k]), 260);
  return after;
}
/** Lines shipping out, wave after wave, what floated above dropping into their places: the tanks after. */
async function shipOut(tanks, waves) {
  for (const wave of waves) {
    drawBoard(tanks, { ring: wave.map(([a, b]) => [a, b]) });
    await wait(260);
    if (V3) V3.shipFx(wave);
    else {
      const fx = $("board").querySelector("#fx");
      for (const [a, b, g] of wave) { const p = parcelEl(g, a, b); fx.append(p); animate(p.firstChild, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-6px)", opacity: 0 }], { duration: 300, easing: "ease-in" }).then(() => p.remove()); }
    }
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
  return tanks;
}
async function commit(slot, t) {
  if (playing || S.over) return;
  const drawing = slot === DRAWN;
  if (drawing && !foot(S.tanks[t])) { toast(`Tank ${t + 1} has no water or slops at its foot`); picked = -1; render(); return; }
  playing = true;
  picked = -1;
  const before = S, told = read(JETTY, 0), r = drawing ? drawOff(S, t) : pump(S, slot, t);
  S = r.state;
  berth = before;
  save();
  if (isLevel()) { if (S.won) keepStars(); }   // counted the moment it's final, not when the result opens
  else {
    if (S.score > bestNow()) write(bestKey(), S.score);
    if (told < 3 && (read(SEEN, false) || before.pumps > 0)) write(JETTY, told + 1);
    if (S.pumps >= 3) write(SEEN, true);
    if (drawing) write(DREW, true);
  }
  drawSide(" ");
  if (V3 && r.delivered.length) V3.truckCall(r.delivered[0].g);   // the delivery's truck drives in while the pump plays out
  let tanks = drawing ? await drain(before.tanks, t, r.drained.length) : await settleIn(before.tanks, t, r.grade);
  tanks = await shipOut(tanks, r.waves);
  if (r.gain) popup(r.waves.flat(), r.gain);
  if (r.spilled >= 0) {
    // the parcel over the top runs off
    tanks[t] = tanks[t].slice(0, LEVELS);
    drawBoard(tanks);
    if (V3) V3.spill(t, r.spilled);
    else {
      const p = parcelEl(r.spilled, t, LEVELS, "spill");
      $("board").querySelector("#fx").append(p);
      animate(p.firstChild, [{ transform: "translate(0, 0)", opacity: 1 }, { transform: "translate(6px, 10px) rotate(25deg)", opacity: 0 }], { duration: 500, easing: "ease-in" });
    }
    toast(S.over ? "A third spill" : `Tank ${t + 1} spills its ${named(r.spilled)}: ${S.lives} ${S.lives === 1 ? "life" : "lives"} left`);
    await wait(450);
  }
  // the next tanker comes in, and what stands ready for it ships
  if (r.tanker) {
    berth = S;
    drawBoard(tanks);
    if (V3) V3.tankerIn();
    else animate($("board").querySelector(".st-ship"), [{ transform: "translateX(-18px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 520, easing: "ease-out" });
    await wait(V3 ? 920 : 560);
    const n = r.tanker.waves.reduce((a, w) => a + w.length, 0);
    tanks = await shipOut(tanks, r.tanker.waves);
    if (n) { popup(r.tanker.waves.flat(), r.tanker.gain); toast(`${upper(vessel(r.tanker.want))} is in: ${n} parcels ship, +${fmt(r.tanker.gain)}`); }
  }
  berth = null;
  drawStrip();
  for (const d of r.delivered) { if (V3) await V3.truckTo(d.t, d.g); tanks = await settleIn(tanks, d.t, d.g); }
  V3?.truckGo();
  render();
  // FAME left on water too long: slops where it stood
  if (r.soured.length) {
    if (V3) V3.souredFx(r.soured);
    else for (const [a, b] of r.soured) animate(node(a, b), [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 520, easing: "ease-in-out" });
    toast(`${r.soured.map(([a]) => `Tank ${a + 1}'s`).join(" and ")} FAME has soured on the water: slops`);
  }
  playing = false;
  if (S.over) roundOver("settle");
}
function popup(cells, gain) {
  if (V3) { V3.pop(cells, gain, cells.length >= 6); return; }
  const fx = $("board").querySelector("#fx");
  const x = cells.reduce((a, c) => a + tx(c[0]) + LAY.TW / 2, 0) / cells.length, y = cells.reduce((a, c) => a + ly(c[1], c[0]) + LAY.LH / 2, 0) / cells.length;
  const t = el("text", { class: `st-pop${cells.length >= 6 ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = `+${fmt(gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 1000, easing: "ease-out" });
}

// ---------- holding a parcel over the farm ----------
/** The tank under a point on the screen (anywhere over its column), or -1. */
function tankAt(px, py) {
  if (V3) return V3.tankAt(px, py);
  const m = $("board").getScreenCTM();
  if (!m) return -1;
  const p = new DOMPoint(px, py).matrixTransform(m.inverse());
  if (isFarm()) {
    // a finger in the gap between cells belongs to the nearer one
    const c = Math.floor((p.x + LAY.GAP / 2) / (LAY.TW + LAY.GAP)), r = Math.floor((p.y + LAY.ROWGAP / 2) / (LAY.ROWH + LAY.ROWGAP));
    return c >= 0 && c < LAY.COLS && r >= 0 && r < LAY.COLS && p.y < 3 * LAY.ROWH + 2 * LAY.ROWGAP + 3 ? r * LAY.COLS + c : -1;
  }
  const t = Math.floor((p.x + LAY.GAP / 2) / (LAY.TW + LAY.GAP));
  return t >= 0 && t < TANKS && p.y > -11 && p.y < LAY.BASE + 4 ? t : -1;
}
function startDrag(e, slot) {
  if (playing || S.over || e.button > 0 || e.currentTarget.disabled) return;
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
  if (playing || S.over || drag || picked === -1) return;
  const t = tankAt(e.clientX, e.clientY);
  if (t >= 0) commit(picked, t);
}
function hoverBoard(e) {
  if (e.pointerType !== "mouse" || picked === -1 || drag || playing) return;
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
/** The levels as a grid of numbers with their stars; the ones not yet open are dimmed. */
function levelGrid() {
  const grid = document.createElement("div");
  grid.className = "st-levels";
  for (const L of COURSE) {
    const b = document.createElement("button"), n = done[L.id]?.stars || 0, open = isOpen(L.id, done);
    b.type = "button";
    b.className = `st-lv${isLevel() && S.lv === L.id ? " now" : ""}`;
    b.disabled = !open;
    b.innerHTML = `<b>${L.id}</b><i>${"\u2605".repeat(n)}${"\u2606".repeat(3 - n)}</i>`;
    b.setAttribute("aria-label", `Level ${L.id}, ${L.name}${open ? `, ${n} of 3 stars` : ", locked: finish the one before"}`);
    b.addEventListener("click", () => { $("menuDlg").close(); openLevel(L); });
    grid.append(b);
  }
  return grid;
}
/** Levels or the endless game: each keeps its own run, so switching loses nothing. */
function switchMode(m) {
  if (m === "levels") {
    const g = read(LRUN, null);
    if (valid(g) && g.goal != null && levelOf(g.lv)) { S = g; write(MODE, "levels"); drag = null; picked = -1; render(); }
    else openLevel(nextUp());
  } else {
    const g = read(RUN, null);
    if (valid(g) && g.goal == null) { S = upgrade(g); write(MODE, "endless"); drag = null; picked = -1; render(); } else newRun();
  }
  openMenu();
}
/** The Row (six tanks, levels and the endless game) or the Farm (nine in a 3x3): each keeps its own runs, so switching loses nothing. */
function switchKind(kind) {
  if (kind === KIND) return;
  const was3d = !!V3;
  V3?.dispose();
  V3 = null;
  $("board").style.display = "";
  write(KINDK, kind);
  drag = null;
  picked = -1;
  openSaved(kind);
  if (was3d) showFarm(true, true);
  openMenu();
}
/** The game of a board to carry on with: the Row on the mode last played (the levels for a newcomer), the Farm's run. */
function openSaved(kind) {
  useEngine(kind);
  if (kind === "farm") {
    S = read(FRUN, null);
    if (valid(S)) { S = upgrade(S); render(); } else newRun();
    return;
  }
  const mode = read(MODE, null) ?? (valid(read(RUN, null)) ? "endless" : "levels");
  S = read(mode === "levels" ? LRUN : RUN, null);
  if (mode === "levels") {
    if (valid(S) && S.goal != null && levelOf(S.lv)) render(); else openLevel(nextUp());
  } else if (!valid(S)) newRun();
  else { S = upgrade(S); render(); }
}
function openMenu() {
  const body = $("menuBody"), L = isLevel() ? levelOf(S.lv) : null;
  body.replaceChildren();
  const play = part(body, "play");
  if (L) {
    const next = nextUp();
    play.append(action(S.over ? `Continue \u00b7 level ${next.id}` : `Continue level ${S.lv}`, () => { if (S.over) openLevel(next); }, "primary"),
      action("Restart this level", () => openLevel(L), "link"));
  } else play.append(action("New game", newRun, "primary"));
  const content = part(body, "content");
  content.append(choice("Board", [["row", "Row of six"], ["farm", "Farm of nine"]], KIND, switchKind));
  if (!isFarm()) content.append(choice("Game", [["levels", "Levels"], ["endless", "Endless"]], L ? "levels" : "endless", switchMode));
  if (L) content.append(levelGrid());
  if (!IN_FRAME) part(body, "settings").append(choice("View", [["flat", "Flat"], ["3d", "3D"]], wide() ? "3d" : "flat", v => { write(VIEW, v); showFarm(v === "3d"); }));
  const best = bestNow();
  part(body, "about").append(line(L ? `Level ${L.id}, ${L.name}: ship ${L.goal} in ${L.limit} pumps; par ${L.par}. ${starsAll()} of ${COURSE.length * 3} stars`
    : `This game: ${fmt(S.score)} in ${S.pumps} pump${S.pumps === 1 ? "" : "s"}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "settle");
document.querySelector(".st-mark").innerHTML = APPS.find(a => a.id === "settle").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".st-card")) b.addEventListener("pointerdown", e => startDrag(e, b.dataset.slot === DRAWN ? DRAWN : Number(b.dataset.slot)));
addEventListener("pointermove", moveDrag);
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", e => { if (drag?.id === e.pointerId) { drag = null; render(); } });
$("board").addEventListener("pointerup", tapBoard);
$("board").addEventListener("pointermove", hoverBoard);
$("againBtn").addEventListener("click", () => (isLevel() ? openLevel(levelOf(S.lv)) : newRun()));
$("nextBtn").addEventListener("click", () => openLevel(levelOf(S.lv + 1)));

// ---------- the 3D farm: the suite's default (mode3d.js) unless the player chose (VIEW is written only then) ----------
const wide = () => wants3D(read(VIEW, null), "3d");
/** Shows the farm in 3D (settle-3d.js) or flat; where there's no WebGL the flat farm stays and says why. */
async function showFarm(want3d, quiet = false) {
  if (want3d === !!V3) return;
  if (!want3d) { V3?.dispose(); V3 = null; $("board").style.display = ""; render(); return; }
  const done = busy("Building the tank farm");
  try {
    const mod = await import("./settle-3d.js");
    V3 = mod.create3D($("farm"), { tap: tapBoard, hover: hoverBoard, lost: () => { toast("The 3D farm lost its graphics: drawing the flat farm"); showFarm(false); } }, KIND);
    $("board").style.display = "none";
    render();
  } catch (err) {
    console.warn("Settle: no 3D here, so the farm is drawn flat.", err);
    V3 = null;
    $("board").style.display = "";
    if (!IN_FRAME && !quiet) toast("3D isn't available on this device: the farm stays flat");
  } finally { done(); }
}
onPause(() => V3?.pause(), ms => V3?.resume(ms));

// for tests and debugging
window.__settle = { get state() { return S; }, get kind() { return KIND; }, switchKind, commit, tankAt, newRun, openLevel, showFarm, get view() { return V3; } };

// opens on the board last played (the Row for a newcomer), the Row on the mode last played: the levels for a newcomer, the endless game for one who has a game saved
openSaved(read(KINDK, "row") === "farm" ? "farm" : "row");
if (wide()) { $("board").style.display = "none"; showFarm(true, read(VIEW, null) == null); }   // no flash of the flat farm first; a device that cannot is not told when it never asked
onDefaultChange(is3D => { if (read(VIEW, null) == null) showFarm(is3D, true); });   // Settings' 2D mode, live
