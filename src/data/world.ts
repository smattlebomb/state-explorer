/**
 * World catalog: continents, UN-style sub-regions, the 195 quiz countries
 * (193 UN members + Vatican City + Palestine) and the extra "display-only"
 * map shapes (Greenland, Taiwan, Kosovo, Puerto Rico, ...).
 *
 * This file is plain data with no imports so the map build script
 * (scripts/build-world-topo.mjs) can load it directly with Node. It does NOT
 * pull in any map geometry. The TopoJSON lives in src/data/world/ and is
 * loaded lazily through src/data/worldGeo.ts.
 *
 * Join key: every country/territory `id` is also the feature `id` in
 * src/data/world/countries-50m.json. Ids are ISO 3166-1 alpha-2 codes where
 * one exists. See src/data/WORLD_NOTES.md for sources and judgment calls.
 */

export type ContinentId =
  | 'africa'
  | 'antarctica'
  | 'asia'
  | 'europe'
  | 'north-america'
  | 'oceania'
  | 'south-america';

export interface Continent {
  id: ContinentId;
  name: string;
  emoji: string;
}

/** The 7 continents, in the order kids usually learn them. */
export const CONTINENTS: readonly Continent[] = [
  { id: 'asia', name: 'Asia', emoji: '🐼' },
  { id: 'africa', name: 'Africa', emoji: '🦁' },
  { id: 'north-america', name: 'North America', emoji: '🦅' },
  { id: 'south-america', name: 'South America', emoji: '🦜' },
  { id: 'antarctica', name: 'Antarctica', emoji: '🐧' },
  { id: 'europe', name: 'Europe', emoji: '🏰' },
  { id: 'oceania', name: 'Oceania', emoji: '🦘' },
];

export type SubregionId =
  // Africa
  | 'northern-africa'
  | 'western-africa'
  | 'middle-africa'
  | 'eastern-africa'
  | 'southern-africa'
  // Americas
  | 'northern-america'
  | 'central-america'
  | 'caribbean'
  | 'south-america'
  // Asia
  | 'central-asia'
  | 'eastern-asia'
  | 'southeastern-asia'
  | 'southern-asia'
  | 'western-asia'
  // Europe
  | 'northern-europe'
  | 'western-europe'
  | 'southern-europe'
  | 'eastern-europe'
  // Oceania
  | 'australia-new-zealand'
  | 'melanesia'
  | 'micronesia'
  | 'polynesia'
  // Antarctica (no countries; only the display shape)
  | 'antarctica';

export interface Subregion {
  id: SubregionId;
  name: string;
  continent: ContinentId;
}

/**
 * UN M49 sub-regions. M49 lumps the Americas into "Latin America and the
 * Caribbean" + "Northern America"; we split them onto the North America and
 * South America continents the usual school way: Caribbean, Central America
 * (which includes Mexico in M49) and Northern America → North America.
 */
export const SUBREGIONS: readonly Subregion[] = [
  { id: 'northern-africa', name: 'Northern Africa', continent: 'africa' },
  { id: 'western-africa', name: 'Western Africa', continent: 'africa' },
  { id: 'middle-africa', name: 'Middle Africa', continent: 'africa' },
  { id: 'eastern-africa', name: 'Eastern Africa', continent: 'africa' },
  { id: 'southern-africa', name: 'Southern Africa', continent: 'africa' },
  { id: 'northern-america', name: 'Northern America', continent: 'north-america' },
  { id: 'central-america', name: 'Central America', continent: 'north-america' },
  { id: 'caribbean', name: 'Caribbean', continent: 'north-america' },
  { id: 'south-america', name: 'South America', continent: 'south-america' },
  { id: 'central-asia', name: 'Central Asia', continent: 'asia' },
  { id: 'eastern-asia', name: 'Eastern Asia', continent: 'asia' },
  { id: 'southeastern-asia', name: 'Southeast Asia', continent: 'asia' },
  { id: 'southern-asia', name: 'Southern Asia', continent: 'asia' },
  { id: 'western-asia', name: 'Western Asia', continent: 'asia' },
  { id: 'northern-europe', name: 'Northern Europe', continent: 'europe' },
  { id: 'western-europe', name: 'Western Europe', continent: 'europe' },
  { id: 'southern-europe', name: 'Southern Europe', continent: 'europe' },
  { id: 'eastern-europe', name: 'Eastern Europe', continent: 'europe' },
  { id: 'australia-new-zealand', name: 'Australia and New Zealand', continent: 'oceania' },
  { id: 'melanesia', name: 'Melanesia', continent: 'oceania' },
  { id: 'micronesia', name: 'Micronesia', continent: 'oceania' },
  { id: 'polynesia', name: 'Polynesia', continent: 'oceania' },
  { id: 'antarctica', name: 'Antarctica', continent: 'antarctica' },
];

