// p5.js global-mode entry point

const keys      = {};
let   mouseDown    = false;
let   _scale       = 1;      // canvas pixels per logical pixel (set in setup/windowResized)
let   _justFocused = false;  // swallow the click that re-focuses the window

window.addEventListener('focus', () => { _justFocused = true; });

// Auto-pause on window blur or mouse leaving the page
function _autoPause() {
  if (G.state === STATES.PLAYING) G.state = STATES.PAUSED;
  mouseDown = false;
  for (const k in keys) keys[k] = false;
}
window.addEventListener('blur', _autoPause);
document.addEventListener('mouseleave', _autoPause);

function _fitCanvas() {
  // Largest 4:3 rectangle that fits in the current window
  const aspect = C.WIDTH / C.HEIGHT;
  let w = windowWidth, h = windowHeight;
  if (w / h > aspect) w = Math.floor(h * aspect);
  else                 h = Math.floor(w / aspect);
  return { w, h };
}

function setup() {
  const { w, h } = _fitCanvas();
  _scale = w / C.WIDTH;
  pixelDensity(1);
  createCanvas(w, h);
  frameRate(C.FPS);
  textFont('monospace');
}

function windowResized() {
  const { w, h } = _fitCanvas();
  _scale = w / C.WIDTH;
  resizeCanvas(w, h);
}

function draw() {
  G.frame++;

  // Menu — no game logic, just drawing
  if (G.state === STATES.MENU) { Renderer.draw(); return; }

  // Room slide transition
  if (G.state === STATES.ROOM_TRANSITION) {
    tickTransition();
    Renderer.draw();
    return;
  }

  // Paused / name entry / win / game-over — still render but don't update game
  if (G.state === STATES.PAUSED     ||
      G.state === STATES.NAME_ENTRY ||
      G.state === STATES.WIN        ||
      G.state === STATES.GAME_OVER) {
    Renderer.draw();
    return;
  }

  // ── Active gameplay ──────────────────────────────────────────────────

  if (!G.mapOpen && performance.now() >= G.freezeUntil) {
    G.player.update(keys, mouseX / _scale, mouseY / _scale, G.currentRoom);
    if (mouseDown && G.player.autofireShots > 0) G.player.shoot(G.bullets);

    for (const e of G.enemies) e.update(G.player, G.currentRoom);
    for (let i = G.flies.length - 1; i >= 0; i--) {
      G.flies[i].update(G.player);
      if (!G.flies[i].alive) G.flies.splice(i, 1);
    }

    // Score kills before bullet update removes dead enemies
    for (const e of G.enemies) {
      if (!e.alive && !e._scored) { G.score += e.scoreValue || 0; e._scored = true; }
    }

    G.bullets.update(G.player, G.enemies, G.currentRoom);

    // Player bullets can also hit flies
    for (const b of G.bullets.pool) {
      if (!b.active || b.owner !== 'player') continue;
      for (let i = G.flies.length - 1; i >= 0; i--) {
        const fly = G.flies[i];
        if (!fly.alive) continue;
        if (circleCollide(b.pos.x, b.pos.y, b.radius, fly.pos.x, fly.pos.y, fly.radius)) {
          fly.takeDamage(b.damage);
          b.deactivate();
          break;
        }
      }
    }

    // Enemy bullets also damage the player
    for (const b of G.bullets.pool) {
      if (!b.active || b.owner !== 'enemy') continue;
      if (circleCollide(b.pos.x, b.pos.y, b.radius, G.player.pos.x, G.player.pos.y, G.player.radius)) {
        G.player.takeDamage(b.damage);
        b.deactivate();
      }
    }

    checkInvulnerableRepulsion();
    checkEliteShield();
    checkRagSymbols();
    checkRoomCleared();
    checkRoomExit();
    checkPickup();
    checkDropPickup();
    checkWidePowerup();
    checkMaxHpPowerup();
    checkSpeedPowerup();
    checkInvulnPowerup();
    checkAutofirePowerup();
    tickParticles();

    if (G.clearedFlash > 0) G.clearedFlash--;
    if (!G.player.alive && G.state !== STATES.GAME_OVER) {
      G.mapOpen = false;
      AudioEngine.playSFX('game_over');
      AudioEngine.stopMusic();
      _beginEndSequence(STATES.GAME_OVER);
    }
  }

  Renderer.draw();
}

