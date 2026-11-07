// One game of the suite in a repo of its own (CLAUDE.md, "Standalone repos"). <dir> is the clone of that repo.
//   node tools/standalone.mjs out <dir> <page.html>   copy what the page reaches and <dir> lacks, patch menu.js (no games screen),
//                                                     write index.html and sw.js, note Crates' commit as the base
//   node tools/standalone.mjs status <dir>            files changed in <dir> since the base, and in Crates since the base
//   node tools/standalone.mjs in <dir> <file>...      merge those files' changes into Crates (you choose: menu code stays out)
//   node tools/standalone.mjs from <dir> <file>...    the same the other way, then rewrite sw.js
//   node tools/standalone.mjs base <dir>              note Crates' current commit as the base (after merging, committed)
// The base is `.crates-base` in <dir>: Crates' commit, then the page. A merge is `git merge-file` on base, Crates and <dir>.
import fs from "fs"; import os from "os"; import path from "path"; import { execSync } from "child_process"; import { fileURLToPath } from "url";
import { refsOf } from "./offline.mjs"; import { serviceWorker } from "./build-sw.mjs";

const C = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..") + "/";
const [cmd, dir, ...rest] = process.argv.slice(2), R = path.resolve(dir || ".") + "/";
const OWN = new Set(["index.html", "sw.js", "README.md", ".nojekyll", ".crates-base", "menu.js"]);   // the repo's own, never merged
const run = (c, cwd) => execSync(c, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const head = () => run("git rev-parse HEAD", C);
const [sha, page] = fs.existsSync(R + ".crates-base") ? fs.readFileSync(R + ".crates-base", "utf8").trim().split(/\s+/) : [];
const show = f => { try { return execSync(`git show ${sha}:${f}`, { cwd: C, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
const read = f => fs.existsSync(f) ? fs.readFileSync(f) : null;
const files = () => run("git ls-files", R).split("\n").filter(f => f && !OWN.has(f));

function finish(pg = page) {
  fs.copyFileSync(R + pg, R + "index.html");
  run("git add -A", R);   // the service worker lists the repo's tracked files
  const sw = serviceWorker(R); fs.writeFileSync(R + "sw.js", sw.text);
  console.log(`sw.js: ${sw.files.length} files, version ${sw.version}`);
}

/** Changes from base to `other` applied onto `dest`, in place; conflicts are left as markers. */
function merge(dest, f, other) {
  const b = show(f), d = read(dest + f), o = read(other + f);
  if (!o) return console.log(`${f}: not in ${other}`);
  if (!d) { fs.mkdirSync(path.dirname(dest + f), { recursive: true }); fs.writeFileSync(dest + f, o); return console.log(`${f}: new`); }
  if (!b) return console.log(`${f}: not in the base, merge it by hand`);
  const tmp = path.join(os.tmpdir(), "base-" + path.basename(f)); fs.writeFileSync(tmp, b);
  try { execSync(`git merge-file "${dest + f}" "${tmp}" "${other + f}"`, { stdio: "pipe" }); console.log(`${f}: merged`); }
  catch (e) { console.log(`${f}: ${e.status > 0 ? e.status + " CONFLICT(S): settle the <<<<<<< markers" : "failed"}`); }
}

if (cmd === "out") {
  const queue = [rest[0]], seen = new Set(queue), added = [];
  const LOADED = /\.(?:html|m?js|css|webmanifest|json|txt)$/i, has = f => fs.existsSync(R + f) && !fs.statSync(R + f).isDirectory();
  const visit = f => {
    if (seen.has(f) || (/\.html$/.test(f) && f !== rest[0]) || /^(tests|tools|\.github)\/|^sw\.js$/.test(f)) return;
    if (!has(f)) {
      if (!fs.existsSync(C + f) || fs.statSync(C + f).isDirectory()) return;
      fs.mkdirSync(path.dirname(R + f), { recursive: true }); fs.copyFileSync(C + f, R + f); added.push(f);
    }
    seen.add(f); queue.push(f);
  };
  if (!has(rest[0])) { fs.mkdirSync(R, { recursive: true }); fs.copyFileSync(C + rest[0], R + rest[0]); added.push(rest[0]); }
  while (queue.length) {
    const f = queue.shift(); if (!LOADED.test(f)) continue;
    const refs = refsOf(f, fs.readFileSync(R + f, "utf8")), d = path.posix.dirname(f);
    for (const u of refs.own) visit(path.posix.join(d, u));
    for (const u of refs.page) { const t = path.posix.normalize(u); if (!t.startsWith("..")) visit(t); }
  }
  if (added.includes("menu.js")) run(`patch -F3 -s menu.js < "${C}tools/standalone-menu.patch"`, R);
  fs.writeFileSync(R + ".nojekyll", "");
  fs.writeFileSync(R + ".crates-base", `${head()} ${rest[0]}\n`);
  console.log("copied from Crates:", added.join(" ") || "nothing");
  finish(rest[0]);
} else if (cmd === "status") {
  const here = [], there = [];
  for (const f of files()) {
    const b = show(f), r = read(R + f), c = read(C + f);
    if (!b) { here.push(f + " (new)"); continue; }
    if (!r.equals(b)) here.push(f);
    if (c && !c.equals(b)) there.push(f);
  }
  console.log(`base ${sha?.slice(0, 8)}\nchanged here:     ${here.join(" ") || "-"}\nchanged in Crates: ${there.join(" ") || "-"}`);
} else if (cmd === "in") {
  for (const f of rest) merge(C, f, R);
  console.log("Crates: run the quick tests, commit, then `base` here.");
} else if (cmd === "from") {
  for (const f of rest) merge(R, f, C);
  finish();
} else if (cmd === "base") {
  fs.writeFileSync(R + ".crates-base", `${head()} ${page || rest[0]}\n`);
  console.log("base is now", head().slice(0, 8));
} else console.log("usage: node tools/standalone.mjs out|status|in|from|base <dir> ...");
