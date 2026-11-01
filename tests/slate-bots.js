// Slate's players for the tests (tests/slate-lives-bots.mjs): a guesser that lays any real words that fit and a
// planner that works out the rules. Both play a board through the engine's own log, so lives are counted as in the game.
import { gridOf, rowsOf, fieldsOf, VALID, BASE_RULES, ruleById, replay, lettersFrom, isSolved, failingMarks, livesOf } from "../slate-gen.js";
import { winning } from "../slate-solve.js";

const BY_LEN = {};
for (const w of VALID) (BY_LEN[w.length] ||= []).push(w);
const memo = new Map();
const possible = pattern => {                                  // some real word fits a pattern like "A.E.."
  if (!memo.has(pattern)) { const re = new RegExp(`^${pattern}$`); memo.set(pattern, (BY_LEN[pattern.length] || []).some(w => re.test(w))); }
  return memo.get(pattern);
};
/** Cells to clear when stuck: those of failing marks, else every letter (the Clear button's second and third presses). */
function stuckCells(board, fs, letters) {
  const bad = new Set();
  for (const m of failingMarks(board, fs, letters)) fs[+m.split(":")[0]].cells.forEach(k => bad.add(k));
  return bad.size ? [...bad] : Object.keys(letters);
}

/**
 * Brute force: lays real words that fit what's there and keep every crossing word possible, the most filled slot
 * first, caring nothing for the rules. Returns { solved, lost } once solved or `cap` lives are gone.
 */
export function guess(board, rnd, { cap = 14, maxMoves = 80 } = {}) {
  const grid = gridOf(rowsOf(board)), fs = fieldsOf(board), log = [];
  for (let moves = 0; moves < maxMoves; moves++) {
    const letters = lettersFrom(board, log), lost = livesOf(board, log).lost;
    if (isSolved(board, letters)) return { solved: true, lost };
    if (lost >= cap) return { solved: false, lost };
    const todo = grid.slots.filter(s => !s.cells.every(k => letters[k]) || !VALID.has(s.cells.map(k => letters[k]).join("")))
      .sort((a, b) => b.cells.filter(k => letters[k]).length - a.cells.filter(k => letters[k]).length || rnd() - 0.5);
    let move = null;
    for (const s of todo) {
      const fit = (BY_LEN[s.cells.length] || []).filter(w => s.cells.every((k, i) => !letters[k] || letters[k] === w[i])).filter(w => {
        const after = { ...letters }; s.cells.forEach((k, i) => { after[k] = w[i]; });
        return grid.slots.filter(t => t !== s && t.cells.some(k => s.cells.includes(k))).every(t => possible(t.cells.map(k => after[k] || ".").join("")));
      });
      if (fit.length) { move = { slot: s.id, word: fit[Math.floor(rnd() * fit.length)] }; break; }
    }
    if (move) log.push(move);
    else if (Object.keys(letters).length) log.push({ clear: stuckCells(board, fs, letters) });
    else return { solved: false, lost };
  }
  return { solved: false, lost: livesOf(board, log).lost };
}

const agrees = (rule, note) => {
  const test = s => (rule.type === "single" ? rule.test(s) : rule.type === "pair" ? rule.test(...s.split("→")) : rule.test([...s]));
  return [...note.ok].every(test) && ![...note.no].some(test);
};
/** A random deal of the rules to the fields that the notes allow, each rule to one field; null if it dead-ends. */
function sampleDeal(board, notes, rnd, rules) {
  const fs = fieldsOf(board);
  for (let tries = 0; tries < 40; tries++) {
    const used = new Set(), ids = [];
    let ok = true;
    for (const i of fs.map((f, n) => n).sort(() => rnd() - 0.5)) {
      const opts = rules.filter(r => r.type === fs[i].rule.type && !used.has(r.id) && agrees(r, notes[i]));
      if (!opts.length) { ok = false; break; }
      const r = opts[Math.floor(rnd() * opts.length)];
      used.add(r.id); ids[i] = r.id;
    }
    if (ok) return ids;
  }
  return null;
}
const dealt = (board, ids) => ({ ...board, fields: board.fields.map((f, i) => ({ ...f, rule: ids[i] })) });
const KEYWORDS = ["PLANET", "STORM", "BRIGHT", "FOLDER", "CANDLE", "MOUSE", "THING", "PRISM", "WALTZ", "GLOBE", "CHAIR", "FROSTY", "MARBLE", "SPRING", "TOWEL", "DRAFT", "QUILT", "HONEY", "BLAZE", "CORNET"];

/**
 * Deduction: guess which rule each field has from the rules in play (the whole catalogue with `legend: false`) and what
 * the fields have said, ask the solver for a winning fill under each guess that keeps the letters, and lay the word
 * that passes under most guesses.
 */
export function plan(board, rnd, { legend = true, cap = 14, maxMoves = 60, samples = 24, fills = 3, ms = 400 } = {}) {
  const grid = gridOf(rowsOf(board)), fs = fieldsOf(board), log = [];
  const rules = (legend ? board.legend : [...BASE_RULES.map(r => r.id), ...KEYWORDS.map(w => `kw:${w}`)]).map(ruleById);
  for (let moves = 0; moves < maxMoves; moves++) {
    const { notes } = replay(board, log), letters = lettersFrom(board, log), lost = livesOf(board, log).lost;
    if (isSolved(board, letters)) return { solved: true, lost };
    if (lost >= cap) return { solved: false, lost };
    const deals = Array.from({ length: samples }, () => sampleDeal(board, notes, rnd, rules)).filter(Boolean), found = [];
    for (const d of deals.slice(0, fills * 3)) {
      if (found.length >= fills) break;
      const r = winning(dealt(board, d), letters, { ms });
      if (r.fill) found.push(r.fill);
    }
    if (!found.length) {
      if (!Object.keys(letters).length) return { solved: false, lost };
      log.push({ clear: stuckCells(board, fs, letters) });
      continue;
    }
    const words = new Map();
    for (const fill of found) for (const s of grid.slots) if (!s.cells.every(k => letters[k] === fill[k])) words.set(`${s.id}:${s.cells.map(k => fill[k]).join("")}`, { slot: s, word: s.cells.map(k => fill[k]).join("") });
    const was = new Map();
    let best = null, top = -1;
    for (const c of words.values()) {
      const after = { ...letters }; c.slot.cells.forEach((k, i) => { after[k] = c.word[i]; });
      let pass = 0;
      for (const d of deals) {
        const hb = dealt(board, d), before = was.get(d) ?? was.set(d, failingMarks(hb, fieldsOf(hb), letters)).get(d);
        if (![...failingMarks(hb, fieldsOf(hb), after)].some(m => !before.has(m))) pass++;
      }
      const p = pass / deals.length + rnd() * 0.01;
      if (p > top) { top = p; best = c; }
    }
    log.push({ slot: best.slot.id, word: best.word });
  }
  return { solved: false, lost: livesOf(board, log).lost };
}
