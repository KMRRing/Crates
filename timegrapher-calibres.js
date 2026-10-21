// Timegrapher's calibres: each movement's beat rate (vph) and lift angle (the arc over which the escapement and the
// balance are engaged, which turns the lift's time into an amplitude), with where each figure comes from and how
// sure it is, as checked in October 2026. Lift angles are often quoted wrongly and makers seldom publish them, so a
// figure from a maker or from a watchmaker's working table (watchguy.co.uk's, built from movements on its bench) is
// "checked", one carried over from a sibling movement is "family", one that sources give differently is "differs", and
// where none is published the timegraphers' own default, 52°, stands, "assumed". The vph matters more than the lift
// angle: rate and beat error need only the vph, and the trace confirms it by ear anyway.
// Korbi's watches come first, then the movements most often met, by maker.

/** The default where nothing is known: 52°, Weishi's factory setting (Witschi: about 51° for most modern movements). */
export const DEFAULT_LIFT = 52;

export const CALIBRES = [
  // ---------- Korbi's ----------
  { id: "jlc-822", name: "Grande Reverso Ultra Thin", cal: "Jaeger-LeCoultre 822", vph: 21600, lift: 52, sure: "assumed", mine: true,
    src: "watchbase: cal. 822, hand-wound, 21,600 vph, 45 h. No lift angle published: the timegraphers' 52°." },
  { id: "jlc-858", name: "Reverso Géographique", cal: "Jaeger-LeCoultre 858", vph: 21600, lift: 52, sure: "assumed", vphSure: "family", mine: true,
    src: "Europa Star: cal. 858, hand-wound, 206 parts, 1998 (Phillips: 22 jewels). 21,600 vph as its 8xx siblings (822, 854); the trace confirms it. No lift angle published." },
  { id: "fc-810", name: "Slimline Monolithic", cal: "Frederique Constant FC-810", vph: 288000, lift: null, flexure: true, sure: "checked", mine: true,
    src: "Frederique Constant: 40 Hz, 288,000 vph, a monocrystalline silicon oscillator with its anchor in the flexures, swinging 6°; 80 h. No balance and no lift: rate only." },
  { id: "rado-r763", name: "Rado True Square", cal: "Rado R763 (ETA C07.611)", vph: 21600, lift: 50, sure: "family", mine: true,
    src: "Rado (R27077312, green): R763, 80 h, Nivachron; Caliber Corner: R763 is the ETA C07.611, 21,600 vph. 50°: watchguy's for the C07.661 and C07.811, the same Powermatic 80 escapement." },
  { id: "fc-310", name: "Heart Beat Automatic", cal: "Frederique Constant FC-310 (Sellita SW200-1)", vph: 28800, lift: 50, sure: "checked", mine: true,
    src: "Caliber Corner: FC-310 is a Sellita SW200-1, 28,800 vph, 50°." },
  { id: "fc-910", name: "Heart Beat Manufacture", cal: "Frederique Constant FC-910, 930, 935, 945", vph: 28800, lift: 52, sure: "assumed", mine: true,
    src: "Grail Watch: FC-910, 28,800 A/h, 48 h (its successors keep the rate). No lift angle published." },
  { id: "quartz", name: "Reverso Lady", cal: "Quartz", quartz: true, mine: true,
    src: "A quartz movement steps once a second from a crystal: there's no escapement for a timegrapher to hear." },
  // ---------- movements ----------
  { id: "eta-2824", name: "ETA 2824-2", cal: "ETA 2824-2", vph: 28800, lift: 50, sure: "checked",
    src: "ETA's technical communication for the 2824-2, 50° (the first 2824 and 2824-1, 53°); watchguy 50°." },
  { id: "eta-2836", name: "ETA 2836-2", cal: "ETA 2836-2", vph: 28800, lift: 50, sure: "checked", src: "watchguy: 50° (the first 2836, 53°)." },
  { id: "eta-2892", name: "ETA 2892-A2", cal: "ETA 2892-A2", vph: 28800, lift: 52, sure: "differs", src: "watchguy: 52°; Caliber Corner: 51°." },
  { id: "eta-2000", name: "ETA 2000-1", cal: "ETA 2000-1", vph: 28800, lift: 50, sure: "checked", src: "watchguy: 50°." },
  { id: "eta-c07", name: "ETA Powermatic 80", cal: "ETA C07.111 family", vph: 21600, lift: 50, sure: "checked", src: "watchguy: C07.661 and C07.811, 50°; 21,600 vph, 80 h." },
  { id: "sw200", name: "Sellita SW200-1", cal: "Sellita SW200-1", vph: 28800, lift: 50, sure: "checked", src: "Caliber Corner: 50°, 28,800 vph." },
  { id: "sw300", name: "Sellita SW300-1", cal: "Sellita SW300-1", vph: 28800, lift: 51, sure: "checked", src: "Caliber Corner (Sinn's figure): 51°." },
  { id: "unitas-1", name: "Unitas 6497-1 / 6498-1", cal: "ETA (Unitas) 6497-1, 6498-1", vph: 18000, lift: 44, sure: "checked", src: "watchguy: 6497, 44°; 18,000 vph." },
  { id: "unitas-2", name: "Unitas 6497-2 / 6498-2", cal: "ETA (Unitas) 6497-2, 6498-2", vph: 21600, lift: 44, sure: "family", src: "21,600 vph (Caliber Corner); the lift angle is watchguy's for the 6497." },
  { id: "peseux-7001", name: "Peseux 7001", cal: "ETA (Peseux) 7001", vph: 21600, lift: 50, sure: "checked", src: "watchguy: 50°." },
  { id: "valjoux-7750", name: "Valjoux 7750", cal: "ETA (Valjoux) 7750", vph: 28800, lift: 49, sure: "differs", src: "watchguy: 49°; others quote 50 to 52°." },
  { id: "rolex-3135", name: "Rolex 3135 / 3130", cal: "Rolex 3135, 3130", vph: 28800, lift: 52, sure: "checked", src: "Caliber Corner: 52°." },
  { id: "rolex-3235", name: "Rolex 3235 / 3230", cal: "Rolex 3235, 3230 (Chronergy)", vph: 28800, lift: 52, sure: "assumed", src: "28,800 vph, 70 h. Rolex publishes no lift angle for the Chronergy escapement: 52° assumed." },
  { id: "omega-8500", name: "Omega 8500 / 8800 / 8900", cal: "Omega co-axial 8500, 8800, 8900", vph: 25200, lift: 38, sure: "family", coaxial: true,
    src: "25,200 vph. Caliber Corner: most 8000s 38° (8806 and 8807, 36°). A co-axial's noises aren't a lever's: Omega asks for a timegrapher with a co-axial mode, so no amplitude here." },
  { id: "omega-2500", name: "Omega 2500 co-axial", cal: "Omega 2500 C, D", vph: 25200, lift: 38, sure: "checked", coaxial: true, src: "vintagemasters: 38° (the 2500 A and B ran at 28,800)." },
  { id: "omega-1861", name: "Omega 1861", cal: "Omega 1861, 1863", vph: 21600, lift: 50, sure: "checked", src: "vintagemasters: 50°." },
  { id: "seiko-6r", name: "Seiko 6R15 / 6R35", cal: "Seiko 6R15, 6R35", vph: 21600, lift: 53, sure: "differs", src: "Caliber Corner: 53°; a Seiko sheet gives 52° for the 6R15." },
  { id: "seiko-4r", name: "Seiko 4R35 / 4R36 / NH35", cal: "Seiko 4R35, 4R36, NH35, NH36", vph: 21600, lift: 53, sure: "differs", src: "Caliber Corner: 53°; Seiko's NH sheets give 52°." },
  { id: "seiko-7s26", name: "Seiko 7S26", cal: "Seiko 7S26", vph: 21600, lift: 53, sure: "differs", src: "Seiko's sheet for the 7S26A: 53°; the 7S26C, 52°." },
  { id: "miyota-9015", name: "Miyota 9015", cal: "Miyota 9015", vph: 28800, lift: 51, sure: "checked", src: "Caliber Corner: 51°; Citizen's tolerance −10/+30 s/d." },
  { id: "miyota-8215", name: "Miyota 8215", cal: "Miyota 8215", vph: 21600, lift: 49, sure: "checked", src: "watchguy and Caliber Corner: 49°." },
  { id: "zenith-400", name: "Zenith El Primero", cal: "Zenith El Primero 400", vph: 36000, lift: 52, sure: "assumed", src: "36,000 vph. No lift angle published: 52° assumed." },
];

export const byId = id => CALIBRES.find(c => c.id === id) || null;
/** The words for how sure a lift angle is. */
export const SURE = { checked: "from a maker or a watchmaker's table", family: "from a sibling movement", differs: "sources differ by a degree or two", assumed: "none published: the default" };
