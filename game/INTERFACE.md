# Implementation contract

This standalone browser game reuses only supplied art, not the archived JavaScript runtime. The original repository's bot remains untouched. Plain ES modules, Canvas 2D, DOM UI, Node native tests. English interface; working title Meadow Days. No external services or runtime dependencies. Save IDs and internal item categories remain unchanged from the Indonesian build.

## Module boundaries

- Simulation: `src/data.js`, `src/world.js`, and `src/core.js`; no DOM or browser storage.
- Rendering: `src/renderer.js` and `src/pointer.js`; read-only access to simulation state.
- Integration: HTML, CSS, `src/app.js`, and `src/clock.js`; input, dialogs, active time, and persistence.

## Data and world exports

`data.js`: `TILE = 32`, `MAP_WIDTH = 72`, `MAP_HEIGHT = 56`; `SEASONS` (`Spring`, `Summer`, `Autumn`, `Winter`); `TOOLS` array `{id,name,icon,cost}` in this fixed order: `hoe,can,seeds,axe,pickaxe,rod,sword`. `CROPS` keyed definitions `{id,name,color,seasons:[seasonIndex],growth,regrow,seedPrice,sellPrice}`. At least 12 crops. `MONSTER_TYPES` keyed definitions `{id,name,color,hp,attack,reward}`. `VILLAGERS` array `{id,name,role,color,gift,home:[x,y]}`: Dlira, Dlito, Dlizal, Dliwi, Dliyu.

`world.js`: `WORLD` object `{width,height,tiles,buildings,objects,regions}`; `tileAt(x,y)` returns string tile (`grass,path,water,bridge,soil,sand,stone,tree,wall`); `isWalkable(state,x,y)`; `regionAt(x,y)` returns `{id,name,subtitle,color}`; `getNpcPosition(state,id)` returns `{x,y,activity,destination}`. Regions: farm (northwest), village (northeast), forest (southwest), coast (southeast), mine (north). Farm spawn `(16.5,18.5)`, facing down, crop field `x=10..23,y=20..27`. Farm house bounds `(9,10,7,5)`, door `(12,15)`; shipping bin `(18,16)`, well `(22,16)`, coop `(25,12,5,4)`. Building entries `{id,name,x,y,w,h,roof,door:[x,y]}`. Object entries `{id,type,x,y}` types `bin,well,sign,chest,ore,tree,feed,fish`. Use integer cell coordinates for objects and anchored sprites; player coordinates are continuous tile units. Region array entries include `{id,name,subtitle,color,x,y,w,h}` rectangular bounds, with non-overlapping region definitions where possible. Build traversable connecting paths/bridges; test BFS to all interactables and regions.

## Authoritative state

`createState()` yields JSON-serializable state:

```js
{
  version: 1, day: 1, minute: 420, season: 0, year: 1, weather: 'sunny',
  gold: 500, stamina: 100, maxStamina: 100, water: 30,
  player: {x:16.5,y:18.5,facing:'down',hp:100},
  tool: 'hoe', selectedSeed: 'turnip',
  inventory: {turnip_seed:8, potato_seed:4, bread:3, feed:5},
  farm: { 'x,y': {tilled:false,watered:false,crop:null} },
  // crop = {id,remaining,ready,withered:false}
  monsters: [{id,type,x,y,hp,defeated:false}],
  animals: [{id,name,x,y,fed:false,petted:false,product:false}],
  friendship: {villagerId:0}, talked: {}, gifted: {},
  shipping: {}, stats: {harvested:0,defeated:0,fished:0,mined:0,planted:0},
  battle: null, fishing: null, quests: {}, options:{relaxed:false},
  // Additional serializable fields allowed; communicate them.
}
```

Intro farm can have 6 planted/ready sample crops for attractive/playable first view; must not consume starter seeds. Include a chicken at start for usable livestock. All actions return `{ok:boolean,message:string,...}`. Never mutate inventory/stamina on failure. Pure functions may mutate state on successful actions; no DOM/global browser APIs in model. Deterministic random seed stored in state.

