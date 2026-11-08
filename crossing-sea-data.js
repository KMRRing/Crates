// Crossing's sea: the data (crossing-sea-engine.js turns it into the game). A small, hand-kept graph, not a chart of every
// lane: the waters ships must pass (straits, capes, canals, the open sea between), the lanes between them, the ports on
// them and the inland places that reach a port by river or road. Only settled facts; no rail, no pipelines (Korbi, 9 Nov 2026).
// Distances are not typed in: a lane is as long as the great circle between its two waters (so a water sits on the lane, not
// beside it), and tests/crossing-sea.mjs holds the result to known figures (Rotterdam-Singapore about 8,300 nm by Suez and
// about 11,700 round the Cape; New York-Los Angeles about 5,400 by Panama).

/** Waters: id → [name, lon, lat, kind]. kind "strait" and "canal" are marked on the board; "cape" a headland. */
export const WATERS = {
  nsea: ["North Sea", 3.3, 52.8], ger: ["German Bight", 7.5, 54.2], skag: ["Skagerrak", 9.5, 57.8, "strait"],
  belt: ["Danish Straits", 10.8, 55.4, "strait"], balt: ["Baltic Sea", 19, 56], gfin: ["Gulf of Finland", 24.5, 59.6],
  dover: ["Strait of Dover", 1.5, 51, "strait"], chan: ["English Channel", -1, 50], wapp: ["Western Approaches", -6, 49],
  irsea: ["Irish Sea", -5, 53.3], biscay: ["Bay of Biscay", -7, 45.5], iberia: ["Cape St Vincent", -9.5, 36.8, "cape"],
  gibr: ["Strait of Gibraltar", -5.6, 35.95, "strait"], alb: ["Balearic Sea", 2.5, 39.5], ligur: ["Ligurian Sea", 8.5, 43],
  tyrr: ["Tyrrhenian Sea", 11, 39.5], sicily: ["Strait of Sicily", 11.5, 37.3, "strait"], adri: ["Adriatic Sea", 14, 43],
  otran: ["Strait of Otranto", 19, 40, "strait"], ionian: ["Ionian Sea", 18.5, 36.5], aegean: ["Aegean Sea", 25, 38],
  dard: ["Dardanelles", 26.4, 40.2, "strait"], bosph: ["Bosphorus", 29.1, 41.2, "strait"], black: ["Black Sea", 33, 43.5],
  emed: ["Eastern Mediterranean", 31, 34], psaid: ["Port Said (Suez Canal)", 32.3, 31.3, "canal"],
  suezs: ["Suez (Gulf of Suez)", 32.55, 29.95, "canal"], red: ["Red Sea", 37.5, 20.5], babm: ["Bab-el-Mandeb", 43.4, 12.65, "strait"],
  aden: ["Gulf of Aden", 48, 12.5], dhofar: ["Dhofar coast", 54, 15], arab: ["Arabian Sea", 62, 16], goman: ["Gulf of Oman", 59, 23.5],
  hormuz: ["Strait of Hormuz", 56.5, 26.4, "strait"], pgulf: ["Persian Gulf", 51, 27], gkutch: ["Gulf of Kutch", 67.5, 23],
  indw: ["Indian west coast", 71.5, 18.5], cochin: ["Kerala coast", 75.5, 9.5], sl: ["South of Sri Lanka", 80.5, 5.2],
  chennai: ["Coromandel coast", 81.2, 13], bengal: ["Bay of Bengal", 88, 13.5], hooghly: ["Head of the Bay", 89, 20],
  andam: ["Andaman Sea", 96, 7], malacca: ["Strait of Malacca", 101, 2.5, "strait"], sing: ["Singapore Strait", 104, 1.2, "strait"],
  gthai: ["Gulf of Thailand", 102, 9.5], scs: ["South China Sea", 112, 12], tonkin: ["Gulf of Tonkin", 108, 19],
  hk: ["Pearl River approaches", 114.5, 21.5], luzon: ["Luzon coast", 119, 14], luzonst: ["Luzon Strait", 121, 20.5, "strait"],
  taiw: ["Taiwan Strait", 119.5, 24.5, "strait"], ecs: ["East China Sea", 123, 30], yellow: ["Yellow Sea", 122.5, 37.5],
  korea: ["Korea Strait", 129.5, 34.3, "strait"], jpn: ["Japan Pacific coast", 141, 34], phsea: ["Philippine Sea", 131, 13],
  carol: ["Western Pacific", 150, 8], celeb: ["Celebes Sea", 122, 3.5], makas: ["Makassar Strait", 118, -1, "strait"],
  javasea: ["Java Sea", 112, -5.5], karim: ["Karimata Strait", 108.5, -2.5, "strait"], sunda: ["Sunda Strait", 105.8, -6.2, "strait"],
  lombok: ["Lombok Strait", 115.7, -9, "strait"], indse: ["Southeast Indian Ocean", 95, -6], indmid: ["Central Indian Ocean", 70, -18],
  nwaus: ["Northwest Australia", 116, -19], swaus: ["Southwest Australia", 114, -34], gab: ["Great Australian Bight", 130, -37],
  bass: ["Bass Strait", 147, -39.5, "strait"], sydn: ["Off Sydney", 152.5, -34], bris: ["Off Brisbane", 155, -27.5],
  coral: ["Coral Sea", 157, -12], tasman: ["Tasman Sea", 165, -36], auck: ["Off Auckland", 174.5, -36.5],
  spac: ["South Pacific", -135, -22], npac: ["North Pacific", -165, 45], pnw: ["Pacific Northwest", -125, 47.5],
  calif: ["California coast", -120.5, 33.5], mexp: ["Mexican Pacific coast", -106, 19], cam: ["Central American coast", -90, 11],
  panp: ["Gulf of Panama", -79.5, 8.2], pcol: ["Colombian Pacific", -79, 5], ecu: ["Off Ecuador", -81, -3],
  peru: ["Peruvian coast", -78, -12], nchile: ["Northern Chile", -72, -21], chile: ["Central Chile", -74, -36],
  chs: ["Southern Chile", -76, -50], horn: ["Cape Horn", -67, -56, "cape"], patag: ["Patagonian coast", -62, -47],
  plata: ["Río de la Plata", -55, -35.5], brse: ["Southeast Brazil", -44.5, -25], brmid: ["Brazilian east coast", -36, -14],
  brne: ["Northeast Brazil", -34, -5], satl: ["South Atlantic", -6, -12], cape: ["Cape of Good Hope", 18.5, -35.3, "cape"],
  namib: ["Namibian coast", 12, -24], angola: ["Angolan coast", 11, -9], bonny: ["Bight of Biafra", 6, 3.2],
  gulfg: ["Gulf of Guinea", 1, 4], gwest: ["Ivory Coast", -6, 4], guin: ["Guinea coast", -12, 7], wafr: ["Off Dakar", -18, 14],
  canary: ["Canary Islands", -16, 28], atln: ["North Atlantic", -35, 45], scotia: ["Off Nova Scotia", -62, 43],
  useast: ["US East Coast", -73.5, 40], uss: ["US Southeast", -78, 32], flstr: ["Straits of Florida", -80, 25, "strait"],
  gulfmex: ["Gulf of Mexico", -90, 25], campeche: ["Bay of Campeche", -93, 21], yuc: ["Yucatán Channel", -85.5, 21.8, "strait"],
  windw: ["Windward Passage", -74, 19.8, "strait"], lant: ["Lesser Antilles", -61, 13], carib: ["Caribbean Sea", -76, 14],
  panatl: ["Colón (Panama Canal)", -79.9, 9.4, "canal"], natal: ["Off Durban", 32, -30.5], mozch: ["Mozambique Channel", 40.5, -21],
  eaf: ["East African coast", 41.5, -5],
};

