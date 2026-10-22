// Crossword (README, Crossword), pure: how a puzzle is made, and the rules of playing one. A puzzle is a British
// blocked grid (gridfill.js makes the grid and fills it) with a few knowledge entries placed in it first
// (crossword-kb.js: a country or commodity named from one of its clues, or the clue named from its reason), the
// rest ordinary words with the clue bank's clues (clues.js); it's dealt only when exactly one fill fits its clues
// (crossword-solve.js counts them) and when typical solvers fare on it as its level says (crossword-solve.js grades
// it). Everything is seeded and counted in steps, never timed, so a seed makes the same puzzle on every phone.
import { makeGrid, slotsOf, fillGrid, mix, shuffled } from "./gridfill.js";
import { cluesOf, cluedWords } from "./clues.js";
import { kbEntries, saysWords, wordsOf, BANK } from "./crossword-kb.js";
import { seeded, allowed, countSolutions, grade, REVEAL_COST, CHECK_COST } from "./crossword-solve.js";

export { REVEAL_COST, CHECK_COST };
export const BLACK = "#", EMPTY = ".";

// ---------- levels, sizes and kinds ----------
/**
 * size: the level's own grid, unless one is chosen; more: knowledge entries it adds to its size's; rev: the share of
 * them named the other way round (the clue from its reason: recall, the harder way); kbD: how a link's difficulty is
 * weighted (easy, medium, hard links); hardClue: the share of ordinary words given their harder clue, and
 * hardClassic in a grid of ordinary words alone, where the harder clues are all there is to make it hard (measured:
 * so a Classic grid's figures sit in its level's bands as a mixed one's do); finish and share: what a deal is held
 * to, as typical solvers fare on it (crossword-solve.js: grade), the share of them who finish it unaided and how much
 * of it the average one fills.
 */
export const LEVELS = {
  easy: { name: "Easy", size: 11, more: 0, rev: 0.1, kbD: [3, 1, 0.1], hardClue: 0, hardClassic: 0, finish: [0.25, 1], share: [0.93, 1] },
  medium: { name: "Medium", size: 13, more: 0, rev: 0.25, kbD: [1.5, 1, 0.4], hardClue: 0.2, hardClassic: 0.35, finish: [0.04, 0.5], share: [0.88, 0.97] },
  hard: { name: "Hard", size: 13, more: 1, rev: 0.5, kbD: [0.3, 1, 2], hardClue: 0.6, hardClassic: 1, finish: [0, 0.15], share: [0.74, 0.9] },
};
export const LEVEL_IDS = Object.keys(LEVELS);
/**
 * The grids, by squares across. longest: the longest entry (the clue bank's long words are few, so a grid's long runs
 * are cut); cut: where gridfill cuts the runs itself, rather than its grids with longer ones being passed over (at 15
 * by 15 nearly half of them were, and a good grid took three times as long; 11 and 13 by 13 keep passing over, so
 * their grids, today's among them, are the ones they always were); kb: its knowledge entries when they're mixed with
 * ordinary words (Both); learn: when they're the point (Learning), about as many as its grids take, since they never
 * cross each other (measured: a median of 3, 5, 7 and 9 when asked for all they'd take); entries: about how many
 * entries its grids have, which the levels' share of solvers who finish is scaled by (below); budget: the fill's
 * search steps, if not 24,000 (a 9 by 9 fill that works takes a few hundred at most, and one that won't spent all
 * 24,000, two seconds here).
 */
