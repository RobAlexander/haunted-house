# Haunted House — Aesthetics Guide

A style bible for making a *different* game that looks, moves and sounds like Haunted House, with none of its game logic. Everything here is distilled from `js/renderer.js`, `js/audio.js` and `js/constants.js`. Numbers are given so the feel can be reproduced exactly; treat them as starting values.

**One-line summary:** a dark-room **vector wireframe** world, drawn entirely with thin glowing strokes on near-black, populated by hand-wobbled stick-and-spline monsters that pulse and flicker, and scored by a **fully synthesised** (no samples) drone-and-sparse-bell soundtrack with harsh, layered, slightly grotesque sound effects.

### How to use this document
* **Essential vs incidental.** §1, §2 (world/UI colours), §4's creature *recipe*, §5's motion/particle rules, §8.1–8.2 and §8.4 are the **style**. The specific monsters, runes, floors, pickups and bosses are **examples** of that style applied — reuse their techniques, not their names or roles.
* **Tech assumptions.** The original is p5.js 1.9 in global mode, no build step, everything drawn in code. Any 2D canvas works; `curveVertex` is a Catmull-Rom spline (convert to Béziers in raw Canvas2D). `drawingContext.globalAlpha` is the underlying Canvas2D alpha.
* **Units.** All timings are **frames at a fixed 60 fps** unless given in seconds/ms; speeds are px/frame in the 800×600 logical space. `frame` / `G.frame` below means a simple frame counter (p5 `frameCount` is fine). "rad/frame" = the multiplier inside `sin(frame · k)`.
* **Appendix A** has copy-pasteable helpers for the drawing and audio techniques — start there when building.

---

## 1. Core visual principles

1. **Outlines, not fills.** Almost everything is `noFill()` + a coloured `stroke`. Solid fills are reserved for: tiny dots (eyes, bullets, particles), translucent glows/halos, HUD bars, and a few "occluder" fills in the background colour (skull heads and boss bodies are filled with `COL_BG` so the dark interior hides what is behind them).
2. **Near-black world, single saturated hue per entity.** Each creature owns one colour. No gradients, no textures, no shading. Identity comes from colour + silhouette + motion.
3. **Thin lines.** The default stroke is **1.5 px**. Detail lines are 0.5–0.8 px, emphasis lines 2–2.5 px, bosses thicken with phase (`1.5 + phase * 0.5`). Joints are marked with a `strokeWeight(2.5–3)` `point()`.
4. **Nothing is perfectly geometric.** Every creature has per-instance random deformation, so no two ghosts, skulls or ghouls are identical. Shapes are drawn through closed **Catmull-Rom splines** (`curveVertex`) whose control points are jittered at spawn. Straight lines are used for limbs, teeth, bandages, walls.
5. **Everything breathes.** Alpha, size or glow is almost always modulated by a sine of the frame counter. Static things look dead; this world is "alive" and slightly unwell.
6. **Light is simulated with alpha.** Glow = a larger, low-alpha filled circle under the real shape. Fade = `globalAlpha`. Nothing uses blur or shadow. (`drawingContext.globalAlpha = x` is used directly instead of `fill` alpha so strokes fade too.)
7. **Fixed logical canvas, scaled up.** Draw in an **800 × 600** logical space and scale uniformly to the largest 4:3 rectangle that fits the window. Hide the system cursor and draw your own crosshair.
8. **Monospace for information, a horror display face for drama.** HUD/UI text is `monospace` at 9–14 px. Only the title, boss names and big dramatic moments use **Creepster** (vendored TTF).

## 2. Palette

Background and structure are cold, desaturated blue-violet; creatures are hot or sickly accents; the player is the only mint green.

### World / UI
| Role | Hex |
|---|---|
| Background | `#0a0a0f` |
| Floor grid lines (0.5 px) | `#141420` |
| Walls | `#3a3a5c` |
| Wall corners | `#5a5a8c` |
| Obstacle outline / X-brace | `#2e2e50` / `#222240` |
| Open door ticks | `#7777aa` |
| Closed door | `#993333` |
| Boss room floor tint | `#1a0808` (+ faint `#330000` pentagram) |
| HUD text / title | `#aaaacc` / `#8866aa` |
| HP bar bg / fill / low | `#111122` / `#00ff88` / `#ff4444` |
| "CLEARED" / highlight | `#ffee88` |
| Exit / stairwell / win | `#00ffcc` |
| Game-over red | `#ff4444` |
| Rune symbols | `#cc44ff` |

### Player
| Role | Hex |
|---|---|
| Body | `#00ff88` (mint green) |
| Gun / aim line | `#00aa55` |
| Crosshair | `#44cc88` |
| Bullet | `#ffffaa` (pale yellow) |
| Muzzle flash | `#ffffaa` core, `#ffffee` rays |
| God-mode tint | `#ffd700` |

### Creatures
| Creature | Hex | Feel |
|---|---|---|
| Ghost | `#cc88ff` | lilac, translucent |
| Lunge ghost | `#ff4455` | angry red variant |
| Skull | `#ff6644` | orange-red |
| White skull | `#d8e0ff` | cold blue-white |
| Skull boss | `#ff2222` | pure red |
| Enemy bullet | `#ff8844` | orange |
| Ghoul | `#7b3f1e` | dried-blood brown |
| Long ghoul | `#c0c0d8` | grey-white |
| Ghoul boss | `#8a2050` | crimson-magenta |
| Mummy | `#c8b060` | yellowed cloth |
| Mummy boss | `#e0a030` | richer gold |
| Demon (skinless rider) | `#7a1818` outline, `#cc6622` veins/eye | raw anatomy |
| Ashtaroth | `#ff4400` + flame inner `#ffaa00` | molten orange-red |
| Flies / toxic gas | `#44ff66` | acid green |
| Ashtaroth gas | `#77ff99` | lighter green |
| Invulnerability / phase-change glow | `#ffee00` | warning yellow |
| Elite shield | `#ffee00` pulsing bubble | |

