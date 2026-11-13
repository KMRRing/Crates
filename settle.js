// Settle: a foundry. Crucibles stand side by side, metals poured into them settle by density (heaviest at the foot), and a
// block of the right parcels, as wide and tall as a standing order says, is cast and drawn off. Drag one of the two
// parcels offered onto a crucible (or tap it, then the crucible): held over one, the board shows the crucible as the pour
// would leave it (where the parcel settles, the block that would be cast ringed). Five chapters, each a metal combination with
// its own move (settle-alloys.js's CHAPTERS): the top of a crucible dragged onto another is tipped in (Solder, Silver); Fire and
// Stir, dragged like a parcel, melt a crucible's copper (Pewter) or turn it to bronze (Bronze); Skim takes dross or charcoal off.
// The rules are settle-engine.js's, the bots settle-solve.js's; this file draws the board on a canvas, plays each move out and
// keeps the game. Three ways to play, each with its own saved run: the levels, a random level (on a hidden ramp) and today's.
import { newGame, poured, placed, preview, skims, decants, fires, stirs, solidIn, act, worth, BURN_COST, SKIM, DECANT, FIRE, STIR } from "./settle-engine.js";
import { METALS, RECIPES, CHAPTERS, BURN } from "./settle-alloys.js";
import { LEVELS, levelOf, specOf, starsFor, isOpen, randomSpec, dailySpec, chapterOf, nextOf } from "./settle-levels.js";
import { valid } from "./settle-engine.js";
import { sound } from "./settle-sound.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, onPause, todayPart } from "./menu.js";
import { roundOver } from "./random.js";
import { noteStars, IN_FRAME, today, arrivedForToday } from "./suite.js";
import { ramp } from "./ramp.js";

const $ = id => document.getElementById(id);
const MODE = "settle:mode", CAMP = "settle:camp", LRUN = "settle:lrun", RRUN = "settle:rrun", DRUN = "settle:drun", DAILY = "settle:daily", BEST = "settle:best", SOUND = "settle:sound", VER = "settle:ver";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const wait = ms => new Promise(r => setTimeout(r, ms));

// The tank farm this page was before 8 November 2026 saved other things under the same prefix: cleared once, so nobody lands on a missing mode.
// 3 (13 November 2026): the five chapters' thirty levels replaced the nine, so the old levels' stars and every saved melt go.
if (!IN_FRAME && read(VER, 0) !== 3) {
  try { for (const k of ["settle:run", "settle:lrun", "settle:rrun", "settle:drun", "settle:camp", "settle:levels", "settle:mode", "settle:seen", "settle:drew", "settle:jetty", "suite:settle-view"]) localStorage.removeItem(k); } catch { /* private mode */ }
  write(VER, 3);
}
sound.on = read(SOUND, true) !== false;

let S = null;            // the game (settle-engine.js's), as saved
let mode = "levels";     // levels, random or daily
let day = 0;             // the day (YYYYMMDD) while today's melt is being played
let playing = false;     // a move being played out
let drag = null;         // a parcel, an action or a crucible's top held: { slot, id, x0, y0, moved, c, from }
let picked = null;       // a card tapped, to use with a tap on a crucible
let msg = "";            // what the last move did, until the next
let camp = read(CAMP, {});   // { level id: { stars, turns } }
const starsAll = () => Object.values(camp).reduce((n, d) => n + (d?.stars || 0), 0);
const SKIMMING = -1, ACTING = -5, TIPPING = -2;     // the skim's slot, the chapter's action's (fire or stir), a crucible's top held

// ---------- the game in play ----------
const isLevel = () => mode === "levels";
function save() {
  if (mode === "daily") write(DRUN, { day, s: S });
  else write(mode === "levels" ? LRUN : RRUN, S);
}
function begin(s, m) {
  S = s; mode = m; drag = null; picked = null; msg = ""; playing = false;
  if (m !== "daily") day = 0;
  if (m !== "daily") write(MODE, m);   // today's is a visit, not a place to be left in
  save();
  buildOrders();
  render();
}
const nextUp = () => LEVELS.find(L => !camp[L.id]?.stars) ?? LEVELS.at(-1);
const chapter = () => CHAPTERS.find(c => c.id === S.ch) ?? CHAPTERS[0];
/** The chapter's action (fire or stir), or null. */
const actKind = () => (S.feats.fire ? FIRE : S.feats.stir ? STIR : null);
/** A move as the engine takes it, from a slot (0 or 1, the skim, the action, a top held: its crucible `from`) and a crucible. */
const moveOf = (slot, c, from) => (slot >= 0 ? [slot, c] : slot === SKIMMING ? [SKIM, c] : slot === ACTING ? [actKind(), c] : [DECANT, from, c]);
const openLevel = L => begin(newGame(specOf(L), L.seed), "levels");
function openRandom() {
  const seed = Math.floor(Math.random() * 2 ** 31), s = newGame(randomSpec(ramp("settle", LEVELS.map(L => L.id)), seed), seed);
  s.lv = 0;
  begin(s, "random");
}
function playDaily() {
  day = today();
  const kept = read(DRUN, null);
  if (kept && kept.day === day && valid(kept.s)) begin(kept.s, "daily");
  else { const { spec, seed } = dailySpec(day); begin(newGame(spec, seed), "daily"); }
}
function keepStars() {
  const L = levelOf(S.lv), stars = starsFor(L, S.pours), was = camp[L.id];
  camp = { ...camp, [L.id]: { stars: Math.max(was?.stars || 0, stars), turns: Math.min(was?.turns ?? Infinity, S.pours) } };
  write(CAMP, camp);
  noteStars("settle", starsAll());
}

