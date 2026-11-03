// Go's computer players: a level is a number of looks of the network at the board (never a clock, so a slow phone plays as
// strongly as a fast one) and how loosely the move is drawn from them. A bigger board costs more per look, so it gets fewer.

export const LEVELS = [
  { id: "novice", name: "Novice", visits: 1, temperature: 1.6, note: "Plays the net's first thought, often a poor one" },
  { id: "casual", name: "Casual", visits: 1, temperature: 0.8, note: "The net's first thought, mostly sensible" },
  { id: "club", name: "Club", visits: 6, temperature: 0.6, note: "A few looks ahead, still wanders" },
  { id: "keen", name: "Keen", visits: 24, temperature: 0.35, note: "Reads the fights" },
  { id: "strong", name: "Strong", visits: 64, temperature: 0, note: "Plays its best move of a good search" },
  { id: "master", name: "Master", visits: 160, temperature: 0, note: "The deepest search this phone is asked for" },
];
export const DEFAULT_LEVEL = "keen";
export const levelOf = id => LEVELS.find(l => l.id === id) || LEVELS.find(l => l.id === DEFAULT_LEVEL);

// 9x9 at full count, 13x13 three quarters, 19x19 half (a look costs about 4 times as much on 19x19 as on 9x9)
const SIZE_SHARE = { 9: 1, 13: 0.75, 19: 0.5 };
export function visitsFor(level, size) {
  const l = typeof level === "string" ? levelOf(level) : level;
  return l.visits <= 1 ? 1 : Math.max(2, Math.round(l.visits * (SIZE_SHARE[size] ?? 0.5)));
}
