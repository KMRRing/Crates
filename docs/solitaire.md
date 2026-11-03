# Solitaire

Klondike (draw one or three), FreeCell and Spider (one, two or four suits), each with a deal of the day and no opponent. `solitaire-engine.js` is the rules, `solitaire-solver.js` (run in `solitaire-worker.js`) the deals and hints, `solitaire-board.js` the table that the page and the course (`solitaire-course.js`) both draw and touch, `solitaire.js` the run, clock and records.

- 2 November 2026, Korbi: "solitaire, 2048, connect four: ok, add placeholders". Built to the placeholder's specification: a daily deal per variant, deals a solver can win, a hint, unlimited undo, auto-move, a short course.

- 3 November 2026, Korbi: "an abandoned game counts as a loss" (once started; the tile shows the win count; two-suit Spider certified by the solver, four-suit called "uncertified": "you decide for all").

## Traps

- **A day's deal is a search result.** The deal is `shuffled(id, key, tryNo)`, `tryNo` being the first shuffle of that key the solver wins (cached per device in `solitaire:deals`). Anything that changes what the solver wins (its search, its heuristics, `DEAL_BUDGET`, the safe-auto rule it shares with the engine, `shuffled`) changes every day's deal, for everyone, mid-day. Budgets are in positions, never milliseconds, so every device finds the same try.
- **The solver and the engine share one rule** for cards that go up of themselves (`autoStep(s, "safe")`: an ace, a two, or a card whose two opposite-colour cards a rank lower are up). The solver's lines have those moves written in; change one and the other.
- **Four-suit Spider is uncertified** (`CHECKED` in the engine): the solver wins about one deal in forty, too few to find one while a player waits. It is the day's shuffle as it falls, and the menu says "Uncertified: some deals cannot be won." Two-suit Spider is certified deal by deal (the seed, then the next try until the solver wins it, budgets in positions); one the solver can't win in 80 tries is dealt as it falls and called uncertified too. A second worker looks for the spare deal.
- **Rules where sets differ:** Klondike has unlimited passes through the stock and lets a card come back down from a foundation; FreeCell and Spider don't. FreeCell carries `(free cells + 1) × 2^empty columns` cards (one fewer power when the target is the empty column). Spider deals only with no empty column, and a king-to-ace run of one suit leaves the table by itself.
- **Undo is a group.** A move the game made on its own is stored with bit 19 set and undoes with the move before it. They run only after a move of the player's, so an ace dealt face up waits for the first move.
- **The win count** is what the games screen shows (`MARKS`: "wins", `solitaire:wins`, so the tile never opens `#today`). A game is played from the player's first move and is a loss until it is won, so a closed app is a loss and a resumed game won is one win (`solitaire-record.js`); a day's deal won a second time is practice and counted neither way. A best time needs no hints.
