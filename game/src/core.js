import {
  BIRTHDAYS,
  CROPS,
  FISH,
  ITEMS,
  MAP_HEIGHT,
  MAP_WIDTH,
  MONSTER_TYPES,
  SEASONS,
  TOOLS,
  VILLAGERS,
  WEEKDAYS,
} from './data.js';
import { WORLD, getNpcPosition, isWalkable, regionAt, tileAt } from './world.js';

const START_POSITION = { x: 16.5, y: 18.5, facing: 'down' };
const FIELD = { x: 10, y: 20, w: 14, h: 8 };
const MAX_STACK = 99;
const DEFAULT_CAPACITY = 24;
const MAX_GOLD = 999_999_999;
const DIRECTIONS = ['up', 'right', 'down', 'left'];
const WEATHER_TYPES = new Set(['sunny', 'cloudy', 'rainy', 'snowy']);
const TOOL_IDS = new Set(TOOLS.map(({ id }) => id));
const VILLAGER_IDS = new Set(VILLAGERS.map(({ id }) => id));
const OBJECT_BY_ID = new Map(WORLD.objects.map((object) => [object.id, object]));
const VILLAGER_BY_ID = new Map(VILLAGERS.map((villager) => [villager.id, villager]));
const hasCrop = (id) => typeof id === 'string' && Object.hasOwn(CROPS, id);
const hasMonsterType = (id) => typeof id === 'string' && Object.hasOwn(MONSTER_TYPES, id);

const ITEM_CATALOG = new Map();
for (const [id, info] of Object.entries(ITEMS)) ITEM_CATALOG.set(id, info);
for (const [id, crop] of Object.entries(CROPS)) {
  ITEM_CATALOG.set(id, {
    name: crop.name,
    price: 0,
    sellPrice: crop.sellPrice,
    color: crop.color,
    type: 'hasil panen',
  });
  ITEM_CATALOG.set(`${id}_seed`, {
    name: `${crop.name} Seeds`,
    price: crop.seedPrice,
    sellPrice: 0,
    color: crop.color,
    type: 'benih',
  });
}
for (const [id, fish] of Object.entries(FISH)) {
  ITEM_CATALOG.set(id, {
    name: fish.name,
    price: 0,
    sellPrice: fish.sellPrice,
    color: fish.color,
    type: 'ikan',
  });
}
for (const tool of TOOLS) {
  ITEM_CATALOG.set(tool.id, {
    name: tool.name,
    price: tool.cost,
    sellPrice: 0,
    color: '#8b7254',
    type: 'perkakas',
  });
}

const QUESTS = [
  {
    id: 'small_garden',
    title: 'A Small Garden',
    description: 'Plant three seeds in the field.',
    stat: 'planted',
    target: 3,
    reward: { gold: 100, item: 'potato_seed', quantity: 2 },
  },
  {
    id: 'first_harvest',
    title: 'First Harvest',
    description: 'Harvest five crops from the field.',
    stat: 'harvested',
    target: 5,
    reward: { gold: 150, item: 'bread', quantity: 1 },
  },
  {
    id: 'river_friend',
    title: 'A Gift from the River',
    description: 'Catch two fish in the pond or along the coast.',
    stat: 'fished',
    target: 2,
    reward: { gold: 120, item: 'herbal_tea', quantity: 2 },
  },
  {
    id: 'gentle_guardian',
    title: 'Gentle Guardian',
    description: 'Defeat two monsters threatening the valley.',
    stat: 'defeated',
    target: 2,
    reward: { gold: 180, item: 'slime_gel', quantity: 2 },
  },
];

const GIFT_LIKES = {
  dlira: new Set(['turnip', 'tomato', 'herbal_tea']),
  dlito: new Set(['potato', 'carrot', 'egg']),
  dlizal: new Set(['forest_trout', 'coast_sardine', 'coast_mackerel']),
  dliwi: new Set(['stone', 'iron_ore', 'wood']),
  dliyu: new Set(['cabbage', 'kale', 'winter_trout']),
};

const plainObject = (value) => value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const integerInRange = (value, fallback, min, max) => (
  Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback
);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const farmKey = (x, y) => `${x},${y}`;
const seedItemId = (cropId) => `${cropId}_seed`;

export function itemInfo(id) {
  const info = ITEM_CATALOG.get(id);
  return info ? { name: info.name, price: info.price, sellPrice: info.sellPrice, color: info.color, type: info.type } : null;
}

const makeInitialFarm = () => {
  const sampleCrops = [
    [11, 21, 'turnip'],
    [13, 21, 'potato'],
    [15, 21, 'turnip'],
    [17, 21, 'cabbage'],
    [19, 21, 'potato'],
    [21, 21, 'turnip'],
  ];
  return Object.fromEntries(sampleCrops.map(([x, y, id], index) => [farmKey(x, y), {
    tilled: true,
    watered: true,
    crop: { id, remaining: index < 3 ? 0 : 2, ready: index < 3, withered: false },
  }]));
};

const makeInitialMonsters = () => [
  { id: 'monster-slime-1', type: 'slime', x: 8.5, y: 33.5, hp: MONSTER_TYPES.slime.hp, defeated: false },
  { id: 'monster-bat-1', type: 'cave_bat', x: 45.5, y: 7.5, hp: MONSTER_TYPES.cave_bat.hp, defeated: false },
  { id: 'monster-moss-1', type: 'moss_sprite', x: 29.5, y: 46.5, hp: MONSTER_TYPES.moss_sprite.hp, defeated: false },
  { id: 'monster-crab-1', type: 'sand_crab', x: 61.5, y: 46.5, hp: MONSTER_TYPES.sand_crab.hp, defeated: false },
];

export function createState() {
  return {
    version: 1,
    day: 1,
    minute: 420,
    season: 0,
    year: 1,
    weather: 'sunny',
    gold: 500,
    stamina: 100,
    maxStamina: 100,
    water: 30,
    maxWater: 30,
    player: { ...START_POSITION, hp: 100 },
    tool: 'hoe',
    toolsOwned: TOOLS.map(({ id }) => id),
    selectedSeed: 'turnip',
    inventory: { turnip_seed: 8, potato_seed: 4, bread: 3, feed: 5 },
    inventoryCapacity: DEFAULT_CAPACITY,
    farm: makeInitialFarm(),
    monsters: makeInitialMonsters(),
    animals: [{
      id: 'chicken-1', type: 'chicken', name: 'Piko', x: 28.5, y: 17.5,
      fed: false, petted: false, product: false,
    }],
    friendship: Object.fromEntries(VILLAGERS.map(({ id }) => [id, 0])),
    talked: {},
    gifted: {},
    shipping: {},
    stats: { harvested: 0, defeated: 0, fished: 0, mined: 0, planted: 0, talked: 0 },
    battle: null,
    fishing: null,
    quests: {},
    options: { relaxed: false },
    rngSeed: 0x4d454144,
    timeRemainder: 0,
    resourceState: {},
  };
}

const sanitizeInventory = (raw, capacity, fallback) => {
  const source = plainObject(raw) ? raw : fallback;
  if (!plainObject(source)) return {};
  const result = {};
  for (const [id, count] of Object.entries(source)) {
    if (!ITEM_CATALOG.has(id) || ITEM_CATALOG.get(id).type === 'perkakas' || !Number.isInteger(count) || count <= 0) continue;
    if (result[id] === undefined && Object.keys(result).length >= capacity) continue;
    result[id] = Math.min(MAX_STACK, count);
  }
  return result;
};

