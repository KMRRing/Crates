// A card played to the cloth, slid there as itself (Big Two, Hearts, Tarot, Schafkopf): see slideIn() in table3d.js.
import { slideIn } from "./table3d.js";

/** Korbi, 7 Nov 2026: a card played to the middle is the very element that stays on the cloth (as in Guandan), slid from the plate
 *  to where it lies in the cloth's own plane, so what flies and what lies there are one card, and nothing flickers. */
export const slide = (el, from, delay = 0) => slideIn(el, from, { delay });

/** Whether anything should move: not for a watching frame (`quiet`), a hidden page or reduced motion. */
export const mayMove = quiet => !quiet() && !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches;
