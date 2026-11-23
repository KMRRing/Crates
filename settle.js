// Crucible (Settle's files; renamed 23 November 2026): a foundry puzzle. A row of crucibles of molten metal, which always lies by weight: lead at
// the foot, copper, tin on top. Tip one crucible into another (tap it, then where it pours; or drag) and all its top metal pours
// across, as much as fits, and sinks to its place. Only the top ever comes out. The moulds above are the goal: a crucible holding
// exactly a mould's recipe is cast into it at once. Cast them all, in as few pours as you can: the par is the fewest possible.
// The rules and solver are settle-engine.js's, the levels settle-levels.js's, the foundry drawn in 2D (settle-draw.js) or 3D
// (settle-3d.js, the player's choice); this file keeps the run, plays each pour out and builds the page. Three ways to play: the
// levels (eight chapters, each adding a twist: spare metal, dross, the teapot ladle, zinc and charcoal, liquation), a random melt
// (on a hidden ramp) and today's.
import { startOf, pour, pourOf, won, solve, bestMove, starsFor, topOf, layersOf, keyOf, winsTable } from "./settle-engine.js";
import { METALS, mouldOf } from "./settle-alloys.js";
import { LEVELS, CHAPTERS, levelById, chapterOf, playOf, meltOf, MELTS } from "./settle-levels.js";
import { createFlat } from "./settle-draw.js";
import { sound } from "./settle-sound.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, choice, onPause, isPaused, todayPart, volume } from "./menu.js";
import { roundOver } from "./random.js";
import { noteStars, IN_FRAME, today, arrivedForToday } from "./suite.js";
import { ramp } from "./ramp.js";
import { load3d, busy } from "./loading.js";
import { wants3D } from "./mode3d.js";

const $ = id => document.getElementById(id);
const VER = "settle:ver", MODE = "settle:mode", CAMP = "settle:camp", LRUN = "settle:lrun", RRUN = "settle:rrun", DRUN = "settle:drun", DAILY = "settle:daily", VIEW = "settle:view";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// 4 (23 November 2026): the redesign; the old levels' stars and every saved melt go
if (!IN_FRAME && read(VER, 0) !== 4) {
  try { for (const k of [MODE, CAMP, LRUN, RRUN, DRUN, DAILY, "settle:best", "settle:run", "settle:levels", "settle:seen", "settle:ramp"]) localStorage.removeItem(k); } catch { /* private mode */ }
  write(VER, 4);
}

// ---------- the run ----------
// R: { lv (the level: a book level, or a melt's whole spec), state ({ cups, cast }), moves, undo ([{ state, moves }]), hints, won }
let R = null, L = null;          // the run, and the engine's level of it
let mode = "levels", day = 0;
let camp = read(CAMP, {});       // { level id: { stars, moves } }
let picked = -1, hint = null, msg = "", anim = null, stuck = false;
const starsAll = () => Object.values(camp).reduce((n, d) => n + (d?.stars || 0), 0);
const isOpen = L0 => { const i = LEVELS.indexOf(L0); return i === 0 || !!camp[LEVELS[i - 1]?.id]?.stars; };
const nextUp = () => LEVELS.find(x => !camp[x.id]?.stars) ?? LEVELS.at(-1);
const rungNow = () => Number(ramp("settle", MELTS.map((_, i) => String(i + 1)))) - 1;

