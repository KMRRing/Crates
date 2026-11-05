// Bridges' levels (bridges-levels.js, with the twists made by bridges-engine.js): the puzzles with viaducts made, the ladder of
// puzzles in chapters, the ladder's move on 3 November 2026 (reefs and fairways out) and how a player's stars and unfinished runs
// follow it, the stars, the miniature the menu draws, and that the plain puzzles Bridges made before the twists came are the
// puzzles their seeds name (today's, links). Every level's puzzle is looked at in tests/bridges-puzzles*.mjs; the rules of
// the twists, and the solver against a plain search of every way to build bridges, are in tests/bridges-search.mjs.
import { createHash } from "node:crypto";
import { LEVELS as DIFFICULTIES, TWISTS, layoutOf, count, answerOf, generate, flagsOf, twistOn } from "../bridges-engine.js";
import { CHAPTERS, LEVELS, COUNT, OLD_COUNT, NOW, LADDER_VERSION, migrate, chapterOf, seedOf, levelPuzzle, kindOf, parOf, starsFor, PAR_PER_ISLAND } from "../bridges-levels.js";
import { miniature } from "../bridges-mini.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- viaducts, made ----------
{
  // the generator: a viaduct really goes over a low bridge of the answer
  let ok = true, why = "";
  const fail = m => { if (ok) why = m; ok = false; };
  for (const twist of ["hills", "ranges+hills", "realms+hills", "hills+wide"]) for (const size of [7, 9]) for (let i = 0; i < 2; i++) {
    const level = ["easy", "medium", "hard"][i % 3], seed = 600 + i * 17 + size, p = generate(seed, size, level, twist), tag = `${twist} ${size} #${seed}`;
    if (!p || !p.hills || p.twist !== twistOn(twist)) { fail(`${tag}: twist strings missing`); continue; }
    const lay = layoutOf(size, p.grid, p.kinds || "", p.realms || "", p.hills, p.roads || "");
    if (count(lay, 2) !== 1 || answerOf(size, p.grid, p.kinds || "", p.realms || "", p.hills, p.roads || "") !== p.sol) fail(`${tag}: not one answer, or another answer`);
    const cells = l => { const a = lay.isl[lay.links[l].a], b = lay.isl[lay.links[l].b], out = []; for (let r = a.r, c = a.c; r !== b.r || c !== b.c; r += Math.sign(b.r - a.r), c += Math.sign(b.c - a.c)) if (r !== a.r || c !== a.c) out.push(r * size + c); return out; };
    const built = [...p.sol].map((m, l) => (m === "0" ? null : { l, high: lay.links[l].high, cells: cells(l) })).filter(Boolean);
    if (!built.some(x => x.high && built.some(y => !y.high && y.cells.some(k => x.cells.includes(k))))) fail(`${tag}: no viaduct over a low bridge`);
    if ([...p.hills].some((h, k) => h === "1" && p.grid[k] === ".")) fail(`${tag}: a hill that isn't an island`);
    if (JSON.stringify(generate(seed, size, level, twist)) !== JSON.stringify(p)) fail(`${tag}: not the same twice`);
  }
  check(ok, `puzzles with viaducts have one answer, a viaduct over a low bridge, hills only on islands, and are the same twice${why ? ` (${why})` : ""}`);
}

