# Solitaire

Klondike (draw one or three), FreeCell and Spider (one, two or four suits), each with a deal of the day and no opponent. `solitaire-engine.js` is the rules, `solitaire-solver.js` (run in `solitaire-worker.js`) the deals and hints, `solitaire-board.js` the table that the page and the course (`solitaire-course.js`) both draw and touch, `solitaire.js` the run, clock and records.

- 2 November 2026, Korbi: "solitaire, 2048, connect four: ok, add placeholders". Built to the placeholder's specification: a daily deal per variant, deals a solver can win, a hint, unlimited undo, auto-move, a short course.

## Traps

- **A day's deal is a search result.** The deal is `shuffled(id, key, tryNo)`, `tryNo` being the first shuffle of that key the solver wins (cached per device in `solitaire:deals`). Anything that changes what the solver wins (its search, its heuristics, `DEAL_BUDGET`, the safe-auto rule it shares with the engine, `shuffled`) changes every day's deal, for everyone, mid-day. Budgets are in positions, never milliseconds, so every device finds the same try.
- **The solver and the engine share one rule** for cards that go up of themselves (`autoStep(s, "safe")`: an ace, a two, or a card whose two opposite-colour cards a rank lower are up). The solver's lines have those moves written in; change one and the other.
- **Four-suit Spider is not checked** (`CHECKED` in the engine): the solver wins about one deal in forty, too few to find one while a player waits. It is the day's shuffle as it falls, and the menu says some can't be won. Two-suit Spider is checked, at a few seconds a deal on a phone, hence the spare deal looked for in a second worker.
- **Rules where sets differ:** Klondike has unlimited passes through the stock and lets a card come back down from a foundation; FreeCell and Spider don't. FreeCell carries `(free cells + 1) × 2^empty columns` cards (one fewer power when the target is the empty column). Spider deals only with no empty column, and a king-to-ace run of one suit leaves the table by itself.
- **Undo is a group.** A move the game made on its own is stored with bit 19 set and undoes with the move before it. They run only after a move of the player's, so an ace dealt face up waits for the first move.
- **The streak** is what the games screen shows (`MARKS`: "streak", so the tile never opens `#today`). A win adds one; leaving a game for a new deal after `STARTED` (10) moves ends it; a day's deal won a second time is practice and isn't counted. A best time needs no hints.
