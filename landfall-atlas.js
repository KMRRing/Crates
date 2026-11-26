// Traverse's Atlas on the page: one area of a region, one start in it. You look round the real terrain, take bearings on peaks you
// name, and mark on the map where you stand; the mark is scored by how far it is from where you were (landfall-atlas-engine.js).
// landfall.js shows this in place of the voyage when the menu's Play is set to Atlas, and asks it for its part of the menu.
// A play is one of four: free play in a region you have opened, a lesson of chapters 7 and 8 (landfall-atlas-lessons.js), today's
// start (the same for everyone, in any region built, opened or not: the daily lends what you haven't earned yet), or a fix of a
// region's master test. Everything lives under `landfall:` keys, so it syncs and a watching partner sees the same.
import { REGIONS } from "./landfall-atlas-regions.js";
import { loadArea, regionIndex } from "./landfall-atlas-pack.js";
import { newPlay, takeBearing, dropBearing, lineOf, mark, finish, compassOf, seesNow, rng } from "./landfall-atlas-engine.js";
import { drawView, relief, contours, contourAt, mapFrame, declutter } from "./landfall-atlas-view.js";
import { blank, learn, areaState, peakState, weightFor, tested, dayNumber, TEST, FIXES } from "./landfall-atlas-mastery.js";
import { LESSONS, lessonById, PASS } from "./landfall-atlas-lessons.js";
import { CHAPTERS, chapterDone } from "./landfall-chapters.js";
import { distanceBearing, angleTo } from "./landfall-terrain.js";
import { choice, line, action } from "./menu.js";
import { ramp } from "./ramp.js";
import { busy } from "./loading.js";
import { IN_FRAME, today } from "./suite.js";
import { notice } from "./sure.js";

const $ = id => document.getElementById(id);
const KEY = { play: "landfall:atlas-play", where: "landfall:atlas-where", best: "landfall:atlas-best", know: "landfall:atlas-know", campaign: "landfall:best", daily: "landfall:daily" };
const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const night = () => document.documentElement.dataset.mode === "night" || (!document.documentElement.dataset.mode && matchMedia("(prefers-color-scheme: dark)").matches);

let pack = null, play = null, look = { az: 0, fov: 60, pitch: 3 }, map = null, built = null;
const levelNow = () => ramp("landfall", ["easy", "medium", "hard"], { id: "atlas", start: "easy" });
const know = () => ({ ...blank(), ...read(KEY.know, {}) });
const day = () => dayNumber(today());

// ---------- where to play ----------
/** The regions with a pack, and their areas (from each region's index, once). */
async function builtRegions() {
  if (built) return built;
  const out = [];
  for (const R of REGIONS.filter(r => r.built)) { const ix = await regionIndex(R.id); if (ix?.areas?.length) out.push({ ...R, areas: R.areas.filter(a => ix.areas.some(b => b.id === a.id && b.starts > 0)), credit: ix.attribution }); }
  return (built = out);
}
/** The built regions the campaign has opened: a region opens when its chapter is done (the Alps: chapter 7). */
const openRegions = async () => (await builtRegions()).filter(R => chapterDone(R.opens, read(KEY.campaign, {})));
const where = () => read(KEY.where, { region: "alps", area: "" });
/** The first lesson not yet passed, in the campaign's order (the way into the Atlas before any region is open). */
const nextLesson = () => LESSONS.find(l => (read(KEY.campaign, {})[l.id] || 0) < PASS) || LESSONS[0];

// ---------- a play ----------
/** The view's width in degrees for its box: about 48 degrees top to bottom, whichever way the screen is held. */
const fitFov = () => { const r = $("atViewCv").getBoundingClientRect(); return r.height ? Math.max(40, Math.min(90, Math.round(48 * r.width / r.height))) : 60; };

