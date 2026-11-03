# Draughts
Draughts (checkers), 3 November 2026: against the computer, two on one phone, or a partner's match and a table of friends (seats.js). Added 2 November 2026 (Korbi: "draughts").

**Rule sets** are data (`SETS` in `crown-board.js`): English (8x8, men step and capture forward only, kings one square, any capture will do, a man reaching the far row is crowned and stops), International (10x10, men capture backwards, kings fly, the longest capture is compulsory), Brazilian (International's rules on 8x8) and Russian (8x8, flying kings, any capture will do, a man crowned in mid-jump goes on as a king). Sources: the WCDF's English rules, the FMJD's International rules; Russian and Brazilian are the federations' published rules. Rules belong to no one; the engine, tables and puzzles are our own, nothing is vendored and no other engine (Scan is GPL) was read or run.

- 3 November 2026, Korbi left Crown's questions to the session: the tile shows a daily-shot streak (not a time); draws follow the official rules above; Flank nothing.

**Traps**
- A piece captured in a run stays on the board until the run ends: it blocks, and cannot be jumped twice. The square the runner left counts as empty.
- A flying king that can go on jumping from some landing must land on one of those; the longest-capture filter comes after generation, a king counting one piece.
- Ink always moves first and sits at the bottom; "you" chooses the side, not the board's orientation. A dark square is at each player's left.
- Draws follow the federations' general rules: the third occurrence of a position with the same side to move, or no capture and no man moved for 40 moves each (English, WCDF), 25 (International, FMJD: kings only), 20 (Brazilian), 15 (Russian) (`quiet` in `SETS`, in plies). The endgame specials (FMJD's 16-move and Russian's 3-kings-v-1 rules) are not implemented, from memory of the rule books, not checked against the texts. A draw by agreement exists only on one phone (two people); it is never offered to the computer.
- The games screen's tile shows the streak of days the shot of the day was solved (`crown:streak`, `dayStreak`); the run of games won against the computer is `crown:run`.
- The computer's levels are node budgets, not clocks, so a level plays the same on every phone. Hard needs the worker (`crown-worker.js`); the page falls back to the same search on the main thread, which holds the screen for a moment.
- The daily shot is one puzzle from `crown-puzzles.js`, whose answers the search proved (`tools/crown-puzzles.mjs`); regenerate with it, never edit by hand.
