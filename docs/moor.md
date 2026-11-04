# Moor
Tents (trees and tents), as docks and barges (4 November 2026). Moor a barge beside every dock: exactly one barge per dock, orthogonally next to it (never diagonally); no two barges touch, not even at a corner; the numbers round the board say how many barges lie in each row and column. Every puzzle has exactly one answer, reached by reasoning, never by a guess. Sizes 6×6 to 14×14, four levels, a daily (8×8 Medium), Random, seed links, hints (+30 s). Page: `moor.js`, rules and solver `moor-engine.js`, puzzles made in `moor-worker.js`, the harbour `moor-3d.js`. No co-op, head-to-head or Party yet.

## Rulings
- 4 November 2026: "tents is good with ship and docks ... these should be the optional 3d modes. there should be the simple 2d mode, and then the toggle for the 3d, similar to bridges." The 2D board is the game; 3D (the tool under the board, the menu's Play in 3D) is the same run drawn as a harbour, a timber quay with the counts painted on it, docks on piles, barges on the water.

## Traps
- **Levels are the hardest step a person needs.** Easy: the plain rules. Medium: also a dock's few places and the cells touching all of them. Hard: also a cell tested at once (a barge here would leave a row without room, or a dock without a partner). Expert: a trial, a cell supposed one way and the plain rules followed until a rule breaks. A 6×6 has no Expert (`levelOn`); where a size cannot give the level, the nearest is dealt and the line says so.
- **The solver reads the grid and the counts, never the answer.** The answer's counts are the clues. A barge must match a dock beside it one-to-one (Kuhn matching in `broken`), which is why a barge touching two docks is not a clue to which is its own.
- **The hint reasons from the docks alone**, not from the player's water notes: it names the first barge a person could find that is not yet moored, so the cells it rings are true whatever the player marked. A wrong mark is put right first.
- **Water dots are notes**; only barges count, and a solve is the moment exactly the answer's barges are moored.
- **The 3D view only shows the run**: it has no state of its own (`prefs.view` in `moor:prefs` keeps 2D or 3D). Only checked in Chromium (SwiftShader); no SVG filters, WebGL pixel ratio capped at 2.