const sanitizeFarm = (raw) => {
  if (!plainObject(raw)) return makeInitialFarm();
  const result = {};
  for (const [key, plot] of Object.entries(raw)) {
    if (Object.keys(result).length >= FIELD.w * FIELD.h) break;
    const match = /^(\d{1,2}),(\d{1,2})$/.exec(key);
    if (!match || !plainObject(plot)) continue;
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (x < FIELD.x || x >= FIELD.x + FIELD.w || y < FIELD.y || y >= FIELD.y + FIELD.h) continue;
    const tilled = plot.tilled === true;
    const entry = { tilled, watered: tilled && plot.watered === true, crop: null };
    if (plainObject(plot.crop) && hasCrop(plot.crop.id)) {
      const definition = CROPS[plot.crop.id];
      const withered = plot.crop.withered === true;
      const remaining = integerInRange(plot.crop.remaining, definition.growth, 0, definition.growth);
      const ready = !withered && (plot.crop.ready === true || remaining === 0);
      entry.crop = {
        id: plot.crop.id,
        remaining: ready ? 0 : remaining,
        ready,
        withered,
      };
      entry.tilled = true;
    }
    if (entry.tilled || entry.crop) result[key] = entry;
  }
  return result;
};

const sanitizeMonsters = (raw) => {
  if (!Array.isArray(raw)) return makeInitialMonsters();
  const ids = new Set();
  const result = [];
  for (const monster of raw.slice(0, 100)) {
    if (!plainObject(monster) || typeof monster.id !== 'string' || typeof monster.type !== 'string') continue;
    if (!hasMonsterType(monster.type)) continue;
    const definition = MONSTER_TYPES[monster.type];
    if (!/^[a-z0-9-]{1,48}$/.test(monster.id) || ids.has(monster.id)) continue;
    if (!finite(monster.x) || !finite(monster.y)) continue;
    const x = clamp(monster.x, 1.5, MAP_WIDTH - 1.5);
    const y = clamp(monster.y, 1.5, MAP_HEIGHT - 1.5);
    if (!['grass', 'path', 'bridge', 'sand'].includes(tileAt(x, y))) continue;
    const hp = integerInRange(monster.hp, definition.hp, 0, definition.hp);
    ids.add(monster.id);
    result.push({
      id: monster.id,
      type: monster.type,
      x,
      y,
      hp,
      defeated: monster.defeated === true || hp === 0,
    });
  }
  return result;
};

const sanitizeAnimals = (raw) => {
  if (!Array.isArray(raw)) {
    return [{ id: 'chicken-1', type: 'chicken', name: 'Piko', x: 28.5, y: 17.5, fed: false, petted: false, product: false }];
  }
  const ids = new Set();
  const result = [];
  for (const animal of raw.slice(0, 16)) {
    if (!plainObject(animal) || typeof animal.id !== 'string' || !/^[a-z0-9-]{1,48}$/.test(animal.id)) continue;
    if (!['chicken', 'cow', 'sheep'].includes(animal.type)) continue;
    if (!finite(animal.x) || !finite(animal.y) || ids.has(animal.id)) continue;
    const x = clamp(animal.x, 1.5, MAP_WIDTH - 1.5);
    const y = clamp(animal.y, 1.5, MAP_HEIGHT - 1.5);
    if (regionAt(x, y)?.id !== 'farm' || !['grass', 'path', 'soil'].includes(tileAt(x, y))) continue;
    if (OBJECT_BY_ID.has(WORLD.objects.find((object) => object.x === Math.floor(x) && object.y === Math.floor(y))?.id)) continue;
    ids.add(animal.id);
    result.push({
      id: animal.id,
      type: animal.type,
      name: typeof animal.name === 'string' && /^[\p{L}\p{N} '’-]{1,24}$/u.test(animal.name) ? animal.name : 'Friend',
      x,
      y,
      fed: animal.fed === true,
      petted: animal.petted === true,
      product: animal.product === true,
    });
  }
  return result.length ? result : sanitizeAnimals(null);
};

const sanitizeFlags = (raw) => {
  if (!plainObject(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([id, value]) => VILLAGER_IDS.has(id) && value === true));
};

const sanitizeShipping = (raw) => {
  if (!plainObject(raw)) return {};
  const result = {};
  for (const [id, quantity] of Object.entries(raw)) {
    const info = itemInfo(id);
    if (!info || info.type === 'perkakas' || info.sellPrice <= 0) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) continue;
    result[id] = Math.min(MAX_STACK, quantity);
  }
  return result;
};

const sanitizeResourceState = (raw) => {
  if (!plainObject(raw)) return {};
  const result = {};
  for (const [id, entry] of Object.entries(raw)) {
    const object = OBJECT_BY_ID.get(id);
    if (!object || !['tree', 'ore'].includes(object.type) || !plainObject(entry)) continue;
    result[id] = {
      hits: integerInRange(entry.hits, 0, 0, 10),
      depleted: entry.depleted === true,
    };
  }
  return result;
};

const sanitizeBattle = (raw, monsters, player) => {
  if (!plainObject(raw) || typeof raw.monsterId !== 'string') return null;
  const monster = monsters.find((entry) => entry.id === raw.monsterId && !entry.defeated && entry.hp > 0);
  if (!monster || Math.abs(Math.floor(monster.x) - Math.floor(player.x))
    + Math.abs(Math.floor(monster.y) - Math.floor(player.y)) > 1) return null;
  return { monsterId: monster.id, guarding: raw.guarding === true };
};

const nearestWalkablePosition = (state) => {
  const start = [Math.floor(START_POSITION.x), Math.floor(START_POSITION.y)];
  const queue = [start];
  const visited = new Set([start.join(',')]);
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    if (isWalkable(state, x + 0.5, y + 0.5)) return { x: x + 0.5, y: y + 0.5 };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextX = x + dx;
      const nextY = y + dy;
      const key = `${nextX},${nextY}`;
      if (nextX < 1 || nextY < 1 || nextX >= MAP_WIDTH - 1 || nextY >= MAP_HEIGHT - 1 || visited.has(key)) continue;
      visited.add(key);
      queue.push([nextX, nextY]);
    }
  }
  return { x: START_POSITION.x, y: START_POSITION.y };
};

const sanitizeFishing = (raw, state) => {
  if (!plainObject(raw) || !['waiting', 'bite'].includes(raw.phase)) return null;
  if (!finite(raw.elapsed) || !finite(raw.biteAt) || !Number.isInteger(raw.x) || !Number.isInteger(raw.y)) return null;
  const biteAt = clamp(raw.biteAt, 3, 8);
  if (raw.elapsed < 0 || raw.elapsed > biteAt + 1.5 || state.tool !== 'rod' || !hasTool(state, 'rod')) return null;
  if (tileAt(raw.x, raw.y) !== 'water') return null;
  const region = regionAt(raw.x, raw.y);
  if (!region || !['farm', 'forest', 'coast'].includes(region.id)) return null;
  if (Math.abs(Math.floor(state.player.x) - raw.x) + Math.abs(Math.floor(state.player.y) - raw.y) !== 1) return null;
  return {
    phase: raw.elapsed >= biteAt ? 'bite' : 'waiting',
    elapsed: clamp(raw.elapsed, 0, 60),
    biteAt,
    biteWindow: 1.5,
    x: raw.x,
    y: raw.y,
    habitat: region.id,
  };
};

