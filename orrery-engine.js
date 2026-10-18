// Orrery's rules, pure (no page): five brass hoops on a pivot axle round a sun, each with twelve places for planets of
// four colours. A hoop turns at a speed you set and keeps it until you set another (or hold it still), and can be
// tipped about the axle, which runs from twelve o'clock to six through the sun. Three, four or five planets of one colour,
// one to a hoop, in one direction from the sun, are an alignment and clear at once: along the axle (every hoop crosses
// it, at twelve and at six, however it's tipped), or anywhere between hoops tipped alike (they lie in one plane); the
// angle in between is forgiven by how far apart they are. Every few seconds a new planet lands on a hoop, foretold a
// moment before, more often as the game goes on; an orrery with no place left for one ends the game.
// The page (orrery.js) draws it and moves the rings under a finger; tests/orrery.mjs checks this.
//
// Angles are in radians clockwise from twelve o'clock, as a clock's, round the hoop's own plane. The world has x to the
// right, y up and z towards you, so twelve o'clock is -z; a hoop tipped by t lifts its three o'clock side by t. A game is
// one object, as saved: { v, seed, n (draws made), t (seconds played), rings ([{ a (the hoop's turn), w (the speed it's
// set to, radians a second), v (the speed it has now: it gets to w in a moment), tilt (its tip now), tiltTo (the tip it's
// set to), held (a finger on it: the page moves it), places (twelve colours 0–3 or -1 empty, from the hoop's own twelve
// o'clock clockwise) }]), next ({ due (when it lands), ring, place, colour }: the planet foretold; ring -1 where no
// place was free then), locks ([{ ids, t }]: the alignments standing, and for how long), score, cleared (planets),
// aligned (alignments made), combo, lastLock (when), over }. `live` is what a step worked out for the page to draw: not saved.

export const RINGS = 5, PLACES = 12, COLOURS = 4, START = 14;
export const TAU = Math.PI * 2, STEP = TAU / PLACES, DEG = Math.PI / 180;
/** The speeds a hoop is set to, by strength 1 (slow), 2 (strong) and 3 (very strong), in radians a second: a turn takes two minutes, 45 seconds, 21. */
export const SPEED = [0, 0.05, 0.14, 0.3];
export const VMAX = SPEED[3];                // the fastest a hoop can be sent, by hand or by button
/** The tips a hoop is set to, by strength 1 to 3, in radians (either way: the three o'clock side up or down). */
export const TILT = [0, 15 * DEG, 30 * DEG, 45 * DEG];
export const TILT_MAX = TILT[3];
/** Each hoop's speed to begin with: all different, neither too still nor too quick. */
export const START_SPEEDS = [0.11, -0.08, 0.05, -0.1, 0.03];
export const ACCEL = 0.3;                    // seconds a hoop takes to get to a new speed (to 1/e of the way): a hold is not at once, but quick
export const TILT_EASE = 0.3;                // and to a new tip
export const TOL = 0.07;                     // half the spread (radians, 4 degrees) planets may have, seen from the sun, and still be in line
export const DWELL = 0.1;                    // seconds in line before they clear: two hoops going very fast the opposite ways pass in a quarter of a second, a blink of one frame doesn't count
/** What an alignment of 3, 4 or 5 planets is worth, before the combo. */
export const AWARD = [0, 0, 0, 100, 300, 700];
export const COMBO_WINDOW = 8;               // seconds after one alignment in which the next counts on the combo
export const FORETELL = 1.5;                 // seconds a planet is shown before it lands
/** Seconds between planets at game time t: 6.5 at first, 2.4 at the quickest (from the fifth and a half minute). */
export const gap = t => Math.max(2.4, 6.5 - t / 80);
/** The score multiplier at a combo (1, then a quarter more for each alignment in a run, to three times). */
export const multiplier = combo => Math.min(3, 1 + 0.25 * Math.max(0, combo - 1));