export interface Country {
  /** ISO 3166-1 alpha-2 code. Also the feature id in the world TopoJSON. */
  id: string;
  /** ISO 3166-1 numeric code (Natural Earth / world-atlas use these as ids). */
  numeric: string;
  /** Short, kid-friendly common name used on buttons and labels. */
  name: string;
  /** Other names a kid may have heard (old names, English names). */
  aka?: readonly string[];
  /** The one capital used as the quiz answer. */
  capital: string;
  /** Learn-mode note for countries with more than one capital, or a capital story. */
  capitalNote?: string;
  subregion: SubregionId;
}

type Row = readonly [id: string, numeric: string, name: string, capital: string, extra?: Pick<Country, 'aka' | 'capitalNote'>];

function group(subregion: SubregionId, rows: readonly Row[]): Country[] {
  return rows.map(([id, numeric, name, capital, extra]) => ({ id, numeric, name, capital, subregion, ...extra }));
}

/**
 * The 195 official quiz countries, grouped by sub-region. Sub-region
 * membership follows UN M49 (so Russia is Eastern Europe, Turkey and Cyprus
 * are Western Asia, Egypt is Northern Africa, Mexico is Central America).
 */
export const COUNTRIES: readonly Country[] = [
  // ───────────── Africa (54) ─────────────
  ...group('northern-africa', [
    ['DZ', '012', 'Algeria', 'Algiers'],
    ['EG', '818', 'Egypt', 'Cairo', { capitalNote: 'Egypt is building a New Administrative Capital east of Cairo, but Cairo is still the capital.' }],
    ['LY', '434', 'Libya', 'Tripoli'],
    ['MA', '504', 'Morocco', 'Rabat'],
    ['SD', '729', 'Sudan', 'Khartoum', { capitalNote: 'During the war that began in 2023, the government has worked from Port Sudan.' }],
    ['TN', '788', 'Tunisia', 'Tunis'],
  ]),
  ...group('western-africa', [
    ['BJ', '204', 'Benin', 'Porto-Novo', { capitalNote: 'Porto-Novo is the official capital, but the government mostly works in Cotonou.' }],
    ['BF', '854', 'Burkina Faso', 'Ouagadougou'],
    ['CV', '132', 'Cabo Verde', 'Praia', { aka: ['Cape Verde'] }],
    ['CI', '384', "Côte d'Ivoire", 'Yamoussoukro', { aka: ['Ivory Coast'], capitalNote: 'Yamoussoukro is the official capital; Abidjan is the biggest city and where most government offices are.' }],
    ['GM', '270', 'Gambia', 'Banjul', { aka: ['The Gambia'] }],
    ['GH', '288', 'Ghana', 'Accra'],
    ['GN', '324', 'Guinea', 'Conakry'],
    ['GW', '624', 'Guinea-Bissau', 'Bissau'],
    ['LR', '430', 'Liberia', 'Monrovia'],
    ['ML', '466', 'Mali', 'Bamako'],
    ['MR', '478', 'Mauritania', 'Nouakchott'],
    ['NE', '562', 'Niger', 'Niamey'],
    ['NG', '566', 'Nigeria', 'Abuja', { capitalNote: 'Abuja became the capital in 1991. Before that it was Lagos, still the biggest city.' }],
    ['SN', '686', 'Senegal', 'Dakar'],
    ['SL', '694', 'Sierra Leone', 'Freetown'],
    ['TG', '768', 'Togo', 'Lomé'],
  ]),
  ...group('middle-africa', [
    ['AO', '024', 'Angola', 'Luanda'],
    ['CM', '120', 'Cameroon', 'Yaoundé'],
    ['CF', '140', 'Central African Republic', 'Bangui'],
    ['TD', '148', 'Chad', "N'Djamena"],
    ['CG', '178', 'Republic of the Congo', 'Brazzaville', { aka: ['Congo', 'Congo-Brazzaville'] }],
    ['CD', '180', 'Democratic Republic of the Congo', 'Kinshasa', { aka: ['DR Congo', 'Congo-Kinshasa'] }],
    ['GQ', '226', 'Equatorial Guinea', 'Malabo'],
    ['GA', '266', 'Gabon', 'Libreville'],
    ['ST', '678', 'São Tomé and Príncipe', 'São Tomé'],
  ]),
  ...group('eastern-africa', [
    ['BI', '108', 'Burundi', 'Gitega', { capitalNote: 'Gitega became the capital in 2019. Bujumbura, the old capital, is still the biggest city.' }],
    ['KM', '174', 'Comoros', 'Moroni'],
    ['DJ', '262', 'Djibouti', 'Djibouti'],
    ['ER', '232', 'Eritrea', 'Asmara'],
    ['ET', '231', 'Ethiopia', 'Addis Ababa'],
    ['KE', '404', 'Kenya', 'Nairobi'],
    ['MG', '450', 'Madagascar', 'Antananarivo'],
    ['MW', '454', 'Malawi', 'Lilongwe'],
    ['MU', '480', 'Mauritius', 'Port Louis'],
    ['MZ', '508', 'Mozambique', 'Maputo'],
    ['RW', '646', 'Rwanda', 'Kigali'],
    ['SC', '690', 'Seychelles', 'Victoria'],
    ['SO', '706', 'Somalia', 'Mogadishu'],
    ['SS', '728', 'South Sudan', 'Juba'],
    ['TZ', '834', 'Tanzania', 'Dodoma', { capitalNote: 'Dodoma is the official capital; Dar es Salaam is the biggest city and the old capital.' }],
    ['UG', '800', 'Uganda', 'Kampala'],
    ['ZM', '894', 'Zambia', 'Lusaka'],
    ['ZW', '716', 'Zimbabwe', 'Harare'],
  ]),
  ...group('southern-africa', [
    ['BW', '072', 'Botswana', 'Gaborone'],
    ['SZ', '748', 'Eswatini', 'Mbabane', { aka: ['Swaziland'], capitalNote: 'Mbabane is the capital where the government works; Lobamba is the royal and law-making capital.' }],
    ['LS', '426', 'Lesotho', 'Maseru'],
    ['NA', '516', 'Namibia', 'Windhoek'],
    ['ZA', '710', 'South Africa', 'Pretoria', { capitalNote: 'South Africa has three capitals: Pretoria (where the president works), Cape Town (where laws are made) and Bloemfontein (the highest court).' }],
  ]),

  // ───────────── North America (23) ─────────────
  ...group('northern-america', [
    ['CA', '124', 'Canada', 'Ottawa'],
    ['US', '840', 'United States', 'Washington, D.C.', { aka: ['USA', 'United States of America'] }],
  ]),
  ...group('central-america', [
    ['BZ', '084', 'Belize', 'Belmopan'],
    ['CR', '188', 'Costa Rica', 'San José'],
    ['SV', '222', 'El Salvador', 'San Salvador'],
    ['GT', '320', 'Guatemala', 'Guatemala City'],
    ['HN', '340', 'Honduras', 'Tegucigalpa'],
    ['MX', '484', 'Mexico', 'Mexico City'],
    ['NI', '558', 'Nicaragua', 'Managua'],
    ['PA', '591', 'Panama', 'Panama City'],
  ]),
  ...group('caribbean', [
    ['AG', '028', 'Antigua and Barbuda', "St. John's"],
    ['BS', '044', 'Bahamas', 'Nassau', { aka: ['The Bahamas'] }],
    ['BB', '052', 'Barbados', 'Bridgetown'],
    ['CU', '192', 'Cuba', 'Havana'],
    ['DM', '212', 'Dominica', 'Roseau'],
    ['DO', '214', 'Dominican Republic', 'Santo Domingo'],
    ['GD', '308', 'Grenada', "St. George's"],
    ['HT', '332', 'Haiti', 'Port-au-Prince'],
    ['JM', '388', 'Jamaica', 'Kingston'],
    ['KN', '659', 'Saint Kitts and Nevis', 'Basseterre'],
    ['LC', '662', 'Saint Lucia', 'Castries'],
    ['VC', '670', 'Saint Vincent and the Grenadines', 'Kingstown'],
    ['TT', '780', 'Trinidad and Tobago', 'Port of Spain'],
  ]),

  // ───────────── South America (12) ─────────────
  ...group('south-america', [
    ['AR', '032', 'Argentina', 'Buenos Aires'],
    ['BO', '068', 'Bolivia', 'Sucre', { capitalNote: 'Sucre is the capital in Bolivia’s constitution, but the government works in La Paz, the highest capital city in the world.' }],
    ['BR', '076', 'Brazil', 'Brasília'],
    ['CL', '152', 'Chile', 'Santiago', { capitalNote: 'Chile’s lawmakers (Congress) meet in Valparaíso, on the coast.' }],
    ['CO', '170', 'Colombia', 'Bogotá'],
    ['EC', '218', 'Ecuador', 'Quito'],
    ['GY', '328', 'Guyana', 'Georgetown'],
    ['PY', '600', 'Paraguay', 'Asunción'],
    ['PE', '604', 'Peru', 'Lima'],
    ['SR', '740', 'Suriname', 'Paramaribo'],
    ['UY', '858', 'Uruguay', 'Montevideo'],
    ['VE', '862', 'Venezuela', 'Caracas'],
  ]),

  // ───────────── Asia (48) ─────────────
  ...group('central-asia', [
    ['KZ', '398', 'Kazakhstan', 'Astana'],
    ['KG', '417', 'Kyrgyzstan', 'Bishkek'],
    ['TJ', '762', 'Tajikistan', 'Dushanbe'],
    ['TM', '795', 'Turkmenistan', 'Ashgabat'],
    ['UZ', '860', 'Uzbekistan', 'Tashkent'],
  ]),
  ...group('eastern-asia', [
    ['CN', '156', 'China', 'Beijing'],
    ['JP', '392', 'Japan', 'Tokyo'],
    ['MN', '496', 'Mongolia', 'Ulaanbaatar'],
    ['KP', '408', 'North Korea', 'Pyongyang'],
    ['KR', '410', 'South Korea', 'Seoul'],
  ]),
  ...group('southeastern-asia', [
    ['BN', '096', 'Brunei', 'Bandar Seri Begawan'],
    ['KH', '116', 'Cambodia', 'Phnom Penh'],
    ['ID', '360', 'Indonesia', 'Jakarta', { capitalNote: 'Indonesia is building a new capital called Nusantara on the island of Borneo.' }],
    ['LA', '418', 'Laos', 'Vientiane'],
    ['MY', '458', 'Malaysia', 'Kuala Lumpur', { capitalNote: 'Kuala Lumpur is the capital; many government offices moved to the nearby planned city of Putrajaya.' }],
    ['MM', '104', 'Myanmar', 'Naypyidaw', { aka: ['Burma'], capitalNote: 'Naypyidaw became the capital in 2006. Before that it was Yangon, still the biggest city.' }],
    ['PH', '608', 'Philippines', 'Manila'],
    ['SG', '702', 'Singapore', 'Singapore', { capitalNote: 'Singapore is a city-state: the whole country is one city.' }],
    ['TH', '764', 'Thailand', 'Bangkok'],
    ['TL', '626', 'Timor-Leste', 'Dili', { aka: ['East Timor'] }],
    ['VN', '704', 'Vietnam', 'Hanoi'],
  ]),
  ...group('southern-asia', [
    ['AF', '004', 'Afghanistan', 'Kabul'],
    ['BD', '050', 'Bangladesh', 'Dhaka'],
    ['BT', '064', 'Bhutan', 'Thimphu'],
    ['IN', '356', 'India', 'New Delhi'],
    ['IR', '364', 'Iran', 'Tehran'],
    ['MV', '462', 'Maldives', 'Malé'],
    ['NP', '524', 'Nepal', 'Kathmandu'],
    ['PK', '586', 'Pakistan', 'Islamabad'],
    ['LK', '144', 'Sri Lanka', 'Sri Jayawardenepura Kotte', { capitalNote: 'Sri Jayawardenepura Kotte is the official capital, where laws are made; nearby Colombo is the biggest city and where the president works.' }],
  ]),
  ...group('western-asia', [
    ['AM', '051', 'Armenia', 'Yerevan'],
    ['AZ', '031', 'Azerbaijan', 'Baku'],
    ['BH', '048', 'Bahrain', 'Manama'],
    ['CY', '196', 'Cyprus', 'Nicosia'],
    ['GE', '268', 'Georgia', 'Tbilisi'],
    ['IQ', '368', 'Iraq', 'Baghdad'],
    ['IL', '376', 'Israel', 'Jerusalem', { capitalNote: 'Israel’s government is in Jerusalem, but many countries keep their embassies in Tel Aviv because Jerusalem’s status is disputed.' }],
    ['JO', '400', 'Jordan', 'Amman'],
    ['KW', '414', 'Kuwait', 'Kuwait City'],
    ['LB', '422', 'Lebanon', 'Beirut'],
    ['OM', '512', 'Oman', 'Muscat'],
    ['PS', '275', 'Palestine', 'East Jerusalem', { capitalNote: 'Palestine names East Jerusalem as its capital; its government works from Ramallah.' }],
    ['QA', '634', 'Qatar', 'Doha'],
    ['SA', '682', 'Saudi Arabia', 'Riyadh'],
    ['SY', '760', 'Syria', 'Damascus'],
    ['TR', '792', 'Turkey', 'Ankara', { aka: ['Türkiye'], capitalNote: 'Ankara is the capital; Istanbul is the biggest city.' }],
    ['AE', '784', 'United Arab Emirates', 'Abu Dhabi', { aka: ['UAE'] }],
    ['YE', '887', 'Yemen', 'Sanaa', { capitalNote: 'Sanaa is the capital, but during the civil war the recognized government has worked from Aden.' }],
  ]),

  // ───────────── Europe (44) ─────────────
  ...group('northern-europe', [
    ['DK', '208', 'Denmark', 'Copenhagen'],
    ['EE', '233', 'Estonia', 'Tallinn'],
    ['FI', '246', 'Finland', 'Helsinki'],
    ['IS', '352', 'Iceland', 'Reykjavík'],
    ['IE', '372', 'Ireland', 'Dublin'],
    ['LV', '428', 'Latvia', 'Riga'],
    ['LT', '440', 'Lithuania', 'Vilnius'],
    ['NO', '578', 'Norway', 'Oslo'],
    ['SE', '752', 'Sweden', 'Stockholm'],
    ['GB', '826', 'United Kingdom', 'London', { aka: ['UK', 'Great Britain'] }],
  ]),
  ...group('western-europe', [
    ['AT', '040', 'Austria', 'Vienna'],
    ['BE', '056', 'Belgium', 'Brussels'],
    ['FR', '250', 'France', 'Paris'],
    ['DE', '276', 'Germany', 'Berlin'],
    ['LI', '438', 'Liechtenstein', 'Vaduz'],
    ['LU', '442', 'Luxembourg', 'Luxembourg'],
    ['MC', '492', 'Monaco', 'Monaco', { capitalNote: 'Monaco is a city-state: the whole country is one small city.' }],
    ['NL', '528', 'Netherlands', 'Amsterdam', { capitalNote: 'Amsterdam is the capital, but the government and the king’s offices are in The Hague.' }],
    ['CH', '756', 'Switzerland', 'Bern', { capitalNote: 'Switzerland calls Bern its "federal city" instead of its capital, but that is where the government works.' }],
  ]),
  ...group('southern-europe', [
    ['AL', '008', 'Albania', 'Tirana'],
    ['AD', '020', 'Andorra', 'Andorra la Vella'],
    ['BA', '070', 'Bosnia and Herzegovina', 'Sarajevo'],
    ['HR', '191', 'Croatia', 'Zagreb'],
    ['GR', '300', 'Greece', 'Athens'],
    ['IT', '380', 'Italy', 'Rome'],
    ['MT', '470', 'Malta', 'Valletta'],
    ['ME', '499', 'Montenegro', 'Podgorica', { capitalNote: 'Podgorica is the capital; the old royal capital, Cetinje, is still the home of the president’s office.' }],
    ['MK', '807', 'North Macedonia', 'Skopje', { aka: ['Macedonia'] }],
    ['PT', '620', 'Portugal', 'Lisbon'],
    ['SM', '674', 'San Marino', 'San Marino'],
    ['RS', '688', 'Serbia', 'Belgrade'],
    ['SI', '705', 'Slovenia', 'Ljubljana'],
    ['ES', '724', 'Spain', 'Madrid'],
    ['VA', '336', 'Vatican City', 'Vatican City', { aka: ['Holy See'], capitalNote: 'Vatican City is the smallest country in the world, a city-state inside Rome.' }],
  ]),
  ...group('eastern-europe', [
    ['BY', '112', 'Belarus', 'Minsk'],
    ['BG', '100', 'Bulgaria', 'Sofia'],
    ['CZ', '203', 'Czechia', 'Prague', { aka: ['Czech Republic'] }],
    ['HU', '348', 'Hungary', 'Budapest'],
    ['MD', '498', 'Moldova', 'Chișinău'],
    ['PL', '616', 'Poland', 'Warsaw'],
    ['RO', '642', 'Romania', 'Bucharest'],
    ['RU', '643', 'Russia', 'Moscow'],
    ['SK', '703', 'Slovakia', 'Bratislava'],
    ['UA', '804', 'Ukraine', 'Kyiv'],
  ]),

  // ───────────── Oceania (14) ─────────────
  ...group('australia-new-zealand', [
    ['AU', '036', 'Australia', 'Canberra'],
    ['NZ', '554', 'New Zealand', 'Wellington'],
  ]),
  ...group('melanesia', [
    ['FJ', '242', 'Fiji', 'Suva'],
    ['PG', '598', 'Papua New Guinea', 'Port Moresby'],
    ['SB', '090', 'Solomon Islands', 'Honiara'],
    ['VU', '548', 'Vanuatu', 'Port Vila'],
  ]),
  ...group('micronesia', [
    ['KI', '296', 'Kiribati', 'South Tarawa', { capitalNote: 'South Tarawa is a chain of small islets on Tarawa atoll.' }],
    ['MH', '584', 'Marshall Islands', 'Majuro'],
    ['FM', '583', 'Micronesia', 'Palikir', { aka: ['Federated States of Micronesia'] }],
    ['NR', '520', 'Nauru', 'Yaren', { capitalNote: 'Nauru has no official capital; the government works in the Yaren district.' }],
    ['PW', '585', 'Palau', 'Ngerulmud', { capitalNote: 'Ngerulmud became the capital in 2006. Koror, the old capital, is the biggest town.' }],
  ]),
  ...group('polynesia', [
    ['WS', '882', 'Samoa', 'Apia'],
    ['TO', '776', 'Tonga', "Nuku'alofa"],
    ['TV', '798', 'Tuvalu', 'Funafuti'],
  ]),
];

