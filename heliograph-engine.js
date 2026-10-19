// Heliograph's rules, pure (no page): a glass tube with a chandelier of crystals (strings of them, one under each of
// nineteen places) hanging from a crown in the middle of its top. White light falls from a port in the ceiling beside
// the crown; two colour crystals stand somewhere low in the tube. You set and turn mirrors anywhere inside the tube to
// carry the light through a colour crystal, which colours it and is spent (a new one appears), and on into the cluster:
// the beam shatters every crystal of its colour it passes and stops at the first of another colour; through both colour
// crystals it carries both colours and shatters either. White light does nothing to the cluster. Everything on a string
// below a crystal shattered falls. Every few shots the cluster comes down a layer, a new layer under the crown; when it
// reaches the line low on the glass the game is over. The page (heliograph.js) draws it in 3D (heliograph-3d.js) or
// flat (heliograph-flat.js); tests/heliograph.mjs checks this.
//
// Space: y up from the floor (0) to the ceiling (H), the tube's axis at x = z = 0. A mirror is a disc silvered both
// sides, where it stands and the way it faces: the player moves and turns them by hand, the light's way drawn as they do.
//
// A game is one object, as saved: { v, seed, n (draws made from the seed), layers [{ s (a serial), c (a colour 0–3 or
// -1 for each of the CELLS) }] top first, serial, crystals [{ x, y, z, c } twice], next (the colour of the next one),
// mirrors [{ id, p, n }], mid, shots, untilDrop, score, over }. Every random thing comes from the seed and the draw's
// number, so a game saved and opened again goes on as it would have.

export const R = 5, H = 14;                        // the tube's radius and height
export const COLOURS = 4;
export const PR = 0.4;                             // a cluster crystal's radius (a sphere, to the light)
export const CR = 0.45;                            // the colour crystal's
export const MR = 0.5;                             // a mirror's
export const MIRRORS = 6;                          // mirrors to hand
export const PORT = [0, H, 3.4];                   // where the light comes in, falling straight down
export const CROWN_Y = H - 0.5, CROWN_R = 2.15;    // the crown the cluster hangs from: a disc the light stops at
export const TOP_Y = H - 1.05;                     // the top layer's height
export const LY = 0.84;                            // between layers
export const SPACING = 0.92;                       // between neighbours in a layer
export const START_LAYERS = 7;
export const LOSE_Y = 2.2;                         // a crystal's foot below this ends the game
export const CLEAR_BONUS = 1000;
// shots between the cluster's drops: unhurried at first, then closer together, so a long game ends
export const PACE = [[30, 6], [70, 5], [120, 4], [180, 3], [Infinity, 2]];
export const dropEvery = shots => PACE.find(([until]) => shots < until)[1];
const MAX_LEGS = 40, MAX_LENGTH = 400, EPS = 1e-6;

// ---------- the cluster's layout: a hexagon of 19 places in each layer ----------
/** The places of a layer, { x, z, nb (the neighbouring places) }: a hexagon two rings round a middle. */
export const CELLS = (() => {
  const out = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
    if (Math.abs(q + r) > 2) continue;
    out.push({ q, r, x: SPACING * (q + r / 2), z: SPACING * (r * Math.sqrt(3) / 2) });
  }
  const at = new Map(out.map((c, i) => [`${c.q},${c.r}`, i]));
  const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  for (const c of out) c.nb = STEPS.map(([dq, dr]) => at.get(`${c.q + dq},${c.r + dr}`)).filter(i => i != null);
  return out;
})();
const N = CELLS.length;
export const layerY = k => TOP_Y - k * LY;
/** A cluster crystal's id: its layer's serial and its place, which stay the same as the cluster comes down. */
export const idOf = (serial, i) => serial * N + i;

// ---------- vectors ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a); return l > EPS ? mul(a, 1 / l) : null; };
const dist = (a, b) => len(sub(a, b));
/** A ray's direction after a mirror facing n (a unit vector; either side silvered). */
export const reflect = (d, n) => sub(d, mul(n, 2 * dot(d, n)));

// ---------- chance ----------
/** One number in [0, 1) for a seed's nth draw (mulberry32 on the two mixed): the same on every device. */
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const roll = s => draw(s.seed, s.n++);
const pick = (s, k) => Math.floor(roll(s) * k);

// ---------- the cluster ----------
/** A layer for under the crown, a crystal on every string: each a colour, often the one of a neighbour already set or of
 *  the crystal below, so colours come in clumps a beam can run through. */