export function validateState(raw) {
  if (!plainObject(raw) || raw.version !== 1) throw new TypeError('Invalid save data or unsupported version.');

  const state = createState();
  state.day = integerInRange(raw.day, state.day, 1, 28);
  state.minute = integerInRange(raw.minute, state.minute, 0, 1559);
  state.season = integerInRange(raw.season, state.season, 0, SEASONS.length - 1);
  state.year = integerInRange(raw.year, state.year, 1, 999_999);
  state.weather = WEATHER_TYPES.has(raw.weather) ? raw.weather : 'sunny';
  state.gold = integerInRange(raw.gold, state.gold, 0, MAX_GOLD);
  state.maxStamina = integerInRange(raw.maxStamina, state.maxStamina, 1, 999);
  state.stamina = integerInRange(raw.stamina, state.stamina, 0, state.maxStamina);
  state.maxWater = integerInRange(raw.maxWater, state.maxWater, 1, 999);
  state.water = integerInRange(raw.water, state.water, 0, state.maxWater);
  state.inventoryCapacity = integerInRange(raw.inventoryCapacity, DEFAULT_CAPACITY, 1, 120);
  state.inventory = sanitizeInventory(raw.inventory, state.inventoryCapacity, state.inventory);
  state.farm = sanitizeFarm(raw.farm);
  state.monsters = sanitizeMonsters(raw.monsters);
  state.animals = sanitizeAnimals(raw.animals);

  state.toolsOwned = Array.isArray(raw.toolsOwned)
    ? TOOLS.filter(({ id, cost }) => cost === 0 || raw.toolsOwned.includes(id)).map(({ id }) => id)
    : [...state.toolsOwned];
  state.tool = TOOL_IDS.has(raw.tool) && state.toolsOwned.includes(raw.tool) ? raw.tool : state.toolsOwned[0];
  state.selectedSeed = hasCrop(raw.selectedSeed) ? raw.selectedSeed : 'turnip';

  const player = plainObject(raw.player) ? raw.player : {};
  const candidate = {
    x: finite(player.x) ? clamp(player.x, 0.5, MAP_WIDTH - 0.5) : START_POSITION.x,
    y: finite(player.y) ? clamp(player.y, 0.5, MAP_HEIGHT - 0.5) : START_POSITION.y,
    facing: DIRECTIONS.includes(player.facing) ? player.facing : START_POSITION.facing,
    hp: integerInRange(player.hp, 100, 0, 100),
  };
  if (!isWalkable(state, candidate.x, candidate.y)) {
    const fallback = nearestWalkablePosition(state);
    candidate.x = fallback.x;
    candidate.y = fallback.y;
  }
  state.player = candidate;

  state.friendship = Object.fromEntries(VILLAGERS.map(({ id }) => [
    id,
    integerInRange(raw.friendship?.[id], 0, 0, 1000),
  ]));
  state.talked = sanitizeFlags(raw.talked);
  state.gifted = sanitizeFlags(raw.gifted);
  state.shipping = sanitizeShipping(raw.shipping);
  if (plainObject(raw.stats)) {
    for (const key of ['harvested', 'defeated', 'fished', 'mined', 'planted', 'talked']) {
      state.stats[key] = integerInRange(raw.stats[key], 0, 0, 999_999);
    }
  }
  state.quests = plainObject(raw.quests)
    ? Object.fromEntries(QUESTS.filter(({ id }) => raw.quests[id]?.claimed === true).map(({ id }) => [id, { claimed: true }]))
    : {};
  state.options = { relaxed: plainObject(raw.options) && raw.options.relaxed === true };
  state.rngSeed = Number.isInteger(raw.rngSeed) ? raw.rngSeed >>> 0 : state.rngSeed;
  state.timeRemainder = finite(raw.timeRemainder) ? clamp(raw.timeRemainder, 0, 0.999999) : 0;
  state.resourceState = sanitizeResourceState(raw.resourceState);
  state.fishing = sanitizeFishing(raw.fishing, state);
  state.battle = sanitizeBattle(raw.battle, state.monsters, state.player);
  if (state.battle) state.fishing = null;
  return state;
}

export function calendar(state) {
  const seasonIndex = integerInRange(state?.season, 0, 0, SEASONS.length - 1);
  const day = integerInRange(state?.day, 1, 1, 28);
  const year = integerInRange(state?.year, 1, 1, 999_999);
  const absoluteDay = (year - 1) * 112 + seasonIndex * 28 + day - 1;
  return {
    season: SEASONS[seasonIndex],
    day,
    year,
    weekday: WEEKDAYS[absoluteDay % WEEKDAYS.length],
  };
}

export function formatTime(state) {
  const minute = Number.isInteger(state?.minute) ? ((state.minute % 1440) + 1440) % 1440 : 420;
  const hours = String(Math.floor(minute / 60)).padStart(2, '0');
  const minutes = String(minute % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function targetCell(state) {
  const x = finite(state?.player?.x) ? Math.floor(state.player.x) : 0;
  const y = finite(state?.player?.y) ? Math.floor(state.player.y) : 0;
  switch (state?.player?.facing) {
    case 'up': return { x, y: y - 1 };
    case 'right': return { x: x + 1, y };
    case 'left': return { x: x - 1, y };
    default: return { x, y: y + 1 };
  }
}

const makeResult = (ok, message, extra = {}) => ({ ok, message, ...extra });
const hasTool = (state, id) => Array.isArray(state.toolsOwned) && state.toolsOwned.includes(id);

export function movePlayer(state, dx, dy, seconds) {
  if (state.battle) return makeResult(false, 'A battle is in progress.');
  if (state.fishing) return makeResult(false, 'Cancel fishing before moving.');
  if (!finite(dx) || !finite(dy) || !finite(seconds) || seconds <= 0) {
    return makeResult(false, 'Invalid movement.');
  }
  const magnitude = Math.hypot(dx, dy);
  if (magnitude === 0) return makeResult(false, 'Choose a direction to move.');

  const horizontal = Math.abs(dx) >= Math.abs(dy);
  state.player.facing = horizontal ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  const distance = Math.min(5, seconds) * 3.5;
  const stepX = (dx / magnitude * distance);
  const stepY = (dy / magnitude * distance);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(stepX), Math.abs(stepY)) / 0.12));
  const occupiedNpcCells = VILLAGERS.map((villager) => getNpcPosition(state, villager.id))
    .filter(Boolean)
    .map((position) => [Math.floor(position.x), Math.floor(position.y)]);
  const canStand = (x, y) => isWalkable(state, x, y) && !occupiedNpcCells.some(([npcX, npcY]) => (
    npcX === Math.floor(x) && npcY === Math.floor(y)
  ));
  let moved = false;

  for (let index = 0; index < steps; index += 1) {
    const nextX = state.player.x + stepX / steps;
    if (canStand(nextX, state.player.y)) {
      state.player.x = nextX;
      moved = true;
    }
    const nextY = state.player.y + stepY / steps;
    if (canStand(state.player.x, nextY)) {
      state.player.y = nextY;
      moved = true;
    }
  }

  if (!moved) return makeResult(false, 'The path is blocked.', { x: state.player.x, y: state.player.y });
  return makeResult(true, 'You moved.', { x: state.player.x, y: state.player.y });
}