/** Loads an area's pack, saying so while it comes; false (and a word on the screen) if it can't. */
async function loadPack(region, area) {
  const done = busy("Laying out the ground");
  try { pack = await loadArea(region, area); return true; } catch { $("atTask").textContent = "This area could not be loaded. It needs the network the first time."; return false; } finally { done(); }
}
/** Starts `p` (a new play, or one restored) on the pack in hand: faces you toward the best-known summit in sight. */
function begin(p) {
  play = p; write(KEY.play, play); map = null;
  // a little above the middle of the picture: a start under a wall would otherwise open on the wall, its summit peeping over the top
  const s = pack.starts[play.start], eye = s.ele + 1.7;
  const first = seesNow(pack, play).map(i => pack.landmarks[i]).sort((a, b) => (b.links || 0) - (a.links || 0))[0];
  const fb = first && distanceBearing(s.lat, s.lon, first.lat, first.lon);
  look = { az: fb ? Math.round(fb.b) : 0, fov: fitFov(), pitch: fb ? Math.max(-10, Math.min(25, angleTo(eye, first.ele, fb.d) - 4)) : 3 };
  render();
}
const seed = () => Date.now() & 0x7fffffff;

/** Free play in the chosen region (or the saved play, if it is one of those and its pack is unchanged); a lesson before any opens. */
export async function startPlay({ fresh = false } = {}) {
  const saved = !fresh && read(KEY.play, null);
  if (saved?.lesson || saved?.daily || saved?.test) return resume(saved);
  const regions = await openRegions();
  if (!(await builtRegions()).length) { $("atTask").textContent = "The Atlas's terrain is still being prepared."; return; }
  if (!regions.length) return startLesson(nextLesson().id);
  const w = where(), R = regions.find(r => r.id === w.region) || regions[0];
  const areaId = saved?.region === R.id && (!w.area || saved.area === w.area) ? saved.area : (w.area || R.areas[Math.floor(Math.random() * R.areas.length)].id);
  if (!(await loadPack(R.id, areaId))) return;
  // a play saved on an older build of the pack points at starts that may have moved: it is begun again
  if (saved && saved.area === areaId && saved.region === R.id && (saved.built || "") === pack.built) return begin(saved);
  begin({ ...newPlay(pack, { seed: seed(), level: levelNow(), weight: weightFor(know(), pack, day()) }), built: pack.built });
}
/** A saved lesson, daily or test fix, picked up where it was left (or begun again on a rebuilt pack). */
async function resume(saved) {
  if (!(await loadPack(saved.region, saved.area))) return;
  if ((saved.built || "") === pack.built && (!saved.daily || saved.daily === today())) return begin(saved);
  if (saved.lesson) return startLesson(saved.lesson);
  if (saved.daily) return startDaily();
  return startTest(saved.test);
}
/** A lesson of chapters 7 and 8, from its own start. */
export async function startLesson(id) {
  const L = lessonById(id); if (!L) return;
  if (!(await loadPack(L.region, L.area))) return;
  const i = Math.max(0, pack.starts.findIndex(s => s.id === L.start));
  begin({ ...newPlay(pack, { seed: seed(), level: L.level, start: i, cloud: L.cloud || 0, alti: !!L.alti, lesson: L.id }), built: pack.built });
  if (!IN_FRAME) notice(`${L.name}. ${L.lesson}`, { ok: "Go" });     // the lesson once, on a card; the strip keeps only the task
}
/** Today's start: one region, area and start for everyone from the day, on Medium, in any region built. */
export async function startDaily() {
  const d = today(), r = rng(d), regions = await builtRegions();
  if (!regions.length) return;
  const R = regions[Math.floor(r() * regions.length)], A = R.areas[Math.floor(r() * R.areas.length)];
  if (!(await loadPack(R.id, A.id))) return;
  begin({ ...newPlay(pack, { seed: d, level: "medium", daily: d }), built: pack.built });
}
/** A fix of a region's master test: Hard, anywhere in the region. */
async function startTest(region) {
  const R = (await builtRegions()).find(r => r.id === region); if (!R) return;
  const A = R.areas[Math.floor(Math.random() * R.areas.length)];
  if (!(await loadPack(R.id, A.id))) return;
  begin({ ...newPlay(pack, { seed: seed(), level: "hard" }), test: region, built: pack.built });
}
export const isDaily = () => !!play?.daily && play.daily === today();
/** What the play is, for the menu's first button: "lesson", "test" or "free" (today's counts as free: its button is the menu's own). */
export const kind = () => (play?.lesson ? "lesson" : play?.test ? "test" : "free");

