# Haunted House

Top-down wireframe roguelike shooter built with p5.js (no build tools).
Open `index.html` directly in any modern browser to play.

## Controls

| Input | Action |
|---|---|
| WASD / Arrow keys | Move |
| Mouse | Aim |
| Left click (hold) | Shoot |
| Space | Use selected powerup from inventory |
| Q | Cycle to next inventory slot |
| M | Toggle map (pauses game; visited rooms shown; fullmap mode shows all) |
| N | Next floor (from win screen) |
| P | Toggle pause |
| Esc | Close map; pause game (if playing); return to menu (if paused/win/game-over) |
| Enter | Start game from menu |
| ` (backtick) | Toggle developer console |

## Stages

| Stage | Status | Description |
|---|---|---|
| 1 | ✅ Done | Single room, Ghost enemies, shoot/move/HP |
| 2 | ✅ Done | Multi-room dungeon (7–14 rooms), door slide transitions |
| 3 | ✅ Done | Skeleton + Boss enemies, locked boss room, win screen, score |
| 4 | ✅ Done | Synth music + SFX (Web Audio API, no files) |
| 5 | ✅ Done | Polish: death animations, HP vignette, enemy drops, floor progression |
| 6 | ✅ Done | Ghoul enemy, lunge ghosts, skull enemies, power-shot powerup, boss skull |
| 7 | ✅ Done | Dev console, fullmap, dynamic resolution scaling, floor difficulty scaling |
| 8 | ✅ Done | High score table (localStorage), name entry on death |
| 9 | ✅ Done | Long Ghoul + Mummy enemies, Mummy Boss, fly swarm, powerup inventory system, max-HP powerup |

## File Map

```
p5.min.js         — p5.js 1.9.4 vendored locally (no CDN dependency)
creepster.ttf     — Creepster horror font (Google Fonts, vendored locally)
js/constants.js   — all magic numbers, colour palette, difficulty tuning constants
js/utils.js       — collision math, vector helpers, getWallRects(), SYMBOL_GLYPHS, getFloorSymbols()
js/state.js       — global G object, state machine, enterRoom(), transitions
js/bullet.js      — 128-bullet object pool
js/door.js        — getDoorCenter(), OPP_DIR
js/rooms.js       — Room class + DungeonGraph procedural generation
js/enemy.js       — GhostEnemy, SkullEnemy, GhoulEnemy, LongGhoulEnemy, MummyEnemy, MummyBossEnemy, MummyFly, BossEnemy, spawnEnemies()
js/player.js      — WASD movement, axis-separated collision, shooting
js/audio.js       — AudioEngine: Web Audio API synth music + SFX, no audio files
js/scores.js      — HighScores: localStorage top-5 table with name entry
js/renderer.js    — ALL p5.js draw calls live here
js/main.js        — p5 setup()/draw() + input handlers + dev console
css/style.css     — page/canvas styling
```

## Game Loop

```
MENU → (Enter / click) → PLAYING ⇄ PAUSED (P or Esc)
                          PLAYING → ROOM_TRANSITION → PLAYING
                                  ↓
                            GAME_OVER → NAME_ENTRY (if high score) → MENU
                            WIN → MENU  (or N for next floor)
