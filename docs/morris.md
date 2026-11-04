# Nine Men's Morris
Classic Nine Men's Morris (4 November 2026; Korbi: "nine mens morris wanted, just classic, 2d and 3d."): against the computer (Easy, Medium, Hard), two on one phone, a partner's match or a table of friends (seats.js), with a coach (Hint: the best move and who is ahead), a Learn course and a 3D view (Menu, View: the board tipped away from you, pieces as stacks of CSS slabs; flat is the default). Rules belong to no one; the engine is ours, nothing is vendored.

Rules: nine pieces each placed in turn, then slid along a line, flying at three; closing a mill takes a piece (outside a mill unless all are in mills); lose at two pieces (counting the hand) or with no move; the third occurrence of a position is a draw. No draw by move count.

Traps:
- A move is one number with its capture in it (`morris-board.js`); the page collects the taps (point, or piece then point, then the piece to take) and makes the move whole, so a saved game and a partner's frame only ever see finished moves.
- The computer's levels are node budgets, not clocks. Hard runs in `morris-worker.js` and primes `ready`; without a worker it searches on the page.
- Hard's root window is `best - tie - 1` so that the bounds alpha-beta returns for the other moves never fall inside the tie band (this once made Hard lose to Easy).
- Course positions are checked by `tests/morris-course.mjs`; `mill: true` says the answer must close a mill, `proved` that the search finds it best.