// ---------- drawing ----------
const box = el => { const r = el.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)), d }; };
function sizeCanvas(cv) { const b = box(cv); if (cv.width !== b.w * b.d || cv.height !== b.h * b.d) { cv.width = b.w * b.d; cv.height = b.h * b.d; } return b; }

let viewMap = null, quick = false;
function drawViewNow() {
  if (!pack || !play) return;
  const cv = $("atViewCv"), b = sizeCanvas(cv), ctx = cv.getContext("2d"), s = pack.starts[play.start], lv = play.level;
  ctx.setTransform(b.d, 0, 0, b.d, 0, 0);
  const haze = lv === "hard" ? 28000 : lv === "medium" ? 45000 : 70000;
  viewMap = drawView(ctx, b.w, b.h, pack.at, { lat: s.lat, lon: s.lon, h: s.ele }, { ...look, haze, night: night(), scale: quick ? 0.5 : 1, fine: pack.fine, cloud: play.cloud || 0 });
  // the compass along the top: ticks every 5 degrees, figures every 30, the cardinal points
  ctx.save(); ctx.font = "600 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1;
  for (let a = Math.floor((look.az - look.fov / 2) / 5) * 5; a <= look.az + look.fov / 2; a += 5) {
    const p = viewMap.toScreen(((a % 360) + 360) % 360, 0); if (!p) continue;
    const big = a % 30 === 0; ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, big ? 9 : 5); ctx.stroke();
    if (big) { const t = ((a % 360) + 360) % 360; ctx.fillText(({ 0: "N", 90: "E", 180: "S", 270: "W" })[t] ?? String(t).padStart(3, "0"), p.x, 21); }
  }
  // the lubber line: what a bearing taken now reads
  ctx.strokeStyle = "rgba(255,214,120,0.95)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(b.w / 2, 26); ctx.lineTo(b.w / 2, b.h); ctx.stroke();
  // on Easy the landmarks in sight are named where they stand; once a play is over, every one is
  if (lv === "easy" || play.done) {
    ctx.font = "12px Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const items = [];
    for (const i of seesNow(pack, play)) {
      const l = pack.landmarks[i], { d, b: br } = distanceBearing(s.lat, s.lon, l.lat, l.lon), p = viewMap.toScreen(br, angleTo(viewMap.eye, l.ele, d));
      if (p) items.push({ x: p.x, y: p.y - 6, px: p.y, w: ctx.measureText(l.name).width + 8, h: 16, rank: (l.links || 0) + l.ele / 1000 - d / 20000, name: l.name });
    }
    for (const it of declutter(items, { lifts: 3, row: 17, bounds: { x: 0, y: 26, w: b.w, h: b.h - 26 } })) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.moveTo(it.x, it.ly + it.h); ctx.lineTo(it.x, it.px - 2); ctx.stroke();
      ctx.fillStyle = "rgba(20,24,30,0.6)"; ctx.fillRect(it.lx, it.ly, it.w, it.h);
      ctx.fillStyle = "#fff"; ctx.fillText(it.name, it.x, it.ly + 12);
    }
  }
  ctx.restore();
  $("atRead").textContent = `${String(Math.round(compassOf(play, look.az)) % 360).padStart(3, "0")}°`;
  // the altimeter, to the nearest 10 m as a good one reads
  $("atAlt").hidden = !play.alti;
  if (play.alti) $("atAlt").textContent = `${(Math.round(s.ele / 10) * 10).toLocaleString("en-GB")} m`;
}

