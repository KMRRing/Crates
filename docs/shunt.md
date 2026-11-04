# Shunt

Gears shoved onto a hex plate (radius 2, 19 cells, 30 rim levers). Meshed gears form trains; an odd loop jams.

- 4 Nov 2026, Korbi: "new shunt is incredible, maybe a bit too difficult, so the earlier levels will need to do a bit of handholding. same idea: random - levels - daily. Do make it a lot prettier, we're going max 3d beautiful tinkers workshop here".

Traps:
- A run is the level plus its integer moves (-1 swap, 0..29 shove), replayed by `play()`; never store a board. Levels carry a stored beam line `sol` that `tests/shunt.mjs` replays: change a rule and regenerate them.
- The view (`shunt-view-2d.js`) is behind `createView` (`draw`, `animate`, `hit`, `leverAt`, `setMotion`); the 3D workshop replaces it, state and input mapping stay in `shunt.js`.
- `suite.js` MARKS has `shunt: "daily"`, so the tile counts today's plate once judged.
- `shunt:ver` 2 drops the old wagon game's keys; its `best` was in thousands.
- Never put "-go", "-chip", "-tag" in a class name: Kontor's and Office's wildcard rules in `themes.css` restyle them (`sh-goal` became a green bar).
- Tooth counts are multiples of 6 so neighbours interleave; lever pitch is about 0.47 D, so a lever is previewed first and confirmed by a second tap.
- Heavy search checks live in `tests/shunt-search.mjs` (about 20 s; nightly only).
