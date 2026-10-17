// Orrery's rules, pure (no page): four brass rings of twelve places round a sun, planets of four colours standing in
// some of them. A move turns one ring one place, either way. Three or more planets of one colour on one spoke, in
// neighbouring rings, are a conjunction, and they clear. Then the planets foretold arrive: each was shown a turn ahead
// at its place and lands there, or, if the turn has put a planet in it, on the next empty place clockwise round its
// ring (then the rings beyond); a landing can complete a conjunction too. More are foretold as the game goes on, and
// an orrery with no empty place left ends it. Conjunctions on both ends of a diameter in one turn are a syzygy, a
// line through the sun, and double the turn's score. And every few turns a comet, foretold on its spoke from the
// moment the last one passed, comes in along it to the sun, and whatever stands on that spoke is swept away, unscored.
// The page (orrery.js) draws it; tests/orrery.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), places (a colour 0–3 or -1 empty, ring by ring from the
// sun, each ring from twelve o'clock clockwise), coming ([{ ring, place, colour }], foretold), comet ({ spoke, in }:
// where the next comes, and in how many turns), turns, score, over }.

export const RINGS = 4, PLACES = 12, COLOURS = 4, START = 16, COMET_EVERY = 9;
// how many planets are foretold a turn: until so many turns, so many
export const PACE = [[25, 1], [70, 2], [130, 3], [Infinity, 4]];
export const foretold = turns => PACE.find(([until]) => turns < until)[1];
export const at = (ring, place) => ring * PLACES + place;

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);

/** The places in conjunctions: three or more of a colour on a spoke, in neighbouring rings (each place once). */
export function conjunctions(places) {
  const out = [];
  for (let p = 0; p < PLACES; p++) {
    let start = 0;
    for (let r = 1; r <= RINGS; r++) {
      if (r < RINGS && places[at(r, p)] >= 0 && places[at(r, p)] === places[at(start, p)]) continue;
      if (places[at(start, p)] >= 0 && r - start >= 3) for (let k = start; k < r; k++) out.push(at(k, p));
      start = r;
    }
  }
  return out.sort((a, b) => a - b);
}
/** A colour for an empty place that makes no conjunction there as things stand. */
function quiet(s, places, i) {
  const ok = [...Array(COLOURS).keys()].filter(c => { const t = places.slice(); t[i] = c; return !conjunctions(t).includes(i); });
  return ok.length ? ok[pick(s, ok.length)] : pick(s, COLOURS);
}
const empties = places => places.flatMap((c, i) => (c < 0 ? [i] : []));
/** Foretells the next turn's planets: on empty places, none making a conjunction as things stand. */
function foretell(s) {
  s.coming = [];
  const free = empties(s.places);
  for (let k = foretold(s.turns); k > 0 && free.length; k--) {
    const i = free.splice(pick(s, free.length), 1)[0];
    s.coming.push({ ring: Math.floor(i / PLACES), place: i % PLACES, colour: quiet(s, s.places, i) });
  }
}

const comet = s => ({ spoke: pick(s, PLACES), in: COMET_EVERY });
/** A new game from a seed: START planets in place, none in a conjunction, the first foretold, and a comet. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, places: new Array(RINGS * PLACES).fill(-1), coming: [], comet: null, turns: 0, score: 0, over: false };
  for (let k = 0; k < START; k++) {
    const free = empties(s.places), i = free[pick(s, free.length)];
    s.places[i] = quiet(s, s.places, i);
  }
  foretell(s);
  s.comet = comet(s);
  return s;
}
/** A game saved before comets came in, given one. */
export function upgrade(game) {
  if (game.comet) return game;
  const s = structuredClone(game);
  s.comet = comet(s);
  return s;
}
/** The diameters (spokes p and p + 6) with a conjunction at both ends, among these cleared places: a syzygy each. */
export function syzygies(cleared) {
  const spokes = new Set(cleared.map(i => i % PLACES)), out = [];
  for (let p = 0; p < PLACES / 2; p++) if (spokes.has(p) && spokes.has(p + PLACES / 2)) out.push(p);
  return out;
}
/** Ten times the square of the planets cleared in one turn. */
export const worth = n => 10 * n * n;

/** The orrery with one ring turned so many places clockwise (nothing cleared yet). */
export function turned(places, ring, by) {
  const out = places.slice(), k = ((by % PLACES) + PLACES) % PLACES;
  for (let p = 0; p < PLACES; p++) out[at(ring, (p + k) % PLACES)] = places[at(ring, p)];
  return out;
}

/** Where a foretold planet lands: its own place if it's empty, else the next empty one clockwise, ring by ring out. */
export function landing(places, ring, place) {
  for (let k = 0; k < RINGS * PLACES; k++) {
    const r = (ring + Math.floor((place + k) / PLACES)) % RINGS, i = at(r, (place + k) % PLACES);
    if (places[i] < 0) return i;
  }
  return -1;
}
/**
 * Turns a ring a place ({ ring, by }: 1 clockwise, -1 back) and plays the turn out: the game after it, and what happened,
 * for the page to show: first (the conjunctions the turn made), landed ([{ ...foretold, at }]: where each came down),
 * then (the conjunctions the landings made), syzygy (the diameters lined up at both ends, doubling the gain), gain,
 * swept (the places a comet cleared, if one came), over. Pure: the game passed in is left as it was.
 */
export function turn(game, { ring, by }) {
  if (Math.abs(by) !== 1 || !(ring >= 0 && ring < RINGS)) throw new Error("a ring turns one place a move");
  const s = structuredClone(game);
  if (s.over) return { state: s, first: [], landed: [], then: [], syzygy: [], gain: 0, swept: [], over: true };
  s.places = turned(s.places, ring, by);
  const first = conjunctions(s.places);
  for (const i of first) s.places[i] = -1;
  const landed = [];
  for (const c of s.coming) {
    const i = landing(s.places, c.ring, c.place);
    if (i < 0) break;
    s.places[i] = c.colour;
    landed.push({ ...c, at: i });
  }
  const then = conjunctions(s.places);
  for (const i of then) s.places[i] = -1;
  const syzygy = syzygies([...first, ...then]);
  const gain = first.length + then.length ? worth(first.length + then.length) * (syzygy.length ? 2 : 1) : 0;
  s.score += gain;
  s.turns++;
  // the comet: down its spoke to the sun, sweeping it clear
  const swept = [];
  if (--s.comet.in <= 0) {
    for (let r = 0; r < RINGS; r++) { const i = at(r, s.comet.spoke); if (s.places[i] >= 0) { s.places[i] = -1; swept.push(i); } }
    s.comet = comet(s);
  }
  foretell(s);
  s.over = !s.places.some(c => c < 0);
  return { state: s, first, landed, then, syzygy, gain, swept, over: s.over };
}
/** Every turn there is, each ring a place either way: [{ ring, by }]. For the tests and the tuning players. */
export const moves = () => [...Array(RINGS).keys()].flatMap(ring => [{ ring, by: 1 }, { ring, by: -1 }]);
export const filled = s => s.places.filter(c => c >= 0).length;
