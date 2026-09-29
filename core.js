// Puzzle data and the rules shared by solo and together play.
export const PUZZLES = JSON.parse(new TextDecoder().decode(
  Uint8Array.from(atob(window.CRATES_DATA), c => c.charCodeAt(0))));

export const NOUN = { country: "country", commodity: "commodity" };
export const PLURAL = { country: "Countries", commodity: "Commodities" };
export const SQUARES = ["🟨", "🟩", "🟦", "🟥"];

/** "countries" / "commodity" / "mixed" (any casing or plural) → pool id, else null. */
export function parsePool(s) {
  s = String(s || "").trim().toLowerCase();
  if (s.startsWith("countr")) return "country";
  if (s.startsWith("commod")) return "commodity";
  if (/^(mix|all|both)/.test(s)) return "mixed";
  return null;
}
export const POOL_PARAM = { country: "countries", commodity: "commodities", mixed: "mixed" };
export const inPool = (i, pool) => pool === "mixed" || PUZZLES[i].category === pool;
export const poolIndices = pool => PUZZLES.map((_, i) => i).filter(i => inPool(i, pool));

export const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, "");

function editDistance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/** Accepts the answer or an alias, allowing a typo or two on longer names. */
export function nameMatches(guess, group) {
  const g = norm(guess || "");
  if (!g) return false;
  return [group.answer, ...group.aliases].map(norm).some(a => {
    if (a === g) return true;
    const slack = a.length >= 9 ? 2 : a.length >= 5 ? 1 : 0;
    return editDistance(a, g) <= slack;
  });
}

export function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const groupOf = (p, w) => p.groups.findIndex(gr => gr.words.includes(w));
export const clueFor = (p, w) => { const gr = p.groups[groupOf(p, w)]; return gr.clues[gr.words.indexOf(w)]; };
export const wordsKey = words => words.slice().sort().join("|");

/** right = all four in one crate; one = three of four; miss = anything else. */
export function classify(p, words) {
  const counts = {};
  words.forEach(w => { const g = groupOf(p, w); counts[g] = (counts[g] || 0) + 1; });
  const best = Math.max(...Object.values(counts));
  const g = best === 4 ? Number(Object.keys(counts)[0]) : null;
  return {
    res: best === 4 ? "right" : best === 3 ? "one" : "miss",
    g,
    lv: words.map(w => p.groups[groupOf(p, w)].level),
  };
}
export const RESULT_LABEL = { right: "Right", one: "One away", miss: "Miss" };

/** Realtime Database drops empty arrays and may hand arrays back as keyed objects. */
export function arr(x) {
  if (Array.isArray(x)) return x.filter(v => v != null);
  if (x && typeof x === "object") return Object.keys(x).sort((a, b) => a - b).map(k => x[k]).filter(v => v != null);
  return [];
}
