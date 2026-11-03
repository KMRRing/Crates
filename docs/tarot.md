# Tarot
French tarot (le tarot) for three, four or five, built from the placeholder (31 October 2026, Korbi: "French tarot if not already there… I want all of these"; 4 November 2026: "I want it all"), on seats.js: `tarot-rules.js` the rules, `tarot-bot.js` and `tarot-sim.js` the computer players (sampled deals: a player imagines the cards it can't see and plays what does best across them, in `tarot-worker.js` off the page's thread), `tarot-coach.js` the Hint button, `tarot.js` the page, `tarot-course.js` the course (every rule in order, then a little strategy; its puzzles are proved by the search in `tarot-solve.js`). At a table of up to five friends, or on one phone passed round ("On this phone").

Rules are the Fédération Française de Tarot's (Règlement, "Donnes libres"), checked against it on 4 November 2026:
- Petite ×1, Garde ×2, Garde sans le chien ×4, Garde contre le chien ×6; contract 56, 51, 41, 36 points by bouts; the score is ((25 + margin + petit au bout) × multiplier) + poignée + chelem, the petit's 10 multiplied too and going to whichever side takes it, whether or not the contract is made. Poignée (handful) 10, 13, 15 trumps with four (8, 10, 13 with five; 13, 15, 18 with three) for 20, 30, 40, to the side that wins the deal.
- Chelem (slam) +400 announced and made, +200 not announced and made, −200 announced and missed, and −200 when the defence takes every trick (each defender gets 200 more).
- Five players: the first lead may not be in the called king's suit unless it is the king; a called card in the dog or in the taker's own hand leaves the taker alone, four against one.
- The Excuse in the last trick changes sides, unless its side has taken every other trick; a petit sec (the 1 of trumps and no other trump, the Excuse counted as one) voids the deal (an option, on).
- The half point goes to the side that wins it (40½ with two bouts is short by a point, 41½ over by one).

Traps: the database drops empty lists, so `restore()` rebuilds a state (tests/tarot.mjs plays on from the round-tripped copy at every step). A computer player's card must not depend on cards it can't see (tested). Scores sum to zero in every deal.
