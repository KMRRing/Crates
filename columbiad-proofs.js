// The shots each level was proved solvable by (tools/columbiad-bench.mjs write): the most robust the bench found, with the share
// of 200 scattered runs that won ("rob") and how far inside the ring it passes at no scatter ("margin": 1 is the middle, 0 the edge).
// t is the firing time (a moving world's clock; 0 where nothing moves). tests/columbiad.mjs fires every one and it must still win: a
// change to the rules or a level that breaks one is caught there.
export const PROOFS = {
  "1-1": [{ angle: 74, charge: 8.7, t: 0, rob: 1, margin: 0.54 }],
  "1-2": [{ angle: 69, charge: 11.2, t: 0, rob: 1, margin: 1 }],
  "1-3": [{ angle: 58, charge: 11.8, t: 0, rob: 1, margin: 0.97 }, { angle: 178, charge: 11.8, t: 0, rob: 1, margin: 0.89 }],
  "1-4": [{ angle: 167, charge: 11.3, t: 0, rob: 0.95, margin: 0.97 }, { angle: 23, charge: 10.8, t: 0, rob: 0.89, margin: 0.95 }],
  "1-5": [{ angle: 4, charge: 12.2, t: 0, rob: 0.9, margin: 0.93 }, { angle: 47, charge: 11.8, t: 0, rob: 0.68, margin: 0.92 }],
  "1-6": [{ angle: 150, charge: 12.7, t: 0, rob: 0.72, margin: 1 }, { angle: 17, charge: 11.5, t: 0, rob: 0.67, margin: 0.98 }],
  "2-1": [{ angle: 84.5, charge: 14.96, t: 0, rob: 1, margin: 0.85 }, { angle: 84.5, charge: 15.6, t: 0, rob: 1, margin: 0.85 }],
  "2-2": [{ angle: 82, charge: 15.65, t: 0, rob: 0.93, margin: 0.98 }, { angle: 88.5, charge: 15.58, t: 0, rob: 0.91, margin: 0.99 }],
  "2-3": [{ angle: 96.5, charge: 15.05, t: 0, rob: 1, margin: 1 }, { angle: 92.5, charge: 15.09, t: 0, rob: 0.98, margin: 0.99 }],
  "2-4": [{ angle: 82, charge: 15.53, t: 0, rob: 0.96, margin: 0.99 }, { angle: 88.56, charge: 15.3, t: 0, rob: 0.44, margin: 0.98 }],
  "2-5": [{ angle: 99.5, charge: 15.48, t: 0, rob: 0.85, margin: 0.97 }, { angle: 105.13, charge: 15.31, t: 0, rob: 0.47, margin: 1 }],
  "3-1": [{ angle: 127.94, charge: 15.66, t: 6.09, rob: 1, margin: 0.92 }, { angle: 34.5, charge: 15.9, t: 28.09, rob: 1, margin: 0.92 }],
  "3-2": [{ angle: 84.56, charge: 15.5, t: 20, rob: 0.99, margin: 0.88 }, { angle: 125, charge: 15.64, t: 28, rob: 0.99, margin: 0.88 }],
  "3-3": [{ angle: 88.58, charge: 15.9, t: 32, rob: 1, margin: 1 }, { angle: 128, charge: 15.9, t: 1, rob: 1, margin: 1 }],
  "3-4": [{ angle: 76.63, charge: 15.8, t: 12, rob: 1, margin: 0.85 }, { angle: 50.19, charge: 15.8, t: 6.09, rob: 0.99, margin: 0.85 }],
  "4-1": [{ angle: 100.5, charge: 14.6, t: 28.05, rob: 1, margin: 0.93 }, { angle: 110.75, charge: 14.95, t: 30.2, rob: 1, margin: 0.93 }],
  "4-2": [{ angle: 115.69, charge: 15.25, t: 14.01, rob: 1, margin: 0.92 }, { angle: 125.5, charge: 15.25, t: 11.7, rob: 1, margin: 0.92 }],
  "4-3": [{ angle: 110.5, charge: 15.55, t: 32, rob: 1, margin: 0.89 }, { angle: 120.94, charge: 15.65, t: 34.03, rob: 1, margin: 0.89 }],
  "5-1": [{ angle: 84.5, charge: 14.96, t: 0, rob: 1, margin: 0.82 }, { angle: 90.5, charge: 15.05, t: 0, rob: 0.95, margin: 0.82 }],
  "5-2": [{ angle: 84, charge: 14.8, t: 0, rob: 0.66, margin: 0.89 }, { angle: 89, charge: 14.9, t: 0, rob: 0.6, margin: 0.89 }],
  "5-3": [{ angle: 82.75, charge: 15.88, t: 0, rob: 1, margin: 0.83 }, { angle: 86.75, charge: 15.96, t: 0, rob: 1, margin: 0.98 }],
  "5-4": [{ angle: 84, charge: 15.18, t: 0, rob: 0.84, margin: 0.5 }, { angle: 87.5, charge: 14.92, t: 0, rob: 0.53, margin: 0.5 }],
  "5-5": [{ angle: 90.5, charge: 14.95, t: 0, rob: 0.7, margin: 0.5 }, { angle: 79, charge: 15, t: 0, rob: 0.68, margin: 0.5 }],
  "5-6": [{ angle: 85.75, charge: 15.37, t: 0, rob: 0.91, margin: 0.75 }, { angle: 94.5, charge: 15.43, t: 0, rob: 0.72, margin: 0.64 }],
};