export const SIZES = {
  9: { longest: 9, kb: 3, learn: 4, entries: 13, budget: 4000 },
  11: { longest: 9, kb: 5, learn: 7, entries: 20 },
  13: { longest: 11, kb: 6, learn: 9, entries: 28 },
  15: { longest: 12, cut: 12, kb: 8, learn: 11, entries: 35 },
};
export const SIZE_IDS = Object.keys(SIZES).map(Number);
/** What a grid's entries are: ordinary words alone (Classic), knowledge as much as it takes (Learning), or a mix. */
export const KINDS = { classic: "Classic", learning: "Learning", both: "Both" };
/** What the knowledge entries ask: both ways (the level's mix), or only one. */
export const ASKS = { both: "Both ways", fwd: "Name the answer", rev: "Name the clue" };
/** The twists: none, or a theme, its starred clues all one hidden answer's, the keystone naming it. ("classic" is the
 *  saved name for none, from before Classic meant a grid of ordinary words alone.) */
export const MODES = { classic: "None", theme: "Theme" };
export const POOLS = { mixed: "Mixed", country: "Countries", commodity: "Commodities" };

// ---------- the ordinary words ----------
// A deal draws on the clue bank to a tier (clues.js: 0 its commonest words, 2 all of them). Random grids take it all;
// today's takes the two commonest tiers alone, which are complete, so the bank growing through a day can't change the
// day's grid between one phone and the next.
export const WHOLE_BANK = 2, DAILY_BANK = 1;
const banks = new Map();
/** The clue bank to a tier, as a deal reads it, worked out once a length: its words (bands), letters at places (count),
 *  and the words it gives the same clue (sameClue). */
function bankTo(upto) {
  let b = banks.get(upto);
  if (b) return b;
  const bits = new Map(), clued = new Map();
  // what a knowledge entry's crossed letters ask of the words that cross it: for each length, a bitset of the words with
  // each letter at each place, so letters at several places are one AND per 32 words
  const bitsOf = len => {
    if (!bits.has(len)) {
      const words = cluedWords(len, upto), nw = (words.length + 31) >>> 5, at = new Uint32Array(len * 26 * nw);
      words.forEach((w, j) => { for (let i = 0; i < len; i++) at[(i * 26 + w.charCodeAt(i) - 97) * nw + (j >>> 5)] |= (1 << (j & 31)) >>> 0; });
      bits.set(len, { nw, at });
    }
    return bits.get(len);
  };
  b = {
    upto,
    /** A length's words, commonest first in two bands (gridfill tries the first band first). */
    bands: len => [cluedWords(len, 0), cluedWords(len, upto).slice(cluedWords(len, 0).length)].filter(x => x.length),
    /** How many words of a length fit letters at places ([[pos, ch]…], ch lower case). */
    count(len, fixed) {
      const { nw, at } = bitsOf(len);
      let n = 0;
      for (let x = 0; x < nw; x++) {
        let v = 0xFFFFFFFF;
        for (const [i, ch] of fixed) v &= at[(i * 26 + ch.charCodeAt(0) - 97) * nw + x];
        if (v) n += popcount(v >>> 0);
      }
      return n;
    },
    /** The words of a length the bank gives this clue to: an ordinary clue allows every one of them. */
    sameClue(len, text) {
      if (!clued.has(len)) {
        const m = new Map();
        for (const w of cluedWords(len, upto)) for (const c of cluesOf(w)) { const k = c.text.toLowerCase(); if (!m.has(k)) m.set(k, []); m.get(k).push(w.toUpperCase()); }
        clued.set(len, m);
      }
      return clued.get(len).get(text.toLowerCase()) || [];
    },
  };
  banks.set(upto, b);
  return b;
}
const popcount = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };

// ---------- the knowledge entries a deal draws from ----------
/**
 * The knowledge entries a deal may use, each with its weight: its topics' (0 out, 1 in, 2 more: the best of its
 * aspects, as Crates weighs a clue) times its difficulty's at the level, times more for one the review pile has due
 * (`due`, keys) or one about something another game found you weak on (`weak`, entity ids).
 */
