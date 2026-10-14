// Seats (seats.js): the runner every seat game shares, on a toy game (each in turn adds one or two to a count; whoever
// takes it to ten wins, shown a moment before the game ends). Solo, the computer players move by themselves, each in
// turn, until it's yours, and the game is kept as it changes; at a table on the database in memory (tests/fake-db.js)
// the seats nobody has are the computer's, moved by the device that runs the table and by no other; a friend who
// sits down mid-game takes a computer player's seat, one who leaves hands theirs back, and one whose phone has gone
// away is played for after a grace; a move worked out twice comes out the same; what the database drops (an empty
// list) is made whole again; the end is seen once.
import { seeded, mix, shuffle, newRecord, applyMove, applyWake, botMove, whoSits, localTable, createRunner } from "../seats.js";
import { createTable } from "../table.js";
import { fakeDb } from "./fake-db.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(pred, ms = 3000) { const end = Date.now() + ms; while (Date.now() < end) { if (pred()) return true; await sleep(5); } return pred(); }

const TOY = {
  id: "toy", seats: { min: 2, max: 4 },
  deal: ({ seats, rng }) => ({ seats, count: 0, turn: Math.floor(rng() * seats), secret: Array.from({ length: seats }, () => 1 + Math.floor(rng() * 6)), log: [], step: "play", say: "Off we go" }),
  toMove: s => (s.step === "play" ? s.turn : null),
  act(s, seat, m, { now }) {
    if (m !== 1 && m !== 2) return "Add one or two";
    s.count += m;
    s.log.push([seat, m]);
    if (s.count >= 10) { s.step = "shown"; s.until = now + 40; s.winner = seat; s.say = `Seat ${seat} wins`; }
    else s.turn = (s.turn + 1) % s.seats;
    return s;
  },
  bot: (s, seat, { rng }) => (s.count === 8 ? 2 : rng() < 0.5 ? 1 : 2),
  wakeAt: s => (s.step === "shown" ? s.until : null),
  wake: s => ({ ...s, step: "over" }),
  over: s => s.step === "over",
  restore: s => { s.log ||= []; return s; },
};

// ---------- the pure parts ----------
{
  const a = seeded(42), b = seeded(42);
  check([1, 2, 3].every(() => a() === b()), "the same seed gives the same numbers");
  check(mix(1, 2) !== mix(2, 1) && mix(5, 9) === mix(5, 9), "seeds mix in order, repeatably");
  const counts = Array(4).fill(0), rng = seeded(7);
  for (let i = 0; i < 4000; i++) counts[shuffle([0, 1, 2, 3], rng)[0]]++;
  check(counts.every(c => Math.abs(c - 1000) < 110), `a fair shuffle (${counts.join(", ")})`);
  const G = newRecord(TOY, { seats: 9, seed: 1, now: 0 });
  check(G.seats === 4 && G.state.secret.length === 4, "a deal for more seats than the game has gets its most");
  check(G.say?.text === "Off we go" && G.say.n === 1 && G.state.say === undefined, "the deal's line goes to the record for the narrator");
  const who = G.state.turn;
  check(applyMove(TOY, G, (who + 1) % 4, 1).error === "It isn't your turn", "a move out of turn is refused");
  check(applyMove(TOY, G, who, 3).error === "Add one or two", "an illegal move says why");
  const one = applyMove(TOY, G, who, 1, 5).G, two = applyMove(TOY, G, who, 1, 5).G;
  check(JSON.stringify(one) === JSON.stringify(two) && one.n === 1 && G.n === 0 && G.state.count === 0, "a move made twice comes out the same, and leaves the record it was made on as it was");
  check(JSON.stringify(botMove(TOY, one, one.state.turn)) === JSON.stringify(botMove(TOY, one, one.state.turn)), "a computer player's move is the same worked out twice");
  const back = roundTrip(G);
  check(back.state.log === undefined && applyMove(TOY, back, who, 2).G?.state.log.length === 1, "an empty list the database dropped is made whole again (restore)");
  let g = G;
  for (let i = 0; i < 20 && g.state.step === "play"; i++) g = applyMove(TOY, g, g.state.turn, 2, 100).G;
  check(g.state.step === "shown" && applyWake(TOY, g, 120) === null && applyWake(TOY, g, 140)?.state.step === "over", "a timed step moves on when its time comes, not before");
  const seats = whoSits({ seats: 3 }, { players: { x: { name: "Mei", seat: 1, online: true }, y: { name: "Bo", seat: 2, online: false } } }, { botName: s => `Lin${s}`, awaySince: { y: 0 }, grace: 100, now: 50 });
  check(seats.map(s => `${s.name}${s.bot ? "*" : ""}`).join() === "Lin0*,Mei,Bo", "who sits where: the computer in a seat nobody has, a person away within the grace still theirs");
  check(whoSits({ seats: 3 }, { players: { y: { name: "Bo", seat: 2, online: false } } }, { awaySince: { y: 0 }, grace: 100, now: 150 })[2].bot, "and past the grace the computer plays for them");
}

