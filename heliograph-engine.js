// Heliograph's rules, pure (no page): a glass tube with a chandelier of crystals (strings of them, one under each of
// nineteen places) hanging from a crown in the middle of its top. White light falls from a port in the ceiling beside
// the crown; two colour crystals stand somewhere low in the tube. You set and turn mirrors anywhere inside the tube to
// carry the light through a colour crystal, which colours it and is spent (a new one appears), and on into the cluster:
// the beam shatters every crystal of its colour it passes and stops at the first of another colour; through both colour
// crystals it carries both colours and shatters either. White light does nothing to the cluster. Everything on a string
// below a crystal shattered falls; a skirt round the crown hides the top two layers from the side. Each chandelier hangs
// in a shape of its own (a cone, a bowl, a star…). Every few shots it comes down a layer, a new crystal at the top of
// every string; when it reaches the line low on the glass the game is over. The page (heliograph.js) draws it in 3D
// (heliograph-3d.js) or flat (heliograph-flat.js); tests/heliograph.mjs checks this.
//
// Space: y up from the floor (0) to the ceiling (H), the tube's axis at x = z = 0. A mirror is a disc silvered both
// sides, where it stands and the way it faces: the player turns them freely, but may set, move or take back only two each
// shot (MOVES; three on the first, FIRST_MOVES), the light's way drawn as they do.
//
// A game is one object, as saved: { v, seed, n (draws made from the seed), layers [{ s (a serial), c (a colour 0–3 or
// -1 for each of the CELLS) }] top first, shape (its name) and depth (each place's string when new), serial, crystals
// [{ x, y, z, c } twice], next (the colour of the next one), mirrors [{ id, p, n }], mid, moves (left this shot),
// touched and placed (mirrors moved or set this shot), shots, untilDrop, score, over }. Every random thing comes from the seed and the draw's
// number, so a game saved and opened again goes on as it would have.

export const R = 5, H = 14;                        // the tube's radius and height
export const COLOURS = 4;
export const PR = 0.4;                             // a cluster crystal's radius (a sphere, to the light)
export const CR = 0.45;                            // the colour crystal's
export const MR = 0.5;                             // a mirror's
export const MIRRORS = 6;                          // mirrors to hand
export const PORT = [0, H, 3.4];                   // where the light comes in, falling straight down
export const CROWN_Y = H - 0.5, CROWN_R = 2.15;    // the crown the cluster hangs from: a disc the light stops at
// a brass skirt round the crown, hiding the chandelier's top layers from the side: light reaches them only from below,
// up through the chandelier, so cutting a string high (which brings the most down) has to be worked for
export const SKIRT_R = 2.4, SKIRT_LAYERS = 2;
export const TOP_Y = H - 1.05;                     // the top layer's height
export const LY = 0.84;                            // between layers
export const SPACING = 0.92;                       // between neighbours in a layer
export const START_LAYERS = 7;                     // the deepest a chandelier hangs when it's new
export const MOVES = 2;                            // mirrors set, moved or taken back each shot (turning one is free)
// the first shot has one more: the tube is empty, and the light wants a mirror under the port, one past a colour crystal
// and often a third to reach into the chandelier
export const FIRST_MOVES = 3;
// `x` is a level's rules (below); without it, the endless game's
export const movesFor = (shots, x = null) => (shots ? x?.moves ?? MOVES : x?.first ?? FIRST_MOVES);
export const LOSE_Y = 2.2;                         // a crystal's foot below this ends the game
export const CLEAR_BONUS = 1000;
export const BEACON_BONUS = 100;                   // for each beacon brought down
export const PRISM_R = 0.55;                       // a prism's radius (a sphere, to the light)
export const LAMP_R = 0.5;                         // a lamp's (a sphere, to the light)
export const SKIRT_Y = TOP_Y - (SKIRT_LAYERS - 0.5) * LY;   // the skirt's foot
/** A shot's points: ten times the square of the crystals the light shatters (a long run of a colour is worth most), and ten
 *  for each that falls: cutting a string high brings it down, which buys time, but the points are in the runs. */
