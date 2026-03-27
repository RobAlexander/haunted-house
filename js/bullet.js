class Bullet {
  constructor() {
    this.active = false;
    this.pos    = { x: 0, y: 0 };
    this.vel    = { x: 0, y: 0 };
    this.ttl    = 0;
    this.owner  = 'player';   // 'player' | 'enemy'
    this.damage = C.BULLET_DAMAGE;
    this.radius = C.BULLET_RADIUS;
  }

  deactivate() { this.active = false; }
}

class BulletPool {
  constructor() {
    this.pool = [];
    for (let i = 0; i < C.POOL_SIZE; i++) {
      this.pool.push(new Bullet());
    }
  }

  fire(x, y, vx, vy, owner, damage, radius) {
    const b = this.pool.find(b => !b.active);
    if (!b) return;
    b.active   = true;
    b.pos.x    = x;
    b.pos.y    = y;
    b.vel.x    = vx;
    b.vel.y    = vy;
    b.ttl      = C.BULLET_TTL;
    b.owner    = owner  || 'player';
    b.damage   = damage || C.BULLET_DAMAGE;
    b.radius   = radius !== undefined ? radius : C.BULLET_RADIUS;
  }

  update(player, enemies, room) {
    const walls = getWallRects();

    for (const b of this.pool) {
      if (!b.active) continue;

      b.pos.x += b.vel.x;
      b.pos.y += b.vel.y;
      b.ttl--;

      if (b.ttl <= 0) { b.deactivate(); continue; }

      // Wall collision
      let dead = false;
      for (const w of walls) {
        if (circleRectCollide(b.pos.x, b.pos.y, b.radius, w.x, w.y, w.w, w.h)) {
          dead = true; break;
        }
      }
      // Obstacle collision
      if (!dead) {
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
          const shieldR = (e.type === 'boss' && e.transitionTimer > 0) ? e.radius + 18
                        : e.shielded ? e.radius + 12
                        : 0;
          if (shieldR > 0) {
            if (circleCollide(b.pos.x, b.pos.y, b.radius, e.pos.x, e.pos.y, shieldR)) {
              _spawnShieldSparks(b.pos.x, b.pos.y, b.vel.x, b.vel.y);
              b.deactivate();
              break;
            }
            continue;  // shielded — don't check body
          }

          if (circleCollide(b.pos.x, b.pos.y, b.radius, e.pos.x, e.pos.y, e.radius)) {
            e.takeDamage(b.damage);
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