function save() {
  if (mode === "daily") write(DRUN, { day, run: R });
  else write(mode === "levels" ? LRUN : RRUN, R);
}
function validRun(r) {
  try { if (!r?.lv?.caps || !r.state?.cups) return false; const E = playOf(r.lv); return r.state.cups.length === E.caps.length && r.state.cups.every(c => c.length === E.metals.length) && r.state.cast.length === E.moulds.length; } catch { return false; }
}
// ---------- the solver's table ----------
// Every state reachable from the level's start, with its moves left to win, worked out once a level in a worker (settle-solve-worker.js):
// whether the moulds can still all be cast after a pour, and the Hint's pour, are then looked up. Until it comes nothing is called stuck;
// a state it does not know (a run kept from before a change to the rules) is searched for on the spot.
let table = null, tableFor = null, solver = null, asked = 0;
const tableWaits = [];
function askTable(lv) {
  table = null; tableFor = lv;
  const n = ++asked, got = t => {
    if (n !== asked) return;
    table = t;
    stuck = !won(R.state) && winsFrom(R.state) === undefined;
    if (stuck) msg = STUCK;
    tableWaits.splice(0).forEach(f => f());
    render();
  };
  if (solver === null) { try { solver = new Worker(new URL("./settle-solve-worker.js", import.meta.url), { type: "module" }); } catch { solver = false; } }
  if (!solver) { setTimeout(() => { const E = playOf(lv); got(solve(E, startOf(E)).toWin); }, 0); return; }
  solver.onmessage = ({ data }) => { if (data.n === asked) got(winsTable(data.ids, data.d)); };
  solver.postMessage({ n, lv });
}
/** The moves left to win from a state, undefined when none wins; null while the table is still coming. */
function winsFrom(s) {
  if (!table) return null;
  const k = keyOf(s);
  return table.ids.has(k) ? table.get(k) : solve(L, s).toWin.get(k);
}
const tableReady = () => (table ? Promise.resolve() : new Promise(ok => tableWaits.push(ok)));
const STUCK = "No way to cast every mould from here: undo, or start again.";

function begin(run, m) {
  R = run; mode = m; L = playOf(R.lv); picked = -1; hint = null; msg = ""; anim = null; waiting.length = 0;
  if (m !== "daily") { day = 0; write(MODE, m); }
  stuck = false;
  if (tableFor !== R.lv) askTable(R.lv);
  save();
  view?.layout(L.caps, L.kinds);
  buildMoulds();
  render();
}
const fresh = lv => ({ lv, state: startOf(playOf(lv)), moves: 0, undo: [], hints: 0, won: false });
const openLevel = lv => begin(fresh(lv), "levels");
function openRandom() {
  const kept = read(RRUN, null);
  if (validRun(kept) && !kept.won && kept.moves > 0 && mode === "random") ramp.lost();     // a melt left unfinished counts as a loss
  begin(fresh(meltOf(rungNow(), Math.floor(Math.random() * 2 ** 31))), "random");
}
function playDaily() {
  day = today();
  const kept = read(DRUN, null);
  if (kept?.day === day && validRun(kept.run)) begin(kept.run, "daily");
  else begin(fresh({ ...meltOf("daily", day), name: "Today's melt" }), "daily");
}
function resumeOf(m) { const r = read(m === "levels" ? LRUN : RRUN, null); return validRun(r) && !r.won && (m !== "levels" || levelById(r.lv.id)) ? r : null; }
const backToLevels = () => { const r = resumeOf("levels"); if (r) begin(r, "levels"); else openLevel(nextUp()); };

