// Slate's keyboard colours (keyVerdicts in slate-gen.js): with the cursor in a field, a letter is green where it's
// known to pass there and red where it's known to fail, from what the field has told you or its rule once revealed.
// A whole field colours once every other cell has a letter, matching a set of letters tried in any order and with
// its repeats, at every size a whole field comes in (three to five cells), with the cursor on any cell; a cell left
// empty colours nothing. Every whole rule in the catalogue is held to judging letters, never their order, which that
// matching relies on. Pair and single fields colour as they did before whole fields joined them. And through the
// board's own notes (notesFrom): a whole field placed failing, then passing, colours the keys; a frame colours nothing.
// And a whole field's cage (slate-cage.js) is one outline round its cells at any cell size, fractions included.
// Run: node tests/slate.mjs
import { BASE_RULES, ruleById, keyVerdicts, notesFrom, fieldsOf, rng32, VALID } from "../slate-gen.js";
import { cagePath } from "../slate-cage.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const ALPHABET = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const VOWELS = "AEIOU", CONSONANTS = ALPHABET.filter(c => !VOWELS.includes(c)).join("");
/** The keyboard as a verdict colours it: its green letters and its red ones; null when nothing is coloured at all. */
const keys = verdict => verdict && { green: ALPHABET.filter(c => verdict(c) === true).join(""), red: ALPHABET.filter(c => verdict(c) === false).join("") };
const said = k => JSON.stringify(k);
const is = (k, green, red) => k?.green === green && k?.red === red;
const note = (ok = [], no = []) => ({ ok: new Set(ok), no: new Set(no) });
const row = n => Array.from({ length: n }, (_, c) => `0,${c}`);
/** Letters by cell: the field's cells other than the cursor's, filled in order with these letters. */
const around = (field, at, letters) => Object.fromEntries(field.cells.filter(k => k !== at).map((k, n) => [k, letters[n]]).filter(([, c]) => c));
const perms = xs => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p])));

// ---------- whole fields ----------
// No vowels, three cells: SKI failed, SKY passed (named in reading order, as notesFrom names them).
const three = { rule: ruleById("noVowels"), cells: row(3) }, skiSky = note(["SKY"], ["SKI"]);
for (const at of three.cells) {
  for (const others of [["S", "K"], ["K", "S"]]) {
    const k = keys(keyVerdicts(three, skiSky, around(three, at, others), at));
    check(is(k, "Y", "I"), `whole, cursor on ${at}, ${others.join("")} in the other cells: Y green, I red (${said(k)})`);
  }
}
check(is(keys(keyVerdicts(three, skiSky, { ...around(three, "0,2", ["S", "K"]), "0,2": "Q" }, "0,2")), "Y", "I"),
  "whole: the letter already in the cursor's cell doesn't count, the keys say what each letter would do there");
check(keyVerdicts(three, skiSky, { "0,0": "S" }, "0,2") === null && keyVerdicts(three, skiSky, { "0,1": "K" }, "0,2") === null
  && keyVerdicts(three, skiSky, {}, "0,2") === null, "whole: with another cell empty nothing is coloured");
check(is(keys(keyVerdicts(three, skiSky, around(three, "0,2", ["S", "T"]), "0,2")), "", ""),
  "whole: other cells filled with letters never tried together colour nothing");

// repeats count: AAB failing says nothing about ABB
const noDup = { rule: ruleById("noDup"), cells: row(3) }, aab = note(["ABC"], ["AAB"]);
check(is(keys(keyVerdicts(noDup, aab, around(noDup, "0,2", ["A", "B"]), "0,2")), "C", "A"), "whole: with A and B in the other cells, A is red (AAB failed) and C green (ABC passed)");
check(is(keys(keyVerdicts(noDup, aab, around(noDup, "0,2", ["B", "B"]), "0,2")), "", ""), "whole: with B and B in the other cells, AAB says nothing about ABB");