export type TerritoryStatus =
  /** Part of (or linked to) another country, e.g. Greenland, Puerto Rico. */
  | 'territory'
  /** Governs itself and is recognized by some countries, but is not a UN member. */
  | 'partially-recognized'
  /** Land whose ownership is argued over, shown as its own shape on most maps. */
  | 'disputed'
  /** Antarctica: a whole continent with no country. */
  | 'continent';

/**
 * A map shape that is NOT one of the 195 quiz countries. These are tappable
 * in Learn / map explore, but never asked in quizzes.
 */
export interface MapTerritory {
  /** ISO 3166-1 alpha-2 where one exists (XK for Kosovo is the widely used user-assigned code). */
  id: string;
  /** ISO numeric code used by world-atlas, or null for Natural Earth shapes that have none. */
  numeric: string | null;
  name: string;
  status: TerritoryStatus;
  /** Country it belongs to (a COUNTRIES id), for status 'territory'. */
  belongsTo?: string;
  capital?: string;
  /** Kid-friendly sentence for Learn mode. */
  note: string;
  subregion: SubregionId;
}

type TRow = readonly [id: string, numeric: string | null, name: string, belongsTo: string, subregion: SubregionId, extra?: Partial<Pick<MapTerritory, 'capital' | 'note'>>];