function newLayer(s, below) {
  const c = new Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const r = roll(s), set = CELLS[i].nb.filter(j => j < i);
    c[i] = below && below[i] >= 0 && r < 0.4 ? below[i] : set.length && r < 0.75 ? c[set[pick(s, set.length)]] : pick(s, COLOURS);
  }
  return { s: s.serial++, c };
}
function fill(s) {
  const made = [];
  for (let k = 0; k < START_LAYERS; k++) made.push(newLayer(s, made[k - 1]?.c));
  s.layers = made.reverse();          // built from the bottom up, kept top first
}
/** Every crystal of the cluster: { id, k (its layer, 0 the top), i (its place), c, p (where it is) }. */
export function pieces(s) {
  const out = [];
  s.layers.forEach((l, k) => l.c.forEach((c, i) => { if (c >= 0) out.push({ id: idOf(l.s, i), k, i, c, p: [CELLS[i].x, layerY(k), CELLS[i].z] }); }));
  return out;
}
/** A cluster crystal by its id, or null once it's gone. */
export function pieceById(s, id) {
  const serial = Math.floor(id / N), i = id % N, k = s.layers.findIndex(l => l.s === serial);
  if (k < 0 || s.layers[k].c[i] < 0) return null;
  return { id, k, i, c: s.layers[k].c[i], p: [CELLS[i].x, layerY(k), CELLS[i].z] };
}
const present = s => [...new Set(s.layers.flatMap(l => l.c.filter(c => c >= 0)))].sort();
/** The lowest a crystal of the cluster hangs (its centre), or Infinity with none. */
export function lowest(s) {
  for (let k = s.layers.length - 1; k >= 0; k--) if (s.layers[k].c.some(c => c >= 0)) return layerY(k);
  return Infinity;
}
/** What hangs from nothing: the cluster is strings of crystals hung from the crown, one under each place of the top
 *  layer, so everything on a string below a gap falls. */
function unsupported(s) {
  const out = [];
  for (let i = 0; i < N; i++) {
    let held = true;
    s.layers.forEach((l, k) => { if (l.c[i] < 0) held = false; else if (!held) out.push(idOf(l.s, i)); });
  }
  return out;
}
function removeIds(s, ids) {
  for (const id of ids) {
    const serial = Math.floor(id / N), l = s.layers.find(x => x.s === serial);
    if (l) l.c[id % N] = -1;
  }
  while (s.layers.length > 1 && s.layers[s.layers.length - 1].c.every(c => c < 0)) s.layers.pop();
}

// ---------- the colour crystals ----------
const radial = p => Math.hypot(p[0], p[2]);
export const CRYSTALS = 2;             // colour crystals in the tube at once
/** Where a new colour crystal may stand: low in the tube, clear of the wall, the cluster, the mirrors and the other crystal. */
function crystalFits(s, p, except = -1) {
  if (radial(p) > R - 0.8 || p[1] < 0.9) return false;
  if (s.mirrors.some(m => dist(m.p, p) < CR + MR + 0.5)) return false;
  if (s.crystals.some((c, k) => k !== except && c && dist(at(c), p) < 2 * CR + 1.2)) return false;
  return !pieces(s).some(q => dist(q.p, p) < PR + CR + 0.6);
}
const at = c => [c.x, c.y, c.z];
/** A new colour crystal in place k: the colour that was next (another than the other crystal's, where the cluster has
 *  another), somewhere low in the tube. */
function spawnCrystal(s, k) {
  const other = s.crystals[1 - k]?.c;
  let c = s.next ?? pickColour(s, other);
  if (c === other) c = pickColour(s, other);
  s.next = pickColour(s, null);
  const top = Math.max(1.2, Math.min(5.2, lowest(s) - 1.8));
  for (let t = 0; t < 60; t++) {
    // clear of the wall by enough that light through it has room to run on to a mirror beyond it
    const a = roll(s) * 2 * Math.PI, r = 1.6 + roll(s) * (R - 3.4), y = 1.0 + roll(s) * (top - 1.0);
    const p = [r * Math.sin(a), y, r * Math.cos(a)];
    if (crystalFits(s, p, k)) { s.crystals[k] = { x: p[0], y: p[1], z: p[2], c }; return; }
  }
  // nowhere clear (mirrors everywhere): beside the wall at the foot
  s.crystals[k] = { x: k ? R - 1.2 : -(R - 1.2), y: 1.0, z: 0, c };
}
/** A colour there's some of in the cluster, not `not` if there's another. */
function pickColour(s, not) {
  let cs = present(s);
  if (cs.length > 1) cs = cs.filter(c => c !== not);
  return cs.length ? cs[pick(s, cs.length)] : pick(s, COLOURS);
}
/** The colour crystals' places, [[x, y, z]…]. */
export const crystalsAt = s => s.crystals.map(at);

