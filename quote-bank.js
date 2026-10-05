// Quote's bank: 175 numbers to make a market on, each with its truth, a scale and a note on the basis. Written
// October 2026 and best checked against the sources; "about" means the figure is a rounded estimate. Fields: id;
// cat (trade, cities, wine, art, people, geo, markets); q (the question); unit; truth; scale ("log": judged by
// ratio, for magnitudes; or a number: a step, for years, percentages, counts and the like); tol: the question's own
// range for "close", a ratio for magnitudes (0.15 = ±15%) and units for steps (3 = ±3 years), which sets how the
// payout falls off; note (shown after you quote).
export const CATS = { trade: "Trade", cities: "Cities", wine: "Wine", art: "Art", people: "People", geo: "Geography", markets: "Markets", refining: "Refining" };
export const QUOTES = [
{
"id": "tr-01",
"cat": "trade",
"q": "World oil consumption in 2023",
"unit": "million barrels a day",
"truth": 102,
"scale": "log",
"note": "About 102 million barrels a day in 2023 (IEA).",
"tol": 0.15
},
{
"id": "tr-02",
"cat": "trade",
"q": "Saudi Aramco's net income in 2023",
"unit": "$ billion",
"truth": 121,
"scale": "log",
"note": "$121 billion in 2023, after a record $161 billion in 2022.",
"tol": 0.15
},
{
"id": "tr-03",
"cat": "trade",
"q": "Brent's all-time high, set in July 2008",
"unit": "$ a barrel",
"truth": 147.5,
"scale": "log",
"note": "$147.50 intraday on 11 July 2008.",
"tol": 0.03
},
{
"id": "tr-04",
"cat": "trade",
"q": "The cargo a VLCC (very large crude carrier) typically carries",
"unit": "million barrels",
"truth": 2,
"scale": "log",
"note": "About 2 million barrels, roughly 300,000 tonnes deadweight.",
"tol": 0.15
},
{
"id": "tr-05",
"cat": "trade",
"q": "Length of the Suez Canal",
"unit": "km",
"truth": 193,
"scale": "log",
"note": "193 km after the 2015 expansion.",
"tol": 0.05
},
{
"id": "tr-06",
"cat": "trade",
"q": "Length of the Ever Given, the container ship that blocked the Suez Canal in 2021",
"unit": "metres",
"truth": 400,
"scale": "log",
"note": "399.94 m, one of the largest container ships afloat.",
"tol": 0.03
},
{
"id": "tr-07",
"cat": "trade",
"q": "World LNG trade in 2023",
"unit": "million tonnes",
"truth": 401,
"scale": "log",
"note": "About 401 million tonnes in 2023 (GIIGNL).",
"tol": 0.15
},
{
"id": "tr-08",
"cat": "trade",
"q": "Qatar's LNG export capacity before its North Field expansion",
"unit": "million tonnes a year",
"truth": 77,
"scale": "log",
"note": "77 million tonnes a year, heading for 126 with the North Field East and South projects.",
"tol": 0.15
},
{
"id": "tr-09",
"cat": "trade",
"q": "Oil passing through the Strait of Hormuz in 2023",
"unit": "million barrels a day",
"truth": 21,
"scale": "log",
"note": "About 21 million barrels a day in 2023 (EIA), roughly a fifth of world consumption.",
"tol": 0.15
},
{
"id": "tr-10",
"cat": "trade",
"q": "Trafigura's revenue in its 2023 financial year",
"unit": "$ billion",
"truth": 244,
"scale": "log",
"note": "$244 billion for the year to September 2023.",
"tol": 0.15
},
{
"id": "tr-11",
"cat": "trade",
"q": "Glencore's revenue in 2023",
"unit": "$ billion",
"truth": 218,
"scale": "log",
"note": "$218 billion in 2023.",
"tol": 0.15
},
{
"id": "tr-12",
"cat": "trade",
"q": "Vitol's traded crude and product volumes in 2023",
"unit": "million barrels a day",
"truth": 7.3,
"scale": "log",
"note": "About 7.3 million barrels a day in 2023.",
"tol": 0.15
},
{
"id": "tr-13",
"cat": "trade",
"q": "World sugar production in 2023/24",
"unit": "million tonnes",
"truth": 180,
"scale": "log",
"note": "About 180 million tonnes (USDA).",
"tol": 0.15
},
{
"id": "tr-14",
"cat": "trade",
"q": "The LME copper record set in May 2024",
"unit": "$ a tonne",
"truth": 11104,
"scale": "log",
"note": "$11,104.50 a tonne on 20 May 2024.",
"tol": 0.03
},
{
"id": "tr-15",
"cat": "trade",
"q": "The year gold first traded above $2,000 an ounce",
"unit": "year",
"truth": 2020,
"scale": 25,
"note": "August 2020.",
"tol": 1
},
{
"id": "tr-16",
"cat": "trade",
"q": "World cocoa production in 2022/23",
"unit": "million tonnes",
"truth": 4.9,
"scale": "log",
"note": "About 4.9 million tonnes (ICCO).",
"tol": 0.15
},
{
"id": "tr-17",
"cat": "trade",
"q": "Côte d'Ivoire's share of world cocoa production",
"unit": "%",
"truth": 40,
"scale": 10,
"note": "About 40%, the world's largest producer.",
"tol": 3
},
{
"id": "tr-18",
"cat": "trade",
"q": "Brazil's coffee crop in 2023/24",
"unit": "million 60-kg bags",
"truth": 66,
"scale": "log",
"note": "About 66 million bags (USDA).",
"tol": 0.15
},
{
"id": "tr-19",
"cat": "trade",
"q": "The year the EU carbon price (EU ETS) first passed €100 a tonne",
"unit": "year",
"truth": 2023,
"scale": 25,
"note": "February 2023.",
"tol": 1
},
{
"id": "tr-20",
"cat": "trade",
"q": "Density of diesel",
"unit": "kg per litre",
"truth": 0.84,
"scale": "log",
"note": "About 0.84 kg per litre (EN 590 allows 0.820–0.845).",
"tol": 0.02
},
{
"id": "tr-21",
"cat": "trade",
"q": "Barrels in a tonne of a typical crude oil",
"unit": "barrels",
"truth": 7.33,
"scale": "log",
"note": "About 7.33 barrels a tonne at a density of 0.86.",
"tol": 0.03
},
{
"id": "tr-22",
"cat": "trade",
"q": "Energy content of diesel",
"unit": "MJ per litre",
"truth": 35.8,
"scale": "log",
"note": "About 35.8 MJ per litre; petrol is about 32.",
"tol": 0.04
},
{
"id": "tr-23",
"cat": "trade",
"q": "The year OPEC was founded",
"unit": "year",
"truth": 1960,
"scale": 25,
"note": "Baghdad, September 1960.",
"tol": 3
},
{
"id": "tr-24",
"cat": "trade",
"q": "Cargo throughput of the port of Rotterdam in 2023",
"unit": "million tonnes",
"truth": 439,
"scale": "log",
"note": "438.8 million tonnes in 2023.",
"tol": 0.15
},
{
"id": "tr-25",
"cat": "trade",
"q": "Energy in a litre of ethanol as a share of a litre of petrol",
"unit": "%",
"truth": 67,
"scale": 10,
"note": "About 67%: ethanol holds roughly two thirds of petrol's energy by volume.",
"tol": 3
},
{
"id": "tr-26",
"cat": "trade",
"q": "RED III's 2030 target for renewables' share of transport energy (the share route)",
"unit": "%",
"truth": 29,
"scale": 5,
"note": "29% by 2030, or a 14.5% cut in greenhouse-gas intensity.",
"tol": 3
},
{
"id": "tr-27",
"cat": "trade",
"q": "Germany's THG-quota (greenhouse-gas reduction quota) for 2030",
"unit": "%",
"truth": 25,
"scale": 5,
"note": "25% in 2030 under the BImSchG.",
"tol": 3
},
{
"id": "tr-28",
"cat": "trade",
"q": "The year Trafigura was founded",
"unit": "year",
"truth": 1993,
"scale": 25,
"note": "1993, by Claude Dauphin and Eric de Turckheim.",
"tol": 2
},
{
"id": "tr-29",
"cat": "trade",
"q": "The year Marc Rich + Co, the firm that became Glencore, was founded",
"unit": "year",
"truth": 1974,
"scale": 25,
"note": "1974, in Zug.",
"tol": 3
},
{
"id": "tr-30",
"cat": "trade",
"q": "The year Vitol was founded",
"unit": "year",
"truth": 1966,
"scale": 25,
"note": "1966, in Rotterdam.",
"tol": 4
},
{
"id": "tr-31",
"cat": "trade",
"q": "The year Cargill was founded",
"unit": "year",
"truth": 1865,
"scale": 25,
"note": "1865, in Conover, Iowa.",
"tol": 6
},
{
"id": "tr-32",
"cat": "trade",
"q": "The year Louis Dreyfus was founded",
"unit": "year",
"truth": 1851,
"scale": 25,
"note": "1851, in Alsace.",
"tol": 6
},
{
"id": "tr-33",
"cat": "trade",
"q": "Capacity of a Bordeaux barrique (wine barrel)",
"unit": "litres",
"truth": 225,
"scale": "log",
"note": "225 litres; a Burgundy pièce holds 228.",
"tol": 0.03
},
{
"id": "tr-34",
"cat": "trade",
"q": "Number of OPEC member countries in 2024",
"unit": "countries",
"truth": 12,
"scale": 1,
"note": "12 after Angola left at the start of 2024.",
"tol": 1
},
{
"id": "tr-35",
"cat": "trade",
"q": "Trafigura's headcount in 2023",
"unit": "employees",
"truth": 13000,
"scale": "log",
"note": "About 13,000 at the end of the 2023 financial year.",
"tol": 0.15
},
{
"id": "ct-01",
"cat": "cities",
"q": "Population of the Tokyo urban area, the world's largest",
"unit": "million",
"truth": 37,
"scale": "log",
"note": "About 37 million (UN urban agglomeration estimate, 2024).",
"tol": 0.15
},
{
"id": "ct-02",
"cat": "cities",
"q": "Population of the Delhi urban area",
"unit": "million",
"truth": 34,
"scale": "log",
"note": "About 34 million (UN estimate, 2024).",
"tol": 0.15
},
{
"id": "ct-03",
"cat": "cities",
"q": "Population of the Shanghai urban area",
"unit": "million",
"truth": 30,
"scale": "log",
"note": "About 30 million (UN estimate, 2024).",
"tol": 0.15
},
{
"id": "ct-04",
"cat": "cities",
"q": "Population of the Lagos urban area",
"unit": "million",
"truth": 16.5,
"scale": "log",
"note": "About 16.5 million (UN estimate); Nigerian figures run higher.",
"tol": 0.15
},
{
"id": "ct-05",
"cat": "cities",
"q": "Population of the Mexico City urban area",
"unit": "million",
"truth": 22.5,
"scale": "log",
"note": "About 22.5 million (UN estimate, 2024).",
"tol": 0.15
},
{
"id": "ct-06",
"cat": "cities",
"q": "Population of Greater London at the 2021 census",
"unit": "million",
"truth": 8.8,
"scale": "log",
"note": "8.8 million in 2021.",
"tol": 0.15
},
{
"id": "ct-07",
"cat": "cities",
"q": "Population of New York City (the five boroughs) in 2023",
"unit": "million",
"truth": 8.3,
"scale": "log",
"note": "About 8.3 million (2023 estimate).",
"tol": 0.15
},
{
"id": "ct-08",
"cat": "cities",
"q": "Population of the city of Paris (within the périphérique)",
"unit": "million",
"truth": 2.1,
"scale": "log",
"note": "About 2.1 million; the metropolitan area has over 12 million.",
"tol": 0.15
},
{
"id": "ct-09",
"cat": "cities",
"q": "Population of the city of Geneva in 2023",
"unit": "people",
"truth": 204000,
"scale": "log",
"note": "About 204,000; the canton has about 520,000.",
"tol": 0.1
},
{
"id": "ct-10",
"cat": "cities",
"q": "Population of Berlin in 2023",
"unit": "million",
"truth": 3.8,
"scale": "log",
"note": "About 3.8 million.",
"tol": 0.15
},
{
"id": "ct-11",
"cat": "cities",
"q": "Population of Istanbul in 2023",
"unit": "million",
"truth": 15.7,
"scale": "log",
"note": "About 15.7 million (TurkStat).",
"tol": 0.15
},
{
"id": "ct-12",
"cat": "cities",
"q": "Population of Singapore in 2023, residents and non-residents",
"unit": "million",
"truth": 5.9,
"scale": "log",
"note": "About 5.9 million.",
"tol": 0.15
},
{
"id": "ct-13",
"cat": "cities",
"q": "Population of Dubai in 2023",
"unit": "million",
"truth": 3.6,
"scale": "log",
"note": "About 3.6 million.",
"tol": 0.15
},
{
"id": "ct-14",
"cat": "cities",
"q": "Altitude of La Paz, Bolivia's seat of government",
"unit": "metres",
"truth": 3640,
"scale": "log",
"note": "About 3,640 m, the highest capital in the world.",
"tol": 0.05
},
{
"id": "ct-15",
"cat": "cities",
"q": "Road distance from Geneva to Zurich",
"unit": "km",
"truth": 277,
"scale": "log",
"note": "About 277 km by the A1.",
"tol": 0.08
},
{
"id": "ct-16",
"cat": "cities",
"q": "Height of the Shanghai Tower",
"unit": "metres",
"truth": 632,
"scale": "log",
"note": "632 m, the tallest building in China.",
"tol": 0.03
},
{
"id": "ct-17",
"cat": "cities",
"q": "Height of the Burj Khalifa",
"unit": "metres",
"truth": 828,
"scale": "log",
"note": "828 m, the tallest building in the world since 2010.",
"tol": 0.02
},
{
"id": "ct-18",
"cat": "cities",
"q": "Altitude of Mexico City",
"unit": "metres",
"truth": 2240,
"scale": "log",
"note": "About 2,240 m.",
"tol": 0.05
},
{
"id": "ct-19",
"cat": "cities",
"q": "Population of Tallinn in 2023",
"unit": "people",
"truth": 455000,
"scale": "log",
"note": "About 455,000.",
"tol": 0.1
},
{
"id": "ct-20",
"cat": "cities",
"q": "Population of Venice's historic centre (the islands) in 2023",
"unit": "people",
"truth": 49000,
"scale": "log",
"note": "About 49,000, below 50,000 since 2022.",
"tol": 0.15
},
{
"id": "ct-21",
"cat": "cities",
"q": "Latitude of Shanghai",
"unit": "degrees north",
"truth": 31.2,
"scale": 5,
"note": "About 31.2°N, about the same as Cairo and New Orleans.",
"tol": 2
},
{
"id": "ct-22",
"cat": "cities",
"q": "Population of Estonia in 2024",
"unit": "million",
"truth": 1.37,
"scale": "log",
"note": "About 1.37 million.",
"tol": 0.05
},
{
"id": "ct-23",
"cat": "cities",
"q": "Population of Switzerland in 2023",
"unit": "million",
"truth": 8.9,
"scale": "log",
"note": "About 8.9 million.",
"tol": 0.05
},
{
"id": "ct-24",
"cat": "cities",
"q": "Population of the Cairo urban area",
"unit": "million",
"truth": 22.6,
"scale": "log",
"note": "About 22.6 million (UN estimate, 2024).",
"tol": 0.15
},
{
"id": "ct-25",
"cat": "cities",
"q": "Area of Switzerland",
"unit": "km²",
"truth": 41285,
"scale": "log",
"note": "41,285 km².",
"tol": 0.03
},
{
"id": "ct-26",
"cat": "cities",
"q": "Area of Lake Geneva",
"unit": "km²",
"truth": 580,
"scale": "log",
"note": "About 580 km², the largest lake in the Alps.",
"tol": 0.1
},
{
"id": "ct-27",
"cat": "cities",
"q": "Number of metro lines in Shanghai in 2024",
"unit": "lines",
"truth": 19,
"scale": 1,
"note": "19 lines, the world's longest metro network by route length.",
"tol": 1
},
{
"id": "ct-28",
"cat": "cities",
"q": "Height of Mont Blanc",
"unit": "metres",
"truth": 4806,
"scale": "log",
"note": "4,806 m (4,805.59 m at the 2023 survey).",
"tol": 0.01
},
{
"id": "wn-01",
"cat": "wine",
"q": "The record price for a single bottle of wine at auction: a 1945 Romanée-Conti, Sotheby's 2018",
"unit": "$",
"truth": 558000,
"scale": "log",
"note": "$558,000 in New York, October 2018.",
"tol": 0.15
},
{
"id": "wn-02",
"cat": "wine",
"q": "Champagne bottles shipped in 2023",
"unit": "million bottles",
"truth": 299,
"scale": "log",
"note": "About 299 million (Comité Champagne), down from 326 million in 2022.",
"tol": 0.1
},
{
"id": "wn-03",
"cat": "wine",
"q": "Capacity of a Nebuchadnezzar",
"unit": "litres",
"truth": 15,
"scale": "log",
"note": "15 litres, twenty standard bottles.",
"tol": 0.1
},
{
"id": "wn-04",
"cat": "wine",
"q": "Capacity of a Methuselah",
"unit": "litres",
"truth": 6,
"scale": "log",
"note": "6 litres, eight standard bottles.",
"tol": 0.1
},
{
"id": "wn-05",
"cat": "wine",
"q": "The year of the Bordeaux classification that created the First Growths",
"unit": "year",
"truth": 1855,
"scale": 25,
"note": "1855, for the Paris Exposition Universelle.",
"tol": 4
},
{
"id": "wn-06",
"cat": "wine",
"q": "Number of First Growths in the Médoc classification today",
"unit": "châteaux",
"truth": 5,
"scale": 1,
"note": "Five: Lafite, Latour, Margaux, Haut-Brion and, since 1973, Mouton Rothschild.",
"tol": 0.5
},
{
"id": "wn-07",
"cat": "wine",
"q": "The year Mouton Rothschild was promoted to First Growth",
"unit": "year",
"truth": 1973,
"scale": 25,
"note": "1973, the only change ever made to the 1855 classification.",
"tol": 3
},
{
"id": "wn-08",
"cat": "wine",
"q": "The year of the Judgment of Paris, when Californian wines beat French in a blind tasting",
"unit": "year",
"truth": 1976,
"scale": 25,
"note": "1976, organised by Steven Spurrier.",
"tol": 3
},
{
"id": "wn-09",
"cat": "wine",
"q": "Area of the Romanée-Conti vineyard",
"unit": "hectares",
"truth": 1.8,
"scale": "log",
"note": "1.81 hectares, producing around 5,000 bottles a year.",
"tol": 0.1
},
{
"id": "wn-10",
"cat": "wine",
"q": "World wine production in 2023",
"unit": "million hectolitres",
"truth": 237,
"scale": "log",
"note": "About 237 million hectolitres (OIV), the smallest since 1961.",
"tol": 0.08
},
{
"id": "wn-11",
"cat": "wine",
"q": "France's wine production in 2023",
"unit": "million hectolitres",
"truth": 48,
"scale": "log",
"note": "About 48 million hectolitres, the most of any country that year.",
"tol": 0.12
},
{
"id": "wn-12",
"cat": "wine",
"q": "Number of Grand Cru vineyards in Burgundy",
"unit": "vineyards",
"truth": 33,
"scale": 1,
"note": "33, including Chablis Grand Cru.",
"tol": 2
},
{
"id": "wn-13",
"cat": "wine",
"q": "Typical alcohol content of Champagne",
"unit": "% ABV",
"truth": 12.5,
"scale": 1,
"note": "About 12.5%.",
"tol": 0.5
},
{
"id": "wn-14",
"cat": "wine",
"q": "Typical alcohol content of Port",
"unit": "% ABV",
"truth": 20,
"scale": 2,
"note": "About 20%, fortified with grape spirit.",
"tol": 0.5
},
{
"id": "wn-15",
"cat": "wine",
"q": "The year the Napa Valley AVA (American Viticultural Area) was established",
"unit": "year",
"truth": 1981,
"scale": 25,
"note": "1981, California's first AVA.",
"tol": 3
},
{
"id": "wn-16",
"cat": "wine",
"q": "Slope of the Bremmer Calmont on the Mosel, Europe's steepest vineyard",
"unit": "degrees",
"truth": 65,
"scale": 5,
"note": "About 65 degrees.",
"tol": 5
},
{
"id": "wn-17",
"cat": "wine",
"q": "Pinot Noir's share of Champagne's vineyard area",
"unit": "%",
"truth": 38,
"scale": 10,
"note": "About 38%, with Meunier and Chardonnay about 31% each.",
"tol": 3
},
{
"id": "wn-18",
"cat": "wine",
"q": "Bottles of Château Pétrus made in a typical year",
"unit": "bottles",
"truth": 30000,
"scale": "log",
"note": "Roughly 30,000 bottles from about 11.5 hectares.",
"tol": 0.4
},
{
"id": "wn-19",
"cat": "wine",
"q": "Vineyard area of Bordeaux in 2022",
"unit": "hectares",
"truth": 110000,
"scale": "log",
"note": "About 110,000 hectares, before the grubbing-up schemes of 2023–24.",
"tol": 0.15
},
{
"id": "wn-20",
"cat": "wine",
"q": "Number of standard bottles in a case",
"unit": "bottles",
"truth": 12,
"scale": 1,
"note": "12 bottles of 75 cl: 9 litres.",
"tol": 0.5
},
{
"id": "wn-21",
"cat": "wine",
"q": "The year the first Beaujolais Nouveau release date was fixed (the third Thursday in November)",
"unit": "year",
"truth": 1985,
"scale": 25,
"note": "1985.",
"tol": 4
},
{
"id": "wn-22",
"cat": "wine",
"q": "Italy's vineyard area in 2023",
"unit": "thousand hectares",
"truth": 720,
"scale": "log",
"note": "About 720,000 hectares (OIV), second to Spain.",
"tol": 0.2
},
{
"id": "wn-23",
"cat": "wine",
"q": "Spain's vineyard area in 2023, the world's largest",
"unit": "thousand hectares",
"truth": 930,
"scale": "log",
"note": "About 930,000 hectares (OIV).",
"tol": 0.2
},
{
"id": "ar-01",
"cat": "art",
"q": "Price of Leonardo's Salvator Mundi at Christie's in 2017, the most paid for any artwork",
"unit": "$ million",
"truth": 450.3,
"scale": "log",
"note": "$450.3 million, November 2017.",
"tol": 0.05
},
{
"id": "ar-02",
"cat": "art",
"q": "The year Picasso painted Guernica",
"unit": "year",
"truth": 1937,
"scale": 25,
"note": "1937, after the bombing of Guernica in April that year.",
"tol": 2
},
{
"id": "ar-03",
"cat": "art",
"q": "Width of Guernica",
"unit": "metres",
"truth": 7.77,
"scale": "log",
"note": "3.49 m by 7.77 m.",
"tol": 0.05
},
{
"id": "ar-04",
"cat": "art",
"q": "Height of the Mona Lisa",
"unit": "cm",
"truth": 77,
"scale": "log",
"note": "77 cm by 53 cm: smaller than most people expect.",
"tol": 0.06
},
{
"id": "ar-05",
"cat": "art",
"q": "Visitors to the Louvre in 2023",
"unit": "million",
"truth": 8.9,
"scale": "log",
"note": "About 8.9 million, the most visited museum in the world.",
"tol": 0.2
},
{
"id": "ar-06",
"cat": "art",
"q": "The year the Louvre opened as a public museum",
"unit": "year",
"truth": 1793,
"scale": 25,
"note": "1793, during the Revolution.",
"tol": 5
},
{
"id": "ar-07",
"cat": "art",
"q": "Number of paintings Van Gogh is usually said to have sold in his lifetime",
"unit": "paintings",
"truth": 1,
"scale": 1,
"note": "One, The Red Vineyard, in 1890; the count is debated but this is the usual answer.",
"tol": 0.5
},
{
"id": "ar-08",
"cat": "art",
"q": "Estimated number of works Picasso made in his lifetime",
"unit": "works",
"truth": 50000,
"scale": "log",
"note": "Around 50,000, including paintings, drawings, prints, ceramics and sculpture.",
"tol": 0.4
},
{
"id": "ar-09",
"cat": "art",
"q": "The year of the first Venice Biennale",
"unit": "year",
"truth": 1895,
"scale": 25,
"note": "1895.",
"tol": 4
},
{
"id": "ar-10",
"cat": "art",
"q": "Height of Michelangelo's David",
"unit": "metres",
"truth": 5.17,
"scale": "log",
"note": "5.17 m, without the plinth.",
"tol": 0.05
},
{
"id": "ar-11",
"cat": "art",
"q": "The year Michelangelo finished the Sistine Chapel ceiling",
"unit": "year",
"truth": 1512,
"scale": 25,
"note": "1512, begun in 1508.",
"tol": 6
},
{
"id": "ar-12",
"cat": "art",
"q": "Price of Jeff Koons's Rabbit in 2019, the record for a living artist at auction",
"unit": "$ million",
"truth": 91.1,
"scale": "log",
"note": "$91.1 million at Christie's, May 2019.",
"tol": 0.08
},
{
"id": "ar-13",
"cat": "art",
"q": "Price of Banksy's Love is in the Bin in 2021, the shredded work",
"unit": "£ million",
"truth": 18.6,
"scale": "log",
"note": "£18.6 million at Sotheby's, October 2021.",
"tol": 0.1
},
{
"id": "ar-14",
"cat": "art",
"q": "Width of Rembrandt's The Night Watch",
"unit": "cm",
"truth": 437,
"scale": "log",
"note": "363 cm by 437 cm.",
"tol": 0.06
},
{
"id": "ar-15",
"cat": "art",
"q": "Price of Rothko's Orange, Red, Yellow in 2012",
"unit": "$ million",
"truth": 86.9,
"scale": "log",
"note": "$86.9 million at Christie's, May 2012.",
"tol": 0.08
},
{
"id": "ar-16",
"cat": "art",
"q": "The year Van Gogh painted The Starry Night",
"unit": "year",
"truth": 1889,
"scale": 25,
"note": "1889, at the asylum in Saint-Rémy.",
"tol": 2
},
{
"id": "ar-17",
"cat": "art",
"q": "Number of paintings generally attributed to Vermeer",
"unit": "paintings",
"truth": 35,
"scale": 1,
"note": "About 35, depending on which attributions you accept.",
"tol": 2
},
{
"id": "ar-18",
"cat": "art",
"q": "The year Tate Modern opened",
"unit": "year",
"truth": 2000,
"scale": 25,
"note": "2000, in the former Bankside power station.",
"tol": 1
},
{
"id": "ar-19",
"cat": "art",
"q": "Price of Munch's The Scream (the 1895 pastel) in 2012",
"unit": "$ million",
"truth": 119.9,
"scale": "log",
"note": "$119.9 million at Sotheby's, May 2012.",
"tol": 0.08
},
{
"id": "ar-20",
"cat": "art",
"q": "Height of the Statue of Liberty, from her feet to the torch",
"unit": "metres",
"truth": 46,
"scale": "log",
"note": "46 m; 93 m including the pedestal.",
"tol": 0.08
},
{
"id": "ar-21",
"cat": "art",
"q": "The year Hokusai published The Great Wave off Kanagawa",
"unit": "year",
"truth": 1831,
"scale": 25,
"note": "About 1831, in Thirty-six Views of Mount Fuji.",
"tol": 6
},
{
"id": "ar-22",
"cat": "art",
"q": "Price of Klimt's Lady with a Fan in 2023, the European auction record",
"unit": "£ million",
"truth": 85.3,
"scale": "log",
"note": "£85.3 million at Sotheby's London, June 2023.",
"tol": 0.08
},
{
"id": "ar-23",
"cat": "art",
"q": "Age of the Lascaux cave paintings",
"unit": "years",
"truth": 17000,
"scale": "log",
"note": "About 17,000 years.",
"tol": 0.2
},
{
"id": "ar-24",
"cat": "art",
"q": "Price of Basquiat's Untitled (1982) skull painting in 2017",
"unit": "$ million",
"truth": 110.5,
"scale": "log",
"note": "$110.5 million at Sotheby's, May 2017.",
"tol": 0.08
},
{
"id": "ar-25",
"cat": "art",
"q": "The year Leonardo da Vinci died",
"unit": "year",
"truth": 1519,
"scale": 25,
"note": "1519, at Amboise in France.",
"tol": 6
},
{
"id": "ar-26",
"cat": "art",
"q": "Number of Vermeer paintings shown at the Rijksmuseum's 2023 exhibition, the largest ever",
"unit": "paintings",
"truth": 28,
"scale": 1,
"note": "28 of the roughly 35 known.",
"tol": 2
},
{
"id": "pp-01",
"cat": "people",
"q": "Warren Buffett's age in October 2026",
"unit": "years",
"truth": 96,
"scale": 10,
"note": "Born 30 August 1930.",
"tol": 2
},
{
"id": "pp-02",
"cat": "people",
"q": "Age at which Alexander the Great died",
"unit": "years",
"truth": 32,
"scale": 10,
"note": "32, in Babylon in 323 BC.",
"tol": 2
},
{
"id": "pp-03",
"cat": "people",
"q": "Einstein's annus mirabilis, the year of his special relativity and photoelectric papers",
"unit": "year",
"truth": 1905,
"scale": 25,
"note": "1905.",
"tol": 2
},
{
"id": "pp-04",
"cat": "people",
"q": "Number of Nobel Prizes won by Marie Curie",
"unit": "prizes",
"truth": 2,
"scale": 1,
"note": "Two: physics in 1903 and chemistry in 1911.",
"tol": 0.5
},
{
"id": "pp-05",
"cat": "people",
"q": "Number of children Johann Sebastian Bach had",
"unit": "children",
"truth": 20,
"scale": 1,
"note": "20, from two marriages; ten survived to adulthood.",
"tol": 2
},
{
"id": "pp-06",
"cat": "people",
"q": "Age at which Mozart died",
"unit": "years",
"truth": 35,
"scale": 10,
"note": "35, in December 1791.",
"tol": 2
},
{
"id": "pp-07",
"cat": "people",
"q": "Number of symphonies Beethoven completed",
"unit": "symphonies",
"truth": 9,
"scale": 1,
"note": "Nine.",
"tol": 0.5
},
{
"id": "pp-08",
"cat": "people",
"q": "Length of Queen Elizabeth II's reign",
"unit": "years",
"truth": 70,
"scale": 10,
"note": "70 years, from 1952 to 2022.",
"tol": 2
},
{
"id": "pp-09",
"cat": "people",
"q": "The year Winston Churchill was born",
"unit": "year",
"truth": 1874,
"scale": 25,
"note": "1874, at Blenheim Palace.",
"tol": 4
},
{
"id": "pp-10",
"cat": "people",
"q": "Age of Malala Yousafzai when she won the Nobel Peace Prize, the youngest laureate ever",
"unit": "years",
"truth": 17,
"scale": 10,
"note": "17, in 2014.",
"tol": 2
},
{
"id": "pp-11",
"cat": "people",
"q": "The year Vasco da Gama reached India by sea",
"unit": "year",
"truth": 1498,
"scale": 25,
"note": "1498, landing at Calicut.",
"tol": 8
},
{
"id": "pp-12",
"cat": "people",
"q": "The year Magellan's expedition completed the first circumnavigation",
"unit": "year",
"truth": 1522,
"scale": 25,
"note": "1522, under Elcano; Magellan had died in the Philippines in 1521.",
"tol": 8
},
{
"id": "pp-13",
"cat": "people",
"q": "Number of plays usually credited to Shakespeare",
"unit": "plays",
"truth": 37,
"scale": 1,
"note": "37 by the usual count; some say 38 or 39.",
"tol": 1
},
{
"id": "pp-14",
"cat": "people",
"q": "Age at which Steve Jobs died",
"unit": "years",
"truth": 56,
"scale": 10,
"note": "56, in 2011.",
"tol": 2
},
{
"id": "pp-15",
"cat": "people",
"q": "The year Ivan Glasenberg became chief executive of Glencore",
"unit": "year",
"truth": 2002,
"scale": 25,
"note": "2002; he stepped down in 2021.",
"tol": 2
},
{
"id": "pp-16",
"cat": "people",
"q": "The year Jeremy Weir became chief executive of Trafigura",
"unit": "year",
"truth": 2014,
"scale": 25,
"note": "2014.",
"tol": 2
},
{
"id": "pp-17",
"cat": "people",
"q": "Age at which Rembrandt died",
"unit": "years",
"truth": 63,
"scale": 10,
"note": "63, in 1669.",
"tol": 2
},
{
"id": "pp-18",
"cat": "people",
"q": "Elon Musk's year of birth",
"unit": "year",
"truth": 1971,
"scale": 25,
"note": "1971, in Pretoria.",
"tol": 2
},
{
"id": "pp-19",
"cat": "people",
"q": "Number of children of Genghis Khan's line said to be alive today, in the 2003 genetic study",
"unit": "million men",
"truth": 16,
"scale": "log",
"note": "About 16 million men carry the Y-chromosome lineage, about 0.5% of men worldwide.",
"tol": 0.3
},
{
"id": "pp-20",
"cat": "people",
"q": "Age at which Napoleon died",
"unit": "years",
"truth": 51,
"scale": 10,
"note": "51, on Saint Helena in 1821.",
"tol": 2
},
{
"id": "pp-21",
"cat": "people",
"q": "Nobel Prize money in 2023",
"unit": "million Swedish kronor",
"truth": 11,
"scale": "log",
"note": "11 million kronor, about $1 million.",
"tol": 0.1
},
{
"id": "pp-22",
"cat": "people",
"q": "The year Marie Curie was born",
"unit": "year",
"truth": 1867,
"scale": 25,
"note": "1867, in Warsaw.",
"tol": 4
},
{
"id": "pp-23",
"cat": "people",
"q": "Age at which Pablo Picasso died",
"unit": "years",
"truth": 91,
"scale": 10,
"note": "91, in 1973.",
"tol": 2
},
{
"id": "ge-01",
"cat": "geo",
"q": "Height of Everest",
"unit": "metres",
"truth": 8849,
"scale": "log",
"note": "8,848.86 m by the 2020 survey.",
"tol": 0.01
},
{
"id": "ge-02",
"cat": "geo",
"q": "Length of the Nile",
"unit": "km",
"truth": 6650,
"scale": "log",
"note": "About 6,650 km.",
"tol": 0.05
},
{
"id": "ge-03",
"cat": "geo",
"q": "Circumference of the Earth at the equator",
"unit": "km",
"truth": 40075,
"scale": "log",
"note": "40,075 km.",
"tol": 0.01
},
{
"id": "ge-04",
"cat": "geo",
"q": "Average distance from the Earth to the Moon",
"unit": "km",
"truth": 384400,
"scale": "log",
"note": "384,400 km.",
"tol": 0.02
},
{
"id": "ge-05",
"cat": "geo",
"q": "Depth of the Challenger Deep, the deepest point in the oceans",
"unit": "metres",
"truth": 10935,
"scale": "log",
"note": "About 10,935 m.",
"tol": 0.03
},
{
"id": "ge-06",
"cat": "geo",
"q": "Speed of sound in air at sea level",
"unit": "metres a second",
"truth": 343,
"scale": "log",
"note": "343 m/s at 20 °C.",
"tol": 0.03
},
{
"id": "ge-07",
"cat": "geo",
"q": "Number of member states of the United Nations",
"unit": "countries",
"truth": 193,
"scale": 1,
"note": "193.",
"tol": 2
},
{
"id": "ge-08",
"cat": "geo",
"q": "Number of member states of the European Union",
"unit": "countries",
"truth": 27,
"scale": 1,
"note": "27 since the UK left in 2020.",
"tol": 1
},
{
"id": "ge-09",
"cat": "geo",
"q": "Length of the Rhine",
"unit": "km",
"truth": 1233,
"scale": "log",
"note": "About 1,233 km.",
"tol": 0.08
},
{
"id": "ge-10",
"cat": "geo",
"q": "Area of the Sahara",
"unit": "million km²",
"truth": 9.2,
"scale": "log",
"note": "About 9.2 million km², roughly the size of China.",
"tol": 0.06
},
{
"id": "ge-11",
"cat": "geo",
"q": "Average discharge of the Amazon at its mouth",
"unit": "thousand cubic metres a second",
"truth": 209,
"scale": "log",
"note": "About 209,000 m³/s, about a fifth of all river water reaching the oceans.",
"tol": 0.06
},
{
"id": "ge-12",
"cat": "geo",
"q": "Boiling point of water at the top of Everest",
"unit": "°C",
"truth": 71,
"scale": 10,
"note": "About 71 °C.",
"tol": 3
},
{
"id": "ge-13",
"cat": "geo",
"q": "Length of the Panama Canal",
"unit": "km",
"truth": 82,
"scale": "log",
"note": "About 82 km.",
"tol": 0.06
},
{
"id": "ge-14",
"cat": "geo",
"q": "Distance from Geneva to Shanghai as the crow flies",
"unit": "km",
"truth": 9000,
"scale": "log",
"note": "About 9,000 km.",
"tol": 0.06
},
{
"id": "ge-15",
"cat": "geo",
"q": "Area of Estonia",
"unit": "km²",
"truth": 45339,
"scale": "log",
"note": "45,339 km².",
"tol": 0.05
},
{
"id": "ge-16",
"cat": "geo",
"q": "Length of the Great Wall of China, all sections, by the 2012 survey",
"unit": "km",
"truth": 21196,
"scale": "log",
"note": "21,196 km in the 2012 survey.",
"tol": 0.1
},
{
"id": "ge-17",
"cat": "geo",
"q": "Height of the Eiffel Tower, to the tip",
"unit": "metres",
"truth": 330,
"scale": "log",
"note": "330 m with its antennas.",
"tol": 0.02
},
{
"id": "ge-18",
"cat": "geo",
"q": "Surface area of Lake Baikal",
"unit": "km²",
"truth": 31722,
"scale": "log",
"note": "31,722 km², holding about a fifth of the world's unfrozen fresh water.",
"tol": 0.1
},
{
"id": "ge-19",
"cat": "geo",
"q": "Deepest point of Lake Geneva",
"unit": "metres",
"truth": 310,
"scale": "log",
"note": "About 310 m.",
"tol": 0.06
},
{
"id": "ge-20",
"cat": "geo",
"q": "Age of the universe",
"unit": "billion years",
"truth": 13.8,
"scale": "log",
"note": "About 13.8 billion years.",
"tol": 0.03
},
{
"id": "mk-01",
"cat": "markets",
"q": "United States GDP in 2023",
"unit": "$ trillion",
"truth": 27.4,
"scale": "log",
"note": "About $27.4 trillion.",
"tol": 0.06
},
{
"id": "mk-02",
"cat": "markets",
"q": "China's GDP in 2023",
"unit": "$ trillion",
"truth": 17.8,
"scale": "log",
"note": "About $17.8 trillion.",
"tol": 0.08
},
{
"id": "mk-03",
"cat": "markets",
"q": "Germany's GDP in 2023",
"unit": "$ trillion",
"truth": 4.5,
"scale": "log",
"note": "About $4.5 trillion, the third largest in the world that year.",
"tol": 0.08
},
{
"id": "mk-04",
"cat": "markets",
"q": "Switzerland's GDP in 2023",
"unit": "$ billion",
"truth": 885,
"scale": "log",
"note": "About $885 billion.",
"tol": 0.1
},
{
"id": "mk-05",
"cat": "markets",
"q": "The year Apple first closed with a market value above $3 trillion",
"unit": "year",
"truth": 2023,
"scale": 25,
"note": "June 2023 (it had touched $3 trillion in trading in January 2022).",
"tol": 1
},
{
"id": "mk-06",
"cat": "markets",
"q": "The S&P 500's closing level at the end of 2023",
"unit": "points",
"truth": 4770,
"scale": "log",
"note": "4,769.83 on 29 December 2023.",
"tol": 0.03
},
{
"id": "mk-07",
"cat": "markets",
"q": "The year US federal debt first passed $35 trillion",
"unit": "year",
"truth": 2024,
"scale": 25,
"note": "July 2024.",
"tol": 1
},
{
"id": "mk-08",
"cat": "markets",
"q": "The year a Berkshire Hathaway class A share first traded above $500,000",
"unit": "year",
"truth": 2022,
"scale": 25,
"note": "March 2022.",
"tol": 1
},
{
"id": "mk-09",
"cat": "markets",
"q": "The UK national living wage from April 2024",
"unit": "£ an hour",
"truth": 11.44,
"scale": "log",
"note": "£11.44 an hour.",
"tol": 0.03
},
{
"id": "mk-10",
"cat": "markets",
"q": "The year the euro notes and coins entered circulation",
"unit": "year",
"truth": 2002,
"scale": 25,
"note": "1 January 2002.",
"tol": 1
},
{
"id": "mk-11",
"cat": "markets",
"q": "The year of the Black Monday crash, the biggest one-day percentage fall in US stocks",
"unit": "year",
"truth": 1987,
"scale": 25,
"note": "19 October 1987: the Dow fell 22.6%.",
"tol": 1
},
{
"id": "mk-12",
"cat": "markets",
"q": "The Dow Jones's fall on Black Monday in 1987",
"unit": "%",
"truth": 22.6,
"scale": 10,
"note": "22.6% in one day.",
"tol": 3
},
{
"id": "mk-13",
"cat": "markets",
"q": "The year Lehman Brothers collapsed",
"unit": "year",
"truth": 2008,
"scale": 25,
"note": "15 September 2008.",
"tol": 1
},
{
"id": "mk-14",
"cat": "markets",
"q": "Number of companies in the Swiss Market Index (SMI)",
"unit": "companies",
"truth": 20,
"scale": 1,
"note": "20.",
"tol": 1
},
{
"id": "mk-15",
"cat": "markets",
"q": "Number of companies in the FTSE 100",
"unit": "companies",
"truth": 100,
"scale": 1,
"note": "100, as the name says.",
"tol": 0.5
},
{
"id": "mk-16",
"cat": "markets",
"q": "The year the Swiss National Bank dropped the franc's cap against the euro",
"unit": "year",
"truth": 2015,
"scale": 25,
"note": "15 January 2015.",
"tol": 1
},
{
"id": "mk-17",
"cat": "markets",
"q": "The year Bitcoin was launched",
"unit": "year",
"truth": 2009,
"scale": 25,
"note": "January 2009.",
"tol": 1
},
{
"id": "mk-18",
"cat": "markets",
"q": "Switzerland's population per square kilometre",
"unit": "people",
"truth": 215,
"scale": "log",
"note": "About 215 people per km².",
"tol": 0.1
},
{
"id": "mk-19",
"cat": "markets",
"q": "The year the Shanghai Stock Exchange reopened",
"unit": "year",
"truth": 1990,
"scale": 25,
"note": "1990.",
"tol": 2
},
{
"id": "mk-20",
"cat": "markets",
"q": "Japan's public debt as a share of GDP in 2023",
"unit": "%",
"truth": 250,
"scale": 25,
"note": "About 250%, the highest of any major economy.",
"tol": 3
},
{
"id": "rf-01",
"cat": "refining",
"q": "Crude capacity of the Jamnagar refinery complex, the world's largest",
"unit": "million barrels a day",
"truth": 1.24,
"scale": "log",
"tol": 0.08,
"note": "About 1.24 million barrels a day across its two refineries."
},
{
"id": "rf-02",
"cat": "refining",
"q": "Typical yield of gasoline-range naphtha from an FCC, as a share of feed",
"unit": "%",
"truth": 48,
"scale": 1,
"tol": 5,
"note": "Around 45–50% by volume, the unit's main product."
},
{
"id": "rf-03",
"cat": "refining",
"q": "Hydrogen a hydrocracker typically consumes",
"unit": "scf per barrel of feed",
"truth": 2000,
"scale": "log",
"tol": 0.25,
"note": "About 1,500–2,500 scf a barrel, the refinery's biggest hydrogen user."
},
{
"id": "rf-04",
"cat": "refining",
"q": "Hydrogen a catalytic reformer typically makes",
"unit": "scf per barrel of feed",
"truth": 1000,
"scale": "log",
"tol": 0.25,
"note": "About 800–1,200 scf a barrel: the refinery's own hydrogen supply."
},
{
"id": "rf-05",
"cat": "refining",
"q": "The sulphur limit for road diesel and petrol in the EU",
"unit": "ppm",
"truth": 10,
"scale": 1,
"tol": 2,
"note": "10 ppm since 2009."
},
{
"id": "rf-06",
"cat": "refining",
"q": "The sulphur limit for marine fuel under IMO 2020, outside emission control areas",
"unit": "%",
"truth": 0.5,
"scale": 1,
"tol": 0.1,
"note": "0.5%, down from 3.5%, from 1 January 2020."
},
{
"id": "rf-07",
"cat": "refining",
"q": "Minimum cetane number for EN 590 diesel",
"unit": "cetane",
"truth": 51,
"scale": 1,
"tol": 2,
"note": "51."
},
{
"id": "rf-08",
"cat": "refining",
"q": "Research octane of a typical reformate",
"unit": "RON",
"truth": 100,
"scale": 1,
"tol": 3,
"note": "About 98–102, the pool's octane backbone."
},
{
"id": "rf-09",
"cat": "refining",
"q": "Research octane of straight-run light naphtha",
"unit": "RON",
"truth": 70,
"scale": 1,
"tol": 4,
"note": "About 65–72: too low to blend as it is."
},
{
"id": "rf-10",
"cat": "refining",
"q": "Cetane number of light cycle oil from an FCC",
"unit": "cetane",
"truth": 25,
"scale": 1,
"tol": 4,
"note": "About 20–30: aromatic, and a drag on the diesel pool."
},
{
"id": "rf-11",
"cat": "refining",
"q": "The maximum FAME content of EN 590 diesel (B7)",
"unit": "%",
"truth": 7,
"scale": 1,
"tol": 1,
"note": "7% by volume."
},
{
"id": "rf-12",
"cat": "refining",
"q": "The maximum ethanol content of E10 petrol",
"unit": "%",
"truth": 10,
"scale": 1,
"tol": 1,
"note": "10% by volume."
},
{
"id": "rf-13",
"cat": "refining",
"q": "Hydrogen an HVO unit typically consumes",
"unit": "scf per barrel of feed",
"truth": 3000,
"scale": "log",
"tol": 0.25,
"note": "About 2,500–3,500 scf a barrel: oxygen removal and saturation."
},
{
"id": "rf-14",
"cat": "refining",
"q": "Typical HVO yield from vegetable oil, by volume",
"unit": "%",
"truth": 85,
"scale": 1,
"tol": 4,
"note": "About 85%, plus propane, naphtha and water."
},
{
"id": "rf-15",
"cat": "refining",
"q": "Operating temperature of a crude distillation furnace outlet",
"unit": "°C",
"truth": 360,
"scale": 1,
"tol": 20,
"note": "About 350–370 °C: hotter and the crude cracks."
},
{
"id": "rf-16",
"cat": "refining",
"q": "Share of a typical FCC feed that ends up as coke on the catalyst",
"unit": "%",
"truth": 5,
"scale": 1,
"tol": 1.5,
"note": "About 4–6%, burned off in the regenerator to heat the unit."
},
{
"id": "rf-17",
"cat": "refining",
"q": "Typical pressure of a hydrocracker",
"unit": "bar",
"truth": 150,
"scale": "log",
"tol": 0.2,
"note": "About 100–200 bar."
},
{
"id": "rf-18",
"cat": "refining",
"q": "Number of oil refineries operating in Europe (EU plus the UK and Norway) in 2023",
"unit": "refineries",
"truth": 80,
"scale": "log",
"tol": 0.12,
"note": "About 80, down from over 100 in 2009."
},
{
"id": "rf-19",
"cat": "refining",
"q": "Global refining capacity in 2023",
"unit": "million barrels a day",
"truth": 103,
"scale": "log",
"tol": 0.05,
"note": "About 103 million barrels a day."
},
{
"id": "rf-20",
"cat": "refining",
"q": "The Nelson complexity index of a simple hydroskimming refinery",
"unit": "index",
"truth": 3,
"scale": 1,
"tol": 1,
"note": "About 2–4; a coking refinery scores 10 or more."
},
{
"id": "rf-21",
"cat": "refining",
"q": "Typical propylene yield from an FCC",
"unit": "%",
"truth": 5,
"scale": 1,
"tol": 1.5,
"note": "About 4–6% by volume, more with ZSM-5 additive."
},
{
"id": "rf-22",
"cat": "refining",
"q": "Research octane of alkylate",
"unit": "RON",
"truth": 95,
"scale": 1,
"tol": 3,
"note": "About 93–97, with low vapour pressure and no aromatics."
},
{
"id": "rf-23",
"cat": "refining",
"q": "Typical density of HVO",
"unit": "kg/m³",
"truth": 780,
"scale": 1,
"tol": 10,
"note": "About 780 kg/m³, below the EN 590 minimum of 820 for pure diesel."
},
{
"id": "rf-24",
"cat": "refining",
"q": "Typical petroleum coke yield from a delayed coker on vacuum residue",
"unit": "%",
"truth": 25,
"scale": 1,
"tol": 4,
"note": "About 20–30% by weight."
}
];
