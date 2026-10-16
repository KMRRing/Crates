// An offline party's database (lan.js): the host's phone keeps it, the guests reach it over data channels. Checked here
// on channels in memory: what a page reads and writes comes out as Firebase would give it; transactions made at once
// on two phones both land, one after the other; presence and sessions are undone when a page goes, when a phone's link
// closes and when a phone falls silent, and said again when it's back; a phone that lost its link carries on, its
// watches and seat back, on a new one; a long value goes in pieces; nothing outside the rooms travels; the guests'
// clocks agree with the host's. Then a table of four (table.js) played through it, as a party plays it.
import { createHost, createClient } from "../lan.js";
import { encodeLink, decodeLink, readSdp, writeSdp } from "../lan-link.js";
import { createTable, driverOf } from "../table.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Two ends of a data channel in memory: what one sends the other hears a moment later, in order. */
function pipe() {
  const end = () => ({ readyState: "open", listeners: { message: [], close: [], error: [] }, other: null,
    addEventListener(type, fn) { this.listeners[type]?.push(fn); },
    send(data) {
      if (this.readyState !== "open") throw new Error("closed");
      const to = this.other;
      setTimeout(() => { if (to.readyState === "open") to.listeners.message.forEach(fn => fn({ data })); }, 1);
    },
    close() { for (const e of [this, this.other]) { if (e.readyState === "closed") continue; e.readyState = "closed"; setTimeout(() => e.listeners.close.forEach(fn => fn()), 1); } },
  });
  const a = end(), b = end();
  a.other = b; b.other = a;
  return [a, b];
}

// ---------- the link codes ----------
{
  const sdp = ["v=0", "a=ice-ufrag:pG6v", "a=ice-pwd:/M0zSKf+5gwZtKRNsT72gui/",
    "a=fingerprint:sha-256 D6:1E:DA:A3:4A:0D:57:4E:C1:A5:2A:50:5D:36:F1:3B:A5:15:FF:47:C8:FB:CD:B2:F7:DC:FE:B2:D4:B5:1A:83", "a=setup:active",
    "a=candidate:1 1 udp 2113937151 62a9b3c3-d7a2-4a55-a884-afd039f359d9.local 40105 typ host generation 0",
    "a=candidate:2 1 udp 2122260223 192.168.8.12 41224 typ host generation 0",
    "a=candidate:3 1 tcp 1518280447 192.168.8.12 9 typ host tcptype active generation 0",
    "a=candidate:4 1 udp 2122194687 fd00:1:2::abcd 50000 typ host generation 0"].join("\r\n");
  const read = readSdp(sdp);
  check(read.candidates.map(c => c.address).join() === "192.168.8.12,fd00:1:2::abcd,62a9b3c3-d7a2-4a55-a884-afd039f359d9.local", "a description's UDP addresses are kept, real ones first, TCP left out");
  const code = encodeLink({ kind: "answer", id: 4321, name: "Sarah", ...read });
  const back = decodeLink(code);
  check(code.startsWith("AL1:") && code.length < 200, `a code is short (${code.length} characters)`);
  check(back.kind === "answer" && back.id === 4321 && back.name === "Sarah" && back.ufrag === "pG6v" && back.pwd === read.pwd && back.setup === "active"
    && back.fingerprint.join() === read.fingerprint.join(), "a code reads back as it was written");
  check(back.candidates.map(c => `${c.address}:${c.port}`).join() === "192.168.8.12:41224,fd00:1:2:0:0:0:0:abcd:50000,62a9b3c3-d7a2-4a55-a884-afd039f359d9.local:40105", "its addresses too, IPv4, IPv6 and a multicast DNS name");
  const out = writeSdp(back);
  check(/a=ice-ufrag:pG6v\r\n/.test(out) && /a=fingerprint:sha-256 D6:1E:DA/.test(out) && /a=setup:active/.test(out) && /m=application 9 UDP\/DTLS\/SCTP webrtc-datachannel/.test(out)
    && (out.match(/a=candidate:/g) || []).length === 3, "the description is written back out in full");
  check(decodeLink("https://example.com/qr") === null && decodeLink("AL1:%%%") === null && decodeLink(code.slice(0, 30)) === null, "anything else scanned (another QR code, half a code) is turned down");
}

