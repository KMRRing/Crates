// Harbour's levels. A map is rows of hexes, pointy side up, every odd row set half a hex to the right: # land, . water,
// and a letter for each jetty the level spells out (level 1 keeps its first form: L to load, D to discharge, a cargo the
// whole ship). A load jetty has a product, the parcel it lifts and, if it's a refinery's, the tank behind it; a discharge
// jetty the parcel it takes and the spec it holds it to. Jetties sit on the channel round an island, as berths do: a ship
// can't turn on the spot, so a dead end means backing out. The par on each measure is the best that tests/harbour.mjs
// reaches with its reference solutions (found by searching every plan of ships going round the ring), and the tests
// hold it there.
export const LEVELS = [
  {
    id: "first-cargo", name: "First cargo",
    brief: "Load at the refinery's jetty (L), discharge at the customer's (D), round the island. Four cargoes.",
    map: [
      "######",
      "#....#",
      "#L###D",
      "#....#",
    ],
    target: 4, shipCost: 20, maxShips: 4, maxCycles: 400,
    par: { cost: 20, hours: 13, water: 10, instructions: 8 },
  },
  {
    id: "rundown", name: "Rundown",
    brief: "The refinery's tank (L) fills one unit an hour and holds eight. A ship lifts four. Six cargoes to the customer (D).",
    map: [
      "#####",
      "#.L.#",
      "#.##.",
      "#.D.#",
    ],
    products: { diesel: { name: "Diesel", price: 0 } },
    jetties: { L: { kind: "load", product: "diesel", tank: { start: 0, rate: 1, cap: 8 } }, D: { kind: "discharge" } },
    shipCap: 4, target: 6, shipCost: 20, maxShips: 4, maxCycles: 400,
    par: { cost: 20, hours: 30, water: 8, instructions: 6 },
  },
  {
    id: "first-blend", name: "First blend",
    brief: "Blend in the ship. G: gasoil, two units a lift at $1k each. F: FAME, one at $3k. The customer (D) takes five, at least 20% FAME. Four cargoes.",
    map: [
      "#######",
      "#.G.F.#",
      "#.####.",
      "#...D.#",
    ],
    products: { gasoil: { name: "Gasoil", price: 1 }, fame: { name: "FAME", price: 3 } },
    jetties: {
      G: { kind: "load", product: "gasoil", parcel: 2 },
      F: { kind: "load", product: "fame", parcel: 1 },
      D: { kind: "discharge", parcel: 5, spec: { fame: [0.2, 1] } },
    },
    shipCap: 5, target: 4, shipCost: 20, maxShips: 3, maxCycles: 400,
    par: { cost: 48, hours: 26, water: 12, instructions: 8 },
  },
];
