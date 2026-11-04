# Hearts
Hearts for four (4 November 2026), against three computer players or at a table with friends each on their own phone (README, Seats): pass three cards (left, right, across, then none), the 2♣ leads, a heart is a point and the Q♠ thirteen, the lowest score wins when someone reaches 100 (Menu: 50, 100, 150). Shooting the moon scores the shooter nothing and the others 26 each (Menu: 26 off the shooter's own score instead). Easy, Medium and Hard computer players (`hearts-bot.js`: Medium plays rules of thumb, Hard guesses the hidden hands and plays each choice out, perfect-information Monte Carlo). Flat table by default, 3D in the menu (`hearts-3d.js`). The narrator stays silent here (it speaks only for the Chinese games, `SPOKEN_TABLES`).

House rules the sources differ on, as built: the Q♠ alone doesn't break hearts (only a heart does); the first trick takes no points unless every card you hold has some; a tie for the lowest score past the target plays another hand; hand 4 of each four is held (no pass).

Traps:
- The pass is simultaneous: `give` and `next` are `anytime` moves, and `toMove` in the pass is the first seat yet to choose, so a person may pass before their turn and the computer players wait only until that first seat has.
- A finished trick and a finished hand are timed steps (`trick`, `shown`; `wake` resolves them), so `toMove` is null while they show. Tests shorten the clocks by wrapping `act` and `wake`, not by changing the constants.
- `hearts-rules.js` and `hearts-bot.js` import each other: nothing in either may read the other's exports while the module loads (only inside functions).

Lessons (Menu, Learn; 4 November 2026, Korbi: lessons are "a 'lessons' tab accessible there same as any other lesson for these games"): `hearts-course.js` on the suite's course sheet and card stage, progress key `hearts:course`. The stage writes cards with the 3 lowest and the 2 on top (a Big Two order), Hearts has the 2 lowest: the course converts with `toId`, so write cards as the stage does and never feed its ids to the rules. `tests/hearts-course.mjs` proves every example on the engine and on Medium's rules (the lessons teach what it plays).
