# Courier
A three-lane swipe runner on a Hanseatic quay (2 November 2026, in Blades of Brim's way), in `reckoning.html`, `reckoning.js`, `reckoning.css`; rules in `reckoning-engine.js` (pure, tested by `tests/reckoning.mjs`), drawing in `reckoning-3d.js`, its springs in `reckoning-move.js`, questions from `reckoning-questions.js`. It is the endless run only, composed of segments (`reckoning-biomes.js`: generated from a biome, partly generated with `?`/`~` slots, or pre-made; the engine's `compose()` picks by biome, a rising `difficultyAt`, variety and a transition). The twenty ideas in `reckoning-sections.js` are the Playtest list: all open, no stars (`tests/courier-sections.mjs` wins each with a bot; `tests/courier-run.mjs` soaks each biome). It sits in Idle (4 November 2026: in Knowledge for a day, put back by the split review as a swipe runner, not a knowledge game): played on reflex, a question now and then. Every shape is a box standing in for a model to come; one world, no sound. It was called Reckoning until 3 November 2026: the name is now Courier on screen only, and ids, filenames, tests and the `reckoning:` saved keys keep the old one so saved state survives.

## Rulings (Korbi, 2 November 2026 unless said)
- Swoop: "while in air when swiping left or right on descend should enter attack mode" (a ground foe in the next lane, from up to 4.5 m above it).
- Two lanes across: "swiping left/right attacks units 2 lanes across as well when in attack distance"; a foe in the next lane comes first.
- One swipe, two foes: "if player is on leftmost tile and two enemies on right and rightmost, swiping right will attack both".
- Up, slightly above: "if the player is just slightly above in the same lane, up will work" (1.2 m, `UP_ABOVE`).
- Bonk: "otherwise down slam will work if the player on the way collides with the flying mob in which case it's a bonk and player will jump back up after attack".
- Down in a jump with nothing under: "if down during jump and not [bonking] or slamming, do a roll on land".
- Roll: "rolling attacks unit in front if in attack distance"; it "should last a bit longer" (0.32 s became 0.45 s); "repeatedly rolling down gives no window where a ground enemy in front of the player would be able to successfully attack" (a down in a roll queues the next); "rolling on a lane that the attacking enemy isn't on won't dodge their side lunges".
- A diving flyer: "shortly before the player would take damage from a diving range attack while on the ground from the side, the player has a window where if they attack left/right, they can target and kill the diving flyer".
- After a kill in the air the jump comes back: "after every aerial attack the hero jumps and resets his jump".
- A cut can be moved in flight: "it should be possible to jump up, then left and right mid air to correct the answer bird" and "up -> left -> left if done fast enough should go from attacking the right bird to the left bird".
- Flyers follow my height: "quite easy to gain vertical height in this game. Enemy flyers slowly rise or fall closer to the player if the player is far above or below them. If the player is a bit above and next to them then the player can hit them with left/right swipes, or if the player is just slightly above in the same lane, up will work. Otherwise down slam will work". (`drift()`; a question's gulls and a pit's do not move.)
- Foes telegraph: "enemy units should telegraph their attacks" (he had first said there was no need): sees me, winds up, launches, by seconds to contact.
- Grace: "should get more grace time: immediately after swipe is complete, hero should be immune to attack from that direction" (0.4 s, towards the side swiped).
- The question stands "above the player near the top of the screen somewhere under the hearts with the answers", with "more time to think about right answer"; "the questions should be capped in length" (70 characters, answers 34); "getting a question wrong costs 2 lives; right restored one".
- "units when hit should fly back" (he wrote "Rennt units"; read as every unit). Drawing only.
- "redesign the enemy melee unit, idk what that's supposed to be but looks weird": the crab.
- "overhaul player character: make them a pretty model": the young merchant-adventurer.
- "swipe directions are inverted": fixed in the view, below.
- "add logs to the game that shows and indexes the swipes and events; I want to copy what happened and explain what I wanted to happen in those cases": Menu, Swipe log.
- 3 November 2026 (the plan, row 10): the hero's movement far more dynamic, judged by feel; no new levels, wall runs or monsters, and the hit stumble and screen shake belong to row 22.
- 4 November 2026, 08:56 (this replaces the 01:53 ruling's "levels, after all"): "The couriers sections aren't levels they're ideas and the endless runs will be a combination of different auto generated biomes and these sections. I see a lot of what has been done is build features instead of sections." "The final game will be endless run only, made up of sections", of three kinds: fully generated from a biome, partly generated (the map fixed, the spawn places not), fully pre-made. Fixes asked for: sluices and drawbridges that show which is open; barrels broken by an attack; balloons on the same mechanic; "gold coins and rarely amber ... continuously collectible like subway surfers not just section specific".
- 4 November 2026: the grog joke goes (no drinking in the suite); section 13 is Timber Wharf.
- 4 November 2026, Korbi: a Feel lab, very few clicks per test, to generate feedback.
- Wall running, same message: "if I'm in the middle lane and there's a wall on the right of the right lane, if I jump up then right mid air, it'll do a wall run, then most walls won't allow me to get higher but sometimes always [read: also] I get a second jump from this, so if the wall is higher, or if there's a wall opposite, then you can jump again and then left or right and you'll wall run on a higher level."

## The wall run
Korbi's words (4 November 2026) read as: a wall run resets the jump; most walls give no more height, a taller wall or a wall opposite gives a second jump, and the swipe after it joins a wall higher up. ("Sometimes always" read as "sometimes also".) One state machine (`side()`, `up()`, `step()` in `reckoning-engine.js`; `tests/courier-walls.mjs` has a test for every row):

| From | Swipe or event | To |
|---|---|---|
| run | sideways towards a wall in the edge lane I am in | wall, feet at `WALL_Y` (2 m) |
| run, middle lane | sideways towards the wall | a lane change; the wall run is the next swipe |
| air (any jump) | towards a wall in my edge lane, feet under its top | wall, at the height I was (never above top - 0.5); the jump is mine again |
| air, above the top | towards the wall | a lane change attempt; no wall (an ordinary wall, `WALL_TOP` 3.2 m, gives no height) |
| wall | up | air, `WALLJUMP_V`, and `kick` is set |
| air with `kick`, in the lane across | sideways towards a wall on the other side | wall there, at my height: chains upwards, 2.4 m a jump, to the wall's `top` |
| air with `kick`, same side | towards the wall | wall again, higher, if the wall's `top` allows (a taller wall) |
| wall | away from it | air in the wall's lane, no `kick` |
| wall | towards it | nothing, and nothing is kept |
| wall | the wall's end | air, `wallend`; falls onto what is below (a deck, the planks, the water) |

A wall's `top` is its height (`WALL_TOP` when it has none); the ship's side stands 8.5 m over water, so it takes two jumps and two crossings.

## Traps
- Swipe windows are in seconds to contact, not metres, so they are the same at 10 m/s and at 16. A foe's `aim` is fixed at its launch.
- The world is drawn in a group mirrored in x (`world`), and the camera gets the mirrored x. Lane +1 is the hero's right.
- The hero's lane x is a critically damped spring (`LANE_OMEGA`), so `h.x` is mid-arc during a change and `h.vx` carries its speed; a save from before has no `vx` (read it `|| 0`). A cut's y is eased; its x is the same spring.
- An up swiped in the air with nothing to cut is kept until the landing, up to 0.32 s (`LAND_BUFFER`); any other swipe with nothing to work on waits 0.14 s (`BUFFER`).
- Everything that is only feel (camera, lean, squash, cloth, dust, streaks, the pose carried over from the one before) is in the view and `reckoning-move.js`, which the rules never read; the page hands the view `lead`, the time the rules have not run yet, and the hero is drawn carried on by it. Tests play the rules alone.
- The hero's pose is numbers on the named joints (`J`, `poseHero`); the names are what a glTF's joints must match. On a wall he leans away and is drawn 0.5 m out from its face, or he is hidden inside the box.
- A gull's beak points at the hero because foes are turned half round to face him. Sizes follow the Docs page "Reckoning: models and assets" (crab at most 1.5 m across, a gull's wings 1.6 m, only a question's gulls carry a banner), so a model replacing a box changes nothing the rules hold.
- `vendor/three-run.js` is its own esbuild bundle, not Harbour's: it has no `IcosahedronGeometry` and much else; check what it exports before using a class.
- Down in a jump with nothing under is known as a roll by its landing speed (a dive starts at 24 m/s, no fall of its own gets near), so nothing is remembered and a bonk, a lunge or the water cancels it.
- The slam never answers a question (a gull is in the air, the shockwave is on the ground). A wrong answer costs two hearts, one for the answer and one for the water.
- The swipe log is in the tab's `sessionStorage` (`reckoning:log`), not under the synced keys. `reckoning:miss` is kept with the entities for the pile but nothing reads it yet (`pile.js` is shared).
- A section's quay is made whole at its start (`ensure` does nothing when `S.sec`), from `S.rng` seeded by the section's id, so it is the same every run; only the questions are dealt afresh (`qrng`). A kept run whose section has since changed (`S.sig`) or is gone is dropped by `valid`; an endless run from before sections is given the fields it lacks.
- Writing a section: no thing to pick up in the row of a crab beside its lane (the crab is cut as it comes and the cut carries the hero off); a row of sluices has all three beats; keep 40 to 60 m before a `!gate`, `!chain` or `!wall` to crabs and rest only (the test's old bot plays those pieces and knows nothing of tokens or barrels); a bruiser needs 12 m after it. A section the bot cannot win at par does not get in.
- A class with `-go` in its name gets Kontor's and Office's button lettering (`[class*="-go"]` in `themes.css`): the aim under the hearts is `rk-aim` for that.
- Kept under `reckoning:`: `run`, `best` (the endless run's; also `courier:best`), `stats`, `miss`; `courier:coins`, `courier:amber` (banked when a run ends). An old `camp` key is ignored. A partner watching reads `run` and draws it without a clock.

- Barrels and balloons are foes (`KINDS`, `inert`): the attacks that cut a crab break them, nothing makes them look or fly at me. A barrel run into costs a heart and breaks; a balloon run into costs only the chain. Coins come out of a break (`BREAK_COINS`). The old `b` obstacle is gone from new quays (a kept run's is still handled).
- Coins have a random stream of their own (`crng`), so adding or moving them never moves a foe; `sprinkle` runs after a stretch is made. A trail never goes through a crab's lane or the one beside it, so the coins are the safe line.
- A sluice's lamp, ring/cross and leaf all come from `tide()`, the same function `solid()` uses: closing is still open, opening is still shut (the warning is the last `TIDE_WARN` seconds). A bridge's colour (red 0, blue 1) is its `flip`; the lever lowers the bridges that are up now.
- Ground above the quay is `W.decks` (lanes l0 to l1, height y, a `ramp` rising over its first metres, a `down` falling over its last; none means a sheer edge). Foes, coins and obstacles take `gy`, the ground under them, when they are made, so decks must be laid before the things on them; every test of "on the ground" is relative to `gy` (`gyOf(f)`, `h.gy`). A deck's sheer front run or jumped into more than 0.6 m too low costs a heart and puts me on it (`g > 0.5`: the far lip of a pit is not a deck). A drop off a deck is free. A pad (`W.pads`) throws me `PAD_V` (4.3 m) up and gives the jump back; the bot keeps off decks and pads (`freeLane`), so the soaks prove only that they can be avoided; `tests/courier-walls.mjs` plays them.
- The camera follows height past 4 m with a steeper slope (`reckoning-move.js`), and the hero's shadow and a line down to it are drawn at `h.gy`, so height over a deck or water can be read. Only a phone can say whether it is enough.

## To come
The models (`makeFoe` and the hero's block are where the shapes are made; the built-in ones stay as stand-ins), sound, the daily and the duel (the engine already runs from a seed), the pile, a second world, the other two modes Korbi thought of (a plain Subway Surfers one, a stealth one), a coyote time (a jump allowed a moment after the quay ends), the daily run, and a look at how the swipe windows and the new movement feel on a phone.
