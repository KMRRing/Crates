// Pipes, the 3D map: the levels (November 2026). A level is its map, a list of floors from the bottom, each a list of rows
// (. open ground, # rock, S the wellhead, T the terminal, ─ │ └ ┘ ┌ ┐ ┼ and the letters of pipes-puzzle.js's GLYPH old pipe, 1-9
// stakes), the side the wellhead's oil leaves by (out: N E S W U D) and the side of the terminal its inlet is on, the hand of
// pieces to lay (a count each), and the routes that solve it: the side the oil leaves each square by, from the wellhead on.
// Made by pipes-map-pick.mjs from pipes-puzzle-make.js and checked by tests/pipes-map.mjs, which solves every level again and
// wants those routes and no others. A level's id is its identity (stars are kept by it): new levels go at the end of a chapter.

export const CHAPTERS = [
  { key: "a", name: "Stairs", rule: "The map is a stack of floors: a riser carries the pipe up or down to the next." },
  { key: "b", name: "Shafts", rule: "Bigger: four floors of four by four, and rock in the way." },
  { key: "c", name: "Crossings", rule: "A crossing carries the oil across itself, and a riser may cross a straight too." },
  { key: "d", name: "Old pipe and stakes", rule: "Old pipe is in the ground and stakes are passed in order, on every floor." },
  { key: "e", name: "The stack", rule: "Five floors of five by five." },
];

