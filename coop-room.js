// A duo match's room, as the pure part of coop.js: what a room holds and how its boards are dealt (no page, so
// tests/coop.mjs runs it in Node). Crates' state is one room in Firebase Realtime Database, two players.
import { shuffled, arr, cleanSettings, defaultSettings } from "./core.js";
import { generate, generateSplit, encode, describe } from "./gen.js";

export const LIVES = 4;          // team pool per board
export const CLUES = 4;          // team pool per board; unused clues don't carry over
// A duo match deals countries only (30 October 2026, Korbi: "make it so multiplayer crates always is countries"): a
// commodity is a specialist's answer, and two people at a table share what a country calls to mind. The room still
// has a `pool` (rooms made before kept theirs: commodities, mixed), but every board is dealt from this one.
export const POOL = "country";
const RECENT_ANSWERS = 16;

/** A fresh board from the countries and the room's settings; in hidden mode each side uses its own player's. */
export function newBoard(room, n) {
  const recentA = arr(room.recentA);
  const shared = cleanSettings(room.settings);
  let b, fellBack = false;
  if (room.mode === "hidden") {
    const sides = [0, 1].map(slot => cleanSettings(Object.values(room.players).find(p => p.slot === slot)?.settings));
    b = generateSplit({ pool: POOL, sides, off: shared.off, recentA });
    if (!b) { fellBack = true; b = generateSplit({ pool: POOL, sides: [defaultSettings(), defaultSettings()], recentA }); }
  } else {
    b = generate({ pool: POOL, settings: shared, recentA });
    if (!b) { fellBack = true; b = generate({ pool: POOL, settings: defaultSettings(), recentA }); }
  }
  room.recentA = [...b.groups.map(g => g.a), ...recentA].filter((a, i, all) => all.indexOf(a) === i).slice(0, RECENT_ANSWERS);
  return {
    n, code: encode(b), sides: b.sides ? b.sides.flat().join("") : null, order: shuffled(describe(b).flatMap(g => g.words)),
    found: [], guesses: [], revealed: [], pending: null, done: false, won: false,
    lives: LIVES, clues: CLUES, fellBack,
  };
}

/** Normalise a room snapshot: Realtime Database drops empty arrays and nulls. */
export function tidy(room) {
  if (!room || room.v !== 3 || !room.players) return null;
  for (const pl of Object.values(room.players)) {
    pl.sel = arr(pl.sel);
    pl.settings = cleanSettings(pl.settings);
    pl.ready = pl.ready === true;
  }
  room.pool = POOL;                       // an older room's commodities or mix: countries from its next board on
  room.settings = cleanSettings(room.settings);
  room.recentA = arr(room.recentA);
  room.tally = room.tally || { maps: 0, points: 0 };
  const b = room.board;
  if (b) {
    b.order = arr(b.order); b.found = arr(b.found);
    b.guesses = arr(b.guesses).map(g => ({ ...g, words: arr(g.words), lv: arr(g.lv) }));
    b.revealed = arr(b.revealed);
    b.pending = b.pending || null; b.sides = b.sides || null;
  }
  return room;
}
