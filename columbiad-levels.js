// Columbiad's levels: plain data, in sections, each adding one idea. 4 November 2026 (Korbi): the Earth and the Moon are large on the
// screen and the ring is behind the Moon, so a shot aimed straight at it never works and the way is round the Moon's pull.
//
// The world is stylised but keeps one consistent rule: the Earth is 4.2 across its radius and the Moon 1.35, the Earth's
// pull is 34 and the Moon's 7.5 (about a fifth), so a shell leaving at the dial's top clears the Earth (escape speed 4.0) and one slower
// than 3.3 is held by the Moon (its own escape speed). Honest masses (81 to 1) would make the Moon's pull too weak to steer by.
//
// A level: { id, name, note (told once on arriving), site (the launch pad's place on the Earth, degrees round from the right; 90 is the top),
// bodies [Earth, Moon] (mu: pull, r: size, at: place), target { at, r } (the ring's middle and radius: bigger is easier) or, for goal
// "return", gates (the rings in order, the last the target), goal { type }, dial [slowest, fastest] (the speed power 0 and the top of the
// gauge give, a straight line between), scatter { v (a share), deg } (the shot-to-shot error, one standard deviation), cone { len } (how many
// units of flight the preview shows), barrels (the gauge's power units), tMax (time of flight allowed), par, band { lean, charge } (where
// the bots look), frame (the aim view's box) }.
//
// Every level is proved in tests/columbiad.mjs: a straight aim at the ring (or the first gate), at any power and a couple of degrees either way, never
// wins; a stored shot (columbiad-proofs.js, found by the solver of tools/columbiad-solve.mjs) does, with its window of angles and powers.
import { isMoving } from "./columbiad-engine.js";
import { FAR } from "./columbiad-levels-far.js";

const EARTH = { id: "earth", mu: 34, r: 4.2 };
const MOON = (x, y, r, mu) => ({ id: "moon", at: [x, y], mu, r });
const moon = (x, y) => ({ id: "moon", at: [x, Math.round((y + 0.2) * 100) / 100], mu: 7.5, r: 1.35 });
const WORLD = { barrels: 16, dial: [2.0, 4.4], dt: 1 / 60, tMax: 30, bounds: 40, site: 90, goal: { type: "hit" }, scatter: { v: 0.002, deg: 0.15 }, cone: { len: 12 }, par: 1,
  frame: [-3.9, 2.9, 3.9, 12.8], band: { lean: 60, charge: [0.5, 16] } };
const S2 = { scatter: { v: 0.003, deg: 0.2 } };                  // the later sections are less forgiving
const HOME = r => ({ at: [0, 4.2], r });                    // a ring on the ground at the pad: where a shot that has been round the Moon comes down

