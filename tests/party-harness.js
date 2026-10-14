// For the party games' tests: a table of players on the database in memory (tests/fake-db.js), the host's phone
// running the game as party.js runs it (each change followed by the game's advance until it settles), on a clock the
// test moves by hand. A party game's test can play a whole evening in Node:
//
//   const t = await partyTable(["Korbi", "Mei", "Ana", "Bo"]);
//   await t.start("undercover", { lang: "en" });
//   await t.send(1, { ready: true });           // what player 1's phone sends (tagged with the game and step)
//   await t.act(2, st => { st.turn++; });       // a change player 2 makes on their own turn
//   await t.tick(6000);                         // six seconds pass on the host's clock
//   t.state, t.branch, t.uid(i), t.players
import { createTable } from "../table.js";
import { startGame, advanceGame, endGame, playersOf } from "../party-core.js";
import { fakeDb } from "./fake-db.js";

export async function partyTable(names, { game = "party" } = {}) {
  const db = fakeDb();
  let clock = 1_000_000;
  const seats = names.map((_, i) => createTable({ game, app: 1, max: 24, sync: db.device(`u${i}`), backupMs: 5 }));
  const settle = () => db.settle(6);
  await seats[0].open({ name: names[0], pid: "p0" });
  await settle();
  for (let i = 1; i < names.length; i++) await seats[i].join(seats[0].code, { name: names[i], pid: `p${i}` });
  await settle();
  const host = () => seats.find(s => s.me?.driver) || seats[0];
  /** The host's phone moving the game on, as party.js does after every change, until there's nothing more to do. */
  async function drive() {
    for (let i = 0; i < 50; i++) {
      const h = host();
      if (!h.data?.game || !advanceGame(structuredClone(h.data), clock)) return;
      await h.act(b => advanceGame(b, clock));
      await settle();
    }
    throw new Error("the game kept moving on by itself");
  }
  return {
    db, seats,
    get branch() { return host().data; },
    get state() { return host().data?.game?.state; },
    get players() { return playersOf(host().data); },
    get now() { return clock; },
    uid: i => seats[i].uid,
    seatOf: uid => seats.findIndex(s => s.uid === uid),
    async start(id, options = {}) { const ok = await host().act(b => startGame(b, id, options, clock)); await settle(); await drive(); return ok; },
    async send(i, value) {
      const b = seats[i].data;
      await seats[i].send({ ...value, seq: b.game.seq, step: b.game.state.step });
      await settle(); await drive();
    },
    async act(i, change) { const ok = await seats[i].act(b => (b.game ? change(b.game.state, b) : false)); await settle(); await drive(); return ok; },
    async tick(ms) { clock += ms; await drive(); },
    async end() { await host().act(b => endGame(b)); await settle(); },
    async leave(i) { await seats[i].leave(); await settle(); await drive(); },
    drive, settle,
  };
}