export function selectTool(state, id) {
  if (state.fishing && id !== 'rod') return makeResult(false, 'Cancel fishing before switching tools.');
  if (!TOOL_IDS.has(id) || !hasTool(state, id)) return makeResult(false, 'That tool is not available.');
  state.tool = id;
  return makeResult(true, `Selected ${TOOLS.find((tool) => tool.id === id).name}.`, { tool: id });
}

export function cycleTool(state, direction = 1) {
  if (!finite(direction)) return makeResult(false, 'Invalid tool-switch direction.');
  const owned = TOOLS.filter(({ id }) => hasTool(state, id));
  if (owned.length === 0) return makeResult(false, 'No tools are available.');
  const currentIndex = Math.max(0, owned.findIndex(({ id }) => id === state.tool));
  const step = direction < 0 ? -1 : 1;
  const next = owned[(currentIndex + step + owned.length) % owned.length];
  return selectTool(state, next.id);
}

export function selectSeed(state, cropId) {
  if (!hasCrop(cropId)) return makeResult(false, 'Unknown seed.');
  if ((state.inventory[seedItemId(cropId)] ?? 0) < 1) return makeResult(false, 'You do not have that seed.');
  state.selectedSeed = cropId;
  return makeResult(true, `Selected ${CROPS[cropId].name.toLowerCase()} seeds.`, { seed: cropId });
}

const itemQuantity = (state, id) => state.inventory[id] ?? 0;
const usedSlots = (inventory) => Object.values(inventory).filter((quantity) => quantity > 0).length;

const canAddItem = (state, id, quantity) => {
  if (!ITEM_CATALOG.has(id) || !Number.isInteger(quantity) || quantity <= 0) return false;
  const current = itemQuantity(state, id);
  if (current + quantity > MAX_STACK) return false;
  return current > 0 || usedSlots(state.inventory) < state.inventoryCapacity;
};

const addItem = (state, id, quantity) => {
  if (!canAddItem(state, id, quantity)) return false;
  state.inventory[id] = itemQuantity(state, id) + quantity;
  return true;
};

const removeItem = (state, id, quantity) => {
  if (!Number.isInteger(quantity) || quantity <= 0 || itemQuantity(state, id) < quantity) return false;
  const next = itemQuantity(state, id) - quantity;
  if (next === 0) delete state.inventory[id];
  else state.inventory[id] = next;
  return true;
};

const farmPlot = (state, x, y) => state.farm[farmKey(x, y)];
const inField = (x, y) => x >= FIELD.x && y >= FIELD.y && x < FIELD.x + FIELD.w && y < FIELD.y + FIELD.h;
const spendStamina = (state, cost) => {
  if (state.stamina < cost) return false;
  state.stamina -= cost;
  return true;
};

const targetObject = (state) => {
  const target = targetCell(state);
  return WORLD.objects.find((object) => object.x === target.x && object.y === target.y) ?? null;
};

const deterministicRandom = (state) => {
  state.rngSeed = (Math.imul(state.rngSeed >>> 0, 1_664_525) + 1_013_904_223) >>> 0;
  return state.rngSeed / 0x1_0000_0000;
};

const previewRandom = (seed) => {
  const next = (Math.imul(seed >>> 0, 1_664_525) + 1_013_904_223) >>> 0;
  return { value: next / 0x1_0000_0000, seed: next };
};

const fishPool = (state, habitat) => {
  const seasonal = Object.values(FISH).filter((fish) => (
    fish.habitats.includes(habitat) && fish.seasons.includes(state.season)
  ));
  return seasonal.length > 0 ? seasonal : Object.values(FISH).filter((fish) => fish.habitats.includes(habitat));
};

const adjacentCellDistance = (player, x, y) => (
  Math.abs(Math.floor(player.x) - x) + Math.abs(Math.floor(player.y) - y)
);

const getOreDrop = (id) => {
  if (id.includes('gold')) return 'gold_ore';
  if (id.includes('silver')) return 'silver_ore';
  if (id.includes('iron')) return 'iron_ore';
  if (id.includes('copper')) return 'copper_ore';
  return 'stone';
};

const useHoe = (state, target) => {
  if (!inField(target.x, target.y) || tileAt(target.x, target.y) !== 'soil') {
    return makeResult(false, 'The Hoe can only be used on farm plots.');
  }
  if (farmPlot(state, target.x, target.y)?.tilled) return makeResult(false, 'This soil has already been tilled.');
  if (state.stamina < 3) return makeResult(false, 'Not enough stamina to till the soil.');
  state.farm[farmKey(target.x, target.y)] = { tilled: true, watered: false, crop: null };
  spendStamina(state, 3);
  return makeResult(true, 'The soil is ready for planting.', { cell: target });
};

const useCan = (state, target) => {
  const plot = farmPlot(state, target.x, target.y);
  if (!plot?.tilled) return makeResult(false, 'Water only tilled soil.');
  if (plot.watered) return makeResult(false, 'This soil is already watered today.');
  if (state.water < 1) return makeResult(false, 'The Watering Can is empty. Refill it at a well or by the water.');
  if (state.stamina < 1) return makeResult(false, 'Not enough stamina to water crops.');
  state.water -= 1;
  plot.watered = true;
  spendStamina(state, 1);
  return makeResult(true, 'The crop has been watered.', { cell: target });
};

const useSeeds = (state, target) => {
  const plot = farmPlot(state, target.x, target.y);
  const crop = hasCrop(state.selectedSeed) ? CROPS[state.selectedSeed] : null;
  const seedId = seedItemId(state.selectedSeed);
  if (!plot?.tilled) return makeResult(false, 'Till the soil before planting.');
  if (plot.crop) return makeResult(false, 'This plot already has a crop.');
  if (!crop) return makeResult(false, 'Select a valid seed.');
  if (!crop.seasons.includes(state.season)) return makeResult(false, `${crop.name} does not grow in ${SEASONS[state.season].toLowerCase()}.`);
  if (itemQuantity(state, seedId) < 1) return makeResult(false, `You are out of ${crop.name.toLowerCase()} seeds.`);
  if (state.stamina < 1) return makeResult(false, 'Not enough stamina to plant.');
  removeItem(state, seedId, 1);
  plot.crop = { id: crop.id, remaining: crop.growth, ready: false, withered: false };
  state.stats.planted += 1;
  spendStamina(state, 1);
  return makeResult(true, `Planted ${crop.name.toLowerCase()}.`, { cell: target, crop: crop.id });
};

const useAxe = (state, target) => {
  const object = targetObject(state);
  if (!object || object.type !== 'tree') return makeResult(false, 'Point the Axe at a tree.');
  if (state.resourceState[object.id]?.depleted) return makeResult(false, 'This tree has already been chopped today.');
  if (state.stamina < 4) return makeResult(false, 'Not enough stamina to chop down the tree.');
  if (!canAddItem(state, 'wood', 5)) return makeResult(false, 'Inventory full; make room for wood.');
  spendStamina(state, 4);
  addItem(state, 'wood', 5);
  state.resourceState[object.id] = { hits: 1, depleted: true };
  return makeResult(true, 'Tree chopped down. You got 5 Wood.', { item: 'wood', quantity: 5 });
};

