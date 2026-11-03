// Columbiad: a cannon on the Earth, a ring in the sky, one gesture. Pull back anywhere on the scene like a slingshot: the shell
// goes the way opposite the pull and the powder is how long the pull is, a tick under the thumb for each barrel. The cone shows
// where the scatter lets a shot fall; the arrows beside Fire fine-tune; Fire sends it, a tap on the scene while it flies skips to the end
// and a held press runs it fast. A miss costs nothing: the gun is aimed as it was and the shot is a faint trail on the scene.
// The rules are columbiad-engine.js's (it plays the whole shot at once and hands over its path); columbiad-view.js plays the path
// back, columbiad-aim.js is the pull's arithmetic, columbiad-levels.js the levels. This file keeps the game and the page.
// Milestone 1 is the Earth alone: the proving ground, six levels, all open (it is a place to try the gun).
import { LEVELS } from "./columbiad-levels.js";
import { newGame, apply, stars as starsOf, cone as coneOf, clampAim, sound as validState, direction, BARRELS } from "./columbiad-engine.js";
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
let coneDirty = true;
let saveTimer = 0, sayTimer = 0;

// ---------- keeping ----------
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
function keepRun() { write(RUN, { id: lvl.id, s: { ...S, aim: { ...aim } }, ghosts }); }
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
    $("verdict").innerHTML = `<span class="cb-big">Hit</span><span class="cb-stars-big">${starsWords(earn)}</span><small>${plural(S.shots, "shot")}${S.bull ? " · bullseye" : ""}${last ? " · that is all six" : ""}</small>`;
    $("nextBtn").hidden = last;
  }
  if (typeof measure === "function") measure();
  const seen = read(SEEN, false);
  $("hint").hidden = !!seen || IN_FRAME || phase !== "aim";
  if (!$("hint").hidden) $("hint").textContent = "Pull back like a slingshot: the shell flies the other way, and a longer pull loads more powder. Press Fire; the arrows fine-tune.";
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
    view.setCone(aim.charge >= 0.05 ? coneOf(lvl, aim, 0) : null);
  },
  onHit() { sound.play("chime"); },
  onImpact() { sound.hushStop(); sound.play("thud"); },
  onEnd(res) {
    sound.hushStop();
    view.setGhosts(liveOn ? ghosts.slice(0, -1) : ghosts);
    if (S.status === "won") { phase = "done"; render(); return; }
    phase = "aim";
    const by = Math.max(0, res.near - lvl.target.r);
    say(`Missed by ${by.toFixed(2)}`);
    render();
  },
});

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
  const { state, res } = apply(lvl, S, { angle: aim.angle, charge: aim.charge, t: 0 });
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
  const [tx, ty] = L.target.at, r = L.target.r;
  const x0 = Math.min(-1.1, tx - r - 0.1), x1 = Math.max(1.1, tx + r + 0.1), y0 = Math.min(-1.1, ty - r - 0.1), y1 = Math.max(1.1, ty + r + 0.1);
  const s = Math.max(x1 - x0, y1 - y0) * 1.04, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const [gx, gy] = direction(L.site ?? 90);
  const f = n => n.toFixed(3);
  return `<svg viewBox="${f(cx - s / 2)} ${f(-cy - s / 2)} ${f(s)} ${f(s)}" aria-hidden="true"><circle class="cb-map-earth" cx="0" cy="0" r="1"/><circle class="cb-map-ring" cx="${f(tx)}" cy="${f(-ty)}" r="${f(L.target.r)}"/><circle class="cb-map-gun" cx="${f(gx * 1.03)}" cy="${f(-gy * 1.03)}" r="${f(s * 0.035)}"/></svg>`;
}
function levelList() {
  const list = document.createElement("div");
  list.className = "cb-levels";
  LEVELS.forEach((L, n) => {
    const b = document.createElement("button"), won = camp.stars[n];
    b.type = "button";
    b.className = won ? "done" : "";
    if (n === camp.at) b.setAttribute("aria-current", "true");
    b.setAttribute("aria-label", `Level ${L.id}, ${L.name}${won ? `, ${plural(won, "star")}${camp.bull[n] ? ", bullseye" : ""}` : ""}`);
    b.innerHTML = `<div class="cb-lmap">${mapSvg(L)}</div><div class="cb-lrow"><b>${L.id}</b><span>${starsWords(won)}${camp.bull[n] ? " ◎" : ""}</span></div><div class="cb-lnamed"></div>`;
    b.querySelector(".cb-lnamed").textContent = L.name;
    b.addEventListener("click", () => { $("menuDlg").close(); if (n !== camp.at) playLevel(n); });
    list.append(b);
  });
  return list;
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action(`Replay ${lvl.name}`, restart, "primary"));
  part(body, "content").append(levelList());
  part(body, "settings").append(toggle("Sound", sound.on, on => { sound.on = on; write(SOUND, on); }));
  const total = camp.stars.reduce((a, b) => a + b, 0), beaten = camp.stars.filter(Boolean).length;
  part(body, "about").append(line(`${plural(beaten, "level")} of ${LEVELS.length} struck, ${plural(total, "star")} of ${LEVELS.length * 3}. The Earth alone for now; the Moon comes later.`));
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
