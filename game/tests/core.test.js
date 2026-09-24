import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CROPS,
  MAP_HEIGHT,
  MAP_WIDTH,
  MONSTER_TYPES,
  SEASONS,
  TOOLS,
  VILLAGERS,
} from '../src/data.js';
import {
  battleAction,
  buyItem,
  calendar,
  cancelFishing,
  claimQuest,
  createState,
  cycleTool,
  eatFood,
  feedAnimals,
  finishFishing,
  formatTime,
  getPrompt,
  getQuests,
  giveGift,
  interact,
  itemInfo,
  movePlayer,
  selectSeed,
  selectTool,
  sellItem,
  sleep,
  talkTo,
  targetCell,
  tick,
  useTool,
  validateState,
} from '../src/core.js';
import { WORLD, getNpcPosition, isWalkable, regionAt, tileAt } from '../src/world.js';

const snapshot = (value) => JSON.stringify(value);

const faceCell = (state, x, y, facing = 'down') => {
  const offsets = {
    down: [0, -1],
    up: [0, 1],
    left: [1, 0],
    right: [-1, 0],
  };
  const [dx, dy] = offsets[facing];
  state.player.x = x + dx + 0.5;
  state.player.y = y + dy + 0.5;
  state.player.facing = facing;
};

const walkableReachability = (state) => {
  const start = [Math.floor(state.player.x), Math.floor(state.player.y)];
  const queue = [start];
  const reached = new Set([start.join(',')]);
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextX = x + dx;
      const nextY = y + dy;
      const key = `${nextX},${nextY}`;
      if (!reached.has(key) && isWalkable(state, nextX, nextY)) {
        reached.add(key);
        queue.push([nextX, nextY]);
      }
    }
  }
  return reached;
};

test('the simulation data exposes the contracted world, tools, seasons, crops, and villagers', () => {
  const state = createState();
  assert.deepEqual([WORLD.width, WORLD.height], [72, 56]);
  assert.deepEqual([MAP_WIDTH, MAP_HEIGHT], [72, 56]);
  assert.deepEqual(TOOLS.map(({ id }) => id), ['hoe', 'can', 'seeds', 'axe', 'pickaxe', 'rod', 'sword']);
  assert.equal(Object.keys(CROPS).length >= 12, true);
  for (let season = 0; season < 4; season += 1) {
    assert.equal(Object.values(CROPS).some((crop) => crop.seasons.includes(season)), true);
  }
  assert.deepEqual(VILLAGERS.map(({ name }) => name), ['Dlira', 'Dlito', 'Dlizal', 'Dliwi', 'Dliyu']);
  assert.equal(state.player.x, 16.5);
  assert.equal(state.player.y, 18.5);
  assert.equal(Object.values(state.farm).filter((plot) => plot.crop?.ready).length, 3);
  assert.equal(state.animals.some((animal) => animal.type === 'chicken'), true);
  assert.equal(state.inventory.feed, 5);
  assert.equal(Object.keys(MONSTER_TYPES).length >= 4, true);
  assert.equal(state.monsters.length >= 4, true);
});

test('calendar and clock roll over seasons and preserve fractional simulation time', () => {
  assert.deepEqual(calendar({ season: 0, day: 1, year: 1 }), {
    season: 'Spring', day: 1, year: 1, weekday: 'Monday',
  });
  assert.equal(calendar({ season: 0, day: 28, year: 1 }).weekday, 'Sunday');
  assert.equal(calendar({ season: 1, day: 1, year: 1 }).weekday, 'Monday');
  assert.equal(formatTime({ minute: 420 }), '07:00');
  assert.equal(formatTime({ minute: 1500 }), '01:00');

  const state = createState();
  tick(state, 0.5);
  assert.equal(state.minute, 420);
  tick(state, 0.5);
  assert.equal(state.minute, 421);
  state.options.relaxed = true;
  tick(state, 60);
  assert.equal(state.minute, 451);

  state.season = 3;
  state.day = 28;
  state.year = 1;
  state.minute = 1559;
  state.options.relaxed = false;
  const result = tick(state, 1);
  assert.equal(result.ok, true);
  assert.equal(result.forced, true);
  assert.deepEqual(calendar(state), { season: 'Spring', day: 1, year: 2, weekday: 'Monday' });
  assert.equal(state.minute, 360);
  assert.equal(state.stamina, 60);
});

