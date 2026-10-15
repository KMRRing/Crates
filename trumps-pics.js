// The Bavarian pack's own pictures, for Schafkopf's Cards: Pictures (the menu): Johann Nepomuk Valter's Bayerisches
// Bild (Regensburg, from 1826), hand-coloured woodcuts in the public domain, from the scans published with "Studien zur
// Spielkarte 55" (Radau and Flöter, catalogue RD 12) on Wikimedia Commons. His surviving pack has lost its
// Schellen-Zehner, so Caspar Baronsee's (Regensburg, 1841) stands in, its paper toned to Valter's. Each is 270 by 459
// and WebP; the names are the course's (trumps-course.js: "EO" the Eichel-Ober, "S10" the Schellen-Zehner).
import { cid } from "./trumps-cards.js";

const FILES = {
  EA: "trumps-pics/EA.webp",
  E10: "trumps-pics/E10.webp",
  EK: "trumps-pics/EK.webp",
  EO: "trumps-pics/EO.webp",
  EU: "trumps-pics/EU.webp",
  E9: "trumps-pics/E9.webp",
  E8: "trumps-pics/E8.webp",
  E7: "trumps-pics/E7.webp",
  GA: "trumps-pics/GA.webp",
  G10: "trumps-pics/G10.webp",
  GK: "trumps-pics/GK.webp",
  GO: "trumps-pics/GO.webp",
  GU: "trumps-pics/GU.webp",
  G9: "trumps-pics/G9.webp",
  G8: "trumps-pics/G8.webp",
  G7: "trumps-pics/G7.webp",
  HA: "trumps-pics/HA.webp",
  H10: "trumps-pics/H10.webp",
  HK: "trumps-pics/HK.webp",
  HO: "trumps-pics/HO.webp",
  HU: "trumps-pics/HU.webp",
  H9: "trumps-pics/H9.webp",
  H8: "trumps-pics/H8.webp",
  H7: "trumps-pics/H7.webp",
  SA: "trumps-pics/SA.webp",
  S10: "trumps-pics/S10.webp",
  SK: "trumps-pics/SK.webp",
  SO: "trumps-pics/SO.webp",
  SU: "trumps-pics/SU.webp",
  S9: "trumps-pics/S9.webp",
  S8: "trumps-pics/S8.webp",
  S7: "trumps-pics/S7.webp",
};
/** The back of Valter's pack: acorns in rows. */
export const PIC_BACK = "trumps-pics/back.webp";
const FARBE = { E: 3, G: 2, H: 1, S: 0 }, RANK = { A: "A", 10: "T", K: "K", O: "Q", U: "J", 9: "9", 8: "8", 7: "7" };
/** Each card's picture by its id. */
export const PICS = Object.fromEntries(Object.entries(FILES).map(([t, file]) => [cid(FARBE[t[0]], RANK[t.slice(1)]), file]));
