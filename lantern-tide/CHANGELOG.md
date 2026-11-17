# Changelog

## 0.4.2 — Chapter restarts

- Sinking on a voyage no longer sends you back to the very beginning. The game-over screen offers "Restart <sea>", which puts you
  back at the start of the current sea with the hull, loot, crew and score you arrived with. Restarts are counted and shown on the scoreboard.
- "Continue Voyage" on the title screen does the same if you leave after sinking. "End voyage" banks the score instead.
- The trophy icon is fully yellow.

## 0.4.1 — Hull clarity

- Removed the bow wave in front of the player's boat (it was too loud).
- Losing a plank is now unmistakable: a red "−1" at the boat, the hull row jolts, the screen edge flashes red,
  and the last plank pulses with a "Last plank!" warning.
- The hull row is labelled, and the first plank you ever lose brings up a one-time explanation of how the hull works.
- If Lunar Mode mutators are on, the level shows a badge naming them, and an invincible hull shows as ∞.
- The pause button no longer sits on top of the hull row.

## 0.4.0 — Owner playtest fixes, untimed levels, characters

- Fixed: a sunk captain reappeared for a moment before the level ended.
- Fixed: the title-screen galleon floated above its shadow; it now sits in the water with a mirrored reflection.
- Less health: plank pickups are rare on Choppy and gone on Stormy, repairs cost more and rise with each sea, the hull upgrade
  costs more, invulnerability after a hit is shorter, Stormy starts with two planks and gets no free repair after a captain.
- The Netmaker is dangerous now: his nets lead the boat, a second net on a tangled boat costs a plank, his gunners fire the
  moment a net lands, he calls more sloops, and a broken ring of reef surrounds him.
- The Bog Queen fires more mortars and calls more dousers on rougher seas.
- The Hollow Galleon has more hull and can only be hurt deeply while dazed; the fight now lasts about 100 seconds.
- Two new level types with no clock: **Bounty** (sink a set number of pirates) and **Beacons** (hold station to relight
  harbour beacons while Lantern-Dousers try to snuff them). Both pay a bonus for speed.
- Character portraits for the story, logbook and a new captain name card: Frostbeard, the Bog Queen, Admiral Ember,
  the Netmaker, the Hollow Captain, Old Jaka, the Moon and Marshmallow.
- Art polish: hull shading and deck planking, contact shadows, foam around rocks and ice, a bow wave, pirate wakes,
  visible hull damage and smoke on the last plank, bubbles when sinking.

## 0.3.0 — Story and sea states

- A storyline told through dialogue scenes: an intro, the Moon as guide in each sea, captains who taunt before the fight
  and confess after it, and a finale.
- Each beaten captain gives back a stolen light, a lasting bonus for the voyage (wider lantern, slower oil burn,
  faster flare, an extra plank).
- Marshmallow's letters: one message in a bottle per sea.
- Logbook: letters, captains, pirates sunk, friends rescued.
- Sea state (difficulty): Calm, Choppy (new default, harder than before) and Stormy, each with a score bonus.
- Harder pirates: gunners lead their shots, tougher ships arrive as your kill count grows, and chased dinghies
  drop powder kegs (which also blow up pirates).
- Fixed: pirate fire rate was scaled the wrong way round (deeper legs and bad karma made them shoot slower).
- Edge-of-screen pointers to freed animals, the safe zone, the captain and bottles.
- Night Watch now stops at a harbour every third leg.
- Fades between scenes; the sea glows behind the ending when the Lantern Tide rises.
- New achievements: Pen Pal, Storm Petrel.

## 0.2.0 — The whole game loop

- Title screen with the moon secret, voyage chart, harbour, results, game over and ending screens.
- HUD, pause, settings (volume, key remapping, assist, language), scoreboards, achievements, Museum, credits, Lunar Mode.
- English and Slovenian.
- Synthesised sound effects and adaptive music.
- Water shader, lantern lighting, glints, weather, particles, screen shake, hit-stop.
- Browser smoke tests.

## 0.1.0 — Simulation

- Deterministic simulation of the boat, pirates, animals, hazards, lantern and five bosses.
- Voyage, endless, daily and classic modes; karma, crew, upgrades.
- Autopilot and unit tests.
