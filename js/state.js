const STATES = {
  MENU:            'menu',
  PLAYING:         'playing',
  PAUSED:          'paused',
  ROOM_TRANSITION: 'room_transition',
  NAME_ENTRY:      'name_entry',
  GAME_OVER:       'game_over',
  WIN:             'win',
  CYCLE_COMPLETE:  'cycle_complete',
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
  devConsole:      { open: false, input: '', output: '', history: [], historyIdx: -1 },
  devFullMap:     false,
  symbolFlicker:  { timer: 0, col: '' },
  freezeUntil:    0,   // performance.now() timestamp until which game logic is frozen
  cyclesCompleted: 0,  // how many full boss cycles (skull→ghoul→mummy) the player has beaten this run
  cycleAnim:      null, // animation state while in CYCLE_COMPLETE state
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
  G.cyclesCompleted = 0;
  G.cycleAnim       = null;
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
  const savedWideShots     = G.player ? G.player.wideShots     : 0;
  const savedSpeedTimer    = G.player ? G.player.speedTimer    : 0;
  const savedInvulnTimer   = G.player ? G.player.invulnTimer   : 0;
  const savedAutofireShots = G.player ? G.player.autofireShots : 0;
  const savedCycles        = G.cyclesCompleted;
  G.floor++;
  startGame();
  if (savedHp !== null) {
    G.player.hp         = savedHp;
    G.player.maxHp      = savedMaxHp;
    G.player.powerups    = savedPowerups;
    G.player.powerupIdx  = savedPowerupIdx;
    G.player.wideShots     = savedWideShots;
    G.player.speedTimer    = savedSpeedTimer;
    G.player.invulnTimer   = savedInvulnTimer;
    G.player.autofireShots = savedAutofireShots;
  }
  G.score           = savedScore;
  G.cyclesCompleted = savedCycles;
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

  // Autofire powerup room
  if (room.autofirePowerup && !room.autofirePowerupTaken) {
    room.autofirePowerupActive = true;
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

// ── Boss cycle completion ─────────────────────────────────────────────────

function cycleComplete() {
  G.cyclesCompleted++;
  const pl = G.player;
  // Which edge is the stairwell on?
  const exitDir   = G.currentRoom.stairwell;
  const walkAngle = { north: -Math.PI/2, south: Math.PI/2, east: 0, west: Math.PI }[exitDir] || 0;
  G.cycleAnim = { timer: 0, walkAngle, particles: [], debris: [], shake: 18 };
  // Initial burst
  for (let i = 0; i < 70; i++) _spawnCycleParticle();
  for (let i = 0; i < 10; i++) _spawnCycleDebris();
  pl.invincibleFrames = 9999; // player can't be hurt during the animation
  G.state = STATES.CYCLE_COMPLETE;
  AudioEngine.playSFX('final_symbol');
}

function _spawnCycleParticle() {
  const anim = G.cycleAnim;
  const fromWall = Math.random() > 0.3;
  let ox, oy;
  if (fromWall) {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) { ox = 30 + Math.random() * (C.WIDTH - 60); oy = 25; }
    else if (side === 1) { ox = 30 + Math.random() * (C.WIDTH - 60); oy = C.HEIGHT - 25; }
    else if (side === 2) { ox = 25; oy = 30 + Math.random() * (C.HEIGHT - 60); }
    else { ox = C.WIDTH - 25; oy = 30 + Math.random() * (C.HEIGHT - 60); }
  } else {
    ox = C.WIDTH / 2 + (Math.random() - 0.5) * 120;
    oy = C.HEIGHT / 2 + (Math.random() - 0.5) * 80;
  }
  const ang = Math.random() * Math.PI * 2;
  const spd = 0.6 + Math.random() * 4;
  const life = 30 + Math.floor(Math.random() * 80);
  const r    = 1 + Math.random() * 4;
  const cols = ['#ffffff', '#ffee44', '#ffaa00', '#ff5500', '#ff2200'];
  anim.particles.push({ x: ox, y: oy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r, life, maxLife: life, col: cols[Math.floor(Math.random() * cols.length)] });
}

function _spawnCycleDebris() {
  const anim = G.cycleAnim;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = 30 + Math.random() * (C.WIDTH - 60); y = 25; }
  else if (side === 1) { x = 30 + Math.random() * (C.WIDTH - 60); y = C.HEIGHT - 25; }
  else if (side === 2) { x = 25; y = 30 + Math.random() * (C.HEIGHT - 60); }
  else { x = C.WIDTH - 25; y = 30 + Math.random() * (C.HEIGHT - 60); }
  const ang = Math.atan2(y - C.HEIGHT / 2, x - C.WIDTH / 2);
  const spd = 0.4 + Math.random() * 1.8;
  const life = 90 + Math.floor(Math.random() * 60);
  anim.debris.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, w: 8 + Math.random() * 22, h: 4 + Math.random() * 12, rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 0.12, life, maxLife: life });
}

function tickCycleAnim() {
  const anim = G.cycleAnim;
  if (!anim) return;
  anim.timer++;
  const t = anim.timer;

  // Walk player toward exit edge
  const spd = 2.5;
  G.player.pos.x += Math.cos(anim.walkAngle) * spd;
  G.player.pos.y += Math.sin(anim.walkAngle) * spd;
  G.player.angle  = anim.walkAngle;

  // Ongoing particle spawn for first 90 frames
  if (t < 90 && t % 3 === 0) {
    for (let i = 0; i < 4; i++) _spawnCycleParticle();
  }
  if (t < 40 && t % 12 === 0) _spawnCycleDebris();

  // Update particles
  for (let i = anim.particles.length - 1; i >= 0; i--) {
    const p = anim.particles[i];
    p.x  += p.vx; p.y += p.vy;
    p.vy += 0.05;
    p.vx *= 0.97; p.vy *= 0.97;
    if (--p.life <= 0) anim.particles.splice(i, 1);
  }

  // Update debris
  for (let i = anim.debris.length - 1; i >= 0; i--) {
    const d = anim.debris[i];
    d.x += d.vx; d.y += d.vy;
    d.vy += 0.025;
    d.rot += d.vrot;
    if (--d.life <= 0) anim.debris.splice(i, 1);
  }

  if (anim.shake > 0) anim.shake -= 0.4;
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
  // On mummy-boss floors (floor % 3 === 0) a full cycle is complete — show the cycle screen instead.
  if (rm.stairwell) {
    const sw = rm.stairwell;
    const _step = () => { if (G.floor % 3 === 0) cycleComplete(); else nextFloor(); };
    if (sw === 'north' && pl.pos.y < P)            { _step(); return; }
    if (sw === 'south' && pl.pos.y > C.HEIGHT - P) { _step(); return; }
    if (sw === 'east'  && pl.pos.x > C.WIDTH  - P) { _step(); return; }
    if (sw === 'west'  && pl.pos.x < P)            { _step(); return; }
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
    AudioEngine.playSFX(ragAllCollected() ? 'final_symbol' : 'symbol_pickup');
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

function checkAutofirePowerup() {
  const room = G.currentRoom;
  if (!room || !room.autofirePowerupActive || room.autofirePowerupTaken) return;
  const p = room.autofirePowerup;
  if (circleCollide(G.player.pos.x, G.player.pos.y, G.player.radius, p.x, p.y, 14)) {
    if (!G.player.addPowerup('autofire')) return;
    room.autofirePowerupTaken  = true;
    room.autofirePowerupActive = false;
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
