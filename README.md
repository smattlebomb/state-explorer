# 🗺️ State Explorer

An iPad-first web app (PWA) that helps kids (about ages 6–10) learn to find the 50 US states on a blank map.

- **Learn**: tap any state to see and hear its name. States you've explored stay lit up.
  - **🏷️ Keep names on the map** (a switch right on the Learn screen, also in Settings, **off by default**): when ON, every state she taps keeps its name on the map. The names build up as she explores, and the tiny Northeast states show theirs in their callout boxes. **🧹 Clear names** wipes them. When OFF, only the last state she tapped is labeled.
  - **🧭 Region tour** walks through one region at a time. It first shows the whole region on the full map and says where it is, then zooms in and visits each state in it from north to south.
- **Find It**: "Tap Ohio!" You get 3 tries, then the app shows you where it is. A round **"i" hint button** gives up to 2 hints per state:
  1. **Shape:** the state's outline on its own card, to match against the map.
  2. **Region:** the state's whole region is shaded, with "It's in the West, the left side of the map."
- **Name It**: one state glows. Pick its name from 4 big buttons.
- **Quiz or Practice:** the setup screen before Find It or Name It has two big buttons.
  - **🏆 Quiz** is graded: stars, streak, mastery and an end-of-round score.
  - **🎈 Practice** has no score at all: unlimited tries, free hints, and a **👀 Show me** button.
  - On the same screen, pick **All 50** or one region. The Find It and Name It cards on the home screen say "Choose your states ➜" so this step is easy to find.
- **Home "Practice next" card:** the big **👆 Find It** button starts the suggested region (the one with the smallest share mastered). Below it, a **"Pick a different region"** row has a chip for each of the 5 regions plus **All 50**, each showing its emoji, region color and mastered count. A chip starts Find It for that region right away, using the current Quiz/Practice choice (shown on the card).
- **Keep names on the map** (on by default): once she gets a state right, its name stays printed on it for the rest of the round. That lets her find the remaining blank states by elimination. The tiny Northeast states show their names inside their callout boxes.
- **Region colors** (on by default): every state is colored by its region, using 5 colorblind-friendly hues with white borders and a small legend. Turn it off in ⚙️ Settings for a harder blank-map challenge.
- **Game feel:** Ollie the explorer owl reacts to every answer.
  - A right answer pops the state with a gold outline and a ✓, with confetti and a cheer word, and builds a combo (🔥 at 3 in a row, 🚀 at 5).
  - A wrong answer gets a gentle wobble and an "oops", never anything harsh.
  - Stars fly in at the end of a round, and newly mastered states sparkle.
  - Optional soft sound effects are generated in the browser, so there are no audio files.
- Each Quiz round earns 1–3 ⭐, there's a daily 🔥 streak, and **My Map** shows every state as Mastered, Learning, or New, grouped by region with a progress bar for each.

Everything runs on the device: no backend, no accounts, no analytics, no ads, no external links. Progress is saved in the browser's `localStorage`. The map data (us-atlas) is bundled with the app, so it doesn't need the internet.

## Live app

The app is hosted on GitHub Pages (HTTPS, free, existing GitHub account):

**https://smattlebomb.github.io/state-explorer/**

On an iPad, open that link in Safari, then **Share → Add to Home Screen**. Because it's HTTPS, the service worker can cache the app for offline use.

The GitHub Actions workflow builds with `VITE_BASE_PATH=/state-explorer/` so asset URLs, the PWA manifest, and the service worker all live under that subpath. Local `npm run dev` and `npm run preview` stay at `/` unless you set `VITE_BASE_PATH` yourself.

## Requirements

- Node.js 20 or newer (built and tested with Node 22) and npm.

## Run it locally

```bash
cd ~/Projects/state-explorer
npm install          # first time only
npm test             # unit + screen tests (Vitest; screen tests run in jsdom)
npm run build        # type-check + production build into dist/
npm run preview      # serve the build at http://localhost:4173
```

