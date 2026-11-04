# Chess School (chess.html)

4 November 2026, Korbi asked for a course in chess for someone who knows the moves vaguely: from the board to a game, reached from Chess's menu ("Learn Chess") and as a tile among the courses, ending in a game against the weakest level.

- **Answers are proved, not trusted.** A puzzle's stored answer is recomputed by `tests/chess-course.mjs` and `tests/chess-puzzles.mjs` with Gambit's move generator (a mate by search, a win of material by a three-ply search with the captures played out, a king and pawn ending by the full solution in `chess-kpk.js`). A new puzzle needs its goal checked there. The searched ones are in the second test, which takes about half a minute and so runs nightly, not on every push.
- **`chess-kpk.js` is for tests only.** No page imports it and no lesson names it in a string; the offline list (`tools/offline.mjs`) would otherwise carry its table to every phone.
- **"Best by material" is a search, not the truth.** A `best` step says what wins most material within three plies; keep such puzzles to ones where a quiet move cannot undo it.
- **The lesson files never touch Gambit's engine or levels.** The last step opens `gambit.html?moves=…&level=1`; `gambit.js` replays the moves through `replay` first and asks before it replaces a game in progress.
