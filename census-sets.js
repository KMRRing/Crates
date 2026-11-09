// Census's sets: a title, the line that asks for it, and every member, each with the other names it goes by. Written by hand and
// checked by tests/census.mjs (no two members share a name; the counts are the sets' own). A member is a name, or [name, other
// names…]. Only sets with one settled membership are here: nothing "currently" in dispute, no set whose edges are a matter of taste.
// Where two members share a word (the two Congos, Guinea and its neighbours) only the full name, or a name unique to it, counts.
const s = (id, group, title, ask, members) => ({ id, group, title, ask, items: members.map(m => (Array.isArray(m) ? { name: m[0], alt: m.slice(1) } : { name: m, alt: [] })) });

export const GROUPS = ["Geography", "Science", "History", "Culture", "Wine and trade"];

export const SETS = [
  // ---------- Geography ----------
  s("africa", "Geography", "Countries of Africa", "Name the countries of Africa.", [
    "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", ["Cabo Verde", "Cape Verde"], "Cameroon", "Central African Republic", "Chad", "Comoros",
    ["Democratic Republic of the Congo", "DR Congo", "DRC", "Congo-Kinshasa", "Congo Kinshasa"], ["Republic of the Congo", "Congo", "Congo-Brazzaville", "Congo Brazzaville"],
    ["Côte d'Ivoire", "Ivory Coast"], "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea", ["Eswatini", "Swaziland"], "Ethiopia", "Gabon", ["Gambia", "The Gambia"], "Ghana", "Guinea",
    "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria",
    "Rwanda", ["São Tomé and Príncipe", "Sao Tome", "Sao Tome and Principe"], "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Tanzania",
    "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"]),
  s("south-america", "Geography", "Countries of South America", "Name the countries of South America.", [
    "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"]),
  s("central-america", "Geography", "Countries of Central America", "Name the seven countries of Central America.", [
    "Belize", "Costa Rica", "El Salvador", "Guatemala", "Honduras", "Nicaragua", "Panama"]),
  s("eu", "Geography", "Members of the European Union", "Name the 27 members of the European Union.", [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", ["Czechia", "Czech Republic"], "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy",
    "Latvia", "Lithuania", "Luxembourg", "Malta", ["Netherlands", "Holland"], "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"]),
  s("eu-capitals", "Geography", "Capitals of the EU", "Name the capitals of the 27 members of the European Union.", [
    "Vienna", "Brussels", "Sofia", "Zagreb", "Nicosia", "Prague", "Copenhagen", "Tallinn", "Helsinki", "Paris", "Berlin", "Athens", "Budapest", "Dublin", "Rome", "Riga", "Vilnius",
    "Luxembourg", "Valletta", "Amsterdam", "Warsaw", "Lisbon", "Bucharest", "Bratislava", "Ljubljana", "Madrid", "Stockholm"]),
  s("g20", "Geography", "The G20's countries", "Name the 19 countries of the G20 (not counting the EU and the African Union).", [
    "Argentina", "Australia", "Brazil", "Canada", "China", "France", "Germany", "India", "Indonesia", "Italy", "Japan", "Mexico", "Russia", "Saudi Arabia", "South Africa",
    ["South Korea", "Korea", "Republic of Korea"], ["Turkey", "Türkiye"], ["United Kingdom", "UK", "Britain", "Great Britain"], ["United States", "USA", "US", "America", "United States of America"]]),
  s("g7", "Geography", "The G7", "Name the seven countries of the G7.", [
    "Canada", "France", "Germany", "Italy", "Japan", ["United Kingdom", "UK", "Britain", "Great Britain"], ["United States", "USA", "US", "America", "United States of America"]]),
  s("germany-borders", "Geography", "Germany's neighbours", "Name the nine countries that border Germany.", [
    "Denmark", "Poland", ["Czechia", "Czech Republic"], "Austria", "Switzerland", "France", "Luxembourg", "Belgium", ["Netherlands", "Holland"]]),
  s("nordic", "Geography", "The Nordic countries", "Name the five Nordic countries.", ["Denmark", "Finland", "Iceland", "Norway", "Sweden"]),
  s("alpine", "Geography", "The Alpine countries", "Name the eight countries of the Alps.", ["Austria", "France", "Germany", "Italy", "Liechtenstein", "Monaco", "Slovenia", "Switzerland"]),
  s("asean", "Geography", "Members of ASEAN", "Name the eleven members of ASEAN.", [
    "Brunei", "Cambodia", "Indonesia", "Laos", "Malaysia", ["Myanmar", "Burma"], "Philippines", "Singapore", "Thailand", "Vietnam", ["Timor-Leste", "East Timor", "Timor Leste"]]),
  s("cantons", "Geography", "The Swiss cantons", "Name the 26 cantons of Switzerland.", [
    ["Zürich", "Zurich"], ["Bern", "Berne"], ["Luzern", "Lucerne"], "Uri", "Schwyz", "Obwalden", "Nidwalden", "Glarus", "Zug", ["Fribourg", "Freiburg"], "Solothurn",
    ["Basel-Stadt", "Basel-City", "Basel City"], ["Basel-Landschaft", "Basel-Country", "Basel-Land", "Basel Country"], "Schaffhausen", ["Appenzell Ausserrhoden", "Ausserrhoden", "Appenzell Outer Rhodes"],
    ["Appenzell Innerrhoden", "Innerrhoden", "Appenzell Inner Rhodes"], ["St. Gallen", "St Gallen", "Sankt Gallen"], ["Graubünden", "Grisons", "Graubuenden"], "Aargau", "Thurgau",
    ["Ticino", "Tessin"], "Vaud", ["Valais", "Wallis"], ["Neuchâtel", "Neuenburg"], ["Geneva", "Genève", "Genf"], "Jura"]),
  s("laender", "Geography", "The German Länder", "Name the 16 states (Länder) of Germany.", [
    "Baden-Württemberg", ["Bavaria", "Bayern"], "Berlin", "Brandenburg", "Bremen", "Hamburg", ["Hesse", "Hessen"], ["Lower Saxony", "Niedersachsen"],
    ["Mecklenburg-Vorpommern", "Mecklenburg-Western Pomerania", "Mecklenburg"], ["North Rhine-Westphalia", "Nordrhein-Westfalen", "NRW"], ["Rhineland-Palatinate", "Rheinland-Pfalz"],
    "Saarland", ["Saxony", "Sachsen"], ["Saxony-Anhalt", "Sachsen-Anhalt"], "Schleswig-Holstein", ["Thuringia", "Thüringen"]]),
  s("us-states", "Geography", "The US states", "Name the 50 states of the United States.", [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas",
    "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas",
    "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"]),
  s("canada", "Geography", "Canada's provinces and territories", "Name the ten provinces and three territories of Canada.", [
    "Ontario", ["Quebec", "Québec"], "Nova Scotia", "New Brunswick", "Manitoba", "British Columbia", "Prince Edward Island", "Saskatchewan", "Alberta", ["Newfoundland and Labrador", "Newfoundland"],
    "Yukon", "Northwest Territories", "Nunavut"]),
  s("australia", "Geography", "Australia's states and territories", "Name the six states and two mainland territories of Australia.", [
    "New South Wales", "Victoria", "Queensland", "South Australia", "Western Australia", "Tasmania", "Northern Territory", ["Australian Capital Territory", "ACT"]]),
  s("great-lakes", "Geography", "The Great Lakes", "Name the five Great Lakes.", [["Lake Superior", "Superior"], ["Lake Michigan", "Michigan"], ["Lake Huron", "Huron"], ["Lake Erie", "Erie"], ["Lake Ontario", "Ontario"]]),
  s("oceans", "Geography", "The oceans", "Name the five oceans.", [["Pacific Ocean", "Pacific"], ["Atlantic Ocean", "Atlantic"], ["Indian Ocean", "Indian"], ["Southern Ocean", "Southern", "Antarctic Ocean"], ["Arctic Ocean", "Arctic"]]),
  s("continents", "Geography", "The continents", "Name the seven continents.", ["Africa", "Antarctica", "Asia", "Europe", "North America", ["Oceania", "Australia"], "South America"]),
  s("seven-summits", "Geography", "The Seven Summits", "Name the highest mountain of each continent, the Seven Summits.", [
    ["Everest", "Mount Everest"], ["Aconcagua", "Cerro Aconcagua"], ["Denali", "Mount McKinley", "McKinley"], ["Kilimanjaro", "Mount Kilimanjaro"], ["Elbrus", "Mount Elbrus"],
    ["Vinson Massif", "Vinson", "Mount Vinson"], ["Kosciuszko", "Mount Kosciuszko", "Carstensz Pyramid", "Puncak Jaya"]]),

  // ---------- Science ----------
  s("planets", "Science", "The planets", "Name the eight planets of the solar system.", ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]),
  s("noble-gases", "Science", "The noble gases", "Name the seven noble gases.", ["Helium", "Neon", "Argon", "Krypton", "Xenon", "Radon", "Oganesson"]),
  s("alkali", "Science", "The alkali metals", "Name the six alkali metals.", ["Lithium", "Sodium", "Potassium", "Rubidium", ["Caesium", "Cesium"], "Francium"]),
  s("halogens", "Science", "The halogens", "Name the six halogens.", ["Fluorine", "Chlorine", "Bromine", "Iodine", "Astatine", "Tennessine"]),
  s("first-20", "Science", "The first 20 elements", "Name the first 20 elements, hydrogen to calcium.", [
    "Hydrogen", "Helium", "Lithium", "Beryllium", "Boron", "Carbon", "Nitrogen", "Oxygen", "Fluorine", "Neon", "Sodium", "Magnesium", ["Aluminium", "Aluminum"], "Silicon", "Phosphorus",
    ["Sulfur", "Sulphur"], "Chlorine", "Argon", "Potassium", "Calcium"]),
  s("pgms", "Science", "The platinum group metals", "Name the six platinum group metals.", ["Ruthenium", "Rhodium", "Palladium", "Osmium", "Iridium", "Platinum"]),
  s("rainbow", "Science", "The colours of the rainbow", "Name the seven colours of the rainbow.", ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"]),
  s("greek-letters", "Science", "The Greek alphabet", "Name the 24 letters of the Greek alphabet.", [
    "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi", "Rho", "Sigma", "Tau", ["Upsilon", "Ypsilon"], "Phi", "Chi", "Psi", "Omega"]),
  s("nato", "Science", "The NATO alphabet", "Name the 26 code words of the NATO phonetic alphabet, Alfa to Zulu.", [
    ["Alfa", "Alpha"], "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", ["Juliett", "Juliet"], "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo",
    "Sierra", "Tango", "Uniform", "Victor", ["Whiskey", "Whisky"], ["X-ray", "Xray"], "Yankee", "Zulu"]),

  // ---------- History ----------
  s("wonders", "History", "The Seven Wonders of the Ancient World", "Name the Seven Wonders of the Ancient World.", [
    ["Great Pyramid of Giza", "Pyramid of Giza", "Pyramids of Giza", "Great Pyramid", "Pyramids"], ["Hanging Gardens of Babylon", "Hanging Gardens"], ["Temple of Artemis", "Temple of Artemis at Ephesus", "Artemis at Ephesus"],
    ["Statue of Zeus at Olympia", "Statue of Zeus", "Zeus at Olympia"], ["Mausoleum at Halicarnassus", "Mausoleum of Halicarnassus", "Mausoleum"], ["Colossus of Rhodes", "Colossus"],
    ["Lighthouse of Alexandria", "Pharos of Alexandria", "Pharos", "Lighthouse"]]),
  s("henry-wives", "History", "Henry VIII's wives", "Name the six wives of Henry VIII.", [
    ["Catherine of Aragon", "Katherine of Aragon", "Aragon"], ["Anne Boleyn", "Boleyn"], ["Jane Seymour", "Seymour"], ["Anne of Cleves", "Cleves"], ["Catherine Howard", "Katherine Howard", "Howard"],
    ["Catherine Parr", "Katherine Parr", "Parr"]]),
  s("tudors", "History", "The Tudor monarchs", "Name the six Tudor monarchs of England, Henry VII to Elizabeth I (counting Lady Jane Grey).", [
    "Henry VII", "Henry VIII", "Edward VI", ["Lady Jane Grey", "Jane Grey"], ["Mary I", "Mary Tudor", "Bloody Mary"], ["Elizabeth I", "Elizabeth Tudor"]]),

  // ---------- Culture ----------
  s("olympians", "Culture", "The twelve Olympians", "Name the twelve Olympian gods (Hestia and Dionysus share the twelfth place).", [
    "Zeus", "Hera", "Poseidon", "Demeter", "Athena", "Apollo", "Artemis", "Ares", "Aphrodite", "Hephaestus", "Hermes", ["Hestia", "Dionysus"]]),
  s("muses", "Culture", "The nine Muses", "Name the nine Muses.", ["Calliope", "Clio", "Erato", "Euterpe", "Melpomene", "Polyhymnia", "Terpsichore", "Thalia", "Urania"]),
  s("tragedies", "Culture", "Shakespeare's tragedies", "Name Shakespeare's ten tragedies.", [
    "Hamlet", "Macbeth", "Othello", "King Lear", "Romeo and Juliet", "Julius Caesar", "Antony and Cleopatra", "Coriolanus", "Timon of Athens", "Titus Andronicus"]),

  // ---------- Wine and trade ----------
  s("first-growths", "Wine and trade", "The Bordeaux first growths", "Name the five first growths of the 1855 Bordeaux classification.", [
    ["Château Lafite Rothschild", "Lafite Rothschild", "Lafite"], ["Château Latour", "Latour"], ["Château Margaux", "Margaux"], ["Château Haut-Brion", "Haut-Brion", "Haut Brion"],
    ["Château Mouton Rothschild", "Mouton Rothschild", "Mouton"]]),
  s("bordeaux-grapes", "Wine and trade", "The Bordeaux red grapes", "Name the six classic red grapes of Bordeaux (the five allowed today and Carménère).", [
    "Cabernet Sauvignon", "Merlot", "Cabernet Franc", "Petit Verdot", "Malbec", ["Carménère", "Carmenere"]]),
  s("base-metals", "Wine and trade", "The six classic base metals", "Name the six classic base metals traded on the London Metal Exchange.", [["Aluminium", "Aluminum"], "Copper", "Zinc", "Nickel", "Lead", "Tin"]),
];
