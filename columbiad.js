// Columbiad: a cannon on the Earth, a ring in the sky, one gesture. Pull back anywhere on the scene like a slingshot: the shell
// goes the way opposite the pull and the powder is how long the pull is, a tick under the thumb for each barrel. The cone shows
// where the scatter lets a shot fall; the arrows beside Fire fine-tune; Fire sends it, a tap on the scene while it flies skips to the end
// and a held press runs it fast. A miss costs nothing: the gun is aimed as it was and the shot is a faint trail on the scene.
// The rules are columbiad-engine.js's (it plays the whole shot at once and hands over its path); columbiad-view.js plays the path
// back, columbiad-aim.js is the pull's arithmetic, columbiad-levels.js the levels. This file keeps the game and the page.
// The levels come in sections (columbiad-levels.js): the proving ground (Earth alone, all open) and then the Moon's, each opening in
// order. Where the Moon moves the world has a clock, and a shot is fired at the time it is: the cone is the aim for this very moment.
import { LEVELS, SECTIONS } from "./columbiad-levels.js";
import { newGame, apply, stars as starsOf, cone as coneOf, clampAim, sound as validState, direction, worldOf, ringAt, BARRELS } from "./columbiad-engine.js";
import { PULL_REM, DEAD_REM, begin as pullBegin, move as pullMove, nudge, crossed } from "./columbiad-aim.js";
import { createView } from "./columbiad-view.js";
import { sound } from "./columbiad-sound.js";
import { bindSwitcher } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, onPause, isPaused } from "./menu.js";
import { IN_FRAME } from "./suite.js";

const $ = id => document.getElementById(id);
// CAMP: { at (the level being played, 0 on), stars (the most won in each), bull (whether the ring's inner third was struck) }.
// RUN: the game of the level being played with its trails, so a watcher (and a reload) draws the same scene. AIMS: the last aim of each level.
// BEST: the stars won in all, the number the games screen shows. SEEN: set by the first shot, the hint is told once.
const CAMP = "columbiad:camp", RUN = "columbiad:run", AIMS = "columbiad:aims", BEST = "columbiad:best", SOUND = "columbiad:sound", SEEN = "columbiad:seen";
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
let lvl = LEVELS[camp.at];
let S = null;                 // the game of the level: the engine's state, as saved
let aim = { angle: 90, charge: 0 };
let ghosts = [];              // the last four shots' trails: { pts (x, y pairs), hit }
let liveOn = false;           // the newest shot's bright trail is still on the scene (it is its own ghost until the gun is touched)
let phase = "aim";            // "aim", "fly" (a shot being shown), "done" (the ring struck: how it went, and on)
let touch = null;             // the finger on the scene: { id, kind ("aim" or "press"), x, y, drag, timer, ff }
let coneDirty = true, coneAt = 0;
let saveTimer = 0, sayTimer = 0;
/** The moment a shot fired now is fired at, in hundredths of a second (so it is the same number wherever it is replayed). */
const stamp = () => Math.round(view.clock * 100) / 100;
const moving = () => worldOf(lvl).moving;

