// Which test files a push has to run, and a way to run them (the workflows' test step, and what a Claude runs before pushing).
//   node tools/pick-tests.mjs [--slot N] [--slow] file …   the tests for a push that changed these files, one path a line
//   node tools/pick-tests.mjs --all                        every test, slow ones too
//   … --run                                                run the picked tests four at a time instead of listing them;
//                                                          a failing one prints its output and the exit code is 1
//   node tools/pick-tests.mjs --measure                    time every test and write tools/test-times.json
//
// Korbi (29 October 2026): unless he says otherwise, only the tests that take under five seconds run: a test's time is
// in tools/test-times.json (`--measure` writes it again), and a test at five seconds or more is slow. A push, and a Claude
// before pushing, runs, in this order of what it is sure of:
//   1. the quick tests that read every page (syntax, imports, wide, days; offline is 13 seconds, so it's slow), always;
//   2. the tests of what changed: those named for a changed file's game (`topple.js` → `tests/topple.mjs`, `topple-*.mjs`)
//      and, for a file that isn't one game's alone (style.css, kb/, a bank, tools/), the tests that load it, read off the
//      files each test names (imports and quoted file names, followed on). A test that reaches almost every file (the
//      party games' through party-core, the ones that read every bank) names nothing in particular and is left to 3 and 4;
//   3. one slice of the rest, a twentieth, a different slice each push (`--slot`, the commit count), so everything gets
//      its turn whatever the changes were;
//   4. every test every night (`.github/workflows/all-tests.yml`, slow ones too) and on demand, which is what finds what
//      2 and 3 missed.
// `--slow` adds the slow tests to 1 to 3 (when Korbi asks for the whole thing, or a game's own slow ones are the point).
// Why this is safe enough: across 594 pushes 2 broke a game's rules (the 14 others were one afternoon's bank rewrites), so a
// missed break costs a day at the most, and a push that fails still doesn't reach installed copies.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { basename, dirname, join, normalize } from "node:path";
import { execSync, spawn } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const ALL = readdirSync(join(ROOT, "tests")).filter(f => f.endsWith(".mjs")).map(f => `tests/${f}`).sort();
/** Seconds each test took (four at a time on four cores); a test not listed is new and counts as quick. */
const TIMES = existsSync(join(ROOT, "tools/test-times.json")) ? JSON.parse(readFileSync(join(ROOT, "tools/test-times.json"), "utf8")) : {};
/** Five seconds or more. */
export const SLOW_AFTER = 5;
export const isSlow = t => (TIMES[basename(t, ".mjs")] ?? 0) >= SLOW_AFTER;
/** Tests that read every page or script, so a change to any one game can break them. */
export const QUICK = ["syntax", "imports", "offline", "wide", "days"].map(n => `tests/${n}.mjs`).filter(t => ALL.includes(t));
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

/** The tests for the changed files and a slice's turn (slot is the number of the push); the slow ones only with `slow`. */
export function pick(files, slot = 0, { slow = false } = {}) {
  const ok = t => slow || !isSlow(t);
  const picked = new Set(QUICK.filter(ok));
  for (const f of files) {
    if (DOCS.has(f)) continue;
    for (const t of namedFor(f)) if (ok(t)) picked.add(t);
    for (const t of loading(f)) if (ok(t)) picked.add(t);
  }
  const rest = ALL.filter(t => !picked.has(t) && ok(t));
  rest.forEach((t, i) => { if (i % SLICES === slot % SLICES) picked.add(t); });
  return ALL.filter(t => picked.has(t));
}

/** Run tests four at a time; a failure prints its output. Resolves to the number that failed. */
export function run(tests, parallel = 4, times = null) {
  return new Promise(done => {
    let next = 0, running = 0, failed = 0;
    const start = () => {
      while (running < parallel && next < tests.length) {
        const t = tests[next++];
        running++;
        const out = [], began = Date.now();
        const child = spawn(process.execPath, [t], { cwd: ROOT });
        child.stdout.on("data", d => out.push(d)); child.stderr.on("data", d => out.push(d));
        child.on("close", code => {
          running--;
          const secs = (Date.now() - began) / 1000;
          if (times) times[basename(t, ".mjs")] = Math.round(secs * 10) / 10;
          if (code === 0) console.log(`ok   ${secs.toFixed(1).padStart(5)}s ${t}`); else { failed++; console.log(`FAIL ${t}\n${Buffer.concat(out)}`); }
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
  if (args.includes("--measure")) {
    const times = {}, failed = await run(ALL, 4, times);
    const sorted = Object.fromEntries(Object.entries(times).sort((a, b) => b[1] - a[1]));
    writeFileSync(join(ROOT, "tools/test-times.json"), JSON.stringify(sorted, null, 1) + "\n");
    console.log(`${Object.values(sorted).filter(t => t >= SLOW_AFTER).length} of ${ALL.length} tests take ${SLOW_AFTER} seconds or more; tools/test-times.json written`);
    process.exitCode = failed ? 1 : 0;
  } else {
    const tests = args.includes("--all") ? ALL : pick(files, slot, { slow: args.includes("--slow") });
    if (args.includes("--run")) {
      console.log(`tests to run: ${tests.length}`);
      process.exitCode = (await run(tests)) ? 1 : 0;
    } else console.log(tests.join("\n"));
  }
}
