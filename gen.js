// Builds boards from the word bank: four answers, four words each, exactly one solution.
import { BANK, PAIRS, cardKey, norm, shuffled } from "./core.js";

const DIFF_WEIGHT = { easy: [3, 1, 0.2], mixed: [1, 1, 1], hard: [0.3, 1, 2.5] };
const MAX_HERRINGS = 2;        // words on a board that also fit another crate on it
const SAME_TOPIC_DAMPING = 0.45;
const RECENT_DAMPING = 0.25;
// Learning mode. A missed word comes back away from the crates it was missed next to, and with
// companions other than the ones it was missed with.
const NEIGHBOUR_DAMPING = 0.15;
const MATE_DAMPING = 0.05;
// Word weights: seen without a clear signal; known (bottom of the deck); missed but not yet due
// (held back until its turn); missed and due (welcome anywhere).
const LEARN_WEIGHT = { n: 0.5, k: 0.04 };
const NOT_YET = 0, DUE = 2;

export function wordWeight(word, settings) {
  const topic = Math.max(...word.topics.map(t => settings.topics[t] ?? 1));
  return topic > 0 ? topic * DIFF_WEIGHT[settings.difficulty][word.d - 1] : 0;
}

function pick(items, weights, rng) {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return -1;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return items.length - 1;
}

const wordKey = (a, i) => `${a}.${i}`;

function eligibleAnswers(cat, settings) {
  return BANK.map((a, i) => i).filter(i => {
    const a = BANK[i];
    return a.cat === cat && !settings.off.includes(a.group)
      && a.words.filter(w => wordWeight(w, settings) > 0).length >= 4;
  });
}

/** Words for one crate (four, or count): any forced ones first, the rest drawn by weight, spreading topics. */
/**
 * Tiles a board can't use: the names of its answers (and any word longer than three letters inside one:
 * "White gold" never sits on a board with Gold), plus words already dealt.
 */
function blocker(chosen) {
  const exact = new Set(chosen.flatMap(a => [BANK[a].name, ...BANK[a].aliases].map(norm)));
  const inside = [...exact].filter(n => n.length > 3).map(n => ` ${n} `);
  return {
    has: t => exact.has(t) || inside.some(n => ` ${t} `.includes(n)),
    add: t => exact.add(t),
  };
}

function sampleWords(ai, settings, banned, rng, { forced = [], mult = () => 1, count = 4 } = {}) {
  const words = BANK[ai].words;
  if (forced.some(i => banned.has(norm(words[i].w)))) return null;
  const out = [...forced], cands = [], weights = [];
  words.forEach((w, i) => {
    const wt = out.includes(i) || banned.has(norm(w.w)) ? 0 : wordWeight(w, settings) * mult(i);
    if (wt > 0) { cands.push(i); weights.push(wt); }
  });
  const spread = i => cands.forEach((j, n) => {
    if (words[j].topics.some(t => words[i].topics.includes(t))) weights[n] *= SAME_TOPIC_DAMPING;
  });
  out.forEach(spread);
  while (out.length < count) {
    const k = pick(cands, weights, rng);
    if (k < 0) return null;
    const i = cands[k];
    out.push(i);
    cands.splice(k, 1); weights.splice(k, 1);
    spread(i);
  }
  return out;
}

function learnWeight(learn, a, i) {
  const c = learn?.cards[cardKey(a, i)];
  if (!c) return 1;
  if (c.s === "w") return c.d <= learn.t ? DUE : NOT_YET;
  return LEARN_WEIGHT[c.s] ?? 1;
}

