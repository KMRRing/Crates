// Brut: the wines and cards are sound, flights are fair, the candidates are six distinct wines of the same colour
// (or rosé with reds) including the answer, and scoring falls with stages and wrong calls.
const { WINES } = await import("../brut-data.js");
const E = await import("../brut-engine.js");
const { STAGES, MATHS } = await import("../wine-bank.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const inRange = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
check(new Set(WINES.map(w => w.id)).size === WINES.length && WINES.every(w => w.name && w.grape && w.region && /^#[0-9A-F]{6}$/i.test(w.hue) && w.nose.length >= 3 && inRange(w.sweet, 0, 4) && inRange(w.acid, 1, 5) && inRange(w.tannin, 0, 5) && inRange(w.alc, 1, 5) && inRange(w.body, 1, 5) && w.tell && (w.colour !== "white" || w.tannin === 0)),
  `${WINES.length} wines, unique, every level in range, whites without tannin`);
const units = new Set(STAGES.map(s => s.id));
check(new Set(MATHS.map(c => c.id)).size === MATHS.length && MATHS.every(c => units.has(c.lv) && c.o.length === 4 && new Set(c.o).size === 4 && c.a.length === 1 && c.o[c.a[0]] && c.fact && c.x && c.q),
  `${MATHS.length} cards in ${STAGES.length} units, four distinct options each, one right`);
let fair = 0, optionsOk = 0;
for (let s = 1; s <= 200; s++) {
  const f = E.pickFlight(s).map(id => E.byId.get(id));
  if (f.length === E.FLIGHT && new Set(f.map(w => w.id)).size === E.FLIGHT && f.filter(w => w.colour === "white").length >= 2 && f.filter(w => w.colour === "red").length >= 2) fair++;
  for (const w of f) {
    const o = E.optionsFor(w, s).map(id => E.byId.get(id));
    if (o.length === E.OPTIONS && new Set(o.map(x => x.id)).size === E.OPTIONS && o.some(x => x.id === w.id) && o.every(x => x.colour === w.colour || (w.colour === "rosé" && x.colour === "red"))) optionsOk++;
  }
}
check(fair === 200, "200 flights: six different wines, at least two whites and two reds");
check(optionsOk === 1200, "every wine's six candidates are distinct, include it, and share its colour");
check(E.optionsFor(E.byId.get("chablis"), 7).join() === E.optionsFor(E.byId.get("chablis"), 7).join(), "the candidates are the same for the same seed");
check(E.points(0, 0) === 100 && E.points(2, 0) === 45 && E.points(1, 2) === 40 && E.points(3, 3) === 0, "points: 100 on sight, 45 on the palate, 15 off a wrong call, never below zero");
check(/Sight: .*Nose: .*Palate: dry, high acidity, medium− alcohol/.test(E.noteText(E.byId.get("chablis"))), "the note reads as text for a review card");
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