/** Tolls in the board's one unit (a nautical mile of steaming): what a transit costs beyond its distance. */
export const TOLLS = { "psaid-suezs": 400, "panatl-panp": 600 };
/** Lanes between waters; a lane's length is the great circle between the two (see the file header). */
export const LANES = `nsea-dover nsea-ger ger-skag skag-belt belt-balt balt-gfin dover-chan chan-wapp wapp-irsea wapp-biscay wapp-atln
biscay-iberia iberia-gibr iberia-canary gibr-alb alb-sicily alb-ligur ligur-tyrr tyrr-sicily sicily-ionian ionian-otran otran-adri
ionian-aegean ionian-emed aegean-emed aegean-dard dard-bosph bosph-black emed-psaid psaid-suezs suezs-red red-babm babm-aden
aden-dhofar dhofar-arab arab-goman goman-hormuz hormuz-pgulf arab-gkutch gkutch-indw arab-indw arab-sl indw-cochin cochin-sl sl-chennai
chennai-bengal sl-bengal bengal-hooghly sl-andam bengal-andam andam-malacca malacca-sing sing-gthai sing-scs gthai-scs scs-tonkin
scs-hk scs-luzon scs-luzonst hk-taiw taiw-luzonst luzon-luzonst taiw-ecs ecs-yellow ecs-korea yellow-korea korea-jpn ecs-jpn
luzonst-phsea luzonst-jpn useast-brmid phsea-jpn phsea-carol carol-jpn carol-coral coral-bris bris-sydn sydn-bass sydn-tasman tasman-auck bass-gab gab-swaus
swaus-nwaus nwaus-lombok swaus-indmid nwaus-indmid swaus-cape lombok-javasea lombok-makas javasea-makas javasea-karim karim-sunda
karim-sing sunda-indse indse-lombok indse-indmid indse-sl indmid-cape indmid-natal makas-celeb celeb-phsea jpn-npac npac-calif
npac-pnw pnw-calif calif-mexp mexp-cam cam-panp panp-pcol pcol-ecu ecu-peru peru-nchile nchile-chile chile-chs chs-horn horn-patag
patag-plata plata-brse brse-brmid brmid-brne brne-satl satl-cape satl-canary canary-wafr wafr-guin guin-gwest gwest-gulfg gulfg-bonny
gulfg-angola bonny-angola angola-namib namib-cape canary-lant canary-brne atln-lant lant-carib lant-brne useast-lant windw-carib
useast-windw uss-useast flstr-uss flstr-yuc flstr-gulfmex yuc-carib yuc-gulfmex yuc-campeche campeche-gulfmex carib-panatl
panatl-panp atln-scotia atln-useast scotia-useast spac-auck spac-panp spac-peru spac-chs cape-natal natal-mozch mozch-eaf eaf-aden
eaf-arab cape-brse`.split(/\s+/).map(s => s.split("-"));

