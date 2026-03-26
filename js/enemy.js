// ── Ghost ─────────────────────────────────────────────────────────────────

class GhostEnemy {
  constructor(x, y) {
    this.pos             = { x, y };
    this.vel             = { x: 0, y: 0 };
    this.hp              = C.GHOST_HP;
    this.maxHp           = C.GHOST_HP;
    this.radius          = C.GHOST_RADIUS;
    this.type            = 'ghost';
    this.scoreValue      = C.SCORE_GHOST;
    this.alive           = true;
    this.wanderDir       = { x: 0, y: 0 };
    this.wanderTimer     = 0;
    this.contactCooldown = 0;
    this.flickerAlpha    = 1.0;
    this.flickerOffset   = randFloat(0, Math.PI * 2);
    // Per-instance shape deformation (6 values, range -1..1)
    // [dome height, left bulge, right bulge, right foot, centre foot, left foot]
    this.deform          = Array.from({ length: 6 }, () => randFloat(-1, 1));
    // 30 % of ghosts are lunge variants (red, intermittent double-speed bursts)
    this.variant      = Math.random() < 0.3 ? 'lunge' : 'normal';
    this.lunging      = false;
    this.lungeDuration = 0;
    this.lungeTimer   = randInt(60, 140);
  }

  update(player, room) {
    if (!this.alive) return;

    const dist = circleDist(this.pos.x, this.pos.y, player.pos.x, player.pos.y);

    if (this.variant === 'lunge' && this.lunging) {
      // Lunge: double-speed straight at player
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * C.GHOST_SPEED * 2.4;
      this.vel.y = n.y * C.GHOST_SPEED * 2.4;
      this.lungeDuration--;
      if (this.lungeDuration <= 0) {
        this.lunging   = false;
        this.lungeTimer = randInt(80, 160);
      }
    } else if (dist < C.GHOST_CHASE_DIST) {
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * C.GHOST_SPEED;
      this.vel.y = n.y * C.GHOST_SPEED;
      if (this.variant === 'lunge') {
        this.lungeTimer--;
        if (this.lungeTimer <= 0) { this.lunging = true; this.lungeDuration = 22; }
      }
    } else {
      this.wanderTimer--;
      if (this.wanderTimer <= 0) {
        const angle    = randFloat(0, Math.PI * 2);
        this.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
        this.wanderTimer = randInt(40, C.GHOST_WANDER_CHANGE);
      }
      this.vel.x = this.wanderDir.x * C.GHOST_SPEED * 0.55;
      this.vel.y = this.wanderDir.y * C.GHOST_SPEED * 0.55;
    }

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this._resolveCollisions(room);

    // Contact damage
    if (this.contactCooldown > 0) this.contactCooldown--;
    if (this.contactCooldown === 0 &&
        circleCollide(this.pos.x, this.pos.y, this.radius, player.pos.x, player.pos.y, player.radius)) {
      player.takeDamage(C.GHOST_CONTACT_DAMAGE);
      this.contactCooldown = C.GHOST_CONTACT_COOLDOWN;
    }

    this.flickerAlpha = 0.55 + 0.45 * Math.sin(G.frame * 0.12 + this.flickerOffset);
  }

  _resolveCollisions(room) {
    for (const w of getWallRects()) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, w.x, w.y, w.w, w.h);
      if (push) {
        this.pos.x += push.x; this.pos.y += push.y;
        if (Math.abs(push.x) > Math.abs(push.y)) this.vel.x *= -1; else this.vel.y *= -1;
        this.wanderTimer = 0;
      }
    }
    for (const obs of room.obstacles) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, obs.x, obs.y, obs.w, obs.h);
      if (push) {
        this.pos.x += push.x; this.pos.y += push.y;
        if (Math.abs(push.x) > Math.abs(push.y)) this.vel.x *= -1; else this.vel.y *= -1;
        this.wanderTimer = 0;
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      AudioEngine.playSFX('death');
      _spawnDeathFX(this);
    }
  }
}