// ---------- the protocol ----------
const host = createHost({ awayMs: 600, now: () => Date.now() + 5000 });   // the host's clock five seconds ahead
const local = createClient({ uid: "h" });
local.attachLocal(host);
const guest = (uid, opts = {}) => {
  const c = createClient({ uid, name: uid.toUpperCase(), pingMs: 150, lateMs: 400, ...opts });
  const [mine, theirs] = pipe();
  host.attach(theirs);
  c.attach(mine);
  c.pipe = mine;
  return c;
};
const a = guest("a"), b = guest("b");
const pa = a.page(), pb = b.page(), ph = local.page();
await sleep(50);
check(host.peers.map(p => p.name).sort().join() === "A,B", "the host knows who's linked");

const seen = [];
pb.watch("crates/rooms/ABCD/x", v => seen.push(v));
await pa.update("crates/rooms/ABCD", { x: { list: [1, null, 3], gone: null, n: 2 } });
await sleep(30);
check(JSON.stringify(seen.at(-1)) === '{"list":[1,null,3],"n":2}' && !(1 in seen.at(-1).list), "another phone reads a write as Firebase gives it back (no nulls kept, a list with a hole)");
const hseen = [];
ph.watch("crates/rooms/ABCD/x/n", v => hseen.push(v));
await sleep(30);
check(hseen.at(-1) === 2, "the host's own pages read it in place");

// two phones counting at once: every count lands, each tried again on the other's
await pa.update("crates/rooms/ABCD", { count: 0 });
await Promise.all([...Array(15)].flatMap(() => [pa.tx("crates/rooms/ABCD/count", n => (n || 0) + 1), pb.tx("crates/rooms/ABCD/count", n => (n || 0) + 1)]));
const count = await new Promise(r => { const stop = ph.watch("crates/rooms/ABCD/count", v => { r(v); setTimeout(stop, 0); }); });
check(count === 30, `thirty transactions at once from two phones, thirty counted (${count})`);
const abort = await pa.tx("crates/rooms/ABCD/count", () => undefined);
check(abort.committed === false && abort.value === 30, "a transaction given up on reports what's there");
let refused = null;
try { await pa.update("crates/rooms/ABCD", { y: NaN }); } catch (e) { refused = e.message; }
let refusedTx = null;
try { await pb.tx("crates/rooms/ABCD/z", () => ({ a: undefined })); } catch (e) { refusedTx = e.message; }
check(/NaN/.test(refused || "") && /undefined/.test(refusedTx || ""), "what Firebase refuses is refused here (NaN in an update, undefined in a transaction)");

// presence and sessions: undone as the page goes, and as the phone goes
const pres = "crates/rooms/ABCD/party/players/a";
const stopP = pa.presence(pres), stopS = pa.session("crates/rooms/ABCD/here/a/s1");
await sleep(30);
check(host.db.get(pres)?.online === true && host.db.get("crates/rooms/ABCD/here/a/s1") === true, "presence and a session are marked");
const pa2 = a.page();
pa2.presence("crates/rooms/ABCD/party/players/a2");
pa.close();
await sleep(30);
check(host.db.get(pres)?.online === false && host.db.get("crates/rooms/ABCD/here/a/s1") === null && host.db.get("crates/rooms/ABCD/party/players/a2")?.online === true,
  "a page that goes (its frame moved on) is marked away and its session dropped; the phone's other page stays");
stopP(); stopS();

// the phone falls silent (asleep): it's away; it speaks again: it's back
const conn = [];
pb.connection(on => conn.push(on));
const pb2 = b.page();
pb2.presence("crates/rooms/ABCD/party/players/b");
await sleep(40);
check(host.db.get("crates/rooms/ABCD/party/players/b")?.online === true, "a guest's presence is marked");
b.pipe.readyState = "asleep";                                  // its messages stop both ways, the link still up
const realSend = b.pipe.send;
b.pipe.send = () => {};
await sleep(1000);
check(host.db.get("crates/rooms/ABCD/party/players/b")?.online === false, "a phone silent for a while is taken as away");
check(conn.at(-1) === false, "and, hearing nothing, shows itself offline");
b.pipe.readyState = "open";
b.pipe.send = realSend;
await sleep(400);
check(host.db.get("crates/rooms/ABCD/party/players/b")?.online === true && conn.at(-1) === true, "back again, it's here again");

