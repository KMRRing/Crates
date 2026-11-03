// Heliograph's feature help (heliograph-help.js): every entry's scenes run on the engine and do what the text says, every feature
// the twenty-four levels have has an entry (and a level that comes later cannot bring one that has none), the ids are
// unique, and the numbers in the texts are the engine's. The dialog itself (heliograph-help-ui.js) is the page's, looked at in
// a browser. Run: node tests/heliograph-help.mjs
import { BEACON_BONUS, CLEAR_BONUS, worth, sunAngle, closed, fixtures, pieces } from "../heliograph-engine.js";
import { LEVELS, rulesOf, featuresOf } from "../heliograph-levels.js";
import { FEATURES, ORDER, featureOf, runScene, marksOf, verdictOf } from "../heliograph-help.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const fmt = n => n.toLocaleString("en-GB");
const ids = FEATURES.map(f => f.id);
// the picture's frame (heliograph-help-ui.js: view -5 -15.3 10 9.2, y upward in the engine): all of a scene must lie in it
const FRAME = { left: -5, right: 5, top: 15.3, bottom: 6.1 };

// ---------- the entries ----------
{
  check(new Set(ids).size === ids.length && ids.every(id => /^[a-z]+$/.test(id)), "every entry has an id of its own");
  check(ORDER.length === ids.length && ORDER.every((id, k) => id === ids[k]), "the teaching order names every entry once, in the order they are written");
  check(FEATURES.every(f => f.name && f.lines.length >= 1 && f.lines.length <= 3 && f.lines.every(l => l.length <= 200)), "each entry has a name and one to three short lines");
  check(FEATURES.every(f => f.scenes.length >= 1 && f.scenes.length <= 3), "each entry has one scene, or up to three to show in turn");
  // the numbers a text may mention are the engine's: a worked shot's score and the two bonuses; the rest are words
  const allowed = new Set([worth(3, 3), BEACON_BONUS, CLEAR_BONUS]);
  const numbers = FEATURES.flatMap(f => [f.name, ...f.lines].flatMap(t => (t.match(/\d[\d,]*/g) || []).map(n => Number(n.replace(/,/g, "")))));
  check(numbers.every(n => allowed.has(n)), `no text names a number the engine does not give (${[...new Set(numbers)].join(", ") || "none"})`);
  const said = (id, n) => featureOf(id).lines.join(" ").includes(String(n));
  check(said("quota", worth(3, 3)) && said("beacons", BEACON_BONUS) && said("clear", fmt(CLEAR_BONUS)), "the quota's text says the worked shot's score, the lanterns' and the clearing's the engine's bonuses");
  // the enamels are the theme's, so a colour is shown and never named
  const named = FEATURES.flatMap(f => [f.name, ...f.lines, ...f.scenes.map(s => s.caption)]).filter(t => /\b(red|green|blue|gold|golden|yellow|ochre|orange|purple)\b/i.test(t));
  check(named.length === 0, `no text or caption names a colour (${named.join(" | ") || "none"})`);
}

// ---------- every scene is a real shot and does what its entry says ----------
{
  let ok = true, why = "";
  for (const f of FEATURES) f.scenes.forEach((spec, n) => {
    const { s, r } = runScene(spec), e = spec.expect || {}, name = `${f.id} ${n + 1}`;
    const there = [...pieces(s).map(q => q.p), ...s.mirrors.map(m => m.p), s.x.port, ...s.crystals.map(c => [c.x, c.y, c.z]), ...fixtures(s).map(x => x.p)];
    const problems = [
      !Object.keys(e).length && "says nothing it is held to",
      !spec.caption && "no caption",
      there.some(p => p[0] < FRAME.left + 0.2 || p[0] > FRAME.right - 0.2 || p[1] > FRAME.top - 0.2 || p[1] < FRAME.bottom + 0.2) && "something stands at or beyond the picture's edge",
      e.shattered != null && r.shattered.length !== e.shattered && `${r.shattered.length} shattered, not ${e.shattered}`,
      e.fallen != null && r.fallen.length !== e.fallen && `${r.fallen.length} fell, not ${e.fallen}`,
      e.gain != null && r.gain !== e.gain && `${r.gain} points, not ${e.gain}`,
      e.stop != null && r.path.stop.what !== e.stop && `the light stops at ${r.path.stop.what}, not ${e.stop}`,
      e.downed != null && r.downed !== e.downed && `${r.downed} lanterns down, not ${e.downed}`,
      e.cleared != null && r.cleared !== e.cleared && `${r.cleared ? "cleared" : "not cleared"}, not ${e.cleared ? "cleared" : "not"}`,
      spec.lantern && !s.x.beacons?.length && "a lantern that is not in the chandelier",
      spec.lantern && spec.goal !== "beacons" && "a lantern in a level that does not ask for it",
      f.scenes.length > 1 && !verdictOf({ spec }) && "a contrast with no word to tell its scenes by",
    ].filter(Boolean);
    if (problems.length) { ok = false; why += `${name}: ${problems.join("; ")}. `; }
  });
  check(ok, ok ? "every scene is a shot of the engine that does what its entry expects, and lies inside the picture" : why);
  // the scenes of a contrast differ in their outcome, which is what the pair is for (the sun's three differ in the light, below)
  const shot = ({ r }) => [r.shattered.length, r.fallen.length, r.downed, r.cleared, r.path.stop.what].join();
  const pairs = FEATURES.filter(f => f.scenes.length > 1 && f.id !== "sun");
  check(pairs.every(f => new Set(f.scenes.map(sp => shot(runScene(sp)))).size === f.scenes.length), `the scenes of a pair end differently (${pairs.map(f => f.id).join(", ")})`);
}

