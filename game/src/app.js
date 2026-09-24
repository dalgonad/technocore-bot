import * as core from './core.js';
import { CROPS, TOOLS, VILLAGERS, SEASONS, MONSTER_TYPES, FISH } from './data.js';
import { WORLD, regionAt, getNpcPosition } from './world.js';
import { createRenderer } from './renderer.js';
import { createFrameClock } from './clock.js';

const $ = (selector) => document.querySelector(selector);
const SAVE_KEY = 'dlicom.meadow.v1';
const BACKUP_KEY = `${SAVE_KEY}.previous`;
const RECOVERY_KEY = `${SAVE_KEY}.recovery`;
const dialog = $('#panel-dialog');
const panelBody = $('#panel-body');
const canvas = $('#world');
const held = new Set();
const frameClock = createFrameClock();
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const number = (value) => new Intl.NumberFormat('en-US').format(Math.floor(value || 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const paths = {
  sprout: '<path d="M12 21v-9M12 16C5 17 3 12 4 7c6 0 8 4 8 9ZM12 12c0-6 3-9 8-9 1 5-2 9-8 9Z"/>',
  leaf: '<path d="M5 19c8 1 15-5 14-15C9 3 2 7 4 14M4 21 15 10M10 15l-1-6M10 15h6"/>',
  map: '<path d="m3 5 6-2 6 3 6-2v16l-6 2-6-3-6 2ZM9 3v16M15 6v16"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6M19 14a6 6 0 0 1 3 5v2"/>',
  book: '<path d="M12 6v16M3 3c4 0 6 1 9 3 3-2 5-3 9-3v16c-4 0-6 1-9 3-3-2-5-3-9-3ZM6 8h2M6 12h2M16 9h2M16 13h2"/>',
  'sound-off': '<path d="m11 4-6 5H2v6h3l6 5ZM17 9l5 6M22 9l-5 6"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5ZM16 8a6 6 0 0 1 0 8M19 4a11 11 0 0 1 0 16"/>',
  settings: '<path d="m9 3-1 3-3 1-2 3 2 3-1 3 3 3 3-1 3 2 3-2 3-1 1-3 2-3-2-3 1-3-3-3-3 1Z"/><circle cx="12" cy="12" r="3"/>',
  cloud: '<path d="M7 18H6a4 4 0 1 1 1-8 6 6 0 0 1 11-3 5 5 0 0 1 1 10M9 17l3 3 6-6"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  play: '<path d="m8 4 13 8-13 8Z"/>',
  hoe: '<path d="m6 21 11-16M8 4l4-2 9 5-3 5Z"/>',
  can: '<path d="M7 10h9v10H5V10h2ZM16 13l5-5 2 3-7 7M7 10V6a3 3 0 0 1 6 0v4M2 14v4h3"/>',
  axe: '<path d="m5 22 11-18M8 4l4-2 8 4 1 7-7-2Z"/>',
  pickaxe: '<path d="m5 22 11-18M6 6c5-6 13-3 15 4M13 3l-1-2"/>',
  sword: '<path d="m5 20 4-4M7 12l5 5M9 14l9-11 4-1-1 5-11 9M3 19l3 3"/>',
  rod: '<path d="m3 21 12-17c4 0 6 5 6 11v2a3 3 0 0 1-6 0v-2M4 17l3 2"/>',
  bag: '<path d="M5 9a7 7 0 0 1 14 0v12H5ZM9 4V2h6v2M9 13h6v6H9ZM3 12H1v7h4M19 12h3v7h-3"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',
  rain: '<path d="M5 15a4 4 0 0 1 0-8 6 6 0 0 1 11-2 5 5 0 0 1 3 10M7 18l-1 3M12 18l-1 3M17 18l-1 3"/>',
  snow: '<path d="M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3M3 10l4-1V5M21 14l-4 1v4M3 14l4 1v4M21 10l-4-1V5"/>',
  home: '<path d="m2 10 10-8 10 8M5 8v13h14V8M10 21v-7h4v7"/>',
  lightning: '<path d="m13 1-9 13h7l-1 9 10-14h-7Z"/>',
  heart: '<path d="M20 5c-3-3-6-1-8 2-2-3-5-5-8-2-5 5 2 11 8 15 6-4 13-10 8-15Z"/>',
  drop: '<path d="M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13ZM8 15c0 2 1 3 3 3"/>',
  bread: '<path d="M5 11a5 5 0 0 1 0-9h14a5 5 0 0 1 0 9v10H5ZM8 6h1M13 6h1M9 11h5"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m8 16 3-7 6-2-3 7Z"/>',
  sparkles: '<path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3ZM3 2v4M1 4h4M20 19v4M18 21h4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  fish: '<path d="M3 12c5-9 12-9 16 0-4 9-11 9-16 0ZM19 12l4-5v10ZM8 9v1"/>',
  tree: '<path d="m12 2-7 9h3l-5 7h18l-5-7h3ZM10 18v4h4v-4"/>',
  egg: '<path d="M19 15c0-6-5-13-7-13S5 9 5 15a7 7 0 0 0 14 0Z"/>',
  rock: '<path d="m2 16 4-10 10-3 6 12-6 6H6ZM6 6l5 8 11 1M11 14l5 7"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a4 4 0 0 0 0 8h4v-4h-3"/>',
  shield: '<path d="m12 2 9 4v7c-1 4-5 7-9 9-4-2-8-5-9-9V6ZM8 12l3 3 5-6"/>',
  gift: '<path d="M3 10h18v4H3ZM5 14v8h14v-8M12 10v12M12 10C3 9 5 1 9 4c2 1 3 6 3 6Zm0 0c9-1 7-9 3-6-2 1-3 6-3 6Z"/>',
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.sprout}</svg>`;
const renderIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
renderIcons();

let state;
let renderer;
let booted = false;
let panel = null;
let panelId = null;
let focusPaused = false;
let actionUntil = 0;
let hudElapsed = 0;
let saveElapsed = 0;
let mapElapsed = 0;
let toolbarSignature = '';
let questSignature = '';
let muted = true;
let audio;
let bagFilter = 'all';
let storageBlocked = false;
let pendingImport = null;
let persistentWarning = '';
let battleMessages = [];

function toast(message, error = false) {
  if (!message) return;
  const element = document.createElement('div');
  element.className = `toast${error ? ' error' : ''}`;
  element.innerHTML = `${icon(error ? 'leaf' : 'check')}<span>${escape(message)}</span>`;
  $('#toast-stack').append(element);
  while ($('#toast-stack').children.length > 3) $('#toast-stack').firstElementChild.remove();
  window.setTimeout(() => { element.classList.add('leaving'); window.setTimeout(() => element.remove(), 220); }, error ? 5000 : 3500);
}

function sound(kind = 'ok') {
  if (muted) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(kind === 'error' ? 180 : 520, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'error' ? 120 : 780, audio.currentTime + .11);
    gain.gain.setValueAtTime(.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .18);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + .18);
  } catch { muted = true; }
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return core.createState();
    try { return core.validateState(JSON.parse(raw)); }
    catch {
      try { localStorage.setItem(RECOVERY_KEY, raw); }
      catch { storageBlocked = true; }
      try {
        const backup = localStorage.getItem(BACKUP_KEY);
        if (backup) {
          const recovered = core.validateState(JSON.parse(backup));
          persistentWarning = 'Your main save was damaged, so the last valid backup was restored. The original data is kept for recovery.';
          return recovered;
        }
      } catch { /* Keep the original bytes when neither checkpoint can load. */ }
      persistentWarning = 'Your previous save could not be read. A recovery copy has been kept, and a new world is ready.';
      return core.createState();
    }
  } catch {
    storageBlocked = true;
    persistentWarning = 'Browser storage is unavailable. Export your save in Settings to keep your progress safe.';
    return core.createState();
  }
}

function saveGame(manual = false) {
  if (!booted) return false;
  if (storageBlocked) {
    $('#save-label').textContent = 'Export save';
    $('#autosave-hint').textContent = 'Storage unavailable — export your save';
    if (manual) { toast('Use Export save in Settings; browser storage is unavailable.', true); openPanel('settings'); }
    return false;
  }
  try {
    const encoded = JSON.stringify(state);
    const old = localStorage.getItem(SAVE_KEY);
    if (old && old !== encoded) {
      let valid = false;
      try { core.validateState(JSON.parse(old)); valid = true; } catch { /* A broken primary must not replace a valid backup. */ }
      if (valid) localStorage.setItem(BACKUP_KEY, old);
    }
    localStorage.setItem(SAVE_KEY, encoded);
    $('#save-label').textContent = 'Saved';
    $('#autosave-hint').textContent = 'Progress saved on this device';
    saveElapsed = 0;
    if (manual) toast('Your adventure is saved. See you on the farm!');
    return true;
  } catch {
    $('#save-label').textContent = 'Save failed';
    $('#autosave-hint').textContent = 'Save failed — export through Settings';
    if (manual || !persistentWarning) toast('Storage is full or blocked. Export your save in Settings.', true);
    persistentWarning = 'Browser storage is full or blocked.';
    return false;
  }
}

function downloadData(contents, filename) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSave() {
  downloadData(JSON.stringify(state, null, 2), `meadow-days-day-${state.day}.json`);
  toast('Save exported. Keep this file as a backup.');
}

function resetInput() { held.clear(); frameClock.reset(); }
function worldActive() { return booted && !panel && !focusPaused && !document.hidden; }
function calendarLabel() {
  const value = core.calendar(state);
  return { ...value, seasonName: typeof value.season === 'number' ? SEASONS[value.season] : value.season };
}
function itemArt(id, size = '') {
  const crop = CROPS[id.replace(/_seed$/, '')];
  const item = core.itemInfo(id);
  if (crop) return `<span class="item-art ${size}"><span class="crop-symbol" style="--crop-color:${escape(crop.color)}"></span></span>`;
  const art = id === 'bread' ? 'bread' : id === 'egg' ? 'egg' : id === 'wood' ? 'tree' : FISH[id] ? 'fish' : id.endsWith('_ore') || ['stone','gem'].includes(id) ? 'rock' : id === 'feed' ? 'sprout' : 'gift';
  return `<span class="item-art ${size}" style="color:${escape(item?.color || '#73945f')}">${icon(art)}</span>`;
}

const toolSprites = { hoe: 0, can: 2, seeds: 3, axe: 1, rod: 5 };
function renderToolbar() {
  const signature = `${state.tool}|${state.selectedSeed}|${state.water}|${state.inventory[`${state.selectedSeed}_seed`] || 0}`;
  if (signature === toolbarSignature) return;
  toolbarSignature = signature;
  $('#toolbar').innerHTML = TOOLS.map((tool, index) => {
    const art = toolSprites[tool.id] !== undefined ? `<span class="tool-art" style="background-position:-${toolSprites[tool.id] * 34}px 0"></span>` : icon(tool.id);
    const count = tool.id === 'can' ? state.water : tool.id === 'seeds' ? state.inventory[`${state.selectedSeed}_seed`] || 0 : '';
    return `<button class="tool-slot${state.tool === tool.id ? ' active' : ''}" data-tool="${tool.id}" aria-label="${escape(tool.name)} (${index + 1})" aria-pressed="${state.tool === tool.id}" title="${escape(tool.name)} · ${index + 1}"><span class="slot-key">${index + 1}</span>${art}<span class="quantity">${count}</span></button>`;
  }).join('');
  $('#selected-tool-name').textContent = state.tool === 'seeds' ? CROPS[state.selectedSeed]?.name || 'Seeds' : TOOLS.find(tool => tool.id === state.tool)?.name;
}

function renderQuests() {
  const quests = core.getQuests(state);
  const visible = quests.slice(0, 3);
  const signature = JSON.stringify(visible);
  if (signature === questSignature) return;
  questSignature = signature;
  $('#quest-count').textContent = `${visible.filter(quest => quest.complete).length}/${visible.length}`;
  $('#quest-list').innerHTML = visible.map(quest => `<div class="quest-row${quest.complete ? ' complete' : ''}"><span class="quest-check">${quest.complete ? '✓' : ''}</span><div><strong>${escape(quest.title)}</strong><p>${escape(quest.description)} <span>${Math.min(quest.progress, quest.target)}/${quest.target}</span></p></div>${quest.complete && !quest.claimed ? `<button data-claim="${escape(quest.id)}" aria-label="Claim reward: ${escape(quest.title)}">Claim</button>` : ''}</div>`).join('');
}

function renderHud() {
  if (!booted) return;
  const date = calendarLabel();
  $('#day-label').textContent = `${date.weekday}, ${date.seasonName} ${date.day}`.toUpperCase();
  $('#year-label').textContent = `YEAR ${date.year}`;
  $('#clock').textContent = core.formatTime(state);
  $('#gold').textContent = number(state.gold);
  $('#stamina-value').textContent = Math.floor(state.stamina);
  $('#stamina-bar').style.width = `${clamp(state.stamina / state.maxStamina, 0, 1) * 100}%`;
  $('#health-value').textContent = Math.floor(state.player.hp);
  $('#water-value').textContent = state.water;
  $('#day-progress').style.width = `${clamp((state.minute - 360) / 1200, 0, 1) * 100}%`;
  const rainy = ['rain','rainy'].includes(state.weather);
  const snowy = ['snow','snowy'].includes(state.weather);
  const night = state.minute >= 1140;
  const weatherName = rainy ? 'Rain waters the farm' : snowy ? 'Softly falling snow' : night ? 'A peaceful night' : state.minute < 720 ? 'A bright morning' : 'Clear skies today';
  const weatherIcon = rainy ? 'rain' : snowy ? 'snow' : night ? 'moon' : 'sun';
  $('#weather-label').textContent = weatherName;
  if ($('#weather-art').dataset.icon !== weatherIcon) { $('#weather-art').dataset.icon = weatherIcon; $('#weather-art').innerHTML = icon(weatherIcon); }
  const region = regionAt(state.player.x, state.player.y);
  $('#location-name').textContent = region?.name || 'Meadow Valley';
  $('#location-description').textContent = region?.subtitle || 'One step, one story.';
  $('#world-status').textContent = (panel && panel !== 'fishing') || focusPaused ? 'PAUSED' : 'WORLD ALIVE';
  const prompt = core.getPrompt(state) || 'Use a tool · WASD to move';
  $('#interaction-prompt span').textContent = prompt;
  $('#interaction-prompt kbd').textContent = /^(?:Hoe|Water|Plant|Fish|Chop|Mine|Swing|Use)\b/i.test(prompt) ? 'SPACE' : 'E';
  $('#snack-button').disabled = !state.inventory.bread;
  renderToolbar(); renderQuests();
}

function feedback(result, quiet = false) {
  if (!result) return;
  if (!quiet && result.message) toast(result.message, !result.ok);
  sound(result.ok ? 'ok' : 'error');
  if (result.ok) saveGame();
  renderHud();
}

function useTool() {
  if (!worldActive() || performance.now() < actionUntil) return;
  actionUntil = performance.now() + 220;
  const result = core.useTool(state);
  feedback(result);
  if (state.battle) { battleMessages = [result.message]; openPanel('battle'); }
  else if (state.fishing) openPanel('fishing');
}

function interact() {
  if (!worldActive() || performance.now() < actionUntil) return;
  actionUntil = performance.now() + 180;
  const result = core.interact(state);
  if (result?.kind) {
    const kinds = { shop: 'shop', npc: 'npc', sleep: 'sleep', shipping: 'shipping', chest: 'bag', sign: 'help', mine: 'mine', animal: 'animal' };
    if (kinds[result.kind]) { if (result.ok) saveGame(); openPanel(kinds[result.kind], result.id); renderHud(); return; }
  }
  feedback(result);
  if (state.battle) { battleMessages = [result.message]; openPanel('battle'); }
}

function chooseTool(id) {
  if (!worldActive() || performance.now() < actionUntil) return;
  const result = core.selectTool(state, id);
  if (!result.ok) toast(result.message, true);
  else { sound(); saveGame(); }
  renderToolbar();
  canvas.focus({ preventScroll: true });
}

function openPanel(name, id = null) {
  if (!booted) return;
  if (name === 'play') { closePanel(); return; }
  if (state.battle && name !== 'battle') { toast('Finish or leave the battle first.'); return; }
  if (state.fishing && name !== 'fishing') { core.cancelFishing(state); saveGame(); }
  resetInput(); focusPaused = false; $('#resume-overlay').hidden = true;
  panel = name; panelId = id;
  renderPanel();
  if (!dialog.open) dialog.showModal();
  if (name === 'fishing') {
    $('#fish-pond').tabIndex = 0;
    $('#fish-pond').focus();
  }
  renderHud();
}

function closePanel() {
  if (state?.battle) { const result = core.battleAction(state, 'flee'); feedback(result); }
  if (state?.fishing) { core.cancelFishing(state); saveGame(); }
  panel = null; panelId = null; pendingImport = null;
  if (dialog.open) dialog.close();
  resetInput(); focusPaused = false; $('#resume-overlay').hidden = true;
  canvas.focus({ preventScroll: true });
  renderHud();
}

function setPanel(title, eyebrow, content) {
  $('#panel-title').textContent = title;
  $('#panel-eyebrow').textContent = eyebrow;
  panelBody.innerHTML = content;
}

function seedLabel(crop) { return crop.seasons.map(index => SEASONS[index]).join(' / '); }
function inventoryRows(shipping = false) {
  return Object.entries(state.inventory).filter(([, quantity]) => quantity > 0).filter(([id]) => {
    if (shipping) return core.itemInfo(id)?.sellPrice > 0 && !id.endsWith('_seed');
    if (bagFilter === 'seeds') return id.endsWith('_seed');
    if (bagFilter === 'harvest') return !id.endsWith('_seed') && (CROPS[id] || FISH[id] || id === 'egg');
    return true;
  }).map(([id, quantity]) => {
    const item = core.itemInfo(id);
    const isSeed = id.endsWith('_seed');
    const selected = state.selectedSeed === id.replace(/_seed$/, '');
    return `<article class="inventory-item">${itemArt(id)}<h3>${escape(item?.name || id)}</h3><p>${number(quantity)} in bag${item?.sellPrice ? ` · ${number(item.sellPrice)} G each` : ''}</p>${isSeed ? `<p>${escape(seedLabel(CROPS[id.replace(/_seed$/, '')]))}</p>` : ''}<div class="item-actions">${shipping ? `<button class="small-button" data-ship="${escape(id)}" data-quantity="1">Ship 1</button><button class="small-button" data-ship="${escape(id)}" data-quantity="${quantity}">Ship all</button>` : isSeed ? `<button class="small-button${selected ? ' active' : ''}" data-seed="${escape(id.replace(/_seed$/, ''))}">${selected ? '✓ Selected' : 'Choose seeds'}</button>` : id === 'bread' ? '<button class="small-button" data-eat>Eat bread</button>' : id === 'feed' ? '<button class="small-button" data-feed>Feed animals</button>' : ''}</div></article>`;
  }).join('');
}

function renderPanel() {
  if (!panel) return;
  if (panel === 'bag') {
    const rows = inventoryRows();
    setPanel('Small things, endless possibilities.', 'BACKPACK · I', `<p class="panel-intro">Choose seeds to plant. Take your harvest to the shipping bin beside the house; payment arrives after you sleep.</p><div class="dialog-tabs">${[['all','All items'],['seeds','Seeds'],['harvest','Harvest']].map(([id,name]) => `<button data-bag-filter="${id}" class="${bagFilter === id ? 'active' : ''}">${name}</button>`).join('')}</div><div class="grid-items">${rows || '<p class="empty-state">No items in this category yet.</p>'}</div>`);
  } else if (panel === 'shop') {
    const allCrops = Object.values(CROPS);
    const current = allCrops.filter(crop => crop.seasons.includes(state.season));
    const others = allCrops.filter(crop => !crop.seasons.includes(state.season));
    const cropCards = (crops) => crops.map(crop => `<article class="shop-item">${itemArt(crop.id)}<span class="season-badge">${escape(seedLabel(crop))}</span><h3>${escape(crop.name)} Seeds</h3><p>${crop.growth} nights to grow${crop.regrow ? ` · regrows in ${crop.regrow} nights` : ''}<br>Harvest sells for ${crop.sellPrice} G</p><span class="price-tag">${crop.seedPrice} G / seed</span><div class="item-actions"><button class="small-button" data-buy="${crop.id}_seed" data-quantity="1" ${state.gold < crop.seedPrice ? 'disabled' : ''}>Buy 1</button><button class="small-button" data-buy="${crop.id}_seed" data-quantity="5" ${state.gold < crop.seedPrice * 5 ? 'disabled' : ''}>Buy 5</button></div></article>`).join('');
    const supplies = ['bread','feed','herbal_tea'].map(id => { const item = core.itemInfo(id); return `<article class="shop-item">${itemArt(id)}<h3>${escape(item.name)}</h3><p>${id === 'bread' ? 'Restores energy and HP.' : id === 'feed' ? 'One serving per chicken.' : 'A warm gift for a neighbor.'}</p><span class="price-tag">${item.price} G</span><button class="small-button" data-buy="${id}" data-quantity="1" ${state.gold < item.price ? 'disabled' : ''}>Buy 1</button></article>`; }).join('');
    setPanel('Meadow Co-op', `SHOP · ${number(state.gold)} G`, `<p class="panel-intro">Seeds, supplies, and new beginnings. Keep seeds for future seasons, but plant them only in their growing season.</p><section class="shop-category"><div class="panel-subhead"><h3>For this season</h3><p>${escape(SEASONS[state.season])}</p></div><div class="grid-items">${cropCards(current)}</div></section><section class="shop-category"><div class="panel-subhead"><h3>Everyday supplies</h3></div><div class="grid-items">${supplies}</div></section><section class="shop-category"><div class="panel-subhead"><h3>Plan for next season</h3></div><div class="grid-items">${cropCards(others)}</div></section>`);
  } else if (panel === 'shipping') {
    const entries = Object.entries(state.shipping).filter(([, quantity]) => quantity > 0);
    const total = entries.reduce((sum, [id, count]) => sum + (core.itemInfo(id)?.sellPrice || 0) * count, 0);
    setPanel('From your farm, for everyone.', 'SHIPPING BIN', `<p class="panel-intro">Add the items you want to sell. Gold arrives at the start of the next day. Shipped items stay safe when you save the game.</p>${entries.length ? `<div>${entries.map(([id, count]) => `<div class="shipment-row"><span>${escape(core.itemInfo(id)?.name)} × ${count}</span><small>${number(count * core.itemInfo(id).sellPrice)} G</small></div>`).join('')}</div>` : ''}<div class="shipping-total"><span>Tonight’s shipment</span><strong>${number(total)} G</strong></div><div class="panel-subhead" style="margin-top:24px"><h3>Items ready to ship</h3></div><div class="grid-items">${inventoryRows(true) || '<p class="empty-state">Harvest crops or catch fish to fill the bin.</p>'}</div>`);
  } else if (panel === 'map') {
    setPanel('One valley. Many stories.', 'MEADOW VALLEY MAP · M', `<p class="panel-intro">Follow dirt paths and bridges to explore five regions. The bright dot is you; open the map whenever you need a breather.</p><canvas id="large-map" class="world-map" width="720" height="420" aria-label="Map of the five regions of Meadow Valley"></canvas><div class="map-legend"><span><i class="legend-dot" style="background:#fff7c5"></i>You</span><span><i class="legend-dot" style="background:#db947d"></i>Buildings</span><span><i class="legend-dot" style="background:#7d9ab5"></i>Water</span><span><i class="legend-dot" style="background:#b17cc1"></i>Monsters</span></div><div class="region-list">${WORLD.regions.map(region => `<div class="region-item"><span>${icon(({farm:'sprout',village:'people',forest:'tree',coast:'fish',mine:'pickaxe'})[region.id])}</span><div><h3>${escape(region.name)}</h3><p>${escape(region.subtitle)}</p></div></div>`).join('')}</div><p class="panel-note">Your farm is always safe. Battles start only when you interact with a monster or use your sword. River crossings are on the central and southern paths.</p>`);
    renderer.drawMap($('#large-map'), state);
  } else if (panel === 'people') {
    setPanel('Neighbors today, friends tomorrow.', 'MEADOW VILLAGERS · 5 STORIES', `<p class="panel-intro">Get to know their routines. Villagers move with the time, days off, and weather. Conversations and gifts count once per day.</p><div class="people-list">${VILLAGERS.map((villager, index) => {
      const pos = getNpcPosition(state, villager.id);
      const hearts = clamp(Math.floor((state.friendship[villager.id] || 0) / 100), 0, 10);
      const nearby = Math.hypot(pos.x - state.player.x, pos.y - state.player.y) < 2.5;
      return `<article class="person-card"><span class="portrait" style="background-position-x:-${index * 8 * 64}px" aria-hidden="true"></span><div class="person-details"><h3>${escape(villager.name)} <small>${escape(villager.role)}</small></h3><p>${escape(pos.destination)} · ${escape(pos.activity)}</p><span class="person-status">${state.talked[villager.id] ? '✓ Talked today' : 'Not greeted today'}</span>${nearby ? `<button class="small-button" data-person="${villager.id}">Say hello</button>` : ''}</div><div class="hearts" aria-label="${hearts} out of 10 hearts">${'♥'.repeat(hearts)}<span>${'♡'.repeat(10 - hearts)}</span></div></article>`;
    }).join('')}</div><p class="panel-note">Schedules and friendships are playable. Marriage and full romance storylines are not included in this version.</p>`);
  } else if (panel === 'npc') {
    const villager = VILLAGERS.find(person => person.id === panelId) || VILLAGERS[0];
    const index = VILLAGERS.indexOf(villager);
    const lines = {dlira:'“Warm bread for a long day. But remember, rest is part of a good day’s work, too.”',dlito:'“Good soil needs care, not hurry. Have you watered your farm today?”',dlizal:'“The lake looks peaceful today. Sometimes the best catch is a story from a friend.”',dliwi:'“There is plenty to discover in the northern mine. Bring a pickaxe, some bread, and your curiosity.”',dliyu:'“Every place has a story. I am looking for the pages we have yet to read.”'};
    setPanel(villager.name, villager.role.toUpperCase(), `<div class="talk-scene"><span class="portrait" style="background-position-x:-${index * 8 * 96}px" aria-hidden="true"></span><div><blockquote>${lines[villager.id]}</blockquote><p>${escape(getNpcPosition(state, villager.id).activity)}</p></div></div><p class="panel-intro">Favorite gift: ${escape(core.itemInfo(villager.gift)?.name || villager.gift)} · Friendship ${number(state.friendship[villager.id] || 0)}/1,000</p><div class="panel-actions"><button class="primary-button" data-talk="${villager.id}" ${state.talked[villager.id] ? 'disabled' : ''}>${icon('people')}${state.talked[villager.id] ? 'Talked today' : 'Say hello & chat'}</button><button class="secondary-button" data-gift="${villager.id}" ${state.gifted[villager.id] ? 'disabled' : ''}>${icon('gift')}Give favorite gift</button>${['dlira','dlito','dliwi'].includes(villager.id) ? '<button class="secondary-button" data-open="shop">Shop for supplies</button>' : ''}</div><p class="panel-note">Gifts are given only if they are in your backpack. Opening a conversation does not use any items.</p>`);
  } else if (panel === 'quests') {
    setPanel('Every adventure starts small.', 'JOURNAL · J', `<p class="panel-intro">No deadlines or penalties. Claim a reward when you finish, then carry on with your own story.</p>${core.getQuests(state).map(quest => `<article class="journal-quest"><span class="quest-check" style="${quest.complete ? 'background:#779660;color:white' : ''}">${quest.complete ? '✓' : ''}</span><div><h3>${escape(quest.title)}</h3><p>${escape(quest.description)}</p><div class="quest-progress"><span style="width:${clamp(quest.progress / quest.target, 0, 1) * 100}%"></span></div><span class="quest-stats">${Math.min(quest.progress, quest.target)} / ${quest.target} · Reward ${number(typeof quest.reward === 'number' ? quest.reward : quest.reward?.gold || 0)} G</span></div><button class="small-button" data-claim="${escape(quest.id)}" ${!quest.complete || quest.claimed ? 'disabled' : ''}>${quest.claimed ? '✓ Claimed' : 'Claim reward'}</button></article>`).join('')}`);
  } else if (panel === 'help') {
    const controls = [['Move','W A S D'],['Use tool','SPACE'],['Interact / harvest','E'],['Choose tool','1–7'],['Switch tool','Q / R'],['Backpack','I'],['Map / journal','M / J'],['Close / pause','ESC']];
    setPanel('Take your time. Find your rhythm.', 'HOW TO PLAY', `<p class="panel-intro">You are Dlino, the newest resident of Meadow Valley. A farm, a chicken, and seven tools are waiting for you. No account, wallet, or real-money purchases.</p><div class="controls-grid">${controls.map(([name,keys]) => `<div class="control-row"><span>${name}</span><span>${keys.split(' ').map(key => `<kbd>${key}</kbd>`).join('')}</span></div>`).join('')}</div><div class="help-steps"><div class="help-step">Stand beside a tile and face it. Use the Hoe (1), choose Seeds (3), then the Watering Can (2). Press Space once for each action.</div><div class="help-step">Choose a different seed in your Backpack. Each crop has a growing season and needs a set number of nights to grow. Rain helps with watering, but growth still takes time.</div><div class="help-step">Face a ripe crop and press E to harvest. The shipping bin and well are north of the field. Face your front door and press E to sleep.</div><div class="help-step">Follow the path east to the village to buy seeds. Head north for the mine, south for the woods, and across the river for the coast.</div><div class="help-step">Use the Fishing Rod at the water’s edge. Wait for a bite, then reel it in. Monsters are visible in the world but will not attack until you choose to fight.</div><div class="help-step">Menus pause time, except while fishing. Inactive tabs also pause the game. Relaxed mode in Settings makes days longer. Use Export save to back up your progress across devices.</div></div><p class="panel-note">On a phone, use the direction buttons, E, and Tool. Tapping the world faces that direction and uses your tool on one adjacent tile—it does not let you plant from a distance.</p>`);
  } else if (panel === 'settings') {
    setPanel('Make yourself at home.', 'SETTINGS & SAVES', `<div class="setting-row"><div><h3>Daily rhythm</h3><p>A full day lasts 20 active minutes, or 40 in relaxed mode.</p></div><select id="day-speed" aria-label="Day speed"><option value="normal" ${!state.options.relaxed ? 'selected' : ''}>Standard</option><option value="relaxed" ${state.options.relaxed ? 'selected' : ''}>Relaxed · 2× longer</option></select></div><div class="setting-row"><div><h3>Action sounds</h3><p>Gentle feedback for actions and interactions.</p></div><input type="checkbox" id="sound-setting" aria-label="Action sounds" ${!muted ? 'checked' : ''}></div><section class="settings-section"><h3>Your save, your story</h3><p>Progress is saved automatically in this browser. Switching devices or clearing browser data can remove it; export a JSON file as a backup. Saves from the older prototype are not overwritten.</p><div class="panel-actions"><button class="primary-button" data-save>${icon('cloud')}Save now</button><button class="secondary-button" data-export>Export save</button><button class="secondary-button" data-import>Import save</button><button class="secondary-button" data-restore>Restore backup</button></div>${persistentWarning ? `<p class="panel-note">${escape(persistentWarning)}</p>` : ''}</section><section class="settings-section"><h3>A fresh beginning</h3><p>Start a new farm after exporting your progress. Confirmation is required.</p><button class="danger-button" data-reset>Start a new game</button></section>`);
    const recoveryButton = document.createElement('button');
    recoveryButton.className = 'secondary-button';
    recoveryButton.dataset.exportRecovery = '';
    recoveryButton.textContent = 'Export recovery data';
    panelBody.querySelector('.settings-section .panel-actions').append(recoveryButton);
  } else if (panel === 'reset') {
    setPanel('Start a new story?', 'CONFIRMATION', '<p class="panel-intro">This replaces the active farm on this device. Export first to keep your current adventure. Saves from the older prototype remain untouched.</p><div class="panel-actions"><button class="secondary-button" data-export>Export first</button><button class="danger-button" data-confirm-reset>Yes, start fresh</button><button class="secondary-button" data-open="settings">Cancel</button></div>');
  } else if (panel === 'import-confirm') {
    const date = core.calendar(pendingImport);
    setPanel('Continue from this save?', 'VERIFIED IMPORT', `<p class="panel-intro">Valid save: day ${pendingImport.day}, year ${date.year}, ${number(pendingImport.gold)} G. Your current progress is replaced only after you confirm.</p><div class="panel-actions"><button class="primary-button" data-confirm-import>Use this save</button><button class="secondary-button" data-open="settings">Cancel</button></div>`);
  } else if (panel === 'sleep') {
    const total = Object.entries(state.shipping).reduce((sum,[id,quantity]) => sum + (core.itemInfo(id)?.sellPrice || 0) * quantity, 0);
    setPanel('A good day to grow.', 'FARMHOUSE', `<div class="sleep-illustration">${icon('moon')}</div><p class="panel-intro">End the day and wake up at 06:00. Watered crops grow overnight, and fed chickens prepare eggs. Your shipment is worth <strong>${number(total)} G</strong>.</p><div class="panel-actions"><button class="primary-button" data-sleep>${icon('moon')}Sleep until morning</button><button class="secondary-button" data-close>Not yet, there is still time</button></div>`);
  } else if (panel === 'animal') {
    setPanel('Little friends on your farm.', 'CHICKEN COOP', `<div class="sleep-illustration">${icon('egg')}</div><p class="panel-intro">Feed your chickens once a day and say hello. Eggs are ready after a well-fed night; collect them with E near the chicken.</p>${state.animals.map(animal => `<div class="shipment-row"><span>${escape(animal.name)}</span><small>${animal.fed ? '✓ Fed today' : 'Needs food'} · ${animal.product ? 'Egg ready' : 'No egg yet'}</small></div>`).join('')}<div class="panel-actions"><button class="primary-button" data-feed>Feed animals (${state.inventory.feed || 0} available)</button></div>`);
  } else if (panel === 'mine') {
    setPanel('Every stone holds a story.', 'NORTHERN MINE', '<div class="sleep-illustration">'+icon('pickaxe')+'</div><p class="panel-intro">Look for sparkling rocks along the mine paths, face them, and use the Pickaxe (5). Rocks and monsters return each new day. Leaving costs nothing.</p><div class="panel-actions"><button class="primary-button" data-close>Explore the mine</button><button class="secondary-button" data-open="map">Open map</button></div>');
  } else if (panel === 'battle') renderBattle();
  else if (panel === 'fishing') renderFishing();
}

function renderBattle() {
  const battle = state.battle;
  if (!battle) return;
  const monster = state.monsters.find(enemy => enemy.id === battle.monsterId);
  if (!monster) { closePanel(); return; }
  const type = MONSTER_TYPES[monster.type];
  const logs = battleMessages.slice(-3).join(' ') || 'Choose an action. Time pauses during battles.';
  setPanel('A little courage, a new story.', 'WILD ENCOUNTER · OPTIONAL', `<div class="battle-scene"><div class="battle-actor"><div class="battle-hero"></div><strong>Dlino</strong><div class="battle-hp"><span style="width:${state.player.hp}%"></span></div><small>${Math.floor(state.player.hp)} / 100 HP</small></div><div class="battle-actor"><div class="monster-art" style="--monster-color:${escape(type.color)}"></div><strong>${escape(type.name)}</strong><div class="battle-hp"><span style="width:${clamp(monster.hp / type.hp, 0, 1) * 100}%"></span></div><small>${Math.max(0, monster.hp)} / ${type.hp} HP</small></div></div><div class="battle-log" aria-live="polite">${escape(logs)}</div><div class="battle-actions"><button class="primary-button" data-battle="attack">${icon('sword')}Attack</button><button class="secondary-button" data-battle="guard">${icon('shield')}Guard</button><button class="secondary-button" data-battle="heal" ${!state.inventory.bread ? 'disabled' : ''}>${icon('bread')}Bread (${state.inventory.bread || 0})</button><button class="secondary-button" data-battle="flee">Leave safely →</button></div><p class="panel-note">Battles are turn-based, so no quick reflexes are needed. You can always leave without losing money or items.</p>`);
}

function renderFishing() {
  setPanel('A moment by the water.', 'FISHING', '<div class="fish-pond" id="fish-pond"><span class="fishing-symbol">'+icon('fish')+'</span><h3 id="fish-title">Waiting for a bite…</h3><p id="fish-description">Watch the bobber. Press the button when a fish bites.</p><div class="fish-timer"><span id="fish-progress"></span></div></div><div class="panel-actions"><button class="primary-button" id="reel-button" data-reel>Reel in · SPACE</button><button class="secondary-button" data-cancel-fishing>Cancel</button></div><p class="panel-note">World time keeps moving while you fish. Cancelling does not remove anything from your backpack.</p>');
  updateFishingUI();
}

function updateFishingUI() {
  if (panel !== 'fishing' || !state.fishing) return;
  const fish = state.fishing;
  const elapsed = fish.elapsed || 0;
  const biteAt = fish.biteAt ?? fish.wait ?? 4;
  const windowLength = fish.window ?? fish.biteWindow ?? 2;
  const bite = fish.phase === 'bite' || elapsed >= biteAt;
  $('#fish-pond')?.classList.toggle('bite', bite);
  if ($('#fish-title')) $('#fish-title').textContent = bite ? 'You have a bite!' : 'Waiting for a bite…';
  if ($('#fish-description')) $('#fish-description').textContent = bite ? 'Now! Reel it in.' : 'Enjoy the calm water. A fish will be along soon.';
  if ($('#reel-button')) { $('#reel-button').disabled = !bite; $('#reel-button').textContent = bite ? 'Reel in now! · SPACE' : 'Watch the bobber…'; }
  if ($('#fish-progress')) $('#fish-progress').style.width = `${clamp(bite ? 1 - (elapsed - biteAt) / windowLength : elapsed / biteAt, 0, 1) * 100}%`;
}

function finishFishing() {
  if (panel !== 'fishing' || !state.fishing) return;
  const result = core.finishFishing(state);
  feedback(result);
  if (!state.fishing) closePanel();
  else updateFishingUI();
}

function endDay(forced = false) {
  const oldGold = state.gold;
  const oldDay = state.day;
  const result = core.sleep(state, forced);
  if (!result?.ok) { feedback(result); return; }
  saveGame(); sound();
  showMorning(oldGold, oldDay, forced);
}

function showMorning(oldGold, oldDay, forced) {
  panel = 'morning'; panelId = null; resetInput();
  const date = calendarLabel();
  setPanel('Good morning, Meadow.', `${date.seasonName} ${date.day} · YEAR ${date.year}`, `<div class="sleep-illustration">${icon('sun')}</div><p class="day-summary-heading">${forced ? 'It was getting late, so you made it safely home.' : 'Another day has passed. Something good is growing.'}<br>A fresh start for your farm.</p><div class="summary-grid"><div class="summary-stat"><strong>+${number(state.gold - oldGold)}</strong><span>GOLD FROM SHIPMENTS</span></div><div class="summary-stat"><strong>${Object.values(state.farm).filter(tile => tile.crop?.ready && !tile.crop.withered).length}</strong><span>CROPS READY TO HARVEST</span></div><div class="summary-stat"><strong>${Math.floor(state.stamina)}</strong><span>TODAY’S ENERGY</span></div></div><div class="panel-actions"><button class="primary-button" data-close>Start a new day ${icon('sprout')}</button></div>`);
  if (!dialog.open) dialog.showModal();
  renderHud();
}

function toggleSound(enabled) {
  muted = !enabled;
  $('#sound-button').innerHTML = icon(muted ? 'sound-off' : 'sound');
  $('#sound-button').setAttribute('aria-pressed', String(!muted));
  $('#sound-button').setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound');
  if (!muted) sound();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled || !booted) return;
  const data = button.dataset;
  if (data.panel) openPanel(data.panel);
  else if (data.open) openPanel(data.open, panelId);
  else if (data.tool) chooseTool(data.tool);
  else if (data.bagFilter) { bagFilter = data.bagFilter; renderPanel(); }
  else if (data.seed) {
    if (!CROPS[data.seed] || !state.inventory[`${data.seed}_seed`]) return;
    state.selectedSeed = data.seed;
    const result = core.selectTool(state, 'seeds');
    feedback(result, true); renderPanel();
    toast(`${CROPS[data.seed].name} seeds selected. Face an empty plot and press Space.`);
  } else if (data.buy) { feedback(core.buyItem(state, data.buy, Number(data.quantity))); renderPanel(); }
  else if (data.ship) { feedback(core.sellItem(state, data.ship, Number(data.quantity))); renderPanel(); }
  else if (data.claim) { feedback(core.claimQuest(state, data.claim)); if (panel === 'quests') renderPanel(); }
  else if ('eat' in data) { feedback(core.eatFood(state)); renderPanel(); }
  else if ('feed' in data) { feedback(core.feedAnimals(state)); renderPanel(); }
  else if (data.person) openPanel('npc', data.person);
  else if (data.talk) { feedback(core.talkTo(state, data.talk)); renderPanel(); }
  else if (data.gift) { feedback(core.giveGift(state, data.gift, VILLAGERS.find(person => person.id === data.gift)?.gift)); renderPanel(); }
  else if ('save' in data) saveGame(true);
  else if ('export' in data) exportSave();
  else if ('import' in data) $('#save-file').click();
  else if ('exportRecovery' in data) {
    try {
      const recovered = localStorage.getItem(RECOVERY_KEY);
      if (!recovered) { toast('There is no recovery data to export.'); return; }
      downloadData(recovered, 'meadow-days-recovery-data.json');
      toast('Original data exported. This file may need repairs before it can be imported.');
    } catch { toast('Recovery data cannot be accessed in this browser.', true); }
  } else if ('reset' in data) openPanel('reset');
  else if ('confirmReset' in data) {
    state = core.createState(); toolbarSignature = ''; questSignature = ''; closePanel(); saveGame(true);
  } else if ('restore' in data) {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) { toast('No automatic backup is available yet.', true); return; }
      pendingImport = core.validateState(JSON.parse(raw)); openPanel('import-confirm');
    } catch { toast('The backup is invalid. Import an exported save file if you have one.', true); }
  } else if ('confirmImport' in data && pendingImport) {
    const imported = pendingImport;
    closePanel();
    state = imported; toolbarSignature = ''; questSignature = ''; battleMessages = [];
    if (state.battle) openPanel('battle');
    else if (state.fishing) openPanel('fishing');
    saveGame(true); renderHud();
  } else if ('sleep' in data) endDay();
  else if ('close' in data) closePanel();
  else if (data.battle && state.battle) {
    const result = core.battleAction(state, data.battle);
    if (result.message) battleMessages.push(result.message);
    feedback(result);
    if (state.battle) renderBattle(); else closePanel();
  } else if ('reel' in data) finishFishing();
  else if ('cancelFishing' in data) closePanel();
});

document.addEventListener('change', event => {
  if (event.target.id === 'day-speed') { state.options.relaxed = event.target.value === 'relaxed'; saveGame(); toast(state.options.relaxed ? 'Relaxed mode is on. More time to enjoy each day.' : 'Standard day speed is on.'); }
  if (event.target.id === 'sound-setting') toggleSound(event.target.checked);
});

$('#save-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  if (file.size > 1024 * 1024) { toast('The save file is too large (maximum 1 MB).', true); return; }
  try {
    pendingImport = core.validateState(JSON.parse(await file.text()));
    openPanel('import-confirm');
  } catch { toast('This is not a valid Meadow Days save. Your current progress is unchanged.', true); }
});

$('#close-panel').addEventListener('click', closePanel);
dialog.addEventListener('cancel', event => { event.preventDefault(); closePanel(); });
$('#save-button').addEventListener('click', () => saveGame(true));
$('#sound-button').addEventListener('click', () => toggleSound(muted));
$('#snack-button').addEventListener('click', () => { if (worldActive()) feedback(core.eatFood(state)); });
$('#sleep-button').addEventListener('click', () => {
  if (!worldActive()) return;
  const home = WORLD.buildings.find(building => building.id === 'farmhouse');
  if (Math.hypot(state.player.x - home.door[0], state.player.y - home.door[1]) < 3) openPanel('sleep');
  else { toast('Head to your front door north of the field to sleep.'); openPanel('map'); }
});
$('#resume-overlay').addEventListener('click', () => { resetInput(); focusPaused = false; $('#resume-overlay').hidden = true; canvas.focus({ preventScroll: true }); });
$('#touch-interact').addEventListener('click', interact);
$('#touch-tool').addEventListener('click', useTool);
$('#fullscreen-button').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if ($('#stage').requestFullscreen) await $('#stage').requestFullscreen(); else toast('Fullscreen is not supported in this browser.'); }
  catch { toast('Fullscreen is unavailable in this view.'); }
});

const movementKeys = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
function inputCode(event) {
  if (event.code && event.code !== 'Unidentified') return event.code;
  if (/^[a-z]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`;
  if (/^[0-9]$/.test(event.key)) return `Digit${event.key}`;
  return event.key === ' ' ? 'Space' : event.key;
}
document.addEventListener('keydown', event => {
  if (!booted || event.ctrlKey || event.metaKey || event.altKey) return;
  if (['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)) return;
  const code = inputCode(event);
  if (code === 'Space' && event.target.closest('button,a')) return;
  if (panel) {
    if (panel === 'fishing' && code === 'Space' && !event.repeat) { event.preventDefault(); finishFishing(); }
    return;
  }
  if (focusPaused) {
    if (['Space','Enter'].includes(code)) { event.preventDefault(); resetInput(); focusPaused = false; $('#resume-overlay').hidden = true; canvas.focus({ preventScroll: true }); }
    return;
  }
  if (movementKeys[code]) { event.preventDefault(); held.add(movementKeys[code]); return; }
  if (event.repeat) return;
  if (code === 'Space') { event.preventDefault(); useTool(); }
  else if (code === 'KeyE') { event.preventDefault(); interact(); }
  else if (/^Digit[1-7]$/.test(code)) { event.preventDefault(); chooseTool(TOOLS[Number(code.slice(-1)) - 1].id); }
  else if (['KeyQ','KeyR'].includes(code)) {
    event.preventDefault(); if (performance.now() < actionUntil) return;
    feedback(core.cycleTool(state, code === 'KeyQ' ? -1 : 1), true);
  } else if (['KeyI','KeyM','KeyJ','KeyK','Escape'].includes(code)) {
    event.preventDefault(); openPanel(({KeyI:'bag',KeyM:'map',KeyJ:'quests',KeyK:'people',Escape:'settings'})[code]);
  }
});
document.addEventListener('keyup', event => { if (movementKeys[inputCode(event)]) held.delete(movementKeys[inputCode(event)]); });
canvas.addEventListener('pointerdown', event => {
  if (!worldActive() || event.button !== 0) return;
  canvas.focus({ preventScroll: true });
  const target = renderer.screenToWorld(event.clientX, event.clientY);
  if (!target.inside) return;
  const dx = target.x - state.player.x; const dy = target.y - state.player.y;
  state.player.facing = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
  useTool();
});
canvas.addEventListener('contextmenu', event => { event.preventDefault(); if (worldActive()) feedback(core.cycleTool(state, 1), true); });
canvas.addEventListener('wheel', event => { if (worldActive()) { event.preventDefault(); feedback(core.cycleTool(state, event.deltaY < 0 ? -1 : 1), true); } }, { passive: false });

document.querySelectorAll('[data-move]').forEach(button => {
  const step = () => {
    if (!worldActive() || performance.now() < actionUntil) return;
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[button.dataset.move];
    feedback(core.movePlayer(state, dx, dy, .12), true);
  };
  button.addEventListener('pointerdown', event => {
    if (!worldActive()) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); step(); held.add(button.dataset.move);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type, () => held.delete(button.dataset.move));
  button.addEventListener('click', event => { if (event.detail === 0) step(); });
});
window.addEventListener('blur', () => { resetInput(); if (booted && !panel) { focusPaused = true; $('#resume-overlay').hidden = false; } if (booted) saveGame(); });
window.addEventListener('focus', () => frameClock.reset());
document.addEventListener('visibilitychange', () => { resetInput(); if (document.hidden && booted) saveGame(); });
window.addEventListener('pagehide', () => { if (booted) saveGame(); });
window.addEventListener('storage', event => {
  if (!booted || event.key !== SAVE_KEY || event.newValue === JSON.stringify(state)) return;
  storageBlocked = true;
  persistentWarning = 'Progress changed in another tab. This tab will not overwrite it. Export if needed, then reload to use the latest save.';
  resetInput();
  openPanel('settings');
  toast(persistentWarning, true);
});

function frame(now) {
  const simulated = booted && document.hasFocus() && !document.hidden && !focusPaused && (!panel || panel === 'fishing');
  const elapsed = frameClock.step(now, simulated);
  if (booted) {
    if (simulated) {
      if (!panel && performance.now() >= actionUntil) {
        const dx = Number(held.has('right')) - Number(held.has('left'));
        const dy = Number(held.has('down')) - Number(held.has('up'));
        if (dx || dy) core.movePlayer(state, dx, dy, elapsed);
      }
      const day = state.day; const gold = state.gold; const hadFish = !!state.fishing;
      const result = core.tick(state, elapsed);
      if (state.day !== day) { saveGame(); showMorning(gold, day, true); }
      else if (panel === 'fishing' && hadFish && !state.fishing) { closePanel(); toast(result?.message || 'The fish got away. Take your time and try again.'); }
      saveElapsed += elapsed;
      if (saveElapsed >= 15) saveGame();
    }
    renderer.draw(state, now, { paused: !simulated });
    hudElapsed += elapsed; mapElapsed += elapsed;
    if (hudElapsed > .15) { renderHud(); updateFishingUI(); hudElapsed = 0; }
    if (mapElapsed > 2) { renderer.drawMap($('#mini-map'), state); mapElapsed = 0; }
  }
  requestAnimationFrame(frame);
}

async function start() {
  state = loadState();
  const assets = {};
  const failed = [];
  await Promise.all(['hero','plant','villagers','robot','items','logo'].map(name => new Promise(resolve => {
    const image = new Image();
    image.onload = () => { assets[name] = image; resolve(); };
    image.onerror = () => { assets[name] = null; failed.push(name); resolve(); };
    image.src = `./assets/${name}.webp`;
  })));
  renderer = createRenderer(canvas, assets);
  booted = true;
  $('#loading-overlay').hidden = true;
  renderHud(); renderer.drawMap($('#mini-map'), state);
  if (persistentWarning) toast(persistentWarning, true);
  else if (failed.length) toast('Some images could not load. You can still play using fallback artwork.', true);
  if (state.battle) openPanel('battle');
  else if (state.fishing) { core.cancelFishing(state); saveGame(); }
  saveGame();
  frameClock.reset(); requestAnimationFrame(frame);
}

start().catch(error => {
  console.error('Meadow Days could not start', error);
  $('#loading-overlay').innerHTML = '<div class="load-error"><strong>The farm could not open.</strong><p>There was a problem loading the game. Your previous save has not been deleted. Reload to try again.</p><button class="primary-button" id="retry-load">Reload</button></div>';
  $('#retry-load').addEventListener('click', () => location.reload());
});
