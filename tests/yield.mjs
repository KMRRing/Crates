// Yield (README, Yield): the words it counts, the rules of a word typed, points and ranks, that a puzzle's yield is
// every word its letters make and has a pangram, the generator's levels against its own measure of difficulty, the
// daily the same everywhere and never a letter set twice in its walk, the computer player at its three levels, the
// chart, a team's split (the parts make the whole, neither alone does) through the database's round trip, and a run
// kept through JSON.
import { BOARDS, LEVELS, DAILY, RANKS, RIVALS, FULL_BONUS, deal, daily, dealTeam, yieldOf, totalOf, pointsOf, isFull, needed, rankOf, judge,
  chartOf, planFor, rivalAt, outerOf, statsOf, depthOf, centreFor, centresIn, teamFound, onlyMine, counts, zipfOf, hiveSets, makesDaily,
  maskOf, FIRST_DAY } from "../yield-engine.js";
import { WORDS, DAYS, BLOCKED } from "../yield-words.js";
import { isWord, isVariant, tierOf } from "../wordlist.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const all = Object.entries(WORDS).flatMap(([n, [run, bands]]) => Array.from({ length: bands.length }, (_, i) => run.slice(i * n, i * n + Number(n))));
const dict = { isWord, isVariant };

// ---------- the words that count ----------
check(all.length > 15000 && all.every(w => /^[a-z]{4,15}$/.test(w) && !w.includes("s")), `${all.length} counted words, four letters or more, a to z, never an s`);
check(all.every(w => isWord(w) && !isVariant(w)), "every one a word in wordlist.js, and the same on both sides of the Atlantic");
check(BLOCKED.split(" ").every(w => !counts(w)) && ["chink", "retard", "fucked", "wanna", "yeah"].every(w => BLOCKED.split(" ").includes(w)), "slurs, vulgarities and slang never count");
check(["online", "upcoming", "anytime", "timeline", "deployed", "nightgown", "tonight", "minority"].every(counts), "ordinary words count, the modern ones SCOWL files as rare among them");
check(["gonging", "tenanting", "anteing", "queening", "cabbed", "leerier"].every(w => isWord(w) && !counts(w)), "odd forms of common words don't (SCOWL files them with their base word)");
check(["tony", "japan", "google", "carter"].every(w => !counts(w)), "names that SCOWL keeps in lower case don't");
check(all.every(w => zipfOf(w) >= 1.5) && zipfOf("the") === 0, "every counted word has its frequency; a word Yield doesn't count has none");

// ---------- a word typed, and its points ----------
{
  const p = { board: "hive", letters: "ailnoty", centre: "l", level: "medium", seed: 1 };
  const j = (w, o = {}) => judge(p, w, { dict, ...o });
  check(j("lot").kind === "short" && j("toil").kind === "word" && j("TOIL").kind === "word", "four letters or more; case doesn't matter");
  check(j("into").kind === "centre" && j("blot").kind === "letters" && j("lo2t").kind === "letters", "the centre letter in every word; only the hive's letters");
  check(j("toil", { have: new Set(["toil"]) }).kind === "found" && j("toil", { have: new Map([["toil", 1]]) }).by === 1, "a word found once, and by whom");
  const pangram = yieldOf(p).find(w => isFull(p, w)), twice = yieldOf(p).find(w => w.length >= 5 && new Set(w).size < w.length);
  check(j("toil").points === 1 && j("lotion").points === 6 && j(pangram).points === pangram.length + FULL_BONUS && j(pangram).full && !j("lotion").full,
    `four letters 1, longer one a letter, a pangram seven more (${pangram}, ${j(pangram).points})`);
  check(j(twice).kind === "word" && pointsOf(p, twice) === twice.length, `letters as often as you like (${twice})`);
  check(j("loti").kind !== "word" && j("loyal").kind === "word", "only words Yield counts score");
  const u = { board: "hive", letters: "celnoru", centre: "o", level: "medium", seed: 1 };
  check(judge(u, "colour", { dict }).kind === "variant" && judge(u, "color", { dict }).kind === "variant", "a spelling one side of the Atlantic uses is known as one, and not counted");
  const q = { board: "hive", letters: "acelnor", centre: "o", level: "medium", seed: 1 };
  check(judge(q, "carol", { dict }).kind === "word" && judge(q, "coral", { dict }).kind === "word", "anagrams are both words");
  check(judge(q, "oracle", { dict }).kind === "word" && judge(q, "lorcan", { dict }).kind === "unknown", "a word, a non-word");
  const rare = all.length && ["coln", "cornel", "loran"].find(w => isWord(w) && !counts(w) && !isVariant(w));
  check(!!rare && judge(q, rare, { dict }).kind === "rare" && judge(q, rare).kind === "unknown", `a real word too rare to count says so (${rare}); without the dictionary loaded it's just not counted`);
  const slur = BLOCKED.split(" ").find(w => isWord(w) && new Set(w).size <= 7 && w.length >= 4);
  const sp = { board: "hive", letters: [...new Set(slur + "aeioutrnl")].slice(0, 7).sort().join(""), centre: slur[0], level: "medium", seed: 1 };
  check(!!slur && judge(sp, slur, { dict }).kind === "unknown", "a slur the word list has is never called a word");
  // a wheel: each tile once
  const w = { board: "wheel", letters: [..."reckoning"].sort().join(""), centre: "n", level: "medium", seed: 1 };
  check(judge(w, "reckoning").kind === "word" && judge(w, "reckoning").points === 9 + FULL_BONUS && isFull(w, "reckoning"), "a wheel's nine-letter word uses every tile: nine and seven more");
  check(judge(w, "ninon").kind === "tiles" && judge(w, "inner").kind === "word" && judge(w, "neon").kind === "word", "a wheel's tile is used once: two Ns, not three");
  check(judge(w, "rock").kind === "centre", "and its centre is in every word");
}

