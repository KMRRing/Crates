// Order: enough dated cards for a run, quantity families of one unit with enough cards each, and every card a number
// that can be compared; a run's placements (right, wrong, the lives, the end); higher or lower (a chain of cards, none
// twice, none too close, one family; the tap, the move on, the end; the page's keys); and the table, when several play one
// run together (order-engine.js): a tap places the card only if it's still the card in hand on the line the player
// saw, so two phones tapping at once place it once; the lives are the team's; each card keeps who placed it; each
// player's tally, the pair's record (a team result) and a new game. Every state goes through the database's own round
// trip (tests/rtdb.js), which refuses undefined, drops what's empty and may give a list back as an object.
// Run: node tests/order.mjs
const { QUOTES } = await import("../quote-bank.js");
const { LIVES, MOST, BY_ID, FEWEST, FAMILIES, familyOf, bestIn, size, dealRun, topicsIn, fits, placeCard, freshTable, isTable, tidy, placeAt, newGameAt, tallies, resultOf } = await import("../order-engine.js");
const { TOPICS, TOPIC_PRESETS, presetOf, cleanTopics } = await import("../quote-engine.js");
const { roundTrip, same } = await import("./rtdb.js");
import fs from "node:fs";
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };

// ---------- the cards ----------
const dates = QUOTES.filter(q => q.unit === "year");
check(dates.length >= 16, `enough dated cards for a run (${dates.length})`);
check(FAMILIES.length >= 4 && FAMILIES.every(f => f.ids.length >= 6), `enough quantity families (${FAMILIES.length}), each of six cards or more`);
const notNumbers = QUOTES.filter(q => !Number.isFinite(q.truth));
check(!notNumbers.length, `every card a number (not: ${notNumbers.map(q => q.id).join(", ")})`);

// ---------- a run ----------
const sorted = line => line.every((c, i) => i === 0 || size(line[i - 1].id) <= size(c.id));
const rightGap = run => [...run.line.keys(), run.line.length].find(s => fits(run.line, run.deck[0], s));
const wrongGap = run => [...run.line.keys(), run.line.length].find(s => !fits(run.line, run.deck[0], s));