const usePickaxe = (state, target) => {
  const object = targetObject(state);
  if (!object || object.type !== 'ore') return makeResult(false, 'Point the Pickaxe at a rock or ore vein.');
  const progress = state.resourceState[object.id] ?? { hits: 0, depleted: false };
  if (progress.depleted) return makeResult(false, 'This rock has already been mined today.');
  if (state.stamina < 4) return makeResult(false, 'Not enough stamina to mine.');
  const drop = getOreDrop(object.id);
  const breaksNode = progress.hits + 1 >= 2;
  if (breaksNode && !canAddItem(state, drop, 1)) return makeResult(false, 'Inventory full; make room for the ore.');
  spendStamina(state, 4);
  if (!breaksNode) {
    state.resourceState[object.id] = { hits: progress.hits + 1, depleted: false };
    return makeResult(true, 'Rock cracked. One more swing might do it.');
  }
  addItem(state, drop, 1);
  state.resourceState[object.id] = { hits: 2, depleted: true };
  state.stats.mined += 1;
  return makeResult(true, `You found ${itemInfo(drop).name}.`, { item: drop, quantity: 1 });
};

const startFishing = (state, target) => {
  if (state.fishing) return finishFishing(state);
  if (tileAt(target.x, target.y) !== 'water') return makeResult(false, 'Aim the Fishing Rod at nearby water.');
  if (state.stamina < 2) return makeResult(false, 'Not enough stamina to fish.');
  const region = regionAt(target.x, target.y);
  if (!region || !['farm', 'forest', 'coast'].includes(region.id)) return makeResult(false, 'There are no fish in these waters.');
  const delay = 3 + deterministicRandom(state) * 5;
  state.fishing = {
    phase: 'waiting',
    elapsed: 0,
    biteAt: delay,
    biteWindow: 1.5,
    x: target.x,
    y: target.y,
    habitat: region.id,
  };
  spendStamina(state, 2);
  return makeResult(true, 'You cast your line. Wait for a bite.', { fishing: { ...state.fishing } });
};

const startBattle = (state, monster) => {
  if (state.battle) return makeResult(false, 'A battle is in progress.');
  if (!monster || monster.defeated || monster.hp <= 0 || !hasMonsterType(monster.type)) {
    return makeResult(false, 'No monsters nearby.');
  }
  state.battle = { monsterId: monster.id, guarding: false };
  return makeResult(true, `${MONSTER_TYPES[monster.type].name} challenges you.`, { battle: { ...state.battle }, monster: monster.id });
};

const useSword = (state) => {
  const playerX = Math.floor(state.player.x);
  const playerY = Math.floor(state.player.y);
  const monster = state.monsters.find((entry) => (
    hasMonsterType(entry.type) && !entry.defeated && entry.hp > 0
    && Math.abs(Math.floor(entry.x) - playerX) + Math.abs(Math.floor(entry.y) - playerY) <= 1
  ));
  if (!monster) return makeResult(false, 'No monsters nearby.');
  return startBattle(state, monster);
};

export function useTool(state) {
  if (state.battle) return makeResult(false, 'Finish the battle before using a tool.');
  if (state.fishing && state.tool !== 'rod') return makeResult(false, 'Cancel fishing before using another tool.');
  if (!TOOL_IDS.has(state.tool) || !hasTool(state, state.tool)) return makeResult(false, 'The selected tool is not available.');
  const target = targetCell(state);
  switch (state.tool) {
    case 'hoe': return useHoe(state, target);
    case 'can': return useCan(state, target);
    case 'seeds': return useSeeds(state, target);
    case 'axe': return useAxe(state, target);
    case 'pickaxe': return usePickaxe(state, target);
    case 'rod': return startFishing(state, target);
    case 'sword': return useSword(state);
    default: return makeResult(false, 'Unknown tool.');
  }
}

const nearbyCells = (player) => {
  const x = Math.floor(player.x);
  const y = Math.floor(player.y);
  return [
    { x, y }, { x, y: y - 1 }, { x: x + 1, y }, { x, y: y + 1 }, { x: x - 1, y },
  ];
};

const findNearbyTarget = (state) => {
  const cells = nearbyCells(state.player);
  const facingTarget = targetCell(state);
  const candidates = [];
  const priority = { crop: 0, monster: 1, animal: 2, building: 3, object: 4, npc: 5 };
  const add = (type, id, x, y, value) => {
    const distance = adjacentCellDistance(state.player, x, y);
    if (distance > 1) return;
    candidates.push({
      type,
      id,
      x,
      y,
      value,
      distance,
      facing: x === facingTarget.x && y === facingTarget.y,
      priority: priority[type],
    });
  };

  for (const cell of cells) {
    const plot = farmPlot(state, cell.x, cell.y);
    if (plot?.crop) add('crop', farmKey(cell.x, cell.y), cell.x, cell.y, plot);
  }
  for (const monster of state.monsters) {
    if (hasMonsterType(monster.type) && !monster.defeated && monster.hp > 0) {
      add('monster', monster.id, Math.floor(monster.x), Math.floor(monster.y), monster);
    }
  }
  for (const animal of state.animals) add('animal', animal.id, Math.floor(animal.x), Math.floor(animal.y), animal);
  for (const building of WORLD.buildings) add('building', building.id, building.door[0], building.door[1], building);
  for (const object of WORLD.objects) {
    if (object.type !== 'fish') add('object', object.id, object.x, object.y, object);
  }
  for (const villager of VILLAGERS) {
    const position = getNpcPosition(state, villager.id);
    if (position) add('npc', villager.id, Math.floor(position.x), Math.floor(position.y), villager);
  }
  candidates.sort((a, b) => (
    Number(b.facing) - Number(a.facing)
    || a.distance - b.distance
    || a.priority - b.priority
  ));
  return candidates[0] ?? null;
};

const harvestCrop = (state, target) => {
  const plot = target.value;
  const crop = plot.crop;
  if (!hasCrop(crop?.id)) return makeResult(false, 'Unknown crop.');
  const definition = CROPS[crop.id];
  if (crop.withered) {
    plot.crop = null;
    plot.tilled = true;
    return makeResult(true, `Cleared the withered ${definition.name.toLowerCase()}.`, { cell: { x: target.x, y: target.y } });
  }
  if (!crop.ready) return makeResult(false, `${definition.name} is not ready to harvest yet.`);
  if (!canAddItem(state, crop.id, 1)) return makeResult(false, 'Inventory full; the crop will stay here.');
  addItem(state, crop.id, 1);
  if (definition.regrow > 0) {
    crop.remaining = definition.regrow;
    crop.ready = false;
  } else {
    plot.crop = null;
    plot.tilled = true;
  }
  state.stats.harvested += 1;
  return makeResult(true, `Harvested ${definition.name.toLowerCase()}.`, { item: crop.id, quantity: 1 });
};

const animalProduct = (animal) => ({ chicken: 'egg', cow: 'milk', sheep: 'wool' })[animal.type] ?? 'egg';

const interactWithAnimal = (state, animal) => {
  if (animal.product) {
    const product = animalProduct(animal);
    if (!canAddItem(state, product, 1)) return makeResult(false, 'Inventory full; the animal product is still available.');
    addItem(state, product, 1);
    animal.product = false;
    return makeResult(true, `Collected ${itemInfo(product).name}.`, { kind: 'animal', id: animal.id, item: product });
  }
  if (!animal.petted) {
    animal.petted = true;
    return makeResult(true, `${animal.name} enjoys being petted.`, { kind: 'animal', id: animal.id });
  }
  return makeResult(true, `${animal.name} has already been petted.`, { kind: 'animal', id: animal.id });
};

const nearbyWater = (player) => nearbyCells(player).some(({ x, y }) => tileAt(x, y) === 'water');

