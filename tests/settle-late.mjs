// Crucible's chapter eight (the liquation) proved level by level as tests/settle-levels.mjs proves the rest (tests/settle-prove.js):
// its solves are the book's biggest, so it is a file of its own and each stays under five seconds.
// Run: node tests/settle-late.mjs
import { LEVELS } from "../settle-levels.js";
import { problemsOf } from "./settle-prove.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const cpuMs = () => { const u = process.cpuUsage(); return Math.round((u.user + u.system) / 1000); };

const late = LEVELS.filter(L => L.ch === 8), problems = late.flatMap(problemsOf);
check(late.length === 10 && !problems.length, `chapter eight's ${late.length} levels each start with nothing cast, their par and hardness proved, metal enough for their moulds, and few right first pours${problems.length ? `: ${problems.join("; ")}` : ""}`);
check(cpuMs() < 5000, `the whole file runs in under five seconds of processor time (${cpuMs()} ms)`);
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle late: chapter eight proved");
