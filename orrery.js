// Orrery: four brass hoops on an axle round a sun, planets of four colours strung on them (orrery-3d.js draws it; flat,
// in orrery-flat.js, where there's no WebGL), stepping on a beat. Tap a hoop to choose it (tap it again to let it go),
// and the nine buttons under the orrery send it a place round every third beat, every second, every beat or two places
// every beat, clockwise as the hoop is seen on the right and anticlockwise on the left, or stand it still in the middle.
// Under them, always there, the four colours: a press of one tips every hoop into that colour's plane at once, and each
// shows the hoops in its plane now. A swipe along a hoop sets it going the way the finger went, quicker by how fast. −
// and + set the tempo, from 20 beats a minute to 60; a metronome swings with it, and a bar of the beats coming shows
// which hoops step on which, and when each next tips a step by itself (its drift), and which way. Three or four planets
// of one colour on hoops standing still, in one direction from the sun, are a line (at twelve or six o'clock any colour
// at any tips; anywhere else on hoops in the colour's plane), and the next beat strikes it; a new planet lands every few
// seconds, quicker as the game goes on; when there is no place for one, it is over. The rules are orrery-engine.js's;
// this file runs the clock, takes the taps, buttons and swipes and keeps the game. The clock starts at the first hoop
// chosen or button pressed and stops with the menu, with the tab and with the game over.
import { RINGS, STEP, TEMPOS, FIRST_TEMPO, TIP, SPIN, PLANE, COMBO_WINDOW, newGame, valid, copy, setRing, setPlane, setTempo, step, between, room, multiplier, period, upcoming, turnOf, planeOf } from "./orrery-engine.js";
import { createOrrery } from "./orrery-3d.js";
import { createFlat, planetSvg } from "./orrery-flat.js";
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
const FUSE = 5;                                             // seconds before a drift that its hoop's number shows it coming, as a fuse burning down
const DEG = Math.PI / 180;
/** The enamels' plain names, as the line says them, in the order of the colours (and of their planes, left to right). */
const COLOUR = ["yellow", "green", "blue", "red"];

let S = null;            // the game (orrery-engine.js's), as saved
let running = false;     // the clock going: from the first hoop chosen or button pressed
let paused = false;      // the menu, the rules or the games screen open
let best = 0;            // the best score, as stored
let chosen = null;       // the hoop the buttons are for: { ring }, or null
const swipes = new Map();// fingers down: pointer id -> { ring (-1: on the sky), x0, y0, x, y, moved, trail }
let savedAt = 0;
let frozen = false;      // for tests: the clock held while a picture is taken

// Bests from earlier orreries mean nothing here, so they go to keys of their own: the turn-based game's to orrery:turns
// (era 2), the game of set speeds and five hoops (version 3) to orrery:speeds (era 3), and the game on a beat whose hoops
// tipped alike lined up any colour and never drifted (version 4) to orrery:alike (era 4). The first games' rules show again.
if (!IN_FRAME && read(ERA, 0) < 4) {
  const era = read(ERA, 0), old = read(BEST, 0);
  if (old) write(era < 2 ? "orrery:turns" : era < 3 ? "orrery:speeds" : "orrery:alike", old);
  write(BEST, 0);
  try { localStorage.removeItem(SEEN); } catch { /* private mode */ }
  write(ERA, 4);
}

sound.on = read(SOUND, true);
const stage = $("stage");
let view;
try { view = createOrrery(stage); }
catch (err) {
  console.warn("Orrery: no WebGL here, so the orrery is drawn flat.", err);
  view = createFlat(stage);
}
{ const v = read(VIEW, null); if (Array.isArray(v)) view.setView(v[0], v[1]); }

/**
 * Which way a hoop's own turn (its places counted on: what the engine calls a step right) looks on the screen now: 1
 * clockwise, -1 anticlockwise, from its twelve and three o'clock round the sun crossed (screen y runs down, so positive
 * is clockwise). The camera goes round the orrery and the hoops tip, so it's asked each time: the buttons and arrows
 * mean round as the hoop is seen, the right-hand ones clockwise, from wherever it's seen.
 */