function candidates(L, { pool = "mixed", asks = "both", topics = null, due = [], weak = null }) {
  const dueSet = new Set(due);
  return kbEntries().filter(e => (pool === "mixed" || e.cat === pool) && (asks === "both" || e.dir === asks) && e.letters.length <= L.longest)
    .map(e => {
      const topic = topics ? Math.max(0, ...e.topics.map(t => topics[t] ?? 1)) : 1;
      const learn = dueSet.has(e.key) ? 8 : weak && e.about.some(id => weak.has(id)) ? 3 : 1;
      return { e, w: topic * L.kbD[e.d - 1] * learn };
    }).filter(x => x.w > 0);
}
/** A clue's text as a solver reads it: the bold part and the reason. */
const textOf = e => `${e.lead || ""} ${e.hint || e.text || ""}`;
// an entry's words, worked out once (the giveaway checks compare every pair of entries a deal considers)
const cachedWords = new WeakMap();
function wordsFor(e) {
  let w = cachedWords.get(e);
  if (!w) { w = { text: wordsOf(textOf(e)), answer: wordsOf(e.answer) }; cachedWords.set(e, w); }
  return w;
}
/** Whether one entry's clue says another's answer. */
const gives = (x, y) => saysWords(wordsFor(x).text, wordsFor(y).answer);
/** Whether two entries can't share a grid: the same answer, or one's clue saying the other's answer. */
const clash = (x, y) => x.letters === y.letters || gives(x, y) || gives(y, x);

/**
 * Knowledge entries for a grid's slots: up to `count`, in slots that don't cross each other (two rare words sharing
 * a letter is what fills fail on), across and down in turn so both directions get some; each the likeliest by weight
 * among those whose crossed letters leave every crossing slot enough clued words to choose from. `first` goes in
 * before the rest (the theme's keystone), or nothing is placed; `early`, entries to place before the draws where they
 * fit (what the review pile has due); `rev`, how many should be named the other way round (null: as the weights
 * fall), kept to in a first pass over the slots and let go in a second if the grid is still short.
 */
function placeKnowledge(grid, slots, pool, count, rnd, { first = null, early = [], maxLen, rev = null, bank }) {
  const crossers = slots.map(s => s.cells.map(k => {
    const t = slots.find(x => x.id !== s.id && x.cells.includes(k));
    return t ? { t, j: t.cells.indexOf(k) } : null;
  }));
  const fixedIn = new Map();                                    // slot id → [[pos, ch]] the chosen entries put there
  const chosen = [];
  const roomy = (s, letters) => crossers[s.id].every((x, i) => !x || bank.count(x.t.len, [...(fixedIn.get(x.t.id) || []), [x.j, letters[i].toLowerCase()]]) >= 10);
  const take = (s, e) => {
    chosen.push({ slot: s, e });
    crossers[s.id].forEach((x, i) => { if (x) fixedIn.set(x.t.id, [...(fixedIn.get(x.t.id) || []), [x.j, e.letters[i].toLowerCase()]]); });
  };
  const free = s => !chosen.some(c => c.slot.id === s.id || crossers[c.slot.id].some(x => x && x.t.id === s.id));
  const order = shuffled(slots.filter(s => s.len >= 4 && s.len <= maxLen), rnd);
  const across = order.filter(s => s.dir === "across"), down = order.filter(s => s.dir === "down");
  const turns = [];
  for (let i = 0; i < Math.max(across.length, down.length); i++) { if (across[i]) turns.push(across[i]); if (down[i]) turns.push(down[i]); }
  if (first) {
    const s = turns.find(x => x.len === first.letters.length && free(x) && roomy(x, first.letters));
    if (!s) return null;
    take(s, first);
  }
  for (const e of early) {
    if (chosen.some(x => clash(x.e, e))) continue;
    const s = turns.find(x => x.len === e.letters.length && free(x) && roomy(x, e.letters));
    if (s) take(s, e);
  }
  const byLen = new Map();
  for (const c of pool) { const n = c.e.letters.length; if (!byLen.has(n)) byLen.set(n, []); byLen.get(n).push(c); }
  const want = count + (first ? 1 : 0);
  const named = dir => chosen.filter(c => c.e.dir === dir).length;
  for (const keepQuota of rev == null ? [false] : [true, false]) {
    for (const s of turns) {
      if (chosen.length >= want) break;
      if (!free(s)) continue;
      // drawn by weight, one at a time, the first that clashes with nothing chosen and leaves the crossings room
      const open = dir => !keepQuota || (dir === "rev" ? named("rev") < rev : named("fwd") < count - rev);
      const left = (byLen.get(s.len) || []).filter(c => open(c.e.dir));
      let total = left.reduce((a, c) => a + c.w, 0);
      for (let n = 0; n < 40 && left.length && total > 0; n++) {
        let t = rnd() * total, i = 0;
        while (i < left.length - 1 && (t -= left[i].w) >= 0) i++;
        const [c] = left.splice(i, 1);
        total -= c.w;
        if (!chosen.some(x => clash(x.e, c.e)) && roomy(s, c.e.letters)) { take(s, c.e); break; }
      }
    }
  }
  return chosen;
}