// ---------- the ladder ----------
{
  check(COUNT === LEVELS.length && COUNT === 109, `${COUNT} levels`);
  check(new Set(LEVELS.map(L => L.name)).size === COUNT && LEVELS.every(L => L.name && [7, 9, 11].includes(L.size) && DIFFICULTIES[L.level]), "each level has a name of its own, a size and a difficulty");
  check(LEVELS.every(L => twistOn(L.twist) === L.twist), "each level's twist is written the way the engine writes it");
  check(CHAPTERS[0].from === 0 && CHAPTERS.every((c, k) => c.name && c.about && (k === 0 || c.from > CHAPTERS[k - 1].from) && c.from < COUNT), "chapters begin at the first level and follow in order");
  check(LEVELS.every((_, i) => chapterOf(i) === CHAPTERS.map((c, k) => (i >= c.from ? k : -1)).filter(k => k >= 0).pop()), "a level's chapter is the last one begun by then");
  check(new Set(LEVELS.map((_, i) => seedOf(i))).size === COUNT, "each level has a seed of its own");
  // the first 50 levels are the ladder as it was on 3 November 2026: ids and order never change, new chapters go at the end
  const FIRST = ["First light", "Rough numbers", "Two flags", "Ledger and flag", "First arch", "Single file", "Broad way", "Harbour mouth", "Straight roads", "Narrow and broad", "Grand chart"];
  check(FIRST.map(n => LEVELS.findIndex(L => L.name === n)).join() === "0,6,11,16,19,24,29,34,39,44,49" && LEVELS.slice(0, 50).every(L => !L.shape), "the 50 levels of the ladder keep their numbers and are all on the square board");
  const first = name => LEVELS[CHAPTERS.find(c => c.name === name).from];
  check(first("Harbour charts").twist === "none" && first("Ranges").twist === "ranges" && first("Two realms").twist === "realms" && first("Viaducts").twist === "hills" && first("Narrow roads").twist === "narrow" && first("Wide roads").twist === "wide" && first("Straits").twist === "straits" && first("No loops").twist === "tree", "each chapter's first level brings its twist");
  const chap = name => { const c = CHAPTERS.findIndex(x => x.name === name); return LEVELS.slice(CHAPTERS[c].from, CHAPTERS[c + 1]?.from ?? COUNT); };
  check(chap("Harbour charts").every(L => L.twist === "none") && chap("The admiralty").every(L => L.twist === "ranges+realms"), "the first chapter is plain and the admiralty puts ranges and realms together");
  check(["Ranges", "Two realms", "Viaducts", "Narrow roads", "Wide roads", "Straits", "No loops"].every(name => chap(name).length >= 5 && chap(name).every(L => L.twist === first(name).twist)), "each chapter of a twist keeps to it, for five levels at least");
  check(chap("The grand charts").every(L => L.twist.includes("+")) && Object.keys(TWISTS).every(t => t === "none" || chap("The grand charts").some(L => flagsOf(L.twist)[t])), "the grand charts put the twists together, and every twist meets another there");
  check(Object.keys(TWISTS).every(t => t === "none" || LEVELS.some(L => flagsOf(L.twist)[t])), "every twist is on some level");
  const sizeOf = L => [7, 9, 11].indexOf(L.size), grows = c => c.every((L, k) => k === 0 || sizeOf(L) >= sizeOf(c[k - 1]));
  check(["Ranges", "Two realms", "Viaducts", "Narrow roads", "Wide roads", "Straits", "No loops", "The grand charts"].every(name => grows(chap(name))), "within a chapter the charts never get smaller");
  // the hexagon (5 November 2026): a chapter plain, then each twist one at a time ending on a mix, then the gauntlets
  const HEX = ["The hexagon", "Hex ranges", "Hex realms", "Hex viaducts", "Hex narrow roads", "Hex wide roads", "Hex straits", "Hex no loops"], TW = [null, "ranges", "realms", "hills", "narrow", "wide", "straits", "tree"];
  check(HEX.every(name => chap(name).length >= 5 && chap(name).every(L => L.shape === "hex")), "each hex chapter has five levels or more, all on the hex board");
  check(chap("The hexagon").every(L => L.twist === "none") && HEX.slice(1).every((name, k) => { const c = chap(name), t = TW[k + 1]; return c.slice(0, -1).every(L => L.twist === t) && flagsOf(c.at(-1).twist)[t] && (k === 0 || c.at(-1).twist.includes("+")); }), "plain hex first, then each twist alone on the hex board, and each chapter after the first ends on a block that mixes it with another twist (ranges, first on the hex board, has nothing before it to mix with)");
  const sz = L => [7, 9, 11].indexOf(L.size);
  check(HEX.every(name => chap(name).every((L, k, c) => k === 0 || sz(L) >= sz(c[k - 1]))), "within a hex chapter the charts never get smaller");
  check(Object.keys(TWISTS).every(t => t === "none" || LEVELS.some(L => L.shape === "hex" && flagsOf(L.twist)[t])), "every twist is on some hex level");
  const gs = chap("Gauntlet: the square charts"), gh = chap("Gauntlet: the hexagon");
  check(gs.length >= 8 && gs.every(L => !L.shape && L.twist.includes("+")) && gh.length >= 6 && gh.every(L => L.shape === "hex" && L.twist.includes("+")), "the gauntlets mix two twists or more, on the square board and on the hex one");
  check(Object.keys(TWISTS).every(t => t === "none" || (gs.some(L => flagsOf(L.twist)[t]) && gh.some(L => flagsOf(L.twist)[t]))), "every twist meets another in each gauntlet");
  check(new Set(gs.map(L => L.twist)).size === gs.length && new Set(gh.map(L => L.twist)).size === gh.length && gs.every(L => !LEVELS.slice(0, 50).some(o => o.twist === L.twist)), "no gauntlet repeats a mix the first fifty levels or another gauntlet level already has");
  check(LEVELS.every((L, i) => !L.shape || kindOf(i).shape === "hex") && !("shape" in kindOf(0)), "a hex level asks the generator for the hex board, a square one says nothing of it");
  check(!LEVELS.some(L => /reef|lane/.test(L.twist)) && !CHAPTERS.some(c => /reef|fairway/i.test(c.name)), "no level or chapter is built on reefs or fairways");
  const rungs = { 7: 0, 9: 1, 11: 2 };
  check(chap("Narrow roads").map(L => L.level).join() === "easy,easy,medium,medium,hard" && chap("Wide roads").map(L => rungs[L.size]).join() === "0,1,1,2,2", "a twist chapter climbs from a small easy chart to a big hard one");
}

