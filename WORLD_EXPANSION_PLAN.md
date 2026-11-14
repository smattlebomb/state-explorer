# State Explorer world expansion — phased plan

Work in ~/Projects/state-explorer (Vite + React + TS + Tailwind, d3-geo, vitest, vite-plugin-pwa).
Moni is 9 and uses an iPad. Big touch targets. Kid-friendly tone (Ollie the owl). No harsh language.

Existing US app must keep working. 164 tests must stay green. Do NOT commit or push. Do NOT break or reset localStorage key `state-explorer:v1` or existing US progress/schema in a way that wipes saves. World/capitals progress goes in a NEW storage key (e.g. `state-explorer:world:v1`).

Live later at https://smattlebomb.github.io/state-explorer/ with VITE_BASE_PATH=/state-explorer/.

## Phase 1 — Data foundation (THIS RUN)
- Natural Earth / world-atlas TopoJSON, 50m countries, simplified, suitable for d3-geo.
- Country catalog: 193 UN members + Vatican + Palestine = 195 official quiz/learn countries.
- Also include map shapes for Taiwan, Kosovo, Greenland, and similar commonly-shown territories, with sensible kid-friendly labels (they can be tappable in Learn / map explore). Do not treat them as required members of the 195 quiz set unless you have a clear, documented reason.
- 7 continents, UN-style sub-regions (Western Europe, Southeast Asia, Caribbean, etc.). Every official country maps to exactly one sub-region and one continent.
- Accurate capitals for all 50 US states and all 195 quiz countries. Multi-capital countries: pick a primary for quizzes (South Africa: Pretoria (executive); Bolivia: Sucre as constitutional, mention La Paz; note both in Learn).
- Data integrity tests: 195 countries mapped to sub-regions/continents; all 50 state capitals; every quiz country has a capital and a corresponding map shape (ISO / name match against the TopoJSON).
- Lazy-load ready: world topojson should be importable as a separate chunk (dynamic import), not forced into the main bundle yet if you only add data. Prefer checking a simplified JSON into the repo (public or src/data) or using the world-atlas package — whichever is simpler and license-clean (public domain).
- Add npm deps if needed (world-atlas, maybe topojson-simplify). Keep types strict.
- npm test && npm run build must pass. Do not change game UI in this phase except tiny type exports if needed.
- Write short judgment-call notes in src/data/WORLD_NOTES.md (sources, 195 list, display-only shapes, multi-capitals).
- Canada layer data: 10 provinces + 3 territories (BC, AB, SK, MB, ON, QC, NB, NS, PE, NL, YT, NT, NU), official postal abbrs, capitals listed in the Canada section below, simplified Natural Earth admin-1 (or similar public-domain) shapes, and integrity tests (13 entries, all capitals, all shapes). Progress will use a NEW storage key later — do not touch `state-explorer:v1`.

## Phase 2 — World map + hierarchy + zoom (later)
Hierarchical zoomable world map: continents → UN sub-regions → countries. Projection: d3-geo Natural Earth or Equal Earth. Tiny countries get tappable hit targets (circle markers). Existing pinch/pan +/−/reset zoom works, with a deeper max zoom than the US map's 8×. Region colors by continent, sub-region shading. Home will later get 🇺🇸 USA / 🇨🇦 Canada / 🌍 World. Drilling into Canada zooms to provinces/territories. Don't break USMap.

## Phase 3 — US counties (US-only) + Canada provinces map (later)
Counties stay **US-only**. Zoom/tap into the US (from World, or deep zoom on the USA map) shows states then counties (us-atlas counties-10m, ~3100+). Tap-to-explore only (county name + state), not graded. Lazy-load county data only when needed; runtime-cache it in the service worker for offline.
Canada: drilling into Canada (from World or 🇨🇦 Canada on Home) shows the 13 provinces/territories map (not counties). Same zoom/pan/buttons as other maps.

## Phase 4 — Games at each world level (later)
Learn, Find It, Name It, Quiz/Practice/📝 Test, scoped by continent / sub-region / all countries, mirroring existing US UX (hints, stars, progress). Per-layer progress stored separately from US.
Canada is a full playable layer like the US states: Learn, Find It, Name It, Quiz/Practice/Test, scoped as all 13 (and later regional groups only if it stays simple — default is all 13).

## Phase 5 — Capitals games (later)
State Capitals (50), Province/Territory Capitals (13 — Victoria, Edmonton, Regina, Winnipeg, Toronto, Quebec City, Fredericton, Halifax, Charlottetown, St. John's, Whitehorse, Yellowknife, Iqaluit), and Country Capitals (~195). Learn (tap to see capital + capital dot on the map). Quizzes: "What's the capital of X?" (4 big buttons) and "Which state/province/country has capital Y?" (tap the map). Practice/Quiz/Test, scoped by region where that already applies.

## Phase 6 — Polish, PWA, tests, README (later)
Code-splitting, offline after first use, iPad targets, README, all tests green, production build.

After each phase the human will run npm test && npm run build and may send follow-ups via `claude --continue`.

## Canada — added mid-project (Matt)

Counties stay US-only, as planned.

ADD Canada's 10 provinces + 3 territories as a **full playable layer**, like the US states:

- Drilling into Canada on the World map, or a **🇨🇦 Canada** choice on Home, shows the provinces/territories.
- Games: Learn, Find It, Name It, Quiz/Practice/📝 Test, plus **Province/Territory Capitals**.
- Capitals (exact):
  - Victoria (BC), Edmonton (AB), Regina (SK), Winnipeg (MB), Toronto (ON),
    Quebec City (QC), Fredericton (NB), Halifax (NS), Charlottetown (PE),
    St. John's (NL), Whitehorse (YT), Yellowknife (NT), Iqaluit (NU).
- Public-domain boundary data (Natural Earth admin-1 or similar), simplified.
- Data-integrity tests: 13 entries, all capitals, each has a map shape.
- Track progress in a separate storage key / namespace. Do **not** touch US progress (`state-explorer:v1`).
- Include a Canada screenshot in the final report (Playwright iPad emulation).

Phase 1 should also add the Canada catalog, capitals, simplified admin-1 geometries, and the 13-entry integrity tests if this note is visible in time; otherwise do that immediately after phase 1 via `--continue` before the world map UI.
