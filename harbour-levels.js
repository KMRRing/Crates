// Harbour's levels. A map is rows of hexes, pointy side up, every odd row set half a hex to the right: # land, . water,
// and a letter for each jetty the level spells out. A load jetty has a product, the parcel it lifts in an hour and, if
// it's a refinery's, the tank behind it; a discharge jetty the parcel it takes in an hour and the spec it holds it to. A
// level's fleet is the ships it offers, so many of each class (the classes, what each carries and costs, are the
// engine's, the same in every level). Jetties sit on the channel round an island, as berths do: a ship
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
    products: { oil: { name: "Oil", price: 0 } },
    jetties: { L: { kind: "load", product: "oil", parcel: 4 }, D: { kind: "discharge", parcel: 4 } },
    fleet: { coaster: 4 }, target: 4, maxCycles: 400,
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
    id: "rundown", name: "Rundown",
    brief: "The refinery's tank (L) fills a unit an hour and holds eight; its jetty lifts four an hour. Six cargoes of four to the customer (D).",
    map: [
      "#####",
      "#.L.#",
      "#.##.",
      "#.D.#",
    ],
    products: { diesel: { name: "Diesel", price: 0 } },
    jetties: { L: { kind: "load", product: "diesel", parcel: 4, tank: { start: 0, rate: 1, cap: 8 } }, D: { kind: "discharge", parcel: 4 } },
    fleet: { coaster: 3, handy: 1 }, target: 6, maxCycles: 400,
    par: { cost: 20, hours: 30, water: 8, instructions: 6 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [{ x: 2, y: 1, h: 0, type: "coaster", prog: program("LA(3S)DA(3S)") }] },
      { par: ["hours"], ships: [
        { x: 2, y: 1, h: 0, type: "coaster", prog: program("LA(3S)DA(3S)") },
        { x: 3, y: 3, h: 4, type: "handy", prog: program("S(2D)A(3S)(2L)A(2S)") },
      ] },
    ],
  },
  {
    id: "first-blend", name: "First blend",
    brief: "Blend in the ship. G: gasoil, two units a lift at $1k each. F: FAME, one at $3k. The customer (D) takes four at a time, at least 25% FAME. Four cargoes.",
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
      D: { kind: "discharge", parcel: 4, spec: { fame: [0.25, 1] } },
    },
    fleet: { coaster: 2, handy: 1 }, target: 4, maxCycles: 400,
    par: { cost: 50, hours: 18, water: 12, instructions: 8 },
    plans: [
      { par: ["cost", "water", "instructions"], ships: [{ x: 2, y: 1, h: 0, type: "handy", prog: program("(3L)(2A)(2L)A(3S)(2D)(3A)(3S)") }] },
      { par: ["hours"], ships: [
        { x: 2, y: 1, h: 0, type: "coaster", prog: program("L(2A)(2L)A(3S)D(3A)(3S)") },
        { x: 1, y: 3, h: 3, type: "coaster", prog: program("(3S)L(2A)(2L)A(3S)D(3A)") },
        { x: 3, y: 3, h: 3, type: "handy", prog: program("(2A)(3S)(3L)(2A)(2L)A(3S)(2D)A") },
      ] },
    ],
  },
];
