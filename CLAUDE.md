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
| 10 | ✅ Done | Nuckelavee enemy (aura damage + toxic breath particles), boss death clears minions/flies, max-HP fanfare SFX, drop rate tuning |
| 11 | ✅ Done | Ghoul boss (3rd boss cycle), speed+invuln powerups, treasure map icons, nuckelavee poison trail, symbol pickup SFX+screen flicker, mummy death clears flies, fly death pop, +20% base damage, 4-symbol HUD fix |
| 12 | ✅ Done | Ghoul boss leap SFX (deep bass `ghoul_boss_leap`), player death SFX replaced with multi-layer strangling horror sound |
| 13 | ✅ Done | All boss HP +25%, power shot 15 shots + hit-freeze + recoil + bassier SFX, autofire powerup (50 rapid shots with spread), muzzle flash, final-symbol fanfare SFX |
| 14 | ✅ Done | Ashtaroth boss (4th cycle slot: bat wings, meat lump projectiles, gas trails), boss arrival animations (skull materialises/spins; Rotten Philip drops from above with screen shake), boss HP bar shows name in Creepster font, White Skull orbit/kite AI, mummy floor-4+ guaranteed spawn, screen shake system |

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
js/enemy.js       — GhostEnemy, SkullEnemy, WhiteSkullEnemy, GhoulEnemy, LongGhoulEnemy, NuckelaveeEnemy, MummyEnemy, MummyBossEnemy, MummyFly, BossEnemy, GhoulBossEnemy, AshtarothBossEnemy, MeatLump, spawnEnemies()
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
| boss | Boss (1) | Deepest room; door physically locked until all floor symbols collected; stairwell opens on boss death. Boss cycle: Skull (floor 1,5,9…), Ghoul boss (2,6,10…), Mummy boss (3,7,11…), Ashtaroth (4,8,12…). Completing floor 4/8/12/… shows the cycle-complete screen. |
| treasure | none | Dead-end at depth ≥2; +40 HP heal powerup (goes to inventory) |

## Enemy Types

| Type | HP | AI | Damage | Score |
|---|---|---|---|---|
| Ghost | 30 | Always chases; contact damage | 15 | 10 |
| Lunge ghost | 30 | As ghost; brief 2.4× speed bursts every 60–140f | 15 | 10 |
| Skull | 50 | Patrols; fires toward player every 60f | 10/bullet | 25 |
| White Skull | 80 | Orbit/kite AI: maintains ~155px from player, strafes perpendicular (direction flips every 2–4s); fires weaving sinusoidal bullets; occasionally fires 8-bullet scatter burst (75% chance when player is very close); floor 3+ | 12/bullet | 50 |
| Ghoul | 50 | Slow crawl; leaps at 5.5× speed when in range | 40/contact | 35 |
| Long Ghoul | 100 | Like Ghoul but with 5 legs (one always longer), scrunched body, grey-white; leaps far more often (cooldown 20–55f) | 40/contact | 70 |
| Mummy | 225 | Rises from tomb over 3s (invulnerable); then pursues slowly; periodically releases fly swarms; never on floor 1 | 25/contact | 80 |
| Mummy Fly | 5 | Pursues player; individual droning sound; 7s lifetime; small—easier to avoid than shoot | 8/contact | 3 |
| Boss (Skull) "KILLER SKULL" | 375 | 3-phase radial burst (4/8/12 bullets); speeds up each phase; 2s invulnerable on phase change; arrival: spins/materialises over 3s; phase 3 occasionally fires 18-bullet spiral (35% chance); floor 3+/phase 2+ spawns skull minions every 300f (phase 2) or 210f (phase 3); floor 5+ minions may be white skulls (50%); floors 1,5,9… | 20/bullet | 200 |
| Boss (Mummy) "THE DRY MOTHER" | 500 | Like skull boss (3 phases) but releases fly swarms each phase; phase 2+ spawns ghoul every 400f (phase 2) or 280f (phase 3); phase 3 also 40% chance to raise a small mummy alongside ghoul; floors 3,7,11… | 20/bullet | 200 |
| Boss (Ghoul) "ROTTEN PHILIP" | 438 | 3-phase leap boss; arrival: drops from top of screen, lands with screen shake + thud SFX; crawls toward player then leaps aggressively; phase 1: leap every 50–80f; phase 2: every 35–55f + ghoul minions; phase 3: every 20–35f + long ghoul minions; 2s invuln on phase change; floors 2,6,10… | 60/contact | 200 |
| Boss (Ashtaroth) "ASHTAROTH" | 500 | 4th boss cycle slot; bat-winged demon with horns; arrival: spins/grows from a point over 3s; fires big slow homing meat lumps (invulnerable, leave gas trail) + phase 2+ fires circular barrage of small shootable lumps; phase 3: erratic movement; leaves long-lasting brownish-red gas trail that damages player; 2s invuln on phase change; floors 4,8,12… | 35/contact + 30/big lump + 18/small lump + 10/trail | 200 |
| Nuckelavee | 180 | Slow relentless pursuer (skinless horse-rider silhouette); emits toxic aura 65px radius — 1 HP per tick, gated by player invincibility frames; leaves a persistent green gas trail that also damages; heavy body contact; one per skull/mixed room (25%, floor 2+); Orcadian folklore | 30/contact + 1/aura + 1/trail | 90 |

