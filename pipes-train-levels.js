// Gears: the levels (4 November 2026). A level is its map (. open ground, # pillar, S the mainspring, T the dial at the end of
// the train, o and the box characters a gear pinned to the plate, ↻ a load that must turn clockwise and ↺ one that must turn
// counter-clockwise), the side the mainspring's teeth face (out) and the side the dial's teeth face (inlet), the way the dial must
// turn (spin), the hand of pieces to lay (g a single gear; dh dv dne dnw dse dsw duos; th tv tne tnw tse tsw trios; a count each),
// and the answers: the side the power leaves each square by, from the mainspring on, written N E S W for a single or fixed
// single, n e s w for a duo, ^ > v < for a trio. Made by pipes-train-pick.mjs from pipes-train-make.js, which adds pillars
// where the level needs them to have its few answers (and keeps loads and fixed gears only where they are needed too), and
// checked by tests/pipes-train.mjs, which solves every level again and wants those answers and no others. A level's id is its
// identity (stars are kept by it): new levels go at the end of a chapter.

export const CHAPTERS = [
  { key: "a", name: "Meshing", rule: "Mesh gears from the mainspring to the dial: each arrow shows its turn." },
  { key: "b", name: "Duos", rule: "A duo is two small gears in one square: it flips the turn." },
  { key: "c", name: "Trios", rule: "A trio is three small gears: it keeps the turn, and meshes on two sides." },
  { key: "d", name: "Loads", rule: "A load takes a single gear that must turn the way shown." },
  { key: "e", name: "Jams", rule: "Gears side by side must turn opposite ways, or they jam." },
  { key: "f", name: "Fixed gears", rule: "A dark pinned gear is part of the train." },
  { key: "g", name: "The movement", rule: "Everything at once: duos, trios, fixed gears, loads, jams." },
  { key: "h", name: "Complications", rule: "A bigger plate, and every piece in play." },
];