// ---------- the moves ----------
/** Tip a into b: played out, then kept. */
function tryPour(a, b) {
  if (R.won || won(R.state)) return;
  const p = pourOf(L, R.state, a, b);
  if (!p) { sound.play("refuse"); shake(b); picked = -1; render(); return; }
  const r = pour(L, R.state, a, b);
  R.undo.push({ state: R.state, moves: R.moves }); if (R.undo.length > 300) R.undo.shift();
  const before = R.state;
  R.state = r.state; R.moves++; picked = -1; hint = null;
  msg = r.casts.length ? `Cast ${r.casts.map(c => mouldOf(R.lv.moulds[c.mould]).name).join(" and ")}` : "";
  stuck = !won(R.state) && winsFrom(R.state) === undefined;
  if (stuck) msg = STUCK;
  save();
  startPour(a, b, before, r);
  if (won(R.state)) finishSoon = true;
  render();
}
let finishSoon = false;
function undo() {
  if (anim) skipAnim();
  if (!R.undo.length || R.won) return;
  const u = R.undo.pop();
  R.state = u.state; R.moves = u.moves; picked = -1; hint = null; msg = ""; stuck = !won(R.state) && winsFrom(R.state) === undefined;
  sound.play("undo"); save(); refreshMoulds(); render();
}
function restart() {
  if (anim) skipAnim();
  if (R.won) { begin(fresh(R.lv), mode); return; }
  if (!R.moves) return;
  R.undo.push({ state: R.state, moves: R.moves });
  R.state = startOf(L); R.moves = 0; picked = -1; hint = null; msg = ""; stuck = false;
  sound.play("undo"); save(); refreshMoulds(); render();
}
async function showHint() {
  if (anim || R.won) return;
  if (!table) { const done = busy("Working out the pours"), lv = R.lv; await tableReady(); done(); if (R.lv !== lv || anim || R.won) return; }
  const k = keyOf(R.state), mv = bestMove(L, R.state, table.ids.has(k) ? table : solve(L, R.state).toWin);
  if (!mv) { msg = STUCK; render(); return; }
  hint = { from: mv[0], to: mv[1] }; R.hints++; picked = -1;
  msg = `Tip ${cupName(mv[0])} into ${cupName(mv[1])}.`;
  sound.play("hint"); save(); render();
}
const cupName = i => ["the first", "the second", "the third", "the fourth", "the fifth"][i] || `crucible ${i + 1}`;
function finish() {
  finishSoon = false;
  R.won = true;
  const stars = starsFor(R.lv.par, R.moves);
  sound.play("win");
  if (mode === "levels") {
    const was = camp[R.lv.id];
    camp = { ...camp, [R.lv.id]: { stars: Math.max(was?.stars || 0, stars), moves: Math.min(was?.moves ?? Infinity, R.moves) } };
    write(CAMP, camp); noteStars("settle", starsAll());
  }
  if (mode === "random") { rungNow(); ramp.won(R.moves <= R.lv.par + 2 && !R.hints); }
  if (mode === "daily") write(DAILY, { ...read(DAILY, {}), [day]: { moves: R.moves, par: R.lv.par } });
  save();
  roundOver("settle");
  render();
}