### Pickups (each a distinct hue and glyph)
Heal `#ffcc00` (concentric rings) · Power shot `#44aaff` (nested rounded rectangles) · Max HP `#ffe066` (nested diamonds) · Speed `#00eeff` (double chevron) · Invulnerability `#eeeeff` (hexagon + circle) · Autofire `#ff8844` (three stacked arrows) · Bounce `#88ccff` (hollow bubble with glint) · Enemy heal drop `#00eeff` (rings + dot).

**Rule of thumb:** a pickup is always an *abstract, readable pictogram built from 2–4 strokes*, pulsing in alpha between ~0.65 and 1.0 with its own sine frequency (0.08–0.15 rad/frame), with a 9 px monospace label beneath it.

## 3. The room (environment)

* **Layout:** a rectangle with a 60 px padding. The floor is a **40 px grid** of hairlines (0.5 px, barely visible). Walls are single 2 px lines. Corners get 14 px L-shaped brackets in a lighter colour.
* **Obstacles:** a plain rectangle outline with a faint diagonal X inside (the classic "crate" wireframe).
* **Doors:** a gap in the wall (44 px). *Closed* = the gap is closed by a red line. *Open* = two short perpendicular ticks at the gap edges, in `#7777aa`. A boss door is red, labelled `BOSS` in 9 px text, and when locked shows a tiny padlock (rect + arc) and the collected/uncollected rune letters (`·` for missing).
* **Stairwell exit:** five converging horizontal step lines receding into the wall plus two angled rails at 55 % alpha, cyan, labelled `NEXT FLOOR`.
* **Start room:** a small wooden trapdoor (72×56 px) drawn in warm browns (`#18110a` fill, `#7a5a32` planks, `#aa7840` hinges). The only warm "furniture" in the game.
* **Boss room:** floor tinted `#1a0808` with a faint five-point pentagram (radius 120, `#330000`, 0.5 px).
* **Room transitions:** both rooms slide across the screen together (22 frames) with a black overlay that peaks at ~35 % alpha mid-slide (`sin(t·π)·90/255`).
* **Map:** full-screen overlay at ~84 % black. Rooms as small rectangles joined by 5 px grey corridors; unvisited rooms (in "full map" mode) are dim `#252535`/`#2a2a3a` outlines. Treasure rooms and rune glyphs get tiny icons in the corner.

## 4. How things are drawn (the "house style" recipe)

### Generic creature recipe
1. Compute a **per-instance deform array** at spawn (6–10 values in −1…1) and/or pre-computed spline vertices.
2. Draw the body as a closed spline: `curveVertex(last); curveVertex(each…); curveVertex(first); curveVertex(second); endShape(CLOSE)`.
3. Add limbs as straight line segments, with 2.5–3 px dots at joints.
4. Draw eyes as small **filled** circles in the creature colour (ghost, ghoul) or as **dark socket + glowing pupil** (skulls, bosses).
5. Layer a faint **halo** (filled circle, 0.10–0.25 alpha) for anything magical/boss-like.
6. Pulse something (eyes, halo or alpha) with `sin(frame · speed + positionOrOffset)`. The position/offset term de-synchronises individuals.
7. A small HP bar (4 px tall, hidden at full health) floats above ordinary enemies; bosses get a 300 × 10 px bar at the bottom with their name in Creepster 16 px in their accent colour.

