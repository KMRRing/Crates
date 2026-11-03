// Which table a card game draws, for Menu, View: its flat table (always there, and the default) or the 3D one (table3d.js).
// The choice is the device's own (a `suite:` key stays off the other devices: a phone that can do 3D says nothing of a laptop
// that can't), and a partner's watching frame never reads or writes it: it draws the flat table. A game asks once,
//   const view = tableView("holdem");           // or tableView("tribute", ["cloth", "Cloth"]) for a flat view named otherwise
// reads `view.get()` ("table" or "3d") whenever it draws, and puts `view.choice(redraw)` in its menu's settings part.
import { choice } from "./menu.js";
import { IN_FRAME } from "./suite.js";

export function tableView(game, flat = ["table", "Table"]) {
  const key = `suite:${game}-view`;
  const get = () => {
    if (IN_FRAME) return flat[0];
    try { return localStorage.getItem(key) === "3d" ? "3d" : flat[0]; } catch { return flat[0]; }
  };
  const set = v => {
    if (IN_FRAME) return;
    try { if (v === "3d") localStorage.setItem(key, "3d"); else localStorage.removeItem(key); } catch { /* private mode */ }
  };
  return { get, set, choice: onChange => choice("View", [flat, ["3d", "3D"]], get(), v => { set(v); onChange(v); }) };
}
