# Yacht
The old five-dice score-sheet game (4 November 2026, Korbi: "yacht, 2d and 3d"), alone for a best score and a daily, or with up to three computer players or friends at a table (README, Seats). Twelve rounds, each three rolls with holds, then one of twelve categories; Ones to Sixes with a bonus of 35 for 63, full house, four of a kind, the two straights (30), choice and yacht (50).

- The commercial version of this game is a trademark: its name is written nowhere in the game, the search keywords or the code.
- The brief said "13 rounds, 12/13 categories"; the twelve named categories are the whole of Yacht, so it is twelve rounds. Full house and four of a kind score the sum of all five dice, and five alike is four of a kind but not a full house.
- Every die comes from the game's base and its place (round, seat, roll, die), never from the move's own stream or from what was held: the same dice for the same base however you hold, which is what makes the daily comparable. Do not draw dice from `rng` in `act`.
- The 3D throw (`yacht-3d.js`) is decoration: the faces are the game's, the tumble only lands on them, and where a die lies comes from the seed.
- Alone, the best is `yacht:best` and a daily's day is in `yacht:daily` by date; games against others keep wins in `yacht:record`.
- Lessons (Menu, Learn; progress `yacht:course`; 4 November 2026, Korbi: "a 'lessons' tab accessible there same as any other lesson for these games"). `tests/yacht-course.mjs` proves every score, every chance (exact counts) and every hold or box against the engine and the Hard computer player; a percentage in a lesson's words must be one a step checks. A hold or box that Hard disagrees with fails the test, so change the lesson, not Hard.

**4 November 2026, Korbi: the menu is the minimum it needs to be.** The menu is Today's, Players (Alone, 2, 3, 4) and View. Computer players and Score with one tap on a row are gone: the computer players' strength is the hidden ramp (`yacht:ramp`, up a step after a game won, down after one lost; its first step is the level that was saved), and a row is picked, then Score.
