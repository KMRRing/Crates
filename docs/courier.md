# Courier
A three-lane swipe runner on a Hanseatic quay (2 November 2026, in Blades of Brim's way), in `reckoning.html`, `reckoning.js`, `reckoning.css`; rules in `reckoning-engine.js` (pure, tested by `tests/reckoning.mjs`), drawing in `reckoning-3d.js`, its springs in `reckoning-move.js`, questions from `reckoning-questions.js`. It sits in Idle: played on reflex, a question now and then. Every shape is a box standing in for a model to come; one world, no sound. It was called Reckoning until 3 November 2026: the name is now Courier on screen only, and ids, filenames, tests and the `reckoning:` saved keys keep the old one so saved state survives.

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
- Kept under `reckoning:`: `run`, `best`, `stats`, `miss`. A partner watching reads `run` and draws it without a clock.

## To come
The models (`makeFoe` and the hero's block are where the shapes are made; the built-in ones stay as stand-ins), sound, the daily and the duel (the engine already runs from a seed), the pile, a second world, the other two modes Korbi thought of (a plain Subway Surfers one, a stealth one), a coyote time (a jump allowed a moment after the quay ends), and a look at how the swipe windows and the new movement feel on a phone.
