// What Solitaire counts: played and won, a variant at a time. A game is played from the player's first move, so it is a
// loss from then on and a win only if it is won; leaving it, dealing again or closing the app changes nothing.
// Pure functions of the saved records, so a test can play a season of games on them.

/** { played, wins } of a variant. `times` is the older record of wins by variant, which stands for both until a game is counted. */
export const statsOf = (all, times, id) => all?.[id] || { played: times?.[id]?.wins || 0, wins: times?.[id]?.wins || 0 };

/** The records after `played` more games played and `wins` more won. → a new record of all variants. */
export function addStats(all, times, id, played, wins) {
  const t = statsOf(all, times, id);
  return { ...(all || {}), [id]: { played: t.played + played, wins: t.wins + wins } };
}

/** Every win of every variant: the games screen's tile. */
export const totalWins = (all, times, ids) => ids.reduce((n, id) => n + statsOf(all, times, id).wins, 0);

/**
 * One game's life against the records: `first()` at the player's first move, `won()` when it is won. A game given up,
 * or whose app was closed, never calls won; one saved and picked up again keeps `counted` and `scored`, so it counts once.
 * `practice` is a day's deal already won: it counts neither way.
 */
export function life(game, practice = false) {
  return {
    first: () => { if (game.counted || practice) return null; game.counted = true; return { played: 1, wins: 0 }; },
    won: () => { if (!game.counted || game.scored || practice) return null; game.scored = true; return { played: 0, wins: 1 }; },
  };
}
