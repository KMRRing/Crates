// Coup alone on one phone (README, Coup): you against one to four computer players, on the same engine Party's table runs
// (party-coup.js), so the rules can't differ. The phone does what the host's phone does at a table: it holds the state,
// asks the computer players (party-coup-bot.js) when it is their turn to answer, and calls the game's `advance` when the
// step has all its answers. The first half of this file is that loop as plain functions (tests/party-coup-solo.mjs plays
// it in Node, with a computer in the human's seat too); the second half draws it on Party's page, with the table drawn by
// the game's own `view`, kept on the phone as `party:coup` so a reload or a locked screen comes back to the same hand.
import { h, button, pickPlayer } from "./party-kit.js";
import coup, { alive } from "./party-coup.js";
import { coupBot, waiting } from "./party-coup-bot.js";

export const YOU = "you";
export const FOES = ["Quill", "Sable", "Pip", "Wren"];                  // their seats are bot1…bot4, their tempers by seat

/** Who sits at a table of you and n computer players. */
export const seatsOf = (n, name = "Player") => [{ uid: YOU, name, seat: 0 }, ...FOES.slice(0, n).map((f, i) => ({ uid: `bot${i + 1}`, name: f, seat: i + 1 }))];
const clampFoes = n => Math.max(1, Math.min(FOES.length, Number(n) | 0 || 3));

/** A new game: `foes` computer players, no clock (nobody is waiting on you), the inputs for the step in play empty. */
export function deal(foes, rng, now = Date.now(), name = "Player") {
  const n = clampFoes(foes);
  return { foes: n, state: coup.start({ players: seatsOf(n, name), options: { clock: "0" }, rng, now }), inputs: {}, seq: 1 };
}

/** The game moved on if its step has all its answers, else null. */
export function move(g, rng, now = Date.now()) {
  const r = coup.advance(g.state, { players: seatsOf(g.foes, g.state.names?.[YOU]), inputs: g.inputs, now, rng });
  return r ? { ...g, state: r.state, inputs: {}, seq: g.seq + 1 } : null;
}

/** The computer players still to answer the step in play. */
export const pending = g => waiting(g.state).filter(u => u !== YOU && !g.inputs[u]);

/** An answer that is always allowed, for a computer player whose own answer wasn't (it always is: the tests check). */
export function safe(s, u) {
  const mine = s.hand?.[u] || [];
  if (s.phase === "turn") {
    const others = alive(s).filter(v => v !== u);
    return s.coins[u] >= 10 ? { do: "coup", target: others[0] } : { do: "income" };
  }
  if (s.phase === "challenge") return { c: "allow" };
  if (s.phase === "block") return { b: "allow" };
  if (s.phase === "lose") return { lose: 0 };
  return { keep: mine.map((_, i) => i) };                                // exchange: what it holds
}

/**
 * Every computer player still to answer answers (a challenge or block window is answered by all at once, as at a table).
 * In a step with one answer, one the game wouldn't take is swapped for the safe one.
 */
export function botsAnswer(g, rng, now = Date.now()) {
  let next = g;
  for (const u of pending(g)) {
    const answer = coupBot(g.state, u, rng);
    next = { ...next, inputs: { ...next.inputs, [u]: answer } };
    if (["turn", "lose", "exchange"].includes(g.state.phase) && !move(next, rng, now)) next = { ...next, inputs: { ...next.inputs, [u]: safe(g.state, u) } };
  }
  return next;
}

// ---------- on Party's page ----------
const KEY = "party:coup";
const kept = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); return d && typeof d === "object" ? d : {}; } catch { return {}; } };
const keep = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode */ } };
/** A game worth carrying on: this module's own shape, with you at the table. */
const usable = g => !!g && Number.isInteger(g.foes) && g.foes >= 1 && g.foes <= FOES.length && !!g.state && g.state.seats?.includes(YOU)
  && g.state.seats.length === g.foes + 1 && typeof g.state.phase === "string" && !!g.inputs && typeof g.inputs === "object";
const nameOf = () => { try { return (localStorage.getItem("crates:name") || "").trim().slice(0, 16) || "Player"; } catch { return "Player"; } };

