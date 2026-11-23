// Pewter alone on one phone (README, Pewter): you against one to five computer players, on the same engine Party's table
// runs (party-pewter.js), so the rules can't differ. The phone does what the host's phone does at a table: it holds the
// state and calls the game's `advance`, which asks the computer players itself (party-pewter-bot.js) once their moment
// (`botAt`) has come. The first half of this file is that loop as plain functions (tests/party-pewter-solo.mjs plays it
// in Node); the second half draws it on Party's page with the game's own `view`, kept on the phone as `pewter:solo` so a
// reload or a locked screen comes back to the same hand.
import { h, button, pickPlayer } from "./party-kit.js";
import pewter, { alive } from "./party-pewter.js";
import { PERSONAS } from "./party-pewter-bot.js";
import { ramp } from "./ramp.js";

export const YOU = "you";
export const MOST = PERSONAS.length;                                   // their seats are bot1…bot5, named and tempered by seat
export const LEVELS = [["1", "Easy"], ["2", "Medium"], ["3", "Hard"]];

const clampFoes = n => Math.max(1, Math.min(MOST, Number(n) | 0 || 3));
const clampLevel = l => ([1, 2, 3].includes(Number(l)) ? Number(l) : 2);
const people = name => [{ uid: YOU, name }];

/** A new game: `foes` computer players of one level, no clock (nobody is waiting on you), the inputs for the step empty. */
export function deal(foes, level, rng, now = Date.now(), name = "Player") {
  const n = clampFoes(foes), l = clampLevel(level);
  return { foes: n, level: l, state: pewter.start({ players: people(name), options: { fill: String(n + 1), level: String(l), clock: "0" }, rng, now }), inputs: {}, seq: 1 };
}

/** The moment to give the game: now, or, when you are out and only computer players are left, the moment the next of
 *  them is due, so the rest of the game goes by quickly. */
export const clockOf = (g, now = Date.now()) => (alive(g.state).includes(YOU) ? now : Math.max(now, g.state.botAt ?? 0));

/** The game moved on if the step in play has what it waits for (your answer, or a computer player's moment), else null. */
export function move(g, rng, now = Date.now()) {
  const r = pewter.advance(g.state, { players: people(g.state.names?.[YOU] || "Player"), inputs: g.inputs, now: clockOf(g, now), rng });
  return r ? { ...g, state: r.state, inputs: {}, seq: g.seq + 1 } : null;
}

/** When the game wants to be moved again by itself: the computer player's moment, in milliseconds from `now`; null if it
 *  is waiting for you (or is over). A moment far off is a clock that was changed: wait a little instead. */
export function wait(g, now = Date.now()) {
  const at = pewter.wakeAt(g.state);
  if (at == null || g.state.phase === "over") return null;
  if (!alive(g.state).includes(YOU)) return 250;
  return Math.max(0, Math.min(at - now, 3000));
}

// ---------- on Party's page ----------
const KEY = "pewter:solo";
const kept = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); return d && typeof d === "object" ? d : {}; } catch { return {}; } };
const keep = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode */ } };
/** A game worth carrying on: this module's own shape, with you at the table. */
const usable = g => !!g && Number.isInteger(g.foes) && g.foes >= 1 && g.foes <= MOST && !!g.state && g.state.seats?.includes(YOU)
  && g.state.seats.length === g.foes + 1 && typeof g.state.phase === "string" && !!g.inputs && typeof g.inputs === "object";
const nameOf = () => { try { return (localStorage.getItem("crates:name") || "").trim().slice(0, 16) || "Player"; } catch { return "Player"; } };

// the pause (menu, rules, games screen open): the page listens once, whichever game of this module is on
let current = null, wired = null;
function wire() {
  wired ||= import("./menu.js").then(m => m.onPause(() => current?.pause(), () => current?.resume()));
  return wired;
}

// The computer players' level is the shared row in Party's menu while this game is on (Korbi, 8 Nov 2026: no picker of a
// game's own; it was Simple / Medium / Hard on the page); Auto climbs after a game won and falls after one lost. The level
// the page kept before is where the ramp starts.
const levelOf = start => Number(ramp("pewter", LEVELS.map(([k]) => k), { start: String(start) }));

