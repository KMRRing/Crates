// Joining a partner's board (coop-request.js, docs/coop.md): the request and its answers as transactions that only the
// first can win, the party of two a yes opens (Party's own table, the host and the guest seated, the board in the game's
// request), both phones landing on the same board whichever arrives first, a phone that reloads or comes in late sitting
// in its own seat, and leaving: the guest tells the host, the host ends it for both. On the database in memory
// (tests/fake-db.js) with a host's phone and iPad and the guest's phone.
import { step, transact, requestJoin, cancelJoin, lapseJoin, declineJoin, acceptJoin, openCoopParty, coopHref, shouldFollow, leaveCoop, open, JOIN_FOR, joinPath } from "../coop-request.js";
import { COOP_GAMES, coopGame } from "../coop-games.js";
import { newRoom, commit, cellEdit, validBoard, tallyEdit, onceEdit, tallyOf } from "../board-share.js";
import { sitDown, seatsOf, openBranch, branchPath } from "../rooms.js";
import { seated } from "../table.js";
import { generate, NONE, withMark, LINE } from "../slitherlink-engine.js";
import { ELSEWHERE } from "../party-core.js";
import { fakeDb } from "./fake-db.js";
import { same } from "./rtdb.js";
import fs from "node:fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const game = { ...COOP_GAMES.slitherlink, ...(await COOP_GAMES.slitherlink.load()).default };      // the registry's entry and the adapter, as one

// a run of Slitherlink in play, as the game saves it
const puzzle = generate(11, 5, "easy");
const run = { v: 1, mode: "random", seed: 11, size: 5, level: "easy", twist: "none", came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol,
  marks: withMark(withMark(NONE.repeat(puzzle.sol.length), 0, LINE), 3, "2"), undo: [[0, "0", "1"]], redo: [], ms: 41250.7, hints: 1, done: null, lit: null };

// ---------- the registry and the adapter ----------
{
  check(coopGame("slitherlink") === COOP_GAMES.slitherlink && coopGame("nope") === null && game.page === "slitherlink.html" && game.keys.join() === "slitherlink:run", "the registry has the game, its page and the key its board is saved under");
  const b = game.share({ "slitherlink:run": JSON.stringify(run) });
  check(b && b.layers.marks === run.marks && b.fixed.seed === 11 && b.fixed.sol === run.sol && b.start.ms === 41251 && b.start.hints === 1 && !("undo" in b) && !("lit" in b), "the host's run becomes a board: the puzzle, the marks, the clock and hints so far; undo and the hint showing stay behind");
  check(game.share({}) === null && game.share({ "slitherlink:run": "not json" }) === null && game.share({ "slitherlink:run": JSON.stringify({ ...run, done: { ms: 1, score: 1 } }) }) === null, "nothing in play, or a solved board, is nothing to share (a new puzzle is dealt instead)");
  const room = newRoom(b, { players: {}, host: "pk" });
  commit(room, [tallyEdit("hints", "x1"), onceEdit("done", { ms: 90000, score: 90030, by: 1 })]);
  const back = game.run(room.board);
  check(back.marks === run.marks && back.hints === 2 && back.done.ms === 90000 && back.sol === run.sol && back.twist === "none" && game.valid(room.board), "the board is a run again: the hints taken together added to the host's, the solve in it");
  check(same(JSON.parse(JSON.stringify(room)), room) && validBoard(room), "…and the room is plain JSON");
}

