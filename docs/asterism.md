# Asterism
Star Battle (4 November 2026, named per the Nikoli rule in `classics.md`; "star battle" is a search keyword only). N×N board in N regions, K stars (1, or 2 on 8 to 10) in every row, column and region, no two touching even diagonally. One answer per puzzle, proven by a plain row-by-row search (`answers`); level is the hardest step the solver needs: Easy (a star's surroundings, full groups, just enough room), Medium (a group's few ways, a star that leaves a group no room, a region held to a line), Hard (counting across two lines, a trial within 4 rounds), Expert (three lines, a longer trial).

- Tap cycles empty, dot, star; hold or right-click makes a star; a drag dots. Only stars count; dots are notes.
- Two stars a row has no Easy (none exists: they need Medium steps from the first move) and 5×5 has no Expert; `levelOn`/the line say so. Two stars start at 8×8 (7×7 and smaller made no unique puzzle).
- Times are lowest-first in `asterism:times`, not `:best` (the games screen reads `:best` as highest-is-best); the tile shows today's time.
- Not done: a pair or party mode, a computer rival.