/** On one phone, on Party's stage; back() returns to Party's games. */
export function play(stage, { back: leave }) {
  const back = () => { ramp.forget(); leave(); };
  const root = h("div", { class: "pw-solo fit-col" });
  stage.replaceChildren(root);                                          // one child: Party marks it, and draws again only if it's gone
  const saved = kept();
  let foes = clampFoes(saved.foes), g = usable(saved.g) ? saved.g : null;
  const firstLevel = clampLevel(saved.level), levelNow = () => levelOf(firstLevel);
  levelNow();
  let timer = 0, paused = false, ready = false, watching = false, sure = 0;
  const gone = () => !root.isConnected;
  const save = () => keep({ foes, level: firstLevel, ...(g ? { g } : {}) });
  const rng = Math.random;

  const control = {
    pause() { paused = true; clearTimeout(timer); },
    resume() {
      // the moments of a game that stood still move on by as long as it stood, or the first computer player would answer at once
      if (g && g.state.botAt) g = { ...g, state: { ...g.state, botAt: Date.now() + 700 + rng() * 500 } };
      paused = false; pump();
    },
  };
  current = control;
  Promise.all([wire(), import("./suite.js")]).then(([, s]) => { watching = !!s.IN_FRAME; ready = true; pump(); }).catch(() => { ready = true; pump(); });

  function begin() {
    g = deal(foes, levelNow(), rng, Date.now(), nameOf());
    save();
    pump();
  }

  /** Moves the game on if it can, draws it, and wakes it for the next computer player's moment. */
  function pump() {
    clearTimeout(timer);
    if (gone()) { if (current === control) current = null; return; }
    if (g && ready && !watching) {
      const m = move(g, rng, Date.now());
      if (m) {
        g = m;
        if (g.state.phase === "over" && !g.counted) { g = { ...g, counted: true }; levelNow(); g.state.won === YOU ? ramp.won(true) : ramp.lost(); }
        save();
      }
    }
    show();
    if (!g || !ready || watching || paused) return;
    const ms = wait(g);
    if (ms != null) timer = setTimeout(() => { if (!gone() && !paused) pump(); }, ms + 20);
  }

  function show() {
    if (!g) return setup();
    const players = [{ uid: YOU, name: g.state.names?.[YOU] || "Player" }], me = players[0];
    const area = h("div", { class: "pa-play fit-grow fit-scroll", "data-game": "pewter" });
    const ctx = {
      state: g.state, me, players, inputs: g.inputs, seq: g.seq, now: () => Date.now(),
      send: value => { if (!g || g.state.phase === "over" || watching) return; g = { ...g, inputs: { ...g.inputs, [YOU]: value } }; save(); pump(); },
    };
    try { pewter.view(area, ctx); } catch (e) { console.error(e); area.replaceChildren(h("p", { class: "pa-wait" }, "Something went wrong drawing this step; it's still saved.")); }
    root.replaceChildren(area, foot());
  }

  function foot() {
    if (g.state.phase === "over") return h("div", { class: "pw-solo-foot three" },
      button("Again", () => begin(), {}), button("Opponents", () => { g = null; save(); pump(); }, { primary: false }), button("Back", back, { primary: false }));
    const again = button(sure ? "Sure?" : "New game", () => {
      if (!sure) { sure = setTimeout(() => { sure = 0; if (!gone()) show(); }, 3000); show(); return; }
      clearTimeout(sure); sure = 0; begin();
    }, { primary: false });
    return h("div", { class: "pw-solo-foot" }, again, button("Back", back, { primary: false }));
  }

  function setup() {
    const foesPick = pickPlayer([1, 2, 3, 4, 5].map(n => ({ uid: String(n), name: String(n) })),
      { picked: String(foes), label: "Opponents", onPick: u => { foes = clampFoes(u); save(); show(); } });
    foesPick.classList.add("five");
    root.replaceChildren(h("div", { class: "pa-home fit-col fit-grow" },
      h("p", { class: "pa-intro" }, "Counterfeit against the computer: Quant, Gambler, Hedger, Sceptic and Wildcat each bid in their own way. Choose how many sit down with you."),
      h("p", { class: "pw-solo-label" }, foes === 1 ? "1 opponent" : `${foes} opponents`),
      foesPick,
      h("div", { class: "fit-grow" }),
      button("Deal", () => begin()),
      button("Invite friends instead", () => { location.href = "party.html?game=pewter&invite=1"; }, { primary: false }),
      button("Back", back, { primary: false })));
  }

  pump();
}
