class Bullet {
  constructor() {
    this.active    = false;
    this.pos       = { x: 0, y: 0 };
    this.vel       = { x: 0, y: 0 };
    this.ttl       = 0;
    this.owner     = 'player';   // 'player' | 'enemy'
    this.damage    = C.BULLET_DAMAGE;
    this.radius    = C.BULLET_RADIUS;
    this.weave     = null;       // set by fireWeaving(); null for straight shots
    this.canBounce = false;      // true when player has bounce upgrade
    this.bounces   = 0;          // wall bounces used (max 1; deactivates on 2nd wall)
  }

  deactivate() { this.active = false; this.weave = null; this.canBounce = false; this.bounces = 0; }
}

class BulletPool {
  constructor() {
    this.pool = [];
    for (let i = 0; i < C.POOL_SIZE; i++) {
      this.pool.push(new Bullet());
    }
  }

  fire(x, y, vx, vy, owner, damage, radius, canBounce) {
    const b = this.pool.find(b => !b.active);
    if (!b) return;
    b.active    = true;
    b.pos.x     = x;
    b.pos.y     = y;
    b.vel.x     = vx;
    b.vel.y     = vy;
    b.ttl       = C.BULLET_TTL;
    b.owner     = owner  || 'player';
    b.damage    = damage || C.BULLET_DAMAGE;
    b.radius    = radius !== undefined ? radius : C.BULLET_RADIUS;
    b.weave     = null;
    b.canBounce = !!canBounce;
    b.bounces   = 0;
  }

  // Fire a bullet that weaves side to side along its flight path.
  fireWeaving(x, y, vx, vy, owner, damage) {
    const b = this.pool.find(b => !b.active);
    if (!b) return;
    b.active   = true;
    b.pos.x    = x;
    b.pos.y    = y;
    b.vel.x    = vx;
    b.vel.y    = vy;
    b.ttl      = C.BULLET_TTL;
    b.owner    = owner  || 'enemy';
    b.damage   = damage || C.BULLET_DAMAGE;
    b.radius   = C.BULLET_RADIUS;
    b.weave    = {
      baseAngle: Math.atan2(vy, vx),
      speed:     Math.hypot(vx, vy),
      freq:      C.WHITE_SKULL_WEAVE_FREQ,
      maxDev:    C.WHITE_SKULL_WEAVE_MAX_DEV,
      age:       0,
    };
  }

  update(player, enemies, room) {
    const walls = getWallRects();

    for (const b of this.pool) {
      if (!b.active) continue;

      // Weaving bullets: steer velocity along a sinusoidal arc
      if (b.weave) {
        b.weave.age++;
        const dev = Math.sin(b.weave.age * b.weave.freq) * b.weave.maxDev;
        b.vel.x = Math.cos(b.weave.baseAngle + dev) * b.weave.speed;
        b.vel.y = Math.sin(b.weave.baseAngle + dev) * b.weave.speed;
      }

      const prevX = b.pos.x;
      const prevY = b.pos.y;
      b.pos.x += b.vel.x;
      b.pos.y += b.vel.y;
      b.ttl--;

      if (b.ttl <= 0) { b.deactivate(); continue; }

      // Wall collision — bouncing player bullets reflect once; any other bullet dies
      let dead = false;
      let bounced = false;
      for (const w of walls) {
        if (circleRectCollide(b.pos.x, b.pos.y, b.radius, w.x, w.y, w.w, w.h)) {
          if (b.canBounce && b.bounces < 1) {
            // Determine which velocity component caused the collision
            const hitsX = circleRectCollide(b.pos.x, prevY, b.radius, w.x, w.y, w.w, w.h);
            const hitsY = circleRectCollide(prevX, b.pos.y, b.radius, w.x, w.y, w.w, w.h);
            if (hitsX) b.vel.x = -b.vel.x;
            if (hitsY) b.vel.y = -b.vel.y;
            if (!hitsX && !hitsY) { b.vel.x = -b.vel.x; b.vel.y = -b.vel.y; } // exact corner
            b.pos.x = prevX + b.vel.x;
            b.pos.y = prevY + b.vel.y;
            b.bounces++;
            bounced = true;
          } else {
            dead = true;
          }
          break;
        }
      }
      // Obstacle collision (bullets never bounce off obstacles)
      if (!dead && !bounced) {
        for (const obs of room.obstacles) {
          if (circleRectCollide(b.pos.x, b.pos.y, b.radius, obs.x, obs.y, obs.w, obs.h)) {
            dead = true; break;
          }
        }
      }
      if (dead) { b.deactivate(); continue; }

      // Hit enemies (player bullets only)
      if (b.owner === 'player') {
        for (const e of enemies) {
          if (!e.alive) continue;

          // Shield intercept: boss during phase transition, or elite shielded enemy.
          // Shield radius is larger than the body, so a bullet reaching the body
          // must pass through the shield first — only one check needed.
          const shieldR = ((e.type === 'boss' || e.type === 'ghoul_boss' || e.type === 'ashtaroth_boss') && e.arriving) ? e.radius + 18
                        : ((e.type === 'boss' || e.type === 'mummy_boss' || e.type === 'ghoul_boss' || e.type === 'ashtaroth_boss') && e.transitionTimer > 0) ? e.radius + 18
                        : e.shielded ? e.radius + 12
                        : 0;
          if (shieldR > 0) {
            if (circleCollide(b.pos.x, b.pos.y, b.radius, e.pos.x, e.pos.y, shieldR)) {
              // Redirect damage to any enemy currently inside the shield
              const proxies = enemies.filter(o => o !== e && o.alive && !o.shielded &&
                circleCollide(o.pos.x, o.pos.y, o.radius, e.pos.x, e.pos.y, shieldR));
              if (proxies.length > 0) {
                proxies[Math.floor(Math.random() * proxies.length)].takeDamage(b.damage);
              } else {
                _spawnShieldSparks(b.pos.x, b.pos.y, b.vel.x, b.vel.y);
              }
              b.deactivate();
              break;
            }
            continue;  // shielded — don't check body
          }

          if (circleCollide(b.pos.x, b.pos.y, b.radius, e.pos.x, e.pos.y, e.radius)) {
            e.takeDamage(b.damage);
            if (b.radius > C.BULLET_RADIUS) G.freezeUntil = performance.now() + C.POWER_HIT_FREEZE_MS;
            b.deactivate();
            break;
          }
        }
      }
    }
  }
}

// Spawn a small burst of yellow sparks at the bullet's impact point on a shield.
// Sparks scatter roughly back along the bullet's travel direction.
function _spawnShieldSparks(bx, by, bvx, bvy) {
  const dir   = Math.atan2(bvy, bvx);
  const speed = Math.hypot(bvx, bvy);
  for (let i = 0; i < 6; i++) {
    const spread = (Math.random() - 0.5) * Math.PI * 0.9;
    const a = dir + Math.PI + spread;
    const s = speed * (0.4 + Math.random() * 0.7);
    G.shieldSparks.push({
      x: bx, y: by,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life:    8 + Math.floor(Math.random() * 7),
      maxLife: 15,
    });
  }
}
