// Crossword (README, Crossword), pure: how a puzzle is made, and the rules of playing one. A puzzle is a British
// blocked grid (gridfill.js makes the grid and fills it) with a few knowledge entries placed in it first
// (crossword-kb.js: a country or commodity named from one of its clues, or the clue named from its reason), the
// rest ordinary words with the clue bank's clues (clues.js), or, in a Lexicon grid, every entry the knowledge base's;
// it's dealt only when exactly one fill fits its clues
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
 * of it the average one fills; lexShare: the share band of a Lexicon grid, every entry a name to know, which few
 * solvers finish unaided at any level (a Lexicon grid's first try, measured over 120 at each level, every size: the
 * average solver filled a median of 63% of an Easy one, 51% of a Medium one and 34% of a Hard one, nine in ten above
 * 56%, 45% and 28%).
 */
export const LEVELS = {
  easy: { name: "Easy", size: 11, more: 0, rev: 0.1, kbD: [3, 1, 0.1], hardClue: 0, hardClassic: 0, finish: [0.25, 1], share: [0.93, 1], lexShare: [0.56, 1] },
  medium: { name: "Medium", size: 13, more: 0, rev: 0.25, kbD: [1.5, 1, 0.4], hardClue: 0.2, hardClassic: 0.35, finish: [0.04, 0.5], share: [0.88, 0.97], lexShare: [0.44, 0.58] },
  hard: { name: "Hard", size: 13, more: 1, rev: 0.5, kbD: [0.3, 1, 2], hardClue: 0.6, hardClassic: 1, finish: [0, 0.15], share: [0.74, 0.9], lexShare: [0.25, 0.42] },
};
export const LEVEL_IDS = Object.keys(LEVELS);
/**
 * The grids, by squares across. longest: the longest entry (the clue bank's long words are few, so a grid's long runs
 * are cut); cut: where gridfill cuts the runs itself, rather than its grids with longer ones being passed over (at 15
 * by 15 nearly half of them were, and a good grid took three times as long; 11 and 13 by 13 keep passing over, so
 * their grids, today's among them, are the ones they always were); kb: its knowledge entries when they're mixed with
 * ordinary words (Both), and a theme's starred clues and keystone in any kind; entries: about how many entries its
 * grids have, which the levels' share of solvers who finish is scaled by (below), and half of which a Lexicon grid
 * gives to what's due; budget: the fill's search steps, if not 24,000 (a 9 by 9 fill that works takes a few hundred
 * at most, and one that won't spent all 24,000, two seconds here).
 */
export const SIZES = {
  9: { longest: 9, kb: 3, entries: 13, budget: 4000 },
  11: { longest: 9, kb: 5, entries: 20 },
  13: { longest: 11, kb: 6, entries: 28 },
  15: { longest: 12, cut: 12, kb: 8, entries: 35 },
};
export const SIZE_IDS = Object.keys(SIZES).map(Number);
/**
 * What a grid's entries are: ordinary words alone (Classic), the knowledge base's alone (Lexicon: every answer a thing
 * Lexicon knows, clued by one of its links), or a few of the knowledge base's among ordinary words (Both).
 */
export const KINDS = { classic: "Classic", lexicon: "Lexicon", both: "Both" };
/** A kind as saved: "learning" was the kind before Lexicon (October 2026), as many knowledge entries as a grid took,
 *  apart, among ordinary words; Lexicon is what it was asked to be. */
