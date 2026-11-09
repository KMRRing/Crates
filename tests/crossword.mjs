// Crossword (README, Crossword), the quick half (the generator's checks are in tests/crossword-grids.mjs): names as a grid
// takes them and the knowledge entries both ways round with the giveaways kept out; the solver that counts fills; the zoom; the play rules and what they charge; saved state through JSON; what a grid teaches; and the
// table split so the parts make the whole, played through the database's round trip, and the race.
// Run: node tests/crossword.mjs
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
check(fwd.length > 1000 && rev.length > 900, `entries both ways round (${fwd.length} forward, ${rev.length} reverse)`);
check(all.every(e => /^[A-Z]{3,13}$/.test(e.letters) && e.enumer.split(/[,-]/).reduce((n, x) => n + Number(x), 0) === e.letters.length),
  "every entry's letters are A to Z, three to thirteen, and its enumeration adds up to them");
check(new Set(all.map(e => e.key)).size === all.length, "every entry has a key of its own");
const nameOf = e => [K.BANK[e.a].name, K.BANK[e.a].aliases].flat();
check(fwd.every(e => !nameOf(e).some(n => K.says(`${e.lead} ${e.hint}`, n))), "no forward clue says its answer (Brazilian real, Swiss franc)");
check(rev.every(e => !nameOf(e).some(n => K.says(e.answer, n))), "no reverse answer has the country or commodity's name in it");
const troll = rev.find(e => e.answer === "Stockfish");
check(!!troll && troll.lead === "Norway" && troll.letters === "STOCKFISH", "a reverse clue is kept when its reason does not say its answer (Stockfish)");
const vikings = fwd.find(e => e.lead === "Hanseatic League" && e.answer === "Norway");
check(!!vikings && vikings.alts.includes("SWEDEN") && !vikings.alts.includes("DENMARK"), "a forward clue keeps its other answers of its length (Hanseatic League: Sweden, not Denmark)");
check(fwd.some(e => e.answer === "Britain") && fwd.some(e => e.answer === "USA") && !fwd.some(e => e.letters === "UK"), "the UK goes in as Britain, the United States as USA");

// ---------- three grids for what follows (the generator's own checks are in tests/crossword-grids.mjs) ----------
const ok = [["easy", 101], ["medium", 138], ["medium", 175]].map(([level, seed]) => ({ level, seed, p: E.makePuzzle({ seed, level }) }));

// ---------- the solvers ----------
// two words the clue allows that both fit the crossings: two fills; the crossing letter that tells them apart: one
const tiny = { rows: ["CAT", "A#O", "BOW"], entries: [
  { kind: "word", len: 3, cells: [0, 1, 2], letters: "CAT", text: "x" }, { kind: "word", len: 3, cells: [6, 7, 8], letters: "BOW", text: "y" },
  { kind: "word", len: 3, cells: [0, 3, 6], letters: "CAB", text: "z" }, { kind: "word", len: 3, cells: [2, 5, 8], letters: "TOW", text: "w" }] };
