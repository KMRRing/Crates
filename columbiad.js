// Columbiad: a launch from the Earth, a ring behind the Moon, one gesture. Pull back anywhere on the scene like a slingshot: the shot
// goes the way opposite the pull and the power is how long the pull is, a tick under the thumb for each unit. The preview shows
// where the scatter lets a shot fall, for a limited length; the arrows beside Launch fine-tune; Launch sends it, a tap on the scene while it flies skips to the end
// and a held press runs it fast. A miss costs nothing: the aim stays as it was and the shot is a faint trail on the scene.
// The rules are columbiad-engine.js's (it plays the whole shot at once and hands over its path); columbiad-view.js plays the path
// back, columbiad-aim.js is the pull's arithmetic, columbiad-levels.js the levels. This file keeps the game and the page.
// The levels come in sections (columbiad-levels.js), each opening in order; the ring is behind the Moon, so the way is round it. Where a
// world moves (parked: MOVERS_ON in the engine) it has a clock, and a shot is launched at the time it is.
import { LEVELS, SECTIONS, dailyLevel } from "./columbiad-levels.js";
import { newGame, apply, stars as starsOf, cone as coneOf, clampAim, sound as validState, direction, worldOf, ringAt, bodyAt, padAt, isMoving, DELAY_MAX, BARRELS } from "./columbiad-engine.js";
import { PULL_REM, DEAD_REM, begin as pullBegin, move as pullMove, nudge, crossed } from "./columbiad-aim.js";
import { createView } from "./columbiad-view.js";
import { sound } from "./columbiad-sound.js";
import { bindSwitcher } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, onPause, isPaused, todayPart } from "./menu.js";
import { IN_FRAME, today } from "./suite.js";
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
// CAMP: { at (the level being played, 0 on), stars (the most won in each), bull (whether the ring's inner third was struck) }.
// RUN: the game of the level being played with its trails, so a watcher (and a reload) draws the same scene. AIMS: the last aim of each level.
// BEST: the stars won in all, the number the games screen shows. SEEN: set by the first shot, the hint is told once.
// DAILY: the stars won on each day's level, by the day (YYYYMMDD); DRUN is the daily's own run, so the camp's is left as it was.
// The keys with a 3 are the world of 4 November 2026 (a big Earth and Moon, rings behind the Moon): the levels were all made again, so what the old
// keys hold (levels with other rings and other dials) is not read and is left where it is.
const CAMP = "columbiad:camp3", RUN = "columbiad:run3", AIMS = "columbiad:aims3", BEST = "columbiad:best", SOUND = "columbiad:sound", SEEN = "columbiad:seen", DAILY = "columbiad:daily", DRUN = "columbiad:drun3";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const noted = new Set();       // the levels whose note has been said this visit
const STAR = "★", HOLLOW = "☆";
const starsWords = n => STAR.repeat(n) + HOLLOW.repeat(3 - n);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const full = () => PULL_REM * rootPx();

sound.on = read(SOUND, true);

let camp = readCamp();
let daily = 0;                // the day (YYYYMMDD) when today's level is being played, else 0: the camp's level
const levelNow = () => (daily ? dailyLevel(daily) : LEVELS[camp.at]);
let lvl = levelNow();
let S = null;                 // the game of the level: the engine's state, as saved
let aim = { angle: 90, charge: 0 };
let ghosts = [];              // the last four shots' trails: { pts (x, y pairs), hit }
let liveOn = false;           // the newest shot's bright trail is still on the scene (it is its own ghost until the aim is touched)
let phase = "aim";            // "aim", "fly" (a shot being shown), "done" (the ring struck: how it went, and on)
let touch = null;             // the finger on the scene: { id, kind ("aim" or "press"), x, y, drag, timer, ff }
let coneDirty = true;
let saveTimer = 0, sayTimer = 0;
/** The moment a shot is fired at: the countdown the player set (every shot starts from world time 0). */
const stamp = () => (moving() ? aim.t || 0 : 0);
const moving = () => isMoving(lvl);
let fine = false;             // the fine mode: a drag moves the aim an eighth as far and a nudge is a tenth as big