// ---------- ranks ----------
check(RANKS.length === 10 && RANKS[0][1] === "Crude" && RANKS[8][1] === "Master refiner" && RANKS[9][1] === "Full yield" && RANKS.every(([f], i) => !i || f > RANKS[i - 1][0]), "ten ranks from Crude to Full yield, rising");
{
  const need = needed(200);
  check(need[8] === 140 && need[9] === 200 && need[1] === 4, "the points each rank needs, rounded (70% of 200 is 140)");
  check(rankOf(0, 200) === 0 && rankOf(139, 200) === 7 && rankOf(140, 200) === 8 && rankOf(199, 200) === 8 && rankOf(200, 200) === 9, "Master refiner at 70%; Full yield only with every point");
}

// ---------- a puzzle's yield: every word its letters make ----------
{
  let exact = true, pangrams = true, n = 0;
  for (const board of Object.keys(BOARDS)) for (const level of Object.keys(LEVELS)) for (let s = 1; s <= 12; s++) {
    const p = deal({ seed: s * 7717 + level.length, level, board }), got = yieldOf(p);
    // brute force: every counted word, tried against the letters
    const have = [...p.letters].reduce((c, ch) => (c[ch] = (c[ch] || 0) + 1, c), {}), M = maskOf(p.letters);
    const fits = w => w.includes(p.centre) && (maskOf(w) & ~M) === 0 && (board === "hive" || [...w].every(ch => [...w].filter(x => x === ch).length <= have[ch]));
    const want = all.filter(fits).sort();
    if (want.join() !== got.join()) exact = false;
    if (!got.some(w => isFull(p, w))) pangrams = false;
    n++;
  }
  check(exact, `a puzzle's yield is exactly the counted words its letters make (${n} puzzles, every word tried)`);
  check(pangrams, "every one has a pangram (a wheel, its nine-letter word)");
}

// ---------- dealing: the same puzzle from the same seed, each level as it says ----------
{
  const a = deal({ seed: 4242, level: "heavy", board: "hive" }), b = deal({ seed: 4242, level: "heavy", board: "hive" });
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(deal({ seed: 4243, level: "heavy", board: "hive" })), "a seed deals the same puzzle every time, another seed another");
  const dep = {}, size = {}, slow = {};
  let suited = 0, total = 0, quick = true;
  for (const board of Object.keys(BOARDS)) for (const level of Object.keys(LEVELS)) {
    const ds = [], ws = [], times = [];
    for (let s = 1; s <= 40; s++) {
      const t0 = performance.now(), p = deal({ seed: s * 104729 + 7, level, board });
      if (performance.now() - t0 > 250) quick = false;
      const words = yieldOf(p), st = statsOf(p, words);
      ds.push(st.depth); ws.push(st.words);
      const band = { light: [2.75, 9], medium: [2.35, 2.75], heavy: [0, 2.35] }[level];
      if (st.depth >= band[0] && st.depth < band[1]) suited++;
      total++;
      if (board === "hive") {
        // a Steady player's minutes to Master refiner: the computer player's own model of how people play
        const plan = planFor(p, words, "steady", s), need = needed(totalOf(p, words))[8];
        let acc = 0, at = 999;
        for (const x of plan) { acc += pointsOf(p, x.w); if (acc >= need) { at = x.t / 60; break; } }
        times.push(at);
      }
    }
    dep[`${board} ${level}`] = median(ds); size[`${board} ${level}`] = median(ws);
    if (board === "hive") slow[level] = median(times);
  }
  check(quick, "each deal takes a moment, never a wait");
  check(suited / total >= 0.95, `the deals are at their level's depth (${suited} of ${total})`);
  check(["hive", "wheel"].every(b => dep[`${b} light`] > dep[`${b} medium`] && dep[`${b} medium`] > dep[`${b} heavy`]),
    `Light's yields go least deep, Heavy's deepest (median depth ${Object.entries(dep).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ")})`);
  check(slow.light < slow.medium && slow.medium <= slow.heavy,
    `and a Steady player takes longer to reach Master refiner the heavier the crude (median minutes ${Object.entries(slow).map(([k, v]) => `${k} ${v >= 999 ? "never" : v.toFixed(0)}`).join(", ")})`);
  check(size["hive light"] >= 20 && size["hive heavy"] <= 75 && size["wheel light"] >= 16, `sizes in their ranges (median words ${Object.entries(size).map(([k, v]) => `${k} ${v}`).join(", ")})`);
}
{
  const p = deal({ seed: 99, level: "medium", board: "hive" }), st = statsOf(p);
  check(st.ing <= 0.3 && st.ed <= 0.45, "a yield isn't mostly one ending (-ing or -ed)");
  check(depthOf(p, yieldOf(p)) === st.depth, "the depth is the one the stats give");
}

