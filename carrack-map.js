// Carrack's map as data: 36 ports in 9 regions, the sea lanes (and a few caravan roads) between them, the six goods and
// where they come from. Static: never in a game's state. Ports are an index 0..35 (the order below); the rules, the bots
// and the page all say a port by that index.
//
// Geography is honest in order, not in scale: lon/lat are the real place; x/y are a schematic board 390 wide and 330 tall
// (Europe stretched, the China coast and Japan spread) in which west stays west and north stays north for any two
// ports far apart (tests/carrack.mjs checks that). `lab` is where the name sits against the dot (n e s w ne nw se sw),
// chosen so no two names overlap at 8px type (the test checks that too).
//
// A lane: [from, to, days (1–3), flags, via?]. Flags: m monsoon (sailed one way a season), o open ocean (ocean ships
// only), p pirates, c caravan road (not sea), r the Red Sea (the Ottomans' toll after Egypt falls). `via` is only for
// drawing (the Cape of Good Hope).

export const W = 390, H = 330;

export const REGIONS = [
  "Baltic", "North Sea and Atlantic", "Mediterranean", "West Africa", "Swahili coast",
  "Arabian Sea and Gujarat", "Bay of Bengal and Malacca", "South China Sea and Ryukyu", "Japan",
];

// id, name, region, lon, lat, x, y, lab, value (silver a held port pays a round)
const ROWS = [
  ["LUB", "Lübeck", 0, 10.7, 53.9, 76, 38, "w", 1],
  ["REV", "Reval", 0, 24.7, 59.4, 116, 14, "n", 1],
  ["NOV", "Novgorod", 0, 31.3, 58.5, 146, 30, "w", 1],
  ["LON", "London", 1, -0.1, 51.5, 36, 46, "e", 1],
  ["ANT", "Antwerp", 1, 4.4, 51.2, 56, 62, "w", 2],
  ["LIS", "Lisbon", 1, -9.1, 38.7, 12, 96, "e", 1],
  ["SEV", "Seville", 1, -6.0, 37.4, 26, 112, "s", 1],
  ["VEN", "Venice", 2, 12.3, 45.4, 86, 74, "s", 3],
  ["CON", "Constantinople", 2, 29.0, 41.0, 134, 92, "w", 2],
  ["ALE", "Alexandria", 2, 29.9, 31.2, 134, 126, "e", 2],
  ["ALP", "Aleppo", 2, 37.2, 36.2, 160, 108, "s", 1],
  ["ELM", "Elmina", 3, -1.3, 5.1, 34, 206, "s", 1],
  ["SAO", "São Tomé", 3, 6.7, 0.3, 62, 226, "w", 1],
  ["MPI", "Mpinda", 3, 12.3, -6.1, 80, 252, "e", 1],
  ["SOF", "Sofala", 4, 34.7, -20.2, 150, 296, "w", 1],
  ["KIL", "Kilwa", 4, 39.5, -8.9, 160, 264, "e", 1],
  ["MOM", "Mombasa", 4, 39.7, -4.0, 164, 244, "w", 1],
  ["MAL", "Malindi", 4, 40.1, -3.2, 176, 228, "s", 1],
  ["ADE", "Aden", 5, 45.0, 12.8, 184, 176, "s", 1],
  ["HOR", "Hormuz", 5, 56.5, 27.1, 214, 136, "e", 1],
  ["CAM", "Cambay", 5, 72.6, 22.3, 240, 152, "s", 2],
  ["GOA", "Goa", 5, 73.9, 15.5, 246, 172, "w", 1],
  ["CAL", "Calicut", 5, 75.8, 11.3, 250, 190, "w", 1],
  ["COL", "Colombo", 6, 79.9, 6.9, 262, 206, "s", 1],
  ["ACE", "Aceh", 6, 95.3, 5.5, 292, 208, "e", 1],
  ["MLC", "Malacca", 6, 102.2, 2.2, 312, 224, "s", 2],
  ["BAN", "Banten", 6, 106.2, -6.0, 326, 254, "w", 1],
  ["BDA", "Banda", 6, 129.9, -4.5, 376, 252, "n", 1],
  ["TER", "Ternate", 6, 127.4, 0.8, 372, 226, "s", 1],
  ["GUA", "Guangzhou", 7, 113.3, 23.1, 332, 150, "s", 2],
  ["YUE", "Yuegang", 7, 117.9, 24.4, 346, 142, "n", 1],
  ["NIN", "Ningbo", 7, 121.5, 29.9, 358, 124, "w", 1],
  ["NAH", "Naha", 7, 127.7, 26.2, 374, 142, "s", 1],
  ["MNL", "Manila", 7, 121.0, 14.6, 354, 184, "n", 1],
  ["HAK", "Hakata", 8, 130.4, 33.6, 380, 104, "nw", 1],
  ["NAG", "Nagasaki", 8, 129.9, 32.7, 372, 118, "nw", 1],
];

export const PORTS = ROWS.map(([id, name, region, lon, lat, x, y, lab, value], i) => ({ i, id, name, region, lon, lat, x, y, lab, value }));
export const N_PORTS = PORTS.length;
export const IDX = Object.fromEntries(PORTS.map(p => [p.id, p.i]));
const P = id => IDX[id];