All enemy movement speeds and boss fire rate / bullet count scale with floor number (see `FLOOR_*` constants).
Incoming player damage scales up 10% per floor with no cap (`FLOOR_DAMAGE_BONUS`).

## Developer Console

Open with `` ` ``. Tab-completes commands. Up/Down arrow navigates command history (in-memory, newest first).

| Command | Effect |
|---|---|
| `boss` | Teleport to boss room (spawns player in a covered corner) |
| `powerup <name>` | Grant a powerup by name: `powershot`, `heal`, `speed`, `invuln`, `autofire`, `maxhp` |
| `fullmap` | Toggle full map view (shows unvisited rooms in dim outline) |
| `setfloor <n>` | Set floor number and re-apply difficulty scaling to live enemies |
| `spawn_ghost` | Spawn a normal ghost near player |
| `spawn_red_ghost` | Spawn a lunge ghost near player |
| `spawn_skull` | Spawn a skull near player |
| `spawn_ghoul` | Spawn a ghoul near player |
| `spawn_long_ghoul` | Spawn a long ghoul near player |
| `spawn_mummy` | Spawn a mummy near player |
| `spawn_demon` | Spawn a Nuckelavee (demon) near player |
| `spawn_white_skull` | Spawn a white skull near player |
| `spawn_ghoul_boss` | Spawn a ghoul boss (Rotten Philip) near player |
| `spawn_maxhp` | Spawn a max-HP powerup 40px right of the player |
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
- **Player movement** — linear acceleration curve: velocity ramps from 0 to `PLAYER_SPEED` (4 px/frame) in `PLAYER_ACCEL_MS` (100 ms, = 6 frames at 60fps), and decelerates at the same rate. Each frame, velocity steps toward the target (normalized input × speed) by `speed / accel_frames`; deceleration target is `{0,0}`. Speed powerup scales both top speed and step size, preserving the 100 ms ramp. Diagonal normalized to same speed as cardinal.
- **Shooting** — semi-auto: one shot per click. Holding the mouse button only continues firing while `autofireShots > 0`. Bullets spawn at the barrel tip (local coords `(26, 7)` rotated into world space: `pos + (cos(a)·26 − sin(a)·7,  sin(a)·26 + cos(a)·7)`).
- **Power-shot powerup**: 15 shots at 3× bullet radius; spawns in a second dead-end room (65% chance). HUD label "PWR", dev command `powerup powershot`. On fire: plays `power_shoot` SFX (deep lowpass noise + sub-bass thud), pushes player back `POWER_SHOT_RECOIL` (8 px), and freezes game logic for `POWER_HIT_FREEZE_MS` (20 ms) on hit (`G.freezeUntil` timestamp; checked in `draw()` before update phase).
- **Autofire powerup** — `'autofire'` type: 50 shots at `AUTOFIRE_FIRE_RATE` (4f/shot). First shot exact; each subsequent shot adds `AUTOFIRE_SPREAD_PER_SHOT` (0.022 rad) of angular spread up to `AUTOFIRE_MAX_SPREAD` (0.35 rad ≈ 20°). Spread decays 0.008 rad/frame naturally; resets to 0 on mouse release. Crosshair gap expands from 3 px to ~19 px proportionally. Orange triple-arrow sprite. HUD slot label "ATF", active indicator "ATF ×N". Spawns in dead-end rooms (23% chance, alongside wide/speed/invuln).
- **Muzzle flash** — `player.muzzleFlash { timer, maxTimer, isPower }` set on each shot; decremented in `update()`; rendered in `drawPlayer()` inside the `rotate()` block at barrel tip (local coords 26,7). Normal: 5f, small glow + 3 rays. Power: 7f, larger glow + 5 rays including tall verticals.
- GhoulEnemy: crawls slowly then leaps at `GHOUL_LEAP_SPEED` when within `GHOUL_LEAP_RANGE`; appears in skull and mixed rooms.
- **Floor difficulty scaling** — `_floorMult(bonus, cap)` in enemy.js computes a linear ramp capped at `cap`; stored on each enemy at spawn as `speedMult` (and `firerateMult`/`bulletMult` for boss). `setfloor` console command patches live enemies and reports speed + damage multipliers.
- **Incoming damage scaling** — `player.takeDamage()` multiplies all damage by `1 + (floor-1) × FLOOR_DAMAGE_BONUS` (10%/floor, no cap).
- **Drop rate scaling** — enemy heal-drop probability (`DROP_CHANCE`, base 20%) scales inversely with the dungeon's actual average enemies per combat room (`G.dungeon.avgEnemiesPerRoom`, computed after generation), keeping expected drops per room constant across floors. Drop amount per pickup is fixed at `DROP_HEAL_AMOUNT`.
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
- **Powerup inventory** — player has 3 inventory slots (`player.powerups[3]`). Big room pickups (heal +40HP, power shots, speed, invuln) go to inventory via `addPowerup(type)` instead of triggering immediately. Space activates the selected slot; Q cycles (`cyclePowerup()`). HUD shows all 3 boxes right of the HP bar; active timer (seconds) shown below for speed/invuln. Max-HP powerup is instant (walk-over): +20% maxHp + heals 20% of new maxHp; never goes to inventory. Powerups (including active timers) preserved across floors via `nextFloor()`.
- **Speed powerup** — `'speed'` type: 1.8× movement speed for 8 s (480f). Cyan chevron sprite. Active timer displayed in HUD. Speed afterimage trail on player.
- **Invuln powerup** — `'invuln'` type: full invincibility for 5 s (300f); checked in `player.takeDamage()` alongside `invincibleFrames`. Silver hexagon sprite. Rotating hexagonal shield ring rendered around player while active.
- **Master damage multiplier** — `MASTER_DAMAGE_MULT: 1.2` applied in `player.takeDamage()` before floor scaling; provides the single constant to globally tune all incoming player damage.
- **Mummy enemy** — `room.hasMummy` flag set in DungeonGraph; spawned by `spawnEnemies()` in addition to the room's normal enemies. Rises over `MUMMY_RISE_FRAMES` (180f) — invulnerable, drawing shifts down and fades in; ground cracks shown. After rising, pursues slowly and periodically releases fly swarms (`_releaseFlies()`). Floor 2+ only. Placement: floor 2–3 has `10%+(floor-2)×15%` chance of 1; floor 4+ is guaranteed 1; floor 7+ has 60% chance of a second one.
- **MummyFly** — lives in `G.flies[]` (separate from `G.enemies[]`) so flies don't block room-cleared detection. Per-fly `droneFreq` (90–170Hz); calls `AudioEngine.playFlyBuzz(freq)` every 80–160f. 420f (7s) lifetime, then disappears. Can be shot but very small (score 3 each).
- **LongGhoul** — `_longGhoulChance()` = `min(80%, max(5%, (floor-1)×20%))`; substituted for regular Ghoul spawns. 5 legs (index 4 always 22–29px), scrunched body, grey-white color, 2× HP (100), leap cooldown 20–55f (vs 60–140f), plays `long_ghoul_leap` SFX.
- **WhiteSkull** — `_whiteSkullChance()` = 0 below floor 3, then `min(60%, 20%+(floor-3)×20%)`; at most 1 per room. **Orbit/kite AI**: maintains ideal distance ~155px (`IDEAL` ± `MARGIN` 35px); strafes perpendicular when in range, closes in when too far, backs off when too close. `strafeDir` (±1) flips every 120–240f. Fires weaving bullets (`BulletPool.fireWeaving()`) with sinusoidal arc; also fires 8-bullet scatter burst (reuses boss_fire SFX). Scatter probability: 75% when player dist < `WHITE_SKULL_NEAR_RANGE` (100px), else 20%. Near-white/blue-tinted colour with glow ring.
- **Weaving bullets** — `Bullet.weave = { baseAngle, speed, freq, maxDev, age }`. Each frame in `BulletPool.update()`, if `b.weave` set: `dev = sin(age * freq) * maxDev`, velocity recomputed as `(cos(baseAngle+dev), sin(baseAngle+dev)) * speed`. Cleared on deactivate/refire.
- **Boss spiral attack** — phase 3 only; 35% chance to trigger instead of regular burst when `fireTimer` expires. Fires `BOSS_SPIRAL_BULLETS` (18) bullets one per `BOSS_SPIRAL_INTERVAL` (3) frames, rotating angle by `BOSS_SPIRAL_ROT` (0.75 rad) each bullet (~2.1 full rotations). `spiralActive` flag prevents overlapping spirals. Visual: 3 rotating arm lines at `e.spiralAngle`. Per-arm angle jitter `±0.38 rad`, per-bullet speed variation `0.82–1.20×`, per-step rotation variation `0.65–1.40×` give organic jagged arms.
- **Boss minion cleanup** — `_clearBossMinions()` called on boss death: sets `alive = false` on every enemy with `bossMinion = true` (tagged at spawn), clears `G.flies`, and (for Ashtaroth) also clears `G.meatLumps`. Applies to all boss types. **Regular mummy death** also clears `G.flies` (since only one mummy per floor).
- **Boss minion spawn position** — `_bossMinionPos()` picks a random angle, distance 50–110px from boss, with minimum 110px from player. Up to 60 attempts; falls back to closest valid position.
- **Symbol pickup feedback** — `checkRagSymbols()` fires `'symbol_pickup'` SFX (discordant tritone+minor-second jangle) or `'final_symbol'` if this was the last symbol on the floor (longer, louder: octave-doubled tritone stabs + ascending sawtooth shriek 220→1760→880 Hz + sub-bass thud, ~1.3s total). Sets `G.symbolFlicker { timer, col }`; renderer overlays a pulsing tinted flash for `SYMBOL_FLICKER_DURATION` (40) frames.
- **Fly death pop** — `MummyFly.takeDamage()` spawns 5 `COL_FLY` scatter particles (`isFlyPop: true`) that move outward, decelerate, and fade. Ticked and moved in `tickParticles()`; rendered as filled dots in `drawDeathParticles()`.
- **Ghoul Boss** — `GhoulBossEnemy` class; floor cycle via `spawnBoss()`: `floor%4===1` → skull, `floor%4===2` → ghoul boss, `floor%4===3` → mummy boss, `floor%4===0` → Ashtaroth. No bullets; pure contact/leap combat. **Arrival animation**: Philip falls from above the screen (`pos.y` starts off-screen), accelerates quadratically, impacts at frame 150 of 180 triggering `G.screenShake = 22` and `ghoul_boss_land` SFX, then settles with a damped bounce. Phase transition: 2s invuln + yellow glow ring (same as other bosses, handled in bullet.js `shieldR` check and `checkInvulnerableRepulsion()`). Uses skull-boss music mode. `spawn_ghoul_boss` dev command.
- **Nuckelavee** — `_nuckelaveeChance()` = 25% from floor 2; one per skull/mixed room. Emits a toxic breath cloud: per-instance `breathParticles[]` (max ~20 live), each spawned every 2 frames within the 65px aura radius, drifting with slow random walk, rendered as `COL_FLY` (#44ff66) circles with fade-in/out alpha. Aura also deals 1 HP per 6-frame tick (gated by player invincibility frames). **Poison trail**: `trailParticles[]` spawned every 6 frames at current position, live for 200f (~3.3s), drift slowly upward; contact with a trail wisp deals 1 HP per 8-frame tick. Trail rendered behind enemies (before `drawEnemies` in draw order).
- **Max-HP fanfare** — `_sfxMaxhpFanfare()`: 5-note triangle-wave ascending run (C major pentatonic, 90ms spacing) → sustained C major chord bloom (sine, reverb tail) → high sine sparkle sweep 2093→3136 Hz. Replaces generic `pickup` SFX on max-HP collection.
- **Ghoul boss leap SFX** — `ghoul_boss_leap`: deep bass version of `long_ghoul_leap` (frequencies ~¼); sawtooth 150→440→210 Hz + slow tremolo square 275→525 Hz (14 Hz LFO) + sine sub-bass thud 88→28 Hz. Played at end of `windupTimer` in `GhoulBossEnemy`.
- **Player death SFX** — `game_over` replaced with 5-layer horror sound: sawtooth vocal 155→235→42 Hz with choking tremor LFO (9→16 Hz); 6 staggered blood-gargle noise bursts through bandpass filters; 3 detuned bee-swarm square oscillators (204/217/231 Hz) with fast AM (183/197/211 Hz); final pitch-spike choke (195→440 Hz cut-off); sub-bass thud (88→28 Hz). Layers 1–4 pass through megaphone chain (bandpass 1800 Hz + hard waveshaper clipper).
- **Boss arrival animations** — Skull boss (`arriving` flag + `arriveTimer` 180f): spins with decelerating rotation while scaling from 0 to full size; plays `skull_boss_arrive` SFX (3s ominous coalescing: sub-bass sawtooth 38→72 Hz + eerie square tremolo 220→440 Hz slowing from 9→2 Hz + crash thud at 2.85s). Ghoul boss: drops from above screen with quadratic acceleration, screen shake on impact + `ghoul_boss_land` SFX (fast-attack sine 65→18 Hz + sawtooth crunch + lowpass noise rumble). Ashtaroth: same spin/grow pattern as skull boss. All bosses invulnerable during arrival.
- **Ashtaroth boss** — `AshtarothBossEnemy` class; `COL_ASHTAROTH` (#ff4400) deep orange-red. Renderer: bat wings (curved splines, flap animation), horns, glowing eye sockets (colour shifts phase 1→2→3), jagged maw. Phase 1/2: pursues player; phase 3: erratic random-direction movement (new direction every 15–35f). Fires big meat lumps each `_lumpRate` (85/65/50f per phase), 1/2/3 lumps spread ±0.28 rad. Phase 2+ fires circular barrage of `_barrageCount` (8/12) small lumps every 290f. Long gas trail (`ASHTAROTH_TRAIL_LIFETIME` 700f) that deals 10 HP per 8f tick. `G.meatLumps[]` array in state (cleared on `enterRoom()` and boss death).
- **MeatLump** — `G.meatLumps[]` (separate from `G.enemies[]`). Big (`big=true`): `r=10`, speed 2.2px/f, slow homing (0.014 accel/f, capped at 1.5× base), ~6s lifetime, leaves gas trail (`ASHTAROTH_BIG_LUMP_TRAIL_LIFE` 500f), 30 HP damage on contact, invulnerable to player bullets. Small (`big=false`): `r=6`, speed 4.5px/f, 1 HP, destroyed by player bullet with `hit` SFX, 18 HP damage.
- **Screen shake** — `G.screenShake` (pixels): renderer applies random `±screenShake/2` translate offset each frame then decays by 0.5px/f. Currently set to 22 on Rotten Philip's landing impact.
- **Boss HP bar names** — `_drawBossHP()` now renders the boss name above the HP bar in Creepster font (16px, boss accent colour): "KILLER SKULL", "ROTTEN PHILIP", "THE DRY MOTHER", "ASHTAROTH".
- **Cycle completion trigger** — `checkRoomExit()` calls `cycleComplete()` when `G.floor % 4 === 0` (post-Ashtaroth floors: 4, 8, 12…) instead of the old `% 3 === 0`.
