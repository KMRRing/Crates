// The suite's codes, shown on the games screen.
// Solo: one 8-letter code for you. Every device that has it keeps every game in the same state: each game's saved
// state, the review pile and your settings go up to Firebase a moment after they change, and come down when a page
// opens or comes back into view, the newer winning key by key (each change carries its time). Crates' run follows the
// same code through its own sync (run.js), which already guards boards and banks of different versions.
// Duo: you and your partner link once, on the games screen, and stay linked. The link is a four-letter room that is
// yours for good (crates/rooms/CODE) and belongs to the player, not the device: it and your player id sync with your
// solo code, so your phone and laptop both know your partner. Every page you open tells the room what you're doing
// (live/PLAYER/DEVICE: the game, solo or duo, online while the page is), so your partner always sees it; either of you
// can ask the other to play a game together (ask), which shows a banner wherever the other is, and Play takes both of
// you into the duo match: the game opened in the room (?room=CODE), the solo game kept where it was. Nothing about
// multiplayer is set up inside a game.
// Loaded by every page (through pwa.js), so the sync and the presence run whichever game you open.
import { getSync } from "./net.js";
import { roomInAddress } from "./rooms.js";

const SOLO = "suite:solo", META = "suite:meta", PULLED = "suite:pulled";
const WATCHING = new URLSearchParams(location.search).has("watch");   // this page shows your partner's game (see below)
const FRAME = WATCHING && new URLSearchParams(location.search).has("frame");   // one frame of that view, inside the watching page
const PAIR = "pair:code", ME = "pair:me";       // the pair's room and your player id: synced, so all your devices share them
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PUSH_DELAY = 1500;
// what stays on this device: the suite's bookkeeping, Crates' run (synced by run.js), Firebase's own sign-in
const LOCAL = /^(suite:|crates:run|crates:updated|crates:v2|firebase:)/;
// the store sits beside Crates' run under crates/runs (where 8-letter codes may write), at the code moved on seven letters
// (codes made here avoid I and O, which read as 1 and 0; a code you choose may use any letter, and moves through all 26)
const storePath = code => `crates/runs/${/[IO]/.test(code)
  ? [...code].map(ch => String.fromCharCode(65 + ((ch.charCodeAt(0) - 65 + 7) % 26))).join("")
  : [...code].map(ch => LETTERS[(LETTERS.indexOf(ch) + 7) % LETTERS.length]).join("")}`;
const enc = k => encodeURIComponent(k).replace(/\./g, "%2E");     // a database key can't hold . # $ [ ] /
const raw = { getItem: Storage.prototype.getItem, set: Storage.prototype.setItem, remove: Storage.prototype.removeItem };
raw.get = k => raw.getItem.call(localStorage, k);
const json = (k, fallback) => { try { return JSON.parse(raw.get(k)) ?? fallback; } catch { return fallback; } };
const put = (k, v) => { try { raw.set.call(localStorage, k, typeof v === "string" ? v : JSON.stringify(v)); } catch { /* private mode */ } };

