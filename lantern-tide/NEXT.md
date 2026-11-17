# Lantern Tide — plan for the next run

Read `PROGRESS.md` first for the toolchain and current state. This file says what to do next and in what order.
Standing rules: the owner likes the music (don't alter existing tunes), the plan may be improved on, and nothing is committed to git yet.

## Honest assessment: where the game is weakest today

1. **Art is the biggest gap.** Sprites are small, flat SVG shapes with no animation frames. Captains are shown as ships, not characters. The ending is a sprite on a panel.
2. **Feel has never been tuned by a person.** Boat constants and difficulty were set by judgement and an autopilot.
3. **Levels play alike.** Four level types on similar open arenas; pirates act alone, never together.
4. **Unverified corners.** The final boss has never been watched on screen; touch, gamepad and Firefox are untested; Slovenian is a draft.

## Done in 0.4.0

- All five owner findings from 0.3.0: both bugs, less health, a dangerous Netmaker, two untimed level types (Bounty, Beacons).
- Step 0 partly: the Hollow Galleon fight was watched on screen and lengthened (it fell in 36 s; now about 100 s).
- Step 1 partly: character portraits, captain name card, hull shading, foam, bow wave, wakes, hull damage.

## Still open from Step 0

- Play one full voyage start to ending in the browser, checking each story scene fires once and in order.
- Firefox and touch emulation runs.
- Commit to git (ask the owner first).
- Ask the owner for the rest of their findings; they said the five were only some of them.
- The new health and boss numbers were tuned against the autopilot, not a person: ask the owner how 0.4.0 feels.

## Step 1 — Art overhaul (largest visible gain)

All art is code (`src/render/art.ts`, the water shader). Stay in that pipeline, but raise the ceiling:

- **Bigger, richer sprites**: redraw at roughly 1.5x the detail with shading, highlights and a rim light on the lantern side.
- **Animation**: 2–4 frames or procedural motion for sails, paddles, flippers, flags; a hull that visibly loses planks; a proper sinking sequence with bubbles.
- **Water**: foam rings where hazards and hulls meet the sea, a ribbon wake instead of dots, depth shading under icebergs, bioluminescent trails in the Moonlit Deep.
- **Lighting**: tint sprites warm on the side facing the lantern; soft shadows; light shafts from crystal beams.
- **Characters**: portraits exist (0.4.0). Still to do: expressions (angry, beaten) per captain, and Marshmallow's crew-mates.
- **Illustrated moments**: an ending scene (three karma variants), a painted chart background per sea, a small lantern-boat crossing the title screen. (The boss name card is done.)
- Limit to state plainly: this stays vector/shader art. Hand-painted or pixel textures would need an artist or an image tool.

## Step 2 — Game feel

- A live tuning panel (dev only) for boat, lantern and sea-state numbers, so the owner can tune by hand and paste values back into `tuning.json`.
- Camera: slight zoom-out at speed, a zoom punch on heavy rams, smoother lead.
- Stronger feedback: boost trail, hull-crack flash, low-hull heartbeat, combo meter that escalates.
- Apply the owner's difficulty feedback from their next play session (see questions below).

## Step 3 — Depth and variety

- Pirates that cooperate: sloops that flank, a brigantine escorted by dinghies, netters that flee toward allies.
- New level types: a fog-bank chase, a lighthouse defence, a timed "lights out" level with no lantern oil.
- A choice of one of three boons after each level (roguelite build variety) alongside the harbour shop.
- Boss polish: intro card, clearer phase changes, a second form for the Hollow Galleon.

## Step 4 — Story

- Mid-sea events and crew banter (Pingo, Žabica and friends comment on what happens).
- A final choice with the Hollow Captain (Marshmallow's last letter sets it up: share the light or not), feeding the karma endings.
- An epilogue and a "what changed" screen after a win, so a second voyage feels different.

## Step 5 — Sound, UX, release

- Review every sound effect with the owner; add a sea ambience loop and a short theme per captain (new tracks only).
- Mobile layout, a quality setting, cross-browser pass, low-end performance check.
- Ship: itch.io or GitHub Pages build, icon and social image, optional desktop build.

## What "done" looks like for the next run

Step 0 fully, Step 1 as far as budget allows (characters and animation first), and the tuning panel from Step 2.
Each change keeps `corepack npx vitest run` and `corepack npx playwright test` green and updates `CHANGELOG.md` and `PROGRESS.md`.

## Questions for the owner before starting

1. After playing 0.3.0: is Choppy now too easy, about right, or too hard? What killed you most often?
2. Art direction: keep the flat storybook vector look and make it richer, or change style (pixel art, painted)? The second needs outside art.
3. Is it fine to commit to git, and should the game stay in this repo or move to its own?
4. Which matters more next: looks (Step 1) or more to do (Step 3)?
