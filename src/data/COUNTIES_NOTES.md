# US counties notes (phase 3)

Counties are **US-only** and **tap-to-explore only**. There are no quizzes, stars, mastery or saved progress for them. Canada stays at provinces and territories.

## How she gets there

1. Open **Learn** on the USA map (from Home, or from 🌍 World → United States → **Explore the 50 states**).
2. Tap a state.
3. Tap the **🔎 Counties in Ohio** button that appears.

The counties view zooms to that state and draws its counties, with the other states faded around it:

- Tap a county to see and hear its name and state, e.g. "Franklin County, Ohio".
- Tap a different state to switch to its counties.
- **◀ Back to the 50 states** returns to Learn.

**Why a button instead of auto-showing counties on deep zoom:** a 9-year-old zooming into the US map (especially during Find It or a Test) shouldn't suddenly get a map where taps mean something else. The button is explicit, works the same from Learn and from the World map, and keeps `USMap` and every state game exactly as they were. The state games stay at their 8× max zoom; the counties view zooms to 16× from the whole-state view.

## Data

- **Source:** `us-atlas` 3.x `counties-10m.json` (US Census Bureau cartographic boundaries, 2017, 1:10m; public domain; ISC packaging). It has 3,231 features.
- **What's used:** the 3,141 counties and county equivalents of the 50 states. DC (11001) and the territories (60, 66, 69, 72, 78) are left out.
- **Projection:** the same AlbersUSA projection object as the state map (`getMapGeometry().projection`), so county lines match state lines. A test checks this.
- **Feature ids:** 5-digit FIPS codes. The first 2 digits are the state FIPS in `states.ts`, so `stateOfCounty()` is a lookup.
- **Only one state at a time:** only the focused state's counties are projected and drawn (at most 254 for Texas), and each state is cached after its first use.

## Loading and offline

- `src/data/countiesGeo.ts` loads the file with a dynamic `import()`. Vite puts it in its own chunk, `assets/counties-10m-[hash].js` (≈842 KB raw, ≈260 KB gzipped), and nothing in the initial bundle refers to it except that lazy import.
- **Service worker** (`vite.config.ts`):
  - The chunk is left out of the precache (`globIgnores`).
  - A runtime route (`CacheFirst`, cache name `us-counties`, max 2 entries) stores it the first time she opens counties. After that, counties work offline.
  - CacheFirst is safe because the file name contains a content hash. A new build gets a new name, and the old copy is trimmed.

## Names

us-atlas gives bare names ("Franklin"), so `countyLabel()` adds the right word:

| Where | Label |
| --- | --- |
| Most states | Franklin **County** |
| Louisiana | Orleans **Parish** |
| Alaska | Kenai Peninsula **Borough**, Bethel **Census Area**, Juneau **City and Borough**, Anchorage **Municipality** |
| Independent cities | Richmond **(city)** (vs Richmond County), Baltimore (city), St. Louis (city), Carson City |

- Virginia's independent cities are all codes 510 and above. Texas codes above 500 (e.g. 48501 Yoakum) are ordinary counties.
- Alaska uses the 2017 boundaries: Valdez-Cordova had not been split yet.

## Tapping

- **Tiny counties** (Virginia's small cities, for example) get dots while they are under about 14px on screen. A dot wins over the county around it, just like the micro-states on the World map.
- **Near-misses:** a tap within 8px of a county still counts.
- **Gestures:** pinch and pan use the shared `ZoomMap` and never count as a tap. This was checked on a real touchscreen in Chrome's iPad emulation.
- **Colors:** each county gets one of 5 tints of its state's region color. They are picked with a fast greedy (DSatur) coloring so that bordering counties never match. A few states need a 5th tint.