// ---------- today's ----------
{
  const day = 20261020, a = daily(day), b = daily(day);
  check(JSON.stringify(a) === JSON.stringify(b) && a.board === DAILY.board && a.level === DAILY.level && a.day === day, "today's puzzle is the same wherever it's dealt, a Medium hive, and knows its day");
  const sets = new Set(), days = [];
  for (let i = 0; i <= DAYS.length / 7; i++) { const d = new Date(Date.UTC(2026, 9, 20) + i * 864e5); days.push(d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()); }
  let medium = 0;
  for (const d of days.slice(0, 120)) { const p = daily(d), st = statsOf(p); sets.add(p.letters); if (st.depth >= 2.35 && st.depth < 2.75 && st.words >= 26 && st.words <= 55) medium++; }
  check(sets.size === 120 && medium === 120, "120 days, 120 letter sets, every one a Medium puzzle");
  check(daily(days[DAYS.length / 7]).letters === daily(FIRST_DAY).letters && daily(days[1]).letters !== daily(FIRST_DAY).letters, "a set comes back only once the walk has used every one");
  const capable = hiveSets().filter(makesDaily), walk = DAYS.match(/.{7}/g);
  check(walk.length === new Set(walk).size && walk.length === capable.length && capable.every(s => walk.includes(s)),
    `the walk (yield-words.js) is every letter set that can make today's puzzle, once each (${walk.length}): rebuild it if this fails`);
}

// ---------- the computer player ----------
{
  const p = deal({ seed: 777, level: "medium", board: "hive" }), words = yieldOf(p), set = new Set(words);
  const plan = planFor(p, words, "steady", 777);
  check(JSON.stringify(plan) === JSON.stringify(planFor(p, words, "steady", 777)), "the rival plays the same game from the same seed (a reload, another phone)");
  check(plan.every(x => set.has(x.w)) && new Set(plan.map(x => x.w)).size === plan.length && plan.every((x, i) => !i || x.t >= plan[i - 1].t), "it finds only the puzzle's words, each once, in time order");
  check(rivalAt(p, plan, 0).points === 0 && rivalAt(p, plan, 1e9).points === totalOf(p, plan.map(x => x.w)), "it starts at nothing and ends with all it knows");
  const sprint = {};
  for (const level of Object.keys(RIVALS)) {
    const pts = [];
    for (let s = 1; s <= 60; s++) { const q = deal({ seed: s * 31 + 5, level: "medium", board: "hive" }), ws = yieldOf(q); pts.push(rivalAt(q, planFor(q, ws, level, s), 180).points); }
    sprint[level] = median(pts);
  }
  check(sprint.novice < sprint.steady && sprint.steady < sprint.sharp && sprint.sharp < sprint.master && sprint.novice >= 15 && sprint.master <= 110,
    `in a three-minute sprint, Novice < Steady < Sharp < Master, at a person's pace (median points ${Object.entries(sprint).map(([k, v]) => `${k} ${v}`).join(", ")})`);
}

// ---------- the chart ----------
{
  const p = deal({ seed: 5, level: "light", board: "hive" }), words = yieldOf(p), found = new Set(words.slice(0, 5)), c = chartOf(words, found);
  const cells = c.rows.reduce((s, r) => s + Object.values(r.n).reduce((a, b) => a + b, 0), 0);
  check(c.left === words.length - 5 && cells === c.left && c.rows.reduce((s, r) => s + r.total, 0) === c.left && c.starts.reduce((s, [, n]) => s + n, 0) === c.left,
    "the chart counts what's left: by first letter and length, and by the first two letters");
  check(c.rows.every(r => words.some(w => w[0] === r.letter)) && c.lengths.every(n => n >= 4 && n <= 9), "a row for every first letter, lengths from four to 9+");
}