// ---------- the request and its answers ----------
{
  const T = 1_000_000;
  const ask = { type: "ask", pid: "ps", uid: "G1", name: "Sarah", game: "slitherlink" };
  const r = step(null, ask, T);
  check(r.from === "ps" && r.device === "G1" && r.at === T && !r.answer, "a request names who asks, from which device, for which game, and when");
  check(step(r, { type: "ask", pid: "pk", uid: "H1", name: "Korbi", game: "slitherlink" }, T + 5) === undefined, "the partner's own request, waiting, isn't replaced by one the other way");
  check(step(r, ask, T + 5).at === T + 5 && step({ ...r, answer: "no" }, { type: "ask", pid: "pk", uid: "H1", game: "slitherlink" }, T + 5).from === "pk" && step(r, { type: "ask", pid: "pk", uid: "H1", game: "slitherlink" }, T + JOIN_FOR + 1).from === "pk",
    "…but your own asked again, an answered one, or one past its two minutes is replaced");
  const claimed = step(r, { type: "claim", at: T, uid: "H1" }, T + 10);
  check(claimed.answer === "accepting" && claimed.by === "H1" && step(claimed, { type: "claim", at: T, uid: "H2" }, T + 11) === undefined, "a host device claims it, and a second device can't");
  check(step(r, { type: "claim", at: T + 1, uid: "H1" }, T + 10) === undefined && step(r, { type: "claim", at: T, uid: "H1" }, T + JOIN_FOR) === undefined, "a claim for another request, or past the two minutes, does nothing");
  check(step(claimed, { type: "yes", at: T, uid: "H1", party: "QRST", playAt: 5 }, T + 20).answer === "yes" && step(claimed, { type: "yes", at: T, uid: "H2", party: "QRST", playAt: 5 }, T + 20) === undefined && step(r, { type: "yes", at: T, uid: "H1", party: "QRST", playAt: 5 }, T + 20) === undefined, "yes is only the claiming device's, and only after the claim");
  check(step(r, { type: "no", at: T }, T + 1).answer === "no" && step(claimed, { type: "no", at: T }, T + 1) === undefined, "Not now answers an open request, not one being accepted");
  check(step(claimed, { type: "cancel", at: T }, T + 1).answer === "cancelled" && step(claimed, { type: "late", at: T }, T + 1).answer === "late" && step({ ...r, answer: "yes" }, { type: "cancel", at: T }, T + 1) === undefined, "the asker can withdraw or give up while it is open or being accepted, never after a yes");
  check(open(r, T + 1) && !open(r, T + JOIN_FOR) && !open({ ...r, answer: "no" }, T + 1) && open(claimed, T + 1), "a request is open until it is answered or runs out");
}

// ---------- on the database ----------
const db = fakeDb();
const PAIR = "PAIR";
const HOST = { uid: "H1", pid: "pk", name: "Korbi" }, PAD = { uid: "H2", pid: "pk", name: "Korbi" }, GUEST = { uid: "G1", pid: "ps", name: "Sarah" };
const phone = d => Object.assign(db.device(d.uid), d);
const hostPhone = phone(HOST), hostPad = phone(PAD), guest = phone(GUEST);
const saved = { "slitherlink:run": JSON.stringify(run) };
const board = game.share(saved);
const rooms = () => Object.keys(db.read("crates/rooms") || {}).filter(c => c !== PAIR);      // the parties; the pair's own room holds the request

// declined, withdrawn, lapsed
{
  const a = await requestJoin(guest, PAIR, { pid: GUEST.pid, name: GUEST.name, game: "slitherlink" });
  check(a.ok && db.read(joinPath(PAIR)).from === "ps", "the request is in the pair's room");
  check(!(await requestJoin(hostPhone, PAIR, { pid: HOST.pid, name: HOST.name, game: "slitherlink" })).ok, "the partner can't ask the other way while it waits");
  check((await declineJoin(hostPhone, PAIR, a.at)).mine && db.read(joinPath(PAIR)).answer === "no" && !(await declineJoin(hostPad, PAIR, a.at)).mine, "Not now lands once; the host's other device is told it came too late");
  const acc = await acceptJoin(hostPad, PAIR, db.read(joinPath(PAIR)), PAD, { game, board });
  check(!acc.ok && acc.why === "taken" && rooms().length === 0, "accepting an answered request opens no party");

  const b = await requestJoin(guest, PAIR, { pid: GUEST.pid, name: GUEST.name, game: "slitherlink" });
  check((await cancelJoin(guest, PAIR, b.at)).mine, "the asker can withdraw");
  check(!(await acceptJoin(hostPhone, PAIR, { ...db.read(joinPath(PAIR)), answer: undefined }, HOST, { game, board })).ok && rooms().length === 0, "…and then nobody can accept it");
  const c = await requestJoin(guest, PAIR, { pid: GUEST.pid, name: GUEST.name, game: "slitherlink" });
  check((await lapseJoin(guest, PAIR, c.at)).mine && db.read(joinPath(PAIR)).answer === "late", "after two minutes the asker's phone marks it lapsed");
}

