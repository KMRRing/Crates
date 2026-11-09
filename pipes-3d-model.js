// Gears' movement in 3D, the pure part (Node tests it: tests/pipes-gear-3d.mjs): where a board square, a layer and a wheel stand in the world, the
// tooth outline of a wheel of module m, how a speed from the engine becomes an angle (one clock for every wheel, so meshed teeth stay in step),
// the phase that puts a tooth in a gap, the escapement's stepped clock, the plate's size, the camera, the metals of the three looks, the draw budget.
// The world: one board square is one unit, x to the right and z down the screen (as the board), y up; the plate's top is y = 0. Board units are
// the engine's (a square is 60). It reads the frame (design: docs/pipes-contract.md if the rules agent has written it) and imports no engine.
import { basis, fit, TILT_MAX, tiltOfPhone, springStep, skinFor as shuntSkin } from "./shunt-3d-model.js";

export { basis, fit, TILT_MAX, tiltOfPhone, springStep };
export const DEG = Math.PI / 180;
export const UNIT = 60;
/** A wheel stands on its layer (1 low .. 3 high) this high; a wheel is THICK thick, a pinion's leaves PIN_THICK. */
export const LAYER_Y = [0, 0.06, 0.26, 0.46];
export const THICK = 0.07, PIN_THICK = 0.1;
export const PILLAR_H = 0.7;
/** A bridge over a square marked 1 or 2 floats this high (bottom, top): over layer 1's wheels, under layer 2's; over layer 2's, under layer 3's. */
export const BRIDGE_Y = { 1: [0.165, 0.245], 2: [0.365, 0.445] };
/** The plate's room round the board: the barrels and the instruments sit in the side margins, the legend below. */
export const MARGIN = { l: 0.4, r: 0.4, top: 0.4, bottom: 0.85 };
/** How far each complication reaches out of its sink's square (world units from the sink wheel's middle): the dial, the moon, the escapement, the chime. */
export const REACH = { hands: 1.8, dial: 1.8, seconds: 1.8, moon: 1.4, escape: 2.1, chime: 2.1, tourbillon: 1.9 };
const SIDES = { N: 0, E: 1, S: 2, W: 3 };
/** The way out of a sink's square (a unit vector in world x, z): away from the port it meshes through. */
export function outOf(side) { const s = typeof side === "string" ? SIDES[side] : side; return [[0, 1], [-1, 0], [0, -1], [1, 0]][s ?? 3]; }
/** How far a sink's square is from the board's edge, in squares from the square's middle, going out of it (away from the port it meshes through). */
export function edgeDist(plan, sink) {
  const cols = plan.cols, rows = plan.rows, [i, j] = [sink.c % cols, Math.floor(sink.c / cols)], [ox, oz] = outOf(sink.side);
  return ox > 0 ? cols - i - 0.5 : ox < 0 ? i + 0.5 : oz > 0 ? rows - j - 0.5 : j + 0.5;
}
/** Whether a train's complication has its full size, out in the plate's margin: its sink is on the board's edge and its way out leads off the board. Any other sink (Book I's, and
 *  most of the later levels') carries a compact instrument on the sink's own square, as the flat plate draws it. */
export const isRound = plan => !!plan?.terrain?.includes("void");
/** A round plate's radius in squares: the circle that holds every square that is not a void, with a little ground beyond. */
export function roundRadius(plan) {
  let R = 0;
  plan.terrain.forEach((t, c) => {
    if (t === "void") return;
    const x = c % plan.cols - plan.cols / 2, z = Math.floor(c / plan.cols) - plan.rows / 2;
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) R = Math.max(R, Math.hypot(x + dx, z + dz));
  });
  return R + 0.12;
}
export const fullSize = (plan, t) => !isRound(plan) && !!REACH[t.sink?.goal?.type] && !t.sink.goal?.ring && edgeDist(plan, t.sink) <= 0.51;
/** The plate's room round the board for this plan: the base margins, widened on the side each full-size instrument reaches out of. */
export function marginsFor(plan) {
  // a round plate: the circle's square, the instruments compact on their sinks' squares (the flat plate's way)
  if (isRound(plan)) { const R = roundRadius(plan), mx = R - plan.cols / 2, mz = R - plan.rows / 2; return { l: mx, r: mx, top: mz, bottom: mz }; }
  const mg = { ...MARGIN };
  for (const t of plan?.trains || []) {
    if (!fullSize(plan, t)) continue;
    const reach = REACH[t.sink.goal.type], [ox, oz] = outOf(t.sink.side), dist = edgeDist(plan, t.sink);
    const key = ox > 0 ? "r" : ox < 0 ? "l" : oz > 0 ? "bottom" : "top";
    mg[key] = Math.max(mg[key], reach - dist + 0.2);
  }
  return mg;
}
let cur = MARGIN;
/** Sets the margins the plate and the case are drawn with (the view calls it with marginsFor(plan) when a level is set). */
export const useMargins = mg => { cur = mg || MARGIN; };
export const CASE_GAP = 0.26;                                  // the case's band beyond the plate
export const GLASS_Y = 0.98;                                   // the sapphire's height

