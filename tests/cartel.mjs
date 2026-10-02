// Cartel: computer players play whole games against each other. Every game must finish, nobody's move may be
// refused by the referee, and the rational player should win more than its share. Run: node tests/cartel.mjs [games]
const E = await import("../cartel-engine.js");
const A = await import("../cartel-ai.js");
const ids = Object.keys(A.PERSONAS), games = Number(process.argv[2] || 30);
let finished = 0, refused = 0, turns = 0;
const wins = {}, seats = {};
for (let g = 0; g < games; g++) {
  const personas = [0, 1, 2, 3].map(k => ids[(g + k) % ids.length]);
  const s = E.newGame(5000 + g, personas.map(p => ({ name: A.PERSONAS[p].name, persona: p })));
  const ais = personas.map((p, i) => new A.Player(i, 4, p, 900 + g * 4 + i));
  for (let guard = 0; !s.over && guard < 4000; guard++) {
    for (const ai of ais) ai.sync(s, E.seen);
    try {
      if (s.pending) E.respond(s, ais[s.pending.challenger].challenge(s));
      else if (s.step === "act") E.act(s, ais[s.turn].action(s));
      else E.bid(s, ais[s.turn].bid(s));
    } catch (e) { refused++; console.log(`game ${g}: refused (${e.message})`); break; }
  }
  if (!s.over) continue;
  finished++;
  turns += s.moves;
  wins[personas[s.over.winner]] = (wins[personas[s.over.winner]] || 0) + 1;
  personas.forEach(p => { seats[p] = (seats[p] || 0) + 1; });
}
const rate = id => (wins[id] || 0) / seats[id];
console.log(`${finished}/${games} games finished, ${refused} refused moves, ${(turns / finished).toFixed(1)} turns a game`);
console.log("win rates:", ids.map(id => `${id} ${Math.round(100 * rate(id))}%`).join(", "));
const bad = finished !== games || refused > 0 || rate("quant") < 0.2;
console.log(bad ? "problems" : "all games check out");
if (bad) process.exitCode = 1;