```

## Room Types

| Type | Enemies | Notes |
|---|---|---|
| start | none | Pre-cleared; player spawns here |
| ghost | Ghosts (depth-scaled) | Depth 1–2 |
| skull | Skulls + Ghouls | Depth 3–4 |
| mixed | Ghosts + Skulls + Ghouls | Depth 5+ |
| boss | Boss (1) | Deepest room; door physically locked until all floor symbols collected; stairwell opens on boss death. Skull boss on odd floors; Mummy boss on even floors. |
| treasure | none | Dead-end at depth ≥2; +40 HP heal powerup (goes to inventory) |

## Enemy Types

| Type | HP | AI | Damage | Score |
|---|---|---|---|---|
| Ghost | 30 | Always chases; contact damage | 15 | 10 |
| Lunge ghost | 30 | As ghost; brief 2.4× speed bursts every 60–140f | 15 | 10 |
| Skull | 50 | Patrols; fires toward player every 60f | 10/bullet | 25 |
| White Skull | 80 | Like skull; fires weaving sinusoidal bullets; occasionally fires 8-bullet scatter burst (75% chance when player is very close); floor 3+ | 12/bullet | 50 |
| Ghoul | 50 | Slow crawl; leaps at 5.5× speed when in range | 40/contact | 35 |
| Long Ghoul | 100 | Like Ghoul but with 5 legs (one always longer), scrunched body, grey-white; leaps far more often (cooldown 20–55f) | 40/contact | 70 |
| Mummy | 225 | Rises from tomb over 3s (invulnerable); then pursues slowly; periodically releases fly swarms; never on floor 1 | 25/contact | 80 |
| Mummy Fly | 5 | Pursues player; individual droning sound; 7s lifetime; small—easier to avoid than shoot | 8/contact | 3 |
| Boss (Skull) | 300 | 3-phase radial burst (4/8/12 bullets); speeds up each phase; 2s invulnerable on phase change; phase 3 occasionally fires 18-bullet spiral (35% chance); floor 3+/phase 2+ spawns skull minions every 300f (phase 2) or 210f (phase 3); floor 5+ minions may be white skulls (50%); odd floors | 20/bullet | 200 |
| Boss (Mummy) | 400 | Like skull boss (3 phases) but releases fly swarms each phase; phase 2+ spawns ghoul every 400f (phase 2) or 280f (phase 3); phase 3 also 40% chance to raise a small mummy alongside ghoul; even floors | 20/bullet | 200 |

All enemy movement speeds and boss fire rate / bullet count scale with floor number (see `FLOOR_*` constants).
Incoming player damage scales up 10% per floor with no cap (`FLOOR_DAMAGE_BONUS`).

## Developer Console

Open with `` ` ``. Tab-completes commands.

| Command | Effect |
|---|---|
| `boss` | Teleport to boss room (spawns player in a covered corner) |
| `power` | Grant power (wide) shots |
| `fullmap` | Toggle full map view (shows unvisited rooms in dim outline) |
| `setfloor <n>` | Set floor number and re-apply difficulty scaling to live enemies |
| `spawn_ghost` | Spawn a normal ghost near player |
| `spawn_red_ghost` | Spawn a lunge ghost near player |
| `spawn_skull` | Spawn a skull near player |
| `spawn_ghoul` | Spawn a ghoul near player |
| `spawn_long_ghoul` | Spawn a long ghoul near player |
| `spawn_mummy` | Spawn a mummy near player |
| `help` | List all commands |

## Architecture Notes

