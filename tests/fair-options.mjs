// A multiple-choice bank mustn't give its answers away by their length: the right option shouldn't usually be the
// longest, nor much longer than the wrong ones (which were once, in some banks, a few words against a full sentence).
// The banks listed have had their wrong options rewritten as real alternatives of matching length; add a bank here
// once its options are evened out.
const FAIR = ["phil-bank.js", "reasoning-bank.js", "refining-bank.js"];
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
  check(qs.every(q => new Set(q.o).size === q.o.length && q.o.length === 4), `${f}: four distinct options a question`);
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
