# Ladice: Lantern Tide — Design & Build Plan

A spiritual successor to **Ladice** (the original 2014-era SDL2 game in this repo). Build a new,
polished game that keeps the soul of the original and expands it. **Do not modify the original
game** in `../ladice-classic/` — it stays as a museum piece. Build the new game in a new
directory (`lantern-tide/`) or a new repo.

> "Ladice" is Slovenian for "little boats". The animals are Slovenian diminutives too: *Pingo*
> (penguin), *Žabica* (little frog), *Ribica* (little fish). Keep these names.

---

## 1. What the original game is (read this first)

Source (in `../ladice-classic/`): `src/Game.cpp`, `src/enemy.cpp`, `src/friendly.cpp`, `src/obsticale.cpp`.

| Aspect | Original behaviour |
|---|---|
| Screen | 800×600, fixed |
| Start | Click on your boat to "grab" it; it then snaps to the mouse cursor every frame |
| Goal | Survive a 30 s timer per level; ram pirate ships for points |
| Pirates | +100 / +200 / +300 per ram (level 1/2/3); respawn at random position after hit |
| Animals | Pingo (penguin), Žabica (frog), Ribica (fish): −50 each if you hit them |
| Obstacles | Iceberg / lily pad / crystal: touching one = instant level fail |
| Fog of war | Pirates and animals are **only visible within 200 px of the player**; obstacles always visible |
| Wandering AI | Random 8-direction walk, random distance 10–100 px, random speed 1–4 px/frame |
| Levels | Blue sea + icebergs + penguins → green swamp + lily pads + frogs → orange sunset sea + crystals + fish. Fewer pirates and more animals each level (3/1 → 2/3 → 1/5) |
| Ending | Full-screen meme of a baby seal: "YOU WIN! Here's a cute little marshmallow sea doggo" |
| Secret | Middle-click the **moon** on the title screen → "hax" mode: invincible, see everything, alternate music track |
| Controls | Right-click releases the boat (pseudo-pause), middle-click returns to menu |
| Flavour | Console prints "You monster!" if you killed ≥ 3 animals |
| Scoreboard | Top-10 in `score.txt`; name typed **into the terminal** |
| Title art | Moonlit night sea with a big galleon, wooden "Play Now" button |

### The soul to preserve
1. **Bite-sized, frantic, timed rounds** (30 s legs).
2. **Ramming as the only attack.** You are a small boat bullying bigger ones.
3. **"Don't hit the animals"**, a small moral layer with cheeky consequences ("You monster!").
4. **Limited visibility around your boat**, the most interesting mechanic in the original.
5. **A moonlit night-sea mood** (from the title screen).
6. **The moon secret**: a hidden toggle with alternate music.
7. **A wholesome seal payoff** at the end.
8. **Three biomes** that each re-skin the same trio: hazard, prey, innocent.
9. **Mouse-only play** is possible.

### Original bugs/weaknesses the new game must NOT repeat
- Failing a level still advances to the next level (`status != QUIT` check).
- Boat teleports to the cursor, so it can jump through obstacles. There is no feel and no momentum.
- Frame-rate-dependent movement (`SDL_Delay(16)`, px/frame speeds).
- 50×50 rectangle collision on sprites with lots of transparent padding, so hits feel unfair.
- Fog-of-war distance uses the wrong centres (`x - 25` instead of `x + 25`).
- Entities can spawn on top of the player, on obstacles, or overlapping each other.
- Instructions and name entry happen in the terminal; there is no in-game tutorial, pause, or settings.
- Recursive `menu()` ↔ `Lv1()` calls (stack grows every game).
- AI wanders blindly. Pirates don't react to the player and animals don't flee.

---

## 2. High concept

> **You are a tiny lantern-boat guarding the night seas. Pirates are poaching sea creatures.
> Ram the pirates, protect the animals, and bring Marshmallow the seal pup home.**

- **Genre:** top-down arcade action with light roguelite meta-progression.
- **Session shape:** 30–45 s "legs" stitched into a voyage of roughly 15–20 minutes.
- **Tone:** cosy storybook at night. It looks like a children's picture book lit by a lantern, but the arcade gameplay is tight and frantic.
- **Title:** *Ladice: Lantern Tide* (working title; keep "Ladice").