// ---------- the pour, played out ----------
// A pour is played on the run at once and its picture waits its turn: the next can be asked for while one is still pouring, and
// any number can wait (Korbi, 23 Nov 2026: "allow the user to queue the next pour while the current one is still going; the old
// animation should just speed up a bit but they should then go one after the other, queue should be able to get indefinitely
// long"). The one playing keeps its own clock, which runs faster while others wait.
const T_TILT = 380, T_SINK = 480, T_HEAT = 280, T_DRAIN = 440, T_BURN = 700;   // carried over and tipped, the pour sinking, a cast's heat and its draining, zinc burning
const pourTime = n => 300 + 140 * n;
const hurry = () => (waiting.length >= 3 ? 2.2 : waiting.length ? 1.6 : 1);
let pace = 1;                                                        // (tests slow the pour down to look at it)
const waiting = [];                                                  // the pours after the one playing (anim)
function startPour(a, b, before, r) {
  const m = r.poured.metal, under = r.poured.under, bb = layersOf(before.cups[b]);
  // what runs out, in the order it leaves: the top metal, and after a skim the measure of metal under the dross
  const out = [...Array(r.poured.n).fill(m), ...(under >= 0 ? [under] : [])], n = out.length;
  const sinks = bb.some(x => x < m) || under >= 0;                   // something lighter in the way: the pour sinks through it
  const flowEnd = T_TILT + pourTime(n);
  // its sounds, cued by its own clock: the tongs lift it, the metal runs as long as the pour (at the speed it is shown), it settles, it casts
  const cues = [{ at: T_TILT, play: () => sound.play("pour", { weight: (METALS[L.metals[m]].dens - 7) / 4.5, n, len: pourTime(n) / 1000 / (hurry() / pace) }) }];
  if (sinks) cues.push({ at: flowEnd, play: () => sound.play("settle") });
  if (r.liquated) cues.push({ at: flowEnd + T_SINK * 0.6, play: () => sound.play("liquate") });
  r.casts.forEach((c, k) => cues.push({ at: flowEnd + T_SINK + k * 150, play: () => sound.play("cast", { k }) }));
  if (r.burnt.length) cues.push({ at: flowEnd + T_SINK, play: () => { sound.play("burn"); r.burnt.forEach(x => view?.smoke?.(x.cup)); } });
  const tail = Math.max(r.casts.length ? T_HEAT + T_DRAIN : 0, r.burnt.length ? T_BURN : 0);
  const item = { a, b, before, after: r.state, mid: r.mid, liquated: r.liquated, burnt: r.burnt, m, n, out, casts: r.casts, sinks, e: 0, cues, dur: flowEnd + T_SINK + tail };
  if (anim) waiting.push(item); else begun(item);
  wake();
}
/** A pour's picture begins: the tongs take the crucible, its clock from nought. */
function begun(item) {
  anim = item;
  sound.play("pick");
  refreshMoulds();
}
/** The clock of the pour playing moves on by dt (real ms); its cues sound as they pass; done, the next begins. */
function advance(dt) {
  if (!anim) return;
  anim.e += dt * hurry() / pace;
  for (const c of anim.cues) if (!c.done && anim.e >= c.at) { c.done = true; c.play(); }
  if (anim.e < anim.dur) return;
  const next = waiting.shift();
  if (next) { begun(next); return; }
  anim = null; refreshMoulds();
  if (finishSoon) finish(); else render();
}
function skipAnim() { if (anim) { anim = null; waiting.length = 0; refreshMoulds(); if (finishSoon) finish(); } }
/** The scene to draw now: the crucibles' bands, tilts, the stream, the hint. */
function sceneOf(now) {
  const st = anim ? anim.before : R.state, cups = st.cups.map(c => ({ bands: layersOf(c).map((x, k) => ({ m: L.metals[x], y: k, h: 1 })), lift: 0 }));
  let stream = null;
  if (anim) {
    const { a, b, m, n, out, before, casts, e } = anim, P = pourTime(n);
    const TT = T_TILT, TS = T_SINK, flow = clamp01((e - TT) / P), sink = ease(clamp01((e - TT - P) / TS));
    cups[a].go = { to: b, k: e < TT + P ? ease(clamp01(e / TT)) : 1 - sink, flow };
    // the source drains: the metal poured, from the top (a teapot ladle from the foot), and what lies above it comes down
    const from = cups[a].bands, order = L.kinds[a] === "teapot" ? from.map((_, k) => k) : from.map((_, k) => from.length - 1 - k);
    // each measure that runs out drains the nearest band of its metal, one after another
    out.forEach((x, j) => {
      const take = clamp01(n * flow - j);
      for (const k of order) if (from[k].m === L.metals[x] && !from[k].out) { from[k].out = true; from[k].h = 1 - take; break; }
    });
    let acc = 0;
    for (const bd of from) { bd.y = acc; acc += bd.h; }
    // the target fills on top, then everything sinks to its place by weight (heaviest at the foot; what was there first stays under
    // what came of the same metal) and what is lighter rises
    const bb = layersOf(before.cups[b]), all = [...bb.map((x, j) => ({ x, from: j, k: -1 })), ...out.map((x, k) => ({ x, from: bb.length + k, k }))];
    const to = all.slice().sort((p, q) => p.x - q.x || p.from - q.from);
    to.forEach((p, j) => { p.to = j; });
    // what has landed: the stream's head reaches the mouth a little after the metal leaves the lip (as the stream below runs)
    const landed = clamp01((flow - 0.375) / 0.625);
    cups[b].bands = all.map(p => ({ m: L.metals[p.x], y: p.from + (p.to - p.from) * sink, h: p.k < 0 ? 1 : clamp01(n * landed - p.k) }));
    if (flow > 0 && flow < 1.15) stream = { from: a, to: b, m: L.metals[out[Math.min(n - 1, Math.floor(n * clamp01(flow * 1.3)))]], t0: clamp01(flow * 1.6), t1: clamp01(flow * 1.6 - 0.6) };
    // the liquation: as the lead sinks through the black copper, both turn (rich lead under, plain copper over), with a flare
    if (anim.liquated && sink > 0.6) {
      const flare = 1 - clamp01((sink - 0.6) / 0.4) * 0.6;
      cups[b].bands = layersOf(anim.mid).map((x, j) => ({ m: L.metals[x], y: j, h: 1, hot: (x === L.Pr || x === L.Cu) ? 0.35 * flare : 0 }));
    }
    // zinc left with no charcoal burns away in a flicker of smoke
    const be = e - TT - P - TS;
    for (const x of anim.burnt) {
      if (be < 0) continue;
      const gone = clamp01(be / T_BURN);
      for (const bd of cups[x.cup].bands) if (bd.m === "Zn") { bd.a = 1 - gone; bd.hot = 0.5 * Math.sin(Math.PI * gone); }
    }
    // a cast: white heat, then it drains into the mould
    const ce = e - TT - P - TS;
    for (const c of casts) {
      if (ce < 0) continue;
      const hot = clamp01(ce / T_HEAT), gone = clamp01((ce - T_HEAT) / T_DRAIN);
      for (const bd of cups[c.cup].bands) { bd.hot = hot * (1 - gone); bd.a = 1 - gone; }
      if (!c.sparked && ce > T_HEAT * 0.6) { c.sparked = true; view?.burst(c.cup, now); castMould(c.mould); }
    }
  }
  // the crucible picked, and where it may pour (the next pour can be picked while one plays: rings only then, nothing lifted)
  if (R && !R.won && picked >= 0) {
    cups[picked].lift = anim ? 0 : 1; cups[picked].picked = true;
    cups.forEach((c, i) => { if (i !== picked && pourOf(L, R.state, picked, i)) c.target = true; });
  }
  return { caps: L.caps, kinds: L.kinds, cups, stream, hint: anim ? null : hint };
}

