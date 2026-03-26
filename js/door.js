// Helpers for door geometry — shared by collision (utils.js) and rendering.

const OPP_DIR = { north: 'south', south: 'north', east: 'west', west: 'east' };

// Centre point of a door opening on the given wall of the canvas
function getDoorCenter(dir) {
  const P = C.ROOM_PADDING;
  switch (dir) {
    case 'north': return { x: C.WIDTH  / 2, y: P             };
    case 'south': return { x: C.WIDTH  / 2, y: C.HEIGHT - P  };
    case 'east':  return { x: C.WIDTH  - P, y: C.HEIGHT / 2  };
    case 'west':  return { x: P,            y: C.HEIGHT / 2  };
  }
  return null;
}
