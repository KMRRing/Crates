// Dandan's end-of-game review (dandan-advantage.js): the judge's chance of winning noted at the start of each turn as a
// game is played (and kept through the database), the curve a seat sees, its caption and what a tapped point says, the
// chart's markup, and the record of games won by whom they were played against.
import { rules } from "../dandan-rules.js";
import { botMove } from "../dandan-bot.js";
import { deal, restore } from "../dandan-engine.js";
import { newRecord, applyMove, seeded } from "../seats.js";
import { roundTrip, same } from "./rtdb.js";
import { pack, unpack, noteTurn, curveOf, worthDrawing, captionOf, readoutOf, chartSvg, pointAt, activeAt, BOX, addResult, recordOf, emptyRecord, OPPONENTS } from "../dandan-advantage.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const test = (what, fn) => {
  try { const r = fn(); check(r !== false && typeof r !== "string", typeof r === "string" ? `${what} — ${r}` : what); }
  catch (e) { console.log(`FAIL ${what}: ${e.message}`); bad++; }
};
const J = x => JSON.parse(JSON.stringify(x));
const NAMES = ["You", "Gill"];

/** A whole game of Medium against Medium through the runner's own move, through the database now and then. */
function play(seed) {
  let G = newRecord(rules, { seats: 2, seed, now: 0 });
  for (let i = 0; i < 900 && !rules.over(G.state); i++) {
    if (i % 11 === 0) G = roundTrip(G);
    const who = rules.toMove(G.state), r = applyMove(rules, G, who, botMove(rules.restore(J(G.state)), who, { rng: seeded(seed * 1000 + i), level: "medium" }), 0);
    if (r.error) throw new Error(r.error);
    G = r.G;
  }
  return { G, s: rules.restore(J(G.state)) };
}
const games = [2, 3, 6, 9].map(seed => ({ seed, ...play(seed) }));

// ---------- noting it ----------
test("a turn and a chance pack into one number and come out again, for every turn and every whole percent", () => {
  for (let turn = 1; turn <= 80; turn++) for (let pct = 0; pct <= 100; pct++) { const u = unpack(pack(turn, pct)); if (u.turn !== turn || u.pct !== pct) return `${turn}/${pct}`; }
  return true;
});
test("a game notes seat 0's chance at the start of its turns: in order, each turn once, none after the last, each from 0 to 100", () => games.every(({ s }) => {
  const turns = s.adv.map(v => unpack(v).turn);
  return s.over && s.adv.length >= s.turn * 0.9 && turns.every((t, i) => t >= 1 && t <= s.turn && (i === 0 || t > turns[i - 1])) && s.adv.every(v => unpack(v).pct >= 0 && unpack(v).pct <= 100);
}));
test("the same through the database (a list of numbers loses nothing), a game from before the notes has none and gets none made up", () => {
  const { G, s } = games[0];
  const back = rules.restore(J(roundTrip(G).state));
  const old = restore(J(deal({ rng: seeded(5) })));
  return same(back.adv, s.adv) && s.adv.length > 5 && old.adv === undefined && !worthDrawing(curveOf(old, 0));
});
test("a turn already noted isn't noted twice", () => {
  const s = restore(J(deal({ rng: seeded(11) })));
  s.turn = 3; noteTurn(s); noteTurn(s); s.turn = 4; noteTurn(s);
  return s.adv.map(v => unpack(v).turn).join() === "3,4";
});
test("a game played out in the computer's head (quiet) notes nothing, the same game played for real notes its turns", () => {
  const run = quiet => {
    const s = rules.restore(J(newRecord(rules, { seats: 2, seed: 8, now: 0 }).state));
    for (let i = 0; i < 400 && s.turn < 5 && !s.over; i++) {
      const who = rules.toMove(s), r = rules.act(s, who, botMove(rules.restore(J(s)), who, { rng: seeded(i), level: "medium" }), { rng: seeded(i), quiet });
      if (typeof r === "string") throw new Error(r);
    }
    return s;
  };
  const a = run(true), b = run(false);
  return !a.adv?.length && a.turn >= 5 && b.adv.length >= 4;
});

// ---------- the curve ----------
test("the two seats' curves are each other's other half, and the end is what happened", () => games.every(({ s }) => {
  const a = curveOf(s, 0), b = curveOf(s, 1);
  return a.points.length === b.points.length && a.points.every((p, i) => p.turn === b.points[i].turn && Math.abs(p.you + b.points[i].you - 100) <= 1)
    && a.end === (s.winner === 0 ? 100 : 0) && b.end === (s.winner === 1 ? 100 : 0) && a.endAt === s.turn + 1;
}));
test("the judge favours the winner at the last turn it noted (it was learned from games' results)", () => games.every(({ s }) => {
  const c = curveOf(s, s.winner);
  return c.points.at(-1).you > 50;
}));
test("the biggest swing is the largest step between two turns' starts, in the turn before the second, by whoever's turn that was", () => games.every(({ s }) => {
  const c = curveOf(s, 0), steps = c.points.slice(1).map((p, i) => p.you - c.points[i].you), most = Math.max(...steps.map(Math.abs)), w = c.swing;
  return Math.abs(w.delta) === most && w.to - w.from === w.delta && w.by === activeAt(s.first, w.turn) && c.points.some(p => p.turn === w.turn);
}));
test("whose turn: the first player's on the odd turns", () => activeAt(1, 1) === 1 && activeAt(1, 2) === 0 && activeAt(0, 7) === 0 && activeAt(0, 8) === 1);