// ---------- making a puzzle ----------
/**
 * A grid for a level: one of gridfill's British grids with no entry longer than the level allows, few of three
 * letters and hardly a block of four black squares (a printed grid's blacks stand apart, in the lattice), with room
 * for entries of the lengths asked for (a theme's keystone, what the review pile has due).
 */
function gridFor(L, seed, lengths = []) {
  for (let t = 0; t < 40; t++) {
    const g = makeGrid({ size: L.size, style: "british", seed: mix(seed, t), tries: 40, lengths, maxLen: L.cut });
    if (!g) continue;
    const s = slotsOf(g);
    if (Math.max(...s.map(x => x.len)) > L.longest || s.filter(x => x.len === 3).length > s.length * 0.3 || blocks(g) > 2) continue;
    return g;
  }
  return null;
}
/** How many two-by-two blocks of black squares a grid has. */
function blocks(g) {
  let n = 0;
  for (let r = 0; r + 1 < g.length; r++) for (let c = 0; c + 1 < g[r].length; c++) if (g[r][c] === BLACK && g[r + 1][c] === BLACK && g[r][c + 1] === BLACK && g[r + 1][c + 1] === BLACK) n++;
  return n;
}
const ATTEMPTS = 40;
/** The knowledge entries a theme needs room for, its keystone and four starred clues: no 9 by 9 grid takes them, and
 *  Classic has none. */
const THEMED = 5;
/** Whether a grid of these options can have the theme twist ({ level, size, kind }, as makePuzzle takes them). */
export const themeFits = ({ level, size, kind = "both" }) => spec(level, size, kind).kb >= THEMED;
/**
 * What a deal is made to: the level's figures at a size (its own unless one is chosen) and of a kind, with the size's
 * longest entry, cut and fill budget, its knowledge entries (kb) and the fewest it may come with (least). Finishing a
 * grid unaided takes getting every entry, so the share who finish falls as a power of how many there are: a level's
 * finish band, set at its own size, is raised to the ratio of the entries (a 9 by 9 grid's Medium asks more of its
 * thirteen entries than a 13 by 13's of twenty-eight). How much of a grid the average solver fills doesn't depend on
 * its size, so the share band stands. A Learning grid is held to the share alone, set a little lower, as a theme is:
 * half again as many names to recall leave few solvers finishing unaided at any level.
 */