export const worth = (shattered, fallen) => 10 * shattered * shattered + 10 * fallen;
// shots between the cluster's drops: unhurried at first, then closer together, so a long game ends
export const PACE = [[30, 6], [70, 5], [120, 4], [180, 3], [Infinity, 2]];
export const dropEvery = (shots, x = null) => x?.every ?? PACE.find(([until]) => shots < until)[1];
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
const ringOf = c => Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r));
/**
 * The chandelier's shapes: for each of the crown's 19 places, how many crystals deep its string hangs when new (0, no
 * string). Each new chandelier takes another, so where to cut, and which string will reach the line first, differs.
 */
export const SHAPES = {
  column: () => 7,
  cone: c => [9, 7, 5][ringOf(c)],                                            // longest in the middle
  bowl: c => [4, 6, 8][ringOf(c)],                                            // longest round the edge
  hollow: c => (ringOf(c) ? 7 : 0),                                           // a tube of strings, none in the middle
  star: c => (ringOf(c) < 2 ? 8 : c.q === 0 || c.r === 0 || c.q + c.r === 0 ? 6 : 0),
  slant: c => Math.max(4, Math.min(9, Math.round(6.5 + c.x / SPACING))),     // deeper to one side
  spiral: c => (ringOf(c) ? 4 + Math.round(((Math.atan2(c.z, c.x) + Math.PI) / (2 * Math.PI)) * 5) : 7),
  sprig: c => (ringOf(c) < 2 ? 4 : 0),                                        // a small one, for a level that clears it (levels only)
};
const SHAPE_NAMES = Object.keys(SHAPES).filter(n => n !== "sprig");
/** A layer for under the crown, a crystal on every string of the shape: each a colour, often the one of a neighbour
 *  already set or of the crystal above or below, so colours come in clumps a beam can run through. */
function newLayer(s, near, here = i => s.depth[i] > 0) {
  const c = new Array(N).fill(-1), wears = s.x?.colours;                 // a level's chandelier wears some of the colours only
  for (let i = 0; i < N; i++) {
    if (!here(i)) continue;
    const r = roll(s), set = CELLS[i].nb.filter(j => j < i && c[j] >= 0);
    c[i] = near && near[i] >= 0 && r < 0.2 ? near[i] : set.length && r < 0.75 ? c[set[pick(s, set.length)]] : wears ? wears[pick(s, wears.length)] : pick(s, COLOURS);
  }
  return { s: s.serial++, c };
}
const PLACE = new Map(CELLS.map((c, i) => [`${c.q},${c.r}`, i]));
/**
 * An authored chandelier: `hang` maps a place ("q,r") to its string, top first, a digit for each crystal's colour (0 to 3)
 * and after it, if it has one, b (bolted), f (frail: two hits) or l (a lantern). Returns { layers, depth, bolts, frail, beacons }.
 */
export function hangFrom(hang) {
  const strings = CELLS.map(() => []), out = { bolts: [], frail: [], beacons: [] };
  for (const [key, text] of Object.entries(hang)) {
    const i = PLACE.get(key);
    if (i == null) throw new Error(`no place ${key}`);
    for (const [, c, f] of text.matchAll(/([0-3])([bfl]?)/g)) strings[i].push({ c: +c, f });
  }
  const depth = strings.map(a => a.length), deepest = Math.max(0, ...depth);
  const layers = Array.from({ length: deepest }, (_, k) => ({ s: k, c: strings.map(a => a[k]?.c ?? -1) }));
  strings.forEach((a, i) => a.forEach(({ f }, k) => { if (f) out[{ b: "bolts", f: "frail", l: "beacons" }[f]].push(idOf(k, i)); }));
  return { layers, depth, ...out };
}
/** A new chandelier in a shape other than the last (a level hangs its own shape every time). */
function fill(s) {
  if (s.x?.hang) {                                                       // an authored one: always the same
    const h = hangFrom(s.x.hang);
    s.shape = s.x.shape ?? "column"; s.depth = h.depth; s.layers = h.layers; s.serial = h.layers.length;
    if (h.bolts.length) s.x.bolts = h.bolts;
    if (h.frail.length) s.x.frail = h.frail;
    if (h.beacons.length) s.x.beacons = h.beacons;
    return;
  }
  if (s.x?.shape) s.shape = s.x.shape;
  else { const names = SHAPE_NAMES.filter(n => n !== s.shape); s.shape = names[pick(s, names.length)]; }
  const extra = s.x?.extra ?? 0;                                         // a level can hang it lower than the shape does
  s.depth = CELLS.map(SHAPES[s.shape]).map(d => (d > 0 ? d + extra : 0));
  const deepest = Math.max(...s.depth);
  s.layers = [];
  for (let k = 0; k < deepest; k++) s.layers.push(newLayer(s, s.layers[k - 1]?.c, i => k < s.depth[i]));
  if (s.x?.marks) dealBeacons(s);
}
/**
 * Beacons: crystals wearing a brass collar that must come down, on `marks.n` strings of their own, `marks.at` saying how
 * high: "bottom" (the lowest of a string, which any cut on the string brings down), "mid" (somewhere with two crystals above it
 * and one below, so it takes a cut above it) or "high" (the third layer or just under, so the cut has to be near the top, and from below).
 */
