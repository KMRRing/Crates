// The universality score of one thing, from the signals the pilot could obtain. Pure: numbers in, numbers out.
// Why each signal and weight is in docs/universal-knowledge.md ("The score"); change the weights there and here together.
//
//   curated   two communities' own judgement: English Vital Articles level (1 and 2 = 1, 3 = .85, 4 = .55, 5 = .30, else 0)
//             and Meta-Wiki's list across languages (1,000 = .85, 10,000 = .55); the better one plus a tenth of the other
//   spread    how many language editions have an article, log-scaled so 250 editions = 1 and one edition = 0
//   attention the MEDIAN across the sampled editions of how high readers rank the article (rank 1 = 1, rank 100,000 = 0;
//             an edition with no article or under the readers' floor counts 0): the median, so a spike in one language
//             or one country's celebrity does not lift it; it must be read in more than half the editions to count at all
//   taught    (not in the pilot) the share of the sampled education systems whose syllabus names it; until measured, its
//             weight is shared out over the others in proportion
export const WEIGHTS = { curated: 0.40, spread: 0.30, attention: 0.30, taught: 0 };
export const WEIGHTS_WITH_EDUCATION = { curated: 0.30, spread: 0.25, attention: 0.25, taught: 0.20 };

/** Vital Articles level → points. Level 1 and 2 are the hundred things a school-leaver anywhere names. */
export const CURATED = { 1: 1, 2: 1, 3: 0.85, 4: 0.55, 5: 0.30 };
/** Meta-Wiki's "every Wikipedia should have": M1 is its 1,000, M2 its 10,000 (worth what level 3 and level 4 are). */
export const CURATED_META = { M1: 0.85, M2: 0.55 };
/** Two independent communities' lists: the better of the two, and a tenth of the other for the agreement. */
export const curated = (vital, meta) => {
  const v = vital ? CURATED[vital] ?? 0 : 0, m = meta ? CURATED_META[meta] ?? 0 : 0;
  return Math.min(1, Math.max(v, m) + 0.1 * Math.min(v, m));
};

export const spread = languages => languages <= 1 ? 0 : Math.min(1, Math.log(languages) / Math.log(250));

/** Rank (1 = most read) → 0..1 on a log scale: rank 1 → 1, rank 10^5 → 0. */
export const rankPoints = rank => rank == null ? 0 : Math.max(0, Math.min(1, 1 - Math.log10(rank) / 5));

export function median(list) {
  const a = [...list].sort((x, y) => x - y), n = a.length;
  return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0;
}

/**
 * @param {{ vital: number|null, meta?: "M1"|"M2"|null, languages: number, ranks: Array<number|null>, taught?: number|null }} s
 *   ranks: one entry per sampled edition, the article's rank in that edition's month (null = not read enough to rank)
 * @returns {{ u: number, curated: number, spread: number, attention: number, editions: number }}
 */
export function score(s, weights = s.taught == null ? WEIGHTS : WEIGHTS_WITH_EDUCATION) {
  const cur = curated(s.vital, s.meta);
  const sp = spread(s.languages);
  const points = s.ranks.map(rankPoints);
  const attention = median(points);
  const editions = s.ranks.filter(r => r != null).length;
  const u = weights.curated * cur + weights.spread * sp + weights.attention * attention + (weights.taught || 0) * (s.taught ?? 0);
  return { u, curated: cur, spread: sp, attention, editions };
}

/**
 * The tier, which the floor rule decides, not the score alone (a high score from attention alone is never core):
 *   core  in the Vital Articles at level 3 or better, or in 150+ editions and read in 8+ of the sampled ones
 *   wide  Vital level 4, or u at least .35 with 100+ editions
 *   deep  Vital level 5, or u at least .20 with 40+ editions, or read in 4+ editions
 *   thin  has an article, nothing above: where trade and other specialist words land
 */
export function tier(s, sc) {
  if ((s.vital && s.vital <= 3) || s.meta === "M1") return "core";
  if (s.languages >= 150 && sc.editions >= 8) return "core";
  if (s.vital === 4 || s.meta === "M2" || (sc.u >= 0.35 && s.languages >= 100)) return "wide";
  if (s.vital === 5 || (sc.u >= 0.20 && s.languages >= 40) || sc.editions >= 4) return "deep";
  return "thin";
}

/** Spearman rank correlation of two equal-length lists (ties get their average rank). */
export function spearman(x, y) {
  const rank = v => { const idx = v.map((_, i) => i).sort((a, b) => v[a] - v[b]); const r = new Array(v.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++; for (let k = i; k <= j; k++) r[idx[k]] = (i + j) / 2; i = j + 1; } return r; };
  const a = rank(x), b = rank(y), n = x.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
}