// the link lost: the phone's pages carry on on a new one, watches and presence said again
const before = seen.length;
a.pipe.close();
await sleep(40);
check(host.db.get("crates/rooms/ABCD/party/players/a2")?.online === false && host.peers.length === 1, "a link that closes: the phone is away and gone from the list");
const pending = pa2.update("crates/rooms/ABCD", { late: 1 });       // made while unlinked: sent on the new link
const [m2, t2] = pipe();
host.attach(t2);
a.attach(m2);
a.pipe = m2;
await pending;
await sleep(60);
check(host.db.get("crates/rooms/ABCD/late") === 1 && host.db.get("crates/rooms/ABCD/party/players/a2")?.online === true, "linked again: what was made meanwhile lands, and the phone is here again");
const pa3 = a.page();
const latest = [];
pa3.watch("crates/rooms/ABCD/x/n", v => latest.push(v));
await pb.update("crates/rooms/ABCD/x", { n: 7 });
await sleep(40);
check(latest.at(-1) === 7 && seen.length > before, "and its pages hear changes again");

// a long value goes in pieces
const long = "x".repeat(50000);
await pa3.update("crates/rooms/ABCD", { long });
const got = await new Promise(r => { const stop = pb.watch("crates/rooms/ABCD/long", v => { if (v) { r(v); setTimeout(stop, 0); } }); });
check(got === long, "a value of 50,000 characters crosses in pieces");

// nothing outside the rooms travels
let solo = "unset";
pa3.watch("crates/runs/ABCDEFGH", v => { solo = v; });
await pa3.update("crates/runs/ABCDEFGH", { "crates%3Arun": { v: "1", t: 1 } });
const outside = await pa3.tx("crates/flags/q1", () => 1);
await sleep(30);
check(solo === null && host.db.get("crates/runs") === null && outside.committed === false, "a page's own syncing sees an empty database that keeps nothing");
const party = a.page({ room: () => "ABCD" });
let partner = "unset";
party.watch("crates/rooms/PAIR/live", v => { partner = v; });
await party.update("crates/rooms/PAIR/live/x", { name: "Korbi" });
await party.update("crates/rooms/ABCD/mine", { ok: 1 });
await sleep(30);
check(partner === null && host.db.get("crates/rooms/PAIR") === null && host.db.get("crates/rooms/ABCD/mine/ok") === 1, "once the party's room is known, a page reaches only it (not your partner's room)");

// the clocks
await sleep(300);
const off = await new Promise(r => pb.serverOffset(r));
check(Math.abs(off - 5000) < 60, `a guest's clock agrees with the host's (offset ${off} ms for 5,000)`);
for (const c of [a, b]) c.detach();
host.close();

// ---------- a table of four, played through it ----------
{
  const h = createHost();
  const hc = createClient({ uid: "host" });
  hc.attachLocal(h);
  const clients = { host: hc };
  for (const uid of ["s", "m", "t"]) {
    const c = createClient({ uid, name: uid });
    const [mine, theirs] = pipe();
    h.attach(theirs);
    c.attach(mine);
    c.pipe = mine;
    clients[uid] = c;
  }
  const tables = {};
  const table = uid => (tables[uid] = createTable({ game: "test", app: 1, max: 4, sync: clients[uid].page(), backupMs: 60 }));
  const code = await table("host").open({ name: "Korbi", pid: "pk" });
  const joined = await Promise.all(["s", "m", "t"].map((uid, i) => table(uid).join(code, { name: ["Sarah", "Mei", "Tom"][i], pid: `p${uid}` })));
  await sleep(60);
  check(joined.join() === "ok,ok,ok" && tables.host.players.map(p => p.seat).join() === "0,1,2,3", `three sit down at once at the host's table (${code}), each in a seat of their own`);
  const moves = await Promise.all(["host", "s", "m", "t"].map(uid => tables[uid].act(b => { b.moves = (b.moves || 0) + 1; })));
  await sleep(60);
  check(moves.every(Boolean) && tables.s.data.moves === 4 && tables.t.data.rev === 4, "four moves at once all land, one after another");
  clients.m.pipe.close();
  await sleep(60);
  check(tables.host.players.find(p => p.name === "Mei")?.online === false && driverOf(tables.host.data) === "host", "a phone whose link closes shows away at the table");
  const [mine, theirs] = pipe();
  h.attach(theirs);
  clients.m.attach(mine);
  await sleep(80);
  check(tables.host.players.find(p => p.name === "Mei")?.online === true && tables.m.me?.seat === 2, "scanned back in, it's at its own seat again");
  for (const c of Object.values(clients)) c.detach();
  h.close();
}

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall passed");
