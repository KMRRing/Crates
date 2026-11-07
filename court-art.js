// The court cards of the suite's ordinary 52-card pack: twelve double-ended figures (a king, a queen and a jack of each suit) in the old
// English pattern, public-domain vector art (Byron Knoll's "vector-playing-cards", released into the public domain; the collection and
// its tooling by Peter Tripp and Mark Seminatore, public domain or WTFPL; see docs/licences-images-and-engines.md). The files in court/
// are those drawings cropped to the inside of the card's frame (the corner indices are the games' own), their numbers rounded to a
// tenth, and their blues, greens and olives folded into the suite's four colours: black, red, yellow, white (Korbi, 7 Nov 2026).
// Used wherever the ordinary pack is drawn (cards.js, Guandan's 3D cards).
// courtArt("K" | "Q" | "J", "♠" | "♥" | "♦" | "♣") → the markup of the card's middle.
const FILE = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
export const courtFile = (rank, glyph) => `./court/${rank}${FILE[glyph]}.svg`;
export const courtArt = (rank, glyph) => `<img class="court-art" src="${courtFile(rank, glyph)}" alt="" draggable="false" decoding="async">`;
