# Gambit
Chess against Caissa (MIT, `vendor/caissa/NOTE.txt`) at one of eight strengths, two players on one phone, or a match with your partner. The same engine is the coach (hints, a word after a mistake) and reviews the finished game. The rules are chess.js's (`vendor/chess.js`); `gambit-rules.js` keeps a game as plain JSON, changed only by `act()`. The puzzle rush (Menu, Puzzle rush) is a page of its own, `rush.html`, under Gambit's header, on 20,000 Lichess puzzles (CC0) in `puzzles/`.

## Rulings
- 2 November 2026 (Korbi, licences): prefer a permissive engine, and in the worst case no engine at all, only puzzles. Stockfish (GPL v3) is gone from Gambit for that reason; `tests/gambit-licences.mjs` fails if a GPL engine file comes back.

## Traps
- **Every search needs a limit.** The engine is single-threaded (GitHub Pages can't send the headers `SharedArrayBuffer` needs) and a `go` runs to its end inside the worker's call, so `go infinite` or a bare `go` wedges it. The levels, the hint and the review all search a set number of positions, never a time, so a slow phone plays as strongly as a fast one.
- **Caissa has none of Stockfish's options.** `Skill Level`, `UCI_LimitStrength` and `UCI_Elo` are dropped by `gambit-caissa.js`; a level's strength is its node count and, for the weaker ones, `choose()` drawing among the MultiPV lines at a temper. A search that stops on its node limit may have finished fewer MultiPV lines than asked (about 150 positions per line at depth 1), so a level that draws among 12 moves needs about 2,000 nodes. `bestmove` can be a move none of the last lines starts with; `levelMove` uses `best` only when no draw is made.
- **The 76 MB network is held once**: the worker unpacks `caissa.pnn.z` straight into the engine's own memory (`net_alloc`). Changing the network or the build is a deliberate act: re-measure the levels (`vendor/caissa/NOTE.txt` has the hashes the test checks).
- **WebAssembly SIMD** needs Safari / iOS 16.4; the page's engine can't start on older ones ("The computer player couldn't start").
- A Lichess puzzle's first move is the opponent's; the solution starts at the second.
- The rush's wanted-move square was once classed `hint`, which picked up the suite's clue-button style and grew far past the board; it is `want`.
- The rush keeps its own identity (keys `rush:`, what a partner sees, the battle's requests): they go by a page's name, so it isn't a part of `gambit.html`.
