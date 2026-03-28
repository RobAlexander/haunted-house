// ── Floor scaling helpers ─────────────────────────────────────────────────

function _floorMult(bonusPerFloor, cap) {
  return Math.min(cap, 1 + ((G.floor || 1) - 1) * bonusPerFloor);
}

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
    this.speedMult       = _floorMult(C.FLOOR_SPEED_BONUS, C.FLOOR_SPEED_CAP);
    this.shielded        = false;
    this.shieldFreezeTimer = 0;
    // 30 % of ghosts are lunge variants (red, intermittent double-speed bursts)
    this.variant      = Math.random() < 0.3 ? 'lunge' : 'normal';
    this.lunging      = false;
    this.lungeDuration = 0;
    this.lungeTimer   = randInt(C.GHOST_LUNGE_COOLDOWN_MIN, C.GHOST_LUNGE_COOLDOWN_MAX);
  }

  update(player, room) {
    if (!this.alive) return;
    if (this.shieldFreezeTimer > 0) { this.shieldFreezeTimer--; return; }

    if (this.variant === 'lunge' && this.lunging) {
      // Lunge: double-speed straight at player
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * C.GHOST_SPEED * 2.4 * this.speedMult;
      this.vel.y = n.y * C.GHOST_SPEED * 2.4 * this.speedMult;
      this.lungeDuration--;
      if (this.lungeDuration <= 0) {
        this.lunging   = false;
        this.lungeTimer = randInt(C.GHOST_LUNGE_COOLDOWN_MIN, C.GHOST_LUNGE_COOLDOWN_MAX);
      }
    } else {
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * C.GHOST_SPEED * this.speedMult;
      this.vel.y = n.y * C.GHOST_SPEED * this.speedMult;
      if (this.variant === 'lunge') {
        this.lungeTimer--;
        if (this.lungeTimer <= 0) { this.lunging = true; this.lungeDuration = 32; AudioEngine.playSFX('ghost_lunge'); }
      }
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
    this.speedMult         = _floorMult(C.FLOOR_SPEED_BONUS, C.FLOOR_SPEED_CAP);
    this.shielded          = false;
    this.shieldFreezeTimer = 0;
    this.leapTimer         = randInt(C.GHOUL_LEAP_COOLDOWN_MIN, C.GHOUL_LEAP_COOLDOWN_MAX);
    this.crawlPhase = randFloat(0, Math.PI * 2);
    this.eyeOff     = 3.5 + randFloat(0, 2.5);

    // Irregular body outline: 10 points, each stored as [xMult, yMult] × radius
    this.bodyPts = Array.from({ length: 10 }, (_, i) => {
      const a  = (Math.PI * 2 / 10) * i;
      const rx = (1.2 + randFloat(-0.3, 0.3)) * Math.cos(a);
      const ry = (0.75 + randFloat(-0.2, 0.2)) * Math.sin(a);
      return [rx, ry];
    });

    // Per-leg structure: each leg has a base direction offset, segment lengths,
    // and bend angles at each joint. Joint count: 1 (40%), 2 (40%), 3 (15%), 4 (5%)
    const legBaseAngles = [-Math.PI/4, Math.PI/4, Math.PI*0.75, Math.PI*1.25];
    this.legs = legBaseAngles.map(baseA => {
      const rnd     = Math.random();
      const nJoints = rnd < 0.40 ? 1 : rnd < 0.80 ? 2 : rnd < 0.95 ? 3 : 4;
      const total   = 11 + randFloat(-2, 3);
      const base    = total / (nJoints + 1);
      return {
        dir:     baseA + randFloat(-0.35, 0.35),
        segLens: Array.from({ length: nJoints + 1 }, () => base + randFloat(-2, 2)),
        bends:   Array.from({ length: nJoints },     () => randFloat(-0.6, 0.6)),
      };
    });
  }

  update(player, room) {
    if (!this.alive) return;
    if (this.shieldFreezeTimer > 0) { this.shieldFreezeTimer--; return; }
    const dist = circleDist(this.pos.x, this.pos.y, player.pos.x, player.pos.y);

    if (this.leaping) {
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * C.GHOUL_LEAP_SPEED * this.speedMult;
      this.vel.y = n.y * C.GHOUL_LEAP_SPEED * this.speedMult;
      this.leapDuration--;
      if (this.leapDuration <= 0) {
        this.leaping   = false;
        this.leapTimer = randInt(C.GHOUL_LEAP_COOLDOWN_MIN, C.GHOUL_LEAP_COOLDOWN_MAX);
      }
    } else {
      // Always crawl toward player
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * C.GHOUL_SPEED * this.speedMult;
      this.vel.y = n.y * C.GHOUL_SPEED * this.speedMult;
      // Trigger leap when close enough
      if (dist < C.GHOUL_LEAP_RANGE) {
        this.leapTimer--;
        if (this.leapTimer <= 0) { this.leaping = true; this.leapDuration = 18; AudioEngine.playSFX('ghoul_leap'); }
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

// ── Long Ghoul ────────────────────────────────────────────────────────────

class LongGhoulEnemy {
  constructor(x, y) {
    this.pos             = { x, y };
    this.vel             = { x: 0, y: 0 };
    this.hp              = C.LONG_GHOUL_HP;
    this.maxHp           = C.LONG_GHOUL_HP;
    this.radius          = C.LONG_GHOUL_RADIUS;
    this.type            = 'long_ghoul';
    this.scoreValue      = C.SCORE_LONG_GHOUL;
    this.alive           = true;
    this.contactCooldown = 0;
    this.leaping         = false;
    this.leapDuration    = 0;
    this.speedMult         = _floorMult(C.FLOOR_SPEED_BONUS, C.FLOOR_SPEED_CAP);
    this.shielded          = false;
    this.shieldFreezeTimer = 0;
    this.leapTimer         = randInt(C.LONG_GHOUL_LEAP_COOLDOWN_MIN, C.LONG_GHOUL_LEAP_COOLDOWN_MAX);
    this.crawlPhase = randFloat(0, Math.PI * 2);
    this.eyeOff     = 3.5 + randFloat(0, 2.5);

    // Scrunched body: rx stays wide but ry is compressed (~half ghoul height)
    this.bodyPts = Array.from({ length: 10 }, (_, i) => {
      const a  = (Math.PI * 2 / 10) * i;
      const rx = (1.25 + randFloat(-0.25, 0.25)) * Math.cos(a);
      const ry = (0.38 + randFloat(-0.10, 0.10)) * Math.sin(a);
      return [rx, ry];
    });

    // 5 legs: first 4 similar to ghoul, 5th is always longer than the rest
    const legBaseAngles = [-Math.PI/4, Math.PI/4, Math.PI*0.70, Math.PI*1.30, Math.PI*0.90];
    this.legs = legBaseAngles.map((baseA, idx) => {
      const isExtra = idx === 4;
      const rnd     = Math.random();
      const nJoints = isExtra ? (Math.random() < 0.5 ? 2 : 3)
                               : (rnd < 0.40 ? 1 : rnd < 0.80 ? 2 : rnd < 0.95 ? 3 : 4);
      const total   = isExtra ? 22 + randFloat(0, 7)
                               : 11 + randFloat(-2, 3);
      const base    = total / (nJoints + 1);
      return {
        dir:     baseA + randFloat(-0.35, 0.35),
        segLens: Array.from({ length: nJoints + 1 }, () => base + randFloat(-2, 2)),
        bends:   Array.from({ length: nJoints },     () => randFloat(-0.6, 0.6)),
      };
    });
  }

  update(player, room) {
    if (!this.alive) return;
    if (this.shieldFreezeTimer > 0) { this.shieldFreezeTimer--; return; }
    const dist = circleDist(this.pos.x, this.pos.y, player.pos.x, player.pos.y);

    if (this.leaping) {
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * C.LONG_GHOUL_LEAP_SPEED * this.speedMult;
      this.vel.y = n.y * C.LONG_GHOUL_LEAP_SPEED * this.speedMult;
      this.leapDuration--;
      if (this.leapDuration <= 0) {
        this.leaping   = false;
        this.leapTimer = randInt(C.LONG_GHOUL_LEAP_COOLDOWN_MIN, C.LONG_GHOUL_LEAP_COOLDOWN_MAX);
      }
    } else {
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * C.LONG_GHOUL_SPEED * this.speedMult;
      this.vel.y = n.y * C.LONG_GHOUL_SPEED * this.speedMult;
      if (dist < C.LONG_GHOUL_LEAP_RANGE) {
        this.leapTimer--;
        if (this.leapTimer <= 0) { this.leaping = true; this.leapDuration = 18; AudioEngine.playSFX('long_ghoul_leap'); }
      }
    }

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this._resolveCollisions(room);
    this.crawlPhase += 0.09;

    if (this.contactCooldown > 0) this.contactCooldown--;
    if (this.contactCooldown === 0 &&
        circleCollide(this.pos.x, this.pos.y, this.radius, player.pos.x, player.pos.y, player.radius)) {
      player.takeDamage(C.LONG_GHOUL_CONTACT_DAMAGE);
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

// ── Nuckelavee ────────────────────────────────────────────────────────────

class NuckelaveeEnemy {
  constructor(x, y) {
    this.pos             = { x, y };
    this.vel             = { x: 0, y: 0 };
    this.hp              = C.NUCKELAVEE_HP;
    this.maxHp           = C.NUCKELAVEE_HP;
    this.radius          = C.NUCKELAVEE_RADIUS;
    this.type            = 'nuckelavee';
    this.scoreValue      = C.SCORE_NUCKELAVEE;
    this.alive           = true;
    this.contactCooldown = 0;
    this.auraCooldown    = 0;
    this.speedMult       = _floorMult(C.FLOOR_SPEED_BONUS, C.FLOOR_SPEED_CAP);
    this.shielded        = false;
    this.shieldFreezeTimer = 0;

    // Pre-computed sinew crossing lines within the horse body.
    // Each: [x1Frac, y1Frac, x2Frac, y2Frac] — fracs of horse half-width/height.
    this.sinewLines = Array.from({ length: 9 }, () => [
      randFloat(-0.88, 0.88), randFloat(-0.82, 0.82),
      randFloat(-0.88, 0.88), randFloat(-0.82, 0.82),
    ]);
    // Per-instance arm drop lengths (how far below horse body each arm hangs)
    this.armDrop  = [7 + randFloat(-3, 5), 10 + randFloat(-3, 5)];
    this.eyeSize  = 5 + randFloat(0, 3);

    // Toxic breath cloud — green wisps that drift through the aura zone
    this.breathParticles = [];
    this.breathSpawnTimer = 0;

    // Poison trail — gas left behind as it moves
    this.trailParticles   = [];
    this.trailSpawnTimer  = 0;
    this.trailDamageCooldown = 0;
  }

  update(player, room) {
    if (!this.alive) return;
    if (this.shieldFreezeTimer > 0) { this.shieldFreezeTimer--; return; }

    // Slow relentless pursuit
    const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
    this.vel.x = n.x * C.NUCKELAVEE_SPEED * this.speedMult;
    this.vel.y = n.y * C.NUCKELAVEE_SPEED * this.speedMult;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this._resolveCollisions(room);

    // Breath cloud — spawn and tick wisps
    this.breathSpawnTimer--;
    if (this.breathSpawnTimer <= 0) {
      const a = randFloat(0, Math.PI * 2);
      const d = randFloat(0, C.NUCKELAVEE_AURA_RADIUS * 0.9);
      const outSpd = randFloat(0.15, 0.55);
      const maxL   = randInt(28, 55);
      this.breathParticles.push({
        x: this.pos.x + Math.cos(a) * d,
        y: this.pos.y + Math.sin(a) * d,
        vx: Math.cos(a) * outSpd * 0.4 + randFloat(-0.2, 0.2),
        vy: Math.sin(a) * outSpd * 0.4 + randFloat(-0.2, 0.2),
        life: maxL, maxLife: maxL,
        size: randFloat(2.5, 5.5),
      });
      this.breathSpawnTimer = 2;
    }
    for (let i = this.breathParticles.length - 1; i >= 0; i--) {
      const p = this.breathParticles[i];
      p.x  += p.vx;
      p.y  += p.vy;
      p.vx += randFloat(-0.04, 0.04);
      p.vy += randFloat(-0.04, 0.04);
      p.life--;
      if (p.life <= 0) this.breathParticles.splice(i, 1);
    }

    // Poison trail — spawn wisps at current position
    this.trailSpawnTimer--;
    if (this.trailSpawnTimer <= 0) {
      this.trailParticles.push({
        x: this.pos.x + randFloat(-8, 8),
        y: this.pos.y + randFloat(-8, 8),
        vx: randFloat(-0.25, 0.25),
        vy: randFloat(-0.35, 0.0),  // drift slightly upward
        life: C.NUCKELAVEE_TRAIL_LIFETIME,
        maxLife: C.NUCKELAVEE_TRAIL_LIFETIME,
        size: randFloat(4, 9),
      });
      this.trailSpawnTimer = C.NUCKELAVEE_TRAIL_INTERVAL;
    }
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const tp = this.trailParticles[i];
      tp.x += tp.vx; tp.y += tp.vy;
      tp.vx += randFloat(-0.03, 0.03);
      tp.vy += randFloat(-0.03, 0.03);
      tp.life--;
      if (tp.life <= 0) this.trailParticles.splice(i, 1);
    }
    // Trail damage — player touching any trail wisp
    if (this.trailDamageCooldown > 0) this.trailDamageCooldown--;
    if (this.trailDamageCooldown === 0) {
      for (const tp of this.trailParticles) {
        if (circleDist(player.pos.x, player.pos.y, tp.x, tp.y) < player.radius + tp.size) {
          player.takeDamage(C.NUCKELAVEE_TRAIL_DAMAGE);
          this.trailDamageCooldown = C.NUCKELAVEE_TRAIL_DAMAGE_INTERVAL;
          break;
        }
      }
    }

    // Aura damage — tick every NUCKELAVEE_AURA_INTERVAL frames when player close
    if (this.auraCooldown > 0) this.auraCooldown--;
    if (this.auraCooldown === 0) {
      const dist = circleDist(this.pos.x, this.pos.y, player.pos.x, player.pos.y);
      if (dist < C.NUCKELAVEE_AURA_RADIUS + player.radius) {
        player.takeDamage(C.NUCKELAVEE_AURA_DAMAGE);
      }
      this.auraCooldown = C.NUCKELAVEE_AURA_INTERVAL;
    }

    // Body contact — heavier hit
    if (this.contactCooldown > 0) this.contactCooldown--;
    if (this.contactCooldown === 0 &&
        circleCollide(this.pos.x, this.pos.y, this.radius, player.pos.x, player.pos.y, player.radius)) {
      player.takeDamage(C.NUCKELAVEE_CONTACT_DAMAGE);
      this.contactCooldown = C.GHOST_CONTACT_COOLDOWN;
    }
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

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      AudioEngine.playSFX('death');
      _spawnDeathFX(this);
    }
  }
}

// ── Skull ─────────────────────────────────────────────────────────────────

class SkullEnemy {
  constructor(x, y) {
    this.pos         = { x, y };
    this.spawnX      = x;
    this.spawnY      = y;
    this.speedMult   = _floorMult(C.FLOOR_SPEED_BONUS, C.FLOOR_SPEED_CAP);
    this.vel         = { x: C.SKULL_SPEED * this.speedMult, y: 0 };
    this.hp          = C.SKULL_HP;
    this.maxHp       = C.SKULL_HP;
    this.radius      = C.SKULL_RADIUS;
    this.type        = 'skull';
    this.scoreValue  = C.SCORE_SKULL;
    this.alive       = true;
    this.shielded          = false;
    this.shieldFreezeTimer = 0;
    this.fireTimer         = randInt(30, C.SKULL_FIRE_RATE);
    this.facing      = 0;  // radians, toward player when firing
    // Eye/teeth variation: [leftEyeX, rightEyeX, jawY, toothSpread, unused]
    this.deform      = Array.from({ length: 5 }, () => randFloat(-1, 1));
    // Pre-computed irregular head outline: 7 points with skull-like silhouette
    // (wide cranium at top, narrowing to jaw at bottom) + small random jitter
    this.headPts = Array.from({ length: 7 }, (_, i) => {
      const angle = (Math.PI * 2 / 7) * i - Math.PI / 2;
      const baseR = 10.5 + 2.0 * Math.max(0, -Math.sin(angle))  // cranium bulge at top
                         - 2.5 * Math.max(0,  Math.sin(angle));  // jaw narrows at bottom
      const r     = baseR + randFloat(-1.2, 1.2);
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    });
  }

  update(player, room) {
    if (!this.alive) return;
    if (this.shieldFreezeTimer > 0) { this.shieldFreezeTimer--; return; }

    // Patrol left/right around spawn point
    this.pos.x += this.vel.x;
    if (Math.abs(this.pos.x - this.spawnX) > C.SKULL_PATROL_RANGE) {
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
      this.fireTimer = C.SKULL_FIRE_RATE;
    }
  }

  _fireBullet(angle) {
    const vx = Math.cos(angle) * C.SKULL_BULLET_SPEED;
    const vy = Math.sin(angle) * C.SKULL_BULLET_SPEED;
    const ox = Math.cos(angle) * (this.radius + 6);
    const oy = Math.sin(angle) * (this.radius + 6);
    G.bullets.fire(this.pos.x + ox, this.pos.y + oy, vx, vy, 'enemy', C.SKULL_BULLET_DAMAGE);
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

// ── White Skull ───────────────────────────────────────────────────────────
// Tougher variant (floor 3+): weaving bullets + scatter burst when close.

class WhiteSkullEnemy {
  constructor(x, y) {
    this.pos         = { x, y };
    this.spawnX      = x;
    this.spawnY      = y;
    this.speedMult   = _floorMult(C.FLOOR_SPEED_BONUS, C.FLOOR_SPEED_CAP);
    this.vel         = { x: C.WHITE_SKULL_SPEED * this.speedMult, y: 0 };
    this.hp          = C.WHITE_SKULL_HP;
    this.maxHp       = C.WHITE_SKULL_HP;
    this.radius      = C.WHITE_SKULL_RADIUS;
    this.type        = 'white_skull';
    this.scoreValue  = C.SCORE_WHITE_SKULL;
    this.alive       = true;
    this.shielded          = false;
    this.shieldFreezeTimer = 0;
    this.fireTimer         = randInt(30, C.WHITE_SKULL_FIRE_RATE);
    this.facing      = 0;
    this.deform      = Array.from({ length: 5 }, () => randFloat(-1, 1));
    // Slightly more angular skull shape than the regular skull
    this.headPts = Array.from({ length: 7 }, (_, i) => {
      const angle = (Math.PI * 2 / 7) * i - Math.PI / 2;
      const baseR = 11 + 2.5 * Math.max(0, -Math.sin(angle))
                       - 3.0 * Math.max(0,  Math.sin(angle));
      const r     = baseR + randFloat(-1.2, 1.2);
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    });
  }

  update(player, room) {
    if (!this.alive) return;
    if (this.shieldFreezeTimer > 0) { this.shieldFreezeTimer--; return; }

    this.pos.x += this.vel.x;
    if (Math.abs(this.pos.x - this.spawnX) > C.SKULL_PATROL_RANGE) this.vel.x *= -1;

    for (const w of getWallRects()) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, w.x, w.y, w.w, w.h);
      if (push) { this.pos.x += push.x; this.pos.y += push.y; this.vel.x *= -1; }
    }
    for (const obs of room.obstacles) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, obs.x, obs.y, obs.w, obs.h);
      if (push) { this.pos.x += push.x; this.pos.y += push.y; this.vel.x *= -1; }
    }

    this.facing = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);

    this.fireTimer--;
    if (this.fireTimer <= 0) {
      const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      const scatterP = dist < C.WHITE_SKULL_NEAR_RANGE ? 0.75 : 0.20;
      if (Math.random() < scatterP) {
        this._fireScatter();
      } else {
        this._fireWeaving(this.facing);
      }
      this.fireTimer = C.WHITE_SKULL_FIRE_RATE;
    }
  }

  _fireWeaving(angle) {
    const vx = Math.cos(angle) * C.WHITE_SKULL_BULLET_SPEED;
    const vy = Math.sin(angle) * C.WHITE_SKULL_BULLET_SPEED;
    const ox = Math.cos(angle) * (this.radius + 6);
    const oy = Math.sin(angle) * (this.radius + 6);
    G.bullets.fireWeaving(this.pos.x + ox, this.pos.y + oy, vx, vy, 'enemy', C.WHITE_SKULL_BULLET_DAMAGE);
  }

  _fireScatter() {
    const count = C.WHITE_SKULL_SCATTER_COUNT;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const vx = Math.cos(angle) * C.WHITE_SKULL_BULLET_SPEED;
      const vy = Math.sin(angle) * C.WHITE_SKULL_BULLET_SPEED;
      const ox = Math.cos(angle) * (this.radius + 6);
      const oy = Math.sin(angle) * (this.radius + 6);
      G.bullets.fire(this.pos.x + ox, this.pos.y + oy, vx, vy, 'enemy', C.WHITE_SKULL_BULLET_DAMAGE);
    }
    AudioEngine.playSFX('boss_fire');
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
    this.erraticDir    = { x: 1, y: 0 };
    this.erraticTimer  = 0;
    this.speedMult        = _floorMult(C.FLOOR_SPEED_BONUS,         C.FLOOR_SPEED_CAP);
    this.firerateMult     = _floorMult(C.FLOOR_BOSS_FIRERATE_BONUS, C.FLOOR_BOSS_FIRERATE_CAP);
    this.bulletMult       = _floorMult(C.FLOOR_BOSS_BULLETS_BONUS,  C.FLOOR_BOSS_BULLETS_CAP);
    this.prevPhase        = 1;
    this.transitionTimer  = 0;
    this.spiralActive      = false;
    this.spiralWarning     = 0;    // countdown warning before bullets start
    this.spiralAngle       = 0;
    this.spiralBulletsLeft = 0;
    this.spiralInterval    = 0;
    this.minionTimer       = 240;  // frames until first skull minion spawn
    // Per-instance static deformation: radial offset per skull vertex (8 points)
    this.deform           = Array.from({ length: 8 }, () => randFloat(-1, 1));
  }

  get speed() {
    const base = this.phase === 3 ? C.BOSS_SPEED_3
               : this.phase === 2 ? C.BOSS_SPEED_2
               :                    C.BOSS_SPEED_1;
    return base * this.speedMult;
  }

  update(player, room) {
    if (!this.alive) return;

    // Update phase; trigger invulnerability glow on transition
    const hpFrac = this.hp / this.maxHp;
    this.phase = hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;
    if (this.phase > this.prevPhase) {
      this.transitionTimer = C.BOSS_PHASE_TRANSITION_FRAMES;
      this.prevPhase = this.phase;
      AudioEngine.playSFX('boss_phase');
    }
    if (this.transitionTimer > 0) this.transitionTimer--;

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

    // Spiral attack — arms spin as warning first, then bullets fire
    if (this.spiralActive) {
      if (this.spiralWarning > 0) {
        this.spiralWarning--;
        this.spiralAngle += 0.14;   // fast visible spin during wind-up
      } else {
        this.spiralInterval--;
        if (this.spiralInterval <= 0) {
          const armStep = (Math.PI * 2) / C.BOSS_SPIRAL_ARMS;
          for (let arm = 0; arm < C.BOSS_SPIRAL_ARMS; arm++) {
            // Per-arm angular jitter — each arm deviates independently
            const jitter = randFloat(-0.38, 0.38);
            const a  = this.spiralAngle + armStep * arm + jitter;
            // Slight speed variation makes arms spread at different depths
            const spd = C.BOSS_BULLET_SPEED * (0.82 + Math.random() * 0.38);
            const vx = Math.cos(a) * spd;
            const vy = Math.sin(a) * spd;
            const ox = Math.cos(a) * (this.radius + 6);
            const oy = Math.sin(a) * (this.radius + 6);
            G.bullets.fire(this.pos.x + ox, this.pos.y + oy, vx, vy, 'enemy', C.BOSS_BULLET_DAMAGE);
          }
          // Variable rotation per step — spiral doesn't advance at a fixed rate
          this.spiralAngle += C.BOSS_SPIRAL_ROT * (0.65 + Math.random() * 0.75);
          this.spiralBulletsLeft--;
          this.spiralInterval = C.BOSS_SPIRAL_INTERVAL;
          if (this.spiralBulletsLeft <= 0) this.spiralActive = false;
        }
      }
    }

    // Fire
    this.fireTimer--;
    const baseRate = this.phase === 1 ? 120 : this.phase === 2 ? 80 : 55;
    const fireRate = Math.max(10, Math.round(baseRate / this.firerateMult));
    if (this.fireTimer <= 0) {
      if (this.phase === 3 && !this.spiralActive && Math.random() < 0.35) {
        // Start spiral attack with a 50-frame wind-up warning
        this.spiralActive      = true;
        this.spiralWarning     = 50;
        this.spiralAngle       = randFloat(0, Math.PI * 2);
        this.spiralBulletsLeft = C.BOSS_SPIRAL_BULLETS;
        this.spiralInterval    = C.BOSS_SPIRAL_INTERVAL;
      } else {
        this._fireBurst();
      }
      this.fireTimer = fireRate;
    }

    // Skull minion spawning — phase 2+ on floor 3+
    if ((G.floor || 1) >= 3 && this.phase >= 2) {
      this.minionTimer--;
      if (this.minionTimer <= 0) {
        const interval = this.phase === 3 ? 210 : 300;
        this.minionTimer = interval;
        const useWhite = (G.floor || 1) >= 5 && Math.random() < 0.50;
        const EClass = useWhite ? WhiteSkullEnemy : SkullEnemy;
        const pos = _bossMinionPos(this.pos.x, this.pos.y, C.SKULL_RADIUS);
        if (pos) { const m = new EClass(pos.x, pos.y); m.bossMinion = true; G.enemies.push(m); }
      }
    }
  }

  _fireBurst() {
    const baseCount = this.phase === 1 ? 4 : this.phase === 2 ? 8 : 12;
    const count = Math.round(baseCount * this.bulletMult);
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
    if (this.transitionTimer > 0) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp    = 0;
      this.alive = false;
      AudioEngine.playSFX('death');
      _spawnDeathFX(this);
      _clearBossMinions();
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
  const col = enemy.type === 'ghost'       ? (enemy.variant === 'lunge' ? C.COL_LUNGE_GHOST : '#cc88ff')
            : enemy.type === 'ghoul'       ? C.COL_GHOUL
            : enemy.type === 'long_ghoul'  ? C.COL_LONG_GHOUL
            : enemy.type === 'nuckelavee'  ? C.COL_NUCKELAVEE
            : enemy.type === 'mummy'       ? C.COL_MUMMY
            : enemy.type === 'mummy_boss'  ? C.COL_MUMMY_BOSS
            : enemy.type === 'white_skull' ? C.COL_WHITE_SKULL
            : enemy.type === 'boss'       ? '#ff2222'
            : '#ff6644';
  if (enemy.type === 'boss' || enemy.type === 'mummy_boss') {
    // Multi-wave explosion
    const waves = [
      { delay: 0,  maxR: 220, life: 90, col: '#ffffff' },
      { delay: 0,  maxR: 150, life: 80, col: '#ff2222' },
      { delay: 15, maxR: 115, life: 70, col: '#ff6600' },
      { delay: 30, maxR: 85,  life: 55, col: '#ffcc00' },
      { delay: 50, maxR: 55,  life: 40, col: '#ff2222' },
    ];
    for (const w of waves) {
      G.deathParticles.push({
        x: enemy.pos.x, y: enemy.pos.y,
        radius: enemy.radius, maxRadius: w.maxR,
        life: w.life, maxLife: w.life, col: w.col, delay: w.delay,
      });
    }
    // Scattered fragments
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      const dist  = 28 + Math.random() * 22;
      G.deathParticles.push({
        x: enemy.pos.x + Math.cos(angle) * dist,
        y: enemy.pos.y + Math.sin(angle) * dist,
        radius: 4, maxRadius: 20,
        life: 45 + Math.floor(Math.random() * 25), maxLife: 70,
        col: i % 2 === 0 ? '#ff4444' : '#ff8800',
        delay: Math.floor(Math.random() * 25),
      });
    }
  } else {
    G.deathParticles.push({
      x: enemy.pos.x, y: enemy.pos.y,
      radius: enemy.radius,
      maxRadius: enemy.radius * 3.5,
      life: 35, maxLife: 35,
      col, delay: 0,
    });
  }
  // Drop chance scales inversely with avg enemies/room so expected drops per room is floor-constant
  const avg       = G.dungeon ? G.dungeon.avgEnemiesPerRoom : C.DROP_HEAL_BASELINE_ENEMIES;
  const dropChance = C.DROP_CHANCE * C.DROP_HEAL_BASELINE_ENEMIES / avg;
  if (enemy.type === 'boss' || enemy.type === 'mummy_boss' || enemy.type === 'ghoul_boss' || Math.random() < dropChance) {
    G.drops.push({ x: enemy.pos.x, y: enemy.pos.y, amount: C.DROP_HEAL_AMOUNT, life: 360, maxLife: 360 });
  }
}

// ── Mummy Fly ─────────────────────────────────────────────────────────────

class MummyFly {
  constructor(x, y) {
    this.pos             = { x, y };
    this.vel             = { x: 0, y: 0 };
    this.hp              = C.FLY_HP;
    this.maxHp           = C.FLY_HP;
    this.radius          = C.FLY_RADIUS;
    this.type            = 'fly';
    this.alive           = true;
    this.life            = C.FLY_LIFETIME;
    this.contactCooldown = 0;
    this.scoreValue      = C.SCORE_FLY;
    this.droneFreq       = 90 + Math.random() * 80;  // per-fly random pitch
    this.buzzTimer       = randInt(10, 50);           // stagger initial buzz sounds
    this.wingPhase       = randFloat(0, Math.PI * 2);
  }

  update(player) {
    if (!this.alive) return;
    this.life--;
    if (this.life <= 0) { this.alive = false; return; }

    // Chase player
    const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
    this.vel.x = n.x * C.FLY_SPEED;
    this.vel.y = n.y * C.FLY_SPEED;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.wingPhase += 0.55;

    // Contact damage
    if (this.contactCooldown > 0) this.contactCooldown--;
    if (this.contactCooldown === 0 &&
        circleCollide(this.pos.x, this.pos.y, this.radius, player.pos.x, player.pos.y, player.radius)) {
      player.takeDamage(C.FLY_CONTACT_DAMAGE);
      this.contactCooldown = C.GHOST_CONTACT_COOLDOWN;
    }

    // Periodic droning buzz
    this.buzzTimer--;
    if (this.buzzTimer <= 0) {
      AudioEngine.playFlyBuzz(this.droneFreq);
      this.buzzTimer = randInt(80, 160);
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      G.score += this.scoreValue;
      // Small pop of green particles when fly is killed
      for (let i = 0; i < 5; i++) {
        const a = randFloat(0, Math.PI * 2);
        const spd = randFloat(0.8, 2.2);
        G.deathParticles.push({
          x: this.pos.x, y: this.pos.y,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          radius: 1.5, maxRadius: 4,
          life: 18, maxLife: 18,
          col: C.COL_FLY, delay: 0, isFlyPop: true,
        });
      }
    }
  }
}

// ── Mummy ─────────────────────────────────────────────────────────────────

class MummyEnemy {
  constructor(x, y) {
    this.pos             = { x, y };
    this.vel             = { x: 0, y: 0 };
    this.hp              = C.MUMMY_HP;
    this.maxHp           = C.MUMMY_HP;
    this.radius          = C.MUMMY_RADIUS;
    this.type            = 'mummy';
    this.scoreValue      = C.SCORE_MUMMY;
    this.alive           = true;
    this.contactCooldown = 0;
    this.speedMult         = _floorMult(C.FLOOR_SPEED_BONUS, C.FLOOR_SPEED_CAP);
    this.shielded          = false;
    this.shieldFreezeTimer = 0;
    // Rising phase — invulnerable until fully emerged
    this.rising          = true;
    this.riseTimer       = C.MUMMY_RISE_FRAMES;
    // Fly release
    this.flyTimer        = C.MUMMY_FLY_COOLDOWN;
    this.mouthOpen       = 0;  // frames of mouth-open animation
    this.wrappingPhase   = randFloat(0, Math.PI * 2);
  }

  update(player, room) {
    if (!this.alive) return;
    if (this.shieldFreezeTimer > 0) { this.shieldFreezeTimer--; return; }

    if (this.rising) {
      this.riseTimer--;
      this.wrappingPhase += 0.02;
      if (this.riseTimer <= 0) {
        this.rising = false;
        AudioEngine.playSFX('mummy_awaken');
      }
      return;
    }

    // Shamble toward player
    const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
    this.vel.x = n.x * C.MUMMY_SPEED * this.speedMult;
    this.vel.y = n.y * C.MUMMY_SPEED * this.speedMult;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this._resolveCollisions(room);
    this.wrappingPhase += 0.04;

    // Release flies periodically
    this.flyTimer--;
    if (this.mouthOpen > 0) this.mouthOpen--;
    if (this.flyTimer <= 0) {
      this._releaseFlies(C.MUMMY_FLY_COUNT);
      this.flyTimer = C.MUMMY_FLY_COOLDOWN;
      this.mouthOpen = 40;
    }

    // Contact damage
    if (this.contactCooldown > 0) this.contactCooldown--;
    if (this.contactCooldown === 0 &&
        circleCollide(this.pos.x, this.pos.y, this.radius, player.pos.x, player.pos.y, player.radius)) {
      player.takeDamage(C.MUMMY_CONTACT_DAMAGE);
      this.contactCooldown = C.GHOST_CONTACT_COOLDOWN;
    }
  }

  _releaseFlies(count) {
    AudioEngine.playSFX('mummy_flies');
    for (let i = 0; i < count; i++) {
      const a = randFloat(0, Math.PI * 2);
      const d = this.radius + 6 + Math.random() * 8;
      G.flies.push(new MummyFly(this.pos.x + Math.cos(a) * d, this.pos.y + Math.sin(a) * d));
    }
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

  takeDamage(amount) {
    if (this.rising) return;  // invulnerable while rising
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      AudioEngine.playSFX('death');
      _spawnDeathFX(this);
      // Clear all flies when this mummy dies (one per floor, so safe to clear all)
      G.flies.length = 0;
    }
  }
}

// ── Mummy Boss ────────────────────────────────────────────────────────────

class MummyBossEnemy {
  constructor(x, y) {
    this.pos            = { x, y };
    this.vel            = { x: 0, y: 0 };
    this.hp             = C.MUMMY_BOSS_HP;
    this.maxHp          = C.MUMMY_BOSS_HP;
    this.radius         = C.MUMMY_BOSS_RADIUS;
    this.type           = 'mummy_boss';
    this.scoreValue     = C.SCORE_MUMMY_BOSS;
    this.alive          = true;
    this.phase          = 1;
    this.prevPhase      = 1;
    this.transitionTimer = 0;
    this.speedMult      = _floorMult(C.FLOOR_SPEED_BONUS, C.FLOOR_SPEED_CAP);
    // Rising
    this.rising         = true;
    this.riseTimer      = C.MUMMY_RISE_FRAMES + 60; // slightly longer rise for boss
    // Flies
    this.flyTimer       = 0;  // fire first salvo soon after rising
    this.mouthOpen      = 0;
    this.wrappingPhase  = 0;
    this.contactCooldown = 0;
    this.minionTimer    = 300;  // frames after rising until first minion spawn
  }

  get flyConfig() {
    if (this.phase === 3) return { count: 5, cooldown: 120 };
    if (this.phase === 2) return { count: 3, cooldown: 200 };
    return                       { count: 2, cooldown: 300 };
  }

  get speed() {
    const base = this.phase === 3 ? C.BOSS_SPEED_3 * 0.8
               : this.phase === 2 ? C.BOSS_SPEED_2 * 0.8
               :                    C.BOSS_SPEED_1 * 0.7;
    return base * this.speedMult;
  }

  update(player, room) {
    if (!this.alive) return;

    // Phase check
    const hpFrac = this.hp / this.maxHp;
    this.phase = hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;
    if (this.phase > this.prevPhase) {
      this.transitionTimer = C.BOSS_PHASE_TRANSITION_FRAMES;
      this.prevPhase = this.phase;
      AudioEngine.playSFX('boss_phase');
    }
    if (this.transitionTimer > 0) this.transitionTimer--;

    if (this.rising) {
      this.riseTimer--;
      this.wrappingPhase += 0.015;
      if (this.riseTimer <= 0) {
        this.rising = false;
        this.flyTimer = 60;  // first fly release shortly after awakening
        AudioEngine.playSFX('mummy_awaken');
      }
      return;
    }

    // Shamble toward player
    const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
    this.vel.x = n.x * this.speed;
    this.vel.y = n.y * this.speed;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.wrappingPhase += 0.035;

    for (const w of getWallRects()) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, w.x, w.y, w.w, w.h);
      if (push) { this.pos.x += push.x; this.pos.y += push.y; }
    }
    for (const obs of room.obstacles) {
      const push = resolveCircleRect(this.pos.x, this.pos.y, this.radius, obs.x, obs.y, obs.w, obs.h);
      if (push) { this.pos.x += push.x; this.pos.y += push.y; }
    }

    // Fly release
    this.flyTimer--;
    if (this.mouthOpen > 0) this.mouthOpen--;
    if (this.flyTimer <= 0) {
      const { count, cooldown } = this.flyConfig;
      AudioEngine.playSFX('mummy_flies');
      for (let i = 0; i < count; i++) {
        const a = randFloat(0, Math.PI * 2);
        const d = this.radius + 8 + Math.random() * 10;
        G.flies.push(new MummyFly(this.pos.x + Math.cos(a) * d, this.pos.y + Math.sin(a) * d));
      }
      this.flyTimer = cooldown;
      this.mouthOpen = 50;
    }

    // Minion spawning — phase 2+ spawns ghouls; phase 3 also sometimes spawns a small mummy
    if (this.phase >= 2) {
      this.minionTimer--;
      if (this.minionTimer <= 0) {
        const interval = this.phase === 3 ? 280 : 400;
        this.minionTimer = interval;
        // Always spawn a ghoul
        const gp = _bossMinionPos(this.pos.x, this.pos.y, C.GHOUL_RADIUS);
        if (gp) { const m = new GhoulEnemy(gp.x, gp.y); m.bossMinion = true; G.enemies.push(m); }
        // Phase 3: 40% chance to also raise a small mummy
        if (this.phase === 3 && Math.random() < 0.40) {
          const mp = _bossMinionPos(this.pos.x, this.pos.y, C.MUMMY_RADIUS);
          if (mp) { const m = new MummyEnemy(mp.x, mp.y); m.bossMinion = true; G.enemies.push(m); }
        }
      }
    }

    // Contact damage
    if (this.contactCooldown > 0) this.contactCooldown--;
    if (this.contactCooldown === 0 &&
        circleCollide(this.pos.x, this.pos.y, this.radius, player.pos.x, player.pos.y, player.radius)) {
      player.takeDamage(C.MUMMY_CONTACT_DAMAGE * 1.5);
      this.contactCooldown = C.GHOST_CONTACT_COOLDOWN;
    }
  }

  takeDamage(amount) {
    if (this.rising || this.transitionTimer > 0) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      AudioEngine.playSFX('death');
      _spawnDeathFX(this);
      _clearBossMinions();
      const room = G.currentRoom;
      for (const dir of ['north', 'south', 'east', 'west']) {
        if (room.connections[dir]) room.bossDoorsLocked = false;
      }
      room.bossDoorsLocked = false;
    }
  }
}

