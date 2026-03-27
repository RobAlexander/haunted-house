# Haunted House

Top-down wireframe roguelike shooter built with p5.js (no build tools).
Open `index.html` directly in any modern browser to play.

## Controls

| Input | Action |
|---|---|
| WASD / Arrow keys | Move |
| Mouse | Aim |
| Left click (hold) | Shoot |
| M | Toggle map (pauses game; visited rooms shown; fullmap mode shows all) |
| N | Next floor (from win screen) |
| Esc | Close map / Return to title screen |
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
| 6 | ✅ Done | Ghoul enemy, lunge ghosts, skull skeletons, wide-bullet powerup, boss skull |
| 7 | ✅ Done | Dev console, fullmap, dynamic resolution scaling, floor difficulty scaling |
| 8 | ✅ Done | High score table (localStorage), name entry on death |

## File Map

```
p5.min.js         — p5.js 1.9.4 vendored locally (no CDN dependency)
creepster.ttf     — Creepster horror font (Google Fonts, vendored locally)
js/constants.js   — all magic numbers, colour palette, difficulty tuning constants
js/utils.js       — collision math, vector helpers, getWallRects()
js/state.js       — global G object, state machine, enterRoom(), transitions
js/bullet.js      — 128-bullet object pool
js/door.js        — getDoorCenter(), OPP_DIR
js/rooms.js       — Room class + DungeonGraph procedural generation
js/enemy.js       — GhostEnemy, SkeletonEnemy, GhoulEnemy, BossEnemy, spawnEnemies()
js/player.js      — WASD movement, axis-separated collision, shooting
js/audio.js       — AudioEngine: Web Audio API synth music + SFX, no audio files
js/scores.js      — HighScores: localStorage top-5 table with name entry
js/renderer.js    — ALL p5.js draw calls live here
js/main.js        — p5 setup()/draw() + input handlers + dev console
css/style.css     — page/canvas styling
```

## Game Loop

```
MENU → (Enter / click) → PLAYING → ROOM_TRANSITION → PLAYING
                                  ↓
                            GAME_OVER → NAME_ENTRY (if high score) → MENU
                            WIN → MENU  (or N for next floor)
```

## Room Types

| Type | Enemies | Notes |
|---|---|---|
| start | none | Pre-cleared; player spawns here |
| ghost | Ghosts (depth-scaled) | Depth 1–2 |
| skeleton | Skeletons + Ghouls | Depth 3–4 |
| mixed | Ghosts + Skeletons + Ghouls | Depth 5+ |
| boss | Boss (1) | Deepest room; door locked until boss dies |
| treasure | none | Dead-end at depth ≥2; +40 HP pickup |

## Enemy Types

| Type | HP | AI | Damage | Score |
|---|---|---|---|---|
| Ghost | 30 | Always chases; contact damage | 15 | 10 |
| Lunge ghost | 30 | As ghost; brief 2.4× speed bursts every 80–160f | 15 | 10 |
| Skeleton | 50 | Patrols; fires toward player every 60f | 10/bullet | 25 |
| Ghoul | 50 | Slow crawl; leaps at 5.5× speed when in range | 40/contact | 35 |
| Boss | 300 | 3-phase radial burst (4/8/12 bullets); speeds up each phase | 20/bullet | 200 |

All enemy movement speeds and boss fire rate / bullet count scale with floor number (see `FLOOR_*` constants).
Incoming player damage scales up 10% per floor with no cap (`FLOOR_DAMAGE_BONUS`).

## Developer Console

Open with `` ` ``. Tab-completes commands.

| Command | Effect |
|---|---|
| `boss` | Teleport to boss room (spawns player in a covered corner) |
| `wide` | Grant wide-bullet shots |
| `fullmap` | Toggle full map view (shows unvisited rooms in dim outline) |
| `setfloor <n>` | Set floor number and re-apply difficulty scaling to live enemies |
| `spawn_ghost` | Spawn a normal ghost near player |
| `spawn_red_ghost` | Spawn a lunge ghost near player |
| `spawn_skeleton` | Spawn a skeleton near player |
| `spawn_ghoul` | Spawn a ghoul near player |
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
- Boss room = deepest room; `bossDoorsLocked` cleared when boss HP reaches 0.
- Treasure room pickup activated on `enterRoom()`, consumed in `checkPickup()` each frame.
- Lunge ghost: 30% of ghost spawns; timers controlled by `GHOST_LUNGE_COOLDOWN_MIN/MAX`.
- Wide-bullet powerup: 8 shots at 3× bullet radius; spawns in a second dead-end room (65% chance).
- GhoulEnemy: crawls slowly then leaps at `GHOUL_LEAP_SPEED` when within `GHOUL_LEAP_RANGE`; appears in skeleton and mixed rooms.
- **Floor difficulty scaling** — `_floorMult(bonus, cap)` in enemy.js computes a linear ramp capped at `cap`; stored on each enemy at spawn as `speedMult` (and `firerateMult`/`bulletMult` for boss). `setfloor` console command patches live enemies and reports speed + damage multipliers.
- **Incoming damage scaling** — `player.takeDamage()` multiplies all damage by `1 + (floor-1) × FLOOR_DAMAGE_BONUS` (10%/floor, no cap).
- **Drop rate scaling** — enemy heal-drop probability (`DROP_CHANCE`, base 40%) scales inversely with the dungeon's actual average enemies per combat room (`G.dungeon.avgEnemiesPerRoom`, computed after generation), keeping expected drops per room constant across floors. Drop amount per pickup is fixed at `DROP_HEAL_AMOUNT`.
- **Per-instance deformation** — Ghosts use `deform[6]` for organic silhouette variation; Skeletons `deform[5]` for skull shape; Ghouls `deform[6]` for body/limb variation; Boss `deform[8]` for skull vertex offsets.
- **High scores** — `HighScores` (scores.js) persists top-5 `{score, floor, name}` entries in localStorage. On death, `_beginEndSequence()` checks `qualifies()` and routes through `STATES.NAME_ENTRY` if so.
- All SFX volumes exposed as `SFX_VOL_*` constants for easy tuning.