// ---------- keeping ----------
/** A level is open when it begins its section or the one before it in the section has been struck; the proving ground is all open (a place to try the gun). */
function isOpen(n) {
  const L = LEVELS[n], sec = SECTIONS.find(x => x.levels.includes(L)), k = sec.levels.indexOf(L);
  return sec.open === "all" || k === 0 || camp.stars[n - 1] > 0 || camp.stars[n] > 0;
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
function keepRun() { write(RUN, { id: lvl.id, s: { ...S, aim: { ...aim }, clock: stamp() }, ghosts }); }
function keepAim() {
  clearTimeout(saveTimer); saveTimer = 0;
  write(AIMS, { ...read(AIMS, {}), [lvl.id]: aim });
  S.aim = { ...aim };
  keepRun();
}
/** While a thumb moves the gun, the keeping follows a moment behind, so a partner's frame sees it travel. */
function keepSoon() { if (!saveTimer && !IN_FRAME) saveTimer = setTimeout(keepAim, 400); }

// ---------- the level's game ----------
const defaultAim = () => clampAim(lvl, { angle: (lvl.site ?? 90) - 30, charge: (lvl.barrels ?? BARRELS) * 0.65 });
function fresh() {
  const kept = read(AIMS, {})[lvl.id];
  aim = clampAim(lvl, kept && Number.isFinite(kept.angle) && Number.isFinite(kept.charge) ? kept : defaultAim());
  S = newGame(lvl, Math.floor(Math.random() * 2 ** 32), aim);
  ghosts = []; liveOn = false;
  keepRun();
}
function loadRun() {
  const r = read(RUN, null);
  if (r && r.id === lvl.id && validState(r.s) && Number.isFinite(r.s.aim.angle) && Number.isFinite(r.s.aim.charge)) {
    S = r.s;
    ghosts = Array.isArray(r.ghosts) ? r.ghosts.filter(goodTrail).slice(-4) : [];
    aim = clampAim(lvl, S.aim);
    liveOn = false;
    view.setClock(Number.isFinite(S.clock) ? S.clock : 0);
  } else fresh();
  phase = S.status === "won" ? "done" : "aim";
}
function setupLevel() {
  lvl = LEVELS[camp.at];
  view.setLevel(lvl);
  buildGauge();
  loadRun();
  view.setGhosts(ghosts);
  view.setWon(S.status === "won");
  coneDirty = true;
  render();
  view.setAim(aim);
  view.wake();
  keepCamp();
}
function playLevel(n) {
  camp.at = n;
  setupLevel();
}
function restart() {
  fresh();
  phase = "aim";
  view.setLevel(lvl);
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
  $("elev").textContent = `${(90 - Math.abs(off)).toFixed(1)}°`;
  $("lean").textContent = off > 0.04 ? "◀" : off < -0.04 ? "▶" : "";
  $("pow").textContent = aim.charge.toFixed(1);
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
  const won = S.status === "won", k = won ? S.shots : S.shots + 1, earn = starsOf(lvl, { status: "won", shots: k });
  $("lvId").textContent = lvl.id;
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
  for (const id of ["fire", "angL", "angR", "powD", "powU"]) $(id).disabled = busy;
  if (done) {
    const i = camp.at, last = i + 1 >= LEVELS.length;
    $("verdict").innerHTML = `<span class="cb-big">${WON[lvl.goal?.type || "hit"]}</span><span class="cb-stars-big">${starsWords(earn)}</span><small>${plural(S.shots, "shot")}${S.bull ? " · bullseye" : ""}${last ? " · the last level so far" : ""}</small>`;
    $("nextBtn").hidden = last;
  }
  if (typeof measure === "function") measure();
  const seen = read(SEEN, false);
  $("hint").hidden = !!seen || IN_FRAME || phase !== "aim";
  if (!$("hint").hidden) $("hint").textContent = "Pull back like a slingshot: the shell flies the other way, and a longer pull loads more powder. Press Fire; the arrows fine-tune.";
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
    // where the world moves, the preview is the aim for this moment: it is made again ten times a second (a coarse step keeps that cheap)
    if (!coneDirty && moving() && phase === "aim" && !view.flying && performance.now() - coneAt > 100) coneDirty = true;
    if (!coneDirty) return;
    coneDirty = false;
    coneAt = performance.now();
    view.setCone(aim.charge >= 0.05 ? coneOf(lvl, aim, stamp()) : null);
  },
  onHit() { sound.play("chime"); },
  onImpact() { sound.hushStop(); sound.play("thud"); },
  onEnd(res) {
    sound.hushStop();
    view.setGhosts(liveOn ? ghosts.slice(0, -1) : ghosts);
    if (S.status === "won") { phase = "done"; render(); return; }
    phase = "aim";
    say(missWords(res), 3600);
    render();
  },
});

const unit = n => n.toFixed(n < 10 ? 1 : 0);
/** What the level asks, in a line. */
function goalWords(L) {
  const g = L.goal || { type: "hit" };
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
  const fell = res.end === "impact" ? `Struck the ${res.body === "earth" ? "Earth" : res.body}. ` : res.end === "lost" ? "Lost to space. " : res.end === "time" ? "Out of time. " : "";
  if (g.type === "orbit") return `${fell}Swept ${Math.round(Math.abs(res.sweep) * 57.2958)}° of ${g.sweep}°`;
  const T = gated ? list[Math.min(res.gates, list.length - 1)] : lvl.target;
  if (res.hit && !res.hit.ok) {
    const lim = gated ? T : g.type === "soft" ? { soft: g.speed } : { fast: g.speed };
    return lim.soft !== undefined ? `In the ring at ${unit(res.hit.speed)}: too fast (${unit(lim.soft)} at most)` : `In the ring at ${unit(res.hit.speed)}: too slow (${unit(lim.fast)} at least)`;
  }
  const by = Math.max(0, res.near - T.r).toFixed(1);
  if (gated && list.length > 1) return `${fell}${res.gates ? `Through ${res.gates} of ${list.length - 1} gates, ` : ""}${res.gates === list.length - 1 ? "ring" : `gate ${res.gates + 1}`} missed by ${by}`;
  return `${fell}Missed by ${by}`;
}

/** The bright trail and the words of the last shot go as soon as the gun is touched; its faint ghost stays. */
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

