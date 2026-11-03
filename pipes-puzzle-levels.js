// Gears, the flat board: the levels (November 2026). A level is its map (. open ground, # pillar, S the mainspring, T the load at
// the end of the train, ─ │ └ ┘ ┌ ┐ ┼ a gear already pinned to the plate, 1-9 a numbered load that turns clockwise and a-i one that turns
// counter-clockwise), the side the mainspring's teeth face (out) and the side of the end load its inlet is on, the way that load
// must turn (spin), the hand of pieces to lay (h v ne nw se sw x, rh rv the reductions, a count each), and the routes that solve it:
// the side the power leaves each square by, from the mainspring on (lower case where the piece is a reduction). Made by
// pipes-puzzle-pick.mjs from pipes-puzzle-make.js, which keeps pillars only where the level needs them to have one answer (and fixed
// gears and loads only where they are needed too), and checked by tests/pipes-puzzle.mjs, which solves every level again and wants
// those routes and no others. A level's id is its identity (stars are kept by it): new levels go at the end of a chapter.

export const CHAPTERS = [
  { key: "a", name: "Meshing", rule: "Mesh gears from the mainspring to the load: lay every one." },
  { key: "b", name: "Pillars", rule: "A pillar is bolted through the plate: the train goes round it." },
  { key: "c", name: "Crossovers", rule: "One piece, two trains: the power may pass a crossover twice." },
  { key: "d", name: "Fixed gears", rule: "A dark pinned gear is part of the train: run through it." },
  { key: "e", name: "Loads", rule: "Loads are numbered and turn a set way: reach them in order." },
  { key: "f", name: "Reduction", rule: "A reduction flips the turn: all after it turn the other way." },
  { key: "g", name: "The movement", rule: "Everything at once: reductions, fixed gears, crossovers and loads on one plate." },
  { key: "h", name: "Complications", rule: "A bigger plate, and every piece in play." },
];

