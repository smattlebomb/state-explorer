# World data notes (phase 1)

Data for the coming World and Capitals games. Phase 1 adds data only: no screen uses it yet, and the US app is unchanged.

## Files

| File | What |
| --- | --- |
| `world.ts` | Continents, sub-regions, the 195 quiz countries with capitals, and the display-only map shapes. Plain data with no imports. |
| `world/countries-50m.json` | Simplified world TopoJSON (one object, `countries`). Generated: don't edit by hand. |
| `worldGeo.ts` | `loadWorldTopology()`: a lazy dynamic `import()` so the map gets its own chunk and stays out of the US bundle. |
| `stateCapitals.ts` | Capitals of the 50 states, keyed by postal abbreviation (same ids as `states.ts`). |
| `../../scripts/build-world-topo.mjs` | Rebuilds the TopoJSON: `node scripts/build-world-topo.mjs` |

## Sources and license

- Shapes come from **world-atlas 2.0.2** (npm, a dev dependency), which redistributes **Natural Earth 4.1.0** Admin 0 countries. Natural Earth is public domain, and world-atlas is ISC-licensed.
  - Most shapes come from the 1:50m file. **Tuvalu** is missing there, so its shape comes from the 1:10m file.
- Simplification uses topojson-simplify (Visvalingam), keeping about 30% of points (`KEEP` in the script).
  - Rings smaller than about 2000 km² keep every point, so Vatican City, Monaco, Andorra and small islands don't collapse.
  - Coordinates are quantized to 1e5.
  - Result: about 372 KB raw, about 130 KB gzipped.
  - The script and `world.test.ts` both check that no shape collapsed (area > 0) or turned inside out.
- Capitals and sub-regions were written by hand. Sub-regions follow the **UN M49** standard. Capitals follow current official usage (UN / CIA World Factbook style), checked as of November 2026.

## Join key

**The TopoJSON feature `id` is the catalog `id`**, which is the ISO 3166-1 alpha-2 code (`FR`, `JP`, `ZA`, ...). The build script maps Natural Earth shapes to catalog entries like this:
1. It matches the ISO numeric code in world-atlas against `Country.numeric` / `MapTerritory.numeric`.
2. It matches a few code-less shapes by name (`NAME_RULES`):
   - **Kosovo** → `XK`
   - **Somaliland** → merged into **Somalia** `SO`
   - **N. Cyprus** → merged into **Cyprus** `CY`
   - **Ashmore and Cartier Is.** (which shares id 036) → merged into **Australia** `AU`
   - **Indian Ocean Ter.** → `CX`
   - **Siachen Glacier** → `SIACHEN`

The script fails if any shape is unmatched or any catalog entry has no shape.

Ids that are not ordinary ISO country codes:
- **Vatican City `VA` (numeric 336)** and **Palestine `PS` (numeric 275)** are real ISO 3166-1 codes. Both are UN General Assembly observer states, not members.
- **Kosovo `XK`** is a user-assigned code, but it's the one the EU, IMF and most datasets use.
- **`CX`** covers Christmas Island *and* the Cocos (Keeling) Islands, because Natural Earth draws them as one shape.
- **`SIACHEN`** has no ISO code.

## The 195 quiz countries

The 193 UN member states plus the 2 UN observer states (Vatican City, Palestine). Per continent:

| Continent | Count |
| --- | --- |
| Africa | 54 |
| Asia | 48 (incl. Palestine) |
| Europe | 44 (incl. Vatican City) |
| North America | 23 |
| Oceania | 14 |
| South America | 12 |
| Antarctica | 0 |

