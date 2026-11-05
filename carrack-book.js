// Carrack's opening book: the first two years' orders for each power, found by tools/carrack-book.mjs (candidate plans played
// over the same games against Medium players, the best mean standing kept). The expert adds a year's entry to its own
// candidates (so it only sets it when the search finds it as good); [] is no entry (the planner's own play was best).
// Orders name ports by code, so the book reads as the map does.
import { IDX } from "./carrack-map.js";
import { POWERS } from "./carrack-rules.js";

export const BOOK = {
  hanse: [[{ t: "factor", port: "LON" }, { t: "factor", port: "NOV" }, { t: "move", from: "LUB", to: "ANT", n: 1 }], []],
  portugal: [[], [{ t: "factor", port: "SAO" }, { t: "move", from: "ANT", to: "LUB", n: 1 }, { t: "factor", port: "LUB" }]],
  venice: [[{ t: "move", from: "VEN", to: "ALE", n: 1 }, { t: "move", from: "VEN", to: "CON", n: 2 }, { t: "claim", port: "CON" }], [{ t: "claim", port: "ALE" }, { t: "move", from: "CON", to: "ALP", n: 1 }, { t: "factor", port: "ALP" }]],
  ottomans: [[{ t: "move", from: "CON", to: "VEN", n: 3 }, { t: "factor", port: "VEN" }], [{ t: "move", from: "VEN", to: "SEV", n: 3 }, { t: "factor", port: "SEV" }]],
  ming: [[{ t: "move", from: "NIN", to: "HAK", n: 1 }, { t: "factor", port: "HAK" }, { t: "move", from: "GUA", to: "MNL", n: 1 }], []],
  gujarat: [[{ t: "move", from: "CAM", to: "GOA", n: 1 }, { t: "factor", port: "GOA" }], []],
  malacca: [[{ t: "move", from: "MLC", to: "TER", n: 1 }, { t: "factor", port: "TER" }, { t: "build", port: "MLC" }], [{ t: "move", from: "TER", to: "BDA", n: 1 }, { t: "factor", port: "BDA" }, { t: "move", from: "MLC", to: "ACE", n: 1 }]],
  ryukyu: [[{ t: "build", port: "NAH" }, { t: "move", from: "NAH", to: "HAK", n: 1 }, { t: "factor", port: "HAK" }], [{ t: "claim", port: "HAK" }, { t: "move", from: "NAH", to: "MNL", n: 1 }, { t: "factor", port: "MNL" }]],
  swahili: [[{ t: "move", from: "MOM", to: "SOF", n: 1 }, { t: "claim", port: "SOF" }], [{ t: "build", port: "SOF" }, { t: "move", from: "KIL", to: "MAL", n: 1 }]],
};

/** The book's orders for a seat's power in this year, as the rules take them ([] when there are none). */
export function bookOrders(s, seat) {
  const e = BOOK[POWERS[s.pw[seat]].id]?.[s.round - 1];
  return (e || []).map(o => {
    const r = { t: o.t };
    for (const k of ["port", "from", "to"]) if (o[k] != null) r[k] = IDX[o[k]];
    if (o.n != null) r.n = o.n;
    return r;
  });
}
