// PARKED (4 November 2026, Korbi: "Let's park the 3d mode for now, but trust it's coming later and in detail."): the 3D map is kept
// whole but not offered: pipes.js's MAP_ON turns it back on. It plays the OLD model (pipes-puzzle*.js: gears whose teeth show only on
// the sides they mesh, arbors, reductions), which the flat board has left for whole gears (pipes-train*.js); before it returns it needs
// redoing in that scheme (a stack of floors of single, duo and trio squares). Its saved keys pipes:map and pipes:mapstars are left alone.
// Gears, the 3D map: the levels (November 2026). A level is its map, a list of floors from the bottom, each a list of rows
// (. open ground, # pillar, S the mainspring, T the end load, ─ │ └ ┘ ┌ ┐ ┼ and the letters of pipes-puzzle.js's GLYPH fixed gears, 1-9
// numbered loads, a-i counter-clockwise ones), the side the mainspring faces by (out: N E S W U D) and the side of the terminal its inlet is on, the hand of
// pieces to lay (a count each), and the routes that solve it: the side the power leaves each square by, from the mainspring on (lower case for a reduction).
// Made by pipes-map-pick.mjs from pipes-puzzle-make.js and checked by tests/pipes-map.mjs, which solves every level again and
// wants those routes and no others. A level's id is its identity (stars are kept by it): new levels go at the end of a chapter.

export const CHAPTERS = [
  { key: "a", name: "Stairs", rule: "A shaft joins gears between floors without meshing: both turn the same way." },
  { key: "b", name: "Shafts", rule: "Bigger: four floors of four by four, and rock in the way." },
  { key: "c", name: "Crossovers", rule: "Two gears in one square, on separate levels." },
  { key: "d", name: "Fixed gears and loads", rule: "Pinned gears and loads on every floor: only a side mesh reverses the turn." },
  { key: "e", name: "The stack", rule: "Five floors of five by five." },
];

