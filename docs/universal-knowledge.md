# Universal knowledge: a method and a pilot

3 November 2026. Korbi, 15:03: "take a step back and think 'how can we identify what knowledge is universally interesting'… distill human knowledge down to a few thousand, maybe tens of thousands, entries and connections." This is the method, a pilot of it on real data, and what it would take to do for real. Nothing in `kb/` or any bank was changed. The scripts are `tools/kb-universal-*.mjs`; the samples to judge by eye are in `docs/universal-knowledge-samples.md`.

**In short.**
- The tiers can be found from public data: **core 2,314, wide 11,784, deep 40,278** (29,000 of them read broadly), from two curated lists, language counts and 13 editions' readership. The pipeline takes about ten minutes of compute.
- `kb/` holds **30% of the core, 11% of the wide and 5% of the deep.** Of its 7,838 things a quarter are universal, a third are specialist, trade or unknown, 28% are borderline and 15% are sayings the score cannot judge. Cutting is the smaller job; adding the missing core is the larger.
- The method's weakest links are name matching (about 6% wrong) and education (three systems, history only). Seven decisions are Korbi's, near the end.

## What could be reached

The container's shell reaches package registries, GitHub and a few Wikimedia hosts. Tested at the start and again just before this was written (3 November 2026, 15:01 UTC):

- **Reachable, and used:** `dumps.wikimedia.org` (the bulk files, and any byte range of them: this is the workable path), `query.wikidata.org` (Wikidata's SPARQL query service; works, but the shared address is throttled, HTTP 429 with a wait of 1,000 seconds, after a few hundred queries).
- **Reachable but throttled, so not relied on:** `wikimedia.org/api/rest_v1` (the pageviews API; answered once in several tries, otherwise HTTP 429) and `api.wikimedia.org`.
- **Not reachable (no connection at all):** every `*.wikipedia.org` edition (`wikipedia.org` itself only redirects), `www.wikidata.org`, `meta.wikimedia.org`, `commons`, `mediawiki.org`, `data.`, `analytics.` and `doc.wikimedia.org`, the `wmcloud` tools (pageviews, xtools, wikistats), DBpedia (all four hosts), Hugging Face, Zenodo and the Internet Archive.

So the pilot ran on real data: the Vital Articles lists, Meta-Wiki's list, English Wikipedia's page tables and the September 2026 clickstream of 13 editions, all from `dumps.wikimedia.org`. Wikidata's statements came through the query service only in windows between throttles, so the gameability and durability tests are a sample of 480 things and the typed-link query was written and tested but not run on the whole set. Not run for real: the education systems (three syllabus slices read by hand, history only), pageviews over many months (one month), Wikipedias in languages beyond the 13, and every other-language "vital" list.

## The method

**1. Backbone: two curated lists, never one.** English Wikipedia's Vital Articles (levels of 10, 100, 1,000, 10,000 and 50,000 articles; the community's own balance across eleven domains) and Meta-Wiki's "List of articles every Wikipedia should have" (1,000 and an expanded 10,000, one page per domain, written across languages and naming Wikidata items directly, so there is nothing to translate). They are made by different crowds. Where they agree the evidence is stronger; where they differ is the bias detector (below). Points: level 1 or 2 = 1, level 3 or Meta's 1,000 = .85, level 4 or Meta's 10,000 = .55, level 5 = .30; the better of the two plus a tenth of the other.

**2. Education systems as the universality test.** For each syllabus, take the *names* it uses (concepts, people, places, events, works), never its text, map each to a Wikipedia title and so to a Wikidata item, and count in how many systems an item appears. Why it earns a weight of its own: it is the only signal that asks "what must a school-leaver be able to recognise" in a way that is independent of Wikipedia's editors and of what is trending. The pilot piloted the *join* on history in three systems (UK GCSE, US AP, India NCERT), by hand. For real: UK (GCSE specifications of AQA, OCR, Edexcel; the IB subject guides), US (AP course descriptions, NGSS, a few state standards, Hirsch's Core Knowledge as a hint only), Asia (NCERT classes 6 to 12, China's curriculum standards and gaokao outline, Japan's Courses of Study, Korea's CSAT subjects). Counted as the share of systems that name it, systems weighted equally so that one big system cannot outvote the rest. The weight is .20 once at least eight systems are measured; until then it is zero and the others are scaled up.

**3. Attention as breadth, never as the backbone.** From the Wikimedia clickstream (CC0): how many readers each article got in each of 13 editions (en, de, fr, es, pt, ru, zh, ja, ar, hi, ko, id, it). The article's *rank* in each edition on a log scale (rank 1 = 1, rank 100,000 = 0), then the **median** across the editions: an article read in a few countries, or spiking in one, scores low; it has to be read in more than half the editions to score at all. Plus the number of language editions with an article (English Wikipedia's language-link table), log-scaled so 250 editions = 1. Attention is biased to celebrity, entertainment and the day's news, which is why it is a minority of the score, can never make something core on its own, and a domain quota (below) caps it.

