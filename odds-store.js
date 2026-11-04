// What the Odds course keeps besides where you are in it (course.js keeps that, under odds:course): your calibration record
// (every statement you rated and how sure you were) and your hit rate on 90% ranges. Both are small totals, not histories.
// A watching frame reads them and writes nothing (CLAUDE.md, "Saved state syncs"). `storage` is a parameter so tests can run
// without a page.
import { emptyCalib, addCalib, CONF } from "./odds-math.js";

export const CALIB_KEY = "odds:calib", RANGE_KEY = "odds:ranges";
let watching = false;
/** A partner's watching frame: nothing is written. */
export const watch = on => { watching = !!on; };
const store = () => { try { return localStorage; } catch { return null; } };
const read = (key, storage) => { try { return JSON.parse((storage || store())?.getItem(key) || "null"); } catch { return null; } };
const write = (key, v, storage) => { if (!watching) try { (storage || store())?.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };

/** The calibration record: { n, bins: { 50: [right, n]… }, brier, seen: [statement ids, latest last] }. */
export function readCalib(storage) {
  const r = read(CALIB_KEY, storage);
  if (!r || typeof r.n !== "number" || typeof r.bins !== "object" || !Array.isArray(r.seen)) return emptyCalib();
  const bins = {};
  for (const c of CONF) if (Array.isArray(r.bins[c]) && r.bins[c].length === 2) bins[c] = [Number(r.bins[c][0]) || 0, Number(r.bins[c][1]) || 0];
  return { n: r.n | 0, bins, brier: Number(r.brier) || 0, seen: r.seen.filter(x => typeof x === "string").slice(-40) };
}
/** One rated statement added and kept: returns the new record. */
export function noteAnswer(id, confidence, right, storage) {
  const rec = addCalib(readCalib(storage), id, confidence, right);
  write(CALIB_KEY, rec, storage);
  return rec;
}
/** Your 90% ranges: [hits, tries]. */
export function readRanges(storage) {
  const r = read(RANGE_KEY, storage);
  return Array.isArray(r) && r.length === 2 && r.every(x => Number.isFinite(x) && x >= 0) ? [r[0] | 0, r[1] | 0] : [0, 0];
}
export function noteRange(hit, storage) {
  const [h, n] = readRanges(storage), next = [h + (hit ? 1 : 0), n + 1];
  write(RANGE_KEY, next, storage);
  return next;
}
