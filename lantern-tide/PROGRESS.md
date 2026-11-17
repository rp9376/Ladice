# Lantern Tide — build progress

> **Next steps are planned in `NEXT.md`.** Start there on the next run.

Working notes for whoever (human or agent) picks this up next. The design is in `PLAN.md`;
the owner has said the plan is a starting point and may be improved on.

## Toolchain

- Node 22 is installed but `npm` is not. Use corepack: `corepack npm install`, `corepack npm run dev`, `corepack npx vitest run`.
  Set `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` in non-interactive shells. `package.json` pins `npm@10.9.2`.
- End-to-end tests use the system Chrome (`channel: 'chrome'`), so no Playwright browser download is needed.
- Headless Chrome only reaches 60 FPS with the real GPU (`--use-angle=gl --enable-gpu`). Software rendering manages about 7 FPS at 1080p,
  so tests pass `?res=640`. `PW_GL=swiftshader` forces software rendering for CI.
- Dev helpers in `shots/` (dev server must be running on 5173):
  - `node shots/shot.mjs "?leg=patrol&biome=ice&seed=3&bot" shots/out.png 5000` takes one screenshot.
  - `node shots/tour.mjs` walks title → chart → leg → tally → harbour → menus → ending and saves each screen.
  - `node shots/fps.mjs` measures real frame rate per GL backend.
- Debug URL parameters: `?leg=<kind>&biome=<id>&seed=N&diff=N&planks=N&crew=a,b&level=N` jumps straight into one leg;
  `&bot` lets the autopilot sail; `&seeall` and `&god` turn on those mutators; `?notutorial` skips the first-run tutorial; `?res=960` lowers render resolution.
- In a leg, **F1** toggles the debug overlay (hitboxes, AI states, lantern radius, seed).

## Done

- **Simulation** (`src/sim`): complete; 45 unit tests. The autopilot beats every boss.
- **Meta** (`src/meta`): voyage chart, harbour, karma, crew, endless/daily/classic, profile, scoreboards, achievements, story scenes, logbook.
- **Rendering**: boot, water shader, `LegScene`, `TitleScene` (moon secret, glowing "Lantern Tide" ending backdrop). Every biome, leg type and four of five bosses have been looked at on screen.
- **UI** (`src/ui`): HUD, title (with sea-state picker), chart, harbour, tally, story dialogue, logbook, game over, ending, scores, achievements, settings, museum, credits, Lunar panel, pause.
- **App flow** (`src/app.ts`): full state machine with fades, audio wiring, banners, sound captions, achievements, gamepad menu navigation.
- **Story** (0.3.0): intro, Moon guide per sea, captain intros/outros, finale, five letters in bottles, lights won back from captains.
- **Difficulty** (0.3.0): sea states Calm/Choppy/Stormy in `tuning.json` (`sea` array); powder kegs; heat; gunners that lead their shots.
- **Localisation**: English and Slovenian (`src/locales`).
- **Audio**: synthesised SFX and adaptive music. The owner has heard the music and likes it: do not change the tunes without asking.
- **0.4.0**: owner playtest fixes, Bounty and Beacons (untimed) levels, character portraits, in-game art polish. See CHANGELOG.
- **Tests**: 49 unit tests, 7 Playwright browser tests, all passing. Production build works (1.8 MB `dist/`).
- **Docs**: README, CHANGELOG. Deployed to GitHub Pages by `../.github/workflows/pages.yml`.

## Not done yet

1. A human needs to judge the new difficulty. The autopilot dodges cannon fire perfectly, so it cannot tell Calm from Stormy;
   the knobs were set by design judgement. All of them are in `src/content/tuning.json` under `sea`.
2. The Bounty and Beacons levels and the retuned bosses have only been judged against the autopilot.
3. Slovenian text (now including the whole story) is a draft: needs a native speaker's review.
4. Touch controls and gamepad are untested on real devices.
5. Ideas not built: attract mode on the title screen, an online daily leaderboard, a desktop (Tauri) build, an illustrated ending.

## Known rough edges

- Sound effects have not been reviewed by a person (the music has).
- The water shader needs `highp` floats; GPUs that only offer `mediump` in fragment shaders will show flat water.
- The story only plays in Voyage mode (Daily Tide and Night Watch skip it on purpose).
- Nothing has been committed to git yet.