// ---------- a team: the same letters, a centre each ----------
{
  let split = true, even = true, sizes = [];
  for (let s = 1; s <= 20; s++) {
    const p = dealTeam({ seed: s * 911, level: ["light", "medium", "heavy"][s % 3], board: "hive" });
    const [a, b] = p.centres, wa = yieldOf(p, [a]), wb = yieldOf(p, [b]), union = yieldOf(p, centresIn(p, 2));
    const both = new Set([...wa, ...wb]);
    if (a === b || both.size !== union.length || !union.every(w => both.has(w)) || wa.length >= union.length || wb.length >= union.length) split = false;
    const onlyA = wa.filter(w => !wb.includes(w)).length, onlyB = wb.filter(w => !wa.includes(w)).length;
    if (Math.min(onlyA, onlyB) / union.length < 0.15) even = false;
    if (new Set(p.centres).size !== p.centres.length || p.centres.length !== new Set(p.letters).size) split = false;
    sizes.push(union.length);
  }
  check(split, "each player's words with their own centre: the two make the team's yield, neither alone does");
  check(even, "and each has words only they can enter, a fair share of them");
  const p = dealTeam({ seed: 3, level: "medium", board: "hive" });
  check(centreFor(p, 0) === p.centres[0] && centreFor(p, 1) === p.centres[1] && centreFor(p, 9) === p.centres[9 % p.centres.length] && centresIn(p, 3).length === 3,
    "a centre for every seat, a party's further seats taking the other letters");
  check(JSON.stringify(dealTeam({ seed: 3, level: "medium", board: "hive" })) === JSON.stringify(p), "the same team puzzle from the same seed on every phone");
  // the table as the database keeps it: each seat's run with its words and when; the team's yield is all of them
  const [a, b] = p.centres, wa = yieldOf(p, [a]).filter(w => !w.includes(b)), wb = yieldOf(p, [b]).filter(w => !w.includes(a)), shared = yieldOf(p, [a]).filter(w => w.includes(b));
  const g = roundTrip({ v: 1, n: 1, people: 2, players: { u1: { name: "Korbi", slot: 0 }, u2: { name: "Sarah", slot: 1 } },
    runs: { s0: { begun: 1, words: { [wa[0]]: 1000, [shared[0]]: 5000 } }, s1: { begun: 1, words: { [wb[0]]: 2000, [shared[0]]: 4000 } } } });
  const t = teamFound(g);
  check(t.size === 3 && t.get(wa[0]) === 0 && t.get(wb[0]) === 1 && t.get(shared[0]) === 1, "through the database's round trip: every seat's words, a word both found going to whoever found it first");
  check(teamFound(roundTrip({ v: 1, n: 1, players: { u1: { name: "K", slot: 0 } }, runs: { s0: { begun: 1 } } })).size === 0 && teamFound(null).size === 0, "a run with no words yet (the database keeps no empty object) is nothing found");
  check(onlyMine(g, 0).has(wa[0]) && !onlyMine(g, 0).has(shared[0]) && onlyMine(g, 1).has(wb[0]), "a race's words nobody else found");
  // a word typed at a team's table: yours, or your partner's
  const seats = new Map([[1, b]]), word = wb[0];
  check(judge(p, word, { centre: a, seats, dict }).kind === "centre" && judge(p, word, { centre: a, seats, dict }).by === 1 && judge(p, word, { centre: b, dict }).kind === "word",
    "a word with only your partner's letter is theirs to enter, and says whose it is");
}

// ---------- a run kept ----------
{
  const p = deal({ seed: 12, level: "light", board: "wheel" }), words = yieldOf(p);
  const run = { kind: "run", p, found: words.slice(0, 3), extra: [], typed: "ab", picks: [0, 1], outer: outerOf(p, () => 0.5), used: 61234, secs: 180, rival: "sharp", top: 2, over: false };
  const back = JSON.parse(JSON.stringify(run));
  check(JSON.stringify(back) === JSON.stringify(run) && yieldOf(back.p).join() === words.join(), "a run goes through JSON whole, and its puzzle gives the same yield");
  const outer = outerOf(p, () => 0.3);
  check([...outer, p.centre].sort().join("") === p.letters && outer.length === p.letters.length - 1, "the letters round the centre are the board's others, a wheel's eight tiles");
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
