# Gears: the contract between the rules and the views

Implements section 8 of the Gears 2 design as built. Where this file and the design differ, this file is right. Written by the rules agent, 4 November 2026; the 3D agent builds against it and `pipes-gear-fixture.js`.

## What changed from the design

1. **Speed.** The speed of a wheel is exact (`pipes-gear-frac.js`, `[p, q]`): the barrel turns clockwise at 1, a mesh gives `w_v = -w_u n_u / n_v`, a ring mesh `+`, a shared arbor the same. Along any chain of meshes every wheel has the **same tooth rate** (teeth x speed), so a **duo, trio or single never changes the speed of the wheels beyond it** (a duo's two wheels are two arbors). Only a compound arbor changes the tooth rate: a **stack K** (by `np/n1` entered at its wheel, `n1/np` entered at its pinion), a **riser R** (by the ratio of its two wheels' teeth) and a ring. The design's "ratio pieces" D 4+8 etc. are flip/route pieces, not ratio pieces; ratio levels use stacks, and since a stack must change layer (wheel and pinion cannot overlap), the ratio chapters run on layers 1 and 2.
2. **Stations are pins.** A station is a pinned piece (`pins[]`) with a `goal`; `trains[].stations` does not exist. A pin's `goal.w` is the wheel index the goal reads.
3. **Mirrors.** A mirrored plate keeps every direction relative to the barrel (the barrel is always clockwise), so goals and clicks do not flip in `transformLevel`; only squares, sides, turns and kinds move (a mirrored piece is `mirrorPiece(kind, rot)`).
4. **Equal pieces.** Two turns of a kind are one piece when they do the same (same sides, teeth, layers and rates between the port wheels), e.g. a trio's idler above or below. `orientations(kind)` lists the distinct turns, `canonRot` the lowest turn that does the same. `laid` always holds the canonical turn, so a drawn trio's idler may sit on the other side from the one a hint showed: a picture only.
5. **No crossings yet.** `X` is not built (P3, if at all); the fixture has none. Layers matter through K, R and the clash rule.
6. **Jammed wheels keep the speed the flood first gave them** (`M.omega`, `M.dir`) and are in `M.jam`; a view draws them still and red. Wheels not reached from a barrel have `omega` null and `dir` -1.

## Level data

```js
{ id, name, chapter, cols, rows, rotate: true|false,
  map: ["..#1"],              // . ground, # pillar, 1 2 a bridge (only pieces whose highest wheel is on that layer or below)
  trains: [{ id: "A", barrel: { c, side: "E", m: 5, l: 1, n? },
             sink: { c, side: "W", m, l, n, goal: { type, speed: "1/2", dir: "cw", ring?, w? } } }],
  pins: [{ c, kind, rot, train, goal? }],        // pinned pieces the train must run through
  clicks: [{ c, dir: "cw" }],                    // a single laid there must turn this way
  hand: "S5.1:2 D5.1:4+8:1",                     // kind : count (a level that does not turn: kind@rot : count)
  sols: [{ "6": "S5.1@0" }] }                    // every answer: square -> "kind@rot"
```
`goal.type` is art only (`wheel`, `dial`, `hands`, `seconds`, `date`, `moon`, `chime`, `escape`, `tourbillon`, `crown`); the rule is always "this wheel turns this way at this speed". `ring: true` makes the sink a pinion at the port inside a ring wheel (wheel 1, layer above), the goal reading the ring.

## Engine (`pipes-gear-engine.js`)

`parseLevel`, `emptyLaid`, `packLaid`, `unpackLaid`, `handLeft`, `lay(L, laid, c, key, rot)`, `turn`, `lift`, `bestTurn`, `mesh`, `speeds`, `jams`, `trains`, `complications`, `check`, `hintFor`, `starsFor`, `walk`, `phasesOf`, `tempo`, `planOf`, `frameOf`, as in the design, plus `pieceOf`, `pieceStr`, `keyOf`. A **gear id** is `c * 8 + i`.

