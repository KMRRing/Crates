// Crucible's levels (settle-levels.js, made by settle-plan.mjs into settle-book.js; the redesign of 23 November 2026): 70 in eight
// chapters that grow longer, each proved again (tests/settle-prove.js; chapter eight in tests/settle-late.mjs): nothing
// casts before a pour, the solver's par and hardness are the stored ones,
// each chapter gets harder from its third level and ends harder than the one before (24 Nov 2026, Korbi: "Progression on the
// crucible levels way too shallow"), from a chapter's third level on at most two first pours keep the par; chapters one and two keep every crucible
// one size, three mixes them; a chapter's idea (spare metal, dross and the slag pot, the teapot ladle, zinc and charcoal, liquation)
// never shows before its chapter; and the Random and Today's melts, the same on every device and made quickly.
// Run: node tests/settle-levels.mjs
import { LEVELS, CHAPTERS, gradeOf, meltOf, MELTS } from "../settle-levels.js";
import { mouldOf } from "../settle-alloys.js";
import { problemsOf } from "./settle-prove.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
// the file's own work, in processor time: a wall clock also counts the other tests run beside it
const cpuMs = () => { const u = process.cpuUsage(); return Math.round((u.user + u.system) / 1000); };

const sizes = CHAPTERS.map(C => LEVELS.filter(L => L.ch === C.id).length);
check(LEVELS.length === 70 && sizes.join() === "8,8,8,8,9,9,10,10" && LEVELS.every(L => L.id === `${L.ch}-${LEVELS.filter(M => M.ch === L.ch).indexOf(L) + 1}`),
  `70 levels in eight chapters that grow longer (${sizes.join(", ")}), in order`);
check(LEVELS.every(L => L.name && L.tip && L.tip.length <= 140), "every level has a name and a tip");
{
  const problems = [];
  for (const L of LEVELS.filter(L => L.ch <= 7)) problems.push(...problemsOf(L));
  check(!problems.length, `every level of chapters one to seven starts with nothing cast, its par and hardness proved, metal enough for its moulds (exactly, before Spare metal), its crucibles as its chapter wants, no idea before its chapter, and few right first pours (eight's: tests/settle-late.mjs)${problems.length ? `: ${problems.join("; ")}` : ""}`);
  // a chapter's first two bring in its idea, so the climb is counted from its third; its last is its hardest, and harder than the
  // last chapter's last, so the book never eases off
  const hards = CHAPTERS.map(C => LEVELS.filter(L => L.ch === C.id).map(L => L.hard));
  const climbs = hards.every((h, c) => h.slice(2).every((x, k, a) => !k || x >= a[k - 1]) && h.at(-1) === Math.max(...h) && (!c || h.at(-1) >= hards[c - 1].at(-1)));
  check(climbs, `every chapter gets harder from its third level, and each ends harder than the one before (${hards.map(h => h.map(x => x.toFixed(1)).join(" ")).join(" | ")})`);
  check(LEVELS.filter(L => L.ch === 2).every(L => L.moulds.some(id => Object.keys(mouldOf(id).parts).length > 1)), "every Alloys level has a mould that is a mix");
}
{
  const a = MELTS.map((_, k) => meltOf(k, 4242)), b = MELTS.map((_, k) => meltOf(k, 4242));
  check(a.every((L, k) => L.id === "melt" && L.seed && JSON.stringify(L) === JSON.stringify(b[k])), "a melt from a seed is the same on every device, on every rung");
  check(a.every((L, k) => L.par >= MELTS[k].par[0] && L.par <= MELTS[k].par[1] && gradeOf(L).ok), "every rung's melt is a puzzle with its par in the rung's range");
  const days = [20261123, 20261124, 20261125, 20261126, 20261127].map(d => meltOf("daily", d)), key = d => JSON.stringify([d.fill.map(f => f.join("")).sort(), d.moulds.slice().sort()]);
  check(new Set(days.map(key)).size === 5 && days.every(d => d.par >= 6 && d.par <= 10), "today's melt changes with the day (five days, five melts), par 6 to 10");
}

check(cpuMs() < 5000, `the whole file runs in under five seconds of processor time (${cpuMs()} ms)`);
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle levels: every level proved, the curve, the melts");
