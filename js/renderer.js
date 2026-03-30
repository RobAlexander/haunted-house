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

    // Screen shake — offset all game-world rendering by a random jitter, then decay
    if (G.screenShake > 0) {
      translate((Math.random() - 0.5) * G.screenShake, (Math.random() - 0.5) * G.screenShake);
      G.screenShake = Math.max(0, G.screenShake - 0.5);
    }

    if (G.state === STATES.ROOM_TRANSITION) {
      this.drawTransition();
      this.drawHUD();
      return;
    }

    this.drawRoom(G.currentRoom);
    this.drawDemonTrail(G.enemies);
    this.drawAshtarothTrail(G.enemies, G.meatLumps);
    this.drawPickup(G.currentRoom);
    this.drawWidePowerup(G.currentRoom);
    this.drawMaxHpPowerup(G.currentRoom);
    this.drawSpeedPowerup(G.currentRoom);
    this.drawInvulnPowerup(G.currentRoom);
    this.drawAutofirePowerup(G.currentRoom);
    this.drawRagSymbol(G.currentRoom);
    this.drawDrops(G.drops);
    this.drawFlies(G.flies);
    this.drawMeatLumps(G.meatLumps);
    this.drawDeathParticles(G.deathParticles);
    this.drawBullets(G.bullets);
    this.drawEnemies(G.enemies);
    this.drawShieldSparks(G.shieldSparks);
    this.drawPlayer(G.player);
    this.drawCrosshair(mx, my);
    this.drawHUD();
    this.drawVignette(G.player);
    this.drawSymbolFlicker();

    if (G.mapOpen)                              { this.drawMap(); }
    if (G.state === STATES.NAME_ENTRY)          this.drawNameEntry();
    if (G.state === STATES.GAME_OVER)           this.drawGameOver();
    if (G.state === STATES.WIN)                 this.drawWin();
    if (G.state === STATES.PAUSED)              this.drawPaused();
    if (G.state === STATES.CYCLE_COMPLETE)      this.drawCycleComplete();
    if (G.devConsole.open)                      this.drawDevConsole();
  },

  // ── Menu ──────────────────────────────────────────────────────────────

  drawMenu() {
    // Title colour: rare signal-glitch states that occasionally intrude.
    // Probabilities are per-frame trigger rates at 60fps; each glitch holds
    // for a short burst of frames before snapping back to normal.
    if (!this._titleGlitch) this._titleGlitch = { col: null, timer: 0 };
    const tg = this._titleGlitch;
    if (tg.timer > 0) {
      tg.timer--;
    } else {
      const r = Math.random();
      if      (r < 0.000035) { tg.col = '#050505'; tg.timer = randInt(2, 5);  } // black       ~once/8min
      else if (r < 0.00013)  { tg.col = '#1c1c1c'; tg.timer = randInt(3, 9);  } // near-black  ~once/3min
      else if (r < 0.00042)  { tg.col = '#55bb77'; tg.timer = randInt(3, 10); } // green       ~once/min
      else if (r < 0.001)    { tg.col = '#909090'; tg.timer = randInt(4, 15); } // grey        ~2×/min
      else                   { tg.col = null; }
    }
    const flicker = Math.sin(G.frame * 0.08) > 0.7;
    const titleCol = tg.col || (flicker ? '#ff88bb' : C.COL_GAMEOVER);
    noStroke();
    fill(titleCol);
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
      const cx = C.WIDTH / 2, ty = C.HEIGHT / 2 + 108;
      noStroke(); fill(C.COL_HUD_TITLE); textSize(10); textAlign(CENTER, TOP);
      text('─── HIGH SCORES ───', cx, ty);
      const lx = cx - 118;
      textSize(11); textAlign(LEFT, TOP);
      for (let i = 0; i < scores.length; i++) {
        const { score, floor, name } = scores[i];
        const isNew  = G.newHighScore === i + 1;
        const label  = (name || 'unknown').padEnd(12).slice(0, 12);
        fill(isNew ? C.COL_CLEARED : C.COL_HUD_TEXT);
        text(`#${i + 1}  ${label}  ${String(score).padStart(6)}  floor ${floor}`, lx, ty + 16 + i * 16);
      }
    }
  },

  // ── Room ──────────────────────────────────────────────────────────────

  drawRoom(room) {
    if (!room) return;
    const P = C.ROOM_PADDING, W = C.WIDTH, H = C.HEIGHT;

    // Start room trapdoor — player emerged from here
    if (room.type === 'start') {
      const tx = W/2, ty = H/2, tw = 72, th = 56;
      const x0 = tx - tw/2, y0 = ty - th/2;
      // Floor panel
      fill('#18110a'); stroke('#7a5a32'); strokeWeight(1.5);
      rect(x0, y0, tw, th);
      // Plank dividers
      stroke('#7a5a32'); strokeWeight(1);
      line(x0+1, y0 + th/3,   x0+tw-1, y0 + th/3);
      line(x0+1, y0 + 2*th/3, x0+tw-1, y0 + 2*th/3);
      // Wood grain — short horizontal nicks on each plank
      strokeWeight(0.5);
      const grainY = [th/6, th/2, 5*th/6];
      for (const gy of grainY) {
        line(x0+8,    y0+gy-2, x0+20,    y0+gy-2);
        line(x0+tw-20, y0+gy+2, x0+tw-9, y0+gy+2);
      }
      // Hinges — two small brackets on top edge
      fill('#2a1e10'); stroke('#aa7840'); strokeWeight(1);
      rect(x0+10, y0-4, 11, 8, 1);
      rect(x0+tw-21, y0-4, 11, 8, 1);
      // Pull ring at bottom centre
      noFill(); stroke('#7a5a32'); strokeWeight(1.5);
      ellipse(tx, y0+th-9, 14, 9);
    }

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

    // Walls with door gaps (stairwell treated as a pseudo-connection)
    const _sw = dir => room.stairwell === dir ? { type: 'stairwell' } : null;
    stroke(C.COL_WALL); strokeWeight(2);
    this._drawWall(P, P,   W-P, P,   true,  room.connections.north || _sw('north'), room, 0,  -10);
    this._drawWall(P, H-P, W-P, H-P, true,  room.connections.south || _sw('south'), room, 0,   10);
    this._drawWall(W-P, P, W-P, H-P, false, room.connections.east  || _sw('east'),  room, 10,   0);
    this._drawWall(P,   P, P,   H-P, false, room.connections.west  || _sw('west'),  room, -10,  0);

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
      // Room not yet cleared — door is closed; boss connections shown in boss colour
      const isBoss = connection.type === 'boss';
      stroke(isBoss ? C.COL_BOSS : C.COL_DOOR_CLOSED); strokeWeight(2);
      if (isHoriz) line(mid - DH, y1, mid + DH, y1);
      else         line(x1, mid - DH, x1, mid + DH);
      if (isBoss) {
        noStroke(); fill(C.COL_BOSS); textSize(9); textAlign(CENTER, CENTER);
        if (isHoriz) text('BOSS', mid, y1 + tickDy * 2.5);
        else         text('BOSS', x1 + tickDx * 2.5, mid);
      }
    } else if (connection.type === 'boss' && !ragAllCollected()) {
      // Boss door — symbol-locked. Show as sealed with boss colour + padlock + RAG status.
      stroke(C.COL_BOSS); strokeWeight(2);
      if (isHoriz) line(mid - DH, y1, mid + DH, y1);
      else         line(x1, mid - DH, x1, mid + DH);
      this._drawPadlock(isHoriz ? mid : x1, isHoriz ? y1 : mid, tickDx, tickDy, C.COL_BOSS);
      noStroke(); fill(C.COL_BOSS); textSize(9); textAlign(CENTER, CENTER);
      if (isHoriz) {
        text('BOSS', mid, y1 + tickDy * 2.5);
        const rc = G.ragCollected;
        const sym = getFloorSymbols(G.floor).map(l => rc[l] ? l : '·').join(' ');
        fill(C.COL_RAG_SYMBOL); textSize(8);
        text(sym, mid, y1 + tickDy * 5.5);
      } else {
        text('BOSS', x1 + tickDx * 2.5, mid);
        const rc = G.ragCollected;
        const sym = getFloorSymbols(G.floor).map(l => rc[l] ? l : '·').join(' ');
        fill(C.COL_RAG_SYMBOL); textSize(8);
        text(sym, x1 + tickDx * 2.5, mid + tickDy * 9 + (tickDx > 0 ? 12 : -12));
      }
    } else if (connection.type === 'stairwell') {
      // Stairwell: converging step lines suggesting stairs receding into wall
      const sDir = Math.sign(tickDy || tickDx);
      stroke(C.COL_WIN); strokeWeight(1.5);
      for (let i = 0; i < 5; i++) {
        const len = DH * (1 - (i + 1) * 0.13);
        const off = (i + 1) * 7 * sDir;
        if (isHoriz) line(mid - len, y1 + off, mid + len, y1 + off);
        else         line(x1 + off, mid - len, x1 + off, mid + len);
      }
      // Side rails converging inward
      strokeWeight(1); drawingContext.globalAlpha = 0.55;
      if (isHoriz) {
        line(mid - DH, y1, mid - DH * 0.35, y1 + 35 * sDir);
        line(mid + DH, y1, mid + DH * 0.35, y1 + 35 * sDir);
      } else {
        line(x1, mid - DH, x1 + 35 * sDir, mid - DH * 0.35);
        line(x1, mid + DH, x1 + 35 * sDir, mid + DH * 0.35);
      }
      drawingContext.globalAlpha = 1;
      noStroke(); fill(C.COL_WIN); textSize(9); textAlign(CENTER, CENTER);
      if (isHoriz) text('NEXT FLOOR', mid, y1 + tickDy * 2.5);
      else         text('NEXT FLOOR', x1 + tickDx * 2.5, mid);
    } else {
      // Open: tick marks
      const doorCol = connection.type === 'boss' ? C.COL_BOSS : C.COL_DOOR_OPEN;
      stroke(doorCol); strokeWeight(1.5);
      if (isHoriz) {
        line(mid-DH, y1, mid-DH+tickDx, y1+tickDy);
        line(mid+DH, y1, mid+DH+tickDx, y1+tickDy);
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

  _drawPadlock(cx, cy, dx, dy, col) {
    const ox = dx !== 0 ? dx * 14 : 0;
    const oy = dy !== 0 ? dy * 14 : 0;
    stroke(col || C.COL_GAMEOVER); strokeWeight(1);
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
    text('POWER SHOT', p.x, p.y + 20);
  },

  drawMaxHpPowerup(room) {
    if (!room || !room.maxhpPowerupActive || room.maxhpPowerupTaken) return;
    const p = room.maxhpPowerup;
    const pulse = 0.65 + 0.35 * Math.sin(G.frame * 0.09);
    drawingContext.globalAlpha = pulse;
    noFill(); stroke(C.COL_MAXHP_PICKUP); strokeWeight(2);
    beginShape();
    vertex(p.x,      p.y - 17);
    vertex(p.x + 11, p.y);
    vertex(p.x,      p.y + 17);
    vertex(p.x - 11, p.y);
    endShape(CLOSE);
    strokeWeight(1);
    beginShape();
    vertex(p.x,     p.y - 9);
    vertex(p.x + 6, p.y);
    vertex(p.x,     p.y + 9);
    vertex(p.x - 6, p.y);
    endShape(CLOSE);
    drawingContext.globalAlpha = 1;
    noStroke(); fill(C.COL_MAXHP_PICKUP); textFont('monospace'); textSize(9); textAlign(CENTER, CENTER);
    text('MAX HP', p.x, p.y + 26);
  },

  drawSpeedPowerup(room) {
    if (!room || !room.speedPowerupActive || room.speedPowerupTaken) return;
    const p     = room.speedPowerup;
    const pulse = 0.65 + 0.35 * Math.sin(G.frame * 0.15);
    drawingContext.globalAlpha = pulse;
    noFill(); stroke(C.COL_SPEED_PICKUP); strokeWeight(2);
    // Chevron arrow shape — suggests speed
    const hw = 14, hh = 7;
    line(p.x - hw, p.y - hh, p.x, p.y);
    line(p.x, p.y, p.x - hw, p.y + hh);
    line(p.x - hw + 9, p.y - hh, p.x + 9, p.y);
    line(p.x + 9, p.y, p.x - hw + 9, p.y + hh);
    drawingContext.globalAlpha = 1;
    noStroke(); fill(C.COL_SPEED_PICKUP); textFont('monospace'); textSize(9); textAlign(CENTER, CENTER);
    text('SPEED', p.x, p.y + 22);
  },

  drawInvulnPowerup(room) {
    if (!room || !room.invulnPowerupActive || room.invulnPowerupTaken) return;
    const p     = room.invulnPowerup;
    const pulse = 0.65 + 0.35 * Math.sin(G.frame * 0.08);
    drawingContext.globalAlpha = pulse;
    noFill(); stroke(C.COL_INVULN_PICKUP); strokeWeight(2);
    // Shield shape — hexagonal outline
    for (let i = 0; i < 6; i++) {
      const a1 = (Math.PI / 3) * i - Math.PI / 2;
      const a2 = (Math.PI / 3) * (i + 1) - Math.PI / 2;
      line(p.x + Math.cos(a1) * 14, p.y + Math.sin(a1) * 14,
           p.x + Math.cos(a2) * 14, p.y + Math.sin(a2) * 14);
    }
    strokeWeight(1);
    circle(p.x, p.y, 16);
    drawingContext.globalAlpha = 1;
    noStroke(); fill(C.COL_INVULN_PICKUP); textFont('monospace'); textSize(9); textAlign(CENTER, CENTER);
    text('INVUL', p.x, p.y + 24);
  },

  drawAutofirePowerup(room) {
    if (!room || !room.autofirePowerupActive || room.autofirePowerupTaken) return;
    const p     = room.autofirePowerup;
    const pulse = 0.65 + 0.35 * Math.sin(G.frame * 0.14);
    drawingContext.globalAlpha = pulse;
    noFill(); stroke(C.COL_AUTOFIRE_PICKUP); strokeWeight(2);
    // Three stacked horizontal bullet lines — rapid-fire symbol
    for (let i = -1; i <= 1; i++) {
      const yy = p.y + i * 6;
      line(p.x - 14, yy, p.x + 14, yy);
      // Arrowhead at right end
      line(p.x + 14, yy, p.x + 10, yy - 3);
      line(p.x + 14, yy, p.x + 10, yy + 3);
    }
    drawingContext.globalAlpha = 1;
    noStroke(); fill(C.COL_AUTOFIRE_PICKUP); textFont('monospace'); textSize(9); textAlign(CENTER, CENTER);
    text('AUTOFIRE', p.x, p.y + 22);
  },

  drawDemonTrail(enemies) {
    if (!enemies) return;
    noStroke();
    for (const e of enemies) {
      if (!e.alive || e.type !== 'demon' || !e.trailParticles) continue;
      for (const tp of e.trailParticles) {
        const frac = tp.life / tp.maxLife;
        // Fade in first 15%, hold, fade out last 40%
        const alpha = frac > 0.85 ? (1 - frac) / 0.15 * 0.35
                    : frac < 0.40 ? (frac  / 0.40) * 0.35
                    :                0.35;
        drawingContext.globalAlpha = alpha;
        fill(C.COL_FLY);
        circle(tp.x, tp.y, tp.size * 2);
      }
    }
    drawingContext.globalAlpha = 1;
  },

  drawSymbolFlicker() {
    const sf = G.symbolFlicker;
    if (!sf || sf.timer <= 0) return;
    const t     = sf.timer / C.SYMBOL_FLICKER_DURATION;
    // Pulse 3 times during the flicker window using a triangle wave
    const pulse = Math.abs(Math.sin(t * Math.PI * 3));
    drawingContext.globalAlpha = pulse * 0.22;
    noStroke(); fill(sf.col);
    rect(0, 0, C.WIDTH, C.HEIGHT);
    drawingContext.globalAlpha = 1;
  },

  drawRagSymbol(room) {
    if (!room || !room.ragSymbol || room.ragSymbol.collected) return;
    const s    = room.ragSymbol;
    const SC   = 18;
    const segs = SYMBOL_GLYPHS[s.letter];
    const pulse = 0.72 + 0.28 * Math.sin(G.frame * 0.07);

    noFill();

    // Ghost scatter copies — three slightly offset, low alpha
    drawingContext.globalAlpha = 0.18 * pulse;
    stroke(C.COL_RAG_SYMBOL); strokeWeight(1.5);
    for (const [gx, gy] of [[3,-2],[-3,1],[1,3]]) {
      for (let i = 0; i < segs.length; i++) {
        const [bx1,by1,bx2,by2] = segs[i];
        const [j0,j1,j2,j3] = s.segJitter[i];
        line(s.x + bx1*SC + j0 + gx, s.y + by1*SC + j1 + gy,
             s.x + bx2*SC + j2 + gx, s.y + by2*SC + j3 + gy);
      }
    }

    // Main glyph — full brightness, thicker strokes
    drawingContext.globalAlpha = pulse;
    stroke(C.COL_RAG_SYMBOL); strokeWeight(2.5);
    for (let i = 0; i < segs.length; i++) {
      const [bx1,by1,bx2,by2] = segs[i];
      const [j0,j1,j2,j3] = s.segJitter[i];
      line(s.x + bx1*SC + j0, s.y + by1*SC + j1,
           s.x + bx2*SC + j2, s.y + by2*SC + j3);
    }

    drawingContext.globalAlpha = 1;
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
      if (e.shielded) this._drawEnemyShield(e);
      if (e.type === 'ghost')    this._drawGhost(e);
      if (e.type === 'skull')       this._drawSkull(e);
      if (e.type === 'white_skull') this._drawWhiteSkull(e);
      if (e.type === 'boss')        this._drawBoss(e);
      if (e.type === 'ghoul_boss')  this._drawGhoulBoss(e);
      if (e.type === 'ghoul')       this._drawGhoul(e);
      if (e.type === 'long_ghoul')  this._drawLongGhoul(e);
      if (e.type === 'demon')  this._drawDemon(e);
      if (e.type === 'mummy')           this._drawMummy(e);
      if (e.type === 'mummy_boss')      this._drawMummyBoss(e);
      if (e.type === 'ashtaroth_boss')  this._drawAshtarothBoss(e);
    }
  },

  drawFlies(flies) {
    if (!flies || flies.length === 0) return;
    for (const f of flies) {
      if (!f.alive) continue;
      const x = f.pos.x, y = f.pos.y;
      // Body dot
      noStroke(); fill(C.COL_FLY);
      circle(x, y, f.radius * 2);
      // Wings — two small arcs either side
      const ws = 0.7 + 0.3 * Math.abs(Math.sin(f.wingPhase));
      stroke(C.COL_FLY); strokeWeight(0.7); noFill();
      arc(x - 3, y - 1, 6 * ws, 4 * ws, -Math.PI, 0);
      arc(x + 3, y - 1, 6 * ws, 4 * ws, -Math.PI, 0);
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

  _drawSkull(e) {
    const x = e.pos.x, y = e.pos.y;
    const d  = e.deform;   // [leftEyeX, rightEyeX, jawY, toothSpread, _]
    const cy = y - 1;

    // Irregular head outline using pre-computed per-instance vertex offsets
    noFill(); stroke(C.COL_SKULL); strokeWeight(1.5);
    const hp = e.headPts;
    const n  = hp.length;
    beginShape();
    curveVertex(x + hp[n-1][0], cy + hp[n-1][1]);
    for (const [ox, oy] of hp) curveVertex(x + ox, cy + oy);
    curveVertex(x + hp[0][0], cy + hp[0][1]);
    curveVertex(x + hp[1][0], cy + hp[1][1]);
    endShape(CLOSE);

    // Eye sockets
    const lex = x - 5 + d[0] * 1.5, rex = x + 5 + d[1] * 1.5, ey = cy - 4;
    noStroke(); fill(C.COL_BG);
    circle(lex, ey, 7);
    circle(rex, ey, 7);

    const glow = 0.55 + 0.45 * Math.sin(G.frame * 0.09 + x * 0.02);
    drawingContext.globalAlpha = glow;
    fill(C.COL_SKULL);
    circle(lex, ey, 3.5);
    circle(rex, ey, 3.5);
    drawingContext.globalAlpha = 1;

    // Teeth
    noFill(); stroke(C.COL_SKULL); strokeWeight(1.5);
    const ty = cy + 6 + d[2] * 1.5;
    const ts = 5 + d[3];
    for (let i = -1; i <= 1; i++) {
      line(x + i * ts, ty, x + i * ts, ty + 4);
    }

    this._drawEnemyHP(e, x, y - 18);
  },

  _drawWhiteSkull(e) {
    const x = e.pos.x, y = e.pos.y;
    const d  = e.deform;
    const cy = y - 1;
    const col = C.COL_WHITE_SKULL;

    // Faint outer glow ring
    const glowA = 0.12 + 0.10 * Math.sin(G.frame * 0.07 + x * 0.03);
    drawingContext.globalAlpha = glowA;
    noStroke(); fill(col);
    circle(x, cy, (e.radius + 8) * 2);
    drawingContext.globalAlpha = 1;

    // Irregular head outline
    noFill(); stroke(col); strokeWeight(1.8);
    const hp = e.headPts, n = hp.length;
    beginShape();
    curveVertex(x + hp[n-1][0], cy + hp[n-1][1]);
    for (const [ox, oy] of hp) curveVertex(x + ox, cy + oy);
    curveVertex(x + hp[0][0], cy + hp[0][1]);
    curveVertex(x + hp[1][0], cy + hp[1][1]);
    endShape(CLOSE);

    // Eye sockets — pale blue-white pupils
    const lex = x - 5 + d[0] * 1.5, rex = x + 5 + d[1] * 1.5, ey = cy - 4;
    noStroke(); fill(C.COL_BG);
    circle(lex, ey, 7); circle(rex, ey, 7);
    const glow = 0.7 + 0.3 * Math.sin(G.frame * 0.12 + x * 0.02);
    drawingContext.globalAlpha = glow;
    fill(col);
    circle(lex, ey, 4); circle(rex, ey, 4);
    drawingContext.globalAlpha = 1;

    // Teeth
    noFill(); stroke(col); strokeWeight(1.5);
    const ty = cy + 6 + d[2] * 1.5;
    const ts = 5 + d[3];
    for (let i = -1; i <= 1; i++) {
      line(x + i * ts, ty, x + i * ts, ty + 4);
    }

    this._drawEnemyHP(e, x, y - 18);
  },

  _drawGhoul(e) {
    const x = e.pos.x, y = e.pos.y, r = e.radius;
    const p   = e.crawlPhase;
    const col = C.COL_GHOUL;

    // Irregular body outline using pre-computed per-instance vertex offsets
    noFill(); stroke(col); strokeWeight(1.5);
    const bp = e.bodyPts, bn = bp.length;
    beginShape();
    curveVertex(x + bp[bn-1][0]*r, y + bp[bn-1][1]*r);
    for (const [ox, oy] of bp) curveVertex(x + ox*r, y + oy*r);
    curveVertex(x + bp[0][0]*r, y + bp[0][1]*r);
    curveVertex(x + bp[1][0]*r, y + bp[1][1]*r);
    endShape(CLOSE);

    // Jointed legs — each leg's structure is unique per instance
    const animSigns = [1, -1, 1, -1];
    strokeWeight(1.5);
    for (let i = 0; i < 4; i++) {
      const leg  = e.legs[i];
      const anim = animSigns[i] * Math.sin(p) * 0.25;
      let dir = leg.dir + anim;
      let cx  = x + Math.cos(dir) * r * 1.05;
      let cy  = y + Math.sin(dir) * r * 0.7;
      for (let k = 0; k < leg.segLens.length; k++) {
        if (k > 0) dir += leg.bends[k - 1];
        const nx = cx + Math.cos(dir) * leg.segLens[k];
        const ny = cy + Math.sin(dir) * leg.segLens[k];
        line(cx, cy, nx, ny);
        if (k < leg.bends.length) {
          strokeWeight(3); point(nx, ny); strokeWeight(1.5);
        }
        cx = nx; cy = ny;
      }
    }

    // Eyes — spacing per-instance; brighter when leaping
    const eyeAlpha = e.leaping ? 1.0 : 0.65;
    drawingContext.globalAlpha = eyeAlpha;
    noStroke(); fill(col);
    circle(x - e.eyeOff, y - 2, 5);
    circle(x + e.eyeOff, y - 2, 5);
    drawingContext.globalAlpha = 1;

    this._drawEnemyHP(e, x, y - r - 8);
  },

  _drawGhoulBoss(e) {
    const x = e.pos.x, y = e.pos.y, r = e.radius;
    const p   = e.crawlPhase;
    const transitioning = e.transitionTimer > 0;
    const windup = e.windupTimer > 0;
    // Windup crouches: squash y, stretch x. Frac goes 0→1 over the windup window.
    const windupFrac = windup ? 1 - e.windupTimer / e._windupFrames : 0;
    const scaleX = windup ? 1 + windupFrac * 0.55 : 1;  // widen up to 1.55×
    const scaleY = windup ? 1 - windupFrac * 0.45 : 1;  // squash down to 0.55×

    const col = transitioning ? '#ffee00' : windup ? '#ff2222' : C.COL_GHOUL_BOSS;

    // Phase / windup glow ring
    const phaseCol = windup ? '#ff0000'
                   : e.phase === 3 ? '#ff3333'
                   : e.phase === 2 ? '#ff7744' : '#aa4455';
    const ringAlpha = windup ? 0.45 + 0.35 * Math.sin(G.frame * 0.35)
                             : transitioning ? 0.5
                             : 0.22 + 0.12 * Math.sin(G.frame * 0.09);
    drawingContext.globalAlpha = ringAlpha;
    noFill(); stroke(transitioning ? '#ffee00' : phaseCol);
    strokeWeight(windup ? 6 : 5);
    circle(x, y, (r + 14) * 2);
    drawingContext.globalAlpha = 1;

    // Body — squash/stretch applied via scale transform during windup
    push();
    translate(x, y);
    scale(scaleX, scaleY);
    noFill(); stroke(col); strokeWeight(2);
    const bp = e.bodyPts, bn = bp.length;
    beginShape();
    curveVertex(bp[bn-1][0]*r, bp[bn-1][1]*r);
    for (const [ox, oy] of bp) curveVertex(ox*r, oy*r);
    curveVertex(bp[0][0]*r, bp[0][1]*r);
    curveVertex(bp[1][0]*r, bp[1][1]*r);
    endShape(CLOSE);
    pop();

    // 4 jointed legs — tucked in during windup (shorter effective length)
    const legScale = windup ? 0.55 + 0.45 * (1 - windupFrac) : 1;
    strokeWeight(2); stroke(col);
    const animSigns = [1, -1, 1, -1];
    for (let i = 0; i < 4; i++) {
      const leg  = e.legs[i];
      const anim = animSigns[i] * Math.sin(p) * 0.3;
      let dir = leg.dir + anim;
      let cx  = x + Math.cos(dir) * r * 1.05;
      let cy  = y + Math.sin(dir) * r * 0.7;
      for (let k = 0; k < leg.segLens.length; k++) {
        if (k > 0) dir += leg.bends[k - 1];
        const nx = cx + Math.cos(dir) * leg.segLens[k] * legScale;
        const ny = cy + Math.sin(dir) * leg.segLens[k] * legScale;
        line(cx, cy, nx, ny);
        if (k < leg.bends.length) {
          strokeWeight(4); point(nx, ny); strokeWeight(2);
        }
        cx = nx; cy = ny;
      }
    }

    // Eyes — blaze during windup and leap
    const eyeCol  = (transitioning) ? '#ffee00'
                  : (windup || e.leaping) ? '#ff0000' : '#ff3355';
    const eyeSize = windup ? 8 + windupFrac * 5 : 8;   // eyes widen during windup
    const eyeAlpha = (windup || e.leaping) ? 1.0 : 0.8;
    drawingContext.globalAlpha = eyeAlpha;
    noStroke(); fill(eyeCol);
    circle(x - e.eyeOff, y - 3, eyeSize);
    circle(x + e.eyeOff, y - 3, eyeSize);
    drawingContext.globalAlpha = 1;

    if (!e.arriving) this._drawBossHP(e, C.COL_GHOUL_BOSS);
  },

  _drawLongGhoul(e) {
    const x = e.pos.x, y = e.pos.y, r = e.radius;
    const p   = e.crawlPhase;
    const col = C.COL_LONG_GHOUL;

    // Scrunched irregular body — bodyPts encode compressed y in constructor
    noFill(); stroke(col); strokeWeight(1.5);
    const bp = e.bodyPts, bn = bp.length;
    beginShape();
    curveVertex(x + bp[bn-1][0]*r, y + bp[bn-1][1]*r);
    for (const [ox, oy] of bp) curveVertex(x + ox*r, y + oy*r);
    curveVertex(x + bp[0][0]*r, y + bp[0][1]*r);
    curveVertex(x + bp[1][0]*r, y + bp[1][1]*r);
    endShape(CLOSE);

    // 5 jointed legs — last one (index 4) is always longer
    strokeWeight(1.5);
    for (let i = 0; i < e.legs.length; i++) {
      const leg  = e.legs[i];
      const anim = (i % 2 === 0 ? 1 : -1) * Math.sin(p) * 0.25;
      let dir = leg.dir + anim;
      let cx  = x + Math.cos(dir) * r * 1.05;
      let cy  = y + Math.sin(dir) * r * 0.7;
      for (let k = 0; k < leg.segLens.length; k++) {
        if (k > 0) dir += leg.bends[k - 1];
        const nx = cx + Math.cos(dir) * leg.segLens[k];
        const ny = cy + Math.sin(dir) * leg.segLens[k];
        line(cx, cy, nx, ny);
        if (k < leg.bends.length) {
          strokeWeight(3); point(nx, ny); strokeWeight(1.5);
        }
        cx = nx; cy = ny;
      }
    }

    // Eyes — brighter when leaping
    const eyeAlpha = e.leaping ? 1.0 : 0.65;
    drawingContext.globalAlpha = eyeAlpha;
    noStroke(); fill(col);
    circle(x - e.eyeOff, y - 2, 5);
    circle(x + e.eyeOff, y - 2, 5);
    drawingContext.globalAlpha = 1;

    this._drawEnemyHP(e, x, y - r - 8);
  },

  _drawDemon(e) {
    const x = e.pos.x, y = e.pos.y;
    const col  = C.COL_DEMON;
    const vein = C.COL_DEMON_VEIN;
    const hw = 22, hh = 11;   // horse body half-width, half-height

    // Toxic breath cloud — green wisps drifting through the aura zone
    noStroke();
    for (const p of e.breathParticles) {
      const frac = p.life / p.maxLife;
      // Fade in first ~20% of life, hold, fade out last ~40%
      const alpha = frac > 0.8 ? (1 - frac) / 0.2 * 0.45
                  : frac < 0.4 ? (frac / 0.4) * 0.45
                  :               0.45;
      drawingContext.globalAlpha = alpha;
      fill(C.COL_FLY);
      circle(p.x, p.y, p.size * 2);
    }
    drawingContext.globalAlpha = 1;

    // Horse body — horizontal ellipse
    noFill(); stroke(col); strokeWeight(1.5);
    ellipse(x, y, hw * 2, hh * 2);

    // Sinew / muscle lines within the horse body (exposed anatomy detail)
    stroke(vein); strokeWeight(0.75);
    for (const [x1f, y1f, x2f, y2f] of e.sinewLines) {
      line(x + x1f * hw, y + y1f * hh, x + x2f * hw, y + y2f * hh);
    }

    // Rider — merged at horse back (top of ellipse), grows upward
    const rBase = y - hh;      // where rider meets horse
    const rTop  = rBase - 22;  // shoulder height
    stroke(col); strokeWeight(1.5);
    // Torso sides
    line(x - 8, rBase, x - 6, rTop);
    line(x + 8, rBase, x + 6, rTop);
    // Torso bottom connecting line
    line(x - 8, rBase, x + 8, rBase);
    // Internal cross-sinews on torso
    stroke(vein); strokeWeight(0.7);
    line(x - 7, rBase - 3, x + 6, rTop + 5);
    line(x + 7, rBase - 3, x - 6, rTop + 5);

    // Grotesquely long arms hanging below horse body level
    stroke(col); strokeWeight(1.5);
    line(x - 6, rTop, x - hw + 2, y + e.armDrop[0]);
    line(x + 6, rTop, x + hw - 2, y + e.armDrop[1]);

    // Head — very large circle, slightly offset (the folklore head is huge)
    const headR = 10;
    const headX = x - 2, headY = rTop - headR - 1;
    noFill(); stroke(col); strokeWeight(1.5);
    circle(headX, headY, headR * 2);
    // Snout line (pig-like snout in folklore)
    line(headX - 4, headY + 3, headX + 4, headY + 3);

    // Single massive eye — the defining feature; pulsing
    const eyePulse = 0.72 + 0.28 * Math.abs(Math.sin(G.frame * 0.07));
    drawingContext.globalAlpha = eyePulse;
    noStroke(); fill(vein);
    ellipse(headX + 1, headY - 1, e.eyeSize * 1.9, e.eyeSize * 1.2);
    fill('#1a0505');
    ellipse(headX + 1, headY - 1, e.eyeSize * 0.75, e.eyeSize * 0.45);
    drawingContext.globalAlpha = 1;

    this._drawEnemyHP(e, x, y - hh - headR * 2 - 14);
  },

  _drawMummyBody(x, ry, col, scale, mouthOpen, deform) {
    const d = deform || [0, 0, 0, 0, 0, 0];
    // Body — slightly deformed quad, bandage-wrapped
    const bw = (11 + d[0] * 1.5) * scale, bh = 30 * scale;
    const bodyT = ry - 20 * scale, bodyB = bodyT + bh;
    noFill(); stroke(col); strokeWeight(1.5);
    beginShape();
    vertex(x - bw + d[1] * 1.5 * scale, bodyT + d[2] * 1.5 * scale);
    vertex(x + bw + d[3] * 1.5 * scale, bodyT + d[4] * 1.5 * scale);
    vertex(x + bw + d[5] * 1.2 * scale, bodyB);
    vertex(x - bw - d[2] * 1.2 * scale, bodyB);
    endShape(CLOSE);
    // Horizontal bandage strips on body
    strokeWeight(0.7);
    for (let i = 1; i < 4; i++) {
      const by2 = bodyT + i * 7 * scale;
      line(x - bw, by2, x + bw, by2);
    }
    // Head — slightly deformed quad
    const hw = (9 + d[1] * 1.2) * scale, hh = (15 + d[0] * 1.0) * scale;
    const headT = ry - 38 * scale;
    strokeWeight(1.5);
    beginShape();
    vertex(x - hw + d[2] * 1.2 * scale, headT + d[3] * 1.0 * scale);
    vertex(x + hw + d[4] * 1.2 * scale, headT + d[5] * 1.0 * scale);
    vertex(x + hw - d[0] * 1.0 * scale, headT + hh);
    vertex(x - hw + d[1] * 1.0 * scale, headT + hh);
    endShape(CLOSE);
    // Bandage cross on head
    strokeWeight(0.7);
    line(x - hw, ry - 31 * scale, x + hw, ry - 31 * scale);
    // Mouth — opens when flies released
    if (mouthOpen > 0) {
      const mo = Math.min(1, mouthOpen / 15);
      strokeWeight(1); stroke(C.COL_FLY);
      const mw = 5 * scale * mo, mhh = 3 * scale * mo;
      rect(x - mw, ry - 26 * scale, mw * 2, mhh, 1);
    }
    // Arms — raised, undead pose with per-instance jitter on elbow/wrist
    stroke(col); strokeWeight(1.5);
    const sw = Math.sin(G.frame * 0.03) * 1.5;
    const lEx = x - 22 * scale + d[3] * 1.5 * scale;
    const lEy = ry - 12 * scale + sw + d[4] * 1.5 * scale;
    const rEx = x + 22 * scale + d[5] * 1.5 * scale;
    const rEy = ry - 12 * scale - sw + d[0] * 1.5 * scale;
    line(x - bw, ry - 14 * scale, lEx, lEy);
    line(lEx, lEy, lEx - 4 * scale + d[1] * 1.5 * scale, ry - 5 * scale + sw);
    line(x + bw, ry - 14 * scale, rEx, rEy);
    line(rEx, rEy, rEx + 4 * scale + d[2] * 1.5 * scale, ry - 5 * scale - sw);
  },

  _drawMummy(e) {
    const x = e.pos.x, y = e.pos.y, col = C.COL_MUMMY;
    const riseFrac  = e.rising ? 1 - e.riseTimer / C.MUMMY_RISE_FRAMES : 1;
    const riseShift = e.rising ? (1 - riseFrac) * 44 : 0;
    const ry = y + riseShift;

    // Alpha: fades in during rising, full after
    drawingContext.globalAlpha = 0.15 + 0.85 * riseFrac;

    this._drawMummyBody(x, ry, col, 1.0, e.mouthOpen, e.deform);

    // Eyes — green glow, brighter after risen
    noStroke(); fill(C.COL_FLY);
    const eyeA = e.rising ? riseFrac : 1.0;
    drawingContext.globalAlpha = eyeA;
    circle(x - 4, ry - 31, 4);
    circle(x + 4, ry - 31, 4);
    drawingContext.globalAlpha = 1;

    // Ground cracks at feet during rising
    if (e.rising && riseFrac > 0.05) {
      const crackPulse = 0.4 + 0.4 * Math.sin(G.frame * 0.15);
      drawingContext.globalAlpha = crackPulse * riseFrac;
      noFill(); stroke(col); strokeWeight(1);
      for (let i = 0; i < 7; i++) {
        const a = (Math.PI * 2 / 7) * i;
        const r1 = 8, r2 = 14 + (i % 2) * 5;
        line(x + Math.cos(a)*r1, (y+8) + Math.sin(a)*r1*0.35,
             x + Math.cos(a)*r2, (y+8) + Math.sin(a)*r2*0.35);
      }
      drawingContext.globalAlpha = 1;
    }

    // Bar fully above head (head top = ry - 38, bar height = 4, gap = 4)
    if (!e.rising) this._drawEnemyHP(e, x, y - 46);
  },

  _drawMummyBoss(e) {
    const x = e.pos.x, y = e.pos.y, col = C.COL_MUMMY_BOSS;
    const riseFrac  = e.rising ? 1 - e.riseTimer / (C.MUMMY_RISE_FRAMES + 60) : 1;
    const riseShift = e.rising ? (1 - riseFrac) * 56 : 0;
    const ry = y + riseShift;
    const sc = 1.65; // scale factor vs normal mummy

    // Shared silhouette polygon — used for both the phase halo and invuln shield.
    // pad controls how far beyond the body the polygon extends.
    const _silPoly = (pad) => {
      const hW  =  9 * sc + pad;
      const aW  = 26 * sc + pad;
      const bW  = 11 * sc + pad;
      const htY = ry - 38 * sc - pad;
      const nkY = ry - 23 * sc;
      const asY = ry - 14 * sc;
      const atY = ry -  5 * sc + pad;
      const bbY = ry + 10 * sc + pad;
      beginShape();
      vertex(x - hW, htY); vertex(x + hW, htY);
      vertex(x + hW, nkY); vertex(x + aW, asY);
      vertex(x + aW, atY); vertex(x + bW, atY);
      vertex(x + bW, bbY); vertex(x - bW, bbY);
      vertex(x - bW, atY); vertex(x - aW, atY);
      vertex(x - aW, asY); vertex(x - hW, nkY);
      endShape(CLOSE);
    };

    // Phase transition invulnerability glow (yellow)
    if (e.transitionTimer > 0) {
      const tf    = e.transitionTimer / C.BOSS_PHASE_TRANSITION_FRAMES;
      const pulse = 0.5 + 0.5 * Math.sin(G.frame * 0.25);
      drawingContext.globalAlpha = tf * (0.35 + 0.3 * pulse);
      noStroke(); fill('#ffee00'); _silPoly(15);
      drawingContext.globalAlpha = tf * (0.7 + 0.3 * pulse);
      noFill(); stroke('#ffee00'); strokeWeight(2.5); _silPoly(15);
      drawingContext.globalAlpha = 1;
    }

    // Phase halo — same silhouette shape, dim mummy-colour wash
    if (e.phase > 1) {
      drawingContext.globalAlpha = (e.phase - 1) * 0.10;
      noStroke(); fill(col); _silPoly(8);
      drawingContext.globalAlpha = 1;
    }

    drawingContext.globalAlpha = 0.15 + 0.85 * riseFrac;
    this._drawMummyBody(x, ry, col, sc, e.mouthOpen, e.deform);

    // Eyes — bigger, phase-coloured
    const eyeCol  = e.phase === 3 ? '#ff4444' : e.phase === 2 ? '#ffaa00' : C.COL_FLY;
    const eyeSize = 5 * sc * (e.phase === 3 ? 1.3 : 1.0);
    noStroke(); fill(eyeCol);
    drawingContext.globalAlpha = e.rising ? riseFrac : 1.0;
    circle(x - 6 * sc, ry - 31 * sc, eyeSize);
    circle(x + 6 * sc, ry - 31 * sc, eyeSize);
    drawingContext.globalAlpha = 1;

    // Ground cracks during rising
    if (e.rising && riseFrac > 0.05) {
      const crackPulse = 0.4 + 0.4 * Math.sin(G.frame * 0.12);
      drawingContext.globalAlpha = crackPulse * riseFrac;
      noFill(); stroke(col); strokeWeight(1.2);
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 / 10) * i;
        const r1 = 12, r2 = 22 + (i % 3) * 7;
        line(x + Math.cos(a)*r1, (y+12) + Math.sin(a)*r1*0.35,
             x + Math.cos(a)*r2, (y+12) + Math.sin(a)*r2*0.35);
      }
      drawingContext.globalAlpha = 1;
    }

    if (!e.rising) this._drawBossHP(e, C.COL_MUMMY_BOSS);
  },

  // Yellow shield bubble drawn under the enemy sprite
  _drawEnemyShield(e) {
    const x = e.pos.x, y = e.pos.y, r = e.radius + 12;
    const pulse = 0.5 + 0.5 * Math.sin(G.frame * 0.18 + e.pos.x * 0.01);
    drawingContext.globalAlpha = 0.18 + 0.12 * pulse;
    noStroke(); fill('#ffee00');
    circle(x, y, r * 2);
    drawingContext.globalAlpha = 0.55 + 0.35 * pulse;
    noFill(); stroke('#ffee00'); strokeWeight(2);
    circle(x, y, r * 2);
    drawingContext.globalAlpha = 1;
  },

  _drawBoss(e) {
    const x = e.pos.x, y = e.pos.y, r = e.radius;

    // Arrival animation: skull materialises from a point, spinning, over 3 seconds
    if (e.arriving) {
      const frac = 1 - e.arriveTimer / 180;
      push();
      translate(x, y);
      rotate(e.arriveAngle);
      scale(frac);
      const col = C.COL_BOSS;
      // Skull silhouette centred at origin
      const sp = [
        [0,          -r * 1.05],
        [r * 0.82,   -r * 0.52],
        [r * 0.88,    r * 0.08],
        [r * 0.58,    r * 0.68],
        [0,           r * 0.82],
        [-r * 0.58,   r * 0.68],
        [-r * 0.88,   r * 0.08],
        [-r * 0.82,  -r * 0.52],
      ];
      fill(C.COL_BG); stroke(col); strokeWeight(1.5);
      beginShape();
      curveVertex(sp[0][0], sp[0][1]);
      for (const [px, py] of sp) curveVertex(px, py);
      curveVertex(sp[0][0], sp[0][1]);
      curveVertex(sp[0][0], sp[0][1]);
      endShape();
      noStroke(); fill(C.COL_BG);
      circle(-r * 0.35, -r * 0.15, r * 0.58);
      circle( r * 0.35, -r * 0.15, r * 0.58);
      drawingContext.globalAlpha = frac;
      fill(col);
      circle(-r * 0.35, -r * 0.15, r * 0.36);
      circle( r * 0.35, -r * 0.15, r * 0.36);
      drawingContext.globalAlpha = 1;
      pop();
      return;
    }

    const phase = e.phase;
    const col = C.COL_BOSS;

    // Pulse timing (shared by halo and eyes)
    const pulseSpeed = 0.07 + phase * 0.045;
    const baseAlpha  = 0.45 + phase * 0.15;
    const glow = baseAlpha + (1 - baseAlpha) * (0.5 + 0.5 * Math.sin(G.frame * pulseSpeed));

    // Phase transition: yellow invulnerability glow
    if (e.transitionTimer > 0) {
      const tf = e.transitionTimer / C.BOSS_PHASE_TRANSITION_FRAMES;
      const pulse = 0.5 + 0.5 * Math.sin(G.frame * 0.25);
      drawingContext.globalAlpha = tf * (0.5 + 0.4 * pulse);
      noStroke(); fill('#ffee00');
      circle(x, y, (r + 18) * 2);
      drawingContext.globalAlpha = tf * (0.7 + 0.3 * pulse);
      noFill(); stroke('#ffee00'); strokeWeight(2.5);
      circle(x, y, (r + 14) * 2);
      drawingContext.globalAlpha = 1;
    }

    // Phase halo — dim red wash, intensifies at phase 2 and 3
    if (phase > 1) {
      drawingContext.globalAlpha = (phase - 1) * 0.12;
      noStroke(); fill(col);
      circle(x, y - r * 0.1, r * 2.8);
      drawingContext.globalAlpha = 1;
    }

    // Spiral attack indicator — arms spin as wind-up warning, then follow bullets
    if (e.spiralActive) {
      const isWarning = e.spiralWarning > 0;
      // Warning: arms spin fast and pulse; firing: arms steadier at bullet angle
      const pulse = isWarning
        ? 0.5 + 0.5 * Math.sin(G.frame * 0.35)   // fast pulse during wind-up
        : 0.65;
      drawingContext.globalAlpha = pulse;
      stroke('#ffee00');
      strokeWeight(isWarning ? 3 : 2.5);
      noFill();
      const armLen = isWarning ? 26 : 20;
      for (let i = 0; i < C.BOSS_SPIRAL_ARMS; i++) {
        const a = e.spiralAngle + (Math.PI * 2 / C.BOSS_SPIRAL_ARMS) * i;
        line(x + Math.cos(a) * (r + 4),  y + Math.sin(a) * (r + 4),
             x + Math.cos(a) * (r + armLen), y + Math.sin(a) * (r + armLen));
      }
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
    if (e.hp >= e.maxHp) return;   // hide until damage taken
    const bw = 30, bh = 4;
    noStroke(); fill('#111122');
    rect(cx - bw/2, topY, bw, bh);
    const frac = e.hp / e.maxHp;
    fill(frac < 0.3 ? C.COL_HUD_HP_LOW : C.COL_HUD_HP);
    rect(cx - bw/2, topY, bw * frac, bh);
  },

  drawAshtarothTrail(enemies, meatLumps) {
    noStroke();
    // Boss's own long trail
    for (const e of enemies) {
      if (!e.alive || e.type !== 'ashtaroth_boss' || !e.trailParticles) continue;
      for (const p of e.trailParticles) {
        const frac  = p.life / p.maxLife;
        const alpha = frac > 0.85 ? (1 - frac) / 0.15 * 0.40
                    : frac < 0.35 ? (frac  / 0.35) * 0.40
                    :                0.40;
        drawingContext.globalAlpha = alpha;
        fill(C.COL_ASHTAROTH_GAS);
        circle(p.x, p.y, p.size * 2);
      }
    }
    // Gas trails from big meat lumps
    for (const lump of meatLumps) {
      if (!lump.big || !lump.trailParticles) continue;
      for (const p of lump.trailParticles) {
        const frac  = p.life / p.maxLife;
        const alpha = frac > 0.85 ? (1 - frac) / 0.15 * 0.38
                    : frac < 0.35 ? (frac  / 0.35) * 0.38
                    :                0.38;
        drawingContext.globalAlpha = alpha;
        fill(C.COL_ASHTAROTH_GAS);
        circle(p.x, p.y, p.size * 2);
      }
    }
    drawingContext.globalAlpha = 1;
  },

  drawMeatLumps(lumps) {
    if (!lumps || lumps.length === 0) return;
    for (const lump of lumps) {
      if (!lump.alive) continue;
      const x = lump.pos.x, y = lump.pos.y, r = lump.radius;
      if (lump.big) {
        // Large arcing lump — fleshy organic blob with irregular outline
        const pulse = 0.85 + 0.15 * Math.sin(G.frame * 0.13 + x * 0.04);
        noStroke(); fill(C.COL_ASHTAROTH_GAS);
        circle(x, y, (r + 3) * 2);
        noStroke(); fill(C.COL_ASHTAROTH);
        circle(x, y, r * 2 * pulse);
        // Veiny highlight
        stroke(C.COL_ASHTAROTH); strokeWeight(0.8); noFill();
        const jags = 5;
        beginShape();
        for (let i = 0; i <= jags; i++) {
          const a  = (Math.PI * 2 / jags) * i;
          const jr = r * (0.55 + 0.25 * Math.sin(i * 2.3 + G.frame * 0.07));
          curveVertex(x + Math.cos(a) * jr, y + Math.sin(a) * jr);
        }
        endShape(CLOSE);
      } else {
        // Small barrage lump — compact fleshy dot with glow
        noStroke(); fill(C.COL_ASHTAROTH_GAS);
        circle(x, y, (r + 2) * 2);
        noStroke(); fill(C.COL_ASHTAROTH);
        circle(x, y, r * 2);
      }
    }
  },

  _drawAshtarothBoss(e) {
    const x = e.pos.x, y = e.pos.y, r = e.radius;
    const col = C.COL_ASHTAROTH;

    // Arrival animation: spins and grows from a point (same pattern as skull boss)
    if (e.arriving) {
      const frac = 1 - e.arriveTimer / 180;
      push(); translate(x, y); rotate(e.arriveAngle); scale(frac);
      // Simplified demon head
      noFill(); stroke(col); strokeWeight(2);
      ellipse(0, 0, r * 2.2, r * 1.8);
      // Horns
      line(-r * 0.5, -r * 0.7, -r * 0.8, -r * 1.5);
      line( r * 0.5, -r * 0.7,  r * 0.8, -r * 1.5);
      // Eyes
      drawingContext.globalAlpha = frac;
      noStroke(); fill(col);
      circle(-r * 0.38, -r * 0.1, r * 0.35);
      circle( r * 0.38, -r * 0.1, r * 0.35);
      drawingContext.globalAlpha = 1;
      pop();
      return;
    }

    // Phase transition glow
    if (e.transitionTimer > 0) {
      const tf    = e.transitionTimer / C.BOSS_PHASE_TRANSITION_FRAMES;
      const pulse = 0.5 + 0.5 * Math.sin(G.frame * 0.25);
      drawingContext.globalAlpha = tf * (0.45 + 0.35 * pulse);
      noStroke(); fill('#ffee00');
      ellipse(x, y, (r + 20) * 2.2, (r + 20) * 1.8);
      drawingContext.globalAlpha = 1;
    }

    // Phase halo
    if (e.phase > 1) {
      drawingContext.globalAlpha = (e.phase - 1) * 0.11;
      noStroke(); fill(col);
      ellipse(x, y, r * 4, r * 3.4);
      drawingContext.globalAlpha = 1;
    }

    const d = e.deform || [0, 0, 0, 0, 0, 0];
    const bodyW = r * (1.1 + d[0] * 0.07), bodyH = r * (0.9 + d[1] * 0.06);

    // Wings — two large curved bat wings extending to sides
    const wFlap = Math.sin(G.frame * 0.06) * 0.12;
    // Per-instance wing reach and droop variation
    const wReach = 3.2 + d[2] * 0.18, wTip = 2.2 + d[3] * 0.14;
    const wDroop = 0.3 + d[4] * 0.10, wFold = 2.5 + d[5] * 0.12;
    noFill(); stroke(col); strokeWeight(1.5);
    // Left wing
    beginShape();
    curveVertex(x - bodyW,          y);
    curveVertex(x - r * wTip,       y - r * 1.0 + wFlap * 20);
    curveVertex(x - r * wReach,     y + r * wDroop + wFlap * 15);
    curveVertex(x - r * wFold,      y + r * 0.8);
    curveVertex(x - bodyW,          y + r * 0.4);
    endShape();
    // Right wing (mirrored)
    beginShape();
    curveVertex(x + bodyW,          y);
    curveVertex(x + r * wTip,       y - r * 1.0 + wFlap * 20);
    curveVertex(x + r * wReach,     y + r * wDroop + wFlap * 15);
    curveVertex(x + r * wFold,      y + r * 0.8);
    curveVertex(x + bodyW,          y + r * 0.4);
    endShape();
    // Wing membrane ribs
    strokeWeight(0.8);
    drawingContext.globalAlpha = 0.55;
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      line(x - bodyW, y + r * 0.1,
           x - bodyW - (r * wTip - bodyW) * t, y - r * 0.7 * t + wFlap * 20 * t);
      line(x + bodyW, y + r * 0.1,
           x + bodyW + (r * wTip - bodyW) * t, y - r * 0.7 * t + wFlap * 20 * t);
    }
    drawingContext.globalAlpha = 1;

    // Head/body — organic spline blob: 8 radially-displaced control points
    const bodyPts = [];
    for (let i = 0; i < 8; i++) {
      const ang  = (Math.PI * 2 / 8) * i;
      const rOff = d[i % 6] * 5;
      bodyPts.push([
        x + (bodyW + rOff) * Math.cos(ang),
        y + (bodyH + rOff * 0.8) * Math.sin(ang),
      ]);
    }
    fill(C.COL_BG); stroke(col); strokeWeight(1.8 + e.phase * 0.4);
    beginShape();
    curveVertex(bodyPts[7][0], bodyPts[7][1]);
    for (const [bx, by] of bodyPts) curveVertex(bx, by);
    curveVertex(bodyPts[0][0], bodyPts[0][1]);
    curveVertex(bodyPts[1][0], bodyPts[1][1]);
    endShape();

    // Horns — per-instance tip offsets
    const lhTipX = x - r * (0.65 + d[2] * 0.07), lhTipY = y - bodyH * (1.85 + d[3] * 0.12);
    const rhTipX = x + r * (0.65 + d[4] * 0.07), rhTipY = y - bodyH * (1.85 + d[5] * 0.12);
    strokeWeight(2); stroke(col); noFill();
    line(x - r * 0.4, y - bodyH * 0.85, lhTipX, lhTipY);
    line(lhTipX, lhTipY, x - r * (0.35 + d[0] * 0.05), y - bodyH * 1.5);
    line(x + r * 0.4, y - bodyH * 0.85, rhTipX, rhTipY);
    line(rhTipX, rhTipY, x + r * (0.35 + d[1] * 0.05), y - bodyH * 1.5);

    // Eye sockets
    const eyeCol = e.phase === 3 ? '#ffff00' : e.phase === 2 ? '#ff8800' : col;
    const pulseGlow = 0.6 + 0.4 * Math.sin(G.frame * (0.08 + e.phase * 0.04));
    noStroke(); fill(C.COL_BG);
    circle(x - r * 0.38, y - r * 0.1, r * 0.55);
    circle(x + r * 0.38, y - r * 0.1, r * 0.55);
    drawingContext.globalAlpha = pulseGlow;
    fill(eyeCol);
    circle(x - r * 0.38, y - r * 0.1, r * 0.38);
    circle(x + r * 0.38, y - r * 0.1, r * 0.38);
    drawingContext.globalAlpha = 1;

    // Maw — jagged open mouth with per-instance tooth height variation
    strokeWeight(1.2); stroke(col); noFill();
    const mw = r * 0.7, mTop = y + r * 0.22, mBot = y + r * (0.65 + d[2] * 0.08);
    for (let i = 0; i < 5; i++) {
      const t  = i / 4;
      const mx = x - mw + t * mw * 2;
      const toothBot = i % 2 === 0 ? mBot + d[(i + 3) % 6] * r * 0.07
                                   : mTop + (mBot - mTop) * (0.45 + d[(i + 2) % 6] * 0.08);
      line(mx, mTop, mx, toothBot);
    }

    if (!e.arriving) this._drawBossHP(e, col);
  },

  _drawBossHP(boss, accentCol) {
    const col = accentCol || C.COL_BOSS;
    const bx = C.WIDTH / 2 - 150, by = C.HEIGHT - 30, bw = 300, bh = 10;
    noStroke(); fill('#111122'); rect(bx, by, bw, bh);
    const frac = boss.hp / boss.maxHp;
    fill(frac < 0.33 ? C.COL_BOSS : C.COL_HUD_HP_LOW);
    rect(bx, by, bw * frac, bh);
    noFill(); stroke(col); strokeWeight(0.5); rect(bx, by, bw, bh);
    const name = boss.type === 'ghoul_boss'      ? 'ROTTEN PHILIP'
               : boss.type === 'mummy_boss'      ? 'THE DRY MOTHER'
               : boss.type === 'ashtaroth_boss'  ? 'ASHTAROTH'
               :                                   'KILLER SKULL';
    noStroke(); fill(col); textFont('Creepster'); textSize(16); textAlign(CENTER, TOP);
    text(name, C.WIDTH / 2, by + bh + 2);
    textFont('monospace');
  },

  // ── Player ────────────────────────────────────────────────────────────

  drawPlayer(player) {
    if (!player || !player.alive) return;
    if (player.invincibleFrames > 0 && Math.floor(G.frame / 4) % 2 === 0) return;

    const px = player.pos.x, py = player.pos.y, a = player.angle;

    // Invuln shield — hexagonal pulsing ring
    if (player.invulnTimer > 0) {
      const frac  = player.invulnTimer / C.INVULN_POWERUP_DURATION;
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(G.frame * 0.14));
      drawingContext.globalAlpha = frac * pulse * 0.7;
      noFill(); stroke(C.COL_INVULN_PICKUP); strokeWeight(2.5);
      for (let i = 0; i < 6; i++) {
        const a1 = (Math.PI / 3) * i + G.frame * 0.02;
        const a2 = (Math.PI / 3) * (i + 1) + G.frame * 0.02;
        const rad = player.radius + 10;
        line(px + Math.cos(a1) * rad, py + Math.sin(a1) * rad,
             px + Math.cos(a2) * rad, py + Math.sin(a2) * rad);
      }
      drawingContext.globalAlpha = 1;
    }

    // Speed trail — faint afterimage streaks
    if (player.speedTimer > 0) {
      const frac = player.speedTimer / C.SPEED_POWERUP_DURATION;
      drawingContext.globalAlpha = frac * 0.25;
      noFill(); stroke(C.COL_SPEED_PICKUP); strokeWeight(1);
      circle(px - Math.cos(a) * 10, py - Math.sin(a) * 10, player.radius * 2.4);
      circle(px - Math.cos(a) * 18, py - Math.sin(a) * 18, player.radius * 1.6);
      drawingContext.globalAlpha = 1;
    }

    push();
    translate(px, py);
    rotate(a);

    noFill(); stroke(C.COL_PLAYER); strokeWeight(1.5);

    // Body: per-instance irregular spline
    const bp = player.bodyPts, bn = bp.length;
    beginShape();
    curveVertex(bp[bn-1][0], bp[bn-1][1]);
    for (const [bx, by] of bp) curveVertex(bx, by);
    curveVertex(bp[0][0], bp[0][1]);
    curveVertex(bp[1][0], bp[1][1]);
    endShape(CLOSE);

    // Head: per-instance irregular spline
    const hp = player.headPts, hn = hp.length;
    beginShape();
    curveVertex(hp[hn-1][0], hp[hn-1][1]);
    for (const [hx, hy] of hp) curveVertex(hx, hy);
    curveVertex(hp[0][0], hp[0][1]);
    curveVertex(hp[1][0], hp[1][1]);
    endShape(CLOSE);

    // Rifle: straight, always pointing forward along +x
    stroke(C.COL_AIM_LINE); strokeWeight(2);
    line(-2, 7, 26, 7);

    // Arms: each has one joint; grip endpoints are fixed on the gun
    stroke(C.COL_PLAYER); strokeWeight(1.5);
    const [rjx, rjy] = player.rearArmJoint;
    line(3, 9, rjx, rjy);  strokeWeight(2.5); point(rjx, rjy);  strokeWeight(1.5);
    line(rjx, rjy, 6, 7);

    const [fjx, fjy] = player.frontArmJoint;
    line(1, -9, fjx, fjy);  strokeWeight(2.5); point(fjx, fjy);  strokeWeight(1.5);
    line(fjx, fjy, 17, 7);

    // Muzzle flash — rendered in local space at barrel tip (26, 7)
    const mf = player.muzzleFlash;
    if (mf.timer > 0) {
      const ft  = mf.timer / mf.maxTimer;     // 1 → 0 as it fades
      const sz  = mf.isPower ? 9 : 5;
      const bx  = 26, by = 7;
      drawingContext.globalAlpha = ft * 0.9;
      noStroke(); fill('#ffffaa');
      circle(bx, by, sz * 1.6);              // bright core glow
      stroke('#ffffee'); strokeWeight(1.5); noFill();
      line(bx,        by,  bx + sz * 1.5, by);            // forward spike
      line(bx,        by,  bx + sz * 0.9, by - sz * 0.9); // diagonal up
      line(bx,        by,  bx + sz * 0.9, by + sz * 0.9); // diagonal down
      if (mf.isPower) {
        line(bx, by, bx + sz * 0.4, by - sz * 1.3);  // tall up
        line(bx, by, bx + sz * 0.4, by + sz * 1.3);  // tall down
      }
      drawingContext.globalAlpha = 1;
    }

    pop();
  },

  // ── Death particles ───────────────────────────────────────────────────

  drawDeathParticles(particles) {
    for (const p of particles) {
      if (p.delay > 0) continue;
      const t     = 1 - p.life / p.maxLife;
      const alpha = (1 - t) * 0.85;
      drawingContext.globalAlpha = alpha;
      if (p.isFlyPop) {
        // Small scatter dot
        noStroke(); fill(p.col);
        circle(p.x, p.y, p.radius * 2 * (1 - t * 0.5));
      } else {
        const r = p.radius + (p.maxRadius - p.radius) * t;
        noFill(); stroke(p.col); strokeWeight(1.5);
        circle(p.x, p.y, r * 2);
      }
      drawingContext.globalAlpha = 1;
    }
  },

  // ── Shield sparks ─────────────────────────────────────────────────────

  drawShieldSparks(sparks) {
    if (!sparks || !sparks.length) return;
    for (const s of sparks) {
      const t = 1 - s.life / s.maxLife;
      drawingContext.globalAlpha = (1 - t) * 0.95;
      stroke('#ffee00'); strokeWeight(2 - t * 1.2);
      // Draw as a short streak trailing behind the spark's movement
      line(s.x, s.y, s.x - s.vx * 0.7, s.y - s.vy * 0.7);
    }
    drawingContext.globalAlpha = 1;
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
    const p      = G.player;
    const spread = (p && p.autofireShots > 0) ? p.autofireSpread : 0;
    const gap    = 3 + spread * 45;   // grows from 3px to ~18.75px at max spread
    const arm    = 6;
    stroke(C.COL_CROSSHAIR); strokeWeight(1); noFill();
    line(mx - gap - arm, my,  mx - gap, my);
    line(mx + gap,       my,  mx + gap + arm, my);
    line(mx, my - gap - arm,  mx, my - gap);
    line(mx, my + gap,        mx, my + gap + arm);
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
    text(`HP  ${Math.round(p.hp)} / ${p.maxHp}`, bx, by + bh + 3);

    // Powerup inventory slots — sit to the right of the HP bar, same height
    {
      const slotW = 44, slotH = 20, slotGap = 4;
      const sx0 = bx + bw + 12, sy = by;
      textFont('monospace');
      for (let i = 0; i < 3; i++) {
        const sx  = sx0 + i * (slotW + slotGap);
        const pup = p.powerups[i];
        const sel = i === p.powerupIdx;
        noStroke(); fill('#111122'); rect(sx, sy, slotW, slotH, 2);
        noFill();
        stroke(sel ? '#ccccee' : '#333355'); strokeWeight(sel ? 1.5 : 0.8);
        rect(sx, sy, slotW, slotH, 2);
        if (pup) {
          const col   = pup === 'heal'     ? C.COL_PICKUP
                      : pup === 'power'    ? C.COL_WIDE_PICKUP
                      : pup === 'speed'    ? C.COL_SPEED_PICKUP
                      : pup === 'autofire' ? C.COL_AUTOFIRE_PICKUP
                      :                     C.COL_INVULN_PICKUP;
          const label = pup === 'heal'     ? '+HP'
                      : pup === 'power'    ? 'PWR'
                      : pup === 'speed'    ? 'SPD'
                      : pup === 'autofire' ? 'ATF'
                      :                     'INV';
          noStroke(); fill(col); textSize(9); textAlign(CENTER, CENTER);
          text(label, sx + slotW / 2, sy + slotH / 2);
        }
        noStroke(); fill(sel ? '#666677' : '#2a2a44'); textSize(7); textAlign(LEFT, TOP);
        text(i + 1, sx + 2, sy + 1);
      }
      // Active power shots remaining (shown below slots)
      let activeRow = 0;
      if (p.wideShots > 0) {
        noStroke(); fill(C.COL_WIDE_PICKUP); textSize(8); textAlign(LEFT, TOP);
        text(`PWR ×${p.wideShots}`, sx0, sy + slotH + 2 + activeRow * 10); activeRow++;
      }
      if (p.speedTimer > 0) {
        const secs = Math.ceil(p.speedTimer / C.FPS);
        noStroke(); fill(C.COL_SPEED_PICKUP); textSize(8); textAlign(LEFT, TOP);
        text(`SPD ${secs}s`, sx0, sy + slotH + 2 + activeRow * 10); activeRow++;
      }
      if (p.invulnTimer > 0) {
        const secs = Math.ceil(p.invulnTimer / C.FPS);
        noStroke(); fill(C.COL_INVULN_PICKUP); textSize(8); textAlign(LEFT, TOP);
        text(`INV ${secs}s`, sx0, sy + slotH + 2 + activeRow * 10); activeRow++;
      }
      if (p.autofireShots > 0) {
        noStroke(); fill(C.COL_AUTOFIRE_PICKUP); textSize(8); textAlign(LEFT, TOP);
        text(`ATF ×${p.autofireShots}`, sx0, sy + slotH + 2 + activeRow * 10);
      }
    }

    // Room info (top right)
    const room = G.currentRoom;
    noStroke(); textAlign(RIGHT, TOP); textSize(11);
    fill(C.COL_HUD_TEXT);
    text(`FLOOR: ${G.floor}  DEPTH: ${room ? room.depth : 0}`, C.WIDTH - 20, 20);
    const alive = G.enemies.filter(e => e.alive).length + (G.flies ? G.flies.length : 0);
    fill(alive > 0 ? C.COL_HUD_TEXT : C.COL_DOOR_OPEN);
    text(`ENEMIES: ${alive}`, C.WIDTH - 20, 35);

    // Symbol collection status + boss door indicator
    {
      const rc = G.ragCollected;
      const letters = getFloorSymbols(G.floor);
      const allDone = ragAllCollected();
      textAlign(RIGHT, TOP); textSize(10);
      const symSpacing = 16;
      // Draw each letter right-to-left
      let tx = C.WIDTH - 20;
      for (let i = letters.length - 1; i >= 0; i--) {
        const l = letters[i];
        const done = rc && rc[l];
        fill(done ? C.COL_RAG_SYMBOL : '#553366');
        text(l, tx, 52);
        tx -= symSpacing;
      }
      if (!allDone) {
        fill(C.COL_GAMEOVER);
        // Place locked indicator to the left of the symbol block with a gap
        text('BOSS DOOR LOCKED', C.WIDTH - 20 - letters.length * symSpacing - 6, 52);
      }
    }

    // Room cleared flash
    if (G.clearedFlash > 0) {
      drawingContext.globalAlpha = Math.min(G.clearedFlash / 40, 1);
      noStroke(); fill(C.COL_CLEARED);
      textSize(22); textAlign(CENTER, TOP);
      text('— CLEARED —', C.WIDTH / 2, 24);
      drawingContext.globalAlpha = 1.0;
    }

    // Pickup hint
    if (room) {
      const hasHeal     = room.pickupActive         && !room.pickupTaken;
      const hasPower    = room.widePowerupActive     && !room.widePowerupTaken;
      const hasMaxHp    = room.maxhpPowerupActive    && !room.maxhpPowerupTaken;
      const hasSpeed    = room.speedPowerupActive    && !room.speedPowerupTaken;
      const hasInvuln   = room.invulnPowerupActive   && !room.invulnPowerupTaken;
      const hasAutofire = room.autofirePowerupActive && !room.autofirePowerupTaken;
      if (hasHeal || hasPower || hasMaxHp || hasSpeed || hasInvuln || hasAutofire) {
        noStroke(); textSize(11); textAlign(CENTER, BOTTOM);
        if (hasMaxHp) {
          fill(C.COL_MAXHP_PICKUP);
          text('MAX HP UP — walk over to collect instantly', C.WIDTH / 2, C.HEIGHT - 12);
        } else if (hasSpeed) {
          fill(C.COL_SPEED_PICKUP);
          p.powerups.every(s => s !== null)
            ? text('INVENTORY FULL — press SPC to use a powerup', C.WIDTH / 2, C.HEIGHT - 12)
            : text('SPEED BOOST — walk into pickup', C.WIDTH / 2, C.HEIGHT - 12);
        } else if (hasInvuln) {
          fill(C.COL_INVULN_PICKUP);
          p.powerups.every(s => s !== null)
            ? text('INVENTORY FULL — press SPC to use a powerup', C.WIDTH / 2, C.HEIGHT - 12)
            : text('INVINCIBILITY — walk into pickup', C.WIDTH / 2, C.HEIGHT - 12);
        } else if (hasAutofire) {
          fill(C.COL_AUTOFIRE_PICKUP);
          p.powerups.every(s => s !== null)
            ? text('INVENTORY FULL — press SPC to use a powerup', C.WIDTH / 2, C.HEIGHT - 12)
            : text('AUTOFIRE — walk into pickup', C.WIDTH / 2, C.HEIGHT - 12);
        } else if (p.powerups.every(s => s !== null)) {
          fill('#ff6644');
          text('INVENTORY FULL — press SPC to use a powerup', C.WIDTH / 2, C.HEIGHT - 12);
        } else {
          fill(C.COL_PICKUP);
          text('Walk into pickup to add to inventory', C.WIDTH / 2, C.HEIGHT - 12);
        }
      }
    }

    noStroke(); fill(C.COL_HUD_TEXT); textSize(9); textAlign(LEFT, BOTTOM);
    text('M:map  Q:cycle  SPC:use', 20, C.HEIGHT - 6);
  },

  // ── Overlays ──────────────────────────────────────────────────────────

  drawPaused() {
    noStroke(); fill(0, 0, 0, 170); rect(0, 0, C.WIDTH, C.HEIGHT);
    fill(C.COL_HUD_TEXT); textFont('monospace'); textSize(32);
    textAlign(CENTER, CENTER);
    text('PAUSED', C.WIDTH / 2, C.HEIGHT / 2 - 22);
    textSize(14);
    fill(C.COL_HUD_TEXT);
    text('any key or click to resume', C.WIDTH / 2, C.HEIGHT / 2 + 14);
    fill(C.COL_GAMEOVER);
    text('ESC  to quit to menu', C.WIDTH / 2, C.HEIGHT / 2 + 36);
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
      skull: C.COL_SKULL,
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
        for (const [dir, [ex, ey, dx, dy]] of Object.entries(stubEdge)) {
          const nb = room.connections[dir];
          if (nb && !nb.visited) {
            const toBoss = nb.type === 'boss';
            stroke(toBoss ? C.COL_BOSS : '#55557a');
            strokeWeight(toBoss ? 3 : 2);
            const len = toBoss ? stubLen * 1.8 : stubLen;
            line(rx + ex, ry + ey, rx + ex + dx * len, ry + ey + dy * len);
          }
        }
      }
    }

    // Room boxes
    for (const room of visited) {
      const rx = ox + room.gx * stepX, ry = oy + room.gy * stepY;
      const isCurrent = room === G.currentRoom;
      const treasureTaken = room.type === 'treasure' && room.pickupTaken;

      // Detect uncollected powerups in this room (including non-treasure typed dead-ends)
      const roomPowerup = !room.pickupTaken && room.type === 'treasure'        ? { col: C.COL_PICKUP,         label: 'HEAL' }
                        : room.widePowerup     && !room.widePowerupTaken     ? { col: C.COL_WIDE_PICKUP,    label: 'PWR'  }
                        : room.speedPowerup    && !room.speedPowerupTaken    ? { col: C.COL_SPEED_PICKUP,   label: 'SPD'  }
                        : room.invulnPowerup   && !room.invulnPowerupTaken   ? { col: C.COL_INVULN_PICKUP,  label: 'INV'  }
                        : room.autofirePowerup && !room.autofirePowerupTaken ? { col: C.COL_AUTOFIRE_PICKUP, label: 'ATF' }
                        : room.maxhpPowerup    && !room.maxhpPowerupTaken    ? { col: C.COL_MAXHP_PICKUP,   label: 'MXHP' }
                        : null;

      const col = roomPowerup         ? roomPowerup.col
                : treasureTaken       ? C.COL_DOOR_OPEN
                :                       (TYPE_COL[room.type] || C.COL_HUD_TEXT);
      // Cleared rooms (not boss, not current, no powerup) use a dim neutral outline
      const borderCol = (room.cleared && room.type !== 'boss' && !isCurrent && !roomPowerup)
        ? '#444466' : col;

      // Background fill
      noStroke(); fill('#12121c');
      rect(rx, ry, cellW, cellH, 3);
      if (room.type === 'boss' || isCurrent) {
        drawingContext.globalAlpha = room.type === 'boss' ? 0.35 : 0.28;
        fill(col);
        rect(rx, ry, cellW, cellH, 3);
        drawingContext.globalAlpha = 1;
      }

      // Border
      noFill(); stroke(borderCol);
      strokeWeight(room.type === 'boss' || isCurrent ? 2.5 : 1.5);
      rect(rx, ry, cellW, cellH, 3);

      // Type label (center of cell)
      noStroke();
      const label = room.type === 'start'  ? 'START'
                  : room.type === 'boss'   ? 'BOSS'
                  : roomPowerup            ? roomPowerup.label
                  : room.cleared           ? ''
                  :                          '...';
      fill(room.cleared || room.type === 'start' ? col : C.COL_DOOR_CLOSED);
      textFont('monospace'); textSize(8); textAlign(CENTER, CENTER);
      text(label, rx + cellW / 2, ry + cellH / 2);

      // Pulsing border highlight for uncollected powerup rooms
      if (roomPowerup && !isCurrent) {
        const pulse = 0.4 + 0.35 * Math.sin(G.frame * 0.12);
        drawingContext.globalAlpha = pulse;
        noFill(); stroke(roomPowerup.col); strokeWeight(2.5);
        rect(rx, ry, cellW, cellH, 3);
        drawingContext.globalAlpha = 1;
      }

      // Symbol marker — tiny stick glyph in top-right corner of cell
      if (room.ragSymbol && !room.ragSymbol.collected) {
        push();
        const mx = rx + cellW - 5, my = ry + 5, msc = 2.5;
        stroke(C.COL_RAG_SYMBOL); strokeWeight(1); noFill();
        for (const [bx1,by1,bx2,by2] of SYMBOL_GLYPHS[room.ragSymbol.letter]) {
          line(mx + bx1*msc, my + by1*msc, mx + bx2*msc, my + by2*msc);
        }
        pop();
      }

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
      { col: C.COL_SKULL,       label: 'skull'      },
      { col: C.COL_WHITE_SKULL, label: 'white skull' },
      { col: C.COL_GHOUL,        label: 'ghoul'      },
      { col: C.COL_LONG_GHOUL,  label: 'long ghoul' },
      { col: C.COL_DEMON,  label: 'demon' },
      { col: C.COL_MUMMY,       label: 'mummy'      },
      { col: '#ff9922',         label: 'mixed'      },
      { col: C.COL_BOSS,        label: 'boss (skull)'  },
      { col: C.COL_GHOUL_BOSS,  label: 'boss (ghoul)'  },
      { col: C.COL_MUMMY_BOSS,  label: 'boss (mummy)'     },
      { col: C.COL_ASHTAROTH,   label: 'boss (ashtaroth)' },
      { col: C.COL_PICKUP,      label: 'treasure'   },
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

  drawCycleComplete() {
    const anim = G.cycleAnim;
    if (!anim) return;
    const t = anim.timer;

    const EXPL_END   = 100;  // explosion fades out; black overlay starts
    const BLACK_END  = 152;  // fully black; aftermath scene starts fading in
    const SCENE_END  = 225;  // aftermath scene fully visible
    const TEXT_START = 235;  // text begins fading in

    // ── Phase 1: explosion ──────────────────────────────────────────
    if (t < BLACK_END) {
      const sx = anim.shake > 0 ? (Math.random() - 0.5) * anim.shake : 0;
      const sy = anim.shake > 0 ? (Math.random() - 0.5) * anim.shake : 0;
      push(); translate(sx, sy);

      const roomAlpha = Math.max(0, 1 - t / 70);
      if (roomAlpha > 0.01) {
        drawingContext.globalAlpha = roomAlpha;
        this.drawRoom(G.currentRoom);
        drawingContext.globalAlpha = 1;
      } else {
        noStroke(); fill(C.COL_BG); rect(0, 0, C.WIDTH, C.HEIGHT);
      }

      noStroke();
      for (const d of anim.debris) {
        drawingContext.globalAlpha = d.life / d.maxLife;
        fill(C.COL_HUD_TITLE);
        push(); translate(d.x, d.y); rotate(d.rot);
        rect(-d.w / 2, -d.h / 2, d.w, d.h);
        pop();
      }
      drawingContext.globalAlpha = 1;

      noStroke();
      for (const p of anim.particles) {
        drawingContext.globalAlpha = (p.life / p.maxLife) * 0.9;
        fill(p.col);
        circle(p.x, p.y, p.r * 2);
      }
      drawingContext.globalAlpha = 1;

      this.drawPlayer(G.player);
      pop();

      if (t < 12) {
        drawingContext.globalAlpha = (1 - t / 12) * 0.85;
        noStroke(); fill(255, 255, 255);
        rect(0, 0, C.WIDTH, C.HEIGHT);
        drawingContext.globalAlpha = 1;
      }

      if (t > EXPL_END) {
        drawingContext.globalAlpha = Math.min(1, (t - EXPL_END) / (BLACK_END - EXPL_END));
        noStroke(); fill(0, 0, 0);
        rect(0, 0, C.WIDTH, C.HEIGHT);
        drawingContext.globalAlpha = 1;
      }
    }

    // ── Phase 2: aftermath scene ────────────────────────────────────
    if (t >= BLACK_END) {
      drawingContext.globalAlpha = Math.min(1, (t - BLACK_END) / (SCENE_END - BLACK_END));
      this._drawVictoryScene();
      drawingContext.globalAlpha = 1;

      if (t > TEXT_START) {
        drawingContext.globalAlpha = Math.min(1, (t - TEXT_START) / 40);
        this._drawVictoryText();
        drawingContext.globalAlpha = 1;
      }
    }
  },

  _drawVictoryScene() {
    const W = C.WIDTH, H = C.HEIGHT;

    // Sky
    noStroke(); fill(C.COL_BG);
    rect(0, 0, W, H);

    // Stars — fixed deterministic positions
    noStroke();
    for (let i = 0; i < 32; i++) {
      const sx = ((i * 127 + 53) % 740) + 30;
      const sy = ((i * 83  + 17) % 205) + 12;
      drawingContext.globalAlpha = 0.18 + (i % 5) * 0.09;
      fill('#ffffff');
      circle(sx, sy, 1 + (i % 3) * 0.7);
    }
    drawingContext.globalAlpha = 1;

    // Moon crescent — ivory disc with COL_BG bite
    noStroke();
    drawingContext.globalAlpha = 0.76;
    fill('#c8be78'); circle(668, 74, 44);
    fill(C.COL_BG);  circle(682, 68, 38);
    drawingContext.globalAlpha = 1;

    // Hill silhouette — filled dark polygon
    const hillPts = [
      [0,   510], [70,  492], [150, 463], [240, 422],
      [320, 360], [378, 295], [415, 232], [440, 178],
      [462, 182], [510, 218], [580, 286], [658, 353],
      [740, 413], [800, 458],
    ];
    noStroke(); fill('#111820');
    beginShape();
    vertex(0, H);
    for (const [hx, hy] of hillPts) vertex(hx, hy);
    vertex(W, H);
    endShape(CLOSE);

    // Hill edge highlight
    noFill(); stroke('#243040'); strokeWeight(1.5);
    beginShape();
    curveVertex(hillPts[0][0], hillPts[0][1]);
    for (const [hx, hy] of hillPts) curveVertex(hx, hy);
    curveVertex(hillPts[hillPts.length - 1][0], hillPts[hillPts.length - 1][1]);
    endShape();

    // ── Ruins of the great house ──────────────────────────────────
    // Hill peak ~(440, 178); all ruin coords relative to (rpx, rpy)
    const rpx = 444, rpy = 178;
    const rc = '#9a8fab';
    noFill(); stroke(rc);

    // Foundation — heavy base line
    strokeWeight(2.2);
    line(rpx - 98, rpy, rpx + 108, rpy);
    strokeWeight(1.4);

    // Left tower — tallest, most intact
    line(rpx - 98, rpy,       rpx - 98, rpy - 102);
    line(rpx - 70, rpy,       rpx - 70, rpy - 92);
    line(rpx - 98, rpy - 102, rpx - 70, rpy - 102);
    // Crenellations
    line(rpx - 98, rpy - 102, rpx - 105, rpy - 112);
    line(rpx - 91, rpy - 102, rpx - 87,  rpy - 114);
    line(rpx - 79, rpy - 102, rpx - 75,  rpy - 110);
    // Windows
    rect(rpx - 93, rpy - 83, 17, 13);
    rect(rpx - 92, rpy - 58, 15, 10);

    // Central hall
    line(rpx - 32, rpy, rpx - 32, rpy - 76);
    line(rpx + 30, rpy, rpx + 30, rpy - 70);
    line(rpx - 32, rpy - 76, rpx + 5, rpy - 76);  // partial back wall
    rect(rpx - 28, rpy - 57, 19, 13);              // window

    // Chimney — tallest single element, still standing
    strokeWeight(1.9);
    line(rpx + 7,  rpy,       rpx + 7,  rpy - 122);
    line(rpx + 22, rpy,       rpx + 22, rpy - 122);
    line(rpx + 7,  rpy - 122, rpx + 22, rpy - 122);
    line(rpx + 7,  rpy - 110, rpx + 22, rpy - 110);
    strokeWeight(1.4);

    // Right wing — more collapsed
    line(rpx + 52,  rpy, rpx + 52,  rpy - 52);
    line(rpx + 88,  rpy, rpx + 88,  rpy - 33);
    line(rpx + 88,  rpy - 33, rpx + 108, rpy);    // collapsed wall

    // Fallen roof beams
    stroke('#7a6e8a'); strokeWeight(1.2);
    line(rpx - 98, rpy - 88, rpx - 20, rpy - 60);
    line(rpx - 70, rpy - 73, rpx + 30, rpy - 52);
    line(rpx + 30, rpy - 58, rpx + 88, rpy - 28);

    // Rubble at base
    stroke(rc); strokeWeight(1.0);
    for (const [ox, oy, w, h] of [
      [-88,-7,13,5], [-72,-5,9,4], [-52,-7,7,4],
      [ 42,-6,10,4], [ 62,-8,7,5], [ 78,-5,11,4],
      [ 92,-7, 8,4], [ -8,-6,8,4],
    ]) rect(rpx + ox, rpy + oy, w, h);

    // ── Smoke wisps from chimney top ──────────────────────────────
    noFill();
    const chx = rpx + 14, chy = rpy - 124;
    for (let i = 0; i < 3; i++) {
      const progress = ((G.frame + i * 43) % 130) / 130;
      const drift    = Math.sin(G.frame * 0.025 + i * 2.2) * 15 * progress;
      drawingContext.globalAlpha = (1 - progress) * 0.30;
      stroke('#4a5e70');
      strokeWeight(1 + progress * 2.2);
      bezier(chx, chy,
             chx + drift * 0.3, chy - 20 * progress,
             chx + drift * 0.7, chy - 44 * progress,
             chx + drift,       chy - 65 * progress);
    }
    drawingContext.globalAlpha = 1;
  },

  _drawVictoryText() {
    const W = C.WIDTH, H = C.HEIGHT;
    textAlign(CENTER, CENTER);

    // Title — in the sky above the ruins
    fill('#ff5500'); textFont('monospace'); textSize(36);
    text('THE HOUSE FALLS!', W / 2, 50);

    // Flavour text
    fill(C.COL_HUD_TEXT); textFont('monospace'); textSize(11);
    const cx = W / 2;
    text('You have destroyed the haunted house. The land can now be used for',   cx,  93);
    text('some affordable housing and a small supermarket. You can quit now',     cx, 107);
    text('and have recognition for your high score (if competitive), or proceed', cx, 121);
    text('to another house which, we are told, is even more haunted.',             cx, 135);

    // Score
    fill(C.COL_CLEARED); textSize(18);
    text(`SCORE:  ${G.score}`, W / 2, 158);

    // Options at bottom, pulsing gently
    drawingContext.globalAlpha = 0.7 + 0.3 * Math.sin(G.frame * 0.06);
    fill(C.COL_WIN); textSize(13);
    text('N  —  try again in a new haunted house  (harder)', W / 2, H - 38);
    fill(C.COL_HUD_TEXT); textSize(12);
    text('E  —  exit  (high score table)', W / 2, H - 20);
    drawingContext.globalAlpha = 1;
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
