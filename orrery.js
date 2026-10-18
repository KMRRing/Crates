// Orrery: five brass hoops on an axle round a sun, planets of four colours strung on them (orrery-3d.js draws it; flat,
// in orrery-flat.js, where there's no WebGL). Tap a hoop to choose it, and the seven buttons under the orrery set it:
// left, right, each slow, strong or very strong, and a hold in the middle that stops it. Tap the same hoop again and the
// same buttons tip its orbit instead, to the left or the right by 15, 30 or 45 degrees, the middle one making it level.
// A swipe on a hoop is a hand's way of the same: along a hoop it sets its speed by how fast the finger goes, across it
// (once it's tipping) it tips it. A hoop keeps its speed until it's set to another. Three to five planets of one colour,
// one to a hoop, in one direction from the sun clear at once and score; a new planet lands every few seconds, quicker as the
// game goes on; when there is no place for one, it is over. The rules are orrery-engine.js's; this file runs the clock,
// takes the taps, buttons and swipes and keeps the game. The clock starts at the first hoop chosen or button pressed and stops
// with the menu, with the tab and with the game over.
import { PLACES, STEP, SPEED, TILT, AWARD, COMBO_WINDOW, newGame, valid, copy, setSpeed, setTilt, step, between, norm, room, multiplier } from "./orrery-engine.js";
import { createOrrery } from "./orrery-3d.js";
import { sound } from "./orrery-sound.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, onPause } from "./menu.js";
import { IN_FRAME } from "./suite.js";                      // a partner watching's frame: it draws a copy, runs no clock and writes nothing

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "orrery:run", BEST = "orrery:best", SEEN = "orrery:seen", SOUND = "orrery:sound", VIEW = "orrery:view", ERA = "orrery:era", TURNS = "orrery:turns", CHOSEN = "orrery:sel";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SAVE_EVERY = 5000;                                    // ms between saves of a game in play (a partner watching sees it that often)
const DEG = 180 / Math.PI;

let S = null;            // the game (orrery-engine.js's), as saved
let running = false;     // the clock going: from the first hoop chosen or button pressed
let paused = false;      // the menu, the rules or the games screen open
let best = 0;            // the best score, as stored
let chosen = null;       // the hoop the buttons are for: { ring, mode ("speed" or "tilt") }, or null
const swipes = new Map();// fingers down: pointer id -> { ring (-1: on the sky), x0, y0, t0, x, y, moved, trail }
let savedAt = 0;
let frozen = false;      // for tests: the clock held while a picture is taken

// The turn-based Orrery kept its best in the same place; its scores mean nothing here, so they go to a key of their own.
if (!IN_FRAME && read(ERA, 0) < 2) {
  const old = read(BEST, 0);
  if (old) write(TURNS, old);
  write(BEST, 0);
  write(ERA, 2);
}

sound.on = read(SOUND, true);
const stage = $("stage");
let view;
try { view = createOrrery(stage); }
catch (err) {
  console.warn("Orrery: no WebGL here, so the orrery is drawn flat.", err);
  view = (await import("./orrery-flat.js")).createFlat(stage);
}
{ const v = read(VIEW, null); if (Array.isArray(v)) view.setView(v[0], v[1]); }

function save() { if (IN_FRAME) return; write(RUN, copy(S)); savedAt = performance.now(); }
function newRun() {
  swipes.clear();
  S = newGame(Math.floor(Math.random() * 2 ** 31));
  running = false;
  choose(-1);
  save();
  redrawOver();
}
/** A saved game, made ready to go on: nothing held, nothing standing until the next step finds it. */
function resume(g) {
  g.live = { clusters: [] };
  for (const r of g.rings) r.held = false;
  return g;
}