### Creature gallery
* **Ghost** — a dome-topped, wavy-hemmed sheet (14 px radius), 15-point spline with a wiggling bottom edge (`sin(frame·0.07 + x·0.05)·2.5`). Two filled dot eyes. Whole body flickers: `alpha = 0.55 + 0.45·sin(frame·0.12 + offset)`. Lunge variant is red and goes to 0.92 alpha while lunging.
* **Skull** — irregular 7-point head spline, dark circular eye sockets (7 px) with smaller glowing pupils whose alpha pulses (0.55–1.0), a row of three short vertical teeth. Orange-red.
* **White skull** — same silhouette, bluer, with an extra faint outer glow ring (0.12–0.22 alpha) and stronger 1.8 px stroke. Reads as "ghostly, dangerous".
* **Ghoul** — a crouched irregular blob with **four jointed insect-like legs** (1–4 joints each, per instance, with dots at the joints). Legs scuttle with `sin(crawlPhase)`. Eyes dim (0.65) while crawling, blaze (1.0) while leaping. **Long ghoul**: more compressed body, five legs, the fifth always longer, pale grey-white.
* **Ghoul boss (Rotten Philip)** — a larger ghoul (2 px strokes, 4 px joint dots) inside a **thick 5 px glow ring** (radius + 14, alpha 0.22–0.34, colour shifts by phase `#aa4455` → `#ff7744` → `#ff3333`). Before each leap it **telegraphs**: body squashes and widens (scale 0.55 Y / 1.55 X), legs tuck in to 55 % length, body and eyes turn **red**, the ring thickens to 6 px and pulses fast (`sin(frame·0.35)`), eyes swell 8 → 13 px. *A thick glow ring and a squash-and-stretch windup are the house way to warn "about to attack".*
* **Mummy** — two stacked quads (head, body) with slight per-instance corner jitter, 0.7 px horizontal bandage lines across the body and head, raised crooked arms with elbows that sway ±1.5 px, green flickering eyes, and a mouth rectangle in fly-green that opens when releasing flies. While *rising*, the whole figure is shifted down by 44 px, faded to 0.15 alpha, and a ring of seven flattened crack-lines pulses under its feet.
* **Mummy boss** — the same mummy at 1.65× scale; phase-coloured eyes (green → amber → red) and a silhouette-shaped yellow glow/halo.
* **Demon (Nuckelavee)** — a horizontal ellipse (horse) with orange sinew lines inside; a torso growing from its back; grotesquely long arms hanging lower than the body; a large circle head with a flat snout line; **one enormous pulsing eye** (orange oval with a near-black inner oval). Surrounded by a drifting cloud of green wisps (aura) and leaves a trail.
* **Skull boss (Killer Skull)** — a large 8-vertex dome-skull, filled with the background colour, each vertex pushed radially by a per-instance deform. Big eye sockets, glowing red pupils with a pale-pink inner dot, inverted-V nose, five teeth. Outline thickens each phase. During the spiral attack, three yellow "arms" spin out of it as a warning.
* **Ashtaroth** — a bat-winged demon: an organic 8-point body blob (filled with background), two large curved **spline wings** that flap (`sin(frame·0.06)`) with faint rib lines at 0.55 alpha, two angular horns, glowing eyes that shift colour by phase (orange-red → orange → yellow), and a jagged five-tooth maw whose tooth lengths vary per instance.
* **Flies** — a dot (4 px radius) with two tiny 0.7 px arcs for wings that beat.
* **Meat lumps** — a filled orange-red circle on a larger green glow circle, with a wobbling inner 5-point vein loop; small lumps are plain dots with a glow.
* **Player** — drawn rotated toward the cursor. Irregular body spline + separate head spline, a straight 2 px gun line `(−2,7)→(26,7)`, two jointed arms gripping the gun. The same mint-green wireframe vocabulary as the monsters — the player belongs to the same drawing world.
* **Rune symbols** — the collectible: stick-figure glyphs scaled ×18, each segment's endpoints independently jittered, drawn three times at ~18 % alpha with ±3 px offsets (scatter ghosting) and once at full brightness 2.5 px, pulsing `0.72 + 0.28·sin(frame·0.07)`. Purple `#cc44ff`.

### Projectiles
* Bullets are **flat filled circles**, no trails: pale yellow for the player (radius 4), orange for enemies. Power shots are 3× radius. Bounce shots are hollow pale-blue "bubbles" (35 alpha fill, 1.5 px outline, white glint dot).
* Muzzle flash: a short-lived (5–7 frame) pale-yellow glow circle plus 3 (5 for power) stroke rays at the barrel tip.

## 5. Motion and feel

### Player
* Top-down, 4 px/frame, linear **100 ms acceleration/deceleration** ramp (no instant stops, no sliding). Diagonals normalised. Axis-separated wall collision so you slide along walls.
* Semi-auto shooting; every shot has a small muzzle flash. Power shots push the player back 8 px and freeze game logic for 20 ms on a hit (hit-stop).
* After taking damage the player **blinks** (visible every other 4 frames) for 45 frames.

### Enemy movement vocabulary
Each enemy has one signature motion — keep that idea in a new game:
* **Ghost:** relentless slow homing (1.5 px/f); lunge ghosts occasionally burst at 2.4× for ~32 frames.
* **Skull:** back-and-forth patrol ±110 px, fires every 60 frames.
* **White skull:** kites at ~155 px, strafes perpendicular, flips direction every 2–4 s, fires **sinusoidally weaving** shots (±0.65 rad at 0.10 rad/frame).
* **Ghoul:** slow crawl then **sudden leap** at 5.5× speed when within ~180 px; leaps stop dead against walls.
* **Mummy:** very slow (0.85) shamble; periodic fly swarms.
* **Demon:** slow, relentless, poisons the space around and behind it.
* **Bosses:** three phases that each speed up and add an attack; a 2-second invulnerable "shield" with spark scatter between phases; arrival set-pieces (see §7).
* Enemy speed grows with floor number (+6.5 % per floor, capped at 1.3×).

### Ambient/idle animation values (rad per frame)
Ghost flicker 0.12 · ghost hem wave 0.07 · skull pupils 0.09 · white skull glow 0.07/0.12 · pickups 0.08–0.15 · demon eye 0.07 · Ashtaroth wing flap 0.06 · mummy arm sway 0.03 · boss halo `0.07 + phase·0.045` · phase shield 0.25 · elite shield 0.18. Slow and unsynchronised = creepy; fast and regular = alarm.

### Particles and fades
* **Gas clouds (demon, Ashtaroth, lumps):** many small circles (alpha ≈ 0.35–0.45) spawned at a steady interval; each fades in over its first ~15–35 %, holds, fades out over the last ~15–40 %; they drift slowly with a random walk and live 200–700 frames. Green on a dark room is the game's "toxic" language.
* **Death burst (ordinary enemy):** a single **expanding hollow ring** in the creature's colour, growing from its radius to 3.5× over 35 frames while fading from 0.85 → 0. No chunks, no gore — just a ring.
* **Boss death:** a 5-ring cascade (white, red, orange, yellow, red; max radii 220/150/115/85/55; staggered 0/0/15/30/50 frames) plus eight scattered fragment rings. Followed by screen shake and a white flash.
* **Fly pop:** 5 tiny green dots scatter outward, decelerate and fade.
* **Shield sparks:** short yellow streaks that decelerate and fade over ~15 frames when bullets hit an invulnerable thing.