// ---------- solo ----------
{
  const mem = { G: null, saves: 0, load() { return this.G; }, save(G) { this.G = JSON.parse(JSON.stringify(G)); this.saves++; } };
  const solo = localTable(mem, { name: "Korbi" });
  let last = null, overs = 0, paused = false;
  const r = createRunner({ rules: TOY, table: solo, pace: 5, botName: s => `Bot ${s}`, paused: () => paused, onView: v => { last = v; }, onOver: () => overs++ });
  solo.onChange(() => r.update());
  r.update();
  check(last && last.G === null && last.mode === "solo", "solo with nothing dealt shows no game");
  await r.deal({}, 3);
  check(last.G?.seats === 3 && last.seat === 0 && last.seats.map(s => s.bot).join() === "false,true,true", "a solo deal: you in seat 0, the computer in the others");
  await until(() => last.toMove === 0 || last.over);
  check(last.toMove === 0 || last.over, "the computer players move by themselves until it's your turn");
  check(mem.G?.n === last.G.n, "the game is kept as it changes");
  if (last.toMove === 0) {
    check(await r.move(5) === "Add one or two", "your illegal move is refused with the reason");
    const before = last.G.n;
    check(await r.move(1) === "" && last.G.n === before + 1, "your move is made");
  }
  paused = true;
  const n = last.G.n;
  await sleep(40);
  check(last.G.n === n || last.over, "while paused, the computer waits");
  paused = false;
  r.kick();
  for (let i = 0; i < 40 && !last.over; i++) { await until(() => last.toMove === 0 || last.over, 1000); if (!last.over) await r.move(last.state.count === 8 ? 2 : 1); }
  await until(() => last.over, 1000);
  check(last.over && overs === 1, "the game plays to its end, shown a moment first, and the end is seen once");
  r.update();
  check(overs === 1, "a second look at the end doesn't count it again");
  check(await r.move(1) === "The game is over", "no move after the end");
}