function spec(level, size, kind) {
  const lv = LEVELS[level] || LEVELS.medium, n = SIZES[size] ? Number(size) : lv.size, Z = SIZES[n];
  const kb = kind === "classic" ? 0 : kind === "learning" ? Z.learn : Z.kb + lv.more;
  const finish = kind === "learning" ? [0, 1] : n === lv.size ? lv.finish : lv.finish.map(x => x ** (Z.entries / SIZES[lv.size].entries));
  const share = kind === "learning" ? [lv.share[0] - 0.03, lv.share[1]] : lv.share;
  return { ...lv, size: n, longest: Z.longest, cut: Z.cut, budget: Z.budget || 24000, kb, least: kb && Math.max(Math.min(3, kb - 1), kb - 2),
    hardClue: kind === "classic" ? lv.hardClassic : lv.hardClue, finish, share };
}
/**
 * A puzzle, or null when none came within the attempts: { v, seed, level, kind, mode, pool, rows (the solution, "#"
 * for a black square), entries (see entriesOf), theme ({ answer, cat } or null), grade (crossword-solve.js) }.
 * Options: level; size (squares across, SIZES: the level's own if not given); kind (classic, learning, both: KINDS);
 * pool (mixed, country, commodity), asks (both, fwd, rev), mode (classic, theme), topics (a mix: { aspect: 0 | 1 | 2 },
 * null for every topic in), due and weak (learning mode's: pile keys, and entities other games found you weak on),
 * upto (the clue bank's tier it draws on: WHOLE_BANK, or today's DAILY_BANK).
 */
export function makePuzzle({ seed = 1, level = "medium", size = null, kind = "both", pool = "mixed", asks = "both", mode = "classic", topics = null, due = [], weak = null, upto = WHOLE_BANK } = {}) {
  // a theme's starred clues are all one answer's, and an answer has only so many that fit a grid: a theme takes what
  // a mixed grid does, Learning or not
  const L = spec(level, size, mode === "theme" && kind === "learning" ? "both" : kind), rnd = seeded(mix(seed, 0xC205)), bank = bankTo(upto);
  if (L.kb < THEMED) mode = "classic";
  const all = L.kb ? candidates(L, { pool, asks: mode === "theme" ? "rev" : asks, topics, due, weak }) : [];
  // learning mode: what the review pile has due goes in first, up to half the grid's knowledge entries, the pile's
  // order kept (the most revised first)
  const inPool = new Map(all.map(c => [c.e.key, c.e]));
  const early = mode === "theme" ? [] : due.map(k => inPool.get(k)).filter(Boolean).slice(0, Math.ceil(L.kb / 2));
  const themes = mode === "theme" ? themesOf(all, L) : null;
  if (themes && !themes.length) return null;
  let best = null, grid = null, theme = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // a grid serves a few attempts, each with its own knowledge entries (making one costs more than trying one), and
    // a theme its grid, which is made with room for its keystone
    if (attempt % 3 === 0) {
      theme = themes ? drawTheme(themes, rnd) : null;
      grid = gridFor(L, mix(seed, attempt), (theme ? [theme.key] : early.slice(0, 2)).map(e => e.letters.length));
    }
    if (!grid) continue;
    let drawFrom = all, keystone = null;
    if (theme) ({ key: keystone, stars: drawFrom } = theme);
    // the level's share named the other way round, rounded up or down at random so it averages out right
    const rev = L.kb && !themes && asks === "both" ? Math.round(L.kb * L.rev + rnd() - 0.5) : null;
    const placed = L.kb ? placeKnowledge(grid, slotsOf(grid), drawFrom, L.kb - (keystone ? 1 : 0), rnd, { first: keystone, early, maxLen: L.longest, rev, bank }) : [];
    if (!placed || placed.length < (keystone ? Math.max(5, L.least) : L.least)) continue;
    // an ordinary word a knowledge clue says is kept out of the grid, or the clue would give it away
    const said = new Set(placed.flatMap(p => textOf(p.e).toLowerCase().replace(/[^a-z]+/g, " ").split(" ").filter(w => w.length >= 3)));
    const words = len => bank.bands(len).map(b => b.filter(w => !said.has(w)));
    const fill = fillGrid(grid, { words, fixed: placed.map(p => ({ word: p.e.letters.toLowerCase(), slot: p.slot.id })), seed: mix(seed, 0xF111 + attempt), budget: L.budget, starts: 8 });
    if (!fill) continue;
    const puzzle = assemble(fill, placed, { seed, level, kind, mode, pool, rnd, L, bank });
    if (!puzzle) continue;
    puzzle.grade = grade(puzzle, { seed: mix(seed, attempt) });
    // a theme's starred clues are recall without their country, so a theme is held to the share alone, set lower
    const off = (themes ? outside(puzzle.grade.share, [L.share[0] - 0.08, L.share[1]]) : outside(puzzle.grade.finish, L.finish) + outside(puzzle.grade.share, L.share))
      + early.filter(e => !placed.some(p => p.e === e)).length;      // a puzzle missing something due is a last resort
    if (!best || off < best.off) best = { puzzle, off };
    if (!off) break;
  }
  return best?.puzzle || null;
}
/** How far a figure is outside a band (0 inside it). */
const outside = (x, [lo, hi]) => (x < lo ? lo - x : x > hi ? x - hi : 0);
/**
 * The themes a deal can have: answers of the pool, each with its clues starred (reverse entries without the answer's
 * name: the reason alone) and the answer itself the keystone, clued as what they point to. An answer qualifies with
 * six starred clues to draw from, none of whose reasons says its name: { key, stars, w (their weight) }.
 */