`M` (from `mesh`): `gears [{ id, c, i, x, y, n, m, layer, arbor, train, fixed ("barrel" | "sink" | "pin" | null), ring }]` (x, y in board units, 60 per square, origin top left of the plate), `idx` (Int32Array: gear id to index in `gears`, -1), `edges [{ u, v, kind: "mesh" | "ring" | "rigid", at }]` (inter-piece meshes are listed once), `omega` (array by gear id: a fraction `[p, q]`, clockwise positive, or null), `dir` (Int8Array by gear id: 0 cw, 1 ccw, -1), `jam` (Set of gear ids), `loops [{ gears, why: "turn" | "bind" }]`, `clash [[u, v]]`, `tangle [[trainA, trainB]]`, `driven` (Set of squares), `order` (squares in power-wave order), `orders` (by train), `trainOf` (Int8Array by gear id), `shapes` (by square), `adj`.

`res` (from `check`): `{ solved, placed, left, strays, missed, jams (squares), clashes, tangles, trains [{ id, index, cells, path | null, order, sink: { status, c } }], comps [{ train, c, w, type, status: "ok" | "slow" | "fast" | "wrong" | "off", has, want, dir, wantDir }], clicks, clicksOk, messages, nearest: { c, text } | null, M }`.

## Plan and frame

`planOf(L)`: `{ id, name, cols, rows, rotate, terrain ("ground" | "pillar" | "bridge1" | "bridge2" per square), cap, trains [{ id, index, barrel, sink (with goal) }], pins, clicks }`. Static, once per level.

`frameOf(L, laid, extra)`: `{ laid ("kind@rot" or null per square), M, res, T0 (ms per barrel turn), phase (Float64Array by gear id, degrees), held, ghost, hint, focus, solved, look }`. A view draws from the frame only and never imports the engine. Wheel angle: `theta(t) = phase[id] + (dir[id] ? -1 : 1) * 360 * |omega| * t / T0`.

## Shapes (`pipes-gear-shapes.js`)

`shapeOf(kind, rot)` -> `{ kind, rot, fam, wheels [{ x, y, n, m, l, a }], ports [{ s, w }], mesh [[u, v]], ring, comp, sides, layers }` (positions in the square, 0..60, rot applied). Wheels with the same `a` are one arbor (rigid). Kind ids: `S5.1`, `D5.1:4+8`, `D5.1:4>6e` (elbow, N wheel > E wheel at rot 0), `T5.1:5-4-5`, `T5.1:4-5-4e`, `K[5.1>5.2]:8/4>6`, `R[5.1,5.2]`. `kindName`, `CATALOG()` (all legal kinds by family), `endShape` for barrels and sinks.

## Fixtures

`pipes-gear-fixture.js`: `FIXTURES = { idle, train, ratio, pitches, riser, bridge, jam, clash, hands, date, moon }`, each `{ name, note, plan, frame }`. More are added there with a header line.

## Added since (5 November 2026)

- `workings(L, res)`: for each train `{ id, index, items: [{ c, type: "barrel" | "step" | "station" | "sink", factor, comp }] }`, for the strip under the board. `pipes-gear-book.js` lists every level (`LEVELS`, `CHAPTERS`, `BOOKS`, `sigOf`); a level with `v` is of Book II on (Book I has none and shows no strip, no layer chips).
- The flat view (`pipes-view-2d.js`) is the reference renderer and also has `runNow()`, `stop()`, `pulse(c)`, `onTick(k, total)` (the power wave, for sound), `setMotion(on)`; `view.hit` gives `{ kind: "cell", c, sub }`. The controller is `pipes-gear-run.js`; the 3D view takes the same `plan` and `frame`.
- Today's and random plates are ordinary level data (`pipes-gear-daily.js`): ids `d<YYYYMMDD>` and `r<n>`, `chapter` the band (`easy`, `medium`, `hard`), with `daily` or `random` set.
- `mirrorPiece` matches wheels within 3.3 units (an elbow duo's port wheel may sit 3 off its edge); a mirrored pin's `goal.w` is remapped to the same wheel.
