// Topple's lessons on the page: a dialog that shows one thing a table brings in as a small looping animation (the real
// hexagons, dominoes and enamels, the fall the engine itself works out, topple-lessons.js) with a line or two under it.
// Stand still, a finger pushes, the fall plays a step at a time in the engine's order, the score shows, and it starts over.
import { SIZE, CELLS, BALL, stepsOf, floorOf, at as cellAt } from "./topple-engine.js";
import { WATER } from "./topple-levels.js";
import { mid, flat, heading, yawOf, slabsEl, SH, floorName } from "./topple-slab.js";
import { tableParts } from "./topple-flat.js";
import { lessonById, playLesson, shown } from "./topple-lessons.js";

const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const STEP = 450, STEP_CALM = 1100, BALL_R = 0.22, DECK = 0.3;       // a step of the fall, in ms (a slow, still frame when the person asks for less motion)
const MIDOF = g => mid(...CELLS[g % SIZE]);
const pts = list => list.map(p => p.map(v => v.toFixed(3)).join(",")).join(" ");
const hexPts = (x, z, y, grow) => pts(Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + (k * Math.PI) / 3, r = grow / Math.sqrt(3); return flat(x + r * Math.cos(a), y, z + r * Math.sin(a)); }));
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A lesson drawn: { svg, frame(k) (shows the fall up to step k), reset(), hand (the finger's group, which shows and pushes),
 * score (the label), steps, floors (the floor buttons, or null) }. All of it is the engine's: where things stand, which fall
 * at which step and which way, where the balls roll.
 */
function draw(lesson) {
  const play = playLesson(lesson), { rules, cells, ax, mod, k, start } = play, keep = shown(lesson);
  const parts = tableParts(rules, keep), { ys, base } = parts;
  const svg = el("svg", { class: "tp-flatview tp-lsvg", "data-scene": rules.scene, "aria-hidden": "true", preserveAspectRatio: "xMidYMid meet" });
  const order = Array.from({ length: rules.layers }, (_, l) => l).sort((a, b) => ys[a] - ys[b]);
  const standing = new Map(), rolling = [];
  for (const l of order) {
    const layer = el("g"), slabs = [], balls = el("g");
    layer.append(...parts.kids[l]);
    for (const [q, r, f = 0] of lesson.ring || []) if (f === l) {
      const g = l * SIZE + cellAt(q, r), [x, z] = MIDOF(g);
      layer.append(el("polygon", { class: "tp-lring", points: hexPts(x, z, base[g], 0.96) }));
    }
    cells.forEach((c, i) => {
      if (c === -1 || floorOf(i) !== l) return;
      const [x, z] = MIDOF(i);
      if (c === BALL) {
        const [px, py] = flat(x, base[i] + BALL_R, z), g = el("g", { class: "tp-flat-ball" }, el("circle", { cx: px.toFixed(3), cy: py.toFixed(3), r: BALL_R, class: "body" }), el("circle", { cx: (px - 0.06).toFixed(3), cy: (py - 0.07).toFixed(3), r: 0.05, class: "shine" }));
        balls.append(g);
        rolling.push({ cell: i, g, at: [px, py] });
      } else slabs.push({ x, z, yaw: yawOf(ax[i] >= 0 ? ax[i] : 0), kind: c, cell: i, lift: base[i], plank: rules.terrain[i] === WATER, lv: true, mod: mod[i] });
    });
    layer.append(balls, slabsEl(slabs));
    svg.append(layer);
  }
  svg.append(el("g", {}, ...parts.links));
  for (const g of svg.querySelectorAll("[data-cell]")) standing.set(Number(g.dataset.cell), g);
  // each domino's tilt: along its way, as far as the game's own fall goes
  for (const [cell, , , way] of k.fell) {
    const [hx, hz] = heading(way), g = standing.get(cell);
    if (!g) continue;
    const [dx, dy] = flat(hx * 0.45, 0, hz * 0.45);
    g.style.setProperty("--dx", `${dx.toFixed(3)}px`); g.style.setProperty("--dy", `${dy.toFixed(3)}px`);
  }
  // a ball's way: the hexagon it has reached at each frame
  const rollOf = new Map(k.rolls.map(r => [r.from, r]));
  const place = (r, step) => {
    const b = rolling.find(x => x.cell === r.from);
    if (!b) return;
    if (step <= r.step) { b.g.style.transform = ""; b.g.classList.remove("lost", "sunk"); return; }
    const at = Math.min(step - r.step - 1, r.path.length - 1), heads = heading(2 * r.dir), spots = [r.from, ...r.path];
    let [x, z, y] = [...MIDOF(r.from), base[r.from]];
    for (let n = 1; n <= at + 1; n++) {
      const i = spots[n];
      if (i >= 0) [x, z, y] = [...MIDOF(i), base[i]]; else { x += heads[0]; z += heads[1]; }
    }
    const [px, py] = flat(x, y + BALL_R, z);
    b.g.style.transform = `translate(${(px - b.at[0]).toFixed(3)}px,${(py - b.at[1]).toFixed(3)}px)`;
    const last = at === r.path.length - 1;
    b.g.classList.toggle("lost", last && r.lost);
    b.g.classList.toggle("sunk", last && !r.lost && rules.terrain[r.end] === 4);
  };
  // the finger: out behind the first domino, an arrow along the way it is pushed, and the tip that slides along it
  const [sx, sz] = MIDOF(start), [hx, hz] = heading(play.way), y = base[start] + SH * 0.62;
  const from = flat(sx - hx * 0.95, y, sz - hz * 0.95), to = flat(sx - hx * 0.12, y, sz - hz * 0.12), len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const ux = (to[0] - from[0]) / len, uy = (to[1] - from[1]) / len, head = [[to[0], to[1]], [to[0] - ux * 0.2 - uy * 0.12, to[1] - uy * 0.2 + ux * 0.12], [to[0] - ux * 0.2 + uy * 0.12, to[1] - uy * 0.2 - ux * 0.12]];
  const line = { x1: from[0].toFixed(3), y1: from[1].toFixed(3), x2: to[0].toFixed(3), y2: to[1].toFixed(3) };
  const tip = el("circle", { class: "tip", cx: from[0].toFixed(3), cy: from[1].toFixed(3), r: 0.17 });
  tip.style.setProperty("--dx", `${(to[0] - from[0]).toFixed(3)}px`); tip.style.setProperty("--dy", `${(to[1] - from[1]).toFixed(3)}px`);
  const hand = el("g", { class: "tp-lhand" }, el("line", { ...line, class: "under" }), el("line", { ...line, class: "arm" }), el("polygon", { class: "head", points: pts(head) }), tip);
  svg.append(hand);
  // the score the knock came to, over the fallen: doubled, if it crossed or fell on gilding
  const fallen = k.fell.map(f => f[0]), mx = fallen.reduce((a, i) => a + MIDOF(i)[0], 0) / fallen.length, mz = fallen.reduce((a, i) => a + MIDOF(i)[1], 0) / fallen.length;
  const top = Math.max(...fallen.map(i => base[i])) + SH, [lx, ly] = flat(mx, top + 0.25, mz);
  const double = k.crossed || k.gilded;
  const score = el("text", { class: "tp-lscore", x: lx.toFixed(3), y: ly.toFixed(3) }, `+${k.gain.toLocaleString("en-US")}`);
  if (double) score.append(el("tspan", { class: "twice", dx: 0.12 }, "×2"));
  svg.append(score);
  // the view: every hexagon drawn, a floor's thickness and the tallest domino, with room over it for the score
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const g of keep) {
    const [x, z] = MIDOF(g), low = floorOf(g) ? ys[floorOf(g)] - DECK : 0;
    for (const [dx, dz] of [[-0.5, -0.58], [0.5, -0.58], [-0.5, 0.58], [0.5, 0.58]]) for (const h of [low, base[g] + SH]) {
      const [px, py] = flat(x + dx, h, z + dz);
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
  }
  y0 = Math.min(y0, ly - 0.55);
  svg.setAttribute("viewBox", `${(x0 - 0.3).toFixed(3)} ${(y0 - 0.2).toFixed(3)} ${(x1 - x0 + 0.6).toFixed(3)} ${(y1 - y0 + 0.4).toFixed(3)}`);
  // the floor buttons, where the lesson is about them: the game's own, the ground pressed to start with
  let floors = null;
  if (lesson.floors) {
    floors = document.createElement("div");
    floors.className = "tp-floors tp-lfloors";
    for (const l of [...order].reverse()) {
      const b = document.createElement("button");
      b.type = "button"; b.tabIndex = -1; b.dataset.floor = l; b.setAttribute("aria-pressed", String(l === 0)); b.textContent = floorName(rules, l, ys);
      floors.append(b);
    }
  }
  const standingAt = n => k.fell.filter(f => f[1] === n).map(f => standing.get(f[0]));
  return {
    svg, hand, score, floors, tip,
    steps: stepsOf(k.fell, k.rolls),
    /** Shows the fall as far as step n: the dominoes of that step tip over, the balls move on. */
    frame(n) { for (const g of standingAt(n)) g?.classList.add("down"); for (const r of k.rolls) place(r, n); },
    reset() {
      for (const g of standing.values()) g.classList.remove("down");
      for (const r of k.rolls) place(r, -1);
      hand.classList.remove("on", "pushed"); score.classList.remove("on");
      floors?.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.floor === "0")));
    },
  };
}

