// Tables (table.js): a host opens one and three friends sit down by its code, each at the lowest free seat; a fifth is
// turned away from a table of four; a player's other device takes their own seat back; the device that runs the table
// is the host's while it's online and the lowest seat's when it isn't, the next in line stepping in only when nothing
// has moved for a while; two moves worked out on the same table can't both land; inputs made at once each keep their
// place; leaving frees a seat and passes the host's role on; a device with older code is asked to update. Played on
// the database in memory (tests/fake-db.js), several devices at once.
import { createTable, seated, driverOf, backupOf, sitAt, standUp, narrate, storable } from "../table.js";
import { fakeDb } from "./fake-db.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- the pure parts ----------
{
  const t = { v: 1, host: "a", players: { a: { name: "Korbi", pid: "pa", seat: 0, online: true } } };
  sitAt(t, { uid: "b", pid: "pb", name: "Simeon" }, { max: 3 });
  sitAt(t, { uid: "c", pid: "pc", name: "Mei" }, { max: 3 });
  check(seated(t).map(p => `${p.name}@${p.seat}`).join() === "Korbi@0,Simeon@1,Mei@2", "each newcomer takes the lowest free seat");
  check(sitAt(structuredClone(t), { uid: "d", pid: "pd", name: "Ana" }, { max: 3 }) === undefined, "a full table turns a fourth away");
  const moved = sitAt(structuredClone(t), { uid: "b2", pid: "pb", name: "Simeon" }, { max: 3 });
  check(moved.players.b2?.seat === 1 && !moved.players.b, "a player's other device sits in their own seat, the old device's place gone");
  standUp(t, "b");
  sitAt(t, { uid: "d", pid: "pd", name: "Ana" }, { max: 3 });
  check(t.players.d.seat === 1, "a seat freed is the next one taken");
  t.players.a.online = false;
  check(driverOf(t) === "d" && backupOf(t) === "c", "with the host away, the lowest seat online runs the table, the next one backs it up");
  t.players.a.online = true;
  check(driverOf(t) === "a" && backupOf(t) === "d", "with the host here, the host runs it");
  standUp(t, "a");
  check(t.host === "d", "the host leaving passes the role to the lowest seat left");
  narrate(t, "Night falls."); narrate(t, "Everyone wake up.");
  check(t.say.n === 2 && t.say.text === "Everyone wake up.", "the narrator's lines are numbered, the latest kept");
  check(JSON.stringify(storable({ a: undefined, b: NaN, c: [1, , 3] })) === '{"b":null,"c":[1,null,3]}', "what the database refuses is dropped before saving");
  check(sitAt({ v: 1, players: { z: { online: false } } }, { uid: "z", name: "Zed" }).players.z.seat === 0, "a leftover offline mark without a seat doesn't count as a seat");
}

// ---------- a table of four on the database ----------
const db = fakeDb();
const devices = {};
const table = (uid, opts = {}) => {
  const log = { states: 0, left: null, newer: 0, last: null };
  const tb = createTable({ game: "test", app: 3, max: 4, sync: db.device(uid), backupMs: 60, ...opts,
    onState: (b, me) => { log.states++; log.last = { b, me }; },
    onLeave: why => { log.left = why; }, onNewer: () => { log.newer++; } });
  devices[uid] = { tb, log };
  return tb;
};
const host = table("ha");
const code = await host.open({ name: "Korbi", pid: "pk" });
await db.settle();
check(/^[A-Z]{4}$/.test(code) && db.read(`crates/rooms/${code}/suite`) === 1, `the host opens a table in a room of its own (${code})`);
check(host.me?.seat === 0 && host.me.host && host.me.driver, "the host sits at seat 0 and runs the table");
const names = ["Simeon", "Mei", "Ana", "Bo"];
const results = [];
for (const [i, n] of names.entries()) results.push(await table(`g${i}`).join(code, { name: n, pid: `p${i}` }));
await db.settle();
check(results.join() === "ok,ok,ok,full", `three sit down and the fifth is turned away (${results.join()})`);
check(host.players.map(p => p.seat).join() === "0,1,2,3" && devices.g2.tb.me.seat === 3, "they sit at 1, 2 and 3, and each page knows its seat");
check(await table("zz").join("QQQQ", { name: "X" }) === "none", "a code with no table says so");

// two moves worked out on the same table: the second is turned down
const rev = host.data.rev;
const [one, two] = await Promise.all([host.act(b => { b.game = { moves: 1 }; }, { rev }), devices.g0.tb.act(b => { b.game = { moves: 2 }; }, { rev })]);
await db.settle();
check(one !== two && host.data.rev === rev + 1, "of two moves made on the same table, only one lands");
check(await host.act(() => false) === false && host.data.rev === rev + 1, "a change that changes nothing saves nothing");

// inputs everyone makes at once
await Promise.all(["g0", "g1", "g2"].map((u, i) => devices[u].tb.send({ vote: i })));
await db.settle();
check(Object.keys(host.data.inputs || {}).length === 3 && host.data.inputs[devices.g1.tb.uid].vote === 1, "inputs made at once each keep their own place");

// the next in line steps in only when nothing has moved
let ran = [];
devices.g0.tb.drive(() => ran.push("g0"));
host.drive(() => ran.push("host"));
check(ran.join() === "host", "the driving device does the work at once, the next in line waits");
await sleep(100);
check(ran.join() === "host,g0", "and the next in line does it when nothing has moved meanwhile");
ran = [];
devices.g0.tb.drive(() => ran.push("g0"));
await host.act(b => { b.game.moves++; });
await sleep(100);
check(!ran.length, "but not when the table has moved on");

// the host's phone drops: the lowest seat runs the table
db.drop("ha");
await db.settle();
check(devices.g0.tb.me.driver && !devices.g1.tb.me.driver, "with the host gone, seat 1 runs the table");

// a player's other device
const again = await table("g1b").join(code, { name: "Mei", pid: "p1" });
await db.settle();
check(again === "ok" && devices.g1b.tb.me.seat === 2 && devices.g1.log.left === "removed", "a player's other device takes their seat; the old one is told");

// leaving, and being asked to leave
await devices.g2.tb.leave();
await db.settle();
check(devices.g2.log.left === "left" && devices.g0.tb.players.length === 3, "leaving frees the seat");
check(await table("g9").join(code, { name: "Lin", pid: "p9" }) === "ok", "and someone else can take it");
await db.settle();
check(devices.g9.tb.me.seat === 3, "the freed seat, 3");

// a device with newer code
db.write(`crates/rooms/${code}/test/app`, 4);
await db.settle();
check(devices.g0.log.newer > 0, "a table touched by newer code asks this device to update");

console.log(bad ? `table: ${bad} failed` : "table: every check passed");
process.exit(bad ? 1 : 0);
