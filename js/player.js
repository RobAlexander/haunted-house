class Player {
  constructor(x, y) {
    this.pos              = { x, y };
    this.angle            = 0;
    this.hp               = C.PLAYER_MAX_HP;
    this.maxHp            = C.PLAYER_MAX_HP;
    this.fireCooldown     = 0;
    this.radius           = C.PLAYER_RADIUS;
    this.invincibleFrames = 0;
    this.alive            = true;
    this.wideShots        = 0;
  }

  update(keys, mx, my, room) {
    if (!this.alive) return;

    // Aim toward mouse
    this.angle = Math.atan2(my - this.pos.y, mx - this.pos.x);

    // Build movement vector from WASD
    let vx = 0, vy = 0;
    if (keys['w'] || keys['arrowup'])    vy -= 1;
    if (keys['s'] || keys['arrowdown'])  vy += 1;
    if (keys['a'] || keys['arrowleft'])  vx -= 1;
    if (keys['d'] || keys['arrowright']) vx += 1;
    const n = normalizeVec(vx, vy);

    // Move on each axis separately so the player slides along walls
    this.pos.x += n.x * C.PLAYER_SPEED;
    this._resolveCollisions(room);
    this.pos.y += n.y * C.PLAYER_SPEED;
    this._resolveCollisions(room);

    if (this.fireCooldown     > 0) this.fireCooldown--;
    if (this.invincibleFrames > 0) this.invincibleFrames--;
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
    const vx = Math.cos(this.angle) * C.BULLET_SPEED;
    const vy = Math.sin(this.angle) * C.BULLET_SPEED;
    const r  = this.wideShots > 0 ? C.BULLET_RADIUS * 3 : C.BULLET_RADIUS;
    if (this.wideShots > 0) this.wideShots--;
    const ox = Math.cos(this.angle) * (this.radius + r + 2);
    const oy = Math.sin(this.angle) * (this.radius + r + 2);
    bullets.fire(this.pos.x + ox, this.pos.y + oy, vx, vy, 'player', C.BULLET_DAMAGE, r);
    this.fireCooldown = C.PLAYER_FIRE_RATE;
    AudioEngine.playSFX('shoot');
  }

  takeDamage(amount) {
    if (this.invincibleFrames > 0) return;
    this.hp -= amount;
    this.invincibleFrames = C.PLAYER_INVINCIBLE_FRAMES;
    AudioEngine.playSFX('hit');
    if (this.hp <= 0) {
      this.hp    = 0;
      this.alive = false;
    }
  }
}
