// Which test files a push has to run, and a way to run them (the workflows' test step, and what a Claude runs before pushing).
//   node tools/pick-tests.mjs [--slot N] file file …   the tests for a push that changed these files, one path a line
//   node tools/pick-tests.mjs --all                    every test
//   … --run                                            run the picked tests four at a time instead of listing them;
//                                                      a failing one prints its output and the exit code is 1
//
// A push runs, in this order of what it is sure of:
//   1. the quick tests that read every page (syntax, imports, offline, wide, days), always;
//   2. the tests of what changed: those named for a changed file's game (`topple.js` → `tests/topple.mjs`, `topple-*.mjs`)
//      and, for a file that isn't one game's alone (style.css, kb/, a bank, tools/), the tests that load it, read off the
//      files each test names (imports and quoted file names, followed on). A test that reaches almost every file (the
//      party games' through party-core, the ones that read every bank) names nothing in particular and is left to 3 and 4;
//   3. one slice of the rest, a twentieth, a different slice each push (`--slot`, the commit count), so everything gets
//      its turn whatever the changes were;
//   4. every test every night (`.github/workflows/all-tests.yml`) and on demand, which is what finds what 2 and 3 missed.
// The slow tests (HEAVY, a test of a game's own or a few seconds' worth of every bank, 25 seconds and more each, 60% of the
// suite's time) run in 2 only when their own game changed, and in 4. Korbi (29 October 2026): the suite took too long
// and uptime isn't important here; across 594 pushes 2 broke a game's rules (the 14 others were one afternoon's bank
// rewrites), so a missed break costs a day at the most, and a push that fails still doesn't reach installed copies.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { basename, dirname, join, normalize } from "node:path";
import { execSync, spawn } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const ALL = readdirSync(join(ROOT, "tests")).filter(f => f.endsWith(".mjs")).map(f => `tests/${f}`).sort();
/** Quick tests that read every page or script, so a change to any one game can break them. */
export const QUICK = ["syntax", "imports", "offline", "wide", "days"].map(n => `tests/${n}.mjs`).filter(t => ALL.includes(t));
/** 25 seconds or more each on four cores (October 2026): about 1,300 of the suite's 2,150 seconds. */
export const HEAVY = new Set(["factor", "dandan", "manifest", "refinery", "topple-features", "topple-levels", "cartel", "punt", "gambit", "guilloche",
  "timegrapher", "trumps-hard", "river", "bigtwo", "contract"].map(n => `tests/${n}.mjs`));
/** Files that change nothing a page loads. */
const DOCS = new Set(["README.md", "CLAUDE.md", "sw.js", ".gitignore"]);
/** A test whose reach is this many files or more names nothing in particular. */
const WHOLE_APP = 200;
/** The share of the rest a push also runs: one in this many. */
const SLICES = 20;

/** The tests named for a file: `topple.js` and `topple-levels.js` have `tests/topple.mjs` and `tests/topple-*.mjs`. */
export function namedFor(file) {
  const game = basename(file).replace(/\.[^.]+$/, "").split("-")[0];
  return ALL.filter(t => { const n = basename(t, ".mjs"); return n === game || n.startsWith(`${game}-`); });
}

// ---------- what each test loads ----------
// The files a source names: every quoted string that is a file of the app (relative to the file, or a bare name only one
// file has), which covers imports, fetches, workers and the pages' scripts alike. A path built as the code runs (a template
// with ${}) can't be followed; that's what the nightly run is for.
let graph = null;
function build() {
  const files = execSync("git ls-files", { cwd: ROOT, maxBuffer: 1 << 26 }).toString().split("\n").filter(f => /\.(m?js|css|html|json)$/.test(f));
  const known = new Set(files), byName = new Map();
  for (const f of files) { const b = basename(f); byName.set(b, byName.has(b) ? null : f); }
  const STR = /["'`]([^"'`\n]{2,120}?\.(?:m?js|css|html|json))["'`]/g, edges = new Map();
  for (const f of files) {
    const path = join(ROOT, f);
    if (!existsSync(path) || statSync(path).size > 300_000) { edges.set(f, []); continue; }     // a built bank names nothing
    const out = new Set();
    for (const [, s] of readFileSync(path, "utf8").matchAll(STR)) {
      if (s.includes("${")) continue;
      const rel = normalize(join(dirname(f), s));
      if (known.has(rel)) out.add(rel); else if (!s.includes("/") && byName.get(s)) out.add(byName.get(s));
    }
    edges.set(f, [...out]);
  }
  const reach = t => { const seen = new Set(), todo = [t]; while (todo.length) { const f = todo.pop(); if (seen.has(f)) continue; seen.add(f); todo.push(...(edges.get(f) || [])); } return seen; };
  graph = new Map(ALL.map(t => [t, reach(t)]));
}
/** The tests that load a file, not counting the ones that load nearly everything. */
export function loading(file) {
  if (!graph) build();
  return ALL.filter(t => graph.get(t).size < WHOLE_APP && graph.get(t).has(file));
}

/** The tests for the changed files and a slice's turn (slot is the number of the push). */
export function pick(files, slot = 0) {
  const picked = new Set(QUICK);
  for (const f of files) {
    if (DOCS.has(f)) continue;
    for (const t of namedFor(f)) picked.add(t);
    for (const t of loading(f)) if (!HEAVY.has(t)) picked.add(t);
  }
  const rest = ALL.filter(t => !picked.has(t) && !HEAVY.has(t));
  rest.forEach((t, i) => { if (i % SLICES === slot % SLICES) picked.add(t); });
  return ALL.filter(t => picked.has(t));
}

/** Run tests four at a time; a failure prints its output. Resolves to the number that failed. */
export function run(tests, parallel = 4) {
  return new Promise(done => {
    let next = 0, running = 0, failed = 0;
    const start = () => {
      while (running < parallel && next < tests.length) {
        const t = tests[next++];
        running++;
        const out = [];
        const child = spawn(process.execPath, [t], { cwd: ROOT });
        child.stdout.on("data", d => out.push(d)); child.stderr.on("data", d => out.push(d));
        child.on("close", code => {
          running--;
          if (code === 0) console.log(`ok   ${t}`); else { failed++; console.log(`FAIL ${t}\n${Buffer.concat(out)}`); }
          if (next === tests.length && !running) done(failed); else start();
        });
      }
    };
    if (!tests.length) done(0); else start();
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), slotAt = args.indexOf("--slot");
  const slot = slotAt >= 0 ? Number(args[slotAt + 1]) || 0 : 0;
  const files = args.filter((a, i) => !a.startsWith("--") && !(slotAt >= 0 && i === slotAt + 1));
  const tests = args.includes("--all") ? ALL : pick(files, slot);
  if (args.includes("--run")) {
    console.log(`tests to run: ${tests.length}`);
    process.exitCode = (await run(tests)) ? 1 : 0;
  } else console.log(tests.join("\n"));
}
