# Carrack

A contest for trade from the Baltic to China, c. 1480 to 1650, for two to six of nine powers (Hanse towns, Portugal, Venice, the Ottomans; Ming China, Gujarati merchants, Malacca, Ryukyu, the Swahili city-states: at most three of the first four at a table). Eight rounds, each a trading year in one era (1480 to 1497, 1498 to 1516, 1517 to 1539, 1540 to 1564, 1565 to 1589, 1590 to 1611, 1612 to 1631, 1632 to 1650). Every power sets up to three secret orders at once; they are carried out together (pay, move, battle, found and claim, income, the era's events). Files: `carrack-map.js`, `carrack-rules.js`, `carrack-orders.js`, `carrack-bot.js`; `tests/carrack.mjs`, `tests/carrack-balance.mjs`. The UI and the tile are not built (October to November 2026: stage 1).

## Rulings

- 4 November 2026, Korbi: the suite gets one war and trade contest, reframed as Carrack; enslavement and coercion are grievance costs, never rewards. This replaces Option B in `steelyard-design.md`; Option A (Steelyard) is not built.
- No order gains from anyone's suffering. Attacking a port is a bombardment: one grievance token for the attacker, win or lose. The events that record enslavement (Atlantic, from 1526; the east coast, from the 1550s) or forced labour (Potosí's mita, 1573) give the holders of the ports concerned tokens and nothing else. A token is -2 standing at the end and is paid down only in silver (4 for one), never erased. Unrest (4 or more tokens) costs a fort or a fleet. `tests/carrack.mjs` checks that those events change no silver, port or fort.
- Standing: 2 for a port held, 1 for a factor, 3 for a monopoly, silver/8, -2 a token. (The design said 1 for a port and silver/4; silver then decided every game because three orders a round cannot spend it.)
- A monopoly is the most source ports of a good (held or a factor in), at least two, alone. Six goods, not five: gold (Elmina, Sofala, Kilwa) was added so West Africa and the Swahili coast have a prize. Silver's later sources wake with events (Hakata 1526, Seville 1545).
- Each power has a start silver and a `base` revenue (a named line in its income: league dues, the Estado's upkeep…) that exist to even the nine out; they were tuned against 1000-game runs of Medium players. Change a power's special rule, silver or base and re-run `tests/carrack-balance.mjs` with `GAMES=1000`; the win rate is steep in Portugal's and Hanse's start silver.
- Cut from the design: "demand terms" after a battle, the Swahili yearly change of alliance, the pirate die in combat, the -1 against the monsoon (a monsoon lane is simply sailed one way a round), a `sell` order, Kongo and Kilwa refusing a contract (there is no contract to refuse).

## History: corrections to the design, and what is not checked

Checked against sources (4 November 2026): the Hanse Peterhof at Novgorod was closed by Ivan III in 1494 and reopened in 1514; the Steelyard in London was closed by Elizabeth I in 1598; the Ming relaxed the sea ban in January 1567 at Yuegang only, for Chinese merchants (so Ningbo stays closed to foreigners all game); Iwami silver began in 1526 (Kamiya Jutei); Banda before 1621 about 15,000 people, after it about 1,000 remained (Loth and Corn) or 90 percent killed, enslaved or deported (Lape), Coen's attack on Lontor began 11 March 1621.

Corrected from the design: Zheng He's last voyage (1433) is before the game and is not an event; Venice's premium is on Alexandria, not Cairo; the Hanse's "cheap cogs" are hulks by 1480 (the bonus is cheap kontors, factors without a fleet in the Baltic and London); a round is a year in an era, not a season, so dated events fall in their era's round; the Ming sea ban lifts at Yuegang, not everywhere.

Recalled, not opened (a reviewer must check): Elmina fort 1482; Almeida at Kilwa and Mombasa 1505; Goa 1510; Malacca 1511 (Pires' remark is from the outline); Egypt 1516 to 1517; Afonso I's letters 1526 (outline); Potosí 1545; the east-coast enslavement as a mid-century event (volumes are argued); Manila galleons 1565 to 1571; Nagasaki 1571; the mita 1573; Satsuma and Ryukyu 1609; Japan's edicts 1633 to 1639; the Ming fall 1644; Gujarati merchants' free passage and "carrying for others" as an abstraction; the Ottoman toll on the Constantinople and Red Sea lanes. Port values, distances in days and the schematic coordinates are the author's.

## Traps

- Orders are simultaneous but `seats.js` has one `toMove`. `carrack-orders.js` uses Hearts' trick: setting orders is `anytime`, `toMove` is the lowest seat yet to set them, the last set resolves the round. A computer player behind a slow person waits for them; fixing that needs a `toMoveAll(state)` in `seats.js` (shared).
- The state keeps `pend[seat]` as 0 or a never-empty list (`[{ t: "pass" }]` for nothing); `restore` rebuilds everything the database drops.
- Schematic map: x/y keep compass order only (the test checks it); do not "correct" a coordinate toward true scale, the names no longer fit. Labels are placed by `lab`; a new port needs the overlap test re-run.
- A fleet is also the escort of a caravan: lanes marked `c` carry fleets too.
- `tests/carrack.mjs` holds a second rulebook written from this page; if a rule changes, change both.