// ---------- over the orrery: what the page says, in the screen's own pixels ----------
const over = $("over");
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const text = (cls, s, x, y, size) => {
  const t = el("text", { class: cls, x: x.toFixed(1), y: y.toFixed(1), "font-size": (size * scale()).toFixed(1) });
  t.textContent = s;
  return t;
};
const plaqueG = el("g"), fxG = el("g");
over.append(plaqueG, fxG);
const HINT = ["Tap a hoop, then press a button to spin it.", "Tap the same hoop again: the buttons tip it.", "The middle button holds it still.", "Line up 3 to 5 planets of one colour with the sun,", "along the axle or on hoops tipped alike:", "they clear at once."];
/** The words over the orrery while the clock is stopped: the first games' rules, then only how to go on. */
function redrawOver() {
  const w = over.clientWidth || stage.clientWidth, h = over.clientHeight || stage.clientHeight;
  over.setAttribute("viewBox", `0 0 ${w} ${h}`);
  if (!S || running || S.over || IN_FRAME) { plaqueG.replaceChildren(); return; }
  const first = !read(SEEN, false), head = S.t > 0 ? "Tap a hoop to go on" : "Tap a hoop to begin", rows = first ? [...HINT, head] : [head];
  const u = scale(), line = 15 * u, bw = (first ? 318 : 216) * u, bh = rows.length * line + 24 * u, y0 = h / 2 - bh / 2;
  plaqueG.replaceChildren(
    el("rect", { class: "or-plaque", x: (w / 2 - bw / 2).toFixed(1), y: y0.toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1), rx: 5 }),
    ...rows.map((t, k) => text(k === rows.length - 1 ? "or-hint head" : "or-hint", t, w / 2, y0 + 12 * u + (k + 1) * line - 4 * u, k === rows.length - 1 ? 10.5 : 11)),
  );
}
new ResizeObserver(redrawOver).observe(stage);
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
/** The score of an alignment, floating up from where its planets were. */
function popup(ev) {
  const pts = ev.members.map(m => view.at(m.ring, S.rings[m.ring].a + m.place * STEP, 0.4)), x = pts.reduce((a, p) => a + p[0], 0) / pts.length, y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const big = ev.n >= 5 || ev.combo >= 3, u = scale();
  const t = text(`or-pop${big ? " big" : ""}`, `+${fmt(ev.gain)}`, x, y, big ? 24 : 19), nodes = [t];
  fxG.append(t);
  if (ev.combo > 1) { const c = text("or-pop sub", `×${multiplier(ev.combo)}`, x, y + 17 * u, 13); fxG.append(c); nodes.push(c); }
  for (const n of nodes) animate(n, [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-34 * u}px)`, opacity: 0 }], { duration: 1300, easing: "ease-out" }).then(() => n.remove());
}

// ---------- the strip, the hoop chosen and its buttons ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  put("score", fmt(S.score));
  put("best", fmt(Math.max(best, S.score)));
  put("room", String(room(S)));
  const on = S.combo > 1 && S.t - S.lastLock <= COMBO_WINDOW && !S.over;
  put("combo", on ? `×${multiplier(S.combo)}` : "");
  $("combo").classList.toggle("on", on);
}
const KEYS = [-3, -2, -1, 0, 1, 2, 3];
const SPIN_WORDS = ["Spin left very fast", "Spin left fast", "Spin left slowly", "Hold still", "Spin right slowly", "Spin right fast", "Spin right very fast"];
const TIP_WORDS = ["Tip 45° left", "Tip 30° left", "Tip 15° left", "Level", "Tip 15° right", "Tip 30° right", "Tip 45° right"];
/** A button's picture: one to three chevrons for a strength, a square to hold, a bar with a dot to lie level. */
function glyph(level, mode) {
  if (level === 0) return mode === "speed" ? '<rect class="fill" x="9" y="6" width="12" height="12" rx="1.5"/>' : '<path d="M4 12H26"/><circle class="fill" cx="15" cy="12" r="2.6"/>';
  const n = Math.abs(level), d = Math.sign(level), x0 = 15 - 3 * n;
  return Array.from({ length: n }, (_, i) => { const x = x0 + 6 * i; return d < 0 ? `<path d="M${x + 6} 4L${x} 12L${x + 6} 20"/>` : `<path d="M${x} 4L${x + 6} 12L${x} 20"/>`; }).join("");
}
const keys = KEYS.map(level => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `or-key${level === 0 ? " hold" : ""}`;
  b.dataset.level = level;
  b.innerHTML = '<svg viewBox="0 0 30 24" aria-hidden="true"></svg>';
  b.addEventListener("click", () => press(level));
  $("pad").append(b);
  return b;
});
/** Which of the seven a hoop's setting is, or null when it's none of them (a swipe sent it at its own speed). */
function levelOf(r, mode) {
  const x = mode === "speed" ? r.w : r.tiltTo, table = mode === "speed" ? SPEED : TILT;
  for (const k of KEYS) if (Math.abs(x - Math.sign(k) * table[Math.abs(k)]) < 1e-6) return k;
  return null;
}
function drawAim(force = false) {
  const r = chosen && !S.over ? S.rings[chosen.ring] : null, mode = chosen?.mode ?? "speed", set = r ? (mode === "speed" ? r.w : r.tiltTo) : 0;
  const key = `${r ? chosen.ring : -1}|${mode}|${Math.round(set * 1e4)}|${S.over}`;
  if (!force && shown.aim === key) return;
  shown.aim = key;
  $("controls").hidden = S.over;
  $("result").hidden = !S.over;
  $("controls").classList.toggle("none", !r);
  $("spinBtn").setAttribute("aria-pressed", String(mode === "speed"));
  $("tiltBtn").setAttribute("aria-pressed", String(mode === "tilt"));
  const now = r ? levelOf(r, mode) : null;
  keys.forEach((b, i) => {
    b.disabled = !r;
    b.setAttribute("aria-pressed", String(now === KEYS[i]));
    b.setAttribute("aria-label", (mode === "speed" ? SPIN_WORDS : TIP_WORDS)[i]);
    b.title = b.getAttribute("aria-label");
    b.firstElementChild.innerHTML = glyph(KEYS[i], mode);
  });
  if (!r) $("line").textContent = S.over ? "" : "Tap a hoop to choose it";
  else if (mode === "speed") $("line").innerHTML = `Hoop <b>${chosen.ring + 1}</b> · ${Math.abs(r.w) < 1e-6 ? "held still" : `${r.w > 0 ? "▶" : "◀"} ${(Math.abs(r.w) * DEG).toFixed(r.w * r.w * DEG * DEG < 4 ? 1 : 0)}°/s`}`;
  else $("line").innerHTML = `Hoop <b>${chosen.ring + 1}</b> · ${Math.abs(r.tiltTo) < 1e-6 ? "level" : `tipped ${r.tiltTo > 0 ? "+" : "−"}${Math.round(Math.abs(r.tiltTo) * DEG)}°`}`;
}
function drawSide() {
  drawAim();
  const key = `${S.over}|${S.score}`;
  if (shown.side === key) return;
  shown.side = key;
  if (S.over) $("verdict").textContent = `No room left: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
}

