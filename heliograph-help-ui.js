// Heliograph's feature help on the page: a dialog that explains a feature in a few lines with a little looping scene, a
// shot of the engine seen from the side (heliograph-help.js runs the scenes; nothing here decides what happens): the
// light runs from the port through its mirrors, the crystals it shatters go, what hung under them falls. The dialog pauses
// the game while it is open (the class `pauses`, menu.js). With "reduce motion", or where the browser can't animate, a scene
// is a still picture of the end of the shot, the crystals gone ringed and those that fell shaded, side by side.
import { svgEl, gemBody, prismBody } from "./heliograph-gem.js";
import { R, MR, PR, CR, PRISM_R, LAMP_R, CROWN_Y, CROWN_R, SKIRT_R, SKIRT_Y, pieces, beaconsOf, closed, layerY } from "./heliograph-engine.js";
import { featureOf, runScene, marksOf, verdictOf } from "./heliograph-help.js";

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// the pace of a scene, slower than the game's so the shot can be followed: the light's speed (tube units a second), a
// crystal's going and a fall's length, the stand before the shot and the hold after it (milliseconds)
const SPEED = 9, GO = 280, FALL = 520, LEAD = 800, HOLD = 1900;
const CEILING = 14, TOP = 15.3, BOTTOM = 6.1;                    // the part of the tube a scene shows
const beamMs = len => Math.max(140, (len / SPEED) * 1000);
const wide = 0.1;                                                 // a beam's width, in tube units
const canAnimate = () => typeof Element !== "undefined" && typeof Element.prototype.animate === "function";

/** A line, or a path of lines, in the tube's plane: points are [x, y] (y up). */
const path = (pts, cls, attrs = {}) => svgEl("path", { d: pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`).join(""), class: cls, ...attrs });
/** A hexagon about a point, the nut of a bolt, as the points of a path (after the M). */
const nut = (p, r) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${(p[0] + r * Math.cos(a)).toFixed(3)} ${(p[1] + r * Math.sin(a)).toFixed(3)}`; }).join("L");
/** The colours a leg carries, each a beam beside the others (white, if none): [{ c, off }]. */
const strands = cs => (cs.length ? cs.map((c, j) => ({ c, off: (j - (cs.length - 1) / 2) * wide * 1.05 })) : [{ c: -1, off: 0 }]);

/**
 * A scene as a picture: { el (the frame), play() (sends the light; returns how long the shot takes), reset() (sets it up
 * again) }. `still` draws the end of the shot at once.
 */