/** Ports: [name, country (as chart-countries.js names it), lon, lat (the seaward end of the approach), water, river nm to the quay]. */
export const PORTS = [
  ["Rotterdam", "Netherlands", 3.9, 52, "nsea", 20], ["Antwerp", "Belgium", 3.2, 51.4, "dover", 45], ["Hamburg", "Germany", 8, 54, "ger", 70],
  ["Felixstowe", "United Kingdom", 1.4, 51.9, "dover"], ["Southampton", "United Kingdom", -1.3, 50.7, "chan"],
  ["Liverpool", "United Kingdom", -3.2, 53.5, "irsea"], ["Dublin", "Ireland", -6.1, 53.3, "irsea"], ["Le Havre", "France", 0.1, 49.5, "chan"],
  ["Bilbao", "Spain", -3.1, 43.4, "biscay"], ["Lisbon", "Portugal", -9.2, 38.6, "iberia"], ["Algeciras", "Spain", -5.4, 36.1, "gibr"],
  ["Valencia", "Spain", -0.3, 39.4, "alb"], ["Barcelona", "Spain", 2.2, 41.3, "alb"], ["Marseille", "France", 5.3, 43.2, "ligur"],
  ["Genoa", "Italy", 8.9, 44.4, "ligur"], ["Trieste", "Italy", 13.7, 45.6, "adri"], ["Koper", "Slovenia", 13.7, 45.5, "adri"],
  ["Rijeka", "Croatia", 14.4, 45.3, "adri"], ["Tunis", "Tunisia", 10.3, 36.8, "sicily"], ["Piraeus", "Greece", 23.6, 37.9, "aegean"],
  ["Thessaloniki", "Greece", 23, 40.5, "aegean"], ["Istanbul", "Turkey", 28.7, 40.95, "bosph"], ["Constanța", "Romania", 28.7, 44.1, "black"],
  ["Odesa", "Ukraine", 30.8, 46.4, "black"], ["Novorossiysk", "Russia", 37.8, 44.7, "black"], ["Alexandria", "Egypt", 29.9, 31.2, "emed"],
  ["Haifa", "Israel", 35, 32.8, "emed"], ["Mersin", "Turkey", 34.6, 36.7, "emed"], ["Jeddah", "Saudi Arabia", 39.1, 21.5, "red"],
  ["Port Sudan", "Sudan", 37.2, 19.6, "red"], ["Djibouti", "Djibouti", 43.1, 11.6, "babm"], ["Aden", "Yemen", 45, 12.8, "aden"],
  ["Salalah", "Oman", 54, 17, "dhofar"], ["Muscat", "Oman", 58.6, 23.6, "goman"], ["Fujairah", "United Arab Emirates", 56.4, 25.1, "goman"],
  ["Chabahar", "Iran", 60.6, 25.3, "goman"], ["Bandar Abbas", "Iran", 56.3, 27.1, "hormuz"], ["Jebel Ali", "United Arab Emirates", 55, 25, "hormuz"],
  ["Dammam", "Saudi Arabia", 50.2, 26.5, "pgulf"], ["Kuwait", "Kuwait", 48, 29.3, "pgulf"], ["Umm Qasr", "Iraq", 48.5, 29.8, "pgulf", 50],
  ["Karachi", "Pakistan", 66.9, 24.8, "gkutch"], ["Mundra", "India", 69.7, 22.7, "gkutch"], ["Mumbai", "India", 72.9, 18.9, "indw"],
  ["Cochin", "India", 76.2, 9.9, "cochin"], ["Colombo", "Sri Lanka", 79.8, 6.9, "sl"], ["Chennai", "India", 80.3, 13.1, "chennai"],
  ["Kolkata", "India", 88.3, 22, "hooghly", 70], ["Chittagong", "Bangladesh", 91.8, 22.3, "hooghly"], ["Port Klang", "Malaysia", 101.3, 3, "malacca"],
  ["Singapore", "Singapore", 103.9, 1.2, "sing"], ["Laem Chabang", "Thailand", 100.9, 13, "gthai"], ["Sihanoukville", "Cambodia", 103.5, 10.6, "gthai"],
  ["Ho Chi Minh City", "Vietnam", 107, 10.4, "scs"], ["Da Nang", "Vietnam", 108.2, 16.1, "scs"], ["Haiphong", "Vietnam", 106.8, 20.7, "tonkin"],
  ["Jakarta", "Indonesia", 106.9, -6, "sunda"], ["Surabaya", "Indonesia", 112.7, -7.2, "javasea", 30], ["Hong Kong", "China", 114.2, 22.3, "hk"],
  ["Shenzhen", "China", 114.3, 22.5, "hk"], ["Guangzhou", "China", 113.5, 23, "hk", 60], ["Xiamen", "China", 118, 24.4, "taiw"],
  ["Kaohsiung", "Taiwan", 120.3, 22.5, "taiw"], ["Manila", "Philippines", 120.9, 14.5, "luzon"], ["Shanghai", "China", 121.9, 30.6, "ecs", 20],
  ["Ningbo", "China", 122, 29.9, "ecs"], ["Qingdao", "China", 120.4, 36, "yellow"], ["Dalian", "China", 121.7, 38.9, "yellow"],
  ["Tianjin", "China", 117.8, 39, "yellow"], ["Busan", "South Korea", 129, 35, "korea"], ["Tokyo", "Japan", 139.8, 35.6, "jpn"],
  ["Fremantle", "Australia", 115.7, -32.1, "swaus"], ["Port Hedland", "Australia", 118.6, -20.3, "nwaus"], ["Melbourne", "Australia", 144.9, -37.8, "bass"],
  ["Sydney", "Australia", 151.2, -33.9, "sydn"], ["Brisbane", "Australia", 153.1, -27.4, "bris"], ["Auckland", "New Zealand", 174.8, -36.8, "auck"],
  ["Vancouver", "Canada", -123.1, 49.3, "pnw"], ["Seattle", "United States", -122.3, 47.6, "pnw"], ["Los Angeles", "United States", -118.2, 33.7, "calif"],
  ["Manzanillo", "Mexico", -104.3, 19, "mexp"], ["Balboa", "Panama", -79.6, 8.9, "panp"], ["Buenaventura", "Colombia", -77.1, 3.9, "pcol"],
  ["Guayaquil", "Ecuador", -79.9, -2.3, "ecu", 40], ["Callao", "Peru", -77.2, -12, "peru"], ["Arica", "Chile", -70.3, -18.5, "nchile"],
  ["Antofagasta", "Chile", -70.4, -23.6, "nchile"], ["Valparaíso", "Chile", -71.6, -33, "chile"], ["Buenos Aires", "Argentina", -58.4, -34.6, "plata", 120],
  ["Montevideo", "Uruguay", -56.2, -34.9, "plata"], ["Santos", "Brazil", -46.3, -24, "brse"], ["Rio de Janeiro", "Brazil", -43.2, -22.9, "brse"],
  ["Salvador", "Brazil", -38.5, -13, "brmid"], ["Recife", "Brazil", -34.9, -8, "brne"], ["Cartagena", "Colombia", -75.5, 10.4, "carib"],
  ["Kingston", "Jamaica", -76.8, 17.9, "carib"], ["Colón", "Panama", -79.9, 9.4, "panatl"], ["Port of Spain", "Trinidad and Tobago", -61.5, 10.7, "lant"],
  ["Veracruz", "Mexico", -96.1, 19.2, "campeche"], ["Houston", "United States", -94.7, 29.3, "gulfmex", 50], ["New Orleans", "United States", -89.2, 29, "gulfmex", 100],
  ["Savannah", "United States", -81, 32, "uss"], ["New York", "United States", -74, 40.5, "useast", 15], ["Halifax", "Canada", -63.5, 44.6, "scotia"],
  ["Dakar", "Senegal", -17.4, 14.7, "wafr"], ["Conakry", "Guinea", -13.7, 9.5, "guin"], ["Abidjan", "Côte d'Ivoire", -4, 5.2, "gwest"],
  ["Tema", "Ghana", 0, 5.6, "gulfg"], ["Lomé", "Togo", 1.3, 6.1, "gulfg"], ["Lagos", "Nigeria", 3.4, 6.2, "gulfg"], ["Douala", "Cameroon", 9.6, 3.9, "bonny"],
  ["Luanda", "Angola", 13.2, -8.9, "angola"], ["Walvis Bay", "Namibia", 14.5, -23, "namib"], ["Cape Town", "South Africa", 18.4, -33.9, "cape"],
  ["Durban", "South Africa", 31, -29.9, "natal"], ["Maputo", "Mozambique", 32.7, -26, "natal"], ["Beira", "Mozambique", 34.9, -19.8, "mozch"],
  ["Dar es Salaam", "Tanzania", 39.3, -6.8, "eaf"], ["Mombasa", "Kenya", 39.7, -4.1, "eaf"], ["Gothenburg", "Sweden", 11.9, 57.7, "skag"],
  ["Gdańsk", "Poland", 18.7, 54.4, "balt"], ["Klaipėda", "Lithuania", 21.1, 55.7, "balt"], ["Tallinn", "Estonia", 24.8, 59.5, "gfin"],
  ["Helsinki", "Finland", 25, 60.2, "gfin"], ["St Petersburg", "Russia", 30, 59.9, "gfin", 20],
];