// ---------- units that are sizes of one thing (kb/units.js) ----------
// a family is one dimension: a hectare and a square kilometre are areas and share a line, each card in its own unit, ordered by
// what it is in the dimension's base; a unit nothing else shares stands alone, as every unit once did
{
  const unitsIn = FAMILIES.flatMap(f => f.units);
  check(new Set(unitsIn).size === unitsIn.length, "no unit is in two families");
  const mixed = FAMILIES.filter(f => f.mixed), length = familyOf("metres");
  check(mixed.length >= 4 && length.unit === "length" && length.units.includes("km") && length.units.includes("metres"), `${mixed.length} families put units together (${mixed.map(f => f.unit).join(", ")}); metres and kilometres are one`);
  check(familyOf("km") === length && familyOf("no such unit").units.join() === "no such unit" && !familyOf("no such unit").mixed, "a run saved under a unit still finds its family, and an unknown unit is its own");
  const a = BY_ID.get("tr-05"), b = BY_ID.get("tr-06");        // the Suez Canal (193 km) and the Ever Given (400 metres)
  check(a.unit === "km" && b.unit === "metres" && a.truth < b.truth && size(a.id) > size(b.id), "193 km is longer than 400 metres though 193 is the smaller number");
  const run = dealRun("quantities", 21, null);
  const line = [...run.deck].map(id => ({ id })).sort((x, y) => size(x.id) - size(y.id));
  check(sorted(line) && line.every((c, i) => i === 0 || fits(line, c.id, i) || size(line[i - 1].id) === size(c.id)), "a line of cards in different units is in order of their sizes");
  const pops = FAMILIES.flatMap(f => f.ids).filter(id => id.startsWith("mq-population-")).map(id => [id, size(id)]).sort((x, y) => x[1] - y[1]);
  const close = pops.findIndex(([, v], k) => k && v > pops[k - 1][1] && v / pops[k - 1][1] < 1.01), far = pops.findIndex(([, v], k) => k && v / pops[k - 1][1] > 1.05);
  check(close > 0 && fits([{ id: pops[close - 1][0] }], pops[close][0], 0) && fits([{ id: pops[close - 1][0] }], pops[close][0], 1)
    && far > 0 && !fits([{ id: pops[far - 1][0] }], pops[far][0], 0) && fits([{ id: pops[far - 1][0] }], pops[far][0], 1), "two quantities within one per cent fit either side of each other, others only in their place");
  const years = dates.filter(q => !q.pic).map(q => q.truth).sort((a, b) => a - b), k = years.findIndex((v, n) => n && v === years[n - 1] + 1);
  const [early, late] = [dates.find(q => q.truth === years[k - 1]), dates.find(q => q.truth === years[k])];
  check(k > 0 && !fits([{ id: early.id }], late.id, 0) && fits([{ id: early.id }], late.id, 1), "years are exact: a year after another is never before it");
  check(bestIn({ "q:metres": 7, "q:km": 4 }, length) === 7 && bestIn({ "q:length": 9, "q:km": 4 }, length) === 9 && bestIn({}, length) === 0, "a best kept under a unit before the units were put together still counts");
}
{
  const a = dealRun("dates", 11), b = dealRun("dates", 11);
  check(same(a, b) && !same(a, dealRun("dates", 12)), "a seed deals the same run every time, another seed another");
  check(a.deck.length + a.line.length === 16 && a.line.length === 1 && a.lives === LIVES && a.placed === 0 && !a.over, "a run of dates: sixteen cards, one face up, three lives");
  check(Object.keys(a).join() === "seed,mode,unit,story,deck,line,lives,placed,over", "a run keeps what it always kept (the solo run's daily and day are the page's)");
  const s = dealRun("stories", 5);
  check(s.story && s.deck.every(id => BY_ID.get(id)?.story === s.story), "a story's run deals that story's events");
  const run = dealRun("dates", 3), ok = placeCard(run, rightGap(run), { fresh: true });
  check(ok.ok && run.placed === 1 && run.lives === LIVES && run.line.length === 2 && run.line[ok.at].fresh && sorted(run.line), "a card in its gap counts, marked as asked");
  const miss = placeCard(run, wrongGap(run));
  check(!miss.ok && run.placed === 1 && run.lives === LIVES - 1 && sorted(run.line) && !run.line[miss.at].ok, "a card in the wrong gap costs a life and goes where it belongs");
}

