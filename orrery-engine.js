// Orrery's rules, pure (no page): four brass hoops on a pivot axle round a sun, each with twelve places for planets of
// four colours, stepping on a beat. The beat is a metronome the player sets, at 1, 2, 4, 6, 12 or 20 beats a minute (20,
// one every three seconds, the fastest: Korbi, 23 October 2026). Every hoop is always going, left or right, at one of two
// speeds, a place on every beat or two (slots, he calls them), and keeps that until it's set again: none stands still. It
// rests between its steps, and a place is a twelfth of a turn, so between beats every planet is exactly on one of twelve
// places, and nothing coasts. Everything the game does that isn't a picture is counted in beats, so the tempo is the
// speed of the whole game: planets land and hoops drift a number of beats apart, and a quicker tempo brings both quicker.
// Each hoop is tipped about the axle (a rod from twelve o'clock through the sun to six) by 15, 30 or 45
// degrees either way, or lies level. Each colour has a plane of its own, a tip (PLANE): yellow's at −45 degrees, green's
// −15, blue's 15 and red's 45; a press of a colour tips one hoop into its plane, or every hoop at once, and every so often
// each hoop tips a step further by itself (its drift), one way until it reaches 45 degrees and then back, at its own
// steady pace, on a beat and after the hoops have stepped (Korbi, 23 October 2026: not right before them). Three or four planets of one colour, one to a hoop, in one direction from the sun, are a line however
// their hoops are going, and the next beat strikes it before it steps them on: they clear and score. One direction is at
// twelve o'clock or at six (on the axle, which every hoop crosses however it's tipped), for any colour at any tips; or one
// place round hoops in that colour's plane. So lines are made by the hoops' speeds and directions (a beat's steps bring
// planets together) and their planes, as well as by a tip or a planet landing. A game begins with the whole orrery turning
// together (every hoop slow, the same way); while it does, no step changes which planets are together, so none makes a
// line. Every few beats a new planet lands, foretold a moment before, more often as the game goes on; an orrery with no
// place left for one ends the game. The page (orrery.js) draws it and takes the hand; tests/orrery.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), t (seconds played), tempo (an index into TEMPOS), beat (beats
// so far), lastBeat and beatAt (the time of the last beat and of the next), rings ([{ a (the hoop's turn, in places,
// 0–11: where its own twelve o'clock place is now, clockwise), set (-2 to 2, never 0: stepping left (negative) or right,
// slow or fast by its size: a place a beat or two), tip (-3 to 3, in fifteen degrees: the three
// o'clock side up for positive), places (twelve colours 0–3 or -1 empty, from the hoop's own twelve o'clock clockwise),
// moved and dir (when it last stepped, and how many places which way: for drawing the step), tipFrom and tipAt (the tip
// it was turning from, and when: for drawing the tip), drift (its pace: beats between drifts), driftAt (when it drifts
// next), way (which way it drifts next: 1 up, -1 down) }]), next ({ due (when it lands), ring, place, colour }: the
// planet foretold; ring -1 where no place was free then), locks ([{ colour, key, seat, ids, members, dir, at }]: the
// lines standing, each since `at`, to be struck on the beat), score, cleared (planets), aligned (lines struck), fours (of
// them, four planets), combo, lastLock (when), over }. Every change happens at an exact time, whatever the steps of time
// it's played in, so a game goes on the same whether it's played a frame at a time or a minute at once.

export const VERSION = 8;
export const RINGS = 4, PLACES = 12, COLOURS = 4, START = 10;
export const TAU = Math.PI * 2, STEP = TAU / PLACES, DEG = Math.PI / 180;
/** The tempos, in beats a minute, slowest first: the fastest is twenty, a beat every three seconds. */
export const TEMPOS = [1, 2, 4, 6, 12, 20];
export const FIRST_TEMPO = 4;               // a first game's, twelve a minute (the player's last choice after that, which the page keeps)
/** The seconds a beat took at the tempo the game's pace was first set at, twelve a minute: the numbers below in seconds. */
export const REFERENCE = 5;
/** A hoop's settings go from -SPIN to SPIN, but never 0 (a hoop is always going): the places it steps on every beat, slow at 1 and fast at 2. */
export const SPIN = 2;
/** A new game's setting for every hoop: slow, and all one way, so the whole orrery turns together (anticlockwise seen from above, as the planets go round the sun). */
export const FIRST_SET = -1;
export const TIP = 15 * DEG, TIP_MAX = 3;   // a tip is a whole number of fifteen degrees, up to 45 either way
/**
 * Each colour's plane: the tip (in fifteen degrees) on which its planets line up away from the gates. Fixed, so a player
 * learns them; every other tip, so one drift always takes a hoop out of its plane, and level is no colour's.
 */
