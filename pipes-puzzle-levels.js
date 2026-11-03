// Pipes, the puzzle: the levels (November 2026). A level is its map (. open ground, # rock, S the wellhead, T the terminal,
// ─ │ └ ┘ ┌ ┐ ┼ old pipe, 1-9 stakes), the side the wellhead's oil leaves by (out) and the terminal's inlet is on, the
// hand of pieces to lay (h v ne nw se sw x, a count each), and the routes that solve it: the side the oil leaves each
// square by, from the wellhead on. Made by pipes-puzzle-make.js, which keeps rock only where the level needs it to have
// one answer, and checked by tests/pipes-puzzle.mjs, which solves every level again and wants those routes and no others.
// A level's id is its identity (stars are kept by it): new levels go at the end of a chapter with a new id.

export const CHAPTERS = [
  { key: "a", name: "Laying", rule: "Lay every piece of the hand, and the oil runs through them all." },
  { key: "b", name: "Rock", rule: "Rock blocks the way: the oil goes round it." },
  { key: "c", name: "Crossings", rule: "A crossing carries the oil straight over itself: one piece, two passes." },
  { key: "d", name: "Old pipe", rule: "Old pipe is already in the ground. The oil must run through it." },
  { key: "e", name: "Stakes", rule: "The oil passes the numbered stakes in order." },
  { key: "f", name: "The field", rule: "Everything at once, on a bigger field." },
];

