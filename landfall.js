// Landfall: the page. A window onto the sky above a chart table; the sextant when it is in the hand. The voyage itself is
// landfall-engine.js (pure, seeded, saved whole under `landfall:run`); this file puts it on the screen, runs the twilight's clock while the
// navigator looks about, and keeps what the player has learned (`landfall:mastery`, `landfall:best`). Everything the screen shows is
// in the voyage or in `landfall:` keys, so a partner watching in a frame draws the same page from them.
import {
  newVoyage, apply, moves, restore, save, forecast, conditions, sextantTruth, swellAt, sightNoise, levelOf, truePlace, estPlace, sceneJd, hintFor, routeOf,
  masteryAfter, cloudsNow, bellsBetween, shipClock, lookSun, sunStage, reckonedNoonJd, expectedCatchJd, bodyOf, maxWait, CLOCK, MAX_WAIT, POLARIS_HR, SUN, BY_HR, EYE,
} from "./landfall-engine.js";
import { LEVELS } from "./landfall-levels.js";
import { STARS } from "./landfall-stars.js";
import { FIGURES } from "./landfall-figures.js";
import { starAltAz, sunAltAz, sextantReading, sunReading, sunSemidiameter } from "./landfall-sky.js";
import { bearing, vec, norm180 } from "./landfall-model.js";
import { makeView, project, unproject, degPx, pick, drawSky } from "./landfall-skyview.js";
import * as sx from "./landfall-sextant.js";
import { fitCamera, ellipsePoints, toWorld, toScreen, palette, drawChart } from "./landfall-chart.js";
import { sound } from "./landfall-sound.js";
import { NOTES, GROUPS, earn, fillable, textOf, capOf, filledOf, tally, fromCourse, noteById } from "./landfall-notes.js";
import { MASTERY, LORE, HOW, HOW_SUN, monthsText } from "./landfall-lore.js";
import {
  fmtLat, fmtCourse, fmtHours, fmtNm, starLabel, dateWords, watchWords, slateLines, bookLines, revealWords, refusedWords, logRows, almanacPage, endWords,
  sunTaskWords, sunAlmanac, fmtGmt, fmtSecs,
} from "./landfall-words.js";
import { scale, sideways } from "./wide.js";
import { wants3D, onDefaultChange } from "./mode3d.js";
import { calendar } from "./landfall-sky.js";
import { windOf } from "./landfall-look.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, toggle, action, line, onPause } from "./menu.js";
import { sure } from "./sure.js";
import { IN_FRAME } from "./suite.js";             // a partner watching's frame: it draws a copy, runs no clock and writes nothing

const $ = id => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- what is kept ----------
const KEY = { run: "landfall:run", level: "landfall:level", best: "landfall:best", mastery: "landfall:mastery", sound: "landfall:sound", help: "landfall:help", seen: "landfall:seen", seenSun: "landfall:seen-noon", notes: "landfall:notes", view: "landfall:view" };
const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

let stage = null;                                // the 3D deck (landfall-stage.js), or null while the page is flat
let S = null;                                    // the voyage, with `S.ui` (what the page keeps about it)
let paused = false;
let note = "";                                   // a line the last move earned, shown in the task line until the next
let reveal = null;                               // the latitude reveal under way
let ff = 0;                                      // game minutes still to run fast (the Wait button)
const freshUi = () => ({ tier: 4, lamp: false, d: 0, course: 0, credited: false, bell: null });

const seed = () => (Math.random() * 4294967296) >>> 0;
const helpShift = () => clamp(Number(read(KEY.help, 0)) || 0, -1, 1);
/** The help a level starts a watch with, moved by the Help setting (tier 0 names Polaris, 4 says only "find the pole star"). */
const tierFor = L => clamp(L.hint + helpShift(), 0, 4);

function persist() {
  if (IN_FRAME || !S) return;
  try { localStorage.setItem(KEY.run, save(S)); } catch { /* private mode */ }
}

// ---------- the notebook: what the voyage teaches in passing (landfall-notes.js) ----------
/** The old Navigation course is retired: a lesson done there stands for the notes that carry it here (never lowers one). */
function carryCourse() {
  if (IN_FRAME) return;
  let done = null;
  try { done = JSON.parse(localStorage.getItem("navigation:course") || "null")?.done; } catch { /* none */ }
  if (!done || !Object.keys(done).length) return;
  const have = read(KEY.notes, {}), next = fromCourse(have, done);
  if (NOTES.some(n => next[n.id] !== have[n.id])) write(KEY.notes, next);
}
const capQ = [];                                 // [term, words] waiting to be shown
let capTimer = 0, capUntil = 0;
const capBlocked = () => !!sxs || (!stage && !$("chartBox").offsetParent) || !!document.querySelector("dialog[open]") || $("pass").classList.contains("on");
/** One caption at a time, in the chart's corner; it waits while the sextant, a sheet or the full sky is up. */
function pumpCap() {
  clearTimeout(capTimer);
  const c = $("cap"), now = performance.now();
  if (now < capUntil) { capTimer = setTimeout(pumpCap, capUntil - now + 20); return; }
  c.classList.remove("on");
  if (!capQ.length) return;
  if (capBlocked()) { capTimer = setTimeout(pumpCap, 700); return; }
  const [term, words] = capQ.shift();
  c.replaceChildren(el("b", null, `${term}. `), document.createTextNode(words));
  c.classList.add("on");
  capUntil = now + 6500;
  capTimer = setTimeout(pumpCap, 6520);
}
/**
 * Something happened that a navigator would know the word for: earn the first note it can that the player has not yet, and fill the
 * blank of one already heard. At most two captions for one happening, so the sea is not a lecture. Returns whether a note came.
 */
function learn(...evs) {
  if (IN_FRAME || !S) return false;
  const have = read(KEY.notes, {}), ctx = { lat: estPlace(S).lat };
  let shown = 0;
  for (const ev of evs) {
    if (shown >= 2) break;
    const f = fillable(have, ev);
    if (f) { have[f.id] = 2; capQ.push([f.term, filledOf(f)]); shown++; }
    const n = shown < 2 ? earn(have, ev) : null;
    if (n) { have[n.id] = n.fill ? 1 : 2; capQ.push([n.term, capOf(n, ctx)]); shown++; }
  }
  if (shown) { write(KEY.notes, have); pumpCap(); }
  return shown > 0;
}

function begin(levelId) {
  S = newVoyage(levelId, seed());
  S.ui = freshUi();
  write(KEY.level, levelId);
  arrive(null);
  persist();
  if (!learn("start")) learn("ritual");
}

// ---------- the sizes of the canvases ----------
const box = new Map();                           // canvas -> { w, h, dpr, ctx }
const dirty = { sky: true, chart: true };
const fixedSize = new Map();                     // a canvas that is not on the page (the chart on the 3D table): its size is its own
function fit(cv) {
  const f = fixedSize.get(cv), r = f || cv.getBoundingClientRect(), dpr = f ? f.dpr : Math.min(2, window.devicePixelRatio || 1), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  let b = box.get(cv);
  if (!b || b.w !== w || b.h !== h || b.dpr !== dpr) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    b = { w, h, dpr, ctx: cv.getContext("2d") };
    box.set(cv, b);
    if (cv === chartCv) retarget();
    dirty.sky = dirty.chart = true;
  }
  b.ctx.setTransform(b.dpr, 0, 0, b.dpr, 0, 0);
  return b;
}
const skyCv = $("skyCv"), flatChart = $("chartCv"), scopeCv = $("scopeCv");
let chartCv = flatChart;                         // the page's chart canvas, or in 3D the one laid on the table

// ---------- the sky ----------
const view = { az: 0, alt: 40, fov: 80 };        // the window held upright: the north, from the horizon to near the zenith
const free = { az: 0, alt: 40, fov: 100 };       // the whole sky, or the sky beside the desk
let full = false;
const freeMode = () => full || sideways();
const curView = (w, h) => { const v = freeMode() ? free : view; return makeView(v.az, v.alt, v.fov, w, h); };

const hrOf = new Map(STARS.map(s => [s[2], s[0]]));
const figureOf = key => {
  const F = FIGURES[key];
  return { lines: F.lines.map(l => l.map(d => hrOf.get(d))), keys: F.key.map(d => hrOf.get(d)), label: F.asterism[0].toUpperCase() + F.asterism.slice(1) };
};
const FIGS = { UMa: figureOf("UMa"), UMi: figureOf("UMi"), Cas: figureOf("Cas") };