// ---------- the foundry, 2D or 3D ----------
let view = null, viewKind = "";
const wants3d = () => wants3D(read(VIEW, null), "3d");
async function setView(kind) {
  if (viewKind === kind && view) return;
  view?.destroy(); view = null; viewKind = kind;
  const host = $("foundry");
  $("app").classList.toggle("view3d", kind === "3d");
  if (kind === "3d") {
    try { const m = await load3d(import("./settle-3d.js"), "Lighting the hearth"); if (viewKind !== "3d") return; view = m.createFoundry(host); }
    catch (err) { console.warn("Crucible: no 3D here.", err); viewKind = "flat"; $("app").classList.remove("view3d"); view = createFlat(host); }
  } else view = createFlat(host);
  view.canvas.setAttribute("aria-label", "The crucibles in section, the metal in each lying by weight");
  if (L) view.layout(L.caps, L.kinds);
  wake();
}

// ---------- drawing: every frame while something moves, a few a second for the hearth's glow ----------
let raf = 0, lastFrame = 0, lastTick = 0;
function wake() { if (!raf) raf = requestAnimationFrame(tick); }
function tick(now) {
  raf = 0;
  if (document.hidden || isPaused()) { lastTick = 0; return; }
  const dt = lastTick ? Math.min(100, now - lastTick) : 16;
  lastTick = now;
  advance(dt);
  if (anim || now - lastFrame > 66) {                                   // the hearth breathes at 15 frames a second when nothing moves
    lastFrame = now;
    if (view && R) view.frame(sceneOf(now), now);
  }
  raf = requestAnimationFrame(tick);
}
onPause(() => { cancelAnimationFrame(raf); raf = 0; sound.hearth(false); }, () => { wake(); sound.hearth(true); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); sound.hearth(!document.hidden); });