// ── Ghoul Boss ────────────────────────────────────────────────────────────

class GhoulBossEnemy {
  constructor(x, y) {
    this.pos             = { x, y };
    this.vel             = { x: 0, y: 0 };
    this.hp              = C.GHOUL_BOSS_HP;
    this.maxHp           = C.GHOUL_BOSS_HP;
    this.radius          = C.GHOUL_BOSS_RADIUS;
    this.type            = 'ghoul_boss';
    this.scoreValue      = C.SCORE_GHOUL_BOSS;
    this.alive           = true;
    this.phase           = 1;
    this.prevPhase       = 1;
    this.transitionTimer = 0;
    this.speedMult       = _floorMult(C.FLOOR_SPEED_BONUS, C.FLOOR_SPEED_CAP);
    this.contactCooldown = 0;
    this.leaping         = false;
    this.leapDuration    = 0;
    this.leapTimer       = 60;
    this.windupTimer     = 0;   // pre-leap tell: counts down before leap starts
    this.minionTimer     = 300;
    this.crawlPhase      = randFloat(0, Math.PI * 2);
    this.eyeOff          = 5 + randFloat(0, 3);

    this.bodyPts = Array.from({ length: 10 }, (_, i) => {
      const a  = (Math.PI * 2 / 10) * i;
      const rx = (1.2 + randFloat(-0.25, 0.25)) * Math.cos(a);
      const ry = (0.8  + randFloat(-0.15, 0.15)) * Math.sin(a);
      return [rx, ry];
    });
    const legBaseAngles = [-Math.PI/4, Math.PI/4, Math.PI*0.75, Math.PI*1.25];
    this.legs = legBaseAngles.map(baseA => {
      const nJoints = Math.random() < 0.5 ? 2 : 3;
      const total   = 14 + randFloat(-2, 4);
      const base    = total / (nJoints + 1);
      return {
        dir:     baseA + randFloat(-0.35, 0.35),
        segLens: Array.from({ length: nJoints + 1 }, () => base + randFloat(-2, 2)),
        bends:   Array.from({ length: nJoints },     () => randFloat(-0.6, 0.6)),
      };
    });
  }