// ---------- keeping ----------
/** A level is open when it begins its section or the one before it in the section has been struck; the first of a section is always open. */
function isOpen(n) {
  const L = LEVELS[n], sec = SECTIONS.find(x => x.levels.includes(L)), k = sec.levels.indexOf(L);
  return k === 0 || camp.stars[n - 1] > 0 || camp.stars[n] > 0;
}
function readCamp() {
  const c = read(CAMP, null);
  const stars = LEVELS.map((_, k) => (Number.isInteger(c?.stars?.[k]) ? Math.max(0, Math.min(3, c.stars[k])) : 0));
  const bull = LEVELS.map((_, k) => !!c?.bull?.[k]);
  return { at: Number.isInteger(c?.at) && c.at >= 0 && c.at < LEVELS.length ? c.at : 0, stars, bull };
}
function keepCamp() {
  write(CAMP, camp);
  write(BEST, camp.stars.reduce((a, b) => a + b, 0));
}
const goodTrail = g => g && Array.isArray(g.pts) && g.pts.length >= 4 && g.pts.length <= 200 && g.pts.length % 2 === 0 && g.pts.every(Number.isFinite);
function keepRun() { write(daily ? DRUN : RUN, { id: lvl.id, day: daily, s: { ...S, aim: { ...aim }, clock: stamp() }, ghosts }); }
function keepAim() {
  clearTimeout(saveTimer); saveTimer = 0;
  if (!daily) write(AIMS, { ...read(AIMS, {}), [lvl.id]: aim });
  S.aim = { ...aim };
  keepRun();
}
/** While a thumb moves the aim, the keeping follows a moment behind, so a partner's frame sees it travel. */
function keepSoon() { if (!saveTimer && !IN_FRAME) saveTimer = setTimeout(keepAim, 400); }

// ---------- the level's game ----------
const defaultAim = () => clampAim(lvl, { t: moving() ? 0 : undefined, ...(lvl.aim || { angle: (lvl.site ?? 90) - 20, charge: (lvl.barrels ?? BARRELS) * 0.6 }) });
function fresh() {
  const kept = daily ? null : read(AIMS, {})[lvl.id];
  aim = clampAim(lvl, kept && Number.isFinite(kept.angle) && Number.isFinite(kept.charge) ? { ...kept, t: moving() ? kept.t ?? 0 : undefined } : defaultAim());
  S = newGame(lvl, daily || Math.floor(Math.random() * 2 ** 32), aim);          // the day's scatter is the day's, the same for everyone
  ghosts = []; liveOn = false;
  keepRun();
}
function loadRun() {
  const r = read(daily ? DRUN : RUN, null);
  if (r && r.id === lvl.id && (r.day || 0) === daily && validState(r.s) && Number.isFinite(r.s.aim.angle) && Number.isFinite(r.s.aim.charge)) {
    S = r.s;
    ghosts = Array.isArray(r.ghosts) ? r.ghosts.filter(goodTrail).slice(-4) : [];
    aim = clampAim(lvl, { ...S.aim, t: moving() ? S.aim.t ?? 0 : undefined });
    liveOn = false;
  } else fresh();
  phase = S.status === "won" ? "done" : "aim";
  stopWind();
}
function setupLevel() {
  lvl = levelNow();
  view.setLevel(lvl);
  buildGauge();
  loadRun();
  view.setClock(stamp());
  view.setGhosts(ghosts);
  view.setWon(S.status === "won");
  coneDirty = true;
  render();
  view.setAim(aim);
  view.wake();
  keepCamp();
}
function playLevel(n) {
  daily = 0;
  camp.at = n;
  setupLevel();
}
function restart() {
  fresh();
  phase = "aim";
  stopWind();
  view.setLevel(lvl);
  view.setClock(stamp());
  view.setGhosts([]);
  view.setWon(false);
  coneDirty = true;
  render();
  view.setAim(aim);
  view.wake();
}

