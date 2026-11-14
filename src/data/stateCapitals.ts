/**
 * Capitals of the 50 states, keyed by the postal abbreviation used as the
 * state id everywhere in the app (see states.ts). Kept separate from STATES
 * so the existing US data and screens are untouched until the capitals games.
 */
export const STATE_CAPITALS: Readonly<Record<string, string>> = {
  AL: 'Montgomery',
  AK: 'Juneau',
  AZ: 'Phoenix',
  AR: 'Little Rock',
  CA: 'Sacramento',
  CO: 'Denver',
  CT: 'Hartford',
  DE: 'Dover',
  FL: 'Tallahassee',
  GA: 'Atlanta',
  HI: 'Honolulu',
  ID: 'Boise',
  IL: 'Springfield',
  IN: 'Indianapolis',
  IA: 'Des Moines',
  KS: 'Topeka',
  KY: 'Frankfort',
  LA: 'Baton Rouge',
  ME: 'Augusta',
  MD: 'Annapolis',
  MA: 'Boston',
  MI: 'Lansing',
  MN: 'Saint Paul',
  MS: 'Jackson',
  MO: 'Jefferson City',
  MT: 'Helena',
  NE: 'Lincoln',
  NV: 'Carson City',
  NH: 'Concord',
  NJ: 'Trenton',
  NM: 'Santa Fe',
  NY: 'Albany',
  NC: 'Raleigh',
  ND: 'Bismarck',
  OH: 'Columbus',
  OK: 'Oklahoma City',
  OR: 'Salem',
  PA: 'Harrisburg',
  RI: 'Providence',
  SC: 'Columbia',
  SD: 'Pierre',
  TN: 'Nashville',
  TX: 'Austin',
  UT: 'Salt Lake City',
  VT: 'Montpelier',
  VA: 'Richmond',
  WA: 'Olympia',
  WV: 'Charleston',
  WI: 'Madison',
  WY: 'Cheyenne',
};

export function stateCapital(abbr: string): string | undefined {
  return STATE_CAPITALS[abbr];
}

/** Learn-mode notes for capitals with a story (often: the capital isn't the biggest city). */
export const STATE_CAPITAL_NOTES: Readonly<Record<string, string>> = {
  AK: 'Juneau has no roads to the rest of North America. You get there by boat or plane!',
  AZ: 'Phoenix is the biggest state capital in the United States.',
  CA: 'Sacramento is the capital, not Los Angeles or San Francisco.',
  FL: 'Tallahassee is the capital, not Miami or Orlando.',
  HI: 'Honolulu is on the island of Oʻahu.',
  IL: 'Springfield is the capital, not Chicago. Abraham Lincoln lived there.',
  NY: 'Albany is the capital, not New York City.',
  PA: 'Harrisburg is the capital, not Philadelphia or Pittsburgh.',
  TX: 'Austin is the capital, not Houston or Dallas.',
  VT: 'Montpelier is the smallest state capital: fewer than 10,000 people live there.',
  WA: 'Olympia is the capital, not Seattle.',
};
