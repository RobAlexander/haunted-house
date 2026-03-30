// ── Room ──────────────────────────────────────────────────────────────────

class Room {
  constructor(gx, gy, depth) {
    this.gx              = gx    || 0;
    this.gy              = gy    || 0;
    this.depth           = depth || 0;
    this.type            = 'normal';   // 'start'|'normal'|'ghost'|'skull'|'mixed'|'boss'|'treasure'
    this.cleared         = false;
    this.visited         = false;
    this.bossDoorsLocked = false;      // set true on boss rooms until boss dies
    this.connections     = { north: null, south: null, east: null, west: null };
    this.obstacles       = this._generateObstacles();
    this.enemyCount      = 0;          // set by DungeonGraph after type assignment
    this.pickup          = null;       // { x, y, amount } health orb, or null
  }

  _generateObstacles() {
    const obstacles = [];
    const P      = C.ROOM_PADDING;
    const margin = 24;
    const minX   = P + margin, maxX = C.WIDTH  - P - margin;
    const minY   = P + margin, maxY = C.HEIGHT - P - margin;

    // Boss/treasure rooms get fewer obstacles so there's room to manoeuvre
    const count = (this.type === 'boss' || this.type === 'treasure') ? randInt(1, 3) : randInt(3, 6);

    const centerSafeR = 90;
    for (let a = 0; a < count * 12 && obstacles.length < count; a++) {
      const w = randInt(50, 110), h = randInt(25, 60);
      const x = randInt(minX, maxX - w), y = randInt(minY, maxY - h);
      const cx = x + w / 2, cy = y + h / 2;
      const dx = cx - C.WIDTH / 2, dy = cy - C.HEIGHT / 2;
      if (dx * dx + dy * dy < centerSafeR * centerSafeR) continue;
      const pad = 12;
      let overlap = false;
      for (const o of obstacles) {
        if (x < o.x+o.w+pad && x+w > o.x-pad && y < o.y+o.h+pad && y+h > o.y-pad) { overlap = true; break; }
      }
      if (!overlap) obstacles.push({ x, y, w, h });
    }
    return obstacles;
  }
}

// ── DungeonGraph ──────────────────────────────────────────────────────────

class DungeonGraph {
  constructor() {
    this.grid      = new Map();
    this.startRoom = null;
    this.bossRoom  = null;
    this._generate();
  }

  _key(x, y) { return `${x},${y}`; }

  _generate() {
    const target = randInt(C.MIN_ROOMS, C.MAX_ROOMS);

    const DIRS = [
      { dx:  0, dy: -1, dir: 'north', opp: 'south' },
      { dx:  0, dy:  1, dir: 'south', opp: 'north' },
      { dx:  1, dy:  0, dir: 'east',  opp: 'west'  },
      { dx: -1, dy:  0, dir: 'west',  opp: 'east'  },
    ];

    const start   = new Room(0, 0, 0);
    start.type    = 'start';
    start.cleared = true;
    this.grid.set(this._key(0, 0), start);
    this.startRoom = start;

    const frontier = [{ room: start, gx: 0, gy: 0 }];

    while (this.grid.size < target && frontier.length > 0) {
      const idx              = randInt(0, frontier.length - 1);
      const { room, gx, gy } = frontier[idx];
      const dirs             = [...DIRS].sort(() => Math.random() - 0.5);
      let placed = false;

      for (const { dx, dy, dir, opp } of dirs) {
        if (this.grid.size >= target) break;
        const nx = gx + dx, ny = gy + dy;
        const nk = this._key(nx, ny);
        if (this.grid.has(nk)) continue;

        const newRoom             = new Room(nx, ny, room.depth + 1);
        this.grid.set(nk, newRoom);
        room.connections[dir]     = newRoom;
        newRoom.connections[opp]  = room;
        frontier.push({ room: newRoom, gx: nx, gy: ny });
        placed = true;
        break;
      }
      if (!placed) frontier.splice(idx, 1);
    }

    this._assignTypes();
  }