export const norm = a => ((a % TAU) + TAU) % TAU;
/** The shortest turn from angle a to angle b (-π to π). */
export const between = (a, b) => ((((b - a) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
export const id = (ring, place) => ring * PLACES + place;
/** Where a place is now, clockwise from twelve o'clock, round its hoop. */
export const angleOf = (s, ring, place) => norm(s.rings[ring].a + place * STEP);
export const room = s => s.rings.reduce((n, r) => n + r.places.filter(c => c < 0).length, 0);
export const planets = s => RINGS * PLACES - room(s);
/** The direction from the sun to the point at angle a on a hoop tipped by tilt: a unit vector (x right, y up, z towards you). Every hoop is at (0, 0, -1) at twelve o'clock and (0, 0, 1) at six, tipped or not. */
export const dirOf = (tilt, a) => [Math.sin(a) * Math.cos(tilt), Math.sin(a) * Math.sin(tilt), -Math.cos(a)];
/** The angle between two directions (unit vectors), in radians. */
export const sep = (u, v) => 2 * Math.asin(Math.min(1, Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]) / 2));
const middle = list => { const m = [0, 1, 2].map(i => list.reduce((a, q) => a + q.d[i], 0)), n = Math.hypot(...m) || 1; return m.map(x => x / n); };

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rnd = s => draw(s.seed, s.n++);
const pick = (s, k) => Math.floor(rnd(s) * k);

// ---------- alignments ----------
/**
 * The alignments standing: planets of one colour, three or more, one to a hoop, all within 2 × TOL of each other as seen
 * from the sun (every one within TOL of their middle): [{ colour, ids, members ([{ ring, place }]), dir (their middle, a unit
 * vector), spread }], the largest first. Taken from each planet in turn: the nearest of its colour on every other hoop within
 * reach, the farthest from the middle dropped until the rest are close enough.
 */
export function clusters(s) {
  const by = Array.from({ length: COLOURS }, () => []);
  s.rings.forEach((r, ring) => r.places.forEach((c, place) => { if (c >= 0) by[c].push({ ring, place, d: dirOf(r.tilt, angleOf(s, ring, place)) }); }));
  const found = [];
  by.forEach((pool, colour) => {
    for (const anchor of pool) {
      const nearest = new Map([[anchor.ring, anchor]]);
      for (const q of pool) {
        if (q.ring === anchor.ring) continue;
        const d = sep(anchor.d, q.d), held = nearest.get(q.ring);
        if (d <= 2 * TOL && (!held || d < sep(anchor.d, held.d))) nearest.set(q.ring, q);
      }
      let mem = [...nearest.values()], mid = null;
      while (mem.length >= 3) {
        mid = middle(mem);
        let far = mem[0], fd = -1;
        for (const q of mem) { const d = sep(mid, q.d); if (d > fd) { fd = d; far = q; } }
        if (fd <= TOL) break;
        mem = mem.filter(q => q !== far);
      }
      if (mem.length < 3) continue;
      let spread = 0;
      for (const p of mem) for (const q of mem) spread = Math.max(spread, sep(p.d, q.d));
      found.push({ colour, mem, mid, spread });
    }
  });
  found.sort((a, b) => b.mem.length - a.mem.length || a.spread - b.spread);
  const taken = new Set(), out = [];
  for (const f of found) {
    const ids = f.mem.map(q => id(q.ring, q.place)).sort((a, b) => a - b);
    if (ids.some(x => taken.has(x))) continue;
    ids.forEach(x => taken.add(x));
    out.push({ colour: f.colour, ids, members: f.mem.map(q => ({ ring: q.ring, place: q.place })), dir: f.mid, spread: f.spread });
  }
  return out;
}

// ---------- a game ----------
/** The place a planet could land on: of two rings picked at random the one with more room, then a free place on it, or null. */
function spot(s) {
  const open = s.rings.flatMap((r, ring) => (r.places.includes(-1) ? [ring] : []));
  if (!open.length) return null;
  const free = ring => s.rings[ring].places.filter(c => c < 0).length;
  const a = open[pick(s, open.length)], b = open[pick(s, open.length)], ring = free(b) > free(a) ? b : a;
  const places = s.rings[ring].places.flatMap((c, p) => (c < 0 ? [p] : []));
  return { ring, place: places[pick(s, places.length)] };
}
/** A colour for a newcomer: any, but the scarcer ones likelier, so every colour stays in play. */
function colourFor(s) {
  const count = new Array(COLOURS).fill(0);
  for (const r of s.rings) for (const c of r.places) if (c >= 0) count[c]++;
  const top = Math.max(...count), weight = count.map(n => 1 + top - n), total = weight.reduce((a, b) => a + b, 0);
  let x = rnd(s) * total;
  for (let c = 0; c < COLOURS; c++) if ((x -= weight[c]) < 0) return c;
  return COLOURS - 1;
}
/** Foretells the next planet, to land a gap after now. */
function foretell(s) {
  const at = spot(s) ?? { ring: -1, place: -1 };
  s.next = { due: s.t + gap(s.t), ring: at.ring, place: at.place, colour: colourFor(s) };
}

/** A new game from a seed: hoops turned to anywhere, each tipped differently, START planets in places, none in line yet, the first foretold. */
export function newGame(seed) {
  const s = { v: 3, seed: seed >>> 0, n: 0, t: 0, rings: [], next: null, locks: [], score: 0, cleared: 0, aligned: 0, combo: 0, lastLock: -1e9, over: false };
  const tips = [-2, -1, 0, 1, 2].map(k => k * TILT[2] / 2);          // -30, -15, 0, 15, 30 degrees, dealt to the hoops in some order
  for (let k = tips.length - 1; k > 0; k--) { const j = pick(s, k + 1); [tips[k], tips[j]] = [tips[j], tips[k]]; }
  for (let r = 0; r < RINGS; r++) s.rings.push({ a: rnd(s) * TAU, w: START_SPEEDS[r], v: START_SPEEDS[r], tilt: tips[r], tiltTo: tips[r], held: false, places: new Array(PLACES).fill(-1) });
  // the colours in turn, so each is dealt as often as the others (to within one) and can line up
  for (let k = 0; k < START; k++) {
    const at = spot(s);
    s.rings[at.ring].places[at.place] = k % COLOURS;
  }
  // none in line at the start: swap colours with another planet until nothing is, which keeps the count of each
  const all = () => s.rings.flatMap((r, ring) => r.places.flatMap((c, place) => (c >= 0 ? [{ ring, place, c }] : [])));
  for (let guard = 0; guard < 500 && clusters(s).length; guard++) {
    const c = clusters(s)[0], m = c.members[pick(s, c.members.length)], other = all().filter(q => q.c !== c.colour);
    const o = other[pick(s, other.length)];
    s.rings[m.ring].places[m.place] = o.c;
    s.rings[o.ring].places[o.place] = c.colour;
  }
  foretell(s);
  s.live = { clusters: [] };
  return s;
}
export const valid = g => !!g && g.v === 3 && Array.isArray(g.rings) && g.rings.length === RINGS && g.rings.every(r => Array.isArray(r.places) && r.places.length === PLACES && [r.a, r.w, r.v, r.tilt, r.tiltTo].every(Number.isFinite)) && !!g.next && Number.isFinite(g.t);
/** A copy of a game, to try something on. */
export const copy = s => structuredClone({ ...s, live: undefined });

// ---------- the hand on a ring ----------
const clampW = w => Math.max(-VMAX, Math.min(VMAX, w));
const clampT = t => Math.max(-TILT_MAX, Math.min(TILT_MAX, t));
/** A finger comes down on a ring: it stops, and is the finger's to move (turnTo) until release. */
export function grab(s, ring) { const r = s.rings[ring]; r.held = true; r.v = 0; }
/** The finger turns the ring to angle a. */
export function turnTo(s, ring, a) { s.rings[ring].a = norm(a); }
/** The finger lets go, the ring carrying on at speed w (0: held where it is), and keeping it until it's set to another. */
export function release(s, ring, w = 0) { const r = s.rings[ring]; r.held = false; r.w = r.v = clampW(w); }
/** A ring set to a speed (radians a second, clockwise positive; 0 holds it still): it gets there in a moment. */
export function setSpeed(s, ring, w) { s.rings[ring].w = clampW(w); }
/** A ring set to a tip (radians, the three o'clock side up for positive): it tips there in a moment. */
export function setTilt(s, ring, t) { s.rings[ring].tiltTo = clampT(t); }

// ---------- time passing ----------
/**
 * Lets `dt` seconds pass, in place: the hoops turn (those with no finger on them getting to the speed they're set to)
 * and tip, the planet foretold lands when it's due, alignments are looked for, and those that have held for a moment
 * clear. Returns what happened for the page to show and sound: { type: "land", ring, place, colour } | { type: "lock",
 * colour, members, dir, n, gain, combo } | { type: "over" }. Small steps, a twentieth of a second or so, so that no
 * alignment is stepped over.
 */
export function step(s, dt) {
  const events = [];
  if (s.over) return events;
  s.t += dt;
  const kv = 1 - Math.exp(-dt / ACCEL), kt = 1 - Math.exp(-dt / TILT_EASE);
  for (const r of s.rings) {
    if (!r.held) { r.v = Math.abs(r.w - r.v) < 1e-4 ? r.w : r.v + (r.w - r.v) * kv; r.a = norm(r.a + r.v * dt); }
    r.tilt = Math.abs(r.tiltTo - r.tilt) < 1e-4 ? r.tiltTo : r.tilt + (r.tiltTo - r.tilt) * kt;
  }
  while (s.next && s.t >= s.next.due) {
    let { ring, place, colour } = s.next;
    if (ring < 0 || s.rings[ring].places[place] >= 0) { const at = spot(s); if (!at) { s.over = true; events.push({ type: "over" }); s.live = { clusters: [] }; return events; } ({ ring, place } = at); }
    s.rings[ring].places[place] = colour;
    events.push({ type: "land", ring, place, colour });
    foretell(s);
  }
  // alignments: each holds for DWELL (and keeps its time as it gains a planet or loses one)
  const now = clusters(s), before = s.locks, locks = [];
  const live = [];
  for (const c of now) {
    const prev = before.filter(b => b.ids.every(x => c.ids.includes(x)) || c.ids.every(x => b.ids.includes(x))).reduce((m, b) => Math.max(m, b.t), 0);
    const t = prev + dt;
    if (t >= DWELL) {
      s.combo = s.t - s.lastLock <= COMBO_WINDOW ? s.combo + 1 : 1;
      s.lastLock = s.t;
      const n = c.ids.length, gain = Math.round(AWARD[n] * multiplier(s.combo));
      for (const m of c.members) s.rings[m.ring].places[m.place] = -1;
      s.score += gain;
      s.cleared += n;
      s.aligned++;
      events.push({ type: "lock", colour: c.colour, members: c.members, dir: c.dir, n, gain, combo: s.combo });
    } else {
      locks.push({ ids: c.ids, t });
      live.push({ colour: c.colour, members: c.members, dir: c.dir, spread: c.spread, progress: t / DWELL, n: c.ids.length });
    }
  }
  s.locks = locks;
  s.live = { clusters: live };
  return events;
}
