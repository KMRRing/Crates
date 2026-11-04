// The suite's 2D / 3D default (Korbi, 4 November 2026: a main-menu setting "2D mode (battery saver)" sets the default for
// every game; a choice made inside one game is still remembered for that game). Settings key: `settings:flat`.
// A game keeps its own view choice under its own `<game>:` key and writes it ONLY when the player picks one; with none stored it
// asks defaultIs3D() for the default. Never write the default into the game's key, or the setting stops reaching it.
const KEY = "settings:flat";
export const flatMode = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
export const setFlatMode = on => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ } dispatchEvent(new Event("settings:flat")); };
export const defaultIs3D = () => !flatMode();
