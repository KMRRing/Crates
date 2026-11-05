# Delta
A field of hexes with gaps: join the numbers in pairs with paths through operations (+4, −2, ×3, ÷2) so each value arrives exactly, every operation used once, blank hexes optional (rules: header of `delta-gen.js`). Easy: two pairs, + and −, the pairs marked, running value and instant marks. Medium: three pairs, adds ×, big numbers, two clues. Hard: the crowded 37-hex hexagon with five gaps, adds ÷ and fractions, no running value, marks only once every number is joined. Together: a pair or a party of up to six draw on one board, each path in its drawer's colour.

## Rulings
- Mental maths stays light at every size: times tables on small numbers, round numbers times small ones, shifts by 10, 100 and 1,000, round steps on big round numbers, simple halves, thirds and quarters. A big number hints at the operation that made it (13,500 wants the ×1,000), never a sum like 259 × 13.
- 3 November 2026, Korbi: "the paths tend to be too short, especially on the easier level no maths needs to be done because the connection tends to be bundled. The generator algorithm needs to be much smarter such that the final solution has lots of long chains and the user has to fit them together across the map. Maybe a metric to look at is how many walls between cells separate the streams of two different answers. For a solution that looks good, this number is quite high." So the answer a board is built from is laid first, as long chains over the whole field, held to floors (`LEVELS`, `shape`, in `delta-gen.js`, with the reasons); walls are the borders between hexes of two different pairs' paths (`delta-metrics.js`).
- Opened in a room, the page shows the mark until the table's board is drawn, never your own board meanwhile (until October 2026 your own was drawn first and the shared one replaced it seconds later).

## Traps
- A board is dealt only with exactly one drawable answer, full of lures (single paths that add up and can be drawn alone but belong to no answer). Lure and decoy targets relax first, the floors on the shape only in the last phase, the one-answer rule never.
- The same seed must give the same board on every phone (today's board, shared links): tries are counted, never timed, and nothing that deals a board may use `Math.exp`, `pow`, `log` or trig, which differ in the last bit between browsers (`tests/delta-gen.mjs` reads the source for them).
- A new generator changes every seed's board: bump `GEN` in `delta-gen.js`, so spare boards kept in browsers (key `delta:spares<GEN>`) are dropped quietly; a link or an earlier Today's board deals differently under it.
- Where the worker can't run, boards are dealt on the page; a board asked of a worker that failed once never came.

**4 November 2026, Korbi: the menu is the minimum it needs to be.** The menu has no choices but Today's. The level is the hidden ramp (`delta:ramp`, up after a board solved without a clue; first step the level of the board that was kept).