/** Missed clue-answer pairs that are due, grouped by answer, most overdue first: the crates this board revisits. */
function reviewPlan(pool, settings, learn, rng) {
  const due = new Map();
  for (const [key, c] of Object.entries(learn.cards)) {
    if (c.s !== "w" || c.d > learn.t) continue;
    const pair = PAIRS.get(key);
    if (!pair) continue;
    const [a, i] = pair;
    if ((pool !== "mixed" && BANK[a].cat !== pool) || settings.off.includes(BANK[a].group)
      || !(wordWeight(BANK[a].words[i], settings) > 0)) continue;
    if (!due.has(a)) due.set(a, []);
    due.get(a).push({ i, d: c.d, key });
  }
  if (!due.size) return null;
  const order = shuffled([...due], rng).map(([a, list]) => ({ a, list: list.sort((x, y) => x.d - y.d) }))
    .sort((x, y) => x.list[0].d - y.list[0].d);
  // In a mixed pool, deal the category with more words waiting (the most overdue breaks a tie).
  const waiting = c => order.filter(o => BANK[o.a].cat === c).reduce((n, o) => n + o.list.length, 0);
  const first = BANK[order[0].a].cat, other = first === "country" ? "commodity" : "country";
  const cat = waiting(other) > waiting(first) ? other : first;
  const mine = order.filter(o => BANK[o.a].cat === cat);
  const backlog = mine.reduce((n, o) => n + o.list.length, 0);
  const room = 4;                        // every crate on the board can revisit something if enough is due
  // Words missed on the same board come back on different boards, so they don't meet again,
  // unless so many are waiting that keeping them apart would push them past their slot.
  const neighbours = o => new Set(o.list.flatMap(x => learn.cards[x.key].c || []));
  const reviews = [];
  for (const o of mine) {
    if (reviews.length === room) break;
    if (backlog < 10 && reviews.some(r => neighbours(r).has(o.a) || neighbours(o).has(r.a))) continue;
    reviews.push(o);
  }
  return { cat, reviews, backlog };
}

/** Number of ways to fill four crates of four, given each word's own crate plus its also-fits. */
/**
 * Each crate must name exactly one answer: the only answer in the whole bank that all four of its words fit.
 * (Uniqueness on the board alone isn't enough: four generic biodiesel clues fit RME as well as FAME.)
 */
export function namesOne(g) {
  const fits = i => new Set([g.a, ...BANK[g.a].words[i].alt]);
  return g.w.map(fits).reduce((acc, s) => new Set([...acc].filter(a => s.has(a)))).size === 1;
}

export function countSolutions(groups) {
  const answers = groups.map(g => g.a);
  const cands = groups.flatMap((g, gi) => g.w.map(wi => [gi, ...BANK[g.a].words[wi].alt.map(a => answers.indexOf(a)).filter(x => x >= 0)]));
  const fill = [0, 0, 0, 0];
  let count = 0;
  (function go(k) {
    if (count > 1) return;
    if (k === cands.length) { count++; return; }
    for (const c of cands[k]) {
      if (fill[c] < 4) { fill[c]++; go(k + 1); fill[c]--; }
    }
  })(0);
  return count;
}

/** Yellow → red by average word difficulty. */
function withLevels(groups) {
  const avg = g => g.w.reduce((s, wi) => s + BANK[g.a].words[wi].d, 0) / 4;
  const order = groups.map((g, i) => i).sort((x, y) => avg(groups[x]) - avg(groups[y]) || groups[x].a - groups[y].a);
  return groups.map((g, i) => ({ ...g, level: order.indexOf(i) }));
}

/**
 * learn (optional) = { t, cards } from learn.js. With it, due missed words come back in crates of their
 * own answer next to companions they weren't missed with, on boards without their old neighbours;
 * unseen words are preferred and known ones sink to the bottom.
 */