function mapState() {
  if (map && map.area === pack.area) return map;
  const g = pack.fine;
  return (map = { area: pack.area, base: relief(g, { night: night() }), lines: contours(g), cx: (g.cols - 1) / 2, cy: (g.rows - 1) / 2, k: 0, alt: null });
}
function drawMapNow() {
  if (!pack || !play) return;
  const cv = $("atMapCv"), b = sizeCanvas(cv), ctx = cv.getContext("2d"), M = mapState(), g = pack.fine;
  // the area fills the box, whichever way it is longer; dragging shows the rest
  if (!M.k) M.k = Math.max(b.w / g.cols / Math.cos((g.s + g.n) / 2 * Math.PI / 180) * ((g.n - g.s) / (g.rows - 1)) / ((g.e - g.w) / (g.cols - 1)), b.h / g.rows) * 0.98;
  const F = mapFrame(g, b.w, b.h, M), o = F.gridToScreen(0, 0);
  ctx.setTransform(b.d, 0, 0, b.d, 0, 0);
  ctx.fillStyle = night() ? "#141a1e" : "#e6d8b6"; ctx.fillRect(0, 0, b.w, b.h);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(M.base, o.x, o.y, g.cols * F.kx, g.rows * F.k);
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(F.kx, F.k);
  ctx.strokeStyle = night() ? "rgba(200,170,120,0.35)" : "rgba(120,80,40,0.35)"; ctx.lineWidth = 0.6 / F.k; ctx.stroke(M.lines.thin);
  ctx.strokeStyle = night() ? "rgba(220,180,130,0.6)" : "rgba(110,70,30,0.65)"; ctx.lineWidth = 1.1 / F.k; ctx.stroke(M.lines.bold);
  // on Easy, the contour at your altimeter's height, drawn for you (chapter 8's first lesson); after that you find it yourself
  if (play.alti && (play.level === "easy" || play.done)) {
    const h = Math.round(pack.starts[play.start].ele / 10) * 10;
    if (M.alt?.h !== h) M.alt = { h, path: contourAt(g, h) };
    ctx.strokeStyle = "#2a6fb0"; ctx.lineWidth = 2 / F.k; ctx.stroke(M.alt.path);
  }
  ctx.restore();
  const ink = night() ? "#e8dcc4" : "#33291c";
  // the landmarks: a triangle and a name (a map names its summits; telling which is which in the view is the skill)
  ctx.font = "11px Georgia, serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  // each summit's triangle says how well you know it: green known from every side it is seen from, brass from some, ink not yet
  const names = [], K = know(), d = day();
  pack.landmarks.forEach((l, i) => {
    const p = F.toScreen(l.lat, l.lon); if (p.x < -4 || p.y < -4 || p.x > b.w + 4 || p.y > b.h + 4) return;
    const st = peakState(K, pack, i, d);
    ctx.fillStyle = st.known ? "#2f7d4a" : st.has ? "#b08a2e" : ink; ctx.beginPath(); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x + 3.5, p.y + 2.5); ctx.lineTo(p.x - 3.5, p.y + 2.5); ctx.fill();
    const tw = ctx.measureText(l.name).width; names.push({ x: p.x + 5 + tw / 2, y: p.y + 7, w: tw, h: 13, rank: (l.links || 0) + l.ele / 1000, name: l.name });
  });
  ctx.lineWidth = 3; ctx.strokeStyle = night() ? "#141a1e" : "#efe5cc"; ctx.fillStyle = ink;
  for (const n of declutter(names, { lifts: 0, gap: 8, bounds: { x: 0, y: 0, w: b.w - 70, h: b.h } })) { ctx.strokeText(n.name, n.lx, n.ly + 6.5); ctx.fillText(n.name, n.lx, n.ly + 6.5); }
  // the bearings taken: each a line back from its landmark
  ctx.lineWidth = 1.6;
  play.bearings.forEach((bg, i) => {
    const pts = lineOf(pack, bg); if (!pts) return;
    ctx.strokeStyle = play.done ? (play.named?.[i]?.right ? "#2f7d4a" : "#a8382b") : "#a07a2c"; ctx.setLineDash([]);
    ctx.beginPath(); pts.forEach(([la, lo], k) => { const q = F.toScreen(la, lo); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke();
  });
  // your mark, and once done where you really were
  if (play.mark) { const p = F.toScreen(play.mark.lat, play.mark.lon); ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.283); ctx.moveTo(p.x - 11, p.y); ctx.lineTo(p.x + 11, p.y); ctx.moveTo(p.x, p.y - 11); ctx.lineTo(p.x, p.y + 11); ctx.stroke(); }
  if (play.done) {
    const s = pack.starts[play.start], p = F.toScreen(s.lat, s.lon);
    ctx.fillStyle = "#a8382b"; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 6.283); ctx.fill();
    ctx.font = "600 12px Georgia, serif"; ctx.fillStyle = ink; ctx.lineWidth = 3; ctx.strokeStyle = night() ? "#141a1e" : "#efe5cc"; ctx.strokeText(s.name, p.x + 8, p.y - 10); ctx.fillText(s.name, p.x + 8, p.y - 10);
  }
  map.frame = F;
}