check(S.countSolutions(tiny, [["CAT"], ["BOW"], ["CAB"], ["TOW"]]) === 1, "a grid whose clues each allow one word has one fill");
check(S.countSolutions(tiny, [["CAT", "BAT"], ["BOW"], ["CAB"], ["TOW"]]) === 1, "a second word the crossings rule out (BAT: its B isn't CAB's C) changes nothing");
check(S.countSolutions(tiny, [["CAT", "CUT"], ["BOW"], ["CAB"], ["TOW"]]) === 2, "two words that differ only where nothing crosses make two fills (CAT and CUT)");
// ---------- the zoom (crossword-zoom.js) ----------
{
  const C = 13, R = 13, fit = 26, win = { w: Z.span(C, fit), h: Z.span(R, fit) };
  check(win.w === 352 && Z.span(C, 40) === 534, "a board's span is its squares and a rule round each (13 of 26 px: 352 px)");
  const whole = Z.clamp({ cell: fit, x: 37, y: -12 }, win, C, R);
  check(whole.x === 0 && whole.y === 0, "the whole grid fills its window exactly and can't be moved");
  const far = Z.clamp({ cell: 40, x: 50, y: -9999 }, win, C, R);
  check(far.x === 0 && far.y === win.h - Z.span(R, 40), "a zoomed grid always covers its window: dragged past an edge, it stops there");
  // a pinch: the point of the board under the fingers' middle stays under it, and follows it as it moves
  const v0 = { cell: fit, x: 0, y: 0 }, mid = { x: 200, y: 120 }, boardAt = (v, p) => [(p.x - v.x - 1) / (v.cell + 1), (p.y - v.y - 1) / (v.cell + 1)];
  const v1 = Z.zoomTo(v0, 52, mid, mid, win, C, R), moved = { x: 150, y: 160 }, v2 = Z.zoomTo(v0, 52, mid, moved, win, C, R);
  const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  check(near(boardAt(v1, mid), boardAt(v0, mid)) && near(boardAt(v2, moved), boardAt(v0, mid)), "a pinch zooms about the fingers: what's under them stays under them as they move");
  // a tap is the square under it, at any zoom and wherever the grid has been dragged
  const views = [v0, v1, Z.clamp({ cell: 40, x: -100, y: -77 }, win, C, R), Z.clamp({ cell: 60, x: -500, y: -300 }, win, C, R)];
  let right = 0, tried = 0;
  for (const v of views) for (let k = 0; k < C * R; k++) {
    const x = v.x + 1 + (k % C) * (v.cell + 1) + v.cell / 2, y = v.y + 1 + Math.floor(k / C) * (v.cell + 1) + v.cell / 2;
    if (x < 0 || y < 0 || x >= win.w || y >= win.h) continue;
    tried++;
    if (Z.squareAt(v, x, y, C, R) === k) right++;
  }
  check(tried > C * R && right === tried, `a tap is read as the square under it at any zoom (${right} of ${tried} squares' middles)`);
  const onRule = Z.squareAt(v1, v1.x + 1 + 52 + 0.5, v1.y + 1 + 26, C, R);
  check(onRule === 0 || onRule === 1, "a finger on the rule between two squares picks one of them");
  check(Z.squareAt(v0, -1, 5, C, R) === -1 && Z.squareAt(v0, 5, win.h, C, R) === -1, "off the board, no square");
  // following the cursor: a word in sight moves nothing; one out of sight comes in; one wider than the window, its start
  const vz = Z.clamp({ cell: 40, x: 0, y: 0 }, win, C, R), inSight = (r, v) => r.x0 + v.x >= 0 && r.x1 + v.x <= win.w && r.y0 + v.y >= 0 && r.y1 + v.y <= win.h;
  check(same(Z.show(vz, Z.rectOf([0, 1, 2], C, 40), win, C, R, 4), vz), "a word in sight: the view stays put");
  const corner = Z.rectOf([C * 12 + 10, C * 12 + 11, C * 12 + 12], C, 40), brought = Z.show(vz, corner, win, C, R, 4);
  check(!inSight(corner, vz) && inSight(corner, brought), "a word out of sight is brought into it");
  check(Z.show(Z.clamp({ cell: 40, x: -150, y: 0 }, win, C, R), Z.rectOf([...Array(C).keys()], C, 40), win, C, R, 4).x === 0, "a word wider than the window shows from its start");
}
{
  const f = Z.fingers(8);
  f.down(1, 100, 100, true);
  check(f.move(1, 103, 102) === null && same(f.up(1), { tap: { x: 100, y: 100 } }), "a finger that barely moves is a tap, read where it landed");
  f.down(2, 100, 100, true);
  const d1 = f.move(2, 120, 100), d2 = f.move(2, 130, 105);
  check(same(d1, { drag: [20, 0] }) && same(d2, { drag: [10, 5] }) && f.up(2) === null, "one that travels drags, each move by what it moved, and is no tap");
  f.down(3, 100, 100, true);
  const p0 = f.down(4, 200, 100), pm = f.move(4, 300, 100);
  check(p0?.pinch.d === 100 && p0.pinch.mid.x === 150 && pm?.pinch.d === 200 && pm.pinch.mid.x === 200, "two fingers pinch: how far apart they are, and their middle");
  check(f.up(4) === null && same(f.move(3, 90, 100), { drag: [-10, 0] }) && f.up(3) === null, "after a pinch the finger left drags on, and never taps");
  f.down(5, 50, 50, true); f.down(6, 60, 60); f.up(5);                  // finger 6's lift is lost
  f.down(7, 10, 10, true);
  check(f.count === 1 && same(f.up(7), { tap: { x: 10, y: 10 } }), "a new touch forgets a finger whose lift was lost, so nothing pinches against it");
  f.down(8, 10, 10, true);
  check(f.up(8, true) === null, "a cancelled touch is no tap");
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
const themed = E.makePuzzle({ seed: 900, level: "medium", mode: "theme" }), keyOnly = E.lessons(themed, E.freshPlay(themed));
check(!keyOnly.some(x => x.e.kind === "key") && keyOnly.every(x => x.helped), "a theme's keystone teaches nothing of its own; an empty grid's entries all go back");
const card = K.reviewCard(troll, S.seeded(4)), cardF = K.reviewCard(vikings, S.seeded(4));
check(card.name && card.answer === "Stockfish" && card.prompt.startsWith("Norway: ") && card.options.length === 4 && card.options[card.right[0]] === "Stockfish" && card.need === 1,
  "a reverse entry's review card: name the clue from its reason and its country (Deck's name-it), with four options");
check(cardF.answer === "Norway" && cardF.prompt.startsWith("Hanseatic League: ") && cardF.options.every(o => K.BANK.some(a => a.name === o && a.cat === "country")) && cardF.about.includes("norway"),
  "a forward entry's card names the country, its options other countries, and it carries what it's about");

// ---------- the table ----------
const people = n => Object.fromEntries(["a", "b", "c", "d", "e", "f"].slice(0, n).map((id, slot) => [id, { name: ["Korbi", "Sarah", "Tom", "Ana", "Bo", "Lin"][slot], slot, online: true }]));
const p2 = ok[2].p;
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
g = tx(g, x => T.newGameAt(x, { n: 1, puzzle: p1, mode: "race", now: 80000 }));
check(g.n === 2 && g.mode === "race" && !Object.keys(g.cells).length && !g.done, "a new game at the table, in the other mode");
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

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("crossword: every check passed");
