// The stories Order puts in order (kb/items/sequences.js): each long enough to make a line, its events distinct and
// its place in the story the only thing that orders it, with the words Order shows (what to ask, which source it follows).
const { SEQUENCES } = await import("../kb/items/sequences.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
check(SEQUENCES.length >= 5 && new Set(SEQUENCES.map(s => s.id)).size === SEQUENCES.length, `${SEQUENCES.length} stories, each with its own id`);
check(SEQUENCES.every(s => s.steps.length >= 6 && new Set(s.steps).size === s.steps.length), "each has six events or more, all distinct");
check(SEQUENCES.every(s => s.name && s.unit && s.ask && s.note), "each says what it is, what to ask and which source it follows");
check(SEQUENCES.every(s => s.steps.every(t => t.length <= 60)), "every event fits a line of Order (60 characters at most)");
const labours = SEQUENCES.find(s => s.id === "labours");
check(labours?.steps.length === 12 && /Nemean/.test(labours.steps[0]) && /Cerberus/.test(labours.steps[11]), "Heracles' twelve labours, from the Nemean lion to Cerberus");
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