let raf = 0;
function render() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; drawViewNow(); drawMapNow(); words(); });
}

// ---------- words and buttons ----------
const kmOrM = m => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
function words() {
  if (!pack || !play) return;
  const acts = $("atActs"), s = pack.starts[play.start], L = play.lesson && lessonById(play.lesson);
  acts.replaceChildren();
  const btn = (text, fn, cls = "") => { const b = document.createElement("button"); b.type = "button"; b.className = `lf-btn ${cls}`; b.textContent = text; b.addEventListener("click", fn); acts.append(b); return b; };
  const area = REGIONS.find(r => r.id === pack.region)?.areas.find(a => a.id === pack.area)?.name || pack.name;
  if (play.done) {
    const how = `You were at ${s.name}, ${kmOrM(play.error)} from your mark: ${play.stars ? "★".repeat(play.stars) : "no stars"}. ${play.named.filter(n => n.right).length} of ${play.named.length} named right.`;
    if (L) {
      const passed = play.stars >= PASS, ch = CHAPTERS[L.chapter - 1], next = ch.levels[ch.levels.indexOf(L.id) + 1];
      const opened = passed && L.chapter === 7 && !next && chapterDone(7, read(KEY.campaign, {}));
      $("atTask").textContent = `${how} ${passed ? (opened ? "Chapter 7 is done: the Alps are open to you in the Atlas." : "Passed.") : `${PASS} stars pass.`}`;
      if (!passed) btn("Try again", () => startLesson(L.id), "go");
      else if (next) btn("Next lesson", () => startLesson(next), "go");
      else btn("To the Atlas", () => startPlay({ fresh: true }), "go");
      if (passed) btn("Again", () => startLesson(L.id));
    } else if (play.daily) {
      $("atTask").textContent = `Today's start. ${how} Tomorrow's is somewhere else.`;
      btn("Free play", () => startPlay({ fresh: true }), "go");
    } else if (play.test) {
      const t = know().tests[play.test] || {};
      $("atTask").textContent = `${how} ${t.passed ? "The master test is passed: the region is yours." : t.streak ? `Master test: ${t.streak} of ${TEST} in a row.` : `Master test: two stars or more, ${TEST} in a row. From the start again.`}`;
      btn(t.passed ? "Free play" : "Next fix", () => (t.passed ? startPlay({ fresh: true }) : startTest(play.test)), "go");
    } else {
      $("atTask").textContent = `${area}. ${how}`;
      btn("Next start", () => startPlay({ fresh: true }), "go");
    }
    return;
  }
  const n = play.bearings.length;
  $("atTask").textContent = !n ? (L ? `${L.name}: ${L.task}` : `${play.daily ? "Today's start, " : play.test ? "Master test, " : ""}${area}. Turn to a summit you know, centre it on the line, take its bearing and name it.`)
    : n === 1 ? (play.alti ? "One line, and your height: where the line meets your contour is where you stand." : "One line: you are somewhere on it. A second summit well round the compass crosses it.")
    : play.mark ? "Your mark is on the map. Fix it there, or move it." : "Where the lines cross is where you stand: tap the map there.";
  btn(n ? "Bearing" : "Take bearing", pickLandmark, "go");
  if (n) btn("Undo", () => { play = dropBearing(play, n - 1); save(); });
  const fx = btn("Fix here", () => { play = finish(pack, play); save(); scored(); });
  fx.disabled = !play.mark;
}
function save() { write(KEY.play, play); render(); }
/** A finished play: what it taught you, and what it counts for (a lesson's stars, today's, the master test, the area's best). */
function scored() {
  let K = learn(know(), pack, play, day());
  K.areas = { ...(K.areas || {}), [`${pack.region}/${pack.area}`]: areaState(K, pack, day()) };
  if (play.test) K = tested(K, play.test, play.stars);
  write(KEY.know, K);
  if (play.lesson) { const b = read(KEY.campaign, {}); if ((b[play.lesson] || 0) < play.stars) write(KEY.campaign, { ...b, [play.lesson]: play.stars }); }
  else if (play.daily) { const dd = read(KEY.daily, {}); if (dd[play.daily] == null) write(KEY.daily, { ...dd, [play.daily]: play.stars }); }   // the first finish is the day's
  else if (!play.test) {
    const best = read(KEY.best, {}), key = `${play.region}/${play.area}`;
    if ((best[key] || 0) < play.stars) write(KEY.best, { ...best, [key]: play.stars });
    if (play.stars >= 2) ramp.won(play.stars === 3); else if (!play.stars) ramp.lost();
  }
  render();
}