function themesOf(all, L) {
  const byAnswer = new Map();
  for (const c of all) if (c.e.dir === "rev") { if (!byAnswer.has(c.e.a)) byAnswer.set(c.e.a, []); byAnswer.get(c.e.a).push(c); }
  const fwdOf = new Map(kbEntries().filter(e => e.dir === "fwd").map(e => [e.a, e]));
  const out = [];
  for (const [a, list] of byAnswer) {
    const key = fwdOf.get(a);
    if (!key || key.letters.length > L.longest || key.letters.length < 4) continue;
    const names = [BANK[a].name, key.answer, ...(BANK[a].aliases || [])].map(wordsOf);
    const stars = list.filter(c => !names.some(n => saysWords(wordsOf(c.e.hint), n))).map(c => ({ ...c, e: { ...c.e, dir: "star", lead: null } }));
    if (stars.length < 6) continue;
    out.push({ key: { ...key, dir: "key", hint: `The ${BANK[a].cat} behind every starred clue`, lead: null }, stars, w: stars.reduce((s, c) => s + c.w, 0) });
  }
  return out;
}
/** One of the themes, by weight. */
function drawTheme(themes, rnd) {
  let t = rnd() * themes.reduce((s, x) => s + x.w, 0);
  return themes.find(x => (t -= x.w) <= 0) || themes[themes.length - 1];
}
const TAGS = { fwd: e => (e.cat === "country" ? "Country" : "Commodity"), rev: () => "Name it", star: () => "★", key: () => "★" };
/**
 * The puzzle from a fill: every slot an entry, numbered as printed; knowledge entries with their clue, ordinary words
 * with one of theirs (the harder one at the level's share), checked so no clue gives another entry away and exactly
 * one fill fits the clues. Null if that can't be had.
 */
