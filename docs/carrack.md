# Carrack

A contest for trade from the Baltic to China, c. 1480 to 1650, for two to six of nine powers (Hanse towns, Portugal, Venice, the Ottomans; Ming China, Gujarati merchants, Malacca, Ryukyu, the Swahili city-states: at most three of the first four at a table). Eight rounds, each a trading year in one era (1480 to 1497, 1498 to 1516, 1517 to 1539, 1540 to 1564, 1565 to 1589, 1590 to 1611, 1612 to 1631, 1632 to 1650). Every power sets up to three secret orders at once; they are carried out together (pay, move, battle, found and claim, income, the era's events). Files: `carrack-map.js`, `carrack-rules.js`, `carrack-orders.js`, `carrack-bot.js`, `carrack-expert.js`, `carrack-book.js`, `carrack-coach.js`, `carrack-think.js`, `carrack-worker.js`, `carrack-course.js`; `tests/carrack.mjs`, `tests/carrack-balance.mjs`, `tests/carrack-seats.mjs`, `tests/carrack-coach.mjs`, `tests/carrack-course.mjs`; `tools/carrack-arena.mjs`, `tools/carrack-book.mjs`. The page (`carrack.html`, `.js`, `.css`) and the tile are stage 2 (4 November 2026).

## Rulings

- 4 November 2026, Korbi: the suite gets one war and trade contest, reframed as Carrack; enslavement and coercion are grievance costs, never rewards. This replaces Option B in `steelyard-design.md`; Option A (Steelyard) is not built.
- No order gains from anyone's suffering. Attacking a port is a bombardment: one grievance token for the attacker, win or lose. The events that record enslavement (Atlantic, from 1526; the east coast, from the 1550s) or forced labour (Potosí's mita, 1573) give the holders of the ports concerned tokens and nothing else. A token is -2 standing at the end and is paid down only in silver (4 for one), never erased. Unrest (4 or more tokens) costs a fort or a fleet. `tests/carrack.mjs` checks that those events change no silver, port or fort.
- Standing: 2 for a port held, 1 for a factor, 3 for a monopoly, silver/8, -2 a token. (The design said 1 for a port and silver/4; silver then decided every game because three orders a round cannot spend it.)
- A monopoly is the most source ports of a good (held or a factor in), at least two, alone. Six goods, not five: gold (Elmina, Sofala, Kilwa) was added so West Africa and the Swahili coast have a prize. Silver's later sources wake with events (Hakata 1526, Seville 1545).
- Each power has a start silver and a `base` revenue (a named line in its income: league dues, the Estado's upkeep…) that exist to even the nine out; they were tuned against 1000-game runs of Medium players. Change a power's special rule, silver or base and re-run `tests/carrack-balance.mjs` with `GAMES=1000`; the win rate is steep in Portugal's and Hanse's start silver.
- Cut from the design: "demand terms" after a battle, the Swahili yearly change of alliance, the pirate die in combat, the -1 against the monsoon (a monsoon lane is simply sailed one way a round), a `sell` order, Kongo and Kilwa refusing a contract (there is no contract to refuse).

- 4 November 2026, Korbi: "carrack should have a nice scrollable globe map. I currently can only see the routes, not even land/water behind it." The globe (`carrack-globe.js`, `carrack-board.js`; Chart's camera and Natural Earth land, copied, no modern borders) is the default; the flat schematic stays as Menu, Map, Flat.

- 5 November 2026, Korbi: Carrack should be a deep top-tier strategy game, "very powerful bots and a learning section and a coach with off/hint/check/always". The menu's "Coach help" choice (not labelled "Coach", which `tests/menu-minimum-games.mjs` reserves for on/off switches) is Off, Hint, Check, Always, as he asked for this game by name; Learn is in the play part. His rule that the menu is the minimum stands: nothing else was added.

## The computer players

Easy, Medium and Hard are the greedy planners of `carrack-bot.js` (Medium's one-year value `valueOf`; Hard plays Medium's alternatives one year ahead). Expert (`carrack-expert.js`) is the top of the ramp: it samples the others' orders (each rival's greedy plan and noisy variants), plays its own candidates (greedy, other openings, noisy, shorter) through the real `resolveRound` on shared dice against those samples, then plays the best few a second year, and judges the position by `valueOf` against the strongest rival (`TUNING`). It knows the dated events, not the hazards. It stops at its `budget` (ms). `tools/carrack-arena.mjs` runs self-play (`play`, `balance`); `TUNING` was tuned with it. **Tuning (5 November 2026, 17 settings, 300 games each against Hard, then 500 against the default).** `TUNING` sits on a plateau: every setting but the noise is within sampling error (s.e. 2 to 3 points) of the default; noise 0.8 is worse (45.8% against the default), and a combination of the best guesses (more noise, rival weight 0.9, 8 noisy plans, 6 deep, worst 0.3) ties it (49.9%). Not worth a change; the budget, not the weights, is what the time buys. Tune with `--a '{"level":"expert","budget":100000}'` (no time limit, so a loaded machine cannot change the result).

**The opening book** (`carrack-book.js`, built by `tools/carrack-book.mjs`: each candidate year played over the same 250 games against Medium players, the best of the top four kept after 800) adds a power's first two years as one more candidate and always plays it a second year, so it is set only when the search finds it as good. Medium's own openings are poor for most powers (Ottomans year two: 40% to 63% of games won; Hanse year one 22% to 36%), so the book is worth a lot: Expert with the book beats Expert without it 58.1% (400 games, 2 against 2). An empty entry means Medium's own play was best. Change a rule and rebuild it (about 15 minutes on four cores).

| 2 Expert against 2 of | before | after (shipping budget, 300 games) |
|---|---|---|
| Hard | 60.9% | 64.1% |
| Medium | 69.8% | 74.3% |
| Easy | 86.6% | 84.5% |

Four Experts, each power's win rate, 400 games (an even field is 25%): without the book Hanse 14, Portugal 30, Venice 21, Ottomans 43, Ming 25, Gujarat 9, Malacca 21, Ryukyu 12, Swahili 51; with it 13, 28, 19, 44, 21, 6, 30, 15, 46. The book did not even them. It is not the rules: four Medium players give 21 to 28% for every power (1000 games, base 9000). The base revenue is steep at Medium and flat at Expert (Gujarat +2 and Swahili -1: Medium Gujarat 37% and Swahili 16%, Expert Gujarat 14% and Swahili 38%), so a nudge that evens Expert breaks Medium. Left alone: Swahili and Ottomans are what a good planner makes of their starts; Gujarat's one fleet and Hanse's thin silver are what it cannot.

A regression of the final standing on features of the position, mixed into that value, was tried (5 November 2026) and won 49 to 51 percent against the plain value, so it is not kept.

The page thinks Expert in a worker (`carrack-think.js`, `carrack-worker.js`) as a year begins and holds the computer players' orders until they are in (`hold`); `thought` is keyed by the position, so an old answer never meets a new game. Where the worker is late or absent, `bot()` thinks on the page with a shorter budget.

## The coach

`carrack-coach.js`'s `weigh` runs the Expert's search with the player's own orders added as a candidate, so they are judged on the same sampled replies and dice as its choice; a set within `GAP` standing points of the best is "the same". Hint asks on demand; Check weighs the orders on Send and asks "Send mine / Change them" when they are clearly worse; Always shows its orders at the top of each year. Its "why" is the difference in the average year's end (ports, factors, silver) between the two sets, not a claim about the future.

## History: corrections to the design, and what is not checked

Checked against sources (4 November 2026): the Hanse Peterhof at Novgorod was closed by Ivan III in 1494 and reopened in 1514; the Steelyard in London was closed by Elizabeth I in 1598; the Ming relaxed the sea ban in January 1567 at Yuegang only, for Chinese merchants (so Ningbo stays closed to foreigners all game); Iwami silver began in 1526 (Kamiya Jutei); Banda before 1621 about 15,000 people, after it about 1,000 remained (Loth and Corn) or 90 percent killed, enslaved or deported (Lape), Coen's attack on Lontor began 11 March 1621.

Corrected from the design: Zheng He's last voyage (1433) is before the game and is not an event; Venice's premium is on Alexandria, not Cairo; the Hanse's "cheap cogs" are hulks by 1480 (the bonus is cheap kontors, factors without a fleet in the Baltic and London); a round is a year in an era, not a season, so dated events fall in their era's round; the Ming sea ban lifts at Yuegang, not everywhere.

Recalled, not opened (a reviewer must check): Elmina fort 1482; Almeida at Kilwa and Mombasa 1505; Goa 1510; Malacca 1511 (Pires' remark is from the outline); Egypt 1516 to 1517; Afonso I's letters 1526 (outline); Potosí 1545; the east-coast enslavement as a mid-century event (volumes are argued); Manila galleons 1565 to 1571; Nagasaki 1571; the mita 1573; Satsuma and Ryukyu 1609; Japan's edicts 1633 to 1639; the Ming fall 1644; Gujarati merchants' free passage and "carrying for others" as an abstraction; the Ottoman toll on the Constantinople and Red Sea lanes. Port values, distances in days and the schematic coordinates are the author's.

## Traps

- Orders are simultaneous but `seats.js` has one `toMove`. `carrack-orders.js` uses Hearts' trick: setting orders is `anytime`, `toMove` is the lowest seat yet to set them, the last set resolves the round. `toMoveAll` (added to `seats.js`, 4 November 2026) lets the runner set every computer player's orders at once; a game without it behaves as before.
- The log lines are the page's text: the battle line carries the dice as `dice 6·5 (+1) against 4·3 (+0)`, which `carrack.js` turns into dice; change the wording and change `diceHtml` too. The powers are named so a verb agrees ("Hanse takes", not "Hanse towns takes").
- The state keeps `pend[seat]` as 0 or a never-empty list (`[{ t: "pass" }]` for nothing); `restore` rebuilds everything the database drops.
- Schematic map: x/y keep compass order only (the test checks it); do not "correct" a coordinate toward true scale, the names no longer fit. Labels are placed by `lab`; a new port needs the overlap test re-run.
- A fleet is also the escort of a caravan: lanes marked `c` carry fleets too.
- Globe lanes are great circles through `GVIA` (carrack-map.js), the turns that keep a sea lane off land: found by a path search over the 110 m coast, then thinned by hand. A new lane or port needs `tests/carrack-globe.mjs` to pass, which fails for a sea lane across land. The land is coarse (a port may sit a degree from its coast on it); lon/lat are the real places and the engine never reads them.
- `carrack-course.js`'s scenes are real states and every answer is worked out from the rules by `calc` (or `valid`, the one option the rules accept); `tests/carrack-course.mjs` fails when a lesson's answer is not the rules'. A lesson that states a number states it through a calc.
- The coach and the bot call `resolveRound` with `hazard: false`, so they look at a year the dice and events of history decide but not at plague, typhoon or the monsoon failing.
- The book's second year is conditional on the first (it moves a fleet the first year put there): `bookOrders` entries are candidates, checked by `checkOrders` like any other, never forced.
- The coach lists two sails of one lane as one ("Sail 2 fleets"): the planner sends a single fleet twice.
- `tests/carrack.mjs` holds a second rulebook written from this page; if a rule changes, change both.

**4 November 2026, Korbi: the menu is the minimum it needs to be.** The menu is Powers at the table (2 to 6), Map (Globe or Flat) and the walkthrough. Your power and Computer players are gone: your power is drawn by lot, and the computer players' strength is the hidden ramp (`carrack:ramp`, up a step after a game won, down after one lost; its first step is the level that was saved).