/** The list to name what is under the lubber line: the area's landmarks, nearest the line first. */
function pickLandmark() {
  const s = pack.starts[play.start], reading = compassOf(play, look.az);
  const dlg = $("atPick"), list = $("atPickList");
  $("atPickHead").textContent = `Bearing ${String(Math.round(reading) % 360).padStart(3, "0")}°: which summit is it?`;
  list.replaceChildren();
  // on Easy the names stand in the view already, so those nearest the line come first; otherwise A to Z gives nothing away
  const off = l => Math.abs(((distanceBearing(s.lat, s.lon, l.lat, l.lon).b - look.az + 540) % 360) - 180);
  const sees = seesNow(pack, play);
  const order = pack.landmarks.map((l, i) => ({ l, i, off: play.level === "easy" && sees.includes(i) ? Math.floor(off(l) / 4) : 99 }))
    .sort((a, b) => a.off - b.off || a.l.name.localeCompare(b.l.name));
  for (const { l, i } of order) {
    const b = document.createElement("button"); b.type = "button"; b.className = "btn lf-at-name"; b.textContent = l.name;
    b.addEventListener("click", () => { dlg.close(); play = takeBearing(play, reading, i); save(); });
    list.append(b);
  }
  dlg.showModal();
}

// ---------- touch ----------
function bindView() {
  const cv = $("atViewCv");
  let drag = null;
  cv.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, az: look.az, pitch: look.pitch, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => {
    if (!drag) return;
    const r = cv.getBoundingClientRect(), dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    look.az = (drag.az - dx / r.width * look.fov + 720) % 360;
    look.pitch = Math.max(-10, Math.min(25, drag.pitch - dy / r.width * look.fov));
    quick = true; render();
  });
  const end = e => {
    if (!drag) return;
    if (!drag.moved && viewMap) { const r = cv.getBoundingClientRect(); look.az = viewMap.fromScreen(e.clientX - r.left, e.clientY - r.top).bearing; }
    drag = null; quick = false; render();
  };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  $("atWider").addEventListener("click", () => { look.fov = Math.min(100, look.fov * 1.5); render(); });
  $("atCloser").addEventListener("click", () => { look.fov = Math.max(6, look.fov / 1.5); render(); });
}
function bindMap() {
  const cv = $("atMapCv");
  let drag = null;
  cv.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, cx: map?.cx, cy: map?.cy, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => {
    if (!drag || !map) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    if (drag.moved) { map.cx = drag.cx - dx / map.frame.kx; map.cy = drag.cy - dy / map.k; render(); }
  });
  const end = e => {
    if (!drag) return;
    if (!drag.moved && map?.frame && play && !play.done) { const r = cv.getBoundingClientRect(), p = map.frame.fromScreen(e.clientX - r.left, e.clientY - r.top); play = mark(play, p.lat, p.lon); save(); }
    drag = null;
  };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  $("atMapIn").addEventListener("click", () => { if (map) { map.k *= 1.6; render(); } });
  $("atMapOut").addEventListener("click", () => { if (map) { map.k /= 1.6; render(); } });
}