test('targeting floors negative coordinates and movement collides with terrain and buildings', () => {
  const state = createState();
  state.player = { x: -0.1, y: 16.9, facing: 'right', hp: 100 };
  assert.deepEqual(targetCell(state), { x: 0, y: 16 });
  state.player = { x: 8.5, y: 11.5, facing: 'down', hp: 100 };
  assert.equal(isWalkable(state, 9, 11), false);
  assert.equal(isWalkable(state, 4, 11), false);
  const result = movePlayer(state, 1, 0, 1);
  assert.equal(result.ok, true);
  assert.equal(state.player.facing, 'right');
  assert.ok(state.player.x < 9);
  assert.equal(isWalkable(state, -1, 11), false);

  const scheduled = createState();
  scheduled.player.x = 46.5;
  scheduled.player.y = 16.5;
  const npcPrompt = interact(scheduled);
  assert.equal(npcPrompt.kind, 'npc');
  movePlayer(scheduled, 1, 0, 1);
  assert.equal(Math.floor(scheduled.player.x), 46);
});

test('failed farming actions preserve seeds, water, stamina, and plots', () => {
  const state = createState();
  state.tool = 'hoe';
  const beforeWrongGround = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), beforeWrongGround);

  state.farm['16,22'] = { tilled: true, watered: false, crop: null };
  faceCell(state, 16, 22);
  state.tool = 'can';
  state.water = 0;
  const beforeEmptyCan = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), beforeEmptyCan);

  state.water = 3;
  state.stamina = 0;
  const beforeTired = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), beforeTired);

  state.stamina = 100;
  state.water = 3;
  state.tool = 'seeds';
  state.selectedSeed = 'turnip';
  state.season = 1;
  const beforeWrongSeason = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), beforeWrongSeason);

  state.season = 0;
  state.inventory.turnip_seed = 0;
  delete state.inventory.turnip_seed;
  const beforeEmptySeedBag = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), beforeEmptySeedBag);

  state.inventory.turnip_seed = 1;
  state.farm['16,22'].crop = { id: 'turnip', remaining: 4, ready: false, withered: false };
  const beforeOccupied = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), beforeOccupied);

  assert.equal(selectTool(state, 'teleporter').ok, false);
  assert.equal(selectSeed(state, 'unknown').ok, false);
});

test('watering, planting, and crop growth resolve one watered night at a time', () => {
  const state = createState();
  state.farm['16,22'] = { tilled: true, watered: false, crop: null };
  faceCell(state, 16, 22);
  state.tool = 'can';
  const watered = useTool(state);
  assert.equal(watered.ok, true);
  assert.equal(state.water, 29);
  assert.equal(state.stamina, 99);
  const beforeDuplicateWater = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), beforeDuplicateWater);

  state.tool = 'seeds';
  state.selectedSeed = 'turnip';
  assert.equal(useTool(state).ok, true);
  assert.equal(state.inventory.turnip_seed, 7);
  assert.equal(state.farm['16,22'].watered, true);
  assert.equal(state.stats.planted, 1);

  state.farm = {
    '16,22': { tilled: true, watered: true, crop: { id: 'turnip', remaining: 4, ready: false, withered: false } },
  };
  for (let night = 0; night < 4; night += 1) {
    state.weather = 'sunny';
    state.farm['16,22'].watered = true;
    sleep(state);
  }
  assert.equal(state.farm['16,22'].crop.ready, true);
  assert.equal(state.farm['16,22'].crop.remaining, 0);

  state.farm['16,22'].crop = { id: 'turnip', remaining: 4, ready: false, withered: false };
  state.farm['16,22'].watered = false;
  state.weather = 'sunny';
  sleep(state);
  assert.equal(state.farm['16,22'].crop.remaining, 4);

  state.farm['16,22'].crop = { id: 'turnip', remaining: 2, ready: false, withered: false };
  state.farm['16,22'].watered = false;
  state.weather = 'rainy';
  sleep(state);
  assert.equal(state.farm['16,22'].crop.remaining, 1);
});

