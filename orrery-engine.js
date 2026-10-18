// Orrery's rules, pure (no page): five brass rings turn round a sun, each at a speed of its own, each with twelve places
// for planets of four colours. Rings carry their planets round, so what lines up with what changes all the time:
// three, four or five planets of one colour, one to a ring, on one line out from the sun, held there for a moment, are
// an alignment, and they clear and score. You turn a ring by hand, hold it still to stop it, or send it round faster
// than it goes; a ring you let go of drifts back to its own pace (its mainspring), so a line has to be made and held
// before the rings carry it apart. Every few seconds a new planet lands on a ring, foretold a moment before; more
// often as the game goes on; an orrery with no place left for one ends the game.
// The page (orrery.js) draws it and moves the rings under a finger; tests/orrery.mjs checks this.
//
// Angles are in radians clockwise from twelve o'clock, as a clock's. A game is one object, as saved: { v, seed, n
// (draws made), t (seconds played), rings ([{ a (the ring's turn), w (its speed, radians a second), held (a finger on
// it: the page moves it), places (twelve colours 0–3 or -1 empty, from the ring's own twelve o'clock clockwise) }]),
// next ({ due (when it lands), ring, place, colour }: the planet foretold; ring -1 where no place was free then),
// locks ([{ ids, t }]: the alignments that are charging, and for how long), score, cleared (planets), aligned
// (alignments made), combo, lastLock (when), over }. `live` is what a step worked out for the page to draw: not saved.

export const RINGS = 5, PLACES = 12, COLOURS = 4, START = 14;
export const TAU = Math.PI * 2, STEP = TAU / PLACES;
/** Each ring's own speed (radians a second, clockwise positive): the inner ring fastest, neighbours opposite ways, the outer all
 *  but still. No two are within 0.28 of each other, so two rings pass a line-up faster than DWELL allows: it takes a hand. */
export const PACE = [0.62, -0.54, 0.3, -0.26, 0.02];
export const SPRING = 10;                    // seconds a ring takes to settle back (to 1/e of the way) to its pace
export const WMAX = 1.6;                     // the fastest a ring can be sent
export const TOL = 0.08;                     // half the spread (radians, 4.6 degrees) planets may have and still be in line
export const DWELL = 0.7;                    // seconds in line before they clear; 2 × TOL over the smallest gap in PACE (0.57) must stay clear of it, or chance clears lines
/** What an alignment of 3, 4 or 5 planets is worth, before the combo. */
export const AWARD = [0, 0, 0, 100, 300, 700];
export const COMBO_WINDOW = 4;               // seconds after one alignment in which the next counts on the combo
export const FORETELL = 1.2;                 // seconds a planet is shown before it lands
/** Seconds between planets at game time t: 4 at first, 0.7 at the quickest (from the fifth minute). */
export const gap = t => Math.max(0.7, 4 - t / 90);
/** The score multiplier at a combo (1, then a quarter more for each alignment in a run, to three times). */
export const multiplier = combo => Math.min(3, 1 + 0.25 * Math.max(0, combo - 1));

