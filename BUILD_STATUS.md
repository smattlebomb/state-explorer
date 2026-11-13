# Build status

_Last updated: 2026-11-12_

**Latest round (after Matt's iPad test):**
- The home "Practice next" card has a **"Pick a different region"** chip row.
- Learn mode has a **"Keep names on the map"** option.

The previous round added Quiz vs. Practice, keep-names in Find It and Name It, region color coding, and game feel. Earlier rounds added hints, the region tour, the "practice next" suggestion, and per-region progress.

## Verified

- `npm test`: **143 tests passing** across 11 files. New this round:
  - **Screen tests** (jsdom, rendering the real components and clicking real buttons):
    - `src/screens/HomeScreen.test.tsx`: the suggested region is still the big default button. The chip row has all 5 regions plus All 50 with emoji, region color and mastered counts. Each chip starts Find It for its region with the current Quiz/Practice setting. The Find It and Name It cards still go to the region choice screen and say "Choose your states ➜".
    - `src/screens/LearnScreen.test.tsx`:
      - The toggle defaults to OFF and saves the setting.
      - OFF keeps exactly one label. ON builds labels up through a region tour, and all 4 Southwest names show after a full tour.
      - The tiny Northeast states print their names in their callout boxes.
      - Clear names works, and turning the switch off mid-tour drops back to one label.
    - I checked that these tests catch bugs: breaking the label logic on purpose made 4 of them fail.
  - `src/lib/learnLabels.test.ts` (label rules), plus additions to `regionProgress.test.ts` (chip data) and `storage.test.ts` (new setting, default and migration).
- Existing test files:
  - quiz engine: Quiz + Practice, hints and the 2-star cap, "Show me", combo counter, newly-mastered states (`src/lib/quiz.test.ts`)
  - spaced repetition: "assisted" answers, Practice "needs work" flags (`src/lib/srs.test.ts`)
  - region colors: graph coloring, real state borders, no same-tint neighbors, palette hues and contrast (`src/lib/regionColors.test.ts`)
  - region progress, the "practice next" suggestion, tour order, hint wording (`src/lib/regionProgress.test.ts`)
  - region lists: all 50 states exactly once (`src/data/regions.test.ts`)
  - streak logic, including month, year, leap-day and DST boundaries (`src/lib/streak.test.ts`)
  - hit testing on the real map geometry, including the wider callout boxes (`src/lib/hittest.test.ts`)
  - storage: parsing, settings defaults and migration, Practice never touching stars, streak or mastery (`src/lib/storage.test.ts`)
- `npm run build`: passes (TypeScript type-check + Vite build). The JS bundle is about 574 KB (189 KB gzipped). The service worker precaches 14 files, about 610 KB in total.
- I didn't start any server this round. Your preview server that's already running from `dist/` serves the new build; just reload the page on the iPad.

**Not verified:** I still couldn't open the app in a real browser or on an iPad here, because browser and screenshot tools weren't available. So layout, colors on screen, animations, sounds, touch feel and speech are **untested on a device**. The new animations and the crowded Find It top bar are the most likely things to need tweaking. Please do the hands-on checklist at the bottom first.

## What works (implemented)

### New this round
- **Home "Practice next" card:**
  - **Top row (unchanged):** the suggested region, with **🧭 Tour** and a big **👆 Find It** default button.
  - **New "Or pick a different region" row:** six chips, one for each of the 5 regions (emoji, region color, "🏆 mastered / total") plus **🇺🇸 All 50**.
  - Chips are at least 80 px tall, 2 per row in portrait on a phone, 3 on an iPad in portrait, and 6 in landscape.
  - Tapping a chip starts **Find It** for that region right away, using the current Quiz/Practice setting, which the row shows ("starts Find It · 🏆 Quiz").
  - The suggested region's chip has a yellow ring so the two rows clearly match.
- **Find It / Name It cards** on the home screen now carry a "Choose your states ➜" pill, so it's obvious they lead to the Quiz/Practice + region screen. They still go there, and a test checks it.
- **Learn "Keep names on the map":**
  - A switch right on the Learn screen, under the map ("🏷️ Keep names on the map: ON/OFF", 64 px tall, green when on). The same setting is in ⚙️ Settings as "Keep names on the map (Learn)". It's saved in localStorage and **defaults to OFF**.
  - **ON:** every state she taps keeps its name, so the labels build up as she explores. The tiny Northeast states put their names in their callout boxes.
  - It works the same in the **region tour**: Next, Back and tapping states all add names, and after finishing a tour the whole region is labeled.
  - **🧹 Clear names** removes the built-up names. It only shows when there's something to clear.
  - **OFF:** exactly the previous behavior.
  - **Readability:** labels are dark text (`#0f172a`) with a white outline. Every region tint has at least 7:1 contrast with that text (already unit-tested), and the state she's on is drawn last, so its label sits on top of any neighbor it overlaps.

### Map
- A US map built from the bundled us-atlas `states-10m.json` with d3-geo `geoAlbersUsa`, so Alaska and Hawaii are insets. DC and the territories are filtered out. It scales to fill the screen in either orientation.
- **Region colors (on by default):** each state is filled with its region's hue: Northeast blue, Southeast bluish-green, Midwest warm yellow, Southwest orange, West purple, based on the colorblind-safe Okabe–Ito palette.
  - Each region has 3 tints. The tints are assigned by **graph coloring over the real borders** (TopoJSON arcs), so no two bordering states in the same region share one.
  - White borders, and a small region legend under the map.
  - Turning this off in Settings gives the plain cream blank map with slate borders.
- **Small states:** VT, NH, MA, RI, CT, NJ, DE and MD each get a callout box off the Atlantic coast, joined to the state by a dashed leader line. Tapping the box counts as tapping the state.
  - The boxes are wider now (116 units), so full names fit inside when a name is shown. "New Hampshire" and "Rhode Island" wrap onto two lines.
- **Near-miss forgiveness:** a tap outside every state goes to the nearest state within 16 screen pixels. Drags of more than 24 px are ignored.
- **Labels:** full state names in dark text with a white outline. Long names on narrow states wrap onto two lines.

### Quiz vs. Practice
- The **setup screen** (after picking Find It or Name It) has two big buttons, **🏆 Quiz** and **🎈 Practice**, plus a **Keep names on the map** toggle and the region tiles, which start the round. The last Quiz/Practice choice is remembered.
- **Quiz:** works as before: Find It gives 3 tries, Name It 1 pick, then stars, streak, mastery, the combo counter and a graded results screen.
- **Practice:**
  - Unlimited tries in both modes. Free hints.
  - **👀 Show me** appears after the first miss.
  - No hearts, no combo counter, no score.
  - The end screen just says "Practice done! 🎈", lists the tricky states, and offers Play again.
  - Practice never changes stars, the streak or mastery. A missed state gets a "needs work" flag that boosts it (×8) in later rounds.

### Keep names on the map (on by default)
- Once a state is answered correctly, its name stays printed on it for the rest of the round, in its callout box for tiny states. Revealed (missed) answers don't stay labeled.
- It works in both Quiz and Practice, and in both Find It and Name It.

### Game feel (all animations ≈1.2 s or less)
- **Right answer:**
  - The state **pops** (scales up, then settles) with a **bright green fill, a gold outline over a dark under-outline, and a ✓ badge**, so it stays obvious on top of any region color.
  - A **burst of stars and confetti** comes out of the state, and a **floating "+1 Nice!"** cheer rises from it. The cheer word varies: Nice!, Awesome!, You got it!, Wow!, and so on.
  - A soft two-note **ding**, and Ollie hops happily.
  - The next question starts about 1.3 s later.
- **Combo (Quiz only):** a counter under the question number: ⚡2, then **🔥3** with a sparkle sound and a "🔥 3 in a row!" float, then **🚀5** with confetti cannons from both sides and a "🚀 5 in a row!" float. It repeats every 5.
- **Wrong answer:**
  - The tapped state does a **gentle wobble with a quick soft red flash** that fades in 0.7 s, plus a soft low **boop**. It's never a buzzer.
  - **Ollie does an "oops" face**: wide eyes, raised brows, a little "o" mouth, a sweat drop, a head tilt.
  - The banner says "Oops! That's Indiana. Try again!" or "Almost! …", and the tapped state's name shows on the map.
  - In Name It, the picked button wobbles and is greyed out.
- **End of a Quiz round:**
  - **Stars fly in one at a time** (spinning drop, 0.3 s apart) with a fanfare. Ollie celebrates, and 3 stars adds confetti cannons.
  - **Newly mastered states sparkle** (✨ chips that pop in), and the best combo is shown.
  - There's a big **Play again** button.
- **Ollie the explorer owl:** a simple SVG owl in a green safari hat with four moods: idle (blinks), happy, oops and celebrate. He's on the home screen, in the game top bar, and on the end screens.
- **Sound effects (Settings, on by default; separate from read-aloud):**
  - a ding for right, a boop for wrong, a sparkle for combos, a fanfare at the end, and a soft pop for hints;
  - all synthesized live with the **Web Audio API** (sine/triangle waves, gentle attack and release, quiet volume), so there are no audio files;
  - iOS needs a touch before audio can play, so the first touch starts it.
- **Reduced motion:** when the iPad's Reduce Motion is on, there's no confetti and nothing pops, wobbles, jumps or flies. framer-motion runs with `reducedMotion="user"`, stars fade in, and a wrong answer is just a quick red fade.

### Hints (Find It)
- A round amber **"i"** button (64 px) in the top-right corner beside the prompt. A badge shows how many hints are left.
- **Hint 1, Shape:** the target's silhouette on a card, placed in the map corner diagonally opposite the target.
- **Hint 2, Region:** with region colors on, **every other region is dimmed** (25% opacity) so the target's region stands out. With colors off, the region gets a soft tint. Either way it says "It's in the West, the left side of the map."
- In Quiz, a round that used any hint is capped at ⭐⭐, and a hinted answer is saved as *assisted*: it doesn't count toward mastered. In Practice, hints are simply free.

### Other modes and screens (from earlier rounds, updated)
- **Learn:** tap a state to see and hear its name. Explored states light up **in their region color**, or a cheerful palette when region colors are off.
  - **Region tour** walks a region state by state. With colors on, the other regions are dimmed during the tour.
- **Name It:** the target pulses orange; read-aloud says the 4 choices.
- **Region rounds** zoom to the region; other states are faded and can't be tapped.
- **Home:** streak, stars and mastered count, a "Practice next" suggestion, the mode cards, My Map, and **⚙️ Settings**.
- **Settings:** big ON/OFF switches for Read aloud, Sound effects, Region colors (with the legend) and Keep names on the map.
- **My Map:** mastery-colored map, per-region progress bars, and the hold-for-3-seconds reset.
- **PWA:** the manifest, auto-updating service worker and icons are unchanged. framer-motion and canvas-confetti are bundled, so everything still works offline.
- **Privacy:** no network calls, no analytics, no external links, no accounts.

## Decisions I made

### Latest round (home region chips, Learn keep-names)
A. **What "OFF = current behavior" means in Learn.** Matt described the current behavior as "the name shows, then fades after a couple of seconds". In the code, though, the last-tapped state's name **stays on the map until she taps another state**, and nothing fades. Since he also asked for the default to leave current behavior unchanged, I kept the real current behavior for OFF and **did not add a fade**. If he wants the fade, it's a small change: clear the selected label about 2.5 s after a tap when OFF.
B. **The Learn keep-names setting is separate from the Find It/Name It one** (`learnKeepNames`, default OFF, vs. `keepNames`, default ON). The defaults differ, and Matt may want them set differently. Settings lists both, labeled "(Find It & Name It)" and "(Learn)".
C. **Built-up names last for the Learn visit only**, not across app restarts. Which states she has *explored* is still saved, as before, and that's what the explored counter and colors use. A map full of old labels the next day would be clutter.
D. **Clear names keeps the current state's label**, so the state she's looking at (or the current tour step) doesn't lose its name. The button hides when there's nothing to clear.
E. **Switching keep-names ON starts from the current state; switching it OFF throws the list away**, so turning it back on doesn't bring back a stale pile of names.
F. **Labels carry over between tour regions** (for example after "Next region ➜"), so the map keeps filling up across a session. Clear names is there if it gets busy.
G. **The chip row always lists all 5 regions plus All 50**, including the suggested one. The suggested chip gets a yellow ring rather than being hidden, so the row's layout never shifts. When everything is mastered, the big default button is All 50.
H. **The chips start Find It** (as Matt asked), not Name It. To play Name It in a region, use the Name It card.
I. **"All 50" uses a slightly darker blue (`sky-600`)** on its chip and on the setup-screen tile, to meet 3:1 contrast with the white text.
J. **Screen tests use jsdom plus React's `act`**, with a ~60-line helper (`src/test/render.tsx`) instead of adding a testing library, so no new dependencies. Taps *on the map itself* can't be simulated in jsdom (it has no SVG geometry), so the Learn tests drive labels through the tour buttons. Map taps go through the same `showState` code path.

### Previous round
1. **Practice has "👀 Show me" after the first miss.** With unlimited tries, she needs a way out of a state she just can't find. A shown answer gets the usual one retry at the end of the round.
2. **What "Practice feeds needs-work" means:** a Practice miss sets a `needsWorkAt` flag, which gives that state top priority (×8). Streak, counts and mastery are never touched, so Practice can't un-master a state either. The flag clears on her next Quiz answer for that state, or on a first-try Practice answer.
3. **Practice states stay "New"** on My Map if she has never been quizzed on them. Practice doesn't count as progress.
4. **The Practice end screen has no stars, percentage or "first try" count**, just "You practiced N states" and the tricky ones as chips she can tap to hear.
5. **Keep-names applies only to states she got right**, not ones that were revealed. Otherwise a reveal would give away a free label. In Name It, labels are fine because the question is about the highlighted state.
6. **The combo counts only first-try, no-hint answers** (the same rule as "correct" for mastery). Any wrong tap resets it. A 2nd-try correct or a hinted answer doesn't extend it. It's visual only and doesn't change stars.
7. **Combo milestones:** a 🔥 badge, sound and float at 3. A 🚀 badge with confetti cannons at 5, 10, 15 and so on. ⚡2 shows so she can see it building.
8. **Correct feedback = green fill + gold outline with a dark under-stroke + ✓ badge + pop.** Green alone could blend with the Southeast's bluish-green tints. The outline, check mark and motion make it unmistakable for colorblind players too.
9. **Wrong feedback is a flash, not a lasting tint.** I removed the old persistent pink, so the region colors stay readable. The name of the last wrong tap still shows.
10. **The region hint with colors on dims the other regions** rather than re-tinting, because the region already has its color. With colors off, it keeps the soft tint.
11. **Palette:** Okabe–Ito-based hues, lightened into tints that pass **≥7:1 contrast** with the label text (unit-tested). The darker region button colors keep **≥3:1** for their large white text. I lightened one purple tint during testing to meet 7:1.
12. **The callout boxes got wider** (76 → 116 units) to fit full names. The map shrinks very slightly (its right edge moved from x = 938 to 925) to make room.
13. **Sounds are synthesized** (Web Audio), quiet (gain ≤ 0.16), and rounded (sine/triangle, soft envelopes, nothing below ~220 Hz). The "wrong" sound is a gentle downward boop, never a buzzer.
14. **The mascot is an owl ("Ollie")** rather than a map pin. A face makes the "oops" reaction readable at 64 px.
15. **The Quiz/Practice choice is remembered** as a setting, so a child who prefers Practice doesn't have to switch every time. The home "Practice next" card and the tour's "Play Find It here" use the remembered choice.
16. **Bundle size:** framer-motion and confetti, plus this round's code, add about 173 KB (58 KB gzipped). I raised Vite's chunk-size warning limit rather than splitting the code, because for a precached offline app splitting doesn't help.

### Earlier rounds (still true)
17. "Correct" means first-try correct with no hints. Mastered = 3 in a row, and any miss resets it.
18. Quiz stars are always ≥ 1: 3 stars needs 90%+, 2 stars needs 60%+. Find It gives partial credit for the 2nd and 3rd try.
19. Quiz Name It allows 1 pick, then shows the answer.
20. Missed states repeat once at the end of the round. These retries don't affect score or mastery.
21. Round length is 10, or the region size if smaller.
22. Name It distractors come from the selected region.
23. Only Quiz rounds count for the daily streak. Learn and Practice don't.
24. Streak days are local calendar dates.
25. Callout boxes are unlabeled until that state is labeled, so they don't give away Find It answers.
26. Out-of-region taps are ignored.
27. Hinted answers are "assisted": they don't advance mastery but don't reset it either. The 2-star cap applies only to hints on scored questions.
28. The automatic dashed circle after 2 misses stays, separately from the hint button.
29. "Practice next" uses the share of a region mastered, not the raw count.
30. Compass words: West is "the left side of the map".
31. The tour intro shows the whole country first.
32. A single versioned `localStorage` key. Old saves pick up the new settings with their defaults automatically (tested).

## Known limitations

- **Hosted on GitHub Pages (2026-11-13):** https://smattlebomb.github.io/state-explorer/ — HTTPS, public repo `smattlebomb/state-explorer`, deployed with GitHub Actions (`actions/deploy-pages`). Verified: `/` returns 200, JS/CSS/manifest/icons load, and the service worker is registered at scope `/state-explorer/` (`sw.js` controlling the page). The Vite `base` is `/state-explorer/` only when `VITE_BASE_PATH` is set (CI); local `npm run dev` / `npm run preview` stay at `/`.
- **Offline on the iPad:** works on the GitHub Pages HTTPS URL (Add to Home Screen in Safari). The LAN preview (`http://192.168.4.26:4173` or Tailscale) still will not cache offline, because iPadOS will not register a service worker over plain HTTP.
- **Learn with keep-names ON can get crowded** in the Northeast and around the Chesapeake when many names build up. Labels may overlap a little (the state she's on is always drawn on top). The callout boxes help for the 8 tiniest states. Clear names is the escape hatch.
- **The Find It top bar is busy:** Home, Ollie, the prompt, counter/combo, the "i" button and 🔊. In portrait, long prompts like "Tap North Carolina!" may wrap onto two lines. It still fits, but it's the first thing to check on the iPad.
- Confetti is drawn on a full-screen canvas. On older iPads, a 🚀 combo plus a ✓ burst at the same moment may stutter briefly.
- Speech and sound effects can overlap (a ding while the cheer is being spoken). They're at different pitches and both are short, but turn one off if it's too much.
- Speech quality depends on the voices installed on the iPad.
- In single-region Find It rounds, hint 2 adds little, because the map is already zoomed to that region.
- On the shape card, very small states are scaled up, so their size isn't comparable to the map.
- Near-miss taps go to the *nearest* state.

## Next steps / ideas

- **Hands-on checklist:**
  - **New:** on Home, tap a chip in "Pick a different region" (for example 🌽 Midwest). It should start Find It there right away. Check the chip row fits nicely in portrait (3 across) and landscape (6 across).
  - **New:** in Learn, turn on "Keep names on the map", tap 10 or so neighboring states (try the Northeast), and check the names stay readable where they crowd together. Then use Clear names, and run a Region tour with it on.
  - **Done:** Learn with Keep names OFF keeps the name until she taps another state (Matt chose this on 2026-11-13).
  - Play a Quiz and a Practice round of each mode, in portrait and landscape.
  - Check that the green ✓ stands out on Southeast states with region colors on.
  - Get 5 in a row to see the 🚀 celebration.
  - Turn on Reduce Motion (Settings → Accessibility → Motion) and replay.
  - Toggle each setting and check it sticks after relaunching.
  - Check the names fit in the callout boxes ("Massachusetts").
  - Repeat the earlier checks: tiny-state callouts, long-press reset, Add to Home Screen.
- **True offline install:** done 2026-11-13 — https://smattlebomb.github.io/state-explorer/
- Sticker or badge rewards per region, such as a region's outline filling in once all its states are mastered.
- Ollie hats and costumes unlocked with stars.
- A third, region-aware hint for region rounds, such as shading the target's neighbors.
- Smaller clusters within regions (New England, Mid-Atlantic, Four Corners).
- A "tour, then quiz" flow on exactly the states just toured.
- Pinch-to-zoom and pan in the All 50 view.
- "Capitals" and "Neighbors" modes.
- Multiple player profiles for siblings.
- A parent view with per-state history, and export/import of progress.
- A Playwright smoke test once a browser is available.
