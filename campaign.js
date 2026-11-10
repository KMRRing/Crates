// The Campaign: a game's levels in chapters, the stars won in each, what is open, and Endless after them. Pure (no DOM; the
// menu's part is campaign-ui.js), so tests/campaign.mjs holds it to account in Node.
//
// Korbi, 10 November 2026: the minigames and puzzles follow a few patterns, the same in every game of a kind.
//   Campaign  levels in chapters (this file): Gears, Bridges, Shunt, Stow, Columbiad, Survey, Moor, Lanterns, Portolan, Dujiang,
//             Drift, Slipway, Asterism, Loom, Settle, Manifest, and Landfall's voyages. 60 to 100 levels in 6 to 10 chapters
//             of 6 to 12. A chapter brings one twist and explores it, as Gears' first books do ("introduction, familiarity, a fun
//             quirk, mastery, next mechanic introduction"): the twist alone on a small board, with no way to win but by it; the
//             same in other places; a quirk, where it does something unexpected or meets an older rule; mastery, larger boards
//             with all that came before; a capstone, the chapter's hardest. Each chapter opens easier than the last one closed
//             (a sawtooth), and every three or four twists a chapter mixes them. Levels are made by a script (a solver proves
//             each has its answer, needs its chapter's twist and grades it) and frozen as data, never tuned by hand; the same
//             for everyone; a one-line rule a chapter, no tutorial pages; stars for the score (one solved, two within twice the
//             par, three within it). A level's id is its identity: stars are kept by it, so levels can be added.
//   Endless   after the campaign, instead of a random puzzle: one sequence, numbered, the same for everyone, made by the same
//             script in batches and frozen as data (never seeds: a change to a generator would change every player's level), only
//             ever added to. Each of its levels needs a chapter; the first that needs one waits until that chapter's capstone is
//             beaten. After a gate the levels lean on the new twist, then mix it with the older ones; difficulty rises to a
//             plateau, not forever; every 25th is a harder milestone.
//   Modes     three to ten long runs, each with a quirk of its own and its own best: Topple, Orrery, Ingot, Loose cargo,
//             Conjunction, Mines. No Endless (a run is one); the daily is a seeded run of the day's mode.
//   Drills    levels that are skills, passed by a mark: Speed maths, Spot. Endless is a mixed drill at the highest one passed.
//   Classic   the generator by size and difficulty, and a daily: Nonet, Tally, Assay, Ladder, Constellation, Delta, Slate.
//   (The knowledge games wait for the knowledge audit: whether they take levels is not decided.)
//   A daily for every game of every pattern.
//
//   const camp = createCampaign({ game: "shunt", chapters, levels, endless, store });
//   camp.isOpen(i) · camp.record(i, stars) · camp.endless.gate(n) · camp.endless.passed(n) …
// chapters: [{ name, rule }]; levels: [{ id, chapter, … }] in order; endless: [{ needs: a chapter }] in order (a game keeps the
// rest of each); store: { read(key, fallback, ok), write(key, value) } (a game's keeper: a watching frame writes nothing).
// Kept: `<game>:campaign` { v, at: the id being played, stars: { id: 0 to 3 } } and `<game>:endless` { at: the next to play }.

export const VERSION = 1;
const isRecord = v => !!v && typeof v === "object" && !Array.isArray(v);
const clampStars = s => (Number.isInteger(s) ? Math.max(0, Math.min(3, s)) : 0);

/** Where each chapter's levels run in the list: [from, to) by chapter (a chapter with no level gets an empty range). */
export function rangesOf(chapters, levels) {
  return chapters.map((_, c) => {
    const at = levels.reduce((a, L, i) => (L.chapter === c ? [...a, i] : a), []);
    return at.length ? [at[0], at[at.length - 1] + 1] : [levels.length, levels.length];
  });
}

