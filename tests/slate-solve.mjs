// Slate's referee: Check and Suggest judge against every winning board, not our fill. Checks, on boards from every
// level with players' letters simulated (our fill, other winning boards, and plausible words placed one after
// another, the way people play): a clean board is called clean; Check's orange letters are enough (a winning
// board keeps everything else) and each is necessary under the ring order (no winning board keeps it along with
// every kept letter as near or nearer); Suggest's word lies on a winning board with every letter kept, and when
// it finds none, no winning board exists. Timing is reported.
import { generate, gridOf, rowsOf, isSolved, VALID } from "../slate-gen.js";
import { checkBoard, suggestWord, winning, ringsFrom } from "../slate-solve.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const BY_LEN = { 3: [], 4: [], 5: [] };
for (const w of VALID) BY_LEN[w.length]?.push(w);
const time = f => { const t = performance.now(); const v = f(); return [v, performance.now() - t]; };

/** A player's board: a few slots filled one after another with real words that fit what's already there. */
function playerLetters(board, r, slotsToFill) {
  const grid = gridOf(rowsOf(board)), letters = {};
  const order = grid.slots.map(s => s.id).sort(() => r() - 0.5).slice(0, slotsToFill);
  for (const id of order) {
    const s = grid.slots[id];
    const fits = BY_LEN[s.cells.length].filter(w => s.cells.every((k, i) => !letters[k] || letters[k] === w[i]));
    if (!fits.length) continue;
    const w = fits[Math.floor(r() * fits.length)];
    s.cells.forEach((k, i) => { letters[k] = w[i]; });
  }
  return letters;
}

let cleanOk = 0, cleanN = 0, altOk = 0, altN = 0, checks = 0, enough = 0, necessary = 0, unproven = 0, suggests = 0, suggestOk = 0, noneProven = 0;
const times = { check: [], suggest: [] };
for (const level of ["easy", "medium", "hard"]) {
  for (let n = 1; n <= 14; n++) {
    const seed = n * 104729 + level.length, board = generate(seed, level), grid = gridOf(rowsOf(board)), r = rng(seed);
    // our fill is clean
    cleanN++; if (checkBoard(board, { ...board.sol }, Object.keys(board.sol), 0).clean) cleanOk++;
    // another winning board is clean too: steer away from our fill by fixing one letter differently
    for (const k of Object.keys(board.sol).sort(() => r() - 0.5).slice(0, 6)) {
      const other = "ETAOINSRLDCUMPHBGY".split("").find(c => c !== board.sol[k] && winning(board, { [k]: c }, { ms: 400 }).fill);
      if (!other) continue;
      const alt = winning(board, { [k]: other }).fill;
      altN++; if (isSolved(board, alt) && checkBoard(board, alt, Object.keys(alt), 0).clean) altOk++;
      break;
    }
    // players' boards: plausible words, then Check and Suggest from a random slot
    for (let trial = 0; trial < 4; trial++) {
      const letters = playerLetters(board, r, 2 + Math.floor(r() * (grid.slots.length - 1)));
      if (!Object.keys(letters).length) continue;
      const anchor = Math.floor(r() * grid.slots.length);
      const [res, tc] = time(() => checkBoard(board, letters, Object.keys(letters), anchor));
      times.check.push(tc);
      if (res.out) {
        checks++;
        if (!res.proven) unproven++;
        const kept = Object.fromEntries(Object.entries(letters).filter(([k]) => !(k in res.out)));
        if (winning(board, kept).fill) enough++;
        const ring = ringsFrom({ slots: grid.slots.map(s => ({ id: s.id, cells: s.cells })) }, anchor);
        const allNeeded = Object.keys(res.out).every(k => {
          const near = Object.fromEntries(Object.entries(kept).filter(([c]) => ring[c] <= ring[k]));
          const w = winning(board, { ...near, [k]: letters[k] });
          return !w.fill && w.done;
        });
        if (allNeeded || !res.proven) necessary++;
      }
      const empty = grid.slots.filter(s => s.cells.some(k => !letters[k]));
      if (!empty.length) continue;
      const slot = empty[Math.floor(r() * empty.length)];
      const [sug, ts] = time(() => suggestWord(board, letters, slot.id));
      times.suggest.push(ts);
      suggests++;
      if (sug.word) {
        const withWord = { ...letters };
        slot.cells.forEach((k, i) => { withWord[k] = sug.word[i]; });
        if (slot.cells.every(k => !letters[k] || letters[k] === withWord[k]) && winning(board, withWord).fill) suggestOk++;
      } else if (sug.none) {
        const w = winning(board, letters);
        if (!w.fill) { suggestOk++; if (sug.proven) noneProven++; }
      }
    }
  }
}
// Suggest where a win is certainly still possible (our fill with some words taken out): it must find a word
let open = 0, found = 0;
for (const level of ["easy", "medium", "hard"]) for (let n = 1; n <= 10; n++) {
  const seed = n * 7907 + level.length, board = generate(seed, level), grid = gridOf(rowsOf(board)), r = rng(seed);
  const gone = new Set(grid.slots.filter(() => r() < 0.5).map(s => s.id));
  const letters = {};
  grid.slots.filter(s => !gone.has(s.id)).forEach(s => s.cells.forEach(k => { letters[k] = board.sol[k]; }));
  const empty = grid.slots.filter(s => s.cells.some(k => !letters[k]));
  if (!empty.length) continue;
  const slot = empty[Math.floor(r() * empty.length)];
  open++;
  const [sug, ts] = time(() => suggestWord(board, letters, slot.id));
  times.suggest.push(ts);
  const withWord = { ...letters };
  if (sug.word) slot.cells.forEach((k, i) => { withWord[k] = sug.word[i]; });
  if (sug.word && winning(board, withWord).fill) found++;
}
check(open > 15 && found === open, `Suggest finds a winning word whenever one exists, ${found}/${open}`);
const pct = xs => { const s = xs.slice().sort((a, b) => a - b); return `median ${s[Math.floor(s.length / 2)].toFixed(0)} ms, 95th ${s[Math.floor(s.length * 0.95)].toFixed(0)} ms, max ${s[s.length - 1].toFixed(0)} ms`; };
check(cleanOk === cleanN, `our fill is clean on ${cleanOk}/${cleanN} boards`);
check(altN > 20 && altOk === altN, `another winning board (not our fill) is clean on ${altOk}/${altN}`);
check(checks > 20 && enough === checks, `orange letters are enough: a winning board keeps the rest, ${enough}/${checks}`);
check(necessary === checks, `each orange letter is needed under the ring order, ${necessary}/${checks} (${unproven} unproven in time)`);
check(suggests > 20 && suggestOk === suggests, `Suggest's word lies on a winning board, or none exists, ${suggestOk}/${suggests} (${noneProven} proven none)`);
console.log(`Check: ${pct(times.check)}; Suggest: ${pct(times.suggest)}`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
