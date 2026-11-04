// Cue's library, put together: every card of every category as one list (LIB), so a deck can keep a card as a number.
// The data is in cue-lib-talk.js, cue-lib-play.js and cue-words.js; this reads it and nothing else. Pure.
import { TALK } from "./cue-lib-talk.js";
import { PLAY } from "./cue-lib-play.js";
import { KINDS } from "./cue-words.js";

/** Who is playing, as the party's menu names it: each level takes the cards of the ones before it. */
export const LEVELS = [["0", "Kids and family"], ["1", "Work-safe"], ["2", "Friends"]];

const WORDS = {
  id: "words", name: "Words to act or draw", one: "Word", guess: "Act it, draw it or describe it, without saying it, until they get it.",
  ask: "Act it, draw it or describe it, without saying it. The others guess.", x: "Act it, draw it or describe it, and the others guess.",
};
/** The categories, in the order the menu lists them. */
export const CATS = [...TALK, ...PLAY.slice(0, 1), WORDS, ...PLAY.slice(1)].map(c => ({ ...c, lead: c.lead || "", tail: c.tail || "" }));
export const catOf = id => CATS.find(c => c.id === id) || null;

/** Every card: { cat, lvl (0 kids, 1 work, 2 friends), t (what it says), o (what the player dealt a different cue sees,
 *  or null: another card of the category then), kind (words only) }. Appending is safe, reordering would change decks. */
export const LIB = [];
for (const c of CATS) {
  if (c.id === "words") {
    for (const k of KINDS) for (const w of k.words) LIB.push({ cat: c.id, lvl: 0, t: w, o: null, kind: k.id });
    continue;
  }
  [c.kids, c.work, c.friends].forEach((list, lvl) => {
    for (const raw of list) {
      const [main, twin] = raw.split("|");
      LIB.push({ cat: c.id, lvl, t: c.lead + main + c.tail, o: twin ? c.lead + twin + c.tail : null });
    }
  });
}
const byCat = new Map(CATS.map(c => [c.id, []]));
LIB.forEach((card, i) => byCat.get(card.cat).push(i));

/** The cards a game can deal, as numbers in LIB: the category ("mix" is every one), up to the level, and, when the
 *  player whose turn it is sees nothing (`blind`), only those that can be worked out from what the others say. */
export function pool(cat = "mix", level = 2, blind = false) {
  const cats = cat === "mix" ? CATS : CATS.filter(c => c.id === cat);
  return cats.filter(c => !blind || c.guess).flatMap(c => byCat.get(c.id).filter(i => LIB[i].lvl <= level));
}

/** What the player dealt a different cue sees for a card: its twin, else another card of the same category (and kind
 *  of word) within the level, never the same text. `rnd`: a random number from 0 up to 1. */
export function oddFor(index, level = 2, rnd = Math.random) {
  const card = LIB[index];
  if (card.o) return card.o;
  const others = byCat.get(card.cat).filter(i => i !== index && LIB[i].lvl <= level && LIB[i].t !== card.t && (!card.kind || LIB[i].kind === card.kind));
  return LIB[others[Math.floor(rnd() * others.length) % others.length]].t;
}

/** The card as a person reads it: its kind over it for a word, the category's name for the rest. */
export const kindOf = card => (card.kind ? KINDS.find(k => k.id === card.kind)?.one || "" : catOf(card.cat)?.one || "");