For development with hot reload, use `npm run dev` (http://localhost:5173). Press `Ctrl+C` to stop either server.

## Open it on an iPad on the same Wi-Fi

1. On the Mac, build and serve it on your local network:

   ```bash
   npm run build
   npm run preview -- --host
   ```

   Vite prints something like `➜ Network: http://192.168.1.23:4173/`.
   (You can also find the Mac's IP address with `ipconfig getifaddr en0`.)
   If a preview server is already running, you don't need to restart it after a new `npm run build`: it serves whatever is in `dist/`. Just reload the page on the iPad. Over the plain-`http://` Wi-Fi address there's no offline cache in the way. Over HTTPS, the service worker picks up the new version after a reload or two.
2. On the iPad (same Wi-Fi), open **Safari** and go to that Network address, e.g. `http://192.168.1.23:4173/`.
   If macOS asks whether to allow incoming connections for `node`, click **Allow**.
3. Optional: tap **Share → Add to Home Screen** for a full-screen app icon. It works in landscape and portrait.
4. When you're done, press `Ctrl+C` on the Mac to stop the server.

> **Offline caveat:** iPadOS only turns on the offline cache (service worker) for pages served over **HTTPS** or from `localhost`. Over the plain `http://192.168.x.x` address, the app works fine while the Mac is serving it, but it **won't work offline yet**. For true offline use from the home screen, serve the `dist/` folder from any HTTPS static host. It's a static site, so no server code is needed. See BUILD_STATUS.md → *Next steps*.

## Regions (standard 5-region split)

| Region | States |
| --- | --- |
| **Northeast** (11) | Connecticut, Delaware, Maine, Maryland, Massachusetts, New Hampshire, New Jersey, New York, Pennsylvania, Rhode Island, Vermont |
| **Southeast** (12) | Alabama, Arkansas, Florida, Georgia, Kentucky, Louisiana, Mississippi, North Carolina, South Carolina, Tennessee, Virginia, West Virginia |
| **Midwest** (12) | Illinois, Indiana, Iowa, Kansas, Michigan, Minnesota, Missouri, Nebraska, North Dakota, Ohio, South Dakota, Wisconsin |
| **Southwest** (4) | Arizona, New Mexico, Oklahoma, Texas |
| **West** (11) | Alaska, California, Colorado, Hawaii, Idaho, Montana, Nevada, Oregon, Utah, Washington, Wyoming |

This is the common classroom five-region split, with Maryland and Delaware in the Northeast. A unit test checks that all 50 states appear exactly once.

Where each region sits on the map (used by the region hint and the region tour):

| Region | Where |
| --- | --- |
| Northeast | the top right of the map |
| Southeast | the bottom right of the map |
| Midwest | the top middle of the map |
| Southwest | the bottom middle of the map |
| West | the left side of the map (Alaska and Hawaii are the insets at bottom left) |

### Region colors

Each region has its own hue, based on the colorblind-safe Okabe–Ito palette. No two regions are told apart only by red vs. green.

| Region | Hue | Map tints (alternated so bordering states differ) |
| --- | --- | --- |
| Northeast | blue | `#8fc9ee` `#b5dcf6` `#68b3e3` |
| Southeast | bluish green | `#7fd3b5` `#a9e3cd` `#55c19b` |
| Midwest | warm yellow | `#f3e47a` `#f9efab` `#e8d244` |
| Southwest | orange | `#f5bd5a` `#f9d595` `#eea52c` |
| West | purple | `#c3aee8` `#d9cbf2` `#b39be0` |

Which tint each state gets is worked out automatically from the real borders, so that no two bordering states in the same region share a tint (a unit test checks this). State labels are dark text with a white outline, and every tint has at least 7:1 contrast with the label text.

## How scoring and practice work

- **Quiz vs. Practice.** Everything below about stars, streaks and mastery applies to **Quiz** rounds.
  - **Practice** rounds never change stars, the streak, or mastered states, and show no score, grade or combo counter.
  - Practice has unlimited tries and free hints, and **👀 Show me** appears after the first miss.
  - One thing Practice does do: a state she misses there gets a **"needs work"** flag, so it comes up more often (weight ×8) in later rounds. The flag clears the next time she answers that state in a Quiz, or gets it on the first try in Practice.
- **Correct** means correct on the **first try, with no hints**. **Mastered** means correct 3 times in a row. Any miss resets that count.
- **Hints (Find It)** are free to use and unlock one at a time.
  - A state found on the first tap **with** a hint is recorded as *assisted*. That attempt doesn't count toward mastered, but it doesn't erase earlier progress either.
  - A round in which any hint was used earns **at most ⭐⭐**.
  - Hints are read aloud when read-aloud is on.
- **Stars per round** come from accuracy. In Find It, the 1st try is worth 1 point, the 2nd ½, the 3rd ¼, and a revealed answer 0. In Name It, a right answer is 1 and a wrong one 0. 90% or better earns ⭐⭐⭐, 60% or better ⭐⭐, and finishing at all earns ⭐.
- **Practice next (home screen):** suggests the region with the **smallest share** of mastered states. Ties go to the region she has started least. Once everything is mastered, it suggests an All 50 review.
- **Spaced repetition:** each round picks up to 10 states, weighted by how she's doing: just-missed ×8, new ×4, 1-in-a-row ×4, 2-in-a-row ×2, mastered ×1 (×2 if not seen for a week). A state missed in a round also comes back once at the end of that round for extra practice. That retry doesn't change the score.
- **Combo:** in Quiz rounds, first-try answers without a hint in a row build a combo. It shows ⚡ at 2, 🔥 at 3 (with a sparkle sound), and 🚀 at 5 (with a confetti celebration). Any miss or hint resets it. The combo is just for fun and doesn't change stars.
- **Daily streak:** finishing a Find It or Name It **Quiz** round counts as practicing that day. The streak stays alive if she plays today or played yesterday.
- **Reset progress:** on **My Map**, hold the "Grown-ups" button for 3 seconds, then confirm. Settings such as read-aloud are kept.

## Settings (⚙️ on the home screen)

| Setting | Default | What it does |
| --- | --- | --- |
| Read aloud | On | Speaks prompts, hints and state names (Web Speech API) |
| Sound effects | On | Soft ding (right), boop (wrong), sparkle (combo) and fanfare (end of round), synthesized with the Web Audio API. Separate from read-aloud. |
| Region colors | On | Colors states by region. Off = plain blank map |
| Keep names on the map (Find It & Name It) | On | Correctly answered states stay labeled for the rest of the round. Also on the Quiz/Practice setup screen. |
| Keep names on the map (Learn) | **Off** | Every state tapped in Learn (and in the region tour) keeps its name. Also a quick switch on the Learn screen. |

The Quiz/Practice choice is remembered from the last time she picked it.

## Animations and reduced motion

- Every animation finishes in about 1.2 s or less, and the next question starts about 1.3 s after a right answer, so nothing slows her down.
- The pop, wobble and floating words use CSS and framer-motion. Confetti uses canvas-confetti. Both libraries are bundled into the app, so they work offline.
- If the iPad has **Settings → Accessibility → Motion → Reduce Motion** turned on:
  - there's no confetti;
  - states and the owl don't pop, wobble or jump;
  - stars fade in instead of flying;
  - a wrong answer is just a quick red fade.

## Project layout

```
src/
  data/states.ts      50 states (abbr, name, FIPS, region) + small-state list
  data/regions.ts     the 5 regions
  lib/quiz.ts         quiz engine: Quiz + Practice, hints, combo, newly-mastered (pure functions)
  lib/regionColors.ts region color tints (graph coloring over real borders)
  lib/sound.ts        Web Audio sound effects
  lib/celebrate.ts    confetti bursts (canvas-confetti)
  lib/hints.ts        hint wording (shown + spoken)
  lib/learnLabels.ts  which names Learn mode keeps on the map
  lib/regionProgress.ts  per-region progress, "practice next" suggestion, tour order
  lib/srs.ts          spaced repetition + mastery
  lib/streak.ts       daily streak
  lib/storage.ts      localStorage load/save + pure updaters
  lib/hittest.ts      tap → state (with near-miss forgiveness)
  lib/geo.ts          d3-geo AlbersUSA projection of the bundled us-atlas TopoJSON
  lib/speech.ts       Web Speech API read-aloud
  components/         USMap, Mascot (Ollie the owl), ShapeCard, RegionLegend, Toggle, buttons, long-press button
  screens/            Home, Setup (Quiz/Practice + region), Learn (+ region tour), Quiz (Find It + Name It),
                      Results, Progress, Settings (+ HomeScreen.test.tsx, LearnScreen.test.tsx)
  test/render.tsx     tiny jsdom render/click helpers for the screen tests
scripts/
  make-icons.mjs      regenerates public/ icons (node scripts/make-icons.mjs)
  probe-geo.mjs       prints projected state positions (dev helper)
```
