# Steelyard: design (stage 0, 4 November 2026)

Status: design only. No code, no changes to `apps.js` or any shared file. Nothing here is a ruling of Korbi's yet except the brief: "a board game like Hansa Teutonica, in the Board section, Hanseatic". Numbers are first guesses for a spreadsheet-and-bots tuning pass, not facts.

## Name

Three proposed, one chosen.
- **Steelyard** (id `steelyard`): the Hanse's London compound, and a steelyard is a brass balance beam, so the name suits the look (brass instruments) and the mechanic (weighing a rival's cogs against yours). **Chosen.**
- **Tally** (id `tally`): the notched stick merchants kept their accounts on. Short, but says nothing about the sea.
- **Peterhof** (id `peterhof`): Novgorod's German court. Strong flavour, hard to spell for most players, and the east-only association is wrong for a game that starts in Lübeck and goes everywhere.

Checked: no `steelyard*`, `tally*` or `peterhof*` file or `apps.js` id exists. Not "Hanse" (that is `factor`), not "Kontor", not "Factor". We also avoid Hansa Teutonica's own words (merchant, trader, bursar, privilege, key, kontor as a component name; its bonus markers, its two-sided Germany map).

## Pitch (3 lines)
You are a Hanseatic house. Lade cogs onto the berths of trade routes out of Lübeck; when a route is full, the house with most cogs on it seals it for good and founds a counting-house in a city at its end.
Rivals can be ousted from a berth for a mark; the one ousted chooses compensation, so a fight is a trade, not a loss.
Upgrade your five desks, collect the goods of many cities, chain your sealed routes across the North Sea and the Baltic; most renown wins in about twenty minutes.

## Rules on one page (2 to 4 players)

**Map.** 24 cities (table below), 39 routes, 73 berths. A route has 1 to 3 berths; sea routes are cogs, land and river routes carts, the same piece. Everyone starts with the right to sail from Lübeck, the mother town.

**Pieces.** Each house has 16 cogs, a **slip** (cogs ready to lade, starts with 4), 3 **marks** (coin), five **desks** (personal board, all at level 1), and gets renown only at the end.

**Desks** (level 1 is free; raising costs marks and an action):

| Desk | Level 1 | 2 (3 marks) | 3 (5 marks) | Used by |
|---|---|---|---|---|
| Quay | slip holds 4 | 6 | 8 | Muster |
| Gangway | lade up to 2 cogs | 3 | 4 | Lade |
| Purse | trade for 2 marks | 3 | 4 | Trade |
| Reach | routes touching a city you reach | also one city beyond | anywhere | Lade |
| Chancery | 2 actions a turn | 3 (cost 4) | 4 (cost 7) | the turn |

You **reach** a city if it is Lübeck, holds your counting-house, ends a route you have sealed, or ends a route on which you have a cog.

**A turn** is your Chancery's number of actions, each one of:
1. **Lade.** Pick one route you may lade onto (Reach). Place up to Gangway cogs from your slip onto its berths. A berth held by a rival can be **ousted**: put your cog there and pay 1 mark to the bank. Your own berths are never ousted.
2. **Muster.** Fill your slip from your supply up to Quay.
3. **Trade.** Take Purse marks.
4. **Raise.** Pay marks, put a desk up one level.
You may also end the turn early. Edicts (below) are played free.

**Ousting and compensation.** The ousted cog returns to its owner's slip, and the owner chooses at once: **2 marks**, or **Redress**: lade that cog (or any cog from the slip) free on an empty berth they reach, ousting nobody. Redress may fill a route and seal it. A computer player answers instantly; a person at a table has 25 seconds, then it is 2 marks.

**Sealing.** The moment the last berth of a route is filled (by anyone, including a Redress), the route is sealed: the house with most cogs on it is its **master** (a tie goes to whoever filled the last berth). One of the master's cogs stays as the **seal** (the route is closed for ever, its berths gone); the other cogs return to their owners' slips. Each house with cogs on the route that is not the master takes 1 mark. The master founds a **counting-house** in either end city that still has a free house spot (their choice); if neither has one, 3 marks instead. The city's Edict, if any lies there, goes to the first counting-house in it.

**Edicts** (12 face-up tokens on 12 cities at the start; one use each unless noted): Writ (one extra action), Convoy (lade 2 more cogs this action), Pilot (ignore Reach for one Lade), Letter of credit (4 marks), Assay (raise a desk at no cost), Free hand (ousting costs no mark this turn), Charter (kept: this house scores 2 more at the end), Double staple (kept: this house counts as two goods for the Assortment).