function frameOf(run, still) {
  const { s, r, spec } = run, legs = r.path.legs, hit = new Set(r.shattered), fell = new Set(r.fallen), lanterns = new Set(beaconsOf(s));
  const svg = svgEl("svg", { class: "hg-hsvg", viewBox: `-5 ${-TOP} 10 ${TOP - BOTTOM}`, preserveAspectRatio: "xMidYMid meet", role: "img", "aria-hidden": "true" });
  const world = svgEl("g", { transform: "scale(1 -1)" }), port = s.x.port;
  svg.append(world);
  const back = svgEl("g"), strings = svgEl("g"), over = svgEl("g"), beams = svgEl("g"), effects = svgEl("g");
  world.append(back, strings, over, beams, effects);

  // the tube, its ceiling with the port in it, and the crown with its skirt over the top layers
  back.append(path([[-R, BOTTOM], [-R, CEILING]], "hg-hwall"), path([[R, BOTTOM], [R, CEILING]], "hg-hwall"),
    path([[-R, CEILING + 0.1], [port[0] - 0.3, CEILING + 0.1]], "hg-hceil"), path([[port[0] + 0.3, CEILING + 0.1], [R, CEILING + 0.1]], "hg-hceil"),
    path([[-CROWN_R, CROWN_Y], [CROWN_R, CROWN_Y]], "hg-hcrown"));
  over.append(svgEl("rect", { x: -SKIRT_R, y: SKIRT_Y, width: 2 * SKIRT_R, height: CROWN_Y - SKIRT_Y, class: "hg-hskirt" }));
  // the chandelier: each crystal with the thread above it, so a crystal takes its thread when it goes
  const wraps = new Map();
  for (const q of pieces(s)) {
    const g = svgEl("g", { class: "hg-hp" }), body = svgEl("g", { transform: `translate(${q.p[0].toFixed(3)} ${q.p[1].toFixed(3)}) scale(${(PR / 4).toFixed(4)} ${(-PR / 4).toFixed(4)})` }), pop = svgEl("g", { class: "hg-hpop" });
    pop.append(gemBody(q.c));
    body.append(pop);
    g.append(path([[q.p[0], q.p[1]], [q.p[0], q.k ? layerY(q.k - 1) : CROWN_Y]], "hg-hthread"), body);
    if (lanterns.has(q.id)) {
      // a brass collar and a glow: the lantern
      g.append(svgEl("circle", { cx: q.p[0], cy: q.p[1], r: 0.74, class: "hg-hglow" }), svgEl("circle", { cx: q.p[0], cy: q.p[1], r: 0.56, class: "hg-hcollar" }));
      g.classList.add("lantern");
    }
    if (s.x.bolts?.includes(q.id)) g.append(svgEl("path", { class: "hg-hnut", d: `M${nut(q.p, PR * 1.3)}Z` }));
    if (s.x.frail?.includes(q.id)) {
      const hurt = s.hurt?.includes(q.id), r = PR;
      g.append(path([[q.p[0] - r * 0.5, q.p[1] + r * 0.7], [q.p[0], q.p[1] + r * 0.1], [q.p[0] - r * 0.2, q.p[1] - r * 0.2], [q.p[0] + r * 0.4, q.p[1] - r * 0.8]], "hg-hcrack"),
        ...(hurt ? [path([[q.p[0], q.p[1] + r * 0.1], [q.p[0] + r * 0.7, q.p[1] + r * 0.3]], "hg-hcrack")] : []));
    }
    strings.append(g);
    wraps.set(q.id, { g, pop });
  }

  // what stands in the light: colour crystals, a prism, shutters, the mirrors
  for (const c of s.crystals) over.append(svgEl("g", { transform: `translate(${c.x} ${c.y}) scale(${CR / 4} ${-CR / 4})` }, gemBody(c.c)));
  const lampHalos = [];
  for (const f of s.x.fix) {
    if (f.k === "prism") over.append(svgEl("g", { transform: `translate(${f.p[0]} ${f.p[1]}) scale(${PRISM_R / 4.6} ${-PRISM_R / 4.6})` }, prismBody(f.cs)));
    else if (f.k === "lamp") {
      const lit = r.lamps.length && r.path.lamps.some(l => l.ok), halo = svgEl("circle", { cx: f.p[0], cy: f.p[1], r: LAMP_R * 1.9, class: "hg-hlamphalo" });
      over.append(halo, svgEl("circle", { cx: f.p[0], cy: f.p[1], r: LAMP_R * 0.8, class: `hg-hlamp${f.c >= 0 ? ` c${f.c}` : ""}` }), svgEl("circle", { cx: f.p[0], cy: f.p[1], r: LAMP_R, fill: "none", class: "hg-hnut" }));
      lampHalos.push({ halo, lit });
    } else if (f.k === "split") {
      const t = [-f.n[1], f.n[0]], ends = [[f.p[0] - t[0] * f.r, f.p[1] - t[1] * f.r], [f.p[0] + t[0] * f.r, f.p[1] + t[1] * f.r]];
      over.append(path(ends, "hg-hsplit rim"), path(ends, "hg-hsplit"));
    } else over.append(path([[f.p[0] - f.r, f.p[1]], [f.p[0] + f.r, f.p[1]]], `hg-hshutter ${closed(s, f) ? "shut" : "open"}`));
  }
  for (const m of s.mirrors) {
    const t = [-m.n[1], m.n[0]];
    const ends = [[m.p[0] - t[0] * MR, m.p[1] - t[1] * MR], [m.p[0] + t[0] * MR, m.p[1] + t[1] * MR]];
    over.append(path(ends, "hg-hmirror rim"), path(ends, "hg-hmirror"));            // a brass rim round the silver
    if (m.pin) over.append(svgEl("path", { class: "hg-hnut", d: `M${nut(m.p, 0.34)}Z` }));
  }

  // the light: a leg after another, each strand of it in a colour it carries
  const timed = [];
  let clock = 0;
  for (const leg of legs) {
    const len = Math.hypot(leg.b[0] - leg.a[0], leg.b[1] - leg.a[1]), ms = beamMs(len), nx = len ? -(leg.b[1] - leg.a[1]) / len : 0, ny = len ? (leg.b[0] - leg.a[0]) / len : 0;
    const group = svgEl("g");
    for (const { c, off } of strands(leg.cs)) group.append(path([[leg.a[0] + nx * off, leg.a[1] + ny * off], [leg.b[0] + nx * off, leg.b[1] + ny * off]], `hg-hbeam${c < 0 ? " white" : ` c${c}`}`, { pathLength: 1 }));
    beams.append(group);
    const at = (leg.t0 / SPEED) * 1000;                    // a branch of the light starts where its parent got to
    timed.push({ group, at, ms, leg });
    clock = Math.max(clock, at + ms);
  }
  /** When the light is at a point (milliseconds into the shot): along the leg that passes it. */
  const reach = p => {
    for (const { at, ms, leg } of timed) {
      const dx = leg.b[0] - leg.a[0], dy = leg.b[1] - leg.a[1], l2 = dx * dx + dy * dy, u = l2 ? Math.max(0, Math.min(1, ((p[0] - leg.a[0]) * dx + (p[1] - leg.a[1]) * dy) / l2)) : 0;
      if (Math.hypot(leg.a[0] + dx * u - p[0], leg.a[1] + dy * u - p[1]) < PR + 0.05) return at + ms * u;
    }
    return clock;
  };
  const spark = r.path.stop.what === "shutter" ? svgEl("circle", { cx: r.path.stop.at[0], cy: r.path.stop.at[1], r: 0.3, class: "hg-hspark" }) : null;
  if (spark) effects.append(spark);

  const frame = el("div", "hg-hframe"), cap = el("span", "hg-hcap", verdictOf(run)), marks = el("span", "hg-hmarks", marksOf(run).join(" · "));
  frame.append(svg, cap, marks);
  cap.hidden = !cap.textContent;
  marks.hidden = !marks.textContent;
  if (still) {
    for (const id of hit) wraps.get(id)?.g.classList.add("shattered");
    for (const id of fell) wraps.get(id)?.g.classList.add("fell");
    spark?.classList.add("on");
    for (const { halo, lit } of lampHalos) if (lit) halo.classList.add("on");
    return { el: frame, play: () => 0, reset() {} };
  }

  marks.classList.add("late");
  for (const { group } of timed) group.style.visibility = "hidden";
  const shatterAt = new Map([...hit].map(id => [id, reach(pieces(s).find(q => q.id === id).p)]));
  let anims = [], markTimer = 0;
  const lastGone = Math.max(0, ...shatterAt.values());
  return {
    el: frame,
    play() {
      let total = clock;
      timed.forEach(({ group, at, ms }) => {
        group.style.visibility = "visible";               // each strand is drawn along its length from its delay on
        for (const strand of group.children) anims.push(strand.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: ms, delay: at, easing: "linear", fill: "backwards" }));
      });
      for (const [id, at] of shatterAt) {
        const { g, pop } = wraps.get(id);
        anims.push(pop.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.7)", opacity: 0 }], { duration: GO, delay: at, easing: "ease-out", fill: "forwards" }));
        anims.push(g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: GO, delay: at, fill: "forwards" }));
        total = Math.max(total, at + GO);
      }
      const start = lastGone + (shatterAt.size ? GO * 0.5 : 0);
      for (const id of fell) {
        const { g } = wraps.get(id);
        anims.push(g.animate([{ transform: "translate(0px,0px)", opacity: 1 }, { transform: "translate(0px,-1.8px)", opacity: 0 }], { duration: FALL, delay: start, easing: "ease-in", fill: "forwards" }));
        total = Math.max(total, start + FALL);
      }
      for (const { halo, lit } of lampHalos) if (lit) anims.push(halo.animate([{ opacity: 0, transform: "scale(.5)" }, { opacity: 0.6, transform: "scale(1.2)" }, { opacity: 0.45, transform: "scale(1)" }], { duration: 600, delay: clock, easing: "ease-out", fill: "forwards" }));
      if (spark) anims.push(spark.animate([{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1.5)" }, { opacity: 0, transform: "scale(1.9)" }], { duration: 520, delay: clock, easing: "ease-out", fill: "forwards" }));
      markTimer = setTimeout(() => marks.classList.add("on"), total * 0.85);
      return total;
    },
    reset() {
      clearTimeout(markTimer);
      for (const a of anims) a.cancel();
      anims = [];
      for (const { group } of timed) group.style.visibility = "hidden";
      marks.classList.remove("on");
    },
  };
}

