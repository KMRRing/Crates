// Sitting down at a duo table (rooms.js, sitDown: the joining transaction every together game runs): the first to
// come deals, the second sits across; a player gets their own seat back on any of their devices without being asked;
// a request the pair said yes to gets a new table, dealt by whichever of them arrives first and sat at by the other;
// nobody is dealt over without one; a third player changes nothing unless they chose a seat. A pair's room opens as a
// room from its first request (it once had to be made by a game first). And otherHere, which says where your partner
// is, doesn't mistake your own other devices, or a page left open, for them.
import { sitDown, seatsOf, otherHere, openRoom } from "../rooms.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const valid = g => g?.v === 1;
const table = (players, extra = {}) => ({ v: 1, players, log: [], ...extra });
const seat = (name, slot, pid) => ({ name, slot, ...(pid ? { pid } : {}), online: true });
// Korbi on his phone (a1) and his iPad (a2), one player; Simeon (b1); someone else (c1)
const A = { uid: "a1", pid: "pa", name: "Korbi" }, A2 = { uid: "a2", pid: "pa", name: "Korbi" };
const B = { uid: "b1", pid: "pb", name: "Simeon" }, C = { uid: "c1", pid: "pc", name: "Eve" };

// a new room: the first to come deals and sits at 0, the second sits across at 1
const dealtA = table({ a1: seat("Korbi", 0, "pa") });
const first = sitDown(null, A, { initial: dealtA, valid });
check(first === dealtA, "the first to come deals the table");
check(sitDown(null, A, { valid }) === null, "with no table to deal, an empty branch is answered with null (Firebase then asks the server)");
const both = sitDown(first, B, { valid });
check(both.players.a1.slot === 0 && both.players.b1.slot === 1 && both.players.b1.pid === "pb", "the second sits across, at 1, with their player id");

// the same device again: its seat, its new name
const again = sitDown(both, { ...A, name: "Korbi R" }, { valid });
check(again.players.a1.slot === 0 && again.players.a1.name === "Korbi R" && seatsOf(again).length === 2, "the same device sits where it sat");

// the same player on another device: their own seat back, moves and all, without being asked
const played = { ...both, log: [{ by: "a1", t: "play" }, { by: "b1", t: "pass" }] };
const moved = sitDown(played, A2, { valid });
check(moved.players.a2?.slot === 0 && !moved.players.a1 && moved.players.b1.slot === 1, "your other device takes your seat, not the free one or your partner's");
check(moved.log[0].by === "a2" && moved.log[1].by === "b1", "and your moves with it");
check(sitDown(played, { uid: "b2", pid: "pb", name: "Simeon" }, { valid }).players.b2?.slot === 1, "the same for your partner's other device");
const alone = sitDown(first, A2, { valid });
check(alone.players.a2?.slot === 0 && seatsOf(alone).length === 1, "your other device doesn't take the seat kept for your partner");

// a third player at a full table: nothing changes, unless they chose a seat to carry on in (pickSeat)
check(sitDown(both, C, { valid }) === undefined, "a full table is left alone");
const took = sitDown(both, C, { takeover: "b1", valid });
check(took.players.c1?.slot === 1 && !took.players.b1 && took.players.a1.slot === 0, "a seat chosen to carry on in is taken over");
check(sitDown(both, C, { takeover: "gone", valid }) === undefined, "a chosen seat that's gone meanwhile isn't invented");

// a request the pair said yes to: a new table, dealt over the old by whichever arrives first, sat at by the other
const old = { ...played, asked: 100 };
const dealtB = table({ b1: seat("Simeon", 0, "pb") }, { asked: 200, deal: "B's" });
const n1 = sitDown(old, B, { initial: dealtB, asked: 200, valid });
check(n1 === dealtB, "the first to arrive for a new request deals a new table over the old one");
const n2 = sitDown(n1, A, { initial: table({ a1: seat("Korbi", 0, "pa") }, { asked: 200, deal: "A's" }), asked: 200, valid });
check(n2.deal === "B's" && n2.players.b1.slot === 0 && n2.players.a1.slot === 1, "the second sits down at that table, across (in Tribute, seat 2: the same side)");
check(sitDown(n2, A, { asked: 200, valid }).deal === "B's", "coming back for the same request sits down again, nothing dealt");
const n3 = sitDown(n2, B, { initial: table({ b1: seat("Simeon", 0, "pb") }, { asked: 300, deal: "next" }), asked: 300, valid });
check(n3.deal === "next", "the next request gets the next table");

