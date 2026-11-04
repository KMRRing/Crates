// Netting's levels, plain data (rules: netting-engine.js). Four sections, each adding one thing to the one before:
// one currency, two currencies (credit only flows where houses share one), lines (a house opens a currency it lacks,
// for 2 of its limit), interest. A level is one charter (a goal), a fixed number of hands, a par for three stars, and
// `seeds`: games a bot was shown to win, so a game is never dealt that can't be (tests/netting.mjs checks them).
//
// Level = { id, name, note (under the table at the start), houses: [{ n, cur: [currency ids] }], limit (most net debt a
// house may carry; 10), start: [[from, to, amount]] (debts to begin with, no loop), hands (dealt in all; 0 for no end),
// amount (largest obligation; 3) or pace (growing as in the endless game), fixed: [[{ from, amount } × 3]] (authored
// hands, in place of dealt ones), weights (how often each house issues), fade (how far those weights level out by the
// last hand), handCap (most one hand may load on one house), lives (1), charter: { type: gross | loops | span | clear |
// hold | endless, n }, stars: [gross for two, for three] (hold), par (bookings for three stars), features: { lines,
// interest }, seeds }

/** The currencies: a mark that says which (colour is never all of it) and an enamel from style.css. */
export const CURRENCIES = [{ name: "USD", mark: "$", color: "--c0" }, { name: "EUR", mark: "€", color: "--c1" }, { name: "CNY", mark: "¥", color: "--c2" }];

const four = cur => ["GVA", "LON", "SIN", "HOU"].map((n, i) => ({ n, cur: cur[i] }));
const six = cur => ["GVA", "LON", "SIN", "HOU", "RTM", "SHA"].map((n, i) => ({ n, cur: cur[i] }));
const one4 = four([[0], [0], [0], [0]]);
const one5 = ["GVA", "LON", "SIN", "HOU", "RTM"].map(n => ({ n, cur: [0] }));
// two zones joined by two houses that trade in both
const two6 = six([[0], [0], [0, 1], [1], [1], [0, 1]]);
// three currencies: USD west, CNY east, EUR between
const three6 = six([[0], [0, 2], [2], [2, 1], [1], [0, 1]]);