**Liberties** (a counting-house in these cities gives its house this while held): London, the Steelyard: the first oust each turn costs no mark. Bergen, Bryggen: slip holds 1 more. Novgorod, the Peterhof: Trade gives 1 more. Bruges: Raise costs 1 less. Visby: Reach goes one city further for routes that touch Visby. Lübeck: its house counts as any one good.

**End.** When the number of sealed routes reaches the quota (2 players 12, 3 players 18, 4 players 22), the round is finished so all have had equal turns, then the **reckoning**:
- each counting-house scores its city's number of house spots (1 to 3);
- **Assortment**: the number of different goods among your counting-houses scores 0, 1, 3, 6, 10, 15, 21;
- **Chain**: 1 for each city in your largest connected group of sealed routes, and +5 if that group touches 8 or more cities;
- each desk at level 3: 2 renown; Charters: 2 each; each 3 leftover marks: 1.
Most renown wins; a tie goes to more counting-houses, then to the house with more sealed routes. The game also ends if no house can lade anywhere (then the reckoning).
Expected score range 35 to 55. Game length target: 9 to 12 turns a player, 15 to 25 minutes with computer players pacing at 0.9 s.

### The map (schematic: bearings and order true, Holstein opened out)

| City | x,y | Good | Spots | | City | x,y | Good | Spots |
|---|---|---|---|---|---|---|---|---|
| Bergen | 14,8 | stockfish | 2 | | Lübeck | 38,59 | any | 3 |
| Stockholm | 62,14 | copper | 2 | | Rostock | 46,56 | timber | 1 |
| Reval | 84,16 | wax | 1 | | Stralsund | 54,60 | salt | 1 |
| Novgorod | 96,24 | furs | 2 | | Stettin | 55,68 | grain | 1 |
| Riga | 80,38 | wax | 2 | | Danzig | 64,62 | timber | 3 |
| Visby | 62,36 | stockfish | 1 | | Königsberg | 74,56 | amber | 2 |
| Skanör | 46,46 | herring | 2 | | Magdeburg | 45,80 | grain | 1 |
| King's Lynn | 8,58 | herring | 1 | | Brunswick | 33,82 | copper | 1 |
| London | 3,76 | wool | 2 | | Lüneburg | 33,71 | salt | 2 |
| Bruges | 8,86 | cloth | 3 | | Hamburg | 31,63 | cloth | 2 |
| Deventer | 14,74 | wine | 1 | | Bremen | 24,66 | beer | 1 |
| Cologne | 17,93 | wine | 2 | | Dortmund | 22,82 | beer | 1 |

Routes (berths): London-Lynn 1, London-Bruges 2, Lynn-Hamburg 3, Lynn-Bremen 3, Lynn-Bergen 3, Bruges-Deventer 2, Bruges-Cologne 2, Deventer-Cologne 1, Deventer-Bremen 2, Cologne-Dortmund 1, Dortmund-Bremen 2, Dortmund-Brunswick 2, Bremen-Hamburg 1, Bremen-Brunswick 2, Hamburg-Lüneburg 1, Hamburg-Lübeck 1, Lüneburg-Lübeck 2 (the Old Salt Road), Lüneburg-Brunswick 2, Brunswick-Magdeburg 1, Magdeburg-Stettin 3, Lübeck-Rostock 2, Lübeck-Skanör 2, Lübeck-Visby 3, Rostock-Stralsund 1, Rostock-Skanör 1, Stralsund-Stettin 1, Stralsund-Visby 2, Stettin-Danzig 2, Danzig-Königsberg 1, Danzig-Visby 2, Königsberg-Riga 2, Visby-Riga 2, Visby-Stockholm 2, Visby-Skanör 2, Riga-Reval 1, Reval-Novgorod 2, Riga-Novgorod 3, Reval-Stockholm 2, Skanör-Bergen 3.
To check when built: a test that no two routes cross on the drawn map, that the graph is connected, and that every city has at least 2 routes (Bergen, with 2, is the minimum); historical details (goods, spot counts, the Lynn-Bergen stockfish line) to be checked against an atlas before they ship. Lübeck as "any good" and Visby as the Gotland hub are the two deliberate liberties with history.

## What is deliberately different from Hansa Teutonica