// ---------- the page ----------
const cells = [];
function buildGauge() {
  const n = Math.ceil(lvl.barrels ?? BARRELS);
  cells.length = 0;
  for (let i = 0; i < n; i++) cells.push(document.createElement("i"));
  $("gauge").replaceChildren(...cells);
  $("gauge").setAttribute("aria-valuemax", String(n));
  $("cap").textContent = `of ${lvl.barrels ?? BARRELS}`;
}
function renderAim() {
  const off = aim.angle - (lvl.site ?? 90);
  $("lean").textContent = off > 0.04 ? "◀" : off < -0.04 ? "▶" : "";
  $("pow").textContent = aim.charge.toFixed(fine ? 2 : 1);
  $("elev").textContent = `${(90 - Math.abs(off)).toFixed(fine ? 2 : 1)}°`;
  $("timeRow").hidden = !moving();
  if (moving()) { $("tval").textContent = `T+${(aim.t || 0).toFixed(1)} s`; $("tRange").value = String(aim.t || 0); $("tRange").max = String(lvl.delayMax ?? DELAY_MAX); }
  const lastShot = S.log[S.log.length - 1];
  $("last").textContent = lastShot ? `Last ${(90 - Math.abs(lastShot.a - (lvl.site ?? 90))).toFixed(1)}° · ${lastShot.c.toFixed(1)}${moving() ? ` · T+${(lastShot.t || 0).toFixed(1)}` : ""}` : "";
  cells.forEach((c, i) => c.style.setProperty("--f", Math.max(0, Math.min(1, aim.charge - i)).toFixed(3)));
  $("gauge").setAttribute("aria-valuenow", aim.charge.toFixed(1));
}
function flashCell(from, to) {
  const hi = Math.max(Math.floor(from + 1e-9), Math.floor(to + 1e-9)) - 1, c = cells[Math.max(0, Math.min(cells.length - 1, hi))];
  if (!c) return;
  c.classList.remove("tick");
  void c.offsetWidth;                                   // so a tick on the same cell again restarts its flash
  c.classList.add("tick");
}
function render() {
  const won = S.status === "won", k = won ? S.shots : S.shots + 1, earn = starsOf(lvl, { status: "won", shots: k, log: [{ c: aim.charge }] });   // a gentle level counts the power of the shot, so the shot now aimed
  $("lvId").textContent = daily ? `Daily ${lvl.id}` : lvl.id;
  $("lvName").textContent = lvl.name;
  const gw = goalWords(lvl);
  $("goal").textContent = gw;
  $("goal").hidden = !gw;
  $("shot").textContent = k;
  $("stars").textContent = starsWords(earn);
  $("stars").classList.toggle("bull", won && S.bull);
  $("stars").setAttribute("aria-label", won ? `${plural(earn, "star")} won${S.bull ? ", bullseye" : ""}` : `A hit with this shot earns ${plural(earn, "star")}`);
  renderAim();
  const done = phase === "done", busy = phase !== "aim";
  $("deck").classList.toggle("away", done);
  $("result").hidden = !done;
  for (const id of ["fire", "angL", "angR", "powD", "powU", "tL", "tR", "tRange"]) $(id).disabled = busy;
  if (done) {
    const i = camp.at, last = i + 1 >= LEVELS.length;
    $("verdict").innerHTML = `<span class="cb-big">${WON[lvl.goal?.type || "hit"]}</span><span class="cb-stars-big">${starsWords(earn)}</span><small>${plural(S.shots, "shot")}${S.bull ? " · bullseye" : ""}${last && !daily ? " · the last level so far" : ""}</small>`;
    $("nextBtn").hidden = !daily && last;
    $("nextBtn").textContent = daily ? "Share" : "Next level";
  }
  if (typeof measure === "function") measure();
  const seen = read(SEEN, false);
  $("hint").hidden = !!seen || IN_FRAME || phase !== "aim";
  if (!$("hint").hidden) $("hint").textContent = "Pull back like a slingshot: the shot flies the other way, and a longer pull is more power. Press Launch; the arrows fine-tune.";
  else if (phase === "aim" && S.shots === 0 && lvl.note && !noted.has(lvl.id)) { noted.add(lvl.id); say(lvl.note, 5200); }
}
function say(words, ms = 2400) {
  const n = $("say");
  n.textContent = words;
  n.classList.add("show");
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => n.classList.remove("show"), ms);
}
const unsay = () => { clearTimeout(sayTimer); $("say").classList.remove("show"); };

// ---------- the scene ----------
const view = createView($("scene"), {
  before() {
    if (!coneDirty) return;
    coneDirty = false;
    view.setCone(aim.charge >= 0.05 ? coneOf(lvl, aim, stamp()) : null);
  },
  onHit() { sound.play("chime"); },
  onEnter(en) {                                          // a gate passed, or a ring entered that does not count (and why, while it is still on the screen)
    sound.play(en.ok ? "ping" : "dull");
    if (!en.ok) say(missWords({ hit: en, gates: en.gate, near: 0, end: "through" }), 2600);
  },
  onImpact() { sound.hushStop(); sound.play("thud"); },
  onEnd(res) {
    sound.hushStop();
    view.setGhosts(liveOn ? ghosts.slice(0, -1) : ghosts);
    if (S.status === "won") { phase = "done"; render(); roundOver("columbiad"); return; }
    phase = "aim";
    say(missWords(res), 3600);
    keepRun();
    render();
  },
});