const OWNER_PHRASE: Record<string, string> = {
  US: 'a territory of the United States',
  GB: 'a British Overseas Territory',
  FR: 'part of France',
  NL: 'part of the Kingdom of the Netherlands',
  DK: 'part of the Kingdom of Denmark',
  CN: 'a special region of China',
  AU: 'a territory of Australia',
  NZ: 'linked to New Zealand',
  FI: 'a self-governing region of Finland',
};

function territories(rows: readonly TRow[]): MapTerritory[] {
  return rows.map(([id, numeric, name, belongsTo, subregion, extra]) => ({
    id,
    numeric,
    name,
    status: 'territory' as const,
    belongsTo,
    subregion,
    ...extra,
    note: extra?.note ?? `${name} is ${OWNER_PHRASE[belongsTo]}.`,
  }));
}

/** Display-only shapes. None of these are in the 195-country quiz set. */
export const MAP_TERRITORIES: readonly MapTerritory[] = [
  // Widely shown places that are not UN members.
  {
    id: 'TW', numeric: '158', name: 'Taiwan', status: 'partially-recognized', capital: 'Taipei', subregion: 'eastern-asia',
    note: 'Taiwan is an island that governs itself, but China says it is part of China. Most countries do not officially count it as a separate country.',
  },
  {
    id: 'XK', numeric: null, name: 'Kosovo', status: 'partially-recognized', capital: 'Pristina', subregion: 'southern-europe',
    note: 'Kosovo declared independence from Serbia in 2008. About half of the world’s countries recognize it, but it is not in the United Nations.',
  },
  {
    id: 'EH', numeric: '732', name: 'Western Sahara', status: 'disputed', subregion: 'northern-africa',
    note: 'Western Sahara is a desert land that Morocco and the Sahrawi people both claim.',
  },
  {
    id: 'SIACHEN', numeric: null, name: 'Siachen Glacier', status: 'disputed', subregion: 'southern-asia',
    note: 'The Siachen Glacier is high in the Himalaya mountains. India and Pakistan both claim it.',
  },
  {
    id: 'AQ', numeric: '010', name: 'Antarctica', status: 'continent', subregion: 'antarctica',
    note: 'Antarctica is the icy continent at the South Pole. No country owns it; scientists from many countries work there.',
  },

  // Territories of a quiz country.
  ...territories([
    ['GL', '304', 'Greenland', 'DK', 'northern-america', { capital: 'Nuuk', note: 'Greenland is the world’s biggest island. It governs itself but is part of the Kingdom of Denmark.' }],
    ['FO', '234', 'Faroe Islands', 'DK', 'northern-europe'],
    ['AX', '248', 'Åland Islands', 'FI', 'northern-europe'],
    ['JE', '832', 'Jersey', 'GB', 'northern-europe', { note: 'Jersey is an island that belongs to the British Crown.' }],
    ['GG', '831', 'Guernsey', 'GB', 'northern-europe', { note: 'Guernsey is an island that belongs to the British Crown.' }],
    ['IM', '833', 'Isle of Man', 'GB', 'northern-europe', { note: 'The Isle of Man is an island that belongs to the British Crown.' }],
    ['PR', '630', 'Puerto Rico', 'US', 'caribbean', { capital: 'San Juan' }],
    ['VI', '850', 'U.S. Virgin Islands', 'US', 'caribbean'],
    ['GU', '316', 'Guam', 'US', 'micronesia'],
    ['MP', '580', 'Northern Mariana Islands', 'US', 'micronesia'],
    ['AS', '016', 'American Samoa', 'US', 'polynesia'],
    ['BM', '060', 'Bermuda', 'GB', 'northern-america'],
    ['AI', '660', 'Anguilla', 'GB', 'caribbean'],
    ['KY', '136', 'Cayman Islands', 'GB', 'caribbean'],
    ['VG', '092', 'British Virgin Islands', 'GB', 'caribbean'],
    ['TC', '796', 'Turks and Caicos Islands', 'GB', 'caribbean'],
    ['MS', '500', 'Montserrat', 'GB', 'caribbean'],
    ['FK', '238', 'Falkland Islands', 'GB', 'south-america', { note: 'The Falkland Islands are a British Overseas Territory. Argentina also claims them and calls them the Islas Malvinas.' }],
    ['GS', '239', 'South Georgia and the South Sandwich Islands', 'GB', 'south-america'],
    ['SH', '654', 'Saint Helena', 'GB', 'western-africa'],
    ['IO', '086', 'British Indian Ocean Territory', 'GB', 'eastern-africa'],
    ['PN', '612', 'Pitcairn Islands', 'GB', 'polynesia'],
    ['AW', '533', 'Aruba', 'NL', 'caribbean'],
    ['CW', '531', 'Curaçao', 'NL', 'caribbean'],
    ['SX', '534', 'Sint Maarten', 'NL', 'caribbean'],
    ['MF', '663', 'Saint Martin', 'FR', 'caribbean'],
    ['BL', '652', 'Saint Barthélemy', 'FR', 'caribbean'],
    ['PM', '666', 'Saint Pierre and Miquelon', 'FR', 'northern-america'],
    ['NC', '540', 'New Caledonia', 'FR', 'melanesia'],
    ['PF', '258', 'French Polynesia', 'FR', 'polynesia'],
    ['WF', '876', 'Wallis and Futuna', 'FR', 'polynesia'],
    ['TF', '260', 'French Southern and Antarctic Lands', 'FR', 'eastern-africa'],
    ['HK', '344', 'Hong Kong', 'CN', 'eastern-asia'],
    ['MO', '446', 'Macao', 'CN', 'eastern-asia'],
    ['CK', '184', 'Cook Islands', 'NZ', 'polynesia'],
    ['NU', '570', 'Niue', 'NZ', 'polynesia'],
    ['NF', '574', 'Norfolk Island', 'AU', 'australia-new-zealand'],
    ['HM', '334', 'Heard Island and McDonald Islands', 'AU', 'australia-new-zealand'],
    // Natural Earth draws Christmas Island and the Cocos (Keeling) Islands as one code-less shape.
    ['CX', null, 'Christmas Island and Cocos Islands', 'AU', 'australia-new-zealand', { note: 'Christmas Island and the Cocos Islands are territories of Australia in the Indian Ocean.' }],
  ]),
];