test('all twelve crop varieties can be planted, grown, harvested, and shipped in season', () => {
  for (const crop of Object.values(CROPS)) {
    const state = createState();
    state.season = crop.seasons[0];
    state.farm = {};
    state.inventory[`${crop.id}_seed`] = 1;
    faceCell(state, 16, 22);
    assert.equal(useTool(state).ok, true, `${crop.id}: hoe`);
    assert.equal(selectSeed(state, crop.id).ok, true);
    assert.equal(selectTool(state, 'seeds').ok, true);
    assert.equal(useTool(state).ok, true, `${crop.id}: plant`);
    for (let night = 0; night < crop.growth; night += 1) {
      faceCell(state, 16, 22);
      state.tool = 'can';
      useTool(state);
      assert.equal(state.farm['16,22'].watered, true);
      sleep(state);
      assert.equal(state.farm['16,22'].crop.ready, night === crop.growth - 1, crop.id);
    }
    faceCell(state, 16, 22);
    assert.equal(interact(state).ok, true, `${crop.id}: harvest`);
    assert.equal(state.inventory[crop.id], 1);
    if (crop.regrow) assert.equal(state.farm['16,22'].crop.remaining, crop.regrow);
    else assert.equal(state.farm['16,22'].crop, null);
    const gold = state.gold;
    assert.equal(sellItem(state, crop.id).ok, true);
    sleep(state);
    assert.equal(state.gold - gold, crop.sellPrice, `${crop.id}: shipment`);
  }
});

test('harvest checks capacity, regrowth, and incompatible seasons without deleting crops', () => {
  const state = createState();
  state.season = 1;
  state.farm = {
    '16,22': { tilled: true, watered: true, crop: { id: 'tomato', remaining: 0, ready: true, withered: false } },
  };
  faceCell(state, 16, 22);
  const full = createState();
  state.inventory = Object.fromEntries(Object.entries(full.inventory).slice(0, 1));
  state.inventoryCapacity = 1;
  const beforeFullBag = snapshot(state);
  assert.equal(interact(state).ok, false);
  assert.equal(snapshot(state), beforeFullBag);

  state.inventoryCapacity = 24;
  assert.equal(interact(state).ok, true);
  assert.equal(state.inventory.tomato, 1);
  assert.equal(state.farm['16,22'].crop.remaining, 3);
  for (let night = 0; night < 3; night += 1) {
    state.farm['16,22'].watered = true;
    state.weather = 'sunny';
    sleep(state);
  }
  assert.equal(state.farm['16,22'].crop.ready, true);

  state.season = 0;
  state.day = 28;
  state.farm['16,22'] = { tilled: true, watered: true, crop: { id: 'turnip', remaining: 0, ready: true, withered: false } };
  state.weather = 'sunny';
  sleep(state);
  assert.equal(state.season, 1);
  assert.equal(state.farm['16,22'].crop.withered, true);
  faceCell(state, 16, 22);
  const cleared = interact(state);
  assert.equal(cleared.ok, true);
  assert.equal(state.farm['16,22'].crop, null);
});

test('shipping is paid once at dawn and invalid transactions do not change inventory or gold', () => {
  const state = createState();
  const beforeInvalidSale = snapshot(state);
  assert.equal(sellItem(state, 'turnip', 1).ok, false);
  assert.equal(snapshot(state), beforeInvalidSale);
  assert.equal(buyItem(state, 'melon_seed', 99).ok, false);
  assert.equal(snapshot(state), beforeInvalidSale);

  state.inventory.turnip = 8;
  const sale = sellItem(state, 'turnip', 8);
  assert.equal(sale.ok, true);
  assert.equal(state.gold, 500);
  assert.equal(state.shipping.turnip, 8);
  const result = sleep(state);
  assert.equal(state.minute, 360);
  assert.equal(result.settlement.gold, 440);
  assert.equal(state.gold, 940);
  assert.deepEqual(state.shipping, {});
  assert.equal(sleep(state).settlement.gold, 0);
  assert.equal(state.gold, 940);
});