function fire() {
  if (phase !== "aim" || IN_FRAME || isPaused()) return;
  if (aim.charge < 0.1) { say("Pull back to load powder"); return; }
  sound.unlock();
  touched();
  const { state, res } = apply(lvl, S, { angle: aim.angle, charge: aim.charge, t: stamp() });
  const prior = ghosts;
  S = state;
  ghosts = [...ghosts, trailOf(res)].slice(-4);
  liveOn = true;
  phase = "fly";
  if (S.status === "won") {
    const i = camp.at, n = starsOf(lvl, S);
    if (n > camp.stars[i]) camp.stars[i] = n;
    if (S.bull) camp.bull[i] = true;
    keepCamp();                                          // the result is final now, not when its words appear
  }
  write(SEEN, true);
  write(AIMS, { ...read(AIMS, {}), [lvl.id]: aim });
  keepRun();
  view.setGhosts(prior);
  const wall = view.fire(res);
  sound.play("boom");
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
  const before = aim.charge, r = pullMove(lvl, touch.drag, dx, dy, full(), DEAD_REM * rootPx());
  aim = r.aim;
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

// ---------- the nudges, Fire, the keys ----------
function nudgeBy(da, dc, k = 1) {
  if (phase !== "aim" || IN_FRAME || isPaused()) return;
  touched();
  const was = aim.charge;
  aim = nudge(lvl, aim, da, dc, k);
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
    case " ": case "Enter": if (e.target.closest?.("button")) return; fire(); break;
    default: return;
  }
  e.preventDefault();
});
$("againBtn").addEventListener("click", restart);
$("nextBtn").addEventListener("click", () => { if (camp.at + 1 < LEVELS.length) playLevel(camp.at + 1); });

// ---------- the menu ----------
/** A level's place in miniature: the Earth, the gun on it and the ring. */
function mapSvg(L) {
  const w = worldOf(L), rings = L.gates || [L.target], f = n => n.toFixed(3);
  // what the picture must hold: the Earth, each moon (all of its rail), each ring (all of its rail)
  let x0 = -1.1, x1 = 1.1, y0 = -1.1, y1 = 1.1;
  const grow = (x, y, r = 0) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
  for (const b of w.bodies) if (b.id !== "earth") { if (b.rail) grow(b.cx, b.cy, Math.abs(b.a) + 1); else grow(b.x, b.y, b.r + 0.5); }
  for (const T of rings) { if (T.rail) grow(T.rail.about?.[0] ?? 0, T.rail.about?.[1] ?? 0, Math.abs(T.rail.a) + T.r); else if (T.body != null) { const p = ringAt(L, T, 0); grow(p[0], p[1], T.r + 0.5); } else grow(T.at[0], T.at[1], T.r + 0.1); }
  const s = Math.max(x1 - x0, y1 - y0) * 1.06, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, mark = s * 0.012;
  const [gx, gy] = direction(L.site ?? 90);
  let g = `<circle class="cb-map-earth" cx="0" cy="0" r="${f(Math.max(1, s * 0.02))}"/>`;
  w.bodies.forEach((b, i) => {
    if (b.id === "earth") return;
    if (b.rail) g += `<circle class="cb-map-rail" cx="${f(b.cx)}" cy="${f(-b.cy)}" r="${f(Math.abs(b.a))}"/>`;
    const p = ringAt(L, { body: b.id, r: 0 }, 0);
    g += `<circle class="cb-map-moon" cx="${f(p[0])}" cy="${f(-p[1])}" r="${f(Math.max(b.r, s * 0.018))}"/>`;
  });
  rings.forEach((T, k) => {
    if (T.rail) g += `<circle class="cb-map-rail" cx="${f(T.rail.about?.[0] ?? 0)}" cy="${f(-(T.rail.about?.[1] ?? 0))}" r="${f(Math.abs(T.rail.a))}"/>`;
    const p = ringAt(L, T, 0), last = k === rings.length - 1;
    g += `<circle class="${last ? "cb-map-ring" : "cb-map-gate"}" cx="${f(p[0])}" cy="${f(-p[1])}" r="${f(Math.max(T.r, s * 0.03))}"/>`;
    if (rings.length > 1) g += `<text class="cb-map-num" font-size="${f(s * 0.06)}" x="${f(p[0])}" y="${f(-p[1] + s * 0.02)}">${k + 1}</text>`;
  });
  g += `<circle class="cb-map-gun" cx="${f(gx * 1.03)}" cy="${f(-gy * 1.03)}" r="${f(s * 0.035)}"/>`;
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
    b.addEventListener("click", () => { $("menuDlg").close(); if (n !== camp.at) playLevel(n); });
    list.append(b);
  }
  return list;
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action(`Replay ${lvl.name}`, restart, "primary"));
  const content = part(body, "content");
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
  setAim(a) { touched(); aim = clampAim(lvl, a); changed(); keepAim(); },
  fire, playLevel, restart, view, full,
  /** Where a point of the world lies on the page. */
  pointOf(x, y) { const r = scene.getBoundingClientRect(), [px, py] = view.screenOf(x, y); return [r.left + px, r.top + py]; },
};

measure();
setupLevel();
settleAway();