function dealBeacons(s) {
  const { n, at = "mid" } = s.x.marks, spots = [];
  for (let i = 0; i < N; i++) {
    const d = s.depth[i];
    if (d < 1) continue;
    const ks = at === "bottom" ? [d - 1] : at === "high" ? [2, 3].filter(k => k < d - 1) : Array.from({ length: Math.max(0, d - 3) }, (_, j) => 2 + j);
    if (ks.length) spots.push({ i, ks });
  }
  s.x.beacons = [];
  for (let m = 0; m < n && spots.length; m++) {
    const w = spots.splice(pick(s, spots.length), 1)[0], k = w.ks[pick(s, w.ks.length)];
    s.x.beacons.push(idOf(s.layers[k].s, w.i));
  }
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
  const out = [], bolted = s.x?.bolts ?? [];
  for (let i = 0; i < N; i++) {
    let held = true;
    // a bolted crystal holds on its own, and what hangs from it
    s.layers.forEach(l => { if (l.c[i] < 0) held = false; else if (bolted.includes(idOf(l.s, i))) held = true; else if (!held) out.push(idOf(l.s, i)); });
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
export const CRYSTALS = 2;             // colour crystals in the tube at once (a level can have fewer)
/** Where a new colour crystal may stand: low in the tube, clear of the wall, the cluster, the mirrors, the fixtures and the other crystal. */
function crystalFits(s, p, except = -1) {
  if (radial(p) > R - 0.8 || p[1] < 0.9) return false;
  if (s.mirrors.some(m => dist(m.p, p) < CR + MR + 0.5)) return false;
  if (s.crystals.some((c, k) => k !== except && c && dist(at(c), p) < 2 * CR + 1.2)) return false;
  if (fixtures(s).some(f => gap(f, p) < CR + 0.5)) return false;
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
/**
 * A new game: the endless one, or (with `x`) a level's. `x` is the level's rules, kept in the game as it is saved so a
 * game opened again plays by them: { lv (its number), shape, colours (the chandelier wears), extra (layers lower than the
 * shape hangs), marks ({ n, at }: beacons), crystals (colour crystals in the tube, 0 to 2), moves, first, mirrors (to hand), every (shots
 * between the chandelier's drops), line, shots (the level's length), goal ({ kind: "score", n } | { kind: "beacons" } |
 * { kind: "clear" }), fix (fixtures: { k: "prism", p, cs } | { k: "shutter", p, n, r, cycle }), sun ({ from, to }: degrees
 * off the vertical over the level's shots), port }. Once the goal is met the game keeps `met` and `metAt`; `won` says how it ended.
 */
export function newGame(seed, x = null) {
  const n = x?.gems?.length ?? x?.crystals ?? CRYSTALS;
  const s = { v: 4, seed: seed >>> 0, n: 0, shape: null, depth: [], layers: [], serial: 0, crystals: new Array(n).fill(null), next: null, mirrors: [], mid: 0,
    moves: movesFor(0, x), touched: [], placed: [], shots: 0, untilDrop: dropEvery(0, x), score: 0, over: false };
  if (x) s.x = JSON.parse(JSON.stringify(x));
  fill(s);
  if (x?.gems) s.crystals = x.gems.map(g => ({ ...g }));                 // an authored level's colour crystals stay where they are
  else for (let k = 0; k < n; k++) spawnCrystal(s, k);
  for (const m of x?.pins ?? []) s.mirrors.push({ id: s.mid++, p: [...m.p], n: norm(m.n) || [0, 1, 0], pin: true });
  return s;
}
export const copy = s => JSON.parse(JSON.stringify(s));
/** A level's fixtures (a prism, shutters), or none. */
export const fixtures = s => s.x?.fix ?? [];
/** How far a point is from a fixture's surface (a prism is a sphere, a shutter a disc). */
function gap(f, p) {
  if (f.k === "prism") return dist(f.p, p) - PRISM_R;
  if (f.k === "lamp") return dist(f.p, p) - LAMP_R;
  const v = sub(p, f.p), h = dot(v, f.n), inPlane = len(sub(v, mul(f.n, h)));
  return inPlane <= f.r ? Math.abs(h) : Math.hypot(inPlane - f.r, h);
}
/** Whether a shutter is closed for the shot now: always, or by its cycle (1 closed, 0 open, by the shot's number). */
export const closed = (s, f) => !f.cycle || f.cycle[s.shots % f.cycle.length] === 1;
/** A level's lamps (targets), in the order the level lists them. */
export const lampsOf = s => fixtures(s).filter(f => f.k === "lamp");
/** How many lamps are lit (a signal: how far it has got). */
export const litCount = s => (s.lit ?? []).length;
/** Whether a lamp's goal is met by the lamps lit. */
export const lampsDone = s => { const n = lampsOf(s).length; return n > 0 && litCount(s) >= n; };
/** The mirrors still to hand: a level can give fewer than six, and a pinned mirror is no one of them. */
export const handLeft = s => (s.x?.hand ?? MIRRORS) - s.mirrors.filter(m => !m.pin).length;
export const lineOf = s => s.x?.line ?? LOSE_Y;
/** The beacons still hanging (ids), or none. */
export const beaconsOf = s => s.x?.beacons ?? [];
/** The sun's angle off the vertical, in degrees, for a shot (0 with no sun): it crosses from `from` to `to` over the level's shots. */
export function sunAngle(s, shots = s.shots) {
  const u = s.x?.sun;
  if (!u) return 0;
  const span = Math.max(1, (s.x.shots ?? 8) - 1);
  return u.from + (u.to - u.from) * Math.min(1, shots / span);
}
/** The light as it comes in: where it enters (the port) and which way it goes, down, or aslant by the sun. */
export function lightAt(s, shots = s.shots) {
  const a = (sunAngle(s, shots) * Math.PI) / 180;
  return { o: [...(s.x?.port ?? PORT)], d: [Math.sin(a), -Math.cos(a), 0] };
}

// ---------- mirrors ----------
/** Why a mirror can't stand at p (null if it can): inside the tube, under the crown, clear of the cluster, the colour
 *  crystals and the other mirrors (`except`, the one being moved). */
export function cantPlace(s, p, except = null) {
  if (radial(p) > R - MR - 0.1 || p[1] < MR + 0.1 || p[1] > H - 1.1) return "inside the tube";
  if (radial(p) < SKIRT_R + MR && p[1] > SKIRT_Y - MR - 0.1) return "clear of the crown";
  if (pieces(s).some(q => dist(q.p, p) < PR + MR * 0.9)) return "clear of the cluster";
  if (s.crystals.some(c => dist(at(c), p) < CR + MR + 0.1)) return "clear of the colour crystals";
  const near = fixtures(s).find(f => gap(f, p) < MR + 0.1);
  if (near) return `clear of the ${near.k}`;
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
/** Whether a mirror may be moved (or a new one set) now: a move left this shot, or the mirror already set or moved this
 *  shot, which may be moved again. */
export const canMove = (s, id = null) => !s.over && !(id != null && s.mirrors.find(m => m.id === id)?.pin) && (s.moves > 0 || (id != null && s.touched.includes(id)));
function spend(t, id) { if (!t.touched.includes(id)) { t.moves--; t.touched.push(id); } }
/** A new mirror at p facing n: a move. Unchanged when there's no move left or no mirror in hand. */
export function addMirror(s, p, n = [0, 1, 0]) {
  if (!canMove(s) || handLeft(s) <= 0) return s;
  const t = copy(s), id = t.mid++;
  t.mirrors.push({ id, p, n: norm(n) || [0, 1, 0] });
  spend(t, id);
  t.placed.push(id);
  return t;
}
/** A mirror moved: a move, unless it was set or moved this shot. */
export function moveMirror(s, id, p) {
  if (!canMove(s, id)) return s;
  const t = edit(s, id, m => { m.p = p; });
  spend(t, id);
  return t;
}
/** A mirror turned: free, as often as you like. */
export const turnMirror = (s, id, n) => edit(s, id, m => { m.n = norm(n) || m.n; });
/** A mirror taken back to hand: a move, unless it was set this shot (then the move it took comes back). */
export function takeMirror(s, id) {
  const fresh = s.placed.includes(id);
  if (s.mirrors.find(m => m.id === id)?.pin || (!fresh && !canMove(s, id))) return s;
  const t = copy(s);
  t.mirrors = t.mirrors.filter(m => m.id !== id);
  if (fresh) { t.moves++; t.placed = t.placed.filter(x => x !== id); t.touched = t.touched.filter(x => x !== id); }
  else spend(t, id);
  return t;
}
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
/** Where a ray from o along d first meets the skirt round the crown (an open cylinder), or Infinity. */
function hitSkirt(o, d) {
  const a = d[0] * d[0] + d[2] * d[2], r = SKIRT_R, foot = SKIRT_Y;
  if (a < EPS) return Infinity;
  const b = 2 * (o[0] * d[0] + o[2] * d[2]), c = o[0] * o[0] + o[2] * o[2] - r * r, disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  for (const t of [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)]) {
    if (t <= EPS) continue;
    const y = o[1] + d[1] * t;
    if (y >= foot && y <= CROWN_Y) return t;
  }
  return Infinity;
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
  const legs = [], shattered = [], ins = {}, outs = {}, lit = [], crossed = [], cross = [], lamps = [], cracked = [], ends = [];
  const cluster = pieces(s), gone = new Set(), fix = fixtures(s), light = lightAt(s), frail = s.x?.frail ?? [], hurt = new Set(s.hurt ?? []);
  // beams to follow: the light itself, and what a splitter sends off at an angle (t0: how far along its way a beam starts)
  const beams = [{ o: light.o, d: light.d, cs: [], from: null, t0: 0, thru: [], via: [] }];
  let total = 0, stop = null;
  for (let bi = 0; bi < beams.length && legs.length < MAX_LEGS && total < MAX_LENGTH; bi++) {
    const B = beams[bi];
    let { o, d, cs, from } = B, end = null;
    while (legs.length < MAX_LEGS && total < MAX_LENGTH) {
      let best = leave(o, d), hit = { kind: best.what };
      // the crown, a disc under the ceiling
      if (Math.abs(d[1]) > EPS) {
        const t = (CROWN_Y - o[1]) / d[1];
        if (t > EPS && t < best.t) { const q = add(o, mul(d, t)); if (radial(q) <= CROWN_R) { best = { t }; hit = { kind: "crown" }; } }
      }
      // its skirt, from either side
      {
        const t = hitSkirt(o, d);
        if (t < best.t) { best = { t }; hit = { kind: "skirt" }; }
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
        if (B.thru.includes(k)) return;
        const t = hitSphere(o, d, at(c), CR);
        if (t < best.t) { best = { t }; hit = { kind: "crystal", k }; }
      });
      fix.forEach((f, i) => {
        if (f.k === "shutter") {                                // shut, it stops the light like a wall
          const den = dot(d, f.n);
          if (!closed(s, f) || Math.abs(den) < EPS) return;
          const t = dot(sub(f.p, o), f.n) / den;
          if (t > EPS && t < best.t && dist(add(o, mul(d, t)), f.p) <= f.r) { best = { t }; hit = { kind: "shutter" }; }
        } else if (f.k === "split") {                           // half-silvered: the light goes on and turns
          const den = dot(d, f.n);
          if (from === `s${i}` || Math.abs(den) < EPS) return;
          const t = dot(sub(f.p, o), f.n) / den;
          if (t > EPS && t < best.t && dist(add(o, mul(d, t)), f.p) <= f.r) { best = { t }; hit = { kind: "split", i }; }
        } else if (f.k === "lamp") {
          const t = hitSphere(o, d, f.p, LAMP_R);
          if (t < best.t) { best = { t }; hit = { kind: "lamp", i }; }
        } else if (!B.via.includes(i)) {                        // a prism lets the light through, in its colours too
          const t = hitSphere(o, d, f.p, PRISM_R);
          if (t < best.t) { best = { t }; hit = { kind: "prism", i }; }
        }
      });
      for (const q of cluster) {
        if (gone.has(q.id)) continue;
        const t = hitSphere(o, d, q.p, PR);
        if (t < best.t) { best = { t }; hit = { kind: "piece", q }; }
      }
      const hitAt = add(o, mul(d, best.t));
      legs.push({ a: o, b: hitAt, cs: [...cs], t0: B.t0 });
      B.t0 += best.t;
      total += best.t;
      if (hit.kind === "mirror") {
        const out = reflect(d, hit.m.n);
        ins[hit.m.id] = d; outs[hit.m.id] = out;
        lit.push(hit.m.id);
        o = hitAt; d = out; from = hit.m.id;
        continue;
      }
      if (hit.kind === "split") {
        const f = fix[hit.i];
        beams.push({ o: hitAt, d: reflect(d, f.n), cs: [...cs], from: `s${hit.i}`, t0: B.t0, thru: [...B.thru], via: [...B.via] });
        o = hitAt; from = `s${hit.i}`;
        continue;
      }
      if (hit.kind === "crystal") {
        B.thru.push(hit.k);
        if (!crossed.includes(hit.k)) crossed.push(hit.k);
        cross.push({ kind: "crystal", k: hit.k, leg: legs.length - 1 });
        const c = s.crystals[hit.k].c;
        if (!cs.includes(c)) cs = [...cs, c];
        o = hitAt; from = null;
        continue;
      }
      if (hit.kind === "prism") {
        B.via.push(hit.i);
        cross.push({ kind: "prism", i: hit.i, leg: legs.length - 1 });
        for (const c of fix[hit.i].cs) if (!cs.includes(c)) cs = [...cs, c];
        o = hitAt; from = null;
        continue;
      }
      if (hit.kind === "lamp") {
        lamps.push({ i: lampsOf(s).indexOf(fix[hit.i]), ok: fix[hit.i].c < 0 || cs.includes(fix[hit.i].c), leg: legs.length - 1 });
        end = { what: "lamp", at: hitAt };
        break;
      }
      if (hit.kind === "piece") {
        if (cs.includes(hit.q.c)) {
          if (frail.includes(hit.q.id) && !hurt.has(hit.q.id)) {             // a frail one cracks, and the light is spent on it
            hurt.add(hit.q.id); cracked.push(hit.q.id);
            end = { what: "crack", at: hitAt, id: hit.q.id };
            break;
          }
          shattered.push(hit.q.id); gone.add(hit.q.id); o = hitAt; from = null;
          continue;
        }
        end = { what: "piece", at: hitAt, id: hit.q.id };
        break;
      }
      end = { what: hit.kind, at: hitAt };
      break;
    }
    if (end) ends.push(end);
    if (bi === 0) stop = end;
  }
  return { legs, shattered, crossed, cross, stop: stop ?? { what: "limit", at: legs.at(-1)?.b ?? light.o }, ends, lamps, cracked, ins, outs, lit };
}

// ---------- a shot ----------
/**
 * Fires the light as things stand. Returns { state (the game after), path (trace's), shattered, fallen (ids), gain,
 * cleared (the cluster all gone), dropped (the cluster came down), crushed (ids of mirrors it came down on), downed
 * (beacons brought down) }; the game passed in is left as it was. In a level the shot may end it (`over`, and `won` if the goal was met).
 */
export function fire(state) {
  const s = copy(state), path = trace(s), x = s.x, g = x?.goal;
  if (s.over) return { state: s, path, shattered: [], fallen: [], gain: 0, cleared: false, dropped: false, crushed: [], downed: 0, lamps: [] };
  removeIds(s, path.shattered);
  const fallen = unsupported(s);
  removeIds(s, fallen);
  let gain = worth(path.shattered.length, fallen.length);
  const down = beaconsOf(s).filter(id => !pieceById(s, id));
  if (down.length) { x.beacons = beaconsOf(s).filter(id => !down.includes(id)); gain += BEACON_BONUS * down.length; }
  // what stays of the frail and the bolted, and which crystals are cracked
  if (x?.frail) { s.hurt = [...new Set([...(s.hurt ?? []), ...path.cracked])].filter(id => pieceById(s, id)); x.frail = x.frail.filter(id => pieceById(s, id)); }
  if (x?.bolts) x.bolts = x.bolts.filter(id => pieceById(s, id));
  // the lamps this shot lit: kept (all), only those of this shot (together), or one after the other (a signal)
  const lamps = path.lamps.filter(l => l.ok).map(l => l.i);
  if (g?.kind === "lamps") {
    if (g.mode === "together") s.lit = [...new Set(lamps)];
    else if (g.mode === "order") { while (lamps.includes(litCount(s))) s.lit = [...(s.lit ?? []), litCount(s)]; }
    else s.lit = [...new Set([...(s.lit ?? []), ...lamps])];
  }
  s.shots++;
  s.moves = movesFor(s.shots, x); s.touched = []; s.placed = [];
  if (!x?.gems) for (const k of path.crossed) spawnCrystal(s, k);
  const cleared = !pieces(s).length && !(x?.hang && !Object.keys(x.hang).length);      // a level of lamps alone hangs no chandelier
  // a level of beacons, lamps or of clearing ends with the chandelier; any other hangs a new one
  const ends = x?.hang || (g && (g.kind === "clear" || g.kind === "beacons" || g.kind === "lamps"));
  if (cleared) {
    gain += CLEAR_BONUS;
    if (!ends) { fill(s); s.untilDrop = dropEvery(s.shots, x); }
  }
  s.score += gain;
  let dropped = false;
  if (!cleared && --s.untilDrop <= 0) {
    s.layers.unshift(newLayer(s, s.layers[0]?.c));        // a crystal more on every string of the shape
    s.untilDrop = dropEvery(s.shots, x);
    dropped = true;
  }
  // what the cluster now reaches: mirrors under it go back to hand, colour crystals move
  const cluster = pieces(s), crushed = s.mirrors.filter(m => !m.pin && cluster.some(q => dist(q.p, m.p) < PR + MR * 0.9)).map(m => m.id);
  s.mirrors = s.mirrors.filter(m => !crushed.includes(m.id));
  if (!x?.gems) s.crystals.forEach((c, k) => { if (!crystalFits(s, at(c), k)) spawnCrystal(s, k); });
  if (g && !s.met && (g.kind === "score" ? s.score >= g.n : g.kind === "beacons" ? !beaconsOf(s).length : g.kind === "lamps" ? lampsDone(s) : cleared)) { s.met = true; s.metAt = s.shots; }
  if (s.met && g.kind !== "score") s.over = true;           // a score is gone on past, for the stars
  if (lowest(s) - PR < lineOf(s)) s.over = true;
  if (x?.shots && s.shots >= x.shots) s.over = true;
  if (g && s.over) s.won = !!s.met;
  return { state: s, path, shattered: path.shattered, fallen, gain, cleared, dropped, crushed, downed: down.length, lamps };
}

// ---------- players, for the tests and the tuning ----------
/** What a simple player wants of a shot (fire()'s result): the level's own aim, then the points. */
export function wanted(s, f) {
  const g = s.x?.goal?.kind;
  if (g === "beacons") return f.downed * 1e6 + f.gain;
  if (g === "lamps") return litCount(f.state) * 1e6 + f.gain;
  if (g === "clear") return (f.shattered.length + f.fallen.length) * 1e3 + f.gain;
  return f.gain;
}
/**
 * A shot set up as a simple player would, within the moves a shot has: the mirror in the light (set there, or moved
 * down it, if it must be) turned to a gate (a colour crystal, or a prism) past which the light has room to run on, and
 * another mirror (set, or the nearest moved) in the light beyond it, turned to a crystal of the colour the light then
 * carries in the cluster, chosen at random ("random"), the best of four looked at ("glance"), of ten ("keen") or the one `wanted`
 * most ("best", which looks at every one and tries every gate); "none" sets nothing. Mirrors it doesn't use stay where they are. (A second
 * colour is left to luck, and to people.) Returns the game so set, ready to fire.
 */
export function plan(state, how = "best", rnd = Math.random) {
  const s = copy(state);
  if (how === "none" || s.over) return s;
  // the light at a height; high under a sun, where a mirror can stay put as the sun moves, on the line of the middle of the day
  const along = (L, h) => add(L.o, mul(L.d, (h - L.o[1]) / L.d[1])), now = lightAt(s), noon = s.x?.sun ? lightAt(s, (s.x.shots - 1) / 2) : now;
  const point = h => along(s.x?.sun && h >= 12.5 ? noon : now, h);
  const a0 = s.mirrors.find(m => m.id === trace(s).lit[0]);
  const lampGoal = s.x?.goal?.kind === "lamps";
  const gates = [
    ...s.crystals.map((c, k) => ({ p: at(c), through: path => path.crossed.includes(k) })),
    ...fixtures(s).flatMap((f, i) => (f.k === "prism" ? [{ p: f.p, through: path => path.cross.some(x => x.kind === "prism" && x.i === i) }] : [])),
  ];
  const beyond = (t, c, from, a) => {
    const dir = norm(sub(c, from));
    for (const step of [1.2, 1.6, 2.2, 2.8]) { const b = add(c, mul(dir, step)); if (!cantPlace(t, b, t.mirrors.find(m => m.id !== a)?.id)) return b; }
    return null;
  };
  // under the sun the mirror in the light is best high, near the port, where the light stays on it as the sun moves
  const heights = a0?.pin ? [a0.p[1]] : (a0 ? [a0.p[1]] : []).concat(s.x?.sun ? [12.9, 11.6, 10.4, 9, 7.5] : [], [1.2, 2, 2.8, 3.6, 4.4, 5.2, 6], !s.x?.sun && fixtures(s).length ? [7.5, 9, 10.5, 12] : []);
  // the first mirror, in the light, turned to the gate: { t, a (its id), b (where the second goes) }, or null
  const route = gate => {
    for (const y of heights) {
      const p = point(y);
      let t = s, id;
      if (a0 && y === a0.p[1]) id = a0.id;
      else if (a0) { if (cantPlace(s, p, a0.id)) continue; t = moveMirror(s, a0.id, p); id = a0.id; }
      else { if (cantPlace(s, p)) continue; t = addMirror(s, p); id = t.mid - 1; }
      if (t === s && !(a0 && y === a0.p[1])) continue;
      t = pointMirror(t, id, gate.p);
      if (!gate.through(trace(t))) continue;
      const b = beyond(t, gate.p, p, id);
      if (b) return { t, a: id, b };
    }
    return null;
  };
  // the second mirror, beyond the gate, and what it is turned to
  const finish = set => {
    let t = set.t;
    const other = t.mirrors.filter(m => m.id !== set.a && !m.pin).sort((m, n) => dist(m.p, set.b) - dist(n.p, set.b))[0];
    let bid;
    if (other && canMove(t, other.id)) { t = moveMirror(t, other.id, set.b); bid = other.id; }
    else if (canMove(t) && handLeft(t) > 0) { t = addMirror(t, set.b); bid = t.mid - 1; }
    else return { t, v: -Infinity };
    const arriving = trace(t).legs.find(l => dist(l.b, set.b) < MR + 0.05), targets = (lampGoal ? lampsOf(t).filter(f => f.c < 0 || arriving?.cs.includes(f.c)) : pieces(t).filter(q => arriving?.cs.includes(q.c))).map(q => (q.p ? { ...q } : q));
    if (!targets.length) return { t, v: -Infinity };
    const tryAim = q => pointMirror(t, bid, q.p);
    if (how === "random") return { t: tryAim(targets[Math.floor(rnd() * targets.length)]), v: 0 };
    // "glance": the best of a few, as someone looks over the crystals the light would ring and takes the best they've seen
    // ("keen": of ten, as a patient person with the preview in front of them)
    const looks = { glance: 4, keen: 10 }[how];
    const look = looks ? Array.from({ length: looks }, () => targets[Math.floor(rnd() * targets.length)]) : targets;
    let best = { t, v: -Infinity };
    for (const q of look) {
      const u = tryAim(q), v = wanted(u, fire(u));
      if (v > best.v) best = { t: u, v };
    }
    return best;
  };
  let chosen = null;
  for (const gate of gates) {
    const set = route(gate);
    if (!set) continue;
    const done = finish(set);
    if (!chosen || done.v > chosen.v) chosen = done;
    if (how !== "best" && how !== "keen") break;
  }
  return chosen ? chosen.t : s;
}