export const kindOf = k => (k === "learning" ? "lexicon" : KINDS[k] ? k : "both");
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
  const clued = new Map();
  b = {
    upto,
    /** A length's words, commonest first in two bands (gridfill tries the first band first). */
    bands: len => [cluedWords(len, 0), cluedWords(len, upto).slice(cluedWords(len, 0).length)].filter(x => x.length),
    /** How many words of a length fit letters at places ([[pos, ch]…], ch lower case). */
    count: counter(len => cluedWords(len, upto)),
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
/**
 * How many of a length's words (`wordsOf(len)`, lower case) fit letters at places ([[pos, ch]…], at least one):
 * what a knowledge entry's crossed letters ask of the words that cross it. For each length, a bitset of the words with
 * each letter at each place, worked out once, so letters at several places are one AND per 32 words.
 */
function counter(wordsOf) {
  const bits = new Map();
  return (len, fixed) => {
    if (!bits.has(len)) {
      const words = wordsOf(len), nw = (words.length + 31) >>> 5, at = new Uint32Array(len * 26 * nw);
      words.forEach((w, j) => { for (let i = 0; i < len; i++) at[(i * 26 + w.charCodeAt(i) - 97) * nw + (j >>> 5)] |= (1 << (j & 31)) >>> 0; });
      bits.set(len, { nw, at });
    }
    const { nw, at } = bits.get(len);
    let n = 0;
    for (let x = 0; x < nw; x++) {
      let v = 0xFFFFFFFF;
      for (const [i, ch] of fixed) v &= at[(i * 26 + ch.charCodeAt(0) - 97) * nw + x];
      if (v) n += popcount(v >>> 0);
    }
    return n;
  };
}
const popcount = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };

// ---------- the knowledge entries a deal draws from ----------
/** The weight of an entry dealt lately, against 1 for one not (No repeats, README, Learning modes). */
const FRESH = 0.02;
/**
 * The knowledge entries a deal may use, each with its weight: its topics' (0 out, 1 in, 2 more: the best of its
 * aspects, as Crates weighs a clue) times its difficulty's at the level, times more for one the review pile has due
 * (`due`, keys) or one about something another game found you weak on (`weak`, entity ids).
 */
