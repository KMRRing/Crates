// Crucible's rules (Settle's files; settle-engine.js, the redesign of 23 November 2026): metal lies by real density, a pour moves all the
// top metal that fits and it sinks to its place, only the top comes out, a crucible holding exactly a mould's recipe casts at once (the
// receiving one first), the solver's par and best move, stars; the later chapters' twists (spare metal, dross and the slag pot, the
// teapot ladle, zinc and charcoal, liquation); and the page wired to it (two views, sound, no limit on pours).
// Run: node tests/settle.mjs
import fs from "node:fs";
import { levelOf, startOf, pour, pourOf, won, movesOf, solve, bestMove, starsFor, topOf, layersOf } from "../settle-engine.js";
import { METALS, MOULDS, mouldOf, CHAPTERS } from "../settle-alloys.js";
import { SOUNDS } from "../settle-sound.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname, read = f => fs.readFileSync(root + f, "utf8");
// the file's own work, in processor time: a wall clock also counts the other tests run beside it
const cpuMs = () => { const u = process.cpuUsage(); return Math.round((u.user + u.system) / 1000); };

// ---------- a crucible and a pour ----------
{
  const L = levelOf({ caps: [4, 4, 4], fill: [["Pb", "Cu", "Sn"], ["Sn", "Sn"], []], moulds: [{ Pb: 1, Sn: 3 }, { Cu: 1 }] });
  check(L.metals.join() === "Pb,Cu,Sn" && METALS.Pb.dens > METALS.Cu.dens && METALS.Cu.dens > METALS.Sn.dens, "metals are kept heaviest first: lead 11.3, copper 9.0, tin 7.3");
  const s = startOf(L);
  check(topOf(s.cups[0]) === 2 && layersOf(s.cups[0]).join() === "0,1,2" && topOf(s.cups[2]) === -1, "a crucible's top is its lightest metal; an empty one has none");
  // the plan's example (settle-alloys' doc): tin across, copper casts, the three tin onto the lone lead casts pewter
  const a = pour(L, s, 0, 1);
  check(a.poured.metal === 2 && a.poured.n === 1 && layersOf(a.state.cups[1]).join() === "2,2,2", "a pour moves the top metal: one tin onto two");
  const b = pour(L, a.state, 0, 2);
  check(b.casts.length === 1 && b.casts[0].mould === 1 && b.state.cups[2].every(v => !v) && b.state.cast[1], "copper alone in a crucible is the copper mould's recipe: cast at once, the crucible empty");
  const c = pour(L, b.state, 1, 0);
  check(c.casts[0]?.mould === 0 && won(c.state), "three tin poured onto one lead lie on top of it, and pewter casts: won in three");
  check(solve(L, s).par === 3 && bestMove(L, s) && won([[0, 1], [0, 2], [1, 0]].reduce((st, [x, y]) => pour(L, st, x, y).state, s)), "the solver's par is three, and its moves win");
  // tin onto the lead first: only one measure fits, and the copper is buried
  const wrong = pour(L, s, 1, 0);
  check(wrong.poured.n === 1 && layersOf(wrong.state.cups[0]).join() === "0,1,2,2" && solve(L, wrong.state).par > 2, "a pour stops at the rim: the rest stays behind (and here the par is lost)");
}
{
  // lead poured onto tin slips under it
  const L = levelOf({ caps: [4, 4], fill: [["Sn", "Sn"], ["Pb"]], moulds: [{ Pb: 1, Sn: 2 }] });
  const r = pour(L, startOf(L), 1, 0);
  check(layersOf(L.start[0]).join() === "1,1" && r.casts.length === 1 && r.casts[0].holds.join() === "1,2", "lead poured onto two tin sinks under them, and fine solder casts");
  const L2 = levelOf({ caps: [3, 3], fill: [["Pb", "Sn"], ["Cu"]], moulds: [{ Pb: 2 }] });
  const s2 = startOf(L2);
  check(pourOf(L2, s2, 0, 1)?.metal === 2 && pourOf(L2, s2, 0, 1).n === 1 && !pourOf(L2, s2, 0, 0) && !pourOf(L2, { ...s2, cups: [[0, 0, 0], s2.cups[1]] }, 0, 1), "only the top comes out; nothing pours into itself or out of an empty crucible");
  const full = levelOf({ caps: [2, 2], fill: [["Pb", "Sn"], ["Cu", "Cu"]], moulds: [{ Pb: 2 }] });
  check(!pourOf(full, startOf(full), 0, 1), "nothing pours into a full crucible");
}
{
  // the receiving crucible casts first; the one poured from casts too when what is left is a recipe
  const L = levelOf({ caps: [4, 4], fill: [["Pb", "Sn", "Sn", "Sn", "Sn"].slice(0, 4), ["Pb"]], moulds: [{ Pb: 1, Sn: 2 }, { Pb: 1, Sn: 1 }] });
  const r = pour(L, startOf(L), 0, 1);
  check(r.poured.n === 3 && r.casts.map(c => c.cup).join() === "", "a pour that leaves no recipe casts nothing");
  const L2 = levelOf({ caps: [4, 3], fill: [["Pb", "Sn", "Sn", "Sn"], ["Pb", "Sn"]], moulds: [{ Pb: 1, Sn: 2 }, { Pb: 1, Sn: 2 }] });
  const r2 = pour(L2, startOf(L2), 0, 1);
  check(r2.casts.length === 2 && r2.casts[0].cup === 1 && won(r2.state), "the receiving crucible casts first, then the one poured from");
}
{
  check(starsFor(6, 6) === 3 && starsFor(6, 5) === 3 && starsFor(6, 8) === 2 && starsFor(6, 9) === 1, "three stars at par, two within two pours of it, else one");
  const L = levelOf({ caps: [3, 3, 3], fill: [["Pb", "Cu", "Sn"], ["Cu", "Sn"], ["Pb", "Sn"]], moulds: [{ Pb: 2 }, { Cu: 2 }, { Sn: 3 }] });
  const all = solve(L, startOf(L));
  check(all.complete && all.par === 6 && movesOf(L, startOf(L)).every(([a, b]) => pourOf(L, startOf(L), a, b)), "the solver searches every state of a level and finds its par");
}

