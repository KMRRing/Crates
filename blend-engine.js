// Blend: build a product to spec from a tank farm of components, at the best margin. Each level is an order:
// a product with its spec (EN 228, EN 590, EN 15940, Jet A-1, ISO 8217), the components on hand with their
// properties, prices and availability, and a sales price. Properties blend the way they do in practice: most
// linearly by volume, octane by blending values, vapour pressure by blending RVP (ethanol's is huge at low
// blends), and flash point, cold flow and viscosity by index, so a little of the wrong component moves them a
// lot. Par is the best margin on the 5% grid, found by trying every blend.

// ---------- how properties blend ----------
// linear: by volume; octane: blending numbers (already in the component data); index: a transform that is
// linear by volume, so the blend is dominated by the component that is worst in that property.
export const PROPS = {
  ron: { name: "RON", unit: "", blend: "linear", why: "Research octane: resistance to knock under gentle conditions. Reformate and alkylate bring it; light naphtha and FCC naphtha dilute it; ethanol's blending value is very high." },
  mon: { name: "MON", unit: "", blend: "linear", why: "Motor octane: the same under load. Aromatics and ethanol lose about 10 and 20 points from RON to MON; alkylate loses almost none, so it is what lifts a pool that passes RON and fails MON." },
  rvp: { name: "Vapour pressure", unit: "kPa", blend: "linear", why: "Reid vapour pressure at 37.8 °C: cold starting needs enough, hot weather needs not too much (vapour lock, evaporative emissions). Butane and isomerate raise it; ethanol's blending value at 10% is around 130 kPa, far above its own. Summer class A is 45–60 kPa, winter class F 70–100." },
  e70: { name: "E70", unit: "%", blend: "linear", why: "The share evaporated at 70 °C: the front end of the distillation curve. Light components raise it; too little and the engine won't start cold, too much and fuel vaporises in the lines." },
  arom: { name: "Aromatics", unit: "%", blend: "linear", why: "EN 228 caps aromatics at 35% by volume (deposits, emissions). Reformate is 60–75% aromatics, so it can be at most about half the pool." },
  olef: { name: "Olefins", unit: "%", blend: "linear", why: "EN 228 caps olefins at 18% (gum formation, ozone reactivity). FCC naphtha is the olefinic stream, 20–40%." },
  benz: { name: "Benzene", unit: "%", blend: "linear", why: "Capped at 1% by volume as a carcinogen; reformate carries a few per cent unless its benzene precursors were cut from the feed." },
  oxy: { name: "Oxygen", unit: "%", blend: "linear", why: "EN 228 allows 3.7% oxygen by mass, which is about 10% ethanol (34.7% oxygen) or 22% ETBE (15.7%)." },
  eth: { name: "Ethanol", unit: "%", blend: "linear", why: "E10 allows up to 10% ethanol by volume; E5 5%; E85 50–85%. It brings octane and the renewable credit, and takes energy and water tolerance." },
  s: { name: "Sulphur", unit: "ppm", blend: "linear", why: "10 ppm for road fuels since 2009; 0.5% (5,000 ppm) for marine fuel since IMO 2020, 0.1% in emission control areas. Every stream's sulphur is what the hydrotreater left in it." },
  dens: { name: "Density", unit: "kg/m³", blend: "linear", why: "At 15 °C. EN 590 wants 820–845 (800–840 arctic), EN 228 720–775, paraffinic diesel 765–800. HVO at 780 and FAME at 880 pull a diesel pool in opposite directions; the window is what limits HVO in EN 590." },
  cet: { name: "Cetane", unit: "", blend: "linear", why: "Ignition quality: EN 590 wants 51 (40 for marine gasoil, 70 for paraffinic diesel). Normal paraffins ignite readily (HVO 75–90), aromatics don't (LCO in the 20s)." },
  pah: { name: "Polyaromatics", unit: "%", blend: "linear", why: "EN 590 caps di- and tri-aromatics at 8% by mass: they make soot. LCO is the stream that threatens it." },
  fame: { name: "FAME", unit: "%", blend: "linear", why: "EN 590 allows 7% FAME (B7); above that engines and seals aren't approved. HVO has no such cap: it is a hydrocarbon." },
  flash: { name: "Flash point", unit: "°C", blend: "flash", why: "The lowest temperature at which the vapour ignites: at least 55 °C for EN 590, 60 for marine fuels, 38 for jet. It blends by index, so a few per cent of gasoline-contaminated slops or too much kerosene takes a diesel below the limit." },
  cfpp: { name: "CFPP", unit: "°C", blend: "cold", why: "Cold filter plugging point: where wax blocks the filter. Summer class B is 0 °C, winter class F −20, arctic class 2 −32. Blends by index: the waxiest component dominates, so palm methyl ester at +10 ruins a winter blend fast; kerosene and winter HVO fix it." },
  freeze: { name: "Freeze point", unit: "°C", blend: "cold", why: "Jet A-1 must stay liquid to −47 °C at altitude. Blends by index." },
  visc: { name: "Viscosity", unit: "cSt", blend: "visc", why: "Kinematic viscosity: EN 590 2.0–4.5 at 40 °C, marine gasoil 2.0–6.0, residual fuel up to 380 at 50 °C. Blends on a double-log scale, so light cutter stock thins heavy residue more than its share." },
  lub: { name: "Lubricity", unit: "µm", blend: "lub", why: "HFRR wear scar, at most 460 µm: deep desulphurisation strips the natural lubricity, FAME or additive restores it. A couple of per cent of FAME is enough: its effect saturates, so this one isn't linear." },
};

