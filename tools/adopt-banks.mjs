// Brings hand edits of built choice banks back into kb/, the knowledge base they're written from. A bank such as
// refining-bank.js is built from kb/items/choice/refining.js; edit the bank instead and tests/kb.mjs finds it stale,
// and a rebuild would quietly undo the edit. This copies each question's fields (q, o, a, s, x, d, lv, area, svg, code)
// from every stale bank into its kb file by id, rebuilds, and checks the rebuilt bank is byte-identical to the edited
// one; if not, it restores the edited bank and the kb file and says so, so nothing is ever lost.
// Run: node tools/adopt-banks.mjs
import fs from "fs";
import { execFileSync } from "child_process";
const root = new URL("..", import.meta.url), at = f => new URL(f, root);
const FIELDS = ["q", "o", "a", "s", "x", "d", "lv", "area", "svg", "code"];
const choice = fs.readdirSync(at("kb/items/choice/")).filter(f => f.endsWith(".js")).map(f => {
  const head = fs.readFileSync(at(`kb/items/choice/${f}`), "utf8").split("\n", 1)[0];
  return { src: `kb/items/choice/${f}`, bank: (head.match(/the bank ([\w-]+\.js) is written from this/) || [])[1] };
}).filter(c => c.bank && fs.existsSync(at(c.bank)));
const edited = new Map(choice.map(c => [c.bank, fs.readFileSync(at(c.bank), "utf8")]));
const sources = new Map(choice.map(c => [c.src, fs.readFileSync(at(c.src), "utf8")]));
let adopted = 0;
for (const { src, bank } of choice) {
  const { MATHS } = await import(`${at(bank).href}?adopt=${Date.now()}`);
  const byId = new Map((MATHS || []).map(q => [q.id, q]));
  const lines = sources.get(src).split("\n");
  let changed = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\{"id":"[^"]+".*\})(,?)$/);
    if (!m) continue;
    const item = JSON.parse(m[1]), q = byId.get(item.id);
    if (!q) continue;
    const before = JSON.stringify(item);
    for (const k of FIELDS) if (k in q) item[k] = q[k];
    if (JSON.stringify(item) !== before) { lines[i] = JSON.stringify(item) + m[2]; changed++; }
  }
  if (changed) { fs.writeFileSync(at(src), lines.join("\n")); adopted++; console.log(`${src}: ${changed} questions taken from ${bank}`); }
}
execFileSync(process.execPath, [new URL("build-kb.mjs", import.meta.url).pathname], { stdio: "ignore" });
const differ = choice.filter(c => fs.readFileSync(at(c.bank), "utf8") !== edited.get(c.bank));
if (differ.length) {                                                  // put everything back: never lose an edit
  for (const c of choice) { fs.writeFileSync(at(c.bank), edited.get(c.bank)); fs.writeFileSync(at(c.src), sources.get(c.src)); }
  console.log(`not adopted: rebuilding wouldn't reproduce ${differ.map(c => c.bank).join(", ")} exactly (an edit outside ${FIELDS.join(", ")}?); everything is as it was`);
  process.exitCode = 1;
} else console.log(adopted ? "adopted: every edited bank rebuilds byte-identical from kb/" : "nothing to adopt: every choice bank is current");