/**
 * The help dialog. `dialog` holds #hgHelpName, #hgHelpStage, #hgHelpText, #hgHelpAt, #hgHelpBack, #hgHelpNext and
 * #hgHelpClose (heliograph.html); `seen()` gives the ids already explained and `mark(ids)` keeps more; `allowed()` says
 * whether help may show at all (never in a watching frame, never in Classic).
 */
export function createHelp({ dialog, seen, mark, allowed }) {
  const $ = id => dialog.querySelector(`#${id}`), stage = $("hgHelpStage");
  let queue = [], at = 0, timer = 0, stopped = true, frames = [];
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches || !canAnimate();

  /** Stops the scene playing: its timers, its light. */
  function stop() {
    stopped = true;
    clearTimeout(timer);
    for (const f of frames) f.reset();
    frames = [];
  }
  /** The scenes of the entry on show, looping: stand, shoot, hold, stand again, and the next scene of the entry after it. */
  function play(entry) {
    stop();
    const runs = entry.scenes.map(runScene), quiet = still();
    frames = runs.map(run => frameOf(run, quiet));
    stage.replaceChildren(...frames.map(f => f.el));
    stage.classList.toggle("still", quiet);
    stage.setAttribute("aria-label", `${entry.name}: ${runs.map(verdictOf).filter(Boolean).join(", ")}`);
    if (quiet) return;
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
    $("hgHelpName").textContent = entry.name;
    $("hgHelpText").replaceChildren(...entry.lines.map(t => el("p", null, t)));
    $("hgHelpAt").textContent = queue.length > 1 ? `${at + 1} of ${queue.length}` : "";
    $("hgHelpBack").disabled = at === 0;                          // kept in its place, unseen, so Next stays where the thumb found it
    $("hgHelpNext").textContent = at === queue.length - 1 ? "Got it" : "Next";
    play(entry);
  }
  $("hgHelpBack").addEventListener("click", () => show(at - 1));
  $("hgHelpNext").addEventListener("click", () => { if (at >= queue.length - 1) dialog.close(); else show(at + 1); });
  $("hgHelpClose").addEventListener("click", () => dialog.close());
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
