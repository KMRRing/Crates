// Gears: today's plate and random plates (5 November 2026). Both are plates of the pool (pipes-gear-pool.js, proven offline by the solver)
// under one of the eight turns and mirrors of the board, so no solving happens on the page and every answer still stands. The week sets
// the band: easy early on, hard at the weekend. Pure apart from the pool, which is loaded when one is asked for.
import { transformLevel } from "./pipes-gear-legacy.js";

export const BANDS = ["easy", "medium", "hard"];
const WEEK = ["hard", "easy", "easy", "medium", "medium", "medium", "hard"];       // Sunday first
const hash = n => { let h = (n ^ 0x9E3779B9) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
/** The day of the week (0 Sunday) of a YYYYMMDD day. */
export const weekdayOf = day => new Date(Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100)).getUTCDay();
export const bandOf = day => WEEK[weekdayOf(day)];

let pool = null;
const loadPool = async () => (pool ||= (await import("./pipes-gear-pool.js")).POOL);

/** The plate of band `band` for `seed`: { spec, band, from, turn }. */
export async function plateOf(seed, band) {
  const POOL = await loadPool(), list = POOL[band], h = hash(seed);
  const from = h % list.length, turn = (h >>> 8) % 8;
  return { spec: transformLevel(list[from], turn), band, from, turn };
}
/** Today's: the plate of the day's band, as level data with the id `d<day>`. */
export async function dailySpec(day) {
  const band = bandOf(day), { spec, from, turn } = await plateOf(day, band);
  return { ...spec, id: `d${day}`, name: "Today's plate", chapter: band, v: 1, daily: day, from, turn };
}
/** A random plate: `n` any number (the page draws it), the band by how far the player has got (levels solved). */
export async function randomSpec(n, solved = 0) {
  const band = solved < 18 ? "easy" : solved < 45 ? "medium" : "hard", { spec } = await plateOf(n, band);
  return { ...spec, id: `r${n}`, name: "A random plate", chapter: band, v: 1, random: n };
}
