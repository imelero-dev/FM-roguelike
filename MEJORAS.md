# Improvements log

## Round 2: Relegation Run (branch `mejoras-claude`)

**Summary:** the game is now **Relegation Run — a football management roguelike**. It is fully in English, saves and resumes runs, ends each season with a review screen, and ships with an MIT license and a reference-style README. All tests pass.

- **Rename and translation.** Every UI string, all match commentary, code comments, tests and docs are now English. Every old working title and every reference to commercial games is gone. The Spanish top-scorer term became "Top Scorers" (`run.topScorers`). Position codes are now GK/DEF/MID/FWD. Synergy tags are Academy/Superstar/Physical/Technical. Internal identifiers keep their Spanish names (documented in the README). The repo folder and remote were not touched.
- **Save / resume.** There is one versioned autosave slot (`relegation-run:save`), written after every management action and when a match ends. The main menu shows **Continue** with the team, matchday and gold. Results are locked at full time, so reloading can't replay a match. If you reload on the post-match screen, the run moves on to the next matchday and the unclaimed reward is lost. The card-id counter is saved too, so resumed runs never reuse ids. Corrupt or outdated saves are ignored. **New Run** asks before overwriting a save, and the save is deleted when a run ends. The meta key moved from `rm_meta` to `relegation-run:meta`, with automatic migration.
- **Season review.** The end screen now shows a results strip for every matchday (boss matches outlined), awards (player of the season, top scorer, top assists, league top scorer), a stats table for the whole squad and the final league table. The data comes from the pure function `League.resumenTemporada()`.
- **Tests.** `tests/harness.js` is a shared headless boot that can simulate page reloads. `tests/save.js` has 9 tests covering save/resume, anti-replay, id safety, corrupt saves, overwrite confirmation, the season review and meta migration. I checked that they catch real bugs by breaking the code on purpose. `tests/smoke.js` now uses the harness.
- **Bugs found along the way.** The end screen used `justify-content: center` on a scrolling column, so once the review was taller than the window its top (title and result) was cut off and unreachable; it now centres with auto margins. The half-time **Continue** handler threw if the match had already finished (seen in a slow headless run); it is now guarded. The season's top scorer counts players sold mid-season.
- **Browser check and screenshots.** The headless Chrome check now also reloads the page, resumes with **Continue** using a real click, and renders the season review, in both desktop and `?mobile=1` layouts with 0 console errors or warnings. With `SCREENSHOT_DIR` set it writes the README screenshots (`npm run screenshots`). `package.json` (private, no dependencies) adds `npm test`, `npm run test:browser` and `npm run screenshots`.
- **License and docs.** Added `LICENSE` (MIT) and `lib/LICENSE-phaser.txt`, plus a new English README (quick start, how to play, saving, features, architecture, storage keys, testing, roadmap, contributing). There are no secrets, no external requests and nothing was pushed.

## Round 1 (earlier)

- Fixed suspensions and injuries that were never served, unavailable players being allowed in the XI, and accepting a counter-offer without enough gold.
- Phaser is loaded from `lib/` (works from `file://` and offline), and the stray AudioContext warnings are gone.
- Added the headless smoke test and the headless Chrome console check.

## Still open

1. Difficulty balancing from real play: random play wins about 1 title in 30–100 seasons.
2. A rare deadlock: injuries and sales can leave no playable formation and no gold to sign anyone.
3. Accessibility: keyboard focus, `Esc` to close modals.
4. Testing on real Safari/iOS and Firefox devices.
5. The git history contains author names and email addresses, and authorship is not uniform across this round's commits (it depends on the environment's git identity). Review it before making the repository public.
