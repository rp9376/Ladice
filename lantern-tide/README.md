# Ladice: Lantern Tide

A cosy night-sea arcade game. You are a tiny lantern-boat: ram the pirates, mind the animals,
and bring Marshmallow the seal pup home.

Lantern Tide is the successor to **Ladice**, the high-school C++/SDL2 game in [`../ladice-classic`](../ladice-classic).
The original is left untouched; this is a new game built on its ideas.

## Play

```bash
npm install
npm run dev        # then open http://localhost:5173
```

No `npm` on your machine but Node 22 is installed? Use corepack: `corepack npm install`, `corepack npm run dev`.

`npm run build` produces a static site in `dist/` that can be hosted anywhere (itch.io, GitHub Pages).

### Controls

| | Mouse | Keyboard | Gamepad |
|---|---|---|---|
| Steer | Move the pointer; the boat sails toward it | WASD / arrows | Left stick |
| Boost | Left click | Space | A |
| Brake / drift | Right click | Shift | B |
| Flare | Middle click | F | X |
| Pause | | Esc | Start |

Keys can be remapped in Settings. Touch works too: drag to steer, tap with a second finger to boost.

## What is in the game

- **Voyage**: five seas (Ice Sea, Lily Swamp, Sunset Crystal Sea, Kelp Reef, Moonlit Deep), each with a branching
  chart, a harbour and a captain. A short story runs through it, told by the Moon.
- **The lantern**: it is night. You only see creatures inside your lantern's light; beyond it there are only glints.
  Red diamonds are pirate lanterns, paired dots are animal eyes. Oil burns down; sunk pirates spill more.
- **Ramming is the only weapon**, and it only works at speed. Slow bumps just nudge.
- **Don't hit the animals.** Free them from nets and tow them home instead. Rescued animals may join your crew.
- **Sea state**: Calm, Choppy (default) or Stormy sets the difficulty and the score bonus.
- **Other modes**: Night Watch (endless), Daily Tide (same sea for everyone each day), Classic 2014 (the original's three levels and rules).
- **Logbook**: Marshmallow's letters in bottles, captains beaten, pirates sunk, friends rescued.
- English and Slovenian. Assist options, sound captions, screen-shake and flash toggles.
- There is a secret. It is in the same place it was in 2014.

## For developers

```bash
npm test             # simulation and progression tests (Vitest)
npm run test:e2e     # browser smoke tests (Playwright, uses system Chrome)
npm run balance      # prints how the autopilot fares per sea state, biome and leg type
npm run typecheck
```

| Folder | What lives there |
|---|---|
| `src/sim` | The whole game as a pure, deterministic simulation (no rendering). `bot.ts` is an autopilot used by tests. |
| `src/content` | Balance numbers as JSON: boat, lantern, pirates, biomes, upgrades, sea states. |
| `src/meta` | Voyage chart, harbour, karma, crew, story scenes, save profile, scoreboards. |
| `src/render` | Phaser scenes, the water shader, and all art as SVG in `art.ts` (one manifest, easy to replace). |
| `src/audio` | Synthesised sound effects and the music sequencer. There are no audio files. |
| `src/ui` | Menus and HUD as HTML laid over the canvas. |
| `src/locales` | English and Slovenian strings. |

Useful while developing:

- **F1** in a leg toggles the debug overlay (hitboxes, AI states, lantern radius, seed).
- `?leg=boss&biome=crystal&seed=5&bot` jumps straight into one leg with the autopilot sailing.
  Other parameters: `diff`, `sea`, `planks`, `crew=pingo,zabica`, `level` (classic), `seeall`, `god`, `bottle`, `notutorial`, `res=960`.
- `window.__LT` in the browser console is the running app (`__LT.sim` is the live leg, `__LT.setBot(true)` hands over the helm).
- `shots/` has small scripts for screenshots and frame-rate measurement.

All art and sound were made for this project. Font: Fredoka (SIL Open Font License).