// ---------- the board, on a canvas ----------
const board = $("board"), ctx = board.getContext("2d");
let dpr = 1, theme = {};
const glyphs = Object.fromEntries(Object.entries(METALS).map(([k, m]) => [k, new Path2D(m.glyph)]));
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
function readTheme() {
  const cs = getComputedStyle(document.documentElement), v = (n, d) => cs.getPropertyValue(n).trim() || d;
  theme = { ink: v("--ink", "#222"), brass: v("--brass", "#a8802a"), vat: v("--st-vat", "#2a2630"), rule: v("--rule", "#888"), danger: v("--st-danger", "#a8382b") };
}
function fit() {
  const farm = $("farm"), w = farm.clientWidth, h = farm.clientHeight;
  if (!w || !h) return;
  dpr = Math.min(2, devicePixelRatio || 1);
  board.width = Math.round(w * dpr); board.height = Math.round(h * dpr);
  board.style.width = `${w}px`; board.style.height = `${h}px`;
}
/** Where the crucibles stand, in canvas pixels: cell width cw and height ch, the gap between, the left edge and the floor. */
function geo() {
  const W = board.width / dpr, H = board.height / dpr, gap = 12, ch0 = (H - 10) / (S.height + .15);
  const cw = Math.min((W - 8 - gap * (S.cols - 1)) / S.cols, ch0 * 1.5), ch = Math.min(ch0, cw * 1.4);
  return { W, H, gap, cw, ch, x0: (W - (S.cols * cw + (S.cols - 1) * gap)) / 2, floor: H - 6 };
}
const colX = (g, c) => g.x0 + c * (g.cw + g.gap);
const cellY = (g, level) => g.floor - (level + 1) * g.ch;
/** The crucible under a point of the page (anywhere over its column), or -1. */
function crucibleAt(px, py) {
  if (!S) return -1;
  const r = board.getBoundingClientRect(), g = geo(), x = px - r.left, y = py - r.top;
  if (y < -8 || y > r.height + 8) return -1;
  for (let c = 0; c < S.cols; c++) if (x >= colX(g, c) - g.gap / 2 && x <= colX(g, c) + g.cw + g.gap / 2) return c;
  return -1;
}