// ---------- events of the game ----------
/** What a step brought about: shown and sounded, and the game kept at the ends. */
function handle(ev) {
  view.event(ev, S);
  if (ev.type === "land") sound.play("land", { ring: ev.ring, pan: Math.sin(S.rings[ev.ring].a + ev.place * STEP) * 0.5 });
  else if (ev.type === "lock") {
    sound.play("lock", { n: ev.n, combo: ev.combo });
    popup(ev);
    settle();
    redrawOver();
  } else if (ev.type === "over") {
    sound.play("over");
    settle();
    redrawOver();
  }
}
function settle() {
  if (S.score > best) { best = S.score; write(BEST, best); }
  if (S.aligned >= 1) write(SEEN, true);
  save();
}

// ---------- the clock ----------
let lastTs = 0;
function tick(ts) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));          // a stalled tab doesn't jump the game on
  lastTs = ts;
  if (!S) return;
  const go = running && !paused && !frozen && !S.over && !IN_FRAME;
  if (go) {
    for (const ev of step(S, dt)) handle(ev);
    if (performance.now() - savedAt > SAVE_EVERY) save();
  }
  view.frame(S, go ? dt : 0);
  drawStrip();
  drawSide();
}
function start() {
  if (running || S.over || IN_FRAME) return;
  running = true;
  redrawOver();
  save();
}
function stop() {
  if (!running) return;
  running = false;
  save();
  redrawOver();
}

