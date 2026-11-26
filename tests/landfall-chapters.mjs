// Traverse's campaign chapters (landfall-chapters.js): ten of them, every built voyage in exactly one, and no voyage asking for
// something a later chapter teaches (Korbi, 27 Nov 2026: "each type of navigation could get its own chapter").
import { LEVELS } from "../landfall-levels.js";
import { CHAPTERS, ORDER, chapterOf, playable } from "../landfall-chapters.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(CHAPTERS.length === 10 && CHAPTERS.every((c, i) => c.n === i + 1 && c.name && c.teaches), "ten chapters, numbered and named, each saying what it teaches");
const ids = new Set(LEVELS.map(l => l.id));
check(ORDER.length === LEVELS.length && new Set(ORDER).size === ORDER.length && ORDER.every(id => ids.has(id)), `every one of the ${LEVELS.length} voyages is in exactly one chapter`);
check(playable().every(c => c.levels.length) && playable()[0].n === 1, "the menu's chapters are the ones with voyages, from the first");

// what each sea chapter brings in, as the voyages' own flags (a noon level is one whose watches include a noon)
const TEACHES = { 1: [], 2: ["noon"], 3: ["lop", "clock"], 4: ["light", "lights", "hills"], 5: ["unnamed", "gale"], 6: ["bed", "colonies", "kelvin"] };
const flags = L => [...["lop", "clock", "light", "lights", "hills", "unnamed", "gale", "bed", "colonies", "kelvin"].filter(k => L[k]), ...(L.kinds?.includes("noon") ? ["noon"] : [])];
const late = [];
for (const L of LEVELS) {
  const c = chapterOf(L.id), known = new Set(Object.entries(TEACHES).filter(([n]) => n <= c).flatMap(([, t]) => t));
  for (const f of flags(L)) if (!known.has(f)) late.push(`${L.id} (${f})`);
}
check(!late.length, `no voyage needs what a later chapter teaches${late.length ? `: ${late.join(", ")}` : ""}`);
check(Object.values(TEACHES).flat().every(f => LEVELS.some(L => flags(L).includes(f) && TEACHES[chapterOf(L.id)].includes(f))), "each chapter's new tool is used in that chapter");

process.exit(bad ? 1 : 0);