// ---------- the dealer remembers (a run of your own, not a daily or a table) ----------
// what you've been dealt comes after what you haven't, so the same sixteen dates don't come round while hundreds wait; the
// same seed with nothing seen is the deal it always was (a daily, a table's deal and a shared board code must not move)
{
  const cards = run => [run.line[0].id, ...run.deck];
  const plain = dealRun("dates", 99, null), none = dealRun("dates", 99, null, new Set());
  check(JSON.stringify(plain) === JSON.stringify(none), "nothing seen: the deal is the seed's, as it always was");
  const first = dealRun("dates", 5, null, new Set()), seen = new Set(cards(first));
  const again = dealRun("dates", 5, null, seen);
  check(cards(first).length === 16 && !cards(again).some(id => seen.has(id)) && !again.recycled, "the next deal has none of the sixteen just played");
  // played to the end, the dates come round only once all of them have been dealt
  const all = new Set(); let runs = 0, recycledAt = 0;
  for (let i = 1; i < 200 && !recycledAt; i++) { const run = dealRun("dates", 1000 + i, null, all); if (run.recycled) recycledAt = i; else { cards(run).forEach(id => all.add(id)); runs++; } }
  check(recycledAt > 0 && all.size > dates.length - 16, `no date is dealt twice until fewer than a run's worth are left (${runs} runs, ${all.size} of ${dates.length} cards)`);
  const ids = dates.map(q => q.id), last = dealRun("dates", 7, null, new Set(ids.slice(0, ids.length - 5)));
  check(cards(last).length === 16 && last.recycled && ids.slice(ids.length - 5).every(id => cards(last).includes(id)), "a deal short of fresh cards takes all that are left, then reaches back, and says so");
  // a mix of topics: the same, within the topics in
  const trader = cleanTopics({ trade: 2, markets: 2, art: 0, people: 0, wine: 0 });
  const t1 = dealRun("dates", 11, trader, new Set()), t2 = dealRun("dates", 11, trader, new Set(cards(t1)));
  check(cards(t1).every(id => BY_ID.get(id).cat !== "art") && !cards(t2).some(id => cards(t1).includes(id)) && cards(t2).every(id => BY_ID.get(id).cat !== "art"), "with a mix the unseen ones are drawn within its topics");
  // quantities: a family you've played has its unseen cards first, and a family with none unseen is rare, not barred
  const q1 = dealRun("quantities", 3, null, new Set()), fam = familyOf(q1.unit), played = new Set(cards(q1).slice(0, 5));
  const q2 = dealRun("quantities", 3, null, played);
  check(q2.unit !== q1.unit || cards(q2).slice(0, fam.ids.length - 5).every(id => !played.has(id)), "in a family the unseen cards come first");
  const allSeen = new Set(FAMILIES.flatMap(f => f.ids)), q3 = dealRun("quantities", 4, null, allSeen);
  check(q3.deck.length >= 5 && q3.recycled, "every card seen: a deal still comes, and says it went back over them");
  check(!dealRun("stories", 2, null, allSeen).recycled && dealRun("stories", 2, null, allSeen).story === dealRun("stories", 2).story, "a story is dealt whole, as it was, and has nothing to forget");
  const page = fs.readFileSync(new URL("../order.js", import.meta.url), "utf8");
  check(/dealRun\(mode, seed, daily \? null : mixFor\(mode\), daily \|\| mode === "stories" \? null : new Set\(seenIds\(\)\)\)/.test(page) && /if \(tracked\(S\)\) markSeen\(\[id\]\)/.test(page), "the page deals a run of your own from what you've seen, and notes each card you place; a daily doesn't");
  check(!/dealRun\([^)]*new Set/.test(fs.readFileSync(new URL("../order-engine.js", import.meta.url), "utf8").split("export function freshTable")[1] || ""), "a table's deal is never from one phone's memory");
}

// ---------- topics ----------
// a run of dates or quantities deals from a mix of Quote's categories, each out (0), in (1) or more (2)
{
  const cat = id => BY_ID.get(id).cat, cards = run => [run.line[0].id, ...run.deck];
  const balanced = TOPIC_PRESETS.balanced.topics, none = Object.fromEntries(TOPICS.map(([id]) => [id, 0]));
  check(topicsIn("dates").map(([id]) => id).join() === "trade,wine,art,people,markets" && topicsIn("quantities").length === TOPICS.length && !topicsIn("stories").length,
    "each mode's topics: the categories its cards are in (none for the stories)");
  check([11, 12, 13].every(seed => same(dealRun("dates", seed), dealRun("dates", seed, balanced)) && same(dealRun("quantities", seed), dealRun("quantities", seed, balanced))),
    "every topic in deals a run as it always was, so today's run is the same whatever anyone's mix");
  const noArt = { ...balanced, art: 0 };
  check([1, 2, 3, 4, 5].every(seed => { const r = dealRun("dates", seed, noArt); return cards(r).length === 16 && cards(r).every(id => cat(id) !== "art") && !r.wide; }),
    "a topic out: none of its cards, still sixteen");
  // twice as likely per card is twice as often only for a small topic: a topic with a share s of the pool is dealt 2 / (1 + s)
  // times as often, so a big one (Trade, once the law's years joined it) would sink below the band
  let more = 0, inn = 0;
  for (let seed = 0; seed < 300; seed++) { more += cards(dealRun("dates", seed, { ...noArt, markets: 2 })).filter(id => cat(id) === "markets").length; inn += cards(dealRun("dates", seed, noArt)).filter(id => cat(id) === "markets").length; }
  check(more / inn > 1.6 && more / inn < 2.3, `a topic more is dealt about twice as often as in (${(more / inn).toFixed(2)} times)`);
  const refining = { ...none, refining: 1 }, q = dealRun("quantities", 7, refining);
  check(cards(q).length >= 6 && cards(q).every(id => cat(id) === "refining" && familyOf(q.unit).units.includes(BY_ID.get(id).unit)), "quantities: one family with six cards or more in the topics in, and only those cards");
  const wine = dealRun("dates", 9, { ...none, wine: 1 });
  check(wine.wide && cards(wine).length === 16 && topicsIn("dates").length && [...new Set(cards(wine).map(cat))].length > 1 && FEWEST > 5,
    "a mix that leaves too few cards deals from every topic, and says so");
  check(presetOf(balanced) === "balanced" && presetOf(TOPIC_PRESETS.trader.topics) === "trader" && presetOf(noArt) === "custom" && presetOf(cleanTopics({ art: 7, wine: 0 })) === "custom"
    && cleanTopics({ art: 7, wine: 0 }).art === 1 && cleanTopics(null).trade === 1, "a mix is a preset's or your own; a weight it doesn't know is in");
  const t = freshTable({}, { seed: 3, weights: noArt });
  check(cards(t.run).every(id => cat(id) !== "art"), "a table's first game dealt from the dealer's mix");
  const g = freshTable({}, { seed: 4 });
  newGameAt(g, { n: 1, mode: "dates", seed: 5, weights: noArt });
  check(g.n === 2 && cards(g.run).every(id => cat(id) !== "art"), "and its next game too");
}

