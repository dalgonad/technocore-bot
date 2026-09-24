import { MAP_HEIGHT, MAP_WIDTH, WEEKDAYS } from './data.js';

const makeGrid = () => Array.from(
  { length: MAP_HEIGHT },
  () => Array(MAP_WIDTH).fill('grass'),
);

const tiles = makeGrid();
const putTile = (x, y, tile) => {
  if (x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT) tiles[y][x] = tile;
};
const paintRect = (x, y, w, h, tile) => {
  for (let ty = y; ty < y + h; ty += 1) {
    for (let tx = x; tx < x + w; tx += 1) putTile(tx, ty, tile);
  }
};
const horizontalPath = (y, x0, x1) => {
  for (let x = x0; x <= x1; x += 1) putTile(x, y, 'path');
};
const verticalPath = (x, y0, y1) => {
  for (let y = y0; y <= y1; y += 1) putTile(x, y, 'path');
};

for (let x = 0; x < MAP_WIDTH; x += 1) {
  putTile(x, 0, 'wall');
  putTile(x, MAP_HEIGHT - 1, 'wall');
}
for (let y = 0; y < MAP_HEIGHT; y += 1) {
  putTile(0, y, 'wall');
  putTile(MAP_WIDTH - 1, y, 'wall');
}

paintRect(27, 0, 19, 7, 'stone');
paintRect(20, 1, 7, 4, 'grass');
paintRect(30, 5, 17, 2, 'grass');
horizontalPath(7, 1, 70);
verticalPath(32, 7, 54);
verticalPath(39, 7, 54);
horizontalPath(18, 11, 45);
horizontalPath(42, 1, 70);
horizontalPath(26, 45, 69);
horizontalPath(37, 47, 58);
verticalPath(45, 15, 18);
verticalPath(56, 15, 18);
verticalPath(65, 15, 18);
verticalPath(51, 37, 42);
putTile(35, 18, 'bridge');
putTile(36, 18, 'bridge');
putTile(35, 42, 'bridge');
putTile(36, 42, 'bridge');

paintRect(10, 20, 14, 8, 'soil');
paintRect(4, 23, 5, 5, 'sand');
paintRect(5, 24, 3, 3, 'water');
paintRect(9, 32, 8, 8, 'sand');
paintRect(10, 33, 6, 6, 'water');
paintRect(56, 29, 12, 26, 'sand');
paintRect(68, 29, 3, 26, 'water');
for (let y = 8; y < MAP_HEIGHT - 1; y += 1) {
  putTile(35, y, 'water');
  putTile(36, y, 'water');
}
putTile(35, 18, 'bridge');
putTile(36, 18, 'bridge');
putTile(35, 42, 'bridge');
putTile(36, 42, 'bridge');
horizontalPath(18, 11, 45);
horizontalPath(42, 1, 70);
verticalPath(32, 7, 54);
verticalPath(39, 7, 54);
paintRect(48, 40, 4, 4, 'path');
putTile(35, 18, 'bridge');
putTile(36, 18, 'bridge');
putTile(35, 42, 'bridge');
putTile(36, 42, 'bridge');

