import {
  CROPS,
  MAP_HEIGHT,
  MAP_WIDTH,
  MONSTER_TYPES,
  SEASONS,
  TILE,
  VILLAGERS,
} from './data.js';
import { WORLD, getNpcPosition, regionAt, tileAt } from './world.js';
import { canvasPoint } from './pointer.js';

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 600;
const TAU = Math.PI * 2;
const CANVAS_FONT = 'Arial, sans-serif';
const SEASON_ART = [
  { grass: ['#8db46b', '#90b76e', '#8ab168'], light: '#bbd58e', dark: '#6e9655', leaf: ['#315e42', '#42794d', '#5c935a', '#91b775'] },
  { grass: ['#82ad62', '#85b165', '#7da85e'], light: '#b2cf80', dark: '#60874d', leaf: ['#28593f', '#3b704a', '#568857', '#88ae65'] },
  { grass: ['#9cae58', '#b1b762', '#8e9f4e'], light: '#d5ca76', dark: '#657844', leaf: ['#6e6940', '#a2633d', '#c47a43', '#dda35c'] },
  { grass: ['#afc7ad', '#bfd2bd', '#9ebaa6'], light: '#e0e9d9', dark: '#779686', leaf: ['#385f58', '#4d7667', '#789f85', '#cadcc8'] },
];
const SEASON_ALIASES = Object.freeze({ spring: 0, summer: 1, autumn: 2, fall: 2, winter: 3 });