### Screen-space effects
* **Low-HP vignette:** below 25 % HP, four 55 px red bars frame the screen, pulsing; the pulse rate climbs from 0.04 to 0.12 rad/frame as health falls.
* **Screen shake:** random ±(shake/2) translation, decaying 0.5 px/frame (22 px on a heavy impact).
* **Flicker flash:** picking up a rune overlays the screen with a tinted rectangle pulsing three times at ≤ 22 % alpha for 40 frames.
* **Fades:** white flash at the instant of a big kill, black overlays for scene changes, 170/215 alpha black behind pause/game-over/map panels.

## 6. Typography and UI

* **Title:** "Haunted House" in **Creepster** 80 px, game-over red `#ff4444`. It **flickers** to pink `#ff88bb` (when `sin(frame·0.08) > 0.7`) and has very rare glitch intrusions: rarely (≈ once per 8 min) flashes black, (3 min) near-black, (≈ once a minute) a sickly green `#55bb77`, (≈ twice a minute) grey `#909090`, each lasting 2–15 frames. Think "broken TV channel", not "animated logo".
* **UI body:** monospace, 9–14 px, centred, `#aaaacc` for text and `#8866aa` for secondary/hint text. Key hints are written in a compact "KEY  action" style.
* **Boss names:** Creepster 16 px in the boss's accent colour, under the boss HP bar.
* **HUD layout:** HP bar (140×12) top-left with `HP 100 / 100` below; three powerup slots (44×20, 2 px radius) beside it, selected slot has a lighter outline; title and score top-centre; floor/enemy count top-right; transient `— CLEARED —` in 22 px yellow that fades over 40 frames; contextual hints centred at the bottom.
* **Big screens:** semi-transparent black wash + large monospace headline (`GAME OVER` 52 px red, `YOU ESCAPED!` 46 px cyan). Victory text is orange `#ff7733` 32 px with pale `#ddd8cc` body copy and a dry, slightly deadpan tone.
* **Voice:** terse, in-world, a little wry (the victory text turns the ruins into affordable housing and a small supermarket).

## 7. Set-pieces and tonal contrast

* **Boss arrivals** (3 s each, enemy invulnerable): the skull **spins and scales up from a point**, decelerating; Rotten Philip **falls from above the screen** with quadratic acceleration and lands with a 22 px screen shake; Ashtaroth **rises from a row of 20 swaying flame tongues** (orange outer, `#ffaa00` inner) along the bottom edge, easing out. Each has its own long synthesised sound (see §8).
* **Phase change:** a yellow `#ffee00` pulsing glow tracing the boss silhouette and a layered "scheming" sound.
* **End-of-cycle victory** is the game's deliberate tonal reversal. After the final boss: white flash + debris + explosion rings, fade to black, then a **bright pastoral daytime scene** — pale-blue banded sky, soft sun, white clouds, a muted green hill, and the **ruins of the house drawn in warm stone-colour line art** (`#c0a890`) with rubble, fallen beams, and drifting chimney smoke (three bezier wisps looping every 130 frames). Daylight, birdsong and a major-key bell melody replace the dark/wireframe/minor world. Use this contrast sparingly: the horror reads *because* the relief exists.

---

## 8. Sound design

**Everything is synthesised live with the Web Audio API — no audio files.** Oscillators, filtered noise, LFOs, a generated reverb impulse, and a simple master gain. This gives the game its "raw, hand-built, slightly cheap-synth horror" character; keep it that way.

### 8.1 Signal path
* `master` gain **0.7** → destination.
* A global **convolution reverb**: stereo noise burst, 3.0 s long, decaying with an exponent of 2.5 (a dark, cavernous tail). Most atmospheric sounds are sent to the reverb; punchy/impact sounds go direct to `master`. Many go to both.
* Browsers require a user gesture before audio starts — initialise on the first click/key. Re-resume the context if it suspends.
* Envelope habit: set gain to `0.001`, `linearRamp` up over 10–50 ms, then `exponentialRamp` down to `0.0001`. Always schedule `stop()` shortly after the tail. Pitch changes are almost always `exponentialRamp` glides (sweeps are a signature of the sound).
* Volume constants are exposed individually (`SFX_VOL_*`) so the mix is tweakable in one place. Typical peak gains: UI/pickups 0.18, creatures 0.1–0.3, boss impacts up to 0.35, melody notes 0.045–0.09, drone 0.03–0.08.

### 8.2 Music (generative, never a fixed tune)
Music is a **continuous drone plus randomly-timed single notes**. There is no rhythm section, no repeating melody — it is ambient dread.

**Normal (exploration)**
* **Drone:** two **sawtooth** oscillators at **55 Hz and 55.5 Hz** (A1, detuned by 0.5 Hz so they slowly beat), through a **lowpass at 220 Hz (Q 1.2)**, gain 0.08, sent to reverb and master.
* **Pulse:** a **1.2 Hz sine LFO** modulates the drone's gain (±0.04) — a slow heartbeat/throb.
* **Melody:** every **2–8 s** (random), one note chosen at random from **F♯ minor pentatonic** `[185, 220, 247, 277, 370, 440, 494, 554] Hz`; waveform randomly sine or triangle; length 0.4–0.8 s; peak 0.06; sent only to the reverb (so notes sound distant and washy).