export const WORLD = {
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  tiles,
  buildings: [
    { id: 'farmhouse', name: 'Farmhouse', x: 9, y: 10, w: 7, h: 5, roof: '#c96f58', door: [12, 15] },
    { id: 'coop', name: 'Chicken Coop', x: 25, y: 12, w: 5, h: 4, roof: '#d2a45b', door: [27, 16] },
    { id: 'mine', name: 'Northern Mine', x: 31, y: 1, w: 9, h: 4, roof: '#68717b', door: [35, 5] },
    { id: 'observatory', name: 'Observatory', x: 20, y: 1, w: 7, h: 4, roof: '#7b71a3', door: [23, 5] },
    { id: 'bakery', name: "Dlira's Bakery", x: 43, y: 10, w: 6, h: 5, roof: '#dc8796', door: [45, 15] },
    { id: 'co_op', name: 'Meadow Co-op', x: 53, y: 10, w: 6, h: 5, roof: '#7bab69', door: [56, 15] },
    { id: 'workshop', name: "Dliwi's Workshop", x: 62, y: 10, w: 6, h: 5, roof: '#e3bd4e', door: [65, 15] },
    { id: 'library', name: 'Library', x: 46, y: 21, w: 6, h: 5, roof: '#957cbd', door: [49, 26] },
    { id: 'inn', name: 'Inn', x: 55, y: 21, w: 6, h: 5, roof: '#b87958', door: [58, 26] },
    { id: 'boathouse', name: 'Boathouse', x: 49, y: 33, w: 6, h: 4, roof: '#5e9ab0', door: [51, 37] },
  ],
  objects: [
    { id: 'shipping-bin', type: 'bin', x: 18, y: 16 },
    { id: 'farm-well', type: 'well', x: 22, y: 16 },
    { id: 'farm-sign', type: 'sign', x: 16, y: 16 },
    { id: 'coop-feeder', type: 'feed', x: 29, y: 16 },
    { id: 'village-notice', type: 'sign', x: 42, y: 16 },
    { id: 'mine-copper-1', type: 'ore', x: 28, y: 6 },
    { id: 'mine-copper-2', type: 'ore', x: 42, y: 6 },
    { id: 'mine-iron-1', type: 'ore', x: 47, y: 4 },
    { id: 'forest-stone-1', type: 'ore', x: 4, y: 49 },
    { id: 'forest-copper-1', type: 'ore', x: 25, y: 35 },
    { id: 'coast-iron-1', type: 'ore', x: 63, y: 48 },
    { id: 'farm-tree-1', type: 'tree', x: 4, y: 11 },
    { id: 'farm-tree-2', type: 'tree', x: 6, y: 12 },
    { id: 'farm-tree-3', type: 'tree', x: 30, y: 12 },
    { id: 'farm-tree-4', type: 'tree', x: 31, y: 26 },
    { id: 'forest-tree-1', type: 'tree', x: 5, y: 31 },
    { id: 'forest-tree-2', type: 'tree', x: 21, y: 31 },
    { id: 'forest-tree-3', type: 'tree', x: 27, y: 34 },
    { id: 'forest-tree-4', type: 'tree', x: 4, y: 38 },
    { id: 'forest-tree-5', type: 'tree', x: 20, y: 40 },
    { id: 'forest-tree-6', type: 'tree', x: 28, y: 40 },
    { id: 'forest-tree-7', type: 'tree', x: 7, y: 46 },
    { id: 'forest-tree-8', type: 'tree', x: 16, y: 48 },
    { id: 'forest-tree-9', type: 'tree', x: 27, y: 51 },
    { id: 'coast-tree-1', type: 'tree', x: 45, y: 31 },
    { id: 'coast-tree-2', type: 'tree', x: 62, y: 34 },
    { id: 'coast-tree-3', type: 'tree', x: 59, y: 51 },
    { id: 'farm-pond-fish', type: 'fish', x: 6, y: 24 },
    { id: 'forest-lake-fish', type: 'fish', x: 10, y: 33 },
    { id: 'coast-fish', type: 'fish', x: 68, y: 40 },
  ],
  regions: [
    { id: 'mine', name: 'Northern Mine', subtitle: 'Caves and ancient stonework', color: '#687582', x: 0, y: 0, w: 72, h: 8 },
    { id: 'farm', name: 'Meadow Farm', subtitle: 'A new home and fertile fields', color: '#78aa62', x: 0, y: 8, w: 36, h: 20 },
    { id: 'village', name: 'Meadow Village', subtitle: 'A place to meet and shop', color: '#d8aa72', x: 36, y: 8, w: 36, h: 20 },
    { id: 'forest', name: 'Shaded Woods', subtitle: 'Trees, lakes, and secrets', color: '#52855a', x: 0, y: 28, w: 36, h: 28 },
    { id: 'coast', name: 'Sunlit Coast', subtitle: 'Soft sand and sea breezes', color: '#5fabc1', x: 36, y: 28, w: 36, h: 28 },
  ],
};

