# RR-4: Shareable season card + Hall of Fame

## What changes

- **Season card** (`js/card.js`). Every finished run, title or sacking, gets a card drawn on a canvas. It is 1200×630 (1.91:1, the size the RR-4 definition of done asks for, and what link previews and most feeds expect) and shows:
  - the club crest and the verdict (Champions / Sacked / Finished Nth)
  - position, points, W-D-L and goals
  - a colour-coded square for every matchday, with the score inside. Boss matches are outlined and matchdays never reached are dashed.
  - the player of the season with their pixel portrait, the top scorer and top assists
  - the rarity mix of the final starting XI (legendary / epic / rare / common)
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
  - It keeps up to 20 runs (per the spec) and trims from the bottom of the ranking, never the run just played.
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
node tests/hall.js                                      # 15 Hall of Fame + season card tests
node --experimental-websocket tests/browser-check.js    # headless Chrome, now also checks the card + Hall of Fame
node --experimental-websocket tests/browser-check.js google-chrome '?mobile=1'   # now in a phone-sized window
SCREENSHOT_DIR=docs/screenshots node --experimental-websocket tests/browser-check.js   # README screenshots
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

## Follow-up session (screenshots, spec check)

The spec was readable this time, so I checked the work against it and looked at the real screenshots.

- **Card size.** The spec's definition of done asks for a **1200×630 PNG**, so I redrew the card as a two-column landscape layout (result on the left, people on the right). Open decision 1 below is settled by the spec.
- **Final XI rarities.** The spec lists "best XI rarities" on the card. Entries now store the rarity count of the last starting XI. Cards for older entries show a dash.
- **Branding.** The subtitle is now "A football roguelike" (it used to say "football management"). A test fails if "Football Manager" or "Pichichi" is drawn on the card. Neither appears anywhere in the code.
- **Hall of Fame.** It keeps 20 runs, per the spec. The tiles now read "Title rate" (it was titles ÷ runs, labelled "Win rate") and "Win streak", which no longer wraps.
- **Bug: end screen cut off.** The end screen centred its content inside a scrolling flex column. Once the season review was taller than the viewport, the title and the season card sat above the scroll area and could not be reached. Now fixed, and the browser check asserts it.
- **Bug: half-time crash.** "Continue" at half-time could fire after the match had already ended and throw (`match.js`). Now guarded.
- **Browser check.**
  - `?mobile=1` now runs in a phone-sized window instead of a 1280px desktop window with the mobile class.
  - Leftover toasts are cleared before the Hall of Fame screenshot.
- **Screenshots** `season-card.png` and `hall-of-fame.png` were regenerated and added to the README. I looked at both, and at the card on the end screen on desktop and phone. Text stays inside its panels.

## What's left

- **The screenshots come from a two-matchday run.** The browser check ends the run after two matches, so most of the season strip in the README image is empty and the verdict reads "Finished 2nd · Only the title would do". A full 14-matchday screenshot would look better but means playing a whole season in the browser check.
- **Storage differs from the spec's wording.** The spec says to extend `rm_meta` with the season list. The Hall of Fame lives in its own versioned key, `relegation-run:hall`, so a missing, old or corrupt `rm_meta` cannot wipe it. That still meets the definition of done ("survives a missing/old `rm_meta`"), but Iván should confirm.
- **No seed on the card.** The spec says "seed if available", and runs have no seed yet. RR-3 would add one.
- **The browser check is flaky under load.** It sometimes times out waiting for the match or post-match screen. The base commit `6478da4` does the same, failing 1 run in 4. It passed 8 runs in a row after the half-time fix, and the final desktop and mobile runs were clean.
- **In-page card size on phones.** The card is readable in the exported PNG. In the page on a phone its small labels are tiny, because it is a scaled-down 1200px landscape image.
- **No device testing.** Web Share with files has not been tried on a real iOS or Android device.
- **Possible follow-ups:** export/import of the Hall of Fame as JSON (a backup across browsers), and a "clear Hall of Fame" option.

## Open decisions for Iván

1. **Card format.** Settled by the spec: 1200×630. A second 9:16 Stories export could be added later.
2. **What counts as "Best".** Titles first, then football table order. Should a sacking rank below a season that finished lower but was completed?
3. **Hall of Fame storage.** 20 runs as the spec says, but in its own key rather than inside `rm_meta` (see above). OK?
4. **Tagline on the card.** It prints "ONE SEASON. ONE SHOT." but no URL, because there is no public home for the game yet. Add the URL once there is one?
