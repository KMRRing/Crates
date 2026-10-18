// Orrery: five brass rings turning round a sun, each at a pace of its own, planets of four colours riding on them
// (orrery-3d.js draws it; flat, in orrery-flat.js, where there's no WebGL). Put a finger on a ring and turn it: it
// follows the finger; let go still and it stops, flick it and it goes faster; left alone it drifts back to its own pace
// over some seconds. Three to five planets of one colour, one to a ring, on one line out from the sun and held there
// for seven tenths of a second, clear and score. A new planet lands every few seconds, quicker as the game goes on; when there is no
// place for one, it is over. The rules are orrery-engine.js's; this file runs the clock, moves the rings under the
// fingers and keeps the game. The clock starts at the first touch of a ring and stops with the menu, with the tab and with
// the game over.
import { PLACES, STEP, AWARD, COMBO_WINDOW, newGame, valid, copy, grab, turnTo, release, step, between, norm, room, multiplier } from "./orrery-engine.js";
import { createOrrery } from "./orrery-3d.js";
import { sound } from "./orrery-sound.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, onPause } from "./menu.js";
import { IN_FRAME } from "./suite.js";                      // a partner watching's frame: it draws a copy, runs no clock and writes nothing

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "orrery:run", BEST = "orrery:best", SEEN = "orrery:seen", SOUND = "orrery:sound", VIEW = "orrery:view", ERA = "orrery:era", TURNS = "orrery:turns";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SAVE_EVERY = 5000;                                    // ms between saves of a game in play (a partner watching sees it that often)

