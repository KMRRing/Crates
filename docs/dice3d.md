# The dice kit (`dice3d.js`)

Korbi, 4 November 2026: "review every single game and ensure that it has an extremely pretty 3D mode ... this includes card games and cartel." The kit is the dice half of that: lifted from Yacht's dice, first used by Cartel (`cartel-3d.js`), meant for Liar's dice, Yacht and Pewter next. `dice3d-geo.js` is its pure half (no three.js, tested in Node by `tests/dice3d.mjs`); `cartel-glyphs.js` is an example of a game's own faces.

## Adopting it

1. `createDiceStage(host, { camera, clear, onLost })` inside a box with a size. It throws where there is no WebGL: draw flat (`tableView` from `table3d-view.js` gives the View choice, the default from `mode3d.js`, written only when the player picks). `onLost` fires when the context goes: fall back to flat for the visit and write nothing.
2. Build the room with `stage.addTable()` (felt, rim, brass) or your own meshes (`stage.mesh`, `stage.std`, and `lathe`, `slab`, `paint`, `merge` from the kit); `stage.onSkin(fn(night))` recolours; `stage.onResize(fn)` rebuilds what depends on the box.
3. Camera: `camera: { fit: [points] }` keeps world points in view (Yacht's way), or `camera: { span: 20 }` locks it to the box's pixels: `stage.worldAt(px, py)` is the table point under a pixel and `stage.unitsPerPx` its scale, so a DOM layout can be the master and the dice stand where its boxes are (Cartel).
4. Say which dice there are, every time your state changes: `stage.setDice([{ id, style, value, x, z, size, cover, gold, dashed, dot, lift, from }])`. `style` is `"gold"`, `"bone"`, `"ebony"` or an object `{ name, base, edge, ink, one, rough, metal, art(ctx, v, cellSize, layer, style) }` (pips are the default art). `value` is the game's face; `cover` puts a cup over the die (give it any value: it is not drawn); `from` is where a new die flies in from. What moves is worked out from the difference with the last call (`diffDice`): new ids fly in, a changed face tumbles, a cup that goes lifts and the die turns over, a moved die hops, a die that goes leaves. Pass `{ snap: true }` (or call `stage.reset()` for a new game) to put everything in place at once.
5. `stage.dispose()` on the way back to flat.

## Traps

- **Faces never come from the animation.** A tumble ends on `showing(value, yaw)`; its numbers are a seed's (`tumble(mix(id, value))`), so every device throws the same. Test `stage.faceUp(id)` against the game.
- **The vendored three.js is trimmed:** no perspective camera (the kit makes one from the orthographic camera's matrix, so `Raycaster` is useless: use `worldAt` and `pick`), no `LatheGeometry`, `PlaneGeometry`, `BufferAttribute` (use `Float32BufferAttribute`), `RingGeometry`, point or spot lights. Textures come from `vendor/three-tex.js`. `tests/dice3d.mjs` fails on a name the bundle lacks.
- **Ids must be stable** across calls, or every die looks new and flies in. Hidden dice still need ids.
- **It draws only while something moves** (30 frames a second at most, 20 under the battery saver, which also drops shadows and caps the pixel ratio at 1). Do not add an idle animation; a flame that flickers all the time is a battery drain.
- **A layout-driven game** (Cartel) must call `setDice` after the DOM has been laid out, and a resize within 250 ms snaps instead of animating.
- The picture on a face is laid on the die by `atlasUV` from the bunched grid, not the plain one: a face's picture is the cell, top toward -z when the face is up. Draw art inside the middle 80% of the cell; the bevel takes the rest.