// ---------- the twists (chapters 4 to 8, 23 November 2026) ----------
{
  // spare metal: a crucible casts only its exact recipe
  const spare = levelOf({ caps: [3, 3, 3], fill: [["Cu", "Sn"], ["Cu"], []], moulds: [{ Cu: 2 }] }), s0 = startOf(spare);
  check(!pour(spare, s0, 1, 0).casts.length && pour(spare, pour(spare, s0, 0, 2).state, 1, 0).casts.length === 1, "a crucible with a spare measure in it casts nothing; once the spare is parked elsewhere, it casts");
  // dross floats on everything and spoils a cast; it clings: wherever it is poured, the measure under it goes too; the slag pot never pours
  const dross = levelOf({ caps: [4, 3, 2], kinds: ["", "", "slag"], fill: [["Cu", "Cu", "Cu", "X"], [], []], moulds: [{ Cu: 2 }] });
  const d0 = startOf(dross), name = i => dross.metals[i];
  check(!d0.cast[0] && layersOf(d0.cups[0]).map(name).join() === "Cu,Cu,Cu,X", "dross lies on top of all metal, and a crucible with dross in it does not cast");
  const d1 = pour(dross, d0, 0, 2);
  check(name(d1.poured.under) === "Cu" && layersOf(d1.state.cups[2]).map(name).join() === "Cu,X" && d1.casts.length === 1,
    "dross skimmed into the slag pot takes the measure of copper under it along; the two left cast");
  const d2 = pour(dross, d0, 0, 1);
  check(name(d2.poured.under) === "Cu" && layersOf(d2.state.cups[1]).map(name).join() === "Cu,X" && d2.casts.length === 1,
    "and the same into any other crucible: the rule is the dross's own, not the pot's");
  check(!pourOf(dross, d1.state, 2, 1), "the slag pot never pours");
  const tight = levelOf({ caps: [4, 3, 1], kinds: ["", "", "slag"], fill: [["Cu", "Cu", "X"], [], []], moulds: [{ Cu: 2 }] }), t0 = startOf(tight);
  check(!pourOf(tight, t0, 0, 2), "dross and its measure go together or not at all: a pot for one refuses them");
  const alone = levelOf({ caps: [2, 1], kinds: ["", "slag"], fill: [["X"], []], moulds: [{ Cu: 1 }] });
  check(pourOf(alone, startOf(alone), 0, 1)?.under === -1, "dross on its own takes nothing with it");
  const potted = levelOf({ caps: [2, 2], kinds: ["", "slag"], fill: [[], ["Cu", "Cu"]], moulds: [{ Cu: 2 }] });
  check(!startOf(potted).cast[0], "nothing in the slag pot casts");
  // the teapot ladle pours its heaviest metal, from under the rest
  const tea = levelOf({ caps: [3, 3], kinds: ["teapot", ""], fill: [["Pb", "Sn"], []], moulds: [{ Pb: 1 }, { Sn: 1 }] });
  check(tea.metals[pourOf(tea, startOf(tea), 0, 1).metal] === "Pb" && topOf(startOf(tea).cups[0], "teapot") === 0, "the teapot ladle pours its lead from under the tin");
  // zinc burns in an open crucible once the pour is done, keeps under charcoal (which never pours), and casts first if it finishes a recipe
  const zn = levelOf({ caps: [3, 3, 3], fill: [["Zn", "C"], [], ["Cu", "Cu"]], moulds: [{ Cu: 2, Zn: 1 }] });
  const z0 = startOf(zn), C = zn.metals.indexOf("C"), Zn = zn.metals.indexOf("Zn");
  check(pourOf(zn, z0, 0, 1).metal === Zn && pour(zn, z0, 0, 1).burnt[0]?.cup === 1 && !pour(zn, z0, 0, 1).state.cups[1][Zn], "zinc poured from under its charcoal into an open crucible burns away");
  check(pour(zn, z0, 0, 2).casts.length === 1 && !pour(zn, z0, 0, 2).burnt.length, "zinc that finishes a recipe casts before it can burn");
  check(!pourOf(zn, { ...z0, cups: [[0, 0, 1, 0].slice(0, zn.metals.length).map((_, i) => (i === C ? 1 : 0)), [0, 0, 0], z0.cups[2]] }, 0, 1), "charcoal never pours");
  // liquation: lead onto black copper, a measure for a measure: rich lead and plain copper
  const liq = levelOf({ caps: [3, 3], fill: [["Pb", "Pb"], ["Bk", "Bk"]], moulds: [{ Pr: 2 }, { Cu: 2 }] });
  const l1 = pour(liq, startOf(liq), 0, 1), lname = i => liq.metals[i];
  check(l1.liquated === 1 && layersOf(l1.mid).map(lname).join() === "Pr,Cu,Bk", "one lead poured onto two black copper turns rich and leaves one copper plain (rich lead at the foot, black copper on top)");
}