let view = null;         // what the board shows now: { tanks, ghost, ring, held, stream, flash, target }
let fx = [];             // pops and sparks
function paintCell(g, c, level, p, { alpha = 1, top = false, t = 0 } = {}) {
  const m = METALS[p.m], x = colX(g, c), y = cellY(g, level), w = g.cw, h = g.ch;
  const wave = top ? Math.sin(t / 380 + c * 1.7) * 1.1 : 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(x, y + wave, w, h - wave);
  ctx.fillStyle = m.base; ctx.fill();
  const sheen = ctx.createLinearGradient(x, y, x, y + h);
  sheen.addColorStop(0, rgba(m.hi, .9 * m.shine)); sheen.addColorStop(.4, rgba(m.hi, .22 * m.shine)); sheen.addColorStop(1, "rgba(0,0,0,.22)");
  ctx.fillStyle = sheen; ctx.fill();
  if (m.shine > .6) {   // a bright metal gets a slanting streak
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = rgba(m.hi, .28 * m.shine);
    ctx.beginPath(); ctx.moveTo(x + w * .12, y + h); ctx.lineTo(x + w * .34, y); ctx.lineTo(x + w * .46, y); ctx.lineTo(x + w * .24, y + h); ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;
  // zinc left on top darkens towards dross as it ages, with a pip for each pour it has left
  if (p.m === "Zn" && S.burn && top && p.a > 0) {
    ctx.fillStyle = `rgba(30,22,14,${.12 + .5 * p.a / BURN})`; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#fff";
    for (let i = 0; i < BURN - p.a; i++) { ctx.beginPath(); ctx.arc(x + 5 + i * 6, y + 5, 2, 0, 7); ctx.fill(); }
  }
  if (p.s) {   // solid copper: a cold lump, hatched, not yet melted into the rest
    ctx.fillStyle = "rgba(20,12,8,.38)"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,200,160,.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); for (let k = -h; k < w; k += 7) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); } ctx.save(); ctx.rect(x, y, w, h); ctx.clip(); ctx.stroke(); ctx.restore();
  }
  ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  const s = Math.min(w, h) * .62;
  ctx.translate(x + (w - s) / 2, y + (h - s) / 2); ctx.scale(s / 24, s / 24);
  ctx.strokeStyle = "rgba(20,16,10,.7)"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.stroke(glyphs[p.m]);
  ctx.restore();
}
function paint(now) {
  if (!S || !view) return;
  const g = geo();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, g.W, g.H);
  for (let c = 0; c < S.cols; c++) {
    const x = colX(g, c), top = cellY(g, S.height - 1);
    ctx.fillStyle = theme.vat; ctx.globalAlpha = view.target === c ? .75 : 1;
    ctx.fillRect(x - 3, top, g.cw + 6, g.floor - top + 3); ctx.globalAlpha = 1;
    if (S.hot?.[c]) {   // a fired crucible glows from below
      const glow = ctx.createLinearGradient(0, g.floor - g.ch * 1.5, 0, g.floor + 3), k = .75 + .25 * Math.sin(now / 300 + c);
      glow.addColorStop(0, "rgba(255,120,30,0)"); glow.addColorStop(1, `rgba(255,120,30,${.55 * k})`);
      ctx.fillStyle = glow; ctx.fillRect(x - 3, g.floor - g.ch * 1.5, g.cw + 6, g.ch * 1.5 + 3);
    }
    if (S.feats.pot && c === 0) { ctx.fillStyle = theme.brass; ctx.font = "800 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("POT", x + g.cw / 2, top - 4); }
    const t = view.tanks[c];
    t.forEach((p, l) => paintCell(g, c, l, p, { top: l === t.length - 1, t: now }));
    ctx.strokeStyle = theme.brass; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 3, top); ctx.lineTo(x - 3, g.floor + 3); ctx.lineTo(x + g.cw + 3, g.floor + 3); ctx.lineTo(x + g.cw + 3, top); ctx.stroke();
  }
  if (view.ghost) {   // where the parcel held would settle
    const { c, level, m, s: solid } = view.ghost;
    paintCell(g, c, level, { m, a: 0, s: solid }, { alpha: .55 });
    ctx.setLineDash([4, 3]); ctx.strokeStyle = theme.ink; ctx.lineWidth = 1.5; ctx.strokeRect(colX(g, c) + 1, cellY(g, level) + 1, g.cw - 2, g.ch - 2); ctx.setLineDash([]);
  }
  if (view.ring) for (const [c, l] of view.ring) { ctx.strokeStyle = theme.brass; ctx.lineWidth = 3; ctx.strokeRect(colX(g, c) + 1.5, cellY(g, l) + 1.5, g.cw - 3, g.ch - 3); }
  if (view.flash) { const k = .5 + .5 * Math.sin(now / 70); for (const [c, l] of view.flash) { ctx.fillStyle = `rgba(255,236,170,${.25 + .45 * k})`; ctx.fillRect(colX(g, c), cellY(g, l), g.cw, g.ch); } }
  if (view.stream) {   // a stream falling from the lip into the crucible
    const { c, m, t0 } = view.stream, k = Math.min(1, (now - t0) / 260), x = colX(g, c) + g.cw / 2, top = cellY(g, S.height - 1) - 10;
    const to = cellY(g, view.tanks[c].length) ;
    ctx.fillStyle = METALS[m].base; ctx.fillRect(x - 4, top, 8, Math.max(0, (to - top) * k));
  }
  if (view.held) { const { m, x, y } = view.held, s = Math.min(g.cw, g.ch) * .9; ctx.save(); ctx.globalAlpha = .9; ctx.fillStyle = METALS[m].base; ctx.fillRect(x - s / 2, y - s / 2, s, s); ctx.restore(); ctx.save(); ctx.translate(x - s * .3, y - s * .3); ctx.scale(s * .6 / 24, s * .6 / 24); ctx.strokeStyle = "rgba(20,16,10,.7)"; ctx.lineWidth = 2.4; ctx.stroke(glyphs[m]); ctx.restore(); }
  fx = fx.filter(f => now - f.t0 < f.life);
  for (const f of fx) {
    const k = (now - f.t0) / f.life;
    if (f.kind === "pop") { ctx.globalAlpha = 1 - k; ctx.fillStyle = theme.brass; ctx.font = "800 18px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(f.text, f.x, f.y - 26 * k); ctx.globalAlpha = 1; }
    else { const e = now - f.t0; ctx.globalAlpha = 1 - k; ctx.fillStyle = f.color; ctx.fillRect(f.x + f.vx * e / 16, f.y + f.vy * e / 16 + .0009 * e * e / 2, 3, 3); ctx.globalAlpha = 1; }
  }
  if (view.tag) { ctx.fillStyle = theme.brass; ctx.font = "800 15px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(view.tag.text, view.tag.x, view.tag.y); }
}
let paused = false, looping = false;
function loop(now) {
  if (paused) { looping = false; return; }
  paint(now);
  requestAnimationFrame(loop);
}
function start() { if (!looping) { looping = true; requestAnimationFrame(loop); } }
onPause(() => { paused = true; }, () => { paused = false; start(); });
const pop = (c, level, text) => { const g = geo(); fx.push({ kind: "pop", text, x: colX(g, c) + g.cw / 2, y: cellY(g, level), t0: performance.now(), life: 1000 }); };
function sparks(c, level) {
  const g = geo(), now = performance.now();
  for (let i = 0; i < 12; i++) fx.push({ kind: "spark", x: colX(g, c) + Math.random() * g.cw, y: cellY(g, level) + g.ch / 2, vx: (Math.random() - .5) * 3, vy: -Math.random() * 4, color: i % 2 ? "#ffd27a" : "#fff3c4", t0: now, life: 700 });
}

// ---------- the page around the board ----------
const symbol = m => m;
function chipOf(m, cls = "") {
  const k = METALS[m];
  return `<i class="${cls}" style="background:linear-gradient(180deg,${rgba(k.hi, .55 * k.shine + .1)},${k.base})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${k.glyph}"/></svg></i>`;
}
function buildOrders() {
  const box = $("orders");
  box.style.setProperty("--n", S.orders.length);
  box.replaceChildren();
  for (const id of S.orders) {
    const r = RECIPES[id], cells = Object.entries(r.parts).sort((a, b) => METALS[b[0]].dens - METALS[a[0]].dens).flatMap(([m, k]) => Array(k).fill(m));
    const rows = [];   // the heaviest at the foot, filled along each row from the bottom
    for (let y = 0; y < r.k; y++) rows.unshift(cells.slice(y * r.w, (y + 1) * r.w));
    const card = document.createElement("div");
    card.className = "st-order"; card.dataset.id = id;
    card.innerHTML = `<h2>${r.name}</h2><div class="st-block" style="--w:${r.w}">${rows.flat().map(m => `<i style="background:linear-gradient(180deg,${rgba(METALS[m].hi, .5 * METALS[m].shine + .1)},${METALS[m].base})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${METALS[m].glyph}"/></svg></i>`).join("")}</div>`
      + `<p><span class="st-parts">${Object.entries(r.parts).map(([m, k]) => `${symbol(m)} ${k}`).join(" · ")}</span><br>${r.w} × ${r.k}</p>`;
    box.append(card);
  }
}
function drawStrip() {
  const L = isLevel() ? levelOf(S.lv) : null, next = S.deal ? S.deal.slice(S.n, S.n + 3) : [];
  $("stripA").innerHTML = `Cast <b>${S.casts}</b> of ${S.goal}${S.feats.fire ? ` · fuel <b>${S.fuel}</b>` : ""}`;
  $("stripB").innerHTML = `Turn <b>${S.pours}</b>${S.limit ? ` of ${S.limit}` : ""}${L ? ` · par ${L.par}` : mode === "daily" ? " · today" : ""}${next.length ? ` · then ${next.map(m => chipOf(m, "st-next")).join("")}` : S.deal ? " · the last" : ""}`;
}
/** An action card (fire, stir or skim): its mark, its name, whether it can be used now. */
function actionCard(btn, kind, ready, word) {
  const name = kind === FIRE ? "Fire" : kind === STIR ? "Stir" : "Skim", slot = kind === SKIM ? SKIMMING : ACTING;
  btn.disabled = !ready;
  btn.classList.toggle("ready", ready);
  btn.classList.toggle("picked", picked === slot);
  btn.classList.toggle("lifted", !!drag?.moved && drag.slot === slot);
  const mark = kind === FIRE ? '<path d="M12 21c-4 0-6-3-5-7c1-3 4-4 4-8c3 2 6 6 5 10c2-1 2-3 2-3c2 4 0 8-6 8Z"/>' : kind === STIR ? '<path d="M5 3l9 12M14 15c3 1 5 3 4 5c-1 2-6 1-8-1c-1-2 1-4 4-4Z"/>' : '<path d="M2 3h8M6 3v6"/><circle cx="14" cy="11" r="5"/><path d="M19 11h3"/>';
  btn.innerHTML = `<svg class="st-ladle" viewBox="0 0 24 ${kind === SKIM ? 18 : 24}" aria-hidden="true">${mark}</svg><b>${name}</b><span>${word}</span>`;
}
function drawTray() {
  const over = S.over, tray = $("tray"), kind = actKind(), skimOn = !!S.feats.skim;
  tray.hidden = over; $("line").hidden = over; $("result").hidden = !over;
  tray.classList.toggle("noskim", !kind && !skimOn);
  tray.classList.toggle("acts2", !!kind && skimOn);
  S.hand.forEach((m, i) => {
    const b = tray.children[i];
    if (!m) { b.innerHTML = "<b>—</b><span>none left</span>"; b.disabled = true; b.removeAttribute("aria-label"); return; }
    const k = METALS[m];
    b.disabled = false;
    b.innerHTML = `<span class="st-chip" style="background:linear-gradient(180deg,${rgba(k.hi, .55 * k.shine + .1)},${k.base})"><svg class="st-stamp" viewBox="0 0 24 24" aria-hidden="true"><path d="${k.glyph}"/></svg></span><b>${k.name}</b><span>${k.dens} g/cm³</span>`;
    b.classList.toggle("picked", picked === i);
    b.classList.toggle("lifted", !!drag?.moved && drag.slot === i);
    b.setAttribute("aria-label", `${k.name}, density ${k.dens}`);
  });
  const ab = $("actBtn");
  ab.hidden = !kind;
  if (kind === FIRE) actionCard(ab, FIRE, !over && fires(S).length > 0, S.fuel ? `${S.fuel} left` : "no fuel");
  if (kind === STIR) actionCard(ab, STIR, !over && stirs(S).length > 0, "3 copper : 1 tin");
  const sk = $("skimBtn");
  sk.hidden = !skimOn;
  if (skimOn) actionCard(sk, SKIM, !over && skims(S).length > 0, skims(S).length ? "a top to skim" : "nothing on top");
}
function drawResult() {
  if (!S.over) return;
  const L = isLevel() ? levelOf(S.lv) : null, again = $("againBtn"), next = $("nextBtn"), box = $("result");
  let text;
  if (S.won) {
    if (L) { const n = starsFor(L, S.pours); text = `Cast ${S.goal} in ${plural(S.pours, "turn")} (par ${L.par}) · ${"★".repeat(n)}${"☆".repeat(3 - n)}`; }
    else text = `Melt won: ${S.goal} cast in ${plural(S.pours, "turn")}`;
  } else text = S.limit && S.pours >= S.limit ? `The fire is out after ${plural(S.limit, "turn")}, with ${S.casts} of ${S.goal} cast` : `No move left, with ${S.casts} of ${S.goal} cast`;
  $("verdict").textContent = text;
  const nextLevel = L && S.won ? nextOf(L) : null;
  again.hidden = mode === "daily";
  again.textContent = mode === "levels" ? (S.won ? "Replay" : "Try again") : "New melt";
  next.hidden = mode === "daily" ? false : !nextLevel;
  next.textContent = mode === "daily" ? "Back to levels" : "Next level";
  box.classList.toggle("two", !again.hidden && !next.hidden);
}
function render(keepLine = false) {
  if (!S) return;
  readTheme(); fit();
  view = { tanks: S.tanks, ...(picked === TIPPING ? { target: pickedFrom } : {}) };
  if (!keepLine) $("line").textContent = msg || (S.pours === 0 ? chapter().how : "");
  drawStrip(); drawTray(); drawResult();
  $("board").setAttribute("aria-label", `Crucibles: ${S.tanks.map((t, i) => `${i + 1}: ${t.map(p => METALS[p.m].name).join(", ") || "empty"}`).join("; ")}`);
  start();
}

// ---------- holding a parcel over the crucibles ----------
function describe(r, mv) {
  const bits = [];
  bits.push(mv[0] >= 0 ? `Settles at level ${r.level + 1}` : mv[0] === SKIM ? "Skims the top off: a turn" : mv[0] === DECANT ? `Tips in at level ${r.level + 1}: a turn` : mv[0] === FIRE ? `Fires it: a turn and fuel (${S.fuel - 1} left)` : r.spoiled ? "Stirs it: the wrong measure spoils it" : "Stirs it to bronze: a turn");
  if (r.leached?.length) bits.push(`the lead takes the silver of ${plural(r.leached.length, "black copper")}`);
  if (r.casts.length) bits.push(`casts ${r.casts.map(x => x.name).join(", ")} +${fmt(r.gain)}`);
  if (r.burnt.length) bits.push(`${plural(r.burnt.length, "zinc")} burns to dross −${BURN_COST * r.burnt.length}`);
  return bits.join(" · ");
}
/** The crucibles as a move would leave them before anything is cast (where the parcel settles), for the board while it is held. */
function before(mv) {
  const [k, a, b] = mv;
  if (k >= 0) return poured(S.tanks, a, S.hand[k], solidIn(S, a)).tanks;
  if (k === SKIM) return S.tanks.map((t, i) => (i === a ? t.slice(0, -1) : t));
  if (k === DECANT) { const held = S.tanks.map(t => t.slice()), p = held[a].pop(); return placed(held, b, { m: p.m, a: 0 }).tanks; }
  return S.tanks;
}
function show(slot, c, from = drag?.from) {
  const mv = moveOf(slot, c, from);
  let r;
  try { r = act(S, mv); } catch { view = { tanks: S.tanks, target: c }; $("line").textContent = slot >= 0 ? (S.feats.pot && c ? "Every parcel goes into the pot" : "That crucible is full") : slot === TIPPING ? "It can't be tipped there" : "Nothing to do there"; return; }
  const tanks = before(mv), g = geo();
  view = { tanks, target: c, ghost: mv[0] >= 0 || mv[0] === DECANT ? { c, level: r.level, m: tanks[c][r.level]?.m ?? "X", s: tanks[c][r.level]?.s } : null, ring: r.casts[0]?.cells.map(([x, y]) => [x, y]) ?? null };
  if (r.gain) view.tag = { text: `+${fmt(r.gain)}`, x: colX(g, c) + g.cw / 2, y: cellY(g, S.height - 1) - 4 };
  $("line").textContent = describe(r, mv);
}
function startDrag(e, slot) {
  if (playing || S.over || e.button > 0 || e.currentTarget.disabled) return;
  e.preventDefault();
  sound.unlock();
  drag = { slot, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, c: -1 };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
}
/** A finger down on a crucible whose top can be tipped (Solder, Silver): it is held like a parcel. */
function boardDown(e) {
  if (playing || !S || S.over || e.button > 0 || !S.feats.decant || picked !== null) return;
  const c = crucibleAt(e.clientX, e.clientY);
  if (c < 0 || !decants(S).some(([a]) => a === c)) return;
  sound.unlock();
  drag = { slot: TIPPING, from: c, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, c: -1 };
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.moved = true; picked = null; sound.play("tick"); drawTray(); }
  if (!drag.moved) return;
  const c = crucibleAt(e.clientX, e.clientY), r = board.getBoundingClientRect(), self = drag.slot === TIPPING && c === drag.from;
  if (c !== drag.c) { drag.c = c; if (c >= 0 && !self) show(drag.slot, c); else { view = { tanks: S.tanks }; $("line").textContent = ""; } }
  const held = drag.slot >= 0 ? S.hand[drag.slot] : drag.slot === TIPPING ? S.tanks[drag.from].at(-1)?.m : null;
  if (held) view = { ...view, held: { m: held, x: e.clientX - r.left, y: e.clientY - r.top } };
}
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { slot, c, moved, from } = drag;
  drag = null;
  if (moved && c >= 0 && !(slot === TIPPING && c === from)) { commit(moveOf(slot, c, from)); return; }
  if (!moved) {
    if (slot === TIPPING) { picked = TIPPING; pickedFrom = from; sound.play("tick"); $("line").textContent = "Tap the crucible to tip it into"; render(true); return; }
    picked = picked === slot ? null : slot;
    sound.play("tick");
    // one crucible to skim: a tap on Skim is enough
    if (picked === SKIMMING && skims(S).length === 1) { const only = skims(S)[0]; picked = null; commit([SKIM, only]); return; }
    if (picked === ACTING) { $("line").textContent = actKind() === FIRE ? "Tap the crucible to fire" : "Tap the crucible to stir"; render(true); return; }
  }
  render();
}
let pickedFrom = -1;     // the crucible whose top was tapped, to tip with a tap on another
function tapBoard(e) {
  if (playing || !S || S.over || drag || picked === null) return;
  const c = crucibleAt(e.clientX, e.clientY);
  if (c < 0) return;
  if (picked === TIPPING && c === pickedFrom) { picked = null; render(); return; }
  commit(moveOf(picked, c, pickedFrom));
}
function hoverBoard(e) {
  if (e.pointerType !== "mouse" || picked === null || drag || playing) return;
  const c = crucibleAt(e.clientX, e.clientY);
  if (c >= 0 && !(picked === TIPPING && c === pickedFrom)) show(picked, c, pickedFrom); else { view = { tanks: S.tanks }; $("line").textContent = ""; }
}