// ---------- components ----------
// price in €/m³; every property it has. Octane and vapour pressure are blending values.
export const COMPONENTS = {
  // gasoline blendstocks
  eurobob: { name: "Eurobob base", price: 620, ron: 92, mon: 82, rvp: 52, e70: 30, arom: 30, olef: 12, benz: 0.8, oxy: 0, eth: 0, s: 8, dens: 745, note: "The refinery's own base gasoline, short of octane and made for ethanol." },
  reformate: { name: "Reformate", price: 700, ron: 100, mon: 89, rvp: 20, e70: 8, arom: 68, olef: 1, benz: 2.5, oxy: 0, eth: 0, s: 1, dens: 810, note: "Aromatic and high-octane; caps itself through the aromatics and benzene limits." },
  alkylate: { name: "Alkylate", price: 760, ron: 95, mon: 93, rvp: 35, e70: 10, arom: 0, olef: 0, benz: 0, oxy: 0, eth: 0, s: 1, dens: 700, note: "Clean octane with almost no vapour pressure and no sensitivity: expensive and worth it in summer." },
  isomerate: { name: "Isomerate", price: 640, ron: 88, mon: 86, rvp: 93, e70: 70, arom: 0, olef: 0, benz: 0, oxy: 0, eth: 0, s: 1, dens: 650, note: "Light, branched C5–C6: good front end, eats the vapour-pressure budget." },
  fccNaphtha: { name: "FCC naphtha (treated)", price: 600, ron: 90, mon: 80, rvp: 55, e70: 32, arom: 25, olef: 30, benz: 0.7, oxy: 0, eth: 0, s: 10, dens: 745, note: "Cheap volume and decent RON; olefins cap it at about 60% of the pool and MON drags." },
  lsr: { name: "Light straight-run", price: 560, ron: 70, mon: 68, rvp: 90, e70: 85, arom: 2, olef: 0, benz: 0.5, oxy: 0, eth: 0, s: 5, dens: 660, note: "Cheapest and lightest: a little helps cold starting, more sinks the octane." },
  butane: { name: "n-Butane", price: 450, ron: 93, mon: 90, rvp: 358, e70: 100, arom: 0, olef: 0, benz: 0, oxy: 0, eth: 0, s: 0, dens: 580, note: "The cheapest octane and volume there is, at 358 kPa of vapour pressure: winter's friend, summer's casualty." },
  ethanol: { name: "Ethanol", price: 780, bio: 1, ron: 120, mon: 100, rvp: 130, e70: 40, arom: 0, olef: 0, benz: 0, oxy: 34.7, eth: 100, s: 0, dens: 789, note: "Blending RON around 120, a blending vapour pressure of about 130 kPa at low blends, 34.7% oxygen, and the renewable credit that pays for it." },
  etbe: { name: "ETBE", price: 900, bio: 0.47, ron: 118, mon: 102, rvp: 28, e70: 25, arom: 0, olef: 0, benz: 0, oxy: 15.7, eth: 0, s: 0, dens: 750, note: "Ethanol's ether: the credit without the vapour pressure, at a price." },
  toluene: { name: "Toluene", price: 820, ron: 120, mon: 103, rvp: 7, e70: 0, arom: 100, olef: 0, benz: 0, oxy: 0, eth: 0, s: 0, dens: 870, note: "The best of the aromatics; counts fully against the aromatics cap." },
  // diesel blendstocks
  ulsd: { name: "Straight-run gas oil (ULSD)", price: 700, cet: 52, dens: 840, s: 8, pah: 5, fame: 0, flash: 66, cfpp: -6, visc: 3.0, lub: 520, arom: 25, note: "Hydrotreated straight-run diesel: the base of the pool, short of cold flow and, since desulphurisation, of lubricity." },
  hcDiesel: { name: "Hydrocracker diesel", price: 730, cet: 58, dens: 826, s: 5, pah: 1, fame: 0, flash: 70, cfpp: -9, visc: 2.8, lub: 540, arom: 12, note: "Paraffinic and clean: cetane and low aromatics." },
  lco: { name: "LCO (treated)", price: 600, cet: 35, dens: 900, s: 10, pah: 16, fame: 0, flash: 76, cfpp: -14, visc: 3.3, lub: 480, arom: 70, note: "Cheap, aromatic, poor cetane: the PAH limit and the cetane limit both cap it." },
  kero: { name: "Kerosene", price: 760, cet: 43, dens: 800, s: 10, pah: 1, fame: 0, flash: 44, cfpp: -47, visc: 1.4, lub: 560, arom: 18, freeze: -50, note: "Winter's cutter: superb cold flow, low cetane, low viscosity, and a flash point of 44 that sinks a diesel blend's." },
  hvoWinter: { name: "HVO, arctic grade", price: 1900, bio: 1, cet: 78, dens: 780, s: 1, pah: 0, fame: 0, flash: 80, cfpp: -38, visc: 2.9, lub: 580, arom: 0, note: "Isomerised to −38 °C; cetane, cold flow and the ticket in one, if the density window allows it." },
  hvoSummer: { name: "HVO, summer grade", price: 1750, bio: 1, cet: 85, dens: 780, s: 1, pah: 0, fame: 0, flash: 80, cfpp: -6, visc: 3.0, lub: 580, arom: 0, note: "Less isomerised: more cetane, worse cold flow, a little cheaper." },
  rme: { name: "RME", price: 1300, bio: 1, cet: 54, dens: 880, s: 5, pah: 0, fame: 100, flash: 120, cfpp: -13, visc: 4.4, lub: 200, arom: 0, note: "Rapeseed methyl ester: Europe's biodiesel. Lubricity, density, and cold flow that is fine until the arctic." },
  pme: { name: "PME", price: 1050, bio: 1, cet: 62, dens: 875, s: 5, pah: 0, fame: 100, flash: 130, cfpp: 10, visc: 4.5, lub: 200, arom: 0, note: "Palm methyl ester: cheaper, better cetane, and a CFPP of +10 that ruins anything but a summer blend." },
  ucome: { name: "UCOME", price: 1200, bio: 2, cet: 56, dens: 880, s: 5, pah: 0, fame: 100, flash: 125, cfpp: -5, visc: 4.6, lub: 200, arom: 0, note: "Used-cooking-oil methyl ester: double-counted under most mandates, middling cold flow." },
  hgo: { name: "Heavy gas oil (treated)", price: 650, cet: 48, dens: 862, s: 10, pah: 9, fame: 0, flash: 92, cfpp: 4, visc: 4.6, lub: 500, arom: 30, note: "Heavy, waxy and dense: cheap cetane-neutral volume for summer, impossible in winter." },
  gtl: { name: "GTL diesel", price: 1100, cet: 75, dens: 776, s: 1, pah: 0, fame: 0, flash: 70, cfpp: -22, visc: 2.6, lub: 560, arom: 0, note: "Fischer–Tropsch paraffins: like HVO without the ticket." },
  slops: { name: "Diesel slops", price: 480, cet: 48, dens: 832, s: 9, pah: 4, fame: 0, flash: 24, cfpp: -8, visc: 2.6, lub: 540, arom: 24, note: "Tank bottoms with gasoline in them: a tempting price, a flash point of 24 °C." },
  // jet
  jetKero: { name: "Straight-run jet kerosene", price: 820, dens: 800, s: 800, flash: 42, freeze: -50, arom: 18, note: "Merox-treated kerosene: the base of jet fuel." },
  hcKero: { name: "Hydrocracker kerosene", price: 840, dens: 790, s: 5, flash: 44, freeze: -60, arom: 9, note: "Clean, low in aromatics, superb freeze point." },
  hefa: { name: "HEFA SAF", price: 2600, bio: 1, dens: 762, s: 1, flash: 42, freeze: -55, arom: 0, note: "Sustainable aviation fuel from fats: no aromatics at all, which is why it can't be used neat, and a density below the jet minimum." },
  // marine
  hsfo: { name: "High-sulphur residue (RMG 380)", price: 450, s: 28000, dens: 988, flash: 72, visc: 380, note: "Vacuum residue at 2.8% sulphur: the cheapest fuel there is, and legal only with a scrubber." },
  lsfo: { name: "Low-sulphur residue", price: 540, s: 5600, dens: 965, flash: 70, visc: 300, note: "Residue from sweet crude, just over the 0.5% line on its own: it needs sweetening." },
  mgo: { name: "Marine gasoil", price: 700, s: 900, dens: 858, flash: 64, visc: 3.0, cet: 45, note: "Distillate bunker fuel: the sweetener and the thinner for residue blends, at distillate prices." },
  cutter: { name: "Cutter stock (LCO)", price: 600, s: 3000, dens: 905, flash: 70, visc: 3.4, cet: 35, note: "Cycle oil to thin residue down to pumpable viscosity." },
  ulsdMarine: { name: "Ultra-low-sulphur gasoil", price: 720, s: 8, dens: 840, flash: 66, visc: 3.0, cet: 52, note: "Road-grade gasoil, for emission-control-area blends." },
  keroMarine: { name: "Kerosene", price: 760, s: 10, dens: 800, flash: 44, visc: 1.4, cet: 43, note: "Cheap thinner, flash point 44." },
};