// accepted by two devices at once: one party, one yes
let ask, party, req, accepted;
{
  const a = await requestJoin(guest, PAIR, { pid: GUEST.pid, name: GUEST.name, game: "slitherlink" });
  req = db.read(joinPath(PAIR));
  const [x, y] = await Promise.all([acceptJoin(hostPhone, PAIR, req, HOST, { game, board }), acceptJoin(hostPad, PAIR, req, PAD, { game, board })]);
  const won = [x, y].filter(r => r.ok), lost = [x, y].filter(r => !r.ok);
  check(won.length === 1 && lost.length === 1 && lost[0].why === "taken" && rooms().length === 1, "two host devices accepting at once: one party opens, the other is told it was taken");
  const node = db.read(joinPath(PAIR));
  check(node.answer === "yes" && node.party === won[0].code && node.playAt === won[0].at && node.by === (x.ok ? "H1" : "H2"), "the yes names the party and when the game starts in it, and the device that opened it");
  const code = won[0].code, at = won[0].at;
  accepted = { code, at, hostUid: node.by };
  party = db.read(branchPath(code, "party"));
  ask = db.read(`crates/rooms/${code}/ask`);
  const hostUid = node.by, hostSeat = party.players[hostUid];
  check(party.v === 1 && party.coop === true && party.host === hostUid && seated(party).length === 2 && hostSeat.seat === 0 && hostSeat.online === true
    && party.players.G1.seat === 1 && party.players.G1.pid === "ps" && party.players.G1.online === false, "the party is Party's own table of two: the host in seat 0, the guest in seat 1 and away until their phone sits down");
  check(party.playing.id === "slitherlink" && party.playing.kind === "duo" && party.playing.coop === true && party.playing.who.includes("G1") && party.playing.who.includes(hostUid) && party.playing.at === at, "…with the game as its choice, as a party would have chosen it");
  check(ask.game === "slitherlink" && ask.answer === "yes" && ask.at === at && ask.from === "pk" && ask.people === 2 && same(ask.board, board), "the game's own request is in the party's room, said yes to already, carrying the host's board");
  check(coopHref(game, code, at) === `slitherlink.html?room=${code}&new=${at}&party=${code}&at=${at}&coop=1`, "both phones go to the game's page in the party's room, as Party's own do, marked co-op");
  check(shouldFollow(node, { uid: "G1", pid: "ps", followed: null }) && !shouldFollow(node, { uid: "G1", pid: "ps", followed: node.at }) && !shouldFollow(node, { uid: "G9", pid: "ps", followed: null }) && !shouldFollow({ ...node, answer: "no" }, { uid: "G1", pid: "ps", followed: null })
    && !shouldFollow(node, { uid: "G1", pid: "ps", followed: null, now: node.at + 11 * 60 * 1000 }), "the asking device goes to the party from wherever it is, once, within ten minutes");
}

// a request that lapses while the party is opening: the party goes again
{
  const a = await requestJoin(guest, PAIR, { pid: GUEST.pid, name: GUEST.name, game: "slitherlink" });
  const before = rooms().length;
  const slow = Object.create(hostPhone);                       // the host's phone, with the asker giving up just as the party opens
  slow.update = async (path, obj) => { await hostPhone.update(path, obj); await lapseJoin(guest, PAIR, a.at); };
  const r = await acceptJoin(slow, PAIR, db.read(joinPath(PAIR)), HOST, { game, board });
  check(!r.ok && r.why === "lapsed" && rooms().length === before, "a request that lapsed while the party opened leaves no party behind");
}

// ---------- both phones on the board ----------
const { code, hostUid } = accepted;
{
  // pair's room kept apart from the party's: the join node is the pair's, the party is another room
  check(code !== PAIR && db.read(`crates/rooms/${code}/party`)?.coop === true, "the party is a room of its own, apart from the pair's");
}
const GAME = "slitherlink", ROOM = branchPath(code, GAME);
/** What together.js's join does for a page opened with ?room=CODE&new=AT, in short: read the request, deal the room from the host's board if none is there, sit down. */
async function land(dev, who) {
  const shared = await openBranch(dev, code, GAME);
  const asked = shared.ask.at, before = shared[GAME] || null;
  const valid = g => validBoard(g);
  const anew = !before || !valid(before) || before.asked !== asked;
  const initial = anew ? { ...newRoom(shared.ask.board, { players: { [dev.uid]: { name: who.name, slot: 0, pid: who.pid, online: true } }, host: shared.ask.from }), asked } : null;
  const r = await dev.tx(ROOM, cur => sitDown(cur, { uid: dev.uid, pid: who.pid, name: who.name }, { initial, asked, valid, slots: 2 }));
  return r.committed ? r.value : null;
}
{
  const g1 = await land(guest, GUEST);                         // the guest is here first, and deals the host's board
  check(g1 && g1.board.layers.marks === run.marks && g1.board.fixed.seed === 11 && g1.host === "pk" && g1.players.G1.slot === 0, "whoever arrives first deals the room from the host's board, not a puzzle of their own; the host stays the host");
  const g2 = await land(db.device(hostUid), HOST);
  check(g2.players.G1.slot === 0 && seatsOf(g2).length === 2 && g2.board.layers.marks === run.marks && g2.board.rev === 0, "the host sits down at that board, in the other seat");
  const reload = await land(guest, GUEST);
  check(reload.players.G1.slot === 0 && seatsOf(reload).length === 2, "a guest who reloads sits in their own seat");
  const intruder = await land(db.device("X1"), { name: "Eve", pid: "pe" });
  check(intruder === null || seatsOf(intruder).length === 2 && !intruder.players.X1, "a third phone is not seated at a party of two");
  const pad = await land(hostPad, PAD);
  check(pad.players.H2?.pid === "pk" && seatsOf(pad).length === 2 && !pad.players.H1, "the host's other device takes the host's seat rather than a third");
}

