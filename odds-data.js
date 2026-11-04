// What the Odds course asks of you from outside its lessons: statements to rate (calibration), quantities to bracket (ranges),
// and a reference class of past jobs. Every one is a settled fact (checked against the figure given); none is a matter of opinion
// or a number that moves with the news.

/** Statements for the calibration round: choose true or false and how sure you are. t: whether the statement is true; x: the fact. */
export const STATEMENTS = [
  { id: "suez", s: "The Suez Canal is longer than the Panama Canal.", t: true, x: "Suez is about 193 km, Panama about 82 km." },
  { id: "kili", s: "Kilimanjaro is higher than Mont Blanc.", t: true, x: "5,895 m against 4,806 m." },
  { id: "rhine", s: "The Rhine is longer than the Danube.", t: false, x: "The Rhine is about 1,230 km, the Danube about 2,850 km." },
  { id: "brent", s: "Brent crude is priced per tonne.", t: false, x: "Per barrel." },
  { id: "barrel", s: "A barrel of oil holds about 159 litres.", t: true, x: "42 US gallons, 158.99 litres." },
  { id: "pacific", s: "The Pacific Ocean is larger than the Atlantic and Indian Oceans together.", t: false, x: "About 165 million km², against 106 + 71 = 177 million." },
  { id: "bavaria", s: "Bavaria is larger in area than Switzerland.", t: true, x: "About 70,500 km² against 41,300 km²." },
  { id: "tallinn", s: "Tallinn lies on the Gulf of Finland.", t: true, x: "It does, on the Baltic Sea's eastern arm." },
  { id: "gold", s: "Gold is denser than lead.", t: true, x: "19.3 g/cm³ against 11.3 g/cm³." },
  { id: "sound", s: "Sound travels faster in water than in air.", t: true, x: "About 1,480 m/s in water, 343 m/s in air." },
  { id: "moon", s: "The Moon is wider than Pluto.", t: true, x: "3,474 km across, against about 2,377 km." },
  { id: "venus", s: "Venus is closer to the Sun than Mercury is.", t: false, x: "Mercury is the nearest planet." },
  { id: "bones", s: "An adult human has more than 200 bones.", t: true, x: "206." },
  { id: "wall", s: "The Berlin Wall fell before the Soviet Union dissolved.", t: true, x: "November 1989 and December 1991." },
  { id: "lubeck", s: "Lübeck lies on the North Sea coast.", t: false, x: "On the Baltic, up the river Trave." },
  { id: "ethanol", s: "A litre of ethanol holds more energy than a litre of petrol.", t: false, x: "About 21 MJ against about 32 MJ." },
  { id: "diesel", s: "Diesel fuel is denser than petrol (gasoline).", t: true, x: "About 0.83 kg/L against 0.74 kg/L." },
  { id: "fame", s: "Biodiesel (FAME) is made by transesterification.", t: true, x: "Fats react with methanol, giving methyl esters and glycerol." },
  { id: "tokyo", s: "The Tokyo metropolitan area has more people than New York's.", t: true, x: "Over 35 million against about 20 million." },
  { id: "one", s: "The number 1 is a prime number.", t: false, x: "A prime has exactly two divisors; 1 has one." },
  { id: "root2", s: "The square root of 2 is a rational number.", t: false, x: "It cannot be written as a fraction of whole numbers." },
  { id: "waterloo", s: "Napoleon was defeated at Waterloo in 1815.", t: true, x: "18 June 1815." },
  { id: "hundred", s: "The Hundred Years' War lasted exactly 100 years.", t: false, x: "1337 to 1453: 116 years." },
  { id: "titanic", s: "The Titanic sank in 1912.", t: true, x: "15 April 1912." },
  { id: "mercury", s: "Mercury is a liquid at room temperature.", t: true, x: "It melts at −38.8 °C." },
  { id: "helium", s: "Helium is the most abundant element in the universe.", t: false, x: "Hydrogen is, by a wide margin." },
  { id: "k2", s: "K2 is higher than Kangchenjunga.", t: true, x: "8,611 m against 8,586 m." },
  { id: "fat", s: "A gram of fat holds more food energy than a gram of carbohydrate.", t: true, x: "About 9 kcal against 4 kcal." },
  { id: "shanghai", s: "Shanghai lies further north than Tokyo.", t: false, x: "Tokyo is at 35.7° N, Shanghai at 31.2° N." },
  { id: "munich", s: "Munich lies further south than Vienna.", t: true, x: "48.14° N against 48.21° N." },
  { id: "eu", s: "The European Union has more than 30 member states.", t: false, x: "27." },
  { id: "light", s: "Light travels about 300,000 kilometres a second in a vacuum.", t: true, x: "299,792 km/s." },
  { id: "cashew", s: "The cashew tree is native to Brazil.", t: true, x: "Portuguese traders carried it to India and Africa in the 16th century." },
  { id: "mississippi", s: "The Mississippi is longer than the Nile.", t: false, x: "The Nile is about 6,650 km, the Mississippi about 3,730 km." },
  { id: "greenland", s: "Greenland is larger than Australia.", t: false, x: "2.2 million km² against 7.7 million km²." },
  { id: "potassium", s: "The chemical symbol for potassium is Po.", t: false, x: "K, from kalium; Po is polonium." },
  { id: "deck", s: "A standard pack of playing cards has 52 cards.", t: true, x: "Without jokers." },
  { id: "earth", s: "The Earth is about 4.5 billion years old.", t: true, x: "4.54 billion." },
  { id: "antarctica", s: "Antarctica is the driest continent.", t: true, x: "Very little precipitation falls on it." },
  { id: "geneva", s: "Geneva lies further north than Marseille.", t: true, x: "46.2° N against 43.3° N." },
  { id: "norway", s: "Norway is a member of the European Union.", t: false, x: "It is in the EEA but not the EU." },
  { id: "sweden", s: "Sweden uses the euro.", t: false, x: "The Swedish krona." },
  { id: "kelvin", s: "Absolute zero is colder than −250 °C.", t: true, x: "−273.15 °C." },
  { id: "water", s: "Water is densest at 4 °C.", t: true, x: "Which is why lakes freeze from the top." },
  { id: "toronto", s: "Toronto is the capital of Canada.", t: false, x: "Ottawa." },
  { id: "istanbul", s: "Istanbul is the capital of Turkey.", t: false, x: "Ankara." },
  { id: "hamburg", s: "Hamburg has more inhabitants than Munich.", t: true, x: "About 1.9 million against 1.5 million." },
  { id: "main", s: "Frankfurt am Main lies on the river Main.", t: true, x: "As the name says." },
  { id: "rotterdam", s: "Rotterdam is Europe's largest seaport by cargo handled.", t: true, x: "About 440 million tonnes a year." },
];