export const LEVELS = [
  // Laying
  { id: "a1", name: "Wellhead", chapter: "a", out: "W", inlet: "N", hand: "h1 v3 ne1 se1 sw1", sols: ["NNNNEES"],
    map: [".....", "..T..", ".....", ".....", ".S..."] },
  { id: "a2", name: "Flowline", chapter: "a", out: "W", inlet: "S", hand: "h5 ne1 nw1 se1", sols: ["WWSEEEEN"],
    map: ["...ST", ".....", ".....", ".....", "....."] },
  { id: "a3", name: "Manifold", chapter: "a", out: "S", inlet: "E", hand: "v2 ne2 nw2 se1 sw2", sols: ["WSSESENNW"],
    map: ["...S.", ".....", "...T.", ".....", "....."] },
  { id: "a4", name: "Gathering", chapter: "a", out: "S", inlet: "S", hand: "h1 v1 ne1 nw4 se3", sols: ["WSWSEENENN"],
    map: [".....", "...ST", ".....", ".....", "....."] },
  { id: "a5", name: "Header", chapter: "a", out: "W", inlet: "N", hand: "h4 ne2 nw1 se2 sw2", sols: ["WNEEESESWWS"],
    map: [".....", "..S..", ".....", "..T..", "....."] },
  // Rock
  { id: "b1", name: "Shale", chapter: "b", out: "S", inlet: "E", hand: "h1 v1 ne2 nw2 se1 sw2", sols: ["WNWNNWSWW"],
    map: ["......", ".#....", "T...#.", "..#..S", "...#..", "..#..."] },
  { id: "b2", name: "Basalt", chapter: "b", out: "S", inlet: "N", hand: "h2 ne2 nw2 se2 sw2", sols: ["WNWWWSESWS"],
    map: ["....S.", "..#...", ".....#", "T..#..", "......", "......"] },
  { id: "b3", name: "Scree", chapter: "b", out: "N", inlet: "N", hand: "h2 v1 ne1 nw2 se3 sw2", sols: ["ENWNENNWWWS"],
    map: ["......", "..T.#.", "......", "..##..", "......", "....S."] },
  { id: "b4", name: "Cap rock", chapter: "b", out: "E", inlet: "S", hand: "h5 v2 ne1 nw2 se1 sw1", sols: ["ENWWWNEEENNN"],
    map: [".....T", "....#.", "....#.", "......", ".#....", "...S.."] },
  { id: "b5", name: "Bedrock", chapter: "b", out: "W", inlet: "W", hand: "h5 v2 ne2 nw1 se2 sw1", sols: ["WWNNNEENWNEEE"],
    map: ["....T.", "#...#.", "...#..", "..#...", "......", "...S.."] },
  // Crossings
  { id: "c1", name: "Overpass", chapter: "c", out: "N", inlet: "N", hand: "v1 ne1 nw1 se2 sw2 x1", sols: ["WSSSWNEES"],
    map: ["......", ".....S", "......", ".....T", "......", "......"] },
  { id: "c2", name: "Interchange", chapter: "c", out: "W", inlet: "E", hand: "h2 ne2 nw1 se1 sw2 x1", sols: ["WNWWSENNWW"],
    map: ["......", "......", ".#....", "T..#..", "#...#.", ".....S"] },
  { id: "c3", name: "Culvert", chapter: "c", out: "E", inlet: "S", hand: "h1 v3 ne2 nw1 sw2 x1", sols: ["ESSSEESWNNN"],
    map: [".S....", "..#.T.", ".....#", "......", "......", "......"] },
  { id: "c4", name: "Viaduct", chapter: "c", out: "S", inlet: "S", hand: "h1 v1 ne3 nw2 se1 sw2 x1", sols: ["WNWWSENNWWNN"],
    map: [".T....", "..#...", "....#.", ".#...S", "......", "...#.."] },
  { id: "c5", name: "Junction", chapter: "c", out: "S", inlet: "S", hand: "v3 ne2 nw2 se1 sw1 x2", sols: ["SSENNNESWWWNN"],
    map: ["....#.", "..T..#", "...S..", ".#....", ".##...", "......"] },
  // Old pipe
  { id: "d1", name: "Salvage", chapter: "d", out: "W", inlet: "S", hand: "h1 ne2 nw2 se2 sw1", sols: ["NENNWWNEEN"],
    map: [".....T", "....─.", "......", ".....│", "......", ".....S"] },
  { id: "d2", name: "Retrofit", chapter: "d", out: "S", inlet: "S", hand: "h1 v1 ne2 nw2 se1 sw2", sols: ["SESEENESSEN"],
    map: ["......", "S.....", "...#..", "└.#...", "....│T", "......"] },
  { id: "d3", name: "Legacy", chapter: "d", out: "W", inlet: "N", hand: "h1 v3 ne3 se1 sw1", sols: ["WNWNWNNNEESS"],
    map: ["..┐...", "......", "..T...", ".┐....", "......", "...─S.", "......"] },
  { id: "d4", name: "Tie-in", chapter: "d", out: "S", inlet: "S", hand: "h1 v4 ne2 nw1 se1 sw1", sols: ["SENNNWNEESENN"],
    map: ["......", "...T..", "......", ".┐.┘..", "S.....", "......", "└....."] },
  { id: "d5", name: "Splice", chapter: "d", out: "E", inlet: "S", hand: "h1 v3 ne3 nw1 se1 sw2", sols: ["SWWNNWSSWNNWNN"],
    map: ["......", "......", "T.....", "......", ".┐....", ".│..S.", ".....┘"] },
  // Stakes
  { id: "e1", name: "Survey", chapter: "e", out: "N", inlet: "S", hand: "h1 v5 ne1 nw1 se1 sw1", sols: ["WWSSSWNNNN"],
    map: ["T.....", ".1....", "...S..", "......", ".2....", "......", "......"] },
  { id: "e2", name: "Chainage", chapter: "e", out: "N", inlet: "N", hand: "v1 ne2 nw2 se3 sw3", sols: ["WSWSSWNWNWS"],
    map: ["......", "......", "......", "...1.S", "T.....", "...2..", "......"] },
  { id: "e3", name: "Benchmark", chapter: "e", out: "N", inlet: "W", hand: "h4 v1 ne2 nw1 se2 sw2", sols: ["NEENWNWWWNEE"],
    map: ["..T...", "3..2..", "......", ".#1...", "......", "..S...", "......"] },
  { id: "e4", name: "Traverse", chapter: "e", out: "S", inlet: "W", hand: "h3 v1 ne2 nw3 se3 sw1", sols: ["WSWNNENWWNEEE"],
    map: ["...T..", "3.2...", "...S..", "......", "..1...", "......", "......"] },
  { id: "e5", name: "Datum", chapter: "e", out: "E", inlet: "E", hand: "h1 v3 ne2 nw3 se2 sw3", sols: ["SENEESSSSWSESW"],
    map: ["S.1...", "...#..", "......", "...#2.", "......", "...3..", "...T.."] },
  // The field
  { id: "f1", name: "Zhoushan", chapter: "f", out: "E", inlet: "W", hand: "v2 ne3 nw2 se2 sw3 x1", sols: ["NWNWSWWNESSSSE"],
    map: [".......", ".......", "..#....", ".......", ".......", "..#S.#.", ".......", "..T...."] },
  { id: "f2", name: "Fos", chapter: "f", out: "S", inlet: "N", hand: "h4 v2 ne2 nw2 se2 sw1", sols: ["SSWWWWNEENWNEES"],
    map: ["......S", "..#.┐T.", ".......", "....─..", ".......", ".......", ".......", "......."] },
  { id: "f3", name: "ISAB", chapter: "f", out: "S", inlet: "S", hand: "h2 v2 ne2 nw4 se3 sw1 x1", sols: ["SSWNNEENENWWWNEN"],
    map: [".......", ".T.....", ".......", "..2....", ".S.....", ".......", "..#....", ".1....."] },
  { id: "f4", name: "Rotterdam", chapter: "f", out: "W", inlet: "S", hand: "h2 v5 ne2 nw2 se3 sw1", sols: ["SSEENNNNWSWNNEENN"],
    map: ["......T", ".......", "......2", ".......", ".....┘.", ".....S│", ".......", "....1.."] },
  { id: "f5", name: "Geneva", chapter: "f", out: "N", inlet: "E", hand: "h4 v3 ne1 nw3 se3 sw2 x1", sols: ["EEESWWSSSWSEENNNWW"],
    map: [".......", "#......", ".......", "S1..#..", "T..#.#.", "#.2....", ".......", "......."] },
];
