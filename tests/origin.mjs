// Origin: every answer the game deals has enough clues, none of them names the country or a place in it, the hardest
// come first, and any country on the map can be guessed by name; a run's guesses, clues, giving up and scoring; and the
// table, when several play one run together (origin-engine.js): guesses by several players, each kept with who made
// it; a tap made on a screen the table has moved on from does nothing (two phones taking a clue at once turn up one,
// two pressing Next at once move on one country); the pair's record (a team result) the moment the last country is
// decided; a new game. Every state goes through the database's own round trip (tests/rtdb.js), which refuses
// undefined, drops what's empty and may give a list back as an object. Run: node tests/origin.mjs
const { ENTITIES } = await import("../kb/entities.js");
const { COUNTRIES } = await import("../chart-countries.js");
const { PER_RUN, FULL, PER_CLUE, PER_GUESS, MOST, PLACE, ALIASES, ANSWERS, GUESSABLE, TOPIC_LIST, TOPIC_PRESETS, FEWEST_CLUES, dealRun, pointsNow, guessIn, clueIn, giveUpIn, nextIn, decided,
  freshTable, isTable, tidy, guessAt, clueAt, giveUpAt, nextAt, newGameAt, resultOf } = await import("../origin-engine.js");
const { LINKS } = await import("../kb/links.js");
const { roundTrip, same } = await import("./rtdb.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };

// ---------- the countries and their clues ----------
check(ANSWERS.length >= 50, `enough answers (${ANSWERS.length})`);
check(ANSWERS.every(id => Number.isFinite(PLACE.get(id)?.lat) && Number.isFinite(PLACE.get(id)?.lon)), "every answer has a place on the map");
check(COUNTRIES.every(c => GUESSABLE.get(c.name.toLowerCase()) === (c.about || c.id)), "every country on the map can be guessed by its name");
{
  const run = dealRun(7), names = new Map(ENTITIES.map(e => [e.id, e.name]));
  check(same(run, dealRun(7)) && !same(run, dealRun(8)) && run.rounds.length === PER_RUN && new Set(run.rounds.map(R => R.id)).size === PER_RUN,
    "a seed deals the same five countries every time, another seed others");
  check(run.rounds.every(R => R.clues.length >= 6 && R.shown === 1 && R.clues.every((c, i) => i === 0 || R.clues[i - 1].d >= c.d)), "each with six clues at least, one showing, the hardest first");
  const says = run.rounds.flatMap(R => R.clues.filter(c => (ALIASES.get(R.id) || []).some(n => n.length > 3 && `${c.name} ${c.hint}`.toLowerCase().includes(n))).map(c => `${names.get(R.id)}: ${c.name}`));
  check(!says.length, `no clue names its country (${says.join("; ")})`);
}

// ---------- topics ----------
// a run's clues come from a mix of Crates' country topics (each out, in or more): the topic out never, unless a country
// would be left with fewer than six; a topic more ahead within each difficulty
{
  const aspects = new Map(LINKS.filter(l => l.hint).map(l => [`${l.to}|${l.hint}`, l.aspects || []]));
  const of = (R, c) => aspects.get(`${R.id}|${c.hint}`) || [];
  const balanced = TOPIC_PRESETS.balanced.topics;
  check(TOPIC_LIST.length === 19 && Object.keys(TOPIC_PRESETS).join() === "balanced,trader,culture", "the topics: Crates' nineteen country topics, its three presets");
  check([1, 2, 3, 4].every(seed => same(dealRun(seed), dealRun(seed, balanced))), "every topic in deals as it always did: today's run is the same whatever anyone's mix");
  const noHistory = { ...balanced, hist: 0 }, runs = [5, 6, 7, 8, 9, 10].map(seed => dealRun(seed, noHistory));
  const onlyHistory = (R, c) => of(R, c).length && of(R, c).every(a => a === "hist");
  check(runs.every(run => run.rounds.every(R => R.clues.length >= FEWEST_CLUES && R.clues.every(c => !onlyHistory(R, c) || R.clues.filter(x => !onlyHistory(R, x)).length < FEWEST_CLUES))),
    "a topic out: none of its clues, unless the country would have fewer than six");
  const ppl = { ...balanced, ppl: 2 }, first = run => run.rounds.every(R => R.clues.every((c, i) => i === 0 || R.clues[i - 1].d > c.d
    || Math.max(...of(R, R.clues[i - 1]).map(a => ppl[a] ?? 1), 1) >= Math.max(...of(R, c).map(a => ppl[a] ?? 1), 1)));
  check([11, 12, 13].every(seed => first(dealRun(seed, ppl))), "a topic more: its clues ahead of the rest within each difficulty");
  const t = freshTable({}, { seed: 14, weights: noHistory }), g = freshTable({}, { seed: 15 });
  newGameAt(g, { n: 1, seed: 16, weights: noHistory });
  check(same(t.run, dealRun(14, noHistory)) && same(g.run, dealRun(16, noHistory)), "a table's games dealt from the dealer's mix");
}

// ---------- a run ----------
const far = id => ANSWERS.find(x => x !== id);                          // a wrong guess
{
  const run = dealRun(3), R = run.rounds[0];
  check(guessIn(run, far(R.id)) === "wrong" && R.shown === 2 && R.guesses.length === 1 && !("guessedBy" in R), "a wrong guess turns up the next clue (and a solo run marks no one)");
  check(guessIn(run, far(R.id)) === "again" && R.guesses.length === 1, "the same guess again counts for nothing");
  check(clueIn(run) && R.shown === 3 && pointsNow(R) === FULL - 2 * PER_CLUE - PER_GUESS, "another clue costs ten, a wrong guess five");
  check(guessIn(run, R.id) === "found" && R.done === "found" && R.points === FULL - 2 * PER_CLUE - PER_GUESS && run.total === R.points && !("doneBy" in R), "found: its points to the total");
  check(guessIn(run, far(R.id)) === "decided" && !clueIn(run) && !giveUpIn(run), "a decided country takes no more guesses, clues or giving up");
  nextIn(run);
  check(run.index === 1 && giveUpIn(run) && run.rounds[1].points === 0 && run.total === R.points && !decided(run), "giving up scores nothing");
  for (let i = 2; i < PER_RUN; i++) { nextIn(run); giveUpIn(run); }
  check(decided(run) && !run.over && (nextIn(run), run.over), "the last decided, the total is final; Next after it ends the run");
}

// ---------- the table ----------
/** A transaction as the database runs one: the change on the table as stored (made whole); false or null leaves it be. */
const tx = (g, change) => { const cur = tidy(roundTrip(g)); const out = change(cur); return !out ? { g, done: false, out } : { g: roundTrip(cur), done: true, out }; };
const seat = (name, slot) => ({ name, slot, pid: `p${slot}`, online: true });
const view = g => tidy(roundTrip(g)).run;                              // what every phone shows
{
  check(freshTable({}, { seed: 1, people: 9 }).people === MOST && freshTable({}, { seed: 1 }).people === 2, "a table keeps two to six seats for people");
  let g = roundTrip(freshTable({ a: seat("Korbi", 0) }, { seed: 21, people: 3, app: 2, now: 500 }));
  g.players.b = seat("Sarah", 1); g.players.c = seat("Tom", 2);
  g = roundTrip(g);
  check(isTable(g) && g.v === 2 && g.n === 1 && g.people === 3 && !isTable({ v: 1, match: { seed: 1 }, n: 1 }), "a new table holds its first game (a head-to-head's table isn't one)");
  const whole = view(g);
  check(same(whole.rounds.map(R => ({ ...R, guessedBy: undefined })).map(R => JSON.parse(JSON.stringify(R))), dealRun(21).rounds) && whole.rounds.every(R => same(R.guesses, []) && same(R.guessedBy, []) && R.done === null),
    "the five countries survive the database's round trip whole, once made whole (empty guesses and nulls, dropped)");
  const holes = tidy({ run: { rounds: { 0: { id: "x", clues: { 0: { name: "a" }, 2: { name: "b" } }, guesses: { 0: "y" }, guessedBy: { 0: 0 } } } } }).run;
  check(holes.rounds.length === 1 && holes.rounds[0].clues.length === 2 && same(holes.rounds[0].guessedBy, [0]) && holes.index === 0 && holes.total === 0,
    "lists given back as objects, or with holes, are lists again; a seat of 0 stays a seat");

  // three phones on the first country: Korbi and Sarah guess wrong, Tom guesses what Korbi already did
  const R0 = whole.rounds[0], at0 = { n: 1, index: 0 };
  let r = tx(g, s => guessAt(s, { ...at0, id: far(R0.id), slot: 0 }) === "wrong");
  g = r.g;
  const other = ANSWERS.find(x => x !== R0.id && x !== far(R0.id));
  g = tx(g, s => guessAt(s, { ...at0, id: other, slot: 1 }) === "wrong").g;
  let R = view(g).rounds[0];
  check(same(R.guesses, [far(R0.id), other]) && same(R.guessedBy, [0, 1]) && R.shown === 3, "guesses by two players, each kept with who made it, each turning up a clue");
  r = tx(g, s => guessAt(s, { ...at0, id: far(R0.id), slot: 2 }));
  check(r.out === "again" && same(view(g).rounds[0].guesses, R.guesses), "Tom's guess of a country already guessed changes nothing");

  // Korbi and Sarah both tap Another clue, seeing three: one clue turns up
  r = tx(g, s => clueAt(s, { ...at0, shown: 3 }));
  check(r.done && view(r.g).rounds[0].shown === 4, "the first tap on Another clue turns one up");
  g = r.g;
  check(!tx(g, s => clueAt(s, { ...at0, shown: 3 })).done && view(g).rounds[0].shown === 4, "the second, made seeing three, turns up nothing: one clue for the two taps");

  // Tom finds it; Sarah's guess and give-up from before it, and two Nexts at once
  const points = FULL - 3 * PER_CLUE - 2 * PER_GUESS;
  r = tx(g, s => guessAt(s, { ...at0, id: R0.id, slot: 2 }) === "found");
  g = r.g;
  R = view(g).rounds[0];
  check(r.done && R.done === "found" && R.doneBy === 2 && R.points === points && view(g).total === points, "Tom finds it: the points are the team's, and his name on it");
  check(tx(g, s => guessAt(s, { ...at0, id: other, slot: 1 })).out === "decided" && !tx(g, s => giveUpAt(s, { ...at0, slot: 1 })).done,
    "Sarah's guess or give-up from a screen before it was found does nothing");
  check(!tx(g, s => nextAt(s, { n: 1, index: 1 })).done, "Next does nothing for a country the table isn't on");
  r = tx(g, s => nextAt(s, at0));
  check(r.done && view(r.g).index === 1, "Korbi's Next moves the table on");
  g = r.g;
  check(!tx(g, s => nextAt(s, at0)).done && view(g).index === 1, "Sarah's Next, pressed at the same moment, doesn't skip a country");
  check(tx(g, s => guessAt(s, { ...at0, id: R0.id, slot: 1 })).out === "moved" && !tx(g, s => nextAt(s, { n: 1, index: 1 })).done,
    "a guess for the last country is turned down; Next waits for this one to be decided");

  // Sarah gives up on the second; the rest found or given up; the record as the last is decided
  r = tx(g, s => giveUpAt(s, { n: 1, index: 1, slot: 1 }));
  g = r.g;
  check(r.done && view(g).rounds[1].done === "gave up" && view(g).rounds[1].doneBy === 1 && view(g).rounds[1].points === 0 && resultOf(g) === null,
    "a give-up scores nothing, and says who; no result while a country is left");
  for (let i = 2; i < PER_RUN; i++) {
    g = tx(g, s => nextAt(s, { n: 1, index: i - 1 })).g;
    const id = view(g).rounds[i].id;
    g = tx(g, s => guessAt(s, { n: 1, index: i, id, slot: i % 3 }) === "found").g;
  }
  const res = resultOf(g), run = view(g);
  check(res && res.match === "500-1" && res.score === run.total && run.total === points + 3 * FULL && res.won === false && res.coop === true && !run.over,
    "the last country decided: the pair's record has the team's total at once, before Finish (won only with all five found)");
  g = tx(g, s => nextAt(s, { n: 1, index: PER_RUN - 1 })).g;
  check(view(g).over && !tx(g, s => guessAt(s, { n: 1, index: PER_RUN - 1, id: "x", slot: 0 }) === "found").done, "Finish ends it for everyone");

  // a new game for the table: once, whoever asks first
  r = tx(g, s => newGameAt(s, { n: 1, seed: 99 }));
  check(r.done && r.g.n === 2 && !view(r.g).over && view(r.g).index === 0 && view(r.g).total === 0 && resultOf(r.g) === null, "a new game: five more countries, nothing scored");
  check(!tx(r.g, s => newGameAt(s, { n: 1, seed: 5 })).done && !tx(r.g, s => guessAt(s, { n: 1, index: 0, id: view(r.g).rounds[0].id, slot: 0 }) === "found").done,
    "a second New game, or a guess, from a screen still on the last game changes nothing");
}

console.log(bad ? `origin: ${bad} problems` : `origin: ${ANSWERS.length} countries, each with at least 6 clues that don't name it and a place on the map; a run and a table of three played through`);
if (bad) process.exitCode = 1;
