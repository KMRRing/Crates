// rich.js tells maths from money: $…$ is maths only when a non-space follows the opening $ and precedes the closing
// one, which no digit follows (Pandoc's rule); \$ is a dollar. Once a plain pair of prices ran the words between them
// together as italic maths ("You've spent 3milliononaterminalthatnowneeds2 million").
import fs from "fs";
const R = await import("../rich.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const maths = t => R.mathParts(t).filter(p => p.tex != null).map(p => p.tex);
check(!R.hasMath("You've spent $3 million on a terminal that now needs $2 million more to finish; its finished value is $1.5 million."), "three prices in a sentence are prices");
check(!R.hasMath("Stop: the $3m is sunk; $2m more buys only $1.5m of value"), "prices with units are prices");
check(R.mathParts("costs $5 and $10").map(p => p.text ?? "").join("") === "costs $5 and $10", "the dollars stay in the text");
check(maths("Solve $2x + 3 = 7$ for $x$.").join("|") === "2x + 3 = 7|x", "inline maths, a digit first included");
check(maths("$2^{10}$ is").join() === "2^{10}" && maths("$$\\int_0^1 x\\,dx$$")[0] === "\\int_0^1 x\\,dx", "powers and displayed maths");
check(R.mathParts("costs \\$5 and $x$").map(p => p.text ?? `[${p.tex}]`).join("") === "costs $5 and [x]", "\\$ is a dollar, beside maths");
// every bank: no maths span reads like a sentence, as prices taken for maths do ("3 million on a terminal that now needs")
const spans = [];
const walk = v => { if (typeof v === "string") { if (v.includes("$")) spans.push(...maths(v)); } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
for (const f of fs.readdirSync(new URL("..", import.meta.url)).filter(f => /-bank\.js$/.test(f))) Object.values(await import(`../${f}`)).forEach(walk);
const prose = spans.filter(t => /\b[a-z]{2,} [a-z]{2,} [a-z]{2,}\b/i.test(t.replace(/\\(text|mathrm|operatorname|textbf|mathbf)\{[^}]*\}/g, "")));
check(spans.length > 100 && !prose.length, `the banks' ${spans.length} maths spans are maths, none prose${prose.length ? `: ${prose.slice(0, 3).join(" / ")}` : ""}`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
