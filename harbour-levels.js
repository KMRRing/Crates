// Harbour's levels. A map is rows of tiles: # land, . water, and a letter for each jetty the level spells out (level 1
// keeps its first form: L to load, D to discharge, a cargo the whole ship). A load jetty has a product, the parcel it
// lifts and, if it's a refinery's, the tank behind it; a discharge jetty the parcel it takes and the spec it holds it
// to. The par on each measure is the best that tests/harbour.mjs reaches with its reference solutions, and the tests
// hold it there.
export const LEVELS = [
  {
    id: "first-cargo", name: "First cargo",
    brief: "Load at the refinery's jetty (L), discharge at the customer's (D). Four cargoes.",
    map: [
      "########",
      "#......#",
      "L.####.D",
      "#......#",
      "########",
    ],
    target: 4, shipCost: 20, maxShips: 4, maxCycles: 400,
    par: { cost: 20, hours: 23, water: 10, instructions: 12 },
  },
  {
    id: "rundown", name: "Rundown",
    brief: "The refinery's tank (L) fills one unit an hour and holds eight. A ship lifts four. Six cargoes to the customer (D).",
    map: [
      "#######",
      "#..L..#",
      "#.###.#",
      "#..D..#",
      "#######",
    ],
    products: { diesel: { name: "Diesel", price: 0 } },
    jetties: { L: { kind: "load", product: "diesel", tank: { start: 0, rate: 1, cap: 8 } }, D: { kind: "discharge" } },
    shipCap: 4, target: 6, shipCost: 20, maxShips: 4, maxCycles: 400,
    par: { cost: 20, hours: 32, water: 7, instructions: 8 },
  },
  {
    id: "first-blend", name: "First blend",
    brief: "Blend in the ship. G: gasoil, two units a lift at $1k each. F: FAME, one at $3k. The customer (D) takes five, at least 20% FAME. Four cargoes.",
    map: [
      "########",
      "#.G.F..#",
      "#.####.#",
      "#...D..#",
      "########",
    ],
    products: { gasoil: { name: "Gasoil", price: 1 }, fame: { name: "FAME", price: 3 } },
    jetties: {
      G: { kind: "load", product: "gasoil", parcel: 2 },
      F: { kind: "load", product: "fame", parcel: 1 },
      D: { kind: "discharge", parcel: 5, spec: { fame: [0.2, 1] } },
    },
    shipCap: 5, target: 4, shipCost: 20, maxShips: 3, maxCycles: 400,
    par: { cost: 48, hours: 30, water: 9, instructions: 10 },
  },
];