const unit = n => n.toFixed(n < 10 ? 1 : 0);
/** What the level asks, in a line. */
function goalWords(L) {
  const g = L.goal || { type: "hit" }, base = goalBase(L, g);
  return L.thrift ? `${base ? `${base} · ` : ""}Least power earns the stars` : base;
}
function goalBase(L, g) {
  switch (g.type) {
    case "soft": return `Arrive at ${unit(g.speed)} or slower`;
    case "fast": return `Arrive at ${unit(g.speed)} or faster`;
    case "gates": return `Pass ${L.gates.length} gates in order`;
    case "return": return `Round the ${g.via || "Moon"} and home`;
    case "orbit": return `Sweep ${g.sweep}° round the ${g.body}`;
    default: return "";
  }
}
const WON = { hit: "Hit", soft: "Soft arrival", fast: "Fast pass", gates: "Through the gates", return: "Home again", orbit: "In orbit" };
/** How a shot that did not win went, for the line over the picture. */
function missWords(res) {
  const g = lvl.goal || { type: "hit" }, list = lvl.gates || [lvl.target], gated = !!lvl.gates && (g.type === "gates" || g.type === "return");
  const fell = res.end === "burned" ? `Lost to ${res.body}. ` : res.end === "impact" ? `Struck the ${res.body === "earth" ? "Earth" : res.body}. ` : res.end === "lost" ? "Lost to space. " : res.end === "time" ? "Out of time. " : "";
  if (g.type === "orbit") return `${fell}Swept ${Math.round(Math.abs(res.sweep) * 57.2958)}° of ${g.sweep}°`;
  const T = gated ? list[Math.min(res.gates, list.length - 1)] : lvl.target;
  if (res.hit && !res.hit.ok) {
    const lim = gated ? T : g.type === "soft" ? { soft: g.speed } : g.type === "fast" ? { fast: g.speed } : {};
    // the speed asked is checked before the window, as the engine does (a ring may ask for both)
    if (lim.soft !== undefined && res.hit.speed > lim.soft) return `In the ring at ${unit(res.hit.speed)}: too fast (${unit(lim.soft)} at most)`;
    if (lim.fast !== undefined && res.hit.speed < lim.fast) return `In the ring at ${unit(res.hit.speed)}: too slow (${unit(lim.fast)} at least)`;
    if (T.win) return res.hit.t < T.win[0] ? `In the ring at T+${res.hit.t.toFixed(1)} s: too early (open from T+${T.win[0].toFixed(1)})` : `In the ring at T+${res.hit.t.toFixed(1)} s: too late (shut at T+${T.win[1].toFixed(1)})`;
  }
  const by = Math.max(0, res.near - T.r).toFixed(1);
  if (gated && list.length > 1) return `${fell}${res.gates ? `Through ${res.gates} of ${list.length - 1} gates, ` : ""}${res.gates === list.length - 1 ? "ring" : `gate ${res.gates + 1}`} missed by ${by}`;
  return `${fell}Missed by ${by}`;
}

/** Today's level, from the menu or the games screen's tile. */
function playDaily() {
  daily = today();
  setupLevel();
}
/** What the day's result is worth, for the tile: the stars won, kept by the day. */
function noteDaily(n) {
  const days = read(DAILY, {});
  if (!(days[daily] >= n)) write(DAILY, { ...days, [daily]: n });
}
const dateWords = d => `${String(d % 100).padStart(2, "0")}/${String(Math.floor(d / 100) % 100).padStart(2, "0")}/${Math.floor(d / 10000)}`;
/** The result as a few words to paste: the day, the level, the stars and the shots. */
async function share() {
  const earn = starsOf(lvl, S);
  const text = `Columbiad · today's level, ${dateWords(daily)}\n${lvl.id} ${lvl.name} · ${starsWords(earn)} · ${plural(S.shots, "shot")}${S.bull ? " · bullseye" : ""}`;
  try { await navigator.clipboard.writeText(text); say("Result copied"); } catch { say("Couldn't copy the result"); }
}