function candidates(L, { pool = "mixed", asks = "both", topics = null, due = [], weak = null, avoid = [] }) {
  const dueSet = new Set(due), avoided = new Set(avoid);
  return kbEntries().filter(e => (pool === "mixed" || e.cat === pool) && (asks === "both" || e.dir === asks) && e.letters.length <= L.longest)
    .map(e => {
      const topic = topics ? Math.max(0, ...e.topics.map(t => topics[t] ?? 1)) : 1;
      const learn = dueSet.has(e.key) ? 8 : weak && e.about.some(id => weak.has(id)) ? 3 : 1;
      // dealt lately: far less likely, but not out, so a bank that's all been dealt still fills a grid
      return { e, w: topic * L.kbD[e.d - 1] * learn * (avoided.has(e.key) && !dueSet.has(e.key) ? FRESH : 1) };
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
// a reason's words alone, worked out once an entry (every theme deal reads every reverse entry's)
const cachedHints = new WeakMap();
function hintWords(e) {
  let w = cachedHints.get(e);
  if (!w) { w = wordsOf(e.hint); cachedHints.set(e, w); }
  return w;
}
/** Whether two entries can't share a grid: the same answer, or one's clue saying the other's answer. */
const clash = (x, y) => x.letters === y.letters || gives(x, y) || gives(y, x);

/**
 * Knowledge entries for a grid's slots: up to `count`, in slots that don't cross each other (two rare words sharing
 * a letter is what fills fail on), across and down in turn so both directions get some; each the likeliest by weight
 * among those whose crossed letters leave every crossing slot at least `room` words of `bank` to choose from. `first`
 * goes in before the rest (the theme's keystone), or nothing is placed; `early`, entries to place before the draws
 * where they fit (what the review pile has due); `rev`, how many should be named the other way round (null: as the
 * weights fall), kept to in a first pass over the slots and let go in a second if the grid is still short. `cross`
 * lets them cross where they share a letter (a Lexicon grid's, whose every entry is the knowledge base's), and take
 * slots of three.
 */
function placeKnowledge(grid, slots, pool, count, rnd, { first = null, early = [], maxLen, rev = null, bank, room = 10, cross = false }) {
  const crossers = slots.map(s => s.cells.map(k => {
    const t = slots.find(x => x.id !== s.id && x.cells.includes(k));
    return t ? { t, j: t.cells.indexOf(k) } : null;
  }));
  const fixedIn = new Map();                                    // slot id → [[pos, ch]] the chosen entries put there
  const at = new Map();                                         // cell → the letter a chosen entry put there
  const chosen = [], taken = new Set();
  // a crossing slot already taken needs no room: its word is in (and agrees, below)
  const roomy = (s, letters) => crossers[s.id].every((x, i) => !x || taken.has(x.t.id) || bank.count(x.t.len, [...(fixedIn.get(x.t.id) || []), [x.j, letters[i].toLowerCase()]]) >= room);
  const take = (s, e) => {
    chosen.push({ slot: s, e });
    taken.add(s.id);
    s.cells.forEach((k, i) => at.set(k, e.letters[i]));
    crossers[s.id].forEach((x, i) => { if (x) fixedIn.set(x.t.id, [...(fixedIn.get(x.t.id) || []), [x.j, e.letters[i].toLowerCase()]]); });
  };
  const free = s => (cross ? !taken.has(s.id) : !chosen.some(c => c.slot.id === s.id || crossers[c.slot.id].some(x => x && x.t.id === s.id)));
  const agrees = (s, letters) => !cross || s.cells.every((k, i) => !at.has(k) || at.get(k) === letters[i]);
  const order = shuffled(slots.filter(s => s.len >= (cross ? 3 : 4) && s.len <= maxLen), rnd);
  const across = order.filter(s => s.dir === "across"), down = order.filter(s => s.dir === "down");
  const turns = [];
  for (let i = 0; i < Math.max(across.length, down.length); i++) { if (across[i]) turns.push(across[i]); if (down[i]) turns.push(down[i]); }
  if (first) {
    const s = turns.find(x => x.len === first.letters.length && free(x) && agrees(x, first.letters) && roomy(x, first.letters));
    if (!s) return null;
    take(s, first);
  }
  for (const e of early) {
    if (chosen.some(x => clash(x.e, e))) continue;
    const s = turns.find(x => x.len === e.letters.length && free(x) && agrees(x, e.letters) && roomy(x, e.letters));
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
        if (!chosen.some(x => clash(x.e, c.e)) && agrees(s, c.e.letters) && roomy(s, c.e.letters)) { take(s, c.e); break; }
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
 * longest entry, cut and fill budget, its knowledge entries (kb: in a Lexicon grid, every entry the knowledge base's,
 * as many as its theme takes) and the fewest it may come with (least), and how many may be what's due (half the
 * knowledge entries: half of all of them in a Lexicon grid).
 * Finishing a grid unaided takes getting every entry, so the share who finish falls as a power of how many there are:
 * a level's finish band, set at its own size, is raised to the ratio of the entries (a 9 by 9 grid's Medium asks more
 * of its thirteen entries than a 13 by 13's of twenty-eight). How much of a grid the average solver fills doesn't
 * depend on its size, so the share band stands. A Lexicon grid is held to its own share band alone: every entry a
 * name to know, few solvers finish one unaided at any level.
 */
function spec(level, size, kind) {
  const lv = LEVELS[level] || LEVELS.medium, n = SIZES[size] ? Number(size) : lv.size, Z = SIZES[n], lexicon = kind === "lexicon";
  const kb = kind === "classic" ? 0 : Z.kb + lv.more;
  const finish = lexicon ? [0, 1] : n === lv.size ? lv.finish : lv.finish.map(x => x ** (Z.entries / SIZES[lv.size].entries));
  return { ...lv, size: n, longest: Z.longest, cut: Z.cut, budget: Z.budget || 24000, kb, least: kb && Math.max(Math.min(3, kb - 1), kb - 2),
    due: Math.ceil((lexicon ? Z.entries : kb) / 2), hardClue: kind === "classic" ? lv.hardClassic : lv.hardClue, finish, share: lexicon ? lv.lexShare : lv.share, lexicon };
}
/**
 * A puzzle, or null when none came within the attempts: { v, seed, level, kind, mode, pool, rows (the solution, "#"
 * for a black square), entries (see entriesOf), theme ({ answer, cat } or null), grade (crossword-solve.js) }.
 * Options: level; size (squares across, SIZES: the level's own if not given); kind (classic, lexicon, both: KINDS);
 * pool (mixed, country, commodity), asks (both, fwd, rev), mode (classic, theme), topics (a mix: { aspect: 0 | 1 | 2 },
 * null for every topic in), due and weak (learning mode's: the entries the review pile has due, by key, the most
 * revised first, and entities other games found you weak on), upto (the clue bank's tier it draws on: WHOLE_BANK, or
 * today's DAILY_BANK).
 */
export function makePuzzle({ seed = 1, level = "medium", size = null, kind = "both", pool = "mixed", asks = "both", mode = "classic", topics = null, due = [], weak = null, avoid = [], upto = WHOLE_BANK } = {}) {
  const L = spec(level, size, kind), rnd = seeded(mix(seed, 0xC205)), bank = bankTo(upto);
  // a Lexicon grid of country and commodity names alone can't be filled (there are too few of them): it names both ways
  if (L.lexicon && asks === "fwd") asks = "both";
  if (L.kb < THEMED) mode = "classic";
  // a mixed grid's theme draws on the reverse entries alone (its starred clues); a Lexicon grid fills the rest of the
  // grid from the same entries, so it takes them as asked (the starred clues still only reverse ones: themesOf)
  const all = L.kb ? candidates(L, { pool, asks: mode === "theme" && !L.lexicon ? "rev" : asks, topics, due, weak, avoid }) : [];
  // learning mode: what the review pile has due goes in first, up to half the grid's knowledge entries (half of all its
  // entries in a Lexicon grid), the pile's order kept (the most revised first), none giving another away
  const inPool = new Map(all.map(c => [c.e.key, c.e]));
  const early = mode === "theme" ? [] : apart(due.map(k => inPool.get(k)).filter(Boolean)).slice(0, L.due);
  const themes = mode === "theme" ? themesOf(all, L) : null;
  if (themes && !themes.length) return null;
  const lexicon = L.lexicon ? lexiconWords(all, L) : null;
  let best = null, grid = null, theme = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // a grid serves a few attempts, each with its own knowledge entries (making one costs more than trying one), and
    // a theme its grid, which is made with room for its keystone
    if (attempt % 3 === 0) {
      theme = themes ? drawTheme(themes, rnd) : null;
      // (a Lexicon grid asks no room of it for what's due: it takes what of it fits as it's filled, and a grid with
      // room for two of its lengths was often not to be had)
      grid = gridFor(L, mix(seed, attempt), (theme ? [theme.key] : L.lexicon ? [] : early.slice(0, 2)).map(e => e.letters.length));
    }
    if (!grid) continue;
    let fill, placed;
    if (lexicon) {
      const made = lexiconFill(grid, { theme, early, words: lexicon, rnd, seed, attempt, L });
      if (!made) continue;
      ({ fill, placed } = made);
    } else {
      let drawFrom = all, keystone = null;
      if (theme) ({ key: keystone, stars: drawFrom } = theme);
      // the level's share named the other way round, rounded up or down at random so it averages out right
      const rev = L.kb && !themes && asks === "both" ? Math.round(L.kb * L.rev + rnd() - 0.5) : null;
      placed = L.kb ? placeKnowledge(grid, slotsOf(grid), drawFrom, L.kb - (keystone ? 1 : 0), rnd, { first: keystone, early, maxLen: L.longest, rev, bank }) : [];
      if (!placed || placed.length < (keystone ? Math.max(5, L.least) : L.least)) continue;
      // an ordinary word a knowledge clue says is kept out of the grid, or the clue would give it away
      const said = saidBy(placed.map(p => p.e));
      const words = len => bank.bands(len).map(b => b.filter(w => !said.has(w)));
      fill = fillGrid(grid, { words, fixed: placed.map(p => ({ word: p.e.letters.toLowerCase(), slot: p.slot.id })), seed: mix(seed, 0xF111 + attempt), budget: L.budget, starts: 8 });
      if (!fill) continue;
    }
    const puzzle = assemble(fill, placed, { seed, level, kind, mode, pool, rnd, L, bank });
    if (!puzzle) continue;
    puzzle.grade = grade(puzzle, { seed: mix(seed, attempt) });
    // a theme's starred clues are recall without their country, so a theme is held to the share alone, set lower
    const off = themes ? outside(puzzle.grade.share, [L.share[0] - 0.08, L.share[1]]) : outside(puzzle.grade.finish, L.finish) + outside(puzzle.grade.share, L.share);
    // in its level's band first, then as much of what's due as will go in: one missing some of it is taken once a
    // grid's three attempts have tried (what's left may never fit, a length no slot here has, and all forty would be
    // spent: measured, letting the next grid's three try as well brought a fourteenth more of it in, for two thirds as
    // long again)
    const missing = early.filter(e => !placed.some(p => p.e === e)).length;
    if (!best || off < best.off || (off === best.off && missing < best.missing)) best = { puzzle, off, missing };
    if (!off && (!missing || attempt >= 2)) break;
  }
  return best?.puzzle || null;
}
/** The words (three letters or more) a set of entries' clues say: kept out of the grid, or a clue would give one away. */
const saidBy = entries => new Set(entries.flatMap(e => textOf(e).toLowerCase().replace(/[^a-z]+/g, " ").split(" ").filter(w => w.length >= 3)));
/** Entries in their order, each kept only if it can share a grid with every one kept before it (clash, above). */
const apart = list => list.reduce((out, e) => (out.some(x => clash(x, e)) ? out : [...out, e]), []);
/** One of a list of weighted choices ({ w }), by weight; null for none. */
function pick(list, rnd) {
  if (!list.length) return null;
  let t = rnd() * list.reduce((a, c) => a + c.w, 0);
  return list.find(c => (t -= c.w) < 0) || list[list.length - 1];
}

// ---------- a Lexicon grid: the knowledge base's entries alone ----------
/**
 * What a Lexicon grid is filled from: every answer of the entries a deal may use (no longer than the size allows), each
 * with those entries and their weights (byWord, lower case), and for the fill, a length's words in bands by the best
 * weight among a word's entries (its topics, its links' difficulty at the level, whether it's due or about something
 * you're weak on elsewhere), the likeliest first, a new band wherever the weight halves, leaving out the words in
 * `out`. The fill tries a band's words before the next one's, so the weights steer it: Easy's easy links come first,
 * then the medium, then the hard (weights 3, 1 and 0.1), Medium's easy and medium links together before the hard,
 * Hard's medium and hard before the easy; and what's due that lexiconFill couldn't place comes first of all, where it
 * fits (measured, a tenth more of what's due went in than with it weighed as any other word).
 */
function lexiconWords(all, L) {
  const byWord = new Map();
  for (const c of all) {
    if (c.e.letters.length > L.longest) continue;
    const w = c.e.letters.toLowerCase();
    if (!byWord.has(w)) byWord.set(w, []);
    byWord.get(w).push(c);
  }
  const byLen = new Map();
  for (const [w, list] of byWord) {
    if (!byLen.has(w.length)) byLen.set(w.length, []);
    byLen.get(w.length).push([w, Math.max(...list.map(c => c.w))]);
  }
  for (const list of byLen.values()) list.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return {
    byWord,
    /** How many of a length's words fit letters at places (as the clue bank's count, for placeKnowledge). */
    count: counter(len => (byLen.get(len) || []).map(([w]) => w)),
    bands(len, out) {
      const bands = [];
      let top = 0;
      for (const [w, weight] of byLen.get(len) || []) {
        if (out.has(w)) continue;
        if (!bands.length || weight < top / 2) { bands.push([]); top = weight; }
        bands[bands.length - 1].push(w);
      }
      return bands;
    },
  };
}
// what a theme's keystone and starred clues must leave each slot they cross: words of the knowledge base, which has far
// fewer than the clue bank (a mixed grid's ten left a theme with nowhere to go)
const LEXICON_ROOM = 6;
// a Lexicon fill's steps: one that works takes a few dozen, nearly always under 1,300, and one that won't would spend
// a mixed grid's 24,000 (a theme's grid took a third longer so); a quick fill, to see whether the grid can still be
// filled round what's due, has fewer, over three starts (measured, 4,000 over eight put no more in, half as long again)
const FILL_BUDGET = 4000, TRY_BUDGET = 1500;
/**
 * The words a Lexicon grid's fill leaves out round these entries: any a clue of theirs says, and any whose every entry
 * would give one of them away, a clue of a placed country or commodity (a theme's keystone among them), bold with its
 * name, or the country or commodity a placed clue is bold with (the rarer giveaways, a reason naming another answer,
 * are caught as entries are given).
 */
function keptOut(entries, words) {
  const out = saidBy(entries);
  if (!entries.length) return out;
  const named = new Set(entries.filter(e => e.dir === "fwd" || e.dir === "key").map(e => e.a)), bold = new Set(entries.filter(e => e.dir === "rev").map(e => e.a));
  const givesAway = c => (c.e.dir === "rev" && named.has(c.e.a)) || (c.e.dir === "fwd" && bold.has(c.e.a));
  for (const [w, list] of words.byWord) if (!out.has(w) && list.every(givesAway)) out.add(w);
  return out;
}
/**
 * A Lexicon grid's fill. A theme's keystone and starred clues go in first, as a mixed grid's knowledge entries do
 * (placeKnowledge), but free to cross where their letters agree. What's due goes in one at a time, the most revised
 * first, each in a slot of its length that agrees with what's in (two tried at most), kept only if the grid can still
 * be filled round it (measured: placed ahead of the fill, the way a mixed grid's are, two thirds as much of it went
 * in, the knowledge base's few words leaving the slots round it nothing; offered to the fill as its likeliest words
 * alone, a seventh as much). The rest of the grid is filled from the knowledge base's words (lexiconWords), and each
 * word is then given one of its entries, by weight, the word with fewest first, none clashing with another (the same
 * answer, or a clue saying another's answer). { fill, placed: [{ slot, e }] for every slot }, or null.
 */
function lexiconFill(grid, { theme, early, words, rnd, seed, attempt, L }) {
  const slots = slotsOf(grid);
  const placed = theme ? placeKnowledge(grid, slots, theme.stars, L.kb - 1, rnd, { first: theme.key, maxLen: L.longest, bank: words, room: LEXICON_ROOM, cross: true }) : [];
  if (!placed || (theme && placed.length < THEMED)) return null;
  const fillRound = (list, budget) => {
    const out = keptOut(list.map(p => p.e), words);
    return fillGrid(grid, { words: len => words.bands(len, out), fixed: list.map(p => ({ word: p.e.letters.toLowerCase(), slot: p.slot.id })), seed: mix(seed, 0xF111 + attempt), budget, starts: budget === TRY_BUDGET ? 3 : 8 });
  };
  let fill = fillRound(placed, FILL_BUDGET);
  if (!fill) return null;
  for (const e of early) {
    if (placed.some(p => clash(p.e, e))) continue;
    const at = new Map(placed.flatMap(p => p.slot.cells.map((k, i) => [k, p.e.letters[i]])));
    const open = shuffled(slots.filter(s => s.len === e.letters.length && !placed.some(p => p.slot.id === s.id) && s.cells.every((k, i) => !at.has(k) || at.get(k) === e.letters[i])), rnd);
    for (const s of open.slice(0, 2)) {
      const f = fillRound([...placed, { slot: s, e }], TRY_BUDGET);
      if (f) { placed.push({ slot: s, e }); fill = f; break; }
    }
  }
  const at = new Map(placed.map(p => [p.slot.id, p.e])), chosen = placed.map(p => p.e);
  const rest = shuffled(fill.slots.filter(s => !at.has(s.id)), rnd).sort((a, b) => words.byWord.get(a.word).length - words.byWord.get(b.word).length);
  for (const s of rest) {
    const c = pick(words.byWord.get(s.word).filter(x => !chosen.some(y => clash(y, x.e))), rnd);
    if (!c) return null;
    at.set(s.id, c.e);
    chosen.push(c.e);
  }
  return { fill, placed: fill.slots.map(s => ({ slot: s, e: at.get(s.id) })) };
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
    const stars = list.filter(c => !names.some(n => saysWords(hintWords(c.e), n))).map(c => ({ ...c, e: { ...c.e, dir: "star", lead: null } }));
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
