// Orrery: four brass hoops on an axle round a sun, planets of four colours strung on them (orrery-3d.js draws it; flat,
// in orrery-flat.js, where there's no WebGL), stepping on a beat. Tap a hoop to choose it, and the seven buttons under the
// orrery set it: a place left or right every beat, every second beat or every third, or still in the middle. Tap the
// same hoop again and the same buttons tip its orbit instead, to the left or the right by 15, 30 or 45 degrees, the
// middle one making it level. A swipe along a hoop sets it going the way the finger went, every third, second or every
// beat by how fast; across a hoop being tipped, it tips it. − and + set the tempo, from 20 beats a minute to 60; a
// metronome swings with it, and a bar of the beats coming shows which hoops step on which. Three or four planets of one
// colour on hoops standing still, in one direction from the sun, are a line, and the next beat strikes it; a new planet
// lands every few seconds, quicker as the game goes on; when there is no place for one, it is over. The rules are
// orrery-engine.js's; this file runs the clock, takes the taps, buttons and swipes and keeps the game. The clock starts
// at the first hoop chosen or button pressed and stops with the menu, with the tab and with the game over.
import { RINGS, STEP, TEMPOS, FIRST_TEMPO, TIP, COMBO_WINDOW, newGame, valid, copy, setRing, setTip, setTempo, step, between, room, multiplier, period, upcoming, turnOf } from "./orrery-engine.js";
import { createOrrery } from "./orrery-3d.js";
import { sound } from "./orrery-sound.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, onPause } from "./menu.js";
import { IN_FRAME } from "./suite.js";                      // a partner watching's frame: it draws a copy, runs no clock and writes nothing

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "orrery:run", BEST = "orrery:best", SEEN = "orrery:seen", SOUND = "orrery:sound", VIEW = "orrery:view", ERA = "orrery:era", CHOSEN = "orrery:sel", TEMPO = "orrery:tempo";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SAVE_EVERY = 5000;                                    // ms between saves of a game in play (a partner watching sees it that often)
const AHEAD = 6;                                            // beats the bar shows coming: every rhythm steps at least twice in six

let S = null;            // the game (orrery-engine.js's), as saved
let running = false;     // the clock going: from the first hoop chosen or button pressed
let paused = false;      // the menu, the rules or the games screen open
let best = 0;            // the best score, as stored
let chosen = null;       // the hoop the buttons are for: { ring, mode ("speed" or "tilt") }, or null
const swipes = new Map();// fingers down: pointer id -> { ring (-1: on the sky), x0, y0, x, y, moved, trail }
let savedAt = 0;
let frozen = false;      // for tests: the clock held while a picture is taken