// ── Ghoul ─────────────────────────────────────────────────────────────────

class GhoulEnemy {
  constructor(x, y) {
    this.pos             = { x, y };
    this.vel             = { x: 0, y: 0 };
    this.hp              = C.GHOUL_HP;
    this.maxHp           = C.GHOUL_HP;
    this.radius          = C.GHOUL_RADIUS;
    this.type            = 'ghoul';
    this.scoreValue      = C.SCORE_GHOUL;
    this.alive           = true;
    this.contactCooldown = 0;
    this.leaping         = false;
    this.leapDuration    = 0;
    this.leapTimer       = randInt(40, 110);
    this.crawlPhase      = randFloat(0, Math.PI * 2);
  }

  update(player, room) {
    if (!this.alive) return;
    const dist = circleDist(this.pos.x, this.pos.y, player.pos.x, player.pos.y);

    if (this.leaping) {
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * C.GHOUL_LEAP_SPEED;
      this.vel.y = n.y * C.GHOUL_LEAP_SPEED;
      this.leapDuration--;
      if (this.leapDuration <= 0) {
        this.leaping   = false;
        this.leapTimer = randInt(60, 140);
      }
    } else {
      // Slow crawl toward player
      if (dist < 350) {
        const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        this.vel.x = n.x * C.GHOUL_SPEED;
        this.vel.y = n.y * C.GHOUL_SPEED;
      } else {
        this.vel.x *= 0.85;
        this.vel.y *= 0.85;
      }
      // Trigger leap when close enough
      if (dist < C.GHOUL_LEAP_RANGE) {
        this.leapTimer--;
        if (this.leapTimer <= 0) { this.leaping = true; this.leapDuration = 18; }
      }
    }

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this._resolveCollisions(room);
    this.crawlPhase += 0.09;

    // Contact damage
    if (this.contactCooldown > 0) this.contactCooldown--;
    if (this.contactCooldown === 0 &&
        circleCollide(this.pos.x, this.pos.y, this.radius, player.pos.x, player.pos.y, player.radius)) {
      player.takeDamage(C.GHOUL_CONTACT_DAMAGE);
      this.contactCooldown = C.GHOST_CONTACT_COOLDOWN;
    }
  }

  _resolveCollisions(room) {
    for (const w of getWallRects()) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, w.x, w.y, w.w, w.h);
      if (push) {
        this.pos.x += push.x; this.pos.y += push.y;
        if (Math.abs(push.x) > Math.abs(push.y)) this.vel.x *= -1; else this.vel.y *= -1;
      }
    }
    for (const obs of room.obstacles) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, obs.x, obs.y, obs.w, obs.h);
      if (push) {
        this.pos.x += push.x; this.pos.y += push.y;
        if (Math.abs(push.x) > Math.abs(push.y)) this.vel.x *= -1; else this.vel.y *= -1;
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      AudioEngine.playSFX('death');
      _spawnDeathFX(this);
    }
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────

class SkeletonEnemy {
  constructor(x, y) {
    this.pos         = { x, y };
    this.spawnX      = x;
    this.spawnY      = y;
    this.vel         = { x: C.SKELETON_SPEED, y: 0 };
    this.hp          = C.SKELETON_HP;
    this.maxHp       = C.SKELETON_HP;
    this.radius      = C.SKELETON_RADIUS;
    this.type        = 'skeleton';
    this.scoreValue  = C.SCORE_SKELETON;
    this.alive       = true;
    this.fireTimer   = randInt(30, C.SKELETON_FIRE_RATE);
    this.facing      = 0;  // radians, toward player when firing
  }

