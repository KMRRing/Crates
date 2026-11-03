# Manifest v2: the design (3 November 2026; folded into manifest.md when done)

Korbi, 3 November 2026, 13:02: "I think one of the off putting things for manifest is that they are still container shaped. Let's make them (cubic) crates and barrels, sort of old trading style. And maybe let's just do levels here as well; a number of levels and a generator. Different types of stuff: crates, chests, timber (logs), ingots (metal), barrels; stuff like that. Each with their own 3d model. Think a bit about the rules on how they can be placed with algorithmic packing and stacking rules, and what questions can be asked. And then manifest should become level based as well: one random mode, one level mode, and today's manifest."

Decided without asking him; each of these can be overruled by one line.

## Cargo: six types, one cell each
One item is one grid cell, so occlusion, tiers, the Together split, turning and the change rounds work as before. The cell becomes a cube (the old package was 1.9 long: that was the container). Order = the order they enter the ladder = the number a cell holds (1 to 6).

| # | type | weight (cwt, hundredweight) | worth (marks) | top | bears (most weight above it in its column) | silhouette |
|---|------|---|---|---|---|---|
| 1 | crate | 2 | 4 | flat | 4 | cube, slatted, rope handles |
| 2 | barrel | 3 | 6 | lid | 6 | upright, bulging, hooped |
| 3 | timber | 3 | 3 | round | 9 | rope-tied logs lying, ends showing rings |
| 4 | ingot | 6 | 12 | flat | any | low stepped pile of stamped bars |
| 5 | chest | 4 | 20 | domed | 0 | dark box, iron straps, domed lid |
| 6 | sack | 1 | 2 | soft | 2 | slumped bag, tied neck |

Cut: bale/cloth and jar (a bale is a crate's silhouette; a jar a barrel's). Told apart by outline first; `tests/manifest.mjs` will measure silhouette overlap (not only colour) and fail if two are alike.

## Stacking rules (`manifest-rules.js`, pure)
1. **Support.** A piece stands on the quay (tier 1) or on the piece below it in its cell column. Nothing floats.
2. **What a top carries** (`CARRIES`): crate: crate, sack. barrel: barrel, crate. timber: timber. ingot: everything. chest: nothing (the dome). sack: sack. The quay carries all. So heavy goes low without a separate rule, and what may lie *under* a piece (`UNDER`) is the inverse: chest and ingot only on the quay or on ingots; timber on timber or ingots; barrel on barrels or ingots; crate on crates, barrels or ingots; sack on crates, ingots or sacks.
3. **Load.** The weight above a piece, all the way up its column, may not pass what it bears. Binds in tall stacks only (four crates, four barrels).
4. **Logs cross.** Timber on tier t lies along x when t is even, along y when odd (a turned stack swaps them). Timber on timber therefore always crosses; this is a function of the tier, so it needs no state and survives turning.
`validate(cells)` lists every violation; `makeStack` (the generator) only places what the rules allow, column by column from the quay, and stops a column early when nothing may go on. Same seed, same stack, on every device.

## What can be asked
Kept as they were (same ids, so `manifest:record` stays meaningful): count, total, tier, spot, top, most, turned, which, change, changeTurned, swap, with "ware" now meaning cargo type. New, all with exactly one answer from the engine's truth and five evenly spread options:
- **weight** (number): what the pieces seen weighed, cwt. **worth** (number): what they were worth, marks. Arithmetic over the cargo table (shown in the rules sheet).
- **load** (number, tier-by-tier or slice views): the weight resting on the marked piece. **fits** (number, same views): how many more of a named type could be put on the marked column, up to the quay's tier limit, by rules 2 and 3.
- **under** (type, all-at-once view only): what lies under the marked piece, when the piece below is out of sight and only one type may bear it (a chest or an ingot above the first tier: ingot).
Every question is deducible; none is a guess, so none is priced as one. The test gives a reference observer a copy of the grid with everything the view hides replaced by "unknown" and requires it to reach the engine's answer from the rules alone.
Cut: "removable without a fall" (the answer is "nothing above it", visible or not), heaviest column / hidden pieces (a hidden piece is not deducible, only guessable), a broken-stack question (no memory in it).

## Recipes, rounds, levels
A **recipe** is `{ x, y, z, types, views, kinds, want, orders, exposure, change }`; a round is `makeRound(seed, r, team, recipe)`. `want` lists kinds the round must carry (the generator retries the stack, deterministically, up to 40 times, then takes the best it had). Random's recipe for round r is `levelOf(r)` (types 3, then 4 from round 5, 5 from 9, 6 from 11).
A **level** is `{ name, rounds, miss, recipe, change: [round → variant] }`: 3 to 5 rounds, "miss" wrong answers allowed. Stars: 1 finish within the misses; 2 at most one wrong and three quarters right; 3 every question right. The level's first deal is its own seed, the same for everyone; a replay is a fresh seed. 32 levels in 8 chapters of 4, each chapter bringing one thing: 1 crates and casks, 2 timber (turned spots), 3 ingots (weight), 4 chests (under), 5 sacks (worth), 6 changes (replace, turned, swap), 7 loads (load, fits, four tiers), 8 the quay master (everything, which-stack). Three rounds and a longer hold at the start of a chapter, five and a shorter one at the end.

## Three modes
Menu, via `menu.js`: **Random** (12 rounds, 3 lives, as today), **Levels** (the ladder as a list under its chapters: stars won, any open level playable at any time, a level opens when the one before has a star), **Today's manifest** (12 rounds seeded by `today()`, counted the moment the result is final in `manifest:daily`; the games screen needs `manifest: "daily"` in `MARKS`: shared file, asked of the owner of `suite.js`).
Saved keys: `manifest:run3` (the run in hand, any mode; `manifest:run2` is from before the cargo and is removed unread), `manifest:camp` (`{ v, at, stars }`), `manifest:track` (last mode), and unchanged `manifest:best` (best Random or Today's score), `manifest:daily`, `manifest:record`. Levels write no best: their scores aren't comparable.
Together keeps working on Random's recipes (a table plays the engine's table rules untouched).
