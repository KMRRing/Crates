// Harbour's levels. A map is rows of hexes, pointy side up, every odd row set half a hex to the right: # land, . water,
// and a letter for each jetty the level spells out. A load jetty has a product, the parcel it lifts in an hour and, if
// it's a refinery's, the tank behind it; a discharge jetty the parcel it takes in an hour and the spec it holds it to. A
// level's fleet is the ships it offers, so many of each class (the classes, what each carries and costs, are the
// engine's, the same in every level). A ship can't turn on the spot, so a dead end means backing out. A level may set
// a delivery window (deadline: "sixteen units within 80 hours"), and a customer its own target. The par on each
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

export const LEVELS = [
  {
    id: "first-cargo", name: "First cargo",
    brief: "Load at the refinery's jetty (L), discharge at the customer's (D), round the island. Sixteen units: four coaster loads.",
    map: [
      "######",
      "#....#",
      "#L###D",
      "#....#",
    ],
    products: { oil: { name: "Oil", price: 0 } },
    jetties: { L: { kind: "load", product: "oil", parcel: 4 }, D: { kind: "discharge", parcel: 4 } },
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
    brief: "The refinery (L) is up a creek too narrow to turn in: Astern backs a ship out, keeping its heading. The customer (D) is down the shore. Sixteen units.",
    map: [
      "#########",
      "###....##",
      "###.###.#",
      "L.....D##",
      "#########",
    ],
    products: { oil: { name: "Oil", price: 0 } },
    jetties: {
      L: { kind: "load", product: "oil", parcel: 2 },
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
    id: "roundabout", name: "Roundabout",              // found by the level lab
    brief: "Both berths are dead ends off a ring round a little island: the refinery (L) to the east, the customer (D) to the west, taking four units an hour. Sixteen units.",
    map: [
      "#######",
      "##...##",
      "##.#.L#",
      "#D..###",
      "#######",
    ],
    products: { oil: { name: "Oil", price: 0 } },
    jetties: {
      L: { kind: "load", product: "oil", parcel: 2 },
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
    id: "single-track", name: "Single track",
    brief: "The line between the two harbours is single track, opening round a small island halfway. The jetties pump a unit an hour. Twenty-four units.",
    map: [
      "###########",
      "##L.#######",
      "##.#.######",
      "##..#######",
      "####.######",
      "####.######",
      "#####..####",
      "####.#.####",
      "#####..####",
      "######.####",
      "#######.###",
      "#######..##",
      "#######.#.#",
      "#######.D##",
      "###########",
    ],
    products: { oil: { name: "Oil", price: 0 } },
    jetties: {
      L: { kind: "load", product: "oil", parcel: 1 },
      D: { kind: "discharge", parcel: 1 },
    },
    fleet: { coaster: 4 }, target: 24, maxCycles: 600,
    par: { cost: 20, hours: 78, water: 20, instructions: 20 },
    plans: [
      { par: ["cost","water","instructions"], ships: [
        { x: 2, y: 1, h: 3, type: "coaster", prog: program("(4L)(3P)S(2A)P(2S)P(2A)S(2P)(4D)(3P)S(2A)S(2P)S(2A)S(2P)") },
      ] },
      { par: ["hours"], ships: [
        { x: 2, y: 1, h: 3, type: "coaster", prog: program("(4L)(3P)S(2A)P(2S)P(2A)S(2P)(4D)(3P)S(2A)S(2P)S(2A)S(2P)") },
        { x: 6, y: 8, h: 2, type: "coaster", prog: program("S(2P)S(2A)S(2P)(4L)(3P)S(2A)P(2S)P(2A)S(2P)(4D)(3P)S(2A)") },
        { x: 8, y: 13, h: 0, type: "coaster", prog: program("(2D)(3P)S(2A)P(2S)P(2A)S(2P)(4L)(3P)S(2A)S(2P)S(2A)S(2P)(2D)") },
      ] },
    ],
  },
  {
    id: "rundown", name: "Rundown",
    rev: 2,              // pumps of two an hour and a tank of ten since the 10-unit Handy: plans and bests from before don't carry over
    brief: "The refinery's tank (L) fills a unit an hour and holds ten. Both jetties pump two units an hour. Twenty-four units to the customer (D).",
    map: [
      "#####",
      "#.L.#",
      "#.##.",
      "#.D.#",
    ],
    products: { diesel: { name: "Diesel", price: 0 } },
    jetties: { L: { kind: "load", product: "diesel", parcel: 2, tank: { start: 0, rate: 1, cap: 10 } }, D: { kind: "discharge", parcel: 2 } },
    fleet: { coaster: 3, handy: 1 }, target: 24, maxCycles: 400,
    par: { cost: 20, hours: 31, water: 8, instructions: 6 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [{ x: 2, y: 1, h: 0, type: "coaster", prog: program("(2L)A(3S)(2D)A(3S)") }] },
      { par: ["hours"], ships: [
        { x: 2, y: 1, h: 0, type: "coaster", prog: program("LA(3S)(2D)A(3S)L") },
        { x: 4, y: 2, h: 5, type: "coaster", prog: program("(2S)(2D)A(3S)(2L)AS") },
        { x: 2, y: 3, h: 3, type: "handy", prog: program("DA(3S)(2L)A(3S)D") },
      ] },
    ],
  },
  {
    id: "two-refineries", name: "Two refineries",
    brief: "The near refinery (N) is closing, with 12 units left in its tank; the far one (F) makes two an hour. The customer (D) takes two an hour. Forty units within 100 hours.",
    map: [
      "############",
      "############",
      "###..#####..",
      "##D#......#F",
      "###N.#####..",
      "############",
    ],
    products: { diesel: { name: "Diesel", price: 0 } },
    jetties: {
      N: { kind: "load", product: "diesel", parcel: 2, tank: { start: 12, rate: 0, cap: 12 } },
      F: { kind: "load", product: "diesel", parcel: 2, tank: { start: 10, rate: 2, cap: 20 } },
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
    brief: "G, beside the customer (D), sells oil at $1k a unit, one a lift, but its tank fills only half a unit an hour. L, down the channel, sells at $2k, four a lift. The customer takes four an hour. Thirty units.",
    map: [
      "######",
      "######",
      "###.D#",
      "##.G##",
      "#..###",
      "#.####",
      "#L####",
      "######",
    ],
    products: { oil: { name: "Oil", price: 2 }, cheap: { name: "Oil, cheaper", price: 1 } },
    jetties: {
      L: { kind: "load", product: "oil", parcel: 4 },
      D: { kind: "discharge", parcel: 4 },
      G: { kind: "load", product: "cheap", parcel: 1, tank: { start: 0, rate: 0.5, cap: 10 } },
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
    id: "first-blend", name: "First blend",
    rev: 4,              // FAME at $5k (the Handy's exact blend cheapest again): plans and bests from before don't carry over
    brief: "Blend in the ship. G: gasoil, two units a lift at $1k each. F: FAME, one at $5k. The customer (D) takes two an hour, at least 20% FAME. Twenty units.",
    map: [
      "#######",
      "#.G.F.#",
      "#.####.",
      "#...D.#",
    ],
    products: { gasoil: { name: "Gasoil", price: 1 }, fame: { name: "FAME", price: 5 } },
    jetties: {
      G: { kind: "load", product: "gasoil", parcel: 2 },
      F: { kind: "load", product: "fame", parcel: 1 },
      D: { kind: "discharge", parcel: 2, spec: { fame: [0.2, 1] } },
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
    id: "blend-wall", name: "Blend wall",
    brief: "E10: the customer (D) takes gasoline with at most 10% ethanol. G: gasoline, three units a lift at $2k each. E: ethanol up the creek, a unit a lift, and its tickets pay $4k a unit. Thirty units.",
    map: [
      "#########",
      "###..G.##",
      "###.###.#",
      "E.....D##",
      "#########",
    ],
    products: { gasoline: { name: "Gasoline", price: 2 }, ethanol: { name: "Ethanol", price: -4 } },
    jetties: {
      G: { kind: "load", product: "gasoline", parcel: 3 },
      E: { kind: "load", product: "ethanol", parcel: 1 },
      D: { kind: "discharge", parcel: 2, spec: { ethanol: [0, 0.1] } },
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
    brief: "Two customers, two grades: A takes pure diesel, B at least 30% FAME, twelve units each. G: diesel, two units a lift at $1k each. F: FAME, two at $3k. A discharge leaves the rest aboard.",
    map: [
      "#########",
      "###..A.##",
      "###G###F#",
      "###..B.##",
      "#########",
    ],
    products: { diesel: { name: "Diesel", price: 1 }, fame: { name: "FAME", price: 3 } },
    jetties: {
      G: { kind: "load", product: "diesel", parcel: 2 },
      F: { kind: "load", product: "fame", parcel: 2 },
      A: { kind: "discharge", parcel: 2, spec: { fame: [0, 0] }, target: 12 },
      B: { kind: "discharge", parcel: 2, spec: { fame: [0.3, 1] }, target: 12 },
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
];
