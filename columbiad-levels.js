// Columbiad's levels: plain data, in sections of about six, each adding one idea (the design doc's table). The first section is the
// Earth alone and one goal, Hit; the next four take the engine's Moon (columbiad-engine.js) and its goals one at a time.
//
// A level: { id, name, note (told once on arriving), site (the cannon's place on the Earth, degrees round from the right; 90 is the
// top), target { at, r } (the ring's middle and radius in Earth radii: bigger is easier; or { body, off, r } riding a body, or
// { rail, r } on a rail of its own), goal { type: "hit" | "soft" | "fast" | "gates" | "return" | "orbit", ... }, gates (the rings
// of a gated goal, in order, the last the target), scatter { v (a share), deg } (the shot-to-shot error in speed and aim, one
// standard deviation), cone { len (how many Earth radii of flight the preview shows), dt, rec (its coarse step and its path's
// spacing, for a far world) }, barrels (the most powder the level loads), tMax (seconds of flight allowed), par (shots),
// bodies (the world: the Earth alone when absent; the Moon is { id: "moon" } on its rail, or { id: "moon", at } standing still,
// any other body gives its mu, r and rail), band { lean, charge: [from, to] } (where on the dial the solutions lie: the bots sweep
// that, not the whole dial), frame (the aim view's box), look (how a body is drawn), period (seconds after which the world
// repeats, when it moves) }.
//
// The numbers were set with the bots (tools/columbiad-bench.mjs): each ring is a share of the dial's moves that win (the
// design's 0.2% to 5%, of the band for the Moon's levels), the best solutions hold at 70 to 100% under the scatter, and a later level has a
// smaller ring, more scatter and a shorter cone. Targets are written out, not computed, so the same number is used on every device.
// A moving world is fired into at the time it is: a shot is { angle, charge, t }, and t is when the gun fires.
const MOON = [10.5, 59.4];                      // the Moon standing still, 60.3 Earth radii from the centre, 10 degrees right of up
const NEAR = [-17.7, 44.1];
const OVER = [0, 60.3];                         // the Moon straight over the cannon
const HOME = { at: [0, 1], r: 0.5 };            // a ring on the ground at the foot of the gun: where a shell fired straight up comes down                     // a nearer place for it: 47.5 R, 22 degrees left of up
const RAIL = ph => ({ id: "moon", rail: { phase: ph } });       // the Moon on its rail, its 40 seconds' circle, starting ph of a turn round
const SWING = { barrels: 16, tMax: 14, bounds: 130, scatter: { v: 0.0005, deg: 0.05 }, band: { lean: 90, charge: [14.6, 15.9] }, cone: { len: 62, dt: 1 / 30, rec: 0.3 }, par: 1, period: 40, frame: [-70, -6, 70, 72] };
const MOONS = { barrels: 16, tMax: 14, bounds: 130, scatter: { v: 0.0005, deg: 0.05 }, band: { lean: 30, charge: [14, 16] }, cone: { len: 62, dt: 1 / 30, rec: 0.3 }, par: 1 };