/** Inland places: [name, country, lon, lat, [[port, km, "barge" | "road"], ...]]. Barge where the river carries cargo (Rhine,
 *  Danube, Elbe, Rhône, Yangtze, Mississippi, Mekong, Río de la Plata); the km are rounded road or river distances. */
export const INLAND = [
  ["Basel", "Switzerland", 7.6, 47.6, [["Rotterdam", 830, "barge"], ["Genoa", 400, "road"], ["Marseille", 560, "road"]]],
  ["Vienna", "Austria", 16.4, 48.2, [["Constanța", 1430, "barge"], ["Trieste", 380, "road"], ["Hamburg", 1000, "road"]]],
  ["Budapest", "Hungary", 19.1, 47.5, [["Constanța", 1680, "barge"], ["Rijeka", 500, "road"], ["Gdańsk", 850, "road"]]],
  ["Prague", "Czech Republic", 14.4, 50.1, [["Hamburg", 650, "barge"], ["Rotterdam", 900, "road"], ["Koper", 700, "road"]]],
  ["Warsaw", "Poland", 21, 52.2, [["Gdańsk", 340, "road"], ["Hamburg", 700, "road"], ["Constanța", 1000, "road"]]],
  ["Frankfurt", "Germany", 8.7, 50.1, [["Rotterdam", 540, "barge"], ["Hamburg", 490, "road"], ["Genoa", 780, "road"]]],
  ["Munich", "Germany", 11.6, 48.1, [["Genoa", 640, "road"], ["Trieste", 550, "road"], ["Hamburg", 780, "road"], ["Rotterdam", 800, "road"]]],
  ["Belgrade", "Serbia", 20.5, 44.8, [["Constanța", 1200, "barge"], ["Thessaloniki", 560, "road"], ["Rijeka", 620, "road"]]],
  ["Kyiv", "Ukraine", 30.5, 50.5, [["Odesa", 480, "road"], ["Gdańsk", 1150, "road"], ["Constanța", 850, "road"]]],
  ["Minsk", "Belarus", 27.6, 53.9, [["Klaipėda", 520, "road"], ["Gdańsk", 640, "road"], ["Odesa", 1100, "road"]]],
  ["Moscow", "Russia", 37.6, 55.8, [["St Petersburg", 710, "road"], ["Novorossiysk", 1500, "road"], ["Tallinn", 1000, "road"]]],
  ["Madrid", "Spain", -3.7, 40.4, [["Valencia", 350, "road"], ["Lisbon", 625, "road"], ["Bilbao", 400, "road"], ["Barcelona", 620, "road"]]],
  ["Lyon", "France", 4.8, 45.8, [["Marseille", 315, "barge"], ["Le Havre", 700, "road"], ["Barcelona", 640, "road"]]],
  ["Milan", "Italy", 9.2, 45.5, [["Genoa", 150, "road"], ["Trieste", 410, "road"], ["Marseille", 540, "road"]]],
  ["Lusaka", "Zambia", 28.3, -15.4, [["Durban", 1900, "road"], ["Dar es Salaam", 1900, "road"], ["Beira", 1600, "road"], ["Walvis Bay", 2000, "road"]]],
  ["Harare", "Zimbabwe", 31, -17.8, [["Beira", 590, "road"], ["Maputo", 1100, "road"], ["Durban", 1450, "road"]]],
  ["Johannesburg", "South Africa", 28, -26.2, [["Durban", 570, "road"], ["Maputo", 550, "road"], ["Cape Town", 1400, "road"]]],
  ["Kampala", "Uganda", 32.6, 0.3, [["Mombasa", 1170, "road"], ["Dar es Salaam", 1450, "road"]]],
  ["Addis Ababa", "Ethiopia", 38.7, 9, [["Djibouti", 780, "road"], ["Mombasa", 1600, "road"], ["Port Sudan", 1500, "road"]]],
  ["Bamako", "Mali", -8, 12.6, [["Dakar", 1250, "road"], ["Abidjan", 1150, "road"], ["Conakry", 900, "road"]]],
  ["Ouagadougou", "Burkina Faso", -1.5, 12.4, [["Abidjan", 1150, "road"], ["Tema", 1000, "road"], ["Lomé", 1000, "road"]]],
  ["Chongqing", "China", 106.6, 29.6, [["Shanghai", 2400, "barge"], ["Guangzhou", 1450, "road"], ["Haiphong", 1700, "road"]]],
  ["Wuhan", "China", 114.3, 30.6, [["Shanghai", 1100, "barge"], ["Guangzhou", 1050, "road"], ["Qingdao", 1100, "road"]]],
  ["Ulaanbaatar", "Mongolia", 106.9, 47.9, [["Tianjin", 1650, "road"], ["Dalian", 2000, "road"]]],
  ["Kabul", "Afghanistan", 69.2, 34.5, [["Karachi", 1400, "road"], ["Chabahar", 1600, "road"], ["Bandar Abbas", 2400, "road"]]],
  ["Delhi", "India", 77.2, 28.6, [["Mundra", 1150, "road"], ["Mumbai", 1400, "road"], ["Kolkata", 1500, "road"], ["Chennai", 2200, "road"]]],
  ["Dhaka", "Bangladesh", 90.4, 23.8, [["Chittagong", 250, "road"], ["Kolkata", 450, "road"]]],
  ["Tehran", "Iran", 51.4, 35.7, [["Bandar Abbas", 1350, "road"], ["Chabahar", 2150, "road"]]],
  ["Riyadh", "Saudi Arabia", 46.7, 24.7, [["Dammam", 400, "road"], ["Jeddah", 950, "road"], ["Jebel Ali", 1000, "road"]]],
  ["Baghdad", "Iraq", 44.4, 33.3, [["Umm Qasr", 550, "road"], ["Kuwait", 650, "road"], ["Mersin", 1150, "road"]]],
  ["Phnom Penh", "Cambodia", 104.9, 11.6, [["Sihanoukville", 230, "road"], ["Ho Chi Minh City", 330, "barge"], ["Laem Chabang", 690, "road"]]],
  ["Vientiane", "Laos", 102.6, 17.97, [["Laem Chabang", 650, "road"], ["Da Nang", 800, "road"], ["Haiphong", 1000, "road"]]],
  ["Mexico City", "Mexico", -99.1, 19.4, [["Veracruz", 400, "road"], ["Manzanillo", 700, "road"], ["Houston", 1450, "road"]]],
  ["Bogotá", "Colombia", -74.1, 4.7, [["Cartagena", 1000, "road"], ["Buenaventura", 520, "road"]]],
  ["La Paz", "Bolivia", -68.1, -16.5, [["Arica", 450, "road"], ["Antofagasta", 1050, "road"], ["Callao", 1500, "road"]]],
  ["Asunción", "Paraguay", -57.6, -25.3, [["Buenos Aires", 1450, "barge"], ["Santos", 1900, "road"], ["Montevideo", 1600, "road"]]],
  ["Brasília", "Brazil", -47.9, -15.8, [["Santos", 1000, "road"], ["Rio de Janeiro", 1150, "road"], ["Salvador", 1450, "road"]]],
  ["Mendoza", "Argentina", -68.8, -32.9, [["Valparaíso", 360, "road"], ["Buenos Aires", 1050, "road"]]],
  ["Memphis", "United States", -90, 35.1, [["New Orleans", 1030, "barge"], ["Houston", 900, "road"], ["Savannah", 1060, "road"]]],
  ["Chicago", "United States", -87.6, 41.9, [["New Orleans", 2400, "barge"], ["New York", 1150, "road"], ["Houston", 1500, "road"]]],
  ["Denver", "United States", -105, 39.7, [["Los Angeles", 1650, "road"], ["Houston", 1400, "road"], ["Seattle", 2100, "road"]]],
  ["Calgary", "Canada", -114.1, 51, [["Vancouver", 970, "road"], ["Seattle", 1250, "road"]]],
  ["Canberra", "Australia", 149.1, -35.3, [["Sydney", 290, "road"], ["Melbourne", 650, "road"], ["Brisbane", 1200, "road"]]],
];