// ---------- the menu's part ----------
/** The Atlas's lines in the menu's content part: the region and area to play, how much of each you know, the master test. */
export async function menuInto(content, close) {
  const best = read(KEY.campaign, {}), regions = await openRegions(), all = await builtRegions();
  // the land chapters' lessons, here as in the campaign's list: the way in before the Alps are open, and back to them after
  const L = play?.lesson && lessonById(play.lesson), ch = L?.chapter || (regions.length ? 0 : nextLesson().chapter);
  if (ch) {
    content.append(choice("Chapter", [7, 8].map(n => [String(n), `${n} ${CHAPTERS[n - 1].name}`]), String(ch), v => { close(); startLesson(LESSONS.find(x => x.chapter === Number(v)).id); }));
    content.append(choice("Lesson", LESSONS.filter(x => x.chapter === ch).map((x, i) => [x.id, `${i + 1} ${x.name}${best[x.id] ? ` ${"★".repeat(best[x.id])}` : ""}`]), L?.id || "", v => { close(); startLesson(v); }));
  }
  if (!all.length) { content.append(line("The Atlas's terrain is still being prepared.")); return; }
  if (!regions.length) { content.append(line("The Alps open here once chapter 7, Peaks and bearings, is done.")); return; }
  const w = where(), R = regions.find(r => r.id === w.region) || regions[0], K = know();
  const areaOf = a => K.areas?.[`${R.id}/${a.id}`];
  content.append(choice("Region", regions.map(r => [r.id, r.name]), R.id, v => { write(KEY.where, { region: v, area: "" }); close(true); }));
  content.append(choice("Area", [["", "Anywhere"], ...R.areas.map(a => { const st = areaOf(a); return [a.id, `${a.name}${st?.mastered ? " ✓" : st ? ` ${st.known}/${st.of}` : ""}`]; })], w.area || "",
    v => { write(KEY.where, { region: R.id, area: v }); close(); startPlay({ fresh: true }); }));
  const mastered = R.areas.filter(a => areaOf(a)?.mastered).length, t = K.tests[R.id] || {};
  content.append(line(t.passed ? `${R.name}: mastered.` : `${R.name}: ${mastered} of ${R.areas.length} areas mastered (every summit named right from each side it is seen from, and ${FIXES} fixes of two stars).`));
  if (mastered === R.areas.length && !t.passed) content.append(action(`Master test${t.streak ? ` (${t.streak} of ${TEST})` : ""}`, () => { close(); startTest(R.id); }));
  const shut = all.filter(r => !regions.includes(r));
  if (shut.length) content.append(line(`Still to open: ${shut.map(r => `${r.name} (chapter ${r.opens})`).join(", ")}.`));
}
export const credit = async () => (await builtRegions())[0]?.credit || "";
/** A new start of the same kind: the lesson again, another fix of the test, or free play. */
export const newStart = () => (play?.lesson ? startLesson(play.lesson) : play?.test ? startTest(play.test) : startPlay({ fresh: true }));

let bound = false;
/** Shows the Atlas (landfall.js has hidden the voyage), on `next` (a lesson's id, or "today") if given, else where it was. */
export function show(next = "") {
  $("atlas").hidden = false;
  if (!bound) {
    bound = true; bindView(); bindMap();
    new ResizeObserver(() => render()).observe($("atlas"));
    $("atPickClose").addEventListener("click", () => $("atPick").close());
  }
  if (next === "today") startDaily();
  else if (next) startLesson(next);
  else if (!pack) startPlay(); else render();
}
export function hide() { $("atlas").hidden = true; }