const CORE = [
  // Korbi, 8 November 2026: the first chapters were all one picture (a Moon in the middle, a ring just past its shoulder) and every
  // solution a gentle bend. Their layouts are now found by search (a Moon of any size and place, the pad at the side or the top, a
  // ring wherever it takes a real swing round the Moon to reach), each proved by the finder: the Moon's pull is what wins it.
  { id: 1, name: "Beside the Moon", idea: "The Moon pulls: aim wide of it and be drawn in", levels: [
    { ...WORLD, id: "1-1", name: "Beside the Moon", note: "The cloud is up and to the left, the Moon low on the right. The Moon pulls the shot: aim past it and let it bend you in.",
      bodies: [EARTH, MOON(1.87, 6.9, 1.35, 7.95)], target: { at: [1.26, 9.35], r: 0.62 }, aim: { angle: 90, charge: 10 } },
    { ...WORLD, id: "1-2", name: "The other shoulder", note: "From the pad's other side: power sets how flat the arc is, and the angle then has to follow.",
      site: 105, bodies: [EARTH, MOON(-1.65, 6.5, 1.1, 5.77)], target: { at: [-0.66, 9.25], r: 0.58 }, aim: { angle: 105, charge: 10 } },
    { ...WORLD, id: "1-12", name: "Low Moon", note: "A heavy Moon low in the middle and the cloud out past its right shoulder. Aim wide to the right, past the cloud: the Moon's pull hooks the shot back in.",
      dial: [2, 4.4], site: 60, bodies: [EARTH, MOON(0.48, 6.64, 1.55, 9.84)], target: { at: [2.55, 8.89], r: 0.57 }, aim: { angle: 60, charge: 10 } },
    // Korbi rated A small moon 3/5 and Wide of the Moon 1/5 (16 Nov 2026): both were won at the top of the gauge, the shell too fast for the
    // Moon to do much, where the levels he liked (5/5) are won at middling power and swing a long way round it. Redrawn by columbiad-plan.mjs's
    // search, kept only where the winning window sits mid-gauge and the Moon turns the shot most of the way round; new ids, so stars start over
    { ...WORLD, id: "1-10", name: "A small moon", note: "A small Moon over the pad, the cloud just past its top. A small Moon pulls less: aim past it and close, and it hooks the shot round.",
      site: 60, bodies: [EARTH, MOON(1.67, 7.74, 0.91, 3.36)], target: { at: [1.69, 9.77], r: 0.54 }, aim: { angle: 60, charge: 10 } },
    { ...WORLD, id: "1-11", name: "Wide of the Moon", note: "The cloud is out at the left edge and the Moon between: aim right of it, and its pull swings the shot all the way across.",
      site: 75, bodies: [EARTH, MOON(-0.71, 7.08, 1.52, 10.14)], target: { at: [-2.33, 9.67], r: 0.5 }, aim: { angle: 75, charge: 10 } },
    { ...WORLD, id: "1-13", name: "Sidelong", note: "A Moon low on the right and the cloud over its far shoulder, on the left. Fire right of the Moon: it swings the shot up round its top and back across.",
      dial: [2, 4.4], site: 75, bodies: [EARTH, MOON(2.17, 6.55, 1.37, 8.8)], target: { at: [-0.28, 8.58], r: 0.57 }, aim: { angle: 75, charge: 10 } },
    { ...WORLD, id: "1-7", name: "Close by", note: "A small Moon just up from the pad and the cloud above it: it pulls only a shot that passes close.",
      site: 120, bodies: [EARTH, MOON(-0.84, 6.78, 1.04, 5.05)], target: { at: [-0.48, 9.58], r: 0.5 }, aim: { angle: 120, charge: 10 } },
    { ...WORLD, id: "1-8", name: "High and wide", note: "The cloud is high on the right and the Moon low on the left: a long arc, the Moon's pull bending its start.",
      bodies: [EARTH, MOON(-0.53, 7.5, 1.31, 6.64)], target: { at: [1.65, 11.2], r: 0.48 }, aim: { angle: 90, charge: 10 } },
    { ...WORLD, id: "1-14", name: "Pebble moon", note: "The smallest Moon yet, the cloud just above it: fire up past its left side and let it hook the shot round onto the cloud. It hardly pulls, so pass close.",
      dial: [2, 4.4], bodies: [EARTH, MOON(2.44, 8.23, 0.91, 3.03)], target: { at: [2.98, 10.57], r: 0.47 }, aim: { angle: 105, charge: 10 } },
  ] },
  { id: 2, name: "Behind the Moon", idea: "The cloud is hidden by the Moon: there is no straight line, only a way round", levels: [
    { ...WORLD, ...S2, id: "2-1", name: "Eclipse", note: "Dead behind the Moon. Go round either side.", site: 60,
      bodies: [EARTH, MOON(0.54, 8.9, 1.1, 5.46)], target: { at: [-0.14, 11.21], r: 0.45 }, aim: { angle: 60, charge: 10 } },
    { ...WORLD, ...S2, id: "2-6", name: "Crescent", note: "A small Moon up on the right and the cloud tucked behind it as the pad sees it: round either side.", site: 60,
      bodies: [EARTH, MOON(1.4, 7.65, 0.93, 4.19)], target: { at: [0.52, 9.82], r: 0.45 }, aim: { angle: 60, charge: 10 } },
    { ...WORLD, ...S2, id: "2-2", name: "Moonshadow", note: "A small Moon, and the cloud tucked close behind it as the pad sees it.", site: 120,
      bodies: [EARTH, MOON(-0.95, 7.14, 0.9, 3.8)], target: { at: [-0.28, 9.18], r: 0.42 }, aim: { angle: 120, charge: 10 } },
    { ...WORLD, ...S2, id: "2-7", name: "Umbra", note: "A heavy Moon close to the pad and the cloud behind its right shoulder: its pull turns a shot hard.",
      bodies: [EARTH, MOON(0.48, 7.09, 1.68, 12.3)], target: { at: [1.9, 10.22], r: 0.41 }, aim: { angle: 90, charge: 10 } },
    { ...WORLD, ...S2, id: "2-3", name: "Off the line", note: "Behind the Moon as the pad sees it, which is not straight up.", site: 75,
      bodies: [EARTH, MOON(1.79, 7.05, 1.7, 10.77)], target: { at: [2.57, 10.36], r: 0.4 }, aim: { angle: 75, charge: 10 } },
    { ...WORLD, ...S2, id: "2-10", name: "Far behind", note: "A heavy Moon over the pad and a small cloud tucked over its right shoulder: fire wide to the right and come round the back to it.",
      dial: [2, 4.4], site: 105, bodies: [EARTH, MOON(-0.57, 7.19, 1.7, 12.21)], target: { at: [0.56, 9.78], r: 0.38 }, aim: { angle: 90, charge: 10 } },
    { ...WORLD, ...S2, id: "2-5", name: "Needle", note: "A small cloud behind a heavy Moon, out at the edge.", site: 60,
      bodies: [EARTH, MOON(-1.05, 7.5, 1.7, 12.42)], target: { at: [-2.76, 9.6], r: 0.32 }, aim: { angle: 60, charge: 10 } },
    { ...WORLD, ...S2, id: "2-8", name: "Occultation", note: "A small cloud right behind the Moon's top: a way round has to come back in to it.", site: 75,
      bodies: [EARTH, MOON(0.82, 7.46, 1.39, 9.23)], target: { at: [0.7, 10.34], r: 0.31 }, aim: { angle: 75, charge: 10 } },
    { ...WORLD, ...S2, id: "2-9", name: "Pinhole", note: "The smallest cloud, behind a heavy Moon on the right: the last of the hidden clouds.",
      bodies: [EARTH, MOON(1.83, 7.46, 1.63, 12.2)], target: { at: [2.39, 10.37], r: 0.28 }, aim: { angle: 90, charge: 10 } },
  ] },
  { id: 3, name: "Round and home", idea: "Out by one side of the Moon and back: a free return", levels: [
    { ...WORLD, ...S2, id: "3-1", name: "Free return", note: "Through the gate beside the Moon, then home to the cloud at the pad.",
      bodies: [EARTH, MOON(0.54, 7.25, 1.35, 8.89)], gates: [{ at: [2.36, 8.24], r: 0.63 }, HOME(0.79)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 9 }, aim: { angle: 90, charge: 10 } },
    { ...WORLD, ...S2, id: "3-4", name: "Low gate", note: "The gate is low, between the Earth and the Moon: through it, round the Moon, and home to the pad.", site: 75,
      bodies: [EARTH, MOON(1.16, 7.76, 1.33, 8.18)], gates: [{ at: [-0.64, 6.43], r: 0.57 }, HOME(0.8)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 7 }, aim: { angle: 75, charge: 10 } },
    { ...WORLD, ...S2, id: "3-5", name: "Tight turn", note: "A small Moon turns a shot only when it passes close: through the gate on its shoulder and round.",
      bodies: [EARTH, MOON(-0.06, 6.84, 0.95, 3.61)], gates: [{ at: [1.11, 8.23], r: 0.6 }, HOME(0.67)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 8 }, aim: { angle: 90, charge: 10 } },
    { ...WORLD, ...S2, id: "3-6", name: "From the west", note: "From the left of the pad, with the Moon low beside you: the gate is across on its far side.", site: 120,
      bodies: [EARTH, MOON(-1.61, 6.47, 1.42, 7.86)], gates: [{ at: [0.41, 8.23], r: 0.57 }, HOME(0.77)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 7 }, aim: { angle: 120, charge: 10 } },
    { ...WORLD, ...S2, id: "3-2", name: "Figure of eight", note: "A Moon high on the right, the gate above it: out one side, round, and back down the other.", site: 75,
      bodies: [EARTH, MOON(1.71, 8.8, 1.35, 7.55)], gates: [{ at: [1.96, 10.96], r: 0.59 }, HOME(0.81)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 8 }, aim: { angle: 75, charge: 10 } },
    { ...WORLD, ...S2, id: "3-3", name: "Apollo", note: "A heavy Moon, a tight gate and a small cloud at home.",
      bodies: [EARTH, MOON(-0.36, 7.53, 1.7, 12.02)], gates: [{ at: [-1.23, 9.75], r: 0.58 }, HOME(0.71)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 7 }, aim: { angle: 90, charge: 10 } },
    { ...WORLD, ...S2, id: "3-7", name: "Slingback", note: "The gate is high and close over the Moon: a sharp turn round it, and the long fall home.",
      bodies: [EARTH, MOON(1.3, 8.09, 1.16, 5.36)], gates: [{ at: [0.06, 9.7], r: 0.6 }, HOME(0.77)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 8 }, aim: { angle: 90, charge: 10 } },
    { ...WORLD, ...S2, id: "3-8", name: "Long way home", note: "A heavy Moon high on the left and the gate out to its right: round the top and back down to the pad.", site: 75,
      bodies: [EARTH, MOON(-0.56, 8.78, 1.47, 9.6)], gates: [{ at: [1.77, 9.25], r: 0.62 }, HOME(0.68)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 8 }, aim: { angle: 75, charge: 10 } },
  ] },
];
// The chapters (23 November 2026, Korbi: "We discussed a general template for fun level progression. Apply this to Columbiad": chapters as long
// as their lessons, three to five levels each bringing one idea). The twelve worlds above and in columbiad-levels-far.js hold the levels; a
// chapter is a run of one world's levels with one idea, in the order the worlds had them.
// Korbi, 24 November 2026: every chapter eases in, gets harder and ends on its hardest. Within a chapter the levels run by the window
// of aims that win (columbiad-proofs.js: angles × powers, and launch seconds where the world moves), widest first; the first stays
// where it teaches the chapter's idea, and a level whose words lean on another stays after it (Last light ends the planets).
const CHAPTERS = [
  ["Beside the Moon", "The Moon pulls: aim past it and let it draw you in", "1-1 1-2 1-10 1-11"],
  ["Close passes", "A Moon turns only a shot that passes close: the smaller it is, the closer", "1-12 1-13 1-7 1-8 1-14"],
  ["Behind the Moon", "The cloud is hidden by the Moon: there is no straight line, only a way round", "2-1 2-6 2-2 2-7"],
  ["The long way round", "A heavy Moon and the cloud far round its back", "2-3 2-10 2-5 2-8 2-9"],
  ["Free return", "Out by one side of the Moon through the gate, and home to the pad", "3-1 3-4 3-5 3-6"],
  ["Figure of eight", "Out one side, round the back, and home down the other", "3-2 3-3 3-7 3-8"],
  ["Clockwork", "The Moon moves: set the countdown as well as the aim, and tweak a shot you have fired", "4-8 4-9 4-1 4-3"],
  ["Moving targets", "Clouds that ride and swing: meet them where they will be", "4-4 4-7 4-5 4-6"],
  ["Moonrise", "Launch from the Moon: the Earth is the great pull now", "5-7 5-9 5-8 5-2"],
  ["Round the Earth", "The Earth's pull as the engine: a second moon, a gate, an orbit", "5-3 5-10 5-6 5-5"],
  ["Station", "Launch from a station in orbit: it carries you, so the countdown picks where it is", "6-7 6-9 6-10 6-11"],
  ["Rendezvous", "From the station to a Moon on the move, and back", "6-12 6-5 6-13 6-14"],
  ["Giants", "A gas giant pulls like nine Moons", "7-7 7-4 7-5 7-1"],
  ["Cloud planes", "The giant's clouds burn a shot that crosses them: through a gap or over the top", "7-2 7-3 7-8 7-6"],
  ["The Sun", "A star pulls the hardest and burns what comes close: round it, but not too near", "8-7 8-9 8-8 8-1"],
  ["Two stars", "A pair of suns, a close pass and a cold dwarf", "8-3 8-11 8-10 8-5"],
  ["The Belt", "Rocks fill the way: thread them, and the pull will help you do it", "9-6 9-12 9-9 9-2"],
  ["Rubble", "Rock round the Moon and across the way", "9-7 9-10 9-5 9-11"],
  ["Short tank", "Less powder than a full tank: let the Moon do the work", "10-1 10-5 10-9 10-2 10-10"],
  ["Windows and air", "Air that slows a shot, and a cloud that opens and shuts", "10-7 10-6 10-3 10-4"],
  ["Arrivals", "Not just a cloud: land softly, orbit, meet a comet", "11-1 11-2 11-5 11-7"],
  ["Clouds in order", "Two clouds, three, and a gate on the way: one shot through them all", "11-8 11-10 11-9 11-11"],
  ["Apollo", "The Moon missions: land, orbit, and come home", "12-6 12-7 12-8 12-10"],
  ["The planets", "Out among the worlds: a transfer, a slingshot, a grand tour", "12-12 12-4 12-9 12-3 12-11"],
];
const POOL = new Map([...CORE, ...FAR].flatMap(w => w.levels).map(l => [l.id, l]));
export const SECTIONS = CHAPTERS.map(([name, idea, ids], c) => ({ id: c + 1, name, idea, levels: ids.split(" ").map(id => POOL.get(id)) }));
// A level's id is its identity (stars, aims and the play log are kept by it) and never changes; its label is its place, chapter and number.
for (const sec of SECTIONS) sec.levels.forEach((l, n) => { l.label = `${sec.id}-${n + 1}`; if (l.gates) l.target = l.gates[l.gates.length - 1]; });
/** The Earth-and-Moon levels the game began with (the first six chapters). */
export const MOON_LEVELS = CORE.flatMap(w => w.levels);

/** Whether a level has anything that moves (a body on a rail, a Moon with no place given, a ring on a rail or a body): such a level has the launch countdown. */
export const hasMovers = isMoving;
export const LEVELS = SECTIONS.flatMap(s => s.levels);
/** The section a level (its index) belongs to. */
export const sectionOf = n => SECTIONS.find(s => s.levels.includes(LEVELS[n]));
/** The level of a day (YYYYMMDD): the same for everyone, from the fourth level on, by integer arithmetic only so every device agrees. */
export const dailyLevel = day => { const pool = LEVELS.slice(3); return pool[(Math.imul(day, 2654435761) >>> 0) % pool.length]; };