/** Quantities to bracket with a 90% range. lo, hi: the ends of the slider; log: whether it runs on a log scale; t: the truth. */
export const QUANTITIES = [
  { id: "everest", q: "Height of Mount Everest above sea level", unit: "m", lo: 1000, hi: 100000, log: true, t: 8849 },
  { id: "moon", q: "Distance from the Earth to the Moon (average)", unit: "km", lo: 1000, hi: 10000000, log: true, t: 384400 },
  { id: "rhine", q: "Length of the river Rhine", unit: "km", lo: 100, hi: 20000, log: true, t: 1230 },
  { id: "germany", q: "Population of Germany", unit: "million", lo: 1, hi: 2000, log: true, t: 84 },
  { id: "gutenberg", q: "Year Gutenberg's Bible was printed", unit: "", lo: 1000, hi: 1900, log: false, t: 1455 },
  { id: "ethanol", q: "Boiling point of ethanol", unit: "°C", lo: 0, hi: 300, log: false, t: 78 },
  { id: "barrel", q: "Litres in a barrel of oil", unit: "L", lo: 10, hi: 2000, log: true, t: 159 },
  { id: "swiss", q: "Area of Switzerland", unit: "km²", lo: 1000, hi: 10000000, log: true, t: 41285 },
  { id: "sound", q: "Speed of sound in air at 20 °C", unit: "m/s", lo: 10, hi: 100000, log: true, t: 343 },
  { id: "universe", q: "Age of the universe", unit: "billion years", lo: 0.1, hi: 1000, log: true, t: 13.8 },
  { id: "un", q: "Member states of the United Nations", unit: "", lo: 10, hi: 1000, log: true, t: 193 },
  { id: "challenger", q: "Depth of the Mariana Trench's Challenger Deep", unit: "m", lo: 100, hi: 100000, log: true, t: 10935 },
];

/** A reference class: how many days ten similar jobs took, in the order they were done. */
export const PAST_JOBS = [14, 9, 21, 12, 30, 11, 16, 25, 13, 18];
/** Five independent guesses at a weight in kg whose truth is 100. */
export const GUESSES = { truth: 100, guesses: [70, 150, 90, 120, 60] };
