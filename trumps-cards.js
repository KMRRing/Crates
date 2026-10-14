// Trumps' cards: one numbering for every pack (a card is its suit × 9 + its rank, the ranks 6 to ace), and each pack's
// suits and names: the Swiss pack Jass is played with in German-speaking Switzerland (bells, shields, roses, acorns),
// the German pack of Schafkopf (bells, hearts, leaves, acorns), the French of Belote and of Jass in Romandy. Which of
// the four suits a pack calls what is fixed per game (trumps-games.js), so a card id means the same card everywhere.
export const RANKS = ["6", "7", "8", "9", "T", "J", "Q", "K", "A"];
export const cid = (s, r) => s * 9 + RANKS.indexOf(r);
export const suitOf = id => Math.floor(id / 9);
export const rankOf = id => RANKS[id % 9];
/** A pack of cards from a lowest rank up: 36 from the six (Jass), 32 from the seven (Belote, Schafkopf). */
export const deckFrom = low => Array.from({ length: 4 }, (_, s) => RANKS.slice(RANKS.indexOf(low)).map(r => cid(s, r))).flat();

/**
 * The packs: each suit's name (in the pack's language and in English), its mark for French cards, and what each rank is
 * called and lettered. The court cards of the Swiss and German packs are the Under (U), the Ober (O) and the King; the
 * ten of the Swiss pack is the Banner.
 */
export const PACKS = {
  swiss: { suits: ["Schellen", "Schilten", "Rosen", "Eicheln"], en: ["bells", "shields", "roses", "acorns"],
    rank: { 6: "6", 7: "7", 8: "8", 9: "9", T: "10", J: "U", Q: "O", K: "K", A: "A" }, names: { T: "Banner", J: "Under", Q: "Ober", K: "König", A: "Ass" } },
  german: { suits: ["Schellen", "Herz", "Gras", "Eichel"], en: ["bells", "hearts", "leaves", "acorns"],
    rank: { 6: "6", 7: "7", 8: "8", 9: "9", T: "10", J: "U", Q: "O", K: "K", A: "A" }, names: { T: "Zehner", J: "Unter", Q: "Ober", K: "König", A: "Sau" } },
  // French: the suit index in cards.js's order (♦ ♣ ♥ ♠) is the card's suit itself
  french: { suits: ["♦", "♣", "♥", "♠"], en: ["diamonds", "clubs", "hearts", "spades"],
    rank: { 6: "6", 7: "7", 8: "8", 9: "9", T: "10", J: "J", Q: "Q", K: "K", A: "A" }, names: { T: "ten", J: "jack", Q: "queen", K: "king", A: "ace" } },
};
/** How a Jass suit (bells, shields, roses, acorns) is drawn in the French pack: ♦, ♠, ♥, ♣. */
export const JASS_FRENCH = [0, 3, 2, 1];
/** A card's name in words, for a screen reader and the log: "Under of acorns", "10 of hearts". */
export function cardName(id, pack, suitMap = null) {
  const p = PACKS[pack], r = rankOf(id), s = suitMap ? suitMap[suitOf(id)] : suitOf(id);
  const rank = pack === "french" ? (p.names[r] || r) : (p.names[r] || r);
  return `${rank} of ${p.en[s]}`;
}