// four and five cells: every other cell filled, in any arrangement
const four = { rule: ruleById("oneVowel"), cells: row(4) }, beak = note(["BECK"], ["BEAK"]);
for (const at of four.cells) {
  const all = perms(["B", "E", "K"]).every(others => is(keys(keyVerdicts(four, beak, around(four, at, others), at)), "C", "A"));
  check(all, `whole of four, cursor on ${at}: B, E and K in the other cells in every order, C green and A red`);
  check(keyVerdicts(four, beak, around(four, at, ["B", "E"]), at) === null, `whole of four, cursor on ${at}: one other cell empty, nothing coloured`);
}
const five = { rule: ruleById("evenSum"), cells: [..."01234"].map(c => `${c},0`) }, sums = note(["ABCDF"], ["ABCDE"]);   // a column
check(perms(["D", "A", "C", "B"]).every(others => is(keys(keyVerdicts(five, sums, around(five, "2,0", others), "2,0")), "F", "E")),
  "whole of five down a column: A, B, C and D in the other cells in every order, F green and E red");
check(keyVerdicts(five, sums, around(five, "2,0", ["D", "A", "C"]), "2,0") === null, "whole of five: one other cell empty, nothing coloured");

// the rule revealed: every letter, still only once every other cell has a letter
check(is(keys(keyVerdicts(three, note(), around(three, "0,1", ["S", "K"]), "0,1", true)), CONSONANTS, VOWELS), "whole, rule revealed (no vowels): consonants green, vowels red");
check(is(keys(keyVerdicts(four, note(), around(four, "0,3", ["B", "E", "K"]), "0,3", true)), CONSONANTS, VOWELS), "whole, rule revealed (one vowel, E already in): consonants green, vowels red");
check(keyVerdicts(three, note(), { "0,0": "S" }, "0,1", true) === null, "whole, rule revealed: with another cell empty nothing is coloured");

// ---------- every whole rule judges letters, never their order ----------
// Matching a whole field tried in any order is only right while that holds: a rule that read order would need its
// fields matched as placed. Random letters, and real words (whose rearrangements the anagram rule passes).
const r = rng32(7), words = [...VALID].filter(w => w.length >= 3 && w.length <= 5);
const sample = n => (n % 2 ? [...words[Math.floor(r() * words.length)]] : Array.from({ length: 3 + (n % 3) }, () => ALPHABET[Math.floor(r() * 26)]));
for (const rule of BASE_RULES.filter(x => x.type === "whole")) {
  let orderFree = true;
  for (let n = 0; n < 400 && orderFree; n++) {
    const ls = sample(n), v = rule.test(ls);
    orderFree = perms(ls).every(p => rule.test(p) === v);
  }
  check(orderFree, `the whole rule "${rule.text}" gives the same verdict in every order`);
}

// ---------- pair fields, as before ----------
const asc = { rule: ruleById("asc"), cells: row(3) }, pairs = note(["A→B", "B→C"], ["B→A", "C→B", "D→C"]);
check(is(keys(keyVerdicts(asc, pairs, { "0,0": "A" }, "0,1")), "B", ""), "pair: the left neighbour lettered, its pairs read with the cursor's letter second");
check(is(keys(keyVerdicts(asc, pairs, { "0,1": "B" }, "0,0")), "A", "C"), "pair: the right neighbour lettered, the cursor's letter first");
check(is(keys(keyVerdicts(asc, pairs, { "0,0": "A", "0,2": "C" }, "0,1")), "B", "D"), "pair: two lettered neighbours, green known to pass with both, red known to fail with one");
check(is(keys(keyVerdicts(asc, pairs, { "0,0": "A", "0,2": "E" }, "0,1")), "", ""), "pair: known to pass with one neighbour but not known with the other, not green");
check(keyVerdicts(asc, pairs, { "0,2": "C" }, "0,0") === null, "pair: no lettered neighbour, nothing coloured");
const down = { rule: ruleById("asc"), cells: ["0,0", "1,0"] };
check(is(keys(keyVerdicts(down, pairs, { "0,0": "A" }, "1,0")), "B", ""), "pair down a column: read top to bottom");
check(is(keys(keyVerdicts(asc, note(), { "0,0": "M" }, "0,1", true)), "NOPQRSTUVWXYZ", "ABCDEFGHIJKLM"), "pair, rule revealed (each later than the one before): every letter");

// ---------- single fields, as before ----------
const vowel = { rule: ruleById("vowel"), cells: row(2) };
check(is(keys(keyVerdicts(vowel, note(["A", "E"], ["T"]), {}, "0,0")), "AE", "T"), "single: the letters taken green, rejected red");
check(is(keys(keyVerdicts(vowel, note(), {}, "0,1", true)), VOWELS, CONSONANTS), "single, rule revealed: every letter");