// ---------- the ladder before 3 November 2026: stars and unfinished runs follow ----------
{
  const was = LEVELS.map(L => L.was).filter(w => w != null);
  check(new Set(was).size === was.length && was.every(w => Number.isInteger(w) && w >= 0 && w < OLD_COUNT) && OLD_COUNT === 39 && LADDER_VERSION === 2, "each level that was there before names the number it had, once");
  check(NOW.length === OLD_COUNT && NOW.every((n, old) => n === -1 || LEVELS[n].was === old) && NOW.filter(n => n >= 0).length === was.length, "every old number leads to the level that has it now, or to none");
  check(NOW.slice(0, 6).join() === "0,1,2,3,4,5" && NOW[6] === -1 && NOW[10] === -1 && NOW[11] === 6 && NOW[16] === 11, "the plain levels keep their numbers; the reef levels are gone; the later ones moved up");
  const old = { at: 12, stars: Array.from({ length: OLD_COUNT }, (_, i) => i % 4) };
  const runs = { 3: { lv: 3, marks: "01", ms: 5 }, 7: { lv: 7, marks: "11" }, 12: { lv: 12, marks: "21", ms: 9 }, 33: { lv: 33 } };
  const { camp, runs: moved } = migrate(old, runs);
  check(camp.v === LADDER_VERSION && camp.stars.length === COUNT && LEVELS.every((L, i) => camp.stars[i] === (L.was == null ? 0 : old.stars[L.was])), "stars follow their level to its new number; a new level has none");
  check(camp.at === NOW[12] && NOW[12] === 7, "the level a player was on is the same level");
  check(Object.keys(moved).join() === `3,${NOW[12]}` && moved[3].marks === "01" && moved[NOW[12]].lv === NOW[12] && moved[NOW[12]].marks === "21" && moved[NOW[12]].ms === 9, "an unfinished run goes to its level's new number (and says so), one of a level taken out is dropped");
  const through = { at: 8, stars: Array.from({ length: OLD_COUNT }, (_, i) => (i < 25 ? 3 : 0)) };      // everything up to the viaducts solved, the player standing on a reef level
  check(migrate(through, {}).camp.at === LEVELS.findIndex(L => L.was == null) && migrate({ ...through, at: 38 }, {}).camp.at === migrate(through, {}).camp.at, "a player on a level that is gone is put on the first level not yet solved");
  check(migrate({ at: 99, stars: [] }, {}).camp.at === 0, "…and a place off the old ladder is the first level, for a player who has solved none");
  check(migrate(camp, moved).camp === camp && migrate(camp, moved).runs === moved, "a ladder that has moved already is left as it is, the second time");
  const none = migrate(null), junk = migrate({ at: "x", stars: [9, -1, 2.5, "3"] }, null);
  check(none.camp.v === LADDER_VERSION && none.camp.at === 0 && none.camp.stars.length === COUNT && none.camp.stars.every(s => s === 0) && Object.keys(none.runs).length === 0, "no save at all is a fresh ladder");
  check(junk.camp.stars.slice(0, 3).join() === "3,0,0" && junk.camp.at === 0, "stars that are not whole numbers from 0 to 3 are made so, an unreadable place is the first level");
}

// ---------- the stars ----------
{
  const p = levelPuzzle(2, seedOf(2)), par = parOf(p);
  check(Number.isInteger(par) && par > 0, "the par is a whole number of seconds");
  check(starsFor(p, par) === 3 && starsFor(p, par + 1) === 2 && starsFor(p, 2 * par) === 2 && starsFor(p, 2 * par + 1) === 1 && starsFor(p, 0) === 3 && starsFor(p, 100000) === 1, "three stars within the par, two within twice it, one for solving it");
  const pars = [0, 5, 12, 23, 28, 33, 38, 43, 49, 50, 55, 60, 85].map(i => parOf(levelPuzzle(i, seedOf(i))));
  check(pars.every(x => x >= 15 && x <= 1200), `every par is between fifteen seconds and twenty minutes (${Math.min(...pars)} to ${Math.max(...pars)} s)`);
  check(parOf({ ...p, level: "hard" }) > parOf({ ...p, level: "easy" }) && parOf({ ...p, grid: p.grid.replace(/\./, "3") }) > par && PAR_PER_ISLAND > 0, "a harder puzzle, or one with more islands, has a longer par");
  check(kindOf(31).twist === "wide" && kindOf(31).size === LEVELS[31].size && kindOf(0).twist === "none", "a level asks the generator for its size, difficulty and twist");
}