## Core exports

- `createState()`, `validateState(raw)` (return sanitized compatible state or throw; do not trust arbitrary localStorage); `calendar(state)` returns `{season,day,year,weekday}`; `formatTime(state)` string.
- `targetCell(state)` returns `{x,y}` orthogonally adjacent to player's floored cell.
- `movePlayer(state,dx,dy,seconds)` normalized movement, blocked terrain/objects. Delta bounded by caller; facing updates even blocked. `selectTool(state,id)`, `cycleTool(state,direction)`.
- `useTool(state)` uses current tool on target; handles hoe, can, seed, axe, pickaxe, rod, sword. The sword starts a turn-based battle near a visible monster, never auto-battles while walking. Fishing starts only at adjacent water. Resource harvesting persists till daily reset.
- `interact(state)` returns `{ok,message,kind?,id?}`. kinds `shop,npc,sleep,shipping,well,animal,mine`; harvests mature crop without cost; removes withered crops; refills can at well/water; nearest adjacent valid object. UI opens relevant modal based on kind. Also `getPrompt(state)` returns string describing current target.
- `buyItem(state,itemId,quantity=1)`; `sellItem(state,itemId,quantity=1)` puts into shipping bin, not instant gold; `itemInfo(id)` returns `{name,price,sellPrice,color,type}`. Support seeds, feed, bread, all crop harvests, fish, ores, wood, monster loot. `eatFood(state)` consumes one bread and restores stamina/hp without exceeding maxima.
- `sleep(state,forced=false)` ends day once, pays shipment, grows crops, resets monster/resource spawns, resolves livestock; returns result with settlement. `tick(state,seconds)` updates clock and active fishing; at 02:00 forced sleep. Pausing is caller responsibility. `finishFishing(state)` resolves bite at proper elapsed window; allow no-cost cancel through `cancelFishing(state)`.
- `talkTo(state,id)`, `giveGift(state,id)`, `feedAnimals(state)` daily care. `battleAction(state,action)` (`attack,guard,heal,flee`); no duplicated rewards; lose fight returns player to farm without monetary loss.
- `getQuests(state)` returns array `{id,title,description,progress,target,complete,claimed,reward}`; `claimQuest(state,id)` exactly once.

## Renderer interface

`createRenderer(canvas, assets)` returns `{draw(state,now,options), screenToWorld(clientX,clientY), drawMap(canvas,state), camera}`. `draw` options `{paused:false}`. Camera uses tile units and canvas logical dimensions, follows player, clamps map. Main game canvas logical resolution 960x600 (CSS responsive). Draw only visible tiles. Art direction warm polished pixel/rural game with rich grass, plowed field rows, water ripples, big clustered trees, house roofs, flower/stone details, animated crops, day/night readable lighting, target outline, visible monsters and character name tags. No UI DOM from renderer. No state mutation.

Assets loaded by primary: `assets.hero` 16 frames × 96 cells; `assets.plant` 16×96; `assets.villagers` 40×96 (8 per villager); `assets.robot` 16×160; `assets.items` 16×64; `assets.logo` 256×256. Use sprite index 0 for hero idle unless visual inspection suggests another. Nearest-neighbor. All are `HTMLImageElement` ready or null; fallback procedural character if missing.

## UI and persistence responsibilities

The app owns localStorage try/catch with a distinct versioned key, autosave after successful actions/sleep and every 15 active seconds, and validated import/export. Ordinary dialogs pause simulation; fishing remains active only while the page is visible and focused. The frame clock retains full active elapsed time at low FPS and discards time away on focus/visibility transitions. Menus and battles use DOM dialogs/buttons with keyboard shortcuts and a touch D-pad. Actions are debounced, browser shortcuts are prevented only for active game inputs, and held keys reset on blur or dialog transitions. Native and browser tests cover resource invariants, targeting, calendar seasons, monster rewards, corrupted saves, traversability, timing, and input.
