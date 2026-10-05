// Harbour's levels. A map is rows of tiles: # land, . water, L a jetty to load at, D a jetty to discharge at. The par
// on each measure is the best that tests/harbour.mjs reaches with its reference solutions, and the tests hold it there.
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
    par: { hire: 20, hours: 23, water: 10 },
  },
];