// ---------- the page around it ----------
function mouldSvg(mo) {
  const parts = L.metals.map((m, i) => [m, mo[i]]).filter(([, n]) => n), total = parts.reduce((t, [, n]) => t + n, 0);
  let y = 46, bands = "";
  for (const [m, n] of parts) {
    const h = 30 * n / total; y -= h;
    bands += `<rect class="st-mband" x="13" y="${y.toFixed(1)}" width="54" height="${h.toFixed(1)}" fill="${METALS[m].base}"/><rect x="13" y="${y.toFixed(1)}" width="54" height="1.2" fill="${METALS[m].hi}" opacity=".8"/>`;
  }
  // the ingot it casts: its metals' colours mixed in their measures
  const rgb = parts.reduce((t, [m, n]) => { const v = parseInt(METALS[m].base.slice(1), 16); return [t[0] + (v >> 16) * n / total, t[1] + ((v >> 8) & 255) * n / total, t[2] + (v & 255) * n / total]; }, [0, 0, 0]).map(Math.round);
  return `<svg viewBox="0 0 80 52" aria-hidden="true"><path class="st-mtray" d="M4 12h72l-6 38H10z"/><g class="st-mfill">${bands}</g><path class="st-mingot" d="M13 16h54l-4 30H17z" fill="rgb(${rgb.join(",")})"/><text class="st-mstamp" x="40" y="35">✦</text></svg>`;
}
function buildMoulds() {
  const box = $("moulds");
  box.replaceChildren();
  L.moulds.forEach((mo, i) => {
    const d = document.createElement("div"), M = mouldOf(R.lv.moulds[i]);
    d.className = "st-mould"; d.dataset.i = i;
    d.innerHTML = `${mouldSvg(mo)}<b></b><small></small>`;
    d.querySelector("b").textContent = M.name;
    d.querySelector("small").textContent = L.metals.map((m, k) => (mo[k] ? `${mo[k]} ${METALS[m].name.toLowerCase()}` : "")).filter(Boolean).join(" · ");
    box.append(d);
  });
  refreshMoulds();
}
/** The moulds as cast in the run (one being cast now is shown when its metal reaches it). */
function refreshMoulds() {
  const st = anim ? anim.before : R.state;
  for (const d of $("moulds").children) {
    const i = Number(d.dataset.i), cast = st.cast[i] || (anim && anim.casts.some(c => c.mould === i && c.sparked));
    d.classList.toggle("cast", !!cast);
    d.setAttribute("aria-label", `${d.querySelector("b").textContent}, ${d.querySelector("small").textContent}${cast ? ", cast" : ""}`);
  }
}
function castMould(i) { const d = $("moulds").querySelector(`[data-i="${i}"]`); if (d) { d.classList.add("cast", "hit"); setTimeout(() => d.classList.remove("hit"), 900); } }
function shake(i) { $("foundry").classList.remove("shake"); void $("foundry").offsetWidth; $("foundry").classList.add("shake"); }