// ---------- products and their specs ----------
// each spec: property -> { min, max }; order: the properties in the order the panel shows them
export const PRODUCTS = {
  e10summer: { name: "E10 petrol, summer (EN 228 class A)", price: 740, credit: 600, order: ["ron", "mon", "rvp", "e70", "arom", "olef", "benz", "oxy", "eth", "s", "dens"],
    spec: { ron: { min: 95 }, mon: { min: 85 }, rvp: { min: 45, max: 60 }, e70: { min: 20, max: 48 }, arom: { max: 35 }, olef: { max: 18 }, benz: { max: 1 }, oxy: { max: 3.7 }, eth: { max: 10 }, s: { max: 10 }, dens: { min: 720, max: 775 } },
    note: "Eurosuper 95 E10 for summer: the vapour-pressure ceiling is the constraint that bites." },
  e10winter: { name: "E10 petrol, winter (EN 228 class F)", price: 730, credit: 600, order: ["ron", "mon", "rvp", "e70", "arom", "olef", "benz", "oxy", "eth", "s", "dens"],
    spec: { ron: { min: 95 }, mon: { min: 85 }, rvp: { min: 70, max: 100 }, e70: { min: 22, max: 50 }, arom: { max: 35 }, olef: { max: 18 }, benz: { max: 1 }, oxy: { max: 3.7 }, eth: { max: 10 }, s: { max: 10 }, dens: { min: 720, max: 775 } },
    note: "The same grade for a northern winter: now there is a vapour-pressure floor, and butane is the cheapest way to it." },
  super98: { name: "Super Plus 98 E5 (EN 228)", price: 800, credit: 600, order: ["ron", "mon", "rvp", "arom", "olef", "benz", "oxy", "eth", "s", "dens"],
    spec: { ron: { min: 98 }, mon: { min: 88 }, rvp: { min: 45, max: 60 }, arom: { max: 35 }, olef: { max: 18 }, benz: { max: 1 }, oxy: { max: 2.7 }, eth: { max: 5 }, s: { max: 10 }, dens: { min: 720, max: 775 } },
    note: "98 octane with only 5% ethanol allowed: the octane has to come from alkylate, reformate and ethers, inside the aromatics cap." },
  e85: { name: "E85, winter (EN 15293)", price: 760, credit: 600, order: ["eth", "ron", "rvp", "s"],
    spec: { eth: { min: 50, max: 75 }, ron: { min: 95 }, rvp: { min: 50, max: 95 }, s: { max: 10 } },
    note: "Winter E85 drops the ethanol to 50–75% so the engine starts cold; the hydrocarbon part has to bring the vapour pressure." },
  b7summer: { name: "B7 diesel, summer (EN 590 class B)", price: 790, credit: 900, order: ["cet", "dens", "s", "pah", "fame", "flash", "cfpp", "visc", "lub"],
    spec: { cet: { min: 51 }, dens: { min: 820, max: 845 }, s: { max: 10 }, pah: { max: 8 }, fame: { max: 7 }, flash: { min: 55 }, cfpp: { max: 0 }, visc: { min: 2, max: 4.5 }, lub: { max: 460 } },
    note: "Summer road diesel: cetane, polyaromatics and lubricity are what the cheap components fail." },
  b7winter: { name: "B7 diesel, winter (EN 590 class F)", price: 810, credit: 900, order: ["cet", "dens", "s", "pah", "fame", "flash", "cfpp", "visc", "lub"],
    spec: { cet: { min: 51 }, dens: { min: 820, max: 845 }, s: { max: 10 }, pah: { max: 8 }, fame: { max: 7 }, flash: { min: 55 }, cfpp: { max: -20 }, visc: { min: 2, max: 4.5 }, lub: { max: 460 } },
    note: "CFPP −20 °C. Kerosene gets you there and takes cetane, viscosity and flash point with it; winter HVO gets you there at a price, but the density floor limits it." },
  arctic: { name: "Arctic diesel, class 1 (EN 590)", price: 950, credit: 900, order: ["cet", "dens", "s", "pah", "fame", "flash", "cfpp", "visc", "lub"],
    spec: { cet: { min: 48 }, dens: { min: 800, max: 840 }, s: { max: 10 }, pah: { max: 8 }, fame: { max: 7 }, flash: { min: 55 }, cfpp: { max: -26 }, visc: { min: 1.5, max: 4 }, lub: { max: 460 } },
    note: "CFPP −26 °C for Lapland: the arctic classes relax cetane, density and viscosity so the blend can be mostly kerosene and paraffins, but the flash point stays at 55." },
  paraffinic: { name: "Paraffinic diesel (EN 15940 class A)", price: 1250, credit: 900, order: ["cet", "dens", "s", "arom", "fame", "flash", "cfpp", "visc", "lub"],
    spec: { cet: { min: 70 }, dens: { min: 765, max: 800 }, s: { max: 5 }, arom: { max: 1.1 }, fame: { max: 7 }, flash: { min: 55 }, cfpp: { max: -20 }, visc: { min: 2, max: 4.5 }, lub: { max: 460 } },
    note: "HVO100 for a fleet: the standard forbids aromatics, so nothing from the crude unit fits; the whole order is paraffins." },
  jet: { name: "Jet A-1 with SAF", price: 950, credit: 2000, order: ["dens", "flash", "freeze", "arom", "s"],
    spec: { dens: { min: 775, max: 840 }, flash: { min: 38 }, freeze: { max: -47 }, arom: { min: 8, max: 25 }, s: { max: 3000 } },
    note: "Jet with as much sustainable fuel as the spec takes: the aromatics floor and the density floor are what stop neat HEFA." },
  vlsfo: { name: "VLSFO 0.5% (ISO 8217 RMG 380)", price: 600, credit: 0, order: ["s", "visc", "dens", "flash"],
    spec: { s: { max: 5000 }, visc: { max: 380 }, dens: { max: 991 }, flash: { min: 60 } },
    note: "Post-2020 bunker fuel: residue sweetened and thinned to 0.5% sulphur and 380 cSt at the lowest cost." },
  mgoEca: { name: "Marine gasoil, ECA 0.1% (ISO 8217 DMA)", price: 760, credit: 0, order: ["s", "visc", "dens", "flash", "cet"],
    spec: { s: { max: 1000 }, visc: { min: 2, max: 6 }, dens: { max: 890 }, flash: { min: 60 }, cet: { min: 40 } },
    note: "Distillate for the North Sea and Baltic emission control areas: 0.1% sulphur and a 60 °C flash point." },
};

