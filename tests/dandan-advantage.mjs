// Dandan's end-of-game review (dandan-advantage.js): the judge's chance of winning noted at the start of each turn as a
// game is played (and kept through the database), the curve a seat sees, its caption and what a tapped point says, the
// chart's markup, and the record of games won by whom they were played against.
import { rules } from "../dandan-rules.js";
import { botMove } from "../dandan-bot.js";
import { deal, restore } from "../dandan-engine.js";
import { newRecord, applyMove, seeded } from "../seats.js";
import { roundTrip, same } from "./rtdb.js";
import { T } from "../dandan-spells.js";
import { scene, go, cast, pass, answer, idIn, islandsOf, resolveStack } from "./dandan-scene.js";
import { pack, unpack, noteTurn, noteAction, linesBetween, curveOf, worthDrawing, hasActions, byTurn, momentsOf, MIN_FALL, captionOf, readoutOf, chartSvg, pointAt, activeAt, BOX, addResult, recordOf, emptyRecord, OPPONENTS } from "../dandan-advantage.js";

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
  for (let turn = 1; turn <= 80; turn++) for (let pct = 0; pct <= 100; pct++) { const u = unpack(pack(turn, pct)); if (u.turn !== turn || u.pct !== pct || u.kind !== 0 || u.ln !== null) return `${turn}/${pct}`; }
  return true;
});
test("an entry with its kind, seat and log place packs as well, and can't be taken for the old kind", () => {
  for (let turn = 1; turn <= 80; turn += 3) for (let pct = 0; pct <= 100; pct += 7) for (const kind of [0, 1]) for (const by of [0, 1]) for (const ln of [0, 1, 999, 99999]) {
    const v = pack(turn, pct, { kind, by, ln }), u = unpack(v);
    if (u.turn !== turn || u.pct !== pct || u.kind !== kind || u.ln !== ln || u.by !== (kind ? by : null) || v < 4e8 || !Number.isSafeInteger(v)) return JSON.stringify({ turn, pct, kind, by, ln, u });
  }
  return unpack(pack(1, 0, { kind: 0, by: 0, ln: 0 })).turn === 1 && unpack(80100).turn === 80 && unpack(80100).kind === 0 && pack(3, 5, { kind: 1, by: 1, ln: 1e7 }) === pack(3, 5, { kind: 1, by: 1, ln: 99999 });
});
test("a game notes seat 0's chance at the start of its turns: in order, each turn once, none after the last, each from 0 to 100", () => games.every(({ s }) => {
  const starts = s.adv.map(unpack).filter(u => u.kind === 0), turns = starts.map(u => u.turn);
  return s.over && starts.length >= s.turn * 0.9 && turns.every((t, i) => t >= 1 && t <= s.turn && (i === 0 || t > turns[i - 1])) && s.adv.every(v => unpack(v).pct >= 0 && unpack(v).pct <= 100);
}));
test("and after each action that settled: more of them than turns, in the order they happened, by a seat, with a place in the log", () => games.every(({ s }) => {
  const us = s.adv.map(unpack), acts = us.filter(u => u.kind === 1);
  return acts.length > s.turn && us.every((u, i) => (i === 0 || (u.turn >= us[i - 1].turn && u.ln >= us[i - 1].ln)) && u.ln <= s.ln) && acts.every(u => u.by === 0 || u.by === 1) && us[0].kind === 0;
}));
test("the same through the database (a list of numbers loses nothing), a game from before the notes has none and gets none made up", () => {
  const { G, s } = games[0];
  const back = rules.restore(J(roundTrip(G).state));
  const old = restore(J(deal({ rng: seeded(5) })));
  return same(back.adv, s.adv) && s.adv.length > 5 && old.adv === undefined && !worthDrawing(curveOf(old, 0));
});
test("an action is noted once it has settled, not while its spell is on the stack or a question is open, and a bare pass isn't one", () => {
  let s = scene({ turn: 3, active: 0, step: "main1", hand: [["Island", "Brainstorm"], ["Island"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 2)] });
  s.adv = []; noteTurn(s);
  const n = () => s.adv.length, said = u => linesBetween(s.log, s.adv.map(unpack)[s.adv.indexOf(u) - 1].ln, unpack(u).ln).join(" | ");
  s = go(s, 0, { t: "land", card: idIn(s, 0, "Island") });
  const afterLand = n();
  s = cast(s, 0, "Brainstorm");
  const onStack = n(), asking = !!s.pending && s.stack.length === 1 && n() === afterLand;
  s = answer(s, { t: "putback", cards: s.hand[0].slice(0, 2) });
  const us = s.adv.map(unpack);
  return afterLand === 2 && us[1].kind === 1 && us[1].by === 0 && /plays Island/.test(said(s.adv[1]))
    && onStack === 2 && asking && n() === 3 && us[2].kind === 1 && us[2].by === 0 && /casts Brainstorm/.test(said(s.adv[2])) && /puts 2 back/.test(said(s.adv[2])) && !s.stack.length || JSON.stringify({ afterLand, onStack, asking, n: n(), us });
});
test("a spell the other seat counters is the caster's action, not the counter's: the move that cost, with both spells in its words", () => {
  let s = scene({ turn: 3, active: 0, step: "main1", hand: [["Brainstorm"], ["Memory Lapse"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 2)] });
  s.adv = []; noteTurn(s);
  s = cast(s, 0, "Brainstorm");
  const during = s.adv.length;   // the spell is on the stack, and the other seat holds priority with a Lapse
  s = go(s, 1, { t: "cast", card: idIn(s, 1, "Memory Lapse"), from: "hand", targets: [T.s(s.stack.find(i => i.name === "Brainstorm").sid)] });
  s = resolveStack(s);
  const us = s.adv.map(unpack), words = linesBetween(s.log, us[0].ln, us.at(-1).ln).join(" | ");
  return during === 1 && !s.stack.length && s.adv.length === 2 && us[1].kind === 1 && us[1].by === 0 && /casts Brainstorm/.test(words) && /casts Memory Lapse/.test(words) || JSON.stringify({ during, us, words });
});
test("a spell cast with nothing on the stack begins an action: the other seat's answer to it doesn't take it over, a pass never begins one", () => {
  let s = scene({ turn: 3, active: 1, step: "main1", hand: [["Memory Lapse", "Island"], ["Dandân"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 5)] });
  s.adv = []; noteTurn(s);
  s = cast(s, 1, "Dandân");
  s = go(s, 0, { t: "cast", card: idIn(s, 0, "Memory Lapse"), from: "hand", targets: [T.s(s.stack.find(i => i.name === "Dandân").sid)] });
  s = resolveStack(s);
  const us = s.adv.map(unpack);
  return s.adv.length === 2 && us[1].by === 1 && s.by === 1 || JSON.stringify({ us, by: s.by });
});
test("no entry, or one of the old kind that has no log place, and nothing is noted (a game begun before, or a position set up by hand)", () => {
  const set = () => scene({ turn: 3, active: 0, step: "main1", hand: [["Island"], ["Island"]], bf: [...islandsOf(0, 2)] });
  const none = go(set(), 0, { t: "land", card: idIn(set(), 0, "Island") });
  const old = set(); old.adv = [pack(3, 40)];
  const oldAfter = go(old, 0, { t: "land", card: idIn(old, 0, "Island") });
  return none.adv === undefined && oldAfter.adv.length === 1 && unpack(oldAfter.adv[0]).ln === null;
});
test("an action that opens with a seat playing a land, casting, attacking or blocking is that seat's", () => games.every(({ s }) => {
  const us = s.adv.map(unpack);
  return us.every((u, i) => {
    if (u.kind !== 1) return true;
    const first = linesBetween(s.log, us[i - 1].ln, u.ln)[0] || "", m = /^\{s(\d)\} (plays|casts|attacks|blocks|cycles) /.exec(first);
    return !m || +m[1] === u.by;
  });
}));
test("every action noted has something of its own in its words, never the turn's line alone, and the lines of one entry follow the last's", () => games.every(({ s }) => {
  const us = s.adv.map(unpack);
  return us.every((u, i) => u.kind === 0 || (i > 0 && linesBetween(s.log, us[i - 1].ln, u.ln).some(l => !/^Turn \d+: /.test(l))));
}));
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
/** A game as it was before actions were noted: only the turns' starts, in the old kind of entry. */
const oldKind = s => ({ ...s, adv: s.adv.map(unpack).filter(u => u.kind === 0).map(u => pack(u.turn, u.pct)) });
test("the biggest swing is the largest step between two actions, in the turn it was, by whoever made it", () => games.every(({ s }) => {
  const c = curveOf(s, 0), most = Math.max(...c.points.filter(p => p.kind === 1).map(p => Math.abs(p.d))), w = c.swing, at = c.points.find(p => p.kind === 1 && p.turn === w.turn && p.by === w.by && p.d === w.delta);
  return w.move && Math.abs(w.delta) === most && w.to - w.from === w.delta && !!at && at.you === w.to;
}));
test("…and for a game from before actions were noted, the largest step between two turns' starts, in the turn before the second, by whoever's turn that was", () => games.every(({ s }) => {
  const c = curveOf(oldKind(s), 0), steps = c.points.slice(1).map((p, i) => p.you - c.points[i].you), most = Math.max(...steps.map(Math.abs)), w = c.swing;
  return !hasActions(c) && !w.move && Math.abs(w.delta) === most && w.to - w.from === w.delta && w.by === activeAt(s.first, w.turn) && c.points.some(p => p.turn === w.turn);
}));
test("whose turn: the first player's on the odd turns", () => activeAt(1, 1) === 1 && activeAt(1, 2) === 0 && activeAt(0, 7) === 0 && activeAt(0, 8) === 1);

