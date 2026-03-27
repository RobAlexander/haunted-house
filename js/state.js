const STATES = {
  MENU:            'menu',
  PLAYING:         'playing',
  PAUSED:          'paused',
  ROOM_TRANSITION: 'room_transition',
  NAME_ENTRY:      'name_entry',
  GAME_OVER:       'game_over',
  WIN:             'win',
};

const G = {
  state:          STATES.MENU,
  player:         null,
  enemies:        [],
  bullets:        null,
  currentRoom:    null,
  dungeon:        null,
  transition:     null,
  frame:          0,
  score:          0,
  clearedFlash:   0,
  floor:          1,
  deathParticles: [],
  drops:          [],
  mapOpen:        false,
  newHighScore:    null,   // 1-based rank of last score, or null
  nameInput:       '',     // player name being typed on NAME_ENTRY screen
  pendingEndState: null,   // WIN or GAME_OVER waiting after name entry
  devConsole:      { open: false, input: '', output: '' },
  devFullMap:     false,
};

// ── Game lifecycle ────────────────────────────────────────────────────────

function startGame() {
  G.state          = STATES.PLAYING;
  G.frame          = 0;
  G.score          = 0;
  G.transition     = null;
  G.clearedFlash   = 0;
  G.deathParticles = [];
  G.drops          = [];
  G.mapOpen         = false;
  G.newHighScore     = null;
  G.nameInput        = '';
  G.pendingEndState  = null;
  G.dungeon        = new DungeonGraph();
  G.bullets        = new BulletPool();
  G.player         = new Player(C.WIDTH / 2, C.HEIGHT / 2);
  AudioEngine.stopMusic();
  AudioEngine.startMusic();
  enterRoom(G.dungeon.startRoom, null);
}

function nextFloor() {
  const savedHp    = G.player ? G.player.hp    : null;
  const savedMaxHp = G.player ? G.player.maxHp : null;
  const savedScore = G.score;
  G.floor++;
  startGame();
  if (savedHp !== null) { G.player.hp = savedHp; G.player.maxHp = savedMaxHp; }
  G.score = savedScore;
}

function enterRoom(room, fromDir) {
  const firstVisit = !room.visited;
  G.currentRoom    = room;
  room.visited     = true;
  G.bullets        = new BulletPool();
  G.drops          = [];

  if (!room.cleared) {
    G.enemies = spawnEnemies(room);
  } else {
    G.enemies = [];
  }

  // Reposition player at the entry door
  if (fromDir !== null) {
    const P = C.ROOM_PADDING + C.PLAYER_RADIUS + 8;
    const positions = {
      north: { x: C.WIDTH / 2, y: C.HEIGHT - P },
      south: { x: C.WIDTH / 2, y: P            },
      east:  { x: P,           y: C.HEIGHT / 2 },
      west:  { x: C.WIDTH - P, y: C.HEIGHT / 2 },
    };
    const pos       = positions[fromDir];
    G.player.pos.x  = pos.x;
    G.player.pos.y  = pos.y;
  }

  // Treasure room: grant pickup immediately on first visit
  if (room.type === 'treasure' && room.pickup && !room.pickupTaken) {
    room.pickupActive = true;
  }

  // Wide-bullet powerup room
  if (room.widePowerup && !room.widePowerupTaken) {
    room.widePowerupActive = true;
  }

  // Audio: boss mode toggle + room enter SFX
  if (fromDir !== null) AudioEngine.playSFX('room_enter');
  AudioEngine.setBossMode(room.type === 'boss');
  if (room.type === 'boss' && firstVisit) AudioEngine.playSFX('boss_enter');
}

// ── Transitions ───────────────────────────────────────────────────────────

function startRoomTransition(dir) {
  const nextRoom = G.currentRoom.connections[dir];
  if (!nextRoom) return;

  G.state      = STATES.ROOM_TRANSITION;
  G.transition = { dir, fromRoom: G.currentRoom, toRoom: nextRoom, progress: 0 };
}

function tickTransition() {
  if (!G.transition) return;
  G.transition.progress += 1 / C.TRANSITION_FRAMES;
  if (G.transition.progress >= 1) {
    const { dir, toRoom } = G.transition;
    G.transition = null;
    enterRoom(toRoom, dir);
    G.state = STATES.PLAYING;
  }
}

// ── End-of-game sequence ─────────────────────────────────────────────────
// Routes through NAME_ENTRY if the score qualifies, otherwise goes straight
// to the result screen.

