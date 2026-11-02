// Harbour's levels, the Hanseatic League's metal trade. A map is rows of hexes, pointy side up, every odd row set half
// a hex to the right: # land, . water, and a letter for each quay the level spells out (the code calls a quay a jetty).
// A load quay has a metal, the parcel it lifts in an hour and, if it's a smelter's, the stockpile behind it (the code's
// tank); a discharge quay the parcel it takes in an hour and the standard it holds it to (its spec). A
// level's fleet is the ships it offers, so many of each class (the classes, what each carries and costs, are the
// engine's, the same in every level). A ship can't turn on the spot, so a dead end means backing out. A level may set
// a delivery window (deadline: "sixteen ingots within 80 hours"), and a buyer its own target. The par on each
// measure is the best found by searching every plan of up to three ships on the level's routes, from every starting
// point; each level carries the plans that reach it, so the page can show them (tap a par in the menu) and
// tests/harbour.mjs runs the same plans and holds the par there.

/** A plan's program written compactly: one character an hour (A ahead, P port, S starboard, B astern, L load,
 *  D discharge, . wait), a loop in brackets with its count first: "(2S)" plays S twice. */
export function program(text) {
  const items = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "(") { items.push(text[i]); continue; }
    const close = text.indexOf(")", i), [, n, body] = text.slice(i + 1, close).match(/^(\d+)(.+)$/);
    items.push({ n: +n, body: [...body] });
    i = close;
  }
  return items;
}

// The campaign's chapters, region by region: each teaches four or five ideas, the hardest timing last.
export const CHAPTERS = [
  { id: "baltic", name: "The Baltic", note: "learning to move" },
  { id: "nwe", name: "Bruges and London", note: "learning to trade and alloy" },
  { id: "world", name: "The League", note: "joining your regions" },
  { id: "straits", name: "The Sound", note: "mastering timing" },
];