/** The checks a campaign's data must pass (tests/campaign.mjs runs them on every game's): [] if it holds. */
export function problems({ chapters, levels, endless = [] }) {
  const out = [], ids = new Set();
  levels.forEach((L, i) => {
    if (typeof L.id !== "string" || !L.id) out.push(`level ${i + 1} has no id`);
    else if (ids.has(L.id)) out.push(`level ${i + 1}: the id ${L.id} is used twice`);
    ids.add(L.id);
    if (!Number.isInteger(L.chapter) || L.chapter < 0 || L.chapter >= chapters.length) out.push(`level ${i + 1} is in no chapter`);
    if (i && L.chapter < levels[i - 1].chapter) out.push(`level ${i + 1} goes back a chapter`);
  });
  chapters.forEach((ch, c) => {
    if (!ch.name || !ch.rule) out.push(`chapter ${c + 1} has no name or rule`);
    if (!levels.some(L => L.chapter === c)) out.push(`chapter ${c + 1} has no level`);
  });
  endless.forEach((E, n) => {
    if (!Number.isInteger(E.needs) || E.needs < 0 || E.needs >= chapters.length) out.push(`endless ${n + 1} needs no chapter`);
  });
  return out;
}

export function createCampaign({ game, chapters, levels, endless = [], store, legacy = null }) {
  const KEY = `${game}:campaign`, EKEY = `${game}:endless`, ranges = rangesOf(chapters, levels);
  const index = new Map(levels.map((L, i) => [L.id, i]));
  let kept = store.read(KEY, null, isRecord);
  if (!kept && legacy) kept = legacy();                         // a game's own campaign from before (its stars by level number)
  const stars = levels.map(L => clampStars(kept?.stars?.[L.id]));
  const firstUnsolved = () => { const k = stars.findIndex(s => s < 1); return k < 0 ? levels.length - 1 : k; };
  let at = index.has(kept?.at) ? Math.min(index.get(kept.at), firstUnsolved()) : firstUnsolved();
  let eAt = Math.max(0, Math.min(endless.length, Number(store.read(EKEY, null, isRecord)?.at) || 0));
  const save = () => store.write(KEY, { v: VERSION, at: levels[at]?.id ?? null, stars: Object.fromEntries(levels.map((L, i) => [L.id, stars[i]]).filter(([, s]) => s)) });
  const saveE = () => store.write(EKEY, { v: VERSION, at: eAt });
  if (legacy && !store.read(KEY, null, isRecord)) save();

  const chapterOf = i => levels[i]?.chapter ?? 0;
  const capstoneOf = c => ranges[c][1] - 1;
  const chapterDone = c => ranges[c][1] > ranges[c][0] && stars[capstoneOf(c)] >= 1;
  /** A level is open once the one before it is solved: the campaign is one road, chapter after chapter. */
  const isOpen = i => i === 0 || (i > 0 && i < levels.length && stars[i - 1] >= 1);

  return {
    game, chapters, levels, ranges,
    get at() { return at; },
    /** The level to play: one that is open, else the furthest open. */
    go(i) { at = isOpen(i) ? i : firstUnsolved(); save(); return at; },
    stars: i => stars[i] || 0,
    isOpen, chapterOf, capstoneOf, chapterDone,
    isCapstone: i => i === capstoneOf(chapterOf(i)),
    /** Keeps the most stars a level has had; true if this solve won more than it had (and, solved, the next level is now `at`). */
    record(i, s) {
      const won = clampStars(s), more = won > stars[i];
      if (more) stars[i] = won;
      if (won >= 1 && i === at && i + 1 < levels.length) at = i + 1;
      save();
      return more;
    },
    /** { beaten, stars, levels, chapters (beaten) }. */
    totals: () => ({ beaten: stars.filter(s => s >= 1).length, stars: stars.reduce((a, b) => a + b, 0), levels: levels.length, chapters: chapters.filter((_, c) => chapterDone(c)).length }),
    /** Endless: `at` the next level to play; a level is open while the chapter it needs has had its capstone beaten. */
    endless: {
      list: endless,
      get at() { return eAt; },
      /** The chapter whose capstone level n waits for, or -1 if it is open. */
      gate: n => (n < endless.length && !chapterDone(endless[n].needs) ? endless[n].needs : -1),
      isOpen: n => n >= 0 && n < endless.length && chapterDone(endless[n].needs),
      /** Level n won: the next is the one to play (the furthest never goes back). */
      passed(n) { if (n === eAt && eAt < endless.length) { eAt++; saveE(); } return eAt; },
      /** Whether Endless has begun at all: the first chapter's capstone beaten. */
      get begun() { return endless.length > 0 && chapterDone(endless[0].needs); },
    },
  };
}