for (const building of WORLD.buildings) {
  paintRect(building.x, building.y, building.w, building.h, 'wall');
  putTile(building.door[0], building.door[1], 'path');
}
for (const object of WORLD.objects) {
  if (object.type === 'tree') putTile(object.x, object.y, 'tree');
  if (object.type === 'ore') putTile(object.x, object.y, 'stone');
}

const regionFor = (x, y) => WORLD.regions.find((region) => (
  x >= region.x && y >= region.y && x < region.x + region.w && y < region.y + region.h
));

export function tileAt(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 'wall';
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= WORLD.width || ty >= WORLD.height) return 'wall';
  return WORLD.tiles[ty][tx] ?? 'wall';
}

export function regionAt(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const region = regionFor(Math.floor(x), Math.floor(y));
  if (!region) return null;
  const { id, name, subtitle, color } = region;
  return { id, name, subtitle, color };
}

const isResourceDepleted = (state, id) => state?.resourceState?.[id]?.depleted === true;

export function isWalkable(state, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const tile = tileAt(tx, ty);
  const object = WORLD.objects.find((entry) => entry.x === tx && entry.y === ty);
  const clearedResource = object && ['tree', 'ore'].includes(object.type) && isResourceDepleted(state, object.id);
  if (!['grass', 'path', 'bridge', 'soil', 'sand'].includes(tile) && !clearedResource) return false;
  if (object && !clearedResource) return false;
  if (WORLD.buildings.some((building) => (
    tx >= building.x && ty >= building.y
    && tx < building.x + building.w && ty < building.y + building.h
  ))) return false;

  for (const animal of state?.animals ?? []) {
    if (Math.floor(animal.x) === tx && Math.floor(animal.y) === ty) return false;
  }
  for (const monster of state?.monsters ?? []) {
    if (!monster.defeated && Math.floor(monster.x) === tx && Math.floor(monster.y) === ty) return false;
  }
  return true;
}

const spot = (x, y, destination, activity, outdoor = false) => ({
  x, y, destination, activity, outdoor,
});

const BASE_SCHEDULES = {
  dlira: [
    spot(47, 16, 'Bakery Kitchen', 'Baking bread'),
    spot(48, 16, 'Bakery', 'Serving customers'),
    spot(42, 20, 'Town Square', 'Having lunch'),
    spot(47, 16, 'Bakery', 'Baking bread'),
    spot(58, 27, 'Inn', 'Resting'),
    spot(48, 16, 'Bakery Apartment', 'Sleeping'),
  ],
  dlito: [
    spot(56, 16, 'Co-op Animal Pen', 'Caring for livestock'),
    spot(55, 17, 'Co-op Stall', 'Selling seeds'),
    spot(57, 19, 'Co-op Kitchen', 'Having lunch'),
    spot(56, 16, 'Co-op Animal Pen', 'Checking the animal pen'),
    spot(16, 37, 'Forest Lakeside', 'Fishing', true),
    spot(56, 17, 'Co-op House', 'Sleeping'),
  ],
  dlizal: [
    spot(51, 38, 'Boathouse', 'Preparing for patrol'),
    spot(16, 36, 'Forest Lake', 'Patrolling', true),
    spot(28, 42, 'Riverside', 'Resting', true),
    spot(61, 38, 'Coastal Pier', 'Guarding the pier'),
    spot(58, 27, 'Inn', 'Having dinner'),
    spot(51, 38, 'Boathouse Loft', 'Sleeping'),
  ],
  dliwi: [
    spot(65, 17, 'Workshop Loft', 'Designing tools'),
    spot(65, 16, 'Workshop', 'Repairing tools'),
    spot(42, 20, 'Town Square Stall', 'Having lunch'),
    spot(40, 7, 'Mine Shack', 'Inspecting the mine'),
    spot(65, 17, 'Workshop Project Desk', 'Testing the pump'),
    spot(65, 17, 'Workshop Loft', 'Sleeping'),
  ],
  dliyu: [
    spot(50, 27, 'Archive Room', 'Reading notes'),
    spot(50, 27, 'Library Desk', 'Helping visitors'),
    spot(48, 16, 'Bakery Reading Nook', 'Reading'),
    spot(20, 37, 'Old Garden Ruins', 'Searching for archives', true),
    spot(23, 6, 'Observatory', 'Stargazing'),
    spot(50, 27, 'Library Apartment', 'Sleeping'),
  ],
};

