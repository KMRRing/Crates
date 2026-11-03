// Pipes, the puzzle: the levels (November 2026). A level is its map (. open ground, # rock, S the wellhead, T the terminal,
// ─ │ └ ┘ ┌ ┐ ┼ old pipe, 1-9 stakes), the side the wellhead's oil leaves by (out) and the side of the terminal its inlet
// is on, the hand of pieces to lay (h v ne nw se sw x, a count each), and the routes that solve it: the side the oil
// leaves each square by, from the wellhead on. Made by pipes-puzzle-pick.mjs from pipes-puzzle-make.js, which keeps rock
// only where the level needs it to have one answer (and old pipe and stakes only where they are needed too), and checked
// by tests/pipes-puzzle.mjs, which solves every level again and wants those routes and no others.
// A level's id is its identity (stars are kept by it): new levels go at the end of a chapter with a new id.

export const CHAPTERS = [
  { key: "a", name: "Laying", rule: "Lay every piece of the hand, and the oil runs through them all." },
  { key: "b", name: "Rock", rule: "Rock blocks the way: the oil goes round it." },
  { key: "c", name: "Crossings", rule: "A crossing carries the oil across itself: one piece, two passes." },
  { key: "d", name: "Old pipe", rule: "Old pipe is already in the ground. The oil must run through it." },
  { key: "e", name: "Stakes", rule: "The oil passes the numbered stakes in order." },
  { key: "f", name: "The field", rule: "Everything at once, on a bigger field." },
];

