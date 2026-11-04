# Drift
The ninth idle game (October 2026; README, Idle): `drift.html`, `drift.js`, `drift.css`; the rules are `drift-engine.js` (pure, read its header first), the quays `drift-shapes.js`, the levels `drift-levels.js`, the simple players `drift-bots.js` (tests and tuning only, the page never loads it). Crates of four goods lie on a quay, a mask on a grid (a hull, a pier, a basin, a figure of eight, a lagoon, the open square); each turn you lay the next crate on any empty square, then the wind blows and every crate slides downwind to the edge of its stretch of quay, keeping its order, and three or more alike in a line ship. It is 2048 turned round: the forecast chooses the way and you lay the tile. The queue shows five turns ahead, each with its crate, wind and weather (squall, rogue wave, second gust, fog, rock, a moored crate, the harbour master's sealed crate). **Voyage** is sixteen levels of orders in eight sections, one new event to a section; **Open sail** is the endless game for a score on a quay of your choosing.

## Korbi's rulings
- 4 November 2026, of the Game Bench prototype: "drift: aesthetic should be upgraded from the template of course. I think maybe also changing the shape from square to different ones (classic: ship hull), and showing more of the future and having more 'events' and 'event' tiles. the backbone I'm quite happy with though."

## Traps
- The turn shown before you let go is `lay()` itself, not a copy of it: keep it so, or the preview and the turn drift apart.
- A saved v1 game (the square field of seven) is made into an Open sail game on the open quay by `upgrade`; its best (`drift:best` was a number) is the open quay's, and the key is now bests by quay. `drift:seen` was the old first-turns hint, a boolean; the section events seen are `drift:events`.
- The bots never use a sealed crate or a wave to their advantage, so the planner's win rate understates a person's on the levels with them (8-1 most); the levels are tuned so random wins at most about a third and the planner about half to nine tenths.
- A class `.crate` is Crates' in `style.css`: every class here is `dr-` or inside an `svg`.
