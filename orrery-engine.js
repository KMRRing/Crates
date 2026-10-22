// Orrery's rules, pure (no page): four brass hoops on a pivot axle round a sun, each with twelve places for planets of
// four colours, stepping on a beat. The beat is a metronome the player sets, from twenty beats a minute up to sixty (one
// a second, the fastest). A hoop is set to stand still or to step left or right every third beat, every second, every
// beat, or two places every beat, and keeps that until it's set again; a place is a twelfth of a turn, so between steps
// every planet is exactly on one of twelve places, and nothing coasts. A hoop is tipped about the axle (a rod from twelve
// o'clock through the sun to six) by 15, 30 or 45 degrees either way, or lies level, and every so often it tips a step
// further by itself (its drift), one way until it reaches 45 degrees and then back, each hoop at its own steady pace.
// Three or four planets of one colour on hoops standing still, one to a hoop, in one direction from the sun, are a line,
// and the next beat strikes it: they clear and score. One direction is at twelve o'clock or at six (on the axle, which
// every hoop crosses however it's tipped), for any colour at any tips; or one place round hoops tipped to that colour's
// plane, a tip of its own (PLANE): yellow's at −45 degrees, green's −15, blue's 15 and red's 45. Only hoops standing still
// make a line, so nothing lines up by chance as hoops go round: you stop them there. Every few seconds, on the clock and
// not the beat, a new planet lands, foretold a moment before, more often as the game goes on; an orrery with no place
// left for one ends the game. The page (orrery.js) draws it and takes the hand; tests/orrery.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), t (seconds played), tempo (an index into TEMPOS), beat (beats
// so far), lastBeat and beatAt (the time of the last beat and of the next), rings ([{ a (the hoop's turn, in places,
// 0–11: where its own twelve o'clock place is now, clockwise), set (-4 to 4: still, or stepping left (negative) or right
// every third beat, every second, every beat, or two places every beat, by its size), due (the beat on which it steps
// next), tip (-3 to 3, in fifteen degrees: the three o'clock side up for positive), places (twelve colours 0–3 or -1
// empty, from the hoop's own twelve o'clock clockwise), moved and dir (when it last stepped, and how many places which
// way: for drawing the step), tipFrom and tipAt (the tip it was turning from, and when: for drawing the tip), drift (its
// pace: seconds between drifts), driftAt (when it drifts next), way (which way it drifts next: 1 up, -1 down) }]), next
// ({ due (when it lands), ring, place, colour }: the planet foretold; ring -1 where no place was free then), locks
// ([{ colour, key, ids, members, dir, at }]: the lines standing, each since `at`, to be struck on the beat), score, cleared
// (planets), aligned (lines struck), fours (of them, four planets), combo, lastLock (when), over }. Every change happens
// at an exact time, whatever the steps of time it's played in, so a game goes on the same whether it's played a frame at
// a time or a minute at once.

export const VERSION = 5;
export const RINGS = 4, PLACES = 12, COLOURS = 4, START = 10;
export const TAU = Math.PI * 2, STEP = TAU / PLACES, DEG = Math.PI / 180;
/** The tempos, in beats a minute, slowest first: the fastest is one beat a second. */
export const TEMPOS = [20, 30, 45, 60];
export const FIRST_TEMPO = 2;               // a first game's (the player's last choice after that, which the page keeps)
/** A hoop's settings go from -SPIN to SPIN: still, then every third beat, every second, every beat and two places every beat. */
export const SPIN = 4;
/** Beats between a hoop's steps, by the size of its setting. */
export const EVERY = [0, 3, 2, 1, 1];
/** Places a step goes, by the size of its setting: one, or two at the fastest (60 degrees on each beat). */
export const STRIDE = [0, 1, 1, 1, 2];
export const TIP = 15 * DEG, TIP_MAX = 3;   // a tip is a whole number of fifteen degrees, up to 45 either way
/**
 * Each colour's plane: the tip (in fifteen degrees) on which its planets line up away from the gates. Fixed, so a player
 * learns them; every other tip, so one drift always takes a hoop out of its plane and one press puts it back, and level
 * is no colour's.
 */
