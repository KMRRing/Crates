// Gambit's computer players: Stockfish at eight strengths, named by rough rating (tools/engine-levels.mjs plays them
// against each other; README, Gambit, has how they were measured). The two weakest draw among the engine's best few
// moves after a small search, likelier the less a move gives up (choose() in uci.js), so they blunder as people do;
// from 1,320, the floor of Stockfish's own limiter (UCI_Elo), the limiter plays, rated as Stockfish rates it, and the
// strongest is the engine at full strength. Each searches a set number of positions, not for a set time, so a level
// is as strong on a slow phone as on a fast one.

export const LEVELS = [
  { id: "1", name: "Beginner", rating: 700, limit: "nodes 600", multipv: 12, temper: 300 },
  { id: "2", name: "Novice", rating: 1100, limit: "nodes 1000", multipv: 10, temper: 140 },
  { id: "3", name: "Casual", rating: 1300, limit: "nodes 60000", elo: 1320 },
  { id: "4", name: "Club", rating: 1600, limit: "nodes 60000", elo: 1600 },
  { id: "5", name: "Strong club", rating: 1900, limit: "nodes 80000", elo: 1900 },
  { id: "6", name: "Expert", rating: 2200, limit: "nodes 120000", elo: 2200 },
  { id: "7", name: "Master", rating: 2500, limit: "nodes 150000", elo: 2500 },
  { id: "8", name: "Full strength", rating: 3000, limit: "nodes 800000" },
];
export const levelById = id => LEVELS.find(l => l.id === String(id)) || LEVELS[2];
/** The coach's search: a position's best three moves (a hint, the advice, the check) at full strength, a second or
 *  two on a phone, and a move outside them searched alone (alone). */
export const HINT = { limit: "nodes 400000", alone: "nodes 200000" };
/** The review's search of each position of a finished game. */
export const REVIEW = { limit: "nodes 60000" };
