// The grid filler (gridfill.js; README, Codeword), which Codeword and Crossword fill their grids with: slots and clue
// numbers, what makes a grid bad, the two styles of grid (dense for a codeword, British for a blocked crossword),
// filling with distinct real words from a source, words placed first or put in given slots, letters already in, a
// cover (every letter used), and the same seed filling the same way every time.
import { BLACK, slotsOf, gridProblems, shape, halfCrossed, makeGrid, fillGrid, wordSource, seeded, mix, shuffled } from "../gridfill.js";
import { wordsOf, isWord, tierOf, isVariant } from "../wordlist.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const turned = g => g.map((row, r) => [...g[g.length - 1 - r]].reverse().join(""));     // the grid turned half round
const letters = rows => new Set(rows.join("").replace(/#/g, ""));

// ---------- slots, clue numbers and bad grids ----------
{
  const g = ["...#.", ".#.#.", ".....", ".#.#.", ".#..."];
  const s = slotsOf(g), across = s.filter(x => x.dir === "across"), down = s.filter(x => x.dir === "down");
  check(across.map(x => `${x.row},${x.col}:${x.len}`).join(" ") === "0,0:3 2,0:5 4,2:3" && down.map(x => `${x.row},${x.col}:${x.len}`).join(" ") === "0,0:5 0,2:5 0,4:5",
    "slots are the runs of two or more, across then down, each with its start and length (a lone cell between blacks is no slot)");
  check(s.find(x => x.dir === "across" && x.row === 2).cells.join() === "10,11,12,13,14", "a slot's cells are row × columns + column");
  check(across.map(x => x.num).join() === "1,4,5" && down.map(x => x.num).join() === "1,2,3",
    "clue numbers go row by row, one for each cell that starts a slot either way");
  check(!gridProblems(g).length, "a good grid has no problems");
  check(gridProblems(["..#..", ".....", "....."]).some(p => /run of two/.test(p)), "a run of two is refused (there are no two-letter words)");
  check(gridProblems(["...#.", "...#.", "....."]).length === 0 && gridProblems(["...##", "...#.", "...##"]).some(p => /in no word/.test(p)),
    "a white cell in no word is refused");
  check(gridProblems(["...#...", "...#...", "...#..."]).some(p => /joined/.test(p)), "white cells cut off from each other are refused");
  check(gridProblems(["...", ".."]).length === 1, "rows of different lengths are refused");
}

// ---------- making grids ----------
{
  const all = [];
  for (const style of ["dense", "british"]) for (const size of [11, 13, 15]) for (let seed = 1; seed <= 4; seed++) {
    const g = makeGrid({ size, style, seed });
    all.push({ style, size, seed, g });
  }
  check(all.every(x => x.g && x.g.length === x.size && x.g.every(r => r.length === x.size)), "every style and size makes a grid of that size");
  check(all.every(x => !gridProblems(x.g).length), "every grid made is a good one: no runs of two, no lone white cell, all joined up");
  check(all.every(x => turned(x.g).join() === x.g.join()), "every grid is the same turned half round, as printed crosswords are");
  check(all.every(x => makeGrid({ size: x.size, style: x.style, seed: x.seed }).join() === x.g.join()), "the same seed makes the same grid");
  check(new Set(all.filter(x => x.style === "dense" && x.size === 13).map(x => x.g.join())).size === 4, "different seeds make different grids");
  const dense = all.filter(x => x.style === "dense"), brit = all.filter(x => x.style === "british");
  const square = g => g.some((row, r) => r + 1 < g.length && [...row].some((ch, c) => ch === BLACK && row[c + 1] === BLACK && g[r + 1][c] === BLACK && g[r + 1][c + 1] === BLACK));
  const bar = (g, n) => g.some(row => row.includes(BLACK.repeat(n + 1))) || g[0].split("").some((_, c) => g.map(r => r[c]).join("").includes(BLACK.repeat(n + 1)));
  check(dense.every(x => !square(x.g) && !bar(x.g, 2)), "a dense grid has no square of four blacks and no three blacks in a row");
  check(dense.every(x => shape(x.g).crossed >= 0.7) && dense.every(x => { const b = shape(x.g).black; return b >= 0.21 && b <= 0.33; }),
    "a dense grid has most of its letters crossed (70% or more) and about a quarter of it black");
  check(dense.every(x => Math.max(...slotsOf(x.g).map(s => s.len)) <= (x.size <= 11 ? 8 : 9)), "a dense grid's longest word is 8 letters (9 from 13 across), so it fills from common words");
  check(brit.every(x => x.g.every((row, r) => [...row].every((ch, c) => !(r % 2 && c % 2) || ch === BLACK))), "a British grid grows from the lattice: black wherever row and column are both odd");
  check(brit.every(x => halfCrossed(slotsOf(x.g))), "every British slot has at least half its letters crossed");
  check(brit.every(x => !bar(x.g, 3)), "a British grid has no more than three blacks in a row");
  const want = [8, 6, 6, 5];
  const roomy = makeGrid({ size: 13, style: "british", seed: 3, lengths: want }), lens = slotsOf(roomy).map(s => s.len);
  check(want.every(n => lens.filter(x => x === n).length >= want.filter(x => x === n).length), "lengths asked for each get a slot of their own (8, 6, 6 and 5 here)");
  check(makeGrid({ size: 7, style: "dense", seed: 1, lengths: [15], tries: 20 }) === null, "a grid that can't hold what's asked is null");
}

// ---------- the word source ----------
{
  const src = wordSource({ upto: 2 });
  const five = src(5);
  check(five.length === 3 && five.every((band, t) => band.every(w => tierOf(w) === t)), "wordSource gives a length's words in bands by tier, the commonest first");
  check(five.flat().every(w => w.length === 5 && !isVariant(w)), "only words of that length, and none only one spelling has");
  const ex = wordSource({ upto: 1, extra: ["norway", "Kenya"], exclude: ["house"] });
  check(ex(6)[0].join() === "norway" && ex(5)[0].join() === "kenya" && !ex(5).flat().includes("house"), "extra words come first in a band of their own; excluded words don't come at all");
  check(wordSource({ upto: 2, variants: true })(6).flat().some(isVariant), "variants: true keeps both spellings");
}

// ---------- filling ----------
const src = wordSource({ upto: 2 });
{
  const fills = [];
  for (let seed = 1; fills.length < 6 && seed < 40; seed++) {
    const g = makeGrid({ size: 13, style: seed % 2 ? "dense" : "british", seed });
    const f = fillGrid(g, { words: src, seed, budget: 20000 });
    if (f) fills.push({ g, f, seed });
  }
  check(fills.length === 6, "dense and British grids fill from common words");
  check(fills.every(({ g, f }) => f.grid.every((row, r) => [...row].every((ch, c) => (g[r][c] === BLACK) === (ch === BLACK)))), "a fill keeps the grid's black cells and letters every white one");
  check(fills.every(({ f }) => f.slots.every(s => isWord(s.word, 2) && !isVariant(s.word))), "every slot holds a word from the source");
  check(fills.every(({ f }) => new Set(f.slots.map(s => s.word)).size === f.slots.length), "no word twice");
  check(fills.every(({ f }) => f.slots.every(s => s.word === s.cells.map(k => f.grid[(k / 13) | 0][k % 13]).join(""))), "each slot's word is what its cells read, so crossing words share their letter");
  check(fills.every(({ g, f, seed }) => fillGrid(g, { words: src, seed, budget: 20000 }).grid.join() === f.grid.join()), "the same grid, words and seed fill the same way");
  const { g, seed } = fills[0];
  check(fillGrid(g, { words: src, seed: seed + 1, budget: 20000 })?.grid.join() !== fills[0].f.grid.join(), "another seed fills it another way");

  // a plain list of words works as a source too
  const list = [...wordsOf(3, 0), ...wordsOf(4, 0), ...wordsOf(5, 0)];
  const small = fillGrid(["...#.", ".#.#.", ".....", ".#.#.", ".#..."], { words: list, seed: 3, budget: 20000 });
  check(small && small.slots.every(s => list.includes(s.word)), "a plain list of words is a source");

  // letters already in the grid, and words for given slots
  const pre = g.map((row, r) => (r === 0 ? row.replace(/\./, "e") : row));
  const at = pre[0].indexOf("e"), withE = fillGrid(pre, { words: src, seed: 9, budget: 20000 });
  check(withE && withE.grid[0][at] === "e", "a letter already in the grid stays");
  const slot = slotsOf(g).find(s => s.dir === "across" && s.len >= 5);
  const word = wordsOf(slot.len, 0).find(w => !/[jqxz]/.test(w));
  const fixed = fillGrid(g, { words: src, seed: 9, budget: 20000, fixed: [{ word, slot: { row: slot.row, col: slot.col, dir: "across" } }] });
  check(fixed && fixed.slots[slot.id].word === word, `a fixed word goes in the slot given (${word})`);
  let threw = false;
  try { fillGrid(g, { words: src, fixed: [{ word: "toolongforit", slot: slot.id }] }); } catch { threw = true; }
  check(threw, "a fixed word that doesn't fit its slot is an error, not a quiet failure");
  check(fillGrid(g, { words: src, seed: 1, budget: 10, starts: 1 }) === null, "a budget too small to finish gives null (a step per slot at the least)");
  let refused = false;
  try { fillGrid(["..#.."], { words: src }); } catch { refused = true; }
  check(refused, "a bad grid is refused");
}

// ---------- placing words first (Crossword's answers) ----------
{
  const sets = [["norway", "copper", "svalbard", "troll", "cocoa"], ["geneva", "naphtha", "tallinn", "ethanol"], ["chile", "lithium", "atacama", "nitrate", "andes"]];
  let tried = 0, done = 0, right = true;
  for (let seed = 1; seed <= 9; seed++) {
    const place = sets[seed % 3];
    const g = makeGrid({ size: 13, style: "british", seed, lengths: place.map(w => w.length) });
    if (!g) continue;
    tried++;
    const f = fillGrid(g, { words: src, seed, place, budget: 20000 });
    if (!f) continue;
    done++;
    const slots = slotsOf(g);
    right &&= f.placed.length === place.length && place.every(w => f.placed.some(p => p.word === w && f.slots[p.slot].word === w))
      && new Set(f.placed.map(p => p.slot)).size === place.length && f.slots.filter(s => !place.includes(s.word)).every(s => isWord(s.word, 2))
      && f.placed.every(p => slots[p.slot].len === p.word.length);
  }
  check(tried >= 8 && done >= Math.ceil(tried * 0.7), `answers placed first fill most British 13×13 grids made with room for them (${done} of ${tried})`);
  check(right, "each answer is in a slot of its own, where the fill says, and every other slot holds a word from the source");
}

// ---------- every letter (Codeword's cover) ----------
{
  const ALPHA = "abcdefghijklmnopqrstuvwxyz";
  let tried = 0, done = 0, all = true;
  for (let seed = 1; seed <= 12; seed++) {
    const g = makeGrid({ size: 13, style: "dense", seed });
    tried++;
    const f = fillGrid(g, { words: src, seed, budget: 20000, cover: ALPHA });
    if (!f) continue;
    done++;
    all &&= letters(f.grid).size === 26 && f.slots.every(s => isWord(s.word, 2)) && new Set(f.slots.map(s => s.word)).size === f.slots.length;
  }
  check(done >= tried / 2, `a dense 13×13 grid fills with all 26 letters more often than not (${done} of ${tried})`);
  check(all, "a covered fill has every letter, real words and no word twice");
  const plain = fillGrid(makeGrid({ size: 13, style: "dense", seed: 2 }), { words: src, seed: 2, budget: 20000 });
  check(plain && letters(plain.grid).size < 26, "without a cover, common words leave some letters out (which is why Codeword asks for one)");
}

// ---------- the seeded helpers ----------
{
  const a = seeded(42), b = seeded(42), xs = [a(), a(), a()], ys = [b(), b(), b()];
  check(xs.join() === ys.join() && xs.every(x => x >= 0 && x < 1), "seeded gives the same numbers in [0, 1) for the same seed");
  check(mix(1, 2) !== mix(2, 1) && mix(1, 2) === mix(1, 2), "mix makes a new seed from two, in order");
  const s = shuffled([1, 2, 3, 4, 5, 6], seeded(7));
  check(s.length === 6 && [...s].sort().join() === "1,2,3,4,5,6" && shuffled([1, 2, 3, 4, 5, 6], seeded(7)).join() === s.join(), "shuffled keeps every item and is the same for the same seed");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("gridfill: slots and clue numbers, bad grids refused, dense and British grids, fills of distinct common words, fixed and placed words, every letter, the same seed the same fill");
