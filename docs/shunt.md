# Shunt

Gears shoved onto a hex plate (radius 2, 19 cells, 30 rim levers). Meshed gears form trains; an odd loop jams.

- 4 Nov 2026, Korbi: "new shunt is incredible, maybe a bit too difficult, so the earlier levels will need to do a bit of handholding. same idea: random - levels - daily. Do make it a lot prettier, we're going max 3d beautiful tinkers workshop here" (the workshop was replaced by the watch below).
- 4 Nov 2026, Korbi: "jewels should be jewel coloured": a ruby in both views, dull until its train turns.
- 4 Nov 2026, Korbi: "make shunt much prettier, 3d, similar design to topple, and those jewels should look like the jewels in a watch. I think also make the board a circle, maybe with guilloche that shines beautifully as the player gets to tilt the circular watch case a bit." So the 3D board is a watch movement under a round case (a ruby is a domed bearing with a hole in a gold chaton, in both views), and the case tilts a little.

Traps:
- A run is the level plus its integer moves (-1 swap, 0..29 shove), replayed by `play()`; never store a board. Levels carry a stored beam line `sol` that `tests/shunt.mjs` replays: change a rule and regenerate them.
- The view is behind `createView` (`draw`, `animate`, `hit`, `leverAt`, `setMotion`, `dispose`): `shunt-view-2d.js` or the 3D watch `shunt-view-3d.js` (its shapes `shunt-3d-geo.js`, its engraving `shunt-3d-tex.js` made with `guilloche-engine.js`, its pure parts `shunt-3d-model.js`, its sounds `shunt-sound.js`); state and input mapping stay in `shunt.js`. The 3D view stands the 30 levers equally round a circle (`LEVER_W`); that is only where they are drawn and touched: the numbers, lines and order are `ENTRIES`'s and the 2D hexagon's. `shunt:tilt` (the case follows the phone) is asked for in the menu, never at start: iOS wants its permission asked from a tap. `shunt:view` is written only when the player picks a view (`mode3d.js`: the default is never written down); a watching frame stays 2D.
- `suite.js` MARKS has `shunt: "daily"`, so the tile counts today's plate once judged.
- Every `shunt:` key is read through `shunt-keep.js`, which drops a value that is not this build's: `suite.js` syncs keys from old builds and devices, and the old wagon game's `shunt:seen` was `true`, which blanked the page (`new Set(true)`). `shunt:ver` 3 drops that game's `run`, `best` (in thousands) and `scrapped`.
- Never put "-go", "-chip", "-tag" in a class name: Kontor's and Office's wildcard rules in `themes.css` restyle them (`sh-goal` became a green bar).
- Tooth counts are multiples of 6 so neighbours interleave; lever pitch is about 0.47 D, so a lever is previewed first and confirmed by a second tap.
- Heavy search checks live in `tests/shunt-search.mjs` (about 20 s; nightly only).
- `vendor/three.js` is trimmed (no textures, environment maps, perspective camera, point or spot lights, PCF-soft shadows): the 3D view's grain and shading are vertex colours, the metals' reflection is added in the material's shader (`envify`), the camera is orthographic. Check a new three.js class against the bundle's export list before using it.
- Each pitch has its own layer height (`LAYER_Y`) so unmeshed neighbours of different pitches pass over one another; the idler is as tall as all three layers. A bridge's two parts turn at their own pitch's speed, not as one body. Gears are placed in the 2D view's angles (tooth 0 on the x axis, the half-tooth phase for the other turning direction): `tests/shunt-3d.mjs` checks the teeth interleave.