**Boss mode (swapped smoothly with `setTargetAtTime`, 0.5–2 s time constants)**
* *Skull/Ghoul/Ashtaroth boss:* LFO → **2.4 Hz** (faster pulse), filter opens to **400 Hz**, melody **an octave down** (×0.5).
* *Mummy boss:* drone drops to **40 Hz**, LFO **0.55 Hz** (very slow), filter closes to **110 Hz**, melody moves to a **dissonant diminished/chromatic scale** `[146,155,174,196,207,233,277,311]` in **sawtooth** at **¼ pitch**, notes every **3.5–11.5 s**, 0.8–2.0 s long. Reads as "tomb".

**Victory (after boss)**
* Drone becomes **triangle at 110 Hz (+0.6 Hz detune)**, lowpass 520 Hz, quieter (0.05), LFO 2.1 Hz at low depth; melody from **C major pentatonic** `[261,329,392,440,523,659,784]`, notes every 0.9–3.1 s, short (0.18–0.46 s) and louder (0.09). Brighter, quicker, relieved.

**Cycle-complete / pastoral aftermath**
* Drone: **two sine waves a perfect fifth apart (130.8 Hz C3 + 196 Hz G3)** through a wide-open 1400 Hz lowpass, gain 0.032, with a **0.18 Hz** LFO "breathing".
* **Wind:** 3 s of looping white noise through a **bandpass at 900 Hz (Q 0.35)** at gain 0.009 — barely audible breeze.
* **Bell melody:** sine notes from a multi-octave C-major scale, every 2–6 s, 0.6–1.6 s long, with reverb.
* **Birdsong:** every 4–13 s a two-note chirp: sine at 820–1320 Hz, second note ×1.22–1.40, each 60–110 ms with a tiny upward bend, gain 0.035–0.06, reverb-washed.

### 8.3 The sound-design vocabulary
Use these *recipes* to make new SFX in the same family:

| Idea | Recipe |
|---|---|
| **Gunshot** | 70 ms white-noise burst, **highpass 3 kHz**, very quiet (0.05), exponential decay. A dry "tss". |
| **Power shot** | 140 ms noise through **lowpass 900 Hz (Q 1.4)** + a sine thud gliding **140 → 45 Hz** over 0.2 s. Heavier, bassier. |
| **Hit confirm** | sawtooth sting **420 → 65 Hz** in 90 ms + 90 ms **bandpass-950 Hz noise** crack. |
| **Enemy death** | sawtooth **220 → 40 Hz** over 0.4 s into the reverb + a 0.2 s noise puff. |
| **Room enter** | a soft **330 Hz sine** swell (80 ms in, 350 ms out) through reverb. |
| **Pickup** | rising three-note sine arpeggio **440, 554, 659 Hz** (A-C♯-E), 60 ms apart. |
| **Max-HP fanfare** | 5 ascending triangle notes (90 ms apart), a sustained C-major chord bloom with reverb tail, and a high sine sparkle sweeping **2093 → 3136 Hz**. The one purely joyful sound. |
| **Win** | slow rising C-major sine arpeggio `[261,329,392,523,659,784]`, 180 ms apart, long reverb tails. |
| **Rune pickup** | *deliberately discordant*: triangle **tritone** pair gliding down 15 %, two **square waves a minor second apart** (beating), and a metallic sawtooth scrape **880 → 440 Hz** through a **highpass at 1.8 kHz**. |
| **Final rune** | same idea scaled up: octave-doubled tritones with a 0.9 s glide, beating minor seconds, plus a **sawtooth shriek 220 → 1760 → 880 Hz** and a sub-bass thud (~1.3 s). Triumph that is still unsettling. |
| **Ghost lunge** | breathy "hoooo": a sine gliding **200 → 290 → 230 Hz** (0.75 s) + bandpass noise around 260 Hz + a quiet 580 Hz triangle overtone for a hollow quality. All via reverb. |
| **Ghoul leap** | panicked animal squeal: sawtooth **380 → 1050 → 520 Hz** + square-wave tremolo layer (32 Hz LFO). |
| **Long-ghoul leap** | the same, higher and more shrill (**600 → 1750 → 850 Hz**, 55 Hz tremolo) with an extra piercing 2.4–3.2 kHz sawtooth. |
| **Ghoul-boss leap** | the long-ghoul leap shifted **down by ~¼** (150 → 440 → 210 Hz) with a sine sub-thud 80 → 35 Hz. *Rule: bigger monster = same sound, lower pitch.* |
| **Ghoul-boss landing** | very fast-attack sine **65 → 18 Hz** + sawtooth crunch from 90 Hz + lowpass-280 Hz noise rumble. |
| **Mummy awaken** | 55 Hz sawtooth groan with a mid layer of dry creaking square wave around 220 Hz. |
| **Fly release / buzz** | bandpass-800 Hz noise burst + a 160→120 Hz square buzz; each individual fly buzz is a **square wave at 90–170 Hz, frequency-modulated by a 38–60 Hz LFO** (wing-beat), 0.22 s long, repeated every 80–160 frames. |
| **Boss enter** | 40 → 55 Hz sawtooth rumble swelling over 0.4 s and fading over 2 s + a high 880 → 220 Hz sawtooth screech starting at 0.3 s. |
| **Skull-boss arrival (3 s)** | sub-bass sawtooth **38 → 72 Hz**, a square wave **220 → 440 Hz** with a tremolo that **slows from 9 to 2 Hz** as the skull "materialises", then a **crash at 2.85 s** (sawtooth 110 → 28 Hz + thud). |
| **Boss phase change (2 s)** | four layers: a breathing 52→72→58 Hz sawtooth growl with a sweeping lowpass; three detuned (0/−16/+21 cents) sawtooth oscillators around 220→196 Hz (beating = alive); an irregular square-wave **diminished-seventh motif** (B, D, F, A♭ — uneven rhythm, "scheming"); and a high triangle at 880 Hz with an **accelerating 5→11 Hz vibrato**. |
| **Ashtaroth lump** | wet meaty thud: noise through **lowpass 420 Hz (Q 1.5)** + a sine thud from 110 Hz. |
| **Ashtaroth barrage** | rapid staggered noise "splats" through bandpass filters rising from 600 Hz in 120 Hz steps, over a low sawtooth sub-thud. |
| **Player death (~2 s)** | the nastiest sound in the game. Five layers: a sawtooth "vocal" **155 → 235 → 42 Hz** with a choking 9→16 Hz tremor; six staggered bandpassed noise bursts (blood-gargle); three detuned square oscillators (~204/217/231 Hz) amplitude-modulated at ~183–211 Hz (a bee swarm); a last pitch-spike choke **195 → 440 Hz** cut off abruptly; and a sine thud **88 → 28 Hz**. The first four pass through a **"megaphone"** chain — bandpass ~1800 Hz + hard waveshaper clipping. |