/** Plays a drawn lesson over and over in `box` until `stop()`. */
function animate(lesson, box) {
  const d = draw(lesson);
  box.replaceChildren(d.svg, ...(d.floors ? [d.floors] : []));
  let alive = true, timer = 0;
  const sleep = ms => new Promise(done => { timer = setTimeout(done, ms); });
  async function cycle() {
    const still = calm(), step = still ? STEP_CALM : STEP;
    box.classList.toggle("calm", still);
    d.svg.classList.add("snap"); d.reset(); void d.svg.getBoundingClientRect(); d.svg.classList.remove("snap");
    box.classList.remove("fading");
    await sleep(still ? 1400 : 1000); if (!alive) return;
    if (d.floors) {                                              // the person taps the upper floor's button
      d.floors.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.floor === "1")));
      await sleep(still ? 1400 : 900); if (!alive) return;
    }
    d.hand.classList.add("on");
    await sleep(still ? 1400 : 600); if (!alive) return;
    d.hand.classList.add("pushed");
    await sleep(still ? 0 : 350); if (!alive) return;
    for (let n = 0; n < d.steps; n++) { d.frame(n); await sleep(step); if (!alive) return; }
    d.score.classList.add("on");
    await sleep(still ? 2400 : 1800); if (!alive) return;
    box.classList.add("fading");
    await sleep(still ? 0 : 350);
  }
  (async () => { while (alive) await cycle(); })();
  return () => { alive = false; clearTimeout(timer); };
}

