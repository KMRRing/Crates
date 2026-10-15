// Schafkopf's Bavarian pack, drawn (trumps-deck.js): every card of the 32 and the back an SVG of the table's cards'
// shape, well formed (each tag closed where it was opened), every number in it a number, each card its own picture
// and small; both ends alike (the upper half shown again turned about the centre), the rank and the Farbe's mark in
// the corners, where a fanned hand shows them, and a court's great mark where the pack puts it (high beside an Ober's
// or a König's head, lower on an Unter); and the addresses the page uses, one a card and the back's, each the card's
// picture again.
import { cardSvg, backSvg, deckPics, DECK_IDS } from "../trumps-deck.js";
import { suitOf, rankOf } from "../trumps-cards.js";
import { cardWords } from "../trumps-course.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
/** Whether every tag is closed where it was opened. */
function wellFormed(text) {
  const open = [];
  for (const [, close, name, , self] of text.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    if (self) continue;
    if (!close) open.push(name);
    else if (open.pop() !== name) return false;
  }
  return !open.length;
}
const names = ids => ids.map(id => cardWords(id)).join(", ");

const svgs = new Map(DECK_IDS.map(id => [id, cardSvg(id)]));
check(DECK_IDS.length === 32 && new Set(DECK_IDS.map(id => `${suitOf(id)}${rankOf(id)}`)).size === 32 && DECK_IDS.every(id => rankOf(id) !== "6"), "the 32 cards: four Farben, the 7 to the Sau");
const shape = [...svgs.values(), backSvg()].every(t => t.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350"'));
check(shape, "each a picture 250 by 350, the table's cards' shape");
const broken = DECK_IDS.filter(id => !wellFormed(svgs.get(id)));
check(!broken.length && wellFormed(backSvg()), `every one well formed${broken.length ? `: not ${names(broken)}` : ""}`);
const nan = DECK_IDS.filter(id => /NaN|undefined|Infinity/.test(svgs.get(id)));
check(!nan.length, `every number in them a number${nan.length ? `: not in ${names(nan)}` : ""}`);
check(new Set(svgs.values()).size === 32, "each card a picture of its own");
// a card's ids are its own: each defined once (a clip or a part drawn twice under one id would hide the other)
const twice = DECK_IDS.filter(id => { const ids = [...svgs.get(id).matchAll(/ id="([^"]+)"/g)].map(m => m[1]); return new Set(ids).size !== ids.length; });
check(!twice.length, `every id in a card defined once${twice.length ? `: not in ${names(twice)}` : ""}`);
const sizes = [...svgs.values()].map(t => t.length), most = Math.max(...sizes);
check(most < 30000, `small: the largest ${(most / 1024).toFixed(1)} KB, all ${(sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KB`);
const ends = DECK_IDS.filter(id => !svgs.get(id).includes('<use href="#t" transform="rotate(180 125 175)"/>'));
check(!ends.length, `both ends alike, the upper half shown again turned${ends.length ? `: not ${names(ends)}` : ""}`);
// the corners: the rank (U, O, K, A or the number) over a small mark, top left and top right (and so, turned, below)
const LETTER = { J: "U", Q: "O", K: "K", A: "A", T: "10" };
const marks = t => [...t.matchAll(/<g transform="translate\(([\d.]+) ([\d.]+)\)(?: rotate\([^)]*\))?(?: scale\(([\d.]+)\))?" stroke="#221E1B" stroke-width="1.2"/g)].map(m => ({ x: +m[1], y: +m[2], s: m[3] ? +m[3] : 1 }));
const corners = DECK_IDS.filter(id => {
  const t = svgs.get(id), idx = t.slice(t.indexOf('<g id="i">')), small = marks(idx).filter(m => m.s === 0.25);
  return !idx.includes(`>${LETTER[rankOf(id)] || rankOf(id)}</text>`) || small.length !== 2 || !small.some(m => m.x === 14) || !small.some(m => m.x === 236);
});
check(!corners.length, `the rank and the Farbe's mark in the corners${corners.length ? `: not on ${names(corners)}` : ""}`);
const courts = DECK_IDS.filter(id => ["Q", "J", "K"].includes(rankOf(id)));
const placed = courts.filter(id => { const big = marks(svgs.get(id)).filter(m => m.s >= 1); return big.length === 1 && (rankOf(id) === "J" ? big[0].y > 100 : big[0].y < 80) && big[0].x < 80; });
check(placed.length === courts.length, `the great mark high beside an Ober's or a König's head, lower on an Unter${placed.length < courts.length ? `: not on ${names(courts.filter(id => !placed.includes(id)))}` : ""}`);
const pics = deckPics();
check(DECK_IDS.every(id => typeof pics[id] === "string" && decodeURIComponent(pics[id].split(",")[1]) === svgs.get(id)) && decodeURIComponent(pics.back.split(",")[1]) === backSvg(), "the addresses: each card's own picture, and the back's");

console.log(bad ? `trumps-deck: ${bad} failed` : "trumps-deck: every check passed");
process.exit(bad ? 1 : 0);
