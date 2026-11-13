export type RegionId = 'northeast' | 'southeast' | 'midwest' | 'southwest' | 'west';

export interface StateInfo {
  /** Two-letter postal abbreviation, used as the id everywhere in the app. */
  abbr: string;
  name: string;
  /** FIPS code, matches the feature ids in us-atlas. */
  fips: string;
  region: RegionId;
}

/**
 * The 50 states. Regions use the common five-region split
 * (Northeast, Southeast, Midwest, Southwest, West) — see README.md.
 */
export const STATES: readonly StateInfo[] = [
  { abbr: 'AL', name: 'Alabama', fips: '01', region: 'southeast' },
  { abbr: 'AK', name: 'Alaska', fips: '02', region: 'west' },
  { abbr: 'AZ', name: 'Arizona', fips: '04', region: 'southwest' },
  { abbr: 'AR', name: 'Arkansas', fips: '05', region: 'southeast' },
  { abbr: 'CA', name: 'California', fips: '06', region: 'west' },
  { abbr: 'CO', name: 'Colorado', fips: '08', region: 'west' },
  { abbr: 'CT', name: 'Connecticut', fips: '09', region: 'northeast' },
  { abbr: 'DE', name: 'Delaware', fips: '10', region: 'northeast' },
  { abbr: 'FL', name: 'Florida', fips: '12', region: 'southeast' },
  { abbr: 'GA', name: 'Georgia', fips: '13', region: 'southeast' },
  { abbr: 'HI', name: 'Hawaii', fips: '15', region: 'west' },
  { abbr: 'ID', name: 'Idaho', fips: '16', region: 'west' },
  { abbr: 'IL', name: 'Illinois', fips: '17', region: 'midwest' },
  { abbr: 'IN', name: 'Indiana', fips: '18', region: 'midwest' },
  { abbr: 'IA', name: 'Iowa', fips: '19', region: 'midwest' },
  { abbr: 'KS', name: 'Kansas', fips: '20', region: 'midwest' },
  { abbr: 'KY', name: 'Kentucky', fips: '21', region: 'southeast' },
  { abbr: 'LA', name: 'Louisiana', fips: '22', region: 'southeast' },
  { abbr: 'ME', name: 'Maine', fips: '23', region: 'northeast' },
  { abbr: 'MD', name: 'Maryland', fips: '24', region: 'northeast' },
  { abbr: 'MA', name: 'Massachusetts', fips: '25', region: 'northeast' },
  { abbr: 'MI', name: 'Michigan', fips: '26', region: 'midwest' },
  { abbr: 'MN', name: 'Minnesota', fips: '27', region: 'midwest' },
  { abbr: 'MS', name: 'Mississippi', fips: '28', region: 'southeast' },
  { abbr: 'MO', name: 'Missouri', fips: '29', region: 'midwest' },
  { abbr: 'MT', name: 'Montana', fips: '30', region: 'west' },
  { abbr: 'NE', name: 'Nebraska', fips: '31', region: 'midwest' },
  { abbr: 'NV', name: 'Nevada', fips: '32', region: 'west' },
  { abbr: 'NH', name: 'New Hampshire', fips: '33', region: 'northeast' },
  { abbr: 'NJ', name: 'New Jersey', fips: '34', region: 'northeast' },
  { abbr: 'NM', name: 'New Mexico', fips: '35', region: 'southwest' },
  { abbr: 'NY', name: 'New York', fips: '36', region: 'northeast' },
  { abbr: 'NC', name: 'North Carolina', fips: '37', region: 'southeast' },
  { abbr: 'ND', name: 'North Dakota', fips: '38', region: 'midwest' },
  { abbr: 'OH', name: 'Ohio', fips: '39', region: 'midwest' },
  { abbr: 'OK', name: 'Oklahoma', fips: '40', region: 'southwest' },
  { abbr: 'OR', name: 'Oregon', fips: '41', region: 'west' },
  { abbr: 'PA', name: 'Pennsylvania', fips: '42', region: 'northeast' },
  { abbr: 'RI', name: 'Rhode Island', fips: '44', region: 'northeast' },
  { abbr: 'SC', name: 'South Carolina', fips: '45', region: 'southeast' },
  { abbr: 'SD', name: 'South Dakota', fips: '46', region: 'midwest' },
  { abbr: 'TN', name: 'Tennessee', fips: '47', region: 'southeast' },
  { abbr: 'TX', name: 'Texas', fips: '48', region: 'southwest' },
  { abbr: 'UT', name: 'Utah', fips: '49', region: 'west' },
  { abbr: 'VT', name: 'Vermont', fips: '50', region: 'northeast' },
  { abbr: 'VA', name: 'Virginia', fips: '51', region: 'southeast' },
  { abbr: 'WA', name: 'Washington', fips: '53', region: 'west' },
  { abbr: 'WV', name: 'West Virginia', fips: '54', region: 'southeast' },
  { abbr: 'WI', name: 'Wisconsin', fips: '55', region: 'midwest' },
  { abbr: 'WY', name: 'Wyoming', fips: '56', region: 'west' },
];

export const STATE_BY_ABBR: ReadonlyMap<string, StateInfo> = new Map(STATES.map((s) => [s.abbr, s]));
export const STATE_BY_FIPS: ReadonlyMap<string, StateInfo> = new Map(STATES.map((s) => [s.fips, s]));
export const ALL_ABBRS: readonly string[] = STATES.map((s) => s.abbr);

export function stateName(abbr: string): string {
  return STATE_BY_ABBR.get(abbr)?.name ?? abbr;
}

/**
 * Tiny states that get an enlarged tap target ("callout box") off the
 * Atlantic coast. Ordered north → south so leader lines don't cross much.
 */
export const SMALL_STATES: readonly string[] = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD'];