const CROP_COLORS = ['#e47754', '#e9bd55', '#bc74a7', '#e5e0bb', '#ef7e68', '#d9a84f', '#9bcf66', '#b1d5d9'];
const ROOF_COLORS = {
  terracotta: '#b85642', red: '#b85642', rust: '#a94d3c', orange: '#be6546',
  blue: '#537b91', slate: '#526978', teal: '#477f78', green: '#557d4e',
  brown: '#795541', wood: '#795541', purple: '#7a6187', gold: '#b78649',
  shingle: '#805742',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hashFloat(x, y, salt = 0) {
  let value = Math.imul((x | 0) + salt * 13, 374761393);
  value = Math.imul(value ^ Math.imul((y | 0) + salt * 7, 668265263), 1274126177);
  value = Math.imul(value ^ (value >>> 13), 2246822519);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function seasonNumber(state) {
  const value = state?.season;
  if (Number.isFinite(Number(value))) return clamp(Math.floor(Number(value)), 0, 3);
  const name = String(value ?? '').trim().toLowerCase();
  const index = Array.isArray(SEASONS)
    ? SEASONS.findIndex((season) => String(season).trim().toLowerCase() === name)
    : -1;
  const alias = SEASON_ALIASES[name];
  return index >= 0 ? index : (Number.isInteger(alias) ? alias : 0);
}

function colorShade(color, fallback, delta) {
  const source = typeof color === 'string' ? color.trim() : '';
  const match = /^#?([\da-f]{6})$/i.exec(source);
  if (!match) return fallback;
  const hex = match[1];
  const channels = [0, 2, 4].map((offset) => clamp(parseInt(hex.slice(offset, offset + 2), 16) + delta, 0, 255));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function cellCenter(value) {
  const number = finite(value);
  return Number.isInteger(number) ? number + 0.5 : number;
}

function isImageReady(image) {
  if (!image) return false;
  return finite(image.naturalWidth ?? image.width) > 0 && finite(image.naturalHeight ?? image.height) > 0;
}

function cropKind(id) {
  const key = String(id ?? '').toLowerCase();
  if (/(turnip|radish|carrot|potato|beet|onion|parsnip)/.test(key)) return 'root';
  if (/(snow[_ -]?pea|pea|bean)/.test(key)) return 'pod';
  if (/(tomato|eggplant|berry|pepper|strawberry|grape)/.test(key)) return 'fruit';
  if (/(wheat|rice|corn|grain|barley)/.test(key)) return 'grain';
  if (/(pumpkin|melon|cabbage|cauliflower|broccoli)/.test(key)) return 'bulb';
  return 'leaf';
}

export function createRenderer(canvas, assets = {}) {
  if (!canvas?.getContext) throw new TypeError('createRenderer expects a canvas element');
  if (canvas.width !== VIEW_WIDTH) canvas.width = VIEW_WIDTH;
  if (canvas.height !== VIEW_HEIGHT) canvas.height = VIEW_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('A 2D canvas context is required');
  ctx.imageSmoothingEnabled = false;

  const mapWidth = Math.max(1, Math.floor(finite(WORLD?.width, MAP_WIDTH)));
  const mapHeight = Math.max(1, Math.floor(finite(WORLD?.height, MAP_HEIGHT)));
  const visibleWidth = VIEW_WIDTH / TILE;
  const visibleHeight = VIEW_HEIGHT / TILE;
  const camera = {
    x: 0,
    y: 0,
    width: visibleWidth,
    height: visibleHeight,
    pixelX: 0,
    pixelY: 0,
    targetX: 0,
    targetY: 0,
  };

  let cameraReady = false;
  let previousNow = null;
  let lastActiveVisualTime = null;
  let previousPlayer = null;
  let playerMovingUntil = 0;
  let cachedSoilBounds = null;
  let soilBoundsScanned = false;
  let cachedCoastPier;
  let coastPierScanned = false;

  function safeTileAt(x, y) {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return 'wall';
    try {
      const value = tileAt(x, y);
      return typeof value === 'string' ? value.toLowerCase() : 'grass';
    } catch {
      return 'grass';
    }
  }

  function safeRegionAt(x, y) {
    try {
      return regionAt(x, y) ?? null;
    } catch {
      return null;
    }
  }

  function getSeason(state) {
    return SEASON_ART[seasonNumber(state)];
  }

  function getLighting(state) {
    const season = seasonNumber(state);
    const minute = clamp(finite(state?.minute, 720), 0, 1440);
    const sunset = [1080, 1200, 1080, 990][season];
    let darkness = 0;
    let warmth = 0;

    if (minute < 360) darkness = 0.3 * (1 - minute / 360);
    else if (minute < 480) warmth = 0.1 * (1 - (minute - 360) / 120);

    if (minute >= sunset) {
      const dusk = clamp((minute - sunset) / 90, 0, 1);
      darkness = Math.max(darkness, (season === 3 ? 0.31 : 0.27) * dusk);
      warmth = Math.max(warmth, 0.1 * (1 - dusk));
    } else if (minute >= sunset - 90) {
      warmth = Math.max(warmth, 0.12 * ((minute - (sunset - 90)) / 90));
    }

    const weather = String(state?.weather ?? '').toLowerCase();
    if (weather.includes('rain')) darkness += 0.045;
    else if (weather.includes('cloud')) darkness += 0.025;

    return { darkness: clamp(darkness, 0, 0.34), warmth: clamp(warmth, 0, 0.14), minute, season, weather };
  }

  function updateCamera(player, now, paused) {
    const targetX = clamp(player.x - visibleWidth / 2, 0, Math.max(0, mapWidth - visibleWidth));
    const targetY = clamp(player.y - visibleHeight / 2, 0, Math.max(0, mapHeight - visibleHeight));
    camera.targetX = targetX;
    camera.targetY = targetY;

    const dt = previousNow === null ? 1 / 60 : clamp((now - previousNow) / 1000, 0, 0.1);
    previousNow = now;
    if (!cameraReady) {
      camera.x = targetX;
      camera.y = targetY;
      cameraReady = true;
    } else if (!paused) {
      const follow = 1 - Math.exp(-dt * 10);
      camera.x += (targetX - camera.x) * follow;
      camera.y += (targetY - camera.y) * follow;
    }

    camera.pixelX = Math.round(camera.x * TILE);
    camera.pixelY = Math.round(camera.y * TILE);
    camera.x = camera.pixelX / TILE;
    camera.y = camera.pixelY / TILE;
  }

  function drawSprite(image, index, cellSize, x, feetY, width, height, flip = false, alpha = 1) {
    if (!isImageReady(image)) return false;
    const imageWidth = finite(image.naturalWidth ?? image.width);
    const imageHeight = finite(image.naturalHeight ?? image.height);
    const frames = Math.floor(imageWidth / cellSize);
    if (frames < 1 || imageHeight < cellSize) return false;
    const frame = clamp(Math.floor(finite(index)), 0, frames - 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, feetY);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(image, frame * cellSize, 0, cellSize, cellSize, -width / 2, -height, width, height);
    ctx.restore();
    return true;
  }

  function drawItemIcon(index, x, y, size) {
    if (!drawSprite(assets.items, index, 64, x, y + size, size, size)) return false;
    return true;
  }

  function drawShadow(x, y, width = 22, height = 7, alpha = 0.23) {
    ctx.save();
    ctx.fillStyle = `rgba(28, 46, 32, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, width / 2, height / 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawLabel(text, x, y, options = {}) {
    const label = String(text ?? '').trim();
    if (!label) return;
    const size = finite(options.size, 10);
    ctx.save();
    ctx.font = `600 ${size}px ${CANVAS_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = Math.min(finite(options.maxWidth, 156), Math.max(38, ctx.measureText(label).width + 14));
    const height = size + 8;
    ctx.fillStyle = options.background ?? 'rgba(31, 61, 48, 0.9)';
    ctx.fillRect(Math.round(x - width / 2), Math.round(y - height / 2), Math.round(width), Math.round(height));
    ctx.strokeStyle = options.border ?? 'rgba(238, 221, 171, 0.92)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x - width / 2) + 0.5, Math.round(y - height / 2) + 0.5, Math.round(width) - 1, Math.round(height) - 1);
    ctx.fillStyle = options.color ?? '#fff3d6';
    ctx.fillText(label, x, y + 0.5, width - 8);
    ctx.restore();
  }

  function drawGrassTile(x, y, sx, sy, season) {
    const variations = season.grass;
    ctx.fillStyle = variations[Math.floor(hashFloat(x, y, 1) * variations.length)];
    ctx.fillRect(sx, sy, TILE, TILE);

    ctx.fillStyle = season.dark;
    for (let i = 0; i < 3; i += 1) {
      if (hashFloat(x, y, 10 + i) < 0.35) continue;
      const px = sx + 2 + Math.floor(hashFloat(x, y, 20 + i) * (TILE - 5));
      const py = sy + 2 + Math.floor(hashFloat(x, y, 30 + i) * (TILE - 6));
      ctx.fillRect(px, py, 2, 2 + (i % 2));
    }
    ctx.fillStyle = season.light;
    for (let i = 0; i < 3; i += 1) {
      if (hashFloat(x, y, 40 + i) < 0.4) continue;
      const px = sx + 3 + Math.floor(hashFloat(x, y, 50 + i) * (TILE - 6));
      const py = sy + 3 + Math.floor(hashFloat(x, y, 60 + i) * (TILE - 6));
      ctx.fillRect(px, py, 2, 1);
    }

    const tuft = hashFloat(x, y, 70);
    if (tuft > 0.94) {
      ctx.fillStyle = season.dark;
      ctx.fillRect(sx + 12, sy + 17, 2, 8);
      ctx.fillRect(sx + 8, sy + 18, 3, 2);
      ctx.fillRect(sx + 15, sy + 15, 3, 2);
    } else if (tuft < 0.055) {
      const flower = ['#f8e5a2', '#f2d7c6', '#eab2a6', '#d5c1ed'][Math.floor(hashFloat(x, y, 71) * 4)];
      const fx = sx + 7 + Math.floor(hashFloat(x, y, 72) * 17);
      const fy = sy + 7 + Math.floor(hashFloat(x, y, 73) * 17);
      ctx.fillStyle = season.dark;
      ctx.fillRect(fx + 1, fy + 3, 2, 4);
      ctx.fillStyle = flower;
      ctx.fillRect(fx, fy + 1, 4, 3);
      ctx.fillStyle = '#f4d570';
      ctx.fillRect(fx + 1, fy + 2, 2, 1);
    }

    if (season === SEASON_ART[3] && hashFloat(x, y, 74) > 0.45) {
      ctx.fillStyle = 'rgba(246, 250, 235, 0.6)';
      ctx.fillRect(sx + 1, sy + 1, TILE - 2, 2);
    }
  }

  function drawPathTile(x, y, sx, sy, season) {
    const base = season === SEASON_ART[3] ? '#b5aa82' : season === SEASON_ART[2] ? '#b28c5e' : '#b79869';
    ctx.fillStyle = base;
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = 'rgba(89, 69, 45, 0.18)';
    ctx.fillRect(sx, sy + TILE - 2, TILE, 2);

    const paved = hashFloat(x, y, 80) > 0.66;
    for (let i = 0; i < 8; i += 1) {
      const px = sx + 2 + Math.floor(hashFloat(x, y, 90 + i) * 27);
      const py = sy + 3 + Math.floor(hashFloat(x, y, 100 + i) * 25);
      const color = paved
        ? (i % 2 ? 'rgba(230, 214, 176, 0.42)' : 'rgba(127, 99, 67, 0.24)')
        : (i % 2 ? 'rgba(229, 201, 148, 0.52)' : 'rgba(125, 91, 55, 0.3)');
      ctx.fillStyle = color;
      ctx.fillRect(px, py, paved ? 6 : 2 + (i % 2), paved ? 3 : 2);
    }
    if (paved) {
      ctx.fillStyle = 'rgba(239, 224, 194, 0.34)';
      ctx.fillRect(sx + (hashFloat(x, y, 111) > 0.5 ? 17 : 5), sy + 14, 8, 1);
    }
  }

  function drawSoilTile(x, y, sx, sy, season, watered = false) {
    const dry = season === SEASON_ART[3] ? '#826c53' : season === SEASON_ART[2] ? '#825d3b' : '#8f623c';
    ctx.fillStyle = watered ? '#654c3a' : dry;
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = watered ? 'rgba(37, 70, 62, 0.48)' : 'rgba(61, 42, 28, 0.32)';
    for (let row = 0; row < 4; row += 1) {
      ctx.fillRect(sx + 2, sy + 5 + row * 7, TILE - 4, row % 2 ? 2 : 1);
    }
    ctx.fillStyle = watered ? 'rgba(189, 209, 164, 0.16)' : 'rgba(227, 180, 117, 0.2)';
    ctx.fillRect(sx + 2, sy + 3, TILE - 4, 1);
    for (let i = 0; i < 3; i += 1) {
      const px = sx + 4 + Math.floor(hashFloat(x, y, 120 + i) * 24);
      const py = sy + 4 + Math.floor(hashFloat(x, y, 130 + i) * 24);
      ctx.fillStyle = watered ? 'rgba(122, 155, 133, 0.28)' : 'rgba(57, 39, 27, 0.34)';
      ctx.fillRect(px, py, 2, 1);
    }
  }

  function drawSandTile(x, y, sx, sy, season) {
    ctx.fillStyle = season === SEASON_ART[3] ? '#d5d0ae' : '#ddc98e';
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = 'rgba(255, 242, 192, 0.34)';
    ctx.fillRect(sx, sy, TILE, 3);
    for (let i = 0; i < 5; i += 1) {
      const px = sx + 3 + Math.floor(hashFloat(x, y, 140 + i) * 26);
      const py = sy + 4 + Math.floor(hashFloat(x, y, 150 + i) * 24);
      ctx.fillStyle = i % 2 ? 'rgba(156, 123, 74, 0.28)' : 'rgba(255, 239, 180, 0.55)';
      ctx.fillRect(px, py, 2 + (i % 3), 1);
    }
    if (hashFloat(x, y, 159) > 0.94) {
      ctx.fillStyle = '#fff4d2';
      ctx.fillRect(sx + 11, sy + 16, 5, 2);
      ctx.fillRect(sx + 12, sy + 14, 2, 6);
      ctx.fillStyle = '#d9a86d';
      ctx.fillRect(sx + 13, sy + 16, 2, 2);
    }
  }

  function drawWaterTile(x, y, sx, sy, now, season) {
    const winter = season === SEASON_ART[3];
    ctx.fillStyle = winter ? '#548c99' : '#398b91';
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = winter ? '#477b88' : '#347a84';
    ctx.fillRect(sx, sy + 20, TILE, 12);

    const phase = Math.floor(now / 570 + hashFloat(x, y, 170) * 6);
    const rippleX = clamp(((phase * 7 + x * 5) % TILE) - 4, 2, TILE - 10);
    ctx.fillStyle = 'rgba(53, 113, 124, 0.38)';
    ctx.fillRect(sx + 4, sy + 8 + (y % 3) * 3, 15, 2);
    ctx.fillStyle = 'rgba(174, 220, 202, 0.58)';
    ctx.fillRect(sx + rippleX, sy + 7 + (y % 3) * 3, 8, 2);
    ctx.fillRect(sx + ((rippleX + 19) % TILE), sy + 21 + (x % 2) * 4, 5, 1);
    ctx.fillStyle = 'rgba(213, 240, 214, 0.48)';
    if (hashFloat(x, y, 171) > 0.56) ctx.fillRect(sx + 20, sy + 12, 6, 1);

    const edges = [
      { dx: 0, dy: -1, x: sx, y: sy, w: TILE, h: 2, stripX: sx + 3, stripY: sy + 2, stripW: TILE - 6, stripH: 1 },
      { dx: 0, dy: 1, x: sx, y: sy + TILE - 2, w: TILE, h: 2, stripX: sx + 4, stripY: sy + TILE - 4, stripW: TILE - 8, stripH: 1 },
      { dx: -1, dy: 0, x: sx, y: sy, w: 2, h: TILE, stripX: sx + 2, stripY: sy + 5, stripW: 1, stripH: TILE - 10 },
      { dx: 1, dy: 0, x: sx + TILE - 2, y: sy, w: 2, h: TILE, stripX: sx + TILE - 4, stripY: sy + 6, stripW: 1, stripH: TILE - 12 },
    ];
    for (const edge of edges) {
      const neighbor = safeTileAt(x + edge.dx, y + edge.dy);
      if (neighbor === 'water' || neighbor === 'bridge') continue;
      ctx.fillStyle = 'rgba(225, 224, 173, 0.35)';
      ctx.fillRect(edge.x, edge.y, edge.w, edge.h);
      ctx.fillStyle = 'rgba(205, 234, 201, 0.48)';
      ctx.fillRect(edge.stripX, edge.stripY, edge.stripW, edge.stripH);
    }

    const corners = [
      { left: true, top: true, neighbors: [[x - 1, y], [x, y - 1]] },
      { left: false, top: true, neighbors: [[x + 1, y], [x, y - 1]] },
      { left: true, top: false, neighbors: [[x - 1, y], [x, y + 1]] },
      { left: false, top: false, neighbors: [[x + 1, y], [x, y + 1]] },
    ];
    for (const corner of corners) {
      const exposed = corner.neighbors.every(([nx, ny]) => !['water', 'bridge'].includes(safeTileAt(nx, ny)));
      if (!exposed) continue;
      for (let step = 0; step < 4; step += 1) {
        const size = 8 - step * 2;
        const px = corner.left ? sx : sx + TILE - size;
        const py = corner.top ? sy + step * 2 : sy + TILE - (step + 1) * 2;
        ctx.fillStyle = step % 2 ? 'rgba(226, 209, 153, 0.92)' : 'rgba(218, 199, 141, 0.94)';
        ctx.fillRect(px, py, size, 2);
      }
    }
  }

  function drawStoneTile(x, y, sx, sy, wall = false) {
    if (wall) {
      ctx.fillStyle = '#555e56';
      ctx.fillRect(sx, sy, TILE, TILE);
      ctx.fillStyle = '#788071';
      ctx.fillRect(sx, sy, TILE, 8);
      ctx.fillStyle = '#434b47';
      ctx.fillRect(sx, sy + 8, TILE, 4);
      ctx.fillStyle = '#606b62';
      ctx.fillRect(sx + 2, sy + 12, TILE - 4, TILE - 12);
      ctx.fillStyle = 'rgba(212, 213, 174, 0.18)';
      ctx.fillRect(sx + 4, sy + 2, 9, 2);
      ctx.fillRect(sx + 19, sy + 13, 2, 8);
      ctx.fillStyle = 'rgba(35, 42, 41, 0.42)';
      ctx.fillRect(sx + 3, sy + 24, TILE - 6, 3);
      return;
    }
    ctx.fillStyle = '#858c7b';
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = '#939887';
    ctx.fillRect(sx + 1, sy + 2, TILE - 2, TILE - 4);
    for (let i = 0; i < 5; i += 1) {
      const px = sx + 3 + Math.floor(hashFloat(x, y, 180 + i) * 25);
      const py = sy + 4 + Math.floor(hashFloat(x, y, 190 + i) * 22);
      ctx.fillStyle = i % 2 ? '#747c70' : '#adb09a';
      ctx.fillRect(px, py, 3 + (i % 3), 2 + (i % 2));
    }
    ctx.fillStyle = 'rgba(245, 244, 215, 0.3)';
    ctx.fillRect(sx + 6, sy + 6, 7, 2);
  }

  function drawFenceTile(sx, sy, horizontal) {
    drawShadow(sx + TILE / 2, sy + TILE - 2, 24, 6, 0.16);
    ctx.fillStyle = '#68482f';
    if (horizontal) {
      ctx.fillRect(sx, sy + 10, TILE, 4);
      ctx.fillRect(sx, sy + 20, TILE, 4);
      ctx.fillRect(sx + 6, sy + 5, 5, 24);
      ctx.fillRect(sx + 22, sy + 5, 5, 24);
      ctx.fillStyle = '#c28a52';
      ctx.fillRect(sx, sy + 9, TILE, 3);
      ctx.fillRect(sx, sy + 19, TILE, 3);
      ctx.fillRect(sx + 7, sy + 5, 3, 22);
      ctx.fillRect(sx + 23, sy + 5, 3, 22);
    } else {
      ctx.fillRect(sx + 8, sy, 4, TILE);
      ctx.fillRect(sx + 20, sy, 4, TILE);
      ctx.fillRect(sx + 4, sy + 6, 24, 5);
      ctx.fillRect(sx + 4, sy + 21, 24, 5);
      ctx.fillStyle = '#c28a52';
      ctx.fillRect(sx + 8, sy, 3, TILE);
      ctx.fillRect(sx + 19, sy, 3, TILE);
      ctx.fillRect(sx + 4, sy + 7, 24, 3);
      ctx.fillRect(sx + 4, sy + 22, 24, 3);
    }
  }

  function isFarmWall(x, y) {
    const nearbySoil = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
    ].some(([nx, ny]) => safeTileAt(nx, ny) === 'soil');
    return nearbySoil && safeRegionAt(x, y)?.id === 'farm';
  }

  function drawTile(x, y, type, sx, sy, now, season) {
    switch (type) {
      case 'water':
        drawWaterTile(x, y, sx, sy, now, season);
        break;
      case 'bridge': {
        drawWaterTile(x, y, sx, sy, now, season);
        const horizontal = ['bridge', 'path'].includes(safeTileAt(x - 1, y)) || ['bridge', 'path'].includes(safeTileAt(x + 1, y));
        ctx.fillStyle = '#704c32';
        if (horizontal) {
          ctx.fillRect(sx + 1, sy + 4, TILE - 2, TILE - 8);
          ctx.fillStyle = '#b77f4b';
          ctx.fillRect(sx + 1, sy + 4, TILE - 2, 3);
          ctx.fillRect(sx + 1, sy + TILE - 7, TILE - 2, 3);
          for (let line = 0; line < 4; line += 1) {
            ctx.fillStyle = line % 2 ? '#865a37' : '#9b6b40';
            ctx.fillRect(sx + 4 + line * 6, sy + 7, 2, TILE - 14);
          }
          ctx.fillStyle = '#d2a16a';
          ctx.fillRect(sx + 2, sy + 7, TILE - 4, 2);
          ctx.fillRect(sx + 2, sy + TILE - 9, TILE - 4, 2);
        } else {
          ctx.fillRect(sx + 4, sy + 1, TILE - 8, TILE - 2);
          ctx.fillStyle = '#b77f4b';
          ctx.fillRect(sx + 4, sy + 1, 3, TILE - 2);
          ctx.fillRect(sx + TILE - 7, sy + 1, 3, TILE - 2);
          for (let line = 0; line < 4; line += 1) {
            ctx.fillStyle = line % 2 ? '#865a37' : '#9b6b40';
            ctx.fillRect(sx + 7, sy + 4 + line * 6, TILE - 14, 2);
          }
        }
        break;
      }
      case 'path':
        if ((safeTileAt(x, y - 1) === 'water' && safeTileAt(x, y + 1) === 'water')
          || (safeTileAt(x - 1, y) === 'water' && safeTileAt(x + 1, y) === 'water')) {
          drawTile(x, y, 'bridge', sx, sy, now, season);
        } else {
          drawPathTile(x, y, sx, sy, season);
        }
        break;
      case 'soil':
        drawSoilTile(x, y, sx, sy, season);
        break;
      case 'sand':
        drawSandTile(x, y, sx, sy, season);
        break;
      case 'stone':
        drawStoneTile(x, y, sx, sy);
        break;
      case 'wall':
        if (isFarmWall(x, y)) drawFenceTile(sx, sy, safeTileAt(x - 1, y) === 'soil' || safeTileAt(x + 1, y) === 'soil');
        else drawStoneTile(x, y, sx, sy, true);
        break;
      case 'tree':
        drawGrassTile(x, y, sx, sy, season);
        ctx.fillStyle = 'rgba(47, 73, 42, 0.28)';
        ctx.fillRect(sx + 4, sy + 22, TILE - 8, 7);
        break;
      case 'flower':
        drawGrassTile(x, y, sx, sy, season);
        ctx.fillStyle = '#3c8050';
        ctx.fillRect(sx + 15, sy + 16, 2, 8);
        ctx.fillStyle = '#ed9f9b';
        ctx.fillRect(sx + 12, sy + 14, 7, 4);
        ctx.fillStyle = '#f2da77';
        ctx.fillRect(sx + 14, sy + 15, 3, 2);
        break;
      default:
        drawGrassTile(x, y, sx, sy, season);
        break;
    }
  }

  function drawPlotOverlay(x, y, plot, sx, sy, season) {
    if (!plot || typeof plot !== 'object') return;
    const crop = plot.crop && typeof plot.crop === 'object' ? plot.crop : null;
    if (!plot.tilled && !crop) return;
    drawSoilTile(x, y, sx, sy, season, plot.watered === true);
    ctx.strokeStyle = 'rgba(224, 189, 135, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 2.5, sy + 2.5, TILE - 5, TILE - 5);
  }

  function drawCrop(crop, x, y, now, tileX, tileY, season) {
    const id = String(crop.id ?? 'seed');
    const definition = CROPS?.[id] ?? null;
    const color = typeof definition?.color === 'string'
      ? definition.color
      : CROP_COLORS[Math.floor(hashFloat(tileX, tileY, id.length) * CROP_COLORS.length)];
    const kind = cropKind(id);
    const remaining = finite(crop.remaining, NaN);
    const growth = finite(definition?.growth, NaN);
    const mature = crop.ready === true;
    const stage = mature ? 1 : Number.isFinite(remaining) && Number.isFinite(growth) && growth > 0
      ? clamp((growth - remaining) / growth, 0.16, 0.94)
      : 0.48;
    const dead = crop.withered === true;
    const centerX = x + TILE / 2;
    const groundY = y + TILE - 3;
    const sway = mature || stage > 0.45 ? Math.round(Math.sin(now / 510 + tileX * 0.8 + tileY) * 1.2) : 0;
    const plantHeight = Math.round(8 + stage * 18);
    const stem = dead ? '#80694d' : '#34734a';
    const leaf = dead ? '#95835f' : (season === SEASON_ART[3] ? '#557c63' : '#4f9d58');

    drawShadow(centerX, groundY + 1, 17, 5, 0.17);
    ctx.fillStyle = stem;
    ctx.fillRect(centerX - 2, groundY - plantHeight, 4, plantHeight);

    if (kind === 'grain') {
      for (let side = -1; side <= 1; side += 1) {
        const top = groundY - plantHeight + 6 + Math.abs(side) * 4;
        ctx.fillStyle = dead ? '#a98b55' : '#578f4e';
        ctx.fillRect(centerX + side * 5 + sway, top + 5, 3, plantHeight - 7);
        ctx.fillStyle = mature ? '#d6b455' : leaf;
        ctx.fillRect(centerX + side * 5 + sway - 2, top, 7, mature ? 8 : 5);
      }
      if (mature) {
        ctx.fillStyle = '#f0d47c';
        ctx.fillRect(centerX - 7 + sway, groundY - plantHeight + 3, 2, 3);
        ctx.fillRect(centerX + 5 + sway, groundY - plantHeight + 1, 2, 3);
      }
      if (!dead && id === 'corn' && stage > 0.42) {
        const cobY = groundY - plantHeight * 0.48;
        ctx.fillStyle = '#517f48';
        ctx.fillRect(centerX - 9 + sway, cobY, 7, 4);
        ctx.fillRect(centerX + 3 + sway, cobY - 5, 7, 4);
        ctx.fillStyle = mature ? '#f0c84d' : '#d5ad4c';
        ctx.fillRect(centerX - 7 + sway, cobY - 1, 5, 4);
        ctx.fillRect(centerX + 4 + sway, cobY - 6, 5, 4);
      }
    } else {
      const leafHeight = Math.max(4, Math.floor(plantHeight * 0.45));
      ctx.fillStyle = dead ? '#8a7654' : leaf;
      ctx.fillRect(centerX - 12 + sway, groundY - plantHeight + leafHeight, 9, 5);
      ctx.fillRect(centerX + 4 + sway, groundY - plantHeight + 3, 9, 5);
      ctx.fillRect(centerX - 8 - sway, groundY - plantHeight - 1, 8, 5);
      if (stage > 0.55) {
        ctx.fillRect(centerX - 14 + sway, groundY - plantHeight + 9, 7, 4);
        ctx.fillRect(centerX + 7 + sway, groundY - plantHeight + 10, 8, 4);
      }

      if (kind === 'pod') {
        ctx.fillStyle = dead ? '#7f7157' : '#795b3d';
        ctx.fillRect(centerX - 11, groundY - plantHeight - 2, 2, plantHeight + 1);
        ctx.fillRect(centerX + 9, groundY - plantHeight - 2, 2, plantHeight + 1);
        ctx.fillStyle = dead ? '#9b8a68' : '#d2b07a';
        ctx.fillRect(centerX - 12, groundY - plantHeight, 24, 2);
      }

      if (!dead && stage > 0.42) {
        const produceY = Math.round(groundY - (kind === 'root' ? 7 : plantHeight * 0.48));
        const produceSize = Math.round(7 + stage * 4);
        const produceLeft = centerX - Math.floor(produceSize / 2);
        ctx.fillStyle = color;
        if (kind === 'root') {
          ctx.fillRect(produceLeft, produceY, produceSize, Math.max(5, produceSize - 4));
          ctx.fillStyle = colorShade(color, '#d3b58a', -28);
          ctx.fillRect(centerX - 1, groundY - 1, 2, 3);
        } else if (kind === 'bulb') {
          ctx.fillRect(produceLeft, produceY - 1, produceSize, Math.max(7, produceSize - 1));
          ctx.fillRect(produceLeft + 2, produceY - 3, produceSize - 4, 3);
          ctx.fillStyle = colorShade(color, '#91b66f', -24);
          ctx.fillRect(centerX - 2, produceY, 2, produceSize - 1);
          ctx.fillRect(centerX + 3, produceY + 1, 2, produceSize - 2);
        } else if (kind === 'fruit') {
          if (id === 'eggplant') {
            ctx.fillRect(centerX - 3, produceY, 7, 10);
            ctx.fillRect(centerX - 1, produceY + 8, 4, 3);
            ctx.fillStyle = '#4e8650';
            ctx.fillRect(centerX - 4, produceY - 2, 8, 3);
            ctx.fillRect(centerX - 1, produceY - 4, 2, 3);
            ctx.fillStyle = '#f6e9c5';
            ctx.fillRect(centerX - 1, produceY + 2, 2, 2);
          } else {
            ctx.fillRect(centerX - 7, produceY + 3, 7, 7);
            ctx.fillRect(centerX + 1, produceY, 7, 7);
            ctx.fillStyle = '#fff0c6';
            ctx.fillRect(centerX - 5, produceY + 4, 2, 2);
            ctx.fillRect(centerX + 3, produceY + 1, 2, 2);
          }
        } else if (kind === 'pod') {
          for (const side of [-1, 1]) {
            const podY = produceY + (side < 0 ? 1 : 6);
            ctx.fillRect(centerX + side * 6 - 3, podY, 7, 3);
            ctx.fillStyle = '#e9edb7';
            ctx.fillRect(centerX + side * 6 - 1, podY + 1, 1, 1);
            ctx.fillStyle = color;
          }
        }
        ctx.fillStyle = dead ? '#95835f' : '#3b7e4a';
        ctx.fillRect(centerX - 2, groundY - plantHeight - 2, 4, 5);
      }
    }

    if (dead) {
      ctx.fillStyle = '#65513e';
      ctx.fillRect(centerX - 8, groundY - 3, 5, 2);
      ctx.fillRect(centerX + 4, groundY - 5, 6, 2);
    } else if (mature) {
      const blink = 0.5 + (Math.sin(now / 310 + tileX * 2) + 1) * 0.25;
      ctx.fillStyle = `rgba(255, 239, 164, ${blink})`;
      ctx.fillRect(centerX + 10, groundY - plantHeight - 7, 2, 2);
      ctx.fillRect(centerX + 9, groundY - plantHeight - 3, 4, 1);
    }
  }

  function drawPersonFallback(x, feetY, mainColor, frame = 0, flip = false) {
    ctx.save();
    ctx.translate(x, feetY);
    if (flip) ctx.scale(-1, 1);
    const step = frame % 2 ? 2 : 0;
    ctx.fillStyle = '#563f37';
    ctx.fillRect(-12, -9 + step, 9, 7);
    ctx.fillRect(3, -9 - step, 9, 7);
    ctx.fillStyle = mainColor;
    ctx.fillRect(-14, -31, 28, 21);
    ctx.fillStyle = colorShade(mainColor, '#588264', -26);
    ctx.fillRect(-14, -14, 28, 4);
    ctx.fillRect(-19, -29, 5, 15);
    ctx.fillRect(14, -29, 5, 15);
    ctx.fillStyle = '#f0c49a';
    ctx.fillRect(-10, -49, 20, 18);
    ctx.fillStyle = '#614534';
    ctx.fillRect(-11, -52, 22, 7);
    ctx.fillRect(-9, -55, 18, 4);
    ctx.fillStyle = '#493a34';
    ctx.fillRect(-6, -44, 2, 2);
    ctx.fillRect(4, -44, 2, 2);
    ctx.fillStyle = '#fff0c6';
    ctx.fillRect(-12, -33, 24, 3);
    ctx.restore();
  }

  function drawHero(player, now, moving) {
    const x = player.x * TILE - camera.pixelX;
    const y = player.y * TILE - camera.pixelY;
    const facing = String(player.facing ?? 'down').toLowerCase();
    const flip = facing === 'left';
    const bob = moving ? Math.round(Math.abs(Math.sin(now / 95)) * 2) : 0;
    const frame = moving ? (Math.floor(now / 180) % 2 ? 14 : 15) : 0;
    drawShadow(x, y + 1, 25, 8, 0.28);
    if (!drawSprite(assets.hero, frame, 96, x, y - bob, 47, 53, flip)) {
      drawPersonFallback(x, y - bob, '#668b67', frame, flip);
    }
  }

  function drawNpc(npc, position, index, player, now) {
    if (!position || !Number.isFinite(Number(position.x)) || !Number.isFinite(Number(position.y))) return;
    const x = cellCenter(position.x) * TILE - camera.pixelX;
    const y = cellCenter(position.y) * TILE - camera.pixelY;
    const playerDistance = Math.hypot(cellCenter(position.x) - player.x, cellCenter(position.y) - player.y);
    const destination = position.destination;
    const activity = String(position.activity ?? '').toLowerCase();
    const moving = /\b(walk|patrol|explor|wander|roam|head|travel)/.test(activity)
      || (destination && Number.isFinite(Number(destination.x)) && Number.isFinite(Number(destination.y))
      && Math.hypot(Number(destination.x) - Number(position.x), Number(destination.y) - Number(position.y)) > 0.08);
    const frame = index * 8 + (moving ? 1 + Math.floor(now / 180 + index) % 7 : 0);
    const color = typeof npc.color === 'string' ? npc.color : '#779a74';

    drawShadow(x, y + 1, 23, 7, 0.23);
    if (!drawSprite(assets.villagers, frame, 96, x, y, 45, 52, false)) {
      drawPersonFallback(x, y, color, Math.floor(now / 250), false);
    }
    if (playerDistance < 5.8) drawLabel(npc.name, x, y - 59, { size: 9, maxWidth: 106 });
  }

  function drawChicken(animal, now) {
    const tx = finite(animal.x);
    const ty = finite(animal.y);
    const x = cellCenter(tx) * TILE - camera.pixelX;
    const y = cellCenter(ty) * TILE - camera.pixelY;
    const bob = Math.round(Math.max(0, Math.sin(now / 170 + tx * 1.4)) * 2);
    drawShadow(x, y + 2, 25, 7, 0.22);
    ctx.fillStyle = '#eed6aa';
    ctx.fillRect(x - 12, y - 15 + bob, 24, 14);
    ctx.fillRect(x - 7, y - 21 + bob, 14, 11);
    ctx.fillStyle = '#fff7e5';
    ctx.fillRect(x - 10, y - 14 + bob, 19, 8);
    ctx.fillRect(x - 5, y - 19 + bob, 9, 5);
    ctx.fillStyle = '#df654b';
    ctx.fillRect(x - 4, y - 25 + bob, 3, 5);
    ctx.fillRect(x, y - 26 + bob, 3, 6);
    ctx.fillRect(x + 4, y - 24 + bob, 3, 4);
    ctx.fillStyle = '#e3a950';
    ctx.fillRect(x + 7, y - 17 + bob, 6, 3);
    ctx.fillRect(x - 7, y - 2, 2, 5);
    ctx.fillRect(x + 4, y - 2, 2, 5);
    ctx.fillStyle = '#3c4e3b';
    ctx.fillRect(x + 2, y - 18 + bob, 2, 2);
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(x - 7, y - 12 + bob, 7, 3);

    if (animal.product === true) {
      ctx.fillStyle = '#f8efcf';
      ctx.fillRect(x + 11, y - 3, 7, 5);
      ctx.fillStyle = '#c9b889';
      ctx.fillRect(x + 13, y - 3, 3, 1);
    }
    if (animal.fed === true) {
      ctx.fillStyle = '#8bc678';
      ctx.fillRect(x + 9, y - 31 + bob, 4, 4);
      ctx.fillRect(x + 12, y - 29 + bob, 3, 2);
    }
  }

  function drawMonster(monster, now, player) {
    if (monster.defeated === true) return;
    const x = cellCenter(monster.x) * TILE - camera.pixelX;
    const y = cellCenter(monster.y) * TILE - camera.pixelY;
    const definition = MONSTER_TYPES?.[monster.type] ?? null;
    const name = String(definition?.name ?? monster.type ?? 'Creature').trim();
    const key = `${monster.type ?? ''} ${name}`.toLowerCase();
    const sourceColor = typeof definition?.color === 'string' ? definition.color : '#78b85e';
    const color = sourceColor;
    const dark = colorShade(color, '#31543c', -42);
    const light = colorShade(color, '#b4d883', 40);
    const bob = Math.round(Math.sin(now / 190 + finite(monster.x) * 1.1) * 2);
    const close = Math.hypot(cellCenter(monster.x) - player.x, cellCenter(monster.y) - player.y) < 6.3;

    drawShadow(x, y + 2, 28, 8, 0.25);
    ctx.save();
    ctx.translate(x, y + bob);

    if (/(bat|crow|bird|raven)/.test(key)) {
      const flap = Math.floor(Math.sin(now / 85) * 3);
      ctx.fillStyle = dark;
      ctx.fillRect(-17, -22 + flap, 11, 11);
      ctx.fillRect(6, -22 - flap, 11, 11);
      ctx.fillStyle = color;
      ctx.fillRect(-10, -22, 20, 19);
      ctx.fillRect(-7, -28, 14, 9);
      ctx.fillStyle = light;
      ctx.fillRect(-5, -25, 4, 3);
    } else if (/(mushroom|spore|fungus)/.test(key)) {
      ctx.fillStyle = dark;
      ctx.fillRect(-7, -20, 14, 19);
      ctx.fillStyle = color;
      ctx.fillRect(-18, -25, 36, 10);
      ctx.fillRect(-13, -31, 26, 8);
      ctx.fillStyle = light;
      ctx.fillRect(-10, -27, 6, 3);
      ctx.fillRect(6, -22, 5, 3);
    } else if (/(crab)/.test(key)) {
      ctx.fillStyle = dark;
      ctx.fillRect(-13, -17, 26, 16);
      ctx.fillStyle = color;
      ctx.fillRect(-11, -20, 22, 12);
      ctx.fillRect(-8, -25, 16, 7);
      ctx.fillStyle = light;
      ctx.fillRect(-6, -19, 6, 4);
      ctx.fillStyle = dark;
      for (const side of [-1, 1]) {
        ctx.fillRect(side * 13, -18, side * 6, 3);
        ctx.fillRect(side * 17, -22, side * 5, 7);
        ctx.fillRect(side * 6, -3, 3, 5);
        ctx.fillRect(side * 12, -5, 3, 6);
      }
    } else if (/(moss|sprite|leaf)/.test(key)) {
      ctx.fillStyle = dark;
      ctx.fillRect(-13, -19, 26, 18);
      ctx.fillRect(-9, -25, 18, 10);
      ctx.fillStyle = color;
      ctx.fillRect(-11, -20, 22, 17);
      ctx.fillRect(-8, -26, 16, 10);
      ctx.fillStyle = light;
      ctx.fillRect(-18, -27, 9, 5);
      ctx.fillRect(9, -29, 10, 6);
      ctx.fillRect(-4, -31, 8, 6);
      ctx.fillRect(-6, -18, 5, 3);
    } else if (/(beetle|bug|insect|scarab)/.test(key)) {
      ctx.fillStyle = dark;
      ctx.fillRect(-14, -18, 28, 17);
      ctx.fillStyle = color;
      ctx.fillRect(-12, -22, 24, 17);
      ctx.fillRect(-7, -27, 14, 8);
      ctx.fillStyle = light;
      ctx.fillRect(-8, -20, 6, 4);
      ctx.fillStyle = dark;
      ctx.fillRect(-15, -8, 5, 3);
      ctx.fillRect(10, -8, 5, 3);
      ctx.fillRect(-13, -25, 2, 7);
      ctx.fillRect(11, -25, 2, 7);
    } else if (/(rock|golem|stone|ore)/.test(key)) {
      ctx.fillStyle = dark;
      ctx.fillRect(-15, -20, 30, 19);
      ctx.fillRect(-11, -26, 22, 10);
      ctx.fillStyle = color;
      ctx.fillRect(-12, -20, 24, 17);
      ctx.fillRect(-9, -27, 18, 10);
      ctx.fillStyle = light;
      ctx.fillRect(-7, -24, 6, 4);
      ctx.fillRect(8, -17, 4, 5);
      ctx.fillStyle = '#eabf66';
      ctx.fillRect(-6, -18, 4, 3);
      ctx.fillRect(3, -18, 4, 3);
    } else if (/(ghost|wisp|spirit)/.test(key)) {
      ctx.fillStyle = dark;
      ctx.fillRect(-13, -27, 26, 26);
      ctx.fillRect(-15, -10, 8, 8);
      ctx.fillRect(-4, -7, 8, 6);
      ctx.fillRect(7, -11, 8, 9);
      ctx.fillStyle = color;
      ctx.fillRect(-11, -26, 22, 24);
      ctx.fillRect(-13, -10, 5, 6);
      ctx.fillRect(-3, -8, 6, 6);
      ctx.fillRect(8, -12, 5, 7);
      ctx.fillStyle = light;
      ctx.fillRect(-8, -22, 6, 5);
    } else {
      ctx.fillStyle = dark;
      ctx.fillRect(-16, -16, 32, 16);
      ctx.fillRect(-12, -23, 24, 10);
      ctx.fillStyle = color;
      ctx.fillRect(-14, -18, 28, 16);
      ctx.fillRect(-11, -25, 22, 10);
      ctx.fillRect(-8, -28, 16, 5);
      ctx.fillStyle = light;
      ctx.fillRect(-9, -22, 7, 5);
      ctx.fillRect(5, -20, 4, 3);
      ctx.fillRect(-13, -4, 5, 4);
      ctx.fillRect(8, -4, 5, 4);
    }

    ctx.fillStyle = '#fff5dd';
    ctx.fillRect(-7, -16, 5, 6);
    ctx.fillRect(3, -16, 5, 6);
    ctx.fillStyle = '#263c3a';
    ctx.fillRect(-5, -14, 2, 4);
    ctx.fillRect(5, -14, 2, 4);
    ctx.fillStyle = 'rgba(255, 219, 189, 0.7)';
    ctx.fillRect(-12, -8, 4, 2);
    ctx.fillRect(8, -8, 4, 2);
    ctx.restore();

    if (close) {
      const hp = Math.max(0, finite(monster.hp));
      const maxHp = Math.max(1, finite(definition?.hp, hp || 1));
      const barX = x - 18;
      const barY = y - 39;
      ctx.fillStyle = 'rgba(25, 43, 39, 0.86)';
      ctx.fillRect(barX - 1, barY - 1, 38, 5);
      ctx.fillStyle = '#b85b52';
      ctx.fillRect(barX, barY, 36, 3);
      ctx.fillStyle = '#79c675';
      ctx.fillRect(barX, barY, Math.round(36 * clamp(hp / maxHp, 0, 1)), 3);
      drawLabel(name, x, y - 48, { size: 8, maxWidth: 116, background: 'rgba(49, 49, 48, 0.86)', border: 'rgba(234, 198, 132, 0.8)' });
    }
  }

  function drawObject(object, now, season) {
    const x = cellCenter(object.x) * TILE - camera.pixelX;
    const footY = (finite(object.y) + 1) * TILE - camera.pixelY;
    const type = String(object.type ?? '').toLowerCase();
    drawShadow(x, footY - 1, 28, 8, 0.22);

    if (type === 'bin') {
      ctx.fillStyle = '#65452e';
      ctx.fillRect(x - 14, footY - 23, 28, 22);
      ctx.fillStyle = '#a56b3f';
      ctx.fillRect(x - 13, footY - 21, 26, 17);
      ctx.fillStyle = '#d29a5e';
      ctx.fillRect(x - 15, footY - 25, 30, 5);
      ctx.fillRect(x - 12, footY - 17, 24, 2);
      ctx.fillStyle = '#725136';
      ctx.fillRect(x - 10, footY - 11, 20, 2);
      if (!drawItemIcon(7, x - 9, footY - 22, 17)) {
        ctx.fillStyle = '#84b46a';
        ctx.fillRect(x - 7, footY - 22, 5, 6);
        ctx.fillStyle = '#ebcd6a';
        ctx.fillRect(x + 1, footY - 21, 6, 5);
      }
    } else if (type === 'well') {
      ctx.fillStyle = '#67685b';
      ctx.fillRect(x - 15, footY - 20, 30, 18);
      ctx.fillStyle = '#c0b798';
      ctx.fillRect(x - 13, footY - 20, 26, 4);
      ctx.fillStyle = '#428b8d';
      ctx.fillRect(x - 9, footY - 14, 18, 9);
      ctx.fillStyle = '#8d613b';
      ctx.fillRect(x - 3, footY - 38, 5, 20);
      ctx.fillRect(x - 16, footY - 39, 32, 4);
      ctx.fillRect(x - 11, footY - 48, 22, 9);
      ctx.fillStyle = '#c58d54';
      ctx.fillRect(x - 10, footY - 47, 20, 6);
      ctx.fillStyle = '#dfb678';
      ctx.fillRect(x - 6, footY - 32, 10, 2);
    } else if (type === 'sign') {
      ctx.fillStyle = '#70492e';
      ctx.fillRect(x - 3, footY - 22, 6, 22);
      ctx.fillStyle = '#9b6741';
      ctx.fillRect(x - 15, footY - 37, 30, 17);
      ctx.fillStyle = '#d1a36a';
      ctx.fillRect(x - 13, footY - 35, 26, 12);
      ctx.fillStyle = '#755238';
      ctx.fillRect(x - 7, footY - 31, 14, 2);
      ctx.fillRect(x - 4, footY - 27, 9, 2);
    } else if (type === 'chest') {
      ctx.fillStyle = '#64432b';
      ctx.fillRect(x - 13, footY - 19, 26, 18);
      ctx.fillStyle = '#a56c3d';
      ctx.fillRect(x - 12, footY - 17, 24, 13);
      ctx.fillStyle = '#d2a153';
      ctx.fillRect(x - 14, footY - 21, 28, 5);
      ctx.fillRect(x - 2, footY - 14, 4, 7);
    } else if (type === 'ore') {
      ctx.fillStyle = '#686c67';
      ctx.fillRect(x - 15, footY - 15, 30, 14);
      ctx.fillRect(x - 10, footY - 23, 20, 10);
      ctx.fillStyle = '#93968a';
      ctx.fillRect(x - 7, footY - 21, 10, 7);
      const oreColor = ['#6bb8b1', '#d59a5b', '#9b9dde', '#d67d72'][Math.floor(hashFloat(finite(object.x), finite(object.y), 200) * 4)];
      ctx.fillStyle = oreColor;
      ctx.fillRect(x - 4, footY - 24, 6, 9);
      ctx.fillRect(x + 6, footY - 18, 4, 7);
      ctx.fillStyle = 'rgba(247, 231, 178, 0.76)';
      ctx.fillRect(x - 3, footY - 22, 2, 3);
    } else if (type === 'feed') {
      ctx.fillStyle = '#755236';
      ctx.fillRect(x - 16, footY - 13, 32, 12);
      ctx.fillStyle = '#c28e58';
      ctx.fillRect(x - 17, footY - 16, 34, 4);
      ctx.fillStyle = '#e0c06c';
      ctx.fillRect(x - 12, footY - 20, 23, 6);
      ctx.fillStyle = '#f1d987';
      ctx.fillRect(x - 8, footY - 19, 5, 3);
    } else if (type === 'fish') {
      const swish = Math.round(Math.sin(now / 140) * 2);
      ctx.fillStyle = '#2a6170';
      ctx.fillRect(x - 10, footY - 12, 18, 9);
      ctx.fillRect(x - 16, footY - 11 + swish, 7, 7);
      ctx.fillStyle = '#76c4bb';
      ctx.fillRect(x - 8, footY - 11, 13, 5);
      ctx.fillStyle = '#f4e7bf';
      ctx.fillRect(x + 3, footY - 9, 2, 2);
    } else if (type === 'tree') {
      drawTree(finite(object.x), finite(object.y), now, season);
    } else {
      ctx.fillStyle = '#786b55';
      ctx.fillRect(x - 10, footY - 13, 20, 12);
      ctx.fillStyle = '#a08b67';
      ctx.fillRect(x - 7, footY - 17, 13, 7);
    }
  }

  function getCoastPierPlan() {
    if (coastPierScanned) return cachedCoastPier ?? null;
    coastPierScanned = true;
    const coast = Array.isArray(WORLD?.regions) ? WORLD.regions.find((region) => region.id === 'coast') : null;
    if (!coast) return null;

    const centerY = finite(coast.y) + finite(coast.h) / 2;
    let best = null;
    for (let y = Math.max(0, Math.floor(finite(coast.y))); y < Math.min(mapHeight, Math.ceil(finite(coast.y) + finite(coast.h))); y += 1) {
      for (let x = Math.max(0, Math.floor(finite(coast.x))); x < Math.min(mapWidth - 1, Math.ceil(finite(coast.x) + finite(coast.w)) - 1); x += 1) {
        if (safeTileAt(x, y) !== 'sand' || safeTileAt(x + 1, y) !== 'water') continue;
        const candidate = { shoreX: x, y, score: Math.abs(y - centerY) };
        if (!best || candidate.score < best.score) best = candidate;
      }
    }
    if (best) cachedCoastPier = best;
    return cachedCoastPier ?? null;
  }

  function drawCoastPier(plan) {
    if (!plan) return;
    const waterX = plan.shoreX + 1;
    const startX = Math.max(0, waterX - 3);
    const endX = Math.min(mapWidth - 1, waterX + 2);
    const centerY = (plan.y + 0.5) * TILE - camera.pixelY;
    const left = startX * TILE - camera.pixelX;
    const right = (endX + 1) * TILE - camera.pixelX;
    drawShadow((left + right) / 2, centerY + 2, right - left, 26, 0.32);

    for (let x = startX; x <= endX; x += 1) {
      const sx = x * TILE - camera.pixelX;
      ctx.fillStyle = '#694934';
      ctx.fillRect(sx, centerY - 11, TILE, 23);
      ctx.fillStyle = x < waterX ? '#a9774d' : '#99704a';
      ctx.fillRect(sx + 1, centerY - 10, TILE - 2, 19);
      ctx.fillStyle = 'rgba(224, 177, 112, 0.58)';
      ctx.fillRect(sx + 2, centerY - 9, TILE - 4, 2);
      for (let seam = 8; seam < TILE; seam += 8) {
        ctx.fillStyle = 'rgba(94, 64, 43, 0.58)';
        ctx.fillRect(sx + seam, centerY - 8, 1, 16);
      }
      if (x >= waterX) {
        for (const side of [-1, 1]) {
          const postY = centerY + side * 12;
          ctx.fillStyle = '#69452d';
          ctx.fillRect(sx + 4, postY - 3, 5, 9);
          ctx.fillRect(sx + 23, postY - 3, 5, 9);
          ctx.fillStyle = '#c0905b';
          ctx.fillRect(sx + 5, postY - 2, 3, 6);
          ctx.fillRect(sx + 24, postY - 2, 3, 6);
        }
      }
    }
    ctx.fillStyle = '#d4aa75';
    ctx.fillRect(right - 5, centerY - 13, 7, 28);
    ctx.fillStyle = '#6b4a31';
    ctx.fillRect(right - 8, centerY - 14, 13, 5);
  }

  function drawTree(tileX, tileY, now, season) {
    const x = (tileX + 0.5) * TILE - camera.pixelX;
    const baseY = (tileY + 1) * TILE - camera.pixelY;
    const palette = season.leaf;
    const variant = hashFloat(tileX, tileY, 210);
    const scale = 0.9 + variant * 0.2;
    const sway = Math.round(Math.sin(now / 1450 + tileX * 1.9 + tileY) * 1.2);
    const w = Math.round(57 * scale);
    const left = Math.round(x - w / 2 + sway);

    drawShadow(x + 2, baseY - 3, w * 0.92, 12, 0.25);
    ctx.fillStyle = '#684b35';
    ctx.fillRect(x - 7, baseY - 38, 14, 38);
    ctx.fillStyle = '#8c6541';
    ctx.fillRect(x - 4, baseY - 34, 5, 31);
    ctx.fillStyle = '#4f3b2e';
    ctx.fillRect(x - 13, baseY - 16, 10, 5);
    ctx.fillRect(x + 4, baseY - 24, 11, 5);

    ctx.fillStyle = colorShade(palette[0], '#31523e', -12);
    ctx.fillRect(left + 8, baseY - 69, w - 16, 41);
    ctx.fillRect(left + 2, baseY - 59, w - 4, 25);
    ctx.fillRect(left + 15, baseY - 77, w - 30, 14);
    ctx.fillStyle = palette[0];
    ctx.fillRect(left + 10, baseY - 68, w - 20, 33);
    ctx.fillRect(left + 5, baseY - 57, w - 10, 20);
    ctx.fillRect(left + 16, baseY - 76, w - 32, 13);
    ctx.fillRect(left + 1, baseY - 48, 13, 14);
    ctx.fillRect(left + w - 14, baseY - 49, 13, 15);
    ctx.fillStyle = palette[1];
    ctx.fillRect(left + 12, baseY - 68, w - 24, 17);
    ctx.fillRect(left + 20, baseY - 74, w - 40, 9);
    ctx.fillRect(left + 4, baseY - 53, 12, 9);
    ctx.fillRect(left + w - 16, baseY - 54, 11, 10);
    ctx.fillStyle = palette[2];
    ctx.fillRect(left + 15, baseY - 70, 9, 4);
    ctx.fillRect(left + 31, baseY - 63, 13, 4);
    ctx.fillRect(left + 8, baseY - 48, 7, 4);
    ctx.fillRect(left + w - 18, baseY - 61, 7, 4);
    if (variant > 0.42) {
      ctx.fillStyle = palette[3];
      ctx.fillRect(left + 22, baseY - 73, 8, 4);
      ctx.fillRect(left + 38, baseY - 57, 6, 4);
      ctx.fillRect(left + 11, baseY - 60, 5, 4);
    }

    for (let i = 0; i < 10; i += 1) {
      if (hashFloat(tileX, tileY, 260 + i) < 0.34) continue;
      const px = left + 4 + Math.floor(hashFloat(tileX, tileY, 280 + i) * Math.max(1, w - 8));
      const py = baseY - 70 + Math.floor(hashFloat(tileX, tileY, 300 + i) * 30);
      ctx.fillStyle = i % 3 === 0 ? palette[2] : palette[1];
      ctx.fillRect(px, py, i % 4 === 0 ? 3 : 2, 2);
    }

    if (season === SEASON_ART[0] && variant > 0.32) {
      for (let i = 0; i < 4; i += 1) {
        const px = left + 8 + Math.floor(hashFloat(tileX, tileY, 320 + i) * Math.max(1, w - 16));
        const py = baseY - 64 + Math.floor(hashFloat(tileX, tileY, 330 + i) * 26);
        ctx.fillStyle = i % 2 ? '#ffe9dc' : '#f6c6cf';
        ctx.fillRect(px, py, 3, 3);
        ctx.fillStyle = '#f5dc83';
        ctx.fillRect(px + 1, py + 1, 1, 1);
      }
    }

    if (season === SEASON_ART[3]) {
      ctx.fillStyle = 'rgba(235, 243, 226, 0.82)';
      ctx.fillRect(left + 13, baseY - 74, w - 27, 4);
      ctx.fillRect(left + 4, baseY - 55, 12, 3);
      ctx.fillRect(left + w - 17, baseY - 57, 11, 3);
    } else if (season === SEASON_ART[2]) {
      ctx.fillStyle = '#e4a35d';
      ctx.fillRect(left + 27, baseY - 64, 4, 4);
      ctx.fillRect(left + w - 22, baseY - 48, 4, 4);
    }
  }

  function roofColor(building) {
    const roof = typeof building.roof === 'string' ? building.roof.trim() : '';
    const normalized = roof.toLowerCase();
    if (ROOF_COLORS[normalized]) return ROOF_COLORS[normalized];
    if (/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(roof) || /^(rgb|hsl)a?\(/i.test(roof)) return roof;
    const key = `${building.id ?? ''} ${building.name ?? ''}`.toLowerCase();
    if (/(coop|animal pen)/.test(key)) return '#ad7041';
    if (/(inn|tavern|shop|bakery|market)/.test(key)) return '#557b7b';
    if (/(hall|museum|clinic)/.test(key)) return '#8d6c86';
    if (/mine/.test(key)) return '#67727a';
    return '#b65c45';
  }

  function drawWindow(x, y, warm = false, small = false) {
    const width = small ? 16 : 21;
    const height = small ? 18 : 22;
    ctx.fillStyle = '#624d3b';
    ctx.fillRect(x - width / 2 - 2, y - height / 2 - 2, width + 4, height + 4);
    ctx.fillStyle = '#d5b989';
    ctx.fillRect(x - width / 2, y - height / 2, width, height);
    ctx.fillStyle = warm ? '#f2bf62' : '#88c5ca';
    ctx.fillRect(x - width / 2 + 2, y - height / 2 + 2, width - 4, height - 4);
    ctx.fillStyle = warm ? 'rgba(255, 235, 155, 0.55)' : 'rgba(227, 250, 232, 0.6)';
    ctx.fillRect(x - width / 2 + 3, y - height / 2 + 3, Math.max(3, width / 3), 3);
    ctx.fillStyle = '#73523c';
    ctx.fillRect(x - 1, y - height / 2, 2, height);
    ctx.fillRect(x - width / 2, y - 1, width, 2);
  }

  function drawBuilding(building, lighting) {
    const tx = finite(building.x);
    const ty = finite(building.y);
    const widthTiles = Math.max(1, finite(building.w, 3));
    const heightTiles = Math.max(1, finite(building.h, 3));
    const x = tx * TILE - camera.pixelX;
    const y = ty * TILE - camera.pixelY;
    const width = widthTiles * TILE;
    const height = heightTiles * TILE;
    const roofHeight = Math.min(height * 0.57, Math.max(TILE * 1.15, height * 0.45));
    const roofBottom = y + roofHeight;
    const bottom = y + height;
    const kind = `${building.id ?? ''} ${building.name ?? ''}`.toLowerCase();
    const coop = /(coop|animal pen)/.test(kind);
    const home = /(farm|home|house)/.test(kind) && !coop;
    const roof = roofColor(building);
    const wall = coop ? '#d9bf87' : home ? '#e8d8b4' : '#e1d0ad';
    const trim = coop ? '#855a39' : '#76513d';

    ctx.save();
    ctx.fillStyle = 'rgba(37, 56, 37, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + width / 2 + 7, bottom - 1, width * 0.43, 10, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#674a38';
    ctx.fillRect(x + 2, roofBottom - 3, width - 4, height - roofHeight + 4);
    ctx.fillStyle = wall;
    ctx.fillRect(x + 5, roofBottom, width - 10, bottom - roofBottom - 2);
    ctx.fillStyle = 'rgba(255, 246, 210, 0.38)';
    ctx.fillRect(x + 7, roofBottom + 3, width - 14, 3);
    ctx.fillStyle = 'rgba(113, 78, 50, 0.22)';
    for (let plank = 1; plank < Math.floor(widthTiles); plank += 1) {
      ctx.fillRect(x + plank * TILE, roofBottom + 7, 1, Math.max(0, bottom - roofBottom - 11));
    }

    const wallRows = Math.floor((bottom - roofBottom - 10) / 24);
    for (let row = 1; row <= wallRows; row += 1) {
      ctx.fillStyle = 'rgba(122, 94, 65, 0.16)';
      ctx.fillRect(x + 6, roofBottom + row * 22, width - 12, 1);
    }

    const chimneyX = x + 16 + Math.round(hashFloat(tx, ty, 220) * 10);
    if (!coop && widthTiles >= 4) {
      ctx.fillStyle = '#704f40';
      ctx.fillRect(chimneyX, y + 2, 18, 28);
      ctx.fillStyle = '#bd7c59';
      ctx.fillRect(chimneyX + 3, y + 5, 12, 22);
      ctx.fillStyle = '#e1a574';
      ctx.fillRect(chimneyX - 2, y, 22, 5);
    }

    ctx.fillStyle = '#543e32';
    ctx.fillRect(x - 5, y + roofHeight - 2, width + 10, 7);
    ctx.fillStyle = roof;
    ctx.fillRect(x - 4, y - 3, width + 8, roofHeight + 3);
    ctx.fillStyle = colorShade(roof, '#75463c', -38);
    ctx.fillRect(x - 4, y - 3, width + 8, 5);

    for (let row = 0; row < roofHeight / 10; row += 1) {
      const rowY = y + 7 + row * 10;
      ctx.fillStyle = row % 2 ? colorShade(roof, '#854f42', -17) : colorShade(roof, '#c9855c', 13);
      ctx.fillRect(x - 2, rowY, width + 4, 2);
      const offset = row % 2 ? 10 : 0;
      for (let seamX = x + offset; seamX < x + width; seamX += 20) {
        ctx.fillStyle = colorShade(roof, '#704639', -26);
        ctx.fillRect(seamX, rowY - 7, 1, 8);
      }
    }
    ctx.fillStyle = colorShade(roof, '#db9b69', 24);
    ctx.fillRect(x + 3, y + 5, width - 6, 2);
    ctx.fillStyle = colorShade(roof, '#733e33', -36);
    ctx.fillRect(x - 4, roofBottom - 1, width + 8, 4);
    ctx.fillStyle = colorShade(roof, '#dfa578', 19);
    ctx.fillRect(x - 3, roofBottom - 2, width + 6, 2);

    const door = Array.isArray(building.door) ? building.door : null;
    const doorX = door && Number.isFinite(Number(door[0]))
      ? (Number(door[0]) + 0.5) * TILE - camera.pixelX
      : x + width / 2;
    const doorWidth = coop ? 20 : 22;
    const doorHeight = Math.min(39, Math.max(27, bottom - roofBottom - 8));
    const doorY = bottom - doorHeight - 2;
    ctx.fillStyle = '#513c30';
    ctx.fillRect(doorX - doorWidth / 2 - 2, doorY - 2, doorWidth + 4, doorHeight + 5);
    ctx.fillStyle = coop ? '#8d5935' : '#98653f';
    ctx.fillRect(doorX - doorWidth / 2, doorY, doorWidth, doorHeight);
    ctx.fillStyle = '#bc8750';
    ctx.fillRect(doorX - doorWidth / 2 + 3, doorY + 3, doorWidth - 6, doorHeight - 5);
    ctx.fillStyle = '#6f4a33';
    ctx.fillRect(doorX + 1, doorY + 3, 2, doorHeight - 5);
    ctx.fillStyle = '#eed17b';
    ctx.fillRect(doorX + doorWidth / 2 - 6, doorY + doorHeight * 0.55, 3, 4);
    ctx.fillStyle = '#a49173';
    ctx.fillRect(doorX - 17, bottom - 3, 34, 4);
    ctx.fillStyle = '#ddd0ad';
    ctx.fillRect(doorX - 14, bottom - 4, 28, 2);

    const windowY = roofBottom + Math.max(14, (bottom - roofBottom) * 0.34);
    if (coop) {
      drawWindow(x + width * 0.25, windowY, lighting.darkness > 0.08, true);
      ctx.fillStyle = '#805738';
      ctx.fillRect(x + width - 28, roofBottom + 15, 15, 11);
      ctx.fillStyle = '#dfc77f';
      ctx.fillRect(x + width - 26, roofBottom + 17, 11, 7);
    } else {
      drawWindow(x + width * 0.24, windowY, lighting.darkness > 0.08);
      drawWindow(x + width * 0.76, windowY, lighting.darkness > 0.08);
      if (home) {
        ctx.fillStyle = '#8b563d';
        ctx.fillRect(x + width * 0.24 - 12, windowY + 12, 24, 4);
        ctx.fillRect(x + width * 0.76 - 12, windowY + 12, 24, 4);
        ctx.fillStyle = '#659b5a';
        ctx.fillRect(x + width * 0.24 - 8, windowY + 9, 5, 4);
        ctx.fillRect(x + width * 0.76 + 3, windowY + 9, 5, 4);
      }
    }

    ctx.fillStyle = 'rgba(255, 227, 156, 0.55)';
    ctx.fillRect(x + 7, bottom - 9, width - 14, 2);
    ctx.restore();

    const label = String(building.name ?? '').trim();
    if (label) drawLabel(label, x + width / 2, y - 11, { size: 9, maxWidth: 156 });
  }

  function parseFarmCoordinates(state) {
    if (!state?.farm || typeof state.farm !== 'object') return [];
    const points = [];
    for (const key of Object.keys(state.farm)) {
      const match = /^(-?\d+),(-?\d+)$/.exec(key);
      if (!match) continue;
      const x = Number(match[1]);
      const y = Number(match[2]);
      if (x >= 0 && y >= 0 && x < mapWidth && y < mapHeight) points.push([x, y]);
    }
    return points;
  }

  function fieldBoundsFromPoints(points) {
    if (points.length < 20) return null;
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    if (width < 7 || width > 20 || height < 4 || height > 14) return null;
    return { minX, maxX, minY, maxY };
  }

  function inferFieldBounds(state) {
    const fromState = fieldBoundsFromPoints(parseFarmCoordinates(state));
    if (fromState) return fromState;
    if (soilBoundsScanned) return cachedSoilBounds;

    soilBoundsScanned = true;
    const points = [];
    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        if (safeTileAt(x, y) !== 'soil') continue;
        const region = safeRegionAt(x, y);
        if (!region || region.id === 'farm') points.push([x, y]);
      }
    }
    cachedSoilBounds = fieldBoundsFromPoints(points);
    return cachedSoilBounds;
  }

  function existingFarmFence(bounds) {
    let count = 0;
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      if (safeTileAt(x, bounds.minY - 1) === 'wall' || safeTileAt(x, bounds.maxY + 1) === 'wall') count += 1;
    }
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      if (safeTileAt(bounds.minX - 1, y) === 'wall' || safeTileAt(bounds.maxX + 1, y) === 'wall') count += 1;
    }
    return count > 3;
  }

  function drawHorizontalFence(x1, x2, y, gateCenter = null) {
    const screenY = y * TILE - camera.pixelY;
    const start = x1 * TILE - camera.pixelX;
    const end = (x2 + 1) * TILE - camera.pixelX;
    const gateHalf = gateCenter === null ? 0 : TILE * 0.68;
    const gateStart = gateCenter === null ? end : gateCenter * TILE - camera.pixelX - gateHalf;
    const gateEnd = gateCenter === null ? end : gateCenter * TILE - camera.pixelX + gateHalf;

    ctx.fillStyle = 'rgba(53, 43, 31, 0.42)';
    ctx.fillRect(start, screenY + 8, Math.max(0, gateStart - start), 4);
    ctx.fillRect(gateEnd, screenY + 8, Math.max(0, end - gateEnd), 4);
    ctx.fillStyle = '#b87f4a';
    ctx.fillRect(start, screenY + 5, Math.max(0, gateStart - start), 4);
    ctx.fillRect(gateEnd, screenY + 5, Math.max(0, end - gateEnd), 4);
    ctx.fillStyle = '#815837';
    ctx.fillRect(start, screenY + 14, Math.max(0, gateStart - start), 4);
    ctx.fillRect(gateEnd, screenY + 14, Math.max(0, end - gateEnd), 4);

    for (let x = x1; x <= x2 + 1; x += 2) {
      const px = x * TILE - camera.pixelX - 3;
      if (gateCenter !== null && Math.abs(px + 3 - gateCenter * TILE + camera.pixelX) < gateHalf - 3) continue;
      ctx.fillStyle = '#68482f';
      ctx.fillRect(px, screenY + 1, 6, 22);
      ctx.fillStyle = '#d0a06a';
      ctx.fillRect(px + 1, screenY + 2, 2, 18);
    }

    if (gateCenter !== null) {
      const hingeX = gateStart + 2;
      ctx.save();
      ctx.translate(hingeX, screenY + 10);
      ctx.rotate(-0.52);
      ctx.fillStyle = '#68482f';
      ctx.fillRect(0, -8, TILE * 1.3, 4);
      ctx.fillRect(0, 3, TILE * 1.3, 4);
      ctx.fillStyle = '#c28a52';
      ctx.fillRect(3, -7, TILE * 1.15, 2);
      ctx.fillRect(3, 4, TILE * 1.15, 2);
      ctx.restore();
    }
  }

  function drawVerticalFence(x, y1, y2) {
    const screenX = x * TILE - camera.pixelX;
    const start = y1 * TILE - camera.pixelY;
    const end = (y2 + 1) * TILE - camera.pixelY;
    ctx.fillStyle = 'rgba(53, 43, 31, 0.42)';
    ctx.fillRect(screenX + 7, start, 4, end - start);
    ctx.fillRect(screenX + 17, start, 4, end - start);
    ctx.fillStyle = '#b87f4a';
    ctx.fillRect(screenX + 4, start, 4, end - start);
    ctx.fillRect(screenX + 14, start, 4, end - start);
    for (let y = y1; y <= y2 + 1; y += 2) {
      const py = y * TILE - camera.pixelY - 3;
      ctx.fillStyle = '#68482f';
      ctx.fillRect(screenX + 1, py, 24, 6);
      ctx.fillStyle = '#d0a06a';
      ctx.fillRect(screenX + 3, py + 1, 19, 2);
    }
  }

  function drawFarmFence(state) {
    const bounds = inferFieldBounds(state);
    if (!bounds || existingFarmFence(bounds)) return;
    drawHorizontalFence(bounds.minX, bounds.maxX, bounds.minY, (bounds.minX + bounds.maxX + 1) / 2);
    drawHorizontalFence(bounds.minX, bounds.maxX, bounds.maxY + 1);
    drawVerticalFence(bounds.minX, bounds.minY, bounds.maxY);
    drawVerticalFence(bounds.maxX + 1, bounds.minY, bounds.maxY);
  }

  function drawNightAccents(buildings, lighting) {
    if (lighting.darkness < 0.08) return;
    for (const building of buildings) {
      const x = finite(building.x) * TILE - camera.pixelX;
      const y = finite(building.y) * TILE - camera.pixelY;
      const width = Math.max(1, finite(building.w, 3)) * TILE;
      const height = Math.max(1, finite(building.h, 3)) * TILE;
      if (x > VIEW_WIDTH + 80 || y > VIEW_HEIGHT + 80 || x + width < -80 || y + height < -80) continue;
      const windowY = y + Math.min(height * 0.57, Math.max(TILE * 1.15, height * 0.45)) + Math.max(14, (height - Math.min(height * 0.57, Math.max(TILE * 1.15, height * 0.45))) * 0.34);
      for (const windowX of [x + width * 0.24, x + width * 0.76]) {
        if (ctx.createRadialGradient) {
          const glow = ctx.createRadialGradient(windowX, windowY, 1, windowX, windowY, 34);
          glow.addColorStop(0, 'rgba(255, 190, 94, 0.19)');
          glow.addColorStop(1, 'rgba(255, 190, 94, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(windowX - 34, windowY - 34, 68, 68);
        }
        ctx.fillStyle = '#ffcf71';
        ctx.fillRect(windowX - 4, windowY - 5, 8, 10);
        ctx.fillStyle = '#fff0b2';
        ctx.fillRect(windowX - 2, windowY - 4, 3, 4);
      }
    }
  }

  function drawNightFireflies(now, minX, maxX, minY, maxY, lighting) {
    if (lighting.darkness < 0.12) return;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (safeTileAt(x, y) !== 'grass' || hashFloat(x, y, 230) < 0.94) continue;
        const phase = now / 420 + hashFloat(x, y, 231) * TAU;
        const alpha = 0.32 + (Math.sin(phase) + 1) * 0.22;
        const px = (x + 0.2 + hashFloat(x, y, 232) * 0.6) * TILE - camera.pixelX;
        const py = (y + 0.2 + hashFloat(x, y, 233) * 0.6) * TILE - camera.pixelY;
        ctx.fillStyle = `rgba(255, 229, 132, ${alpha})`;
        ctx.fillRect(px, py, 2, 2);
        ctx.fillStyle = `rgba(255, 229, 132, ${alpha * 0.2})`;
        ctx.fillRect(px - 2, py - 2, 6, 6);
      }
    }
  }

  function drawWeather(now, lighting) {
    if (lighting.weather.includes('rain')) {
      ctx.save();
      ctx.strokeStyle = 'rgba(216, 233, 224, 0.27)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 54; i += 1) {
        const baseX = hashFloat(i, 1, 240) * VIEW_WIDTH;
        const y = (hashFloat(i, 2, 241) * (VIEW_HEIGHT + 50) + now / 8 + i * 13) % (VIEW_HEIGHT + 50) - 25;
        ctx.beginPath();
        ctx.moveTo(baseX, y);
        ctx.lineTo(baseX - 4, y + 9);
        ctx.stroke();
      }
      ctx.restore();
    } else if (lighting.weather.includes('snow')) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 245, 0.62)';
      for (let i = 0; i < 46; i += 1) {
        const x = (hashFloat(i, 4, 242) * VIEW_WIDTH + Math.sin(now / 900 + i) * 8) % VIEW_WIDTH;
        const y = (hashFloat(i, 5, 243) * (VIEW_HEIGHT + 24) + now / 24 + i * 7) % (VIEW_HEIGHT + 24) - 12;
        ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
      }
      ctx.restore();
    }
  }

  function collectFarmPlots(state, minX, maxX, minY, maxY, now, season, entities) {
    if (!state?.farm || typeof state.farm !== 'object') return;
    for (const [key, plot] of Object.entries(state.farm)) {
      const match = /^(-?\d+),(-?\d+)$/.exec(key);
      if (!match) continue;
      const x = Number(match[1]);
      const y = Number(match[2]);
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      const sx = x * TILE - camera.pixelX;
      const sy = y * TILE - camera.pixelY;
      drawPlotOverlay(x, y, plot, sx, sy, season);
      if (!plot || typeof plot !== 'object' || !plot.crop || typeof plot.crop !== 'object') continue;
      entities.push({
        y: (y + 0.93) * TILE,
        order: 4,
        draw: () => drawCrop(plot.crop, sx, sy, now, x, y, season),
      });
    }
  }

  function addEntities(state, player, now, moving, visibleTiles, entities) {
    let order = 0;
    const add = (y, draw, layer = 3) => entities.push({ y, order: layer * 100000 + order++, draw });
    const buildings = Array.isArray(WORLD?.buildings) ? WORLD.buildings : [];
    const objects = Array.isArray(WORLD?.objects) ? WORLD.objects : [];
    const treeObjects = new Set();
    const pier = getCoastPierPlan();

    if (pier && pier.y >= camera.y - 2 && pier.y <= camera.y + visibleHeight + 2) {
      add((pier.y + 1) * TILE, () => drawCoastPier(pier), 2);
    }

    for (const object of objects) {
      if (String(object?.type ?? '').toLowerCase() !== 'tree') continue;
      treeObjects.add(`${finite(object.x)},${finite(object.y)}`);
    }

    for (const { x, y } of visibleTiles) {
      if (safeTileAt(x, y) !== 'tree' || treeObjects.has(`${x},${y}`)) continue;
      add((y + 1) * TILE, () => drawTree(x, y, now, getSeason(state)), 1);
    }

    for (const building of buildings) {
      const x = finite(building.x) * TILE;
      const y = finite(building.y) * TILE;
      const width = finite(building.w, 3) * TILE;
      const height = finite(building.h, 3) * TILE;
      if (x > camera.pixelX + VIEW_WIDTH + 100 || y > camera.pixelY + VIEW_HEIGHT + 100
        || x + width < camera.pixelX - 100 || y + height < camera.pixelY - 110) continue;
      add((finite(building.y) + finite(building.h, 3)) * TILE, () => drawBuilding(building, getLighting(state)), 0);
    }

    for (const object of objects) {
      const tx = finite(object?.x, -100);
      const ty = finite(object?.y, -100);
      if (tx < camera.x - 2 || tx > camera.x + visibleWidth + 2 || ty < camera.y - 2 || ty > camera.y + visibleHeight + 2) continue;
      if (String(object?.type ?? '').toLowerCase() === 'tree') {
        add((ty + 1) * TILE, () => drawTree(tx, ty, now, getSeason(state)), 1);
      } else {
        add((ty + 1) * TILE, () => drawObject(object, now, getSeason(state)), 2);
      }
    }

    const animals = Array.isArray(state.animals) ? state.animals : [];
    for (const animal of animals) {
      if (!animal || !Number.isFinite(Number(animal.x)) || !Number.isFinite(Number(animal.y))) continue;
      const x = cellCenter(animal.x);
      const y = cellCenter(animal.y);
      if (x < camera.x - 2 || x > camera.x + visibleWidth + 2 || y < camera.y - 2 || y > camera.y + visibleHeight + 2) continue;
      add(y * TILE, () => drawChicken(animal, now), 3);
    }

    const monsters = Array.isArray(state.monsters) ? state.monsters : [];
    for (const monster of monsters) {
      if (!monster || !Number.isFinite(Number(monster.x)) || !Number.isFinite(Number(monster.y))) continue;
      const x = cellCenter(monster.x);
      const y = cellCenter(monster.y);
      if (x < camera.x - 2 || x > camera.x + visibleWidth + 2 || y < camera.y - 2 || y > camera.y + visibleHeight + 2) continue;
      add(y * TILE, () => drawMonster(monster, now, player), 3);
    }

    if (Array.isArray(VILLAGERS)) {
      for (let i = 0; i < VILLAGERS.length; i += 1) {
        const npc = VILLAGERS[i];
        let position = null;
        try {
          position = getNpcPosition(state, npc.id);
        } catch {
          position = null;
        }
        if (!position || !Number.isFinite(Number(position.x)) || !Number.isFinite(Number(position.y))) continue;
        const x = cellCenter(position.x);
        const y = cellCenter(position.y);
        if (x < camera.x - 2 || x > camera.x + visibleWidth + 2 || y < camera.y - 2 || y > camera.y + visibleHeight + 2) continue;
        add(y * TILE, () => drawNpc(npc, position, i, player, now), 3);
      }
    }

    add(player.y * TILE, () => drawHero(player, now, moving), 4);
    return buildings;
  }

  function drawTarget(player, now) {
    const offsets = {
      up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
    };
    const [dx, dy] = offsets[String(player.facing ?? 'down').toLowerCase()] ?? offsets.down;
    const tileX = Math.floor(player.x) + dx;
    const tileY = Math.floor(player.y) + dy;
    if (tileX < 0 || tileY < 0 || tileX >= mapWidth || tileY >= mapHeight) return;
    const x = tileX * TILE - camera.pixelX;
    const y = tileY * TILE - camera.pixelY;
    const pulse = 0.6 + (Math.sin(now / 170) + 1) * 0.18;
    ctx.save();
    ctx.fillStyle = `rgba(247, 218, 124, ${pulse * 0.11})`;
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = `rgba(255, 239, 176, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = '#fff3c6';
    for (const [cx, cy] of [[4, 4], [TILE - 7, 4], [4, TILE - 7], [TILE - 7, TILE - 7]]) {
      ctx.fillRect(x + cx, y + cy, 3, 3);
    }
    ctx.restore();
  }

  function draw(state, now = 0, options = {}) {
    const current = state && typeof state === 'object' ? state : {};
    const playerState = current.player && typeof current.player === 'object' ? current.player : {};
    const player = {
      x: finite(playerState.x, 16.5),
      y: finite(playerState.y, 18.5),
      facing: playerState.facing ?? 'down',
    };
    const timestamp = finite(now, 0);
    const paused = options?.paused === true;

    if (lastActiveVisualTime === null) lastActiveVisualTime = timestamp;
    if (!paused) lastActiveVisualTime = timestamp;
    const visualTime = paused ? lastActiveVisualTime : timestamp;

    if (previousPlayer && Math.hypot(player.x - previousPlayer.x, player.y - previousPlayer.y) > 0.002) {
      playerMovingUntil = visualTime + 230;
    }
    previousPlayer = { x: player.x, y: player.y };
    const moving = !paused && visualTime < playerMovingUntil;
    updateCamera(player, timestamp, paused);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = '#6da953';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.imageSmoothingEnabled = false;

    const season = getSeason(current);
    const lighting = getLighting(current);
    const minX = Math.max(0, Math.floor(camera.x) - 3);
    const maxX = Math.min(mapWidth - 1, Math.ceil(camera.x + visibleWidth) + 3);
    const minY = Math.max(0, Math.floor(camera.y) - 3);
    const maxY = Math.min(mapHeight - 1, Math.ceil(camera.y + visibleHeight) + 3);
    const visibleTiles = [];
    const entities = [];

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const type = safeTileAt(x, y);
        const sx = x * TILE - camera.pixelX;
        const sy = y * TILE - camera.pixelY;
        drawTile(x, y, type, sx, sy, visualTime, season);
        visibleTiles.push({ x, y });
      }
    }

    collectFarmPlots(current, minX, maxX, minY, maxY, visualTime, season, entities);
    drawFarmFence(current);
    const buildings = addEntities(current, player, visualTime, moving, visibleTiles, entities);
    entities.sort((a, b) => a.y - b.y || a.order - b.order);
    for (const entity of entities) entity.draw();

    drawTarget(player, visualTime);

    if (lighting.darkness > 0) {
      ctx.fillStyle = `rgba(14, 27, 54, ${lighting.darkness})`;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }
    if (lighting.warmth > 0) {
      ctx.fillStyle = `rgba(243, 155, 83, ${lighting.warmth})`;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }
    drawNightAccents(buildings, lighting);
    drawNightFireflies(visualTime, minX, maxX, minY, maxY, lighting);
    drawWeather(visualTime, lighting);
    ctx.restore();
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const point = canvasPoint(finite(clientX), finite(clientY), rect, VIEW_WIDTH, VIEW_HEIGHT, getComputedStyle(canvas).objectFit);
    return {
      x: camera.pixelX / TILE + point.x / TILE,
      y: camera.pixelY / TILE + point.y / TILE,
      inside: point.inside,
    };
  }

  function drawMap(mapCanvas, state = {}) {
    if (!mapCanvas?.getContext) return;
    const mapCtx = mapCanvas.getContext('2d');
    if (!mapCtx) return;
    const width = Math.max(1, finite(mapCanvas.width, 320));
    const height = Math.max(1, finite(mapCanvas.height, 240));
    const season = seasonNumber(state);
    const compact = width < 400;
    const padding = compact ? 5 : 16;
    const header = compact ? 0 : 24;
    const footer = compact ? 0 : 18;
    const availableWidth = Math.max(1, width - padding * 2);
    const availableHeight = Math.max(1, height - header - footer - padding);
    const miniStrip = width <= 360 && width > height * 1.8;
    const fitScale = Math.max(0.1, Math.min(availableWidth / mapWidth, availableHeight / mapHeight));
    const scaleX = miniStrip ? availableWidth / mapWidth : fitScale;
    const scaleY = miniStrip ? availableHeight / mapHeight : fitScale;
    const scale = Math.min(scaleX, scaleY);
    const mapW = mapWidth * scaleX;
    const mapH = mapHeight * scaleY;
    const originX = miniStrip ? padding : (width - mapW) / 2;
    const originY = header + Math.max(0, (height - header - footer - mapH) / 2);
    const miniGrass = SEASON_ART[season].grass[0];

    mapCtx.save();
    mapCtx.setTransform(1, 0, 0, 1, 0, 0);
    mapCtx.imageSmoothingEnabled = false;
    mapCtx.clearRect(0, 0, width, height);
    mapCtx.fillStyle = '#e9e4cf';
    mapCtx.fillRect(0, 0, width, height);
    mapCtx.fillStyle = '#456c54';
    mapCtx.fillRect(0, 0, width, header);
    mapCtx.font = `${Math.max(9, Math.min(14, header * 0.55))}px ${CANVAS_FONT}`;
    mapCtx.textAlign = 'left';
    mapCtx.textBaseline = 'middle';
    mapCtx.fillStyle = '#f5eed8';
    if (!compact) mapCtx.fillText('MEADOW DAYS  ·  VALLEY MAP', padding, header / 2, width - padding * 2);

    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const type = safeTileAt(x, y);
        let color = miniGrass;
        if (type === 'water') color = season === 3 ? '#61939a' : '#4d9697';
        else if (type === 'path') color = '#bb9b6b';
        else if (type === 'sand') color = '#dfcb94';
        else if (type === 'soil') color = '#896344';
        else if (type === 'stone' || type === 'wall') color = '#747b70';
        else if (type === 'tree') color = SEASON_ART[season].leaf[0];
        else if (type === 'bridge'
          || (type === 'path' && ((safeTileAt(x, y - 1) === 'water' && safeTileAt(x, y + 1) === 'water')
            || (safeTileAt(x - 1, y) === 'water' && safeTileAt(x + 1, y) === 'water')))) color = '#9a714b';
        else if (type === 'flower') color = '#76b862';
        mapCtx.fillStyle = color;
        mapCtx.fillRect(originX + x * scaleX, originY + y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }

    const regions = Array.isArray(WORLD?.regions) ? WORLD.regions : [];
    for (const region of regions) {
      const x = originX + finite(region.x) * scaleX;
      const y = originY + finite(region.y) * scaleY;
      const regionW = finite(region.w) * scaleX;
      const regionH = finite(region.h) * scaleY;
      if (regionW <= 0 || regionH <= 0) continue;
      mapCtx.strokeStyle = typeof region.color === 'string' ? region.color : 'rgba(255, 243, 210, 0.65)';
      mapCtx.lineWidth = Math.max(1, scale * 0.12);
      mapCtx.strokeRect(x + 0.5, y + 0.5, regionW - 1, regionH - 1);
      const name = String(region.name ?? region.id ?? '').trim();
      if (!compact && name && scale >= 1) {
        const font = clamp(scale * 1.55, 6.5, 13);
        mapCtx.font = `600 ${font}px ${CANVAS_FONT}`;
        mapCtx.textAlign = 'center';
        mapCtx.textBaseline = 'middle';
        const centerX = x + regionW / 2;
        const centerY = y + regionH / 2;
        const textWidth = Math.min(regionW - 2, mapCtx.measureText(name).width + 6);
        mapCtx.fillStyle = 'rgba(27, 54, 44, 0.68)';
        mapCtx.fillRect(centerX - textWidth / 2, centerY - font * 0.7, textWidth, font * 1.4);
        mapCtx.fillStyle = '#fff3d5';
        mapCtx.fillText(name, centerX, centerY, Math.max(1, textWidth - 4));
      }
    }

    const buildings = Array.isArray(WORLD?.buildings) ? WORLD.buildings : [];
    for (const building of buildings) {
      mapCtx.fillStyle = roofColor(building);
      mapCtx.fillRect(
        originX + finite(building.x) * scaleX,
        originY + finite(building.y) * scaleY,
        Math.max(3, finite(building.w, 3) * scaleX),
        Math.max(3, finite(building.h, 3) * scaleY * 0.58),
      );
    }

    const objects = Array.isArray(WORLD?.objects) ? WORLD.objects : [];
    for (const object of objects) {
      const type = String(object?.type ?? '').toLowerCase();
      const colors = { bin: '#f1c36c', well: '#d8e6d8', sign: '#e8bd76', chest: '#e6aa4e', ore: '#92c7d0', tree: '#265d45', feed: '#dfd09a', fish: '#c7e8cf' };
      const markerX = originX + (finite(object?.x) + 0.5) * scaleX;
      const markerY = originY + (finite(object?.y) + 0.5) * scaleY;
      mapCtx.fillStyle = colors[type] ?? '#f1e0b2';
      mapCtx.beginPath();
      mapCtx.arc(markerX, markerY, Math.max(1.2, scale * 0.25), 0, TAU);
      mapCtx.fill();
    }

    const pier = getCoastPierPlan();
    if (pier) {
      mapCtx.fillStyle = '#9a7049';
      mapCtx.fillRect(
        originX + (pier.shoreX - 2) * scaleX,
        originY + (pier.y + 0.34) * scaleY,
        5 * scaleX,
        Math.max(2, 0.32 * scaleY),
      );
    }

    const field = inferFieldBounds(state);
    if (field) {
      mapCtx.strokeStyle = '#f4d48b';
      mapCtx.lineWidth = Math.max(1, scale * 0.2);
      mapCtx.strokeRect(
        originX + (field.minX - 0.5) * scaleX,
        originY + (field.minY - 0.5) * scaleY,
        (field.maxX - field.minX + 2) * scaleX,
        (field.maxY - field.minY + 2) * scaleY,
      );
    }

    const animals = Array.isArray(state?.animals) ? state.animals : [];
    for (const animal of animals) {
      mapCtx.fillStyle = '#fff0bc';
      mapCtx.beginPath();
      mapCtx.arc(originX + cellCenter(animal.x) * scaleX, originY + cellCenter(animal.y) * scaleY, Math.max(2, scale * 0.4), 0, TAU);
      mapCtx.fill();
    }

    const monsters = Array.isArray(state?.monsters) ? state.monsters : [];
    for (const monster of monsters) {
      if (monster?.defeated === true) continue;
      mapCtx.fillStyle = '#b17cc1';
      mapCtx.beginPath();
      mapCtx.arc(originX + cellCenter(monster.x) * scaleX, originY + cellCenter(monster.y) * scaleY, Math.max(2, scale * 0.42), 0, TAU);
      mapCtx.fill();
    }

    const player = state?.player ?? { x: 16.5, y: 18.5, facing: 'down' };
    const playerX = originX + finite(player.x, 16.5) * scaleX;
    const playerY = originY + finite(player.y, 18.5) * scaleY;
    mapCtx.fillStyle = 'rgba(29, 47, 40, 0.7)';
    mapCtx.beginPath();
    mapCtx.arc(playerX, playerY, Math.max(4, scale * 0.72), 0, TAU);
    mapCtx.fill();
    mapCtx.fillStyle = '#f8e8a1';
    mapCtx.beginPath();
    mapCtx.arc(playerX, playerY, Math.max(2.2, scale * 0.38), 0, TAU);
    mapCtx.fill();

    if (!compact && height - footer >= 0) {
      const labels = regions.map((region) => String(region.name ?? region.id ?? '')).filter(Boolean);
      const legend = labels.join('  ·  ');
      mapCtx.font = `${Math.max(7, Math.min(10, footer * 0.58))}px ${CANVAS_FONT}`;
      mapCtx.textAlign = 'center';
      mapCtx.textBaseline = 'middle';
      mapCtx.fillStyle = '#496754';
      mapCtx.fillText(legend || 'Northern Mine  ·  Meadow Farm  ·  Meadow Village  ·  Shaded Woods  ·  Sunlit Coast', width / 2, height - footer / 2, width - padding * 2);
    }

    mapCtx.strokeStyle = 'rgba(67, 97, 72, 0.7)';
    mapCtx.lineWidth = 1;
    mapCtx.strokeRect(0.5, 0.5, width - 1, height - 1);
    mapCtx.restore();
  }

  return { draw, screenToWorld, drawMap, camera };
}