  update(player, room) {
    if (!this.alive) return;

    // Patrol left/right around spawn point
    this.pos.x += this.vel.x;
    if (Math.abs(this.pos.x - this.spawnX) > C.SKELETON_PATROL_RANGE) {
      this.vel.x *= -1;
    }

    // Wall / obstacle collision
    for (const w of getWallRects()) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, w.x, w.y, w.w, w.h);
      if (push) { this.pos.x += push.x; this.pos.y += push.y; this.vel.x *= -1; }
    }
    for (const obs of room.obstacles) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, obs.x, obs.y, obs.w, obs.h);
      if (push) { this.pos.x += push.x; this.pos.y += push.y; this.vel.x *= -1; }
    }

    // Face the player always
    this.facing = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);

    // Fire
    this.fireTimer--;
    if (this.fireTimer <= 0) {
      this._fireBullet(this.facing);
      this.fireTimer = C.SKELETON_FIRE_RATE;
    }
  }

  _fireBullet(angle) {
    const vx = Math.cos(angle) * C.SKELETON_BULLET_SPEED;
    const vy = Math.sin(angle) * C.SKELETON_BULLET_SPEED;
    const ox = Math.cos(angle) * (this.radius + 6);
    const oy = Math.sin(angle) * (this.radius + 6);
    G.bullets.fire(this.pos.x + ox, this.pos.y + oy, vx, vy, 'enemy', C.SKELETON_BULLET_DAMAGE);
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      AudioEngine.playSFX('death');
      _spawnDeathFX(this);
    }
  }
}

// ── Boss ──────────────────────────────────────────────────────────────────

class BossEnemy {
  constructor(x, y) {
    this.pos        = { x, y };
    this.vel        = { x: 0, y: 0 };
    this.hp         = C.BOSS_HP;
    this.maxHp      = C.BOSS_HP;
    this.radius     = C.BOSS_RADIUS;
    this.type       = 'boss';
    this.scoreValue = C.SCORE_BOSS;
    this.alive      = true;
    this.phase      = 1;
    this.fireTimer  = 60;
    this.erraticDir = { x: 1, y: 0 };
    this.erraticTimer = 0;
  }

  get speed() {
    if (this.phase === 3) return C.BOSS_SPEED_3;
    if (this.phase === 2) return C.BOSS_SPEED_2;
    return C.BOSS_SPEED_1;
  }

  update(player, room) {
    if (!this.alive) return;

    // Update phase
    const hpFrac = this.hp / this.maxHp;
    this.phase = hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;

    // Movement
    if (this.phase < 3) {
      // Chase player
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * this.speed;
      this.vel.y = n.y * this.speed;
    } else {
      // Erratic movement — change direction frequently
      this.erraticTimer--;
      if (this.erraticTimer <= 0) {
        const angle      = randFloat(0, Math.PI * 2);
        this.erraticDir  = { x: Math.cos(angle), y: Math.sin(angle) };
        this.erraticTimer = randInt(15, 35);
      }
      this.vel.x = this.erraticDir.x * this.speed;
      this.vel.y = this.erraticDir.y * this.speed;
    }

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

    for (const w of getWallRects()) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, w.x, w.y, w.w, w.h);
      if (push) { this.pos.x += push.x; this.pos.y += push.y; }
    }
    for (const obs of room.obstacles) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, obs.x, obs.y, obs.w, obs.h);
      if (push) { this.pos.x += push.x; this.pos.y += push.y; }
    }

    // Fire
    this.fireTimer--;
    const fireRate = this.phase === 1 ? 120 : this.phase === 2 ? 80 : 55;
    if (this.fireTimer <= 0) {
      this._fireBurst();
      this.fireTimer = fireRate;
    }
  }

  _fireBurst() {
    const count = this.phase === 1 ? 4 : this.phase === 2 ? 8 : 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const vx = Math.cos(angle) * C.BOSS_BULLET_SPEED;
      const vy = Math.sin(angle) * C.BOSS_BULLET_SPEED;
      const ox = Math.cos(angle) * (this.radius + 6);
      const oy = Math.sin(angle) * (this.radius + 6);
      G.bullets.fire(this.pos.x + ox, this.pos.y + oy, vx, vy, 'enemy', C.BOSS_BULLET_DAMAGE);
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp    = 0;
      this.alive = false;
      AudioEngine.playSFX('death');
      _spawnDeathFX(this);
      // Unlock boss room doors
      const room = G.currentRoom;
      for (const dir of ['north', 'south', 'east', 'west']) {
        if (room.connections[dir]) room.bossDoorsLocked = false;
      }
      room.bossDoorsLocked = false;
    }
  }
}