// ---------- in words ----------
test("the caption says how long you were ahead and the biggest swing, from your seat's side, and a lost game says what it was lost from", () => {
  const { s } = games.find(g => g.s.winner === 0), c = curveOf(s, 0), d = curveOf(s, 1);
  const words = captionOf(c, NAMES), other = captionOf(d, ["Gill", "You"]);
  return /^Ahead at the start of \d+ of \d+ turns\./.test(words) && /Biggest swing: turn \d+, (your|Gill's) move, (up|down) \d+ points, \d+% to \d+%\./.test(words) && /^Ahead at the start of \d+ of \d+ turns\./.test(other)
    && /Biggest swing: during turn \d+ \((your|Gill's) turn\)/.test(captionOf(curveOf(oldKind(s), 0), NAMES))
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
  const c = curveOf(games[0].s, 0), start = c.points.findIndex((p, i) => i > 0 && p.kind === 0), act = c.points.findIndex(p => p.kind === 1);
  return pointAt(c, BOX.l) === 0 && pointAt(c, BOX.r) === c.points.length && pointAt(c, BOX.l + 1) === 0 && chartSvg(c, start).includes("dd-adv-sel") && chartSvg(c, start).includes('dd-adv-dot on')
    && chartSvg(c, act).includes('dd-adv-dot act on') && !chartSvg(c).includes("dd-adv-sel") && !chartSvg(c).includes(" on\"");
});


// ---------- the moves ----------
const crafted = (list, over = {}) => ({ adv: list.map(([turn, pct, kind, by, ln]) => pack(turn, pct, { kind, by, ln })), over: true, winner: 0, turn: 3, first: 0, lib: [], ...over });
const SCRIPT = [[1, 50, 0, 0, 1], [1, 38, 1, 0, 2], [1, 30, 1, 1, 3], [1, 29, 1, 0, 4], [2, 41, 0, 0, 5], [2, 20, 1, 0, 6], [2, 28, 1, 1, 7], [3, 10, 0, 0, 8], [3, 2, 1, 1, 9]];
test("each entry says its turn, its kind, who made it, how far it moved from the one before and what of the log it covers, and lies between its turn and the next", () => {
  const c = curveOf(crafted(SCRIPT), 0);
  return c.points.map(p => p.d).join() === "0,-12,-8,-1,12,-21,8,-18,-8" && c.points.map(p => p.kind).join() === "0,1,1,1,0,1,1,0,1" && c.points.map(p => p.by).join() === ",0,1,0,,0,1,,1"
    && c.points.map(p => p.from).join() === "0,1,2,3,4,5,6,7,8" && c.points.map(p => p.pos).join() === "1,1.25,1.5,1.75,2,2.33333333333,2.66666666667,3,3.5".split(",").map((x, i) => (i === 5 ? 2 + 1 / 3 : i === 6 ? 2 + 2 / 3 : +x)).join()
    && c.endAt === 4 && c.end === 100;
});
test("every game's entries lie in order along the turns, a turn's start on its number and its actions between it and the next", () => games.every(({ s }) => {
  const c = curveOf(s, 0);
  return c.points.every((p, i) => (i === 0 || p.pos > c.points[i - 1].pos) && p.pos >= p.turn && p.pos < p.turn + 1 && (p.kind === 1 || p.pos === p.turn) && (i === 0 || p.d === p.you - c.points[i - 1].you));
}));
test("by turn is the same game with a point to each turn's start, on the turn's number: what the chart was before actions", () => games.every(({ s }) => {
  const c = curveOf(s, 0), t = byTurn(c), old = curveOf(oldKind(s), 0);
  return hasActions(c) && !hasActions(t) && !hasActions(old) && t.points.length === old.points.length && t.points.every((p, i) => p.turn === old.points[i].turn && p.you === old.points[i].you && p.pos === p.turn) && t.end === c.end && t.endAt === c.endAt;
}));
test("the moves that cost most are the falls of 4 points or more after an action, each side's apart, worst first; a turn's start (the draw) isn't one", () => {
  const c = curveOf(crafted(SCRIPT), 0), m = momentsOf(c), d = curveOf(crafted(SCRIPT), 1), n = momentsOf(d);
  return MIN_FALL === 4 && m.mine.map(p => [p.i, p.d]).join(";") === "5,-21;1,-12" && m.theirs.map(p => [p.i, p.d]).join(";") === "2,-8;8,-8"
    && n.mine.map(p => [p.i, p.d]).join(";") === "6,-8" && n.theirs.length === 0 && momentsOf(c, { limit: 1 }).mine.length === 1 && momentsOf(curveOf(oldKind(games[0].s), 0)).mine.length === 0;
});
test("in a real game each side's list is at most three, all falls of an action by that side, worst first", () => games.every(({ s }) => [0, 1].every(seat => {
  const c = curveOf(s, seat), m = momentsOf(c);
  return [[m.mine, seat], [m.theirs, 1 - seat]].every(([list, who]) => list.length <= 3 && list.every((p, k) => p.kind === 1 && p.by === who && p.d <= -MIN_FALL && c.points[p.i].you === p.you && (k === 0 || p.d >= list[k - 1].d)));
})));
test("a tapped action says whose move, from what to what, and what the log said; a start is as it was", () => {
  const c = curveOf(crafted(SCRIPT), 0), a = readoutOf(c, 5, NAMES, ["You cast Metamorphose", "Dandân goes on top"]), g = readoutOf(c, 2, NAMES), s0 = readoutOf(c, 4, NAMES);
  return a === "Turn 2, your move: you 41% to 20% (−21). You cast Metamorphose; Dandân goes on top." && g === "Turn 1, Gill's move: you 38% to 30% (−8)." && s0 === "Start of turn 2, Gill's turn: you 41%, Gill 59%.";
});
test("the chart marks every action with a small dot, ties the turns with ticks, rings the moves flagged with their numbers, and holds together at the most", () => {
  const c = curveOf(crafted(SCRIPT), 0), svg = chartSvg(c, -1, [[5, 1], [1, 2]]);
  const big = curveOf(games.reduce((a, g) => (g.s.adv.length > a.s.adv.length ? g : a)).s, 0), bigSvg = chartSvg(big, -1, momentsOf(big).mine.map((p, k) => [p.i, k + 1]));
  return (svg.match(/dd-adv-dot act/g) || []).length === 6 && (svg.match(/class="dd-adv-dot"/g) || []).length === 3 && (svg.match(/dd-adv-tick/g) || []).length === 3
    && (svg.match(/dd-adv-flag/g) || []).length === 2 && /class="dd-adv-num">1</.test(svg) && /class="dd-adv-num">2</.test(svg) && !chartSvg(c).includes("dd-adv-flag")
    && !/NaN|undefined/.test(svg + bigSvg) && (bigSvg.match(/<circle cx="[\d.]+" cy="[\d.]+" r="[\d.]+" class="dd-adv-dot/g) || []).length === big.points.length;
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
