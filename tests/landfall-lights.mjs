// Landfall's lights by their character (landfall-lights.js and the engine's "light" on a coast of several): every light's character
// reads, flashes as many times a period as it says, and is told apart from its neighbours; a light named rightly is a line through its
// tower, one taken for another a line through the wrong tower. Run: node tests/landfall-lights.mjs
import { LEVELS } from "../landfall-levels.js";
import { parseChar, lightOn, flashTimes, charWords } from "../landfall-lights.js";
import { newVoyage, apply, moves, levelOf } from "../landfall-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
/** Flashes (rises above half bright) and the share of the time lit, over one period sampled finely. */
const count = ch => { const c = parseChar(ch), P = c.period || 10; let n = 0, lit = 0, was = lightOn(c, -0.01) > 0.5; for (let t = 0; t < P; t += 0.01) { const on = lightOn(c, t) > 0.5; if (on && !was) n++; if (on) lit++; was = on; } return { n, lit: lit / (P / 0.01) }; };

check(count("Fl 5s").n === 1 && count("Fl(2) 10s").n === 2 && count("Fl(3) 15s").n === 3 && count("Fl R 5s").n === 1, "a flashing light flashes as many times a period as its group says");
check(count("Oc 6s").lit > 0.7 && count("Iso 4s").lit > 0.45 && count("Iso 4s").lit < 0.55 && count("F").lit > 0.99 && count("Fl(2) 10s").lit < 0.15, "occulting is lit longer than dark, isophase half and half, fixed always, flashing mostly dark");
check(flashTimes("Fl(3) 15s").length === 3 && flashTimes("Oc 6s").length === 0 && flashTimes("Fl 5s")[0] > 0, "a turning lens has a beam for each flash of its group, a fixed lens none");
check(charWords("Fl(2) 10s") === "two flashes every 10 seconds" && charWords("Fl R 5s") === "one flash every 5 seconds, red" && /eclipse/.test(charWords("Oc 6s")), "a character reads aloud as the List of Lights would");
let threw = false; try { parseChar("Blink 3s"); } catch { threw = true; }
check(threw, "a character the chart would not print is refused");

const MANY = LEVELS.filter(L => L.lights);
check(MANY.filter(L => L.section === 11).length >= 3 && MANY.every(L => L.section >= 11), `the lights have their own chapter, and come back after it (${MANY.map(L => L.name).join(", ")})`);
for (const L of MANY) {
  const sig = L.lights.map(g => { const c = parseChar(g.ch); return `${c.kind}${c.n}${c.colour}${c.period}`; });
  check(new Set(sig).size === sig.length && L.lights.every(g => g.range >= 12), `${L.name}: no two of its lights share a character`);
}

// naming a light in play: named rightly it is a line through its own tower and brings the reckoning nearer the truth; taken for
// another it is a line through the wrong tower, refused if the fog is small enough to see it, and otherwise a worse place
function naming(id) {
  let right = 0, through = 0, tried = 0, once = true, better = 0, eR = 0, eW = 0;
  for (let seed = 1; seed <= 120 && tried < 14; seed++) {
    const S = newVoyage(id, seed), L = levelOf(S);
    for (let i = 0; i < 30 && S.phase !== "end" && !(S.phase === "find" && S.watch.lights?.some(l => l.seen)); i++) {
      if (S.phase === "ritual") apply(S, { t: "step", d: S.leg.run });
      else if (S.phase === "find") apply(S, { t: "skipsight" });
      else apply(S, { t: "sail", course: (Math.atan2(L.harbour.x - S.T[0], L.harbour.y - S.T[1]) * 180 / Math.PI + 360) % 360 });
    }
    if (S.phase !== "find") continue;
    tried++;
    const at = S.watch.lights.findIndex(l => l.seen), other = (at + 1) % L.lights.length, twin = structuredClone(S);
    const r = apply(S, { t: "light", at, as: at }), w = apply(twin, { t: "light", at, as: other });
    if (r.accepted && S.watch.plot.line.name === L.lights[at].name && S.watch.plot.line.p[0] === L.lights[at].x) right++;
    if (!w.accepted || twin.watch.plot.line.name === L.lights[other].name) through++;
    const er = Math.hypot(S.E[0] - S.T[0], S.E[1] - S.T[1]), ew = Math.hypot(twin.E[0] - twin.T[0], twin.E[1] - twin.T[1]);
    if (er < ew) better++;
    eR += er; eW += ew;
    if (S.watch.lights[at].done !== true || !moves(S).includes("light") === S.watch.lights.some(l => l.seen && !l.done)) once = false;
  }
  return { right, through, tried, once, better, eR: eR / tried, eW: eW / tried };
}
for (const id of ["which-light", "cross-bearings", "count-the-flashes"]) {
  const a = naming(id);
  check(a.tried >= 5 && a.right >= 0.8 * a.tried && a.through === a.tried && a.once, `${id}: named rightly a light is a line through its own tower, taken for another one through the wrong tower, each once a watch (${a.right}/${a.tried})`);
  check(a.better >= 0.6 * a.tried && a.eW > a.eR, `${id}: the right name leaves the reckoning nearer the truth than the wrong one (${a.better}/${a.tried}; ${a.eR.toFixed(1)} against ${a.eW.toFixed(1)} nm)`);
}
{
  const old = newVoyage("the-light-on-the-skerry", 2);
  check(!("lights" in old.watch), "a level with one light keeps its one light, as before");
}
process.exit(bad ? 1 : 0);
