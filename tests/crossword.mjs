// Crossword (README, Crossword): the knowledge entries both ways round and the giveaways kept out; the generator
// across many seeds (a valid British grid, every slot an entry, exactly one fill fitting the clues, no clue giving
// another answer away, the knowledge entries apart); the grading against generated samples (Easy above Medium above
// Hard); the solver that counts fills and the computer player; the play rules and what they charge; saved state
// through JSON; the table split so the parts make the whole and no seat has it alone, played through the database's
// round trip; the race; and the daily the same for everyone on a day. Run: node tests/crossword.mjs
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const K = await import("../crossword-kb.js");
const E = await import("../crossword-engine.js");
const S = await import("../crossword-solve.js");
const T = await import("../crossword-table.js");
const { gridProblems, slotsOf, halfCrossed } = await import("../gridfill.js");
const { cluesOf, cluedWords } = await import("../clues.js");
const { roundTrip } = await import("./rtdb.js");

let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } else console.log(`ok   ${what}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- names as a grid takes them ----------
const f = K.gridForm;
check(same(f("Oil fund"), { letters: "OILFUND", enumer: "3,4" }) && same(f("A-ha"), { letters: "AHA", enumer: "1-2" })
  && same(f("Bio-LNG"), { letters: "BIOLNG", enumer: "3-3" }) && same(f("Lloyd's"), { letters: "LLOYDS", enumer: "6" }),
  "a name's letters and enumeration (3,4; 1-2; 3-3; an apostrophe dropped)");
check(f("Ørsted")?.letters === "ORSTED" && f("Gdańsk")?.letters === "GDANSK" && f("Ox­ford")?.letters === "OXFORD",
  "letters a grid writes as others (Ø), accents dropped, a soft hyphen no break");
check(f("B40") === null && f("Tate & Lyle") === null && f("$4/lb") === null && f("Cu") === null && f("Plastic pyrolysis oil") === null,
  "no number, sign, two-letter or over-long name goes in a grid");
check(K.says("Brazilian real", "Brazil") && K.says("The Swiss franc", "Swiss") && !K.says("Most of us know it", "us")
  && K.says("The UAE's capital", "UAE") && !K.says("Quaestors", "UAE") && K.says("Natural gas from the North Sea", "natural gas"),
  "a clue says a name as a word or a word's start; two-letter names never, three-letter ones whole");

// ---------- the knowledge entries ----------
const all = K.kbEntries(), fwd = all.filter(e => e.dir === "fwd"), rev = all.filter(e => e.dir === "rev");
check(fwd.length > 3000 && rev.length > 3000, `entries both ways round (${fwd.length} forward, ${rev.length} reverse)`);
check(all.every(e => /^[A-Z]{3,13}$/.test(e.letters) && e.enumer.split(/[,-]/).reduce((n, x) => n + Number(x), 0) === e.letters.length),
  "every entry's letters are A to Z, three to thirteen, and its enumeration adds up to them");
check(new Set(all.map(e => e.key)).size === all.length, "every entry has a key of its own");
const nameOf = e => [K.BANK[e.a].name, K.BANK[e.a].aliases].flat();
check(fwd.every(e => !nameOf(e).some(n => K.says(`${e.lead} ${e.hint}`, n))), "no forward clue says its answer (Brazilian real, Swiss franc)");
check(rev.every(e => !nameOf(e).some(n => K.says(e.answer, n))), "no reverse answer has the country or commodity's name in it");
const brown = rev.find(e => e.answer === "Brown cheese"), troll = rev.find(e => e.answer === "Troll");
check(!brown && !!troll && troll.lead === "Norway" && troll.letters === "TROLL", "a reverse clue whose reason has its answer's word is left out (Brown cheese); Troll is in");
const vikings = fwd.find(e => e.lead === "Vikings" && e.answer === "Norway");
check(!!vikings && vikings.alts.includes("SWEDEN") && !vikings.alts.includes("DENMARK"), "a forward clue keeps its other answers of its length (Vikings: Sweden, not Denmark)");
check(fwd.some(e => e.answer === "Britain") && fwd.some(e => e.answer === "USA") && !fwd.some(e => e.letters === "UK"), "the UK goes in as Britain, the United States as USA");

// ---------- the generator ----------
const puzzles = [];
const t0 = Date.now();
for (const level of E.LEVEL_IDS) for (let i = 0; i < 6; i++) puzzles.push({ level, seed: 101 + i * 37, p: E.makePuzzle({ seed: 101 + i * 37, level }) });
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
check(ok.every(({ p, level }) => { const n = p.entries.filter(e => e.kind !== "word").length; return n >= Math.max(3, E.LEVELS[level].kb - 2) && n <= E.LEVELS[level].kb; }),
  "every puzzle has its level's knowledge entries, or one or two fewer");
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
const dueKey = fwd.find(e => e.answer === "Norway" && e.lead === "Troll").key;
const learned = [0, 1, 2, 3].map(i => E.makePuzzle({ seed: 300 + i, level: "medium", due: [dueKey] }));
check(learned.filter(p => p.entries.some(e => e.key === dueKey)).length >= 2, "learning mode deals what the review pile has due");

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

// ---------- the solvers ----------
// two words the clue allows that both fit the crossings: two fills; the crossing letter that tells them apart: one
const tiny = { rows: ["CAT", "A#O", "BOW"], entries: [
  { kind: "word", len: 3, cells: [0, 1, 2], letters: "CAT", text: "x" }, { kind: "word", len: 3, cells: [6, 7, 8], letters: "BOW", text: "y" },
  { kind: "word", len: 3, cells: [0, 3, 6], letters: "CAB", text: "z" }, { kind: "word", len: 3, cells: [2, 5, 8], letters: "TOW", text: "w" }] };
check(S.countSolutions(tiny, [["CAT"], ["BOW"], ["CAB"], ["TOW"]]) === 1, "a grid whose clues each allow one word has one fill");
check(S.countSolutions(tiny, [["CAT", "BAT"], ["BOW"], ["CAB"], ["TOW"]]) === 1, "a second word the crossings rule out (BAT: its B isn't CAB's C) changes nothing");
check(S.countSolutions(tiny, [["CAT", "CUT"], ["BOW"], ["CAB"], ["TOW"]]) === 2, "two words that differ only where nothing crosses make two fills (CAT and CUT)");
const p0 = ok[6].p, r1 = S.rivalRun(p0, "quick", 9), r2 = S.rivalRun(p0, "quick", 9);
check(same(r1, r2), "the computer player plays the same puzzle the same way for the same seed, on every phone");
check(r1.events.filter(e => e.n != null).length === p0.entries.length && r1.done > 0, "the computer player finishes, every entry in its record");
const pace = lv => [1, 2, 3, 4, 5, 6].map(s => { const r = S.rivalRun(p0, lv, s); return r.done + r.penalty; }).reduce((a, b) => a + b) / 6;
const [ps, pq, pk] = ["steady", "quick", "sharp"].map(pace);
check(ps > pq && pq > pk, `a sharper computer player is quicker (steady ${Math.round(ps)} s, quick ${Math.round(pq)} s, sharp ${Math.round(pk)} s)`);
check(pq > 90 && pq < 1500, "and paced like a person: minutes, not seconds or hours");
const mid = S.rivalAt(r1, r1.done / 2), end = S.rivalAt(r1, r1.done + 1);
check(mid.solved > 0 && mid.solved < p0.entries.length && end.done && end.solved === p0.entries.length, "how far it has got, at any moment");
// the computer as a partner on a split grid alone: it holds the Down clues
{
  const pp = ok[7].p, holds = pp.entries.map(e => e.dir === "down"), downs = holds.filter(Boolean).length;
  let letters = pp.rows.join("").replace(/[A-Z]/g, ".");
  const write = e => { letters = [...letters].map((ch, k) => (e.cells.includes(k) ? e.letters[e.cells.indexOf(k)] : ch)).join(""); };
  const right = () => pp.entries.filter((e, n) => holds[n] && e.cells.every((k, i) => letters[k] === e.letters[i])).length;
  const run = (lv, seed) => {
    letters = pp.rows.join("").replace(/[A-Z]/g, ".");
    const tried = new Map(), rnd = S.seeded(seed), moves = [];
    for (let m; (m = S.partnerMove(pp, letters, holds, lv, rnd, tried)); ) { moves.push(m); write(pp.entries[m.n]); }
    const alone = right();
    for (const e of pp.entries.filter(x => x.dir === "across")) write(e);   // your half in
    for (let m; (m = S.partnerMove(pp, letters, holds, lv, rnd, tried)); ) { moves.push(m); write(pp.entries[m.n]); }
    return { alone, after: right(), moves };
  };
  const q = run("quick", 3);
  check(q.moves.every(m => holds[m.n]) && q.moves.every(m => m.at > 0), "the partner answers only its own clues, each taking it a while");
  check(q.alone > 0 && q.alone < downs && q.after > q.alone, `it gets some of its clues alone (${q.alone} of ${downs}) and more once your crossings are in (${q.after})`);
  check(S.partnerMove(pp, pp.rows.join(""), holds, "quick", S.seeded(1), new Map()) === null, "with its half right it has nothing more to do");
  const avg = lv => [1, 2, 3, 4, 5, 6, 7, 8].reduce((s, seed) => s + run(lv, seed).alone, 0) / 8;
  check(avg("sharp") > avg("steady"), "a sharper partner knows more of its clues on its own");
}

// ---------- playing one ----------
const p1 = ok[0].p, play = E.freshPlay(p1), e0 = p1.entries[0];
check(!E.full(play) && E.lettersIn(play, e0) === ".".repeat(e0.len), "a fresh play is empty");
e0.cells.forEach((k, i) => E.put(play, p1, k, i === 0 ? "Q" : e0.letters[i]));
check(E.lettersIn(play, e0).slice(1) === e0.letters.slice(1) && !E.entryRight(play, e0), "letters go in");
check(E.check(play, p1, e0.cells) === (e0.letters[0] === "Q" ? 0 : 1) && play.wrong.length === (e0.letters[0] === "Q" ? 0 : 1), "a check marks the wrong letter and counts it");
check(E.check(play, p1, e0.cells) === 0 && play.checks <= 1, "checking it again counts nothing more");
E.put(play, p1, e0.cells[0], e0.letters[0]);
check(!play.wrong.length && E.entryRight(play, e0), "changing a letter takes its mark away");
const e1 = p1.entries[1];
check(E.reveal(play, p1, e1.cells.slice(0, 2)) === 2 && play.reveals === 2 && !E.put(play, p1, e1.cells[0], "Z"), "a revealed letter is counted and stays");
play.ms = 125400;
check(E.charged(play) === 125 + 2 * E.REVEAL_COST + play.checks * E.CHECK_COST && E.clock(125) === "2:05" && E.clock(3725) === "1:02:05", "the time charged: the clock, 30 s a letter revealed, 15 s a wrong letter found");
for (const e of p1.entries) e.cells.forEach((k, i) => E.put(play, p1, k, e.letters[i]));
check(E.full(play) && E.solvedBy(play, p1) && !E.wrongCells(play, p1).length, "filled in right, it's solved");
const back = JSON.parse(JSON.stringify({ puzzle: p1, play }));
check(same(back.play, play) && E.solvedBy(back.play, back.puzzle) && E.uniquelySolved(back.puzzle), "a puzzle and its play come back whole through JSON (what's saved)");

// ---------- what a grid teaches ----------
const p3 = ok.find(x => x.p.entries.filter(e => e.kind !== "word").length >= 3).p, play3 = E.freshPlay(p3);
for (const e of p3.entries) e.cells.forEach((k, i) => E.put(play3, p3, k, e.letters[i]));
const kb3 = p3.entries.filter(e => e.kind !== "word"), helpedOne = kb3[0];
play3.revealed.push(helpedOne.cells[0]);
const taught = E.lessons(p3, play3);
check(taught.length === kb3.length && taught.find(x => x.e === helpedOne).helped && taught.filter(x => x.e !== helpedOne).every(x => !x.helped),
  "a knowledge entry with a letter revealed goes back for review; the others, got unaided, move up");
check(E.lessons(p3, play3, e => e !== helpedOne).length === kb3.length - 1, "at a split table only your own clues teach you");
const themed = themes[0], keyOnly = E.lessons(themed, E.freshPlay(themed));
check(!keyOnly.some(x => x.e.kind === "key") && keyOnly.every(x => x.helped), "a theme's keystone teaches nothing of its own; an empty grid's entries all go back");
const card = K.reviewCard(troll, S.seeded(4)), cardF = K.reviewCard(vikings, S.seeded(4));
check(card.name && card.answer === "Troll" && card.prompt.startsWith("Norway: ") && card.options.length === 4 && card.options[card.right[0]] === "Troll" && card.need === 1,
  "a reverse entry's review card: name the clue from its reason and its country (Deck's name-it), with four options");
check(cardF.answer === "Norway" && cardF.prompt.startsWith("Vikings: ") && cardF.options.every(o => K.BANK.some(a => a.name === o && a.cat === "country")) && cardF.about.includes("norway"),
  "a forward entry's card names the country, its options other countries, and it carries what it's about");

// ---------- the table ----------
const people = n => Object.fromEntries(["a", "b", "c", "d", "e", "f"].slice(0, n).map((id, slot) => [id, { name: ["Korbi", "Sarah", "Tom", "Ana", "Bo", "Lin"][slot], slot, online: true }]));
const p2 = ok[8].p;
for (const n of [2, 3, 4, 6]) {
  const hold = T.holders(p2, n), parts = Array.from({ length: n }, (_, s) => hold.map(h => h === s));
  const whole = p2.entries.every((_, i) => parts.some(part => part[i]));
  const alone = parts.every(part => part.some(x => !x));
  const fair = parts.map(part => part.filter(Boolean).length), spread = Math.max(...fair) - Math.min(...fair);
  check(whole && alone && spread <= (n === 2 ? p2.entries.length : 1), `${n} at the table: the seats' clues make the whole, no seat has it alone${n > 2 ? ", dealt evenly" : ""}`);
}
check(T.holders(p2, 2).every((s, i) => s === (p2.entries[i].dir === "across" ? 0 : 1)), "a pair splits Across and Down");
const hold3 = T.holders(p2, 3), dealt = s => p2.entries.filter((_, i) => hold3[i] === s);
check([0, 1, 2].every(s => dealt(s).some(e => e.dir === "across") && dealt(s).some(e => e.dir === "down")), "three or more each get clues both ways");
/** A change as a transaction makes it: on the state the database gave back, then stored again. */
const tx = (g, fn) => { const cur = T.tidy(roundTrip(g)); const r = fn(cur); return r === false ? g : T.tidy(roundTrip(cur)); };
let g = T.tidy(roundTrip(T.freshTable(people(2), { puzzle: p2, mode: "split", now: 1000 })));
check(T.isTable(g) && E.uniquelySolved(g.puzzle) && same(g.puzzle.rows, p2.rows), "a table's puzzle comes back whole from the database");
const view0 = T.readable(g, 0, [0, 1]), view1 = T.readable(g, 1, [0, 1]);
check(view0.some(Boolean) && view1.some(Boolean) && view0.every((x, i) => x !== view1[i]), "each of a pair reads only their own half");
check(T.readable(g, 0, [0]).every(Boolean), "a seat nobody is in has its clues shown to the rest");
const across = g.puzzle.entries.filter(e => e.dir === "across"), down = g.puzzle.entries.filter(e => e.dir === "down");
const letters = es => Object.fromEntries(es.flatMap(e => e.cells.map((k, i) => [k, e.letters[i]])));
g = tx(g, x => T.writeAt(x, { n: 1, slot: 0, letters: letters(across), now: 5000 }));
check(!g.done && Object.values(g.cells).every(c => c.by === 0), "one seat's answers alone don't finish the grid, and keep its colour");
const wrongCell = down[0].cells.find(k => !across.some(e => e.cells.includes(k)));
g = tx(g, x => T.writeAt(x, { n: 1, slot: 1, letters: { [wrongCell]: down[0].letters[down[0].cells.indexOf(wrongCell)] === "Z" ? "Y" : "Z" }, now: 6000 }));
check(tx(g, x => T.checkAt(x, { n: 1, cells: down[0].cells }) > 0).checks === 1, "a check at the table finds the wrong letter and counts it for the team");
g = tx(g, x => T.checkAt(x, { n: 1, cells: down[0].cells }));
g = tx(g, x => T.revealAt(x, { n: 1, slot: 1, cells: [down[1].cells[0]], now: 7000 }));
g = tx(g, x => T.writeAt(x, { n: 1, slot: 1, letters: letters(down), now: 61000 }));
check(!!g.done && g.done.secs === 60 && g.done.total === 60 + g.reveals * E.REVEAL_COST + g.checks * E.CHECK_COST, "both halves in, the grid is done, the team's time charged its help");
check(T.writers(g)[down[0].cells.find(k => !across.some(e => e.cells.includes(k)))] === 1, "a letter keeps the colour of whoever wrote it");
check(tx(g, x => T.writeAt(x, { n: 1, slot: 0, letters: { [across[0].cells[0]]: "Q" }, now: 70000 })).cells[`c${across[0].cells[0]}`].ch === across[0].letters[0], "a finished grid takes no more letters");
const rec = T.resultOf(g, 0, [0, 1]);
check(rec && rec.coop && rec.lower && rec.score === g.done.total && rec.match === `${g.created}-1`, "the pair's record: a team result, their time");
const before = JSON.stringify(g);
check(JSON.stringify(tx(g, x => T.writeAt(x, { n: 2, slot: 0, letters: { [across[0].cells[0]]: "Q" }, now: 1 }))) === before, "a letter for a game the table has moved on from does nothing");
g = tx(g, x => T.newGameAt(x, { n: 1, puzzle: p1, mode: "race", now: 80000, rival: { level: "quick", seed: 3 } }));
check(g.n === 2 && g.mode === "race" && !Object.keys(g.cells).length && !g.done && g.rival?.level === "quick", "a new game at the table, in the other mode");
check(JSON.stringify(tx(g, x => T.newGameAt(x, { n: 1, puzzle: p2, mode: "split", now: 1 }))) === JSON.stringify(g), "a second new game dealt from the same screen deals nothing");
g = tx(g, x => T.reportAt(x, { n: 2, slot: 0, run: { begun: 80000, solved: 3, filled: 20 } }));
g = tx(g, x => T.reportAt(x, { n: 2, slot: 1, run: { begun: 81000, solved: 5, filled: 25 } }));
let st = T.standings(g);
check(st[0].slot === 1 && st.every(x => x.rank === null), "while racing, the standings go by how much each has solved");
check(!T.raceOver(g, [0, 1]), "the race isn't over while anyone here is still at it");
g = tx(g, x => T.reportAt(x, { n: 2, slot: 0, run: { solved: p1.entries.length, secs: 300, reveals: 1, checks: 0, done: true } }));
g = tx(g, x => T.reportAt(x, { n: 2, slot: 1, run: { solved: p1.entries.length, secs: 320, reveals: 0, checks: 0, done: true } }));
st = T.standings(g);
check(T.raceOver(g, [0, 1]) && st[0].slot === 1 && st[0].rank === 1 && st[1].rank === 2, "the race's lowest time wins, its help charged (300 s and a letter is 330 s; 320 s wins)");
check(tx(g, x => T.reportAt(x, { n: 2, slot: 1, run: { secs: 10 } })).runs.s1.secs === 320, "a finished run stands: a reload can't change it");
const r0 = T.resultOf(g, 0, [0, 1]), r1b = T.resultOf(g, 1, [0, 1]);
check(r0 && !r0.won && r1b.won && !r0.coop && r0.lower, "the pair's record: head to head, won by the sole fastest");
check(T.raceOver(g, [0]) && T.raceOver({ ...g, runs: { s0: g.runs.s0 } }, [0]), "nobody away holds the race up");
const withRival = T.standings(g, { name: "Quick", solved: p1.entries.length, done: true, total: 200 });
check(withRival[0].rival && withRival[0].rank === 1, "a computer player races in the standings too");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("crossword: every check passed");