export const cleanCode = s => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
export const soloCode = () => { const c = raw.get(SOLO); return c && c.length === 8 ? c : null; };
export const duoCode = () => { const c = raw.get(PAIR); return c && c.length === 4 ? c : null; };
/** Your player id, made once and synced: it tells your devices apart from your partner's. */
export const playerId = () => { let id = raw.get(ME); if (!id) { id = Math.random().toString(36).slice(2, 12); localStorage.setItem(ME, id); } return id; };
const newPair = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
const newCode = () => Array.from({ length: 8 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
/** The game this page is (its file's name), for whether a change from elsewhere is this page's own. */
const page = () => (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
const own = k => page() !== "index" && (k.startsWith("pile:") || k.startsWith(`${page()}:`));

let meta = json(META, {}), dirty = new Map(), timer = null;
const syncing = () => !!soloCode();

/** Starts a solo code on this device (a new one, or one you chose that nobody has yet): everything here goes up, as of now. */
export function startSolo(code = newCode()) {
  meta = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!LOCAL.test(k)) meta[k] = Date.now(); }
  put(META, meta);
  put(SOLO, code);
  linkCrates(code);
  return code;
}
/** Joins a code started elsewhere: what's there wins over what's here (this device's progress so far stays only where the code has none). */
export function joinSolo(code) {
  meta = {};
  put(META, meta);
  put(SOLO, code);
  sessionStorage.removeItem(PULLED);
  linkCrates(code);
}
export function stopSolo() { raw.remove.call(localStorage, SOLO); }
/**
 * A solo code you typed or followed a link to: if it already holds someone's games, follow it (what's there wins);
 * if nobody has it yet, it becomes yours, starting from what this device has now. Resolves "joined" or "started".
 */
export async function chooseSolo(code) {
  let there = null;
  try { there = await once(await getSync(), storePath(code)); } catch (e) { console.error(e); }
  if (there && Object.keys(there).length) { joinSolo(code); return "joined"; }
  startSolo(code);
  return "started";
}
/** Crates' run follows the same code through run.js; rev 0 means whatever the code holds is newer. */
function linkCrates(code) { put("crates:run", { code, rev: 0, dirty: true }); }
/**
 * Links you to a partner by their code, or (none given) makes a new code to give them; a code nobody has used yet is
 * simply a new, empty room, so you can pick your own. Synced to your other devices.
 */
export function link(code) { code = code || newPair(); localStorage.setItem(PAIR, code); return code; }
export function unlink() { localStorage.removeItem(PAIR); }

// every write to this device's storage is noted with its time, and goes up a moment later
function touched(k, v) {
  if (typeof k !== "string") return;
  if (!WATCHING && duoCode() && k.startsWith(storePrefix(pageGame())) && !mirrorTimer) mirrorTimer = setTimeout(() => { mirrorTimer = null; mirror(); }, PUSH_DELAY);
  if (!syncing() || LOCAL.test(k)) return;
  meta[k] = Date.now();
  put(META, meta);
  dirty.set(k, { v, t: meta[k] });
  clearTimeout(timer);
  timer = setTimeout(push, PUSH_DELAY);
}
Storage.prototype.setItem = function (k, v) {
  if (this === localStorage && WATCHING && !k.startsWith("suite:")) return;      // watching: their game, nothing of yours is written
  raw.set.call(this, k, v);
  if (this === localStorage) touched(k, String(v));
};
Storage.prototype.removeItem = function (k) {
  if (this === localStorage && WATCHING && !k.startsWith("suite:")) return;
  raw.remove.call(this, k);
  if (this === localStorage) touched(k, null);
};

async function push() {
  const code = soloCode();
  if (!code || !dirty.size) return;
  const batch = Object.fromEntries([...dirty].map(([k, x]) => [enc(k), x]));
  dirty = new Map();
  try { await (await getSync()).update(storePath(code), batch); } catch (e) { console.error(e); for (const [ek, x] of Object.entries(batch)) dirty.set(decodeURIComponent(ek), x); }
}
const once = (sync, path) => new Promise(resolve => { const stop = sync.watch(path, v => { resolve(v); setTimeout(() => stop?.(), 0); }, () => resolve(null)); });

/** Takes what's newer on the code than here; sends up what's newer here. A change to this page's own game reloads it (once a visit). */
export async function pull() {
  const code = soloCode();
  if (!code) return;
  let remote;
  try { remote = await once(await getSync(), storePath(code)); } catch (e) { console.error(e); return; }
  let mine = false;
  for (const [ek, x] of Object.entries(remote || {})) {
    const k = decodeURIComponent(ek);
    if (LOCAL.test(k) || !x || (meta[k] || 0) >= x.t) continue;
    if (x.v == null) raw.remove.call(localStorage, k); else raw.set.call(localStorage, k, x.v);
    meta[k] = x.t;
    if (own(k)) mine = true;
  }
  for (const [k, t] of Object.entries(meta)) if (!(remote?.[enc(k)]?.t >= t)) dirty.set(k, { v: raw.get(k), t });
  put(META, meta);
  if (dirty.size) push();
  if (mine && !sessionStorage.getItem(PULLED)) { sessionStorage.setItem(PULLED, "1"); location.reload(); }
}

// ---------- comparable results ----------
/** The day, the same for everyone: the UTC date as YYYYMMDD. It seeds every game's daily, which is dealt on the device
 *  (offline too) and is the same set wherever you are, rolling over at the same moment for everyone. */
export const today = () => { const d = new Date(); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
/** Games whose best counts only comparable runs: the daily, and the Standard preset (everything in, default settings,
 *  nothing from your pile or your history dealt in). The games screen and your partner see only these. */
export const RANKED = new Set(["chart", "quote", "punt"]);     // Crates joins as its daily lands
/** Notes a comparable result (higher is better): the best of them, and for a daily (day: the date it was dealt for,
 *  YYYYMMDD) that day's, the latest day's only, so an older daily from a link leaves today's alone. */
export function noteComparable(app, score, day = null) {
  if (!Number.isFinite(score)) return;
  const r = json(`${app}:ranked`, null) || {};
  if (r.best == null || score > r.best) r.best = score;
  if (day && (!r.day || day > r.day.key || (day === r.day.key && score > r.day.score))) r.day = { key: day, score };
  try { localStorage.setItem(`${app}:ranked`, JSON.stringify(r)); } catch { /* private mode */ }   // synced like any game's best
}
/** A ranked game's comparable best, and today's daily (null if not played today). */
export function comparableOf(app) {
  const r = json(`${app}:ranked`, null);
  return { best: r?.best ?? null, today: r?.day?.key === today() ? r.day.score : null };
}

// ---------- bests ----------
/** A game's best, from what it keeps: a number, a { score }, or its bests by level (the highest). A ranked game's is
 *  its comparable best only. */
export function bestOf(app) {
  if (RANKED.has(app)) return comparableOf(app).best;
  const v = json(`${app}:best`, null);
  const num = x => (typeof x === "number" ? x : typeof x?.score === "number" ? x.score : null);
  if (num(v) != null) return num(v);
  const xs = v && typeof v === "object" ? Object.values(v).map(num).filter(x => x != null) : [];
  return xs.length ? Math.max(...xs) : null;
}
/** Shares your bests with the duo room, under your name. */
export async function shareBests(apps) {
  const code = duoCode();
  if (!code) return;
  const sync = await getSync();
  const bests = Object.fromEntries(apps.map(a => [a, bestOf(a)]).filter(([, v]) => v != null));
  await sync.update(`crates/rooms/${code}/best/${playerId()}`, { name: raw.get("crates:name") || "", at: Date.now(), bests });
}
// ---------- duo records ----------
/**
 * A finished duo match, as this player saw it: duo/GAME/MATCH/PLAYER = { score, won, coop, lower, at }. Both players'
 * devices report the same match, each its own side, so a match counts once and both sides agree on who won.
 * coop: a team result (the same score on both sides); lower: a lower score is better (a time).
 */
export async function reportDuo(game, match, { score = null, won = null, coop = false, lower = false }) {
  const code = duoCode();
  if (!code || match == null) return;
  const sync = await getSync();
  await sync.update(`crates/rooms/${code}/duo/${game}/${enc(String(match))}`, { [playerId()]: { score, won, coop, lower, at: Date.now() } });
}
/**
 * Watches the pair's duo records: cb({ game: { n, coop, best, lower, mine, theirs } }). For a team game the best team
 * result; for a head-to-head one the wins on each side (a draw counts for neither).
 */
export async function watchDuoRecords(cb) {
  const code = duoCode();
  if (!code) return () => {};
  const sync = await getSync(), me = playerId();
  return sync.watch(`crates/rooms/${code}/duo`, all => {
    const out = {};
    for (const [game, matches] of Object.entries(all || {})) {
      const r = out[game] = { n: 0, coop: false, best: null, lower: false, wins: 0, mine: 0, theirs: 0 };
      for (const sides of Object.values(matches || {})) {
        const entries = Object.entries(sides || {});
        if (!entries.length) continue;
        r.n++;
        const any = entries[0][1];
        if (any.coop) {
          r.coop = true; r.lower ||= !!any.lower;           // a game's matches all score the same way
          if (entries.some(([, x]) => x.won)) r.wins++;
          for (const [, x] of entries) if (x.score != null && (r.best == null || (r.lower ? x.score < r.best : x.score > r.best))) r.best = x.score;
        } else {
          if (entries.some(([id, x]) => id === me && x.won)) r.mine++;
          if (entries.some(([id, x]) => id !== me && x.won)) r.theirs++;
        }
      }
    }
    cb(out);
  });
}
/** Watches your partner's bests: cb({ app: value }, name) on every change. */
export async function watchBests(cb) {
  const code = duoCode();
  if (!code) return () => {};
  const sync = await getSync(), me = playerId();
  return sync.watch(`crates/rooms/${code}/best`, best => {
    const theirs = Object.entries(best || {}).filter(([id]) => id !== me).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0]?.[1];
    cb(theirs?.bests || {}, theirs?.name || "");
  });
}

// ---------- the pair: presence, requests, the banner ----------
/** The games that can be played together (a duo match is the game opened in the pair's room). */
export const DUO_GAMES = { crates: "crates.html", slate: "slate.html", chart: "chart.html", delta: "delta.html", punt: "punt.html", quote: "quote.html", spot: "spot.html" };
const pageGame = () => (page() === "index" ? "" : page());   // "" at home (index): no game open
const ASK_FOR = 2 * 60 * 1000;                  // a request stands for two minutes
export const duoHref = game => `${DUO_GAMES[game]}?room=${duoCode()}`;
export const soloHref = () => { const u = new URL(location.href); u.searchParams.delete("room"); return u.pathname.split("/").pop() + u.search; };

/** Watches your partner: cb({ name, game, mode, online, at } | null) whenever it changes. Their freshest device counts. */
export async function watchPartner(cb) {
  const code = duoCode();
  if (!code) { cb(null); return () => {}; }
  const sync = await getSync(), me = playerId();
  return sync.watch(`crates/rooms/${code}/live`, live => {
    const devices = Object.entries(live || {}).filter(([id]) => id !== me).flatMap(([, ds]) => Object.values(ds || {}));
    devices.sort((a, b) => (b.online === true) - (a.online === true) || (b.at || 0) - (a.at || 0));
    cb(devices[0] || null);
  });
}
/** Asks your partner to play a game together; resolves "yes", "no" or "late". */
export async function ask(game) {
  const code = duoCode(), sync = await getSync(), me = playerId();
  const asked = { from: me, name: raw.get("crates:name") || "Your partner", game, at: Date.now(), answer: null };
  await sync.update(`crates/rooms/${code}`, { ask: asked });
  return new Promise(resolve => {
    const late = setTimeout(() => { stop?.(); resolve("late"); }, ASK_FOR);
    const stop = sync.watch(`crates/rooms/${code}/ask`, a => {
      if (!a || a.at !== asked.at || !a.answer) return;
      clearTimeout(late); setTimeout(() => stop?.(), 0); resolve(a.answer);
    });
  });
}
/** Says where you are: this page's game, solo or duo, online while the page is open. */
async function present() {
  const code = duoCode();
  if (!code) return;
  const sync = await getSync(), path = `crates/rooms/${code}/live/${playerId()}/${sync.uid}`;
  const say = () => sync.update(path, { name: raw.get("crates:name") || "", game: pageGame(), mode: WATCHING ? "watch" : roomInAddress() ? "duo" : "solo", at: Date.now() });
  await say();
  sync.presence(path);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") say(); });
}
/** A request from your partner shows as a banner wherever you are: Play takes you both into the duo match. */
async function listen() {
  const code = duoCode();
  if (!code) return;
  const sync = await getSync(), me = playerId();
  sync.watch(`crates/rooms/${code}/ask`, a => {
    document.querySelector(".pair-ask")?.remove();
    if (!a || a.from === me || a.answer || Date.now() - a.at > ASK_FOR || !DUO_GAMES[a.game]) return;
    const bar = document.createElement("div");
    bar.className = "pair-ask";
    bar.setAttribute("role", "alertdialog");
    const name = a.game === "crates" ? "Crates" : a.game[0].toUpperCase() + a.game.slice(1);
    bar.innerHTML = `<span><b></b> wants to play ${name} together</span><button class="btn primary" type="button" data-yes>Play</button><button class="btn" type="button" data-no>Not now</button>`;
    bar.querySelector("b").textContent = a.name || "Your partner";
    bar.querySelector("[data-yes]").addEventListener("click", async () => { await sync.update(`crates/rooms/${code}/ask`, { answer: "yes" }); location.href = duoHref(a.game); });
    bar.querySelector("[data-no]").addEventListener("click", () => { sync.update(`crates/rooms/${code}/ask`, { answer: "no" }); bar.remove(); });
    document.body.appendChild(bar);
  });
}

// ---------- watching your partner ----------
// While you play solo, the game you have open is mirrored to the pair's room: every key of its own (its run, its
// settings: "pipes:run"…), a moment after it changes (watch/PLAYER = { game, at, keys }). Your partner opens the same game
// with ?watch and sees yours: there, every read of that game's keys returns your copy and every write goes nowhere, so
// their own solo state is never touched; a veil keeps their taps off the board, and the page reloads when you move.
// So any game can be watched, without code of its own. Keys of the suite, Crates' run link and Firebase's stay out.
let mirrorTimer = null, watched = null;           // watched: inside a frame, the partner's copy { name, game, at, keys: Map }
/** The prefix of a game's keys in storage: the game's id, but Slate keeps its old name, Glyph. */
const storePrefix = game => (game === "slate" ? "glyph:" : `${game}:`);
// what never goes to a watcher: the suite's own keys, Crates' run link (watching must not join their run), Firebase's
const WATCH_SKIP = /^(suite:|crates:run|crates:updated|firebase:)/;
const MIRROR_MAX = 300000;                        // a key larger than this (a long history) isn't mirrored
async function mirror() {
  const code = duoCode();
  if (!code || WATCHING || !pageGame()) return;            // home has no game to show
  const prefix = storePrefix(pageGame()), keys = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k.startsWith(prefix) || WATCH_SKIP.test(k)) continue;
    const v = raw.get(k);
    if (v != null && v.length <= MIRROR_MAX) keys[enc(k)] = v;
  }
  try { await (await getSync()).update(`crates/rooms/${code}/watch`, { [playerId()]: { name: raw.get("crates:name") || "", game: pageGame(), at: Date.now(), keys } }); }
  catch (e) { console.error(e); }
}
/**
 * Watching, without reloads you can see. The watching page doesn't run the game itself: it holds it (this module never
 * finishes loading there) and shows the game in a frame, the same page with &frame, which reads your partner's copy
 * instead of yours. When they move, a new frame loads behind the one on show and takes its place once drawn, so the
 * view changes in place, at most every MIN_SWAP; the frames take no taps, and a bar says who you're watching, with Stop.
 */
