// Schafkopf's Bavarian pack, drawn (trumps-deck.js): every card of the 32 and the back an SVG of the table's cards'
// shape, well formed (each tag closed where it was opened), every number in it a number, each card its own picture
// and small; the Farbe's mark where a fanned hand shows it (top left on the Obers and Könige, bottom left on the
// Unters); and the addresses the page uses, one a card and the back's, each the card's picture again.
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

const svgs = new Map(DECK_IDS.map(id => [id, cardSvg(id)]));
check(DECK_IDS.length === 32 && new Set(DECK_IDS.map(id => `${suitOf(id)}${rankOf(id)}`)).size === 32 && DECK_IDS.every(id => rankOf(id) !== "6"), "the 32 cards: four Farben, the 7 to the Sau");
const shape = [...svgs.values(), backSvg()].every(t => t.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350"'));
check(shape, "each a picture 250 by 350, the table's cards' shape");
const broken = [...svgs].filter(([, t]) => !wellFormed(t)).map(([id]) => cardWords(id));
check(!broken.length && wellFormed(backSvg()), `every one well formed${broken.length ? `: not ${broken.join(", ")}` : ""}`);
const nan = [...svgs].filter(([, t]) => /NaN|undefined|Infinity/.test(t)).map(([id]) => cardWords(id));
check(!nan.length, `every number in them a number${nan.length ? `: not in ${nan.join(", ")}` : ""}`);
check(new Set(svgs.values()).size === 32, "each card a picture of its own");
const sizes = [...svgs.values()].map(t => t.length), most = Math.max(...sizes);
check(most < 26000, `small: the largest ${(most / 1024).toFixed(1)} KB, all ${(sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KB`);
const at = (id, where) => svgs.get(id).includes(`translate(44 ${where})`);
const courts = DECK_IDS.filter(id => ["Q", "J", "K"].includes(rankOf(id)));
check(courts.every(id => at(id, rankOf(id) === "J" ? 298 : 52)), "the mark top left on the Obers and Könige, bottom left on the Unters");
const pics = deckPics();
check(DECK_IDS.every(id => typeof pics[id] === "string" && decodeURIComponent(pics[id].split(",")[1]) === svgs.get(id)) && decodeURIComponent(pics.back.split(",")[1]) === backSvg(), "the addresses: each card's own picture, and the back's");

console.log(bad ? `trumps-deck: ${bad} failed` : "trumps-deck: every check passed");
process.exit(bad ? 1 : 0);
