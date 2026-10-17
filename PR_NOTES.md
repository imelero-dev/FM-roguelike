# RR-4: Shareable season card + Hall of Fame

## What changes

- **Season card** (`js/card.js`). Every finished run, title or sacking, gets a card drawn on a canvas. It is 1080×1350 (4:5, the portrait size feeds display best) and shows:
  - the club crest and the verdict (Champions / Sacked / Finished Nth)
  - position, points, W-D-L and goals
  - a colour-coded square for every matchday, with the score inside. Boss matches are outlined and matchdays never reached are dashed.
  - the player of the season with their pixel portrait, the top scorer and top assists
  - "new record" chips and the run's Hall of Fame rank

  There are three ways to share it:
  - **Share card**: the Web Share API with the PNG where `navigator.canShare({files})` allows it (mostly phones). Otherwise it saves the PNG and copies the text.
  - **Save PNG**: downloads `relegation-run-<club>-<date>.png`.
  - **Copy text**: a Wordle-style summary with an emoji results strip, using the Clipboard API with an `execCommand` fallback because `file://` has no async clipboard.

  The canvas has `role="img"` and a full `aria-label`.
- **Hall of Fame** (`js/hall.js`, new screen). Each finished run is stored once, keyed by a new `run.id`, as a small self-contained entry in `relegation-run:hall` (versioned). Any old card can be redrawn from its entry.
  - The screen shows career totals (runs, titles, win rate, best finish, most points, best win streak).
  - Runs can be sorted by **Best** (title, then position, points, goal difference, goals, earliest) or **Recent**. The top 3 get medals. Tapping a run opens its card in a modal, with the same share actions.
  - It is reachable from the main menu and the end screen.
  - It is capped at 100 runs and trims from the bottom of the ranking, never the run just played.
- **Records.** First title, best finish, most points, most goals and longest win streak (3 or more) are flagged on the end screen and printed on the card. Equalling a record does not count as a new one.
- **Small extras:**
  - `Esc` closes the card and player-profile modals.
  - Visible `:focus-visible` outlines on buttons.
  - `prefers-reduced-motion` is respected for the new animations.
  - Saves from before this change get a run id when resumed.
  - `Sprite.lienzo()` exposes the portrait as a canvas so it can be drawn onto the card.

## Why

Sharing is how roguelikes spread: Wordle's emoji grid, Balatro and Slay the Spire run screenshots, Spotify Wrapped cards. So I followed those patterns:
- an image sized for social feeds plus a text version that pastes anywhere
- the native share sheet where it exists
- a run history that gives every run, even a bad one, a place and a reason to try again

Everything stays local: no network, no assets, still works from `file://`.

## How to test

```bash
node tests/smoke.js 20                                  # 20 random full seasons
node tests/save.js                                      # 9 save/resume + review tests
node tests/hall.js                                      # 14 new Hall of Fame + season card tests
node --experimental-websocket tests/browser-check.js    # headless Chrome, now also checks the card + Hall of Fame
node --experimental-websocket tests/browser-check.js google-chrome '?mobile=1'
```

All of them pass locally with no console errors or warnings. The only smoke-test deadlock I saw was the known rare squad deadlock, and it happened once in one run of the 20 seasons.

`tests/hall.js` draws the card onto a recording fake 2D context. It checks that every element is present and that no text spills outside the frame, including with very long club and player names. It also covers:
- ranking, including a run sacked while top of the table
- records
- idempotent recording
- the cap and trimming
- corrupt data
- the text format
- the Hall of Fame screen flow

The browser check checks that the real canvas is actually painted. It also checks the accessible label, the modal and closing it with Esc.

To try it by hand, open `index.html` and finish or lose a run (skipping matches is quickest). Then use the buttons on the end screen and open **🏛️ Hall of Fame** from the menu.

## What's left

- **I could not read the spec file.** Access to `/workspace/proyectos-specs/specs.en.md` was denied in this session, so this work is based on the spec title, not its exact Minimum scope / Definition of done. Please check it against the spec.
- **I couldn't visually check the card or regenerate screenshots.** The `SCREENSHOT_DIR=docs/screenshots node --experimental-websocket tests/browser-check.js` command needs approval and wasn't available here. That run would also write `docs/screenshots/season-card.png` and `hall-of-fame.png` for the README. The automated tests check content, bounds and that the canvas is painted, but nobody has looked at the card yet.
- **No device testing.** Web Share with files has not been tried on a real iOS or Android device.
- **Possible follow-ups:** export/import of the Hall of Fame as JSON (a backup across browsers), and a "clear Hall of Fame" option.

## Open decisions for Iván

1. **Card format.** I chose 4:5 portrait (1080×1350). The alternatives are 9:16 for Stories, like Spotify Wrapped, or 1.91:1 for link previews.
2. **What counts as "Best".** Titles first, then football table order. Should a sacking rank below a season that finished lower but was completed?
3. **Hall of Fame size.** It keeps 100 runs. Should it keep everything instead, since entries are about 1.5 KB each?
4. **Tagline on the card.** It prints "ONE SEASON. ONE SHOT." but no URL, because there is no public home for the game yet. Add the URL once there is one?
