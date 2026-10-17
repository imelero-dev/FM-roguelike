# RR-2: Match presentation, half-time card and commentary

Branch `rr-2-match-presentation` (based on `mejoras-claude`). Spec: RR-2 in `specs.en.md`. The goal replay is deliberately left out, as the spec asks.

## What changed

- **Commentary variety** (`js/commentary.js`, new, pure, no DOM). Every feed event has 3-5 phrasings, with separate pools for penalties and headers. Each match gets its own commentator, which never uses the same phrasing for two consecutive events of one kind.
- **Big-chance call.** When a shot leaves the boot with engine xG ≥ 0.4 (about the top 10% of shots, roughly 1.2 per match), the feed calls it while the ball is in flight ("Big chance! X is through on goal…"). Penalties are excluded because they already have their own call. The call only appears in visual mode, so the skip summary stays short.
- **Half-time card**, built on the existing panel (no duplicate UI). It adds team names and keeps possession, shots (on target), xG and fouls. New: the **top performer** (highest live rating on the pitch, with team, position and goals/assists/saves) and the **two key moments** of the half. Moments are ranked goals > red cards > penalty misses/saves > woodwork > big chances and shown in match order. A quiet half gets a fallback line. The tactics board is unchanged below it.
- **Engine.** Shot events (`tiro_va`, `tiro`, `gol`) now also carry `xg`, `cabeza` and `penalti`. This is commentary data only: no gameplay, balance or RNG changes.

## Tests

- New `tests/presentation.js` (7 tests, added to `npm test`):
  - no repeated phrasing in two consecutive same-type events, over 40 real engine matches and with worst-case random sources;
  - at least 3 phrasings per event kind;
  - big-chance thresholds and frequency;
  - penalty phrasing;
  - the half-time summary data (score, possession, shots, xG, top performer = highest rating, key moments ≤ 2 in order, goals always included);
  - the card rendered through the real visual match path (fake Phaser), then the match finishes.
- `tests/browser-check.js` asserts the card in Chrome (score, possession/shots/xG rows, top performer with rating, 1-2 key moments) and saves `half-time.png` in screenshot mode. A new `WINDOW_SIZE` env sets the window size.
- Results: `node tests/smoke.js 20 && node tests/save.js` passes, `node tests/presentation.js` passes (10/10 repeat runs), and `browser-check.js` passes on desktop and `?mobile=1` with 0 console errors.
- **Flaky under load:** on this shared machine (load average ~13 on 8 cores, other sessions running Chrome), the mobile browser check sometimes hits its fixed 60 s waits while the match is still playing. The **base commit fails the same way** under the same load. Clean runs take ~55 s on both. I did not change the timeouts.

## Assets

- `docs/screenshots/half-time.png` (desktop) and `half-time-mobile.png` (`?mobile=1`), from the browser-check screenshot mode.
- `docs/screenshots/goal-half-time.gif`: 8 s, 640 px, ~2 MB, a goal followed by the half-time card (the spec's DoD asset). It was recorded once from a headless Chrome screencast with a throwaway script that is not committed.
- The other README screenshots were not regenerated, to avoid binary churn.

## Follow-ups

- Goal replay: needs a ring buffer of positions in the engine.
- The phone-landscape half-time card scrolls inside the stage (unchanged pre-existing layout); a compact two-column variant could fit it on one screen.
