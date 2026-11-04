// The Chess course's searched puzzles (a win of material, a mate in several): each stored answer is recomputed by searching the game
// tree with Gambit's move generator, and each step is taken to its end with the wrong moves given their reasons. Slow, so the nightly run's.
globalThis.CHESS_HEAVY = true;
await import("./chess-course-run.js");
