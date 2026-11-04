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
const moon = (x, y) => ({ id: "moon", at: [x, Math.round((y + 0.2) * 100) / 100], mu: 7.5, r: 1.35 });
const WORLD = { barrels: 16, dial: [2.0, 4.4], dt: 1 / 60, tMax: 30, bounds: 40, site: 90, goal: { type: "hit" }, scatter: { v: 0.002, deg: 0.15 }, cone: { len: 12 }, par: 1,
  frame: [-3.9, 2.9, 3.9, 12.8], band: { lean: 60, charge: [0.5, 16] } };
const S2 = { scatter: { v: 0.003, deg: 0.2 } };                  // the later sections are less forgiving
const HOME = r => ({ at: [0, 4.2], r });                    // a ring on the ground at the pad: where a shot that has been round the Moon comes down

const CORE = [
  { id: 1, name: "Beside the Moon", idea: "The Moon pulls: aim wide of it and be drawn in", levels: [
    { ...WORLD, id: "1-1", name: "Beside the Moon", note: "The ring lies beyond the Moon's shoulder. The Moon pulls the shot: aim wide of it and let it bend you in.",
      bodies: [EARTH, moon(0.6, 8.7)], target: { at: [2.2, 10.6], r: 0.6 }, aim: { angle: 72, charge: 10 } },
    { ...WORLD, id: "1-2", name: "The other shoulder", note: "The same from the left. Power sets how flat the arc is; the angle then has to follow.",
      bodies: [EARTH, moon(-0.4, 8.9)], target: { at: [-1.9, 11.1], r: 0.55 }, aim: { angle: 108, charge: 10 } },
    { ...WORLD, id: "1-3", name: "High shoulder", note: "A ring higher up the Moon's far side.",
      bodies: [EARTH, moon(0, 9)], target: { at: [1.3, 11.2], r: 0.5 }, cone: { len: 11 }, aim: { angle: 72, charge: 10 } },
    { ...WORLD, id: "1-4", name: "Close pass", note: "Hugging the Moon: its pull is strongest here.",
      bodies: [EARTH, moon(0.8, 8.6)], target: { at: [2.4, 10.2], r: 0.45 }, cone: { len: 10 }, aim: { angle: 72, charge: 10 } },
  ] },
  { id: 2, name: "Behind the Moon", idea: "The ring is hidden by the Moon: there is no straight line, only a way round", levels: [
    { ...WORLD, ...S2, id: "2-1", name: "Eclipse", note: "Dead behind the Moon. Go round either side.",
      bodies: [EARTH, moon(0.6, 8.7)], target: { at: [0.6, 11.5], r: 0.4 }, aim: { angle: 70, charge: 10 } },
    { ...WORLD, ...S2, id: "2-2", name: "Moonshadow", note: "Tucked close behind it.",
      bodies: [EARTH, moon(-0.8, 8.5)], target: { at: [-0.8, 11.0], r: 0.38 }, cone: { len: 10 }, aim: { angle: 110, charge: 10 } },
    { ...WORLD, ...S2, id: "2-3", name: "Off the line", note: "Behind the Moon as the pad sees it, which is not straight up.",
      bodies: [EARTH, moon(1.2, 9)], target: { at: [1.8, 11.7], r: 0.36 }, cone: { len: 10 }, aim: { angle: 70, charge: 10 } },
    { ...WORLD, ...S2, id: "2-4", name: "Far behind", note: "Well out in its shadow: a long way round.",
      bodies: [EARTH, moon(0.2, 8.4)], target: { at: [0.5, 12.1], r: 0.34 }, cone: { len: 9 }, aim: { angle: 70, charge: 10 } },
    { ...WORLD, ...S2, id: "2-5", name: "Needle", note: "A small ring behind a heavy Moon.",
      bodies: [EARTH, moon(-0.4, 8.8)], target: { at: [-0.5, 11.4], r: 0.3 }, cone: { len: 8 }, aim: { angle: 110, charge: 10 } },
  ] },
  { id: 3, name: "Round and home", idea: "Out by one side of the Moon and back: a free return", levels: [
    { ...WORLD, ...S2, id: "3-1", name: "Free return", note: "Through the gate beside the Moon, then home to the ring at the pad.",
      bodies: [EARTH, moon(0.6, 8.7)], gates: [{ at: [-1.6, 9.8], r: 0.65 }, HOME(0.8)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 9 }, aim: { angle: 70, charge: 10 } },
    { ...WORLD, ...S2, id: "3-2", name: "Figure of eight", note: "The gate is on the other shoulder: the way out is the right-hand side.",
      bodies: [EARTH, moon(-0.4, 8.9)], gates: [{ at: [1.7, 9.9], r: 0.6 }, HOME(0.7)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 8 }, aim: { angle: 110, charge: 10 } },
    { ...WORLD, ...S2, id: "3-3", name: "Apollo", note: "A tight gate and a small ring at home.",
      bodies: [EARTH, moon(0.4, 9)], gates: [{ at: [-1.4, 10.5], r: 0.5 }, HOME(0.6)], goal: { type: "return", via: "Moon" }, tMax: 40, cone: { len: 7 }, aim: { angle: 70, charge: 10 } },
  ] },
];
export const SECTIONS = [...CORE, ...FAR];
for (const sec of SECTIONS) for (const l of sec.levels) if (l.gates) l.target = l.gates[l.gates.length - 1];

/** Whether a level has anything that moves (a body on a rail, a Moon with no place given, a ring on a rail or a body): such a level has the launch countdown. */
export const hasMovers = isMoving;
export const LEVELS = SECTIONS.flatMap(s => s.levels);
/** The section a level (its index) belongs to. */
export const sectionOf = n => SECTIONS.find(s => s.levels.includes(LEVELS[n]));
/** The level of a day (YYYYMMDD): the same for everyone, from the fourth level on, by integer arithmetic only so every device agrees. */
export const dailyLevel = day => { const pool = LEVELS.slice(3); return pool[(Math.imul(day, 2654435761) >>> 0) % pool.length]; };
