# Too specific for a general audience (4 November 2026)

For Korbi to judge. The rule is in `docs/almanac.md`. Marks are the audit's (`kb/audit/marks.js`; `s` specialist, `p` personal: marked for removal); to reverse a call change its letter and run `node tools/build-kb.mjs`.

## Excluded and shown (Exclude on)
- Things: 2,823 shown, 5,037 excluded, of 7,860 (before this pass 2,836 and 5,024).
- Links: 3,382 shown of 10,016 (a link goes with either end).
- Quote numbers: 843 shown of 1,346.

## Why the customs code still showed
Not a missing mark: all 59 customs codes (HS, CN) were already `p`. Almanac read `kb/` directly and showed everything (a ruling of 3 November: "a reference over everything kb/ holds"); the code is a thing of its own, linked to the commodity it classifies, so it appeared in platinum's entry and as a star next to it. Fixed in code (`almanac-view.js`), not by new marks.

## Marked, by kind (already marked before this pass, counted by what they are)
| Kind | Marked |
|---|---|
| Customs / HS / CN codes | 59 |
| Standards and schemes (EN 590, EN 14214, EN 15940, ISCC, IMO 2020) | 7 |
| Regulation articles and annexes (Annex IX, Article 6, Article 370, Battery Regulation) | 4 |
| Grades and blends (B40, E10, E85, Brent) | 15 |
| Companies (mostly traders, producers, exchanges) | 440 |
| Legal concepts and maxims | 151 |
| Trade places | 80 |
| Markets | 143 |
| Technology / materials | 432 |
| Quote numbers (refining, trade, markets, small countries) | 503 |
| Quotations | 377 |

Added in this pass: 13 things, all trade jargon the audit had left as regional: Long the basis, Slippage, Price discovery, Mark to market, Fat finger, Dry powder, Dead money, Window dressing, The dash for trash, Bagholder, The wall of worry, Carry trade, Mrs Watanabe. No CAS numbers, tickers or ISINs exist in `kb/`; no kept note, hint or number carried a code (scanned for HS, CN, CAS, ISO, EN, ASTM, article, ticker, grade, futures).

## 30 samples marked
HS 7110 11 (platinum), HS 7108 (gold), HS 0901 (coffee), HS 2709 (crude oil), HS 2711 21 (natural gas), HS 2905 11 (methanol), HS 2804 10 (hydrogen), HS 3826 (FAME), CN 2710 19 43 (diesel), HS 7403 (copper), EN 590, EN 14214, EN 15940, ISCC, RED III, IMO 2020, Annex IX, Article 6 (Paris Agreement), Article 370, Battery Regulation, B40, E10, E85, Brent, and the added Long the basis, Slippage, Mark to market, Price discovery, Fat finger, Carry trade.

## Borderline, left in
- Regional commodities: sulphur, potash, phosphate, urea, ammonia, hydrogen, rapeseed, sunflower oil, soybean oil.
- Oil theme (Korbi's "a bit of oil" ruling): barrel (159 litres), shale, oil sands, fracking, Strait of Hormuz, Ghawar, Daqing, Prudhoe Bay, Shell, BP, Chevron, ExxonMobil, Aramco, OPEC, Sinopec, PetroChina, CNOOC.
- Bavarian industry (theme): Schaeffler, Knorr-Bremse, Wacker Chemie, MAN Truck & Bus, Infineon.
- Trader sayings with a life outside the floor: Short squeeze, Dead cat bounce, Catching a falling knife, Pump and dump, Cornering the market, Black swan, Don't fight the Fed, The trend is your friend, Buy the rumour sell the news, Sell in May.
- Links such as "Home of its benchmark futures" (Chicago, Singapore to wheat, corn, soybeans, rubber) and "An alloy stamped 925" (sterling).

## Not covered
- Layout: the sky keeps the positions it was laid out with over all 7,860 things, so with Exclude it is sparser (the regions have gaps) until `node almanac-sky-build.mjs` is run over the shown things only.
- Acrostic (`acrostic-texts.js`) reads `kb/` notes with no mark check at all; its owner should gate it like Origin.