// ---------- in words ----------
test("the caption says how long you were ahead and the biggest swing, from your seat's side, and a lost game says what it was lost from", () => {
  const { s } = games.find(g => g.s.winner === 0), c = curveOf(s, 0), d = curveOf(s, 1);
  const words = captionOf(c, NAMES), other = captionOf(d, ["Gill", "You"]);
  return /^Ahead at the start of \d+ of \d+ turns\./.test(words) && /Biggest swing: during turn \d+ \((your|Gill's) turn\)/.test(words) && /^Ahead at the start of \d+ of \d+ turns\./.test(other)
    && (!/Won from/.test(words) || c.points.some(p => p.you < 50)) && (!/Lost from/.test(other) || d.points.some(p => p.you > 50));
});
test("a tapped point says its turn, whose it was, and both chances; the last says how it ended", () => {
  const { s } = games.find(g => g.s.winner === 0), c = curveOf(s, 0), mine = c.points.findIndex(p => activeAt(c.first, p.turn) === 0);
  const a = readoutOf(c, mine, NAMES), z = readoutOf(c, c.points.length, NAMES), lost = readoutOf(curveOf(s, 1), curveOf(s, 1).points.length, ["Gill", "You"]);
  return new RegExp(`^Start of turn ${c.points[mine].turn}, your turn: you ${c.points[mine].you}%, Gill ${100 - c.points[mine].you}%\\.$`).test(a) && z === "The game's end: you won." && lost === "The game's end: Gill won.";
});

// ---------- the chart ----------
test("the chart has a dot for each turn and the end, the two clipped halves of the area, and labels, and nothing before two turns", () => games.every(({ s }) => {
  const c = curveOf(s, 0), svg = chartSvg(c), dots = (svg.match(/class="dd-adv-dot/g) || []).length, fin = (svg.match(/dd-adv-fin (won|lost)/g) || []).length;
  const labels = (svg.match(/class="dd-adv-x/g) || []).length;
  return svg.startsWith("<svg") && dots === c.points.length && fin === 1 && svg.includes("ddAdvUp") && svg.includes("ddAdvDown") && labels >= 2 && labels <= 14
    && !chartSvg({ ...c, points: c.points.slice(0, 1) }) && !svg.includes("NaN") && !svg.includes("undefined");
}));
test("every point is inside the box, the first at the left and the end at the right", () => {
  const c = curveOf(games[1].s, 0), svg = chartSvg(c), xs = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map(m => [+m[1], +m[2]]);
  return xs.length === c.points.length + 1 && xs.every(([x, y]) => x >= BOX.l && x <= BOX.r && y >= BOX.t && y <= BOX.b) && Math.min(...xs.map(p => p[0])) === BOX.l && Math.max(...xs.map(p => p[0])) === BOX.r;
});
test("no turn's label touches the End label, whatever the length of the game", () => games.every(({ s }) => {
  const c = curveOf(s, 0), xs = [...chartSvg(c).matchAll(/<text x="([\d.]+)" y="[\d.]+" text-anchor="middle" font-size="9" class="dd-adv-x(?: on)?">(\w+)<\/text>/g)];
  const end = xs.find(m => m[2] === "End"), others = xs.filter(m => m[2] !== "End");
  return end && others.length >= 2 && others.every(m => +end[1] - +m[1] >= 18);
}));
test("a tap lands on the nearest point, and the selected one is marked", () => {
  const c = curveOf(games[0].s, 0), svg = chartSvg(c, 3);
  return pointAt(c, BOX.l) === 0 && pointAt(c, BOX.r) === c.points.length && pointAt(c, BOX.l + 1) === 0 && svg.includes("dd-adv-sel") && svg.includes('dd-adv-dot on') && !chartSvg(c).includes("dd-adv-sel");
});

// ---------- the record ----------
test("a record counts games and wins, by whom they were played against, the last twenty results kept newest last", () => {
  let r = emptyRecord();
  for (let i = 0; i < 25; i++) r = addResult(r, { won: i % 3 === 0, vs: i < 20 ? "hard" : "friend" });
  r = addResult(r, { won: false, drawn: true, vs: "easy" });
  const o = recordOf(r);
  return o.played === 26 && o.won === 9 && r.by.hard[0] === 20 && r.by.hard[1] === 7 && r.by.friend[0] === 5 && r.by.easy[0] === 1 && r.last.length === 20 && r.last.endsWith("D") && o.last.length === 10
    && o.pct === Math.round(900 / 26) && o.rows.map(x => x.key).join() === "easy,hard,friend";
});
test("an older record, with only games and wins, keeps them as 'Earlier games' beside the new ones", () => {
  const r = addResult({ played: 12, won: 5 }, { won: true, vs: "medium" }), o = recordOf(r);
  const earlier = o.rows.find(x => x.key === "earlier");
  return o.played === 13 && o.won === 6 && earlier.played === 12 && earlier.won === 5 && o.rows.find(x => x.key === "medium").pct === 100 && recordOf({ played: 0, won: 0 }).rows.length === 0;
});
test("a game opened again after it ended (a reload) isn't counted twice, the next game is", () => {
  const a = addResult(emptyRecord(), { won: true, vs: "hard", game: 1000 });
  const again = addResult(a, { won: true, vs: "hard", game: 1000 }), next = addResult(a, { won: false, vs: "hard", game: 2000 });
  const unnamed = addResult(addResult(emptyRecord(), { won: true }), { won: true });
  return again === a && a.played === 1 && next.played === 2 && next.last === "WL" && unnamed.played === 2;
});
test("every opponent has a name for its row", () => OPPONENTS.length === 4 && OPPONENTS.every(([k, n]) => k && n) && new Set(OPPONENTS.map(o => o[0])).size === 4);

console.log(bad ? `dandan-advantage: ${bad} failed` : "dandan-advantage: every check passed");
process.exit(bad ? 1 : 0);
