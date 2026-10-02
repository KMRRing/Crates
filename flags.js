// Flags: questions a player disagrees with. A flag is kept on this device first, so flagging works offline,
// and sent to the database (crates/flags/GAME/ID) whenever there's a connection: straight away if online, else
// on the next load, when the connection comes back, or when the app returns to the screen. Everyone's flags
// can be read back and copied as text, to hand over for review.
import { getSync } from "./net.js";

const STORE = "crates:flags";
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function load() { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } }
function save(list) { try { localStorage.setItem(STORE, JSON.stringify(list.slice(-500))); } catch { /* private mode */ } }

/** This device's flags for a game, newest last: { id, game, at, sent, ...what was flagged }. */
export const localFlags = game => load().filter(f => f.game === game);
/** Whether this device has already flagged something with this key. */
export const flagged = (game, key) => load().some(f => f.game === game && f.key === key);

/** Keeps a flag on the device and tries to send it. */
export function fileFlag(game, flag) {
  const list = load();
  list.push({ ...flag, id: newId(), game, at: Date.now(), sent: false });
  save(list);
  sendFlags();
}

let sending = null;
/** Sends whatever hasn't been sent yet; quietly waits for a better moment if it can't. */
export function sendFlags() {
  if (sending || !navigator.onLine || !load().some(f => !f.sent)) return sending;
  sending = (async () => {
    try {
      const sync = await getSync();
      for (const f of load().filter(x => !x.sent)) {
        const { sent, ...data } = f;
        await sync.update(`crates/flags/${f.game}`, { [f.id]: { ...data, by: sync.uid } });
        save(load().map(x => (x.id === f.id ? { ...x, sent: true } : x)));
      }
    } catch { /* offline, or the database refused: they stay queued for next time */ }
    finally { sending = null; }
  })();
  return sending;
}

/** Everyone's flags for a game, from the database (needs a connection). */
export async function allFlags(game) {
  const sync = await getSync();
  const value = await new Promise((resolve, reject) => {
    let stop = null;
    stop = sync.watch(`crates/flags/${game}`, v => { resolve(v); queueMicrotask(() => stop?.()); }, reject);
  });
  return Object.values(value || {}).sort((a, b) => a.at - b.at);
}

/** Flags as plain text, one per paragraph, with everything needed to find and judge the bank entry. */
export function flagsAsText(game, flags) {
  const day = t => new Date(t).toISOString().slice(0, 10);
  return [`${game} flags (${flags.length}), copied ${day(Date.now())}`, ...flags.map((f, i) => {
    const options = (f.options || []).map(o => `${o.label}${o.right ? " (marked right)" : ""}`).join(", ");
    return `${i + 1}. ${f.ask} ${f.prompt}?\n   Options: ${options}${f.picked?.length ? `\n   They picked: ${f.picked.join(", ")}` : ""}` +
      `\n   Why: ${f.reason}${f.note ? `: ${f.note}` : ""}\n   (${[f.level, day(f.at)].filter(Boolean).join(", ")})`;
  })].join("\n\n");
}

// try again whenever a connection might be back
window.addEventListener("online", () => sendFlags());
document.addEventListener("visibilitychange", () => { if (!document.hidden) sendFlags(); });
