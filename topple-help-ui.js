// Topple's feature help on the page: a dialog that explains a feature in a few lines with a little looping scene, drawn
// as the game draws its table (topple-flat.js's terrain, topple-slab.js's slabs) on a handful of hexagons, whose dominoes
// fall in the order the engine gives (topple-help.js runs the scenes; nothing here decides what falls). The dialog
// pauses the game while it is open (the class `pauses`, menu.js). With "reduce motion" the scenes are still pictures of
// the end of the fall, each domino numbered by the step it fell at, side by side.
import { tableParts } from "./topple-flat.js";
import { slabsEl, mid, flat, heading, yawOf, SH } from "./topple-slab.js";
import { CELLS, SIZE, BALL } from "./topple-engine.js";
import { WATER } from "./topple-levels.js";
import { featureOf, runScene, verdictOf, marksOf } from "./topple-help.js";

const SVG = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// the pace of a scene, slower than the game's so each fall can be followed: a step apart, a fall's length, the stand before
// it and the hold after it (milliseconds)
const STEP = 380, FALL = 520, LEAD = 900, HOLD = 1700;
const BALL_R = 0.22, DECK = 0.3;
const hexMid = i => mid(...CELLS[i % SIZE]);

/** The end of a domino's fall as a transform: it lies a little way along its way, squashed. */
const lying = way => { const [hx, hz] = heading(way), [dx, dy] = flat(hx * 0.45, 0, hz * 0.45); return `translate(${dx}px,${dy}px) scaleY(.2)`; };
/** The points a ball rolls through as the drawing sees them, from where it lay along its path (a lost one runs on past the last). */
function rollPoints(r, base) {
  const [hx, hz] = heading(2 * r.dir), at = [];
  for (const i of [r.from, ...r.path]) at.push(i >= 0 ? [...hexMid(i), base[i]] : [at.at(-1)[0] + hx, at.at(-1)[1] + hz, at.at(-1)[2]]);
  return at.map(([x, z, y]) => flat(x, y + BALL_R, z));
}

/**
 * A scene as a picture: { el (the frame), play() (starts the falls; returns how long they take), reset() (stands it up again) }.
 * `still` draws the end of the fall at once, the steps numbered.
 */
