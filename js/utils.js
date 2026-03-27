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

  function addWallH(y, dir) {
    // Horizontal wall at row y, spanning x = [0, W]
    if ((!conn[dir] && stairwell !== dir) || !cl) {
      rects.push({ x: 0, y, w: W, h: P });
    } else {
      // Gap at centre
      if (W / 2 - DH > 0)    rects.push({ x: 0,           y, w: W / 2 - DH,         h: P });
      if (W / 2 + DH < W)    rects.push({ x: W / 2 + DH,  y, w: W - (W / 2 + DH),  h: P });
    }
  }

  function addWallV(x, dir) {
    // Vertical wall at column x, spanning y = [0, H]
    if ((!conn[dir] && stairwell !== dir) || !cl) {
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
