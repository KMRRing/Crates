// Which board Chess and its puzzle rush draw: the flat one (always there) or the 3D one (gambit-3d.js); with no choice of the
// player's, the suite's default (mode3d.js), and a choice is written only when made. The choice is
// the device's own (a `suite:` key stays off the other devices; a phone that can do 3D says nothing of a laptop that can't), and a
// partner's watching frame never reads or writes it: it draws flat.
import { choice } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { wants3D, onDefaultChange } from "./mode3d.js";

const KEY = "suite:gambit-view";

export const getView = () => {
  if (IN_FRAME) return "board";
  let kept = null;
  try { kept = localStorage.getItem(KEY); } catch { /* private mode */ }
  return wants3D(kept, "3d") ? "3d" : "board";
};
export const setView = view => {
  if (IN_FRAME) return;
  try { localStorage.setItem(KEY, view === "3d" ? "3d" : "board"); } catch { /* private mode */ }
};

/** The menu's View choice: `onChange("board" | "3d")` has the board redrawn; the choice is kept. */
export const viewChoice = onChange => {
  redraw = onChange;
  return choice("View", [["board", "Board"], ["3d", "3D"]], getView(), v => { setView(v); onChange(v); });
};
let redraw = null;                                                  // the menu's redraw, once the menu has been built
if (!IN_FRAME) onDefaultChange(() => { let kept = null; try { kept = localStorage.getItem(KEY); } catch { /* private mode */ } if (!kept) redraw?.(getView()); });