// ---------- a game ----------
export function newGame(seed) {
  const s = { v: 3, seed: seed >>> 0, n: 0, layers: [], serial: 0, crystals: [null, null], next: null, mirrors: [], mid: 0, shots: 0, untilDrop: dropEvery(0), score: 0, over: false };
  fill(s);
  for (let k = 0; k < CRYSTALS; k++) spawnCrystal(s, k);
  return s;
}
export const copy = s => JSON.parse(JSON.stringify(s));

// ---------- mirrors ----------
/** Why a mirror can't stand at p (null if it can): inside the tube, under the crown, clear of the cluster, the colour
 *  crystals and the other mirrors (`except`, the one being moved). */
export function cantPlace(s, p, except = null) {
  if (radial(p) > R - MR - 0.1 || p[1] < MR + 0.1 || p[1] > H - 1.1) return "inside the tube";
  if (radial(p) < CROWN_R + MR && p[1] > CROWN_Y - MR - 0.1) return "clear of the crown";
  if (pieces(s).some(q => dist(q.p, p) < PR + MR * 0.9)) return "clear of the cluster";
  if (s.crystals.some(c => dist(at(c), p) < CR + MR + 0.1)) return "clear of the colour crystals";
  if (s.mirrors.some(m => m.id !== except && dist(m.p, p) < 2 * MR + 0.1)) return "clear of the other mirrors";
  return null;
}
/** A point moved to where a mirror may stand nearest it: inside the tube's walls, floor and ceiling. Clearance from the
 *  cluster and the other mirrors is left to cantPlace. */
export function clampInside(p) {
  const lim = R - MR - 0.12, r = radial(p), y = Math.max(MR + 0.12, Math.min(H - 1.12, p[1]));
  return r > lim ? [(p[0] * lim) / r, y, (p[2] * lim) / r] : [p[0], y, p[2]];
}
/** The facing that sends light arriving along d from a mirror at p toward `to`: halfway between where it goes and back
 *  where it came from. Null when there's no telling (the light would have to go straight on). */
