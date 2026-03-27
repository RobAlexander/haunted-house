// Circle vs circle overlap
function circleCollide(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

// Distance between two circle centres
function circleDist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Circle vs AABB overlap test
function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX, dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

// Returns push vector {x,y} to resolve circle out of rect, or null if no overlap
function resolveCircleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX, dy = cy - nearY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= cr * cr) return null;

  if (distSq === 0) {
    // Centre inside rect — eject on nearest edge
    const ol = cx - rx, or_ = (rx + rw) - cx;
    const ot = cy - ry, ob  = (ry + rh) - cy;
    const m  = Math.min(ol, or_, ot, ob);
    if (m === ol)  return { x: -(cr + ol),  y: 0 };
    if (m === or_) return { x:  (cr + or_), y: 0 };
    if (m === ot)  return { x: 0, y: -(cr + ot) };
                   return { x: 0, y:  (cr + ob) };
  }

  const dist    = Math.sqrt(distSq);
  const overlap = cr - dist;
  return { x: (dx / dist) * overlap, y: (dy / dist) * overlap };
}

// Normalise a 2-D vector; returns {x:0,y:0} for zero vectors
function normalizeVec(vx, vy) {
  const len = Math.sqrt(vx * vx + vy * vy);
  return len === 0 ? { x: 0, y: 0 } : { x: vx / len, y: vy / len };
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// Wall collision rects for the current room.
// Walls include gaps where open doors exist so the player can walk through.
function getWallRects() {
  const P    = C.ROOM_PADDING;
  const W    = C.WIDTH, H = C.HEIGHT;
  const DH   = C.DOOR_WIDTH / 2;
  const room = (typeof G !== 'undefined') ? G.currentRoom : null;
  const conn = room ? room.connections : {};
  const cl   = room ? room.cleared    : false;

  const stairwell = room ? room.stairwell : null;
  const rects = [];

  // Returns true if this direction connects to the boss room and symbols aren't all collected
  function _ragLocked(dir) {
    if (!conn[dir] || !G.dungeon || conn[dir] !== G.dungeon.bossRoom) return false;
    return !ragAllCollected();
  }

  function addWallH(y, dir) {
    // Horizontal wall at row y, spanning x = [0, W]
    if ((!conn[dir] && stairwell !== dir) || !cl || _ragLocked(dir)) {
      rects.push({ x: 0, y, w: W, h: P });
    } else {
      // Gap at centre
      if (W / 2 - DH > 0)    rects.push({ x: 0,           y, w: W / 2 - DH,         h: P });
      if (W / 2 + DH < W)    rects.push({ x: W / 2 + DH,  y, w: W - (W / 2 + DH),  h: P });
    }
  }

  function addWallV(x, dir) {
    // Vertical wall at column x, spanning y = [0, H]
    if ((!conn[dir] && stairwell !== dir) || !cl || _ragLocked(dir)) {
      rects.push({ x, y: 0, w: P, h: H });
    } else {
      if (H / 2 - DH > 0)    rects.push({ x, y: 0,          w: P, h: H / 2 - DH         });
      if (H / 2 + DH < H)    rects.push({ x, y: H / 2 + DH, w: P, h: H - (H / 2 + DH)  });
    }
  }

  addWallH(0,       'north');
  addWallH(H - P,   'south');
  addWallV(0,       'west');
  addWallV(W - P,   'east');

  return rects;
}

// ── Rune-stick symbol glyphs ───────────────────────────────────────────────
// Each glyph is an array of [x1,y1, x2,y2] segments in normalised ±1 space.
// Multiply by SYMBOL_SCALE (18px) when drawing.
const SYMBOL_GLYPHS = {
  'R': [[-0.1,-1,-0.1, 1], [-0.1,-0.3, 0.75,-1 ], [-0.1,-0.3, 0.8, 0.5 ]],
  'A': [[ 0  ,-1,-0.7, 1], [ 0  ,-1,   0.7, 1   ], [-0.35, 0.1, 0.35, 0.1]],
  'G': [[ 0.6,-1,-0.6,-1], [-0.6,-1  ,-0.6, 1   ], [-0.6, 1, 0.6, 1      ], [0.6, 1, 0.6, 0.05], [0.6, 0.05, 0.05, 0.05]],
  'O': [[ 0  ,-1, 0.7, 0], [ 0.7, 0,   0  , 1   ], [ 0  , 1,-0.7, 0      ], [-0.7, 0, 0, -1   ]],
  'T': [[-0.7,-1, 0.7,-1], [ 0  ,-1,   0  , 1   ]],
  'N': [[-0.5,-1,-0.5, 1], [ 0.5,-1,   0.5, 1   ], [-0.5,-0.8, 0.5, 0.8  ]],
  'V': [[-0.7,-1, 0  , 1], [ 0.7,-1,   0  , 1   ]],
  'E': [[-0.5,-1,-0.5, 1], [-0.5,-1,   0.6,-1   ], [-0.5, 0, 0.4, 0      ], [-0.5, 1, 0.6, 1  ]],
  'M': [[-0.6,-1,-0.6, 1], [ 0.6,-1,   0.6, 1   ], [-0.6,-1, 0  ,-0.1   ], [ 0.6,-1, 0  ,-0.1]],
  'S': [[ 0.5,-1,-0.5, 0], [-0.5, 0,   0.5, 1   ]],
  'B': [[-0.4,-1,-0.4, 1], [-0.4,-1,   0.6,-0.35], [ 0.6,-0.35,-0.4, 0.1 ], [-0.4, 0.1, 0.6, 0.55], [0.6, 0.55,-0.4, 1]],
  'K': [[-0.4,-1,-0.4, 1], [-0.4, 0,   0.65,-1  ], [-0.4, 0,   0.65, 1  ]],
  'H': [[-0.5,-1,-0.5, 1], [ 0.5,-1,   0.5, 1   ], [-0.5, 0,   0.5, 0   ]],
  'I': [[ 0  ,-1, 0  , 1], [-0.3,-1,   0.3,-1   ], [-0.3, 1,   0.3, 1   ]],
  'L': [[-0.2,-1,-0.2, 0.65], [-0.2, 0.65, 0.65, 1]],
  'P': [[-0.4,-1,-0.4, 1], [-0.4,-1,   0.65,-0.3], [ 0.65,-0.3,-0.4, 0.3]],
};

// Fixed symbol sets for floors 1–4; floor 5+ uses seeded procedural selection.
const _NAMED_SYMBOL_SETS = [
  ['R','A','G'],
  ['O','T','R'],
  ['N','V'],
  ['N','T','E','M'],
];

function _symbolRng(seed) {
  // Mulberry32 seeded PRNG → returns values in [0,1)
  let s = seed >>> 0;
  return function () {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getFloorSymbols(floor) {
  if (floor <= 4) return _NAMED_SYMBOL_SETS[floor - 1];
  const rng  = _symbolRng((floor * 2654435761) >>> 0);
  const pool = Object.keys(SYMBOL_GLYPHS).slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = 2 + Math.floor(rng() * 3); // 2, 3, or 4
  return pool.slice(0, count);
}