export const LEVELS = [
  // Laying
  { id: "a1", name: "Wellhead", chapter: "a", out: "N", inlet: "E", hand: "v1 nw2 se2 sw1", sols: ["ENESSW"],
    map: [".....", ".....", ".ST..", ".....", "....."] },
  { id: "a2", name: "Flowline", chapter: "a", out: "S", inlet: "W", hand: "h1 v1 ne2 nw1 se1 sw1", sols: ["WNWSSEE"],
    map: ["....S", ".....", "....T", ".....", "....."] },
  { id: "a3", name: "Manifold", chapter: "a", out: "W", inlet: "W", hand: "h1 v3 ne2 se1 sw1", sols: ["NNEESSSE"],
    map: [".....", ".....", "..S..", "....T", "....."] },
  { id: "a4", name: "Gathering", chapter: "a", out: "W", inlet: "W", hand: "v1 ne3 nw1 se2 sw2", sols: ["NWNENESSE"],
    map: [".....", ".....", "....T", "...S.", "....."] },
  { id: "a5", name: "Header", chapter: "a", out: "N", inlet: "N", hand: "h3 v1 ne2 nw1 se2 sw3", sols: ["ESSWWWNWNEES"],
    map: [".....", "..TS.", ".....", ".....", "....."] },
  // Rock
  { id: "b1", name: "Shale", chapter: "b", out: "N", inlet: "E", hand: "h1 v2 ne1 nw1 se1 sw2", sols: ["WNENNNWW"],
    map: ["...T..", "......", "...##.", "......", "......", ".....S"] },
  { id: "b2", name: "Basalt", chapter: "b", out: "N", inlet: "W", hand: "h2 v2 ne2 se1 sw2", sols: ["WNNNWWWSE"],
    map: ["......", ".T#...", "....#.", "......", "....S.", "......"] },
  { id: "b3", name: "Scree", chapter: "b", out: "N", inlet: "N", hand: "h3 ne1 nw2 se3 sw2", sols: ["ENWNEEENEES"],
    map: ["..#...", "....#T", "..#...", "......", "S.....", "......"] },
  { id: "b4", name: "Cap rock", chapter: "b", out: "E", inlet: "S", hand: "h2 v3 ne2 nw2 se1 sw2", sols: ["SEESWSSSEENN"],
    map: [".S.#..", "......", ".#....", "....#T", "..#...", "......"] },
  { id: "b5", name: "Bedrock", chapter: "b", out: "N", inlet: "W", hand: "h4 v3 ne2 nw1 se2 sw2", sols: ["WWNNWSSWWSSEEE"],
    map: ["......", ".#..#.", "#....#", "......", "..#..S", "...T.."] },
  // Crossings
  { id: "c1", name: "Overpass", chapter: "c", out: "N", inlet: "E", hand: "h1 ne1 nw1 se1 sw2 x1", sols: ["EESWNNWW"],
    map: [".T....", "......", "..S...", "......", "......", "......"] },
  { id: "c2", name: "Interchange", chapter: "c", out: "S", inlet: "N", hand: "v3 ne1 nw1 se1 sw1 x1", sols: ["SEENNWSSS"],
    map: ["...#..", ".S....", "......", "#.....", "..T...", "......"] },
  { id: "c3", name: "Culvert", chapter: "c", out: "E", inlet: "S", hand: "h2 v1 ne1 nw2 se1 sw1 x1", sols: ["ENNWWWSENN"],
    map: ["......", "......", ".T..#.", "......", "..#...", ".S...."] },
  { id: "c4", name: "Viaduct", chapter: "c", out: "N", inlet: "N", hand: "h3 ne1 nw1 se2 sw2 x1", sols: ["WWNNEESWWWS"],
    map: ["......", "......", "..T...", ".....S", "......", "......"] },
  { id: "c5", name: "Junction", chapter: "c", out: "E", inlet: "S", hand: "h1 v1 ne2 nw3 se2 sw2 x1", sols: ["SSWSWWNESSEEN"],
    map: ["......", "..S.#.", "..#...", "......", "...T..", "#....."] },
  // Old pipe
  { id: "d1", name: "Salvage", chapter: "d", out: "W", inlet: "E", hand: "h1 v1 ne1 nw1 se3 sw1", sols: ["WSWSWSESSW"],
    map: [".....S", "...┘..", "..┘...", "......", ".#....", ".T...."] },
  { id: "d2", name: "Retrofit", chapter: "d", out: "W", inlet: "N", hand: "h4 ne2 nw1 se1 sw1", sols: ["NENWWNEEEES"],
    map: ["......", "..┐.T.", ".┌....", "..S...", "......", "......"] },
  { id: "d3", name: "Legacy", chapter: "d", out: "S", inlet: "W", hand: "h2 v1 ne1 nw1 se3 sw1", sols: ["WSSWSWWNWNEE"],
    map: ["......", "......", ".....S", ".....┘", "..T...", "└.#.┘.", "......"] },
  { id: "d4", name: "Tie-in", chapter: "d", out: "S", inlet: "W", hand: "h2 v2 ne2 nw1 se1 sw2", sols: ["WSESSWWWNNESE"],
    map: ["......", ".....S", ".....┘", "..┌.└.", "....T.", "......", "......"] },
  { id: "d5", name: "Splice", chapter: "d", out: "S", inlet: "E", hand: "h2 v3 ne1 nw2 se2 sw1", sols: ["SWWWNEENNNENNW"],
    map: ["..T...", "......", "...┘..", "......", "..│S..", "......", ".─...."] },
  // Stakes
  { id: "e1", name: "Survey", chapter: "e", out: "N", inlet: "N", hand: "h1 v2 ne1 nw1 se2 sw2", sols: ["NWSWSSEES"],
    map: ["......", "......", ".....1", "...2..", ".....S", "......", ".....T"] },
  { id: "e2", name: "Chainage", chapter: "e", out: "E", inlet: "W", hand: "h4 ne1 nw2 se2 sw1", sols: ["ENEEESWWSE"],
    map: ["......", "......", "S.1.2.", "....T.", "......", "......", "......"] },
  { id: "e3", name: "Benchmark", chapter: "e", out: "W", inlet: "S", hand: "h1 v3 ne3 nw2 se2 sw2", sols: ["WNENNESENNWNN"],
    map: ["..T...", "...#..", "...3..", "..2...", "#.....", "......", "1.S..."] },
  { id: "e4", name: "Traverse", chapter: "e", out: "S", inlet: "E", hand: "h4 v3 ne1 nw2 se1 sw1", sols: ["SSSWWSEESWWW"],
    map: [".....S", "......", "......", "......", ".....1", "....23", "..T..."] },
  { id: "e5", name: "Datum", chapter: "e", out: "W", inlet: "N", hand: "h4 v2 ne3 nw1 se2 sw3", sols: ["NNWNEEENWNEEESS"],
    map: ["..3...", ".#....", "1.2..T", "......", "#.....", "..S...", "......"] },
  // The field
  { id: "f1", name: "Zhoushan", chapter: "f", out: "E", inlet: "W", hand: "v2 ne3 nw2 se2 sw3 x1", sols: ["NNWSWWNESSSESE"],
    map: [".......", ".......", ".....S.", ".......", "....#.T", ".......", ".......", "......."] },
  { id: "f2", name: "Fos", chapter: "f", out: "W", inlet: "S", hand: "h2 v4 ne2 nw2 se2 sw1", sols: ["SSESSENNEEESSWN"],
    map: ["..S....", "....#..", "..┐....", ".....T.", "....#└.", "..#....", ".......", "......."] },
  { id: "f3", name: "ISAB", chapter: "f", out: "E", inlet: "S", hand: "v2 ne2 nw4 se3 sw2 x1", sols: ["NENNESWWNNNWSWN"],
    map: [".......", ".....#.", "..T....", ".....#.", "..##21.", ".......", ".......", "...S..."] },
  { id: "f4", name: "Rotterdam", chapter: "f", out: "N", inlet: "W", hand: "h4 v2 ne3 nw1 se3 sw3", sols: ["WWSSSEEENENWNNWNEE"],
    map: ["....T..", ".......", ".1..#..", "│.S.2#.", ".......", "...┘...", ".......", "......."] },
  { id: "f5", name: "Geneva", chapter: "f", out: "S", inlet: "S", hand: "h2 v5 ne2 nw3 se2 sw1 x1", sols: ["WSSSEEENNESWWNNNN"],
    map: [".......", ".......", "..T....", ".S.....", "..2.#..", ".#.....", "1#.....", "......."] },
];