// ---------- through the board's own notes ----------
// A board one word wide whose three cells are one whole field, no vowels: SKI placed fails it, then SKY passes it.
const board = { rows: ["..."], sol: { "0,0": "S", "0,1": "K", "0,2": "Y" }, fields: [{ rule: "noVowels", cells: row(3) }] };
const [field] = fieldsOf(board), notes = notesFrom(board, [{ slot: 0, word: "SKI" }, { slot: 0, word: "SKY" }]);
check(notes[0].no.has("SKI") && notes[0].ok.has("SKY"), "notesFrom: SKI failed the field, SKY passed it");
check(is(keys(keyVerdicts(field, notes[0], { "0,0": "S", "0,1": "K" }, "0,2")), "Y", "I"), "from the notes: S and K in place, the last cell's keys Y green and I red");
check(is(keys(keyVerdicts(field, notes[0], { "0,0": "K", "0,2": "S" }, "0,1")), "Y", "I"), "from the notes: K and S typed the other way round, the middle cell's keys the same");
// a frame: the field's three cells lettered in a four-letter row whose last cell is empty, so no word is complete
const wider = { rows: ["...."], sol: { "0,0": "S", "0,1": "K", "0,2": "Y", "0,3": "S" }, fields: [{ rule: "noVowels", cells: row(3) }] };
const framed = notesFrom(wider, [{ draft: { "0,0": "S", "0,1": "K", "0,2": "I" } }]);
check(is(keys(keyVerdicts(fieldsOf(wider)[0], framed[0], { "0,0": "S", "0,1": "K" }, "0,2")), "", ""), "a frame (letters placed short of a word) isn't judged, so it colours nothing");

// ---------- a whole field's cage: one outline at any cell size ----------
// Traced in pixels, a cell size with a fraction could put a bridge's far edge and the next cell's near edge a last
// digit apart, and the outline split into loops there (a third of sizes for a row of three; seen on the larger
// iPhones and on iPads). It's traced on whole numbers now and placed in pixels after: one loop, from the field's
// outer cells' edges.
const FIELD_SHAPES = {
  "a row of three": ["2,2", "2,3", "2,4"],
  "a column of five": ["0,1", "1,1", "2,1", "3,1", "4,1"],
  "an L of four": ["0,0", "0,1", "1,0", "2,0"],
  "a square of four": ["1,1", "1,2", "2,1", "2,2"],
  "a T of five": ["0,0", "0,1", "0,2", "1,1", "2,1"],
  "a square and one": ["3,3", "3,4", "4,3", "4,4", "5,4"],
  "a zigzag of four": ["0,0", "0,1", "1,1", "1,2"],
};
/** The points a cage's path passes through: where each rounded corner starts and ends. */
const pointsOf = d => [...d.matchAll(/[ML]([^,]+),([^A]+)A[^ ]+ 0 0 [01] ([^,]+),([^LZ]+)/g)].flatMap(m => [[+m[1], +m[2]], [+m[3], +m[4]]]);
const near = (a, b) => Math.abs(a - b) < 1e-9;
for (const [name, cells] of Object.entries(FIELD_SHAPES)) {
  const rs = cells.map(k => +k.split(",")[0]), cs = cells.map(k => +k.split(",")[1]);
  let loops = true, placed = true;
  for (let size = 30; size <= 110; size += 0.37) {
    for (const gap of [6, 7.2, 8.76, 9.75]) {
      const d = cagePath(cells, size, gap, 9), pts = pointsOf(d), edge = n => n * (size + gap);
      loops &&= (d.match(/M/g) || []).length === 1;
      placed &&= near(Math.min(...pts.map(p => p[0])), edge(Math.min(...cs))) && near(Math.max(...pts.map(p => p[0])), edge(Math.max(...cs)) + size)
        && near(Math.min(...pts.map(p => p[1])), edge(Math.min(...rs))) && near(Math.max(...pts.map(p => p[1])), edge(Math.max(...rs)) + size);
    }
  }
  check(loops, `the cage of ${name} is one outline at every cell size from 30 to 110 px, gaps 6 to 9.75`);
  check(placed, `the cage of ${name} runs along its outer cells' edges`);
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
