// Constellation (id yield; the on-screen name, Fathom before 8 November 2026): the words it counts, the sky (seven stars,
// the sight-lines between them) and what it allows, that a puzzle's yield is every word its sky traces, 50 to 100 of them,
// with a full tour among them, in every level and every daily; the layout (the same everywhere, few lines crossing); the
// shadows and hints; points and ranks; the computer player (it finds everything, so it always reaches the galaxy); and a run
// and a match's words through the database's round trip.
import { LEVELS, DAILY, endings, RANKS, MASTER, TOP, FULL_BONUS, STARS, deal, daily, yieldOf, totalOf, pointsOf, isFull, needed, rankOf, judge, canStep, traces,
  trailOf, skyOf, shadowsOf, easiestLeft, statsOf, onlyMine, counts, zipfOf, groupOf, GROUPS } from "../yield-engine.js";
import { WORDS, BLOCKED } from "../yield-words.js";
import { isWord, isVariant } from "../wordlist.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const all = Object.entries(WORDS).flatMap(([n, [run, bands]]) => Array.from({ length: bands.length }, (_, i) => run.slice(i * n, i * n + Number(n))));
const dict = { isWord, isVariant };

// ---------- the words that count ----------
check(all.length > 15000 && all.every(w => /^[a-z]{4,15}$/.test(w) && !w.includes("s")), `${all.length} counted words, four letters or more, a to z, never an s`);
check(all.every(w => isWord(w) && !isVariant(w)), "every one a word in wordlist.js, and the same on both sides of the Atlantic");
check(BLOCKED.split(" ").every(w => !counts(w)) && ["chink", "retard", "fucked", "wanna", "yeah"].every(w => BLOCKED.split(" ").includes(w)), "slurs, vulgarities and slang never count");
check(["online", "upcoming", "anytime", "timeline", "deployed", "nightgown", "tonight", "minority"].every(counts), "ordinary words count, the modern ones SCOWL files as rare among them");
check(["gonging", "tenanting", "anteing", "queening", "cabbed", "leerier"].every(w => isWord(w) && !counts(w)), "odd forms of common words don't (SCOWL files them with their base word)");
check(["tony", "japan", "google", "carter"].every(w => !counts(w)), "names that SCOWL keeps in lower case don't");
check(all.every(w => zipfOf(w) >= 1.5) && zipfOf("the") === 0, "every counted word has its frequency; a word Constellation doesn't count has none");

// ---------- a puzzle: its sky and what the sky allows ----------
const SEEDS = Array.from({ length: 20 }, (_, i) => i * 7919 + 13);
{
  const stat = Object.fromEntries(Object.keys(LEVELS).map(level => [level, SEEDS.map(seed => { const p = deal({ seed, level }); return { p, words: yieldOf(p), s: statsOf(p) }; })]));
  for (const [level, runs] of Object.entries(stat)) {
    check(runs.every(({ s }) => s.words >= 50 && s.words <= 100), `${LEVELS[level]}: every puzzle of ${runs.length} has 50 to 100 words (${Math.min(...runs.map(r => r.s.words))} to ${Math.max(...runs.map(r => r.s.words))})`);
    check(runs.every(({ s }) => s.tours >= 1), `${LEVELS[level]}: every puzzle has a full tour`);
  }
  for (const [level, runs] of Object.entries(stat)) {
    const worst = Math.max(...runs.map(({ words, s }) => endings(words) / s.words)), few = Math.max(...runs.map(({ words }) => endings(words)));
    check(few <= 16 && worst <= 0.25, `${LEVELS[level]}: no two-letter ending takes more than ${few} words or ${Math.round(worst * 100)}% (-ER, -ED and the like)`);
    check(runs.reduce((a, r) => a + r.s.seven, 0) / runs.length >= 0.18, `${LEVELS[level]}: at least about a fifth of the words are seven letters or more`);
  }
  const mean = l => stat[l].reduce((s, r) => s + r.s.depth, 0) / stat[l].length;
  check(mean("light") > mean("medium") && mean("medium") > mean("heavy"), "the levels are ordered by how deep their vocabulary goes (light easiest)");
  const { p, words } = stat.medium[0];
  check(p.letters.length === STARS && p.letters === [...p.letters].sort().join("") && new Set(p.letters).size === STARS, "seven different letters, alphabetical");
  check(words.every(w => w.length >= 4 && counts(w) && traces(p, w)), "every word of the yield is counted, four letters or more, and traced along the sight-lines");
  // exhaustive: no counted word the sky allows is missing (every counted word over these letters, traced)
  const brute = all.filter(w => [...w].every(c => p.letters.includes(c)) && traces(p, w)).sort();
  check(brute.length === words.length && brute.every((w, i) => w === words[i]), `the yield is every word the sky allows: ${words.length}`);
  check(words.every(w => w.length === 4 ? pointsOf(p, w) === 1 : pointsOf(p, w) === w.length + (isFull(p, w) ? FULL_BONUS : 0)), "a four-letter word is a point, a longer one a point a letter, a full tour seven more");
  check(totalOf(p, words) === words.reduce((s, w) => s + pointsOf(p, w), 0) && words.some(w => isFull(p, w)), "the total is the points of every word, a full tour among them");
  const sky = skyOf(p);
  check(JSON.stringify(skyOf({ ...p })) === JSON.stringify(sky) && sky.stars.length === STARS && sky.stars.every(s => Math.abs(s.x) <= 1.2 && Math.abs(s.y) <= 1.2), "the layout is the same every time, inside the picture");
  const skies = SEEDS.map(seed => skyOf(deal({ seed, level: "medium" })));
  check(skies.every(k => k.links.length <= 14 && k.through === 0) && Math.max(...skies.map(k => k.crossings)) <= 10, `no more than 14 sight-lines, none through a star, ${Math.min(...skies.map(k => k.crossings))} to ${Math.max(...skies.map(k => k.crossings))} crossing`);
  check(sky.links.length === p.edges.split(" ").length && sky.links.every(([i, j]) => i !== j && canStep(p, p.letters[i], p.letters[j])), "every sight-line of the sky is a step the engine allows");
  check(canStep(p, p.letters[0], p.letters[0]) && !canStep(p, "q", "z"), "a star stays on itself (a doubled letter); an unlinked pair has no step");
}