test('mining and chopping have daily cooldowns and grant their drops exactly once', () => {
  const state = createState();
  state.tool = 'axe';
  faceCell(state, 4, 11);
  assert.equal(useTool(state).ok, true);
  assert.equal(state.inventory.wood, 5);
  assert.equal(isWalkable(state, 4, 11), true);
  const afterChop = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), afterChop);

  state.tool = 'pickaxe';
  faceCell(state, 28, 6, 'up');
  assert.equal(useTool(state).ok, true);
  assert.equal(state.inventory.copper_ore, undefined);
  assert.equal(state.resourceState['mine-copper-1'].hits, 1);
  assert.equal(useTool(state).ok, true);
  assert.equal(state.inventory.copper_ore, 1);
  assert.equal(state.stats.mined, 1);
  const afterMine = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), afterMine);

  state.inventoryCapacity = Object.keys(state.inventory).length;
  const beforeFullMine = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), beforeFullMine);
  sleep(state);
  assert.equal(isWalkable(state, 4, 11), false);
});

test('fishing has a timed bite window, can be cancelled freely, and awards deterministic catches', () => {
  const state = createState();
  state.tool = 'rod';
  faceCell(state, 5, 24, 'right');
  const cast = useTool(state);
  assert.equal(cast.ok, true);
  assert.equal(state.stamina, 98);
  const restoredCast = validateState(JSON.parse(snapshot(state)));
  assert.deepEqual(restoredCast.fishing, state.fishing);
  assert.equal(movePlayer(state, 1, 0, 0.1).ok, false);
  assert.equal(selectTool(state, 'pickaxe').ok, false);
  const beforeEarlyHook = snapshot(state);
  assert.equal(finishFishing(state).ok, false);
  assert.equal(snapshot(state), beforeEarlyHook);
  tick(state, state.fishing.biteAt);
  assert.equal(state.fishing.phase, 'bite');
  const hooked = finishFishing(state);
  assert.equal(hooked.ok, true);
  assert.equal(itemInfo(hooked.item).type, 'ikan');
  assert.equal(state.stats.fished, 1);
  assert.equal(state.fishing, null);

  assert.equal(useTool(state).ok, true);
  assert.equal(cancelFishing(state).ok, true);
  assert.equal(state.fishing, null);
  assert.equal(cancelFishing(state).ok, false);

  assert.equal(useTool(state).ok, true);
  tick(state, state.fishing.biteAt + state.fishing.biteWindow + 0.1);
  assert.equal(state.fishing, null);
  assert.equal(finishFishing(state).ok, false);
});