/** Plays a move out and keeps it: the stream falls (or the top is tipped), the parcel settles, each block cast flashes and rings,
 *  zinc hisses to dross, a fired crucible glows, a stirred one turns to bronze. */
async function commit(mv) {
  if (playing || S.over) return;
  let r;
  try { r = act(S, mv); } catch { sound.play("nope"); picked = null; render(); return; }
  playing = true; picked = null; drag = null;
  const [k, a, b] = mv, c = k === DECANT ? b : a, m = k >= 0 ? S.hand[k] : k === DECANT ? S.tanks[a].at(-1).m : null;
  $("line").textContent = "";
  drawTray();
  const tanks = before(mv);
  if (m) {
    view = { tanks: k === DECANT ? S.tanks.map((t, i) => (i === a ? t.slice(0, -1) : t)) : S.tanks, stream: { c, m, t0: performance.now() } };
    sound.play("glug"); await wait(260);
    view = { tanks }; sound.play("clunk"); await wait(150);
  } else if (k === SKIM) {
    view = { tanks }; sound.play("skim"); await wait(240);
  } else {
    view = { tanks: S.tanks, flash: S.tanks[c].map((_, l) => [c, l]) }; sound.play(k === FIRE ? "hiss" : "glug"); await wait(420);
  }
  for (const [bc, bl] of r.burnt) { sound.play("hiss"); pop(bc, bl, `−${BURN_COST}`); }
  for (const [i, cast] of r.casts.entries()) {
    if (i === 0) view = { tanks: k === FIRE || k === STIR ? r.state.tanks : tanks, flash: cast.cells.map(([x, y]) => [x, y]) };
    sound.play("cast", { k: i });
    pop(cast.c, cast.r + cast.k - 1, `+${fmt(cast.gain)}`);
    for (const [x, y] of cast.cells) sparks(x, y);
    document.querySelector(`.st-order[data-id="${cast.id}"]`)?.classList.add("hit");
    await wait(420);
  }
  setTimeout(() => document.querySelectorAll(".st-order.hit").forEach(n => n.classList.remove("hit")), 500);
  S = r.state;
  msg = [r.leached?.length ? "The lead took the silver" : "", r.spoiled ? "The wrong measure: spoiled to dross" : "", r.casts.length ? `Cast ${r.casts.map(x => x.name).join(", ")} +${fmt(r.gain)}` : "", r.burnt.length ? `Zinc burned to dross −${r.lost}` : ""].filter(Boolean).join(" · ");
  save();
  playing = false;
  if (S.over) finish();
  render();
}
/** The melt is over: its stars, best, daily record and ramp are kept, and a Random round ends. */
function finish() {
  sound.play(S.won ? "win" : "lose");
  if (mode === "levels" && S.won) keepStars();
  if (mode === "random") S.won ? ramp.won(S.burned === 0) : ramp.lost();
  if (mode === "daily") write(DAILY, { ...read(DAILY, {}), [day]: { won: S.won, turns: S.pours, score: S.score, casts: S.casts } });
  if (S.won && S.score > read(BEST, 0)) write(BEST, S.score);
  roundOver("settle");
}