const interactWithObject = (state, object) => {
  switch (object.type) {
    case 'bin':
      return makeResult(true, 'The shipping bin is ready for items.', { kind: 'shipping', id: object.id });
    case 'well':
      if (state.water >= state.maxWater) return makeResult(false, 'The Watering Can is already full.', { kind: 'well', id: object.id });
      state.water = state.maxWater;
      return makeResult(true, 'Refilled the Watering Can.', { kind: 'well', id: object.id });
    case 'feed':
      return makeResult(true, 'The feed trough is ready to use.', {
        kind: 'animal',
        id: state.animals.find((animal) => !animal.fed)?.id ?? state.animals[0]?.id ?? object.id,
      });
    case 'sign':
      return makeResult(true, object.id === 'village-notice'
        ? 'Village notice: all roads to Meadow Village are open.'
        : 'Welcome to Meadow Farm.');
    case 'tree':
      return makeResult(true, 'Sturdy tree. Use the Axe to gather wood.', { id: object.id });
    case 'ore': {
      const region = regionAt(object.x, object.y);
      return makeResult(
        true,
        'This rock is sparkling. Use the Pickaxe to mine it.',
        region?.id === 'mine' ? { id: object.id, kind: 'mine' } : { id: object.id },
      );
    }
    default:
      return makeResult(false, 'Nothing to do here.');
  }
};

const interactWithBuilding = (building) => {
  if (building.id === 'farmhouse') return makeResult(true, 'The farmhouse feels warm and cozy.', { kind: 'sleep', id: building.id });
  if (building.id === 'mine') return makeResult(true, 'The mine entrance is open. The path is safe to explore.', { kind: 'mine', id: building.id });
  if (['bakery', 'co_op', 'workshop'].includes(building.id)) {
    return makeResult(true, `${building.name} welcomes you.`, { kind: 'shop', id: building.id });
  }
  return makeResult(true, `${building.name} is a gathering place for villagers.`, { id: building.id });
};

export function interact(state) {
  const target = findNearbyTarget(state);
  if (!target) {
    if (nearbyWater(state.player) && state.water < state.maxWater) {
      state.water = state.maxWater;
      return makeResult(true, 'Refilled the Watering Can from nearby water.', { kind: 'well' });
    }
    return makeResult(false, 'Nothing nearby.');
  }
  if (target.type === 'crop') return harvestCrop(state, target);
  if (target.type === 'monster') return startBattle(state, target.value);
  if (target.type === 'animal') return interactWithAnimal(state, target.value);
  if (target.type === 'building') return interactWithBuilding(target.value);
  if (target.type === 'object') {
    if (target.value.type === 'well' && nearbyWater(state.player) && state.water < state.maxWater) {
      state.water = state.maxWater;
      return makeResult(true, 'Refilled the Watering Can from nearby water.', { kind: 'well', id: target.id });
    }
    return interactWithObject(state, target.value);
  }
  const message = talkMessage(target.value);
  return makeResult(true, message, { kind: 'npc', id: target.id });
}

const talkMessage = (villager) => `${villager.name} greets you warmly.`;

const farmToolPrompt = (state) => {
  const target = targetCell(state);
  const plot = farmPlot(state, target.x, target.y);
  if (!inField(target.x, target.y) || tileAt(target.x, target.y) !== 'soil') return '';
  if (state.tool === 'hoe' && !plot?.tilled && state.stamina >= 3) return 'Hoe this plot';
  if (state.tool === 'can' && plot?.tilled && !plot.watered && state.water > 0 && state.stamina >= 1) {
    return 'Water crop';
  }
  if (state.tool === 'seeds' && plot?.tilled && !plot.crop && hasCrop(state.selectedSeed)
    && itemQuantity(state, seedItemId(state.selectedSeed)) > 0
    && CROPS[state.selectedSeed].seasons.includes(state.season) && state.stamina >= 1) {
    return `Plant ${CROPS[state.selectedSeed].name.toLowerCase()}`;
  }
  return '';
};

export function getPrompt(state) {
  if (state.fishing) return state.fishing.phase === 'bite' ? 'Fish! Reel in' : 'Wait for a bite';
  const farmPrompt = farmToolPrompt(state);
  if (farmPrompt) return farmPrompt;
  const target = findNearbyTarget(state);
  if (!target) {
    const pointed = targetCell(state);
    const pointedTile = tileAt(pointed.x, pointed.y);
    const object = WORLD.objects.find((entry) => entry.x === pointed.x && entry.y === pointed.y);
    if (state.tool === 'rod' && pointedTile === 'water') return 'Fish here';
    if (state.tool === 'axe' && object?.type === 'tree' && !state.resourceState[object.id]?.depleted) return 'Chop tree';
    if (state.tool === 'pickaxe' && object?.type === 'ore' && !state.resourceState[object.id]?.depleted) return 'Mine rock';
    if (nearbyWater(state.player) && state.water < state.maxWater) return 'Refill Watering Can by the water';
    return 'Nothing nearby';
  }
  if (target.type === 'crop') {
    const crop = target.value.crop;
    if (!hasCrop(crop?.id)) return 'Unknown crop';
    const definition = CROPS[crop.id];
    if (crop.withered) return `Clear withered ${definition.name.toLowerCase()}`;
    return crop.ready ? `Harvest ${definition.name.toLowerCase()}` : `${definition.name} is growing`;
  }
  if (target.type === 'monster') return `Fight ${MONSTER_TYPES[target.value.type].name}`;
  if (target.type === 'animal') return target.value.product ? `Collect ${target.value.name}'s produce` : `Pet ${target.value.name}`;
  if (target.type === 'npc') return `Talk to ${target.value.name}`;
  if (target.type === 'building') {
    if (target.id === 'farmhouse') return 'Sleep at home';
    if (target.id === 'mine') return 'Enter the mine';
    if (['bakery', 'co_op', 'workshop'].includes(target.id)) return `Open ${target.value.name}`;
    return `Visit ${target.value.name}`;
  }
  if (target.value.type === 'tree' && state.resourceState[target.id]?.depleted) return 'Tree already chopped today';
  if (target.value.type === 'ore' && state.resourceState[target.id]?.depleted) return 'Rock already mined today';
  if (target.value.type === 'well' && state.water >= state.maxWater) return 'Watering Can is full';
  if (target.value.type === 'ore' && (state.resourceState[target.id]?.hits ?? 0) > 0) return 'Swing the Pickaxe again';
  const prompts = {
    bin: 'Ship items', well: 'Refill Watering Can', feed: 'Feed the chicken',
    sign: 'Read sign', tree: 'Chop tree', ore: 'Mine rock',
  };
  return prompts[target.value.type] ?? 'Interact';
}

const giftPoints = (villager, itemId, state) => {
  const definition = VILLAGER_BY_ID.get(villager);
  let points = itemId === definition.gift ? 25 : GIFT_LIKES[villager]?.has(itemId) ? 12 : 3;
  const birthday = BIRTHDAYS[villager];
  if (birthday && birthday[0] === state.season && birthday[1] === state.day) points = Math.min(50, points * 2);
  return points;
};

export function talkTo(state, id) {
  const villager = VILLAGER_BY_ID.get(id);
  if (!villager) return makeResult(false, 'Unknown villager.');
  if (state.talked[id]) return makeResult(false, `${villager.name} has already spoken with you today.`);
  state.talked[id] = true;
  state.friendship[id] = Math.min(1000, (state.friendship[id] ?? 0) + 8);
  state.stats.talked = (state.stats.talked ?? 0) + 1;
  return makeResult(true, `${villager.name} enjoys chatting with you.`, { id, friendship: state.friendship[id] });
}

