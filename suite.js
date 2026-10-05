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
const PAIR = "pair:code", ME = "pair:me";       // the pair's room and your player id: synced, so all your devices share them
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PUSH_DELAY = 1500;
// what stays on this device: the suite's bookkeeping, Crates' run (synced by run.js), Firebase's own sign-in
const LOCAL = /^(suite:|crates:run|crates:updated|crates:v2|firebase:)/;
// the store sits beside Crates' run under crates/runs (where 8-letter codes may write), at the code moved on seven letters
const storePath = code => `crates/runs/${[...code].map(ch => LETTERS[(LETTERS.indexOf(ch) + 7) % LETTERS.length]).join("")}`;
const enc = k => encodeURIComponent(k).replace(/\./g, "%2E");     // a database key can't hold . # $ [ ] /
const raw = { get: k => Storage.prototype.getItem.call(localStorage, k), set: Storage.prototype.setItem, remove: Storage.prototype.removeItem };
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
const own = k => k.startsWith("pile:") || k.startsWith(`${page() === "index" ? "crates" : page()}:`);

let meta = json(META, {}), dirty = new Map(), timer = null;
const syncing = () => !!soloCode();

/** Starts a solo code on this device: everything here goes up, as of now. */
export function startSolo() {
  const code = newCode();
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
/** Crates' run follows the same code through run.js; rev 0 means whatever the code holds is newer. */
function linkCrates(code) { put("crates:run", { code, rev: 0, dirty: true }); }
/** Links you to a partner by their code, or (none given) makes a new code to give them. Synced to your other devices. */
export function link(code) { code = code || newPair(); localStorage.setItem(PAIR, code); return code; }
export function unlink() { localStorage.removeItem(PAIR); }

// every write to this device's storage is noted with its time, and goes up a moment later
function touched(k, v) {
  if (!syncing() || LOCAL.test(k)) return;
  meta[k] = Date.now();
  put(META, meta);
  dirty.set(k, { v, t: meta[k] });
  clearTimeout(timer);
  timer = setTimeout(push, PUSH_DELAY);
}
Storage.prototype.setItem = function (k, v) { raw.set.call(this, k, v); if (this === localStorage) touched(k, String(v)); };
Storage.prototype.removeItem = function (k) { raw.remove.call(this, k); if (this === localStorage) touched(k, null); };

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

// ---------- bests ----------
/** A game's best, from what it keeps: a number, a { score }, or its bests by level (the highest). */
export function bestOf(app) {
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
export const DUO_GAMES = { crates: "index.html", slate: "slate.html", chart: "chart.html", delta: "delta.html", punt: "punt.html", quote: "quote.html", spot: "spot.html" };
const pageGame = () => (page() === "index" ? "crates" : page());
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
  const say = () => sync.update(path, { name: raw.get("crates:name") || "", game: pageGame(), mode: roomInAddress() ? "duo" : "solo", at: Date.now() });
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

// a page that opens catches up, and again when it comes back into view; a paired page says where it is and listens
{
  const old = raw.get("suite:duo");                       // the per-device duo memory before pairing became a link
  if (old && !raw.get(PAIR)) put(PAIR, old);
  if (old) raw.remove.call(localStorage, "suite:duo");
  if (duoCode()) { playerId(); present().catch(e => console.error(e)); listen().catch(e => console.error(e)); }
  if (syncing()) {
    pull();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); else push(); });
  }
}
