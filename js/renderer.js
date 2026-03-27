// All p5.js drawing lives here — nothing else touches the draw API.
const Renderer = {

  draw() {
    // Render at full canvas resolution: reset any leftover transform, fill the
    // actual canvas, then apply a uniform scale so all game drawing uses the
    // fixed 800×600 logical coordinate space regardless of window size.
    resetMatrix();
    background(C.COL_BG);
    scale(_scale, _scale);

    const mx = mouseX / _scale, my = mouseY / _scale;

    if (G.state === STATES.MENU) { this.drawMenu(); return; }

    if (G.state === STATES.ROOM_TRANSITION) {
      this.drawTransition();
      this.drawHUD();
      return;
    }

    this.drawRoom(G.currentRoom);
    this.drawPickup(G.currentRoom);
    this.drawWidePowerup(G.currentRoom);
    this.drawDrops(G.drops);
    this.drawDeathParticles(G.deathParticles);
    this.drawBullets(G.bullets);
    this.drawEnemies(G.enemies);
    this.drawPlayer(G.player);
    this.drawCrosshair(mx, my);
    this.drawHUD();
    this.drawVignette(G.player);

    if (G.mapOpen)                         { this.drawMap(); }
    if (G.state === STATES.NAME_ENTRY)     this.drawNameEntry();
    if (G.state === STATES.GAME_OVER)      this.drawGameOver();
    if (G.state === STATES.WIN)            this.drawWin();
    if (G.escConfirm)                      this.drawEscConfirm();
    if (G.devConsole.open)                 this.drawDevConsole();
  },

  // ── Menu ──────────────────────────────────────────────────────────────

  drawMenu() {
    // Glitchy title flicker
    const flicker = Math.sin(G.frame * 0.08) > 0.7;
    noStroke();
    fill(flicker ? '#ff88bb' : C.COL_GAMEOVER);
    textFont('Creepster'); textSize(80); textAlign(CENTER, CENTER);
    text('Haunted House', C.WIDTH / 2, C.HEIGHT / 2 - 70);

    textFont('monospace');
    fill(C.COL_HUD_TEXT); textSize(15);
    text('ENTER  or  CLICK  to begin', C.WIDTH / 2, C.HEIGHT / 2 + 10);

    fill(C.COL_HUD_TITLE); textSize(11);
    text('WASD  move     MOUSE  aim     CLICK  shoot     M  map', C.WIDTH / 2, C.HEIGHT / 2 + 50);
    text('Find the boss room and destroy the haunting', C.WIDTH / 2, C.HEIGHT / 2 + 70);

    // High score table
    const scores = HighScores.get();
    if (scores.length > 0) {
      const tx = C.WIDTH / 2, ty = C.HEIGHT / 2 + 108;
      noStroke(); fill(C.COL_HUD_TITLE); textSize(10); textAlign(CENTER, TOP);
      text('─── HIGH SCORES ───', tx, ty);
      textSize(11);
      for (let i = 0; i < scores.length; i++) {
        const { score, floor, name } = scores[i];
        const isNew  = G.newHighScore === i + 1;
        const label  = (name || 'unknown').padEnd(12).slice(0, 12);
        fill(isNew ? C.COL_CLEARED : C.COL_HUD_TEXT);
        text(`#${i + 1}  ${label}  ${String(score).padStart(6)}  fl.${floor}`, tx, ty + 16 + i * 16);
      }
    }
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

  drawWidePowerup(room) {
    if (!room || !room.widePowerupActive || room.widePowerupTaken) return;
    const p     = room.widePowerup;
    const pulse = 0.65 + 0.35 * Math.sin(G.frame * 0.13);
    drawingContext.globalAlpha = pulse;
    noFill(); stroke(C.COL_WIDE_PICKUP); strokeWeight(2);
    rect(p.x - 16, p.y - 5, 32, 10, 2);
    strokeWeight(1);
    rect(p.x - 22, p.y - 3, 44, 6, 1);
    drawingContext.globalAlpha = 1;
    noStroke(); fill(C.COL_WIDE_PICKUP); textFont('monospace'); textSize(9); textAlign(CENTER, CENTER);
    text('WIDE SHOT', p.x, p.y + 20);
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
      if (e.type === 'ghoul')    this._drawGhoul(e);
    }
  },

  _drawGhost(e) {
    const x = e.pos.x, y = e.pos.y, r = e.radius;
    const d = e.deform;
    const w = Math.sin(G.frame * 0.07 + x * 0.05) * 2.5;
    const lx = x - r + d[1] * 3;
    const rx = x + r + d[2] * 3;
    const ty = y - r - 2 + d[0] * 4;
    const col = e.variant === 'lunge' ? C.COL_LUNGE_GHOST : C.COL_GHOST;
    const alpha = (e.variant === 'lunge' && e.lunging) ? 0.92 : e.flickerAlpha;

    drawingContext.globalAlpha = alpha;
    noFill(); stroke(col); strokeWeight(1.5);
    beginShape();
    curveVertex(lx,           y + 3);
    curveVertex(lx,           y + 3);
    curveVertex(lx,           y - 3);
    curveVertex(x - r * 0.6, ty + r * 0.35);
    curveVertex(x,            ty);
    curveVertex(x + r * 0.6, ty + r * 0.35);
    curveVertex(rx,           y - 3);
    curveVertex(rx,           y + 3);
    curveVertex(x + r * 0.6, y + r * 0.5 + w + d[3] * 4);
    curveVertex(x + r * 0.2, y + r * 0.25);
    curveVertex(x,            y + r * 0.5 - w + d[4] * 4);
    curveVertex(x - r * 0.2, y + r * 0.25);
    curveVertex(x - r * 0.6, y + r * 0.5 + w + d[5] * 4);
    curveVertex(lx,           y + 3);
    curveVertex(lx,           y + 3);
    endShape();

    noStroke(); fill(col);
    circle(x - 4, y - 3, 4);
    circle(x + 4, y - 3, 4);
    drawingContext.globalAlpha = 1.0;
  },

  _drawSkeleton(e) {
    const x = e.pos.x, y = e.pos.y;
    const d = e.deform;  // [craniumR, leftEyeX, rightEyeX, jawY, toothSpread]

    // Cranium — slightly deformed radius and centre
    noFill(); stroke(C.COL_SKELETON); strokeWeight(1.5);
    circle(x, y - 1, 22 + d[0] * 2);

    // Eye sockets: offset per-instance
    const lex = x - 5 + d[1] * 1.5, rex = x + 5 + d[2] * 1.5, ey = y - 4;
    noStroke(); fill(C.COL_BG);
    circle(lex, ey, 7);
    circle(rex, ey, 7);

    const glow = 0.55 + 0.45 * Math.sin(G.frame * 0.09 + x * 0.02);
    drawingContext.globalAlpha = glow;
    fill(C.COL_SKELETON);
    circle(lex, ey, 3.5);
    circle(rex, ey, 3.5);
    drawingContext.globalAlpha = 1;

    // Teeth — jaw Y and spacing deformed
    noFill(); stroke(C.COL_SKELETON); strokeWeight(1.5);
    const ty = y + 6 + d[3] * 1.5;
    const ts = 5 + d[4];
    for (let i = -1; i <= 1; i++) {
      line(x + i * ts, ty, x + i * ts, ty + 4);
    }

    this._drawEnemyHP(e, x, y - 18);
  },

  _drawGhoul(e) {
    const x = e.pos.x, y = e.pos.y, r = e.radius;
    const p = e.crawlPhase;
    const d = e.deform;  // [bodyW, bodyH, limb0..3 angle offsets]
    const col = C.COL_GHOUL;

    // Flattened oval body — width/height deformed per-instance
    noFill(); stroke(col); strokeWeight(1.5);
    ellipse(x, y, r * (2.4 + d[0] * 0.3), r * (1.5 + d[1] * 0.2));

    // Four claw-limbs — base angles offset per-instance, then animated
    const baseAngles = [-Math.PI/4, Math.PI/4, Math.PI*0.75, Math.PI*1.25];
    const animSigns  = [1, -1, 1, -1];
    strokeWeight(1.5);
    for (let i = 0; i < 4; i++) {
      const a  = baseAngles[i] + d[2 + i] * 0.3 + animSigns[i] * Math.sin(p) * 0.25;
      const ex = x + Math.cos(a) * r * 1.05;
      const ey = y + Math.sin(a) * r * 0.7;
      line(ex, ey, ex + Math.cos(a) * 9, ey + Math.sin(a) * 9);
    }

    // Eyes — brighter and solid when leaping
    const eyeAlpha = e.leaping ? 1.0 : 0.65;
    drawingContext.globalAlpha = eyeAlpha;
    noStroke(); fill(col);
    circle(x - 4, y - 2, 5);
    circle(x + 4, y - 2, 5);
    drawingContext.globalAlpha = 1;

    this._drawEnemyHP(e, x, y - r - 8);
  },

  _drawBoss(e) {
    const x = e.pos.x, y = e.pos.y, r = e.radius;
    const phase = e.phase;
    const col = C.COL_BOSS;

    // Pulse timing (shared by halo and eyes)
    const pulseSpeed = 0.07 + phase * 0.045;
    const baseAlpha  = 0.45 + phase * 0.15;
    const glow = baseAlpha + (1 - baseAlpha) * (0.5 + 0.5 * Math.sin(G.frame * pulseSpeed));

    // Phase halo — dim red wash, intensifies at phase 2 and 3
    if (phase > 1) {
      drawingContext.globalAlpha = (phase - 1) * 0.12;
      noStroke(); fill(col);
      circle(x, y - r * 0.1, r * 2.8);
      drawingContext.globalAlpha = 1;
    }

    // Skull silhouette — dome cranium narrowing down to jaw
    // Each vertex pushed in/out along its radial direction by deform[i]
    const dr = r * 0.07;
    const rawSp = [
      [x,             y - r * 1.05],  // crown
      [x + r * 0.82,  y - r * 0.52],  // right temple
      [x + r * 0.88,  y + r * 0.08],  // right cheek (widest)
      [x + r * 0.58,  y + r * 0.68],  // right jaw
      [x,             y + r * 0.82],  // chin
      [x - r * 0.58,  y + r * 0.68],  // left jaw
      [x - r * 0.88,  y + r * 0.08],  // left cheek
      [x - r * 0.82,  y - r * 0.52],  // left temple
    ];
    const sp = rawSp.map(([px, py], i) => {
      const nx = px - x, ny = py - y;
      const len = Math.sqrt(nx * nx + ny * ny) || 1;
      const off = e.deform[i] * dr;
      return [px + (nx / len) * off, py + (ny / len) * off];
    });
    fill(C.COL_BG); stroke(col); strokeWeight(1.5 + phase * 0.5);
    beginShape();
    curveVertex(sp[0][0], sp[0][1]);  // phantom
    for (const [px, py] of sp) curveVertex(px, py);
    curveVertex(sp[0][0], sp[0][1]);  // close
    curveVertex(sp[0][0], sp[0][1]);  // phantom
    endShape();

    // Eye sockets — dark holes punched into skull
    noStroke(); fill(C.COL_BG);
    circle(x - r * 0.35, y - r * 0.15, r * 0.58);
    circle(x + r * 0.35, y - r * 0.15, r * 0.58);

    // Glowing pupils
    drawingContext.globalAlpha = glow;
    noStroke(); fill(col);
    circle(x - r * 0.35, y - r * 0.15, r * 0.36);
    circle(x + r * 0.35, y - r * 0.15, r * 0.36);
    fill('#ffaaaa');
    circle(x - r * 0.35, y - r * 0.15, r * 0.15);
    circle(x + r * 0.35, y - r * 0.15, r * 0.15);
    drawingContext.globalAlpha = 1;

    // Nasal cavity — inverted V
    stroke(col); strokeWeight(1); noFill();
    line(x - r * 0.12, y + r * 0.08, x, y + r * 0.26);
    line(x + r * 0.12, y + r * 0.08, x, y + r * 0.26);

    // Teeth
    stroke(col); strokeWeight(1.5);
    const toothTop = y + r * 0.46;
    const toothLen = r * 0.28;
    const gap      = r * 0.28;
    for (let i = -2; i <= 2; i++) {
      line(x + i * gap, toothTop, x + i * gap, toothTop + toothLen);
    }

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

    const px = player.pos.x, py = player.pos.y, a = player.angle;

    push();
    translate(px, py);
    rotate(a);

    noFill(); stroke(C.COL_PLAYER); strokeWeight(1.5);

    // Body: ellipse wider shoulder-to-shoulder (y) than front-to-back (x)
    ellipse(0, 0, 15, 22);

    // Head: small circle at front, just overlapping the body edge
    circle(10, 0, 8);

    // Gun arm: from right shoulder forward
    stroke(C.COL_AIM_LINE); strokeWeight(2);
    line(2, 10, 22, 10);

    pop();
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

    // Wide-shot ammo counter
    if (p.wideShots > 0) {
      const ax = bx, ay = by + bh + 18;
      noStroke(); fill(C.COL_WIDE_PICKUP); textSize(9); textAlign(LEFT, TOP);
      text('WIDE', ax, ay);
      const bulW = 13, bulH = 6, gap = 3, startX = ax + 32;
      for (let i = 0; i < p.wideShots; i++) {
        noFill(); stroke(C.COL_WIDE_PICKUP); strokeWeight(1.5);
        rect(startX + i * (bulW + gap), ay, bulW, bulH, 1);
      }
    }

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
    text('M: map', 20, C.HEIGHT - 6);
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
    if (G.newHighScore) {
      fill(C.COL_CLEARED); textSize(13);
      text(`HIGH SCORE  —  RANK #${G.newHighScore}`, C.WIDTH / 2, C.HEIGHT / 2 + 30);
    }
    textSize(14); fill(C.COL_HUD_TEXT);
    text('ESC  to return to menu', C.WIDTH / 2, C.HEIGHT / 2 + (G.newHighScore ? 50 : 36));
  },

  // ── Map overlay ───────────────────────────────────────────────────────

  drawMap() {
    if (!G.dungeon) return;
    const allRooms = [...G.dungeon.grid.values()];
    const visited  = allRooms.filter(r => r.visited);
    if (!visited.length) return;

    // Dark overlay
    noStroke(); fill(0, 0, 0, 215);
    rect(0, 0, C.WIDTH, C.HEIGHT);

    // Title
    noStroke(); fill(C.COL_HUD_TITLE);
    textFont('monospace'); textSize(14); textAlign(CENTER, TOP);
    text(G.devFullMap ? '[ MAP  —  DEV: FULL ]' : '[ MAP ]', C.WIDTH / 2, 16);
    fill(C.COL_HUD_TEXT); textSize(10);
    text('M  or  ESC  to close', C.WIDTH / 2, 36);

    // Grid extents — use all rooms if fullmap, else only visited
    const extentRooms = G.devFullMap ? allRooms : visited;
    const gxs = extentRooms.map(r => r.gx), gys = extentRooms.map(r => r.gy);
    const minGx = Math.min(...gxs), maxGx = Math.max(...gxs);
    const minGy = Math.min(...gys), maxGy = Math.max(...gys);

    const cellW = 38, cellH = 28, stepX = 56, stepY = 46;

    // Center map in available area (below title)
    const mapAreaMidY = (55 + C.HEIGHT - 20) / 2;
    const ox = C.WIDTH  / 2 - ((minGx + maxGx) / 2 * stepX + cellW / 2);
    const oy = mapAreaMidY   - ((minGy + maxGy) / 2 * stepY + cellH / 2);

    const TYPE_COL = {
      start:    C.COL_PLAYER,
      ghost:    C.COL_GHOST,
      skeleton: C.COL_SKELETON,
      mixed:    '#ff9922',
      boss:     C.COL_BOSS,
      treasure: C.COL_PICKUP,
    };

    // Fullmap: draw unvisited corridors + rooms first (dim)
    if (G.devFullMap) {
      const unvisited = allRooms.filter(r => !r.visited);
      for (const room of unvisited) {
        const rx = ox + room.gx * stepX, ry = oy + room.gy * stepY;
        if (room.connections.south && !room.connections.south.visited) {
          const nry = oy + room.connections.south.gy * stepY;
          stroke('#252535'); strokeWeight(5);
          line(rx + cellW / 2, ry + cellH, rx + cellW / 2, nry);
        }
        if (room.connections.east && !room.connections.east.visited) {
          const nrx = ox + room.connections.east.gx * stepX;
          stroke('#252535'); strokeWeight(5);
          line(rx + cellW, ry + cellH / 2, nrx, ry + cellH / 2);
        }
      }
      for (const room of unvisited) {
        const rx = ox + room.gx * stepX, ry = oy + room.gy * stepY;
        noStroke(); fill('#0a0a12');
        rect(rx, ry, cellW, cellH, 3);
        noFill(); stroke('#2a2a3a'); strokeWeight(1);
        rect(rx, ry, cellW, cellH, 3);
      }
      // Also draw corridors from visited to unvisited rooms
      for (const room of visited) {
        const rx = ox + room.gx * stepX, ry = oy + room.gy * stepY;
        if (room.connections.south && !room.connections.south.visited) {
          const nry = oy + room.connections.south.gy * stepY;
          stroke('#252535'); strokeWeight(5);
          line(rx + cellW / 2, ry + cellH, rx + cellW / 2, nry);
        }
        if (room.connections.east && !room.connections.east.visited) {
          const nrx = ox + room.connections.east.gx * stepX;
          stroke('#252535'); strokeWeight(5);
          line(rx + cellW, ry + cellH / 2, nrx, ry + cellH / 2);
        }
      }
    }

    // Corridors — draw only south and east to avoid duplicates
    for (const room of visited) {
      const rx = ox + room.gx * stepX, ry = oy + room.gy * stepY;
      if (room.connections.south && room.connections.south.visited) {
        const nry = oy + room.connections.south.gy * stepY;
        stroke('#3a3a5c'); strokeWeight(5);
        line(rx + cellW / 2, ry + cellH, rx + cellW / 2, nry);
      }
      if (room.connections.east && room.connections.east.visited) {
        const nrx = ox + room.connections.east.gx * stepX;
        stroke('#3a3a5c'); strokeWeight(5);
        line(rx + cellW, ry + cellH / 2, nrx, ry + cellH / 2);
      }
    }

    // Unvisited exit stubs (normal map mode only)
    if (!G.devFullMap) {
      const stubLen = 10;
      const stubEdge = { north: [cellW/2, 0, 0, -1], south: [cellW/2, cellH, 0, 1],
                         east:  [cellW, cellH/2, 1, 0], west: [0, cellH/2, -1, 0] };
      for (const room of visited) {
        const rx = ox + room.gx * stepX, ry = oy + room.gy * stepY;
        stroke('#55557a'); strokeWeight(2);
        for (const [dir, [ex, ey, dx, dy]] of Object.entries(stubEdge)) {
          const nb = room.connections[dir];
          if (nb && !nb.visited) {
            line(rx + ex, ry + ey, rx + ex + dx * stubLen, ry + ey + dy * stubLen);
          }
        }
      }
    }

    // Room boxes
    for (const room of visited) {
      const rx = ox + room.gx * stepX, ry = oy + room.gy * stepY;
      const isCurrent = room === G.currentRoom;
      const treasureTaken = room.type === 'treasure' && room.pickupTaken;
      const col = treasureTaken ? C.COL_DOOR_OPEN : (TYPE_COL[room.type] || C.COL_HUD_TEXT);

      // Background fill
      noStroke(); fill('#12121c');
      rect(rx, ry, cellW, cellH, 3);
      if (isCurrent) {
        drawingContext.globalAlpha = 0.28;
        fill(col);
        rect(rx, ry, cellW, cellH, 3);
        drawingContext.globalAlpha = 1;
      }

      // Border
      noFill(); stroke(col);
      strokeWeight(isCurrent ? 2.5 : 1.5);
      rect(rx, ry, cellW, cellH, 3);

      // Type label (center of cell)
      noStroke();
      const label = room.type === 'start'              ? 'START'
                  : room.type === 'boss'               ? 'BOSS'
                  : room.type === 'treasure' && !treasureTaken ? 'TRSR'
                  : room.cleared                       ? ''
                  :                                      '...';
      fill(room.cleared || room.type === 'start' ? col : C.COL_DOOR_CLOSED);
      textFont('monospace'); textSize(8); textAlign(CENTER, CENTER);
      text(label, rx + cellW / 2, ry + cellH / 2);

      // Pulsing player dot on current room
      if (isCurrent) {
        const pulse = 0.55 + 0.45 * Math.sin(G.frame * 0.15);
        drawingContext.globalAlpha = pulse;
        noStroke(); fill('#ffffff');
        circle(rx + 6, ry + 6, 4);
        drawingContext.globalAlpha = 1;
      }
    }

    // Legend (bottom-left)
    const legendItems = [
      { col: C.COL_PLAYER,      label: 'start'    },
      { col: C.COL_GHOST,       label: 'ghost'    },
      { col: C.COL_LUNGE_GHOST, label: 'lunge ghost' },
      { col: C.COL_SKELETON,    label: 'skeleton' },
      { col: C.COL_GHOUL,       label: 'ghoul'    },
      { col: '#ff9922',         label: 'mixed'    },
      { col: C.COL_BOSS,        label: 'boss'     },
      { col: C.COL_PICKUP,      label: 'treasure' },
    ];
    const lx = 14, ly = C.HEIGHT - 14 - legendItems.length * 13;
    noStroke(); fill(C.COL_HUD_TITLE); textSize(9); textAlign(LEFT, TOP); textFont('monospace');
    text('LEGEND', lx, ly);
    for (let i = 0; i < legendItems.length; i++) {
      const { col, label } = legendItems[i];
      const y = ly + 14 + i * 12;
      noStroke(); fill(col); rect(lx, y, 7, 7, 1);
      fill(C.COL_HUD_TEXT); textSize(9); textAlign(LEFT, CENTER);
      text(label, lx + 12, y + 3);
    }
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
    text('ESC  to return to menu', C.WIDTH / 2, C.HEIGHT / 2 + 68);
  },

  // ── Name entry overlay ────────────────────────────────────────────────

  drawNameEntry() {
    const bw = 420, bh = 130;
    const bx = (C.WIDTH  - bw) / 2;
    const by = (C.HEIGHT - bh) / 2;

    // Dim the game world behind the box
    noStroke(); fill(0, 0, 0, 175);
    rect(0, 0, C.WIDTH, C.HEIGHT);

    // Box
    fill('#0d0d18'); stroke(C.COL_HUD_TITLE); strokeWeight(1.5);
    rect(bx, by, bw, bh, 6);

    textFont('monospace'); textAlign(CENTER, TOP);

    // Title
    noStroke(); fill(C.COL_CLEARED); textSize(14);
    text('YOU MADE THE HIGH SCORE TABLE!', C.WIDTH / 2, by + 14);

    fill(C.COL_HUD_TEXT); textSize(11);
    text('Enter your name:', C.WIDTH / 2, by + 36);

    // Input field
    const fw = 280, fh = 28, fx = (C.WIDTH - fw) / 2, fy = by + 54;
    noStroke(); fill('#111122');
    rect(fx, fy, fw, fh, 3);
    stroke(C.COL_HUD_TITLE); strokeWeight(1); noFill();
    rect(fx, fy, fw, fh, 3);

    const cursor = Math.floor(G.frame / 18) % 2 === 0 ? '|' : '';
    noStroke(); fill('#eeeeff'); textSize(14); textAlign(CENTER, CENTER);
    text(G.nameInput + cursor, C.WIDTH / 2, fy + fh / 2);

    // Footer
    noStroke(); fill(C.COL_HUD_TITLE); textSize(10); textAlign(CENTER, TOP);
    text('ENTER  to confirm     ESC  to skip', C.WIDTH / 2, by + bh - 18);
  },

  // ── Dev console overlay ───────────────────────────────────────────────

  drawDevConsole() {
    const dc   = G.devConsole;
    const bh   = 54;
    const by   = C.HEIGHT - bh;
    const pad  = 10;

    // Background
    noStroke(); fill(0, 0, 0, 220);
    rect(0, by, C.WIDTH, bh);
    stroke('#22cc44'); strokeWeight(1);
    line(0, by, C.WIDTH, by);

    textFont('monospace'); textAlign(LEFT, TOP);

    // Output line
    noStroke(); fill('#22cc44'); textSize(11);
    text(dc.output || 'Type "help" for commands', pad, by + 8);

    // Input line with blinking cursor
    const cursor = Math.floor(G.frame / 18) % 2 === 0 ? '_' : '';
    fill('#88ffaa'); textSize(12);
    text(`> ${dc.input}${cursor}`, pad, by + 28);
  },
};