export function giveGift(state, id, itemId) {
  const villager = VILLAGER_BY_ID.get(id);
  const info = itemInfo(itemId);
  if (!villager) return makeResult(false, 'Unknown villager.');
  if (!info || itemQuantity(state, itemId) < 1) return makeResult(false, 'That item is not in your inventory.');
  if (state.gifted[id]) return makeResult(false, `${villager.name} has already received a gift today.`);
  const points = giftPoints(id, itemId, state);
  removeItem(state, itemId, 1);
  state.gifted[id] = true;
  state.friendship[id] = Math.min(1000, (state.friendship[id] ?? 0) + points);
  const response = itemId === villager.gift ? 'That gift made them very happy.' : 'Thanks for the gift.';
  return makeResult(true, `${villager.name}: ${response}`, { id, item: itemId, friendship: state.friendship[id] });
}

export function feedAnimals(state) {
  const waiting = state.animals.filter((animal) => !animal.fed);
  if (waiting.length === 0) return makeResult(false, 'All animals have been fed today.');
  if (itemQuantity(state, 'feed') < waiting.length) return makeResult(false, 'Not enough feed for all the animals.');
  removeItem(state, 'feed', waiting.length);
  for (const animal of waiting) animal.fed = true;
  return makeResult(true, `${waiting.length} ${waiting.length === 1 ? 'animal' : 'animals'} fed.`, { count: waiting.length });
}

const validQuantity = (quantity) => Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_STACK;

export function buyItem(state, itemId, quantity = 1) {
  if (!validQuantity(quantity)) return makeResult(false, 'Invalid purchase quantity.');
  const tool = TOOLS.find(({ id }) => id === itemId);
  if (tool) {
    if (hasTool(state, itemId)) return makeResult(false, `You already own the ${tool.name}.`);
    const total = tool.cost * quantity;
    if (quantity !== 1 || total <= 0) return makeResult(false, 'This tool is not for sale.');
    if (state.gold < total) return makeResult(false, 'Not enough gold.');
    state.gold -= total;
    state.toolsOwned.push(itemId);
    return makeResult(true, `${tool.name} purchased.`, { item: itemId, quantity: 1, total });
  }

  const info = itemInfo(itemId);
  if (!info || info.price <= 0 || info.type === 'perkakas') return makeResult(false, 'This item is not sold here.');
  const total = info.price * quantity;
  if (state.gold < total) return makeResult(false, 'Not enough gold.');
  if (!canAddItem(state, itemId, quantity)) return makeResult(false, 'Inventory full or stack limit reached.');
  state.gold -= total;
  addItem(state, itemId, quantity);
  if (info.type === 'benih') state.selectedSeed = itemId.slice(0, -5);
  return makeResult(true, `Bought ${info.name} × ${quantity}.`, { item: itemId, quantity, total });
}

export function sellItem(state, itemId, quantity = 1) {
  if (!validQuantity(quantity)) return makeResult(false, 'Invalid sale quantity.');
  const info = itemInfo(itemId);
  if (!info || info.type === 'perkakas' || info.sellPrice <= 0) return makeResult(false, 'This item cannot be shipped.');
  if (itemQuantity(state, itemId) < quantity) return makeResult(false, 'Not enough items in your inventory.');
  if ((state.shipping[itemId] ?? 0) + quantity > MAX_STACK) return makeResult(false, 'The shipping bin stack is full.');
  removeItem(state, itemId, quantity);
  state.shipping[itemId] = (state.shipping[itemId] ?? 0) + quantity;
  return makeResult(true, `Added ${info.name} × ${quantity} to the shipping bin.`, { item: itemId, quantity });
}

export function eatFood(state) {
  if (itemQuantity(state, 'bread') < 1) return makeResult(false, 'You have no bread to eat.');
  const hp = integerInRange(state.player.hp, 100, 0, 100);
  if (state.stamina >= state.maxStamina && hp >= 100) return makeResult(false, 'Your stamina and health are already full.');
  removeItem(state, 'bread', 1);
  state.stamina = Math.min(state.maxStamina, state.stamina + 35);
  state.player.hp = Math.min(100, hp + 20);
  return makeResult(true, 'Bread restored your stamina and health.', { stamina: state.stamina, hp: state.player.hp });
}

export function finishFishing(state) {
  const fishing = state.fishing;
  if (!fishing) return makeResult(false, 'You are not fishing.');
  if (fishing.elapsed < fishing.biteAt) return makeResult(false, 'No bite yet. Wait for the bobber to move.');
  if (fishing.elapsed > fishing.biteAt + fishing.biteWindow) {
    state.fishing = null;
    return makeResult(false, 'The fish got away. Try again on the next bite.');
  }
  const pool = fishPool(state, fishing.habitat);
  if (pool.length === 0) return makeResult(false, 'No fish are biting here.');
  const preview = previewRandom(state.rngSeed);
  const fish = pool[Math.floor(preview.value * pool.length)];
  if (!canAddItem(state, fish.id, 1)) return makeResult(false, 'Inventory full; make room before reeling in a fish.');
  state.rngSeed = preview.seed;
  addItem(state, fish.id, 1);
  state.stats.fished += 1;
  state.fishing = null;
  return makeResult(true, `Caught ${fish.name}.`, { item: fish.id, quantity: 1 });
}

export function cancelFishing(state) {
  if (!state.fishing) return makeResult(false, 'You are not fishing.');
  state.fishing = null;
  return makeResult(true, 'Fishing cancelled without losing any items.');
}

const advanceFishing = (state, seconds) => {
  if (!state.fishing) return '';
  const wasWaiting = state.fishing.phase === 'waiting';
  state.fishing.elapsed += seconds;
  if (wasWaiting && state.fishing.elapsed >= state.fishing.biteAt) state.fishing.phase = 'bite';
  if (state.fishing.elapsed > state.fishing.biteAt + state.fishing.biteWindow) {
    state.fishing = null;
    return 'You missed the bite. Your line was reeled in.';
  }
  return wasWaiting && state.fishing.phase === 'bite' ? 'A bite! Reel in now.' : '';
};

const chooseWeather = (state) => {
  const roll = deterministicRandom(state);
  if (state.season === 3) return roll < 0.25 ? 'snowy' : roll < 0.6 ? 'cloudy' : 'sunny';
  return roll < 0.2 ? 'rainy' : roll < 0.52 ? 'cloudy' : 'sunny';
};

const advanceCalendar = (state) => {
  state.day += 1;
  if (state.day > 28) {
    state.day = 1;
    state.season += 1;
    if (state.season >= SEASONS.length) {
      state.season = 0;
      state.year += 1;
    }
  }
};

const resolveCropGrowth = (state) => {
  if (state.weather === 'rainy') {
    for (const plot of Object.values(state.farm)) if (plot.tilled) plot.watered = true;
  }
  for (const plot of Object.values(state.farm)) {
    const crop = plot.crop;
    if (!crop || crop.withered || crop.ready || !plot.watered) continue;
    crop.remaining = Math.max(0, crop.remaining - 1);
    if (crop.remaining === 0) crop.ready = true;
  }
};

