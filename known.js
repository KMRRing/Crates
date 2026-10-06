// What you've shown you know one way round, so it can be asked the other. A clue you've matched to its country or
// commodity (a crate solved and named in Crates, or a right answer you staked on in one of Punt's clue or answer
// questions) becomes one that Punt's name-it questions can give you, as its hint, to name. Kept on this device, like
// the review pile, and keyed by the knowledge base's entities, so it outlives changes to the bank.
const KEY = "known:pairs";
let pairs = null;
const load = () => { if (!pairs) { try { pairs = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { pairs = {}; } } return pairs; };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pairs)); } catch { /* private mode */ } };

/** A clue of an answer, as their entities. */
export const pairKey = (answerEntity, clueEntity) => `${answerEntity}>${clueEntity}`;

/** Notes clues recognised, by pairKey. */
export function recognised(keys) {
  const all = load(), now = Date.now();
  let changed = false;
  for (const k of keys) if (k && !all[k]) { all[k] = { at: now }; changed = true; }
  if (changed) save();
}

/** Notes how naming a clue went: right, it's named (and comes round later than those not named yet); wrong, it isn't. */
export function named(key, right) {
  const all = load();
  all[key] ||= { at: Date.now() };
  if (right) all[key].named = Date.now(); else delete all[key].named;
  save();
}

/** Every clue recognised: { key: { at, named } }. */
export const all = () => ({ ...load() });