// ---------- puzzles from before the twists ----------
{
  const GOLD = {
    "1/7/easy": "251561cf97",
    "20261101/7/easy": "41a7b1dc4f",
    "1/7/medium": "7a010260a5",
    "20261101/7/medium": "02604d4d90",
    "1/7/hard": "fc6b19f861",
    "20261101/7/hard": "98457f836a",
    "1/9/easy": "dc7a078a56",
    "20261101/9/easy": "0ed7308072",
    "1/9/medium": "f70fe08579",
    "20261101/9/medium": "f05e8717d7",
    "1/9/hard": "76859f760c",
    "20261101/9/hard": "0caf085b85",
    "1/11/easy": "e21cf600ab",
    "20261101/11/easy": "a57d95b92e",
    "1/11/medium": "65e541cefa",
    "20261101/11/medium": "81525bf70e",
    "1/11/hard": "42b0061589",
    "20261101/11/hard": "dcb398ea47"
  };
  const h = p => createHash("sha1").update(p.grid + "|" + p.sol + "|" + p.level).digest("hex").slice(0, 10);
  const wrong = Object.entries(GOLD).filter(([k, v]) => { const [seed, size, level] = k.split("/"); return h(generate(+seed, +size, level)) !== v; }).map(([k]) => k);
  check(!wrong.length, `puzzles made before the twists came are the same puzzles (${Object.keys(GOLD).length} seeds, sizes and levels)${wrong.length ? `: ${wrong.join(", ")}` : ""}`);
  const plain = generate(99, 9, "medium");
  check(!("twist" in plain) && !("kinds" in plain) && !("realms" in plain) && !("roads" in plain) && !("straits" in plain), "a plain puzzle carries nothing of the twists");
  check(JSON.stringify(generate(5, 9, "easy", "ranges+realms")) === JSON.stringify(generate(5, 9, "easy", "realms+ranges")), "twists named in either order are the same puzzle");
  // a link made when reefs and fairways were twists (t=reefs, t=lanes) opens a plain puzzle now, not an error
  check(JSON.stringify(generate(5, 9, "easy", "reefs")) === JSON.stringify(generate(5, 9, "easy")) && JSON.stringify(generate(5, 9, "easy", "lanes")) === JSON.stringify(generate(5, 9, "easy")), "a shared link to a puzzle with reefs or fairways opens a plain puzzle of its seed");
}

// ---------- the miniature ----------
{
  const hexy = miniature(9, "straits+hills", 5, "hex");
  check(hexy.startsWith("<svg") && hexy.includes("<polygon") && hexy.includes('class="sline"') && hexy === miniature(9, "straits+hills", 5, "hex") && hexy !== miniature(9, "straits+hills", 5), "a hex level's chart is a hexagon of its own, the same every time");
  const plain = miniature(7, "none", 5), all = miniature(11, "ranges+realms", 5);
  check(plain === miniature(7, "none", 5) && plain.startsWith("<svg") && plain.includes("<circle") && plain.includes("<line"), "a chart in miniature is the same for the same level, with islands and bridges");
  check(!plain.includes("r1") && all.includes("r1") && all.includes("range"), "a chart shows its twists: a second colour, rings for bounds");
  const hilly = miniature(9, "hills", 5), wide = miniature(9, "wide", 5), narrow = miniature(9, "narrow", 5), straits = miniature(9, "straits", 5), tree = miniature(11, "tree", 5);
  check(hilly.includes('class="hill"') && !plain.includes('class="hill"') && hilly === miniature(9, "hills", 5), "a chart shows hills as contour rings");
  check(wide.includes('class="bed"') && !wide.includes('class="post"') && !plain.includes('class="bed"') && wide.split('class="b"').length > plain.split('class="b"').length - 1, "a wide road is a bed with three lanes on it");
  check(narrow.includes('class="post"') && !narrow.includes('class="bed"') && !plain.includes('class="post"'), "a narrow road has a post each side");
  check(straits.includes('class="sline"') && straits.includes('class="sdot"') && !plain.includes('class="sline"'), "a strait is a dashed line with a dot at its end");
  check(tree.startsWith("<svg") && tree !== miniature(11, "none", 5) && !tree.includes('class="bed"') && miniature(9, "ranges+straits+tree", 5).includes('class="sline"'), "a chart with no loops draws no extra bridges, and the twists add up");
  check(!/reef|lane/.test(all + hilly + wide + tree) && miniature(7, "reefs", 5) === plain, "nothing of reefs or fairways is drawn, and a level with them (an old name) is drawn plain");
  check(miniature(7, "none", 5) !== miniature(7, "none", 6), "another level, another chart");
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges levels: viaduct puzzles, the ladder and its move, the stars, plain puzzles unchanged, the miniature");
process.exit(bad ? 1 : 0);