// ───────────── Lookups ─────────────

export const SUBREGION_BY_ID: ReadonlyMap<SubregionId, Subregion> = new Map(SUBREGIONS.map((s) => [s.id, s]));
export const CONTINENT_BY_ID: ReadonlyMap<ContinentId, Continent> = new Map(CONTINENTS.map((c) => [c.id, c]));
export const COUNTRY_BY_ID: ReadonlyMap<string, Country> = new Map(COUNTRIES.map((c) => [c.id, c]));
export const TERRITORY_BY_ID: ReadonlyMap<string, MapTerritory> = new Map(MAP_TERRITORIES.map((t) => [t.id, t]));
export const ALL_COUNTRY_IDS: readonly string[] = COUNTRIES.map((c) => c.id);

/** The continent a sub-region (and so a country) belongs to. */
export function continentOf(item: { subregion: SubregionId }): ContinentId {
  // SUBREGIONS covers every SubregionId (checked in world.test.ts).
  return SUBREGION_BY_ID.get(item.subregion)!.continent;
}

export function countriesInSubregion(id: SubregionId): Country[] {
  return COUNTRIES.filter((c) => c.subregion === id);
}

export function countriesInContinent(id: ContinentId): Country[] {
  return COUNTRIES.filter((c) => continentOf(c) === id);
}

/** Name for any map shape id (quiz country or display-only territory). */
export function placeName(id: string): string {
  return COUNTRY_BY_ID.get(id)?.name ?? TERRITORY_BY_ID.get(id)?.name ?? id;
}