export const LEVELS = [
  // Stairs
  { id: "a1", name: "Landing", chapter: "a", out: "S", inlet: "E", hand: "h1 v1 nu1 wd1", sols: ["SUWW"],
    map: [
      ["...", "...", "..."],
      ["..S", "...", "..."],
      ["...", "...", "T.."],
    ] },
  { id: "a2", name: "Flight", chapter: "a", out: "S", inlet: "D", hand: "h1 v1 nw1 z1 eu1", sols: ["SWWUU"],
    map: [
      ["..S", "...", "..."],
      ["...", "...", "..."],
      ["...", "...", "T.."],
    ] },
  { id: "a3", name: "Mezzanine", chapter: "a", out: "U", inlet: "U", hand: "ne1 eu1 wu1 ed1 sd1 wd2", sols: ["EUWNDED"],
    map: [
      [".T.", "S..", "..."],
      ["...", "...", "..."],
      ["...", "...", "..."],
    ] },
  { id: "a4", name: "Atrium", chapter: "a", out: "N", inlet: "D", hand: "v2 se1 sw1 z1 eu1 wu1 nd1", sols: ["NWSSDDEU"],
    map: [
      ["...", "...", "..#"],
      ["...", "...", ".T."],
      ["...", "...", ".S."],
    ] },
  { id: "a5", name: "Penthouse", chapter: "a", out: "N", inlet: "N", hand: "se1 sw2 nu1 eu1 su1 nd1 ed1 wd1", sols: ["WUNESUEDS"],
    map: [
      ["...", "...", "#S."],
      ["...", "...", ".#T"],
      ["...", "...", "..."],
    ] },
  // Shafts
  { id: "b1", name: "Winze", chapter: "b", out: "W", inlet: "N", hand: "h3 nw1 sw1 eu1 su1 ed2", sols: ["WDSWUEEES"],
    map: [
      ["....", "..#.", "....", "...."],
      ["...S", "....", "...T", "...."],
      ["....", "....", "....", "...."],
      ["....", "....", "....", "...."],
    ] },
  { id: "b2", name: "Raise", chapter: "b", out: "U", inlet: "N", hand: "se1 sw1 z1 eu1 su1 wu1 nd3 sd1", sols: ["NDDSDWUNWS"],
    map: [
      ["....", "....", "....", "...."],
      ["....", "T...", "....", "...."],
      ["#...", "..S.", "....", "...."],
      ["....", "....", "....", "...."],
    ] },
  { id: "b3", name: "Adit", chapter: "b", out: "S", inlet: "U", hand: "h1 v1 nw1 se1 sw1 nu2 eu1 nd2 sd2", sols: ["DEENNESUSUSD"],
    map: [
      ["....", "....", "....", "...."],
      ["....", ".#..", "....", "...."],
      ["....", "S...", "....", "...T"],
      ["....", "....", "#...", "...."],
    ] },
  { id: "b4", name: "Drift", chapter: "b", out: "U", inlet: "N", hand: "h2 ne1 se1 nu1 su1 wu1 nd1 sd2 wd1", sols: ["WWSDNDSEEUS"],
    map: [
      ["....", "....", "....", "...."],
      ["..#.", "..S.", "....", "..T."],
      ["....", "....", "....", "...."],
      ["....", "....", "....", "...."],
    ] },
  { id: "b5", name: "Stope", chapter: "b", out: "E", inlet: "D", hand: "h1 v1 ne1 nw2 sw3 eu2 su1 nd1 ed1", sols: ["NWDSDENNWNWWU"],
    map: [
      ["....", ".#..", "..#.", "...."],
      ["T...", "....", "....", "...."],
      ["....", "....", "....", "..S."],
      ["....", "....", "....", "...."],
    ] },
  // Crossings
  { id: "c1", name: "Overpass", chapter: "c", out: "W", inlet: "S", hand: "h1 sw1 nu2 eu1 nd1 ed1 sd1 xn1", sols: ["WDNWUUSDNN"],
    map: [
      ["....", "....", "....", "...."],
      ["....", "..#.", "....", "...."],
      ["T...", "....", "...S", "...."],
      ["....", "....", "....", "...."],
    ] },
  { id: "c2", name: "Underpass", chapter: "c", out: "S", inlet: "E", hand: "v1 ne1 nw1 sw1 nu1 su1 nd1 sd1 xn1", sols: ["ENNUUSDNNW"],
    map: [
      ["....", "....", "..S.", "...."],
      ["..T.", "....", "....", "...."],
      ["....", "....", "....", "...#"],
      ["....", "....", "....", "...."],
    ] },
  { id: "c3", name: "Interchange", chapter: "c", out: "W", inlet: "E", hand: "ne1 nw2 se1 sw1 x1 z1 eu1 wu1 ed1 sd1", sols: ["DDENNWSEEUSW"],
    map: [
      ["....", "....", "....", "...."],
      ["....", "....", ".#..", ".T.."],
      ["....", "....", "....", ".S.."],
      ["....", "....", "....", "...."],
    ] },
  { id: "c4", name: "Flyover", chapter: "c", out: "U", inlet: "N", hand: "nw1 z1 eu2 su1 wu1 ed2 sd1 wd2 xe1", sols: ["EDDSWUUWDEEUS"],
    map: [
      ["....", "....", "....", "...."],
      ["....", "....", "....", "...."],
      ["..S.", "....", "....", "...."],
      ["....", "....", "...T", "...."],
    ] },
  // Old pipe and stakes
  { id: "d1", name: "Salvage", chapter: "d", out: "S", inlet: "S", hand: "v1 ne1 z2 eu1 su1 wu1 nd2 sd1", sols: ["DDWUUNNDDSEN"],
    map: [
      [".T..", ".┘..", "....", "...."],
      ["....", "....", ".Z..", "...."],
      ["....", ".S..", "....", "...."],
      ["....", "....", "....", "...."],
    ] },
  { id: "d2", name: "Retrofit", chapter: "d", out: "W", inlet: "D", hand: "h1 se1 nu3 eu1 su1 wu1 nd1 ed1 sd2 wd1", sols: ["DNEEDSUSUSDWU"],
    map: [
      ["....", "....", "....", "...."],
      ["..1.", "....", "....", "...."],
      ["....", "....", "....", "...."],
      ["....", ".S..", "..2.", ".T.."],
    ] },
  { id: "d3", name: "Survey", chapter: "d", out: "D", inlet: "S", hand: "h1 v3 nw2 se1 z1 nu1 eu1 su1 nd1 sd1", sols: ["DENNUSWWSUNNN"],
    map: [
      ["....", "....", "....", "...."],
      ["....", "..2.", "..1.", "...."],
      ["....", "....", "....", "...."],
      ["T...", "....", "....", "3S.."],
    ] },
  // The stack
  { id: "e1", name: "Antwerp", chapter: "e", out: "D", inlet: "S", hand: "v1 ne1 nw1 se1 z4 nu1 su3 nd2 wd1", sols: ["SSWNUUUWSDDDNUN"],
    map: [
      [".....", ".....", ".....", ".....", "....."],
      [".....", ".....", "T.S..", ".....", ".#..."],
      [".....", ".....", ".....", ".....", "....."],
      ["..#..", "..#..", "#....", ".....", "....."],
      [".....", ".....", ".....", "#....", "....."],
    ] },
  { id: "e2", name: "Houston", chapter: "e", out: "W", inlet: "N", hand: "h2 ne2 sw2 eu1 su1 wu1 ed2 wd1 xe1", sols: ["DDEUWWNWWDSEES"],
    map: [
      [".....", ".....", ".....", "..T..", "....."],
      [".....", "...#.", ".#...", ".....", "....."],
      [".....", ".#...", "....S", ".....", "....."],
      [".....", ".....", "...#.", ".....", "....."],
      [".....", ".....", ".....", ".....", "....."],
    ] },
  { id: "e3", name: "Fujairah", chapter: "e", out: "S", inlet: "D", hand: "h4 v1 ne1 nw2 se1 sw1 z1 nu1 eu1 su1 nd1 sd1", sols: ["WWSEESUUNUSSWWWU"],
    map: [
      ["....S", ".#...", ".#...", ".....", "....#"],
      [".....", ".....", "....#", "..#..", "....."],
      [".....", "..#..", ".#...", ".....", "....#"],
      [".....", "....#", "...#.", ".....", "....."],
      [".....", ".....", ".....", ".....", ".T..."],
    ] },
];