export const PLANE = [-3, -1, 1, 3];
/** The colour whose plane a tip is, or -1. */
export const planeOf = tip => PLANE.indexOf(tip);
/** The hoops' paces of drift, in beats between one and the next: dealt to the four from the seed, so each has its own. */
export const DRIFT = [6, 7, 8, 10];
export const TICK = 0.25;                   // seconds a step is drawn over: a short tick, like a wheel let go by an escapement
export const TIP_TIME = 0.2;                // and a tip: quick, so a press reads as immediate
export const DWELL = 0.3;                   // seconds a line shows at least before a beat strikes it: what made it (a step, a tip, a landing) has been drawn by then
/** What a line of 3 or 4 planets is worth, before the combo. */
export const AWARD = [0, 0, 0, 100, 300];
export const COMBO_WINDOW = 2;              // beats after one line in which the next counts on the combo
export const FORETELL = 1.5;                // seconds a planet is shown before it lands
/** The pace of the planets, in beats: between them at first, the quickest they come to, and the beats in which the gap between the two halves. */
export const PACE = { first: 1.8, least: 0.28, half: 40 };
/** Beats between planets, after b beats of the game: quicker and quicker, ever more slowly, towards the quickest. */
export const gap = b => PACE.least + (PACE.first - PACE.least) * 2 ** (-b / PACE.half);
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
 * The lines standing: three or more planets of one colour in one direction (`keyOf`), which puts them on different
 * hoops, however the hoops are going; away from the gates only on hoops tipped to the colour's plane: [{ colour, key,
 * seat (the place round the sun they're at), ids, members ([{ ring, place }], inner hoop first), dir (the direction, a
 * unit vector) }], the largest first. A planet has one direction, so no two lines share a planet.
 */
