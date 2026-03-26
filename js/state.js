const STATES = {
  MENU:            'menu',
  PLAYING:         'playing',
  ROOM_TRANSITION: 'room_transition',
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
  escConfirm:     false,
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
  G.dungeon        = new DungeonGraph();
  G.bullets        = new BulletPool();
  G.player         = new Player(C.WIDTH / 2, C.HEIGHT / 2);
  AudioEngine.stopMusic();
  AudioEngine.startMusic();
  enterRoom(G.dungeon.startRoom, null);
}

function nextFloor() {
  G.floor++;
  startGame();
}

function enterRoom(room, fromDir) {
  const firstVisit = !room.visited;
  G.currentRoom    = room;
  room.visited     = true;
  G.bullets        = new BulletPool();

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

// ── Per-frame checks ──────────────────────────────────────────────────────

function checkRoomCleared() {
  const room = G.currentRoom;
  if (!room || room.cleared) return;
  if (G.enemies.every(e => !e.alive)) {
    room.cleared   = true;
    G.clearedFlash = 150;

    // Boss room cleared → win!
    if (room.type === 'boss') {
      G.state = STATES.WIN;
      AudioEngine.playSFX('win');
      AudioEngine.stopMusic();
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
    p.life--;
    if (p.life <= 0) G.deathParticles.splice(i, 1);
  }
  for (let i = G.drops.length - 1; i >= 0; i--) {
    G.drops[i].life--;
    if (G.drops[i].life <= 0) G.drops.splice(i, 1);
  }
}