export function sleep(state, forced = false) {
  const endingMinute = state.minute;
  const shipment = [];
  let settlement = 0;
  for (const [itemId, quantity] of Object.entries(state.shipping)) {
    const info = itemInfo(itemId);
    if (!info || info.sellPrice <= 0 || info.type === 'perkakas') continue;
    const value = info.sellPrice * quantity;
    settlement += value;
    shipment.push({ id: itemId, quantity, value });
  }
  state.gold = Math.min(MAX_GOLD, state.gold + settlement);
  state.shipping = {};

  resolveCropGrowth(state);
  for (const animal of state.animals) {
    if (animal.fed && !animal.product) animal.product = true;
    animal.fed = false;
    animal.petted = false;
  }

  advanceCalendar(state);
  for (const plot of Object.values(state.farm)) {
    if (plot.crop) {
      if (!hasCrop(plot.crop.id)) {
        plot.crop = null;
        plot.tilled = true;
      } else if (!plot.crop.withered && !CROPS[plot.crop.id].seasons.includes(state.season)) {
        plot.crop.withered = true;
        plot.crop.ready = false;
      }
    }
    plot.watered = false;
  }

  state.weather = chooseWeather(state);
  if (state.weather === 'rainy') {
    for (const plot of Object.values(state.farm)) if (plot.tilled) plot.watered = true;
  }
  state.talked = {};
  state.gifted = {};
  state.resourceState = {};
  state.monsters = makeInitialMonsters();
  state.battle = null;
  state.fishing = null;
  const rest = forced ? 0.6 : endingMinute >= 1560 ? 0.6 : endingMinute >= 1440 ? 0.8 : 1;
  state.stamina = Math.floor(state.maxStamina * rest);
  state.player.hp = Math.min(100, (state.player.hp ?? 100) + 40);
  state.player.x = START_POSITION.x;
  state.player.y = START_POSITION.y;
  state.player.facing = START_POSITION.facing;
  state.minute = 360;
  state.timeRemainder = 0;

  return makeResult(true, forced ? 'A new day begins after you rest.' : 'A new day begins.', {
    settlement: { gold: settlement, items: shipment },
    calendar: calendar(state),
    weather: state.weather,
  });
}

export function tick(state, seconds) {
  if (!finite(seconds) || seconds < 0) return makeResult(false, 'Invalid simulation time.');
  if (seconds === 0) return makeResult(true, 'Time did not advance.', { minute: state.minute });
  const message = advanceFishing(state, seconds);
  const speed = state.options?.relaxed ? 0.5 : 1;
  const accumulated = (state.timeRemainder ?? 0) + seconds * speed;
  const addedMinutes = Math.floor(accumulated);
  state.timeRemainder = accumulated - addedMinutes;
  if (state.minute + addedMinutes >= 1560) {
    state.minute = 1560;
    state.fishing = null;
    const transition = sleep(state, true);
    return { ...transition, forced: true };
  }
  state.minute += addedMinutes;
  return makeResult(true, message || 'Time passes.', { minute: state.minute, fishing: state.fishing ? { ...state.fishing } : null });
}

const counterAttack = (state, monster, guarded = false) => {
  const damage = guarded ? Math.max(1, Math.ceil(MONSTER_TYPES[monster.type].attack / 2)) : MONSTER_TYPES[monster.type].attack;
  state.player.hp = Math.max(0, state.player.hp - damage);
  if (state.player.hp > 0) return null;
  state.player.hp = 60;
  state.player.x = START_POSITION.x;
  state.player.y = START_POSITION.y;
  state.player.facing = START_POSITION.facing;
  monster.hp = Math.max(1, monster.hp);
  state.battle = null;
  return 'You ran out of energy and were sent home. You lost no items or gold.';
};

export function battleAction(state, action) {
  if (!['attack', 'guard', 'heal', 'flee'].includes(action)) return makeResult(false, 'Unknown battle action.');
  if (!state.battle) return makeResult(false, 'No battle is in progress.');
  const monster = state.monsters.find((entry) => entry.id === state.battle.monsterId && !entry.defeated);
  if (!monster) return makeResult(false, 'The monster is gone.');
  if (action === 'flee') {
    state.battle = null;
    return makeResult(true, 'You retreated safely.');
  }
  if (action === 'heal') {
    if (itemQuantity(state, 'bread') < 1) return makeResult(false, 'You have no bread to restore your strength.');
    if (state.player.hp >= 100) return makeResult(false, 'Your health is already full.');
    removeItem(state, 'bread', 1);
    state.player.hp = Math.min(100, state.player.hp + 35);
  }

  let guarded = action === 'guard';
  if (action === 'attack') {
    const roll = previewRandom(state.rngSeed);
    const damage = 9 + Math.floor(roll.value * 8);
    const reward = MONSTER_TYPES[monster.type].reward;
    const willDefeat = monster.hp <= damage;
    if (willDefeat && !canAddItem(state, reward.item, reward.quantity)) {
      return makeResult(false, 'Inventory full; make room before defeating this monster.');
    }
    state.rngSeed = roll.seed;
    monster.hp = Math.max(0, monster.hp - damage);
    if (monster.hp === 0) {
      monster.defeated = true;
      state.stats.defeated += 1;
      state.gold = Math.min(MAX_GOLD, state.gold + reward.gold);
      addItem(state, reward.item, reward.quantity);
      state.battle = null;
      return makeResult(true, `${MONSTER_TYPES[monster.type].name} defeated. You received ${reward.gold} Gold and ${itemInfo(reward.item).name}.`, {
        defeated: monster.id,
        reward: { ...reward },
      });
    }
  }

  const defeatMessage = counterAttack(state, monster, guarded);
  if (defeatMessage) return makeResult(true, defeatMessage, { lost: true, hp: state.player.hp });
  state.battle.guarding = false;
  const message = action === 'attack'
    ? `You attack ${MONSTER_TYPES[monster.type].name}.`
    : action === 'guard'
      ? `You block ${MONSTER_TYPES[monster.type].name}'s attack.`
      : 'You eat bread and recover.';
  return makeResult(true, message, { hp: state.player.hp, monsterHp: monster.hp, battle: { ...state.battle } });
}

export function getQuests(state) {
  return QUESTS.map((quest) => {
    const progress = Math.min(quest.target, state.stats[quest.stat] ?? 0);
    return {
      id: quest.id,
      title: quest.title,
      description: quest.description,
      progress,
      target: quest.target,
      complete: progress >= quest.target,
      claimed: state.quests[quest.id]?.claimed === true,
      reward: { ...quest.reward },
    };
  });
}

export function claimQuest(state, id) {
  const quest = getQuests(state).find((entry) => entry.id === id);
  if (!quest) return makeResult(false, 'Unknown quest.');
  if (quest.claimed) return makeResult(false, 'This quest reward has already been claimed.');
  if (!quest.complete) return makeResult(false, 'Complete the quest objective first.');
  if (state.gold + quest.reward.gold > MAX_GOLD) return makeResult(false, 'You cannot carry any more gold.');
  if (!canAddItem(state, quest.reward.item, quest.reward.quantity)) return makeResult(false, 'Inventory full; make room before claiming the reward.');
  state.gold += quest.reward.gold;
  addItem(state, quest.reward.item, quest.reward.quantity);
  state.quests[id] = { claimed: true };
  return makeResult(true, `Claimed the reward for “${quest.title}”.`, { reward: { ...quest.reward } });
}

export { getNpcPosition };