// ── Input ────────────────────────────────────────────────────────────────

function mousePressed() {
  if (_justFocused) { _justFocused = false; return false; }
  AudioEngine.init();
  if (G.state === STATES.MENU)   { startGame(); return false; }
  if (G.state === STATES.PAUSED) { G.state = STATES.PLAYING; return false; }
  mouseDown = true;
  if (G.state === STATES.PLAYING) G.player.shoot(G.bullets);
  return false;
}

function mouseReleased() {
  mouseDown = false;
  // Snap spread back to zero so the next burst starts accurate again
  if (G.player) G.player.autofireSpread = 0;
  return false;
}

const DEV_COMMANDS = [
  'boss', 'fullmap', 'help', 'powerup', 'setfloor', 'spawn_maxhp',
  'spawn_ghost', 'spawn_ghoul', 'spawn_ghoul_boss', 'spawn_long_ghoul', 'spawn_mummy', 'spawn_nuckelavee', 'spawn_red_ghost', 'spawn_skull', 'spawn_white_skull',
];

function _devSpawn(EnemyClass, overrides) {
  if (G.state !== STATES.PLAYING) return 'Start a game first.';
  const z  = _spawnZone(G.currentRoom);
  const px = G.player.pos.x, py = G.player.pos.y;
  for (let i = 0; i < 60; i++) {
    const x = randFloat(z.minX, z.maxX);
    const y = randFloat(z.minY, z.maxY);
    if (Math.hypot(x - px, y - py) < 90) continue;
    const e = new EnemyClass(x, y);
    if (overrides) Object.assign(e, overrides);
    G.enemies.push(e);
    return `Spawned ${e.type}${overrides ? ' (lunge)' : ''}.`;
  }
  return 'No valid spawn position.';
}