  _assignTypes() {
    const rooms = [...this.grid.values()];

    // Boss room = deepest room (min depth 4, or deepest available)
    const nonStart  = rooms.filter(r => r.type !== 'start');
    const maxDepth  = Math.max(...nonStart.map(r => r.depth));
    const deepest   = nonStart.filter(r => r.depth === maxDepth);
    const bossRoom  = deepest[randInt(0, deepest.length - 1)];
    bossRoom.type        = 'boss';
    bossRoom.bossDoorsLocked = true;
    this.bossRoom        = bossRoom;

    // Treasure room = dead-end (only 1 connection) at depth >= 2, not the boss room
    const deadEnds = nonStart.filter(r =>
      r !== bossRoom &&
      r.depth >= 2 &&
      Object.values(r.connections).filter(Boolean).length === 1
    );
    if (deadEnds.length > 0) {
      const tr  = deadEnds[randInt(0, deadEnds.length - 1)];
      tr.type   = 'treasure';
      tr.pickup = { x: C.WIDTH / 2, y: C.HEIGHT / 2, amount: C.PICKUP_HEAL_AMOUNT };
      tr.cleared = true;

      // Possibly place a powerup in a second dead-end — random from three options
      const remaining = deadEnds.filter(r => r !== tr);
      if (remaining.length > 0 && Math.random() < 0.65) {
        const wr   = remaining[randInt(0, remaining.length - 1)];
        const pick = Math.random();
        wr.cleared = true;
        if (pick < 0.30) {
          wr.widePowerup       = { x: C.WIDTH / 2, y: C.HEIGHT / 2 };
          wr.widePowerupActive = false;
          wr.widePowerupTaken  = false;
        } else if (pick < 0.55) {
          wr.speedPowerup       = { x: C.WIDTH / 2, y: C.HEIGHT / 2 };
          wr.speedPowerupActive = false;
          wr.speedPowerupTaken  = false;
        } else if (pick < 0.77) {
          wr.invulnPowerup       = { x: C.WIDTH / 2, y: C.HEIGHT / 2 };
          wr.invulnPowerupActive = false;
          wr.invulnPowerupTaken  = false;
        } else {
          wr.autofirePowerup       = { x: C.WIDTH / 2, y: C.HEIGHT / 2 };
          wr.autofirePowerupActive = false;
          wr.autofirePowerupTaken  = false;
        }
      }
      // Rarely place max-HP powerup in a third dead-end (instant collect, no inventory slot)
      const remaining2 = remaining.filter(r => !r.widePowerup);
      if (remaining2.length > 0 && Math.random() < 0.35) {
        const mr = remaining2[randInt(0, remaining2.length - 1)];
        mr.maxhpPowerup       = { x: C.WIDTH / 2, y: C.HEIGHT / 2 };
        mr.maxhpPowerupActive = false;
        mr.maxhpPowerupTaken  = false;
        mr.cleared            = true;
      }
    }

    // Assign combat types and enemy counts to remaining rooms (scale with floor)
    const fb = (G.floor || 1) - 1;
    for (const room of nonStart) {
      if (room.type !== 'normal') continue;
      const d = room.depth;
      if (d <= 2) {
        room.type       = 'ghost';
        room.enemyCount = randInt(2, 3 + fb);
      } else if (d <= 4) {
        room.type       = 'skull';
        room.enemyCount = randInt(2, 3 + fb);
      } else {
        room.type       = 'mixed';
        room.enemyCount = randInt(2 + fb, 4 + fb);
      }
    }

    // Compute actual average enemies across combat rooms (used to scale drop heal amounts)
    const combatRooms = nonStart.filter(r => r.type !== 'boss' && r.type !== 'treasure' && r.enemyCount);
    this.avgEnemiesPerRoom = combatRooms.length
      ? combatRooms.reduce((s, r) => s + r.enemyCount, 0) / combatRooms.length
      : C.DROP_HEAL_BASELINE_ENEMIES;

    // Assign floor symbols to eligible rooms.
    // Excluded: start, boss, treasure rooms.
    const symbolPool = nonStart.filter(r =>
      r !== bossRoom && r.type !== 'treasure'
    );
    // Fisher-Yates shuffle
    for (let i = symbolPool.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [symbolPool[i], symbolPool[j]] = [symbolPool[j], symbolPool[i]];
    }
    getFloorSymbols(G.floor).forEach((letter, i) => {
      if (i >= symbolPool.length) return;
      const room = symbolPool[i];
      // Find a position not inside any obstacle (up to 60 attempts)
      let sx = C.WIDTH / 2, sy = C.HEIGHT / 2;
      for (let t = 0; t < 60; t++) {
        const tx = C.WIDTH  / 2 + randFloat(-70, 70);
        const ty = C.HEIGHT / 2 + randFloat(-50, 50);
        let blocked = false;
        for (const obs of room.obstacles) {
          if (circleRectCollide(tx, ty, C.RAG_SYMBOL_COLLECT_R + 4, obs.x, obs.y, obs.w, obs.h)) {
            blocked = true; break;
          }
        }
        if (!blocked) { sx = tx; sy = ty; break; }
      }
      room.ragSymbol = {
        letter, x: sx, y: sy, collected: false,
        segJitter: SYMBOL_GLYPHS[letter].map(() => [
          randFloat(-3, 3), randFloat(-2, 2), randFloat(-3, 3), randFloat(-2, 2),
        ]),
      };
    });

    // Place mummy markers in random combat rooms.
    // Floor 2–3: low probability (10–25%). Floor 4+ (post-mummy-boss): guaranteed 1.
    // Floor 7+ (second mummy-boss cycle): 60% chance of a second one.
    const floor = G.floor || 1;
    if (floor >= 2) {
      const mummyPool = nonStart.filter(r => r.type !== 'boss' && r.type !== 'treasure');
      const _placeMummy = (pool) => {
        if (pool.length === 0) return;
        pool.splice(randInt(0, pool.length - 1), 1)[0].hasMummy = true;
      };
      const firstChance = floor >= 4 ? 1.0 : 0.10 + (floor - 2) * 0.15;
      if (Math.random() < firstChance) _placeMummy(mummyPool);
      if (floor >= 7 && Math.random() < 0.60) _placeMummy(mummyPool);
    }
  }
}