The genre (area control by displacement on a route graph, a personal board of upgrades, set bonuses) is the same family and mechanics are free; the game below must still stand as another game.
1. **Sealed, not recycled.** A full route is closed for ever with the master's seal. In Hansa Teutonica a completed route empties and is fought over again. Here the board is consumed: the graph shrinks, cuts and bridges become the endgame, and the quota ends the game.
2. **Reach.** You cannot lade anywhere; you grow outward from Lübeck through cities you reach (Reach desk widens it). No free-floating placements across the map.
3. **Marks as the lever.** Ousting costs a mark and compensation is a choice (2 marks, or a free Redress lade). Upgrades are bought with marks, not by moving pieces from city offices onto your board.
4. **Goods and set scoring.** Cities carry goods; the Assortment scores variety, so where you found matters beyond the points of the city.
5. **Different action shape.** Five desks, four verbs, one action per `act`; no bag, no player pieces of two kinds. Our Chancery is the action count.
6. **Different map, art, words.** North Sea to Novgorod rather than a German-only board; every drawing is code (SVG), no scanned or traced art; component names are ours (cog, berth, slip, seal, counting-house, mark, desk, edict, liberty, renown).
Honest note: the feel of "outplace a rival, they get something back, a route fills" is still recognisably the genre. Sealed routes and Reach are the two changes that make it play differently; if Korbi wants it further away, add Reach-by-sea-and-land cost differences (a land route needs a cart and costs a mark to lade), not new vocabulary.

## Two players

The **Rival** (a neutral grey house, 10 cogs, no desks, no marks) lades after each full round, deterministic from the game's seed: it takes the unsealed route nearest to full, puts 2 cogs on its empty berths; if that fills the route it seals it for nobody (a blocked road; no counting-house) and that counts toward the quota (12). Players may oust Rival cogs, paying the mark to the bank; the Rival is owed no compensation. Both players start with 5 marks (the two-player table has less bite from ousting). The Rival's sealed routes count nowhere in the Chain. This makes the map close in as it does with three, and gives the leader something to be blocked by without a bot's judgement.

## Bots

The game is perfect information with no chance after the deal (muster draws identical cogs; the Rival is seeded), which suits search; the hard part is branching: a Lade is routes (up to 39) times berth choices (up to a few dozen), and a turn is 2 to 4 actions.
- **Evaluation** `V(state, seat)` = (reckoning if the game ended now, for seat) minus (the best rival's), plus shaped terms learned by self-play: marks and slip tempo, desk levels weighted by game phase, routes one cog from full that the seat would master (and that rivals would), Assortment progress, size and open ends of the largest Chain, free house spots left in cities the seat reaches, Edicts held.
- **Easy**: legal action chosen from the top 5 by a one-action greedy `V` with noise; never Raises past level 2, never uses Redress cleverly (takes marks).
- **Medium**: plans its whole turn by beam search (width 6, depth = actions left), taking the best sequence's first action; compensation by a one-step rule (Redress if it completes a route it would master, else marks).
- **Hard**: Medium's beam (width 10) plus one reply by each rival (its Medium turn, greedy), the plan chosen by `V` after the replies, worst-case against the most threatening rival (maximin, since there are no hidden cards). Time-boxed: stops at a deadline checked with `performance.now()`, returns the best plan so far (always at least Medium's).
- **Budget on a phone**: Easy under 20 ms, Medium under 150 ms, Hard under 900 ms per action on an iPhone, run in a Web Worker (as `go-worker.js` does) so the page never stalls; the state is flat typed arrays (73 berths, 39 seals, 40 house spots) cloned by `slice`, not JSON, targeting about 20 000 evaluations a second on the phone. The narrator's pace (0.9 s) hides the rest.
- **Pure function:** `bot(state, seat, { level, rng })` returns one move; it replans the rest of the turn each call (cost shrinks as actions run out). Ties are broken by `rng`, so a move worked out twice is the same.
- **Proof it is strong:** `tests/steelyard-bots.mjs` plays seeded tournaments in Node (not in the quick set: slow; the nightly runs it): Medium beats Easy at least 75% and Hard beats Medium at least 65% over 200 two-player games swapping seats, and Hard against two Mediums wins more than a third by a margin. Weights are tuned offline by hill-climbing self-play (a script beside the game, not in CI).

## How it fits `seats.js`