test('battles award loot once, preserve belongings on defeat, and reject full-bag finishers atomically', () => {
  const state = createState();
  state.tool = 'sword';
  state.player.x = 7.5;
  state.player.y = 33.5;
  assert.equal(useTool(state).ok, true);
  const startingGold = state.gold;
  let result;
  for (let attempt = 0; attempt < 10 && state.battle; attempt += 1) result = battleAction(state, 'attack');
  assert.equal(result.ok, true);
  assert.equal(state.battle, null);
  assert.equal(state.gold, startingGold + MONSTER_TYPES.slime.reward.gold);
  assert.equal(state.inventory.slime_gel, 1);
  assert.equal(state.stats.defeated, 1);
  assert.equal(state.monsters.find((monster) => monster.id === 'monster-slime-1').defeated, true);
  const afterReward = snapshot(state);
  assert.equal(battleAction(state, 'attack').ok, false);
  assert.equal(snapshot(state), afterReward);

  const full = createState();
  full.inventoryCapacity = 4;
  full.tool = 'sword';
  full.player.x = 7.5;
  full.player.y = 33.5;
  assert.equal(useTool(full).ok, true);
  assert.equal(battleAction(full, 'attack').ok, true);
  assert.equal(battleAction(full, 'attack').ok, true);
  const beforeFinisher = snapshot(full);
  assert.equal(battleAction(full, 'attack').ok, false);
  assert.equal(snapshot(full), beforeFinisher);

  const loss = createState();
  loss.tool = 'sword';
  loss.player.x = 44.5;
  loss.player.y = 7.5;
  loss.player.hp = 1;
  const money = loss.gold;
  const belongings = snapshot(loss.inventory);
  assert.equal(useTool(loss).ok, true);
  const fled = battleAction(loss, 'guard');
  assert.equal(fled.ok, true);
  assert.equal(fled.lost, true);
  assert.equal(loss.battle, null);
  assert.equal(loss.gold, money);
  assert.equal(snapshot(loss.inventory), belongings);
  assert.equal(loss.player.x, 16.5);
  assert.equal(loss.player.y, 18.5);
});

test('each of the four monster types can be defeated for its defined reward', () => {
  for (const type of Object.values(MONSTER_TYPES)) {
    const state = createState();
    const monster = state.monsters.find(entry => entry.type === type.id);
    faceCell(state, Math.floor(monster.x), Math.floor(monster.y), 'right');
    state.tool = 'sword';
    assert.equal(useTool(state).ok, true, type.id);
    const gold = state.gold;
    for (let turn = 0; turn < 10 && state.battle; turn += 1) {
      assert.equal(battleAction(state, 'attack').ok, true);
    }
    assert.equal(state.battle, null);
    assert.equal(monster.defeated, true, type.id);
    assert.equal(state.gold - gold, type.reward.gold);
    assert.equal(state.inventory[type.reward.item], type.reward.quantity);
    assert.equal(state.stats.defeated, 1);
  }
});