function render() {
  if (!R) return;
  const title = mode === "levels" ? `${R.lv.id} · ${R.lv.name}` : mode === "daily" ? "Today's melt" : "Random melt";
  $("stripA").textContent = title;
  $("stripB").textContent = `Pours ${R.moves} · par ${R.lv.par}`;
  const ch = chapterOf(R.lv);
  $("line").textContent = msg || (R.moves === 0 && R.lv.tip ? R.lv.tip : R.moves === 0 && ch ? ch.idea : "");
  $("line").classList.toggle("warn", stuck);
  $("undoBtn").disabled = !R.undo.length || R.won;
  $("restartBtn").disabled = !R.moves && !R.won;
  $("hintBtn").disabled = R.won;
  $("controls").hidden = R.won;
  $("result").hidden = !R.won;
  if (R.won) {
    const stars = starsFor(R.lv.par, R.moves);
    $("verdict").textContent = `${R.moves === R.lv.par ? "At par" : R.moves < R.lv.par ? "Under par" : `${plural(R.moves - R.lv.par, "pour")} over par`}: ${plural(R.moves, "pour")}. ${"★".repeat(stars)}${"☆".repeat(3 - stars)}`;
    const next = mode === "levels" ? LEVELS[LEVELS.indexOf(levelById(R.lv.id)) + 1] : null;
    $("nextBtn").hidden = mode === "daily" ? false : mode === "random" ? false : !next;
    $("nextBtn").textContent = mode === "levels" ? "Next level" : mode === "random" ? "New melt" : "Back to the levels";
    $("againBtn").textContent = mode === "levels" ? "Play it again" : "Play it again";
  }
  wake();
}

// ---------- touch: tap a crucible, then where it pours; or drag from one to the other ----------
/** Whether crucible c has anything it can pour (a slag pot never does; charcoal never pours). */
const pours = c => L.kinds[c] !== "slag" && topOf(R.state.cups[c], L.kinds[c], L.C) >= 0;
let press = null;
function down(e) {
  if (!R || R.won || !view) return;
  sound.unlock(); sound.hearth(true);
  const c = view.cupAt(e.clientX, e.clientY);
  press = { c, x: e.clientX, y: e.clientY, id: e.pointerId, was: picked };
  if (c >= 0 && picked < 0 && pours(c)) { picked = c; hint = null; sound.play("pick"); render(); }
}
function up(e) {
  const p = press; press = null;
  if (!p || !R || R.won || !view) return;
  const c = view.cupAt(e.clientX, e.clientY), moved = Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12;
  if (c < 0) { if (!moved) { picked = -1; render(); } return; }
  if (moved && p.c >= 0 && c !== p.c && picked === p.c) { tryPour(p.c, c); return; }       // a drag from one crucible to another
  if (p.was < 0) return;                                                                    // this press picked it
  if (c === p.was) { picked = -1; render(); return; }                                       // tapped again: put down
  if (pourOf(L, R.state, p.was, c)) { tryPour(p.was, c); return; }
  if (pours(c) && L.caps[c] - R.state.cups[c].reduce((a, b) => a + b, 0) === 0) { sound.play("refuse"); shake(c); picked = -1; render(); return; }
  if (pours(c)) { picked = c; sound.play("pick"); render(); return; }
  sound.play("refuse"); picked = -1; render();
}

