// Every script parses as the ES module the browser loads it as. Plain `node --check` misses a module's syntax errors
// (Node 22 falls back quietly and exits 0), which once let a missing brace in solo.js stop Crates at "Loading".
// Each file is parsed as a module in this process (vm.SourceTextModule, which needs a flag, so the test starts itself again
// with it): 700 scripts took 33 seconds as one `node --check` each, and take about one now.
import vm from "node:vm";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
if (!vm.SourceTextModule) {
  const again = spawnSync(process.execPath, ["--experimental-vm-modules", "--no-warnings", new URL(import.meta.url).pathname], { stdio: "inherit" });
  process.exit(again.status ?? 1);
}
const files = [".", "tools", "kb"].flatMap(dir => {
  try { return readdirSync(dir).filter(f => f.endsWith(".js") && f !== "sw.js").map(f => (dir === "." ? f : `${dir}/${f}`)); } catch { return []; }
});
const bad = [];
for (const f of files) {
  try { new vm.SourceTextModule(readFileSync(f, "utf8"), { identifier: f }); }
  catch (e) { bad.push(f); console.log(`${f}: ${String(e.message).split("\n")[0]}`); }
}
console.log(bad.length ? `syntax: ${bad.length} of ${files.length} scripts don't parse: ${bad.join(", ")}` : `syntax: all ${files.length} scripts parse as modules`);
if (bad.length) process.exit(1);
