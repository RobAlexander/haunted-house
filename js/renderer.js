// All p5.js drawing lives here — nothing else touches the draw API.
const Renderer = {

  draw() {
    background(C.COL_BG);

    if (G.state === STATES.MENU) { this.drawMenu(); return; }

    if (G.state === STATES.ROOM_TRANSITION) {
      this.drawTransition();
      this.drawHUD();
      return;
    }

    this.drawRoom(G.currentRoom);
    this.drawPickup(G.currentRoom);
    this.drawDrops(G.drops);
    this.drawDeathParticles(G.deathParticles);
    this.drawBullets(G.bullets);
    this.drawEnemies(G.enemies);
    this.drawPlayer(G.player);
    this.drawCrosshair(mouseX, mouseY);
    this.drawHUD();
    this.drawVignette(G.player);

    if (G.state === STATES.GAME_OVER) this.drawGameOver();
    if (G.state === STATES.WIN)       this.drawWin();
    if (G.escConfirm)                 this.drawEscConfirm();
  },

  // ── Menu ──────────────────────────────────────────────────────────────

  drawMenu() {
    // Glitchy title flicker
    const flicker = Math.sin(G.frame * 0.08) > 0.7;
    noStroke();
    fill(flicker ? '#ff88bb' : C.COL_GAMEOVER);
    textFont('monospace'); textSize(56); textAlign(CENTER, CENTER);
    text('HAUNTED HOUSE', C.WIDTH / 2, C.HEIGHT / 2 - 70);

    fill(C.COL_HUD_TEXT); textSize(15);
    text('ENTER  or  CLICK  to begin', C.WIDTH / 2, C.HEIGHT / 2 + 10);

    fill(C.COL_HUD_TITLE); textSize(11);
    text('WASD  move     MOUSE  aim     CLICK  shoot', C.WIDTH / 2, C.HEIGHT / 2 + 50);
    text('Find the boss room and destroy the haunting', C.WIDTH / 2, C.HEIGHT / 2 + 70);
  },

  // ── Room ──────────────────────────────────────────────────────────────

  drawRoom(room) {
    if (!room) return;
    const P = C.ROOM_PADDING, W = C.WIDTH, H = C.HEIGHT;

    // Boss room tinted floor
    if (room.type === 'boss') {
      noStroke(); fill(C.COL_BOSS_ROOM);
      rect(P, P, W - 2*P, H - 2*P);
      // Pentagram suggestion — faint lines
      stroke('#330000'); strokeWeight(0.5);
      const cx = W/2, cy = H/2, r = 120;
      for (let i = 0; i < 5; i++) {
        const a1 = (Math.PI * 2 / 5) * i - Math.PI / 2;
        const a2 = (Math.PI * 2 / 5) * ((i + 2) % 5) - Math.PI / 2;
        line(cx + Math.cos(a1)*r, cy + Math.sin(a1)*r, cx + Math.cos(a2)*r, cy + Math.sin(a2)*r);
      }
    }

    // Floor grid
    stroke(C.COL_FLOOR_GRID); strokeWeight(0.5);
    for (let x = P; x <= W-P; x += C.FLOOR_GRID_SIZE) line(x, P, x, H-P);
    for (let y = P; y <= H-P; y += C.FLOOR_GRID_SIZE) line(P, y, W-P, y);

    // Walls with door gaps
    stroke(C.COL_WALL); strokeWeight(2);
    this._drawWall(P, P,   W-P, P,   true,  room.connections.north, room, 0,  -10);
    this._drawWall(P, H-P, W-P, H-P, true,  room.connections.south, room, 0,   10);
    this._drawWall(W-P, P, W-P, H-P, false, room.connections.east,  room, 10,   0);
    this._drawWall(P,   P, P,   H-P, false, room.connections.west,  room, -10,  0);

    // Corners
    const cs = 14;
    stroke(C.COL_WALL_CORNER); strokeWeight(1.5);
    this._corner(P,   P,   cs,  1,  1);
    this._corner(W-P, P,   cs, -1,  1);
    this._corner(P,   H-P, cs,  1, -1);
    this._corner(W-P, H-P, cs, -1, -1);

    // Obstacles
    for (const obs of room.obstacles) {
      noFill(); stroke(C.COL_OBSTACLE); strokeWeight(1.5);
      rect(obs.x, obs.y, obs.w, obs.h);
      stroke(C.COL_OBSTACLE_X); strokeWeight(0.5);
      line(obs.x, obs.y, obs.x+obs.w, obs.y+obs.h);
      line(obs.x+obs.w, obs.y, obs.x, obs.y+obs.h);
    }
  },

  // Draw one wall segment with an optional door gap.
  // connection = neighbouring room or null; room = current room (for lock state)
  _drawWall(x1, y1, x2, y2, isHoriz, connection, room, tickDx, tickDy) {
    const DH  = C.DOOR_WIDTH / 2;
    const mid = isHoriz ? C.WIDTH / 2 : C.HEIGHT / 2;

    stroke(C.COL_WALL); strokeWeight(2);

    if (!connection) { line(x1, y1, x2, y2); return; }

    // Draw wall with gap
    if (isHoriz) {
      if (mid - DH > x1) line(x1, y1, mid - DH, y1);
      if (mid + DH < x2) line(mid + DH, y1, x2, y1);
    } else {
      if (mid - DH > y1) line(x1, y1, x1, mid - DH);
      if (mid + DH < y2) line(x1, mid + DH, x1, y2);
    }

    if (!room.cleared) {
      // Room not yet cleared — door is closed
      stroke(C.COL_DOOR_CLOSED); strokeWeight(2);
      if (isHoriz) line(mid - DH, y1, mid + DH, y1);
      else         line(x1, mid - DH, x1, mid + DH);
    } else {
      // Open: tick marks
      const doorCol = connection.type === 'boss' ? C.COL_BOSS : C.COL_DOOR_OPEN;
      stroke(doorCol); strokeWeight(1.5);
      if (isHoriz) {
        line(mid-DH, y1, mid-DH+tickDx, y1+tickDy);
        line(mid+DH, y1, mid+DH+tickDx, y1+tickDy);
        // Boss room label above/below the gap
        if (connection.type === 'boss') {
          noStroke(); fill(C.COL_BOSS); textSize(9); textAlign(CENTER, CENTER);
          text('BOSS', mid, y1 + tickDy * 2.5);
        }
      } else {
        line(x1, mid-DH, x1+tickDx, mid-DH+tickDy);
        line(x1, mid+DH, x1+tickDx, mid+DH+tickDy);
        if (connection.type === 'boss') {
          noStroke(); fill(C.COL_BOSS); textSize(9); textAlign(CENTER, CENTER);
          text('BOSS', x1 + tickDx * 2.5, mid);
        }
      }
    }
  },

  _drawPadlock(cx, cy, dx, dy) {
    const ox = dx !== 0 ? dx * 14 : 0;
    const oy = dy !== 0 ? dy * 14 : 0;
    stroke(C.COL_GAMEOVER); strokeWeight(1);
    noFill();
    rect(cx + ox - 5, cy + oy - 3, 10, 8);
    arc(cx + ox, cy + oy - 3, 10, 8, Math.PI, 0);
  },

  _corner(cx, cy, size, dx, dy) {
    line(cx, cy, cx + dx * size, cy);
    line(cx, cy, cx, cy + dy * size);
  },

  // ── Pickup ────────────────────────────────────────────────────────────

  drawPickup(room) {
    if (!room || !room.pickupActive || room.pickupTaken) return;
    const p  = room.pickup;
    const pulse = 0.7 + 0.3 * Math.sin(G.frame * 0.1);
    noFill(); stroke(C.COL_PICKUP); strokeWeight(1.5);
    drawingContext.globalAlpha = pulse;
    circle(p.x, p.y, 28);
    circle(p.x, p.y, 14);
    strokeWeight(3); point(p.x, p.y);
    drawingContext.globalAlpha = 1;
    noStroke(); fill(C.COL_PICKUP); textSize(9); textAlign(CENTER, CENTER);
    text('+HP', p.x, p.y + 22);
  },

  // ── Transition slide ──────────────────────────────────────────────────

  drawTransition() {
    if (!G.transition) return;
    const { dir, fromRoom, toRoom, progress: t } = G.transition;
    const W = C.WIDTH, H = C.HEIGHT;
    let fromOx = 0, fromOy = 0, toOx = 0, toOy = 0;
    switch (dir) {
      case 'north': fromOy = -t*H;  toOy  = (1-t)*H;  break;
      case 'south': fromOy =  t*H;  toOy  = -(1-t)*H; break;
      case 'east':  fromOx =  t*W;  toOx  = -(1-t)*W; break;
      case 'west':  fromOx = -t*W;  toOx  = (1-t)*W;  break;
    }
    push(); translate(fromOx, fromOy); this.drawRoom(fromRoom); pop();
    push(); translate(toOx,   toOy);   this.drawRoom(toRoom);   pop();
    const alpha = Math.sin(t * Math.PI) * 90;
    noStroke(); fill(0, 0, 0, alpha); rect(0, 0, W, H);
  },

  // ── Bullets ───────────────────────────────────────────────────────────

  drawBullets(pool) {
    if (!pool) return;
    for (const b of pool.pool) {
      if (!b.active) continue;
      noStroke();
      fill(b.owner === 'player' ? C.COL_BULLET_P : C.COL_BOSS_BULLET);
      circle(b.pos.x, b.pos.y, b.radius * 2);
    }
  },

  // ── Enemies ───────────────────────────────────────────────────────────

  drawEnemies(enemies) {
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.type === 'ghost')    this._drawGhost(e);
      if (e.type === 'skeleton') this._drawSkeleton(e);
      if (e.type === 'boss')     this._drawBoss(e);
    }
  },

  _drawGhost(e) {
    drawingContext.globalAlpha = e.flickerAlpha;
    noFill(); stroke(C.COL_GHOST); strokeWeight(1.5);
    circle(e.pos.x, e.pos.y, e.radius * 2);
    circle(e.pos.x, e.pos.y, e.radius * 1.25);
    circle(e.pos.x, e.pos.y, e.radius * 0.55);
    strokeWeight(3);
    point(e.pos.x - 4, e.pos.y - 3);
    point(e.pos.x + 4, e.pos.y - 3);
    drawingContext.globalAlpha = 1.0;
  },

  _drawSkeleton(e) {
    const x = e.pos.x, y = e.pos.y;
    const fx = Math.cos(e.facing), fy = Math.sin(e.facing);
    stroke(C.COL_SKELETON); strokeWeight(1.5); noFill();

    // Head
    circle(x, y - 10, 12);
    // Torso
    line(x, y - 4, x, y + 8);
    // Arms
    line(x - 10, y, x + 10, y);
    // Legs
    line(x, y + 8, x - 7, y + 18);
    line(x, y + 8, x + 7, y + 18);
    // Aim indicator (gun direction)
    stroke(C.COL_SKELETON); strokeWeight(1);
    line(x + fx * 8, y + fy * 8, x + fx * 18, y + fy * 18);

    // HP tick above head
    this._drawEnemyHP(e, x, y - 22);
  },

  _drawBoss(e) {
    const x = e.pos.x, y = e.pos.y, r = e.radius;
    const phase = e.phase;
    const col   = C.COL_BOSS;

    noFill(); stroke(col); strokeWeight(2.5);
    circle(x, y, r * 2);

    // Rotating inner spokes (speed reflects phase)
    stroke(col); strokeWeight(1);
    const spokeCount = 4 + phase * 2;
    const rot = G.frame * (0.015 + phase * 0.01);
    for (let i = 0; i < spokeCount; i++) {
      const a = (Math.PI * 2 / spokeCount) * i + rot;
      line(x, y, x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
    }

    // Inner ring
    noFill(); stroke(col); strokeWeight(1);
    circle(x, y, r * 0.8);

    // Full-width HP bar
    this._drawBossHP(e);
  },

  _drawEnemyHP(e, cx, topY) {
    const bw = 30, bh = 4;
    noStroke(); fill('#111122');
    rect(cx - bw/2, topY, bw, bh);
    const frac = e.hp / e.maxHp;
    fill(frac < 0.3 ? C.COL_HUD_HP_LOW : C.COL_HUD_HP);
    rect(cx - bw/2, topY, bw * frac, bh);
  },

  _drawBossHP(boss) {
    const bx = C.WIDTH / 2 - 150, by = C.HEIGHT - 30, bw = 300, bh = 10;
    noStroke(); fill('#111122'); rect(bx, by, bw, bh);
    const frac = boss.hp / boss.maxHp;
    fill(frac < 0.33 ? C.COL_BOSS : C.COL_HUD_HP_LOW);
    rect(bx, by, bw * frac, bh);
    noFill(); stroke(C.COL_BOSS); strokeWeight(0.5); rect(bx, by, bw, bh);
    noStroke(); fill(C.COL_HUD_TEXT); textSize(9); textAlign(CENTER, TOP);
    text(`BOSS  ${boss.hp} / ${boss.maxHp}`, C.WIDTH / 2, by + bh + 2);
  },

  // ── Player ────────────────────────────────────────────────────────────

  drawPlayer(player) {
    if (!player || !player.alive) return;
    if (player.invincibleFrames > 0 && Math.floor(G.frame / 4) % 2 === 0) return;

    const px = player.pos.x, py = player.pos.y;
    const r = player.radius, a = player.angle;

    noFill(); stroke(C.COL_PLAYER); strokeWeight(2);
    circle(px, py, r * 2);
    strokeWeight(3); point(px + Math.cos(a) * r, py + Math.sin(a) * r);
    stroke(C.COL_AIM_LINE); strokeWeight(1);
    line(px + Math.cos(a)*(r+2), py + Math.sin(a)*(r+2),
         px + Math.cos(a)*(r+22), py + Math.sin(a)*(r+22));
  },

  // ── Death particles ───────────────────────────────────────────────────

  drawDeathParticles(particles) {
    for (const p of particles) {
      const t     = 1 - p.life / p.maxLife;
      const r     = p.radius + (p.maxRadius - p.radius) * t;
      const alpha = (1 - t) * 0.85;
      drawingContext.globalAlpha = alpha;
      noFill(); stroke(p.col); strokeWeight(1.5);
      circle(p.x, p.y, r * 2);
      drawingContext.globalAlpha = 1;
    }
  },

  // ── Enemy drops ───────────────────────────────────────────────────────

  drawDrops(drops) {
    for (const d of drops) {
      const pulse = 0.55 + 0.45 * Math.sin(G.frame * 0.14);
      const alpha = Math.min(d.life / 60, 1) * pulse;
      drawingContext.globalAlpha = alpha;
      noFill(); stroke('#00eeff'); strokeWeight(1.5);
      circle(d.x, d.y, 20);
      circle(d.x, d.y, 9);
      strokeWeight(2.5); point(d.x, d.y);
      drawingContext.globalAlpha = 1;
    }
  },

  // ── Crosshair ─────────────────────────────────────────────────────────

  drawCrosshair(mx, my) {
    stroke(C.COL_CROSSHAIR); strokeWeight(1); noFill();
    const s = 8;
    line(mx-s, my, mx-3, my); line(mx+3, my, mx+s, my);
    line(mx, my-s, mx, my-3); line(mx, my+3, mx, my+s);
    circle(mx, my, 5);
  },

  // ── Low-HP vignette ───────────────────────────────────────────────────

  drawVignette(player) {
    if (!player || !player.alive) return;
    const frac = player.hp / player.maxHp;
    if (frac >= 0.25) return;
    // Pulse faster the lower HP gets
    const speed   = 0.04 + (1 - frac / 0.25) * 0.08;
    const pulse   = 0.3 + 0.25 * Math.sin(G.frame * speed);
    const alpha   = (1 - frac / 0.25) * pulse;
    drawingContext.globalAlpha = alpha;
    const W = C.WIDTH, H = C.HEIGHT, thickness = 55;
    noStroke(); fill('#ff0000');
    rect(0, 0, W, thickness);
    rect(0, H - thickness, W, thickness);
    rect(0, 0, thickness, H);
    rect(W - thickness, 0, thickness, H);
    drawingContext.globalAlpha = 1;
  },

  // ── HUD ───────────────────────────────────────────────────────────────

  drawHUD() {
    const p = G.player;
    if (!p) return;

    // Title
    noStroke(); fill(C.COL_HUD_TITLE);
    textFont('monospace'); textSize(11); textAlign(CENTER, TOP);
    text('HAUNTED HOUSE', C.WIDTH / 2, 8);

    // Score
    noStroke(); fill(C.COL_HUD_TEXT);
    textSize(11); textAlign(CENTER, TOP);
    text(`SCORE: ${G.score}`, C.WIDTH / 2, 22);

    // HP bar
    const bx = 20, by = 20, bw = 140, bh = 12;
    fill(C.COL_HUD_HP_BG); noStroke(); rect(bx, by, bw, bh);
    const frac    = p.alive ? p.hp / p.maxHp : 0;
    const hpColor = frac < 0.25 ? C.COL_HUD_HP_LOW : C.COL_HUD_HP;
    fill(hpColor); rect(bx, by, bw * frac, bh);
    noFill(); stroke(C.COL_HUD_TEXT); strokeWeight(0.5); rect(bx, by, bw, bh);
    noStroke(); fill(C.COL_HUD_TEXT); textSize(10); textAlign(LEFT, TOP);
    text(`HP  ${p.hp} / ${p.maxHp}`, bx, by + bh + 3);

    // Room info (top right)
    const room = G.currentRoom;
    textAlign(RIGHT, TOP); textSize(11);
    fill(C.COL_HUD_TEXT);
    text(`FLOOR: ${G.floor}  DEPTH: ${room ? room.depth : 0}`, C.WIDTH - 20, 20);
    const alive = G.enemies.filter(e => e.alive).length;
    fill(alive > 0 ? C.COL_HUD_TEXT : C.COL_DOOR_OPEN);
    text(`ENEMIES: ${alive}`, C.WIDTH - 20, 35);

    // Boss room locked indicator
    if (room && G.dungeon && G.dungeon.bossRoom && G.dungeon.bossRoom.bossDoorsLocked) {
      fill(C.COL_GAMEOVER); textAlign(RIGHT, TOP); textSize(10);
      text('BOSS ROOM LOCKED', C.WIDTH - 20, 52);
    }

    // Room cleared flash
    if (G.clearedFlash > 0) {
      drawingContext.globalAlpha = Math.min(G.clearedFlash / 40, 1);
      noStroke(); fill(C.COL_CLEARED);
      textSize(22); textAlign(CENTER, TOP);
      text('— CLEARED —', C.WIDTH / 2, 24);
      drawingContext.globalAlpha = 1.0;
    }

    // Treasure room hint
    if (room && room.type === 'treasure' && room.pickupActive && !room.pickupTaken) {
      noStroke(); fill(C.COL_PICKUP); textSize(11); textAlign(CENTER, BOTTOM);
      text('Walk over the pickup to restore HP', C.WIDTH / 2, C.HEIGHT - 12);
    }

    noStroke(); fill(C.COL_HUD_TEXT); textSize(9); textAlign(LEFT, BOTTOM);
    text('R: new dungeon', 20, C.HEIGHT - 6);
  },

  // ── Overlays ──────────────────────────────────────────────────────────

  drawEscConfirm() {
    noStroke(); fill(0, 0, 0, 170); rect(0, 0, C.WIDTH, C.HEIGHT);
    fill(C.COL_HUD_TEXT); textFont('monospace'); textSize(20);
    textAlign(CENTER, CENTER);
    text('Return to title screen?', C.WIDTH / 2, C.HEIGHT / 2 - 18);
    textSize(14);
    fill(C.COL_GAMEOVER);
    text('ESC  to confirm', C.WIDTH / 2, C.HEIGHT / 2 + 14);
    fill(C.COL_HUD_TEXT);
    text('any other key to cancel', C.WIDTH / 2, C.HEIGHT / 2 + 36);
  },

  drawGameOver() {
    noStroke(); fill(0, 0, 0, 160); rect(0, 0, C.WIDTH, C.HEIGHT);
    fill(C.COL_GAMEOVER); textFont('monospace'); textSize(52);
    textAlign(CENTER, CENTER);
    text('GAME OVER', C.WIDTH / 2, C.HEIGHT / 2 - 36);
    fill(C.COL_HUD_TEXT); textSize(18);
    text(`SCORE: ${G.score}`, C.WIDTH / 2, C.HEIGHT / 2 + 8);
    textSize(14);
    text('Press  R  to try again', C.WIDTH / 2, C.HEIGHT / 2 + 36);
  },

  drawWin() {
    noStroke(); fill(0, 0, 0, 180); rect(0, 0, C.WIDTH, C.HEIGHT);
    fill(C.COL_WIN); textFont('monospace'); textSize(46);
    textAlign(CENTER, CENTER);
    text('YOU ESCAPED!', C.WIDTH / 2, C.HEIGHT / 2 - 54);
    fill(C.COL_HUD_TEXT); textSize(14);
    text(`Floor ${G.floor} complete`, C.WIDTH / 2, C.HEIGHT / 2 - 16);
    textSize(20); fill(C.COL_CLEARED);
    text(`SCORE:  ${G.score}`, C.WIDTH / 2, C.HEIGHT / 2 + 16);
    fill(C.COL_WIN); textSize(14);
    text('Press  N  for next floor  (harder)', C.WIDTH / 2, C.HEIGHT / 2 + 46);
    fill(C.COL_HUD_TEXT); textSize(12);
    text('Press  R  to start over from floor 1', C.WIDTH / 2, C.HEIGHT / 2 + 68);
  },
};
