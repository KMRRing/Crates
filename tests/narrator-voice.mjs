// The narrator's spoken voice exists only in the games where people say aloud what they play (SPOKEN_TABLES in
// table-ui.js: the Chinese table games). No other page offers its toggle, and its narrator never speaks.
import fs from "fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const said = [];
globalThis.speechSynthesis = { getVoices: () => [], speak: u => said.push(u.text), cancel() {} };
globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
globalThis.window = globalThis;

const { createNarrator, SPOKEN_TABLES } = await import("../narrator.js");
const line = n => ({ say: { n, text: `line ${n}` } });
const me = { driver: true };
for (const game of ["gammon", "bones", "quest", "party", ""]) {
  said.length = 0;
  const n = createNarrator({ game }); n.muted = false;
  n.hear(line(1), me); n.hear(line(2), me);
  check(said.length === 0 && n.hear(line(3), me) === "line 3", `${game || "(no game)"}: the line is written, never spoken`);
}
for (const game of ["bigtwo", "landlord"]) {
  said.length = 0;
  const n = createNarrator({ game }); n.muted = false;
  n.hear(line(1), me); n.hear(line(2), me);
  check(said.length === 1, `${game}: spoken`);
}

const toggles = fs.readdirSync(".").filter(f => /^[a-z0-9-]+\.js$/.test(f) && /toggle\("The narrator's voice"|choice\("Table talk"[^\n]*opts\.voice/.test(fs.readFileSync(f, "utf8")))
  .map(f => f.replace(/\.js$/, "")).sort();
check(toggles.length > 0 && toggles.every(g => SPOKEN_TABLES.includes(g)), `only the Chinese games offer the voice (a toggle, or the Off of their Table talk row) (${toggles.join(", ")})`);
process.exit(bad ? 1 : 0);
