// Which English Wikipedia titles might a kb/ thing be? Ordered guesses, best first: the name itself, the name with the
// kind's usual disambiguator ("Mona Lisa" is itself, "Java" needs "(programming language)"), a bare name without "The".
// A guess counts only if the page exists and is not a disambiguation page (kb-universal-resolve.mjs says which).
// Titles are returned underscored and with the first letter capitalised, as Wikipedia stores them.

const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const us = s => cap(s.trim().replace(/\s+/g, "_"));

/** What a set usually needs after the name when the bare name is taken by something else. */
const HINT = {
  "kind:company": ["company", "brand"], "kind:film": ["film"], "kind:book": ["novel", "book"], "kind:music": ["song", "album", "music"],
  "kind:tv": ["TV series"], "kind:video game": ["video game"], painting: ["painting"], "kind:food": ["food", "dish"], "kind:drink": ["drink"],
  "kind:sport": ["sport"], "kind:animal": ["animal"], "kind:plant": ["plant"], "kind:game": ["game"], "kind:tech": ["technology"],
  "kind:material": ["material"], "kind:law": ["law"], "kind:event": ["event"], "kind:disease": ["disease"], "kind:currency": ["currency"],
  "kind:organisation": ["organization"], "kind:market": ["market"], "kind:craft": ["clothing"], "kind:art": ["art"], "work": ["poem", "novel", "play"],
  "kind:person": ["person"], "kind:place": ["city", "town"], "kind:site": ["building"],
};

/** @param {{ name: string, qualifier?: string, set: string, sets: string[] }} row */
export function variantsOf(row) {
  const name = row.name.trim();
  const bare = name.replace(/^The\s+/i, "");
  const out = [];
  const add = t => { if (t && !out.includes(t)) out.push(t); };
  if (row.qualifier) add(us(`${bare} (${row.qualifier})`));
  add(us(name));
  add(us(bare));
  // sentence case: "Duffle Coat" is "Duffle coat" on Wikipedia; keep it as a later guess so proper names are tried as written first
  if (/[A-Z]/.test(bare.slice(1))) add(us(bare[0] + bare.slice(1).toLowerCase()));
  for (const s of [row.set, ...row.sets]) for (const h of HINT[s] || []) { add(us(`${bare} (${h})`)); }
  return out;
}
