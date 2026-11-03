// The curriculum map holds together: every topic has one cell for each of the fifteen systems and an IB letter, unique ids,
// every system has a source note, and the rule classifies each topic.
import { SYSTEMS, TOPICS, SOURCES } from "../kb/audit/curriculum.js";
import { THRESHOLD, classify, votes } from "../tools/audit-lib.mjs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
check(SYSTEMS.length === 15 && SYSTEMS.every(s => SOURCES[s]) && SOURCES.ib, "fifteen systems and the IB each say what was reached");
check(SYSTEMS.every(s => SOURCES[s].how === "recall" || SOURCES[s].urls.length), "a system marked fetched names its URL");
check(new Set(TOPICS.map(t => t.id)).size === TOPICS.length, `${TOPICS.length} topics, every id unique`);
const odd = TOPICS.filter(t => !/^[FK?-]{15}$/.test(t.cells) || !/^[FK?-]$/.test(t.ib));
check(!odd.length, `every topic has one cell for each system${odd.length ? `: ${odd.map(t => t.id)}` : ""}`);
const n = { u: 0, r: 0, s: 0 };
for (const t of TOPICS) n[classify(t)]++;
check(n.u + n.r + n.s === TOPICS.length, `at ${THRESHOLD} of 15: ${n.u} universal, ${n.r} regional, ${n.s} specialist`);
check(TOPICS.every(t => votes(t) <= 15), "no topic has more votes than systems");
process.exit(bad ? 1 : 0);
