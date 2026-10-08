// Calibre's pictures: a design drawn small and still (the course's thumbnails, framed on where a level's work happens),
// or running (the lessons). A scene is a mechanism of its own or a level's, the part in focus drawn full and the rest
// faint or left out, framed close on what it is about (in 3D, on its own parts, not the whole plate), with its own names
// on it and a line under it saying how it turns. It runs on the engine like any plan: a geared train in time-lapse, an
// escapement ticking in slow motion (or at its real beat), a spring running away, a fork locking after one tick, a
// mainspring winding and letting down, a locked train straining. The pictures are class cb-pic (cb-scene is the brief's
// buttons for a mechanism's states).
//
// A scene: { arbors, plate } (a mechanism of its own) or { from: "level" | a level's id, solved (that level's worked
// solution: only ever an earlier level's), state (a mechanism's state, by id) }; then only / hide (arbors kept or left
// out), focus (arbors drawn full, the rest faint), lit (a mesh lit: { a, b }), labels ({ arbor: text }), frame ([x, y,
// r]: the part of the plate shown), view ("3d": the layers apart; cam, up, layer as the 3D view takes them), motion
// ("geared" | "running" | "swing" | "runaway" | "locked" | "wind" | "letdown" | "jammed" | "still"), speed (time-lapse: seconds
// of movement a second), beat (the balance's swings a second; real: its own), amp (its amplitude in degrees, or [full,
// spent] falling over the run), show ("turns" | "rates" | "beats" | "amp": the line under it).
import { run, startDesign, solved, inState, rateText, beatOf, MAINSPRING_TURNS } from "./calibre-engine.js";
import { el, drawDesign, reachOf, arborName, extentOf } from "./calibre-draw.js";
import { draw3d, CAM } from "./calibre-3d.js";
import { LEVELS } from "./calibre-levels.js";

const copy = arbors => arbors.map(a => ({ ...a, parts: (a.parts || []).map(p => ({ ...p })) }));
/** The design a scene shows, and the level it comes from (for its plate and its states). */
export function sceneDesign(spec, here) {
  let level = here, design;
  if (spec.arbors) design = { plate: spec.plate ?? 10, arbors: copy(spec.arbors) };
  else {
    level = spec.from && spec.from !== "level" ? LEVELS.find(l => l.id === spec.from) : here;
    design = spec.solved ? solved(level) : startDesign(level);
    design = { ...design, arbors: copy(design.arbors) };
    const sc = spec.state && level.scenarios?.find(s => s.id === spec.state);
    if (sc) design = inState(design, sc);
  }
  if (spec.only) design.arbors = design.arbors.filter(a => spec.only.includes(a.id));
  if (spec.hide) design.arbors = design.arbors.filter(a => !spec.hide.includes(a.id));
  return { design, level };
}
/** An arbor as a circle to frame: as far as its parts reach (a part's, not a hand's: a hand may run off the picture). */
const roundOf = (a, reach, extra = []) => ({ x: a.x, y: a.y, r: Math.max(0.6, ...[...(a.parts || []), ...extra].filter(p => p.kind !== "rotor").map(p => extentOf(p, reach))) });
/** The box round some circles, with a margin, at least 6 mm a side. */
function boxRound(circles) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const { x, y, r } of circles) { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); }
  const pad = 1.1, w = Math.max(6, x1 - x0 + 2 * pad), h = Math.max(6, y1 - y0 + 2 * pad);
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
}
/** The part of the plate a scene frames: as given, or round the arbors in focus (all of them, failing that), parts and all. */
function frameOf(spec, design) {
  if (spec.frame) { const [x, y, r] = spec.frame; return [x - r, y - r, 2 * r, 2 * r]; }
  const keep = design.arbors.filter(a => !spec.focus || spec.focus.includes(a.id)), reach = reachOf(design.plate);
  if (!keep.length) { const R = reach + 0.6; return [-R, -R, 2 * R, 2 * R]; }
  return boxRound(keep.map(a => roundOf(a, reach)));
}
/**
 * Where a level's work happens, as circles to frame: the arbors its solution changes, with the parts they get (a new
 * arbor by the arbor it stands nearest, while it isn't there yet: the frame mustn't say where it goes), and the parts
 * already on the plate that reach them, the work's neighbours.
 */
