// Gambit's computer players: Stockfish at eight strengths, named by rough rating (tools/engine-levels.mjs plays them
// against each other; README, Gambit, has how they were measured). Below Stockfish's own limiter (UCI_Elo starts at
// 1320) a level draws among the engine's best few moves after a small search, likelier the less a move gives up
// (choose() in uci.js), so it blunders as people do; the rest are the limiter or the engine's full strength, each
// searching a set number of positions, so a level is as strong on a slow phone as on a fast one.

export const LEVELS = [
  { id: "1", name: "Beginner", rating: 400, limit: "nodes 600", multipv: 12, temper: 300 },
  { id: "2", name: "Novice", rating: 700, limit: "nodes 1200", multipv: 10, temper: 160 },
  { id: "3", name: "Casual", rating: 1000, limit: "nodes 3000", multipv: 8, temper: 80 },
  { id: "4", name: "Club", rating: 1300, limit: "nodes 8000", multipv: 6, temper: 40 },
  { id: "5", name: "Strong club", rating: 1600, limit: "nodes 50000", elo: 1600 },
  { id: "6", name: "Expert", rating: 1900, limit: "nodes 80000", elo: 1900 },
  { id: "7", name: "Master", rating: 2200, limit: "nodes 150000", elo: 2200 },
  { id: "8", name: "Full strength", rating: 3000, limit: "nodes 800000" },
];
export const levelById = id => LEVELS.find(l => l.id === String(id)) || LEVELS[2];
/** The coach's search for a hint: the engine at full strength, a second or two on a phone. */
export const HINT = { limit: "nodes 400000" };
/** The review's search of each position of a finished game. */
export const REVIEW = { limit: "nodes 60000" };