**4. Links.** Only edges a game can use: *in*, *part of*, *made by*, *caused*, *influenced by*, *before/after*, *same field*, *movement*, *kind of*. Typed from Wikidata statements (about 30 properties map to those kinds, `tools/kb-universal-links.mjs`), restricted to the candidate set so the graph is the set's own. Weighted by the clickstream (CC0: links readers actually followed, 10 or more times in a month); a link nobody follows is not offered. The wiki link graph (7 GB of `pagelinks`) is not needed: the clickstream is the link graph already filtered by use. Where kb/ has a hand-written "because", it stays; the typed link is the candidate, the sentence is the product.

**5. One score, a floor, a quota, two filters, tiers.**

| signal | weight now | with education | why this weight |
| --- | --- | --- | --- |
| curated (two lists) | .40 | .30 | the most deliberate judgement there is, but made by volunteers who lean Anglo-American and scientific |
| spread (languages with an article) | .30 | .25 | independent of English editors; costs the English-only fan page everything |
| attention (median rank over 13 editions) | .30 | .25 | independent of editors; biased to the entertaining, so no more than a quarter |
| taught (share of systems naming it) | 0 | .20 | the only signal that is neither Wikipedia's nor the crowd's |

*Floor rule* (what a tier requires, whatever the score): **core** = in Vital level 3 or Meta's 1,000, or in 150+ editions and read in 8+ of the 13; **wide** = Vital level 4, Meta's 10,000, or a score of .35 with 100+ editions; **deep** = Vital level 5, or a score of .20 with 40+ editions, or read in 4+ editions; **thin** = has an article and nothing above. With education added: core also needs it named in 3+ systems *or* the lists. *Quota*: per domain, a tier may hold at most the share the Vital Articles' own level for that tier gives the domain, plus a quarter (so people, entertainment and sport cannot swamp). *Durability filter*: not a living person (a human with a birth and no death on Wikidata), not an event less than five years old. *Gameability test*: it has a fact a question can ask: a year, a country, a creator or a kind (Wikidata statements; a thing with none is kept for its links but not asked). Tiers are core (about 1,000 to 3,000), wide (to about 10,000), deep (to 30,000 or 50,000). A question's tier gives Punt's difficulty from 1 to 10: core 1 to 3, wide 4 to 6, deep 7 to 10, ordered inside a tier by the score.

