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
  { key: "a", name: "Meshing", rule: "Mesh the gears from the mainspring to the dial and lay every one: meshed gears turn opposite ways, and the arrows say which." },
  { key: "b", name: "Duos", rule: "A duo is two small gears meshed in one square: the turn leaves it flipped, and it meshes only on its two ports." },
  { key: "c", name: "Trios", rule: "A trio is three small gears: it passes the turn on as a single does, but meshes only on its two ports." },
  { key: "d", name: "Loads", rule: "A load takes a single gear that must turn the way shown: count the gears before it, and which squares flip the turn." },
  { key: "e", name: "Jams", rule: "Gears side by side must turn opposite ways, or they jam. A duo flips the turn, so beside one the train may not touch itself." },
  { key: "f", name: "Fixed gears", rule: "A dark pinned gear is part of the train: run through it." },
  { key: "g", name: "The movement", rule: "Everything at once: duos, trios, fixed gears, loads and jams on one plate." },
  { key: "h", name: "Complications", rule: "A bigger plate, and every piece in play." },
];

export const LEVELS = [
  // Meshing
  { id: "wa1", name: "Barrel", chapter: "a", out: "S", inlet: "S", spin: "cw", hand: "g3", sols: ["SWN"],
    map: ["..S.", ".T..", "....", "...."] },
  { id: "wa2", name: "Arbor", chapter: "a", out: "E", inlet: "N", spin: "ccw", hand: "g4", sols: ["ESSS","SESS","SSES"],
    map: ["S...", "....", "....", "..T."] },
  { id: "wa3", name: "Pinion", chapter: "a", out: "E", inlet: "S", spin: "cw", hand: "g5", sols: ["NESEN","ESENN","SENEN","SEENN"],
    map: [".....", "...T.", "S....", ".....", "....."] },
  { id: "wa4", name: "Wheel", chapter: "a", out: "S", inlet: "E", spin: "ccw", hand: "g6", sols: ["ESSWWW","ESWSWW","ESWWSW","SESWWW","SSSWNW","WSESWW","WWSESW"],
    map: ["...S.", ".....", ".....", ".T...", "....."] },
  { id: "wa5", name: "Cannon", chapter: "a", out: "S", inlet: "W", spin: "ccw", hand: "g8", sols: ["EESSWWNE","WNWSSEEE","WSSSENNE","WSWSEENE","WWSESENE","WWSSENEE","WWSSEENE"],
    map: ["..S..", ".....", "...T.", ".....", "....."] },
  // Duos
  { id: "wb1", name: "Pair", chapter: "b", out: "W", inlet: "N", spin: "cw", hand: "g3 dv1", sols: ["NWSs"],
    map: [".....", "...S.", ".T...", "....."] },
  { id: "wb2", name: "Couple", chapter: "b", out: "W", inlet: "S", spin: "ccw", hand: "g4 dnw1", sols: ["NWNEn","WNNEn","WNEnN"],
    map: ["...T.", ".....", ".....", "....S"] },
  { id: "wb3", name: "Ratio", chapter: "b", out: "N", inlet: "N", spin: "ccw", hand: "g4 dh1 dse1", sols: ["EEeNeS","EeENeS","eEeNES","eeENES"],
    map: [".....", "..#..", "....T", "S....", "....."] },
  { id: "wb4", name: "Step-down", chapter: "b", out: "N", inlet: "N", spin: "cw", hand: "g5 dv1 dsw1", sols: ["NWWSsEs","NwWSsES","nWWSSEs","nwWSSES"],
    map: [".....", ".....", "..#..", "...S.", "..T.."] },
  { id: "wb5", name: "Reverser", chapter: "b", out: "S", inlet: "S", spin: "ccw", hand: "g6 dne1 dnw2", sols: ["wNWWWSSen","wWNWWSSen","wWnWWSSEn","wnWWWSSEn"],
    map: ["....S", ".T...", "...#.", "..#..", "..#.."] },
  // Trios
  { id: "wc1", name: "Train", chapter: "c", out: "W", inlet: "W", spin: "ccw", hand: "g3 tse1", sols: ["WvEE"],
    map: ["..S..", "..T..", ".....", "....."] },
  { id: "wc2", name: "Chain", chapter: "c", out: "E", inlet: "E", spin: "cw", hand: "g4 tnw1", sols: ["NE^WW","E^NWW","E^WNW","^ENWW"],
    map: [".T...", ".....", ".S...", "....."] },
  { id: "wc3", name: "Compound", chapter: "c", out: "W", inlet: "S", spin: "ccw", hand: "g4 th1 tse1", sols: ["<NNN>N","<NN>NN","<N>NNN"],
    map: ["...T.", ".....", ".....", ".....", "....S"] },
  { id: "wc4", name: "Idler", chapter: "c", out: "W", inlet: "W", spin: "ccw", hand: "g4 dne1 tse1 tnw1", sols: ["NNESe^>","nNESE^>","nN>SE^E"],
    map: ["....T", "#....", "..S#.", ".....", "....."] },
  { id: "wc5", name: "Triple", chapter: "c", out: "N", inlet: "E", spin: "ccw", hand: "g6 dne1 tse1 tnw1", sols: ["WnN>EE^WW",">EE^NWWnW",">EE^NWnWW"],
    map: [".T...", ".....", ".#.#.", ".....", ".S..."] },
  // Loads
  { id: "wd1", name: "Hours", chapter: "d", out: "S", inlet: "S", spin: "cw", hand: "g5 dv1", sols: ["sESENN"],
    map: ["S....", "..T..", ".↻...", "#....", "....."] },
  { id: "wd2", name: "Minutes", chapter: "d", out: "N", inlet: "N", spin: "ccw", hand: "g5 dv1 tv1", sols: ["^WNWWSs"],
    map: [".....", "....#", "..#↺.", ".T...", "....S"] },
  { id: "wd3", name: "Seconds", chapter: "d", out: "N", inlet: "N", spin: "cw", hand: "g7 dse1", sols: ["NeNNEESS"],
    map: [".....", ".#↺#.", "....T", ".↺...", ".S...", "....."] },
  { id: "wd4", name: "Date", chapter: "d", out: "W", inlet: "W", spin: "cw", hand: "g6 dh2 tse1", sols: ["wvWNNEeEE"],
    map: [".....", ".....", "..##.", "↺.↻.T", "...S.", "..#.."] },
  { id: "wd5", name: "Moon", chapter: "d", out: "E", inlet: "S", spin: "ccw", hand: "g7 dh2 tne1", sols: ["eeNWWWW^EN"],
    map: [".....", ".....", ".T...", "..#..", ".↺↻..", ".S..↺"] },
  // Jams
  { id: "we1", name: "Clack", chapter: "e", out: "N", inlet: "N", spin: "ccw", hand: "g6 dse1 dnw1", sols: ["WNNenWWS"],
    map: ["......", "...T..", ".....#", "...#..", ".....S"] },
  { id: "we2", name: "Seize", chapter: "e", out: "S", inlet: "W", spin: "cw", hand: "g7 dh1 dne1", sols: ["SWNWwnNNE"],
    map: [".T....", "......", ".##S#.", "......", ".#...."] },
  { id: "we3", name: "Bind", chapter: "e", out: "W", inlet: "W", spin: "ccw", hand: "g7 dh1 dse1 tv1", sols: ["sWwNWSWSvE"],
    map: ["#..#.S", "↻.....", ".#.##.", ".T#...", "......"] },
  { id: "we4", name: "Lock", chapter: "e", out: "S", inlet: "W", spin: "ccw", hand: "g8 dse2 dsw1", sols: ["WsSEEEEsWsE"],
    map: [".S....", "....#.", ".#.#..", "...↻..", "#.....", "..#.T."] },
  { id: "we5", name: "Stall", chapter: "e", out: "E", inlet: "S", spin: "cw", hand: "g8 dne1 dse1 dnw1 tnw1", sols: ["nWWSWNNNWs<n"],
    map: ["T.....", "...###", "#..↺..", ".#..S.", "....#.", "......"] },
  // Fixed gears
  { id: "wf1", name: "Stud", chapter: "f", out: "N", inlet: "N", spin: "cw", hand: "g5 dse1", sols: ["NWNNWWWs"],
    map: ["...o..", ".T.#..", "....o.", "....#.", ".....S", "......"] },
  { id: "wf2", name: "Index", chapter: "f", out: "W", inlet: "W", spin: "ccw", hand: "g6 th1", sols: ["sESWSSSE>"],
    map: ["┌S....", "......", "......", "o#....", "......", "..T..."] },
  { id: "wf3", name: "Regulator", chapter: "f", out: "W", inlet: "E", spin: "cw", hand: "g5 dne1 th1", sols: ["<nEENNNENW"],
    map: ["..T↺..", "..oo..", "#.....", ".#.#..", ".o....", "..S..."] },
  { id: "wf4", name: "Hairspring", chapter: "f", out: "N", inlet: "E", spin: "cw", hand: "g6 dv1 dse1", sols: ["nESENe>SSWW"],
    map: ["o..═..", ".↺o#..", "S.T...", "......", "......", "......"] },
  { id: "wf5", name: "Balance", chapter: "f", out: "E", inlet: "N", spin: "ccw", hand: "g8 dse1", sols: ["E^NWwSWWWsSS"],
    map: ["..#.─.", "..↺...", "o#.S.╝", "......", "T.....", "......"] },
  // The movement
  { id: "wg1", name: "Calibre", chapter: "g", out: "E", inlet: "S", spin: "ccw", hand: "g6 dne1 dse1 tsw1", sols: ["vSWWsWNWnN"],
    map: [".T..S.", ".↻..#.", "..↺.o.", ".#....", "......", "......", "......"] },
  { id: "wg2", name: "Keyless", chapter: "g", out: "E", inlet: "E", spin: "cw", hand: "g7 dsw1 dnw1", sols: ["N<WSSEEswWW"],
    map: ["......", "......", "......", "...↻.╗", "..#.S.", "......", "..To↻."] },
  { id: "wg3", name: "Winding", chapter: "g", out: "E", inlet: "N", spin: "ccw", hand: "g9 dsw1 tse1", sols: ["SWsWNNWvWNwS"],
    map: ["↻...S.", "T...┌↻", ".##...", "......", "......", "......", "......"] },
  { id: "wg4", name: "Setting", chapter: "g", out: "N", inlet: "E", spin: "ccw", hand: "g9 dv1 dse1", sols: ["evSeSsENESESW"],
    map: [".╗....", "S..#..", ".└↺...", "....↺#", "......", "..##T.", "......"] },
  { id: "wg5", name: "Motion", chapter: "g", out: "W", inlet: "S", spin: "cw", hand: "g8 dne1 dsw1 dnw1 th1 tne1", sols: ["WS>sSSw<nENWNN"],
    map: ["......", "..#...", "T.↺S..", "...#..", "..o#..", ".↻....", "...#.."] },
  // Complications
  { id: "wh1", name: "Date", chapter: "h", out: "W", inlet: "E", spin: "cw", hand: "g7 dse1 dnw1 tne1 tsw1", sols: ["sWNNeNNW^En<"],
    map: ["T......", "..#....", ".↻.....", "#......", ".......", ".┌S....", "↻......"] },
  { id: "wh2", name: "Chronograph", chapter: "h", out: "W", inlet: "N", spin: "ccw", hand: "g7 dv1 dsw1 dnw1 tne1", sols: ["SvES>SSEnnEEs"],
    map: [".......", ".S.....", "║.#....", "o..#.#.", "#......", ".#↺.#T.", "..↻...."] },
  { id: "wh3", name: "Repeater", chapter: "h", out: "N", inlet: "S", spin: "cw", hand: "g8 dne1 dse1 dnw1 tv1 tne1", sols: ["^WnWWWSWsWS>En"],
    map: [".......", ".......", "...#.#.", ".#o.↻..", "#...#..", ".↻T..#.", "......S"] },
  { id: "wh4", name: "Tourbillon", chapter: "h", out: "W", inlet: "N", spin: "ccw", hand: "g10 dsw1 dnw1 tv1", sols: ["N^EnEsEENEn^ESS"],
    map: [".......", ".......", "...#.║↻", "#..#↻┘T", ".......", ".#.#...", ".S....."] },
  { id: "wh5", name: "Grande", chapter: "h", out: "N", inlet: "W", spin: "cw", hand: "g11 dse2 dnw1 tne1", sols: ["eSSSwSESEN^eSS>E"],
    map: ["..#....", "S.#....", "#↺#....", ".......", "..║.#..", "#.↻..T.", "......."] },
];