### 8.4 Sonic principles to carry over
1. **Waveforms by mood:** sawtooth = threat/organic/growl; square = insectile/electronic/alarm; triangle = eerie-clean/ghostly; sine = pure/safe/reward. A good guide for assigning a voice to a new creature.
2. **Pitch communicates size.** Same gesture, lower frequencies, bigger enemy.
3. **Detune and beat.** Use pairs of oscillators a few cents or Hz apart (drone 55/55.5 Hz, boss growl ±16/21 cents) so the sound is never static.
4. **Dissonance = danger.** Tritones, minor seconds and diminished sevenths for anything dire; pentatonic scales for ambience; major triads only for *reward* and *relief*.
5. **Sweeps over steps.** Sounds glide (exponential pitch ramps) rather than hop between notes.
6. **Reverb as space.** Atmospheric, creature and boss sounds go into a long dark reverb; short utility sounds (shots, hits) stay dry and punchy.
7. **Sparseness.** Music never fills the silence. Long gaps between notes, constant low drone, the occasional unsettling stinger.
8. **Layered grotesquerie** for the big moments: four or five simple layers, each a single oscillator or noise source with a filter, stacked rather than using any one complex sound.
9. **Silence of the safe place.** The victory scene's wind and birds are extremely quiet (0.009 gain wind) — "peace" is a faint thing.

---

## 9. Don'ts (things that would break the style)

