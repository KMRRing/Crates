# Reversi
Reversi on 8×8 (3 November 2026), against the computer (Easy, Medium, Hard), two on one phone, a partner's match or a table of friends (seats.js runs it), with a coach (Hint: the best move and who is ahead; the exact result once the last fourteen squares are in reach) and a Learn course.

Korbi, 2 November 2026, on the games screen's list: "othello". Othello is a trademark; Reversi, the 1880s game it came from, is a name anyone may use, and the tile is Reversi (3 November 2026, Korbi: official names unless trademarked; it was Flank). Never "Othello" in the game, its text or its code, and no green board (the board is lapis enamel in a brass frame).

Rules: the usual start (light on d4 and e5, dark on e4 and d5, dark first), a move must close at least one run, a side with no move passes (automatically: the move list is the whole game), the game ends when neither can move, and the winner has more discs as they stand: empty squares are not awarded to anyone. Rules belong to no one; nothing is vendored, no engine, book or table (`flank-board.js`, `flank-engine.js`, `flank-bot.js` are ours).

Traps:
- Perft (`tests/flank.mjs`) matches the published counts only if a pass counts as a ply.
- The runner calls `rules.bot()` synchronously, so the search runs in a worker (`flank-worker.js`) and its scores are primed into a memo (`prime`, `primed`, `flank-rules.js`) while the page `hold()`s the runner; a table without workers searches a capped amount in place. Levels are depths and slip rates, never time.
- Exact scores are the disc difference × 100 ± 20000, so a played-out result and a heuristic one compare.
- Two on one phone is not in seats.js: the page seats a second player (`players.p2`) in the solo table and moves for whoever's turn it is. Undo is an `anytime` move and is off at a table.
- `.hint` is style.css's generic class: the coach's square is `.fk-tip`.
- The course's numbers (discs, replies) are counted as the stage draws, never written in a lesson; `tests/flank-course.mjs` has the solver play out every puzzle, and `tools/flank-puzzles.mjs` finds them.

Not built: a daily puzzle (the soon-data entry asked for it and a 3D mode).
- 3D view (Menu, View): the board tipped away from you by CSS alone (`flank-3d.css`), flat the default, the choice the device's own (`suite:flank-view`); the discs keep their own turning.
- 3 November 2026, Korbi: "you decide, 3D mode: yes". Decided: no daily puzzle; the 3D mode goes to the 3D-modes agent.

**4 November 2026, Korbi: the menu is the minimum it needs to be.** The menu is Opponent (Computer or Two on this phone), Coach (on or off; a saved Always stays Always) and View. The computer's strength, You play and Mark the squares you may play are gone: the strength is the hidden ramp (`flank:ramp`, up a step after a win, down after a loss, the same after a draw; its first step is the level that was saved; a lesson's game plays Easy and leaves it alone), the colours alternate, the squares you may play are marked.