// the pause (menu, rules, games screen open): the page listens once, whichever game of this module is on
let current = null, wired = null;
function wire() {
  wired ||= import("./menu.js").then(m => m.onPause(() => current?.pause(), () => current?.resume()));
  return wired;
}

/** On one phone, on Party's stage; back() returns to Party's games. */
export function play(stage, { back }) {
  const root = h("div", { class: "cp-solo fit-col" });
  stage.replaceChildren(root);                                          // one child: Party marks it, and draws again only if it's gone
  const saved = kept();
  let foes = clampFoes(saved.foes), g = usable(saved.g) ? saved.g : null;
  let timer = 0, paused = false, ready = false, watching = false, sure = 0;
  const gone = () => !root.isConnected;
  const save = () => keep({ foes, ...(g ? { g } : {}) });
  const rng = Math.random;

  const control = {
    pause() { paused = true; clearTimeout(timer); },
    resume() { paused = false; pump(); },
  };
  current = control;
  Promise.all([wire(), import("./suite.js")]).then(([, s]) => { watching = !!s.IN_FRAME; ready = true; pump(); }).catch(() => { ready = true; pump(); });

  function begin(n = foes) {
    foes = clampFoes(n);
    g = deal(foes, rng, Date.now(), nameOf());
    save();
    pump();
  }

  /** Moves the game on if it can, draws it, and gives the computer players their turn to answer a little later. */
  function pump() {
    clearTimeout(timer);
    if (gone()) { if (current === control) current = null; return; }
    if (g && ready && !watching) {
      const m = move(g, rng, Date.now());
      if (m) { g = m; save(); }
    }
    show();
    if (!g || !ready || watching || paused || g.state.phase === "over" || !pending(g).length) return;
    const out = !alive(g.state).includes(YOU);                          // out yourself: the rest play on quickly
    timer = setTimeout(() => { if (gone() || paused) return; g = botsAnswer(g, rng, Date.now()); save(); pump(); }, out ? 250 + rng() * 250 : 650 + rng() * 650);
  }

  function show() {
    if (!g) return setup();
    const players = seatsOf(g.foes, g.state.names?.[YOU]), me = players[0];
    const area = h("div", { class: "pa-play fit-grow fit-scroll", "data-game": "coup" });
    const ctx = {
      state: g.state, me, players, inputs: g.inputs, seq: g.seq, now: () => Date.now(),
      send: value => { if (!g || g.state.phase === "over" || watching) return; g = { ...g, inputs: { ...g.inputs, [YOU]: value } }; save(); pump(); },
    };
    try { coup.view(area, ctx); } catch (e) { console.error(e); area.replaceChildren(h("p", { class: "pa-wait" }, "Something went wrong drawing this step; it's still saved.")); }
    root.replaceChildren(area, foot());
  }

  function foot() {
    const over = g.state.phase === "over";
    if (over) return h("div", { class: "cp-solo-foot three" },
      button("Again", () => begin(), {}), button("Opponents", () => { g = null; save(); pump(); }, { primary: false }), button("Back", back, { primary: false }));
    const again = button(sure ? "Sure?" : "New game", () => {
      if (!sure) { sure = setTimeout(() => { sure = 0; if (!gone()) show(); }, 3000); show(); return; }
      clearTimeout(sure); sure = 0; begin();
    }, { primary: false });
    return h("div", { class: "cp-solo-foot" }, again, button("Back", back, { primary: false }));
  }

  function setup() {
    const pick = pickPlayer([1, 2, 3, 4].map(n => ({ uid: String(n), name: n === 1 ? "1 opponent" : `${n} opponents` })),
      { picked: String(foes), label: "Opponents", onPick: u => { foes = clampFoes(u); save(); show(); } });
    root.replaceChildren(h("div", { class: "pa-home fit-col fit-grow" },
      h("p", { class: "pa-intro" }, "Coup against the computer: Quill, Sable, Pip and Wren each play in their own way, one bluffing freely, another seldom. Choose how many sit down with you."),
      pick,
      h("div", { class: "fit-grow" }),
      button("Deal", () => begin()),
      button("Invite friends instead", () => { location.href = "party.html?game=coup&invite=1"; }, { primary: false }),
      button("Back", back, { primary: false })));
  }

  pump();
}
