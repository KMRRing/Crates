// Primers for Order: a unit you hear about but can't picture (a hectare, a kilowatt-hour, a barrel), learned by putting
// familiar things in order by it. Each primer opens with a key (what one unit is, in things you know), its cards are
// things of very different sizes, and each card's value shows in the unit once it's placed, with a reminder where it
// helps. Values are round, typical figures (a bathtub, a family farm); what matters is the order of magnitude.
export const PRIMERS = [
 {
  "id": "area", "name": "Area, in hectares", "unit": "ha",
  "key": "A hectare is a square 100 m a side: 10,000 m², about one and a half football pitches. 100 ha make a km².",
  "items": [
   { "q": "A tennis court", "v": 0.026, "shown": "0.026 ha (261 m²)" },
   { "q": "A football pitch", "v": 0.71, "shown": "0.71 ha" },
   { "q": "An average EU farm", "v": 17, "shown": "17 ha" },
   { "q": "Vatican City", "v": 49, "shown": "49 ha" },
   { "q": "Hyde Park, London", "v": 142, "shown": "142 ha" },
   { "q": "An average US farm", "v": 180, "shown": "180 ha" },
   { "q": "Monaco", "v": 202, "shown": "202 ha (2 km²)" },
   { "q": "Central Park, New York", "v": 341, "shown": "341 ha" },
   { "q": "Heathrow airport", "v": 1227, "shown": "1,227 ha" },
   { "q": "Manhattan", "v": 5900, "shown": "5,900 ha (59 km²)" },
   { "q": "The city of Paris", "v": 10540, "shown": "10,540 ha (105 km²)" },
   { "q": "Lake Geneva", "v": 58000, "shown": "58,000 ha (580 km²)" }
  ]
 },
 {
  "id": "volume", "name": "Volume, in litres", "unit": "L",
  "key": "A litre is a 10 cm cube. An oil barrel is 159 litres; a cubic metre is 1,000 litres, about 6.3 barrels.",
  "items": [
   { "q": "A wine bottle", "v": 0.75, "shown": "0.75 L" },
   { "q": "A jerrycan", "v": 20, "shown": "20 L" },
   { "q": "A full bathtub", "v": 150, "shown": "about 150 L" },
   { "q": "An oil barrel", "v": 159, "shown": "159 L" },
   { "q": "An IBC tote, the caged plastic cube", "v": 1000, "shown": "1,000 L (1 m³)" },
   { "q": "A road fuel tanker", "v": 36000, "shown": "about 36,000 L" },
   { "q": "An Olympic swimming pool", "v": 2500000, "shown": "2.5 million L" },
   { "q": "An MR tanker's cargo of diesel", "v": 45000000, "shown": "about 45 million L (283,000 bbl)" },
   { "q": "A VLCC's cargo of crude", "v": 318000000, "shown": "318 million L (2 million bbl)" }
  ]
 },
 {
  "id": "energy", "name": "Energy, in kilowatt-hours", "unit": "kWh",
  "key": "A kilowatt-hour is a 1,000-watt heater running for an hour. A litre of diesel holds about 10 kWh; an MMBtu, gas traders' unit, is 293 kWh; 1 MWh = 1,000 kWh.",
  "items": [
   { "q": "Charging a phone", "v": 0.015, "shown": "0.015 kWh (15 Wh)" },
   { "q": "Boiling a full kettle", "v": 0.15, "shown": "about 0.15 kWh" },
   { "q": "A litre of diesel", "v": 10, "shown": "10 kWh" },
   { "q": "An electric car's battery", "v": 75, "shown": "about 75 kWh" },
   { "q": "An MMBtu of gas", "v": 293, "shown": "293 kWh" },
   { "q": "A barrel of crude oil", "v": 1700, "shown": "about 1,700 kWh (5.8 MMBtu)" },
   { "q": "An EU household's electricity for a year", "v": 3500, "shown": "about 3,500 kWh" },
   { "q": "A tonne of oil equivalent", "v": 11630, "shown": "11,630 kWh (11.6 MWh)" },
   { "q": "A tonne of hydrogen", "v": 33300, "shown": "33,300 kWh (33.3 MWh)" }
  ]
 },
 {
  "id": "power", "name": "Power, in megawatts", "unit": "MW",
  "key": "A megawatt is a million watts, a thousand kettles at once. Power is a rate: a megawatt running for an hour makes a megawatt-hour.",
  "items": [
   { "q": "A kettle", "v": 0.002, "shown": "0.002 MW (2 kW)" },
   { "q": "A Formula 1 car", "v": 0.75, "shown": "about 0.75 MW (750 kW)" },
   { "q": "A high-speed train", "v": 8, "shown": "about 8 MW" },
   { "q": "A big offshore wind turbine", "v": 15, "shown": "about 15 MW" },
   { "q": "A large data centre", "v": 100, "shown": "about 100 MW" },
   { "q": "A gas power station unit", "v": 400, "shown": "about 400 MW" },
   { "q": "A big nuclear reactor", "v": 1600, "shown": "about 1,600 MW" },
   { "q": "The Three Gorges Dam", "v": 22500, "shown": "22,500 MW" }
  ]
 },
 {
  "id": "mass", "name": "Mass, in kilograms", "unit": "kg",
  "key": "A tonne is 1,000 kg, about a cubic metre of water. Precious metals go by the troy ounce, 31.1 g.",
  "items": [
   { "q": "A troy ounce of gold", "v": 0.0311, "shown": "31.1 g" },
   { "q": "A litre of water", "v": 1, "shown": "1 kg" },
   { "q": "A London gold bar", "v": 12.4, "shown": "about 12.4 kg (400 oz)" },
   { "q": "A barrel of crude oil", "v": 136, "shown": "about 136 kg" },
   { "q": "A cubic metre of diesel", "v": 840, "shown": "about 840 kg" },
   { "q": "A small car", "v": 1200, "shown": "about 1,200 kg" },
   { "q": "A full 40-foot container", "v": 26000, "shown": "up to about 26 t" },
   { "q": "A jumbo jet's full fuel load", "v": 170000, "shown": "about 170 t" },
   { "q": "An MR tanker's cargo", "v": 37000000, "shown": "about 37,000 t" }
  ]
 },
 {
  "id": "distance", "name": "Distance, in kilometres", "unit": "km",
  "key": "A nautical mile is 1.852 km, one minute of latitude; a knot is a nautical mile an hour, so a ship at 15 knots does about 28 km/h.",
  "items": [
   { "q": "A nautical mile", "v": 1.852, "shown": "1.852 km" },
   { "q": "Dover to Calais", "v": 34, "shown": "about 34 km" },
   { "q": "The Strait of Hormuz at its narrowest", "v": 39, "shown": "about 39 km (21 nm)" },
   { "q": "A marathon", "v": 42.2, "shown": "42.2 km" },
   { "q": "The Panama Canal", "v": 82, "shown": "82 km" },
   { "q": "The Suez Canal", "v": 193, "shown": "193 km" },
   { "q": "London to New York", "v": 5570, "shown": "about 5,570 km" },
   { "q": "Rotterdam to Singapore by sea, via Suez", "v": 15400, "shown": "about 15,400 km (8,300 nm)" },
   { "q": "Round the Earth at the equator", "v": 40075, "shown": "40,075 km" }
  ]
 },
 {
  "id": "currency", "name": "Currencies, in euros", "unit": "€",
  "key": "What one unit of each currency is worth in euros, roughly. Rates move; the order hardly does.",
  "items": [
   { "q": "One Indonesian rupiah", "v": 0.000055, "shown": "about €0.00005" },
   { "q": "One South Korean won", "v": 0.00063, "shown": "about €0.0006" },
   { "q": "One Japanese yen", "v": 0.0058, "shown": "about €0.006" },
   { "q": "One Indian rupee", "v": 0.0100, "shown": "about €0.01" },
   { "q": "One Turkish lira", "v": 0.021, "shown": "about €0.02" },
   { "q": "One Swedish krona", "v": 0.09, "shown": "about €0.09" },
   { "q": "One Chinese yuan", "v": 0.12, "shown": "about €0.12" },
   { "q": "One Brazilian real", "v": 0.16, "shown": "about €0.16" },
   { "q": "One US dollar", "v": 0.86, "shown": "about €0.86" },
   { "q": "One British pound", "v": 1.15, "shown": "about €1.15" },
   { "q": "One Kuwaiti dinar", "v": 2.8, "shown": "about €2.80" }
  ]
 }
];
