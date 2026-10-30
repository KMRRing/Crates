// A duo match of Crates (coop-room.js, the pure part of coop.js): every board a room deals is of countries, whatever pool
// the room was made with (30 October 2026, Korbi: "make it so multiplayer crates always is countries"), in the shared
// game and in the hidden one, with the settings it was made with and with settings too narrow for a board.
import fs from "node:fs";

// core.js reads the word bank from the page's global, as bank.js sets it
const bankSource = fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8");
globalThis.window = {};
new Function("window", bankSource)(globalThis.window);
const { BANK, GROUPS, cleanSettings } = await import("../core.js");
const { decode } = await import("../gen.js");
const { newBoard, tidy, POOL, LIVES, CLUES } = await import("../coop-room.js");

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

/** A room as the database holds it: two players seated, a pool it was made with, settings, no board yet. */
const roomOf = (mode, pool, settings = {}) => ({
  v: 3, mode, owner: "a", pool, settings: cleanSettings(settings), recentA: [],
  players: { a: { name: "A", slot: 0, settings: cleanSettings(settings) }, b: { name: "B", slot: 1, settings: cleanSettings(settings) } },
});
/** The categories of the four answers a board holds. */
const catsOf = b => decode(b.code).groups.map(g => BANK[g.a].cat);

check(POOL === "country", "the duo pool is countries");
check(BANK.some(a => a.cat === "commodity") && BANK.some(a => a.cat === "country"), "the bank has both kinds, so a test of countries only means something");

for (const mode of ["shared", "hidden"]) {
  const seen = new Set();
  let ok = true, fell = 0, boards = 0;
  for (const pool of ["country", "commodity", "mixed", undefined]) {
    const room = tidy(roomOf(mode, pool));
    ok = ok && room.pool === "country";
    for (let n = 1; n <= 12; n++) {
      const b = newBoard(room, n);
      boards++;
      fell += b.fellBack ? 1 : 0;
      for (const c of catsOf(b)) seen.add(c);
      if (b.lives !== LIVES || b.clues !== CLUES) ok = false;
    }
  }
  check(ok && seen.size === 1 && seen.has("country"), `${mode}: ${boards} boards from rooms made as countries, commodities, mixed and without a pool all hold four countries${[...seen].join() !== "country" ? ` (saw ${[...seen]})` : ""}`);
  check(fell === 0, `${mode}: the room's own settings deal a board each time`);
}

// settings that leave no country to deal (every country group switched off): the fallback is Balanced, still countries
for (const mode of ["shared", "hidden"]) {
  const off = Object.values(GROUPS).flat().map(([k]) => k);
  const room = tidy(roomOf(mode, "commodity", { off }));
  const b = newBoard(room, 1);
  check(b.fellBack === true && catsOf(b).every(c => c === "country"), `${mode}: settings with nothing left to deal fall back to Balanced, and the board is still of countries`);
}

// a snapshot as the database returns it: an older room's pool is replaced, and one of another version is refused
check(tidy(roomOf("shared", "mixed")).pool === "country", "an older room's mixed pool is read as countries");
check(tidy({ ...roomOf("shared", "commodity"), v: 2 }) === null && tidy(null) === null, "a room of another version, or none, is no room");

process.exit(bad ? 1 : 0);
