// p5.js global-mode entry point

const keys      = {};
let   mouseDown = false;

function setup() {
  createCanvas(C.WIDTH, C.HEIGHT);
  frameRate(C.FPS);
  textFont('monospace');
  // Start on menu screen
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

  // Win / game-over — still render but don't update game
  if (G.state === STATES.WIN || G.state === STATES.GAME_OVER) {
    Renderer.draw();
    return;
  }

  // ── Active gameplay ──────────────────────────────────────────────────

  if (!G.mapOpen) {
    G.player.update(keys, mouseX, mouseY, G.currentRoom);
    if (mouseDown) G.player.shoot(G.bullets);

    for (const e of G.enemies) e.update(G.player, G.currentRoom);

    // Score kills before bullet update removes dead enemies
    for (const e of G.enemies) {
      if (!e.alive && !e._scored) { G.score += e.scoreValue || 0; e._scored = true; }
    }

    G.bullets.update(G.player, G.enemies, G.currentRoom);

    // Enemy bullets also damage the player
    for (const b of G.bullets.pool) {
      if (!b.active || b.owner !== 'enemy') continue;
      if (circleCollide(b.pos.x, b.pos.y, b.radius, G.player.pos.x, G.player.pos.y, G.player.radius)) {
        G.player.takeDamage(b.damage);
        b.deactivate();
      }
    }

    checkRoomCleared();
    checkRoomExit();
    checkPickup();
    checkDropPickup();
    tickParticles();

    if (G.clearedFlash > 0) G.clearedFlash--;
    if (!G.player.alive && G.state !== STATES.GAME_OVER) {
      G.mapOpen = false;
      G.state = STATES.GAME_OVER;
      AudioEngine.playSFX('game_over');
      AudioEngine.stopMusic();
    }
  }

  Renderer.draw();
}

// ── Input ────────────────────────────────────────────────────────────────

function mousePressed() {
  AudioEngine.init();
  mouseDown = true;
  if (G.state === STATES.MENU)    { startGame(); return false; }
  if (G.state === STATES.PLAYING) G.player.shoot(G.bullets);
  return false;
}

function mouseReleased() {
  mouseDown = false;
  return false;
}

function keyPressed() {
  AudioEngine.init();
  keys[key.toLowerCase()] = true;

  if (key === 'Enter' && G.state === STATES.MENU) startGame();

  if (key.toLowerCase() === 'r') { G.floor = 1; AudioEngine.stopMusic(); startGame(); }

  if (key.toLowerCase() === 'n' && G.state === STATES.WIN) nextFloor();

  if (key === 'Escape' && G.state !== STATES.MENU) {
    if (G.mapOpen) { G.mapOpen = false; return false; }
    if (G.escConfirm) {
      G.escConfirm = false;
      G.floor = 1;
      AudioEngine.stopMusic();
      G.state = STATES.MENU;
    } else {
      G.escConfirm = true;
    }
    return false;
  }

  // Any other key cancels the esc confirmation
  if (G.escConfirm) { G.escConfirm = false; return false; }

  if (key.toLowerCase() === 'm' && G.state === STATES.PLAYING) {
    G.mapOpen = !G.mapOpen;
    return false;
  }

  return false;
}

function keyReleased() {
  keys[key.toLowerCase()] = false;
  return false;
}
