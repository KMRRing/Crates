// No chess engine under the GNU General Public License ships with the app (docs/licences-images-and-engines.md has
// each engine's licence and why it is or isn't used). The tree is read, not a list of names: a GPL engine comes in under
// any file name, so a file counts if it is named for a known GPL engine or if a licence file or a source file's header
// says GNU General Public License (or its Affero and Lesser forms), and it sits among the engine files under vendor/.
import fs from "fs";
import path from "path";

const ROOT = new URL("..", import.meta.url).pathname;
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// Engines whose licence is GPL or AGPL, by the names their files go by (Stockfish and what is derived from it).
const GPL_NAMES = /stockfish|lc0|lczero|leela|komodo|ethereal|koivisto|viridithas|rubichess|berserk/i;
const GPL_TEXT = /GNU (Affero |Lesser )?General Public License/i;
const SKIP_DIRS = new Set([".git", "node_modules", ".claude", "docs", "tests", "kb"]);
const LICENCE_FILE = /^(copying|copyright|licen[cs]e|unlicense)/i, SOURCE_FILE = /\.(js|mjs|h|hpp|cpp|c|patch)$/i;

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full); else files.push(path.relative(ROOT, full));
  }
})(ROOT);
const head = file => { const fd = fs.openSync(path.join(ROOT, file), "r"), b = Buffer.alloc(4000), n = fs.readSync(fd, b, 0, 4000, 0); fs.closeSync(fd); return b.subarray(0, n).toString("utf8"); };

const byName = files.filter(f => GPL_NAMES.test(f) && !/^sw\.js$/.test(f));
check(!byName.length, `no file is named for a GPL engine${byName.length ? `: ${byName.slice(0, 6).join(", ")}` : ""}`);

const byHeader = files.filter(f => (LICENCE_FILE.test(path.basename(f)) || (f.startsWith("vendor/") && SOURCE_FILE.test(f))) && GPL_TEXT.test(head(f)));
check(!byHeader.length, `no licence file or source file under vendor/ says GNU General Public License${byHeader.length ? `: ${byHeader.slice(0, 6).join(", ")}` : ""}`);

// the other way round: every engine's WebAssembly sits beside a licence file that names the licence it is under
const engines = files.filter(f => f.startsWith("vendor/") && /\.wasm$/.test(f) && /caissa|stockfish|engine/i.test(f));
const unlicensed = engines.filter(f => !fs.readdirSync(path.join(ROOT, path.dirname(f))).some(n => LICENCE_FILE.test(n) || /^LICEN[CS]E/i.test(n)));
check(engines.length > 0 && !unlicensed.length, `every engine's WebAssembly has its licence text beside it (${engines.join(", ") || "none found"})`);

// Gambit loads no engine file but Caissa's
const gambit = fs.readFileSync(path.join(ROOT, "gambit.js"), "utf8");
check(!GPL_NAMES.test(gambit.replace(/\/\/.*$/gm, "")) && /gambit-engine-worker\.js/.test(gambit), "gambit.js starts Caissa's worker and names no GPL engine in its code");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("gambit-licences: every check passed");
