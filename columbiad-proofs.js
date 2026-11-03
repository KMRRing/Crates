// The shots each level was proved solvable by (tools/columbiad-bench.mjs write): the most robust the bench found, with the share
// of 200 scattered runs that won ("rob") and how far inside the ring it passes at no scatter ("margin": 1 is the middle, 0 the edge).
// tests/columbiad.mjs fires every one and it must still win: a change to the rules or a level that breaks one is caught there.
export const PROOFS = {
  "1-1": [{ angle: 74, charge: 8.7, t: 0, rob: 1, margin: 0.54 }],
  "1-2": [{ angle: 69, charge: 11.2, t: 0, rob: 1, margin: 1 }],
  "1-3": [{ angle: 58, charge: 11.8, t: 0, rob: 1, margin: 0.97 }, { angle: 178, charge: 11.8, t: 0, rob: 1, margin: 0.89 }],
  "1-4": [{ angle: 167, charge: 11.3, t: 0, rob: 0.95, margin: 0.97 }, { angle: 23, charge: 10.8, t: 0, rob: 0.89, margin: 0.95 }],
  "1-5": [{ angle: 4, charge: 12.2, t: 0, rob: 0.9, margin: 0.93 }, { angle: 47, charge: 11.8, t: 0, rob: 0.68, margin: 0.92 }],
  "1-6": [{ angle: 150, charge: 12.7, t: 0, rob: 0.72, margin: 1 }, { angle: 17, charge: 11.5, t: 0, rob: 0.67, margin: 0.98 }],
};
