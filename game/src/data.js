export const TILE = 32;
export const MAP_WIDTH = 72;
export const MAP_HEIGHT = 56;

export const SEASONS = Object.freeze([
  'Spring',
  'Summer',
  'Autumn',
  'Winter',
]);

export const WEEKDAYS = Object.freeze([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

export const TOOLS = Object.freeze([
  { id: 'hoe', name: 'Hoe', icon: '⚒', cost: 0 },
  { id: 'can', name: 'Watering Can', icon: '💧', cost: 0 },
  { id: 'seeds', name: 'Seeds', icon: '🌱', cost: 0 },
  { id: 'axe', name: 'Axe', icon: '🪓', cost: 0 },
  { id: 'pickaxe', name: 'Pickaxe', icon: '⛏', cost: 240 },
  { id: 'rod', name: 'Fishing Rod', icon: '🎣', cost: 180 },
  { id: 'sword', name: 'Sword', icon: '⚔', cost: 250 },
]);

export const CROPS = Object.freeze({
  turnip: {
    id: 'turnip', name: 'Turnip', color: '#e8b9d1', seasons: [0],
    growth: 4, regrow: 0, seedPrice: 20, sellPrice: 55,
  },
  potato: {
    id: 'potato', name: 'Potato', color: '#d8ad72', seasons: [0],
    growth: 6, regrow: 0, seedPrice: 40, sellPrice: 95,
  },
  cabbage: {
    id: 'cabbage', name: 'Cabbage', color: '#79b867', seasons: [0],
    growth: 8, regrow: 0, seedPrice: 60, sellPrice: 155,
  },
  tomato: {
    id: 'tomato', name: 'Tomato', color: '#e15c4a', seasons: [1],
    growth: 8, regrow: 3, seedPrice: 70, sellPrice: 45,
  },
  corn: {
    id: 'corn', name: 'Corn', color: '#f0c84d', seasons: [1],
    growth: 10, regrow: 4, seedPrice: 80, sellPrice: 55,
  },
  melon: {
    id: 'melon', name: 'Melon', color: '#83bd67', seasons: [1],
    growth: 12, regrow: 0, seedPrice: 120, sellPrice: 320,
  },
  carrot: {
    id: 'carrot', name: 'Carrot', color: '#ed8a49', seasons: [2],
    growth: 5, regrow: 0, seedPrice: 30, sellPrice: 75,
  },
  eggplant: {
    id: 'eggplant', name: 'Eggplant', color: '#8766b7', seasons: [2],
    growth: 7, regrow: 3, seedPrice: 60, sellPrice: 45,
  },
  pumpkin: {
    id: 'pumpkin', name: 'Pumpkin', color: '#e77c32', seasons: [2],
    growth: 10, regrow: 0, seedPrice: 100, sellPrice: 250,
  },
  radish: {
    id: 'radish', name: 'Snow Radish', color: '#f0d6dc', seasons: [3],
    growth: 6, regrow: 0, seedPrice: 35, sellPrice: 85,
  },
  kale: {
    id: 'kale', name: 'Kale', color: '#458b63', seasons: [3],
    growth: 8, regrow: 0, seedPrice: 50, sellPrice: 120,
  },
  snow_pea: {
    id: 'snow_pea', name: 'Snow Pea', color: '#94c98a', seasons: [3],
    growth: 9, regrow: 3, seedPrice: 75, sellPrice: 65,
  },
});

export const MONSTER_TYPES = Object.freeze({
  slime: {
    id: 'slime', name: 'Meadow Slime', color: '#75c982',
    hp: 24, attack: 8, reward: { gold: 22, item: 'slime_gel', quantity: 1 },
  },
  cave_bat: {
    id: 'cave_bat', name: 'Cave Bat', color: '#9671b4',
    hp: 32, attack: 11, reward: { gold: 35, item: 'bat_wing', quantity: 1 },
  },
  moss_sprite: {
    id: 'moss_sprite', name: 'Moss Sprite', color: '#4d9b63',
    hp: 42, attack: 12, reward: { gold: 48, item: 'moss_fragment', quantity: 1 },
  },
  sand_crab: {
    id: 'sand_crab', name: 'Sand Crab', color: '#df9b55',
    hp: 36, attack: 10, reward: { gold: 40, item: 'crab_shell', quantity: 1 },
  },
});

export const FISH = Object.freeze({
  pond_perch: {
    id: 'pond_perch', name: 'Pond Perch', color: '#d8aa65',
    habitats: ['farm'], seasons: [0, 1, 2, 3], sellPrice: 22,
  },
  pond_carp: {
    id: 'pond_carp', name: 'Pond Carp', color: '#d78a54',
    habitats: ['farm'], seasons: [0, 1, 2], sellPrice: 30,
  },
  pond_catfish: {
    id: 'pond_catfish', name: 'Pond Catfish', color: '#8a8893',
    habitats: ['farm'], seasons: [1, 2, 3], sellPrice: 38,
  },
  forest_trout: {
    id: 'forest_trout', name: 'Forest Trout', color: '#e18e78',
    habitats: ['forest'], seasons: [0, 1, 2], sellPrice: 45,
  },
  forest_bluegill: {
    id: 'forest_bluegill', name: 'Bluegill', color: '#e1bd65',
    habitats: ['forest'], seasons: [0, 1, 3], sellPrice: 27,
  },
  forest_pike: {
    id: 'forest_pike', name: 'Pike', color: '#7e9e69',
    habitats: ['forest'], seasons: [1, 2], sellPrice: 54,
  },
  coast_sardine: {
    id: 'coast_sardine', name: 'Sardine', color: '#86b5c6',
    habitats: ['coast'], seasons: [0, 1, 2, 3], sellPrice: 24,
  },
  coast_mackerel: {
    id: 'coast_mackerel', name: 'Mackerel', color: '#6397aa',
    habitats: ['coast'], seasons: [1, 2], sellPrice: 46,
  },
  coast_bream: {
    id: 'coast_bream', name: 'Coastal Bream', color: '#d88b6d',
    habitats: ['coast'], seasons: [0, 2, 3], sellPrice: 66,
  },
  winter_perch: {
    id: 'winter_perch', name: 'Ice Perch', color: '#a5cde2',
    habitats: ['forest', 'coast'], seasons: [3], sellPrice: 72,
  },
  winter_trout: {
    id: 'winter_trout', name: 'Snow Trout', color: '#b7d9ec',
    habitats: ['forest'], seasons: [3], sellPrice: 84,
  },
  glacier_carp: {
    id: 'glacier_carp', name: 'Glacier Carp', color: '#91b8d5',
    habitats: ['coast'], seasons: [3], sellPrice: 96,
  },
});

export const ITEMS = Object.freeze({
  feed: { name: 'Chicken Feed', price: 20, sellPrice: 8, color: '#cfaa69', type: 'pakan' },
  bread: { name: 'Bread', price: 35, sellPrice: 18, color: '#c98955', type: 'makanan' },
  egg: { name: 'Egg', price: 0, sellPrice: 45, color: '#f3e6c1', type: 'hasil ternak' },
  milk: { name: 'Milk', price: 0, sellPrice: 140, color: '#eee9dc', type: 'hasil ternak' },
  wool: { name: 'Wool', price: 0, sellPrice: 210, color: '#eee2cf', type: 'hasil ternak' },
  wood: { name: 'Wood', price: 0, sellPrice: 2, color: '#9b694b', type: 'bahan' },
  stone: { name: 'Stone', price: 0, sellPrice: 2, color: '#92949a', type: 'bahan' },
  copper_ore: { name: 'Copper Ore', price: 0, sellPrice: 15, color: '#c47b4c', type: 'bijih' },
  iron_ore: { name: 'Iron Ore', price: 0, sellPrice: 30, color: '#a7abb2', type: 'bijih' },
  silver_ore: { name: 'Silver Ore', price: 0, sellPrice: 60, color: '#c8d3df', type: 'bijih' },
  gold_ore: { name: 'Gold Ore', price: 0, sellPrice: 100, color: '#e7c456', type: 'bijih' },
  gem: { name: 'Gemstone', price: 0, sellPrice: 150, color: '#62c6c1', type: 'permata' },
  slime_gel: { name: 'Slime Gel', price: 0, sellPrice: 16, color: '#74c982', type: 'rampasan' },
  bat_wing: { name: 'Bat Wing', price: 0, sellPrice: 24, color: '#9671b4', type: 'rampasan' },
  moss_fragment: { name: 'Moss Fragment', price: 0, sellPrice: 32, color: '#4d9b63', type: 'rampasan' },
  crab_shell: { name: 'Crab Shell', price: 0, sellPrice: 28, color: '#df9b55', type: 'rampasan' },
  herbal_tea: { name: 'Herbal Tea', price: 28, sellPrice: 14, color: '#91b879', type: 'makanan' },
});

export const VILLAGERS = Object.freeze([
  {
    id: 'dlira', name: 'Dlira', role: 'Baker', color: '#ef91ac',
    gift: 'bread', home: [48, 16],
  },
  {
    id: 'dlito', name: 'Dlito', role: 'Co-op Farmer', color: '#77b96a',
    gift: 'corn', home: [56, 17],
  },
  {
    id: 'dlizal', name: 'Dlizal', role: 'Riverkeeper', color: '#5ab6e2',
    gift: 'coast_bream', home: [51, 38],
  },
  {
    id: 'dliwi', name: 'Dliwi', role: 'Engineer', color: '#edc94e',
    gift: 'copper_ore', home: [65, 17],
  },
  {
    id: 'dliyu', name: 'Dliyu', role: 'Archivist', color: '#aa89d3',
    gift: 'herbal_tea', home: [50, 27],
  },
]);

export const BIRTHDAYS = Object.freeze({
  dlira: [0, 12],
  dlito: [2, 5],
  dlizal: [1, 16],
  dliwi: [3, 9],
  dliyu: [2, 23],
});