// ---------- the dialog ----------
let dlg = null, stop = null, shownIds = [], at = 0, onSeen = () => {};
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const parts = {};
function make() {
  dlg = document.createElement("dialog");
  dlg.className = "sheet menu-sheet pauses tp-lesson";
  dlg.setAttribute("aria-labelledby", "tpLessonTitle");
  dlg.innerHTML = `<div class="pick-head"><h2 id="tpLessonTitle"></h2><button class="icon-btn menu-x" type="button" aria-label="Close">${CLOSE}</button></div>
    <div class="tp-lbox" aria-hidden="true"></div>
    <p class="tp-ltext"></p>
    <div class="tp-lfoot"><span class="tp-lcount"></span><button class="tp-go" type="button"></button></div>`;
  document.body.append(dlg);
  Object.assign(parts, { title: dlg.querySelector("h2"), box: dlg.querySelector(".tp-lbox"), text: dlg.querySelector(".tp-ltext"), count: dlg.querySelector(".tp-lcount"), go: dlg.querySelector(".tp-go") });
  dlg.querySelector(".menu-x").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  parts.go.addEventListener("click", () => { if (at < shownIds.length - 1) { at++; render(); } else dlg.close(); });
  dlg.addEventListener("close", () => { stop?.(); stop = null; parts.box.replaceChildren(); onSeen(shownIds); });
}
function render() {
  const lesson = lessonById(shownIds[at]);
  parts.title.textContent = lesson.title;
  parts.text.textContent = lesson.text;
  parts.count.textContent = shownIds.length > 1 ? `${at + 1} of ${shownIds.length}` : "";
  parts.go.textContent = at < shownIds.length - 1 ? "Next" : "Got it";
  stop?.();
  stop = animate(lesson, parts.box);
}
/** Whether a lesson is on the screen. */
export const lessonOpen = () => !!dlg?.open;
/** Opens the lessons with these ids (in order, "1 of 3" when there are several); `seen(ids)` is told which when it closes. */
export function showLessons(ids, seen = () => {}) {
  const list = ids.filter(id => lessonById(id));
  if (!list.length || lessonOpen()) return false;
  if (!dlg) make();
  shownIds = list; at = 0; onSeen = seen;
  render();
  dlg.showModal();
  return true;
}
