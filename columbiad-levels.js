// Columbiad's levels: plain data, in sections of about six, each adding one idea (the design doc's table). Milestone 1 has
// the first section only, Earth alone and one goal, Hit; the engine already takes the Moon on its rail, an arrival speed
// and more goals (columbiad-engine.js), so the later sections only add data here.
//
// A level: { id, name, note, site (the cannon's place on the Earth, degrees round from the right; 90 is the top), target { at, r }
// (the ring's middle and radius in Earth radii: bigger is easier), goal { type }, scatter { v (a share), deg } (the shot-to-shot
// error in speed and aim, one standard deviation), cone { len } (how many Earth radii of flight the preview shows), barrels (the
// most powder the level loads), tMax (seconds of flight allowed), par (shots) }.
//
// The numbers were set with the bots (tools/columbiad-bench.mjs): each ring is a share of the dial's moves that win (the
// design's 0.2% to 5%), the best solutions hold at 70 to 100% under the scatter, and a later level has a smaller ring, more
// scatter and a shorter cone. Targets are written out, not computed, so the same number is used on every device.
export const SECTIONS = [
  { id: 1, name: "The proving ground", idea: "Earth only: charge sets range, gravity bends the arc", levels: [
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
];
export const LEVELS = SECTIONS.flatMap(s => s.levels);
/** The section a level (its index) belongs to. */
export const sectionOf = n => SECTIONS.find(s => s.levels.includes(LEVELS[n]));