`steelyard-rules.js` exports the rules object (`id: "steelyard"`, `seats: { min: 2, max: 4 }`) and imports the map from `steelyard-map.js` (static, never in the state), the bots from `steelyard-bot.js` (and `steelyard-worker.js` for Hard).
- **State** (plain JSON, numbers and fixed-length arrays, because the database keeps no empty lists or objects): `{ n, opts, round, turn, left, berths[73] (-1 empty, 0..3 seat, 4 Rival), seals[39] (-1 open, else master or 4), houses[40] (spot owner, -1 free), edicts[24 cities] (id or -1), P: [{ slip, supply, marks, desks: [q,g,p,r,c], held (edict bitmask), counted }], pending: [{ seat, kind: "redress" | "house" | "order", ... }] (a queue; 0 when nothing waits), sealed, endRound, say }`. `restore` fills the holes and zero-length lists.
- **Moves**: `{ t: "lade", route, at: [berth indices] }` (empty or ousted), `{ t: "muster" }`, `{ t: "trade" }`, `{ t: "raise", desk }`, `{ t: "edict", id, ... }`, `{ t: "end" }`, and the answers `{ t: "redress", pick: "marks" | berth }`, `{ t: "house", city }`.
- `toMove(state)`: the first pending seat, else the turn's seat, null when over. `act` validates everything (Reach, slip, marks, own berths) and returns the reason as a string. `over`: the reckoning has been taken. `anytime`: `edict` is not anytime; nothing is. `wakeAt/wake`: the 25-second compensation default and nothing else. No randomness at all after `deal` except the initial Edict layout and the 2-player Rival's choice (from `rng`, which the move number seeds).
- **Table play**: a party table through `ELSEWHERE` in `party-core.js`; away seats are played by Medium. A round is a pace of `pace: 900` for bots; a person's turn has no clock. Watching frame (`IN_FRAME`): everything shown is in the state, so a partner's frame draws the same board; nothing else is kept in memory but the open route selection, which the watcher does not need.
- **Records**: `steelyard:game` (seats.js), `steelyard:opts` (level, seats, quota, Rival on/off), `steelyard:record` (games, wins, best renown), `steelyard:best` (a number) for the games screen. A finished duo match: `reportDuo("steelyard", match, { score, won })` the way Big Two reports (to be checked when building). Random mode: `roundOver("steelyard")` at the reckoning, `ROUNDS` in `random-core.js`.
- **Shared-file bill** (one Claude at a time): `apps.js` (tile in Board games, `players: [1, 4]`, Modern logo, Kontor icon), `party-core.js` (`ELSEWHERE`), `random-core.js`, `suite.js` (`DUO_GAMES`), `tests/full-screen.mjs` (`FULL` list: ambient, no title), `tests/wide.mjs` is read only. Nothing else outside `steelyard*` and `tests/steelyard*.mjs`.

## UI sketch (390x664, page never scrolls)

The page is `full` (ambient board game, no title), `beside` when held sideways. Top to bottom at 390x664: the menu mark corner and one status line (`full-pull`: "Round 4 · seals 9 of 18 · you 31 if it ended now") ~44px; the **map** in a `fit-grow` box ~350px; the **table strip** (four plates: colour glyph, marks, slip, houses; tap = reckoning breakdown dialog) 44px; the **desks** (five tiles, level pips, tap = raise sheet) 52px; the **action bar** (Lade, Muster, Trade, Raise, End; dots for actions left) 56px. At 390x844 the map takes the spare height. Sideways: map on the left, the other four parts in the side column, buttons low.
- **The map.** One SVG with a viewBox, a coarse coastline (about 150 points, hand-made, drawn as a vellum chart: ink hairlines, brass compass rose, no art files). Cities are engraved roundels with small square house spots (filled with the house's enamel and a shape glyph, so colour is never the only signal), the city's initial letters in wide capitals, goods as ten simple SVG glyphs. Routes are brass double rules (dashed for sea, solid for land) with berths as notches.
- **Tap targets (the risk).** A berth is about 14px on the map; too small. So the map taps **routes**, not berths: the whole polyline has an invisible 36px-wide hit stroke (the shorter routes get a 44px minimum around their midpoint), and a legal route is ringed. Tapping one opens the **route sheet** (a strip sliding over the table strip and desks, never over the map): the route redrawn large with 44px berth chips, each showing empty, yours, or a rival's (ousting marks it "1 mark"). You tap chips to choose where cogs go (up to Gangway), a button says "Lade 2 cogs", and the map pans to keep the route in the clear part. Cities are tappable only for their card (goods, spots, liberty, Edict); that tap is 44px.
- **Pan and zoom.** The map fits at rest (the dense Holstein corner is readable at 390 wide: nearest cities 33px apart; verify). Pinch zooms 1x to 2.5x, drag pans, double tap or the menu's Fit resets, a route selection pans and zooms to it by itself. Zoom is a view state in `steelyard:view` under a `suite:` key so it never syncs between devices.
- **Compensation prompt.** A bottom sheet at once over the action bar: "Hamburg-Lübeck: Anna ousted your cog" with two 44px buttons, "Take 2 marks" and "Re-lade it"; the second ringed eligible berths on the map. For the other players a one-line toast ("Anna is choosing"). With several cogs ousted in one Lade the sheets queue.
- **Look.** Brass instruments on a codex page, nothing 3D, no SVG filters (iPhone); gradients and stacked translucent shapes only. Day: parchment `--sheet` map, `--ink` hairlines, `--brass` rules and scale ticks, the enamels `--c0..--c3` for the four houses with a cog silhouette per house (circle, square, diamond, triangle sail). Night: navy sheet, brass lettering. Kontor and Modern strip the Codex ticks and frames in `themes.css` per the rules, so the map is plain rules and plates there; Modern's wider menu mark leaves the status line `--full-slot`. Sizes in rem except strokes and SVG text. `busy()` for the first draw only. Sound: none in v1 (a small synthesised own `steelyard-sound.js` later, not Hanse's files).
- Not Hanse's UI. No tap-to-build rings on the map; the route sheet replaces them, which is the one real interaction cost of this game.