// without a request, a table is never dealt over (a deal made for an empty branch that someone filled meanwhile)
const filled = sitDown(both, A, { initial: table({ a1: seat("Korbi", 0, "pa") }, { deal: "spare" }), valid });
check(filled.deal === undefined && filled.players.a1.slot === 0 && filled.players.b1.slot === 1, "an existing table isn't dealt over without a request");

// a state this game can't read: dealt over when there's a table to deal, else left alone
const odd = { v: 0, players: { b1: seat("Simeon", 0, "pb") } };
check(sitDown(odd, A, { initial: dealtA, valid }) === dealtA && sitDown(odd, A, { valid }) === undefined, "a state this game can't read is replaced by a new table, never sat at");

// leftovers (a device that handed its seat over still marks itself offline) aren't seats
const leftover = { ...first, players: { ...first.players, zz: { online: false } } };
check(seatsOf(leftover).length === 1, "a leftover isn't a seat");
const withLeft = sitDown(leftover, B, { valid });
check(withLeft.players.b1.slot === 1 && !withLeft.players.zz, "a leftover doesn't take the free seat, and is cleared away");

// tables from before seats knew their players: the device still finds its seat; another device must choose
const legacy = table({ a1: seat("Korbi", 0), b1: seat("Simeon", 1) });
check(sitDown(legacy, A, { valid }).players.a1.pid === "pa", "an old seat learns its player's id when its device comes back");
check(sitDown(legacy, A2, { valid }) === undefined, "an old seat isn't given to another device unasked");
check(sitDown(legacy, { uid: "x", name: "Old" }, { takeover: "a1", valid }).players.x.pid === undefined, "a device with no player id writes none");

// opening a room: a pair's room is one from its first request, before any game has a branch in it
const roomOf = async root => {
  const writes = [];
  const sync = { async tx(path, fn) { const v = fn(root === null ? null : structuredClone(root)); if (v !== undefined) writes.push(v); return { committed: v !== undefined, value: v ?? root }; } };
  return { room: await openRoom(sync, "ABCD"), writes };
};
const pair = await roomOf({ live: { pa: { d1: { game: "tribute", mode: "solo" } } }, ask: { from: "pa", game: "tribute", at: 1, answer: "yes" } });
check(pair.room?.ask?.answer === "yes" && !pair.writes.length, "a pair's room opens as a room before any game is in it, and isn't rewritten");
check((await roomOf({ suite: 1, tribute: { v: 1 } })).room?.tribute?.v === 1, "a room made by createRoom opens as it is");
const lifted = await roomOf({ v: 3, players: {} });
check(lifted.room?.suite === 1 && lifted.room.crates?.v === 3 && lifted.writes.length === 1, "an old Crates room is lifted into its branch");
check((await roomOf({ something: "else" })).room === null && (await roomOf(null)).room === null, "anything else isn't a room");

// where your partner is: not your own other devices, a page open now before one left open, this game before another
const here = {
  a1: { game: "tribute", name: "Korbi", online: true, pid: "pa" },
  a2: { game: "hong", name: "Korbi", online: true, pid: "pa" },
  b0: { game: "stow", name: "Simeon", online: false, pid: "pb" },
  b1: { game: "hong", name: "Simeon", online: true, pid: "pb" },
  b2: { game: "tribute", name: "Simeon", online: true, pid: "pb" },
};
check(otherHere(here, "a1", "pa", "tribute")?.id === "b2", "your partner's page in this game, not your own iPad or their page left open");
check(otherHere(here, "a1", "pa")?.id === "b1", "without a game to prefer, the first page of theirs that's open");
check(otherHere({ a2: here.a2 }, "a1", "pa") === null, "your own other device is nobody");
check(otherHere({ a1: here.a1, b0: here.b0 }, "a1")?.id === "b0", "without player ids, anyone else (as before)");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("rooms: the pair sits at one table, each in their own seat");
