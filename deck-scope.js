// What Deck covers (README, Deck, "Scope"): the games and the topics a review draws from. The games screen's Deck button and
// Deck's own review both ask it, so a card out of scope is neither counted as due nor dealt. Pure rules, tested in Node
// (tests/deck-scope.mjs); deck-row.js is the page's side and keeps the choice on this device (suite:deck).
//
// The choice is kept as what's taken OUT, as Random's is: a game or a topic that arrives later is covered, as everything is
// at first. A topic is a subject of the knowledge base (kb-index.js: Countries, Paintings, Law…), named by its label, which
// outlives a rebuild of the base where its number does not.
//
// A card is covered when its game is in and, if it is about things the knowledge base knows, at least one of them has a
// subject that is in. One of a card's subjects being out doesn't take it out while another is in: Mona Lisa is a Painting
// and Leonardo a Painter, and a card about both is still asked when only one of those is covered. A card about nothing in
// the base (a word, a puzzle, a number) follows its game alone.

/** A game or a topic, as kept: the ones taken out, by id (a game) or label (a topic), without duplicates. */
const idsOf = v => [...new Set((Array.isArray(v) ? v : []).filter(x => typeof x === "string" && x))];

/** The scope a device kept (anything unreadable is the whole deck): { games: [out ids], subjects: [out labels] }. */
export function scopeOf(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return { games: idsOf(r.games), subjects: idsOf(r.subjects) };
}
/** What to keep: null when everything is covered (the key goes, so the device is as a new one). */
export function keptScope(scope) {
  const s = scopeOf(scope);
  return s.games.length || s.subjects.length ? s : null;
}
/** Everything covered. */
export const whole = scope => !scopeOf(scope).games.length && !scopeOf(scope).subjects.length;

/**
 * Whether a pile item is covered. `subjectOf(entity)` gives an entity's subject label or undefined; it can be left out
 * (null) when no topic is out, and an item is then judged by its game alone.
 */
export function covers(scope, item, subjectOf = null) {
  const s = scopeOf(scope);
  if (s.games.includes(item.game)) return false;
  if (!s.subjects.length || !subjectOf || !item.about?.length) return true;
  const labels = item.about.map(subjectOf).filter(Boolean);
  return !labels.length || labels.some(l => !s.subjects.includes(l));
}
/** The items a scope covers, in their order. */
export const inScope = (items, scope, subjectOf = null) => items.filter(it => covers(scope, it, subjectOf));

/** The topics a scope can be set on: those the pile has something about, and any already out (so none is stuck out
 *  unseen), in the order of `labels` (the base's own). */
export function topicsOf(items, labels, scope, subjectOf) {
  const seen = new Set(scopeOf(scope).subjects);
  for (const it of items) for (const id of it.about || []) { const l = subjectOf(id); if (l) seen.add(l); }
  return labels.filter(l => seen.has(l));
}
/** A game or topic taken out or put back: the scope with `out` of `kind` ("games" | "subjects") now the given list. */
export function withOut(scope, kind, out) {
  return { ...scopeOf(scope), [kind]: idsOf(out) };
}
/** The scope after the ticks of one kind change: `all` is every id on offer for the kind, `ticked` the ones covered.
 *  Ids not on offer (a game that has left the list) keep whatever they were. */
export function afterTicks(scope, kind, all, ticked) {
  const kept = scopeOf(scope)[kind].filter(x => !all.includes(x));
  return withOut(scope, kind, [...kept, ...all.filter(x => !ticked.includes(x))]);
}
/** In words, for the sheet's status line. */
export function sayScope(scope) {
  const s = scopeOf(scope), n = (k, one, many) => k ? `${k} ${k === 1 ? one : many}` : "";
  const out = [n(s.games.length, "game", "games"), n(s.subjects.length, "topic", "topics")].filter(Boolean);
  return out.length ? `Left out: ${out.join(" and ")}.` : "Everything: every game and every topic.";
}