function looks(ring) {
  const [cx, cy] = view.sunAt(), [x1, y1] = view.at(ring, 0), [x2, y2] = view.at(ring, Math.PI / 2);
  return (x1 - cx) * (y2 - cy) - (y1 - cy) * (x2 - cx) >= 0 ? 1 : -1;
}
/**
 * A curled arrow, for a hoop sent round: one to three chevrons (the rhythm, three for every beat) on an arc over the top,
 * clockwise or anticlockwise, and for two places every beat the three with lines of speed trailing the curl; drawn in a
 * box 30 by 24 put at (x, y) and scaled by k. { arc (the curl and its lines, drawn lighter), heads }, path data.
 */
function curl(n, cw, x = 0, y = 0, k = 1) {
  const R = 10, cx = 15, cy = 16, f = cw ? 1 : -1, sweep = cw ? 1 : 0, HEAD = -20, APART = 42;  // degrees, from three o'clock; the chevrons this far apart stand clear of each other
  const at = (deg, back = 0, inward = 0) => {
    const a = deg * DEG, tx = -Math.sin(a), ty = Math.cos(a);
    const px = cx + R * Math.cos(a) - back * tx - inward * ty, py = cy + R * Math.sin(a) - back * ty + inward * tx;
    return `${(x + k * (15 + f * (px - 15))).toFixed(2)} ${(y + k * py).toFixed(2)}`;
  };
  const r = v => (v * k).toFixed(2);
  let arc = `M${at(-195)}A${r(R)} ${r(R)} 0 0 ${sweep} ${at(HEAD)}`;
  if (n > 3) arc += `M${at(-200, 0, 2.6)}A${r(R - 2.6)} ${r(R - 2.6)} 0 0 ${sweep} ${at(-150, 0, 2.6)}M${at(-200, 0, -2.6)}A${r(R + 2.6)} ${r(R + 2.6)} 0 0 ${sweep} ${at(-160, 0, -2.6)}`;
  const heads = Array.from({ length: Math.min(3, n) }, (_, i) => { const d = HEAD - APART * i; return `M${at(d, 3.4, 3.2)}L${at(d)}L${at(d, 3.4, -3.2)}`; }).join("");
  return { arc, heads };
}

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
const nums = Array.from({ length: RINGS }, (_, k) => {
  const disc = el("circle", { class: "or-badge" }), fuse = el("path", { class: "or-fuse" }), t = el("text", { class: "or-num" }), go = el("path", { class: "or-going" });
  t.textContent = String(k + 1);
  numsG.append(disc, fuse, t, go);
  return { disc, fuse, t, go, at: [0, 0], burning: "" };
});
let numsAt = "";
/** An arc round (x, y) of radius r from twelve o'clock clockwise, `u` of the way round (0 to 1): a fuse burning down. */
function arcPath(x, y, r, u) {
  if (u <= 0) return "";
  if (u >= 0.999) return `M${x.toFixed(1)} ${(y - r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 0 ${(2 * r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 0 ${(-2 * r).toFixed(1)}`;
  const a = u * 2 * Math.PI, ex = x + r * Math.sin(a), ey = y - r * Math.cos(a);
  return `M${x.toFixed(1)} ${(y - r).toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 ${u > 0.5 ? 1 : 0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}
/**
 * The hoops' numbers by their knuckles at six o'clock (a point no tip moves), each on a disc of its colour's enamel while
 * the hoop is in that colour's plane, and beside each hoop set going its setting as the buttons draw it (curled the way
 * it goes round, as it's seen): a hoop set going makes no line, even standing on its place between steps, so it shows on
 * the orrery. In the last seconds before a hoop drifts, a fuse burns down round its number. The places are worked out
 * again only when the view or a setting has changed; the fuses every frame they burn.
 */
function drawNums() {
  const u = scale(), at = nums.map((_, k) => view.at(k, Math.PI, 0)), seen = nums.map((_, k) => looks(k));
  const k = `${at.flat().map(v => v.toFixed(0)).join()}|${seen.join()}|${chosen?.ring ?? -1}|${u}|${S.rings.map(r => `${r.set},${r.tip}`).join()}|${S.over}`;
  if (k !== numsAt) {
    numsAt = k;
    nums.forEach((n, ring) => {
      const r = S.rings[ring], x = at[ring][0] + 15 * u, y = at[ring][1] + 13 * u, c = planeOf(r.tip);    // clear of a planet standing at six o'clock
      n.at = [x + 2.6 * u, y - 3.4 * u];
      n.t.setAttribute("x", n.at[0].toFixed(1));
      n.t.setAttribute("y", y.toFixed(1));
      n.t.setAttribute("font-size", (9.5 * u).toFixed(1));
      n.t.setAttribute("class", `or-num${ring === chosen?.ring ? " on" : ""}${c >= 0 ? ` in k${c}` : ""}`);
      n.disc.setAttribute("cx", n.at[0].toFixed(1));
      n.disc.setAttribute("cy", n.at[1].toFixed(1));
      n.disc.setAttribute("r", (6.6 * u).toFixed(1));
      n.disc.setAttribute("class", `or-badge${c >= 0 ? ` k${c}` : ""}${ring === chosen?.ring ? " on" : ""}`);
      const g = r.set && curl(Math.abs(r.set), r.set * seen[ring] > 0, x + 9 * u, y - 12.5 * u, 0.55 * u);
      n.go.setAttribute("d", g ? g.arc + g.heads : "");
    });
  }
  nums.forEach((n, ring) => {
    const left = S.rings[ring].driftAt - S.t, d = S.over || left > FUSE ? "" : arcPath(n.at[0], n.at[1], 9 * u, left / FUSE);
    if (d !== n.burning) { n.burning = d; n.fuse.setAttribute("d", d); }
  });
}
const HINT = ["Tap a hoop, then a button of the top row: it steps on", "the beat, every third beat up to two places a beat.", "Stop the hoops with planets of a colour in line with", "the sun: at twelve or six o'clock any colour; elsewhere", "only on hoops in that colour's plane. A colour below tips", "every hoop into its plane; now and then each hoop drifts", "a tip by itself. − and + set the beat."];
/** The words over the orrery while the clock is stopped: the first games' rules, then only how to go on. */
function redrawOver() {
  const w = over.clientWidth || stage.clientWidth, h = over.clientHeight || stage.clientHeight;
  over.setAttribute("viewBox", `0 0 ${w} ${h}`);
  if (!S || running || S.over || IN_FRAME) { plaqueG.replaceChildren(); return; }
  const first = !read(SEEN, false), head = S.t > 0 ? "Tap a hoop to go on" : "Tap a hoop to begin", rows = first ? [...HINT, head] : [head];
  const u = scale(), lh = 15 * u, bw = (first ? 338 : 216) * u, bh = rows.length * lh + 24 * u, y0 = h / 2 - bh / 2;
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
 * The bar of beats: a row for each hoop and a column for each of the next six beats, a chevron where the hoop steps (and
 * which way; doubled for two places), a dot where it's set going but waits. On each beat the bar moves on a column under
 * the brass line, like a music box's barrel past its comb, and the line flashes. At the right, for each hoop, the
 * seconds to its next drift and which way it will tip (up or down, in the enamel of the plane it tips into, if it's one).
 */
const roll = (() => {
  const box = $("roll"), track = document.createElement("div"), names = document.createElement("div"), win = document.createElement("div"), drifts = document.createElement("div");
  names.className = "or-roll-names"; win.className = "or-roll-window"; track.className = "or-roll-track"; drifts.className = "or-roll-drift";
  for (let k = 0; k < RINGS; k++) { const n = document.createElement("span"); n.textContent = String(k + 1); names.append(n); }
  const due = Array.from({ length: RINGS }, () => { const d = document.createElement("span"), w = document.createElement("i"), t = document.createElement("b"); d.append(w, t); drifts.append(d); return { d, w, t }; });
  win.append(track);
  box.append(names, win, drifts);
  const cells = Array.from({ length: RINGS * (AHEAD + 1) }, (_, i) => { const c = document.createElement("i"); c.style.gridRow = String(Math.floor(i / (AHEAD + 1)) + 1); c.style.gridColumn = String((i % (AHEAD + 1)) + 1); track.append(c); return c; });
  let key = "", dueKey = "", played = null;
  /** Draws the beats: column 0 is the one just played (it slides out past the line), 1 to AHEAD the ones coming. */
  function draw(slide = false) {
    const ahead = upcoming(S, AHEAD), cols = [played ?? S.rings.map(() => 0), ...ahead], seen = S.rings.map((_, ring) => looks(ring));
    const k = JSON.stringify([cols, seen, chosen?.ring ?? -1, S.rings.map(r => [r.set, r.tip])]);
    if (k !== key || slide) {
      key = k;
      cols.forEach((col, c) => col.forEach((d, ring) => {
        const going = S.rings[ring].set !== 0, round = d * seen[ring];          // r: clockwise as it's seen, as the right-hand buttons send it
        cells[ring * (AHEAD + 1) + c].className = round > 0 ? `st r${round > 1 ? " two" : ""}` : round < 0 ? `st l${round < -1 ? " two" : ""}` : going && c > 0 ? "rest" : "";
      }));
      [...names.children].forEach((n, ring) => { const p = planeOf(S.rings[ring].tip); n.className = `${ring === chosen?.ring ? "on" : ""}${p >= 0 ? ` in k${p}` : ""}`; });
      box.querySelectorAll(".row-on").forEach(n => n.classList.remove("row-on"));
      if (chosen) for (let c = 0; c <= AHEAD; c++) cells[chosen.ring * (AHEAD + 1) + c].classList.add("row-on");
    }
    const dk = S.rings.map(r => `${Math.max(0, Math.ceil(r.driftAt - S.t - 1e-6))},${r.way},${r.tip}`).join("|") + S.over;
    if (dk !== dueKey) {
      dueKey = dk;
      S.rings.forEach((r, ring) => {
        const left = Math.max(0, Math.ceil(r.driftAt - S.t - 1e-6)), into = planeOf(r.tip + r.way), { d, w, t } = due[ring];
        t.textContent = S.over ? "" : String(left);
        w.className = S.over ? "" : `${r.way > 0 ? "up" : "down"}${into >= 0 ? ` k${into}` : ""}`;
        d.className = !S.over && left <= FUSE ? "soon" : "";
      });
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
    beat(ev) { played = S.rings.map((_, ring) => ev.stepped.find(x => x.ring === ring)?.by ?? 0); draw(true); },
    reset() { played = null; key = ""; dueKey = ""; draw(); },
  };
})();

// ---------- the hoop chosen and its spin, and the colours ----------
const SPINS = Array.from({ length: 2 * SPIN + 1 }, (_, k) => k - SPIN);
const RHYTHM = ["still", "every third beat", "every second beat", "every beat", "two places every beat"];
const SAID = ["still", "every 3rd beat", "every 2nd beat", "every beat", "2 places a beat"];   // the line's shorter words for them, to fit a phone's width in every theme
const SPIN_WORDS = SPINS.map(k => (k ? `${RHYTHM[Math.abs(k)].replace(/^./, c => c.toUpperCase())} ${k > 0 ? "clockwise" : "anticlockwise"}` : "Still"));
const degrees = tip => (tip ? `${tip > 0 ? "+" : "−"}${Math.abs(tip) * 15}°` : "level");
/** A spin button's picture: one to three chevrons curled the way it sends a hoop round (the right-hand ones clockwise), lines of speed for two places a beat, a square for still. */
function spinGlyph(level) {
  if (level === 0) return '<rect class="fill" x="9" y="6" width="12" height="12" rx="1.5"/>';
  const { arc, heads } = curl(Math.abs(level), level > 0);
  return `<path class="arc" d="${arc}"/><path d="${heads}"/>`;
}
/**
 * A colour button's picture: the colour's planet, its mark and all, on a hoop seen edge on at the tilt of its plane, as
 * it's seen (`lean` -1 with the camera round behind, where a hoop's three o'clock side is on the left).
 */
const planeGlyph = (c, lean = 1) => `<g transform="rotate(${-PLANE[c] * lean * 15})"><path class="hoop" d="M-17 0H17"/></g><g class="or-planet k${c}">${planetSvg(c, 6.4)}</g>`;
/** Which side of the sun the hoops' three o'clock (the side a positive tip lifts) is on the screen: 1 the right, -1 the left. */
let lean = 1;
function leans() {
  const [cx] = view.sunAt(), [x] = view.at(RINGS - 1, Math.PI / 2), d = x - cx;
  if (Math.abs(d) > 4) lean = d > 0 ? 1 : -1;                              // seen from the side, it's neither: keep the last
  return lean;
}
const spinKeys = SPINS.map(level => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `or-key${level === 0 ? " hold" : ""}`;
  b.innerHTML = `<svg viewBox="0 0 30 24" aria-hidden="true">${spinGlyph(level)}</svg>`;
  b.addEventListener("click", () => press("spin", level));
  $("spinPad").append(b);
  return b;
});
/** The four colours, under the spin: each with the hoops in its plane now (1 to 4, lit when in). */
const colourKeys = PLANE.map((_, c) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `or-ckey k${c}`;
  b.innerHTML = `<svg viewBox="-22 -13 44 26" aria-hidden="true"></svg><span class="slots" aria-hidden="true">${Array.from({ length: RINGS }, (_, k) => `<i>${k + 1}</i>`).join("")}</span>`;
  b.addEventListener("click", () => press("colour", c));
  $("colourPad").append(b);
  return b;
});
/** The hoops in a colour's plane now, by number. */
const inPlane = c => S.rings.flatMap((r, k) => (r.tip === PLANE[c] ? [k + 1] : []));
const listed = ns => (ns.length > 1 ? `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}` : String(ns[0]));
/** The colours: each lights the hoops in its plane, and stands pressed while all four are (a drift dims one again). */
function drawColours() {
  const side = leans(), k = `${S.rings.map(r => r.tip).join()}|${side}|${S.over}`;
  if (shown.colours === k) return;
  shown.colours = k;
  if (shown.lean !== side) { shown.lean = side; colourKeys.forEach((b, c) => { b.firstElementChild.innerHTML = planeGlyph(c, side); }); }
  colourKeys.forEach((b, c) => {
    const ins = inPlane(c), now = ins.length === RINGS ? "every hoop in it now" : ins.length ? `hoop${ins.length > 1 ? "s" : ""} ${listed(ins)} in it now` : "";
    const words = `${COLOUR[c].replace(/^./, x => x.toUpperCase())}'s plane, ${degrees(PLANE[c])}: tip every hoop into it${now ? ` (${now})` : ""}`;
    b.disabled = S.over;
    b.setAttribute("aria-pressed", String(ins.length === RINGS));
    b.setAttribute("aria-label", words);
    b.title = words;
    [...b.lastElementChild.children].forEach((n, ring) => n.classList.toggle("in", ins.includes(ring + 1)));
  });
}
/** The hoop chosen: its spin's buttons, and the line saying how it goes round and how it's tipped. */
function drawAim(force = false) {
  const r = chosen && !S.over ? S.rings[chosen.ring] : null, seen = r ? looks(chosen.ring) : 1;
  const k = `${r ? chosen.ring : -1}|${r ? `${r.set},${r.tip},${seen}` : ""}|${S.over}`;
  if (!force && shown.aim === k) return;
  shown.aim = k;
  $("controls").classList.toggle("gone", S.over);
  $("result").hidden = !S.over;
  const spin = r ? r.set * seen : null;                                     // the setting as its button stands for it, round as it's seen
  spinKeys.forEach((b, i) => {
    b.disabled = !r;
    b.setAttribute("aria-pressed", String(spin === SPINS[i]));
    b.setAttribute("aria-label", SPIN_WORDS[i]);
    b.title = SPIN_WORDS[i];
  });
  if (!r) { $("line").textContent = S.over ? "" : "Tap a hoop to choose it"; return; }
  const c = planeOf(r.tip);
  $("line").innerHTML = `Hoop <b>${chosen.ring + 1}</b> · ${r.set ? `${spin > 0 ? "↻" : "↺"} ${SAID[Math.abs(r.set)]}` : "still"} · ${c >= 0 ? `${degrees(r.tip)}, <span class="in k${c}">in ${COLOUR[c]}'s plane</span>` : r.tip ? `tipped ${degrees(r.tip)}` : "level"}`;
}
function drawSide() {
  drawAim();
  drawColours();
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
    if (ev.stepped.length) sound.play("step", { n: ev.stepped.reduce((n, x) => n + Math.abs(x.by), 0) });
    roll.beat(ev);
    tickArm();
  } else if (ev.type === "land") sound.play("land", { ring: ev.ring, pan: Math.sin((S.rings[ev.ring].a + ev.place) * STEP) * 0.5 });
  else if (ev.type === "drift") sound.play("drift", { up: Math.sign(ev.tip - ev.from), ring: ev.ring });
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
/** Chooses a hoop (-1: none) for the buttons; the page and the picture both show it. */
function choose(ring) {
  chosen = ring < 0 ? null : { ring };
  if (!IN_FRAME) write(CHOSEN, chosen);
  view.select(ring);
  drawAim(true);
  roll.draw();
}
/** A tap on a hoop: it's chosen; tapped again, it's let go (both rows of buttons are for it already, so a second tap has nothing else to do). */
function tapHoop(ring) {
  if (S.over) return;
  start();
  const again = chosen?.ring === ring;
  choose(again ? -1 : ring);
  sound.play("pick", { ring, power: again ? 0.3 : 0.5 });
}
/** A button: the chosen hoop set going at the rhythm it stands for (`spin`), or every hoop tipped into a colour's plane (`colour`, with or without a hoop chosen). */
function press(kind, value) {
  if (S.over || paused || IN_FRAME || (kind === "spin" && !chosen)) return;
  sound.unlock();
  start();
  if (kind === "spin") {
    setRing(S, chosen.ring, value * looks(chosen.ring));                   // the right-hand buttons clockwise as the hoop is seen now
    sound.play("press", { strength: Math.abs(value) });
  } else {
    const before = S.rings.reduce((n, r) => n + r.tip, 0);
    if (setPlane(S, value)) sound.play("tip", { up: Math.sign(PLANE[value] * RINGS - before) });
    sound.play("press", { strength: 2 });
  }
  drawAim(true);
  drawColours();
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
/** How fast a finger goes round the sun, radians a second, at which a swipe along a hoop sets it going every second beat, every beat and two places every beat (slower than the first, every third). */
const SWIPE = [1.2, 3, 6];
/** A finger lifted after moving on a hoop: the way and the speed it went round set the hoop going, and choose it. */
function swipe(g) {
  const a = g.trail[0], b = g.trail[g.trail.length - 1], dt = Math.max(0.03, (b[0] - a[0]) / 1000), ring = g.ring;
  start();
  const p = view.angleAt(ring, a[1], a[2]), q = view.angleAt(ring, b[1], b[2]);
  if (p == null || q == null) return;
  const w = between(p, q) / dt, fast = Math.abs(w), level = 1 + SWIPE.filter(x => fast >= x).length;
  if (!w) return;
  setRing(S, ring, Math.sign(w) * level);                                  // a swipe never stops a hoop (that's the middle button)
  choose(ring);
  sound.play("press", { strength: level });
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
onPause(() => { paused = true; sound.hold(); swipes.clear(); save(); }, () => { paused = false; sound.release(); });

// for tests and debugging
window.__orrery = {
  get state() { return S; }, set state(g) { S = g; swipes.clear(); redrawOver(); drawTempo(); roll.reset(); }, view, newRun, start, stop,
  get running() { return running; },
  set frozen(v) { frozen = !!v; },
  get chosen() { return chosen; },
  choose, press, tapHoop, nudgeTempo, looks,
  /** Plays `seconds` of the game at once (as the clock would), events and all. */
  advance(seconds) { for (let t = 0; t < seconds - 1e-9 && !S.over; t += 0.05) { for (const ev of step(S, 0.05)) handle(ev); view.frame(S, 0.05, false); } view.frame(S, 0); drawStrip(); drawSide(); drawNums(); roll.draw(); },
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
{ const c = read(CHOSEN, null); if (c && Number.isInteger(c.ring) && c.ring >= 0 && c.ring < S.rings.length && !S.over) choose(c.ring); else choose(-1); }
requestAnimationFrame(tick);