/** The bright trail and the words of the last shot go as soon as the aim is touched; its faint ghost stays. */
function touched() {
  unsay();
  if (liveOn) { liveOn = false; view.clearLive(); view.setGhosts(ghosts); }
}
function changed() {
  coneDirty = true;
  renderAim();
  view.setAim({ ...aim });
  view.wake();
}
function trailOf(res) {
  const p = res.path, n = p.length / 3, keep = Math.min(n, 80), pts = [];
  for (let k = 0; k < keep; k++) {
    const i = Math.round(k * (n - 1) / (keep - 1 || 1));
    pts.push(Math.round(p[3 * i + 1] * 1000) / 1000, Math.round(p[3 * i + 2] * 1000) / 1000);
  }
  return { pts, hit: !!res.won };
}

// the audio engine is made at the first touch of the page, not at the first shot, so firing never waits for it
addEventListener("pointerdown", () => sound.unlock(), { once: true, capture: true });
const CHARGE_MS = 650;                                   // the wind-up: a rising whine, the glow at the pad filling; the shot is worked out and the flight prepared meanwhile
let winding = 0;
/** A wind-up cut short (another level, a restart): the shot it was holding is dropped. */
function stopWind() { clearTimeout(winding); view?.uncharge?.(); }
function fire() {
  if (phase !== "aim" || IN_FRAME || isPaused()) return;
  if (aim.charge < 0.1) { say("Pull back to add power"); return; }
  sound.unlock();
  touched();
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches, ms = calm ? 220 : CHARGE_MS;
  const shot = apply(lvl, S, { angle: aim.angle, charge: aim.charge, t: stamp() });     // all of it, ahead: the engine, the preview of the path, the flight's arrays
  phase = "charge";
  render();
  view.charge(ms, shot.res);
  sound.play("charge", { dur: ms / 1000 });
  clearTimeout(winding);
  winding = setTimeout(() => launch(shot), ms);
}
function launch({ state, res }) {
  if (phase !== "charge") return;
  const prior = ghosts;
  S = state;
  ghosts = [...ghosts, trailOf(res)].slice(-4);
  liveOn = true;
  phase = "fly";
  if (S.status === "won") {
    const i = camp.at, n = starsOf(lvl, S);
    if (daily) noteDaily(n);
    else {
      if (n > camp.stars[i]) camp.stars[i] = n;
      if (S.bull) camp.bull[i] = true;
      keepCamp();
    }                                                    // the result is final now, not when its words appear
  }
  write(SEEN, true);
  if (!daily) write(AIMS, { ...read(AIMS, {}), [lvl.id]: aim });
  keepRun();
  view.setGhosts(prior);
  const wall = view.fire(res);
  sound.play("launch");
  sound.hush(wall);
  render();
}

