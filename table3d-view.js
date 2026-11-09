// Which table a card game draws, for Menu, View: its flat table (always there) or the 3D one (table3d.js). With no choice
// of the player's the default is the suite's (mode3d.js: 3D, or flat under Settings' 2D mode); a choice is written only when
// the player makes it, "3d" or "flat".
// The choice is the device's own (a `suite:` key stays off the other devices: a phone that can do 3D says nothing of a laptop
// that can't), and a partner's watching frame never reads or writes it: it draws the flat table. A game asks once,
//   const view = tableView("tribute");           // or tableView("tribute", ["cloth", "Cloth"]) for a flat view named otherwise
// (a third argument names the 3D choice, for a game whose menu says Flat or Table: tableView("contract", ["flat", "Flat"], "Table"))
// reads `view.get()` ("table" or "3d") whenever it draws, and puts `view.choice(redraw)` in its menu's settings part.
import { choice } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { wants3D, onDefaultChange } from "./mode3d.js";

export function tableView(game, flat = ["table", "Table"], label3d = "3D") {
  const key = `suite:${game}-view`;
  const kept = () => { try { return localStorage.getItem(key); } catch { return null; } };
  let failed = false;                                              // 3D did not start or was lost: flat for this visit, and nothing written (a failure is not a choice)
  const get = () => (IN_FRAME || failed ? flat[0] : wants3D(kept(), "3d") ? "3d" : flat[0]);
  const set = v => {
    if (IN_FRAME) return;
    try { localStorage.setItem(key, v === "3d" ? "3d" : "flat"); } catch { /* private mode */ }
  };
  let redraw = null;                                               // the menu's redraw, once the menu has been built
  if (!IN_FRAME) onDefaultChange(() => { if (!kept()) redraw?.(get()); });   // Settings' 2D mode, live (no choice of the player's to keep)
  return { get, set, fail: () => { failed = true; }, choice: onChange => { redraw = onChange; return choice("View", [flat, ["3d", label3d]], get(), v => { set(v); onChange(v); }); } };
}
