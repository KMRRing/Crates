// Which board Chess and its puzzle rush draw: the flat one (always there, and the default) or the 3D one (gambit-3d.js). The choice is
// the device's own (a `suite:` key stays off the other devices; a phone that can do 3D says nothing of a laptop that can't), and a
// partner's watching frame never reads or writes it: it draws flat.
import { choice } from "./menu.js";
import { IN_FRAME } from "./suite.js";

const KEY = "suite:gambit-view";

export const getView = () => {
  if (IN_FRAME) return "board";
  try { return localStorage.getItem(KEY) === "3d" ? "3d" : "board"; } catch { return "board"; }
};
export const setView = view => {
  if (IN_FRAME) return;
  try { if (view === "3d") localStorage.setItem(KEY, "3d"); else localStorage.removeItem(KEY); } catch { /* private mode */ }
};

/** The menu's View choice: `onChange("board" | "3d")` has the board redrawn; the choice is kept. */
export const viewChoice = onChange => choice("View", [["board", "Board"], ["3d", "3D"]], getView(), v => { setView(v); onChange(v); });
