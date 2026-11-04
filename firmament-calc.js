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

// ---------- chapters 4 to 12 ----------
export const G = 6.6743e-11, GM_SUN = 1.32712440018e20, GM_EARTH = 3.986004418e14, R_EARTH = 6.371e6, R_SUN = 6.957e8, L_SUN = 3.828e26, M_SUN = GM_SUN / G;
const ARCSEC = 206264.806;
export const elongationRadius = deg => Math.sin(deg * RAD);
export const synodic = (a, b) => 1 / (1 / a - 1 / b);
export const keplerPeriod = a => Math.pow(a, 1.5);
export const transitGap = () => Math.abs(8 * TROPICAL - 13 * 224.701);
export const jupiterMass27 = (aKm = 421700, tDays = 1.769138) => 4 * Math.PI ** 2 * (aKm * 1e3) ** 3 / (G * (tDays * 86400) ** 2) / 1e27;
export const romerC = () => 2 * AU_KM / (22 * 60) / 1000;
export const moonAccel3 = () => 4 * Math.PI ** 2 * MOON_KM * 1e3 / (27.321661 * 86400) ** 2 * 1e3;
export const orbitSpeed = () => Math.sqrt(GM_EARTH / R_EARTH) / 1000;
export const earthMass24 = () => 9.80665 * R_EARTH ** 2 / G / 1e24;
export const lalandeAu = () => 6378.137 / (8.6 / ARCSEC) / 1e6;
export const bradleyLy = (p = 0.314) => 3.26156 / p;
export const aberration = () => 29.78 / C_KMS * ARCSEC;
export const titiusError = () => (0.4 + 0.3 * 2 ** 7) / 30.07 * 100 - 100;
export const wienNm = t => 2.897771955e-3 / t * 1e9;
export const dopplerKms = (shiftNm = 0.1, restNm = 656.28) => C_KMS * shiftNm / restNm;
export const sbRatio = () => 2 ** 4;
export const sunMassLoss = () => L_SUN / (C_KMS * 1e3) ** 2 / 1e9;
export const kelvinMyr = () => G * M_SUN ** 2 / R_SUN / L_SUN / 3.15576e7 / 1e6;
export const mercuryArcsec = () => { const a = 5.7909e10, e = 0.20563, orbits = 36525 / 87.969; return 6 * Math.PI * GM_SUN / ((C_KMS * 1e3) ** 2 * a * (1 - e * e)) * orbits * ARCSEC; };
export const lightBend = (k = 4) => k * GM_SUN / ((C_KMS * 1e3) ** 2 * R_SUN) * ARCSEC;
export const schwarzschildKm = () => 2 * GM_SUN / (C_KMS * 1e3) ** 2 / 1000;
export const cepheidFactor = () => Math.sqrt(10);
export const hubbleTime = h => 977.792 / h;
export const recedeMpc = (v, h) => v / h;
export const cmbPeakMm = () => wienNm(2.725) / 1e6;
export const heliumFraction = () => 2 * (1 / 7) / (1 + 1 / 7);
export const keplerFall = () => 1 / Math.sqrt(4);
export const tensionSigma = () => (73.0 - 67.4) / Math.hypot(1.0, 0.5);
export const wobbleMs = (massRatio, orbitKms) => massRatio * orbitKms * 1000;
export const transitPct = rKm => (rKm / 695700) ** 2 * 100;
