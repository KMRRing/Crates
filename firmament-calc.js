// The numbers Firmament's questions ask for, each worked out here from the figures a lesson states (never typed in as an answer).
// tests/firmament.mjs recomputes every one of them from formulas of its own, so a slip in either shows.
export const SYNODIC = 29.530588861;           // days, new Moon to new Moon
export const TROPICAL = 365.2422;            // days, the year of the seasons
export const SIDEREAL = 365.256363;          // days, one turn round the stars
export const AU_KM = 149597870.7;            // IAU 2012
export const MOON_KM = 384400;               // mean distance
export const EARTH_MERIDIAN_KM = 40008;      // pole to pole round
export const C_KMS = 299792.458;
const RAD = Math.PI / 180;

// ---------- chapter 1 ----------
export const lunarYear = () => 12 * SYNODIC;
export const lunarShort = () => TROPICAL - lunarYear();
export const leapMonths = () => 235 - 19 * 12;
export const metonicGapHours = () => Math.abs(235 * SYNODIC - 19 * TROPICAL) * 24;
export const saros = () => 223 * SYNODIC;
export const babylonMonth = () => 29 + 31 / 60 + 50 / 3600 + 8 / 216000 + 20 / 12960000;   // 29;31,50,8,20 in base 60
export const babylonMonthSecondsOff = () => Math.abs(babylonMonth() - SYNODIC) * 86400;
export const sothicYears = () => 365 / 0.25;
export const lcm = (a, b) => { let x = a, y = b; while (y) [x, y] = [y, x % y]; return a / x * b; };
export const mayaRound = () => lcm(260, 365);
export const mayaRoundYears = () => mayaRound() / 365;
export const mayaEclipseTable = () => 405 * SYNODIC;
export const venusFive = () => 5 * 583.92;
export const venusEightYears = () => 8 * 365;

// ---------- chapter 2 ----------
export const eratosthenesStadia = () => 5000 * (360 / 7.2);
export const eratosthenesKm = (stadionM = 157.5) => eratosthenesStadia() * stadionM / 1000;
export const eratosthenesErr = (stadionM = 157.5) => (eratosthenesKm(stadionM) / EARTH_MERIDIAN_KM - 1) * 100;
export const aristarchusRatio = (deg = 87) => 1 / Math.cos(deg * RAD);
export const sunMoonRatio = () => AU_KM / MOON_KM;
export const precessionYears = (arcsecPerYear = 50.29) => 360 * 3600 / arcsecPerYear;
export const hipparchusCircle = () => 360 / 1 * 100;      // 1 degree a century
export const pogson = () => Math.pow(100, 1 / 5);
export const eudoxusSpheres = () => 1 + 3 + 3 + 5 * 4;

// ---------- chapter 3 ----------
export const aryabhataPi = () => 62832 / 20000;
export const dipRadius = (hKm, dipArcmin) => { const c = Math.cos(dipArcmin / 60 * RAD); return hKm * c / (1 - c); };
export const tusiPoint = (R, r, tDeg) => { const t = tDeg * RAD, k = (R - r) / r; return [(R - r) * Math.cos(t) + r * Math.cos(k * t), (R - r) * Math.sin(t) - r * Math.sin(k * t)]; };
export const ulughBegErrSeconds = () => Math.abs((6 * 3600 + 10 * 60 + 8) - (SIDEREAL - 365) * 86400);
export const gregorianYear = () => 365 + 97 / 400;
export const julianDrift = (from = 325, to = 1582) => (to - from) * (365.25 - TROPICAL);