const REST_DAY_SCHEDULES = {
  dlira: { day: 1, 1: spot(25, 33, 'Orchard', 'Taking a break', true), 2: spot(49, 27, 'Library', 'Reading'), 3: spot(58, 27, 'Inn', 'Meeting friends') },
  dlito: { day: 2, 1: spot(30, 39, 'Forest Trail', 'Taking a walk', true), 2: spot(16, 37, 'Forest Lake', 'Fishing', true), 3: spot(56, 17, 'Co-op House', 'Resting') },
  dlizal: { day: 4, 1: spot(61, 38, 'Sunlit Coast', 'Exploring the shore', true), 2: spot(61, 38, 'Sunlit Coast', 'Exploring the shore', true), 3: spot(61, 38, 'Sunlit Coast', 'Exploring the shore', true), 4: spot(58, 27, 'Inn', 'Meeting friends') },
  dliwi: { day: 6, 1: spot(50, 27, 'Library', 'Looking for designs'), 2: spot(42, 20, 'Town Square', 'Meeting locals', true), 3: spot(65, 17, 'Workshop', 'Working on a project') },
  dliyu: { day: 0, 1: spot(20, 37, 'Old Garden Ruins', 'Searching for archives', true), 2: spot(48, 16, 'Bakery', 'Reading'), 3: spot(23, 6, 'Observatory', 'Stargazing') },
};

const RAINY_FALLBACKS = {
  dlira: spot(48, 16, 'Bakery Reading Nook', 'Reading'),
  dlito: spot(56, 16, 'Co-op Animal Pen', 'Caring for livestock'),
  dlizal: spot(51, 38, 'Boathouse', 'Taking shelter'),
  dliwi: spot(65, 17, 'Workshop Project Desk', 'Testing tools'),
  dliyu: spot(50, 27, 'Library Reading Room', 'Reading'),
};

const scheduleSlot = (minute) => {
  if (minute < 360 || minute >= 1320) return 5;
  if (minute < 480) return 0;
  if (minute < 720) return 1;
  if (minute < 840) return 2;
  if (minute < 1080) return 3;
  return 4;
};

const weekdayIndex = (state) => {
  const season = Number.isInteger(state?.season) ? state.season : 0;
  const day = Number.isInteger(state?.day) ? state.day : 1;
  const year = Number.isInteger(state?.year) ? state.year : 1;
  const absoluteDay = Math.max(0, (year - 1) * 112 + season * 28 + day - 1);
  return absoluteDay % WEEKDAYS.length;
};

export function getNpcPosition(state, id) {
  const schedule = BASE_SCHEDULES[id];
  if (!schedule) return null;

  const minute = Number.isFinite(state?.minute) ? state.minute : 420;
  const slot = scheduleSlot(minute);
  let destination = schedule[slot];
  const restSchedule = REST_DAY_SCHEDULES[id];
  if (slot >= 1 && slot <= 4 && restSchedule?.day === weekdayIndex(state)) {
    destination = restSchedule[slot] ?? destination;
  }

  if (destination.outdoor && ['rainy', 'snowy'].includes(state?.weather)) {
    destination = RAINY_FALLBACKS[id];
  }

  return {
    x: destination.x + 0.5,
    y: destination.y + 0.5,
    activity: destination.activity,
    destination: destination.destination,
  };
}
