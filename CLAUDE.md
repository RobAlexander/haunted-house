# Haunted House

Top-down wireframe roguelike shooter built with p5.js (no build tools).
Open `index.html` directly in any modern browser to play.

## Controls

| Input | Action |
|---|---|
| WASD / Arrow keys | Move |
| Mouse | Aim |
| Left click (hold) | Shoot |
| M | Toggle map (pauses game; only visited rooms shown) |
| N | Next floor (from win screen) |
| Esc | Close map / Return to title screen |
| Enter | Start game from menu |

## Stages

| Stage | Status | Description |
|---|---|---|
| 1 | ✅ Done | Single room, Ghost enemies, shoot/move/HP |
| 2 | ✅ Done | Multi-room dungeon (7–14 rooms), door slide transitions |
| 3 | ✅ Done | Skeleton + Boss enemies, locked boss room, win screen, score |
| 4 | ✅ Done | Synth music + SFX (Web Audio API, no files) |
| 5 | ✅ Done | Polish: death animations, HP vignette, enemy drops, floor progression |

## File Map

```
p5.min.js         — p5.js 1.9.4 vendored locally (no CDN dependency)
js/constants.js   — all magic numbers and colour palette
js/utils.js       — collision math, vector helpers, getWallRects()
js/state.js       — global G object, state machine, enterRoom(), transitions
js/bullet.js      — 128-bullet object pool
js/door.js        — getDoorCenter(), OPP_DIR
js/rooms.js       — Room class + DungeonGraph procedural generation
js/enemy.js       — GhostEnemy, SkeletonEnemy, BossEnemy, spawnEnemies()
js/player.js      — WASD movement, axis-separated collision, shooting
js/audio.js       — AudioEngine: Web Audio API synth music + SFX, no audio files
js/renderer.js    — ALL p5.js draw calls live here
js/main.js        — p5 setup()/draw() + input handlers
css/style.css     — page/canvas styling
```

## Game Loop

```
MENU → (Enter / click) → PLAYING → ROOM_TRANSITION → PLAYING
                                  ↓
                            GAME_OVER or WIN → (R) → MENU
```

## Room Types

| Type | Enemies | Notes |
|---|---|---|
| start | none | Pre-cleared; player spawns here |
| ghost | Ghosts (depth-scaled) | Depth 1–2 |
| skeleton | Skeletons | Depth 3–4 |
| mixed | Ghosts + Skeletons | Depth 5+ |
| boss | Boss (1) | Deepest room; door locked until boss dies |
| treasure | none | Dead-end at depth ≥2; +40 HP pickup |

## Enemy Types

| Type | HP | AI | Damage | Score |
|---|---|---|---|---|
| Ghost | 30 | Wander/chase; contact damage | 15 | 10 |
| Skeleton | 50 | Patrol line; fires toward player every 90f | 10/bullet | 25 |
| Ghoul | 50 | Slow crawl; leaps at 5.5× speed when in range | 20/contact | 35 |
| Boss | 300 | 3-phase radial burst (4/8/12 bullets) | 20/bullet | 200 |

## Architecture Notes

- **Global mode p5.js** — `setup()`, `draw()`, `keyPressed()` etc. are top-level functions.
- `renderer.js` is the only file that calls p5 drawing functions.
- All game state lives in the single `G` object (`state.js`).
- `getWallRects()` (utils.js) reads `G.currentRoom` and returns wall segments with door gaps when the room is cleared — used by player, enemy, and bullet collision.
- Bullet object pool (128 pre-allocated) avoids GC pressure; owner tag `'player'`/`'enemy'` controls which entities it damages.
- Player movement is axis-separated (move X → resolve, then move Y → resolve) for smooth wall sliding.
- Dungeon uses constrained random-walk on an abstract `Map<"x,y", Room>` grid.
- Boss room = deepest room; its `bossDoorsLocked` flag is cleared when the boss `takeDamage()` reaches 0 HP.
- Treasure room pickup is activated on `enterRoom()` and consumed in `checkPickup()` each frame.
- Lunge ghost: 30% of ghost spawns; brief 2.4× speed bursts toward player when in chase range.
- Wide-bullet powerup: 8 shots at 3× bullet radius; spawns in a second dead-end room (65% chance); collected via `checkWidePowerup()` each frame.
- GhoulEnemy: new class in enemy.js; crawls slowly then leaps at 5.5× speed when close; appears in skeleton and mixed rooms.