Every country is in exactly one sub-region, and every sub-region is in exactly one continent (`continentOf()` derives the continent, so they can't disagree).

**Sub-region rule:** UN M49, applied consistently even where kids might expect otherwise:
- **Russia** → Eastern Europe (Europe)
- **Turkey, Cyprus, Georgia, Armenia, Azerbaijan** → Western Asia
- **Kazakhstan** → Central Asia
- **Egypt** and **Sudan** → Northern Africa
- **Mexico** → Central America
- M49 puts all of Latin America in one group. We split it the school way: Caribbean, Central America and Northern America → **North America**; South America → **South America**.
- **Antarctica** gets its own sub-region with no countries, so the display shape has somewhere to live.

**Names:** short, kid-friendly common names, with other names in `aka`. The non-obvious picks:
- **Turkey** (aka Türkiye). The UN name changed in 2022, but US kids' books and maps mostly say Turkey. This is easy to flip.
- **Czechia** (aka Czech Republic)
- **Eswatini** (aka Swaziland)
- **Côte d'Ivoire** (aka Ivory Coast)
- **Cabo Verde** (aka Cape Verde)
- **Myanmar** (aka Burma)
- **Timor-Leste** (aka East Timor)
- **Republic of the Congo** / **Democratic Republic of the Congo**
- **Micronesia** (the country; the sub-region is also called Micronesia)

## Capitals

Every quiz country has exactly one `capital` string, used as the quiz answer. All 195 are different, so "which country has capital X?" always has one answer. `capitalNote` holds the Learn-mode explanation where the story is more complicated:

| Country | Quiz answer | Note mentions |
| --- | --- | --- |
| South Africa | **Pretoria** (executive) | Cape Town (legislative), Bloemfontein (judicial) |
| Bolivia | **Sucre** (constitutional) | La Paz (seat of government) |
| Netherlands | **Amsterdam** (constitutional) | The Hague (government) |
| Eswatini | **Mbabane** (administrative) | Lobamba (royal and legislative) |
| Malaysia | **Kuala Lumpur** | Putrajaya (administrative) |
| Sri Lanka | **Sri Jayawardenepura Kotte** (official) | Colombo (executive, largest city) |
| Côte d'Ivoire | **Yamoussoukro** (official) | Abidjan |
| Benin | **Porto-Novo** (official) | Cotonou (government) |
| Tanzania | **Dodoma** (official) | Dar es Salaam |
| Switzerland | **Bern** ("federal city") | no de jure capital |
| Montenegro | **Podgorica** | Cetinje (old royal capital) |
| Chile | **Santiago** | Valparaíso (Congress) |
| Israel | **Jerusalem** | status disputed; many embassies in Tel Aviv |
| Palestine | **East Jerusalem** (declared) | Ramallah (where the government works) |
| Nauru | **Yaren** | no official capital; Yaren district is the seat of government |
| Burundi, Nigeria, Myanmar, Palau | new capital | the former capital |
| Indonesia, Egypt | Jakarta, Cairo | new capitals being built (Nusantara; New Administrative Capital) |
| Yemen, Sudan | Sanaa, Khartoum | wartime government seats (Aden, Port Sudan) |

Palestine's answer is "East Jerusalem" rather than "Jerusalem". That keeps the capitals unique, and it is the declared capital. If Matt prefers **Ramallah** as the quiz answer, change one string.

## Display-only shapes (not in the 195 quiz set)

`MAP_TERRITORIES` holds 44 extra shapes that are tappable in Learn / explore but **never quizzed**. Each has a name, a kid-friendly `note`, a sub-region and a `status`:

- **`partially-recognized`**: Taiwan (capital Taipei), Kosovo (capital Pristina). Both govern themselves but aren't UN members. They are left out of the quiz on purpose: the quiz set is "UN members + observers".
- **`disputed`**: Western Sahara, Siachen Glacier.
- **`continent`**: Antarctica.
- **`territory`** (with `belongsTo` set to a quiz country id):
  - Denmark: Greenland, Faroe Islands
  - United States: Puerto Rico, Guam, U.S. Virgin Islands, Northern Mariana Islands, American Samoa
  - United Kingdom: Falkland Islands (the note mentions Argentina's claim, Islas Malvinas), Bermuda, the Caribbean territories, Jersey, Guernsey, Isle of Man, and others
  - Netherlands: Aruba, Curaçao, Sint Maarten
  - France: New Caledonia, French Polynesia, and others
  - China: Hong Kong, Macao
  - New Zealand: Cook Islands, Niue
  - Australia: Norfolk Island and others
  - Finland: Åland Islands

  The default note reads like "Guam is a territory of the United States."

Merged instead of shown separately (recognized borders, like UN maps): **Somaliland** into Somalia, **Northern Cyprus** into Cyprus.

## For later phases

- Load the map with `await loadWorldTopology()`, then use `feature(topo, topo.objects.countries)` from topojson-client.
- For borders, `neighbors()` works on the topology because the arcs are shared.
- Tiny countries (Vatican City, Monaco, San Marino, Liechtenstein, Malta, the Pacific and Caribbean islands) will need circle hit targets in phase 2. Their shapes exist but are only a few pixels wide at world zoom.
- `world-atlas`, `topojson-server` and `topojson-simplify` are **dev** dependencies, needed only to rebuild the JSON. Nothing new ships in the app bundle.

## Phase 2: the World map (src/lib/worldMap.ts)

- **Projection: Natural Earth** (`geoNaturalEarth1`), rotated 11° east.
  - It's the familiar school-atlas look: continents keep recognizable shapes, and the poles aren't blown up like Mercator.
  - It beats Equal Earth for a kid: Equal Earth squashes Europe and Africa noticeably.
  - The 11° rotation puts the date-line cut in the empty Pacific, so Russia's Chukotka and Fiji aren't sliced.
  - The view is cropped just below Antarctica's coast. Antarctica shows as a tappable strip, not a giant white band.
- **Levels:** world → continent → sub-region → country.
  - South America has one sub-region, so it skips straight to its countries.
  - Antarctica has no countries; it shows a note instead of zooming.
  - Each zoomed view frames the *main* pieces of that level's **quiz countries** only. Small far-away islands (French Guiana, the Azores, Hawaii) and territories don't stretch the view.
  - Two exceptions are pinned explicitly: **Russia** frames and labels its European part, and **Kiribati** uses the Gilbert Islands around its capital.
- **Tiny places:** 56 quiz countries get round dots. A dot goes on any country narrower than 9 map units at world scale (about 1% of the map width), or with very little land (√area under 3 units, e.g. Tuvalu).
  - **Size:** dots stay a constant size on screen: 4px at world level (12px tap radius) and 9px when zoomed in (22px tap radius).
  - **When they hide:** a dot disappears once the real shape is over 36px wide.
  - **Priority:** tapping a dot wins over the big country around it, so Vatican City and San Marino can be picked inside Italy.
  - **Which places:** territories only get dots inside their own sub-region.
- **Colors:** each continent uses one hue from the same colorblind-friendly family as the US regions (plus pink for Oceania and slate for Antarctica).
  - **World view:** shades are picked so bordering countries differ.
  - **Continent view:** each sub-region gets one shade, and bordering sub-regions differ.
  - **Sub-region view:** countries are shaded individually; the rest of the continent stays faded in its sub-region shades.
  - **Settings:** the existing ⚙️ "Region colors" switch turns all of this off.
- **Zoom:** up to 20× from each level's starting view (the US map stays at 8×). Zoom resets whenever the level changes.

## Canada

The Canada provinces/territories layer (phase 1b) is documented in `CANADA_NOTES.md`.
