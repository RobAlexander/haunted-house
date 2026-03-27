const C = {
  WIDTH:  800,
  HEIGHT: 600,
  FPS:    60,

  // Room layout
  ROOM_PADDING:   60,   // wall thickness from canvas edge
  FLOOR_GRID_SIZE: 40,

  // Player
  PLAYER_SPEED:            4,
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

  // Boss enemy
  BOSS_RADIUS:            28,
  BOSS_HP:                300,
  BOSS_SPEED_1:           0.85,
  BOSS_SPEED_2:           1.3,
  BOSS_SPEED_3:           1.8,
  BOSS_BULLET_SPEED:      4,
  BOSS_BULLET_DAMAGE:     20,
  BOSS_PHASE_TRANSITION_FRAMES: 120,  // 2s invulnerability + yellow glow on phase change

  // Score
  SCORE_GHOST:    10,
  SCORE_SKULL: 25,
  SCORE_BOSS:     200,

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

  // Wide bullet powerup
  WIDE_BULLET_SHOTS:    8,

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
  DROP_CHANCE:                 0.4,  // base drop probability per enemy death (floor 1, baseline avg)
  DROP_HEAL_BASELINE_ENEMIES:  2.5,  // expected avg enemies/room on floor 1 (anchor for drop-rate scaling)

  // SFX volumes (0–1)
  SFX_VOL_SHOOT:       0.05,
  SFX_VOL_HIT:         0.52,
  SFX_VOL_DEATH:       0.2,
  SFX_VOL_GHOST_LUNGE: 3.0,   // scale factor for red ghost lunge "hoooo" (1.0 = as designed)

  // New colors
  COL_LUNGE_GHOST: '#ff4455',
  COL_GHOUL:       '#7b3f1e',
  COL_WIDE_PICKUP: '#44aaff',

  COL_RAG_SYMBOL:      '#cc44ff',  // colour for R/A/G rune symbols
  RAG_SYMBOL_COLLECT_R: 20,        // collection radius in px
};