export function generate({ pool, settings, recentA = [], recentW = [], rng = Math.random, learn = null }) {
  const recentAs = new Set(recentA), recentWs = new Set(recentW);
  const plan = learn && reviewPlan(pool, settings, learn, rng);
  const cats = plan ? [plan.cat] : pool === "mixed" ? shuffled(["country", "commodity"], rng) : [pool];
  const unseenShare = a => BANK[a].words.filter((w, i) => !learn.cards[cardKey(a, i)]).length / BANK[a].words.length;
  for (const cat of cats) {
    const answers = eligibleAnswers(cat, settings);
    if (answers.length < 4) continue;
    for (let attempt = 0; attempt < 400; attempt++) {
      // If the reviews won't fit on a valid board, revisit fewer of them at once.
      const reviews = plan ? plan.reviews.slice(0, Math.max(0, plan.reviews.length - Math.floor(attempt / 120))) : [];
      const chosen = reviews.map(r => r.a);
      const oldNeighbours = new Set(reviews.flatMap(r => r.list.flatMap(x => learn.cards[x.key].c || [])));
      const rest = answers.filter(a => !chosen.includes(a));
      const weights = rest.map(a => (recentAs.has(a) ? RECENT_DAMPING : 1)
        * (oldNeighbours.has(a) ? NEIGHBOUR_DAMPING : 1) * (learn ? 0.4 + unseenShare(a) : 1));
      while (chosen.length < 4) {
        const k = pick(rest, weights, rng);
        chosen.push(rest[k]); rest.splice(k, 1); weights.splice(k, 1);
      }
      // A tile must never be the name of another crate on the board.
      const banned = blocker(chosen);
      const groups = [];
      for (const a of chosen) {
        const mult = i => learnWeight(learn, a, i) * (recentWs.has(wordKey(a, i)) ? RECENT_DAMPING : 1);
        const review = reviews.find(r => r.a === a);
        let w;
        if (review) {
          // two missed words at a time (three when many are waiting), so there are always new companions
          const due = review.list.slice(0, plan.backlog >= 10 ? 3 : 2);
          const oldMates = new Set(due.flatMap(x => learn.cards[x.key].m || []));
          w = sampleWords(a, settings, banned, rng, {
            forced: due.map(x => x.i), mult: i => mult(i) * (oldMates.has(cardKey(a, i)) ? MATE_DAMPING : 1),
          });
        } else {
          w = sampleWords(a, settings, banned, rng, { mult });
        }
        if (!w) break;
        w.forEach(i => banned.add(norm(BANK[a].words[i].w)));
        groups.push({ a, w });
      }
      if (groups.length < 4) continue;
      const herrings = groups.reduce((s, g) => s + g.w.filter(i => BANK[g.a].words[i].alt.some(x => chosen.includes(x))).length, 0);
      if (herrings > MAX_HERRINGS) continue;
      if (!groups.every(namesOne) || countSolutions(groups) !== 1) continue;
      return { cat, groups: withLevels(groups) };
    }
  }
  return learn ? generate({ pool, settings, recentA, recentW, rng }) : null;
}

// ---------- hidden mode: each player holds eight of the sixteen ----------
/** How many of each crate's four words the first player holds: 1-3 each, eight in total. */
const SPLITS = [];
for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++) for (let c = 1; c <= 3; c++) {
  const d = 8 - a - b - c;
  if (d >= 1 && d <= 3) SPLITS.push([a, b, c, d]);
}

/**
 * Every crate takes 1-3 words from each side, each side drawn with that player's own topics and
 * difficulty; which answers can appear (pool, regions, sectors) is shared. Returns the board plus
 * sides[g][k] = 0 or 1, the player slot holding each word.
 */
