# Universal knowledge: a method and a pilot

3 November 2026. Korbi, 15:03: "take a step back and think 'how can we identify what knowledge is universally interesting'… distill human knowledge down to a few thousand, maybe tens of thousands, entries and connections." This is the method, a pilot of it on real data, and what it would take to do for real. Nothing in `kb/` or any bank was changed. The scripts are `tools/kb-universal-*.mjs`; the samples to judge by eye are in `docs/universal-knowledge-samples.md`.

## What could be reached

The container's shell reaches package registries, GitHub, and, since Korbi's change to the network settings (tested at the start and again before this was written), some of Wikimedia:

@@REACH@@

So the pilot ran on real data: the Vital Articles lists, Meta-Wiki's list, English Wikipedia's page tables and the September 2026 clickstream of 13 editions, all from `dumps.wikimedia.org`. Wikidata's statements (kinds, years, countries, creators, typed links) came through the query service only in short windows between throttles, so the typed-link and gameability tests are samples, not the whole set. Not run for real: the education systems (three syllabus slices read by hand, history only), pageviews over many months (one month), Wikipedias in languages beyond the 13, and every other-language "vital" list.

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

*Floor rule* (what a tier requires, whatever the score): **core** = in Vital level 3 or Meta's 1,000, or in 150+ editions and read in 8+ of the 13; **wide** = Vital level 4, Meta's 10,000, or a score of .35 with 100+ editions; **deep** = Vital level 5, or a score of .20 with 40+ editions, or read in 4+ editions; **thin** = has an article and nothing above. With education added: core also needs it named in 3+ systems *or* the lists. *Quota*: per domain, a tier may hold at most the share the Vital Articles' own level for that tier gives the domain, plus a quarter (so people, entertainment and sport cannot swamp). *Durability filter*: not a living person (a human with a birth and no death on Wikidata), not an event less than five years old. *Gameability test*: it has a fact a question can ask: a year, a country, a creator or a kind (Wikidata statements; a thing with none is kept for its links but not asked). Tiers are core (about 1,000 to 3,000), wide (to about 10,000), deep (to 30,000 or 50,000). A question's tier gives Punt's difficulty (below).

**6. Applied to kb/** as an audience flag, never a deletion: `universal` (core or wide), `specialist` (has an article, thin), `trade` (thin or none and mostly trader links), `borderline` (deep, or thin with an educational or list signal) and `outside the score` (sayings and quotations, which have no article). The flags live in a sidecar (`kb/audience.js`: id → audience, written by the tool; a second file of Korbi's overrides on top), not in `entities.js`, so the hand-written data is not touched by a machine run. The release build leaves out `specialist` and `trade` and `outside` things unless Korbi's overrides keep them; Korbi's own copy keeps everything. Crates' board positions are protected: see below.

@@PILOT@@
