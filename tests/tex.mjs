// Every piece of maths in the banks is LaTeX that renders: each $…$ span (found as the app finds them, by rich.js's
// mathParts) is parsed by Temml, the renderer the app loads (vendor/temml.min.js), and none may fail; a span that
// fails would show its raw source to the player. The maths bank, typeset in October 2026, must also have matrices
// typeset, not written as [[…]].
import fs from "fs"; import vm from "vm";
const ctx = { window: {}, console }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("../vendor/temml.min.js", import.meta.url), "utf8"), ctx);
const temml = ctx.temml || ctx.window.temml;
globalThis.window ??= {};
const { mathParts } = await import("../rich.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const files = fs.readdirSync(new URL("..", import.meta.url)).filter(f => /-bank\.js$/.test(f) || f === "bank.js");
let spans = 0; const broken = [];
for (const f of files) {
  const B = await import(`../${f}`);
  for (const list of Object.values(B).filter(v => Array.isArray(v) && v[0] && typeof v[0] === "object")) for (const q of list) {
    for (const text of [q.q, q.x, ...(Array.isArray(q.o) ? q.o : []), q.prompt, q.note].filter(t => typeof t === "string")) for (const p of mathParts(text)) if (p.tex != null) {
      spans++;
      try { temml.renderToString(p.tex, { throwOnError: true, displayMode: !!p.display }); } catch (e) { broken.push(`${f} ${q.id}: ${p.tex.slice(0, 60)} (${e.message.slice(0, 60)})`); }
    }
  }
}
check(spans > 5000 && !broken.length, `all ${spans} maths spans in ${files.length} banks render${broken.length ? `: ${broken.slice(0, 4).join(" / ")}` : ""}`);
const { MATHS } = await import("../maths-bank.js");
const bracketed = MATHS.filter(q => [q.q, ...q.o].some(t => /\[\[/.test(t)));
check(!bracketed.length, `the maths bank's matrices are typeset${bracketed.length ? `: ${bracketed.map(q => q.id).join(", ")}` : ""}`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