// ---------- messages, the menu ----------
let toastTimer = 0;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
function levelGrid(C) {
  const grid = document.createElement("div");
  grid.className = "st-levels";
  for (const L of LEVELS.filter(x => x.ch === C.id)) {
    const b = document.createElement("button"), n = camp[L.id]?.stars || 0, open = isOpen(L.id, camp);
    b.type = "button";
    b.className = `st-lv${mode === "levels" && S.lv === L.id ? " now" : ""}`;
    b.disabled = !open;
    b.innerHTML = `<b>${L.id}</b><i>${"★".repeat(n)}${"☆".repeat(3 - n)}</i>`;
    b.setAttribute("aria-label", `Level ${L.id}, ${L.name}${open ? `, ${n} of 3 stars` : ", locked: finish the one before"}`);
    b.addEventListener("click", () => { $("menuDlg").close(); openLevel(L); });
    grid.append(b);
  }
  return grid;
}
const alloyCard = id => {
  const r = RECIPES[id], d = document.createElement("div");
  d.className = "st-alloy";
  d.innerHTML = `<b></b> — ${Object.entries(r.parts).map(([m, k]) => `${m} ${k}`).join(" : ")}, ${r.w} × ${r.k}<small></small>`;
  d.querySelector("b").textContent = r.name;
  d.querySelector("small").textContent = r.real;
  return d;
};
/** Where a game left in a mode can be picked up again. */
function resumeOf(m) {
  const g = read(m === "levels" ? LRUN : RRUN, null);
  return valid(g) && !g.over && (m === "levels" ? levelOf(g.lv) : g.lv === 0) ? g : null;
}
function openMenu() {
  const body = $("menuBody"), L = isLevel() ? levelOf(S.lv) : null;
  body.replaceChildren();
  const play = part(body, "play");
  if (mode === "levels") play.append(action(`Restart level ${L.id}`, () => openLevel(L), "primary"));
  else if (mode === "random") play.append(action("New random melt", openRandom, "primary"));
  else play.append(action("Back to levels", () => { const g = resumeOf("levels"); if (g) begin(g, "levels"); else openLevel(nextUp()); }, "link"));
  const content = part(body, "content");
  const got = read(DAILY, {})[today()];
  todayPart(body, {
    done: !!got, result: got ? (got.won ? `${plural(got.turns, "turn")}, ${fmt(got.score)}` : "not won") : "",
    play: playDaily, playing: mode === "daily",
    back: mode === "daily" ? { text: "Back to your melt", fn: () => { const g = resumeOf("levels"); if (g) begin(g, "levels"); else openLevel(nextUp()); } } : null,
  });
  if (mode !== "random") content.append(action("Random melt", () => { const g = resumeOf("random"); if (g) begin(g, "random"); else openRandom(); }, "link"));
  for (const C of CHAPTERS) {
    const h = document.createElement("p");
    h.className = "st-tier";
    h.innerHTML = "<span></span> <small></small>";
    h.firstChild.textContent = `${C.id} · ${C.name}`;
    h.lastChild.textContent = C.idea;
    content.append(h, levelGrid(C));
  }
  if (!IN_FRAME) part(body, "settings").append(toggle("Sound", sound.on, on => { sound.on = on; write(SOUND, on); if (on) sound.unlock(); }));
  const about = part(body, "about");
  about.append(line(`${starsAll()} of ${LEVELS.length * 3} stars. Metals settle by density: lead 11.3, copper 9.0, bronze 8.8, tin 7.3, zinc 7.1; charcoal and dross float. ${chapter().how}`));
  const best = read(BEST, 0);
  if (best) about.append(line(`Best score ${fmt(best)}`));
  for (const id of S.orders) about.append(alloyCard(id));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "settle");
