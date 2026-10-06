// Typed answers: whether what someone typed is the right one. Recall, not recognition: nothing is offered to pick
// from, so what's checked is the thing itself, not its typing. Case, accents, punctuation, spacing, a leading article
// and a part in brackets ("Krone (currency)") don't matter; tone numbers typed after pinyin don't either; and a slip
// of a letter in an answer of five letters or more (two from nine) still counts, with the right spelling shown.
// Shared by Punt's name-it questions and Parley's typed words.

// letters that are typed as others on most keyboards (and don't fall apart into a letter and an accent)
const LETTERS = { ß: "ss", æ: "ae", œ: "oe", ø: "o", ł: "l", đ: "d" };
const ARTICLE = /^(the|a|an|le|la|les|l|un|une|der|die|das|ein|eine|el|los|las|il|lo|gli)\s+/;

/** The form two answers are compared in: lower case, no accents or punctuation, no leading article, single spaces. */
export function normalize(s) {
  return String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[ßæœøłđ]/g, c => LETTERS[c]).replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(ARTICLE, "").replace(/\s+/g, " ");
}

/** How many single-letter edits (insert, delete, change, or swap of neighbours) turn a into b. */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}

/**
 * Whether `typed` is one of the accepted answers: { right, exact, answer } (answer: the accepted form it matched, to
 * show its spelling). exact is false when it was accepted with a slip.
 */
export function check(typed, accepted) {
  const t = normalize(typed);
  if (!t) return { right: false, exact: false, answer: accepted[0] };
  const forms = accepted.flatMap(a => [a, String(a).replace(/\s*\([^)]*\)/g, "")]).map(a => ({ a, n: normalize(a) })).filter(f => f.n);
  const bare = s => s.replace(/ /g, "");
  for (const f of forms) {
    const tt = /\d/.test(f.n) ? t : t.replace(/\d/g, "").trim();     // ni3 hao3 is ni hao, unless the answer has numbers
    if (tt === f.n || bare(tt) === bare(f.n)) return { right: true, exact: true, answer: f.a };
  }
  const slack = n => (n >= 9 ? 2 : n >= 5 ? 1 : 0);
  for (const f of forms) if (distance(bare(t), bare(f.n)) <= slack(bare(f.n).length)) return { right: true, exact: false, answer: f.a };
  return { right: false, exact: false, answer: accepted[0] };
}