export function workAround(level, finished) {
  const start = startDesign(level), reach = reachOf(level.plate), sol = level.solution || {}, work = [];
  const near = (x, y) => start.arbors.reduce((m, a) => (!m || Math.hypot(a.x - x, a.y - y) < Math.hypot(m.x - x, m.y - y) ? a : m), null);
  const put = (a, extra) => { if (a) work.push(roundOf(a, reach, extra)); };
  for (const s of sol.add || []) {
    if (s.arbor) put(start.arbors.find(a => a.id === s.arbor), [s.part]);
    else if (finished) work.push({ x: s.at.x, y: s.at.y, r: Math.max(0.6, extentOf(s.part, reach)) });
    else put(near(s.at.x, s.at.y));
  }
  for (const id of [...(sol.set || []), ...(sol.takeOff || [])].map(s => s.arbor).concat(sol.remove || [])) put(start.arbors.find(a => a.id === id));
  const neighbours = start.arbors.filter(a => (a.parts || []).length).map(a => roundOf(a, reach)).filter(c => work.some(w => Math.hypot(c.x - w.x, c.y - w.y) < c.r + w.r + 0.3));
  return [...work, ...neighbours];
}

/** A level drawn small and still, framed square round circles given (else what's on its plate), the hands left off. */
export function drawThumb(svg, design, around) {
  svg.replaceChildren();
  svg.classList.add("cb-pic", "cb-thumbnail");
  const arbors = design.arbors.filter(a => (a.parts || []).length || a.noParts), dyn = [];
  drawDesign(svg, { plate: design.plate, arbors: design.arbors, out: run(design), layer: null, labels: false, dyn });
  for (const [, put] of dyn) put({ angles: {}, wound: 0.7, windAngle: 0, balance: 0, fork: 0 });   // each part to its place: a moving part is placed by its frame
  let [x, y, w, h] = around?.length ? boxRound(around) : frameOf({}, { ...design, arbors: arbors.length ? arbors : design.arbors });
  const side = Math.max(w, h) * 0.92;                            // a little tighter than a scene's: no names to make room for
  [x, y] = [x + w / 2 - side / 2, y + h / 2 - side / 2];
  svg.setAttribute("viewBox", [x, y, side, side].map(v => v.toFixed(3)).join(" "));
}

/**
 * How a scene moves (as it says, or as its mechanism would: straining if locked in a loop, ticking if it has a balance
 * in focus, turning if anything turns; a train still to be finished stands still, as running away or locking after a
 * tick would only distract from the step it's about), the escapement it shows, and its time-lapse: as the scene says,
 * or the quickest part in focus turning half a turn a second, and nothing faster than two (a blur, however faint).
 */
export function motionOf(spec, out) {
  const focus = spec.focus ? new Set(spec.focus) : null;
  const esc = out.escapements.find(e => (focus ? focus.has(e.escape) || focus.has(e.balance) : true));
  const motion = spec.motion || (out.jammed.length ? "jammed" : esc?.state === "running" && esc.balance && (!focus || focus.has(esc.balance)) ? "running"
    : !out.runaway && !out.locked && Object.values(out.rates).some(r => r) ? "geared" : "still");
  const fastest = keep => Math.max(1e-9, ...Object.entries(out.rates).filter(([id, r]) => r && keep(id)).map(([, r]) => Math.abs(r)));
  const speed = spec.speed ?? Math.min(36000, (0.5 * 3600) / fastest(id => !focus || focus.has(id)), (2 * 3600) / fastest(() => true));
  return { esc, motion, speed: Math.max(1, speed) };
}
/**
 * Plays a scene in svg; readout(text) gets the line under it a few times a second. Returns { stop }. Reduced motion
 * shows the scene still, a little way into its movement.
 */