let skyCache = { key: "", stars: [], sun: null, lim: 0 };
/** The sky now, from the true ship: every star above the horizon, and which of them can be seen. Remade every quarter minute of game time. */
function skyData() {
  const key = `${S.seed}|${S.w}|${Math.round(S.watch.min * 4)}`;
  if (key === skyCache.key) return skyCache;
  const jd = sceneJd(S), p = truePlace(S), c = conditions(S), clouds = cloudsNow(S), stars = [];
  for (const s of STARS) {
    const a = starAltAz(s, jd, p.lat, p.lon);
    if (a.alt < -1) continue;
    const hidden = a.alt > 0 && clouds.some(cl => {
      const r = Math.PI / 180, x = Math.sin(a.alt * r) * Math.sin(cl.alt * r) + Math.cos(a.alt * r) * Math.cos(cl.alt * r) * Math.cos((a.az - cl.az) * r);
      return Math.acos(clamp(x, -1, 1)) / r < cl.r;
    });
    stars.push({ hr: s[0], az: a.az, alt: a.alt, mag: s[5], vis: a.alt > 0.5 && s[5] <= c.limMag && !hidden });
  }
  skyCache = { key, stars, sun: sunAltAz(jd, p.lat, p.lon), lim: c.limMag, clouds };
  return skyCache;
}
const isDay = () => S.watch.kind === "noon";
const help = () => (S.phase === "find" && !isDay() && S.ui.tier < 4 ? hintFor(S, S.ui.tier) : null);

function drawSkyNow(now) {
  const b = fit(skyCv);
  if (!S) return;
  const d = skyData(), h = help(), W = S.watch;
  drawSky(b.ctx, curView(b.w, b.h), {
    sunAlt: d.sun.alt, sunAz: d.sun.az, stars: d.stars, limMag: d.lim, lamp: S.ui.lamp, clouds: d.clouds,
    figure: h?.figure ? FIGS[h.figure] : null, ring: h?.ring ?? null, picked: W.picked, t: now / 1000, k: scale(),
  });
  dirty.sky = false;
}