const LANE_ROWS = [
  ["LUB", "REV", 2, ""], ["REV", "NOV", 1, ""], ["LUB", "LON", 3, ""], ["LUB", "ANT", 3, ""], ["LON", "ANT", 1, ""],
  ["LON", "LIS", 3, ""], ["ANT", "LIS", 3, ""], ["LIS", "SEV", 1, ""], ["SEV", "VEN", 3, "p"],
  ["VEN", "CON", 3, ""], ["VEN", "ALE", 3, "p"], ["CON", "ALE", 3, ""], ["CON", "ALP", 2, "c"], ["ALE", "ALP", 1, "c"],
  ["ALP", "HOR", 3, "c"], ["ALE", "ADE", 3, "r"],
  ["LIS", "ELM", 3, "o"], ["ELM", "SAO", 2, ""], ["SAO", "MPI", 2, ""], ["MPI", "SOF", 3, "o", [[104, 312], [128, 322]]],
  ["SOF", "KIL", 2, ""], ["KIL", "MOM", 1, ""], ["MOM", "MAL", 1, ""],
  ["MAL", "ADE", 3, "m"], ["MAL", "CAM", 3, "m"], ["MAL", "CAL", 3, "m"], ["ADE", "HOR", 3, ""], ["ADE", "CAM", 3, "m"],
  ["HOR", "CAM", 2, "m"], ["CAM", "GOA", 2, ""], ["GOA", "CAL", 1, ""], ["CAL", "COL", 2, ""], ["COL", "ACE", 3, "m"],
  ["ACE", "MLC", 1, "p"], ["MLC", "BAN", 2, "p"], ["BAN", "BDA", 3, "m"], ["BDA", "TER", 2, ""], ["MLC", "TER", 3, "m"],
  ["MLC", "GUA", 3, "m"], ["MLC", "MNL", 3, "m"], ["TER", "MNL", 3, "m"], ["MNL", "GUA", 2, "m"], ["MNL", "YUE", 2, "m"],
  ["MNL", "NAH", 2, "m"], ["GUA", "YUE", 1, "p"], ["YUE", "NIN", 1, "p"], ["YUE", "NAH", 2, "m"], ["NIN", "NAH", 2, "m"],
  ["NAH", "NAG", 2, "m"], ["NAH", "HAK", 2, "m"], ["NIN", "NAG", 2, "pm"], ["NIN", "HAK", 3, "pm"], ["HAK", "NAG", 1, ""],
];
export const LANES = LANE_ROWS.map(([a, b, days, f, via], i) => ({ i, a: P(a), b: P(b), days, f, via: via || null }));

/** ADJ[p] = lanes from p: { to, days, f, lane, east } (east: sailing this way is eastward, for the monsoon). */
export const ADJ = PORTS.map(() => []);
for (const l of LANES) {
  const east = PORTS[l.b].x > PORTS[l.a].x;
  ADJ[l.a].push({ to: l.b, days: l.days, f: l.f, lane: l.i, east });
  ADJ[l.b].push({ to: l.a, days: l.days, f: l.f, lane: l.i, east: !east });
}

/** The goods: 0 pepper, 1 silk, 2 silver, 3 spice, 4 fur, 5 gold, and the ports they come from. `late` sources wake with an event. */
export const GOODS = [
  { id: "pepper", name: "Pepper", src: ["CAL", "ACE", "BAN"] },
  { id: "silk", name: "Silk", src: ["NIN", "GUA", "ALP", "VEN"] },
  { id: "silver", name: "Silver", src: ["ANT", "HAK", "SEV"], late: { HAK: "iwami", SEV: "potosi" } },
  { id: "spice", name: "Spices", src: ["BDA", "TER", "COL"] },
  { id: "fur", name: "Furs", src: ["NOV", "REV", "LUB"] },
  { id: "gold", name: "Gold", src: ["ELM", "SOF", "KIL"] },
].map(g => ({ ...g, ports: g.src.map(P) }));

/** Ports by region. */
export const BY_REGION = REGIONS.map((_, r) => PORTS.filter(p => p.region === r).map(p => p.i));

// Label boxes at 8px type (about 4.6px a letter): where a port's name sits, for the overlap test and the page.
export const LABEL = { charW: 4.6, h: 8, dot: 3.5 };
export function labelBox(p) {
  const w = p.name.length * LABEL.charW, h = LABEL.h, g = LABEL.dot + 1;
  switch (p.lab) {
    case "e": return { x: p.x + g, y: p.y - h / 2, w, h };
    case "w": return { x: p.x - g - w, y: p.y - h / 2, w, h };
    case "n": return { x: p.x - w / 2, y: p.y - g - h, w, h };
    case "s": return { x: p.x - w / 2, y: p.y + g, w, h };
    case "ne": return { x: p.x + 1, y: p.y - g - h, w, h };
    case "nw": return { x: p.x - 1 - w, y: p.y - g - h, w, h };
    case "se": return { x: p.x + 1, y: p.y + g, w, h };
    default: return { x: p.x - 1 - w, y: p.y + g, w, h };
  }
}
