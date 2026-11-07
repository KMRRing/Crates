# Tuesday list: one line of context per item

Source: Korbi's doc "Tuesday plan: app todo and Settle foundry" (6 Nov 2026), whose Settle game plan is the spec for wave 4's first item. Read `CLAUDE.md` first. Work one wave at a time; ship each item (quick tests, pull --rebase, push, CI green) before the next. Where an item says **ask**, Korbi's symptom was said in an earlier session and is not written down: ask him in one line before touching code. Sonnet 5.5, medium effort is his setting for agents.

## Wave 0: cheap fixes (own games only)
- **Random never lands on a solved puzzle:** `random.js` / `random-core.js` (`ROUNDS`). For puzzle games with a daily or fixed level, skip ones whose result is already recorded. Test in `tests/random.mjs`.
- **Origin: clue as a setting:** `origin.js`, `origin-engine.js`. A menu `toggle` under settings (`menu.js`), key `origin:…`.
- **Chart: world plus six continents; globe colour flash:** `chart.js`, `chart-globe.js`, `chart-engine.js`. Trim the region list; the flash is a bug to reproduce in a browser first.
- **Lode clue/item bug:** `lode*.js`. **Ask.**
- **Remove the computer partner** from Nonet (`sudoku`), Mines, Calcudoku, Tally (`kakuro`), Ladder: delete the bot-as-partner choice and `*-bot.js` use where it is a partner (co-op with a human stays). Update each game's test.
- **Ladder fixes, Crossword buttons, Codeword clue cap:** **ask** (`ladder*.js`, `crossword*.js`, `codeword*.js`).

## Wave 1: shared files (Korbi must say nobody else is in them)
- **Menu consistency:** rules live on one page inside Learn; the topics link goes Back to menu. `menu.js`, `topics-ui.js`; touches every game's menu part, so do it by script where possible.
- **Shared easy/medium/hard control:** reverses Korbi's 4 November "no difficulty picker, use `ramp()`" ruling. **Ask him to confirm** before building; then one control in `menu.js` and a mapping onto each game's `ramp` start.
- **Shared 3D camera kit:** one module for orbit/zoom/reset used by the 3D views (see `hong-3d.js`, `shunt-view-3d.js`, `bridges-3d.js` for the three current styles); first user Mahjong, then the rest.
- **Sound-audit test:** `tests/` file that loads each game's sound module (`*-sound.js`) and fails on a game with sound code that never respects the mute setting.

## Wave 2: shared mahogany card table
- **Table frame, Guandan (`tribute`) and Schafkopf first:** one `style.css`/module frame (felt-less mahogany table, brass rail) the card games draw inside; `trumps`, `tribute`, `landlord`, `bigtwo`, `hearts` later. 3D kit precedent: `table3d` code (`git show e2c62ef8:docs/table3d.md`).
- **Bavarian cards restored from git history, default:** find the deleted Bavarian deck art with `git log --diff-filter=D --name-only -S"Bavarian"`; restore it as an option of the card kit (`deck.*`, shared) and make it the default for Schafkopf.

## Wave 3: board frame and 3D
- **Board frame shared by board games:** same idea as the card table for `chess`/`gambit`, `river`, `go`, `flank`, `crown`, `silo`, `morris`, `gammon`.
- **3D for Mahjong, Xiangqi (`river`), Rack, Liar's dice (`boast`):** Mahjong already has a 3D view (`hong-3d.js`, `hong-gl.js`), do the other three with the camera kit.
- **Chess and Go strength settings:** a strength choice in the menu's settings part mapped to engine depth/time (`gambit` Arasan engine under `vendor/`, Go engine in `go*.js`); keep the licence rule.
- **Reversi (`flank`) and Nine Men's Morris (`morris`) "looked at":** **ask** what Korbi wants changed.

## Wave 4: rebuilds
- **Settle foundry:** spec is the Settle section of the doc (4 crucibles, metals settle by density, orders are w×k blocks that drain, 8 tiers of 3 levels, zinc dross, iron carbon and Blow, German guild names with English beside). Files `settle-engine.js` (pure rules + `tests/settle.mjs`), `settle-levels.js`, new `settle-alloys.js` (all recipes in one file for the fact check), `settle.js/.css/.html`, `settle-3d*.js` kept or dropped. Defaults Korbi has not vetoed: tier 1 three columns, tier 6 iron, tier 7 mint. Random: `ROUNDS` entry, `roundOver("settle")`. Daily: `settle:daily`.
- **Fathom (`yield`), Isomer, Landfall:** **ask** what the rebuild is for each. Landfall is also a standalone repo (KMRRing/landfall): use `tools/standalone.mjs`.
- **Courier combat rules:** `reckoning-*.js` (Courier's file prefix). **Ask** for the rules Korbi wants.
- **Gears (`pipes-gear-*`):** disc boards for all levels are DONE (7 Nov) and Korbi, playtesting, calls the levels almost perfect; levels in the low 40s start a little light (more feedback from him later: wait for it, do not retune on your own). Left: central arbor target with large hour and minute hands, tighter spacing, round 3D case check (`pipes-3d-*`, `pipes-view-2d.js`). Standalone repo KMRRing/gears exists.
- **Heliograph:** **ask**.
- **Harbour first slice:** maps as menus (world, region, puzzle), income per puzzle from stars and/or activity (`harbour-world-ui.js`, `harbour-campaign.js`, `harbour-season*.js`). Income accrues only for weeks played unless Korbi says real time.

## Wave 5: content and polish
- **Levels:** Bridges (`bridges-levels.js`), Shunt (`shunt-levels.js`; standalone repo KMRRing/shunt).
- **Difficulty tiers** for Dujiang (`nurikabe`; standalone repo), Moor, Asterism, Delta, Spot: via `ramp()` unless wave 1's shared control has landed.
- **Sound:** **ask** which games.
- **Lanterns rocks:** `lanterns-3d.js`, `lanterns-model.js` (3D scene must be a port or strait opening to the sea); standalone repo KMRRing/lanterns.
- **Carrack coach:** menu coach on/off; on = check plus hint (`carrack-coach.js`).
- **Topple test page:** a page that runs every twist feature in order (`topple-levels.js`, `topple-engine.js`) so heavy tiles, springs etc. show fast; keep it out of the games screen and offline list if dev-only.
- **Columbiad 4-6 dwell goal:** `columbiad-levels*.js`; **ask** the target.
- **Drift hold button:** `drift.js`, `drift-engine.js`. **Ask.**
- **Loose cargo zoom and highlight:** Stow (`stow-loose.js`, `stow-3d.js`). **Ask.**

## Housekeeping
- `node tools/pick-tests.mjs --measure` on a quiet machine to refresh `tools/test-times.json` (shared: tell Korbi).
- Fact and quote audit of Constitutions and Statecraft (`constitutions*`, `statecraft*`, `kb/`) after all additions: read each claim against a source; list what you could not verify rather than fixing from memory.

## Waiting on Korbi (do not decide)
Acrostic's fate; the Statecraft tile name; Netting and Slipway to the Appendix (count 106; Order keeps its name, Korbi 7 Nov); Portolan free-play 3D report (probably fixed); the "check" tag only on the lesson screen. His phone-only checks: Constitutions/Statecraft screens, Gears destination gear, Columbiad moon levels, Portolan First landfall in 3D.
