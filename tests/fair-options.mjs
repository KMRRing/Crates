// A multiple-choice bank mustn't give its answers away by their length: the right option shouldn't usually be the
// longest, nor much longer than the wrong ones (which were once, in some banks, a few words against a full sentence).
// Every choice bank is held to it: their wrong options have been rewritten as real alternatives of matching length.
const FAIR = ["phil-bank.js", "reasoning-bank.js", "refining-bank.js", "phy-bank.js", "chm-bank.js", "eco-bank.js", "cs-bank.js", "rel-bank.js",
  "wine-bank.js", "art-bank.js", "words-bank.js", "maths-bank.js", "cities-bank.js", "flags-bank.js", "patterns-bank.js", "swiss-bank.js", "arch-bank.js", "myth-bank.js", "merchants-bank.js"];   // every choice bank, since October 2026
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
for (const f of FAIR) {
  const { MATHS } = await import(`../${f}`);
  const qs = MATHS.filter(q => q.o?.length >= 3 && q.a?.length === 1);
  let longest = 0, ratio = 0;
  for (const q of qs) {
    const L = q.o.map(o => String(o).length), r = L[q.a[0]], others = L.filter((_, i) => i !== q.a[0]);
    if (r > Math.max(...others)) longest++;
    ratio += r / (others.reduce((a, b) => a + b, 0) / others.length);
  }
  const share = longest / qs.length, mean = ratio / qs.length;
  check(share <= 0.4, `${f}: the right option is the longest in ${Math.round(100 * share)}% of ${qs.length} (at most 40%; chance is 25%)`);
  check(mean <= 1.2, `${f}: the right option is on average ${mean.toFixed(2)}× the wrong ones' length (at most 1.2)`);
  const twins = qs.filter(q => new Set(q.o).size !== q.o.length).map(q => q.id);
  check(!twins.length, `${f}: every question's options are distinct${twins.length ? `: not ${twins.slice(0, 5).join(", ")}` : ""}`);
}
// a question about a movement never names its answer, even by a stem ("…the sincerity of art before Raphael" for the
// Pre-Raphaelites, "…through symbols" for Symbolism)
{
  const { MATHS } = await import("../art-bank.js");
  const stems = name => name.toLowerCase().split(/[\s-]+/).filter(w => w.length >= 5 && !["early", "american", "abstract", "northern"].includes(w)).map(w => w.slice(0, 5));
  const echo = MATHS.filter(q => q.lv === "ideas" && /^Which movement/.test(q.q)).filter(q => stems(q.o[q.a[0]]).some(st => q.q.toLowerCase().includes(st)));
  check(!echo.length, `art: no "which movement" question echoes its answer${echo.length ? `: ${echo.map(q => q.id).join(", ")}` : ""}`);
}
// the same for architecture: a style question never names its style, and a part's definition never says the part's name
{
  const { MATHS } = await import("../arch-bank.js");
  const stems = name => name.toLowerCase().split(/[\s-]+/).filter(w => w.length >= 5 && !["classical", "revival"].includes(w)).map(w => w.slice(0, 5));
  const styleEcho = MATHS.filter(q => q.lv === "styles" && /^Which style/.test(q.q)).filter(q => stems(q.o[q.a[0]]).some(st => q.q.toLowerCase().includes(st)));
  const partEcho = MATHS.filter(q => q.lv === "parts").filter(q => {
    const [name, def] = q.id.endsWith("-what") ? [q.q.replace(/: what is it\?$/, ""), q.o[q.a[0]]] : [q.o[q.a[0]], q.q];
    return stems(name).some(st => def.toLowerCase().includes(st));
  });
  check(!styleEcho.length && !partEcho.length, `architecture: no style question names its answer, no definition says its part's name${styleEcho.length + partEcho.length ? `: ${[...styleEcho, ...partEcho].map(q => q.id).join(", ")}` : ""}`);
}
// mythology: no question about a god says the god's name
{
  const { MATHS } = await import("../myth-bank.js");
  const said = MATHS.filter(q => q.id.startsWith("MY-G-") && !q.id.endsWith("-roman") && q.q.toLowerCase().includes(q.o[q.a[0]].toLowerCase()));
  check(!said.length, `mythology: no god's question names the god${said.length ? `: ${said.map(q => q.id).join(", ")}` : ""}`);
}
// merchants: no question about a power names the power it answers with
{
  const { MATHS } = await import("../merchants-bank.js"), core = t => t.replace(/^The /, "").replace(/ \(.*\)$/, "").toLowerCase();
  const said = MATHS.filter(q => /-(traded|dark)$/.test(q.id) && q.q.toLowerCase().includes(core(q.o[q.a[0]])));
  check(!said.length, `merchants: no power's question names the power${said.length ? `: ${said.map(q => q.id).join(", ")}` : ""}`);
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