// ---------- the same everywhere ----------
{
  const a = deal({ seed: 1234, level: "medium" }), b = deal({ seed: 1234, level: "medium" });
  check(JSON.stringify(a) === JSON.stringify(b), "a seed deals the same puzzle every time");
  check(deal({ seed: 1235, level: "medium" }).edges !== a.edges || deal({ seed: 1235, level: "medium" }).letters !== a.letters, "another seed, another sky");
  const days = Array.from({ length: 60 }, (_, i) => 20261108 + i + (i > 22 ? 70 : 0));
  const ds = days.map(d => daily(d));
  check(ds.every((p, i) => p.day === days[i] && JSON.stringify(p) === JSON.stringify(daily(days[i]))), "a daily is the same for everyone on its day");
  check(ds.every(p => { const s = statsOf(p); return s.words >= 58 && s.words <= 86 && s.tours >= 1; }), `every daily is a ${LEVELS[DAILY.level]} sky of 58 to 86 words with a full tour`);
  // Korbi's ending and long-word limits (8 Nov 2026) leave about fifty letter sets to choose from, so a sky may come round, rarely
  check(new Set(ds.map(p => `${p.letters}|${p.edges}`)).size >= ds.length * 0.95, "hardly a sky comes round twice in the first months");
}

// ---------- a word traced ----------
{
  const p = deal({ seed: 99, level: "medium" }), words = yieldOf(p), w = words.find(x => x.length === 5), none = new Set();
  check(judge(p, w, { have: none }).kind === "word" && judge(p, w, { have: none }).points === pointsOf(p, w), "a word the sky allows counts, for its points");
  check(judge(p, w, { have: new Set([w]) }).kind === "found", "a word found twice says so");
  check(judge(p, "the").kind === "short" && judge(p, "").kind === "short", "fewer than four letters is short");
  const off = "qqqq";
  check(judge(p, off).kind === "letters" && judge(p, "ab1d").kind === "letters", "a letter that is not a star is refused");
  // a real word the sky does not allow: a line is missing, and where
  const missing = all.find(x => [...x].every(c => p.letters.includes(c)) && !traces(p, x));
  const r = missing && judge(p, missing, { have: none });
  check(!missing || (r.kind === "line" && !canStep(p, missing[r.at - 1], missing[r.at])), "a word a sight-line short is refused at the step that fails");
  check(judge(p, "zzzz", { dict }).kind === "letters", "the letters are checked before the dictionary");
  check(!words.some(x => !isWord(x)) && words.every(x => !isVariant(x)), "every word is a word, the same on both sides of the Atlantic");
}