// ---------- the blending maths ----------
const flashIndex = t => Math.exp(-0.14 * t), unFlash = i => -Math.log(i) / 0.14;
const coldIndex = t => Math.exp(0.045 * t), unCold = i => Math.log(i) / 0.045;
const viscIndex = v => Math.log(Math.log(v + 0.7)), unVisc = i => Math.exp(Math.exp(i)) - 0.7;
/** The blend's properties for component ids and their fractions (per cent, summing to 100). */
export function blendProps(ids, pct) {
  const total = pct.reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const p of Object.keys(PROPS)) {
    const parts = ids.map((id, i) => [COMPONENTS[id][p], pct[i] / total]).filter(([v]) => v != null);
    if (!parts.length || parts.reduce((a, [, w]) => a + w, 0) < 0.999) continue;      // a property not every component has
    const kind = PROPS[p].blend;
    if (kind === "lub") {                                                  // FAME restores lubricity, saturating by about 2%
      const fame = ids.reduce((a, id, i) => a + (COMPONENTS[id].fame || 0) * pct[i] / total, 0);
      const base = parts.reduce((a, [v, w]) => a + w * v, 0);
      out[p] = base - (base - 200) * Math.min(1, fame / 2);
      continue;
    }
    if (kind === "flash") out[p] = unFlash(parts.reduce((a, [v, w]) => a + w * flashIndex(v), 0));
    else if (kind === "cold") out[p] = unCold(parts.reduce((a, [v, w]) => a + w * coldIndex(v), 0));
    else if (kind === "visc") out[p] = unVisc(parts.reduce((a, [v, w]) => a + w * viscIndex(v), 0));
    else out[p] = parts.reduce((a, [v, w]) => a + w * v, 0);
  }
  return out;
}
/** Cost of the blend in €/m³. */
export const blendCost = (ids, pct) => { const t = pct.reduce((a, b) => a + b, 0) || 1; return ids.reduce((c, id, i) => c + COMPONENTS[id].price * pct[i] / t, 0); };
/** The renewable share of the blend (UCOME counts double, as under most mandates). */
export const bioShare = (ids, pct) => { const t = pct.reduce((a, b) => a + b, 0) || 1; return ids.reduce((c, id, i) => c + (COMPONENTS[id].bio || 0) * pct[i] / t, 0); };
/** The margin in €/m³: the product's price plus the compliance credit on its renewable content, less the components. */
export const margin = (product, ids, pct) => PRODUCTS[product].price + (PRODUCTS[product].credit || 0) * bioShare(ids, pct) - blendCost(ids, pct);
/** The judge: each spec property with its value, limits and whether it passes. */
export function judge(product, props) {
  return PRODUCTS[product].order.map(p => {
    const lim = PRODUCTS[product].spec[p], v = props[p];
    const ok = v != null && (lim.min == null || v >= lim.min - 1e-9) && (lim.max == null || v <= lim.max + 1e-9);
    return { p, value: v, min: lim.min, max: lim.max, ok };
  });
}

