# Bridges
Hashiwokakero ("build bridges"; 31 October 2026, Korbi's list of genres to add): join the islands with straight bridges, one to three between a pair, until every island has as many as its number and all islands are one network, no bridge crossing another. Every puzzle and every level has exactly one answer, reached by reasoning and never by a guess. A ladder of 50 levels in ten chapters (stars for time plus 30 seconds a hint) sits beside free play, where any twist goes with any size and difficulty; a hint says why.

## Rules the twists add
- **Ranges**: a number may be a bound, "4+" (at least) or "≤3" (at most).
- **Two realms**: two colours of island; a bridge joins one colour, an island of the other colour in the way stops a link, and each colour is a network of its own.
- **Viaducts**: islands drawn with contour rings are hills; a bridge between two hills is a viaduct and goes over any low bridge. A hill joined to lowland is a low bridge: height belongs to the bridge, not the island.
- **Narrow roads**: a road pinched by wedges holds one bridge, never two.
- **Wide roads**: a road with a bed of three lanes holds up to three bridges (an island can then read up to 12).
- **Straits**: a dashed line across the sea with a number at its end; exactly that many bridges cross it, a double counting twice.
- **No loops**: bridges may never close a ring; a double bridge is not a ring.

## Together (3 November 2026)
- **Race** (`duel.js`, up to six, from a pair or a Party): the same puzzle on each phone, lowest score wins, the solo score (seconds plus 30 a hint). The match is a ladder level at the chosen difficulty picked by the seed, so every twist comes round; the dealing phone makes the puzzle and carries it, answer included, in the match. No penalty for a wrong bridge: its repair already costs time, a counter would tell you which bridge is wrong, and the tap cycle (1, 2, back to none) would punish clearing one.
- **Co-op** (a partner watches and asks to join; `bridges-coop.js`): one board, the host's puzzle as it is, both lay and clear bridges anywhere. Two changes to one link at once: the later stands. Crossing bridges laid at the same moment both stand and show in oxblood until one is cleared. A shared solve earns no stars, bests or daily; the host's own run keeps the progress.
- **Split numbers** (on by default in a new co-op; Menu, Together, "Split numbers", either player's to change): half the numbers are shown to each of you, a "?" where it is your partner's. Both see and lay every bridge; the rules and the solve use the full board. Dealt from the puzzle's seed (`halves` in `bridges-coop.js`): nine regions, each shared out in turn, so neither of you is left with none anywhere and the halves are even to within one island; the setting is a one-character board layer, so a reload and a late joiner get it. A hidden island takes no met/over/shut-off colour and a hint names it "island": the colours would give its number away. Not anti-cheat (a hint, a ring and a count still tell), nor a change to any puzzle; the solve shows every number.
- **Pings**: a tap on an island rings it on your partner's screen (their colour, about two seconds, a wave three times), softer on yours. A tap on a link builds, so a tap on an island is free for it; there is no drag to draw. The ping is the pinger's own value in the room (`players/<uid>/ping`, `island:time`), never part of the board or a run, and one left in the room from before you came is not shown.

## Rulings
- 1 November 2026, on wrong islands: "highlight it more when the 1+ and ≤5 are wrong and stuff like that, not always super clear from the highlights what's off". A broken rule shows from the marks alone, every time, never from the answer, and the line under the board says which island and by how much.
- 1 November 2026, on 3D: "Fun atmosphere, which is what the 3D model is really intended for"; "a scenic mode, or just called 3d, which can be applied at all times, and switches the 2d puzzle representation to a beautiful 3d one". The chart and the model are one run; either can be played.
- 1 November 2026, "Allow zooming in bridges" (the 3D view first; the chart has its own pinch zoom now).
- 1 November 2026, "islands of varying sizes depending on number".
- November 2026: Bridges is the best received game; wants levels like Topple's.
- 3 November 2026, 13:21, on co-op: "Coop mode for bridges: half the numbers are hidden from each player; other player has those. When clicking on an island, it pings it to the other player so it's easy to communicate which island you are talking about. Can be toggled when in party on that game." Split numbers and pings above are this; the toggle is in the menu.
- 3 November 2026 (Korbi, in the brief): reefs and water routes (Fairways) are redundant, "bridges cannot cross every possible route anyway"; ships move through whatever water is not occupied. Ranges, two realms and viaducts: "fantastic", keep as they are.

## Traps
- **Plain puzzles draw the generator's random numbers exactly as they always did** (golden hashes in `tests/bridges-levels.mjs`): today's puzzle and every old share link depend on it. A twist's draws come after everything else and only when it is on.
- **Level numbers are identity**: stars and unfinished runs are kept by number. The ladder was reordered on 3 November 2026; `was` on a level is its old number, `migrate` moves camp and runs, and a changed order needs a new `LADDER_VERSION`. A removed level's stars are dropped; a player standing on one lands on the first unsolved level.
- **Reefs and lanes are gone but old data still loads**: a twist name that names no twist (`reefs`, `lanes`) is a plain puzzle, and a saved run carrying a reef or lane grid is discarded by `valid()`.
- **Link-order strings**: `roads` is one digit (1, 2, 3) per link in the layout's link order; `straits` is `2*(size-1)` characters, first the gaps between rows (crossed by column links), then the gaps between columns, each `.` or a digit. Numbers above 9 are written `a`..`c`.
- **`tree` is not stored on a puzzle**: it comes from the twist name (`flagsOf`). A new twist goes into `TWIST_ORDER` as well as `TWISTS`.
- **Every road and strait clue shown is needed**: the generator removes clues in random order while the puzzle stays solvable at its level. Don't add one for looks. A puzzle that asks for both narrow and wide has at least one of each.
- **Ships sail any unoccupied water** (the board plus two cells of sea): islands, built low bridges, viaduct piers and the middle cell of a narrow road (its gate) are blocked, and the cells under a viaduct are crossed, never sailed along. Two ships are kept three cells apart at the start.
- **The 3D board is a handful of meshes, not a mesh per piece** (`bridges-batch.js`): a new piece of scenery goes into a batch under a colour role, and the marks only choose which vertices are drawn. The shadow map is drawn again only when the sun (the camera's turn) or the bridges change, so nothing that moves may cast a shadow (the ships and buoys don't), or its shadow stands still.
- **Safari/iPhone is unchecked**: the 3D view was only looked at in Chromium. Keep it without SVG filters on anything that matters, the WebGL pixel ratio at 2 at most, and the animation restartable.
- **Odd/even islands** (a number replaced by its parity) was weighed for the 3 November 2026 twists and dropped: a weaker Ranges (it only adds a parity to a number), it needs set reasoning a hint can't say in a sentence, and it clutters the disc.
