// Every script parses as the ES module the browser loads it as. Plain `node --check` misses a module's syntax errors
// (Node 22 falls back quietly and exits 0), which once let a missing brace in solo.js stop Crates at "Loading".
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const files = [".", "tools", "kb"].flatMap(dir => {
  try { return readdirSync(dir).filter(f => f.endsWith(".js") && f !== "sw.js").map(f => (dir === "." ? f : `${dir}/${f}`)); } catch { return []; }
});
const check = f => spawnSync(process.execPath, ["--experimental-default-type=module", "--check", f], { encoding: "utf8" });
const bad = files.filter(f => check(f).status !== 0);
for (const f of bad) console.log(check(f).stderr.split("\n").slice(0, 5).join("\n"));
console.log(bad.length ? `syntax: ${bad.length} of ${files.length} scripts don't parse: ${bad.join(", ")}` : `syntax: all ${files.length} scripts parse as modules`);
if (bad.length) process.exit(1);