const MIN_SWAP = 1200;
/** A frame of the watching view: it draws a copy and connects to nothing (no presence, no partner line, no bests). */
export const IN_FRAME = FRAME;
/** Inside a frame: every read of this game's keys returns the copy the watching page holds (the frame's parent). */
function readCopy() {
  const copy = window.parent !== window ? window.parent.__watchCopy : null;
  if (!copy) return;
  watched = copy;
  const prefix = storePrefix(pageGame());
  Storage.prototype.getItem = function (k) {
    if (this === localStorage && watched) { if (watched.keys.has(k)) return watched.keys.get(k); if (k.startsWith(prefix) || WATCH_SKIP.test(k)) return null; }
    return raw.getItem.call(this, k);
  };
}
/** The watching page: your partner's game in frames that swap in place as they move. Never returns (the game itself stays held). */
async function watchInFrames() {
  const code = duoCode();
  const shell = document.createElement("div");
  shell.className = "watch-shell";
  shell.innerHTML = `<div class="watch-frames"></div><div class="watch-bar"><span>Watching <b></b></span><button class="btn" type="button">Stop</button></div>`;
  shell.querySelector("button").addEventListener("click", () => { const u = new URL(location.href); u.searchParams.delete("watch"); location.href = u.toString(); });
  const place = () => document.body.appendChild(shell);
  if (document.body) place(); else document.addEventListener("DOMContentLoaded", place);
  const frames = shell.querySelector(".watch-frames"), who = shell.querySelector("b");
  if (!code) { who.textContent = "nobody: link with a partner first"; return new Promise(() => {}); }
  const sync = await getSync(), me = playerId();
  let shownAt = null, busy = false, pending = false, last = 0;
  const swap = () => {
    if (busy) { pending = true; return; }
    busy = true; pending = false;
    const wait = Math.max(0, last + MIN_SWAP - Date.now());
    setTimeout(() => {
      const f = document.createElement("iframe");
      f.className = "watch-frame next";
      f.title = "Your partner's game";
      const u = new URL(location.href); u.searchParams.set("frame", "1"); u.hash = "";
      f.src = u.toString();
      f.addEventListener("load", () => setTimeout(() => {    // drawn: it takes the old one's place
        for (const old of frames.querySelectorAll(".watch-frame:not(.next)")) old.remove();
        f.classList.remove("next");
        last = Date.now(); busy = false;
        if (pending) swap();
      }, 350));
      frames.appendChild(f);
    }, wait);
  };
  sync.watch(`crates/rooms/${code}/watch`, all => {
    const theirs = Object.entries(all || {}).filter(([id, w]) => id !== me && w?.game === pageGame()).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0];
    if (!theirs) { who.textContent = "your partner (not in this game now)"; return; }
    const [, w] = theirs;
    who.textContent = w.name || "your partner";
    if (w.at === shownAt) return;
    shownAt = w.at;
    window.__watchCopy = { name: w.name, game: w.game, at: w.at, keys: new Map(Object.entries(w.keys || {}).map(([k, v]) => [decodeURIComponent(k), v])) };
    swap();
  });
  return new Promise(() => {});                                // the game itself never starts on this page
}
/**
 * The link to this page that carries your codes: solo carries both (another of your devices opening it follows your
 * games and your partner), duo only the partner code (your partner opening it links with you).
 */