// ---------- the menu ----------
function levelGrid(C) {
  const grid = document.createElement("div");
  grid.className = "st-levels";
  for (const lv of LEVELS.filter(x => x.ch === C.id)) {
    const b = document.createElement("button"), n = camp[lv.id]?.stars || 0, open = isOpen(lv);
    b.type = "button";
    b.className = `st-lv${mode === "levels" && R?.lv.id === lv.id ? " now" : ""}`;
    b.disabled = !open;
    b.innerHTML = "<b></b><span></span><i></i>";
    b.querySelector("b").textContent = lv.id; b.querySelector("span").textContent = lv.name; b.querySelector("i").textContent = `${"★".repeat(n)}${"☆".repeat(3 - n)}`;
    b.setAttribute("aria-label", `Level ${lv.id}, ${lv.name}${open ? `, ${n} of 3 stars` : ", locked: win the one before"}`);
    b.addEventListener("click", () => { $("menuDlg").close(); openLevel(lv); });
    grid.append(b);
  }
  return grid;
}
function openMenu() {
  rungNow();   // the ramp read before the shared level row is made
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (mode === "levels") play.append(action(`Restart ${R.lv.id}`, () => { $("menuDlg").close(); openLevel(levelById(R.lv.id)); }, "primary"));
  else if (mode === "random") play.append(action("New random melt", () => { $("menuDlg").close(); openRandom(); }, "primary"));
  else play.append(action("Back to the levels", () => { $("menuDlg").close(); backToLevels(); }, "link"));
  const content = part(body, "content");
  const got = read(DAILY, {})[today()];
  todayPart(body, {
    done: !!got, result: got ? `${plural(got.moves, "pour")}, par ${got.par}` : "",
    play: () => { $("menuDlg").close(); playDaily(); }, playing: mode === "daily",
    back: mode === "daily" ? { text: "Back to the levels", fn: () => { $("menuDlg").close(); backToLevels(); } } : null,
  });
  if (mode !== "random") content.append(action("Random melt", () => { $("menuDlg").close(); const r = resumeOf("random"); if (r) begin(r, "random"); else openRandom(); }, "link"));
  for (const C of CHAPTERS) {
    const h = document.createElement("p");
    h.className = "st-tier";
    h.innerHTML = "<span></span> <small></small>";
    h.firstChild.textContent = `${C.id} · ${C.name}`;
    h.lastChild.textContent = C.idea;
    content.append(h, levelGrid(C));
  }
  const settings = part(body, "settings");
  if (!IN_FRAME) settings.append(choice("View", [["3d", "3D"], ["flat", "2D"]], viewKind === "3d" ? "3d" : "flat", v => { write(VIEW, v); setView(v === "3d" ? "3d" : "flat").then(openMenu); }));
  if (!IN_FRAME) settings.append(volume(v => { if (v) { sound.unlock(); sound.hearth(true); } }));
  const about = part(body, "about");
  about.append(line(`${starsAll()} of ${LEVELS.length * 3} stars. Metal lies by its weight: lead 11.3, copper 9.0, tin 7.3 (grams to the cubic centimetre). Three stars at par, two within two pours of it.`));
  for (const id of new Set(R.lv.moulds)) { const M = mouldOf(id), d = document.createElement("p"); d.className = "st-alloy"; d.innerHTML = "<b></b> <small></small>"; d.firstChild.textContent = M.name; d.lastChild.textContent = M.real; about.append(d); }
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "settle");
document.querySelector(".st-mark").innerHTML = APPS.find(a => a.id === "settle").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("foundry").addEventListener("pointerdown", down);
addEventListener("pointerup", up);
addEventListener("pointercancel", () => { press = null; });
$("undoBtn").addEventListener("click", undo);
$("restartBtn").addEventListener("click", restart);
$("hintBtn").addEventListener("click", showHint);
$("againBtn").addEventListener("click", () => begin(fresh(R.lv), mode));
$("nextBtn").addEventListener("click", () => {
  if (mode === "levels") { const next = LEVELS[LEVELS.indexOf(levelById(R.lv.id)) + 1]; if (next) openLevel(next); }
  else if (mode === "random") openRandom();
  else backToLevels();
});
new ResizeObserver(() => { view?.resize(); wake(); }).observe($("foundry"));

// for tests and debugging
window.__settle = { get run() { return R; }, get level() { return L; }, get mode() { return mode; }, get view() { return viewKind; }, get busy() { return !!anim; }, get playing() { return anim && { e: anim.e, dur: anim.dur, waiting: waiting.length }; }, get table() { return !!table; }, get stuck() { return stuck; }, get hint() { return hint; }, get line() { return msg; }, tryPour, undo, restart, showHint, openLevel: id => openLevel(levelById(id)), openRandom, playDaily, setView, set pace(v) { pace = v; } };

// opens on the mode last played; the tile opens today's melt while it is still to play
setView(!IN_FRAME && wants3d() ? "3d" : "flat");
const lastMode = read(MODE, "levels");
if (lastMode === "random" && resumeOf("random")) begin(resumeOf("random"), "random");
else backToLevels();
if (!IN_FRAME && arrivedForToday() && !read(DAILY, {})[today()]) playDaily();
