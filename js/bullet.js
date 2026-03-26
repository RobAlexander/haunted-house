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