// ---------- the board in the world ----------
export const worldOf = (x, y, cols, rows) => [x / UNIT - cols / 2, y / UNIT - rows / 2];
export const squareAt = (c, cols) => [c % cols, Math.floor(c / cols)];
/** The world's middle of square c. */
export function squareWorld(c, cols, rows) { const [i, j] = squareAt(c, cols); return [i + 0.5 - cols / 2, j + 0.5 - rows / 2]; }
/** The plate: the grid's rectangle widened by the margins, as [x0, x1, z0, z1]. */
export function plateRect(cols, rows) { return [-cols / 2 - cur.l, cols / 2 + cur.r, -rows / 2 - cur.top, rows / 2 + cur.bottom]; }
export const caseRect = (cols, rows) => plateRect(cols, rows).map((v, i) => v + (i % 2 ? CASE_GAP : -CASE_GAP));

// ---------- wheels ----------
/** Pitch radius, tooth tip and root of a wheel of n teeth and module m, in world units (the engine's: r = m n / 2, tip r + 0.64 m, root r - 0.72 m). */
export const pitchR = (n, m) => m * n / 2 / UNIT;
export const tipR = (n, m) => (m * n / 2 + 0.64 * m) / UNIT;
export const rootR = (n, m) => (m * n / 2 - 0.72 * m) / UNIT;

const FLANK = [[0, 0.31], [0.5, 0.235], [0.9, 0.135], [1, 0.09]];          // [share of the tooth's height, half width in pitches]
/** The outline of a wheel of n teeth, module m, as [x, y] points in world units, tooth 0 centred on angle 0 and angles running clockwise on the
 *  screen (y down). Rounded tips, flanks that widen to the root, one chord across the gap's floor. `detail` 0 2-point flanks, 1 3, 2 4.
 *  `fat` widens the teeth (a ring gear's, whose teeth fill the pinion's gaps). */
export function toothOutline(n, m, detail = 2, fat = 0) {
  const root = rootR(n, m), tip = tipR(n, m), h = tip - root, step = 2 * Math.PI / n;
  const flank = detail >= 2 ? FLANK : detail === 1 ? [FLANK[0], FLANK[1], FLANK[3]] : [FLANK[0], FLANK[3]];
  const pts = [], at = (fr, rad) => pts.push([Math.cos(fr * step) * rad, Math.sin(fr * step) * rad]);
  for (let k = 0; k < n; k++) {
    for (const [L, hw] of flank) at(k - hw - fat, root + h * L);
    for (let i = flank.length - 1; i >= 0; i--) at(k + flank[i][1] + fat, root + h * flank[i][0]);
    at(k + 0.5, root);
  }
  return pts;
}

// ---------- the frame's numbers ----------
/** A fraction as the rules write it ({n,d}, {p,q}, [p,q], a number) as a number; null and undefined are 0. */
export function fracNum(f) {
  if (f == null) return 0;
  if (typeof f === "number") return f;
  if (Array.isArray(f)) return f[1] ? f[0] / f[1] : 0;
  const p = f.n ?? f.p ?? f.num ?? f.a, q = f.d ?? f.q ?? f.den ?? f.b ?? 1;
  return q ? p / q : 0;
}
/** The signed rate of gear id g in barrel turns per barrel turn (+ clockwise, 0 undriven or jammed): M.rate if the engine gave one, else omega and dir. */
export function rateOf(M, g) {
  if (M.rate) return M.rate[g] || 0;
  if (!M.dir || M.dir[g] == null || M.dir[g] < 0 || !M.omega) return 0;
  if (M.jam && M.jam.has && M.jam.has(g)) return 0;
  return (M.dir[g] ? -1 : 1) * Math.abs(fracNum(M.omega[g]));
}