function _execDevCommand(cmd) {
  cmd = cmd.trim().toLowerCase();
  if (cmd === 'boss') {
    if (!G.dungeon) return 'No dungeon loaded.';
    const bossRoom = G.dungeon.bossRoom;
    enterRoom(bossRoom, null);
    G.state = STATES.PLAYING;
    const P  = C.ROOM_PADDING;
    const pr = C.PLAYER_RADIUS + 8;
    const cn = bossRoom.connections;
    const corners = [
      { x: P + pr,             y: P + pr,             walls: ['north', 'west'] },
      { x: C.WIDTH  - P - pr,  y: P + pr,             walls: ['north', 'east'] },
      { x: C.WIDTH  - P - pr,  y: C.HEIGHT - P - pr,  walls: ['east',  'south'] },
      { x: P + pr,             y: C.HEIGHT - P - pr,  walls: ['south', 'west'] },
    ];
    corners.sort((a, b) =>
      a.walls.filter(w => cn[w]).length - b.walls.filter(w => cn[w]).length
    );
    G.player.pos.x = corners[0].x;
    G.player.pos.y = corners[0].y;
    return 'Teleported to boss room.';
  }
  if (cmd.startsWith('powerup')) {
    if (G.state !== STATES.PLAYING) return 'Start a game first.';
    const name = cmd.split(' ')[1];
    const INVENTORY_TYPES = { speed: 'speed', invuln: 'invuln', autofire: 'autofire', heal: 'heal' };
    if (name === 'powershot') {
      G.player.wideShots = C.WIDE_BULLET_SHOTS;
      return `Power shots granted (${C.WIDE_BULLET_SHOTS}).`;
    } else if (name === 'maxhp') {
      G.player.maxHp = Math.round(G.player.maxHp * 1.20);
      G.player.hp    = Math.min(G.player.hp + Math.round(G.player.maxHp * 0.20), G.player.maxHp);
      AudioEngine.playSFX('maxhp_fanfare');
      return `Max HP raised to ${G.player.maxHp}.`;
    } else if (INVENTORY_TYPES[name]) {
      return G.player.addPowerup(name) ? `${name} added to inventory.` : 'Inventory full.';
    }
    return 'Usage: powerup <powershot|heal|speed|invuln|autofire|maxhp>';
  }
  if (cmd === 'fullmap') {
    G.devFullMap = !G.devFullMap;
    return `Full map: ${G.devFullMap ? 'ON' : 'OFF'}.`;
  }
  if (cmd.startsWith('setfloor')) {
    const f = parseInt(cmd.split(' ')[1]);
    if (isNaN(f) || f < 1) return 'Usage: setfloor <n>';
    G.floor = f;
    for (const e of (G.enemies || [])) {
      if (!e.alive) continue;
      e.speedMult = _floorMult(C.FLOOR_SPEED_BONUS, C.FLOOR_SPEED_CAP);
      if (e.type === 'skull')
        e.vel.x = Math.sign(e.vel.x || 1) * C.SKULL_SPEED * e.speedMult;
      if (e.type === 'boss') {
        e.firerateMult = _floorMult(C.FLOOR_BOSS_FIRERATE_BONUS, C.FLOOR_BOSS_FIRERATE_CAP);
        e.bulletMult   = _floorMult(C.FLOOR_BOSS_BULLETS_BONUS,  C.FLOOR_BOSS_BULLETS_CAP);
      }
    }
    const speedMult  = Math.min(C.FLOOR_SPEED_CAP, 1 + (f-1)*C.FLOOR_SPEED_BONUS);
    const damageMult = 1 + (f-1)*C.FLOOR_DAMAGE_BONUS;
    return `Floor set to ${f} (speed ×${speedMult.toFixed(2)}, damage ×${damageMult.toFixed(2)}).`;
  }
  if (cmd === 'spawn_nuckelavee') return _devSpawn(NuckelaveeEnemy);
  if (cmd === 'spawn_maxhp') {
    if (G.state !== STATES.PLAYING) return 'Start a game first.';
    const room = G.currentRoom;
    if (!room) return 'No room.';
    room.maxhpPowerup       = { x: G.player.pos.x + 40, y: G.player.pos.y };
    room.maxhpPowerupActive = true;
    room.maxhpPowerupTaken  = false;
    return 'Max-HP powerup spawned.';
  }
  if (cmd === 'spawn_ghost')     return _devSpawn(GhostEnemy);
  if (cmd === 'spawn_red_ghost') return _devSpawn(GhostEnemy, { variant: 'lunge' });
  if (cmd === 'spawn_skull')     return _devSpawn(SkullEnemy);
  if (cmd === 'spawn_ghoul')      return _devSpawn(GhoulEnemy);
  if (cmd === 'spawn_ghoul_boss') return _devSpawn(GhoulBossEnemy);
  if (cmd === 'spawn_long_ghoul') return _devSpawn(LongGhoulEnemy);
  if (cmd === 'spawn_mummy')       return _devSpawn(MummyEnemy);
  if (cmd === 'spawn_white_skull') return _devSpawn(WhiteSkullEnemy);
  if (cmd === 'help' || cmd === '') {
    return DEV_COMMANDS.join('  ');
  }
  return `Unknown: ${cmd}`;
}