export function clusters(s) {
  const groups = new Map();
  s.rings.forEach((r, ring) => {
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
    out.push({ colour: Number(colour), key, seat: seatOf(s, ring, place), ids: members.map(m => id(m.ring, m.place)), members, dir: dirOf(r.tip * TIP, angleOf(s, ring, place)) });
  }
  return out.sort((a, b) => b.members.length - a.members.length || a.ids[0] - b.ids[0]);
}
/**
 * After a change: the lines standing now, each keeping the time it has stood if it was standing before (a planet joining
 * it doesn't start it again). The rules call it at every change that moves a planet or a plane (a beat's steps, a tip, a
 * drift, a landing; a hoop's setting moves nothing until it steps); an orrery set up by hand needs it too.
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
/**
 * The most planets of one colour a hoop holds: its even share, three of its twelve places (Korbi, 27 October 2026). A
 * line takes one planet from each hoop, so a hoop crowded with one colour could only be worn down a planet a line, and
 * kept its places from the others: the game could stall with room nowhere but there. A landing never takes a hoop past
 * it, and a colour lands on a hoop holding one of it already only half as often (ALIKE) for each it holds.
 */
export const CAP = PLACES / COLOURS;
export const ALIKE = 0.5;
/** How many planets of a colour a hoop holds. */
export const holds = (r, c) => r.places.reduce((n, x) => n + (x === c ? 1 : 0), 0);
/**
 * The place a planet could land on: of two hoops picked at random the one with more room, then a free place on it, or
 * null. For a colour, only hoops holding fewer than CAP of it, the one holding fewer of it first.
 */
function spot(s, colour = -1) {
  const open = s.rings.flatMap((r, ring) => (r.places.includes(-1) && (colour < 0 || holds(r, colour) < CAP) ? [ring] : []));
  if (!open.length) return null;
  const free = ring => s.rings[ring].places.filter(c => c < 0).length;
  const fewer = ring => (colour < 0 ? 0 : holds(s.rings[ring], colour));
  const a = open[pick(s, open.length)], b = open[pick(s, open.length)];
  const ring = fewer(b) < fewer(a) || (fewer(b) === fewer(a) && free(b) > free(a)) ? b : a;
  const places = s.rings[ring].places.flatMap((c, p) => (c < 0 ? [p] : []));
  return { ring, place: places[pick(s, places.length)] };
}
/** The hoops each colour has a planet on, as a set a colour. */
const spread = s => {
  const on = Array.from({ length: COLOURS }, () => new Set());
  s.rings.forEach((r, ring) => r.places.forEach(c => { if (c >= 0) on[c].add(ring); }));
  return on;
};
/**
 * The colours that could be lined up now, in principle: planets on three hoops or more (a line has one planet to a hoop).
 * With none, there is nothing to aim at, whatever the hand does; with every colour, nothing to choose between.
 */
export const aims = s => spread(s).filter(h => h.size >= 3).length;
/** How many colours the deal and the landings keep to aim for: at least one, and not all four (Korbi, 23 October 2026). */
export const AIMS = { least: 1, most: 3 };
/** The aims there would be with a colour in a place (tried, and taken back). */
function aimsWith(s, ring, place, colour) {
  s.rings[ring].places[place] = colour;
  const n = aims(s);
  s.rings[ring].places[place] = -1;
  return n;
}
/**
 * The place and colour of the next planet, steered a little: with nothing to aim at, one that brings a colour nearer to
 * three hoops (the colour on most hoops, onto a hoop it isn't on); with as many to aim at as are wanted, never one that
 * makes another. Otherwise as it comes. Hoops' planets only change by landings and lines struck, never by steps, so a
 * colour's hoops are as the player sees them for as long as it takes to land.
 */
function aimed(s) {
  const now = aims(s), on = spread(s);
  if (now < AIMS.least) {
    const reach = [];
    for (let c = 0; c < COLOURS; c++) if (on[c].size) for (let ring = 0; ring < RINGS; ring++) {
      if (on[c].has(ring)) continue;
      const free = s.rings[ring].places.flatMap((x, p) => (x < 0 ? [p] : []));
      if (free.length) reach.push({ colour: c, ring, free, size: on[c].size });
    }
    const top = Math.max(0, ...reach.map(x => x.size)), best = reach.filter(x => x.size === top);
    if (best.length) { const x = best[pick(s, best.length)]; return { ring: x.ring, place: x.free[pick(s, x.free.length)], colour: x.colour }; }
  }
  for (let k = 0; k < 12; k++) {
    const at = newcomer(s);
    if (!at) return null;
    if (now < AIMS.most || aimsWith(s, at.ring, at.place, at.colour) <= now) return at;
  }
  return newcomer(s);
}
/** How many planets of each colour the orrery holds. */
function counts(s) {
  const n = new Array(COLOURS).fill(0);
  for (const r of s.rings) for (const c of r.places) if (c >= 0) n[c]++;
  return n;
}
/** A colour's weight among the newcomers: the scarcer the likelier, so every colour stays in play. */
const scarcity = n => { const top = Math.max(...n); return c => 1 + top - n[c]; };
/** One of a list drawn by its weights (w). */
function weighted(s, list) {
  let x = rnd(s) * list.reduce((a, o) => a + o.w, 0);
  return list.find(o => o.w > 0 && (x -= o.w) < 0) || list.findLast(o => o.w > 0);
}
/**
 * The next planet's hoop, place and colour, drawn together: a hoop the likelier the more room it has, a colour the
 * scarcer, and a colour on a hoop holding it already ALIKE times as likely for each of it there, never one holding CAP
 * of it (a hoop with room always has a colour it can take: four colours of CAP fill it). So a colour mostly lands where
 * it isn't, which is where it can make a line.
 */
function newcomer(s) {
  const weight = scarcity(counts(s)), options = [];
  s.rings.forEach((r, ring) => {
    const free = r.places.filter(c => c < 0).length;
    if (free) for (let c = 0; c < COLOURS; c++) { const h = holds(r, c); if (h < CAP) options.push({ ring, colour: c, w: free * weight(c) * ALIKE ** h }); }
  });
  if (!options.length) return null;
  const { ring, colour } = weighted(s, options), places = s.rings[ring].places.flatMap((c, p) => (c < 0 ? [p] : []));
  return { ring, place: places[pick(s, places.length)], colour };
}
/** A colour for a newcomer with no place yet (the orrery full as it's foretold), or for a hoop (`ring`): as newcomer() weighs it. */
function colourFor(s, ring = -1) {
  const r = s.rings[ring], weight = scarcity(counts(s));
  return weighted(s, [...Array(COLOURS).keys()].map(c => { const h = r ? holds(r, c) : 0; return { c, w: h >= CAP ? 0 : weight(c) * ALIKE ** h }; })).c;
}
/** Foretells the next planet, to land a gap after now. */
function foretell(s) {
  const at = aimed(s) ?? { ring: -1, place: -1, colour: colourFor(s) };
  s.next = { due: s.t + gap(s.beat) * period(s), ring: at.ring, place: at.place, colour: at.colour };
}
/** The way a hoop at a tip drifts next: on as it was going, or back from 45 degrees. */
const turned = (tip, way) => (Math.abs(tip + way) > TIP_MAX ? -way : way);
/**
 * Three or more planets of one colour at one place round the sun, whatever their hoops' tips: [{ colour, members }]. Every
 * line is one, and so is a line still to come to an orrery turning together, which carries them to a gate together.
 */
export function crowds(s) {
  const at = new Map();
  s.rings.forEach((r, ring) => r.places.forEach((c, place) => {
    if (c < 0) return;
    const k = c * PLACES + seatOf(s, ring, place);
    if (!at.has(k)) at.set(k, { colour: c, members: [] });
    at.get(k).members.push({ ring, place });
  }));
  return [...at.values()].filter(g => g.members.length >= 3);
}

/**
 * A new game from a seed, at a tempo: every hoop going slow the same way, stepping on the same beats (the whole orrery
 * turning together), turned anywhere, each in a different colour's plane, each with its own pace of drift and which way it
 * goes first; START planets in places, no three of a colour at one place round (so none in line, nor brought into one by
 * the turning); the first foretold.
 */
export function newGame(seed, tempo = FIRST_TEMPO) {
  const s = { v: VERSION, seed: seed >>> 0, n: 0, t: 0, tempo: clampTempo(tempo), beat: 0, lastBeat: 0, beatAt: 0, rings: [], next: null, locks: [], score: 0, cleared: 0, aligned: 0, fours: 0, combo: 0, lastLock: -1e9, over: false };
  s.beatAt = period(s);
  const tips = shuffle(s, [...PLANE]), paces = shuffle(s, [...DRIFT]);
  for (let r = 0; r < RINGS; r++) {
    s.rings.push({ a: pick(s, PLACES), set: FIRST_SET, tip: tips[r], places: new Array(PLACES).fill(-1), moved: -1e9, dir: 1, tipFrom: tips[r], tipAt: -1e9,
      drift: paces[r], driftAt: paces[r] * period(s), way: turned(tips[r], pick(s, 2) ? 1 : -1) });
  }
  // the colours in turn, so each is dealt as often as the others (to within one); dealt again if no colour is on three
  // hoops, which leaves nothing to do at the start (Korbi: "it's all different planets on different belts")
  const all = () => s.rings.flatMap((r, ring) => r.places.flatMap((c, place) => (c >= 0 ? [{ ring, place, c }] : [])));
  for (let tries = 0; tries < 80; tries++) {
    for (const r of s.rings) r.places.fill(-1);
    for (let k = 0; k < START; k++) {
      const at = spot(s);
      s.rings[at.ring].places[at.place] = k % COLOURS;
    }
    // no three of a colour together at the start: swap colours with another planet until none are, which keeps the count of each
    for (let guard = 0; guard < 500 && crowds(s).length; guard++) {
      const c = crowds(s)[0], m = c.members[pick(s, c.members.length)], other = all().filter(q => q.c !== c.colour);
      const o = other[pick(s, other.length)];
      s.rings[m.ring].places[m.place] = o.c;
      s.rings[o.ring].places[o.place] = c.colour;
    }
    if (!crowds(s).length && aims(s) >= AIMS.least && aims(s) <= AIMS.most) break;
  }
  foretell(s);
  return s;
}
const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
export const valid = g => !!g && g.v === VERSION && isInt(g.tempo, 0, TEMPOS.length - 1) && [g.t, g.beatAt, g.lastBeat].every(Number.isFinite) && Number.isInteger(g.beat)
  && Array.isArray(g.rings) && g.rings.length === RINGS && g.rings.every(r => Array.isArray(r.places) && r.places.length === PLACES && isInt(r.a, 0, PLACES - 1) && isInt(r.set, -SPIN, SPIN) && r.set !== 0
    && isInt(r.tip, -TIP_MAX, TIP_MAX) && [r.moved, r.tipFrom, r.tipAt, r.driftAt].every(Number.isFinite) && r.drift > 0 && Math.abs(r.way) === 1)
  && !!g.next && Number.isFinite(g.next.due) && Array.isArray(g.locks);
/** A copy of a game, to try something on. */
export const copy = s => structuredClone(s);

// ---------- the hand ----------
const clampTempo = k => Math.max(0, Math.min(TEMPOS.length - 1, Math.round(k) || 0));
/**
 * A hoop set going (k from -2 to 2, never 0: left for negative and right for positive, slow at 1, a place on every beat,
 * fast at 2, two places on every beat). It steps on the next beat and every beat after, so a setting answers at once;
 * set as it is already, nothing changes. There is no setting still (0 is refused): every hoop is always going. A setting
 * moves nothing until the hoop steps, so it makes or breaks no line by itself. Returns whether anything changed.
 */
export function setRing(s, ring, k) {
  const r = s.rings[ring];
  k = Math.max(-SPIN, Math.min(SPIN, Math.round(k) || 0));
  if (s.over || !k || k === r.set) return false;
  r.set = k;
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
 * A press of a colour: one hoop (`ring`) tipped into its plane, or without one every hoop at once, each drawn turning
 * quickly from where it's drawn now. It winds no hoop's drift: each drifts on its own steady clock whatever is pressed (a
 * press that wound them, every hoop's or only those it tipped, made the drift never touch a careful player, who presses
 * often: tests/orrery.mjs measures it). Returns whether any hoop was tipped (none is, pressing the colour the hoop, or
 * every hoop, is in already).
 */
export function setPlane(s, colour, ring = -1) {
  const T = PLANE[colour];
  if (s.over || T == null) return false;
  const moving = s.rings.filter((r, k) => (ring < 0 || k === ring) && r.tip !== T);
  for (const r of moving) tipTo(s, r, T);
  if (moving.length) look(s);
  return moving.length > 0;
}
/** The tempo set (an index into TEMPOS): the next beat comes a beat of the new tempo after the last, or at once if that's gone by. */
export function setTempo(s, k) {
  k = clampTempo(k);
  if (s.over || k === s.tempo) return false;
  const was = period(s);
  s.tempo = k;
  // what's counted in beats keeps its place in them: the time left to the planet and to each drift stretches or shrinks with the beat
  const by = period(s) / was;
  s.next.due = s.t + (s.next.due - s.t) * by;
  for (const r of s.rings) r.driftAt = s.t + (r.driftAt - s.t) * by;
  s.beatAt = Math.max(s.t, s.lastBeat + period(s));
  return true;
}
/** The hoop that drifts next. */
/** When a hoop's drift will show: the beat it falls on (its time, or the first beat after). */
export const driftTime = (s, ring) => s.beatAt + Math.max(0, Math.ceil((s.rings[ring].driftAt - s.beatAt) / period(s) - 1e-9)) * period(s);
export const nextDrift = s => s.rings.reduce((best, r, ring) => (r.driftAt < s.rings[best].driftAt ? ring : best), 0);

// ---------- time passing ----------
/**
 * A beat: the lines that have stood long enough are struck, the larger first, where they stand; then the hoops step
 * (the line's own too, which goes on without the planets it gave), and the lines their steps make stand, for the next.
 * Struck after its beat rather than on it, a line is seen made, and a fourth can join it in that beat.
 */
function beat(s, events) {
  s.beat++;
  s.lastBeat = s.t;
  s.beatAt = s.t + period(s);
  const due = s.locks.filter(l => l.at + DWELL <= s.t + 1e-9);
  s.locks = s.locks.filter(l => !due.includes(l));
  for (const c of due) {
    s.combo = s.t - s.lastLock <= COMBO_WINDOW * period(s) ? s.combo + 1 : 1;
    s.lastLock = s.t;
    const n = c.members.length, gain = Math.round(AWARD[n] * multiplier(s.combo));
    for (const m of c.members) s.rings[m.ring].places[m.place] = -1;
    s.score += gain;
    s.cleared += n;
    s.aligned++;
    if (n === 4) s.fours++;
    events.push({ type: "lock", colour: c.colour, key: c.key, seat: c.seat, members: c.members, dir: c.dir, n, gain, combo: s.combo });
  }
  const stepped = [];
  s.rings.forEach((r, ring) => {
    const by = r.set;
    if (!by) return;                                       // (a hoop held by a test that built the orrery by hand)
    r.a = mod(r.a + by);
    r.moved = s.t;
    r.dir = by;
    stepped.push({ ring, dir: Math.sign(by), by });
  });
  events.push({ type: "beat", beat: s.beat, stepped });
  if (stepped.length) look(s);
  // the hoops that are due drift now, once the steps have landed (a line they leave or make is looked for as the steps' are)
  const drifting = s.rings.flatMap((r, ring) => (r.driftAt <= s.t + 1e-9 ? [ring] : [])).sort((a, b) => s.rings[a].driftAt - s.rings[b].driftAt);
  for (const ring of drifting) drift(s, ring, events);
}
function land(s, events) {
  let { ring, place, colour } = s.next;
  if (ring < 0 || s.rings[ring].places[place] >= 0) {
    const at = spot(s, colour) || spot(s);
    if (!at) {
      // a line standing is already made: the beat strikes it first, and the planet lands in the room it leaves
      if (s.locks.length) { s.next.due = Math.min(...s.locks.map(l => strikeAt(s, l.at))); return; }
      s.over = true;
      s.locks = [];
      events.push({ type: "over" });
      return;
    }
    ({ ring, place } = at);
    // the room left is only on hoops holding CAP of its colour already: it comes as one they may take (rare: it was
    // foretold onto a full orrery, and the line that made room took its colour from each hoop)
    if (holds(s.rings[ring], colour) >= CAP) colour = colourFor(s, ring);
  }
  s.rings[ring].places[place] = colour;
  events.push({ type: "land", ring, place, colour });
  foretell(s);
  look(s);
}
/**
 * A hoop's drift: a step of tip the way it's going, on its own clock (counted in beats, and happening on the first beat
 * at or after its time), breaking a line it leaves as a tip of the hand would. By the rules at once, but drawn once the
 * hoops' steps have been drawn (a tick), so the eye sees them move and then the tilt.
 */
function drift(s, ring, events) {
  const r = s.rings[ring], from = r.tip;
  tipTo(s, r, r.tip + r.way);
  r.tipAt = s.t + TICK;
  r.driftAt = s.t + r.drift * period(s);
  events.push({ type: "drift", ring, from, tip: r.tip });
  look(s);
}
/**
 * Lets `dt` seconds pass, in place: each beat strikes the lines standing and steps the hoops, the planet foretold lands
 * when it's due and each hoop drifts at its time; each at its own time, in order (a beat first, in which the hoops step
 * and then drift, then a landing, at one moment). Returns what happened, for the page to show and sound: { type: "lock", colour, key, seat (the
 * place round the sun it stood at: its hoops have stepped on since), members, dir, n, gain, combo } before the beat that
 * struck it, | { type: "beat", beat, stepped ([{ ring, dir, by }]) } | { type: "land", ring, place, colour } |
 * { type: "drift", ring, from, tip } | { type: "over" }.
 */
export function step(s, dt) {
  const events = [];
  if (s.over) return events;
  const end = s.t + dt;
  for (;;) {
    const at = Math.min(s.beatAt, s.next.due);
    if (at > end) break;
    if (at > s.t) s.t = at;
    if (at === s.beatAt) beat(s, events);
    else land(s, events);
    if (s.over) return events;
  }
  s.t = end;
  return events;
}
