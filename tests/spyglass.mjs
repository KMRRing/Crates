// Spyglass: only pictures that may be shown are in the pools (no painter who died after 1955, none painted after 1930);
// a run is five pictures dealt by level, the same for a seed, no answer twice; a picture sharpens steadily from a blurred
// small crop to the whole; a right answer is worth less the later it comes and 15 less per wrong guess; typed guesses are
// forgiving of case, accents, surnames and the usual short names, and of nothing else.
// Run: node tests/spyglass.mjs
const E = await import("../spyglass-engine.js");
const { MATHS: ART } = await import("../art-bank.js");
const { MATHS: FLAGS } = await import("../flags-bank.js");
const { COUNTRIES, REGION_OF } = await import("../chart-countries.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };

// ---------- the pools ----------
const paint = E.paintings(ART), flag = E.flags(FLAGS), outline = E.outlines(COUNTRIES, REGION_OF), pools = { painting: paint, flag, outline };
check(paint.length >= 150, `paintings left after the licence filter (${paint.length})`);
check(paint.every(p => p.year <= 1930 && !E.LATE.has(p.answer)), "no painting after 1930 or by a painter in LATE");
for (const name of ["Pablo Picasso", "Salvador Dalí", "Andy Warhol", "Frida Kahlo", "Edward Hopper"]) check(!paint.some(p => p.answer === name), `${name} is out`);
for (const name of ["Leonardo da Vinci", "Claude Monet", "Vincent van Gogh", "Henri Matisse", "Wassily Kandinsky"]) check(paint.some(p => p.answer === name), `${name} is in`);
check(paint.every(p => p.options.includes(p.answer) && new Set(p.options).size === p.options.length), "every painting's options hold its answer once");
check(flag.length >= 190 && flag.every(f => f.options.includes(f.answer)), `flags (${flag.length}), each among its options`);
check(outline.length >= 60 && outline.length <= 160, `outlines (${outline.length}): the larger countries only`);
check(outline.some(o => o.name === "France") && !outline.some(o => o.name === "Luxembourg"), "France has an outline worth showing, Luxembourg not");
check(new Set(outline.map(o => o.name)).size === outline.length, "no outline twice");

// ---------- a deal ----------
for (const level of E.LEVELS) for (const seed of [1, 2, 3, 99]) {
  const run = E.dealRun(seed, level, pools), again = E.dealRun(seed, level, pools);
  check(run.items.length === E.ROUNDS, `${level} ${seed}: five pictures`);
  check(JSON.stringify(run) === JSON.stringify(again), `${level} ${seed}: the same seed, the same run`);
  const kinds = run.items.map(i => i.kind).sort().join();
  check(kinds === "flag,flag,outline,painting,painting", `${level} ${seed}: two paintings, two flags, an outline (${kinds})`);
  check(new Set(run.items.map(i => i.answer)).size === E.ROUNDS, `${level} ${seed}: no answer twice`);
  for (const i of run.items) {
    check(i.options.length === (E.CHOICES[level] ? Math.max(4, E.CHOICES[level]) : 0) || (E.CHOICES[level] && i.options.length >= 4), `${level}: ${i.answer} has ${i.options.length} options`);
    check(!E.CHOICES[level] || (i.options.includes(i.answer) && new Set(i.options).size === i.options.length), `${level}: ${i.answer} is among its options once`);
    check(i.cx >= 0.3 && i.cx <= 0.7 && i.cy >= 0.3 && i.cy <= 0.7, `${level}: the first look is near the middle`);
  }
}
check(E.dealRun(1, "medium", pools).items.every(i => i.options.length === 8), "medium: eight options");
check(E.dealRun(1, "hard", pools).items.every(i => i.options.length === 0), "hard: none, typed");
check(JSON.stringify(E.dealRun(1, "easy", pools)) !== JSON.stringify(E.dealRun(2, "easy", pools)), "another seed, another run");
check(E.dealRun(5, "easy", pools).items.filter(i => i.kind === "flag").every(i => i.lv === "ea"), "easy flags are the well known ones");
check(E.dealRun(5, "hard", pools).items.filter(i => i.kind === "flag").every(i => i.lv !== "ea"), "hard flags are not");

// ---------- sharpening ----------
let last = E.focus(0);
check(last.res <= 8 && last.zoom <= 0.31, `it starts blurred and close (${last.res} px, ${last.zoom})`);
for (let k = 1; k <= 20; k++) { const f = E.focus(k / 20); check(f.res >= last.res && f.zoom >= last.zoom, `sharpening never reverses (${k}/20)`); last = f; }
check(last.res === 640 && Math.abs(last.zoom - 1) < 1e-9, "at the end it is sharp and whole");
check(E.focus(-1).res === E.focus(0).res && E.focus(9).res === 640, "outside its time it stays at its ends");
check(E.fraction(12.5, "easy") === 0.5 && E.fraction(99, "hard") === 1 && E.fraction(-3, "easy") === 0, "the fraction of the time gone, 0 to 1");

// ---------- scoring ----------
check(E.worth(0) === 100 && E.worth(1) === 10 && E.worth(0.5) === 55, "100 falling to 10");
check(E.worth(0, 1) === 85 && E.worth(1, 1) === 0 && E.worth(1, 5) === 0, "15 off for each wrong guess, never below 0");
check(E.worth(0.2) > E.worth(0.4), "earlier is worth more");

// ---------- typed answers ----------
const who = name => ({ kind: "painting", answer: name }), country = name => ({ kind: "flag", answer: name });
check(E.matches(who("Leonardo da Vinci"), "leonardo da vinci") && E.matches(who("Leonardo da Vinci"), "da Vinci") && E.matches(who("Leonardo da Vinci"), "Leonardo") && E.matches(who("Leonardo da Vinci"), "vinci"), "Leonardo by full name, da Vinci, Leonardo or vinci");
check(E.matches(who("Vincent van Gogh"), "Van Gogh") && E.matches(who("Vincent van Gogh"), "gogh") && E.matches(who("Vincent van Gogh"), "Vincent van Gogh"), "van Gogh");
check(E.matches(who("Albrecht Dürer"), "durer") && E.matches(who("Albrecht Dürer"), "Dürer"), "Dürer with or without the umlaut");
check(E.matches(who("Hans Holbein the Younger"), "Holbein") && E.matches(who("Pieter Bruegel the Elder"), "bruegel"), "the Younger and the Elder are optional");
check(E.matches(who("Henri de Toulouse-Lautrec"), "Toulouse-Lautrec") && E.matches(who("Henri de Toulouse-Lautrec"), "lautrec"), "Toulouse-Lautrec");
check(E.matches(who("Jean-Auguste-Dominique Ingres"), "Ingres"), "Ingres");
check(E.matches(who("Michelangelo"), "Michelangelo") && !E.matches(who("Michelangelo"), "Michel"), "a single name must be whole");
check(!E.matches(who("Claude Monet"), "Claude") && !E.matches(who("Claude Monet"), "Manet") && !E.matches(who("Claude Monet"), ""), "a first name alone is not enough; a near miss is a miss");
check(!E.matches(who("Pieter de Hooch"), "pieter") && E.matches(who("Pieter de Hooch"), "de Hooch") && E.matches(who("Pieter de Hooch"), "hooch"), "de Hooch");
check(E.matches(country("United States"), "USA") && E.matches(country("United States"), "the united states") && E.matches(country("Czech Republic"), "Czechia") && E.matches(country("Czechia"), "Czech Republic"), "the usual short names of countries");
check(E.matches(country("Côte d'Ivoire"), "cote d'ivoire") && E.matches(country("Côte d'Ivoire"), "Ivory Coast"), "Côte d'Ivoire either way");
check(!E.matches(country("Niger"), "Nigeria") && !E.matches(country("Guinea"), "Guinea-Bissau") && !E.matches(country("Sudan"), "South Sudan"), "countries that are almost each other are not");
check(E.matches(country("Turkey"), "  TURKEY  "), "case and spaces don't matter");
// every painter in the pool can be typed by surname, and no two painters in it share a typed name
const owner = new Map();
for (const p of paint) for (const n of E.painterNames(p.answer)) { const had = owner.get(n); check(!had || had === p.answer, `"${n}" names two painters (${had}, ${p.answer})`); owner.set(n, p.answer); }

if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log(`spyglass: ${paint.length} paintings, ${flag.length} flags and ${outline.length} outlines, runs dealt at every level, sharpening and scoring and typed answers checked`);
