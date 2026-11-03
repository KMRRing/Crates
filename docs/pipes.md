# Pipes
Lay pipe for the oil: every level is a board and a hand of pieces that must all fit one route from the wellhead to the terminal, with stars. The menu's Board chooses where: **Flat (square)** or the **Cube (3D map)**, a stack of floors where pieces also open up and down. From Pipe Dream (1989), by way of a fitting puzzle.

## Rulings
- 3 November 2026, the plan: "One best-effort level-based fitting puzzle for you to test-play; axed if it still is not fun." The queue board (Plan, Rush) and the old 3D shaft were cut the same day.
- 3 November 2026, Korbi: "pipes: the puzzle format is right. this same idea, for 3D."
- 4 November 2026, Korbi: "Sorry that's not what I meant by cube and dodecahedron. I meant it like the initial pipes 3d mode where the puzzle requires the user to place the pipe pieces in a 3d map instead of just a 2d one. Ignore the dodecahedron idea it's too ambitious, just cube and square then." The face-of-a-solid cube and the dodecahedron are gone; their saved keys (`pipes:cube`, `pipes:dodeca` and their stars) are deleted at start-up.

## Traps
- A level's `id` is its identity: stars (`pipes:stars`, `pipes:mapstars`) and runs (`pipes:puzzle`, `pipes:map`) are kept by it. New levels go at the end of a chapter with a new id; a run also keeps a signature of its level and starts over if that changed. Levels are written by `node pipes-puzzle-pick.mjs` (flat) and `node pipes-map-pick.mjs` (map), not by hand; the tests re-solve all of them and want the listed routes and no others. Changing a target or recipe re-picks the chapter and the stars kept for it mean something else.
- The puzzle wins when the oil, run through what is laid, goes through every piece and old pipe, passes the stakes in order and enters the terminal: it never compares with the listed answer, so another route that works is a solve. A hint caps the level at one star, and followed from any state it ends in an answer (tested).
- Squares are numbered `z * cols * rows + y * cols + x`; sides 0 N, 1 E, 2 S, 3 W, 4 U, 5 D. Pieces never turn: the map has 18 kinds (bends to up or down, a riser, crossings with a riser) and a hand shows only the kinds in it.
- The map is drawn as one SVG plate per floor under an affine matrix from `pipes-map-view.js`'s orthographic camera, so each plate is the flat board's own picture and taps go back through the inverse. Pitch is clamped above the horizon: the painter's order is floor 0 first. The pipes between floors are drawn on the screen, not on a plate. No SVG filters (Safari blurs them).
- The camera and the floor in front (`view`, `layer`) live in `pipes:map`, so a watching frame sees the same; its gestures and writes go nowhere.
- The buttons under the board belong to whichever board shows: `pipes.js` wires them; a board's `hide()` must give back what its `show()` changed.