export const PLANE = [-3, -1, 1, 3];
/** The colour whose plane a tip is, or -1. */
export const planeOf = tip => PLANE.indexOf(tip);
/** The hoops' paces of drift, in seconds between one and the next: dealt to the four from the seed, so each has its own. */
export const DRIFT = [30, 36, 42, 48];
export const TICK = 0.25;                   // seconds a step is drawn over: a short tick, like a wheel let go by an escapement
export const TIP_TIME = 0.35;               // and a tip
export const DWELL = 0.3;                   // seconds a line shows at least before a beat strikes it: what made it (a stop, a tip, a landing) has been drawn by then
/** What a line of 3 or 4 planets is worth, before the combo. */
export const AWARD = [0, 0, 0, 100, 300];
export const COMBO_WINDOW = 8;              // seconds after one line in which the next counts on the combo
export const FORETELL = 1.5;                // seconds a planet is shown before it lands
/** The pace of the planets: seconds between them at first, the quickest they come to, and the seconds in which the gap between the two halves. */
export const PACE = { first: 6.5, least: 1, half: 200 };
/** Seconds between planets at game time t: quicker and quicker, ever more slowly, towards the quickest. */
export const gap = t => PACE.least + (PACE.first - PACE.least) * 2 ** (-t / PACE.half);
/** The score multiplier at a combo (1, then a quarter more for each line in a run, to three times). */
export const multiplier = combo => Math.min(3, 1 + 0.25 * Math.max(0, combo - 1));
/** Seconds between beats at a game's tempo. */
export const period = s => 60 / TEMPOS[s.tempo];