document.querySelector(".st-mark").innerHTML = APPS.find(a => a.id === "settle").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("tray").querySelectorAll(".st-card").forEach(b => b.addEventListener("pointerdown", e => startDrag(e, b.dataset.slot === "skim" ? SKIMMING : b.dataset.slot === "act" ? ACTING : Number(b.dataset.slot))));
board.addEventListener("pointerdown", boardDown);
addEventListener("pointermove", moveDrag);
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", e => { if (drag?.id === e.pointerId) { drag = null; render(); } });
board.addEventListener("pointerup", tapBoard);
board.addEventListener("pointermove", hoverBoard);
$("againBtn").addEventListener("click", async () => {
  if (mode === "levels") openLevel(levelOf(S.lv)); else openRandom();
});
$("nextBtn").addEventListener("click", () => {
  if (mode === "daily") { const g = resumeOf("levels"); if (g) begin(g, "levels"); else openLevel(nextUp()); } else openLevel(nextOf(levelOf(S.lv)) ?? levelOf(S.lv));
});
new ResizeObserver(() => { if (S) render(); }).observe($("farm"));
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", readTheme);

// for tests and debugging
window.__settle = { get state() { return S; }, get mode() { return mode; }, commit, crucibleAt, openLevel, openRandom, playDaily, geo, toast };

// opens on the mode last played; the tile opens today's melt while it is still to play (the run in hand is kept as it was)
const last = read(MODE, "levels");
if (last === "random" && resumeOf("random")) begin(resumeOf("random"), "random");
else { const g = resumeOf("levels"); if (g) begin(g, "levels"); else openLevel(nextUp()); }
if (!IN_FRAME && arrivedForToday() && !read(DAILY, {})[today()]) playDaily();