// ---------- a finger on the scene ----------
const scene = $("scene");
const sceneAt = e => { const r = scene.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
function ropeNow(e) {
  const [fx, fy] = sceneAt(e), p = touch.drag.p;
  view.setRope({ cx: fx - p[0], cy: fy - p[1], fx, fy, len: Math.hypot(p[0], p[1]), full: full(), cap: lvl.barrels ?? BARRELS, charge: aim.charge });
}
scene.addEventListener("pointerdown", e => {
  if (IN_FRAME || touch || isPaused() || (e.pointerType === "mouse" && e.button > 0)) return;
  try { scene.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  if (phase === "fly") {
    const t = touch = { id: e.pointerId, kind: "press", ff: false, timer: 0 };
    t.timer = setTimeout(() => { t.ff = true; view.ff(true); }, 220);
    return;
  }
  if (phase !== "aim") return;
  touched();
  touch = { id: e.pointerId, kind: "aim", x: e.clientX, y: e.clientY, drag: pullBegin(lvl, aim, full()) };
  ropeNow(e);
});
scene.addEventListener("pointermove", e => {
  if (!touch || touch.id !== e.pointerId || touch.kind !== "aim") return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  touch.x = e.clientX; touch.y = e.clientY;
  const before = aim.charge, r = pullMove(lvl, touch.drag, dx, dy, full(), DEAD_REM * rootPx(), fine ? 0.125 : 1);
  aim = { ...r.aim, t: aim.t };
  if (r.ticks) { sound.play("tick", { n: Math.floor(aim.charge) }); flashCell(before, aim.charge); navigator.vibrate?.(6); }
  ropeNow(e);
  changed();
  keepSoon();
});
function lift(e, cancelled) {
  if (!touch || touch.id !== e.pointerId) return;
  const t = touch;
  touch = null;
  if (t.kind === "press") {
    clearTimeout(t.timer);
    view.ff(false);
    if (!t.ff && !cancelled) view.skip();                // a tap runs the shot to its end; a held press only ran it fast
  } else {
    view.setRope(null);
    keepAim();
  }
}
addEventListener("pointerup", e => { if (!IN_FRAME) sound.unlock(); lift(e, false); });        // an iPhone opens its sound at the end of a touch
addEventListener("pointercancel", e => lift(e, true));
$("stage").addEventListener("contextmenu", e => e.preventDefault());

// ---------- the nudges, Launch, the keys ----------
function nudgeBy(da, dc, k = 1) {
  if (phase !== "aim" || IN_FRAME || isPaused()) return;
  touched();
  const was = aim.charge;
  aim = nudge(lvl, aim, da, dc, fine ? k / 10 : k);
  if (dc) { if (crossed(was, aim.charge)) { sound.play("tick", { n: Math.floor(aim.charge) }); flashCell(was, aim.charge); } else sound.play("nudge"); }
  else sound.play("nudge");
  changed();
  keepSoon();
}
function bindNudge(id, da, dc) {
  const b = $(id);
  let rep = 0, n = 0;
  const stop = () => { clearTimeout(rep); clearInterval(rep); rep = 0; };
  b.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    stop(); n = 0;
    nudgeBy(da, dc);
    rep = setTimeout(() => { rep = setInterval(() => { n++; nudgeBy(da, dc, n < 8 ? 1 : n < 20 ? 3 : 8); }, 75); }, 380);
  });
  for (const t of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(t, stop);
  b.addEventListener("click", e => { if (e.detail === 0) nudgeBy(da, dc); });             // a click with no press before it is a key's
  b.addEventListener("contextmenu", e => e.preventDefault());
}
/** The launch countdown: a tenth of a second a tap, faster the longer it is held, and the slider for a swing. */
function timeBy(d, k = 1) {
  if (phase !== "aim" || IN_FRAME || isPaused() || !moving()) return;
  touched();
  aim = clampAim(lvl, { ...aim, t: (aim.t || 0) + d * 0.1 * k });
  sound.play("nudge");
  timeChanged();
}
function timeChanged() { view.setClock(stamp()); changed(); keepSoon(); }
function bindTime(id, d) {
  const b = $(id);
  let rep = 0, n = 0;
  const stop = () => { clearTimeout(rep); clearInterval(rep); rep = 0; };
  b.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    stop(); n = 0;
    timeBy(d);
    rep = setTimeout(() => { rep = setInterval(() => { n++; timeBy(d, n < 8 ? 1 : n < 20 ? 3 : 8); }, 75); }, 380);
  });
  for (const t of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(t, stop);
  b.addEventListener("click", e => { if (e.detail === 0) timeBy(d); });
  b.addEventListener("contextmenu", e => e.preventDefault());
}
bindTime("tL", -1);
bindTime("tR", +1);
$("tRange").addEventListener("input", e => {
  if (phase !== "aim" || IN_FRAME || isPaused()) return;
  touched();
  aim = clampAim(lvl, { ...aim, t: parseFloat(e.target.value) });
  timeChanged();
});
$("fine").addEventListener("click", () => { fine = !fine; $("fine").setAttribute("aria-pressed", String(fine)); renderAim(); });
bindNudge("angL", +1, 0);
bindNudge("angR", -1, 0);
bindNudge("powU", 0, +1);
bindNudge("powD", 0, -1);
$("fire").addEventListener("click", fire);
document.addEventListener("keydown", e => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || $("menuDlg").open || document.querySelector("dialog[open]")) return;
  const k = e.shiftKey ? 5 : 1;
  switch (e.key) {
    case "ArrowLeft": nudgeBy(+1, 0, k); break;
    case "ArrowRight": nudgeBy(-1, 0, k); break;
    case "ArrowUp": nudgeBy(0, +1, k); break;
    case "ArrowDown": nudgeBy(0, -1, k); break;
    case ",": timeBy(-1, k); break;
    case ".": timeBy(+1, k); break;
    case " ": case "Enter": if (e.target.closest?.("button")) return; fire(); break;
    default: return;
  }
  e.preventDefault();
});
$("againBtn").addEventListener("click", restart);
$("nextBtn").addEventListener("click", () => { if (daily) share(); else if (camp.at + 1 < LEVELS.length) playLevel(camp.at + 1); });