/** The wheels' phases (degrees, the angle tooth 0 stands at t = 0) such that every mesh of `edges` has a tooth of one wheel in a gap of the other, and
 *  stays so while the wheels turn at rates in the engine's ratio. Flood from the first gear of each component; rigid pairs (one arbor) share a phase.
 *  A closed loop that cannot be satisfied leaves its closing pair a little off (a picture, never a rule). `gears`: [{id, x, y, n}]; edges: [{u, v, kind}]. */
export function phasesOf(gears, edges, start = []) {
  const by = new Map(gears.map(g => [g.id, g])), adj = new Map(gears.map(g => [g.id, []]));
  for (const e of edges) { if (!by.has(e.u) || !by.has(e.v)) continue; adj.get(e.u).push([e.v, e.kind]); adj.get(e.v).push([e.u, e.kind]); }
  const ph = new Map(), seen = new Set(), queue = [];
  const from = [...start, ...gears.map(g => g.id)];
  for (const root of from) {
    if (seen.has(root) || !by.has(root)) continue;
    ph.set(root, 0); seen.add(root); queue.push(root);
    while (queue.length) {
      const u = queue.shift(), gu = by.get(u);
      for (const [v, kind] of adj.get(u)) {
        if (seen.has(v)) continue;
        const gv = by.get(v);
        let p;
        if (kind === "rigid") p = ph.get(u);
        else {
          const a = Math.atan2(gv.y - gu.y, gv.x - gu.x) / DEG, pu = 360 / gu.n, pv = 360 / gv.n;
          if (kind === "ring") {                                               // the pinion stands inside the ring: both turn the same way
            const uRing = gu.n > gv.n || (gu.ring && !gv.ring), ring = uRing ? gu : gv, pin = uRing ? gv : gu;
            const d = Math.atan2(pin.y - ring.y, pin.x - ring.x) / DEG, pr = 360 / ring.n, pp = 360 / pin.n;
            if (uRing) { const fr = (d - ph.get(u)) / pr; p = d - pp * (fr - 0.5); }
            else { const fp = (d - ph.get(u)) / pp; p = d - pr * (fp + 0.5); }
          } else {
            const fu = (a - ph.get(u)) / pu;                                    // where u's tooth is at the contact, in pitches
            p = a + 180 - pv * (0.5 - fu);                                      // v's gap lies opposite it
          }
        }
        ph.set(v, ((p % 360) + 360) % 360); seen.add(v); queue.push(v);
      }
    }
  }
  return ph;
}

/** The angle (degrees, clockwise) of a wheel: its phase and `turns` barrel turns at its signed rate. */
export const angleOf = (phase, rate, turns) => phase + 360 * rate * turns;

/** The escapement's clock: the barrel's turns `g` become stepped turns, the train advancing a step of `beat` turns in the first `duty` of each beat
 *  (smoothly, with a little overshoot and rest) and standing the rest, so the average speed is the engine's and every wheel of the train ticks. */
export function stepClock(g, beat, duty = 0.3) {
  const k = Math.floor(g / beat), f = g / beat - k, u = Math.min(1, f / duty);
  const s = 1 - Math.pow(1 - u, 3), over = Math.sin(u * Math.PI) * 0.06 * (1 - u);
  return (k + s + over) * beat;
}