// ---------- at a table ----------
{
  const db = fakeDb();
  const devices = [];
  function device(uid, name, grace = 30000) {
    const d = { uid, name, last: null, overs: 0 };
    d.table = createTable({ game: "toy", app: 1, max: 4, sync: db.device(uid), backupMs: 400, onState: () => d.runner?.update(), onLeave: () => {} });
    d.runner = createRunner({ rules: TOY, table: d.table, pace: 5, grace, botName: s => `Bot ${s}`, onView: v => { d.last = v; }, onOver: () => d.overs++ });
    devices.push(d);
    return d;
  }
  const host = device("h", "Korbi"), guest = device("g", "Mei");
  const code = await host.table.open({ name: "Korbi", pid: "pk" });
  await db.settle();
  check(await guest.table.join(code, { name: "Mei", pid: "pm" }) === "ok", "a friend sits down at the table");
  await db.settle();
  // deal on a seed that gives seat 2 the first move, so the computer moves first
  let moves = 0;
  await host.runner.deal({}, 4);
  await db.settle(8);
  check(host.last.G?.seats === 4 && guest.last.G?.seq === host.last.G.seq, "the host deals four seats and both phones see the same game");
  check(host.last.seats.map(s => (s.bot ? "bot" : s.name)).join() === "Korbi,Mei,bot,bot", "two people and two computer players");
  check(host.last.seat === 0 && guest.last.seat === 1, "each phone is its own seat");
  // play: each person moves on their turn; the computer's turns are taken by the host's phone alone
  const actedBy = new Set();
  const origAct = guest.table.act;
  guest.table.act = (change, opts) => { if (opts?.rev != null) actedBy.add("guest-bot"); return origAct(change, opts); };
  for (let i = 0; i < 60 && !host.last.over; i++) {
    await until(() => host.last.over || [0, 1].includes(host.last.toMove), 1500);
    if (host.last.over) break;
    const who = host.last.toMove === 0 ? host : guest;
    await until(() => who.last.toMove === who.last.seat, 500);
    const err = await who.runner.move(who.last.state.count === 8 ? 2 : 1);
    if (!err) moves++;
    await db.settle(6);
  }
  await until(() => host.last.over && guest.last.over, 2000);
  check(host.last.over && guest.last.over && moves > 0, `a whole game at the table, the people moving on their turns (${moves} moves) and the computer on its own`);
  check(!actedBy.has("guest-bot"), "only the phone that runs the table moved the computer players");
  check(host.overs === 1 && guest.overs === 1, "each phone sees the end once");

  // a new game; a friend leaves mid-game and the computer takes their seat; another sits down and takes it back
  await host.runner.deal({}, 4);
  await db.settle(8);
  await guest.table.leave();
  await db.settle(8);
  check(host.last.seats[1].bot, "a friend who leaves hands their seat to the computer");
  await until(() => host.last.toMove === 0 || host.last.over, 2000);
  check(host.last.toMove === 0 || host.last.over, "and the game goes on without them");
  const bo = device("b", "Bo");
  check(await bo.table.join(code, { name: "Bo", pid: "pb" }) === "ok", "a newcomer sits down mid-game");
  await db.settle(8);
  check(bo.last?.seat === 1 && !host.last.seats[1].bot && host.last.seats[1].name === "Bo", "in the lowest free seat, the computer's, hand and all");
  check(bo.last.state.secret[1] === host.last.state.secret[1], "seeing that seat's own secret");

  // a phone that goes away is played for once the grace is up
  const quick = createRunner({ rules: TOY, table: host.table, pace: 5, grace: 60, botName: s => `Bot ${s}`, onView: v => { host.last = v; } });
  host.runner = quick;
  db.drop("b");
  await db.settle(8);
  quick.update();
  check(host.last.seats[1].away && !host.last.seats[1].bot, "a phone that has gone is away, its seat still theirs for a while");
  for (let i = 0; i < 40 && !host.last.over; i++) {
    await until(() => host.last.over || host.last.toMove === 0, 1500);
    if (host.last.over) break;
    await host.runner.move(host.last.state.count === 8 ? 2 : 1);
    await db.settle(6);
  }
  await until(() => host.last.over, 2000);
  check(host.last.over, "and past the grace the computer plays it, so the game ends");
  check(host.last.seats[1].bot && host.last.seats[1].name === "Bo", "the seat still bears their name, played for them");
  // the branch as the database keeps it
  const branch = db.read(`crates/rooms/${code}/toy`);
  check(branch?.game?.seq === 2 && branch.game.state.step === "over", "the game is on the table in the database");
}

// ---------- a solo game carried to a table ----------
{
  const db = fakeDb();
  const mem = { G: null, load() { return this.G; }, save(G) { this.G = JSON.parse(JSON.stringify(G)); } };
  const solo = localTable(mem);
  let last = null;
  const r = createRunner({ rules: TOY, table: solo, pace: 1000, botName: s => `Bot ${s}`, onView: v => { last = v; } });
  solo.onChange(() => r.update());
  await r.deal({}, 4);
  const soloG = JSON.parse(JSON.stringify(last.G));
  const t = createTable({ game: "toy", app: 1, max: 4, sync: db.device("h"), onState: () => r.update() });
  const code = await t.open({ name: "Korbi", pid: "pk", extra: { game: soloG } });
  r.use(t);
  await db.settle(8);
  check(last.mode === "table" && last.G.seed === soloG.seed && last.G.n === soloG.n, "Invite players carries the solo game to the table as it stands");
  const friend = createTable({ game: "toy", app: 1, max: 4, sync: db.device("f") });
  await friend.join(code, { name: "Mei", pid: "pm" });
  await db.settle(8);
  r.update();
  check(!last.seats[1].bot && last.seats[1].name === "Mei", "a friend takes the computer player's seat in the game under way");
  r.use(solo);
  check(last.mode === "solo" && last.G.seed === soloG.seed, "and leaving goes back to the solo game");
  r.stop();
}

console.log(bad ? `seats: ${bad} failed` : "seats: every check passed");
process.exit(bad ? 1 : 0);
