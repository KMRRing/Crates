# Carrom

Carrom for two (4 November 2026, Korbi: "carrom, build it. 3d only."): a square board with a pocket in each corner, nine white men, nine black and a red queen; you slide a striker along your baseline and flick it by pulling back from it. On seats.js, against the computer, two on one phone, or a table with a friend on their own phone. 3D only: there is no flat mode (`carrom-3d.js` is the only picture, and a device without WebGL says so).

Files: `carrom-engine.js` the physics, `carrom-rules.js` the rules, `carrom-bot.js` the computer, `carrom-3d.js` the board, `carrom.js` the page.

## House rules, and why

Simple on purpose (the brief: nothing beyond the striker down).
- Seat 0 plays white from the bottom baseline and breaks first, seat 1 black from the top; who breaks alternates (or is set in the menu). Two players only: the real game's four-player doubles is not here.
- A man of yours down: shoot again. A man of theirs down stays down and counts for them, and the turn ends (the real game returns it; staying down is simpler and punishes a careless shot just as well).
- **Foul = the striker down:** the turn ends and the man of yours that went down last comes back to the middle (this shot's included, so a foul that also pocketed one nets nothing). With none down, it costs only the turn (no "owed" men to track).
- **The queen must be covered** by one of your men on the same shot or the very next of that turn; else she goes back to the middle. A queen down on a foul goes back.
- **Your last man cannot go down while the queen is not yet won**; it comes back. (Otherwise a player could clear first and ignore her.)
- A colour with all nine down wins, whoever put them there. Points (shown, not a match score): the loser's men left, plus 3 for a queen the winner covered.
- A returned man goes to the middle, else the nearest free spot of a fixed ring pattern (`freeSpot`).

## Korbi's rulings

- 4 November 2026: "make carrom prettier and allow the user to zoom navigate." Pinch or wheel zooms, a drag on empty table turns the board, two fingers move it, two taps (or Menu, Reset view) put it back; Close-up frames your baseline.

## Traps

- **A finger that lands on the striker or its baseline is an aim from touch to lift** (`carrom-gesture.js`, tested in `tests/carrom-gesture.mjs`): a second finger during an aim is ignored, never a pinch, and a pinch whose first finger lifts first must leave later taps and drags working (Moor's real bug). Picking (`boardAt`) is exact under any zoom, turn or tilt; keep it the inverse of `project`.
- **No textures** (the three.js bundle has none): the wood grain, the lacquer and the lamp's pool are vertex colours; the table is the stage's CSS background. The brass is `--ca-brass`, never `--brass` (that is Kontor's green and Office's blue).
- **The pocket's well and brass collar follow the frame's height** (up where they cut through the rail, down on the board); the board's surface pulls its vertices onto the pocket's circle instead of dropping cells, or the hole is a staircase.
- **Hard's search runs on the page** (0.3 to 1.4 s stall): `seats.js` calls the bot synchronously, so a worker needs `seats.js`'s runner to wait for a move.

- **The same on every device.** `carrom-engine.js` does + − * / and sqrt only (never Math.sin, cos, pow, atan2, hypot: they differ in the last bit between V8 and JavaScriptCore) with a fixed step that depends on the state alone, and bodies visited in index order. A shot is sent as integers (the striker's x, an aim vector in thousandths, a power 1..1000), never as a result; every phone replays it from the state before. The page's own trigonometry (drawing) must never reach `carrom-engine.js`.
- **The state holds the result of the last shot, and the page replays it** from the state before (`follow()` in `carrom.js`, `replay()` in `carrom-3d.js`), then snaps to the state. A phone that was asleep and misses a shot just snaps. `tests/carrom.mjs` checks the replay ends exactly where the state says.
- **A slow phone loses effects, never steps.** Playback takes the steps its clock owes (many a frame if need be); only the shadows and the pixel ratio go (`lite`).
- **The computer's levels are the hand, not the search:** all of them pick the best of the shots they try by playing them out, so what separates them is the scatter added to the chosen shot (`slip`, `weak` in `carrom-bot.js`). Without it even Medium cleared a board in a dozen shots.
- The database keeps no empty lists: `restore` makes `last.pocketed` and `last.returned` whole again.
