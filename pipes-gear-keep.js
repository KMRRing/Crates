// Gears: reads what `pipes:train` and `pipes:trainstars` hold, whatever build wrote them (a key from an old device or a mixed-version sync
// must not blank the page). Pure. Version 1 (the old forty): laid is { square: oldKind }; version 2: { square: "kind@rot" }. Nothing else
// is trusted: a level the file does not have, a piece the catalogue does not know, a run for a plate that changed, are dropped by the
// controller (the run's `sig`), not here.
import { legacyLaid } from "./pipes-gear-legacy.js";

const isObj = x => x && typeof x === "object" && !Array.isArray(x);
/** The saved runs as version 2: { v: 2, id, runs: { levelId: { sig, laid, sel, selRot, lifts, hints, solved } } }, or null for junk. */
export function readRuns(raw, firstId) {
  if (!isObj(raw) || typeof raw.id !== "string" || !isObj(raw.runs ?? {})) return { v: 2, id: firstId, runs: {} };
  const runs = {};
  for (const [id, r] of Object.entries(raw.runs || {})) {
    if (!isObj(r)) continue;
    const laid = raw.v === 1 ? legacyLaid(r.laid) : isObj(r.laid) ? r.laid : {};
    runs[id] = { sig: String(r.sig ?? ""), laid, sel: typeof r.sel === "string" ? r.sel : null, selRot: Number.isInteger(r.selRot) ? r.selRot : null, lifts: Number(r.lifts) || 0, hints: Number(r.hints) || 0, solved: Number(r.solved) || 0 };
    // a version 1 selection was an old kind
    if (raw.v === 1) runs[id].sel = null;
  }
  return { v: 2, id: raw.id, runs };
}
/** The stars: { levelId: 1..3 }. */
export function readStars(raw) {
  const out = {};
  if (isObj(raw)) for (const [id, s] of Object.entries(raw)) if (s >= 1 && s <= 3) out[id] = Math.floor(s);
  return out;
}