export const norm = a => ((a % TAU) + TAU) % TAU;
/** The shortest turn from angle a to angle b (-π to π). */
export const between = (a, b) => ((((b - a) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
export const id = (ring, place) => ring * PLACES + place;
/** Where a place is now, clockwise from twelve o'clock. */
export const angleOf = (s, ring, place) => norm(s.rings[ring].a + place * STEP);
export const room = s => s.rings.reduce((n, r) => n + r.places.filter(c => c < 0).length, 0);
export const planets = s => RINGS * PLACES - room(s);

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
 * The alignments standing: planets of one colour, three or more, one to a ring, all within 2 × TOL of each other
 * round the sun: [{ colour, ids, members ([{ ring, place }]), angle (their middle), spread }], the largest first.
 */
export function clusters(s) {
  const by = Array.from({ length: COLOURS }, () => []);
  s.rings.forEach((r, ring) => r.places.forEach((c, place) => { if (c >= 0) by[c].push({ ring, place, a: angleOf(s, ring, place) }); }));
  const out = [];
  by.forEach((pool, colour) => {
    for (;;) {
      let best = null;
      for (const anchor of pool) {
        const win = pool.filter(q => (q.a - anchor.a + TAU) % TAU <= 2 * TOL), spread = Math.max(...win.map(q => (q.a - anchor.a + TAU) % TAU));
        if (win.length >= 3 && (!best || win.length > best.win.length || (win.length === best.win.length && spread < best.spread))) best = { anchor, win, spread };
      }
      if (!best) break;
      pool = pool.filter(q => !best.win.includes(q));
      out.push({ colour, ids: best.win.map(q => id(q.ring, q.place)).sort((a, b) => a - b), members: best.win.map(q => ({ ring: q.ring, place: q.place })), angle: norm(best.anchor.a + best.spread / 2), spread: best.spread });
    }
  });
  return out.sort((a, b) => b.ids.length - a.ids.length);
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

/** A new game from a seed: rings turned to anywhere, START planets in places, none in line yet, the first foretold. */
export function newGame(seed) {
  const s = { v: 2, seed: seed >>> 0, n: 0, t: 0, rings: [], next: null, locks: [], score: 0, cleared: 0, aligned: 0, combo: 0, lastLock: -1e9, over: false };
  for (let r = 0; r < RINGS; r++) s.rings.push({ a: rnd(s) * TAU, w: PACE[r], held: false, places: new Array(PLACES).fill(-1) });
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
export const valid = g => !!g && g.v === 2 && Array.isArray(g.rings) && g.rings.length === RINGS && g.rings.every(r => Array.isArray(r.places) && r.places.length === PLACES && Number.isFinite(r.a) && Number.isFinite(r.w)) && !!g.next && Number.isFinite(g.t);
/** A copy of a game, to try something on. */
export const copy = s => structuredClone({ ...s, live: undefined });

// ---------- the hand on a ring ----------
const clamp = w => Math.max(-WMAX, Math.min(WMAX, w));
/** A finger comes down on a ring: it's the finger's to move (turnTo) until release. */
export function grab(s, ring) { s.rings[ring].held = true; }
/** The finger turns the ring to angle a, at speed w. */
export function turnTo(s, ring, a, w = 0) { const r = s.rings[ring]; r.a = norm(a); r.w = clamp(w); }
/** The finger lets go, the ring carrying on at speed w (0: stopped), and drifting back to its pace from there. */
export function release(s, ring, w = 0) { const r = s.rings[ring]; r.held = false; r.w = clamp(w); }

// ---------- time passing ----------
/**
 * Lets `dt` seconds pass, in place: the rings turn (those with no finger on them drifting back to their pace),
 * the planet foretold lands when it's due, alignments are looked for and charge, and those that have held long enough
 * clear. Returns what happened for the page to show and sound: { type: "land", ring, place, colour } | { type: "lock",
 * colour, members, angle, n, gain, combo } | { type: "over" }. Small steps, a twentieth of a second or so, so that no
 * alignment is stepped over.
 */
export function step(s, dt) {
  const events = [];
  if (s.over) return events;
  s.t += dt;
  const k = 1 - Math.exp(-dt / SPRING);
  s.rings.forEach((r, i) => { if (!r.held) { r.w += (PACE[i] - r.w) * k; r.a = norm(r.a + r.w * dt); } });
  while (s.next && s.t >= s.next.due) {
    let { ring, place, colour } = s.next;
    if (ring < 0 || s.rings[ring].places[place] >= 0) { const at = spot(s); if (!at) { s.over = true; events.push({ type: "over" }); s.live = { clusters: [] }; return events; } ({ ring, place } = at); }
    s.rings[ring].places[place] = colour;
    events.push({ type: "land", ring, place, colour });
    foretell(s);
  }
  // alignments: each charges while it holds (and keeps its charge as it gains a planet or loses one)
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
      events.push({ type: "lock", colour: c.colour, members: c.members, angle: c.angle, n, gain, combo: s.combo });
    } else {
      locks.push({ ids: c.ids, t });
      live.push({ colour: c.colour, members: c.members, angle: c.angle, spread: c.spread, progress: t / DWELL, n: c.ids.length });
    }
  }
  s.locks = locks;
  s.live = { clusters: live };
  return events;
}