export function generateSplit({ pool, sides, off = [], recentA = [], rng = Math.random }) {
  const recentAs = new Set(recentA);
  const settings = sides.map(s => ({ ...s, off }));
  const cats = pool === "mixed" ? shuffled(["country", "commodity"], rng) : [pool];
  for (const cat of cats) {
    const answers = BANK.map((a, i) => i).filter(i => BANK[i].cat === cat && !off.includes(BANK[i].group)
      && settings.every(s => BANK[i].words.filter(w => wordWeight(w, s) > 0).length >= 3));
    if (answers.length < 4) continue;
    for (let attempt = 0; attempt < 400; attempt++) {
      const chosen = [], rest = answers.slice(), weights = rest.map(a => (recentAs.has(a) ? RECENT_DAMPING : 1));
      while (chosen.length < 4) {
        const k = pick(rest, weights, rng);
        chosen.push(rest[k]); rest.splice(k, 1); weights.splice(k, 1);
      }
      const split = SPLITS[Math.floor(rng() * SPLITS.length)];
      const banned = blocker(chosen);
      const groups = [], owners = [];
      for (const [n, a] of chosen.entries()) {
        const w = [], who = [];
        for (const [slot, count] of [[0, split[n]], [1, 4 - split[n]]]) {
          const got = sampleWords(a, settings[slot], banned, rng, { count });
          if (!got) break;
          got.forEach(i => { banned.add(norm(BANK[a].words[i].w)); w.push(i); who.push(slot); });
        }
        if (w.length < 4) break;
        groups.push({ a, w });
        owners.push(who);
      }
      if (groups.length < 4) continue;
      const herrings = groups.reduce((s, g) => s + g.w.filter(i => BANK[g.a].words[i].alt.some(x => chosen.includes(x))).length, 0);
      if (herrings > MAX_HERRINGS || !groups.every(namesOne) || countSolutions(groups) !== 1) continue;
      return { cat, groups: withLevels(groups), sides: owners };
    }
  }
  return null;
}

// ---------- board codes: "a.w.w.w.w-…" in base36, positions in the append-only bank ----------
export const encode = board => board.groups.map(g => [g.a, ...g.w].map(n => n.toString(36)).join(".")).join("-");

export function decode(code) {
  try {
    const groups = String(code).trim().toLowerCase().split("-").map(part => {
      const [a, ...w] = part.split(".").map(x => parseInt(x, 36));
      return { a, w };
    });
    if (groups.length !== 4) return null;
    const cat = BANK[groups[0].a]?.cat;
    const seen = new Set(), answers = new Set();
    for (const g of groups) {
      const ans = BANK[g.a];
      if (!ans || ans.cat !== cat || answers.has(g.a) || g.w.length !== 4) return null;
      answers.add(g.a);
      for (const i of g.w) {
        const word = ans.words[i];
        if (!word || seen.has(norm(word.w))) return null;
        seen.add(norm(word.w));
      }
    }
    return { cat, groups: withLevels(groups) };
  } catch { return null; }
}

/** What the page needs to show about each crate. */
export function describe(board) {
  const answers = board.groups.map(g => g.a);
  return board.groups.map(g => {
    const ans = BANK[g.a];
    const words = g.w.map(i => ans.words[i]);
    return {
      answer: ans.name, aliases: ans.aliases, level: g.level,
      words: words.map(x => x.w),
      details: words.map(x => [x.w, x.hint]),
      herrings: words.flatMap(x => x.alt.filter(a => answers.includes(a) && a !== g.a).map(a => `${x.w} also fits ${BANK[a].name}`)),
    };
  });
}

export const hintFor = (board, word) => {
  for (const g of board.groups) for (const i of g.w) if (BANK[g.a].words[i].w === word) return BANK[g.a].words[i].hint;
  return "";
};
export const groupIndexOf = (board, word) => board.groups.findIndex(g => g.w.some(i => BANK[g.a].words[i].w === word));

/** right = all four in one crate; one = three of four; miss = anything else. */
export function classify(board, words) {
  const counts = {};
  words.forEach(w => { const g = groupIndexOf(board, w); counts[g] = (counts[g] || 0) + 1; });
  const best = Math.max(...Object.values(counts));
  return {
    res: best === 4 ? "right" : best === 3 ? "one" : "miss",
    g: best === 4 ? Number(Object.keys(counts)[0]) : null,
    lv: words.map(w => board.groups[groupIndexOf(board, w)].level),
  };
}