function _beginEndSequence(endState) {
  if (HighScores.qualifies(G.score)) {
    G.pendingEndState = endState;
    G.nameInput       = '';
    G.state           = STATES.NAME_ENTRY;
  } else {
    G.newHighScore = null;
    G.state        = endState;
  }
}

// Called by main.js and renderer (name-entry confirm / skip).
function submitNameAndEnd(name) {
  G.newHighScore = HighScores.submit(G.score, G.floor, name);
  G.state        = G.pendingEndState;
}

// ── Per-frame checks ──────────────────────────────────────────────────────

function checkRoomCleared() {
  const room = G.currentRoom;
  if (!room || room.cleared) return;
  if (G.enemies.every(e => !e.alive)) {
    room.cleared   = true;
    G.clearedFlash = 150;

    // Boss room cleared → open stairwell to next floor
    if (room.type === 'boss') {
      AudioEngine.playSFX('win');
      const dirs = ['north', 'south', 'east', 'west'];
      const opp  = { north: 'south', south: 'north', east: 'west', west: 'east' };
      const entryDir = dirs.find(d => room.connections[d]);
      const free     = dirs.filter(d => !room.connections[d]);
      room.stairwell = free.includes(opp[entryDir]) ? opp[entryDir] : free[0];
    }
  }
}

function checkRoomExit() {
  if (G.state !== STATES.PLAYING) return;
  const pl = G.player, rm = G.currentRoom;
  if (!pl || !pl.alive || !rm || !rm.cleared) return;

  const P = C.ROOM_PADDING;
  if (pl.pos.y < P            && rm.connections.north) { startRoomTransition('north'); return; }
  if (pl.pos.y > C.HEIGHT - P && rm.connections.south) { startRoomTransition('south'); return; }
  if (pl.pos.x > C.WIDTH  - P && rm.connections.east)  { startRoomTransition('east');  return; }
  if (pl.pos.x < P            && rm.connections.west)  { startRoomTransition('west');  return; }

  // Stairwell: walk into it to advance to next floor
  if (rm.stairwell) {
    const sw = rm.stairwell;
    if (sw === 'north' && pl.pos.y < P)            { nextFloor(); return; }
    if (sw === 'south' && pl.pos.y > C.HEIGHT - P) { nextFloor(); return; }
    if (sw === 'east'  && pl.pos.x > C.WIDTH  - P) { nextFloor(); return; }
    if (sw === 'west'  && pl.pos.x < P)            { nextFloor(); return; }
  }
}

function checkPickup() {
  const room = G.currentRoom;
  if (!room || !room.pickupActive || room.pickupTaken) return;
  const pick = room.pickup;
  if (!pick) return;
  if (circleCollide(G.player.pos.x, G.player.pos.y, G.player.radius, pick.x, pick.y, 14)) {
    G.player.hp = Math.min(G.player.hp + pick.amount, G.player.maxHp);
    room.pickupTaken  = true;
    room.pickupActive = false;
    AudioEngine.playSFX('pickup');
  }
}

function checkWidePowerup() {
  const room = G.currentRoom;
  if (!room || !room.widePowerupActive || room.widePowerupTaken) return;
  const p = room.widePowerup;
  if (circleCollide(G.player.pos.x, G.player.pos.y, G.player.radius, p.x, p.y, 14)) {
    G.player.wideShots      = C.WIDE_BULLET_SHOTS;
    room.widePowerupTaken   = true;
    room.widePowerupActive  = false;
    AudioEngine.playSFX('pickup');
  }
}

function checkDropPickup() {
  if (!G.player || !G.player.alive) return;
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    if (circleCollide(G.player.pos.x, G.player.pos.y, G.player.radius, d.x, d.y, 12)) {
      G.player.hp = Math.min(G.player.hp + d.amount, G.player.maxHp);
      G.drops.splice(i, 1);
      AudioEngine.playSFX('pickup');
    }
  }
}

function tickParticles() {
  for (let i = G.deathParticles.length - 1; i >= 0; i--) {
    const p = G.deathParticles[i];
    if (p.delay > 0) { p.delay--; continue; }
    p.life--;
    if (p.life <= 0) G.deathParticles.splice(i, 1);
  }
  for (let i = G.drops.length - 1; i >= 0; i--) {
    G.drops[i].life--;
    if (G.drops[i].life <= 0) G.drops.splice(i, 1);
  }
}