**6. Applied to kb/** as an audience flag, never a deletion: `universal` (core or wide), `specialist` (has an article, thin), `trade` (thin or none and mostly trader links), `borderline` (deep, or thin with an educational signal), `unknown` (no article found, or only a disambiguation page: a person looks, often a name to fix) and `outside` (sayings, quotations and words, which have no article by nature and which this score does not judge). The flags would live in a sidecar (`kb/audience.js`: id → audience, written by the tool; a second file of Korbi's overrides on top), not in `entities.js`, so the hand-written data is not touched by a machine run. The release build leaves `specialist`, `trade` and `unknown` things out of the universal views unless Korbi's overrides keep them; Korbi's own copy keeps everything. Sayings and quotations stay with the games that use them. Crates' board positions are protected: see below.

## The pilot

**What was run.** One universe of 56,105 Wikipedia pages: all 6,691 things of `kb/` that can have an article, Vital Articles levels 3 to 5 (49,852 titles, the whole list), Meta-Wiki's 9,871, the 4,000 most-read English articles of September 2026, the 4,000 most-translated, and the 338 titles the three syllabi name. Each page got a Wikidata item, a language count, and a rank in each of 13 editions. Each `kb/` thing was matched to an article by its name and kind (variants such as "Skype", "Skype (company)"), followed through redirects, and scored. The 1,147 sayings, quotations and words have no article by nature and stay outside the score. A hand check of the matches gave about 6% wrong (a surname page, a same-named film); the lowest-60 list below is worse than that, because wrong matches sink to the bottom.

**1. The 7,838 in tiers.** (`node tools/kb-universal-pilot.mjs <work> report`, then `tools/kb-universal-audience.mjs` for the flags)

| tier of the matched article | things | share | audience flag |
| --- | --- | --- | --- |
| core | 716 | 9% | universal |
| wide | 1,279 | 16% | universal |
| deep | 2,178 | 28% | borderline |
| thin (has an article, nothing above it) | 1,227 | 16% | specialist, or trade where most clue links are the trader's topics |
| unknown (637 with no article under any name, 654 only a disambiguation page) | 1,291 | 16% | unknown, or trade |
| outside (sayings, quotations, words) | 1,147 | 15% | outside |

By flag: **universal 1,995 (25%), borderline 2,180 (28%), specialist 930 (12%), trade 678 (9%), unknown 908 (12%), outside 1,147 (15%).** The universe's own tiers are core 2,314, wide 11,784, deep 40,278 (29,000 of them read in 3 or more editions or with 40 or more languages), thin 1,729.

**The finding that matters most is the other direction: `kb/` holds 693 of the 2,314 core things (30%), 1,249 of 11,784 wide (11%), 2,155 of 40,278 deep (5%).** Of Vital level 3 it has 213 of 1,002. By domain, core things in `kb/`: Geography 378 of 580, People 150 of 286, but History 15 of 103, Society 14 of 239, Biology 17 of 227, Physical sciences 44 of 228, Mathematics 2 of 51, Philosophy and religion 2 of 73. It is deep where it is a trader's, a wine-lover's or an art dealer's, and thin at what a school-leaver knows. Specialist, trade and unknown together are a third of it (2,516 things) and borderline another 28%; adding is the larger job. Its Arts (439 deep, 27 core), Society (mostly deep, thin or unknown, and the trade things) and History (148 with no article, 70 ambiguous, 12 core) are where the cuts fall.

**2. Calibration.** Spearman correlation (rank agreement, -1 to 1) between the score and the hand-written difficulty of the clue words `kb/` already has: **-0.39** over 2,810 things. The sign is right (higher score, easier) and it is moderate, which is what it should be: the score measures how far a thing reaches, not how hard it is to recall.

**3. The 60 and the 60** (all in `docs/universal-knowledge-samples.md`). The `kb/` things that score lowest are three kinds: the trader's and the lawyer's words, correctly flagged (RTFO, WASDE, RBOB, crack spread, Green Plains, wrongful trading, holder in due course, undisclosed principal, wire rod); real people the pilot could not find because `kb/` names them by surname (Kaunda, Nkrumah, Bayes, Perelman, Bubka, Kipchoge, Rudisha, Lemaître, Rockefeller: about 20 of the first 50, a name-matching fault, not a verdict); and genuinely niche things (Tobacco Lords, Messe Basel, Maibaum, the El Primero). The high-scoring things `kb/` lacks are all core and all basics: Michael Jackson, the periodic table, the Second and First World Wars, artificial intelligence, Earth, the Soviet Union, the European Union, New York City, Muhammad, Europe, the United Nations, the Solar System (checked by name: none is an entity of `kb/`). One is a false lack, the other way round: Christopher Columbus is in the list because `kb/` calls him "Columbus", a bare name the matcher could not settle.

**4. Samples** of 100 kept (core or wide), 100 cut (thin, no article, or ambiguous) and 100 borderline (deep) are in the samples file, seeded so they repeat. Reading them: the kept list is right nearly throughout (Cold War, Victor Hugo, Stockholm, Tofu, Émile Zola, Chennai, Xinjiang, the renminbi), with one case for the durability filter (Trump, a living person). The borderline list is where the judgement sits (Vegemite, Yad Vashem, Hạ Long Bay, Bram Stoker, Géricault, Charybdis, Khachapuri: fine to teach, none in the top 14,000). The cut list mixes right cuts (HS 5101, the THG quota, Price crash, E-fuels, Baowu, Kumtor, privity of contract, the escape wheel) with name faults the method cannot settle (Newton, Niagara, Erika and Argus are only a disambiguation page because `kb/` gives a bare name; the Djenné mosque and Self-Portrait in a Convex Mirror have articles under other titles) and with real things that are thin on Wikipedia (the Bronze Horseman, the Celtic Tiger, Hammerfest), which is the method's honest limit.

**5. Education, three systems, history only.** 338 titles named: 318 by one system, 20 by two, none by three. 186 are in Vital level 3 or 4, another 105 in level 5, and only 47 in no list. The 20 named by two are world history (the world wars, the Cold War, the Russian Revolution, the Atlantic slave trade, the Industrial Revolution, the Renaissance); the 47 in no list are mostly one nation's (UK: the Tolpuddle Martyrs, the Statute of Rhuddlan, the Rye House Plot, the Reform Act 1832). So education adds little the lists lack, and what it adds is national: it is a good test for *core* (a thing two systems name is world history) and a poor source of new things. 24 of the 79 history items of Vital level 3 are named by one of the three; the rest (Ancient Egypt, Sumer, the Tang dynasty, the Byzantine Empire) are in no slice because the slice is one specification each.

**6. Links.** The clickstream between 16,680 wanted titles (core, wide and `kb/`) has 316,661 followed links. Among core things: 52,817 core-to-core links at 10 or more readers (23 a thing), 12,894 at 100 or more (5.6 a thing, 2,039 of the 2,314 with one), 1,855 at 1,000 or more. Up to half of core-to-core links cross a domain (52% stay inside at 10 readers, 67% at 1,000; a core thing with no domain counts as crossing), which is what makes a good Crates pair. The heaviest are navigation, not meaning: Elizabeth II to Charles III 81,240, September 11 attacks to Osama bin Laden 72,902, one US president to the next, Science to Knowledge; so a weight needs normalising per source article (the share of its outgoing clicks) before it is used. Against `kb/`'s own links where both ends were matched: **72% of its typed links (in, painted-by, hangs-in, movement…) have a followed click, 44% at 100 or more; 42% of its clue links do.** The clickstream confirms and weights typed links; it cannot find the hand-written "because". Wikidata's typed statements (`tools/kb-universal-links.mjs`) were not run on the whole set (throttle): that is the next step for links.

**7. Gameability and durability** (480 things sampled across tiers; Wikidata). A thing a question can ask about (a year, a country, a creator or a kind): core 93%, wide 89%, deep 96%, thin things of `kb/` 86%. The 9 core things with nothing to ask are abstractions (Phoneme, Decolonization, Waste, Privacy, Flag, Hospital, the letters I, S and Y). All but 2 of the 480 have a Wikidata English description (about 45 characters), so the short description mostly needs no writing. **Living people: 1 of 120 core, 4 of 123 wide, 34 of 127 deep (27%)**: a quarter of the deep tier is living actors and athletes; the durability filter matters there, not at the top.

**8. West and English bias.** The share of each list's items that have an article in an edition and at least 300 readers in it in September 2026 (so a small edition scores low by size as well as by content):

| list | n | en | de | fr | es | pt | ru | zh | ja | ar | hi | ko | id | it |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vital level 3 | 1,002 | 100 | 94 | 95 | 97 | 92 | 96 | 91 | 95 | 77 | 38 | 64 | 66 | 86 |
| Meta's 1,000 | 981 | 100 | 98 | 99 | 99 | 94 | 99 | 97 | 98 | 84 | 40 | 76 | 70 | 94 |
| Vital level 4 | 9,025 | 100 | 84 | 85 | 85 | 61 | 88 | 75 | 84 | 39 | 10 | 32 | 24 | 70 |
| Meta's 10,000 | 8,785 | 100 | 83 | 83 | 83 | 58 | 87 | 70 | 81 | 35 | 9 | 27 | 22 | 68 |
| `kb/` | 5,312 | 97 | 74 | 72 | 66 | 46 | 68 | 56 | 64 | 31 | 8 | 28 | 20 | 62 |

Three readings. The curated lists travel well to the large European and East Asian editions and badly to Hindi, Arabic, Korean and Indonesian; part of that is the small readership of those editions against a 300-reader bar, part is content. `kb/` is more English than either list. And English readers over-read Americana: the things most skewed to English against the other 12 are Ansel Adams, Fred Rogers, Dolly Parton, Tom Brady, Reba McEntire, PBS, Lucille Ball, Lake Ontario, Ireland; the most under-read in English are the bed bug, the olive, the hoopoe, the digestive and reproductive systems, the list of sovereign states, climate, Vivaldi, the hectare. An English-only attention signal would crown the first list; the 13-edition median does not. Fixes in "West and English bias" below.

## Recommendation

Worth building, in this order:

1. **Give every `kb/` entity its Wikidata item** as a sidecar (`kb/wikidata.js`: id to Q-number), filled from the pilot's matches and reviewed for the roughly 6% wrong and the 1,291 unknown. Guessing from names is the weakest link; with items, facts, languages, links and the audience flag are all joins.
2. **Write the audience flags** (`tools/kb-universal-audience.mjs` already does). Korbi's copy keeps everything; the release build leaves specialist, trade and unknown things out of the universal views. Crates answers stay whatever their flag.
3. **Add the missing core.** 1,621 of the 2,314 core things and most of the wide are not in `kb/`. Append them from Wikidata (kind, year, country, creator, English description) with typed links weighted by the clickstream, and hand-write a "because" only where it is worth the effort. This is a larger gain than any cut.
4. **Change from the design above:** education confirms and promotes but never makes a thing core until six systems are measured; a relative bar per edition and regional medians for attention; a domain quota inside the deep tier (People are 29% of it); the durability filter from wide downwards.

## Sources and licences

Nothing under the GPL is used or copied. Every number below is a fact about a list, a page or a count; no article text, picture or syllabus text is kept in the repo, and nothing is fetched from Wikipedia at run time (the games never call these hosts).

| source | what is taken | licence | used for |
| --- | --- | --- | --- |
| Wikipedia's Vital Articles (read from the English dump, 3 Nov 2026) | which titles each level names, under which heading | list text CC BY-SA 4.0 and GFDL; titles and levels are facts about the list, kept with an attribution line | curated backbone |
| Meta-Wiki, "List of articles every Wikipedia should have" (metawiki dump) | Wikidata item numbers and the list's level | CC BY-SA 4.0 (the list); item numbers are facts | curated backbone, second crowd |
| English Wikipedia page tables (`page_props`, `redirect`, `langlinks`) | Wikidata item of a page, redirects, which languages have an article | database metadata of the dump; no text | joining names to items, the language count |
| Wikimedia clickstream, September 2026, 13 editions | readers per article, link clicks between articles (10 or more) | CC0 (all Wikimedia Analytics datasets) | attention, edge weights |
| Wikidata query service | kind, years, country, creator, English description, typed statements | CC0 (structured data of the main namespace) | gameability, durability, typed links |
| AQA GCSE History 8145 (2016 specification), AP World History: Modern (through a third-party summary of the course description), NCERT Class 11 Themes in World History | topic names only, by hand | the owners' copyright; names of topics are facts, no text is kept | the education test, a three-system history slice |
| Tools: Node 22 (`zlib`), `curl`, `bzcat` | run as commands | MIT, BSD-style; nothing is linked or shipped | reading the dumps |

Not used: the pageviews REST API (throttled), the full `pageview_complete` files (6 GB a month each), the wiki link table (`pagelinks`, 7 GB: the clickstream is the same graph filtered by use), DBpedia, Google Trends (no licence for this, and not reachable).

## Sizes

A record per thing is `[Wikidata number, name, kind, year, country, short description]`, measured on real names and Wikidata's own English descriptions: **about 95 bytes raw, about 40 gzipped** (the description is 55% of it, 52 characters on average). A link is `[from row, to row, kind, weight]`: 18 bytes as JSON, **8 as binary**. For comparison, `kb/` today is 159 bytes an entity and 130 a link, because it carries hand-written notes and hints (2.5 MB, 0.6 MB gzipped, 7,838 entities).

| up to tier | things | records, raw | records, gzipped | links at 6 a thing, binary |
| --- | --- | --- | --- | --- |
| core | 2,314 | 0.2 MB | 0.1 MB | 0.1 MB |
| wide | 14,098 | 1.3 MB | 0.5 MB | 0.7 MB |
| deep, read in 3+ editions or 40+ languages | 43,093 | 4.0 MB | 1.7 MB | 2.1 MB |
| deep, all of Vital level 5 | 54,376 | 5.0 MB | 2.1 MB | 2.6 MB |

(Six links a thing is what the clickstream gives core things at 100 or more clicks; deeper things have fewer, and links compress little. The gzip column is the measured ratio of 480 real records, 0.42, applied to the raw size.) So core and wide together are about 1.2 MB over the wire: affordable in the offline list. Deep is not worth precaching; it loads when asked.

**Build time.** Sharded by tier and kind (`universal/core.json`, `universal/wide-links.bin`…), each loaded when a game first asks for that tier, so `build-kb.mjs` (under 1 second today) only has to write an index of shard names and the audience sidecar; it never walks a tier. The rule in CLAUDE.md stands: index by id once (a Map), never scan `LINKS` or `ENTITIES` in a loop. `sw.js` lists every file a page loads (`tools/offline.mjs` reads them); a shard fetched by a built path goes into `RUNTIME` in `tests/offline.mjs`, which fails until it is there.

## The Almanac's star chart at 30,000 stars

Measured by laying out `kb/` copied 1, 2, 4 and 6 times (`tools/kb-universal-sky-scale.mjs`, writes nothing; the machine was busy, so read the times as a ratio):

| stars | layout build | file the page loads |
| --- | --- | --- |
| 7,834 (today) | 15 s | 169 KB |
| 15,668 | 51 s | 354 KB |
| 31,336 | 188 s | 725 KB |
| 47,004 | 269 s | 1,095 KB |

The build grows faster than the number of stars (a doubling costs 3.4 times, then 3.7) because `almanac-sky-force.js` hashes stars into a fixed 32,768 cells; past that the cells fill and every neighbour search gets longer. Sizing the cells to the star count would bring it back to near-linear. It is an offline build, run once per release, so even as it stands 30,000 stars is minutes, not a blocker. The file is 23 bytes a star and almost all of it is the star's id as text; indexing by row (the id list already sits in the tier's shard) would cut it to 8 bytes a star, 0.25 MB at 30,000. What the page does at run time scales with stars on screen, not stars in total: `MAX_LINES` is 4,500 lines, and drawing 30,000 points is one draw call. Two things are **not verified**: the frame rate of 30,000 points on an older phone (no GPU here, so the WebGL never ran), and the page's start-up, which today loads all of `ENTITIES` and `LINKS`. At 30,000 it must read the universal shard's names only and load the rest on tap.

## How Crates' positions stay safe

Shared board codes point at answer and clue positions (`crates`, `pos`), so a cut must never move one. The design keeps that by construction:

1. **Nothing is deleted or reordered.** The audience is a sidecar (id → universal, borderline, specialist, trade, unknown, outside), and a release build *leaves a thing out of the universal games' views*; `entities.js` and `links.js` keep every row, in order. Removing one would shift every position after it.
2. **Anything with a Crates position is kept whatever its score.** `tools/kb-universal-audience.mjs` counts them: 33 Crates answers would have been cut and are kept (of 159).
3. **New things are appended at the end** of `ENTITIES`, with no `crates` field until Crates uses them; new clue links at the end of `LINKS`. A thing Korbi decides to drop becomes a tombstone (`dropped: true`), not a gap.
4. `tests/kb.mjs` already fails if the order of Crates' answers or clues changes; the audience tool adds nothing to it.

## West and English bias

Measured in the pilot (item 8 above). Four defences, in order of strength:

1. **Two crowds, not one.** Vital Articles are English editors; Meta-Wiki's list was written across languages and names Wikidata items directly. Where only English names a thing, it cannot become core.
2. **A language-count signal that English cannot raise.** Spread counts editions with an article, and English-only fan pages score zero on it.
3. **Attention by median across editions, with regions.** The pilot's median over 13 editions is set by the six or seven largest European and East Asian wikis, because the Hindi, Korean, Indonesian and Arabic editions rarely give an item 300 readers (the table). Two changes to make, neither piloted: a relative bar per edition (the top 100,000 of each, not 300 readers) so a small edition can still vote, and the median of four regional medians (Europe; East Asia; South and South-East Asia; the Arab world and the rest) with English one vote.
4. **Education across continents, counted as a share of systems, equal weights** (UK, US, India, China, Japan, Korea at least). One system cannot make a thing core; agreement across systems can.

What cannot be measured from here: things missing from every list because none of the lists' editors read the language they matter in. The test is to take what two Asian curricula name and no list does; that needs the Chinese, Japanese and Korean standards read by someone who reads them.

## Decisions only Korbi can make

1. **Target size.** The lists decide it more than the weights do. Core (what every game may assume a player knows) is 2,314 things whichever way the weights go, because Vital level 3 and Meta's 1,000 are about that size. Wide is 11,784 more (Vital level 4 and Meta's 10,000). Deep is Vital level 5: 40,278, of which 28,995 are read in 3 or more editions or have 40 or more languages. My suggestion: core and wide (14,100, about 1.2 MB) to every game, deep up to 29,000 for Punt and the Almanac, loaded when asked. His words were "a few thousand, maybe tens of thousands": that is core, wide and the stricter deep.
2. **Which curricula are required.** The education signal is only worth its .20 weight when enough systems are measured; with three it is a demonstration. Suggest the six named (UK, US, India, China, Japan, Korea) as the condition for switching the weight on, and until then education can promote a thing from deep to wide but never make it core. The Chinese, Japanese and Korean standards need someone who reads them; I cannot check a reading of them from here.
3. **The weights.** Smaller than they look: the floor rule (method 5) places most things by list membership, and the score only breaks ties inside a tier and decides the "high score" routes. Today .40 curated, .30 spread, .30 attention; with education .30 / .25 / .25 / .20. Change them, if at all, after seeing the borderline list, not before.
4. **Universally interesting versus universally taught.** They differ, and the pilot shows how. What two history syllabi both name is world history (the world wars, the Cold War, the Russian Revolution, the Atlantic slave trade); what only the UK one names, and no list does, is national (the Tolpuddle Martyrs, the Statute of Rhuddlan, the Rye House Plot). Michael Jackson, Marilyn Monroe and Charlie Chaplin are core by the lists, reading and spread, and no syllabus I read names them. If "universal" means *interesting to anyone anywhere*, education is a filter that confirms core, never a source, and a thing taught in one system is a tag ("taught in the UK") for the Learn mode. If it means *what a school-leaver must know*, taught items should be promoted. This is his call.
5. **Living people.** The durability filter drops them (a human with a birth and no death on Wikidata): 5 of 243 sampled core and wide things (Narendra Modi, Johnny Depp, Warren Buffett, Reba McEntire, Ewan McGregor), and 27% of the deep sample. Keep a short list by hand, or none?
6. **The trader's own things.** Companies, markets, regulations and grades are the `trade` audience: kept in Korbi's copy, out of the shared build. Should the shared build ever carry some (the Strait of Malacca, palladium and olive oil are already wide on their own merits)?
7. **How he reviews.** Borderline plus unknown is a few thousand things. Decide by rule and by sample (200 a bucket), not by item.

## What it would cost to run for real

| step | cost |
| --- | --- |
| Downloads | about 2.4 GB (the English page tables, the index and 13 clickstream files), plus 2.6 GB of temporary decoded list pages; once a month at most |
| Compute | the whole pipeline about 10 minutes on a busy machine once the lists are read; reading the Vital lists cold 30 to 40 minutes (130 pages, each a 12 MB range of the dump) |
| Wikidata for 30,000 things | about 500 queries for facts and 500 for typed links, 8 seconds apart: 70 minutes each if never throttled; the shared address is refused for 1,000 seconds every few hundred queries, so plan a half day, unattended |
| Education | the real cost, and not measured: three history slices took part of one session. Six systems by five subjects is 30 slices; most of the time is in finding the specification and in resolving names to articles |
| Engineering | a sidecar writer and shard writer in the build, a loader for the shards, the Almanac's cell sizing and row-indexed file, tests: two or three sessions |
| Korbi | about two hours to read the borderline buckets and answer the seven questions above |
| Money | none: no paid service is used |

## What could not be verified

- How 30,000 points run in WebGL on an older phone, and the Almanac's start-up with the universal shard (no GPU here; nothing visual was run).
- Education beyond history in the UK, the US (AP World only) and India: the other three systems, and the other subjects, were not read.
- Attention over time: one month (September 2026), so a news spike or a season is in the numbers. Several months, median of months, is the fix and costs only more downloads.
- Title matching of kb names to articles: a hand check of the found ones gave about 6% wrong (a surname page, a same-named film). The fix is a Wikidata item number on each kb entity, set once and reviewed; the pilot guessed from names.
- Wikidata's facts: sampled (480 things), not run on the whole set; typed links: the query is written and tested on a handful of things, not run on the set, because of the throttle.
- The other languages' own "vital" lists (German, Chinese, Russian, Spanish…) were not read: only Meta's cross-language list stands for them.
- The licensing reading (titles, levels and counts are facts about lists; no text is kept) is mine and not a lawyer's.