export const LEVELS = [
  // Stairs
  { id: "ma1", name: "Landing", chapter: "a", out: "S", inlet: "E", spin: "cw", hand: "h1 v1 nu1 wd1", sols: ["SUWW"],
    map: [
      ["...", "...", "..."],
      ["..S", "...", "..."],
      ["...", "...", "T.."],
    ] },
  { id: "ma2", name: "Flight", chapter: "a", out: "S", inlet: "D", spin: "cw", hand: "h1 v1 nw1 z1 eu1", sols: ["SWWUU"],
    map: [
      ["..S", "...", "..."],
      ["...", "...", "..."],
      ["...", "...", "T.."],
    ] },
  { id: "ma3", name: "Mezzanine", chapter: "a", out: "U", inlet: "U", spin: "cw", hand: "ne1 eu1 wu1 ed1 sd1 wd2", sols: ["EUWNDED"],
    map: [
      [".T.", "S..", "..."],
      ["...", "...", "..."],
      ["...", "...", "..."],
    ] },
  { id: "ma4", name: "Atrium", chapter: "a", out: "N", inlet: "D", spin: "cw", hand: "v2 se1 sw1 z1 eu1 wu1 nd1", sols: ["NWSSDDEU"],
    map: [
      ["...", "...", "..#"],
      ["...", "...", ".T."],
      ["...", "...", ".S."],
    ] },
  { id: "ma5", name: "Penthouse", chapter: "a", out: "N", inlet: "N", spin: "ccw", hand: "se1 sw2 nu1 eu1 su1 nd1 ed1 wd1", sols: ["WUNESUEDS"],
    map: [
      ["...", "...", "#S."],
      ["...", "...", ".#T"],
      ["...", "...", "..."],
    ] },
  // Shafts
  { id: "mb1", name: "Winze", chapter: "b", out: "E", inlet: "U", spin: "ccw", hand: "h1 v1 sw1 z3 nu1 nd1 sd1", sols: ["ESSUUUSDD"],
    map: [
      ["S...", "....", "....", "...."],
      ["....", "..#.", "....", "..T."],
      ["....", "....", "....", "...."],
      ["....", "....", "....", "...."],
    ] },
  { id: "mb2", name: "Raise", chapter: "b", out: "U", inlet: "N", spin: "cw", hand: "se1 sw1 z1 eu1 su1 wu1 nd3 sd1", sols: ["NDDSDWUNWS"],
    map: [
      ["....", "....", "....", "...."],
      ["....", "T...", "....", "...."],
      ["#...", "..S.", "....", "...."],
      ["....", "....", "....", "...."],
    ] },
  { id: "mb3", name: "Adit", chapter: "b", out: "W", inlet: "E", spin: "ccw", hand: "v1 nw1 z2 nu1 eu1 su1 wu1 nd1 ed1 sd2", sols: ["USWDSUUNNDDW"],
    map: [
      ["....", "T..S", "....", "...."],
      ["....", "....", "....", "..#."],
      ["....", "..#.", "....", "...."],
      ["....", "....", "..#.", "...."],
    ] },
  { id: "mb4", name: "Drift", chapter: "b", out: "D", inlet: "U", spin: "cw", hand: "h1 v1 nw1 sw1 z1 nu1 eu1 su1 wu1 ed3 wd1", sols: ["SUWDWWUENNWDD"],
    map: [
      ["....", "....", "....", "...."],
      ["..#.", "T...", "..##", "...."],
      ["....", "..#.", ".#..", "...."],
      ["..#.", "....", "...S", "...."],
    ] },
  { id: "mb5", name: "Stope", chapter: "b", out: "W", inlet: "E", spin: "ccw", hand: "h1 v2 ne1 nw1 se2 z1 nu1 su1 wu1 nd1 sd1 wd1", sols: ["SDNNEDDSSEEUSW"],
    map: [
      ["....", "..#.", "....", "..#."],
      ["....", "....", "#...", "..T."],
      ["....", "....", "....", "...."],
      ["#.#.", ".S..", ".#..", "#..."],
    ] },
  // Crossovers
  { id: "mc1", name: "Rocker", chapter: "c", out: "W", inlet: "S", spin: "ccw", hand: "h1 sw1 nu2 eu1 nd1 ed1 sd1 xn1", sols: ["WDNWUUSDNN"],
    map: [
      ["....", "....", "....", "...."],
      ["....", "..#.", "....", "...."],
      ["T...", "....", "...S", "...."],
      ["....", "....", "....", "...."],
    ] },
  { id: "mc2", name: "Lever", chapter: "c", out: "S", inlet: "E", spin: "cw", hand: "v1 ne1 nw1 sw1 nu1 su1 nd1 sd1 xn1", sols: ["ENNUUSDNNW"],
    map: [
      ["....", "....", "..S.", "...."],
      ["..T.", "....", "....", "...."],
      ["....", "....", "....", "...#"],
      ["....", "....", "....", "...."],
    ] },
  { id: "mc3", name: "Fusee", chapter: "c", out: "W", inlet: "E", spin: "cw", hand: "ne1 nw2 se1 sw1 x1 z1 eu1 wu1 ed1 sd1", sols: ["DDENNWSEEUSW"],
    map: [
      ["....", "....", "....", "...."],
      ["....", "....", ".#..", ".T.."],
      ["....", "....", "....", ".S.."],
      ["....", "....", "....", "...."],
    ] },
  { id: "mc4", name: "Click", chapter: "c", out: "U", inlet: "N", spin: "ccw", hand: "nw1 z1 eu2 su1 wu1 ed2 sd1 wd2 xe1", sols: ["EDDSWUUWDEEUS"],
    map: [
      ["....", "....", "....", "...."],
      ["....", "....", "....", "...."],
      ["..S.", "....", "....", "...."],
      ["....", "....", "...T", "...."],
    ] },
  // Fixed gears and loads
  { id: "md1", name: "Stud", chapter: "d", out: "S", inlet: "S", spin: "ccw", hand: "v1 ne1 z2 eu1 su1 wu1 nd2 sd1", sols: ["DDWUUNNDDSEN"],
    map: [
      [".T..", ".┘..", "....", "...."],
      ["....", "....", ".Z..", "...."],
      ["....", ".S..", "....", "...."],
      ["....", "....", "....", "...."],
    ] },
  { id: "md2", name: "Index", chapter: "d", out: "W", inlet: "D", spin: "cw", hand: "h1 se1 nu3 eu1 su1 wu1 nd1 ed1 sd2 wd1", sols: ["DNEEDSUSUSDWU"],
    map: [
      ["....", "....", "....", "...."],
      ["..1.", "....", "....", "...."],
      ["....", "....", "....", "...."],
      ["....", ".S..", "..2.", ".T.."],
    ] },
  { id: "md3", name: "Regulator", chapter: "d", out: "N", inlet: "D", spin: "ccw", hand: "nw1 se1 sw2 rh1 z3 nu2 eu1 ed1 sd1", sols: ["WwDDDNENWUSUU"],
    map: [
      ["....", "....", "2...", "...."],
      ["....", "c...", "1...", "...."],
      ["....", "....", "....", "...."],
      ["....", "T...", "....", "..S."],
    ] },
  // The stack
  { id: "me1", name: "Orrery", chapter: "e", out: "D", inlet: "S", spin: "cw", hand: "v1 ne1 nw1 se1 z4 nu1 su3 nd2 wd1", sols: ["SSWNUUUWSDDDNUN"],
    map: [
      [".....", ".....", ".....", ".....", "....."],
      [".....", ".....", "T.S..", ".....", ".#..."],
      [".....", ".....", ".....", ".....", "....."],
      ["..#..", "..#..", "#....", ".....", "....."],
      [".....", ".....", ".....", "#....", "....."],
    ] },
  { id: "me2", name: "Carillon", chapter: "e", out: "W", inlet: "N", spin: "ccw", hand: "h2 ne2 sw2 eu1 su1 wu1 ed2 wd1 xe1", sols: ["DDEUWWNWWDSEES"],
    map: [
      [".....", ".....", ".....", "..T..", "....."],
      [".....", "...#.", ".#...", ".....", "....."],
      [".....", ".#...", "....S", ".....", "....."],
      [".....", ".....", "...#.", ".....", "....."],
      [".....", ".....", ".....", ".....", "....."],
    ] },
  { id: "me3", name: "Cathedral", chapter: "e", out: "N", inlet: "S", spin: "ccw", hand: "ne1 se1 sw3 rh1 z1 nu2 eu2 su1 nd2 ed1 wd2", sols: ["WwUUWUESUWSESDSDN"],
    map: [
      [".....", "...S.", ".....", ".....", "....."],
      ["#1...", ".....", ".....", ".....", "....."],
      [".....", ".##..", ".....", ".T...", "....."],
      [".....", ".....", ".....", "#b#..", "....."],
      [".....", ".....", "..#..", ".....", "....."],
    ] },
];
