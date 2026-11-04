# Co-op: one board, two people

Not Crates' own co-op (a team on a shared Crates board: `coop.js`, `docs/together.md`) and not a head-to-head. This is a classic puzzle (Portolan first) that a paired partner joins and edits with you.

**Ruling, 3 November 2026** (Korbi, as given to the agent that built it): a paired partner can watch a game without asking; while watching, a "Request to join" button asks the host, and if the host accepts both are in a party of two on the host's board. "Every co-op now starts by creating a small party: a party of two (the host and the joiner) in the existing Party machinery, not a separate second system. The party ends when the host leaves." Co-op means one shared board both see and edit: "Not split regions, not a computer partner." That is about who may edit which part of the board; what each partner is shown may differ where Korbi asks for it (Bridges hides half the numbers from each: docs/bridges.md). Head-to-head modes (Chart, Quote, Punt and the other duo and party games) stay as they are.

## The flow

1. Your partner watches your solo game (`?watch=1`). Where the game is in `coop-games.js` the watching bar offers Request to join, while you are playing it on your own (`coop-ui.js`: asking, cancel, declined, no answer in two minutes).
2. Your phone shows a prompt wherever you are (`pair-ask`, in `suite.js`'s banner, its own slot beside the play-together one): Accept or Not now.
3. Accept (`coop-request.js`, `acceptJoin`): the request is claimed in one transaction, a party of two is opened (Party's own room and table, `coop` set, you seated first), the game's own request is put in the party's room with your board in it, and only then is the partner told yes. Both phones go to `<game>.html?room=CODE&new=…&party=CODE&at=…&coop=1`.
4. Whichever phone arrives first deals the room's game from that board (`together.js`, as any duo match); the other sits down at it. Seats belong to players (`pid`), not devices; a reload, or a phone that comes late, sits down again where it was.
5. The game's bar says "Co-op with <name>" and whether they are here, with Leave (End, for the host). The host ending deletes the party: the partner is told "<host> ended the co-op" and is back on their own puzzle. The guest leaving marks it in the room; the host is told and is back on their own puzzle, the shared progress in it. The guest's own run is never written during the co-op.

`&coop=1` keeps `party-link.js` out of the page (no host choosing games in a party of two); the game's own menu has the way out.

## A board

What a game shares is a `board` in its room branch (`board-share.js`): `fixed` (the puzzle, never changes), `layers` (one string a layer, one character a cell: the database keeps no empty lists and reads lists back with holes, and a string is whole or absent), `tally` (counts that only grow: hints), `once` (set by the first writer: the solve), `start`, `rev`. Nobody writes the board: a change is a small **edit** (`cellEdit(layer, i, from, to, weak)`, `tallyEdit`, `onceEdit`) applied inside the room's transaction on the board as it is then, so two edits at once to different cells both stand. The same cell changed two ways: the later edit wins; an undo is `weak` and only puts back what it finds as it left it. A game's own rules (`rules.merge`, `rules.frozen(board)`) go in its adapter. `createEditor` shows an edit at once, sends it, and always shows the room's board with the edits not yet in it laid on top, so a phone that drops off keeps what it drew and sends it back merged.

## Plugging a game in

1. `<game>-coop.js`, pure (no page, so a phone can load it from any page): `share(saved)` (the host's saved keys, `{ key: text }` → `{ fixed, layers, tally?, start? }`, or null when there is nothing to share), `run(board)` (the board → what the game's page wants), `valid(board)`, optional `rules`. Model it on `slitherlink-coop.js`.
2. Register it in `coop-games.js` (id, name, page, `keys`, `load`). The watching bar and the prompt follow from that; `apps.js` `players` becomes `[1, 2]` and `tests/games-find.mjs` already counts `COOP_GAMES` as two. A co-op game is deliberately **not** in `DUO_GAMES` or Party's `ELSEWHERE` (those are matches dealt in the pair's room or a table, with tests of their own).
3. The page: `startCoop(id, { toast, fresh, show, bar })` from `coop-page.js` when `&coop=1` and `room=` are in the address (see `slitherlink.js`, `COOP`). `show(board, { fresh, host })` draws; every change is `coop.edit(…)` instead of a change to the page's state; the host's page keeps writing the run key (so a watcher, the host's other devices and the host's return to solo see the shared progress), the guest's never does; the clock is the team's wall clock from `board.start`; no solo bests, dailies or `roundOver` for a co-op solve; the menu says Leave or End and Another puzzle (`coop.renew(share)`).
4. Test the adapter and its edits in Node (`tests/board-share.mjs`, `tests/coop-request.mjs` show how, on `tests/fake-db.js`), and look at it with two phones.

## Looking at it

`tools/two-phones/` puts two browser contexts on one database in memory (`server.mjs` serves the repository and answers `/__db/*`; `shim.js` is what every page gets as `window.__cratesSync`; `phones.py`, Playwright for Python: `python`, not `python3`). Phones are partners on pair code TEST. Chromium only; Firebase itself is not reached.

## Edges

- Leaving a co-op page by another route than Leave (the apps menu, the browser's back) leaves the co-op open: the partner sees "(away)" and can Leave or wait; the address brings you back.
- A party of two opened this way is a party room like any: it is not shown as one in Party.
- The team clock counts the wall time since the board was shared, menus open or not (duo clocks never stop).
- Today's puzzle solved together must come back from `run(board)` as a plain `random` one: the host's run key follows the board, and a run left `daily` and done would use up the host's day with a time nobody earned alone (a line in each adapter's test).
- Anything a page draws before it sends (Nonogram's drag, sent when the finger lifts) must be laid over the room's board in `show`, or a partner's edit arriving mid-gesture replaces it.
- A rule that spans cells (Codeword's one letter on one number) can't be written as `rules.merge(layer, base, mine, theirs, weak)`, which sees one cell, so two edits at once can break it; `run(board)` would have to settle it the same way on both phones.