// gestures on the window: tap a star to choose it; drag to turn; pull down to open the whole sky; pinch to look closer
const ptrs = new Map();
let gesture = null;
skyCv.addEventListener("pointerdown", e => {
  sound.unlock();
  if (IN_FRAME || !S) return;
  skyCv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  gesture = ptrs.size === 1 ? { x0: e.clientX, y0: e.clientY, moved: 0, used: false } : { ...(gesture || {}), pinch: spread(), fov0: free.fov, used: true };
});
skyCv.addEventListener("pointermove", e => {
  const p = ptrs.get(e.pointerId);
  if (!p || !gesture) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  const b = box.get(skyCv), r = skyCv.getBoundingClientRect();
  if (ptrs.size >= 2) {
    if (gesture.pinch > 10) { free.fov = clamp(gesture.fov0 * gesture.pinch / Math.max(10, spread()), 24, 140); dirty.sky = true; wake(); }
    return;
  }
  gesture.moved += Math.hypot(dx, dy);
  if (gesture.moved < 6) return;
  const cv = curView(b.w, b.h), px = e.clientX - r.left, py = e.clientY - r.top, ppd = Math.max(0.5, degPx(cv, px, py));
  const v = freeMode() ? free : view;
  // a degree of azimuth is shorter by the cosine of the altitude, so the same drag turns the view further high up
  v.az = (v.az - dx / ppd / Math.max(0.3, Math.cos(unproject(cv, px, py).alt * Math.PI / 180)) + 360) % 360;
  if (freeMode()) v.alt = clamp(v.alt + dy / ppd, -4, 88);
  else if (e.clientY - gesture.y0 > 34 * scale() && Math.abs(e.clientY - gesture.y0) > Math.abs(e.clientX - gesture.x0) * 1.2) { setFull(true); gesture.used = true; }
  gesture.used = gesture.used || gesture.moved > 10;
  dirty.sky = true; wake();
});
const endPointer = e => {
  const had = ptrs.delete(e.pointerId);
  if (!had || !gesture) return;
  if (e.type === "pointerup" && ptrs.size === 0 && !gesture.used && gesture.moved < 8) tapSky(e.clientX, e.clientY);
  if (ptrs.size === 0) gesture = null;
};
skyCv.addEventListener("pointerup", endPointer);
skyCv.addEventListener("pointercancel", endPointer);
skyCv.addEventListener("wheel", e => { if (!freeMode()) return; e.preventDefault(); free.fov = clamp(free.fov * Math.exp(e.deltaY * 0.001), 24, 140); dirty.sky = true; wake(); }, { passive: false });
function spread() { const [a, b] = [...ptrs.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }

function tapSky(cx, cy) {
  if (!S || S.phase !== "find" || paused) return;
  const r = skyCv.getBoundingClientRect(), v = curView(r.width, r.height), s = pick(v, skyData().stars.filter(t => t.vis), cx - r.left, cy - r.top, 18 * scale());
  if (s) choose(s.hr);
  else { note = ""; renderText(); }
}
function choose(hr) {
  const r = go({ t: "pick", hr });
  if (!r.ok) return;
  sound.tick();
  learn(`pick:${starLabel(BY_HR.get(hr))}`);
  // finding Polaris earns the constellations that led to it, by how little help it took
  if (hr === POLARIS_HR && !S.ui.credited) {
    S.ui.credited = true;
    const M = read(KEY.mastery, {}), fig = routeOf(S) === "plough" ? "UMa" : "Cas";
    for (const k of ["UMi", fig]) M[k] = masteryAfter(M[k], S.ui.tier, true);
    write(KEY.mastery, M);
  }
  renderAll();
}
function setFull(on) {
  if (sideways()) on = false;
  if (on === full) return;
  full = on;
  if (on) free.az = view.az;
  $("app").classList.toggle("lf-full", full);
  dirty.sky = true; dirty.chart = true; wake();
  requestAnimationFrame(() => { dirty.sky = true; wake(); });
}
$("zoomIn").addEventListener("click", () => { if (stage) return stage.zoom(1 / 1.35); free.fov = clamp(free.fov / 1.35, 24, 140); dirty.sky = true; wake(); });
$("zoomOut").addEventListener("click", () => { if (stage) return stage.zoom(1.35); free.fov = clamp(free.fov * 1.35, 24, 140); dirty.sky = true; wake(); });
$("northBtn").addEventListener("click", () => { if (stage) return stage.resetNorth(); free.az = 0; free.alt = 40; free.fov = 100; dirty.sky = true; wake(); });
// the pull handle: a tap opens or closes the whole sky, and so does a drag on it
{
  let y0 = null, dragged = false;
  $("pull").addEventListener("pointerdown", e => { y0 = e.clientY; dragged = false; $("pull").setPointerCapture(e.pointerId); });
  $("pull").addEventListener("pointerup", e => { if (y0 !== null && Math.abs(e.clientY - y0) > 20 * scale()) { setFull(e.clientY > y0); dragged = true; } y0 = null; });
  $("pull").addEventListener("click", () => { if (dragged) { dragged = false; return; } setFull(!full); });
}

// ---------- the chart ----------
const pal = palette($("app"));
let cam = null, camTo = null;
const harbourOf = () => { const H = levelOf(S).harbour; return [H.x, H.y]; };
/** The points the chart should hold in this phase: the ritual's course, the fog while a sight is taken, the way to the harbour while steering. */
function camPoints() {
  const L = levelOf(S), pts = [];
  if (S.phase === "end") return [...S.truth, ...S.trail.map(t => t.p), harbourOf()];
  if (reveal) return [...ellipsePoints(reveal.before.E, reveal.before.P), ...ellipsePoints(reveal.after.E, reveal.after.P)];
  if (S.phase === "ritual") {
    const v = vec(S.leg.course), run = S.leg.run * 1.12;
    return [...ellipsePoints(S.E, S.P), [S.E[0] + v[0] * run, S.E[1] + v[1] * run]];
  }
  if (S.phase === "steer") {
    const f = forecast(S, S.ui.course), r = f.run * 1.05;
    return [S.E, [S.E[0] + r, S.E[1] + r], [S.E[0] - r, S.E[1] - r], harbourOf(), ...(L.shoals || []).filter(s => Math.hypot(s.x - S.E[0], s.y - S.E[1]) < r * 1.3).map(s => [s.x, s.y])];
  }
  return ellipsePoints(S.E, S.P);
}
function retarget() {
  const b = box.get(chartCv);
  if (!S || !b) return;
  camTo = fitCamera(camPoints(), b.w, b.h, 36 * scale(), 0.6, 70);
  if (!cam) cam = { ...camTo };
  dirty.chart = true; wake();
}
function stepCam(dt) {
  if (!cam || !camTo) return false;
  const f = 1 - Math.exp(-dt * 5.5), ls = Math.log(cam.s), lt = Math.log(camTo.s);
  const moving = Math.abs(lt - ls) > 0.002 || Math.hypot(camTo.cx - cam.cx, camTo.cy - cam.cy) * cam.s > 0.4;
  if (!moving) { cam = { ...camTo }; return false; }
  cam.s = Math.exp(ls + (lt - ls) * f); cam.cx += (camTo.cx - cam.cx) * f; cam.cy += (camTo.cy - cam.cy) * f;
  return true;
}
const mixP = (A, B, t) => A.map((r, i) => r.map((x, j) => x + (B[i][j] - x) * t));
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

function drawChartNow(now) {
  const b = fit(chartCv);
  if (!S || !cam) return;
  const L = levelOf(S), sc = { L, cam, pal, k: stage ? 1.1 * Math.max(1, scale() * 0.9) : scale(), trail: S.trail, E: S.E, P: S.P, ghost: null, lop: null, dividers: null, steer: null, end: null };
  if (S.phase === "ritual") sc.dividers = { from: S.E, course: S.leg.course, d: S.ui.d };
  if (S.phase === "steer" || (reveal && S.phase !== "end")) {
    const p = S.watch.plot;
    if (p?.accepted && p.lat !== undefined) sc.lop = { y: (p.lat - L.origin.lat) * 60, t: 1 };
    if (p?.accepted && p.lon !== undefined) sc.lopLon = { lon: p.lon, t: 1 };
  }
  if (S.phase === "steer" && !reveal) sc.steer = { course: S.ui.course, forecast: forecast(S, S.ui.course) };
  if (S.phase === "end") sc.end = { truth: S.truth, T: S.T };
  if (reveal) {
    const u = reveal.hold ?? (now - reveal.t0) / 1000, s = smooth((u - 0.55) / 1.3);
    sc.lop = reveal.lat === undefined ? null : { y: (reveal.lat - L.origin.lat) * 60, t: smooth(u / 0.8) };
    sc.lopLon = reveal.lon === undefined ? null : { lon: reveal.lon, t: smooth(u / 0.8) };
    sc.E = [reveal.before.E[0] + (reveal.after.E[0] - reveal.before.E[0]) * s, reveal.before.E[1] + (reveal.after.E[1] - reveal.before.E[1]) * s];
    sc.P = mixP(reveal.before.P, reveal.after.P, s);
    sc.ghost = s < 0.98 ? reveal.before : null;
    sc.trail = S.trail.slice(0, -1);
  }
  drawChart(b.ctx, b.w, b.h, sc);
  dirty.chart = false;
  if (stage) {                                   // the dividers and the parallel rules are things on the table, standing on the chart
    const P = p => toScreen(cam, b.w, b.h, p);
    if (S.phase === "ritual") { const v = vec(S.leg.course); stage.setDividers({ a: P(S.E), b: P([S.E[0] + v[0] * S.ui.d, S.E[1] + v[1] * S.ui.d]) }); } else stage.setDividers(null);
    stage.setRules(S.phase === "steer" && !reveal ? { course: S.ui.course, at: P(S.E) } : null);
  }
}

// the chart answers a finger in two phases: the dividers are set along the course, the course to steer is pointed at
const worldAt = (x, y) => { const b = box.get(chartCv); return toWorld(cam, b.w, b.h, x, y); };
let chartDrag = false;
const canChart = () => !IN_FRAME && !!S && !!cam && !paused && !reveal && (S.phase === "ritual" || S.phase === "steer");
flatChart.addEventListener("pointerdown", e => {
  sound.unlock();
  if (!canChart()) return;
  chartDrag = true; flatChart.setPointerCapture(e.pointerId); const r = flatChart.getBoundingClientRect(); chartPoint(e.clientX - r.left, e.clientY - r.top);
});
flatChart.addEventListener("pointermove", e => { if (chartDrag) { const r = flatChart.getBoundingClientRect(); chartPoint(e.clientX - r.left, e.clientY - r.top); } });
flatChart.addEventListener("pointerup", () => { chartDrag = false; });
flatChart.addEventListener("pointercancel", () => { chartDrag = false; });
function chartPoint(x, y) {
  const p = worldAt(x, y);
  if (S.phase === "ritual") {
    const v = vec(S.leg.course);
    setDividers((p[0] - S.E[0]) * v[0] + (p[1] - S.E[1]) * v[1]);
  } else if (S.phase === "steer") {
    const dx = p[0] - S.E[0], dy = p[1] - S.E[1];
    if (Math.hypot(dx, dy) * cam.s > 10) setCourse(bearing([dx, dy]));
  }
}
const tolOf = () => 0.012 * S.leg.run + 0.25;
function setDividers(d) {
  const was = Math.abs(S.ui.d - S.leg.run) <= tolOf();
  S.ui.d = Math.round(clamp(d, 0, S.leg.run * 1.6) * 10) / 10;
  if (!was && Math.abs(S.ui.d - S.leg.run) <= tolOf()) sound.tick();
  dirty.chart = true; renderTools(); wake();
}
function setCourse(c) {
  S.ui.course = Math.round(((c % 360) + 360) % 360) % 360;
  dirty.chart = true; renderTools(); renderText(); wake();
}

// ---------- the moves ----------
/** One move of the voyage, with what the page does about it. */
function go(m) {
  const prev = S.phase, r = apply(S, m);
  if (!r.ok) { note = r.why[0].toUpperCase() + r.why.slice(1) + "."; renderText(); return r; }
  note = "";
  after(m, prev, r);
  persist();
  return r;
}
function after(m, prev, r) {
  switch (m.t) {
    case "step": case "skip": {
      const W = S.watch.ritual;
      learn("step");
      note = W.skipped ? "The dividers are skipped: the reckoning keeps a little more doubt." : Math.abs(W.err) <= W.tol ? "The dividers agree with the log." : `The dividers are ${fmtNm(Math.abs(W.err))} out. The reckoning takes it.`;
      break;
    }
    case "bearing": {
      learn("bearing");
      const b = S.watch.bearing;
      note = b.wrong ? `Compass bearing ${fmtCourse(b.observed)}, but Polaris should stand at ${fmtCourse(b.expected)}: this is not the pole star.`
        : `Compass ${fmtCourse(b.observed)} against ${fmtCourse(b.expected)} expected: the compass reads ${b.diff > 0 ? "high" : "low"} by ${Math.abs(b.diff).toFixed(1)}°. Steering is corrected.`;
      break;
    }
    case "plot":
      if (r.accepted) {
        startReveal();
        const p = S.watch.plot;
        // a longitude is the rarer thing: its notes come before the common ones (two captions at most)
        learn(...(p.lonOk ? ["lon", ...(p.latOk ? ["fix"] : [])] : []), "plot", p.sun ? "plot:sun" : "plot:star");
      }
      break;
    case "read":
      if (isDay() && r.stage) {
        const s = S.watch.sun, rec = r.stage === "morning" ? s.m1 : r.stage === "noon" ? s.noon : s.aft;
        learn(r.stage === "noon" ? "noon" : r.stage === "afternoon" ? "catch" : "morning");
        note = r.stage === "afternoon" ? `Called at ${fmtGmt(rec.jd)} GMT by the chronometer.` : `${r.stage === "morning" ? "Morning" : "Noon"} altitude ${sx.formatReading(rec.hs)} at ${fmtGmt(rec.jd)} GMT is in the sight book.`;
      }
      break;
    case "skipstage": note = "That sight is given up."; break;
    case "sail": case "heave": if (m.t === "sail") learn("sail"); passing(m, r); break;
    default: break;
  }
  if (S.phase !== prev) arrive(prev);
  renderAll();
}
/** What happens when a phase begins. */
function arrive(prev) {
  const L = levelOf(S), ui = S.ui;
  const day = isDay();
  $("app").classList.toggle("lf-day", day && S.phase !== "end");
  if (S.phase === "ritual" && day) { const sun = skyData().sun; view.az = free.az = Math.round(sun.az); free.alt = 35; }       // look where the sun is
  if (day && prev === "ritual" && !read(KEY.seenSun, 0)) setTimeout(() => { if (isDay() && S.phase === "find") openHelp(true); }, 350);
  sound.day(day && S.phase !== "end");
  switch (S.phase) {
    case "ritual": ui.d = 0; ui.lamp = true; ui.credited = false; ui.tier = 4; break;
    case "find":
      ui.lamp = day;
      if (prev === "ritual" && !day) {
        ui.tier = tierFor(L); ui.credited = false;
        const M = read(KEY.mastery, {}), fig = routeOf(S) === "plough" ? "UMa" : "Cas";
        if (ui.tier <= 1) { for (const k of ["UMi", fig]) M[k] = Math.max(M[k] || 0, 1); write(KEY.mastery, M); }
      }
      break;
    case "sight": ui.lamp = false; openScope(); break;
    case "book": ui.lamp = true; closeScope(); openBook(); break;
    case "steer": ui.lamp = true; if (prev !== "steer") ui.course = Math.round(bearing([levelOf(S).harbour.x - S.E[0], levelOf(S).harbour.y - S.E[1]])); break;
    case "end": finishVoyage(); learn("end"); break;
    default: break;
  }
  if (S.phase !== "sight") closeScope();
  if (!reveal) retarget();
  dirty.sky = dirty.chart = true;
  if (stage) lookFor(prev);
}
/** In 3D the head goes where the work is: down to the table for the dividers and the course, up to the sky to find a star. */
function lookFor(prev) {
  if (S.phase === "ritual" || S.phase === "steer" || S.phase === "end") stage.lookTable();
  else if (S.phase === "find" && prev !== "sight" && prev !== "book") stage.lookSky(isDay() ? skyData().sun.az : 0, isDay() ? 32 : 40);
}
function startReveal() {
  const p = S.watch.plot;
  reveal = { t0: performance.now(), before: p.before, after: p.after, lat: p.latOk === false ? undefined : p.lat, lon: p.lonOk ? p.lon : undefined, chimed: false };
  retarget();
}

/** The dark between one watch and the next. */
let passTimer = 0;
function passing(m, r) {
  const g = S.leg, ended = S.phase === "end";
  $("passTxt").textContent = m.t === "heave" ? "Hove to, and waiting for the light to change." : `Sailing ${fmtHours(g.hours)} on ${fmtCourse(g.course)}${ended ? "" : "."}`;
  $("pass").classList.add("on");
  clearTimeout(passTimer);
  passTimer = setTimeout(() => { $("pass").classList.remove("on"); dirty.chart = dirty.sky = true; wake(); if (S.phase === "end") showEnd(); }, ended ? 1500 : 1400);
}

// ---------- the clock of the twilight ----------
const strikes = ["", "One bell", "Two bells", "Three bells", "Four bells", "Five bells", "Six bells", "Seven bells", "Eight bells"];
let bellShown = { text: "", until: 0 };
let ranW = -1;                                   // the watch whose sky has been seen to turn
/** Whether the sky's clock runs: in the window, and in the eyepiece while the sun is watched for its peak or its return. */
const clockRuns = () => S.phase === "find" || (S.phase === "sight" && isDay() && S.watch.stage !== "morning");
function tickClock(dt, now) {
  if (!S || !clockRuns() || paused || document.hidden || IN_FRAME || S.watch.min >= maxWait(S)) return false;
  let dm = dt * CLOCK / 60;
  if (ff > 0) { const take = Math.min(ff, dt * 30); ff -= take; dm += take; }
  const jdA = sceneJd(S), lon = estPlace(S).lon;
  apply(S, { t: "wait", min: dm });
  if (S.watch.min >= 20 && ranW !== S.w) { ranW = S.w; learn("wait"); }
  const bells = bellsBetween(jdA, sceneJd(S), lon);
  if (bells.length) { const n = bells.at(-1).bells; bellShown = { text: strikes[n], until: now + 5000 }; if (!sxs) sound.bell(n); }       // silence while the sextant is up
  return true;
}
/** Runs the clock on, fast, to a Julian date (the Wait buttons of a noon watch). */
function waitUntil(jd) { ff = Math.max(ff, (jd - sceneJd(S)) * 1440 - 0.01); wake(); }

// ---------- the sextant ----------
let sxs = null;                                  // { st, exact, truth, t0, pid, lastY, fine, A }
function openScope(instant = false) {
  ff = 0;
  learn(...(isDay() ? ["raise:sun", "raise"] : ["raise"]));
  const W = S.watch, est = estPlace(S), jd = sceneJd(S), day = isDay(), locked = day && W.stage === "afternoon";
  // the drum starts where the reckoning says the body is (the sun's lower limb for the sun); for the catch it is left where the morning sight set it
  let r0;
  if (locked) r0 = sx.quantise(W.sun.m1.hs);
  else if (day) { const a = sunAltAz(jd, est.lat, est.lon); r0 = sx.quantise(a.alt > 0 ? sunReading(a.alt, jd, EYE) * 60 : 0); }
  else { const a = starAltAz(BY_HR.get(W.picked), jd, est.lat, est.lon); r0 = sx.quantise(a.alt > 0 ? sextantReading(a.alt, EYE) * 60 : 0); }
  const truth = sextantTruth(S), st = sx.newSextant(r0);
  st.lens = sx.lensFor(truth - r0, 0);
  sxs = { st, exact: r0, truth, t0: performance.now(), pid: null, lastY: 0, fine: false, A: sightNoise(S, bodyOf(S)).swell, day, locked, stage: W.stage, sd: day ? sunSemidiameter(jd) : 0, cloud: false };
  $("scope").dataset.stage = day ? W.stage : "star";
  if (stage) {                                   // the sextant is lifted to the eye and the head turns to the body; then the eyepiece opens
    const d = skyData(), t = day ? d.sun : d.stars.find(x => x.hr === W.picked) || { az: 0, alt: 40 };
    stage.raise(t.az, t.alt, instant).then(() => { if (sxs) $("scope").hidden = false; wake(); });
  } else $("scope").hidden = false;
  $("readTxt").textContent = sx.formatReading(st.reading);
  sound.hush(true);
  refreshScope();
  requestAnimationFrame(() => wake());
}
function closeScope() {
  if (!sxs && $("scope").hidden) return;
  sxs = null; $("scope").hidden = true; sound.hush(false);
  stage?.lower();
}
function refreshScope() {
  if (!sxs) return;
  const { st } = sxs, ol = $("marks");
  $("readTxt").textContent = sx.formatReading(st.reading);
  ol.replaceChildren(...st.marks.map(m => { const li = document.createElement("li"); li.textContent = sx.formatReading(m); return li; }));
  const { day, locked, cloud, stage } = sxs;
  $("markBtn").disabled = locked ? cloud : st.marks.length >= sx.MAX_MARKS || cloud;
  $("markBtn").textContent = locked ? "Now" : st.marks.length >= sx.MAX_MARKS ? "Three marks" : `Mark${st.marks.length ? ` (${st.marks.length + 1})` : ""}`;
  $("readBtn").disabled = !st.marks.length || cloud;
  $("readBtn").textContent = day ? "Keep it" : "Read it";
  $("clearBtn").disabled = !st.marks.length;
  $("chronoTxt").hidden = !day;
  let note;
  if (cloud) note = "Cloud is across the sun. Wait for it to pass.";
  else if (locked) note = "The drum is left where the morning sight set it. The sun is falling: press Now the moment its lower edge touches the horizon.";
  else if (st.marks.length) note = "Three marks, averaged, beat one.";
  else if (stage === "morning") note = `Lens ${sx.MAGNIFY[st.lens]}. The sun is climbing. Bring its lower edge to the horizon and mark: the chronometer notes the time.`;
  else if (stage === "noon") note = `Lens ${sx.MAGNIFY[st.lens]}. The sun hangs near its peak. Keep its lower edge on the horizon and mark when it has stopped rising.`;
  else note = `Lens ${sx.MAGNIFY[st.lens]}. Bring the star to the horizon and let it swing evenly about it.`;
  $("scopeNote").textContent = note;
}
function settleReading() {
  const { st } = sxs;
  sxs.exact = Math.max(0, sxs.exact);
  st.reading = sx.quantise(sxs.exact);
  st.lens = sx.lensFor(sxs.truth - sxs.exact, st.lens);
  refreshScope(); wake();
}
scopeCv.addEventListener("pointerdown", e => {
  sound.unlock();
  if (!sxs || sxs.pid !== null || IN_FRAME || sxs.locked) return;
  const r = scopeCv.getBoundingClientRect(), L = sx.layout(r.width, r.height);
  sxs.pid = e.pointerId; sxs.lastY = e.clientY; sxs.fine = sx.inDrum(L, e.clientX - r.left, e.clientY - r.top);
  scopeCv.setPointerCapture(e.pointerId); e.preventDefault();
});
scopeCv.addEventListener("pointermove", e => {
  if (!sxs || e.pointerId !== sxs.pid) return;
  const r = scopeCv.getBoundingClientRect(), L = sx.layout(r.width, r.height), dy = e.clientY - sxs.lastY;
  sxs.lastY = e.clientY;
  sxs.exact += dy / sx.pxPerArcmin(sxs.st.lens, L.rho) * (sxs.fine ? sx.FINE : 1);
  settleReading();
});
const scopeUp = e => { if (sxs && e.pointerId === sxs.pid) sxs.pid = null; };
scopeCv.addEventListener("pointerup", scopeUp);
scopeCv.addEventListener("pointercancel", scopeUp);
const nudge = d => { if (!sxs || sxs.locked) return; sxs.exact = sx.quantise(sxs.exact + d); settleReading(); };
$("nudgeDown").addEventListener("click", () => nudge(-0.1));
$("nudgeUp").addEventListener("click", () => nudge(0.1));
$("markBtn").addEventListener("click", () => {
  if (!sxs || sxs.cloud) return;
  if (sxs.locked) { sound.mark(); go({ t: "read", marks: [] }); return; }          // the catch: the moment is the reading
  if (sx.mark(sxs.st)) { sound.mark(); refreshScope(); wake(); }
});
$("clearBtn").addEventListener("click", () => { if (sxs) { sx.clearMarks(sxs.st); refreshScope(); } });
$("lowerBtn").addEventListener("click", () => { go({ t: "lower" }); });
$("readBtn").addEventListener("click", () => { if (sxs?.st.marks.length) go({ t: "read", marks: sxs.st.marks.slice() }); });

function drawScopeNow(now) {
  if (!sxs || $("scope").hidden) return;                // not on the screen yet: the sextant is still being lifted to the eye
  const b = fit(scopeCv);
  const sec = (now - sxs.t0) / 1000, sw = swellAt(S, sec), st = sxs.st;
  st.flash = Math.max(0, st.flash - 0.07);
  if (sxs.day) {
    // the sun moves while it is watched (the clock runs in the eyepiece after the morning sight): the truth, the lens, the chronometer and the cloud follow it
    if (clockRuns()) { sxs.truth = sextantTruth(S) ?? sxs.truth; if (sxs.locked) st.lens = sx.lensFor(sxs.truth - sxs.exact, st.lens); }
    const cloud = lookSun(S).cloud;
    if (cloud !== sxs.cloud) { sxs.cloud = cloud; refreshScope(); }
    const gmt = `${fmtGmt(sceneJd(S))} GMT`;
    if ($("chronoTxt").textContent !== gmt) $("chronoTxt").textContent = gmt;
  }
  const veil = sxs.cloud ? 1 : 0;
  sx.drawSextant(b.ctx, b.w, b.h, st, { offset: sx.offsetOf(sxs.truth, sxs.exact, sw), swellPhase: clamp(sw / Math.max(0.05, sxs.A), -1, 1), sunAlt: conditions(S).sun, t: sec, k: scale(), mono: pal.mono, sun: sxs.day && !veil, sd: sxs.sd, locked: sxs.locked });
}

// ---------- the sight book and the reveal ----------
/** The lines of the sight book that name a thing the notebook explains: tap one for its note. */
const TIPS = [["Dip", "dip"], ["Refraction", "refraction"], ["True altitude", "ho"], ["Almanac: declination", "declination"], ["Latitude =", "noonlat"], ["Longitude =", "lontime"]];
function openBook() {
  const dl = $("bookLines"), rows = bookLines(S);
  dl.replaceChildren(...rows.map(r => {
    const d = document.createElement("div"), t = document.createElement("dt"), v = document.createElement("dd"); t.textContent = r.label; v.textContent = r.value; if (r.key) d.className = "key";
    const tip = TIPS.find(([p]) => r.label.startsWith(p)); if (tip) d.dataset.note = tip[1];
    d.append(t, v); return d;
  }));
  learn("book");
  $("bookMsg").textContent = ""; $("bookMsg").className = "lf-bookmsg";
  $("plotBtn").disabled = false;
  $("retakeBtn").textContent = isDay() ? "Noon again" : "Take it again";
  $("retakeBtn").disabled = isDay() && !S.watch.sun.noon;
  const gap = Math.min(230, 2200 / Math.max(1, rows.length));
  [...dl.children].forEach((d, i) => setTimeout(() => d.classList.add("on"), 120 + i * gap));
  setTimeout(() => { if ($("bookDlg").open && !S.watch.plot) if (!$("bookMsg").textContent) $("bookMsg").textContent = isDay() ? "The almanac has turned the sights into a latitude and a longitude. Plot them to see what they do to the fog. Tap an underlined line to see what it is." : "The almanac has turned the reading into a latitude. Plot it to see what it does to the fog. Tap an underlined line to see what it is."; }, 120 + rows.length * gap);
  if (!$("bookDlg").open) $("bookDlg").showModal();
}
$("bookClose").addEventListener("click", () => $("bookDlg").close());
$("bookLines").addEventListener("click", e => {
  const n = noteById(e.target.closest("[data-note]")?.dataset.note);
  if (!n) return;
  const have = read(KEY.notes, {});
  if (!have[n.id] && !IN_FRAME) { have[n.id] = n.fill ? 1 : 2; write(KEY.notes, have); }
  $("bookMsg").className = "lf-bookmsg";
  $("bookMsg").textContent = textOf(n, have, { lat: estPlace(S).lat });
});
$("plotBtn").addEventListener("click", () => {
  const r = go({ t: "plot" });
  if (r.ok && r.accepted) $("bookDlg").close();
  else if (r.ok) { $("bookMsg").textContent = refusedWords(S); $("bookMsg").className = "lf-bookmsg off"; $("plotBtn").disabled = true; sound.off(); }
});
$("retakeBtn").addEventListener("click", () => { $("bookDlg").close(); const day = isDay(); if (go({ t: "retake" }).ok) { note = day ? "The noon altitude again: the sun is further from its peak now, so be quick." : "You take it again, four minutes on."; renderText(); } });
$("discardBtn").addEventListener("click", () => { $("bookDlg").close(); go({ t: "discard" }); });

// ---------- the end ----------
function finishVoyage() {
  const e = S.end, L = levelOf(S);
  if (e.kind === "arrived") {
    const best = read(KEY.best, {});
    if ((best[L.id] || 0) < e.stars) { best[L.id] = e.stars; write(KEY.best, best); }
    sound.good();
  } else sound.hollow();
  closeScope();
}
function showEnd() {
  const w = endWords(S);
  if (!w) return;
  $("endTitle").textContent = w.title;
  $("endStars").textContent = w.kind === "arrived" ? "★".repeat(w.stars) + "☆".repeat(3 - w.stars) : "";
  $("endStars").setAttribute("aria-label", w.kind === "arrived" ? `${w.stars} of 3 stars` : "");
  $("endStars").hidden = w.kind !== "arrived";
  $("endBody").replaceChildren(...w.lines.map(t => { const p = document.createElement("p"); p.className = "lf-endline"; p.textContent = t; return p; }), (() => { const p = document.createElement("p"); p.className = "lf-note-p"; p.textContent = `${levelOf(S).name}, ${dateWords(S)}. The red track on the chart is where the ship really went.`; return p; })());
  if (!$("endDlg").open) $("endDlg").showModal();
}
$("endClose").addEventListener("click", () => $("endDlg").close());
$("endAgain").addEventListener("click", () => { $("endDlg").close(); begin(S.level); renderAll(); });
$("endMenu").addEventListener("click", () => { $("endDlg").close(); openMenu(); });

// ---------- the words and the buttons ----------
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
function button(text, fn, cls = "lf-btn", { disabled = false, label } = {}) {
  const b = el("button", cls, text);
  b.type = "button"; b.disabled = disabled || IN_FRAME;
  if (label) b.setAttribute("aria-label", label);
  b.addEventListener("click", () => { sound.unlock(); fn(); });
  return b;
}
function renderTools() {
  if (!S) return;
  const acts = $("acts"), aux = $("aux"), M = new Set(moves(S)), W = S.watch, can = m => M.has(m) && !reveal;
  acts.replaceChildren(); aux.replaceChildren();
  const stepper = (labels, fn, readout) => {
    for (const [txt, d, lab] of labels) aux.append(button(txt, () => fn(d), "lf-mini", { label: lab }));
    const r = el("button", "lf-mini read", readout); r.type = "button"; r.disabled = true;
    aux.insertBefore(r, aux.children[2]);
  };
  switch (S.phase) {
    case "ritual":
      acts.append(button("Skip", () => go({ t: "skip" })), button("Step off", () => go({ t: "step", d: S.ui.d }), "lf-btn go", { disabled: S.ui.d <= 0 }));
      stepper([["−1", -1, "One mile less"], ["−0.1", -0.1, "A tenth less"], ["+0.1", 0.1, "A tenth more"], ["+1", 1, "One mile more"]], d => setDividers(S.ui.d + d), `${S.ui.d.toFixed(1)} nm`);
      break;
    case "find":
      if (isDay()) {
        const st = sunStage(S), spent = W.min >= maxWait(S);
        const label = { morning: "Morning sight", noon: "Noon altitude", afternoon: "Catch the sun", done: "Sextant" }[st];
        const [wt, wf] = st === "noon" ? ["To noon", () => waitUntil(reckonedNoonJd(S) - 3 / 1440)] : st === "afternoon" ? ["To the catch", () => waitUntil(expectedCatchJd(S) - 8 / 1440)] : ["Wait", () => { ff += 5; wake(); }];
        acts.append(button(wt, wf, "lf-btn", { disabled: spent }), button(label, () => go({ t: "raise" }), "lf-btn go", { disabled: !can("raise") || st === "done" }));
        auxFixed();
        break;
      }
      acts.append(
        button("Wait", () => { ff += 5; wake(); }, "lf-btn", { disabled: W.min >= MAX_WAIT + 30 }),
        button(W.bearing ? "Compass ✓" : "Compass", () => go({ t: "bearing" }), "lf-btn", { disabled: !can("bearing") }),
        button("Sextant", () => go({ t: "raise" }), "lf-btn go", { disabled: !can("raise") }),
      );
      auxFixed();
      break;
    case "sight":
      acts.append(button("Lower the sextant", () => go({ t: "lower" }), "lf-btn go"));
      auxFixed();
      break;
    case "book":
      acts.append(button("Open the sight book", openBook, "lf-btn go"));
      auxFixed();
      break;
    case "steer":
      acts.append(
        button("Heave to", () => go({ t: "heave", course: S.ui.course }), "lf-btn", { disabled: !can("heave") }),
        button("Sail", () => go({ t: "sail", course: S.ui.course }), "lf-btn go", { disabled: !can("sail") }),
      );
      stepper([["−5°", -5, "Five degrees to port"], ["−1°", -1, "One degree to port"], ["+1°", 1, "One degree to starboard"], ["+5°", 5, "Five degrees to starboard"]], d => setCourse(S.ui.course + d), fmtCourse(S.ui.course));
      break;
    case "end":
      acts.append(button("Sail again", () => { begin(S.level); renderAll(); }, "lf-btn go"), button("The result", showEnd));
      auxFixed();
      break;
    default: break;
  }
  function auxFixed() {
    aux.append(
      button("Almanac", openAlmanac, "lf-mini"), button("Log", openLog, "lf-mini"), button("Codex", openCodex, "lf-mini"),
    );
    // by day there is no lamp to put out: the fourth button gives up the sight that is next
    const lamp = isDay() ? button("Skip", () => go({ t: "skipstage" }), "lf-mini", { disabled: S.phase !== "find" || !can("skipstage"), label: "Give up this sight of the sun" })
      : button("Lamp", () => { S.ui.lamp = !S.ui.lamp; renderAll(); dirty.sky = true; }, "lf-mini");
    if (!isDay()) lamp.setAttribute("aria-pressed", String(!!S.ui.lamp));
    aux.append(lamp, button("Hint", () => { S.ui.tier = clamp(S.ui.tier - 1, 0, 4); persist(); renderAll(); dirty.sky = true; }, "lf-mini", { disabled: S.phase !== "find" || S.ui.tier <= 0 || isDay() }));
  }
}
function renderText() {
  if (!S) return;
  const W = S.watch, L = levelOf(S), est = estPlace(S);
  const lines = [];
  switch (S.phase) {
    case "ritual": lines.push(`<b>${L.name}.</b> Set the dividers to the log's distance, then step them off.`); break;
    case "find": {
      const c = conditions(S);
      if (isDay()) lines.push(W.min >= maxWait(S) ? "The day is spent. Sail on by the reckoning." : sunTaskWords(S, lookSun(S).cloud));
      else if (W.min >= MAX_WAIT && !c.horizon) lines.push("The horizon has gone with the light. No sight is possible: sail on by the reckoning.");
      else if (W.picked === null) lines.push("Look north for the pole star, and tap a star to choose it.");
      else {
        const s = BY_HR.get(W.picked), p = skyData().stars.find(t => t.hr === s[0]);
        lines.push(`<b>${starLabel(s)}</b>${p ? `, ${Math.round(p.alt)}° up, bearing ${fmtCourse(p.az)}` : ""}${p && !p.vis ? (p.alt <= 0.5 ? " (below the horizon)" : " (not yet visible)") : ""}.`);
      }
      break;
    }
    case "sight": lines.push("The sextant is raised."); break;
    case "book": lines.push("The reading is in the sight book."); break;
    case "steer": {
      const f = forecast(S, S.ui.course);
      const head = S.watch.plot?.accepted ? `<b>Latitude ${fmtLat(S.watch.plot.lat)}.</b> ` : S.watch.plot?.discarded ? "The sight is thrown away. " : "No sight this watch. ";
      lines.push(`${head}Steer <b>${fmtCourse(S.ui.course)}</b>: ${fmtHours(f.hours)} to the next twilight, ${fmtNm(f.run)} on.`);
      break;
    }
    case "end": lines.push(`<b>${endWords(S)?.title ?? "The voyage is over"}.</b>`); break;
    default: break;
  }
  if (reveal) { lines.length = 0; lines.push(revealWords(S)); }
  if (note) lines.push(note);
  $("task").innerHTML = lines.join(" ");
  // the window: which watch, the ship's time and the bell; the help in words
  $("watchTxt").textContent = S.phase === "end" ? L.name : watchWords(S);
  $("clockTxt").textContent = `${shipClock(sceneJd(S), est.lon)}${isDay() ? ` · ${fmtGmt(sceneJd(S))} GMT` : ""}${bellShown.text && performance.now() < bellShown.until ? ` · ${bellShown.text}` : ""}`;
  const h = help();
  $("skyNote").textContent = h ? h.text : "";
  $("desk").classList.toggle("dark", !S.ui.lamp && !isDay());
  $("app").classList.toggle("lf-day", isDay() && S.phase !== "end");
  const sl = $("slate");
  sl.hidden = S.phase !== "ritual";
  if (!sl.hidden) sl.replaceChildren(...slateLines(S).map(t => el("p", null, t)));
}
function renderAll() { renderTools(); renderText(); dirty.sky = dirty.chart = true; wake(); }

// ---------- the sheets ----------
/** The almanac's page for the sun: what the date gives, and when noon should be by the reckoning. */
function openSunAlmanac() {
  learn("sunalmanac");
  const A = sunAlmanac(S), body = $("almanacBody"), t = el("table", "lf-alm"), tb = el("tbody");
  t.innerHTML = "<thead><tr><th>The sun, " + A.date + "</th><th></th></tr></thead>";
  const row = (a, b, cls) => { const tr = el("tr", cls); tr.append(el("td", null, a), el("td", null, b)); tb.append(tr); };
  row("Declination at noon", fmtLat(A.dec));
  row("Semi-diameter", `${A.sd.toFixed(1)}′`);
  row("Equation of time", `${fmtSecs(A.eot)}`);
  row("Noon by your reckoning, ship", A.noonShip, "now");
  row("...and on the chronometer", `${A.noonGmt} GMT`);
  if (A.catchShip) row("The catch, by the morning drum", A.catchShip, "now");
  t.append(tb);
  body.replaceChildren(
    el("p", "lf-note-p", "The sun is the one body whose time you can see: it stops climbing at apparent noon. A positive equation of time means the sun is ahead of the clock and noon comes early. Your reckoned longitude puts noon at the time below; if the ship is east or west of where you think, noon comes earlier or later by four minutes a degree, and that difference is the longitude."),
    t,
    el("p", "lf-note-p", "The morning altitude and the catch are two times at which the sun stood equally high: noon is half way between them. The page gives the declination for the latitude and the equation of time for the longitude."),
  );
  $("almanacDlg").showModal();
}
function openAlmanac() {
  if (isDay()) return openSunAlmanac();
  const A = almanacPage(S), body = $("almanacBody");
  const head = el("p", "lf-note-p", `Polaris, ${A.date}. It stands ${A.pd.toFixed(2)}° (${Math.round(A.pd * 60)}′) from the pole and circles it once a day. The correction below is added to the true altitude to give the latitude. The pole star stands as high as you are far north, less or more by that much.`);
  const t = el("table", "lf-alm");
  t.innerHTML = "<thead><tr><th>Hour angle</th><th>Add</th></tr></thead>";
  const tb = el("tbody");
  const nowRow = A.rows.reduce((b, r) => (Math.abs(norm180(r.lha - A.lha)) < Math.abs(norm180(b.lha - A.lha)) ? r : b));
  for (const r of A.rows) {
    const tr = el("tr"); if (r === nowRow) tr.className = "now";
    tr.append(el("td", null, `${r.lha}°`), el("td", null, `${r.corr >= 0 ? "+" : "−"}${Math.abs(r.corr).toFixed(1)}′`));
    tb.append(tr);
  }
  t.append(tb);
  body.replaceChildren(head, t, el("p", "lf-note-p", `Now (ship's time ${A.ship}) Polaris is at ${Math.round(A.lha)}° by the reckoned longitude: ${A.corr >= 0 ? "+" : "−"}${Math.abs(A.corr).toFixed(1)}′. The page gives latitude only: Polaris says nothing about how far east or west you are.`));
  $("almanacDlg").showModal();
}
function openLog() {
  const body = $("logBody"), rows = logRows(S), ul = el("ul", "lf-logrows");
  for (const r of rows) ul.append(el("li", r.kind === "fix" ? "fix" : "", `${r.watch ? `W${r.watch}  ` : ""}${r.text}`));
  const intro = el("p", "lf-note-p", `${levelOf(S).name}, ${dateWords(S)}. Where the ship has been reckoned to be at each watch, and where a sight fixed her latitude.`);
  body.replaceChildren(intro, ul);
  $("logDlg").showModal();
}
/** A constellation's line figure as a small drawing, from the catalogue's own positions (east to the left, as the sky is seen). */
function figureSvg(key) {
  const F = FIGURES[key], rows = new Map([...new Set(F.lines.flat())].map(d => [d, STARS.find(s => s[2] === d)]));
  const R = Math.PI / 180, all = [...rows.values()];
  const centre = { UMi: [215, 80] }[key] || [all.reduce((t, s) => t + s[3], 0) / all.length, all.reduce((t, s) => t + s[4], 0) / all.length];
  const pt = s => {
    const da = (s[3] - centre[0]) * R, d = s[4] * R, d0 = centre[1] * R;
    return [-Math.cos(d) * Math.sin(da), -(Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(da))];
  };
  const P = new Map([...rows].map(([d, s]) => [d, pt(s)])), xs = [...P.values()].map(p => p[0]), ys = [...P.values()].map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), k = 76 / Math.max(x1 - x0, y1 - y0, 1e-6);
  const X = p => 12 + (p[0] - x0) * k + (76 - (x1 - x0) * k) / 2, Y = p => 12 + (p[1] - y0) * k + (76 - (y1 - y0) * k) / 2;
  const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("class", "lf-fig"); svg.setAttribute("aria-hidden", "true");
  for (const l of F.lines) for (let i = 1; i < l.length; i++) {
    const a = P.get(l[i - 1]), b = P.get(l[i]), n = document.createElementNS(NS, "line");
    n.setAttribute("x1", X(a)); n.setAttribute("y1", Y(a)); n.setAttribute("x2", X(b)); n.setAttribute("y2", Y(b)); svg.append(n);
  }
  for (const [d, p] of P) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", X(p)); c.setAttribute("cy", Y(p)); c.setAttribute("r", d === "α UMi" ? 3.4 : 2.4); svg.append(c);
    if (d === "α UMi") { const ring = document.createElementNS(NS, "circle"); ring.setAttribute("cx", X(p)); ring.setAttribute("cy", Y(p)); ring.setAttribute("r", 7); ring.setAttribute("class", "pole"); svg.append(ring); }
  }
  return svg;
}
function openCodex() {
  const M = read(KEY.mastery, {}), body = $("codexBody");
  body.replaceChildren(...["UMa", "UMi", "Cas"].map(k => {
    const F = FIGURES[k], T = LORE[k], card = el("article", "lf-card");
    card.append(figureSvg(k), el("h3", null, F.name), el("p", "sub", `${F.asterism[0].toUpperCase()}${F.asterism.slice(1)}, ${F.english}. ${monthsText(k)[0].toUpperCase()}${monthsText(k).slice(1)}.`));
    card.append(el("p", null, T.rule), el("p", null, T.story), el("p", null, T.fact), el("p", null, T.german));
    const m = M[k] || 0;
    card.append(el("span", `mastery m${m}`, MASTERY[m]));
    return card;
  }));
  $("codexDlg").showModal();
}
/** The notebook: every note heard so far, by group, with the blanks still to fill; the ones not yet met are only counted. */
function openNotes() {
  const have = read(KEY.notes, {}), ctx = { lat: S ? estPlace(S).lat : 55 }, t = tally(have), body = $("notesBody");
  body.replaceChildren(el("p", "lf-note-p", `${t.got} of ${t.of} noted. The rest you will meet at sea; a blank (___) is filled by sailing on.`));
  for (const [g, title] of GROUPS) {
    const sec = el("section", "lf-nb"), all = NOTES.filter(n => n.g === g), heard = all.filter(n => have[n.id]);
    sec.append(el("h3", null, `${title} ${heard.length}/${all.length}`));
    for (const n of heard) {
      const p = el("p", have[n.id] === 1 ? "gap" : null);
      p.append(el("b", null, `${n.term}. `), document.createTextNode(textOf(n, have, ctx)));
      sec.append(p);
    }
    if (heard.length < all.length) sec.append(el("p", "blank", `${all.length - heard.length} still to find`));
    body.append(sec);
  }
  $("notesDlg").showModal();
}
/** How a sight works; `sun` for the sun's three sights (shown by itself the first time a noon watch begins, and from the menu). */
function openHelp(sun = false) {
  const rows = sun === true ? HOW_SUN : HOW;
  $("helpTitle").textContent = sun === true ? "How the sun is taken" : "How a sight works";
  $("helpBody").replaceChildren(...rows.map(([h, t]) => { const li = el("li"); li.append(el("b", null, h), el("span", null, t)); return li; }));
  write(sun === true ? KEY.seenSun : KEY.seen, 1);
  $("helpDlg").showModal();
}
for (const [btn, dlg] of [["notesClose", "notesDlg"], ["almanacClose", "almanacDlg"], ["logClose", "logDlg"], ["codexClose", "codexDlg"], ["helpClose", "helpDlg"], ["helpOk", "helpDlg"]]) $(btn).addEventListener("click", () => $(dlg).close());

