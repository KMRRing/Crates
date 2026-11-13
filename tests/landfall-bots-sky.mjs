// The level gate for chapters 13 to 15: stars through cloud, birds, Kelvin's machine (tests/landfall-gate.js has the gate).
import { gate } from "./landfall-gate.js";
const bad = gate([13, 14, 15], "cloud, birds and Kelvin's machine");
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-bots-sky: stars through cloud, the birds and Kelvin's machine are winnable by care, and each matters");
