// The Constitutions course's review pile: what you got wrong comes back, further apart each time you get it right (a day, three days, a week, three weeks: the ladder
// music-pile.js keeps for the Music course, as Art history uses it). It is the course's own, small version of the idea. Kept under `constitutions:pile`, so it syncs.
import { record, dueIds } from "./music-pile.js";

export const KEY = "constitutions:pile";
export function loadPile(store = globalThis.localStorage) {
  try { const p = JSON.parse(store.getItem(KEY) || "{}"); return { items: p.items && typeof p.items === "object" ? p.items : {} }; } catch { return { items: {} }; }
}
export function savePile(pile, store = globalThis.localStorage) { try { store.setItem(KEY, JSON.stringify(pile)); } catch { /* private mode */ } }
export { record, dueIds };