// ---------- levels ----------
export const LEVELS = [
  { id: 1, product: "e10summer", components: ["eurobob", "ethanol", "butane", "alkylate", "reformate"], max: { ethanol: 10 },
    title: "Summer E10 for Hamburg", intro: "Ten per cent ethanol is the cheap octane, but its blending vapour pressure is 130 kPa against a 60 kPa ceiling. Find how much the pool can take, and what fills the rest." },
  { id: 2, product: "e10winter", components: ["eurobob", "ethanol", "butane", "lsr", "reformate"], max: { ethanol: 10 },
    title: "Winter E10 for Helsinki", intro: "Now the vapour pressure has a floor of 70 kPa so the cars start at −15. Butane is 358 kPa and the cheapest thing in the yard." },
  { id: 3, product: "super98", components: ["eurobob", "alkylate", "reformate", "etbe", "ethanol", "toluene"], max: { ethanol: 5 },
    title: "Super Plus 98 for Munich", intro: "98 RON and 88 MON with ethanol capped at 5%. Reformate and toluene run into the aromatics cap; alkylate is the clean way to MON." },
  { id: 4, product: "b7summer", components: ["ulsd", "lco", "rme", "hvoSummer", "hgo"], max: {},
    title: "Summer B7 for Rotterdam", intro: "Straight-run diesel passes everything but lubricity; a little FAME fixes that. LCO is cheap and fails cetane and polyaromatics: find how much the blend can carry." },
  { id: 5, product: "b7winter", components: ["ulsd", "kero", "hvoWinter", "rme", "lco"], max: {},
    title: "Winter B7 for Stockholm", intro: "CFPP −20 °C. Kerosene is the cheap route to it and takes cetane, viscosity and flash point down with it; winter HVO is the dear route, and the density floor limits it." },
  { id: 6, product: "b7summer", components: ["ulsd", "slops", "pme", "rme", "hcDiesel"], max: {},
    title: "The slops cargo", intro: "A broker offers tank bottoms at €480 and palm methyl ester at €1,050. The slops have gasoline in them: watch the flash point. Palm ester has a CFPP of +10: watch the cold flow, even in summer." },
  { id: 7, product: "arctic", components: ["kero", "hvoWinter", "ulsd", "gtl", "rme"], max: {},
    title: "Arctic class 1 for Rovaniemi", intro: "CFPP −26 °C. The arctic class relaxes cetane, density and viscosity so the blend can be mostly kerosene and paraffins; the flash point stays at 55, and kerosene's is 44." },
  { id: 8, product: "paraffinic", components: ["hvoWinter", "hvoSummer", "gtl", "rme", "ulsd"], max: {},
    title: "HVO100 for a bus fleet", intro: "EN 15940 forbids aromatics, so the straight-run gas oil is out before you start. Cetane 70, density 765–800, CFPP −20, lubricity: find the cheapest paraffinic blend that passes." },
  { id: 9, product: "jet", components: ["jetKero", "hcKero", "hefa"], max: {},
    title: "Jet A-1 with SAF for Schiphol", intro: "As much HEFA as the specification takes. HEFA has no aromatics and a density of 762: the 8% aromatics floor and the 775 density floor set the ceiling, and the hydrocracker kerosene's low aromatics make it worse." },
  { id: 10, product: "vlsfo", components: ["hsfo", "lsfo", "mgo", "cutter"], max: {},
    title: "VLSFO for a bulk carrier", intro: "Residue to 0.5% sulphur and 380 cSt at the lowest cost. High-sulphur residue is cheapest and needs sweetening; the gasoil that sweetens it also thins it, and costs distillate money." },
  { id: 11, product: "mgoEca", components: ["mgo", "ulsdMarine", "cutter", "keroMarine"], max: {},
    title: "ECA gasoil for the Baltic", intro: "0.1% sulphur and a 60 °C flash point: the kerosene that would cut cost has a flash point of 44, and the cutter stock's sulphur is 0.3%." },
  { id: 12, product: "e85", components: ["ethanol", "eurobob", "butane", "isomerate"], max: {},
    title: "Winter E85 for Uppsala", intro: "Fifty to seventy-five per cent ethanol, with enough vapour pressure to start at −20: the hydrocarbon quarter has to bring it, and butane brings the most." },
];

