# Dlicom · Meadow Days

A standalone, English-language, browser-playable farming RPG using the supplied Dlicom character art. This directory does not alter or depend on the repository's Technocore bot.

## Run

Requires Node.js 22 or newer. There are no package dependencies, required compilation step, account, wallet, or external API.

```sh
cd game
npm run dev
# http://localhost:3000
```

The repository-owned `.hoplite/settings.json` configures the managed Preview. The server binds to `0.0.0.0` and accepts an optional `PORT` environment variable. Serve the game over HTTP rather than opening `index.html` as a local file; it uses ES modules.

## Publish with GitHub Pages

The game is fully static and can run at a repository subpath without a backend, API keys, or paid hosting. The `Meadow Days Pages` workflow tests pull requests, then publishes only the game when changes reach `master`.

One-time setup for a repository administrator:

1. Open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. Do not select a branch or the repository root: those contain the unrelated bot, not the game entrypoint.
2. Merge the game pull request into `master`.
3. Wait for **Actions → Meadow Days Pages → Deploy game to GitHub Pages** to succeed. Use the URL shown by that deployment; for this repository, the default address is `https://dalgonad.github.io/technocore-bot/`.

If Pages was enabled after the merge, run **Actions → Meadow Days Pages → Run workflow** on `master`. Any approval required by the `github-pages` environment must also be granted by an authorized reviewer. Pull requests only test/package the game; they never publish it.

To inspect the exact deployment files locally:

```sh
cd game
npm test
npm run build:pages
npm run dev
# Open http://localhost:3000/dist/index.html
```

The dependency-free packaging command recreates `game/dist/` with just HTML, CSS, browser modules, sprite assets, and `.nojekyll`. It excludes the bot, raw uploads, tests, save fixtures, development server, and documentation. Asset/module links are relative, so the same files work under `/technocore-bot/` or at a custom-domain root.

Publishing to GitHub Pages changes the browser origin from Preview. Export your save in **Settings** before switching, then import it on the deployed site to continue playing. Saves remain on the player's device and are not synchronized through GitHub. See [ASSETS.md](ASSETS.md) for the supplied artwork's provenance and distribution-rights caveat.

GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) describes the publishing-source and environment requirements.

## Playable features

- A **72 × 56** connected world: farm, village, forest, coast, and northern mine, with traversable paths and river crossings.
- **12 crops** across four 28-day seasons, including winter vegetables. Hoe, sow, water, harvest, regrow, and ship produce. Rain waters the field; incompatible crops wither at season change.
- **Seven tools:** hoe, watering can, seeds, axe, pickaxe, fishing rod, and sword. All are available from the beginning of this build.
- **Four visible monster types:** meadow slime, mine bat, moss spirit, and sand crab. Turn-based encounters are optional; attack, guard, eat, or flee. No surprise random battles in the farm.
- Fishing with a bite cue and timed catch, renewable ore/wood, a starter chicken with feeding/petting/eggs, shops, and claim-once journal rewards.
- Five recognizable villagers, time/weather/weekday-dependent locations, favorite gifts, daily conversation limits, and friendship tracking.
- Day/night lighting, four-season palettes, pause-aware time, and a slower day option. The introductory day starts at 07:00; subsequent days start at 06:00. Menus pause time; fishing remains active.
- Responsive DOM-based UI and dialogs, a world map, touch direction/action buttons, keyboard navigation, and optional action sounds.
- Automatic and manual local saves, JSON import/export, recoverable corrupt-save handling, a previous valid checkpoint, and protection against another tab overwriting the active save.

### Controls

| Action | Keyboard |
| --- | --- |
| Move / face a tile | WASD or arrow keys |
| Use the selected tool | Space; or click the world to face/use one adjacent tile |
| Talk, harvest, open a building, refill, collect eggs | E |
| Pick a tool | 1–7 |
| Cycle tools | Q / R; mouse wheel over the world |
| Inventory / seed selection | I |
| Map / quests / villagers | M / J / K |
| Pause / close a dialog | Escape |

