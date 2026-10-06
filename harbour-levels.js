// Harbour's levels. A map is rows of hexes, pointy side up, every odd row set half a hex to the right: # land, . water,
// and a letter for each jetty the level spells out (level 1 keeps its first form: L to load, D to discharge, a cargo the
// whole ship). A load jetty has a product, the parcel it lifts and, if it's a refinery's, the tank behind it; a discharge
// jetty the parcel it takes and the spec it holds it to. Jetties sit on the channel round an island, as berths do: a ship
// can't turn on the spot, so a dead end means backing out. The par on each measure is the best that tests/harbour.mjs
// reaches, found by searching every plan of ships going round the ring; each level carries the plans that reach it, so
// the page can show them (tap a par in the menu) and the tests run the same plans and hold the par there.

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
    brief: "Load at the refinery's jetty (L), discharge at the customer's (D), round the island. Four cargoes.",
    map: [
      "######",
      "#....#",
      "#L###D",
      "#....#",
    ],
    target: 4, shipCost: 20, maxShips: 4, maxCycles: 400,
    par: { cost: 20, hours: 13, water: 10, instructions: 8 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [{ x: 1, y: 2, h: 2, prog: program("L(2S)(2A)SD(2S)(2A)S") }] },
      { par: ["hours"], ships: [
        { x: 1, y: 2, h: 2, prog: program("L(2S)(2A)SD(2S)(2A)S") },
        { x: 5, y: 2, h: 5, prog: program("D(2S)(2A)SL(2S)(2A)S") },
        { x: 4, y: 3, h: 4, prog: program("S(2A)SL(2S)(2A)SDS") },
        { x: 2, y: 3, h: 3, prog: program("ASL(2S)(2A)SD(2S)A") },
      ] },
    ],
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
    plans: [
      { par: ["cost", "water", "instructions"], ships: [{ x: 2, y: 1, h: 0, prog: program("LA(3S)DA(3S)") }] },
      { par: ["hours"], ships: [
        { x: 2, y: 1, h: 0, prog: program("LA(3S)DA(3S)") },
        { x: 3, y: 1, h: 0, prog: program("(3S)DA(3S)LA") },
        { x: 2, y: 3, h: 3, prog: program("A(3S)LA(3S)D") },
      ] },
    ],
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
    plans: [
      { par: ["cost", "water", "instructions"], ships: [{ x: 2, y: 1, h: 0, prog: program("(2L)(2A)LA(3S)D(3A)(3S)") }] },
      { par: ["hours"], ships: [
        { x: 2, y: 1, h: 0, prog: program("(2L)(2A)LA(3S)D(3A)(3S)") },
        { x: 3, y: 1, h: 0, prog: program("ALA(3S)D(3A)(3S)(2L)A") },
        { x: 5, y: 1, h: 0, prog: program("(3S)D(3A)(3S)(2L)(2A)LA") },
      ] },
    ],
  },
];