## Effort, in stages

1. **Map data and rules engine + Node tests** (map checks, every action, ousting, sealing, scoring, end, serialisation round trip): one session.
2. **Easy and Medium bots + the tournament script**; first self-play numbers: one session. *Stop and review here: does the game have a shape?*
3. **Page**: map SVG, route sheet, desks, action bar, compensation sheet, solo play, saved state, menu: one and a half sessions. First playable.
4. **Table, party, record, themes, tablet and sideways, offline, shared-file wiring, full-screen state**: one session.
5. **Hard (worker, time box, tuning), the 2-player Rival**: one to one and a half sessions.
6. **Balance and polish** from play (quota, costs, Assortment table), a course page if wanted, docs trimmed: one session.
Total about 6 to 7 sessions; the first playable after about 3.

## Risks, plainly

- **Bot strength.** Branching is large and a good evaluation needs many hand-tuned terms; Hard may only be "much better than Medium" rather than "extremely strong" (Korbi's wish for Hanse). Self-play tuning helps but needs the tournament numbers to be believed, and Safari cannot be tested here for the budget.
- **Small tap targets** on a route graph at 390 wide. The route sheet is the answer, but it makes each Lade two taps and hides the map's lower part; if it feels heavy, the zoomed map with 44px berths is the fallback, and it is a bigger build.
- **Balance is unproven**: the quota, Assortment curve, desk costs and the Rival are guesses; a runaway (Reach 3 plus Gangway 4 early) or a stalemate (every route blocked by one cog) will show only in play. Stage 2 includes a stalemate check in the simulation.
- **Game length** on a phone: a turn of 2 to 4 actions with bots pacing at 0.9 s an action could pass 25 minutes with four players; fix by quota and by faster bot pace, not by cutting the rules.
- It is the genre's cousin; the differences above are real but modest.

## Open questions for Korbi

1. Name: Steelyard, Tally or Peterhof?
2. Goods: purely historic (as above), or fuels-flavoured nods (tallow, train oil, tar, charcoal)? I chose history, since the brief says public-domain history.
3. Max four players, or six at a party table like Chart and Punt? The map is sized for four.
4. Is the Rival acceptable for two players, or would you rather have a smaller board (20 cities) and no neutral piece?
5. Should the reckoning be visible all game ("you 31 if it ended now")? I propose yes; it helps humans and costs nothing.
6. Should Hard be allowed a full second per move on a phone, or stay under half a second?
7. A Learn course (the Hanse's history as the tutorial) now or never?
8. Compensation timer of 25 s at a table: acceptable, or no timer and wait for the person?

---

# Option B: Carrack

Moved and rebuilt (4 November 2026, Korbi: one war and trade contest for the suite, Carrack, enslavement and coercion as grievance costs, never rewards). See `carrack.md`: rules as built, the history checked and corrected, what is still unchecked. Nothing in this file about Option B stands any more.
