// Dandan on seats.js: a module of pure functions, so one runner moves it solo or at a table (README, Seats). Two
// seats; the computer takes the one nobody sits in. Whose decision it is: whoever holds priority, or is asked a question.
import { deal, toMove, act, restore } from "./dandan-engine.js";
import { botMove } from "./dandan-bot.js";

export const rules = {
  id: "dandan",
  seats: { min: 2, max: 2 },
  deal: ({ rng, prev }) => deal({ rng, prev }),
  toMove,
  act: (s, seat, move, ctx) => act(s, seat, move, ctx),
  bot: (s, seat, ctx) => botMove(s, seat, ctx),
  over: s => s.over,
  restore,
};