- **Global mode p5.js** — `setup()`, `draw()`, `keyPressed()` etc. are top-level functions.
- `renderer.js` is the only file that calls p5 drawing functions.
- All game state lives in the single `G` object (`state.js`).
- **Resolution scaling** — canvas is created at the largest 4:3 size that fits the window; `_scale` in main.js maps logical 800×600 coordinates to actual pixels via `scale()` in renderer; `mouseX/mouseY` divided by `_scale` before passing to game logic.
- `getWallRects()` (utils.js) reads `G.currentRoom` and returns wall segments with door gaps when the room is cleared — used by player, enemy, and bullet collision.
- Bullet object pool (128 pre-allocated) avoids GC pressure; owner tag `'player'`/`'enemy'` controls which entities it damages.
- Player movement is axis-separated (move X → resolve, then move Y → resolve) for smooth wall sliding.
- Dungeon uses constrained random-walk on an abstract `Map<"x,y", Room>` grid. Size fixed at 7–14 rooms regardless of floor.
- Boss room = deepest room; entry wall treated as solid by `getWallRects()` until `ragAllCollected()`; stairwell direction set on `room.stairwell` when boss is killed.
- Treasure room pickup activated on `enterRoom()`, consumed in `checkPickup()` each frame.
- Lunge ghost: 30% of ghost spawns; timers controlled by `GHOST_LUNGE_COOLDOWN_MIN/MAX`.
- Power-shot powerup (was "wide-bullet"): 8 shots at 3× bullet radius; spawns in a second dead-end room (65% chance). HUD label "POWER", dev command `power`.
- GhoulEnemy: crawls slowly then leaps at `GHOUL_LEAP_SPEED` when within `GHOUL_LEAP_RANGE`; appears in skull and mixed rooms.
- **Floor difficulty scaling** — `_floorMult(bonus, cap)` in enemy.js computes a linear ramp capped at `cap`; stored on each enemy at spawn as `speedMult` (and `firerateMult`/`bulletMult` for boss). `setfloor` console command patches live enemies and reports speed + damage multipliers.
- **Incoming damage scaling** — `player.takeDamage()` multiplies all damage by `1 + (floor-1) × FLOOR_DAMAGE_BONUS` (10%/floor, no cap).
- **Drop rate scaling** — enemy heal-drop probability (`DROP_CHANCE`, base 40%) scales inversely with the dungeon's actual average enemies per combat room (`G.dungeon.avgEnemiesPerRoom`, computed after generation), keeping expected drops per room constant across floors. Drop amount per pickup is fixed at `DROP_HEAL_AMOUNT`.
- **HP preserved across floors** — `nextFloor()` saves and restores `player.hp`/`maxHp` and `G.score` so progression carries over.
- **Per-instance deformation** — Ghosts use `deform[6]` for organic silhouette variation; Skulls use `deform[5]` + `headPts[7]` (pre-computed irregular spline vertices); Ghouls use `bodyPts[10]` (irregular spline) + `legs[4]` (jointed legs with variable joint count 1–4); Boss `deform[8]` for skull vertex offsets; Player uses `bodyPts`/`headPts` splines with jointed arms; Rune symbols use `segJitter[N][4]` (per-segment endpoint offsets [dx1,dy1,dx2,dy2]) for unique stick-glyph deformation.
- **Boss phase transition** — on entering phase 2 or 3, boss becomes invulnerable for `BOSS_PHASE_TRANSITION_FRAMES` (120f = 2s), glows yellow, and plays the `boss_phase` SFX. `transitionTimer` tracked on the boss instance. Bullets intercept at the shield radius (`e.radius + 18`) with spark break-up; never reach the body.
- **Boss death explosion** — multi-wave particle burst (5 waves with staggered delays) plus 8 scattered fragments.
- **Elite enemies** — each combat room (floor 2+) has a 20–30% chance of one enemy being designated elite: pulsing yellow shield (`e.shielded = true`), invulnerable until all non-shielded room-mates die. `checkEliteShield()` runs each frame; bullets break up on the shield (radius+12) the same way as the boss.
- **Shield sparks** — `_spawnShieldSparks()` (bullet.js) pushes to `G.shieldSparks`; sparks decelerate and fade over ~15f, rendered as trailing yellow streaks by `drawShieldSparks()`.
- **Music modes** — AudioEngine has four modes: normal (F# minor pentatonic, sawtooth drone at 55Hz), skull-boss (half-speed melody, faster LFO 2.4Hz, filter 400Hz), mummy-boss (MUMMY_SCALE chromatic/diminished, 40Hz drone, very slow LFO 0.55Hz, filter 110Hz, freq×0.25 — deep tomb-like), victory (C major pentatonic, triangle drone at 110Hz, open filter, 2–3× faster melody). `setBossMode(active, isMummy)` selects the right mode; `stopMusic()` resets all.
- **Pause state** — `STATES.PAUSED` freezes game update but continues rendering. P key or Esc (while playing) enters pause; P resumes; Esc from pause goes to menu. Replaces old ESC-confirm flow.
- **Focus swallow** — `_justFocused` flag prevents accidental shot when the window regains focus.
- **High scores** — `HighScores` (scores.js) persists top-5 `{score, floor, name}` entries in localStorage. On death, `_beginEndSequence()` checks `qualifies()` and routes through `STATES.NAME_ENTRY` if so.
- All SFX volumes exposed as `SFX_VOL_*` constants for easy tuning.
- **Floor symbol system** — each floor has a set of 2–4 rune symbols to collect before the boss door opens. Floors 1–4 use fixed named sets (`RAG`, `OTR`, `NV`, `NTEM`); floor 5+ uses `getFloorSymbols(floor)` with a Mulberry32 seeded RNG (always deterministic for a given floor). Symbols are stick-figure glyphs defined in `SYMBOL_GLYPHS` (utils.js), placed in random non-start/non-boss/non-treasure rooms. Spawn uses up to 60 attempts with `circleRectCollide` to avoid placing symbols inside obstacles. `G.ragCollected` is keyed by the current floor's letters; `ragAllCollected()` checks all values. Visual: pulsing stick glyph with ghost-scatter copies; locked boss door shows letter progress (`·` for uncollected); HUD top-right shows per-letter status; map shows a tiny glyph in the room corner.
- **Powerup inventory** — player has 3 inventory slots (`player.powerups[3]`). Big room pickups (heal +40HP, power shots) go to inventory via `addPowerup(type)` instead of triggering immediately. Space activates the selected slot; Q cycles (`cyclePowerup()`). HUD shows all 3 boxes right of the HP bar. Max-HP powerup is instant (walk-over): +20% maxHp + heals 20% of new maxHp; never goes to inventory. Powerups preserved across floors via `nextFloor()`.
- **Mummy enemy** — `room.hasMummy` flag set in DungeonGraph; spawned by `spawnEnemies()` in addition to the room's normal enemies. Rises over `MUMMY_RISE_FRAMES` (180f) — invulnerable, drawing shifts down and fades in; ground cracks shown. After rising, pursues slowly and periodically releases fly swarms (`_releaseFlies()`). Floor 2+ only; probability `min(50%, 10%+(floor-2)×10%)`; at most 1 per floor.
- **MummyFly** — lives in `G.flies[]` (separate from `G.enemies[]`) so flies don't block room-cleared detection. Per-fly `droneFreq` (90–170Hz); calls `AudioEngine.playFlyBuzz(freq)` every 80–160f. 420f (7s) lifetime, then disappears. Can be shot but very small (score 3 each).
- **LongGhoul** — `_longGhoulChance()` = `min(80%, max(5%, (floor-1)×20%))`; substituted for regular Ghoul spawns. 5 legs (index 4 always 22–29px), scrunched body, grey-white color, 2× HP (100), leap cooldown 20–55f (vs 60–140f), plays `long_ghoul_leap` SFX.
- **WhiteSkull** — `_whiteSkullChance()` = 0 below floor 3, then `min(60%, 20%+(floor-3)×20%)`; at most 1 per room. Fires weaving bullets (`BulletPool.fireWeaving()`) with sinusoidal arc; also fires 8-bullet scatter burst (reuses boss_fire SFX). Scatter probability: 75% when player dist < `WHITE_SKULL_NEAR_RANGE` (100px), else 20%. Near-white/blue-tinted colour with glow ring.
- **Weaving bullets** — `Bullet.weave = { baseAngle, speed, freq, maxDev, age }`. Each frame in `BulletPool.update()`, if `b.weave` set: `dev = sin(age * freq) * maxDev`, velocity recomputed as `(cos(baseAngle+dev), sin(baseAngle+dev)) * speed`. Cleared on deactivate/refire.
- **Boss spiral attack** — phase 3 only; 35% chance to trigger instead of regular burst when `fireTimer` expires. Fires `BOSS_SPIRAL_BULLETS` (18) bullets one per `BOSS_SPIRAL_INTERVAL` (3) frames, rotating angle by `BOSS_SPIRAL_ROT` (0.75 rad) each bullet (~2.1 full rotations). `spiralActive` flag prevents overlapping spirals. Visual: 4 rotating arm lines at `e.spiralAngle`.
