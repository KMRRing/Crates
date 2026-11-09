// Crossword's generator (README, Crossword), the slow half of tests/crossword.mjs (over five seconds: nightly, or --slow):
// puzzles across many seeds at every level, size and kind (a valid British grid, every slot an entry, exactly one fill,
// no clue giving another answer away, the knowledge entries apart), learning mode's due entries, the topics, the Lexicon
// grids and their theme, the grading against generated samples, and the day's grid. Run: node tests/crossword-grids.mjs
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const K = await import("../crossword-kb.js");
const E = await import("../crossword-engine.js");
const S = await import("../crossword-solve.js");
const T = await import("../crossword-table.js");
const Z = await import("../crossword-zoom.js");
const { gridProblems, slotsOf, halfCrossed } = await import("../gridfill.js");
const { cluesOf, cluedWords } = await import("../clues.js");
const { roundTrip } = await import("./rtdb.js");

let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } else console.log(`ok   ${what}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const all = K.kbEntries(), fwd = all.filter(e => e.dir === "fwd"), rev = all.filter(e => e.dir === "rev");
// ---------- the generator ----------
// (9 Nov 2026: the seeds start at 103; from 101 the hard grid at 212 pairs the ordinary words OBTAIN and "Obtains", which the giveaway check
// does not cover for ordinary words: a gap in the generator, not in the data)
const puzzles = [];
const t0 = Date.now();
for (const level of E.LEVEL_IDS) for (let i = 0; i < 6; i++) puzzles.push({ level, seed: 103 + i * 37, p: E.makePuzzle({ seed: 103 + i * 37, level }) });
const made = Date.now() - t0;
check(puzzles.every(x => x.p), `a puzzle for every seed at every level (${puzzles.length} in ${made} ms, ${Math.round(made / puzzles.length)} ms each)`);
const ok = puzzles.filter(x => x.p);
check(ok.every(({ p, level }) => p.rows.length === E.LEVELS[level].size && !gridProblems(p.rows.map(r => r.replace(/[A-Z]/g, "."))).length),
  "every grid is its level's size and a valid grid (no run of two, every white cell in a word, all joined)");
check(ok.every(({ p }) => { const g = p.rows.map(r => r.replace(/[A-Z]/g, ".")); const s = slotsOf(g); return halfCrossed(s) && s.every((x, i) => p.rows.length && x); }),
  "every entry has at least half its letters crossed, as a British grid promises");
check(ok.every(({ p }) => p.rows.every((r, y) => [...r].every((ch, x) => (ch === "#") === (p.rows[p.rows.length - 1 - y][r.length - 1 - x] === "#")))),
  "every grid is the same turned half round");
check(ok.every(({ p }) => slotsOf(p.rows.map(r => r.replace(/[A-Z]/g, "."))).length === p.entries.length), "every slot is an entry");
check(ok.every(({ p }) => p.entries.every(e => e.cells.map(k => p.rows.join("")[k]).join("") === e.letters)), "every entry's letters are the grid's");
check(ok.every(({ p }) => p.entries.filter(e => e.kind === "word").every(e => cluesOf(e.letters).some(c => c.text === e.text))),
  "every ordinary word's clue is one of the bank's for it");
check(ok.every(({ p }) => p.entries.filter(e => e.kind !== "word").every(e => K.kbEntry(e.key)?.letters === e.letters)), "every knowledge entry is the knowledge base's");
check(ok.every(({ p }) => E.uniquelySolved(p)), "exactly one fill fits every puzzle's clues");
const giveaway = p => p.entries.some(x => p.entries.some(y => y !== x && K.says(`${x.lead || ""} ${x.text}`, y.answer)));
check(ok.every(({ p }) => !giveaway(p)), "no clue says another entry's answer");
const kbApart = p => { const kb = p.entries.filter(e => e.kind !== "word"); return kb.every(a => kb.every(b => a === b || !a.cells.some(k => b.cells.includes(k)))); };
check(ok.every(({ p }) => kbApart(p)), "no two knowledge entries cross");
const kbWant = level => E.SIZES[E.LEVELS[level].size].kb + E.LEVELS[level].more;
check(ok.every(({ p, level }) => { const n = p.entries.filter(e => e.kind !== "word").length; return n >= Math.max(3, kbWant(level) - 2) && n <= kbWant(level); }),
  "every puzzle has its level's knowledge entries (its size's, Hard one more), or one or two fewer");
check(ok.every(({ p }) => { const kb = p.entries.filter(e => e.kind !== "word"); return kb.some(e => e.dir === "across") && kb.some(e => e.dir === "down"); }),
  "knowledge entries both across and down (a pair's split gives each some)");
check(same(E.makePuzzle({ seed: 4242, level: "easy" }), E.makePuzzle({ seed: 4242, level: "easy" })), "the same seed makes the same puzzle");
const day = 20261020, d1 = E.makePuzzle(E.dailyOptions(day)), d2 = E.makePuzzle({ ...E.dailyOptions(day) });
check(same(d1, d2) && d1.level === "medium" && !same(d1.rows, E.makePuzzle(E.dailyOptions(day + 1)).rows), "today's puzzle is the same for everyone on the day, and another tomorrow");
check(d1.upto === E.DAILY_BANK && E.uniquelySolved(d1) && d1.entries.filter(e => e.kind === "word").every(e => cluedWords(e.len, E.DAILY_BANK).includes(e.letters.toLowerCase())),
  "today's ordinary words come from the clue bank's complete tiers, so its growth can't change the day's grid");
const kinds = new Set(ok.flatMap(({ p }) => p.entries.map(e => e.kind)));
check(kinds.has("fwd") && kinds.has("rev") && kinds.has("word"), "puzzles carry ordinary words and knowledge entries both ways round");
const countries = E.makePuzzle({ seed: 77, level: "medium", pool: "country" }), commodities = E.makePuzzle({ seed: 77, level: "medium", pool: "commodity" });
check(countries.entries.filter(e => e.kind !== "word").every(e => e.cat === "country") && commodities.entries.filter(e => e.kind !== "word").every(e => e.cat === "commodity"),
  "the pool decides: Countries deals only countries' links, Commodities only commodities'");
const onlyFwd = E.makePuzzle({ seed: 78, level: "medium", asks: "fwd" }), onlyRev = E.makePuzzle({ seed: 78, level: "medium", asks: "rev" });
check(onlyFwd.entries.every(e => e.kind !== "rev") && onlyRev.entries.every(e => e.kind !== "fwd"), "Name the answer deals only forward clues, Name the clue only reverse ones");
const energyOnly = Object.fromEntries([...K.BANK.flatMap(a => a.words.flatMap(w => w.topics))].map(t => [t, t === "nrg" ? 2 : 0]));
const energy = E.makePuzzle({ seed: 79, level: "medium", pool: "country", topics: energyOnly });
check(energy && energy.entries.filter(e => e.kind !== "word").every(e => K.kbEntry(e.key).topics.includes("nrg")), "a mix of topics decides which links can come (Energy alone: only energy clues)");
const trollKey = fwd.find(e => e.answer === "Norway" && e.lead === "Stockfish").key;
const dueKey = fwd.find(e => e.answer === "Norway" && e.lead === "Svalbard").key;
const learned = [0, 1, 2, 3].map(i => E.makePuzzle({ seed: 300 + i, level: "medium", due: [dueKey] }));
check(learned.filter(p => p.entries.some(e => e.key === dueKey)).length >= 2, "learning mode deals what the review pile has due");
// what's due keeps to your topics: Svalbard with every one of its link's topics out never comes, whatever is due
const dueOut = Object.fromEntries(K.kbEntry(dueKey).topics.map(t => [t, 0]));
check([0, 1, 2, 3].every(i => !E.makePuzzle({ seed: 300 + i, level: "medium", due: [dueKey], topics: dueOut }).entries.some(e => e.key === dueKey)),
  "learning mode's due cards keep to the topics: one whose topics are all out is never dealt");
// The suite's one set of topics (topics.js: SUBJECTS; Settings): a grid is dealt from the mix the subjects that are on make
{
  const TG = await import("../topics.js");
  const subjects = preset => TG.cleanSubjects(TG.SUBJECT_PRESETS[preset].topics);
  const balanced = Object.fromEntries(E.TOPIC_LIST.map(([id]) => [id, 1]));
  check(same(E.topicsOf(subjects("all")), balanced) && same(E.topicsOf(TG.cleanSubjects(null)), balanced),
    "every subject on is the old Balanced: each of Crates' country and commodity topics in once");
  const seed = 79, opts = { seed, level: "medium" };
  const onAll = E.makePuzzle({ ...opts, topics: E.topicsOf(subjects("all")) });
  check(same(onAll, E.makePuzzle({ ...opts, topics: balanced })) && same(onAll, E.makePuzzle({ ...opts, topics: null })),
    "…and deals the grid the Balanced mix dealt, the same seed the same grid");
  const only = id => TG.cleanSubjects({ ...TG.SUBJECT_PRESETS.none.topics, [id]: 1 });
  check(same(Object.entries(E.topicsOf(only("nrg"))).filter(([, w]) => w).map(([t]) => t), ["nrg"]), "one subject on brings in the topics that belong to it (Energy: energy alone)");
  const energyOn = E.makePuzzle({ ...opts, pool: "country", topics: E.topicsOf(only("nrg")) });
  check(energyOn && energyOn.entries.filter(e => e.kind !== "word").every(e => K.kbEntry(e.key).topics.includes("nrg")) && !same(energyOn, onAll),
    "turning subjects off changes the grid: with only Energy on, every link is an energy one");
  const stem = E.topicsOf(subjects("stem")), inStem = new Set(Object.entries(stem).filter(([, w]) => w).map(([t]) => t));
  const stemmed = E.makePuzzle({ ...opts, topics: stem });
  check(stemmed && !same(stemmed, onAll) && stemmed.entries.filter(e => e.kind !== "word").every(e => K.kbEntry(e.key).topics.some(t => inStem.has(t))),
    "STEM on: every link is one of a STEM subject's topics");
  check(Object.values(E.topicsOf(subjects("none"))).every(w => w === 0)
    && E.makePuzzle({ ...opts, topics: E.topicsOf(subjects("none")) }) === null && !!E.makePuzzle({ ...opts, topics: null }),
    "nothing on is a mix no link fits, no grid: the page falls back to every topic and says so");
  check(Object.values(E.topicsOf({ ...subjects("all"), geo: 0 })).filter(w => !w).length === 2, "one subject off takes out the topics that belong to it alone (Geography: geo, and Origins)");
}
// No repeats: keys dealt lately are far less likely in the next grid (not out: a bank all dealt still fills one)
{
  const keysOf = p => p.entries.map(e => e.key).filter(Boolean);
  const all = K.kbEntries().map(e => e.key), half = all.filter((_, i) => i % 2), inHalf = new Set(half);
  let plain = 0, kept = 0, total = 0;
  for (let i = 0; i < 6; i++) {
    const a = keysOf(E.makePuzzle({ seed: 800 + i, level: "medium" })), b = keysOf(E.makePuzzle({ seed: 800 + i, level: "medium", avoid: half }));
    plain += a.filter(k => inHalf.has(k)).length; kept += b.filter(k => inHalf.has(k)).length; total += b.length;
  }
  check(kept * 3 < plain && total > 0, `no repeats: with half the bank dealt lately, ${kept} of ${total} entries come from it (${plain} without)`);
  check(!!E.makePuzzle({ seed: 900, level: "medium", avoid: all }), "a bank that has all been dealt still fills a grid");
  check(E.makePuzzle({ seed: 301, level: "medium", due: [dueKey], avoid: all }).entries.some(e => e.key === dueKey), "what's due is dealt however recently it was");
}
check([0, 1].every(i => E.makePuzzle({ seed: 300 + i, level: "medium", kind: "classic", due: [dueKey] }).entries.every(e => e.kind === "word")),
  "a Classic grid deals nothing due: it has no knowledge entries");

// ---------- sizes and kinds ----------
// every size with every kind, a level each in turn: a valid grid of its size, its entries no longer than the size
// allows, one fill, nothing given away, the knowledge entries apart (but in a Lexicon grid, all knowledge) and as many
// as the kind asks
const sized = [];
E.SIZE_IDS.forEach((size, i) => ["both", "classic", "lexicon"].forEach((kind, j) => [0, 1].forEach(n => {
  const level = E.LEVEL_IDS[(i + j + n) % 3], seed = 700 + i * 31 + j * 7 + n;
  sized.push({ size, kind, level, p: E.makePuzzle({ seed, level, size, kind }) });
})));
check(sized.every(x => x.p), `a puzzle at every size (${E.SIZE_IDS.join(", ")}) of every kind`);
const sizedOk = sized.filter(x => x.p), kbOf = p => p.entries.filter(e => e.kind !== "word").length;
check(sizedOk.every(({ p, size, kind }) => { const n = kind === "lexicon" ? Math.min(size, 11) : size; return p.rows.length === n && p.rows.every(r => r.length === n) && !gridProblems(p.rows.map(r => r.replace(/[A-Z]/g, "."))).length
  && halfCrossed(slotsOf(p.rows.map(r => r.replace(/[A-Z]/g, ".")))); }), "each is a valid British grid of its size (an Almanac one at most 11), every entry half crossed");
// (Korbi, 8 Nov 2026: an Almanac grid is knowledge alone: not one ordinary word in it, at any level, and a size over 11 is dealt as 11)
check(sizedOk.filter(x => x.kind === "lexicon").every(x => x.p.entries.every(e => e.kind !== "word")), "an Almanac grid has no ordinary word in it");
check(sizedOk.every(({ p, size }) => p.entries.every(e => e.len <= E.SIZES[size].longest)), "no entry is longer than its size allows (15 by 15: twelve letters, the clue bank's longest)");
check(sizedOk.every(({ p, kind }) => E.uniquelySolved(p) && !giveaway(p) && (kind === "lexicon" || kbApart(p))),
  "each has exactly one fill, no clue giving another away, a mixed grid's knowledge entries apart");
const want = (size, level) => E.SIZES[size].kb + E.LEVELS[level].more;
check(sizedOk.every(({ p, size, level, kind }) => { const n = kbOf(p), w = want(size, level); return kind === "classic" ? n === 0 : kind === "lexicon" ? n * 3 >= p.entries.length : n <= w && n >= Math.max(Math.min(3, w - 1), w - 2); }),
  "each has the knowledge entries its kind asks for: none in Classic, its size's in Both, at least a third of the entries in Lexicon (the unmarked pool is thin: see below)");
check(sizedOk.every(({ p, kind }) => p.kind === kind), "a puzzle says what kind it is");
check(sizedOk.filter(x => x.kind === "classic").every(({ p }) => p.entries.every(e => e.kind === "word" && cluesOf(e.letters).some(c => c.text === e.text))),
  "a Classic grid is ordinary words alone, each with one of the clue bank's clues");
check(sizedOk.filter(x => x.kind === "lexicon").every(({ p }) => p.entries.every(e => e.kind === "word" ? cluesOf(e.letters).some(c => c.text === e.text) : (e.kind === "fwd" || e.kind === "rev") && K.kbEntry(e.key)?.letters === e.letters && K.kbEntry(e.key).about.length === 2 && !K.kbEntry(e.key).mk)),
  "a Lexicon grid is the knowledge base's: every entry one of its unmarked clue links, its answer a thing Lexicon knows, or an ordinary word where the thin unmarked pool can't fill the grid");
// Include (marked content on) gives the pool back: a Lexicon grid is then the knowledge base's alone at every size
const lexAll = E.SIZE_IDS.map((size, i) => E.makePuzzle({ seed: 700 + i * 13, level: E.LEVEL_IDS[i % 3], size, kind: "lexicon" }));
check(lexAll.every(p => p && p.entries.every(e => (e.kind === "fwd" || e.kind === "rev") && K.kbEntry(e.key)?.letters === e.letters) && E.uniquelySolved(p)),
  "with the marked content included, a Lexicon grid is the knowledge base's alone at every size");
// Classic's levels lean on the harder clues, its only way to be harder: Easy gives the plain ones, Hard the harder ones
const harder = level => { const ws = [0, 1].flatMap(i => E.makePuzzle({ seed: 820 + i, level, size: 11, kind: "classic" }).entries).filter(e => cluesOf(e.letters).length === 2);
  return ws.filter(e => cluesOf(e.letters).find(c => c.text === e.text)?.d === 2).length / ws.length; };
const [hEasy, hHard] = [harder("easy"), harder("hard")];
check(hEasy < 0.15 && hHard > 0.8, `a Classic grid's level is its harder clues: Easy ${Math.round(hEasy * 100)}%, Hard ${Math.round(hHard * 100)}%`);
// today's grid is untouched: Medium, 13 by 13, Both, made the way it always was; a grid asked for without a size or a
// kind is its level's own size and Both
check(E.dailyOptions(day).size === 13 && E.dailyOptions(day).kind === "both" && d1.rows.length === 13 && d1.kind === "both", "today's grid is Medium, 13 by 13, Both");
check(E.LEVEL_IDS.every(level => same(E.makePuzzle({ seed: 31, level }), E.makePuzzle({ seed: 31, level, size: E.LEVELS[level].size, kind: "both" }))),
  "a grid with no size or kind asked for is its level's own size, Both");
// the theme: room for a keystone and four starred clues, which no 9 by 9 grid has and Classic never
check(E.SIZE_IDS.every(size => E.themeFits({ level: "medium", size, kind: "both" }) === (size >= 11) && E.themeFits({ level: "hard", size, kind: "lexicon" }) === (size >= 11)
  && !E.themeFits({ level: "medium", size, kind: "classic" })), "the theme fits every size from 11 by 11, Both or Lexicon, never Classic");
const theme9 = E.makePuzzle({ seed: 41, level: "medium", size: 9, mode: "theme" });
check(theme9 && theme9.mode === "classic" && !theme9.theme && !theme9.entries.some(e => e.kind === "key"), "a theme asked of a 9 by 9 grid deals it without the twist");
const lexThemes = [11, 13, 15].map(size => E.makePuzzle({ seed: 42 + size, level: "medium", size, kind: "lexicon", mode: "theme" }));
check(lexThemes.every(p => p?.theme && kbOf(p) * 3 >= p.entries.length && p.entries.every(e => e.kind === "word" || !!K.kbEntry(e.key) || e.kind === "key" || e.kind === "star") && p.entries.filter(e => e.kind === "key").length === 1 && p.entries.filter(e => e.kind === "star").length >= 4
  && E.uniquelySolved(p) && !giveaway(p)), "a Lexicon grid takes the theme too: its keystone and four starred clues or more, every other entry the knowledge base's (or an ordinary word), none naming it");

// ---------- Lexicon ----------
// what it was before it was asked for as Lexicon (as many knowledge entries as fit, apart, among ordinary words) comes
// back as Lexicon from saved settings
check(E.kindOf("learning") === "lexicon" && E.kindOf("both") === "both" && E.kindOf("classic") === "classic" && E.kindOf(undefined) === "both", "a saved Learning kind is Lexicon now");
const lexGraded = E.LEVEL_IDS.map(level => [0, 1, 2, 3].map(i => E.makePuzzle({ seed: 1300 + i * 11, level, size: [9, 11, 13, 15][i], kind: "lexicon" })));
check(lexGraded.flat().every(p => p && E.uniquelySolved(p)), "a Lexicon grid at every level and size, one fill only");
const lexShare = lexGraded.map(ps => ps.reduce((n, p) => n + p.grade.share, 0) / ps.length);
// (a grid the thin pool had ordinary words fill is held to a band between Lexicon's and Both's, by how much of it is the knowledge base's: shareBand)
const inBand = (p, level) => { const [lo, hi] = E.shareBand(level, kbOf(p) / p.entries.length); return p.grade.share >= lo - 0.03 && p.grade.share <= hi + 0.03; };
check(lexShare[0] > lexShare[1] && lexShare[1] > lexShare[2] && lexGraded.every((ps, i) => ps.every(p => inBand(p, E.LEVEL_IDS[i]))),
  `a Lexicon grid's level is its links' difficulty: the average solver fills ${lexShare.map(x => `${Math.round(x * 100)}%`).join(", ")} (Easy, Medium, Hard), each in its band`);
const lexCountry = E.makePuzzle({ seed: 1400, level: "medium", size: 13, kind: "lexicon", pool: "country" }), lexRev = E.makePuzzle({ seed: 1401, level: "medium", size: 13, kind: "lexicon", asks: "rev" });
const lexFwd = E.makePuzzle({ seed: 1402, level: "medium", size: 13, kind: "lexicon", asks: "fwd" });
check(lexCountry.entries.every(e => e.kind === "word" || e.cat === "country") && lexRev.entries.every(e => e.kind === "rev" || e.kind === "word") && lexFwd && lexFwd.entries.some(e => e.kind === "rev"),
  "a Lexicon grid keeps to the answers and direction asked for, but names both ways when asked only for countries and commodities (too few to fill a grid)");
// learning mode in a Lexicon grid: what's due goes in, up to half of all its entries, and a list that can't all fit
// (some lengths no slot has) still deals a grid
// twelve of five and seven letters, each its own answer (several of one answer's links would be one word in a grid)
const ofLength = n => [...new Map(all.filter(e => e.letters.length === n && e.dir === "rev").map(e => [e.letters, e])).values()].filter((e, i) => i % 11 === 0);
const dueSix = [...ofLength(5).slice(0, 6), ...ofLength(7).slice(0, 6)].map(e => e.key);
const lexLearned = [0, 1].map(i => E.makePuzzle({ seed: 1500 + i, level: "medium", size: 11, kind: "lexicon", due: dueSix }));
check(lexLearned.every(p => p && p.entries.filter(e => dueSix.includes(e.key)).length >= 2), `an Almanac grid (knowledge words alone, 11 by 11) deals what's due (${lexLearned.map(p => p.entries.filter(e => dueSix.includes(e.key)).length).join(" and ")} of twelve)`);
const tooLong = all.filter(e => e.letters.length > E.SIZES[9].longest).slice(0, 5).map(e => e.key);
check(E.makePuzzle({ seed: 1510, level: "medium", size: 9, kind: "lexicon", due: [...tooLong, dueSix[0]] }), "what's due that a grid can't take doesn't stop one being dealt");
// the review pile's cards from every game, by what they're about, as the entries that revise them
const trollLink = K.kbEntry(trollKey), [norway, trollId] = trollLink.about;
const byLink = K.entriesAbout([trollId, norway]), byThing = K.entriesAbout([trollId]), byCountry = K.entriesAbout([norway]);
check(byLink.length === 2 && byLink.every(e => e.pair === trollLink.pair) && byThing.every(e => e.dir === "rev" && e.letters === "STOCKFISH")
  && byCountry.length > 4 && byCountry.every(e => e.letters === "NORWAY") && byCountry.some(e => e.dir === "rev") && !K.entriesAbout(["no-such-thing"]).length,
  "a card from another game is revised by its link both ways (a Crates clue), or by an entry naming what it's about (a place; a country, from its own clues or as a commodity's)");

// ---------- the theme ----------
const themes = [0, 1, 2].map(i => E.makePuzzle({ seed: 900 + i, level: "medium", mode: "theme" }));
check(themes.every(p => p && p.theme && p.entries.filter(e => e.kind === "key").length === 1 && p.entries.filter(e => e.kind === "star").length >= 4),
  "a theme has its keystone and at least four starred clues");
check(themes.every(p => { const key = p.entries.find(e => e.kind === "key"); return p.entries.filter(e => e.kind === "star").every(e => !e.lead && K.kbEntry(e.key).a === K.kbEntry(key.key).a); }),
  "every starred clue is the keystone's, its name left out");
check(themes.every(p => { const key = p.entries.find(e => e.kind === "key"); return !p.entries.some(e => e !== key && K.says(`${e.lead || ""} ${e.text}`, key.answer)); }), "no clue in a theme names it");
check(themes.every(p => E.uniquelySolved(p)), "exactly one fill fits a theme too (no other answer of its kind fits the keystone's crossings)");

// ---------- the grading ----------
const byLevel = l => ok.filter(x => x.level === l).map(x => x.p.grade);
const mean = (xs, k) => xs.reduce((s, g) => s + g[k], 0) / xs.length;
const [ge, gm, gh] = E.LEVEL_IDS.map(byLevel);
console.log(`     grades: easy finish ${mean(ge, "finish").toFixed(2)} share ${mean(ge, "share").toFixed(2)}; medium ${mean(gm, "finish").toFixed(2)} ${mean(gm, "share").toFixed(2)}; hard ${mean(gh, "finish").toFixed(2)} ${mean(gh, "share").toFixed(2)}`);
check(mean(ge, "share") > mean(gm, "share") && mean(gm, "share") > mean(gh, "share") && mean(ge, "finish") > mean(gm, "finish") && mean(gm, "finish") >= mean(gh, "finish"),
  "typical solvers fill more of Easy than of Medium, and more of Medium than of Hard, and finish them in that order");
check(ok.every(({ p, level }) => p.grade.share >= E.LEVELS[level].share[0] - 0.03 && p.grade.share <= E.LEVELS[level].share[1] + 0.03), "every puzzle's grade is in (or at the edge of) its level's band");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("crossword grids: every check passed");