/** The shortest turn from angle a to angle b (-π to π): which way, and how far, a finger went round the sun. */
export const between = (a, b) => ((((b - a) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
const mod = q => ((q % PLACES) + PLACES) % PLACES;
export const id = (ring, place) => ring * PLACES + place;
/** Where a hoop's place is now, as one of the twelve places round the sun (0 at twelve o'clock, clockwise). */
export const seatOf = (s, ring, place) => mod(s.rings[ring].a + place);
/** And as an angle, clockwise from twelve o'clock. */
export const angleOf = (s, ring, place) => seatOf(s, ring, place) * STEP;
export const room = s => s.rings.reduce((n, r) => n + r.places.filter(c => c < 0).length, 0);
export const planets = s => RINGS * PLACES - room(s);
/** The direction from the sun to the point at angle a on a hoop tipped by tilt (radians): a unit vector (x right, y up, z towards you). Every hoop is at (0, 0, -1) at twelve o'clock and (0, 0, 1) at six, tipped or not. */
export const dirOf = (tilt, a) => [Math.sin(a) * Math.cos(tilt), Math.sin(a) * Math.sin(tilt), -Math.cos(a)];
/**
 * Which way from the sun a hoop's place lies, as a name: "N" at twelve o'clock and "S" at six (on the axle, whatever the
 * tip), otherwise the hoop's tip and the place round ("2@4": tipped 30 degrees, at four o'clock). Planets of one name are
 * in one direction, exactly: away from the axle, two hoops share a direction only where they're tipped alike.
 */
export function keyOf(r, place) {
  const q = mod(r.a + place);
  return q === 0 ? "N" : q === PLACES / 2 ? "S" : `${r.tip}@${q}`;
}
const gate = key => key === "N" || key === "S";

// ---------- drawing a step and a tip ----------
/** A step's tick: off quickly, past the place by a hair, and back onto it (an escapement's wheel, not a slide). */
const tick = u => { const v = u - 1; return 1 + 2.1 * v * v * v + 1.1 * v * v; };
/** The hoop's turn to draw at time t, in places: its last step (one place or two) ticking from where it was. */
export function turnOf(r, t) {
  const u = (t - r.moved) / TICK;
  return u >= 1 ? r.a : r.a - r.dir * (1 - tick(Math.max(0, u)));
}
const smooth = u => u * u * (3 - 2 * u);
/** The hoop's tip to draw at time t, in radians: turning from where it was to the tip it's set to. */
export function tiltOf(r, t) {
  const u = (t - r.tipAt) / TIP_TIME;
  return (u >= 1 ? r.tip : r.tipFrom + (r.tip - r.tipFrom) * smooth(Math.max(0, u))) * TIP;
}

// ---------- chance ----------
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rnd = s => draw(s.seed, s.n++);
const pick = (s, k) => Math.floor(rnd(s) * k);
const shuffle = (s, list) => { for (let k = list.length - 1; k > 0; k--) { const j = pick(s, k + 1); [list[k], list[j]] = [list[j], list[k]]; } return list; };

// ---------- lines ----------
/**
 * The lines standing: three or more planets of one colour on hoops standing still, in one direction (`keyOf`), which
 * puts them on different hoops; away from the gates only on hoops tipped to the colour's plane: [{ colour, key, ids,
 * members ([{ ring, place }], inner hoop first), dir (the direction, a unit vector) }], the largest first. A planet has
 * one direction, so no two lines share a planet.
 */
export function clusters(s) {
  const groups = new Map();
  s.rings.forEach((r, ring) => {
    if (r.set) return;                                              // a hoop set going is in no line, wherever it stands
    r.places.forEach((c, place) => {
      if (c < 0) return;
      const key = keyOf(r, place);
      if (!gate(key) && r.tip !== PLANE[c]) return;                 // off the axle, a planet lines up only in its colour's plane
      const k = `${c}|${key}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push({ ring, place });
    });
  });
  const out = [];
  for (const [k, members] of groups) {
    if (members.length < 3) continue;
    const [colour, key] = k.split("|"), { ring, place } = members[0], r = s.rings[ring];
    out.push({ colour: Number(colour), key, ids: members.map(m => id(m.ring, m.place)), members, dir: dirOf(r.tip * TIP, angleOf(s, ring, place)) });
  }
  return out.sort((a, b) => b.members.length - a.members.length || a.ids[0] - b.ids[0]);
}
/**
 * After a change: the lines standing now, each keeping the time it has stood if it was standing before (a planet joining
 * it doesn't start it again). The rules call it at every change; an orrery set up by hand needs it too.
 */
export function look(s) {
  const before = s.locks;
  s.locks = clusters(s).map(c => {
    const was = before.find(b => b.colour === c.colour && b.key === c.key && (b.ids.every(x => c.ids.includes(x)) || c.ids.every(x => b.ids.includes(x))));
    return { ...c, at: was ? was.at : s.t };
  });
}
/** The time of the beat that will strike a line standing since `at`: the first a DWELL or more after it. */
export function strikeAt(s, at) {
  const P = period(s);
  return s.beatAt + Math.max(0, Math.ceil((at + DWELL - s.beatAt) / P - 1e-9)) * P;
}

// ---------- a game ----------
/** The place a planet could land on: of two hoops picked at random the one with more room, then a free place on it, or null. */
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
/** The way a hoop at a tip drifts next: on as it was going, or back from 45 degrees. */
const turned = (tip, way) => (Math.abs(tip + way) > TIP_MAX ? -way : way);

/**
 * A new game from a seed, at a tempo: the hoops still, turned anywhere, each in a different colour's plane, each with its
 * own pace of drift and which way it goes first, START planets in places, none in line, the first foretold.
 */
export function newGame(seed, tempo = FIRST_TEMPO) {
  const s = { v: VERSION, seed: seed >>> 0, n: 0, t: 0, tempo: clampTempo(tempo), beat: 0, lastBeat: 0, beatAt: 0, rings: [], next: null, locks: [], score: 0, cleared: 0, aligned: 0, fours: 0, combo: 0, lastLock: -1e9, over: false };
  s.beatAt = period(s);
  const tips = shuffle(s, [...PLANE]), paces = shuffle(s, [...DRIFT]);
  for (let r = 0; r < RINGS; r++) {
    s.rings.push({ a: pick(s, PLACES), set: 0, due: 0, tip: tips[r], places: new Array(PLACES).fill(-1), moved: -1e9, dir: 1, tipFrom: tips[r], tipAt: -1e9,
      drift: paces[r], driftAt: paces[r], way: turned(tips[r], pick(s, 2) ? 1 : -1) });
  }
  // the colours in turn, so each is dealt as often as the others (to within one)
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
  return s;
}
const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
export const valid = g => !!g && g.v === VERSION && isInt(g.tempo, 0, TEMPOS.length - 1) && [g.t, g.beatAt, g.lastBeat].every(Number.isFinite) && Number.isInteger(g.beat)
  && Array.isArray(g.rings) && g.rings.length === RINGS && g.rings.every(r => Array.isArray(r.places) && r.places.length === PLACES && isInt(r.a, 0, PLACES - 1) && isInt(r.set, -SPIN, SPIN) && Number.isInteger(r.due)
    && isInt(r.tip, -TIP_MAX, TIP_MAX) && [r.moved, r.tipFrom, r.tipAt, r.driftAt].every(Number.isFinite) && r.drift > 0 && Math.abs(r.way) === 1)
  && !!g.next && Number.isFinite(g.next.due) && Array.isArray(g.locks);
/** A copy of a game, to try something on. */
export const copy = s => structuredClone(s);

// ---------- the hand ----------
const clampTempo = k => Math.max(0, Math.min(TEMPOS.length - 1, Math.round(k) || 0));
/**
 * A hoop set going (k from -4 to 4: still at 0, left for negative and right for positive, every third beat at 1, every
 * second at 2, every beat at 3, two places every beat at 4). Set moving, it steps on the next beat and then every so many
 * beats, counted from that first step, and keeps that until it's set again; set as it is already, it carries on as it
 * was. Set still, its planets can make a line. Returns whether anything changed.
 */
export function setRing(s, ring, k) {
  const r = s.rings[ring];
  k = Math.max(-SPIN, Math.min(SPIN, Math.round(k)));
  if (s.over || k === r.set) return false;
  r.set = k;
  if (k) r.due = s.beat + 1;
  look(s);
  return true;
}
/** Tips a hoop to k (whole fifteens): at once by the rules, drawn turning from where it's drawn now. */
function tipTo(s, r, k) {
  r.tipFrom = tiltOf(r, s.t) / TIP;
  r.tipAt = s.t;
  r.tip = k;
  r.way = turned(k, r.way);
}
/**
 * A hoop tipped by the player (k from -3 to 3, fifteen degrees each, the three o'clock side up for positive): at once by
 * the rules, drawn turning over a moment. It winds the hoop's drift again: its next is a whole pace from now.
 */
export function setTip(s, ring, k) {
  const r = s.rings[ring];
  k = Math.max(-TIP_MAX, Math.min(TIP_MAX, Math.round(k)));
  if (s.over || k === r.tip) return false;
  tipTo(s, r, k);
  r.driftAt = s.t + r.drift;
  look(s);
  return true;
}
/** The tempo set (an index into TEMPOS): the next beat comes a beat of the new tempo after the last, or at once if that's gone by. */
export function setTempo(s, k) {
  k = clampTempo(k);
  if (s.over || k === s.tempo) return false;
  s.tempo = k;
  s.beatAt = Math.max(s.t, s.lastBeat + period(s));
  return true;
}
/** How a hoop steps on beat b (one still to come): the places it goes, positive right, negative left, 0 if it doesn't. */
export function stepsOn(r, b) {
  if (!r.set || b < r.due) return 0;
  const k = Math.abs(r.set);
  return (b - r.due) % EVERY[k] === 0 ? Math.sign(r.set) * STRIDE[k] : 0;
}
/** The next n beats: for each, how each hoop steps on it (places, signed, or 0). */
export const upcoming = (s, n) => Array.from({ length: n }, (_, k) => s.rings.map(r => stepsOn(r, s.beat + 1 + k)));
/** The hoop that drifts next. */
export const nextDrift = s => s.rings.reduce((best, r, ring) => (r.driftAt < s.rings[best].driftAt ? ring : best), 0);

// ---------- time passing ----------
/** A beat: the hoops set going step, then the lines that have stood long enough are struck, the larger first. */
function beat(s, events) {
  s.beat++;
  s.lastBeat = s.t;
  s.beatAt = s.t + period(s);
  const stepped = [];
  s.rings.forEach((r, ring) => {
    const by = stepsOn(r, s.beat);
    if (!by) return;
    r.a = mod(r.a + by);
    r.due = s.beat + EVERY[Math.abs(r.set)];
    r.moved = s.t;
    r.dir = by;
    stepped.push({ ring, dir: Math.sign(by), by });
  });
  events.push({ type: "beat", beat: s.beat, stepped });
  const due = s.locks.filter(l => l.at + DWELL <= s.t + 1e-9);
  if (!due.length) return;
  s.locks = s.locks.filter(l => !due.includes(l));
  for (const c of due) {
    s.combo = s.t - s.lastLock <= COMBO_WINDOW ? s.combo + 1 : 1;
    s.lastLock = s.t;
    const n = c.members.length, gain = Math.round(AWARD[n] * multiplier(s.combo));
    for (const m of c.members) s.rings[m.ring].places[m.place] = -1;
    s.score += gain;
    s.cleared += n;
    s.aligned++;
    if (n === 4) s.fours++;
    events.push({ type: "lock", colour: c.colour, key: c.key, members: c.members, dir: c.dir, n, gain, combo: s.combo });
  }
}
function land(s, events) {
  let { ring, place, colour } = s.next;
  if (ring < 0 || s.rings[ring].places[place] >= 0) {
    const at = spot(s);
    if (!at) {
      // a line standing is already made: the beat strikes it first, and the planet lands in the room it leaves
      if (s.locks.length) { s.next.due = Math.min(...s.locks.map(l => strikeAt(s, l.at))); return; }
      s.over = true;
      s.locks = [];
      events.push({ type: "over" });
      return;
    }
    ({ ring, place } = at);
  }
  s.rings[ring].places[place] = colour;
  events.push({ type: "land", ring, place, colour });
  foretell(s);
  look(s);
}
/** A hoop's drift: a step of tip the way it's going, on its own clock, breaking a line it leaves as a tip of the hand would. */
function drift(s, ring, events) {
  const r = s.rings[ring], from = r.tip;
  tipTo(s, r, r.tip + r.way);
  r.driftAt = s.t + r.drift;
  events.push({ type: "drift", ring, from, tip: r.tip });
  look(s);
}
/**
 * Lets `dt` seconds pass, in place: each beat steps the hoops set going and strikes the lines standing, the planet
 * foretold lands when it's due and each hoop drifts at its time; each at its own time, in order (a beat first, then a
 * landing, then a drift, at one moment). Returns what happened, for the page to show and sound:
 * { type: "beat", beat, stepped ([{ ring, dir, by }]) } | { type: "land", ring, place, colour } | { type: "lock", colour,
 * key, members, dir, n, gain, combo } | { type: "drift", ring, from, tip } | { type: "over" }.
 */
export function step(s, dt) {
  const events = [];
  if (s.over) return events;
  const end = s.t + dt;
  for (;;) {
    const d = nextDrift(s), at = Math.min(s.beatAt, s.next.due, s.rings[d].driftAt);
    if (at > end) break;
    if (at > s.t) s.t = at;
    if (at === s.beatAt) beat(s, events);
    else if (at === s.next.due) land(s, events);
    else drift(s, d, events);
    if (s.over) return events;
  }
  s.t = end;
  return events;
}
