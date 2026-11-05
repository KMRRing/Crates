# Cue
A party game (October 2026). On one phone: tap the card and a simple word pops up (551 in twelve kinds, `cue-words.js`), to act, draw or describe, with a countdown under it; the deck (`cue-deck.js`) deals every word once before any comes twice and is kept on the device (`cue:deck`, choices in `cue:opts`). At a party (Menu, Play on several phones; `party-cue.js` in Party's lobby) every phone shows its own view of one stream of cards from a library of 684 more (`cue-lib-*.js`, `cue-library.js`).

4 November 2026, Korbi: "cue: figure out all possible games playable with a cue mechanic. add a 'turn' mechanic where it can be set so that player x does or doesn't get the (same) queue as everyone else when it's their turn. also make the cooldown custom duration. add more things to the cue library (questions like 'who is most likely...' etc)". And: no drinking wording anywhere, PG ("loses", "loses a life").

- **Turn** (`cue-turn.js`): per card one player is X, and sees the same cue, a different cue, or none; X is in turn, random (everyone once before anyone twice) or chosen (the last X picks, the host first). Nobody is told who X is when X sees a different cue, X least of all, until Reveal. A card's twin is its `text|twin` in the library, else another card of its category (a word's, of its kind).
- **Cooldown**: a second to read, then the host's seconds (`cue:opts.count`, 1 to 600; solo takes a preset or a typed Custom, a party a preset in the lobby and the host's stepper between cards). The clock is `clockAt(ms, countMs)`; at a party it runs from `state.at`, the table's clock, so every phone agrees.
- Library trap: `LIB` indices are what a party's deck keeps, so append, never reorder. `tests/cue-library.mjs` bans sexual, hateful, drinking, drug and cruel words from every card.
- The one-phone Cue deals only the words, not the library: long prompts do not fit its one-word card.

**4 November 2026, Korbi: the menu is the minimum it needs to be.** The kind is always shown over the word (the choice went).