// ---------- higher or lower (November 2026) ----------
// one life, two cards, tap the higher: a chain of cards dealt whole from the seed, none twice, none too close to call to the
// one before, all in one family; the tap judges the pair, a right one moves the chain on, a wrong one ends the run
{
  const { HL_MODES, HL_FAMILIES, HL_LEAST, HL_WORTH, dealHigherLower, answerHigherLower, advanceHigherLower, pairOf, higherOf, wasRight, tooClose } = await import("../order-engine.js");
  const { bestOfDay } = await import("../days.js");
  const cat = id => BY_ID.get(id).cat, cards = run => run.cards, fam = run => familyOf(run.unit);
  const balanced = TOPIC_PRESETS.balanced.topics, none = Object.fromEntries(TOPICS.map(([id]) => [id, 0]));
  /** The run's pairs in order, each a tap would judge (the card with its value showing, the one beside it). */
  const pairs = run => run.cards.slice(1).map((id, i) => [run.cards[i], id]);
  // too close to call: the same year; quantities within a hundredth, in whatever unit each is in
  const pops = FAMILIES.flatMap(f => f.ids).filter(id => id.startsWith("mq-population-")).map(id => [id, size(id)]).sort((x, y) => x[1] - y[1]);
  const near = pops.findIndex(([, v], k) => k && v > pops[k - 1][1] && v / pops[k - 1][1] < 1.01), apart = pops.findIndex(([, v], k) => k && v / pops[k - 1][1] > 1.05);
  const years = dates.filter(q => !q.pic).map(q => q.truth).sort((a, b) => a - b), k = years.findIndex((v, n) => n && v === years[n - 1] + 1);
  const [early, late] = [dates.find(q => q.truth === years[k - 1]), dates.find(q => q.truth === years[k])], twin = dates.find(q => q.id !== early.id && q.truth === early.truth);
  check(near > 0 && tooClose(pops[near - 1][0], pops[near][0]) && tooClose(pops[near][0], pops[near - 1][0]) && apart > 0 && !tooClose(pops[apart - 1][0], pops[apart][0]),
    "quantities within one per cent are too close to call, either way round; others are not");
  check(twin && tooClose(early.id, twin.id) && !tooClose(early.id, late.id), "the same year is too close to call, the next year is not");

  check(Object.keys(HL_MODES).join() === "dates,quantities" && dealHigherLower("stories", 3).mode === "dates", "dates and quantities; History's stories have nothing to compare");
  check(HL_FAMILIES.length >= 5 && HL_FAMILIES.every(f => f.ids.length >= HL_LEAST && f.ids.every(id => size(id) > 0)), `${HL_FAMILIES.length} families to run through, each of ${HL_LEAST} cards or more, every size above zero`);
  const a = dealHigherLower("dates", 11), b = dealHigherLower("quantities", 11);
  check(same(a, dealHigherLower("dates", 11)) && same(b, dealHigherLower("quantities", 11)) && !same(a, dealHigherLower("dates", 12)) && !same(b, dealHigherLower("quantities", 12)), "a seed deals the same run every time, another seed another");
  check(Object.keys(a).join() === "hl,seed,mode,unit,cards,at,score,over,picked" && a.hl && a.at === 0 && a.score === 0 && !a.over && a.picked === null && same(JSON.parse(JSON.stringify(a)), a),
    "a run is plain data (it is kept in localStorage as it stands): the chain, where it has got to, the score, no tap yet");
  check([11, 12, 13].every(seed => same(dealHigherLower("dates", seed), dealHigherLower("dates", seed, balanced)) && same(dealHigherLower("quantities", seed), dealHigherLower("quantities", seed, balanced))),
    "every topic in deals a run as it would with no mix, so today's run is the same whatever anyone's mix");

  // what every run is, over many seeds
  let longest = 0, shortest = Infinity;
  for (let seed = 1; seed <= 80; seed++) for (const mode of ["dates", "quantities"]) {
    const run = dealHigherLower(mode, seed * 7919), ids = cards(run);
    longest = Math.max(longest, ids.length); shortest = Math.min(shortest, ids.length);
    const bad = [];
    if (new Set(ids).size !== ids.length) bad.push("a card twice");
    if (mode === "dates" ? !ids.every(id => BY_ID.get(id).unit === "year" && dates.some(q => q.id === id)) : !(HL_FAMILIES.includes(fam(run)) && ids.every(id => fam(run).ids.includes(id)))) bad.push("not one family");
    for (const [x, y] of pairs(run)) {
      const [p, q] = [size(x), size(y)];
      if (mode === "dates" ? p === q : Math.max(p, q) / Math.min(p, q) <= 1.01) bad.push(`too close: ${x} and ${y}`);
    }
    check(!bad.length && run.cards.length >= HL_LEAST, `seed ${seed * 7919}, ${mode}: ${bad.join("; ") || `${ids.length} cards, one chain`}`);
    if (bad.length) break;
  }
  check(shortest >= HL_LEAST && longest >= dates.length * 0.95, `a run is the whole pool in a chain: dates ${longest} cards, the shortest ${shortest}`);
  check(new Set(Array.from({ length: 60 }, (_, i) => dealHigherLower("quantities", 500 + i).unit)).size >= 4, "the quantities come from several families, not always the biggest");

  // the tap
  const run = dealHigherLower("dates", 21), [x, y] = pairOf(run), hi = higherOf(x, y), lo = hi === x ? y : x, frozen = JSON.stringify(run);
  const right = answerHigherLower(run, hi);
  check(JSON.stringify(run) === frozen, "a tap makes a new run and leaves the old one as it was");
  check(right.picked === hi && right.score === 1 && !right.over && right.at === 0 && wasRight(right) === true && same(pairOf(right), [x, y]), "a right tap scores, shows both and keeps the pair on the table");
  check(answerHigherLower(right, lo) === right && answerHigherLower(run, "no-such-card") === run, "a second tap, or a card not on the table, does nothing");
  const next = advanceHigherLower(right);
  check(next.at === 1 && next.picked === null && pairOf(next)[0] === y && pairOf(next)[1] === run.cards[2] && next.score === 1, "after a right tap the card dealt beside the other takes its place, and a new one is dealt");
  check(advanceHigherLower(run) === run, "nothing moves on before a tap");
  const wrong = answerHigherLower(run, lo);
  check(wrong.over && wrong.score === 0 && wrong.picked === lo && wasRight(wrong) === false && advanceHigherLower(wrong) === wrong && answerHigherLower(wrong, hi) === wrong, "a wrong tap ends the run: no score for it, no going on, no second try");
  // the winner doesn't stay: tapping the left card when it is the higher still puts the right one in its place
  const leftHigher = Array.from({ length: 40 }, (_, i) => dealHigherLower("dates", 900 + i)).find(r => higherOf(...pairOf(r)) === r.cards[0]);
  check(leftHigher && pairOf(advanceHigherLower(answerHigherLower(leftHigher, leftHigher.cards[0])))[0] === leftHigher.cards[1], "the card beside the other takes its place, higher or lower than it: the run is a chain, not the highest so far");

  // played through: always right clears the pool; right k times then wrong scores k
  const play = (run, taps) => { let r = run, n = 0; while (!r.over) { const [p, q] = pairOf(r), h = higherOf(p, q); r = answerHigherLower(r, n++ < taps ? h : h === p ? q : p); r = advanceHigherLower(r); } return r; };
  for (const mode of ["dates", "quantities"]) {
    const sure = play(dealHigherLower(mode, 77), Infinity);
    check(sure.over && sure.score === sure.cards.length - 1 && wasRight(sure) === true && sure.at === sure.cards.length - 2, `${mode}: every tap right to the last pair: ${sure.score} right, over, every card dealt`);
    const fall = play(dealHigherLower(mode, 77), 5);
    check(fall.over && fall.score === 5 && wasRight(fall) === false, `${mode}: five right then a wrong one: a score of five, over`);
  }
  check(play(dealHigherLower("dates", 5), 0).score === 0, "a wrong first tap scores nothing");

  // topics: the cards drawn by their topics' weights, as the line's are
  const trader = cleanTopics({ trade: 2, markets: 2, art: 0, people: 0, wine: 0 }), t1 = dealHigherLower("dates", 11, trader);
  check(cards(t1).every(id => cat(id) !== "art" && cat(id) !== "people" && cat(id) !== "wine") && !t1.wide && cards(t1).length > 30, "a topic out: none of its cards, the rest all dealt");
  const w1 = dealHigherLower("dates", 9, { ...none, wine: 1 });
  check(w1.wide && new Set(cards(w1).map(cat)).size > 1 && cards(w1).length >= dates.length * 0.9, "a mix that leaves too few cards deals from every topic, and says so");
  const head = (r, n) => cards(r).slice(0, n).filter(id => cat(id) === "markets").length;
  let more = 0, inn = 0;
  for (let seed = 0; seed < 60; seed++) { more += head(dealHigherLower("dates", seed, { ...balanced, markets: 2 }), 40); inn += head(dealHigherLower("dates", seed, balanced), 40); }
  check(more > inn * 1.3, `a topic more comes earlier in the chain (${more} against ${inn} of its cards among the first forty)`);
  const [topic, family] = TOPICS.map(([id]) => [id, HL_FAMILIES.find(f => f.ids.filter(i => cat(i) === id).length >= HL_LEAST)]).find(([, f]) => f) || [];
  if (topic) {
    const q = dealHigherLower("quantities", 7, { ...none, [topic]: 1 });
    check(!q.wide && cards(q).length >= HL_LEAST && cards(q).every(id => cat(id) === topic && fam(q).ids.includes(id)), `quantities with only ${topic} in: one family, only its cards in that topic`);
  }
  const thin = TOPICS.map(([id]) => id).find(id => !HL_FAMILIES.some(f => f.ids.filter(i => cat(i) === id).length >= HL_LEAST));
  check(!thin || dealHigherLower("quantities", 7, { ...none, [thin]: 1 }).wide, "quantities with no family of enough cards in the topics in deal from every topic, and say so");

  // no repeats: what you've seen comes after what you haven't, and the memory is let go when too little is left
  const plain = dealHigherLower("dates", 5), seen = new Set(cards(plain).slice(0, 40)), again = dealHigherLower("dates", 5, null, seen);
  check(same(plain, dealHigherLower("dates", 5, null, new Set())) && !again.recycled, "nothing seen: the deal is the seed's");
  check(cards(again).slice(0, dates.length - seen.size - 10).every(id => !seen.has(id)) && cards(again).length === cards(plain).length, "the unseen cards come first, the seen ones after");
  const most = new Set(dates.map(q => q.id).slice(0, dates.length - (HL_WORTH - 1)));
  check(dealHigherLower("dates", 6, null, most).recycled && !dealHigherLower("dates", 6, null, new Set(dates.map(q => q.id).slice(0, dates.length - HL_WORTH))).recycled, "fewer unseen cards than a good run's worth: the deal says it reached back, and the page lets them go");
  const q1 = dealHigherLower("quantities", 3, null, new Set()), q2 = dealHigherLower("quantities", 3, null, new Set(fam(q1).ids));
  check(q2.unit !== q1.unit && !q2.recycled, "a family with nothing unseen isn't dealt while others have cards you haven't seen");
  check(dealHigherLower("quantities", 4, null, new Set(HL_FAMILIES.flatMap(f => f.ids))).recycled, "every card seen: a deal still comes, and says it went back over them");

  // the page: its own run, bests and daily, the seen memory, the round's end
  const page = fs.readFileSync(new URL("../order.js", import.meta.url), "utf8");
  check(/HL = "order:hl", HL_BEST = "order:hlbest", PLAY = "order:play"/.test(page) && /BEST = "order:best"/.test(page) && !/write\(BEST, [^)]*hl/i.test(page), "higher or lower keeps its run, its bests and the way you play under order:, apart from the line's best");
  check(/dealHigherLower\(m, seed, daily \? null : mixFor\(m\), daily \? null : new Set\(seenIds\(\)\)\)/.test(page) && /if \(!H\.daily\) markSeen\(/.test(page), "the page deals a run of your own from what you've seen and notes each card as it shows; a daily doesn't");
  check(/\$\{H\.day \?\? today\(\)\}\/hl-\$\{H\.mode\}/.test(page) && bestOfDay({ "20261102/hl-dates": 9, "20261102/dates": 4, "20261101/hl-dates": 30 }, 20261102) === 9, "today's run is kept in the daily map by the day and its mode, where the games screen reads it");
  check((page.match(/roundOver\("order"\)/g) || []).length >= 2 && /onPause\(/.test(page), "both ways of playing end a round for Random mode, and the moment before the next pair stands still while the menu is open");
  check(/Object\.entries\(hlOn\(\) \? HL_MODES : MODES\)/.test(page), "the menu offers higher or lower no History");
}

// ---------- the table ----------
/** A transaction as the database runs one: the change on the table as stored (made whole); false or null leaves it be. */
const tx = (g, change) => { const cur = tidy(roundTrip(g)); const out = change(cur); return out === false || out == null ? { g, done: false } : { g: roundTrip(cur), done: true, out }; };
const seat = (name, slot) => ({ name, slot, pid: `p${slot}`, online: true });
{
  check(freshTable({}, { seed: 1, people: 9 }).people === MOST && freshTable({}, { seed: 1 }).people === 2 && freshTable({}, { seed: 1, people: "x" }).people === 2,
    "a table keeps two to six seats for people: a pair's two, a party's as many as asked");
  // a party of three: Korbi's phone deals, Sarah and Tom sit down
  let g = roundTrip(freshTable({ a: seat("Korbi", 0) }, { mode: "dates", seed: 42, people: 3, app: 2, now: 1000 }));
  g.players.b = seat("Sarah", 1); g.players.c = seat("Tom", 2);
  g = roundTrip(g);
  check(isTable(g) && g.v === 2 && g.n === 1 && g.people === 3 && !isTable({ v: 1, match: {}, n: 1 }), "a new table holds its first game (a head-to-head's table isn't one)");
  check(same(tidy(roundTrip(g)).run, dealRun("dates", 42)), "the run survives the database's round trip whole, once made whole (its story's null, dropped)");
  const holes = tidy({ run: { deck: { 0: "x", 2: "y" }, line: { 0: { id: "z", ok: true } }, lives: 0 } }).run;
  check(same(holes.deck, ["x", "y"]) && holes.line.length === 1 && holes.lives === 0 && holes.placed === 0 && holes.over === false && holes.story === null,
    "a list given back as an object, or with a hole, is a list again; no lives is no lives");

  // the three phones show the same card on the same line; Korbi's tap gets there first, Sarah's a moment later
  const seen = tidy(roundTrip(g)), card = seen.run.deck[0], len = seen.run.line.length;
  let r = tx(g, s => placeAt(s, { n: 1, id: card, len, at: rightGap(seen.run), slot: 0 }));
  check(r.done && r.out.ok, "Korbi's tap places the card in hand");
  g = r.g;
  const k = tidy(roundTrip(g)).run;
  check(k.line.find(c => c.id === card)?.by === 0 && k.line.length === 2 && k.placed === 1 && k.deck[0] !== card, "the card shows who placed it; the next is in hand");
  const late = tx(g, s => placeAt(s, { n: 1, id: card, len, at: 0, slot: 1 }));
  check(!late.done && same(late.g, g), "Sarah's tap, made on the screen before Korbi's card went in, places nothing");
  check(!tx(g, s => placeAt(s, { n: 1, id: k.deck[0], len, at: 0, slot: 1 })).done, "nor does a tap on the line as it was, though the card in hand is right");
  check(!tx(g, s => placeAt(s, { n: 2, id: k.deck[0], len: k.line.length, at: 0, slot: 1 })).done, "nor one from another game");
  check(!tx(g, s => placeAt(s, { n: 1, id: k.deck[0], len: k.line.length, at: k.line.length + 1, slot: 1 })).done, "nor one past the end of the line");

  // the lives are the team's: a wrong place by anyone costs one of the same three
  const miss = slot => { const cur = tidy(roundTrip(g)).run; r = tx(g, s => placeAt(s, { n: 1, id: cur.deck[0], len: cur.line.length, at: wrongGap(cur), slot })); g = r.g; return r; };
  check(miss(1).done && !r.out.ok, "Sarah's card in the wrong gap goes in, where it belongs");
  check(miss(2).done && tidy(roundTrip(g)).run.lives === LIVES - 2, "Tom's too: the team has one life left");
  const two = tidy(roundTrip(g)).run;
  check(sorted(two.line) && two.line.filter(c => !c.ok).map(c => c.by).sort().join() === "1,2" && !two.over && resultOf(g) === null,
    "the line is always right, the misses marked with who made them; no result while the game is on");
  check(miss(0).done && tidy(roundTrip(g)).run.over, "Korbi's miss spends the last life: the game is over for everyone");
  const end = tidy(roundTrip(g)).run;
  check(!tx(g, s => placeAt(s, { n: 1, id: end.deck[0], len: end.line.length, at: 0, slot: 1 })).done, "nothing is placed once it's over");
  const t = tallies(end);
  check(t[0].right === 1 && t[0].wrong === 1 && t[1].right === 0 && t[1].wrong === 1 && t[2].wrong === 1 && !t[3], "each player's tally, right and wrong, from the line");
  const res = resultOf(g);
  check(res && res.match === "1000-1" && res.score === 1 && res.won === false && res.coop === true, "the pair's record: a team result, the count placed, lost on lives");

  // a new game for the table: once, whoever asks first
  r = tx(g, s => newGameAt(s, { n: 1, mode: "stories", seed: 9 }));
  check(r.done && r.g.n === 2 && r.g.run.mode === "stories" && r.g.run.lives === LIVES && !r.g.run.over, "a new game, in the mode asked for, with three fresh lives");
  check(!tx(r.g, s => newGameAt(s, { n: 1, mode: "dates", seed: 3 })).done, "a second New game from a screen still on the last one deals nothing");
  check(resultOf(r.g) === null, "and the new game has no result yet");

  // the whole story placed, the three taking turns: won, with lives to spare
  g = r.g;
  for (let i = 0; !tidy(roundTrip(g)).run.over && i < 50; i++) {
    const cur = tidy(roundTrip(g)).run;
    g = tx(g, s => placeAt(s, { n: 2, id: cur.deck[0], len: cur.line.length, at: rightGap(cur), slot: i % 3 })).g;
  }
  const story = tidy(roundTrip(g)).run, won = resultOf(g);
  check(story.over && story.deck.length === 0 && story.lives === LIVES && sorted(story.line), "the whole deck placed: over, every life left");
  check(won.match === "1000-2" && won.won && won.score === story.line.length - 1 && Object.values(tallies(story)).reduce((n, x) => n + x.right, 0) === won.score,
    "the record counts the cards placed, each player's share adding up to it");
}

console.log(bad ? `order: ${bad} problems` : `order: ${dates.length} dated cards, ${FAMILIES.length} quantity families (${FAMILIES.map(f => `${f.unit} ${f.ids.length}`).join(", ")}); a run, its topics, higher or lower and a table of three played through`);
if (bad) process.exitCode = 1;