export const SECTIONS = [
  { id: 1, name: "One currency", blurb: "Everyone trades in dollars. Book each obligation so no house runs past its limit.", levels: [
    { id: "1-1", name: "The hub", note: "SIN issues about twice as often as the rest. Spread what it owes before it passes its limit.", houses: one4, limit: 8, weights: [1, 1, 2, 1], fade: 0.8, start: [[0, 1, 2], [1, 2, 2]], hands: 6, charter: { type: "hold", n: 28 }, stars: [34, 42], par: 18, seeds: [1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27] },
    { id: "1-2", name: "Round the corner", note: "Net eight loops. A loop needs a way back from the creditor to the debtor.", houses: one4, limit: 8, weights: [1, 1, 1, 1], start: [[0, 1, 2], [1, 2, 2]], hands: 9, charter: { type: "loops", n: 8 }, par: 24, seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25] },
    { id: "1-3", name: "Five houses", note: "Cancel enough gross to pass. Longer loops cancel more.", houses: one5, limit: 8, weights: [1, 2, 1, 2, 1], fade: 0.6, start: [[0, 1, 2], [1, 2, 3], [3, 4, 2]], hands: 7, charter: { type: "hold", n: 40 }, stars: [48, 60], par: 21, seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 22, 23, 25, 27, 28] },
  ] },
  { id: 2, name: "Two currencies", blurb: "Credit only flows between houses that share a currency. Without one, it goes through a middle house.", levels: [
    { id: "2-1", name: "Two zones, two bridges", note: "RTM and LON issue most. Each sits in one zone, so relief has to cross a bridge: SIN or SHA.", houses: two6, limit: 8, weights: [1, 2.2, 1, 1, 2.2, 1], fade: 0.6, start: [[0, 1, 2], [1, 2, 2], [3, 4, 2], [4, 5, 2]], fixed: [[{ from: 2, amount: 2 }, { from: 1, amount: 2 }, { from: 3, amount: 1 }]], hands: 6, charter: { type: "hold", n: 40 }, stars: [48, 60], par: 18, seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 17, 18, 19, 20, 21, 22, 23, 25, 26, 27] },
    { id: "2-2", name: "Across the divide", note: "Close a loop through five houses; it has to cross both bridges.", houses: two6, limit: 8, weights: [1, 1, 1, 1, 1, 1], start: [[0, 1, 2], [3, 4, 2]], hands: 8, charter: { type: "span", n: 5 }, par: 18, seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27] },
    { id: "2-3", name: "Hard on the bridges", note: "The bridges carry everything. Keep them clear of debt.", houses: two6, limit: 8, weights: [1, 1, 1.5, 1.5, 1, 1], fade: 0.5, start: [[0, 1, 2], [1, 2, 2], [3, 4, 2], [4, 5, 2]], hands: 8, charter: { type: "hold", n: 56 }, stars: [68, 84], par: 24, seeds: [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25] },
  ] },
  { id: 3, name: "Credit lines", blurb: "Tap a house to open a currency it lacks. It costs 2 of its limit, for good.", levels: [
    { id: "3-1", name: "Three currencies", note: "Dollars, euros and yuan. A house with no shared currency needs a middle house.", houses: three6, limit: 8, weights: [1, 1, 2, 1, 1, 2], fade: 0.6, start: [[0, 1, 2], [3, 4, 2]], hands: 7, charter: { type: "hold", n: 44 }, stars: [53, 66], par: 21, features: { lines: true }, seeds: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26] },
    { id: "3-2", name: "A line to the east", note: "Open the right line and a far house becomes a neighbour.", houses: three6, limit: 8, weights: [1, 1, 1, 1, 1, 1], start: [[0, 1, 2], [1, 2, 2], [3, 4, 2]], hands: 8, charter: { type: "span", n: 5 }, par: 18, features: { lines: true }, seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26] },
    { id: "3-3", name: "Thin limits", note: "Every line costs. Open only what pays for itself.", houses: three6, limit: 7, weights: [1, 1.5, 1.5, 1, 1.5, 1.5], fade: 0.5, start: [[0, 1, 2], [3, 4, 2], [4, 5, 2]], hands: 8, charter: { type: "hold", n: 56 }, stars: [68, 84], par: 24, features: { lines: true }, seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25] },
  ] },
  { id: 4, name: "Interest", blurb: "An obligation left standing for four hands grows by one. The ring round its amount fills.", levels: [
    { id: "4-1", name: "Stale debt", note: "Obligations parked where no loop will come for them grow. Net them or move them.", houses: three6, limit: 8, weights: [1, 1, 2, 1, 1, 2], fade: 0.6, start: [[0, 1, 2], [1, 2, 2], [3, 4, 2], [4, 5, 2]], hands: 8, charter: { type: "hold", n: 58 }, stars: [70, 87], par: 24, features: { lines: true, interest: true }, seeds: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25] },
    { id: "4-2", name: "Two lives", note: "A default costs a life, and there are two. The interest comes with the new hand.", houses: three6, limit: 8, weights: [1.5, 1, 1.5, 1, 1.5, 1], fade: 0.4, start: [[0, 1, 2], [1, 2, 2], [3, 4, 2]], hands: 10, lives: 2, charter: { type: "hold", n: 80 }, stars: [96, 120], par: 30, features: { lines: true, interest: true }, seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26] },
    { id: "4-3", name: "Clear the books", note: "Net every debt on the table to nothing.", houses: three6, limit: 8, weights: [1, 1, 1, 1, 1, 1], start: [[0, 1, 2], [1, 2, 2], [3, 4, 2], [4, 5, 2], [0, 3, 1]], hands: 12, charter: { type: "clear" }, par: 24, features: { lines: true, interest: true }, seeds: [2, 3, 5, 8, 9, 12, 14, 15, 16, 18, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 42, 45, 47, 48] },
  ] },
];
/** The endless game: all of it, three lives, obligations growing as it goes on; the score is the thing. */
export const ENDLESS = { id: "endless", name: "Endless", note: "Drag an obligation onto the house it is owed to. A loop back round to its debtor nets out, and scores.", houses: three6, limit: 10, pace: true, hands: 0, lives: 3, charter: { type: "endless" }, features: { lines: true, interest: true } };

export const LEVELS = SECTIONS.flatMap(s => s.levels);
export const levelById = id => (id === ENDLESS.id ? ENDLESS : LEVELS.find(l => l.id === id));