// ---------- editing, then leaving ----------
{
  const host = db.device("H2");                                 // the iPad is the one at the table now
  const send = (dev, edits) => dev.tx(ROOM, cur => { if (cur === null) return null; commit(cur, edits); return cur; });
  await Promise.all([send(guest, [cellEdit("marks", 5, "0", "1")]), send(host, [cellEdit("marks", 6, "0", "1"), tallyEdit("hints", "pk-1")])]);
  const g = db.read(ROOM);
  check(g.board.layers.marks[5] === "1" && g.board.layers.marks[6] === "1" && g.board.layers.marks[0] === "1" && tallyOf(g.board, "hints") === 1, "the host and the guest each edit the one board at once; the host's marks from before are there too");

  // the guest leaves: the host's page finds who and that the seat is gone; the party has one person left
  await leaveCoop(guest, { code, game: GAME, host: false, uid: "G1", pid: "ps", name: "Sarah" });
  const after = db.read(ROOM), party2 = db.read(branchPath(code, "party"));
  check(after.left?.name === "Sarah" && !after.players.G1 && !seatsOf(after).some(([, p]) => p.pid === "ps") && seated(party2).length === 1 && party2.host === hostUid, "the guest leaving says so on the game's branch and frees the party seat; the host is still host");
  check(after.board.layers.marks[5] === "1", "the board stays as it was");
  // the host ends it: the room goes
  await leaveCoop(host, { code, game: GAME, host: true, uid: host.uid, pid: "pk", name: "Korbi" });
  check(db.read(`crates/rooms/${code}`) === null && rooms().every(c => c !== code), "the host leaving takes the whole room: party, request and board");
  check(db.read(joinPath(PAIR)).answer === "late", "the pair's own room is untouched (its request stays as the answer it was)");
  // the guest's page, coming back to a room that has gone, finds no board
  const gone = await openBranch(guest, code, GAME);
  check(gone === null, "a phone coming back to a party that has ended finds nothing to sit down at");
}

// ---------- every co-op game is plugged in ----------
{
  const root = new URL("../", import.meta.url).pathname, suite = fs.readFileSync(root + "suite.js", "utf8");
  const duo = new Set([...suite.match(/DUO_GAMES = \{([^}]*)\}/)[1].matchAll(/(\w+): "/g)].map(m => m[1]));
  const apps = fs.readFileSync(root + "apps.js", "utf8");
  for (const [id, entry] of Object.entries(COOP_GAMES)) {
    const page = fs.readFileSync(root + entry.page.replace(/\.html$/, ".js"), "utf8"), adapter = (await entry.load()).default;
    check(entry.id === id && fs.existsSync(root + entry.page) && entry.keys.length > 0 && entry.keys.every(k => k.startsWith(`${id}:`)), `${id}: its page exists and its board is kept under its own keys`);
    check(["share", "run", "valid"].every(f => typeof adapter[f] === "function") && (!adapter.rules || ["merge", "frozen"].some(f => typeof adapter.rules[f] === "function")), `${id}: its adapter says how a run becomes a board and back`);
    check(/startCoop\(/.test(page) && /coop=1/.test(page) && /coop\.edit\(/.test(page) && !/\bconfirm\(/.test(page), `${id}: its page joins the party of two and sends edits`);
    const race = ELSEWHERE.find(e => e.id === id);          // a game that is also raced on one deal (Bridges: duel.js) seats what the race seats
    check(new RegExp(`id: "${id}",[^\\n]*players: \\[1, ${race ? race.max : 2}\\]`).test(apps), `${id}: apps.js says ${race ? `one to ${race.max}` : "one or two"} can play it`);
    check(race ? duo.has(id) && race.race === true : !duo.has(id), `${id}: a duo match or party table only as a race on one deal (duel.js: its own tests), never as another way to share a board`);
  }
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("coop-request: request, answers, party of two, both phones on the board, leaving hold");
