// Order: enough dated cards for a run, quantity families of one unit with enough cards each, and every card a number
// that can be compared; a run's placements (right, wrong, the lives, the end); and the table, when several play one
// run together (order-engine.js): a tap places the card only if it's still the card in hand on the line the player
// saw, so two phones tapping at once place it once; the lives are the team's; each card keeps who placed it; each
// player's tally, the pair's record (a team result) and a new game. Every state goes through the database's own round
// trip (tests/rtdb.js), which refuses undefined, drops what's empty and may give a list back as an object.
// Run: node tests/order.mjs
const { QUOTES } = await import("../quote-bank.js");
const { LIVES, MOST, BY_ID, FEWEST, dealRun, topicsIn, fits, placeCard, freshTable, isTable, tidy, placeAt, newGameAt, tallies, resultOf } = await import("../order-engine.js");
const { TOPICS, TOPIC_PRESETS, presetOf, cleanTopics } = await import("../quote-engine.js");
const { roundTrip, same } = await import("./rtdb.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };

// ---------- the cards ----------
const dates = QUOTES.filter(q => q.unit === "year");
const fams = Object.entries(QUOTES.filter(q => q.unit !== "year").reduce((f, q) => ((f[q.unit] ||= []).push(q), f), {})).filter(([, qs]) => qs.length >= 6);
check(dates.length >= 16, `enough dated cards for a run (${dates.length})`);
check(fams.length >= 4, `enough quantity families (${fams.length})`);
const notNumbers = QUOTES.filter(q => !Number.isFinite(q.truth));
check(!notNumbers.length, `every card a number (not: ${notNumbers.map(q => q.id).join(", ")})`);

// ---------- a run ----------
const truth = id => BY_ID.get(id).truth;
const sorted = line => line.every((c, i) => i === 0 || truth(line[i - 1].id) <= truth(c.id));
const rightGap = run => [...run.line.keys(), run.line.length].find(s => fits(run.line, run.deck[0], s));
const wrongGap = run => [...run.line.keys(), run.line.length].find(s => !fits(run.line, run.deck[0], s));
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
  let more = 0, inn = 0;
  for (let seed = 0; seed < 300; seed++) { more += cards(dealRun("dates", seed, { ...noArt, trade: 2 })).filter(id => cat(id) === "trade").length; inn += cards(dealRun("dates", seed, noArt)).filter(id => cat(id) === "trade").length; }
  check(more / inn > 1.6 && more / inn < 2.3, `a topic more is dealt about twice as often as in (${(more / inn).toFixed(2)} times)`);
  const refining = { ...none, refining: 1 }, q = dealRun("quantities", 7, refining);
  check(cards(q).length >= 6 && cards(q).every(id => cat(id) === "refining" && BY_ID.get(id).unit === q.unit), "quantities: one family with six cards or more in the topics in, and only those cards");
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

console.log(bad ? `order: ${bad} problems` : `order: ${dates.length} dated cards, ${fams.length} quantity families (${fams.map(([u, qs]) => `${u} ${qs.length}`).join(", ")}); a run, its topics and a table of three played through`);
if (bad) process.exitCode = 1;
