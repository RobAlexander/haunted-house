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
  shieldSparks:   [],
  drops:          [],
  flies:          [],
  ragCollected:   Object.fromEntries(getFloorSymbols(1).map(l => [l, false])),
  mapOpen:        false,
  newHighScore:    null,   // 1-based rank of last score, or null
  nameInput:       '',     // player name being typed on NAME_ENTRY screen
  pendingEndState: null,   // WIN or GAME_OVER waiting after name entry
  devConsole:      { open: false, input: '', output: '' },
  devFullMap:     false,
  symbolFlicker:  { timer: 0, col: '' },
};

// ── Game lifecycle ────────────────────────────────────────────────────────

function startGame() {
  G.state          = STATES.PLAYING;
  G.frame          = 0;
  G.score          = 0;
  G.transition     = null;
  G.clearedFlash   = 0;
  G.deathParticles = [];
  G.shieldSparks   = [];
  G.drops          = [];
  G.flies          = [];
  G.ragCollected = Object.fromEntries(getFloorSymbols(G.floor).map(l => [l, false]));
  G.mapOpen         = false;
  G.newHighScore     = null;
  G.nameInput        = '';
  G.pendingEndState  = null;
  G.symbolFlicker   = { timer: 0, col: '' };
  G.dungeon        = new DungeonGraph();
  G.bullets        = new BulletPool();
  G.player         = new Player(C.WIDTH / 2, C.HEIGHT / 2);
  AudioEngine.stopMusic();
  AudioEngine.startMusic();
  enterRoom(G.dungeon.startRoom, null);
}

function nextFloor() {
  const savedHp         = G.player ? G.player.hp           : null;
  const savedMaxHp      = G.player ? G.player.maxHp        : null;
  const savedScore      = G.score;
  const savedPowerups   = G.player ? [...G.player.powerups] : null;
  const savedPowerupIdx = G.player ? G.player.powerupIdx   : 0;
  const savedWideShots  = G.player ? G.player.wideShots    : 0;
  const savedSpeedTimer = G.player ? G.player.speedTimer   : 0;
  const savedInvulnTimer= G.player ? G.player.invulnTimer  : 0;
  G.floor++;
  startGame();
  if (savedHp !== null) {
    G.player.hp         = savedHp;
    G.player.maxHp      = savedMaxHp;
    G.player.powerups    = savedPowerups;
    G.player.powerupIdx  = savedPowerupIdx;
    G.player.wideShots   = savedWideShots;
    G.player.speedTimer  = savedSpeedTimer;
    G.player.invulnTimer = savedInvulnTimer;
  }
  G.score = savedScore;
}

function enterRoom(room, fromDir) {
  const firstVisit = !room.visited;
  G.currentRoom    = room;
  room.visited     = true;
  G.bullets        = new BulletPool();
  G.drops          = [];
  G.flies          = [];
  G.shieldSparks   = [];

  // Compute player entry position first so spawn logic can exclude it
  const P = C.ROOM_PADDING + C.PLAYER_RADIUS + 8;
  const entryPositions = {
    north: { x: C.WIDTH / 2, y: C.HEIGHT - P },
    south: { x: C.WIDTH / 2, y: P            },
    east:  { x: P,           y: C.HEIGHT / 2 },
    west:  { x: C.WIDTH - P, y: C.HEIGHT / 2 },
  };
  const entryPos = fromDir !== null ? entryPositions[fromDir] : { x: C.WIDTH / 2, y: C.HEIGHT / 2 };

  if (!room.cleared) {
    G.enemies = spawnEnemies(room, entryPos.x, entryPos.y);
  } else {
    G.enemies = [];
  }

  // Reposition player at the entry door
  if (fromDir !== null) {
    G.player.pos.x = entryPos.x;
    G.player.pos.y = entryPos.y;
  }

  // Treasure room: grant pickup immediately on first visit
  if (room.type === 'treasure' && room.pickup && !room.pickupTaken) {
    room.pickupActive = true;
  }

  // Wide-bullet powerup room
  if (room.widePowerup && !room.widePowerupTaken) {
    room.widePowerupActive = true;
  }

  // Max-HP powerup room
  if (room.maxhpPowerup && !room.maxhpPowerupTaken) {
    room.maxhpPowerupActive = true;
  }

  // Speed powerup room
  if (room.speedPowerup && !room.speedPowerupTaken) {
    room.speedPowerupActive = true;
  }

  // Invuln powerup room
  if (room.invulnPowerup && !room.invulnPowerupTaken) {
    room.invulnPowerupActive = true;
  }

  // Audio: boss mode toggle + room enter SFX
  if (fromDir !== null) AudioEngine.playSFX('room_enter');
  const isMummyBoss = room.type === 'boss' && G.enemies.some(e => e.type === 'mummy_boss');
  // Ghoul boss uses the same music as skull boss (not mummy mode)
  AudioEngine.setBossMode(room.type === 'boss', isMummyBoss);
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
      AudioEngine.startVictoryMusic();
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
  const _ragBlocked = c => c && c === G.dungeon.bossRoom && !ragAllCollected();
  if (pl.pos.y < P            && rm.connections.north && !_ragBlocked(rm.connections.north)) { startRoomTransition('north'); return; }
  if (pl.pos.y > C.HEIGHT - P && rm.connections.south && !_ragBlocked(rm.connections.south)) { startRoomTransition('south'); return; }
  if (pl.pos.x > C.WIDTH  - P && rm.connections.east  && !_ragBlocked(rm.connections.east))  { startRoomTransition('east');  return; }
  if (pl.pos.x < P            && rm.connections.west  && !_ragBlocked(rm.connections.west))  { startRoomTransition('west');  return; }

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
    if (!G.player.addPowerup('heal')) return;   // inventory full — don't consume
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
    if (!G.player.addPowerup('power')) return;  // inventory full — don't consume
    room.widePowerupTaken   = true;
    room.widePowerupActive  = false;
    AudioEngine.playSFX('pickup');
  }
}