// ---------- the look: the three looks (Codex day, Codex night, Office night; Office day is its cool twin) ----------
// The plates are calm (Korbi, 4 November 2026: Shunt's case neutral silver so the coloured parts read): a pale rhodium plate, silver bridges and a
// 9 Nov 2026, Korbi: the metal rim was "ugly": the case is satin brass (Codex) or blued steel (Office), not fluted chrome. silver plate, the wheels and the rubies the colour. The light is Shunt's, which is Topple's.
const SILVER = {
  codex: {
    day: { case: 0xc9a25f, plate: 0xc9ccd0, bridge: 0xd8dade, steel: 0xb9bec6, field: 0x2a2f36, paper: 0xe9e3d3 },
    night: { case: 0x9c7d4a, plate: 0xa9adb3, bridge: 0xbfc3c9, steel: 0x9ea3ab, field: 0x1a1e24, paper: 0xcfc8b6 },
  },
  office: {
    day: { case: 0x6f7c8c, plate: 0xc5cbd2, bridge: 0xd8dde2, steel: 0xb4bcc6, field: 0x232a33, paper: 0xe6eaee },
    night: { case: 0x586372, plate: 0x9ba4ae, bridge: 0xb3bbc5, steel: 0x929ba6, field: 0x161b22, paper: 0xc9d0d8 },
  },
};
/** The wheels' metals by module (design: fine rose gold, standard gilt, coarse blued steel), then pinions (polished steel), arbors, the dial. */
export const METALS = {
  4: { color: 0xe0a186, metalness: 0.92, roughness: 0.3 },
  5: { color: 0xe3b84e, metalness: 0.92, roughness: 0.3 },
  6: { color: 0x4f78b6, metalness: 0.88, roughness: 0.3 },
  pinion: { color: 0xc9ced6, metalness: 0.95, roughness: 0.2 },
};
/** What the three looks wear. `theme` is the page's data-theme (codex, office; any other wears codex). */
export function skinFor(theme, night) {
  const t = theme === "office" ? "office" : "codex", base = shuntSkin(t, night);
  return { ...base, ...SILVER[t][night ? "night" : "day"], theme: t, night: !!night };
}

// ---------- the camera ----------
/** The view's home elevation (radians) by the card's shape: more from above the wider the card. */
export function homeEl(aspect) { return (aspect < 0.7 ? 60 : aspect < 1 ? 63 : aspect < 1.3 ? 68 : 72) * DEG; }
/** A portrait card turns a wide movement a quarter, the barrels at the top, so its long side runs down the screen and it is drawn much larger; a hit
 *  and the squares' places (view.project) follow the turn, so the page notices nothing. */
export function homeAz(aspect, cols, rows) { const [x0, x1, z0, z1] = caseRect(cols, rows); return aspect < 0.9 && x1 - x0 > 1.15 * (z1 - z0) ? 90 * DEG : 0; }
export const LOOK_EL = 48 * DEG;
export const ORBIT = { az: 70 * DEG, el0: 35 * DEG, el1: 75 * DEG, zoom: 2 };
/** The points the camera must keep in view: the case's corners at the bottom and at the glass. */
export function keepPoints(cols, rows, lift = 0) {
  const [x0, x1, z0, z1] = caseRect(cols, rows), p = [];
  for (const y of [-0.5, GLASS_Y + lift]) for (const x of [x0, x1]) for (const z of [z0, z1]) p.push([x, y, z]);
  return p;
}
/** The camera's frame at yaw az, elevation el for a card of this aspect, as fit() gives it: { H, look }. */
export const cameraFor = (cols, rows, az, el, aspect, lift = 0) => fit(keepPoints(cols, rows, lift), az, el, aspect, 0.12, 0.08);

/** The layers' height with the exploded view at e (0..1): layer l's wheels rise by (l - 1) steps, the bridges above them. */
export const EXPLODE_STEP = 0.62;
export const layerY = (l, e = 0) => LAYER_Y[l] + e * (l - 1) * EXPLODE_STEP;
export const bridgeLift = (digit, e = 0) => e * (digit + 0.45) * EXPLODE_STEP;

// ---------- a touch ----------
/** Where the ray from `origin` along `dir` meets the plane y = h: [x, z] or null. */
export function rayAtY(origin, dir, h) {
  if (Math.abs(dir[1]) < 1e-9) return null;
  const t = (h - origin[1]) / dir[1];
  return [origin[0] + dir[0] * t, origin[2] + dir[2] * t];
}
/** The gear a ray touches (the highest first): `gears` with world x, z, y (top) and tip radius. Returns the gear or null. */
export function gearUnder(origin, dir, gears) {
  const hits = [];
  for (const g of gears) {
    const p = rayAtY(origin, dir, g.top);
    if (p && Math.hypot(p[0] - g.wx, p[1] - g.wz) <= g.tip) hits.push(g);
  }
  hits.sort((a, b) => b.top - a.top);
  return hits[0] || null;
}

// ---------- the budget (the design's phone budget) ----------
export const BUDGET = { calls: 60, callsLook: 80, tris: 120000 };
/** The detail level for a mean frame time in ms: down a step above 28, never back up (the caller keeps the lowest it has seen). */
export const detailFor = (now, ms) => (ms > 28 ? Math.max(0, now - 1) : now);