function frameOf(run, still) {
  const { rules } = run, shown = new Set(run.shown), { ys, base, kids, links } = tableParts(rules, shown);
  const floors = [...new Set(run.shown.map(i => Math.floor(i / SIZE)))].sort((a, b) => ys[a] - ys[b]);
  const world = svgEl("g"), balls = new Map(), numbers = svgEl("g", { class: "tp-hsteps" });
  for (const l of floors) {
    const g = svgEl("g"), ballsHere = svgEl("g"), list = [];
    for (const i of run.shown) {
      if (Math.floor(i / SIZE) !== l) continue;
      const c = run.cells[i], [x, z] = hexMid(i);
      if (c === BALL) {
        const [px, py] = flat(x, base[i] + BALL_R, z), ball = svgEl("g", { class: "tp-flat-ball" });
        ball.append(svgEl("circle", { cx: px, cy: py, r: BALL_R, class: "body" }), svgEl("circle", { cx: px - 0.06, cy: py - 0.07, r: 0.05, class: "shine" }));
        balls.set(i, ball);
        ballsHere.append(ball);
      } else if (c >= 0) list.push({ x, z, yaw: yawOf(run.ax[i]), kind: c, cell: i, lift: base[i], plank: rules.terrain[i] === WATER, lv: true, mod: run.mod[i] });
    }
    g.append(...kids[l], ballsHere, slabsEl(list));
    world.append(g);
  }
  world.append(...links, numbers);
  // the view: just the hexagons shown, with room for the slabs standing on them and an upper floor's thickness
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const take = ([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  for (const i of run.shown) {
    const [x, z] = hexMid(i);
    for (const [dx, dz] of [[-0.58, -0.58], [0.58, -0.58], [-0.58, 0.58], [0.58, 0.58]]) take(flat(x + dx, base[i] - (i >= SIZE ? DECK : 0), z + dz));
    take(flat(x, base[i] + SH + 0.3, z));
  }
  const pad = 0.2, svg = svgEl("svg", { class: "tp-flatview tp-hsvg", "data-scene": rules.scene, viewBox: `${(x0 - pad).toFixed(3)} ${(y0 - pad).toFixed(3)} ${(x1 - x0 + 2 * pad).toFixed(3)} ${(y1 - y0 + 2 * pad).toFixed(3)}`, role: "img", "aria-hidden": "true" });
  svg.append(world);
  const frame = el("div", "tp-hframe"), cap = el("span", "tp-hcap", run.scene.caption || verdictOf(run)), marks = el("span", "tp-hmarks", marksOf(run).join("  "));
  frame.append(svg, cap, marks);
  const slabs = new Map([...svg.querySelectorAll("[data-cell]")].map(g => [Number(g.dataset.cell), g]));
  for (const g of slabs.values()) { g.style.transformBox = "fill-box"; g.style.transformOrigin = "50% 100%"; }
  let anims = [], markTimer = 0;
  const lay = (g, way) => { g.style.transform = lying(way); };
  const roll = r => {
    const g = balls.get(r.from);
    if (!g || !r.path.length) return null;
    const pts = rollPoints(r, base), [px, py] = pts[0], last = pts.length - 1;
    const pose = k => `translate(${pts[k][0] - px}px,${pts[k][1] - py}px)`;
    return { g, pose, last, lost: r.lost, frames: pts.map((_, k) => ({ transform: pose(k), opacity: r.lost && k === last ? 0 : 1, offset: k / last })) };
  };
  const rolls = run.rolls.map(r => ({ r, roll: roll(r) })).filter(x => x.roll);
  marks.hidden = !marks.textContent;
  cap.hidden = !cap.textContent;
  if (still) {
    for (const [cell, step, , way] of run.fell) {
      lay(slabs.get(cell), way);
      const [x, z] = hexMid(cell), [tx, ty] = flat(x, base[cell] + SH + 0.2, z), t = svgEl("text", { x: tx, y: ty, "text-anchor": "middle", "font-size": "0.3" });
      t.textContent = step + 1;
      numbers.append(t);
    }
    for (const { roll: b } of rolls) { b.g.style.transform = b.pose(b.last); if (b.lost) b.g.style.opacity = 0; }
    return { el: frame, play: () => 0, reset() {} };
  }
  marks.classList.add("late");
  return {
    el: frame,
    play() {
      let total = 0;
      for (const [cell, step, , way] of run.fell) {
        const g = slabs.get(cell);
        if (!g?.animate) continue;
        anims.push(g.animate([{ transform: "translate(0,0) scaleY(1)" }, { transform: lying(way) }], { duration: FALL, delay: step * STEP, easing: "ease-in", fill: "forwards" }));
        total = Math.max(total, step * STEP + FALL);
      }
      for (const { r, roll: b } of rolls) {
        if (!b.g.animate) continue;
        const ms = (r.path.length + 1) * STEP * 0.7;
        anims.push(b.g.animate(b.frames, { duration: ms, delay: r.step * STEP, easing: "ease-out", fill: "forwards" }));
        total = Math.max(total, r.step * STEP + ms);
      }
      markTimer = setTimeout(() => marks.classList.add("on"), total * 0.8);      // the marks of the knock appear as the last domino goes down
      return total;
    },
    reset() {
      clearTimeout(markTimer);
      for (const a of anims) a.cancel();
      anims = [];
      marks.classList.remove("on");
    },
  };
}

/**
 * The help dialog. `dialog` holds #tpHelpName, #tpHelpStage, #tpHelpText, #tpHelpAt, #tpHelpBack, #tpHelpNext and
 * #tpHelpClose (topple.html); `seen()` gives the ids already explained and `mark(ids)` keeps more; `allowed()` says
 * whether help may show at all (never in a watching frame, never in Classic).
 */
export function createHelp({ dialog, seen, mark, allowed }) {
  const $ = id => dialog.querySelector(`#${id}`), stage = $("tpHelpStage");
  let queue = [], at = 0, timer = 0, stopped = true, frames = [];
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Stops the scene playing: its timers, its falls. */
  function stop() {
    stopped = true;
    clearTimeout(timer);
    for (const f of frames) f.reset();
    frames = [];
  }
  /** The scenes of the entry on show, looping: stand, fall, hold, stand again, and the next scene of the entry if it has one. */
  function play(entry) {
    stop();
    const runs = entry.scenes.map(runScene), reduced = still();
    frames = runs.map(run => frameOf(run, reduced));
    stage.replaceChildren(...frames.map(f => f.el));
    stage.classList.toggle("still", reduced);
    stage.setAttribute("aria-label", `${entry.name}: ${runs.map(verdictOf).filter(Boolean).join(", ")}`.replace(/: $/, ""));
    if (reduced) return;
    stopped = false;
    let k = 0;
    const next = () => {
      if (stopped) return;
      frames.forEach((f, n) => { f.el.hidden = n !== k % frames.length; f.reset(); });
      timer = setTimeout(() => {
        if (stopped) return;
        const ms = frames[k % frames.length].play();
        timer = setTimeout(() => { k++; next(); }, ms + HOLD);
      }, LEAD);
    };
    next();
  }
  function show(n) {
    at = Math.max(0, Math.min(queue.length - 1, n));
    const entry = featureOf(queue[at]);
    $("tpHelpName").textContent = entry.name;
    $("tpHelpText").replaceChildren(...entry.lines.map(t => el("p", null, t)));
    $("tpHelpAt").textContent = queue.length > 1 ? `${at + 1} of ${queue.length}` : "";
    $("tpHelpBack").disabled = at === 0;                          // kept in its place, unseen, so Next stays where the thumb found it
    $("tpHelpNext").textContent = at === queue.length - 1 ? "Got it" : "Next";
    play(entry);
  }
  $("tpHelpBack").addEventListener("click", () => show(at - 1));
  $("tpHelpNext").addEventListener("click", () => { if (at >= queue.length - 1) dialog.close(); else show(at + 1); });
  $("tpHelpClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });          // outside the sheet
  dialog.addEventListener("close", stop);
  return {
    isOpen: () => dialog.open,
    /** Opens the dialog on these features, in order; those not yet seen are kept as seen. False if help may not show or there is nothing to say. */
    open(ids) {
      const list = ids.filter(id => featureOf(id));
      if (!list.length || !allowed()) return false;
      queue = list;
      mark(list.filter(id => !seen().includes(id)));
      if (!dialog.open) dialog.showModal();
      show(0);
      return true;
    },
  };
}