/**
 * A hint from a blend: the best move of 5% from one component to another. If the blend passes, the move that
 * raises the margin most while still passing; if it doesn't, the move that cuts the worst remaining shortfall most.
 */
export function hint(level, pct) {
  const ids = level.components, n = ids.length;
  const shortfall = p => judge(level.product, p).reduce((t, x) => t + (x.ok ? 0 : x.value == null ? 1 : Math.abs(x.value - (x.min != null && x.value < x.min ? x.min : x.max)) / (Math.abs(x.max ?? x.min) || 1)), 0);
  const now = blendProps(ids, pct), passing = judge(level.product, now).every(x => x.ok);
  let best = null;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j || pct[j] < STEP) continue;
    if (level.max?.[ids[i]] != null && pct[i] + STEP > level.max[ids[i]]) continue;
    const trial = [...pct]; trial[i] += STEP; trial[j] -= STEP;
    const props = blendProps(ids, trial), ok = judge(level.product, props).every(x => x.ok);
    const score = passing ? (ok ? margin(level.product, ids, trial) : -Infinity) : -shortfall(props) + (ok ? 1000 : 0);
    if (!best || score > best.score) best = { up: ids[i], down: ids[j], score, ok, margin: margin(level.product, ids, trial) };
  }
  if (!best || best.score === -Infinity) return null;
  if (passing && best.margin <= margin(level.product, ids, pct) + 1e-9) return null;
  return best;
}

// ---------- par: every blend on the 5% grid ----------
export const STEP = 5;
/** The best margin a blend of the level's components can make, and the blend, or null if nothing passes. */
export function solve(level, step = STEP) {
  const ids = level.components, n = ids.length;
  let best = null, feasible = 0;
  const pct = new Array(n).fill(0);
  const rec = (i, left) => {
    if (i === n - 1) {
      pct[i] = left;
      if (level.max?.[ids[i]] != null && left > level.max[ids[i]]) return;
      const props = blendProps(ids, pct);
      if (!judge(level.product, props).every(x => x.ok)) return;
      feasible++;
      const m = margin(level.product, ids, pct);
      if (!best || m > best.margin) best = { margin: m, pct: [...pct] };
      return;
    }
    const cap = Math.min(left, level.max?.[ids[i]] ?? 100);
    for (let v = 0; v <= cap; v += step) { pct[i] = v; rec(i + 1, left - v); }
  };
  rec(0, 100);
  return best && { ...best, feasible };
}