* No bitmap sprites, image files, sprite sheets or audio files — everything is drawn and synthesised in code.
* No blur, `shadowBlur`, gradients or textures inside the game world (the victory sky's flat colour bands are the only gradient, and they sit in the deliberately different "daylight" scene).
* No thick or filled creature bodies — fill only dots, faint glows and background-colour occluders.
* No perfectly symmetric, identical enemies — always add per-instance jitter.
* No static entities — something on every creature should pulse, flicker, sway or crawl.
* No gore chunks or blood splatter — deaths are expanding rings and fades.
* No continuous rhythmic music or loops with a beat — drone + sparse random notes only.
* No major-key or bright sounds for threats; keep major triads and pure sines for rewards and relief.
* No pure white except for brief flashes (explosion core, screen flash).

## 10. Quick-start checklist for a new game in this style

- [ ] 800×600 logical canvas on `#0a0a0f`, scaled uniformly; custom crosshair, hidden cursor.
- [ ] Draw with 1.5 px strokes and `noFill()`; fills only for dots, glows and occluders.
- [ ] Walls `#3a3a5c`, floor grid 0.5 px at `#141420` every 40 px, door gaps with tick marks.
- [ ] One hue per creature class; hot/saturated on cold dark navy; player in mint green.
- [ ] Every creature: spline body with per-instance deformation, a pulsing glow or alpha, one signature motion.
- [ ] Death = expanding hollow ring; boss death = 5-ring cascade + flash + shake.
- [ ] Gas/poison = soft green circles with fade-in/hold/fade-out alpha.
- [ ] Creepster for title and bosses; monospace for everything else; terse wry copy.
- [ ] Music = detuned sawtooth drone (low-passed) + LFO throb + sparse random pentatonic notes with long reverb.
- [ ] SFX = layered oscillators + filtered noise; sawtooth for threat, square for insects, triangle for ghosts, sine for rewards; bigger = lower.
- [ ] Reserve one bright, major-key, daylight scene for the payoff.

---

## Appendix A — Portable code (p5.js global mode)

These are condensed from the Haunted House source with the game logic stripped out. The values are the ones the original uses.

### A.1 Canvas setup (scaled logical 800×600)

```js
const W = 800, H = 600;
let S = 1;                                   // logical → pixel scale
function setup() {
  S = Math.min(windowWidth / W, windowHeight / H);
  createCanvas(W * S, H * S);
  frameRate(60);
  noCursor();
}
function draw() {
  resetMatrix();
  background('#0a0a0f');
  scale(S, S);
  const mx = mouseX / S, my = mouseY / S;    // use logical mouse coords everywhere
  // ... draw world, then HUD, then overlays
}
```
CSS: `body { background:#000; display:flex; justify-content:center; align-items:center; height:100vh; overflow:hidden } canvas { display:block; cursor:none }`. Load Creepster via `@font-face` and use `textFont('Creepster')` for display text, `textFont('monospace')` for everything else.

### A.2 Drawing helpers

```js
const rand = (a, b) => a + Math.random() * (b - a);
const pulse = (base, amp, k, offset = 0) => base + amp * Math.sin(frameCount * k + offset);

function withAlpha(a, fn) {                  // fades strokes AND fills
  drawingContext.globalAlpha = a; fn(); drawingContext.globalAlpha = 1;
}

// Closed Catmull-Rom spline through pts ([[x,y],...]), placed at (x,y), scaled by s.
// The wrap-around phantom points make the curve close smoothly.
function closedSpline(pts, x = 0, y = 0, s = 1) {
  const n = pts.length;
  beginShape();
  curveVertex(x + pts[n-1][0]*s, y + pts[n-1][1]*s);
  for (const [px, py] of pts) curveVertex(x + px*s, y + py*s);
  curveVertex(x + pts[0][0]*s, y + pts[0][1]*s);
  curveVertex(x + pts[1][0]*s, y + pts[1][1]*s);
  endShape(CLOSE);
}

// Irregular blob: n points round an rx×ry ellipse, each radius jittered. Generate ONCE at spawn.
function makeBlob(n, rx, ry, jx, jy = jx) {
  return Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 / n) * i;
    return [(rx + rand(-jx, jx)) * Math.cos(a), (ry + rand(-jy, jy)) * Math.sin(a)];
  });
}
// Original values: ghoul body makeBlob(10, 1.2, 0.75, 0.3, 0.2) × radius (squat crawler);
// player body makeBlob(8, 7.5, 11, 1.5) in px; player head makeBlob(6, 4, 4, 1) offset +4 x.

// Skull-ish head: wider cranium at top, narrow jaw at bottom, ±1.2 px jitter (7 points).
function makeSkullHead() {
  return Array.from({ length: 7 }, (_, i) => {
    const a = (Math.PI * 2 / 7) * i - Math.PI / 2;
    const r = 10.5 + 2.0 * Math.max(0, -Math.sin(a)) - 2.5 * Math.max(0, Math.sin(a)) + rand(-1.2, 1.2);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

// Jointed insect leg: 1–4 joints (40/40/15/5 %), ~11 px total, random bend at each joint.
function makeLeg(baseAngle) {
  const r = Math.random();
  const nJ = r < 0.40 ? 1 : r < 0.80 ? 2 : r < 0.95 ? 3 : 4;
  const seg = (11 + rand(-2, 3)) / (nJ + 1);
  return {
    dir: baseAngle + rand(-0.35, 0.35),
    segLens: Array.from({ length: nJ + 1 }, () => seg + rand(-2, 2)),
    bends:   Array.from({ length: nJ },     () => rand(-0.6, 0.6)),
  };
}
// Legs at angles [-π/4, π/4, 3π/4, 5π/4]; animate with anim = (i%2 ? -1 : 1) * sin(crawlPhase) * 0.25,
// crawlPhase += 0.09 per frame.
function drawLeg(leg, x, y, radius, anim, w = 1.5) {
  let dir = leg.dir + anim;
  let cx = x + Math.cos(dir) * radius * 1.05, cy = y + Math.sin(dir) * radius * 0.7;
  strokeWeight(w);
  leg.segLens.forEach((len, k) => {
    if (k > 0) dir += leg.bends[k - 1];
    const nx = cx + Math.cos(dir) * len, ny = cy + Math.sin(dir) * len;
    line(cx, cy, nx, ny);
    if (k < leg.bends.length) { strokeWeight(w * 2); point(nx, ny); strokeWeight(w); }  // joint dot
    cx = nx; cy = ny;
  });
}

// Typical creature draw: glow, outline, eyes.
function drawCreature(e, col) {
  withAlpha(pulse(0.17, 0.05, 0.07, e.x * 0.03), () => { noStroke(); fill(col); circle(e.x, e.y, (e.r + 8) * 2); });
  noFill(); stroke(col); strokeWeight(1.5);
  closedSpline(e.body, e.x, e.y, e.r);
  e.legs.forEach((leg, i) => drawLeg(leg, e.x, e.y, e.r, (i % 2 ? -1 : 1) * Math.sin(e.crawl) * 0.25));
  withAlpha(pulse(0.55, 0.45, 0.09, e.x * 0.02), () => { noStroke(); fill(col);
    circle(e.x - 4, e.y - 3, 4); circle(e.x + 4, e.y - 3, 4); });
}
```

### A.3 Particles: gas wisps and death rings

```js
// Gas wisp (toxic trail): spawn one every 3–6 frames at the emitter, ±8 px.
const wisp = (x, y, life) => ({ x: x + rand(-8, 8), y: y + rand(-8, 8),
  vx: rand(-0.25, 0.25), vy: rand(-0.35, 0), life, maxLife: life, size: rand(4, 9) });
function tickWisp(p) { p.x += p.vx; p.y += p.vy; p.vx += rand(-0.03, 0.03); p.life--; }   // random-walk drift
function wispAlpha(p, peak = 0.35) {          // fade in, hold, fade out
  const f = p.life / p.maxLife;
  return f > 0.85 ? (1 - f) / 0.15 * peak : f < 0.40 ? f / 0.40 * peak : peak;
}
// draw: noStroke(); withAlpha(wispAlpha(p), () => { fill('#44ff66'); circle(p.x, p.y, p.size * 2); });

// Death ring: hollow circle grows radius → 3.5×radius over 35 frames, alpha 0.85 → 0.
const ring = (x, y, r, col, life = 35, maxR = r * 3.5, delay = 0) =>
  ({ x, y, r0: r, maxR, life, maxLife: life, col, delay });
function drawRing(p) {            // caller: if (p.delay > 0) p.delay--; else p.life--;
  if (p.delay > 0) return;
  const t = 1 - p.life / p.maxLife;
  withAlpha((1 - t) * 0.85, () => { noFill(); stroke(p.col); strokeWeight(1.5);
    circle(p.x, p.y, (p.r0 + (p.maxR - p.r0) * t) * 2); });
}
// Boss death: ring(x,y,r,'#ffffff',90,220) + ring(..,'#ff2222',80,150) + ring(..,'#ff6600',70,115,15)
//           + ring(..,'#ffcc00',55,85,30) + ring(..,'#ff2222',40,55,50), plus 8 small rings
//           (r 4 → 20) scattered 28–50 px out, alternating '#ff4444'/'#ff8800', random 0–25 f delay.
```

### A.4 Audio engine skeleton

```js
const Sound = (() => {
  let ctx, master, reverb;

  function init() {                          // call from the first click/keypress
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    // Dark 3 s reverb: stereo noise impulse with (1 - t)^2.5 decay
    reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    reverb.buffer = buf; reverb.connect(master);
    ctx.onstatechange = () => { if (ctx.state === 'suspended') ctx.resume(); };
  }

  // One oscillator voice: optional exponential pitch glide, fast attack, exponential decay.
  function tone({ type = 'sine', f0, f1 = f0, t = 0, dur, peak, attack = 0.01, to = ['master'] }) {
    const now = ctx.currentTime + t, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, now + dur);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(peak, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); to.forEach(d => g.connect(d === 'reverb' ? reverb : master));
    o.start(now); o.stop(now + dur + 0.05);
    return o;                                // so callers can add an LFO to o.frequency
  }

  // Filtered white-noise burst.
  function noise({ dur, peak, type = 'highpass', freq = 3000, Q = 1, t = 0, to = ['master'] }) {
    const now = ctx.currentTime + t, len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, now); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g); to.forEach(x => g.connect(x === 'reverb' ? reverb : master));
    src.start(now); src.stop(now + dur + 0.02);
  }

  // Examples from the original:
  const sfx = {
    shoot:  () => noise({ dur: 0.07, peak: 0.05, type: 'highpass', freq: 3000 }),
    hit:    () => { tone({ type: 'sawtooth', f0: 420, f1: 65, dur: 0.12, peak: 0.52, attack: 0.001 });
                    noise({ dur: 0.07, peak: 0.5, type: 'bandpass', freq: 950, Q: 1.8 }); },
    death:  () => { tone({ type: 'sawtooth', f0: 220, f1: 40, dur: 0.4, peak: 0.2, attack: 0.001, to: ['reverb'] });
                    noise({ dur: 0.2, peak: 0.1, type: 'lowpass', freq: 8000, to: ['reverb'] }); },
    pickup: () => [440, 554, 659].forEach((f, i) => tone({ f0: f, t: i * 0.06, dur: 0.12, peak: 0.18, attack: 0.001 })),
    enter:  () => tone({ f0: 330, dur: 0.35, peak: 0.12, attack: 0.08, to: ['reverb'] }),
  };

  // Ambient score: detuned low-passed sawtooth drone + LFO throb + sparse random pentatonic notes.
  function startMusic() {
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 220; filt.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.value = 0.08;
    for (const f of [55, 55.5]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(filt); o.start();
    }
    filt.connect(g); g.connect(reverb); g.connect(master);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 1.2; lg.gain.value = 0.04; lfo.connect(lg); lg.connect(g.gain); lfo.start();

    const SCALE = [185, 220, 247, 277, 370, 440, 494, 554];   // F# minor pentatonic
    (function next() {
      setTimeout(() => {
        tone({ type: Math.random() < 0.5 ? 'sine' : 'triangle',
               f0: SCALE[Math.floor(Math.random() * SCALE.length)],
               dur: 0.4 + Math.random() * 0.4, peak: 0.06, attack: 0.02, to: ['reverb'] });
        next();
      }, 2000 + Math.random() * 6000);
    })();
    // Mode changes (boss etc.): retarget lfo.frequency / filt.frequency / drone pitches
    // with setTargetAtTime(value, ctx.currentTime, 0.5–2.0) so the mood morphs, never cuts.
  }

  // "Megaphone" distortion used on the death scream: bandpass 1800 Hz (Q 2.2) → hard soft-clip.
  function megaphone() {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2.2;
    const ws = ctx.createWaveShaper(), c = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i * 2 / 256 - 1; c[i] = (Math.PI + 120) * x / (Math.PI + 120 * Math.abs(x)); }
    ws.curve = c; bp.connect(ws); ws.connect(master); ws.connect(reverb);
    return bp;                               // connect voices into this
  }

  return { init, tone, noise, sfx, startMusic, megaphone };
})();
```

To add **tremolo or wing-beat** to a voice, connect an LFO oscillator through a gain into `osc.frequency` (vibrato/FM, e.g. flies: 38–60 Hz LFO, depth = 0.35 × freq) or into a gain node's `.gain` (amplitude flutter, e.g. ghoul squeal: 32 Hz). This is how most of the "creature" sounds in §8.3 are built.