// ---------- the menu ----------
function inProgress() { return S && S.phase !== "end" && (S.w > 1 || S.phase !== "ritual" || S.watch.min > 0); }
async function startLevel(id) {
  if (inProgress() && !(await sure("Leave this voyage and start another?", { yes: "New voyage" }))) return;
  begin(id); renderAll();
}
function openMenu() {
  const body = $("menuBody"), L = levelOf(S), best = read(KEY.best, {});
  body.replaceChildren();
  part(body, "play").append(action(S.phase === "end" ? "Sail again" : "A new voyage", () => startLevel(S.level), "primary"));
  part(body, "content").append(choice("Voyage", LEVELS.map(l => [l.id, `${l.n} ${l.name}${best[l.id] ? ` ${"★".repeat(best[l.id])}` : ""}`]), S.level, v => { $("menuDlg").close(); startLevel(v); }));
  const set = part(body, "settings");
  set.append(toggle("Sound", !sound.muted, on => { sound.setMuted(!on); write(KEY.sound, on); if (on) { sound.unlock(); sound.bed(!!S && S.phase !== "end"); sound.day(!!S && isDay() && S.phase !== "end"); } }));
  set.append(choice("View", [["3d", "3D"], ["flat", "Flat"]], stage ? "3d" : "flat", v => { $("menuDlg").close(); setView(v); }));
  set.append(choice("Help", [["-1", "Fuller"], ["0", "As set"], ["1", "Thinner"]], String(helpShift()), v => { write(KEY.help, Number(v)); renderAll(); }));
  const about = part(body, "about");
  about.append(action("Notebook", openNotes, "link"), action("Codex", openCodex, "link"), action("Almanac", openAlmanac, "link"), action("How a sight works", () => openHelp(false), "link"), action("How the sun is taken", () => openHelp(true), "link"));
  about.append(line(`${L.name}: ${L.lesson}`));
  about.append(line("The stars are the Yale Bright Star Catalogue (NASA data), checked against Hipparcos (ESA). The sun and the sky are our own arithmetic, checked against an independent library. The sea, its coasts and its harbours are invented."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());

// ---------- the deck in 3D ----------
const reducedMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
let worldKey = "", dialSec = -1, deskH = 0;
/** What the scene is told every frame: the sky as the true ship sees it, the weather, the ship's heading and what is picked. */
function pushWorld(now) {
  const d = skyData(), h = help(), W = S.watch, L = levelOf(S), wx = W.weather, sc = stage.scene.S, sun = d.sun;
  const picked = W.picked, name = picked > 0 ? starLabel(BY_HR.get(picked)) : "", fig = h?.figure ? FIGS[h.figure] : null;
  const key = `${d.key}|${S.ui.lamp}|${picked}|${h?.ring ?? ""}|${h?.figure ?? ""}|${S.phase}`;
  const clouds = cloudsNow(S);
  Object.assign(sc, {
    headingTo: S.leg ? S.leg.course : 0, sunAlt: sun.alt, sunAz: sun.az, limMag: d.lim, lamp: !!S.ui.lamp || isDay(), day: isDay(), stars: d.stars, clouds,
    weather: wx, swell: L.swell * (wx === "swell" ? 2 : wx === "storm" ? 2.4 : 1), storm: wx === "storm" ? 1 : 0, picked, pickedName: name, figure: fig, ring: h?.ring ?? null,
    sunHidden: isDay() && lookSun(S).cloud,
  });
  const c = calendar(sceneJd(S)), sec = c.h * 3600 + c.mi * 60 + c.s;
  if (sec !== dialSec) { dialSec = sec; sc.gmt = `${c.h}:${c.mi}:${c.s}`; }
  if (key !== worldKey) { worldKey = key; stage.refreshSky(); }
  if (clouds.length || sc._clouds) { stage.setClouds(); sc._clouds = clouds.length; }
}
let lastRoll = 0, rollDir = 0, weatherSent = -1;
/** The sea's sound follows the deck: the weather sets the wind, and each extreme of the roll may bring a creak. */
function soundOfSea() {
  const sc = stage.scene.S, w = windOf(sc.swell, sc.weather);
  if (Math.abs(w - weatherSent) > 0.02) { weatherSent = w; sound.weather(w); }
  const r = stage.scene.motion.roll, dir = Math.sign(r - lastRoll);
  if (dir && rollDir && dir !== rollDir) sound.roll(Math.abs(lastRoll));
  if (dir) rollDir = dir;
  lastRoll = r;
}
const stageHooks = {
  reduced: reducedMotion,
  unlock: () => sound.unlock(),
  bottom: () => $("desk").offsetHeight,
  canChart, canPick: () => !!S && S.phase === "find" && !paused && !IN_FRAME && !isDay(),
  stars: () => skyData().stars.filter(t => t.vis),
  pick: s => choose(s.hr),
  tapEmpty: () => { if (S && S.phase === "find") { note = ""; renderText(); } },
  chart(kind, x, y) {
    if (kind === "up") { chartDrag = false; return; }
    if (kind === "down") { sound.unlock(); if (!canChart()) return; chartDrag = true; }
    if (chartDrag && canChart()) chartPoint(x, y);
  },
  chartResized(c) { fixedSize.set(c.canvas, { width: c.w, height: c.h, dpr: c.dpr }); chartCv = c.canvas; box.delete(chartCv); retarget(); dirty.chart = true; },
  drawChart: () => drawChartNow(performance.now()),
  prop(id) {
    if (!S || paused || IN_FRAME) return;
    if (id === "log") openLog();
    else if (id === "sextant") { if (moves(S).includes("raise") && !reveal) go({ t: "raise" }); }
    else if (id === "lamp" && !isDay() && S.phase !== "sight") { S.ui.lamp = !S.ui.lamp; renderAll(); }
    else if (id === "chrono") { note = `The chronometer reads ${fmtGmt(sceneJd(S))} GMT, the time at Greenwich.`; renderText(); }
  },
};
const lookLabel = () => {
  const dh = $("desk").offsetHeight; if (dh && dh !== deskH) { deskH = dh; $("app").style.setProperty("--lf-desk", `${dh}px`); }
  const b = $("lookBtn"), down = stage?.isDown(), t = down ? "Sky" : "Chart"; if (b.textContent !== t) { b.textContent = t; b.setAttribute("aria-label", down ? "Look up at the sky" : "Look down at the chart table"); } };
/** Moves the page's loose parts between the flat window and the 3D stage. */
function dress(on) {
  const st = $("stage");
  for (const id of ["hud", "skyNote", "skyBar", "lookBtn", "slate", "cap"]) { const n = $(id); if (!n) continue; if (on) st.append(n); else (id === "slate" || id === "cap" ? $("chartBox") : id === "lookBtn" ? st : $("windowBox")).append(n); }
  $("app").classList.toggle("lf-3d", on); $("app").classList.toggle("over", on);
  st.hidden = !on;
  if (on && full) setFull(false);
}
let viewBusy = false;
/** Where the sextant is raised to: the picked star, or the sun, as the true sky has it. */
const sightTarget = () => { const d = skyData(), W = S.watch; return isDay() ? d.sun : d.stars.find(x => x.hr === W.picked) || { az: 0, alt: 40 }; };
/** Goes to the 3D deck, or back to the flat window. Returns whether 3D is up. */
async function setView(v, remember = true) {
  if (viewBusy) return !!stage;
  const want = v === "3d";
  if (want === !!stage) { if (remember) write(KEY.view, v); return !!stage; }
  viewBusy = true;
  try {
    if (want) {
      let made = null;
      try { made = (await import("./landfall-stage.js")).createStage($("stageGl"), stageHooks); } catch (e) { made = null; console.warn("Landfall: no 3D here, staying flat", e); }
      if (!made) return false;
      stage = made;
      dress(true);
      lookLabel();
      requestAnimationFrame(() => {
        stage.resize();
        if (sxs) { const t = sightTarget(); stage.raise(t.az, t.alt, true); }
        else if (S.phase === "ritual" || S.phase === "steer" || S.phase === "end") { stage.look.pitch = -78; stage.look.az = 0; }
        else { stage.look.pitch = 40; stage.look.az = isDay() ? skyData().sun.az : 0; }
        dirty.chart = true; wake();
      });
    } else {
      const old = stage;
      stage = null;
      dress(false);
      chartCv = flatChart; box.delete(chartCv);
      old.dispose();
      retarget();
    }
    if (remember) write(KEY.view, v);
    dirty.sky = dirty.chart = true; wake();
  } finally { viewBusy = false; }
  return !!stage;
}
$("lookBtn").addEventListener("click", () => { sound.unlock(); stage?.toggleLook(); wake(); });
onDefaultChange(is3D => { if (read(KEY.view, null) == null) setView(is3D ? "3d" : "flat", false); });

// ---------- the frame loop: draws only while something moves ----------
let raf = 0, lastT = 0, lastPersist = 0, lastSky = 0, lastText = 0;
function wake() { if (!raf && !document.hidden && !paused) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
function frame(now) {
  raf = 0;
  if (!S || paused || document.hidden) return;
  const dt = Math.min(0.25, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  let more = false;
  if (tickClock(dt, now)) { more = true; if (!sxs) dirty.sky = true; }
  if (stepCam(dt)) { more = true; dirty.chart = true; }
  if (reveal) {
    more = true; dirty.chart = true;
    const u = reveal.hold ?? (now - reveal.t0) / 1000;
    if (!reveal.chimed && u > 0.75) { reveal.chimed = true; sound.good(); }
    if (u > 2.4) { reveal = null; retarget(); renderAll(); }
  }
  if (sxs) { more = true; drawScopeNow(now); }
  if (stage) {                                   // the deck: drawn every frame, for the sea and the ship are never still
    pushWorld(now); lookLabel(); soundOfSea();
    if (dirty.chart) { stage.chartChanged(); dirty.chart = false; }
    stage.tick(now);
    more = true;
  } else {
    const skyLive = S.phase === "find" || full || (sideways() && S.phase === "find");
    if (dirty.sky || (skyLive && now - lastSky > 45)) { drawSkyNow(now); lastSky = now; }
    if (skyLive) more = true;
    if (dirty.chart) drawChartNow(now);
  }
  if (S.phase === "find" && now - lastText > 500) { lastText = now; renderText(); }          // the ship's time, the bell and the star's height
  if ((S.phase === "find" || sxs) && now - lastPersist > 3000) { lastPersist = now; persist(); }
  if (more) raf = requestAnimationFrame(frame);
}

// ---------- start up ----------
function fitTop() {
  const app = $("app"), head = app.querySelector(".top");
  app.style.setProperty("--lf-top", `${head.getBoundingClientRect().bottom - app.getBoundingClientRect().top}px`);
}
function resized() {
  fitTop();
  if (sideways() && full) setFull(false);
  box.delete(skyCv); box.delete(chartCv); box.delete(scopeCv);
  dirty.sky = dirty.chart = true;
  wake();
}
new ResizeObserver(() => { fitTop(); dirty.sky = dirty.chart = true; wake(); }).observe($("app"));
for (const c of [skyCv, chartCv, scopeCv]) new ResizeObserver(() => { dirty.sky = dirty.chart = true; wake(); }).observe(c);
addEventListener("resize", resized);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { sound.pause(); persist(); } else { if (!paused) sound.resume(); wake(); }
});
addEventListener("pagehide", persist);
onPause(() => { paused = true; sound.pause(); persist(); }, () => { paused = false; sound.resume(); wake(); });
document.addEventListener("pointerdown", () => sound.unlock(), { capture: true });

bindSwitcher($("appsBtn"), "landfall");
document.querySelector(".lf-mark").innerHTML = APPS.find(a => a.id === "landfall")?.logo ?? "";

sound.setMuted(!read(KEY.sound, true));
{
  const raw = (() => { try { return localStorage.getItem(KEY.run); } catch { return null; } })();
  carryCourse();
  S = raw ? restore(raw) : null;
  if (S) S.ui = { ...freshUi(), ...(S.ui || {}) };
  else begin(LEVELS.some(l => l.id === read(KEY.level, "")) ? read(KEY.level, "") : LEVELS[0].id);
}
fitTop();
renderAll();
if (!IN_FRAME && wants3D(read(KEY.view, null), "3d")) setView("3d", false);
if (S.phase === "sight") openScope(true);
else if (S.phase === "book") openBook();
else if (S.phase === "end") showEnd();
if (!IN_FRAME) { sound.bed(S.phase !== "end"); sound.day(isDay() && S.phase !== "end"); if (!read(KEY.seen, 0)) openHelp(); }
wake();

// for tests and debugging
window.__landfall = {
  get stage() { return stage; }, setView,
  get S() { return S; }, set S(v) { S = v; S.ui = { ...freshUi(), ...(S.ui || {}) }; retarget(); renderAll(); },
  get sxs() { return sxs; }, get view() { return full ? free : view; }, get cam() { return cam; }, get reveal() { return reveal; },
  go, begin, choose, setFull, openScope, closeScope, openMenu, openCodex, openNotes, learn, openAlmanac, openLog, openHelp, openBook, showEnd, renderAll, setDividers, setCourse,
  advance(seconds) { for (let t = 0; t < seconds; t += 0.25) tickClock(0.25, performance.now()); dirty.sky = true; renderAll(); },
  skyData, layout: () => { const b = fit(scopeCv); return sx.layout(b.w, b.h); },
  starAt(hr) { const s = skyData().stars.find(t => t.hr === hr), r = skyCv.getBoundingClientRect(); const p = project(curView(r.width, r.height), s.az, s.alt); return p && [p.x + r.left, p.y + r.top]; },
  frame: () => { lastT = performance.now() - 16; frame(performance.now()); },
  tickClock, waitUntil,
  setDrum(v) { if (sxs) { sxs.exact = v; settleReading(); } },
  /** Stands the reveal still at `u` seconds (a look at it), or lets it run again with no argument. */
  holdReveal(u) { if (reveal) { reveal.hold = u ?? undefined; dirty.chart = true; wake(); } },
};
