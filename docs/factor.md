# Factor
An island-trading game (October 2026), three or four at a table, against the computer or with friends each on their own phone. It plays by the rules of the genre that Catan made well known and that Colonist plays in a browser; the names, pictures and code are its own. The name is a trader's: a factor was a merchant's agent on a far coast. The rules on one page are `factor-sheet.js`; its entry is in `rooms.js` (`GAMES`), its place at a party's table in `party-core.js` (`ELSEWHERE`).

## Rulings
- 19 October 2026, Korbi: "make Factor 3D, subtle table, real dice, the roads and towns proper there, tiles; a 2D mode in settings for battery saving". The 3D island is `factor-3d.js` on the vendored three.js, no model or texture files (so it plays offline); the menu's "Flat island, to save battery" (`flat` in `factor:opts`) is the SVG of `factor-draw.js`, which a device without WebGL gets on its own. Both take the same taps (`data-v`, `data-e`, `data-h`).
- 19 October 2026, Korbi: "ensure bots are medium and hard, and hard ones are extremely strong". Easy went; a menu still set to it plays Medium.
- 3 November 2026, Korbi: "Factor: allow user to drag in 3d model to arrange the camera exactly how they want. The angle, for me, is slightly too shallow at the start." The camera opens fitted at a steeper angle (63° where the box allows; it was 46°) and one finger or the mouse turns and tilts it (30° to 88°); two fingers pinch and move, a double tap or the menu's Reset view fits it again.

- 3 November 2026, Korbi: "would it make sense for the number of sheep/mountains on the tile to reflect the probability? Think would be neat." A tile carries as many props as its token has pips (6 and 8 five, 5 and 9 four, 4 and 10 three, 3 and 11 two, 2 and 12 one), on all five lands, in 3D and flat; the dunes keep their three mounds (`factor-props.js`).

## Where it differs from the genre, on purpose
- Where 6 and 8 would touch, the numbers are dealt again.
- Trading with the table is an offer each of the others answers yes or no to in turn (on your own turn, at most four: `MAX_OFFERS`), not free haggling: each seat answers on its own phone, so a counter-offer would hold the table up.
- First to 8, 10 or 12 points wins on their own turn; a point that comes to a seat on someone else's turn (the longest road passing to it when a rival's road is cut) is counted when its turn begins.
- The say-lines are in the past tense and agree with "You" and with names, since the narrator speaks them on whichever phone runs the table.

## Traps
- Hard looks ahead only for its setup posts and the blockade. Playing whole turns out chose worse than its ranking (the sampled futures are too noisy to tell building now from building next turn); don't add it.
- Flat island: a tap on a corner is the fill of its circle alone, since a stroke would reach the neighbouring corners (they are one unit apart).
- 3D: the island is what turns, never the camera or the light, so every angle is lit from the same side of the screen and the ship (turned to face the camera) always shows her sails. Shaders that print on the table, sea or tiles read the island's own point (`TURN`), else the grain and the tile print swim as it turns. The dice follow the screen's corner, not the island (in 3D they are the only place the roll is shown).
- 3D: the numbers, harbour rates and every ringed place are an SVG over the canvas, projected through the camera at each pose; a ringed place's target is a patch of the table as the camera sees it, so it stays its own at any angle (below 30° they get thin: the floor is there for that).
- The camera the player arranged is kept as `suite:factor-view`, a `suite:` key so it never syncs between devices (a phone's screen is its own). A watching frame (`IN_FRAME`) reads it and never writes it. The fitted view is not kept: it refits to the box.
- Props stand in fixed places for their count (nothing is dealt), clear of the token, so the token sits in the middle of its tile in the flat island too; a prop that grows past its `FOOT` in `tests/factor-props.mjs` would touch the token or the tile's edge.
- Not yet seen on a phone's own GPU or in Safari. Not yet: a course (Learn), and a result on the games screen.

Saved state: the game as `factor:game` (seats.js), the menu's choices as `factor:opts` and your record as `factor:record`.
