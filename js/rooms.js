// ── Room ──────────────────────────────────────────────────────────────────

class Room {
  constructor(gx, gy, depth) {
    this.gx              = gx    || 0;
    this.gy              = gy    || 0;
    this.depth           = depth || 0;
    this.type            = 'normal';   // 'start'|'normal'|'ghost'|'skeleton'|'mixed'|'boss'|'treasure'
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
    const floorBonus = (G.floor || 1) - 1;
    const target = randInt(
      Math.min(C.MIN_ROOMS + floorBonus, 20),
      Math.min(C.MAX_ROOMS + floorBonus * 2, 26)
    );

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
      tr.pickup = { x: C.WIDTH / 2, y: C.HEIGHT / 2, amount: 40 };
      tr.cleared = true;  // no enemies in treasure rooms
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
        room.type       = 'skeleton';
        room.enemyCount = randInt(2, 3 + fb);
      } else {
        room.type       = 'mixed';
        room.enemyCount = randInt(2 + fb, 4 + fb);
      }
    }
  }
}