The highlighted adjacent cell is the tool target, not the mouse's distant position. Select seeds in the inventory. Visit the co-op in the eastern village to buy more. The shipping bin and well are above the field; use E facing the house door to sleep. On mobile, use the on-screen direction pad and E/Tool buttons.

## Saves and safety

The namespaced key `dlicom.meadow.v1` keeps this build separate from the attached prototype's `dlicom` and `bintangfarm` saves. This is a new simulation/schema, not a migration of that prototype. Clearing browser data or changing origin/device can remove access to local progress; export a JSON file as a portable backup.

The English interface retains the same item IDs, save key, and schema as the Indonesian Meadow Days build. Existing Meadow Days saves continue to work without resetting progress.

Imports are size-limited, checked by the model, and require confirmation before replacing the active world. Invalid JSON is rejected without touching the current state. If the main checkpoint is unreadable, its original bytes are retained separately and a valid previous checkpoint is used when available. The Settings panel can export those recovery bytes; they may need repair before reuse. The game never uploads save files.

All UI state-derived text is escaped; imported item/type IDs must belong to explicit catalogs. Static serving is confined to this game directory with traversal/dot-file protection. These safeguards and automated tests reduce known failure modes; they are not a guarantee that an entire game is bug-free.

## Verification

```sh
cd game
npm test
```

Native Node tests cover all 12 crop varieties and four monster types, growth and seasons, grid targeting/collision, invalid-action resource invariants, gifts and animal care, fishing, battle rewards, shipping, quests, save validation, and reachability of region/building/object/NPC destinations. Clock tests cover low frame rates and focus resets; pointer tests cover cropped and letterboxed canvas coordinates. The Pages packaging test checks the exact public-file allowlist, byte-for-byte runtime preservation, and removal of stale output.

With the managed Preview already running and the `agent-browser` CLI installed:

```sh
npm run test:browser
# Optional: GAME_URL=http://127.0.0.1:3000/ npm run test:browser
```

The browser suite uses its own isolated browser session. It seeds explicitly constructed saves from a non-game fixture page, then exercises the real toolbar, keyboard, dialogs, shop, planting, harvesting, shipping, sleep, fishing, monsters, mining, friendship, and map. It also checks throttled-frame timing, trusted touch events in an emulated phone, fullscreen targeting, import/export, corrupt-save recovery, and conflicting browser tabs. Fixtures do not modify another browser profile's saves. Tests fail on failed assertions or recorded browser runtime errors. Emulation does not replace testing on physical phones or other browser engines.

## Structure

```text
src/data.js       Crop, item, monster, and villager definitions
src/world.js      Map geometry, collision, regions, and schedule locations
src/core.js       Deterministic simulation and validated save schema
src/renderer.js   Canvas world art, sprites, lighting, camera, and maps
src/app.js        DOM UI, input, persistence, and active frame loop
src/clock.js      Frame-rate-independent, focus-aware active clock
src/pointer.js    Canvas coordinate mapping for touch and fullscreen
assets/          Selected supplied sprite atlases; see ASSETS.md
tests/           Native regression tests and browser smoke suite
server.mjs       Dependency-free static preview server
```

## Scope compared with the GDD

This is a playable build, **not every feature proposed in the GDD**. The user's follow-up requested monsters, so optional encounters are included; the earlier non-combat proposal is no longer the implementation's complete scope. Winter crops also keep planting playable year-round.

The current game has one outdoor connected world and simplified scheduled NPC destinations. Building interiors, advanced tool upgrades/construction, a multi-floor mine, cows/sheep acquisition, full romance scenes/marriage, festivals, and the greenhouse-restoration ending remain design-stage features. There is no server-side economy or multiplayer. The static UI makes these limitations explicit where relevant.