// ---------- the claims in the texts, one at a time ----------
{
  const scene = (id, n = 0) => runScene(featureOf(id).scenes[n]);
  const q = scene("quota");
  check(q.r.shattered.length === 3 && q.r.fallen.length === 3 && q.r.gain === worth(3, 3), "the quota's shot: three shattered, three fallen, and what the text says it is worth");
  const [cut, hung] = [scene("beacons", 0), scene("beacons", 1)];
  check(cut.r.downed === 1 && hung.r.downed === 0 && cut.r.gain - hung.r.gain === BEACON_BONUS, "a lantern below the cut falls and is paid for; one above it hangs on");
  const [first, last] = [scene("clear", 0), scene("clear", 1)];
  check(!first.r.cleared && last.r.cleared && last.r.gain === worth(3, 0) + CLEAR_BONUS && last.s.layers.length > 0, "clearing: the first shot leaves a string, the second brings it down and the bonus is paid");
  check(!first.r.dropped && !last.r.dropped && first.r.state.layers.length <= first.s.layers.length, "and nothing is hung lower, or hung again, in between");
  const [prism, plain] = [scene("prism", 0), scene("prism", 1)];
  check(prism.r.shattered.length > plain.r.shattered.length && prism.r.path.legs.at(-1).cs.length === 2 && plain.r.path.legs.at(-1).cs.length === 1 && prism.r.path.cross.some(x => x.kind === "prism") && !prism.r.path.crossed.length, "the prism's two colours shatter what one colour stops at, and it is not spent");
  const [shut, beside] = [scene("shutter", 0), scene("shutter", 1)];
  check(shut.r.path.stop.what === "shutter" && shut.r.gain === 0 && beside.r.path.stop.what !== "shutter" && beside.r.gain > 0, "a shutter in the way stops the light; beside it, the same shot goes through");
  const [b0, b1] = [scene("blink", 0), scene("blink", 1)];
  const strip = sp => JSON.stringify({ ...sp, shots: 0, caption: 0, expect: 0 });
  const f0 = fixtures(b0.s)[0];
  check(strip(featureOf("blink").scenes[0]) === strip(featureOf("blink").scenes[1]) && closed(b0.s, f0) && !closed(b1.s, fixtures(b1.s)[0]) && b0.r.path.stop.what === "shutter" && b1.r.path.stop.what !== "shutter", "the shutter that opens is the same scene on two shots, shut on the first and open on the second");
  const frames = featureOf("sun").scenes.map(sp => runScene(sp));
  const angle = ({ s }) => sunAngle(s);
  check(angle(frames[0]) > 0 && Math.abs(angle(frames[1])) < 1e-9 && angle(frames[2]) < 0 && frames.every(fr => fr.r.shattered.length === 2), "the sun's frames: leaning one way, straight, leaning the other; the same two crystals go in each");
  check(new Set(frames.map(fr => fr.s.mirrors[0].p[0].toFixed(3))).size === 3, "and the first mirror stands where the light falls on it in each, so it moves with the sun");
  // the marks in a corner of a picture
  check(marksOf(q).join() === `3 shattered,3 fell,+${fmt(worth(3, 3))}` && marksOf(shut).join() === "stopped" && marksOf(cut).includes("lantern down") && marksOf(last).includes("cleared") && marksOf(hung).every(m => !m.includes("lantern")), "the marks a scene ends with are what the shot brought and nothing else");
}

// ---------- the twenty-four levels: no feature without an entry ----------
{
  let ok = true, why = "";
  LEVELS.forEach(L => {
    const got = featuresOf(rulesOf(L.n));
    const lost = got.filter(id => !featureOf(id));
    if (lost.length) { ok = false; why += `${L.n + 1} ${L.name}: no entry for ${lost.join(" ")}. `; }
    if (got.join() !== ORDER.filter(id => got.includes(id)).join()) { ok = false; why += `${L.n + 1}: not in teaching order. `; }
  });
  check(ok, ok ? "each level's features have an entry, listed in teaching order" : why);
  const all = new Set(LEVELS.flatMap(L => featuresOf(rulesOf(L.n))));
  check(ids.every(id => all.has(id)), `every entry is a feature some level has (${ids.filter(id => !all.has(id)).join(" ") || "none left over"})`);
  // a level's help opens once for what it newly brings: never for more than two things at a time
  const seen = new Set(), news = LEVELS.map(L => { const fresh = featuresOf(rulesOf(L.n)).filter(id => !seen.has(id)); fresh.forEach(id => seen.add(id)); return fresh; });
  check(news.every(n => n.length <= 2), `no level brings more than two new things at once (${news.map((n, k) => (n.length ? `${k + 1}: ${n.join("+")}` : "")).filter(Boolean).join(", ")})`);
  check(news[0].join() === "quota" && news.slice(0, 4).every(n => n.length <= 1), "the ladder starts with the quota, and its first four levels bring one thing at most");
}

console.log(bad ? `${bad} problems` : "heliograph help: every check passed");
if (bad) process.exitCode = 1;