export const LEVELS = [
  // Meshing
  { id: "wa1", name: "Barrel", chapter: "a", disc: true, out: "E", inlet: "N", spin: "cw", hand: "g3", sols: ["SWS"],
    map: ["#..#", ".S..", "....", "#T.#"] },
  { id: "wa2", name: "Arbor", chapter: "a", disc: true, out: "S", inlet: "W", spin: "ccw", hand: "g4", sols: ["SENE"],
    map: ["#S.#", "...T", "....", "#..#"] },
  { id: "wa3", name: "Pinion", chapter: "a", disc: true, out: "W", inlet: "N", spin: "cw", hand: "g5", sols: ["NWSSS","WWSES"],
    map: ["#..#", "...S", "....", "#T.#"] },
  { id: "wa4", name: "Wheel", chapter: "a", disc: true, out: "S", inlet: "W", spin: "ccw", hand: "g6", sols: ["SSENNE","WSEENE"],
    map: ["#S.#", "...T", "....", "#..#"] },
  { id: "wa5", name: "Cannon", chapter: "a", disc: true, out: "E", inlet: "S", spin: "ccw", hand: "g8", sols: ["NNNESSEN","NNESSENN","NESSENNN","NWNEESEN","SEENWNEN"],
    map: ["#...#", "...T.", "....#", "S....", "#...#"] },
  // Duos
  { id: "wb1", name: "Pair", chapter: "b", disc: true, out: "W", inlet: "N", spin: "cw", hand: "g3 dv1", sols: ["NWSs"],
    map: ["#..#", "...S", ".T..", "#..#"] },
  { id: "wb2", name: "Couple", chapter: "b", disc: true, out: "N", inlet: "N", spin: "ccw", hand: "g4 dsw1", sols: ["wNWSS"],
    map: ["#..#", "....", ".T.S", "#..#"] },
  { id: "wb3", name: "Ratio", chapter: "b", disc: true, out: "N", inlet: "N", spin: "ccw", hand: "g4 dse1 dsw1", sols: ["WNENes","wNENeS","wNeNES"],
    map: ["#..#", "..T.", "....", "#S.#"] },
  { id: "wb4", name: "Step-down", chapter: "b", disc: true, out: "S", inlet: "N", spin: "cw", hand: "g5 dv1 dnw1", sols: ["SSwNnWS","SswNNWS"],
    map: ["#.S#", "....", "T...", "#..#"] },
  { id: "wb5", name: "Reverser", chapter: "b", disc: true, out: "E", inlet: "W", spin: "ccw", hand: "g6 dse1 dnw2", sols: ["nNWSwWsSE","nNWswWSSE"],
    map: ["##..#", ".....", ".#S..", ".T...", "#...#"] },
  // Trios
  { id: "wc1", name: "Train", chapter: "c", disc: true, out: "E", inlet: "N", spin: "ccw", hand: "g3 tsw1", sols: ["NEvS"],
    map: ["#..#", "S...", "..T.", "#..#"] },
  { id: "wc2", name: "Chain", chapter: "c", disc: true, out: "W", inlet: "E", spin: "cw", hand: "g4 tnw1", sols: ["NWSS<","SS<NW"],
    map: ["#..#", "...S", "T...", "#..#"] },
  { id: "wc3", name: "Compound", chapter: "c", disc: true, out: "N", inlet: "W", spin: "ccw", hand: "g4 tne1 tsw1", sols: ["<W^EEE"],
    map: ["#.##", "...T", "....", "#.S#"] },
  { id: "wc4", name: "Idler", chapter: "c", disc: true, out: "S", inlet: "E", spin: "ccw", hand: "g4 dnw1 tne1 tsw1", sols: ["EEEnW^<","EEEn<^W","Ev>nNNW",">vEnNNW"],
    map: ["#T.#", "S...", "....", "#..#"] },
  { id: "wc5", name: "Triple", chapter: "c", disc: true, out: "S", inlet: "E", spin: "ccw", hand: "g6 dv1 th1 tse1", sols: ["ENE>NnWvW","EN>>NnWSW","E>N>NnWSW"],
    map: ["#...#", ".....", "..T..", ".S...", "#...#"] },
  // Loads
  { id: "wd1", name: "Hours", chapter: "d", disc: true, out: "S", inlet: "E", spin: "cw", hand: "g5 dnw1", sols: ["wWNENW"],
    map: ["#T.#", "..↻S", "....", "#..#"] },
  { id: "wd2", name: "Minutes", chapter: "d", disc: true, out: "W", inlet: "W", spin: "ccw", hand: "g5 dne1 tnw1", sols: ["WNE^ESe"],
    map: ["#..#", "↺..T", "..S.", "#..#"] },
  { id: "wd3", name: "Seconds", chapter: "d", disc: true, out: "W", inlet: "S", spin: "cw", hand: "g7 dh1", sols: ["SWwWNNEN"],
    map: ["#T..#", ".....", ".#.↺S", ".↺...", "#...#"] },
  { id: "wd4", name: "Date", chapter: "d", disc: true, out: "N", inlet: "E", spin: "cw", hand: "g6 dh1 dnw1 tnw1", sols: ["EnESEeS<W"],
    map: ["#↻.##", "....↺", "S.T..", ".....", "#...#"] },
  { id: "wd5", name: "Moon", chapter: "d", disc: true, out: "E", inlet: "E", spin: "ccw", hand: "g7 dv1 dsw1 tne1", sols: ["SsWNW^NENw"],
    map: ["#T..#", ".↺...", "..S..", "..↻..", "##↺.#"] },
  // Jams
  { id: "we1", name: "Clack", chapter: "e", disc: true, out: "E", inlet: "E", spin: "ccw", hand: "g6 dh1 dne1", sols: ["SWSSWwnW"],
    map: ["#...#", "...S.", "..#..", "T...#", "#...#"] },
  { id: "we2", name: "Seize", chapter: "e", disc: true, out: "E", inlet: "W", spin: "cw", hand: "g7 dh1 dsw1", sols: ["NENWNwwSE"],
    map: ["#...#", "..T..", ".#...", "#.S.#", "#...#"] },
  { id: "we3", name: "Bind", chapter: "e", disc: true, out: "W", inlet: "S", spin: "ccw", hand: "g7 dne1 dsw1 tsw1", sols: ["nENEvSEsEN"],
    map: ["#...#", ".↻.#.", ".S..T", ".#...", "#...#"] },
  { id: "we4", name: "Lock", chapter: "e", disc: true, out: "S", inlet: "W", spin: "ccw", hand: "g8 dv1 dne1 dnw1", sols: ["eESswSWNWNE"],
    map: ["#.S.#", "....↻", "#.T#.", ".....", "##..#"] },
  { id: "we5", name: "Stall", chapter: "e", disc: true, out: "E", inlet: "W", spin: "cw", hand: "g8 dv1 dsw1 dnw1 tsw1", sols: ["NEvEssWSwWNE"],
    map: ["#...#", ".S...", "...#.", "..T↻.", "#...#"] },
  // Fixed gears
  { id: "wf1", name: "Stud", chapter: "f", disc: true, out: "W", inlet: "W", spin: "cw", hand: "g6", sols: ["NENNESSe"],
    map: ["#.o.#", ".#...", "...└T", "..S..", "#...#"] },
  { id: "wf2", name: "Index", chapter: "f", disc: true, out: "N", inlet: "S", spin: "ccw", hand: "g6 tv1", sols: ["^wSWWSSEN"],
    map: ["#..┐#", "..o..", ".T.S.", "..#..", "#...#"] },
  { id: "wf3", name: "Regulator", chapter: "f", disc: true, out: "E", inlet: "S", spin: "cw", hand: "g6 dsw1", sols: ["sWWSWNWNE^"],
    map: ["#...#", ".T...", ".╝.S.", "..o↻.", "#o..#"] },
  { id: "wf4", name: "Hairspring", chapter: "f", disc: true, out: "N", inlet: "S", spin: "cw", hand: "g6 dv1 dnw1", sols: ["nNNESSvEEnN"],
    map: ["#...#", "....T", "#.║.↺", "..oo.", "#S#.#"] },
  { id: "wf5", name: "Balance", chapter: "f", disc: true, out: "N", inlet: "W", spin: "ccw", hand: "g7 dv1 dsw1", sols: ["wSsEENNN>SSE"],
    map: ["#.╔.#", "..↻o.", ".So.T", ".....", "#...#"] },
  // The movement
  { id: "wg1", name: "Calibre", chapter: "g", disc: true, out: "S", inlet: "S", spin: "ccw", hand: "g7 dnw2", sols: ["SSwSEENEn^"],
    map: ["#.S.#", "..↺.T", ".#..║", ".....", "#..↻#"] },
  { id: "wg2", name: "Keyless", chapter: "g", disc: true, out: "E", inlet: "N", spin: "cw", hand: "g7 dh1 dsw1", sols: ["^WwNENEEsSS"],
    map: ["#...#", "o↺...", "..↻..", ".S╝T.", "#...#"] },
  { id: "wg3", name: "Winding", chapter: "g", disc: true, out: "W", inlet: "W", spin: "ccw", hand: "g8 dne1 dse1 tne1", sols: ["NeEEENWnWWS>"],
    map: ["#o.↺#", "..T..", ".....", "↺S...", "#...#"] },
  { id: "wg4", name: "Setting", chapter: "g", disc: true, out: "E", inlet: "N", spin: "ccw", hand: "g8 dv1 dsw1 tv1", sols: ["ssESSWNWN^WSs"],
    map: ["#S..#", ".o.#.", "│....", "T.↻↺#", "##..#"] },
  { id: "wg5", name: "Motion", chapter: "g", disc: true, out: "N", inlet: "N", spin: "cw", hand: "g8 dv1 dsw1 dnw1 th1 tne1", sols: ["EnE>S>SSWNwWSs"],
    map: ["#...#", "..#.↻", "S.o..", "..#↺.", "#T..#"] },
  // Complications
  { id: "wh1", name: "Date", chapter: "h", disc: true, out: "W", inlet: "W", spin: "cw", hand: "g6 dne1 dse1 dsw1 tv1 tnw1", sols: ["N^E^EEsSWseE"],
    map: ["#...#", "..#↺.", ".#.o.", "↺S..T", "#...#"] },
  { id: "wh2", name: "Chronograph", chapter: "h", disc: true, out: "N", inlet: "S", spin: "ccw", hand: "g8 dnw1 tse2", sols: [">eN>SsSSWWNEn"],
    map: ["#...#", ".─.│.", "S.T..", ".↻...", "#..↺#"] },
  { id: "wh3", name: "Repeater", chapter: "h", disc: true, out: "S", inlet: "N", spin: "cw", hand: "g9 dne1 dnw1 th1 tsw1", sols: ["EsENNWNW<SwSev"],
    map: ["#..↺#", "..S..", "...┐.", ".T..↺", "#...#"] },
  { id: "wh4", name: "Tourbillon", chapter: "h", disc: true, out: "S", inlet: "N", spin: "ccw", hand: "g9 dv1 dne1 dnw1 tnw1", sols: ["EE^<NWnWSwSsSES"],
    map: ["##..##", "#o...#", "...S↺╗", ".↻#...", "#..#.#", "##T.##"] },
  { id: "wh5", name: "Grande", chapter: "h", disc: true, out: "E", inlet: "S", spin: "cw", hand: "g10 dse1 dsw1 dnw1 tne2", sols: ["SWW^wsWS>SEENEEn"],
    map: ["##..##", "#..S.#", "....↻T", ".↻#...", "#o..##", "##.###"] },
];