The story gives the original's pieces a reason to exist: the pirates are poachers, the animals are
what you protect, and the seal meme ending becomes the real goal. Pirates have kidnapped
**Marshmallow**, a seal pup, and she is held aboard the Hollow Galleon (the big ship from the
original title art, now the final boss).

---

## 3. Core mechanics

### 3.1 Boat handling (replaces cursor teleport)
- The boat **steers toward** the pointer/stick with acceleration, max speed, a turning rate, and drag.
  It should feel like a nimble tugboat: responsive, with a little drift.
- **Ram power = speed at impact.** Slow bumps only nudge, while full-speed rams smash.
  This creates a rhythm: line up, accelerate, hit, recover.
- **Boost** (left mouse hold / A button / Space): short burst with cooldown. It is the main way to land big rams.
- **Brake/drift** (right mouse / B / Shift): tight turns for dodging.
- Input: mouse (default, keeps the original one-hand feel), keyboard (WASD), gamepad, and touch
  (drag to steer, second finger to boost).
- Fixed-timestep simulation (60 Hz) with interpolated rendering.
- Wake trail and bow spray scale with speed. Players read speed from these, not from a number.

### 3.2 The Lantern (signature mechanic, evolved from the 200 px fog)
- The world is **night**. The moon dimly lights large shapes such as icebergs, rocks, and coastlines, so
  hazards are always readable as silhouettes (same rule as the original).
- Creatures are only fully visible inside your **lantern radius**. Outside it you see **hints** only:
  - Pirates: a swinging **red lantern glint** and creaking sounds. Some pirate types
    *douse their lanterns* and become invisible until close.
  - Animals: soft **bioluminescent eye-glints** in different colours (penguin = white, frog = green,
    fish = cyan). Skilled players learn to read the glints and tell a pirate from a penguin before seeing either.
- **Lantern oil** is a soft resource. The radius slowly shrinks over a leg. Rammed pirates spill
  oil barrels (pick them up to brighten). Fireflies in the swamp also refuel. This adds risk and reward:
  aggressive play keeps the lights on.
- **Lantern flare** (ability, cooldown): a brief full-screen reveal pulse that also stuns
  pirates for 0.5 s.
- Implementation: 2D light mask (render-texture with radial gradient lights, multiply blend),
  plus additive glow sprites for glints.

### 3.3 Hazards
- Hull has **3 planks** (hit points) instead of instant death. Hitting a hazard costs a plank, followed by brief
  invulnerability, knockback, and a splinter burst. Planks can be repaired at the harbour.
- **Classic mode** keeps instant death on contact for purists (see Modes).
- Hazards are **physical**: some can be pushed. Shoving an ice floe into a pirate counts as a ram
  ("Iceberg Assist" bonus).
- Use circle/capsule/polygon hitboxes that fit the art, and be slightly forgiving toward the player.

### 3.4 Pirates (AI with states, not random walk)
States: `patrol → notice (exclamation mark plus sound cue) → flee or attack → recover`.

| Type | Behaviour | Hits | Biome intro |
|---|---|---|---|
| **Dinghy** | Flees when it notices you, zig-zags | 1 | 1 |
| **Sloop** | Circles you and fires a slow cannonball with a telegraphed arc | 2 | 1 |
| **Netter** | Drags a net trying to catch animals. Ram it to free them | 2 | 2 |
| **Lantern-Douser** | Lantern off, ambushes from darkness, only an audio cue | 1 | 2 |
| **Brigantine** | Armoured front. Must be rammed from the side or rear | 3 | 3 |
| **Ghost skiff** | Only visible under moonlight patches or flare | 1 | 4+ |

- Spawns are telegraphed (ripples on the water) and never within N px of the player.
- Base score per ram keeps the original curve (100 / 200 / 300 by biome) times the multiplier.

### 3.5 Animals and Karma (expanding "don't hit the animals")
- Animals react: they **flee from the player's wake** if you come in fast, and approach curiously if you idle nearby.
- Hitting an animal: −50 points (as in the original), a sad bonk sound, the animal swims away dazed (no gore), and **Karma −1**.
- **Rescue:** pirates (Netters) capture animals. Ram the Netter, then sail through the freed animals to
  **tow them** (they follow in a little conga line behind your boat) to a safe zone (ice shelf,
  lily island, reef) for points and **Karma +1**. Towing slows you down, which is a trade-off.