export function playScene(svg, spec, here, readout = () => {}) {
  const { design } = sceneDesign(spec, here), out = run(design), focus = spec.focus ? new Set(spec.focus) : null, dyn = [];
  svg.replaceChildren();
  svg.classList.add("cb-pic");
  // the room the picture has on the page (none yet if it isn't shown: then a square)
  const box = svg.getBoundingClientRect(), aspect = box.width > 0 && box.height > 0 ? box.width / box.height : 1;
  let scene3d = null;
  if (spec.view === "3d") scene3d = draw3d(svg, { plate: design.plate, arbors: design.arbors, out, layer: spec.layer ?? null, guides: [], focus, lit: spec.lit, callouts: false, dyn,
    cam: { ...CAM, ...spec.cam }, up: spec.up || "train", fit: { ids: spec.focus || null, up: !!spec.focus, px: box.width > 0 ? [box.width, box.height] : null } });
  else {
    drawDesign(svg, { plate: design.plate, arbors: design.arbors, out, layer: null, labels: false, focus, lit: spec.lit, dyn });
    // the frame widened (or deepened) to the picture's own shape, so the names have room either side
    let [x, y, w, h] = frameOf(spec, design);
    if (w / h < aspect) { x -= (h * aspect - w) / 2; w = h * aspect; } else { y -= (w / aspect - h) / 2; h = w / aspect; }
    svg.setAttribute("viewBox", [x, y, w, h].map(v => v.toFixed(3)).join(" "));
  }
  // its own names, on the parts they name: over the arbor on the plan (under it if that's taken), over its top part in
  // 3D; about 12 px high whatever the scale, kept inside the picture
  const vb = svg.viewBox.baseVal, px = box.width > 0 ? Math.min(box.width / vb.width, box.height / vb.height) : 0;
  const fs = px ? 13 / px : Math.max(0.42, vb.width * 0.046), taken = [];
  for (const [id, text] of Object.entries(spec.labels || {})) {
    const a = design.arbors.find(x => x.id === id);
    if (!a) continue;
    const r = Math.min(Math.max(0.5, ...(a.parts || []).map(p => extentOf(p, reachOf(design.plate)))), vb.height * 0.3);
    let spots = [[a.x, a.y - r - fs * 0.3], [a.x, a.y + r + fs * 0.95]];
    if (scene3d) { const [u, v] = scene3d.topView(a); spots = [[u, v - fs * 0.8], [u, v + fs * 1.6]]; }
    const t = el("text", { "font-size": fs, "stroke-width": fs * 0.24, class: "cb-pic-label" }, svg);
    t.textContent = text;
    const w = t.getComputedTextLength?.() || text.length * fs * 0.55, pad = fs * 0.3;
    const at = ([x, y]) => [Math.min(Math.max(x, vb.x + w / 2 + pad), vb.x + vb.width - w / 2 - pad), Math.min(Math.max(y, vb.y + fs + pad), vb.y + vb.height - pad)];
    const clash = ([x, y]) => taken.some(q => Math.abs(q.x - x) < (q.w + w) / 2 && Math.abs(q.y - y) < fs * 1.05);
    const [x, y] = at(spots.find(sp => !clash(at(sp))) || spots[0]);
    t.setAttribute("x", x.toFixed(3)); t.setAttribute("y", y.toFixed(3));
    taken.push({ x, y, w });
  }

  // the movement: which way it goes, and how fast the time-lapse runs
  const { esc, motion, speed } = motionOf(spec, out);
  const rates = out.rates, rel = out.relative || {}, barrel = design.arbors.find(a => a.power != null);
  const named = id => spec.labels?.[id] || arborName(design.arbors.find(a => a.id === id) || { id });
  const st = { angles: {}, wound: spec.motion === "wind" ? 0 : 1, windAngle: 0, balance: 0, fork: 0 };
  const balancePart = design.arbors.find(a => a.id === esc?.balance)?.parts.find(p => p.kind === "balance") || design.arbors.flatMap(a => a.parts || []).find(p => p.kind === "balance");
  const vph = balancePart ? beatOf(balancePart) : esc?.vph || 18000;
  const beatHz = spec.beat === "real" ? vph / 7200 : spec.beat ?? 0.6;              // full swings a second
  const escDir = esc && (Math.sign(rates[esc.escape] || rel[esc.escape] || -1) || -1);
  const ampAt = k => (Array.isArray(spec.amp) ? spec.amp[0] + (spec.amp[1] - spec.amp[0]) * k : spec.amp ?? 260);
  let shown = "";
  const say = text => { if (text !== shown) { shown = text; readout(text); } };
  const update = t => {
    if (motion === "geared") {
      const hours = (t * speed) / 3600;
      for (const [id, r] of Object.entries(rates)) if (r) st.angles[id] = r * hours;
      // a finger moves its star by fits and starts: still for most of the finger's turn, then a tooth on, quickly
      for (const f of out.fingers) {
        const turns = Math.abs(st.angles[f.a] || 0), whole = Math.floor(turns), frac = turns - whole;
        st.angles[f.b] = (Math.sign(rates[f.b] || 1) * (whole + (frac > 0.8 ? (1 - Math.cos((Math.PI * (frac - 0.8)) / 0.2)) / 2 : 0))) / f.teeth;
      }
    } else if (motion === "swing") {
      // a balance on its hairspring alone, swinging back and forth
      st.balance = ampAt((t % 8) / 8) * Math.sin(2 * Math.PI * beatHz * t);
    } else if (motion === "running" && esc) {
      // the balance swings; each swing's two beats let the escape wheel on half a tooth each, and the train with it
      const k = (t % 8) / 8, amp = ampAt(k);
      st.balance = amp * Math.sin(2 * Math.PI * beatHz * t);
      st.fork = 8 * Math.max(-1, Math.min(1, st.balance / 30));
      const beats = Math.floor(2 * beatHz * t + 0.25), turn = (beats * 0.5) / esc.teeth * escDir;
      const ref = rates[esc.escape] || rel[esc.escape];
      if (ref) for (const [id, r] of Object.entries(rates[esc.escape] ? rates : rel)) if (r) st.angles[id] = (turn * r) / ref;
      st.angles[esc.escape] = turn;
    } else if (motion === "runaway") {
      // the spring lets go: a quarter turn of the barrel in a second and a half, the train a blur at its ratios; then again
      const p = t % 3.4, k = Math.min(1, p / 1.6), let_ = 0.25 * (1 - (1 - k) * (1 - k));
      if (barrel && rel[barrel.id]) for (const [id, r] of Object.entries(rel)) st.angles[id] = (let_ * r) / Math.abs(rel[barrel.id]);
      st.wound = 1 - 0.3 * k;
    } else if (motion === "locked" && esc) {
      // one tooth lands on a stone: the wheel moves a fraction, the fork is knocked across, and everything stops; again
      const p = t % 2.4, k = Math.min(1, Math.max(0, (p - 0.4) / 0.12));
      st.angles[esc.escape] = escDir * k * (0.18 / esc.teeth);
      st.fork = 8 * k;
    } else if (motion === "wind" || motion === "letdown") {
      // the barrel arbor turns, the spring coils round it (and lets down, turning the barrel)
      const p = t % 5, k = Math.min(1, p / 3.2), e = 1 - (1 - k) * (1 - k);
      st.wound = motion === "wind" ? e : 1 - e;
      if (barrel) { if (motion === "wind") st.windAngle = -e * MAINSPRING_TURNS * 0.4; else st.angles[barrel.id] = Math.sign(rates[barrel.id] || barrel.power || barrel.drive || -1) * e * 0.6; }
    } else if (motion === "jammed") {
      // a locked train strains: every wheel in the loop shivers and goes nowhere
      for (const id of out.jammed) st.angles[id] = Math.sin(t * 22) * 0.004;
    }
    for (const [, u] of dyn) u(st);
    // the line under it
    const ids = Object.keys(spec.labels || {}).filter(id => design.arbors.some(a => a.id === id));
    if (spec.show === "turns" && motion === "geared") say(ids.map(id => `${named(id)}: ${Math.abs(st.angles[id] || 0).toFixed(1)} turns`).join(" · "));
    else if (spec.show === "rates") say(ids.map(id => `${named(id)}: ${rateText(rates[id])}`).join(" · "));
    else if (spec.show === "beats" && esc) say(`${Math.floor(2 * beatHz * t + 0.25)} beats · the escape wheel ${(Math.floor(2 * beatHz * t + 0.25) / 2).toFixed(1)} teeth on${spec.beat === "real" ? ` · ${Math.round(vph / 3600)} beats a second` : ""}`);
    else if (spec.show === "amp" && (motion === "running" || motion === "swing")) say(`Amplitude ${Math.round(ampAt((t % 8) / 8))}°`);
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { update(1.3); return { stop() {} }; }
  let raf = 0, t0 = null;
  const tick = now => { t0 ??= now; update((now - t0) / 1000); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  return { stop() { cancelAnimationFrame(raf); } };
}
