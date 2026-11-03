// Tarot's cards as markup: the four suits as cards.js draws them (ivory, rank and suit in the corner) with J, C, Q, K for
// the jack (valet), knight (cavalier), queen (dame) and king (roi), and the twenty-one trumps and the Excuse drawn here:
// a numeral in the corner, a small engraved motif in the middle and the Roman numeral at the foot, in an enamel by
// the fives (the cards' own art, drawn for this game: not copied from any deck). Suits differ by shape as well as colour;
// the menu's four-colour option tints them apart. Sizes are cards.css's: the card's font size.
import { cardHtml } from "./cards.js";
import { EXCUSE, suitOf, rankOf, RANK_MARKS, cardName } from "./tarot-rules.js";

const SUIT_OF_CARDS_JS = [3, 2, 0, 1];                              // ♠ ♥ ♦ ♣ in cards.js's order (♦ ♣ ♥ ♠)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];

// a motif per trump, in a 24 × 24 box, strokes only
const ART = [
  "",
  `<ellipse cx="12" cy="6.5" rx="7" ry="2"/><path d="M8.5 6.5c0-3.4 7-3.4 7 0"/><path d="M4 14h16M6.5 14v6M17.5 14v6"/><circle cx="12" cy="11.2" r="1.5"/>`,                // 1 the juggler
  `<path d="M8 9l4-6 4 6z"/><circle cx="12" cy="12" r="2.4"/><rect x="7.5" y="15.5" width="9" height="5.5" rx=".8"/><path d="M12 15.5v5.5"/>`,                                 // 2 the popess: tiara, book
  `<path d="M5.5 11l2.2 3.2L12 7l4.3 7.2 2.2-3.2v5.5h-13z"/><path d="M12 16.5V21M9.5 21h5"/>`,                                                                              // 3 the empress: crown, sceptre
  `<path d="M6.5 8l2.2 2.2L12 5l3.3 5.2L17.5 8v4h-11z"/><circle cx="12" cy="17" r="3.4"/><path d="M12 13.6v6.8M8.6 17h6.8"/>`,                                               // 4 the emperor: crown, orb
  `<path d="M12 3v18M8.5 6.5h7M7 11h10M9 16h6"/>`,                                                                                                                         // 5 the pope: the triple cross
  `<path d="M12 20c-8-5.5-7-12.5-3-12.5 2 0 3 1 3 2.2 0-1.2 1-2.2 3-2.2 4 0 5 7-3 12.5z"/>`,                                                                                // 6 the lovers: a heart
  `<path d="M4.5 8h15M6.5 8V4.5M17.5 8V4.5"/><circle cx="12" cy="15" r="4.6"/><path d="M12 10.4v9.2M7.4 15h9.2"/>`,                                                             // 7 the chariot: a wheel under a canopy
  `<path d="M12 3.5v16M5 6.5h14M8 20.5h8"/><path d="M5 6.5L2.5 13h5zM19 6.5L16.5 13h5z"/>`,                                                                                 // 8 justice: scales
  `<rect x="8.5" y="8.5" width="7" height="7.5" rx="1"/><path d="M12 4.5v4M10 4.5h4M12 16v2M18 5v16M16 6.5h4"/>`,                                                              // 9 the hermit: lantern, staff
  `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7"/>`,                                         // 10 the wheel of fortune
  `<path d="M12 12c-2-4.2-8-4.2-8 0s6 4.2 8 0c2-4.2 8-4.2 8 0s-6 4.2-8 0z"/><path d="M7 6.5c1.5-2 8.5-2 10 0"/>`,                                                             // 11 strength: the lemniscate
  `<path d="M3.5 4h17M12 4v6"/><path d="M12 10l-3.2 5.2M12 10l3.2 5.2"/><circle cx="12" cy="18.8" r="2.2"/>`,                                                                // 12 the hanged man
  `<path d="M8 21L16.2 3.5"/><path d="M16.2 3.5C10 3.2 6 6.5 4.5 12c3.6-3 7.6-4 11.7-3.6"/>`,                                                                                // 13 death: the scythe
  `<path d="M5.5 5h5.5l-1 7H6.5z"/><path d="M13 14h5.5l-1 7h-3.5z"/><path d="M10 12.5c2 .5 3 .5 4.2 1.4"/>`,                                                                  // 14 temperance: the two jugs
  `<path d="M6.5 12.5C4 8.5 5.5 4.5 8 3M17.5 12.5C20 8.5 18.5 4.5 16 3"/><circle cx="12" cy="14" r="5.2"/><path d="M9.6 13h.1M14.4 13h.1M9.5 16.5l2.5 1.5 2.5-1.5"/>`,     // 15 the devil: horns
  `<path d="M7.5 21V10h9v11M6.5 10h11L16.5 7h-9z"/><path d="M14 2l-3.2 5.5h3.8L11.5 13"/>`,                                                                                  // 16 the tower struck
  `<path d="M12 2.5l2 7.2 7.2 2.3-7.2 2.3-2 7.2-2-7.2-7.2-2.3 7.2-2.3z"/>`,                                                                                                 // 17 the star
  `<path d="M16 3.5a8.5 8.5 0 1 0 0 17 6.4 6.4 0 1 1 0-17z"/><path d="M19 8.5h.1M20.5 13h.1"/>`,                                                                              // 18 the moon
  `<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2M5.3 5.3l2.2 2.2M16.5 16.5l2.2 2.2M18.7 5.3l-2.2 2.2M7.5 16.5l-2.2 2.2"/>`,    // 19 the sun
  `<path d="M3.5 13h8l9-6.5v13l-9-6.5h-8z"/><path d="M20.5 9.5c1.2 1.2 1.2 3.8 0 5"/>`,                                                                                       // 20 judgement: the trumpet
  `<ellipse cx="12" cy="12" rx="8.5" ry="9.5"/><path d="M12 6.5v8M9 9.5h6M10 18.5l2-4 2 4"/>`,                                                                                 // 21 the world: the wreath and its dancer
];
const FOOL = `<path d="M5 10.5C6 5 10.5 4 12 8c1.5-4 6-3 7 2.5"/><circle cx="5" cy="10.5" r="1.3"/><circle cx="12" cy="7.8" r="1.3"/><circle cx="19" cy="10.5" r="1.3"/><circle cx="12" cy="15" r="3.4"/><path d="M8 21h8M10.8 14.4h.1M13.2 14.4h.1"/>`;

/** One card as markup (a trump or the Excuse drawn here, a suit card as cards.js draws it); cls adds classes, data its data-* fields. */
export function tarotCard(c, { cls = "", data = {}, label = "" } = {}) {
  if (c >= 22) {
    const s = suitOf(c);
    return cardHtml({ rank: RANK_MARKS[rankOf(c)], suit: SUIT_OF_CARDS_JS[s] }, { cls: `ts${s}${cls ? ` ${cls}` : ""}`, data, label: label || cardName(c) });
  }
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  const ex = c === EXCUSE, n = c + 1;
  return `<span class="cd tr ${ex ? "ex" : `tg${Math.min(4, Math.floor(c / 5))}`}${cls ? ` ${cls}` : ""}"${attrs} role="img" aria-label="${esc(label || cardName(c))}">`
    + `<span class="cd-r">${ex ? "0" : n}</span><span class="tr-art" aria-hidden="true"><svg viewBox="0 0 24 24">${ex ? FOOL : ART[n]}</svg></span>`
    + `<span class="tr-rom" aria-hidden="true">${ex ? "" : ROMAN[n]}</span></span>`;
}
export { backHtml } from "./cards.js";