// ── Death FX + drops ──────────────────────────────────────────────────────

function _spawnDeathFX(enemy) {
  const col = enemy.type === 'ghost'    ? (enemy.variant === 'lunge' ? C.COL_LUNGE_GHOST : '#cc88ff')
            : enemy.type === 'ghoul'    ? C.COL_GHOUL
            : enemy.type === 'boss'     ? '#ff2222'
            : '#ff6644';
  G.deathParticles.push({
    x: enemy.pos.x, y: enemy.pos.y,
    radius: enemy.radius,
    maxRadius: enemy.radius * 3.5,
    life: 35, maxLife: 35,
    col,
  });
  // 40% chance of health drop (boss always drops)
  if (enemy.type === 'boss' || Math.random() < 0.4) {
    G.drops.push({ x: enemy.pos.x, y: enemy.pos.y, amount: 20, life: 360, maxLife: 360 });
  }
}

// ── Spawn helpers ─────────────────────────────────────────────────────────

function _spawnZone(room) {
  const P      = C.ROOM_PADDING;
  const margin = 30;
  return {
    minX: P + margin, maxX: C.WIDTH  - P - margin,
    minY: P + margin, maxY: C.HEIGHT - P - margin,
  };
}

function _validPos(x, y, radius, room, safeR) {
  const dx = x - C.WIDTH / 2, dy = y - C.HEIGHT / 2;
  if (dx * dx + dy * dy < safeR * safeR) return false;
  for (const obs of room.obstacles) {
    if (circleRectCollide(x, y, radius + 8, obs.x, obs.y, obs.w, obs.h)) return false;
  }
  return true;
}

function spawnGhosts(room) {
  const ghosts = [];
  const count  = room.enemyCount !== undefined ? room.enemyCount : C.GHOST_COUNT;
  const z      = _spawnZone(room);
  for (let i = 0; i < count * 15 && ghosts.length < count; i++) {
    const x = randFloat(z.minX, z.maxX);
    const y = randFloat(z.minY, z.maxY);
    if (_validPos(x, y, C.GHOST_RADIUS, room, 110)) ghosts.push(new GhostEnemy(x, y));
  }
  return ghosts;
}

function spawnSkeletons(room) {
  const skeletons = [];
  const count     = Math.max(1, Math.floor(room.enemyCount / 2));
  const z         = _spawnZone(room);
  for (let i = 0; i < count * 15 && skeletons.length < count; i++) {
    const x = randFloat(z.minX, z.maxX);
    const y = randFloat(z.minY, z.maxY);
    if (_validPos(x, y, C.SKELETON_RADIUS, room, 120)) skeletons.push(new SkeletonEnemy(x, y));
  }
  return skeletons;
}

function spawnBoss(room) {
  return [new BossEnemy(C.WIDTH / 2, C.HEIGHT / 2)];
}

function spawnGhouls(room) {
  const ghouls = [];
  const count  = Math.max(1, Math.floor(room.enemyCount / 3));
  const z      = _spawnZone(room);
  for (let i = 0; i < count * 15 && ghouls.length < count; i++) {
    const x = randFloat(z.minX, z.maxX);
    const y = randFloat(z.minY, z.maxY);
    if (_validPos(x, y, C.GHOUL_RADIUS, room, 120)) ghouls.push(new GhoulEnemy(x, y));
  }
  return ghouls;
}

// Main entry point called by state.js
function spawnEnemies(room) {
  if (room.type === 'boss')      return spawnBoss(room);
  if (room.type === 'skeleton')  return [...spawnSkeletons(room), ...spawnGhouls(room)];
  if (room.type === 'mixed')     return [...spawnGhosts(room), ...spawnSkeletons(room), ...spawnGhouls(room)];
  return spawnGhosts(room);
}