function keyPressed() {
  AudioEngine.init();

  // Name entry intercepts all input
  if (G.state === STATES.NAME_ENTRY) {
    if (key === 'Enter') {
      submitNameAndEnd(G.nameInput);
    } else if (key === 'Escape') {
      submitNameAndEnd('unknown');
    } else if (key === 'Backspace') {
      G.nameInput = G.nameInput.slice(0, -1);
    } else if (key.length === 1 && G.nameInput.length < 12) {
      G.nameInput += key;
    }
    return false;
  }

  // Dev console intercepts input first
  if (key === '`') {
    G.devConsole.open = !G.devConsole.open;
    G.devConsole.input = '';
    return false;
  }
  if (G.devConsole.open) {
    if (key === 'Enter') {
      const cmd = G.devConsole.input.trim();
      if (cmd) {
        G.devConsole.history.unshift(cmd);   // newest first
        G.devConsole.historyIdx = -1;
      }
      G.devConsole.output = _execDevCommand(G.devConsole.input);
      G.devConsole.input  = '';
    } else if (key === 'ArrowUp') {
      const h = G.devConsole.history;
      if (h.length) {
        G.devConsole.historyIdx = Math.min(G.devConsole.historyIdx + 1, h.length - 1);
        G.devConsole.input = h[G.devConsole.historyIdx];
      }
    } else if (key === 'ArrowDown') {
      G.devConsole.historyIdx--;
      G.devConsole.input = G.devConsole.historyIdx >= 0
        ? G.devConsole.history[G.devConsole.historyIdx]
        : '';
    } else if (key === 'Tab') {
      const partial  = G.devConsole.input.toLowerCase();
      const matches  = DEV_COMMANDS.filter(c => c.startsWith(partial));
      if (matches.length === 1) {
        G.devConsole.input  = matches[0];
        G.devConsole.output = '';
      } else if (matches.length > 1) {
        // Complete to longest common prefix, then show matches
        let prefix = matches[0];
        for (const m of matches) while (!m.startsWith(prefix)) prefix = prefix.slice(0, -1);
        G.devConsole.input  = prefix;
        G.devConsole.output = matches.join('  ');
      }
    } else if (key === 'Backspace') {
      G.devConsole.input = G.devConsole.input.slice(0, -1);
    } else if (key === 'Escape') {
      G.devConsole.open  = false;
      G.devConsole.input = '';
    } else if (key.length === 1) {
      G.devConsole.input += key;
    }
    return false;
  }

  // Any key (except Esc and backtick) dismisses pause
  if (G.state === STATES.PAUSED && key !== 'Escape' && key !== '`') {
    G.state = STATES.PLAYING;
    return false;
  }

  keys[key.toLowerCase()] = true;

  if (key === 'Enter' && G.state === STATES.MENU) startGame();

  if (key.toLowerCase() === 'n' && G.state === STATES.WIN) nextFloor();

  if (key === 'Escape' && G.state !== STATES.MENU) {
    if (G.mapOpen) { G.mapOpen = false; return false; }
    if (G.state === STATES.PLAYING) { G.state = STATES.PAUSED; return false; }
    if (G.state === STATES.PAUSED ||
        G.state === STATES.GAME_OVER ||
        G.state === STATES.WIN) {
      G.floor = 1;
      G.devConsole.open   = false;
      G.devConsole.input  = '';
      G.devConsole.output = '';
      AudioEngine.stopMusic();
      G.state = STATES.MENU;
    }
    return false;
  }

  if (key.toLowerCase() === 'p' &&
      (G.state === STATES.PLAYING || G.state === STATES.PAUSED)) {
    G.state = G.state === STATES.PAUSED ? STATES.PLAYING : STATES.PAUSED;
    return false;
  }

  if (key.toLowerCase() === 'm' && G.state === STATES.PLAYING) {
    G.mapOpen = !G.mapOpen;
    return false;
  }

  if (key === ' ' && G.state === STATES.PLAYING) {
    if (G.player && G.player.alive) G.player.usePowerup();
    return false;
  }
  if (key.toLowerCase() === 'q' && G.state === STATES.PLAYING) {
    if (G.player && G.player.alive) G.player.cyclePowerup();
    return false;
  }

  return false;
}

function keyReleased() {
  if (!G.devConsole.open) keys[key.toLowerCase()] = false;
  return false;
}