- **Karma** affects the voyage:
  - High karma: rescued animals **join your crew** (see 4.2), the sea is calmer, and the good ending is unlocked.
  - Low karma: storms roll in, the pirates' "wanted posters" call you a monster, and the bad (but funny) ending plays.
- Keep **"YOU MONSTER!"** as a big comic text pop when you hit the 3rd animal in a leg, plus an achievement.

### 3.6 Scoring and juice
- **Combo multiplier:** ram within 2.5 s of the last ram to raise ×1 → ×2 → ×3 → ×5. Hitting an animal or hazard resets it.
- **Near miss:** pass within a few px of a hazard at speed for "Close shave!" +25.
- **Gentle Captain:** a leg with zero animal hits gives a bonus.
- **Extra time:** each sunk pirate adds +1 s to the leg timer (cap it). The base timer stays 30 s, as in the original.
- End-of-leg tally screen with the numbers counting up, medals (bronze/silver/gold), and a "best" comparison.

---

## 4. Structure and progression

### 4.1 The Voyage (main mode)
- A **sea chart** made of nodes, with short branching routes (pick from 2–3 paths). Each node is a leg:
  - **Patrol:** standard 30 s leg (the original's level format).
  - **Rescue:** free X captured animals before time runs out.
  - **Convoy:** escort a family of animals across the map.
  - **Storm:** lightning flashes briefly reveal everything; the rest of the time you are blind.
  - **Harbour:** shop and rest (no combat).
  - **Boss:** end of each biome.
- Five biomes, which extend the original three:

| # | Biome | Hazard | Animal | Twist | Boss |
|---|---|---|---|---|---|
| 1 | **Ice Sea** (original Blue) | Drifting icebergs that calve into pushable floes | Pingo | Aurora ripples brighten the lantern | *Captain Frostbeard* on an icebreaker that rams *you* |
| 2 | **Lily Swamp** (original Green) | Lily pads (slow you, don't hurt), gnarled roots (hurt) | Žabica | Thick fog, fireflies refuel the lantern; frogs hop pad to pad in patterns | *The Bog Queen*, a barge that hides in fog and releases douser skiffs |
| 3 | **Sunset Crystal Sea** (original Orange) | Crystals that **refract your lantern into beams**, which can stun pirates or reveal secrets | Ribica | Day turns to dusk inside the leg, so the light radius matters more over time | *Admiral Ember*, protected by crystal mirrors; redirect light to break shields |
| 4 | **Kelp Reef** (new) | Reefs exposed at low tide | Sea turtles | Tide timer: reefs rise and sink on a cycle | *The Netmaker*, who traps animals in a giant net you must cut by circling |
| 5 | **Moonlit Deep** (new, finale) | Whirlpools, ghost wrecks | All of them | The sea mirrors the sky; moon patches reveal ghost skiffs | **The Hollow Galleon** (the title-screen ship), multi-phase, holding Marshmallow |

- **Ending:** you rescue **Marshmallow the seal pup**, now an original illustrated character. The
  final card nods to the original: *"YOU WIN! Here's a cute little marshmallow sea doggo."* The good karma
  ending shows all your crew celebrating; the low karma ending shows Marshmallow giving you a disappointed look.

### 4.2 Harbour, upgrades and crew
- Currency: **doubloons** (from pirates) and **pearls** (from rescues).
- Upgrades: hull planks, ram plating, engine (speed), lantern (radius and oil), boost cooldown, flare.
- **Crew:** animals you rescue may join. Each grants a perk (equip up to 3):
  - *Pingo*: you slide off icebergs (first hit per leg is free).
  - *Žabica*: hop over lily pads and nets once per leg.
  - *Ribica*: sonar ping every 10 s reveals nearby glints.
  - *Turtle*: +1 plank.
  - *Marshmallow* (after the first win): her bark stuns all pirates on screen once per leg.
- Crew sit visibly on your boat's deck, which is pure charm.

### 4.3 Modes
- **Voyage:** the main campaign above (save/resume between legs).
- **Endless Night Watch:** no map, legs chain with rising difficulty, and the lantern never fully refuels.
- **Daily Tide:** a seeded daily voyage, the same for everyone, with a local "best" and optional online board (stretch).
- **Classic 2014:** a faithful remake of the original rules (3 fixed levels, 30 s each,
  instant-death hazards, original point values), played in the new engine with an optional "Retro" filter.
  This is an homage and achievement hunt ("Old Salt"). Fix the original bugs here too, except where a bug is the charm.

### 4.4 The Moon Secret (homage to "hax" mode)
- On the title screen, **middle-click the moon** (or click it 3 times / long-press on touch) to open
  "**Lunar Mode**". The music crossfades to the alternate "moon remix", exactly like the original.
- Lunar Mode mutators (toggleable): Invincible hull (the original hax), See everything (no fog),
  Tiny boat, Big-head pirates, Disco lantern, Slow-mo, Mirror sea.
- Using any mutator flags scores as "lunar" (stored separately, marked with a moon icon).
- Discovering it unlocks the achievement **"Moonstruck"**. Never mention it in the UI or tutorial.

---

## 5. Presentation

### 5.1 Art direction
- **Style:** "storybook nocturne". Flat vector shapes with soft gradients, inked outlines on
  characters, and a desaturated night palette where **light adds warm colour** (lantern = amber,
  moon = cool silver, glints = saturated accents). Seen from directly above, with slight perspective on boats.
- Each biome has a palette and a "sky colour" that tints the water.
- Water: animated shader (scrolling normal-noise ripples, moon reflection streak, foam at hazard edges).
- The player boat is a small tugboat with a lantern on a pole, bobbing and tilting into turns.
- **Original assets:** the current PNGs are from unknown sources (clip art, stock photos, a meme), so
  **do not ship them** in the new game. Instead recreate key images as original homages:
  the moonlit galleon title screen, the wooden "Play Now" button, the cartoon pirate ship, and the seal.
  Optionally show the original screenshots in an in-game **"Museum"** page that links to the old repo.
- Agent-produced art: author sprites as **SVG** (code-generated, consistent palette constants) and
  rasterise them at build time or load SVG directly. Keep every asset in a manifest so a human artist
  can swap them later.

### 5.2 Juice checklist
Screen shake (scaled, toggleable), hit-stop of 50–80 ms on big rams, splinter and splash particles,
floating score text, combo meter pulse, boat squash-and-stretch on boost, camera lead in the movement
direction, slow-mo on boss kill, ripple rings on spawns, lantern flicker when oil is low, animal
"heart" pop when towed home, rain/snow/fireflies ambient particles per biome.

### 5.3 Audio
- **Music:** a calm sea-shanty-ish theme per biome with **adaptive layers**: percussion fades in as the combo rises,
  and the music muffles under low oil. A Lunar remix of the title theme. Generate with Tone.js or a small
  in-code sequencer; keep stems in the manifest for replacement.
- **SFX:** generated jsfxr-style (wood thunk, cannon, splash, bark, bonk, lantern whoosh, frog croak,
  penguin squeak). Use positional panning for off-screen creature cues; they are gameplay information in the dark.
- Check with the owner whether `MenuSound.wav` / `MenuSoundHax.wav` are original compositions. If so,
  re-arrange them as the title theme and Lunar remix.

### 5.4 UI/UX
- In-game everything: animated title (the galleon sails past the moon), mode select, settings,
  pause (Esc / Start), onscreen name entry for the scoreboard, credits, achievements, Museum.
- Interactive tutorial leg: "Click and hold to steer", "Ram the pirate!", "Don't bonk Pingo!".
- HUD: timer (top-right, like the original), score and combo (top-left), planks, lantern-oil arc
  around the boat itself (diegetic), crew portraits.
- Leaderboards: local top 10 per mode, stored in `localStorage` / a save file. Never use the terminal.

### 5.5 Accessibility and localisation
- Remappable controls, hold or toggle boost, assist options (slower game speed, extra planks,
  wider lantern), screen-shake and flash toggles, colour-blind-safe glint shapes (glints differ in
  **shape** as well as colour: pirate = diamond, animal = circle).
- Subtitles for audio cues ("creaking to the left").
- Languages: **English and Slovenian** at launch (a nod to the game's origin). All strings in locale files.

---

## 6. Technical plan

### 6.1 Stack (recommended)
- **TypeScript + Vite + Phaser 3** (scenes, input, tweens, audio, cameras, render textures for lighting).
  The game runs in a browser, so it is easy to share, can go on itch.io or GitHub Pages, and can be wrapped with **Tauri** for a desktop build.
- Custom lightweight physics for boats (circle bodies plus simple polygon hazards). Don't fight Arcade physics for momentum/ram logic. Matter.js is acceptable if pushable floes need it.
- Seeded RNG (e.g. `mulberry32`) for all gameplay randomness. This is required for Daily Tide and replays.
- **Vitest** for pure logic; **Playwright** smoke tests that boot the game, play a scripted leg via an
  input-injection hook, and capture screenshots.
- Alternative if the owner prefers native C++ (heritage): C++20 + SDL3 or raylib with the same
  architecture. Decide in M0 and don't mix.

### 6.2 Architecture
```
lantern-tide/
  src/
    core/        fixed-timestep loop, rng, input abstraction, save, events, i18n
    sim/         PURE game simulation (no rendering): boat, pirates, animals, hazards,
                 collisions, scoring, karma, lantern. Deterministic given seed + inputs.
    content/     data: biomes.json, pirates.json, animals.json, legs.json, upgrades.json, crew.json
    render/      Phaser scenes & views that mirror sim state; lighting; particles; water shader
    audio/       music sequencer, sfx generator, adaptive mixer
    ui/          menus, HUD, tally, chart map, harbour, settings
  assets/        generated SVG/PNG + manifest.json
  tests/         vitest (sim) + playwright (smoke)
```
- **Sim and render are separate.** `sim` must run headless in tests. Content is data-driven so new biomes
  and pirate types are mostly JSON.
- A scene state machine (Boot → Title → Chart → Leg → Tally → Harbour → …) must not recurse.
- Debug overlay (F1): hitboxes, AI states, light radius, FPS, seed. Debug cheats (F2) separate
  from Lunar Mode.

### 6.3 Performance targets
60 FPS on integrated GPUs at 1920×1080. Logical resolution 1280×720 scaled with letterboxing; support
16:9 and phone aspect ratios. Fewer than 200 draw calls per frame. Load time under 3 s.

---

## 7. Milestones (each ends playable; verify before moving on)

| # | Milestone | Done when |
|---|---|---|
| **M0** | Scaffold | Vite/TS/Phaser project builds; lint, vitest and playwright run in CI; empty scene renders; stack decision recorded |
| **M1** | **Core feel** (most important) | One Ice Sea leg: boat steering with momentum, boost, ram-by-speed, dinghies plus sloops, Pingo, icebergs, lantern radius plus glints, 30 s timer, score. *Is it fun with placeholder shapes?* If not, iterate here before anything else |
| **M2** | Juice and audio pass | Everything in §5.2 implemented; SFX set; one music track with adaptive layer; title screen with moon |
| **M3** | Content: biomes 1–3 plus bosses | Original three biomes reimagined, 3 bosses, rescue/towing, karma, combo, tally screen |
| **M4** | Voyage meta | Sea chart, harbour shop, upgrades, crew perks, save/resume, endings incl. Marshmallow |
| **M5** | Biomes 4–5 and modes | Kelp Reef, Moonlit Deep, Hollow Galleon finale; Endless, Daily Tide, Classic 2014; Lunar Mode secret |
| **M6** | Polish and ship | Tutorial, settings, accessibility, EN+SL localisation, achievements, Museum page, perf pass, itch.io/Pages build, optional Tauri desktop build |

**Process rules for the building agent:**
- Make the M1 game feel right before adding content. Tune constants live through a dev panel.
- Keep balance numbers in `content/*.json`, never hard-coded.
- Every milestone needs: tests green, a Playwright screenshot of each new scene, and a short CHANGELOG entry.
- Don't touch the original game's files.

---

## 8. Open questions for the owner
1. Web-first (recommended) or native C++/desktop-first?
2. Are `MenuSound.wav` / `MenuSoundHax.wav` (and any art) your own creations, and can they be reused?
3. Is "Lantern Tide" OK as a subtitle?
4. Scope check: is the full M0–M6 plan wanted, or a smaller "remaster" (M0–M3 plus Classic mode)?
