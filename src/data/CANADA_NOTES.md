# Canada data notes (phase 1b)

The data for the Canada layer: 10 provinces and 3 territories, played like the US states. This is data only. No screen, Home button or storage uses it yet. Progress will get its own storage key later and will never touch `state-explorer:v1`.

## Files

| File | What |
| --- | --- |
| `canada.ts` | The 13 provinces and territories: postal abbr, name, kind, quiz capital, Learn note, region. Plain data with no imports. |
| `canada/provinces-50m.json` | Simplified TopoJSON with one object, `provinces`. It is generated, so don't edit it by hand. |
| `canadaGeo.ts` | `loadCanadaTopology()`: a lazy dynamic `import()`, so the map gets its own chunk later and stays out of the US bundle. |
| `canada.test.ts` | Integrity tests (see below). |
| `../../scripts/build-canada-topo.mjs` | Rebuilds the TopoJSON. The download and build commands are at the top of the script. |

## Source and license

- **Natural Earth 1:50m Admin 1 – States, Provinces**, from the official repo `nvkelso/natural-earth-vector`, file `geojson/ne_50m_admin_1_states_provinces.geojson` (master, VERSION 5.2.0-pre, downloaded 2026-11-13).
- **License:** Natural Earth is **public domain**.
- **The raw file is not checked in.** It's 2.3 MB covering many countries; only the generated 60 KB Canada file is in the repo.
- **No new npm packages.** The script reuses the dev dependencies added in phase 1 (`topojson-server`, `topojson-simplify`).

## Join key

**Feature `id` = postal abbreviation** (`BC`, `PE`, `NU`, …). These are Canada Post's official codes. They match the ISO 3166-2 suffix (`CA-BC`), and the build script checks that both Natural Earth fields agree.

## Simplification

The build script:

1. **Fixes ring winding for d3-geo.** GeoJSON files can wind rings the other way, which d3 would draw as "the whole globe minus the province".
2. **Drops islets under 60 km²**, but never a unit's main piece. Only 5 tiny islets go; the 50m source is already generalized.
3. **Simplifies to keep about 30% of points.**
   - Rings under 8,000 km² keep every point, so **Prince Edward Island (about 5,700 km²) keeps its full outline**, along with Cape Breton and the smaller Arctic islands.
4. **Quantizes to 1e5.**

The result is **60 KB raw, about 23 KB gzipped**.

The tests check that every shape is within 10% of Statistics Canada's official total area. The real results are 97–100%, so nothing collapsed or turned inside out.

## Judgment calls

- **"Quebec", not "Québec", for the display name.** It's the usual English spelling in US/English kids' material and is easy to read and say. `aka` keeps `Québec`.
- **The quiz capital is "Quebec City"**, exactly as specified. It avoids "Quebec / Quebec" confusion in a "What's the capital of Quebec?" question. The Learn note mentions the French name.
- **"Yukon"**, not "Yukon Territory". That's the official name since 2003.
- **Capitals are exactly Matt's list.** The quiz-answer test pins all 13 strings.
- **Learn notes** cover the classic mix-ups:
  - Victoria vs Vancouver
  - Edmonton vs Calgary
  - Toronto vs Ottawa (Ottawa is the *national* capital and is in Ontario)
  - Quebec City vs Montreal
  - St. John's being on the island of Newfoundland
  - Iqaluit and Nunavut's 1999 creation
  - PEI being the smallest province
- **Kept separate from the world catalog.**
  - "St. John's" (NL) is also Antigua and Barbuda's capital in `world.ts`. The two layers are quizzed separately, so that's fine. A future *combined* capitals quiz would need to ask about one layer at a time.
  - The Canada outline here (admin-1) and the Canada shape in the world map (admin-0) come from different Natural Earth files, so their coastlines won't match exactly. Phase 2/3 should switch maps when drilling in, not overlay them.
- **`region` field (optional scoping):** West Coast (BC), Prairies (AB, SK, MB), Central (ON, QC), Atlantic (NB, NS, PE, NL), The North (YT, NT, NU). The default plan is still "all 13". The field is just there if regional rounds stay simple.
- **`SMALL_PROVINCES = ['PE']`:** PEI is only a few pixels wide on a whole-Canada map, so it should get a callout or enlarged tap target, like the small Northeast US states. NS and NB are big enough to tap directly.

## Phase 2: the Canada map (src/lib/canadaMap.ts)

- **Projection:** Lambert conformal conic, centered on 96°W, with standard parallels 49°N and 77°N. That's the usual projection for maps of Canada.
- **Prince Edward Island** gets a callout box out in the Atlantic, below Nova Scotia, joined to the island by a dashed line. A test checks that no land is under the box, that tapping it picks PEI, and that tapping PEI itself also works.
- **Zoom:** up to 12×. The US map stays at 8×.
- **Colors:** region colors borrow the US region hues: West Coast purple, Prairies yellow, Central orange, Atlantic blue, North green.