export const SECTIONS = [
  { id: 1, name: "The proving ground", idea: "Earth only: charge sets range, gravity bends the arc", open: "all", levels: [
    { id: "1-1", name: "First round", note: "A mortar lob: the more powder, the farther it falls.",
      site: 90, target: { at: [0.587, 1.104], r: 0.30 }, goal: { type: "hit" }, scatter: { v: 0.010, deg: 0.5 }, cone: { len: 6 }, barrels: 9, tMax: 0.9, par: 1 },
    { id: "1-2", name: "Higher ground", note: "A ring above the horizon. Loft the shell and let gravity bring it in.",
      site: 90, target: { at: [1.131, 1.131], r: 0.24 }, goal: { type: "hit" }, scatter: { v: 0.012, deg: 0.6 }, cone: { len: 5 }, barrels: 12, tMax: 0.9, par: 1 },
    { id: "1-3", name: "Over the horizon", note: "The ring lies beyond the curve of the Earth. A shell fired level, with powder enough, follows the ground round.",
      site: 90, target: { at: [1.295, 0.113], r: 0.20 }, goal: { type: "hit" }, scatter: { v: 0.015, deg: 0.8 }, cone: { len: 4 }, barrels: 12, tMax: 0.9, par: 1 },
    { id: "1-4", name: "The long way round", note: "The ring is behind the world. Either way round will do.",
      site: 90, target: { at: [0.650, -1.126], r: 0.17 }, goal: { type: "hit" }, scatter: { v: 0.020, deg: 1.0 }, cone: { len: 3.2 }, barrels: 12, tMax: 0.9, par: 1 },
    { id: "1-5", name: "Far limb", note: "A high ring on the far side. The cone is short: trust the arc.",
      site: 90, target: { at: [1.871, -0.330], r: 0.15 }, goal: { type: "hit" }, scatter: { v: 0.020, deg: 1.0 }, cone: { len: 2.6 }, barrels: 13, tMax: 0.9, par: 1 },
    { id: "1-6", name: "Antipode", note: "Straight through the world, as far from the cannon as the Earth allows.",
      site: 90, target: { at: [0.000, -1.600], r: 0.13 }, goal: { type: "hit" }, scatter: { v: 0.020, deg: 1.0 }, cone: { len: 2.2 }, barrels: 13, tMax: 0.9, par: 1 },
  ] },
  { id: 2, name: "The Moon's pull", idea: "The Moon stands still, 60 Earth radii up, and pulls: powder near the top of the dial reaches it", levels: [
    { ...MOONS, id: "2-1", name: "Moonfall", note: "The Moon is 60 Earth radii away and pulls on the shell: nearly all the powder reaches it.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: MOON }], target: { body: "moon", r: 1.8 }, goal: { type: "hit" }, frame: [-27, -6, 41, 80] },
    { ...MOONS, id: "2-2", name: "Over the Moon", note: "A ring above the Moon. Its pull bends the arc: aim beside it and be drawn in.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: MOON }], target: { at: [11, 83], r: 2.5 }, goal: { type: "hit" }, frame: [-27, -6, 41, 94] },
    { ...MOONS, id: "2-3", name: "Skimming", note: "A nearer Moon, and a ring hugging its far side.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: NEAR }], target: { at: [-12, 50.5], r: 2.2 }, goal: { type: "hit" }, frame: [-40, -6, 28, 66], band: { lean: 36, charge: [13.5, 15.2] } },
    { ...MOONS, id: "2-4", name: "Behind the Moon", note: "Dead behind the Moon, as the gun sees it. The shell must go round.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: MOON }], target: { at: [12.7, 71.7], r: 1.8 }, goal: { type: "hit" }, frame: [-27, -6, 41, 90] },
    { ...MOONS, id: "2-5", name: "A far Moon", note: "The Moon is farther up here: the very top of the dial.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: [-24, 62] }], target: { at: [-27, 67.5], r: 1.8 }, goal: { type: "hit" }, frame: [-48, -6, 20, 90], band: { lean: 36, charge: [14.6, 16] } },
  ] },
  { id: 3, name: "The Moon moves", idea: "The Moon goes round in 40 seconds: the cone is the aim for this moment, so fire when it is ready", levels: [
    { ...SWING, id: "3-1", name: "Tracking", note: "Now the Moon moves, once round in 40 seconds. The cone shows where a shot fired this instant goes: wait for it to meet the ring.",
      site: 90, bodies: [{ id: "earth" }, RAIL(0.18)], target: { body: "moon", r: 3.5 }, goal: { type: "hit" } },
    { ...SWING, id: "3-2", name: "Leading it", note: "A smaller ring, and the Moon will have moved on by the time the shell is there.",
      site: 90, bodies: [{ id: "earth" }, RAIL(0.62)], target: { body: "moon", r: 2.2 }, goal: { type: "hit" } },
    { ...SWING, id: "3-3", name: "Above it", note: "The ring rides above the Moon, so the Moon's pull bends the shell on the way in.",
      site: 90, bodies: [{ id: "earth" }, RAIL(0.35)], target: { body: "moon", off: [0, 9], r: 2.6 }, goal: { type: "hit" } },
    { ...SWING, id: "3-4", name: "Half a cone", note: "The preview stops halfway. Judge the rest by the Moon.",
      site: 90, bodies: [{ id: "earth" }, RAIL(0.8)], target: { body: "moon", r: 1.8 }, goal: { type: "hit" }, scatter: { v: 0.0004, deg: 0.04 }, cone: { len: 32, dt: 1 / 30, rec: 0.3 } },
  ] },
  { id: 4, name: "More moons", idea: "Moons that are not the Moon: a numbered few, one going backwards, each with a pull of its own", levels: [
    { ...SWING, id: "4-1", name: "Moon II", note: "A second moon, nearer in and lighter, the same 40 seconds round. Strike it, and mind the Moon's pull on the way.",
      site: 90, bodies: [{ id: "earth" }, RAIL(0.3), { id: "ii", mu: 30, r: 0.2, rail: { a: 36, T: 40, phase: 0.55 } }], target: { body: "ii", r: 2.8 }, goal: { type: "hit" }, ask: "Strike Moon II",
      look: { ii: { tint: [1.0, 0.8, 0.66], tilt: -14 } }, band: { lean: 90, charge: [13.8, 15.4] } },
    { ...SWING, id: "4-2", name: "Backwards", note: "Moon III goes round the other way, and weighs as much as the Moon.",
      site: 90, bodies: [{ id: "earth" }, RAIL(0.1), { id: "iii", mu: 60, r: 0.24, rail: { a: 46, T: -40, phase: 0.8 } }], target: { body: "iii", r: 2.8 }, goal: { type: "hit" }, ask: "Strike Moon III",
      look: { iii: { tint: [0.74, 0.86, 1.0], tilt: 10 } }, band: { lean: 90, charge: [14, 15.6] } },
    { ...SWING, id: "4-3", name: "Three moons", note: "Three moons, two ways round. The ring is on the farthest.",
      site: 90, bodies: [{ id: "earth" }, RAIL(0.45), { id: "ii", mu: 30, r: 0.2, rail: { a: 30, T: 40, phase: 0.05 } }, { id: "iii", mu: 60, r: 0.24, rail: { a: 46, T: -40, phase: 0.7 } }], target: { body: "moon", r: 2.4 }, goal: { type: "hit" }, ask: "Strike the Moon",
      look: { ii: { tint: [1.0, 0.8, 0.66], tilt: -14 }, iii: { tint: [0.74, 0.86, 1.0], tilt: 10 } } },
  ] },
  { id: 5, name: "Other objectives", idea: "Not only a hit: arrive gently or fast, swing round the Moon, come home", levels: [
    { ...MOONS, id: "5-1", name: "Soft touch", note: "Reach the Moon slowly. A ring shows the speed asked: a shell that has hung in the sky falls in gently, one that has raced up does not.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: MOON }], target: { body: "moon", r: 1.5 }, goal: { type: "soft", speed: 11 }, frame: [-27, -6, 41, 80] },
    { ...MOONS, id: "5-2", name: "Feather", note: "Slower still: a shell that all but stops over the Moon.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: MOON }], target: { body: "moon", r: 2.5 }, goal: { type: "soft", speed: 6 }, frame: [-27, -6, 41, 80] },
    { ...MOONS, id: "5-3", name: "Full speed", note: "The other way: through a ring above the Moon at speed, with the dial near its top.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: MOON }], target: { at: [11, 83], r: 2.5 }, goal: { type: "fast", speed: 9 }, frame: [-27, -6, 41, 94] },
    { ...MOONS, id: "5-4", name: "Swing round", note: "Bend your path round the Moon: sweep three quarters of a turn about it, inside the dotted ring.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: MOON }], target: { body: "moon", r: 5 }, goal: { type: "orbit", body: "moon", rmax: 5, sweep: 270 }, frame: [-27, -6, 41, 80], band: { lean: 14, charge: [14.7, 15.4] }, grid: { da: 0.25, dc: 0.01 } },
    { ...MOONS, id: "5-5", name: "The loop", note: "A whole turn about the Moon, inside the ring: a shell that hangs there and circles.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: MOON }], target: { body: "moon", r: 4 }, goal: { type: "orbit", body: "moon", rmax: 4, sweep: 360 }, scatter: { v: 0.0003, deg: 0.03 }, frame: [-27, -6, 41, 80], band: { lean: 14, charge: [14.7, 15.4] }, grid: { da: 0.25, dc: 0.01 } },
    { ...MOONS, id: "5-6", name: "Free return", note: "Round the Moon and home: through the gate beside it, then back down to the ring at the foot of the gun.",
      site: 90, bodies: [{ id: "earth" }, { id: "moon", at: OVER }], gates: [{ at: [5, 66], r: 3 }, HOME], target: HOME, goal: { type: "return", via: "Moon" }, tMax: 24, frame: [-27, -6, 41, 80], band: { lean: 12, charge: [14.5, 15.6] } },
  ] },
];
export const LEVELS = SECTIONS.flatMap(s => s.levels);
/** The section a level (its index) belongs to. */
export const sectionOf = n => SECTIONS.find(s => s.levels.includes(LEVELS[n]));
/** The level of a day (YYYYMMDD): the same for everyone, from the fourth level on (the first three are lessons), by integer arithmetic only so every device agrees. */
export const dailyLevel = day => { const pool = LEVELS.slice(3); return pool[(Math.imul(day, 2654435761) >>> 0) % pool.length]; };