let S = null;            // the game (orrery-engine.js's), as saved
let running = false;     // the clock going: from the first touch of a ring
let paused = false;      // the menu, the rules or the games screen open
let best = 0;            // the best score, as stored
const holds = new Map(); // fingers on rings: pointer id -> { ring, offset (the ring's turn from the finger's), a (the finger's angle), at (when), w (its speed, smoothed) }
let orbiting = null;     // a finger turning the view: { id, x, y }
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
  holds.clear();
  S = newGame(Math.floor(Math.random() * 2 ** 31));
  running = false;
  seen.clear();
  save();
  redrawOver();
}
/** A saved game, made ready to go on: nothing held, nothing charging until the next step finds it. */
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
const HINT = ["Turn a ring with a finger on it.", "Let go still and it stops; flick it, it speeds.", "Line up 3 to 5 planets of one colour", "on a line out from the sun: they clear.", "A new planet lands every few seconds."];
/** The words over the orrery while the clock is stopped: the first games' rules, then only how to go on. */
function redrawOver() {
  const w = over.clientWidth || stage.clientWidth, h = over.clientHeight || stage.clientHeight;
  over.setAttribute("viewBox", `0 0 ${w} ${h}`);
  if (!S || running || S.over || IN_FRAME) { plaqueG.replaceChildren(); return; }
  const first = !read(SEEN, false), head = S.t > 0 ? "Touch a ring to go on" : "Touch a ring to begin", rows = first ? [...HINT, head] : [head];
  const u = scale(), line = 15 * u, bw = (first ? 292 : 216) * u, bh = rows.length * line + 24 * u, y0 = h / 2 - bh / 2;
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

// ---------- the strip, the line under the orrery ----------
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
function drawSide() {
  const key = `${S.over}|${running}|${S.t > 0}|${S.aligned}|${S.cleared}|${S.score}`;
  if (shown.side === key) return;
  shown.side = key;
  $("result").hidden = !S.over;
  $("line").hidden = S.over;
  if (S.over) $("verdict").textContent = `No room left: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
  else $("line").textContent = S.aligned ? `${plural(S.aligned, "alignment")}, ${plural(S.cleared, "planet")} cleared${running ? "" : " — paused"}` : running ? "Line up three or more of one colour" : S.t > 0 ? "Paused" : "";
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
    for (const [, h] of holds) release(S, h.ring, 0);
    holds.clear();
    settle();
  }
}
function settle() {
  if (S.score > best) { best = S.score; write(BEST, best); }
  if (S.aligned >= 1) write(SEEN, true);
  save();
}
const seen = new Set();         // the alignments charging last frame, to sound a new one
function detectCharge() {
  const now = new Set((S.live?.clusters ?? []).map(c => c.members.map(m => m.ring * PLACES + m.place).sort((a, b) => a - b).join()));
  for (const k of now) if (!seen.has(k)) { sound.play("charge"); break; }
  seen.clear();
  for (const k of now) seen.add(k);
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
    detectCharge();
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
  for (const [, h] of holds) release(S, h.ring, 0);
  holds.clear();
  save();
  redrawOver();
}

// ---------- fingers on rings ----------
/** The ring under a finger comes down: the ring is the finger's from here (the clock starts if it hadn't). */
function takeRing(e) {
  const ring = S.over ? -1 : view.pick(e.clientX, e.clientY);
  if (ring < 0 || S.rings[ring].held) return false;
  const a = view.angleAt(ring, e.clientX, e.clientY);
  if (a == null) return false;
  start();
  grab(S, ring);
  holds.set(e.pointerId, { ring, offset: between(a, S.rings[ring].a), a, at: e.timeStamp, w: 0 });
  sound.play("grab", { pan: Math.sin(a) * 0.5 });
  return true;
}
function moveHold(e) {
  const h = holds.get(e.pointerId);
  if (!h) return;
  const a = view.angleAt(h.ring, e.clientX, e.clientY);
  if (a == null) return;
  const now = e.timeStamp, dt = Math.max(0.004, (now - h.at) / 1000), k = 1 - Math.exp(-dt / 0.06);
  h.w += (Math.max(-12, Math.min(12, between(h.a, a) / dt)) - h.w) * k;       // the finger's speed round the sun, smoothed
  h.a = a;
  h.at = now;
  turnTo(S, h.ring, a + h.offset, h.w);
}
/** The finger lets go: a ring that is still in the hand stops; one that was moving goes on at the finger's speed. */
function dropHold(e) {
  const h = holds.get(e.pointerId);
  if (!h) return;
  holds.delete(e.pointerId);
  release(S, h.ring, e.timeStamp - h.at > 90 || Math.abs(h.w) < 0.25 ? 0 : h.w);        // the events' own times (a slow frame must not make a flick look like a rest); a slow turn is placing it, not sending it
  sound.play("let", { pan: Math.sin(h.a) * 0.5 });
}
stage.addEventListener("pointerdown", e => {
  sound.unlock();
  if (e.button > 0 || IN_FRAME || paused) return;
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  if (takeRing(e)) return;
  if (!orbiting) orbiting = { id: e.pointerId, x: e.clientX, y: e.clientY };        // elsewhere on the dial a drag turns the view
});
addEventListener("pointermove", e => {
  moveHold(e);
  if (orbiting && e.pointerId === orbiting.id) {
    view.orbit(-(e.clientX - orbiting.x) * 0.0075, (e.clientY - orbiting.y) * 0.005);
    orbiting.x = e.clientX; orbiting.y = e.clientY;
  }
});
function lift(e) {
  dropHold(e);
  if (orbiting && e.pointerId === orbiting.id) { orbiting = null; write(VIEW, view.angles); }
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
onPause(() => { paused = true; sound.hold(); for (const [, h] of holds) release(S, h.ring, 0); holds.clear(); save(); }, () => { paused = false; sound.release(); });

// for tests and debugging
window.__orrery = {
  get state() { return S; }, set state(g) { S = resume(g); holds.clear(); redrawOver(); }, view, newRun, start, stop,
  get running() { return running; },
  set frozen(v) { frozen = !!v; },
  /** Plays `seconds` of the game at once (as the clock would), events and all. */
  advance(seconds) { for (let t = 0; t < seconds - 1e-9 && !S.over; t += 0.05) for (const ev of step(S, 0.05)) handle(ev); view.frame(S, 0); drawStrip(); drawSide(); },
  /** Where a planet's seat is on the page, in the client coordinates a pointer event carries (the view's own are the canvas's). */
  seatOf(ring, place = 0) { const [x, y] = view.at(ring, S.rings[ring].a + place * STEP, 0), r = stage.getBoundingClientRect(); return [x + r.left, y + r.top]; },
  /** Where a ring's angle is on the page. */
  spotOf(ring, angle) { const [x, y] = view.at(ring, angle, 0), r = stage.getBoundingClientRect(); return [x + r.left, y + r.top]; },
  AWARD, norm,
};

best = read(BEST, 0);
S = read(RUN, null);
if (!valid(S)) newRun();
else { S = resume(S); redrawOver(); }
requestAnimationFrame(tick);
