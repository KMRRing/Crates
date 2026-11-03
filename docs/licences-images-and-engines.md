# Licences: images and engines

Decided on 2 November 2026 (Korbi, after the library review; not legal advice, and nothing built yet).

**Paintings** (Punt's art bank, 201 of them): public-domain works only. A faithful photograph of a public-domain painting gets no new copyright in the EU (Article 14 of the 2019 copyright directive) or the UK (the IPO's 2014 guidance), and the Met and the Art Institute of Chicago publish their images as CC0. A painting by an artist who died after 1955 (or first published after 1930, for the United States) is still in copyright, and paying a picture library for the photograph does not pay the painter's estate. Those are to be swapped for a pre-1931 painting of the same movement (`kb/` already says which movement). Not yet counted: how many of the 201 fail.

**Buildings**: the building and the photograph are two things. An old building is free, but its photograph belongs to the photographer, so only CC0 or public-domain photographs, or our own drawings. A building by an architect who died after 1955 is itself protected, and the freedom to photograph it in public differs by country: the United States, the United Kingdom, Germany (the outside only), Switzerland and China allow it; France and Italy allow no commercial use. The suite can be opened in France, so such buildings are left out.

**Chess and its variants**: Korbi's call (2 November 2026): prefer a permissive engine, and in the worst case no engine at all, only puzzles (Gambit's puzzle bank is the Lichess database, CC0, so that part is clean already). Gambit's engines, evaluated 3 November 2026, one line each:
- Stockfish 19 lite (stockfish.js 19.0.1): GPL v3. Was Gambit's, GREEN_OR_KEPT
- Fairy-Stockfish (9f778da, 23 September 2026): GPL v3. River's Xiangqi engine (`vendor/fairy-stockfish/`); River's own job, not touched here.
- Caissa 2.0.12 (324f1f9): MIT. Used for Gambit (`vendor/caissa/NOTE.txt`): about 3600 on CCRL, builds to a 263 KB single-threaded WebAssembly module with SIMD. Its network (eval-ml-11a-100B-spsa-transplant, from Caissa-Nets, trained on the engine's own self-play) is 76 MB, 38 MB packed losslessly; the Caissa-Nets repository has no licence file, though the author releases the engine as MIT and the build fetches that network itself. A licence line from the author would settle it.
- Arasan 26.1 (84a6787): MIT, its network included (28.5 MB). Not ported; the fallback if the network's missing licence matters.
- kishi (9f06237): MIT, Rust, already WebAssembly. About 2,000 Elo: too weak for Gambit's top levels.
- Leorik: MIT, C#, about 3,400 on CCRL Blitz. Not evaluated: it would need a .NET build.
- Viridithas (AGPL from v21) and Coda (GPL): not usable.