// ---------- the hoop chosen, the buttons, swipes ----------
/** Chooses a hoop (-1: none) and what the buttons do to it; the page and the picture both show it. */
function choose(ring, mode = "speed") {
  chosen = ring < 0 ? null : { ring, mode };
  if (!IN_FRAME) write(CHOSEN, chosen);
  view.select(ring, mode);
  drawAim(true);
}
/** A tap on a hoop: it's chosen; tapped again, what the buttons do to it changes from spin to tip and back. */
function tapHoop(ring) {
  if (S.over) return;
  start();
  choose(ring, chosen?.ring === ring && chosen.mode === "speed" ? "tilt" : "speed");
  sound.play("pick", { ring });
}
/** A button: the chosen hoop is set to the speed or the tip it stands for. */
function press(level) {
  if (!chosen || S.over || paused || IN_FRAME) return;
  sound.unlock();
  start();
  const { ring, mode } = chosen, n = Math.abs(level), sign = Math.sign(level);
  if (mode === "speed") setSpeed(S, ring, sign * SPEED[n]);
  else { setTilt(S, ring, sign * TILT[n]); sound.play("tip", { up: sign }); }
  sound.play("press", { strength: n });
  drawAim(true);
}
/** A finger lifted after moving on a hoop: where it went sets the hoop. */
function swipe(g) {
  const a = g.trail[0], b = g.trail[g.trail.length - 1], dt = Math.max(0.03, (b[0] - a[0]) / 1000), ring = g.ring;
  start();
  if (chosen?.ring === ring && chosen.mode === "tilt") {
    const dx = b[1] - a[1], dy = b[2] - a[2];
    if (Math.abs(dx) < 2 * Math.abs(dy)) return;                          // not across: not for tipping
    const n = Math.abs(dx) / dt < 500 * scale() ? 1 : Math.abs(dx) / dt < 1100 * scale() ? 2 : 3;
    setTilt(S, ring, Math.sign(dx) * TILT[n]);
    sound.play("tip", { up: Math.sign(dx) });
  } else {
    const p = view.angleAt(ring, a[1], a[2]), q = view.angleAt(ring, b[1], b[2]);
    if (p == null || q == null) return;
    const w = between(p, q) / dt;                                         // how fast the finger went round the sun, rad/s
    const to = Math.sign(w) * Math.max(SPEED[1], Math.min(SPEED[3], Math.abs(w) * 0.07));   // the slowest the hoop goes, or as fast as the hand: a swipe never stops one (that's the middle button)
    setSpeed(S, ring, to);
    choose(ring, "speed");
    sound.play("press", { strength: Math.abs(to) > SPEED[2] * 1.2 ? 3 : Math.abs(to) > SPEED[1] * 1.5 ? 2 : to ? 1 : 0 });
  }
  drawAim(true);
}
stage.addEventListener("pointerdown", e => {
  sound.unlock();
  if (e.button > 0 || IN_FRAME || paused) return;
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  const ring = S.over ? -1 : view.pick(e.clientX, e.clientY, 20 * scale());
  swipes.set(e.pointerId, { ring, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, trail: [[e.timeStamp, e.clientX, e.clientY]] });
});
addEventListener("pointermove", e => {
  const g = swipes.get(e.pointerId);
  if (!g) return;
  g.trail.push([e.timeStamp, e.clientX, e.clientY]);
  while (g.trail.length > 2 && (g.trail.length > 8 || e.timeStamp - g.trail[0][0] > 160)) g.trail.shift();      // the last moments: how fast it went as it let go
  if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 10 * scale()) g.moved = true;
  if (g.ring < 0 && g.moved) view.orbit(-(e.clientX - g.x) * 0.0075, (e.clientY - g.y) * 0.005);                // on the sky a drag turns the view
  g.x = e.clientX; g.y = e.clientY;
});
function lift(e) {
  const g = swipes.get(e.pointerId);
  if (!g) return;
  swipes.delete(e.pointerId);
  if (g.ring < 0) { if (g.moved) write(VIEW, view.angles); return; }
  if (e.type === "pointercancel") return;
  if (g.moved) swipe(g); else tapHoop(g.ring);
}
addEventListener("pointerup", lift);
addEventListener("pointercancel", lift);
stage.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("visibilitychange", () => { if (document.hidden && !IN_FRAME) stop(); });
addEventListener("pagehide", () => { if (!IN_FRAME) save(); });

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("New game", newRun, "primary"));
  const settings = part(body, "settings");
  settings.append(toggle("Sound", sound.on, on => { sound.on = on; write(SOUND, on); if (on) sound.play("land", { ring: 2 }); }));
  settings.append(action("Reset the view", () => { view.setView(0, null); write(VIEW, null); }, "link"));
  part(body, "about").append(line(`This game: ${fmt(S.score)}, ${plural(S.aligned, "alignment")}, ${plural(S.cleared, "planet")} cleared${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "orrery");
document.querySelector(".or-mark").innerHTML = APPS.find(a => a.id === "orrery").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", newRun);
for (const [id, mode] of [["spinBtn", "speed"], ["tiltBtn", "tilt"]]) $(id).addEventListener("click", () => { if (chosen && !S.over && !IN_FRAME) { choose(chosen.ring, mode); sound.play("pick", { ring: chosen.ring }); } });
onPause(() => { paused = true; sound.hold(); swipes.clear(); save(); }, () => { paused = false; sound.release(); });

// for tests and debugging
window.__orrery = {
  get state() { return S; }, set state(g) { S = resume(g); swipes.clear(); redrawOver(); }, view, newRun, start, stop,
  get running() { return running; },
  set frozen(v) { frozen = !!v; },
  get chosen() { return chosen; },
  choose, press, tapHoop,
  /** Plays `seconds` of the game at once (as the clock would), events and all. */
  advance(seconds) { for (let t = 0; t < seconds - 1e-9 && !S.over; t += 0.05) for (const ev of step(S, 0.05)) handle(ev); view.frame(S, 0); drawStrip(); drawSide(); },
  /** Where a place is on the page, in the client coordinates a pointer event carries (the view's own are the canvas's). */
  seatOf(ring, place = 0) { const [x, y] = view.at(ring, S.rings[ring].a + place * STEP, 0), r = stage.getBoundingClientRect(); return [x + r.left, y + r.top]; },
  /** Where a hoop's angle is on the page. */
  spotOf(ring, angle) { const [x, y] = view.at(ring, angle, 0), r = stage.getBoundingClientRect(); return [x + r.left, y + r.top]; },
  AWARD, norm,
};

best = read(BEST, 0);
S = read(RUN, null);
if (!valid(S)) newRun();
else { S = resume(S); redrawOver(); }
{ const c = read(CHOSEN, null); if (c && Number.isInteger(c.ring) && c.ring >= 0 && c.ring < S.rings.length && !S.over) choose(c.ring, c.mode === "tilt" ? "tilt" : "speed"); else choose(-1); }
requestAnimationFrame(tick);