export function facing(d, p, to) {
  const u = norm(sub(to, p));
  return u ? norm(sub(u, d)) : null;
}
/** A mirror's facing as two angles, round the upright and up from level, and back: how a hand turns one. */
export const anglesOf = n => [Math.atan2(n[0], n[2]), Math.asin(Math.max(-1, Math.min(1, n[1])))];
export const fromAngles = (yaw, pitch) => [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
function edit(s, id, f) { const t = copy(s); const m = t.mirrors.find(x => x.id === id); if (m) f(m); return t; }
export function addMirror(s, p, n = [0, 1, 0]) {
  const t = copy(s);
  t.mirrors.push({ id: t.mid++, p, n: norm(n) || [0, 1, 0] });
  return t;
}
export const moveMirror = (s, id, p) => edit(s, id, m => { m.p = p; });
export const turnMirror = (s, id, n) => edit(s, id, m => { m.n = norm(n) || m.n; });
export const takeMirror = (s, id) => { const t = copy(s); t.mirrors = t.mirrors.filter(m => m.id !== id); return t; };
/** A mirror turned to send the light that reaches it (as things stand) to `to`; unchanged if no light reaches it. For the
 *  players below and the tests: by hand, a mirror is turned by eye, the light's way drawn as it turns. */
export function pointMirror(s, id, to) {
  const d = trace(s).ins[id], m = s.mirrors.find(x => x.id === id);
  const n = d && m && facing(d, m.p, to);
  return n ? turnMirror(s, id, n) : s;
}

// ---------- the light ----------
/** Where a ray from o along d first meets a sphere, or Infinity. */
function hitSphere(o, d, c, r) {
  const oc = sub(o, c), b = dot(oc, d), cc = dot(oc, oc) - r * r, disc = b * b - cc;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > EPS ? t : Infinity;
}
/** Where a ray from o along d leaves the tube (its wall, the floor, the ceiling), and which. */
function leave(o, d) {
  let t = Infinity, what = "wall";
  const a = d[0] * d[0] + d[2] * d[2];
  if (a > EPS) {
    const b = 2 * (o[0] * d[0] + o[2] * d[2]), c = o[0] * o[0] + o[2] * o[2] - R * R, disc = b * b - 4 * a * c;
    if (disc >= 0) t = (-b + Math.sqrt(disc)) / (2 * a);
  }
  if (d[1] < -EPS) { const tf = -o[1] / d[1]; if (tf < t) { t = tf; what = "floor"; } }
  if (d[1] > EPS) { const tc = (H - o[1]) / d[1]; if (tc < t) { t = tc; what = "top"; } }
  return { t: Math.max(t, 0), what };
}
/**
 * The light's way as things stand: from the port down, off every mirror it meets, through the colour crystals (each
 * adds its colour) and into the cluster, where it shatters every crystal of a colour it carries and stops at the first of
 * another (white light stops at the first it meets). { legs: [{ a, b, cs (the colours it carries, [] for white) }],
 * shattered (ids, in the order the beam reaches them), crossed (the colour crystals it passed, by place), stop ({ what,
 * at, id? }), ins and outs ({ mirror id: the way the light reached it, and left it }), lit (the mirrors it met, in order) }.
 */
export function trace(s) {
  const legs = [], shattered = [], ins = {}, outs = {}, lit = [], crossed = [];
  const cluster = pieces(s), gone = new Set();
  let o = [...PORT], d = [0, -1, 0], cs = [], from = null, total = 0, stop = null;
  while (legs.length < MAX_LEGS && total < MAX_LENGTH) {
    let best = leave(o, d), hit = { kind: best.what };
    // the crown, a disc under the ceiling
    if (Math.abs(d[1]) > EPS) {
      const t = (CROWN_Y - o[1]) / d[1];
      if (t > EPS && t < best.t) { const q = add(o, mul(d, t)); if (radial(q) <= CROWN_R) { best = { t }; hit = { kind: "crown" }; } }
    }
    for (const m of s.mirrors) {
      if (m.id === from) continue;
      const den = dot(d, m.n);
      if (Math.abs(den) < EPS) continue;
      const t = dot(sub(m.p, o), m.n) / den;
      if (t <= EPS || t >= best.t) continue;
      if (dist(add(o, mul(d, t)), m.p) <= MR) { best = { t }; hit = { kind: "mirror", m }; }
    }
    s.crystals.forEach((c, k) => {
      if (crossed.includes(k)) return;
      const t = hitSphere(o, d, at(c), CR);
      if (t < best.t) { best = { t }; hit = { kind: "crystal", k }; }
    });
    for (const q of cluster) {
      if (gone.has(q.id)) continue;
      const t = hitSphere(o, d, q.p, PR);
      if (t < best.t) { best = { t }; hit = { kind: "piece", q }; }
    }
    const hitAt = add(o, mul(d, best.t));
    legs.push({ a: o, b: hitAt, cs: [...cs] });
    total += best.t;
    if (hit.kind === "mirror") {
      const out = reflect(d, hit.m.n);
      ins[hit.m.id] = d; outs[hit.m.id] = out;
      lit.push(hit.m.id);
      o = hitAt; d = out; from = hit.m.id;
      continue;
    }
    if (hit.kind === "crystal") {
      crossed.push(hit.k);
      const c = s.crystals[hit.k].c;
      if (!cs.includes(c)) cs = [...cs, c];
      o = hitAt; from = null;
      continue;
    }
    if (hit.kind === "piece") {
      if (cs.includes(hit.q.c)) { shattered.push(hit.q.id); gone.add(hit.q.id); o = hitAt; from = null; continue; }
      stop = { what: "piece", at: hitAt, id: hit.q.id };
      break;
    }
    stop = { what: hit.kind, at: hitAt };
    break;
  }
  return { legs, shattered, crossed, stop: stop ?? { what: "limit", at: o }, ins, outs, lit };
}

// ---------- a shot ----------
/**
 * Fires the light as things stand. Returns { state (the game after), path (trace's), shattered, fallen (ids), gain,
 * cleared (the cluster all gone), dropped (the cluster came down), crushed (ids of mirrors it came down on) }; the game
 * passed in is left as it was.
 */
export function fire(state) {
  const s = copy(state), path = trace(s);
  if (s.over) return { state: s, path, shattered: [], fallen: [], gain: 0, cleared: false, dropped: false, crushed: [] };
  removeIds(s, path.shattered);
  const fallen = unsupported(s);
  removeIds(s, fallen);
  const n = path.shattered.length + fallen.length;
  let gain = 10 * n * n;
  s.shots++;
  for (const k of path.crossed) spawnCrystal(s, k);
  const cleared = !pieces(s).length;
  if (cleared) {
    gain += CLEAR_BONUS;
    fill(s);
    s.untilDrop = dropEvery(s.shots);
  }
  s.score += gain;
  let dropped = false;
  if (!cleared && --s.untilDrop <= 0) {
    s.layers.unshift(newLayer(s, s.layers[0]?.c));
    s.untilDrop = dropEvery(s.shots);
    dropped = true;
  }
  // what the cluster now reaches: mirrors under it go back to hand, colour crystals move
  const cluster = pieces(s), crushed = s.mirrors.filter(m => cluster.some(q => dist(q.p, m.p) < PR + MR * 0.9)).map(m => m.id);
  s.mirrors = s.mirrors.filter(m => !crushed.includes(m.id));
  s.crystals.forEach((c, k) => { if (!crystalFits(s, at(c), k)) spawnCrystal(s, k); });
  if (lowest(s) - PR < LOSE_Y) s.over = true;
  return { state: s, path, shattered: path.shattered, fallen, gain, cleared, dropped, crushed };
}

// ---------- players, for the tests and the tuning ----------
/**
 * A shot set up as a simple player would: a mirror under the port turned to the nearer colour crystal it can use (one
 * past which the light has room to run on), and one in the light beyond it turned to a crystal of that colour in the
 * cluster, chosen at random ("random"), the best of four looked at ("glance") or for the most it brings down ("best");
 * "none" sets no mirror at all. (A second colour is left to luck, and to people.) Returns the game with its mirrors so
 * set, ready to fire.
 */
export function plan(state, how = "best", rnd = Math.random) {
  let s = copy(state);
  s.mirrors = [];
  if (how === "none" || s.over) return s;
  const beyond = (t, c, from) => {
    const dir = norm(sub(c, from));
    for (const step of [1.2, 1.6, 2.2, 2.8]) { const b = add(c, mul(dir, step)); if (!cantPlace(t, b)) return b; }
    return null;
  };
  // the mirror under the port, as low as leaves the light room past the crystal for a second mirror; failing that, it
  // sends the light to a mirror elsewhere in the tube that sends it through the crystal
  let pair = null;
  for (let k = 0; !pair && k < CRYSTALS; k++) {
    const c = at(s.crystals[k]);
    for (const y of [1.2, 2, 2.8, 3.6, 4.4, 5.2, 6]) {
      const a = [PORT[0], y, PORT[2]];
      if (cantPlace(s, a)) continue;
      const withA = pointMirror(addMirror(s, a), s.mid, c);
      if (!trace(withA).crossed.includes(k)) continue;
      const b = beyond(withA, c, a);
      if (b) { pair = { withA, b, k }; break; }
    }
    for (let j = 0; !pair && j < 16; j++) {
      const ang = (j / 16) * 2 * Math.PI, relay = [3.2 * Math.sin(ang), 1.6, 3.2 * Math.cos(ang)], a = [PORT[0], 1.6, PORT[2]];
      if (cantPlace(s, a) || cantPlace(s, relay)) continue;
      let t = addMirror(addMirror(s, a), relay);
      t = pointMirror(t, s.mid, relay);
      t = pointMirror(t, s.mid + 1, c);
      if (!trace(t).crossed.includes(k)) continue;
      const b = beyond(t, c, relay);
      if (b) pair = { withA: t, b, k };
    }
  }
  if (!pair) return s;
  const colour = s.crystals[pair.k].c, targets = pieces(s).filter(q => q.c === colour);
  if (!targets.length) return pair.withA;
  const withB = addMirror(pair.withA, pair.b), bid = withB.mirrors[withB.mirrors.length - 1].id;
  const tryAim = q => pointMirror(withB, bid, q.p);
  if (how === "random") return tryAim(targets[Math.floor(rnd() * targets.length)]);
  // "glance": the best of a few, as someone looks over the crystals the light would ring and takes the best they've seen
  const look = how === "glance" ? Array.from({ length: 4 }, () => targets[Math.floor(rnd() * targets.length)]) : targets;
  let best = withB, bestN = -1;
  for (const q of look) {
    const t = tryAim(q), f = fire(t), n = f.shattered.length + f.fallen.length;
    if (n > bestN) { best = t; bestN = n; }
  }
  return best;
}
