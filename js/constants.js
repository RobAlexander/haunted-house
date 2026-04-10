const C = {
  WIDTH:  800,
  HEIGHT: 600,
  FPS:    60,

  // Room layout
  ROOM_PADDING:   60,   // wall thickness from canvas edge
  FLOOR_GRID_SIZE: 40,

  // Player
  PLAYER_SPEED:            4,
  PLAYER_ACCEL_MS:         100,  // ms to reach full speed from rest (and stop from full speed)
  PLAYER_RADIUS:           12,
  PLAYER_MAX_HP:           100,
  PLAYER_FIRE_RATE:        10,   // frames between shots
  PLAYER_INVINCIBLE_FRAMES: 45,

  // Bullets
  BULLET_SPEED:  12,
  BULLET_RADIUS: 4,
  BULLET_TTL:    90,
  BULLET_DAMAGE: 20,
  POOL_SIZE:     128,

  // Ghost enemy
  GHOST_SPEED:            1.5,
  GHOST_RADIUS:           14,
  GHOST_HP:               30,
  GHOST_CONTACT_DAMAGE:   15,
  GHOST_CONTACT_COOLDOWN: 60,
  GHOST_COUNT:            5,   // fallback; rooms use depth-scaled counts
 
  // Lunge ghost cooldown between lunges (frames). Lower = more frequent.
  GHOST_LUNGE_COOLDOWN_MIN: 60,
  GHOST_LUNGE_COOLDOWN_MAX: 140,

  // Skull enemy
  SKULL_SPEED:         2,
  SKULL_RADIUS:        13,
  SKULL_HP:            50,
  SKULL_BULLET_SPEED:  3.5,
  SKULL_BULLET_DAMAGE: 10,
  SKULL_FIRE_RATE:     60,   // frames between shots
  SKULL_PATROL_RANGE:  110,  // px either side of spawn

  // White Skull enemy (floor 3+) — weaving shots + scatter burst
  WHITE_SKULL_HP:            80,
  WHITE_SKULL_RADIUS:        14,
  WHITE_SKULL_SPEED:         2.2,
  WHITE_SKULL_BULLET_SPEED:  3.5,
  WHITE_SKULL_BULLET_DAMAGE: 12,
  WHITE_SKULL_FIRE_RATE:     70,    // frames between shots
  WHITE_SKULL_SCATTER_COUNT: 8,     // bullets in scatter burst
  WHITE_SKULL_NEAR_RANGE:    100,   // player distance below which scatter is preferred
  WHITE_SKULL_WEAVE_FREQ:    0.10,  // radians/frame oscillation
  WHITE_SKULL_WEAVE_MAX_DEV: 0.65,  // max angular deviation from straight (radians)

  // Boss enemy
  BOSS_RADIUS:            28,
  BOSS_HP:                375,
  BOSS_SPEED_1:           0.85,
  BOSS_SPEED_2:           1.3,
  BOSS_SPEED_3:           1.8,
  BOSS_BULLET_SPEED:      4,
  BOSS_BULLET_DAMAGE:     20,
  BOSS_PHASE_TRANSITION_FRAMES: 120,  // 2s invulnerability + yellow glow on phase change
  BOSS_SPIRAL_BULLETS:    18,         // steps per spiral attack (phase 3 only)
  BOSS_SPIRAL_INTERVAL:   3,          // frames between each spiral step
  BOSS_SPIRAL_ROT:        0.75,       // radians added to angle per step (~2.1 rotations total)
  BOSS_SPIRAL_ARMS:       3,          // simultaneous bullet arms per step

  // Score
  SCORE_GHOST:       10,
  SCORE_SKULL:       25,
  SCORE_WHITE_SKULL: 50,
  SCORE_BOSS:        200,

  // Spawn safety
  ENEMY_SPAWN_PLAYER_SAFE_R: 150,  // min px between any enemy spawn and the player's entry point

  // Dungeon
  MIN_ROOMS:         7,
  MAX_ROOMS:         14,
  DOOR_WIDTH:        44,   // px gap in wall for a doorway
  TRANSITION_FRAMES: 22,   // frames for room-slide animation

  // Colors
  COL_BG:          '#0a0a0f',
  COL_WALL:        '#3a3a5c',
  COL_WALL_CORNER: '#5a5a8c',
  COL_FLOOR_GRID:  '#141420',
  COL_OBSTACLE:    '#2e2e50',
  COL_OBSTACLE_X:  '#222240',

  COL_PLAYER:      '#00ff88',
  COL_AIM_LINE:    '#00aa55',
  COL_BULLET_P:    '#ffffaa',
  COL_CROSSHAIR:   '#44cc88',

  COL_GHOST:       '#cc88ff',
  COL_SKULL:       '#ff6644',
  COL_WHITE_SKULL: '#d8e0ff',
  COL_BOSS:        '#ff2222',
  COL_BOSS_BULLET: '#ff8844',
  COL_PICKUP:      '#ffcc00',
  COL_WIN:         '#00ffcc',
  COL_BOSS_ROOM:   '#1a0808',  // tinted floor for boss room

  COL_HUD_TEXT:    '#aaaacc',
  COL_HUD_HP:      '#00ff88',
  COL_HUD_HP_LOW:  '#ff4444',
  COL_HUD_HP_BG:   '#111122',
  COL_HUD_TITLE:   '#8866aa',

  COL_DOOR_OPEN:   '#7777aa',
  COL_DOOR_CLOSED: '#993333',

  COL_CLEARED:     '#ffee88',
  COL_GAMEOVER:    '#ff4444',

  // Ghoul enemy
  GHOUL_HP:             50,
  GHOUL_RADIUS:         14,
  GHOUL_SPEED:          1.2,
  GHOUL_LEAP_SPEED:     5.5,
  GHOUL_LEAP_RANGE:     180,
  GHOUL_CONTACT_DAMAGE: 40,
  SCORE_GHOUL:          35,
  // Ghoul leap cooldown between leaps (frames). Lower = more frequent.
  GHOUL_LEAP_COOLDOWN_MIN: 60,
  GHOUL_LEAP_COOLDOWN_MAX: 140,

  // Long Ghoul — scrunched body, 5 legs (one always longer), leaps far more often
  LONG_GHOUL_HP:                100,
  LONG_GHOUL_RADIUS:            14,
  LONG_GHOUL_SPEED:             1.2,
  LONG_GHOUL_LEAP_SPEED:        6.5,
  LONG_GHOUL_LEAP_RANGE:        200,
  LONG_GHOUL_CONTACT_DAMAGE:    40,
  SCORE_LONG_GHOUL:             70,
  LONG_GHOUL_LEAP_COOLDOWN_MIN: 20,
  LONG_GHOUL_LEAP_COOLDOWN_MAX: 55,

  // Mummy enemy — rises from tomb, releases flies
  MUMMY_HP:             225,
  MUMMY_RADIUS:         16,
  MUMMY_SPEED:          0.85,
  MUMMY_RISE_FRAMES:    180,    // 3 s to fully emerge; invulnerable during
  MUMMY_FLY_COOLDOWN:   240,    // frames between fly releases
  MUMMY_FLY_COUNT:      3,      // flies per release
  MUMMY_CONTACT_DAMAGE: 25,
  SCORE_MUMMY:          80,

  // Mummy Boss — even-floor boss; phases like skull boss
  MUMMY_BOSS_HP:        500,
  MUMMY_BOSS_RADIUS:    28,
  SCORE_MUMMY_BOSS:     200,

  // Mummy Fly — tiny, pursue player, time out
  FLY_HP:               5,
  FLY_RADIUS:           4,
  FLY_SPEED:            2.72,
  FLY_LIFETIME:         420,    // ~7 s
  FLY_CONTACT_DAMAGE:   8,
  SCORE_FLY:            3,

  // Power bullet powerup
  WIDE_BULLET_SHOTS:    15,
  POWER_HIT_FREEZE_MS:  20,   // ms game logic freezes when a power shot lands
  POWER_SHOT_RECOIL:     8,   // px the player is pushed back on firing a power shot
  PICKUP_HEAL_AMOUNT: 40,

  // Autofire powerup
  AUTOFIRE_SHOTS:          30,    // total shots granted
  AUTOFIRE_FIRE_RATE:       4,    // frames between shots (vs 10 normal)
  AUTOFIRE_MAX_SPREAD:      0.6, // max angular deviation (radians, ~20°)
  AUTOFIRE_SPREAD_PER_SHOT: 0.05,// spread added each fired shot (max reached ~16 shots in)
  COL_AUTOFIRE_PICKUP: '#ff8844', // orange

  // Floor difficulty scaling (floor 1 = baseline; scales linearly each floor above 1)
  FLOOR_SPEED_BONUS:         0.065,  // speed multiplier added per floor (floor 2 = 1.065×)
  FLOOR_SPEED_CAP:           1.3,    // max speed multiplier (reached ~floor 6)
  FLOOR_BOSS_FIRERATE_BONUS: 0.1,    // boss fire-rate divisor added per floor
  FLOOR_BOSS_FIRERATE_CAP:   2.0,    // max fire-rate multiplier — intervals halved (~floor 11)
  FLOOR_BOSS_BULLETS_BONUS:  0.065,  // boss bullet-count multiplier per floor
  FLOOR_BOSS_BULLETS_CAP:    1.5,    // max bullet-count multiplier (reached ~floor 8)
  FLOOR_DAMAGE_BONUS:        0.1,    // incoming player damage multiplier added per floor (no cap)

  // Enemy drops
  DROP_HEAL_AMOUNT:            20,   // HP restored by a drop
  DROP_CHANCE:                 0.2,  // base drop probability per enemy death (floor 1, baseline avg)
  DROP_HEAL_BASELINE_ENEMIES:  2.5,  // expected avg enemies/room on floor 1 (anchor for drop-rate scaling)

  // SFX volumes (0–1)
  SFX_VOL_SHOOT:       0.05,
  SFX_VOL_HIT:         0.52,
  SFX_VOL_DEATH:       0.2,
  SFX_VOL_GHOST_LUNGE: 3.0,   // scale factor for red ghost lunge "hoooo" (1.0 = as designed)

  // New colors
  COL_LUNGE_GHOST: '#ff4455',
  COL_GHOUL:       '#7b3f1e',
  COL_LONG_GHOUL:  '#c0c0d8',
  COL_MUMMY:       '#c8b060',   // sandy/yellowed cloth
  COL_MUMMY_BOSS:  '#e0a030',   // richer gold for the boss
  COL_FLY:         '#44ff66',   // bright green flies
  COL_WIDE_PICKUP: '#44aaff',
  COL_MAXHP_PICKUP: '#ffe066',
  COL_BOUNCE_PICKUP: '#88ccff',  // pale icy blue — bounce bullets powerup

  COL_RAG_SYMBOL:      '#cc44ff',  // colour for R/A/G rune symbols
  RAG_SYMBOL_COLLECT_R: 20,        // collection radius in px

  // Demon enemy — slow skinless horse-rider with proximity aura damage
  DEMON_HP:             180,
  DEMON_RADIUS:          22,
  DEMON_SPEED:            0.8,
  DEMON_CONTACT_DAMAGE:   30,
  DEMON_AURA_RADIUS:      65,   // px — distance at which aura damage ticks
  DEMON_AURA_DAMAGE:       1,   // HP per tick (invincibility frames gate frequency)
  DEMON_AURA_INTERVAL:     6,   // frames between aura damage attempts
  SCORE_DEMON:            90,
  COL_DEMON:        '#7a1818',  // dark blood-red for body outline
  COL_DEMON_VEIN:   '#cc6622',  // orange-yellow for exposed veins/eye

  // Demon poison trail (gas cloud left behind as it moves)
  DEMON_TRAIL_LIFETIME:       300,  // frames each trail wisp lives
  DEMON_TRAIL_INTERVAL:         6,  // spawn one wisp every N frames
  DEMON_TRAIL_DAMAGE:           10,
  DEMON_TRAIL_DAMAGE_INTERVAL:  8,  // frames between trail damage ticks

  // Ashtaroth Boss — fourth in boss cycle (floors 4, 8, 12…)
  ASHTAROTH_HP:                  500,
  ASHTAROTH_RADIUS:               26,
  ASHTAROTH_CONTACT_DAMAGE:       35,
  ASHTAROTH_SPEED_1:               0.85,
  ASHTAROTH_SPEED_2:               1.35,
  ASHTAROTH_SPEED_3:               1.9,
  ASHTAROTH_LUMP_RATE_1:          85,    // frames between lump volleys, phase 1
  ASHTAROTH_LUMP_RATE_2:          65,
  ASHTAROTH_LUMP_RATE_3:          50,
  ASHTAROTH_LUMP_COUNT_1:          1,    // big lumps per volley
  ASHTAROTH_LUMP_COUNT_2:          2,
  ASHTAROTH_LUMP_COUNT_3:          3,
  ASHTAROTH_BARRAGE_RATE:         290,   // frames between barrages (phase 2+)
  ASHTAROTH_BARRAGE_COUNT_2:        8,
  ASHTAROTH_BARRAGE_COUNT_3:       12,
  ASHTAROTH_TRAIL_LIFETIME:       360,   // boss's personal trail particle lifetime
  ASHTAROTH_TRAIL_INTERVAL:         3,   // frames between trail spawns
  ASHTAROTH_TRAIL_DAMAGE:          10,
  ASHTAROTH_TRAIL_DAMAGE_INTERVAL:  8,
  ASHTAROTH_BIG_LUMP_RADIUS:       10,
  ASHTAROTH_BIG_LUMP_SPEED:         2.2,
  ASHTAROTH_BIG_LUMP_DAMAGE:       30,
  ASHTAROTH_BIG_LUMP_TRAIL_LIFE:  500,   // gas trail behind each big lump
  ASHTAROTH_SMALL_LUMP_RADIUS:      6,
  ASHTAROTH_SMALL_LUMP_SPEED:       4.5,
  ASHTAROTH_SMALL_LUMP_DAMAGE:     18,
  SCORE_ASHTAROTH:                200,
  COL_ASHTAROTH:             '#ff4400',  // deep orange-red
  COL_ASHTAROTH_GAS:         '#77ff99',  // light green gas (lighter shade of demon trail)

  // Ghoul Boss — third in boss cycle (floors 2, 5, 8…)
  GHOUL_BOSS_HP:                438,
  GHOUL_BOSS_RADIUS:             22,
  GHOUL_BOSS_CONTACT_DAMAGE:     60,
  SCORE_GHOUL_BOSS:             200,
  COL_GHOUL_BOSS:          '#8a2050',  // dark crimson-magenta

  // Speed & invuln powerups
  SPEED_POWERUP_MULT:     1.6,    // movement speed multiplier while active
  SPEED_POWERUP_DURATION: 480,    // 8 s at 60fps
  INVULN_POWERUP_DURATION:300,    // 5 s at 60fps
  COL_SPEED_PICKUP:  '#00eeff',   // cyan
  COL_INVULN_PICKUP: '#eeeeff',   // near-white silver

  // Master incoming player damage multiplier (applied before floor scaling)
  MASTER_DAMAGE_MULT: 1.2,

  // Symbol pickup screen flicker duration
  SYMBOL_FLICKER_DURATION: 40,
};
