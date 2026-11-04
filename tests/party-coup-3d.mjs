// Cabal's 3D table: what it shows from the game's state (nothing the flat table doesn't), where the seats stand, which view is
// chosen (the suite's default until a pick, and only a pick is saved), and how the page wires it (loaded only when wanted, a
// fallback to the flat table, the menu's choice, the pause).
import { readFileSync } from "node:fs";
import "../party-core.js";                                          // first: the games import each other in a circle
import coup from "../party-coup.js";
import { sceneOf, signature, seatSpots, stacks, stackAt, STACK, wants3D, pick3D } from "../party-coup-table.js";
import { SKINS } from "../party-coup-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rng = (() => { let a = 7; return () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; }; })();

const players = ["a", "b", "c", "d"].map((uid, seat) => ({ uid, name: uid.toUpperCase(), seat }));
const s = coup.start({ players, options: { clock: "0" }, rng, now: 0 });

// the scene is the state
const t = sceneOf(s, "c");
check(t.seats.map(p => p.uid).join("") === "cdab", "seats come round from your own, the next on your left");
check(t.seats[0].me && t.seats[0].mine?.length === 2 && t.seats.slice(1).every(p => !p.me && p.mine === null && p.cards === 2), "only your own cards are shown face up; the others' are backs");
check(sceneOf(s, "c", { hidden: true }).seats[0].mine === null, "tapped face down, your cards are backs too");
check(sceneOf(s, "zz").seats[0].uid === "a", "a watcher not at the table sees the first seat at the foot");
check(t.deck === s.deck.length && t.seats.every(p => p.coins === s.coins[p.uid]), "the deck and the coins are the table's");
check(t.seats.filter(p => p.turn).length === 1 && t.seats.find(p => p.turn).uid === s.turn, "one seat is on turn");
check(JSON.stringify(sceneOf(s, "c")).includes(s.hand.a[0]) === false || s.hand.a.every(c => s.hand.c.includes(c)), "a rival's hidden cards are not in the scene");

// a claim and a target
const s2 = structuredClone(s);
s2.phase = "challenge"; s2.act = { by: "a", kind: "assassinate", target: "b" }; s2.claim = { by: "a", card: "assassin", on: "act" };
const t2 = sceneOf(s2, "c");
check(t2.claim?.by === "a" && t2.claim.card === "assassin" && !t2.claim.block && t2.seats.find(p => p.uid === "b").target, "a claim is shown with its claimant, the target is marked");
s2.claim.on = "block";
check(sceneOf(s2, "c").claim.block === true, "a block is a claim that says so");

// lost cards face up, a player out
const s3 = structuredClone(s);
s3.dead = { b: ["duke"] }; s3.hand.b = ["captain"]; s3.dead.d = ["contessa", "duke"]; delete s3.hand.d; s3.coins.d = 0;
const t3 = sceneOf(s3, "c");
check(t3.seats.find(p => p.uid === "b").dead.join() === "duke" && t3.seats.find(p => p.uid === "b").cards === 1, "a lost card lies face up beside the one left");
check(t3.seats.find(p => p.uid === "d").out && t3.seats.find(p => p.uid === "d").dead.length === 2 && !t3.seats.find(p => p.uid === "d").turn, "a player out has both cards up and no turn");
check(signature(t3) !== signature(t) && signature(t) === signature(sceneOf(s, "c")), "the signature changes with the table and not otherwise");
const s4 = structuredClone(s3);
s4.phase = "over"; s4.won = "c"; s4.step = "over";
check(sceneOf(s4, "c").over && sceneOf(s4, "c").seats[0].won && sceneOf(s4, "c").seats.every(p => !p.turn && !p.target), "at the end the winner is marked and nobody's turn");

// where the seats stand
for (const n of [2, 3, 4, 5, 6]) {
  const sp = seatSpots(n, 2);
  check(sp.length === n && Math.abs(sp[0].x) < 1e-9 && sp[0].z > 0 && sp[0].turn === 0, `${n} seats: yours at the foot facing the middle`);
  const gaps = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) gaps.push(Math.hypot(sp[i].x - sp[j].x, (sp[i].z - sp[j].z) * 1.4));
  check(Math.min(...gaps) > 2.1, `${n} seats: no two closer than a seat is wide`);
}
check(seatSpots(4, 2)[1].x < 0 && seatSpots(4, 2)[3].x > 0, "the next seat is on your left, as at a real table");
check(seatSpots(4, 3.4)[0].rx > seatSpots(4, 1.2)[0].rx, "a wider picture makes a wider table");
check(stacks(0) === 0 && stacks(1) === 1 && stacks(STACK) === 1 && stacks(STACK + 1) === 2 && stackAt(0).x !== stackAt(1).x, "coins stack six to a stack, in two columns");
check(Object.keys(SKINS.day).join() === Object.keys(SKINS.night).join(), "day and night name the same colours");

// the choice: the suite's default until a pick; only a pick is written
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.dispatchEvent = () => true;
check(wants3D() === true && !store.has("party:coup-view"), "no choice and no battery saver: 3D, and nothing written");
store.set("settings:flat", "1");
check(wants3D() === false && !store.has("party:coup-view"), "the battery saver makes flat the default, and still nothing is written");
pick3D(true);
check(wants3D() === true && store.get("party:coup-view") === "3d", "an explicit pick of 3D wins over the battery saver");
pick3D(false);
check(wants3D() === false && store.get("party:coup-view") === "flat", "an explicit pick of flat is kept");
store.delete("settings:flat"); store.set("party:coup-view", "flat");
check(wants3D() === false, "a pick of flat holds without the saver");
check(coup.viewChoice().value === "flat" && coup.viewChoice().options.map(o => o[0]).join() === "flat,3d", "the game offers the choice for the menu");

// the page
const page = readFileSync(new URL("../party-coup.js", import.meta.url), "utf8"), party = readFileSync(new URL("../party.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../party-coup.css", import.meta.url), "utf8"), three = readFileSync(new URL("../party-coup-3d.js", import.meta.url), "utf8");
check(/import\("\.\/party-coup-3d\.js"\)/.test(page) && !/^import .*party-coup-3d/m.test(page), "three.js comes only when the table is drawn in 3D");
check(/three\.broken = true/.test(page) && /lostAt/.test(page) && /flat table/.test(page), "no WebGL, or a lost context, leaves the flat table, and says so");
check(/viewChoice\?\.\(\)/.test(party) && /part\(body, "settings"\)/.test(party), "Party's menu puts the game's choice in the settings part");
check(/mn\.onPause\(\(\) => three\.table\?\.hold\(true\)/.test(page), "the picture stands still while the menu is open");
check(/webglcontextlost/.test(three) && /prefers-reduced-motion/.test(three) && /Math\.min\(devicePixelRatio \|\| 1, 2\)/.test(three), "context loss, reduced motion and a pixel ratio of at most 2 are handled");
check(!/filter:|new THREE\.\w*Shadow|castShadow|shadowMap/.test(three), "no filters and no shadow maps (Safari)");
check(/cp-sr/.test(page) && /\.cp-sr/.test(css), "the flat list stays for a screen reader");
check(!/\b(alert|confirm|prompt)\(/.test(page + three), "no browser pop-ups");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
