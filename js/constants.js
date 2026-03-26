const C = {
  WIDTH:  800,
  HEIGHT: 600,
  FPS:    60,

  // Room layout
  ROOM_PADDING:   60,   // wall thickness from canvas edge
  FLOOR_GRID_SIZE: 40,

  // Player
  PLAYER_SPEED:            3.5,
  PLAYER_RADIUS:           12,
  PLAYER_MAX_HP:           100,
  PLAYER_FIRE_RATE:        10,   // frames between shots
  PLAYER_INVINCIBLE_FRAMES: 45,

  // Bullets
  BULLET_SPEED:  8,
  BULLET_RADIUS: 4,
  BULLET_TTL:    90,
  BULLET_DAMAGE: 20,
  POOL_SIZE:     128,

  // Ghost enemy
  GHOST_SPEED:            1.2,
  GHOST_RADIUS:           14,
  GHOST_HP:               30,
  GHOST_CONTACT_DAMAGE:   15,
  GHOST_CONTACT_COOLDOWN: 60,
  GHOST_CHASE_DIST:       300,
  GHOST_WANDER_CHANGE:    90,   // max frames per wander direction
  GHOST_COUNT:            5,   // fallback; rooms use depth-scaled counts

  // Skeleton enemy
  SKELETON_SPEED:         1.6,
  SKELETON_RADIUS:        13,
  SKELETON_HP:            50,
  SKELETON_BULLET_SPEED:  3.5,
  SKELETON_BULLET_DAMAGE: 10,
  SKELETON_FIRE_RATE:     90,   // frames between shots
  SKELETON_PATROL_RANGE:  110,  // px either side of spawn

  // Boss enemy
  BOSS_RADIUS:            28,
  BOSS_HP:                300,
  BOSS_SPEED_1:           0.85,
  BOSS_SPEED_2:           1.3,
  BOSS_SPEED_3:           1.8,
  BOSS_BULLET_SPEED:      3,
  BOSS_BULLET_DAMAGE:     20,

  // Score
  SCORE_GHOST:    10,
  SCORE_SKELETON: 25,
  SCORE_BOSS:     200,

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
  COL_SKELETON:    '#ff6644',
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
  GHOUL_SPEED:          0.7,
  GHOUL_LEAP_SPEED:     5.5,
  GHOUL_LEAP_RANGE:     180,
  GHOUL_CONTACT_DAMAGE: 20,
  SCORE_GHOUL:          35,

  // Wide bullet powerup
  WIDE_BULLET_SHOTS:    8,

  // New colors
  COL_LUNGE_GHOST: '#ff4455',
  COL_GHOUL:       '#7b3f1e',
  COL_WIDE_PICKUP: '#44aaff',
};