function assemble(fill, placed, { seed, level, kind, mode, pool, rnd, L, bank }) {
  const kbAt = new Map(placed.map(p => [p.slot.id, p.e]));
  const entries = fill.slots.map(s => {
    const base = { num: s.num, dir: s.dir, row: s.row, col: s.col, len: s.len, cells: s.cells, letters: s.word.toUpperCase() };
    const e = kbAt.get(s.id);
    if (e) {
      const kind = e.dir;
      return { ...base, kind, cat: e.cat, d: e.d, lead: e.lead, text: e.hint, enumer: e.enumer, answer: e.answer, tag: TAGS[kind](e), key: e.key, about: e.about, pair: e.pair, alts: e.alts };
    }
    const clues = cluesOf(s.word);
    const hard = clues.find(c => c.d === 2), easy = clues.find(c => c.d === 1) || clues[0];
    const c = hard && (rnd() < L.hardClue || !easy) ? hard : easy;
    return { ...base, kind: "word", d: c.d, text: c.text, other: clues.find(x => x !== c)?.text || null, enumer: String(s.len), answer: s.word.toUpperCase() };
  });
  entries.sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === "across" ? -1 : 1));
  entries.forEach((e, n) => { e.n = n; });
  // no clue may say another entry's answer: an ordinary word's other clue is tried, else the fill is given up
  const answers = entries.map(y => [y, wordsOf(y.answer)]);
  const bad = x => { const t = wordsOf(textOf(x)); return answers.some(([y, a]) => y !== x && saysWords(t, a)); };
  for (const e of entries) {
    if (!bad(e)) continue;
    if (e.kind !== "word" || !e.other) return null;
    [e.text, e.other] = [e.other, e.text];
    e.d = cluesOf(e.letters).find(c => c.text === e.text)?.d || e.d;
    if (bad(e)) return null;
  }
  const puzzle = { v: 1, seed, level, kind, mode, pool, upto: bank.upto, rows: fill.grid.map(r => r.toUpperCase()), entries, theme: null, grade: null };
  if (mode === "theme") { const k = entries.find(e => e.kind === "key"); puzzle.theme = k ? { answer: k.answer, cat: k.cat } : null; }
  // exactly one fill: where an ordinary clue is shared with another word that the crossings allow, its other clue
  const sameClue = e => bank.sameClue(e.len, e.text);
  if (countSolutions(puzzle, allowed(puzzle, sameClue)) !== 1) {
    for (const e of entries) if (e.kind === "word" && e.other && sameClue(e).length > 1) {
      [e.text, e.other] = [e.other, e.text];
      e.d = cluesOf(e.letters).find(c => c.text === e.text)?.d || e.d;
    }
    if (countSolutions(puzzle, allowed(puzzle, sameClue)) !== 1) return null;
  }
  for (const e of entries) delete e.other;
  return puzzle;
}
/** Whether exactly one fill fits a puzzle's clues (for the tests: the deal has checked it already). */
export const uniquelySolved = puzzle => {
  const bank = bankTo(puzzle.upto ?? WHOLE_BANK);
  return countSolutions(puzzle, allowed(puzzle, e => bank.sameClue(e.len, e.text))) === 1;
};

// ---------- reading a puzzle ----------
export const size = puzzle => ({ R: puzzle.rows.length, C: puzzle.rows[0].length });
export const isBlack = (puzzle, k) => puzzle.rows[(k / puzzle.rows[0].length) | 0][k % puzzle.rows[0].length] === BLACK;
export const solutionAt = (puzzle, k) => puzzle.rows[(k / puzzle.rows[0].length) | 0][k % puzzle.rows[0].length];
/** The entries through a cell: { across, down }, either may be null. */
export function entriesAt(puzzle, k) {
  let across = null, down = null;
  for (const e of puzzle.entries) if (e.cells.includes(k)) { if (e.dir === "across") across = e; else down = e; }
  return { across, down };
}
/** The clue numbers by cell, as printed: { cell: number }. */
export function numbers(puzzle) {
  const out = {};
  for (const e of puzzle.entries) out[e.cells[0]] = e.num;
  return out;
}
/** A clue as a line of text: "Troll: One of the largest offshore gas fields ever found (6)". */
export const clueLine = e => `${e.lead ? `${e.lead}: ` : ""}${e.text} (${e.enumer})`;

// ---------- playing one ----------
/**
 * A puzzle's play, kept as plain data: letters (one a cell, "#" a black square, "." empty), revealed (cells given
 * away), wrong (cells a check found wrong, until they change), checks and reveals (the wrong letters checks found,
 * and the letters revealed: what the time is charged for), ms (on the clock), done (once solved or given up).
 */