export const LEVELS = [
  // Meshing
  { id: "ga1", name: "Barrel", chapter: "a", out: "W", inlet: "S", spin: "ccw", hand: "v3 ne1 nw1 se1", sols: ["SSWNNN"],
    map: [".....", "T....", "..S..", ".....", "....."] },
  { id: "ga2", name: "Arbor", chapter: "a", out: "W", inlet: "W", spin: "cw", hand: "v3 ne2 se1 sw1", sols: ["NNNESSE"],
    map: [".....", ".....", "...T.", "..S..", "....."] },
  { id: "ga3", name: "Pinion", chapter: "a", out: "E", inlet: "N", spin: "cw", hand: "h1 v5 nw1 se1 sw1", sols: ["NNNWWSSSS"],
    map: [".....", ".....", ".....", ".S...", "T...."] },
  { id: "ga4", name: "Wheel", chapter: "a", out: "E", inlet: "E", spin: "cw", hand: "v3 ne2 nw2 se1 sw3", sols: ["SWSESENNNNW"],
    map: ["...T.", "..S..", ".....", ".....", "....."] },
  { id: "ga5", name: "Cannon", chapter: "a", out: "E", inlet: "E", spin: "ccw", hand: "v2 ne3 nw2 se1 sw4", sols: ["SSESENNWNENW"],
    map: ["...T.", ".S...", ".....", ".....", "....."] },
  // Pillars
  { id: "gb1", name: "Screw", chapter: "b", out: "S", inlet: "S", spin: "ccw", hand: "v2 ne2 nw2 se1 sw1", sols: ["SWSSESEN"],
    map: [".S....", "#.....", "......", ".#....", "..T...", "......"] },
  { id: "gb2", name: "Cock", chapter: "b", out: "S", inlet: "S", spin: "cw", hand: "h1 v2 ne2 nw2 se1 sw1", sols: ["ESWWNNNEN"],
    map: ["......", ".T....", "...#..", ".S#...", "......", "......"] },
  { id: "gb3", name: "Bridge", chapter: "b", out: "E", inlet: "W", spin: "cw", hand: "h3 ne2 nw2 se2 sw2", sols: ["ENWWNWSWWNE"],
    map: ["#.....", ".T..#.", "......", ".#.S..", "......", "......"] },
  { id: "gb4", name: "Plate", chapter: "b", out: "N", inlet: "W", spin: "ccw", hand: "h1 v2 ne3 nw1 se2 sw3", sols: ["WSSESEENESSE"],
    map: ["......", ".S....", "..#...", "......", "..##.T", "......"] },
  { id: "gb5", name: "Bezel", chapter: "b", out: "N", inlet: "W", spin: "ccw", hand: "h1 v2 ne2 nw2 se3 sw2", sols: ["NWWSESWSSENE"],
    map: ["......", "......", "..S...", "..T##.", "......", "#....."] },
  // Crossovers
  { id: "gc1", name: "Rocker", chapter: "c", out: "W", inlet: "N", spin: "cw", hand: "v2 ne1 nw1 se2 sw1 x1", sols: ["SSEENWSSS"],
    map: ["....S.", "......", "..#...", "...#..", "....T.", "......"] },
  { id: "gc2", name: "Lever", chapter: "c", out: "S", inlet: "S", spin: "ccw", hand: "h2 ne2 nw2 se1 sw1 x1", sols: ["SEENWWWSWN"],
    map: ["......", "......", "......", "...S.#", ".T....", "......"] },
  { id: "gc3", name: "Fusee", chapter: "c", out: "N", inlet: "W", spin: "cw", hand: "v2 ne1 nw2 se3 sw1 x1", sols: ["NESWWSWNNNE"],
    map: [".T....", ".#....", "......", "..S...", "......", "......"] },
  { id: "gc4", name: "Chain", chapter: "c", out: "N", inlet: "W", spin: "cw", hand: "h3 v1 ne3 se1 sw3 x1", sols: ["WWWNEESSSESEE"],
    map: ["......", "......", ".#.S..", "....#.", ".....T", "......"] },
  { id: "gc5", name: "Click", chapter: "c", out: "E", inlet: "S", spin: "ccw", hand: "h2 v1 ne2 nw3 se2 sw2 x1", sols: ["ENWSSSWWSESWWN"],
    map: ["......", "...S..", ".#.#..", ".....#", ".T..#.", "......"] },
  // Fixed gears
  { id: "gd1", name: "Stud", chapter: "d", out: "N", inlet: "S", spin: "cw", hand: "v2 ne1 nw2 se1 sw1", sols: ["NNENNWSWN"],
    map: [".T....", "......", "..┌...", "..│...", "......", "..S..."] },
  { id: "gd2", name: "Index", chapter: "d", out: "S", inlet: "S", spin: "cw", hand: "h1 v3 ne2 nw1 se1 sw1", sols: ["SSENNNEESEN"],
    map: ["......", "......", "S...T.", "..#.┘.", "│.....", "......"] },
  { id: "gd3", name: "Regulator", chapter: "d", out: "N", inlet: "S", spin: "cw", hand: "h1 v2 ne1 nw3 se2 sw1", sols: ["ENWNENNWWSWNN"],
    map: ["..T...", "......", "..└.#.", "....┌.", ".....┐", "......", "....S."] },
  { id: "gd4", name: "Hairspring", chapter: "d", out: "W", inlet: "S", spin: "ccw", hand: "h3 v2 ne1 nw1 se2 sw2", sols: ["NNENWWNNESEEEN"],
    map: ["......", "....T.", ".└....", "└.....", "..┘...", "......", "..S..."] },
  { id: "gd5", name: "Balance", chapter: "d", out: "E", inlet: "E", spin: "ccw", hand: "h2 v1 ne2 nw2 se2 sw2", sols: ["NESENNESENNWWW"],
    map: ["......", "..T..┐", "......", "...│..", "S┘....", "......", "......"] },
  // Loads
  { id: "ge1", name: "Hours", chapter: "e", out: "W", inlet: "E", spin: "cw", hand: "h1 v2 ne2 nw1 se1 sw2", sols: ["NNENWNNWW"],
    map: [".T....", "......", "..#2..", "....1.", "....#.", "....S.", "......"] },
  { id: "ge2", name: "Minutes", chapter: "e", out: "S", inlet: "S", spin: "ccw", hand: "h3 v1 ne2 nw3 se2 sw1", sols: ["EENNWWNENEEN"],
    map: ["......", "...T..", "..b...", "..#...", "......", "S..#..", "..a..."] },
  { id: "ge3", name: "Seconds", chapter: "e", out: "W", inlet: "W", spin: "ccw", hand: "h1 v1 ne3 nw2 se3 sw2", sols: ["NNWWNENESENE"],
    map: ["......", "......", ".....T", "....c.", ".b.a..", "......", "....S."] },
  { id: "ge4", name: "Date", chapter: "e", out: "E", inlet: "N", spin: "cw", hand: "h1 v1 ne3 nw2 se2 sw4", sols: ["ENWNNWNWSWNWS"],
    map: ["..c...", "T...2.", "......", "....1.", "...S..", "......", "......"] },
  { id: "ge5", name: "Moon", chapter: "e", out: "S", inlet: "S", spin: "cw", hand: "h2 v3 ne2 nw4 se3 sw1", sols: ["SSWSWWSESEENNEN"],
    map: ["....S.", "......", "......", "..#.aT", "....3.", ".2.#..", "......"] },
  // Reduction
  { id: "gf1", name: "Pair", chapter: "f", out: "E", inlet: "S", spin: "cw", hand: "v4 ne2 nw1 sw2 rv1", sols: ["SSSWNnWNNN"],
    map: ["...T..", "......", "....S.", "....2.", "......", ".....1", "......"] },
  { id: "gf2", name: "Compound", chapter: "f", out: "W", inlet: "E", spin: "ccw", hand: "h2 ne3 nw1 se1 sw3 rv1", sols: ["NEESsESWWNW"],
    map: ["......", ".S....", "T.a...", "...b..", "......", "......", "......"] },
  { id: "gf3", name: "Ratio", chapter: "f", out: "N", inlet: "E", spin: "cw", hand: "v2 ne1 nw2 se2 sw2 rh1", sols: ["NEeNNENWNW"],
    map: [".T....", "...c..", "..b...", "......", "..a...", ".#....", "S....."] },
  { id: "gf4", name: "Step-down", chapter: "f", out: "E", inlet: "W", spin: "cw", hand: "h1 ne2 nw2 se2 sw2 rh1 rv1", sols: ["ESWSWSsEeSE"],
    map: ["......", "S.....", ".2a...", "...#..", ".#....", "......", "..cT.."] },
  { id: "gf5", name: "Count", chapter: "f", out: "N", inlet: "W", spin: "ccw", hand: "h1 ne2 nw3 se4 sw2 rv2", sols: ["nESsENEENWNENE"],
    map: ["......", "...#.T", "...3..", "a.#...", "...2..", "S..#..", "......"] },
  // The movement
  { id: "gg1", name: "Calibre", chapter: "g", out: "W", inlet: "W", spin: "ccw", hand: "h2 ne2 nw1 se2 sw1 x1 rh1", sols: ["WSESSWNEEeE"],
    map: [".......", ".......", ".#.....", "..S....", "a.#....", "...2T..", "......."] },
  { id: "gg2", name: "Keyless", chapter: "g", out: "S", inlet: "E", spin: "ccw", hand: "h1 ne1 nw3 se2 sw3 rh1", sols: ["ESWSEESWSWNWw"],
    map: [".......", "....S..", ".....1.", ".......", "....└..", "..T..b.", "....└.."] },
  { id: "gg3", name: "Winding", chapter: "g", out: "E", inlet: "S", spin: "ccw", hand: "h1 ne3 nw2 se1 sw3 x1 rv1", sols: ["NESEEESsWNWNN"],
    map: [".......", ".......", "#......", "..aT...", "S......", "..#b...", "......."] },
  { id: "gg4", name: "Setting", chapter: "g", out: "W", inlet: "S", spin: "ccw", hand: "h1 v2 ne3 nw2 se1 sw1 rh2", sols: ["NEeSEENESSSWwN"],
    map: [".......", ".......", ".......", "...┐.┌.", "..S.a..", "....T..", "......b"] },
  { id: "gg5", name: "Motion", chapter: "g", out: "E", inlet: "E", spin: "ccw", hand: "ne2 nw4 se3 sw3 x1 rh1", sols: ["NWNNESWWSWSWNWw"],
    map: [".......", ".......", ".......", "......1", ".......", "T......", ".#.2.S."] },
  // Complications
  { id: "gh1", name: "Date", chapter: "h", out: "S", inlet: "N", spin: "ccw", hand: "ne2 nw2 se2 sw2 x2 rh1", sols: ["EESWNNEeENWSS"],
    map: [".......", ".......", ".......", ".......", ".S...c.", "...aT..", "..b....", "......."] },
  { id: "gh2", name: "Chronograph", chapter: "h", out: "S", inlet: "N", spin: "ccw", hand: "h3 v2 ne2 nw1 se2 sw2 rh1", sols: ["WNNWwWSWWSSEEES"],
    map: ["..2─.1.", "..┘...S", ".......", "..c....", "...T...", ".......", ".......", "......."] },
  { id: "gh3", name: "Repeater", chapter: "h", out: "W", inlet: "N", spin: "ccw", hand: "v1 ne2 nw3 se4 sw2 x1 rh1", sols: ["NNENWwSWSSENWWS"],
    map: [".......", ".......", ".......", ".......", "....b#.", "...a...", ".......", "T.c.S.."] },
  { id: "gh4", name: "Tourbillon", chapter: "h", out: "W", inlet: "W", spin: "cw", hand: "h1 v2 ne2 nw3 se4 sw1 rh1 rv1", sols: ["WSsESWSEeNNENNESE"],
    map: ["1.S.┐..", "..#..T.", "└.3....", ".......", "..2....", ".......", ".......", "......."] },
  { id: "gh5", name: "Grande", chapter: "h", out: "W", inlet: "W", spin: "cw", hand: "h1 ne3 nw3 se4 sw2 x1 rh2", sols: ["WSWNWNENEENWSSEee"],
    map: [".......", "...c.#.", ".....T.", "2.1.S..", "...#...", ".#.....", ".......", "......."] },
];