// Bests from earlier orreries mean nothing here, so they go to keys of their own: the turn-based game's to orrery:turns
// (era 2), the game of set speeds and five hoops (version 3) to orrery:speeds (era 3). The first games' rules show again.
if (!IN_FRAME && read(ERA, 0) < 3) {
  const old = read(BEST, 0);
  if (old) write(read(ERA, 0) < 2 ? "orrery:turns" : "orrery:speeds", old);
  write(BEST, 0);
  try { localStorage.removeItem(SEEN); } catch { /* private mode */ }
  write(ERA, 3);
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
  S = newGame(Math.floor(Math.random() * 2 ** 31), read(TEMPO, FIRST_TEMPO));
  running = false;
  choose(-1);
  save();
  redrawOver();
  drawTempo();
  roll.reset();
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
const numsG = el("g"), plaqueG = el("g"), fxG = el("g");
over.append(numsG, plaqueG, fxG);
const nums = Array.from({ length: RINGS }, (_, k) => { const t = el("text", { class: "or-num" }); t.textContent = String(k + 1); numsG.append(t); return t; });
let numsAt = "";
/** The hoops' numbers by their knuckles at six o'clock, moved only when the view has (a turn of the camera, a new size). */
function drawNums() {
  const u = scale(), at = nums.map((_, k) => view.at(k, Math.PI, 0)), k = `${at.flat().map(v => v.toFixed(0)).join()}|${chosen?.ring ?? -1}|${u}`;
  if (k === numsAt) return;
  numsAt = k;
  nums.forEach((t, ring) => {
    t.setAttribute("x", (at[ring][0] + 15 * u).toFixed(1));             // clear of a planet standing at six o'clock
    t.setAttribute("y", (at[ring][1] + 13 * u).toFixed(1));
    t.setAttribute("font-size", (9.5 * u).toFixed(1));
    t.classList.toggle("on", ring === chosen?.ring);
  });
}
const HINT = ["Tap a hoop, then a button: it steps on the beat,", "left or right, every beat, every second or third.", "Stop the hoops with planets of a colour in line", "with the sun: at twelve or six o'clock, or anywhere", "on hoops tipped alike (tap a hoop again to tip it).", "The next beat strikes them. − and + set the beat."];
/** The words over the orrery while the clock is stopped: the first games' rules, then only how to go on. */
function redrawOver() {
  const w = over.clientWidth || stage.clientWidth, h = over.clientHeight || stage.clientHeight;
  over.setAttribute("viewBox", `0 0 ${w} ${h}`);
  if (!S || running || S.over || IN_FRAME) { plaqueG.replaceChildren(); return; }
  const first = !read(SEEN, false), head = S.t > 0 ? "Tap a hoop to go on" : "Tap a hoop to begin", rows = first ? [...HINT, head] : [head];
  const u = scale(), lh = 15 * u, bw = (first ? 326 : 216) * u, bh = rows.length * lh + 24 * u, y0 = h / 2 - bh / 2;
  plaqueG.replaceChildren(
    el("rect", { class: "or-plaque", x: (w / 2 - bw / 2).toFixed(1), y: y0.toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1), rx: 5 }),
    ...rows.map((t, k) => text(k === rows.length - 1 ? "or-hint head" : "or-hint", t, w / 2, y0 + 12 * u + (k + 1) * lh - 4 * u, k === rows.length - 1 ? 10.5 : 11)),
  );
}
new ResizeObserver(redrawOver).observe(stage);
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
/** The score of a line, floating up from where its planets were. */
function popup(ev) {
  const pts = ev.members.map(m => view.at(m.ring, (S.rings[m.ring].a + m.place) * STEP, 0.4)), x = pts.reduce((a, p) => a + p[0], 0) / pts.length, y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const big = ev.n >= 4 || ev.combo >= 3, u = scale();
  const t = text(`or-pop${big ? " big" : ""}`, `+${fmt(ev.gain)}`, x, y, big ? 24 : 19), nodes = [t];
  fxG.append(t);
  if (ev.combo > 1) { const c = text("or-pop sub", `×${multiplier(ev.combo)}`, x, y + 17 * u, 13); fxG.append(c); nodes.push(c); }
  for (const n of nodes) animate(n, [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-34 * u}px)`, opacity: 0 }], { duration: 1300, easing: "ease-out" }).then(() => n.remove());
}

// ---------- the strip, the tempo and the bar of beats ----------
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
function drawTempo() {
  put("tempo", String(TEMPOS[S.tempo]));
  $("slowerBtn").disabled = S.over || S.tempo === 0;
  $("fasterBtn").disabled = S.over || S.tempo === TEMPOS.length - 1;
  $("tempoBox").setAttribute("aria-label", `Tempo: ${TEMPOS[S.tempo]} beats a minute`);
}
/** The metronome's arm: on each beat it sets off for the other side, to get there on the next. */
const arm = document.querySelector(".or-metro-arm");
let swing = 1;
function tickArm() {
  swing = -swing;
  arm.style.transitionDuration = `${(period(S) * 0.98).toFixed(2)}s`;
  arm.style.transform = `rotate(${swing * 24}deg)`;
}
function restArm() { arm.style.transitionDuration = "0.3s"; arm.style.transform = "rotate(0deg)"; }
/**
 * The bar of beats: a row for each hoop and a column for each of the next six beats, a chevron where the hoop steps
 * (and which way), a dot where it's set going but waits. On each beat the bar moves on a column under the brass line,
 * like a music box's barrel past its comb, and the line flashes.
 */
const roll = (() => {
  const box = $("roll"), track = document.createElement("div"), names = document.createElement("div"), win = document.createElement("div");
  names.className = "or-roll-names"; win.className = "or-roll-window"; track.className = "or-roll-track";
  for (let k = 0; k < RINGS; k++) { const n = document.createElement("span"); n.textContent = String(k + 1); names.append(n); }
  win.append(track);
  box.append(names, win);
  const cells = Array.from({ length: RINGS * (AHEAD + 1) }, (_, i) => { const c = document.createElement("i"); c.style.gridRow = String(Math.floor(i / (AHEAD + 1)) + 1); c.style.gridColumn = String((i % (AHEAD + 1)) + 1); track.append(c); return c; });
  let key = "", played = null;
  /** Draws the beats: column 0 is the one just played (it slides out past the line), 1 to AHEAD the ones coming. */
  function draw(slide = false) {
    const ahead = upcoming(S, AHEAD), cols = [played ?? S.rings.map(() => 0), ...ahead];
    const k = JSON.stringify([cols, chosen?.ring ?? -1, S.rings.map(r => r.set)]);
    if (k !== key || slide) {
      key = k;
      cols.forEach((col, c) => col.forEach((d, ring) => {
        const going = S.rings[ring].set !== 0;
        cells[ring * (AHEAD + 1) + c].className = d > 0 ? "st r" : d < 0 ? "st l" : going && c > 0 ? "rest" : "";
      }));
      [...names.children].forEach((n, ring) => n.classList.toggle("on", ring === chosen?.ring));
      box.querySelectorAll(".row-on").forEach(n => n.classList.remove("row-on"));
      if (chosen) for (let c = 0; c <= AHEAD; c++) cells[chosen.ring * (AHEAD + 1) + c].classList.add("row-on");
    }
    if (slide) {
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      void track.offsetWidth;                                       // the start of the slide is drawn before it moves
      track.style.transition = "";
      track.style.transform = "";
      win.classList.remove("beat"); void win.offsetWidth; win.classList.add("beat");
    }
  }
  return {
    draw,
    /** A beat: what it stepped becomes the column that slides out, and the rest move on. */
    beat(ev) { played = S.rings.map((_, ring) => ev.stepped.find(x => x.ring === ring)?.dir ?? 0); draw(true); },
    reset() { played = null; key = ""; draw(); },
  };
})();

// ---------- the hoop chosen and its buttons ----------
const KEYS = [-3, -2, -1, 0, 1, 2, 3];
const SPIN_WORDS = ["Every beat left", "Every second beat left", "Every third beat left", "Still", "Every third beat right", "Every second beat right", "Every beat right"];
const TIP_WORDS = ["Tip 45° left", "Tip 30° left", "Tip 15° left", "Level", "Tip 15° right", "Tip 30° right", "Tip 45° right"];
const RHYTHM = ["", "every third beat", "every second beat", "every beat"];
/** A button's picture: one to three chevrons for a rhythm (three, every beat), a square for still; for a tip, the hoop seen edge on, tipped so. */
function glyph(level, mode) {
  if (mode === "tilt") return `<g transform="rotate(${-level * 15} 15 12)"><path d="M3.5 12H26.5"/></g><circle class="fill" cx="15" cy="12" r="2.4"/>`;
  if (level === 0) return '<rect class="fill" x="9" y="6" width="12" height="12" rx="1.5"/>';
  const n = Math.abs(level), d = Math.sign(level), x0 = 15 - 3 * n;
  return Array.from({ length: n }, (_, i) => { const x = x0 + 6 * i; return d < 0 ? `<path d="M${x + 6} 4L${x} 12L${x + 6} 20"/>` : `<path d="M${x} 4L${x + 6} 12L${x} 20"/>`; }).join("");
}
const keys = KEYS.map(level => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `or-key${level === 0 ? " hold" : ""}`;
  b.dataset.level = level;
  b.innerHTML = '<svg viewBox="0 0 30 24" aria-hidden="true"></svg><span class="alike" aria-hidden="true"></span>';
  b.addEventListener("click", () => press(level));
  $("pad").append(b);
  return b;
});
/** The other hoops at a tip, by number: the ones a hoop tipped so would lie in a plane with. */
const alikeAt = (ring, tip) => S.rings.flatMap((r, k) => (k !== ring && r.tip === tip ? [k + 1] : []));
function drawAim(force = false) {
  const r = chosen && !S.over ? S.rings[chosen.ring] : null, mode = chosen?.mode ?? "speed";
  const k = `${r ? chosen.ring : -1}|${mode}|${r ? `${r.set},${r.tip}` : ""}|${S.rings.map(q => q.tip).join()}|${S.over}`;
  if (!force && shown.aim === k) return;
  shown.aim = k;
  $("controls").classList.toggle("gone", S.over);
  $("result").hidden = !S.over;
  $("controls").classList.toggle("none", !r);
  $("spinBtn").setAttribute("aria-pressed", String(mode === "speed"));
  $("tiltBtn").setAttribute("aria-pressed", String(mode === "tilt"));
  const now = r ? (mode === "speed" ? r.set : r.tip) : null;
  keys.forEach((b, i) => {
    b.disabled = !r;
    b.setAttribute("aria-pressed", String(now === KEYS[i]));
    const like = r && mode === "tilt" ? alikeAt(chosen.ring, KEYS[i]) : [];
    b.setAttribute("aria-label", (mode === "speed" ? SPIN_WORDS : TIP_WORDS)[i] + (like.length ? `, like hoop ${like.join(" and ")}` : ""));
    b.title = b.getAttribute("aria-label");
    b.firstElementChild.innerHTML = glyph(KEYS[i], mode);
    b.lastElementChild.textContent = like.join("");
  });
  if (!r) $("line").textContent = S.over ? "" : "Tap a hoop to choose it";
  else if (mode === "speed") $("line").innerHTML = `Hoop <b>${chosen.ring + 1}</b> · ${r.set ? `${r.set > 0 ? "▶" : "◀"} ${RHYTHM[Math.abs(r.set)]}` : "still"}`;
  else {
    const like = alikeAt(chosen.ring, r.tip);
    $("line").innerHTML = `Hoop <b>${chosen.ring + 1}</b> · ${r.tip ? `tipped ${r.tip > 0 ? "+" : "−"}${Math.abs(r.tip) * 15}°` : "level"}${like.length ? `, like ${like.join(" and ")}` : ""}`;
  }
}
function drawSide() {
  drawAim();
  const k = `${S.over}|${S.score}`;
  if (shown.side === k) return;
  shown.side = k;
  if (S.over) $("verdict").textContent = `No room left: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
  drawTempo();
}