test('NPC interactions, animal care, and gifts enforce daily limits and resource invariants', () => {
  const state = createState();
  assert.equal(talkTo(state, 'dlira').ok, true);
  const afterTalk = snapshot(state);
  assert.equal(talkTo(state, 'dlira').ok, false);
  assert.equal(snapshot(state), afterTalk);
  assert.equal(giveGift(state, 'dlira', 'bread').ok, true);
  const bread = state.inventory.bread;
  const afterGift = snapshot(state);
  assert.equal(giveGift(state, 'dlira', 'bread').ok, false);
  assert.equal(snapshot(state), afterGift);
  assert.ok(state.friendship.dlira >= 33);

  const beforeFeed = state.inventory.feed;
  assert.equal(feedAnimals(state).ok, true);
  assert.equal(state.inventory.feed, beforeFeed - 1);
  const fed = snapshot(state);
  assert.equal(feedAnimals(state).ok, false);
  assert.equal(snapshot(state), fed);
  sleep(state);
  assert.equal(state.talked.dlira, undefined);
  assert.equal(state.gifted.dlira, undefined);
  assert.equal(state.animals[0].product, true);

  faceCell(state, 28, 17, 'right');
  const prompt = getPrompt(state);
  assert.match(prompt, /Collect Piko's produce/);
  const product = interact(state);
  assert.equal(product.ok, true);
  assert.equal(product.item, 'egg');
  assert.equal(state.inventory.egg, 1);
});

test('quests are persistent, claimable once, and do not partially reward a full inventory', () => {
  const state = createState();
  state.stats.fished = 2;
  assert.equal(getQuests(state).find((quest) => quest.id === 'river_friend').complete, true);
  const beforeFull = snapshot(state);
  state.inventoryCapacity = Object.keys(state.inventory).length;
  const blocked = snapshot(state);
  assert.equal(claimQuest(state, 'river_friend').ok, false);
  assert.equal(snapshot(state), blocked);

  state.inventoryCapacity = 24;
  const claimed = claimQuest(state, 'river_friend');
  assert.equal(claimed.ok, true);
  assert.equal(state.gold, 620);
  assert.equal(state.inventory.herbal_tea, 2);
  const afterClaim = snapshot(state);
  assert.equal(claimQuest(state, 'river_friend').ok, false);
  assert.equal(snapshot(state), afterClaim);
  assert.notEqual(beforeFull, afterClaim);
});

test('corrupt saves are sanitized into fresh serializable state or rejected', () => {
  const raw = createState();
  raw.day = 99;
  raw.minute = 99_999;
  raw.gold = -50;
  raw.player = { x: 9.5, y: 11.5, facing: 'warp', hp: 900 };
  raw.tool = 'teleporter';
  raw.inventory = { bread: 1_000, feed: -3, unknown_secret: 20 };
  raw.farm = {
    '99,99': { tilled: true, watered: true, crop: { id: 'turnip', remaining: 0, ready: true } },
    '16,22': { tilled: true, watered: 'yes', crop: { id: 'not-a-crop', remaining: -9, ready: true } },
  };
  raw.talked = { dlira: 'yes', stranger: true };
  raw.shipping = { turnip: 500, sword: 8 };
  raw.battle = { monsterId: 'not-a-monster' };
  raw.options = { relaxed: 'yes' };
  raw.extraInjectedValue = { shouldNotSurvive: true };
  const clean = validateState(raw);
  assert.equal(clean.day, 28);
  assert.equal(clean.minute, 1559);
  assert.equal(clean.gold, 0);
  assert.deepEqual(clean.player, { x: 16.5, y: 18.5, facing: 'down', hp: 100 });
  assert.equal(clean.tool, 'hoe');
  assert.deepEqual(clean.inventory, { bread: 99 });
  assert.equal(clean.farm['99,99'], undefined);
  assert.deepEqual(clean.farm['16,22'], { tilled: true, watered: false, crop: null });
  assert.deepEqual(clean.talked, {});
  assert.deepEqual(clean.shipping, { turnip: 99 });
  assert.equal(clean.battle, null);
  assert.deepEqual(clean.options, { relaxed: false });
  assert.equal('extraInjectedValue' in clean, false);
  assert.doesNotThrow(() => JSON.stringify(clean));
  assert.throws(() => validateState(null), /Invalid save data/);
  assert.throws(() => validateState([]), /Invalid save data/);
  assert.throws(() => validateState({ version: 999 }), /Invalid save data/);
});

test('English display text preserves version-one save IDs and existing progress', () => {
  const previous = JSON.parse(readFileSync(new URL('./fixtures/version-1-save.json', import.meta.url), 'utf8'));
  const loaded = validateState(JSON.parse(JSON.stringify(previous)));
  assert.deepEqual(loaded, previous);
  assert.deepEqual(SEASONS, ['Spring', 'Summer', 'Autumn', 'Winter']);
  assert.equal(calendar(loaded).season, 'Autumn');
  assert.equal(itemInfo('carrot_seed').name, 'Carrot Seeds');
  assert.equal(itemInfo('can').name, 'Watering Can');
  assert.equal(itemInfo('bread').name, 'Bread');
  assert.equal(getQuests(loaded).find(quest => quest.id === 'small_garden').title, 'A Small Garden');
});

test('incomplete tool lists retain every basic tool that cannot be bought again', () => {
  for (const toolsOwned of [[], ['rod'], ['unknown'], null]) {
    const raw = createState();
    raw.toolsOwned = toolsOwned;
    const clean = validateState(raw);
    for (const tool of TOOLS.filter(({ cost }) => cost === 0)) {
      assert.equal(selectTool(clean, tool.id).ok, true, tool.id);
    }
    for (const tool of TOOLS.filter(({ cost }) => cost > 0)) {
      assert.equal(clean.toolsOwned.includes(tool.id), !Array.isArray(toolsOwned) || toolsOwned.includes(tool.id));
    }
    assert.equal(clean.toolsOwned.includes('unknown'), false);
  }
});

test('an empty or unusable animal list recovers a feedable starter chicken', () => {
  for (const animals of [[], [{ id: 'invalid', type: 'dragon', x: 0, y: 0 }], null]) {
    const raw = createState();
    raw.animals = animals;
    const clean = validateState(raw);
    assert.equal(clean.animals.length, 1);
    assert.equal(clean.animals[0].type, 'chicken');
    assert.equal(feedAnimals(clean).ok, true);
    sleep(clean);
    assert.equal(clean.animals[0].product, true);
  }
});

test('valid saves preserve an active adjacent battle and discard stale battle references', () => {
  const state = createState();
  state.tool = 'sword';
  state.player.x = 7.5;
  state.player.y = 33.5;
  assert.equal(useTool(state).ok, true);

  const restored = validateState(JSON.parse(snapshot(state)));
  assert.deepEqual(restored.battle, state.battle);
  assert.deepEqual(restored.player, state.player);

  const stale = JSON.parse(snapshot(state));
  stale.battle.monsterId = 'missing-monster';
  assert.equal(validateState(stale).battle, null);

  const distant = JSON.parse(snapshot(state));
  distant.player.x = 16.5;
  distant.player.y = 18.5;
  assert.equal(validateState(distant).battle, null);
});

test('sanitized saves keep fallback inventory within capacity and avoid blocked spawn tiles', () => {
  const raw = createState();
  raw.inventoryCapacity = 1;
  raw.inventory = null;
  raw.player = { x: 9.5, y: 11.5, facing: 'left', hp: 80 };
  raw.animals = [{
    id: 'chicken-1', type: 'chicken', name: 'Piko', x: 16.5, y: 18.5,
    fed: false, petted: false, product: false,
  }];

  const clean = validateState(raw);
  assert.equal(Object.keys(clean.inventory).length, 1);
  assert.ok(Object.keys(clean.inventory).length <= clean.inventoryCapacity);
  assert.equal(isWalkable(clean, clean.player.x, clean.player.y), true);
  assert.notDeepEqual([clean.player.x, clean.player.y], [16.5, 18.5]);
});

test('sanitized saves cannot restore fishing and battle at the same time', () => {
  const raw = createState();
  raw.tool = 'rod';
  raw.player.x = 4.5;
  raw.player.y = 24.5;
  raw.monsters[0].x = 3.5;
  raw.monsters[0].y = 24.5;
  raw.fishing = { phase: 'waiting', elapsed: 0, biteAt: 5, x: 5, y: 24 };
  raw.battle = { monsterId: 'monster-slime-1', guarding: false };

  const clean = validateState(raw);
  assert.equal(clean.battle?.monsterId, 'monster-slime-1');
  assert.equal(clean.fishing, null);
});

test('monster saves reject inherited types and keep malformed-health monsters targetable', () => {
  const raw = createState();
  raw.tool = 'sword';
  raw.player = { x: 7.5, y: 33.5, facing: 'right', hp: 100 };
  raw.monsters = [
    { id: 'inherited-type', type: 'constructor', x: 8.5, y: 33.5, hp: NaN, defeated: false },
    { id: 'nan-health', type: 'slime', x: 8.5, y: 33.5, hp: NaN, defeated: false },
  ];

  const clean = validateState(raw);
  assert.deepEqual(clean.monsters.map(({ id }) => id), ['nan-health']);
  assert.equal(clean.monsters[0].hp, MONSTER_TYPES.slime.hp);
  assert.equal(Number.isFinite(clean.monsters[0].hp), true);
  assert.equal(isWalkable(clean, clean.player.x, clean.player.y), true);
  assert.equal(useTool(clean).ok, true);
  assert.equal(clean.battle?.monsterId, 'nan-health');
});

test('crop save IDs and seed selection reject inherited catalog properties', () => {
  const raw = createState();
  raw.selectedSeed = 'constructor';
  raw.farm = {
    '16,22': { tilled: true, watered: true, crop: { id: 'constructor', remaining: 0, ready: true } },
  };

  const clean = validateState(raw);
  assert.equal(clean.selectedSeed, 'turnip');
  assert.deepEqual(clean.farm['16,22'], { tilled: true, watered: true, crop: null });

  const state = createState();
  state.player.x = 16.5;
  state.player.y = 19.5;
  state.player.facing = 'down';
  state.farm['16,20'] = { tilled: true, watered: false, crop: null };
  const beforeSelection = snapshot(state);
  assert.equal(selectSeed(state, 'constructor').ok, false);
  assert.equal(snapshot(state), beforeSelection);

  state.tool = 'seeds';
  state.selectedSeed = 'constructor';
  const beforePlanting = snapshot(state);
  assert.equal(useTool(state).ok, false);
  assert.equal(snapshot(state), beforePlanting);
});

test('all regions, building doors, world objects, and scheduled villagers are reachable', () => {
  const state = createState();
  const reached = walkableReachability(state);
  const nearReachable = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (
    reached.has(`${x + dx},${y + dy}`)
  ));
  const reachedRegions = new Set([...reached].map((key) => {
    const [x, y] = key.split(',').map(Number);
    return regionAt(x, y)?.id;
  }));

  assert.deepEqual([...reachedRegions].filter(Boolean).sort(), ['coast', 'farm', 'forest', 'mine', 'village']);
  for (const object of WORLD.objects) assert.equal(nearReachable(object.x, object.y), true, object.id);
  for (const building of WORLD.buildings) assert.equal(nearReachable(...building.door), true, building.id);
  assert.equal(tileAt(-1, 0), 'wall');
  assert.equal(tileAt(10, 20), 'soil');
  assert.equal(tileAt(35, 18), 'bridge');
  assert.equal(tileAt(35, 42), 'bridge');

  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    state.day = weekday + 1;
    state.season = 0;
    state.minute = 420;
    for (const weather of ['sunny', 'rainy', 'snowy']) {
      state.weather = weather;
      for (const minute of [420, 600, 780, 900, 1140, 1380]) {
        state.minute = minute;
        for (const villager of VILLAGERS) {
          const position = getNpcPosition(state, villager.id);
          assert.ok(position, villager.id);
          assert.equal(isWalkable(state, position.x, position.y), true, `${villager.name} at ${position.destination}`);
        }
      }
    }
  }
});

