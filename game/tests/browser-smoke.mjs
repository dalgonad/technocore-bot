import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createState, useTool as castOrAttack } from '../src/core.js';

const base = process.env.GAME_URL || 'http://127.0.0.1:3000/';
const session = `meadow-smoke-${process.pid}`;
const key = 'dlicom.meadow.v1';
const temporary = mkdtempSync(join(tmpdir(), 'meadow-browser-'));
let passed = 0;

function browser(...args) {
  const output = execFileSync('agent-browser', ['--session', session, '--json', ...args], {
    encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 45_000,
  });
  const result = JSON.parse(output);
  assert.equal(result.success, true, result.error || output);
  return result.data;
}

const evaluate = (source) => browser('eval', source).result;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const saved = () => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))`);
const click = (selector) => browser('click', selector);
const press = (keyName) => browser('press', keyName);
const point = (x, y) => browser('mouse', 'move', String(Math.round(x)), String(Math.round(y)));
const clickPoint = (x, y) => { point(x, y); browser('mouse', 'down'); browser('mouse', 'up'); };

async function until(predicate, timeout = 10_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (evaluate(predicate)) return;
    await wait(100);
  }
  assert.fail(`Browser condition timed out: ${predicate}`);
}

async function fixture(source = '', fromCurrent = false) {
  // Seed storage outside the game so its pagehide autosave cannot overwrite the fixture.
  browser('open', new URL('tests/fixture.html', base).href);
  evaluate(`(async () => {
    const core = await import('../src/core.js');
    const world = await import('../src/world.js');
    const data = await import('../src/data.js');
    const state = ${fromCurrent ? `JSON.parse(localStorage.getItem('${key}'))` : 'core.createState()'};
    ${source}
    localStorage.setItem('${key}', JSON.stringify(state));
    return true;
  })()`);
  browser('open', base);
  await until('document.querySelector("#loading-overlay")?.hidden === true');
}

async function useTool(tool) {
  click(`[data-tool="${tool}"]`);
  await wait(250);
  press('Space');
  await wait(250);
}

function pass(name) {
  const text = evaluate(`document.body.innerText + ' ' + [...document.querySelectorAll('[aria-label],[title]')].map(element => (element.getAttribute('aria-label') || '') + ' ' + (element.getAttribute('title') || '')).join(' ')`);
  assert.doesNotMatch(text, /\b(?:simpan|simpanan|pengaturan|ransel|benih|panen|cangkul|tanaman|warga|kebun|musim|bermain|permainan|pancing|tambang|hadiah|pilih|batal|spasi|roti|siram|gigitan|tersimpan|diambil|berinteraksi)\b/i, `Untranslated UI in ${name}`);
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}

try {
  browser('open', base);
  browser('set', 'viewport', '1440', '1080');
  await until('document.querySelector("#loading-overlay")?.hidden === true');
  assert.equal(evaluate('document.documentElement.lang'), 'en');
  assert.equal(evaluate('document.querySelector("h1").textContent'), 'A new day in Meadow Valley.');
  assert.equal(evaluate('document.querySelector("#world").getAttribute("aria-label")'), 'Meadow Valley world. WASD to move, E to interact, Space to use a tool.');
  assert.equal(evaluate('document.querySelector("#day-label").textContent'), 'MONDAY, SPRING 1');
  assert.deepEqual(evaluate('[...document.querySelectorAll(".tool-slot")].map(button => button.getAttribute("aria-label"))'), ['Hoe (1)', 'Watering Can (2)', 'Seeds (3)', 'Axe (4)', 'Pickaxe (5)', 'Fishing Rod (6)', 'Sword (7)']);
  assert.equal(evaluate('document.querySelectorAll(".tool-slot").length'), 7);
  assert.equal(evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  pass('initial desktop load: seven tools, no horizontal overflow');

  await fixture('state.player = {x:10.5,y:19.5,facing:"down",hp:100};');
  assert.equal(evaluate('document.querySelector("#interaction-prompt kbd").textContent'), 'SPACE');
  assert.equal(evaluate('document.querySelector("#interaction-prompt span").textContent'), 'Hoe this plot');
  await useTool('hoe');
  assert.equal(saved().farm['10,20'].tilled, true);
  assert.equal(saved().stamina, 97);
  await useTool('seeds');
  assert.equal(saved().farm['10,20'].crop.id, 'turnip');
  assert.equal(saved().inventory.turnip_seed, 7);
  await useTool('can');
  assert.equal(saved().farm['10,20'].watered, true);
  assert.equal(saved().water, 29);
  const energy = saved().stamina;
  press('Space'); await wait(300);
  assert.equal(saved().water, 29);
  assert.equal(saved().stamina, energy);
  pass('hoe → seed → water with real keyboard; repeat watering spends nothing');

  press('q'); await wait(250);
  assert.equal(saved().tool, 'hoe');
  press('r'); await wait(250);
  assert.equal(saved().tool, 'can');
  click('[data-panel="bag"]');
  const time = evaluate('document.querySelector("#clock").textContent');
  await wait(1200);
  assert.equal(evaluate('document.querySelector("#clock").textContent'), time);
  click('[data-seed="potato"]');
  assert.equal(saved().selectedSeed, 'potato');
  assert.equal(saved().tool, 'seeds');
  press('Escape');
  pass('tool cycling, bag seed selection, and modal clock pause');

  evaluate('document.querySelector("[data-panel=bag]").focus()');
  press('Space');
  assert.equal(evaluate('document.querySelector("dialog").open'), true);
  assert.equal(evaluate('document.querySelector("#panel-title").textContent'), 'Small things, endless possibilities.');
  press('Escape');
  pass('Space activates a focused UI button rather than swinging a tool');

  const timing = evaluate(`(async () => {
    const nativeFrame = window.requestAnimationFrame;
    const readTime = () => {
      document.querySelector('#save-button').click();
      const state = JSON.parse(localStorage.getItem('${key}'));
      return state.minute + state.timeRemainder;
    };
    try {
      return await new Promise((resolve, reject) => {
        let first = null;
        let done = false;
        const timeout = setTimeout(() => { done = true; reject(new Error('Throttled animation frames stopped')); }, 15_000);
        window.requestAnimationFrame = callback => nativeFrame(() => setTimeout(() => {
          const now = performance.now();
          callback(now);
          if (done) return;
          if (!first) first = { now, minute: readTime() };
          else if (now - first.now >= 4000) {
            done = true;
            clearTimeout(timeout);
            resolve({ actual: (now - first.now) / 1000, simulated: readTime() - first.minute });
          }
        }, 250));
      });
    } finally { window.requestAnimationFrame = nativeFrame; }
  })()`);
  assert.ok(Math.abs(timing.actual - timing.simulated) < .05, JSON.stringify(timing));
  pass('active time stays accurate with animation frames throttled to four FPS');

  await fixture('state.player = {x:16.5,y:18.5,facing:"right",hp:100};');
  browser('keydown', 'd'); await wait(400); browser('keyup', 'd');
  click('#save-button');
  assert.ok(saved().player.x > 17, JSON.stringify(saved().player));
  assert.equal(saved().player.y, 18.5);
  const movedX = saved().player.x;
  evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"d",code:"Unidentified",bubbles:true}));true');
  await wait(300);
  evaluate('document.dispatchEvent(new KeyboardEvent("keyup",{key:"d",code:"Unidentified",bubbles:true}));true');
  click('#save-button');
  assert.ok(saved().player.x > movedX, 'Unidentified virtual-key codes must fall back to event.key');
  await fixture('state.player = {x:12.5,y:16.5,facing:"up",hp:100};');
  browser('keydown', 'w'); await wait(900); browser('keyup', 'w');
  click('#save-button');
  assert.ok(saved().player.y >= 15 && saved().player.y < 16.5);
  pass('WASD movement and farmhouse collision');

  await fixture('state.player = {x:56.5,y:16.5,facing:"up",hp:100};');
  press('e');
  await until('document.querySelector("[data-buy=turnip_seed]") !== null');
  click('[data-buy="turnip_seed"][data-quantity="5"]');
  assert.equal(saved().gold, 400);
  assert.equal(saved().inventory.turnip_seed, 13);
  press('Escape');
  pass('physical co-op interaction and seed purchase');

  await fixture('state.player={x:10.5,y:19.5,facing:"down",hp:100};state.farm["10,20"]={tilled:true,watered:true,crop:{id:"turnip",remaining:0,ready:true,withered:false}};');
  assert.equal(evaluate('document.querySelector("#interaction-prompt kbd").textContent'), 'E');
  assert.equal(evaluate('document.querySelector("#interaction-prompt span").textContent'), 'Harvest turnip');
  press('e'); await wait(300);
  assert.equal(saved().inventory.turnip, 1);
  assert.equal(saved().farm['10,20'].crop, null);
  pass('contextual harvest commits one item and clears one plant');

  await fixture('state.player={x:18.5,y:17.5,facing:"up",hp:100};state.inventory.turnip=3;state.farm["10,20"]={tilled:true,watered:true,crop:{id:"turnip",remaining:4,ready:false,withered:false}};state.animals[0].fed=true;localStorage.setItem("dlicom","legacy-save-preserved");');
  press('e');
  await until('document.querySelector("[data-ship=turnip]") !== null');
  click('[data-ship="turnip"][data-quantity="3"]');
  assert.equal(saved().shipping.turnip, 3);
  assert.equal(saved().gold, 500);
  await fixture('state.player={x:12.5,y:16.5,facing:"up",hp:100};', true);
  press('e'); await until('document.querySelector("[data-sleep]") !== null');
  click('[data-sleep]');
  assert.equal(saved().day, 2);
  assert.equal(saved().minute, 360);
  assert.equal(saved().gold, 665);
  assert.equal(saved().farm['10,20'].crop.remaining, 3);
  assert.equal(saved().animals[0].product, true);
  assert.deepEqual(saved().shipping, {});
  browser('open', base);
  await until('document.querySelector("#loading-overlay")?.hidden === true');
  assert.equal(saved().gold, 665);
  assert.equal(evaluate('localStorage.getItem("dlicom")'), 'legacy-save-preserved');
  pass('shipping → sleep → growth → livestock → reload; settlement not duplicated and legacy save intact');

  await fixture('state.player={x:8.5,y:32.5,facing:"down",hp:100};state.tool="sword";');
  press('Space');
  await until('document.querySelector("[data-battle=attack]") !== null');
  for (let turn = 0; turn < 6 && saved().battle; turn += 1) {
    click('[data-battle="attack"]'); await wait(150);
  }
  assert.equal(saved().monsters.find(monster => monster.type === 'slime').defeated, true);
  assert.equal(saved().stats.defeated, 1);
  assert.equal(saved().gold, 522);
  assert.equal(saved().inventory.slime_gel, 1);
  press('Space'); await wait(250);
  assert.equal(saved().gold, 522);
  pass('monster battle victory grants loot once; defeated monster cannot be farmed');

  await fixture('state.player={x:8.5,y:32.5,facing:"down",hp:100};state.tool="sword";');
  press('Space'); await until('document.querySelector("[data-battle=flee]") !== null');
  click('[data-battle="flee"]');
  assert.equal(saved().battle, null);
  assert.equal(saved().gold, 500);
  assert.equal(saved().player.hp, 100);
  pass('optional battle can be exited without a penalty');

  await fixture('state.player={x:6.5,y:23.5,facing:"down",hp:100};state.tool="rod";');
  press('Space');
  await until('document.querySelector("#reel-button") && !document.querySelector("#reel-button").disabled', 12_000);
  press('Space');
  await wait(250);
  assert.equal(saved().stats.fished, 1);
  assert.equal(saved().fishing, null);
  pass('cast, visible bite cue, and timed catch through the fishing UI');

  await fixture('state.player={x:28.5,y:7.5,facing:"up",hp:100};state.tool="pickaxe";');
  for (let hit = 0; hit < 5 && !saved().stats.mined; hit += 1) { press('Space'); await wait(260); }
  assert.ok(saved().stats.mined > 0);
  const mined = saved().stats.mined;
  press('Space'); await wait(260);
  assert.equal(saved().stats.mined, mined);
  pass('mine resource collection and exhausted-node protection');

  await fixture('state.minute=600;const pos=world.getNpcPosition(state,"dlira");state.player={x:pos.x,y:pos.y+1,facing:"up",hp:100};');
  press('e');
  await until('document.querySelector("[data-talk=dlira]") !== null');
  click('[data-talk="dlira"]');
  assert.equal(saved().talked.dlira, true);
  const points = saved().friendship.dlira;
  click('[data-gift="dlira"]');
  assert.equal(saved().gifted.dlira, true);
  assert.ok(saved().friendship.dlira > points);
  assert.equal(evaluate('document.querySelector("[data-talk=dlira]").disabled'), true);
  pass('NPC conversation, favorite gift, and daily interaction limits');

  await fixture('state.stats.planted=3;');
  click('[data-panel="quests"]');
  click('#panel-body [data-claim="small_garden"]');
  assert.equal(saved().gold, 600);
  assert.equal(saved().quests.small_garden.claimed, true);
  assert.equal(evaluate('document.querySelector("#panel-body [data-claim=small_garden]").disabled'), true);
  press('Escape');
  pass('journal quest claims a reward exactly once');

  click('[data-panel="map"]');
  assert.equal(evaluate('document.querySelectorAll(".region-item").length'), 5);
  assert.deepEqual(evaluate('[...document.querySelectorAll(".region-item h3")].map(element => element.textContent)'), ['Northern Mine', 'Meadow Farm', 'Meadow Village', 'Shaded Woods', 'Sunlit Coast']);
  assert.equal(evaluate('document.querySelector("#large-map").width'), 720);
  press('Escape');
  click('[data-panel="people"]');
  assert.equal(evaluate('document.querySelectorAll(".person-card").length'), 5);
  press('Escape');
  click('[data-panel="settings"]');
  browser('select', '#day-speed', 'relaxed');
  assert.equal(saved().options.relaxed, true);
  assert.equal(evaluate('document.querySelector("#day-speed").getAttribute("aria-label")'), 'Day speed');
  pass('English settings, save controls, and relaxed mode');
  press('Escape');
  click('[data-panel="help"]');
  assert.equal(evaluate('document.querySelector("#panel-eyebrow").textContent'), 'HOW TO PLAY');
  assert.equal(evaluate('document.querySelector(".controls-grid").textContent.includes("SPACE")'), true);
  pass('English guide, keyboard hints, and touch instructions');
  press('Escape');
  pass('world map, five villagers, and persisted relaxed mode');

  await fixture('state.day=28;state.season=0;state.player={x:12.5,y:16.5,facing:"up",hp:100};');
  press('e'); await until('document.querySelector("[data-sleep]") !== null'); click('[data-sleep]');
  assert.equal(saved().day, 1);
  assert.equal(saved().season, 1);
  assert.equal(saved().farm['11,21'].crop.withered, true);
  pass('season rollover withers incompatible crops and updates calendar');

  await fixture();
  browser('set', 'device', 'Pixel 7');
  browser('set', 'viewport', '390', '844');
  assert.equal(evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(evaluate('getComputedStyle(document.querySelector(".mobile-controls")).display !== "none"'), true);
  click('[data-tool="seeds"]');
  assert.equal(saved().tool, 'seeds');
  const position = evaluate('(() => {const r=document.querySelector("[data-move=right]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  point(position.x, position.y);
  browser('mouse', 'down'); await wait(350); browser('mouse', 'up');
  click('#save-button');
  assert.ok(saved().player.x > 16.5, 'Holding the D-pad must move the player');
  const beforeTap = saved().player.x;
  evaluate('document.querySelector("[data-move=right]").addEventListener("pointerdown", event => { window.touchEvidence = { type: event.pointerType, trusted: event.isTrusted }; }, {once:true});true');
  browser('tap', '[data-move="right"]');
  assert.deepEqual(evaluate('window.touchEvidence'), { type: 'touch', trusted: true });
  assert.ok(saved().player.x > beforeTap, 'A brief touch must also move, even between animation frames');
  const beforeKeyboard = saved().player.x;
  browser('focus', '[data-move="right"]');
  press('Enter');
  assert.ok(saved().player.x > beforeKeyboard, 'Keyboard activation of an on-screen direction button must move');
  click('[data-panel="map"]');
  assert.equal(evaluate('document.querySelector("#panel-dialog").getBoundingClientRect().width <= innerWidth'), true);
  press('Escape');
  pass('390px mobile layout, trusted touch tap, held D-pad, keyboard button, and map dialog');

  await fixture('state.player={x:16.5,y:22.5,facing:"up",hp:100};state.farm={};');
  let bounds = evaluate('document.querySelector("#world").getBoundingClientRect().toJSON()');
  clickPoint(bounds.left + bounds.width / 2 + 20, bounds.top + bounds.height / 2 + 25);
  assert.equal(saved().player.facing, 'down');
  assert.equal(saved().farm['16,23'].tilled, true);
  assert.equal(saved().farm['17,22'], undefined);
  click('[data-tool="can"]');
  click('#fullscreen-button');
  await until('document.fullscreenElement?.id === "stage"');
  assert.equal(evaluate('getComputedStyle(document.querySelector("#world")).objectFit'), 'contain');
  bounds = evaluate('document.querySelector("#world").getBoundingClientRect().toJSON()');
  clickPoint(bounds.left + bounds.width / 2, bounds.top + 5);
  evaluate('document.querySelector("#save-button").click();true');
  assert.equal(saved().player.facing, 'down', 'Fullscreen letterboxing must not redirect the tool');
  assert.equal(saved().water, 30);
  clickPoint(bounds.left + bounds.width / 2 + 20, bounds.top + bounds.height / 2 + 25);
  assert.equal(saved().farm['16,23'].watered, true);
  assert.equal(saved().water, 29);
  click('#fullscreen-button');
  await until('document.fullscreenElement === null');
  pass('cropped mobile canvas and fullscreen target the correct adjacent tile; letterboxing is inert');

  await fixture();
  click('[data-panel="settings"]');
  const invalidFile = join(temporary, 'invalid.json');
  writeFileSync(invalidFile, '{broken-json');
  browser('upload', '#save-file', invalidFile);
  await until('document.querySelector("#toast-stack").textContent.includes("not a valid Meadow Days save")');
  assert.equal(saved().gold, 500);
  assert.equal(evaluate('document.querySelector("[data-confirm-import]") === null'), true);
  const imported = createState();
  imported.gold = 987;
  imported.player = { x: 8.5, y: 32.5, facing: 'down', hp: 100 };
  imported.tool = 'sword';
  assert.equal(castOrAttack(imported).ok, true);
  const validFile = join(temporary, 'battle.json');
  writeFileSync(validFile, JSON.stringify(imported));
  browser('upload', '#save-file', validFile);
  await until('document.querySelector("[data-confirm-import]") !== null');
  assert.equal(saved().gold, 500, 'Import must not replace progress before confirmation');
  click('[data-confirm-import]');
  assert.equal(saved().gold, 987);
  assert.equal(saved().battle.monsterId, imported.battle.monsterId);
  assert.equal(evaluate('document.querySelector("[data-battle=attack]") !== null'), true);
  click('[data-battle="flee"]');
  click('[data-panel="settings"]');
  const exportPath = join(temporary, 'export.json');
  browser('download', '[data-export]', exportPath);
  const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
  assert.equal(exported.gold, 987);
  assert.equal(exported.version, 1);
  assert.equal(exported.battle, null);
  pass('invalid-file rejection, confirmed import preserves an active battle, and JSON export round-trips');

  await fixture();
  const gameTab = browser('tab', 'list').tabs.find(tab => tab.active).tabId;
  browser('tab', 'new', '--label', 'other-tab', new URL('tests/fixture.html', base).href);
  const paused = saved();
  await wait(2500);
  browser('tab', gameTab);
  await until('document.querySelector("#resume-overlay").hidden === false');
  click('#save-button');
  assert.equal(saved().minute, paused.minute);
  assert.equal(saved().timeRemainder, paused.timeRemainder);
  click('#resume-overlay');
  assert.equal(evaluate('document.querySelector("#resume-overlay").hidden'), true);
  pass('switching browser tabs pauses time without accumulating background time');

  browser('tab', 'other-tab');
  evaluate(`(async()=>{const {createState}=await import('../src/core.js');const other=createState();other.gold=1777;localStorage.setItem('${key}',JSON.stringify(other));return true})()`);
  browser('tab', gameTab);
  await until('document.querySelector("#panel-body").textContent.includes("another tab")');
  press('Escape');
  click('#save-button');
  assert.equal(saved().gold, 1777, 'An outdated tab must not overwrite the other tab');
  browser('reload');
  await until('document.querySelector("#loading-overlay")?.hidden === true');
  assert.equal(saved().gold, 1777);
  browser('tab', 'close', 'other-tab');
  pass('conflicting tab saves are protected and a reload adopts the newer checkpoint');

  browser('open', new URL('tests/fixture.html', base).href);
  evaluate(`(async()=>{const {createState}=await import('../src/core.js');const backup=createState();backup.gold=1234;localStorage.setItem('${key}.previous',JSON.stringify(backup));localStorage.setItem('${key}', '{broken-json');return true})()`);
  browser('open', base); await until('document.querySelector("#loading-overlay")?.hidden === true');
  assert.equal(evaluate(`localStorage.getItem('${key}.recovery')`), '{broken-json');
  assert.equal(saved().version, 1);
  assert.equal(saved().gold, 1234);
  assert.equal(evaluate(`JSON.parse(localStorage.getItem('${key}.previous')).gold`), 1234);
  pass('corrupt primary preserves its original bytes and restores the valid backup without overwriting it');

  const errors = browser('errors');
  const errorList = errors.errors || errors.messages || [];
  assert.deepEqual(errorList, [], `Browser runtime errors: ${JSON.stringify(errors)}`);
  console.log(`\n${passed} end-to-end browser checks passed. Session: ${session}`);
} finally {
  try { browser('close'); } catch { /* Preserve the original test failure. */ }
  rmSync(temporary, { recursive: true, force: true });
}
