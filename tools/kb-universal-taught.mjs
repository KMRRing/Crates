// The education test, piloted on one subject (history) in three systems, by hand: which things does each syllabus NAME.
// Facts only (topic names are not copyrightable); no syllabus text is kept. Each line is an English Wikipedia title and
// the systems that name it:  u = UK, AQA GCSE History 8145 (the 2016 specification PDF, options named in sections 3.2 and 3.3)
//                            a = US, AP World History: Modern (units and topics, read from a third-party summary of the College Board's course description, not from the course description itself)
//                            n = India, NCERT Class 11 "Themes in World History" (the eleven chapter titles; which things a chapter covers is my reading of its scope)
// "Named by a system" means a specification or chapter title names it, not that every pupil is taught it: AQA is a menu.
// This is a demonstration of the join (name → Wikipedia title → Wikidata item → count of systems), not a measurement: three systems, one subject.
const TAUGHT = `
Manifest destiny|u
American Civil War|ua
Abraham Lincoln|u
Jefferson Davis|u
John Brown (abolitionist)|u
Battle of the Little Bighorn|u
Wounded Knee Massacre|u
Dawes Act|u
Wilhelm II, German Emperor|u
Gustav Stresemann|u
Paul von Hindenburg|u
Adolf Hitler|u
Ernst Röhm|u
Joseph Goebbels|u
Heinrich Himmler|u
Gestapo|u
Schutzstaffel|u
Beer Hall Putsch|u
Reichstag fire|u
Enabling Act of 1933|u
Night of the Long Knives|u
The Holocaust|u
20 July plot|u
Nicholas II of Russia|u
Grigori Rasputin|u
Vladimir Lenin|u
Leon Trotsky|u
Joseph Stalin|u
Russian Revolution|ua
Russian Civil War|u
Red Army|u
New Economic Policy|u
Five-year plans of the Soviet Union|u
Collectivization in the Soviet Union|u
Great Purge|u
Henry Ford|u
Herbert Hoover|u
Franklin D. Roosevelt|u
Ku Klux Klan|u
John F. Kennedy|u
Lyndon B. Johnson|u
Martin Luther King Jr.|u
Malcolm X|u
McCarthyism|u
Prohibition in the United States|u
First Red Scare|u
New Deal|u
Lend-Lease|u
Civil Rights Act of 1964|u
Great Society|u
Roe v. Wade|u
Franz Ferdinand|u
Erich Ludendorff|u
Douglas Haig, 1st Earl Haig|u
Ferdinand Foch|u
Triple Alliance (1882)|u
Schlieffen Plan|u
July Crisis|u
First Battle of the Marne|u
Battle of Verdun|u
Battle of the Somme|u
Battle of Passchendaele|u
Gallipoli campaign|u
Battle of Jutland|u
World War I|ua
Woodrow Wilson|u
Georges Clemenceau|u
David Lloyd George|u
Benito Mussolini|u
Neville Chamberlain|u
Fourteen Points|u
Treaty of Versailles|u
League of Nations|ua
Locarno Treaties|u
Kellogg–Briand Pact|u
Great Depression|ua
Mukden Incident|u
Anschluss|u
Appeasement|u
Munich Agreement|u
Molotov–Ribbentrop Pact|u
Invasion of Poland|u
Winston Churchill|u
Clement Attlee|u
Harry S. Truman|u
Mao Zedong|u
Nikita Khrushchev|u
Fidel Castro|u
Alexander Dubček|u
Leonid Brezhnev|u
Richard Nixon|u
Imre Nagy|u
Yalta Conference|u
Potsdam Conference|u
Iron Curtain|u
Truman Doctrine|u
Marshall Plan|u
Cominform|u
Comecon|u
Berlin Blockade|u
Berlin Airlift|u
NATO|u
Warsaw Pact|u
Sputnik 1|u
Yuri Gagarin|u
Apollo program|u
Hungarian Revolution of 1956|u
U-2 incident|u
Berlin Wall|u
Bay of Pigs Invasion|u
Cuban Missile Crisis|u
Prague Spring|u
Brezhnev Doctrine|u
Détente|u
Korean War|u
38th parallel north|u
Battle of Dien Bien Phu|u
Domino theory|u
Gulf of Tonkin incident|u
My Lai massacre|u
Tet Offensive|u
Vietnamization|u
Kent State shootings|u
Watergate scandal|u
Fall of Saigon|u
Kim Il-sung|u
Syngman Rhee|u
Douglas MacArthur|u
Ngô Đình Diệm|u
Ho Chi Minh|u
Dwight D. Eisenhower|u
Henry Kissinger|u
Vietnam War|ua
Iran–Iraq War|u
Gulf War|u
September 11 attacks|u
2003 invasion of Iraq|u
Saddam Hussein|u
Osama bin Laden|u
Al-Qaeda|u
Taliban|u
Kurds|u
Hamid Karzai|u
Tony Blair|u
George H. W. Bush|u
Margaret Thatcher|u
Hippocrates|u
Galen|u
Andreas Vesalius|u
Ambroise Paré|u
William Harvey|u
John Hunter (surgeon)|u
Edward Jenner|u
Louis Pasteur|u
Robert Koch|u
Paul Ehrlich|u
James Young Simpson|u
Joseph Lister|u
Alexander Fleming|u
Seebohm Rowntree|u
William Beveridge|u
Black Death|ua
Renaissance|un
Germ theory of disease|u
Cholera|u
National Health Service|u
Penicillin|u
John, King of England|u
Henry III of England|u
Simon de Montfort, 6th Earl of Leicester|u
Henry VIII|u
Charles I of England|u
Oliver Cromwell|u
Emmeline Pankhurst|u
Tolpuddle Martyrs|u
Magna Carta|u
Peasants' Revolt|u
Pilgrimage of Grace|u
English Civil War|u
New Model Army|u
American Revolution|ua
Reform Act 1832|u
Chartism|u
Abolitionism|u
Anti-Corn Law League|u
1926 United Kingdom general strike|u
1981 Brixton riot|u
Alfred the Great|u
Cnut the Great|u
Emma of Normandy|u
Henry II of England|u
John Hawkins (naval commander)|u
Walter Raleigh|u
Robert Clive|u
Warren Hastings|u
Cecil Rhodes|u
Mahatma Gandhi|u
Kwame Nkrumah|u
Jomo Kenyatta|u
Idi Amin|u
Claudia Jones|u
Vikings|u
Anglo-Saxons|u
Huguenots|u
Pilgrims (Plymouth Colony)|u
Danelaw|u
North Sea Empire|u
Hundred Years' War|u
Angevin Empire|u
Atlantic slave trade|ua
Jamestown, Virginia|u
Highland Clearances|u
East India Company|u
Indian Rebellion of 1857|u
Scramble for Africa|ua
Second Boer War|u
Suez Crisis|u
Falklands War|u
Commonwealth of Nations|u
European Union|u
World War II|ua
Cold War|ua
William the Conqueror|u
William II of England|u
Lanfranc|u
Edward the Confessor|u
Norman conquest of England|u
Battle of Stamford Bridge|u
Battle of Hastings|u
Harrying of the North|u
Domesday Book|u
Investiture Controversy|u
Edward I of England|u
Robert Burnell|u
Roger Bacon|u
Duns Scotus|u
John Balliol|u
Robert the Bruce|u
William Wallace|u
Model Parliament|u
Edict of Expulsion|u
Statute of Rhuddlan|u
Great Cause|u
Elizabeth I|u
Robert Devereux, 2nd Earl of Essex|u
Francis Drake|u
Mary, Queen of Scots|u
Puritans|u
Spanish Armada|u
Charles II of England|u
James II of England|u
Titus Oates|u
Samuel Pepys|u
Christopher Wren|u
Henry Morgan|u
Popish Plot|u
Rye House Plot|u
Great Plague of London|u
Great Fire of London|u
Royal Society|u
Navigation Acts|u
Anglo-Dutch Wars|u
Song dynasty|a
Abbasid Caliphate|an
Seljuk Empire|a
Mamluk Sultanate|a
Delhi Sultanate|a
Mali Empire|a
Great Zimbabwe|a
Aztec Empire|an
Chimú culture|a
Inca Empire|an
Charlemagne|a
Feudalism|an
Silk Road|a
Indian Ocean trade|a
Trans-Saharan trade|a
Mongol Empire|an
Zheng He|a
Swahili coast|a
Ottoman Empire|a
Safavid dynasty|a
Mughal Empire|a
Ming dynasty|a
Qing dynasty|a
Russian Empire|a
Millet (Ottoman Empire)|a
Akbar|a
Aurangzeb|a
Age of Discovery|a
Columbian exchange|a
Triangular trade|a
Plantation economy|a
Slavery|a
Age of Enlightenment|a
French Revolution|a
Haitian Revolution|a
Spanish American wars of independence|a
Nationalism|a
Liberalism|a
Conservatism|a
Socialism|a
Feminism|a
Industrial Revolution|an
Berlin Conference|a
Meiji Restoration|an
Tanzimat|a
Self-Strengthening Movement|a
Fascism|a
Sykes–Picot Agreement|a
Balfour Declaration|a
Non-Aligned Movement|a
Partition of India|a
Algerian War|a
Angolan Civil War|a
Green Revolution|a
Second-wave feminism|a
Environmentalism|a
Dissolution of the Soviet Union|a
Internet|a
Chinese economic reform|a
Neoliberalism|a
Climate change|a
Mesopotamia|n
Cuneiform|n
Roman Empire|n
Umayyad Caliphate|n
Genghis Khan|n
Middle Ages|n
Reformation|n
Scientific Revolution|n
Colonization of the Americas|n
Indigenous peoples of the Americas|n
Indigenous Australians|n
Taiping Rebellion|n
First Opium War|n
Human evolution|n
Hunter-gatherer|n
Crusades|n
`;
export const TAUGHT_ROWS = TAUGHT.split("\n").filter(Boolean).map(l => { const [title, flags] = l.split("|"); return { title: title.replace(/ /g, "_"), systems: [...flags] }; });
export const SYSTEMS = { u: "UK: AQA GCSE History 8145", a: "US: AP World History: Modern", n: "India: NCERT Class 11 Themes in World History" };