test('tool cycling wraps in the fixed toolbar order and prompts reflect nearby actions', () => {
  const state = createState();
  assert.equal(selectTool(state, 'sword').ok, true);
  assert.equal(cycleTool(state, 1).tool, 'hoe');
  assert.equal(cycleTool(state, -1).tool, 'sword');
  state.player.x = 11.5;
  state.player.y = 20.5;
  state.player.facing = 'down';
  assert.match(getPrompt(state), /Harvest turnip/);

  state.player.x = 16.5;
  state.player.y = 19.5;
  state.player.facing = 'down';
  state.tool = 'hoe';
  assert.equal(getPrompt(state), 'Hoe this plot');
  state.farm['16,20'] = { tilled: true, watered: false, crop: null };
  state.tool = 'seeds';
  assert.match(getPrompt(state), /Plant turnip/);

  state.player.x = 15.5;
  state.player.y = 20.5;
  state.player.facing = 'down';
  state.farm['15,21'].watered = false;
  state.tool = 'can';
  assert.equal(getPrompt(state), 'Water crop');

  state.player.x = 7.5;
  state.player.y = 33.5;
  state.player.facing = 'right';
  state.tool = 'sword';
  assert.equal(getPrompt(state), 'Fight Meadow Slime');
  assert.equal(interact(state).ok, true);
  assert.equal(state.battle?.monsterId, 'monster-slime-1');
  state.battle = null;

  state.player.x = 4.5;
  state.player.y = 24.5;
  state.player.facing = 'right';
  state.tool = 'rod';
  assert.equal(getPrompt(state), 'Fish here');
  state.water = 0;
  const refill = interact(state);
  assert.equal(refill.ok, true);
  assert.equal(refill.kind, 'well');
  assert.equal(state.water, state.maxWater);
});