export function freshPlay(puzzle) {
  return { letters: puzzle.rows.join("").replace(/[A-Z]/g, EMPTY), revealed: [], wrong: [], checks: 0, reveals: 0, ms: 0, done: null };
}
const setAt = (s, k, ch) => s.slice(0, k) + ch + s.slice(k + 1);
/** Writes a letter (or "." to empty the cell); a revealed letter stays. Whether anything changed. */
export function put(play, puzzle, k, ch) {
  if (isBlack(puzzle, k) || play.revealed.includes(k) || play.done) return false;
  const v = ch === EMPTY ? EMPTY : String(ch).toUpperCase();
  if (play.letters[k] === v) return false;
  play.letters = setAt(play.letters, k, v);
  play.wrong = play.wrong.filter(x => x !== k);
  return true;
}
/** Checks cells: those with a wrong letter are marked, and each counts against the time. How many were wrong. */
export function check(play, puzzle, cells) {
  let n = 0;
  for (const k of cells) {
    const ch = play.letters[k];
    if (ch === EMPTY || ch === BLACK || ch === solutionAt(puzzle, k) || play.wrong.includes(k)) continue;
    play.wrong.push(k); n++;
  }
  play.checks += n;
  return n;
}
/** Reveals cells: each not already right gets its letter, for good, and counts against the time. How many. */
export function reveal(play, puzzle, cells) {
  let n = 0;
  for (const k of cells) {
    if (isBlack(puzzle, k) || play.revealed.includes(k)) continue;
    const right = solutionAt(puzzle, k);
    if (play.letters[k] === right) continue;
    play.letters = setAt(play.letters, k, right);
    play.revealed.push(k);
    play.wrong = play.wrong.filter(x => x !== k);
    n++;
  }
  play.reveals += n;
  return n;
}
/** Every white cell lettered. */
export const full = play => !play.letters.includes(EMPTY);
/** Every letter right. */
export const solvedBy = (play, puzzle) => play.letters === puzzle.rows.join("");
/** The cells with a wrong letter in them. */
export const wrongCells = (play, puzzle) => [...play.letters].map((ch, k) => (ch !== EMPTY && ch !== BLACK && ch !== solutionAt(puzzle, k) ? k : -1)).filter(k => k >= 0);
/** An entry's letters as they stand ("TR.LL"). */
export const lettersIn = (play, e) => e.cells.map(k => play.letters[k]).join("");
/** Whether an entry is filled in right. */
export const entryRight = (play, e) => lettersIn(play, e) === e.letters;
/** Whether any of an entry's letters were revealed. */
export const entryHelped = (play, e) => e.cells.some(k => play.revealed.includes(k));
/**
 * What a finished grid teaches: its knowledge entries that `mine` says were yours to solve, each { e, helped }, helped
 * when a letter of it was revealed or it wasn't filled in right (it goes to the review pile; one got unaided moves up).
 * A theme's keystone isn't one of its links but what they share, so it teaches nothing of its own.
 */
export const lessons = (puzzle, play, mine = () => true) => puzzle.entries.filter(e => e.kind !== "word" && e.kind !== "key" && e.key && mine(e))
  .map(e => ({ e, helped: entryHelped(play, e) || !entryRight(play, e) }));
/** The seconds a play is charged: the clock, and the penalties for help. */
export const charged = play => Math.round(play.ms / 1000) + play.reveals * REVEAL_COST + play.checks * CHECK_COST;
/** "4:07" (or "1:02:03"). */
export function clock(secs) {
  const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
/** The seed today's puzzle is dealt from (the day is the suite's: today() in suite.js). */
export const dailySeed = day => (Number(day) * 7919 + 271) >>> 0;
/** Today's puzzle: the same for everyone, whatever their settings: Medium, 13 by 13, knowledge mixed with ordinary
 *  words, every topic, both ways, no twist. */
export const dailyOptions = day => ({ seed: dailySeed(day), level: "medium", size: 13, kind: "both", pool: "mixed", asks: "both", mode: "classic", topics: null, upto: DAILY_BANK });