// ---------- the menu ----------
/** A level's place in miniature: the launch pad, the bodies, the hazards and the ring(s), at their true sizes (a body on a rail where it starts, with its orbit). */
function mapSvg(L) {
  const w = worldOf(L), rings = L.gates || [L.target], f = n => n.toFixed(3), [px, py] = padAt(L, 0);
  let x0 = px - 1.6, x1 = px + 1.6, y0 = py - 1.6, y1 = py + 1.6;
  const grow = (x, y, r = 0) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
  w.bodies.forEach((b, i) => { if (i !== w.fi) { const p = bodyAt(L, i, 0); grow(p[0], p[1], b.r + 0.3); } });
  for (const T of rings) { const p = ringAt(L, T, 0); grow(p[0], p[1], T.r + 0.2); }
  const s = Math.max(x1 - x0, y1 - y0) * 1.06, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let g = "";
  for (const z of L.hazards || []) {
    // where the view puts it: on a ring it follows (a guard), on a body, or at a place, then offset (by the level's own rule)
    let p = z.follow != null ? ringAt(L, z.follow < 0 ? L.target : L.gates[z.follow], 0) : z.body ? bodyAt(L, w.bodies.findIndex(b => b.id === z.body), 0) : z.at || [0, 0];
    if (z.off) { const a = z.out ? Math.atan2(p[1], p[0]) - Math.PI / 2 : 0, c = Math.cos(a), sn = Math.sin(a); p = [p[0] + z.off[0] * c - z.off[1] * sn, p[1] + z.off[0] * sn + z.off[1] * c]; }
    if (z.band) g += `<circle class="cb-map-band" cx="${f(p[0])}" cy="${f(-p[1])}" r="${f((z.band[0] + z.band[1]) / 2)}" stroke-width="${f(z.band[1] - z.band[0])}"/>`;
    else g += `<circle class="cb-map-haz" cx="${f(p[0])}" cy="${f(-p[1])}" r="${f(Math.max(z.r, s * 0.012))}"/>`;
  }
  w.bodies.forEach((b, i) => {
    const p = bodyAt(L, i, 0);
    if (b.rail) g += `<circle class="cb-map-rail" cx="${f(b.cx)}" cy="${f(-b.cy)}" r="${f(b.a)}"/>`;
    g += `<circle class="cb-map-body cb-map-${b.kind}" cx="${f(p[0])}" cy="${f(-p[1])}" r="${f(Math.max(b.r, s * 0.02))}"/>`;
  });
  rings.forEach((T, k) => {
    const p = ringAt(L, T, 0), last = k === rings.length - 1;
    if (T.rail) g += `<circle class="cb-map-rail" cx="${f(T.rail.about ? T.rail.about[0] : 0)}" cy="${f(-(T.rail.about ? T.rail.about[1] : 0))}" r="${f(T.rail.a)}"/>`;
    g += `<circle class="${last ? "cb-map-ring" : "cb-map-gate"}" cx="${f(p[0])}" cy="${f(-p[1])}" r="${f(Math.max(T.r, s * 0.03))}"/>`;
    if (rings.length > 1) g += `<text class="cb-map-num" font-size="${f(s * 0.06)}" x="${f(p[0])}" y="${f(-p[1] + s * 0.02)}">${k + 1}</text>`;
  });
  g += `<circle class="cb-map-pad" cx="${f(px)}" cy="${f(-py)}" r="${f(s * 0.035)}"/>`;
  return `<svg viewBox="${f(cx - s / 2)} ${f(-cy - s / 2)} ${f(s)} ${f(s)}" aria-hidden="true">${g}</svg>`;
}
function levelList(sec) {
  const list = document.createElement("div");
  list.className = "cb-levels";
  for (const L of sec.levels) {
    const n = LEVELS.indexOf(L), b = document.createElement("button"), won = camp.stars[n], open = isOpen(n);
    b.type = "button";
    b.disabled = !open;
    b.className = won ? "done" : "";
    if (n === camp.at) b.setAttribute("aria-current", "true");
    b.setAttribute("aria-label", `Level ${L.id}, ${L.name}${open ? "" : ", locked: strike the one before it"}${won ? `, ${plural(won, "star")}${camp.bull[n] ? ", bullseye" : ""}` : ""}`);
    b.innerHTML = `<div class="cb-lmap">${mapSvg(L)}</div><div class="cb-lrow"><b>${L.id}</b><span>${open ? `${starsWords(won)}${camp.bull[n] ? " ◎" : ""}` : "locked"}</span></div><div class="cb-lnamed"></div>`;
    b.querySelector(".cb-lnamed").textContent = L.name;
    b.addEventListener("click", () => { $("menuDlg").close(); if (n !== camp.at || daily) playLevel(n); });
    list.append(b);
  }
  return list;
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action(`Replay ${lvl.name}`, restart, "primary"));
  const content = part(body, "content");
  const due = dailyLevel(today()), got = read(DAILY, {})[today()];
  todayPart(body, {
    done: !!got, result: got ? `${due.id} ${due.name}, ${starsWords(got)}` : "", play: playDaily, playing: !!daily,
    back: daily ? { text: `Back to level ${LEVELS[camp.at].id}`, fn: () => playLevel(camp.at) } : null,
  });
  for (const sec of SECTIONS) {
    const head = document.createElement("p");
    head.className = "cb-sec";
    head.innerHTML = "<b></b><span></span>";
    head.firstChild.textContent = sec.name;
    head.lastChild.textContent = sec.idea;
    content.append(head, levelList(sec));
  }
  part(body, "settings").append(toggle("Sound", sound.on, on => { sound.on = on; write(SOUND, on); }));
  const total = camp.stars.reduce((a, b) => a + b, 0), beaten = camp.stars.filter(Boolean).length;
  part(body, "about").append(line(`${plural(beaten, "level")} of ${LEVELS.length} struck, ${plural(total, "star")} of ${LEVELS.length * 3}.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "columbiad");                // hidden by the full-screen frame: the menu's "Back to menu" clicks it
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());

// the pause rule: the scene, the sound and the shot in the air stand still while a menu is open or the page is away
function settleAway() {
  if (document.hidden || isPaused()) {
    if (touch) { clearTimeout(touch.timer); touch = null; view.ff(false); view.setRope(null); }      // a finger the page lost sight of is let go
    view.hold(); sound.suspend();
  }
  else { view.release(); sound.resume(); }
}
onPause(settleAway, settleAway);
document.addEventListener("visibilitychange", settleAway);
addEventListener("pagehide", () => { if (S && phase !== "fly") keepRun(); });           // a phone may drop the page at any moment it is out of sight
/** What the controls cover of the picture, told to the view so it fits the world into the rest (the picture itself runs under them). */
function measure() {
  const st = $("stage").getBoundingClientRect(), top = $("top").getBoundingClientRect(), bot = $("bottom").getBoundingClientRect(), gap = rootPx() * 0.5;
  const side = bot.width < st.width * 0.7;                // held sideways the controls stand down the right side
  const ins = { t: Math.max(0, top.bottom - st.top + gap), l: 0, r: side ? Math.max(0, st.right - bot.left + gap) : 0, b: side ? 0 : Math.max(0, st.bottom - bot.top + gap) };
  const root = document.documentElement.style;
  root.setProperty("--ins-b", `${Math.round(Math.max(0, st.bottom - bot.top))}px`);
  root.setProperty("--ins-r", `${side ? Math.round(st.right - bot.left) : 0}px`);
  view.setInsets({ t: Math.round(ins.t), l: 0, r: Math.round(ins.r), b: Math.round(ins.b) });
}
new ResizeObserver(() => { view.resize(); measure(); }).observe($("stage"));
addEventListener("resize", () => { view.resize(); measure(); });
addEventListener("pageshow", () => view.redraw());

// for tests and debugging
window.__columbiad = {
  get state() { return S; }, get aim() { return aim; }, get phase() { return phase; }, get lvl() { return lvl; }, get camp() { return camp; }, get ghosts() { return ghosts; },
  setAim(a) { touched(); aim = clampAim(lvl, { t: moving() ? 0 : undefined, ...a }); view.setClock(stamp()); changed(); keepAim(); },
  fire, playLevel, restart, view, full,
  /** Where a point of the world lies on the page. */
  pointOf(x, y) { const r = scene.getBoundingClientRect(), [px, py] = view.screenOf(x, y); return [r.left + px, r.top + py]; },
};

measure();
// (Korbi, 10 Nov 2026: the game opens on the campaign, the first level for a new player, not on the daily, whatever the tile was tapped for; the daily is in the menu)
setupLevel();
settleAway();