function checkMaxHpPowerup() {
  const room = G.currentRoom;
  if (!room || !room.maxhpPowerupActive || room.maxhpPowerupTaken) return;
  const p = room.maxhpPowerup;
  if (circleCollide(G.player.pos.x, G.player.pos.y, G.player.radius, p.x, p.y, 14)) {
    G.player.maxHp = Math.round(G.player.maxHp * 1.20);
    G.player.hp    = Math.min(G.player.hp + Math.round(G.player.maxHp * 0.20), G.player.maxHp);
    room.maxhpPowerupTaken  = true;
    room.maxhpPowerupActive = false;
    AudioEngine.playSFX('maxhp_fanfare');
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

function ragAllCollected() {
  return Object.values(G.ragCollected).every(Boolean);
}

function checkRagSymbols() {
  const room = G.currentRoom;
  if (!room || !room.ragSymbol || room.ragSymbol.collected) return;
  const s = room.ragSymbol;
  if (circleCollide(G.player.pos.x, G.player.pos.y, G.player.radius,
                    s.x, s.y, C.RAG_SYMBOL_COLLECT_R)) {
    s.collected = true;
    G.ragCollected[s.letter] = true;
    AudioEngine.playSFX('symbol_pickup');
    G.symbolFlicker.timer = C.SYMBOL_FLICKER_DURATION;
    G.symbolFlicker.col   = C.COL_RAG_SYMBOL;
  }
}

function checkSpeedPowerup() {
  const room = G.currentRoom;
  if (!room || !room.speedPowerupActive || room.speedPowerupTaken) return;
  const p = room.speedPowerup;
  if (circleCollide(G.player.pos.x, G.player.pos.y, G.player.radius, p.x, p.y, 14)) {
    if (!G.player.addPowerup('speed')) return;
    room.speedPowerupTaken  = true;
    room.speedPowerupActive = false;
    AudioEngine.playSFX('pickup');
  }
}

function checkInvulnPowerup() {
  const room = G.currentRoom;
  if (!room || !room.invulnPowerupActive || room.invulnPowerupTaken) return;
  const p = room.invulnPowerup;
  if (circleCollide(G.player.pos.x, G.player.pos.y, G.player.radius, p.x, p.y, 14)) {
    if (!G.player.addPowerup('invuln')) return;
    room.invulnPowerupTaken  = true;
    room.invulnPowerupActive = false;
    AudioEngine.playSFX('pickup');
  }
}

function tickParticles() {
  if (G.symbolFlicker.timer > 0) G.symbolFlicker.timer--;

  for (let i = G.deathParticles.length - 1; i >= 0; i--) {
    const p = G.deathParticles[i];
    if (p.delay > 0) { p.delay--; continue; }
    if (p.isFlyPop) {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.88; p.vy *= 0.88;
    }
    p.life--;
    if (p.life <= 0) G.deathParticles.splice(i, 1);
  }
  for (let i = G.shieldSparks.length - 1; i >= 0; i--) {
    const s = G.shieldSparks[i];
    s.x += s.vx; s.y += s.vy;
    s.vx *= 0.82; s.vy *= 0.82;
    s.life--;
    if (s.life <= 0) G.shieldSparks.splice(i, 1);
  }
  for (let i = G.drops.length - 1; i >= 0; i--) {
    G.drops[i].life--;
    if (G.drops[i].life <= 0) G.drops.splice(i, 1);
  }
}

// Push non-shielded enemies out of invulnerable shields; freeze them for 1s if overlapping.
// Also: bullets that hit an invulnerable shield redirect damage to any enemy inside it.
function checkInvulnerableRepulsion() {
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const isInvuln = ((e.type === 'boss' || e.type === 'ghoul_boss' || e.type === 'mummy_boss') && e.transitionTimer > 0) || e.shielded;
    if (!isInvuln) continue;
    const shieldR = (e.type === 'boss' && e.transitionTimer > 0) ? e.radius + 18 : e.radius + 12;
    for (const other of G.enemies) {
      if (other === e || !other.alive || other.shielded) continue;
      const dx = other.pos.x - e.pos.x, dy = other.pos.y - e.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = shieldR + other.radius;
      if (dist < minDist) {
        const safe = dist > 0.01 ? dist : 0.01;
        other.pos.x = e.pos.x + (dx / safe) * minDist;
        other.pos.y = e.pos.y + (dy / safe) * minDist;
        other.shieldFreezeTimer = 60;
      }
    }
  }
}

// Drop the elite shield when all non-shielded enemies in the room are dead
function checkEliteShield() {
  for (const e of G.enemies) {
    if (!e.alive || !e.shielded) continue;
    const othersAlive = G.enemies.some(o => o !== e && o.alive && !o.shielded);
    if (!othersAlive) e.shielded = false;
  }
}