  get _leapCooldownMin() { return this.phase === 3 ? 40 : this.phase === 2 ? 70 : 100; }
  get _leapCooldownMax() { return this.phase === 3 ? 70 : this.phase === 2 ? 110 : 160; }
  get _windupFrames()    { return 28; }  // tell duration before the leap fires
  get _leapSpeed()       {
    const b = this.phase === 3 ? 8.0 : this.phase === 2 ? 7.5 : 7.0;
    return b * this.speedMult;
  }
  get _crawlSpeed()      {
    const b = this.phase === 3 ? 2.2 : this.phase === 2 ? 1.8 : 1.4;
    return b * this.speedMult;
  }

  update(player, room) {
    if (!this.alive) return;

    const hpFrac = this.hp / this.maxHp;
    this.phase = hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;
    if (this.phase > this.prevPhase) {
      this.transitionTimer = C.BOSS_PHASE_TRANSITION_FRAMES;
      this.prevPhase = this.phase;
      AudioEngine.playSFX('boss_phase');
    }
    if (this.transitionTimer > 0) { this.transitionTimer--; return; }

    if (this.leaping) {
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * this._leapSpeed;
      this.vel.y = n.y * this._leapSpeed;
      this.leapDuration--;
      if (this.leapDuration <= 0) {
        this.leaping   = false;
        this.leapTimer = randInt(this._leapCooldownMin, this._leapCooldownMax);
      }
    } else if (this.windupTimer > 0) {
      // Tell phase — crouch in place, don't move
      this.vel.x = 0; this.vel.y = 0;
      this.windupTimer--;
      if (this.windupTimer <= 0) {
        this.leaping = true; this.leapDuration = 22;
        AudioEngine.playSFX('ghoul_boss_leap');
      }
    } else {
      const n = normalizeVec(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
      this.vel.x = n.x * this._crawlSpeed;
      this.vel.y = n.y * this._crawlSpeed;
      this.leapTimer--;
      if (this.leapTimer <= 0) {
        this.windupTimer = this._windupFrames;
      }
    }

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this._resolveCollisions(room);
    this.crawlPhase += 0.09;

    // Minion spawning (phase 2+)
    if (this.phase >= 2) {
      this.minionTimer--;
      if (this.minionTimer <= 0) {
        this.minionTimer = this.phase === 3 ? 240 : 360;
        const p = _bossMinionPos(this.pos.x, this.pos.y,
          this.phase === 3 ? C.LONG_GHOUL_RADIUS : C.GHOUL_RADIUS);
        if (p) {
          const m = this.phase === 3 ? new LongGhoulEnemy(p.x, p.y) : new GhoulEnemy(p.x, p.y);
          m.bossMinion = true;
          G.enemies.push(m);
        }
      }
    }

    if (this.contactCooldown > 0) this.contactCooldown--;
    if (this.contactCooldown === 0 &&
        circleCollide(this.pos.x, this.pos.y, this.radius, player.pos.x, player.pos.y, player.radius)) {
      player.takeDamage(C.GHOUL_BOSS_CONTACT_DAMAGE);
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
    if (this.transitionTimer > 0) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      AudioEngine.playSFX('death');
      _spawnDeathFX(this);
      _clearBossMinions();
      G.currentRoom.bossDoorsLocked = false;
    }
  }
}

// ── Boss cleanup ──────────────────────────────────────────────────────────

// Kill all boss-summoned minions and clear every fly when a boss dies.
function _clearBossMinions() {
  for (const e of G.enemies) {
    if (e.bossMinion) e.alive = false;
  }
  G.flies.length = 0;
}

// ── Spawn helpers ─────────────────────────────────────────────────────────

// Find a position for a boss minion: random direction from boss, clear of walls/obstacles.
function _bossMinionPos(bossX, bossY, radius) {
  const zone = _spawnZone(G.currentRoom);
  for (let i = 0; i < 40; i++) {
    const a = randFloat(0, Math.PI * 2);
    const d = 80 + Math.random() * 120;
    const x = Math.max(zone.minX, Math.min(zone.maxX, bossX + Math.cos(a) * d));
    const y = Math.max(zone.minY, Math.min(zone.maxY, bossY + Math.sin(a) * d));
    let blocked = false;
    for (const obs of G.currentRoom.obstacles) {
      if (circleRectCollide(x, y, radius + 8, obs.x, obs.y, obs.w, obs.h)) { blocked = true; break; }
    }
    if (!blocked) {
      for (const w of getWallRects()) {
        if (circleRectCollide(x, y, radius + 8, w.x, w.y, w.w, w.h)) { blocked = true; break; }
      }
    }
    if (!blocked) return { x, y };
  }
  return null;
}

function _spawnZone(_room) {
  const P      = C.ROOM_PADDING;
  const margin = 30;
  return {
    minX: P + margin, maxX: C.WIDTH  - P - margin,
    minY: P + margin, maxY: C.HEIGHT - P - margin,
  };
}

function _validPos(x, y, radius, room, safeR, px, py) {
  const dx = x - C.WIDTH / 2, dy = y - C.HEIGHT / 2;
  if (dx * dx + dy * dy < safeR * safeR) return false;
  if (px !== undefined) {
    const epx = x - px, epy = y - py;
    if (epx * epx + epy * epy < C.ENEMY_SPAWN_PLAYER_SAFE_R * C.ENEMY_SPAWN_PLAYER_SAFE_R) return false;
  }
  for (const obs of room.obstacles) {
    if (circleRectCollide(x, y, radius + 8, obs.x, obs.y, obs.w, obs.h)) return false;
  }
  return true;
}

function spawnGhosts(room, px, py) {
  const ghosts = [];
  const count  = room.enemyCount !== undefined ? room.enemyCount : C.GHOST_COUNT;
  const z      = _spawnZone(room);
  for (let i = 0; i < count * 15 && ghosts.length < count; i++) {
    const x = randFloat(z.minX, z.maxX);
    const y = randFloat(z.minY, z.maxY);
    if (_validPos(x, y, C.GHOST_RADIUS, room, 110, px, py)) ghosts.push(new GhostEnemy(x, y));
  }
  return ghosts;
}

function spawnSkulls(room, px, py) {
  const skulls = [];
  const count  = Math.max(1, Math.floor(room.enemyCount / 2));
  const z      = _spawnZone(room);
  for (let i = 0; i < count * 15 && skulls.length < count; i++) {
    const x = randFloat(z.minX, z.maxX);
    const y = randFloat(z.minY, z.maxY);
    if (_validPos(x, y, C.SKULL_RADIUS, room, 120, px, py)) skulls.push(new SkullEnemy(x, y));
  }
  return skulls;
}

function spawnBoss() {
  // Boss cycle: skull (floor 1,4,7…), ghoul (2,5,8…), mummy (3,6,9…)
  const m = (G.floor || 1) % 3;
  if (m === 0) return [new MummyBossEnemy(C.WIDTH / 2, C.HEIGHT / 2)];
  if (m === 2) return [new GhoulBossEnemy(C.WIDTH / 2, C.HEIGHT / 2)];
  return [new BossEnemy(C.WIDTH / 2, C.HEIGHT / 2)];
}

function spawnGhouls(room, px, py) {
  const ghouls = [];
  const count  = Math.max(1, Math.floor(room.enemyCount / 3));
  const z      = _spawnZone(room);
  for (let i = 0; i < count * 15 && ghouls.length < count; i++) {
    const x = randFloat(z.minX, z.maxX);
    const y = randFloat(z.minY, z.maxY);
    if (_validPos(x, y, C.GHOUL_RADIUS, room, 120, px, py)) ghouls.push(new GhoulEnemy(x, y));
  }
  return ghouls;
}

// Probability that long ghouls appear in a room: ~5% floor 1, ~80% floor 5+
function _longGhoulChance() {
  return Math.min(0.80, Math.max(0.05, (G.floor - 1) * 0.20));
}

// Nuckelavee: 0 on floor 1, ~25% from floor 2, capped at 30%. One per room maximum.
function _nuckelaveeChance() {
  if ((G.floor || 1) < 2) return 0;
  return Math.min(0.30, 0.25);
}

function spawnNuckelavee(room, px, py) {
  const z = _spawnZone(room);
  for (let i = 0; i < 30; i++) {
    const x = randFloat(z.minX, z.maxX);
    const y = randFloat(z.minY, z.maxY);
    if (_validPos(x, y, C.NUCKELAVEE_RADIUS, room, 130, px, py))
      return [new NuckelaveeEnemy(x, y)];
  }
  return [];
}

// White skull probability: 0 below floor 3, ~20% floor 3, up to ~60% floor 5+
function _whiteSkullChance() {
  if ((G.floor || 1) < 3) return 0;
  return Math.min(0.60, 0.20 + ((G.floor || 1) - 3) * 0.20);
}

function spawnWhiteSkulls(room, px, py) {
  const z = _spawnZone(room);
  for (let i = 0; i < 30; i++) {
    const x = randFloat(z.minX, z.maxX);
    const y = randFloat(z.minY, z.maxY);
    if (_validPos(x, y, C.WHITE_SKULL_RADIUS, room, 120, px, py))
      return [new WhiteSkullEnemy(x, y)];
  }
  return [];
}

function spawnLongGhouls(room, px, py) {
  const longGhouls = [];
  const count      = Math.max(1, Math.floor(room.enemyCount / 4));
  const z          = _spawnZone(room);
  for (let i = 0; i < count * 15 && longGhouls.length < count; i++) {
    const x = randFloat(z.minX, z.maxX);
    const y = randFloat(z.minY, z.maxY);
    if (_validPos(x, y, C.LONG_GHOUL_RADIUS, room, 120, px, py)) longGhouls.push(new LongGhoulEnemy(x, y));
  }
  return longGhouls;
}

// Main entry point called by state.js.
// px/py is the player's entry position so enemies don't spawn on top of them.
function spawnEnemies(room, px, py) {
  let enemies;
  if (room.type === 'boss')        enemies = spawnBoss();
  else if (room.type === 'skull') {
    const lg = Math.random() < _longGhoulChance()  ? spawnLongGhouls(room, px, py)  : [];
    const ws = Math.random() < _whiteSkullChance() ? spawnWhiteSkulls(room, px, py) : [];
    const nk = Math.random() < _nuckelaveeChance() ? spawnNuckelavee(room, px, py)  : [];
    enemies = [...spawnSkulls(room, px, py), ...spawnGhouls(room, px, py), ...lg, ...ws, ...nk];
  } else if (room.type === 'mixed') {
    const lg = Math.random() < _longGhoulChance()  ? spawnLongGhouls(room, px, py)  : [];
    const ws = Math.random() < _whiteSkullChance() ? spawnWhiteSkulls(room, px, py) : [];
    const nk = Math.random() < _nuckelaveeChance() ? spawnNuckelavee(room, px, py)  : [];
    enemies = [...spawnGhosts(room, px, py), ...spawnSkulls(room, px, py), ...spawnGhouls(room, px, py), ...lg, ...ws, ...nk];
  }
  else                             enemies = spawnGhosts(room, px, py);

  // Append the floor's rare mummy if this room was selected
  if (room.hasMummy) {
    const z = _spawnZone(room);
    for (let i = 0; i < 30; i++) {
      const x = randFloat(z.minX, z.maxX);
      const y = randFloat(z.minY, z.maxY);
      if (_validPos(x, y, C.MUMMY_RADIUS, room, 110, px, py)) {
        enemies.push(new MummyEnemy(x, y)); break;
      }
    }
  }

  // Randomly designate one enemy as elite (shielded until all others die).
  // Boss rooms are exempt. Probability ramps 20% at floor 2 → 30% at floor 5+.
  if (room.type !== 'boss' && enemies.length >= 2 && G.floor >= 2) {
    const chance = Math.min(0.30, 0.20 + (G.floor - 2) * (0.10 / 3));
    if (Math.random() < chance) {
      enemies[Math.floor(Math.random() * enemies.length)].shielded = true;
    }
  }
  return enemies;
}
