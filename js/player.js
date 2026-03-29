class Player {
  constructor(x, y) {
    this.pos              = { x, y };
    this.angle            = 0;
    this.hp               = C.PLAYER_MAX_HP;
    this.maxHp            = C.PLAYER_MAX_HP;
    this.fireCooldown     = 0;
    this.radius           = C.PLAYER_RADIUS;
    this.invincibleFrames = 0;
    this.alive     = true;
    this.wideShots = 0;
    this.powerups    = [null, null, null]; // up to 3 stored powerups ('heal'|'power'|'speed'|'invuln'|'autofire'|null)
    this.powerupIdx  = 0;                 // currently selected slot
    this.speedTimer  = 0;   // frames of speed-boost remaining
    this.invulnTimer = 0;   // frames of powerup invincibility remaining
    this.autofireShots  = 0;    // shots remaining from autofire powerup
    this.autofireSpread = 0;    // current angular spread (grows while holding fire)
    this.muzzleFlash    = { timer: 0, maxTimer: 0, isPower: false };
    this.vel            = { x: 0, y: 0 };   // current velocity (px/frame); accelerates toward target

    // Sprite deformation — rerolled each game
    // Body: 8-point spline, mild radial variation on a 7.5×11 ellipse
    this.bodyPts = Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI * 2 / 8) * i;
      return [(7.5 + randFloat(-1.5, 1.5)) * Math.cos(a),
              (11  + randFloat(-1.5, 1.5)) * Math.sin(a)];
    });

    // Head: 6-point spline around centre (4, 0), radius ~4
    this.headPts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI * 2 / 6) * i;
      const r = 4 + randFloat(-1.0, 1.0);
      return [4 + Math.cos(a) * r, Math.sin(a) * r];
    });

    // Arm joints — exactly 1 joint per arm, placed at midpoint ± perp offset
    const _armJoint = (sx, sy, ex, ey, maxOff) => {
      const dx = ex - sx, dy = ey - sy, len = Math.sqrt(dx*dx + dy*dy);
      const px = -dy / len, py = dx / len;  // unit perpendicular
      const off = randFloat(-maxOff, maxOff);
      return [(sx + ex) / 2 + px * off, (sy + ey) / 2 + py * off];
    };
    this.rearArmJoint  = _armJoint(3, 9,  6,  7, 3);   // shoulder → rear grip
    this.frontArmJoint = _armJoint(1, -9, 17, 7, 4);   // shoulder → front grip
  }

  addPowerup(type) {
    const i = this.powerups.indexOf(null);
    if (i === -1) return false;   // inventory full
    this.powerups[i] = type;
    return true;
  }

  cyclePowerup() {
    this.powerupIdx = (this.powerupIdx + 1) % 3;
  }

  usePowerup() {
    const type = this.powerups[this.powerupIdx];
    if (!type) return;
    if (type === 'heal') {
      this.hp = Math.min(this.hp + C.PICKUP_HEAL_AMOUNT, this.maxHp);
    } else if (type === 'power') {
      this.wideShots = C.WIDE_BULLET_SHOTS;
    } else if (type === 'speed') {
      this.speedTimer = C.SPEED_POWERUP_DURATION;
    } else if (type === 'invuln') {
      this.invulnTimer = C.INVULN_POWERUP_DURATION;
    } else if (type === 'autofire') {
      this.autofireShots = C.AUTOFIRE_SHOTS;
    }
    this.powerups[this.powerupIdx] = null;
    AudioEngine.playSFX('pickup');
  }

  update(keys, mx, my, room) {
    if (!this.alive) return;

    // Aim toward mouse
    this.angle = Math.atan2(my - this.pos.y, mx - this.pos.x);

    if (this.speedTimer  > 0) this.speedTimer--;
    if (this.invulnTimer > 0) this.invulnTimer--;

    // Build movement vector from WASD
    let vx = 0, vy = 0;
    if (keys['w'] || keys['arrowup'])    vy -= 1;
    if (keys['s'] || keys['arrowdown'])  vy += 1;
    if (keys['a'] || keys['arrowleft'])  vx -= 1;
    if (keys['d'] || keys['arrowright']) vx += 1;
    const n   = normalizeVec(vx, vy);
    const spd = C.PLAYER_SPEED * (this.speedTimer > 0 ? C.SPEED_POWERUP_MULT : 1);

    // Accelerate velocity toward the target (n * spd), reaching it in PLAYER_ACCEL_MS
    const accel   = spd / (C.PLAYER_ACCEL_MS / 1000 * C.FPS);
    const targetX = n.x * spd, targetY = n.y * spd;
    const dvx = targetX - this.vel.x, dvy = targetY - this.vel.y;
    const dvMag = Math.hypot(dvx, dvy);
    if (dvMag <= accel) {
      this.vel.x = targetX; this.vel.y = targetY;
    } else {
      this.vel.x += (dvx / dvMag) * accel;
      this.vel.y += (dvy / dvMag) * accel;
    }

    // Move on each axis separately so the player slides along walls
    this.pos.x += this.vel.x;
    this._resolveCollisions(room);
    this.pos.y += this.vel.y;
    this._resolveCollisions(room);

    if (this.fireCooldown     > 0) this.fireCooldown--;
    if (this.invincibleFrames > 0) this.invincibleFrames--;

    // Autofire spread decays naturally so accuracy recovers if player briefly stops firing
    if (this.autofireSpread  > 0) this.autofireSpread = Math.max(0, this.autofireSpread - 0.008);
    if (this.muzzleFlash.timer > 0) this.muzzleFlash.timer--;
  }

  _resolveCollisions(room) {
    for (const w of getWallRects()) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, w.x, w.y, w.w, w.h);
      if (push) { this.pos.x += push.x; this.pos.y += push.y; }
    }
    for (const obs of room.obstacles) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, obs.x, obs.y, obs.w, obs.h);
      if (push) { this.pos.x += push.x; this.pos.y += push.y; }
    }
  }

  shoot(bullets) {
    if (this.fireCooldown > 0 || !this.alive) return;

    const isAutofire = this.autofireShots > 0;
    const isPower    = this.wideShots > 0;

    // Autofire: apply accumulated spread then ramp it up; first shot is always on target
    let shootAngle = this.angle;
    if (isAutofire) {
      shootAngle += (Math.random() - 0.5) * 2 * this.autofireSpread;
      this.autofireSpread = Math.min(C.AUTOFIRE_MAX_SPREAD, this.autofireSpread + C.AUTOFIRE_SPREAD_PER_SHOT);
      this.autofireShots--;
    }

    const vx     = Math.cos(shootAngle) * C.BULLET_SPEED;
    const vy     = Math.sin(shootAngle) * C.BULLET_SPEED;
    const r      = isPower ? C.BULLET_RADIUS * 3 : C.BULLET_RADIUS;
    const damage = isPower ? C.BULLET_DAMAGE * 3 : C.BULLET_DAMAGE;
    if (isPower) this.wideShots--;

    // Spawn at barrel tip — local (26, 7) rotated into world space
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const tipX = this.pos.x + ca * 26 - sa * 7;
    const tipY = this.pos.y + sa * 26 + ca * 7;
    bullets.fire(tipX, tipY, vx, vy, 'player', damage, r);

    this.fireCooldown = isAutofire ? C.AUTOFIRE_FIRE_RATE : C.PLAYER_FIRE_RATE;

    const flashDur = isPower ? 7 : 5;
    this.muzzleFlash.timer    = flashDur;
    this.muzzleFlash.maxTimer = flashDur;
    this.muzzleFlash.isPower  = isPower;

    if (isPower) {
      // Recoil: push player back along opposite aim direction
      this.pos.x -= Math.cos(this.angle) * C.POWER_SHOT_RECOIL;
      this.pos.y -= Math.sin(this.angle) * C.POWER_SHOT_RECOIL;
      AudioEngine.playSFX('power_shoot');
    } else {
      AudioEngine.playSFX('shoot');
    }
  }

  takeDamage(amount) {
    if (this.invincibleFrames > 0 || this.invulnTimer > 0) return;
    const scaled = amount * C.MASTER_DAMAGE_MULT * (1 + ((G.floor || 1) - 1) * C.FLOOR_DAMAGE_BONUS);
    this.hp -= scaled;
    this.invincibleFrames = C.PLAYER_INVINCIBLE_FRAMES;
    AudioEngine.playSFX('hit');
    if (this.hp <= 0) {
      this.hp    = 0;
      this.alive = false;
    }
  }
}