export function codesLink(kind) {
  const u = new URL(location.href);
  u.hash = "";
  for (const k of ["room", "watch", "solo", "duo"]) u.searchParams.delete(k);
  if (kind === "solo" && soloCode()) u.searchParams.set("solo", soloCode());
  if (duoCode()) u.searchParams.set("duo", duoCode());
  return u.toString();
}
export const watchHref = game => `${DUO_GAMES[game] || `${game}.html`}?watch=1`;

// a link with codes in it (?solo=, ?duo=): take them on, then go on without them in the address
{
  const q = new URLSearchParams(location.search), solo = cleanCode(q.get("solo")), duo = cleanCode(q.get("duo"));
  if (duo.length === 4 && duo !== duoCode()) link(duo);
  if (solo.length === 8 || duo.length === 4) {
    const u = new URL(location.href);
    u.searchParams.delete("solo"); u.searchParams.delete("duo");
    history.replaceState(null, "", u);
    if (solo.length === 8 && solo !== soloCode()) { await chooseSolo(solo); location.reload(); }
  }
}
// a page that opens catches up, and again when it comes back into view; a paired page says where it is and listens
{
  const old = raw.get("suite:duo");                       // the per-device duo memory before pairing became a link
  if (old && !raw.get(PAIR)) put(PAIR, old);
  if (old) raw.remove.call(localStorage, "suite:duo");
  if (duoCode() && !FRAME) { playerId(); present().catch(e => console.error(e)); if (!WATCHING) listen().catch(e => console.error(e)); }
  if (duoCode() && !WATCHING && !roomInAddress()) setTimeout(mirror, 800);   // your partner can watch from the moment you open a game
  if (syncing() && !WATCHING) {
    pull();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); else push(); });
  }
}
if (FRAME) readCopy();
else if (WATCHING) { try { await watchInFrames(); } catch (e) { console.error(e); } }