// ---------- events of the game ----------
/** What a step brought about: shown and sounded, and the game kept at the ends. */
function handle(ev) {
  view.event(ev, S);
  if (ev.type === "beat") {
    sound.play("beat", { power: ev.stepped.length ? 0.35 : 0.5 });
    if (ev.stepped.length) sound.play("step", { n: ev.stepped.length });
    roll.beat(ev);
    tickArm();
  } else if (ev.type === "land") sound.play("land", { ring: ev.ring, pan: Math.sin((S.rings[ev.ring].a + ev.place) * STEP) * 0.5 });
  else if (ev.type === "lock") {
    sound.play("lock", { n: ev.n, combo: ev.combo });
    popup(ev);
    settle();
    redrawOver();
  } else if (ev.type === "over") {
    sound.play("over");
    restArm();
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
  drawNums();
  roll.draw();
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
  restArm();
  save();
  redrawOver();
}

// ---------- the hoop chosen, the buttons, the tempo, swipes ----------
/** Chooses a hoop (-1: none) and what the buttons do to it; the page and the picture both show it. */
function choose(ring, mode = "speed") {
  chosen = ring < 0 ? null : { ring, mode };
  if (!IN_FRAME) write(CHOSEN, chosen);
  view.select(ring, mode);
  drawAim(true);
  roll.draw();
}
/** A tap on a hoop: it's chosen; tapped again, what the buttons do to it changes from spin to tip and back. */
function tapHoop(ring) {
  if (S.over) return;
  start();
  choose(ring, chosen?.ring === ring && chosen.mode === "speed" ? "tilt" : "speed");
  sound.play("pick", { ring });
}
/** A button: the chosen hoop is set to the rhythm or the tip it stands for. */
function press(level) {
  if (!chosen || S.over || paused || IN_FRAME) return;
  sound.unlock();
  start();
  const { ring, mode } = chosen;
  if (mode === "speed") setRing(S, ring, level);
  else if (setTip(S, ring, level)) sound.play("tip", { up: Math.sign(level - S.rings[ring].tipFrom) });
  sound.play("press", { strength: Math.abs(level) });
  drawAim(true);
  roll.draw();
}
/** − or +: a tempo slower or quicker, kept for the next game too. */
function nudgeTempo(by) {
  if (S.over || paused || IN_FRAME) return;
  sound.unlock();
  if (!setTempo(S, S.tempo + by)) return;
  write(TEMPO, S.tempo);
  sound.play("tempo", { up: by });
  drawTempo();
  save();
}
/** How fast a finger goes round the sun, radians a second, at which a swipe along a hoop sets it going every second beat and every beat (slower than the first, every third). */
const SWIPE = [1.2, 3];
/** A finger lifted after moving on a hoop: where it went sets the hoop. */
function swipe(g) {
  const a = g.trail[0], b = g.trail[g.trail.length - 1], dt = Math.max(0.03, (b[0] - a[0]) / 1000), ring = g.ring;
  start();
  if (chosen?.ring === ring && chosen.mode === "tilt") {
    const dx = b[1] - a[1], dy = b[2] - a[2];
    if (Math.abs(dx) < 2 * Math.abs(dy)) return;                          // not across: not for tipping
    const n = Math.abs(dx) / dt < 500 * scale() ? 1 : Math.abs(dx) / dt < 1100 * scale() ? 2 : 3;
    if (setTip(S, ring, Math.sign(dx) * n)) sound.play("tip", { up: Math.sign(dx) });
  } else {
    const p = view.angleAt(ring, a[1], a[2]), q = view.angleAt(ring, b[1], b[2]);
    if (p == null || q == null) return;
    const w = between(p, q) / dt, level = Math.abs(w) < SWIPE[0] ? 1 : Math.abs(w) < SWIPE[1] ? 2 : 3;
    if (!w) return;
    setRing(S, ring, Math.sign(w) * level);                                // a swipe never stops a hoop (that's the middle button)
    choose(ring, "speed");
    sound.play("press", { strength: level });
  }
  drawAim(true);
  roll.draw();
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
  part(body, "about").append(line(`This game: ${fmt(S.score)}, ${plural(S.aligned, "line")} (${plural(S.fours, "four")}), ${plural(S.cleared, "planet")} cleared${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "orrery");
document.querySelector(".or-mark").innerHTML = APPS.find(a => a.id === "orrery").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", newRun);
$("slowerBtn").addEventListener("click", () => nudgeTempo(-1));
$("fasterBtn").addEventListener("click", () => nudgeTempo(1));
for (const [id, mode] of [["spinBtn", "speed"], ["tiltBtn", "tilt"]]) $(id).addEventListener("click", () => { if (chosen && !S.over && !IN_FRAME) { choose(chosen.ring, mode); sound.play("pick", { ring: chosen.ring }); } });
onPause(() => { paused = true; sound.hold(); swipes.clear(); save(); }, () => { paused = false; sound.release(); });

// for tests and debugging
window.__orrery = {
  get state() { return S; }, set state(g) { S = g; swipes.clear(); redrawOver(); drawTempo(); roll.reset(); }, view, newRun, start, stop,
  get running() { return running; },
  set frozen(v) { frozen = !!v; },
  get chosen() { return chosen; },
  choose, press, tapHoop, nudgeTempo,
  /** Plays `seconds` of the game at once (as the clock would), events and all. */
  advance(seconds) { for (let t = 0; t < seconds - 1e-9 && !S.over; t += 0.05) for (const ev of step(S, 0.05)) handle(ev); view.frame(S, 0); drawStrip(); drawSide(); roll.draw(); },
  /** Where a place is on the page, in the client coordinates a pointer event carries (the view's own are the canvas's). */
  seatOf(ring, place = 0) { const [x, y] = view.at(ring, (turnOf(S.rings[ring], S.t) + place) * STEP, 0), r = stage.getBoundingClientRect(); return [x + r.left, y + r.top]; },
  /** Where a hoop's angle is on the page. */
  spotOf(ring, angle) { const [x, y] = view.at(ring, angle, 0), r = stage.getBoundingClientRect(); return [x + r.left, y + r.top]; },
  TIP,
};

best = read(BEST, 0);
S = read(RUN, null);
if (!valid(S)) newRun();
else { redrawOver(); drawTempo(); roll.reset(); }
{ const c = read(CHOSEN, null); if (c && Number.isInteger(c.ring) && c.ring >= 0 && c.ring < S.rings.length && !S.over) choose(c.ring, c.mode === "tilt" ? "tilt" : "speed"); else choose(-1); }
requestAnimationFrame(tick);