// ---------- the moulds ----------
{
  check(Object.values(MOULDS).every(m => m.name && m.real) && mouldOf("Cu3").parts.Cu === 3 && mouldOf("pewter").parts.Sn === 3 && mouldOf("pewter").parts.Pb === 1, "every mould has a name and a note of what the real thing is; pure bars by metal and measures");
  check(mouldOf("bell").parts.Cu === 3 && mouldOf("speculum").parts.Cu === 2 && mouldOf("fine").parts.Sn === 2 && mouldOf("plumber").parts.Sn === 1, "bell metal 3:1 copper to tin, speculum 2:1, fine solder 2:1 tin to lead, plumber's 1:1");
  check(CHAPTERS.map(c => c.name).join() === "Settling,Alloys,Measures,Spare metal,Dross,The teapot ladle,Zinc,Liquation" && CHAPTERS.every(c => c.idea),
    "eight chapters (Korbi, 23 Nov 2026: three first, then 'a lot more levels ... think of twists'): Settling, Alloys, Measures, Spare metal, Dross, The teapot ladle, Zinc, Liquation");
}

// ---------- the page ----------
{
  const page = read("settle.js"), html = read("settle.html"), draw = read("settle-draw.js"), d3 = read("settle-3d.js"), css = read("settle.css");
  check(/import\("\.\/settle-3d\.js"\)/.test(page) && /createFlat/.test(page) && /choice\("View", \[\["3d", "3D"\], \["flat", "2D"\]\]/.test(page), "both views, picked in Settings: the 2D foundry and the 3D one (loaded only when wanted)");
  check(/export function createFlat/.test(draw) && /export function createFoundry/.test(d3) && ["layout", "frame", "cupAt", "burst", "mouthOnPage", "resize", "destroy"].every(k => draw.includes(`${k}(`) && d3.includes(k)), "the two views answer the same calls");
  check(!/limit|turns left/i.test(page) && /par/.test(page) && /undo/.test(page) && /restart/.test(page) && /showHint/.test(page), "no limit on pours: a par, Undo, Restart and Hint");
  check(["pick", "pour", "settle", "cast", "refuse", "hint", "undo", "win"].every(k => typeof SOUNDS[k] === "function") && /hearth\(/.test(page), "the sounds: pick, pour (by the metal's weight), settle, cast, refuse, hint, undo, win, and the hearth's roar");
  check(/id="moulds"/.test(html) && /id="foundry"/.test(html) && /id="undoBtn"/.test(html) && /id="restartBtn"/.test(html) && /id="hintBtn"/.test(html), "the page: moulds, the foundry, Undo, Restart, Hint");
  check(!/alert\(|confirm\(|prompt\(/.test(page) && /@media \(orientation: landscape\) and \(min-width: 700px\)/.test(css), "no browser dialogs; laid out beside on a wide screen");
}

check(cpuMs() < 5000, `the whole file runs in under five seconds of processor time (${cpuMs()} ms)`);
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle: the pour, settling, casting, the solver, the moulds and the page hold");