// ---------- the shadows and the hint ----------
{
  const p = deal({ seed: 4242, level: "medium" }), words = yieldOf(p);
  const none = shadowsOf(p, words, new Set()), every = shadowsOf(p, words, new Set(words));
  check(none.lines.size > 0 && none.max >= 1 && every.lines.size === 0 && every.max === 0, "the shadows light the lines the missing words use, and none once every word is found");
  const half = new Set(words.filter((_, i) => i % 2));
  const part = shadowsOf(p, words, half);
  check([...part.lines].every(([k, n]) => n <= (none.lines.get(k) || 0)) && part.max <= none.max, "finding words only dims the shadows");
  // a line's count is the words that step across it
  const [k, n] = [...none.lines][0], [i, j] = k.split("-").map(Number), a = p.letters[i], b = p.letters[j];
  check(n === words.filter(w => w.includes(a + b) || w.includes(b + a)).length, `a line's glow is how many words travel it (${k}: ${n})`);
  const easy = easiestLeft(words, new Set());
  check(words.includes(easy) && words.every(w => w === easy || zipfOf(w) - 0.2 * (w.length - 4) <= zipfOf(easy) - 0.2 * (easy.length - 4)), `the hint is about the easiest word left (${easy})`);
  check(easiestLeft(words, new Set(words)) === null && trailOf(p, easy).every((s, x) => p.letters[s] === easy[x]), "no hint when everything is found; a trail is the word's stars");
}

// ---------- ranks ----------
{
  check(RANKS.length === 10 && RANKS[0][0] === 0 && RANKS[TOP][0] === 1 && RANKS[MASTER][1] === "Nova" && RANKS[TOP][1] === "Galaxy", "ten ranks from the dark sky to the galaxy; Nova (70%) the one to aim for");
  const need = needed(300);
  check(need[0] === 0 && need[TOP] === 300 && need[MASTER] === 210 && need.every((v, i) => !i || v >= need[i - 1]), "the points each rank needs, Galaxy all of them");
  check(rankOf(0, 300) === 0 && rankOf(209, 300) === MASTER - 1 && rankOf(210, 300) === MASTER && rankOf(300, 300) === TOP, "the rank for a score");
}

// ---------- the computer player: it finds every word, so it always reaches the galaxy ----------
{
  let won = 0, total = 0;
  for (const level of Object.keys(LEVELS)) for (const seed of SEEDS.slice(0, 15)) {
    const p = deal({ seed: seed * 3 + 1, level }), have = new Set();
    for (const w of yieldOf(p)) if (judge(p, w, { have }).kind === "word") have.add(w);
    total++;
    if (rankOf(totalOf(p, [...have]), totalOf(p, yieldOf(p))) === TOP) won++;
  }
  check(won === total, `the bot reaches the galaxy in every level, random and daily (${won} of ${total})`);
  const dp = daily(20261201), dhave = new Set();
  for (const w of yieldOf(dp)) if (judge(dp, w, { have: dhave }).kind === "word") dhave.add(w);
  check(rankOf(totalOf(dp, [...dhave]), totalOf(dp, yieldOf(dp))) === TOP, "and the daily");
}

// ---------- lists, a run kept, a match through the database ----------
{
  const p = deal({ seed: 7, level: "light" }), words = yieldOf(p);
  check(GROUPS.length === 5 && words.every(w => groupOf(w) >= 0 && groupOf(w) < GROUPS.length) && groupOf("abcd") === 0 && groupOf("abcdefghij") === 4, "words fall into five length groups");
  const run = { kind: "run", p, found: words.slice(0, 5), typed: "ab", extra: ["xyzzy"], top: 2, over: false, shown: false, shadows: true, hints: 1, pin: { w: words[7], n: 3 } };
  const back = JSON.parse(JSON.stringify(run));
  check(JSON.stringify(back) === JSON.stringify(run) && yieldOf(back.p).length === words.length, "a run kept as JSON deals the same words");
  const rt = roundTrip({ v: 1, n: 1, runs: { s0: { begun: 5, score: 12, words: { [words[0]]: 1200, [words[1]]: 2500 } }, s1: { begun: 6, score: 9, words: { [words[1]]: 2600, [words[2]]: 3000 } } } });
  const alone = onlyMine(rt, 0);
  check(alone.has(words[0]) && !alone.has(words[1]) && onlyMine(rt, 1).has(words[2]), "a race stars the words nobody else found, through the round trip");
  check(onlyMine(null, 0).size === 0 && onlyMine({ runs: { s0: { begun: 1 } } }, 0).size === 0, "a run with no words yet is nothing found");
  const edges = roundTrip({ p: { letters: p.letters, edges: p.edges, level: p.level, seed: p.seed } }).p;
  check(edges.edges === p.edges && JSON.stringify(skyOf(edges)) === JSON.stringify(skyOf(p)), "a puzzle survives the database (its sky is strings), and its layout with it");
}

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall passed");
