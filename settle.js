// Settle: six tanks of a tank farm, four grades settling by density. Drag one of the two parcels offered onto a tank
// (or tap it, then the tank); while it's held over a tank, the farm is shown as the parcel would leave it: where it
// settles, what it lifts, the lines that would ship out ringed, or the spill it would cause. Let go to pump it. The
// draw-off beside them, once ready, is dragged onto a tank the same way, to drain the water and slops from its foot;
// FAME standing on water shows how many pumps it has before it sours. Over the header pipe the tanker at the jetty
// shows the grade it takes by threes (any other by fours), and the next one's grade and when it comes; lines of three
// standing ready for their grade's tanker are dotted. The rules are settle-engine.js's; this file draws the farm, plays
// each move out and keeps the game.
import { TANKS, LEVELS, LIVES, NAMES, DENSITY, WATER, FAME, SLOP, SOUR, newGame, upgrade, settles, pumped, foot, lines, ship, pump, drawOff, draws, worth } from "./settle-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "settle:run", BEST = "settle:best", SEEN = "settle:seen", DREW = "settle:drew", JETTY = "settle:jetty";   // pumps made with the tanker explained
const TW = 10, GAP = 2, LH = 7.4, BASE = 60;   // a tank's width, the gap between, a level's height, the floor
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
let berth = null;        // the tanker drawn while a pump plays out ({ want, next, untilTanker }), else the game's

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
/** A parcel: its grade's colour and letter (slops speckled, an emulsion); placed by an outer group so its own can move. */
function parcelEl(g, t, level, cls = "", key = null) {
  const label = el("text", { class: "st-letter", x: TW / 2, y: LH / 2 + .1 });
  label.textContent = LETTER[g];
  const body = el("g", { class: `st-parcel k${g} ${cls}`.trim() }, el("rect", { x: .8, y: .35, width: TW - 1.6, height: LH - .7, rx: 1.1 }));
  if (g === SLOP) for (const [x, y, r] of [[2.3, 1.7, .45], [7.6, 2.2, .35], [2.9, 5.6, .35], [7.2, 5.4, .5]]) body.append(el("circle", { class: "st-bead", cx: x, cy: y, r }));
  body.append(label);
  return el("g", { transform: `translate(${tx(t)} ${ly(level).toFixed(2)})`, "data-key": key }, body);
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
  const by = el("text", { class: "st-jetty-t", x: 18.6, y: -10.4 }), when = el("text", { class: "st-jetty-t", x: 60.4, y: -10.4 }), then = el("text", { class: "st-jetty-t end", x: 52.2, y: -10.4 });
  by.textContent = "by threes";
  then.textContent = "next";
  when.textContent = `in ${untilTanker}`;
  const ship = el("g", { class: "st-ship" }, el("path", { class: "st-hull", d: "M.3 -10.2H17.2L15.6 -7.8H1.3Z" }), el("rect", { class: "st-hull", x: 1, y: -13.3, width: 3.4, height: 3.1, rx: .4 }), cargoEl(want, 5.4, -13, 10.8, 2.8));
  return el("g", { class: `st-jetty${dim ? " dim" : ""}` }, ship, by, then, cargoEl(next, 53.2, -11.8, 6.2, 2.8), when);
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
  for (const [t, level] of extra.wait || []) marks.append(el("rect", { class: "st-ring wait", x: tx(t) + .35, y: ly(level) - .05, width: TW - .7, height: LH + .1, rx: 1.4 }));
  for (const [t, level] of extra.ring || []) marks.append(el("rect", { class: "st-ring", x: tx(t) + .25, y: ly(level) - .15, width: TW - .5, height: LH + .3, rx: 1.5 }));
  // FAME on water: a mark where they meet, with the pumps left before it sours
  if (extra.sour) tanks.forEach((tank, t) => {
    const w = contact(tank), left = SOUR - extra.sour[t];
    if (w < 0 || !extra.sour[t]) return;
    const x = tx(t) + TW - .3, y = ly(w), n = el("text", { class: "st-sour-n", x, y: y + .1 });
    n.textContent = left;
    marks.append(el("g", { class: `st-sour${left <= 1 ? " due" : ""}` }, el("circle", { cx: x, cy: y, r: 2 }), n));
  });
  if (extra.tag) { const t = el("text", { class: "st-tag", x: Math.min(62, Math.max(8, tx(extra.tag[1]) + TW / 2)), y: -8 }); t.textContent = extra.tag[0]; marks.append(t); }
  $("board").replaceChildren(
    el("rect", { class: "st-ground", x: -2, y: BASE, width: 74, height: 3.5, rx: .8 }),
    jettyEl(berth ?? S, !!extra.tag), el("path", { class: "st-header", d: `M-1 -6.5H71` }), shells, parcels, marks, el("g", { id: "fx" }));
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
  // a first game's first pump, then the tanker for three pumps (once, for everyone); else the next delivery and the
  // FAME nearest souring
  const first = !read(SEEN, false) && S.pumps < 1, tanker = read(JETTY, 0) < 3;
  const souring = [...Array(TANKS).keys()].filter(t => S.sour[t] && contact(S.tanks[t]) >= 0).sort((a, b) => S.sour[b] - S.sour[a])[0];
  const when = n => (n === 1 ? "after this pump" : `in ${n} pumps`), firstDraw = !read(DREW, false) && draws(S).length > 0;
  $("line").textContent = text ?? (first ? "Drag a parcel onto a tank: it settles by density, the heaviest at the foot"
    : tanker ? `The ${S.want === WATER ? "barge" : "tanker"} in takes ${named(S.want)} by threes, other grades by fours; ${S.next === WATER ? "the water barge" : `${named(S.next)}'s`} is next`
      : firstDraw ? "A draw-off is ready: drag it onto a tank to drain the water and slops from its foot"
        : `A delivery comes ${when(S.untilDelivery)}${souring != null ? `; tank ${souring + 1}'s FAME on water sours ${when(SOUR - S.sour[souring])}` : ""}`);
  for (const b of document.querySelectorAll(".st-card:not(.st-draw)")) {
    const slot = Number(b.dataset.slot), g = S.hand[slot];
    b.classList.toggle("picked", slot === picked);
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    const sw = el("svg", { viewBox: `0 0 ${TW} ${LH}`, class: "st-swatch", "aria-hidden": "true" }, parcelEl(g, 0, -1).firstChild);
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
  return el("svg", { viewBox: `0 0 ${TW} ${LH}`, class: "st-swatch st-valve", "aria-hidden": "true" }, el("circle", { cx: 5, cy: 3.7, r: 2.9 }), ...spokes, el("circle", { class: "st-hub", cx: 5, cy: 3.7, r: .8 }));
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
      : wait.some(([a, b]) => a === t && b === level) ? `${NAMES[g]} into tank ${t + 1}: three ${named(g)} in a line, ready for ${vessel(g)} or a fourth`
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
  for (let level = 0; level < k; level++) out.push(animate(node(t, level), [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${(LH * 1.2).toFixed(2)}px)`, opacity: 0 }], { duration: 320, easing: "ease-in" }));
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
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (told < 3 && (read(SEEN, false) || before.pumps > 0)) write(JETTY, told + 1);
  if (S.pumps >= 3) write(SEEN, true);
  if (drawing) write(DREW, true);
  drawSide(" ");
  let tanks = drawing ? await drain(before.tanks, t, r.drained.length) : await settleIn(before.tanks, t, r.grade);
  tanks = await shipOut(tanks, r.waves);
  if (r.gain) popup(r.waves.flat(), r.gain);
  if (r.spilled >= 0) {
    // the parcel over the top runs off
    tanks[t] = tanks[t].slice(0, LEVELS);
    drawBoard(tanks);
    const p = parcelEl(r.spilled, t, LEVELS, "spill");
    $("board").querySelector("#fx").append(p);
    animate(p.firstChild, [{ transform: "translate(0, 0)", opacity: 1 }, { transform: "translate(6px, 10px) rotate(25deg)", opacity: 0 }], { duration: 500, easing: "ease-in" });
    toast(S.over ? "A third spill" : `Tank ${t + 1} spills its ${named(r.spilled)}: ${S.lives} ${S.lives === 1 ? "life" : "lives"} left`);
    await wait(450);
  }
  // the next tanker comes in, and what stands ready for it ships
  if (r.tanker) {
    berth = S;
    drawBoard(tanks);
    animate($("board").querySelector(".st-ship"), [{ transform: "translateX(-18px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 520, easing: "ease-out" });
    await wait(560);
    const n = r.tanker.waves.reduce((a, w) => a + w.length, 0);
    tanks = await shipOut(tanks, r.tanker.waves);
    if (n) { popup(r.tanker.waves.flat(), r.tanker.gain); toast(`${upper(vessel(r.tanker.want))} is in: ${n} parcels ship, +${fmt(r.tanker.gain)}`); }
  }
  berth = null;
  drawStrip();
  for (const d of r.delivered) tanks = await settleIn(tanks, d.t, d.g);
  render();
  // FAME left on water too long: slops where it stood
  if (r.soured.length) {
    for (const [a, b] of r.soured) animate(node(a, b), [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 520, easing: "ease-in-out" });
    toast(`${r.soured.map(([a]) => `Tank ${a + 1}'s`).join(" and ")} FAME has soured on the water: slops`);
  }
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
for (const b of document.querySelectorAll(".st-card")) b.addEventListener("pointerdown", e => startDrag(e, b.dataset.slot === DRAWN ? DRAWN : Number(b.dataset.slot)));
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
else { S = upgrade(S); render(); }
