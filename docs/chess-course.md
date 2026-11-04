# Chess lessons (Menu, Learn, in Chess)

A course in chess for someone who knows the moves vaguely: from the board to a game against the weakest level. It runs on the suite's course sheet (`course.js`) inside `gambit.html`, with Chess's own board and rules; `chess.html` only forwards old links to `gambit.html?learn=1`.

- 4 November 2026 (Korbi): "Chess school should be part of chess, which should be called chess, it should be a 'lessons' tab accessible there same as any other lesson for these game". So no tile of its own: Menu, Learn, as Mahjong's and Guandan's. The progress key stays `chess:course` (the tile's `chess:lessons` is gone).

- **Answers are proved, not trusted.** A puzzle's stored answer is recomputed by `tests/chess-course.mjs` and `tests/chess-puzzles.mjs` with Gambit's move generator (a mate by search, a win of material by a three-ply search with the captures played out, a king and pawn ending by the full solution in `chess-kpk.js`). A new puzzle needs its goal checked there. The searched ones are in the second test, which takes about half a minute and so runs nightly, not on every push.
- **`chess-kpk.js` is for tests only.** No page imports it, so the table (built by search when loaded) is never built on a phone; keep it that way.
- **"Best by material" is a search, not the truth.** A `best` step says what wins most material within three plies; keep such puzzles to ones where a quiet move cannot undo it.
- **The lesson files never touch Gambit's engine or levels.** The last step starts a game through `startFrom` in `gambit.js`, which replays the moves first and asks before it replaces a game in progress.
