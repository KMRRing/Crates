// The Art history course's review pile: what you got wrong comes back, further apart each time you get it right (a day, three days, a
// week, three weeks: the ladder music-pile.js keeps for the Music course). It is the course's own, small version of the idea; the suite's
// Ledger and Punt piles are for knowledge-base items and are not touched. Kept under `arthistory:pile`, so it syncs with your other devices.
import { record, dueIds } from "./music-pile.js";

export const KEY = "arthistory:pile";
export function loadPile(store = globalThis.localStorage) {
  try { const p = JSON.parse(store.getItem(KEY) || "{}"); return { items: p.items && typeof p.items === "object" ? p.items : {} }; } catch { return { items: {} }; }
}
export function savePile(pile, store = globalThis.localStorage) { try { store.setItem(KEY, JSON.stringify(pile)); } catch { /* private mode */ } }
export { record, dueIds };
