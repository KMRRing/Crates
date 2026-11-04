// The History of trade course's own places: [id, name, latitude, longitude]. Places that kb/ already has (the trade-place, trade-history
// and geo-place entities) are not repeated here; the course reads them by id from trade-kb.js, a copy tests/trade.mjs checks against kb/.
// Coordinates are to about half a degree: they place a dot on a map of a sea or a continent, not a survey point. A site whose position is
// argued (Punt) is not given one.
export const OWN = [
  // 1. the first exchanges
  ["gollu-dag", "Göllü Dağ (obsidian)", 38.25, 34.55], ["uruk", "Uruk", 31.32, 45.64], ["ur", "Ur", 30.96, 46.1], ["dilmun", "Dilmun (Bahrain)", 26.0, 50.55],
  ["mohenjo-daro", "Mohenjo-daro", 27.33, 68.14], ["kanesh", "Kanesh (Kültepe)", 38.85, 35.63], ["assur", "Assur", 35.46, 43.26], ["uluburun", "Uluburun wreck", 36.13, 29.68],
  ["cyprus", "Cyprus", 35.0, 33.2], ["hattusa", "Hattusa", 40.02, 34.61], ["thebes", "Thebes", 25.7, 32.64], ["deir-el-bahari", "Deir el-Bahari", 25.74, 32.61],
  ["amarna", "Amarna", 27.65, 30.9], ["babylon", "Babylon", 32.54, 44.42], ["la-venta", "La Venta (Olmec)", 18.1, -94.04], ["obsidian-highlands", "Mexican highland obsidian", 19.7, -98.8],
  // 2. monsoon and desert
  ["muziris", "Muziris", 10.2, 76.2], ["berenike", "Berenike", 23.9, 35.5], ["alexandria", "Alexandria", 31.2, 29.9], ["adulis", "Adulis", 15.25, 39.65],
  ["aksum", "Aksum", 14.13, 38.72], ["barygaza", "Barygaza", 21.7, 72.99], ["oc-eo", "Oc Eo", 10.25, 105.15],
  ["madagascar", "Madagascar", -19.0, 47.0], ["dhofar", "Dhofar (frankincense)", 17.0, 54.1], ["arikamedu", "Arikamedu", 11.9, 79.8],
  // 3. silk roads
  ["chang-an", "Chang'an", 34.27, 108.94], ["dunhuang", "Dunhuang", 40.14, 94.66], ["merv", "Merv", 37.66, 62.19], ["ferghana", "Ferghana", 40.4, 71.8],
  ["balkh", "Bactra (Balkh)", 36.75, 66.9], ["khotan", "Khotan", 37.11, 79.92], ["turfan", "Turfan", 42.95, 89.18], ["luoyang", "Luoyang", 34.62, 112.45],
  ["constantinople", "Constantinople", 41.01, 28.98], ["talas", "Talas", 42.5, 71.2], ["bamiyan", "Bamiyan", 34.82, 67.82],
  // 4. the Islamic hub
  ["baghdad", "Baghdad", 33.31, 44.37], ["basra", "Basra", 30.5, 47.8], ["siraf", "Siraf", 27.67, 52.35],
  ["belitung", "Belitung wreck", -2.9, 107.9], ["mangalore", "Mangalore", 12.9, 74.85], ["aden", "Aden", 12.78, 45.03], ["fustat", "Fustat (old Cairo)", 30.0, 31.23],
  // 5. Africa
  ["sijilmasa", "Sijilmasa", 31.3, -4.27], ["awdaghust", "Awdaghust", 18.6, -10.9], ["taghaza", "Taghaza", 23.6, -5.5], ["gao", "Gao", 16.27, -0.04],
  ["niani", "Niani (Mali)", 11.4, -9.2], ["jenne", "Jenne", 13.9, -4.55], ["kilwa", "Kilwa", -8.96, 39.52], ["sofala", "Sofala", -20.2, 34.7],
  ["great-zimbabwe", "Great Zimbabwe", -20.27, 30.93], ["mogadishu", "Mogadishu", 2.05, 45.32], ["mecca", "Mecca", 21.42, 39.83], ["maldives", "The Maldives", 4.2, 73.5],
  ["bengal", "Bengal", 23.0, 89.5], ["tripoli", "Tripoli", 32.9, 13.18],
  // 6. maritime Asia
  ["palembang", "Palembang (Srivijaya)", -2.98, 104.75], ["quanzhou", "Quanzhou", 24.9, 118.6], ["sunda-strait", "Sunda Strait", -6.0, 105.9], ["ternate", "Ternate", 0.79, 127.38],
  ["nagapattinam", "Nagapattinam", 10.77, 79.84], ["malindi", "Malindi", -3.22, 40.12], ["naha", "Naha (Ryukyu)", 26.2, 127.68],
  ["cambay", "Cambay", 22.3, 72.62],
  // 7. Mongols, plague, Europe
  ["karakorum", "Karakorum", 47.2, 102.8], ["sarai", "Sarai", 48.7, 44.5], ["caffa", "Caffa", 45.03, 35.38], ["tabriz", "Tabriz", 38.08, 46.3],
  ["khanbaliq", "Khanbaliq (Beijing)", 39.9, 116.4], ["bruges", "Bruges", 51.21, 3.22], ["genoa", "Genoa", 44.41, 8.93],
  ["venice", "Venice", 45.44, 12.33],
  // 8. the Americas before 1492
  ["tenochtitlan", "Tenochtitlan and Tlatelolco", 19.43, -99.13], ["soconusco", "Soconusco", 15.0, -92.3], ["santa-ana-la-florida", "Santa Ana-La Florida", -4.38, -78.8],
  ["cuzco", "Cuzco", -13.52, -71.97], ["chan-chan", "Chan Chan", -8.11, -79.07], ["chaco-canyon", "Chaco Canyon", 36.06, -107.96], ["cahokia", "Cahokia", 38.66, -90.06],
  ["lanse-aux-meadows", "L'Anse aux Meadows", 51.6, -55.53], ["salango", "Salango (Spondylus coast)", -1.6, -80.85], ["west-mexico", "West Mexico (metallurgy)", 20.0, -103.0],
  ["greenland-norse", "Norse Greenland", 61.2, -45.4], ["amazon-ecuador", "Upper Amazon (Ecuador)", -4.0, -78.5],
  // 9. 1492 to 1650
  ["acapulco", "Acapulco", 16.85, -99.9],
  ["veracruz", "Veracruz", 19.2, -96.13], ["cartagena", "Cartagena de Indias", 10.4, -75.5], ["agra", "Agra", 27.18, 78.02],
  ["nagasaki", "Nagasaki", 32.75, 129.88], ["bantam", "Bantam", -6.04, 106.15],
  // 10. the Atlantic slave trade
  ["ouidah", "Ouidah", 6.37, 2.09], ["bonny", "Bonny", 4.45, 7.17], ["mbanza-kongo", "Mbanza Kongo", -6.27, 14.24],
  ["salvador", "Salvador (Bahia)", -12.97, -38.5], ["rio", "Rio de Janeiro (Valongo)", -22.9, -43.2], ["charleston", "Charleston", 32.78, -79.93], ["kingston", "Kingston", 17.97, -76.8],
  ["bridgetown", "Bridgetown", 13.1, -59.62], ["cap-francais", "Cap-Français", 19.76, -72.2], ["liverpool", "Liverpool", 53.41, -2.99], ["bristol", "Bristol", 51.45, -2.59],
  ["nantes", "Nantes", 47.22, -1.55], ["sao-tome", "São Tomé", 0.34, 6.73], ["mozambique-island", "Mozambique Island", -15.03, 40.73], ["new-orleans", "New Orleans", 29.95, -90.07],
  ["benin-city", "Benin City", 6.34, 5.63], ["abomey", "Abomey (Dahomey)", 7.18, 1.99], ["kumasi", "Kumasi (Asante)", 6.69, -1.62], ["zanzibar-town", "Zanzibar Town", -6.16, 39.19],
  // 11. companies and treaties
  ["calcutta", "Calcutta", 22.57, 88.36], ["canton", "Canton (Guangzhou)", 23.1, 113.25], ["humen", "Humen", 22.82, 113.67], ["hong-kong", "Hong Kong", 22.3, 114.17],
  ["patna", "Patna", 25.6, 85.14], ["bombay", "Bombay", 18.96, 72.83], ["madras", "Madras", 13.08, 80.28],
  ["singapore", "Singapore", 1.29, 103.85], ["malwa", "Malwa", 23.0, 75.8], ["java", "Java", -7.5, 110.0], ["hirado", "Hirado", 33.37, 129.55],
  // 12. extraction and forced labour
  ["port-said", "Port Said", 31.26, 32.3], ["penang", "Penang", 5.41, 100.34], ["georgetown", "Georgetown (British Guiana)", 6.8, -58.16],
  ["kimberley", "Kimberley", -28.74, 24.76], ["boma", "Boma", -5.85, 13.05],
  ["kisangani", "Stanleyville (Kisangani)", 0.52, 25.19], ["putumayo", "Putumayo", -0.75, -73.0], ["iquitos", "Iquitos", -3.75, -73.25], ["chincha", "Chincha Islands (guano)", -13.6, -76.4],
  ["callao", "Callao", -12.05, -77.15], ["berlin", "Berlin", 52.52, 13.4], ["tabora", "Tabora", -5.02, 32.8], ["port-natal", "Port Natal (Durban)", -29.87, 31.03],
  ["colon", "Colón", 9.36, -79.9], ["fiji", "Fiji (Suva)", -18.14, 178.44], ["paramaribo", "Paramaribo", 5.85, -55.2], ["port-of-spain", "Port of Spain", 10.65, -61.52],
  ["macau-contract", "Macau (coolie ships)", 22.2, 113.55], ["tarapaca", "Tarapacá (nitrate)", -20.2, -69.8],
  // 13. 1914 to 1990
  ["bretton-woods", "Bretton Woods", 44.26, -71.46], ["bandung", "Bandung", -6.92, 107.6], ["newark", "Newark", 40.7, -74.17],
  ["abadan", "Abadan", 30.34, 48.3],
  // 14. today
  ["pilbara", "Pilbara", -22.5, 118.0], ["mato-grosso", "Mato Grosso", -13.0, -55.0], ["black-sea-grain", "Odesa (Black Sea)", 46.5, 31.0],
  ["katanga", "Katanga (copper)", -11.0, 26.5], ["baotou", "Baotou", 40.65, 109.8], ["qatar-lng", "Qatar", 25.5, 51.2],
];
export const OWN_BY_ID = new Map(OWN.map(([id, name, lat, lon]) => [id, { id, name, lat, lon }]));

// The routes drawn across the plate on the course's page (trade-plate.js); tests/trade-kb.mjs copies their places from kb/ too.
export const PLATE_ROUTES = [
  ["guangzhou", "strait-of-malacca", "calicut", "aden", "berenike"],                       // the monsoon sea road
  ["chang-an", "kashgar", "samarkand-timur-s-capital", "constantinople"],                  // the oasis road
  ["sijilmasa", "timbuktu"],                                                              // the Sahara
  ["seville", "veracruz"], ["lisbon", "salvador"],                                      // the Atlantic
  ["the-port-of-rotterdam", "the-cape-of-good-hope", "strait-of-malacca"],                // the Cape route
];