export const LEVELS = [
  {
    id: "first-cargo", name: "First cargo",
    chapter: "baltic", teaches: "programs and loops",
    brief: "Load copper at the smelter's quay (L), discharge at the founder's (D), round the island. Sixteen ingots: four Schnigge loads.",
    map: [
      "######",
      "#....#",
      "#L###D",
      "#....#",
    ],
    products: { copper: { name: "Copper", price: 0 } },
    jetties: { L: { kind: "load", product: "copper", parcel: 4 }, D: { kind: "discharge", parcel: 4 } },
    fleet: { coaster: 4 }, target: 16, maxCycles: 400,
    par: { cost: 20, hours: 13, water: 10, instructions: 8 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [{ x: 1, y: 2, h: 2, type: "coaster", prog: program("L(2S)(2A)SD(2S)(2A)S") }] },
      { par: ["hours"], ships: [
        { x: 1, y: 2, h: 2, type: "coaster", prog: program("L(2S)(2A)SD(2S)(2A)S") },
        { x: 5, y: 2, h: 5, type: "coaster", prog: program("D(2S)(2A)SL(2S)(2A)S") },
        { x: 4, y: 3, h: 4, type: "coaster", prog: program("S(2A)SL(2S)(2A)SDS") },
        { x: 2, y: 3, h: 3, type: "coaster", prog: program("ASL(2S)(2A)SD(2S)A") },
      ] },
    ],
  },
  {
    id: "up-the-creek", name: "Up the creek",
    chapter: "baltic", teaches: "astern",
    brief: "The ironworks (L) is up a creek too narrow to turn in: Astern backs a ship out, keeping its heading. The smithy (D) is down the shore. Sixteen ingots.",
    map: [
      "#########",
      "###....##",
      "###.###.#",
      "L.....D##",
      "#########",
    ],
    products: { iron: { name: "Iron", price: 0 } },
    jetties: {
      L: { kind: "load", product: "iron", parcel: 2 },
      D: { kind: "discharge", parcel: 2 },
    },
    fleet: { coaster: 3 }, target: 16, maxCycles: 400,
    par: { cost: 20, hours: 37, water: 7, instructions: 4 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [
        { x: 0, y: 3, h: 0, type: "coaster", prog: program("(2L)(6A)(2D)(6B)") },
      ] },
      { par: ["hours"], ships: [
        { x: 0, y: 3, h: 3, type: "coaster", prog: program("(2L)(6B)(2D)(3A)SBP(2A)") },
        { x: 6, y: 3, h: 3, type: "coaster", prog: program("D(3A)SBP(2A)(2L)(6B)D") },
      ] },
    ],
  },
  {
    id: "rundown", name: "Casting",                        // it was Rundown, the refinery's tank filling
    chapter: "baltic", teaches: "a stockpile's rhythm: two ships taking turns",
    rev: 3,              // a forty-hour window since one ship could do it all: plans and bests from before don't carry over
    brief: "The smelter (L) casts an ingot an hour into a yard that holds ten; both quays work two an hour. Twenty-four ingots to the founder (D) in forty hours.",
    map: [
      "#####",
      "#.L.#",
      "#.##.",
      "#.D.#",
    ],
    products: { copper: { name: "Copper", price: 0 } },
    jetties: { L: { kind: "load", product: "copper", parcel: 2, tank: { start: 0, rate: 1, cap: 10 } }, D: { kind: "discharge", parcel: 2 } },
    fleet: { coaster: 3, handy: 1 }, target: 24, deadline: 40, maxCycles: 400,
    // one ship's best is 49 hours; two Schniggen on one loop, half a turn apart, take turns at the stockpile: one lifts while
    // the other delivers (39 hours, the cheapest of 174 two-ship fleets that make it); three Schniggen are quickest
    par: { cost: 40, hours: 31, water: 8, instructions: 13 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [
        { x: 2, y: 3, h: 3, type: "coaster", prog: program("A(3S)(2L)A(3S)(2D)") },
        { x: 3, y: 3, h: 4, type: "coaster", prog: program("S(2D)A(3S)(2L)A(2S)") },
      ] },
      { par: ["hours"], ships: [
        { x: 2, y: 3, h: 3, type: "coaster", prog: program("A(3S)(2L)A(3S)(2D)") },
        { x: 4, y: 2, h: 5, type: "coaster", prog: program("(2S)(2D)A(3S)(2L)AS") },
        { x: 2, y: 1, h: 0, type: "coaster", prog: program("LA(3S)(2D)A(3S)L") },
      ] },
    ],
  },
  {
    id: "first-blend", name: "Bell metal",                   // it was First blend: gasoil with at least 20% FAME
    chapter: "nwe", teaches: "alloying to a standard",
    rev: 4,              // tin at 5 marks (the Cog's exact alloy cheapest again): plans and bests from before don't carry over
    brief: "Alloy in the hold. C: copper, two a lift at 1 mark. T: tin, one at 5. The bell-founder (D) takes two an hour, at least 20% tin. Twenty ingots.",
    map: [
      "#######",
      "#.C.T.#",
      "#.####.",
      "#...D.#",
    ],
    products: { copper: { name: "Copper", price: 1 }, tin: { name: "Tin", price: 5 } },
    jetties: {
      C: { kind: "load", product: "copper", parcel: 2 },
      T: { kind: "load", product: "tin", parcel: 1 },
      D: { kind: "discharge", parcel: 2, spec: { tin: [0.2, 1] } },
    },
    fleet: { coaster: 2, handy: 1 }, target: 20, maxCycles: 400,
    par: { cost: 66, hours: 30, water: 12, instructions: 7 },
    plans: [
      { par: ["hours", "water"], ships: [
        { x: 2, y: 1, h: 0, type: "handy", prog: program("(2L)(2A)LA(3S)(3D)(3A)(3S)") },
        { x: 4, y: 1, h: 0, type: "coaster", prog: program("(2L)A(3S)(2D)(3A)(3S).L(2A)") },
        { x: 5, y: 1, h: 0, type: "coaster", prog: program("(3S)(2D)(3A)(3S).L(2A)(2L)A") },
      ] },
      { par: ["cost", "water"], ships: [
        { x: 2, y: 1, h: 0, type: "handy", prog: program("(4L)(2A)(2L)A(3S)(5D)(3A)(3S)") },
      ] },
      { par: ["water", "instructions"], ships: [
        { x: 4, y: 1, h: 0, type: "handy", prog: program("(10L)A(3S)(5D)(3A)(3S)(2A)") },
      ] },
    ],
  },
  {
    id: "two-refineries", name: "Two smelters",
    chapter: "nwe", teaches: "ship sizes and a delivery window",
    brief: "The near smelter (N) is closing, with 12 ingots left; the far one (F) casts two an hour. The founder (D) takes two an hour. Forty ingots in 100 hours.",
    map: [
      "############",
      "############",
      "###..#####..",
      "##D#......#F",
      "###N.#####..",
      "############",
    ],
    products: { lead: { name: "Lead", price: 0 } },
    jetties: {
      N: { kind: "load", product: "lead", parcel: 2, tank: { start: 12, rate: 0, cap: 12 } },
      F: { kind: "load", product: "lead", parcel: 2, tank: { start: 10, rate: 2, cap: 20 } },
      D: { kind: "discharge", parcel: 2 },
    },
    fleet: { coaster: 2, handy: 1 }, target: 40, deadline: 100, maxCycles: 600,
    par: { cost: 50, hours: 56, water: 16, instructions: 17 },
    plans: [
      { par: ["cost","water","instructions"], ships: [
        { x: 3, y: 2, h: 1, type: "coaster", prog: program("(4S)(2L)S(2D)S") },
        { x: 2, y: 3, h: 2, type: "handy", prog: program("(3S)P(4A)P(2S)(5L)(3S)P(4A)P(2S)(5D)") },
      ] },
      { par: ["hours","water"], ships: [
        { x: 4, y: 2, h: 0, type: "coaster", prog: program("(3S)(2L)S(2D)(5S)(2L)S(2D)(5S)(2L)S(2D)(2S)") },
        { x: 11, y: 3, h: 5, type: "coaster", prog: program("(2L)(3S)P(4A)P(2S)(2D)(3S)P(4A)P(2S)") },
        { x: 9, y: 3, h: 0, type: "handy", prog: program("P(2S)(5L)(3S)P(4A)P(2S)(5D)(3S)P(4A)") },
      ] },
    ],
  },
  {
    id: "trickle", name: "Trickle",                    // found by the level lab
    chapter: "nwe", teaches: "cheap and slow, or dear and fast",
    brief: "Bog iron (B), beside the smithy (D), costs 1 an ingot, one a lift, but its yard gains half an ingot an hour. L, down the channel, costs 2: four a lift. Thirty ingots.",
    map: [
      "######",
      "######",
      "###.D#",
      "##.B##",
      "#..###",
      "#.####",
      "#L####",
      "######",
    ],
    products: { iron: { name: "Iron", price: 2 }, cheap: { name: "Bog iron", price: 1 } },
    jetties: {
      L: { kind: "load", product: "iron", parcel: 4 },
      D: { kind: "discharge", parcel: 4 },
      B: { kind: "load", product: "cheap", parcel: 1, tank: { start: 0, rate: 0.5, cap: 10 } },
    },
    fleet: { coaster: 3, handy: 1 }, target: 30, maxCycles: 500,
    par: { cost: 52, hours: 35, water: 2, instructions: 4 },
    plans: [
      { par: ["cost", "water"], ships: [
        { x: 3, y: 3, h: 1, type: "coaster", prog: program("(2L)ADB(2L)") },
      ] },
      { par: ["hours"], ships: [
        { x: 4, y: 2, h: 1, type: "coaster", prog: program("B(4L)ADB(4L)ADB(4L)AD") },
        { x: 1, y: 6, h: 4, type: "handy", prog: program("(2L)(4B)PBP(2D)BSBS(3A)") },
      ] },
      { par: ["water", "instructions"], ships: [
        { x: 4, y: 2, h: 1, type: "handy", prog: program("(2D)B(7L)A") },
      ] },
    ],
  },
  {
    id: "blend-wall", name: "Pewter stamp",                 // it was Blend wall: E10, at most 10% ethanol
    chapter: "nwe", teaches: "a ceiling that pays",
    brief: "The pewterers' stamp (D): at most 10% lead. T: tin, three a lift at 2 marks. P: lead up the creek, one a lift, and its premium pays 4 an ingot. Thirty ingots.",
    map: [
      "#########",
      "###..T.##",
      "###.###.#",
      "P.....D##",
      "#########",
    ],
    products: { tin: { name: "Tin", price: 2 }, lead: { name: "Lead", price: -4 } },
    jetties: {
      T: { kind: "load", product: "tin", parcel: 3 },
      P: { kind: "load", product: "lead", parcel: 1 },
      D: { kind: "discharge", parcel: 2, spec: { lead: [0, 0.1] } },
    },
    fleet: { coaster: 2, handy: 1 }, target: 30, maxCycles: 400,
    par: { cost: 72, hours: 34, water: 10, instructions: 6 },
    plans: [
      { par: ["hours", "water"], ships: [
        { x: 4, y: 3, h: 3, type: "handy", prog: program("A(3S)A(3L)A(2S)(5D)SA") },
        { x: 5, y: 1, h: 0, type: "coaster", prog: program("LA(2S)(2D)S(2A)(3S)A") },
        { x: 3, y: 2, h: 2, type: "coaster", prog: program("(2S)ALA(2S)(2D)S(2A)S") },
      ] },
      { par: ["water", "instructions"], ships: [
        { x: 5, y: 1, h: 3, type: "handy", prog: program("(3L)(2A)(3P)(2A)(5D)(3P)") },
      ] },
      { par: ["cost"], ships: [
        { x: 0, y: 3, h: 3, type: "handy", prog: program("L(3B)(3S)A(3L)A(2S)(5D)S(5A)") },
      ] },
    ],
  },
  {
    id: "heels", name: "Heels",
    chapter: "nwe", teaches: "what stays aboard",
    brief: "A takes pure copper, B brass (at least 30% calamine), twelve ingots each. C: copper, two a lift at 1. Z: calamine, two at 3. A discharge leaves the rest aboard.",
    map: [
      "#########",
      "###..A.##",
      "###C###Z#",
      "###..B.##",
      "#########",
    ],
    products: { copper: { name: "Copper", price: 1 }, calamine: { name: "Calamine", price: 3 } },
    jetties: {
      C: { kind: "load", product: "copper", parcel: 2 },
      Z: { kind: "load", product: "calamine", parcel: 2 },
      A: { kind: "discharge", parcel: 2, spec: { calamine: [0, 0] }, target: 12 },
      B: { kind: "discharge", parcel: 2, spec: { calamine: [0.3, 1] }, target: 12 },
    },
    fleet: { coaster: 2, handy: 1 }, target: 24, maxCycles: 400,
    par: { cost: 62, hours: 24, water: 10, instructions: 11 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [
        { x: 3, y: 2, h: 2, type: "handy", prog: program("(5L)(2S)A(3D)ASL(2S)(3D)(2A)S") },
      ] },
      { par: ["hours", "water"], ships: [
        { x: 7, y: 2, h: 5, type: "handy", prog: program("(3L)(2S)(3D)(2A)(3S)(2A)S") },
        { x: 3, y: 2, h: 2, type: "coaster", prog: program("(2L)(2S)A(2D)A(3S)(2A)S") },
        { x: 5, y: 3, h: 3, type: "coaster", prog: program("(2A)S(2.)(2L)(2S)A(2D)A(3S)") },
      ] },
    ],
  },
  {
    id: "roundabout", name: "Roundabout",              // found by the level lab
    chapter: "straits", teaches: "ships sharing one route",
    brief: "Both berths are dead ends off a ring round a little island: the smelter (L) to the east, the founder (D) to the west, taking four ingots an hour. Sixteen ingots.",
    map: [
      "#######",
      "##...##",
      "##.#.L#",
      "#D..###",
      "#######",
    ],
    products: { copper: { name: "Copper", price: 0 } },
    jetties: {
      L: { kind: "load", product: "copper", parcel: 2 },
      D: { kind: "discharge", parcel: 4 },
    },
    fleet: { coaster: 3 }, target: 16, maxCycles: 500,
    par: { cost: 20, hours: 23, water: 9, instructions: 10 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [
        { x: 5, y: 2, h: 0, type: "coaster", prog: program("(2L)BPB(3P)ADB(3P)S") },
      ] },
      { par: ["hours", "water"], ships: [
        { x: 4, y: 2, h: 4, type: "coaster", prog: program("ASADB(3S)AS(2L)BS") },
        { x: 2, y: 3, h: 3, type: "coaster", prog: program("(3S)AS(2L)BSASADB") },
        { x: 5, y: 2, h: 5, type: "coaster", prog: program("(2L)BSASADB.(3S)AS") },
      ] },
    ],
  },
  {
    id: "queue", name: "Toll queue",                              // drawn in the level lab
    chapter: "straits", teaches: "holding at a slow berth",
    brief: "The ironworks (L) lifts an ingot an hour; the toll quay (D) takes four. One channel joins them, with room to pass halfway and a basin at each end. Twenty-four ingots.",
    map: [
      "#..#####",
      "..L#####",
      "###.####",
      "###.####",
      "###..###",
      "####...#",
      "######D.",
      "######..",
      "######..",
      "########",
    ],
    products: { iron: { name: "Iron", price: 0 } },
    jetties: {
      L: { kind: "load", product: "iron", parcel: 1 },
      D: { kind: "discharge", parcel: 4 },
    },
    fleet: { coaster: 4 }, target: 24, maxCycles: 600,
    par: { cost: 20, hours: 58, water: 12, instructions: 16 },
    plans: [
      { par: ["cost", "instructions"], ships: [
        { x: 2, y: 1, h: 0, type: "coaster", prog: program("(4L)S(3A)PSDPBPB(2P)S(4A)(2P)B(2P)") },
      ] },
      { par: ["hours"], ships: [
        { x: 2, y: 0, h: 2, type: "coaster", prog: program("P(6.)PB(2P)(4L)S(3A)PASBSDBSAS(4A)") },
        { x: 1, y: 0, h: 4, type: "coaster", prog: program("P(4.)P(4L)S(3A)P(2.)SDPBPB(2P)S(4A)(2P)B") },
        { x: 2, y: 1, h: 0, type: "coaster", prog: program("(4L)S(3A)P(4.)SDPBP.B(2P)S(4A)(2P)BP.P") },
      ] },
      { par: ["cost", "water"], ships: [
        { x: 2, y: 1, h: 0, type: "coaster", prog: program("(4L)S(3A)PSDPBPB(2P)S(3A)PSBSBS") },
      ] },
    ],
  },
  {
    id: "passing-places", name: "Passing places",                 // drawn in the level lab
    chapter: "straits", teaches: "stepping aside to pass",
    brief: "One channel from the smelter (L) to the founder (D), with three wider stretches where ships can get by. Twelve ingots.",
    map: [
      "#L####",
      "#.####",
      "##..##",
      "##..##",
      "###..#",
      "###.##",
      "###..#",
      "####D#",
      "######",
    ],
    products: { tin: { name: "Tin", price: 0 } },
    jetties: {
      L: { kind: "load", product: "tin", parcel: 2 },
      D: { kind: "discharge", parcel: 2 },
    },
    fleet: { coaster: 3 }, target: 12, maxCycles: 600,
    par: { cost: 20, hours: 25, water: 8, instructions: 4 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [
        { x: 1, y: 0, h: 2, type: "coaster", prog: program("(2L)(7B)(2D)(7A)") },
      ] },
      { par: ["hours"], ships: [
        { x: 4, y: 7, h: 2, type: "coaster", prog: program("(2D)(3A)SP(4.)PSA(2L)(7B)") },
        { x: 1, y: 0, h: 2, type: "coaster", prog: program("(2L)(7B)(2D)(2A)SPA(4.)PSA") },
        { x: 3, y: 2, h: 2, type: "coaster", prog: program("(4.)PSA(2L)(7B)(2D)(2A)SPA") },
      ] },
    ],
  },
  {
    id: "lockstep", name: "Lockstep",                 // drawn in the level lab
    chapter: "straits", teaches: "moving as a pair",
    brief: "One straight channel from the smelter (L) to the founder (D), with a hex to spare past each. Twelve ingots.",
    map: [
      "#.####",
      "#L####",
      "##.###",
      "##.###",
      "###.##",
      "###.##",
      "####.#",
      "####D#",
      "#####.",
    ],
    products: { lead: { name: "Lead", price: 0 } },
    jetties: {
      L: { kind: "load", product: "lead", parcel: 2 },
      D: { kind: "discharge", parcel: 2 },
    },
    fleet: { coaster: 3 }, target: 12, maxCycles: 600,
    par: { cost: 20, hours: 35, water: 7, instructions: 4 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [
        { x: 1, y: 1, h: 2, type: "coaster", prog: program("(2L)(6B)(2D)(6A)") },
      ] },
      { par: ["hours"], ships: [
        { x: 1, y: 1, h: 2, type: "coaster", prog: program("(2L)(6B)(2D)B(2.)(6A)(2.)A") },
        { x: 1, y: 0, h: 2, type: "coaster", prog: program("(2.)(6B)(2.)B(2D)(6A)(2L)A") },
      ] },
    ],
  },
];
