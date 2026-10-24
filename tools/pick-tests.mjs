// Which test files a push has to run (the workflow's "Tests for what changed" step; prints one path a line).
//   node tools/pick-tests.mjs --all          every test
//   node tools/pick-tests.mjs file file …    the changed files of a push
// A push that touches only one game's own files (`topple.js`, `topple-levels.js`, `tests/topple-rules.mjs`…) runs that
// game's tests (`tests/topple.mjs`, `tests/topple-*.mjs`) and the few quick ones that read every game: syntax, imports,
// offline, wide, days. Anything else (a shared file, a bank, tools/, kb/, a file with no tests of its own) runs everything,
// as before: a wrong guess here would let a break reach installed copies, so every doubt resolves to "everything".
// The whole suite also runs every night and on demand (`.github/workflows/all-tests.yml`), which is what catches a game
// change that broke a game it doesn't own.
import { readdirSync } from "node:fs";
import { basename } from "node:path";

const ALL = readdirSync(new URL("../tests/", import.meta.url)).filter(f => f.endsWith(".mjs")).map(f => `tests/${f}`).sort();
/** Quick tests that read every page or script, so a change to any one game can break them. */
const QUICK = ["syntax", "imports", "offline", "wide", "days"].map(n => `tests/${n}.mjs`).filter(t => ALL.includes(t));
/** Files that change nothing a page loads. */
const DOCS = new Set(["README.md", "CLAUDE.md", "sw.js", ".gitignore"]);
/** Names that look like a game's but are shared by several: a change there runs everything. */
const SHARED = new Set(["party", "table", "seats", "duel", "duo", "lan", "kb", "banks", "pile", "deck", "core", "rooms", "together", "suite", "apps", "pwa", "rich", "pics", "wide", "net", "memdb", "standings", "menu", "style", "theme", "days", "loading", "dropdown", "syntax", "imports", "offline", "tex", "fake", "rtdb"]);

/** The tests of the game a file belongs to, or null when it's not one game's alone. */
export function testsOf(file) {
  const name = basename(file).replace(/\.[^.]+$/, "");
  const game = name.split("-")[0];
  if (SHARED.has(game) || SHARED.has(name) || /bank|-geo$|-data$/.test(name)) return null;   // the banks are built from kb/ and read by several games
  if (file.startsWith("tools/") || file.startsWith(".github/") || file.startsWith("kb/")) return null;
  const own = ALL.filter(t => { const n = basename(t, ".mjs"); return n === game || n.startsWith(`${game}-`); });
  return own.length ? own : null;
}

export function pick(files) {
  const picked = new Set(QUICK);
  for (const f of files) {
    if (DOCS.has(f)) continue;
    const own = testsOf(f);
    if (!own) return ALL;
    own.forEach(t => picked.add(t));
  }
  return ALL.filter(t => picked.has(t));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  console.log((args.includes("--all") || !args.length ? ALL : pick(args)).join("\n"));
}
